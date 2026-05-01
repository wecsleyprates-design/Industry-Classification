"""Page 5 — NAICS → MCC Cascade Analysis with full NAICS+MCC columns and analyst notes."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, CATCH_ALL_NAICS, CATCH_ALL_MCC, KNOWN_INVALID_MCC
from utils.validators import validate_naics, validate_mcc, STATUS_COLORS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner
from db.queries import load_naics_lookup, load_mcc_lookup, _onboarded_cte

st.set_page_config(page_title="Cascade Analysis", page_icon="⛓️", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust    = filters["customer_id"]
f_client  = filters.get("client_name")
f_biz     = filters["business_id"]

st.markdown("# ⛓️ Industry Code → Payment Category: Ripple Effect Analysis")
st.markdown(
    "When a business's **industry code (NAICS) is missing or wrong**, its **payment category (MCC) breaks too**. "
    "That's because the payment category is automatically derived by converting the industry code using a mapping table. "
    "A bad input produces a bad output. "
    "This page shows how many businesses are affected, and groups them by how much work is needed to fix them."
)
platform_legend_panel()
data_source_banner()
st.markdown("---")

with st.spinner("Loading cascade data…"):
    df = get_data('cascade_summary', date_from=f_from, date_to=f_to, customer_id=f_cust, client_name=f_client, business_id=f_biz)
with st.spinner("Loading lookups…"):
    naics_lookup = load_naics_lookup()
    mcc_lookup   = load_mcc_lookup()

if df.empty:
    no_data("No data found.")
    st.stop()

total = len(df)

def _null(v): return v is None or str(v).strip() in ("","None","null")
def _catchall_n(v): return str(v).strip() in CATCH_ALL_NAICS if not _null(v) else False
def _catchall_m(v): return str(v).strip() in CATCH_ALL_MCC if not _null(v) else False
def _bad_mcc(v): return str(v).strip() in KNOWN_INVALID_MCC if not _null(v) else False

df["naics_null"]     = df["naics_value"].apply(_null)
df["naics_catchall"] = df["naics_value"].apply(_catchall_n)
df["naics_valid"]    = df.apply(lambda r: validate_naics(r["naics_value"], naics_lookup)[0]=="valid", axis=1)
df["mcc_null"]       = df["mcc_value"].apply(_null)
df["mcc_catchall"]   = df["mcc_value"].apply(_catchall_m)
df["mcc_bad"]        = df["mcc_value"].apply(_bad_mcc)
df["has_ai_mcc"]     = ~df["mcc_found_value"].apply(_null)
df["has_naics_mcc"]  = ~df["mcc_from_naics_value"].apply(_null)

# Platform labels
df["naics_platform_name"] = df["naics_platform"].apply(platform_label)
df["mcc_platform_name"]   = df["mcc_platform"].apply(platform_label)

# NAICS alternatives from raw JSON
def _alt_vals(raw):
    alts = parse_alternatives(raw)
    return " | ".join(str(a["alt_value"]) for a in alts) if alts else ""
def _alt_plats(raw):
    alts = parse_alternatives(raw)
    return " | ".join(a["alt_platform"] for a in alts) if alts else ""

df["naics_alt_values"]    = df["naics_raw_json"].apply(_alt_vals)
df["naics_alt_platforms"] = df["naics_raw_json"].apply(_alt_plats)

n_healthy    = int(df[df["naics_valid"] & ~df["mcc_null"] & ~df["mcc_catchall"]].shape[0])
n_bad_naics  = int(df[df["naics_null"] | df["naics_catchall"]].shape[0])
n_null_naics = int(df[df["naics_null"]].shape[0])
n_ca_naics   = int(df[df["naics_catchall"]].shape[0])
n_ai_prot    = int(df[(df["naics_null"] | df["naics_catchall"]) & df["has_ai_mcc"] & ~df["mcc_null"]].shape[0])
n_no_mcc     = int(df[(df["naics_null"] | df["naics_catchall"]) & df["mcc_null"]].shape[0])
n_double_bad = int(df[df["naics_catchall"] & df["mcc_catchall"]].shape[0])

# ── KPIs ──────────────────────────────────────────────────────────────────────
section_header("📊 Impact Summary")
c1,c2,c3,c4,c5,c6 = st.columns(6)
with c1: kpi("Total Businesses", f"{total:,}", color="#3b82f6")
with c2: kpi("✅ Healthy", f"{n_healthy:,}", f"Valid NAICS + valid MCC ({100*n_healthy/total:.1f}%)", "#22c55e")
with c3: kpi("Null NAICS", f"{n_null_naics:,}", f"{100*n_null_naics/total:.1f}% of portfolio", "#ef4444")
with c4: kpi("Generic Industry Code", f"{n_ca_naics:,}", "Code 561499 — no specific industry determined", "#f59e0b")
with c5: kpi("AI-Protected MCC", f"{n_ai_prot:,}", "null NAICS but AI caught MCC anyway", "#8b5cf6")
with c6: kpi("🔴 Both Codes Generic", f"{n_double_bad:,}", "Generic industry (561499) AND generic payment (7399) — highest priority", "#ef4444")

analyst_note(
    "How to read these numbers",
    "The industry code (NAICS) is assigned first. The payment category (MCC) is then derived from it using a conversion table. "
    "If the industry code is missing or generic, the conversion produces a generic or missing payment category too. "
    "However, the AI payment category assignment runs independently and can sometimes produce a valid result "
    "even when the industry code is wrong — those businesses are shown as 'AI-rescued'.",
    level="info",
    bullets=[
        f"<strong>{n_healthy:,} fully classified</strong>: valid industry code AND valid payment category — everything working correctly",
        f"<strong>{n_null_naics:,} missing industry code</strong>: the business submitted nothing (or submitted a blank), and the data vendor's result was overridden by the submission",
        f"<strong>{n_ca_naics:,} generic industry code (561499)</strong>: no specific industry was determined — payment category conversion is unreliable",
        f"<strong>{n_ai_prot:,} AI-rescued</strong>: industry code is missing/wrong, but the AI independently assigned a valid payment category — payment category is likely OK",
        f"<strong>{n_double_bad:,} both codes generic</strong>: industry code (561499) AND payment category (7399) are both generic placeholders — highest priority for correction",
    ],
)
st.markdown("---")

# ── Funnel ────────────────────────────────────────────────────────────────────
section_header("🌊 Impact Funnel — How a Wrong Industry Code Breaks the Payment Category")

analyst_note(
    "How to read this funnel",
    "Each stage is a subset of the one above it. Read top to bottom: "
    "start with all businesses → narrow to those with a missing or generic industry code → "
    "of those, how many were saved by the AI independently assigning a valid payment category → "
    "how many ended up with no payment category at all → "
    "how many have the worst outcome: both the industry code (561499) and payment category (7399) are generic placeholders.",
    level="info",
)

fig_f = go.Figure(go.Funnel(
    y=["Total businesses in scope",
       "With missing or generic industry code",
       "Of those: MCC AI-protected",
       "Of those: No MCC at all",
       "Both industry AND payment codes are generic (561499+7399)"],
    x=[total, n_bad_naics, n_ai_prot, n_no_mcc, n_double_bad],
    textinfo="value+percent initial",
    marker=dict(color=["#3b82f6","#f59e0b","#8b5cf6","#ef4444","#dc2626"]),
    connector=dict(line=dict(color="#334155", width=2)),
    hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
))
fig_f.update_layout(height=370, margin=dict(l=0,r=0,t=10,b=0),
                     paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1")
st.plotly_chart(fig_f, use_container_width=True, key="cascade_funnel")

sql_panel("Cascade Summary Query",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT o.business_id, o.customer_id,
    MAX(CASE WHEN f.name='naics_code' THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS naics_value,
    MAX(CASE WHEN f.name='naics_code' THEN COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') END) AS naics_platform,
    MAX(CASE WHEN f.name='mcc_code'   THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS mcc_value,
    MAX(CASE WHEN f.name='mcc_code_found'     THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS mcc_found_value,
    MAX(CASE WHEN f.name='mcc_code_from_naics' THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS mcc_from_naics_value
FROM onboarded o
LEFT JOIN rds_warehouse_public.facts f ON f.business_id = o.business_id
    AND f.name IN ('naics_code','mcc_code','mcc_code_found','mcc_code_from_naics')
    AND LENGTH(f.value) < 60000
GROUP BY o.business_id, o.customer_id""", key_suffix="cascade_sum")
st.markdown("---")

