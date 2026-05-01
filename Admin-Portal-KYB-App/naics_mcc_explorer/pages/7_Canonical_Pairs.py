"""Page 7 — Canonical NAICS→MCC Mapping Analysis.

Checks every business's NAICS+MCC pair against rds_cases_public.rel_naics_mcc —
Worth's own canonical mapping table. A 'canonical pair' means the combination
is a known-valid NAICS→MCC mapping. Non-canonical pairs are wrong or unmapped.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import platform_label, platform_color
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner, enrich_with_business_name
from db.queries import (
    load_canonical_pair_status, load_canonical_pair_by_customer,
    load_canonical_pairs, _onboarded_cte,
)

st.set_page_config(page_title="Canonical Pairs", page_icon="🔗", layout="wide")
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

st.markdown("# 🔗 Industry-to-Payment Category Mapping Analysis")
st.markdown(
    "Worth AI maintains an **official mapping table** that defines which payment category codes (MCC) "
    "correspond to which industry codes (NAICS). "
    "When a business's industry code converts to a payment category through this table, the result is considered correct. "
    "When the combination is **not in the table** — either the industry code is wrong, or the AI assigned a different payment category directly — it's flagged for review."
)
platform_legend_panel()
data_source_banner()
st.markdown("---")

# ── Canonical mapping reference table ─────────────────────────────────────────
with st.expander("📚 View the official industry-to-payment-category mapping table"):
    with st.spinner("Loading mapping table…"):
        pairs_df = load_canonical_pairs()  # lookup table — always from Redshift
    if pairs_df is not None and not pairs_df.empty:
        st.caption(f"**{len(pairs_df):,} recognized industry + payment category combinations** in Worth's official mapping table")
        search = st.text_input("Search by NAICS or MCC code", "", key="pairs_search")
        if search:
            pairs_df = pairs_df[
                pairs_df["naics_code"].str.contains(search, na=False) |
                pairs_df["mcc_code"].str.contains(search, na=False) |
                pairs_df.get("naics_label", pd.Series(dtype=str)).str.contains(search, case=False, na=False) |
                pairs_df.get("mcc_label", pd.Series(dtype=str)).str.contains(search, case=False, na=False)
            ]
        st.dataframe(pairs_df, use_container_width=True, hide_index=True)
        st.download_button("⬇️ Download full mapping table",
                           pairs_df.to_csv(index=False).encode(),
                           "canonical_pairs.csv","text/csv", key="dl_pairs")
    else:
        no_data("Could not load rel_naics_mcc table.")

sql_panel("Canonical pairs lookup",
          """SELECT DISTINCT
    nc.code  AS naics_code,
    nc.label AS naics_label,
    mc.code  AS mcc_code,
    mc.label AS mcc_label
