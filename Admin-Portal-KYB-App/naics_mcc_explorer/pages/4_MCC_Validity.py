"""Page 4 — MCC Code Validity & Source Analysis.

Validates MCC codes against rds_cases_public.core_mcc_code, breaks down
AI-direct vs NAICS-derived sources, flags known invalid codes (5614 AI bug),
and shows catch-all 7399 distribution.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import platform_label, platform_color, CATCH_ALL_MCC, KNOWN_INVALID_MCC
from utils.validators import validate_mcc, STATUS_COLORS, STATUS_ICONS
from db.queries import load_mcc_facts, load_mcc_lookup

st.set_page_config(page_title="MCC Validity", page_icon="💳", layout="wide")
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

st.markdown("# 💳 MCC Code Validity & Source Analysis")
st.markdown(
    "MCC is derived, not sourced: **Path 1** = AI classifies directly (`mcc_code_found`), "
    "**Path 2** = NAICS→MCC lookup table (`mcc_code_from_naics`). "
    "The final `mcc_code` fact uses whichever path ran. "
    "A broken NAICS upstream corrupts Path 2 entirely."
)
st.markdown("---")

# ── Load data ──────────────────────────────────────────────────────────────────
with st.spinner("Loading MCC facts…"):
    df = load_mcc_facts(f_from, f_to, f_cust, f_biz)

with st.spinner("Loading MCC lookup table…"):
    mcc_lookup = load_mcc_lookup()

if df.empty:
    no_data("No MCC facts found for the selected filters.")
    st.stop()

df["platform_name"] = df["platform_id"].apply(platform_label)
df[["validity_status", "validity_reason"]] = df["mcc_value"].apply(
    lambda v: pd.Series(validate_mcc(v, mcc_lookup))
)
df["status_icon"] = df["validity_status"].map(STATUS_ICONS)

# Pivot to per-business summary
mcc_final   = df[df["fact_name"] == "mcc_code"].copy()
mcc_found   = df[df["fact_name"] == "mcc_code_found"].copy()
mcc_fromnaics = df[df["fact_name"] == "mcc_code_from_naics"].copy()

total_biz   = df["business_id"].nunique()
n_final     = mcc_final["business_id"].nunique()
n_ai_only   = len(set(mcc_found["business_id"]) - set(mcc_fromnaics["business_id"]))
n_naics_drv = len(set(mcc_fromnaics["business_id"]) - set(mcc_found["business_id"]))
n_both      = len(set(mcc_found["business_id"]) & set(mcc_fromnaics["business_id"]))
n_neither   = total_biz - len(set(mcc_found["business_id"]) | set(mcc_fromnaics["business_id"]))

status_counts = mcc_final["validity_status"].value_counts()
def sc(k): return int(status_counts.get(k, 0))

n_valid     = sc("valid")
n_catchall  = sc("catch_all")
n_bad       = sc("known_invalid")
n_not_lk    = sc("not_in_lookup")
n_null      = sc("null")
n_5614      = int((mcc_final["mcc_value"] == "5614").sum())

# ── KPI row 1: coverage ─────────────────────────────────────────────────────────
section_header("📊 MCC Coverage & Source Mix")

c1, c2, c3, c4 = st.columns(4)
with c1: kpi("Businesses w/ mcc_code", f"{n_final:,}", f"of {total_biz:,} total", "#3b82f6")
with c2: kpi("AI Direct Only",          f"{n_ai_only:,}", "mcc_code_found, no NAICS path", "#8b5cf6")
with c3: kpi("NAICS-Derived Only",      f"{n_naics_drv:,}", "mcc_code_from_naics, no AI", "#6366f1")
with c4: kpi("Both Paths Ran",          f"{n_both:,}", "AI + NAICS-derived coexist", "#22c55e")

st.markdown("")

c5, c6, c7, c8 = st.columns(4)
with c5: kpi("✅ Valid MCC",            f"{n_valid:,}",   f"{100*n_valid/n_final:.1f}% of mcc_code facts" if n_final else "", "#22c55e")
with c6: kpi("⚠️ Catch-all 7399",      f"{n_catchall:,}", f"{100*n_catchall/n_final:.1f}%" if n_final else "", "#f59e0b")
with c7: kpi("❌ Invalid (5614 bug)",   f"{n_5614:,}",    "AI prompt fallback — known bad", "#ef4444")
with c8: kpi("⬜ Null mcc_code",        f"{n_null:,}",    "No winning value", "#64748b")

st.markdown("---")

# ── Source category donut ──────────────────────────────────────────────────────
section_header("🥧 MCC Source Category Distribution",
               "Where is the final mcc_code coming from?")

col_donut, col_bar = st.columns(2)

with col_donut:
    src_df = pd.DataFrame({
        "Category": ["AI Direct Only", "NAICS-Derived Only", "Both Paths", "No MCC"],
        "Count":    [n_ai_only, n_naics_drv, n_both, n_neither],
        "Color":    ["#8b5cf6", "#3b82f6", "#22c55e", "#64748b"],
    })
    src_df = src_df[src_df["Count"] > 0]

    fig_donut = go.Figure(go.Pie(
        labels=src_df["Category"],
        values=src_df["Count"],
        marker_colors=src_df["Color"].tolist(),
        textinfo="label+percent",
        hole=0.4,
        hovertemplate="<b>%{label}</b><br>Businesses: %{value:,}<extra></extra>",
    ))
    fig_donut.update_layout(
        height=320, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#0f172a", font_color="#cbd5e1",
        showlegend=False,
    )
    st.plotly_chart(fig_donut, use_container_width=True, key="mcc_src_donut")

with col_bar:
    # Top 20 MCC codes in mcc_final with validity color
    top_mcc = (
        mcc_final.groupby(["mcc_value", "validity_status"])
                 .size()
                 .reset_index(name="count")
                 .sort_values("count", ascending=False)
                 .head(20)
    )
    top_mcc["color"] = top_mcc["validity_status"].map(STATUS_COLORS)
    top_mcc["label"] = top_mcc["mcc_value"].fillna("null")
    top_mcc = top_mcc.sort_values("count", ascending=True)

    fig_top = go.Figure(go.Bar(
        x=top_mcc["count"],
        y=top_mcc["label"],
        orientation="h",
        marker_color=top_mcc["color"].tolist(),
        text=top_mcc["count"].apply(lambda v: f"{v:,}"),
        textposition="outside",
        hovertemplate="<b>MCC %{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_top.update_layout(
        title="Top 20 MCC Codes (final mcc_code)",
        height=380, margin=dict(l=0, r=50, t=30, b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=False, type="category"),
    )
    st.plotly_chart(fig_top, use_container_width=True, key="mcc_top20")
    st.caption("🟢 Valid  🟡 Catch-all  🔴 Known invalid  🔵 Not in lookup  ⚫ Null")

st.markdown("---")

# ── 5614 AI bug callout ────────────────────────────────────────────────────────
if n_5614 > 0:
    st.error(
        f"🚨 **{n_5614:,} businesses have MCC = `5614`** — this is a known invalid code "
        "produced by an AI prompt bug. The AI returns `5614` (Educational Services — invalid MCC) "
        "instead of a real code when it cannot confidently classify the business. "
        "These businesses need MCC re-enrichment.",
        icon="🚨",
    )
    bug_df = mcc_final[mcc_final["mcc_value"] == "5614"][[
        "business_id", "customer_id", "platform_name", "confidence", "received_at"
    ]].copy()
    bug_df.columns = ["Business ID", "Customer ID", "Platform", "Confidence", "Received At"]
    with st.expander(f"View {n_5614} businesses with MCC=5614"):
        st.dataframe(bug_df, hide_index=True, use_container_width=True)
else:
    st.success("✅ No `5614` (AI bug) MCC codes found in the selected set.")

st.markdown("---")

# ── Path comparison confidence ──────────────────────────────────────────────────
section_header("📊 AI vs NAICS-Derived Confidence Comparison",
               "Higher confidence = that path is more reliable for the selected business set")

if not mcc_found.empty and not mcc_fromnaics.empty:
    mcc_found["conf_f"]     = pd.to_numeric(mcc_found["confidence"], errors="coerce").fillna(0)
    mcc_fromnaics["conf_f"] = pd.to_numeric(mcc_fromnaics["confidence"], errors="coerce").fillna(0)

    fig_conf = go.Figure()
    fig_conf.add_trace(go.Histogram(
        x=mcc_found["conf_f"],
        name="AI Direct (mcc_code_found)",
        marker_color="#8b5cf6",
        opacity=0.75,
        nbinsx=20,
    ))
    fig_conf.add_trace(go.Histogram(
        x=mcc_fromnaics["conf_f"],
        name="NAICS-Derived (mcc_code_from_naics)",
        marker_color="#3b82f6",
        opacity=0.75,
        nbinsx=20,
    ))
    fig_conf.update_layout(
        barmode="overlay",
        height=280, margin=dict(l=0, r=0, t=10, b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis_title="Confidence Score",
        yaxis_title="Count",
        legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
    )
    st.plotly_chart(fig_conf, use_container_width=True, key="mcc_conf_hist")
else:
    no_data("Need both mcc_code_found and mcc_code_from_naics facts to compare.")

st.markdown("---")

# ── Invalid records table ──────────────────────────────────────────────────────
section_header("❌ Invalid & Flagged MCC Records")

invalid_mcc = mcc_final[mcc_final["validity_status"].isin(
    ["known_invalid", "not_in_lookup", "null"]
)].copy()

if invalid_mcc.empty:
    st.success("✅ No invalid or null MCC codes found in the selected set.")
else:
    display_inv = invalid_mcc[[
        "business_id", "customer_id", "mcc_value",
        "platform_name", "confidence", "validity_status", "validity_reason",
    ]].copy()
    display_inv.columns = [
        "Business ID", "Customer ID", "MCC Value",
        "Platform", "Confidence", "Status", "Reason",
    ]
    st.dataframe(display_inv, hide_index=True, use_container_width=True)
    st.download_button(
        "⬇️ Download invalid MCC records",
        display_inv.to_csv(index=False).encode(),
        "mcc_invalid.csv",
        "text/csv",
    )