# ── Backfill tiers ────────────────────────────────────────────────────────────
section_header("🎯 Backfill Tier Classification — Remediation Complexity")

t1  = df[df["naics_catchall"] & ~df["mcc_null"] & ~df["mcc_catchall"] & df["has_ai_mcc"]]
t1b = df[df["naics_catchall"] & ~df["mcc_null"] & ~df["mcc_catchall"] & ~df["has_ai_mcc"]]
t2  = df[df["naics_catchall"] & df["mcc_catchall"]]
t3  = df[df["naics_catchall"] & df["mcc_null"]]

tier_data = [
    ("Tier 1 — NAICS fix only (AI-protected MCC)",     len(t1),  "#22c55e", "Fix NAICS only — MCC already correct via AI"),
    ("Tier 1b — NAICS fix only (specific MCC, no AI)", len(t1b), "#84cc16", "Fix NAICS; investigate MCC source before touching"),
    ("Tier 2 — Fix both industry code and payment category",      len(t2),  "#f59e0b", "Fix both industry code and payment category"),
    ("Tier 3 — NAICS + re-trigger AI (no MCC at all)", len(t3),  "#ef4444", "Fix NAICS + re-trigger AI enrichment"),
]
tier_df = pd.DataFrame(tier_data, columns=["Tier","Businesses","Color","Action"])

