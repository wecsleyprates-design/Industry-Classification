"""Page 6 — Business Drilldown.

Full fact picture for a single business_id:
- Winning platform, value, confidence for each NAICS/MCC fact
- Alternatives parsed from raw JSON
- NAICS and MCC validity checks
- Timeline
- Plain-language summary
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
import json
from datetime import datetime

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import PLATFORM_MAP, platform_label, platform_color, FACT_NAMES
from utils.validators import validate_naics, validate_mcc, STATUS_COLORS, STATUS_ICONS
from db.queries import (
    load_business_facts, load_business_customer,
    load_naics_lookup, load_mcc_lookup,
)

st.set_page_config(page_title="Business Drilldown", page_icon="🔍", layout="wide")
st.markdown("""
<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
.fact-card{background:#1e293b;border:1px solid #334155;border-radius:8px;
           padding:14px 16px;margin:8px 0;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()

st.markdown("# 🔍 Business Drilldown")
st.markdown(
    "Enter a Business ID to see the complete NAICS/MCC fact picture for that business — "
    "winner, alternatives, validity checks, and a plain-language summary."
)
st.markdown("---")

# ── Business ID input ─────────────────────────────────────────────────────────
# Pre-populate from sidebar filter if set
default_bid = filters.get("business_id") or ""
bid_input = st.text_input(
    "🔑 Business ID (UUID)",
    value=default_bid,
    placeholder="e.g. 79aa7723-1234-5678-abcd-ef0123456789",
    key="drill_bid",
)

if not bid_input.strip():
    st.info("Enter a Business ID above to begin the drilldown.", icon="👆")
    st.stop()

business_id = bid_input.strip()

# ── Load data ──────────────────────────────────────────────────────────────────
with st.spinner("Loading business facts…"):
    facts_df = load_business_facts(business_id)

with st.spinner("Loading customer link…"):
    cust_df = load_business_customer(business_id)

with st.spinner("Loading lookup tables…"):
    naics_lookup = load_naics_lookup()
    mcc_lookup   = load_mcc_lookup()

if facts_df.empty:
    st.warning(
        f"No NAICS/MCC facts found for business `{business_id}`. "
        "Check that the UUID is correct and that the business is within the selected date range.",
        icon="⚠️",
    )
    st.stop()

facts_df["platform_name"] = facts_df["winning_platform_id"].apply(platform_label)
facts_df["conf_f"]        = pd.to_numeric(facts_df["winning_confidence"], errors="coerce").fillna(0)

# ── Customer link ──────────────────────────────────────────────────────────────
st.markdown(f"### 🏢 Business `{business_id}`")
if not cust_df.empty:
    col_meta1, col_meta2, col_meta3 = st.columns(3)
    with col_meta1:
        cust_ids = ", ".join(cust_df["customer_id"].tolist())
        st.markdown(f"**Customer ID(s):** `{cust_ids}`")
    with col_meta2:
        st.markdown(f"**First seen:** {cust_df['first_seen'].iloc[0]}")
    with col_meta3:
        st.markdown(f"**Last seen:** {cust_df['last_seen'].iloc[0]}")

st.markdown("---")

# ── Plain-language summary ────────────────────────────────────────────────────
section_header("📝 Plain-Language Summary")

summary_lines = []
for fn in FACT_NAMES:
    row = facts_df[facts_df["fact_name"] == fn]
    if row.empty:
        summary_lines.append(f"- **`{fn}`**: ❌ No fact record found for this business.")
        continue
    r = row.iloc[0]
    pid  = r["winning_platform_id"]
    val  = r["winning_value"]
    conf = r["conf_f"]
    pname = platform_label(pid)

    if val is None or str(val).strip() in ("", "None", "null"):
        flag = "⬜ Null winner"
        note = f"P0 wrote null with confidence {conf:.2f} — real vendor data was locked out." if pid == "0" else f"No value from {pname}."
    elif fn == "naics_code":
        status, reason = validate_naics(val, naics_lookup)
        flag = STATUS_ICONS.get(status, "?") + " " + status
        note = reason
    elif fn in ("mcc_code", "mcc_code_found", "mcc_code_from_naics"):
        status, reason = validate_mcc(val, mcc_lookup)
        flag = STATUS_ICONS.get(status, "?") + " " + status
        note = reason
    else:
        flag, note = "—", ""

    summary_lines.append(
        f"- **`{fn}`**: Winner = `{val}` from **{pname}** "
        f"(confidence: `{conf:.2f}`) — {flag} — {note}"
    )

for line in summary_lines:
    st.markdown(line)

st.markdown("---")

# ── Per-fact detail cards ──────────────────────────────────────────────────────
section_header("🗂️ Fact Detail Cards")

fact_tabs = st.tabs([f"`{fn}`" for fn in FACT_NAMES])

for tab, fn in zip(fact_tabs, FACT_NAMES):
    with tab:
        row = facts_df[facts_df["fact_name"] == fn]
        if row.empty:
            st.info(f"No `{fn}` fact found for this business.")
            continue

        r = row.iloc[0]
        pid  = r["winning_platform_id"]
        val  = r["winning_value"]
        conf = r["conf_f"]
        raw  = r["raw_json"]

        c1, c2, c3 = st.columns(3)
        with c1:
            kpi("Winning Platform", platform_label(pid),
                f"platformId = {pid}", platform_color(pid))
        with c2:
            kpi("Winning Value", str(val) if val else "null",
                "", "#22c55e" if val else "#ef4444")
        with c3:
            kpi("Confidence", f"{conf:.3f}", "", "#6366f1")

        # Validity badge
        if fn == "naics_code" and val:
            status, reason = validate_naics(val, naics_lookup)
            color = STATUS_COLORS.get(status, "#64748b")
            icon  = STATUS_ICONS.get(status, "?")
            st.markdown(
                f"<div style='background:{color}22;border:1px solid {color};border-radius:6px;"
                f"padding:8px 14px;margin:8px 0;color:{color};font-weight:600'>"
                f"{icon} NAICS validity: <strong>{status}</strong> — {reason}</div>",
                unsafe_allow_html=True,
            )
        elif fn in ("mcc_code", "mcc_code_found") and val:
            status, reason = validate_mcc(val, mcc_lookup)
            color = STATUS_COLORS.get(status, "#64748b")
            icon  = STATUS_ICONS.get(status, "?")
            st.markdown(
                f"<div style='background:{color}22;border:1px solid {color};border-radius:6px;"
                f"padding:8px 14px;margin:8px 0;color:{color};font-weight:600'>"
                f"{icon} MCC validity: <strong>{status}</strong> — {reason}</div>",
                unsafe_allow_html=True,
            )

        # Alternatives table
        st.markdown("**Non-winning alternatives (`alternatives[]`):**")
        alt_rows = []
        try:
            obj = json.loads(str(raw)) if isinstance(raw, str) else {}
            for a in (obj.get("alternatives") or []):
                src = a.get("source", {})
                if isinstance(src, dict):
                    alt_pid  = str(src.get("platformId", "?"))
                    alt_conf = src.get("confidence", a.get("confidence", "?"))
                    alt_ts   = src.get("updatedAt", "")
                else:
                    alt_pid  = str(src)
                    alt_conf = a.get("confidence", "?")
                    alt_ts   = ""
                alt_rows.append({
                    "Platform":     platform_label(alt_pid),
                    "Platform ID":  alt_pid,
                    "Value":        a.get("value"),
                    "Confidence":   alt_conf,
                    "Updated At":   alt_ts,
                    "Is Winner":    "❌ No",
                })
        except Exception as e:
            st.caption(f"Could not parse alternatives: {e}")

        if alt_rows:
            alt_df = pd.DataFrame(alt_rows)
            st.dataframe(alt_df, hide_index=True, use_container_width=True)
        else:
            st.caption("No alternatives found or fact is in old schema format.")

        # Raw JSON
        with st.expander("🔬 Raw JSON"):
            try:
                parsed = json.loads(str(raw)) if isinstance(raw, str) else raw
                st.json(parsed)
            except Exception:
                st.code(str(raw))

st.markdown("---")

# ── Timeline ──────────────────────────────────────────────────────────────────
section_header("📅 Fact Timeline", "When facts were last received for this business")

timeline_df = facts_df[["fact_name", "winning_platform_id", "winning_value",
                          "conf_f", "received_at", "created_at"]].copy()
timeline_df["platform_name"] = timeline_df["winning_platform_id"].apply(platform_label)
timeline_df = timeline_df.sort_values("received_at", ascending=False)

display_tl = timeline_df[[
    "fact_name", "platform_name", "winning_value", "conf_f", "received_at",
]].copy()
display_tl.columns = ["Fact", "Platform", "Value", "Confidence", "Received At"]

st.dataframe(
    display_tl,
    hide_index=True,
    use_container_width=True,
    column_config={
        "Confidence":   st.column_config.NumberColumn(format="%.3f"),
        "Received At":  st.column_config.DatetimeColumn(),
    },
)

# ── Compare to platform timeline (4-minute ghost assigner pattern) ─────────────
st.markdown("---")
with st.expander("🕐 Ghost Assigner Timing Analysis"):
    st.markdown(
        "**The Ghost Assigner Pattern:** `platformId: 0` always runs ~4 minutes before real vendors. "
        "If P0 wrote `confidence: 1` first, real vendors lose the arbitration race regardless of "
        "their values. Check `received_at` timestamps between P0 and vendors in the alternatives."
    )

    for fn in FACT_NAMES:
        row = facts_df[facts_df["fact_name"] == fn]
        if row.empty:
            continue
        r = row.iloc[0]
        raw = r["raw_json"]
        try:
            obj = json.loads(str(raw)) if isinstance(raw, str) else {}
            winner_pid = r["winning_platform_id"]
            winner_ts  = None
            try:
                src = obj.get("source") or {}
                winner_ts = src.get("updatedAt") if isinstance(src, dict) else None
            except Exception:
                pass

            alt_times = []
            for a in (obj.get("alternatives") or []):
                src = a.get("source", {})
                ts  = src.get("updatedAt", "") if isinstance(src, dict) else ""
                pid = str(src.get("platformId", "?")) if isinstance(src, dict) else str(src)
                if ts:
                    alt_times.append({"Platform": platform_label(pid), "Timestamp": ts})

            if winner_ts or alt_times:
                st.markdown(f"**`{fn}`**")
                timing_rows = []
                if winner_ts:
                    timing_rows.append({
                        "Role": "🏆 Winner",
                        "Platform": platform_label(winner_pid),
                        "Timestamp": winner_ts,
                    })
                for at in alt_times:
                    timing_rows.append({"Role": "🥈 Alternative", **at})
                st.dataframe(pd.DataFrame(timing_rows), hide_index=True, use_container_width=True)
        except Exception:
            pass
