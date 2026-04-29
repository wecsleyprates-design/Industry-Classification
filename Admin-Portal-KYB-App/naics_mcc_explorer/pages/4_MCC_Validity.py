"""Page 4 — MCC Code Validity & Source Analysis with alternatives + SQL runner."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, CATCH_ALL_MCC, KNOWN_INVALID_MCC
from utils.validators import validate_mcc, STATUS_COLORS, STATUS_ICONS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.queries import load_mcc_facts, load_mcc_lookup, _onboarded_cte

st.set_page_config(page_title="MCC Validity", page_icon="💳", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]
f_biz  = filters["business_id"]

st.markdown("# 💳 MCC Code Validity & Source Analysis")
st.markdown(
    "MCC codes are **derived, not directly sourced**. Two paths:\n\n"
    "- **Path 1** (`mcc_code_found`) — AI classifies the business directly from name/description\n"
    "- **Path 2** (`mcc_code_from_naics`) — NAICS→MCC lookup table applied to the winning NAICS\n\n"
    "The final `mcc_code` fact prefers Path 1 over Path 2. If NAICS is null or 561499, Path 2 is also broken."
)
platform_legend_panel()
st.markdown("---")

with st.spinner("Loading MCC facts…"):
    df = load_mcc_facts(f_from, f_to, f_cust, f_biz)
with st.spinner("Loading MCC lookup…"):
    mcc_lookup = load_mcc_lookup()

if df.empty:
    no_data("No MCC facts found.")
    st.stop()

df["eff_pid"] = df.apply(
    lambda r: r["platform_id"] if str(r["platform_id"]) not in ("unknown","","None")
              else (r.get("legacy_source_name") or "unknown"), axis=1
).astype(str)
df["platform_name"] = df["eff_pid"].apply(platform_label)
df[["validity_status","validity_reason"]] = df["mcc_value"].apply(
    lambda v: pd.Series(validate_mcc(v, mcc_lookup))
)

def _alt_summary(raw):
    alts = parse_alternatives(raw)
    if not alts: return "", "", ""
    return (" | ".join(str(a["alt_value"]) for a in alts),
            " | ".join(a["alt_platform"] for a in alts),
            " | ".join(str(a["alt_confidence"]) for a in alts))

df[["alt_values","alt_platforms","alt_confidences"]] = df["raw_json"].apply(
    lambda r: pd.Series(_alt_summary(r))
)

mcc_final     = df[df["fact_name"]=="mcc_code"].copy()
mcc_found     = df[df["fact_name"]=="mcc_code_found"].copy()
mcc_fromnaics = df[df["fact_name"]=="mcc_code_from_naics"].copy()

total_biz  = df["business_id"].nunique()
n_final    = mcc_final["business_id"].nunique()
n_ai       = len(set(mcc_found["business_id"]) - set(mcc_fromnaics["business_id"]))
n_naics_d  = len(set(mcc_fromnaics["business_id"]) - set(mcc_found["business_id"]))
n_both     = len(set(mcc_found["business_id"]) & set(mcc_fromnaics["business_id"]))
n_neither  = total_biz - len(set(mcc_found["business_id"]) | set(mcc_fromnaics["business_id"]))

def sc(df_, k): return int(df_["validity_status"].value_counts().get(k, 0))
n_valid   = sc(mcc_final,"valid")
n_ca      = sc(mcc_final,"catch_all")
n_bad     = sc(mcc_final,"known_invalid")
n_not_lk  = sc(mcc_final,"not_in_lookup")
n_null    = sc(mcc_final,"null")
n_5614    = int((mcc_final["mcc_value"]=="5614").sum())

# ── KPIs ──────────────────────────────────────────────────────────────────────
section_header("📊 MCC Coverage & Validity")

c1,c2,c3,c4 = st.columns(4)
with c1: kpi("Businesses w/ mcc_code", f"{n_final:,}", f"of {total_biz:,} total", "#3b82f6")
with c2: kpi("AI Direct Only",         f"{n_ai:,}",    "mcc_code_found only",       "#8b5cf6")
with c3: kpi("NAICS-Derived Only",     f"{n_naics_d:,}","mcc_code_from_naics only", "#6366f1")
with c4: kpi("Both Paths Ran",         f"{n_both:,}",  "AI + NAICS-derived",        "#22c55e")
st.markdown("")
c5,c6,c7,c8 = st.columns(4)
with c5: kpi("✅ Valid MCC",           f"{n_valid:,}",  f"{100*n_valid/n_final:.1f}%" if n_final else "", "#22c55e")
with c6: kpi("⚠️ Catch-all 7399",     f"{n_ca:,}",    f"{100*n_ca/n_final:.1f}%" if n_final else "",   "#f59e0b")
with c7: kpi("❌ Invalid MCC (5614)",  f"{n_5614:,}",  "AI prompt bug fallback",    "#ef4444")
with c8: kpi("⬜ Null mcc_code",       f"{n_null:,}",  "No winning value",          "#64748b")

analyst_note(
    "Interpreting MCC coverage metrics",
    "The three MCC facts work together: <code>mcc_code_found</code> (AI-direct) wins when available; "
    "otherwise <code>mcc_code_from_naics</code> (NAICS lookup) is used. "
    "The final <code>mcc_code</code> reflects whichever path succeeded.",
    level="info",
    bullets=[
        "<strong>AI Direct Only</strong>: AI classified the business independently — not dependent on NAICS quality",
        "<strong>NAICS-Derived Only</strong>: MCC came from the NAICS→MCC mapping — if NAICS is wrong, MCC is wrong",
        "<strong>Both Paths</strong>: both ran — AI likely won (higher priority). NAICS-derived stored as backup",
        "<strong>Neither</strong>: business has no MCC at all — invisible to any MCC-based risk rule",
        f"<strong>5614 (AI bug)</strong>: {n_5614:,} businesses — AI prompt fallback assigns 5614 (Educational Services, invalid MCC) when it cannot classify. These need MCC re-enrichment.",
    ],
)
st.markdown("---")

# ── Source donut + top MCC bar ────────────────────────────────────────────────
section_header("🥧 MCC Source Distribution + Top MCC Codes")
col_d, col_b = st.columns(2)

with col_d:
    src_df = pd.DataFrame({
        "Category":["AI Direct Only","NAICS-Derived Only","Both Paths","No MCC"],
        "Count":   [n_ai, n_naics_d, n_both, n_neither],
        "Color":   ["#8b5cf6","#3b82f6","#22c55e","#64748b"],
    }).query("Count > 0")
    fig_d = go.Figure(go.Pie(
        labels=src_df["Category"], values=src_df["Count"],
        marker_colors=src_df["Color"].tolist(),
        textinfo="label+percent", hole=0.4,
        hovertemplate="<b>%{label}</b><br>Businesses: %{value:,}<extra></extra>",
    ))
    fig_d.update_layout(height=310, margin=dict(l=0,r=0,t=10,b=0),
                         paper_bgcolor="#0f172a", font_color="#cbd5e1", showlegend=False)
    st.plotly_chart(fig_d, use_container_width=True, key="mcc_src_donut")
    analyst_note(
        "What this donut reveals",
        "A large <strong>NAICS-Derived Only</strong> slice means MCC quality is directly chained to NAICS quality. "
        "Every NAICS bug cascades into a wrong MCC. "
        "A large <strong>No MCC</strong> slice means those businesses are invisible to payment-level risk rules.",
        level="warning",
    )

with col_b:
    top_mcc = (mcc_final.groupby(["mcc_value","validity_status"]).size()
               .reset_index(name="count").sort_values("count",ascending=False).head(20))
    top_mcc["color"] = top_mcc["validity_status"].map(STATUS_COLORS)
    top_mcc["label"] = top_mcc["mcc_value"].fillna("null")
    top_mcc = top_mcc.sort_values("count", ascending=True)
    fig_t = go.Figure(go.Bar(
        x=top_mcc["count"], y=top_mcc["label"], orientation="h",
        marker_color=top_mcc["color"].tolist(),
        text=top_mcc["count"].apply(lambda v: f"{v:,}"), textposition="outside",
        hovertemplate="<b>MCC %{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_t.update_layout(title="Top 20 MCC codes (final mcc_code)",
                         height=380, margin=dict(l=0,r=50,t=30,b=0),
                         paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                         xaxis=dict(showgrid=True, gridcolor="#1e293b"),
                         yaxis=dict(showgrid=False, type="category"))
    st.plotly_chart(fig_t, use_container_width=True, key="mcc_top20")
    st.caption("🟢 Valid  🟡 Catch-all (7399)  🔴 Known invalid (5614)  🔵 Not in lookup  ⚫ Null")
    analyst_note(
        "Reading the Top MCC chart",
        "Codes should be specific industry codes (e.g. 8011=Physicians, 5812=Restaurants). "
        "<strong>7399</strong> (Business Services NEC) is the catch-all — a meaningless code for risk decisioning. "
        "<strong>5614</strong> in the top codes is a critical signal of the AI prompt bug affecting many businesses.",
        level="info",
    )

sql_panel("MCC Facts Query",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT f.business_id, o.customer_id, f.name AS fact_name,
       JSON_EXTRACT_PATH_TEXT(f.value,'value') AS mcc_value,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS platform_id,
       COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS confidence,
       f.received_at
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name IN ('mcc_code','mcc_code_found','mcc_code_from_naics')
  AND LENGTH(f.value) < 60000
ORDER BY f.business_id, f.name""", key_suffix="mcc_facts")
st.markdown("---")

