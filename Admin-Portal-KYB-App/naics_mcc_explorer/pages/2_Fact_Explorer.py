"""Page 2 — Fact Explorer.

Generic explorer for any fact type: shows winning platform + value,
alternatives parsed from the raw JSON, and distribution charts.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import json

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import (
    PLATFORM_MAP, platform_label, platform_color, FACT_NAMES,
)
from db.queries import load_fact_explorer, load_platform_winners

st.set_page_config(page_title="Fact Explorer", page_icon="🔭", layout="wide")
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

st.markdown("# 🔭 Fact Explorer")
st.markdown(
    "Explore the winning platform and alternate suppliers for any fact type. "
    "The `alternatives[]` array in the fact JSON shows every platform that supplied a value — "
    "even ones that lost the confidence race."
)
st.markdown("---")

# ── Fact selector ──────────────────────────────────────────────────────────────
col_fact, col_limit = st.columns([3, 1])
with col_fact:
    fact_name = st.selectbox(
        "Select fact name",
        options=FACT_NAMES + ["other (type below)"],
        index=0,
        key="fe_fact_name",
    )
    if fact_name == "other (type below)":
        fact_name = st.text_input("Custom fact name", value="naics_code", key="fe_custom")

with col_limit:
    row_limit = st.number_input("Row limit", min_value=50, max_value=5000,
                                 value=500, step=100, key="fe_limit")

# ── Load data ──────────────────────────────────────────────────────────────────
with st.spinner(f"Loading {fact_name} facts…"):
    df = load_fact_explorer(fact_name, f_from, f_to, f_cust, f_biz, limit=int(row_limit))

if df.empty:
    no_data(f"No `{fact_name}` facts found for the selected filters.")
    st.stop()

df["platform_name"] = df["winning_platform_id"].apply(platform_label)
df["confidence_f"]  = pd.to_numeric(df["winning_confidence"], errors="coerce").fillna(0.0)
total = len(df)

# ── KPI cards ──────────────────────────────────────────────────────────────────
section_header("📊 Summary Metrics")

n_null     = int((df["winning_value"].isna() | (df["winning_value"] == "")).sum())
n_p0       = int((df["winning_platform_id"] == "0").sum())
n_platforms = df["winning_platform_id"].nunique()
avg_conf   = df["confidence_f"].mean()

c1, c2, c3, c4, c5 = st.columns(5)
with c1: kpi("Total Records",       f"{total:,}",        color="#3b82f6")
with c2: kpi("Null Winners",        f"{n_null:,}",
             f"{100*n_null/total:.1f}% of records",      "#ef4444" if n_null > 0 else "#22c55e")
with c3: kpi("P0 Wins",             f"{n_p0:,}",
             f"{100*n_p0/total:.1f}% Ghost Assigner",    "#f97316" if n_p0 > 0 else "#22c55e")
with c4: kpi("Unique Platforms",    f"{n_platforms:,}",  color="#8b5cf6")
with c5: kpi("Avg Confidence",      f"{avg_conf:.3f}",   color="#6366f1")

st.markdown("---")

# ── Winning platform pie ───────────────────────────────────────────────────────
section_header("🥧 Winning Platform Distribution",
               "Which platforms are winning the confidence race for this fact?")

col_pie, col_alt = st.columns(2)

with col_pie:
    winner_dist = (
        df.groupby(["winning_platform_id", "platform_name"])
          .size()
          .reset_index(name="count")
          .sort_values("count", ascending=False)
    )
    winner_dist["color"] = winner_dist["winning_platform_id"].apply(platform_color)

    fig_pie = go.Figure(go.Pie(
        labels=winner_dist["platform_name"],
        values=winner_dist["count"],
        marker_colors=winner_dist["color"].tolist(),
        textinfo="label+percent",
        hovertemplate="<b>%{label}</b><br>Count: %{value:,}<br>Share: %{percent}<extra></extra>",
        hole=0.35,
    ))
    fig_pie.update_layout(
        height=340, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        showlegend=True,
        legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
    )
    st.plotly_chart(fig_pie, use_container_width=True, key="fe_pie")

# ── Alternatives extraction ───────────────────────────────────────────────────
with col_alt:
    st.markdown("**📦 Alternatives[] — Non-Winning Platform Appearances**")
    st.caption("Platforms that supplied a value but lost the confidence race")

    alt_counts: dict[str, int] = {}
    for raw in df["raw_json"].dropna():
        try:
            obj = json.loads(str(raw)) if isinstance(raw, str) else {}
            for alt in (obj.get("alternatives") or []):
                pid = str(alt.get("source", "unknown"))
                # alternatives can store source as int or dict
                if isinstance(alt.get("source"), dict):
                    pid = str(alt["source"].get("platformId", "unknown"))
                alt_counts[pid] = alt_counts.get(pid, 0) + 1
        except Exception:
            pass

    if alt_counts:
        alt_df = (
            pd.DataFrame(list(alt_counts.items()), columns=["platform_id", "appearances"])
              .sort_values("appearances", ascending=True)
        )
        alt_df["platform_name"] = alt_df["platform_id"].apply(platform_label)
        alt_df["color"]         = alt_df["platform_id"].apply(platform_color)

        fig_alt = go.Figure(go.Bar(
            x=alt_df["appearances"],
            y=alt_df["platform_name"],
            orientation="h",
            marker_color=alt_df["color"].tolist(),
            text=alt_df["appearances"],
            textposition="outside",
            hovertemplate="<b>%{y}</b><br>Appearances in alternatives: %{x:,}<extra></extra>",
        ))
        fig_alt.update_layout(
            height=300, margin=dict(l=0, r=30, t=10, b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=False, color="#334155"),
            yaxis=dict(showgrid=False, color="#94a3b8"),
        )
        st.plotly_chart(fig_alt, use_container_width=True, key="fe_alt")
    else:
        st.info("No alternatives[] data found in the raw JSON for this fact set. "
                "This may mean the fact is in old schema format (source.name instead of source.platformId).")

st.markdown("---")

# ── Data table ────────────────────────────────────────────────────────────────
section_header("📋 Fact Records Table",
               f"Showing up to {row_limit:,} records. Click a column header to sort.")

display = df[[
    "business_id", "customer_id", "platform_name",
    "winning_value", "confidence_f", "received_at",
]].copy()
display.columns = [
    "Business ID", "Customer ID", "Winning Platform",
    "Winning Value", "Confidence", "Received At",
]

# Highlight P0 rows
def _style_p0(row):
    is_p0 = df.loc[row.name, "winning_platform_id"] == "0" if row.name < len(df) else False
    bg = "background-color:#2d1a1a" if is_p0 else ""
    return [bg] * len(row)

st.dataframe(
    display,
    use_container_width=True,
    hide_index=True,
    column_config={
        "Confidence": st.column_config.NumberColumn(format="%.3f"),
        "Received At": st.column_config.DatetimeColumn(),
    },
)

# ── Raw JSON viewer ────────────────────────────────────────────────────────────
st.markdown("---")
with st.expander("🔬 Raw JSON Inspector — select a business to inspect full fact JSON"):
    bid_pick = st.selectbox(
        "Business ID",
        options=df["business_id"].tolist(),
        key="fe_bid_pick",
    )
    if bid_pick:
        row = df[df["business_id"] == bid_pick]
        if not row.empty:
            raw = row.iloc[0]["raw_json"]
            try:
                parsed = json.loads(str(raw)) if isinstance(raw, str) else raw
                st.json(parsed)
            except Exception:
                st.code(str(raw))

            # Parse and display alternatives neatly
            try:
                obj = json.loads(str(raw)) if isinstance(raw, str) else {}
                alts = obj.get("alternatives", [])
                if alts:
                    alt_rows = []
                    for a in alts:
                        src = a.get("source", {})
                        if isinstance(src, dict):
                            pid = str(src.get("platformId", "?"))
                            conf = src.get("confidence", a.get("confidence", "?"))
                        else:
                            pid = str(src)
                            conf = a.get("confidence", "?")
                        alt_rows.append({
                            "Platform": platform_label(pid),
                            "Value": a.get("value"),
                            "Confidence": conf,
                            "Is Winner": "❌ No",
                        })
                    if alt_rows:
                        st.markdown("**Non-winning alternatives:**")
                        st.dataframe(pd.DataFrame(alt_rows), hide_index=True)
            except Exception:
                pass
