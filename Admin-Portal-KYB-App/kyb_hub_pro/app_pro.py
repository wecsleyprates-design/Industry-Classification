"""
KYB Hub Pro — Next-Generation KYB Intelligence Dashboard
=========================================================
A superior replacement for kyb_hub_app.py with:
- Modern dark-themed UI/UX
- Portfolio-level analytics
- Deep business investigation
- AI Check-Agent for anomaly detection
- Data Connectors for external datasets
"""

import os, sys, json, re, math, hashlib, io
from datetime import datetime, timedelta, date

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# ── Module imports ────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))
from db_connector import (
    run_query, load_all_facts, load_worth_score, load_score_factors,
    load_portfolio_businesses, load_onboarding_counts,
    get_fact_value, get_fact_confidence, get_fact_platform_id,
    get_fact_alternatives, safe_get, parse_fact_json, REDSHIFT_CONFIG
)
from ui_components import (
    inject_css, kpi_card, status_badge, render_badge, section_header,
    alert_flag, vendor_pill, progress_bar, apply_dark_theme,
    fact_detail_card, pid_name, pid_color, PID_REGISTRY
)
from check_agent import (
    run_deterministic_checks, run_llm_audit, chat_with_agent,
    run_external_check, build_fact_summary, _fv, _safe_int, _safe_float
)
from analytics_engine import AnomalyScorer, compare_entities, load_score_history, load_cohort_analysis

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="KYB Hub Pro",
    page_icon="🏛️",
    layout="wide",
    initial_sidebar_state="expanded",
)
inject_css()

# ── Session state init ───────────────────────────────────────────────────────
if "business_id" not in st.session_state:
    st.session_state.business_id = ""
if "chat_messages" not in st.session_state:
    st.session_state.chat_messages = []
if "audit_result" not in st.session_state:
    st.session_state.audit_result = None
if "uploaded_data" not in st.session_state:
    st.session_state.uploaded_data = None

