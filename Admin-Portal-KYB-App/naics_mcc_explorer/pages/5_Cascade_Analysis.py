"""Page 5 — NAICS ↔ MCC Cascade Analysis.

Shows how null or catch-all NAICS winners cascade into degraded MCC quality.
Funnel chart: total → null NAICS → AI-only MCC → no MCC → healthy.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import re

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import platform_label, platform_color, CATCH_ALL_NAICS, CATCH_ALL_MCC, KNOWN_INVALID_MCC
from utils.validators import validate_naics, validate_mcc, STATUS_COLORS
from db.queries import load_cascade_summary, load_naics_lookup, load_mcc_lookup

st.set_page_config(page_title="Cascade Analysis", page_icon="⛓️", layout="wide")
st.markdown("""
<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]
f_biz  = filters["business_id"]

st.markdown("# ⛓️ NAICS → MCC Cascade Analysis")
st.markdown(
    "A bad NAICS code doesn't just corrupt NAICS — it corrupts MCC too, because "
    "`mcc_code_from_naics` (Path 2) derives from whatever NAICS value won. "
    "This page traces that cascade end-to-end."
)
st.markdown("---")

with st.spinner("Loading cascade data…"):
    df = load_cascade_summary(f_from, f_to, f_cust, f_biz)

with st.spinner("Loading NAICS lookup…"):
    naics_lookup = load_naics_lookup()

with st.spinner("Loading MCC lookup…"):
    mcc_lookup = load_mcc_lookup()

if df.empty:
    no_data("No data found for the selected filters.")
    st.stop()

total = len(df)

# ── Classify each business ──────────────────────────────────────────────────────
def _naics_null(v): return v is None or str(v).strip() in ("", "None", "null")
def _naics_catchall(v): return str(v).strip() in CATCH_ALL_NAICS if v else False
def _mcc_null(v): return v is None or str(v).strip() in ("", "None", "null")
def _mcc_catchall(v): return str(v).strip() in CATCH_ALL_MCC if v else False
def _mcc_bad(v): return str(v).strip() in KNOWN_INVALID_MCC if v else False

df["naics_is_null"]     = df["naics_value"].apply(_naics_null)
df["naics_is_catchall"] = df["naics_value"].apply(_naics_catchall)
df["naics_is_valid"]    = df.apply(
    lambda r: validate_naics(r["naics_value"], naics_lookup)[0] == "valid", axis=1
)
df["mcc_is_null"]    = df["mcc_value"].apply(_mcc_null)
df["mcc_is_catchall"]= df["mcc_value"].apply(_mcc_catchall)
df["mcc_is_bad"]     = df["mcc_value"].apply(_mcc_bad)
df["has_ai_mcc"]     = ~df["mcc_found_value"].apply(_mcc_null)
df["has_naics_mcc"]  = ~df["mcc_from_naics_value"].apply(_mcc_null)

# Tiers
n_healthy     = int(df[df["naics_is_valid"] & ~df["mcc_is_null"] & ~df["mcc_is_catchall"]].shape[0])
n_null_naics  = int(df[df["naics_is_null"]].shape[0])
n_catchall_naics = int(df[df["naics_is_catchall"]].shape[0])
n_bad_naics   = n_null_naics + n_catchall_naics
n_ai_protected = int(df[df["naics_is_null"] & df["has_ai_mcc"] & ~df["mcc_is_null"]].shape[0])
n_no_mcc      = int(df[df["naics_is_null"] & df["mcc_is_null"]].shape[0])
n_double_bad  = int(df[df["naics_is_catchall"] & df["mcc_is_catchall"]].shape[0])

# ── KPI row ────────────────────────────────────────────────────────────────────
section_header("📊 Cascade Summary Metrics")
c1, c2, c3, c4, c5, c6 = st.columns(6)
with c1: kpi("Total Businesses", f"{total:,}", color="#3b82f6")
with c2: kpi("✅ Healthy",      f"{n_healthy:,}",
             f"Valid NAICS + valid MCC ({100*n_healthy/total:.1f}%)", "#22c55e")
with c3: kpi("Null NAICS",      f"{n_null_naics:,}",
             f"{100*n_null_naics/total:.1f}% of portfolio", "#ef4444")
with c4: kpi("Catch-all NAICS", f"{n_catchall_naics:,}",
             f"561499 → MCC derived from garbage", "#f59e0b")
with c5: kpi("AI-Protected MCC", f"{n_ai_protected:,}",
             "null NAICS but AI gave good MCC anyway", "#8b5cf6")
with c6: kpi("🔴 Double Catch-all", f"{n_double_bad:,}",
             "561499 NAICS + 7399 MCC — both worthless", "#ef4444")

st.markdown("---")

# ── Funnel chart ───────────────────────────────────────────────────────────────
section_header("🌊 Cascade Funnel",
               "How bad NAICS flows through the pipeline and degrades MCC")

funnel_stages = [
    ("Total businesses in scope",      total),
    ("With null or catch-all NAICS",   n_bad_naics),
    ("Of those: MCC AI-protected",     n_ai_protected),
    ("Of those: No MCC at all",        n_no_mcc),
    ("Double catch-all (561499→7399)", n_double_bad),
]
funnel_df = pd.DataFrame(funnel_stages, columns=["Stage", "Count"])

