"""Page 1 — Platform Winner Distribution."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import PLATFORM_MAP, platform_label, platform_color, pid_type
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.queries import load_platform_winners, load_platform_winner_values, _onboarded_cte

st.set_page_config(page_title="Platform Winners", page_icon="🏆", layout="wide")
st.markdown("""<style>
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
    "Shows which platform **wins the confidence arbitration race** for NAICS and MCC facts. "
    "When multiple platforms provide the same fact, the one with the highest `confidence` score wins. "
    "The goal is for trusted vendors (ZoomInfo, Equifax, SERP) to dominate — "
    "not self-reported applicant data (P0) or AI fallbacks (P31)."
)

platform_legend_panel()
st.markdown("---")

FACTS_TO_SHOW = ["naics_code", "mcc_code", "mcc_code_found", "mcc_code_from_naics"]

all_winners: dict[str, pd.DataFrame] = {}
for fn in FACTS_TO_SHOW:
    with st.spinner(f"Loading {fn}…"):
        df = load_platform_winners(fn, f_from, f_to, f_cust, f_biz)
    if not df.empty:
        # Merge legacy_source_name into platform_id display
        df["platform_id"] = df.apply(
            lambda r: r["platform_id"] if str(r["platform_id"]) not in ("unknown", "", "None")
                      else (r.get("legacy_source_name") or "unknown"),
            axis=1
        ).astype(str)
        df["platform_name"] = df["platform_id"].apply(platform_label)
        df["color"]         = df["platform_id"].apply(platform_color)
        df["type"]          = df["platform_id"].apply(pid_type)
        df["avg_confidence"] = pd.to_numeric(df["avg_confidence"], errors="coerce").fillna(0.0).round(3)
        total = df["business_count"].sum()
        df["pct_of_total"] = df["business_count"].apply(lambda v: f"{100*v/total:.1f}%" if total else "—")
    all_winners[fn] = df

# ── NAICS vs MCC side-by-side ──────────────────────────────────────────────────
section_header("📊 NAICS vs MCC — Side-by-Side Platform Winner Comparison",
               "Compare who wins for NAICS vs MCC. Dramatic differences indicate arbitration problems.")

for fact_pair in [("naics_code", "mcc_code"), ("mcc_code_found", "mcc_code_from_naics")]:
    col_a, col_b = st.columns(2)
    for fact, col in zip(fact_pair, [col_a, col_b]):
        with col:
            st.markdown(f"**`{fact}`**")
            df = all_winners.get(fact, pd.DataFrame())
            if df.empty:
                no_data(f"No data for `{fact}`")
                continue
            df_s = df.sort_values("business_count", ascending=True)
            fig = go.Figure(go.Bar(
                x=df_s["business_count"],
                y=df_s["platform_name"],
                orientation="h",
                marker_color=df_s["color"].tolist(),
                text=df_s.apply(lambda r: f"{r['business_count']:,} ({r['pct_of_total']})", axis=1),
                textposition="outside",
                hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
            ))
            fig.update_layout(
                height=max(220, len(df_s)*38+40), margin=dict(l=0, r=80, t=10, b=0),
                paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                xaxis=dict(showgrid=True, gridcolor="#1e293b"),
                yaxis=dict(showgrid=False),
            )
            st.plotly_chart(fig, use_container_width=True, key=f"pw_{fact}")

analyst_note(
    "How to read this chart",
    "Each bar = number of businesses where that platform <strong>won</strong> the confidence race for that fact. "
    "A healthy distribution has <strong>ZoomInfo (P24)</strong> or <strong>SERP (P22)</strong> dominating NAICS, "
    "and <strong>AI MCC Enrichment</strong> or NAICS-derived dominating MCC. "
    "Red flags: P0 (Applicant Entry) in top 2, or Legacy Schema dominating.",
    level="info",
    bullets=[
        "🟢 <strong>Green bars</strong> = external vendors — trusted, expected to win",
        "🟣 <strong>Purple bars</strong> = AI enrichment — acceptable fallback when vendors fail",
        "🔴 <strong>Red bar (P0)</strong> = self-reported onboarding data — should NEVER be a top winner",
        "⚫ <strong>Grey (Legacy/Unknown)</strong> = old schema records — source is in raw JSON source.name field",
    ],
)

