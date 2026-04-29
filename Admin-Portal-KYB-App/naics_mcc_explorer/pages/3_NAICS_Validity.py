"""Page 3 — NAICS Code Validity Analysis.

Two-step validation:
1. Format check — 6-digit numeric string?
2. Lookup check — exists in rds_cases_public.core_naics_code?

Also flags catch-all 561499, P0 null wins, and "wrong vs invalid" separation.
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import platform_label, platform_color, CATCH_ALL_NAICS
from utils.validators import validate_naics, STATUS_COLORS, STATUS_ICONS
from db.queries import load_naics_facts, load_naics_lookup

st.set_page_config(page_title="NAICS Validity", page_icon="🔢", layout="wide")
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

st.markdown("# 🔢 NAICS Code Validity Analysis")
st.markdown(
    "Two-step validation: **format check** (must be exactly 6 numeric digits) then "
    "**lookup check** (must exist in `rds_cases_public.core_naics_code`). "
    "Catch-all `561499` is valid format but flagged separately as a quality risk."
)
st.markdown("---")

# ── Load data ──────────────────────────────────────────────────────────────────
with st.spinner("Loading NAICS facts…"):
    df = load_naics_facts(f_from, f_to, f_cust, f_biz)

with st.spinner("Loading NAICS lookup table…"):
    naics_lookup = load_naics_lookup()

if df.empty:
    no_data("No NAICS facts found for the selected filters.")
    st.stop()

# ── Validate every row ────────────────────────────────────────────────────────
df["platform_name"] = df["platform_id"].apply(platform_label)
df[["validity_status", "validity_reason"]] = df["naics_value"].apply(
    lambda v: pd.Series(validate_naics(v, naics_lookup))
)
df["status_icon"] = df["validity_status"].map(STATUS_ICONS)

total = len(df)
status_counts = df["validity_status"].value_counts()

def sc(key): return int(status_counts.get(key, 0))

n_valid        = sc("valid")
n_catchall     = sc("catch_all")
n_not_in_lk    = sc("not_in_lookup")
n_invalid_fmt  = sc("invalid_format")
n_null         = sc("null")
n_p0_null      = int(((df["platform_id"] == "0") & (df["naics_value"].isna() | (df["naics_value"] == ""))).sum())

# ── KPI cards ──────────────────────────────────────────────────────────────────
section_header("📊 Validity Summary")

cols = st.columns(6)
metrics = [
    ("Total NAICS Facts",    total,         "",                      "#3b82f6"),
    ("✅ Valid",             n_valid,       f"{100*n_valid/total:.1f}%", "#22c55e"),
    ("⚠️ Catch-all 561499", n_catchall,    f"{100*n_catchall/total:.1f}%", "#f59e0b"),
    ("🟠 Not in Lookup",    n_not_in_lk,  f"{100*n_not_in_lk/total:.1f}%", "#f97316"),
    ("❌ Invalid Format",   n_invalid_fmt, f"{100*n_invalid_fmt/total:.1f}%", "#ef4444"),
    ("⬜ Null Winner",      n_null,        f"P0 null wins: {n_p0_null}", "#64748b"),
]
for col, (label, val, sub, color) in zip(cols, metrics):
    with col:
        kpi(label, f"{val:,}", sub, color)

st.markdown("")

# ── Validity breakdown bar chart ────────────────────────────────────────────────
section_header("📊 Validity Category Breakdown")

cat_df = pd.DataFrame({
    "Category":    ["✅ Valid", "⚠️ Catch-all (561499)", "🟠 Not in Lookup",
                    "❌ Invalid Format", "⬜ Null"],
    "Count":       [n_valid, n_catchall, n_not_in_lk, n_invalid_fmt, n_null],
    "Color":       [STATUS_COLORS["valid"], STATUS_COLORS["catch_all"],
                    STATUS_COLORS["not_in_lookup"], STATUS_COLORS["invalid_format"],
                    STATUS_COLORS["null"]],
}).sort_values("Count", ascending=True)

fig = go.Figure(go.Bar(
    x=cat_df["Count"],
    y=cat_df["Category"],
    orientation="h",
    marker_color=cat_df["Color"].tolist(),
    text=cat_df["Count"].apply(lambda v: f"{v:,}"),
    textposition="outside",
    hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
))
fig.update_layout(
    height=280, margin=dict(l=0, r=80, t=10, b=0),
    paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
    xaxis=dict(showgrid=True, gridcolor="#1e293b"),
    yaxis=dict(showgrid=False),
)
st.plotly_chart(fig, use_container_width=True, key="naics_validity_bar")

st.markdown("---")

# ── Wrong vs Invalid explainer ─────────────────────────────────────────────────
with st.expander("📖 'Wrong' vs 'Invalid' — What's the difference?", expanded=False):
    st.markdown("""
| Category | Description | Count | Action |
|---|---|---|---|
| **Invalid format** | Not 6 numeric digits — definitely wrong | `{:,}` | Immediate fix |
| **Not in lookup** | 6 digits but not a real NAICS code | `{:,}` | Validate against source |
| **Catch-all (561499)** | Valid format and in lookup, but generic catch-all | `{:,}` | Re-enrichment |
| **Null** | Winning value is null (often P0 wrote null) | `{:,}` | Re-enrichment |
| **Wrong but valid** | Valid code, in lookup, but wrong for the business | _Unknown_ | Requires business context |

