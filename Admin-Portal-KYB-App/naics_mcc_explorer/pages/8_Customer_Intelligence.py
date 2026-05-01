"""Page 8 — Customer Intelligence: per paying-client NAICS/MCC analysis.

Data source: datascience.billing_prices (paying clients, non-null client column)
joined to rds_warehouse_public.facts via rel_business_customer_monitoring.

Analysis:
  1. Per-client winner + alternative platform distribution (NAICS)
  2. NAICS digit-length distribution — catches P0 truncation bugs (54161 vs 541612)
  3. Applicant input (P0) vs vendor alternatives — what did the business submit,
     what did ZoomInfo/Equifax/SERP return, and did they agree?
  4. Platform win share table with 561499 / null / digit-error rates per client
"""
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
    platform_label, platform_color, CATCH_ALL_NAICS,
    PLATFORM_MAP,
)
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import get_data, data_source_banner, enrich_with_business_name
from db.queries import (
    load_paying_clients,
    load_client_platform_distribution,
    load_client_naics_length,
    load_client_applicant_vs_vendor,
    _billing_cte,
)

st.set_page_config(page_title="Customer Intelligence", page_icon="👥", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]

st.markdown("# 👥 Customer Intelligence — Per Paying Client")
st.markdown(
    "NAICS/MCC quality broken down by **paying client** (`datascience.billing_prices`). "
    "All analysis scoped to businesses linked to clients with a non-null `client` name. "
    "Use the **Client filter** below to drill into a single client."
)
platform_legend_panel()
data_source_banner()
st.markdown("---")

# ── Client filter (paying clients only) ───────────────────────────────────────
with st.spinner("Loading paying clients…"):
    clients_df = get_data('paying_clients', date_from=f_from, date_to=f_to)

if clients_df.empty:
    no_data("No paying clients found via datascience.billing_prices for the selected date range.")
    st.stop()

client_options = ["All Paying Clients"] + clients_df["client"].tolist()
selected_client = st.selectbox("**Filter by Client Name**", client_options, key="ci_client")
client_filter = None if selected_client == "All Paying Clients" else selected_client

analyst_note(
    "About this view",
    f"Showing <strong>{len(clients_df):,} paying clients</strong> from "
    "<code>datascience.billing_prices</code> (non-null <code>client</code> column). "
    "These are the customers actively using Worth AI who are most likely to report "
    "NAICS/MCC classification complaints. The sidebar date range filters on "
    "<code>rel_business_customer_monitoring.created_at</code>.",
    level="info",
)
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# 1. PER-CLIENT WINNER PLATFORM DISTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🏆 Section 1 — Winner Platform Distribution by Client",
               "Which platform wins the NAICS confidence race for each paying client?")

with st.spinner("Loading platform distribution…"):
    dist_df = get_data('client_platform_distribution', date_from=f_from, date_to=f_to, client_name=client_filter)

if dist_df is None or dist_df.empty:
    no_data("No NAICS platform data found.")
