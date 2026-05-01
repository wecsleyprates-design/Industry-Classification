"""Page 6 — Business Drilldown.

Data priority:
  1. SQLite cache (built from Admin Portal API, weekly refresh) — primary source
  2. Live API call (on-demand, real-time) — comparison / override
  3. Redshift (fallback when no cache and no API) — may be stale

The Business Drilldown now shows cache data by default (same as Admin Portal).
The live API button gives an on-demand refresh for a single business.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import pandas as pd
import json

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, FACT_NAMES
from utils.validators import validate_naics, validate_mcc, STATUS_COLORS, STATUS_ICONS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from utils import worth_api
from db.data import data_source_banner, _using_cache
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
data_source_banner()
st.markdown(
    "Complete NAICS/MCC classification picture for a single business. "
    "When the local cache is active, all data matches the Admin Portal exactly."
)
platform_legend_panel()
st.markdown("---")

# ── Business ID input ─────────────────────────────────────────────────────────
default_bid = filters.get("business_id") or ""
bid_input = st.text_input(
    "🔑 Business ID (UUID)",
    value=default_bid,
    placeholder="e.g. 9dfa545e-a493-408d-9716-0f34970b3e14",
    key="drill_bid",
)
st.caption(
    "💡 Use the first UUID from the Admin Portal URL: "
    "`admin.joinworth.com/businesses/`**{THIS_UUID}**`/cases/{...}/kyb/...`"
)

if not bid_input.strip():
    st.info("Enter a Business ID above to begin.", icon="👆")
    st.stop()

business_id = bid_input.strip()

# ── Load lookups ──────────────────────────────────────────────────────────────
with st.spinner("Loading lookup tables…"):
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

# ── Determine primary data source ─────────────────────────────────────────────
cache_active = _using_cache()
primary_data: dict = {}   # fact_name → fact_obj (Admin Portal format)
primary_source_label = ""

if cache_active:
    # Try loading from SQLite cache first
    try:
        from db.cache_manager import get_conn
        conn = get_conn()
        rows = conn.execute(
            "SELECT fact_name, winning_value, winning_platform_id, winning_platform_name, "
            "winning_confidence, winner_updated_at, rule_applied, naics_description, "
            "mcc_description, naics_validity, mcc_validity, is_canonical_pair, "
            "alternatives_json "
            "FROM facts WHERE is_latest=1 AND business_id=?",
            (business_id,)
        ).fetchall()
        conn.close()

        if rows:
            for r in rows:
                fn = r[0]
                alts = json.loads(r[12]) if r[12] else []
                primary_data[fn] = {
                    "name":           fn,
                    "value":          r[1],
                    "source": {
                        "platformId":  r[2],
                        "name":        r[3],
                        "confidence":  r[4],
                        "updatedAt":   r[5],
                    },
                    "source.platformId":  r[2],
                    "source.name":        r[3],
                    "source.confidence":  r[4],
                    "ruleApplied":    {"name": r[6]} if r[6] else None,
                    "alternatives":   alts,
                    "_naics_description": r[7],
                    "_mcc_description":   r[8],
                    "_naics_validity":    r[9],
                    "_mcc_validity":      r[10],
                    "_is_canonical_pair": r[11],
                }
            primary_source_label = "🗄️ Local Cache (from Admin Portal API)"
    except Exception as e:
        st.warning(f"Cache read failed: {e}. Falling back to Redshift.", icon="⚠️")

if not primary_data:
    # Fallback to Redshift
    with st.spinner("Loading from Redshift…"):
        facts_df = load_business_facts(business_id)
    if facts_df is not None and not facts_df.empty:
        facts_df["eff_pid"] = facts_df.apply(
            lambda r: r["winning_platform_id"]
            if str(r["winning_platform_id"]) not in ("unknown","","None")
            else (r.get("legacy_source_name") or "unknown"), axis=1
        ).astype(str)
        for _, r in facts_df.iterrows():
            fn = r["fact_name"]
            raw = r.get("raw_json","")
            alts = parse_alternatives(raw)
            alt_list = [{
                "value": a["alt_value"],
                "source": {"platformId": a["alt_platform_id"], "name": a["alt_platform"]},
                "confidence": a["alt_confidence"],
                "updatedAt": a["alt_updated_at"],
            } for a in alts]
            primary_data[fn] = {
                "name":    fn,
                "value":   r["winning_value"],
                "source": {
                    "platformId": r["eff_pid"],
                    "name":       r.get("platform_name",""),
                    "confidence": float(r.get("conf_f", 0)),
                    "updatedAt":  str(r.get("winner_updated_at","") or ""),
                },
                "source.platformId":  r["eff_pid"],
                "source.name":        r.get("platform_name",""),
                "source.confidence":  float(r.get("conf_f", 0)),
                "ruleApplied": None,
                "alternatives": alt_list,
            }
        primary_source_label = "📡 Redshift (may be behind Admin Portal)"
    else:
        facts_df = pd.DataFrame()
        primary_source_label = "📡 Redshift"

# ── Business header ────────────────────────────────────────────────────────────
with st.spinner("Loading customer info…"):
    cust_df = load_business_customer(business_id)

st.markdown(f"### 🏢 `{business_id}`")
if cust_df is not None and not cust_df.empty:
    c1, c2, c3 = st.columns(3)
    with c1: st.markdown(f"**Customer:** `{cust_df['customer_name'].iloc[0]}`")
    with c2: st.markdown(f"**Monitoring start:** {cust_df['first_seen'].iloc[0]}")
    with c3: st.markdown(f"**Last seen:** {cust_df['last_seen'].iloc[0]}")

st.info(f"**Data source:** {primary_source_label}", icon="📋")
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# LIVE API COMPARISON
# ═══════════════════════════════════════════════════════════════════════════════
api_facts = {}
api_ok    = False

if worth_api.is_configured():
    load_btn = st.button(
        "🔄 Compare with live API (real-time refresh for this business)",
        key="load_api_btn",
        help="Calls /facts/business/{id}/all — bypasses any local cache",
    )
    if load_btn or st.session_state.get(f"api_loaded_{business_id}"):
        st.session_state[f"api_loaded_{business_id}"] = True
        with st.spinner("Calling Worth AI API…"):
            try:
                raw_api   = worth_api.get_business_details(business_id)
                api_facts = worth_api.extract_classification_facts(raw_api)
                api_ok    = True
                st.success("✅ Live API data loaded.")
            except RuntimeError as e:
                st.error(f"❌ {e}", icon="🚨")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED CLASSIFICATION TABLE
# ═══════════════════════════════════════════════════════════════════════════════
section_header(
    "📋 Classification Facts — Unified View",
    f"Source: {primary_source_label}" + (" | API column added" if api_ok else ""),
)

DISPLAY_FACTS = [
    "naics_code", "naics_description",
    "mcc_code", "mcc_code_found", "mcc_code_from_naics", "mcc_description",
    "industry", "classification_codes",
]

def _v(x): return str(x).strip() if x is not None else ""

rows = []
for fn in DISPLAY_FACTS:
    p = primary_data.get(fn, {})
    src = p.get("source") or {}
    pid      = _v(src.get("platformId"))
    val      = _v(p.get("value"))
    pname    = src.get("name","") or platform_label(pid)
    conf     = src.get("confidence")
    updated  = _v(src.get("updatedAt",""))[:19]
    rule     = (p.get("ruleApplied") or {}).get("name","")
    n_alts   = len(p.get("alternatives") or [])
    deps     = ", ".join(p.get("dependencies") or [])

    # Validity
    if fn == "naics_code":
        vs = validate_naics(val, naics_lkp)
        validity = STATUS_ICONS.get(vs[0],"") + f" {vs[0]}"
    elif fn in ("mcc_code","mcc_code_found"):
        vs = validate_mcc(val, mcc_lkp)
        validity = STATUS_ICONS.get(vs[0],"") + f" {vs[0]}"
    else:
        validity = ""

    row = {
        "Fact":           fn,
        "Value":          val or "—",
        "Platform":       f"{pname} (ID:{pid})" if pid else "—",
        "Confidence":     round(float(conf),3) if conf is not None else None,
        "Last Updated":   updated or "—",
        "Rule Applied":   rule or "—",
        "Dependencies":   deps or "—",
        "Alternatives #": n_alts,
        "Validity":       validity,
    }

    if api_ok:
        af  = api_facts.get(fn, {}) or {}
        as_ = af.get("source") or {}
        av  = _v(af.get("value"))
        ap  = as_.get("name","") or platform_label(_v(as_.get("platformId","")))
        match = "✅" if (val and av and val == av) else ("⚠️ Differ" if (val and av) else "—")
        row["API Value"]    = av or "—"
        row["API Platform"] = ap or "—"
        row["Match"]        = match

    rows.append(row)

table_df = pd.DataFrame(rows)
cfg = {"Confidence": st.column_config.NumberColumn(format="%.3f"),
       "Alternatives #": st.column_config.NumberColumn(format="%d")}
st.dataframe(table_df, use_container_width=True, hide_index=True, column_config=cfg)

# Mismatch warning
if api_ok:
    mismatches = [r for r in rows if r.get("Match","") == "⚠️ Differ"]
    if mismatches:
        analyst_note(
            f"⚠️ {len(mismatches)} fact(s) differ between local cache and live API",
            "The local cache may have been built before the latest vendor enrichment ran. "
            "Re-run <code>python3 scripts/refresh_facts_cache.py</code> to update.",
            level="warning",
            bullets=[
                f"<code>{r['Fact']}</code>: cache = <code>{r['Value']}</code> | API = <code>{r['API Value']}</code>"
                for r in mismatches
            ],
            action="python3 scripts/refresh_facts_cache.py  (from naics_mcc_explorer/ folder)",
        )
    else:
        st.success("✅ Local cache matches live API for all classification facts.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# ALTERNATIVES
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📦 Alternatives — Other Sources That Submitted a Value")

for fn in ["naics_code", "mcc_code", "mcc_code_found"]:
    # Prefer API alternatives if loaded, then cache/redshift
    if api_ok and fn in api_facts:
        src_label = "🌐 Live API"
        raw_alts  = (api_facts.get(fn) or {}).get("alternatives") or []
        alts = []
        for a in raw_alts:
            s = a.get("source",{})
            if isinstance(s, dict):
                pid, conf, ts = str(s.get("platformId","")), s.get("confidence"), s.get("updatedAt","")
            else:
                pid, conf, ts = str(s), a.get("confidence"), ""
            alts.append({"Platform": platform_label(pid), "ID": pid,
                         "Value": a.get("value"), "Confidence": conf,
                         "Updated At": ts, "Source": src_label})
    else:
        src_label = primary_source_label
        p_alts = (primary_data.get(fn) or {}).get("alternatives") or []
        alts = []
        for a in p_alts:
            s = a.get("source",{})
            if isinstance(s, dict):
                pid, conf, ts = str(s.get("platformId","")), s.get("confidence"), s.get("updatedAt","")
            else:
                pid, conf, ts = str(s), a.get("confidence"), ""
            alts.append({"Platform": platform_label(pid), "ID": pid,
                         "Value": a.get("value"), "Confidence": conf,
                         "Updated At": ts, "Source": src_label})

    st.markdown(f"**`{fn}`** — {len(alts)} other source(s):")
    if alts:
        st.dataframe(pd.DataFrame(alts), hide_index=True, use_container_width=True)
    else:
        st.caption("No alternatives found.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# FULL JSON VIEW — Admin Portal format
# ═══════════════════════════════════════════════════════════════════════════════
section_header(
    "🔬 Full JSON — Admin Portal Format",
    "Includes schema, source, dependencies, description, ruleApplied, isNormalized, alternatives."
)

# Choose source: API if loaded, else primary_data
json_source = api_facts if api_ok else primary_data
json_source_label = "🌐 Live API" if api_ok else primary_source_label

fact_options = [fn for fn in DISPLAY_FACTS if fn in json_source]
if fact_options:
    fact_sel = st.selectbox("Select fact", fact_options, key="json_fact_sel")
    st.caption(f"Data from: {json_source_label}")
    if fact_sel:
        fact_obj = dict(json_source.get(fact_sel, {}))
        # Remove internal cache keys
        for k in list(fact_obj.keys()):
            if k.startswith("_"):
                del fact_obj[k]
        # Add flat source.* fields if missing
        src = fact_obj.get("source") or {}
        if isinstance(src, dict):
            fact_obj.setdefault("source.confidence", src.get("confidence"))
            fact_obj.setdefault("source.platformId",  src.get("platformId"))
            fact_obj.setdefault("source.name",        src.get("name"))
        st.json(fact_obj)

if api_ok:
    with st.expander("📄 Full raw API response (all facts)"):
        st.json(api_facts)

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# TIMING ANALYSIS
# ═══════════════════════════════════════════════════════════════════════════════
with st.expander("🕐 Timing Analysis — When each source submitted its value"):
    analyst_note(
        "The ~4-minute timing gap",
        "When a business submits the onboarding form, the system records it immediately with "
        "score 1.0. External providers return ~4 minutes later. "
        "<strong>Source Updated At</strong> = <code>source.updatedAt</code> inside the JSON — the real freshness indicator.",
        level="warning",
    )
    timing_rows = []
    for fn in FACT_NAMES:
        p = primary_data.get(fn)
        if not p: continue
        src = p.get("source") or {}
        alts = p.get("alternatives") or []
        pid   = _v(src.get("platformId",""))
        pname = src.get("name","") or platform_label(pid)
        timing_rows.append({
            "Fact": fn, "Role": "🏆 Winner",
            "Platform": pname, "Value": _v(p.get("value")),
            "Source Updated At": _v(src.get("updatedAt",""))[:19] or "—",
        })
        for a in alts:
            s = a.get("source",{})
            if isinstance(s, dict):
                ap, ats = platform_label(_v(s.get("platformId",""))), _v(s.get("updatedAt",""))[:19]
            else:
                ap, ats = platform_label(str(s)), ""
            timing_rows.append({
                "Fact": fn, "Role": "🥈 Other source",
                "Platform": ap, "Value": _v(a.get("value")),
                "Source Updated At": ats or "— (older format)",
            })
    if timing_rows:
        st.dataframe(pd.DataFrame(timing_rows), hide_index=True, use_container_width=True)

sql_panel("Redshift direct query for this business",
          f"""SELECT f.name, JSON_EXTRACT_PATH_TEXT(f.value,'value') AS value,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId') AS platform_id,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','name') AS source_name,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') AS confidence,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt') AS updated_at,
       f.received_at
FROM rds_warehouse_public.facts f
WHERE f.business_id = '{business_id}'
  AND f.name IN ('naics_code','mcc_code','mcc_code_found','mcc_code_from_naics',
                 'naics_description','mcc_description','industry')
  AND LENGTH(f.value) < 60000
ORDER BY f.name""", key_suffix="biz_drill")
