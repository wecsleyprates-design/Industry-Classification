"""Page 6 — Business Drilldown.

Shows a single unified classification table for all NAICS/MCC facts.
When the live API is loaded, shows the full Admin Portal JSON format
(with schema, dependencies, description, ruleApplied, isNormalized)
and flags any discrepancy between API and Redshift.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import pandas as pd
import json

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import PLATFORM_MAP, platform_label, platform_color, FACT_NAMES
from utils.validators import validate_naics, validate_mcc, STATUS_COLORS, STATUS_ICONS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from utils import worth_api
from db.queries import (
    load_business_facts, load_business_customer,
    load_naics_lookup, load_mcc_lookup, load_canonical_pairs,
)

st.set_page_config(page_title="Business Drilldown", page_icon="🔍", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()

st.markdown("# 🔍 Business Drilldown")
st.markdown(
    "Complete NAICS/MCC classification picture for a single business. "
    "Load the live API data to compare against Redshift and see the full Admin Portal JSON format."
)
platform_legend_panel()
st.markdown("---")

# ── Business ID input ─────────────────────────────────────────────────────────
default_bid = filters.get("business_id") or ""
bid_input = st.text_input(
    "🔑 Business ID (UUID)",
    value=default_bid,
    placeholder="e.g. 6a65f7bd-f1a5-42f9-9a8f-666b20009b24",
    key="drill_bid",
)
st.caption(
    "💡 From the Admin Portal URL "
    "`admin.joinworth.com/businesses/`**{A}**`/cases/{B}/kyb/...` — "
    "use **{A}** (first UUID). The tab (Background, Business Registration, etc.) doesn't matter."
)

if not bid_input.strip():
    st.info("Enter a Business ID above to begin the drilldown.", icon="👆")
    st.stop()

business_id = bid_input.strip()

# ── Load Redshift data ─────────────────────────────────────────────────────────
with st.spinner("Loading from Redshift…"):
    facts_df  = load_business_facts(business_id)
    cust_df   = load_business_customer(business_id)
    naics_lkp = load_naics_lookup()
    mcc_lkp   = load_mcc_lookup()

with st.spinner("Loading canonical mapping…"):
    canon_df = load_canonical_pairs()
    canonical_pairs = set()
    if canon_df is not None and not canon_df.empty:
        canonical_pairs = {
            (str(r["naics_code"]).strip(), str(r["mcc_code"]).strip())
            for _, r in canon_df.iterrows()
        }

# ── Resolve platform for Redshift rows ────────────────────────────────────────
if facts_df is not None and not facts_df.empty:
    facts_df["eff_pid"] = facts_df.apply(
        lambda r: r["winning_platform_id"]
        if str(r["winning_platform_id"]) not in ("unknown", "", "None")
        else (r.get("legacy_source_name") or "unknown"),
        axis=1,
    ).astype(str)
    facts_df["platform_name"] = facts_df["eff_pid"].apply(platform_label)
    facts_df["conf_f"] = pd.to_numeric(facts_df["winning_confidence"], errors="coerce").fillna(0)
else:
    facts_df = pd.DataFrame()

# ── Business header ────────────────────────────────────────────────────────────
st.markdown(f"### 🏢 `{business_id}`")
if cust_df is not None and not cust_df.empty:
    c1, c2, c3 = st.columns(3)
    with c1: st.markdown(f"**Customer:** `{cust_df['customer_name'].iloc[0]}`")
    with c2: st.markdown(f"**First seen (monitoring):** {cust_df['first_seen'].iloc[0]}")
    with c3: st.markdown(f"**Last seen (monitoring):** {cust_df['last_seen'].iloc[0]}")
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# LIVE API SECTION
# ═══════════════════════════════════════════════════════════════════════════════

api_configured = worth_api.is_configured()
api_facts = {}
api_ok = False

if not api_configured:
    st.info(
        "**Live API comparison not configured.** "
        "Add credentials to `.streamlit/secrets.toml` to enable real-time data.",
        icon="🔑",
    )
else:
    load_btn = st.button(
        "🔄 Load live API data for this business",
        key="load_api_btn",
        help="Calls /facts/business/{id}/details in real time",
    )
    if load_btn or st.session_state.get(f"api_loaded_{business_id}"):
        st.session_state[f"api_loaded_{business_id}"] = True
        with st.spinner("Calling Worth AI API…"):
            try:
                raw_api   = worth_api.get_business_details(business_id)
                api_facts = worth_api.extract_classification_facts(raw_api)
                api_ok    = True
                st.success("✅ Live API data loaded successfully.")
            except RuntimeError as e:
                st.error(f"❌ API call failed: {e}", icon="🚨")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED CLASSIFICATION TABLE
# ═══════════════════════════════════════════════════════════════════════════════
section_header(
    "📋 Classification Facts — Unified View",
    "All NAICS/MCC facts in one table. "
    + ("API column shows live data from Admin Portal." if api_ok else
       "Load live API data above to add the API column.")
)

DISPLAY_FACTS = [
    "naics_code", "naics_description",
    "mcc_code", "mcc_code_found", "mcc_code_from_naics", "mcc_description",
    "industry", "classification_codes",
]

def _get_rds(fn: str) -> dict:
    if facts_df.empty:
        return {}
    row = facts_df[facts_df["fact_name"] == fn]
    if row.empty:
        return {}
    r = row.iloc[0]
    return {
        "value":      r.get("winning_value"),
        "platform":   r.get("platform_name", ""),
        "pid":        r.get("eff_pid", ""),
        "confidence": r.get("conf_f", 0),
        "updated_at": r.get("winner_updated_at", ""),
        "received_at": str(r.get("received_at", "")),
        "raw_json":   r.get("raw_json", ""),
    }

def _get_api(fn: str) -> dict:
    fact = api_facts.get(fn) or {}
    if not fact:
        return {}
    src = fact.get("source") or {}
    val = fact.get("value")
    if isinstance(src, dict):
        pid    = str(src.get("platformId", ""))
        pname  = src.get("name", "") or platform_label(pid)
        conf   = src.get("confidence")
        ts     = src.get("updatedAt", "")
    else:
        pid = pname = conf = ts = ""
    return {
        "value":       val,
        "platform":    pname or platform_label(pid),
        "pid":         pid,
        "confidence":  float(conf) if conf is not None else None,
        "updated_at":  ts,
        "rule_applied":(fact.get("ruleApplied") or {}).get("name", ""),
        "dependencies": ", ".join(fact.get("dependencies") or []),
        "description": fact.get("description", ""),
        "is_normalized": fact.get("isNormalized"),
        "override":    fact.get("override"),
        "alts_count":  len(fact.get("alternatives") or []),
    }

rows = []
for fn in DISPLAY_FACTS:
    rds = _get_rds(fn)
    api = _get_api(fn)

    rds_val = str(rds.get("value") or "").strip()
    api_val = str(api.get("value") or "").strip()

    # Validity
    if fn == "naics_code":
        validity_status = STATUS_ICONS.get(validate_naics(rds_val or api_val, naics_lkp)[0], "")
    elif fn in ("mcc_code", "mcc_code_found"):
        validity_status = STATUS_ICONS.get(validate_mcc(rds_val or api_val, mcc_lkp)[0], "")
    else:
        validity_status = ""

    # Match check
    if api_ok and rds_val and api_val:
        match = "✅" if rds_val == api_val else "⚠️ Differ"
    else:
        match = "—"

    row = {
        "Fact":                   fn,
        "Redshift Value":         rds_val or "—",
        "Redshift Platform":      rds.get("platform", "—"),
        "Redshift Confidence":    round(rds.get("confidence", 0), 3) if rds else None,
        "Redshift Last Updated":  (rds.get("updated_at") or "")[:19] or "—",
        "Validity":               validity_status,
    }

    if api_ok:
        row["API Value"]        = api_val or "—"
        row["API Platform"]     = api.get("platform", "—")
        row["API Confidence"]   = round(api.get("confidence", 0), 3) if api.get("confidence") is not None else None
        row["API Updated At"]   = (api.get("updated_at") or "")[:19] or "—"
        row["API Rule Applied"] = api.get("rule_applied", "")
        row["Dependencies"]     = api.get("dependencies", "")
        row["Alternatives #"]   = api.get("alts_count", 0)
        row["Match"]            = match

    rows.append(row)

table_df = pd.DataFrame(rows)
cfg = {"Redshift Confidence": st.column_config.NumberColumn(format="%.3f")}
if api_ok:
    cfg["API Confidence"] = st.column_config.NumberColumn(format="%.3f")
    cfg["Alternatives #"] = st.column_config.NumberColumn(format="%d")

st.dataframe(table_df, use_container_width=True, hide_index=True, column_config=cfg)

# ── Match discrepancy note ─────────────────────────────────────────────────────
if api_ok:
    mismatches = table_df[table_df.get("Match", pd.Series()) == "⚠️ Differ"] if "Match" in table_df.columns else pd.DataFrame()
    if not mismatches.empty:
        analyst_note(
            "⚠️ Discrepancy detected between Redshift and live API",
            f"<strong>{len(mismatches)} fact(s)</strong> show different values in Redshift vs the live API. "
            "This usually means a vendor enrichment ran recently and updated the fact, "
            "but the Redshift federated view hasn't reflected it yet — or the federation layer cached an older value. "
            "<strong>The API value is the current truth</strong> (same as what the Admin Portal shows).",
            level="warning",
            bullets=[
                f"<code>{r['Fact']}</code>: Redshift = <code>{r['Redshift Value']}</code> | API = <code>{r['API Value']}</code>"
                for _, r in mismatches.iterrows()
            ],
            action="Run the weekly cache refresh (python3 scripts/refresh_facts_cache.py) to sync Redshift-based analysis with the latest API data.",
        )
    else:
        st.success("✅ Redshift and live API values match for all classification facts.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# ALTERNATIVES DETAIL
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📦 Alternatives — Other Sources That Submitted a Value")

# If API loaded, use API alternatives (richer). Otherwise parse from Redshift raw JSON.
for fn in ["naics_code", "mcc_code", "mcc_code_found"]:
    alts = []

    if api_ok and fn in api_facts:
        raw_alts = (api_facts.get(fn) or {}).get("alternatives") or []
        for a in raw_alts:
            src = a.get("source", {})
            if isinstance(src, dict):
                pid, conf, ts = str(src.get("platformId","")), src.get("confidence"), src.get("updatedAt","")
            else:
                pid, conf, ts = str(src), a.get("confidence"), ""
            alts.append({
                "Platform": platform_label(pid),
                "Platform ID": pid,
                "Value": a.get("value"),
                "Confidence": conf,
                "Updated At": ts,
                "Source": "🌐 Live API",
            })
    else:
        rds = _get_rds(fn)
        alts = [{**a, "Source": "🗄️ Redshift"} for a in parse_alternatives(rds.get("raw_json",""))]
        if alts:
            for a in alts:
                a["Platform"]    = a.pop("alt_platform", "")
                a["Platform ID"] = a.pop("alt_platform_id", "")
                a["Value"]       = a.pop("alt_value", "")
                a["Confidence"]  = a.pop("alt_confidence", "")
                a["Updated At"]  = a.pop("alt_updated_at", "")

    st.markdown(f"**`{fn}`** — {len(alts)} other source(s):")
    if alts:
        st.dataframe(pd.DataFrame(alts), hide_index=True, use_container_width=True)
    else:
        st.caption("No alternatives found for this fact.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# FULL API JSON — matching Admin Portal format exactly
# ═══════════════════════════════════════════════════════════════════════════════
if api_ok:
    section_header(
        "🔬 Full API JSON — Admin Portal Format",
        "Exactly what the Admin Portal sees. Includes schema, dependencies, description, "
        "ruleApplied, isNormalized, override, and all flat source.* fields."
    )
    fact_to_show = st.selectbox(
        "Select fact to inspect",
        options=[fn for fn in DISPLAY_FACTS if fn in api_facts],
        key="raw_api_sel",
    )
    if fact_to_show:
        fact_obj = api_facts.get(fact_to_show, {})
        # Reconstruct exactly as Admin Portal shows (with flat source.* fields)
        display_obj = dict(fact_obj)
        src = fact_obj.get("source") or {}
        if isinstance(src, dict):
            display_obj["source.confidence"] = src.get("confidence")
            display_obj["source.platformId"]  = src.get("platformId")
            display_obj["source.name"]        = src.get("name")
        st.json(display_obj)

    st.markdown("---")

    with st.expander("📄 Full raw API response (all facts)"):
        st.json(api_facts)

# ── Redshift raw JSON ──────────────────────────────────────────────────────────
with st.expander("🗄️ Raw JSON from Redshift (internal storage format)"):
    st.caption(
        "⚠️ This is Worth AI's **internal storage format** — more compact than the Admin Portal JSON. "
        "It may not reflect the latest facts if a vendor enrichment ran recently. "
        "The live API (above) is always the current truth."
    )
    fact_to_show_rds = st.selectbox(
        "Select fact",
        options=[fn for fn in DISPLAY_FACTS if not facts_df.empty and fn in facts_df["fact_name"].values],
        key="raw_rds_sel",
    )
    if fact_to_show_rds:
        rds_row = facts_df[facts_df["fact_name"] == fact_to_show_rds]
        if not rds_row.empty:
            raw = rds_row.iloc[0].get("raw_json","")
            try:
                st.json(json.loads(str(raw)))
            except Exception:
                st.code(str(raw))

sql_panel("Redshift facts query",
          f"""SELECT f.name AS fact_name,
       JSON_EXTRACT_PATH_TEXT(f.value,'value')                                    AS winning_value,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown')  AS platform_id,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','name')                            AS source_name,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0')        AS confidence,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt')                       AS updated_at,
       f.received_at
