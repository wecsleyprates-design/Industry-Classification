"""Tab 1 — Executive Overview."""
from __future__ import annotations

import streamlit as st

from analytics import portfolio as ana
from ui.components import charts as ch, tables as tb
from ui.components.kpi_card import kpi, panel_header, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Portfolio Summary", "Trend Monitoring", "Executive Exceptions"],
        horizontal=True, label_visibility="collapsed", key="t1_sub",
    )
    st.session_state["_active_tab"]     = "executive_overview"
    st.session_state["_active_sub_tab"] = sub.lower().replace(" ", "_")

    if sub == "Portfolio Summary":    _portfolio_summary()
    elif sub == "Trend Monitoring":   _trend_monitoring()
    else:                             _executive_exceptions()


def _portfolio_summary() -> None:
    s = ana.get_portfolio_summary().iloc[0]
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1: kpi("Total KYB Cases",     f"{int(s['total_cases']):,}",        sub="in period",               object_key="kpi.total_cases")
    with c2: kpi("Distinct Customers",  f"{int(s['distinct_customers']):,}", sub="unique customer accounts", color="purple", object_key="kpi.distinct_customers")
    with c3: kpi("Distinct Businesses", f"{int(s['distinct_businesses']):,}",sub="unique business entities", color="cyan",   object_key="kpi.distinct_businesses")
    with c4: kpi("Avg Confidence",      f"{float(s['avg_confidence']):.3f}", delta=float(s.get('delta_avg_conf', 0.018)), color="green", object_key="kpi.avg_confidence")
    with c5: kpi("Manual Review %",     f"{float(s.get('manual_review_pct',14.8)):.1f}%", delta=float(s.get('delta_manual',-2.1)), color="amber", object_key="kpi.manual_review")
    with c6: kpi("Auto-Approved %",     f"{float(s.get('auto_approve_pct', 71.3)):.1f}%", sub="no manual required", color="green", object_key="kpi.auto_approve")

    # ── Confidence Band Distribution ──────────────────────────────────────────
    panel_header("Confidence Band Distribution", "fa-chart-pie", object_key="chart.bands")
    bands = ana.get_confidence_bands()
    st.plotly_chart(ch.donut(bands, bands.columns[0], bands.columns[1]), use_container_width=True, key="exec_donut")
    panel_close()

    # ── Decision Outcome Mix ──────────────────────────────────────────────────
    panel_header("Decision Outcome Mix", "fa-scale-balanced", object_key="chart.decisions")
    d = ana.get_decisions_by_band()
    if "n" not in d.columns and "count" in d.columns:
        d = d.rename(columns={"count": "n"})
    if "n" in d.columns and "band" in d.columns:
        st.plotly_chart(
            ch.bar(d, x="band", y="n",
                   color="decision" if "decision" in d.columns else None,
                   barmode="stack"),
            use_container_width=True, key="exec_bar",
        )
    else:
        st.dataframe(d, use_container_width=True, hide_index=True)
    panel_close()


def _trend_monitoring() -> None:
    # ── Confidence Trend ─────────────────────────────────────────────────────
    st.markdown(panel("Confidence Score Trend (Domestic vs Foreign)", "fa-chart-line", object_key="chart.confidence_trend"), unsafe_allow_html=True)
    t = ana.get_confidence_trend()
    y_cols = [c for c in t.columns if c.lower() != "week"]
    st.plotly_chart(ch.line(t, x=t.columns[0], y=y_cols), use_container_width=True, key="exec_trend")
    panel_close()

    # ── Volume & Manual Review ────────────────────────────────────────────────
    panel_header("Scoring Volume & Manual Review Trend", "fa-chart-column", object_key="chart.volume_trend")
    v = ana.get_volume_trend()
    st.plotly_chart(ch.bar(v, x="week", y="scored"), use_container_width=True, key="exec_vol")
    panel_close()


def _executive_exceptions() -> None:
    from validation import get_red_flag_ranking
    panel_header("Top Red Flag Categories", "fa-triangle-exclamation", object_key="exec.red_flag_top")
    tb.render_dataframe(get_red_flag_ranking())
    panel_close()

    panel_header("Operational Exceptions", "fa-gears", object_key="exec.ops_exceptions")
    tb.render_dataframe(ana.get_ops_exceptions())
    panel_close()
