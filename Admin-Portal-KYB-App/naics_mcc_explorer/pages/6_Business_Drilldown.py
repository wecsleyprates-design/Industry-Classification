"""Page 6 — Business Drilldown with alternatives, timing analysis, SQL runner."""
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
from db.queries import load_business_facts, load_business_customer, load_naics_lookup, load_mcc_lookup

st.set_page_config(page_title="Business Drilldown", page_icon="🔍", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()

st.markdown("# 🔍 Business Drilldown")
st.markdown("Complete fact picture for a single business: winner, alternatives, validity checks, and timing analysis.")
platform_legend_panel()
st.markdown("---")

default_bid = filters.get("business_id") or ""
bid_input = st.text_input("🔑 Business ID (UUID)", value=default_bid,
                           placeholder="e.g. 79aa7723-1234-5678-abcd-ef0123456789",
                           key="drill_bid")

if not bid_input.strip():
    st.info("Enter a Business ID above to begin the drilldown.", icon="👆")
    st.stop()

business_id = bid_input.strip()

with st.spinner("Loading business facts…"):
    facts_df = load_business_facts(business_id)
with st.spinner("Loading customer link…"):
    cust_df = load_business_customer(business_id)
with st.spinner("Loading lookups…"):
    naics_lookup = load_naics_lookup()
    mcc_lookup   = load_mcc_lookup()

if facts_df.empty:
    st.warning(f"No NAICS/MCC facts found for business `{business_id}`.", icon="⚠️")
    st.stop()

facts_df["eff_pid"]       = facts_df.apply(
    lambda r: r["winning_platform_id"] if str(r["winning_platform_id"]) not in ("unknown","","None")
              else (r.get("legacy_source_name") or "unknown"), axis=1
).astype(str)
facts_df["platform_name"] = facts_df["eff_pid"].apply(platform_label)
facts_df["conf_f"]        = pd.to_numeric(facts_df["winning_confidence"], errors="coerce").fillna(0)

st.markdown(f"### 🏢 Business `{business_id}`")
if not cust_df.empty:
    c1,c2,c3 = st.columns(3)
    with c1: st.markdown(f"**Customer:** `{cust_df['customer_name'].iloc[0]}`")
    with c2: st.markdown(f"**First seen:** {cust_df['first_seen'].iloc[0]}")
    with c3: st.markdown(f"**Last seen:** {cust_df['last_seen'].iloc[0]}")
st.markdown("---")

# ── Plain-language summary ────────────────────────────────────────────────────
section_header("📝 Plain-Language Summary")

issues_found = []
summary_lines = []
for fn in FACT_NAMES:
    row = facts_df[facts_df["fact_name"]==fn]
    if row.empty:
        summary_lines.append(f"- **`{fn}`**: ❌ No fact record found.")
        issues_found.append(f"Missing `{fn}` fact entirely")
        continue
    r = row.iloc[0]
    pid, val, conf = r["eff_pid"], r["winning_value"], r["conf_f"]
    pname = platform_label(pid)
    if _null := (val is None or str(val).strip() in ("","None","null")):
        flag = "⬜ Null winner"
        note = f"P0 wrote null with confidence {conf:.2f} — real vendor data locked out." if pid=="0" else f"No value written by {pname}."
        issues_found.append(f"`{fn}` has a null winner from {pname}")
    elif fn=="naics_code":
        status, reason = validate_naics(val, naics_lookup)
        flag = STATUS_ICONS.get(status,"?") + " " + status
        note = reason
        if status != "valid": issues_found.append(f"`{fn}` = {val} ({status})")
    elif fn in ("mcc_code","mcc_code_found"):
        status, reason = validate_mcc(val, mcc_lookup)
        flag = STATUS_ICONS.get(status,"?") + " " + status
        note = reason
        if status != "valid": issues_found.append(f"`{fn}` = {val} ({status})")
    else:
        flag, note = "—", ""
    summary_lines.append(f"- **`{fn}`**: Winner = `{val}` from **{pname}** (confidence `{conf:.2f}`) — {flag} — {note}")

for line in summary_lines:
    st.markdown(line)

if issues_found:
    analyst_note("Issues detected for this business",
        "The following data quality problems were found:",
        level="danger" if any("null" in i or "invalid" in i for i in issues_found) else "warning",
        bullets=issues_found)
else:
    analyst_note("No issues detected", "All facts are valid and have non-null winning values.", level="success")

st.markdown("---")

# ── Fact tabs ──────────────────────────────────────────────────────────────────
section_header("🗂️ Fact Detail Cards")
tabs = st.tabs([f"`{fn}`" for fn in FACT_NAMES])

for tab, fn in zip(tabs, FACT_NAMES):
    with tab:
        row = facts_df[facts_df["fact_name"]==fn]
        if row.empty:
            st.info(f"No `{fn}` fact found for this business.")
            continue
        r = row.iloc[0]
        pid, val, conf = r["eff_pid"], r["winning_value"], r["conf_f"]
        raw = r.get("raw_json","")

        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("Winning Platform", platform_label(pid), f"platformId={pid}", platform_color(pid))
        with c2: kpi("Winning Value", str(val) if val else "null", "",
                     "#22c55e" if val else "#ef4444")
        with c3: kpi("Confidence", f"{conf:.3f}", "", "#6366f1")
        with c4: kpi("Winner Updated At", str(r.get("winner_updated_at",""))[:19] or "—", "", "#334155")

        # Validity badge
        if fn=="naics_code" and val:
            status, reason = validate_naics(val, naics_lookup)
            color = STATUS_COLORS.get(status,"#64748b")
            icon  = STATUS_ICONS.get(status,"?")
            st.markdown(
                f"<div style='background:{color}22;border:1px solid {color};border-radius:6px;"
                f"padding:8px 14px;margin:8px 0;color:{color};font-weight:600'>"
                f"{icon} NAICS validity: <strong>{status}</strong> — {reason}</div>",
                unsafe_allow_html=True)
        elif fn in ("mcc_code","mcc_code_found") and val:
            status, reason = validate_mcc(val, mcc_lookup)
            color = STATUS_COLORS.get(status,"#64748b")
            icon  = STATUS_ICONS.get(status,"?")
            st.markdown(
                f"<div style='background:{color}22;border:1px solid {color};border-radius:6px;"
                f"padding:8px 14px;margin:8px 0;color:{color};font-weight:600'>"
                f"{icon} MCC validity: <strong>{status}</strong> — {reason}</div>",
                unsafe_allow_html=True)

        # Alternatives table
        st.markdown("**Non-winning alternatives (`alternatives[]`):**")
        alts = parse_alternatives(raw)
        if alts:
            alt_df = pd.DataFrame(alts)
            alt_df.columns = ["Platform","Platform ID","Value","Confidence","Updated At"]
            st.dataframe(alt_df, hide_index=True, use_container_width=True)
            analyst_note(
                f"Alternatives for `{fn}`",
                "These platforms submitted a value but lost the confidence arbitration race. "
                "If the winner is null or invalid, check whether any alternative has a valid value — "
                "that would confirm the arbitration bug is actively suppressing real data for this business.",
                level="warning" if (val is None or str(val).strip() in ("","None","null")) else "info",
            )
        else:
            st.caption("No alternatives found (may be legacy schema or single-platform fact).")

        with st.expander("🔬 Raw JSON"):
            try:
                st.json(json.loads(str(raw)))
            except Exception:
                st.code(str(raw))

sql_panel("Business Facts",
          f"""SELECT f.name AS fact_name,
       JSON_EXTRACT_PATH_TEXT(f.value,'value')                                    AS winning_value,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown')  AS winning_platform_id,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','name')                            AS legacy_source_name,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0')        AS winning_confidence,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt')                       AS winner_updated_at,
       f.received_at, f.created_at
FROM rds_warehouse_public.facts f
WHERE f.business_id = '{business_id}'
  AND f.name IN ('naics_code','mcc_code','mcc_code_found','mcc_code_from_naics')
  AND LENGTH(f.value) < 60000
ORDER BY f.name, f.received_at DESC""", key_suffix="biz_drill")
st.markdown("---")

# ── Timeline ──────────────────────────────────────────────────────────────────
section_header("📅 Fact Timeline")
tl = facts_df[["fact_name","platform_name","winning_value","conf_f","received_at"]].copy()
tl.columns = ["Fact","Platform","Value","Confidence","Received At"]
st.dataframe(tl.sort_values("Received At",ascending=False), hide_index=True, use_container_width=True,
             column_config={"Confidence": st.column_config.NumberColumn(format="%.3f"),
                            "Received At": st.column_config.DatetimeColumn()})

# ── Ghost Assigner timing ──────────────────────────────────────────────────────
st.markdown("---")
with st.expander("🕐 Ghost Assigner Timing Analysis — P0 runs first, vendors come ~4 min later"):
    analyst_note(
        "The ~4-minute timing pattern",
        "P0 (Applicant Entry) always writes its fact immediately when the business submits their onboarding form. "
        "Real vendors (ZoomInfo, SERP) run asynchronously and return ~4 minutes later. "
        "By the time vendors return, P0 has already claimed the winner slot with confidence=1. "
        "If the <strong>Winner Updated At</strong> timestamp is ~4 minutes before alternative timestamps, "
        "this confirms the ghost assigner pattern for this specific business.",
        level="warning",
    )
    for fn in FACT_NAMES:
        row = facts_df[facts_df["fact_name"]==fn]
        if row.empty: continue
        r = row.iloc[0]
        raw = r.get("raw_json","")
        alts = parse_alternatives(raw)
        winner_ts = str(r.get("winner_updated_at",""))
        if alts or winner_ts:
            st.markdown(f"**`{fn}`**")
            timing = []
            if winner_ts:
                timing.append({"Role":"🏆 Winner","Platform":platform_label(r["eff_pid"]),"Timestamp":winner_ts})
            for a in alts:
                timing.append({"Role":"🥈 Alternative","Platform":a["alt_platform"],"Timestamp":a["alt_updated_at"]})
            if timing:
                st.dataframe(pd.DataFrame(timing), hide_index=True, use_container_width=True)
