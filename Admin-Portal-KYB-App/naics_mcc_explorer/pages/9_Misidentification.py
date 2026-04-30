"""Page 9 — Classification Accuracy & Misidentification Analysis.

The core challenge: we do not have ground truth for NAICS classification.
We use PROXY ERROR SIGNALS to estimate misidentification rates:

Signal 1 — Ghost Assigner Override (P0 won, vendor disagrees):
  P0 wins with a value different from what trusted vendors (P24/P17/P22) returned.
  This is not necessarily wrong (the applicant may know their industry better),
  but when P0 wins with NULL or a catch-all, it is definitively wrong.

Signal 2 — Vendor Consensus vs Winner Mismatch:
  Multiple trusted vendors agree on a code, but the winner is different.
  High confidence that the winner is wrong when 2+ vendors agree on something else.

Signal 3 — Sector-Level Disagreement (the Employment Agency problem):
  Winner's 2-digit NAICS sector ≠ sector of alternatives.
  Example: winner = 541612 (sector 54 = Professional Services)
           alternative = 561311 (sector 56 = Admin/Support/Employment Services)
  This is the "confused about Professional Services" complaint.

Signal 4 — Format Errors:
  Not 6 digits = definitive data pipeline error, not just potential wrong code.

Signal 5 — Catch-all with Specific Alternatives:
  Winner = 561499 (catch-all) but alternatives have specific, valid codes.
  Real codes existed but were suppressed.

Error rate by platform is the % of that platform's wins that carry one or more signals.
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
from utils.platform_map import platform_label, platform_color, CATCH_ALL_NAICS
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.queries import (
    load_misidentification_signals,
    load_platform_error_rate_by_client,
    load_sector_mismatch_by_client,
    _billing_cte,
)

# 2-digit NAICS sector names for readability
NAICS_SECTORS = {
    "11":"Agriculture","21":"Mining","22":"Utilities","23":"Construction",
    "31":"Manufacturing","32":"Manufacturing","33":"Manufacturing",
    "42":"Wholesale Trade","44":"Retail Trade","45":"Retail Trade",
    "48":"Transportation","49":"Transportation","51":"Information",
    "52":"Finance & Insurance","53":"Real Estate","54":"Professional Services",
    "55":"Management","56":"Admin/Support/Employment","61":"Education",
    "62":"Health Care","71":"Arts & Entertainment","72":"Accommodation & Food",
    "81":"Other Services","92":"Public Administration",
    "??":"Unknown/Missing","56":"Admin/Support/Employment Svcs",
}

st.set_page_config(page_title="Misidentification", page_icon="🎯", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from, f_to = filters["date_from"], filters["date_to"]
f_cust = filters["customer_id"]

st.markdown("# 🎯 Classification Accuracy & Misidentification Analysis")
st.markdown(
    "Quantifies **proxy signals** for NAICS misidentification across paying clients. "
    "We cannot know the 'correct' NAICS without ground truth — but we can detect "
    "cases where the winner conflicts with trusted vendor data, uses catch-alls, "
    "or has digit format errors. The **Employment Agency example** (541612 vs 561311) "
    "is a sector-level disagreement — captured in Signal 3 below."
)
platform_legend_panel()

# ── Client filter ─────────────────────────────────────────────────────────────
from db.queries import load_paying_clients
with st.spinner("Loading paying clients…"):
    clients_df = load_paying_clients(f_from, f_to)

client_options = ["All Paying Clients"] + (clients_df["client"].tolist() if not clients_df.empty else [])
selected_client = st.selectbox("**Filter by Client Name**", client_options, key="mis_client")
client_filter = None if selected_client == "All Paying Clients" else selected_client
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# PROXY SIGNAL DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════
with st.expander("📖 Proxy Error Signal Definitions — How we detect misidentification"):
    st.markdown("""