fig_funnel = go.Figure(go.Funnel(
    y=funnel_df["Stage"],
    x=funnel_df["Count"],
    textinfo="value+percent initial",
    marker=dict(
        color=["#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#dc2626"],
    ),
    connector=dict(line=dict(color="#334155", width=2)),
    hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
))
fig_funnel.update_layout(
    height=380, margin=dict(l=0, r=0, t=10, b=0),
    paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
)
st.plotly_chart(fig_funnel, use_container_width=True, key="cascade_funnel")

st.markdown("---")

# ── Backfill tier breakdown ───────────────────────────────────────────────────
section_header("🎯 Backfill Tier Classification",
               "Businesses with 561499 NAICS classified by MCC remediation complexity")

tier1_biz  = df[df["naics_is_catchall"] & ~df["mcc_is_null"] & ~df["mcc_is_catchall"] & df["has_ai_mcc"]]
tier1b_biz = df[df["naics_is_catchall"] & ~df["mcc_is_null"] & ~df["mcc_is_catchall"] & ~df["has_ai_mcc"]]
tier2_biz  = df[df["naics_is_catchall"] & df["mcc_is_catchall"]]
tier3_biz  = df[df["naics_is_catchall"] & df["mcc_is_null"]]

tier_data = {
    "Tier 1 — NAICS fix only (AI-protected MCC)":      len(tier1_biz),
    "Tier 1b — NAICS fix only (specific MCC, no AI)":  len(tier1b_biz),
    "Tier 2 — NAICS + MCC fix (7399 catch-all)":       len(tier2_biz),
    "Tier 3 — NAICS + re-trigger AI (no MCC at all)":  len(tier3_biz),
}
tier_colors = ["#22c55e", "#84cc16", "#f59e0b", "#ef4444"]

tier_df = pd.DataFrame(list(tier_data.items()), columns=["Tier", "Businesses"])
tier_df["Color"] = tier_colors

col_bar, col_table = st.columns([3, 2])
with col_bar:
    fig_tier = go.Figure(go.Bar(
        x=tier_df["Businesses"],
        y=tier_df["Tier"],
        orientation="h",
        marker_color=tier_df["Color"].tolist(),
        text=tier_df["Businesses"].apply(lambda v: f"{v:,}"),
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_tier.update_layout(
        height=260, margin=dict(l=0, r=50, t=10, b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=False),
    )
    st.plotly_chart(fig_tier, use_container_width=True, key="tier_bar")

with col_table:
    tier_display = tier_df[["Tier","Businesses"]].copy()
    tier_display["Action"] = [
        "Fix NAICS only — MCC already correct via AI",
        "Fix NAICS only — investigate MCC source",
        "Fix both NAICS and MCC",
        "Fix NAICS + re-trigger AI enrichment",
    ]
    st.dataframe(tier_display, hide_index=True, use_container_width=True)

st.markdown("---")

# ── MCC distribution for null-NAICS businesses ─────────────────────────────────
section_header("📊 MCC Codes Assigned to Null-NAICS Businesses",
               "What MCCs did the AI assign when NAICS was null? Flag 5614 in red.")

null_naics_df = df[df["naics_is_null"]].copy()
if null_naics_df.empty:
    st.success("✅ No null-NAICS businesses in this set.")
else:
    mcc_dist = (
        null_naics_df.groupby("mcc_value")
                     .size()
                     .reset_index(name="count")
                     .sort_values("count", ascending=False)
                     .head(25)
    )
    mcc_dist["mcc_value"] = mcc_dist["mcc_value"].fillna("null")
    mcc_dist["color"] = mcc_dist["mcc_value"].apply(
        lambda v: "#ef4444" if v in KNOWN_INVALID_MCC
                  else "#f59e0b" if v in CATCH_ALL_MCC
                  else "#64748b" if v == "null"
                  else "#6366f1"
    )
    mcc_dist = mcc_dist.sort_values("count", ascending=True)

    fig_mcc_null = go.Figure(go.Bar(
        x=mcc_dist["count"],
        y=mcc_dist["mcc_value"],
        orientation="h",
        marker_color=mcc_dist["color"].tolist(),
        text=mcc_dist["count"].apply(lambda v: f"{v:,}"),
        textposition="outside",
        hovertemplate="<b>MCC %{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_mcc_null.update_layout(
        height=max(250, len(mcc_dist) * 28 + 40),
        margin=dict(l=0, r=50, t=10, b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=False, type="category"),
    )
    st.plotly_chart(fig_mcc_null, use_container_width=True, key="mcc_null_naics")
    st.caption("🔴 Known invalid (5614 AI bug)  🟡 Catch-all (7399)  ⚫ Null  🟣 Other")

st.markdown("---")

# ── Business-level cascade table ───────────────────────────────────────────────
section_header("📋 Per-Business Cascade Table")

with st.expander("Show full per-business cascade data"):
    cascade_display = df[[
        "business_id", "customer_id",
        "naics_value", "naics_platform",
        "mcc_value", "mcc_found_value", "mcc_from_naics_value", "mcc_platform",
    ]].copy()
    cascade_display["naics_status"] = df["naics_value"].apply(
        lambda v: validate_naics(v, naics_lookup)[0]
    )
    cascade_display.columns = [
        "Business ID", "Customer ID",
        "NAICS", "NAICS Platform",
        "MCC (final)", "MCC (AI)", "MCC (NAICS-derived)", "MCC Platform",
        "NAICS Status",
    ]
    st.dataframe(cascade_display, hide_index=True, use_container_width=True)
    st.download_button(
        "⬇️ Download cascade data",
        cascade_display.to_csv(index=False).encode(),
        "cascade_analysis.csv",
        "text/csv",
    )