col_bar, col_tbl = st.columns([3,2])
with col_bar:
    fig_tier = go.Figure(go.Bar(
        x=tier_df["Businesses"], y=tier_df["Tier"], orientation="h",
        marker_color=tier_df["Color"].tolist(),
        text=tier_df["Businesses"].apply(lambda v: f"{v:,}"), textposition="outside",
        hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_tier.update_layout(height=240, margin=dict(l=0,r=50,t=10,b=0),
                            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                            xaxis=dict(showgrid=True, gridcolor="#1e293b"), yaxis=dict(showgrid=False))
    st.plotly_chart(fig_tier, use_container_width=True, key="tier_bar")

with col_tbl:
    st.dataframe(tier_df[["Tier","Businesses","Action"]], hide_index=True, use_container_width=True)

analyst_note(
    "Recommended fix order — start with the easiest, lowest-risk group first",
    "Fix in order from <strong>least work → most work</strong>.",
    level="info",
    bullets=[
        f"<strong>Tier 1 ({len(t1):,})</strong>: Fix industry code only — the AI already assigned a valid payment category independently. Safe to correct the industry code without touching the payment category.",
        f"<strong>Tier 1b ({len(t1b):,})</strong>: Fix industry code only — payment category looks correct but no AI backup exists. Verify the payment category source before making changes.",
        f"<strong>Tier 2 ({len(t2):,})</strong>: Fix both — the generic `mcc_code` (7399) was derived from the wrong NAICS code and needs to be corrected too.",
        f"<strong>Tier 3 ({len(t3):,})</strong>: Most work required — fix the NAICS code AND re-run `mcc_code_found` AI classification to produce a new result.",
    ],
)
st.markdown("---")

# ── Full cascade table with NAICS + MCC + timestamps + alternatives ────────────
section_header("📋 Per-Business Detail Table",
               "Industry code + payment category for every business, including all data sources that submitted values and their timestamps.")

with st.expander("Show full per-business data"):
    # Map to available columns (column names changed to _updated_at)
    def _safe_col(name, fallback=None):
        if name in df.columns: return name
        if fallback and fallback in df.columns: return fallback
        return None

    cols_map = {
        "business_id":              "Business ID",
        "customer_id":              "Customer ID",
        "naics_value":              "NAICS (Winner)",
        "naics_platform_name":      "NAICS Platform",
        "naics_updated_at":         "NAICS Last Updated",
        "naics_alt_values":         "NAICS Other Sources",
        "naics_alt_platforms":      "NAICS Other Platforms",
        "mcc_value":                "MCC (Final)",
        "mcc_updated_at":           "MCC Last Updated",
        "mcc_found_value":          "mcc_code_found (AI)",
        "mcc_found_updated_at":     "mcc_code_found Last Updated",
        "mcc_from_naics_value":     "mcc_code_from_naics",
        "mcc_from_naics_updated_at":"mcc_from_naics Last Updated",
        "mcc_platform_name":        "MCC Platform",
    }
    present = {k: v for k, v in cols_map.items() if k in df.columns}
    display = df[list(present.keys())].copy()
    display.columns = list(present.values())
    display["NAICS Status"] = df["naics_value"].apply(lambda v: validate_naics(v, naics_lookup)[0])
    display["MCC Status"]   = df["mcc_value"].apply(lambda v: validate_mcc(v, mcc_lookup)[0])
    st.dataframe(display, hide_index=True, use_container_width=True)
    st.download_button("⬇️ Download CSV", display.to_csv(index=False).encode(),
                       "cascade.csv","text/csv")