| Signal | Name | Definition | Severity |
|---|---|---|---|
| S1 | **Blank winner** | Business submitted a blank form field and it won — no industry code assigned | 🔴 Critical |
| S2 | **Wrong format** | Winning code is not a valid 6-digit number (e.g. `54161`, `0`, text) | 🔴 Critical |
| S3 | **Generic placeholder won** | Winner = `561499` (the AI's last resort when it doesn't know) — not useful for risk decisioning | 🟠 High |
| S4 | **Form overrides vendors** | Business's form submission won AND external providers (ZoomInfo/Equifax/SERP) had a *different* code | 🟠 High |
| S5 | **Wrong industry sector** | Winner's broad industry (2-digit category) is completely different from what all external providers suggested — like the Employment Agency vs Professional Services case | 🔴 Critical |
| S6 | **Multiple vendors agree, but their code wasn't used** | 2+ external providers returned the same code, but the winner is something different | 🟡 Medium |
| S7 | **Generic placeholder, but specific code was available** | Winner = 561499 but external providers had specific valid codes | 🟠 High |

**Example: Employment Agency complaint**
- Business expected: `561311` (Employment Placement Agencies, sector 56)
- Got instead: `541612` (HR Consulting Services, sector 54)
- This triggers **Signal S5 (Sector Mismatch)** — sector 54 ≠ sector 56
- Root cause: P0 may have submitted a sector-54 code, or ZoomInfo returned sector 54,
  but the business actually operates as an employment agency (sector 56).
    """)

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: PLATFORM ERROR RATE BY CLIENT
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📊 Section 1 — Platform Error Rate by Client",
               "% of each platform's wins that carry null, catch-all, or digit-format flags (S1+S2+S3).")

with st.spinner("Loading error rate data…"):
    err_df = load_platform_error_rate_by_client(f_from, f_to, client_filter)

if err_df is None or err_df.empty:
    no_data()
else:
    err_df["platform_name"] = err_df["winning_platform_id"].apply(platform_label)
    err_df["color"]         = err_df["winning_platform_id"].apply(platform_color)

    # Heatmap: client × platform, value = flag_pct
    pivot_err = err_df.pivot_table(
        index="client", columns="platform_name", values="flag_pct",
        aggfunc="mean", fill_value=0
    ).reset_index()
    pivot_err.columns.name = None

    # Color scale: 0% = green, 100% = red
    platform_cols = [c for c in pivot_err.columns if c != "client"]
    if platform_cols:
        fig_heat = go.Figure(go.Heatmap(
            z=pivot_err[platform_cols].values,
            x=platform_cols,
            y=pivot_err["client"].tolist(),
            colorscale=[[0,"#22c55e"],[0.3,"#f59e0b"],[1,"#ef4444"]],
            zmin=0, zmax=100,
            text=pivot_err[platform_cols].applymap(lambda v: f"{v:.0f}%").values,
            texttemplate="%{text}",
            hovertemplate="<b>%{y}</b> × <b>%{x}</b><br>Flag rate: %{z:.1f}%<extra></extra>",
            colorbar=dict(title="Flag %", ticksuffix="%"),
        ))
        fig_heat.update_layout(
            height=max(300, len(pivot_err)*44+80),
            margin=dict(l=0,r=0,t=10,b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(side="top"),
        )
        st.plotly_chart(fig_heat, use_container_width=True, key="mis_err_heat")

    analyst_note(
        "How to read the error rate heatmap",
        "Each cell = % of that platform's wins for that client that are flagged as "
        "null, catch-all (561499), or wrong digit length. "
        "<strong>Green = low flag rate (good quality)</strong>. "
        "<strong>Red = high flag rate (systemic problem)</strong>. "
        "P0 (Applicant Entry) is expected to have a high rate — it writes null when "
        "businesses leave the industry field blank. P31 (AI) often shows high catch-all rates. "
        "ZoomInfo (P24) flagged cells are more serious — vendor should not produce catch-alls.",
        level="info",
        bullets=[
            "P0 red cell = many businesses left industry blank on the onboarding form for that client",
            "AI (P31) yellow/orange = AI fallback running often; no real vendors covering this client",
            "ZoomInfo (P24) non-green = ZoomInfo coverage problem for this specific client's portfolio",
        ],
    )

    # Summary table
    err_summary = err_df.groupby(["client","platform_name"]).agg(
        total_wins=("total_wins","sum"),
        flagged=("flagged_wins","sum"),
    ).reset_index()
    err_summary["flag_pct"] = (err_summary["flagged"] / err_summary["total_wins"] * 100).round(1)
    err_summary = err_summary.sort_values(["client","total_wins"], ascending=[True,False])
    err_summary.columns = ["Client","Platform","Total Wins","Flagged Wins","Flag %"]
    st.dataframe(err_summary, use_container_width=True, hide_index=True,
                 column_config={"Total Wins": st.column_config.NumberColumn(format="%d"),
                                "Flagged Wins": st.column_config.NumberColumn(format="%d"),
                                "Flag %": st.column_config.NumberColumn(format="%.1f%%")})
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: SECTOR MISMATCH (THE EMPLOYMENT AGENCY PROBLEM)
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🏭 Section 2 — Industry Sector Distribution by Client",
               "Which 2-digit NAICS sectors dominate each client's portfolio? "
               "Concentration in sector 54 (Professional Services) for a staffing client = misidentification signal.")

with st.spinner("Loading sector distribution…"):
    sector_df = load_sector_mismatch_by_client(f_from, f_to, client_filter)

if sector_df is None or sector_df.empty:
    no_data()
else:
    sector_df["sector_name"] = sector_df["winning_sector"].map(NAICS_SECTORS).fillna("Other")
    sector_df["sector_label"]= sector_df["winning_sector"] + " — " + sector_df["sector_name"]
    sector_df["catchall_pct"]= (sector_df["catchall_count"] / sector_df["businesses"] * 100).round(1)

    if client_filter:
        d = sector_df.sort_values("businesses", ascending=True)
        fig_sec = go.Figure(go.Bar(
            x=d["businesses"], y=d["sector_label"], orientation="h",
            marker_color=[
                "#f59e0b" if v=="56" else "#ef4444" if v=="??" else "#3b82f6"
                for v in d["winning_sector"]
            ],
            hovertemplate="<b>%{y}</b><br>Businesses: %{x:,}<extra></extra>",
        ))
        fig_sec.update_layout(
            height=max(300, len(d)*36+60), margin=dict(l=0,r=20,t=10,b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_sec, use_container_width=True, key="mis_sector_bar")
    else:
        # Top 10 sectors for all clients combined
        top_sectors = (
            sector_df.groupby("sector_label")["businesses"].sum()
                     .sort_values(ascending=False).head(15).reset_index()
        )
        fig_sec = go.Figure(go.Bar(
            x=top_sectors["businesses"], y=top_sectors["sector_label"], orientation="h",
            marker_color="#3b82f6",
            hovertemplate="<b>%{y}</b><br>Total businesses: %{x:,}<extra></extra>",
        ))
        fig_sec.update_layout(
            height=500, margin=dict(l=0,r=20,t=10,b=0),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_sec, use_container_width=True, key="mis_sector_bar_all")

    # Client × sector pivot
    sector_pivot = sector_df.pivot_table(
        index="client", columns="sector_label", values="businesses",
        aggfunc="sum", fill_value=0
    ).reset_index()
    sector_pivot.columns.name = None
    st.dataframe(sector_pivot, use_container_width=True, hide_index=True)

    analyst_note(
        "The Employment Agency problem — sector 54 vs sector 56",
        "The complaint: a business expected NAICS <strong>561311</strong> "
        "(Employment Placement Agencies, sector 56 = Admin/Support/Employment) "
        "but received <strong>541612</strong> "
        "(HR Consulting Services, sector 54 = Professional Services). "
        "These two sectors are semantically adjacent — an employment agency can appear to "
        "provide 'HR consulting' from some data sources. "
        "This is a <strong>sector-level misidentification</strong>.",
        level="danger",
        bullets=[
            "If a client's portfolio has unusually high sector 54 concentration and low sector 56 → investigation needed",
            "The distinction matters: sector 56 (Admin/Support) has different MCC codes (7361=Employment Agencies) "
            "vs sector 54 (Professional) which maps to 7389/8742",
            "Root cause is often ZoomInfo firmographic data describing the function (HR) vs the industry (Staffing)",
            "Fix: implement NAICS override mechanism in the Admin Portal for analyst corrections",
        ],
    )

    sql_panel("Sector distribution query",
              f"""\
{_billing_cte(f_from, f_to, client_filter)}\
SELECT c.client,
    LEFT(COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'value'),'??'), 2) AS winning_sector,
    COUNT(DISTINCT f.business_id) AS businesses,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value')='561499' THEN 1 ELSE 0 END) AS catchall_count