FROM rds_warehouse_public.facts f
WHERE f.business_id = '{business_id}'
  AND f.name IN ('naics_code','mcc_code','mcc_code_found','mcc_code_from_naics',
                 'naics_description','mcc_description','industry')
  AND LENGTH(f.value) < 60000
ORDER BY f.name""", key_suffix="biz_drill")

# ═══════════════════════════════════════════════════════════════════════════════
# TIMING ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
if not facts_df.empty:
    st.markdown("---")
    with st.expander("🕐 Timing Analysis — When each source submitted its value"):
        analyst_note(
            "The ~4-minute timing gap",
            "When a business submits the onboarding form, the system records that submission "
            "immediately with the highest score (1.0). External providers like ZoomInfo and SERP "
            "run separately and return ~4 minutes later. "
            "The <strong>Source Updated At</strong> timestamp comes from <code>source.updatedAt</code> inside "
            "the JSON — this is the real freshness indicator. "
            "<strong>Fact Received At</strong> is when the Redshift row was first created — it does not "
            "update when the fact is refreshed.",
            level="warning",
        )
        timing_rows = []
        for fn in FACT_NAMES:
            row = facts_df[facts_df["fact_name"] == fn]
            if row.empty:
                continue
            r = row.iloc[0]
            raw = r.get("raw_json","")
            alts = parse_alternatives(raw)
            winner_ts     = str(r.get("winner_updated_at","")).strip()
            fact_received = str(r.get("received_at","")).strip()

            timing_rows.append({
                "Fact":              fn,
                "Role":              "🏆 Winner",
                "Platform":          platform_label(r["eff_pid"]),
                "Value":             r.get("winning_value",""),
                "Source Updated At": winner_ts or "—",
                "Fact Received At":  fact_received or "—",
            })
            for a in alts:
                timing_rows.append({
                    "Fact":              fn,
                    "Role":              "🥈 Other source",
                    "Platform":          a["alt_platform"],
                    "Value":             str(a["alt_value"] or ""),
                    "Source Updated At": str(a["alt_updated_at"] or "—") or "— (older format)",
                    "Fact Received At":  "—",
                })

        if timing_rows:
            st.dataframe(pd.DataFrame(timing_rows), hide_index=True, use_container_width=True)