else:
    dist_df["platform_name"] = dist_df["winning_platform_id"].apply(platform_label)
    dist_df["color"]         = dist_df["winning_platform_id"].apply(platform_color)

    if client_filter:
        # Single client: horizontal bar
        d = dist_df.sort_values("businesses", ascending=True)
        total = d["businesses"].sum()
        d["pct"] = (d["businesses"] / total * 100).round(1).astype(str) + "%"
        fig = go.Figure(go.Bar(
            x=d["businesses"], y=d["platform_name"], orientation="h",
            marker_color=d["color"].tolist(),
            hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
        ))
        fig.update_layout(
            height=max(240, len(d)*42+60), margin=dict(l=0,r=20,t=10,b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig, use_container_width=True, key="ci_dist_bar")
        st.dataframe(d[["platform_name","businesses","pct","avg_confidence","null_wins"]].rename(columns={
            "platform_name":"Platform","businesses":"Businesses","pct":"% Share",
            "avg_confidence":"Avg Confidence","null_wins":"Null Wins"
        }), hide_index=True, use_container_width=True,
        column_config={"Businesses": st.column_config.NumberColumn(format="%d"),
                       "Null Wins":  st.column_config.NumberColumn(format="%d"),
                       "Avg Confidence": st.column_config.NumberColumn(format="%.3f")})
    else:
        # All clients: stacked bar — pivot to client × platform
        pivot = dist_df.pivot_table(
            index="client", columns="platform_name", values="businesses", fill_value=0
        ).reset_index()
        pivot.columns.name = None
        pivot["Total"] = pivot.drop("client", axis=1).sum(axis=1)
        pivot = pivot.sort_values("Total", ascending=False)

        platform_cols = [c for c in pivot.columns if c not in ("client","Total")]
        fig = go.Figure()
        for pcol in platform_cols:
            pid = dist_df[dist_df["platform_name"]==pcol]["winning_platform_id"].iloc[0] if len(dist_df[dist_df["platform_name"]==pcol]) > 0 else "unknown"
            fig.add_trace(go.Bar(
                name=pcol, y=pivot["client"], x=pivot[pcol], orientation="h",
                marker_color=platform_color(pid),
                hovertemplate=f"<b>%{{y}}</b><br>{pcol}: %{{x:,}}<extra></extra>",
            ))
        fig.update_layout(
            barmode="stack",
            height=max(300, len(pivot)*48+60),
            margin=dict(l=0,r=20,t=10,b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b", title="Businesses"),
            yaxis=dict(showgrid=False),
            legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8"), orientation="h",
                        yanchor="bottom", y=1.02),
        )
        st.plotly_chart(fig, use_container_width=True, key="ci_dist_stacked")

        # ── Percentage breakdown table below the stacked bar ────────────────
        st.markdown("**Platform win share by client — percentage breakdown**")
        st.caption(
            "Each row = one client. Columns = platforms. Values = % of that client's "
            "NAICS assignments won by each platform. "
            "Red > 50% in any row = that client has a significant scoring configuration issue."
        )
        pct_pivot = dist_df.copy()
        client_totals = dist_df.groupby("client")["businesses"].sum().rename("total")
        pct_pivot = pct_pivot.merge(client_totals, on="client")
        pct_pivot["pct"] = (pct_pivot["businesses"] / pct_pivot["total"] * 100).round(1)
        pct_table = pct_pivot.pivot_table(
            index="client",
            columns="platform_name",
            values="pct",
            fill_value=0.0,
        ).reset_index()
        pct_table.columns.name = None
        pct_table["Total Businesses"] = pivot["Total"].values if len(pivot) == len(pct_table) else [
            dist_df[dist_df["client"]==c]["businesses"].sum() for c in pct_table["client"]
        ]
        pct_table = pct_table.sort_values("Total Businesses", ascending=False)
        pct_table.rename(columns={"client": "Client"}, inplace=True)

        # Move Total Businesses to second column
        cols_order = ["Client","Total Businesses"] + [
            c for c in pct_table.columns if c not in ("Client","Total Businesses")
        ]
        pct_table = pct_table[[c for c in cols_order if c in pct_table.columns]]

        # Build column_config with % format for platform cols
        pct_col_cfg = {"Total Businesses": st.column_config.NumberColumn(format="%d")}
        for col in pct_table.columns:
            if col not in ("Client","Total Businesses"):
                pct_col_cfg[col] = st.column_config.NumberColumn(format="%.1f%%")

        st.dataframe(pct_table, use_container_width=True, hide_index=True, column_config=pct_col_cfg)
        st.download_button(
            "⬇️ Download platform % table",
            pct_table.to_csv(index=False).encode(),
            "platform_pct_by_client.csv","text/csv", key="dl_pct_table"
        )

    analyst_note(
        "What this reveals per client",
        "Clients dominated by <strong>red (P0 Applicant Entry)</strong> have the worst data quality — "
        "self-reported onboarding data is winning over real vendors for most of their businesses. "
        "Clients dominated by <strong>blue/green (ZoomInfo/SERP/Equifax)</strong> have healthy pipelines. "
        "<strong>Grey (P-1 Calculated)</strong> dominating MCC facts is expected and normal.",
        level="info",
        bullets=[
            "P0 > 50% for a client = systemic arbitration bug exposure for that client",
            "AI (P31) in top 2 = vendor coverage gap; AI fallback running too often",
            "Null wins = P0 wrote null and locked out real data — worst quality outcome",
        ],
    )

    sql_panel("Winner platform by client",
              f"""\
{_billing_cte(f_from, f_to, client_filter)}\
SELECT c.client,
    COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'unknown') AS winning_platform_id,
    COUNT(DISTINCT f.business_id) AS businesses,
    AVG(CAST(COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS FLOAT)) AS avg_confidence,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL THEN 1 ELSE 0 END) AS null_wins
FROM rds_warehouse_public.facts f
JOIN clients c ON c.business_id = f.business_id
WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
GROUP BY c.client, winning_platform_id
ORDER BY c.client, businesses DESC""", key_suffix="ci_dist")
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# 2. NAICS DIGIT LENGTH DISTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🔢 Section 2 — NAICS Digit Length Distribution by Client",
               "Valid NAICS = exactly 6 digits. P0 often writes 5-digit integers (data type bug).")

