"""
KYB Intelligence Hub — kyb_hub_app.py
========================================
Full per-business KYB investigation with complete data lineage,
winning source + alternatives + confidence, SQL/Python code,
analyst explanations, per-card AI quick-questions, global AI agent.

Run:   streamlit run Admin-Portal-KYB-App/kyb_hub_app.py
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

st.set_page_config(page_title="KYB Intelligence Hub", page_icon="🔬",
                   layout="wide", initial_sidebar_state="expanded")
BASE = Path(__file__).parent

# ── Theme: default = dark, user can toggle to light ───────────────────────────
if "theme_mode" not in st.session_state:
    st.session_state["theme_mode"] = "dark"
_dark = st.session_state["theme_mode"] == "dark"

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

# ── CSS — dark / light themes ─────────────────────────────────────────────────
if _dark:
    _bg          = "#0A0F1E"
    _bg2         = "#1E293B"
    _bg3         = "#0C1A2E"
    _border      = "#1E3A5F"
    _text        = "#F1F5F9"
    _text_sub    = "#94A3B8"
    _text_muted  = "#64748B"
    _text_body   = "#CBD5E1"
    _accent      = "#60A5FA"
    _flag_red_bg = "#1f0a0a"; _flag_red_txt   = "#fca5a5"
    _flag_amb_bg = "#1c1917"; _flag_amb_txt   = "#fde68a"
    _flag_grn_bg = "#052e16"; _flag_grn_txt   = "#86efac"
    _flag_blu_bg = "#0c1a2e"; _flag_blu_txt   = "#93c5fd"
    _card_bg     = "#1E293B"
    _pre_bg      = "#0f172a"
    _badge_bg    = "#1e3a5f"; _badge_txt = "#60A5FA"
    _streamlit_override = ""  # dark = default, no Streamlit-level override needed
else:
    _bg          = "#F8FAFC"
    _bg2         = "#FFFFFF"
    _bg3         = "#EFF6FF"
    _border      = "#BFDBFE"
    _text        = "#0F172A"
    _text_sub    = "#475569"
    _text_muted  = "#64748B"
    _text_body   = "#1E293B"
    _accent      = "#2563EB"
    _flag_red_bg = "#FEF2F2"; _flag_red_txt   = "#B91C1C"
    _flag_amb_bg = "#FFFBEB"; _flag_amb_txt   = "#92400E"
    _flag_grn_bg = "#F0FDF4"; _flag_grn_txt   = "#166534"
    _flag_blu_bg = "#EFF6FF"; _flag_blu_txt   = "#1D4ED8"
    _card_bg     = "#FFFFFF"
    _pre_bg      = "#F1F5F9"
    _badge_bg    = "#DBEAFE"; _badge_txt = "#1D4ED8"
    # Override Streamlit's own dark theme with light colours
    _streamlit_override = f"""
    .stApp {{ background-color: {_bg} !important; color: {_text} !important; }}
    section[data-testid="stSidebar"] {{ background-color: #F1F5F9 !important; }}
    section[data-testid="stSidebar"] * {{ color: {_text} !important; }}
    .stTextInput input, .stSelectbox div, .stDateInput input {{
        background:#FFFFFF !important; color:{_text} !important; border-color:#CBD5E1 !important;
    }}
    .stMarkdown, .stMarkdown p, .stMarkdown li {{ color: {_text_body} !important; }}
    .stDataFrame {{ background: #FFFFFF !important; }}
    .stExpander {{ background: #FFFFFF !important; border: 1px solid #E2E8F0 !important; }}
    .stExpander summary {{ color: {_accent} !important; }}
    .stButton button {{ background: {_accent} !important; color: #FFFFFF !important; }}
    .stCaption, .stCaption p {{ color: {_text_muted} !important; }}
    code {{ background: #E2E8F0 !important; color: #1E293B !important; }}
    pre {{ background: {_pre_bg} !important; color: {_text_body} !important; }}
    """

st.markdown(f"""<style>
{_streamlit_override}
  .main{{background:{_bg}}}
  .kpi{{background:{_bg2};border-radius:10px;padding:14px 18px;border-left:4px solid #3B82F6;margin-bottom:6px}}
  .kpi .lbl{{color:{_text_sub};font-size:.75rem;text-transform:uppercase;letter-spacing:.05em}}
  .kpi .val{{color:{_text};font-size:1.4rem;font-weight:700}}
  .kpi .sub{{color:{_text_muted};font-size:.75rem;margin-top:2px}}
  .analyst{{background:{_bg3};border:1px solid {_border};border-radius:10px;padding:14px 16px;margin:8px 0}}
  .analyst .hdr{{color:{_accent};font-weight:700;font-size:.86rem;margin-bottom:6px}}
  .analyst p{{color:{_text_body};font-size:.82rem;margin:3px 0;line-height:1.6}}
  .flow-step{{background:{_bg2};border-left:3px solid #3B82F6;border-radius:8px;
  padding:9px 14px;margin:3px 0;font-size:.80rem;color:{_text_body}}}
  .flag-red{{background:{_flag_red_bg};border-left:4px solid #ef4444;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:{_flag_red_txt};font-size:.82rem}}
  .flag-amber{{background:{_flag_amb_bg};border-left:4px solid #f59e0b;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:{_flag_amb_txt};font-size:.82rem}}
  .flag-green{{background:{_flag_grn_bg};border-left:4px solid #22c55e;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:{_flag_grn_txt};font-size:.82rem}}
  .flag-blue{{background:{_flag_blu_bg};border-left:4px solid #60a5fa;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:{_flag_blu_txt};font-size:.82rem}}
  details summary{{font-size:.80rem !important}}
  details pre{{font-size:.78rem !important}}
  .src-badge a{{font-size:.75rem;background:{_badge_bg};color:{_badge_txt};}}
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
    """Apply the current theme (dark or light) to a Plotly figure."""
    is_light = st.session_state.get("theme_mode","dark") == "light"
    if is_light:
        fig.update_layout(
            paper_bgcolor="#FFFFFF", plot_bgcolor="#F8FAFC",
            font_color="#0F172A",
            legend=dict(bgcolor="#F1F5F9", bordercolor="#E2E8F0"),
            margin=dict(t=50,b=10,l=10,r=10)
        )
    else:
        fig.update_layout(
            paper_bgcolor="#0A0F1E", plot_bgcolor="#1E293B",
            font_color="#E2E8F0",
            legend=dict(bgcolor="#1E293B"),
            margin=dict(t=50,b=10,l=10,r=10)
        )
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
        ORDER BY ABS(weighted_score_850) DESC LIMIT 20""")

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
    return run_sql("SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 30")

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
    try:
        from openai import OpenAI
        # 1. Environment variable
        key = os.getenv("OPENAI_API_KEY","")
        # 2. Streamlit secrets (secrets.toml or Streamlit Cloud secrets)
        if not key:
            try:
                key = st.secrets["OPENAI_API_KEY"]
            except Exception:
                pass
        # 3. Hardcoded fallback for local dev (do not commit real keys to git)
        if not key:
            key = ""
        if not key or not str(key).startswith("sk-"):
            return None
        return OpenAI(api_key=str(key))
    except Exception:
        return None

SYSTEM="""You are the KYB Intelligence Hub AI — expert on Worth AI's KYB data pipeline.

CRITICAL RULES — NEVER VIOLATE:
1. ONLY reference tables and schemas that ACTUALLY EXIST in the database (listed below).
   NEVER invent, guess, or hallucinate table names, schema names, column names, or fact names.
   If a table does not appear in the verified list below, say "I don't have verified schema info for that — use the SQL Runner to explore."
2. Always provide working SQL using ONLY the verified schemas below.
3. Redshift SQL: use JSON_EXTRACT_PATH_TEXT(col, 'key'), NEVER use ->> or ::json (fails on federation).
4. Always cite the exact source file, table, fact name, and API endpoint.
5. Platform IDs (INTEGRATION_ID enum from integrations.constant.ts):
   16=Middesk · 23=OpenCorporates · 24=ZoomInfo · 17=Equifax · 38=Trulioo · 31=AI(GPT) ·
   22=SERP · 40=Plaid/KYX · 18=Plaid IDV · 0=Applicant · -1=System/Dependent

VERIFIED REDSHIFT SCHEMAS AND TABLES (these ACTUALLY EXIST — use ONLY these):

-- PRIMARY KYB DATA SOURCE:
rds_warehouse_public.facts
  Columns: business_id (VARCHAR), name (VARCHAR), value (VARCHAR/JSON), received_at (TIMESTAMP)
  Note: value contains the full JSON fact object. Use JSON_EXTRACT_PATH_TEXT to extract fields.
  Key fields inside value JSON:
    JSON_EXTRACT_PATH_TEXT(value, 'value')                  → the actual fact value
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')   → winning vendor ID
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')   → confidence score
    JSON_EXTRACT_PATH_TEXT(value, 'ruleApplied', 'name')    → Fact Engine rule
    JSON_EXTRACT_PATH_TEXT(value, 'alternatives')           → JSON array of losing vendors
  CRITICAL: There is NO separate columns for source, confidence, rule_applied, alternatives, is_winning.
  Everything is inside the 'value' JSON column. DO NOT reference non-existent columns.

-- ONBOARDING DATE SOURCE (use for date filtering — NOT facts.received_at):
rds_cases_public.rel_business_customer_monitoring
  Columns: business_id, customer_id, created_at (true onboarding date), updated_at

-- WORTH SCORE:
rds_manual_score_public.data_current_scores
  Columns: business_id, score_id
rds_manual_score_public.business_scores
  Columns: id (= score_id), weighted_score_850, weighted_score_100, risk_level, score_decision, created_at
rds_manual_score_public.business_score_factors
  Columns: score_id, category_id, score_100, weighted_score_850

-- WATCHLIST / BERT:
rds_integration_data.business_entity_review_task
  Columns: id, business_entity_verification_id, key, status, sublabel, created_at, metadata (JSONB)
rds_integration_data.business_entity_verification
  Columns: id, business_id, created_at, updated_at

-- CUSTOMER TABLE (aggregated):
clients.customer_table
  Columns: business_id, customer_id, worth_score, watchlist_count, watchlist_verification, etc.

-- WORTH SCORE AUDIT:
warehouse.worth_score_input_audit
  Columns: score_date, fill_* columns (fill rate per feature)

-- LARGE FACTS (too large for Redshift federation — query PostgreSQL RDS port 5432 instead):
  Fact names: sos_filings, watchlist, watchlist_raw, bankruptcies, judgements, liens, people, addresses
  Use: SELECT value->'value' FROM rds_warehouse_public.facts WHERE business_id='...' AND name='sos_filings';
  (JSONB operators work on PostgreSQL RDS, not on Redshift federation)

TABLES THAT DO NOT EXIST (never reference these):
  - integration_data.kyb_facts  (DOES NOT EXIST — hallucinated schema)
  - rds_warehouse_public.kyb_facts  (DOES NOT EXIST)
  - Any table with columns: fact_name, winning_value, winning_source, winning_confidence, rule_applied, is_winning, alternatives (as separate columns — they do not exist, everything is in value JSON)

CORRECT SQL PATTERN for all KYB facts with source lineage:
SELECT
    name                                                          AS fact_name,
    JSON_EXTRACT_PATH_TEXT(value, 'value')                        AS fact_value,
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')         AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')         AS confidence,
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'name')               AS vendor_name,
    JSON_EXTRACT_PATH_TEXT(value, 'ruleApplied', 'name')          AS rule_applied,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{{business_id}}'
ORDER BY name;
-- Note: alternatives[] are nested inside value JSON, not a separate column.
-- To see alternatives: JSON_EXTRACT_PATH_TEXT(value, 'alternatives')
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


def ask_ai(question, context="", history=None):
    client=get_openai()
    if not client: return "⚠️ Set OPENAI_API_KEY env var to enable AI responses."
    chunks=rag_search(question,top_k=6)
    rag="\n\n".join(f"[{c['source_type']}] {c['description']}\n{c['text'][:600]}" for c in chunks)
    msgs=[{"role":"system","content":SYSTEM}]
    if history: msgs.extend(history[-8:])
    msgs.append({"role":"user","content":f"RAG:\n{rag}\n\nContext:\n{context}\n\nQuestion: {question}"})
    # ── Source-type → GitHub URL resolver ────────────────────────────────────
    REPO_BASE = REPO  # feature branch URL, already defined above
    def _chunk_github_url(chunk: dict) -> str:
        """Return a clickable GitHub URL for a RAG chunk based on source_type + path."""
        stype = chunk.get("source_type","")
        path  = chunk.get("path","") or ""
        line_start = chunk.get("line_start")
        anchor = f"#L{line_start}" if line_start else ""

        # Map source_type to repo folder
        FOLDER_MAP = {
            "API_DOCS":           f"{REPO_BASE}/api-docs",
            "INTEGRATION_SERVICE":f"{REPO_BASE}/integration-service-main/lib/facts",
            "MICROSITES":         f"{REPO_BASE}/microsites-main/packages/case/src/page/Cases",
            "WAREHOUSE_SERVICE":  f"{REPO_BASE}/warehouse-service-main",
            "WORTH_SCORE":        f"{REPO_BASE}/ai-score-service-main",
            "WATCHLIST":          f"{REPO_BASE}/integration-service-main/lib/facts/kyb",
            "DOMESTIC_FOREIGN":   f"{REPO_BASE}/integration-service-main/lib/facts/kyb",
            "FACT_ENGINE":        f"{REPO_BASE}/integration-service-main/lib/facts",
            "NAICS_MCC":          f"{REPO_BASE}/integration-service-main/lib/facts/businessDetails",
            "TIN_VERIFICATION":   f"{REPO_BASE}/integration-service-main/lib/facts/kyb",
        }
        # Specific file overrides for known paths
        FILE_MAP = {
            # Verified paths (git ls-files confirmed these exist on the branch)
            ("API_DOCS", "kyb.md"):              f"{REPO_BASE}/api-docs/api-reference/integration/facts/kyb.md",
            ("API_DOCS", "kyb-kyc.md"):          f"{REPO_BASE}/api-docs/getting-started/kyb-kyc.md",
            ("API_DOCS", "openapi"):              GITHUB_LINKS.get("openapi/integration",""),
            ("API_DOCS", "get-kyb.json"):        GITHUB_LINKS.get("openapi/kyb",""),
            ("API_DOCS", "integration.json"):    GITHUB_LINKS.get("openapi/integration",""),
            ("INTEGRATION_SERVICE","index.ts"):  GITHUB_LINKS.get("facts/kyb/index.ts",""),
            ("INTEGRATION_SERVICE","rules.ts"):  GITHUB_LINKS.get("facts/rules.ts",""),
            ("INTEGRATION_SERVICE","sources.ts"):GITHUB_LINKS.get("facts/sources.ts",""),
            ("WAREHOUSE_SERVICE","customer_table.sql"): GITHUB_LINKS.get("customer_table.sql",""),
            ("WORTH_SCORE","aiscore.py"):         GITHUB_LINKS.get("aiscore.py",""),
            ("WORTH_SCORE","worth_score_model.py"):GITHUB_LINKS.get("worth_score_model.py",""),
            ("FACT_ENGINE","rules.ts"):           GITHUB_LINKS.get("facts/rules.ts",""),
            ("WATCHLIST","consolidatedWatchlist.ts"): GITHUB_LINKS.get("consolidatedWatchlist.ts",""),
        }
        # Try exact file match
        key = (stype, path)
        if key in FILE_MAP and FILE_MAP[key]:
            return FILE_MAP[key] + anchor
        # Partial path match
        for (st, fp), url in FILE_MAP.items():
            if st == stype and fp and fp in path and url:
                return url + anchor
        # Fallback to folder
        folder = FOLDER_MAP.get(stype,"")
        if folder and path:
            # Construct direct file URL if we have a filename
            fname = path.split("/")[-1] if "/" in path else path
            return f"{folder}/{fname}{anchor}" if fname else folder
        return folder

    try:
        r=get_openai().chat.completions.create(model="gpt-4o-mini",messages=msgs,max_tokens=1200,temperature=0.2)
        answer = r.choices[0].message.content
        # Append source citations with clickable GitHub links
        if chunks:
            # Deduplicate by (source_type, path)
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
                # Build display label
                display_file = path_val or src_type.lower().replace("_"," ").title()
                line_ref = f" L{line_start}" if line_start else ""
                if url:
                    cited_lines.append(
                        f"- [`{src_type}`]({url}) · **{display_file}{line_ref}** — {desc}"
                    )
                else:
                    cited_lines.append(
                        f"- `{src_type}` · **{display_file}{line_ref}** — {desc}"
                    )

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
# SIDEBAR
# ════════════════════════════════════════════════════════════════════════════════
_,is_live,conn_err=get_conn()
with st.sidebar:
    # ── Header + theme toggle on same row ────────────────────────────────────
    _h1, _h2 = st.columns([3, 1])
    with _h1:
        st.markdown("# 🔬 KYB Hub")
    with _h2:
        # Sunmoon toggle — clicking flips the theme and reruns
        _toggle_label = "☀️" if _dark else "🌙"
        _toggle_help  = "Switch to Light Mode" if _dark else "Switch to Dark Mode"
        if st.button(_toggle_label, help=_toggle_help, key="theme_toggle",
                     use_container_width=True):
            st.session_state["theme_mode"] = "light" if _dark else "dark"
            st.rerun()
    st.caption(f"{'🌙 Dark' if _dark else '☀️ Light'} Mode — click {_toggle_label} to toggle")

    if is_live: st.success("🟢 Redshift connected")
    else:
        st.error("🔴 Not connected"); st.caption(str(conn_err or "")[:60])
        if st.button("🔄 Retry"): st.cache_data.clear(); st.rerun()
    st.markdown("---")
    tab=st.radio("Section",[
        "🏠 Home","🏛️ Registry & Identity","🏭 Classification & KYB",
        "⚠️ Risk & Watchlist","💰 Worth Score","📋 All Facts","🤖 AI Agent"])

    # ── Date Range Filter ────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("**📅 Date Range**")
    use_dates = st.toggle("Filter by date", value=False,
                          help="Filter all queries to a specific onboarding period (received_at)")
    if use_dates:
        today = datetime.now(timezone.utc).date()
        d_from = st.date_input("From", value=today - pd.Timedelta(days=30),
                                max_value=today, key="hub_dfrom", label_visibility="collapsed")
        d_to   = st.date_input("To",   value=today,
                                max_value=today, key="hub_dto",   label_visibility="collapsed")
        if d_from > d_to: d_from = d_to
        st.caption(f"📅 {d_from} → {d_to}")
        hub_date_from, hub_date_to = str(d_from), str(d_to)
    else:
        hub_date_from, hub_date_to = None, None
        st.caption("Showing all data (no date filter)")

    def hub_date_clause(col="received_at"):
        parts = []
        if hub_date_from: parts.append(f"{col} >= '{hub_date_from}'")
        if hub_date_to:   parts.append(f"{col} <= '{hub_date_to} 23:59:59'")
        return (" AND " + " AND ".join(parts)) if parts else ""

    # ── Customer Filter (linked to date range) ───────────────────────────────
    st.markdown("---")
    st.markdown("**🏢 Customer Filter**")
    st.caption("Filters to businesses of a specific customer within the date range above.")

    # Load customer names + business counts for the selected date range
    with st.spinner("Loading customers…"):
        cust_df, cust_err = load_customer_names(hub_date_from, hub_date_to)

    if cust_df is not None and not cust_df.empty and "customer_name" in cust_df.columns:

        # ── Business count distribution chart (shown above the dropdown) ──
        has_count = "business_count" in cust_df.columns
        if has_count and len(cust_df) > 0:
            # Horizontal bar chart — sorted by count descending
            chart_df = cust_df.copy()
            chart_df["short_name"] = chart_df["customer_name"].apply(
                lambda n: (n[:22] + "…") if len(str(n)) > 22 else str(n)
            )
            chart_df = chart_df.sort_values("business_count", ascending=True)  # ascending for horiz bar

            fig_cust = go.Figure(go.Bar(
                x=chart_df["business_count"],
                y=chart_df["short_name"],
                orientation="h",
                marker_color="#3B82F6",
                text=chart_df["business_count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                textfont=dict(size=10, color="#E2E8F0"),
                hovertemplate="<b>%{y}</b><br>%{x:,} businesses<extra></extra>",
            ))
            fig_cust.update_layout(
                height=max(160, len(chart_df) * 28),
                margin=dict(t=4, b=4, l=4, r=48),
                xaxis=dict(showgrid=False, showticklabels=False, title=""),
                yaxis=dict(tickfont=dict(size=9), title=""),
                paper_bgcolor="#0A0F1E",
                plot_bgcolor="#1E293B",
                font_color="#E2E8F0",
            )
            st.plotly_chart(fig_cust, use_container_width=True)

            # Summary stats below chart
            total_cust = len(cust_df)
            total_biz_cust = int(chart_df["business_count"].sum())
            top_cust = chart_df.iloc[-1]["short_name"]  # last = highest (ascending)
            top_count = int(chart_df.iloc[-1]["business_count"])
            st.caption(
                f"{total_cust} customers · {total_biz_cust:,} businesses total · "
                f"Largest: **{top_cust}** ({top_count:,})"
            )

        # ── Dropdown — with count shown in label ──────────────────────────
        cust_options = ["All Customers"] + [
            f"{row['customer_name']} ({int(row['business_count']):,} biz)" if has_count
            else f"{row['customer_name']} ({row['customer_id'][:8]}…)"
            for _, row in cust_df.sort_values("business_count", ascending=False).iterrows()
            if row.get("customer_name")
        ]
        # Map display label → customer_id
        cust_id_map = {"All Customers": None}
        for _, row in cust_df.iterrows():
            if row.get("customer_name"):
                label = (
                    f"{row['customer_name']} ({int(row['business_count']):,} biz)"
                    if has_count
                    else f"{row['customer_name']} ({row['customer_id'][:8]}…)"
                )
                cust_id_map[label] = row["customer_id"]

        selected_cust = st.selectbox(
            "Customer",
            options=cust_options,
            key="hub_customer",
            label_visibility="collapsed",
            help="Select a customer to filter the entire Home dashboard to their businesses only"
        )
        hub_customer_id = cust_id_map.get(selected_cust)
        if hub_customer_id:
            # Show selected customer's count
            sel_row = cust_df[cust_df["customer_id"] == hub_customer_id]
            sel_count = int(sel_row["business_count"].iloc[0]) if (has_count and not sel_row.empty) else "?"
            st.caption(f"🏢 Filtering to **{selected_cust}** · {sel_count:,} businesses")
        else:
            st.caption(f"Showing all {len(cust_df)} customers in this period")
    else:
        hub_customer_id = None
        if cust_err:
            st.caption(f"Customer names not available: `{str(cust_err)[:60]}`")
        else:
            st.caption("No customers found for this period")

    st.markdown("---")
    st.markdown("**Sources**")
    for s in ["rds_warehouse_public.facts","rds_manual_score_public.*",
              "rds_integration_data.*","clients.customer_table","warehouse.worth_score_input_audit"]:
        st.caption(f"`{s}`")

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

    # ── Load enriched KYB stats using recent_df as the authoritative business list ──
    # Strategy: query facts for EXACTLY the business IDs in recent_df.
    # This is the most reliable approach because:
    # (1) recent_df already has the correct filtered businesses (date + customer)
    # (2) We don't depend on rbcm being accessible a second time
    # (3) The IN clause guarantees the result matches recent_df exactly
    _authoritative_bids = recent_df["business_id"].tolist() if recent_df is not None else []

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
        # Use tuple so it's hashable for st.cache_data
        stats_df, stats_err = _load_stats_for_bids(tuple(_authoritative_bids))

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
            _naics_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics_code, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='naics_code' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC LIMIT 20;"
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
        _ws_sql = f"SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at FROM rds_manual_score_public.data_current_scores cs JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id LIMIT 5000;"
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
            _dom_sql = f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state, COUNT(DISTINCT business_id) AS businesses FROM rds_warehouse_public.facts WHERE name='formation_state' AND business_id IN (SELECT business_id FROM rds_cases_public.rel_business_customer_monitoring WHERE DATE(created_at) BETWEEN '{hub_date_from or 'current_date-30'}' AND '{hub_date_to or 'current_date'}') GROUP BY 1 ORDER BY businesses DESC LIMIT 20;"
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
                st.session_state["hub_bid"] = bid_check
                st.success(f"UUID set. Navigate to any section in the sidebar.")

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
                    st.session_state["hub_bid"] = bid_check
                    st.success("UUID set. Navigate to any section in the sidebar.")

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
        c1,c2,c3,c4 = st.columns(4)
        with c1:
            kpi("Formation State (domestic)",form_state or "⚠️ Unknown","Where entity was incorporated","#3B82F6")
            detail_panel("Formation State",form_state or "Unknown",
                what_it_means="The US state where this entity was legally incorporated (domestic state). Middesk (pid=16) is the primary source. If different from operating state, entity likely has BOTH domestic and foreign filings.",
                source_table="rds_warehouse_public.facts · name='formation_state'",
                source_file="facts/kyb/index.ts", source_file_line="formationState · factWithHighestConfidence rule",
                api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.formation_state",
                json_obj={"name":"formation_state","value":form_state or None,"source":{"platformId":16,"name":"middesk","confidence":mdsk_conf},"ruleApplied":{"name":"factWithHighestConfidence"}},
                sql=_dom_sql,
                links=[("facts/kyb/index.ts","formation_state fact"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
                color="#3B82F6",icon="🗺️")
        with c2:
            kpi("Operating State",op_state or "⚠️ Unknown","primary_address.state","#3B82F6")
            detail_panel("Operating State",op_state or "Unknown",
                what_it_means="The state where the business operates, derived from primary_address.state. This is the state Middesk searches by default, which may find the FOREIGN filing instead of the DOMESTIC one.",
                source_table="rds_warehouse_public.facts · name='primary_address' → value.state",
                source_file="facts/kyb/index.ts", source_file_line="primaryAddress · dependent from addresses[]",
                api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.primary_address.value.state",
                json_obj={"name":"primary_address","value":{"state":op_state or None},"source":{"platformId":-1,"name":"dependent"},"dependencies":["addresses"]},
                sql=_op_sql,
                links=[("facts/kyb/index.ts","primary_address fact"),("middesk","Middesk SOS search uses this address")],
                color="#3B82F6",icon="📍")
        with c3:
            if states_differ:
                kpi("State Match","❌ Different",f"{form_state_up} ≠ {op_state} — foreign qual. likely","#f59e0b")
                _match_color="#f59e0b"
            elif form_state_up:
                kpi("State Match","✅ Same state","No foreign qualification needed","#22c55e")
                _match_color="#22c55e"
            else:
                kpi("State Match","⚠️ Unknown","formation_state missing","#64748b")
                _match_color="#64748b"
            detail_panel("State Match","Different" if states_differ else ("Same" if form_state_up else "Unknown"),
                what_it_means=("formation_state ≠ operating_state. Business almost certainly has: (1) Domestic filing in " + form_state_up + ", (2) Foreign qualification in " + op_state + ". Middesk address search finds the FOREIGN record, potentially missing the DOMESTIC primary." if states_differ else ("Same state = entity incorporated and operating in the same state. Middesk address search will find the correct domestic record." if form_state_up else "Formation state unknown — cannot assess domestic vs foreign risk.")),
                source_table="Computed from formation_state vs primary_address.state (both from rds_warehouse_public.facts)",
                source_file="facts/businessDetails/index.ts", source_file_line="Proxy analysis — not a stored fact",
                json_obj={"formation_state":form_state_up or None,"operating_state":op_state or None,"states_match":not states_differ,"entity_resolution_gap_risk":states_differ},
                sql=f"-- Compare both states:\nSELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';\n-- vs:\n{_op_sql}",
                links=[("facts/kyb/index.ts","sos_match_boolean — affected by entity resolution gap")],
                color=_match_color,icon="🔍")
        with c4:
            _th_val = "YES — " + form_state_up if is_th else "No"
            kpi("Tax Haven?","⚠️ " + _th_val if is_th else "✅ " + _th_val,
                "DE/NV/WY/SD/MT/NM = entity resolution gap risk" if is_th else "Low entity resolution risk",
                "#f59e0b" if is_th else "#22c55e")
            detail_panel("Tax Haven State","YES" if is_th else "No",
                what_it_means=("DE/NV/WY/SD/MT/NM are preferred for incorporation due to: no state income tax (DE,NV,WY), flexible corporate law (DE Court of Chancery), LLC privacy (WY). Businesses incorporate here but operate elsewhere, creating the entity resolution gap. Middesk searches by operating address → finds foreign qualification → misses domestic filing." if is_th else "Formation state " + (form_state_up or "?") + " is not a tax-haven state. Lower probability of entity resolution gap from state mismatch."),
                source_table="Derived from formation_state value — no separate fact stored",
                source_file="facts/kyb/index.ts", source_file_line="formation_state fact · Middesk pid=16",
                json_obj={"formation_state":form_state_up or None,"is_tax_haven_state":is_th,"tax_haven_states":["DE","NV","WY","SD","MT","NM"]},
                sql=_dom_sql,
                links=[("facts/kyb/index.ts","formation_state"),("middesk","Middesk SOS search implementation")],
                color="#f59e0b" if is_th else "#22c55e",icon="⚠️" if is_th else "✅")

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
LIMIT 100;""", language="sql")

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

        # KPI row with detail panels
        tin_submitted_val=str(gv(facts,"tin_submitted") or "")
        _tin_sql_base = f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('tin','tin_submitted','tin_match','tin_match_boolean') ORDER BY name;"
        c1,c2,c3,c4=st.columns(4)
        with c1:
            kpi("EIN Submitted","✅ Yes" if tin_submitted_val else "❌ No",
                f"Masked: {tin_submitted_val[:9]}" if tin_submitted_val else "tin_submitted fact","#22c55e" if tin_submitted_val else "#ef4444")
            detail_panel("EIN Submitted", tin_submitted_val or "Not submitted",
                what_it_means="tin_submitted stores the masked EIN (XXXXX1234) for display. The unmasked version is in the 'tin' fact. Both are sourced from the Applicant (pid=0, confidence=1.0 by convention). The IRS TIN check CANNOT run until an EIN is submitted.",
                source_table="rds_warehouse_public.facts · name='tin_submitted'",
                source_file="facts/kyb/index.ts", source_file_line="tinSubmitted · factWithHighestConfidence · Applicant pid=0",
                api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.tin_submitted",
                json_obj={"name":"tin_submitted","value":tin_submitted_val or None,"source":{"platformId":0,"name":"businessDetails","confidence":1.0},"ruleApplied":{"name":"factWithHighestConfidence"},"note":"Masked EIN. Unmasked in 'tin' fact."},
                sql=_tin_sql_base,
                links=[("facts/kyb/index.ts","tinSubmitted fact"),("integrations.constant.ts","pid=0=Applicant/businessDetails")],
                color="#22c55e" if tin_submitted_val else "#ef4444", icon="🔐")
        with c2:
            kpi("IRS Status",tin_status.capitalize() or "⚠️ Unknown","tin_match.value.status",
                "#22c55e" if tin_status=="success" else "#ef4444" if tin_status=="failure" else "#f59e0b")
            detail_panel("IRS Status", tin_status or "Unknown",
                what_it_means="tin_match.value.status = the IRS response status for the EIN+name combination check. 'success' = IRS confirmed match. 'failure' = IRS mismatch or no record. 'pending' = check in progress. This field drives tin_match_boolean (dependent fact).",
                source_table="rds_warehouse_public.facts · name='tin_match' → value.status",
                source_file="facts/kyb/index.ts", source_file_line="tinMatch · factWithHighestConfidence · Middesk pid=16",
                api_endpoint="GET /integration/api/v1/facts/business/{bid}/kyb → data.tin_match.value.status",
                json_obj={"name":"tin_match","value":{"status":tin_status or None,"message":tin_msg or None,"sublabel":"Found" if tin_status=="success" else "Failed"},"source":{"platformId":16,"name":"middesk","confidence":gc(facts,"tin_match")}},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS irs_status, JSON_EXTRACT_PATH_TEXT(value,'value','message') AS irs_message FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';",
                links=[("facts/kyb/index.ts","tinMatch fact"),("integrations.constant.ts","INTEGRATION_ID.MIDDESK=16")],
                color="#22c55e" if tin_status=="success" else "#ef4444" if tin_status=="failure" else "#f59e0b", icon="🏛️")
        with c3:
            kpi("IRS Message",tin_msg[:30]+"…" if len(tin_msg)>30 else (tin_msg or "(none)"),
                "tin_match.value.message","#22c55e" if tin_status=="success" else "#ef4444")
            detail_panel("IRS Message", tin_msg or "(none)",
                what_it_means="The exact message returned by the IRS TIN verification system via Middesk. Common messages: 'The IRS has a record for the submitted TIN and Business Name combination' (success). 'The IRS does not have a record' (wrong EIN/name). 'associated with a different Business Name' (FRAUD SIGNAL). 'Duplicate request' (retry in 24h).",
                source_table="rds_warehouse_public.facts · name='tin_match' → value.message",
                source_file="facts/kyb/index.ts", source_file_line="tinMatch.value.message · IRS response via Middesk TIN review task",
                json_obj={"tin_match_message":tin_msg or None,"tin_match_status":tin_status or None,"interpretation":{"does not have a record":"Wrong EIN or name — request SS-4 document","associated with a different":"FRAUD SIGNAL — escalate to Compliance","Duplicate request":"Retry in 24h","unavailable":"IRS outage — auto-retry"}},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value','message') AS irs_msg FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';",
                links=[("facts/kyb/index.ts","tinMatch message field")],
                color="#22c55e" if tin_status=="success" else "#ef4444", icon="💬")
        with c4:
            kpi("Boolean Result",tin_bool or "⚠️ Unknown","Admin Portal shows this value",
                "#22c55e" if tin_bool=="true" else "#ef4444")
            detail_panel("Boolean Result", tin_bool or "Unknown",
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

        # ── KPI cards ────────────────────────────────────────────────────────
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
            detail_panel("Sole Prop",sole_prop or "Unknown",
                what_it_means="is_sole_prop=true when tin_submitted=null AND idv_passed_boolean=true. Indicates the owner is a sole proprietor — no EIN submitted. Some IDV configurations skip the flow for sole props, which is why idv_passed_boolean may be null even with no error.",
                source_table="rds_warehouse_public.facts · name='is_sole_prop'",
                source_file="facts/kyb/index.ts",source_file_line="isSoleProp · dependent from tin_submitted + idv_passed_boolean",
                json_obj={"name":"is_sole_prop","value":sole_prop=="true" if sole_prop else None,"source":{"platformId":-1,"name":"dependent"},"dependencies":["tin_submitted","idv_passed_boolean"]},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='is_sole_prop';",
                links=[("facts/kyb/index.ts","isSoleProp definition")],
                color="#f59e0b" if sole_prop=="true" else "#3B82F6",icon="👤")

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

        c1,c2,c3,c4=st.columns(4)
        _bg_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('kyb_submitted','kyb_complete','revenue','num_employees') ORDER BY name;"
        with c1:
            kpi("KYB Submitted","✅ Yes" if kyb_sub=="true" else "❌ No","Onboarding form submitted","#22c55e" if kyb_sub=="true" else "#f59e0b")
            detail_panel("KYB Submitted", kyb_sub or "Unknown",
                what_it_means="kyb_submitted=true when the onboarding form has been submitted (addresses[] is not empty). This is a DEPENDENT fact (pid=-1) derived from the addresses fact. It means the merchant completed the onboarding form — it does NOT mean KYB verification is complete.",
                source_table="rds_warehouse_public.facts · name='kyb_submitted'",
                source_file="facts/kyb/index.ts", source_file_line="kybSubmitted · dependent · addresses[].length > 0",
                json_obj={"name":"kyb_submitted","value":kyb_sub=="true","source":{"platformId":-1,"name":"dependent"},"dependencies":["addresses"]},
                sql=_bg_sql, links=[("facts/kyb/index.ts","kybSubmitted definition")],
                color="#22c55e" if kyb_sub=="true" else "#f59e0b", icon="📋")
        with c2:
            kpi("KYB Complete","✅ Yes" if kyb_comp=="true" else "❌ No","Business verified + people screened","#22c55e" if kyb_comp=="true" else "#f59e0b")
            detail_panel("KYB Complete", kyb_comp or "Unknown",
                what_it_means="kyb_complete=true when BOTH conditions are met: (1) business_verified=true AND (2) screened_people is not empty (at least one person has been screened). This is a DEPENDENT fact. kyb_complete=false means either the business entity has not been fully verified OR the PSC (Person Screening) has not been completed.",
                source_table="rds_warehouse_public.facts · name='kyb_complete'",
                source_file="facts/kyb/index.ts", source_file_line="kybComplete · dependent · business_verified AND screened_people",
                json_obj={"name":"kyb_complete","value":kyb_comp=="true","source":{"platformId":-1,"name":"dependent"},"dependencies":["business_verified","screened_people"]},
                sql=_bg_sql, links=[("facts/kyb/index.ts","kybComplete definition"),("trulioo","Trulioo PSC screening")],
                color="#22c55e" if kyb_comp=="true" else "#f59e0b", icon="✅" if kyb_comp=="true" else "❌")
        with c3:
            kpi("Revenue",revenue_v[:18] if revenue_v else "Not available","ZI/EFX bulk data · Worth Score input","#3B82F6" if revenue_v else "#64748b")
            detail_panel("Revenue", revenue_v or "Not available",
                what_it_means="Annual revenue in USD. Primary source: ZoomInfo (pid=24, w=0.8) or Equifax (pid=17, w=0.7) bulk firmographic data — matched via internal entity-matching XGBoost model. This is a PRIMARY Worth Score feature (Business Operations category). Null = vendor could not match this entity.",
                source_table="rds_warehouse_public.facts · name='revenue'",
                source_file="facts/kyb/index.ts", source_file_line="revenue · factWithHighestConfidence · ZI pid=24 / EFX pid=17",
                api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.revenue",
                json_obj={"name":"revenue","value":revenue_v or None,"source":{"platformId":24,"name":"zoominfo","weight":0.8},"worth_score_feature":"revenue","worth_score_category":"Business Operations"},
                sql=f"SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS revenue FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='revenue';",
                links=[("worth_score_model.py","Revenue as Worth Score feature"),("integrations.constant.ts","ZOOMINFO=24, EQUIFAX=17")],
                color="#3B82F6" if revenue_v else "#64748b", icon="💰")
        with c4:
            kpi("Employees",emp_v if emp_v else "Not available","num_employees · Worth Score feature: count_employees","#3B82F6" if emp_v else "#64748b")
            detail_panel("Employees", emp_v or "Not available",
                what_it_means="Employee count from ZoomInfo (pid=24) or Equifax (pid=17) bulk firmographic data. Worth Score feature: count_employees (Company Profile category). Null = entity not found in vendor databases. Proxy for business scale and stability.",
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

        c1,c2,c3,c4=st.columns(4)
        _web_sql=f"SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('website','website_found','serp_id','review_rating','review_count') ORDER BY name;"
        c1,c2,c3,c4=st.columns(4)
        with c1:
            kpi("Website",website_v[:30] if website_v else "❌ Not submitted","Applicant-submitted URL","#22c55e" if website_v else "#f59e0b")
            detail_panel("Website", website_v or "Not submitted",
                what_it_means="Business website URL submitted on the onboarding form (pid=0=Applicant) or found by SERP (pid=22). CRITICAL for NAICS classification: if null, AI enrichment (last resort) cannot use web_search → Gap G2 → likely NAICS=561499 fallback.",
                source_table="rds_warehouse_public.facts · name='website'",
                source_file="facts/kyb/index.ts", source_file_line="website · factWithHighestConfidence · pid=0 Applicant or pid=22 SERP",
                api_endpoint=f"GET /integration/api/v1/facts/business/{{bid}}/kyb → data.website",
                json_obj={"name":"website","value":website_v or None,"source":{"platformId":0,"name":"businessDetails"},"naics_impact":"If null AND NAICS=561499 → Gap G2 confirmed"},
                sql=_web_sql, links=[("facts/kyb/index.ts","website fact"),("aiEnrichment","AI uses website for NAICS")],
                color="#22c55e" if website_v else "#f59e0b", icon="🌐")
        with c2:
            kpi("Website Found","✅ Yes" if web_found_str=="true" else "❌ No","Verified by SERP/Middesk","#22c55e" if web_found_str=="true" else "#64748b")
            detail_panel("Website Found", web_found_str or "Unknown",
                what_it_means="website_found = list of verified URLs found by SERP/Middesk. combineFacts rule — merges from all vendors. Empty list means no website was confirmed online. Different from 'website' fact (submitted URL) — website_found is what vendors actually found.",
                source_table="rds_warehouse_public.facts · name='website_found'",
                source_file="facts/kyb/index.ts", source_file_line="websiteFound · combineFacts · SERP pid=22 / Middesk pid=16",
                json_obj={"name":"website_found","value":[],"source":{"platformId":None,"name":None},"ruleApplied":{"name":"combineFacts"}},
                sql=_web_sql, links=[("facts/kyb/index.ts","websiteFound"),("integrations.constant.ts","SERP_SCRAPE=22")],
                color="#22c55e" if web_found_str=="true" else "#64748b", icon="🔍")
        with c3:
            kpi("SERP/GMB ID","✅ Found" if serp_id else "❌ Not found","Google My Business presence","#22c55e" if serp_id else "#64748b")
            detail_panel("SERP/GMB ID", serp_id[:30] if serp_id else "Not found",
                what_it_means="serp_id = Google Business Profile place ID from SERP API (pid=22 or pid=39 SERP_GOOGLE_PROFILE). Presence indicates the business has a Google My Business listing — used for review_rating and review_count. Not found = no verified Google presence.",
                source_table="rds_warehouse_public.facts · name='serp_id'",
                source_file="facts/kyb/index.ts", source_file_line="serpId · factWithHighestConfidence · SERP_GOOGLE_PROFILE pid=39",
                json_obj={"name":"serp_id","value":serp_id or None,"source":{"platformId":39,"name":"serpGoogleProfile"}},
                sql=_web_sql, links=[("facts/kyb/index.ts","serpId"),("integrations.constant.ts","SERP_GOOGLE_PROFILE=39")],
                color="#22c55e" if serp_id else "#64748b", icon="📍")
        with c4:
            kpi("Review Rating",rating if rating else "N/A",f"{rev_count} reviews" if rev_count else "No reviews","#3B82F6" if rating else "#64748b")
            detail_panel("Review Rating", rating or "N/A",
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

    ws1,ws2,ws3=st.tabs(["💰 Score & Architecture","📊 Waterfall & Features","📊 Feature Fill Rates"])

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
            naics_ok=str(gv(facts,"naics_code") or "561499")!="561499"
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

    with ws3:
        st.markdown("#### 📊 Feature Fill Rates — Model Input Data Quality")
        st.caption("""**Source:** `warehouse.worth_score_input_audit` · 
        **What it shows:** For each model input feature, what % of scored businesses have a non-null value ·
        **Why it matters:** Null features are imputed with defaults, reducing model accuracy for that business""")

        audit_df,audit_err=load_audit()
        if audit_df is not None and not audit_df.empty:
            fill_cols=[c for c in audit_df.columns if c.startswith("fill_")]
            lr=audit_df.iloc[0]

            # Safely extract fill rates — only numeric values (skip JSON/string blobs)
            fd2=[]
            for c in fill_cols:
                if c not in audit_df.columns: continue
                try:
                    val=float(lr[c])
                    if val<0 or val>100: continue   # sanity check: must be a percentage
                except (TypeError,ValueError): continue  # skip non-numeric (JSON strings)
                cat=("📜 Public Records" if any(x in c for x in ["bankruptcy","judgment","lien","reviews"])
                     else "🏢 Company Profile" if any(x in c for x in ["age_business","state","naics","primsic","struct","employee","indicator"])
                     else "📈 Financial Trends" if any(x in c for x in ["gdp","cpi","vix","t10y","unemp","ratio","wag","usd","ppi","brent","wti","csentiment","dolindx","ccdelinq"])
                     else "💼 Business Ops" if any(x in c for x in ["revenue","net_income","cf_","bs_","is_"])
                     else "📊 Performance" if any(x in c for x in ["ratio_return","ratio_gross","ratio_net","ratio_equity","ratio_income","flag_"])
                     else "Other")
                fd2.append({"Feature":c.replace("fill_",""),"Fill %":round(val,1),"Category":cat})

            if not fd2:
                flag("audit table columns do not contain numeric fill rates — schema may differ.","amber")
            else:
                fdf=pd.DataFrame(fd2).sort_values("Fill %",ascending=True)
                fdf["Status"]=fdf["Fill %"].apply(lambda v:"🟢 Good" if v>=80 else("🟡 Medium" if v>=30 else"🔴 Low"))

                # Category summary
                cat_summary=fdf.groupby("Category")["Fill %"].mean().reset_index()
                cat_summary.columns=["Category","Avg Fill %"]
                cat_summary["Avg Fill %"]=cat_summary["Avg Fill %"].round(1)
                cat_summary["Status"]=cat_summary["Avg Fill %"].apply(lambda v:"🟢 Good" if v>=80 else("🟡 Medium" if v>=30 else"🔴 Low"))

                col_cat,col_chart=st.columns([1,2])
                with col_cat:
                    st.markdown("**Category averages:**")
                    st.dataframe(cat_summary,use_container_width=True,hide_index=True)
                    st.markdown(f"**Score date:** {lr.get('score_date','N/A')}")
                    st.caption("Low fill rate = feature imputed with default → less accurate prediction")
                with col_chart:
                    fig_fill=px.bar(fdf.sort_values("Fill %",ascending=True).tail(40),
                                    x="Fill %",y="Feature",orientation="h",color="Status",
                                    color_discrete_map={"🟢 Good":"#22c55e","🟡 Medium":"#f59e0b","🔴 Low":"#ef4444"},
                                    title=f"Model Feature Fill Rates (top 40 by fill %)")
                    fig_fill.update_layout(height=700,showlegend=True,
                                           xaxis=dict(range=[0,110]),
                                           margin=dict(t=40,b=10,l=10,r=10))
                    st.plotly_chart(dark_chart(fig_fill),use_container_width=True)

            # Low fill rate features
            low_fill=fdf[fdf["Fill %"]<30].sort_values("Fill %")
            if not low_fill.empty:
                st.markdown("##### ⚠️ Features with Low Fill Rate (<30%) — Imputed with defaults")
                st.markdown("These features are null for most businesses. When null, the model uses imputed defaults from lookups.py. "
                            "This reduces model confidence and may cause the Worth Score to be less accurate.")
                st.dataframe(low_fill[["Feature","Fill %","Category"]],use_container_width=True,hide_index=True)
        else:
            flag(f"Audit table not accessible. {audit_err or ''}", "amber")
            st.code("""-- Try directly:
SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 5;""",language="sql")

        st.markdown("**🔗 Source references:**")
        st.markdown(
            f"- [{src_link('lookups.py','lookups.py — INPUTS dict (all features + imputation defaults)')}]({GITHUB_LINKS.get('lookups.py','')})\n"
            f"- [{src_link('worth_score_model.py','worth_score_model.py — _predict() feature pipeline')}]({GITHUB_LINKS.get('worth_score_model.py','')})\n"
            f"- Redshift table: `warehouse.worth_score_input_audit` — fill rates computed nightly"
        )
        ai_popup("FillRates","Worth Score feature fill rates",[
            "Which features have the lowest fill rate and why?",
            "How does the model handle null features — what are the imputation defaults?",
            "What is the impact of having all Financial Ratios null (no Plaid banking)?",
            "How do I improve the fill rate for firmographic features (revenue, employees)?",
            "Where are the imputation default values defined in the codebase?"],bid)

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
LIMIT 50;""" if not bid else f"""-- Facts for business {bid}:
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

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(f'<div style="color:#475569;font-size:.68rem;text-align:center">KYB Intelligence Hub · Worth AI · {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</div>',unsafe_allow_html=True)