# SQL panel
_pw_sql = f"""
{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'), 'unknown') AS platform_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                            AS legacy_source_name,
    COUNT(DISTINCT f.business_id)                                                 AS business_count,
    AVG(CAST(COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS FLOAT)) AS avg_confidence,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL THEN 1 ELSE 0 END) AS null_value_count
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = 'naics_code'   -- change to mcc_code etc.
  AND LENGTH(f.value) < 60000
GROUP BY 1, 2
ORDER BY 3 DESC"""
sql_panel("Platform Winner Distribution", _pw_sql, key_suffix="pw")
st.markdown("---")

# ── P0 Ghost Assigner ──────────────────────────────────────────────────────────
section_header("🚨 Ghost Assigner (P0 — Applicant Entry) Analysis",
               "platformId=0 hardcodes confidence:1, always beating real vendors in arbitration")

p0_rows = []
for fn in FACTS_TO_SHOW:
    df = all_winners.get(fn, pd.DataFrame())
    if df.empty: continue
    p0 = df[df["platform_id"] == "0"]
    if not p0.empty:
        r = p0.iloc[0]
        p0_rows.append({"Fact": fn, "P0 Wins": int(r["business_count"]),
                        "% of Total": r["pct_of_total"],
                        "Null Value Count": int(r.get("null_value_count", 0)),
                        "Avg Confidence": r["avg_confidence"]})

if p0_rows:
    p0_df = pd.DataFrame(p0_rows)
    total_p0 = p0_df["P0 Wins"].sum()
    st.error(f"⚠️ **Ghost Assigner (P0) is winning for {total_p0:,} fact records.** "
             "Self-reported onboarding data is beating real vendor data.", icon="🚨")

    c1, c2, c3 = st.columns(3)
    naics_p0 = next((r for r in p0_rows if r["Fact"]=="naics_code"), {})
    mcc_p0   = next((r for r in p0_rows if r["Fact"]=="mcc_code"), {})
    with c1: kpi("P0 NAICS Wins", str(naics_p0.get("P0 Wins","—")), naics_p0.get("% of Total",""), "#ef4444")
    with c2: kpi("P0 MCC Wins",   str(mcc_p0.get("P0 Wins","—")),   mcc_p0.get("% of Total",""), "#ef4444")
    with c3: kpi("P0 Null-Value Wins", f"{sum(r['Null Value Count'] for r in p0_rows):,}",
                 "P0 wrote null + confidence:1 → real data lost", "#f97316")
    st.markdown("")
    st.dataframe(p0_df, use_container_width=True, hide_index=True,
                 column_config={"P0 Wins": st.column_config.NumberColumn(format="%d"),
                                "Null Value Count": st.column_config.NumberColumn(format="%d"),
                                "Avg Confidence": st.column_config.NumberColumn(format="%.3f")})

    analyst_note(
        "Why P0 wins — and why it matters",
        "The <code>businessDetails</code> writer in <code>integration-service/lib/facts/sources.ts:151</code> "
        "has <code>confidence: 1</code> hardcoded. The arbitration rule "
        "(<code>factWithHighestConfidence</code> in <code>rules.ts</code>) picks the highest confidence — "
        "so P0 always wins vs ZoomInfo (~0.8) and SERP (~0.3). "
        "When a business submits <code>null</code> for their industry code on the onboarding form, "
        "P0 persists <code>value: null, confidence: 1</code> before any vendor responds (~4 min earlier). "
        "ZoomInfo returns a real code 4 minutes later — but loses the race.",
        level="danger",
        bullets=[
            "P0 runs <strong>~4 minutes before</strong> any real vendor",
            "P0 writes <code>confidence: 1</code> — highest possible — even for null values",
            "ZoomInfo returns confidence ~0.8, SERP ~0.3 → always lose to P0",
            f"<strong>{sum(r['Null Value Count'] for r in p0_rows):,} businesses</strong> have a NULL winning value from P0 — real data was suppressed",
        ],
        action="Lower `confidence` for `businessDetails` in `sources.ts:151` from `1` to `0.1`. "
               "This single change will cause ZoomInfo and SERP to win for thousands of businesses on next facts refresh.",
    )
    st.code("// integration-service/lib/facts/sources.ts:151\n"
            "businessDetails: {\n"
            "    confidence: 1,   // ← THE BUG — change to 0.1\n"
            "    platformId: 0,\n"
            "}", language="typescript")
