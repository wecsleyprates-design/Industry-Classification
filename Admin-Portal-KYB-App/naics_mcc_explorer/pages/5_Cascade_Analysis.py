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
from db.queries import load_cascade_summary, load_naics_lookup, load_mcc_lookup, _onboarded_cte

st.set_page_config(page_title="Cascade Analysis", page_icon="⛓️", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]
f_biz  = filters["business_id"]

st.markdown("# ⛓️ NAICS → MCC Cascade Analysis")
st.markdown(
    "When NAICS is null or wrong, MCC breaks too — because `mcc_code_from_naics` (Path 2) "
    "derives from the winning NAICS code. This page traces that cascade and classifies every "
    "business into a **backfill tier** based on how much remediation is needed."
)
platform_legend_panel()
st.markdown("---")

with st.spinner("Loading cascade data…"):
    df = load_cascade_summary(f_from, f_to, f_cust, f_biz)
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
section_header("📊 Cascade Summary")
c1,c2,c3,c4,c5,c6 = st.columns(6)
with c1: kpi("Total Businesses", f"{total:,}", color="#3b82f6")
with c2: kpi("✅ Healthy", f"{n_healthy:,}", f"Valid NAICS + valid MCC ({100*n_healthy/total:.1f}%)", "#22c55e")
with c3: kpi("Null NAICS", f"{n_null_naics:,}", f"{100*n_null_naics/total:.1f}% of portfolio", "#ef4444")
with c4: kpi("Catch-all NAICS", f"{n_ca_naics:,}", "561499 → MCC also degraded", "#f59e0b")
with c5: kpi("AI-Protected MCC", f"{n_ai_prot:,}", "null NAICS but AI caught MCC anyway", "#8b5cf6")
with c6: kpi("🔴 Double Catch-all", f"{n_double_bad:,}", "561499 NAICS + 7399 MCC — both wrong", "#ef4444")

analyst_note(
    "Understanding the cascade metrics",
    "The cascade works like this: NAICS is assigned first → MCC is derived from NAICS (Path 2). "
    "If NAICS is null or 561499, Path 2 produces null or 7399. Path 1 (AI direct MCC) runs independently "
    "and can rescue businesses — which is why some null-NAICS businesses still have valid MCCs.",
    level="info",
    bullets=[
        f"<strong>{n_healthy:,} healthy</strong>: valid NAICS + valid MCC — pipeline working correctly",
        f"<strong>{n_null_naics:,} null NAICS</strong>: P0 wrote null with confidence:1 — real vendor data suppressed",
        f"<strong>{n_ca_naics:,} catch-all NAICS</strong>: 561499 assigned — generic code feeding into MCC",
        f"<strong>{n_ai_prot:,} AI-protected</strong>: NAICS broken but AI independently produced a valid MCC — resilient",
        f"<strong>{n_double_bad:,} double catch-all</strong>: 561499→7399 — both codes meaningless — highest priority fix",
    ],
)
st.markdown("---")

# ── Funnel ────────────────────────────────────────────────────────────────────
section_header("🌊 Cascade Funnel — How Bad NAICS Flows Into Broken MCC")

analyst_note(
    "How to read the funnel",
    "Each stage is a subset of the one above it. Read top to bottom: "
    "<strong>Total businesses</strong> → of those, how many have a bad NAICS → "
    "of those bad-NAICS businesses, how many were rescued by AI MCC (Path 1) → "
    "how many ended up with no MCC at all → how many have the worst outcome: "
    "both NAICS=561499 and MCC=7399.",
    level="info",
)

fig_f = go.Figure(go.Funnel(
    y=["Total businesses in scope",
       "With null or catch-all NAICS",
       "Of those: MCC AI-protected",
       "Of those: No MCC at all",
       "Double catch-all (561499→7399)"],
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
    ("Tier 2 — NAICS + MCC fix (7399 catch-all)",      len(t2),  "#f59e0b", "Fix both NAICS and MCC"),
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
    "Backfill execution order",
    "Fix in order from <strong>lowest risk → highest complexity</strong>.",
    level="info",
    bullets=[
        f"<strong>Tier 1 ({len(t1):,})</strong>: NAICS fix only — AI already saved MCC. Safe to fix NAICS without touching MCC.",
        f"<strong>Tier 1b ({len(t1b):,})</strong>: NAICS fix only — MCC is specific but no AI backup. Investigate MCC source first.",
        f"<strong>Tier 2 ({len(t2):,})</strong>: Fix both NAICS and MCC. Overwrite mcc_code and mcc_code_from_naics after NAICS fixed.",
        f"<strong>Tier 3 ({len(t3):,})</strong>: Most complex. Fix NAICS then re-trigger AI enrichment to produce a new mcc_code_found.",
    ],
)
st.markdown("---")

# ── Full cascade table with NAICS + MCC + timestamps + alternatives ────────────
section_header("📋 Per-Business Cascade Table",
               "Includes NAICS winner + alternatives, MCC (final/AI/NAICS-derived), and all received timestamps.")

with st.expander("Show full per-business cascade data"):
    display = df[[
        "business_id","customer_id",
        "naics_value","naics_platform_name","naics_received_at",
        "naics_alt_values","naics_alt_platforms",
        "mcc_value","mcc_received_at",
        "mcc_found_value","mcc_found_received_at",
        "mcc_from_naics_value","mcc_from_naics_received_at",
        "mcc_platform_name",
    ]].copy()
    display["naics_status"] = df["naics_value"].apply(lambda v: validate_naics(v, naics_lookup)[0])
    display["mcc_status"]   = df["mcc_value"].apply(lambda v: validate_mcc(v, mcc_lookup)[0])
    display.columns = [
        "Business ID","Customer ID",
        "NAICS (Winner)","NAICS Platform","NAICS Received At",
        "NAICS Alt Values","NAICS Alt Platforms",
        "MCC (Final)","MCC Received At",
        "MCC AI","MCC AI Received At",
        "MCC NAICS-Derived","MCC NAICS-Derived Received At",
        "MCC Platform",
        "NAICS Status","MCC Status",
    ]
    st.dataframe(display, hide_index=True, use_container_width=True)
    st.download_button("⬇️ Download CSV", display.to_csv(index=False).encode(),
                       "cascade.csv","text/csv")
