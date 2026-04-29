"""NAICS/MCC Data Quality Explorer — Home Page.

Entry point for the Streamlit multi-page app. Displays platform-level overview
metrics and acts as the navigation hub. All global filters are set here via the
shared sidebar renderer and stored in st.session_state for use by all pages.
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import PLATFORM_MAP, platform_label, platform_color, CATCH_ALL_NAICS, CATCH_ALL_MCC
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.queries import load_overview, load_platform_winners, _onboarded_cte

st.set_page_config(
    page_title="NAICS/MCC Quality Explorer",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Dark theme override ────────────────────────────────────────────────────────
st.markdown("""
<style>
[data-testid="stAppViewContainer"] { background: #0f172a; }
[data-testid="stSidebar"] { background: #1e293b; }
.block-container { padding-top: 1.5rem; }
h1,h2,h3 { color: #f1f5f9; }
.stMarkdown p { color: #cbd5e1; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ────────────────────────────────────────────────────────────────────
filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust   = filters["customer_id"]
f_biz    = filters["business_id"]

# ── Page header ────────────────────────────────────────────────────────────────
st.markdown("# 🔬 NAICS / MCC Data Quality Explorer")
platform_legend_panel()
st.markdown(
    "Internal monitoring dashboard for NAICS and MCC fact quality across the Worth AI platform. "
    "Use the sidebar filters to scope by customer, business, and date range."
)
st.markdown("---")

# ── Overview KPIs ──────────────────────────────────────────────────────────────
section_header("📊 Platform Overview", f"Period: {f_from} → {f_to}")

with st.spinner("Loading overview metrics…"):
    ov_df = load_overview(f_from, f_to, f_cust)

if ov_df.empty or ov_df.iloc[0]["total_businesses"] == 0:
    no_data("No businesses found for the selected filters.")
else:
    row = ov_df.iloc[0]
    total  = int(row.get("total_businesses", 0))
    custs  = int(row.get("total_customers", 0))
    w_naics = int(row.get("with_naics", 0))
    w_mcc   = int(row.get("with_mcc", 0))
    p0_wins = int(row.get("naics_p0_wins", 0))
    catchall = int(row.get("naics_catchall", 0))

    naics_pct  = f"{100*w_naics/total:.1f}%" if total else "—"
    mcc_pct    = f"{100*w_mcc/total:.1f}%"   if total else "—"
    p0_pct     = f"{100*p0_wins/total:.1f}%"  if total else "—"
    ca_pct     = f"{100*catchall/total:.1f}%" if total else "—"

    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1: kpi("Total Businesses", f"{total:,}", color="#3b82f6")
    with c2: kpi("Customers", f"{custs:,}", color="#6366f1")
    with c3: kpi("NAICS Coverage", naics_pct, f"{w_naics:,} have a winning value", "#22c55e")
    with c4: kpi("MCC Coverage", mcc_pct,   f"{w_mcc:,} have a winning value", "#22c55e")
    with c5: kpi("P0 NAICS Wins", p0_pct,   f"{p0_wins:,} Ghost Assigner wins", "#ef4444")
    with c6: kpi("561499 Catch-all", ca_pct, f"{catchall:,} businesses", "#f59e0b")

st.markdown("")

# ── Platform winner mini-charts ────────────────────────────────────────────────
section_header("🏆 Platform Winner Snapshot", "Who is winning NAICS vs MCC confidence races?")

col_n, col_m = st.columns(2)

for fact, col, title in [
    ("naics_code", col_n, "NAICS Code — Platform Winners"),
    ("mcc_code",   col_m, "MCC Code — Platform Winners"),
]:
    with col:
        st.markdown(f"**{title}**")
        with st.spinner(f"Loading {fact} winners…"):
            pw_df = load_platform_winners(fact, f_from, f_to, f_cust, f_biz)

        if pw_df.empty:
            no_data(f"No {fact} facts found.")
        else:
            pw_df["platform_name"] = pw_df["platform_id"].apply(platform_label)
            pw_df["color"]         = pw_df["platform_id"].apply(platform_color)
            pw_df = pw_df.sort_values("business_count", ascending=True)

            fig = go.Figure(go.Bar(
                x=pw_df["business_count"],
                y=pw_df["platform_name"],
                orientation="h",
                marker_color=pw_df["color"].tolist(),
                text=pw_df["business_count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
            ))
            fig.update_layout(
                height=300,
                margin=dict(l=0, r=30, t=10, b=0),
                paper_bgcolor="#0f172a",
                plot_bgcolor="#0f172a",
                font_color="#cbd5e1",
                xaxis=dict(showgrid=False, color="#334155"),
                yaxis=dict(showgrid=False, color="#94a3b8"),
            )
            st.plotly_chart(fig, use_container_width=True, key=f"home_{fact}")

            # Flag P0 if present
            p0_row = pw_df[pw_df["platform_id"] == "0"]
            if not p0_row.empty:
                p0_n = int(p0_row["business_count"].iloc[0])
                analyst_note(
                    f"⚠️ Ghost Assigner (P0) winning for {p0_n:,} {fact} businesses",
                    "Self-reported onboarding data is beating real vendor data. "
                    "Root cause: <code>confidence: 1</code> hardcoded in <code>sources.ts:151</code>. "
                    "See Platform Winners page for full analysis.",
                    level="danger",
                )

sql_panel("Home overview metrics",
          f"""{_onboarded_cte(f_from, f_to, f_cust)}
SELECT COUNT(DISTINCT o.business_id) AS total_businesses,
       COUNT(DISTINCT o.customer_id) AS total_customers,
       COUNT(DISTINCT CASE WHEN f.name='naics_code' AND JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NOT NULL THEN f.business_id END) AS with_naics,
       COUNT(DISTINCT CASE WHEN f.name='mcc_code'   AND JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NOT NULL THEN f.business_id END) AS with_mcc,
       COUNT(DISTINCT CASE WHEN f.name='naics_code' AND COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'x')='0' THEN f.business_id END) AS naics_p0_wins,
       COUNT(DISTINCT CASE WHEN f.name='naics_code' AND JSON_EXTRACT_PATH_TEXT(f.value,'value')='561499' THEN f.business_id END) AS naics_catchall
FROM onboarded o
LEFT JOIN rds_warehouse_public.facts f ON f.business_id=o.business_id
    AND f.name IN ('naics_code','mcc_code') AND LENGTH(f.value)<60000""", key_suffix="home")

# ── Navigation cards ────────────────────────────────────────────────────────────
st.markdown("---")
section_header("🗺️ Navigate the Explorer")

nav_items = [
    ("🏆", "1 Platform Winners",   "Who wins the confidence race for NAICS and MCC?"),
    ("🔭", "2 Fact Explorer",      "Explore winning platform + alternatives for any fact type"),
    ("🔢", "3 NAICS Validity",     "Format check + lookup validation for all NAICS codes"),
    ("💳", "4 MCC Validity",       "MCC lookup validation, source breakdown, 5614 detection"),
    ("⛓️", "5 Cascade Analysis",   "How null NAICS cascades into degraded MCC quality"),
    ("🔍", "6 Business Drilldown", "Full fact picture for a single business ID"),
]

r1, r2, r3 = st.columns(3)
for i, (icon, title, desc) in enumerate(nav_items):
    col = [r1, r2, r3][i % 3]
    with col:
        html = (
            f"<div style='background:#1e293b;border:1px solid #334155;border-radius:10px;"
            f"padding:16px;margin:6px 0'>"
            f"<div style='font-size:1.6rem'>{icon}</div>"
            f"<div style='color:#f1f5f9;font-weight:600;margin:6px 0 4px'>{title}</div>"
            f"<div style='color:#64748b;font-size:.85rem'>{desc}</div>"
            f"</div>"
        )
        st.markdown(html, unsafe_allow_html=True)

st.markdown("")
st.caption(
    "📚 Data source: `rds_warehouse_public.facts` · `rds_cases_public.core_naics_code` · "
    "`rds_cases_public.core_mcc_code` · `rds_cases_public.rel_business_customer_monitoring`  \n"
    "All queries use only `rds_**` tables. Credentials: `readonly_all_access`."
)