with st.spinner("Loading digit length data…"):
    len_df = get_data('client_naics_length', date_from=f_from, date_to=f_to, client_name=client_filter)

if len_df is None or len_df.empty:
    no_data()
else:
    len_df["platform_name"] = len_df["winning_platform_id"].apply(platform_label)
    len_df["is_valid"]      = len_df["naics_length"] == "6"
    len_df["length_label"]  = len_df["naics_length"].apply(
        lambda v: "✅ 6 digits (valid)" if v == "6"
                  else ("⬜ null" if v == "null" else f"❌ {v} digits (invalid)")
    )

    # Heatmap-style table: clients × digit length
    pivot_len = len_df.pivot_table(
        index="client", columns="length_label", values="business_count",
        aggfunc="sum", fill_value=0
    ).reset_index()
    pivot_len.columns.name = None
    pivot_len["Total"] = pivot_len.drop("client", axis=1).sum(axis=1)

    # Add % valid column
    valid_col = next((c for c in pivot_len.columns if "6 digits" in c), None)
    if valid_col:
        pivot_len["% Valid (6-digit)"] = (pivot_len[valid_col] / pivot_len["Total"] * 100).round(1)

    pivot_len = pivot_len.sort_values("% Valid (6-digit)" if "% Valid (6-digit)" in pivot_len.columns else "Total", ascending=True)
    st.dataframe(pivot_len, use_container_width=True, hide_index=True,
                 column_config={"Total": st.column_config.NumberColumn(format="%d"),
                                "% Valid (6-digit)": st.column_config.NumberColumn(format="%.1f%%")})

    analyst_note(
        "Why digit length matters",
        "P0 (Applicant Entry) sometimes writes NAICS codes as raw integers without zero-padding. "
        "For example, a business in sector 54 (Professional Services) might submit "
        "<code>54161</code> (5 digits) instead of <code>541612</code> (6 digits). "
        "This is a data type inconsistency — the facts table expects a 6-digit string. "
        "A 5-digit winning value will fail the lookup in <code>core_naics_code</code> and "
        "also produce a wrong <code>mcc_code_from_naics</code>.",
        level="warning",
        bullets=[
            "5-digit codes: P0 integer overflow — leading zero dropped (e.g. 054161 → 54161)",
            "7+ digit codes: P0 appended extra characters from the form",
            "null: P0 wrote nothing — real vendor data was then locked out by confidence:1",
        ],
        action="Validate NAICS format in the onboarding form frontend before P0 writes the fact.",
    )
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# 3. APPLICANT (P0) INPUT vs VENDOR ALTERNATIVES
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🔍 Section 3 — Applicant Submission vs Vendor Alternatives",
               "What P0 (the business itself) submitted, vs what ZoomInfo/Equifax/SERP returned in alternatives[].")

with st.spinner("Loading applicant submission data…"):
    p0_df = get_data('client_applicant_vs_vendor', date_from=f_from, date_to=f_to, client_name=client_filter)

if p0_df is None or p0_df.empty:
    st.success("✅ No cases where the business's own submission won for the selected filters.")