# ── 5614 callout ───────────────────────────────────────────────────────────────
if n_5614 > 0:
    st.error(f"🚨 **{n_5614:,} businesses have MCC = `5614`** — AI prompt bug.", icon="🚨")
    analyst_note(
        "What is MCC 5614 and why is it a problem?",
        "<strong>5614 is not a valid Visa/Mastercard MCC</strong>. It maps to 'Educational Services' in some "
        "non-standard lists but is not recognized by major payment networks. The AI returns it as a fallback "
        "when it cannot confidently classify the business. Businesses tagged 5614 will fail MCC-based "
        "routing, interchange, and risk rules.",
        level="danger",
        bullets=[
            f"{n_5614:,} businesses currently have 5614 as their winning MCC",
            "This is an AI prompt engineering bug — the model's fallback output is an invalid code",
            "These businesses need mcc_code re-enrichment — AI needs to re-run with a corrected prompt",
        ],
        action="Re-trigger AI MCC enrichment for all 5614 businesses. Fix the AI prompt to not return 5614.",
    )
    bug_df = mcc_final[mcc_final["mcc_value"]=="5614"][[
        "business_id","customer_id","platform_name","confidence","received_at","alt_values","alt_platforms"
    ]].copy()
    bug_df.columns = ["Business ID","Customer ID","Platform","Confidence","Received At","Alt MCC Values","Alt Platforms"]
    with st.expander(f"View {n_5614:,} businesses with MCC=5614"):
        st.dataframe(bug_df, hide_index=True, use_container_width=True)
