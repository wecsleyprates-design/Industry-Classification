"""Page 3 — NAICS Code Validity Analysis with alternatives + SQL runner."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data, parse_alternatives
from utils.platform_map import platform_label, platform_color, CATCH_ALL_NAICS
from utils.validators import validate_naics, STATUS_COLORS, STATUS_ICONS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner, enrich_with_business_name
from db.queries import load_naics_lookup, _onboarded_cte

st.set_page_config(page_title="NAICS Validity", page_icon="🔢", layout="wide")
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

st.markdown("# 🔢 NAICS Code Validity Analysis")
st.markdown(
    "Validates every winning industry code (NAICS) in two steps: "
    "**Step 1 — format check** (must be exactly 6 digits, numbers only), "
    "**Step 2 — reference check** (must exist in Worth's official industry code list). "
    "Also shows the values that other data sources submitted but didn't win — useful for spotting cases where a valid code existed but was overridden."
)
platform_legend_panel()
data_source_banner()
st.markdown("---")

with st.spinner("Loading NAICS facts…"):
    df = get_data('naics_facts', date_from=f_from, date_to=f_to, customer_id=f_cust, client_name=f_client, business_id=f_biz)
with st.spinner("Loading NAICS lookup…"):
    naics_lookup = load_naics_lookup()

if df.empty:
    from utils.sql_runner import analyst_note as _an
    _an(
        "No NAICS data available — what this means",
        "The local cache exists but returned no NAICS facts for this page. "
        "This is almost always because the cache was built before the "
        "<code>business_name</code> column was added to the schema, and a "
        "<code>LEFT JOIN businesses b ON b.business_name</code> query is failing silently.<br><br>"
        "<strong>Fix:</strong> Re-run the cache refresh script to rebuild with the current schema.",
        level="warning",
        action="Run: python3 scripts/refresh_facts_cache.py  (from naics_mcc_explorer/ folder)",
    )
    st.stop()

# Resolve platform display
df["eff_pid"] = df.apply(
    lambda r: r["platform_id"] if str(r["platform_id"]) not in ("unknown","","None")
              else (r.get("legacy_source_name") or "unknown"), axis=1
).astype(str)
df["platform_name"] = df["eff_pid"].apply(platform_label)
df[["validity_status","validity_reason"]] = df["naics_value"].apply(
    lambda v: pd.Series(validate_naics(v, naics_lookup))
)
df["status_icon"] = df["validity_status"].map(STATUS_ICONS)

# Parse alternatives from raw_json
def _alt_summary(raw):
    alts = parse_alternatives(raw)
    if not alts: return "", "", ""
    vals  = " | ".join(str(a["alt_value"]) for a in alts)
    pids  = " | ".join(a["alt_platform"] for a in alts)
    confs = " | ".join(str(a["alt_confidence"]) for a in alts)
    return vals, pids, confs

df[["alt_values","alt_platforms","alt_confidences"]] = df["raw_json"].apply(
    lambda r: pd.Series(_alt_summary(r))
)

total = len(df)
status_counts = df["validity_status"].value_counts()
def sc(k): return int(status_counts.get(k, 0))

n_valid, n_ca, n_not_lk, n_inv, n_null = sc("valid"), sc("catch_all"), sc("not_in_lookup"), sc("invalid_format"), sc("null")
n_p0_null = int(((df["eff_pid"]=="0") & (df["naics_value"].isna() | (df["naics_value"].astype(str).str.strip()==""))).sum())

# ── KPIs ──────────────────────────────────────────────────────────────────────
section_header("📊 Validity Summary")
cols = st.columns(6)
for col, (label, val, sub, color) in zip(cols, [
    ("Total NAICS Facts", total, "", "#3b82f6"),
    ("✅ Valid",          n_valid,  f"{100*n_valid/total:.1f}%",  "#22c55e"),
    ("⚠️ Catch-all 561499", n_ca, f"{100*n_ca/total:.1f}%",      "#f59e0b"),
    ("🟠 Not in Lookup",  n_not_lk, f"{100*n_not_lk/total:.1f}%","#f97316"),
    ("❌ Invalid Format", n_inv,    f"{100*n_inv/total:.1f}%",    "#ef4444"),
    ("⬜ Null Winner",    n_null,   f"P0 null wins: {n_p0_null}", "#64748b"),
]):
    with col: kpi(label, f"{val:,}", sub, color)

analyst_note(
    "How to interpret NAICS validity",
    "A <strong>valid</strong> NAICS code is a 6-digit number present in <code>rds_cases_public.core_naics_code</code>. "
    "Anything else is a data quality failure with different severity levels.",
    level="info",
    bullets=[
        "✅ <strong>Valid</strong>: correct format, in lookup table — pipeline working",
        "⚠️ <strong>Generic placeholder (561499)</strong>: valid format, recognized code, but it means 'we don't know what this business does' — assigned when no specific industry could be identified. High volume here signals the data scoring problem.",
        "🟠 <strong>Not in lookup</strong>: 6-digit number but not a recognized NAICS code — likely a typo or invented value",
        "❌ <strong>Invalid format</strong>: wrong number of digits, non-numeric, or truncated — data corruption",
        "⬜ <strong>Null winner</strong>: platform won arbitration but wrote null — no usable classification at all",
    ],
)

# ── Validity bar chart ────────────────────────────────────────────────────────
section_header("📊 Validity Category Breakdown")
cat_df = pd.DataFrame({
    "Category": ["✅ Valid","⚠️ Generic placeholder (561499)","🟠 Not in reference list","❌ Wrong format","⬜ Missing"],
    "Count": [n_valid, n_ca, n_not_lk, n_inv, n_null],
    "Color": [STATUS_COLORS["valid"], STATUS_COLORS["catch_all"],
              STATUS_COLORS["not_in_lookup"], STATUS_COLORS["invalid_format"], STATUS_COLORS["null"]],
}).sort_values("Count", ascending=True)

fig = go.Figure(go.Bar(
    x=cat_df["Count"], y=cat_df["Category"], orientation="h",
    marker_color=cat_df["Color"].tolist(),
    text=cat_df["Count"].apply(lambda v: f"{v:,}"), textposition="outside",
    hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
))
fig.update_layout(height=260, margin=dict(l=0,r=80,t=10,b=0),
                  paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
                  xaxis=dict(showgrid=True, gridcolor="#1e293b"), yaxis=dict(showgrid=False))
st.plotly_chart(fig, use_container_width=True, key="naics_validity_bar")

sql_panel("NAICS Validity Counts",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT
    JSON_EXTRACT_PATH_TEXT(f.value,'value')                                       AS naics_value,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown')     AS platform_id,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0')           AS confidence,
    f.received_at
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
ORDER BY f.business_id""", key_suffix="naics_val")

