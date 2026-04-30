"""Page 2 — Fact Explorer with alternatives and SQL runner."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import json

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, FACT_NAMES
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.queries import load_fact_explorer, load_platform_winners, _onboarded_cte

st.set_page_config(page_title="Fact Explorer", page_icon="🔭", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]
f_biz  = filters["business_id"]

st.markdown("# 🔭 Data Explorer")
st.markdown(
    "Explore which data source provided the winning value for any data type — "
    "plus every other source that also submitted a value, even those that didn't win. "
    "This is the complete picture of what each data source returned and why one won over the others."
)
platform_legend_panel()
st.markdown("---")

col_fact, col_limit = st.columns([3, 1])
with col_fact:
    fact_name = st.selectbox("Select fact name", FACT_NAMES + ["other (type below)"], index=0, key="fe_fact")
    if fact_name == "other (type below)":
        fact_name = st.text_input("Custom fact name", value="naics_code", key="fe_custom")
with col_limit:
    row_limit = st.number_input("Row limit", min_value=50, max_value=5000, value=500, step=100, key="fe_lim")

with st.spinner(f"Loading {fact_name} facts…"):
    df = load_fact_explorer(fact_name, f_from, f_to, f_cust, f_biz, limit=int(row_limit))

if df.empty:
    no_data(f"No `{fact_name}` facts found.")
    st.stop()

# Resolve legacy schema platform names
df["eff_platform_id"] = df.apply(
    lambda r: r["winning_platform_id"] if str(r["winning_platform_id"]) not in ("unknown","","None")
              else (r.get("legacy_source_name") or "unknown"),
    axis=1
).astype(str)
df["platform_name"] = df["eff_platform_id"].apply(platform_label)
df["confidence_f"]  = pd.to_numeric(df["winning_confidence"], errors="coerce").fillna(0.0)
total = len(df)

# ── KPIs ──────────────────────────────────────────────────────────────────────
section_header("📊 Summary Metrics")
n_null = int((df["winning_value"].isna() | (df["winning_value"].astype(str).str.strip() == "")).sum())
n_p0   = int((df["eff_platform_id"] == "0").sum())
n_legacy = int((df["eff_platform_id"].str.contains("AINaics|zoominfo|serp|equifax", case=False, na=False)).sum())
avg_conf = df["confidence_f"].mean()

c1,c2,c3,c4,c5 = st.columns(5)
with c1: kpi("Total Records", f"{total:,}", color="#3b82f6")
with c2: kpi("Null Winners", f"{n_null:,}", f"{100*n_null/total:.1f}%", "#ef4444" if n_null>0 else "#22c55e")
with c3: kpi("Form Submission Wins", f"{n_p0:,}", f"{100*n_p0/total:.1f}% — business's own form overriding vendors", "#f97316" if n_p0>0 else "#22c55e")
with c4: kpi("Legacy Schema", f"{n_legacy:,}", "old source.name format", "#94a3b8")
with c5: kpi("Avg Confidence", f"{avg_conf:.3f}", "", "#6366f1")

analyst_note(
    "What these metrics mean",
    "<strong>Null Winners</strong>: A platform won the race but its value is null — the worst outcome. "
    "Downstream processes receive no classification for that business. Usually caused by the business submitting a blank form field, which was recorded with the maximum score and overrode real data from vendors. "
    "before vendors return.<br><br>"
    "<strong>Legacy Schema</strong>: These records use the old JSON format where source is stored as "
    "<code>{\"name\": \"AINaicsEnrichment\"}</code> instead of <code>{\"platformId\": 31}</code>. "
    "They show up as 'Legacy Schema' in platform charts but the data is real.",
    level="info",
    bullets=[
        "Null Winners % above 5% = significant pipeline problem",
        "Form submissions winning above 20% = the scoring configuration issue is significantly reducing data quality",
        "Avg Confidence well below 0.8 = AI or low-confidence sources dominating",
    ],
)
st.markdown("---")

# ── Platform pie + alternatives bar ────────────────────────────────────────────
section_header("🥧 Winning Platform Distribution + Alternatives")

col_pie, col_alt = st.columns(2)
with col_pie:
    st.markdown("**Who wins the race?** (winning platform distribution)")
    wd = df.groupby(["eff_platform_id","platform_name"]).size().reset_index(name="count").sort_values("count",ascending=False)
    wd["color"] = wd["eff_platform_id"].apply(platform_color)
    fig_pie = go.Figure(go.Pie(
        labels=wd["platform_name"], values=wd["count"],
        marker_colors=wd["color"].tolist(), textinfo="label+percent",
        hovertemplate="<b>%{label}</b><br>Count: %{value:,}<extra></extra>", hole=0.35,
    ))
    fig_pie.update_layout(height=320, margin=dict(l=0,r=0,t=10,b=0),
                          paper_bgcolor="#0f172a", font_color="#cbd5e1", showlegend=True,
                          legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")))
    st.plotly_chart(fig_pie, use_container_width=True, key="fe_pie")

with col_alt:
    st.markdown("**Which sources submitted a value but didn't win?**")
    alt_counts: dict[str, int] = {}
    for raw in df["raw_json"].dropna():
        for a in parse_alternatives(raw):
            pid = a["alt_platform_id"]
            alt_counts[pid] = alt_counts.get(pid, 0) + 1

    if alt_counts:
        alt_df = pd.DataFrame(list(alt_counts.items()), columns=["pid","appearances"])
        alt_df["platform_name"] = alt_df["pid"].apply(platform_label)
        alt_df["color"]         = alt_df["pid"].apply(platform_color)
        alt_df = alt_df.sort_values("appearances", ascending=True)
        fig_alt = go.Figure(go.Bar(
            x=alt_df["appearances"], y=alt_df["platform_name"],
            orientation="h", marker_color=alt_df["color"].tolist(),
            text=alt_df["appearances"], textposition="outside",
            hovertemplate="<b>%{y}</b><br>Appearances in alternatives: %{x:,}<extra></extra>",
        ))
        fig_alt.update_layout(height=300, margin=dict(l=0,r=40,t=10,b=0),
                               paper_bgcolor="#0f172a", plot_bgcolor="#0f172a",
                               font_color="#cbd5e1",
                               xaxis=dict(showgrid=False), yaxis=dict(showgrid=False))
        st.plotly_chart(fig_alt, use_container_width=True, key="fe_alt")
    else:
        st.info("No other sources found for this selection — either only one source returned data, or the records use an older data format.")

analyst_note(
    "Winning vs Alternatives — what the gap reveals",
    "A platform appearing many times in <strong>alternatives</strong> but few times as <strong>winner</strong> "
    "means it is consistently submitting values but losing to another source — often the business's own form submission. "
    "For example, if ZoomInfo appears in 3,000 non-winner lists but only wins 200 times, "
    "it means ZoomInfo returned valid data for 3,000 businesses but was overridden 2,800 times.",
    level="warning",
    bullets=[
        "ZoomInfo in many non-winner lists but few wins → the business's own submission is overriding ZoomInfo's real data",
        "AI in both winners and non-winners → AI is the fallback when vendors fail, but sometimes also loses to the form submission",
        "No other sources at all → only one source returned data, or an older data format is being used",
    ],
)
st.markdown("---")

# ── Records table with alternatives expanded ───────────────────────────────────
section_header("📋 Fact Records — Winner + Alternatives")
st.caption("Select a Business ID below to see the full list of values submitted by each data source.")

display_cols = {
    "business_id": "Business ID",
    "customer_id":  "Customer ID",
    "platform_name":"Winning Platform",
    "winning_value":"Winning Value",
    "confidence_f": "Confidence",
    "winner_updated_at":"Winner Updated At",
    "received_at":  "Received At",
}
display = df[[c for c in display_cols if c in df.columns]].copy()
display = display.rename(columns=display_cols)

# Show condensed table
st.dataframe(display, use_container_width=True, hide_index=True,
             column_config={"Confidence": st.column_config.NumberColumn(format="%.3f"),
                            "Received At": st.column_config.DatetimeColumn()})

# Inline alternatives expander for selected business
st.markdown("**🔍 Inspect alternatives for a specific business:**")
bid_pick = st.selectbox("Business ID", ["— select —"] + df["business_id"].tolist(), key="fe_bid_pick")
if bid_pick and bid_pick != "— select —":
    row = df[df["business_id"] == bid_pick]
    if not row.empty:
        r = row.iloc[0]
        c1, c2, c3 = st.columns(3)
        with c1: kpi("Winning Platform", r["platform_name"], color=platform_color(r["eff_platform_id"]))
        with c2: kpi("Winning Value", str(r["winning_value"]) if r["winning_value"] else "null",
                     color="#22c55e" if r["winning_value"] else "#ef4444")
        with c3: kpi("Confidence", f"{r['confidence_f']:.3f}", color="#6366f1")

        alts = parse_alternatives(r.get("raw_json",""))
        if alts:
            st.markdown(f"**Alternatives ({len(alts)} non-winning platforms):**")
            alt_disp = pd.DataFrame(alts)
            alt_disp.columns = ["Platform","Platform ID","Value","Confidence","Updated At"]
            st.dataframe(alt_disp, hide_index=True, use_container_width=True)
        else:
            st.info("No other sources found — either only one source submitted data, or this record uses an older format.")

        with st.expander("🔬 Raw JSON"):
            try:
                st.json(json.loads(str(r.get("raw_json","{}"))))
            except Exception:
                st.code(str(r.get("raw_json","")))

_fe_sql = f"""
{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT
    f.business_id,
    o.customer_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value')                                AS winning_value,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS winning_platform_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','name')                         AS legacy_source_name,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0')     AS winning_confidence,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt')                    AS winner_updated_at,
    f.received_at
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = '{fact_name}'
  AND LENGTH(f.value) < 60000
ORDER BY f.received_at DESC
LIMIT 500"""
sql_panel("Fact Explorer", _fe_sql, key_suffix="fe")
