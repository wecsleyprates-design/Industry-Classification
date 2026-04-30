"""Page 6 — Business Drilldown with live API comparison.

Combines two data sources for every business:

  1. Worth AI Details API (live, real-time)
     GET /verification/businesses/{businessID}/details
     → current fact values, source.updatedAt, alternatives[], ruleApplied

  2. Redshift (rds_warehouse_public.facts)
     → historical rows, received_at, raw_json blob

Side-by-side comparison shows whether both sources agree and highlights
discrepancies. Also validates NAICS/MCC codes against the canonical
lookup tables and checks canonical pair status.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
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
    "Full classification picture for a single business. "
    "When the Worth AI API is configured, shows a **live side-by-side comparison** "
    "between the API's current view and what is stored in Redshift."
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
    "use **{A}** (the first UUID after `/businesses/`). "
    "The tab you're on (Background, Business Registration, etc.) doesn't matter — "
    "it's always the same business ID. "
    "This matches the `business_id` in `rds_warehouse_public.facts`."
)

if not bid_input.strip():
    st.info("Enter a Business ID above to begin the drilldown.", icon="👆")
    st.stop()

business_id = bid_input.strip()

# ── Load Redshift data ────────────────────────────────────────────────────────
with st.spinner("Loading business facts from Redshift…"):
    facts_df = load_business_facts(business_id)

with st.spinner("Loading customer link…"):
    cust_df = load_business_customer(business_id)

with st.spinner("Loading lookup tables…"):
    naics_lookup = load_naics_lookup()
    mcc_lookup   = load_mcc_lookup()

with st.spinner("Loading canonical mapping…"):
    canonical_df = load_canonical_pairs()
    canonical_pairs = set()
    if canonical_df is not None and not canonical_df.empty:
        canonical_pairs = {
            (str(r["naics_code"]).strip(), str(r["mcc_code"]).strip())
            for _, r in canonical_df.iterrows()
        }

# ── Business header ───────────────────────────────────────────────────────────
st.markdown(f"### 🏢 Business `{business_id}`")
if cust_df is not None and not cust_df.empty:
    c1, c2, c3 = st.columns(3)
    with c1: st.markdown(f"**Customer:** `{cust_df['customer_name'].iloc[0]}`")
    with c2: st.markdown(f"**First seen:** {cust_df['first_seen'].iloc[0]}")
    with c3: st.markdown(f"**Last seen:** {cust_df['last_seen'].iloc[0]}")

if facts_df is None or facts_df.empty:
    st.warning(f"No NAICS/MCC facts found in Redshift for `{business_id}`.", icon="⚠️")

# ── Resolve platform display for Redshift rows ────────────────────────────────
if facts_df is not None and not facts_df.empty:
    facts_df["eff_pid"] = facts_df.apply(
        lambda r: r["winning_platform_id"]
        if str(r["winning_platform_id"]) not in ("unknown", "", "None")
        else (r.get("legacy_source_name") or "unknown"),
        axis=1,
    ).astype(str)
    facts_df["platform_name"] = facts_df["eff_pid"].apply(platform_label)
    facts_df["conf_f"]        = pd.to_numeric(facts_df["winning_confidence"], errors="coerce").fillna(0)
else:
    facts_df = pd.DataFrame()

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# LIVE API COMPARISON SECTION
# ═══════════════════════════════════════════════════════════════════════════════

api_configured = worth_api.is_configured()

if not api_configured:
    st.info(
        "**Live API comparison not configured.** "
        "Add your Worth AI credentials to `.streamlit/secrets.toml` to enable "
        "real-time comparison against the Admin Portal data. "
        "See the README for instructions.",
        icon="🔑",
    )
else:
    section_header(
        "🔄 Live API vs Redshift — Side-by-Side Comparison",
        "API data = live current state from admin.joinworth.com. "
        "Redshift = what the facts table stores. Both should agree on the current value.",
    )

    load_api = st.button(
        "🔄 Load live API data for this business",
        key="load_api_btn",
        help="Calls GET /verification/businesses/{id}/details in real time",
    )

    if load_api or st.session_state.get(f"api_loaded_{business_id}"):
        st.session_state[f"api_loaded_{business_id}"] = True

        with st.spinner("Calling Worth AI API…"):
            try:
                api_details = worth_api.get_business_details(business_id)
                api_facts   = worth_api.extract_classification_facts(api_details)
                api_ok      = True
                api_err     = None
            except RuntimeError as e:
                api_ok    = False
                api_err   = str(e)
                api_facts = {}

        if not api_ok:
            st.error(f"❌ API call failed: {api_err}", icon="🚨")
        else:
            st.success("✅ API response received successfully.")

            # ── Build comparison table ────────────────────────────────────────
            COMPARE_FACTS = [
                "naics_code", "naics_description",
                "mcc_code", "mcc_code_found", "mcc_code_from_naics", "mcc_description",
                "industry",
            ]

            rows = []
            for fn in COMPARE_FACTS:
                # API side
                api_fact   = api_facts.get(fn, {}) or {}
                api_value  = api_fact.get("value")
                api_src    = api_fact.get("source") or {}
                api_pid    = str(api_src.get("platformId", "")) if isinstance(api_src, dict) else str(api_src)
                api_name   = api_src.get("name", "") if isinstance(api_src, dict) else ""
                api_conf   = api_src.get("confidence", "") if isinstance(api_src, dict) else ""
                api_ts     = api_src.get("updatedAt", "") if isinstance(api_src, dict) else ""
                api_rule   = (api_fact.get("ruleApplied") or {}).get("name", "")
                api_alts   = api_fact.get("alternatives", []) or []
                n_api_alts = len(api_alts)

                # Redshift side
                if not facts_df.empty:
                    rds_row = facts_df[facts_df["fact_name"] == fn]
                    if not rds_row.empty:
                        r = rds_row.iloc[0]
                        rds_value    = r["winning_value"]
                        rds_pid      = r["eff_pid"]
                        rds_conf     = r["conf_f"]
                        rds_ts       = str(r.get("winner_updated_at", "")).strip()
                        rds_received = str(r.get("received_at", "")).strip()
                    else:
                        rds_value = rds_pid = rds_conf = rds_ts = rds_received = None
                else:
                    rds_value = rds_pid = rds_conf = rds_ts = rds_received = None

                # Agreement check
                def _v(x): return str(x).strip() if x is not None else ""
                api_v_str = _v(api_value)
                rds_v_str = _v(rds_value)
                if api_v_str == "" and rds_v_str == "":
                    match_icon = "⬜"
                    match_label = "Both empty"
                elif api_v_str == rds_v_str:
                    match_icon = "✅"
                    match_label = "Match"
                else:
                    match_icon = "⚠️"
                    match_label = "Differ"

                rows.append({
                    "Fact":                fn,
                    "API Value":           api_value,
                    "API Platform":        f"{api_name or platform_label(api_pid)} (ID:{api_pid})" if api_pid else "",
                    "API Confidence":      api_conf,
                    "API Updated At":      api_ts,
                    "API Rule Applied":    api_rule,
                    "API Alternatives #":  n_api_alts,
                    "Redshift Value":      rds_value,
                    "Redshift Platform":   platform_label(rds_pid) if rds_pid else "",
                    "Redshift Confidence": rds_conf,
                    "Redshift Updated At": rds_ts or "—",
                    "Redshift Received At":rds_received or "—",
                    "Match":               f"{match_icon} {match_label}",
                })

            compare_df = pd.DataFrame(rows)

            # Highlight mismatch rows
            n_mismatch = int((compare_df["Match"].str.startswith("⚠️")).sum())
            n_match    = int((compare_df["Match"].str.startswith("✅")).sum())

            c1, c2, c3 = st.columns(3)
            with c1: kpi("Facts compared", f"{len(rows):,}", color="#3b82f6")
            with c2: kpi("✅ Agree",        f"{n_match:,}", "", "#22c55e")
            with c3: kpi("⚠️ Differ",       f"{n_mismatch:,}",
                         "API and Redshift show different values" if n_mismatch else "",
                         "#ef4444" if n_mismatch else "#22c55e")

            if n_mismatch > 0:
                analyst_note(
                    "Why might API and Redshift differ?",
                    "Both sources read from the same underlying PostgreSQL database — "
                    "they should normally agree. A difference means either: "
                    "(1) A facts refresh happened after the Redshift row was last read — "
                    "the API reflects the update, Redshift cached an older value. "
                    "(2) The <code>received_at</code> timestamp on the Redshift row is stale "
                    "even though the JSON blob inside it was updated. "
                    "In both cases, the <strong>API value is the current truth</strong>.",
                    level="warning",
                    bullets=[
                        "API value = current live state from the integration service",
                        "Redshift value = what was stored in the facts JSON blob when last read",
                        "If Redshift shows 'received_at: 2026-02-12' but API shows 'updatedAt: 2026-04-22', the data IS fresh — only the row metadata is stale",
                    ],
                )

            st.markdown("")
            st.dataframe(
                compare_df,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "API Confidence":      st.column_config.TextColumn(),
                    "Redshift Confidence": st.column_config.NumberColumn(format="%.3f"),
                    "API Alternatives #":  st.column_config.NumberColumn(format="%d"),
                },
            )
            st.download_button(
                "⬇️ Download comparison table",
                compare_df.to_csv(index=False).encode(),
                f"api_vs_redshift_{business_id[:8]}.csv", "text/csv",
                key="dl_compare",
            )

            # ── Alternatives drill-down ────────────────────────────────────────
            st.markdown("---")
            st.markdown("#### 📋 Alternatives — All Sources That Submitted a Value")
            st.caption(
                "Every data source that returned a value for this business, "
                "including those that didn't win. From the live API response."
            )

            for fn in ["naics_code", "mcc_code", "mcc_code_found"]:
                api_fact = api_facts.get(fn, {}) or {}
                api_alts = api_fact.get("alternatives", []) or []
                if not api_alts:
                    continue

                st.markdown(f"**`{fn}`** — {len(api_alts)} other source(s):")
                alt_rows = []
                for a in api_alts:
                    src = a.get("source", {})
                    if isinstance(src, dict):
                        pid  = str(src.get("platformId", "?"))
                        name = src.get("name", "")
                        conf = src.get("confidence", a.get("confidence", ""))
                        ts   = src.get("updatedAt", "")
                    else:
                        pid  = str(src)
                        name = ""
                        conf = a.get("confidence", "")
                        ts   = ""
                    alt_rows.append({
                        "Platform":    platform_label(pid),
                        "Platform ID": pid,
                        "Source Name": name,
                        "Value":       a.get("value"),
                        "Confidence":  conf,
                        "Updated At":  ts,
                    })
                st.dataframe(pd.DataFrame(alt_rows), hide_index=True, use_container_width=True)

            # ── Canonical pair check from API data ────────────────────────────
            api_naics = _v((api_facts.get("naics_code") or {}).get("value"))
            api_mcc   = _v((api_facts.get("mcc_code")   or {}).get("value"))
            if api_naics and api_mcc:
                is_canonical = (api_naics, api_mcc) in canonical_pairs
                canon_icon   = "✅" if is_canonical else "⚠️"
                canon_label  = "Recognized combination (canonical)" if is_canonical else "Unrecognized combination — not in official mapping"
                st.markdown("---")
                st.markdown(f"**Industry + Payment Category combination:** {canon_icon} `{api_naics}` → `{api_mcc}` — {canon_label}")

            # ── Raw API JSON ──────────────────────────────────────────────────
            with st.expander("🔬 Full raw API response"):
                st.json(api_facts)

    st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# REDSHIFT FACT DETAIL CARDS
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🗂️ Redshift Fact Detail — All Sources' Submitted Values")
st.caption("Data from rds_warehouse_public.facts. Winner + all other sources that submitted a value.")

if facts_df.empty:
    no_data("No facts found in Redshift for this business ID.")
else:
    tabs = st.tabs([f"`{fn}`" for fn in FACT_NAMES])

    for tab, fn in zip(tabs, FACT_NAMES):
        with tab:
            row = facts_df[facts_df["fact_name"] == fn]
            if row.empty:
                st.info(f"No `{fn}` fact found in Redshift for this business.")
                continue
            r = row.iloc[0]
            pid, val, conf = r["eff_pid"], r["winning_value"], r["conf_f"]
            raw = r.get("raw_json", "")

            c1, c2, c3, c4 = st.columns(4)
            with c1: kpi("Winning Platform", platform_label(pid), f"ID={pid}", platform_color(pid))
            with c2: kpi("Winning Value", str(val) if val else "— (blank)", "",
                         "#22c55e" if val else "#ef4444")
            with c3: kpi("Confidence Score", f"{conf:.3f}", "", "#6366f1")
            with c4: kpi("Winner Updated At",
                         str(r.get("winner_updated_at", ""))[:19] or "—", "", "#334155")

            # Validity badge
            if fn == "naics_code" and val:
                status, reason = validate_naics(val, naics_lookup)
                color = STATUS_COLORS.get(status, "#64748b")
                icon  = STATUS_ICONS.get(status, "?")
                st.markdown(
                    f"<div style='background:{color}22;border:1px solid {color};"
                    f"border-radius:6px;padding:8px 14px;margin:8px 0;"
                    f"color:{color};font-weight:600'>"
                    f"{icon} NAICS validity: <strong>{status}</strong> — {reason}</div>",
                    unsafe_allow_html=True,
                )
            elif fn in ("mcc_code", "mcc_code_found") and val:
                status, reason = validate_mcc(val, mcc_lookup)
                color = STATUS_COLORS.get(status, "#64748b")
                icon  = STATUS_ICONS.get(status, "?")
                st.markdown(
                    f"<div style='background:{color}22;border:1px solid {color};"
                    f"border-radius:6px;padding:8px 14px;margin:8px 0;"
                    f"color:{color};font-weight:600'>"
                    f"{icon} MCC validity: <strong>{status}</strong> — {reason}</div>",
                    unsafe_allow_html=True,
                )

            # Other sources that submitted values
            st.markdown("**Other sources that submitted a value but didn't win:**")
            alts = parse_alternatives(raw)
            if alts:
                alt_df = pd.DataFrame(alts)
                alt_df.columns = ["Platform", "Platform ID", "Value", "Confidence", "Updated At"]
                st.dataframe(alt_df, hide_index=True, use_container_width=True)
                analyst_note(
                    f"Reading the alternatives for `{fn}`",
                    "These sources also submitted a value but scored lower. "
                    "If the winner is blank or invalid, check whether any of these has a valid value — "
                    "that confirms real data was available but overridden.",
                    level="warning" if not val else "info",
                )
            else:
                st.caption("No other sources found (single source or older format).")

            with st.expander("🔬 Raw JSON from Redshift"):
                try:
                    st.json(json.loads(str(raw)))
                except Exception:
                    st.code(str(raw))

    sql_panel("Redshift facts query for this business",
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

# ── Timing analysis ────────────────────────────────────────────────────────────
st.markdown("---")
if not facts_df.empty:
    with st.expander("🕐 Timing Analysis — Why the business's own submission wins before vendors respond"):
        analyst_note(
            "The ~4-minute timing gap",
            "When a business submits its onboarding form, the system immediately records that "
            "submission with the highest score (1.0). External providers like ZoomInfo and SERP "
            "run separately and return results ~4 minutes later. By then, the form submission has "
            "already won. <strong>Winner Updated At</strong> = when the winning source last wrote its value. "
            "<strong>Fact Received At</strong> = when the Redshift row was created (may be much earlier). "
            "⚠️ Older records store alternatives as a plain number (e.g. source=24) without a "
            "timestamp — those show blank in the Timestamp column.",
            level="warning",
        )
        for fn in FACT_NAMES:
            row = facts_df[facts_df["fact_name"] == fn]
            if row.empty:
                continue
            r = row.iloc[0]
            raw = r.get("raw_json", "")
            alts = parse_alternatives(raw)
            winner_ts     = str(r.get("winner_updated_at", "")).strip()
            fact_received = str(r.get("received_at", "")).strip()

            st.markdown(f"**`{fn}`**")
            timing = [{
                "Role":              "🏆 Winner",
                "Platform":         platform_label(r["eff_pid"]),
                "Source Updated At": winner_ts or "—",
                "Fact Received At":  fact_received or "—",
            }]
            for a in alts:
                timing.append({
                    "Role":              "🥈 Other source",
                    "Platform":         a["alt_platform"],
                    "Source Updated At": str(a["alt_updated_at"]).strip() or "— (older format)",
                    "Fact Received At":  "—",
                })
            if timing:
                st.dataframe(pd.DataFrame(timing), hide_index=True, use_container_width=True)