FROM rds_cases_public.rel_naics_mcc r
JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
WHERE nc.code IS NOT NULL AND mc.code IS NOT NULL
ORDER BY nc.code, mc.code""", key_suffix="pairs_ref")
st.markdown("---")

# ── Overall pair status ────────────────────────────────────────────────────────
section_header("📊 NAICS+MCC Pair Status — Overall",
               f"Period: {f_from} → {f_to}")

with st.spinner("Classifying NAICS+MCC pairs…"):
    status_df = get_data('canonical_pair_status', date_from=f_from, date_to=f_to, customer_id=f_cust, client_name=f_client, business_id=f_biz)

if status_df is None or status_df.empty:
    no_data("No NAICS/MCC facts found for the selected filters.")
    st.stop()

status_df["naics_platform_label"] = status_df["naics_platform"].apply(platform_label)

total = len(status_df)
summary = status_df["pair_status"].value_counts().reset_index()
summary.columns = ["Status","Count"]
summary["Pct"] = (summary["Count"] / total * 100).round(1).astype(str) + "%"

n_canonical  = int((status_df["pair_status"]=="Canonical Pair ✅").sum())
n_non_canon  = int((status_df["pair_status"]=="Non-Canonical Pair ⚠️").sum())
n_fallback   = int((status_df["pair_status"]=="Fallback / Invalid").sum())
n_naics_miss = int((status_df["pair_status"]=="NAICS Missing").sum())
n_mcc_miss   = int((status_df["pair_status"]=="MCC Missing").sum())

c1,c2,c3,c4,c5 = st.columns(5)
with c1: kpi("Total Businesses", f"{total:,}", color="#3b82f6")
with c2: kpi("✅ Canonical Pairs", f"{n_canonical:,}",
             f"{100*n_canonical/total:.1f}% — valid NAICS+MCC combination", "#22c55e")
with c3: kpi("⚠️ Non-Canonical", f"{n_non_canon:,}",
             f"{100*n_non_canon/total:.1f}% — NAICS+MCC not in mapping", "#f59e0b")
with c4: kpi("❌ Fallback/Invalid", f"{n_fallback:,}",
             f"{100*n_fallback/total:.1f}% — 561499 NAICS or 5614 MCC", "#ef4444")
with c5: kpi("⬜ Missing Code", f"{n_naics_miss + n_mcc_miss:,}",
             f"NAICS missing: {n_naics_miss:,} | MCC missing: {n_mcc_miss:,}", "#64748b")

analyst_note(
    "What these statuses mean",
    "Worth's official mapping table defines which industry code and payment category code belong together. "
    "When a business has both codes and they appear together in the table, the classification is correct. "
    "When they don't appear together, it means either the industry code is wrong, or the AI assigned a different payment category directly.",
    level="info",
    bullets=[
        "✅ <strong>Recognized combination</strong>: industry code + payment category appear together in the official mapping — classification is correct",
        "⚠️ <strong>Unrecognized combination</strong>: these two codes don't appear together in the mapping — investigate whether the industry code or payment category is wrong",
        "❌ <strong>Generic / Invalid</strong>: industry code is the generic placeholder (561499) or payment category is the invalid AI code (5614) — both need to be corrected",
        "⬜ <strong>Industry code missing</strong>: no industry code was assigned at all — usually because the business submitted a blank form field",
        "⬜ <strong>Payment category missing</strong>: industry code exists but payment category was never derived — usually because the industry code is not in the mapping table",
    ],
)

STATUS_COLORS_MAP = {
    "Canonical Pair ✅":     "#22c55e",
    "Non-Canonical Pair ⚠️": "#f59e0b",
    "Fallback / Invalid":    "#ef4444",
    "NAICS Missing":         "#64748b",
    "MCC Missing":           "#475569",
}

# ── Status breakdown table (no color column) ───────────────────────────────────
st.markdown("**Status breakdown**")
st.dataframe(
    summary[["Status", "Count", "Pct"]],   # ← explicitly exclude color column
    use_container_width=True,
    hide_index=True,
    column_config={"Count": st.column_config.NumberColumn(format="%d")},
)

sql_panel("Overall pair status classification",
          f"""\
{_onboarded_cte(f_from, f_to, f_cust)}\
, naics_f AS (
    SELECT f.business_id,
           JSON_EXTRACT_PATH_TEXT(f.value,'value') AS final_naics,
           COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS naics_platform
    FROM rds_warehouse_public.facts f JOIN onboarded o ON o.business_id=f.business_id
    WHERE f.name='naics_code' AND LENGTH(f.value)<60000
),
mcc_f AS (
    SELECT f.business_id, JSON_EXTRACT_PATH_TEXT(f.value,'value') AS final_mcc
    FROM rds_warehouse_public.facts f JOIN onboarded o ON o.business_id=f.business_id
    WHERE f.name='mcc_code' AND LENGTH(f.value)<60000
),
canonical_pairs AS (
    SELECT DISTINCT nc.code AS naics_code, mc.code AS mcc_code
    FROM rds_cases_public.rel_naics_mcc r
    JOIN rds_cases_public.core_naics_code nc ON nc.id=r.naics_id
    JOIN rds_cases_public.core_mcc_code   mc ON mc.id=r.mcc_id
)
SELECT
    CASE WHEN n.final_naics='561499' OR m.final_mcc='5614' THEN 'Fallback / Invalid'
         WHEN n.final_naics IS NULL OR n.final_naics=''    THEN 'NAICS Missing'
         WHEN m.final_mcc   IS NULL OR m.final_mcc=''      THEN 'MCC Missing'
         WHEN cp.naics_code IS NOT NULL                     THEN 'Canonical Pair'
         ELSE 'Non-Canonical Pair'
    END AS pair_status,
    COUNT(*) AS businesses,
    ROUND(100.0*COUNT(*)/SUM(COUNT(*)) OVER(),2) AS pct