else:
    st.info(f"Showing all **{len(p0_df):,} businesses** where the business's own submission won the NAICS score comparison.")

    # Parse alternatives from raw JSON
    def _parse_vendor_alts(raw):
        """Extract only trusted vendor alternatives (P17, P22, P24) with their values."""
        VENDOR_PIDS = {"17", "22", "24"}
        alts = parse_alternatives(raw)
        vendor_alts = [a for a in alts if a["alt_platform_id"] in VENDOR_PIDS]
        if not vendor_alts:
            return "", "", ""
        values  = " | ".join(str(a["alt_value"]) for a in vendor_alts)
        pids    = " | ".join(a["alt_platform"] for a in vendor_alts)
        confs   = " | ".join(str(a["alt_confidence"]) for a in vendor_alts)
        return values, pids, confs

    p0_df[["vendor_alt_values","vendor_alt_platforms","vendor_alt_confs"]] = p0_df["raw_json"].apply(
        lambda r: pd.Series(_parse_vendor_alts(r))
    )

    # Agreement analysis
    def _agreement(p0_val, vendor_vals):
        if not vendor_vals:
            return "no_vendor_data"
        p0 = str(p0_val).strip() if p0_val else ""
        vendor_list = [v.strip() for v in str(vendor_vals).split("|")]
        if not p0 or p0 in ("None","null",""):
            return "p0_null_vendor_has_data"
        if p0 in vendor_list:
            return "agree"
        # Check sector agreement (2-digit prefix)
        p0_sector = p0[:2]
        if any(v[:2] == p0_sector for v in vendor_list if len(v) >= 2):
            return "sector_agree_code_differ"
        return "full_disagree"

    p0_df["agreement"] = p0_df.apply(
        lambda r: _agreement(r["p0_winning_value"], r["vendor_alt_values"]), axis=1
    )

    # KPIs
    n_total        = len(p0_df)
    n_agree        = int((p0_df["agreement"]=="agree").sum())
    n_sector_agree = int((p0_df["agreement"]=="sector_agree_code_differ").sum())
    n_full_disagree= int((p0_df["agreement"]=="full_disagree").sum())
    n_p0_null      = int((p0_df["agreement"]=="p0_null_vendor_has_data").sum())
    n_no_vendor    = int((p0_df["agreement"]=="no_vendor_data").sum())

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("P0 Wins (total)", f"{n_total:,}", "", "#ef4444")
    with c2: kpi("✅ P0 = Vendor",  f"{n_agree:,}",
                 f"{100*n_agree/n_total:.1f}% — applicant was right", "#22c55e")
    with c3: kpi("~Same Sector",    f"{n_sector_agree:,}",
                 f"{100*n_sector_agree/n_total:.1f}% — sector matches, code differs", "#f59e0b")
    with c4: kpi("❌ Full Disagree", f"{n_full_disagree:,}",
                 f"{100*n_full_disagree/n_total:.1f}% — different sector entirely", "#ef4444")
    with c5: kpi("P0 null, vendor has data", f"{n_p0_null:,}",
                 f"{100*n_p0_null/n_total:.1f}% — worst: null beat real code", "#dc2626")

    analyst_note(
        "Interpreting agreement between applicant and vendor",
        "When P0 (the business itself) submits a NAICS code and vendors like ZoomInfo return a <em>different</em> code, "
        "one of them is wrong. We cannot know which without ground truth — but the pattern matters: "
        "<strong>full disagree at sector level</strong> is the most serious signal (e.g. "
        "applicant says sector 54 'Professional Services', ZoomInfo says sector 81 'Other Services'). "
        "The Employment Agency example in the complaint is exactly this — "
        "applicant may have submitted a Professional Services code instead of Employment Placement (561311).",
        level="warning",
        bullets=[
            "✅ P0 = Vendor: applicant submitted correctly AND it won — OK (but P0 shouldn't win)",
            "~Same Sector: correct broad industry, wrong specific code — minor misidentification",
            "❌ Full Disagree: completely different industry sector — high-impact misidentification",
            "P0 null + vendor has data: worst case — blank submission locked out correct vendor data",
        ],
        action="Fix sources.ts:148 confidence:1→0.1. This ensures vendor codes win over applicant submissions.",
    )

    # Display table
    display = p0_df[[
        "client","business_id","p0_winning_value","p0_confidence",
        "vendor_alt_values","vendor_alt_platforms","p0_updated_at","agreement"
    ]].copy()
    display.columns = [
        "Client","Business ID","P0 Submitted NAICS","P0 Confidence",
        "Vendor Alternatives","Vendor Platforms","Submission Last Updated","Agreement"
    ]
    st.dataframe(display, use_container_width=True, hide_index=True)
    st.download_button("⬇️ Download P0 vs Vendor data",
                       display.to_csv(index=False).encode(),
                       "p0_vs_vendor.csv","text/csv", key="dl_p0")

    sql_panel("P0 wins with vendor alternatives",
              f"""\
{_billing_cte(f_from, f_to, client_filter)}\
SELECT c.client, f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'value')                                AS p0_winning_value,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence')                  AS p0_confidence,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','updatedAt')                   AS p0_updated_at,
    f.received_at, f.value AS raw_json   -- parse alternatives[] in Python
FROM rds_warehouse_public.facts f
JOIN clients c ON c.business_id = f.business_id
WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
  AND COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'x') = '0'
ORDER BY f.received_at DESC LIMIT 500""", key_suffix="ci_p0")
