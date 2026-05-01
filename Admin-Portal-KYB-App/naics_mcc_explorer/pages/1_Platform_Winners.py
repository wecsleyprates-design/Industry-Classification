"""Page 1 — Platform Winner Distribution with drilldown tables."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import json

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import (
    PLATFORM_MAP, platform_label, platform_color, pid_type,
    DEPENDENT_FACT_NAMES, CLASSIFICATION_FACTS,
)
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner
from db.queries import load_platform_winner_values, load_fact_drilldown, _onboarded_cte

st.set_page_config(page_title="Platform Winners", page_icon="🏆", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust    = filters["customer_id"]
f_client  = filters.get("client_name")  # human-readable for cache
f_biz     = filters["business_id"]

st.markdown("# 🏆 Data Source Winner Distribution")
data_source_banner()
st.markdown(
    "When multiple data sources provide an industry code for the same business, the system picks the one with the highest score. "
    "This page shows which source is winning that comparison. "
    "Trusted external providers (ZoomInfo, Equifax, SERP) should be winning for most businesses. "
    "**When the business's own submission wins, it means no external provider's result was used — "
    "which is a data quality risk.** The 'Automatically computed' category winning for payment categories is normal and expected."
)
platform_legend_panel()
st.markdown("---")

FACTS_TO_SHOW = ["naics_code", "mcc_code", "mcc_code_found", "mcc_code_from_naics"]


def _make_bar(df: pd.DataFrame, title: str, chart_key: str) -> None:
    """Horizontal bar chart — labels in a separate column so they never overlap bars.

    Strategy: render the bar chart WITHOUT any text on the bars, then show the
    label (count + pct) in a plain st.dataframe column next to it. This is the
    only reliable cross-platform solution — Plotly annotation positioning depends
    on the rendered pixel width which varies by screen/font.
    """
    df = df.sort_values("business_count", ascending=False).copy()

    max_val = int(df["business_count"].max()) if not df.empty else 1

    fig = go.Figure(go.Bar(
        x=df["business_count"],
        y=df["platform_name"],
        orientation="h",
        marker_color=df["color"].tolist(),
        hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
    ))
    fig.update_layout(
        title=dict(text=title, font=dict(color="#cbd5e1", size=13)),
        height=max(240, len(df) * 44 + 60),
        margin=dict(l=0, r=20, t=40, b=20),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b", color="#334155",
                   range=[0, max_val * 1.05]),
        yaxis=dict(showgrid=False, color="#94a3b8"),
    )
    st.plotly_chart(fig, use_container_width=True, key=chart_key)

    # Companion label table — shows count + % clearly, no overlap possible
    label_df = df[["platform_name", "business_count", "pct_of_total", "avg_confidence"]].copy()
    label_df.columns = ["Platform", "Count", "% of Total", "Avg Confidence"]
    st.dataframe(
        label_df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Count":          st.column_config.NumberColumn(format="%d"),
            "Avg Confidence": st.column_config.NumberColumn(format="%.3f"),
        },
    )


# ── Load all four facts ────────────────────────────────────────────────────────
all_winners: dict[str, pd.DataFrame] = {}
for fn in FACTS_TO_SHOW:
    with st.spinner(f"Loading {fn}…"):
        df = get_data('platform_winners', fact_name=fn, date_from=f_from, date_to=f_to, customer_id=f_cust, client_name=f_client, business_id=f_biz)
    if df is not None and not df.empty:
        df["platform_id"] = df.apply(
            lambda r: r["platform_id"] if str(r["platform_id"]) not in ("unknown","","None")
                      else (r.get("legacy_source_name") or "unknown"), axis=1
        ).astype(str)
        df["platform_name"] = df["platform_id"].apply(platform_label)
        df["color"]         = df["platform_id"].apply(platform_color)
        df["type"]          = df["platform_id"].apply(pid_type)
        df["avg_confidence"] = pd.to_numeric(df["avg_confidence"], errors="coerce").fillna(0.0).round(3)
        total = df["business_count"].sum()
        df["pct_of_total"]   = df["business_count"].apply(
            lambda v: f"{100*v/total:.1f}%" if total else "—")
    all_winners[fn] = df if df is not None else pd.DataFrame()

# ── NAICS vs MCC side-by-side comparison ──────────────────────────────────────
section_header("📊 NAICS vs MCC — Side-by-Side Winner Comparison",
               "Dramatic differences between NAICS and MCC winners indicate arbitration or derivation problems.")

for pair in [("naics_code","mcc_code"), ("mcc_code_found","mcc_code_from_naics")]:
    col_a, col_b = st.columns(2)
    for fact, col in zip(pair, [col_a, col_b]):
        with col:
            df = all_winners.get(fact, pd.DataFrame())
            if df.empty:
                no_data(f"No data for `{fact}`")
            else:
                _make_bar(df, f"`{fact}`", f"pw_{fact}")

analyst_note(
    "How to read these charts",
    "Each bar = number of businesses where that source had the highest score and became the winner. "
    "For industry codes (NAICS), <strong>ZoomInfo, Equifax, or SERP</strong> should be winning most of the time. "
    "For payment categories (MCC), <strong>Automatically Computed</strong> winning is normal — payment categories are always derived, never submitted directly by a vendor. "
    "⚠️ Red flag: <strong>Business's own submission</strong> in the top 2 for industry codes means the onboarding form data is overriding real vendor data.",
    level="info",
    bullets=[
        "🟢 Green = external data provider (ZoomInfo, SERP, Equifax) — these should dominate for industry codes",
        "🟣 Orange/Purple = AI classification — acceptable backup when data providers don't return a result",
        "🔴 Red = business's own submission — should not be winning when real data providers are available",
        "⚫ Grey = automatically computed (derived from another code) — normal and expected for payment categories",
        "🟡 Unknown = records in an older data format where the source name is stored differently",
    ],
)
sql_panel("Platform Winner Distribution", f"""\
{_onboarded_cte(f_from, f_to, f_cust, f_biz)}\
SELECT
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS platform_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','name')                           AS legacy_source_name,
    COUNT(DISTINCT f.business_id)                                             AS business_count,
    AVG(CAST(COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS FLOAT)) AS avg_confidence,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL THEN 1 ELSE 0 END) AS null_value_count
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = 'naics_code'   -- change to mcc_code, mcc_code_found, mcc_code_from_naics
  AND LENGTH(f.value) < 60000