FROM naics_f n
LEFT JOIN mcc_f m ON m.business_id=n.business_id
LEFT JOIN canonical_pairs cp ON cp.naics_code=n.final_naics AND cp.mcc_code=m.final_mcc
GROUP BY 1 ORDER BY businesses DESC""", key_suffix="pair_overall")
st.markdown("---")

# ── By customer ────────────────────────────────────────────────────────────────
section_header("👥 Canonical Pair Status by Customer",
               "Each row = one customer. Sorted by Canonical % ascending (worst first). "
               "Linked to sidebar date filter; select a specific customer in the sidebar to drill in.")

with st.spinner("Loading per-customer pair status…"):
    by_cust = get_data('canonical_pair_by_customer', date_from=f_from, date_to=f_to)

if by_cust is None or by_cust.empty:
    no_data("Could not load per-customer canonical pair data.")
else:
    # Pivot: one row per customer, one column per status
    pivot = by_cust.pivot_table(
        index=["customer_id", "customer_name"],
        columns="pair_status",
        values="businesses",
        aggfunc="sum",
        fill_value=0,
    ).reset_index()
    pivot.columns.name = None

    # Totals and canonical %
    status_cols = [c for c in pivot.columns if c not in ("customer_id", "customer_name")]
    pivot["Total"] = pivot[status_cols].sum(axis=1)
    canonical_col = next((c for c in pivot.columns if "Canonical Pair" in c and "Non" not in c), None)
    pivot["Canonical %"] = (
        (pivot[canonical_col] / pivot["Total"] * 100).round(1)
        if canonical_col else 0.0
    )
    pivot = pivot.sort_values("Canonical %", ascending=True)

    # If sidebar has a customer selected, filter the table
    if f_cust:
        pivot = pivot[pivot["customer_id"] == f_cust]

    # Build display: customer_name | Canonical % | Total | one col per status (no customer_id, no color)
    ordered_status = [
        "Canonical Pair ✅", "Non-Canonical Pair ⚠️",
        "Fallback / Invalid", "NAICS Missing", "MCC Missing",
    ]
    display_cols = ["customer_name", "Total", "Canonical %"] + [
        c for c in ordered_status if c in pivot.columns
    ]
    display_cols = [c for c in display_cols if c in pivot.columns]
    display_df = pivot[display_cols].copy()
    display_df.rename(columns={"customer_name": "Customer"}, inplace=True)

    col_cfg = {"Total": st.column_config.NumberColumn(format="%d"),
               "Canonical %": st.column_config.NumberColumn(format="%.1f%%")}
    for sc in ordered_status:
        if sc in display_df.columns:
            col_cfg[sc] = st.column_config.NumberColumn(format="%d")

    st.dataframe(display_df, use_container_width=True, hide_index=True, column_config=col_cfg)

    analyst_note(
    "How to read this table",
    "Each row is one customer. <strong>Canonical %</strong> = % of that customer's businesses "
    "with a correctly recognized industry + payment category combination. "
    "Sorted with the worst quality at the top. "
    "Customers with high unrecognized or generic/invalid counts are most likely to receive classification complaints.",
    level="info",
    bullets=[
        "Low Canonical % → many of this customer's businesses have mismatched or wrong codes",
        "High 'Industry code missing' → blank form submissions are overriding real vendor data for this customer",
        "High 'Generic / Invalid' → the generic placeholder code (561499) is dominating this customer's portfolio",
    ],
    )

    st.download_button(
        "⬇️ Download by-customer table",
        display_df.to_csv(index=False).encode(),
        "canonical_by_customer.csv", "text/csv", key="dl_cust_pairs",
    )

st.markdown("---")

# ── Non-canonical detail table ──────────────────────────────────────────────────
section_header("📋 Non-Canonical & Fallback Business Detail")

non_canon = status_df[
    status_df["pair_status"].isin(["Non-Canonical Pair ⚠️","Fallback / Invalid"])
].copy()

if non_canon.empty:
    st.success("✅ No unrecognized or invalid combinations found for the selected filters.")
else:
    st.info(f"Showing {len(non_canon):,} businesses with unrecognized combinations or generic/invalid codes.")
    disp = non_canon[[
        "business_id","final_naics","naics_platform_label","final_mcc","pair_status"
    ]].copy()
    disp.columns = ["Business ID","NAICS (Winner)","NAICS Platform","MCC (Final)","Status"]
    st.dataframe(disp, use_container_width=True, hide_index=True)
    st.download_button("⬇️ Download non-canonical list",
                       disp.to_csv(index=False).encode(),
                       "non_canonical.csv","text/csv", key="dl_noncanon")

    analyst_note(
        "What to do with non-canonical pairs",
        "Non-canonical pairs fall into two root causes:",
        level="warning",
        bullets=[
            "<strong>Wrong NAICS</strong>: P0 (Ghost Assigner) won with a bad value → MCC was derived from wrong input → "
            "fix is to repair NAICS (sources.ts confidence fix), which will auto-correct MCC on next facts refresh",
            "<strong>AI MCC override</strong>: AI <code>mcc_code_found</code> returned a valid but different MCC than "
            "the canonical mapping would produce from the NAICS → investigate whether the AI MCC is actually correct "
            "(may be more accurate than the canonical table mapping)",
            "<strong>Unmapped NAICS</strong>: A valid NAICS code that has no entry in rel_naics_mcc → "
            "the canonical table may need to be extended with new mappings",
        ],
    )
