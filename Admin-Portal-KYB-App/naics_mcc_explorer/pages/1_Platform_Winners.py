"""Page 1 — Platform Winner Distribution.

Shows which platform wins the confidence race for NAICS and MCC facts,
side-by-side comparison, P0 (Ghost Assigner) highlighting, and a full
platform stats table.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import (
    PLATFORM_MAP, platform_label, platform_color, pid_type,
    PLATFORM_TYPE_COLORS,
)
from db.queries import load_platform_winners, load_platform_winner_values

st.set_page_config(page_title="Platform Winners", page_icon="🏆", layout="wide")
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

st.markdown("# 🏆 Platform Winner Distribution")
st.markdown(
    "Which platform wins the confidence arbitration race for NAICS and MCC facts? "
    "**P0 = Applicant Entry (Ghost Assigner)** — it always writes `confidence: 1` before real vendors respond, "
    "causing it to beat ZoomInfo, SERP, and Equifax whenever businesses submit null or wrong values on their onboarding form."
)
st.markdown("---")

FACTS_TO_SHOW = ["naics_code", "mcc_code", "mcc_code_found", "mcc_code_from_naics"]

# ── Load all four facts ────────────────────────────────────────────────────────
all_winners: dict[str, pd.DataFrame] = {}
for fn in FACTS_TO_SHOW:
    with st.spinner(f"Loading {fn}…"):
        df = load_platform_winners(fn, f_from, f_to, f_cust, f_biz)
    if not df.empty:
        df["platform_name"] = df["platform_id"].apply(platform_label)
        df["color"]         = df["platform_id"].apply(platform_color)
        df["type"]          = df["platform_id"].apply(pid_type)
        df["avg_confidence"] = df["avg_confidence"].apply(
            lambda v: round(float(v), 3) if v is not None else 0.0
        )
        total = df["business_count"].sum()
        df["pct_of_total"] = df["business_count"].apply(
            lambda v: f"{100*v/total:.1f}%" if total else "—"
        )
    all_winners[fn] = df

# ── NAICS vs MCC side-by-side bar charts ──────────────────────────────────────
section_header("📊 NAICS vs MCC — Winner Comparison",
               "Side-by-side: who wins NAICS vs who wins MCC for the same business set?")

for fact_pair in [("naics_code", "mcc_code"), ("mcc_code_found", "mcc_code_from_naics")]:
    col_a, col_b = st.columns(2)
    for fact, col in zip(fact_pair, [col_a, col_b]):
        with col:
            st.markdown(f"**{fact}**")
            df = all_winners.get(fact, pd.DataFrame())
            if df.empty:
                no_data(f"No data for `{fact}`")
                continue

            df_sorted = df.sort_values("business_count", ascending=True)
            fig = go.Figure(go.Bar(
                x=df_sorted["business_count"],
                y=df_sorted["platform_name"],
                orientation="h",
                marker_color=df_sorted["color"].tolist(),
                text=df_sorted.apply(
                    lambda r: f"{r['business_count']:,} ({r['pct_of_total']})", axis=1
                ),
                textposition="outside",
                hovertemplate=(
                    "<b>%{y}</b><br>"
                    "Businesses: %{x:,}<br>"
                    "<extra></extra>"
                ),
            ))
            fig.update_layout(
                height=max(220, len(df_sorted) * 36 + 40),
                margin=dict(l=0, r=60, t=10, b=0),
                paper_bgcolor="#0f172a",
                plot_bgcolor="#0f172a",
                font_color="#cbd5e1",
                xaxis=dict(showgrid=True, gridcolor="#1e293b", color="#334155"),
                yaxis=dict(showgrid=False, color="#94a3b8"),
            )
            st.plotly_chart(fig, use_container_width=True, key=f"pw_{fact}")

st.markdown("---")

# ── P0 Ghost Assigner Deep Dive ────────────────────────────────────────────────
section_header("🚨 Ghost Assigner (P0) Analysis",
               "platformId = '0' = Applicant Entry — self-reported onboarding data with hardcoded confidence: 1")

p0_rows = []
for fn in FACTS_TO_SHOW:
    df = all_winners.get(fn, pd.DataFrame())
    if df.empty:
        continue
    p0 = df[df["platform_id"] == "0"]
    if not p0.empty:
        r = p0.iloc[0]
        p0_rows.append({
            "Fact": fn,
            "P0 Wins": int(r["business_count"]),
            "% of Total": r["pct_of_total"],
            "Null Value Count": int(r.get("null_value_count", 0)),
            "Avg Confidence": r["avg_confidence"],
        })

if p0_rows:
    p0_summary = pd.DataFrame(p0_rows)
    total_p0 = p0_summary["P0 Wins"].sum()

    st.error(
        f"**⚠️ Ghost Assigner (P0) is winning for {total_p0:,} fact records across all monitored fact types.** "
        "This is caused by `confidence: 1` being hardcoded for `businessDetails` in "
        "`integration-service/lib/facts/sources.ts:151`. Fix: lower to `confidence: 0.1`.",
        icon="🚨",
    )

    c1, c2, c3 = st.columns(3)
    naics_p0 = next((r for r in p0_rows if r["Fact"] == "naics_code"), {})
    mcc_p0   = next((r for r in p0_rows if r["Fact"] == "mcc_code"), {})
    with c1: kpi("P0 NAICS Wins",  str(naics_p0.get("P0 Wins", "—")),
                 naics_p0.get("% of Total",""), "#ef4444")
    with c2: kpi("P0 MCC Wins",    str(mcc_p0.get("P0 Wins", "—")),
                 mcc_p0.get("% of Total",""), "#ef4444")
    with c3:
        total_null = sum(r["Null Value Count"] for r in p0_rows)
        kpi("P0 Null-Value Wins", f"{total_null:,}",
            "P0 wrote null + confidence:1 → real data lost", "#f97316")

    st.markdown("")
    st.dataframe(
        p0_summary,
        use_container_width=True,
        hide_index=True,
        column_config={
            "P0 Wins":         st.column_config.NumberColumn(format="%d"),
            "Null Value Count": st.column_config.NumberColumn(format="%d"),
            "Avg Confidence":  st.column_config.NumberColumn(format="%.3f"),
        },
    )

    st.markdown("**Root cause explainer:**")
    st.code(
        "// integration-service/lib/facts/sources.ts:151\n"
        "businessDetails: {\n"
        "    confidence: 1,      // ← THE BUG: always claims 100% certainty\n"
        "    weight: 10,\n"
        "    platformId: 0,\n"
        "    ...\n"
        "}\n\n"
        "// Fix: confidence: 1 → confidence: 0.1\n"
        "// Why: WEIGHT_THRESHOLD=0.05 in rules.ts means weight is only used as\n"
        "// tiebreaker when two confidences are within 0.05 of each other.\n"
        "// P0 at 1.0 vs ZoomInfo at ~0.8 = gap of 0.2 → weight never applied.",
        language="typescript",
    )
else:
    st.success("✅ No P0 wins detected for the selected filters.")

st.markdown("---")

# ── Full stats table per fact ──────────────────────────────────────────────────
section_header("📋 Full Platform Stats Table",
               "All platforms by fact type — count, share, and average confidence")

fact_tab = st.tabs([f"`{fn}`" for fn in FACTS_TO_SHOW])
for tab, fn in zip(fact_tab, FACTS_TO_SHOW):
    with tab:
        df = all_winners.get(fn, pd.DataFrame())
        if df.empty:
            no_data(f"No data for `{fn}`")
            continue

        display = df[["platform_name", "platform_id", "business_count", "pct_of_total",
                       "avg_confidence", "null_value_count", "type"]].copy()
        display.columns = ["Platform", "ID", "Business Count", "% of Total",
                           "Avg Confidence", "Null Wins", "Type"]
        display = display.sort_values("Business Count", ascending=False)

        st.dataframe(
            display,
            use_container_width=True,
            hide_index=True,
            column_config={
                "Business Count": st.column_config.NumberColumn(format="%d"),
                "Null Wins":      st.column_config.NumberColumn(format="%d"),
                "Avg Confidence": st.column_config.NumberColumn(format="%.3f"),
            },
        )

        # Color legend
        st.caption("🟢 Vendor  🟣 AI Enrichment  🔴 Applicant Entry  ⚫ Unknown")

        # Top winning values
        with st.expander("📊 Top winning values for this fact"):
            with st.spinner("Loading value distribution…"):
                vdf = load_platform_winner_values(fn, f_from, f_to, f_cust, f_biz)
            if vdf.empty:
                no_data()
            else:
                vdf["platform_name"] = vdf["platform_id"].apply(platform_label)
                vdf = vdf.head(30)
                fig2 = px.bar(
                    vdf,
                    x="fact_value",
                    y="business_count",
                    color="platform_name",
                    color_discrete_map={platform_label(pid): platform_color(pid)
                                        for pid in vdf["platform_id"].unique()},
                    labels={"fact_value": "Code", "business_count": "Businesses",
                            "platform_name": "Winning Platform"},
                    title=f"Top {len(vdf)} winning values — {fn}",
                )
                fig2.update_layout(
                    paper_bgcolor="#0f172a", plot_bgcolor="#0f172a",
                    font_color="#cbd5e1", height=350,
                    xaxis=dict(type="category"),
                )
                st.plotly_chart(fig2, use_container_width=True, key=f"vals_{fn}")