with st.expander("📖 Wrong vs Invalid — what's the difference?"):
    st.markdown(f"""
| Category | Count | Detectable automatically? | Action |
|---|---|---|---|
| **Invalid format** | {n_inv:,} | ✅ Yes | Immediate pipeline fix |
| **Not in lookup** | {n_not_lk:,} | ✅ Yes | Validate against NAICS taxonomy |
| **Catch-all 561499** | {n_ca:,} | ✅ Yes | Re-enrichment (NAICS is technically valid but useless) |
| **Null** | {n_null:,} | ✅ Yes | Re-enrichment or fix P0 confidence bug |
| **Wrong but valid** | Unknown | ❌ No — needs business context | Manual review or AI cross-check |

**Key insight:** Fix invalid + null first. A wrong *valid* code (e.g. `811111` for a dentist) is harder to detect but causes the same downstream MCC corruption.
    """)

st.markdown("---")

# ── Records table with alternatives ───────────────────────────────────────────
section_header("📋 All NAICS Records — Winner + Alternatives",
               "Includes winning value, all alternative platform values, and their received timestamps.")

status_filter = st.multiselect("Filter by status",
    options=df["validity_status"].unique().tolist(),
    default=df["validity_status"].unique().tolist(), key="naics_sf")
filtered = df[df["validity_status"].isin(status_filter)] if status_filter else df

display = filtered[[
    "business_id","customer_id","naics_value","platform_name","confidence",
    "winner_updated_at","status_icon","validity_status","validity_reason",
    "alt_values","alt_platforms","alt_confidences",
]].copy()
display.columns = [
    "Business ID","Customer ID","NAICS (Winner)","Winning Platform","Confidence",
    "Last Updated (source.updatedAt)","","Status","Reason",
    "Alternative Values","Alternative Platforms","Alt Confidences",
]

display = enrich_with_business_name(display, 'Business ID') if 'Business ID' in display.columns else enrich_with_business_name(display)
st.dataframe(display, use_container_width=True, hide_index=True,
             column_config={"Confidence": st.column_config.NumberColumn(format="%.3f"),
                            "Last Updated (source.updatedAt)": st.column_config.TextColumn()})

analyst_note(
    "How to read the alternatives columns",
    "The <strong>Alternative Values</strong> column shows the NAICS codes that <em>other platforms</em> returned "
    "for this business — separated by <code>|</code>. These are the values that other data sources returned "
    "but that didn't win the score comparison. "
    "If the winner is <em>blank</em> (from the business's own submission) but another source shows a valid 6-digit code from ZoomInfo, "
    "that is direct evidence that a valid industry code existed but was overridden.",
    level="warning",
)

st.download_button("⬇️ Download CSV", display.to_csv(index=False).encode(),
                   "naics_validity.csv","text/csv")
st.markdown("---")

# ── P0 null wins ──────────────────────────────────────────────────────────────
section_header("⬜ Blank Submissions Overriding Real Data")
p0_null_df = df[(df["eff_pid"]=="0") & (df["naics_value"].isna() | (df["naics_value"].astype(str).str.strip()==""))].copy()
if p0_null_df.empty:
    st.success("✅ No cases of blank submissions overriding real data found.")
else:
    st.warning(f"⚠️ **{len(p0_null_df):,} businesses** have no industry code — the business submitted a blank form field, "
               "which overrode real data from ZoomInfo, SERP, or Equifax. "
               "Check the 'Alternative Values' column to see what the data vendors actually returned.")
    disp = p0_null_df[["business_id","customer_id","confidence","winner_updated_at","alt_values","alt_platforms"]].copy()
    disp.columns = ["Business ID","Customer ID","Submission Score","Last Updated","Other Sources' Values","Other Sources"]
    st.dataframe(disp, use_container_width=True, hide_index=True)
    analyst_note("Why these businesses have null NAICS",
        "When a business leaves the industry field blank on the onboarding form, the system records that blank submission "
        "with the highest possible score (1.0). Because it has the highest score, it wins over ZoomInfo and SERP — even though it contains nothing. "
        "Check the <strong>Other Sources' Values</strong> column to see the real industry codes that were available but didn't win.",
        level="danger",
        action="Fix `sources.ts:151` confidence from 1 to 0.1. Then trigger a facts refresh for these business IDs.")

sql_panel("P0 Null Wins",
          f"""{_onboarded_cte(f_from, f_to, f_cust, f_biz)}
SELECT f.business_id, o.customer_id,
       JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') AS p0_confidence,
       f.received_at, f.value AS raw_json
FROM rds_warehouse_public.facts f
JOIN onboarded o ON o.business_id = f.business_id
WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
  AND COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'x') = '0'
  AND JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL
ORDER BY f.received_at DESC""", key_suffix="p0null_naics")