**Why this distinction matters:**  
Returning an invalid code (e.g. a 5-digit number) is a data pipeline failure — detectable automatically.  
Returning a wrong *valid* code (e.g. `811111` for a dentist) is an enrichment quality failure — requires manual review or AI cross-check.  
**Prioritize fixing invalid and null first.**
    """.format(n_invalid_fmt, n_not_in_lk, n_catchall, n_null))

st.markdown("---")

# ── Catch-all 561499 platform breakdown ───────────────────────────────────────
section_header("⚠️ Catch-all Code 561499 — Source Breakdown",
               "Which platforms are stamping 561499 most? P0 is almost always the primary culprit.")

ca_df = df[df["validity_status"] == "catch_all"].copy()
if ca_df.empty:
    st.success("✅ No 561499 catch-all codes found in the selected set.")
else:
    ca_by_pid = (
        ca_df.groupby(["platform_id", "platform_name"])
             .size()
             .reset_index(name="count")
             .sort_values("count", ascending=True)
    )
    ca_by_pid["color"] = ca_by_pid["platform_id"].apply(platform_color)
    ca_total = ca_by_pid["count"].sum()

    col_bar, col_info = st.columns([2, 1])
    with col_bar:
        fig_ca = go.Figure(go.Bar(
            x=ca_by_pid["count"],
            y=ca_by_pid["platform_name"],
            orientation="h",
            marker_color=ca_by_pid["color"].tolist(),
            text=ca_by_pid["count"].apply(
                lambda v: f"{v:,} ({100*v/ca_total:.0f}%)"
            ),
            textposition="outside",
            hovertemplate="<b>%{y}</b><br>561499 wins: %{x:,}<extra></extra>",
        ))
        fig_ca.update_layout(
            height=250, margin=dict(l=0, r=80, t=10, b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_ca, use_container_width=True, key="ca_bar")

    with col_info:
        p0_ca = int(ca_df[ca_df["platform_id"] == "0"].shape[0])
        ai_ca = int(ca_df[ca_df["platform_id"] == "31"].shape[0])
        kpi("Total 561499", f"{ca_total:,}", "", "#f59e0b")
        st.markdown("")
        kpi("From P0 (Ghost)", f"{p0_ca:,}", f"{100*p0_ca/ca_total:.0f}% of catch-alls",
            "#ef4444")
        st.markdown("")
        kpi("From AI (P31)", f"{ai_ca:,}", f"{100*ai_ca/ca_total:.0f}% of catch-alls",
            "#8b5cf6")

st.markdown("---")

# ── P0 null wins ──────────────────────────────────────────────────────────────
section_header("⬜ P0 Null-Value Wins",
               "platformId=0 wrote null with confidence:1 — real vendor data was locked out")

p0_null_df = df[(df["platform_id"] == "0") & (df["naics_value"].isna() | (df["naics_value"] == ""))].copy()
if p0_null_df.empty:
    st.success("✅ No P0 null wins found.")
else:
    st.warning(
        f"⚠️ **{len(p0_null_df):,} businesses** have a null NAICS winner from P0. "
        "Applicant Entry wrote `value: null` with `confidence: 1`, locking out real vendors "
        "(ZoomInfo, SERP, Equifax) that came back ~4 minutes later with actual codes."
    )
    display = p0_null_df[["business_id", "customer_id", "confidence", "received_at"]].copy()
    display.columns = ["Business ID", "Customer ID", "P0 Confidence", "Received At"]
    st.dataframe(display, use_container_width=True, hide_index=True)

st.markdown("---")

# ── Full invalid records table ─────────────────────────────────────────────────
section_header("❌ Invalid + Not-in-Lookup Records")

invalid_df = df[df["validity_status"].isin(["invalid_format", "not_in_lookup"])].copy()
if invalid_df.empty:
    st.success("✅ No invalid format or lookup-failure records found.")
else:
    display_inv = invalid_df[[
        "business_id", "customer_id", "naics_value",
        "platform_name", "confidence", "validity_status", "validity_reason",
    ]].copy()
    display_inv.columns = [
        "Business ID", "Customer ID", "NAICS Value",
        "Platform", "Confidence", "Status", "Reason",
    ]
    display_inv["Status"] = display_inv["Status"].map(STATUS_ICONS) + " " + display_inv["Status"]
    st.dataframe(
        display_inv,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Confidence": st.column_config.NumberColumn(format="%.3f"),
        },
    )

st.markdown("---")

# ── Full records table (filterable) ───────────────────────────────────────────
with st.expander("📋 Full records table (all validity statuses)"):
    status_filter = st.multiselect(
        "Filter by status",
        options=df["validity_status"].unique().tolist(),
        default=df["validity_status"].unique().tolist(),
        key="naics_status_filter",
    )
    filtered = df[df["validity_status"].isin(status_filter)] if status_filter else df

    display_full = filtered[[
        "business_id", "customer_id", "naics_value", "platform_name",
        "confidence", "status_icon", "validity_status", "validity_reason",
    ]].copy()
    display_full.columns = [
        "Business ID", "Customer ID", "NAICS Value", "Platform",
        "Confidence", "", "Status", "Reason",
    ]
    st.dataframe(display_full, use_container_width=True, hide_index=True)
    st.download_button(
        "⬇️ Download as CSV",
        display_full.to_csv(index=False).encode(),
        "naics_validity.csv",
        "text/csv",
    )