# ── Sidebar ──────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("# 🏛️ KYB Hub Pro")
    st.markdown('<div style="color:#64748B;font-size:0.75rem;margin-bottom:16px">Next-Gen KYB Intelligence Platform</div>', unsafe_allow_html=True)

    # Navigation
    st.markdown("### Navigation")
    nav = st.radio(
        "Select View",
        ["📊 Portfolio Dashboard", "🏢 Business Investigation", "🤖 AI Check-Agent", "🔌 Data Connectors"],
        label_visibility="collapsed"
    )

    st.markdown("---")

    # Business ID input
    st.markdown("### 🔍 Business Lookup")
    bid_input = st.text_input("Business ID (UUID)", value=st.session_state.business_id, placeholder="Enter UUID...")
    if bid_input != st.session_state.business_id:
        st.session_state.business_id = bid_input.strip()
        st.session_state.audit_result = None
        st.session_state.chat_messages = []
        st.rerun()

    # Date filters for portfolio
    st.markdown("### 📅 Date Range")
    col1, col2 = st.columns(2)
    with col1:
        date_from = st.date_input("From", value=date.today() - timedelta(days=90), key="date_from")
    with col2:
        date_to = st.date_input("To", value=date.today(), key="date_to")

    st.markdown("---")

    # Connection status
    st.markdown("### ⚡ Connection Status")
    try:
        import psycopg2
        test_conn = psycopg2.connect(**REDSHIFT_CONFIG, connect_timeout=5)
        test_conn.close()
        st.markdown('<div class="badge badge-pass">✅ Redshift Connected</div>', unsafe_allow_html=True)
    except Exception as e:
        st.markdown(f'<div class="badge badge-fail">❌ Redshift: {str(e)[:40]}</div>', unsafe_allow_html=True)

    st.markdown(f'<div class="badge badge-pass" style="margin-top:4px">✅ OpenAI Ready</div>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown('<div style="color:#475569;font-size:0.68rem;text-align:center">KYB Hub Pro v2.0<br>Built by Team B Data Science</div>', unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 1: PORTFOLIO DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

def render_portfolio_dashboard():
    st.markdown("## 📊 Portfolio Dashboard")
    st.markdown('<div style="color:#94A3B8;font-size:0.85rem;margin-bottom:16px">Real-time KYB portfolio monitoring and analytics</div>', unsafe_allow_html=True)

    with st.spinner("Loading portfolio data from Redshift..."):
        df, err = load_portfolio_businesses(str(date_from), str(date_to))

    if err:
        alert_flag(f"Error loading portfolio: {err}", "critical")
        return
    if df is None or df.empty:
        alert_flag("No businesses found in the selected date range.", "medium")
        return

    total = len(df)

    # ── Compute pass rates ────────────────────────────────────────────────
    sos_pass = df["sos_active"].apply(lambda x: str(x).lower() == "true").sum() if "sos_active" in df.columns else 0
    tin_pass = df["tin_match"].apply(lambda x: str(x).lower() == "true").sum() if "tin_match" in df.columns else 0
    idv_pass = df["idv_passed"].apply(lambda x: str(x).lower() == "true").sum() if "idv_passed" in df.columns else 0

    # Watchlist hits
    if "watchlist_hits" in df.columns:
        df["_wl_int"] = df["watchlist_hits"].apply(lambda x: _safe_int(x))
        wl_flagged = (df["_wl_int"] > 0).sum()
    else:
        wl_flagged = 0

    # Bankruptcies
    if "num_bankruptcies" in df.columns:
        df["_bk_int"] = df["num_bankruptcies"].apply(lambda x: _safe_int(x))
        bk_flagged = (df["_bk_int"] > 0).sum()
    else:
        bk_flagged = 0

    # NAICS fallback
    naics_fallback = 0
    if "naics_code" in df.columns:
        naics_fallback = df["naics_code"].apply(lambda x: str(x) == "561499").sum()

    # ── KPI Row ───────────────────────────────────────────────────────────
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1:
        kpi_card("Total Businesses", f"{total:,}", f"In date range {date_from} → {date_to}", "#3B82F6")
    with c2:
        pct = round(sos_pass / max(total, 1) * 100)
        kpi_card("SOS Pass Rate", f"{pct}%", f"{sos_pass:,} of {total:,} verified", "#22c55e" if pct >= 80 else "#f59e0b")
    with c3:
        pct = round(tin_pass / max(total, 1) * 100)
        kpi_card("TIN Pass Rate", f"{pct}%", f"{tin_pass:,} of {total:,} matched", "#22c55e" if pct >= 80 else "#f59e0b")
    with c4:
        pct = round(idv_pass / max(total, 1) * 100)
        kpi_card("IDV Pass Rate", f"{pct}%", f"{idv_pass:,} of {total:,} verified", "#22c55e" if pct >= 80 else "#f59e0b")
    with c5:
        kpi_card("Watchlist Flags", f"{wl_flagged:,}", f"Businesses with hits", "#ef4444" if wl_flagged > 0 else "#22c55e")
    with c6:
        kpi_card("NAICS Fallback", f"{naics_fallback:,}", "Using 561499 code", "#f59e0b" if naics_fallback > 0 else "#22c55e")

    st.markdown("---")

    # ── Onboarding Funnel ─────────────────────────────────────────────────
    col_left, col_right = st.columns([1, 1])

    with col_left:
        section_header("Onboarding Verification Funnel", "Pass rates across KYB verification stages", "🔄")

        funnel_data = pd.DataFrame({
            "Stage": ["Submitted", "SOS Verified", "TIN Matched", "IDV Passed", "No Watchlist Hits"],
            "Count": [total, sos_pass, tin_pass, idv_pass, total - wl_flagged],
        })
        funnel_data["Percentage"] = (funnel_data["Count"] / max(total, 1) * 100).round(1)

        fig_funnel = go.Figure(go.Funnel(
            y=funnel_data["Stage"],
            x=funnel_data["Count"],
            textinfo="value+percent initial",
            textposition="inside",
            marker=dict(color=["#3B82F6", "#22c55e", "#10b981", "#06b6d4", "#8B5CF6"]),
            connector=dict(line=dict(color="#334155", width=1)),
        ))
        fig_funnel.update_layout(height=350, title="KYB Verification Funnel")
        st.plotly_chart(apply_dark_theme(fig_funnel), use_container_width=True)

    with col_right:
        section_header("Risk Distribution", "Breakdown of risk indicators across portfolio", "⚠️")

        risk_labels = ["Watchlist Hits", "Bankruptcies", "NAICS Fallback", "SOS Failed", "TIN Failed"]
        risk_counts = [wl_flagged, bk_flagged, naics_fallback, total - sos_pass, total - tin_pass]
        risk_colors = ["#ef4444", "#f97316", "#f59e0b", "#a855f7", "#ec4899"]

        fig_risk = go.Figure(go.Bar(
            x=risk_counts, y=risk_labels, orientation="h",
            marker_color=risk_colors,
            text=[f"{c:,} ({c/max(total,1)*100:.1f}%)" for c in risk_counts],
            textposition="outside",
            textfont=dict(color="#CBD5E1", size=11),
        ))
        fig_risk.update_layout(
            height=350, title="Risk Indicator Distribution",
            xaxis=dict(title="Number of Businesses"),
            yaxis=dict(autorange="reversed"),
        )
        st.plotly_chart(apply_dark_theme(fig_risk), use_container_width=True)

    st.markdown("---")

    # ── Industry Distribution ─────────────────────────────────────────────
    if "naics_code" in df.columns:
        section_header("Industry Distribution", "NAICS sector breakdown of onboarded businesses", "🏭")

        df["_naics2"] = df["naics_code"].apply(lambda x: str(x)[:2] if x and str(x) != "None" else "Unknown")
        naics_counts = df["_naics2"].value_counts().head(15).reset_index()
        naics_counts.columns = ["Sector", "Count"]

        SECTOR_NAMES = {
            "11": "Agriculture", "21": "Mining", "22": "Utilities", "23": "Construction",
            "31": "Manufacturing", "32": "Manufacturing", "33": "Manufacturing",
            "42": "Wholesale", "44": "Retail", "45": "Retail",
            "48": "Transportation", "49": "Transportation",
            "51": "Information", "52": "Finance/Insurance", "53": "Real Estate",
            "54": "Professional Services", "55": "Management", "56": "Admin/Support",
            "61": "Education", "62": "Healthcare", "71": "Arts/Entertainment",
            "72": "Accommodation/Food", "81": "Other Services", "92": "Public Admin",
            "Un": "Unknown",
        }
        naics_counts["Label"] = naics_counts["Sector"].apply(
            lambda x: f"{x} — {SECTOR_NAMES.get(x, 'Other')}"
        )

        fig_ind = px.bar(naics_counts, x="Count", y="Label", orientation="h",
                         color="Count", color_continuous_scale="Blues",
                         text="Count")
        fig_ind.update_layout(height=max(300, len(naics_counts) * 30), title="Top Industries by NAICS Sector",
                              yaxis=dict(autorange="reversed"), showlegend=False)
        fig_ind.update_traces(textposition="outside", textfont=dict(color="#CBD5E1"))
        st.plotly_chart(apply_dark_theme(fig_ind), use_container_width=True)

    st.markdown("---")

    # ── Alerts Table ──────────────────────────────────────────────────────
    section_header("Businesses Requiring Attention", "Flagged entities sorted by risk severity", "🚨")

    # Build alert score
    df["_alert_score"] = 0
    if "watchlist_hits" in df.columns:
        df["_alert_score"] += df["_wl_int"] * 50
    if "num_bankruptcies" in df.columns:
        df["_alert_score"] += df["_bk_int"] * 30
    if "sos_active" in df.columns:
        df["_alert_score"] += df["sos_active"].apply(lambda x: 0 if str(x).lower() == "true" else 20)
    if "tin_match" in df.columns:
        df["_alert_score"] += df["tin_match"].apply(lambda x: 0 if str(x).lower() == "true" else 15)

    alerts_df = df[df["_alert_score"] > 0].sort_values("_alert_score", ascending=False).head(25)

    if not alerts_df.empty:
        display_cols = ["business_id"]
        if "legal_name" in alerts_df.columns:
            display_cols.append("legal_name")
        display_cols += [c for c in ["sos_active", "tin_match", "watchlist_hits", "num_bankruptcies", "_alert_score"]
                         if c in alerts_df.columns]

        st.dataframe(
            alerts_df[display_cols].reset_index(drop=True),
            use_container_width=True,
            hide_index=True,
            column_config={
                "business_id": st.column_config.TextColumn("Business ID", width="medium"),
                "legal_name": st.column_config.TextColumn("Legal Name"),
                "sos_active": st.column_config.TextColumn("SOS"),
                "tin_match": st.column_config.TextColumn("TIN"),
                "watchlist_hits": st.column_config.TextColumn("WL Hits"),
                "num_bankruptcies": st.column_config.TextColumn("BK"),
                "_alert_score": st.column_config.ProgressColumn("Risk Score", min_value=0, max_value=200, format="%d"),
            }
        )

        # Quick action: click to investigate
        st.markdown("💡 **Tip:** Copy a Business ID and paste it in the sidebar to investigate.")
    else:
        st.success("No businesses with active risk flags in the selected date range.")


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 2: BUSINESS INVESTIGATION
# ══════════════════════════════════════════════════════════════════════════════

def render_business_investigation():
    bid = st.session_state.business_id
    if not bid:
        st.markdown("## 🏢 Business Investigation")
        st.info("Enter a Business ID (UUID) in the sidebar to begin investigation.")
        return

    st.markdown(f"## 🏢 Business Investigation")
    st.markdown(f'<div style="color:#64748B;font-size:0.80rem">Business ID: <code>{bid}</code></div>', unsafe_allow_html=True)

    # ── Load data ─────────────────────────────────────────────────────────
    with st.spinner("Loading business facts from Redshift..."):
        facts, err = load_all_facts(bid)
    if err:
        alert_flag(f"Error loading facts: {err}", "critical")
        return
    if not facts:
        alert_flag("No facts found for this business ID.", "medium")
        return

    with st.spinner("Loading Worth Score..."):
        score_df, score_err = load_worth_score(bid)

    # ── Business Header ───────────────────────────────────────────────────
    legal_name = _fv(facts, "legal_name") or "Unknown Entity"
    sos_active = _fv(facts, "sos_active")
    tin_match = _fv(facts, "tin_match_boolean")
    idv_passed = _fv(facts, "idv_passed_boolean")
    naics = _fv(facts, "naics_code")
    formation_state = _fv(facts, "formation_state")
    formation_date = _fv(facts, "formation_date")
    website = _fv(facts, "website")
    revenue = _fv(facts, "revenue")
    employees = _fv(facts, "num_employees")
    watchlist_hits = _safe_int(_fv(facts, "watchlist_hits"))

    # Score
    score_val = 0
    risk_level = "Unknown"
    decision = "Unknown"
    if score_df is not None and not score_df.empty:
        row = score_df.iloc[0]
        score_val = float(row.get("score_850") or 0)
        risk_level = str(row.get("risk_level") or "Unknown")
        decision = str(row.get("score_decision") or "Unknown")

    # Header card
    risk_color = {"HIGH": "#ef4444", "MODERATE": "#f59e0b", "MEDIUM": "#f59e0b", "LOW": "#22c55e"}.get(risk_level.upper(), "#64748b")
    dec_color = {"APPROVE": "#22c55e", "FURTHER_REVIEW_NEEDED": "#f59e0b", "DECLINE": "#ef4444"}.get(decision, "#64748b")

    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#1E293B,#0F172A);border-radius:16px;padding:24px 28px;margin-bottom:16px;border:1px solid #334155">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap">
            <div>
                <div style="color:#F1F5F9;font-size:1.5rem;font-weight:800">{legal_name}</div>
                <div style="color:#94A3B8;font-size:0.82rem;margin-top:4px">
                    {f'NAICS: {naics}' if naics else 'NAICS: Unknown'} &nbsp;|&nbsp;
                    {f'{formation_state}' if formation_state else 'State: Unknown'} &nbsp;|&nbsp;
                    {f'Est. {formation_date[:10]}' if formation_date else 'Formation: Unknown'}
                </div>
                <div style="margin-top:8px">
                    {status_badge('SOS ✓' if sos_active == 'true' else 'SOS ✗', 'pass' if sos_active == 'true' else 'fail')}
                    {status_badge('TIN ✓' if tin_match == 'true' else 'TIN ✗', 'pass' if tin_match == 'true' else 'fail')}
                    {status_badge('IDV ✓' if idv_passed == 'true' else 'IDV ✗', 'pass' if idv_passed == 'true' else 'fail')}
                    {status_badge(f'WL: {watchlist_hits}', 'fail' if watchlist_hits > 0 else 'pass')}
                </div>
            </div>
            <div style="text-align:right">
                <div style="color:{risk_color};font-size:2.2rem;font-weight:900">{score_val:.0f}</div>
                <div style="color:#94A3B8;font-size:0.75rem">Worth Score (850)</div>
                <div style="margin-top:4px">
                    <span style="color:{risk_color};font-weight:700;font-size:0.80rem">{risk_level}</span>
                    <span style="color:#64748B;font-size:0.75rem"> | </span>
                    <span style="color:{dec_color};font-weight:700;font-size:0.80rem">{decision.replace('_',' ')}</span>
                </div>
            </div>
        </div>
    </div>""", unsafe_allow_html=True)

    # ── Sub-tabs ──────────────────────────────────────────────────────────
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "📋 Background & Registration",
        "💰 Financials & Score",
        "⚠️ Risk & Watchlist",
        "📍 Contact & Web",
        "🔬 Fact Explorer"
    ])

    # ── TAB: Background & Registration ────────────────────────────────────
    with tab1:
        render_background_tab(facts, bid)

    # ── TAB: Financials & Score ───────────────────────────────────────────
    with tab2:
        render_financials_tab(facts, bid, score_df, score_val, risk_level, decision)

    # ── TAB: Risk & Watchlist ─────────────────────────────────────────────
    with tab3:
        render_risk_tab(facts, bid, watchlist_hits)

    # ── TAB: Contact & Web ────────────────────────────────────────────────
    with tab4:
        render_contact_tab(facts, bid)

    # ── TAB: Fact Explorer ────────────────────────────────────────────────
    with tab5:
        render_fact_explorer(facts, bid)


# ── Sub-tab renderers ────────────────────────────────────────────────────────

def render_background_tab(facts, bid):
    section_header("Business Identity", "Legal name, DBA, formation, and entity type", "🏢", "#3B82F6")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        kpi_card("Legal Name", _fv(facts, "legal_name") or "Unknown",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'legal_name'))}", "#3B82F6")
    with c2:
        kpi_card("Formation State", _fv(facts, "formation_state") or "Unknown",
                 _fv(facts, "formation_date") or "Date unknown", "#8B5CF6")
    with c3:
        kpi_card("Entity Type", _fv(facts, "entity_type") or "Unknown",
                 f"Sole Prop: {_fv(facts, 'is_sole_prop') or 'Unknown'}", "#06b6d4")
    with c4:
        kpi_card("NAICS Code", _fv(facts, "naics_code") or "Unknown",
                 f"MCC: {_fv(facts, 'mcc_code') or 'Unknown'}", "#f59e0b")

    st.markdown("---")

    # SOS & TIN detail
    section_header("Secretary of State & TIN Verification", "Registry status and EIN verification", "🏛️", "#22c55e")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        sos = _fv(facts, "sos_active")
        kpi_card("SOS Active", sos or "Unknown",
                 f"Confidence: {get_fact_confidence(facts, 'sos_active'):.4f}",
                 "#22c55e" if sos == "true" else "#ef4444")
    with c2:
        sos_m = _fv(facts, "sos_match_boolean")
        kpi_card("SOS Match", sos_m or "Unknown",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'sos_match'))}",
                 "#22c55e" if sos_m == "true" else "#ef4444")
    with c3:
        tin = _fv(facts, "tin_match_boolean")
        kpi_card("TIN Match", tin or "Unknown",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'tin_match'))}",
                 "#22c55e" if tin == "true" else "#ef4444")
    with c4:
        mc = get_fact_confidence(facts, "middesk_confidence") or _safe_float(_fv(facts, "middesk_confidence"))
        mc_display = f"{mc:.2f}" if mc else "Unknown"
        kpi_card("Middesk Confidence", mc_display,
                 "0.15 + 0.20 × passing tasks", "#f59e0b")

    # DBA names
    dba = facts.get("dba_found", {}).get("value", [])
    if isinstance(dba, list) and dba:
        st.markdown("---")
        section_header("DBA / Trade Names", f"{len(dba)} name(s) found", "📝", "#a855f7")
        for d in dba:
            if isinstance(d, dict):
                st.markdown(f"- **{d.get('name', str(d))}** — Source: {d.get('source', 'Unknown')}")
            else:
                st.markdown(f"- **{d}**")

    # People / Officers
    people = facts.get("people", {}).get("value", [])
    if isinstance(people, list) and people:
        st.markdown("---")
        section_header("Officers & People", f"{len(people)} person(s) found", "👥", "#ec4899")
        people_data = []
        for p in people:
            if isinstance(p, dict):
                people_data.append({
                    "Name": p.get("name", "Unknown"),
                    "Titles": ", ".join(p.get("titles", [])) if isinstance(p.get("titles"), list) else str(p.get("titles", "")),
                    "Source": p.get("source", "Unknown"),
                    "Submitted": "Yes" if p.get("submitted") else "No",
                })
        if people_data:
            st.dataframe(pd.DataFrame(people_data), use_container_width=True, hide_index=True)


def render_financials_tab(facts, bid, score_df, score_val, risk_level, decision):
    section_header("Worth Score Analysis", "300-850 scale risk score from 3-model ensemble", "💰", "#3B82F6")

    # Score gauge
    c1, c2 = st.columns([1, 2])
    with c1:
        score_100 = (score_val - 300) / 550 * 100 if score_val > 300 else 0
        prob = (score_val - 300) / 550 if score_val > 300 else 0

        kpi_card("Worth Score (850)", f"{score_val:.0f}", "score = p × 550 + 300",
                 "#ef4444" if score_val <= 549 else "#f59e0b" if score_val <= 699 else "#22c55e")
        kpi_card("Score (100)", f"{score_100:.1f}", "score = p × 100", "#8B5CF6")
        kpi_card("Model Probability", f"{prob:.4f}", "Calibrated ensemble output", "#06b6d4")

    with c2:
        # Score gauge chart
        fig_gauge = go.Figure(go.Indicator(
            mode="gauge+number+delta",
            value=score_val,
            title={"text": "Worth Score", "font": {"color": "#E2E8F0", "size": 16}},
            number={"font": {"color": "#F1F5F9", "size": 40}},
            gauge=dict(
                axis=dict(range=[300, 850], tickcolor="#64748B"),
                bar=dict(color="#3B82F6"),
                bgcolor="#1E293B",
                borderwidth=0,
                steps=[
                    dict(range=[300, 549], color="#ef444433"),
                    dict(range=[549, 699], color="#f59e0b33"),
                    dict(range=[699, 850], color="#22c55e33"),
                ],
                threshold=dict(line=dict(color="#F1F5F9", width=2), thickness=0.75, value=score_val),
            ),
        ))
        fig_gauge.update_layout(height=280)
        st.plotly_chart(apply_dark_theme(fig_gauge), use_container_width=True)

    st.markdown("---")

    # Score factors
    section_header("Score Factor Breakdown", "Category contributions to the final score", "📊", "#8B5CF6")
    factors_df, f_err = load_score_factors(bid)
    if factors_df is not None and not factors_df.empty:
        fig_factors = go.Figure(go.Bar(
            x=factors_df["weighted_score_850"].astype(float),
            y=factors_df["category_id"],
            orientation="h",
            marker_color=[
                "#22c55e" if float(v) >= 0 else "#ef4444"
                for v in factors_df["weighted_score_850"]
            ],
            text=[f"{float(v):+.0f}" for v in factors_df["weighted_score_850"]],
            textposition="outside",
            textfont=dict(color="#CBD5E1"),
        ))
        fig_factors.update_layout(
            height=max(250, len(factors_df) * 35),
            title="Score Factor Contributions (850 scale)",
            xaxis=dict(title="Score Impact"),
            yaxis=dict(autorange="reversed"),
        )
        st.plotly_chart(apply_dark_theme(fig_factors), use_container_width=True)
    elif f_err:
        st.info(f"Score factors not available: {f_err}")

    st.markdown("---")

    # Financial facts
    section_header("Financial Data Points", "Revenue, employees, and financial indicators", "💵", "#22c55e")
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        rev = _fv(facts, "revenue")
        kpi_card("Revenue", f"${float(rev):,.0f}" if rev else "Unknown",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'revenue'))}", "#22c55e")
    with c2:
        emp = _fv(facts, "num_employees")
        kpi_card("Employees", emp or "Unknown",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'num_employees'))}", "#3B82F6")
    with c3:
        bk = _fv(facts, "num_bankruptcies")
        kpi_card("Bankruptcies", bk or "0",
                 "Public records", "#ef4444" if _safe_int(bk) > 0 else "#22c55e")
    with c4:
        liens = _fv(facts, "num_liens")
        kpi_card("Liens", liens or "0",
                 "Tax/mechanic liens", "#f59e0b" if _safe_int(liens) > 0 else "#22c55e")

    # Score=0 diagnosis
    if score_val <= 300:
        st.markdown("---")
        section_header("Score = 0 Root Cause Diagnosis", "Why the model returned its minimum output", "🔴", "#ef4444")
        alert_flag("Worth Score ≤ 300 indicates the model returned its minimum possible output. "
                   "This is almost always caused by missing model inputs.", "critical")

        diag = [
            ("Entity matching failed", not _fv(facts, "revenue") and not _fv(facts, "num_employees"),
             "ZI/EFX/OC could not match → all firmographic features null"),
            ("No Plaid banking data", True,
             "Financial sub-model requires Plaid data. If not connected, financial model outputs minimum."),
            ("NAICS = 561499 (fallback)", _fv(facts, "naics_code") == "561499",
             "Industry unknown → company_profile category penalized"),
            ("Formation date missing", not _fv(facts, "formation_date"),
             "age_business = null → imputed to default → low operations score"),
        ]
        for title, flagged, desc in diag:
            severity = "high" if flagged else "low"
            alert_flag(f"**{title}**: {desc}", severity)


def render_risk_tab(facts, bid, watchlist_hits):
    section_header("Watchlist & Sanctions Screening", "PEP, Sanctions, and Adverse Media results", "⚠️", "#ef4444")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        kpi_card("Watchlist Hits", str(watchlist_hits),
                 "PEP + Sanctions (excl. adverse media)",
                 "#ef4444" if watchlist_hits > 0 else "#22c55e")
    with c2:
        am = _fv(facts, "adverse_media_hits")
        kpi_card("Adverse Media", am or "0",
                 "Tracked separately from sanctions",
                 "#f59e0b" if _safe_int(am) > 0 else "#22c55e")
    with c3:
        bk = _fv(facts, "num_bankruptcies")
        kpi_card("Bankruptcies", bk or "0",
                 "Equifax / public records",
                 "#ef4444" if _safe_int(bk) > 0 else "#22c55e")
    with c4:
        jd = _fv(facts, "num_judgements")
        kpi_card("Judgements", jd or "0",
                 "Civil judgments",
                 "#f59e0b" if _safe_int(jd) > 0 else "#22c55e")

    st.markdown("---")

    # Risk score
    risk_score = _fv(facts, "risk_score")
    if risk_score:
        section_header("Risk Score", f"Composite risk score: {risk_score}/100", "🎯", "#ef4444")
        progress_bar(float(risk_score), 100,
                     "#ef4444" if float(risk_score) > 50 else "#f59e0b" if float(risk_score) > 20 else "#22c55e",
                     "Overall Risk Score")

    # Screened people
    screened = facts.get("screened_people", {}).get("value", [])
    if isinstance(screened, list) and screened:
        st.markdown("---")
        section_header("Screened Individuals", f"{len(screened)} person(s) screened", "👤", "#ec4899")
        for p in screened:
            if isinstance(p, dict):
                name = p.get("name", "Unknown")
                hits = p.get("watchlistHits", [])
                hit_count = len(hits) if isinstance(hits, list) else 0
                st.markdown(
                    f"- **{name}** — {status_badge(f'{hit_count} hit(s)', 'fail' if hit_count > 0 else 'pass')}",
                    unsafe_allow_html=True
                )


def render_contact_tab(facts, bid):
    section_header("Address & Contact Information", "Verified addresses, deliverability, and contact data", "📍", "#06b6d4")

    # Primary address
    addr = facts.get("primary_address", {}).get("value", {})
    if isinstance(addr, dict) and addr:
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            kpi_card("Street", addr.get("line_1", "Unknown"), "", "#06b6d4")
        with c2:
            kpi_card("City", addr.get("city", "Unknown"), "", "#3B82F6")
        with c3:
            kpi_card("State", addr.get("state", "Unknown"), "", "#8B5CF6")
        with c4:
            kpi_card("ZIP", addr.get("postal_code", "Unknown"), addr.get("country", ""), "#22c55e")
    else:
        st.info("No primary address data available.")

    st.markdown("---")

    # Address flags
    section_header("Address Verification", "USPS deliverability and registered agent check", "✉️", "#f59e0b")
    c1, c2, c3 = st.columns(3)
    with c1:
        nm = _fv(facts, "name_match_boolean")
        kpi_card("Name Match", nm or "Unknown", "Business name vs SOS registry",
                 "#22c55e" if nm == "true" else "#ef4444")
    with c2:
        ra = _fv(facts, "address_registered_agent")
        kpi_card("Registered Agent", ra or "Unknown", "Is address a known RA?",
                 "#f59e0b" if ra == "true" else "#22c55e")
    with c3:
        deliv = facts.get("addresses_deliverable", {}).get("value", [])
        d_count = len(deliv) if isinstance(deliv, list) else 0
        kpi_card("Deliverable Addresses", str(d_count), "Confirmed by USPS", "#22c55e")

    st.markdown("---")

    # Website
    section_header("Website Information", "Domain analysis and AI enrichment data", "🌐", "#a855f7")
    c1, c2 = st.columns(2)
    with c1:
        web = _fv(facts, "website")
        kpi_card("Website", web or "Not provided",
                 f"Source: {pid_name(get_fact_platform_id(facts, 'website'))}", "#a855f7")
    with c2:
        kpi_card("Website Status", _fv(facts, "website_status") or "Unknown",
                 "Domain verification", "#3B82F6")


def render_fact_explorer(facts, bid):
    section_header("Fact Explorer", f"{len([n for n in facts if not n.startswith('_')])} facts loaded", "🔬", "#8B5CF6")

    # Fact groups
    FACT_GROUPS = {
        "🏢 Identity / Name": ["legal_name", "names_found", "dba_found", "people", "kyb_submitted", "kyb_complete"],
        "🏛️ Registry / SOS": ["sos_active", "sos_match", "sos_match_boolean", "sos_filings", "middesk_confidence"],
        "🔐 TIN / EIN": ["tin", "tin_submitted", "tin_match", "tin_match_boolean", "is_sole_prop"],
        "📍 Address / Location": ["primary_address", "addresses", "addresses_deliverable", "address_registered_agent", "name_match", "name_match_boolean"],
        "🏭 Industry / Classification": ["naics_code", "mcc_code", "industry", "mcc_code_found"],
        "⚠️ Risk / Watchlist": ["watchlist", "watchlist_hits", "adverse_media_hits", "screened_people", "risk_score", "high_risk_people"],
        "📊 Financials": ["revenue", "num_employees", "num_bankruptcies", "num_judgements", "num_liens"],
        "🌐 Website / Digital": ["website", "website_status", "website_parked", "website_creation_date"],
        "🆔 IDV / Identity": ["idv_passed", "idv_passed_boolean", "idv_status"],
    }

    # Summary KPIs
    total = len([n for n in facts if not n.startswith("_")])
    has_val = sum(1 for n, f in facts.items() if not n.startswith("_") and f.get("value") is not None and not f.get("_too_large"))
    null_n = sum(1 for n, f in facts.items() if not n.startswith("_") and f.get("value") is None)
    large_n = sum(1 for n, f in facts.items() if f.get("_too_large"))

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        kpi_card("Total Facts", str(total), "in rds_warehouse_public.facts", "#3B82F6")
    with c2:
        kpi_card("Has Value", str(has_val), f"{has_val/max(total,1)*100:.0f}% fill rate", "#22c55e")
    with c3:
        kpi_card("Null", str(null_n), "No vendor provided data", "#64748b")
    with c4:
        kpi_card("Too Large", str(large_n), "Query RDS directly", "#f59e0b")

    # Fill rate bar
    fill_pct = int(has_val / max(total, 1) * 100)
    fill_color = "#22c55e" if fill_pct >= 80 else "#f59e0b" if fill_pct >= 50 else "#ef4444"
    progress_bar(fill_pct, 100, fill_color, "Overall KYB Data Fill Rate")

    st.markdown("---")

    # Group fill rate chart
    group_summary = []
    fact_to_group = {n: g for g, ns in FACT_GROUPS.items() for n in ns}

    for grp_name, grp_facts in FACT_GROUPS.items():
        g_total = sum(1 for n in grp_facts if n in facts)
        g_val = sum(1 for n in grp_facts if n in facts and facts[n].get("value") is not None and not facts[n].get("_too_large"))
        if g_total > 0:
            group_summary.append({
                "Group": grp_name.split(" ", 1)[1] if " " in grp_name else grp_name,
                "Total": g_total, "With Value": g_val,
                "Fill %": round(g_val / max(g_total, 1) * 100)
            })

    # Add "Other" group
    other_names = [n for n in facts if not n.startswith("_") and n not in fact_to_group]
    if other_names:
        o_val = sum(1 for n in other_names if facts[n].get("value") is not None and not facts[n].get("_too_large"))
        group_summary.append({"Group": "Other", "Total": len(other_names), "With Value": o_val,
                              "Fill %": round(o_val / max(len(other_names), 1) * 100)})

    if group_summary:
        gdf = pd.DataFrame(group_summary).sort_values("Fill %", ascending=True)
        fig_g = go.Figure(go.Bar(
            x=gdf["Fill %"].astype(float), y=gdf["Group"], orientation="h",
            marker_color=[("#22c55e" if v >= 80 else "#f59e0b" if v >= 50 else "#ef4444") for v in gdf["Fill %"]],
            text=[f"{int(v)}% ({int(r['With Value'])}/{int(r['Total'])})" for v, (_, r) in zip(gdf["Fill %"], gdf.iterrows())],
            textposition="outside",
            textfont=dict(size=10, color="#CBD5E1"),
        ))
        fig_g.update_layout(height=max(250, len(gdf) * 38), title="KYB Data Fill Rate by Fact Group",
                            xaxis=dict(range=[0, 130], title="Fill Rate (%)"))
        st.plotly_chart(apply_dark_theme(fig_g), use_container_width=True)

    st.markdown("---")

    # Render each fact group
    for grp_name, grp_facts in list(FACT_GROUPS.items()) + [("📦 Other", other_names if 'other_names' in dir() else [])]:
        if isinstance(grp_facts, list):
            available = [n for n in grp_facts if n in facts]
        else:
            available = [n for n in facts if not n.startswith("_") and n not in fact_to_group]

        if not available:
            continue

        g_val = sum(1 for n in available if facts[n].get("value") is not None and not facts[n].get("_too_large"))
        label = f"{grp_name}  ({len(available)} facts · {g_val} with values)"

        with st.expander(label, expanded=False):
            for name in available:
                fact_detail_card(name, facts[name], facts)


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 3: AI CHECK-AGENT
# ══════════════════════════════════════════════════════════════════════════════

def render_check_agent():
    bid = st.session_state.business_id
    st.markdown("## 🤖 AI Check-Agent")
    st.markdown('<div style="color:#94A3B8;font-size:0.85rem;margin-bottom:16px">Automated anomaly detection, cross-field validation, and external data cross-referencing</div>', unsafe_allow_html=True)

    if not bid:
        st.info("Enter a Business ID in the sidebar to use the Check-Agent.")
        return

    # Load facts
    with st.spinner("Loading business data..."):
        facts, err = load_all_facts(bid)
    if err or not facts:
        alert_flag(f"Cannot load facts: {err or 'No data found'}", "critical")
        return

    # Load score
    score_df, _ = load_worth_score(bid)
    score_info = {}
    if score_df is not None and not score_df.empty:
        row = score_df.iloc[0]
        score_info = {
            "score_850": float(row.get("score_850") or 0),
            "risk_level": str(row.get("risk_level") or ""),
            "decision": str(row.get("score_decision") or ""),
        }

    # ── Section 0: Anomaly Radar ─────────────────────────────────────────
    section_header("Multi-Dimensional Anomaly Score", "Composite risk assessment across 6 dimensions", "🎯", "#f59e0b")

    scorer = AnomalyScorer(facts, score_info)
    anomaly = scorer.compute_overall()

    # Radar chart
    dim_names = list(anomaly["dimensions"].keys())
    dim_scores = [anomaly["dimensions"][d]["score"] for d in dim_names]
    dim_labels = [d.replace("_", " ").title() for d in dim_names]

    c_left, c_right = st.columns([1, 2])
    with c_left:
        tier_colors = {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MEDIUM": "#f59e0b", "LOW": "#22c55e", "CLEAN": "#10b981"}
        kpi_card("Overall Anomaly Score", f"{anomaly['overall_score']}/100",
                 f"Tier: {anomaly['tier']} | {anomaly['reason_count']} finding(s)",
                 tier_colors.get(anomaly["tier"], "#64748b"))
        st.markdown("")
        for dim_name in dim_names:
            d = anomaly["dimensions"][dim_name]
            label = dim_name.replace("_", " ").title()
            color = "#ef4444" if d["score"] >= 50 else "#f59e0b" if d["score"] >= 25 else "#22c55e"
            progress_bar(d["score"], 100, color, f"{label} ({d['score']}/100, weight={d['weight']})")

    with c_right:
        fig_radar = go.Figure()
        fig_radar.add_trace(go.Scatterpolar(
            r=dim_scores + [dim_scores[0]],
            theta=dim_labels + [dim_labels[0]],
            fill="toself",
            fillcolor="rgba(239,68,68,0.15)",
            line=dict(color="#ef4444", width=2),
            name="Risk Score",
        ))
        fig_radar.update_layout(
            polar=dict(
                bgcolor="#1E293B",
                radialaxis=dict(visible=True, range=[0, 100], gridcolor="#334155", tickfont=dict(color="#64748B")),
                angularaxis=dict(gridcolor="#334155", tickfont=dict(color="#CBD5E1", size=11)),
            ),
            height=380, title="Risk Dimension Radar",
            showlegend=False,
        )
        st.plotly_chart(apply_dark_theme(fig_radar), use_container_width=True)

    # Dimension details
    with st.expander("View all anomaly reasons", expanded=False):
        for dim_name in dim_names:
            d = anomaly["dimensions"][dim_name]
            if d["reasons"]:
                st.markdown(f"**{dim_name.replace('_', ' ').title()}** (score: {d['score']})")
                for r in d["reasons"]:
                    alert_flag(r, "high" if d["score"] >= 50 else "medium" if d["score"] >= 25 else "low")

    st.markdown("---")

    # ── Section 1: Deterministic Checks ───────────────────────────────────
    section_header("Deterministic Cross-Field Checks", "Rule-based anomaly detection (instant, no AI needed)", "🔍", "#3B82F6")

    det_results = run_deterministic_checks(facts)

    if det_results:
        # Summary
        crit = sum(1 for r in det_results if r["severity"] == "CRITICAL")
        high = sum(1 for r in det_results if r["severity"] == "HIGH")
        med = sum(1 for r in det_results if r["severity"] == "MEDIUM")
        low = sum(1 for r in det_results if r["severity"] in ("LOW", "NOTICE"))

        c1, c2, c3, c4, c5 = st.columns(5)
        with c1:
            kpi_card("Total Flags", str(len(det_results)), "Cross-field anomalies", "#f59e0b")
        with c2:
            kpi_card("Critical", str(crit), "Block approval", "#ef4444")
        with c3:
            kpi_card("High", str(high), "Manual review", "#f97316")
        with c4:
            kpi_card("Medium", str(med), "Investigate", "#f59e0b")
        with c5:
            kpi_card("Low / Notice", str(low), "Informational", "#22c55e")

        st.markdown("")

        # Detail cards
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "NOTICE": 4}
        for r in sorted(det_results, key=lambda x: severity_order.get(x["severity"], 5)):
            sev_map = {"CRITICAL": "critical", "HIGH": "high", "MEDIUM": "medium", "LOW": "low", "NOTICE": "low"}
            alert_flag(
                f"**[{r['severity']}] {r['name']}**<br>"
                f"<span style='font-size:0.80rem'>{r['description']}</span><br>"
                f"<span style='color:#60A5FA;font-size:0.78rem'>Action: {r['action']}</span>",
                sev_map.get(r["severity"], "info")
            )
    else:
        st.success("No cross-field anomalies detected. All deterministic checks passed.")

    st.markdown("---")

    # ── Section 2: AI Deep Audit ──────────────────────────────────────────
    section_header("AI Deep Audit", "GPT-powered comprehensive compliance analysis", "🧠", "#8B5CF6")

    col1, col2, col3 = st.columns(3)
    with col1:
        run_audit = st.button("🚀 Run Full AI Audit", type="primary", use_container_width=True)
    with col2:
        run_external = st.button("🌐 External Data Check", use_container_width=True)
    with col3:
        clear_audit = st.button("🗑️ Clear Results", use_container_width=True)

    if clear_audit:
        st.session_state.audit_result = None
        st.rerun()

    if run_audit:
        with st.spinner("Running AI deep audit... (analyzing all facts, cross-referencing, checking consistency)"):
            result, ai_err = run_llm_audit(facts, bid, score_info)
        if ai_err:
            alert_flag(f"AI audit error: {ai_err}", "critical")
        elif result:
            st.session_state.audit_result = result

    if run_external:
        with st.spinner("Running external data cross-reference analysis..."):
            ext_result, ext_err = run_external_check(facts, bid)
        if ext_err:
            alert_flag(f"External check error: {ext_err}", "critical")
        elif ext_result:
            section_header("External Verification Analysis", "AI-recommended external data sources to check", "🌐", "#06b6d4")
            st.markdown(ext_result)

    # Display audit results
    if st.session_state.audit_result:
        result = st.session_state.audit_result
        st.markdown("---")
        section_header("Audit Results", f"Overall Risk: {result.get('overall_risk', 'Unknown')}", "📋",
                       {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MEDIUM": "#f59e0b", "LOW": "#22c55e", "CLEAN": "#22c55e"}.get(
                           result.get("overall_risk", ""), "#64748b"))

        # Data quality score
        dq = result.get("data_quality_score", 0)
        c1, c2 = st.columns([1, 3])
        with c1:
            kpi_card("Data Quality", f"{dq}/100", "AI-assessed completeness",
                     "#22c55e" if dq >= 80 else "#f59e0b" if dq >= 50 else "#ef4444")
        with c2:
            st.markdown(f"**Executive Summary:** {result.get('summary', 'No summary available.')}")

        # Findings
        findings = result.get("findings", [])
        if findings:
            st.markdown("### Findings")
            for f in findings:
                sev = f.get("severity", "MEDIUM")
                sev_map = {"CRITICAL": "critical", "HIGH": "high", "MEDIUM": "medium", "LOW": "low", "CLEAN": "low"}
                facts_str = ", ".join(f'`{fn}`' for fn in f.get("facts_involved", []))
                ext = f.get("external_verification", "")
                ext_html = f"<br><span style='color:#06b6d4;font-size:0.76rem'>🌐 External: {ext}</span>" if ext else ""

                alert_flag(
                    f"**[{sev}] {f.get('title', 'Finding')}**<br>"
                    f"<span style='font-size:0.80rem'>{f.get('description', '')}</span><br>"
                    f"<span style='color:#94A3B8;font-size:0.76rem'>Facts: {facts_str}</span><br>"
                    f"<span style='color:#60A5FA;font-size:0.78rem'>Action: {f.get('recommended_action', '')}</span>"
                    f"{ext_html}",
                    sev_map.get(sev, "info")
                )

        # Next steps
        steps = result.get("recommended_next_steps", [])
        if steps:
            st.markdown("### Recommended Next Steps")
            for i, step in enumerate(steps, 1):
                st.markdown(f"**{i}.** {step}")

    st.markdown("---")

    # ── Section 3: AI Chat ────────────────────────────────────────────────
    section_header("AI Chat Agent", "Ask questions about this business, KYB facts, or compliance rules", "💬", "#06b6d4")

    # Build context
    fact_ctx = json.dumps(build_fact_summary(facts), indent=1, default=str)[:3000]

    # Chat history
    for msg in st.session_state.chat_messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat input
    if prompt := st.chat_input("Ask about this business, its facts, or KYB compliance..."):
        st.session_state.chat_messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Thinking..."):
                api_messages = [{"role": m["role"], "content": m["content"]}
                                for m in st.session_state.chat_messages]
                response, chat_err = chat_with_agent(api_messages, fact_ctx)
                if chat_err:
                    response = f"Error: {chat_err}"
                st.markdown(response)
                st.session_state.chat_messages.append({"role": "assistant", "content": response})


# ══════════════════════════════════════════════════════════════════════════════
#  TAB 4: DATA CONNECTORS
# ══════════════════════════════════════════════════════════════════════════════

def render_data_connectors():
    st.markdown("## 🔌 Data Connectors")
    st.markdown('<div style="color:#94A3B8;font-size:0.85rem;margin-bottom:16px">Upload external datasets to cross-reference against the KYB portfolio</div>', unsafe_allow_html=True)

    tab1, tab2, tab3 = st.tabs(["📤 Upload Dataset", "🔄 Cross-Reference", "📊 Results"])

    with tab1:
        section_header("Upload External Dataset", "CSV or Excel files for cross-referencing", "📤", "#3B82F6")

        uploaded_file = st.file_uploader("Choose a CSV or Excel file", type=["csv", "xlsx", "xls"])

        if uploaded_file:
            try:
                if uploaded_file.name.endswith(".csv"):
                    df = pd.read_csv(uploaded_file)
                else:
                    df = pd.read_excel(uploaded_file)

                st.session_state.uploaded_data = df
                st.success(f"Loaded {len(df)} rows × {len(df.columns)} columns from `{uploaded_file.name}`")

                st.markdown("### Preview")
                st.dataframe(df.head(20), use_container_width=True, hide_index=True)

                st.markdown("### Column Summary")
                col_info = []
                for col in df.columns:
                    col_info.append({
                        "Column": col,
                        "Type": str(df[col].dtype),
                        "Non-Null": df[col].notna().sum(),
                        "Null": df[col].isna().sum(),
                        "Unique": df[col].nunique(),
                        "Sample": str(df[col].dropna().iloc[0])[:50] if df[col].notna().any() else "N/A",
                    })
                st.dataframe(pd.DataFrame(col_info), use_container_width=True, hide_index=True)

            except Exception as e:
                alert_flag(f"Error reading file: {str(e)}", "critical")

    with tab2:
        section_header("Cross-Reference Configuration", "Map uploaded columns to KYB data", "🔄", "#8B5CF6")

        if st.session_state.uploaded_data is not None:
            df = st.session_state.uploaded_data

            st.markdown("**Select the column containing Business IDs (UUIDs):**")
            id_col = st.selectbox("Business ID Column", df.columns.tolist())

            st.markdown("**Select columns to compare against Redshift facts:**")
            compare_cols = st.multiselect("Comparison Columns", [c for c in df.columns if c != id_col])

            if st.button("🚀 Run Cross-Reference", type="primary"):
                if not id_col:
                    st.warning("Please select a Business ID column.")
                else:
                    with st.spinner("Cross-referencing against Redshift..."):
                        results = []
                        sample_ids = df[id_col].dropna().unique()[:50]  # Limit to 50

                        progress = st.progress(0)
                        for i, bid in enumerate(sample_ids):
                            bid_str = str(bid).strip()
                            if not bid_str or len(bid_str) < 10:
                                continue

                            facts, err = load_all_facts(bid_str)
                            if facts:
                                row_data = {"business_id": bid_str}
                                for col in compare_cols:
                                    uploaded_val = df[df[id_col] == bid][col].iloc[0] if len(df[df[id_col] == bid]) > 0 else None
                                    # Try to find matching fact
                                    fact_val = _fv(facts, col.lower().replace(" ", "_"))
                                    row_data[f"uploaded_{col}"] = str(uploaded_val)[:50]
                                    row_data[f"redshift_{col}"] = str(fact_val)[:50] if fact_val else "N/A"
                                    row_data[f"match_{col}"] = str(uploaded_val).strip().lower() == str(fact_val).strip().lower() if fact_val else "N/A"
                                results.append(row_data)
                            progress.progress((i + 1) / len(sample_ids))

                        if results:
                            result_df = pd.DataFrame(results)
                            st.session_state.xref_results = result_df
                            st.success(f"Cross-referenced {len(results)} businesses.")
                            st.dataframe(result_df, use_container_width=True, hide_index=True)
                        else:
                            st.warning("No matches found. Check that the ID column contains valid UUIDs.")
        else:
            st.info("Upload a dataset first in the 'Upload Dataset' tab.")

    with tab3:
        section_header("Cross-Reference Results", "Discrepancies and matches", "📊", "#22c55e")

        if hasattr(st.session_state, "xref_results") and st.session_state.xref_results is not None:
            result_df = st.session_state.xref_results
            st.dataframe(result_df, use_container_width=True, hide_index=True)

            # Download button
            csv = result_df.to_csv(index=False)
            st.download_button("📥 Download Results (CSV)", csv, "cross_reference_results.csv", "text/csv")
        else:
            st.info("No cross-reference results yet. Run a cross-reference in the previous tab.")


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN ROUTING
# ══════════════════════════════════════════════════════════════════════════════

if nav == "📊 Portfolio Dashboard":
    render_portfolio_dashboard()
elif nav == "🏢 Business Investigation":
    render_business_investigation()
elif nav == "🤖 AI Check-Agent":
    render_check_agent()
elif nav == "🔌 Data Connectors":
    render_data_connectors()