else:
    st.success("✅ No P0 wins detected for the selected filters.")

sql_panel("P0 Ghost Assigner — null wins",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT f.business_id, o.customer_id,
       JSON_EXTRACT_PATH_TEXT(f.value,'value') AS winning_value,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') AS confidence,
       f.received_at
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'x') = '0'
  AND JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL
ORDER BY f.received_at DESC""", key_suffix="p0null")
st.markdown("---")

# ── Full stats table ───────────────────────────────────────────────────────────
section_header("📋 Full Platform Stats by Fact Type")
tabs = st.tabs([f"`{fn}`" for fn in FACTS_TO_SHOW])
for tab, fn in zip(tabs, FACTS_TO_SHOW):
    with tab:
        df = all_winners.get(fn, pd.DataFrame())
        if df.empty:
            no_data()
            continue
        display = df[["platform_name","platform_id","business_count","pct_of_total","avg_confidence","null_value_count","type"]].copy()
        display.columns = ["Platform","ID","Business Count","% of Total","Avg Confidence","Null Wins","Type"]
        st.dataframe(display.sort_values("Business Count",ascending=False),
                     use_container_width=True, hide_index=True,
                     column_config={"Business Count": st.column_config.NumberColumn(format="%d"),
                                    "Null Wins": st.column_config.NumberColumn(format="%d"),
                                    "Avg Confidence": st.column_config.NumberColumn(format="%.3f")})
        st.caption("🟢 Vendor  🟣 AI  🔴 Applicant Entry (P0)  ⚫ Legacy/Unknown")

        analyst_note(
            f"Interpreting the `{fn}` winner table",
            "The <strong>Avg Confidence</strong> column shows the average confidence score for that platform's wins. "
            "A value near 1.0 means the platform almost always won with high confidence — "
            "which is <em>suspicious</em> for P0 (always 1.0 by design) but expected for ZoomInfo. "
            "<strong>Null Wins</strong> = how many times that platform won but wrote an empty value "
            "(the worst outcome — a winner with no useful data).",
            level="info",
        )

        with st.expander("📊 Top 30 winning values for this fact"):
            with st.spinner("Loading…"):
                vdf = load_platform_winner_values(fn, f_from, f_to, f_cust, f_biz)
            if not vdf.empty:
                vdf["platform_name"] = vdf["platform_id"].apply(platform_label)
                fig2 = px.bar(vdf.head(30), x="fact_value", y="business_count",
                              color="platform_name",
                              color_discrete_map={platform_label(p): platform_color(p) for p in vdf["platform_id"].unique()},
                              labels={"fact_value":"Code","business_count":"Businesses","platform_name":"Platform"},
                              title=f"Top winning values — {fn}")
                fig2.update_layout(paper_bgcolor="#0f172a",plot_bgcolor="#0f172a",
                                   font_color="#cbd5e1",height=320,xaxis=dict(type="category"))
                st.plotly_chart(fig2, use_container_width=True, key=f"vals_{fn}")