FROM rds_warehouse_public.facts f
JOIN clients c ON c.business_id = f.business_id
WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NOT NULL
GROUP BY c.client, winning_sector
ORDER BY c.client, businesses DESC""", key_suffix="mis_sector")
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: SIGNAL 4/5 — GHOST OVERRIDE + SECTOR MISMATCH (alternatives)
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🔬 Section 3 — Deep Misidentification Signals (Ghost Override + Sector Mismatch)",
               "Per-business: detect where the winner conflicts with vendor alternatives at sector level.")

with st.spinner("Loading misidentification signals…"):
    sig_df = load_misidentification_signals(f_from, f_to, client_filter)

if sig_df is None or sig_df.empty:
    no_data()
else:
    sig_df["platform_name"] = sig_df["winning_platform_id"].apply(platform_label)

    # Parse alternatives and compute signals
    def _compute_signals(row):
        raw  = row.get("raw_json","")
        alts = parse_alternatives(raw)
        winning_naics  = str(row.get("winning_naics","")).strip()
        winning_sector = winning_naics[:2] if len(winning_naics) >= 2 else "??"
        winning_pid    = str(row.get("winning_platform_id",""))
        VENDOR_PIDS    = {"17","22","24"}

        vendor_alts    = [a for a in alts if a["alt_platform_id"] in VENDOR_PIDS]
        vendor_values  = [str(a["alt_value"]).strip() for a in vendor_alts if a["alt_value"]]
        vendor_sectors = {v[:2] for v in vendor_values if len(v) >= 2}
        vendor_str     = " | ".join(f"{a['alt_value']} ({a['alt_platform']})" for a in vendor_alts) if vendor_alts else ""

        signals = []
        # S1: null winner
        if not winning_naics or winning_naics in ("None","null",""):
            signals.append("S1:null_winner")
        # S2: format error
        elif len(winning_naics) != 6 or not winning_naics.isdigit():
            signals.append("S2:format_error")
        # S3: catch-all
        if winning_naics in CATCH_ALL_NAICS:
            signals.append("S3:catchall_winner")
        # S4: ghost override
        if winning_pid == "0" and vendor_values and winning_naics not in vendor_values:
            signals.append("S4:ghost_override")
        # S5: sector mismatch
        if vendor_sectors and winning_sector and winning_sector not in vendor_sectors:
            signals.append("S5:sector_mismatch")
        # S6: vendor consensus ignored
        from collections import Counter
        if len(vendor_values) >= 2:
            most_common = Counter(vendor_values).most_common(1)[0]
            if most_common[1] >= 2 and most_common[0] != winning_naics:
                signals.append("S6:vendor_consensus_ignored")
        # S7: catch-all with specific alt
        if winning_naics in CATCH_ALL_NAICS and any(
            v not in CATCH_ALL_NAICS and len(v)==6 and v.isdigit() for v in vendor_values
        ):
            signals.append("S7:catchall_w_specific_alt")

        return "|".join(signals) if signals else "ok", vendor_str

    sig_df[["signals","vendor_alts_str"]] = sig_df.apply(
        lambda r: pd.Series(_compute_signals(r)), axis=1
    )

    total_biz  = len(sig_df)
    n_flagged  = int((sig_df["signals"] != "ok").sum())
    n_sector   = int(sig_df["signals"].str.contains("S5").sum())
    n_ghost    = int(sig_df["signals"].str.contains("S4").sum())
    n_null     = int(sig_df["signals"].str.contains("S1").sum())
    n_catchall = int(sig_df["signals"].str.contains("S3").sum())
    n_consensus= int(sig_df["signals"].str.contains("S6").sum())

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Total Businesses", f"{total_biz:,}", "", "#3b82f6")
    with c2: kpi("Any Signal Flagged", f"{n_flagged:,}",
                 f"{100*n_flagged/total_biz:.1f}% — any proxy error", "#f97316")
    with c3: kpi("S5: Sector Mismatch", f"{n_sector:,}",
                 f"{100*n_sector/total_biz:.1f}% — Employment Agency type", "#ef4444")
    with c4: kpi("S4: Ghost Override", f"{n_ghost:,}",
                 f"{100*n_ghost/total_biz:.1f}% — P0 beat vendor", "#ef4444")
    with c5: kpi("S6: Consensus Ignored", f"{n_consensus:,}",
                 f"{100*n_consensus/total_biz:.1f}% — 2+ vendors agreed, winner different", "#f59e0b")
    with c6: kpi("S3: Catch-all Won", f"{n_catchall:,}",
                 f"{100*n_catchall/total_biz:.1f}%", "#f59e0b")

    analyst_note(
    "Understanding the signal counts",
        "These are <strong>indicators of likely misidentification</strong>, not confirmed errors. "
        "The most actionable: "
        "<strong>S5 (wrong industry sector)</strong> is where complaints like the Employment Agency case originate — "
        "the winner places the business in a completely different industry than what all external providers suggested. "
        "<strong>S6 (multiple vendors agree but weren't used)</strong> is the strongest signal: "
        "when 2+ independent providers return the same code and the winner is something different, "
        "the winner is almost certainly wrong.",
        level="warning",
        bullets=[
            f"S5 Wrong Sector ({n_sector:,}): winner's industry doesn't match what any external provider suggested — investigate per client",
            f"S6 Vendors Agree But Ignored ({n_consensus:,}): multiple providers returned the same code but it wasn't used — strongest misidentification indicator",
            f"S4 Form Overrides Vendors ({n_ghost:,}): business's form submission won over a vendor with a different code — fix the scoring configuration",
            f"S3 Generic Placeholder ({n_catchall:,}): 561499 won — the system could not determine the industry — re-classification needed",
        ],
    )

    # Flagged businesses table
    flagged = sig_df[sig_df["signals"] != "ok"].copy()
    if not flagged.empty:
        st.markdown(f"**{len(flagged):,} businesses with at least one signal:**")

        # Signal breakdown bar
        signal_counts = {}
        for label in ["S1:null_winner","S2:format_error","S3:catchall_winner",
                      "S4:ghost_override","S5:sector_mismatch",
                      "S6:vendor_consensus_ignored","S7:catchall_w_specific_alt"]:
            cnt = int(flagged["signals"].str.contains(label.split(":")[0]).sum())
            signal_counts[label] = cnt

        sig_bar_df = pd.DataFrame(list(signal_counts.items()), columns=["Signal","Count"])
        sig_bar_df = sig_bar_df[sig_bar_df["Count"] > 0].sort_values("Count", ascending=True)
        colors = {"S1":"#dc2626","S2":"#ef4444","S3":"#f59e0b",
                  "S4":"#f97316","S5":"#ef4444","S6":"#f59e0b","S7":"#f97316"}
        sig_bar_df["color"] = sig_bar_df["Signal"].apply(
            lambda s: colors.get(s.split(":")[0], "#64748b")
        )
        fig_sig = go.Figure(go.Bar(
            x=sig_bar_df["Count"], y=sig_bar_df["Signal"],
            orientation="h",
            marker_color=sig_bar_df["color"].tolist(),
            hovertemplate="<b>%{y}</b><br>Count: %{x:,}<extra></extra>",
        ))
        fig_sig.update_layout(
            height=300, margin=dict(l=0,r=20,t=10,b=20),
            paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
            xaxis=dict(showgrid=True, gridcolor="#1e293b", title="Businesses"),
            yaxis=dict(showgrid=False),
        )
        st.plotly_chart(fig_sig, use_container_width=True, key="mis_sig_bar")

        display_f = flagged[[
            "client","business_id","winning_naics","platform_name",
            "winning_confidence","winning_sector",
            "vendor_alts_str","signals","winner_quality",
        ]].copy()
        display_f.columns = [
            "Client","Business ID","Winning NAICS","Winner Platform",
            "Confidence","Sector",
            "Vendor Alternatives","Signals","Winner Quality",
        ]
        display_f["Confidence"] = pd.to_numeric(display_f["Confidence"], errors="coerce").round(3)

        # Filter by signal type
        sig_types = ["All Signals"] + sorted({
            s for row in flagged["signals"] for s in row.split("|") if s
        })
        sig_filter = st.selectbox("Filter by signal type", sig_types, key="mis_sig_filter")
        if sig_filter != "All Signals":
            display_f = display_f[display_f["Signals"].str.contains(sig_filter.split(":")[0])]

        st.dataframe(display_f, use_container_width=True, hide_index=True,
                     column_config={"Confidence": st.column_config.NumberColumn(format="%.3f")})
        st.download_button(
            "⬇️ Download flagged businesses",
            display_f.to_csv(index=False).encode(),
            "misidentification_signals.csv","text/csv", key="dl_mis"
        )