GROUP BY 1, 2  ORDER BY 3 DESC""", key_suffix="pw")
st.markdown("---")

# ── P0 Ghost Assigner ─────────────────────────────────────────────────────────
section_header("🚨 Ghost Assigner (P0) Analysis")
p0_rows = []
for fn in FACTS_TO_SHOW:
    df = all_winners.get(fn, pd.DataFrame())
    if df.empty: continue
    p0 = df[df["platform_id"]=="0"]
    if not p0.empty:
        r = p0.iloc[0]
        p0_rows.append({"Fact":fn,"P0 Wins":int(r["business_count"]),
                        "% of Total":r["pct_of_total"],
                        "Null Wins":int(r.get("null_value_count",0)),
                        "Avg Confidence":r["avg_confidence"]})
if p0_rows:
    total_p0 = sum(r["P0 Wins"] for r in p0_rows)
    st.error(f"⚠️ The business's own submission is winning for {total_p0:,} records across monitored data types — real vendor data is being overridden.", icon="🚨")
    c1,c2,c3 = st.columns(3)
    naics_p0 = next((r for r in p0_rows if r["Fact"]=="naics_code"),{})
    mcc_p0   = next((r for r in p0_rows if r["Fact"]=="mcc_code"),{})
    with c1: kpi("P0 NAICS Wins", str(naics_p0.get("P0 Wins","—")), naics_p0.get("% of Total",""), "#ef4444")
    with c2: kpi("P0 MCC Wins",   str(mcc_p0.get("P0 Wins","—")),   mcc_p0.get("% of Total",""), "#ef4444")
    with c3: kpi("P0 Null-Value Wins", f"{sum(r['Null Wins'] for r in p0_rows):,}",
                 "P0 wrote null + confidence:1", "#f97316")
    st.dataframe(pd.DataFrame(p0_rows), use_container_width=True, hide_index=True,
                 column_config={"P0 Wins": st.column_config.NumberColumn(format="%d"),
                                "Null Wins": st.column_config.NumberColumn(format="%d"),
                                "Avg Confidence": st.column_config.NumberColumn(format="%.3f")})
    analyst_note("Why this happens",
        "The system assigns a score of 1.0 (the maximum) to whatever the business types on the onboarding form. "
        "External providers like ZoomInfo typically score 0.8 or lower. "
        "Since the onboarding form always has the highest score, it wins — "
        "even when its value is blank, and even when ZoomInfo returned a perfectly valid industry code. "
        "This is a configuration issue: the form submission score is set too high.",
        level="danger",
        action="Engineering fix: lower the score assigned to form submissions from 1.0 to 0.1. This single change will allow ZoomInfo and SERP to win for thousands of businesses on the next data refresh.")
else:
    st.success("✅ No P0 wins detected for the selected filters.")
st.markdown("---")

# ── Full stats table + winning values + drilldown ──────────────────────────────
section_header("📋 Full Platform Stats, Top Values & Business Drilldown")
tabs = st.tabs([f"`{fn}`" for fn in FACTS_TO_SHOW])

for tab, fn in zip(tabs, FACTS_TO_SHOW):
    with tab:
        df = all_winners.get(fn, pd.DataFrame())
        if df.empty:
            no_data(f"No data for `{fn}`")
            continue

        # ── Winner stats table ──────────────────────────────────────────────
        st.markdown(f"**Platform winner stats for `{fn}`**")
        is_dependent = fn in DEPENDENT_FACT_NAMES
        if is_dependent:
            analyst_note(
                f"`{fn}` is automatically computed",
                f"<code>{fn}</code> is always calculated by the system — no external data provider ever directly supplies this value. "
                f"<strong>Seeing 'Automatically Computed' as the winner here is correct and expected.</strong> "
                f"Its value depends on the industry code (NAICS): if the industry code is wrong, this payment category will also be wrong.",
                level="info",
            )
        display = df[["platform_name","platform_id","business_count","pct_of_total",
                       "avg_confidence","null_value_count","type"]].copy()
        display.columns = ["Platform","ID","Business Count","% of Total",
                           "Avg Confidence","Null Wins","Type"]
        st.dataframe(display.sort_values("Business Count", ascending=False),
                     use_container_width=True, hide_index=True,
                     column_config={"Business Count": st.column_config.NumberColumn(format="%d"),
                                    "Null Wins": st.column_config.NumberColumn(format="%d"),
                                    "Avg Confidence": st.column_config.NumberColumn(format="%.3f")})
        st.caption("🟢 External data provider  🟣 AI classification  🔴 Business's own submission  ⚫ Automatically computed  ⚫ Unknown")

        analyst_note(
            f"Interpreting the `{fn}` winner table",
            "<strong>Avg Score</strong>: average score for that source's wins. "
            "The business's own submission always shows 1.0 — that is the configuration issue causing the override problem. "
            "ZoomInfo typically scores 0.8–1.0. AI classification scores ~0.15. "
            "Automatically Computed shows 0.0 — this is normal because computed values don't have a score. "
            "<strong>Blank Wins</strong>: this source won the comparison but provided no value — the worst possible outcome.",
            level="info",
        )
        st.markdown("---")

        # ── Top winning values bar chart ────────────────────────────────────
        with st.expander(f"📊 Top 30 winning values for `{fn}`", expanded=True):
            with st.spinner("Loading value distribution…"):
                vdf = load_platform_winner_values(fn, f_from, f_to, f_cust, f_biz)
            if vdf is not None and not vdf.empty:
                vdf["platform_name"] = vdf["platform_id"].apply(platform_label)
                vdf = vdf.head(30)
                fig2 = px.bar(
                    vdf, x="fact_value", y="business_count",
                    color="platform_name",
                    color_discrete_map={platform_label(p): platform_color(p)
                                        for p in vdf["platform_id"].unique()},
                    labels={"fact_value":"Code","business_count":"Businesses",
                            "platform_name":"Platform"},
                    title=f"Top winning values — {fn}",
                )
                fig2.update_layout(
                    height=340, margin=dict(l=0, r=20, t=40, b=60),
                    paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                    xaxis=dict(type="category", tickangle=-45),
                    legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
                )
                st.plotly_chart(fig2, use_container_width=True, key=f"vals_{fn}")
                st.caption(
                    "X-axis = code value. Y-axis = number of businesses where that code is the winning value. "
                    "Color = which platform produced that winning value."
                )
                if fn == "naics_code":
                    analyst_note(
                        "Reading the NAICS distribution",
                        "A healthy distribution shows a spread of specific 6-digit codes. "
                        "Red flags: a single code (especially <code>561499</code> — catch-all) "
                        "dominating, or most bars coloured red (P0 winning). "
                        "Short codes (5 digits or fewer) indicate the data type bug "
                        "(P0 writes integers without zero-padding).",
                        level="warning" if any(str(v) == "561499" for v in vdf["fact_value"]) else "info",
                    )
                elif fn in ("mcc_code", "mcc_code_from_naics"):
                    analyst_note(
                        "Reading the MCC distribution",
                        "<code>5614</code> at the top is the AI prompt bug fallback — an invalid MCC. "
                        "<code>7399</code> is the catch-all 'Business Services NEC'. "
                        "Both in the top 5 is a major quality signal. "
                        "A healthy MCC distribution has domain-specific codes "
                        "(e.g. 8011=Physicians, 5812=Restaurants, 7538=Auto Service).",
                        level="danger" if any(str(v) in ("5614","7399") for v in vdf["fact_value"][:5]) else "info",
                    )
            else:
                no_data()
        st.markdown("---")

        # ── Business drilldown table ────────────────────────────────────────
        with st.expander(f"🔍 Business Drilldown — NAICS + all MCC codes for `{fn}` winners"):
            st.caption(
                "Shows winning value, alternatives[], all MCC variants (final/AI/NAICS-derived) "
                "and timestamps for each business. Use the Platform filter to focus on a specific platform."
            )
            dd_col1, dd_col2 = st.columns([2, 1])
            with dd_col2:
                limit_dd = st.number_input("Row limit", 50, 2000, 300, 50, key=f"dd_lim_{fn}")
            with st.spinner("Loading drilldown data…"):
                dd = load_fact_drilldown(fn, f_from, f_to, f_cust, f_biz, int(limit_dd))

            if dd is None or dd.empty:
                no_data()
            else:
                dd["winning_platform"] = dd["winning_platform_id"].apply(platform_label)

                # ── Platform filter ──────────────────────────────────────────
                with dd_col1:
                    platform_options = ["All Platforms"] + sorted(dd["winning_platform"].unique().tolist())
                    selected_platform = st.selectbox(
                        "Filter by Platform", platform_options, key=f"dd_pid_{fn}"
                    )
                if selected_platform != "All Platforms":
                    dd = dd[dd["winning_platform"] == selected_platform]
                if dd.empty:
                    no_data(f"No records for platform '{selected_platform}'.")
                    continue

                # Parse alternatives
                def _alt_val_str(raw):
                    alts = parse_alternatives(raw)
                    return " | ".join(
                        f"{a['alt_value']} ({a['alt_platform']})" for a in alts
                    ) if alts else ""

                dd["alternatives"] = dd["raw_json"].apply(_alt_val_str)

                display_dd = dd[[
                    "business_id","customer_id",
                    "winning_value","winning_platform","winning_confidence",
                    "alternatives",
                    "winner_updated_at","winner_received_at",
                    "mcc_code","mcc_updated_at",
                    "mcc_code_found","mcc_found_updated_at",
                    "mcc_code_from_naics","mcc_from_naics_updated_at",
                    "naics_description","mcc_description",
                ]].copy()
                display_dd.columns = [
                    "Business ID","Customer ID",
                    "Winner Value","Winner Platform","Winner Confidence",
                    "Alternatives (Value | Platform)",
                    "Winner Updated At","Winner Row Created",
                    "MCC (Final)","MCC Last Updated",
                    "MCC AI (mcc_code_found)","MCC AI Last Updated",
                    "MCC NAICS-Derived (mcc_code_from_naics)","MCC NAICS-Derived Last Updated",
                    "NAICS Description","MCC Description",
                ]
                st.dataframe(display_dd, use_container_width=True, hide_index=True,
                             column_config={
                                 "Winner Confidence": st.column_config.NumberColumn(format="%.3f"),
                             })

                analyst_note(
                    "How to read the drilldown table",
                    "Each row = one business. "
                    "<strong>Winner Value</strong> = the NAICS (or MCC) code that won arbitration. "
                    "<strong>Alternatives</strong> = all other platforms that submitted a value (format: value (platform)). "
                    "If Winner Value is null but Alternatives shows a valid code → "
                    "the arbitration bug suppressed real data for this business. "
                    "<strong>MCC columns</strong> show the cascade: "
                    "MCC (Final) = mcc_code_found ?? mcc_code_from_naics. "
                    "If Winner Value = 561499, expect MCC NAICS-Derived = 7399.",
                    level="info",
                )
                st.download_button(
                    f"⬇️ Download {fn} drilldown",
                    display_dd.to_csv(index=False).encode(),
                    f"{fn}_drilldown.csv", "text/csv",
                    key=f"dl_dd_{fn}",
                )

        sql_panel(f"Business drilldown SQL — {fn}",
                  f"""\
{_onboarded_cte(f_from, f_to, f_cust, f_biz)}\
SELECT o.business_id, o.customer_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'value') AS winning_value,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS platform_id,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'')  AS confidence,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt')                AS updated_at,
    f.received_at,
    MAX(CASE WHEN mf.name='mcc_code'          THEN JSON_EXTRACT_PATH_TEXT(mf.value,'value') END) AS mcc_code,
    MAX(CASE WHEN mf.name='mcc_code_found'    THEN JSON_EXTRACT_PATH_TEXT(mf.value,'value') END) AS mcc_code_found,
    MAX(CASE WHEN mf.name='mcc_code_from_naics' THEN JSON_EXTRACT_PATH_TEXT(mf.value,'value') END) AS mcc_from_naics,
    MAX(CASE WHEN mf.name='naics_description' THEN JSON_EXTRACT_PATH_TEXT(mf.value,'value') END) AS naics_desc,
    MAX(CASE WHEN mf.name='mcc_description'   THEN JSON_EXTRACT_PATH_TEXT(mf.value,'value') END) AS mcc_desc
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
LEFT JOIN rds_warehouse_public.facts mf
    ON mf.business_id = f.business_id
    AND mf.name IN ('mcc_code','mcc_code_found','mcc_code_from_naics','naics_description','mcc_description')
    AND LENGTH(mf.value) < 60000
WHERE f.name = '{fn}' AND LENGTH(f.value) < 60000
GROUP BY o.business_id, o.customer_id, f.value, f.received_at
ORDER BY f.received_at DESC LIMIT 500""",
                  key_suffix=f"dd_sql_{fn}")
