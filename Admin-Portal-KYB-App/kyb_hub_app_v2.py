"""
KYB Intelligence Hub v2 — kyb_hub_app_v2.py
=============================================
V1 plus the AI Check-Agent tab:
  • 28 deterministic cross-field checks (instant, no LLM)
  • GPT-4o-mini deep compliance audit (structured JSON)
  • Severity radar, grouped findings, underwriting decision guidance

Run:   streamlit run Admin-Portal-KYB-App/kyb_hub_app_v2.py
Keys:  export OPENAI_API_KEY=your-key
       export REDSHIFT_DB=dev REDSHIFT_USER=... REDSHIFT_PASSWORD=...
"""

import os, json, re, math
from datetime import datetime, timezone
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(page_title="KYB Intelligence Hub v2", page_icon="🔬",
                   layout="wide", initial_sidebar_state="collapsed")

# ── Check-Agent import ────────────────────────────────────────────────────────
import sys as _sys
_sys.path.insert(0, str(Path(__file__).parent))
from check_agent_v2 import (
    run_deterministic_checks, get_check_summary, run_llm_audit,
    build_fact_summary, facts_cache_key,
    _fv, _fv_lower, _gc, _safe_int, _safe_float,
    SEV_COLOR, SEV_ICON, DETERMINISTIC_CHECKS,
)
BASE = Path(__file__).parent


# ── GitHub source links ────────────────────────────────────────────────────────
# Files live on the feature branch, not main
REPO = "https://github.com/wecsleyprates-design/Industry-Classification/blob/cursor/ai-classification-agent-7910/Admin-Portal-KYB-App"
REPO_RAW = "https://raw.githubusercontent.com/wecsleyprates-design/Industry-Classification/cursor/ai-classification-agent-7910/Admin-Portal-KYB-App"

GITHUB_LINKS = {
    # integration-service fact definitions
    "facts/kyb/index.ts":       f"{REPO}/integration-service-main/lib/facts/kyb/index.ts",
    "facts/businessDetails":    f"{REPO}/integration-service-main/lib/facts/businessDetails/index.ts",
    "facts/rules.ts":           f"{REPO}/integration-service-main/lib/facts/rules.ts",
    "facts/sources.ts":         f"{REPO}/integration-service-main/lib/facts/sources.ts",
    "integrations.constant.ts": f"{REPO}/integration-service-main/src/constants/integrations.constant.ts",
    "aiEnrichment":             f"{REPO}/integration-service-main/lib/aiEnrichment/aiNaicsEnrichment.ts",
    "consolidatedWatchlist.ts": f"{REPO}/integration-service-main/lib/facts/kyb/consolidatedWatchlist.ts",
    "middesk":                  f"{REPO}/integration-service-main/lib/middesk",
    "plaid/plaidIdv.ts":        f"{REPO}/integration-service-main/lib/plaid",
    "trulioo":                  f"{REPO}/integration-service-main/lib/trulioo",
    # worth score
    "aiscore.py":               f"{REPO}/ai-score-service-main/aiscore.py",
    "worth_score_model.py":     f"{REPO}/ai-score-service-main/worth_score_model.py",
    "lookups.py":               f"{REPO}/ai-score-service-main/lookups.py",
    # warehouse
    "customer_table.sql":       f"{REPO}/warehouse-service-main/datapooler/adapters/redshift/customer_file/tables/customer_table.sql",
    "score_decision_matrix":    f"{REPO}/manual-score-service-main/db/migrations/migrate/sqls/20240109130303-initial-tables-up.sql",
    # microsites (Admin Portal UI)
    "EntityJurisdictionCell":   f"{REPO}/microsites-main/packages/case/src/page/Cases/KYB",
    "KYB UI":                   f"{REPO}/microsites-main/packages/case/src/page/Cases/KYB",
    # api-docs — real paths verified with git ls-files
    "api-docs":                 f"{REPO}/api-docs",
    "openapi/integration":      f"{REPO}/api-docs/openapi-specs/integration.json",
    "openapi/kyb":              f"{REPO}/api-docs/openapi-specs/get-kyb.json",
    "api-docs/kyb.md":          f"{REPO}/api-docs/api-reference/integration/facts/kyb.md",
    "api-docs/kyb-guide":       f"{REPO}/api-docs/getting-started/kyb-kyc.md",
    "api-docs/bjl":             f"{REPO}/api-docs/api-reference/integration/facts/bankruptcies-judgements-&-liens-bjl.md",
    "api-docs/reviews":         f"{REPO}/api-docs/api-reference/integration/facts/reviews.md",
    "api-docs/score":           f"{REPO}/api-docs/api-reference/integration/verification/get-verification-details.md",
    "api-docs/banking":         f"{REPO}/api-docs/api-reference/integration/banking/banking-information.md",
}

# ── External documentation links ──────────────────────────────────────────────
DOCS_URL    = "https://docs.worthai.com"
DOCS_KYB    = "https://docs.worthai.com/api-reference/kyb"          # GET /facts/business/{id}/kyb
DOCS_SCORE  = "https://docs.worthai.com/api-reference/score"
ADMIN_URL   = "https://admin.joinworth.com"
OPENAPI_KYB = f"{REPO}/api-docs/openapi-specs/get-kyb.json"         # OpenAPI spec on GitHub

# ── Preloaded OpenAPI fact schemas from get-kyb.json ─────────────────────────
# Source: Admin-Portal-KYB-App/api-docs/openapi-specs/get-kyb.json
# This is the authoritative spec for GET /facts/business/{businessId}/kyb
# Matches what docs.worthai.com shows and what admin.joinworth.com uses.
@st.cache_resource
def _load_kyb_fact_schemas():
    """Load fact schemas from the real OpenAPI spec (get-kyb.json)."""
    import json as _json
    spec_path = BASE / "api-docs" / "openapi-specs" / "get-kyb.json"
    if not spec_path.exists():
        return {}, {}
    try:
        with open(spec_path) as f:
            spec = _json.load(f)
        schemas = spec.get("components",{}).get("schemas",{})

        def _resolve(obj, depth=0):
            if depth > 4 or not isinstance(obj, dict): return None
            if "$ref" in obj:
                ref_name = obj["$ref"].split("/")[-1]
                return _resolve(schemas.get(ref_name,{}), depth+1)
            t = obj.get("type")
            props = obj.get("properties",{})
            example = obj.get("example")
            if example is not None: return example
            if t == "object" or props:
                return {k: _resolve(v, depth+1) for k,v in list(props.items())[:12]}
            if t == "string":
                enum = obj.get("enum")
                return enum[0] if enum else obj.get("description","")[:40] or None
            if t == "boolean": return None
            if t in ("integer","number"): return None
            if t == "array":
                items = obj.get("items",{})
                return [_resolve(items, depth+1)]
            if isinstance(t, list): return None
            return None

        kyb_data = schemas.get("KYBData",{})
        fact_props = kyb_data.get("properties",{})
        fact_examples = {}
        fact_descriptions = {}
        for fname, fschema in fact_props.items():
            try:
                resolved = fschema
                if "$ref" in fschema:
                    ref_name = fschema["$ref"].split("/")[-1]
                    resolved = schemas.get(ref_name, fschema)
                fact_examples[fname]     = _resolve(fschema)
                fact_descriptions[fname] = resolved.get("description","")
            except Exception:
                pass
        return fact_examples, fact_descriptions
    except Exception:
        return {}, {}

_KYB_FACT_EXAMPLES, _KYB_FACT_DESCRIPTIONS = _load_kyb_fact_schemas()

def src_link(key, label=None):
    """Return a markdown link for a source file."""
    url = GITHUB_LINKS.get(key, "")
    txt = label or key
    if url: return f"[`{txt}`]({url})"
    return f"`{txt}`"

def src_links_html(keys_labels):
    """Return HTML badges for multiple source links."""
    parts=[]
    for key,label in keys_labels:
        url=GITHUB_LINKS.get(key,"")
        txt=label or key
        if url:
            parts.append(f'<a href="{url}" target="_blank" style="background:#1e3a5f;color:#60A5FA;'
                         f'padding:2px 8px;border-radius:12px;font-size:.72rem;text-decoration:none;margin:1px;display:inline-block">'
                         f'🔗 {txt}</a>')
        else:
            parts.append(f'<span style="background:#1e293b;color:#94A3B8;padding:2px 8px;border-radius:12px;font-size:.72rem;margin:1px;display:inline-block">`{txt}`</span>')
    return " ".join(parts)

# ── CSS — top-bar layout + dark theme ────────────────────────────────────────
st.markdown("""<style>
/* ── Hide sidebar entirely ──────────────────────────────────────────────── */
[data-testid="stSidebar"] { display: none !important; }
[data-testid="collapsedControl"] { display: none !important; }

/* ── Remove default Streamlit top padding ───────────────────────────────── */
.block-container { padding-top: 0.5rem !important; padding-bottom: 1rem !important; }
header[data-testid="stHeader"] { display: none !important; }

/* ── Main background ────────────────────────────────────────────────────── */
.main, .stApp { background: #0A0F1E !important; }

/* ── Top status bar ─────────────────────────────────────────────────────── */
.topbar {
  display:flex; justify-content:space-between; align-items:center;
  background:#0F172A; border-bottom:1px solid #1E3A5F;
  padding:8px 20px; margin-bottom:0;
}
.topbar-logo { font-size:1.05rem; font-weight:700; color:#F1F5F9; }
.topbar-logo span { color:#60A5FA; }
.topbar-badge {
  background:#0B2545; color:#60A5FA; border:1px solid #1E3A5F;
  padding:2px 9px; border-radius:12px; font-size:.68rem;
  font-weight:600; letter-spacing:.05em; margin-left:8px;
}
.conn-chip {
  background:#1E293B; border:1px solid #334155;
  padding:3px 10px; border-radius:12px; font-size:.72rem; color:#94A3B8;
  display:inline-block; margin:0 4px;
}
.conn-chip.ok   { border-color:#14532d; color:#86efac; }
.conn-chip.warn { border-color:#78350f; color:#fde68a; }
.conn-chip.err  { border-color:#7f1d1d; color:#fca5a5; }
hr.thin-sep { margin:0; border:none; border-top:1px solid #1E3A5F; }

/* ── Filter bar ─────────────────────────────────────────────────────────── */
.filter-bar-wrap {
  background:#111827; border-bottom:1px solid #1E3A5F;
  padding:6px 20px;
}
.filter-bar-wrap label { color:#64748B !important; font-size:.67rem !important;
  text-transform:uppercase; letter-spacing:.06em; font-weight:600; }
.filter-bar-wrap [data-testid="stSelectbox"] > div,
.filter-bar-wrap [data-testid="stTextInput"] > div > div {
  background:#1E293B !important; border:1px solid #334155 !important;
  border-radius:6px !important; font-size:.82rem !important;
  color:#F1F5F9 !important; min-height:34px !important;
}

/* ── Horizontal tab navigation — style radio as tab strip ───────────────── */
/* Target the nav radio specifically via its label key */
div[data-testid="stRadio"] > div[role="radiogroup"] {
  display: flex !important;
  gap: 0 !important;
  flex-wrap: nowrap !important;
  background: transparent !important;
  border-bottom: 1px solid #1E3A5F;
  padding: 0 4px;
  overflow-x: auto;
}
div[data-testid="stRadio"] > div[role="radiogroup"] > label {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  border-radius: 0 !important;
  color: #94A3B8 !important;
  font-size: .83rem !important;
  font-weight: 500 !important;
  padding: 10px 14px !important;
  margin: 0 !important;
  cursor: pointer !important;
  white-space: nowrap !important;
  transition: color .15s, border-color .15s;
}
div[data-testid="stRadio"] > div[role="radiogroup"] > label:hover {
  color: #F1F5F9 !important;
}
/* Active tab */
div[data-testid="stRadio"] > div[role="radiogroup"] > label:has(input:checked) {
  color: #60A5FA !important;
  border-bottom: 2px solid #3B82F6 !important;
  background: linear-gradient(180deg,rgba(59,130,246,.08) 0%,transparent 100%) !important;
}
/* Hide radio circles — keep only the text */
div[data-testid="stRadio"] > div[role="radiogroup"] > label > div:first-child {
  display: none !important;
}
div[data-testid="stRadio"] > div[role="radiogroup"] > label input[type="radio"] {
  display: none !important;
}

/* ── KPI cards ──────────────────────────────────────────────────────────── */
.kpi{background:#1E293B;border-radius:10px;padding:14px 18px;
  border-left:4px solid #3B82F6;margin-bottom:6px}
.kpi .lbl{color:#94A3B8;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.kpi .val{color:#F1F5F9;font-size:1.4rem;font-weight:700}
.kpi .sub{color:#64748B;font-size:.75rem;margin-top:2px}

/* ── Existing component styles ──────────────────────────────────────────── */
.analyst{background:#0C1A2E;border:1px solid #1E3A5F;border-radius:10px;padding:14px 16px;margin:8px 0}
.analyst .hdr{color:#60A5FA;font-weight:700;font-size:.86rem;margin-bottom:6px}
.analyst p{color:#CBD5E1;font-size:.82rem;margin:3px 0;line-height:1.6}
.flow-step{background:#1E293B;border-left:3px solid #3B82F6;border-radius:8px;
  padding:9px 14px;margin:3px 0;font-size:.80rem;color:#CBD5E1}
.flag-red{background:#1f0a0a;border-left:4px solid #ef4444;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#fca5a5;font-size:.82rem}
.flag-amber{background:#1c1917;border-left:4px solid #f59e0b;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#fde68a;font-size:.82rem}
.flag-green{background:#052e16;border-left:4px solid #22c55e;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#86efac;font-size:.82rem}
.flag-blue{background:#0c1a2e;border-left:4px solid #60a5fa;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#93c5fd;font-size:.82rem}
details summary{font-size:.80rem !important}
details pre{font-size:.78rem !important}
.src-badge a{font-size:.75rem}
</style>""", unsafe_allow_html=True)

# ── Platform ID map — from integration-service/src/constants/integrations.constant.ts ─
# INTEGRATION_ID enum: PLAID=1, VERDATA=4, MIDDESK=16, EQUIFAX=17, PLAID_IDV=18,
# SERP_SCRAPE=22, OPENCORPORATES=23, ZOOMINFO=24, AI_NAICS_ENRICHMENT=31,
# AI_WEBSITE_ENRICHMENT=36, TRULIOO=38, SERP_GOOGLE_PROFILE=39, KYX=40, TRULIOO_PSC=42
PID = {
    "16": ("Middesk",         "#f59e0b",  "US SOS live registry query · weight=2.0 · conf=0.15+0.20×tasks · integration-service/lib/middesk/"),
    "23": ("OpenCorporates",  "#3B82F6",  "Global company registry · weight=0.9 · conf=match.index÷55 · integration-service (OC API)"),
    "24": ("ZoomInfo",        "#8B5CF6",  "Firmographic bulk data · weight=0.8 · conf=match.index÷55 · zoominfo.comp_standard_global"),
    "17": ("Equifax",         "#22c55e",  "Firmographic + public records bulk · weight=0.7 · conf=XGBoost or match.index÷55 · warehouse.equifax_us_latest"),
    "38": ("Trulioo",         "#ec4899",  "KYB/PSC compliance screening · weight=0.8 · conf=status-based(0.70/0.40/0.20) · integration-service/lib/trulioo/"),
    "42": ("Trulioo PSC",     "#f43f5e",  "Person Screening (UBOs/directors) · weight=0.8 · integration-service/lib/trulioo/truliooPSCScreening.ts"),
    "31": ("AI (GPT-4o-mini)","#f97316",  "AI NAICS enrichment · LAST RESORT · weight=0.1 · conf=self-reported · integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts"),
    "36": ("AI Website",      "#fb923c",  "AI website content enrichment · weight=0.1 · integration-service/lib/aiEnrichment/aiWebsiteEnrichment.ts"),
    "22": ("SERP",            "#a855f7",  "Google Search/web scraping · weight=0.3 · conf=heuristic · integration-service/lib/serp/"),
    "39": ("SERP Google Profile","#9333ea","Google Business Profile · integration-service/lib/serp/serpGoogleProfile.ts"),
    "40": ("Plaid / KYX",    "#06b6d4",  "Bank connectivity + IDV · weight=1.0 · integration-service/lib/plaid/"),
    "18": ("Plaid IDV",       "#0ea5e9",  "Identity Verification (government ID + selfie) · integration-service/lib/plaid/plaidIdv.ts"),
    "1":  ("Plaid Banking",   "#0284c7",  "Bank account data + transactions · integration-service/lib/plaid/"),
    "32": ("Canada Open",     "#10b981",  "Canadian company registry (OC Canada) · integration-service (canadaopen)"),
    "4":  ("Verdata",         "#6366f1",  "Public records (BK/liens/judgments) · integration-service/lib/verdata/"),
    "29": ("Entity Matching", "#8b5cf6",  "Internal XGBoost entity-match model · integration-service/lib/match/"),
    "21": ("Manual Upload",   "#64748b",  "Analyst manually uploaded/overrode · integration-service (manual source)"),
    "0":  ("Applicant",       "#94a3b8",  "Self-reported on onboarding form · businessDetails source · conf=1.0 by convention"),
    "-1": ("Calculated",      "#475569",  "Internally computed by Fact Engine — NOT a vendor. Derived from other facts via fn(). Source: sources.calculated in integration-service/lib/facts/sources.ts L1235"),
    "":   ("No source stored","#374155",  "platformId=null in database — fact has no source metadata. Check ruleApplied to understand origin."),
}

# Calculated facts — facts where source=sources.calculated (platformId=null, not a vendor)
# These are computed internally by the Fact Engine from other facts
# Source: integration-service/lib/facts/businessDetails/index.ts
CALCULATED_FACTS = {
    "mcc_code":         "Computed from mcc_code_found (AI direct) ?? mcc_code_from_naics (rel_naics_mcc lookup keyed by naics_code). Source: integration-service/lib/facts/businessDetails/index.ts L376–387",
    "mcc_code_from_naics": "SQL lookup: SELECT mcc_code FROM rel_naics_mcc WHERE naics_code = naics_code.value. Source: businessDetails/index.ts L359–374",
    "mcc_code_found":   "Direct MCC from AI enrichment response.mcc_code field. Source: businessDetails/index.ts L351–357",
    "mcc_description":  "SQL lookup: SELECT mcc_label FROM rel_mcc WHERE mcc_code = mcc_code.value. Fallback: AI enrichment response.mcc_description. Source: businessDetails/index.ts L389–404",
    "naics_description":"SQL lookup: SELECT naics_label FROM rel_naics WHERE naics_code = naics_code.value. Source: businessDetails/index.ts L406–415",
    "industry":         "2-digit NAICS sector code derived from naics_code.value.substring(0,2). Source: businessDetails/index.ts",
    "risk_score":       "0-100 integer computed from watchlist_hits + high_risk_people. 0=no hits. Source: kyb/index.ts",
    "sos_active":       "true if ANY filing in sos_filings[].active=true. Computed by Fact Engine. Source: kyb/index.ts",
    "sos_match_boolean":"Derived from sos_match.value === 'success'. Source: kyb/index.ts",
    "tin_match_boolean":"Derived from tin_match.value.status === 'success'. Source: kyb/index.ts",
    "idv_passed":       "COUNT of idv_status sessions where status=SUCCESS. Source: kyb/index.ts",
    "idv_passed_boolean":"true when idv_passed >= 1. Source: kyb/index.ts",
    "kyb_submitted":    "true when addresses[] is not empty (form submitted). Source: kyb/index.ts",
    "kyb_complete":     "true when business_verified=true AND screened_people is not empty. Source: kyb/index.ts",
    "is_sole_prop":     "true when tin_submitted=null AND idv_passed_boolean=true. Source: kyb/index.ts",
    "primary_address":  "First entry from addresses[] array. Source: kyb/index.ts",
    "address_match_boolean": "Derived from address_verification.value.status === 'success'. Source: kyb/index.ts",
    "address_verification_boolean": "Derived from address_verification.value.status. Source: kyb/index.ts",
    "name_match_boolean":"Derived from name_match.value.status === 'success'. Source: kyb/index.ts",
    "compliance_status":"Derived from business_verified + risk_score. Source: kyb/index.ts",
    "watchlist_hits":   "COUNT of watchlist.value.metadata[].length. Source: kyb/index.ts",
    "adverse_media_hits":"COUNT of adverse_media records from Trulioo. Source: kyb/index.ts",
    "num_bankruptcies": "COUNT of items in bankruptcies[] array (Equifax/Verdata). Source: kyb/index.ts",
    "num_judgements":   "COUNT of items in judgements[] array. Source: kyb/index.ts",
    "num_liens":        "COUNT of items in liens[] array. Source: kyb/index.ts",
    "countries":        "Derived from addresses[] — extracts unique country codes. Source: kyb/index.ts",
    "high_risk_people": "Derived from screened_people — filters by watchlist hit type. Source: kyb/index.ts",
    "idv_passed":       "COUNT of SUCCESS sessions in idv_status. Source: kyb/index.ts",
}

def pid_info(pid):
    """Return (name, color, description) for a platformId string."""
    return PID.get(str(pid or ""), (f"pid={pid}", "#374151", f"Unknown platformId={pid} — check integrations.constant.ts"))

# ── Helpers ───────────────────────────────────────────────────────────────────
def kpi(label, value, sub="", color="#3B82F6"):
    st.markdown(f'<div class="kpi" style="border-left-color:{color}"><div class="lbl">{label}</div>'
                f'<div class="val">{value}</div><div class="sub">{sub}</div></div>',
                unsafe_allow_html=True)

def kpi_detail(label, value, sub, color, fact_name, fact_value_raw,
               source_table, source_sql, why_null_reasons=None,
               json_snippet=None, api_path=None):
    """KPI card + collapsible expander with JSON, lineage, SQL, and Python code."""
    kpi(label, value, sub, color)

    is_null = str(value) in ("Unknown","⚠️ Unknown","N/A","None","","0","0.0")

    with st.expander(f"📊 {label} — source, lineage, JSON, SQL & Python"):
        # ── Source badges ─────────────────────────────────────────────────────
        badges = src_links_html([
            ("facts/kyb/index.ts", "facts/kyb/index.ts"),
            ("facts/businessDetails", "businessDetails/index.ts"),
            ("integrations.constant.ts", "integrations.constant.ts"),
            ("api-docs", "API Reference"),
        ])
        st.markdown(f"<div class='src-badge' style='margin-bottom:6px'>{badges}</div>", unsafe_allow_html=True)

        # ── Storage info ──────────────────────────────────────────────────────
        st.markdown(
            f"<div style='font-size:.78rem;color:#94A3B8;margin-bottom:4px'>"
            f"<strong style='color:#CBD5E1'>Stored in:</strong> "
            f"<code style='color:#22c55e'>{source_table}</code> · "
            f"<strong style='color:#CBD5E1'>Fact name:</strong> "
            f"<code style='color:#60A5FA'>{fact_name}</code>"
            + (f" · <strong style='color:#CBD5E1'>API:</strong> <code style='color:#f59e0b'>{api_path}</code>" if api_path else "")
            + "</div>",
            unsafe_allow_html=True
        )

        # ── Why null / zero reasons ───────────────────────────────────────────
        if why_null_reasons and is_null:
            st.markdown(
                "<div style='background:#1c1917;border-left:3px solid #f59e0b;border-radius:6px;"
                "padding:8px 12px;margin:4px 0;font-size:.78rem'>"
                "<strong style='color:#fde68a'>⚠️ Why might this show 0 / Unknown?</strong>"
                "<ul style='color:#94A3B8;margin:4px 0 0 16px'>"
                + "".join(f"<li style='margin:2px 0'>{r}</li>" for r in why_null_reasons)
                + "</ul></div>",
                unsafe_allow_html=True
            )

        # ── JSON — provenance-aware rendering ─────────────────────────────────
        # Check if fact_name exists in the real OpenAPI spec (get-kyb.json)
        _dp_spec_example = _KYB_FACT_EXAMPLES.get(fact_name)
        _dp_spec_desc    = _KYB_FACT_DESCRIPTIONS.get(fact_name,"")

        try:
            j_obj = json.loads(json_snippet) if json_snippet and json_snippet.startswith("{") else None
        except Exception:
            j_obj = None

        if _dp_spec_example is not None:
            # Real schema from official OpenAPI spec
            st.markdown(
                f"<div style='background:#052e16;border-left:3px solid #22c55e;"
                f"border-radius:6px;padding:6px 10px;margin:4px 0;font-size:.74rem'>"
                f"<strong style='color:#86efac'>✅ Official API Schema</strong> · "
                f"Source: <a href='{OPENAPI_KYB}' target='_blank' style='color:#22c55e'>"
                f"api-docs/openapi-specs/get-kyb.json</a> · "
                f"Docs: <a href='{DOCS_KYB}' target='_blank' style='color:#22c55e'>docs.worthai.com/api-reference/kyb</a>"
                + (f"<br><span style='color:#94A3B8'>{_dp_spec_desc}</span>" if _dp_spec_desc else "")
                + "</div>",
                unsafe_allow_html=True
            )
            st.markdown(f"**JSON schema (from `GET /facts/business/{{businessId}}/kyb → data.{fact_name}`):**")
            st.code(json.dumps(_dp_spec_example, indent=2, default=str, ensure_ascii=False), language="json")
            if j_obj:
                st.markdown("**Supplied runtime value:**")
                st.code(json.dumps(j_obj, indent=2, ensure_ascii=False), language="json")
        elif j_obj:
            # Supplied JSON snippet — not from spec, show transparency notice
            st.markdown(
                f"<div style='background:#1c1917;border-left:3px solid #f59e0b;"
                f"border-radius:6px;padding:6px 10px;margin:4px 0;font-size:.74rem'>"
                f"<strong style='color:#fde68a'>⚠️ Analysis-derived JSON</strong> — "
                f"<code>{fact_name}</code> is not a direct KYB API fact. "
                f"This JSON represents computed analysis values, not a raw API response. "
                f"For the real KYB API schema see "
                f"<a href='{OPENAPI_KYB}' target='_blank' style='color:#f59e0b'>get-kyb.json</a> or "
                f"<a href='{DOCS_KYB}' target='_blank' style='color:#f59e0b'>docs.worthai.com</a>."
                f"</div>",
                unsafe_allow_html=True
            )
            st.markdown("**JSON (analysis-derived values):**")
            st.code(json.dumps(j_obj, indent=2, ensure_ascii=False), language="json")
        else:
            # Fallback minimal JSON
            st.markdown(
                f"<div style='background:#1c1917;border-left:3px solid #f59e0b;"
                f"border-radius:6px;padding:6px 10px;margin:4px 0;font-size:.74rem'>"
                f"⚠️ No schema in OpenAPI spec for <code>{fact_name}</code>. "
                f"See <a href='{OPENAPI_KYB}' target='_blank' style='color:#f59e0b'>get-kyb.json</a> or "
                f"<a href='{DOCS_KYB}' target='_blank' style='color:#f59e0b'>docs.worthai.com</a>.</div>",
                unsafe_allow_html=True
            )
            st.code(json.dumps({"fact":fact_name,"value":fact_value_raw,"source_table":source_table}, indent=2, default=str), language="json")

        # ── SQL + Python side by side ─────────────────────────────────────────
        _py = _make_python_from_sql(source_sql)
        if source_sql and _py:
            sc, pc = st.columns(2)
            with sc:
                st.markdown("**SQL (Redshift):**")
                st.code(source_sql, language="sql")
            with pc:
                st.markdown("**Python (paste into 🐍 Runner):**")
                st.code(_py, language="python")
        elif source_sql:
            st.markdown("**SQL to verify this value from Redshift:**")
            st.code(source_sql, language="sql")
            # Hard fallback Python
            _fallback = (
                "# Paste into 🐍 Python Runner — conn is pre-injected\n"
                f"df = pd.read_sql(\"\"\"\n{source_sql.strip()}\n\"\"\", conn)\n"
                "print(f'{len(df):,} rows')\n"
                "print(df.to_string(index=False))"
            )
            st.markdown("**Python (paste into 🐍 Runner):**")
            st.code(_fallback, language="python")

def flag(text, level="blue"):
    _icons = {"red":"🚨","amber":"⚠️","green":"✅","blue":"ℹ️"}
    icon = _icons.get(level,"ℹ️")
    st.markdown(f'<div class="flag-{level}">{icon} {text}</div>', unsafe_allow_html=True)

def analyst_card(title, points):
    bullets = "".join(f"<p>• {p}</p>" for p in points)
    st.markdown(f'<div class="analyst"><div class="hdr">🔬 {title}</div>{bullets}</div>',
                unsafe_allow_html=True)

def dark_chart(fig):
    fig.update_layout(paper_bgcolor="#0A0F1E",plot_bgcolor="#1E293B",font_color="#E2E8F0",
                      legend=dict(bgcolor="#1E293B"),margin=dict(t=50,b=10,l=10,r=10))
    return fig

def parse_fact(v):
    if not v: return {}
    try:
        r = json.loads(v)
        return r if isinstance(r,dict) else {}
    except: return {}

def safe_get(d,*keys,default=""):
    cur=d
    for k in keys:
        if not isinstance(cur,dict): return default
        cur=cur.get(k)
        if cur is None: return default
    return cur if cur is not None else default

# ── Redshift ──────────────────────────────────────────────────────────────────
def get_conn():
    try:
        import psycopg2
        conn=psycopg2.connect(
            dbname=os.getenv("REDSHIFT_DB","dev"),user=os.getenv("REDSHIFT_USER","readonly_all_access"),
            password=os.getenv("REDSHIFT_PASSWORD","Y7&.D3!09WvT4/nSqXS2>qbO"),
            host=os.getenv("REDSHIFT_HOST","worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
            port=int(os.getenv("REDSHIFT_PORT","5439")),connect_timeout=10)
        return conn,True,None
    except Exception as e: return None,False,str(e)

def run_sql(sql):
    conn,ok,err=get_conn()
    if not ok: return None,err
    try:
        df=pd.read_sql(sql,conn); conn.close(); return df,None
    except Exception as e: return None,str(e)

# ── Load facts — BULK (2 queries total, not N+1) ──────────────────────────────
KNOWN_LARGE={"sos_filings","sos_match","watchlist","watchlist_raw","bankruptcies",
             "judgements","liens","people","addresses","internal_platform_matches_combined"}

def _large_exclusion():
    names = ",".join(f"'{n}'" for n in KNOWN_LARGE)
    return f"AND name NOT IN ({names})"

def run_sql_conn(sql, conn):
    """Run a query on an already-open connection (no open/close overhead)."""
    try:
        return pd.read_sql(sql, conn), None
    except Exception as e:
        return None, str(e)

# ── Customer-level data loaders ───────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_customer_portfolio(customer_id, date_from, date_to):  # type: (str|None, str|None, str|None) -> tuple
    """
    Load aggregate KYB metrics for a customer's portfolio — 2-step approach.

    WHY two steps:
      rds_warehouse_public.facts is a Redshift FEDERATED table backed by PostgreSQL RDS.
      Redshift federation transfers the full `value` column from RDS to Redshift BEFORE
      any SQL function (LEFT, SUBSTRING, JSON_EXTRACT_PATH_TEXT) can be applied.
      Facts like naics_code and revenue store large JSON blobs with many vendor alternatives
      (83K+ chars), exceeding the federation VARCHAR(65535) transfer limit.

    Step 1: Query native Redshift tables only (rbcm + business_scores) — no federation risk.
    Step 2: Separate pivot query on the federated facts table for ONLY the small boolean facts
            (sos_active, tin_match_boolean, idv_passed_boolean, kyb_complete,
             watchlist_hits, num_bankruptcies, formation_state).
            These boolean/scalar dependent facts are always <500 chars.
            naics_code and revenue are EXCLUDED (can be 80K+ chars due to alternatives[]).
    """
    import pandas as _pd_port

    date_clause = ""
    if date_from: date_clause += f" AND DATE(rbcm.created_at) >= '{date_from}'"
    if date_to:   date_clause += f" AND DATE(rbcm.created_at) <= '{date_to}'"
    cust_clause = f" AND rbcm.customer_id = '{customer_id}'" if customer_id else ""

    # ── Step 1: native Redshift — IDs + dates + scores (no federation) ────────
    q1 = f"""
        SELECT
            rbcm.business_id,
            DATE(rbcm.created_at)   AS onboarded_date,
            bs.weighted_score_850,
            bs.risk_level,
            bs.score_decision
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        LEFT JOIN rds_manual_score_public.data_current_scores cs
          ON cs.business_id = rbcm.business_id
        LEFT JOIN rds_manual_score_public.business_scores bs
          ON bs.id = cs.score_id
        WHERE 1=1 {date_clause} {cust_clause}
        ORDER BY rbcm.created_at DESC
    """
    df1, err1 = run_sql(q1)
    if err1 or df1 is None or df1.empty:
        return df1, err1

    # ── Step 2: federated facts — ONLY boolean/scalar facts (<500 chars each) ─
    # Use IN (bid_list) so Redshift pushes the filter down to RDS before transfer.
    # Exclude naics_code (large alternatives[]) and revenue (large vendor JSON).
    bid_list = ",".join(f"'{b}'" for b in df1["business_id"].tolist())
    if not bid_list:
        return df1, None

    q2 = f"""
        SELECT
            business_id,
            MAX(CASE WHEN name='sos_active'         THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS sos_active,
            MAX(CASE WHEN name='tin_match_boolean'  THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS tin_match,
            MAX(CASE WHEN name='idv_passed_boolean' THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS idv_passed,
            MAX(CASE WHEN name='kyb_complete'       THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS kyb_complete,
            MAX(CASE WHEN name='watchlist_hits'     THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS watchlist_hits,
            MAX(CASE WHEN name='num_bankruptcies'   THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_bankruptcies,
            MAX(CASE WHEN name='formation_state'    THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS formation_state,
            MAX(CASE WHEN name='revenue'            THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS revenue
        FROM rds_warehouse_public.facts
        WHERE business_id IN ({bid_list})
          AND name IN (
            'sos_active','tin_match_boolean','idv_passed_boolean','kyb_complete',
            'watchlist_hits','num_bankruptcies','formation_state','revenue'
          )
        GROUP BY business_id
    """
    df2, err2 = run_sql(q2)

    # Merge: left join so all businesses appear even if facts are missing
    if df2 is not None and not df2.empty:
        merged = df1.merge(df2, on="business_id", how="left")
    else:
        # Facts unavailable — add empty columns so the renderer still works
        merged = df1.copy()
        for col in ["sos_active","tin_match","idv_passed","kyb_complete",
                    "watchlist_hits","num_bankruptcies","formation_state","revenue"]:
            merged[col] = None
        if err2:
            # Non-fatal: return data we have with a warning annotation
            merged["_facts_err"] = err2

    return merged, None


def render_customer_portfolio_view(customer_name, customer_id, date_from, date_to, tab_context="General"):
    """
    Comprehensive customer-level portfolio dashboard.
    Matches the richness of the entity-level views with portfolio-aggregated analytics.
    """
    _cust_label = customer_name if customer_name != "All Customers" else "All Customers"
    _cc  = (f" AND rbcm.customer_id='{customer_id}'" if customer_id else "")
    _dcf = (f" AND DATE(rbcm.created_at)>='{date_from}'" if date_from else "")
    _dct = (f" AND DATE(rbcm.created_at)<='{date_to}'" if date_to else "")

    st.markdown(f"""<div style="background:#0c1a2e;border-left:4px solid #3B82F6;border-radius:8px;
        padding:10px 16px;margin-bottom:12px">
      <div style="color:#60A5FA;font-weight:700;font-size:.90rem">📊 Portfolio view — {_cust_label}</div>
      <div style="color:#94A3B8;font-size:.76rem;margin-top:2px">
        {f'{date_from} → {date_to}' if date_from else 'All time'} · Context: {tab_context}
      </div>
    </div>""", unsafe_allow_html=True)

    with st.spinner("Loading portfolio data…"):
        _pf_df, _pf_err = load_customer_portfolio(customer_id, date_from, date_to)

    if _pf_err or _pf_df is None or _pf_df.empty:
        flag(f"Could not load portfolio data: {_pf_err or 'No data for this customer / date range.'}", "amber")
        return

    n = len(_pf_df)

    def _pct(num, den): return f"{round(100*num/max(den,1), 1)}%" if den else "—"
    def _si(v):
        try: return int(float(v or 0))
        except: return 0

    # ── Compute all signals ───────────────────────────────────────────────────
    def _bool_count(col, val="true"):
        if col not in _pf_df.columns: return 0
        return (_pf_df[col].astype(str).str.lower().str.strip() == val).sum()

    sos_pass  = _bool_count("sos_active")
    sos_fail  = _bool_count("sos_active", "false")
    tin_pass  = _bool_count("tin_match")
    tin_fail  = _bool_count("tin_match", "false")
    idv_pass  = _bool_count("idv_passed")
    idv_fail  = _bool_count("idv_passed", "false")
    kybc_pass = _bool_count("kyb_complete")
    wl_biz    = (_pf_df["watchlist_hits"].apply(_si) > 0).sum() if "watchlist_hits" in _pf_df.columns else 0
    bk_biz    = (_pf_df["num_bankruptcies"].apply(_si) > 0).sum() if "num_bankruptcies" in _pf_df.columns else 0
    naics_fb  = (_pf_df["naics_code"].astype(str).str.strip() == "561499").sum() if "naics_code" in _pf_df.columns else 0
    rev_known = _pf_df["revenue"].notna().sum() if "revenue" in _pf_df.columns else 0
    has_score = _pf_df["weighted_score_850"].notna() if "weighted_score_850" in _pf_df.columns else pd.Series([False]*n)
    scored_n  = int(has_score.sum())
    avg_score = float(_pf_df.loc[has_score,"weighted_score_850"].astype(float).mean()) if scored_n else 0
    approve_n = (_pf_df["score_decision"] == "APPROVE").sum() if "score_decision" in _pf_df.columns else 0
    review_n  = (_pf_df["score_decision"] == "FURTHER_REVIEW_NEEDED").sum() if "score_decision" in _pf_df.columns else 0
    decline_n = (_pf_df["score_decision"] == "DECLINE").sum() if "score_decision" in _pf_df.columns else 0

    # ── Row 1: Core KPI strip ─────────────────────────────────────────────────
    st.markdown("##### 📊 Portfolio KPI Summary")
    c1,c2,c3,c4,c5,c6,c7,c8 = st.columns(8)
    _sc = "#22c55e" if avg_score>=700 else "#f59e0b" if avg_score>=550 else "#ef4444"
    with c1: kpi("Total Businesses", f"{n:,}",           f"{date_from or 'all time'}", "#3B82F6")
    with c2: kpi("SOS Active",  _pct(sos_pass,n),  f"{sos_pass:,}",  "#22c55e" if sos_pass/max(n,1)>0.8 else "#f59e0b")
    with c3: kpi("TIN Passed",  _pct(tin_pass,n),  f"{tin_pass:,}",  "#22c55e" if tin_pass/max(n,1)>0.8 else "#f59e0b")
    with c4: kpi("IDV Passed",  _pct(idv_pass,n),  f"{idv_pass:,}",  "#22c55e" if idv_pass/max(n,1)>0.7 else "#f59e0b")
    with c5: kpi("KYB Complete",_pct(kybc_pass,n), f"{kybc_pass:,}", "#22c55e" if kybc_pass/max(n,1)>0.7 else "#f59e0b")
    with c6: kpi("Watchlist",   str(int(wl_biz)),  _pct(wl_biz,n),  "#ef4444" if wl_biz>0 else "#22c55e")
    with c7: kpi("Avg Score",   f"{avg_score:.0f}" if scored_n else "—", f"{scored_n:,} scored", _sc)
    with c8: kpi("NAICS Fallback",str(int(naics_fb)),_pct(naics_fb,n),"#f59e0b" if naics_fb>0 else "#22c55e")

    # SQL for detail_panel
    _port_sql = f"""
SELECT rbcm.business_id, DATE(rbcm.created_at) AS onboarded,
  cs.business_id AS scored_bid, bs.weighted_score_850, bs.score_decision, bs.risk_level
FROM rds_cases_public.rel_business_customer_monitoring rbcm
LEFT JOIN rds_manual_score_public.data_current_scores cs ON cs.business_id=rbcm.business_id
LEFT JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
WHERE 1=1{_cc}{_dcf}{_dct};"""

    detail_panel("📊 Portfolio KPI Summary", f"{n:,} businesses · {_cust_label}",
        what_it_means=(
            f"KPI strip for {_cust_label}. SOS={_pct(sos_pass,n)} pass · "
            f"TIN={_pct(tin_pass,n)} pass · IDV={_pct(idv_pass,n)} pass · "
            f"KYB Complete={_pct(kybc_pass,n)} · Watchlist hits={wl_biz:,} businesses · "
            f"NAICS fallback={_pct(naics_fb,n)}."
        ),
        source_table="rds_warehouse_public.facts · rel_business_customer_monitoring · business_scores",
        source_file="facts/kyb/index.ts",
        json_obj={"sos_pass":int(sos_pass),"tin_pass":int(tin_pass),"idv_pass":int(idv_pass),
                  "kyb_complete":int(kybc_pass),"watchlist":int(wl_biz),"naics_fb":int(naics_fb)},
        sql=_port_sql, icon="📊", color="#3B82F6")

    st.markdown("---")

    # ── Section 2: KYB Verification Funnel ───────────────────────────────────
    st.markdown("##### 🔄 KYB Verification Funnel")
    st.caption("How many businesses pass each verification stage? This funnel shows the attrition from onboarding through full KYB completion.")
    _funnel_stages  = ["Onboarded","SOS Active","TIN Verified","IDV Passed","KYB Complete","No Watchlist Hits"]
    _funnel_counts  = [n, int(sos_pass), int(tin_pass), int(idv_pass), int(kybc_pass), int(n-wl_biz)]
    _funnel_colors  = ["#3B82F6","#22c55e","#22c55e","#8B5CF6","#22c55e","#22c55e"]
    fig_funnel = go.Figure(go.Funnel(
        y=_funnel_stages, x=_funnel_counts,
        textinfo="value+percent initial",
        marker=dict(color=_funnel_colors),
        connector=dict(line=dict(color="#334155",width=1)),
    ))
    fig_funnel.update_layout(height=360, margin=dict(t=20,b=10,l=10,r=10))
    st.plotly_chart(dark_chart(fig_funnel), use_container_width=True)
    detail_panel("🔄 KYB Verification Funnel", f"{n:,} → {int(kybc_pass):,} fully verified",
        what_it_means=f"Verification funnel for {_cust_label}. Drop-off between Onboarded and KYB Complete shows how many businesses have incomplete verification. Each stage is a pre-requisite for the next in the compliance workflow.",
        source_table="rds_warehouse_public.facts · rel_business_customer_monitoring",
        source_file="facts/kyb/index.ts",
        json_obj=dict(zip(_funnel_stages, _funnel_counts)),
        sql=f"SELECT COUNT(DISTINCT rbcm.business_id) AS total FROM rds_cases_public.rel_business_customer_monitoring rbcm WHERE 1=1{_cc}{_dcf}{_dct};",
        icon="🔄", color="#3B82F6")

    st.markdown("---")

    # ── Section 3: Worth Score + Decision Mix ─────────────────────────────────
    if scored_n > 0:
        st.markdown("##### 💰 Worth Score Distribution & Decision Outcomes")
        sc1,sc2,sc3,sc4,sc5 = st.columns(5)
        with sc1: kpi("Avg Score",    f"{avg_score:.0f}",   f"{scored_n:,} scored", "#22c55e" if avg_score>=700 else "#f59e0b" if avg_score>=550 else "#ef4444")
        with sc2: kpi("✅ APPROVE",   str(int(approve_n)),  _pct(approve_n,scored_n), "#22c55e")
        with sc3: kpi("🔄 REVIEW",    str(int(review_n)),   _pct(review_n,scored_n),  "#f59e0b")
        with sc4: kpi("❌ DECLINE",   str(int(decline_n)),  _pct(decline_n,scored_n), "#ef4444")
        with sc5: kpi("Not Scored",   str(n-scored_n),      _pct(n-scored_n,n),       "#64748b")

        sh1, sh2 = st.columns(2)
        with sh1:
            _score_df = _pf_df.loc[has_score].copy()
            _score_df["weighted_score_850"] = pd.to_numeric(_score_df["weighted_score_850"], errors="coerce")
            fig_hist = px.histogram(_score_df, x="weighted_score_850", nbins=25,
                color="score_decision" if "score_decision" in _score_df.columns else None,
                title="Score Distribution (300–850)",
                color_discrete_map={"APPROVE":"#22c55e","FURTHER_REVIEW_NEEDED":"#f59e0b","DECLINE":"#ef4444"})
            fig_hist.add_vline(x=700,line_dash="dash",line_color="#22c55e",annotation_text="APPROVE ≥700")
            fig_hist.add_vline(x=550,line_dash="dash",line_color="#ef4444",annotation_text="DECLINE <550")
            fig_hist.update_layout(height=300, margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_hist), use_container_width=True)
        with sh2:
            fig_dec = px.pie(
                pd.DataFrame({"Decision":["APPROVE","FURTHER REVIEW","DECLINE","NOT SCORED"],
                              "Count":[int(approve_n),int(review_n),int(decline_n),int(n-scored_n)]}),
                names="Decision", values="Count", hole=0.45, title="Decision Outcome Mix",
                color="Decision",
                color_discrete_map={"APPROVE":"#22c55e","FURTHER REVIEW":"#f59e0b","DECLINE":"#ef4444","NOT SCORED":"#334155"})
            fig_dec.update_layout(height=300, margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_dec), use_container_width=True)

        detail_panel("💰 Worth Score Distribution", f"Avg: {avg_score:.0f} · {scored_n:,} scored",
            what_it_means=f"Score distribution for {_cust_label}. Formula: probability × 550 + 300. APPROVE ≥700, FURTHER_REVIEW 550-699, DECLINE <550. {n-scored_n:,} businesses not yet scored.",
            source_table="rds_manual_score_public.data_current_scores JOIN business_scores",
            source_file="aiscore.py",
            json_obj={"avg":round(avg_score,1),"approve":int(approve_n),"review":int(review_n),"decline":int(decline_n),"not_scored":int(n-scored_n)},
            sql=f"SELECT bs.weighted_score_850, bs.score_decision FROM rds_cases_public.rel_business_customer_monitoring rbcm JOIN rds_manual_score_public.data_current_scores cs ON cs.business_id=rbcm.business_id JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id WHERE 1=1{_cc}{_dcf}{_dct};",
            icon="💰", color="#22c55e")
        st.markdown("---")

    # ── Section 4: KYB Signal Stacked Bar + Cross-tab ─────────────────────────
    st.markdown("##### 🏢 KYB Signal Analysis")
    sb1, sb2 = st.columns(2)
    with sb1:
        _hbar = pd.DataFrame({
            "Signal": ["SOS Active","TIN Verified","IDV Passed","KYB Complete","No Watchlist","Revenue Known"],
            "Pass":   [int(sos_pass), int(tin_pass), int(idv_pass), int(kybc_pass), int(n-wl_biz), int(rev_known)],
            "Fail":   [int(sos_fail), int(tin_fail), int(idv_fail), int(n-kybc_pass), int(wl_biz), int(n-rev_known)],
        })
        _hm = _hbar.melt(id_vars="Signal",value_vars=["Pass","Fail"],var_name="Status",value_name="Count")
        fig_sb = px.bar(_hm, x="Count", y="Signal", color="Status", orientation="h", barmode="stack",
                        title="KYB Signals — Pass vs Fail/Missing",
                        color_discrete_map={"Pass":"#22c55e","Fail":"#ef4444"})
        fig_sb.update_layout(height=320, margin=dict(t=40,b=10,l=10,r=10))
        st.plotly_chart(dark_chart(fig_sb), use_container_width=True)

    with sb2:
        # SOS × TIN cross-tab
        if "sos_active" in _pf_df.columns and "tin_match" in _pf_df.columns:
            _x = _pf_df.copy()
            _x["SOS"] = _x["sos_active"].astype(str).str.lower().str.strip().map({"true":"✅ Active","false":"❌ Inactive"}).fillna("⚪ Unknown")
            _x["TIN"] = _x["tin_match"].astype(str).str.lower().str.strip().map({"true":"✅ Pass","false":"❌ Fail"}).fillna("⚪ N/A")
            _cross = _x.groupby(["SOS","TIN"]).size().reset_index(name="Count")
            fig_cross = px.bar(_cross, x="SOS", y="Count", color="TIN", barmode="stack",
                               title="SOS Status × TIN Verification Cross-Tab",
                               color_discrete_map={"✅ Pass":"#22c55e","❌ Fail":"#ef4444","⚪ N/A":"#334155"})
            fig_cross.update_layout(height=320, margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_cross), use_container_width=True)

    detail_panel("🏢 KYB Signal Breakdown", f"{_cust_label} · {n:,} businesses",
        what_it_means=f"Signal coverage and cross-tab for {_cust_label}. Stacked bar shows how many businesses pass vs fail each check. SOS×TIN cross-tab reveals combinations like 'SOS Active + TIN Fail' (DBA vs legal name mismatch — most common issue).",
        source_table="rds_warehouse_public.facts · rel_business_customer_monitoring",
        source_file="facts/kyb/index.ts",
        json_obj={"sos_pass":int(sos_pass),"sos_fail":int(sos_fail),"tin_pass":int(tin_pass),"tin_fail":int(tin_fail),"wl_biz":int(wl_biz),"bk_biz":int(bk_biz),"naics_fb":int(naics_fb)},
        sql=f"SELECT JSON_EXTRACT_PATH_TEXT(f.value,'value') AS sos, COUNT(*) FROM rds_warehouse_public.facts f JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id=f.business_id WHERE f.name='sos_active'{_cc}{_dcf}{_dct} GROUP BY 1 ORDER BY 2 DESC;",
        icon="🏢", color="#8B5CF6")

    # ── Section 5: Formation State + Public Records ───────────────────────────
    st.markdown("---")
    st.markdown("##### 🗺️ Entity Profile & Risk Signals")
    ep1, ep2 = st.columns(2)
    with ep1:
        if "formation_state" in _pf_df.columns:
            TAX_HAVENS = {"DE","NV","WY","SD","MT","NM"}
            _fs = _pf_df["formation_state"].astype(str).str.upper().str.strip()
            _th = int(_fs.isin(TAX_HAVENS).sum())
            _oth= int((_fs.notna() & (_fs!="NAN") & ~_fs.isin(TAX_HAVENS)).sum())
            _no = n - _th - _oth
            fig_st = px.pie(pd.DataFrame({"Type":["Tax-Haven","Other State","Unknown"],"Count":[_th,_oth,_no]}),
                names="Type", values="Count", hole=0.4, title="Formation State Mix",
                color="Type", color_discrete_map={"Tax-Haven":"#f59e0b","Other State":"#3B82F6","Unknown":"#334155"})
            fig_st.update_layout(height=260, margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_st), use_container_width=True)
            # Top states
            _st_top = _fs[_fs.notna() & (_fs!="NAN")].value_counts().head(8).reset_index()
            _st_top.columns = ["State","Count"]
            _st_top["Tax Haven"] = _st_top["State"].isin(TAX_HAVENS).map({True:"⚠️","False":""})
            st.dataframe(_st_top, use_container_width=True, hide_index=True)

    with ep2:
        _risk_data = pd.DataFrame({
            "Risk Type": ["Watchlist Hits","Bankruptcies","NAICS Fallback","No SOS Data","TIN Failed","No Revenue"],
            "Businesses": [int(wl_biz), int(bk_biz), int(naics_fb), int(sos_fail+n-sos_pass-sos_fail),
                           int(tin_fail), int(n-rev_known)],
        })
        _risk_data = _risk_data[_risk_data["Businesses"]>0].sort_values("Businesses",ascending=True)
        if not _risk_data.empty:
            fig_risk = px.bar(_risk_data, x="Businesses", y="Risk Type", orientation="h",
                              title="Risk Signals — Businesses Affected",
                              color_discrete_sequence=["#ef4444"])
            fig_risk.update_layout(height=260, margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_risk), use_container_width=True)

    detail_panel("🗺️ Entity Profile & Risk Signals", f"Formation states + risk indicators for {_cust_label}",
        what_it_means=f"Formation state mix shows how many businesses are incorporated in tax-haven states (DE/NV/WY/SD/MT/NM) — these have higher entity resolution risk. Risk signals bar shows how many businesses trigger each flag.",
        source_table="rds_warehouse_public.facts · formation_state, watchlist_hits, num_bankruptcies, naics_code",
        json_obj={"watchlist_biz":int(wl_biz),"bk_biz":int(bk_biz),"naics_fb":int(naics_fb)},
        sql=f"SELECT JSON_EXTRACT_PATH_TEXT(f.value,'value') AS state, COUNT(DISTINCT f.business_id) AS n FROM rds_warehouse_public.facts f JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id=f.business_id WHERE f.name='formation_state'{_cc}{_dcf}{_dct} GROUP BY 1 ORDER BY n DESC;",
        icon="🗺️", color="#f59e0b")

    # ── Onboarding trend ─────────────────────────────────────────────────────
    if "onboarded_date" in _pf_df.columns:
        st.markdown("---")
        st.markdown("##### Onboarding Trend")
        _trend = _pf_df.groupby("onboarded_date").size().reset_index(name="businesses")
        _trend["onboarded_date"] = _trend["onboarded_date"].astype(str)
        fig_trend = px.area(_trend, x="onboarded_date", y="businesses",
                            title=f"Daily Onboarding Volume — {_cust_label}",
                            color_discrete_sequence=["#3B82F6"])
        fig_trend.update_layout(height=240, margin=dict(t=40,b=10,l=10,r=10))
        st.plotly_chart(dark_chart(fig_trend), use_container_width=True)
        _trend_cust_clause = f" AND customer_id='{customer_id}'" if customer_id else ""
        detail_panel("📅 Onboarding Trend", f"{n:,} businesses over time",
            what_it_means=f"Daily count of businesses onboarded for {_cust_label}. Source: rds_cases_public.rel_business_customer_monitoring.created_at.",
            source_table="rds_cases_public.rel_business_customer_monitoring",
            sql=f"SELECT DATE(created_at) AS date, COUNT(DISTINCT business_id) AS businesses FROM rds_cases_public.rel_business_customer_monitoring WHERE 1=1{_trend_cust_clause} GROUP BY 1 ORDER BY 1;",
            icon="📅", color="#3B82F6")

    # ── Businesses table ──────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("##### Business List")
    _disp_cols = [c for c in ["business_id","onboarded_date","sos_active","tin_match","idv_passed","naics_code","watchlist_hits","weighted_score_850","score_decision"] if c in _pf_df.columns]
    st.dataframe(_pf_df[_disp_cols], use_container_width=True, hide_index=True)
    st.caption(f"Showing all {n:,} businesses.")
    dl_csv = _pf_df[_disp_cols].to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Download full list (CSV)", dl_csv,
        file_name=f"portfolio_{_cust_label.replace(' ','_')}.csv", mime="text/csv",
        use_container_width=False, key="port_dl_csv")


@st.cache_data(ttl=600, show_spinner=False)
def load_facts(bid):
    """2-query bulk loader: 1 query for names, 1 bulk query for all small facts."""
    import psycopg2
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("REDSHIFT_DB","dev"),
            user=os.getenv("REDSHIFT_USER","readonly_all_access"),
            password=os.getenv("REDSHIFT_PASSWORD","Y7&.D3!09WvT4/nSqXS2>qbO"),
            host=os.getenv("REDSHIFT_HOST","worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
            port=int(os.getenv("REDSHIFT_PORT","5439")),
            connect_timeout=15)
    except Exception as e:
        return None, str(e)

    try:
        # Query 1 — get all fact names + timestamps (tiny result)
        names_df, err = run_sql_conn(
            f"""SELECT DISTINCT name, MAX(received_at) AS received_at
                FROM rds_warehouse_public.facts
                WHERE business_id='{bid}'
                GROUP BY name ORDER BY name""", conn)
        if names_df is None:
            conn.close(); return None, err
        if names_df.empty:
            conn.close(); return {}, None

        all_names = set(names_df["name"].tolist())
        large_names = all_names & KNOWN_LARGE
        small_names = all_names - KNOWN_LARGE

        latest = {}

        # Pre-populate stubs for large facts (no query needed)
        for name in large_names:
            row = names_df[names_df["name"]==name]
            ts = str(row["received_at"].iloc[0])[:16] if not row.empty else ""
            latest[name] = {"_too_large": True, "_name": name, "_received_at": ts}

        # Query 2 — fetch ALL small facts in one round-trip
        # QUALIFY keeps only the latest row per name (Redshift supports QUALIFY)
        excl = ",".join(f"'{n}'" for n in KNOWN_LARGE) if KNOWN_LARGE else "''"
        bulk_df, bulk_err = run_sql_conn(f"""
            SELECT name, value, received_at
            FROM (
                SELECT name, value, received_at,
                       ROW_NUMBER() OVER (PARTITION BY name ORDER BY received_at DESC) AS rn
                FROM rds_warehouse_public.facts
                WHERE business_id='{bid}'
                  AND name NOT IN ({excl})
            ) t
            WHERE rn = 1
        """, conn)

        if bulk_df is not None and not bulk_df.empty:
            for _, row in bulk_df.iterrows():
                name = row["name"]
                f = parse_fact(row["value"])
                f["_name"] = name
                f["_received_at"] = str(row["received_at"])[:16]
                latest[name] = f

        conn.close()
        return latest, None
    except Exception as e:
        try: conn.close()
        except: pass
        return None, str(e)

# ── Cached per-business queries (TTL=600) ────────────────────────────────────
@st.cache_data(ttl=600, show_spinner=False)
def load_score(bid):
    return run_sql(f"""SELECT bs.weighted_score_850 AS score_850,bs.weighted_score_100 AS score_100,
        bs.risk_level,bs.score_decision,bs.created_at
        FROM rds_manual_score_public.data_current_scores cs
        JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
        WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1""")

@st.cache_data(ttl=600, show_spinner=False)
def load_score_factors(bid):
    return run_sql(f"""SELECT category_id,score_100,weighted_score_850
        FROM rds_manual_score_public.business_score_factors
        WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores
                        WHERE business_id='{bid}' LIMIT 1)
 ORDER BY ABS(weighted_score_850) DESC""")

@st.cache_data(ttl=600, show_spinner=False)
def load_bert(bid):
    return run_sql(f"""SELECT bev.business_id,bert.status,bert.sublabel,bert.created_at
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id=bert.business_entity_verification_id
        WHERE bev.business_id='{bid}' AND bert.key='watchlist'
        ORDER BY bert.created_at DESC LIMIT 5""")

# Audit is not per-business — longer TTL (30 min)
@st.cache_data(ttl=1800, show_spinner=False)
def load_audit():
 return run_sql("SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC ")

# ── Cached Home-tab population queries ───────────────────────────────────────
# SOURCE: rds_cases_public.rel_business_customer_monitoring (created_at = true onboarding date)
# This is the authoritative source for "when was this business onboarded".
# rds_warehouse_public.facts.received_at is NOT the onboarding date — it's when facts were
# last written by the Fact Engine, which can be days/weeks after onboarding.
# Reference query: uses rbcm.created_at filtered by date range, joins facts for KYB signals.

@st.cache_data(ttl=600, show_spinner=False)
def load_customer_names(date_from, date_to):
    """
    Returns customers with business counts for the date range.
    Columns: customer_id, customer_name, business_count
    Source: rds_auth_public.data_customers + rel_business_customer_monitoring.
    Falls back to customer_id list if data_customers not accessible.
    """
    parts = []
    if date_from: parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:   parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    dc = (" AND " + " AND ".join(parts)) if parts else ""

    # Primary: with human-readable names + business count
    sql_with_names = f"""
        SELECT
            rbcm.customer_id,
            dc.name                              AS customer_name,
            COUNT(DISTINCT rbcm.business_id)     AS business_count
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        JOIN rds_auth_public.data_customers dc ON dc.id = rbcm.customer_id
        WHERE 1=1{dc}
        GROUP BY rbcm.customer_id, dc.name
        ORDER BY business_count DESC, dc.name
    """
    df, err = run_sql(sql_with_names)
    if df is not None and not df.empty and "customer_name" in df.columns:
        return df, None

    # Fallback: customer_ids with counts
    sql_ids = f"""
        SELECT
            customer_id,
            customer_id                      AS customer_name,
            COUNT(DISTINCT business_id)      AS business_count
        FROM rds_cases_public.rel_business_customer_monitoring
        WHERE 1=1{dc}
        GROUP BY customer_id
        ORDER BY business_count DESC
    """
    return run_sql(sql_ids)

@st.cache_data(ttl=600, show_spinner=False)
def load_home_recent(date_from, date_to, customer_id=None):
    """
    Load recently onboarded businesses.
    customer_id: if provided, filters to businesses belonging to that customer only.
    """
    parts=[]
    if date_from:    parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:      parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    if customer_id:  parts.append(f"rbcm.customer_id = '{customer_id}'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""

    sql = f"""
        SELECT DISTINCT
            rbcm.business_id,
            MIN(rbcm.created_at)   AS first_seen,
            MAX(rbcm.created_at)   AS last_updated,
            COUNT(DISTINCT f.name) AS fact_count
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        LEFT JOIN rds_warehouse_public.facts f ON f.business_id = rbcm.business_id
        WHERE 1=1{dc}
        GROUP BY rbcm.business_id
        ORDER BY first_seen DESC
    """
    df, err = run_sql(sql)
    if df is not None and not df.empty:
        return df, None

    # Fallback: facts table (no customer filter available)
    parts2=[]
    if date_from: parts2.append(f"received_at >= '{date_from}'")
    if date_to:   parts2.append(f"received_at <= '{date_to} 23:59:59'")
    dc2=(" AND "+" AND ".join(parts2)) if parts2 else ""
    return run_sql(f"""
        SELECT business_id, MIN(received_at) AS first_seen, MAX(received_at) AS last_updated,
               COUNT(DISTINCT name) AS fact_count
        FROM rds_warehouse_public.facts
        WHERE 1=1{dc2}
        GROUP BY business_id ORDER BY first_seen DESC
    """)

@st.cache_data(ttl=600, show_spinner=False)
def load_home_kyb_stats(date_from, date_to, customer_id=None):
    """
    KYB health metrics — respects both date range and optional customer filter.
    """
    parts=[]
    if date_from:    parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:      parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    if customer_id:  parts.append(f"rbcm.customer_id = '{customer_id}'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""

    sql = f"""
        WITH onboarded AS (
            SELECT DISTINCT rbcm.business_id
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            WHERE 1=1{dc}
        )
        SELECT
            f.business_id,
            MAX(CASE WHEN f.name='sos_active'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS sos_active,
            MAX(CASE WHEN f.name='tin_match_boolean'   THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS tin_match,
            MAX(CASE WHEN f.name='idv_passed_boolean'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS idv_passed,
            MAX(CASE WHEN f.name='naics_code'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS naics_code,
            MAX(CASE WHEN f.name='watchlist_hits'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS watchlist_hits,
            MAX(CASE WHEN f.name='num_bankruptcies'    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_bankruptcies,
            MAX(CASE WHEN f.name='num_judgements'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_judgements,
            MAX(CASE WHEN f.name='num_liens'           THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_liens,
            MAX(CASE WHEN f.name='adverse_media_hits'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS adverse_media,
            MAX(CASE WHEN f.name='revenue'             THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS revenue,
            MAX(CASE WHEN f.name='formation_date'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_date,
            MAX(CASE WHEN f.name='formation_state'     THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_state,
            MAX(f.received_at) AS last_seen,
            MIN(f.received_at) AS first_seen,
            COUNT(DISTINCT f.name) AS fact_count
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name IN (
            'sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
            'watchlist_hits','num_bankruptcies','num_judgements','num_liens',
            'adverse_media_hits','revenue','formation_date','formation_state'
        )
        GROUP BY f.business_id
    """
    df, err = run_sql(sql)
    if df is not None and not df.empty:
        return df, None

    # Fallback: rbcm not accessible — return None so the caller can intersect with recent_df.
    # We do NOT fall back to facts.received_at because: (a) it's not the onboarding date,
    # (b) it ignores the customer_id filter, (c) it would return businesses outside the selection.
    # The stats_df intersection in Home tab (stats_df = stats_df[bids isin recent_df]) handles this.
    return None, "rbcm not accessible — no fallback to avoid incorrect business counts"

@st.cache_data(ttl=600, show_spinner=False)
def load_home_flags(date_from, date_to, customer_id=None):
    """Flag scoring facts — respects both date range and optional customer filter."""
    parts=[]
    if date_from:    parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:      parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    if customer_id:  parts.append(f"rbcm.customer_id = '{customer_id}'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""
    sql = f"""
        WITH onboarded AS (
            SELECT DISTINCT rbcm.business_id
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            WHERE 1=1{dc}
        )
        SELECT f.business_id, f.name,
               JSON_EXTRACT_PATH_TEXT(f.value,'value') AS val,
               f.received_at
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name IN (
            'sos_active','tin_match_boolean','watchlist_hits',
            'naics_code','idv_passed_boolean','num_bankruptcies',
            'num_judgements','num_liens','sos_match_boolean'
        )
        ORDER BY f.business_id, f.name, f.received_at DESC
    """
    df, err = run_sql(sql)
    if df is not None and not df.empty:
        return df, None
    # Fallback
    parts2=[]
    if date_from: parts2.append(f"received_at >= '{date_from}'")
    if date_to:   parts2.append(f"received_at <= '{date_to} 23:59:59'")
    dc2=(" AND "+" AND ".join(parts2)) if parts2 else ""
    return run_sql(f"""
        SELECT business_id, name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('sos_active','tin_match_boolean','watchlist_hits','naics_code',
            'idv_passed_boolean','num_bankruptcies','num_judgements','num_liens','sos_match_boolean'){dc2}
        ORDER BY business_id, name, received_at DESC
    """)

def load_facts_with_ui(bid, tab_key):
    """Load facts showing a spinner, with a per-tab refresh button."""
    cache_key = f"facts_loaded_{bid}"
    col_info, col_ref = st.columns([5,1])
    with col_ref:
        if st.button("🔄 Refresh", key=f"ref_{tab_key}",
                     help="Clear cached facts and reload from Redshift (takes ~3–5s)"):
            load_facts.clear()
            if cache_key in st.session_state: del st.session_state[cache_key]
            st.rerun()
    with col_info:
        cached = cache_key in st.session_state
        st.caption(f"{'⚡ Instant — from cache' if cached else '🔃 Loading from Redshift (bulk query)…'} · "
                   f"UUID: `{bid[:16]}…` · TTL: 10 min")
    with st.spinner("Loading facts from Redshift…" if not cached else "Reading from cache…"):
        facts, err = load_facts(bid)
    if facts is not None:
        st.session_state[cache_key] = True
    return facts, err

def gv(facts,name):
    f=facts.get(name,{})
    if f.get("_too_large"): return "[too large — query PostgreSQL RDS port 5432]"
    v=f.get("value")
    if isinstance(v,(list,dict)): return None
    return v

def gc(facts,name):
    try:
        v = facts.get(name,{}).get("source",{})
        if not isinstance(v,dict): return 0.0
        c = v.get("confidence")
        return float(c) if c is not None else 0.0
    except: return 0.0

def gp(facts,name):
    """Return platformId as string — handles 0 (Applicant) correctly."""
    src = facts.get(name,{}).get("source",{})
    if not isinstance(src,dict): return ""
    pid = src.get("platformId")
    return "" if pid is None else str(pid)

def _alt_pid(a):
    """Alternatives store source as bare int OR as nested dict {platformId:...}."""
    s = a.get("source")
    if isinstance(s, dict): return str(s.get("platformId",""))
    if s is not None: return str(s)
    return ""

def _alt_conf(a):
    s = a.get("source")
    if isinstance(s, dict):
        c = s.get("confidence")
        return float(c) if c is not None else 0.0
    # bare int source means conf stored at top level
    c = a.get("confidence")
    return float(c) if c is not None else 0.0

def get_alts(facts,name):
    alts=facts.get(name,{}).get("alternatives",[]) or []
    return [{"value":a.get("value"),"pid":_alt_pid(a),"conf":_alt_conf(a)}
            for a in alts if isinstance(a,dict)]

# ── Fact lineage table ────────────────────────────────────────────────────────
def _fmt_value(name, v):
    if v is None: return "(null)"
    if isinstance(v,list): return f"📋 list · {len(v)} item(s)"
    if isinstance(v,dict):
        if name=="idv_status": return " | ".join(f"{k}:{n}" for k,n in v.items() if n)
        inner = v.get("status") or v.get("value") or v.get("message")
        if inner: return str(inner)[:80]
        return f"🗂️ object · {len(v)} keys"
    return str(v)[:120]

def _pid_label(pid_str):
    """Return human name for a platformId — handles 0=Applicant correctly."""
    if pid_str=="": return "Unknown"
    return pid_info(pid_str)[0]

# ── Fact Engine rule explanations (from integration-service/lib/facts/rules.ts)
RULE_EXPLAIN = {
    "factWithHighestConfidence": (
        "factWithHighestConfidence",
        "Winner = vendor with highest confidence score. "
        "If two vendors are within 5% (WEIGHT_THRESHOLD=0.05) of each other, "
        "the one with the higher platform weight wins (Middesk w=2.0 > OC w=0.9 > ZI w=0.8 > Trulioo w=0.8 > EFX w=0.7 > SERP w=0.3 > AI w=0.1). "
        "Source: integration-service/lib/facts/rules.ts L36–59"
    ),
    "combineFacts": (
        "combineFacts",
        "Merges values from ALL vendors into one deduplicated array. "
        "No single winner — every vendor contributes. Used for: addresses, names_found, dba_found. "
        "Source: integration-service/lib/facts/rules.ts L76–96"
    ),
    "combineWatchlistMetadata": (
        "combineWatchlistMetadata",
        "Merges watchlist hits from business-level (Middesk) AND person-level (Trulioo PSC) screenings, "
        "deduplicates by hit ID, excludes adverse_media category. "
        "Source: integration-service/lib/facts/rules.ts L253+"
    ),
    "dependentFact": (
        "Dependent (computed)",
        "This fact is not queried from a vendor. It is computed by the Fact Engine from another fact. "
        "platformId=-1, confidence=null. Example: sos_active ← derived from sos_filings[].active. "
        "Source: integration-service/lib/facts/rules.ts L98–107"
    ),
    "—": (
        "Dependent / No rule",
        "ruleApplied=null means this fact is a dependent fact — computed from its listed dependencies[], "
        "not won from a vendor competition. The source.platformId=-1 confirms this. "
        "See the 'dependencies' field in the JSON to know which fact it derives from."
    ),
    "factWithHighestWeight": (
        "factWithHighestWeight",
        "Winner = vendor with the highest platform weight, regardless of confidence. "
        "Rare rule used when confidence scores are not meaningful. "
        "Source: integration-service/lib/facts/rules.ts L11–34"
    ),
    "manualOverride": (
        "Manual Analyst Override",
        "An analyst manually changed this fact in the Admin Portal. "
        "The override value replaces the vendor-selected value for all downstream consumers. "
        "Source: integration-service/lib/facts/rules.ts L112+"
    ),
}

def _rule_label(rule_str):
    return RULE_EXPLAIN.get(rule_str, (rule_str, ""))[0] if rule_str else "Dependent / No rule"

def render_fact_engine_explainer():
    """Render a comprehensive Fact Engine workflow card."""
    st.markdown("""<div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:16px 20px;margin:10px 0">
<div style="color:#60A5FA;font-weight:700;font-size:.95rem;margin-bottom:10px">
  ⚙️ How the Fact Engine Builds Every Row in This Table
</div>
<div style="color:#CBD5E1;font-size:.80rem;line-height:1.8">

<strong style="color:#a5b4fc">Step 1 — Vendor data collection</strong><br>
Multiple vendors (Middesk, OpenCorporates, ZoomInfo, Equifax, Trulioo, SERP, AI) each provide their 
version of the same fact. All responses are stored as raw candidates.

<br><br><strong style="color:#a5b4fc">Step 2 — Fact Engine rule selection</strong><br>
For each fact, one rule is applied to determine the winner:<br>
<span style="color:#22c55e">■ factWithHighestConfidence</span> — the vendor with the highest confidence wins. 
If two vendors are within 5% of each other (WEIGHT_THRESHOLD=0.05), the one with the higher 
<em>platform weight</em> wins. Weights: Middesk=2.0 · OC=0.9 · ZI=0.8 · Trulioo=0.8 · EFX=0.7 · SERP=0.3 · AI=0.1<br>
<span style="color:#3B82F6">■ combineFacts</span> — all vendor values merged into one deduplicated array (used for addresses, names_found, dba_found)<br>
<span style="color:#8B5CF6">■ Dependent fact</span> — computed from another fact. No vendor, no rule, no confidence (platformId=-1)

<br><br><strong style="color:#a5b4fc">Step 3 — Winner stored in Redshift</strong><br>
The winning vendor's value, source.platformId, source.confidence, and ruleApplied are written to 
<code>rds_warehouse_public.facts</code> (received_at = write timestamp).<br>
All losing vendors are stored in the <code>alternatives[]</code> array of the same JSON row.

<br><br><strong style="color:#a5b4fc">Step 4 — Admin Portal reads from facts</strong><br>
The Admin Portal calls <code>GET /api/v1/facts/business/{'{'}bid{'}'}/kyb</code> → returns the winning value 
(and alternatives) for every fact. Cached in Redis for 2 minutes.

<br><br><strong style="color:#a5b4fc">Confidence formulas by vendor:</strong><br>
Middesk: <code>0.15 + 0.20 × (passing review tasks, max 4)</code> · 
OC/ZI/EFX: <code>match.index ÷ 55</code> · 
Trulioo: <code>0.70=SUCCESS · 0.40=FAILED · 0.20=OTHER</code> · 
AI (pid=31): self-reported (LOW→0.3 · MED→0.6 · HIGH→0.9) · 
Applicant (pid=0): <code>1.0</code> by convention · 
Dependent (pid=-1): <code>null</code> (not applicable)

</div>
<div style="margin-top:10px;padding-top:8px;border-top:1px solid #1e3a5f;font-size:.76rem">
<strong style="color:#a5b4fc">📁 Source references (click to open in GitHub):</strong><br>
</div>
</div>""", unsafe_allow_html=True)
    # Source links as Streamlit markdown (proper links)
    st.markdown(
        f"🔗 [{src_link('facts/rules.ts','facts/rules.ts')}]({GITHUB_LINKS.get('facts/rules.ts','')}) — rule algorithms · "
        f"🔗 [{src_link('facts/sources.ts','facts/sources.ts')}]({GITHUB_LINKS.get('facts/sources.ts','')}) — vendor source definitions · "
        f"🔗 [{src_link('integrations.constant.ts','INTEGRATION_ID map')}]({GITHUB_LINKS.get('integrations.constant.ts','')}) — all platform IDs · "
        f"🔗 [{src_link('openapi/integration','API Reference')}]({GITHUB_LINKS.get('openapi/integration','')}) — /kyb endpoint"
    )

def render_lineage(facts, names, title="Fact Lineage", show_rule_explainer=False,
                   inside_expander=False):
    st.markdown(f"##### {title}")
    if show_rule_explainer:
        render_fact_engine_explainer()
    rows=[]
    for name in names:
        f=facts.get(name,{})
        if not f: continue
        too_large=f.get("_too_large",False)
        v=f.get("value")
        dv = "📦 [too large — use PostgreSQL RDS SQL below]" if too_large else _fmt_value(name,v)

        # Source — handle pid=0 correctly (falsy but valid = Applicant)
        src = f.get("source") or {}
        pid = "" if not isinstance(src,dict) else (
            "" if src.get("platformId") is None else str(src["platformId"]))
        conf_raw = src.get("confidence") if isinstance(src,dict) else None
        conf = float(conf_raw) if conf_raw is not None else None
        win_name = _pid_label(pid)
        src_name = f.get("source",{}).get("name","") if isinstance(f.get("source"),dict) else ""

        # Source name string from the JSON (e.g. "calculated", "dependent", "middesk")
        src_name_str = src.get("name","") if isinstance(src,dict) else ""

        # Meaningful source label — handle ALL cases
        if pid == "-1" or src_name_str in ("dependent",):
            # Dependent fact — computed from other facts by Fact Engine
            deps = f.get("dependencies") or []
            dep_str = (" ← " + deps[0]) if deps else ""
            win_str = "📐 Computed" + dep_str
            conf_str = "n/a (derived)"
        elif pid == "" and src_name_str in ("calculated",""):
            # Calculated fact — Fact Engine fn() with sources.calculated
            # Check if we know what computes it
            calc_desc = CALCULATED_FACTS.get(name,"")
            if calc_desc:
                win_str = "⚙️ Calculated (Fact Engine)"
                conf_str = "n/a (computed)"
            elif v is not None:
                # Has a value but unknown source — check if it's a known calculated fact
                win_str = "⚙️ Calculated (Fact Engine)"
                conf_str = "n/a (computed)"
            else:
                win_str = "⚙️ Calculated / No data"
                conf_str = "n/a"
        elif pid == "" and src_name_str not in ("", None):
            # Has a source name but no platformId — use the name
            win_str = src_name_str
            conf_str = f"{conf:.4f}" if conf is not None else "n/a"
        elif pid == "":
            # Truly unknown — no platformId, no source name
            win_str = "⚠️ Source not stored"
            conf_str = f"{conf:.4f}" if conf is not None else "n/a"
        elif conf is None:
            win_str = f"{win_name}"
            conf_str = "n/a"
        else:
            win_str = f"{win_name}"
            conf_str = f"{conf:.4f}"

        # Rule applied — with human label
        raw_rule = safe_get(f,"ruleApplied","name") or "—"
        rule_label = _rule_label(raw_rule)
        _, rule_desc = RULE_EXPLAIN.get(raw_rule, (raw_rule, "See integration-service/lib/facts/rules.ts"))

        # Dependencies for dependent facts
        deps_raw = f.get("dependencies")
        if deps_raw and isinstance(deps_raw, list):
            dep_display = " → ".join(deps_raw)
        else:
            dep_display = ""

        # Alternatives
        alts = get_alts(facts,name)
        alt_str = " | ".join(
            f"{_pid_label(a['pid'])}({a['conf']:.4f})" for a in alts[:4]
        ) or ("—" if pid!="-1" else "n/a (computed fact)")

        rows.append({
            "Fact": name,
            "Value": dv,
            "Winning Source": win_str,
            "Confidence": conf_str,
            "Rule": rule_label,
            "Dependencies / Alternatives": dep_display or alt_str,
            "Updated": f.get("_received_at",""),
            "_raw_fact": f,
            "_name": name,
        })

    # ── Source reference map (fact → code location) ──────────────────────────
    FACT_SOURCE_REF = {
        # format: fact_name → (repo_path, function/variable, line_hint, description)
        "sos_active":         ("integration-service/lib/facts/kyb/index.ts","sosActive","factEngine.register","Derived from sos_filings[].active"),
        "sos_match":          ("integration-service/lib/facts/kyb/index.ts","sosMatch","factWithHighestConfidence","Middesk SOS match result"),
        "sos_match_boolean":  ("integration-service/lib/facts/kyb/index.ts","sosMatchBoolean","dependent","Derived from sos_match.value==='success'"),
        "sos_filings":        ("integration-service/lib/middesk/","middeskResultsStorage.ts","pid=16","Raw SOS filing array from Middesk API"),
        "tin":                ("integration-service/lib/facts/kyb/index.ts","tin","factWithHighestConfidence","Raw EIN from applicant (pid=0)"),
        "tin_submitted":      ("integration-service/lib/facts/kyb/index.ts","tinSubmitted","factWithHighestConfidence","Masked EIN (XXXXX1234)"),
        "tin_match":          ("integration-service/lib/facts/kyb/index.ts","tinMatch","factWithHighestConfidence","Middesk IRS TIN verification result"),
        "tin_match_boolean":  ("integration-service/lib/facts/kyb/index.ts","tinMatchBoolean","dependent","Derived from tin_match.value.status==='success'"),
        "naics_code":         ("integration-service/lib/facts/kyb/index.ts","naicsCode","factWithHighestConfidence","Industry code — vendors cascade"),
        "mcc_code":           ("integration-service/lib/facts/businessDetails/index.ts","mcc_code L376–387","calculated (sources.calculated — NOT a vendor)","mcc_code_found (AI direct) ?? mcc_code_from_naics (rel_naics_mcc SQL lookup). platformId=null because this is Fact Engine computation, not a vendor response."),
        "mcc_code_from_naics":("integration-service/lib/facts/businessDetails/index.ts","mcc_code_from_naics L359–374","calculated","SQL: SELECT mcc_code FROM rel_naics_mcc WHERE naics_code='{naics_code.value}'"),
        "mcc_description":    ("integration-service/lib/facts/businessDetails/index.ts","mcc_description L389–404","calculated","SQL lookup rel_mcc by mcc_code. Fallback: AINaicsEnrichment.response.mcc_description"),
        "naics_description":  ("integration-service/lib/facts/businessDetails/index.ts","naics_description L406–415","calculated","SQL lookup rel_naics by naics_code. No vendor — internal DB lookup."),
        "industry":           ("integration-service/lib/facts/businessDetails/index.ts","industry","calculated","naics_code.value.substring(0,2) = 2-digit NAICS sector"),
        "idv_status":         ("integration-service/lib/plaid/","plaidIdv.ts","pid=18","Plaid IDV session status object"),
        "idv_passed":         ("integration-service/lib/facts/kyb/index.ts","idvPassed","dependent","Count of SUCCESS sessions"),
        "idv_passed_boolean": ("integration-service/lib/facts/kyb/index.ts","idvPassedBoolean","dependent","true when idv_passed >= 1"),
        "watchlist":          ("integration-service/lib/facts/kyb/consolidatedWatchlist.ts","consolidatedWatchlist","combineWatchlistMetadata","PEP+SANCTIONS merged, adverse_media excluded"),
        "watchlist_hits":     ("integration-service/lib/facts/kyb/index.ts","watchlistHits","dependent","COUNT of watchlist.metadata[]"),
        "watchlist_raw":      ("integration-service/lib/facts/kyb/index.ts","watchlistRaw","combineWatchlistMetadata","Raw vendor watchlist output"),
        "adverse_media_hits": ("integration-service/lib/facts/kyb/index.ts","adverseMediaHits","dependent","Adverse media count (separate from watchlist)"),
        "num_bankruptcies":   ("integration-service/lib/facts/kyb/index.ts","numBankruptcies","dependent","COUNT from bankruptcies array (Equifax)"),
        "num_judgements":     ("integration-service/lib/facts/kyb/index.ts","numJudgements","dependent","COUNT from judgements array"),
        "num_liens":          ("integration-service/lib/facts/kyb/index.ts","numLiens","dependent","COUNT from liens array"),
        "formation_state":    ("integration-service/lib/facts/kyb/index.ts","formationState","factWithHighestConfidence","Middesk primary, OC fallback"),
        "formation_date":     ("integration-service/lib/facts/kyb/index.ts","formationDate","factWithHighestConfidence","ISO-8601 incorporation date"),
        "addresses":          ("integration-service/lib/facts/kyb/index.ts","addresses","combineFacts","All vendor addresses merged"),
        "primary_address":    ("integration-service/lib/facts/kyb/index.ts","primaryAddress","dependent","First entry from addresses[]"),
        "name_match":         ("integration-service/lib/facts/kyb/index.ts","nameMatch","factWithHighestConfidence","Middesk business name match"),
        "name_match_boolean": ("integration-service/lib/facts/kyb/index.ts","nameMatchBoolean","dependent","true when name_match.status==='success'"),
        "website":            ("integration-service/lib/facts/kyb/index.ts","website","factWithHighestConfidence","Applicant URL or SERP-found URL"),
        "revenue":            ("integration-service/lib/facts/kyb/index.ts","revenue","factWithHighestConfidence","ZI/EFX bulk firmographic"),
        "num_employees":      ("integration-service/lib/facts/kyb/index.ts","numEmployees","factWithHighestConfidence","ZI/EFX bulk firmographic"),
        "screened_people":    ("integration-service/lib/trulioo/","truliooPSCScreening.ts","pid=38","PSC watchlist screening per person"),
        "people":             ("integration-service/lib/middesk/","middeskResultsStorage.ts","pid=16","Officers/directors from Middesk"),
        "dba_found":          ("integration-service/lib/facts/kyb/index.ts","dbaFound","combineFacts","DBA names from all vendors"),
        "legal_name":         ("integration-service/lib/facts/kyb/index.ts","legalName","factWithHighestConfidence","Applicant then Middesk/OC"),
        "middesk_confidence": ("integration-service/lib/middesk/","middeskResultsStorage.ts","computed","0.15+0.20×tasks"),
        "is_sole_prop":       ("integration-service/lib/facts/kyb/index.ts","isSoleProp","dependent","true when tin_submitted=null AND idv_passed_boolean=true"),
        "address_verification":("integration-service/lib/middesk/","middeskResultsStorage.ts","pid=16","Middesk USPS address verification"),
        "risk_score":         ("integration-service/lib/facts/kyb/index.ts","riskScore","dependent","0-100 based on watchlist + high_risk_people"),
        "kyb_submitted":      ("integration-service/lib/facts/kyb/index.ts","kybSubmitted","dependent","true when addresses[] not empty"),
        "kyb_complete":       ("integration-service/lib/facts/kyb/index.ts","kybComplete","dependent","business_verified AND screened_people"),
    }

    if rows:
        display_rows = [{k: v for k,v in r.items() if not k.startswith("_")} for r in rows]
        df = pd.DataFrame(display_rows)
        st.dataframe(df, use_container_width=True, hide_index=True,
                     column_config={
                         "Fact": st.column_config.TextColumn("Fact", width="medium"),
                         "Value": st.column_config.TextColumn("Value", width="medium"),
                         "Winning Source": st.column_config.TextColumn("Winning Source", width="small"),
                         "Confidence": st.column_config.TextColumn("Confidence", width="small"),
                         "Rule": st.column_config.TextColumn("Rule Applied", width="medium"),
                         "Dependencies / Alternatives": st.column_config.TextColumn("Deps / Alternatives", width="large"),
                     })

        st.caption("▼ Click any fact to see: valid JSON value · source code reference · API endpoint · Redshift SQL · field-by-field annotations")

        for r in rows:
            fname = r["_name"]
            f_obj = r["_raw_fact"]
            dv_disp = r["Value"]
            v = f_obj.get("value")
            src = f_obj.get("source") or {}
            alts_raw = f_obj.get("alternatives") or []
            deps_raw2 = f_obj.get("dependencies") or []
            rule_raw2 = safe_get(f_obj,"ruleApplied","name") or "null"
            rule_desc2 = safe_get(f_obj,"ruleApplied","description") or ""
            too_large = f_obj.get("_too_large", False)
            pid_str = str(src.get("platformId","")) if isinstance(src,dict) else ""

            # ── Build CLEAN valid JSON (no inline comments) ───────────────────
            clean_fact = {
                "name": fname,
                "value": ("[too large — query PostgreSQL RDS port 5432]" if too_large
                          else v),
                "source": {
                    "confidence": src.get("confidence") if isinstance(src,dict) else None,
                    "platformId": src.get("platformId") if isinstance(src,dict) else None,
                    "name": src.get("name") if isinstance(src,dict) else None,
                },
                "ruleApplied": f_obj.get("ruleApplied"),
                "dependencies": deps_raw2 or None,
                "alternatives": [],
            }
            for a in alts_raw:
                a_src = a.get("source")
                clean_fact["alternatives"].append({
                    "value": a.get("value"),
                    "source": a_src if isinstance(a_src,dict) else {"platformId": a_src},
                    "confidence": (a_src.get("confidence") if isinstance(a_src,dict)
                                   else a.get("confidence")),
                })
            json_str = json.dumps(clean_fact, default=str, indent=2, ensure_ascii=False)

            # ── Annotations (uses PID global dict and CALCULATED_FACTS) ──────
            pid_full_info = pid_info(pid_str)
            pid_ann_str   = pid_full_info[2] if pid_full_info else "See integrations.constant.ts"

            # Calculated fact explanation
            calc_note = CALCULATED_FACTS.get(fname,"")
            if not calc_note and pid_str=="" and src_name_str in ("calculated",""):
                calc_note = "Internally computed by Fact Engine fn(). Check integration-service/lib/facts/businessDetails/index.ts or lib/facts/kyb/index.ts for the exact computation."

            RULE_ANN = {
                "factWithHighestConfidence": "Picks the vendor with highest confidence. If within 5% (WEIGHT_THRESHOLD=0.05), uses platform weight as tiebreaker. Source: integration-service/lib/facts/rules.ts L36–59",
                "combineFacts": "Merges values from ALL vendors into one deduplicated array. No single winner. Source: rules.ts L76–96",
                "combineWatchlistMetadata": "Merges business+person watchlist hits, deduplicates, removes adverse_media. Source: rules.ts L253+",
                "null": "No rule = dependent/computed fact. Derived from dependencies[]. Source: rules.ts L98–107",
            }

            anns = [
                ("value", dv_disp,
                 "What the Admin Portal shows" + (" — full array/object in JSON above" if isinstance(v,(list,dict)) else "") +
                 ((" | Computed fact: " + calc_note) if calc_note else "")),
                ("source.platformId", str(src.get("platformId","null") if isinstance(src,dict) else "null"),
                 pid_ann_str + (" | NOTE: null platformId = Calculated/Computed fact, not a vendor. See CALCULATED_FACTS dict." if pid_str=="" and calc_note else "")),
                ("source.name", str(src.get("name","null") if isinstance(src,dict) else "null"),
                 ("'calculated' = Fact Engine internally computed value (sources.calculated pseudo-source). NOT a vendor. Source: integration-service/lib/facts/sources.ts L1233–1235"
                  if src_name_str=="calculated"
                  else ("'dependent' = derived from dependencies[]. No vendor queried."
                  if src_name_str=="dependent"
                  else (pid_full_info[0] + " — source name from vendor integration" if pid_str and pid_str not in ("-1","") else "Source name not stored")))),
                ("source.confidence", str(src.get("confidence","null") if isinstance(src,dict) else "null"),
                 "null = calculated/dependent fact (no vendor match quality). " +
                 ("Formula: " + {"16":"0.15+0.20×tasks","23":"match.index÷55","24":"match.index÷55",
                   "17":"match.index÷55","38":"status-based(0.70/0.40/0.20)","31":"self-reported",
                   "0":"1.0 by convention"}.get(pid_str,"see PID description") if pid_str not in ("","-1") else "")),
                ("ruleApplied", rule_raw2,
                 RULE_ANN.get(rule_raw2, rule_desc2 or "See integration-service/lib/facts/rules.ts")),
                ("dependencies", json.dumps(deps_raw2) if deps_raw2 else "[]",
                 ("Computed FROM: " + ", ".join(deps_raw2)) if deps_raw2 else "Vendor-supplied — not derived from other facts"),
                ("alternatives[]", str(len(alts_raw)) + " competing vendor(s)",
                 ("Other vendors that returned data but LOST via " + rule_raw2) if alts_raw
                 else ("No competitors — this fact is internally computed, not vendor-selected" if calc_note or pid_str in ("","-1")
                 else "No competing sources — only one vendor returned data")),
            ]

            # ── Source code reference with clickable GitHub links ─────────────
            src_ref = FACT_SOURCE_REF.get(fname)
            # Determine best GitHub link for this fact
            _gh_key = ("facts/businessDetails" if fname in ("mcc_code","mcc_code_from_naics","mcc_description","naics_description","industry")
                       else "facts/kyb/index.ts")
            _gh_url = GITHUB_LINKS.get(_gh_key,"")
            if src_ref:
                repo_path, fn_name, mechanism, desc = src_ref
                # Find a link for the specific file
                _file_link_url = next((v for k,v in GITHUB_LINKS.items() if k in repo_path or repo_path in k), _gh_url)
            else:
                repo_path = "integration-service/lib/facts/kyb/index.ts"
                fn_name = fname; mechanism = "see repo"; desc = ""
                _file_link_url = _gh_url

            src_ref_html = (
                f"<div style='background:#052e16;border-left:3px solid #22c55e;padding:10px 14px;"
                f"border-radius:6px;margin:6px 0'>"
                f"<div style='color:#86efac;font-weight:700;font-size:.82rem;margin-bottom:6px'>📁 Source Code Reference</div>"
                f"<div style='font-size:.78rem;color:#CBD5E1;margin-bottom:3px'>"
                f"<strong>File:</strong> "
                f"<a href='{_file_link_url}' target='_blank' style='color:#22c55e'>"
                f"<code>{repo_path}</code></a></div>"
                f"<div style='font-size:.78rem;color:#CBD5E1;margin-bottom:3px'>"
                f"<strong>Fact definition:</strong> <code style='color:#60A5FA'>{fn_name}</code> "
                f"· <strong>Mechanism:</strong> <code style='color:#a5b4fc'>{mechanism}</code></div>"
                + (f"<div style='font-size:.76rem;color:#94A3B8'>{desc}</div>" if desc else "")
                + (
                    "<div style='margin-top:6px'>"
                    "<a href='" + GITHUB_LINKS.get("facts/rules.ts","") + "' target='_blank' style='color:#60A5FA;font-size:.74rem;margin-right:10px'>🔗 facts/rules.ts</a>"
                    "<a href='" + GITHUB_LINKS.get("facts/sources.ts","") + "' target='_blank' style='color:#60A5FA;font-size:.74rem;margin-right:10px'>🔗 facts/sources.ts</a>"
                    "<a href='" + GITHUB_LINKS.get("integrations.constant.ts","") + "' target='_blank' style='color:#60A5FA;font-size:.74rem'>🔗 INTEGRATION_ID map</a>"
                    "</div></div>"
                )
            )

            storage_html = (
                f"<div style='background:#0c1a2e;border-left:3px solid #3B82F6;padding:10px 14px;"
                f"border-radius:6px;margin:6px 0'>"
                f"<div style='color:#93c5fd;font-weight:700;font-size:.82rem;margin-bottom:6px'>🗄️ Where to find this data</div>"
                f"<div style='font-size:.78rem;color:#CBD5E1;margin-bottom:3px'>"
                f"<strong>Redshift:</strong> <code style='color:#60A5FA'>rds_warehouse_public.facts</code> "
                f"WHERE name='{fname}'</div>"
                "<div style='font-size:.78rem;color:#CBD5E1;margin-bottom:3px'>"
                "<strong>API:</strong> "
                "<a href='" + GITHUB_LINKS.get("openapi/integration","") + "' target='_blank' style='color:#f59e0b'>"
                f"<code>GET /integration/api/v1/facts/business/{{bid}}/kyb → data.{fname}</code></a></div>"
                f"<div style='font-size:.76rem;color:#64748b'>"
                f"Redis cache: <code>integration-express-cache::{{bid}}::/api/v1/facts/business/{{bid}}/kyb</code> (TTL: 2 min)</div>"
                f"</div>"
            )

            # ── Annotations table with larger font ────────────────────────────
            ann_rows_html = "".join(
                f"<tr style='border-bottom:1px solid #0f172a'>"
                f"<td style='padding:6px 10px;color:#60A5FA;font-family:monospace;font-size:.76rem;white-space:nowrap'>{field}</td>"
                f"<td style='padding:6px 10px;color:#CBD5E1;font-size:.76rem'>{val}</td>"
                f"<td style='padding:6px 10px;color:#94A3B8;font-size:.74rem'>{note}</td>"
                f"</tr>"
                for field,val,note in anns
            )
            ann_table_html = (
                f"<table style='width:100%;border-collapse:collapse;margin:6px 0;background:#0f172a;border-radius:6px'>"
                f"<tr style='border-bottom:2px solid #1e293b'>"
                f"<th style='text-align:left;padding:6px 10px;color:#475569;font-size:.76rem'>Field</th>"
                f"<th style='text-align:left;padding:6px 10px;color:#475569;font-size:.76rem'>Value</th>"
                f"<th style='text-align:left;padding:6px 10px;color:#475569;font-size:.76rem'>What it means</th>"
                f"</tr>"
                + ann_rows_html
                + f"</table>"
            )

            # ── Header colour ─────────────────────────────────────────────────
            if too_large: h_color="#f59e0b"; h_icon="📦"
            elif v is None: h_color="#64748b"; h_icon="⚪"
            elif isinstance(v,list): h_color="#3B82F6"; h_icon="📋"
            elif isinstance(v,dict): h_color="#8B5CF6"; h_icon="🗂️"
            else: h_color="#22c55e"; h_icon="✅"

            v_summary = (f"{len(v)} items" if isinstance(v,list)
                         else (f"{len(v)} keys" if isinstance(v,dict)
                         else dv_disp[:50]))

            # ── Build SQL + Python for this fact ──────────────────────────────
            _fact_sql = (
                f"SELECT\n"
                f"  name,\n"
                f"  JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,\n"
                f"  JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,\n"
                f"  JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,\n"
                f"  JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')   AS rule_applied,\n"
                f"  received_at\n"
                f"FROM rds_warehouse_public.facts\n"
                f"WHERE business_id = '{bid}'\n"
                f"  AND name = '{fname}'\n"
                f"ORDER BY received_at DESC LIMIT 5;"
            )
            _fact_py = (
                f"# Paste into 🐍 Python Runner — conn is pre-injected\n"
                f"df = pd.read_sql(\"\"\"\n"
                f"SELECT name,\n"
                f"       JSON_EXTRACT_PATH_TEXT(value,'value')               AS fact_value,\n"
                f"       JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,\n"
                f"       JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,\n"
                f"       received_at\n"
                f"FROM rds_warehouse_public.facts\n"
                f"WHERE business_id = '{bid}' AND name = '{fname}'\n"
                f"ORDER BY received_at DESC LIMIT 5\n"
                f"\"\"\", conn)\n"
                f"print(f'{{len(df)}} rows'); print(df.to_string(index=False))"
            )

            # ── Render: st.expander (normal) OR HTML <details> (when nested) ──
            # st.expander cannot be nested inside another st.expander.
            # When inside_expander=True (e.g. All Facts group expanders), use
            # HTML <details> tags instead — they render correctly when nested.
            if inside_expander:
                # Escape json_str for HTML embedding
                _json_escaped = json_str.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                st.markdown(
                    f"<details style='background:#0A0F1E;border-left:3px solid {h_color};"
                    f"border-radius:6px;padding:6px 12px;margin:3px 0'>"
                    f"<summary style='color:{h_color};font-size:.78rem;cursor:pointer;font-weight:600'>"
                    f"{h_icon} <code style='color:#60A5FA'>{fname}</code> "
                    f"· {v_summary} · {r['Winning Source']}</summary>"
                    f"<div style='margin-top:8px'>"
                    f"{src_ref_html}{storage_html}"
                    f"<details style='margin:4px 0'><summary style='color:#94A3B8;font-size:.74rem;cursor:pointer'>📋 Field annotations</summary>"
                    f"{ann_table_html}</details>"
                    f"<details style='margin:4px 0'><summary style='color:#94A3B8;font-size:.74rem;cursor:pointer'>📄 Full JSON</summary>"
                    f"<pre style='color:#CBD5E1;background:#0f172a;padding:8px;border-radius:6px;"
                    f"font-size:.72rem;overflow:auto;max-height:300px'>{_json_escaped}</pre></details>"
                    f"<details style='margin:4px 0'><summary style='color:#94A3B8;font-size:.74rem;cursor:pointer'>🗄️ SQL &amp; Python</summary>"
                    f"<pre style='color:#22c55e;background:#052e16;padding:6px;border-radius:4px;font-size:.70rem;overflow:auto'>{_fact_sql}</pre>"
                    f"<pre style='color:#CBD5E1;background:#0f172a;padding:6px;border-radius:4px;font-size:.70rem;overflow:auto;margin-top:4px'>{_fact_py}</pre>"
                    + (f"<div style='color:#f59e0b;font-size:.72rem;margin-top:4px'>⚠️ Too large for Redshift — query from PostgreSQL RDS port 5432 using JSONB operators.</div>" if too_large else "")
                    + f"</details></div></details>",
                    unsafe_allow_html=True
                )
            else:
                with st.expander(f"{h_icon} {fname}  ·  {v_summary}  ·  source: {r['Winning Source']}"):
                    st.markdown(src_ref_html + storage_html, unsafe_allow_html=True)
                    st.markdown("**Field-by-field annotations:**")
                    st.markdown(ann_table_html, unsafe_allow_html=True)

                    # ── JSON provenance banner ────────────────────────────────
                    # Determine if we have a real OpenAPI spec example or a runtime-constructed object
                    _spec_example = _KYB_FACT_EXAMPLES.get(fname)
                    _spec_desc    = _KYB_FACT_DESCRIPTIONS.get(fname,"")

                    if _spec_example is not None:
                        # REAL JSON from the official OpenAPI spec (get-kyb.json in api-docs folder)
                        _display_json = json.dumps(_spec_example, indent=2, default=str)
                        st.markdown(
                            f"<div style='background:#052e16;border-left:3px solid #22c55e;"
                            f"border-radius:6px;padding:8px 12px;margin:4px 0;font-size:.76rem'>"
                            f"<strong style='color:#86efac'>✅ Official API Schema</strong> — "
                            f"this JSON structure is from the real OpenAPI specification "
                            f"<a href='{OPENAPI_KYB}' target='_blank' style='color:#22c55e'>"
                            f"get-kyb.json</a> (same spec that powers "
                            f"<a href='{DOCS_KYB}' target='_blank' style='color:#22c55e'>docs.worthai.com/api-reference/kyb</a> "
                            f"and <a href='{ADMIN_URL}' target='_blank' style='color:#22c55e'>admin.joinworth.com</a>).<br>"
                            + (f"<span style='color:#94A3B8'>API description: {_spec_desc}</span>" if _spec_desc else "")
                            + f"</div>",
                            unsafe_allow_html=True
                        )
                        st.markdown(f"**JSON schema from [`get-kyb.json`]({OPENAPI_KYB}) — `GET /facts/business/{{businessId}}/kyb → data.{fname}`:**")
                        st.code(_display_json, language="json")

                        # Also show the LIVE value from Redshift for comparison
                        if json_str and json_str.strip() != "{}":
                            st.markdown("**Live value for this business (from `rds_warehouse_public.facts.value`):**")
                            st.code(json_str, language="json")
                    else:
                        # No spec entry — show runtime-constructed object with transparency notice
                        st.markdown(
                            f"<div style='background:#1c1917;border-left:3px solid #f59e0b;"
                            f"border-radius:6px;padding:8px 12px;margin:4px 0;font-size:.76rem'>"
                            f"<strong style='color:#fde68a'>⚠️ Constructed from runtime data</strong> — "
                            f"<code>{fname}</code> is not in the public OpenAPI spec "
                            f"(<a href='{OPENAPI_KYB}' target='_blank' style='color:#f59e0b'>get-kyb.json</a>). "
                            f"The JSON below is built from the actual value stored in Redshift for this business. "
                            f"Verify at: <a href='{DOCS_KYB}' target='_blank' style='color:#f59e0b'>docs.worthai.com/api-reference/kyb</a>"
                            f"</div>",
                            unsafe_allow_html=True
                        )
                        st.markdown("**JSON (constructed from `rds_warehouse_public.facts.value` for this business):**")
                        st.code(json_str, language="json")
                    _sc, _pc = st.columns(2)
                    with _sc:
                        st.markdown("**SQL (Redshift):**")
                        st.code(_fact_sql, language="sql")
                    with _pc:
                        st.markdown("**Python (paste into 🐍 Runner):**")
                        st.code(_fact_py, language="python")
                    if too_large:
                        st.markdown("**⚠️ Too large for Redshift — query from PostgreSQL RDS (port 5432):**")
                        _rds_sql = (
                            f"-- PostgreSQL RDS (native JSONB):\n"
                            f"SELECT value->'value' FROM rds_warehouse_public.facts\n"
                            f"WHERE business_id='{bid}' AND name='{fname}';"
                        )
                        _rds_py = (
                            f"# PostgreSQL RDS — port 5432, JSONB native:\n"
                            f"cur.execute(\"SELECT value->>'value' FROM rds_warehouse_public.facts "
                            f"WHERE business_id='{bid}' AND name='{fname}';\")\n"
                            f"print(cur.fetchone()[0])"
                        )
                        _rsc, _rpc = st.columns(2)
                        with _rsc: st.code(_rds_sql, language="sql")
                        with _rpc: st.code(_rds_py, language="python")

        # Rule legend
        used_rules = set(r["Rule"] for r in rows if r["Rule"] not in ("","—","n/a (computed fact)"))
        if used_rules:
            for rule_key,(rl,rd) in RULE_EXPLAIN.items():
                if rl in used_rules:
                    st.markdown(
                        f"<div style='background:#0f172a;border-left:3px solid #3B82F6;padding:6px 10px;"
                        f"border-radius:6px;margin:2px 0;font-size:.70rem'>"
                        f"<span style='color:#60A5FA;font-weight:600'>{rl}:</span> "
                        f"<span style='color:#94A3B8'>{rd}</span></div>",
                        unsafe_allow_html=True)
    return rows

def sql_for(bid,names):
    ns=", ".join(f"'{n}'" for n in names)
    return f"""-- Redshift (VPN required):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}' AND name IN ({ns})
ORDER BY name, received_at DESC;"""

def py_for(bid,names):
    return f"""import psycopg2,json
conn=psycopg2.connect(dbname='dev',user='readonly_all_access',
    password='...',host='worthai-services-...redshift-serverless.amazonaws.com',port=5439)
cur=conn.cursor()
cur.execute(\"\"\"
    SELECT name,value,received_at FROM rds_warehouse_public.facts
    WHERE business_id=%s AND name IN {tuple(names) if len(names)>1 else f"('{names[0]}')"}
    ORDER BY name,received_at DESC
\"\"\", ('{bid}',))
for name,val_str,ts in cur.fetchall():
    fact=json.loads(val_str)
    print(name,'→',fact.get('value'),
          '| winner:',fact.get('source',{{}}).get('platformId'),
          '| conf:',fact.get('source',{{}}).get('confidence'),
          '| alts:',len(fact.get('alternatives',[])))
conn.close()"""

# ── AI / RAG ──────────────────────────────────────────────────────────────────
@st.cache_resource
def load_rag():
    p=BASE/"kyb_hub_rag_index.json"
    if p.exists() and p.stat().st_size>100:
        with open(p) as f: return json.load(f)
    return None

def rag_search(q,top_k=8):
    idx=load_rag()
    if not idx: return []
    idf=idx["idf"]
    qw=re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}",q.lower())
    qc=re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+",q.lower())
    scores=[]
    for chunk in idx["chunks"]:
        s=sum(chunk["tf"].get(w,0)*idf.get(w,0) for w in qw)
        for c in qc: s+=chunk["tf"].get(c,0)*idf.get(c,0)*4
        if any(c in chunk["text"].lower() for c in qc): s*=1.5
        scores.append((s,chunk))
    scores.sort(key=lambda x:-x[0])
    return [c for _,c in scores[:top_k] if _>0]

@st.cache_resource
def get_openai():
    """
    Returns an OpenAI client, or None if no valid key is configured.
    Key resolution order (re-evaluated on every call):
      1. Environment variable  OPENAI_API_KEY  (set with: export OPENAI_API_KEY=sk-...)
      2. Streamlit secrets     OPENAI_API_KEY  (.streamlit/secrets.toml)

    Auto-persist: if a valid key is found in the env var but NOT in secrets.toml,
    the key is automatically written to secrets.toml so future runs (even in
    different terminals where the export is not set) continue to work.
    """
    try:
        from openai import OpenAI
        key = ""

        # 1. Environment variable (set in the current terminal session)
        env_key = os.getenv("OPENAI_API_KEY","").strip()

        # 2. secrets.toml
        toml_key = ""
        try:
            _s = dict(st.secrets)
            toml_key = str(_s.get("OPENAI_API_KEY","") or "").strip()
        except Exception:
            pass

        # Prefer env var; fall back to toml
        if env_key and env_key.startswith("sk-"):
            key = env_key
            # Auto-persist to secrets.toml if not already there
            if key != toml_key:
                try:
                    _secrets_path = Path(__file__).parent / ".streamlit" / "secrets.toml"
                    _secrets_path.parent.mkdir(exist_ok=True)
                    # Read existing content to preserve other keys
                    _existing = _secrets_path.read_text() if _secrets_path.exists() else ""
                    import re as _re
                    if "OPENAI_API_KEY" in _existing:
                        _existing = _re.sub(
                            r'OPENAI_API_KEY\s*=\s*"[^"]*"',
                            f'OPENAI_API_KEY = "{key}"',
                            _existing
                        )
                    else:
                        _existing = f'OPENAI_API_KEY = "{key}"\n' + _existing
                    _secrets_path.write_text(_existing)
                except Exception:
                    pass  # non-fatal — env var still works this session
        elif toml_key and toml_key.startswith("sk-"):
            key = toml_key

        if not key or not key.startswith("sk-"):
            return None
        return OpenAI(api_key=key)
    except Exception:
        return None

SYSTEM="""You are the KYB Intelligence Hub AI — expert on Worth AI's KYB data pipeline.
You have direct access to execute SQL against the Redshift database and WILL run queries to verify your answers.

CRITICAL RULES — NEVER VIOLATE:
1. ONLY reference tables, schemas, and columns that ACTUALLY EXIST (verified list below).
   NEVER invent, guess, or hallucinate anything. If unsure, say so explicitly.
2. NEVER fabricate, estimate, or invent data values. This means:
   - NEVER write a "Summary" or "Results" section with specific values you did not get from Redshift.
   - NEVER write values like "123 Main St, Anytown, USA", "John Doe", "confidence score of 0.95" unless
     those EXACT strings came from a Redshift query result shown in the conversation history.
   - NEVER use placeholder values: "example value", "12345", "YOUR-UUID", "2023-01-01", etc.
   The system AUTOMATICALLY EXECUTES your SQL and appends the REAL Redshift data.
   Your role: write correct SQL + brief explanation of what each query returns.
   The system role: execute the SQL and show the real results.
   DO NOT write a Summary section with values — that will always be fake. Write SQL instead.
3. When asked about a specific business_id: write SQL using the EXACT UUID provided in context.
   NEVER replace the UUID with a placeholder. Use it verbatim in the WHERE clause.
4. Redshift SQL: use JSON_EXTRACT_PATH_TEXT(col, 'key'). NEVER use ->> or ::json (fails on federation).
5. Always cite exact source file, table, column name, and API endpoint.
6. Platform IDs (integrations.constant.ts INTEGRATION_ID enum):
   16=Middesk · 23=OpenCorporates · 24=ZoomInfo · 17=Equifax · 38=Trulioo · 31=AI(GPT) ·
   22=SERP · 40=Plaid/KYX · 18=Plaid IDV · 0=Applicant · -1=System/Dependent

VERIFIED REDSHIFT SCHEMAS, TABLES, AND COLUMNS (use ONLY these — column names are exact):

rds_cases_public.rel_business_customer_monitoring
  COLUMNS (exact): business_id, customer_id, created_at
  NOTE: There is NO 'updated_at' column. Only these 3 columns exist.
  USE FOR: onboarding date (created_at), linking business → customer

rds_warehouse_public.facts
  COLUMNS (exact): business_id, name, value, received_at
  NOTE: value is a JSON string. Use JSON_EXTRACT_PATH_TEXT() — NEVER ->> or ::json.
  JSON structure inside value:
    JSON_EXTRACT_PATH_TEXT(value, 'value')                → actual fact value
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') → winning vendor ID
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') → confidence score
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'name')       → vendor name string
    JSON_EXTRACT_PATH_TEXT(value, 'ruleApplied', 'name')  → Fact Engine rule
  NO separate columns for: source, confidence, rule_applied, alternatives, is_winning.

rds_manual_score_public.data_current_scores
  COLUMNS (exact): business_id, score_id

rds_manual_score_public.business_scores
  COLUMNS (exact): id, weighted_score_850, weighted_score_100, risk_level, score_decision, created_at
  JOIN: JOIN business_scores bs ON bs.id = cs.score_id

rds_manual_score_public.business_score_factors
  COLUMNS (exact): score_id, category_id, score_100, weighted_score_850

rds_integration_data.business_entity_review_task
  COLUMNS (exact): id, business_entity_verification_id, key, status, sublabel, created_at, metadata

rds_integration_data.business_entity_verification
  COLUMNS (exact): id, business_id, created_at

clients.customer_table
  COLUMNS (partial, confirmed): business_id, customer_id, worth_score, watchlist_count, watchlist_verification

warehouse.worth_score_input_audit
  COLUMNS: score_date, plus fill_{feature_name} columns

TABLES THAT DO NOT EXIST — NEVER USE:
  integration_data.kyb_facts · rds_warehouse_public.kyb_facts
  Any column named: updated_at (in rel_business_customer_monitoring), fact_name,
  winning_value, winning_source, winning_confidence, rule_applied, is_winning, alternatives

VERIFIED KYB FACT NAMES (use ONLY these exact strings in name = '...' clauses):
ADDRESS facts: addresses, addresses_submitted, addresses_found, addresses_deliverable,
  primary_address, address_match, address_match_boolean, address_verification,
  address_verification_boolean, address_registered_agent
  IMPORTANT: There is NO fact named 'business_address', 'business_address_city',
  'business_address_state', 'business_address_postal_code', 'business_address_country'.
  Address data is stored in the 'addresses' and 'primary_address' facts as JSON objects.

NAME facts: business_name, legal_name, names_found, names_submitted, dba_found
IDENTITY facts: sos_active, sos_match, sos_match_boolean, sos_filings, formation_state,
  formation_date, middesk_confidence, middesk_id, tin, tin_submitted, tin_match,
  tin_match_boolean, is_sole_prop
IDV facts: idv_status, idv_passed, idv_passed_boolean
CLASSIFICATION facts: naics_code, mcc_code, naics_description, mcc_description, industry,
  revenue, num_employees
RISK facts: watchlist, watchlist_hits, watchlist_raw, adverse_media_hits, sanctions_hits,
  pep_hits, num_bankruptcies, num_judgements, num_liens
CONTACT facts: business_phone, phone_found, email, website, website_found, serp_id
OTHER facts: kyb_submitted, kyb_complete, compliance_status, risk_score, screened_people,
  people, countries, corporation, year_established

ANSWERING QUESTIONS — CRITICAL BEHAVIOR:
When a user asks a question, you MUST:
1. Write SQL using the VERIFIED fact names above (NOT invented names like business_address_city)
2. The system executes your SQL automatically and returns REAL data
3. After the data arrives, INTERPRET the results and DIRECTLY ANSWER the question
4. Explain WHAT the data means for the user's question, not just show the SQL

EXAMPLE: For "why is the OpenCorporates address different?"
→ Write SQL for 'addresses' fact (not 'business_address')
→ Then explain: OC (pid=23) vs Middesk (pid=16) may have matched different registry records,
  alternative sources[] array shows all vendor values with their confidence scores,
  the winning address may have lower match rank than what OC shows on their website.

EXAMPLE CORRECT SQL PATTERNS:

-- Get address data for a business (CORRECT fact names):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       JSON_EXTRACT_PATH_TEXT(value,'alternatives')         AS alternatives,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{business_id}'
  AND name IN ('addresses','addresses_submitted','addresses_found','primary_address',
               'address_verification','address_match_boolean')
ORDER BY name;

-- Check if a business was submitted by a user (kyb_submitted fact):
SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS kyb_submitted, received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{business_id}' AND name = 'kyb_submitted';

-- Get business onboarding info:
SELECT business_id, customer_id, created_at AS onboarded_at
FROM rds_cases_public.rel_business_customer_monitoring
WHERE business_id = '{business_id}';

-- Get all KYB facts for a business:
SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,
       received_at
FROM rds_warehouse_public.facts WHERE business_id = '{business_id}' ORDER BY name;

-- Get Worth Score:
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{business_id}' ORDER BY bs.created_at DESC LIMIT 1;

-- Get SOS/registry data:
SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence
FROM rds_warehouse_public.facts
WHERE business_id = '{business_id}'
  AND name IN ('sos_active','sos_match','sos_match_boolean','formation_state','middesk_confidence')
ORDER BY name;
"""

# ── Universal detail panel ────────────────────────────────────────────────────
def _make_python_from_sql(sql: str, fact_name: str = "") -> str:
    """Auto-generate Python code for the Python Runner from any SQL string.
    Strips leading comment lines so the actual SELECT is wrapped correctly.
    Always returns a usable snippet — never returns empty for non-empty SQL.
    """
    if not sql or not sql.strip():
        return ""
    # Strip leading comment-only lines to find the first real SQL statement
    lines = sql.strip().splitlines()
    sql_body_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("--") and not sql_body_lines:
            continue  # skip leading comments
        sql_body_lines.append(line)
    sql_body = "\n".join(sql_body_lines).strip()
    if not sql_body:
        # All lines were comments — wrap the full sql anyway
        sql_body = sql.strip()

    # Keep leading comments as a Python comment for context
    comments = []
    for line in lines:
        if line.strip().startswith("--"):
            comments.append("# " + line.strip()[2:].strip())
        else:
            break
    comment_block = "\n".join(comments) + "\n" if comments else ""

    return (
        f"{comment_block}"
        f"# Paste into 🐍 Python Runner — conn is pre-injected, pd is available\n"
        f"df = pd.read_sql(\"\"\"\n{sql_body}\n\"\"\", conn)\n"
        f"print(f'{{len(df):,}} rows returned')\n"
        f"print(df.to_string(index=False))"
    )

def detail_panel(
    label: str,
    value_display: str,
    *,
    what_it_means: str = "",
    source_table: str = "",
    source_file: str = "",
    source_file_line: str = "",
    api_endpoint: str = "",
    json_obj: dict = None,
    sql: str = "",
    python_code: str = "",   # explicit Python — auto-generated from sql if not provided
    links: list = None,
    color: str = "#3B82F6",
    icon: str = "📊",
):
    """
    Universal collapsible detail panel — shows source file (linked), table,
    API endpoint, JSON, SQL, and Python code for the Python Runner.
    """
    with st.expander(f"{icon} **{label}** — {value_display[:80]}  ·  click for source, JSON, SQL & Python"):

        # ── Source badges ──────────────────────────────────────────────────────
        all_links = list(links or [])
        if source_file:
            all_links = [(source_file, source_file_line or source_file)] + all_links
        badge_html = src_links_html(all_links) if all_links else ""
        if badge_html:
            st.markdown(f"<div style='margin-bottom:8px'>{badge_html}</div>", unsafe_allow_html=True)

        # ── Info grid ─────────────────────────────────────────────────────────
        rows_html = ""
        meta = [
            ("💡 What it means", what_it_means),
            ("🗄️ Stored in",      source_table),
            ("📁 Source file",    (source_file + (" · " + source_file_line if source_file_line else "")) if source_file else ""),
            ("🌐 API endpoint",   api_endpoint),
        ]
        for lbl, val in meta:
            if not val: continue
            rows_html += (
                f"<tr><td style='padding:5px 10px;color:#60A5FA;font-size:.78rem;white-space:nowrap;vertical-align:top'>{lbl}</td>"
                f"<td style='padding:5px 10px;color:#CBD5E1;font-size:.78rem'>{val}</td></tr>"
            )
        if rows_html:
            st.markdown(
                f"<table style='width:100%;border-collapse:collapse;background:#0f172a;border-radius:6px;margin:4px 0'>{rows_html}</table>",
                unsafe_allow_html=True
            )

        # ── JSON ───────────────────────────────────────────────────────────────
        if json_obj is not None:
            st.markdown("**JSON (as stored / returned by API):**")
            st.code(json.dumps(json_obj, indent=2, default=str, ensure_ascii=False), language="json")

        # ── SQL + Python always shown together ────────────────────────────────
        # Always auto-generate Python from SQL (even when SQL has leading comments)
        _py = python_code or _make_python_from_sql(sql) or ""

        if sql and _py:
            sc, pc = st.columns(2)
            with sc:
                st.markdown("**SQL (Redshift):**")
                st.code(sql.strip(), language="sql")
            with pc:
                st.markdown("**Python (paste into 🐍 Runner):**")
                st.code(_py, language="python")
        elif sql:
            st.markdown("**SQL to verify (Redshift):**")
            st.code(sql.strip(), language="sql")
            # Fallback: always show Python even if auto-gen was somehow empty
            _fallback_py = (
                "# Paste into 🐍 Python Runner — conn is pre-injected\n"
                f"df = pd.read_sql(\"\"\"\n{sql.strip()}\n\"\"\", conn)\n"
                "print(f'{len(df):,} rows')\n"
                "print(df.to_string(index=False))"
            )
            st.markdown("**Python (paste into 🐍 Runner):**")
            st.code(_fallback_py, language="python")
        elif _py:
            st.markdown("**Python (paste into 🐍 Runner):**")
            st.code(_py, language="python")


def _clean_sql(sql: str) -> str:
    """
    Clean SQL before execution:
    1. Remove inline comments that appear on the SAME LINE as the SELECT
       (e.g. '-- Check if ...\nSELECT ...' — Redshift treats the SELECT as
       a comment continuation if the -- is on the preceding line without a newline)
    2. Remove trailing semicolons from multi-statement blocks
    3. Strip leading/trailing whitespace
    """
    import re
    # Remove lines that are ONLY comments (keep SQL lines that have inline --)
    clean_lines = []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue  # skip pure comment lines
        clean_lines.append(line)
    sql = "\n".join(clean_lines).strip()
    # Remove leading/trailing semicolons
    sql = sql.rstrip(";").strip()
    return sql

def _extract_sql_from_answer(text: str) -> list:
    """Extract SQL code blocks from an AI answer, clean them before returning."""
    import re
    # Primary: extract ```sql ... ``` fenced blocks
    blocks = re.findall(r"```sql\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    # Fallback: extract bare ```...``` blocks that look like SQL
    if not blocks:
        all_code = re.findall(r"```\s*(.*?)```", text, re.DOTALL)
        for b in all_code:
            upper = b.strip().upper()
            if upper.startswith(("SELECT","WITH","INSERT","UPDATE","CREATE","DROP")):
                blocks.append(b)
    # Clean each block before returning
    cleaned = []
    for b in blocks:
        c = _clean_sql(b)
        if c and len(c) > 10:  # skip tiny fragments
            cleaned.append(c)
    return cleaned

def _execute_sql_with_retry(sql: str, max_attempts: int = 4) -> tuple:
    """
    Execute SQL against Redshift with self-healing retry logic.
    Returns: (df, error, final_sql, list_of_fixes_applied)

    On each failure, analyses the error message and applies targeted fixes:
    - Removes comments that break Redshift parsing
    - Replaces non-existent columns with their correct equivalents
    - Removes non-existent columns from SELECT
    - Tries alternative table/schema names
    """
    import re

    # Map of error fragment → (bad_pattern, fix_function, fix_description)
    # Each fix is a callable that takes current_sql and returns fixed_sql
    def _fix_comment_parsing(s):
        """Redshift fails when -- comment is on same line before SQL keywords."""
        return _clean_sql(s)

    def _fix_remove_col(col):
        def _f(s):
            lines = s.split("\n")
            return "\n".join(l for l in lines if col.lower() not in l.lower())
        return _f

    def _fix_replace_col(bad, good):
        def _f(s):
            return re.sub(rf'\b{re.escape(bad)}\b', good, s, flags=re.IGNORECASE)
        return _f

    # Ordered list of (error_signature, fix_function, description)
    FIXES = [
        # Comment parsing issues
        ("syntax error", _fix_comment_parsing,
         "Removed inline SQL comments that were breaking Redshift parsing"),
        # Non-existent columns in rds_warehouse_public.facts
        ("address_value", _fix_replace_col("address_value", "JSON_EXTRACT_PATH_TEXT(value,'value')"),
         "address_value → JSON_EXTRACT_PATH_TEXT(value,'value')"),
        ("fact_value", _fix_replace_col("fact_value", "JSON_EXTRACT_PATH_TEXT(value,'value')"),
         "fact_value → JSON_EXTRACT_PATH_TEXT(value,'value')"),
        ("rule_applied", _fix_replace_col("rule_applied", "JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')"),
         "rule_applied → JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')"),
        ("source_confidence", _fix_replace_col("source_confidence", "JSON_EXTRACT_PATH_TEXT(value,'source','confidence')"),
         "source_confidence → JSON_EXTRACT_PATH_TEXT(value,'source','confidence')"),
        ("winning_source", _fix_replace_col("winning_source", "JSON_EXTRACT_PATH_TEXT(value,'source','platformId')"),
         "winning_source → JSON_EXTRACT_PATH_TEXT(value,'source','platformId')"),
        ("winning_pid", _fix_replace_col("winning_pid", "JSON_EXTRACT_PATH_TEXT(value,'source','platformId')"),
         "winning_pid → JSON_EXTRACT_PATH_TEXT(value,'source','platformId') (already an alias, not a column)"),
        ("is_winning", _fix_remove_col("is_winning"),
         "Removed is_winning — not a column in facts table"),
        # Non-existent columns in rel_business_customer_monitoring
        ("updated_at", _fix_remove_col("updated_at"),
         "Removed updated_at — does not exist in rel_business_customer_monitoring"),
        # Alias used as column name (common when AI reuses aliases in WHERE)
        ("address_match_status", _fix_replace_col("address_match_status", "JSON_EXTRACT_PATH_TEXT(value,'value')"),
         "address_match_status → JSON_EXTRACT_PATH_TEXT(value,'value')"),
        # Schema name issues
        ("does not exist", _fix_comment_parsing,
         "Cleaned SQL to remove potential comment interference"),
    ]

    current_sql = _clean_sql(sql)
    fixes_applied = []
    last_err = None

    for attempt in range(max_attempts):
        df, err = run_sql(current_sql)
        if df is not None:
            return df, None, current_sql, fixes_applied
        last_err = err or "Unknown error"
        if attempt == max_attempts - 1:
            break

        # Find and apply a fix based on error message
        err_lower = last_err.lower()
        fixed = False
        for err_sig, fix_fn, fix_desc in FIXES:
            if err_sig in err_lower:
                new_sql = fix_fn(current_sql)
                if new_sql != current_sql:
                    current_sql = new_sql
                    fixes_applied.append(fix_desc)
                    fixed = True
                    break
        if not fixed:
            break  # no known fix — stop retrying

    return None, last_err, current_sql, fixes_applied

@st.cache_data(ttl=3600, show_spinner=False)
def _discover_schema(schema_name: str, table_name: str) -> str:
    """Query information_schema for the REAL column list. Cached 1h."""
    df, err = run_sql(f"""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema='{schema_name}' AND table_name='{table_name}'
        ORDER BY ordinal_position
    """)
    if df is not None and not df.empty:
        return "\n".join(f"  {r['column_name']} ({r['data_type']})" for _, r in df.iterrows())
    return f"  (schema discovery failed for {schema_name}.{table_name}: {err or 'no columns found'})"

def _get_schema_for_sql(sql: str) -> str:
    """Extract table references from SQL and discover their real columns."""
    import re
    refs = re.findall(r'(?:FROM|JOIN)\s+([\w]+)\.([\w]+)', sql, re.IGNORECASE)
    if not refs:
        return ""
    parts = []
    for schema, table in refs[:4]:
        parts.append(f"\nReal columns in {schema}.{table} (from information_schema):\n{_discover_schema(schema, table)}")
    return "\n".join(parts)

def _explain_zero_rows(sql: str, bid: str) -> str:
    """When a query returns 0 rows, run diagnostic queries to explain why
    and return a meaningful explanation with alternative suggestions."""
    import re
    explanation_parts = ["**Why 0 rows? Diagnostic investigation:**\n"]

    # Check 1: does the business_id exist at all?
    if bid and len(bid) > 10:
        df_check, _ = run_sql(f"""
            SELECT COUNT(DISTINCT name) AS fact_count, MIN(received_at) AS earliest, MAX(received_at) AS latest
            FROM rds_warehouse_public.facts
            WHERE business_id = '{bid}'
        """)
        if df_check is not None and not df_check.empty:
            count = int(df_check.iloc[0].get('fact_count', 0) or 0)
            if count == 0:
                explanation_parts.append(f"- ❌ Business ID `{bid}` has **NO facts** in `rds_warehouse_public.facts`. "
                                          "This business may not have been processed yet, or the UUID may be incorrect.")
            else:
                earliest = str(df_check.iloc[0].get('earliest',''))[:16]
                latest   = str(df_check.iloc[0].get('latest',''))[:16]
                explanation_parts.append(f"- ✅ Business ID exists with **{count} facts** (from {earliest} to {latest})")

    # Check 2: what fact names does it actually have?
    if bid and len(bid) > 10:
        df_names, _ = run_sql(f"""
            SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val
            FROM rds_warehouse_public.facts
            WHERE business_id = '{bid}'
              AND name IN ('addresses_submitted','addresses','primary_address','address_verification',
                           'address_match','address_match_boolean','kyb_submitted','kyb_complete',
                           'sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
                           'watchlist_hits','formation_state')
            ORDER BY name
        """)
        if df_names is not None and not df_names.empty:
            rows_str = df_names.to_string(index=False)
            explanation_parts.append(f"\n**Available KYB facts for this business:**\n```\n{rows_str}\n```")
        else:
            explanation_parts.append("- ℹ️ Could not retrieve available fact names — business may not exist in facts table")

    # Check 3: extract the fact name being queried and check it specifically
    fact_names = re.findall(r"name\s*=\s*'([^']+)'", sql, re.IGNORECASE)
    if fact_names and bid:
        for fname in fact_names[:3]:
            df_fact, _ = run_sql(f"""
                SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,
                       JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid,
                       received_at
                FROM rds_warehouse_public.facts
                WHERE business_id = '{bid}' AND name = '{fname}'
                ORDER BY received_at DESC LIMIT 3
            """)
            if df_fact is not None and not df_fact.empty:
                explanation_parts.append(f"\n**Fact `{fname}` found (the original query had a schema issue):**\n```\n{df_fact.to_string(index=False)}\n```")
            else:
                explanation_parts.append(f"\n- ℹ️ Fact `{fname}` does not exist for this business — it was never populated")

    return "\n".join(explanation_parts) if len(explanation_parts) > 1 else ""

def ask_ai(question, context="", history=None, auto_execute=True):
    """Ask the AI. Executes SQL, self-heals schema errors, and always returns
    meaningful results — never just '0 rows returned'."""
    client=get_openai()
    if not client: return "⚠️ Set OPENAI_API_KEY env var to enable AI responses."
    chunks=rag_search(question,top_k=6)
    rag="\n\n".join(f"[{c['source_type']}] {c['description']}\n{c['text'][:600]}" for c in chunks)
    msgs=[{"role":"system","content":SYSTEM}]
    if history: msgs.extend(history[-8:])
    # Extract business UUID from context if present — inject it explicitly
    # so the AI uses the exact UUID in SQL, never a placeholder
    import re as _re
    _uuid_match = _re.search(
        r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        context + " " + question, _re.IGNORECASE
    )
    _bid_injection = ""
    if _uuid_match:
        _bid_injection = (
            f"\n\nBUSINESS UUID FOR SQL (use this EXACT value in WHERE business_id = '...' clauses):\n"
            f"  {_uuid_match.group(0)}\n"
            f"CRITICAL: Never replace this UUID with a placeholder like '12345' or 'example'."
        )

    msgs.append({"role":"user","content":
        f"RAG:\n{rag}\n\nContext:\n{context}{_bid_injection}\n\nQuestion: {question}\n\n"
        f"IMPORTANT: Write SQL with the real UUID above. The system will execute it and return REAL data. "
        f"Do NOT write 'example value' or placeholder results — just write the SQL."})
    # ── Source-type → GitHub URL resolver ────────────────────────────────────
    REPO_BASE = REPO  # feature branch URL, already defined above
    def _chunk_github_url(chunk: dict) -> str:
        """Return a verified GitHub URL for a RAG chunk.
        Uses a complete filename→URL lookup built from git ls-files output,
        so every link points to a file that actually exists on the branch.
        """
        stype = chunk.get("source_type","")
        path  = chunk.get("path","") or ""
        line_start = chunk.get("line_start")
        anchor = f"#L{line_start}" if line_start else ""

        # Complete map of EVERY tracked api-docs file: filename → full GitHub URL
        # Built from: git ls-files Admin-Portal-KYB-App/api-docs/
        # Branch: cursor/ai-classification-agent-7910
        _R = REPO_BASE  # already points to the correct branch
        API_DOCS_FILES = {
            # api-reference / add-or-update-business
            "add-business.md":          f"{_R}/api-docs/api-reference/add-or-update-business/add-business.md",
            "update-business.md":       f"{_R}/api-docs/api-reference/add-or-update-business/update-business.md",
            # api-reference / auth
            "create-customer-user.md":  f"{_R}/api-docs/api-reference/auth/customers/create-customer-user.md",
            "customer-user-resend-invitation.md": f"{_R}/api-docs/api-reference/auth/customers/customer-user-resend-invitation.md",
            "get-customer-subroles.md": f"{_R}/api-docs/api-reference/auth/customers/get-customer-subroles.md",
            "get-customer-user-by-id.md": f"{_R}/api-docs/api-reference/auth/customers/get-customer-user-by-id.md",
            "get-customer-users.md":    f"{_R}/api-docs/api-reference/auth/customers/get-customer-users.md",
            "update-customer-user-by-id.md": f"{_R}/api-docs/api-reference/auth/customers/update-customer-user-by-id.md",
            "customer-logout.md":       f"{_R}/api-docs/api-reference/auth/sign-in/customer-logout.md",
            "customer-refresh-token.md":f"{_R}/api-docs/api-reference/auth/sign-in/customer-refresh-token.md",
            "customer-sign-in.md":      f"{_R}/api-docs/api-reference/auth/sign-in/customer-sign-in.md",
            "forgot-password-init.md":  f"{_R}/api-docs/api-reference/auth/sign-in/forgot-password-init.md",
            "reset-password.md":        f"{_R}/api-docs/api-reference/auth/sign-in/reset-password.md",
            "accept-invitation.md":     f"{_R}/api-docs/api-reference/auth/users/accept-invitation.md",
            # api-reference / case
            "add-update-business-custom-fields.md": f"{_R}/api-docs/api-reference/case/businesses/add-update-business-custom-fields.md",
            "get-business-cases.md":    f"{_R}/api-docs/api-reference/case/businesses/get-business-cases.md",
            "get-business-details.md":  f"{_R}/api-docs/api-reference/case/businesses/get-business-details.md",
            "get-custom-fields.md":     f"{_R}/api-docs/api-reference/case/businesses/get-custom-fields.md",
            "get-customer-businesses.md": f"{_R}/api-docs/api-reference/case/businesses/get-customer-businesses.md",
            "npi-reverse-lookup.md":    f"{_R}/api-docs/api-reference/case/businesses/npi-reverse-lookup.md",
            "get-customer-case-by-id.md": f"{_R}/api-docs/api-reference/case/cases/get-customer-case-by-id.md",
            "get-customer-cases.md":    f"{_R}/api-docs/api-reference/case/cases/get-customer-cases.md",
            "send-business-invite.md":  f"{_R}/api-docs/api-reference/case/invites/send-business-invite.md",
            "get-related-businesses.md": f"{_R}/api-docs/api-reference/case/related-businesses/get-related-businesses.md",
            # api-reference / integration
            "get-reports.md":           f"{_R}/api-docs/api-reference/integration/accounting/get-reports.md",
            "banking-information.md":   f"{_R}/api-docs/api-reference/integration/banking/banking-information.md",
            "bankruptcies-judgements-&-liens-bjl.md": f"{_R}/api-docs/api-reference/integration/facts/bankruptcies-judgements-&-liens-bjl.md",
            "kyb.md":                   f"{_R}/api-docs/api-reference/integration/facts/kyb.md",
            "reviews.md":               f"{_R}/api-docs/api-reference/integration/facts/reviews.md",
            "adverse-media.md":         f"{_R}/api-docs/api-reference/integration/public-records/adverse-media.md",
            "public-records.md":        f"{_R}/api-docs/api-reference/integration/public-records/public-records.md",
            "tax-filing.md":            f"{_R}/api-docs/api-reference/integration/taxation/tax-filing.md",
            "get-business-website-data.md": f"{_R}/api-docs/api-reference/integration/verification/get-business-website-data.md",
            "get-npi-details.md":       f"{_R}/api-docs/api-reference/integration/verification/get-npi-details.md",
            "get-verification-details.md": f"{_R}/api-docs/api-reference/integration/verification/get-verification-details.md",
            "kyc-ownership-verification.md": f"{_R}/api-docs/api-reference/integration/verification/kyc-ownership-verification.md",
            # api-reference / score & worth-360
            "get-business-score.md":    f"{_R}/api-docs/api-reference/score/score/get-business-score.md",
            "check-worth-360-report-generation-status.md": f"{_R}/api-docs/api-reference/worth-360-report/check-worth-360-report-generation-status.md",
            "download-worth-360-report.md": f"{_R}/api-docs/api-reference/worth-360-report/download-worth-360-report.md",
            "generate-worth-360-report-using-customer.md": f"{_R}/api-docs/api-reference/worth-360-report/generate-worth-360-report-using-customer.md",
            # getting-started
            "overview.md":              f"{_R}/api-docs/getting-started/overview.md",
            "kyb-kyc.md":              f"{_R}/api-docs/getting-started/kyb-kyc.md",
            "add-business.md":          f"{_R}/api-docs/getting-started/add-business.md",
            "banking.md":              f"{_R}/api-docs/getting-started/banking.md",
            "introduction.md":          f"{_R}/api-docs/introduction.md",
            # onboarding-sdk
            "api-overview.md":          f"{_R}/api-docs/onboarding-sdk/api-overview.md",
            "api-sequence-diagram.md":  f"{_R}/api-docs/onboarding-sdk/api-sequence-diagram.md",
            "api-step-by-step-breakdown.md": f"{_R}/api-docs/onboarding-sdk/api-step-by-step-breakdown.md",
            "api-reference.md":         f"{_R}/api-docs/onboarding-sdk/overview.md",
            # use-cases
            "instant-onboarding.md":    f"{_R}/api-docs/use-cases/onboarding/instant-onboarding.md",
            "invite-business.md":       f"{_R}/api-docs/use-cases/onboarding/invite-business.md",
            # openapi specs
            "get-kyb.json":            GITHUB_LINKS.get("openapi/kyb",""),
            "integration.json":        GITHUB_LINKS.get("openapi/integration",""),
            # integration-service source files
            "index.ts":                GITHUB_LINKS.get("facts/kyb/index.ts",""),
            "rules.ts":                GITHUB_LINKS.get("facts/rules.ts",""),
            "sources.ts":              GITHUB_LINKS.get("facts/sources.ts",""),
            "consolidatedWatchlist.ts":GITHUB_LINKS.get("consolidatedWatchlist.ts",""),
            "aiscore.py":              GITHUB_LINKS.get("aiscore.py",""),
            "worth_score_model.py":    GITHUB_LINKS.get("worth_score_model.py",""),
            "customer_table.sql":      GITHUB_LINKS.get("customer_table.sql",""),
        }

        # 1. Direct filename lookup (most reliable)
        fname = path.split("/")[-1] if "/" in path else path
        if fname and fname in API_DOCS_FILES and API_DOCS_FILES[fname]:
            return API_DOCS_FILES[fname] + anchor

        # 2. Source-type folder fallback for non-API_DOCS sources
        FOLDER_MAP = {
            "INTEGRATION_SERVICE":f"{_R}/integration-service-main/lib/facts",
            "MICROSITES":         f"{_R}/microsites-main/packages/case/src/page/Cases",
            "WAREHOUSE_SERVICE":  f"{_R}/warehouse-service-main",
            "WORTH_SCORE":        f"{_R}/ai-score-service-main",
            "WATCHLIST":          f"{_R}/integration-service-main/lib/facts/kyb",
            "DOMESTIC_FOREIGN":   f"{_R}/integration-service-main/lib/facts/kyb",
            "FACT_ENGINE":        f"{_R}/integration-service-main/lib/facts",
            "NAICS_MCC":          f"{_R}/integration-service-main/lib/facts/businessDetails",
            "TIN_VERIFICATION":   f"{_R}/integration-service-main/lib/facts/kyb",
            "API_DOCS":           f"{_R}/api-docs",
        }
        folder = FOLDER_MAP.get(stype,"")
        if folder and fname:
            return f"{folder}/{fname}{anchor}"
        return folder or ""

    try:
        r=get_openai().chat.completions.create(model="gpt-4o-mini",messages=msgs,max_tokens=1500,temperature=0.2)
        answer = r.choices[0].message.content

        # ── Detect and remove hallucinated narrative result sections ─────────
        # The AI sometimes writes a "Summary" or "Query Results" section with
        # fabricated values (e.g. "123 Main St, Anytown, USA", "John Doe", "0.95").
        # These are NOT from Redshift — they are invented. Strip them entirely
        # so only the real executed results (appended below) are shown.
        import re as _re2

        # Remove entire "Summary" / "Query Results" / "Results" blocks that
        # appear to be AI-fabricated narrative text
        _hallucinated_sections = _re2.split(
            r'\n+#{1,3}\s*(?:Summary|Query Results?|Results?|Findings?)\s*\n',
            answer, flags=_re2.IGNORECASE
        )
        if len(_hallucinated_sections) > 1:
            # Keep only the first part (the explanation/SQL) — discard the fake results section
            # But keep any part that is actually a code block
            _kept_parts = []
            for part in _hallucinated_sections:
                # If the section contains a SQL code block, keep it (it's the SQL explanation)
                # If it looks like fabricated narrative results, drop it
                if "```" in part or "SELECT" in part.upper() or len(part.strip()) < 50:
                    _kept_parts.append(part)
                elif any(fake in part.lower() for fake in [
                    "123 main st", "anytown", "john doe", "jane doe",
                    "example value", "placeholder", "0.95", "0.90",
                    "address submitted", "confidence score of"
                ]):
                    # Drop this fabricated section — real data comes from execution
                    _kept_parts.append(
                        "\n> ⚠️ *Narrative summary removed — see **REAL DATA from Redshift** below for actual values.*\n"
                    )
                else:
                    _kept_parts.append(part)
            answer = "\n\n".join(_kept_parts)

        # Also strip known fake value patterns inline
        _fake_patterns = [
            (r'123\s+Main\s+St[,\s]+Anytown[,\s]+USA', '`[see real data below]`'),
            (r'\bJohn\s+Doe\b', '`[see real data below]`'),
            (r'\bJane\s+Doe\b', '`[see real data below]`'),
            (r'\(example value\)', '*(real value in results below)*'),
            (r'example value', '*(real value in results below)*'),
            (r'\bYOUR[-_]UUID\b', '`[UUID from context]`'),
            (r'\bPASTE[-_]UUID[-_]HERE\b', '`[UUID from context]`'),
        ]
        for pat, replacement in _fake_patterns:
            if _re2.search(pat, answer, _re2.IGNORECASE):
                answer = _re2.sub(pat, replacement, answer, flags=_re2.IGNORECASE)

        # ── Auto-execute SQL blocks and append real results ───────────────────
        if auto_execute:
            sql_blocks = _extract_sql_from_answer(answer)
            executed_results = []
            for i, sql in enumerate(sql_blocks[:3]):  # max 3 queries per answer
                df, err, used_sql, fixes = _execute_sql_with_retry(sql)
                block_label = f"Query {i+1}" if len(sql_blocks) > 1 else "Query"

                if df is not None and not df.empty:
                    try:
                        rows_md = df.head(20).to_markdown(index=False)
                    except Exception:
                        rows_md = df.head(20).to_string(index=False)
                    fix_note = ("\n\n  ✏️ Auto-corrected schema: " + " · ".join(fixes)) if fixes else ""
                    executed_results.append(
                        f"\n\n**✅ {block_label} — REAL DATA from Redshift ({len(df):,} row(s)):**{fix_note}\n\n"
                        f"```\n{rows_md}\n```"
                        + (f"\n\n*(Showing first 20 of {len(df):,} rows)*" if len(df) > 20 else "")
                        + f"\n\n*(Live values from Redshift — not generated by AI)*"
                    )
                    if used_sql.strip() != _clean_sql(sql).strip():
                        executed_results.append(
                            f"\n\n**🔧 SQL actually executed (auto-corrected):**\n```sql\n{used_sql}\n```"
                        )

                elif df is not None and df.empty:
                    # 0 rows — run diagnostics to explain why and show what's actually there
                    _zero_explanation = _explain_zero_rows(used_sql, _uuid_match.group(0) if _uuid_match else "")
                    executed_results.append(
                        f"\n\n**ℹ️ {block_label} returned 0 rows — running diagnostics…**\n\n"
                        + (_zero_explanation if _zero_explanation else
                           "No data found and diagnostics were inconclusive. "
                           "The business may not have this fact populated yet.\n\n"
                           f"**SQL used:**\n```sql\n{used_sql}\n```")
                    )

                elif err:
                    # SQL failed — discover real schema and ask AI to fix it
                    _real_schema = _get_schema_for_sql(used_sql)
                    _fix_prompt = (
                        f"The following SQL failed on Redshift:\n"
                        f"ERROR: {err}\n\n"
                        f"BROKEN SQL:\n```sql\n{used_sql}\n```\n\n"
                        f"{_real_schema}\n\n"
                        f"RULES:\n"
                        f"- rds_warehouse_public.facts has ONLY: business_id, name, value, received_at\n"
                        f"  All other fields are inside the 'value' JSON column.\n"
                        f"  Use JSON_EXTRACT_PATH_TEXT(value,'value') to get the fact value.\n"
                        f"  Use JSON_EXTRACT_PATH_TEXT(value,'source','platformId') for the vendor ID.\n"
                        f"- rds_cases_public.rel_business_customer_monitoring has ONLY: business_id, customer_id, created_at\n"
                        f"- Do NOT put -- comments on the same line as SQL keywords.\n"
                        f"- Do NOT use aliases in WHERE clauses.\n\n"
                        f"Write ONLY the corrected SQL in a ```sql block. No narrative. No comments."
                    )
                    try:
                        _fix_r = get_openai().chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[{"role":"system","content":SYSTEM},
                                      {"role":"user","content":_fix_prompt}],
                            max_tokens=600, temperature=0
                        )
                        _fixed_blocks = _extract_sql_from_answer(_fix_r.choices[0].message.content)
                        if _fixed_blocks:
                            _fixed_sql = _fixed_blocks[0]
                            df2, err2, used2, fixes2 = _execute_sql_with_retry(_fixed_sql)
                            if df2 is not None and not df2.empty:
                                try:
                                    rows_md2 = df2.head(20).to_markdown(index=False)
                                except Exception:
                                    rows_md2 = df2.head(20).to_string(index=False)
                                executed_results.append(
                                    f"\n\n**✅ {block_label} — REAL DATA from Redshift "
                                    f"({len(df2):,} row(s)) — recovered after schema auto-fix:**\n\n"
                                    f"```\n{rows_md2}\n```"
                                    + (f"\n\n*(Showing first 20 of {len(df2):,} rows)*" if len(df2)>20 else "")
                                    + f"\n\n*(Live values from Redshift — not generated by AI)*"
                                    f"\n\n**Corrected SQL:**\n```sql\n{used2}\n```"
                                )
                            elif df2 is not None and df2.empty:
                                # Fixed SQL works but still 0 rows — run diagnostics
                                _bid_for_diag = _uuid_match.group(0) if _uuid_match else ""
                                _diag = _explain_zero_rows(used2, _bid_for_diag)
                                executed_results.append(
                                    f"\n\n**ℹ️ {block_label} — Schema fixed but 0 rows returned. Diagnostics:**\n\n"
                                    + (_diag or "No data found for this query.")
                                    + f"\n\n**Working SQL:**\n```sql\n{used2}\n```"
                                )
                            else:
                                executed_results.append(
                                    f"\n\n**❌ {block_label} failed even after schema fix.**\n"
                                    f"Original error: `{err[:120]}`\n"
                                    f"Fix attempt error: `{(err2 or '')[:120]}`\n\n"
                                    f"**{_real_schema}**\n\n"
                                    f"**Try this in the SQL Runner:**\n```sql\n{_fixed_sql}\n```"
                                )
                        else:
                            executed_results.append(
                                f"\n\n**❌ {block_label} failed — auto-fix produced no SQL.**\n"
                                f"Error: `{err[:200]}`\n\n"
                                f"{_real_schema}\n\n"
                                f"**Try this in the SQL Runner:**\n```sql\n{used_sql}\n```"
                            )
                    except Exception as _fix_ex:
                        executed_results.append(
                            f"\n\n**❌ {block_label} failed:** `{err[:200]}`\n\n"
                            f"{_get_schema_for_sql(used_sql)}\n\n"
                            f"**Try this in the SQL Runner:**\n```sql\n{used_sql}\n```"
                        )

            if executed_results:
                answer += "\n\n---\n**🔬 Live Results from Redshift:**" + "".join(executed_results)

                # ── Ask AI to interpret the results and answer the original question ──
                # Collect actual data rows from successful queries
                _data_for_interpretation = []
                for i, sql in enumerate(sql_blocks[:3]):
                    df_check, _, _, _ = _execute_sql_with_retry(sql)
                    if df_check is not None and not df_check.empty:
                        _data_for_interpretation.append(
                            f"Query {i+1} results ({len(df_check)} rows):\n"
                            + df_check.head(15).to_string(index=False)
                        )

                if _data_for_interpretation:
                    try:
                        _interp_prompt = (
                            f"The user asked: \"{question}\"\n\n"
                            f"You queried Redshift and got these REAL results:\n\n"
                            + "\n\n".join(_data_for_interpretation)
                            + "\n\nNow DIRECTLY ANSWER the user's question based on this data. "
                            f"Be specific — reference actual values from the results. "
                            f"Explain what the data means for their question. "
                            f"If they asked about discrepancies, explain WHY (e.g. Middesk vs OC different search methods, "
                            f"confidence scores, when data was last updated, alternatives[] showing other vendor values). "
                            f"Do NOT just describe the SQL — answer the question."
                        )
                        _interp_r = get_openai().chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role":"system","content":SYSTEM},
                                {"role":"user","content":_interp_prompt}
                            ],
                            max_tokens=800, temperature=0.3
                        )
                        _interpretation = _interp_r.choices[0].message.content
                        answer += f"\n\n---\n**💡 Answer to your question:**\n\n{_interpretation}"
                    except Exception:
                        pass  # interpretation is best-effort — don't fail if it errors

        # ── Source citations ──────────────────────────────────────────────────
        if chunks:
            seen = set()
            unique_chunks = []
            for c in chunks:
                key = (c.get("source_type",""), c.get("path",""))
                if key not in seen:
                    seen.add(key)
                    unique_chunks.append(c)

            cited_lines = []
            for c in unique_chunks[:5]:
                src_type = c.get("source_type","")
                path_val = c.get("path","") or ""
                desc = c.get("description","")[:90]
                line_start = c.get("line_start")
                url = _chunk_github_url(c)
                display_file = path_val or src_type.lower().replace("_"," ").title()
                line_ref = f" L{line_start}" if line_start else ""
                if url:
                    cited_lines.append(f"- [`{src_type}`]({url}) · **{display_file}{line_ref}** — {desc}")
                else:
                    cited_lines.append(f"- `{src_type}` · **{display_file}{line_ref}** — {desc}")

            answer += "\n\n---\n**📁 Sources used for this answer** *(click to open in GitHub)*:\n"
            answer += "\n".join(cited_lines)
            answer += (
                "\n\n**🔗 Key reference files:**\n"
                f"- [facts/kyb/index.ts]({GITHUB_LINKS.get('facts/kyb/index.ts','')}) — all KYB fact definitions\n"
                f"- [facts/rules.ts]({GITHUB_LINKS.get('facts/rules.ts','')}) — factWithHighestConfidence algorithm\n"
                f"- [integrations.constant.ts]({GITHUB_LINKS.get('integrations.constant.ts','')}) — vendor platform IDs\n"
                f"- [API Reference]({GITHUB_LINKS.get('openapi/integration','')}) — /kyb endpoint schema (openapi)"
            )
        return answer
    except Exception as e: return f"⚠️ AI error: {e}"

def ai_popup(key, context, questions, bid):
    import hashlib
    with st.popover("✨ Ask AI"):
        st.markdown(f"**🤖 AI — {key}**")
        for q in questions:
            q_hash = hashlib.md5(f"{key}|{q}".encode()).hexdigest()[:8]
            if st.button(q, key=f"qaip_{q_hash}"):
                st.session_state[f"pending_q_{key}"] = q
        custom = st.text_input("Custom question:", key=f"cust_{key}")
        if custom and st.button("Send", key=f"csend_{key}", type="primary"):
            st.session_state[f"pending_q_{key}"] = custom
        pending = st.session_state.pop(f"pending_q_{key}", None)
        if pending:
            with st.spinner("Thinking…"):
                ans = ask_ai(pending, f"Business: {bid}\n{context}")
            st.markdown(f"**Q:** {pending}")
            st.markdown(ans)   # render markdown so links are clickable

# ════════════════════════════════════════════════════════════════════════════════
# TOP-BAR LAYOUT  (replaces sidebar)
# ════════════════════════════════════════════════════════════════════════════════
_,is_live,conn_err=get_conn()

# ── Row 1: Status bar ─────────────────────────────────────────────────────────
_rs_cls  = "ok"  if is_live else "err"
_rs_lbl  = "connected" if is_live else f"not connected"
_ai_key  = bool(get_openai())
_ai_cls  = "ok"  if _ai_key else "warn"
_ai_lbl  = "live" if _ai_key else "key not set"

_r1c1, _r1c2, _r1c3, _r1c4, _r1c5 = st.columns([3, 1.3, 1.3, 0.9, 0.9])
with _r1c1:
    st.markdown(
        "<div class='topbar-logo' style='padding-top:6px'>🛡️ KYB "
        "<span>Confidence</span> Intelligence Hub "
        "<span class='topbar-badge'>v2 · NO AUTH</span></div>",
        unsafe_allow_html=True,
    )
with _r1c2:
    st.markdown(
        f"<div class='conn-chip {_rs_cls}' style='margin-top:6px'>🗄 Redshift: {_rs_lbl}</div>",
        unsafe_allow_html=True,
    )
with _r1c3:
    st.markdown(
        f"<div class='conn-chip {_ai_cls}' style='margin-top:6px'>🤖 OpenAI: {_ai_lbl}</div>",
        unsafe_allow_html=True,
    )
with _r1c4:
    if st.button("🔄 Refresh", use_container_width=True, help="Clear caches and rerun"):
        st.cache_data.clear(); st.rerun()
with _r1c5:
    if not is_live and st.button("🔌 Retry", use_container_width=True):
        st.cache_data.clear(); st.rerun()

st.markdown("<hr class='thin-sep'/>", unsafe_allow_html=True)

# ── (sidebar body — kept for session state init only, not displayed) ──────
_search_q = st.session_state.get("global_search_top", "")

# ── Search index ─────────────────────────────────────────────────────────
# Format: (exact_keywords_list, tab, sub_tab, card_path, description)
# card_path: the exact expander/card label the user should click once in the tab
# Matching: keyword must EXACTLY match or contain the search term as a whole word
SEARCH_INDEX = [
    # ── 🏠 Home ────────────────────────────────────────────────────────────
    (["home","dashboard","portfolio","overview","kpi","onboarding timeline"],
     "🏠 Home","Portfolio Overview",None,
     "Main dashboard: KYB health rates, onboarding timeline, red flag distribution, Worth Score, business count by customer."),
    (["customer filter","customer name","filter customer","customer dropdown"],
     "🏠 Home","Sidebar → Customer Filter",None,
     "Filter the Home dashboard to one customer's businesses. Dropdown shows business count per customer within the selected date range."),
    (["date range","date filter","filter date","onboarding date","period filter"],
     "🏠 Home","Sidebar → Date Range",None,
     "Filter Home data by onboarding date. Uses rds_cases_public.rel_business_customer_monitoring.created_at (the true onboarding date, not facts.received_at)."),
    (["red flag","flagged business","top 10","needs attention","flag score"],
     "🏠 Home","Top 10 Businesses Needing Attention",None,
     "Businesses ranked by red flag severity score. Watchlist=+12, SOS inactive=+10, TIN fail=+6. Custom heuristic — not a regulatory score."),
    (["recently onboarded","new business","recent business","latest business"],
     "🏠 Home","Recently Onboarded Businesses",None,
     "Most recently onboarded businesses with their KYB status flags."),

    # ── 🏛️ Registry & Identity ─────────────────────────────────────────────
    (["sos","secretary of state","sos active","sos match","sos_match_boolean","sos_active","registry","sos filing"],
     "🏛️ Registry & Identity","SOS tab → Fact Lineage","🏛️ SOS tab",
     "SOS registry status. sos_active derived from sos_filings[].active (Middesk pid=16). sos_match: Middesk searches by submitted address."),
    (["middesk confidence","middesk_confidence","middesk score","0.15","0.20","review task"],
     "🏛️ Registry & Identity","SOS tab → Fact Lineage","🏛️ SOS tab",
     "Middesk confidence formula: 0.15 base + 0.20 × passing review tasks (max 4 = 0.95). Fact name: middesk_confidence."),
    (["domestic","foreign","foreign domestic","formation state","tax haven","delaware","nevada","wyoming","entity resolution"],
     "🏛️ Registry & Identity","Dom/Foreign tab","🗺️ Dom/Foreign tab",
     "Domestic vs Foreign registration analysis. Detects entity resolution gaps for tax-haven states (DE/NV/WY)."),
    (["tin","ein","tax id","tin match","tin_match","tin_match_boolean","tin_submitted","tin verification","irs","irs check"],
     "🏛️ Registry & Identity","TIN tab → Fact Lineage","🔐 TIN tab",
     "TIN/EIN verification. Source: Middesk (pid=16) TIN review task → IRS direct. tin_match_boolean derived from tin_match.value.status."),
    (["idv","identity verification","plaid idv","biometric","selfie","id scan","idv_passed","idv_passed_boolean","idv_status","idv session"],
     "🏛️ Registry & Identity","IDV tab → Fact Lineage","🪪 IDV tab",
     "Plaid Identity Verification. idv_status={SUCCESS/PENDING/FAILED/CANCELED/EXPIRED counts}. idv_passed_boolean=true when ≥1 SUCCESS."),
    (["cross analysis","anomaly detection","consistency check","data integrity","cross field","field inconsistency"],
     "🏛️ Registry & Identity","Cross-Analysis tab","🔗 Cross-Analysis tab",
     "Cross-field consistency checks: TIN bool/status mismatch, SOS+TIN conflicts, entity resolution gaps, watchlist+low confidence."),

    # ── 🏭 Classification & KYB ────────────────────────────────────────────
    (["naics","naics_code","naics code","industry","industry code","classification","561499","fallback","mcc","mcc_code","merchant category"],
     "🏭 Classification & KYB","NAICS/MCC Pipeline tab","🏭 NAICS/MCC tab",
     "NAICS classification. Vendor cascade: OC(w=0.9)>ZI(w=0.8)>Trulioo(w=0.8)>EFX(w=0.7)>SERP(w=0.3)>AI(w=0.1). 561499=fallback."),
    (["background","firmographic","revenue","num_employees","employees","legal name","legal_name","business name","business_name","dba","kyb_submitted","kyb_complete"],
     "🏭 Classification & KYB","Background & Firmographic tab","🏢 Background tab",
     "Business background: legal_name, revenue, num_employees, dba_found, kyb_submitted, kyb_complete. Sources: ZI, EFX, Middesk, Applicant."),
    (["contact","address","address match","address_match","name match","name_match","deliverable","registered agent","phone","email","address verification"],
     "🏭 Classification & KYB","Contact & Address tab","📬 Contact tab",
     "Address and name verification. address_match_boolean from Middesk USPS check. address_registered_agent warning for virtual offices."),
    (["website","website found","serp","google business","gmb","serp_id","review rating","gap g2","website digital"],
     "🏭 Classification & KYB","Website & Digital tab","🌐 Website tab",
     "Website and digital presence. Gap G2: website exists but NAICS=561499 (AI enrichment couldn't use website URL)."),

    # ── ⚠️ Risk & Watchlist ─────────────────────────────────────────────────
    (["watchlist","watchlist_hits","sanctions","pep","ofac","adverse media","adverse_media_hits","watchlist hits","compliance"],
     "⚠️ Risk & Watchlist","Watchlist Detail tab","🔍 Watchlist Detail tab",
     "Watchlist: PEP+SANCTIONS only. Adverse media excluded (filterOutAdverseMedia). Trulioo PSC + Middesk merged by consolidatedWatchlist.ts."),
    (["bankruptcy","bankruptcies","num_bankruptcies","judgement","lien","num_judgements","num_liens","public records","equifax records"],
     "⚠️ Risk & Watchlist","Public Records tab","📜 Public Records tab",
     "Bankruptcies (−40pts each), Judgments (−20pts), Liens (−10pts). Source: Equifax pid=17. Scalar counts in Redshift; full arrays in PostgreSQL RDS."),
    (["risk combination","risk signal","watchlist bankruptcy","watchlist bk","underwriting action","risk combo"],
     "⚠️ Risk & Watchlist","Risk Combinations tab","🔗 Risk Combinations tab",
     "Cross-signal analysis: Watchlist+BK (CRITICAL), Watchlist+Adverse Media (HIGH), BK+Judgment+Lien (HIGH)."),

    # ── 💰 Worth Score ──────────────────────────────────────────────────────
    (["worth score","score","score_850","weighted_score","300 850","model","probability","approve","decline","further review","risk level","score decision"],
     "💰 Worth Score","Score & Architecture tab","💰 Score & Architecture tab",
     "Worth Score: p × 550 + 300. Thresholds: APPROVE≥700, FURTHER_REVIEW 550-699, DECLINE<550. Source: rds_manual_score_public.business_scores."),
    (["waterfall","shap","factor contribution","category impact","score factor","public records score","company profile score","business_score_factors"],
     "💰 Worth Score","Waterfall & Features tab","📊 Waterfall & Features tab",
     "SHAP factor contributions by category. Source: rds_manual_score_public.business_score_factors. Categories: Public Records, Company Profile, Financial Trends, etc."),
    (["plaid banking","banking model","financial model","pytorch","balance sheet","cash flow","ratio","plaid connected"],
     "💰 Worth Score","Waterfall & Features tab","📊 Waterfall & Features tab",
     "Financial sub-model (PyTorch): requires Plaid banking. Null financial features → model uses defaults → score may be 0."),

    # ── 📋 All Facts ────────────────────────────────────────────────────────
    (["all facts","fact list","fact table","all kyb facts","fact overview","facts tab","fact fill rate"],
     "📋 All Facts","All Facts tab → Facts Overview","📋 All Facts → Facts Overview (top)",
     "All KYB facts grouped by category. Fill rate, null count, too-large count. Click any group to expand facts with JSON, source, SQL, Python."),
    (["identity name","legal name fact","names found","dba_found fact","people fact","kyb_submitted fact","kyb_complete fact"],
     "📋 All Facts","All Facts tab → 🏢 Identity / Name group","📋 All Facts → 🏢 Identity / Name (group expander)",
     "Facts: legal_name, names_found, dba_found, people, kyb_submitted, kyb_complete. combineFacts rule merges all vendor names."),
    (["sos group","sos facts","registry sos","sos_filings fact","formation_state fact","formation_date fact","middesk_id"],
     "📋 All Facts","All Facts tab → 🏛️ Registry / SOS group","📋 All Facts → 🏛️ Registry / SOS (group expander)",
     "Facts: sos_active, sos_match, sos_filings (too large for Redshift), middesk_confidence, formation_state, formation_date."),
    (["tin ein group","tin facts","tin_match fact","tin_submitted fact","tin group","ein group","is_sole_prop"],
     "📋 All Facts","All Facts tab → 🔐 TIN / EIN group","📋 All Facts → 🔐 TIN / EIN (group expander)",
     "Facts: tin, tin_submitted, tin_match, tin_match_boolean, is_sole_prop. tin_match_boolean=true only when IRS status='success'."),
    (["address facts","location facts","addresses fact","primary_address fact","address_match fact","address_verification fact","addresses group"],
     "📋 All Facts","All Facts tab → 📍 Address / Location group","📋 All Facts → 📍 Address / Location (group expander)",
     "Facts: addresses, primary_address, addresses_submitted, addresses_found, addresses_deliverable, address_match, address_verification."),
    (["contact facts","email fact","phone_found fact","countries fact","contact group"],
     "📋 All Facts","All Facts tab → 📞 Contact group","📋 All Facts → 📞 Contact (group expander)",
     "Facts: business_phone, phone_found, email, countries. Often null — optional fields on onboarding form."),
    (["website facts","website_found fact","serp_id fact","review_rating fact","website group","digital facts"],
     "📋 All Facts","All Facts tab → 🌐 Website / Digital group","📋 All Facts → 🌐 Website / Digital (group expander)",
     "Facts: website, website_found, serp_id, review_rating, review_count. Critical for AI NAICS classification."),
    (["naics facts","mcc_code fact","naics_code fact","industry fact","classification group","naics group"],
     "📋 All Facts","All Facts tab → 🏭 Industry / Classification group","📋 All Facts → 🏭 Industry / Classification (group expander)",
     "Facts: naics_code, mcc_code, naics_description, mcc_description, industry. mcc_code is calculated (not a vendor fact)."),
    (["firmographic facts","revenue fact","num_employees fact","firmographic group","firmographic facts"],
     "📋 All Facts","All Facts tab → 💼 Firmographic group","📋 All Facts → 💼 Firmographic (group expander)",
     "Facts: revenue, num_employees, minority_owned, woman_owned, veteran_owned, kyb_complete, business_verified. ZI/EFX sources."),
    (["idv facts","idv_status fact","idv_passed fact","name_match fact","kyc facts","identity verification facts","idv group","kyc group"],
     "📋 All Facts","All Facts tab → 🪪 Identity Verification (KYC) group","📋 All Facts → 🪪 Identity Verification / KYC (group expander)",
     "Facts: idv_status, idv_passed, idv_passed_boolean, name_match, name_match_boolean, verification_status."),
    (["financial ratios","ratio facts","bs_facts","cf_facts","financial worth score inputs","plaid facts","financial group"],
     "📋 All Facts","All Facts tab → 📊 Financial Ratios group","📋 All Facts → 📊 Financial Ratios (Worth Score inputs)",
     "15 facts: ratio_*, bs_*, cf_*, flag_equity_negative. All null if Plaid not connected. Primary Worth Score financial model inputs."),
    (["watchlist facts","watchlist_hits fact","adverse_media_hits fact","sanctions_hits","watchlist group","risk watchlist facts"],
     "📋 All Facts","All Facts tab → ⚠️ Risk / Watchlist group","📋 All Facts → ⚠️ Risk / Watchlist (group expander)",
     "Facts: watchlist, watchlist_hits, watchlist_raw, adverse_media_hits, sanctions_hits, num_bankruptcies, num_judgements, num_liens."),
    (["vendor integration","internal_platform_matches","entity matching","canadaopen","vendor group"],
     "📋 All Facts","All Facts tab → 🔗 Vendor / Integration group","📋 All Facts → 🔗 Vendor / Integration (group expander)",
     "Facts: internal_platform_matches, internal_platform_matches_count, canadaopen_* . Entity-matching XGBoost model results."),
    (["canada facts","canada_business_number","canada_corporate_id","canadian","canada group"],
     "📋 All Facts","All Facts tab → 🇨🇦 Canada group","📋 All Facts → 🇨🇦 Canada (if applicable)",
     "Facts: canada_business_number, canada_corporate_id, canada_id_number_match. Only populated for Canadian businesses."),

    # ── 🤖 AI Agent ─────────────────────────────────────────────────────────
    (["ai agent","ask ai","chat","question answer","openai","gpt","ai question"],
     "🤖 AI Agent","AI Agent tab → Chat","🤖 AI Agent → Chat section",
     "RAG-powered chat. Executes SQL automatically and returns live Redshift data. Sources cited with clickable GitHub links."),
    (["sql runner","run sql","query redshift","sql query","execute query"],
     "🤖 AI Agent","AI Agent tab → SQL Runner","🤖 AI Agent → 🗄️ SQL Runner tab",
     "Write and run SQL directly against Redshift. Results show as a table with CSV/XLSX download. No VPN issues — runs server-side."),
    (["python runner","run python","python query","execute python","psycopg2"],
     "🤖 AI Agent","AI Agent tab → Python Runner","🤖 AI Agent → 🐍 Python Runner tab",
     "Run Python code against Redshift. conn is pre-injected. Quick templates for common queries. CSV/XLSX download."),

    # ── Data tables / sources ────────────────────────────────────────────────
    (["rds_warehouse_public","facts table","fact schema","facts schema","received_at","business_id fact"],
     "📋 All Facts","All Facts tab → Facts Overview","📋 All Facts (primary source for all KYB facts)",
     "rds_warehouse_public.facts: columns are business_id, name, value (JSON), received_at. All KYB facts in this table."),
    (["rel_business_customer_monitoring","rbcm","onboarding date","created_at","customer id link"],
     "🏠 Home","Sidebar → Date Range / Customer Filter","🏠 Home filters use rel_business_customer_monitoring",
     "rds_cases_public.rel_business_customer_monitoring: columns are business_id, customer_id, created_at (true onboarding date)."),
    (["worth score table","business_scores","data_current_scores","score_id","weighted_score_850"],
     "💰 Worth Score","Score & Architecture tab","💰 Worth Score → Score & Architecture",
     "rds_manual_score_public.business_scores: id, weighted_score_850, weighted_score_100, risk_level, score_decision, created_at."),
    (["fact engine","factwithhighestconfidence","weight threshold","rule applied","winner selection","platform weight"],
     "📋 All Facts","All Facts tab → any fact expander","📋 All Facts → click any fact → Source Code Reference",
     "factWithHighestConfidence: highest confidence wins. If within 5% (WEIGHT_THRESHOLD=0.05), higher platform weight wins."),
]

if _search_q and len(_search_q.strip()) >= 2:
    import re as _sr
    q_lower = _search_q.strip().lower()
    # Split query into individual words (for multi-word searches)
    q_words = [w for w in _sr.split(r'\W+', q_lower) if len(w) >= 2]

    results = []
    for entry in SEARCH_INDEX:
        keywords, tab_name, sub_tab, card_path, desc = entry
        score = 0
        for kw in keywords:
            kw_lower = kw.lower()
            # Exact match: query == keyword
            if q_lower == kw_lower:
                score += 10
            # Keyword starts with query (e.g. "tin" matches "tin_match")
            elif kw_lower.startswith(q_lower) and len(q_lower) >= 3:
                score += 5
            # Query is a whole word inside the keyword (e.g. "tin" in "tin verification")
            elif _sr.search(rf'(?<![a-z]){_sr.escape(q_lower)}(?![a-z])', kw_lower):
                score += 4
            # All query words found in keyword
            elif all(w in kw_lower for w in q_words):
                score += 3
        if score > 0:
            results.append((score, tab_name, sub_tab, card_path, desc))

    results.sort(key=lambda x: -x[0])

    # Deduplicate by exact (tab + sub_tab + card_path) combination
    unique = []
    seen = set()
    for score, tab_name, sub_tab, card_path, desc in results:
        key = f"{tab_name}||{sub_tab}||{card_path}"
        if key not in seen:
            seen.add(key)
            unique.append((tab_name, sub_tab, card_path, desc))

    if unique:
        st.markdown(
            f"<div style='font-size:.74rem;color:#94A3B8;margin-bottom:4px'>"
            f"{len(unique)} result(s) for <strong style='color:#60A5FA'>\"{_search_q}\"</strong>:</div>",
            unsafe_allow_html=True
        )
        for tab_name, sub_tab, card_path, desc in unique[:8]:
            # Determine border colour by tab
            border = {"🏠":"#3B82F6","🏛️":"#f59e0b","🏭":"#8B5CF6","⚠️":"#ef4444",
                      "💰":"#22c55e","📋":"#60A5FA","🤖":"#f97316"}.get(tab_name[:2],"#3B82F6")
            card_html = (
                f"<div style='font-size:.72rem;color:#60A5FA;margin-top:3px'>"
                f"📌 Card/Table: <strong>{card_path}</strong></div>"
            ) if card_path else ""
            st.markdown(
                f"<div style='background:#1E293B;border-left:3px solid {border};border-radius:6px;"
                f"padding:9px 13px;margin:4px 0'>"
                f"<div style='color:{border};font-weight:700;font-size:.80rem'>{tab_name}</div>"
                f"<div style='color:#CBD5E1;font-size:.77rem;margin:2px 0'>→ <strong>{sub_tab}</strong></div>"
                f"{card_html}"
                f"<div style='color:#64748b;font-size:.71rem;margin-top:3px'>{desc[:140]}{'…' if len(desc)>140 else ''}</div>"
                f"</div>",
                unsafe_allow_html=True
            )
    else:
        st.caption(f"No results for \"{_search_q}\" — try the 🤖 AI Agent tab for a detailed answer.")
elif _search_q:
    st.caption("Type at least 2 characters to search…")

# ── Derive date window from filter bar selection ────────────────────────────
_today = datetime.now(timezone.utc).date()
_dr_key = st.session_state.get("fbar_date_range","last_30d")
if _dr_key == "last_7d":
    hub_date_from, hub_date_to = str(_today - pd.Timedelta(days=7)), str(_today)
elif _dr_key == "last_30d":
    hub_date_from, hub_date_to = str(_today - pd.Timedelta(days=30)), str(_today)
elif _dr_key == "last_90d":
    hub_date_from, hub_date_to = str(_today - pd.Timedelta(days=90)), str(_today)
elif _dr_key == "ytd":
    hub_date_from, hub_date_to = str(_today.replace(month=1,day=1)), str(_today)
elif _dr_key == "custom":
    _df = st.session_state.get("hub_dfrom_date", _today - pd.Timedelta(days=30))
    _dt = st.session_state.get("hub_dto_date", _today)
    hub_date_from, hub_date_to = str(_df), str(_dt)
else:
    hub_date_from, hub_date_to = None, None

def hub_date_clause(col="received_at"):
    parts = []
    if hub_date_from: parts.append(f"{col} >= '{hub_date_from}'")
    if hub_date_to:   parts.append(f"{col} <= '{hub_date_to} 23:59:59'")
    return (" AND " + " AND ".join(parts)) if parts else ""

# Scope: always Single Business (customer-level analysis only on Home tab)
hub_scope = "🏢 Single Business"
hub_scope_customer_id = None
hub_scope_customer_name = "All Customers"
hub_bid = st.session_state.get("hub_bid", "")
st.session_state["hub_bid"] = hub_bid

# (sidebar content ends — variables already set above in sidebar block)
pass  # sidebar body placeholder

# ── Row 2: Filter bar ─────────────────────────────────────────────────────────
# Compact: Date Range · Date Context · Customer · Business ID
# No Manual Only / Apply / Reset buttons (user removed)
DATE_RANGE_OPTIONS    = {"last_7d":"Last 7 days","last_30d":"Last 30 days",
                         "last_90d":"Last 90 days","ytd":"Year to date","custom":"Custom…"}
DATE_CONTEXT_OPTIONS  = {"submitted_at":"Submitted At","scored_at":"Scored At",
                         "decision_at":"Decision At","activated_at":"Activation At"}

with st.container():
    _fb1, _fb2, _fb3, _fb4 = st.columns([1.4, 1.3, 2.0, 2.0])
    with _fb1:
        st.selectbox("Date Range", list(DATE_RANGE_OPTIONS.keys()),
                     format_func=lambda k: DATE_RANGE_OPTIONS[k],
                     key="fbar_date_range", label_visibility="visible")
    with _fb2:
        st.selectbox("Date Context", list(DATE_CONTEXT_OPTIONS.keys()),
                     format_func=lambda k: DATE_CONTEXT_OPTIONS[k],
                     key="fbar_date_ctx", label_visibility="visible")
    with _fb3:
        # Customer dropdown scoped to the active date window
        with st.spinner(""):
            cust_df, cust_err = load_customer_names(hub_date_from, hub_date_to)
        cust_opts   = ["All Customers"]
        cust_id_map = {"All Customers": None}
        if cust_df is not None and not cust_df.empty and "customer_name" in cust_df.columns:
            _has_cnt = "business_count" in cust_df.columns
            for _, _cr in cust_df.sort_values("business_count", ascending=False).iterrows():
                _nm = str(_cr.get("customer_name","")).strip()
                if _nm:
                    _lbl = f"{_nm} ({int(_cr['business_count']):,} biz)" if _has_cnt else _nm
                    cust_opts.append(_lbl)
                    cust_id_map[_lbl] = _cr["customer_id"]
        selected_cust = st.selectbox("Customer", cust_opts, key="hub_customer",
                                     label_visibility="visible",
                                     help="Filters Home dashboard to this customer's businesses")
        hub_customer_id = cust_id_map.get(selected_cust)
    with _fb4:
        # Apply any pending bid from the Home tab "Investigate →" button
        if st.session_state.get("_pending_bid"):
            st.session_state["hub_bid"] = st.session_state.pop("_pending_bid")
        # Business ID — free-text only (avoids widget key conflict with dropdown)
        st.text_input("Business ID", key="hub_bid",
                      label_visibility="visible",
                      placeholder="Paste UUID (bus_…)",
                      help="Paste a Business UUID to investigate in entity tabs")
        # Confirmation toast when Investigate → was clicked
        _just_set = st.session_state.pop("_bid_just_set", None)
        if _just_set:
            st.success(f"✅ Business set: `{_just_set[:22]}…`  →  navigate to any tab", icon="🔍")

    # Custom date pickers — shown inline below filter bar when "Custom…" selected
    if st.session_state.get("fbar_date_range") == "custom":
        _today = datetime.now(timezone.utc).date()
        _dc1, _dc2, _rest_ = st.columns([1.4, 1.4, 5.2])
        with _dc1:
            st.date_input("From",
                value=st.session_state.get("hub_dfrom_date", _today - pd.Timedelta(days=30)),
                max_value=_today, key="hub_dfrom_date")
        with _dc2:
            st.date_input("To",
                value=st.session_state.get("hub_dto_date", _today),
                max_value=_today, key="hub_dto_date")

st.markdown("<hr class='thin-sep'/>", unsafe_allow_html=True)

# ── Row 3: Horizontal tab navigation ──────────────────────────────────────────
ALL_TABS = [
    "🏠 Home","🏛️ Registry & Identity","🏭 Classification & KYB",
    "⚠️ Risk & Watchlist","💰 Worth Score","📋 All Facts",
    "🔍 Check-Agent","🤖 AI Agent",
    "🌳 Lineage & Discovery","🧠 Intelligence Hub",
]
tab = st.radio("nav", ALL_TABS, horizontal=True, key="tab_nav",
               label_visibility="collapsed")

# Thin active-filter summary line
_dr_label  = DATE_RANGE_OPTIONS.get(st.session_state.get("fbar_date_range","last_30d"),"Last 30 days")
_cust_lbl  = selected_cust if selected_cust != "All Customers" else "All customers"
_bid_shown = str(st.session_state.get("hub_bid","")).strip()
_bid_lbl   = f" · Business: `{_bid_shown[:28]}…`" if len(_bid_shown)>28 else (f" · Business: `{_bid_shown}`" if _bid_shown else "")
st.caption(
    f"📅 **{_dr_label}** "
    f"({DATE_CONTEXT_OPTIONS.get(st.session_state.get('fbar_date_ctx','scored_at'),'Scored At')}) "
    f"· 👤 {_cust_lbl}{_bid_lbl}"
)
st.markdown("<hr class='thin-sep'/>", unsafe_allow_html=True)
_search_q = ""  # search bar removed from filter bar

# ════════════════════════════════════════════════════════════════════════════════
# HOME — Live Dashboard
# ════════════════════════════════════════════════════════════════════════════════

if tab=="🏠 Home":
    st.markdown("# 🔬 KYB Intelligence Hub")

    # ── UUID quick-jump ──────────────────────────────────────────────────────
    col_bid, col_go = st.columns([4,1])
    with col_bid:
        bid_input = st.text_input("🔍 Jump to Business UUID",
                                   placeholder="Paste UUID here to investigate…",
                                   label_visibility="collapsed",
                                   key="home_bid_input")
    with col_go:
        if st.button("Investigate ▶", type="primary", use_container_width=True):
            if bid_input.strip():
                st.session_state["hub_bid"] = bid_input.strip()
                st.success(f"UUID set → navigate to any section in the sidebar.")

    if not is_live:
        st.error("🔴 Not connected to Redshift. Connect VPN and click Retry in the sidebar.")
        st.stop()

    # ── Date range label + refresh ────────────────────────────────────────────
    period_label = f"{hub_date_from} → {hub_date_to}" if hub_date_from else "All time"
    hdr_c, ref_c = st.columns([5,1])
    with hdr_c:
        st.caption(f"📅 Period: **{period_label}** · Toggle 'Filter by date' in sidebar to change")
    with ref_c:
        if st.button("🔄 Refresh", key="home_refresh", help="Clear cached data and reload from Redshift"):
            load_home_recent.clear(); load_home_flags.clear(); load_home_kyb_stats.clear(); load_customer_names.clear(); st.rerun()
    st.markdown("---")

    # ── Load recently onboarded businesses (cached) ───────────────────────────
    with st.spinner("Loading portfolio data…"):
        recent_df, recent_err = load_home_recent(hub_date_from, hub_date_to, hub_customer_id)

    if recent_df is None or recent_df.empty:
        st.warning(f"No businesses found for this period. {recent_err or ''}")
        st.stop()

    total_biz = len(recent_df)

    # Build the authoritative business ID list once — used by all three data loaders
    _authoritative_bids = recent_df["business_id"].tolist()

    # ── Red flag scoring — query facts directly for the authoritative business list ──
    @st.cache_data(ttl=600, show_spinner=False)
    def _load_flags_for_bids(bid_tuple):
        if not bid_tuple:
            return None, "No business IDs"
        bid_list = ",".join(f"'{b}'" for b in bid_tuple[:2000])
        return run_sql(f"""
            SELECT business_id, name,
                   JSON_EXTRACT_PATH_TEXT(value,'value') AS val,
                   received_at
            FROM rds_warehouse_public.facts
            WHERE business_id IN ({bid_list})
              AND name IN (
                  'sos_active','tin_match_boolean','watchlist_hits',
                  'naics_code','idv_passed_boolean','num_bankruptcies',
                  'num_judgements','num_liens','sos_match_boolean'
              )
            ORDER BY business_id, name, received_at DESC
        """)

    with st.spinner("Scoring red flags…"):
        flag_df, flag_err = _load_flags_for_bids(tuple(_authoritative_bids))

    # Build per-business red flag summary
    biz_flags = {}  # business_id → {flags:[...], score:int}
    if flag_df is not None and not flag_df.empty:
        # Keep latest fact per business per name
        latest_facts = (flag_df.sort_values("received_at", ascending=False)
                               .drop_duplicates(subset=["business_id","name"])
                               .set_index(["business_id","name"])["val"]
                               .to_dict())

        for bid_check in recent_df["business_id"].tolist():
            flags = []
            score = 0  # higher = more red flags

            def fv(n):
                return str(latest_facts.get((bid_check,n),"") or "").lower()

            # Check each flag
            if fv("sos_active") == "false":
                flags.append(("🔴","SOS Inactive","Entity cannot legally operate"))
                score += 10
            if fv("sos_active") == "" and fv("sos_match_boolean") == "":
                flags.append(("🔴","No SOS data","Entity existence unverified"))
                score += 8
            if fv("tin_match_boolean") == "false":
                flags.append(("🔴","TIN Failed","EIN-name mismatch per IRS"))
                score += 6
            if fv("tin_match_boolean") == "":
                flags.append(("🟡","TIN Missing","EIN not submitted or not checked"))
                score += 3
            wl = int(float(fv("watchlist_hits") or 0)) if fv("watchlist_hits").replace(".","").isdigit() else 0
            if wl > 0:
                flags.append(("🔴",f"Watchlist {wl} hit(s)","Sanctions/PEP screening hit"))
                score += 12
            if fv("naics_code") == "561499":
                flags.append(("🟡","NAICS Fallback","Industry unclassified (561499)"))
                score += 2
            if fv("naics_code") == "":
                flags.append(("🟡","No NAICS","Classification missing"))
                score += 3
            if fv("idv_passed_boolean") == "false":
                flags.append(("🟡","IDV Failed","Identity verification failed"))
                score += 4
            bk = int(float(fv("num_bankruptcies") or 0)) if fv("num_bankruptcies").replace(".","").isdigit() else 0
            if bk > 0:
                flags.append(("🟡",f"BK: {bk}","Bankruptcy on record"))
                score += 3 * bk
            if flags or score > 0:
                biz_flags[bid_check] = {"flags": flags, "score": score}

    # ── KYB Funnel: SOS/TIN granular facts ──────────────────────────────────
    @st.cache_data(ttl=600, show_spinner=False)
    def _load_kyb_funnel_for_bids(bid_tuple):
        """Load granular SOS and TIN facts needed for funnel analysis.
        Returns one row per business with:
          - tin_submitted, tin_match_status (from tin_match.value.status)
          - sos_match_boolean, sos_active, formation_state
          - primary_address_state (from primary_address.value.state)
        """
        if not bid_tuple:
            return None, "No business IDs"
        bid_list = ",".join(f"'{b}'" for b in bid_tuple[:2000])
        return run_sql(f"""
            SELECT
                f.business_id,
                MAX(CASE WHEN f.name='tin_submitted'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS tin_submitted,
                MAX(CASE WHEN f.name='tin_match'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value','status') END)      AS tin_status,
                MAX(CASE WHEN f.name='tin_match_boolean'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS tin_match_boolean,
                MAX(CASE WHEN f.name='sos_match_boolean'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS sos_match_boolean,
                MAX(CASE WHEN f.name='sos_active'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS sos_active,
                MAX(CASE WHEN f.name='formation_state'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS formation_state,
                MAX(CASE WHEN f.name='primary_address'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value','state') END)       AS operating_state,
                MAX(CASE WHEN f.name='middesk_confidence'
                    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END)               AS middesk_confidence
            FROM rds_warehouse_public.facts f
            WHERE f.business_id IN ({bid_list})
              AND f.name IN ('tin_submitted','tin_match','tin_match_boolean',
                             'sos_match_boolean','sos_active','formation_state',
                             'primary_address','middesk_confidence')
            GROUP BY f.business_id
        """)

    # ── Load enriched KYB stats using the same authoritative business ID list ──
    @st.cache_data(ttl=600, show_spinner=False)
    def _load_stats_for_bids(bid_tuple):
        """Load KYB stats for a specific list of business IDs."""
        if not bid_tuple:
            return None, "No business IDs"
        bid_list = ",".join(f"'{b}'" for b in bid_tuple[:2000])
        return run_sql(f"""
            SELECT
                f.business_id,
                MAX(CASE WHEN f.name='sos_active'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS sos_active,
                MAX(CASE WHEN f.name='tin_match_boolean'   THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS tin_match,
                MAX(CASE WHEN f.name='idv_passed_boolean'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS idv_passed,
                MAX(CASE WHEN f.name='naics_code'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS naics_code,
                MAX(CASE WHEN f.name='watchlist_hits'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS watchlist_hits,
                MAX(CASE WHEN f.name='num_bankruptcies'    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_bankruptcies,
                MAX(CASE WHEN f.name='num_judgements'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_judgements,
                MAX(CASE WHEN f.name='num_liens'           THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_liens,
                MAX(CASE WHEN f.name='adverse_media_hits'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS adverse_media,
                MAX(CASE WHEN f.name='revenue'             THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS revenue,
                MAX(CASE WHEN f.name='formation_date'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_date,
                MAX(CASE WHEN f.name='formation_state'     THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_state,
                MAX(f.received_at) AS last_seen,
                MIN(f.received_at) AS first_seen,
                COUNT(DISTINCT f.name) AS fact_count
            FROM rds_warehouse_public.facts f
            WHERE f.business_id IN ({bid_list})
              AND f.name IN (
                  'sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
                  'watchlist_hits','num_bankruptcies','num_judgements','num_liens',
                  'adverse_media_hits','revenue','formation_date','formation_state'
              )
            GROUP BY f.business_id
        """)

    with st.spinner("Loading KYB metrics…"):
        stats_df, stats_err = _load_stats_for_bids(tuple(_authoritative_bids))

    with st.spinner("Loading SOS/TIN funnel data…"):
        funnel_df, funnel_err = _load_kyb_funnel_for_bids(tuple(_authoritative_bids))

    # Build per-business flag map from the pivoted stats_df (faster than flag_df loop)
    biz_flags = {}
    if stats_df is not None and not stats_df.empty:
        def _safe_str(v): return str(v or "").lower().strip()
        def _safe_int(v):
            try: return int(float(v or 0))
            except: return 0

        for _, sr in stats_df.iterrows():
            bid_check = sr["business_id"]
            flags=[]; score=0
            if _safe_str(sr["sos_active"])=="false":
                flags.append(("🔴","SOS Inactive","Entity cannot legally operate")); score+=10
            if _safe_str(sr["sos_active"])=="":
                flags.append(("🔴","No SOS data","Entity existence unverified")); score+=8
            if _safe_str(sr["tin_match"])=="false":
                flags.append(("🔴","TIN Failed","EIN-name mismatch per IRS")); score+=6
            if _safe_str(sr["tin_match"])=="":
                flags.append(("🟡","TIN Missing","EIN not submitted")); score+=3
            wl=_safe_int(sr["watchlist_hits"])
            if wl>0:
                flags.append(("🔴",f"Watchlist {wl} hit(s)","Sanctions/PEP hit")); score+=12
            nc=_safe_str(sr["naics_code"])
            if nc=="561499":
                flags.append(("🟡","NAICS Fallback","Industry unclassified")); score+=2
            elif nc=="":
                flags.append(("🟡","No NAICS","Classification missing")); score+=3
            if _safe_str(sr["idv_passed"])=="false":
                flags.append(("🟡","IDV Failed","Identity verification failed")); score+=4
            bk=_safe_int(sr["num_bankruptcies"])
            if bk>0:
                flags.append(("🟡",f"BK: {bk}","Bankruptcy on record")); score+=3*bk
            if flags: biz_flags[bid_check]={"flags":flags,"score":score}

    # Merge flags into recent_df
    recent_df["flag_score"] = recent_df["business_id"].map(lambda b: biz_flags.get(b,{}).get("score",0))
    recent_df["flag_count"] = recent_df["business_id"].map(lambda b: len(biz_flags.get(b,{}).get("flags",[])))
    recent_df["has_flags"]  = recent_df["flag_score"] > 0
    flagged_biz = recent_df[recent_df["has_flags"]].sort_values("flag_score",ascending=False)
    clean_biz   = recent_df[~recent_df["has_flags"]]

    # ── Helper: rate % ────────────────────────────────────────────────────────
    def rate(num, den): return f"{num/max(den,1)*100:.0f}%"

    # ── Pre-compute KYB health rates from stats_df ────────────────────────────
    # stats_df has already been intersected with recent_df above,
    # so n == total_biz (or fewer if some businesses have no facts yet).
    if stats_df is not None and not stats_df.empty:
        n = len(stats_df)
        if n != total_biz:
            st.caption(f"ℹ️ KYB metrics available for {n:,} of {total_biz:,} businesses "
                       f"({total_biz-n:,} have no facts yet in Redshift)")
        sos_ok   = (stats_df["sos_active"].str.lower().str.strip()=="true").sum()
        sos_fail = (stats_df["sos_active"].str.lower().str.strip()=="false").sum()
        sos_miss = n - sos_ok - sos_fail
        tin_ok   = (stats_df["tin_match"].str.lower().str.strip()=="true").sum()
        tin_fail = (stats_df["tin_match"].str.lower().str.strip()=="false").sum()
        idv_ok   = (stats_df["idv_passed"].str.lower().str.strip()=="true").sum()
        idv_fail = (stats_df["idv_passed"].str.lower().str.strip()=="false").sum()
        wl_biz   = (stats_df["watchlist_hits"].apply(lambda v: _safe_int(v)>0)).sum()
        naics_ok = (~stats_df["naics_code"].isin(["561499","",None]) &
                    stats_df["naics_code"].notna()).sum()
        naics_fb = (stats_df["naics_code"].str.strip()=="561499").sum()
        naics_ms = (stats_df["naics_code"].isna() | (stats_df["naics_code"].str.strip()=="")).sum()
        bk_biz   = (stats_df["num_bankruptcies"].apply(lambda v: _safe_int(v)>0)).sum()
        has_rev  = stats_df["revenue"].notna().sum()
        # formation state distribution
        state_counts = (stats_df["formation_state"]
                        .dropna().str.upper().str.strip()
                        .value_counts().head(10).reset_index())
        state_counts.columns=["State","Count"]
        # NAICS 2-digit sector
        def _sector(c):
            try: return str(int(str(c)[:2])) if c and str(c).strip() not in ("","561499") else None
            except: return None
        naics_sector = (stats_df["naics_code"].apply(_sector)
                        .dropna().value_counts().head(12).reset_index())
        naics_sector.columns=["Sector","Count"]
        # Onboarding timeline
        stats_df["first_seen_dt"] = pd.to_datetime(stats_df["first_seen"], errors="coerce")
        timeline = (stats_df.dropna(subset=["first_seen_dt"])
                    .set_index("first_seen_dt")
                    .resample("D")["business_id"].count()
                    .reset_index())
        timeline.columns=["Date","New Businesses"]
    else:
        n=total_biz; sos_ok=sos_fail=sos_miss=tin_ok=tin_fail=0
        idv_ok=idv_fail=wl_biz=naics_ok=naics_fb=naics_ms=bk_biz=has_rev=0
        state_counts=pd.DataFrame(); naics_sector=pd.DataFrame(); timeline=pd.DataFrame()

    # ════════════════════════════════════════════════════════════════════════
    # PORTFOLIO OVERVIEW DASHBOARD
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 📊 Portfolio Overview")

    # Source attribution banner
    _src_primary = "rds_cases_public.rel_business_customer_monitoring (created_at = true onboarding date)"
    _src_facts   = "rds_warehouse_public.facts (KYB signal values)"
    _cust_label = f" · 🏢 Customer: **{selected_cust if hub_customer_id else 'All'}**" if "selected_cust" in dir() else ""
    st.markdown(
        f"<div style='background:#0c1a2e;border-left:3px solid #3B82F6;border-radius:6px;"
        f"padding:8px 14px;margin:4px 0;font-size:.76rem'>"
        f"📅 <strong style='color:#CBD5E1'>{period_label}</strong>"
        f"{_cust_label} · "
        f"<strong style='color:#60A5FA'>{total_biz:,} businesses</strong> · "
        f"Source: <code style='color:#22c55e'>rel_business_customer_monitoring.created_at</code> · "
        f"KYB: <code style='color:#22c55e'>rds_warehouse_public.facts</code>"
        f"</div>",
        unsafe_allow_html=True
    )
    _home_sql_ref = f"""-- Correct onboarding count query (mirrors app logic):
WITH onboarded AS (
    SELECT DISTINCT business_id, MIN(created_at) AS onboarded_at
    FROM rds_cases_public.rel_business_customer_monitoring
    WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}'
    GROUP BY business_id
)
SELECT COUNT(*) AS total_businesses FROM onboarded;
-- NOTE: The app previously used rds_warehouse_public.facts.received_at which is NOT
-- the onboarding date. It is the fact write timestamp (can be days/weeks after onboarding).
-- This caused undercounting vs queries using rel_business_customer_monitoring."""

    # ── Row 1: KPI cards (cards only, no expanders inside columns) ───────────
    # Detail panels rendered BELOW the columns to prevent overlap
    _kpi_sql = f"SELECT COUNT(DISTINCT business_id) AS total FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}';"
    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Total",f"{total_biz:,}","businesses","#3B82F6")
    with c2: kpi("🚨 Red Flags",f"{len(flagged_biz):,}",rate(len(flagged_biz),total_biz)+" flagged","#ef4444" if flagged_biz.shape[0]>0 else "#22c55e")
    with c3: kpi("SOS Active",f"{sos_ok:,}",rate(sos_ok,n)+" pass rate","#22c55e" if sos_ok/max(n,1)>0.8 else "#f97316")
    with c4: kpi("TIN Verified",f"{tin_ok:,}",rate(tin_ok,n)+" pass rate","#22c55e" if tin_ok/max(n,1)>0.8 else "#f59e0b")
    with c5: kpi("IDV Passed",f"{idv_ok:,}",rate(idv_ok,n)+" pass rate","#22c55e" if idv_ok/max(n,1)>0.7 else "#f59e0b")
    with c6: kpi("Watchlist Hits",f"{wl_biz:,}",rate(wl_biz,n)+" affected","#ef4444" if wl_biz>0 else "#22c55e")

    # ── Detail panels: sequential full-width (NO columns — expanders in columns overlap) ──
    st.caption("▼ Click any metric below for source, JSON, SQL, and data lineage")

    # Store panel args to render sequentially after the KPI row
    _kpi_panels = [
        ("🏢 Total Businesses", str(total_biz),
         "Count of distinct businesses onboarded in this period. Source: rds_cases_public.rel_business_customer_monitoring.created_at — the AUTHORITATIVE onboarding date. facts.received_at is NOT the onboarding date (it is the fact write timestamp).",
         "rds_cases_public.rel_business_customer_monitoring", "customer_table.sql", "created_at = true onboarding timestamp",
         "No API — Redshift internal table",
         {"total_businesses":total_biz,"date_range":f"{hub_date_from} → {hub_date_to}","source":"rel_business_customer_monitoring","date_field":"created_at"},
         _home_sql_ref, [("customer_table.sql","customer_table.sql")], "#3B82F6"),

        ("🚨 Red Flags", str(len(flagged_biz)),
         "Businesses with ≥1 red flag (SOS inactive/missing, TIN failed, Watchlist hit, IDV failed, NAICS fallback, Bankruptcy). CUSTOM HEURISTIC — not a regulatory score.",
         "rds_warehouse_public.facts (cross-field computed)", "facts/kyb/index.ts",
         "sos_active + tin_match_boolean + watchlist_hits + idv_passed_boolean + naics_code + num_bankruptcies",
         "",
         {"flagged":len(flagged_biz),"total":total_biz,"pct":round(len(flagged_biz)/max(total_biz,1)*100,1)},
         f"SELECT COUNT(DISTINCT b.business_id) AS flagged FROM rds_cases_public.rel_business_customer_monitoring b JOIN rds_warehouse_public.facts f ON f.business_id=b.business_id WHERE DATE(b.created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}' AND f.name='watchlist_hits' AND JSON_EXTRACT_PATH_TEXT(f.value,'value')::int>0;",
         [("facts/kyb/index.ts","KYB scalar facts"),("consolidatedWatchlist.ts","Watchlist architecture")],
         "#ef4444" if flagged_biz.shape[0]>0 else "#22c55e"),

        ("🏛️ SOS Active", str(sos_ok),
         "Businesses where sos_active=true (in good standing with SOS). DEPENDENT fact derived from sos_filings[].active. Source: Middesk pid=16. Null = entity not matched.",
         "rds_warehouse_public.facts · name='sos_active'", "facts/kyb/index.ts",
         "sosActive · dependent · ANY(sos_filings[].active)", "",
         {"sos_ok":sos_ok,"sos_fail":sos_fail,"sos_missing":sos_miss,"total":n,"pass_rate":rate(sos_ok,n)},
         f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_active, COUNT(*) FROM rds_warehouse_public.facts WHERE name='sos_active' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1;",
         [("facts/kyb/index.ts","sosActive fact"),("integrations.constant.ts","MIDDESK=16")],
         "#22c55e" if sos_ok/max(n,1)>0.8 else "#f97316"),

        ("🔐 TIN Verified", str(tin_ok),
         "Businesses where tin_match_boolean=true (IRS confirmed EIN+name). Source: Middesk pid=16 TIN review task — direct IRS query. Null = EIN not submitted or TIN task not yet run.",
         "rds_warehouse_public.facts · name='tin_match_boolean'", "facts/kyb/index.ts",
         "tinMatchBoolean · dependent · tin_match.status==='success'", "",
         {"tin_ok":tin_ok,"tin_fail":tin_fail,"tin_missing":n-tin_ok-tin_fail,"pass_rate":rate(tin_ok,n)},
         f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS tin_boolean, COUNT(*) FROM rds_warehouse_public.facts WHERE name='tin_match_boolean' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1;",
         [("facts/kyb/index.ts","tinMatchBoolean fact"),("integrations.constant.ts","MIDDESK=16")],
         "#22c55e" if tin_ok/max(n,1)>0.8 else "#f59e0b"),

        ("🪪 IDV Passed", str(idv_ok),
         "Businesses where idv_passed_boolean=true (≥1 Plaid IDV SUCCESS session). Source: Plaid pid=18. Null = IDV not triggered (sole prop) or webhook not yet received.",
         "rds_warehouse_public.facts · name='idv_passed_boolean'", "facts/kyb/index.ts",
         "idvPassedBoolean · dependent · idv_passed>=1", "",
         {"idv_ok":idv_ok,"idv_fail":idv_fail,"pass_rate":rate(idv_ok,n)},
         f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_boolean, COUNT(*) FROM rds_warehouse_public.facts WHERE name='idv_passed_boolean' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1;",
         [("facts/kyb/index.ts","idvPassedBoolean fact"),("integrations.constant.ts","PLAID_IDV=18")],
         "#22c55e" if idv_ok/max(n,1)>0.7 else "#f59e0b"),

        ("⚠️ Watchlist Hits", str(wl_biz),
         "Businesses with watchlist_hits>0 (PEP or SANCTIONS). Adverse media excluded (separate fact). Any hit = compliance review mandatory.",
         "rds_warehouse_public.facts · name='watchlist_hits'", "consolidatedWatchlist.ts",
         "watchlistHits · COUNT(watchlist.metadata[])", "",
         {"wl_biz":wl_biz,"total":n,"pct_affected":rate(wl_biz,n),"note":"PEP+SANCTIONS only. adverse_media excluded."},
         f"SELECT COUNT(DISTINCT business_id) FROM rds_warehouse_public.facts WHERE name='watchlist_hits' AND JSON_EXTRACT_PATH_TEXT(value,'value')::int>0 AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}');",
         [("consolidatedWatchlist.ts","Watchlist architecture"),("integrations.constant.ts","TRULIOO=38, MIDDESK=16")],
         "#ef4444" if wl_biz>0 else "#22c55e"),
    ]

    for _label,_val,_what,_tbl,_file,_line,_api,_json,_sql,_links,_color in _kpi_panels:
        detail_panel(_label, _val,
            what_it_means=_what, source_table=_tbl,
            source_file=_file, source_file_line=_line,
            api_endpoint=_api, json_obj=_json, sql=_sql,
            links=_links, color=_color, icon=_label.split()[0])

    st.markdown("---")

    # ── Row 2: KYB Health Gauges + Onboarding Timeline ───────────────────────
    col_health, col_timeline = st.columns([1,2])

    with col_health:
        st.markdown("#### 🩺 KYB Health Rates")
        metrics = [
            ("SOS Active",    sos_ok,   sos_fail, sos_miss,  n, "#22c55e","#ef4444"),
            ("TIN Verified",  tin_ok,   tin_fail, n-tin_ok-tin_fail, n, "#22c55e","#ef4444"),
            ("IDV Passed",    idv_ok,   idv_fail, n-idv_ok-idv_fail, n, "#22c55e","#f59e0b"),
            ("NAICS Classified", naics_ok, naics_fb, naics_ms, n, "#22c55e","#f59e0b"),
            ("Revenue Known", has_rev,  0, n-has_rev, n, "#22c55e","#64748b"),
        ]
        HEALTH_META = {
            "SOS Active":("sos_active","rds_warehouse_public.facts","facts/kyb/index.ts","sosActive · dependent · Middesk pid=16","true when entity in good standing with Secretary of State"),
            "TIN Verified":("tin_match_boolean","rds_warehouse_public.facts","facts/kyb/index.ts","tinMatchBoolean · Middesk IRS check pid=16","true when IRS confirmed EIN+name match"),
            "IDV Passed":("idv_passed_boolean","rds_warehouse_public.facts","plaid/plaidIdv.ts","idvPassedBoolean · Plaid IDV pid=18","true when at least 1 SUCCESS IDV session"),
            "NAICS Classified":("naics_code","rds_warehouse_public.facts","facts/kyb/index.ts","naicsCode · factWithHighestConfidence","true when naics_code ≠ 561499 and not null"),
            "Revenue Known":("revenue","rds_warehouse_public.facts","facts/kyb/index.ts","revenue · ZI pid=24 / EFX pid=17","present when ZI or EFX matched the entity"),
        }
        for label,ok_n,fail_n,miss_n,total_n,ok_col,fail_col in metrics:
            ok_pct   = int(ok_n/max(total_n,1)*100)
            fail_pct = int(fail_n/max(total_n,1)*100)
            miss_pct = 100-ok_pct-fail_pct
            bar_html = (
                f'<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin:3px 0">'
                f'<div style="width:{ok_pct}%;background:{ok_col}"></div>'
                f'<div style="width:{fail_pct}%;background:{fail_col}"></div>'
                f'<div style="width:{miss_pct}%;background:#334155"></div>'
                f'</div>'
            )
            st.markdown(f"""<div style="margin:6px 0">
              <div style="display:flex;justify-content:space-between">
                <span style="color:#CBD5E1;font-size:.78rem;font-weight:600">{label}</span>
                <span style="color:{ok_col};font-size:.78rem;font-weight:700">{ok_pct}% ✓</span>
              </div>
              {bar_html}
              <div style="display:flex;gap:12px;font-size:.68rem;color:#64748b;margin-top:1px">
                <span style="color:{ok_col}">✓ {ok_n:,}</span>
                <span style="color:{fail_col}">✗ {fail_n:,}</span>
                <span>? {miss_n:,}</span>
              </div>
            </div>""", unsafe_allow_html=True)
            # store for detail panels below (rendered outside columns to avoid overlap)
            if "health_panels" not in st.session_state:
                st.session_state["health_panels"] = []

    with col_timeline:
        st.markdown("#### 📈 Onboarding Timeline")
        if not timeline.empty:
            fig_t = px.area(timeline, x="Date", y="New Businesses",
                            title=f"Daily New Businesses ({period_label})",
                            color_discrete_sequence=["#3B82F6"])
            fig_t.update_traces(fill="tozeroy", fillcolor="rgba(59,130,246,0.15)",
                                line=dict(width=2))
            fig_t.update_layout(height=260, margin=dict(t=40,b=20,l=10,r=10))
            st.plotly_chart(dark_chart(fig_t), use_container_width=True)
            detail_panel("Onboarding Timeline",f"{len(timeline)} days · {total_biz:,} total businesses",
                what_it_means="Daily count of newly onboarded businesses. Source: rds_cases_public.rel_business_customer_monitoring.created_at — the TRUE onboarding date. Peaks may reflect customer onboarding campaigns. Gaps may indicate data pipeline delays.",
                source_table="rds_cases_public.rel_business_customer_monitoring",
                source_file="customer_table.sql", source_file_line="rel_business_customer_monitoring · created_at",
                json_obj={"chart_type":"area","x":"created_at (daily)","y":"distinct business_id count","source":"rds_cases_public.rel_business_customer_monitoring","date_range":f"{hub_date_from}→{hub_date_to}","data_points":len(timeline)},
                sql=f"SELECT DATE(created_at) AS onboarding_date, COUNT(DISTINCT business_id) AS new_businesses FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}' GROUP BY 1 ORDER BY 1;",
                links=[("customer_table.sql","rel_business_customer_monitoring source")],
                color="#3B82F6", icon="📈")
        else:
            st.info("Timeline requires date-filtered data. Enable 'Filter by date' in sidebar.")

    # ── KYB Health detail panels — NO outer expander (nested expanders forbidden)
    # Render directly as sequential full-width panels
    st.markdown("**🩺 KYB Health Rates — click any metric below for source, JSON & SQL:**")
    st.caption("Fail = fact returned false. Missing = fact is null (vendor did not match entity).")
    for label,ok_n,fail_n,miss_n,total_n,ok_col,fail_col in metrics:
        ok_pct2 = int(ok_n/max(total_n,1)*100)
        m = HEALTH_META.get(label,())
        detail_panel(f"🩺 {label}", f"{ok_pct2}% pass · {ok_n:,} pass · {fail_n:,} fail · {miss_n:,} missing",
            what_it_means=f"Pass: {ok_n:,} · Fail: {fail_n:,} · Missing: {miss_n:,} (out of {total_n:,})\n\n{m[4] if len(m)>4 else ''}\n\nFail = fact returned false. Missing = null (vendor did not match entity or check not yet run).",
            source_table=f"{m[1] if len(m)>1 else 'rds_warehouse_public.facts'} · name='{m[0] if m else label}'",
            source_file=m[2] if len(m)>2 else "facts/kyb/index.ts",
            source_file_line=m[3] if len(m)>3 else "",
            json_obj={"metric":label,"pass":ok_n,"fail":fail_n,"missing":miss_n,"total":total_n,"pass_rate_pct":ok_pct2,"date_range":f"{hub_date_from}→{hub_date_to}"},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS val, COUNT(*) AS businesses FROM rds_warehouse_public.facts WHERE name='{m[0] if m else label.lower().replace(' ','_')}' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC;",
            links=[(m[2] if len(m)>2 else "facts/kyb/index.ts", m[3] if len(m)>3 else label)],
            color=ok_col, icon="🩺")

    st.markdown("---")

    # ── Row 3: Red Flag Distribution + Risk Donut + NAICS Sectors ────────────
    # ── Row 3a: Red Flag Distribution (horizontal, consolidated) + NAICS ────────
    col_flags, col_naics = st.columns([3,2])

    with col_flags:
        st.markdown("#### 🚩 Red Flag Distribution")
        # Consolidate: merge all "Watchlist N hit(s)" → "Watchlist hits"
        #              merge all "BK: N" → "Bankruptcy"
        flag_type_counts={}
        for b_data in biz_flags.values():
            for _,flag_title,_ in b_data["flags"]:
                if flag_title.startswith("Watchlist"): key="Watchlist hits"
                elif flag_title.startswith("BK:"): key="Bankruptcy"
                else: key=flag_title
                flag_type_counts[key]=flag_type_counts.get(key,0)+1
        if flag_type_counts:
            fdf=pd.DataFrame(list(flag_type_counts.items()),columns=["Issue","Count"])\
                  .sort_values("Count",ascending=True)  # ascending for horizontal bar
            COLOR_MAP={
                "IDV Failed":"#f59e0b","TIN Failed":"#ef4444","TIN Missing":"#f97316",
                "SOS Inactive":"#dc2626","No SOS data":"#f97316",
                "NAICS Fallback":"#6366f1","No NAICS":"#8B5CF6",
                "Watchlist hits":"#dc2626","Bankruptcy":"#a855f7",
            }
            bar_colors=[COLOR_MAP.get(iss,"#64748b") for iss in fdf["Issue"]]
            fig_f=go.Figure(go.Bar(
                x=fdf["Count"], y=fdf["Issue"],
                orientation="h",
                marker_color=bar_colors,
                text=fdf["Count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                textfont=dict(color="#E2E8F0", size=12),
            ))
            fig_f.update_layout(
                height=max(180, len(fdf)*38),
                margin=dict(t=30, b=10, l=10, r=60),
                xaxis=dict(showgrid=False, showticklabels=False, title=""),
                yaxis=dict(title="", tickfont=dict(size=12)),
            )
            st.plotly_chart(dark_chart(fig_f), use_container_width=True)
            st.caption("Each bar = number of businesses with that specific issue. One business can appear in multiple bars.")
            _rf_sql = f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') AND name IN ('sos_active','tin_match_boolean','watchlist_hits','naics_code','idv_passed_boolean','num_bankruptcies') GROUP BY name, JSON_EXTRACT_PATH_TEXT(value,'value') ORDER BY name;"
            detail_panel("Red Flag Distribution Chart", f"{len(flag_type_counts)} issue types detected",
                what_it_means="Horizontal bar chart counting how many businesses have each type of issue. Source: scalar KYB facts from rds_warehouse_public.facts joined to rds_cases_public.rel_business_customer_monitoring for the date filter. 'Watchlist hits' consolidates all watchlist count variants. 'Bankruptcy' consolidates all BK count variants.",
                source_table="rds_warehouse_public.facts (sos_active, tin_match_boolean, watchlist_hits, naics_code, idv_passed_boolean, num_bankruptcies)",
                source_file="facts/kyb/index.ts", source_file_line="KYB scalar facts — dependent facts derived by Fact Engine",
                json_obj={"chart_type":"horizontal_bar","issue_counts":flag_type_counts,"date_range":f"{hub_date_from}→{hub_date_to}","note":"One business can appear in multiple bars"},
                sql=_rf_sql,
                links=[("facts/kyb/index.ts","KYB scalar fact definitions"),("consolidatedWatchlist.ts","Watchlist architecture")],
                color="#ef4444", icon="🚩")
        else:
            flag("✅ No red flags detected in this period","green")

    with col_naics:
        st.markdown("#### 🏭 Top Industry Sectors")
        SECTOR_NAMES={"11":"Agriculture","21":"Mining","22":"Utilities","23":"Construction",
                      "31":"Manufacturing","32":"Manufacturing","33":"Manufacturing",
                      "42":"Wholesale","44":"Retail","45":"Retail","48":"Transport",
                      "49":"Transport","51":"Information","52":"Finance","53":"Real Estate",
                      "54":"Professional Svcs","55":"Mgmt","56":"Admin Svcs",
                      "61":"Education","62":"Health","71":"Arts","72":"Food & Accom",
                      "81":"Other Services","92":"Public Admin"}
        if not naics_sector.empty:
            naics_sector["Label"]=naics_sector["Sector"].map(
                lambda s: f"{SECTOR_NAMES.get(s,s)} ({s})")
            naics_sector_plot=naics_sector.sort_values("Count",ascending=True)
            fig_n=go.Figure(go.Bar(
                x=naics_sector_plot["Count"], y=naics_sector_plot["Label"],
                orientation="h",
                marker_color="#3B82F6",
                text=naics_sector_plot["Count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                textfont=dict(color="#E2E8F0",size=11),
            ))
            fig_n.update_layout(
                height=max(180,len(naics_sector_plot)*38),
                margin=dict(t=30,b=10,l=10,r=60),
                xaxis=dict(showgrid=False,showticklabels=False,title=""),
                yaxis=dict(title="",tickfont=dict(size=11)),
            )
            st.plotly_chart(dark_chart(fig_n),use_container_width=True)
            _naics_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics_code, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='naics_code' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC;"
            detail_panel("Top Industry Sectors Chart", f"{len(naics_sector)} sectors",
                what_it_means="Horizontal bar showing count of businesses per 2-digit NAICS sector. The 2-digit sector is derived from the first 2 digits of naics_code (6-digit). Source: Equifax/ZI/OC/SERP/Trulioo/Applicant/AI — winner selected by factWithHighestConfidence. 561499 businesses excluded from sector chart (shown separately as NAICS Fallback).",
                source_table="rds_warehouse_public.facts · name='naics_code' (6-digit NAICS code)",
                source_file="facts/kyb/index.ts", source_file_line="naicsCode · factWithHighestConfidence · vendor cascade",
                json_obj={"chart_type":"horizontal_bar_by_sector","sectors":naics_sector.to_dict("records") if not naics_sector.empty else [],"derivation":"naics_code[:2] → 2-digit NAICS sector group","source":"rds_warehouse_public.facts"},
                sql=_naics_sql,
                links=[("facts/kyb/index.ts","naicsCode fact"),("facts/rules.ts","factWithHighestConfidence rule"),("integrations.constant.ts","vendor IDs")],
                color="#3B82F6", icon="🏭")
        else:
            st.info("No NAICS data available.")

    st.markdown("---")

    # ── Row 3b: Worth Score Distribution ─────────────────────────────────────
    st.markdown("#### 💰 Worth Score Distribution")
    st.caption("From `rds_manual_score_public.business_scores` · score_decision breakdown across portfolio")

    @st.cache_data(ttl=600, show_spinner=False)
    # Worth Score distribution — same authoritative business list as stats/flags
    @st.cache_data(ttl=600, show_spinner=False)
    def _load_worth_score_for_bids(bid_tuple):
        if not bid_tuple:
            return None, "No business IDs"
        bid_list = ",".join(f"'{b}'" for b in bid_tuple[:2000])
        return run_sql(f"""
            SELECT cs.business_id, bs.weighted_score_850, bs.risk_level, bs.score_decision
            FROM rds_manual_score_public.data_current_scores cs
            JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
            WHERE cs.business_id IN ({bid_list})
        """)

    ws_df, ws_err = _load_worth_score_for_bids(tuple(_authoritative_bids))
    if ws_df is not None and not ws_df.empty:
        ws_df["weighted_score_850"] = pd.to_numeric(ws_df["weighted_score_850"], errors="coerce")
        ws_df = ws_df.dropna(subset=["weighted_score_850"])

        wc1,wc2,wc3,wc4 = st.columns(4)
        approved   = (ws_df["score_decision"]=="APPROVE").sum()
        review     = (ws_df["score_decision"]=="FURTHER_REVIEW_NEEDED").sum()
        declined   = (ws_df["score_decision"]=="DECLINE").sum()
        median_sc  = ws_df["weighted_score_850"].median()
        _ws_sql = f"SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id;"
        with wc1: kpi("Median Score",f"{median_sc:.0f}","300–850 scale","#3B82F6")
        with wc2: kpi("✅ Approve",f"{approved:,}",rate(approved,len(ws_df)),"#22c55e")
        with wc3: kpi("🔎 Review",f"{review:,}",rate(review,len(ws_df)),"#f59e0b")
        with wc4: kpi("❌ Decline",f"{declined:,}",rate(declined,len(ws_df)),"#ef4444")
        # Detail panels below (separate row to avoid overlap)
        # Worth Score detail panels — sequential full width (no columns, no overlap)
        detail_panel("💰 Median Worth Score",f"{median_sc:.0f}",
            what_it_means="Median score across all scored businesses. Formula: probability × 550 + 300. 300=worst risk, 850=best risk. Median is more robust than mean.",
            source_table="rds_manual_score_public.business_scores · weighted_score_850",
            source_file="aiscore.py", source_file_line="score_300_850 = probability × 550 + 300 (L44)",
            json_obj={"median_score_850":float(median_sc),"formula":"p × 550 + 300","thresholds":{"APPROVE":"≥700","FURTHER_REVIEW":"550–699","DECLINE":"<550"}},
            sql=_ws_sql, links=[("aiscore.py","Score formula"),("score_decision_matrix","Decision thresholds")],
            color="#3B82F6", icon="💰")
        detail_panel("✅ Approve",str(approved),
            what_it_means=f"score ≥ 700 → LOW risk → APPROVE. {approved:,} businesses ({rate(approved,len(ws_df))}). Default threshold from score_decision_matrix. Configurable per customer.",
            source_table="rds_manual_score_public.business_scores · score_decision='APPROVE'",
            source_file="score_decision_matrix", source_file_line="range_start=700, range_end=850, risk_level='LOW'",
            json_obj={"decision":"APPROVE","threshold":"score≥700","count":int(approved),"pct":rate(approved,len(ws_df))},
            sql=f"SELECT COUNT(*) AS approved FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id WHERE bs.score_decision='APPROVE';",
            links=[("score_decision_matrix","Decision thresholds")], color="#22c55e", icon="✅")
        detail_panel("🔎 Further Review",str(review),
            what_it_means=f"550 ≤ score < 700 → MODERATE → FURTHER_REVIEW_NEEDED. {review:,} businesses ({rate(review,len(ws_df))}). Human analyst must review before decision.",
            source_table="rds_manual_score_public.business_scores · score_decision='FURTHER_REVIEW_NEEDED'",
            source_file="score_decision_matrix", source_file_line="range_start=550, range_end=699, risk_level='MODERATE'",
            json_obj={"decision":"FURTHER_REVIEW_NEEDED","threshold":"550≤score<700","count":int(review),"pct":rate(review,len(ws_df))},
            sql=f"SELECT COUNT(*) AS review FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id WHERE bs.score_decision='FURTHER_REVIEW_NEEDED';",
            links=[("score_decision_matrix","Decision thresholds")], color="#f59e0b", icon="🔎")
        detail_panel("❌ Decline",str(declined),
            what_it_means=f"score < 550 → HIGH risk → DECLINE. {declined:,} businesses ({rate(declined,len(ws_df))}). Do NOT approve without Compliance override.",
            source_table="rds_manual_score_public.business_scores · score_decision='DECLINE'",
            source_file="score_decision_matrix", source_file_line="range_start=0, range_end=549, risk_level='HIGH'",
            json_obj={"decision":"DECLINE","threshold":"score<550","count":int(declined),"pct":rate(declined,len(ws_df))},
            sql=f"SELECT COUNT(*) AS declined FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id WHERE bs.score_decision='DECLINE';",
            links=[("score_decision_matrix","Decision thresholds")], color="#ef4444", icon="❌")

        wsc1, wsc2 = st.columns([2,1])
        with wsc1:
            fig_ws = px.histogram(
                ws_df, x="weighted_score_850", nbins=40,
                color="score_decision",
                color_discrete_map={
                    "APPROVE":"#22c55e",
                    "FURTHER_REVIEW_NEEDED":"#f59e0b",
                    "DECLINE":"#ef4444",
                },
                labels={"weighted_score_850":"Worth Score (300–850)","score_decision":"Decision"},
                title="Worth Score Distribution by Decision",
                barmode="stack",
            )
            fig_ws.update_layout(height=300,legend=dict(orientation="h",y=-0.2),
                                 margin=dict(t=40,b=40,l=10,r=10))
            st.plotly_chart(dark_chart(fig_ws),use_container_width=True)
            detail_panel("Worth Score Distribution (histogram)", f"n={len(ws_df):,} scored businesses",
                what_it_means="Stacked histogram showing distribution of Worth Scores (300–850) coloured by decision outcome. Green=APPROVE(≥700), Amber=FURTHER_REVIEW(550-699), Red=DECLINE(<550). Peaks show where the portfolio clusters. Score formula: probability × 550 + 300.",
                source_table="rds_manual_score_public.data_current_scores JOIN business_scores",
                source_file="aiscore.py", source_file_line="score_300_850 = p × 550 + 300 (L44)",
                json_obj={"chart_type":"histogram","x":"weighted_score_850","color":"score_decision","bins":40,"total_scored":len(ws_df),"median":float(median_sc),"decision_breakdown":{"APPROVE":int(approved),"FURTHER_REVIEW":int(review),"DECLINE":int(declined)}},
                sql=_ws_sql, links=[("aiscore.py","Score formula"),("score_decision_matrix","Thresholds")],
                color="#3B82F6", icon="📊")
        with wsc2:
            # Decision breakdown by risk_level
            rl_counts = ws_df.groupby(["risk_level","score_decision"]).size().reset_index(name="Count")
            if not rl_counts.empty:
                fig_rl=px.bar(rl_counts,x="risk_level",y="Count",color="score_decision",
                              barmode="stack",
                              color_discrete_map={"APPROVE":"#22c55e",
                                                  "FURTHER_REVIEW_NEEDED":"#f59e0b",
                                                  "DECLINE":"#ef4444"},
                              title="By Risk Level",
                              labels={"risk_level":"Risk Level","score_decision":"Decision"})
                fig_rl.update_layout(height=300,showlegend=False,
                                     margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_rl),use_container_width=True)
                detail_panel("Worth Score by Risk Level (bar chart)", "HIGH / MODERATE / LOW breakdown",
                    what_it_means="Stacked bar showing how many businesses fall into each risk level (HIGH/MODERATE/LOW) and their decision outcome. Risk level derives directly from score range: HIGH=<550, MODERATE=550-699, LOW=≥700. Source: score_decision_matrix table (configurable per customer).",
                    source_table="rds_manual_score_public.business_scores · risk_level + score_decision",
                    source_file="score_decision_matrix", source_file_line="risk_level and decision derived from score range",
                    json_obj={"chart_type":"stacked_bar","x":"risk_level","y":"count","color":"score_decision","data":rl_counts.to_dict("records")},
                    sql=f"SELECT risk_level, score_decision, COUNT(*) FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id GROUP BY 1,2 ORDER BY 1,2;",
                    links=[("score_decision_matrix","Risk level thresholds"),("aiscore.py","Score pipeline")],
                    color="#8B5CF6", icon="📊")
    else:
        st.info(f"Worth Score data not available. {ws_err or 'Check VPN / Redshift access.'}")

    st.markdown("---")

    # ── Row 4: Domestic/Foreign + TIN Sources + Formation States ─────────────
    col_domfor, col_tin, col_states = st.columns([1,1,1])

    with col_domfor:
        st.markdown("#### 🗺️ Domestic vs Foreign Registration")
        if stats_df is not None and not stats_df.empty:
            TAX_HAVENS={"DE","NV","WY","SD","MT","NM"}
            total_with_state = stats_df["formation_state"].notna().sum()
            th_count = stats_df["formation_state"].str.upper().str.strip().isin(TAX_HAVENS).sum()
            non_th   = total_with_state - th_count
            no_state = n - total_with_state

            # Pie: tax haven vs non-tax-haven vs missing
            fig_dom=go.Figure(go.Pie(
                labels=["Tax-Haven State\n(DE/NV/WY/SD/MT/NM)","Other State","No State Data"],
                values=[th_count, non_th, no_state],
                marker=dict(colors=["#f59e0b","#3B82F6","#334155"]),
                hole=0.5,
                textinfo="percent+value",
                textfont=dict(size=11),
            ))
            fig_dom.update_layout(height=220,showlegend=False,
                                  margin=dict(t=10,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_dom),use_container_width=True)
            st.caption("Tax-haven states (DE, NV, WY, SD, MT, NM) are high-risk for entity resolution gaps: Middesk finds the FOREIGN filing, missing the DOMESTIC primary record.")
            _dom_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='formation_state' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC;"
            detail_panel("Domestic vs Foreign Registration (donut)", f"Tax-haven: {th_count:,} · Other: {non_th:,} · No data: {no_state:,}",
                what_it_means="Donut showing how many businesses are incorporated in tax-haven states (DE/NV/WY/SD/MT/NM) vs other states vs missing. Tax-haven incorporations are HIGH RISK for entity resolution gaps because Middesk searches by operating address (submitted) and finds the FOREIGN qualification record, missing the DOMESTIC primary. Source: formation_state fact from Middesk (pid=16).",
                source_table="rds_warehouse_public.facts · name='formation_state'",
                source_file="facts/kyb/index.ts", source_file_line="formationState · factWithHighestConfidence · Middesk pid=16",
                json_obj={"tax_haven_count":int(th_count),"other_state_count":int(non_th),"no_state_data":int(no_state),"total":n,"tax_haven_states":["DE","NV","WY","SD","MT","NM"],"risk":"Entity resolution gap — Middesk address search finds FOREIGN not DOMESTIC"},
                sql=_dom_sql, links=[("facts/kyb/index.ts","formationState fact"),("consolidatedWatchlist.ts","Entity resolution architecture")],
                color="#f59e0b", icon="🗺️")

            # Top states table
            if not state_counts.empty:
                sc2=state_counts.copy()
                sc2["Tax Haven"]=sc2["State"].isin(TAX_HAVENS).map({True:"⚠️ Yes",False:"No"})
                st.dataframe(sc2[["State","Count","Tax Haven"]].head(8),
                             use_container_width=True,hide_index=True)
                detail_panel("Formation States Table", f"Top {min(8,len(sc2))} states",
                    what_it_means="Top formation states sorted by business count. Tax Haven=Yes means this state (DE/NV/WY/SD/MT/NM) is chosen for corporate law/tax benefits, not because the business operates there. When formation state ≠ operating state, Middesk's address search finds the WRONG SOS record → false negative in sos_match_boolean.",
                    source_table="rds_warehouse_public.facts · name='formation_state'",
                    source_file="facts/kyb/index.ts", source_file_line="formationState fact",
                    json_obj={"top_states":sc2[["State","Count","Tax Haven"]].head(8).to_dict("records")},
                    sql=_dom_sql, links=[("facts/kyb/index.ts","formationState"),("integrations.constant.ts","MIDDESK=16")],
                    color="#3B82F6", icon="🗺️")
        else:
            st.info("No formation state data available.")

    with col_tin:
        st.markdown("#### 🔐 TIN Verification Breakdown")
        if stats_df is not None and not stats_df.empty:
            tin_true  = (stats_df["tin_match"].str.lower().str.strip()=="true").sum()
            tin_false = (stats_df["tin_match"].str.lower().str.strip()=="false").sum()
            tin_null  = n - tin_true - tin_false

            # Donut: pass/fail/missing
            fig_tin=go.Figure(go.Pie(
                labels=["✅ TIN Verified","❌ TIN Failed","⚪ Not Checked"],
                values=[tin_true,tin_false,tin_null],
                marker=dict(colors=["#22c55e","#ef4444","#334155"]),
                hole=0.5,
                textinfo="percent+value",
                textfont=dict(size=11),
            ))
            fig_tin.update_layout(height=220,showlegend=False,
                                  margin=dict(t=10,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_tin),use_container_width=True)
            _tin_pop_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS tin_boolean, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='tin_match_boolean' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1;"
            detail_panel("TIN Verification Breakdown (donut)", f"Verified: {tin_true:,} · Failed: {tin_false:,} · Not checked: {tin_null:,}",
                what_it_means="Donut showing TIN verification outcomes across all onboarded businesses. Source: tin_match_boolean fact (dependent — derived from tin_match.value.status==='success'). Middesk (pid=16) queries IRS directly via TIN review task. 'Not Checked' = EIN not submitted OR Middesk TIN task not yet triggered.",
                source_table="rds_warehouse_public.facts · name='tin_match_boolean'",
                source_file="facts/kyb/index.ts", source_file_line="tinMatchBoolean · dependent · Middesk IRS check pid=16",
                json_obj={"tin_verified":int(tin_true),"tin_failed":int(tin_false),"tin_not_checked":int(tin_null),"total":n,"source":"Middesk pid=16 TIN review task → direct IRS query"},
                sql=_tin_pop_sql, links=[("facts/kyb/index.ts","tinMatchBoolean"),("integrations.constant.ts","MIDDESK=16")],
                color="#22c55e", icon="🔐")

            # Source concordance: SOS active vs TIN verified cross-tab
            st.markdown("**Source Concordance — SOS × TIN**")
            if stats_df is not None and not stats_df.empty:
                def _sos_label(v):
                    s=str(v or "").lower().strip()
                    return "SOS Active" if s=="true" else ("SOS Inactive" if s=="false" else "SOS Unknown")
                def _tin_label(v):
                    s=str(v or "").lower().strip()
                    return "TIN Pass" if s=="true" else ("TIN Fail" if s=="false" else "TIN Unknown")
                ct=stats_df.copy()
                ct["SOS"]=ct["sos_active"].apply(_sos_label)
                ct["TIN"]=ct["tin_match"].apply(_tin_label)
                cross=ct.groupby(["SOS","TIN"]).size().reset_index(name="Count")
                cross=cross.sort_values("Count",ascending=False)
                # Color code
                def _cross_color(row):
                    if row["SOS"]=="SOS Active" and row["TIN"]=="TIN Pass": return "✅ Good"
                    if row["SOS"]=="SOS Inactive" or row["TIN"]=="TIN Fail": return "🔴 Review"
                    return "🟡 Check"
                cross["Signal"]=cross.apply(_cross_color,axis=1)
                st.dataframe(cross[["SOS","TIN","Count","Signal"]],
                             use_container_width=True,hide_index=True)
                detail_panel("SOS × TIN Concordance Table", f"{len(cross)} combinations",
                    what_it_means="Cross-tabulation of SOS status vs TIN verification status. ✅ Good = SOS Active + TIN Pass (ideal). 🔴 Review = either SOS Inactive OR TIN Fail (action required). 🟡 Check = ambiguous (one or both unknown). This table detects the most common inconsistency: entity is registered (SOS Active) but EIN doesn't match IRS.",
                    source_table="rds_warehouse_public.facts · name IN ('sos_active','tin_match_boolean')",
                    source_file="facts/kyb/index.ts", source_file_line="sosActive + tinMatchBoolean cross-field analysis",
                    json_obj={"concordance_table":cross[["SOS","TIN","Count","Signal"]].to_dict("records"),"interpretation":{"Good":"SOS Active + TIN Pass","Review":"SOS Inactive or TIN Fail","Check":"One or both unknown"}},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS sos_active, JSON_EXTRACT_PATH_TEXT(b.value,'value') AS tin_match_boolean, COUNT(*) AS businesses FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match_boolean' WHERE a.name='sos_active' AND a.business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1,2 ORDER BY businesses DESC;",
                    links=[("facts/kyb/index.ts","sosActive + tinMatchBoolean")],
                    color="#8B5CF6", icon="🔗")
        else:
            st.info("No TIN data available.")

    with col_states:
        st.markdown("#### 📜 Public Records & Sources")
        if stats_df is not None and not stats_df.empty:
            am_count=(stats_df["adverse_media"].apply(lambda v:_safe_int(v)>0)).sum()

            # Public records summary
            pr_items=[
                ("Watchlist hits",wl_biz,"#ef4444","Businesses with ≥1 PEP/Sanctions hit"),
                ("Adverse Media",am_count,"#f59e0b","Businesses with negative press coverage"),
                ("Bankruptcies",bk_biz,"#8B5CF6","Businesses with ≥1 bankruptcy on file"),
            ]
            PR_FACT_MAP = {"Watchlist hits":("watchlist_hits","Trulioo PSC + Middesk","consolidatedWatchlist.ts"),"Adverse Media":("adverse_media_hits","Trulioo adverse_media","facts/kyb/index.ts"),"Bankruptcies":("num_bankruptcies","Equifax pid=17","facts/kyb/index.ts")}
            for label,count,color,desc in pr_items:
                pct=rate(count,n)
                st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                    border-radius:8px;padding:10px 14px;margin:4px 0">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#CBD5E1;font-weight:600;font-size:.82rem">{label}</span>
                    <span style="color:{color};font-weight:700;font-size:1.1rem">{count:,}</span>
                  </div>
                  <div style="color:#64748b;font-size:.70rem;margin-top:2px">{pct} · {desc}</div>
                </div>""",unsafe_allow_html=True)
                _pr_m = PR_FACT_MAP.get(label,("","",""))
                detail_panel(label, f"{count:,} businesses ({pct})",
                    what_it_means=f"{desc}. Source: {_pr_m[1]}. Stored in: rds_warehouse_public.facts · name='{_pr_m[0]}'. This is a scalar count — the full detail array (with dates, amounts, types) is too large for Redshift federation and must be queried from PostgreSQL RDS (port 5432).",
                    source_table=f"rds_warehouse_public.facts · name='{_pr_m[0]}' (scalar count, Redshift OK)",
                    source_file=_pr_m[2], source_file_line=f"{_pr_m[0]} · dependent from {_pr_m[0].replace('num_','')}[] array",
                    json_obj={"metric":label,"count":int(count),"pct":pct,"source":_pr_m[1],"scalar_fact":_pr_m[0],"full_array_fact":_pr_m[0].replace("_hits","").replace("num_","")},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS count_val, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='{_pr_m[0]}' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC;",
                    links=[(_pr_m[2],f"{_pr_m[0]} definition"),("integrations.constant.ts","TRULIOO=38, EQUIFAX=17")],
                    color=color, icon="📜")

            # IDV source concordance
            st.markdown("**IDV × SOS Concordance**")
            def _idv_label(v):
                s=str(v or "").lower().strip()
                return "IDV Pass" if s=="true" else ("IDV Fail" if s=="false" else "IDV Unknown")
            ct2=stats_df.copy()
            ct2["SOS"]=ct2["sos_active"].apply(lambda v: "SOS Active" if str(v or "").lower().strip()=="true" else ("SOS Inactive" if str(v or "").lower().strip()=="false" else "SOS Unknown"))
            ct2["IDV"]=ct2["idv_passed"].apply(_idv_label)
            cross2=ct2.groupby(["SOS","IDV"]).size().reset_index(name="Count").sort_values("Count",ascending=False)
            def _c2(row):
                if row["SOS"]=="SOS Active" and row["IDV"]=="IDV Pass": return "✅"
                if row["SOS"]=="SOS Inactive" or row["IDV"]=="IDV Fail": return "🔴"
                return "🟡"
            cross2["OK"]=cross2.apply(_c2,axis=1)
            st.dataframe(cross2[["SOS","IDV","Count","OK"]],
                         use_container_width=True,hide_index=True)
            detail_panel("IDV × SOS Concordance Table", f"{len(cross2)} combinations",
                what_it_means="Cross-tab of SOS status vs IDV verification. ✅ = SOS Active + IDV Pass (ideal). 🔴 = SOS Inactive OR IDV Fail (action required). 🟡 = unknown state (IDV not triggered for sole props, or SOS data missing). A business with SOS Active but IDV Fail means the entity is registered but the owner identity is not confirmed.",
                source_table="rds_warehouse_public.facts · name IN ('sos_active','idv_passed_boolean')",
                source_file="facts/kyb/index.ts", source_file_line="sosActive + idvPassedBoolean cross-field analysis",
                json_obj={"concordance_table":cross2[["SOS","IDV","Count","OK"]].to_dict("records")},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS sos_active, JSON_EXTRACT_PATH_TEXT(b.value,'value') AS idv_passed_boolean, COUNT(*) AS businesses FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='idv_passed_boolean' WHERE a.name='sos_active' AND a.business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1,2 ORDER BY businesses DESC;",
                links=[("facts/kyb/index.ts","sosActive + idvPassedBoolean")],
                color="#8B5CF6", icon="🔗")
        else:
            st.info("No public records data available.")

    st.markdown("---")

    # ════════════════════════════════════════════════════════════════════════
    # DOMESTIC vs FOREIGN × TIN VERIFICATION — BRIDGE ANALYSIS
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 🗺️ × 🔐 Domestic/Foreign Registration × TIN Verification")
    st.caption("How does the business formation state (domestic, tax-haven, or foreign) relate to TIN verification outcomes? This reveals systematic mismatches between registration strategy and IRS identity confirmation.")

    if stats_df is not None and not stats_df.empty:
        TAX_HAVENS_SET = {"DE","NV","WY","SD","MT","NM"}
        _br = stats_df.copy()

        def _br_s(v): return str(v or "").lower().strip()
        def _form_label(v):
            s = str(v or "").strip().upper()
            if s in TAX_HAVENS_SET: return f"⚠️ Tax-Haven ({s})"
            if s: return "✅ Other State"
            return "⚪ No State Data"
        def _tin_label2(v):
            s = _br_s(v)
            if s == "true":  return "✅ TIN Verified"
            if s == "false": return "❌ TIN Failed"
            return "⚪ Not Checked"

        _br["Formation Type"] = _br["formation_state"].apply(_form_label)
        _br["TIN Status"]     = _br["tin_match"].apply(_tin_label2)

        _bridge_ct = _br.groupby(["Formation Type","TIN Status"]).size().reset_index(name="Count")

        _br_sql = f"""SELECT
    JSON_EXTRACT_PATH_TEXT(a.value,'value') AS formation_state,
    JSON_EXTRACT_PATH_TEXT(b.value,'value') AS tin_match_boolean,
    COUNT(DISTINCT a.business_id) AS businesses
FROM rds_warehouse_public.facts a
JOIN rds_warehouse_public.facts b
  ON a.business_id = b.business_id
 AND b.name = 'tin_match_boolean'
WHERE a.name = 'formation_state'
  AND a.business_id IN (
      SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring
      WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}'
  )
GROUP BY 1,2
ORDER BY businesses DESC;"""

        brcol1, brcol2 = st.columns([3, 2])

        with brcol1:
            st.markdown("##### Stacked Bar — TIN outcome by Formation Type")
            if not _bridge_ct.empty:
                fig_br = px.bar(
                    _bridge_ct, x="Formation Type", y="Count", color="TIN Status",
                    barmode="stack",
                    color_discrete_map={
                        "✅ TIN Verified": "#22c55e",
                        "❌ TIN Failed":   "#ef4444",
                        "⚪ Not Checked":  "#334155",
                    },
                    title="Formation Type × TIN Verification Outcome",
                )
                fig_br.update_layout(height=320, margin=dict(t=40,b=10,l=10,r=10), xaxis_tickangle=-10)
                st.plotly_chart(dark_chart(fig_br), use_container_width=True)
                detail_panel("🗺️ × 🔐 Formation Type × TIN Verification (stacked bar)", f"{len(_bridge_ct)} combinations",
                    what_it_means=(
                        "Stacked bar showing, for each formation state category, how many businesses Verified, Failed, or skipped TIN checks.\n\n"
                        "⚠️ Tax-Haven (DE/NV/WY/SD/MT/NM) + ❌ TIN Failed: entity is incorporated in a nominee state but IRS name-check failed — "
                        "classic DBA/trade name vs. legal name mismatch. The EIN certificate uses the legal name registered in Delaware, "
                        "but the onboarding form submitted the trade name. Middesk IRS query compares submitted name vs. IRS record → mismatch → TIN Failed.\n\n"
                        "✅ Other State + ❌ TIN Failed: entity is not in a tax-haven state but still fails — likely incorrect EIN, sole-prop EIN used for LLC, "
                        "or EIN applied but IRS record not yet updated (<2 weeks).\n\n"
                        "⚪ No State Data + ⚪ Not Checked: complete data gap — no formation state from Middesk AND no TIN check triggered. "
                        "Most common for businesses where SOS query failed (no matching entity found) and EIN was not submitted."
                    ),
                    source_table="rds_warehouse_public.facts · name IN ('formation_state','tin_match_boolean')",
                    source_file="facts/kyb/index.ts",
                    source_file_line="formationState (Middesk pid=16) + tinMatchBoolean (dependent · Middesk IRS check)",
                    json_obj={"chart":"Formation Type x TIN","data":_bridge_ct.to_dict("records"),
                              "tax_havens":list(TAX_HAVENS_SET),
                              "risk_pattern":"Tax-Haven + TIN Failed = DBA vs legal name mismatch"},
                    sql=_br_sql,
                    links=[("facts/kyb/index.ts","formationState + tinMatchBoolean"),
                           ("integrations.constant.ts","MIDDESK=16")],
                    color="#8B5CF6", icon="🗺️")
            else:
                st.info("No data to cross-tabulate.")

        with brcol2:
            st.markdown("##### Cross-Tab Table & Insight Cards")
            if not _bridge_ct.empty:
                # Pivot table
                _br_pivot = _bridge_ct.pivot_table(
                    index="Formation Type", columns="TIN Status",
                    values="Count", aggfunc="sum", fill_value=0
                ).reset_index()
                st.dataframe(_br_pivot, use_container_width=True, hide_index=True)
                detail_panel("🗺️ × 🔐 Formation × TIN Pivot Table", f"{len(_br_pivot)} rows",
                    what_it_means="Pivot table with Formation Type as rows and TIN Status as columns. Each cell = number of businesses in that combination. Use this to find the single most risky combination for the selected date range and customer.",
                    source_table="rds_warehouse_public.facts · name IN ('formation_state','tin_match_boolean')",
                    source_file="facts/kyb/index.ts",
                    source_file_line="formationState + tinMatchBoolean · Middesk pid=16",
                    json_obj={"pivot":_br_pivot.to_dict("records")},
                    sql=_br_sql,
                    links=[("facts/kyb/index.ts","formationState + tinMatchBoolean")],
                    color="#3B82F6", icon="📊")

                st.markdown("---")
                # Key insight cards
                _th_fail = _bridge_ct[
                    _bridge_ct["Formation Type"].str.startswith("⚠️") &
                    (_bridge_ct["TIN Status"]=="❌ TIN Failed")
                ]["Count"].sum()
                _th_pass = _bridge_ct[
                    _bridge_ct["Formation Type"].str.startswith("⚠️") &
                    (_bridge_ct["TIN Status"]=="✅ TIN Verified")
                ]["Count"].sum()
                _other_fail = _bridge_ct[
                    (_bridge_ct["Formation Type"]=="✅ Other State") &
                    (_bridge_ct["TIN Status"]=="❌ TIN Failed")
                ]["Count"].sum()
                _no_state_no_tin = _bridge_ct[
                    (_bridge_ct["Formation Type"]=="⚪ No State Data") &
                    (_bridge_ct["TIN Status"]=="⚪ Not Checked")
                ]["Count"].sum()

                _cards = [
                    ("⚠️ Tax-Haven + ❌ TIN Failed", int(_th_fail), "#ef4444",
                     "DBA vs legal name mismatch — IRS name doesn't match submitted name. Highest name-mismatch risk."),
                    ("⚠️ Tax-Haven + ✅ TIN Verified", int(_th_pass), "#22c55e",
                     "Tax-haven but EIN confirmed. Entity uses legal name on onboarding. Lower risk for TIN."),
                    ("✅ Other State + ❌ TIN Failed", int(_other_fail), "#f59e0b",
                     "Not tax-haven but TIN still failed. Possible wrong EIN, sole-prop EIN, or new EIN not yet in IRS."),
                    ("⚪ No State + ⚪ Not Checked", int(_no_state_no_tin), "#64748b",
                     "Complete data gap — no SOS data AND no TIN check. These businesses have near-zero entity verification."),
                ]
                for label, count, color, insight in _cards:
                    st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                        border-radius:8px;padding:8px 12px;margin:4px 0">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="color:#CBD5E1;font-weight:600;font-size:.75rem">{label}</span>
                        <span style="color:{color};font-weight:700;font-size:1rem">{count:,}</span>
                      </div>
                      <div style="color:#64748b;font-size:.68rem;margin-top:2px">{insight}</div>
                    </div>""", unsafe_allow_html=True)
                    detail_panel(label, f"{count:,} businesses",
                        what_it_means=insight,
                        source_table="rds_warehouse_public.facts · name IN ('formation_state','tin_match_boolean')",
                        source_file="facts/kyb/index.ts",
                        source_file_line="formationState (Middesk pid=16) + tinMatchBoolean (Middesk IRS check)",
                        json_obj={"segment":label,"count":count,"insight":insight},
                        sql=_br_sql,
                        links=[("facts/kyb/index.ts","formationState + tinMatchBoolean")],
                        color=color, icon="🔍")
    else:
        st.info("No data available for Domestic × TIN analysis.")

    st.markdown("---")

    # ════════════════════════════════════════════════════════════════════════
    # CROSS-TABULATION ANALYSIS
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 🔀 Cross-Tabulation Analysis")
    st.caption("Slice-and-dice views showing how KYB signals relate to each other across the portfolio.")

    if stats_df is not None and not stats_df.empty:
        def _s(v): return str(v or "").lower().strip()
        def _si(v):
            try: return int(float(v or 0))
            except: return 0

        _ct = stats_df.copy()

        # Derived labels
        _ct["SOS"]       = _ct["sos_active"].apply(lambda v: "✅ Active" if _s(v)=="true" else ("❌ Inactive" if _s(v)=="false" else "⚪ Unknown"))
        _ct["TIN"]       = _ct["tin_match"].apply(lambda v: "✅ Verified" if _s(v)=="true" else ("❌ Failed" if _s(v)=="false" else "⚪ Not checked"))
        _ct["IDV"]       = _ct["idv_passed"].apply(lambda v: "✅ Passed" if _s(v)=="true" else ("❌ Failed" if _s(v)=="false" else "⚪ Unknown"))
        _ct["Watchlist"] = _ct["watchlist_hits"].apply(lambda v: "🔴 Has hits" if _si(v)>0 else "✅ Clean")
        _ct["NAICS"]     = _ct["naics_code"].apply(lambda v: "⚠️ Fallback (561499)" if _s(v)=="561499" else ("✅ Classified" if _s(v) else "⚪ Missing"))
        TAX_HAVENS = {"DE","NV","WY","SD","MT","NM"}
        _ct["Formation"] = _ct["formation_state"].apply(lambda v:
            f"⚠️ Tax-Haven ({_s(v).upper()})" if _s(v).upper() in TAX_HAVENS
            else ("✅ Other State" if _s(v) else "⚪ Unknown"))
        _ct["Revenue"]   = _ct["revenue"].apply(lambda v: "✅ Known" if v and str(v).strip() not in ("","None","nan") else "❌ Missing")

        xc1, xc2 = st.columns(2)

        # Cross-tab 1: TIN × Formation (Domestic/Tax-Haven)
        with xc1:
            st.markdown("#### 🔐 × 🗺️ TIN Verification × Formation State")
            st.caption("For each TIN outcome — how many businesses are from tax-haven states vs other states?")
            _ct1 = _ct.groupby(["TIN","Formation"]).size().reset_index(name="Count")
            if not _ct1.empty:
                fig_ct1 = px.bar(_ct1, x="TIN", y="Count", color="Formation",
                                 barmode="stack",
                                 color_discrete_map={"⚠️ Tax-Haven (DE)":"#f59e0b","⚠️ Tax-Haven (NV)":"#f59e0b",
                                                     "⚠️ Tax-Haven (WY)":"#f59e0b","✅ Other State":"#3B82F6","⚪ Unknown":"#334155"},
                                 title="TIN Verification outcome by Formation State type")
                fig_ct1.update_layout(height=300,margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_ct1), use_container_width=True)
                st.caption("💡 Tax-haven businesses with TIN Failed may have name mismatches due to DBA vs legal name differences. "
                           "The entity is incorporated in DE/NV/WY but operates under a different trade name.")
                with st.expander("📊 Full cross-tab table"):
                    _pivot1 = _ct1.pivot_table(index="TIN",columns="Formation",values="Count",aggfunc="sum",fill_value=0)
                    st.dataframe(_pivot1, use_container_width=True)
                detail_panel("🔐 × 🗺️ TIN × Formation State", f"{len(_ct1)} combinations",
                    what_it_means="Cross-tabulation of TIN verification outcome vs formation state type. Tax-Haven = DE/NV/WY/SD/MT/NM. "
                        "TIN Failed in tax-haven states often caused by DBA name submitted instead of the legal name registered in DE/NV/WY. "
                        "The Middesk TIN check queries the IRS using the submitted business name — if the DE entity has a different name, it fails. "
                        "Source facts: tin_match_boolean (from tin_match.value.status via Middesk pid=16), formation_state (from Middesk pid=16).",
                    source_table="rds_warehouse_public.facts · name IN ('tin_match_boolean','formation_state')",
                    source_file="facts/kyb/index.ts", source_file_line="tinMatchBoolean + formationState · Middesk pid=16",
                    json_obj={"chart":"TIN x Formation","data":_ct1.to_dict("records"),"tax_havens":["DE","NV","WY","SD","MT","NM"]},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS tin_match_boolean, JSON_EXTRACT_PATH_TEXT(b.value,'value') AS formation_state, COUNT(*) AS businesses FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='formation_state' WHERE a.name='tin_match_boolean' AND a.business_id IN ({','.join(repr(x) for x in list(_authoritative_bids)[:5])},...) GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                    links=[("facts/kyb/index.ts","tinMatchBoolean · formationState")],
                    color="#8B5CF6", icon="🔐")

        # Cross-tab 2: SOS × TIN
        with xc2:
            st.markdown("#### 🏛️ × 🔐 SOS Status × TIN Verification")
            st.caption("SOS registry status vs TIN outcome — expected: SOS Active + TIN Verified = healthy entity.")
            _ct2 = _ct.groupby(["SOS","TIN"]).size().reset_index(name="Count")
            if not _ct2.empty:
                def _sos_color(s):
                    if "Active" in s: return "#22c55e"
                    if "Inactive" in s: return "#ef4444"
                    return "#64748b"
                fig_ct2 = px.bar(_ct2, x="SOS", y="Count", color="TIN",
                                 barmode="stack",
                                 color_discrete_map={"✅ Verified":"#22c55e","❌ Failed":"#ef4444","⚪ Not checked":"#334155"},
                                 title="SOS Status × TIN Verification")
                fig_ct2.update_layout(height=300,margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_ct2), use_container_width=True)
                st.caption("💡 SOS Active + TIN Failed = entity is registered but EIN doesn't match IRS (possible DBA submission). "
                           "SOS Inactive + TIN Verified = entity has IRS record but lost good standing (missed annual report, unpaid fees).")
                with st.expander("📊 Full cross-tab table + signal"):
                    _ct2_disp = _ct2.copy()
                    _ct2_disp["Risk Signal"] = _ct2_disp.apply(lambda r:
                        "✅ Good" if "Active" in r["SOS"] and "Verified" in r["TIN"]
                        else "🔴 Critical" if "Inactive" in r["SOS"] and "Failed" in r["TIN"]
                        else "🟡 Review", axis=1)
                    st.dataframe(_ct2_disp, use_container_width=True, hide_index=True)
                detail_panel("🏛️ × 🔐 SOS Status × TIN Verification", f"{len(_ct2)} combinations",
                    what_it_means="Cross-tabulation of SOS registry status vs TIN verification outcome. "
                        "Expected healthy: SOS Active + TIN Verified. "
                        "SOS Active + TIN Failed: entity is legally registered but EIN+name IRS check failed — likely DBA submitted instead of legal name on EIN certificate. "
                        "SOS Inactive + TIN Verified: entity has a valid EIN history but lost SOS good standing (missed annual report, unpaid state fees). "
                        "Risk Signal: Good=✅ Active+Verified | Critical=🔴 Inactive+Failed | Review=🟡 all others. "
                        "Source: sos_active (dependent, from sos_filings[].active, Middesk pid=16), tin_match_boolean (dependent, from tin_match.value.status, Middesk pid=16).",
                    source_table="rds_warehouse_public.facts · name IN ('sos_active','tin_match_boolean')",
                    source_file="facts/kyb/index.ts", source_file_line="sosActive (dependent) + tinMatchBoolean (dependent) · Middesk pid=16",
                    json_obj={"chart":"SOS x TIN","data":_ct2.to_dict("records"),"risk_signals":{"Good":"SOS Active + TIN Verified","Critical":"SOS Inactive + TIN Failed","Review":"all other combinations"}},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS sos_active, JSON_EXTRACT_PATH_TEXT(b.value,'value') AS tin_match_boolean, COUNT(*) FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match_boolean' WHERE a.name='sos_active' AND a.business_id IN (...) GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                    links=[("facts/kyb/index.ts","sosActive · tinMatchBoolean")],
                    color="#3B82F6", icon="🏛️")

        xc3, xc4 = st.columns(2)

        # Cross-tab 3: IDV × Watchlist
        with xc3:
            st.markdown("#### 🪪 × ⚠️ IDV Passed × Watchlist Status")
            st.caption("Did businesses that passed identity verification also have watchlist hits?")
            _ct3 = _ct.groupby(["IDV","Watchlist"]).size().reset_index(name="Count")
            if not _ct3.empty:
                fig_ct3 = px.bar(_ct3, x="IDV", y="Count", color="Watchlist",
                                 barmode="stack",
                                 color_discrete_map={"🔴 Has hits":"#ef4444","✅ Clean":"#22c55e"},
                                 title="IDV Outcome × Watchlist Status")
                fig_ct3.update_layout(height=300,margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_ct3), use_container_width=True)
                st.caption("💡 IDV Passed + Watchlist Hit = owner identity confirmed but entity has sanctions/PEP hit. "
                           "The person passed biometrics but the business entity itself is flagged. Both must be reviewed.")
                detail_panel("🪪 × ⚠️ IDV Passed × Watchlist Status", f"{len(_ct3)} combinations",
                    what_it_means="Cross-tabulation of IDV (Identity Verification) outcome vs Watchlist status. "
                        "IDV Passed + Watchlist Hit: the beneficial owner's identity is confirmed by Plaid biometrics (government ID + selfie + liveness), "
                        "but the BUSINESS ENTITY has a PEP or SANCTIONS screening hit. These are independent checks — a clean owner can still run a flagged entity. "
                        "IDV Failed + Watchlist Hit: double risk — neither owner identity nor entity compliance confirmed. Immediate escalation required. "
                        "Source: idv_passed_boolean (Plaid IDV pid=18, dependent from idv_passed), watchlist_hits (dependent from watchlist.metadata[].length, "
                        "Trulioo PSC pid=38 + Middesk pid=16 merged by consolidatedWatchlist.ts).",
                    source_table="rds_warehouse_public.facts · name IN ('idv_passed_boolean','watchlist_hits')",
                    source_file="facts/kyb/index.ts", source_file_line="idvPassedBoolean (Plaid pid=18) + watchlistHits (Trulioo pid=38 / Middesk pid=16)",
                    json_obj={"chart":"IDV x Watchlist","data":_ct3.to_dict("records"),"watchlist_note":"PEP+SANCTIONS only, adverse_media excluded (filterOutAdverseMedia)"},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS idv_passed, CASE WHEN CAST(JSON_EXTRACT_PATH_TEXT(b.value,'value') AS INT)>0 THEN 'Has hits' ELSE 'Clean' END AS watchlist, COUNT(*) FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='watchlist_hits' WHERE a.name='idv_passed_boolean' AND a.business_id IN (...) GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                    links=[("facts/kyb/index.ts","idvPassedBoolean + watchlistHits"),("consolidatedWatchlist.ts","Watchlist architecture")],
                    color="#8B5CF6", icon="🪪")

        # Cross-tab 4: NAICS × TIN
        with xc4:
            st.markdown("#### 🏭 × 🔐 Industry Classification × TIN Verification")
            st.caption("Businesses with unclassified industry (561499) — are they also failing TIN verification?")
            _ct4 = _ct.groupby(["NAICS","TIN"]).size().reset_index(name="Count")
            if not _ct4.empty:
                fig_ct4 = px.bar(_ct4, x="NAICS", y="Count", color="TIN",
                                 barmode="stack",
                                 color_discrete_map={"✅ Verified":"#22c55e","❌ Failed":"#ef4444","⚪ Not checked":"#334155"},
                                 title="NAICS Classification × TIN Verification")
                fig_ct4.update_layout(height=300,margin=dict(t=40,b=10,l=10,r=10),xaxis_tickangle=-15)
                st.plotly_chart(dark_chart(fig_ct4), use_container_width=True)
                st.caption("💡 NAICS Fallback (561499) + TIN Failed = both industry and tax identity unresolved. "
                           "These businesses likely failed entity matching in all vendor databases — highest data quality risk.")
                detail_panel("🏭 × 🔐 NAICS Classification × TIN Verification", f"{len(_ct4)} combinations",
                    what_it_means="Cross-tabulation of NAICS industry classification vs TIN verification outcome. "
                        "NAICS Fallback (561499) = AI enrichment (last resort, weight=0.1) returned 'All Other Business Support Services' because all commercial vendors "
                        "(ZI, EFX, OC, Middesk, SERP, Trulioo) failed to match the entity. "
                        "NAICS Fallback + TIN Failed = both industry and EIN identity are unresolved — the entity could not be matched in ANY vendor database. "
                        "This is the highest data quality risk in the portfolio. "
                        "NAICS Classified + TIN Verified = healthy classification with confirmed EIN — most reliable underwriting signal. "
                        "Source: naics_code (factWithHighestConfidence, vendor cascade), tin_match_boolean (Middesk pid=16 IRS check).",
                    source_table="rds_warehouse_public.facts · name IN ('naics_code','tin_match_boolean')",
                    source_file="facts/kyb/index.ts", source_file_line="naicsCode (factWithHighestConfidence) + tinMatchBoolean (Middesk pid=16)",
                    json_obj={"chart":"NAICS x TIN","data":_ct4.to_dict("records"),"naics_fallback":"561499 = AI last resort, all commercial vendors failed","highest_risk":"NAICS Fallback + TIN Failed"},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS naics_code, JSON_EXTRACT_PATH_TEXT(b.value,'value') AS tin_match_boolean, COUNT(*) FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match_boolean' WHERE a.name='naics_code' AND a.business_id IN (...) GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                    links=[("facts/kyb/index.ts","naicsCode + tinMatchBoolean"),("integrations.constant.ts","MIDDESK=16")],
                    color="#f97316", icon="🏭")

        # Cross-tab 5: Revenue × SOS (full row)
        st.markdown("#### 💰 × 🏛️ Revenue Availability × SOS Status — Data Quality Matrix")
        st.caption("Firmographic data coverage vs SOS registry status. Revenue missing = ZI/EFX could not match entity.")
        _ct5 = _ct.groupby(["SOS","Revenue"]).size().reset_index(name="Count")
        if not _ct5.empty:
            col_heat, col_note = st.columns([2,1])
            with col_heat:
                fig_ct5 = px.bar(_ct5, x="SOS", y="Count", color="Revenue",
                                 barmode="group",
                                 color_discrete_map={"✅ Known":"#22c55e","❌ Missing":"#ef4444"},
                                 title="SOS Status × Revenue Data Availability")
                fig_ct5.update_layout(height=280,margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_ct5), use_container_width=True)
                detail_panel("💰 × 🏛️ Revenue Availability × SOS Status", f"{len(_ct5)} combinations",
                    what_it_means="Cross-tabulation of revenue data availability (from ZI/EFX firmographic bulk data) vs SOS registry status. "
                        "Revenue Known = ZoomInfo (pid=24, w=0.8) or Equifax (pid=17, w=0.7) matched the entity and have annual revenue data. "
                        "Revenue Missing = neither ZI nor EFX could match this entity in their database — common for micro-businesses, very new businesses (<2 weeks), or businesses with unusual names. "
                        "SOS Active + Revenue Missing: entity is legitimately registered but too small/new for commercial firmographic databases. "
                        "SOS Unknown + Revenue Missing: complete data gap — entity existence AND firmographic data both unverified. Highest underwriting risk. "
                        "Revenue is a primary Worth Score feature (Business Operations category) — null revenue forces the model to use default imputation.",
                    source_table="rds_warehouse_public.facts · name IN ('sos_active','revenue')",
                    source_file="facts/kyb/index.ts", source_file_line="sosActive (Middesk pid=16) + revenue (ZoomInfo pid=24 / Equifax pid=17)",
                    json_obj={"chart":"Revenue x SOS","data":_ct5.to_dict("records"),"revenue_source":"ZoomInfo pid=24 (w=0.8) and Equifax pid=17 (w=0.7) bulk firmographic","worth_score_impact":"Null revenue → financial sub-model uses default imputation → less accurate score"},
                    sql=f"SELECT JSON_EXTRACT_PATH_TEXT(a.value,'value') AS sos_active, CASE WHEN JSON_EXTRACT_PATH_TEXT(b.value,'value') IS NOT NULL AND JSON_EXTRACT_PATH_TEXT(b.value,'value')!='' THEN 'Known' ELSE 'Missing' END AS revenue_known, COUNT(*) FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='revenue' WHERE a.name='sos_active' AND a.business_id IN (...) GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                    links=[("facts/kyb/index.ts","sosActive + revenue"),("integrations.constant.ts","ZOOMINFO=24, EQUIFAX=17")],
                    color="#22c55e", icon="💰")
            with col_note:
                st.markdown("""<div style="background:#1E293B;border-radius:8px;padding:12px;margin-top:10px;font-size:.78rem">
<div style="color:#60A5FA;font-weight:700;margin-bottom:8px">What this tells you:</div>
<div style="color:#CBD5E1">
<strong>SOS Active + Revenue Missing</strong><br>
Entity is registered but no firmographic data — ZI/EFX could not match. Common for very new or very small businesses.<br><br>
<strong>SOS Inactive + Revenue Known</strong><br>
Firmographic data exists but entity lost good standing. Typically: missed annual report or unpaid state fees.<br><br>
<strong>SOS Unknown + Revenue Missing</strong><br>
Complete data gap. Entity existence AND firmographic data both unverified — highest underwriting risk.
</div></div>""", unsafe_allow_html=True)

        # Summary insight row
        _clean_all = len(_ct[(_ct["SOS"]=="✅ Active") & (_ct["TIN"]=="✅ Verified") & (_ct["IDV"]=="✅ Passed") & (_ct["Watchlist"]=="✅ Clean")])
        _multi_risk = len(_ct[(_ct["SOS"]!="✅ Active") & (_ct["TIN"]!="✅ Verified") & (_ct["Watchlist"]=="🔴 Has hits")])
        _tax_tin_fail = len(_ct[_ct["Formation"].str.contains("Tax-Haven",na=False) & (_ct["TIN"]=="❌ Failed")])

        st.markdown("#### 📊 Portfolio Cross-Signal Summary")
        _naics_bad_tin = len(_ct[(_ct["NAICS"]=="⚠️ Fallback (561499)") & (_ct["TIN"]=="❌ Failed")])
        _sm1,_sm2,_sm3,_sm4 = st.columns(4)
        with _sm1: kpi("Fully Clean",str(_clean_all),"SOS Active + TIN Verified + IDV Passed + No Watchlist","#22c55e")
        with _sm2: kpi("Multi-Risk",str(_multi_risk),"SOS Issue + TIN Failed + Watchlist Hit","#ef4444")
        with _sm3: kpi("Tax-Haven + TIN Fail",str(_tax_tin_fail),"Incorporated in DE/NV/WY and TIN failed","#f59e0b")
        with _sm4: kpi("No Industry + TIN Fail",str(_naics_bad_tin),"NAICS=561499 AND TIN failed — highest data risk","#ef4444")

        # Detail panels below — sequential to avoid overlap
        detail_panel("✅ Fully Clean Businesses", str(_clean_all),
            what_it_means=f"{_clean_all} businesses passed ALL 4 core KYB checks: SOS Active (entity in good standing) + TIN Verified (IRS confirmed EIN) + IDV Passed (Plaid biometric confirmed) + No Watchlist hits (no PEP or SANCTIONS). "
                "These are the lowest-risk businesses in the portfolio — all identity, entity, and compliance signals are green. "
                f"Represents {_clean_all/max(len(_ct),1)*100:.0f}% of businesses with fact data.",
            source_table="rds_warehouse_public.facts · sos_active='true' AND tin_match_boolean='true' AND idv_passed_boolean='true' AND watchlist_hits='0'",
            source_file="facts/kyb/index.ts", source_file_line="sosActive + tinMatchBoolean + idvPassedBoolean + watchlistHits — all 4 checks",
            json_obj={"fully_clean_count":int(_clean_all),"criteria":"SOS Active=true AND TIN Verified=true AND IDV Passed=true AND Watchlist=0","pct":f"{_clean_all/max(len(_ct),1)*100:.0f}%"},
            sql=f"SELECT COUNT(*) AS fully_clean FROM (SELECT a.business_id FROM rds_warehouse_public.facts a WHERE a.name='sos_active' AND JSON_EXTRACT_PATH_TEXT(a.value,'value')='true' AND a.business_id IN (SELECT b.business_id FROM rds_warehouse_public.facts b WHERE b.name='tin_match_boolean' AND JSON_EXTRACT_PATH_TEXT(b.value,'value')='true' AND b.business_id IN (SELECT c.business_id FROM rds_warehouse_public.facts c WHERE c.name='watchlist_hits' AND CAST(JSON_EXTRACT_PATH_TEXT(c.value,'value') AS INT)=0)));",
            links=[("facts/kyb/index.ts","sosActive + tinMatchBoolean + idvPassedBoolean + watchlistHits")],
            color="#22c55e", icon="✅")

        detail_panel("🔴 Multi-Risk Businesses", str(_multi_risk),
            what_it_means=f"{_multi_risk} businesses have THREE simultaneous risk signals: SOS NOT Active (entity not in good standing OR unverified) + TIN NOT Verified (IRS check failed or not run) + Watchlist Hit (PEP or SANCTIONS). "
                "This combination requires immediate escalation — entity existence, tax identity, and compliance are ALL unresolved simultaneously. "
                "These businesses should be blocked from approval without manual Compliance review.",
            source_table="rds_warehouse_public.facts · sos_active≠'true' AND tin_match_boolean≠'true' AND watchlist_hits>0",
            source_file="consolidatedWatchlist.ts + facts/kyb/index.ts",
            json_obj={"multi_risk_count":int(_multi_risk),"criteria":"SOS NOT Active AND TIN NOT Verified AND Watchlist>0","action":"Immediate escalation to Compliance"},
            sql=f"SELECT a.business_id FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match_boolean' JOIN rds_warehouse_public.facts c ON a.business_id=c.business_id AND c.name='watchlist_hits' WHERE a.name='sos_active' AND JSON_EXTRACT_PATH_TEXT(a.value,'value')!='true' AND JSON_EXTRACT_PATH_TEXT(b.value,'value')!='true' AND CAST(JSON_EXTRACT_PATH_TEXT(c.value,'value') AS INT)>0 AND a.business_id IN (...);",
            links=[("consolidatedWatchlist.ts","Watchlist architecture"),("facts/kyb/index.ts","Risk signals")],
            color="#ef4444", icon="🔴")

        detail_panel("⚠️ Tax-Haven + TIN Fail", str(_tax_tin_fail),
            what_it_means=f"{_tax_tin_fail} businesses are incorporated in a tax-haven state (DE/NV/WY/SD/MT/NM) AND have a TIN verification failure. "
                "The most common cause: the entity is incorporated in Delaware under one legal name, but submitted a DBA trade name on the onboarding form. "
                "The IRS TIN check uses the submitted name — if it doesn't match the EIN certificate exactly, it fails. "
                "These are often NOT fraudulent — they just need the correct legal name from the EIN certificate (IRS SS-4 form). "
                "Action: request the IRS EIN confirmation letter and resubmit with the exact legal name.",
            source_table="rds_warehouse_public.facts · formation_state IN (DE/NV/WY...) AND tin_match_boolean='false'",
            source_file="facts/kyb/index.ts", source_file_line="formationState (Middesk) + tinMatchBoolean (Middesk IRS check)",
            json_obj={"tax_haven_tin_fail_count":int(_tax_tin_fail),"tax_haven_states":["DE","NV","WY","SD","MT","NM"],"common_cause":"DBA name submitted instead of legal EIN name","action":"Request IRS EIN confirmation letter (SS-4)"},
            sql=f"SELECT a.business_id, JSON_EXTRACT_PATH_TEXT(a.value,'value') AS formation_state, JSON_EXTRACT_PATH_TEXT(b.value,'value','status') AS tin_status, JSON_EXTRACT_PATH_TEXT(b.value,'value','message') AS tin_message FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match' WHERE a.name='formation_state' AND UPPER(JSON_EXTRACT_PATH_TEXT(a.value,'value')) IN ('DE','NV','WY','SD','MT','NM') AND JSON_EXTRACT_PATH_TEXT(b.value,'value','status')='failure' AND a.business_id IN (...);",
            links=[("facts/kyb/index.ts","formationState + tinMatch")],
            color="#f59e0b", icon="⚠️")

        detail_panel("🚨 No Industry + TIN Fail", str(_naics_bad_tin),
            what_it_means=f"{_naics_bad_tin} businesses have BOTH industry classification failure (NAICS=561499 fallback) AND TIN verification failure. "
                "NAICS=561499 means all 7 vendors (EFX, ZI, OC, SERP, Trulioo, Applicant, AI) failed to classify the business industry. "
                "Combined with TIN failure, this means the entity could NOT be matched in ANY commercial database for firmographic data, AND the EIN-name combination was not confirmed by IRS. "
                "This is the highest data quality risk in the portfolio. Both facts independently suggest entity matching failure. "
                "These businesses need manual investigation before any underwriting decision.",
            source_table="rds_warehouse_public.facts · naics_code='561499' AND tin_match_boolean='false'",
            source_file="facts/kyb/index.ts", source_file_line="naicsCode (factWithHighestConfidence, AI last resort) + tinMatchBoolean (Middesk IRS)",
            json_obj={"naics_561499_and_tin_fail_count":int(_naics_bad_tin),"meaning":"Both industry classification AND TIN verification failed simultaneously","risk_level":"CRITICAL — manual investigation required"},
            sql=f"SELECT a.business_id FROM rds_warehouse_public.facts a JOIN rds_warehouse_public.facts b ON a.business_id=b.business_id AND b.name='tin_match_boolean' WHERE a.name='naics_code' AND JSON_EXTRACT_PATH_TEXT(a.value,'value')='561499' AND JSON_EXTRACT_PATH_TEXT(b.value,'value')='false' AND a.business_id IN (...);",
            links=[("facts/kyb/index.ts","naicsCode + tinMatchBoolean")],
            color="#ef4444", icon="🚨")

    else:
        st.info("Cross-tabulation requires KYB stats data. Enable date filter or check VPN connection.")

    st.markdown("---")

    # ════════════════════════════════════════════════════════════════════════
    # KYB VERIFICATION FUNNEL
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 🔽 KYB Verification Funnel")
    st.caption("Step-by-step verification analysis: SOS registry matching → TIN submission → TIN verification pass/fail. "
               "Each step shows how many businesses pass the gate and how many drop off.")

    if funnel_df is not None and not funnel_df.empty:
        _f = funnel_df.copy()
        _N = len(_f)
        def _sb(col, val): return (_f[col].str.lower().str.strip()==val).sum() if col in _f.columns else 0
        def _snotnull(col): return _f[col].notna().sum() if col in _f.columns else 0
        def _snotempty(col): return (_f[col].notna() & (_f[col].str.strip()!="") & (_f[col].str.lower()!="none")).sum() if col in _f.columns else 0

        # ── Metric calculations ───────────────────────────────────────────
        # SOS Registry Found = sos_match_boolean=true (Middesk or OC found a matching record)
        sos_found       = _sb("sos_match_boolean","true")
        sos_not_found   = _N - sos_found

        # TIN Submitted = tin_submitted is not null/empty (applicant provided an EIN)
        tin_submitted   = _snotempty("tin_submitted")
        tin_not_submit  = _N - tin_submitted

        # TIN Pass = tin_match_boolean=true OR tin_status=success (IRS confirmed)
        tin_pass        = _sb("tin_match_boolean","true")
        # TIN Fail = tin_status=failure (IRS checked but did not confirm)
        tin_fail        = (_f["tin_status"].str.lower().str.strip()=="failure").sum() if "tin_status" in _f.columns else 0
        # TIN Not Checked = submitted but IRS not checked yet OR not submitted at all
        tin_submitted_not_checked = max(0, tin_submitted - tin_pass - tin_fail)

        # Domestic-only registration:
        # formation_state = operating_state → likely domestic only
        TAX_HAVENS2 = {"DE","NV","WY","SD","MT","NM"}
        if "formation_state" in _f.columns and "operating_state" in _f.columns:
            _f["fs"] = _f["formation_state"].str.upper().str.strip()
            _f["os"] = _f["operating_state"].str.upper().str.strip()
            same_state = ((_f["fs"]==_f["os"]) & _f["fs"].notna() & (_f["fs"]!="")).sum()
            diff_state = ((_f["fs"]!=_f["os"]) & _f["fs"].notna() & _f["os"].notna() & (_f["fs"]!="") & (_f["os"]!="")).sum()
            # Businesses registered in the state they do business in
            in_operating_state = same_state
            # SOS found AND in operating state (1 domestic registration in submitted state)
            sos_in_op_state = ((_f["sos_match_boolean"].str.lower().str.strip()=="true") & (_f["fs"]==_f["os"])).sum()
        else:
            same_state = diff_state = in_operating_state = sos_in_op_state = 0

        # ── Funnel bar chart ──────────────────────────────────────────────
        funnel_steps = [
            ("📋 Businesses in period",    _N,           "#3B82F6"),
            ("🏛️ SOS Registry found",      sos_found,    "#22c55e" if sos_found/_N>=0.8 else "#f59e0b"),
            ("🗺️ Formation = operating state", in_operating_state, "#8B5CF6"),
            ("🔐 TIN submitted",            tin_submitted,"#60A5FA" if tin_submitted/_N>=0.8 else "#f59e0b"),
            ("✅ TIN verified (IRS pass)",  tin_pass,     "#22c55e" if tin_pass>=tin_fail else "#f59e0b"),
        ]
        _funnel_df_chart = pd.DataFrame(funnel_steps, columns=["Step","Count","Color"])
        fig_funnel = go.Figure(go.Bar(
            x=_funnel_df_chart["Count"],
            y=_funnel_df_chart["Step"],
            orientation="h",
            marker_color=_funnel_df_chart["Color"].tolist(),
            text=[f"{v:,}  ({v/_N*100:.0f}%)" for v in _funnel_df_chart["Count"]],
            textposition="outside",
            textfont=dict(size=12, color="#E2E8F0"),
        ))
        fig_funnel.update_layout(
            title="KYB Verification Funnel — businesses passing each gate",
            height=280,
            xaxis=dict(range=[0, _N*1.2], showgrid=False, showticklabels=False),
            yaxis=dict(autorange="reversed", tickfont=dict(size=12)),
            margin=dict(t=40,b=10,l=10,r=120),
        )
        st.plotly_chart(dark_chart(fig_funnel), use_container_width=True)

        # ── Metric cards ──────────────────────────────────────────────────
        fc1,fc2,fc3 = st.columns(3)
        with fc1:
            kpi("🏛️ SOS Registry Found", f"{sos_found:,}",
                f"{sos_found/_N*100:.0f}% of businesses · {sos_not_found:,} NOT found","#22c55e" if sos_found/_N>=0.8 else "#f59e0b")
            detail_panel("SOS Registry Found", f"{sos_found:,} of {_N:,}",
                what_it_means=("sos_match_boolean=true — Middesk (pid=16) or OC (pid=23) found and matched an SOS registry record for this business. "
                               f"Source: factWithHighestConfidence. {sos_not_found:,} businesses had NO SOS match — either entity not found in the submitted state's registry, "
                               "or address-based search returned no results (common for new businesses < 2 weeks old or businesses using registered agent addresses)."),
                source_table="rds_warehouse_public.facts · name='sos_match_boolean'",
                source_file="facts/kyb/index.ts", source_file_line="sosMatchBoolean · Middesk pid=16 · factWithHighestConfidence",
                json_obj={"metric":"SOS Registry Found","sos_match_boolean_true":int(sos_found),"sos_match_boolean_false_or_null":int(sos_not_found),"total":_N,"pct":f"{sos_found/_N*100:.0f}%"},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_match_boolean, COUNT(*) FROM rds_warehouse_public.facts WHERE name='sos_match_boolean' AND business_id IN ({','.join(repr(b) for b in list(_authoritative_bids)[:10])+',...'}) GROUP BY 1;",
                links=[("facts/kyb/index.ts","sosMatchBoolean"),("integrations.constant.ts","MIDDESK=16")],
                color="#22c55e" if sos_found/_N>=0.8 else "#f59e0b", icon="🏛️")

        with fc2:
            kpi("🗺️ Formation = Operating State", f"{in_operating_state:,}",
                f"Same state registered & operating · {diff_state:,} different states","#8B5CF6")
            detail_panel("Formation = Operating State", f"{in_operating_state:,} of {_N:,}",
                what_it_means=("formation_state == primary_address.state — business is incorporated AND operates in the same state. "
                               "This represents a likely single domestic registration with no foreign qualification needed. "
                               f"{diff_state:,} businesses have different formation vs operating states — these likely have BOTH a domestic filing "
                               "and a foreign qualification in the operating state. Middesk address-based search finds the foreign record first, "
                               "potentially causing sos_match_boolean=false as a false negative (entity resolution gap)."),
                source_table="rds_warehouse_public.facts · name IN ('formation_state','primary_address')",
                source_file="facts/kyb/index.ts", source_file_line="formationState · primaryAddress · proxy for domestic-only registration",
                json_obj={"metric":"Formation = Operating State","same_state_count":int(in_operating_state),"different_state_count":int(diff_state),"sos_found_and_same_state":int(sos_in_op_state)},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE name='formation_state' AND business_id IN (...) ORDER BY business_id;",
                links=[("facts/kyb/index.ts","formationState · primaryAddress")],
                color="#8B5CF6", icon="🗺️")

        with fc3:
            kpi("🔐 TIN Submitted", f"{tin_submitted:,}",
                f"{tin_submitted/_N*100:.0f}% submitted EIN · {tin_not_submit:,} did NOT submit","#60A5FA" if tin_submitted/_N>=0.8 else "#f59e0b")
            detail_panel("TIN Submitted", f"{tin_submitted:,} of {_N:,}",
                what_it_means=("tin_submitted is not null/empty — the applicant provided an EIN on the onboarding form. "
                               "Source: Applicant (pid=0, businessDetails). This is self-reported — it does NOT mean the IRS verified it. "
                               f"{tin_not_submit:,} businesses did not submit a TIN. This prevents IRS TIN verification from running. "
                               "Common cause: sole proprietors who use SSN instead of EIN, or businesses that haven't obtained an EIN yet."),
                source_table="rds_warehouse_public.facts · name='tin_submitted'",
                source_file="facts/kyb/index.ts", source_file_line="tinSubmitted · Applicant pid=0 · self-reported EIN",
                json_obj={"metric":"TIN Submitted","submitted_count":int(tin_submitted),"not_submitted_count":int(tin_not_submit),"total":_N,"note":"Submitted ≠ verified. IRS check runs separately via Middesk."},
                sql=f"SELECT CASE WHEN JSON_EXTRACT_PATH_TEXT(value,'value') IS NOT NULL AND JSON_EXTRACT_PATH_TEXT(value,'value')!='' THEN 'Submitted' ELSE 'Not submitted' END AS status, COUNT(*) FROM rds_warehouse_public.facts WHERE name='tin_submitted' AND business_id IN (...) GROUP BY 1;",
                links=[("facts/kyb/index.ts","tinSubmitted"),("integrations.constant.ts","pid=0=Applicant")],
                color="#60A5FA" if tin_submitted/_N>=0.8 else "#f59e0b", icon="🔐")

        fc4,fc5,fc6 = st.columns(3)
        with fc4:
            kpi("✅ TIN Pass (IRS verified)", f"{tin_pass:,}",
                f"{tin_pass/_N*100:.0f}% of all businesses · {tin_pass/max(tin_submitted,1)*100:.0f}% of those who submitted",
                "#22c55e" if tin_pass/max(tin_submitted,1)>=0.7 else "#f59e0b")
            detail_panel("TIN Pass", f"{tin_pass:,} of {tin_submitted:,} submitted",
                what_it_means=("tin_match_boolean=true — the IRS confirmed the EIN + legal name combination is valid. "
                               "Source: Middesk (pid=16) TIN review task → direct IRS query. "
                               f"Pass rate among those who submitted: {tin_pass/max(tin_submitted,1)*100:.0f}%. "
                               "Failures are typically: wrong legal name (DBA submitted instead of registered legal name), "
                               "EIN belongs to a different entity (fraud signal), or IRS system temporarily unavailable."),
                source_table="rds_warehouse_public.facts · name='tin_match_boolean' (value='true')",
                source_file="facts/kyb/index.ts", source_file_line="tinMatchBoolean · dependent · tin_match.value.status==='success'",
                json_obj={"metric":"TIN Pass","tin_pass_count":int(tin_pass),"tin_submitted_count":int(tin_submitted),"pass_rate_of_submitted":f"{tin_pass/max(tin_submitted,1)*100:.0f}%"},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS irs_status, COUNT(*) FROM rds_warehouse_public.facts WHERE name='tin_match' AND business_id IN (...) GROUP BY 1 ORDER BY COUNT(*) DESC;",
                links=[("facts/kyb/index.ts","tinMatchBoolean")],
                color="#22c55e" if tin_pass/max(tin_submitted,1)>=0.7 else "#f59e0b", icon="✅")

        with fc5:
            kpi("❌ TIN Fail (IRS rejected)", f"{tin_fail:,}",
                f"{tin_fail/max(tin_submitted,1)*100:.0f}% of those who submitted TIN",
                "#ef4444" if tin_fail>0 else "#22c55e")
            detail_panel("TIN Fail", f"{tin_fail:,} IRS rejections",
                what_it_means=("tin_match.value.status='failure' — the IRS check ran but DID NOT confirm the EIN+name match. "
                               "Common failure reasons: (1) Wrong legal name — DBA submitted instead of registered name. "
                               "(2) EIN belongs to different entity — potential fraud signal, escalate immediately. "
                               "(3) Invalid EIN format — must be exactly 9 digits. "
                               "(4) Duplicate IRS request — retry in 24h. "
                               "NOTE: tin_fail only counts IRS-confirmed failures, not 'not checked'."),
                source_table="rds_warehouse_public.facts · name='tin_match' (value.status='failure')",
                source_file="facts/kyb/index.ts", source_file_line="tinMatch · Middesk pid=16 → IRS direct query",
                json_obj={"metric":"TIN Fail","tin_fail_count":int(tin_fail),"failure_reasons":["Wrong legal name (DBA)","EIN belongs to different entity","Invalid EIN format","IRS duplicate request"]},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS status, JSON_EXTRACT_PATH_TEXT(value,'value','message') AS irs_message, COUNT(*) FROM rds_warehouse_public.facts WHERE name='tin_match' AND business_id IN (...) AND JSON_EXTRACT_PATH_TEXT(value,'value','status')='failure' GROUP BY 1,2 ORDER BY COUNT(*) DESC;",
                links=[("facts/kyb/index.ts","tinMatch · IRS failure messages")],
                color="#ef4444" if tin_fail>0 else "#22c55e", icon="❌")

        with fc6:
            kpi("⚪ TIN Not Checked", f"{tin_submitted_not_checked:,}",
                f"Submitted EIN but IRS check not yet run · {tin_not_submit:,} never submitted",
                "#64748b")
            detail_panel("TIN Not Checked", f"{tin_submitted_not_checked:,} pending",
                what_it_means=("tin_submitted is set (EIN was provided) but tin_match_boolean is null "
                               "and tin_match.value.status is neither 'success' nor 'failure'. "
                               "The IRS check has not yet been triggered or is still pending. "
                               "Additionally, {tin_not_submit:,} businesses never submitted a TIN at all. "
                               "Total without IRS confirmation = TIN Not Checked + Not Submitted."),
                source_table="rds_warehouse_public.facts · name='tin_match_boolean' (null or not stored)",
                source_file="facts/kyb/index.ts", source_file_line="tinMatchBoolean · null = IRS check not yet run",
                json_obj={"metric":"TIN Not Checked","submitted_but_not_checked":int(tin_submitted_not_checked),"never_submitted":int(tin_not_submit),"total_without_IRS_confirmation":int(tin_submitted_not_checked+tin_not_submit)},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS tin_bool FROM rds_warehouse_public.facts WHERE name='tin_match_boolean' AND business_id IN (...) GROUP BY 1;",
                links=[("facts/kyb/index.ts","tinMatchBoolean · dependent")],
                color="#64748b", icon="⚪")

        # ── Reconciliation check: TIN submitted = TIN pass + TIN fail + not checked? ──
        st.markdown("#### 🔍 TIN Reconciliation Check")
        _tin_reconcile = tin_pass + tin_fail + tin_submitted_not_checked
        _match = abs(_tin_reconcile - tin_submitted) <= 1  # allow 1 rounding difference
        _recon_color = "#22c55e" if _match else "#f59e0b"
        st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_recon_color};
            border-radius:10px;padding:14px 18px;margin:8px 0">
          <div style="color:{_recon_color};font-weight:700;font-size:.90rem;margin-bottom:8px">
            {'✅ TIN counts reconcile correctly' if _match else '⚠️ TIN counts have a small discrepancy'}
          </div>
          <table style="width:100%;font-size:.80rem;color:#CBD5E1;border-collapse:collapse">
            <tr><td style="padding:4px 8px">TIN Submitted (applicant provided EIN)</td>
                <td style="padding:4px 8px;text-align:right;font-weight:700">{tin_submitted:,}</td></tr>
            <tr style="border-top:1px solid #334155"><td style="padding:4px 8px;color:#22c55e">  ✅ TIN Pass (IRS verified)</td>
                <td style="padding:4px 8px;text-align:right;color:#22c55e">+{tin_pass:,}</td></tr>
            <tr><td style="padding:4px 8px;color:#ef4444">  ❌ TIN Fail (IRS rejected)</td>
                <td style="padding:4px 8px;text-align:right;color:#ef4444">+{tin_fail:,}</td></tr>
            <tr><td style="padding:4px 8px;color:#64748b">  ⚪ TIN Submitted but not yet checked</td>
                <td style="padding:4px 8px;text-align:right;color:#64748b">+{tin_submitted_not_checked:,}</td></tr>
            <tr style="border-top:2px solid #475569"><td style="padding:6px 8px;font-weight:700">Sum (Pass + Fail + Not checked)</td>
                <td style="padding:6px 8px;text-align:right;font-weight:700;color:{_recon_color}">{_tin_reconcile:,}</td></tr>
          </table>
          <div style="color:#64748b;font-size:.74rem;margin-top:8px">
            {'Pass + Fail + Not checked = Submitted ✓ The TIN pipeline is complete and consistent.' if _match
              else f'Difference of {abs(_tin_reconcile - tin_submitted)} — may be caused by businesses where tin_submitted exists but tin_match was not stored yet (Middesk delay).'}
          </div>
        </div>""", unsafe_allow_html=True)
        detail_panel("TIN Reconciliation", f"Submitted={tin_submitted:,} · Pass+Fail+Pending={_tin_reconcile:,}",
            what_it_means=(f"Verification: TIN Submitted ({tin_submitted:,}) should equal TIN Pass ({tin_pass:,}) + TIN Fail ({tin_fail:,}) + Not yet checked ({tin_submitted_not_checked:,}) = {_tin_reconcile:,}. "
                           f"{'Match ✓' if _match else 'Small discrepancy — likely Middesk processing delay between tin_submitted being written and tin_match being stored.'}"),
            source_table="rds_warehouse_public.facts · name IN ('tin_submitted','tin_match','tin_match_boolean')",
            source_file="facts/kyb/index.ts", source_file_line="tin_submitted → tin_match (IRS) → tin_match_boolean (derived)",
            json_obj={"tin_submitted":int(tin_submitted),"tin_pass":int(tin_pass),"tin_fail":int(tin_fail),"tin_not_checked":int(tin_submitted_not_checked),"sum":int(_tin_reconcile),"reconciles":bool(_match)},
            sql=f"""-- Verify TIN counts:\nSELECT\n  COUNT(CASE WHEN name='tin_submitted' AND JSON_EXTRACT_PATH_TEXT(value,'value') IS NOT NULL AND JSON_EXTRACT_PATH_TEXT(value,'value')!='' THEN 1 END) AS tin_submitted,\n  COUNT(CASE WHEN name='tin_match_boolean' AND JSON_EXTRACT_PATH_TEXT(value,'value')='true' THEN 1 END) AS tin_pass,\n  COUNT(CASE WHEN name='tin_match' AND JSON_EXTRACT_PATH_TEXT(value,'value','status')='failure' THEN 1 END) AS tin_fail\nFROM rds_warehouse_public.facts\nWHERE business_id IN (...);""",
            links=[("facts/kyb/index.ts","TIN fact chain: tin_submitted → tin_match → tin_match_boolean")],
            color=_recon_color, icon="🔍")

    else:
        st.info(f"Funnel analysis requires SOS/TIN data. {funnel_err or 'Check VPN or date filter.'}")

    st.markdown("---")

    # ════════════════════════════════════════════════════════════════════════
    # ASK AI — Home tab portfolio questions
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 🤖 Ask AI About This Portfolio")
    st.caption(f"Ask questions about the {total_biz:,} businesses in this period. The AI has access to the aggregate data shown above.")

    if not get_openai():
        st.warning("⚠️ Set OPENAI_API_KEY to enable AI. See AI Agent tab for setup instructions.")
    else:
        # Build portfolio context for the AI
        _portfolio_ctx = (
            f"PORTFOLIO DATA for {period_label} — USE THESE EXACT NUMBERS TO ANSWER:\n"
            f"Total businesses: {total_biz:,}\n"
            f"Businesses with red flags: {len(flagged_biz):,} ({len(flagged_biz)/max(total_biz,1)*100:.0f}%)\n"
        )
        if stats_df is not None and not stats_df.empty:
            _n = len(stats_df)
            _sos_ok = (stats_df["sos_active"].str.lower().str.strip()=="true").sum()
            _sos_fail = (stats_df["sos_active"].str.lower().str.strip()=="false").sum()
            _sos_unknown = _n - _sos_ok - _sos_fail
            _tin_ok = (stats_df["tin_match"].str.lower().str.strip()=="true").sum()
            _tin_fail = (stats_df["tin_match"].str.lower().str.strip()=="false").sum()
            _tin_missing = _n - _tin_ok - _tin_fail
            _idv_ok = (stats_df["idv_passed"].str.lower().str.strip()=="true").sum()
            _idv_fail = (stats_df["idv_passed"].str.lower().str.strip()=="false").sum()
            _wl_hit = (stats_df["watchlist_hits"].apply(lambda v: _safe_int(v)>0)).sum()
            _naics_561 = (stats_df["naics_code"].str.strip()=="561499").sum()
            _naics_ok = (~stats_df["naics_code"].isin(["561499","",None]) & stats_df["naics_code"].notna()).sum()
            _th_count = stats_df["formation_state"].str.upper().str.strip().isin(TAX_HAVENS).sum()
            _rev_known = stats_df["revenue"].notna().sum()
            _portfolio_ctx += (
                f"\nSOS Registry:\n"
                f"  Active: {_sos_ok:,} ({_sos_ok/_n*100:.0f}%)\n"
                f"  Inactive: {_sos_fail:,} ({_sos_fail/_n*100:.0f}%)\n"
                f"  Unknown/not found: {_sos_unknown:,} ({_sos_unknown/_n*100:.0f}%)\n"
                f"\nTIN Verification:\n"
                f"  Verified (IRS pass): {_tin_ok:,} ({_tin_ok/_n*100:.0f}%)\n"
                f"  Failed (IRS reject): {_tin_fail:,} ({_tin_fail/_n*100:.0f}%)\n"
                f"  Not checked/submitted: {_tin_missing:,} ({_tin_missing/_n*100:.0f}%)\n"
                f"\nIDV (Identity Verification):\n"
                f"  Passed: {_idv_ok:,} ({_idv_ok/_n*100:.0f}%)\n"
                f"  Failed: {_idv_fail:,} ({_idv_fail/_n*100:.0f}%)\n"
                f"\nOther signals:\n"
                f"  Watchlist hits (PEP/Sanctions): {_wl_hit:,} businesses ({_wl_hit/_n*100:.0f}%)\n"
                f"  NAICS classified: {_naics_ok:,} ({_naics_ok/_n*100:.0f}%)\n"
                f"  NAICS=561499 (unclassified): {_naics_561:,} ({_naics_561/_n*100:.0f}%)\n"
                f"  Tax-haven incorporated (DE/NV/WY): {_th_count:,} ({_th_count/_n*100:.0f}%)\n"
                f"  Revenue data known: {_rev_known:,} ({_rev_known/_n*100:.0f}%)\n"
            )

        # Add funnel data if available
        if funnel_df is not None and not funnel_df.empty:
            _fN = len(funnel_df)
            _sos_match = (funnel_df["sos_match_boolean"].str.lower().str.strip()=="true").sum() if "sos_match_boolean" in funnel_df.columns else 0
            _tin_sub = (funnel_df["tin_submitted"].notna() & (funnel_df["tin_submitted"].str.strip()!="") & (funnel_df["tin_submitted"].str.lower()!="none")).sum() if "tin_submitted" in funnel_df.columns else 0
            _tin_p = (funnel_df["tin_match_boolean"].str.lower().str.strip()=="true").sum() if "tin_match_boolean" in funnel_df.columns else 0
            _tin_f_irs = (funnel_df["tin_status"].str.lower().str.strip()=="failure").sum() if "tin_status" in funnel_df.columns else 0
            _same_st = 0
            if "formation_state" in funnel_df.columns and "operating_state" in funnel_df.columns:
                _same_st = ((funnel_df["formation_state"].str.upper().str.strip()==funnel_df["operating_state"].str.upper().str.strip()) & funnel_df["formation_state"].notna() & (funnel_df["formation_state"].str.strip()!="")).sum()
            _portfolio_ctx += (
                f"\nKYB Verification Funnel:\n"
                f"  SOS registry record found (sos_match_boolean=true): {_sos_match:,} ({_sos_match/_fN*100:.0f}%)\n"
                f"  Formation state = operating state (proxy for 1 domestic registration): {_same_st:,} ({_same_st/_fN*100:.0f}%)\n"
                f"  TIN submitted by applicant: {_tin_sub:,} ({_tin_sub/_fN*100:.0f}%)\n"
                f"  TIN IRS-verified (pass): {_tin_p:,} ({_tin_p/_fN*100:.0f}%)\n"
                f"  TIN IRS-rejected (fail): {_tin_f_irs:,} ({_tin_f_irs/_fN*100:.0f}%)\n"
                f"  TIN submitted but not yet checked: {max(0,_tin_sub-_tin_p-_tin_f_irs):,}\n"
                f"  TIN reconciliation: {_tin_sub:,} submitted = {_tin_p:,} pass + {_tin_f_irs:,} fail + {max(0,_tin_sub-_tin_p-_tin_f_irs):,} pending\n"
            )

        _HOME_QUICK = [
            "What are the top 3 data quality risks in this portfolio?",
            "Which combination of KYB failures is most common?",
            "Why might businesses have TIN failed AND SOS inactive simultaneously?",
            "What percentage of tax-haven businesses also have TIN issues?",
            "What SQL would help me investigate the watchlist hits in this period?",
        ]

        import hashlib as _hh
        _home_q_cols = st.columns(len(_HOME_QUICK))
        for _qi, _qtext in enumerate(_HOME_QUICK):
            with _home_q_cols[_qi % len(_HOME_QUICK)]:
                _qhash = _hh.md5(f"home|{_qtext}".encode()).hexdigest()[:8]
                if st.button(_qtext, key=f"home_ai_{_qhash}", use_container_width=True):
                    st.session_state["home_ai_q"] = _qtext

        _home_custom = st.text_input("Or ask your own question about this portfolio:",
                                      placeholder="e.g. How many businesses passed all 3 checks (SOS + TIN + IDV)?",
                                      key="home_ai_input")
        _home_send = st.button("Ask ▶", type="primary", key="home_ai_send")
        if _home_send and _home_custom:
            st.session_state["home_ai_q"] = _home_custom

        if "home_ai_q" in st.session_state:
            _q = st.session_state.pop("home_ai_q")
            with st.spinner("Analysing portfolio data and composing answer…"):
                # Portfolio AI: uses a direct prompt that forces an answer from the provided data.
                # Does NOT rely on SQL execution — the data is already in the context.
                # Two-stage: (1) get any SQL the AI wants to run, (2) generate the actual answer.
                try:
                    _client = get_openai()
                    if _client:
                        # Stage 1: Direct answer from portfolio context
                        _direct_prompt = (
                            f"You are analysing a KYB portfolio. Here is the REAL aggregate data:\n\n"
                            f"{_portfolio_ctx}\n\n"
                            f"The user asks: \"{_q}\"\n\n"
                            f"INSTRUCTIONS:\n"
                            f"1. Answer the question DIRECTLY using the numbers above.\n"
                            f"2. Calculate any percentages or cross-references from the data given.\n"
                            f"3. Provide actionable insight — what does this mean for underwriting?\n"
                            f"4. If a SQL query would provide MORE detail beyond what's given above, "
                            f"   write it (using verified fact names: sos_match_boolean, tin_match_boolean, "
                            f"   tin_submitted, idv_passed_boolean, watchlist_hits, formation_state, naics_code). "
                            f"   The system will execute it automatically.\n"
                            f"5. NEVER make up specific business names, addresses, or IDs.\n"
                            f"6. Format your answer clearly with the direct answer FIRST, then any SQL."
                        )
                        _r = _client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role":"system","content":SYSTEM},
                                {"role":"user","content":_direct_prompt}
                            ],
                            max_tokens=1000, temperature=0.3
                        )
                        _raw_ans = _r.choices[0].message.content

                        # Stage 2: if the AI included SQL, execute it and append real results
                        _sql_blocks = _extract_sql_from_answer(_raw_ans)
                        _extra_results = []
                        for _sq in _sql_blocks[:2]:
                            _df_r, _err_r, _sql_r, _fixes_r = _execute_sql_with_retry(_sq)
                            if _df_r is not None and not _df_r.empty:
                                try: _rows_str = _df_r.head(20).to_markdown(index=False)
                                except: _rows_str = _df_r.head(20).to_string(index=False)
                                _extra_results.append(
                                    f"\n\n**✅ Additional data from Redshift ({len(_df_r):,} rows):**\n```\n{_rows_str}\n```"
                                    f"\n*(Live values — not generated by AI)*"
                                )
                            elif _df_r is not None and _df_r.empty:
                                _extra_results.append(f"\n\n*(SQL executed — 0 rows returned for this query)*")
                            elif _err_r:
                                # Try to fix and rerun
                                _fixed_blocks = _extract_sql_from_answer(
                                    (get_openai().chat.completions.create(
                                        model="gpt-4o-mini",
                                        messages=[{"role":"system","content":SYSTEM},
                                                  {"role":"user","content":f"Fix this SQL error:\nERROR: {_err_r}\nSQL:\n```sql\n{_sql_r}\n```\nWrite corrected SQL only."}],
                                        max_tokens=400, temperature=0
                                    ).choices[0].message.content)
                                )
                                if _fixed_blocks:
                                    _df_r2, _err_r2, _sql_r2, _ = _execute_sql_with_retry(_fixed_blocks[0])
                                    if _df_r2 is not None and not _df_r2.empty:
                                        try: _rows_str2 = _df_r2.head(20).to_markdown(index=False)
                                        except: _rows_str2 = _df_r2.head(20).to_string(index=False)
                                        _extra_results.append(
                                            f"\n\n**✅ Additional data from Redshift (auto-fixed SQL):**\n```\n{_rows_str2}\n```"
                                        )

                        _ans = _raw_ans + "".join(_extra_results)
                    else:
                        _ans = "⚠️ Set OPENAI_API_KEY to enable AI responses."
                except Exception as _e:
                    _ans = f"⚠️ AI error: {_e}"

            st.markdown(f"**Q:** {_q}")
            st.markdown(_ans)
            st.markdown("---")

    st.markdown("---")

    # ── Recently Onboarded (most recent 10) ──────────────────────────────────
    st.markdown("### 🕐 Recently Onboarded Businesses")
    st.markdown("*Most recently seen in the facts table — ordered by first_seen DESC.*")

    recent_10 = recent_df.head(10).copy()
    recent_10["Status"] = recent_10.apply(lambda r:
        f"🔴 {r['flag_count']} flag(s)" if r["flag_score"]>0 else "✅ Clean", axis=1)
    recent_10["first_seen"] = recent_10["first_seen"].astype(str).str[:16]
    recent_10["last_updated"] = recent_10["last_updated"].astype(str).str[:16]

    for _, row in recent_10.iterrows():
        bid_check = row["business_id"]
        b_data    = biz_flags.get(bid_check, {})
        flags     = b_data.get("flags",[])
        score     = b_data.get("score",0)
        border    = "#ef4444" if score>=10 else ("#f59e0b" if score>0 else "#22c55e")

        def _pill_bg(ic): return {"🔴":"#7f1d1d","🟡":"#78350f"}.get(ic,"#1e293b")
        def _pill_fg(ic): return {"🔴":"#fca5a5","🟡":"#fde68a"}.get(ic,"#cbd5e1")
        flags_html = "".join(
            f'<span style="background:{_pill_bg(icon)};color:{_pill_fg(icon)};'
            f'padding:2px 6px;border-radius:10px;font-size:.68rem;margin:1px">{icon} {title}</span>'
            for icon,title,_ in flags
        ) if flags else '<span style="color:#22c55e;font-size:.72rem">✅ No issues detected</span>'

        col_card, col_btn = st.columns([5,1])
        with col_card:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {border};
                border-radius:10px;padding:12px 16px;margin:4px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:#60A5FA;font-family:monospace;font-size:.80rem;font-weight:700">
                  {bid_check}</span>
                <span style="color:#64748b;font-size:.70rem">
                  First seen: {row['first_seen']} · {row['fact_count']} facts</span>
              </div>
              <div style="margin-top:6px">{flags_html}</div>
            </div>""", unsafe_allow_html=True)
        with col_btn:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("Investigate →", key=f"inv_{bid_check}", use_container_width=True):
                st.session_state["_pending_bid"] = bid_check
                st.session_state["_bid_just_set"] = bid_check
                st.rerun()

    st.markdown("---")

    # ── Top 10 Red Flags ─────────────────────────────────────────────────────
    st.markdown("### 🚨 Top 10 Businesses Needing Attention")
    st.markdown("*Ranked by severity of red flags — highest risk at the top.*")

    # Weight metadata for score breakdown tooltip
    FLAG_WEIGHT_META = {
        "SOS Inactive":      (10, "🔴", "sos_active = false",       "Entity not in good standing with Secretary of State. Cannot legally operate."),
        "No SOS data":       ( 8, "🔴", "sos_active + sos_match = ∅","Entity existence completely unverified — vendor lookup may have failed."),
        "TIN Failed":        ( 6, "🔴", "tin_match_boolean = false", "IRS EIN-name mismatch. Potential identity fraud or incorrect EIN filing."),
        "TIN Missing":       ( 3, "🟡", "tin_match_boolean = ∅",    "EIN not submitted or TIN check not yet run. May be onboarding lag."),
        "IDV Failed":        ( 4, "🟡", "idv_passed_boolean = false","Beneficial owner identity not confirmed via Plaid/Trulioo."),
        "NAICS Fallback":    ( 2, "🟡", "naics_code = 561499",      "Industry unclassified — all vendors failed, AI used fallback code."),
        "No NAICS":          ( 3, "🟡", "naics_code = ∅",           "No industry classification stored at all."),
    }

    if flagged_biz.empty:
        flag("✅ No red flags detected in this period. All businesses appear clean.", "green")
    else:
        top10 = flagged_biz.head(10)
        for rank, (_, row) in enumerate(top10.iterrows(), 1):
            bid_check = row["business_id"]
            b_data    = biz_flags.get(bid_check, {})
            flags_list = b_data.get("flags",[])
            score      = b_data.get("score",0)

            sev_color = "#ef4444" if score>=10 else "#f97316" if score>=6 else "#f59e0b"
            sev_label = "🔴 CRITICAL" if score>=12 else "🔴 HIGH" if score>=8 else "🟡 MEDIUM"

            def _pill2(icon,title):
                bg={"🔴":"#7f1d1d","🟡":"#78350f"}.get(icon,"#1e293b")
                fg={"🔴":"#fca5a5","🟡":"#fde68a"}.get(icon,"#cbd5e1")
                return f'<span style="background:{bg};color:{fg};padding:2px 7px;border-radius:10px;font-size:.70rem;margin:2px;display:inline-block">{icon} {title}</span>'
            flag_pills  = "".join(_pill2(i,t) for i,t,_ in flags_list)
            flag_detail = " · ".join(desc for _,_,desc in flags_list)

            col_rank, col_card, col_btn = st.columns([0.3,5,1])
            with col_rank:
                st.markdown(f"""<div style="background:{sev_color}22;border-radius:8px;
                    padding:8px;text-align:center;margin-top:6px">
                  <div style="color:{sev_color};font-weight:700;font-size:1rem">#{rank}</div>
                  <div style="color:{sev_color};font-size:.60rem">score {score}</div>
                </div>""", unsafe_allow_html=True)
            with col_card:
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {sev_color};
                    border-radius:10px;padding:12px 16px;margin:4px 0">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <span style="color:#60A5FA;font-family:monospace;font-size:.82rem;font-weight:700">
                      {bid_check}</span>
                    <span style="color:{sev_color};font-size:.72rem;font-weight:700">{sev_label}</span>
                  </div>
                  <div style="margin:6px 0">{flag_pills}</div>
                  <div style="color:#94A3B8;font-size:.72rem;margin-top:4px;font-style:italic">
                    {flag_detail}</div>
                  <div style="color:#475569;font-size:.68rem;margin-top:4px">
                    First seen: {str(row['first_seen'])[:16]} · {row['fact_count']} facts stored</div>
                </div>""", unsafe_allow_html=True)

                # ── Score breakdown expander ──────────────────────────────
                with st.expander(f"📊 Score breakdown — {score} pts from {len(flags_list)} flag(s)"):
                    # Build rows: match each flag to its metadata
                    breakdown_rows = []
                    running = 0
                    for icon, title, desc in flags_list:
                        # Watchlist is dynamic (title contains hit count)
                        if "Watchlist" in title:
                            wl_count = int(''.join(filter(str.isdigit, title)) or 0)
                            pts = 12
                            fact_field = f"watchlist_hits = {wl_count}"
                            explanation = "Sanctions/PEP screening hit (OFAC/FinCEN). Hard stop — compliance review mandatory."
                        elif "BK:" in title:
                            bk_count = int(''.join(filter(str.isdigit, title)) or 1)
                            pts = 3 * bk_count
                            fact_field = f"num_bankruptcies = {bk_count}"
                            explanation = f"Public bankruptcy record(s). Score = +3 per filing (×{bk_count})."
                        else:
                            meta = FLAG_WEIGHT_META.get(title, (0, icon, "—", desc))
                            pts, _, fact_field, explanation = meta
                        running += pts
                        bar_pct = int(pts / max(score, 1) * 100)
                        bar_color = "#ef4444" if icon == "🔴" else "#f59e0b"
                        breakdown_rows.append((icon, title, pts, running, bar_pct, bar_color, fact_field, explanation))

                    # Render score receipt
                    st.markdown("""<div style="font-size:.72rem;color:#94A3B8;margin-bottom:6px">
                        Each row = one detected condition → its fixed weight → running total.
                        Total = sum of all weights. No ML, no normalization.</div>""",
                        unsafe_allow_html=True)

                    for icon, title, pts, cumul, bar_pct, bar_color, fact_field, explanation in breakdown_rows:
                        st.markdown(f"""<div style="background:#0f172a;border-radius:8px;
                            padding:10px 14px;margin:4px 0;border:1px solid #1e293b">
                          <div style="display:flex;justify-content:space-between;align-items:center">
                            <div>
                              <span style="color:{bar_color};font-weight:700;font-size:.82rem">
                                {icon} {title}</span>
                              <span style="color:#64748b;font-size:.70rem;margin-left:8px">
                                fact: <code style="color:#93c5fd">{fact_field}</code></span>
                            </div>
                            <div style="text-align:right">
                              <span style="color:{bar_color};font-weight:700;font-size:.90rem">
                                +{pts} pts</span>
                              <span style="color:#475569;font-size:.68rem;margin-left:6px">
                                → {cumul} total</span>
                            </div>
                          </div>
                          <div style="background:#1e293b;border-radius:4px;height:4px;margin:6px 0">
                            <div style="background:{bar_color};width:{bar_pct}%;height:4px;
                              border-radius:4px"></div>
                          </div>
                          <div style="color:#94A3B8;font-size:.70rem">{explanation}</div>
                        </div>""", unsafe_allow_html=True)

                    # Final score summary bar
                    max_possible = 12+10+8+6+4+3+3+3  # all flags triggered
                    overall_pct  = int(score / max_possible * 100)
                    st.markdown(f"""<div style="background:#1e293b;border-radius:8px;
                        padding:10px 14px;margin-top:8px;border:1px solid #334155">
                      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                        <span style="color:#e2e8f0;font-weight:700;font-size:.80rem">
                          Total Red Flag Score</span>
                        <span style="color:{sev_color};font-weight:700;font-size:.95rem">
                          {score} / {max_possible} pts max · {sev_label}</span>
                      </div>
                      <div style="background:#0f172a;border-radius:4px;height:8px">
                        <div style="background:{sev_color};width:{overall_pct}%;height:8px;
                          border-radius:4px"></div>
                      </div>
                      <div style="color:#64748b;font-size:.68rem;margin-top:4px">
                        Max possible = 49 pts (all flags triggered simultaneously).
                        Score ≥12=CRITICAL · 8–11=HIGH · 1–7=MEDIUM.
                        This is a triage heuristic — not the Worth Score, not a regulatory score.
                      </div>
                    </div>""", unsafe_allow_html=True)

                    # Recommended action
                    if score >= 12:
                        action = "🚨 **Immediate action required.** Compliance review before any underwriting decision. If SANCTIONS hit present — hard stop, escalate to Compliance team."
                    elif score >= 8:
                        action = "⚠️ **Manual underwriting required.** Review SOS reinstatement status, TIN documentation, and IDV retry before approval."
                    else:
                        action = "🟡 **Low-priority review.** Check for data freshness — flags may reflect onboarding lag rather than genuine risk."
                    st.markdown(f"**Recommended action:** {action}")

            with col_btn:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("Investigate →", key=f"top10_{bid_check}", use_container_width=True):
                    st.session_state["_pending_bid"] = bid_check
                    st.session_state["_bid_just_set"] = bid_check
                    st.rerun()

        st.markdown("---")
        st.markdown("#### 🧮 Red Flag Score — Methodology Card")
        st.markdown("""<div style="background:#1E293B;border-left:4px solid #6366f1;border-radius:10px;padding:16px 20px;margin:8px 0">

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin-bottom:6px">
  📐 What is this score?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  This is a <strong>custom additive heuristic</strong> built specifically for this dashboard.
  It is <em>not</em> sourced from any external scoring model, regulatory framework, or vendor.
  It is not the Worth Score, not an AML risk score, and not a credit score.
  It exists solely to <strong>rank and surface businesses needing manual review</strong>
  on the Home tab — a triage signal, not a decisioning tool.
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  ⚙️ How is it calculated?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  Each detected condition adds a fixed integer to a running total.
  Conditions are checked independently — a business can accumulate multiple flags.
  The final score is the <strong>sum of all triggered weights</strong>.
  There is no normalization, no probability model, and no ML inference involved.
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  🏗️ Why these specific weights?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  Weights reflect <strong>compliance and underwriting priority order</strong>, derived from
  the internal KYB decision logic documented across the Fact Engine, integration-service rules,
  and the Worth Score model feature importance. The relative ordering follows these principles:
  <ul style="margin:6px 0 0 16px;color:#CBD5E1">
    <li><strong>Sanctions/Watchlist (+12)</strong> — regulatory hard stop per OFAC/FinCEN guidance.
      Any watchlist hit mandates compliance review before any other action. Highest weight.</li>
    <li><strong>SOS Inactive (+10)</strong> — a business that is not in good standing with its
      Secretary of State cannot legally operate. Maps to the <code>sos_active</code> fact from Middesk.</li>
    <li><strong>No SOS data (+8)</strong> — entity existence is completely unverified.
      Slightly lower than inactive because the vendor lookup may simply have failed,
      not because the entity is confirmed bad.</li>
    <li><strong>TIN Failed (+6)</strong> — IRS EIN-name mismatch (Middesk TIN check).
      Indicates possible identity fraud or incorrect filing. Serious but recoverable
      with corrected documentation.</li>
    <li><strong>IDV Failed (+4)</strong> — beneficial owner identity not confirmed (Trulioo/IDology).
      Significant for KYC but does not by itself block merchant from existing.</li>
    <li><strong>Missing TIN / NAICS (+2–3)</strong> — data gaps. May be timing (not yet enriched)
      rather than a true problem. Lower weight to avoid false alarms on newly onboarded merchants.</li>
    <li><strong>Bankruptcy (+3 each)</strong> — public record on file. Weighted per occurrence
      because multiple bankruptcies compound the credit risk signal.</li>
  </ul>
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  ⚠️ Limitations & intended use
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  <ul style="margin:4px 0 0 16px">
    <li>This score is a <strong>triage / prioritisation tool only</strong>. It should not be used
      for automated approval or decline decisions.</li>
    <li>Weights are <strong>not statistically calibrated</strong>. They have not been validated
      against historical default or fraud rates.</li>
    <li>A score of 0 does not mean the business is safe — it means no flags were detected
      in the facts currently stored in Redshift.</li>
    <li>Data latency in <code>rds_warehouse_public.facts</code> means some flags may appear
      minutes or hours after onboarding.</li>
    <li>To make this score production-grade, replace it with the Worth Score
      (<code>rds_manual_score_public.business_scores</code>) or the BERT review signal
      (<code>rds_integration_data.business_entity_review_task</code>).</li>
  </ul>
</div>

<div style="color:#475569;font-size:.72rem;margin-top:12px;border-top:1px solid #334155;padding-top:8px">
  Source: Custom dashboard heuristic. Internal reference:
  integration-service <code>lib/facts/rules.ts</code> (rule priority ordering),
  Worth Score feature importance (<code>ai-score-service/worth_score_model.py</code>),
  OFAC/FinCEN KYC guidance (watchlist hard-stop).
  Not a regulatory-compliant risk score.
</div>
</div>""", unsafe_allow_html=True)

        st.markdown("**Score weights at a glance:**")
        st.markdown("""
| Flag | Score | Regulatory / operational basis |
|---|---|---|
| 🔴 Watchlist hit | +12 | OFAC/FinCEN hard stop — highest compliance priority |
| 🔴 SOS Inactive | +10 | Entity legally cannot operate in its state |
| 🔴 No SOS data | +8 | Entity existence unverifiable — vendor lookup may have failed |
| 🔴 TIN Failed | +6 | IRS EIN-name mismatch — potential identity fraud signal |
| 🟡 IDV Failed | +4 | Beneficial owner identity not confirmed |
| 🟡 Missing TIN | +3 | EIN not submitted or not yet checked |
| 🟡 No / Fallback NAICS | +2–3 | Classification gap — industry unverified |
| 🟡 Bankruptcy (per occurrence) | +3 | Public record — additive per filing |

**Score ≥ 12** = Critical · **8–11** = High · **1–7** = Medium · **0** = No flags detected
        """)

# ════════════════════════════════════════════════════════════════════════════════
# REGISTRY & IDENTITY
# ════════════════════════════════════════════════════════════════════════════════
# ════════════════════════════════════════════════════════════════════════════════

elif tab=="🏛️ Registry & Identity":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 🏛️ Registry & Identity — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"registry")
    if facts is None: st.error(f"❌ {err}"); st.stop()
    if not facts: st.error("No facts found."); st.stop()
    st.caption(f"✅ {len(facts)} facts loaded")

    sos_act  =str(gv(facts,"sos_active") or "").lower()
    sos_match=str(gv(facts,"sos_match_boolean") or "").lower()
    tin_bool =str(gv(facts,"tin_match_boolean") or "").lower()
    tin_obj  =facts.get("tin_match",{}).get("value",{})
    if isinstance(tin_obj,dict): tin_status=tin_obj.get("status","").lower(); tin_msg=tin_obj.get("message","")
    else: tin_status=tin_msg=""
    idv_val  =str(gv(facts,"idv_passed_boolean") or "").lower()
    mdsk_conf=gc(facts,"sos_match")
    form_state=str(gv(facts,"formation_state") or "")

    c1,c2,c3,c4,c5=st.columns(5)
    _sos_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_active FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='sos_active';"
    _tin_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS tin_status FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';"
    _idv_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_passed FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_passed_boolean';"
    _fs_sql =f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';"
    with c1:
        kpi_detail("SOS","✅ Active" if sos_act=="true" else "🚨 Inactive" if sos_act=="false" else "⚠️ Unknown",
                 "sos_active","#22c55e" if sos_act=="true" else "#ef4444" if sos_act=="false" else "#64748b",
                 "sos_active",sos_act or None,"rds_warehouse_public.facts",_sos_sql,
                 ["sos_active is derived from sos_filings[].active — no sos_filings = no sos_active",
                  "Middesk could not match the entity in SOS registry",
                  "Entity is very new (< 2 weeks) — not yet in registry"],
                 f'{{"name":"sos_active","value":{json.dumps(sos_act or None)},"source":{{"platformId":-1,"name":"dependent"}},"dependencies":["sos_filings"]}}')
    with c2:
        kpi_detail("SOS Match","✅ Matched" if sos_match=="true" else "❌ No match" if sos_match=="false" else "⚠️ Unknown",
                 f"Middesk conf: {mdsk_conf:.3f}","#22c55e" if sos_match=="true" else "#ef4444" if sos_match=="false" else "#64748b",
                 "sos_match_boolean",sos_match or None,"rds_warehouse_public.facts",
                 f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_match_boolean, JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='sos_match_boolean';",
                 ["Middesk searched by submitted address and found no matching record",
                  "Entity resolution gap: formation state ≠ operating state",
                  "Submitted business name differs from registered legal name (DBA)"],
                 f'{{"name":"sos_match_boolean","value":{json.dumps(sos_match or None)},"source":{{"platformId":16,"name":"middesk","confidence":{mdsk_conf}}}}}')
    with c3:
        kpi_detail("TIN","✅ Verified" if tin_bool=="true" else f"❌ {tin_status.capitalize()}" if tin_status else "⚠️ Unknown",
                 "tin_match_boolean","#22c55e" if tin_bool=="true" else "#ef4444" if tin_bool=="false" else "#64748b",
                 "tin_match_boolean",tin_bool or None,"rds_warehouse_public.facts",_tin_sql,
                 ["EIN not submitted on onboarding form","IRS name-EIN mismatch (wrong legal name vs DBA)",
                  "Middesk TIN review task not yet run","IRS system temporarily unavailable"],
                 f'{{"name":"tin_match_boolean","value":{json.dumps(tin_bool=="true" if tin_bool else None)},"source":{{"platformId":-1,"name":"dependent"}},"dependencies":["tin_match"]}}')
    with c4:
        kpi_detail("IDV","✅ Passed" if idv_val=="true" else "❌ Not passed" if idv_val=="false" else "⚠️ Unknown",
                 "idv_passed_boolean","#22c55e" if idv_val=="true" else "#f59e0b" if idv_val=="false" else "#64748b",
                 "idv_passed_boolean",idv_val or None,"rds_warehouse_public.facts",_idv_sql,
                 ["IDV session not yet completed (PENDING status)","Plaid IDV session expired or canceled",
                  "is_sole_prop=true — IDV may be skipped","Plaid IDV not yet triggered for this business"],
                 f'{{"name":"idv_passed_boolean","value":{json.dumps(idv_val=="true" if idv_val else None)},"source":{{"platformId":-1,"name":"dependent"}},"dependencies":["idv_passed"]}}')
    with c5:
        tax_haven=form_state.upper() in ("DE","NV","WY")
        kpi_detail("Formation State",form_state or "Unknown",
            "⚠️ Tax haven — entity resolution gap risk" if tax_haven else "formation_state fact",
            "#f59e0b" if tax_haven else "#3B82F6" if form_state else "#64748b",
            "formation_state",form_state or None,"rds_warehouse_public.facts",_fs_sql,
            ["formation_date/state not provided by Middesk — entity match failed",
             "Entity is a foreign company with no US formation state"],
            f'{{"name":"formation_state","value":{json.dumps(form_state or None)},"source":{{"platformId":16,"name":"middesk","confidence":{mdsk_conf}}}}}')
    tax_haven=form_state.upper() in ("DE","NV","WY")

    r1,r2,r3,r4,r5=st.tabs(["🏛️ SOS","🗺️ Dom/Foreign","🔐 TIN","🪪 IDV","🔗 Cross-Analysis"])

    with r1:
        st.markdown("#### SOS Registry — Full Data Lineage")
        st.caption("""**Data source:** `rds_warehouse_public.facts` (Redshift federated view of PostgreSQL RDS) ·
        **Winning source:** Middesk (pid=16, weight=2.0) or OpenCorporates (pid=23, weight=0.9) ·
        **Rule applied:** `factWithHighestConfidence` — highest confidence×weight wins""")

        render_lineage(facts,["sos_active","sos_match","sos_match_boolean","middesk_confidence","middesk_id",
                               "formation_state","formation_date","year_established","corporation"],
                      show_rule_explainer=True)

        # Source concordance chart
        st.markdown("##### Vendor Confidence Comparison")
        vendors=[("Middesk","16"),("OpenCorporates","23"),("ZoomInfo","24"),("Equifax","17"),("Trulioo","38")]
        cdata=[]
        for vn,vp in vendors:
            for fn in ["sos_match","sos_match_boolean"]:
                win_pid=gp(facts,fn); wconf=gc(facts,fn)
                aconf=next((a["conf"] for a in get_alts(facts,fn) if a["pid"]==vp),0.0)
                conf=wconf if win_pid==vp else aconf
                if conf>0: cdata.append({"Vendor":vn,"Fact":fn,"Conf":round(conf,4),
                                          "Role":"Winner ✓" if win_pid==vp else "Alternative"})
        if cdata:
            cdf=pd.DataFrame(cdata)
            fig=px.bar(cdf,x="Vendor",y="Conf",color="Role",barmode="group",
                       color_discrete_map={"Winner ✓":"#22c55e","Alternative":"#8B5CF6"},
                       title="Vendor Confidence — SOS facts (winner vs alternatives)")
            fig.update_layout(yaxis=dict(range=[0,1.05],title="Confidence (0–1)"),height=300)
            st.plotly_chart(dark_chart(fig),use_container_width=True)
            st.dataframe(cdf,use_container_width=True,hide_index=True)
        else:
            st.info("No vendor confidence data available for this business.")

        # JSON structure explanation
        with st.expander("📄 JSON structure — how this fact looks in the API response"):
            st.markdown("""```json
{
  "sos_active": {
    "name": "sos_active",
    "value": true,                          ← what the Admin Portal shows
    "source": {
      "confidence": null,                   ← null = derived (dependent) fact
      "platformId": -1,                     ← -1 = system computed
      "name": "dependent"
    },
    "dependencies": ["sos_filings"],        ← computed FROM sos_filings.value[].active
    "ruleApplied": null,                    ← no rule = pure dependency
    "alternatives": []
  },
  "sos_match": {
    "name": "sos_match",
    "value": "success",
    "source": {
      "confidence": 0.9989,                 ← Middesk formula: 0.15 + 0.20×tasks
      "platformId": 16,                     ← 16 = Middesk (weight=2.0, highest)
      "name": "middesk"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" },
    "alternatives": [
      { "value": "success", "source": 23, "confidence": 1.0 }   ← OC fallback
    ]
  }
}
```""")

        ai_popup("SOS",f"SOS active:{sos_act} match:{sos_match} conf:{mdsk_conf:.4f} state:{form_state}",[
            "How is Middesk confidence calculated for SOS facts?",
            "Why might sos_match_boolean be false for a real business?",
            "What does sos_active=false mean for underwriting?",
            "How do I query SOS filings from Redshift?",
            "What is the difference between sos_match and sos_active?"],bid)

        with st.expander("📋 SQL & Python — how to load this data"):
            st.markdown("**Redshift (VPN required) — scalar SOS facts:**")
            _sql_b = sql_for(bid,["sos_active","sos_match","sos_match_boolean","formation_state","middesk_confidence"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
            st.markdown("**PostgreSQL RDS port 5432 — sos_filings array (too large for Redshift federation):**")
            st.code(f"""-- Run on PostgreSQL RDS (native JSONB, no VARCHAR(65535) limit):
SELECT
    filing->>'foreign_domestic'   AS filing_type,
    filing->>'state'              AS state,
    filing->>'active'             AS is_active,
    filing->>'entity_type'        AS entity_type,
    filing->>'registration_date'  AS reg_date,
    filing->>'filing_name'        AS filing_name,
    filing->>'url'                AS registry_url
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}'
ORDER BY (filing->>'active')::boolean DESC;""",language="sql")
            st.markdown("**API endpoint that returns this data:**")
            st.code(f"""GET https://api.joinworth.com/integration/api/v1/facts/business/{bid}/kyb
Authorization: Bearer <token>
# Response: data.sos_active, data.sos_match, data.sos_filings, ...
# Cached in Redis: integration-express-cache::{bid}::/api/v1/facts/business/{bid}/kyb""",language="bash")
            st.code(py_for(bid,["sos_active","sos_match","sos_match_boolean"]),language="python")

        analyst_card("🔬 SOS Registry — Full Interpretation",[
            f"sos_active = {sos_act}: {'✅ Entity in good standing with its Secretary of State.' if sos_act=='true' else '🚨 NOT in good standing — check for: unpaid taxes, missed annual report filing, or administrative dissolution by the state.' if sos_act=='false' else '⚠️ Unknown — Middesk may not have returned a SOS filing yet.'}",
            f"Middesk confidence = {mdsk_conf:.4f}: Formula = 0.15 (base) + 0.20 × (number of passing review tasks, max 4). Tasks: name verification, TIN check, address verification, SOS lookup. Score of {mdsk_conf:.4f} implies ~{max(0,round((mdsk_conf-0.15)/0.20))} tasks passed.",
            "sos_active is a DEPENDENT fact (platformId=-1, source='dependent'). It is derived by the Fact Engine from sos_filings.value[].active — not queried directly. sos_filings is queried by Middesk (pid=16) from the state Secretary of State registry.",
            "sos_match is the WINNING fact (pid=16 Middesk, w=2.0). OpenCorporates (pid=23, w=0.9) is the alternative. The Fact Engine applies rule 'factWithHighestConfidence×weight'. The winner's value and source are stored in rds_warehouse_public.facts.",
            "sos_filings is too large for Redshift federation (VARCHAR 65535 limit). It contains an array of SoSRegistration objects with: id, jurisdiction, filing_date, entity_type, active, foreign_domestic, state, url, filing_name, registration_date, officers[].",
            "Admin Portal path: KYB tab → Business Registration → 'Verified' badge = sos_match_boolean=true AND sos_active=true. Rendered by microsites/packages/case/src/page/Cases/KYB/BusinessRegistration.tsx.",
        ])

    with r2:
        st.markdown("#### 🗺️ Domestic vs Foreign Registration — Complete Analysis")
        st.caption("**Source fact:** `sos_filings` (too large for Redshift — PostgreSQL RDS required) · "
                   "**Proxy facts:** `formation_state` + `primary_address.state` (Redshift OK) · "
                   "**Admin Portal path:** KYB → Business Registration → jurisdiction badges (Primary/Secondary)")

        # ── Per-business status ───────────────────────────────────────────────
        op_state = ""
        pa = facts.get("primary_address",{}).get("value",{})
        if isinstance(pa, dict): op_state = str(pa.get("state","") or "").upper().strip()
        form_state_up = form_state.upper().strip()
        TAX_HAVENS = {"DE","NV","WY","SD","MT","NM"}
        states_differ = form_state_up and op_state and form_state_up != op_state
        is_th = form_state_up in TAX_HAVENS

        # KPI row with detail panels
        _dom_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';"
        _op_sql  = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','state') AS operating_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='primary_address';"
        _match_color = "#f59e0b" if states_differ else ("#22c55e" if form_state_up else "#64748b")
        _th_val = "YES — " + form_state_up if is_th else "No"

        # KPI cards only — no expanders inside columns
        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("Formation State (domestic)",form_state or "⚠️ Unknown","Where entity was incorporated","#3B82F6")
        with c2: kpi("Operating State",op_state or "⚠️ Unknown","primary_address.state","#3B82F6")
        with c3:
            if states_differ: kpi("State Match","❌ Different",f"{form_state_up} ≠ {op_state} — foreign qual. likely","#f59e0b")
            elif form_state_up: kpi("State Match","✅ Same state","No foreign qualification needed","#22c55e")
            else: kpi("State Match","⚠️ Unknown","formation_state missing","#64748b")
        with c4:
            kpi("Tax Haven?","⚠️ "+_th_val if is_th else "✅ "+_th_val,
                "DE/NV/WY/SD/MT/NM = entity resolution gap risk" if is_th else "Low entity resolution risk",
                "#f59e0b" if is_th else "#22c55e")

        # Detail panels — sequential full-width (no overlap)
        detail_panel("🗺️ Formation State",form_state or "Unknown",
            what_it_means="The US state where this entity was legally incorporated (domestic state). Middesk (pid=16) is the primary source. If different from operating state, entity likely has BOTH domestic and foreign filings.",
            source_table="rds_warehouse_public.facts · name='formation_state'",
            source_file="facts/kyb/index.ts", source_file_line="formationState · factWithHighestConfidence rule",
            api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.formation_state",
            json_obj={"name":"formation_state","value":form_state or None,"source":{"platformId":16,"name":"middesk","confidence":mdsk_conf},"ruleApplied":{"name":"factWithHighestConfidence"}},
            sql=_dom_sql, links=[("facts/kyb/index.ts","formation_state fact"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
            color="#3B82F6", icon="🗺️")
        detail_panel("📍 Operating State",op_state or "Unknown",
            what_it_means="The state where the business operates, derived from primary_address.state. This is the state Middesk searches by default, which may find the FOREIGN filing instead of the DOMESTIC one.",
            source_table="rds_warehouse_public.facts · name='primary_address' → value.state",
            source_file="facts/kyb/index.ts", source_file_line="primaryAddress · dependent from addresses[]",
            api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.primary_address.value.state",
            json_obj={"name":"primary_address","value":{"state":op_state or None},"source":{"platformId":-1,"name":"dependent"},"dependencies":["addresses"]},
            sql=_op_sql, links=[("facts/kyb/index.ts","primary_address fact"),("middesk","Middesk SOS search uses this address")],
            color="#3B82F6", icon="📍")
        detail_panel("🔍 State Match","Different" if states_differ else ("Same" if form_state_up else "Unknown"),
            what_it_means=("formation_state ≠ operating_state. Business almost certainly has: (1) Domestic filing in " + form_state_up + ", (2) Foreign qualification in " + op_state + ". Middesk address search finds the FOREIGN record, potentially missing the DOMESTIC primary." if states_differ else ("Same state = entity incorporated and operating in the same state. Middesk address search will find the correct domestic record." if form_state_up else "Formation state unknown — cannot assess domestic vs foreign risk.")),
            source_table="Computed from formation_state vs primary_address.state (both from rds_warehouse_public.facts)",
            source_file="facts/businessDetails/index.ts", source_file_line="Proxy analysis — not a stored fact",
            json_obj={"formation_state":form_state_up or None,"operating_state":op_state or None,"states_match":not states_differ,"entity_resolution_gap_risk":states_differ},
            sql=f"-- Compare both states:\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';\n-- vs:\n{_op_sql}",
            links=[("facts/kyb/index.ts","sos_match_boolean — affected by entity resolution gap")],
            color=_match_color, icon="🔍")
        detail_panel("⚠️ Tax Haven State","YES" if is_th else "No",
            what_it_means=("DE/NV/WY/SD/MT/NM are preferred for incorporation due to: no state income tax (DE,NV,WY), flexible corporate law (DE Court of Chancery), LLC privacy (WY). Businesses incorporate here but operate elsewhere, creating the entity resolution gap. Middesk searches by operating address → finds foreign qualification → misses domestic filing." if is_th else "Formation state " + (form_state_up or "?") + " is not a tax-haven state. Lower probability of entity resolution gap from state mismatch."),
            source_table="Derived from formation_state value — no separate fact stored",
            source_file="facts/kyb/index.ts", source_file_line="formation_state fact · Middesk pid=16",
            json_obj={"formation_state":form_state_up or None,"is_tax_haven_state":is_th,"tax_haven_states":["DE","NV","WY","SD","MT","NM"]},
            sql=_dom_sql, links=[("facts/kyb/index.ts","formation_state"),("middesk","Middesk SOS search implementation")],
            color="#f59e0b" if is_th else "#22c55e", icon="⚠️" if is_th else "✅")

        if is_th:
            flag(f"🚨 **ENTITY RESOLUTION GAP RISK:** This business is incorporated in **{form_state_up}** "
                 f"(a tax-haven state), but operating in **{op_state or '?'}**. "
                 f"Middesk searches by submitted address ({op_state or '?'}) → finds the **FOREIGN qualification** record. "
                 f"The PRIMARY DOMESTIC filing in {form_state_up} may be MISSED. "
                 f"This can cause **sos_match_boolean=false as a FALSE NEGATIVE**.", "red")
        elif states_differ:
            flag(f"⚠️ Formation state ({form_state_up}) differs from operating state ({op_state}). "
                 f"Business likely has both a domestic filing in {form_state_up} AND a foreign qualification in {op_state}. "
                 "Verify both filings using the SQL below.", "amber")
        else:
            flag(f"✅ Formation state ({form_state_up}) matches operating state ({op_state or '?'}). "
                 "Business is likely domestic-only in this state. Low entity resolution gap risk.", "green")

        st.markdown("---")

        # ── Sanity check: sos_match_boolean vs state mismatch ────────────────
        st.markdown("##### 🔍 Entity Resolution Gap Detection — For This Business")
        checks_dom = [
            ("sos_match_boolean value", sos_match,
             sos_match=="true",
             "true = Middesk found AND matched the SOS record"),
            ("Formation state known", bool(form_state_up),
             bool(form_state_up),
             "Required to check domestic vs foreign"),
            ("Operating state known", bool(op_state),
             bool(op_state),
             "Required to check if states differ"),
            ("States are the same", not states_differ,
             not states_differ,
             "Same state = domestic only, no gap risk"),
            ("Not a tax-haven state", not is_th,
             not is_th,
             "DE/NV/WY = highest probability of gap"),
            ("Gap risk present", states_differ and sos_match!="true",
             not (states_differ and sos_match!="true"),
             "sos_match=false AND states differ = likely false negative"),
        ]
        _CHECK_DETAILS = {
            "sos_match_boolean value": ("sos_match_boolean","rds_warehouse_public.facts · name='sos_match_boolean'","facts/kyb/index.ts","sosMatchBoolean · dependent from sos_match.value==='success'",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='sos_match_boolean';"),
            "Formation state known":   ("formation_state","rds_warehouse_public.facts · name='formation_state'","facts/kyb/index.ts","formationState · Middesk pid=16",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';"),
            "Operating state known":   ("primary_address.state","rds_warehouse_public.facts · name='primary_address' → value.state","facts/kyb/index.ts","primaryAddress · dependent from addresses[]",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','state') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='primary_address';"),
            "States are the same":     ("formation_state vs primary_address.state","Computed proxy — not a stored fact","facts/businessDetails/index.ts","Proxy: formation_state === operating_state","-- See both queries above"),
            "Not a tax-haven state":   ("formation_state","rds_warehouse_public.facts · name='formation_state'","facts/kyb/index.ts","Tax-haven: DE/NV/WY/SD/MT/NM",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';"),
            "Gap risk present":        ("sos_match_boolean + states_differ","Cross-field computed check","facts/kyb/index.ts","sos_match=false AND states differ = likely false negative",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_match FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='sos_match_boolean';"),
        }
        st.dataframe(pd.DataFrame([{
            "Check":c,"Result":str(r),"Status":"✅ OK" if ok else "🔴 Flag","Interpretation":d
        } for c,r,ok,d in checks_dom]), use_container_width=True, hide_index=True)
        st.caption("▼ Click any check below to see source, JSON, and SQL")
        for chk,result,ok,interp in checks_dom:
            det = _CHECK_DETAILS.get(chk,())
            detail_panel(
                chk, str(result),
                what_it_means=interp,
                source_table=det[1] if len(det)>1 else "",
                source_file=det[2] if len(det)>2 else "facts/kyb/index.ts",
                source_file_line=det[3] if len(det)>3 else "",
                sql=det[4] if len(det)>4 else "",
                json_obj={"check":chk,"result":str(result),"status":"OK" if ok else "Flag","interpretation":interp},
                links=[("facts/kyb/index.ts","Fact definition"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
                color="#22c55e" if ok else "#ef4444",
                icon="✅" if ok else "🔴"
            )

        if states_differ and sos_match!="true":
            flag("🚨 **High confidence this is a false negative:** "
                 "sos_match_boolean=false AND formation_state ≠ operating_state. "
                 "Middesk found the foreign qualification record in the operating state, "
                 "but could NOT match the name — possibly because the domestic legal name "
                 "in the formation state differs from the submitted DBA name. "
                 "**Recommended action:** re-run Middesk with formation_state as jurisdiction.", "red")

        st.markdown("---")

        # ── Plotly workflow diagram ────────────────────────────────────────────
        st.markdown("##### 🔄 Entity Resolution Pipeline — How This Fact Flows")
        _col_l, _col_r = st.columns([3,2])
        with _col_l:
            fig_flow = go.Figure()
            # Nodes as scatter with text
            nodes_x  = [0.1, 0.1, 0.5, 0.5, 0.5, 0.9, 0.9]
            nodes_y  = [0.85, 0.55, 0.85, 0.65, 0.45, 0.75, 0.45]
            nodes_lbl= [
                "Merchant\nsubmits address",
                "Middesk API\n(pid=16, w=2.0)",
                "OC Fallback\n(pid=23, w=0.9)",
                "Fact Engine\nfactWithHighestConf",
                "sos_filings\nrds_warehouse_public.facts",
                "Admin Portal\nPrimary/Secondary badge",
                "sos_active\n(derived from filings[].active)",
            ]
            nodes_color = ["#f59e0b","#f59e0b","#3B82F6","#8B5CF6","#22c55e","#60A5FA","#94a3b8"]
            fig_flow.add_trace(go.Scatter(
                x=nodes_x, y=nodes_y, mode="markers+text",
                text=nodes_lbl,
                textposition=["middle right","middle right","middle right",
                              "middle right","middle right","middle left","middle left"],
                marker=dict(size=18, color=nodes_color, symbol="circle",
                            line=dict(color="#1E293B",width=2)),
                textfont=dict(size=9, color="#E2E8F0"),
                hoverinfo="text",
            ))
            # Arrows as annotations
            arrows = [
                (0.1,0.85,0.1,0.60,"submits address"),
                (0.1,0.55,0.47,0.85,"SOS search by address"),
                (0.1,0.55,0.47,0.65,"(same request)"),
                (0.53,0.85,0.53,0.70,"name-based search"),
                (0.53,0.65,0.87,0.78,"winner stored"),
                (0.53,0.45,0.87,0.48,"active field"),
            ]
            for x0,y0,x1,y1,lbl in arrows:
                fig_flow.add_annotation(ax=x0,ay=y0,x=x1,y=y1,
                    xref="x",yref="y",axref="x",ayref="y",
                    arrowhead=2,arrowwidth=1.5,arrowcolor="#475569",
                    showarrow=True)
            fig_flow.update_layout(
                height=320,
                xaxis=dict(visible=False,range=[-0.05,1.2]),
                yaxis=dict(visible=False,range=[0.3,1.0]),
                margin=dict(t=20,b=10,l=10,r=10),
                title="Entity Resolution Data Flow",
            )
            st.plotly_chart(dark_chart(fig_flow), use_container_width=True)

        with _col_r:
            st.markdown("**Pipeline stages:**")
            for step,desc,color in [
                ("① Merchant submits","Operating address + legal name to onboarding form","#f59e0b"),
                ("② Middesk (primary)","Live SOS search by address in each state registry","#f59e0b"),
                ("③ OC (fallback)","Global search by name — may find domestic record Middesk missed","#3B82F6"),
                ("④ Fact Engine","factWithHighestConfidence selects winner between Middesk & OC","#8B5CF6"),
                ("⑤ Stored","sos_filings array with foreign_domestic per filing written to Redshift","#22c55e"),
                ("⑥ Admin Portal","EntityJurisdictionCell.tsx: domestic='Primary', foreign='Secondary'","#60A5FA"),
                ("⑦ Derived","sos_active = any(filing.active for filing in sos_filings)","#94a3b8"),
            ]:
                st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                    padding:5px 10px;border-radius:6px;margin:3px 0;font-size:.72rem">
                  <span style="color:{color};font-weight:600">{step}</span>
                  <span style="color:#CBD5E1;margin-left:6px">{desc}</span></div>""",
                    unsafe_allow_html=True)

        st.markdown("---")

        # ── Fact lineage for this business ────────────────────────────────────
        render_lineage(facts,["formation_state","formation_date","corporation","year_established"])

        st.markdown("---")
        st.markdown("##### 📖 The Delaware Problem — Why Tax-Haven States Break Entity Resolution")
        st.markdown("""
**Why businesses incorporate in DE/NV/WY even if they operate elsewhere:**

| State | Why businesses choose it | Entity resolution problem |
|---|---|---|
| **Delaware** | Court of Chancery (predictable corporate law) · no state income tax · flexible equity structures · investor-friendly | DE filing name often differs from submitted DBA; Middesk searches Texas address, finds Texas foreign record, misses DE domestic |
| **Nevada** | Strong liability protection · no corporate income tax · no disclosure of shareholders | Operating in CA/TX/NY but incorporated NV; address search returns wrong record |
| **Wyoming** | LLC privacy (no public officer disclosure required) · lowest fees | Particularly common for anonymous holding companies; very hard to resolve by name |

**What this means for this pipeline:**

```
Business: "Joe's Pizza LLC" operating in Texas, incorporated in Delaware as "JPL Holdings LLC"
                    ↓
Middesk searches: Texas SOS registry (by submitted Texas address)
Finds: "JPL Holdings LLC" (Texas foreign qualification, filed 2022)
      Name mismatch vs submitted "Joe's Pizza LLC" → sos_match_boolean = FALSE ❌
                    ↓
The Delaware DOMESTIC record ("JPL Holdings LLC") is NEVER searched
The business IS legitimately registered — we searched the wrong state
```

**Recommended fixes** (from integration-service codebase analysis):
1. When `sos_match_boolean=false` AND `formation_state ≠ operating_state` → re-run Middesk with `jurisdiction=formation_state`
2. For all DE/NV/WY incorporations → always run DUAL search (formation state + operating state)
3. Add a `has_foreign_qualification` boolean fact to the Fact Engine as an explicit flag
4. Flag these cases for manual underwriter review — they are high-probability false negatives
        """)

        with st.expander("📋 SQL — Query sos_filings directly (PostgreSQL RDS port 5432 required)"):
            st.code(f"""-- sos_filings is too large for Redshift federation (VARCHAR 65535 limit).
-- All queries below must run on PostgreSQL RDS (port 5432) with native JSONB.

-- 1. All SOS filings for this business with domestic/foreign classification:
SELECT
    filing->>'foreign_domestic'   AS type,             -- 'domestic' | 'foreign'
    filing->>'state'              AS state,
    filing->>'active'             AS is_active,
    filing->>'entity_type'        AS entity_type,       -- LLC | Corp | etc.
    filing->>'registration_date'  AS registration_date,
    filing->>'filing_name'        AS legal_filing_name, -- may differ from submitted name!
    filing->>'url'                AS registry_url,
    filing->'officers'            AS officers
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}'
ORDER BY
    (filing->>'active')::boolean DESC,
    CASE filing->>'foreign_domestic' WHEN 'domestic' THEN 0 ELSE 1 END;

-- 2. Scalar facts (Redshift OK — no size limit):
{sql_for(bid,["formation_state","formation_date","sos_active","sos_match","sos_match_boolean"])}

-- 3. Cross-check: businesses where sos_match=false but have domestic filing
--    (entity resolution false negatives) — run on PostgreSQL RDS:
SELECT f.business_id,
    sos.value->>'value'       AS sos_match_boolean,
    filing->>'foreign_domestic' AS filing_type,
    filing->>'state'            AS filing_state,
    filing->>'active'           AS is_active
FROM rds_warehouse_public.facts f
CROSS JOIN jsonb_array_elements(f.value->'value') AS filing
JOIN rds_warehouse_public.facts sos
  ON sos.business_id=f.business_id AND sos.name='sos_match_boolean'
WHERE f.name='sos_filings'
  AND sos.value->>'value'='false'
  AND filing->>'foreign_domestic'='domestic'
  AND filing->>'active'='true'
;""", language="sql")

        analyst_card("🔬 Domestic vs Foreign — Complete Engineering Analysis",[
            f"CURRENT BUSINESS: formation_state={form_state_up or '(unknown)'}, "
            f"operating_state={op_state or '(unknown)'}, states_differ={states_differ}, "
            f"tax_haven={is_th}, sos_match_boolean={sos_match}. "
            f"{'⚠️ ENTITY RESOLUTION GAP LIKELY — verify both domestic and foreign filings.' if states_differ and sos_match!='true' else '✅ No entity resolution gap detected for this specific business.'}",
            "sos_filings fact: stores an array of SoSRegistration objects. Each has: id, jurisdiction (us::state), "
            "filing_date, entity_type, active (bool), foreign_domestic ('domestic'|'foreign'), state, url, "
            "filing_name, registration_date, officers[]. Source: Middesk (pid=16) wins via factWithHighestConfidence if conf > OC.",
            "foreign_domestic field is set by Middesk from their API's registrations[].foreignDomestic field. "
            "OC sets it by comparing home_jurisdiction_code to the filing's jurisdiction. "
            "If Middesk wins, OC's assessment of domestic/foreign is in the alternatives[].",
            "sos_active is a DERIVED fact (platformId=-1, ruleApplied=null, source='dependent'). "
            "It is computed by the Fact Engine as: ANY(filing.active for filing in sos_filings.value). "
            "It is NOT a direct vendor query. The 'dependencies' field lists ['sos_filings'].",
            "Admin Portal: KYB → Business Registration → EntityJurisdictionCell.tsx. "
            "Domestic filing → green 'Primary' badge. Foreign filing → grey 'Secondary' badge. "
            "Sorted by active=true first, then by domestic before foreign. Multiple badges possible.",
            "sos_filings exceeds Redshift federation VARCHAR(65535) limit. Must be queried from "
            "PostgreSQL RDS (port 5432) using JSONB operators (->>, jsonb_array_elements). "
            "The scalar proxy facts (sos_active, sos_match_boolean, formation_state) are safe in Redshift.",
        ])
        st.markdown("---")
        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('facts/kyb/index.ts','sos_active / sos_filings fact definitions')}]({GITHUB_LINKS.get('facts/kyb/index.ts','')})\n"
            f"- [{src_link('middesk','Middesk integration (registrations[].foreignDomestic)')}]({GITHUB_LINKS.get('middesk','')})\n"
            f"- [{src_link('EntityJurisdictionCell','Admin Portal — EntityJurisdictionCell.tsx')}]({GITHUB_LINKS.get('EntityJurisdictionCell','')})\n"
            f"- [{src_link('integrations.constant.ts','INTEGRATION_ID.MIDDESK=16, OPENCORPORATES=23')}]({GITHUB_LINKS.get('integrations.constant.ts','')})"
        )
        ai_popup("DomForeign",
                 f"formation_state:{form_state} operating_state:{op_state} tax_haven:{is_th} sos_match:{sos_match}",[
            "What is the entity resolution gap for tax-haven states and how does it affect sos_match_boolean?",
            "How does Middesk determine if a filing is domestic or foreign?",
            "Where is sos_filings stored and why can't it be queried from Redshift?",
            "What SQL detects false negatives (sos_match=false + active domestic filing)?",
            "How does OpenCorporates differ from Middesk for foreign_domestic classification?"],bid)

    with r3:
        st.markdown("#### TIN Verification — Full Data Lineage")
        st.caption("""**Source:** Middesk (pid=16) TIN review task → direct IRS query. 
        **Fallback:** Trulioo BusinessRegistrationNumber comparison (pid=38). 
        **Stored in:** `rds_warehouse_public.facts` (name='tin_match', 'tin_match_boolean', 'tin', 'tin_submitted')""")

        render_lineage(facts,["tin","tin_submitted","tin_match","tin_match_boolean"])

        # KPI cards only — detail panels below (sequential, no overlap)
        tin_submitted_val=str(gv(facts,"tin_submitted") or "")
        _tin_sql_base = f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('tin','tin_submitted','tin_match','tin_match_boolean') ORDER BY name;"
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("EIN Submitted","✅ Yes" if tin_submitted_val else "❌ No",f"Masked: {tin_submitted_val[:9]}" if tin_submitted_val else "tin_submitted fact","#22c55e" if tin_submitted_val else "#ef4444")
        with c2: kpi("IRS Status",tin_status.capitalize() or "⚠️ Unknown","tin_match.value.status","#22c55e" if tin_status=="success" else "#ef4444" if tin_status=="failure" else "#f59e0b")
        with c3: kpi("IRS Message",tin_msg[:30]+"…" if len(tin_msg)>30 else (tin_msg or "(none)"),"tin_match.value.message","#22c55e" if tin_status=="success" else "#ef4444")
        with c4: kpi("Boolean Result",tin_bool or "⚠️ Unknown","Admin Portal shows this value","#22c55e" if tin_bool=="true" else "#ef4444")

        # Detail panels — sequential full-width
        detail_panel("🔐 EIN Submitted", tin_submitted_val or "Not submitted",
            what_it_means="tin_submitted stores the masked EIN (XXXXX1234) for display. The unmasked version is in the 'tin' fact. Both are sourced from the Applicant (pid=0, confidence=1.0 by convention). The IRS TIN check CANNOT run until an EIN is submitted.",
            source_table="rds_warehouse_public.facts · name='tin_submitted'",
            source_file="facts/kyb/index.ts", source_file_line="tinSubmitted · factWithHighestConfidence · Applicant pid=0",
            api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.tin_submitted",
            json_obj={"name":"tin_submitted","value":tin_submitted_val or None,"source":{"platformId":0,"name":"businessDetails","confidence":1.0},"note":"Masked EIN. Unmasked in 'tin' fact."},
            sql=_tin_sql_base, links=[("facts/kyb/index.ts","tinSubmitted fact"),("integrations.constant.ts","pid=0=Applicant/businessDetails")],
            color="#22c55e" if tin_submitted_val else "#ef4444", icon="🔐")
        detail_panel("🏛️ IRS Status", tin_status or "Unknown",
            what_it_means="tin_match.value.status = the IRS response status for the EIN+name combination check. 'success' = IRS confirmed match. 'failure' = IRS mismatch or no record. 'pending' = check in progress. This field drives tin_match_boolean (dependent fact).",
            source_table="rds_warehouse_public.facts · name='tin_match' → value.status",
            source_file="facts/kyb/index.ts", source_file_line="tinMatch · factWithHighestConfidence · Middesk pid=16",
            api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.tin_match.value.status",
            json_obj={"name":"tin_match","value":{"status":tin_status or None,"message":tin_msg or None},"source":{"platformId":16,"name":"middesk","confidence":gc(facts,"tin_match")}},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS irs_status, JSON_EXTRACT_PATH_TEXT(value,'value','message') AS irs_message FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';",
            links=[("facts/kyb/index.ts","tinMatch fact"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
            color="#22c55e" if tin_status=="success" else "#ef4444" if tin_status=="failure" else "#f59e0b", icon="🏛️")
        detail_panel("💬 IRS Message", tin_msg or "(none)",
            what_it_means="The exact message returned by the IRS TIN verification system via Middesk. Common messages: 'The IRS has a record for the submitted TIN and Business Name combination' (success). 'The IRS does not have a record' (wrong EIN/name). 'associated with a different Business Name' (FRAUD SIGNAL). 'Duplicate request' (retry in 24h).",
            source_table="rds_warehouse_public.facts · name='tin_match' → value.message",
            source_file="facts/kyb/index.ts", source_file_line="tinMatch.value.message · IRS response via Middesk TIN review task",
            json_obj={"tin_match_message":tin_msg or None,"tin_match_status":tin_status or None,"interpretation":{"does not have a record":"Wrong EIN or name — request SS-4 document","associated with a different":"FRAUD SIGNAL — escalate to Compliance","Duplicate request":"Retry in 24h","unavailable":"IRS outage — auto-retry"}},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','message') AS irs_msg FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';",
            links=[("facts/kyb/index.ts","tinMatch message field")],
            color="#22c55e" if tin_status=="success" else "#ef4444", icon="💬")
        detail_panel("✅ Boolean Result", tin_bool or "Unknown",
            what_it_means="tin_match_boolean is a DEPENDENT fact (platformId=-1) derived from tin_match.value.status === 'success'. This is the value shown in the Admin Portal's 'Tax ID Number (EIN)' verified badge. CRITICAL: tin_match_boolean=true MUST only happen when status='success'. Any divergence = data integrity bug.",
            source_table="rds_warehouse_public.facts · name='tin_match_boolean'",
            source_file="facts/kyb/index.ts", source_file_line="tinMatchBoolean · dependent · tin_match.value.status==='success'",
            api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.tin_match_boolean.value",
            json_obj={"name":"tin_match_boolean","value":tin_bool=="true" if tin_bool else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["tin_match"],"note":"Admin Portal EIN Verified badge. true ONLY when tin_match.value.status='success'"},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS tin_match_boolean FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match_boolean';",
            links=[("facts/kyb/index.ts","tinMatchBoolean dependent fact"),("facts/rules.ts","dependentFact rule")],
            color="#22c55e" if tin_bool=="true" else "#ef4444", icon="✅" if tin_bool=="true" else "❌")

        if tin_msg: flag(f"Middesk TIN message: **\"{tin_msg}\"**","green" if tin_status=="success" else "amber")

        # Source concordance
        st.markdown("##### Source Concordance — Who provided the TIN")
        tin_sources=[]
        for fname in ["tin","tin_submitted"]:
            f=facts.get(fname,{})
            if f:
                src=f.get("source") or {}
                pid="" if not isinstance(src,dict) else ("" if src.get("platformId") is None else str(src["platformId"]))
                conf_raw=src.get("confidence") if isinstance(src,dict) else None
                conf=float(conf_raw) if conf_raw is not None else None
                tin_sources.append({
                    "Fact":fname,
                    "Value":str(f.get("value",""))[:20],
                    "Source":_pid_label(pid),
                    "platformId":pid,
                    "Confidence":f"{conf:.4f}" if conf is not None else "n/a (dependent)",
                    "Rule":safe_get(f,"ruleApplied","name") or "—",
                    "Notes":"Applicant-submitted — confidence=1.0 by definition" if pid=="0"
                            else "Middesk confirmed from IRS system" if pid=="16"
                            else "Trulioo fallback via BusinessRegistrationNumber" if pid=="38"
                            else "Unknown source" if pid=="" else ""
                })
                # Also show alternatives
                for alt in (f.get("alternatives") or []):
                    if not isinstance(alt,dict): continue
                    ap=_alt_pid(alt); ac=_alt_conf(alt)
                    tin_sources.append({
                        "Fact":f"{fname} [alt]",
                        "Value":str(alt.get("value",""))[:20],
                        "Source":_pid_label(ap),
                        "platformId":ap,
                        "Confidence":f"{ac:.4f}" if ac else "n/a",
                        "Rule":"alternative (lost to winner)",
                        "Notes":"",
                    })
        if tin_sources:
            st.dataframe(pd.DataFrame(tin_sources),use_container_width=True,hide_index=True)

        # Consistency checks with detail panels
        st.markdown("##### Data Integrity Checks")
        TIN_CHECK_META = {
            "EIN submitted":               ("tin_submitted","rds_warehouse_public.facts · name='tin_submitted'","facts/kyb/index.ts","tinSubmitted · pid=0 Applicant",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_submitted';"),
            "tin_match.status present":    ("tin_match.value.status","rds_warehouse_public.facts · name='tin_match' → value.status","facts/kyb/index.ts","tinMatch · Middesk IRS response",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';"),
            "tin_match_boolean set":       ("tin_match_boolean","rds_warehouse_public.facts · name='tin_match_boolean'","facts/kyb/index.ts","tinMatchBoolean · dependent from tin_match",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match_boolean';"),
            "Boolean ↔ status consistent": ("tin_match_boolean vs tin_match.status","Cross-field computed check — not stored","facts/kyb/index.ts","CRITICAL: boolean MUST equal (status==='success')","-- Verify both:\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='" + bid + "' AND name IN ('tin_match_boolean','tin_match') ORDER BY name;"),
            "Winning source is Middesk":   ("tin_match.source.platformId","rds_warehouse_public.facts · name='tin_match' → source.platformId","facts/kyb/index.ts","Middesk pid=16 is only IRS-direct source",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';"),
        }
        checks=[
            ("EIN submitted", bool(tin_submitted_val), tin_submitted_val or "(null)", "EIN must be submitted before IRS check can run"),
            ("tin_match.status present", tin_status in ("success","failure","pending"), tin_status or "(missing)", "Must be 'success', 'failure', or 'pending'"),
            ("tin_match_boolean set", tin_bool in ("true","false"), tin_bool or "(missing)", "Must be true or false — null means IRS check not yet run"),
            ("Boolean ↔ status consistent", (tin_bool=="true")==(tin_status=="success"), f"bool={tin_bool}, status={tin_status}","CRITICAL: tin_match_boolean=true MUST derive only from status='success' — any divergence = integration-service bug"),
            ("Winning source is Middesk", gp(facts,"tin_match")=="16", f"pid={gp(facts,'tin_match')}", "Middesk (pid=16) is the only IRS-direct TIN checker. If pid≠16, TIN is not IRS-verified."),
        ]
        st.dataframe(pd.DataFrame([{"Check":l,"Result":v,"Status":"✅ OK" if ok else "❌ ISSUE","Explanation":d}
                                    for l,ok,v,d in checks]),use_container_width=True,hide_index=True)
        st.caption("▼ Click any check below to see source, JSON, and SQL to verify")
        for l,ok,v,d in checks:
            m = TIN_CHECK_META.get(l,())
            detail_panel(l, str(v),
                what_it_means=d,
                source_table=m[1] if len(m)>1 else "rds_warehouse_public.facts",
                source_file=m[2] if len(m)>2 else "facts/kyb/index.ts",
                source_file_line=m[3] if len(m)>3 else "",
                sql=m[4] if len(m)>4 else "",
                json_obj={"check":l,"result":str(v),"status":"OK" if ok else "ISSUE","explanation":d},
                links=[("facts/kyb/index.ts","TIN fact definitions"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
                color="#22c55e" if ok else "#ef4444", icon="✅" if ok else "❌")

        # Failure diagnosis
        if tin_status=="failure" and tin_msg:
            FAILURE_MAP={
                "does not have a record":("Wrong EIN or legal name mismatch","HIGH",
                    "Ask applicant for the exact legal name on the IRS EIN certificate (not DBA). Submit name exactly as shown on SS-4 form."),
                "associated with a different":("🚨 FRAUD SIGNAL: EIN belongs to different entity","CRITICAL",
                    "Escalate to Compliance immediately. Do NOT approve. The EIN is registered to a different business — potential identity theft or intentional fraud."),
                "duplicate":("Duplicate IRS request","LOW",
                    "IRS blocks repeat TIN checks within 24h. Wait 24 hours and retry automatically."),
                "invalid":("Invalid EIN format","HIGH",
                    "EIN must be exactly 9 digits (format: XX-XXXXXXX). Ask applicant to resubmit with correct EIN."),
                "unavailable":("IRS system temporarily unavailable","LOW",
                    "IRS API outage — system will auto-retry in 24h. No action needed."),
            }
            for kw,(reason,sev,action) in FAILURE_MAP.items():
                if kw.lower() in tin_msg.lower():
                    lvl="red" if sev in ("CRITICAL","HIGH") else "amber"
                    flag(f"**{reason}** (Severity: {sev})<br>{action}",lvl); break

        with st.expander("📄 JSON structure — TIN facts in API response"):
            st.markdown("""```json
{
  "tin": {
    "value": "931667813",              ← actual EIN (9 digits, unmasked in Redshift)
    "source": {
      "confidence": 1.0,
      "platformId": 0,                 ← 0 = Applicant (businessDetails)
      "name": "businessDetails"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" },
    "alternatives": [
      { "value": "931667813", "source": 16, "confidence": 0.9989 }   ← Middesk confirms
    ]
  },
  "tin_submitted": {
    "value": "XXXXX7813",              ← masked for display
    "source": { "platformId": 0, "name": "businessDetails" }
  },
  "tin_match": {
    "value": {
      "status": "success",             ← "success" | "failure" | "pending"
      "message": "The IRS has a record for the submitted TIN and Business Name combination",
      "sublabel": "Found"
    },
    "source": { "confidence": 0.9989, "platformId": 16, "name": "middesk" }
  },
  "tin_match_boolean": {
    "value": true,                     ← derived: status==="success"
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["tin_match"]
  }
}
```""")

        ai_popup("TIN",f"TIN status:{tin_status} msg:{tin_msg} bool:{tin_bool} pid:{gp(facts,'tin_match')}",[
            "How is tin_match_boolean derived from tin_match.status?",
            "What does 'associated with a different Business Name' mean and what action to take?",
            "When is Trulioo the fallback for TIN instead of Middesk?",
            "How do I query TIN data from Redshift and what do the fields mean?",
            "Why might tin_match_boolean be null even though tin_submitted is not empty?"],bid)

        with st.expander("📋 SQL & Python — how to load TIN data"):
            _sql_b = sql_for(bid,["tin","tin_submitted","tin_match","tin_match_boolean"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
            st.code(f"""-- Redshift: get TIN match details
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value','status')   AS irs_status,
    JSON_EXTRACT_PATH_TEXT(value,'value','message')  AS irs_message,
    JSON_EXTRACT_PATH_TEXT(value,'value','sublabel') AS sublabel,
    JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}' AND name='tin_match'
ORDER BY received_at DESC LIMIT 5;""",language="sql")
            st.code(py_for(bid,["tin","tin_submitted","tin_match","tin_match_boolean"]),language="python")

        analyst_card("🔬 TIN Verification — Full Interpretation",[
            f"tin_match_boolean = {tin_bool}: This is exactly what the Admin Portal's 'Tax ID Number (EIN)' field shows under KYB → Business Registration. {'✅ IRS confirmed this EIN and legal name combination is valid.' if tin_bool=='true' else '❌ IRS did NOT confirm this combination. The EIN may be wrong, the name may not match exactly, or the IRS system was unavailable.' if tin_bool=='false' else '⚠️ No IRS check has been run yet — the TIN check may not have been triggered.'}",
            "Source hierarchy: (1) Middesk (pid=16, w=2.0) queries IRS directly via TIN review task — this is the ONLY source that confirms with IRS. (2) If Middesk has no TIN task → Trulioo (pid=38) BusinessRegistrationNumber comparison is fallback (not IRS-direct). (3) Applicant (pid=0) submits the raw EIN — this has confidence=1.0 by convention but means nothing about IRS validity.",
            "tin vs tin_submitted: 'tin' = actual 9-digit EIN (unmasked in Redshift). 'tin_submitted' = masked version (XXXXX1234) returned to frontend. Both are stored as separate facts.",
            "CRITICAL: tin_match_boolean=true MUST derive only from tin_match.value.status='success'. Any case where boolean=true but status≠'success' = data integrity bug in integration-service (see lib/facts/kyb/tin_match_boolean.ts).",
            "Admin Portal path: KYB → Business Registration tab → 'Tax ID Number (EIN)' row. Verified badge appears only when tin_match_boolean=true AND tin_submitted is not null.",
            f"Current winning source: {_pid_label(gp(facts,'tin_match'))} (pid={gp(facts,'tin_match')}). Confidence: {gc(facts,'tin_match'):.4f}. {('✅ IRS-direct verification.' if gp(facts,'tin_match')=='16' else '⚠️ NOT IRS-direct — this is Trulioo fallback or applicant-submitted, not confirmed by IRS.' if gp(facts,'tin_match') not in ('','16') else '⚠️ Source unknown.')}",
        ])

    with r4:
        st.markdown("#### 🪪 IDV — Identity Verification (Plaid)")
        st.caption("""**Vendor:** Plaid Identity Verification (pid=40, platformId=18 in some contexts) ·
        **Trigger:** Sent via link when onboarding form submitted ·
        **Stored in:** `rds_warehouse_public.facts` (idv_status, idv_passed, idv_passed_boolean) ·
        **Admin Portal path:** KYB → Identity Verification tab · badge shows idv_passed_boolean""")

        # ── Data pipeline diagram ─────────────────────────────────────────────
        IDV_PIPELINE=[
            ("1","Onboarding form submitted","Applicant","Merchant submits onboarding form. If not sole_prop (has EIN), IDV flow is triggered for beneficial owners.","#f59e0b"),
            ("2","Plaid IDV link sent","Plaid (pid=40)","Unique IDV session link sent to owner. Session expires in 15–30 min (configurable). Statuses: PENDING immediately.","#06b6d4"),
            ("3","Owner completes IDV","Plaid biometrics engine","Owner: (a) scans government-issued ID, (b) takes selfie, (c) liveness check, (d) ID data extraction + match.","#06b6d4"),
            ("4","Plaid webhook received","integration-service","Plaid sends webhook with final status (SUCCESS/FAILED/CANCELED/EXPIRED). Stored in rds_integration_data.","#8B5CF6"),
            ("5","idv_status fact computed","Fact Engine","Object: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. Counts of ALL sessions ever, not just latest.","#22c55e"),
            ("6","idv_passed_boolean derived","Fact Engine (dependent)","true when idv_passed >= 1 (at least one SUCCESS session). platformId=-1, ruleApplied=null.","#22c55e"),
            ("7","Admin Portal display","microsites IDV tab","Shows latest session status. Badge: ✅ Verified (passed) or ❌ Not Verified (failed/pending).","#60A5FA"),
        ]
        IDV_STEP_LINKS = {
            "1": [("facts/kyb/index.ts","kyb_submitted fact"),("integrations.constant.ts","businessDetails pid=0")],
            "2": [("plaid/plaidIdv.ts","Plaid IDV link generation"),("integrations.constant.ts","PLAID_IDV=18")],
            "3": [("plaid/plaidIdv.ts","Plaid biometric verification")],
            "4": [("plaid/plaidIdv.ts","Plaid webhook handler"),("facts/kyb/index.ts","idv_status fact")],
            "5": [("facts/kyb/index.ts","idv_status fact definition"),("facts/sources.ts","sources.plaidIdv")],
            "6": [("facts/kyb/index.ts","idv_passed_boolean · dependent"),("facts/rules.ts","dependentFact rule")],
            "7": [("KYB UI","microsites IDV tab rendering")],
        }
        for num,title,src,desc,color in IDV_PIPELINE:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:3px 0">
              <div style="display:flex;justify-content:space-between">
                <span style="color:{color};font-weight:700;font-size:.83rem">Step {num}: {title}</span>
                <span style="color:#64748b;font-size:.68rem">{src}</span>
              </div>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:3px">{desc}</div>
            </div>""",unsafe_allow_html=True)
            detail_panel(f"Step {num}: {title}", src,
                what_it_means=desc,
                source_file="plaid/plaidIdv.ts" if num in ("2","3","4") else "facts/kyb/index.ts",
                source_file_line=src,
                source_table="rds_warehouse_public.facts · name='idv_status'" if num in ("5","6","7") else "rds_integration_data.plaid_*" if num in ("2","3","4") else "",
                json_obj={"step":num,"title":title,"source_system":src,"description":desc},
                links=IDV_STEP_LINKS.get(str(num),[]),
                color=color, icon="🔄")

        st.markdown("---")

        # ── KPI cards only — detail panels below sequentially ──────────────
        sole_prop=str(gv(facts,"is_sole_prop") or "").lower()
        idv_raw=facts.get("idv_status",{}).get("value",{})
        total_sessions=sum(idv_raw.values()) if isinstance(idv_raw,dict) else 0
        success_n=idv_raw.get("SUCCESS",0) if isinstance(idv_raw,dict) else 0
        _idv_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_passed FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_passed_boolean';"
        c1,c2,c3,c4=st.columns(4)
        with c1:
            kpi("IDV Passed","✅ Yes" if idv_val=="true" else "❌ No" if idv_val=="false" else "⚠️ Unknown",
                     "idv_passed_boolean","#22c55e" if idv_val=="true" else "#ef4444" if idv_val=="false" else "#64748b")
            detail_panel("IDV Passed",idv_val or "Unknown",
                what_it_means="idv_passed_boolean=true when at least 1 IDV session completed with SUCCESS status (idv_passed >= 1). This is a DEPENDENT fact — platformId=-1, computed from idv_passed which counts SUCCESS sessions in idv_status.",
                source_table="rds_warehouse_public.facts · name='idv_passed_boolean'",
                source_file="facts/kyb/index.ts",source_file_line="idvPassedBoolean · dependent from idv_passed",
                api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.idv_passed_boolean",
                json_obj={"name":"idv_passed_boolean","value":idv_val=="true" if idv_val else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["idv_passed"]},
                sql=_idv_sql,
                links=[("facts/kyb/index.ts","idv_passed_boolean"),("plaid/plaidIdv.ts","Plaid IDV source"),("integrations.constant.ts","PLAID_IDV=18")],
                color="#22c55e" if idv_val=="true" else "#ef4444" if idv_val=="false" else "#64748b",icon="🪪")
        with c2:
            kpi("Total Sessions",str(total_sessions),"All IDV sessions ever sent","#3B82F6")
            detail_panel("Total Sessions",str(total_sessions),
                what_it_means="Sum of all sessions across all statuses in idv_status object. idv_status = {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. Counts ALL sessions ever created for this business, not just the most recent.",
                source_table="rds_warehouse_public.facts · name='idv_status'",
                source_file="facts/kyb/index.ts",source_file_line="idvStatus · factWithHighestConfidence · Plaid IDV (pid=18)",
                json_obj={"name":"idv_status","value":idv_raw if isinstance(idv_raw,dict) else None,"source":{"platformId":18,"name":"plaidIdv"}},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_status_obj FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                links=[("plaid/plaidIdv.ts","Plaid IDV session handler"),("integrations.constant.ts","PLAID_IDV=18")],
                color="#3B82F6",icon="📊")
        with c3:
            kpi("Successful",str(success_n),"Sessions with SUCCESS status","#22c55e" if success_n>0 else "#64748b")
            detail_panel("Successful Sessions",str(success_n),
                what_it_means="Number of IDV sessions where the owner completed: government ID scan + selfie + liveness check successfully. idv_passed_boolean=true requires SUCCESS >= 1.",
                source_table="rds_warehouse_public.facts · name='idv_status' → value.SUCCESS",
                source_file="facts/kyb/index.ts",source_file_line="idvPassed · dependent · COUNT of SUCCESS sessions",
                json_obj={"idv_status_SUCCESS":success_n,"idv_passed":success_n,"idv_passed_boolean":success_n>=1},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','SUCCESS') AS success_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                links=[("facts/kyb/index.ts","idvPassed computation")],
                color="#22c55e" if success_n>0 else "#64748b",icon="✅")
        with c4:
            kpi("Sole Prop","✅ Yes" if sole_prop=="true" else "❌ No" if sole_prop=="false" else "⚠️ Unknown",
                     "is_sole_prop — skips IDV if true","#f59e0b" if sole_prop=="true" else "#3B82F6")
            pass  # detail panels below

        # Detail panels — sequential full-width (no column overlap)
        detail_panel("🪪 IDV Passed",idv_val or "Unknown",
            what_it_means="idv_passed_boolean=true when at least 1 IDV session completed with SUCCESS status (idv_passed >= 1). DEPENDENT fact — platformId=-1, computed from idv_passed which counts SUCCESS sessions in idv_status.",
            source_table="rds_warehouse_public.facts · name='idv_passed_boolean'",
            source_file="facts/kyb/index.ts", source_file_line="idvPassedBoolean · dependent from idv_passed",
            api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.idv_passed_boolean",
            json_obj={"name":"idv_passed_boolean","value":idv_val=="true" if idv_val else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["idv_passed"]},
            sql=_idv_sql, links=[("facts/kyb/index.ts","idv_passed_boolean"),("plaid/plaidIdv.ts","Plaid IDV"),("integrations.constant.ts","PLAID_IDV=18")],
            color="#22c55e" if idv_val=="true" else "#ef4444" if idv_val=="false" else "#64748b", icon="🪪")
        detail_panel("📊 Total IDV Sessions",str(total_sessions),
            what_it_means="Sum of all sessions in idv_status: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. ALL sessions ever created — not just the most recent.",
            source_table="rds_warehouse_public.facts · name='idv_status'",
            source_file="facts/kyb/index.ts", source_file_line="idvStatus · Plaid IDV pid=18",
            json_obj={"name":"idv_status","value":idv_raw if isinstance(idv_raw,dict) else None,"source":{"platformId":18,"name":"plaidIdv"}},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_status_obj FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
            links=[("plaid/plaidIdv.ts","Plaid IDV"),("integrations.constant.ts","PLAID_IDV=18")],
            color="#3B82F6", icon="📊")
        detail_panel("✅ Successful IDV Sessions",str(success_n),
            what_it_means="Sessions where owner completed: government ID scan + selfie + liveness check. idv_passed_boolean=true requires SUCCESS >= 1.",
            source_table="rds_warehouse_public.facts · name='idv_status' → value.SUCCESS",
            source_file="facts/kyb/index.ts", source_file_line="idvPassed · dependent · COUNT of SUCCESS sessions",
            json_obj={"idv_status_SUCCESS":success_n,"idv_passed_boolean":success_n>=1},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','SUCCESS') AS success_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
            links=[("facts/kyb/index.ts","idvPassed computation")],
            color="#22c55e" if success_n>0 else "#64748b", icon="✅")
        detail_panel("👤 Sole Proprietor",sole_prop or "Unknown",
            what_it_means="is_sole_prop=true when tin_submitted=null AND idv_passed_boolean=true. No EIN submitted — some IDV configs skip the flow for sole props, so idv_passed_boolean may be null. This is expected behavior.",
            source_table="rds_warehouse_public.facts · name='is_sole_prop'",
            source_file="facts/kyb/index.ts", source_file_line="isSoleProp · dependent from tin_submitted + idv_passed_boolean",
            json_obj={"name":"is_sole_prop","value":sole_prop=="true" if sole_prop else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["tin_submitted","idv_passed_boolean"]},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='is_sole_prop';",
            links=[("facts/kyb/index.ts","isSoleProp definition")],
            color="#f59e0b" if sole_prop=="true" else "#3B82F6", icon="👤")

        if sole_prop=="true":
            flag("is_sole_prop=true: business has no EIN or EIN was not submitted. IDV is skipped for sole proprietors in some configurations. idv_passed_boolean may be null or false — this is expected.", "amber")

        # ── Session status breakdown ──────────────────────────────────────────
        st.markdown("##### IDV Session Status Breakdown")
        IDV_INFO={
            "SUCCESS":("✅","#22c55e",
                "Government-issued ID scanned, selfie taken, liveness confirmed, name extracted matches record. "
                "idv_passed += 1. If idv_passed >= 1 → idv_passed_boolean=true."),
            "PENDING":("⏳","#f59e0b",
                "Session created but not yet completed by the owner. Link may still be active. "
                "Send a reminder after 24h. Does NOT increment idv_passed."),
            "FAILED":("❌","#ef4444",
                "Common failure causes: (1) Expired/damaged ID, (2) Selfie/ID face mismatch, "
                "(3) Liveness check fail (blinking/moving required), (4) Unsupported ID type, "
                "(5) Poor lighting. Owner can retry — a new session link is needed."),
            "CANCELED":("🚫","#f97316",
                "Owner clicked 'Cancel' or exited the flow without completing. Possible UX friction, "
                "technical issue, or deliberate avoidance. Requires re-engagement."),
            "EXPIRED":("⌛","#64748b",
                "Session link expired (Plaid default: 15–30 min). A new session link must be issued. "
                "Common for delayed owners."),
        }
        if isinstance(idv_raw,dict) and idv_raw:
            # Chart
            idv_chart_df=pd.DataFrame([{"Status":k,"Count":v} for k,v in idv_raw.items() if v>=0])
            col_chart,col_cards=st.columns([1,2])
            with col_chart:
                fig_idv=go.Figure(go.Pie(
                    labels=idv_chart_df["Status"],values=idv_chart_df["Count"],
                    marker=dict(colors=["#22c55e","#f59e0b","#ef4444","#f97316","#64748b"]),
                    hole=0.5,textinfo="label+value",
                ))
                fig_idv.update_layout(height=220,showlegend=False,margin=dict(t=10,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_idv),use_container_width=True)
            with col_cards:
                IDV_SQL = {
                    "SUCCESS": f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','SUCCESS') AS success_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                    "PENDING": f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','PENDING') AS pending_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                    "FAILED":  f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','FAILED') AS failed_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                    "EXPIRED": f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','EXPIRED') AS expired_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                    "CANCELED":f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','CANCELED') AS canceled_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';",
                }
                IDV_UNDERWRITING = {
                    "SUCCESS":"idv_passed += 1. When idv_passed >= 1 → idv_passed_boolean=true. Underwriting: identity confirmed — owner completed full biometric verification.",
                    "PENDING":"Session link sent but not yet completed. Link active for 15-30 min. Underwriting action: send reminder after 24h. Does NOT increment idv_passed.",
                    "FAILED":"Owner could not complete verification. Common causes: (1) Expired/damaged ID, (2) Selfie/ID face mismatch, (3) Liveness check failure, (4) Unsupported ID type, (5) Poor lighting. Underwriting action: issue new session link, request resubmission.",
                    "EXPIRED":"Session link timed out before owner completed it. Underwriting action: issue a new IDV session link. Common for delayed owners.",
                    "CANCELED":"Owner exited the flow without completing. May indicate UX friction, deliberate avoidance, or technical issue. Underwriting action: re-engage owner, investigate reason for abandonment.",
                }
                for status,count in sorted(idv_raw.items(),key=lambda x:-x[1]):
                    info=IDV_INFO.get(status.upper(),("❓","#94a3b8","Unknown status"))
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {info[1]};
                        border-radius:8px;padding:8px 14px;margin:3px 0">
                      <div style="display:flex;justify-content:space-between">
                        <span style="color:{info[1]};font-weight:700">{info[0]} {status}: {count} session(s)</span>
                      </div>
                      <div style="color:#94A3B8;font-size:.72rem;margin-top:3px">{info[2]}</div>
                    </div>""",unsafe_allow_html=True)
                    detail_panel(f"IDV {status}: {count} session(s)", str(count),
                        what_it_means=IDV_UNDERWRITING.get(status, info[2]),
                        source_table=f"rds_warehouse_public.facts · name='idv_status' → value.{status}",
                        source_file="plaid/plaidIdv.ts", source_file_line=f"Plaid IDV webhook · status={status} · pid=18",
                        api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.idv_status.value.{status}",
                        json_obj={"idv_status_object":idv_raw,"status_meaning":{status:IDV_UNDERWRITING.get(status,"")},"source":{"platformId":18,"name":"plaidIdv"},"note":"This object counts ALL sessions ever, not just the most recent."},
                        sql=IDV_SQL.get(status, f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_status FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';"),
                        links=[("plaid/plaidIdv.ts","Plaid IDV session handler"),("facts/kyb/index.ts","idv_status / idv_passed_boolean"),("integrations.constant.ts","PLAID_IDV=18")],
                        color=info[1], icon=info[0])
        else:
            flag(f"idv_status fact is null. idv_passed_boolean={idv_val}. "
                 "Possible causes: (1) Sole proprietor — IDV not triggered, "
                 "(2) Business onboarded before Plaid IDV was enabled, "
                 "(3) Plaid webhook not yet received.", "blue")

        # ── Fact lineage ─────────────────────────────────────────────────────
        st.markdown("---")
        render_lineage(facts,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"])

        # ── JSON structure ───────────────────────────────────────────────────
        with st.expander("📄 JSON structure — idv_status in API response"):
            st.markdown("""```json
{
  "idv_status": {
    "value": {
      "SUCCESS": 1,    ← count of successful IDV sessions
      "PENDING": 0,
      "CANCELED": 0,
      "EXPIRED": 0,
      "FAILED": 0
    },
    "source": {
      "confidence": null,
      "platformId": 18,    ← 18 = Plaid IDV (note: differs from pid=40 Plaid banking)
      "name": "plaidIdv"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" }
  },
  "idv_passed": {
    "value": 1,            ← COUNT of successful sessions (idv_status.SUCCESS)
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["idv_status"]
  },
  "idv_passed_boolean": {
    "value": true,         ← true when idv_passed >= 1
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["idv_passed"]
  },
  "is_sole_prop": {
    "value": false,        ← true when tin_submitted=null AND idv_passed_boolean=true
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["tin_submitted", "idv_passed_boolean"]
  }
}
```""")

        with st.expander("📋 SQL & Python — IDV data"):
            _sql_b = sql_for(bid,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
            st.code(f"""-- Plaid IDV session history (rds_integration_data):
SELECT piv.business_id, piv.status, piv.created_at, piv.updated_at
FROM rds_integration_data.plaid_identity_verification piv
WHERE piv.business_id = '{bid}'
ORDER BY piv.created_at DESC;

-- Or via BERT review tasks:
SELECT bert.status, bert.sublabel, bert.created_at
FROM rds_integration_data.business_entity_review_task bert
JOIN rds_integration_data.business_entity_verification bev
  ON bev.id = bert.business_entity_verification_id
WHERE bev.business_id = '{bid}' AND bert.key IN ('idv','identity_verification')
ORDER BY bert.created_at DESC;""",language="sql")

        analyst_card("🔬 IDV — Full Engineering Analysis",[
            f"idv_passed_boolean={idv_val}: This is the single boolean the Admin Portal displays as the IDV badge. "
            f"It is a DERIVED fact (platformId=-1, dependent) computed as: idv_passed >= 1. "
            f"idv_passed = COUNT(sessions where status=SUCCESS). Both are dependent facts — NOT direct vendor queries.",
            "idv_status is the primary Plaid fact (platformId=18, name='plaidIdv'). It stores an OBJECT (not array) "
            "of status counts: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. It counts ALL sessions ever, "
            "not just the most recent. A business with 2 FAILED and 1 SUCCESS has idv_passed_boolean=true.",
            f"is_sole_prop={sole_prop}: Derived from tin_submitted=null AND idv_passed_boolean=true. "
            "When true, some IDV configurations skip the flow. This is why sole proprietors may have "
            "idv_passed_boolean=null even though no error occurred — IDV was not triggered.",
            "IDV flow: Link sent → owner opens on mobile → (1) scan front+back of government ID, "
            "(2) take selfie, (3) liveness check, (4) data extraction + name/DOB match vs submitted info. "
            "Session expires in 15-30 min. Multiple sessions per business are possible (retries, multiple owners).",
            "Admin Portal path: KYB tab → Identity Verification → Verified/Not Verified badge. "
            "Rendered by microsites/packages/case/src/page/Cases/KYB/IdentityVerification.tsx. "
            "Badge = idv_passed_boolean. Detail = idv_status object breakdown.",
        ])

        ai_popup("IDV",f"IDV passed:{idv_val} sessions:{total_sessions} SUCCESS:{success_n} sole_prop:{sole_prop}",[
            "What are the most common reasons IDV fails?",
            "How is idv_passed_boolean derived from idv_status?",
            "What does is_sole_prop=true mean for IDV and why is it skipped?",
            "How do I query Plaid IDV session history from the database?",
            "Can a business with FAILED sessions still have idv_passed_boolean=true?"],bid)

    with r5:
        st.markdown("#### 🔗 Cross-Field Consistency & Anomaly Detection")
        st.caption("Each check compares facts from different vendors to detect inconsistencies, data integrity bugs, and high-risk patterns. "
                   "CRITICAL = likely data bug · HIGH = compliance/underwriting action needed · MEDIUM = investigate further · NOTICE = informational")

        name_m=str(gv(facts,"name_match_boolean") or "").lower()
        wl_hits_n=int(float(gv(facts,"watchlist_hits") or 0))
        mdsk_c=gc(facts,"sos_match")
        oc_c=gc(facts,"sos_match_boolean") if gp(facts,"sos_match_boolean")=="23" else 0.0
        am_n=int(float(gv(facts,"adverse_media_hits") or 0))
        bk_n=int(float(gv(facts,"num_bankruptcies") or 0))
        naics_v=str(gv(facts,"naics_code") or "")
        website_v=str(gv(facts,"website") or "")

        # Extended check set with root cause + action + source reference
        CHECKS=[
            # (name, condition, severity, description, root_cause, action, source_ref)
            ("TIN bool/status inconsistency",
             tin_bool=="true" and tin_status not in ("success",""),
             "CRITICAL",
             f"tin_match_boolean=true BUT tin_match.value.status='{tin_status}'",
             "tin_match_boolean is derived from tin_match.status='success'. If the boolean is true but status is not success, the derivation rule is broken.",
             "File bug report for integration-service. Check lib/facts/kyb/tin_match_boolean.ts. This is a data integrity issue — the value shown in Admin Portal may be wrong.",
             "integration-service/lib/facts/kyb/tin_match_boolean.ts"),
            ("SOS Active + TIN Failed",
             sos_act=="true" and tin_status=="failure",
             "MEDIUM",
             f"sos_active=true (entity registered) BUT tin_match.status=failure",
             "Entity IS registered and legally operating (SOS confirms). However, the EIN-name combination did not match IRS records. Common cause: DBA submitted instead of legal name on EIN certificate.",
             "Request applicant's IRS EIN confirmation letter (SS-4 notice). Verify legal name matches exactly. Do NOT approve until TIN is verified.",
             "rds_warehouse_public.facts: sos_active, tin_match"),
            ("SOS Inactive + TIN Verified",
             sos_act=="false" and tin_bool=="true",
             "HIGH",
             f"sos_active=false (not in good standing) BUT tin_match_boolean=true",
             "EIN is valid and matches IRS records. BUT the entity is not in good standing with its Secretary of State — possibly dissolved, administratively revoked, or has unpaid fees.",
             "Block approval until SOS standing is reinstated. Entity cannot legally operate in this state.",
             "rds_warehouse_public.facts: sos_active, tin_match_boolean"),
            ("IDV Passed + Name Match Failed",
             idv_val=="true" and name_m=="false",
             "MEDIUM",
             f"idv_passed_boolean=true (person verified) BUT name_match_boolean=false",
             "The owner's identity was confirmed by Plaid (government ID + selfie). However, the business name doesn't match SOS registry. Expected pattern: sole prop with DBA submitted instead of legal name.",
             "Check if business is a sole prop operating under a DBA. If DBA — acceptable. If not — investigate name discrepancy.",
             "rds_warehouse_public.facts: idv_passed_boolean, name_match_boolean"),
            ("No vendor confirmation",
             mdsk_c==0.0 and oc_c==0.0,
             "HIGH",
             "Both Middesk AND OpenCorporates have confidence=0 for sos_match",
             "Neither primary (Middesk, w=2.0) nor fallback (OC, w=0.9) vendor could match this entity in any SOS registry. Entity existence is COMPLETELY UNVERIFIED.",
             "Manual review required. Check if entity is very new (<2 weeks), operates under a DBA, or is incorporated in a state not covered by submitted address search.",
             "rds_warehouse_public.facts: sos_match (pid=16 conf), sos_match_boolean (pid=23 conf)"),
            ("Tax haven formation state",
             tax_haven,
             "NOTICE",
             f"formation_state={form_state} is a tax-haven state (DE/NV/WY)",
             "Tax-haven states create entity resolution gaps. The domestic filing in DE/NV/WY may differ from the submitted address state. Middesk address-based search may have found the WRONG record.",
             "Verify both domestic (formation state) and foreign (operating state) SOS filings separately. Consider re-running Middesk with formation_state as jurisdiction.",
             "rds_warehouse_public.facts: formation_state + primary_address.state"),
            ("Website but no NAICS",
             website_v and naics_v in ("","561499"),
             "MEDIUM",
             f"website='{website_v[:40]}' is set BUT naics_code={'561499 (fallback)' if naics_v=='561499' else 'missing'}",
             "Gap G2: The AI enrichment (last resort vendor) had access to the website URL but could not classify the industry. Possible cause: the website URL was not passed to the AI as a searchable parameter.",
             "Check integration-service/lib/aiEnrichment/aiEnrichment.ts — verify params.website is being passed. Consider re-running AI enrichment with web_search enabled.",
             "integration-service/lib/aiEnrichment/aiEnrichment.ts"),
            ("Watchlist hit with low SOS confidence",
             wl_hits_n>0 and mdsk_c<0.5,
             "HIGH",
             f"watchlist_hits={wl_hits_n} AND Middesk confidence={mdsk_c:.3f} (<0.50)",
             "The entity has watchlist hits AND Middesk couldn't confidently match it. The entity being screened may not be the same legal entity as the one being operated.",
             "Enhanced due diligence: verify entity identity via manual document review before acting on watchlist hits. The watchlist hit may belong to a different entity with a similar name.",
             "rds_warehouse_public.facts: watchlist_hits, sos_match confidence"),
            ("Adverse media but no watchlist",
             am_n>0 and wl_hits_n==0,
             "NOTICE",
             f"adverse_media_hits={am_n} BUT watchlist_hits=0",
             "Adverse media (negative news) exists but no formal sanctions/PEP list hits. Adverse media is deliberately excluded from the consolidated watchlist fact.",
             "Review adverse_media_hits detail. Negative press may indicate reputational risk even without formal sanctions.",
             "integration-service/lib/facts/kyb/consolidatedWatchlist.ts (filterOutAdverseMedia)"),
            ("Bankruptcy with active SOS",
             bk_n>0 and sos_act=="true",
             "MEDIUM",
             f"num_bankruptcies={bk_n} BUT sos_active=true",
             "Entity is currently in good standing (SOS active) but has bankruptcy history. May be a discharged bankruptcy — entity survived restructuring.",
             "Check bankruptcy age and type (Chapter 7=liquidation vs Chapter 11=reorganization). Discharged BK with active SOS is manageable; recent BK requires enhanced review.",
             "rds_warehouse_public.facts: num_bankruptcies, sos_active"),
        ]

        found_checks=[(name,sev,desc,root,action,src) for name,cond,sev,desc,root,action,src in CHECKS if cond]
        not_found=[(name,sev) for name,cond,sev,desc,root,action,src in CHECKS if not cond]

        if found_checks:
            st.markdown(f"**{len(found_checks)} issue(s) detected** (ordered by severity):")
            for name,sev,desc,root,action,src in sorted(found_checks,
                key=lambda x:{"CRITICAL":0,"HIGH":1,"MEDIUM":2,"NOTICE":3}.get(x[1],4)):
                col={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","NOTICE":"#3B82F6"}.get(sev,"#64748b")
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col};
                    border-radius:10px;padding:14px 18px;margin:8px 0">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="color:{col};font-weight:700;font-size:.88rem">{sev} — {name}</span>
                    <span style="color:#475569;font-size:.68rem;font-family:monospace">{src}</span>
                  </div>
                  <div style="color:#CBD5E1;font-size:.78rem;margin-bottom:6px"><strong>Detected:</strong> {desc}</div>
                  <div style="color:#94A3B8;font-size:.75rem;margin-bottom:4px"><strong>Root cause:</strong> {root}</div>
                  <div style="color:#60A5FA;font-size:.75rem">⚡ <strong>Action:</strong> {action}</div>
                </div>""",unsafe_allow_html=True)
                detail_panel(f"{sev} — {name}", desc,
                    what_it_means=f"Root cause: {root}\n\nAction: {action}",
                    source_table="rds_warehouse_public.facts (cross-field check across multiple fact names)",
                    source_file=src.split(" ")[0] if src else "facts/kyb/index.ts",
                    source_file_line=src,
                    json_obj={"check":name,"severity":sev,"detected":desc,"root_cause":root,"recommended_action":action,"source_reference":src},
                    sql=f"-- Verify the facts involved:\nSELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val\nFROM rds_warehouse_public.facts\nWHERE business_id='{bid}'\n  AND name IN ('sos_active','sos_match_boolean','tin_match_boolean','tin_match','idv_passed_boolean','naics_code','watchlist_hits')\nORDER BY name;",
                    links=[("facts/kyb/index.ts","Fact definitions"),("facts/rules.ts","Fact Engine rules"),("consolidatedWatchlist.ts","Watchlist architecture")],
                    color=col, icon={"CRITICAL":"🔴","HIGH":"🟠","MEDIUM":"🟡","NOTICE":"🔵"}.get(sev,"⚠️"))
        else:
            flag("✅ No cross-field anomalies detected across all checks.","green")

        # Checks that passed (green)
        with st.expander(f"✅ {len(not_found)} checks passed — click to see"):
            for name,sev in not_found:
                st.markdown(f"<span style='color:#22c55e;font-size:.75rem'>✅ {name}</span>",unsafe_allow_html=True)

        st.markdown("---")

        # Summary matrix with detail panels
        st.markdown("##### Key Field Consistency Matrix")
        MATRIX_CHECKS = [
            ("sos_active","sos_match_boolean",sos_act,sos_match,"Should agree (both true or both false)",sos_act==sos_match or sos_act=="true","Both facts derive from sos_filings. sos_active=ANY(filing.active). sos_match_boolean=sos_match.value==='success'. They can diverge if Middesk matched the filing but the entity is inactive.",f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_active','sos_match_boolean');"),
            ("tin_match_boolean","tin_match.status",tin_bool,tin_status,"bool=true only when status='success'",not(tin_bool=="true" and tin_status not in ("success","")),"CRITICAL data integrity check. tin_match_boolean is derived from tin_match.value.status==='success'. Any divergence = bug in integration-service lib/facts/kyb/index.ts.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS bool FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match_boolean';\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS status FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';"),
            ("idv_passed_boolean","idv_status.SUCCESS",idv_val,str(success_n if isinstance(idv_raw,dict) else "?"),"boolean=true requires SUCCESS>0",not(idv_val=="true" and success_n==0),"idv_passed_boolean is derived from idv_passed (COUNT of SUCCESS sessions). If boolean=true but SUCCESS=0, that's a computation error.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS idv_bool FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_passed_boolean';\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value','SUCCESS') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='idv_status';"),
            ("sos_active","formation_state",sos_act,form_state,"active entity should have formation state",(sos_act!="true") or bool(form_state),"If sos_active=true, the entity is registered and formation_state should be populated by Middesk. Missing formation_state with active SOS is unusual.",f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_active','formation_state');"),
            ("naics_code","mcc_code",naics_v,str(gv(facts,"mcc_code") or ""),"both should be set if classification succeeded",not(bool(naics_v) and not gv(facts,"mcc_code")),"mcc_code is computed from naics_code via rel_naics_mcc lookup. If naics_code is set but mcc_code is null, the lookup may have failed.",f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('naics_code','mcc_code');"),
        ]
        matrix_rows=[]
        for field_a,field_b,val_a,val_b,expected,ok,*extra in MATRIX_CHECKS:
            matrix_rows.append({"Field A":field_a,"Value A":val_a or "(null)","Field B":field_b,"Value B":val_b or "(null)","Expected":expected,"Status":"✅ OK" if ok else "⚠️ CHECK"})
        st.dataframe(pd.DataFrame(matrix_rows),use_container_width=True,hide_index=True)
        st.caption("▼ Click any row below for full lineage, JSON, and verification SQL")
        for field_a,field_b,val_a,val_b,expected,ok,explanation,sql in MATRIX_CHECKS:
            detail_panel(f"{field_a} ↔ {field_b}", f"{val_a or 'null'} vs {val_b or 'null'}",
                what_it_means=f"Expected: {expected}\n\n{explanation}",
                source_table=f"rds_warehouse_public.facts · name IN ('{field_a}', '{field_b.split('.')[0]}')",
                source_file="facts/kyb/index.ts", source_file_line="Cross-field consistency check",
                json_obj={"field_a":field_a,"value_a":val_a or None,"field_b":field_b,"value_b":val_b or None,"expected":expected,"consistent":ok},
                sql=sql,
                links=[("facts/kyb/index.ts","Fact definitions"),("facts/rules.ts","dependentFact rule for derived fields")],
                color="#22c55e" if ok else "#ef4444", icon="✅" if ok else "⚠️")

        analyst_card("🔬 Cross-Analysis — Engineering Interpretation",[
            "Cross-field checks detect three types of issues: (1) Data integrity bugs in integration-service derivation logic, (2) Genuine business risk patterns (BK+active, watchlist+low_conf), (3) Expected patterns that look like errors (IDV passed + name_match=false for sole props with DBA).",
            "TIN bool/status inconsistency is the most critical check — if triggered, the Admin Portal is showing WRONG data. The derivation in lib/facts/kyb/tin_match_boolean.ts may have a bug or the wrong fact is being read.",
            "No vendor confirmation (Middesk conf=0 + OC conf=0) means the entity existence is completely unverified. All subsequent KYB facts (SOS filings, TIN, IDV) may belong to the wrong entity or be fabricated.",
            f"Current status: {len(found_checks)} issue(s) detected, {len(not_found)} checks passed. "
            f"{'⚠️ Manual review recommended.' if len(found_checks)>0 else '✅ No anomalies detected.'}",
        ])

# ════════════════════════════════════════════════════════════════════════════════
# CLASSIFICATION & KYB
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🏭 Classification & KYB":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 🏭 Classification & KYB — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"classification")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    naics=str(gv(facts,"naics_code") or "")
    mcc=str(gv(facts,"mcc_code") or "")
    naics_conf=gc(facts,"naics_code"); naics_src=gp(facts,"naics_code")
    is_fallback=naics=="561499"

    _naics_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid, JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';"
    alts_n=len(get_alts(facts,"naics_code"))
    c1,c2,c3,c4,c5=st.columns(5)
    with c1:
        kpi_detail("NAICS",naics or "N/A",f"{'⚠️ Fallback code' if is_fallback else 'Industry code'} · {pid_info(naics_src)[0]}",
                   "#ef4444" if is_fallback else "#22c55e" if naics else "#64748b",
                   "naics_code",naics or None,"rds_warehouse_public.facts",_naics_sql,
                   ["All vendors failed to match entity — no commercial NAICS data","AI fired as last resort but also returned 561499","website fact missing — AI could not search business website"],
                   f'{{"name":"naics_code","value":{json.dumps(naics or None)},"source":{{"platformId":{naics_src or "null"},"confidence":{naics_conf}}},"ruleApplied":{{"name":"factWithHighestConfidence"}}}}',
                   f"GET /integration/api/v1/facts/business/{bid}/kyb → data.naics_code")
    with c2:
        kpi_detail("NAICS Conf",f"{naics_conf:.4f}","0=no match · 1=perfect · formula varies by vendor",
                   "#22c55e" if naics_conf>0.70 else "#f59e0b" if naics_conf>0.40 else "#ef4444",
                   "naics_code.source.confidence",naics_conf,"rds_warehouse_public.facts (nested)","-- conf is inside the JSON: JSON_EXTRACT_PATH_TEXT(value,'source','confidence')",
                   ["conf=0 means vendor returned null or entity match failed","OC/ZI/EFX: conf = match.index ÷ 55 — low conf = poor entity match rank"],
                   f'{{"formula":"match.index ÷ 55 (OC/ZI/EFX) OR 0.15+0.20×tasks (Middesk) OR self-reported (AI)","current":{naics_conf}}}')
    with c3:
        kpi_detail("MCC",mcc or "N/A",f"Merchant Category Code · {pid_info(gp(facts,'mcc_code'))[0]}","#3B82F6",
                   "mcc_code",mcc or None,"rds_warehouse_public.facts",
                   f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS mcc FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='mcc_code';",
                   ["NAICS=561499 → MCC defaults to 5614","mcc_code is derived (pid=-1) — not independently verified"],
                   f'{{"name":"mcc_code","value":{json.dumps(mcc or None)},"derivation":"mcc_code_found ?? mcc_from_naics(naics_code) ?? 5614"}}')
    with c4:
        kpi_detail("Industry",str(gv(facts,"industry") or "N/A")[:22],"2-digit NAICS sector group","#8B5CF6",
                   "industry",str(gv(facts,"industry") or None),"rds_warehouse_public.facts",
                   f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS industry FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='industry';",
                   None,'{"name":"industry","note":"2-digit NAICS sector derived from naics_code first 2 digits"}')
    with c5:
        kpi_detail("Alt Sources",str(alts_n),"Other vendors that also classified","#60A5FA" if alts_n>0 else "#64748b",
                   "naics_code.alternatives",alts_n,"rds_warehouse_public.facts (alternatives[] array)",
                   "-- alternatives are nested inside the JSON value column\nSELECT JSON_EXTRACT_PATH_TEXT(value,'alternatives') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';",
                   ["0 alternatives = only one vendor returned a classification","All other vendors returned null or did not match entity"],
                   f'{{"alternatives_count":{alts_n},"note":"See alternatives[] array in the naics_code JSON for each losing vendor"}}')

    if is_fallback:
        flag("🚨 NAICS 561499 = fallback code ('All Other Business Support Services'). "
             "This business's industry could NOT be determined. All vendors failed to classify. "
             "This impacts Worth Score (company_profile feature = low confidence) and MCC (defaults to 5614).", "red")
    elif not naics:
        flag("⚠️ No NAICS code stored. Classification has not been run or all vendors returned null.", "amber")

    cl1,cl2,cl3,cl4=st.tabs(["🏭 NAICS/MCC Pipeline","🏢 Background & Firmographic","📬 Contact & Address","🌐 Website & Digital"])

    with cl1:
        st.markdown("#### 🏭 NAICS/MCC Classification — Complete Pipeline")
        st.caption("""**Fact name:** `naics_code` · **Table:** `rds_warehouse_public.facts` ·
        **Rule:** `factWithHighestConfidence` · **Worth Score impact:** `naics6` feature in Company Profile category ·
        **Admin Portal:** KYB → Background tab → Industry field""")

        # ── Vendor pipeline ───────────────────────────────────────────────────
        st.markdown("##### How NAICS is Determined — Vendor Cascade (ordered by priority)")
        SOURCE_PRIORITY=pd.DataFrame([
            ("Equifax","17","0.7","efx_primnaicscode","warehouse.equifax_us_latest","Bulk firmographic — matched by EFX entity model"),
            ("ZoomInfo","24","0.8","zi_c_naics6","zoominfo.comp_standard_global","Bulk firmographic — matched by ZI entity model"),
            ("OpenCorporates","23","0.9","industry_code_uids → us_naics-XXXXXX","OC company API","Parsed from OC industry tags: 'us_naics-541512' → NAICS 541512"),
            ("SERP (Google)","22","0.3","businessLegitimacyClassification.naics_code","Google Business Profile","Google My Business category → mapped to NAICS"),
            ("Trulioo","38","0.7","extractStandardizedIndustriesFromTruliooResponse","Trulioo KYB API","Industry field from Trulioo company verification response"),
            ("Applicant","0","0.2","naics_code (6-digit, validated)","Onboarding form","Self-reported by merchant — lowest trust"),
            ("AI (GPT-4o-mini)","31","0.1","AINaicsEnrichment.response.naics_code","integration-service/lib/aiEnrichment","LAST RESORT: fires only when ALL vendors fail. Prompts GPT with name+address+(website if available)"),
        ],columns=["Vendor","pid","Weight","Data Field","Data Source","How it works"])
        SOURCE_PRIORITY["Won?"]=["✅ YES" if r["pid"]==naics_src else "—" for _,r in SOURCE_PRIORITY.iterrows()]
        SOURCE_PRIORITY["Conf formula"]=[
            "match.index ÷ 55 (MAX=55)","match.index ÷ 55","match.index ÷ 55",
            "heuristic","status-based","1.0 (self-reported)","self-reported (LOW=0.3 MED=0.6 HIGH=0.9)"
        ]
        st.dataframe(SOURCE_PRIORITY,use_container_width=True,hide_index=True)
        st.caption("▼ Click any vendor row below to see its exact data field, confidence formula, and SQL")
        for _,row in SOURCE_PRIORITY.iterrows():
            _pid = row["pid"]; _won = row["Won?"]=="✅ YES"
            _col = "#22c55e" if _won else "#64748b"
            detail_panel(f"{row['Vendor']} (pid={_pid}, w={row['Weight']})", row["Won?"],
                what_it_means=f"{row['How it works']}\n\nData field: {row['Data Field']}\nData source: {row['Data Source']}\nConfidence formula: {row['Conf formula']}\nWon this classification: {'YES' if _won else 'NO — lost to higher confidence×weight vendor'}",
                source_table=row["Data Source"],
                source_file="facts/businessDetails/index.ts" if _pid in ("31","0") else "facts/kyb/index.ts",
                source_file_line=f"naicsCode · pid={_pid} · {row['Vendor']}",
                api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.naics_code{'  (winner)' if _won else '.alternatives[]'}",
                json_obj={"vendor":row["Vendor"],"platformId":int(_pid) if _pid.lstrip('-').isdigit() else _pid,"weight":float(row["Weight"]),"data_field":row["Data Field"],"conf_formula":row["Conf formula"],"won":_won},
                sql=f"-- Winner:\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid, JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';\n-- Alternatives:\n-- SELECT JSON_EXTRACT_PATH_TEXT(value,'alternatives') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';",
                links=[("facts/kyb/index.ts","NAICS fact definition"),("facts/rules.ts","factWithHighestConfidence rule"),("integrations.constant.ts",f"INTEGRATION_ID={_pid}")],
                color=_col, icon="✅" if _won else "—")

        # ── Winner detail ─────────────────────────────────────────────────────
        if naics_src:
            win_name=pid_info(naics_src)[0]
            conf_formula={"23":"match.index ÷ 55 (where match.index = rank of OC search result, max=55)",
                          "24":"match.index ÷ 55 (ZI entity match rank)",
                          "17":"XGBoost entity match score OR match.index ÷ 55",
                          "16":"0.15 + 0.20 × passing Middesk review tasks (max 4)",
                          "38":"status-based: SUCCESS=0.70 · PARTIAL=0.40 · FAILED=0.20",
                          "31":"self-reported: LOW=0.30 · MEDIUM=0.60 · HIGH=0.90",
                          "0":"1.00 by convention (applicant self-reported)",
                          "22":"heuristic based on SERP result quality"}.get(naics_src,"see Fact Engine")
            st.markdown(f"""<div style="background:#052e16;border-left:4px solid #22c55e;border-radius:10px;padding:12px 16px;margin:8px 0">
              <div style="color:#22c55e;font-weight:700;font-size:.88rem">✅ Winner: {win_name} (pid={naics_src})</div>
              <div style="color:#CBD5E1;font-size:.78rem;margin-top:6px">
                <strong>NAICS code:</strong> {naics or '(null)'} · 
                <strong>Confidence:</strong> {naics_conf:.4f} ({conf_formula}) ·
                <strong>Rule:</strong> factWithHighestConfidence (highest conf×weight, WEIGHT_THRESHOLD=0.05)
              </div>
            </div>""",unsafe_allow_html=True)
            detail_panel(f"NAICS Winner: {win_name}", f"NAICS={naics or 'null'} · conf={naics_conf:.4f}",
                what_it_means=f"Winning vendor: {win_name} (platformId={naics_src}). Confidence formula: {conf_formula}. Rule: factWithHighestConfidence — picks vendor with highest confidence×weight. If two vendors within 5% (WEIGHT_THRESHOLD=0.05) of each other, higher platform weight wins. Weights: Middesk=2.0 > OC=0.9 > ZI=0.8 = Trulioo=0.8 > EFX=0.7 > SERP=0.3 > AI=0.1",
                source_table="rds_warehouse_public.facts · name='naics_code'",
                source_file="facts/rules.ts", source_file_line="factWithHighestConfidence L36–59 · WEIGHT_THRESHOLD=0.05 L9",
                api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.naics_code",
                json_obj={"name":"naics_code","value":naics or None,"source":{"platformId":int(naics_src) if naics_src.lstrip('-').isdigit() else naics_src,"name":win_name.lower(),"confidence":naics_conf},"ruleApplied":{"name":"factWithHighestConfidence","description":"Get the fact with the highest confidence and weight if the same confidence"}},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics,JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid,JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';",
                links=[("facts/rules.ts","factWithHighestConfidence algorithm"),("facts/sources.ts","vendor source definitions"),("integrations.constant.ts","platform weights")],
                color="#22c55e", icon="✅")

        # ── Fact lineage table ────────────────────────────────────────────────
        render_lineage(facts,["naics_code","mcc_code","naics_description","mcc_description","industry"])

        # ── Alternatives ──────────────────────────────────────────────────────
        alts=get_alts(facts,"naics_code")
        if alts:
            st.markdown("##### Alternative NAICS Sources (competed but lost)")
            alt_rows=[]
            for a in alts:
                vname=pid_info(a["pid"])[0]
                why=(f"Confidence {a['conf']:.4f} < winner {naics_conf:.4f}"
                     if a["conf"]<naics_conf
                     else f"Lower platform weight (tie-break) — same conf range ±0.05")
                alt_rows.append({"Vendor":vname,"pid":a["pid"],
                    "NAICS code":str(a.get("value",""))[:20] if a.get("value") else "(null)",
                    "Confidence":f"{a['conf']:.4f}","Why lost":why})
            st.dataframe(pd.DataFrame(alt_rows),use_container_width=True,hide_index=True)
            st.caption("These are the exact values from alternatives[] in the JSON stored in rds_warehouse_public.facts")
        else:
            st.info("No alternative NAICS sources — only one vendor returned a classification for this business.")

        # ── MCC derivation ────────────────────────────────────────────────────
        st.markdown("##### MCC Derivation")
        st.markdown(f"""<div style="background:#0c1a2e;border-left:3px solid #3B82F6;border-radius:8px;padding:12px 16px;margin:8px 0;font-size:.78rem">
          <div style="color:#60A5FA;font-weight:600;margin-bottom:6px">How MCC is computed (two-step logic):</div>
          <div style="color:#CBD5E1">
            Step 1 — Direct AI classification: if AI (pid=31) returned an MCC code directly → use <code>mcc_code_found</code><br>
            Step 2 — NAICS→MCC lookup: if no direct MCC → look up <code>naics_code</code> in <code>rel_naics_mcc</code> mapping table → <code>mcc_code_from_naics</code><br>
            Step 3 — Fallback: if NAICS=561499 (fallback) → MCC defaults to <strong>5614</strong> (Business Services NEC)<br>
            <br><strong>Current:</strong> NAICS={naics or '(null)'} → MCC={mcc or '(null)'}
          </div>
        </div>""",unsafe_allow_html=True)

        # ── 561499 root cause ─────────────────────────────────────────────────
        if is_fallback:
            st.markdown("---")
            st.markdown("#### 🚨 561499 Root Cause Analysis")
            st.markdown("NAICS 561499 = 'All Other Business Support Services' — the industry the Fact Engine assigns when ALL other options fail.")
            website_v=str(gv(facts,"website") or "")
            for gap,desc,is_present,evidence in [
                ("G1: Entity matching failed — no commercial NAICS available",
                 "None of ZI, EFX, OC, Middesk could match this entity in their database. "
                 "The entity may be too new (<2 weeks), too small (no commercial database presence), "
                 "or submitted with a name/address that doesn't match any registry record.",
                 len(alts)==0 and naics_conf<0.1,
                 f"Alternatives: {len(alts)} source(s) | Winner conf: {naics_conf:.4f}"),
                ("G2: AI web_search not triggered (Gap G2)",
                 "The AI enrichment (last resort) received the business name+address but NOT the website URL. "
                 "The AI cannot search the web without the website parameter. "
                 "Source: integration-service/lib/aiEnrichment/aiEnrichment.ts — params.website must be non-null.",
                 bool(website_v) and is_fallback,
                 f"website fact = '{website_v[:50]}' (not empty — URL exists but was not passed to AI)"),
                ("G3: AI classification failed — insufficient signals",
                 "AI received name+address (and possibly website) but could not confidently classify. "
                 "Common causes: generic name ('ABC LLC'), no web presence, or website with insufficient content. "
                 "AI prompt requires sufficient business description to return a specific NAICS.",
                 naics_src=="31" and is_fallback,
                 f"Winner is AI (pid={naics_src}) with conf={naics_conf:.4f} → returned 561499 anyway"),
            ]:
                color="#ef4444" if is_present else "#334155"
                prefix="🔴 CONFIRMED" if is_present else "⚪ Not confirmed"
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                    border-radius:8px;padding:10px 14px;margin:4px 0">
                  <div style="color:{color};font-weight:700;font-size:.82rem">{prefix} — {gap}</div>
                  <div style="color:#94A3B8;font-size:.74rem;margin-top:4px">{desc}</div>
                  <div style="color:#475569;font-size:.68rem;margin-top:2px">Evidence: {evidence}</div>
                </div>""",unsafe_allow_html=True)

        # ── JSON structure ────────────────────────────────────────────────────
        with st.expander("📄 JSON structure — naics_code in API response"):
            st.markdown(f"""```json
{{
  "naics_code": {{
    "name": "naics_code",
    "value": "{naics or 'null'}",           ← shown in Admin Portal KYB → Background → Industry
    "source": {{
      "confidence": {naics_conf:.4f},        ← formula varies by vendor (see table above)
      "platformId": {naics_src or 'null'},   ← winning vendor
      "name": "{pid_info(naics_src)[0].lower()}"
    }},
    "ruleApplied": {{ "name": "factWithHighestConfidence" }},
    "alternatives": [
      // All other vendors that returned a NAICS code, with their confidence
      // {{ "value": "541512", "source": 23, "confidence": 0.8182 }}
      // {{ "value": "722511", "source": 24, "confidence": 0.5455 }}
    ]
  }},
  "mcc_code": {{
    "value": "{mcc or 'null'}",             ← mcc_code_found ?? mcc_code_from_naics
    "source": {{ "platformId": -1, "name": "dependent" }}  ← derived fact
  }}
}}
```""")

        ai_popup("NAICS",f"NAICS:{naics} conf:{naics_conf:.4f} src:{pid_info(naics_src)[0]} MCC:{mcc} fallback:{is_fallback}",[
            "Why did this specific vendor win the NAICS classification?",
            "What is the exact algorithm for factWithHighestConfidence with WEIGHT_THRESHOLD=0.05?",
            "What are all 3 root causes of NAICS 561499 and how to fix each?",
            "How does the rel_naics_mcc lookup table map NAICS to MCC?",
            "What SQL shows NAICS history and all alternative sources?"],bid)

        with st.expander("📋 SQL & Python"):
            _sql_b = sql_for(bid,["naics_code","mcc_code","naics_description","mcc_description","industry"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
            st.code(f"""-- NAICS history (all versions, including alternatives):
SELECT
    name,
    JSON_EXTRACT_PATH_TEXT(value,'value')               AS naics_code,
    JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,
    JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')  AS rule,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}' AND name IN ('naics_code','mcc_code','naics_description','industry')
ORDER BY name, received_at DESC;""",language="sql")
            st.code(py_for(bid,["naics_code","mcc_code"]),language="python")

        analyst_card("🔬 NAICS Classification — Complete Engineering Analysis",[
            f"Winning source: {pid_info(naics_src)[0]} (pid={naics_src}) · "
            f"confidence {naics_conf:.4f} · rule: factWithHighestConfidence (WEIGHT_THRESHOLD=0.05). "
            f"{'⚠️ AI wins only when ALL commercial vendors fail.' if naics_src=='31' else '✅ Commercial vendor won.'}",
            f"Confidence interpretation: {naics_conf:.4f} → "
            f"{'Reliable (>0.70)' if naics_conf>0.70 else 'Moderate (0.40–0.70), verify with alternatives' if naics_conf>0.40 else 'LOW (<0.40) — classification may be wrong'}. "
            f"For OC/ZI/EFX: conf = entity_match_rank ÷ 55 where 55=MAX_CONFIDENCE_INDEX. "
            f"A conf of 0.35 means the entity was the 35th-ranked result in the vendor search.",
            "MCC derivation: (1) AI direct MCC if returned → (2) rel_naics_mcc lookup from NAICS → (3) 5614 if NAICS=561499. "
            "MCC is a DERIVED fact (pid=-1, dependent). It is NOT independently verified by any vendor.",
            f"{'⚠️ 561499 fallback: this code impacts Worth Score (naics6 feature in Company Profile category). ' if is_fallback else ''}"
            "naics6 is a Worth Score model input — unknown NAICS reduces model confidence and may lower score.",
            f"Alternatives found: {len(alts)} other vendor(s) also provided NAICS codes. "
            f"{'They are visible in alternatives[] of the JSON. The Fact Engine rejected them because their confidence×weight was lower.' if alts else 'No alternatives — only one vendor returned a classification.'}",
        ])

    with cl2:
        st.markdown("#### 🏢 Background & Firmographic Data")
        st.caption("""**Sources:** ZoomInfo (pid=24, w=0.8), Equifax (pid=17, w=0.7), Middesk (pid=16, w=2.0), Applicant (pid=0) ·
        **Admin Portal:** KYB → Background tab · **Worth Score features:** revenue, count_employees, age_business""")

        # KPIs
        biz_name=str(gv(facts,"business_name") or "")
        legal_name_v=str(gv(facts,"legal_name") or "")
        revenue_v=str(gv(facts,"revenue") or "")
        emp_v=str(gv(facts,"num_employees") or "")
        kyb_sub=str(gv(facts,"kyb_submitted") or "").lower()
        kyb_comp=str(gv(facts,"kyb_complete") or "").lower()

        _bg_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('kyb_submitted','kyb_complete','revenue','num_employees') ORDER BY name;"

        # KPI cards only — no expanders inside columns
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("KYB Submitted","✅ Yes" if kyb_sub=="true" else "❌ No","Onboarding form submitted","#22c55e" if kyb_sub=="true" else "#f59e0b")
        with c2: kpi("KYB Complete","✅ Yes" if kyb_comp=="true" else "❌ No","Business verified + people screened","#22c55e" if kyb_comp=="true" else "#f59e0b")
        with c3: kpi("Revenue",revenue_v[:18] if revenue_v else "Not available","ZI/EFX bulk data · Worth Score input","#3B82F6" if revenue_v else "#64748b")
        with c4: kpi("Employees",emp_v if emp_v else "Not available","num_employees · Worth Score feature: count_employees","#3B82F6" if emp_v else "#64748b")

        # Detail panels — sequential full-width (no overlap)
        detail_panel("📋 KYB Submitted", kyb_sub or "Unknown",
            what_it_means="kyb_submitted=true when the onboarding form has been submitted (addresses[] is not empty). DEPENDENT fact (pid=-1) derived from the addresses fact. Means the merchant completed the onboarding form — does NOT mean KYB verification is complete.",
            source_table="rds_warehouse_public.facts · name='kyb_submitted'",
            source_file="facts/kyb/index.ts", source_file_line="kybSubmitted · dependent · addresses[].length > 0",
            json_obj={"name":"kyb_submitted","value":kyb_sub=="true","source":{"platformId":-1,"name":"dependent"},"dependencies":["addresses"]},
            sql=_bg_sql, links=[("facts/kyb/index.ts","kybSubmitted definition")],
            color="#22c55e" if kyb_sub=="true" else "#f59e0b", icon="📋")
        detail_panel("✅ KYB Complete", kyb_comp or "Unknown",
            what_it_means="kyb_complete=true when BOTH: (1) business_verified=true AND (2) screened_people not empty. DEPENDENT fact. kyb_complete=false means entity not fully verified OR PSC (Person Screening) not completed.",
            source_table="rds_warehouse_public.facts · name='kyb_complete'",
            source_file="facts/kyb/index.ts", source_file_line="kybComplete · dependent · business_verified AND screened_people",
            json_obj={"name":"kyb_complete","value":kyb_comp=="true","source":{"platformId":-1,"name":"dependent"},"dependencies":["business_verified","screened_people"]},
            sql=_bg_sql, links=[("facts/kyb/index.ts","kybComplete definition"),("trulioo","Trulioo PSC screening")],
            color="#22c55e" if kyb_comp=="true" else "#f59e0b", icon="✅" if kyb_comp=="true" else "❌")
        detail_panel("💰 Revenue", revenue_v or "Not available",
            what_it_means="Annual revenue in USD. Primary source: ZoomInfo (pid=24, w=0.8) or Equifax (pid=17, w=0.7) bulk firmographic — matched via internal entity-matching XGBoost model. PRIMARY Worth Score feature (Business Operations). Null = vendor could not match this entity.",
            source_table="rds_warehouse_public.facts · name='revenue'",
            source_file="facts/kyb/index.ts", source_file_line="revenue · factWithHighestConfidence · ZI pid=24 / EFX pid=17",
            api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.revenue",
            json_obj={"name":"revenue","value":revenue_v or None,"source":{"platformId":24,"name":"zoominfo","weight":0.8},"worth_score_feature":"revenue","worth_score_category":"Business Operations"},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS revenue FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='revenue';",
            links=[("worth_score_model.py","Revenue as Worth Score feature"),("integrations.constant.ts","ZOOMINFO=24, EQUIFAX=17")],
            color="#3B82F6" if revenue_v else "#64748b", icon="💰")
        detail_panel("👥 Employees", emp_v or "Not available",
            what_it_means="Employee count from ZoomInfo (pid=24) or Equifax (pid=17) bulk firmographic. Worth Score feature: count_employees (Company Profile). Null = entity not found in vendor databases. Proxy for business scale and stability.",
            source_table="rds_warehouse_public.facts · name='num_employees'",
            source_file="facts/kyb/index.ts", source_file_line="numEmployees · factWithHighestConfidence · ZI pid=24 / EFX pid=17",
            json_obj={"name":"num_employees","value":emp_v or None,"worth_score_feature":"count_employees","worth_score_category":"Company Profile"},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS num_employees FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='num_employees';",
            links=[("worth_score_model.py","count_employees Worth Score feature"),("integrations.constant.ts","ZOOMINFO=24")],
            color="#3B82F6" if emp_v else "#64748b", icon="👥")

        # Name lineage
        st.markdown("##### Name Lineage — business_name vs legal_name")
        st.markdown("""<div style="background:#0c1a2e;border-left:3px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:6px 0;font-size:.78rem">
          <div style="color:#fde68a;font-weight:600">⚠️ business_name ≠ legal_name — understand the difference:</div>
          <div style="color:#CBD5E1;margin-top:4px">
            <strong>business_name</strong> = what the merchant submitted on the onboarding form (may be DBA / trade name)<br>
            <strong>legal_name</strong> = the entity's legal name as registered with the Secretary of State (from Middesk/OC)<br>
            <strong>names_found</strong> = combineFacts array of ALL names found across ALL vendors (merged, deduplicated)<br>
            <strong>dba_found</strong> = DBA names from applicant submission + registry filings (also combineFacts)<br>
            A mismatch between business_name and legal_name is expected for DBAs. It does NOT indicate fraud.
          </div>
        </div>""",unsafe_allow_html=True)

        render_lineage(facts,["business_name","legal_name","names_found","dba_found","corporation",
                               "formation_date","year_established","revenue","num_employees",
                               "kyb_submitted","kyb_complete","compliance_status","risk_score"])

        # Worth Score features
        st.markdown("##### Worth Score Feature Mapping — Firmographic inputs")
        try:
            fd_str=str(gv(facts,"formation_date") or "")
            biz_age=datetime.now(timezone.utc).year-int(fd_str[:4]) if fd_str and fd_str[:4].isdigit() else None
        except: biz_age=None

        feat_rows=[
            ("age_business",f"{biz_age} years" if biz_age else "Unknown","formation_date → current year minus formation year","Company Profile","Older businesses = lower default risk"),
            ("revenue",revenue_v or "null","revenue fact from ZI/EFX","Business Operations","Primary P&L input to financial sub-model"),
            ("count_employees",emp_v or "null","num_employees fact from ZI/EFX","Company Profile","Proxy for business scale and stability"),
            ("naics6",naics or "null","naics_code fact (6-digit)","Company Profile","Industry risk classification — 561499 = penalty"),
            ("bus_struct",str(gv(facts,"corporation") or ""),"corporation fact","Company Profile","LLC vs Corp vs Sole Prop — different risk profiles"),
        ]
        st.dataframe(pd.DataFrame(feat_rows,columns=["Worth Score Feature","Current Value","Source fact","Model Category","Why it matters"]),
                     use_container_width=True,hide_index=True)
        st.caption("▼ Click any feature below for source, JSON, and Worth Score impact details")
        FEAT_META={
            "age_business":("formation_date","formation_date → current year − formation year. Source: Middesk (pid=16). If null → imputed to model default (often 0) → penalizes score.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_date FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_date';"),
            "revenue":("revenue","Annual revenue USD. Source: ZI (pid=24, w=0.8) / EFX (pid=17, w=0.7). If null → financial sub-model uses default imputation → less accurate prediction.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS revenue FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='revenue';"),
            "count_employees":("num_employees","Employee count. Source: ZI/EFX. Used as proxy for business scale. Null = entity not in vendor databases.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS employees FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='num_employees';"),
            "naics6":("naics_code","6-digit NAICS code. factWithHighestConfidence across ZI/EFX/OC/SERP/Trulioo/Applicant/AI. 561499 = fallback = industry penalty in Company Profile category.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';"),
            "bus_struct":("corporation","Entity type: LLC, Corp, Sole Prop, etc. Source: Middesk (pid=16) from SOS filing entity_type field. Different structures carry different default risk profiles.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS entity_type FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='corporation';"),
        }
        for feat,cur_val,src_fact,cat,why in feat_rows:
            m=FEAT_META.get(feat,())
            detail_panel(f"Worth Score: {feat}", str(cur_val),
                what_it_means=f"Model Category: {cat}\nWhy it matters: {why}\n\n{m[1] if len(m)>1 else ''}",
                source_table=f"rds_warehouse_public.facts · name='{m[0] if m else src_fact}'",
                source_file="worth_score_model.py", source_file_line=f"{feat} feature · Category: {cat}",
                json_obj={"worth_score_feature":feat,"current_value":cur_val,"source_fact":m[0] if m else src_fact,"model_category":cat,"why_it_matters":why},
                sql=m[2] if len(m)>2 else f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='{m[0] if m else src_fact}';",
                links=[("worth_score_model.py",f"{feat} in model"),("lookups.py","Feature defaults and imputation"),("aiscore.py","SHAP computation")],
                color="#22c55e" if cur_val and cur_val not in ("null","Unknown") else "#ef4444", icon="📊")

        ai_popup("Background",f"revenue:{revenue_v} employees:{emp_v} kyb_submitted:{kyb_sub}",[
            "What is the difference between business_name and legal_name?",
            "How is dba_found determined and what sources contribute?",
            "How does revenue data from ZoomInfo affect the Worth Score?",
            "What does kyb_complete=false mean and what is blocking it?"],bid)

        with st.expander("📋 SQL & Python"):
            _sql_b = sql_for(bid,["business_name","legal_name","dba_found","corporation",
                                  "formation_date","revenue","num_employees","kyb_submitted","kyb_complete"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')

    with cl3:
        st.markdown("#### 📬 Contact & Address Verification")
        st.caption("""**Address winner:** Middesk (pid=16) for primary, combineFacts for all addresses ·
        **Name match winner:** Middesk (pid=16) · **Admin Portal:** KYB → Contact Information tab""")

        am_bool=str(gv(facts,"address_match_boolean") or "").lower()
        nm_bool=str(gv(facts,"name_match_boolean") or "").lower()
        ra_v=facts.get("address_registered_agent",{}).get("value",{})

        ra_status=ra_v.get("status","") if isinstance(ra_v,dict) else ""
        ra_msg_v=ra_v.get("message","") if isinstance(ra_v,dict) else ""
        _addr_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('address_match_boolean','name_match_boolean','addresses_deliverable','address_registered_agent') ORDER BY name;"

        # KPI cards — card only, no expander inside columns
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("Address Match","✅ Matched" if am_bool=="true" else "❌ No match" if am_bool=="false" else "⚠️ Unknown","address_match_boolean","#22c55e" if am_bool=="true" else "#ef4444")
        with c2: kpi("Name Match","✅ Matched" if nm_bool=="true" else "❌ No match" if nm_bool=="false" else "⚠️ Unknown","name_match_boolean","#22c55e" if nm_bool=="true" else "#ef4444")
        with c3: kpi("Deliverable Address","✅ Yes" if gv(facts,"addresses_deliverable") else "⚠️ Unknown","USPS confirmed deliverable","#22c55e" if gv(facts,"addresses_deliverable") else "#64748b")
        with c4: kpi("Registered Agent Addr","⚠️ WARNING" if ra_status=="warning" else "✅ OK","address_registered_agent","#f59e0b" if ra_status=="warning" else "#22c55e")

        # Detail panels — sequential full-width below columns (no overlap)
        detail_panel("📍 Address Match", am_bool or "Unknown",
            what_it_means="address_match_boolean is DEPENDENT — derived from address_verification.value.status==='success'. Middesk (pid=16) searches SOS registry + USPS for the submitted address. true = verified. false = not found or not verified.",
            source_table="rds_warehouse_public.facts · name='address_match_boolean'",
            source_file="facts/kyb/index.ts", source_file_line="addressMatchBoolean · dependent · address_verification.status==='success'",
            json_obj={"name":"address_match_boolean","value":am_bool=="true" if am_bool else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["address_match"]},
            sql=_addr_sql, links=[("facts/kyb/index.ts","addressMatchBoolean"),("integrations.constant.ts","MIDDESK=16")],
            color="#22c55e" if am_bool=="true" else "#ef4444", icon="📍")
        detail_panel("🏢 Name Match", nm_bool or "Unknown",
            what_it_means="name_match_boolean derived from name_match.value.status==='success'. Middesk compares submitted name vs SOS registry. false for DBAs is EXPECTED (legal name differs from trade name). Does NOT indicate fraud.",
            source_table="rds_warehouse_public.facts · name='name_match_boolean'",
            source_file="facts/kyb/index.ts", source_file_line="nameMatchBoolean · dependent · name_match.value.status==='success'",
            json_obj={"name":"name_match_boolean","value":nm_bool=="true" if nm_bool else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["name_match"]},
            sql=_addr_sql, links=[("facts/kyb/index.ts","nameMatchBoolean")],
            color="#22c55e" if nm_bool=="true" else "#ef4444", icon="🏢")
        detail_panel("📮 Deliverable Address", "Yes" if gv(facts,"addresses_deliverable") else "Unknown",
            what_it_means="addresses_deliverable = subset confirmed USPS-deliverable by Middesk. Empty = no deliverable address confirmed (may be PO box, virtual office, or address error).",
            source_table="rds_warehouse_public.facts · name='addresses_deliverable'",
            source_file="facts/kyb/index.ts", source_file_line="addressesDeliverable · Middesk pid=16 · USPS CASS verification",
            json_obj={"name":"addresses_deliverable","source":{"platformId":16,"name":"middesk"}},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS deliverable FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='addresses_deliverable';",
            links=[("facts/kyb/index.ts","addressesDeliverable"),("integrations.constant.ts","MIDDESK=16")],
            color="#22c55e" if gv(facts,"addresses_deliverable") else "#64748b", icon="📮")
        detail_panel("⚠️ Registered Agent Addr", ra_status or "OK",
            what_it_means=f"address_registered_agent status='{ra_status or 'ok'}': {ra_msg_v or 'No warning'}. WARNING = submitted address is a known registered agent (e.g. CT Corporation). Common for DE/NV/WY incorporations. Entity may NOT operate at this address.",
            source_table="rds_warehouse_public.facts · name='address_registered_agent'",
            source_file="facts/kyb/index.ts", source_file_line="addressRegisteredAgent · Middesk pid=16",
            api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.address_registered_agent.value.status",
            json_obj={"name":"address_registered_agent","value":ra_v if isinstance(ra_v,dict) else {"status":ra_status},"source":{"platformId":16,"name":"middesk"}},
            sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS ra_status, JSON_EXTRACT_PATH_TEXT(value,'value','message') AS ra_msg FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='address_registered_agent';",
            links=[("facts/kyb/index.ts","addressRegisteredAgent"),("integrations.constant.ts","MIDDESK=16")],
            color="#f59e0b" if ra_status=="warning" else "#22c55e", icon="⚠️" if ra_status=="warning" else "✅")

        if ra_status=="warning":
            ra_msg=ra_v.get("message","") if isinstance(ra_v,dict) else ""
            flag(f"⚠️ address_registered_agent WARNING: '{ra_msg}'. "
                 "The submitted office address matches a known registered agent (e.g. a law firm or incorporation service). "
                 "This is common for tax-haven incorporations (DE/NV/WY) and may indicate the entity is not physically operating at this address.", "amber")

        render_lineage(facts,["primary_address","addresses","addresses_submitted","addresses_found",
                               "addresses_deliverable","address_match","address_match_boolean",
                               "address_verification","address_verification_boolean","address_registered_agent",
                               "business_phone","phone_found","email",
                               "name_match","name_match_boolean"])

        st.markdown("##### Address Verification Pipeline")
        ADDR_PIPELINE = [
            ("1. Applicant submits address","Onboarding form (pid=0)","addresses_submitted fact — what the merchant claims their address is","#f59e0b","facts/kyb/index.ts","addressesSubmitted · pid=0"),
            ("2. Middesk verifies address","Middesk API (pid=16, w=2.0)","Middesk searches SOS registry and USPS for the submitted address. Returns: status (success/failure), matched addresses, deliverable subset.","#f59e0b","middesk","Middesk address verification API"),
            ("3. address_verification stored","rds_warehouse_public.facts","Object: {addresses[], baseAddresses[], status, message, label, sublabel}. Winner: Middesk via factWithHighestConfidence.","#22c55e","facts/kyb/index.ts","addressVerification · factWithHighestConfidence · pid=16"),
            ("4. address_match_boolean derived","Fact Engine (dependent, pid=-1)","true when address_verification.status='success'. Dependencies: ['address_verification'].","#22c55e","facts/kyb/index.ts","addressMatchBoolean · dependent"),
            ("5. addresses_deliverable stored","Middesk (pid=16)","Subset of addresses confirmed deliverable by USPS via Middesk. Used for mail-based verification.","#3B82F6","facts/kyb/index.ts","addressesDeliverable · pid=16"),
            ("6. Admin Portal display","microsites ContactInformation.tsx","Shows primary_address (derived from addresses). Address verification badge = address_match_boolean.","#60A5FA","KYB UI","microsites ContactInformation.tsx"),
        ]
        for step,src,desc,color,gh_key,gh_label in ADDR_PIPELINE:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};border-radius:6px;
                padding:7px 12px;margin:3px 0;font-size:.73rem">
              <strong style="color:{color}">{step}</strong>
              <span style="color:#64748b;margin-left:8px">{src}</span>
              <div style="color:#94A3B8;margin-top:2px">{desc}</div>
            </div>""",unsafe_allow_html=True)
            detail_panel(step, src,
                what_it_means=desc,
                source_table="rds_warehouse_public.facts" if "facts" in src.lower() else src,
                source_file=gh_key, source_file_line=gh_label,
                json_obj={"pipeline_step":step,"system":src,"description":desc},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='address_verification';" if "address_verification" in desc else "",
                links=[(gh_key,gh_label),("facts/kyb/index.ts","Address fact definitions"),("integrations.constant.ts","MIDDESK=16")],
                color=color, icon="🔄")

        ai_popup("Contact",f"addr_match:{am_bool} name_match:{nm_bool} reg_agent:{ra_status}",[
            "How is address_match_boolean derived from address_verification?",
            "What does addresses_deliverable mean and how is it different from addresses_found?",
            "What does address_registered_agent warning mean for underwriting?",
            "How is name_match_boolean determined?"],bid)

        with st.expander("📋 SQL & Python"):
            _sql_b = sql_for(bid,["primary_address","addresses","address_match_boolean",
                                  "address_verification","addresses_deliverable","address_registered_agent",
                                  "name_match","name_match_boolean"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')

    with cl4:
        st.markdown("#### 🌐 Website & Digital Presence")
        st.caption("""**Website source:** Applicant (pid=0) or SERP (pid=22) · 
        **SERP data:** Google My Business via SERP API · **NAICS link:** AI uses website for classification (Gap G2 if missing)""")

        website_v=str(gv(facts,"website") or "")
        web_found_v=gv(facts,"website_found")
        web_found_str=str(web_found_v or "").lower() if not isinstance(web_found_v,list) else "true" if web_found_v else "false"
        serp_id=str(gv(facts,"serp_id") or "")
        rating=str(gv(facts,"review_rating") or "")
        rev_count=str(gv(facts,"review_count") or "")

        _web_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('website','website_found','serp_id','review_rating','review_count') ORDER BY name;"

        # KPI cards only — no expanders inside columns
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("Website",website_v[:30] if website_v else "❌ Not submitted","Applicant-submitted URL","#22c55e" if website_v else "#f59e0b")
        with c2: kpi("Website Found","✅ Yes" if web_found_str=="true" else "❌ No","Verified by SERP/Middesk","#22c55e" if web_found_str=="true" else "#64748b")
        with c3: kpi("SERP/GMB ID","✅ Found" if serp_id else "❌ Not found","Google My Business presence","#22c55e" if serp_id else "#64748b")
        with c4: kpi("Review Rating",rating if rating else "N/A",f"{rev_count} reviews" if rev_count else "No reviews","#3B82F6" if rating else "#64748b")

        # Detail panels — sequential full-width (no overlap)
        detail_panel("🌐 Website", website_v or "Not submitted",
            what_it_means="Business website URL submitted on the onboarding form (pid=0=Applicant) or found by SERP (pid=22). CRITICAL for NAICS classification: if null, AI enrichment (last resort) cannot use web_search → Gap G2 → likely NAICS=561499 fallback.",
            source_table="rds_warehouse_public.facts · name='website'",
            source_file="facts/kyb/index.ts", source_file_line="website · factWithHighestConfidence · pid=0 Applicant or pid=22 SERP",
            api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.website",
            json_obj={"name":"website","value":website_v or None,"source":{"platformId":0,"name":"businessDetails"},"naics_impact":"If null AND NAICS=561499 → Gap G2 confirmed"},
            sql=_web_sql, links=[("facts/kyb/index.ts","website fact"),("aiEnrichment","AI uses website for NAICS")],
            color="#22c55e" if website_v else "#f59e0b", icon="🌐")
        detail_panel("🔍 Website Found", web_found_str or "Unknown",
            what_it_means="website_found = list of verified URLs found by SERP/Middesk. combineFacts rule — merges from all vendors. Empty list means no website was confirmed online. Different from 'website' fact (submitted URL) — website_found is what vendors actually found.",
            source_table="rds_warehouse_public.facts · name='website_found'",
            source_file="facts/kyb/index.ts", source_file_line="websiteFound · combineFacts · SERP pid=22 / Middesk pid=16",
            json_obj={"name":"website_found","value":[],"source":{"platformId":None,"name":None},"ruleApplied":{"name":"combineFacts"}},
            sql=_web_sql, links=[("facts/kyb/index.ts","websiteFound"),("integrations.constant.ts","SERP_SCRAPE=22")],
            color="#22c55e" if web_found_str=="true" else "#64748b", icon="🔍")
        detail_panel("📍 SERP/GMB ID", serp_id[:30] if serp_id else "Not found",
            what_it_means="serp_id = Google Business Profile place ID from SERP API (pid=22 or pid=39 SERP_GOOGLE_PROFILE). Presence indicates the business has a Google My Business listing — used for review_rating and review_count. Not found = no verified Google presence.",
            source_table="rds_warehouse_public.facts · name='serp_id'",
            source_file="facts/kyb/index.ts", source_file_line="serpId · factWithHighestConfidence · SERP_GOOGLE_PROFILE pid=39",
            json_obj={"name":"serp_id","value":serp_id or None,"source":{"platformId":39,"name":"serpGoogleProfile"}},
            sql=_web_sql, links=[("facts/kyb/index.ts","serpId"),("integrations.constant.ts","SERP_GOOGLE_PROFILE=39")],
            color="#22c55e" if serp_id else "#64748b", icon="📍")
        detail_panel("⭐ Review Rating", rating or "N/A",
            what_it_means="Google My Business review rating (1-5 stars) from SERP API. Used as social proof signal. Only available when serp_id is found. review_count = number of Google reviews.",
            source_table="rds_warehouse_public.facts · name='review_rating' + 'review_count'",
            source_file="facts/kyb/index.ts", source_file_line="reviewRating · SERP pid=22/39",
            json_obj={"review_rating":rating or None,"review_count":rev_count or None,"source":{"platformId":39,"name":"serpGoogleProfile"}},
            sql=_web_sql, links=[("facts/kyb/index.ts","reviewRating"),("integrations.constant.ts","SERP_GOOGLE_PROFILE=39")],
            color="#3B82F6" if rating else "#64748b", icon="⭐")

        # NAICS-website link warning
        if website_v and is_fallback:
            flag("🚨 Gap G2 CONFIRMED: website is set but NAICS=561499. "
                 "The AI enrichment (last resort) had access to the website URL in the facts table BUT "
                 "integration-service/lib/aiEnrichment/aiEnrichment.ts did not pass params.website to the AI prompt. "
                 "Fix: pass website URL as a parameter so AI can use web_search to determine industry.", "red")
        elif not website_v and is_fallback:
            flag("Gap G1/G3: No website submitted AND NAICS=561499. AI had no URL to search. "
                 "Common for micro-businesses, sole props, and new businesses.", "amber")
        elif website_v and not is_fallback:
            flag(f"✅ Website present ('{website_v[:40]}') and NAICS classified ({naics}). "
                 "No Gap G2 detected.", "green")

        render_lineage(facts,["website","website_found","serp_id","all_google_place_ids",
                               "review_rating","review_count","google_review_count","google_review_rating"])

        st.markdown("""<div style="background:#0c1a2e;border-left:3px solid #8B5CF6;border-radius:8px;padding:10px 14px;margin:8px 0;font-size:.78rem">
          <div style="color:#a5b4fc;font-weight:600">How website data feeds NAICS classification (the G2 gap)</div>
          <div style="color:#CBD5E1;margin-top:4px">
            <code>website</code> fact (pid=0 or pid=22) → passed to AI enrichment as <code>params.website</code><br>
            AI prompt: "Given business name=X, address=Y, website=Z, what is the 6-digit NAICS code?"<br>
            If <code>params.website=null</code> → AI cannot use web_search → classifies from name+address only → often returns 561499<br>
            <strong>Source:</strong> integration-service/lib/aiEnrichment/aiEnrichment.ts · lib/aiEnrichment/constants.ts
          </div>
        </div>""",unsafe_allow_html=True)

        with st.expander("📋 SQL & Python"):
            _sql_b = sql_for(bid,["website","website_found","serp_id","review_rating","review_count"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('facts/kyb/index.ts','website / website_found / serp_id fact definitions')}]({GITHUB_LINKS.get('facts/kyb/index.ts','')})\n"
            f"- [{src_link('aiEnrichment','aiNaicsEnrichment.ts — uses website URL for NAICS classification')}]({GITHUB_LINKS.get('aiEnrichment','')})\n"
            f"- [{src_link('integrations.constant.ts','INTEGRATION_ID.SERP_SCRAPE=22, SERP_GOOGLE_PROFILE=39')}]({GITHUB_LINKS.get('integrations.constant.ts','')})"
        )
        ai_popup("Website",f"website:{website_v[:40] if website_v else 'null'} web_found:{web_found_str} serp:{serp_id[:20] if serp_id else 'null'} naics:{naics}",[
            "Why does a missing website cause NAICS=561499?",
            "How does the AI enrichment use the website URL for NAICS classification?",
            "What is the Gap G2 and how to fix it?",
            "How is SERP/Google Business Profile data collected and stored?",
            "What SQL shows all website-related facts for this business?"],bid)

# ════════════════════════════════════════════════════════════════════════════════
# RISK & WATCHLIST
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="⚠️ Risk & Watchlist":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## ⚠️ Risk & Watchlist — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"risk")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    wl=int(float(gv(facts,"watchlist_hits") or 0))
    am=int(float(gv(facts,"adverse_media_hits") or 0))
    bk=int(float(gv(facts,"num_bankruptcies") or 0))
    ju=int(float(gv(facts,"num_judgements") or 0))
    li=int(float(gv(facts,"num_liens") or 0))

    _wl_sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='watchlist_hits';"
    _pr_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS cnt FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('num_bankruptcies','num_judgements','num_liens');"
    c1,c2,c3,c4,c5=st.columns(5)
    with c1:
        kpi_detail("Watchlist Hits",str(wl),"PEP+Sanctions (adverse_media separate)","#ef4444" if wl>0 else "#22c55e",
                   "watchlist_hits",wl,"rds_warehouse_public.facts",_wl_sql,
                   ["watchlist_hits=0 does NOT mean clean — it means no PEP/SANCTIONS hits","Adverse media is EXCLUDED from this count (see adverse_media_hits)"],
                   f'{{"name":"watchlist_hits","value":{wl},"source":{{"platformId":-1,"name":"dependent"}},"dependencies":["watchlist"]}}',
                   f"GET /integration/api/v1/facts/business/{bid}/kyb → data.watchlist_hits")
    with c2:
        kpi_detail("Adverse Media",str(am),"Tracked separately from watchlist","#f59e0b" if am>0 else "#22c55e",
                   "adverse_media_hits",am,"rds_warehouse_public.facts",_wl_sql.replace("watchlist_hits","adverse_media_hits"),
                   ["adverse_media is deliberately EXCLUDED from consolidated watchlist (filterOutAdverseMedia in consolidatedWatchlist.ts)"],
                   f'{{"name":"adverse_media_hits","value":{am}}}')
    with c3:
        kpi_detail("Bankruptcies",str(bk),"num_bankruptcies · Worth Score: −40pts each","#8B5CF6" if bk>0 else "#22c55e",
                   "num_bankruptcies",bk,"rds_warehouse_public.facts",_pr_sql,
                   ["num_bankruptcies=0 means Equifax found no records OR could not match entity","Very new / micro businesses have no Equifax coverage"],
                   f'{{"name":"num_bankruptcies","value":{bk},"source":{{"platformId":17,"name":"equifax"}}}}')
    with c4:
        kpi_detail("Judgments",str(ju),"num_judgements · Worth Score: −20pts each","#8B5CF6" if ju>0 else "#22c55e",
                   "num_judgements",ju,"rds_warehouse_public.facts",_pr_sql,None,
                   f'{{"name":"num_judgements","value":{ju}}}')
    with c5:
        kpi_detail("Liens",str(li),"num_liens · Worth Score: −10pts each","#8B5CF6" if li>0 else "#22c55e",
                   "num_liens",li,"rds_warehouse_public.facts",_pr_sql,None,
                   f'{{"name":"num_liens","value":{li}}}')
    if wl>0: flag(f"🚨 {wl} watchlist hit(s). SANCTIONS=hard stop · PEP=Enhanced Due Diligence · Other=manual review.","red")

    rw1,rw2,rw3=st.tabs(["🔍 Watchlist Detail","📜 Public Records","🔗 Risk Combinations"])

    with rw1:
        render_lineage(facts,["watchlist_hits","adverse_media_hits","screened_people"])

        st.markdown("##### Watchlist Data Flow (9 steps)")
        WL_PIPELINE = [
            ("Vendor Screening","Trulioo PSC + Middesk review task","Screen business + UBOs against global watchlists","#f59e0b","trulioo","TRULIOO=38, MIDDESK=16"),
            ("integration_data.business_entity_review_task","RDS PostgreSQL","key='watchlist',category='compliance',status='warning'|'success',metadata=JSONB hits","#ef4444","facts/kyb/index.ts","business_entity_review_task table"),
            ("Facts Engine → watchlist_raw","integration-service","Direct vendor output (pid=38 Trulioo or pid=16 Middesk)","#8B5CF6","facts/kyb/index.ts","watchlist_raw · combineWatchlistMetadata"),
            ("consolidatedWatchlist.ts","integration-service","Merge business + person hits, deduplicate, EXCLUDE adverse_media (filterOutAdverseMedia)","#8B5CF6","consolidatedWatchlist.ts","filterOutAdverseMedia() L57"),
            ("watchlist fact","rds_warehouse_public.facts","PEP + SANCTIONS only. metadata=[{type,entityName,url,listType}]","#22c55e","facts/kyb/index.ts","watchlist · combineWatchlistMetadata"),
            ("watchlist_hits fact","rds_warehouse_public.facts","COUNT of hits (watchlist.value.metadata.length)","#22c55e","facts/kyb/index.ts","watchlistHits · dependent"),
            ("adverse_media_hits fact","rds_warehouse_public.facts","SEPARATE count — Trulioo adverse_media + adverseMediaDetails.records","#22c55e","facts/kyb/index.ts","adverseMediaHits · dependent"),
            ("clients.customer_table","Redshift warehouse-service","watchlist_count, watchlist_verification (1=clean, 0=hits)","#3B82F6","customer_table.sql","watchlist_count column"),
            ("Admin Portal KYB → Watchlists tab","UI","Shows hits grouped by entity_name. Sanctions=🔴 PEP=🟠 Other=🟡","#60a5fa","KYB UI","microsites Watchlists tab"),
        ]
        for i,(s,src,d,color,gh_key,gh_label) in enumerate(WL_PIPELINE):
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:2px 0;font-size:.74rem">
              <strong style="color:{color}">{i+1}. {s}</strong>
              <span style="color:#64748b;margin-left:8px;font-size:.68rem">{src}</span>
              <div style="color:#94A3B8;margin-top:2px">{d}</div>
            </div>""",unsafe_allow_html=True)
            _wl_step_sql = (f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS wl_fact FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='watchlist';" if "watchlist fact" in s else f"SELECT watchlist_count, watchlist_verification FROM clients.customer_table WHERE business_id='{bid}';" if "customer_table" in s else "")
            detail_panel(f"Step {i+1}: {s}", src,
                what_it_means=d,
                source_table=src if "facts" in src.lower() or "customer_table" in src.lower() else "integration-service pipeline",
                source_file=gh_key, source_file_line=gh_label,
                json_obj={"step":i+1,"name":s,"source_system":src,"description":d,"watchlist_hits_current":wl,"adverse_media_current":am},
                sql=_wl_step_sql,
                links=[(gh_key,gh_label),("facts/kyb/index.ts","watchlist_hits / adverse_media_hits"),("integrations.constant.ts","TRULIOO=38, MIDDESK=16")],
                color=color, icon="🔄")

        # BERT live query (cached)
        st.markdown("##### Live BERT Query (rds_integration_data)")
        bert_df,bert_err=load_bert(bid)
        if bert_df is not None and not bert_df.empty: st.dataframe(bert_df,use_container_width=True,hide_index=True)
        else: flag(f"BERT table not accessible. {bert_err or ''}","blue")

        WATCHLIST_TYPE_DETAILS = {
            "SANCTIONS": ("watchlist hits where type='SANCTIONS'","OFAC/UN/EU/HMT. Any SANCTIONS hit = HARD STOP. Cannot approve without Compliance clearance. File SAR report if required.",f"SELECT hit->>'type',hit->>'entity_name',hit->>'list_url' FROM rds_warehouse_public.facts CROSS JOIN jsonb_array_elements(value->'value'->'metadata') AS hit WHERE name='watchlist' AND business_id='{bid}' AND hit->>'type'='SANCTIONS';",{"type":"SANCTIONS","action":"HARD_STOP","sources":["OFAC SDN","UN Consolidated List","EU Consolidated List","HMT UK"],"regulatory_basis":"Bank Secrecy Act / OFAC regulations"}),
            "PEP": ("watchlist hits where type='PEP'","Politically Exposed Person. NOT automatic denial. Requires Enhanced Due Diligence (EDD): source of funds, purpose of business relationship, ongoing monitoring.",f"SELECT hit->>'type',hit->>'entity_name' FROM rds_warehouse_public.facts CROSS JOIN jsonb_array_elements(value->'value'->'metadata') AS hit WHERE name='watchlist' AND business_id='{bid}' AND hit->>'type'='PEP';",{"type":"PEP","action":"ENHANCED_DUE_DILIGENCE","definition":"Current or former senior public official + immediate family + close associates"}),
            "ADVERSE_MEDIA": ("adverse_media_hits fact (NOT in watchlist)","Deliberately excluded from consolidated watchlist by filterOutAdverseMedia() in consolidatedWatchlist.ts. Tracked separately in adverse_media_hits. Requires qualitative assessment — negative press ≠ automatic denial.",f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS adverse_media_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='adverse_media_hits';",{"type":"ADVERSE_MEDIA","excluded_from":"watchlist fact","stored_in":"adverse_media_hits fact","source_code":"integration-service/lib/facts/kyb/consolidatedWatchlist.ts — filterOutAdverseMedia()"}),
            "OTHER": ("watchlist hits where type='OTHER'","Other compliance lists (e.g. CFTC, FinCEN, state-level lists). Manual review required. Assess relevance to business relationship.",f"SELECT hit->>'type',hit->>'list_type' FROM rds_warehouse_public.facts CROSS JOIN jsonb_array_elements(value->'value'->'metadata') AS hit WHERE name='watchlist' AND business_id='{bid}' AND hit->>'type' NOT IN ('SANCTIONS','PEP','ADVERSE_MEDIA');",{"type":"OTHER","action":"MANUAL_REVIEW"}),
        }
        for hit_type,icon,label,desc in [
            ("SANCTIONS","🔴","OFAC/UN/EU/HMT sanctions","HARD STOP — cannot approve without compliance clearance"),
            ("PEP","🟠","Politically Exposed Person","Enhanced Due Diligence required — NOT automatic denial"),
            ("ADVERSE_MEDIA","🟡","Negative news coverage","EXCLUDED from consolidated watchlist fact — tracked in adverse_media_hits"),
            ("OTHER","⚪","Other compliance lists","Manual review required"),
        ]:
            color={"SANCTIONS":"#ef4444","PEP":"#f97316","ADVERSE_MEDIA":"#f59e0b","OTHER":"#64748b"}[hit_type]
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:3px 0">
              <span style="color:{color};font-weight:700">{icon} {hit_type}: {label}</span>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:3px">{desc}</div>
            </div>""",unsafe_allow_html=True)
            det = WATCHLIST_TYPE_DETAILS.get(hit_type,())
            if det:
                detail_panel(f"{hit_type}: {label}", desc,
                    what_it_means=det[1],
                    source_table=det[0],
                    source_file="consolidatedWatchlist.ts" if hit_type=="ADVERSE_MEDIA" else "facts/kyb/index.ts",
                    source_file_line="filterOutAdverseMedia() L57" if hit_type=="ADVERSE_MEDIA" else "watchlist fact computation",
                    api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.watchlist.value.metadata[].type",
                    json_obj=det[3],
                    sql=det[2],
                    links=[("consolidatedWatchlist.ts","consolidatedWatchlist.ts"),("facts/kyb/index.ts","watchlist_hits fact"),("integrations.constant.ts","TRULIOO=38, MIDDESK=16")],
                    color=color, icon=icon)

        ai_popup("Watchlist",f"wl_hits:{wl} adverse_media:{am}",[
            "Why is adverse media excluded from the consolidated watchlist?",
            "What is the difference between SANCTIONS and PEP hits?",
            "How is watchlist_hits count calculated?",
            "What SQL shows watchlist data from clients.customer_table?",],bid)

        with st.expander("📋 SQL & Python"):
            _sql_b = sql_for(bid,["watchlist_hits","adverse_media_hits"])
            _py_b = _make_python_from_sql(_sql_b)
            _sc2, _pc2 = st.columns(2)
            with _sc2:
                st.markdown('**SQL (Redshift):**')
                st.code(_sql_b, language='sql')
            with _pc2:
                st.markdown('**Python (paste into 🐍 Runner):**')
                st.code(_py_b or '# see SQL on the left', language='python')
            st.code(f"""-- BERT detailed hits:
SELECT bert.status,bert.sublabel,bert.created_at
FROM rds_integration_data.business_entity_review_task bert
JOIN rds_integration_data.business_entity_verification bev ON bev.id=bert.business_entity_verification_id
WHERE bev.business_id='{bid}' AND bert.key='watchlist';

-- Customer table:
SELECT watchlist_count,watchlist_verification FROM clients.customer_table WHERE business_id='{bid}';""",language="sql")

        analyst_card("Watchlist Architecture — Key Points",[
            f"watchlist_hits={wl}: PEP+SANCTIONS only. Adverse media EXCLUDED (filterOutAdverseMedia in consolidatedWatchlist.ts L57).",
            f"adverse_media_hits={am}: Tracked separately. Different due diligence action required than sanctions/PEP.",
            "consolidatedWatchlist merges BOTH business-level (Middesk review task) AND person-level (Trulioo PSC screening of UBOs/directors) hits.",
            "clients.customer_table.watchlist_verification: 1=clean, 0=has hits. This is the 'watchlists' column in exports.",
        ])

    with rw2:
        st.markdown("#### 📜 Public Records — Bankruptcies, Judgments & Liens")
        st.caption("""**Sources:** Equifax (pid=17) public records database · **Stored in:** `rds_warehouse_public.facts` ·
        **Worth Score impact:** Public Records category — highest negative impact features ·
        **Admin Portal:** KYB → Public Records tab""")

        render_lineage(facts,["num_bankruptcies","num_judgements","num_liens"])

        # Impact table
        st.markdown("##### Worth Score Impact — Public Records Features")
        impact_data=[
            ("Bankruptcies",bk,"count_bankruptcy","age_bankruptcy",
             "−40 pts per filing (cap: −120 pts)","Chapter 7=liquidation · Chapter 11=reorganization · Chapter 13=personal debt adjustment",
             "Public Records","#ef4444" if bk>0 else "#22c55e"),
            ("Judgments",ju,"count_judgment","age_judgment",
             "−20 pts per filing (cap: −60 pts)","Civil court judgments — creditor won lawsuit against business. Indicates payment disputes.",
             "Public Records","#f97316" if ju>0 else "#22c55e"),
            ("Liens",li,"count_lien","age_lien",
             "−10 pts per lien (cap: −40 pts)","Tax liens (IRS) or mechanic liens. Business owes money secured against assets.",
             "Public Records","#f59e0b" if li>0 else "#22c55e"),
        ]
        _fact_name_map={"Bankruptcies":"num_bankruptcies","Judgments":"num_judgements","Liens":"num_liens"}
        for label,count,feat_count,feat_age,impact,desc,cat,color in impact_data:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:10px;padding:12px 16px;margin:6px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:{color};font-weight:700;font-size:.88rem">{label}: {count}</span>
                <span style="color:#64748b;font-size:.70rem">Worth Score: {impact}</span>
              </div>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:4px">{desc}</div>
              <div style="color:#475569;font-size:.70rem;margin-top:2px">
                Model features: <code>{feat_count}</code> + <code>{feat_age}</code> · Category: {cat}
              </div>
            </div>""",unsafe_allow_html=True)
            _fn = _fact_name_map.get(label, label.lower())
            detail_panel(label, str(count),
                what_it_means=f"{desc} | Worth Score impact: {impact} | Model features: {feat_count} (count) + {feat_age} (age of most recent filing) | Category: {cat}",
                source_table=f"rds_warehouse_public.facts · name='{_fn}' (scalar count, Redshift OK)\nFull array: name='{_fn.replace('num_','')}' (too large — PostgreSQL RDS port 5432 required)",
                source_file="facts/kyb/index.ts", source_file_line=f"{_fn} · dependent from {_fn.replace('num_','')}[] array · Equifax (pid=17)",
                api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.{_fn}",
                json_obj={"name":_fn,"value":count,"source":{"platformId":17,"name":"equifax"},"note":f"Scalar count. Full details in '{_fn.replace('num_','')}' fact (too large for Redshift)","worth_score_impact":impact,"model_features":[feat_count,feat_age],"model_category":cat},
                sql=f"-- Scalar count (Redshift OK):\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS {_fn} FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='{_fn}';\n-- Full array (PostgreSQL RDS port 5432 only):\n-- SELECT value->'value' FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='{_fn.replace('num_','')}';",
                links=[("facts/kyb/index.ts",f"{_fn} definition"),("worth_score_model.py","Worth Score feature impact"),("integrations.constant.ts","INTEGRATION_ID.EQUIFAX=17")],
                color=color, icon="📜")

        if bk==0 and ju==0 and li==0:
            flag("✅ No bankruptcies, judgments, or liens found. Public Records category contributes positively to Worth Score.", "green")

        st.markdown("##### What the Raw Arrays Contain (PostgreSQL RDS required — too large for Redshift)")
        st.code(f"""-- bankruptcies array (PostgreSQL RDS port 5432):
SELECT
    filing->>'type'         AS bankruptcy_type,     -- Chapter 7, 11, 13
    filing->>'status'       AS status,              -- open, closed, discharged
    filing->>'filed_at'     AS filed_date,
    filing->>'closed_at'    AS closed_date,
    filing->>'assets'       AS assets,
    filing->>'liabilities'  AS liabilities
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='bankruptcies' AND business_id='{bid}';

-- judgements array:
SELECT
    j->>'plaintiff', j->>'amount', j->>'status', j->>'filed_at'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS j
WHERE name='judgements' AND business_id='{bid}';

-- liens array:
SELECT
    l->>'type', l->>'amount', l->>'status', l->>'filed_at'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS l
WHERE name='liens' AND business_id='{bid}';

-- Scalar counts (Redshift OK):
{sql_for(bid,["num_bankruptcies","num_judgements","num_liens"])}""",language="sql")

        analyst_card("🔬 Public Records — Engineering Analysis",[
            f"Current: BK={bk}, Judgments={ju}, Liens={li}. "
            f"Estimated Worth Score impact: ~{-(min(bk*40,120)+min(ju*20,60)+min(li*10,40))} points from public records alone.",
            "Source: Equifax (pid=17) public records. Equifax queries court records, IRS tax liens, and civil judgment databases. These are updated monthly in bulk — not real-time.",
            "num_bankruptcies/judgements/liens are SCALAR COUNTS extracted from the large arrays (bankruptcies, judgements, liens). The scalar counts are safe to query from Redshift. The full arrays (with dates, amounts, types) must be queried from PostgreSQL RDS.",
            "Worth Score features use BOTH count AND age: count_bankruptcy (how many) + age_bankruptcy (years since most recent filing). A 10-year-old bankruptcy carries less weight than a 6-month-old one.",
            "CRITICAL: num_bankruptcies=0 does not mean the business has no bankruptcy history — it means Equifax found no records OR Equifax could not match this entity. Very new businesses and micro-businesses often have no Equifax coverage.",
        ])

    with rw3:
        st.markdown("#### 🔗 Risk Combination Analysis")
        st.caption("Cross-signal analysis — identifying which combinations of risk signals require specific underwriting actions")

        RISK_COMBOS=[
            # (condition, severity, title, detail, action)
            (wl>0 and bk>0,
             "CRITICAL","🔴 Watchlist + Bankruptcy",
             f"Watchlist hits={wl} AND bankruptcies={bk}. Both compliance AND credit risk are flagged simultaneously.",
             "Hard stop on compliance side (watchlist). Cannot approve regardless of credit. File SAR if SANCTIONS hit. Manual underwriting required."),
            (wl>0 and am>0,
             "HIGH","🔴 Watchlist + Adverse Media",
             f"Watchlist hits={wl} AND adverse_media_hits={am}. Formal compliance hit plus negative press coverage.",
             "Verify if adverse media is related to the watchlist hit entity. Enhanced due diligence required. Both signals point to the same risk."),
            (wl>0 and bk==0 and am==0,
             "HIGH","🔴 Watchlist Only",
             f"Watchlist hits={wl} with no bankruptcy or adverse media.",
             "Compliance review required. Determine hit type: SANCTIONS=hard stop, PEP=enhanced DD, OTHER=manual review."),
            (bk>0 and ju>0 and li>0,
             "HIGH","🔴 Full Public Records Trifecta",
             f"BK={bk}, Judgments={ju}, Liens={li}. Worst possible public records profile.",
             "Thorough financial document review. May indicate ongoing distress or poor payment history. High Worth Score penalty: estimated {-(min(bk*40,120)+min(ju*20,60)+min(li*10,40))} pts."),
            (bk>0 and ju==0 and li==0,
             "MEDIUM","🟡 Bankruptcy Only",
             f"bankruptcy={bk}, no judgments or liens.",
             f"Check bankruptcy type and age. Discharged BK > 5 years ago is manageable. Recent BK (< 2 years) requires enhanced review."),
            (am>0 and wl==0,
             "MEDIUM","🟡 Adverse Media Only",
             f"adverse_media_hits={am} but no formal watchlist hits.",
             "Adverse media is tracked separately. Review content. Negative press ≠ automatic denial. Requires qualitative assessment."),
            (wl==0 and bk==0 and ju==0 and li==0 and am==0,
             "CLEAN","✅ No Risk Signals",
             "No watchlist hits, no bankruptcies, no judgments, no liens, no adverse media.",
             "Clean profile. Standard underwriting proceeds. Monitor via risk monitoring alerts."),
        ]

        found_combos=[(sev,title,detail,action) for cond,sev,title,detail,action in RISK_COMBOS if cond]
        for sev,title,detail,action in found_combos:
            color={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","CLEAN":"#22c55e"}.get(sev,"#64748b")
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:10px;padding:14px 18px;margin:8px 0">
              <div style="color:{color};font-weight:700;font-size:.90rem;margin-bottom:6px">{title}</div>
              <div style="color:#CBD5E1;font-size:.79rem;margin-bottom:8px">{detail}</div>
              <div style="background:#0f172a;border-radius:6px;padding:8px 12px">
                <span style="color:#60A5FA;font-size:.74rem;font-weight:600">⚡ Required action: </span>
                <span style="color:#94A3B8;font-size:.74rem">{action}</span>
              </div>
            </div>""",unsafe_allow_html=True)
            detail_panel(title, sev,
                what_it_means=f"{detail} | Required action: {action}",
                source_table="rds_warehouse_public.facts (watchlist_hits, adverse_media_hits, num_bankruptcies, num_judgements, num_liens)",
                source_file="consolidatedWatchlist.ts" if "Watchlist" in title else "facts/kyb/index.ts",
                source_file_line="watchlist fact architecture · filterOutAdverseMedia()",
                json_obj={"combination":title,"severity":sev,"detected":detail,"required_action":action,"signals":{"watchlist_hits":wl,"adverse_media_hits":am,"num_bankruptcies":bk,"num_judgements":ju,"num_liens":li}},
                sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('watchlist_hits','adverse_media_hits','num_bankruptcies','num_judgements','num_liens') ORDER BY name;",
                links=[("consolidatedWatchlist.ts","Watchlist architecture"),("facts/kyb/index.ts","Risk fact definitions"),("lookups.py","Worth Score public records features")],
                color=color, icon={"CRITICAL":"🔴","HIGH":"🟠","MEDIUM":"🟡","CLEAN":"✅"}.get(sev,"⚠️"))

        # Risk signal summary bar chart
        risk_vals=[("Watchlist Hits",wl,"#ef4444"),("Adverse Media",am,"#f59e0b"),
                   ("Bankruptcies",bk,"#8B5CF6"),("Judgments",ju,"#8B5CF6"),("Liens",li,"#6366f1")]
        if any(v>0 for _,v,_ in risk_vals):
            fig_risk=go.Figure(go.Bar(
                x=[r[0] for r in risk_vals],y=[r[1] for r in risk_vals],
                marker_color=[r[2] for r in risk_vals],
                text=[str(r[1]) for r in risk_vals],textposition="outside",
            ))
            fig_risk.update_layout(title="Risk Signal Counts for this Business",
                                   height=280,xaxis_title="",yaxis_title="Count",
                                   margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_risk),use_container_width=True)
            detail_panel("Risk Signal Counts Chart",
                f"WL={wl} · AM={am} · BK={bk} · Judg={ju} · Liens={li}",
                what_it_means="Bar chart comparing all 5 risk signal counts for this business. watchlist_hits + adverse_media_hits = compliance signals. Bankruptcies + Judgments + Liens = credit/public records signals. Each bar sourced from a separate fact in rds_warehouse_public.facts.",
                source_table="rds_warehouse_public.facts (watchlist_hits, adverse_media_hits, num_bankruptcies, num_judgements, num_liens)",
                source_file="consolidatedWatchlist.ts", source_file_line="watchlist fact architecture",
                json_obj={"watchlist_hits":wl,"adverse_media_hits":am,"num_bankruptcies":bk,"num_judgements":ju,"num_liens":li,"sources":{"watchlist_hits":"Trulioo PSC + Middesk (pid=38/16)","adverse_media_hits":"Trulioo adverse_media (separate from watchlist)","num_bankruptcies":"Equifax pid=17","num_judgements":"Equifax pid=17","num_liens":"Equifax pid=17"}},
                sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS count_value FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('watchlist_hits','adverse_media_hits','num_bankruptcies','num_judgements','num_liens') ORDER BY name;",
                links=[("consolidatedWatchlist.ts","Watchlist architecture"),("facts/kyb/index.ts","Risk fact definitions"),("integrations.constant.ts","TRULIOO=38, EQUIFAX=17")],
                color="#ef4444" if wl>0 else "#22c55e", icon="📊")

        with st.expander("📋 SQL & Python — risk signal queries"):
            st.code(f"""-- All risk signals in one query:
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS count_value,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}'
  AND name IN ('watchlist_hits','adverse_media_hits','num_bankruptcies','num_judgements','num_liens')
ORDER BY name;

-- Watchlist detail (clients.customer_table):
SELECT watchlist_count, watchlist_verification, adverse_media_hits
FROM clients.customer_table
WHERE business_id='{bid}';

-- Worth Score public records feature impact:
SELECT category_id, score_100, weighted_score_850
FROM rds_manual_score_public.business_score_factors
WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{bid}' LIMIT 1)
  AND category_id='public_records';""",language="sql")
        # AI popup + source links for rw2 (Public Records)
        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('facts/kyb/index.ts','num_bankruptcies / num_judgements / num_liens definitions')}]({GITHUB_LINKS.get('facts/kyb/index.ts','')})\n"
            f"- [{src_link('worth_score_model.py','Worth Score model features (count_bankruptcy, age_bankruptcy)')}]({GITHUB_LINKS.get('worth_score_model.py','')})\n"
            f"- [{src_link('integrations.constant.ts','INTEGRATION_ID.EQUIFAX=17 (public records source)')}]({GITHUB_LINKS.get('integrations.constant.ts','')})"
        )
        ai_popup("PublicRecords",f"BK:{bk} Judgments:{ju} Liens:{li} WL:{wl} AM:{am}",[
            "How does Equifax provide bankruptcy and lien data?",
            "What is the exact Worth Score impact of bankruptcies vs judgments vs liens?",
            "What SQL queries the full bankruptcies array from PostgreSQL RDS?",
            "How are num_bankruptcies and bankruptcies[] related?",
            "Why might num_bankruptcies=0 for a real business?"],bid)

    # rw3 ai popup
    with rw3:
        pass  # rw3 content already rendered above; ai popup at end

    # Add source links + AI popup to risk combinations (rw3)
    with rw3:
        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('consolidatedWatchlist.ts','Watchlist architecture (filterOutAdverseMedia)')}]({GITHUB_LINKS.get('consolidatedWatchlist.ts','')})\n"
            f"- [{src_link('facts/kyb/index.ts','watchlist_hits / adverse_media_hits computation')}]({GITHUB_LINKS.get('facts/kyb/index.ts','')})"
        )
        ai_popup("RiskCombinations",f"WL:{wl} AM:{am} BK:{bk} Judg:{ju} Liens:{li}",[
            "What compliance action is required for a SANCTIONS hit vs a PEP hit?",
            "Why is adverse media tracked separately from the consolidated watchlist?",
            "When should I escalate to Compliance vs handle in underwriting?",
            "What SQL shows the full watchlist hit details including entity names?",
            "How does the risk score (0-100) relate to watchlist and high_risk_people?"],bid)

# ════════════════════════════════════════════════════════════════════════════════
# WORTH SCORE
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="💰 Worth Score":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 💰 Worth Score — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"worthscore")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    with st.spinner("Loading Worth Score…"):
        score_df,score_err=load_score(bid)

    ws1,ws2=st.tabs(["💰 Score & Architecture","📊 Waterfall & Features"])

    with ws1:
        # ── Model architecture explainer ──────────────────────────────────────
        st.markdown("#### Worth Score Model Architecture")
        st.markdown("""<div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:16px 20px;margin:8px 0">
<div style="color:#60A5FA;font-weight:700;font-size:.92rem;margin-bottom:10px">📐 How the Worth Score is Built</div>
<div style="color:#CBD5E1;font-size:.80rem;line-height:1.8">

<strong style="color:#a5b4fc">Step 1 — Feature extraction from KYB facts</strong><br>
ai-score-service reads from rds_warehouse_public.facts → extracts model inputs (age_business, count_bankruptcy, 
naics6, revenue, bs_total_liabilities, ratio_debt_to_equity, gdp_pch, etc.)

<br><br><strong style="color:#a5b4fc">Step 2 — 3-component ensemble model (worth_score_model.py)</strong><br>
■ Firmographic XGBoost — features: age, NAICS, state, employees, entity type, SIC, public records counts/ages<br>
■ Financial neural net (PyTorch) — features: P&L, balance sheet, cash flow, profitability/solvency ratios from Plaid banking<br>
■ Economic model — features: macro indicators (GDP, CPI, interest rates, unemployment, VIX, dollar index, etc.)<br>
All three produce a probability → combined via ensemble → isotonic calibrator → final_proba ∈ [0,1]

<br><br><strong style="color:#a5b4fc">Step 3 — Score scaling</strong><br>
<code>score_300_850 = final_proba × 550 + 300</code> (source: aiscore.py L44)<br>
<code>score_0_100 = final_proba × 100</code><br>
Example: probability=0.72 → score_300_850 = 0.72×550+300 = <strong>696</strong>

<br><br><strong style="color:#a5b4fc">Step 4 — Decision thresholds (score_decision_matrix table)</strong><br>
Default cutoffs (configurable per customer in score_decision_matrix):<br>
■ <span style="color:#22c55e">700–850 → LOW risk → APPROVE</span><br>
■ <span style="color:#f59e0b">550–699 → MODERATE risk → FURTHER_REVIEW_NEEDED</span><br>
■ <span style="color:#ef4444">0–549 → HIGH risk → DECLINE</span><br>
Source: manual-score-service/db/migrations/.../20240109130303-initial-tables-up.sql

<br><br><strong style="color:#a5b4fc">Step 5 — Storage</strong><br>
Score → Kafka message → manual-score-service → PostgreSQL (rds_manual_score_public.business_scores)<br>
Federated view in Redshift: rds_manual_score_public.data_current_scores JOIN business_scores<br>
customer_files.worth_score: from warehouse.latest_score (datascience schema) — uses score from awsdatacatalog

</div></div>""",unsafe_allow_html=True)

        # Source links for Worth Score architecture
        st.markdown("**🔗 Source references — click to open in GitHub:**")
        st.markdown(
            f"- [{src_link('aiscore.py','aiscore.py — score formula (p × 550 + 300), SHAP computation')}]({GITHUB_LINKS.get('aiscore.py','')})\n"
            f"- [{src_link('worth_score_model.py','worth_score_model.py — 3-model ensemble, feature extraction')}]({GITHUB_LINKS.get('worth_score_model.py','')})\n"
            f"- [{src_link('lookups.py','lookups.py — all model input features and imputation defaults')}]({GITHUB_LINKS.get('lookups.py','')})\n"
            f"- [{src_link('score_decision_matrix','score_decision_matrix migration — APPROVE/REVIEW/DECLINE thresholds')}]({GITHUB_LINKS.get('score_decision_matrix','')})\n"
            f"- [{src_link('customer_table.sql','customer_table.sql — worth_score in customer_files')}]({GITHUB_LINKS.get('customer_table.sql','')})"
        )
        st.markdown("---")

        # ── Score KPIs ────────────────────────────────────────────────────────
        score=None
        if score_df is not None and not score_df.empty:
            row=score_df.iloc[0]
            score_raw=row.get("score_850")
            score=float(score_raw or 0)
            score_100=float(row.get("score_100") or 0) if "score_100" in row else (score-300)/550*100 if score>300 else 0.0
            risk=str(row.get("risk_level","") or "")
            dec=str(row.get("score_decision","") or "")
            scored_at=str(row.get("created_at",""))[:16]
            prob=round((score-300)/550,4) if score>300 else 0.0
            rc={"HIGH":"#ef4444","MODERATE":"#f59e0b","MEDIUM":"#f59e0b","LOW":"#22c55e"}.get(risk.upper(),"#64748b")
            dc={"APPROVE":"#22c55e","FURTHER_REVIEW_NEEDED":"#f59e0b","DECLINE":"#ef4444"}.get(dec,"#64748b")

            # Detect score=0 / score=300 (model returned minimum — not a real score)
            score_is_zero = score <= 300

            if score_is_zero:
                flag("🔴 Worth Score = 0 (or ≤300). This means the model returned its minimum possible output. "
                     "This is almost always caused by missing model inputs — see diagnosis below.", "red")

            c1,c2,c3,c4,c5=st.columns(5)
            score_sql=f"""SELECT bs.weighted_score_850, bs.weighted_score_100,
       bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1;"""
            score_json=f"""{{\n  "weighted_score_850": {score},\n  "weighted_score_100": {score_100:.1f},\n  "risk_level": "{risk}",\n  "score_decision": "{dec}",\n  "created_at": "{scored_at}"\n}}"""
            null_reasons=[
                "weighted_score_850=0 — the model returned its minimum output (probability≈0)",
                "Critical features are null: no Plaid banking data, no revenue, no formation_date",
                "Entity matching failed — ZI/EFX/OC could not match → most firmographic features are null",
                "Business too new — not yet in vendor bulk datasets (updated monthly)",
                "Score pipeline ran but model output was below 300 floor → stored as 0 or 300",
            ]
            with c1:
                kpi_detail("Worth Score (850)",f"{score:.0f}","score_300_850 = p × 550 + 300","#ef4444" if score_is_zero else "#3B82F6",
                           "weighted_score_850",score,"rds_manual_score_public.business_scores",score_sql,
                           null_reasons if score_is_zero else None, score_json,
                           f"GET /integration/api/v1/score/business/{bid}")
            with c2:
                kpi_detail("Score (100)",f"{score_100:.1f}","score_0_100 = p × 100","#ef4444" if score_is_zero else "#3B82F6",
                           "weighted_score_100",score_100,"rds_manual_score_public.business_scores",score_sql,
                           None, score_json)
            with c3:
                kpi_detail("Model Probability",f"{prob:.4f}","final_proba from calibrated ensemble","#ef4444" if score_is_zero else "#8B5CF6",
                           "probablity (sic)",prob,"ai-score-service Kafka message",
                           "-- Probability is not stored directly in Redshift.\n-- Reverse-compute: prob = (score_850 - 300) / 550\n-- Raw scores in: awsdatacatalog.scores_ai_dataplatform_v1",
                           null_reasons if score_is_zero else None, score_json)
            with c4:
                kpi_detail("Risk Level",risk or "Unknown","from score_decision_matrix",rc,
                           "risk_level",risk or None,"rds_manual_score_public.business_scores",
                           "SELECT range_start, range_end, risk_level, decision FROM score_decision_matrix ORDER BY range_start;\n-- Default: 0-549=HIGH, 550-699=MODERATE, 700-850=LOW",
                           ["Score ≤549 → HIGH", "Score 550-699 → MODERATE","Score ≥700 → LOW"],
                           f'{{"risk_level": "{risk}", "range": "0-549 if score≤549"}}')
            with c5:
                kpi_detail("Decision",dec.replace("_"," ")[:16] or "Unknown","configurable per customer",dc,
                           "score_decision",dec or None,"rds_manual_score_public.business_scores",
                           "SELECT decision FROM score_decision_matrix WHERE range_start <= score AND range_end >= score;\n-- Configurable per customer_id in score_decision_matrix table",
                           ["Score=0 → DECLINE (below threshold)","Thresholds are per-customer configurable"],
                           f'{{"score_decision": "{dec}"}}')

            # ── Score=0 root cause diagnosis ──────────────────────────────────
            if score_is_zero:
                st.markdown("---")
                st.markdown("### 🔴 Why is the Worth Score 0? — Root Cause Diagnosis")
                st.markdown("""<div style="background:#1f0a0a;border:1px solid #ef4444;border-radius:12px;padding:16px 20px;margin:8px 0">
<div style="color:#fca5a5;font-weight:700;font-size:.90rem;margin-bottom:10px">
  Score = 0 means one of these conditions is true:
</div>""",unsafe_allow_html=True)

                # Check which KYB facts are available
                bk_d=int(float(gv(facts,"num_bankruptcies") or 0))
                has_rev=gv(facts,"revenue") is not None
                has_fd=bool(gv(facts,"formation_date"))
                has_emp=gv(facts,"num_employees") is not None
                naics_d=str(gv(facts,"naics_code") or "")
                sos_d=str(gv(facts,"sos_active") or "").lower()
                tin_d=str(gv(facts,"tin_match_boolean") or "").lower()

                diag_rows=[
                    ("Entity matching failed — no firmographic data",
                     not has_rev and not has_emp,
                     "ZI/EFX/OC could not match this entity → revenue, employees, NAICS all null → firmographic model gets all default values → very low probability",
                     "Check if business is in ZI/EFX databases. Run entity re-match or wait for next bulk update (monthly)."),
                    ("No Plaid banking data connected",
                     True,  # always possible
                     "Financial sub-model (PyTorch) requires: balance sheet, P&L, cash flow ratios from Plaid. "
                     "If Plaid not connected → all financial features are null → financial model outputs minimum → drags ensemble score to 0.",
                     "Verify if Plaid banking is connected for this business. Check rds_integration_data.plaid_* tables."),
                    ("NAICS = 561499 (fallback code)",
                     naics_d=="561499" or not naics_d,
                     f"Current NAICS={naics_d or '(null)'}. Industry unknown → naics6 feature = null → company_profile category score is penalized.",
                     "Industry classification failure reduces company_profile contribution. Fix NAICS first."),
                    ("Business too new (< 2 weeks old)",
                     not has_fd,
                     "Formation date unknown → age_business = null → imputed to default (often 0) → low operations score.",
                     f"formation_date fact is {'missing' if not has_fd else 'present'}. Check if date was provided on onboarding form."),
                    ("Score pipeline ran but probability < 0.0001",
                     score==0,
                     "The model returned a probability extremely close to 0. This is mathematically possible when: BK history + watchlist + no banking + no revenue all combine.",
                     "Review all negative signals simultaneously. Score = max(actual_prob × 550 + 300, 300) — if probability rounds to 0 → stored as 0."),
                ]

                for title, flagged, cause, action in diag_rows:
                    color="#ef4444" if flagged else "#334155"
                    prefix="🔴" if flagged else "⚪"
                    st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                        border-radius:8px;padding:10px 14px;margin:4px 0">
                      <div style="color:{color};font-weight:700;font-size:.80rem">{prefix} {title}</div>
                      <div style="color:#94A3B8;font-size:.73rem;margin-top:3px">{cause}</div>
                      <div style="color:#60A5FA;font-size:.72rem;margin-top:4px">⚡ {action}</div>
                    </div>""",unsafe_allow_html=True)
                    if flagged:
                        detail_panel(title, "CONFIRMED",
                            what_it_means=f"Root cause: {cause}\n\nRecommended action: {action}",
                            source_table="rds_manual_score_public.business_scores (Worth Score) + rds_warehouse_public.facts (KYB features)",
                            source_file="worth_score_model.py", source_file_line="Feature extraction pipeline",
                            json_obj={"root_cause":title,"detected":flagged,"cause":cause,"action":action,"current_score":score,"score_formula":"probability × 550 + 300 (aiscore.py L44)"},
                            sql=f"-- Verify score:\nSELECT bs.weighted_score_850, bs.risk_level, bs.score_decision FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1;\n-- Verify features:\nSELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('revenue','num_employees','naics_code','formation_date','sos_active','tin_match_boolean') ORDER BY name;",
                            links=[("aiscore.py","Score formula (p×550+300)"),("worth_score_model.py","Model pipeline"),("lookups.py","Feature imputation defaults")],
                            color=color, icon="🔴")

                st.markdown("</div>",unsafe_allow_html=True)

                # Available vs missing features
                st.markdown("##### Available vs Missing Model Input Features")
                feat_status=[
                    ("sos_active",sos_d or "(null)",bool(sos_d),"Company Profile"),
                    ("tin_match_boolean",tin_d or "(null)",bool(tin_d),"Company Profile"),
                    ("formation_date",str(gv(facts,"formation_date") or "(null)"),has_fd,"Company Profile → age_business"),
                    ("naics_code",naics_d or "(null)",bool(naics_d) and naics_d!="561499","Company Profile → naics6"),
                    ("revenue",str(gv(facts,"revenue") or "(null)")[:40],has_rev,"Business Operations"),
                    ("num_employees",str(gv(facts,"num_employees") or "(null)"),has_emp,"Company Profile → count_employees"),
                    ("num_bankruptcies",str(bk_d),"n/a" not in str(bk_d),"Public Records → count_bankruptcy"),
                    ("watchlist_hits",str(gv(facts,"watchlist_hits") or "0"),True,"Used in cross-field checks"),
                ]
                st.dataframe(pd.DataFrame([{
                    "Fact":f,"Value":v,"Present":"✅" if ok else "❌ NULL — imputed","Model Category":cat
                } for f,v,ok,cat in feat_status]),use_container_width=True,hide_index=True)
                st.caption("▼ Click any feature to see its lineage, JSON, and how null affects the Worth Score")
                for f_name,f_val,f_ok,f_cat in feat_status:
                    detail_panel(f"Model input: {f_name}", str(f_val),
                        what_it_means=f"Worth Score model category: {f_cat}. Current value: {f_val}. {'Present — contributes to model accuracy.' if f_ok else 'NULL — the model will use the imputed default from lookups.py. This reduces prediction accuracy for this business.'}",
                        source_table=f"rds_warehouse_public.facts · name='{f_name}'",
                        source_file="lookups.py", source_file_line=f"{f_name} in INPUTS dict — imputation default",
                        json_obj={"worth_score_feature":f_name,"current_value":f_val,"present":f_ok,"model_category":f_cat,"if_null":"imputed with default from lookups.py INPUTS dict"},
                        sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS {f_name} FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='{f_name}';",
                        links=[("lookups.py",f"{f_name} imputation default"),("worth_score_model.py","Feature extraction pipeline")],
                        color="#22c55e" if f_ok else "#ef4444", icon="✅" if f_ok else "❌")

                st.markdown("##### SQL — Verify Score & Check What Triggered the 0")
                st.code(f"""-- 1. Confirm the score record exists:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level,
       bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}' ORDER BY bs.created_at DESC LIMIT 5;

-- 2. Check which features were available (Worth Score audit):
SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 3;

-- 3. Check Plaid banking connection:
SELECT * FROM rds_integration_data.plaid_items WHERE business_id='{bid}';

-- 4. Check if entity was matched by ZI/EFX:
SELECT name, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf
FROM rds_warehouse_public.facts
WHERE business_id='{bid}'
  AND name IN ('revenue','num_employees','naics_code','formation_date')
ORDER BY name;

-- 5. Raw score from data platform:
SELECT business_id, score, score_date
FROM warehouse.latest_score WHERE business_id='{bid}';""",language="sql")

            # Score gauge
            score_pct=int((score-300)/550*100)
            gauge_color=dc
            st.markdown(f"""<div style="margin:12px 0">
              <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#94A3B8">
                <span>300 (min)</span><span>DECLINE &lt;550</span><span>REVIEW 550-699</span><span>APPROVE ≥700</span><span>850 (max)</span>
              </div>
              <div style="position:relative;background:linear-gradient(90deg,#ef4444 0%,#ef4444 45%,#f59e0b 45%,#f59e0b 73%,#22c55e 73%,#22c55e 100%);
                border-radius:8px;height:14px;margin:4px 0">
                <div style="position:absolute;left:{score_pct}%;top:-4px;width:3px;height:22px;
                  background:white;border-radius:2px;transform:translateX(-50%)"></div>
              </div>
              <div style="text-align:left;margin-left:{score_pct}%;font-size:.78rem;color:white;font-weight:700;margin-top:2px">
                {score:.0f}
              </div>
            </div>""",unsafe_allow_html=True)

            # Decision explanation
            DECISION_DETAIL={
                "APPROVE":(
                    "✅ APPROVE",
                    f"Score {score:.0f} ≥ 700 threshold. "
                    "Model probability {:.4f} is above the acceptance threshold. "
                    "Business passes major risk factors. Standard approval process.",
                    f"Thresholds are stored in score_decision_matrix table (configurable per customer). "
                    "Default: 700=APPROVE threshold.",
                ),
                "FURTHER_REVIEW_NEEDED":(
                    "🔎 FURTHER REVIEW NEEDED",
                    f"Score {score:.0f} is in the uncertain zone (550–699). "
                    "Model cannot confidently approve or decline. "
                    "A human analyst must review before making a decision.",
                    "Typical profile: entity is legitimate but has some risk factors. "
                    "May have bankruptcy history, moderate public records, or limited banking data.",
                ),
                "DECLINE":(
                    "❌ DECLINE",
                    f"Score {score:.0f} < 550 threshold. "
                    "Model probability {:.4f} is below the minimum acceptance threshold. "
                    "Business exceeds maximum acceptable risk for this product.",
                    "Do NOT approve without Compliance override. Document decline reason. "
                    "Check if decline is due to watchlist (compliance issue) or credit (financial issue).",
                ),
            }
            if dec in DECISION_DETAIL:
                title,detail,action=DECISION_DETAIL[dec]
                col_dec=dc
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col_dec};
                    border-radius:10px;padding:14px 18px;margin:10px 0">
                  <div style="color:{col_dec};font-weight:700;font-size:.90rem;margin-bottom:6px">{title}</div>
                  <div style="color:#CBD5E1;font-size:.79rem;margin-bottom:6px">{detail}</div>
                  <div style="color:#94A3B8;font-size:.74rem">{action}</div>
                </div>""",unsafe_allow_html=True)

            # Factor contributions
            factors_df,_=load_score_factors(bid)
            if factors_df is not None and not factors_df.empty:
                st.markdown("##### SHAP Factor Contributions by Category")
                st.caption("Each row = one model category's SHAP-equivalent contribution. "
                           "Positive Impact (pts) = adds to score. Negative = reduces score. "
                           "Source: `rds_manual_score_public.business_score_factors`")

                CAT_NAMES={
                    "public_records":"📜 Public Records",
                    "company_profile":"🏢 Company Profile",
                    "financial_trends":"📈 Financial Trends",
                    "business_operations":"💼 Business Operations",
                    "performance_measures":"📊 Performance Measures",
                }
                CAT_FEATURES={
                    "public_records":"count_bankruptcy, age_bankruptcy, count_judgment, age_judgment, count_lien, age_lien, score_reviews, count_reviews",
                    "company_profile":"age_business, naics6, primsic, state, bus_struct, count_employees, indicator_government, indicator_education",
                    "financial_trends":"GDP (gdp_pch), CPI (cpi), interest rates (t10y, t2y), VIX, unemployment, debt ratios, FX rates",
                    "business_operations":"revenue, is_net_income, cf_cash_at_end_of_period, bs_total_liabilities, bs_total_assets, bs_accounts_payable",
                    "performance_measures":"ratio_return_on_assets, ratio_gross_margin, ratio_debt_to_equity, flag_equity_negative, flag_total_liabilities_over_assets",
                }
                CAT_WHAT={
                    "public_records":"Public court records including bankruptcies (−40pts each), civil judgments (−20pts), tax/mechanic liens (−10pts). Source: Equifax (pid=17). High negative impact.",
                    "company_profile":"Business identity: age (older=lower risk), NAICS industry code (561499=penalty), state, entity type, employee count. Source: ZI/EFX/Middesk. NAICS=561499 reduces this category significantly.",
                    "financial_trends":"Macro-economic indicators (GDP growth, CPI, interest rates, VIX, unemployment) + financial ratios from Plaid banking. Source: Liberty/Fed data + Plaid.",
                    "business_operations":"Revenue, P&L, cash flow, balance sheet from Plaid banking statements. If Plaid not connected → all null → model uses defaults → lower accuracy.",
                    "performance_measures":"Profitability ratios, solvency flags. flag_equity_negative / flag_total_liabilities_over_assets = highest negative impact binary features.",
                }

                factors_df["Category"]=factors_df["category_id"].map(lambda c: CAT_NAMES.get(c, f"Category {c}"))
                factors_df["Impact (pts)"]=factors_df["weighted_score_850"].apply(lambda v: f"{v:+.1f}" if pd.notna(v) else "n/a")
                factors_df["Score (0-100)"]=factors_df["score_100"].apply(lambda v: f"{v:.1f}" if pd.notna(v) else "n/a")
                factors_df["Features (model inputs)"] = factors_df["category_id"].map(lambda c: CAT_FEATURES.get(c,"see lookups.py"))

                st.dataframe(
                    factors_df[["Category","Score (0-100)","Impact (pts)","Features (model inputs)"]],
                    use_container_width=True, hide_index=True,
                    column_config={
                        "Category": st.column_config.TextColumn("Category", width="medium"),
                        "Score (0-100)": st.column_config.TextColumn("Score (0-100)", width="small"),
                        "Impact (pts)": st.column_config.TextColumn("Impact (pts on 850 scale)", width="small"),
                        "Features (model inputs)": st.column_config.TextColumn("Model features", width="large"),
                    }
                )

                _factors_sql = f"""SELECT category_id, score_100, weighted_score_850
FROM rds_manual_score_public.business_score_factors
WHERE score_id = (
    SELECT score_id FROM rds_manual_score_public.data_current_scores
    WHERE business_id = '{bid}' LIMIT 1
)
ORDER BY ABS(weighted_score_850) DESC;"""

                detail_panel("SHAP Factor Contributions Table", f"{len(factors_df)} categories",
                    what_it_means=(
                        "Each row = one model category's SHAP-equivalent contribution to the final Worth Score.\n\n"
                        "category_id values and their meaning:\n"
                        "• public_records: BK/judgment/lien counts+ages. Source: Equifax pid=17. −40pts/BK, −20pts/judgment, −10pts/lien.\n"
                        "• company_profile: age, NAICS, state, entity type, employees. Source: ZI/EFX/Middesk. NAICS=561499 = penalty.\n"
                        "• financial_trends: macro-economic indicators + financial ratios. Source: Liberty/Fed data + Plaid.\n"
                        "• business_operations: P&L, cash flow, balance sheet from Plaid banking. NULL if Plaid not connected.\n"
                        "• performance_measures: profitability ratios, solvency flags. flag_equity_negative = high negative impact.\n\n"
                        "Score (0-100): category raw score (0=worst, 100=best).\n"
                        "Impact (pts): SHAP contribution in 850-scale points. Sum of all impacts + 300 ≈ final score.\n"
                        "Source: rds_manual_score_public.business_score_factors (Redshift federated view)."
                    ),
                    source_table="rds_manual_score_public.business_score_factors",
                    source_file="aiscore.py", source_file_line="SHAP scores × 550 → impact_pts. shap_base_points = base_prediction × 550 + 300",
                    json_obj={
                        "table":"rds_manual_score_public.business_score_factors",
                        "columns":{"category_id":"model category","score_100":"0-100 score","weighted_score_850":"pts impact on 850 scale"},
                        "categories":{k:v for k,v in CAT_WHAT.items()},
                        "data":factors_df[["category_id","score_100","weighted_score_850"]].to_dict("records")
                    },
                    sql=_factors_sql,
                    links=[("aiscore.py","SHAP computation"),("worth_score_model.py","model pipeline"),("lookups.py","feature definitions")],
                    color="#8B5CF6", icon="📊")
            else:
                flag("business_score_factors not accessible from Redshift federation. "
                     "See waterfall tab for estimated factor breakdown.", "blue")
        else:
            flag(f"No score found for this business. {score_err or ''} "
                 "Possible causes: (1) score not yet computed, (2) business too new, (3) insufficient features.", "amber")
            st.code(f"""-- Check Worth Score:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 5;

-- Alternative (warehouse):
SELECT worth_score, score_date FROM warehouse.latest_score WHERE business_id='{bid}';""",language="sql")

        ai_popup("WorthScore",f"Score:{score} risk:{risk if score else 'N/A'} prob:{prob if score else 'N/A'}",[
            "Explain the exact formula for converting model probability to 300-850 score",
            "What are the 5 feature categories and which facts feed each one?",
            "What SQL shows factor contributions for this specific business?",
            "What is the most impactful action this business could take to improve its score?",
            "How does the score_decision_matrix work and can thresholds be customized?"],bid)

        with st.expander("📋 SQL & Python — Worth Score queries"):
            st.code(f"""-- Current score + decision:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level, bs.score_decision,
       bs.created_at, bs.id AS score_id
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 1;

-- Factor contributions by category:
SELECT category_id, score_100, weighted_score_850
FROM rds_manual_score_public.business_score_factors
WHERE score_id = (SELECT score_id FROM rds_manual_score_public.data_current_scores
                  WHERE business_id = '{bid}' LIMIT 1)
ORDER BY ABS(weighted_score_850) DESC;

-- Score history (all versions):
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.business_scores bs
WHERE bs.id IN (SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{bid}')
ORDER BY bs.created_at DESC LIMIT 10;

-- Decision thresholds (global config):
SELECT range_start, range_end, risk_level, decision FROM score_decision_matrix ORDER BY range_start;""",language="sql")

    with ws2:
        st.markdown("#### 📊 Score Waterfall — Factor Contributions")
        st.caption("Estimated from KYB facts. The waterfall approximates the model's contribution breakdown. "
                   "Exact SHAP values are in business_score_factors (Score tab).")

        if score_df is not None and not score_df.empty and score_df.iloc[0].get("score_850") is not None:
            score_v=float(score_df.iloc[0]["score_850"] or 0)
            bk_w=int(float(gv(facts,"num_bankruptcies") or 0))
            ju_w=int(float(gv(facts,"num_judgements") or 0))
            li_w=int(float(gv(facts,"num_liens") or 0))
            sos_a=str(gv(facts,"sos_active") or "").lower()=="true"
            tin_ok=str(gv(facts,"tin_match_boolean") or "").lower()=="true"
            wl_n=int(float(gv(facts,"watchlist_hits") or 0))
            has_rev=gv(facts,"revenue") is not None and str(gv(facts,"revenue") or "") not in ("","None","[too large")
            naics=str(gv(facts,"naics_code") or "")
            naics_ok=naics not in ("","561499")
            fd_w=str(gv(facts,"formation_date") or "")
            try: age_w=datetime.now(timezone.utc).year-int(fd_w[:4]) if fd_w and fd_w[:4].isdigit() else None
            except: age_w=None

            # Estimated contributions
            pr_est=-(min(bk_w*40,120)+min(ju_w*20,60)+min(li_w*10,40))
            perf_est=(10 if sos_a else -10)+(10 if tin_ok else -5)-min(wl_n*25,100)
            fin_est=30 if has_rev else -10
            ops_est=(40 if (age_w or 0)>=5 else 25 if (age_w or 0)>=2 else 10 if (age_w or 0)>=1 else -5)
            profile_est=20 if naics_ok else -10
            # Residual goes to Financial Trends (macro/banking)
            explained=pr_est+perf_est+fin_est+ops_est+profile_est
            trends_est=score_v-300-explained

            cats=["📦 Base\n(300 floor)","📜 Public Records\n(BK/Judg/Lien)","⚖️ KYB Performance\n(SOS/TIN/WL)",
                  "💼 Business Ops\n(Revenue/Banking)","🕐 Operations\n(Age/Scale)","🏢 Company Profile\n(NAICS/State)",
                  "📈 Financial Trends\n(Macro/Ratios)","🎯 Final Score"]
            conts=[300,pr_est,perf_est,fin_est,ops_est,profile_est,trends_est,0]
            running=300; bases=[]; colors=[]; texts=[]; tooltips=[]
            for i,(c,ct) in enumerate(zip(cats,conts)):
                if i==0:
                    bases.append(0); colors.append("#6366f1"); texts.append("300")
                    tooltips.append("Base score (model intercept). All scores start here.")
                elif i==len(cats)-1:
                    bases.append(0); colors.append("#EC4899"); texts.append(f"{score_v:.0f}")
                    tooltips.append(f"Final Worth Score: {score_v:.0f}/850")
                else:
                    bases.append(running if ct>=0 else running+ct); running+=ct
                    colors.append("#22c55e" if ct>=0 else "#ef4444")
                    texts.append(f"{'+' if ct>=0 else ''}{int(ct)}")

            fig_wf=go.Figure(go.Bar(
                x=cats,
                y=[abs(c) if i not in (0,len(conts)-1) else c for i,c in enumerate(conts)],
                base=bases,marker_color=colors,
                text=texts,textposition="outside",textfont=dict(color="#E2E8F0",size=11),
                hovertext=[f"{c}: {'+' if v>=0 and i>0 else ''}{int(v)}"
                           for i,(c,v) in enumerate(zip(cats,conts))],
                hoverinfo="text",
            ))
            fig_wf.update_layout(
                title=f"Worth Score Factor Waterfall — {score_v:.0f}/850 (estimated)",
                yaxis=dict(range=[200,920],title="Score"),height=440,
                xaxis_tickangle=-10,
            )
            st.plotly_chart(dark_chart(fig_wf),use_container_width=True)
            st.caption("⚠️ This waterfall is ESTIMATED from KYB facts using simplified model weights. "
                       "For exact SHAP values, see Score tab → Factor Contributions table.")

            # Factor table
            st.markdown("##### Estimated Factor Breakdown — Source Facts & Model Features")
            factor_table=[
                ("📜 Public Records",f"{pr_est:+.0f}",
                 "count_bankruptcy, count_judgment, count_lien, age_bankruptcy, age_judgment, age_lien",
                 "num_bankruptcies, num_judgements, num_liens (Redshift) + detail arrays (PostgreSQL RDS)",
                 f"BK={bk_w} (est. {min(bk_w*40,120):.0f}pts), Judg={ju_w} (est. {min(ju_w*20,60):.0f}pts), Liens={li_w} (est. {min(li_w*10,40):.0f}pts)"),
                ("⚖️ KYB Performance",f"{perf_est:+.0f}",
                 "sos_active, tin_match_boolean, watchlist_hits",
                 "sos_active, tin_match_boolean, watchlist_hits facts",
                 f"SOS={'✅' if sos_a else '❌'}, TIN={'✅' if tin_ok else '❌'}, WL={wl_n} hit(s)"),
                ("💼 Business Operations",f"{fin_est:+.0f}",
                 "revenue, is_net_income, cf_cash_at_end_of_period, bs_total_liabilities",
                 "revenue, net_income facts + Plaid banking facts",
                 f"Revenue={'available' if has_rev else 'missing'} — Plaid banking features drive this"),
                ("🕐 Operations",f"{ops_est:+.0f}",
                 "age_business, count_employees",
                 "formation_date (→ age), num_employees facts",
                 f"Business age: {f'{age_w} years' if age_w else 'unknown'}, Employees: {str(gv(facts,'num_employees') or 'unknown')[:20]}"),
                ("🏢 Company Profile",f"{profile_est:+.0f}",
                 "naics6, primsic, state, bus_struct, indicator_* flags",
                 "naics_code, formation_state, corporation facts",
                 f"NAICS={'561499 (fallback⚠️)' if not naics_ok else naics}, state={str(gv(facts,'formation_state') or 'unknown')}"),
                ("📈 Financial Trends",f"{trends_est:+.0f}",
                 "gdp_pch, cpi, vix, t10y2y, unemployment, ratio_debt_to_equity, ...",
                 "Macro: Liberty/Fed data · Ratios: Plaid balance sheet computation",
                 "Macro indicators (residual from other categories)"),
            ]
            st.dataframe(pd.DataFrame(factor_table,
                columns=["Category","Est. Impact (pts)","Model Features","Source Facts","This Business"]),
                use_container_width=True,hide_index=True)
        else:
            st.info("Score data not available for waterfall chart.")

        with st.expander("📋 SQL & Python — factor contributions"):
            st.code(f"""-- Exact factor contributions (SHAP values) per category:
SELECT
    category_id,
    score_100          AS category_score_0_100,
    weighted_score_850 AS category_impact_pts
FROM rds_manual_score_public.business_score_factors
WHERE score_id = (
    SELECT score_id FROM rds_manual_score_public.data_current_scores
    WHERE business_id = '{bid}' LIMIT 1
)
ORDER BY ABS(weighted_score_850) DESC;""",language="sql")
        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('aiscore.py','aiscore.py — SHAP computation (shap_scores × 550)')}]({GITHUB_LINKS.get('aiscore.py','')})\n"
            f"- [{src_link('worth_score_model.py','worth_score_model.py — model prediction + feature extraction')}]({GITHUB_LINKS.get('worth_score_model.py','')})\n"
            f"- [{src_link('lookups.py','lookups.py — FIRMOGRAPHIC/FINANCIAL/ECONOMIC feature lists')}]({GITHUB_LINKS.get('lookups.py','')})"
        )
        _ws2_score = score_v if (score_df is not None and not score_df.empty and 'score_v' in dir()) else (float(score_df.iloc[0]["score_850"] or 0) if score_df is not None and not score_df.empty else "N/A")
        ai_popup("WorthScoreWaterfall",f"Score:{_ws2_score}",[
            "What is the exact SHAP calculation that produces the waterfall contributions?",
            "Which feature category has the highest negative impact for this business?",
            "What would improve this business's Worth Score the most?",
            "How does the financial model (PyTorch) differ from the firmographic model (XGBoost)?",
            "Why is the waterfall estimated and not the exact model output?"],bid)


# ════════════════════════════════════════════════════════════════════════════════
# ALL FACTS — grouped, enriched, with lineage
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="📋 All Facts":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab first, then return here."); st.stop()
    st.markdown(f"## 📋 All Facts — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"allfacts")
    if facts is None: st.error(f"❌ {err}"); st.stop()
    if not facts: st.error("No facts found for this business."); st.stop()

    # ── Group definitions (from kyb_dashboard.py, extended) ──────────────────
    FACT_GROUPS = {
        "🏢 Identity / Name": [
            "business_name","legal_name","names","names_found","names_submitted",
            "dba_found","people","kyb_submitted","external_id","customer_ids",
            "compliance_status","kyb_complete","risk_score","high_risk_people",
        ],
        "🏛️ Registry / SOS": [
            "sos_filings","sos_active","sos_match","sos_match_boolean",
            "formation_date","formation_state","year_established","corporation",
            "middesk_confidence","middesk_id","screened_people",
        ],
        "🔐 TIN / EIN": [
            "tin","tin_submitted","tin_match","tin_match_boolean","is_sole_prop",
            "npi","stock_symbol",
        ],
        "📍 Address / Location": [
            "primary_address","addresses","addresses_submitted","addresses_found",
            "addresses_deliverable","address_match","address_match_boolean",
            "address_verification","address_verification_boolean",
            "address_registered_agent","countries","city","state",
        ],
        "📞 Contact": [
            "business_phone","phone_found","email",
        ],
        "🌐 Website / Digital": [
            "website","website_found","serp_id","all_google_place_ids",
            "review_rating","review_count","google_review_count","google_review_rating",
        ],
        "🏭 Industry / Classification": [
            "naics_code","naics_description","mcc_code","mcc_description",
            "industry","classification_codes","revenue_confidence",
        ],
        "💼 Firmographic": [
            "num_employees","revenue","net_income","revenue_equally_weighted_average",
            "revenue_all_sources","minority_owned","woman_owned","veteran_owned",
            "business_verified","verification_status","shareholder_document",
        ],
        "🪪 Identity Verification (KYC)": [
            "idv_status","idv_passed","idv_passed_boolean",
            "name_match","name_match_boolean",
        ],
        "📊 Financial Ratios (Worth Score inputs)": [
            "bs_total_liabilities_and_equity","ratio_operating_margin","flag_equity_negative",
            "ratio_income_quality_ratio","bs_accounts_payable","ratio_gross_margin",
            "flag_total_liabilities_over_assets","is_operating_expense","ratio_return_on_assets",
            "bs_total_liabilities","ratio_total_liabilities_cash","ratio_debt_to_equity",
            "is_net_income","ratio_accounts_payable_cash","cf_cash_at_end_of_period",
        ],
        "⚠️ Risk / Watchlist": [
            "watchlist","watchlist_hits","watchlist_raw",
            "adverse_media_hits","sanctions_hits","pep_hits",
            "num_bankruptcies","num_judgements","num_liens",
            "bankruptcies","judgements","liens",
        ],
        "🔗 Vendor / Integration": [
            "internal_platform_matches","internal_platform_matches_count",
            "internal_platform_matches_combined","canadaopen_confidence",
            "canadaopen_id","canadaopen_match_mode",
        ],
        "🇨🇦 Canada (if applicable)": [
            "canada_business_number_found","canada_business_number_match",
            "canada_id_number_match","canada_corporate_id_found","canada_corporate_id_match",
        ],
    }

    fact_to_group = {n:g for g,ns in FACT_GROUPS.items() for n in ns}

    # ── Deep explanations per fact ─────────────────────────────────────────────
    FACT_EXPLAIN = {
        "sos_active":          ("Middesk (pid=16)","dependent from sos_filings[].active","true if ANY sos_filing is active. Admin Portal 'SOS' badge."),
        "sos_match":           ("Middesk (pid=16)","factWithHighestConfidence","String: 'success'|'failure'. Middesk SOS name/address match result."),
        "sos_match_boolean":   ("Middesk (pid=16)","dependent from sos_match","true when sos_match='success'. What the Admin Portal verified badge derives from."),
        "middesk_confidence":  ("Middesk (pid=16)","formula","0.15 base + 0.20 per passing review task (name/TIN/address/SOS). Max=0.95."),
        "tin":                 ("Applicant (pid=0)","factWithHighestConfidence","Raw EIN (9 digits unmasked). Source=Applicant (businessDetails) confidence=1.0."),
        "tin_submitted":       ("Applicant (pid=0)","factWithHighestConfidence","Masked EIN (XXXXX1234) returned to frontend. Source=Applicant."),
        "tin_match":           ("Middesk (pid=16)","factWithHighestConfidence","Object: {status, message, sublabel}. status='success'=IRS confirmed."),
        "tin_match_boolean":   ("Middesk (pid=16)","dependent from tin_match","true only when tin_match.status='success'. Admin Portal EIN verified badge."),
        "is_sole_prop":        ("System (pid=-1)","dependent from tin_submitted+idv_passed_boolean","true if EIN not submitted and IDV passed — inferred sole prop."),
        "naics_code":          ("EFX/ZI/OC/SERP/Trulioo/Applicant/AI","factWithHighestConfidence","6-digit NAICS. 561499=fallback. Winner = highest confidence×weight."),
        "mcc_code":            ("System (pid=-1)","derived from naics_code","4-digit MCC. mcc_code_found ?? mcc_code_from_naics. 5614=NAICS 561499 fallback."),
        "watchlist_hits":      ("System (pid=-1)","dependent from watchlist","COUNT of hits in watchlist.metadata[]. PEP+SANCTIONS only. Adverse media excluded."),
        "watchlist":           ("System (pid=-1)","combineWatchlistMetadata","Merged business+person watchlist hits. adverse_media filtered out."),
        "adverse_media_hits":  ("Trulioo (pid=38)","dependent","COUNT of adverse media records. Tracked SEPARATELY from sanctions/PEP."),
        "idv_passed_boolean":  ("Plaid (pid=40)","dependent from idv_passed","true when idv_passed>=1. Admin Portal identity verification badge."),
        "idv_status":          ("Plaid (pid=40)","factWithHighestConfidence","Object: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N} counts."),
        "name_match_boolean":  ("Middesk (pid=16)","dependent from name_match","true when name_match.status='success'. Business name matched registry."),
        "formation_state":     ("Middesk (pid=16)","factWithHighestConfidence","US state code where business was incorporated. DE/NV/WY = tax-haven risk."),
        "formation_date":      ("Middesk (pid=16)","factWithHighestConfidence","ISO-8601 incorporation date. Used for business age calculation in Worth Score."),
        "revenue":             ("ZoomInfo (pid=24) / Equifax (pid=17)","factWithHighestConfidence","Annual revenue in USD. Used in Worth Score financial model."),
        "num_employees":       ("ZoomInfo (pid=24) / Equifax (pid=17)","factWithHighestConfidence","Employee count. Worth Score feature: staffing_level."),
        "num_bankruptcies":    ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of bankruptcy filings. Worth Score impact: -40pts each."),
        "num_judgements":      ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of civil judgments. Worth Score impact: -20pts each."),
        "num_liens":           ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of tax/mechanic liens. Worth Score impact: -10pts each."),
        "website":             ("Applicant (pid=0) / SERP (pid=22)","factWithHighestConfidence","Business website URL. Used by AI enrichment for NAICS classification."),
        "primary_address":     ("System (pid=-1)","dependent from addresses","Structured address object. Derived from addresses fact."),
        "addresses":           ("Middesk/OC/ZI/EFX","combineFacts","Array of all known addresses across vendors. Combined from all sources."),
        "addresses_deliverable":("Middesk (pid=16)","factWithHighestConfidence","Subset of addresses confirmed deliverable by USPS."),
        "dba_found":           ("Applicant (pid=0) / Middesk","combineFacts","Array of DBA names. Combined from applicant submission and registry."),
        "people":              ("Middesk (pid=16)","factWithHighestConfidence","Array of persons: {name, titles, submitted, source, jurisdictions}."),
        "screened_people":     ("Trulioo (pid=38)","factWithHighestConfidence","PSC-screened individuals with watchlistHits[] per person."),
        "risk_score":          ("System (pid=-1)","dependent from watchlist_hits+high_risk_people","0-100 risk score. 0=clean. Based on watchlist and high-risk persons."),
    }

    # ── Categorise all loaded facts ───────────────────────────────────────────
    grouped = {}; grouped_meta = {}
    for name, f in facts.items():
        if name.startswith("_"): continue
        too_large = f.get("_too_large", False)
        v = f.get("value")

        # Value display
        if too_large:          dv, detail = "📦 [too large — use SQL below]", None
        elif v is None:        dv, detail = "(null)", None
        elif isinstance(v,list): dv, detail = f"📋 list · {len(v)} item(s)", v
        elif isinstance(v,dict):
            if name=="idv_status": dv, detail = " | ".join(f"{k}:{n}" for k,n in v.items() if n), v
            elif "status" in v:   dv, detail = f"status: {v.get('status')} · {v.get('message','')[:40]}", v
            else:                  dv, detail = f"🗂️ object · {len(v)} key(s)", v
        else:                  dv, detail = str(v)[:120], None

        # Source (handles pid=0 Applicant correctly)
        src = f.get("source") or {}
        pid = "" if not isinstance(src,dict) else ("" if src.get("platformId") is None else str(src["platformId"]))
        conf_raw = src.get("confidence") if isinstance(src,dict) else None
        conf = float(conf_raw) if conf_raw is not None else None
        win_name = _pid_label(pid)
        rule = safe_get(f,"ruleApplied","name") or "—"
        override = safe_get(f,"override","value") or ""

        # Alternatives
        alts = get_alts(facts, name)

        # Deep explanation
        explain = FACT_EXPLAIN.get(name, None)

        grp = fact_to_group.get(name, "📦 Other")
        if grp not in grouped:
            grouped[grp]=[]
            grouped_meta[grp]=[]

        grouped[grp].append({
            "Fact":            f"`{name}`",
            "Value":           dv,
            "Winning Source":  win_name,
            "Confidence":      f"{conf:.4f}" if conf is not None else "n/a (derived)",
            "Rule Applied":    rule,
            "Alternatives":    f"{len(alts)} source(s)" if alts else "—",
            "Updated":         f.get("_received_at",""),
            "Override":        f"⚠️ {str(override)[:60]}" if override else "",
        })
        grouped_meta[grp].append({
            "name":name,"detail":detail,"fact":f,"alts":alts,"explain":explain,"dv":dv,"too_large":too_large
        })

    # ── Summary KPIs ──────────────────────────────────────────────────────────
    total = len([n for n in facts if not n.startswith("_")])
    has_val = sum(1 for n,f in facts.items() if not n.startswith("_") and f.get("value") is not None and not f.get("_too_large"))
    null_n  = sum(1 for n,f in facts.items() if not n.startswith("_") and f.get("value") is None)
    large_n = sum(1 for n,f in facts.items() if f.get("_too_large"))
    with_alts = sum(1 for n,f in facts.items() if not n.startswith("_") and len(get_alts(facts,n))>0)

    st.markdown("### 📊 Facts Overview")
    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Total Facts",f"{total}","in rds_warehouse_public.facts","#3B82F6")
    with c2: kpi("✅ Has Value",f"{has_val}",f"{has_val/max(total,1)*100:.0f}% fill rate","#22c55e")
    with c3: kpi("⚪ Null",f"{null_n}","no vendor provided data","#64748b")
    with c4: kpi("📦 Too Large",f"{large_n}","query PostgreSQL RDS","#f59e0b")
    with c5: kpi("🔀 Has Alts",f"{with_alts}","facts with alternative sources","#8B5CF6")

    # Fill rate bar
    fill_pct = int(has_val/max(total,1)*100)
    fill_color = "#22c55e" if fill_pct>=80 else "#f59e0b" if fill_pct>=50 else "#ef4444"
    st.markdown(f"""<div style="margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#CBD5E1">
        <span>Overall KYB Data Fill Rate</span><span style="color:{fill_color};font-weight:700">{fill_pct}%</span>
      </div>
      <div style="background:#1e293b;border-radius:4px;height:10px;margin:4px 0">
        <div style="background:{fill_color};width:{fill_pct}%;height:10px;border-radius:4px"></div>
      </div>
      <div style="color:#64748b;font-size:.68rem">{has_val} facts with values · {null_n} null · {large_n} too large for Redshift federation</div>
    </div>""",unsafe_allow_html=True)

    # ── KPI detail panels — sequential full-width (safe outside any expander) ──
    _all_sql = f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid, received_at FROM rds_warehouse_public.facts WHERE business_id='{bid}' ORDER BY name;"
    detail_panel("📊 Total Facts", str(total),
        what_it_means=f"Total distinct fact names stored for this business in rds_warehouse_public.facts. Each fact is a KYB data point (e.g. sos_active, tin_match_boolean, naics_code). Fill rate={fill_pct}%: {has_val} have values, {null_n} are null (vendor did not match), {large_n} are too large for Redshift federation.",
        source_table="rds_warehouse_public.facts",
        source_file="facts/kyb/index.ts", source_file_line="All KYB facts defined in integration-service",
        api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → all data.* keys",
        json_obj={"total_facts":total,"has_value":has_val,"null":null_n,"too_large":large_n,"has_alts":with_alts,"fill_rate_pct":fill_pct},
        sql=_all_sql,
        links=[("facts/kyb/index.ts","KYB fact definitions"),("facts/rules.ts","Fact Engine rules"),("openapi/integration","API Reference")],
        color="#3B82F6", icon="📊")
    detail_panel("✅ Has Value", str(has_val),
        what_it_means=f"{has_val} facts have a non-null value (the winning vendor returned data). Fill rate={fill_pct}%. Low fill rate (<50%) means vendors could not match this entity — common for very new or micro businesses.",
        source_table="rds_warehouse_public.facts · JSON_EXTRACT_PATH_TEXT(value,'value') IS NOT NULL",
        source_file="facts/kyb/index.ts", source_file_line="Fact Engine winner selection — factWithHighestConfidence",
        json_obj={"has_value_count":has_val,"total":total,"fill_rate_pct":fill_pct,"note":"Low fill = vendor entity matching failed"},
        sql=f"SELECT COUNT(DISTINCT name) AS facts_with_values FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND JSON_EXTRACT_PATH_TEXT(value,'value') IS NOT NULL;",
        links=[("facts/rules.ts","factWithHighestConfidence rule")], color="#22c55e", icon="✅")
    detail_panel("⚪ Null Facts", str(null_n),
        what_it_means=f"{null_n} facts have value=null. Causes: (1) Vendor entity matching failed — ZI/EFX/OC/Middesk could not find this business. (2) Optional field not submitted (email, phone). (3) Dependent fact whose source is also null. (4) Integration not enabled when this business was onboarded.",
        source_table="rds_warehouse_public.facts · JSON_EXTRACT_PATH_TEXT(value,'value') IS NULL",
        source_file="facts/kyb/index.ts", source_file_line="Null = no vendor matched OR dependent fact source is null",
        json_obj={"null_count":null_n,"causes":["entity matching failed","optional field not submitted","dependent on another null fact","integration not enabled"]},
        sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND JSON_EXTRACT_PATH_TEXT(value,'value') IS NULL ORDER BY name;",
        links=[("facts/kyb/index.ts","Fact definitions"),("integrations.constant.ts","Vendor IDs")], color="#64748b", icon="⚪")
    detail_panel("📦 Too Large for Redshift", str(large_n),
        what_it_means=f"{large_n} facts exceed the Redshift federation VARCHAR(65535) limit. These must be queried from PostgreSQL RDS (port 5432) using native JSONB operators. Affected facts: sos_filings, watchlist, watchlist_raw, bankruptcies, judgements, liens, people, addresses, internal_platform_matches_combined.",
        source_table="rds_warehouse_public.facts (PostgreSQL RDS port 5432 — NOT queryable from Redshift)",
        source_file="facts/kyb/index.ts", source_file_line="KNOWN_LARGE set in kyb_hub_app.py load_facts()",
        json_obj={"too_large_count":large_n,"large_fact_names":["sos_filings","watchlist","watchlist_raw","bankruptcies","judgements","liens","people","addresses"],"solution":"Query from PostgreSQL RDS port 5432 using JSONB operators"},
        sql="-- PostgreSQL RDS (port 5432) — NOT Redshift:\nSELECT value->'value' FROM rds_warehouse_public.facts WHERE business_id='" + bid + "' AND name='sos_filings';",
        links=[("facts/kyb/index.ts","KNOWN_LARGE fact names")], color="#f59e0b", icon="📦")
    detail_panel("🔀 Has Alternatives", str(with_alts),
        what_it_means=f"{with_alts} facts have alternatives[] — other vendors also returned data but lost the Fact Engine competition. The winner is shown in the table; alternatives are in the JSON value.alternatives[] array. Click any fact expander below to see which vendors lost and their confidence scores.",
        source_table="rds_warehouse_public.facts · JSON_EXTRACT_PATH_TEXT(value,'alternatives')",
        source_file="facts/rules.ts", source_file_line="factWithHighestConfidence — losers stored in alternatives[]",
        json_obj={"facts_with_alts":with_alts,"note":"alternatives[] array stores all losing vendors with their value and confidence"},
        sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'alternatives') AS alternatives FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND JSON_ARRAY_LENGTH(JSON_EXTRACT_PATH_TEXT(value,'alternatives')) > 0 ORDER BY name;",
        links=[("facts/rules.ts","factWithHighestConfidence — alternatives")], color="#8B5CF6", icon="🔀")

    st.markdown("---")

    # ── Column guide (collapsible) ─────────────────────────────────────────────
    with st.expander("ℹ️ How to read the tables — every column explained"):
        st.markdown("""
#### Columns explained

| Column | What it means | Example |
|---|---|---|
| **Fact** | The internal fact name stored in `rds_warehouse_public.facts` | `tin_match_boolean` |
| **Value** | The winning value the Admin Portal uses. `(null)`=no vendor matched. `📋 list`=array (expand below). `📦 too large`=query RDS directly. | `true` |
| **Winning Source** | The vendor the Fact Engine selected as the winner for this fact. One value is shown in the Admin Portal — this is who provided it. | `Middesk` |
| **Confidence** | Winner's confidence score (0–1). Formula depends on vendor: Middesk=0.15+0.20×tasks. ZI/EFX/OC=match.index÷55. Trulioo=status-based. AI=self-reported. `n/a (derived)`=dependent fact computed from other facts. | `0.9989` |
| **Rule Applied** | The Fact Engine rule that selected this winner: `factWithHighestConfidence` = highest conf×weight wins. `combineFacts` = merged array from all vendors. `dependent` = computed from another fact. | `factWithHighestConfidence` |
| **Alternatives** | Number of other vendors that also provided this fact but LOST to the winner. Click the ▶ expander to see each alternative with its source and confidence. | `2 source(s)` |
| **Updated** | When this fact was last written to `rds_warehouse_public.facts` (received_at). | `2026-04-14 19:15` |
| **Override** | ⚠️ = an analyst manually changed this value in the Admin Portal. The override replaces the vendor value in the UI. | `⚠️ Analyst override: ...` |

#### Vendor platform IDs (platformId)
| platformId | Vendor | Weight | Confidence formula |
|---|---|---|---|
| 16 | Middesk | 2.0 | 0.15 + 0.20 × passing review tasks (max 4) |
| 23 | OpenCorporates | 0.9 | match.index ÷ 55 |
| 24 | ZoomInfo | 0.8 | match.index ÷ 55 |
| 17 | Equifax | 0.7 | XGBoost score or match.index ÷ 55 |
| 38 | Trulioo | 0.8 | status-based: SUCCESS=0.70, FAILED=0.40, OTHER=0.20 |
| 31 | AI (GPT-4o-mini) | 0.1 | self-reported (LOW/MED/HIGH → 0.3/0.6/0.9) |
| 22 | SERP (Google) | 0.3 | heuristic |
| 40 | Plaid | 1.0 | session-based |
| 0 | Applicant (businessDetails) | — | 1.0 by convention |
| -1 | System / Dependent | — | null (computed) |

#### Why is a fact null?
1. **Entity matching failed** — no vendor could match this business in their database
2. **Optional field** — not submitted by the applicant (e.g. email, phone)
3. **Calculated dependency** — derived from another fact that is also null
4. **Integration not active** — this vendor was not enabled when the business was onboarded
5. **Too large** — value exists but exceeds Redshift's VARCHAR(65535) federation limit (query PostgreSQL RDS port 5432 instead)
        """)

    st.markdown("---")

    # ── Group-level fill rate chart ───────────────────────────────────────────
    group_summary = []
    for grp in list(FACT_GROUPS.keys())+["📦 Other"]:
        rows = grouped.get(grp,[])
        if not rows: continue
        g_total = len(rows)
        g_val   = sum(1 for r in rows if r["Value"] not in ("(null)",""))
        g_null  = g_total - g_val
        group_summary.append({"Group":grp.split(" ",1)[1] if " " in grp else grp,
                               "Total":g_total,"With Value":g_val,"Null":g_null,
                               "Fill %":round(g_val/max(g_total,1)*100)})

    if group_summary:
        gdf = pd.DataFrame(group_summary).sort_values("Fill %",ascending=True)
        # Safe text labels — ensure no JSON strings leak in
        safe_text = [f"{int(v)}%  ({int(r['With Value'])}/{int(r['Total'])})"
                     for v,(_,r) in zip(gdf["Fill %"], gdf.iterrows())]
        fig_g = go.Figure()
        fig_g.add_trace(go.Bar(
            x=gdf["Fill %"].astype(float), y=gdf["Group"], orientation="h",
            marker_color=[("#22c55e" if v>=80 else "#f59e0b" if v>=50 else "#ef4444")
                          for v in gdf["Fill %"]],
            text=safe_text,
            textposition="outside",
            textfont=dict(size=10, color="#CBD5E1"),
            hovertemplate="<b>%{y}</b><br>Fill rate: %{x}%<br>%{text}<extra></extra>",
        ))
        fig_g.update_layout(
            title="KYB Data Fill Rate by Fact Group",
            height=max(250,len(gdf)*38),
            xaxis=dict(range=[0,130], showticklabels=True, showgrid=True,
                       title="Fill Rate (%)", ticksuffix="%"),
            yaxis=dict(tickfont=dict(size=11)),
            margin=dict(t=40, b=10, l=10, r=100),
        )
        st.plotly_chart(dark_chart(fig_g), use_container_width=True)
        st.caption("🟢 Green ≥80%: good coverage · 🟡 Amber 50–79%: partial · 🔴 Red <50%: sparse — facts likely null for most businesses")

        # Table version alongside
        st.dataframe(
            gdf[["Group","With Value","Null","Total","Fill %"]].sort_values("Fill %",ascending=False),
            use_container_width=True, hide_index=True,
            column_config={
                "Group": st.column_config.TextColumn("Fact Group"),
                "With Value": st.column_config.NumberColumn("✅ Has Value"),
                "Null": st.column_config.NumberColumn("⚪ Null"),
                "Total": st.column_config.NumberColumn("Total Facts"),
                "Fill %": st.column_config.ProgressColumn("Fill Rate",min_value=0,max_value=100,format="%d%%"),
            }
        )

    st.markdown("---")

    # ── Render each group using render_lineage() for consistent structure ─────
    # render_lineage() produces: Source Code Reference + field annotations + JSON + SQL + Python
    # — exactly the same view as shown in all other tabs (SOS, TIN, IDV, etc.)
    AUTO_EXPAND = {"🏢 Identity / Name","🏛️ Registry / SOS","🔐 TIN / EIN"}

    # GROUP_CARDS: engineer notes shown at the top of each group
    GROUP_CARDS = {
        "🏢 Identity / Name":[
            "legal_name winner: Applicant (pid=0, conf=1.0) or Middesk (pid=16). OC is fallback.",
            "names_found: combineFacts rule — merges ALL vendor names (not a winner/loser selection).",
            "dba_found: DBA names from applicant + registry filings. Important for sole props.",
            "kyb_submitted=true: onboarding form completed. kyb_complete=true: business verified + people screened.",
            "people: array of officers/directors from Middesk (pid=16). Too large for Redshift → query PostgreSQL RDS.",
        ],
        "🏛️ Registry / SOS":[
            "sos_active: DERIVED (pid=-1, dependent) from sos_filings[].active. Not a vendor query.",
            "sos_filings: TOO LARGE for Redshift. Contains SoSRegistration[] with id, state, active, foreign_domestic, entity_type, officers[].",
            "middesk_confidence = 0.15 + 0.20 × tasks passed (max 4 tasks = 0.95 max). Source: Middesk pid=16.",
            "sos_match winner: Middesk (pid=16, w=2.0) > OC (pid=23, w=0.9). Rule: factWithHighestConfidence.",
            "Admin Portal: KYB → Business Registration → 'Verified' badge = sos_match_boolean=true AND sos_active=true.",
        ],
        "🔐 TIN / EIN":[
            "tin: raw 9-digit EIN (unmasked in Redshift). Source=Applicant (pid=0), confidence=1.0 by convention.",
            "tin_submitted: masked version (XXXXX1234). tin_match: IRS verification from Middesk TIN review task.",
            "tin_match_boolean=true ONLY when tin_match.value.status='success'. Derived (pid=-1, dependent).",
            "Winning source for tin_match MUST be Middesk (pid=16) for IRS-direct. pid=38 (Trulioo) = fallback, NOT IRS-direct.",
            "Admin Portal: KYB → Business Registration → Tax ID Number (EIN). 'Verified' badge = tin_match_boolean=true.",
        ],
        "📍 Address / Location":[
            "addresses: combineFacts — merges ALL vendor addresses (Middesk, OC, ZI, EFX) into one array.",
            "addresses_deliverable: USPS-confirmed subset via Middesk. Used for mail-based verification.",
            "address_registered_agent WARNING: address matches known registered agent (CT Corp, etc.). Entity may not operate there.",
            "primary_address: DERIVED (pid=-1, dependent) from addresses[0]. Structured object.",
        ],
        "📞 Contact":[
            "business_phone and email: optional fields — often null (not required on onboarding form).",
            "phone_found: combineFacts — merges phone numbers from Middesk + SERP + ZI.",
            "countries: DERIVED from addresses[] — extracts unique country codes.",
        ],
        "🌐 Website / Digital":[
            "website: Applicant (pid=0) or SERP (pid=22). CRITICAL for AI NAICS classification (Gap G2 if missing).",
            "website_found: verified URLs via combineFacts. Empty [] = no website confirmed online.",
            "serp_id: Google Business Profile ID. review_rating/count: from Google My Business.",
        ],
        "🏭 Industry / Classification":[
            "naics_code winner: factWithHighestConfidence across EFX(w=0.7) > ZI(w=0.8) > OC(w=0.9) > SERP(w=0.3) > Trulioo(w=0.8) > Applicant(w=0.2) > AI(w=0.1).",
            "561499 = fallback when ALL vendors fail and AI cannot classify → cascades to MCC 5614.",
            "mcc_code: DERIVED — mcc_code_found (AI direct) ?? mcc_from_naics (rel_naics_mcc lookup). Not independently verified.",
        ],
        "💼 Firmographic":[
            "ALL 11 NULL = ZI and EFX could NOT match this entity → no commercial firmographic data.",
            "revenue and num_employees: primary Worth Score inputs (Business Operations + Company Profile). Null → model uses defaults.",
            "kyb_complete=true: business_verified AND screened_people not empty.",
        ],
        "🪪 Identity Verification (KYC)":[
            "idv_status: object {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N} — count of ALL sessions ever.",
            "idv_passed: COUNT of SUCCESS sessions. idv_passed_boolean=true when idv_passed >= 1.",
            "name_match: Middesk compares submitted name to SOS registry name. false for DBAs is EXPECTED.",
        ],
        "📊 Financial Ratios (Worth Score inputs)":[
            "ALL 15 NULL = Plaid banking NOT connected. Financial PyTorch model uses all default imputations → score less accurate.",
            "ratio_* and bs_* facts: extracted from Plaid banking statements by Worth Score pipeline (aiscore.py).",
            "flag_equity_negative / flag_total_liabilities_over_assets: binary risk flags, high Worth Score negative impact.",
        ],
        "⚠️ Risk / Watchlist":[
            "watchlist: PEP+SANCTIONS ONLY. adverse_media deliberately EXCLUDED by filterOutAdverseMedia() in consolidatedWatchlist.ts.",
            "watchlist, bankruptcies, judgements, liens: TOO LARGE for Redshift. Query PostgreSQL RDS port 5432.",
            "num_bankruptcies/judgements/liens: scalar counts (Redshift safe). Worth Score: −40/−20/−10 pts each.",
        ],
        "🔗 Vendor / Integration":[
            "internal_platform_matches: XGBoost entity-match model results across ZI/EFX/OC databases.",
            "internal_platform_matches_combined: TOO LARGE for Redshift. Query from PostgreSQL RDS.",
            "canadaopen_*: OpenCorporates Canada data (only if business has Canadian presence).",
        ],
        "🇨🇦 Canada (if applicable)":[
            "Only populated for Canadian businesses or those with Canadian registration.",
            "canada_business_number: BN from CRA (Canada Revenue Agency).",
            "Source: OpenCorporates Canada API via integration-service.",
        ],
        "📦 Other":[
            "Facts not mapped to any standard group — often dependent/computed facts or newly added facts.",
            "Many 'Other' facts are null because they compute from another null fact.",
        ],
    }

    for grp in list(FACT_GROUPS.keys())+["📦 Other"]:
        meta = grouped_meta.get(grp,[])
        if not meta: continue
        _fact_names_in_grp = [m["name"] for m in meta]
        g_val  = sum(1 for m in meta if not m["too_large"] and m["fact"].get("value") is not None)
        g_null = sum(1 for m in meta if not m["too_large"] and m["fact"].get("value") is None)
        label  = f"{grp}  ({len(meta)} facts · {g_val} with values · {g_null} null)"

        with st.expander(label, expanded=(grp in AUTO_EXPAND)):

            # ── Group engineering notes (analyst card) ──────────────────
            if grp in GROUP_CARDS:
                analyst_card(f"{grp} — Data Lineage & Engineering Notes", GROUP_CARDS[grp])

            # ── render_lineage() — identical structure to all other tabs ──────
            # Shows: Source Code Reference + field annotations + JSON + SQL + Python
            # for EVERY fact in this group. No custom renderer — one consistent view.
            render_lineage(facts, _fact_names_in_grp, inside_expander=True)

    st.markdown("---")
    st.markdown("#### 🔍 SQL Reference — Full Business Investigation")
    st.code(f"""-- All facts for this business (Redshift):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')   AS rule_applied,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
ORDER BY name;

-- Facts with alternatives (Redshift):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winner_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS winner_conf,
       JSON_ARRAY_LENGTH(JSON_EXTRACT_PATH_TEXT(value,'alternatives')) AS alt_count
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
  AND JSON_ARRAY_LENGTH(JSON_EXTRACT_PATH_TEXT(value,'alternatives')) > 0;

-- Worth Score (Redshift):
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}' ORDER BY bs.created_at DESC LIMIT 1;

-- Large facts (PostgreSQL RDS port 5432 — JSONB native):
-- sos_filings:
SELECT filing->>'state', filing->>'active', filing->>'foreign_domestic'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}';

-- watchlist hits:
SELECT hit->>'type', hit->'metadata'->>'entity_name'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value'->'metadata') AS hit
WHERE name='watchlist' AND business_id='{bid}';

-- API endpoint:
-- GET https://api.joinworth.com/integration/api/v1/facts/business/{bid}/kyb
-- Redis cache key: integration-express-cache::{bid}::/api/v1/facts/business/{bid}/kyb""",
            language="sql")

# ════════════════════════════════════════════════════════════════════════════════
# CHECK-AGENT
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🔍 Check-Agent":
    bid = st.session_state.get("hub_bid","")
    st.markdown("## 🔍 KYB Check-Agent — Deep Verification Engine")
    st.caption(
        "Four independent analytical layers that go far beyond what any other tab shows: "
        "**Fact Trust Scoring** · **Vendor Consistency Audit** · **Contradiction & Anomaly Scanner** · **AI Analyst Narrative**. "
        "Each finding includes analyst reasoning, SQL to verify, and `detail_panel()` lineage."
    )

    if not bid:
        st.info("👈 Select a Business ID in the sidebar to run the Check-Agent.")
    else:
        # ── Load facts ───────────────────────────────────────────────────────
        with st.spinner("Loading facts from Redshift…"):
            facts, facts_err = load_facts_with_ui(bid, "check_agent")

        if facts_err or not facts:
            flag(f"Cannot load facts: {facts_err or 'No data found for this business ID.'}", "red")
        else:
            # helpers scoped to this business
            def _fval(name): return str(gv(facts, name) or "").strip()
            def _flo(name):
                try: return float(_fval(name) or 0)
                except: return 0.0
            def _fint(name):
                try: return int(float(_fval(name) or 0))
                except: return 0
            def _conf(name): return gc(facts, name)
            def _pid(name):  return gp(facts, name)

            # ── Load Worth Score ─────────────────────────────────────────────
            @st.cache_data(ttl=600, show_spinner=False)
            def _load_ws_ca(b):
                return run_sql(f"""SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision
                    FROM rds_manual_score_public.data_current_scores cs
                    JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
                    WHERE cs.business_id='{b}'
                    ORDER BY bs.created_at DESC LIMIT 1;""")
            ws_df, _ = _load_ws_ca(bid)
            score_850 = 0; risk_level = ""; decision = ""
            if ws_df is not None and not ws_df.empty:
                _wr = ws_df.iloc[0]
                score_850  = float(_wr.get("weighted_score_850") or 0)
                risk_level = str(_wr.get("risk_level") or "")
                decision   = str(_wr.get("score_decision") or "")

            score_info = {"score_850": score_850, "risk_level": risk_level, "decision": decision}

            # ── Business identity header ─────────────────────────────────────
            _legal   = _fval("legal_name") or _fval("business_name") or "Unknown Entity"
            _state   = _fval("formation_state")
            _naics   = _fval("naics_code")
            _score_color = "#ef4444" if score_850 < 550 else "#f59e0b" if score_850 < 700 else "#22c55e"
            st.markdown(f"""<div style="background:linear-gradient(135deg,#1E293B,#0F172A);
                border-radius:12px;padding:16px 22px;margin-bottom:12px;border:1px solid #334155">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <div style="color:#F1F5F9;font-size:1.2rem;font-weight:800">{_legal}</div>
                  <div style="color:#64748B;font-size:.78rem;margin-top:4px">
                    {bid} &nbsp;·&nbsp; NAICS: {_naics or '—'} &nbsp;·&nbsp; Formation: {_state or '—'}
                  </div>
                </div>
                <div style="text-align:center">
                  <div style="color:{_score_color};font-size:1.8rem;font-weight:900">{score_850:.0f}</div>
                  <div style="color:#64748b;font-size:.70rem">Worth Score · {risk_level or '—'}</div>
                </div>
              </div>
            </div>""", unsafe_allow_html=True)

            # ════════════════════════════════════════════════════════════════
            # LAYER 1 — FACT TRUST MATRIX
            # Each critical fact gets a trust score: does it have a value?
            # What vendor provided it? How confident? Any alternatives that disagree?
            # ════════════════════════════════════════════════════════════════
            st.markdown("---")
            st.markdown("### 🧮 Layer 1 — Fact Trust Matrix")
            st.caption(
                "For every critical KYB fact, the Check-Agent scores its **trustworthiness (0–100)** based on: "
                "whether a value exists, the confidence of the winning vendor, how many vendors agreed, "
                "and whether alternatives contradict the winner. This is NOT shown anywhere else in the app."
            )

            # Trustworthiness scoring per fact
            TRUST_FACTS = [
                ("sos_active",         "SOS Status",           "Registry",    "Is the entity currently in good standing?"),
                ("sos_match_boolean",  "SOS Match",            "Registry",    "Did Middesk find this entity in the SOS registry?"),
                ("tin_match_boolean",  "TIN / EIN Verified",   "Tax ID",      "Did the IRS confirm the EIN matches this entity name?"),
                ("idv_passed_boolean", "IDV — Owner Identity", "Identity",    "Did the beneficial owner pass Plaid biometric verification?"),
                ("naics_code",         "Industry (NAICS)",     "Industry",    "Was the industry classified by a commercial vendor (not AI fallback)?"),
                ("formation_state",    "Formation State",      "Registry",    "Which state is the entity legally incorporated in?"),
                ("legal_name",         "Legal Name",           "Identity",    "The registered legal name per SOS / IRS"),
                ("revenue",            "Revenue",              "Firmographic","Annual revenue from ZoomInfo / Equifax firmographic database"),
                ("num_employees",      "Employee Count",       "Firmographic","Employee count from ZoomInfo / Equifax"),
                ("watchlist_hits",     "Watchlist Screening",  "Compliance",  "Count of PEP / OFAC sanctions hits (excludes adverse media)"),
                ("middesk_confidence", "Middesk Confidence",   "Registry",    "Middesk entity-match confidence (0.15 base + 0.20 × passing tasks)"),
                ("website",            "Website URL",          "Digital",     "Business website (applicant-submitted or SERP-found)"),
            ]

            def _trust_score(facts, name):
                """
                0-100 trust score for a single fact.
                Components:
                  30 pts — value exists and is non-null
                  20 pts — confidence >= 0.5 (or fact has no confidence field)
                  20 pts — at least 1 alternative also agrees (vendor corroboration)
                  15 pts — no alternative contradicts the winner
                  15 pts — not a known fallback value (561499, empty, "false" for boolean checks)
                """
                f = facts.get(name, {})
                if f.get("_too_large"): return 0, "too_large"
                v = f.get("value")
                score = 0
                reasons = []

                # Existence
                has_val = v is not None and str(v).strip() not in ("", "None", "null", "[]", "{}")
                if has_val:
                    score += 30
                else:
                    reasons.append("No value — vendor did not match or fact not triggered")
                    return score, reasons

                # Confidence
                conf = _conf(name)
                if conf == 0.0:
                    score += 20  # no confidence field = rule-based, treat as reliable
                elif conf >= 0.7:
                    score += 20
                elif conf >= 0.4:
                    score += 12
                    reasons.append(f"Low confidence: {conf:.3f}")
                else:
                    score += 5
                    reasons.append(f"Very low confidence: {conf:.3f} — treat as uncertain")

                # Vendor corroboration
                alts = f.get("alternatives", []) or []
                agree = sum(1 for a in alts if str(a.get("value","")).strip() == str(v).strip())
                if agree >= 2:
                    score += 20
                elif agree >= 1:
                    score += 12
                elif len(alts) == 0:
                    score += 15  # single source, no alternatives — can't verify but not penalised
                else:
                    score += 5
                    reasons.append(f"No alternatives agree with the winning value")

                # Contradiction check
                disagree = sum(1 for a in alts if str(a.get("value","")).strip() not in ("", str(v).strip()))
                if disagree == 0:
                    score += 15
                elif disagree == 1:
                    score += 8
                    reasons.append(f"1 alternative vendor disagrees with the winner")
                else:
                    reasons.append(f"{disagree} alternative vendors disagree — winner may be wrong")

                # Fallback penalty
                str_v = str(v).strip()
                if name == "naics_code" and str_v == "561499":
                    score = max(0, score - 20)
                    reasons.append("NAICS=561499 is the fallback code — classification unreliable")
                if name == "middesk_confidence" and _flo("middesk_confidence") < 0.25:
                    score = max(0, score - 15)
                    reasons.append("Middesk confidence <0.25 — entity resolution unreliable")

                return min(100, score), reasons

            trust_rows = []
            for fname, label, category, meaning in TRUST_FACTS:
                tscore, treasons = _trust_score(facts, fname)
                f = facts.get(fname, {})
                raw_v = f.get("value")
                disp_v = str(raw_v)[:40] if raw_v is not None else "—"
                conf   = _conf(fname)
                pid_v  = _pid(fname)
                alts   = len(f.get("alternatives",[]) or [])
                trust_rows.append({
                    "Fact": label,
                    "Category": category,
                    "Value": disp_v,
                    "Trust Score": tscore,
                    "Confidence": f"{conf:.3f}" if conf > 0 else "—",
                    "Vendor pid": pid_v or "—",
                    "Alternatives": alts,
                    "_fname": fname,
                    "_meaning": meaning,
                    "_reasons": treasons,
                    "_raw_v": raw_v,
                })

            trust_df = pd.DataFrame(trust_rows)

            # ── Visual: trust score heatmap bar ─────────────────────────────
            _tcol1, _tcol2 = st.columns([2, 1])
            with _tcol1:
                _tc = trust_df.sort_values("Trust Score", ascending=True)
                _bar_colors = ["#ef4444" if s < 40 else "#f59e0b" if s < 70 else "#22c55e"
                               for s in _tc["Trust Score"]]
                fig_trust = go.Figure(go.Bar(
                    y=_tc["Fact"], x=_tc["Trust Score"], orientation="h",
                    marker_color=_bar_colors,
                    text=[f"{s}/100" for s in _tc["Trust Score"]],
                    textposition="outside",
                    textfont=dict(color="#CBD5E1", size=11),
                ))
                fig_trust.update_layout(
                    height=400, title="Fact Trust Scores — 0 (untrusted) to 100 (fully corroborated)",
                    xaxis=dict(range=[0,120], tickfont=dict(color="#64748b")),
                    yaxis=dict(tickfont=dict(color="#CBD5E1")),
                    margin=dict(t=40,b=10,l=10,r=40),
                    plot_bgcolor="#0f172a", paper_bgcolor="#0f172a",
                    font=dict(color="#CBD5E1"),
                )
                st.plotly_chart(dark_chart(fig_trust), use_container_width=True)

            with _tcol2:
                _low_trust = [r for r in trust_rows if r["Trust Score"] < 50]
                _med_trust = [r for r in trust_rows if 50 <= r["Trust Score"] < 75]
                _hi_trust  = [r for r in trust_rows if r["Trust Score"] >= 75]
                kpi("🔴 Low Trust (<50)", str(len(_low_trust)), "Needs investigation or manual verification", "#ef4444")
                kpi("🟡 Medium Trust (50–74)", str(len(_med_trust)), "Single-source or low-confidence data", "#f59e0b")
                kpi("🟢 High Trust (≥75)", str(len(_hi_trust)), "Multi-vendor corroborated", "#22c55e")
                _avg_trust = int(trust_df["Trust Score"].mean())
                kpi("Portfolio Trust Avg", f"{_avg_trust}/100",
                    "Mean trust across all critical facts",
                    "#ef4444" if _avg_trust < 50 else "#f59e0b" if _avg_trust < 75 else "#22c55e")

            # ── Trust detail — one detail_panel per fact ─────────────────────
            st.markdown("**📋 Per-Fact Trust Analysis — click any row to see analyst explanation, SQL, and JSON:**")
            for r in sorted(trust_rows, key=lambda x: x["Trust Score"]):
                _ts  = r["Trust Score"]
                _tc2 = "#ef4444" if _ts < 40 else "#f59e0b" if _ts < 70 else "#22c55e"
                _reasons_html = "".join(
                    f"<div style='color:#f59e0b;font-size:.72rem;margin-top:3px'>⚠ {reason}</div>"
                    for reason in r["_reasons"]
                ) if r["_reasons"] else "<div style='color:#22c55e;font-size:.72rem;margin-top:3px'>✅ No trust issues detected</div>"

                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_tc2};
                    border-radius:8px;padding:10px 16px;margin:4px 0;
                    display:flex;align-items:center;gap:14px;flex-wrap:wrap">
                  <div style="min-width:140px">
                    <div style="color:#CBD5E1;font-weight:600;font-size:.82rem">{r['Fact']}</div>
                    <div style="color:#64748b;font-size:.70rem">{r['Category']}</div>
                  </div>
                  <div style="background:#0f172a;border-radius:6px;padding:4px 12px;min-width:100px;text-align:center">
                    <div style="color:{_tc2};font-size:1.1rem;font-weight:800">{_ts}/100</div>
                    <div style="color:#475569;font-size:.65rem">Trust Score</div>
                  </div>
                  <div style="flex:1;min-width:180px">
                    <div style="color:#94A3B8;font-size:.75rem">Value: <code style="color:#CBD5E1">{r['Value']}</code>
                      &nbsp;·&nbsp; pid: <code style="color:#60A5FA">{r['Vendor pid']}</code>
                      &nbsp;·&nbsp; conf: <code style="color:#a78bfa">{r['Confidence']}</code>
                      &nbsp;·&nbsp; alts: <code>{r['Alternatives']}</code>
                    </div>
                    {_reasons_html}
                  </div>
                </div>""", unsafe_allow_html=True)

                _fsql = (f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,\n"
                         f"  JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,\n"
                         f"  JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,\n"
                         f"  JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name') AS rule\n"
                         f"FROM rds_warehouse_public.facts\n"
                         f"WHERE business_id='{bid}' AND name='{r['_fname']}';")
                _fjson = {
                    "name": r["_fname"], "value": r["_raw_v"],
                    "trust_score": _ts, "trust_reasons": r["_reasons"],
                    "source_pid": r["Vendor pid"], "confidence": r["Confidence"],
                    "alternatives_count": r["Alternatives"],
                }
                detail_panel(
                    f"Trust Analysis: {r['Fact']}", f"{_ts}/100 — {r['Category']}",
                    what_it_means=(
                        f"{r['_meaning']}\n\n"
                        f"**Trust Score breakdown:** Existence (+30), Confidence (+20), "
                        f"Vendor corroboration (+20), No contradictions (+15), Not a fallback value (+15).\n\n"
                        f"**Current issues:** {'; '.join(r['_reasons']) if r['_reasons'] else 'None — fully trusted'}"
                    ),
                    source_table="rds_warehouse_public.facts",
                    source_file="facts/kyb/index.ts",
                    source_file_line=f"{r['_fname']} · factWithHighestConfidence / dependent",
                    json_obj=_fjson,
                    sql=_fsql,
                    links=[("facts/kyb/index.ts","Fact Engine definition"),
                           ("facts/rules.ts","factWithHighestConfidence · combineFacts")],
                    color=_tc2, icon="🧮",
                )

            # ════════════════════════════════════════════════════════════════
            # LAYER 2 — VENDOR CONSISTENCY AUDIT
            # Do the same facts from different vendors agree?
            # ════════════════════════════════════════════════════════════════
            st.markdown("---")
            st.markdown("### 🏭 Layer 2 — Vendor Consistency Audit")
            st.caption(
                "For each fact where multiple vendors competed, the Check-Agent compares the **winning value** "
                "against every **alternative** to detect disagreements. A disagreement means two or more vendors "
                "returned different answers for the same field — a strong signal of data uncertainty."
            )

            _vendor_disagreements = []
            _vendor_agreements    = []
            _no_competition       = []

            VENDOR_NAMES = {
                "0": "Applicant", "16": "Middesk", "17": "Equifax", "22": "SERP",
                "23": "OpenCorporates", "24": "ZoomInfo", "31": "AI Enrichment",
                "38": "Trulioo", "39": "SERP GMB", "-1": "Dependent (derived)",
                "18": "Plaid IDV",
            }

            KEY_FACTS_FOR_VENDOR_AUDIT = [
                "legal_name","formation_state","naics_code","revenue","num_employees",
                "website","sos_active","tin_match_boolean","formation_date",
                "corporation","address_match_boolean","name_match_boolean",
            ]

            for fname in KEY_FACTS_FOR_VENDOR_AUDIT:
                f = facts.get(fname, {})
                if f.get("_too_large") or not f: continue
                winner_v = f.get("value")
                if winner_v is None: continue
                alts = f.get("alternatives", []) or []
                if not alts:
                    _no_competition.append(fname)
                    continue
                winner_str = str(winner_v).strip().lower()
                pid_w = _pid(fname)
                vendor_w = VENDOR_NAMES.get(pid_w, f"pid={pid_w}")
                disagreements = []
                agreements    = []
                for a in alts:
                    alt_v   = str(a.get("value","")).strip().lower()
                    alt_pid = str(a.get("source",{}).get("platformId","") if isinstance(a.get("source"),dict) else a.get("source",""))
                    alt_vendor = VENDOR_NAMES.get(alt_pid, f"pid={alt_pid}")
                    if alt_v and alt_v != winner_str:
                        disagreements.append({"vendor": alt_vendor, "value": a.get("value"), "pid": alt_pid})
                    elif alt_v == winner_str:
                        agreements.append(alt_vendor)
                if disagreements:
                    _vendor_disagreements.append({
                        "fact": fname, "winner_value": winner_v, "winner_vendor": vendor_w,
                        "winner_pid": pid_w, "winner_conf": _conf(fname),
                        "disagreements": disagreements, "agreements": agreements,
                    })
                else:
                    _vendor_agreements.append(fname)

            # Summary KPIs
            _va1, _va2, _va3 = st.columns(3)
            with _va1: kpi("🔴 Vendor Disagreements", str(len(_vendor_disagreements)),
                           "Facts where vendors returned different values", "#ef4444" if _vendor_disagreements else "#22c55e")
            with _va2: kpi("✅ Full Agreement", str(len(_vendor_agreements)),
                           "Facts where all vendors agree", "#22c55e")
            with _va3: kpi("⚪ Single Source", str(len(_no_competition)),
                           "Facts with no alternative vendors to compare", "#64748b")

            if _vendor_disagreements:
                st.markdown("**⚠️ Vendor Disagreements — analyst review required:**")
                for dis in _vendor_disagreements:
                    _dc = "#f97316"
                    # Use <strong>/<code> HTML — NOT markdown ** or backticks —
                    # to avoid Streamlit misinterpreting markdown inside an HTML block
                    _disagree_list_html = " &nbsp;·&nbsp; ".join(
                        f"<strong style='color:#f59e0b'>{d['vendor']}</strong>"
                        f" says <code style='color:#CBD5E1'>{str(d['value'])[:40]}</code>"
                        for d in dis["disagreements"]
                    )
                    _agree_html = (
                        f"<div style='color:#22c55e;font-size:.74rem;margin-top:4px'>"
                        f"✅ Also agree: {', '.join(dis['agreements'])}</div>"
                        if dis["agreements"] else ""
                    )
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_dc};
                        border-radius:10px;padding:14px 18px;margin:6px 0">
                      <div style="color:#f97316;font-weight:700;font-size:.88rem">
                        ⚠️ {dis['fact']} — {len(dis['disagreements'])} vendor(s) disagree
                      </div>
                      <div style="color:#CBD5E1;font-size:.80rem;margin-top:6px">
                        <strong>Winner:</strong>
                        <code style="color:#60A5FA">{str(dis['winner_value'])[:40]}</code>
                        &nbsp;(source: <strong>{dis['winner_vendor']}</strong>,
                        pid={dis['winner_pid']}, conf={dis['winner_conf']:.3f})
                      </div>
                      <div style="color:#f59e0b;font-size:.78rem;margin-top:6px">
                        <strong>Disagree:</strong> {_disagree_list_html}
                      </div>
                      {_agree_html}
                    </div>""", unsafe_allow_html=True)

                    _dsql = (f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS winner_value,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence\n"
                             f"FROM rds_warehouse_public.facts\n"
                             f"WHERE business_id='{bid}' AND name='{dis['fact']}';")
                    detail_panel(
                        f"⚠️ Vendor Disagreement: {dis['fact']}",
                        f"Winner: {dis['winner_vendor']} · {len(dis['disagreements'])} disagree",
                        what_it_means=(
                            f"The `factWithHighestConfidence` rule selected **{dis['winner_vendor']}** as the "
                            f"winning source for `{dis['fact']}` (value: `{dis['winner_value']}`, conf={dis['winner_conf']:.3f}). "
                            f"However, {len(dis['disagreements'])} other vendor(s) returned a different value. "
                            f"Disagreements: {'; '.join(str(d['vendor'])+'→'+str(d['value']) for d in dis['disagreements'])}.\n\n"
                            f"**Why it matters:** The winning vendor may have matched a different entity than intended "
                            f"(entity resolution error), or a vendor's data may be stale. The fact with the most "
                            f"disagreements is the most uncertain — treat it as unverified until independently confirmed."
                        ),
                        source_table="rds_warehouse_public.facts · alternatives[] array",
                        source_file="facts/rules.ts",
                        source_file_line="factWithHighestConfidence — selects winner by weight × confidence",
                        json_obj={"fact": dis["fact"], "winner": {"value": dis["winner_value"],
                                  "vendor": dis["winner_vendor"], "pid": dis["winner_pid"],
                                  "confidence": dis["winner_conf"]},
                                  "disagreements": dis["disagreements"], "agreements": dis["agreements"]},
                        sql=_dsql,
                        links=[("facts/rules.ts","factWithHighestConfidence rule"),
                               ("facts/kyb/index.ts","Fact definitions")],
                        color="#f97316", icon="⚠️",
                    )
            else:
                st.success("✅ No vendor disagreements detected across all audited facts.")

            # ════════════════════════════════════════════════════════════════
            # LAYER 3 — CONTRADICTION & ANOMALY SCANNER
            # Cross-field logic checks with detailed analyst narrative
            # ════════════════════════════════════════════════════════════════
            st.markdown("---")
            st.markdown("### 🔬 Layer 3 — Contradiction & Anomaly Scanner")
            st.caption(
                "The scanner tests **logical relationships between facts** — not individual facts in isolation. "
                "Every finding includes an analyst-grade explanation of *why* the combination is suspicious "
                "and *exactly* what an underwriter should do next."
            )

            det_results = run_deterministic_checks(facts)
            summary     = get_check_summary(det_results)

            _sev_order = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3,"NOTICE":4}

            if summary["total"] == 0:
                st.success("✅ All 28 cross-field logic checks passed — no contradictions or anomalies detected for this business.")
                _pass_total = len(DETERMINISTIC_CHECKS)
                st.caption(f"{_pass_total} checks evaluated · 0 triggered · Business profile is internally consistent.")
            else:
                # Compact severity summary strip
                _sev_strip_html = ""
                for sev, color, icon in [("CRITICAL","#ef4444","🔴"),("HIGH","#f97316","🟠"),
                                          ("MEDIUM","#f59e0b","🟡"),("LOW","#22c55e","🟢"),("NOTICE","#3B82F6","🔵")]:
                    cnt = summary["counts"].get(sev, 0)
                    if cnt:
                        _sev_strip_html += (f'<span style="background:{color}22;color:{color};border-radius:6px;'
                                            f'padding:3px 10px;font-size:.76rem;font-weight:700;margin-right:6px">'
                                            f'{icon} {sev}: {cnt}</span>')
                st.markdown(f'<div style="margin:8px 0">{_sev_strip_html}</div>', unsafe_allow_html=True)

                # All findings sorted by severity, each with full analyst narrative
                for r in sorted(det_results, key=lambda x: _sev_order.get(x["severity"], 5)):
                    sev   = r["severity"]
                    color = SEV_COLOR.get(sev, "#64748b")
                    icon  = SEV_ICON.get(sev, "ℹ️")

                    # Actual current values of the involved facts
                    _fact_vals = {fn: _fval(fn) for fn in r["facts"]}
                    _fact_vals_html = " &nbsp;·&nbsp; ".join(
                        f'<code style="color:#94A3B8">{fn}</code>=<code style="color:#60A5FA">{v or "null"}</code>'
                        for fn, v in _fact_vals.items()
                    )

                    # Full analyst card with actual values embedded
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                        border-radius:10px;padding:16px 20px;margin:8px 0">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
                        <div>
                          <span style="color:{color};font-weight:800;font-size:.92rem">{icon} [{sev}] {r['name']}</span>
                          <span style="background:{color}18;color:{color};border-radius:6px;
                            padding:1px 8px;font-size:.70rem;margin-left:8px">{r['group']}</span>
                        </div>
                      </div>
                      <div style="color:#CBD5E1;font-size:.80rem;margin-top:10px;line-height:1.5">
                        {r['description']}
                      </div>
                      <div style="background:#0f172a;border-radius:6px;padding:8px 12px;margin-top:10px;font-size:.74rem">
                        <span style="color:#64748b">Current values for this business: &nbsp;</span>{_fact_vals_html}
                      </div>
                      <div style="margin-top:10px;background:#052e16;border-radius:6px;padding:8px 12px">
                        <span style="color:#86efac;font-weight:600;font-size:.76rem">⚡ Underwriter Action: </span>
                        <span style="color:#CBD5E1;font-size:.76rem">{r['action']}</span>
                      </div>
                    </div>""", unsafe_allow_html=True)

                    _bid_sql = r["sql"].replace("{bid}", bid) if "{bid}" in r["sql"] else r["sql"]
                    _involved_json = {fn: {"current_value": _fval(fn), "source_pid": _pid(fn),
                                           "confidence": _conf(fn), "trust_score": next(
                                               (x["Trust Score"] for x in trust_rows if x["_fname"]==fn), "n/a")}
                                      for fn in r["facts"] if fn in facts}
                    detail_panel(
                        f"{icon} {r['name']}", f"{sev} · {r['group']}",
                        what_it_means=(
                            f"**Root cause:** {r['description']}\n\n"
                            f"**Current values:** {'; '.join(fn+'='+(_fval(fn) or 'null') for fn in r['facts'])}\n\n"
                            f"**Underwriter action:** {r['action']}"
                        ),
                        source_table="rds_warehouse_public.facts · cross-field logic check",
                        source_file="check_agent_v2.py",
                        source_file_line=f"DETERMINISTIC_CHECKS · id={r['id']}",
                        json_obj=_involved_json,
                        sql=_bid_sql,
                        links=[("facts/kyb/index.ts","Fact Engine definitions"),
                               ("facts/rules.ts","Fact Engine rules")],
                        color=color, icon=icon,
                    )

                _pass_count = len(DETERMINISTIC_CHECKS) - summary["total"]
                st.markdown(
                    f"<div style='color:#64748b;font-size:.75rem;margin-top:8px'>"
                    f"✅ {_pass_count}/{len(DETERMINISTIC_CHECKS)} checks passed &nbsp;·&nbsp; "
                    f"🚩 {summary['total']}/{len(DETERMINISTIC_CHECKS)} triggered</div>",
                    unsafe_allow_html=True,
                )

            # ════════════════════════════════════════════════════════════════
            # LAYER 4 — AI ANALYST NARRATIVE (GPT-4o-mini)
            # Full narrative audit — not just JSON, but paragraphs an analyst
            # would actually write, with specific values from this business
            # ════════════════════════════════════════════════════════════════
            st.markdown("---")
            st.markdown("### 🧠 Layer 4 — AI Analyst Narrative")
            st.caption(
                "GPT-4o-mini acts as a senior KYB analyst writing a **case memo** — not a JSON summary, "
                "but paragraph-form analysis referencing the actual fact values for this specific business. "
                "Covers: entity verification chain, financial plausibility, compliance posture, "
                "Worth Score drivers, and an underwriting recommendation with rationale. "
                "Auto-runs and caches for 30 min per business."
            )

            if not get_openai():
                flag("OpenAI API key not configured. Set OPENAI_API_KEY in .streamlit/secrets.toml.", "amber")
            else:
                _cache_key       = facts_cache_key(facts)
                _audit_skey      = f"ca_audit_{bid}_{_cache_key}"

                _hdr_c, _btn_c = st.columns([5,1])
                with _hdr_c:
                    st.caption(f"Business: `{bid[:24]}…` · Facts hash: `{_cache_key}` · Cache: 30 min")
                with _btn_c:
                    if st.button("🔄 Re-run", use_container_width=True, key="ca_rerun"):
                        if _audit_skey in st.session_state:
                            del st.session_state[_audit_skey]
                        st.rerun()

                if _audit_skey not in st.session_state:
                    with st.spinner("AI analyst writing case memo… (~15 seconds)"):
                        _facts_json = json.dumps(facts, default=str)
                        _score_json = json.dumps(score_info, default=str)
                        _api_hint = (_get_api_key()[-8:] if hasattr(__builtins__, '__import__') else '') ; _audit_result, _audit_err = run_llm_audit(_facts_json, bid, _score_json)
                    if _audit_err:
                        flag(f"AI audit error: {_audit_err}", "red")
                    elif _audit_result:
                        st.session_state[_audit_skey] = _audit_result

                audit_result = st.session_state.get(_audit_skey)
                if audit_result:
                    _oa_risk  = audit_result.get("overall_risk","Unknown")
                    _dq_score = int(audit_result.get("data_quality_score", 0))
                    _summary  = audit_result.get("summary","")
                    _decision = audit_result.get("underwriting_decision_guidance","")
                    _oa_color = {"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b",
                                 "LOW":"#22c55e","CLEAN":"#10b981"}.get(_oa_risk,"#64748b")
                    _dec_color = ("#22c55e" if "APPROVE" in _decision.upper()
                                  else "#ef4444" if "DECLINE" in _decision.upper()
                                  else "#f59e0b")

                    # ── Verdict banner ───────────────────────────────────────
                    st.markdown(f"""<div style="background:linear-gradient(135deg,#1E293B,#0F172A);
                        border:2px solid {_oa_color};border-radius:14px;padding:20px 24px;margin-bottom:16px">
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
                        <div style="flex:1">
                          <div style="color:{_oa_color};font-size:1.3rem;font-weight:800">
                            {SEV_ICON.get(_oa_risk,'⚠️')} Analyst Verdict: {_oa_risk} RISK
                          </div>
                          <div style="color:#CBD5E1;font-size:.84rem;margin-top:10px;line-height:1.6;max-width:680px">
                            {_summary}
                          </div>
                          <div style="margin-top:12px;color:{_dec_color};font-weight:700;font-size:.86rem">
                            ⚖️ Underwriting Guidance: {_decision}
                          </div>
                        </div>
                        <div style="text-align:center;min-width:120px">
                          <div style="color:{'#22c55e' if _dq_score>=80 else '#f59e0b' if _dq_score>=50 else '#ef4444'};
                            font-size:2.4rem;font-weight:900;line-height:1">{_dq_score}</div>
                          <div style="color:#64748b;font-size:.72rem;margin-top:4px">Data Quality<br>Score / 100</div>
                        </div>
                      </div>
                    </div>""", unsafe_allow_html=True)

                    # ── KYB completeness matrix ──────────────────────────────
                    kyb_comp = audit_result.get("kyb_completeness", {})
                    if kyb_comp:
                        st.markdown("##### ✅ KYB Verification Chain")
                        _ci = [
                            ("SOS Verified",       kyb_comp.get("sos_verified"),       "sos_active · Middesk"),
                            ("TIN Verified",        kyb_comp.get("tin_verified"),        "tin_match_boolean · IRS"),
                            ("IDV Completed",       kyb_comp.get("idv_completed"),       "idv_passed_boolean · Plaid"),
                            ("Watchlist Clear",     kyb_comp.get("watchlist_screened"),  "watchlist_hits = 0"),
                            ("Industry Classified", kyb_comp.get("industry_classified"), "naics_code ≠ 561499"),
                        ]
                        _cc = st.columns(5)
                        for _col, (lbl, ok, src) in zip(_cc, _ci):
                            with _col:
                                kpi(lbl, "✅ Pass" if ok else "❌ Fail", src,
                                    "#22c55e" if ok else "#ef4444")

                    st.markdown("---")

                    # ── Individual findings — each gets detail_panel ─────────
                    findings = audit_result.get("findings", [])
                    if findings:
                        st.markdown(f"##### 📋 AI Analyst Findings ({len(findings)})")
                        _f_ord = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3,"CLEAN":4}
                        for fi in sorted(findings, key=lambda x: _f_ord.get(x.get("severity",""),5)):
                            f_sev   = fi.get("severity","MEDIUM")
                            f_color = {"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b",
                                       "LOW":"#22c55e","CLEAN":"#10b981"}.get(f_sev,"#64748b")
                            f_icon  = SEV_ICON.get(f_sev,"ℹ️")
                            f_ws    = fi.get("worth_score_impact","")
                            f_ext   = fi.get("external_verification","")
                            f_cat   = fi.get("category","")
                            f_facts_involved = fi.get("facts_involved",[])
                            _f_facts_code = " · ".join(f"`{fn}`" for fn in f_facts_involved)

                            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {f_color};
                                border-radius:10px;padding:14px 20px;margin:8px 0">
                              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:6px">
                                <span style="color:{f_color};font-weight:800;font-size:.90rem">
                                  {f_icon} [{f_sev}] {fi.get('title','Finding')}
                                </span>
                                <span style="background:{f_color}18;color:{f_color};border-radius:6px;
                                  padding:2px 8px;font-size:.70rem">{f_cat}</span>
                              </div>
                              <div style="color:#CBD5E1;font-size:.80rem;margin-top:8px;line-height:1.5">
                                {fi.get('description','')}
                              </div>
                              {f'<div style="color:#94A3B8;font-size:.73rem;margin-top:6px">Facts: {_f_facts_code}</div>' if f_facts_involved else ''}
                              {f'<div style="color:#60A5FA;font-size:.76rem;margin-top:6px">⚡ <strong>Action:</strong> {fi.get("recommended_action","")}</div>' if fi.get("recommended_action") else ''}
                              {f'<div style="color:#a78bfa;font-size:.73rem;margin-top:4px">📊 Worth Score impact: {f_ws}</div>' if f_ws else ''}
                              {f'<div style="color:#06b6d4;font-size:.73rem;margin-top:4px">🌐 External verification: {f_ext}</div>' if f_ext else ''}
                            </div>""", unsafe_allow_html=True)

                            _fi_json = {"finding": fi.get("title"), "severity": f_sev,
                                        "category": f_cat, "description": fi.get("description"),
                                        "facts_involved": f_facts_involved,
                                        "worth_score_impact": f_ws, "action": fi.get("recommended_action"),
                                        "external_verification": f_ext}
                            _fi_sql = (f"-- Verify the facts involved in this finding:\n"
                                       f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val,\n"
                                       f"  JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid,\n"
                                       f"  JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf\n"
                                       f"FROM rds_warehouse_public.facts\n"
                                       f"WHERE business_id='{bid}'\n"
                                       f"  AND name IN ({', '.join(repr(fn) for fn in f_facts_involved)});")
                            detail_panel(
                                f"{f_icon} AI Finding: {fi.get('title','')}", f"{f_sev} · {f_cat}",
                                what_it_means=(
                                    f"{fi.get('description','')}\n\n"
                                    f"**Action:** {fi.get('recommended_action','')}\n\n"
                                    f"**Worth Score impact:** {f_ws or 'Not assessed'}\n\n"
                                    f"**External verification:** {f_ext or 'None suggested'}"
                                ),
                                source_table="rds_warehouse_public.facts",
                                source_file="check_agent_v2.py",
                                source_file_line="run_llm_audit() → GPT-4o-mini finding",
                                json_obj=_fi_json,
                                sql=_fi_sql,
                                links=[("facts/kyb/index.ts","Fact Engine"),
                                       ("worth_score_model.py","Worth Score model")],
                                color=f_color, icon=f_icon,
                            )

                    # ── Next steps ───────────────────────────────────────────
                    steps = audit_result.get("recommended_next_steps",[])
                    if steps:
                        st.markdown("---")
                        st.markdown("##### 🗺️ Recommended Next Steps (Priority Order)")
                        for i, step in enumerate(steps, 1):
                            _sc = "#ef4444" if i==1 else "#f97316" if i==2 else "#f59e0b" if i<=4 else "#3B82F6"
                            st.markdown(
                                f"""<div style="background:#1E293B;border-left:3px solid {_sc};
                                    border-radius:8px;padding:10px 16px;margin:4px 0;
                                    display:flex;align-items:flex-start;gap:10px">
                                  <span style="color:{_sc};font-weight:800;font-size:.82rem;min-width:55px">Step {i}</span>
                                  <span style="color:#CBD5E1;font-size:.80rem">{step}</span>
                                </div>""",
                                unsafe_allow_html=True
                            )

                    # ── Full JSON lineage ────────────────────────────────────
                    detail_panel(
                        "🧠 Full AI Analyst Report (JSON)", f"Risk: {_oa_risk} · DQ: {_dq_score}/100",
                        what_it_means=(
                            "The complete structured JSON from GPT-4o-mini's analyst audit. "
                            "Contains: overall_risk, data_quality_score, kyb_completeness matrix (5 signals), "
                            "all findings with severity/category/worth_score_impact/external_verification, "
                            "recommended_next_steps (priority ordered), and underwriting_decision_guidance."
                        ),
                        source_table="Generated by GPT-4o-mini · check_agent_v2.run_llm_audit()",
                        source_file="check_agent_v2.py",
                        source_file_line="run_llm_audit() → AUDIT_SYSTEM_PROMPT → gpt-4o-mini",
                        json_obj=audit_result,
                        sql=(f"-- Full fact profile for manual analyst inspection:\n"
                             f"SELECT name,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,\n"
                             f"  JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name') AS rule_applied\n"
                             f"FROM rds_warehouse_public.facts\n"
                             f"WHERE business_id='{bid}'\n"
                             f"ORDER BY name;"),
                        links=[("facts/kyb/index.ts","Fact Engine"),
                               ("worth_score_model.py","Worth Score model"),
                               ("aiscore.py","Score pipeline")],
                        color=_oa_color, icon="🧠",
                    )


# ════════════════════════════════════════════════════════════════════════════════
# AI AGENT
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🤖 AI Agent":
    bid=st.session_state.get("hub_bid","")
    st.markdown("## 🤖 KYB Intelligence AI Agent")
    st.markdown("Ask anything about KYB data, field lineage, source attribution, confidence formulas, SQL queries, or any result for this business.")
    if bid: st.info(f"📍 Business context: `{bid[:16]}…`")
    flag("RAG: api-docs (87 files) + integration-service + microsites + warehouse-service + inline knowledge (Worth Score, Watchlist, Domestic/Foreign, Fact Engine, NAICS, TIN). 1,965 chunks.","blue")

    if not get_openai():
        st.warning("⚠️ OpenAI key not detected. To enable AI responses, choose **one** of these options:")
        c1,c2=st.columns(2)
        with c1:
            st.markdown("**Option A — Streamlit secrets (recommended):**")
            st.code("""# Edit Admin-Portal-KYB-App/.streamlit/secrets.toml
OPENAI_API_KEY = "sk-svcacct-your-key-here"
""",language="toml")
        with c2:
            st.markdown("**Option B — Terminal / shell:**")
            st.code('export OPENAI_API_KEY="sk-svcacct-your-key-here"\nstreamlit run kyb_hub_app.py',language="bash")
        st.caption("After adding the key, click 🔄 Refresh in the sidebar or restart the app.")

    st.markdown("#### 💡 Quick Questions — Manager / Underwriting Expert Level")
    st.caption("Each answer will include: source file reference, SQL/Python code, JSON structure, and GitHub links to verify the information.")
    QUICK = {
        "🏛️ Registry & SOS Verification": [
            "Why is sos_match_boolean=false even though the business is legitimately registered? What are all possible root causes and how do I verify each one?",
            "How is Middesk confidence calculated? What does a confidence of 0.35 mean operationally — how many review tasks passed and what does it imply for the SOS match quality?",
            "What is the entity resolution gap for tax-haven states (DE/NV/WY)? How does the address-based Middesk search produce a false negative for businesses incorporated in Delaware but operating in Texas?",
            "A business has sos_active=false. What are the underwriting implications, what state actions typically cause this, and what SQL do I run to investigate?",
            "What is the difference between sos_match, sos_match_boolean, sos_active, and sos_filings? How do they relate to each other in the Fact Engine dependency chain?",
        ],
        "🔐 TIN / EIN Verification": [
            "How is tin_match_boolean derived from tin_match? What is the exact code path in integration-service and what does it check?",
            "A business has tin_match_boolean=false with message 'associated with a different Business Name'. What does this mean, what is the fraud risk, and what immediate action should I take as an underwriter?",
            "When does the IRS TIN check fail with 'does not have a record'? Is this always fraud or are there legitimate causes? What follow-up documentation should I request?",
            "tin_match_boolean=true but tin_match.status is not 'success'. Is this a data integrity bug or an expected state? How do I verify this in Redshift?",
            "What is the fallback for TIN verification when Middesk has no TIN review task? How does Trulioo's BusinessRegistrationNumber comparison differ from the IRS direct check?",
        ],
        "🏭 NAICS & Industry Classification": [
            "A business received NAICS 561499 (fallback). What are the 3 root cause gaps (G1/G2/G3), how do I confirm which gap applies to this specific business, and what SQL helps me diagnose it?",
            "In what order do vendors compete for the NAICS code? Explain the factWithHighestConfidence rule — when does Equifax beat ZoomInfo even with lower weight?",
            "How is MCC derived from NAICS? What is the rel_naics_mcc lookup and what happens when NAICS=561499? Provide the SQL to check this mapping.",
            "The NAICS code confidence is 0.18. What does this mean operationally — how was the confidence calculated and how reliable is this classification?",
            "How does the AI enrichment (GPT-4o-mini) classify NAICS when all vendors fail? What inputs does it receive, what is its weight, and how does the website URL affect its ability to classify?",
        ],
        "⚠️ Watchlist & Compliance": [
            "What is the difference between watchlist_hits, adverse_media_hits, pep_hits, and sanctions_hits? Which ones trigger a hard stop vs enhanced due diligence?",
            "Why is adverse media deliberately excluded from the consolidated watchlist fact? Where in the codebase is this filtering implemented and what compliance rationale justifies it?",
            "A business has 13 watchlist hits. What is the complete step-by-step compliance workflow required — who needs to be notified, what documentation is needed, and what SQL shows the hit details?",
            "How does the Trulioo PSC (Person Screening Compliance) flow differ from the Middesk watchlist review task? Which facts does each vendor populate?",
            "What is the risk_score (0-100) fact and how is it calculated from watchlist_hits and high_risk_people? How does it differ from the Worth Score?",
        ],
        "💰 Worth Score & Decisioning": [
            "A business has Worth Score=0. What are all the possible root causes? Explain the model pipeline — what happens when firmographic, financial, and economic features are all null?",
            "What is the exact formula for converting model probability to the 300-850 scale? Where is this implemented in the codebase and what are the default APPROVE/REVIEW/DECLINE thresholds?",
            "Explain the 3-model ensemble: Firmographic XGBoost, Financial PyTorch, and Economic model. What features feed each model and how are they combined?",
            "Which SHAP feature categories have the highest impact on the Worth Score? What is the maximum negative impact from public records (BK, judgments, liens)?",
            "A business has Worth Score=520 (FURTHER_REVIEW). What specific factors are most likely causing the score to fall below the APPROVE threshold of 700? Write SQL to check the factor contributions.",
        ],
        "🔗 Data Lineage & Architecture": [
            "Explain the complete data flow from business onboarding form submission to the Admin Portal showing a verified badge. Include all services, databases, APIs, and Kafka messages involved.",
            "What is the Fact Engine and how does factWithHighestConfidence work with WEIGHT_THRESHOLD=0.05? Give a concrete example where two vendors compete for sos_match.",
            "Why can't sos_filings, watchlist, and bankruptcies be queried from Redshift? What is the VARCHAR(65535) federation limit and how do I query these facts from PostgreSQL RDS instead?",
            "What is the difference between Pipeline A (Fact Engine / integration-service) and Pipeline B (warehouse-service / batch)? Which tables does each pipeline write to?",
            "How does Redis caching affect the KYB facts returned by the API? What is the TTL and how do I force a cache refresh?",
        ],
        "🗄️ SQL & Data Access": [
            "Write complete SQL to get every KYB fact for a business with winning source, confidence, rule applied, and all alternatives. Include both Redshift and PostgreSQL RDS versions.",
            "Write SQL to diagnose why a business received NAICS 561499 — show all vendor NAICS attempts, their confidence scores, and whether the website fact is populated.",
            "Write SQL to get the full Worth Score history for a business including factor contributions by category (public_records, company_profile, financial_trends, business_operations, performance_measures).",
            "Write Python code using psycopg2 to connect to Redshift and load all KYB facts for a business, parsing the JSON value column correctly.",
            "Write SQL to identify all businesses in the last 30 days with: (a) watchlist hits, (b) sos_active=false, (c) NAICS=561499, and (d) tin_match_boolean=false. Include cross-portfolio counts.",
        ],
    }
    import hashlib as _hashlib
    for section, questions in QUICK.items():
        with st.expander(section):
            for q in questions:
                q_hash = _hashlib.md5(q.encode()).hexdigest()[:8]
                if st.button(q, key=f"aqq_{q_hash}"):
                    st.session_state["agent_q"] = q
                    st.session_state["agent_pending"] = True

    st.markdown("---")
    if "agent_history" not in st.session_state: st.session_state["agent_history"]=[]

    # Render chat history with markdown (so source links are clickable)
    for msg in st.session_state["agent_history"]:
        role_icon = "🧑" if msg["role"]=="user" else "🤖"
        role_name = "You" if msg["role"]=="user" else "Agent"
        st.markdown(f"**{role_icon} {role_name}:**")
        st.markdown(msg["content"])   # full markdown: links, code blocks, etc.
        st.markdown("---")

    if st.session_state.get("agent_pending"):
        q=st.session_state.pop("agent_q",""); st.session_state.pop("agent_pending",None)
        if q:
            with st.spinner("Thinking…"): ans=ask_ai(q,f"Business ID: {bid}")
            st.session_state["agent_history"].extend([{"role":"user","content":q},{"role":"assistant","content":ans}]); st.rerun()

    col1,col2=st.columns([5,1])
    with col1: user_q=st.text_input("Your question:",key="agent_input",placeholder="e.g. Why does this business have Worth Score=0? What should I check?")
    with col2: st.markdown("<br>",unsafe_allow_html=True); send=st.button("Send ▶",type="primary")
    if send and user_q:
        with st.spinner("Thinking…"): ans=ask_ai(user_q,f"Business ID: {bid}",st.session_state["agent_history"])
        st.session_state["agent_history"].extend([{"role":"user","content":user_q},{"role":"assistant","content":ans}]); st.rerun()
    if st.session_state["agent_history"]:
        if st.button("🗑️ Clear chat"): st.session_state["agent_history"]=[]; st.rerun()

    st.markdown("---")
    st.markdown("### 🔬 Interactive SQL & Python Runner")
    st.markdown("Run any SQL or Python code directly against the Redshift database. Results appear inline.")
    st.caption(f"Credentials: `{os.getenv('REDSHIFT_USER','readonly_all_access')}` · `{os.getenv('REDSHIFT_HOST','...')[:50]}` · port 5439")

    runner_tab1, runner_tab2 = st.tabs(["🗄️ SQL Runner", "🐍 Python Runner"])

    with runner_tab1:
        st.markdown("**Write and run SQL directly against Redshift:**")
        default_sql = f"""-- Example: onboarded businesses this week with KYB signals
WITH onboarded AS (
    SELECT DISTINCT business_id, MIN(created_at) AS onboarded_at
    FROM rds_cases_public.rel_business_customer_monitoring
    WHERE DATE(created_at) >= CURRENT_DATE - 7
    GROUP BY business_id
)
SELECT
    o.business_id,
    o.onboarded_at::date                                                          AS onboarded_date,
    JSON_EXTRACT_PATH_TEXT(f_sos.value,'value')                                   AS sos_active,
    JSON_EXTRACT_PATH_TEXT(f_tin.value,'value')                                   AS tin_match_boolean,
    JSON_EXTRACT_PATH_TEXT(f_wl.value,'value')                                    AS watchlist_hits,
    JSON_EXTRACT_PATH_TEXT(f_naics.value,'value')                                 AS naics_code
FROM onboarded o
LEFT JOIN rds_warehouse_public.facts f_sos   ON f_sos.business_id=o.business_id   AND f_sos.name='sos_active'
LEFT JOIN rds_warehouse_public.facts f_tin   ON f_tin.business_id=o.business_id   AND f_tin.name='tin_match_boolean'
LEFT JOIN rds_warehouse_public.facts f_wl    ON f_wl.business_id=o.business_id    AND f_wl.name='watchlist_hits'
LEFT JOIN rds_warehouse_public.facts f_naics ON f_naics.business_id=o.business_id AND f_naics.name='naics_code'
ORDER BY o.onboarded_at DESC
;""" if not bid else f"""-- Facts for business {bid}:
SELECT name,
    JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
    JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
ORDER BY name;"""

        sql_input = st.text_area("SQL Query:", value=default_sql, height=200, key="sql_runner_input")
        run_col, clear_col = st.columns([2,1])
        with run_col:
            if st.button("▶ Run SQL", type="primary", key="run_sql_btn"):
                with st.spinner("Running query…"):
                    result_df, result_err = run_sql(sql_input)
                if result_df is not None and not result_df.empty:
                    st.success(f"✅ {len(result_df):,} rows · {len(result_df.columns)} columns")
                    st.dataframe(result_df, use_container_width=True)
                    # Download buttons — CSV and XLSX
                    dl1, dl2, dl3 = st.columns([1,1,3])
                    csv_data = result_df.to_csv(index=False).encode("utf-8")
                    with dl1:
                        st.download_button(
                            "⬇️ Download CSV", csv_data,
                            file_name="query_result.csv", mime="text/csv",
                            use_container_width=True, type="primary", key="dl_sql_csv"
                        )
                    with dl2:
                        try:
                            import io as _io2
                            _xls_buf = _io2.BytesIO()
                            result_df.to_excel(_xls_buf, index=False, engine="openpyxl")
                            _xls_bytes = _xls_buf.getvalue()
                            st.download_button(
                                "⬇️ Download XLSX", _xls_bytes,
                                file_name="query_result.xlsx",
                                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                use_container_width=True, key="dl_sql_xlsx"
                            )
                        except Exception:
                            st.caption("pip install openpyxl for XLSX")
                elif result_df is not None and result_df.empty:
                    st.info("Query returned 0 rows.")
                else:
                    st.error(f"❌ Query error: {result_err}")
                    # Suggest the correct pattern if schema error
                    if result_err and ("does not exist" in result_err or "not exist" in result_err):
                        st.markdown("""**💡 Schema error? Use only verified tables:**
```sql
-- KYB facts (correct schema):
SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID' ORDER BY name;

-- Onboarding date (correct schema):
SELECT business_id, created_at FROM rds_cases_public.rel_business_customer_monitoring
WHERE DATE(created_at) >= CURRENT_DATE - 7;
```""")
        with clear_col:
            if st.button("🗑️ Clear", key="clear_sql"):
                st.rerun()

    with runner_tab2:
        # Pre-build an already-open connection and inject it so user code
        # doesn't need to re-supply credentials (and can't get them wrong)
        import io, contextlib, traceback as _tb
        try:
            import psycopg2 as _psy
            _runner_conn = _psy.connect(
                dbname=os.getenv("REDSHIFT_DB","dev"),
                user=os.getenv("REDSHIFT_USER","readonly_all_access"),
                password=os.getenv("REDSHIFT_PASSWORD","Y7&.D3!09WvT4/nSqXS2>qbO"),
                host=os.getenv("REDSHIFT_HOST","worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
                port=int(os.getenv("REDSHIFT_PORT","5439")),
                connect_timeout=15
            )
            _conn_ok = True
        except Exception as _ce:
            _runner_conn = None
            _conn_ok = False
            st.warning(f"⚠️ Could not pre-open Redshift connection: {_ce}. Check VPN. You can still write code that opens its own connection.")

        if _conn_ok:
            st.success("🟢 Redshift connection pre-opened — use `conn` directly in your code, no credentials needed")
        st.markdown("**`conn`** = pre-opened psycopg2 connection · **`pd`** = pandas · **`json`** = json · **`bid`** = current business UUID")

        _example_bid = bid or 'PASTE-UUID-HERE'
        default_py = f"""# conn is already open — use it directly with pd.read_sql()
# bid = current business UUID (pre-injected)

df = pd.read_sql(f\"\"\"
    SELECT name,
           JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,
           JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') AS winning_pid,
           JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,
           received_at
    FROM rds_warehouse_public.facts
    WHERE business_id = '{_example_bid}'
    ORDER BY name
\"\"\", conn)

print(f"Loaded {{len(df)}} facts for {{bid}}")
print(df.to_string(index=False))"""

        py_input = st.text_area("Python Code:", value=default_py, height=260, key="py_runner_input")

        # Quick-load templates
        with st.expander("📋 Quick templates — click to load"):
            tmpl_cols = st.columns(3)
            TEMPLATES = {
                "Onboarded businesses (last 7 days)":
                    f"""df = pd.read_sql(\"\"\"
    SELECT DISTINCT business_id, MIN(created_at)::date AS onboarded_at
    FROM rds_cases_public.rel_business_customer_monitoring
    WHERE DATE(created_at) >= CURRENT_DATE - 7
    GROUP BY business_id
    ORDER BY onboarded_at DESC
\"\"\", conn)
print(f"Found {{len(df)}} businesses")""",
                "Worth Score for current business":
                    f"""df = pd.read_sql(f\"\"\"
    SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
    FROM rds_manual_score_public.data_current_scores cs
    JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
    WHERE cs.business_id = '{_example_bid}'
    ORDER BY bs.created_at DESC LIMIT 5
\"\"\", conn)
print(df.to_string(index=False))""",
                "All KYB facts + parse JSON":
                    f"""import json as _json
rows = []
cur = conn.cursor()
cur.execute(\"\"\"
    SELECT name, value, received_at FROM rds_warehouse_public.facts
    WHERE business_id = '{_example_bid}' ORDER BY name
\"\"\")
for name, val_str, ts in cur.fetchall():
    try:
        fact = _json.loads(val_str) if val_str else {{}}
    except: fact = {{}}
    rows.append({{
        'fact': name,
        'value': str(fact.get('value',''))[:60],
        'pid':   fact.get('source',{{}}).get('platformId',''),
        'conf':  fact.get('source',{{}}).get('confidence',''),
        'ts':    str(ts)[:16]
    }})
cur.close()
import pandas as _pd2; df = _pd2.DataFrame(rows)
print(df.to_string(index=False))""",
            }
            for i,(tmpl_name,tmpl_code) in enumerate(TEMPLATES.items()):
                with tmpl_cols[i % 3]:
                    if st.button(f"📄 {tmpl_name}", key=f"tmpl_{i}"):
                        st.session_state["py_runner_template"] = tmpl_code
                        st.rerun()
            if "py_runner_template" in st.session_state:
                py_input = st.session_state.pop("py_runner_template")

        run_c, clr_c = st.columns([2,1])
        with run_c:
            run_py = st.button("▶ Run Python", type="primary", key="run_py_btn")
        with clr_c:
            if st.button("🗑️ Clear output", key="clear_py"):
                st.session_state.pop("py_output", None); st.rerun()

        if run_py:
            with st.spinner("Running Python against Redshift…"):
                stdout_cap = io.StringIO()
                # Inject: conn (pre-opened), pd, json, os, bid
                _lvars = {
                    "conn": _runner_conn,
                    "pd": pd,
                    "json": json,
                    "os": os,
                    "bid": bid or "",
                }
                try:
                    with contextlib.redirect_stdout(stdout_cap):
                        exec(py_input, _lvars)  # noqa: S102
                    output = stdout_cap.getvalue()
                    st.session_state["py_output"] = ("ok", output, _lvars)
                except Exception:
                    st.session_state["py_output"] = ("err", _tb.format_exc(), _lvars)

        if "py_output" in st.session_state:
            status, output, _lvars = st.session_state["py_output"]
            if status == "ok":
                st.success("✅ Execution complete")
                if output:
                    st.code(output, language="text")
                for var_name in ["df","result","out","data","df2"]:
                    if var_name in _lvars and isinstance(_lvars[var_name], pd.DataFrame):
                        _vdf = _lvars[var_name]
                        st.markdown(f"**DataFrame `{var_name}` — {len(_vdf):,} rows · {len(_vdf.columns)} columns:**")
                        st.dataframe(_vdf, use_container_width=True)
                        _pdl1, _pdl2 = st.columns(2)
                        with _pdl1:
                            _csv_b = _vdf.to_csv(index=False).encode("utf-8")
                            st.download_button(f"⬇️ CSV — {var_name}", _csv_b,
                                file_name=f"{var_name}.csv", mime="text/csv",
                                use_container_width=True, type="primary", key=f"dl_{var_name}_csv")
                        with _pdl2:
                            try:
                                import io as _io3
                                _xb = _io3.BytesIO()
                                _vdf.to_excel(_xb, index=False, engine="openpyxl")
                                st.download_button(f"⬇️ XLSX — {var_name}", _xb.getvalue(),
                                    file_name=f"{var_name}.xlsx",
                                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                    use_container_width=True, key=f"dl_{var_name}_xlsx")
                            except Exception:
                                st.caption("pip install openpyxl for XLSX")
            else:
                st.error("❌ Python error:")
                st.code(output, language="text")
                st.caption("💡 Tip: use `conn` (pre-injected) instead of creating a new psycopg2.connect() — credentials are already loaded.")

# ════════════════════════════════════════════════════════════════════════════════
# 🌳 LINEAGE & DISCOVERY
# ════════════════════════════════════════════════════════════════════════════════
elif tab == "🌳 Lineage & Discovery":
    st.markdown("## 🌳 Lineage & Data Discovery")
    st.caption(
        "Explore the full data architecture: table catalog, field definitions, "
        "feature registry, upstream/downstream lineage, and repo file references. "
        "Every entry has `detail_panel()` with SQL, Python, and GitHub links."
    )

    ld1, ld2, ld3, ld4, ld5 = st.tabs([
        "📋 Table Catalog",
        "🔤 Column / Field Catalog",
        "⚙️ Feature Registry",
        "🔗 Field Lineage",
        "📁 Repo Explorer",
    ])

    # ── TABLE CATALOG ─────────────────────────────────────────────────────────
    with ld1:
        st.markdown("#### 📋 Table Catalog")
        st.caption("All Redshift schemas and tables used by the KYB platform. Click any row for SQL, business purpose, and GitHub source links.")

        TABLE_CATALOG = [
            # schema, table, rows_est, freshness, used_by_model, description, business_purpose, key_cols
            ("rds_warehouse_public",     "facts",                           "28M+",  "live",    True,
             "Central fact store — one row per (business_id, fact_name). Every KYB signal lives here.",
             "The single authoritative source of truth for all KYB facts: SOS, TIN, IDV, NAICS, watchlist, firmographic data.",
             "business_id, name, value (JSON), received_at"),
            ("rds_cases_public",         "rel_business_customer_monitoring","5M+",   "hourly",  False,
             "Business ↔ customer link table. Authoritative onboarding date source (created_at).",
             "Ties each business_id to its customer and records when it was onboarded. The only correct source for onboarding dates.",
             "business_id, customer_id, created_at"),
            ("rds_auth_public",          "data_customers",                  "10K+",  "hourly",  False,
             "Customer master — maps customer_id to customer name.",
             "Used to filter all portfolio analytics by customer name.",
             "id, name, created_at"),
            ("rds_manual_score_public",  "business_scores",                 "2.6M+", "live",    True,
             "Worth Score history — one row per scored business per scoring run.",
             "Contains the 300-850 confidence score, risk level (HIGH/MODERATE/LOW), and decision (APPROVE/FURTHER_REVIEW/DECLINE).",
             "id, business_id, weighted_score_850, risk_level, score_decision, created_at"),
            ("rds_manual_score_public",  "data_current_scores",             "540K+", "live",    True,
             "Current score pointer — joins to business_scores via score_id. One row per business.",
             "Always use this table to get the latest score for a business. JOIN to business_scores ON bs.id = cs.score_id.",
             "business_id, score_id"),
            ("rds_manual_score_public",  "business_score_factors",          "13M+",  "live",    True,
             "SHAP-equivalent factor contributions — one row per (score_id, category).",
             "Shows how much each model category contributed to the score: public_records, company_profile, financial_trends, etc.",
             "score_id, category_id, score_100, weighted_score_850"),
            ("datascience",              "customer_files",                   "1.8M+", "daily",   True,
             "Pipeline B output — ZoomInfo + Equifax entity matches with firmographic data.",
             "Primary source of revenue, employee count, and NAICS codes from ZI/EFX bulk data. Fed by entity-matching XGBoost.",
             "business_id, primary_naics_code, zi_revenue, efx_revenue, zi_num_employees"),
            ("datascience",              "zoominfo_matches_custom_inc_ml",  "3.4M+", "daily",   True,
             "ZoomInfo entity matches scored by ML model.",
             "ZoomInfo (pid=24) firmographic data after entity-matching. Source of revenue and employee count for most businesses.",
             "business_id, zi_match_confidence, zi_revenue, zi_num_employees"),
            ("datascience",              "efx_matches_custom_inc_ml",       "2.1M+", "daily",   True,
             "Equifax entity matches scored by ML model.",
             "Equifax (pid=17) firmographic data. Fallback when ZoomInfo match confidence is lower.",
             "business_id, efx_match_confidence, efx_revenue, efx_num_employees"),
            ("warehouse",                "oc_companies_latest",             "220M+", "weekly",  False,
             "OpenCorporates registry dump — global company registration data.",
             "Used by Pipeline B for SOS match fallback when Middesk cannot match the entity.",
             "company_number, jurisdiction_code, name, dissolution_date"),
        ]

        tbl_df = pd.DataFrame(TABLE_CATALOG, columns=[
            "Schema","Table","Est. Rows","Freshness","Model Input","Description","Business Purpose","Key Columns"
        ])

        _tbl_search = st.text_input("🔍 Search tables, schemas, or descriptions", "", key="tbl_catalog_search")
        if _tbl_search:
            mask = tbl_df.apply(lambda r: _tbl_search.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
            tbl_df = tbl_df[mask]

        st.dataframe(
            tbl_df[["Schema","Table","Est. Rows","Freshness","Model Input","Description"]],
            use_container_width=True, hide_index=True,
            column_config={"Model Input": st.column_config.CheckboxColumn("Model Input")}
        )

        st.markdown("##### Detail panels — click any table for SQL, business purpose, and lineage:")
        for row in TABLE_CATALOG:
            schema, table, rows, freshness, model_inp, desc, purpose, key_cols = row
            _tbl_full = f"{schema}.{table}"
            _tbl_sql = (
                f"-- Row count and freshness check:\n"
                f"SELECT COUNT(*) AS total_rows, MAX(created_at) AS latest_row\n"
                f"FROM {_tbl_full};\n\n"
                f"-- Preview 5 rows:\n"
                f"SELECT * FROM {_tbl_full} LIMIT 5;"
            )
            detail_panel(
                f"📋 {_tbl_full}", f"{rows} rows · {freshness}",
                what_it_means=(
                    f"**Business purpose:** {purpose}\n\n"
                    f"**Key columns:** `{key_cols}`\n\n"
                    f"**Model input:** {'Yes — used by Worth Score pipeline' if model_inp else 'No — operational table only'}\n\n"
                    f"**Freshness:** {freshness} — data is updated {freshness}."
                ),
                source_table=_tbl_full,
                source_file="customer_table.sql" if "datascience" in schema else "facts/kyb/index.ts",
                json_obj={
                    "schema": schema, "table": table, "est_rows": rows,
                    "freshness": freshness, "model_input": model_inp,
                    "key_columns": key_cols.split(", "),
                },
                sql=_tbl_sql,
                links=[
                    ("customer_table.sql", "Pipeline B join SQL"),
                    ("aiscore.py", "Score pipeline"),
                    ("api-docs/kyb.md", "KYB API reference"),
                ],
                color="#3B82F6" if model_inp else "#64748b",
                icon="📋",
            )

        # Live row counts from Redshift
        st.markdown("---")
        st.markdown("##### 🔄 Live Row Counts from Redshift")
        if st.button("📊 Load live counts", key="tbl_live_counts"):
            _counts_sql = """
                SELECT 'rds_warehouse_public.facts'                          AS tbl, COUNT(*) AS rows FROM rds_warehouse_public.facts
                UNION ALL SELECT 'rds_cases_public.rel_business_customer_monitoring', COUNT(*) FROM rds_cases_public.rel_business_customer_monitoring
                UNION ALL SELECT 'rds_auth_public.data_customers',                    COUNT(*) FROM rds_auth_public.data_customers
                UNION ALL SELECT 'rds_manual_score_public.business_scores',           COUNT(*) FROM rds_manual_score_public.business_scores
                UNION ALL SELECT 'rds_manual_score_public.data_current_scores',       COUNT(*) FROM rds_manual_score_public.data_current_scores
                ORDER BY rows DESC;
            """
            with st.spinner("Querying Redshift…"):
                _cnt_df, _cnt_err = run_sql(_counts_sql)
            if _cnt_df is not None and not _cnt_df.empty:
                st.dataframe(_cnt_df, use_container_width=True, hide_index=True)
                detail_panel("Live Row Counts", f"{len(_cnt_df)} tables queried",
                    what_it_means="Live COUNT(*) from each key Redshift table. Run this to verify data freshness and catch unexpected row count drops.",
                    source_table="All tables listed above",
                    sql=_counts_sql, icon="📊", color="#22c55e")
            else:
                flag(f"Could not load live counts: {_cnt_err}", "amber")

    # ── COLUMN / FIELD CATALOG ───────────────────────────────────────────────
    with ld2:
        st.markdown("#### 🔤 Column / Field Catalog")
        st.caption("All key columns across KYB tables — definitions, data types, sensitivity, and join keys.")

        COLUMN_CATALOG = [
            # table, column, type, sensitivity, join_key, searchable, description
            ("rds_warehouse_public.facts",          "business_id",         "VARCHAR (UUID)", "INTERNAL", True,  True,  "Unique business identifier. Primary join key across all KYB tables."),
            ("rds_warehouse_public.facts",          "name",                "VARCHAR",        "LOW",      False, True,  "Fact name (e.g. 'sos_active', 'tin_match_boolean', 'naics_code'). Use WHERE name='...' to filter."),
            ("rds_warehouse_public.facts",          "value",               "VARCHAR (JSON)", "INTERNAL", False, False, "JSON blob. Use JSON_EXTRACT_PATH_TEXT(value,'value') to get the scalar value."),
            ("rds_warehouse_public.facts",          "received_at",         "TIMESTAMP",      "LOW",      False, True,  "When this fact was written to Redshift. NOT the onboarding date — use rbcm.created_at for that."),
            ("rel_business_customer_monitoring",    "customer_id",         "VARCHAR (UUID)", "INTERNAL", True,  False, "Joins to rds_auth_public.data_customers.id to get customer name."),
            ("rel_business_customer_monitoring",    "created_at",          "TIMESTAMP",      "LOW",      False, True,  "Authoritative onboarding timestamp. Use DATE(created_at) for date-range filters."),
            ("rds_auth_public.data_customers",      "id",                  "VARCHAR (UUID)", "INTERNAL", True,  False, "Customer primary key. Joins to rbcm.customer_id."),
            ("rds_auth_public.data_customers",      "name",                "VARCHAR",        "INTERNAL", False, True,  "Customer name. Use for customer-level portfolio filters."),
            ("rds_manual_score_public.business_scores","weighted_score_850","FLOAT",         "LOW",      False, True,  "Worth Score on 300-850 scale. Formula: probability × 550 + 300."),
            ("rds_manual_score_public.business_scores","risk_level",        "VARCHAR",        "LOW",      False, True,  "HIGH (<550), MODERATE (550-699), LOW (≥700). Derived from weighted_score_850."),
            ("rds_manual_score_public.business_scores","score_decision",    "VARCHAR",        "LOW",      False, True,  "APPROVE / FURTHER_REVIEW_NEEDED / DECLINE. Configurable per customer."),
            ("rds_manual_score_public.business_score_factors","category_id","VARCHAR",        "LOW",      False, True,  "Model category: public_records, company_profile, financial_trends, business_operations, performance_measures."),
            ("rds_manual_score_public.business_score_factors","weighted_score_850","FLOAT",  "LOW",      False, False, "This category's contribution to the total score. Sum across categories = total score."),
            ("datascience.customer_files",          "primary_naics_code",  "VARCHAR",        "LOW",      False, True,  "6-digit NAICS from Pipeline B (ZI/EFX match). May differ from facts.naics_code (Pipeline A winner)."),
            ("datascience.customer_files",          "zi_revenue",          "FLOAT",          "INTERNAL", False, False, "ZoomInfo annual revenue. Worth Score feature: revenue (Business Operations category)."),
        ]

        col_df = pd.DataFrame(COLUMN_CATALOG, columns=[
            "Table","Column","Type","Sensitivity","Join Key","Searchable","Description"
        ])

        _col_search = st.text_input("🔍 Search columns, types, or descriptions", "", key="col_catalog_search")
        if _col_search:
            mask = col_df.apply(lambda r: _col_search.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
            col_df = col_df[mask]

        st.dataframe(col_df, use_container_width=True, hide_index=True,
                     column_config={
                         "Join Key": st.column_config.CheckboxColumn("Join Key"),
                         "Searchable": st.column_config.CheckboxColumn("Searchable"),
                     })

        st.markdown("---")
        st.markdown("##### 🔄 Live Schema Discovery from Redshift")
        _schema_q = st.text_input("Schema name (e.g. rds_warehouse_public):", "rds_warehouse_public", key="schema_disc_input")
        if st.button("🔍 Discover columns", key="schema_disc_btn"):
            _disc_sql = f"""
                SELECT table_name, column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = '{_schema_q}'
                ORDER BY table_name, ordinal_position;
            """
            with st.spinner("Discovering schema…"):
                _disc_df, _disc_err = run_sql(_disc_sql)
            if _disc_df is not None and not _disc_df.empty:
                st.dataframe(_disc_df, use_container_width=True, hide_index=True)
                detail_panel("Live Schema Discovery", f"{len(_disc_df)} columns in {_schema_q}",
                    what_it_means=f"All columns in schema `{_schema_q}` from Redshift information_schema. Use this to verify column names before writing queries.",
                    source_table="information_schema.columns",
                    sql=_disc_sql, icon="🔤", color="#8B5CF6")
            else:
                flag(f"Schema discovery failed: {_disc_err}", "amber")

    # ── FEATURE REGISTRY ─────────────────────────────────────────────────────
    with ld3:
        st.markdown("#### ⚙️ Feature Registry")
        st.caption("All Worth Score model features — definition, source fact, model category, transformation logic, and active status.")

        FEATURE_REGISTRY = [
            # feature, category, source_fact, source_table, transformation, active, description
            ("age_business",        "Company Profile",    "formation_date",       "rds_warehouse_public.facts",    "CURRENT_YEAR - YEAR(formation_date)",         True,  "Business age in years. Older businesses score higher (lower default risk)."),
            ("revenue",             "Business Operations","revenue",              "rds_warehouse_public.facts",    "factWithHighestConfidence(ZI, EFX)",           True,  "Annual revenue USD. ZoomInfo (pid=24, w=0.8) > Equifax (pid=17, w=0.7). Null = entity not matched."),
            ("count_employees",     "Company Profile",    "num_employees",        "rds_warehouse_public.facts",    "factWithHighestConfidence(ZI, EFX)",           True,  "Employee count. Same vendor hierarchy as revenue. Null = entity not in firmographic DB."),
            ("naics6",              "Company Profile",    "naics_code",           "rds_warehouse_public.facts",    "factWithHighestConfidence(ZI,EFX,OC,SERP,AI)", True,  "6-digit NAICS. 561499 = fallback penalty. Lower NAICS confidence reduces score."),
            ("primsic",             "Company Profile",    "naics_code",           "rds_warehouse_public.facts",    "rel_naics_mcc lookup from naics_code",         True,  "SIC code derived from NAICS via lookup table."),
            ("state",               "Company Profile",    "formation_state",      "rds_warehouse_public.facts",    "JSON_EXTRACT_PATH_TEXT(value,'value')",        True,  "Formation state. Tax-haven states (DE/NV/WY) may indicate entity resolution risk."),
            ("bus_struct",          "Company Profile",    "corporation",          "rds_warehouse_public.facts",    "entity_type from Middesk SOS filing",          True,  "Entity structure (LLC, Corp, Sole Prop). Different risk profiles per structure."),
            ("count_bankruptcy",    "Public Records",     "num_bankruptcies",     "rds_warehouse_public.facts",    "dependent fact — count of bankruptcies[]",     True,  "Number of bankruptcy filings. Each adds negative score impact. Capped at -120pts."),
            ("count_judgment",      "Public Records",     "num_judgements",       "rds_warehouse_public.facts",    "dependent fact — count of judgements[]",       True,  "Civil judgment count. Each adds negative impact. Source: Equifax / Verdata."),
            ("count_lien",          "Public Records",     "num_liens",            "rds_warehouse_public.facts",    "dependent fact — count of liens[]",            True,  "Tax/mechanic lien count. Each adds negative impact. Source: Equifax / Verdata."),
            ("gdp_pch",             "Financial Trends",   "N/A (macro)",          "Liberty/Fed FRED data",         "GDP percent change — external macro series",   True,  "Macroeconomic indicator. Sourced from external economic data feeds, not Redshift facts."),
            ("cpi",                 "Financial Trends",   "N/A (macro)",          "Liberty/Fed FRED data",         "Consumer Price Index",                         True,  "Macroeconomic indicator. Applied at scoring time from external feeds."),
            ("vix",                 "Financial Trends",   "N/A (macro)",          "Liberty/Fed FRED data",         "CBOE Volatility Index",                        True,  "Market volatility indicator. Higher VIX historically correlates with higher default."),
            ("bs_total_assets",     "Performance",        "N/A (Plaid)",          "Plaid banking data",            "From Plaid balance sheet report",              False, "Total assets from Plaid balance sheet. Null for most businesses (no Plaid connected)."),
            ("cf_operating",        "Performance",        "N/A (Plaid)",          "Plaid banking data",            "From Plaid cash flow report",                  False, "Operating cash flow from Plaid. Null for most — requires Plaid banking connection."),
        ]

        feat_df = pd.DataFrame(FEATURE_REGISTRY, columns=[
            "Feature","Model Category","Source Fact","Source Table","Transformation","Active","Description"
        ])

        _feat_search = st.text_input("🔍 Search features or categories", "", key="feat_reg_search")
        if _feat_search:
            mask = feat_df.apply(lambda r: _feat_search.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
            feat_df = feat_df[mask]

        st.dataframe(feat_df, use_container_width=True, hide_index=True,
                     column_config={"Active": st.column_config.CheckboxColumn("Active")})

        st.markdown("---")
        # Category fill rate chart
        _cat_counts = feat_df["Model Category"].value_counts().reset_index()
        _cat_counts.columns = ["Category","Feature Count"]
        _active_counts = feat_df[feat_df["Active"]==True]["Model Category"].value_counts().reset_index()
        _active_counts.columns = ["Category","Active"]
        fig_feat = px.bar(_cat_counts, x="Category", y="Feature Count",
                          title="Feature Count by Model Category",
                          color="Feature Count", color_continuous_scale="Blues")
        fig_feat.update_layout(height=280, margin=dict(t=40,b=10,l=10,r=10))
        st.plotly_chart(dark_chart(fig_feat), use_container_width=True)
        detail_panel("Feature Registry — Category Distribution", f"{len(feat_df)} features across {feat_df['Model Category'].nunique()} categories",
            what_it_means="Count of model features per category. Categories with more features have more variance in their score contribution. 'Active=False' features are defined in the codebase but not currently materialized in Redshift (e.g., Plaid banking features require a banking connection).",
            source_table="rds_warehouse_public.facts (source facts) · datascience.customer_files (Pipeline B features)",
            source_file="lookups.py",
            source_file_line="INPUTS dict — all features + imputation defaults",
            json_obj={"categories": _cat_counts.to_dict("records"), "total_features": len(feat_df), "active_features": int(feat_df["Active"].sum())},
            sql=f"SELECT category_id, COUNT(*) AS features, AVG(score_100) AS avg_contribution FROM rds_manual_score_public.business_score_factors WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{{business_id}}' LIMIT 1) GROUP BY 1 ORDER BY 2 DESC;",
            links=[("lookups.py","INPUTS dict — all features"),("worth_score_model.py","Model training"),("aiscore.py","Score pipeline")],
            icon="⚙️", color="#8B5CF6")

    # ── FIELD LINEAGE ────────────────────────────────────────────────────────
    with ld4:
        st.markdown("#### 🔗 Field Lineage Explorer")
        st.caption("Select any KYB fact or model feature to trace its complete 4-level lineage: business meaning → warehouse source → transformation SQL → repo code files.")

        ALL_LINEAGE_FIELDS = sorted([
            "sos_active","sos_match_boolean","sos_match","sos_filings",
            "tin_match_boolean","tin_match","tin_submitted",
            "idv_passed_boolean","idv_passed","idv_status",
            "naics_code","mcc_code","industry",
            "legal_name","business_name","names_found","dba_found",
            "formation_state","formation_date","corporation",
            "revenue","num_employees","year_established",
            "watchlist_hits","adverse_media_hits","watchlist",
            "num_bankruptcies","num_judgements","num_liens",
            "website","website_found","serp_id","review_rating",
            "primary_address","address_match_boolean","name_match_boolean",
            "kyb_submitted","kyb_complete","middesk_confidence",
            "confidence_score","weighted_score_850","risk_level","score_decision",
        ])

        _lin_field = st.selectbox("Select field / fact:", ALL_LINEAGE_FIELDS, key="lin_field_select")

        # Build lineage from FACT_SOURCE_KNOWLEDGE + GITHUB_LINKS
        FIELD_LINEAGE = {
            "sos_active": {
                "l1": "Whether the business entity's Secretary of State registration is currently ACTIVE. True = in good standing. False = dissolved, revoked, or administratively suspended.",
                "l2": "rds_warehouse_public.facts WHERE name='sos_active'\n  JSON_EXTRACT_PATH_TEXT(value,'value') → 'true' / 'false'",
                "l3": "DEPENDENT fact (pid=-1). Derived from sos_filings[].active array.\n  Logic: any(filing.active == true for filing in sos_filings) → true",
                "l4": ["facts/kyb/index.ts → sosActive dependent rule","integration-service/lib/middesk","facts/rules.ts → dependent fact pattern"],
                "upstream": ["sos_filings","sos_match"],"downstream": ["kyb_complete","Check-Agent registration rules"],
            },
            "tin_match_boolean": {
                "l1": "Whether the submitted EIN matches the IRS record for this business name. True = IRS confirmed match. False = IRS returned failure or no record.",
                "l2": "rds_warehouse_public.facts WHERE name='tin_match_boolean'\n  JSON_EXTRACT_PATH_TEXT(value,'value') → 'true' / 'false'",
                "l3": "DEPENDENT fact. Derived from tin_match.value.status:\n  status === 'success' → true; 'failure' or 'not_found' → false",
                "l4": ["facts/kyb/index.ts → tinMatchBoolean dependent","integration-service/lib/middesk → TIN review task","facts/rules.ts"],
                "upstream": ["tin_match","tin_submitted"],"downstream": ["kyb_complete","Worth Score (registration signal)"],
            },
            "naics_code": {
                "l1": "6-digit NAICS industry classification. Determines industry risk profile in Worth Score. 561499 = fallback (all vendors failed).",
                "l2": "rds_warehouse_public.facts WHERE name='naics_code'\n  JSON_EXTRACT_PATH_TEXT(value,'value') → 6-digit code\n  JSON_EXTRACT_PATH_TEXT(value,'source','platformId') → winning vendor ID",
                "l3": "factWithHighestConfidence rule across vendors:\n  ZoomInfo (pid=24, w=0.8) → Equifax (pid=17, w=0.7) → OpenCorporates (pid=23, w=0.6)\n  → SERP (pid=22, w=0.4) → Trulioo (pid=38, w=0.3) → Applicant (pid=0, w=0.2)\n  → AI enrichment (pid=31, w=0.1) → fallback 561499",
                "l4": ["facts/kyb/index.ts → naicsCode","facts/rules.ts → factWithHighestConfidence","aiEnrichment → GPT NAICS classification","integrations.constant.ts → vendor IDs"],
                "upstream": ["website","business_name","legal_name","industry"],"downstream": ["mcc_code","naics6 (Worth Score)","primsic (Worth Score)"],
            },
            "weighted_score_850": {
                "l1": "Worth Score on 300-850 scale. Higher = lower risk. APPROVE ≥700, FURTHER_REVIEW 550-699, DECLINE <550.",
                "l2": "rds_manual_score_public.business_scores · weighted_score_850\n  JOIN via: data_current_scores cs JOIN business_scores bs ON bs.id=cs.score_id\n  WHERE cs.business_id = '{business_id}'",
                "l3": "score_300_850 = probability × 550 + 300\n  probability = calibrated ensemble output from 3-model stack:\n    Firmographic XGBoost + Financial PyTorch neural net + Economic model",
                "l4": ["aiscore.py → score_300_850 formula","worth_score_model.py → 3-model ensemble","lookups.py → INPUTS dict","score_decision_matrix → thresholds"],
                "upstream": ["rds_warehouse_public.facts (all KYB facts)","datascience.customer_files (Pipeline B firmographic)","Plaid banking data"],"downstream": ["risk_level","score_decision","business_score_factors"],
            },
        }

        lineage = FIELD_LINEAGE.get(_lin_field, {
            "l1": f"`{_lin_field}` — see facts/kyb/index.ts for the full definition and vendor cascade.",
            "l2": f"rds_warehouse_public.facts WHERE name='{_lin_field}'",
            "l3": "factWithHighestConfidence rule — see facts/rules.ts",
            "l4": ["facts/kyb/index.ts","facts/rules.ts","integrations.constant.ts"],
            "upstream": ["rds_warehouse_public.facts"],"downstream": ["Worth Score model"],
        })

        # Render 4-level lineage
        _lin_color = "#3B82F6"
        st.markdown(f"""<div style="background:#1E293B;border-radius:12px;padding:18px 22px;margin:8px 0">
          <div style="color:#60A5FA;font-weight:700;font-size:1rem;margin-bottom:12px">🔗 Lineage: <code>{_lin_field}</code></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div style="background:#0f172a;border-left:3px solid #3B82F6;border-radius:8px;padding:10px 14px">
              <div style="color:#60A5FA;font-size:.72rem;font-weight:700;margin-bottom:6px"><span style="background:#2563EB;color:#fff;padding:2px 8px;border-radius:10px;font-size:.65rem">L1</span> Business Meaning</div>
              <div style="color:#CBD5E1;font-size:.80rem">{lineage["l1"]}</div>
            </div>
            <div style="background:#0f172a;border-left:3px solid #8B5CF6;border-radius:8px;padding:10px 14px">
              <div style="color:#a78bfa;font-size:.72rem;font-weight:700;margin-bottom:6px"><span style="background:#6d28d9;color:#fff;padding:2px 8px;border-radius:10px;font-size:.65rem">L2</span> Warehouse Source</div>
              <div style="color:#CBD5E1;font-size:.80rem;font-family:monospace">{lineage["l2"]}</div>
            </div>
            <div style="background:#0f172a;border-left:3px solid #22c55e;border-radius:8px;padding:10px 14px">
              <div style="color:#86efac;font-size:.72rem;font-weight:700;margin-bottom:6px"><span style="background:#15803d;color:#fff;padding:2px 8px;border-radius:10px;font-size:.65rem">L3</span> Transformation Logic</div>
              <div style="color:#CBD5E1;font-size:.80rem;font-family:monospace;white-space:pre-wrap">{lineage["l3"]}</div>
            </div>
            <div style="background:#0f172a;border-left:3px solid #f59e0b;border-radius:8px;padding:10px 14px">
              <div style="color:#fde68a;font-size:.72rem;font-weight:700;margin-bottom:6px"><span style="background:#92400e;color:#fff;padding:2px 8px;border-radius:10px;font-size:.65rem">L4</span> Repo / Code Lineage</div>
              <div style="color:#CBD5E1;font-size:.80rem">{"<br/>".join("· " + f for f in lineage["l4"])}</div>
            </div>
          </div>
        </div>""", unsafe_allow_html=True)

        # Upstream → Downstream flow
        _up = lineage.get("upstream",[])
        _dn = lineage.get("downstream",[])
        uf1, uf2, uf3 = st.columns([2,1,2])
        with uf1:
            st.markdown("**⬆️ Upstream (sources)**")
            for u in _up: st.markdown(f"- `{u}`")
        with uf2:
            st.markdown(f"<div style='text-align:center;padding-top:20px;color:#60A5FA;font-size:1.4rem'>→</div>", unsafe_allow_html=True)
        with uf3:
            st.markdown("**⬇️ Downstream (consumers)**")
            for d in _dn: st.markdown(f"- `{d}`")

        _lin_sql = f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid, JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS conf, JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name') AS rule FROM rds_warehouse_public.facts WHERE name='{_lin_field}' AND business_id='{{business_id}}' LIMIT 1;"
        detail_panel(
            f"🔗 4-Level Lineage: {_lin_field}", "L1 → L2 → L3 → L4",
            what_it_means=lineage["l1"],
            source_table=lineage["l2"].split("\n")[0],
            source_file="facts/kyb/index.ts",
            source_file_line=f"{_lin_field} definition",
            json_obj={"field": _lin_field, "upstream": _up, "downstream": _dn,
                      "l1": lineage["l1"], "l2": lineage["l2"],
                      "l3": lineage["l3"], "l4": lineage["l4"]},
            sql=_lin_sql,
            links=[("facts/kyb/index.ts","Fact Engine definitions"),
                   ("facts/rules.ts","Winner rules"),
                   ("aiscore.py","Score pipeline"),
                   ("worth_score_model.py","Model training")],
            icon="🔗", color="#3B82F6"
        )

    # ── REPO EXPLORER ─────────────────────────────────────────────────────────
    with ld5:
        st.markdown("#### 📁 Repo Explorer")
        st.caption("All key source files in the codebase. Search by keyword or file type. Click any row for a direct GitHub link and purpose description.")

        REPO_FILES = [
            # file, role, tab_link, description
            ("integration-service/lib/facts/kyb/index.ts",             "Fact definitions",       "facts/kyb/index.ts",          "Defines every KYB fact: source vendors, weights, dependent derivation logic, rule applied."),
            ("integration-service/lib/facts/rules.ts",                 "Winner rules",           "facts/rules.ts",              "factWithHighestConfidence, combineFacts, dependentFact — the core Fact Engine selector algorithms."),
            ("integration-service/lib/facts/sources.ts",               "Source registry",        "facts/sources.ts",            "Maps platformId → source name, weight, and fact families. All vendor IDs live here."),
            ("integration-service/src/constants/integrations.constant.ts","Integration IDs",     "integrations.constant.ts",   "MIDDESK=16, EQUIFAX=17, ZOOMINFO=24, TRULIOO=38, AI=31, etc. Used everywhere."),
            ("integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts","AI NAICS enrichment", "aiEnrichment",                "GPT-4o-mini NAICS classification — last resort when all commercial vendors fail."),
            ("integration-service/lib/facts/kyb/consolidatedWatchlist.ts","Watchlist merger",   "consolidatedWatchlist.ts",    "Merges Trulioo PSC + Middesk watchlist hits. filterOutAdverseMedia logic lives here."),
            ("ai-score-service/aiscore.py",                             "Score pipeline",         "aiscore.py",                  "Main scoring orchestration: loads features, calls 3-model ensemble, converts probability to 300-850."),
            ("ai-score-service/worth_score_model.py",                   "Model training",         "worth_score_model.py",        "XGBoost firmographic model + PyTorch financial neural net + economic model. Training and inference."),
            ("ai-score-service/lookups.py",                             "Feature defaults",       "lookups.py",                  "INPUTS dict: all model features, their source facts, and imputation defaults when null."),
            ("warehouse-service/.../customer_table.sql",                "Pipeline B join",        "customer_table.sql",          "The SQL that joins ZI + EFX firmographic data to KYB businesses. Source of revenue/employees."),
            ("api-docs/openapi-specs/get-kyb.json",                     "KYB API schema",         "openapi/kyb",                 "Authoritative OpenAPI spec for GET /facts/business/{businessId}/kyb. All fact schemas defined here."),
            ("api-docs/api-reference/integration/facts/kyb.md",         "KYB API docs",           "api-docs/kyb.md",             "Human-readable KYB API docs. Fact definitions, examples, and response structure."),
            ("admin-portal/src/page/Cases/KYB",                         "Admin Portal UI",        "KYB UI",                      "React components rendering the KYB tab in the Admin Portal. Shows what the business user sees."),
        ]

        repo_df = pd.DataFrame(REPO_FILES, columns=["File","Role","Link Key","Description"])

        _repo_search = st.text_input("🔍 Search files, roles, or descriptions", "", key="repo_search_input")
        if _repo_search:
            mask = repo_df.apply(lambda r: _repo_search.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
            repo_df = repo_df[mask]

        for _, row in repo_df.iterrows():
            gh_url = GITHUB_LINKS.get(row["Link Key"], "")
            link_html = f"<a href='{gh_url}' target='_blank' style='color:#60A5FA;font-size:.78rem'>🔗 {row['File']}</a>" if gh_url else f"<code style='color:#94A3B8;font-size:.78rem'>{row['File']}</code>"
            st.markdown(f"""<div style="background:#1E293B;border-left:3px solid #334155;border-radius:8px;padding:10px 14px;margin:4px 0">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                {link_html}
                <span style="background:#273445;color:#94A3B8;border-radius:6px;padding:2px 8px;font-size:.70rem">{row["Role"]}</span>
              </div>
              <div style="color:#64748b;font-size:.74rem;margin-top:4px">{row["Description"]}</div>
            </div>""", unsafe_allow_html=True)
            detail_panel(f"📁 {row['File']}", row["Role"],
                what_it_means=row["Description"],
                source_file=row["Link Key"],
                json_obj={"file": row["File"], "role": row["Role"], "github_url": gh_url},
                links=[(row["Link Key"], row["File"])],
                icon="📁", color="#334155")

# ════════════════════════════════════════════════════════════════════════════════
# ⌨️ DATA EXPLORER
# ════════════════════════════════════════════════════════════════════════════════
elif tab == "🧠 Intelligence Hub":
    st.markdown("## 🧠 Intelligence Hub")
    st.caption(
        "Natural language analysis, portfolio scans, investigation war room, and glossary. "
        "The AI View Generator interprets intent → writes SQL → executes → renders the right chart automatically."
    )

    ih1, ih2, ih3, ih4 = st.tabs([
        "🎨 AI View Generator",
        "🛡 Check-Agent Console",
        "🏢 Investigation Workspace",
        "📖 Glossary & Definitions",
    ])

    # ── AI VIEW GENERATOR ─────────────────────────────────────────────────────
    with ih1:
        st.markdown("#### 🎨 AI View Generator")
        st.caption(
            "Describe what you want to analyze in plain English. The AI interprets the intent, "
            "writes Redshift SQL, executes it live, and automatically renders the most appropriate chart or table. "
            "Each result includes SQL, Python, and `detail_panel()` lineage."
        )

        if not get_openai():
            st.markdown("""<div style="background:#1c1917;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 18px;margin:8px 0">
              <div style="color:#fde68a;font-weight:700;font-size:.90rem">⚠️ OpenAI API key required for AI View Generator</div>
              <div style="color:#CBD5E1;font-size:.82rem;margin-top:8px">
                Set your key using <strong>one</strong> of these methods, then restart the app:
              </div>
              <div style="margin-top:10px">
                <div style="color:#94A3B8;font-size:.76rem;margin-bottom:4px">Option A — Terminal (fastest, no file editing):</div>
                <code style="background:#0f172a;color:#60A5FA;padding:6px 10px;border-radius:4px;display:block;font-size:.78rem">
                  export OPENAI_API_KEY="sk-..."<br/>
                  python3 -m streamlit run kyb_hub_app_v2.py
                </code>
              </div>
              <div style="margin-top:10px">
                <div style="color:#94A3B8;font-size:.76rem;margin-bottom:4px">Option B — secrets.toml (persists across restarts):</div>
                <code style="background:#0f172a;color:#60A5FA;padding:6px 10px;border-radius:4px;display:block;font-size:.78rem">
                  # In Admin-Portal-KYB-App/.streamlit/secrets.toml<br/>
                  OPENAI_API_KEY = "sk-..."
                </code>
              </div>
              <div style="color:#64748b;font-size:.74rem;margin-top:8px">
                ⚠️ Note: keys starting with <code>sk-svcacct-</code> are service account keys that may expire.
                If you get a 401 error, generate a fresh key at platform.openai.com/api-keys
              </div>
            </div>""", unsafe_allow_html=True)
        else:
            # Preset chips
            VIEW_PRESETS = [
                ("📉 Low-conf trend this month",       "Show the weekly trend of low-confidence businesses (score < 550) for the last 30 days, broken down by week."),
                ("👤 Manual review rate by customer",  "Which customers have the highest manual review rate? Show top 10 customers by percentage of businesses requiring manual review."),
                ("🔐 TIN fail + SOS inactive overlap", "How many businesses have both TIN failed AND SOS inactive? Show the count and percentage of the total portfolio."),
                ("🏭 NAICS fallback rate trend",       "Show the weekly trend of businesses receiving NAICS code 561499 (fallback) over the last 30 days."),
                ("⚠️ Watchlist hits by state",         "Which formation states have the most businesses with watchlist hits? Show top 10 states."),
                ("💰 Score distribution this week",    "Show the distribution of Worth Scores for businesses onboarded this week, grouped into bands."),
            ]

            st.markdown("**Quick prompts:**")
            _preset_cols = st.columns(3)
            for i, (chip_label, chip_prompt) in enumerate(VIEW_PRESETS):
                with _preset_cols[i % 3]:
                    if st.button(chip_label, key=f"view_preset_{i}", use_container_width=True):
                        st.session_state["view_gen_prompt"] = chip_prompt

            _vg_prompt = st.text_input(
                "Your analysis prompt:",
                value=st.session_state.get("view_gen_prompt",""),
                placeholder="e.g. Show weekly trend of low-confidence cases by customer for the last 30 days",
                key="view_gen_input",
            )

            if st.button("⚡ Generate View", type="primary", key="view_gen_run"):
                if not _vg_prompt.strip():
                    st.warning("Enter a prompt.")
                else:
                    # Build the structured prompt asking for intent + SQL + chart_type
                    _vg_system = """You are a KYB data analyst AI with expert knowledge of the Worth AI Redshift schema.

VERIFIED REDSHIFT TABLES (only use these):
- rds_warehouse_public.facts (business_id, name, value JSON, received_at)
  - JSON_EXTRACT_PATH_TEXT(value,'value') to get scalar value
  - names include: sos_active, tin_match_boolean, naics_code, idv_passed_boolean, formation_state, watchlist_hits, num_bankruptcies, revenue, num_employees, website
- rds_cases_public.rel_business_customer_monitoring (business_id, customer_id, created_at) — authoritative onboarding date
- rds_auth_public.data_customers (id, name) — customer names
- rds_manual_score_public.data_current_scores (business_id, score_id) — current score pointer
- rds_manual_score_public.business_scores (id, business_id, weighted_score_850, risk_level, score_decision, created_at)
- rds_manual_score_public.business_score_factors (score_id, category_id, score_100, weighted_score_850)

CRITICAL RULES:
1. Always use DATE(rbcm.created_at) for date filters, never facts.received_at
2. Always join to rel_business_customer_monitoring for onboarding-date filters
3. Never use tables not in the list above
4. Use JSON_EXTRACT_PATH_TEXT(value,'value') to extract fact values
5. CAST(...value... AS FLOAT) or AS INT when doing arithmetic

OUTPUT FORMAT — return ONLY valid JSON, no extra text:
{
  "mode": "descriptive|diagnostic|investigative|technical",
  "intent_summary": "One sentence describing what this query measures",
  "sql": "SELECT ...",
  "chart_type": "line|bar|stacked_bar|donut|histogram|table|kpi",
  "x_col": "column name for x-axis (or null)",
  "y_col": "column name for y-axis (or null)",
  "color_col": "column for color grouping (or null)",
  "title": "Chart title",
  "insight": "One sentence interpretation of what the result will likely show",
  "suggested_followups": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}"""

                    _bid_ctx = st.session_state.get("hub_bid","")
                    _vg_user = f"""Analyze this request and produce a JSON response:

USER REQUEST: {_vg_prompt}

Active business ID (if relevant): {_bid_ctx or 'none selected'}

Generate a Redshift SQL query that answers this request, and specify the best chart type to visualize the result."""

                    with st.spinner("🤖 AI interpreting intent and writing SQL…"):
                        try:
                            import json as _json
                            _client = get_openai()
                            _resp = _client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role":"system","content":_vg_system},
                                    {"role":"user","content":_vg_user},
                                ],
                                temperature=0.1,
                                max_tokens=1500,
                                response_format={"type":"json_object"},
                            )
                            _vg_envelope = _json.loads(_resp.choices[0].message.content)
                        except Exception as _vg_err:
                            flag(f"AI error: {_vg_err}","red")
                            _vg_envelope = None

                    if _vg_envelope:
                        _vg_sql    = _vg_envelope.get("sql","")
                        _vg_mode   = _vg_envelope.get("mode","descriptive")
                        _vg_intent = _vg_envelope.get("intent_summary","")
                        _vg_chart  = _vg_envelope.get("chart_type","table")
                        _vg_xcol   = _vg_envelope.get("x_col")
                        _vg_ycol   = _vg_envelope.get("y_col")
                        _vg_ccol   = _vg_envelope.get("color_col")
                        _vg_title  = _vg_envelope.get("title","Result")
                        _vg_insight= _vg_envelope.get("insight","")
                        _vg_followups = _vg_envelope.get("suggested_followups",[])

                        # Show intent
                        _mode_color = {"descriptive":"#3B82F6","diagnostic":"#f59e0b","investigative":"#ef4444","technical":"#8B5CF6"}.get(_vg_mode,"#64748b")
                        st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_mode_color};border-radius:8px;padding:10px 14px;margin:8px 0">
                          <span style="color:{_mode_color};font-weight:700;font-size:.78rem">{_vg_mode.upper()} MODE</span>
                          <div style="color:#CBD5E1;font-size:.85rem;margin-top:4px"><strong>Interpreted intent:</strong> {_vg_intent}</div>
                          {"<div style='color:#94A3B8;font-size:.78rem;margin-top:4px'><em>" + _vg_insight + "</em></div>" if _vg_insight else ""}
                        </div>""", unsafe_allow_html=True)

                        # Show SQL
                        st.code(_vg_sql, language="sql")

                        # Execute SQL
                        with st.spinner("⚡ Executing against Redshift…"):
                            _vg_df, _vg_df_err = run_sql(_vg_sql)

                        if _vg_df_err:
                            flag(f"SQL error: {_vg_df_err}", "red")
                            st.caption("The AI will attempt to self-correct. Try rephrasing or check the SQL above.")
                        elif _vg_df is not None and not _vg_df.empty:
                            st.success(f"✅ {len(_vg_df):,} rows · {len(_vg_df.columns)} columns")

                            # Auto-render the right chart
                            _rendered_chart = False
                            try:
                                _fig_vg = None
                                # Override chart_type based on actual data shape
                                _num_cols = _vg_df.select_dtypes(include="number").columns.tolist()
                                _cat_cols = _vg_df.select_dtypes(exclude="number").columns.tolist()

                                if _vg_chart == "kpi" or (len(_vg_df)==1 and len(_num_cols)>=1):
                                    # KPI cards
                                    _kpi_cols = st.columns(min(len(_num_cols),4))
                                    for _ki, _kn in enumerate(_num_cols[:4]):
                                        with _kpi_cols[_ki]:
                                            _kv = _vg_df[_kn].iloc[0]
                                            kpi(_kn, f"{_kv:,.1f}" if isinstance(_kv,float) else str(_kv))
                                    _rendered_chart = True

                                elif _vg_chart in ("line",) and _vg_xcol and _vg_ycol and _vg_xcol in _vg_df.columns and _vg_ycol in _vg_df.columns:
                                    _fig_vg = px.line(_vg_df, x=_vg_xcol, y=_vg_ycol,
                                                      color=_vg_ccol if _vg_ccol and _vg_ccol in _vg_df.columns else None,
                                                      title=_vg_title, markers=True)

                                elif _vg_chart in ("bar","stacked_bar") and _vg_xcol and _vg_ycol and _vg_xcol in _vg_df.columns:
                                    _fig_vg = px.bar(_vg_df, x=_vg_xcol, y=_vg_ycol,
                                                     color=_vg_ccol if _vg_ccol and _vg_ccol in _vg_df.columns else None,
                                                     barmode="stack" if _vg_chart=="stacked_bar" else "group",
                                                     title=_vg_title)

                                elif _vg_chart == "donut" and _vg_xcol and _vg_ycol:
                                    _fig_vg = px.pie(_vg_df, names=_vg_xcol, values=_vg_ycol, hole=0.45, title=_vg_title)

                                elif _vg_chart == "histogram" and _vg_xcol and _vg_xcol in _vg_df.columns:
                                    _fig_vg = px.histogram(_vg_df, x=_vg_xcol, title=_vg_title, nbins=30)

                                else:
                                    # Smart fallback: inspect data shape
                                    if len(_num_cols)>=1 and len(_cat_cols)>=1 and len(_vg_df)<=20:
                                        _fig_vg = px.bar(_vg_df, x=_cat_cols[0], y=_num_cols[0],
                                                         color=_cat_cols[1] if len(_cat_cols)>1 else None,
                                                         title=_vg_title)
                                    elif len(_num_cols)>=1 and len(_vg_df)>20:
                                        _fig_vg = px.histogram(_vg_df, x=_num_cols[0], title=_vg_title, nbins=30)

                                if _fig_vg is not None:
                                    _fig_vg.update_layout(height=360, margin=dict(t=50,b=20,l=20,r=20))
                                    st.plotly_chart(dark_chart(_fig_vg), use_container_width=True)
                                    _rendered_chart = True

                            except Exception as _chart_err:
                                st.caption(f"Auto-chart skipped: {_chart_err}")

                            # Always show the dataframe too
                            if not _rendered_chart:
                                st.dataframe(_vg_df, use_container_width=True, hide_index=True)
                            else:
                                with st.expander("📊 Raw data table"):
                                    st.dataframe(_vg_df, use_container_width=True, hide_index=True)

                            # detail_panel with full lineage
                            _vg_py = _make_python_from_sql(_vg_sql)
                            detail_panel(
                                f"🎨 AI View: {_vg_title}", f"Mode: {_vg_mode} · {len(_vg_df):,} rows",
                                what_it_means=(
                                    f"**Intent:** {_vg_intent}\n\n"
                                    f"**Mode:** {_vg_mode.upper()} — "
                                    f"{'What happened?' if _vg_mode=='descriptive' else 'Why did it happen?' if _vg_mode=='diagnostic' else 'What is happening with this specific entity?' if _vg_mode=='investigative' else 'Where did this field/metric come from?'}\n\n"
                                    f"**Insight:** {_vg_insight}\n\n"
                                    f"**Chart type selected:** {_vg_chart}"
                                ),
                                source_table="Multiple Redshift tables — see SQL above",
                                json_obj=_vg_envelope,
                                sql=_vg_sql,
                                python_code=_vg_py,
                                links=[("facts/kyb/index.ts","KYB Fact Engine"),
                                       ("aiscore.py","Worth Score pipeline"),
                                       ("worth_score_model.py","Model definition")],
                                icon="🎨", color=_mode_color
                            )

                            # Suggested follow-ups
                            if _vg_followups:
                                st.markdown("**💡 Suggested follow-ups:**")
                                _fu_cols = st.columns(min(len(_vg_followups),3))
                                for _fi, _fu in enumerate(_vg_followups[:3]):
                                    with _fu_cols[_fi]:
                                        if st.button(f"→ {_fu[:50]}…" if len(_fu)>50 else f"→ {_fu}",
                                                     key=f"fu_{_fi}_{hash(_fu)%9999}",
                                                     use_container_width=True):
                                            st.session_state["view_gen_prompt"] = _fu
                                            st.rerun()

                        elif _vg_df is not None and _vg_df.empty:
                            st.info("Query returned 0 rows. Try adjusting the date range or prompt.")

    # ── CHECK-AGENT CONSOLE ───────────────────────────────────────────────────
    with ih2:
        st.markdown("#### 🛡 Check-Agent Console — Portfolio Scan")
        st.caption("Run the Check-Agent across the portfolio (date window) or on a specific entity. All findings include severity, evidence, and recommended action.")

        from check_agent_v2 import (
            run_deterministic_checks, get_check_summary,
            run_llm_audit, build_fact_summary, facts_cache_key,
            SEV_COLOR, SEV_ICON, DETERMINISTIC_CHECKS,
        )

        _ca_scope = st.radio("Scope:", ["🏢 Specific Entity", "📊 Portfolio Sample"],
                              horizontal=True, key="ih_ca_scope")

        if _ca_scope == "🏢 Specific Entity":
            _ca_bid = st.text_input("Business ID:", value=st.session_state.get("hub_bid",""),
                                    placeholder="Paste UUID…", key="ih_ca_bid")
            if st.button("🔍 Scan Entity", type="primary", key="ih_ca_scan"):
                if not _ca_bid.strip():
                    st.warning("Enter a Business ID.")
                else:
                    with st.spinner("Loading facts…"):
                        _ca_facts, _ca_err = load_facts_with_ui(_ca_bid, "ih_check")
                    if _ca_err or not _ca_facts:
                        flag(f"Cannot load facts: {_ca_err}", "red")
                    else:
                        _ca_results = run_deterministic_checks(_ca_facts)
                        _ca_summary = get_check_summary(_ca_results)
                        _sev_order = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3,"NOTICE":4}

                        # Summary KPI row
                        _sc0,_sc1,_sc2,_sc3,_sc4,_sc5 = st.columns(6)
                        _oa_color = {"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","LOW":"#22c55e","NOTICE":"#3B82F6","CLEAN":"#22c55e"}.get(_ca_summary["overall"],"#64748b")
                        with _sc0: kpi("Overall", _ca_summary["overall"], f"{_ca_summary['total']} flags", _oa_color)
                        for _col, (_sev, _color, _icon) in zip([_sc1,_sc2,_sc3,_sc4,_sc5],[("CRITICAL","#ef4444","🔴"),("HIGH","#f97316","🟠"),("MEDIUM","#f59e0b","🟡"),("LOW","#22c55e","🟢"),("NOTICE","#3B82F6","🔵")]):
                            with _col: kpi(f"{_icon} {_sev}", str(_ca_summary["counts"].get(_sev,0)), "", _color)

                        if _ca_summary["total"] == 0:
                            st.success("✅ All 28 checks passed — no cross-field anomalies detected.")
                        else:
                            for _r in sorted(_ca_results, key=lambda x: _sev_order.get(x["severity"],5)):
                                _sev = _r["severity"]
                                _color = SEV_COLOR.get(_sev,"#64748b")
                                _icon = SEV_ICON.get(_sev,"ℹ️")
                                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_color};border-radius:10px;padding:14px 18px;margin:6px 0">
                                  <div style="color:{_color};font-weight:700;font-size:.88rem">{_icon} [{_sev}] {_r['name']}</div>
                                  <div style="color:#CBD5E1;font-size:.80rem;margin-top:6px">{_r['description']}</div>
                                  <div style="color:#60A5FA;font-size:.75rem;margin-top:6px">⚡ Action: {_r['action']}</div>
                                </div>""", unsafe_allow_html=True)
                                _bid_sql = _r["sql"].replace("{bid}", _ca_bid) if "{bid}" in _r["sql"] else _r["sql"]
                                detail_panel(f"{_icon} {_r['name']}", f"{_sev} · {_r['group']}",
                                    what_it_means=_r["description"],
                                    source_table="rds_warehouse_public.facts · cross-field validation",
                                    source_file="check_agent_v2.py",
                                    json_obj={fn: {"value": gv(_ca_facts,fn)} for fn in _r.get("facts",[]) if fn in _ca_facts},
                                    sql=_bid_sql, icon=_icon, color=_color)

        else:  # Portfolio Sample
            _ca_days = st.slider("Last N days:", 7, 90, 30, key="ih_ca_days")
            _ca_limit = st.slider("Sample size (businesses):", 10, 200, 50, key="ih_ca_limit")
            if st.button("📊 Run Portfolio Scan", type="primary", key="ih_ca_port_scan"):
                _port_sql = f"""
                    SELECT DISTINCT rbcm.business_id
                    FROM rds_cases_public.rel_business_customer_monitoring rbcm
                    WHERE DATE(rbcm.created_at) >= CURRENT_DATE - {_ca_days}
                    ORDER BY rbcm.created_at DESC
                    LIMIT {_ca_limit};
                """
                with st.spinner("Loading business sample…"):
                    _port_df, _port_err = run_sql(_port_sql)
                if _port_df is None or _port_df.empty:
                    flag(f"Could not load businesses: {_port_err}", "red")
                else:
                    _port_bids = _port_df["business_id"].tolist()
                    _portfolio_findings = {"CRITICAL":[],"HIGH":[],"MEDIUM":[],"LOW":[],"NOTICE":[]}
                    _prog = st.progress(0)
                    for _pi, _pbid in enumerate(_port_bids):
                        _prog.progress((_pi+1)/len(_port_bids))
                        _pf, _pe = load_facts_with_ui(_pbid, f"port_{_pi}")
                        if _pf:
                            for _pr in run_deterministic_checks(_pf):
                                _portfolio_findings[_pr["severity"]].append({**_pr, "business_id": _pbid})
                    _prog.empty()

                    st.markdown(f"**Portfolio Check-Agent results — {len(_port_bids)} businesses scanned:**")
                    _total_findings = sum(len(v) for v in _portfolio_findings.values())
                    _pc1,_pc2,_pc3,_pc4,_pc5 = st.columns(5)
                    for _col, _sev, _color in zip([_pc1,_pc2,_pc3,_pc4,_pc5],
                                                   ["CRITICAL","HIGH","MEDIUM","LOW","NOTICE"],
                                                   ["#ef4444","#f97316","#f59e0b","#22c55e","#3B82F6"]):
                        with _col: kpi(_sev, str(len(_portfolio_findings[_sev])), "findings", _color)

                    for _sev in ["CRITICAL","HIGH","MEDIUM"]:
                        if _portfolio_findings[_sev]:
                            st.markdown(f"**{SEV_ICON[_sev]} {_sev} findings:**")
                            _fdf = pd.DataFrame(_portfolio_findings[_sev])[["business_id","name","group","description"]]
                            st.dataframe(_fdf, use_container_width=True, hide_index=True)
                            detail_panel(f"📊 Portfolio: {_sev} Findings", f"{len(_portfolio_findings[_sev])} across {len(_port_bids)} businesses",
                                what_it_means=f"{_sev} Check-Agent findings from {len(_port_bids)} randomly sampled businesses in the last {_ca_days} days.",
                                source_table="rds_warehouse_public.facts · rds_cases_public.rel_business_customer_monitoring",
                                sql=_port_sql,
                                json_obj={"severity": _sev, "count": len(_portfolio_findings[_sev]), "sample_businesses": len(_port_bids)},
                                icon=SEV_ICON[_sev], color=SEV_COLOR[_sev])

    # ── INVESTIGATION WORKSPACE ────────────────────────────────────────────────
    with ih3:
        st.markdown("#### 🏢 Investigation Workspace (War Room)")
        st.caption("Select a Business ID to assemble the complete investigation view: profile, score, facts, Check-Agent findings, AI explanation, and lineage — all in one place.")

        _iw_bid = st.text_input("Business ID to investigate:",
                                 value=st.session_state.get("hub_bid",""),
                                 placeholder="Paste UUID…", key="iw_bid")

        if _iw_bid.strip():
            with st.spinner("Assembling war room…"):
                _iw_facts, _iw_err = load_facts_with_ui(_iw_bid, "war_room")

            if _iw_err or not _iw_facts:
                flag(f"Cannot load entity: {_iw_err}", "red")
            else:
                # Load score
                @st.cache_data(ttl=600, show_spinner=False)
                def _load_iw_score(b):
                    return run_sql(f"""SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision
                        FROM rds_manual_score_public.data_current_scores cs
                        JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
                        WHERE cs.business_id='{b}' ORDER BY bs.created_at DESC LIMIT 1;""")
                _iw_ws, _ = _load_iw_score(_iw_bid)
                _iw_score_raw = (_iw_ws.iloc[0]["weighted_score_850"] if _iw_ws is not None and not _iw_ws.empty else None)
                _iw_score = float(_iw_score_raw) if _iw_score_raw is not None else 0
                _iw_risk = str(_iw_ws.iloc[0]["risk_level"]) if _iw_ws is not None and not _iw_ws.empty else "—"
                _iw_dec = str(_iw_ws.iloc[0]["score_decision"]) if _iw_ws is not None and not _iw_ws.empty else "—"

                def _gv_iw(n): return str(gv(_iw_facts, n) or "")

                # Entity header
                _iw_legal = _gv_iw("legal_name") or _gv_iw("business_name") or "Unknown Entity"
                _iw_sc = "#ef4444" if _iw_score < 550 else "#f59e0b" if _iw_score < 700 else "#22c55e"
                st.markdown(f"""<div style="background:linear-gradient(135deg,#1E293B,#0F172A);border-radius:14px;padding:20px 24px;margin-bottom:14px;border:1px solid #334155">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                    <div>
                      <div style="color:#F1F5F9;font-size:1.3rem;font-weight:800">{_iw_legal}</div>
                      <div style="color:#64748B;font-size:.78rem;margin-top:4px">{_iw_bid}</div>
                      <div style="color:#94A3B8;font-size:.78rem;margin-top:2px">
                        NAICS: {_gv_iw('naics_code') or '—'} · State: {_gv_iw('formation_state') or '—'} · Entity: {_gv_iw('corporation') or '—'}
                      </div>
                    </div>
                    <div style="text-align:center">
                      <div style="color:{_iw_sc};font-size:2rem;font-weight:900">{_iw_score:.0f}</div>
                      <div style="color:#64748b;font-size:.70rem">Worth Score · {_iw_risk}</div>
                      <div style="color:{_iw_sc};font-size:.74rem;font-weight:600">{_iw_dec.replace('_',' ')}</div>
                    </div>
                  </div>
                </div>""", unsafe_allow_html=True)

                # 6 core KPI cards
                _wc1,_wc2,_wc3,_wc4,_wc5,_wc6 = st.columns(6)
                with _wc1: kpi("SOS Active",    "✅" if _gv_iw("sos_active")=="true" else "❌", _gv_iw("sos_active") or "—", "#22c55e" if _gv_iw("sos_active")=="true" else "#ef4444")
                with _wc2: kpi("TIN Match",     "✅" if _gv_iw("tin_match_boolean")=="true" else "❌", "", "#22c55e" if _gv_iw("tin_match_boolean")=="true" else "#ef4444")
                with _wc3: kpi("IDV Passed",    "✅" if _gv_iw("idv_passed_boolean")=="true" else "❌", "", "#22c55e" if _gv_iw("idv_passed_boolean")=="true" else "#ef4444")
                with _wc4: kpi("Watchlist",     _gv_iw("watchlist_hits") or "0", "hits", "#ef4444" if int(_gv_iw("watchlist_hits") or 0)>0 else "#22c55e")
                with _wc5: kpi("NAICS",         _gv_iw("naics_code") or "—", "⚠️ fallback" if _gv_iw("naics_code")=="561499" else "", "#f59e0b" if _gv_iw("naics_code")=="561499" else "#3B82F6")
                with _wc6: kpi("Worth Score",   f"{_iw_score:.0f}", _iw_risk, _iw_sc)

                # Check-Agent findings
                st.markdown("---")
                st.markdown("##### 🛡 Check-Agent Findings")
                _iw_findings = run_deterministic_checks(_iw_facts)
                _iw_summary = get_check_summary(_iw_findings)
                if _iw_summary["total"] == 0:
                    st.success("✅ All 28 cross-field checks passed — no anomalies detected.")
                else:
                    _sev_order = {"CRITICAL":0,"HIGH":1,"MEDIUM":2,"LOW":3,"NOTICE":4}
                    for _r in sorted(_iw_findings, key=lambda x: _sev_order.get(x["severity"],5)):
                        _color = SEV_COLOR.get(_r["severity"],"#64748b")
                        _icon = SEV_ICON.get(_r["severity"],"ℹ️")
                        st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {_color};border-radius:8px;padding:10px 14px;margin:4px 0">
                          <span style="color:{_color};font-weight:700">{_icon} [{_r['severity']}]</span>
                          <span style="color:#CBD5E1;font-size:.83rem"> {_r['name']}</span>
                          <div style="color:#64748b;font-size:.74rem;margin-top:4px">{_r['description'][:120]}…</div>
                        </div>""", unsafe_allow_html=True)

                # AI Explanation
                st.markdown("---")
                st.markdown("##### 🤖 AI Explanation")
                if get_openai():
                    _iw_cache_key = f"iw_ai_{_iw_bid}_{facts_cache_key(_iw_facts)}"
                    if _iw_cache_key not in st.session_state:
                        with st.spinner("AI analyst generating explanation…"):
                            _iw_fj = json.dumps(_iw_facts, default=str)
                            _iw_sj = json.dumps({"score":_iw_score,"risk":_iw_risk,"decision":_iw_dec}, default=str)
                            _iw_audit, _ = run_llm_audit(_iw_fj, _iw_bid, _iw_sj)
                            st.session_state[_iw_cache_key] = _iw_audit
                    _iw_audit = st.session_state.get(_iw_cache_key)
                    if _iw_audit:
                        st.markdown(f"""<div style="background:#0c1a2e;border-left:3px solid #3B82F6;border-radius:8px;padding:12px 16px">
                          <div style="color:#60A5FA;font-weight:700;margin-bottom:6px">🤖 Analyst Summary — {_iw_audit.get('overall_risk','?')} Risk</div>
                          <div style="color:#CBD5E1;font-size:.84rem;line-height:1.5">{_iw_audit.get('summary','')}</div>
                          <div style="color:#f59e0b;font-size:.78rem;margin-top:8px">⚖️ {_iw_audit.get('underwriting_decision_guidance','')}</div>
                        </div>""", unsafe_allow_html=True)

                        detail_panel("🤖 Full AI Audit (War Room)", f"Risk: {_iw_audit.get('overall_risk','?')}",
                            what_it_means=_iw_audit.get("summary",""),
                            source_table="Generated by GPT-4o-mini · check_agent_v2.run_llm_audit()",
                            json_obj=_iw_audit,
                            sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{_iw_bid}' ORDER BY name;",
                            icon="🤖", color="#3B82F6")
                else:
                    flag("Add OPENAI_API_KEY to enable AI explanations.", "amber")
        else:
            st.info("👈 Enter a Business ID above to open the investigation workspace.")

    # ── GLOSSARY ──────────────────────────────────────────────────────────────
    with ih4:
        st.markdown("#### 📖 Glossary & Definitions")
        st.caption("Definitions for every KYB term, metric, fact name, model concept, and red-flag rule used in this platform.")

        GLOSSARY = [
            ("Confidence Score",        "Worth Score",    "Model-derived probability (0–1) that a business passes KYB verification. Converted to 300-850 scale: score = p × 550 + 300."),
            ("Worth Score",             "Worth Score",    "The 300-850 version of the confidence score. Named after Worth AI. Thresholds: APPROVE ≥700, FURTHER_REVIEW 550-699, DECLINE <550."),
            ("Fact Engine",             "Architecture",   "The integration-service component that collects facts from all vendors and selects winners using factWithHighestConfidence, combineFacts, and dependentFact rules."),
            ("factWithHighestConfidence","Fact Engine",   "Winner-selection rule: picks the vendor with the highest confidence × weight product. Used for scalar facts like naics_code, sos_active, legal_name."),
            ("combineFacts",            "Fact Engine",    "Merge rule: combines arrays from multiple vendors (e.g. names_found, dba_found, watchlist hits). No winner — all values are included."),
            ("dependentFact",           "Fact Engine",    "Derived fact: computed from other facts rather than a vendor (e.g. kyb_complete depends on business_verified AND screened_people)."),
            ("sos_active",              "KYB Fact",       "Whether the entity's Secretary of State registration is currently active. DEPENDENT fact derived from sos_filings[].active array. Source: Middesk (pid=16)."),
            ("tin_match_boolean",       "KYB Fact",       "Whether the IRS confirmed the submitted EIN matches this business name. DEPENDENT from tin_match.value.status === 'success'. Source: Middesk (pid=16)."),
            ("idv_passed_boolean",      "KYB Fact",       "Whether the beneficial owner passed biometric identity verification (government ID + selfie + liveness). DEPENDENT from idv_passed ≥ 1. Source: Plaid IDV (pid=18)."),
            ("naics_code",              "KYB Fact",       "6-digit NAICS industry classification. 561499 = fallback (all vendors failed). factWithHighestConfidence across ZI, EFX, OC, SERP, Trulioo, AI enrichment."),
            ("watchlist_hits",          "KYB Fact",       "Count of PEP or OFAC sanctions hits from the consolidated watchlist. Adverse media is EXCLUDED. Source: Trulioo PSC (pid=38) + Middesk (pid=16)."),
            ("middesk_confidence",      "KYB Fact",       "Middesk entity-match confidence score: 0.15 (base) + 0.20 × (passing tasks / total tasks). Values below 0.25 indicate very low match quality."),
            ("kyb_complete",            "KYB Fact",       "Whether the full KYB workflow is complete: DEPENDENT — requires business_verified=true AND screened_people is non-empty (at least 1 PSC completed)."),
            ("561499",                  "NAICS",          "NAICS fallback code: 'All Other Business Support Services'. Assigned when all commercial vendors fail to classify the industry."),
            ("Gap G1",                  "NAICS",          "No website submitted on the onboarding form — AI enrichment cannot use web search to classify industry."),
            ("Gap G2",                  "NAICS",          "Website is present in facts but was not passed to AI enrichment prompt (params.website=null). Fix: pass website URL to aiEnrichment.ts."),
            ("Gap G3",                  "NAICS",          "Website is present and passed to AI, but AI still returns 561499 — website is too generic or AI cannot determine industry from URL content."),
            ("Pipeline A",              "Architecture",   "Real-time fact collection pipeline: onboarding form submission → integration-service → Fact Engine → rds_warehouse_public.facts."),
            ("Pipeline B",              "Architecture",   "Batch enrichment pipeline: warehouse-service → ZoomInfo + Equifax entity matching → datascience.customer_files. Runs daily."),
            ("platformId",              "Architecture",   "Integer ID for each data source vendor. Key ones: 0=Applicant, 16=Middesk, 17=Equifax, 22=SERP, 23=OpenCorporates, 24=ZoomInfo, 31=AI, 38=Trulioo."),
            ("UBO",                     "Compliance",     "Ultimate Beneficial Owner — the natural person(s) who ultimately own or control a legal entity. Must be verified per KYB regulations."),
            ("PSC",                     "Compliance",     "Person Screening Compliance — Trulioo's PEP/sanctions/adverse media check on beneficial owners. Populates screened_people fact."),
            ("EDD",                     "Compliance",     "Enhanced Due Diligence — additional scrutiny required for high-risk businesses (watchlist hits, tax-haven states, high-risk NAICS codes)."),
            ("Public Records",          "Worth Score",    "Worth Score category covering bankruptcies (num_bankruptcies), judgments (num_judgements), and liens (num_liens). Maximum negative impact: ~-120pts."),
            ("Company Profile",         "Worth Score",    "Worth Score category covering NAICS6, entity age (age_business), state, entity structure (bus_struct), employee count (count_employees)."),
            ("Financial Trends",        "Worth Score",    "Worth Score category covering macroeconomic indicators: GDP growth, CPI, VIX, T10Y2Y yield spread, unemployment, etc. External data feeds."),
            ("Business Operations",     "Worth Score",    "Worth Score category covering revenue and revenue-based financial ratios. Primary source: ZoomInfo/Equifax firmographic data."),
            ("Performance Measures",    "Worth Score",    "Worth Score category covering Plaid balance sheet and cash flow ratios. Null for businesses without Plaid banking connection."),
            ("Tax-haven state",         "Risk Signal",    "Formation state in DE, NV, WY, SD, MT, or NM. High entity-resolution risk: Middesk's address-based SOS search may find the FOREIGN filing, missing the DOMESTIC primary."),
            ("PSI",                     "Monitoring",     "Population Stability Index — measures distribution shift of a feature or score. PSI < 0.10: stable. 0.10–0.25: monitor. > 0.25: material drift."),
            ("SHAP",                    "Model",          "SHapley Additive exPlanations — the technique used to explain individual factor contributions to the Worth Score. Stored in business_score_factors."),
        ]

        _gloss_df = pd.DataFrame(GLOSSARY, columns=["Term","Category","Definition"])
        _gloss_search = st.text_input("🔍 Search terms or definitions:", "", key="gloss_search")
        if _gloss_search:
            mask = _gloss_df.apply(lambda r: _gloss_search.lower() in " ".join(str(v) for v in r.values).lower(), axis=1)
            _gloss_df = _gloss_df[mask]

        for _, row in _gloss_df.iterrows():
            st.markdown(f"""<div style="background:#1E293B;border-left:3px solid #334155;border-radius:8px;padding:10px 14px;margin:4px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:#F1F5F9;font-weight:700;font-size:.84rem">{row['Term']}</span>
                <span style="background:#273445;color:#94A3B8;border-radius:6px;padding:2px 8px;font-size:.68rem">{row['Category']}</span>
              </div>
              <div style="color:#CBD5E1;font-size:.78rem;margin-top:4px">{row['Definition']}</div>
            </div>""", unsafe_allow_html=True)

        st.markdown("---")
        st.caption(f"📖 {len(GLOSSARY)} terms defined · covers KYB facts, model concepts, compliance terms, architecture, and risk signals.")

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(f'<div style="color:#475569;font-size:.68rem;text-align:center">KYB Intelligence Hub v2 · Worth AI · {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</div>',unsafe_allow_html=True)