else:
    st.success("✅ No 5614 MCC codes found.")
st.markdown("---")

# ── AI vs NAICS-derived confidence ────────────────────────────────────────────
section_header("📊 AI-Direct vs NAICS-Derived Confidence",
               "Compares the confidence distribution of the two MCC derivation paths")

if not mcc_found.empty and not mcc_fromnaics.empty:
    mcc_found["conf_f"]     = pd.to_numeric(mcc_found["confidence"], errors="coerce").fillna(0)
    mcc_fromnaics["conf_f"] = pd.to_numeric(mcc_fromnaics["confidence"], errors="coerce").fillna(0)

    # Summary stats
    ai_avg  = mcc_found["conf_f"].mean()
    nd_avg  = mcc_fromnaics["conf_f"].mean()
    ai_zero = int((mcc_found["conf_f"] == 0).sum())
    nd_zero = int((mcc_fromnaics["conf_f"] == 0).sum())

    c1, c2, c3, c4 = st.columns(4)
    with c1: kpi("AI Avg Confidence",    f"{ai_avg:.3f}", f"{len(mcc_found):,} records", "#8b5cf6")
    with c2: kpi("NAICS-Derived Avg",    f"{nd_avg:.3f}", f"{len(mcc_fromnaics):,} records", "#3b82f6")
    with c3: kpi("AI Zero-Confidence",   f"{ai_zero:,}",  "records with conf=0", "#ef4444" if ai_zero>0 else "#22c55e")
    with c4: kpi("NAICS-Derived Zero",   f"{nd_zero:,}",  "records with conf=0", "#ef4444" if nd_zero>0 else "#22c55e")

    analyst_note(
        "What the confidence scores mean for MCC",
        "For <code>mcc_code_found</code> (AI direct): confidence reflects how certain the AI was. "
        "A high proportion of <strong>zero-confidence</strong> records means the AI ran but returned no result — "
        "or the record uses the old schema (no confidence field). "
        "For <code>mcc_code_from_naics</code> (NAICS-derived): confidence is typically null or zero because "
        "the NAICS→MCC lookup is deterministic — it doesn't have a confidence score, it just maps the code. "
        "So a large zero-confidence bar in NAICS-derived is <strong>expected and normal</strong>.",
        level="info",
        bullets=[
            "AI (mcc_code_found) confidence clusters near 0 = AI returned a low-confidence result or old schema records",
            "NAICS-derived confidence near 0 = normal — lookup tables don't produce confidence scores",
            "Both averaging near 0.15 = AI fallback dominating (P31 runs with confidence 0.15)",
        ],
    )

    # Grouped bar: conf distribution
    bins = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1.01]
    labels = ["0","0–0.05","0.05–0.1","0.1–0.15","0.15–0.2","0.2–0.3","0.3–0.5","0.5–1.0"]
    ai_hist  = pd.cut(mcc_found["conf_f"], bins=bins, labels=labels[1:], right=False).value_counts().sort_index()
    nd_hist  = pd.cut(mcc_fromnaics["conf_f"], bins=bins, labels=labels[1:], right=False).value_counts().sort_index()

    fig_conf = go.Figure()
    fig_conf.add_trace(go.Bar(name="AI Direct (mcc_code_found)",
                               x=ai_hist.index.astype(str), y=ai_hist.values, marker_color="#8b5cf6"))
    fig_conf.add_trace(go.Bar(name="NAICS-Derived (mcc_code_from_naics)",
                               x=nd_hist.index.astype(str), y=nd_hist.values, marker_color="#3b82f6"))
    fig_conf.update_layout(
        barmode="group", height=300, margin=dict(l=0,r=0,t=10,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis_title="Confidence Range", yaxis_title="Record Count",
        legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
    )
    st.plotly_chart(fig_conf, use_container_width=True, key="mcc_conf_bar")
st.markdown("---")

# ── Full records table (mcc_final) with alternatives ──────────────────────────
section_header("📋 Final MCC Records — Winner + Alternatives")
display_f = mcc_final[[
    "business_id","customer_id","mcc_value","platform_name","confidence",
    "winner_updated_at","received_at","validity_status","validity_reason",
    "alt_values","alt_platforms","alt_confidences",
]].copy()
display_f.columns = [
    "Business ID","Customer ID","MCC (Winner)","Platform","Confidence",
    "Winner Updated At","Received At","Status","Reason",
    "Alternative MCC Values","Alternative Platforms","Alt Confidences",
]
st.dataframe(display_f, use_container_width=True, hide_index=True,
             column_config={"Confidence": st.column_config.NumberColumn(format="%.3f"),
                            "Received At": st.column_config.DatetimeColumn()})
st.download_button("⬇️ Download CSV", display_f.to_csv(index=False).encode(),
                   "mcc_validity.csv","text/csv")
