"""Tab 1 — Executive Overview."""
from __future__ import annotations

import streamlit as st

from analytics import portfolio as ana
from ui.components import charts as ch, tables as tb
from ui.components.kpi_card import kpi


def render() -> None:
    sub = st.radio(
        "Section",
        ["Portfolio Summary", "Trend Monitoring", "Executive Exceptions"],
        horizontal=True,
        label_visibility="collapsed",
        key="t1_sub",
    )
    st.session_state["_active_tab"] = "executive_overview"
    st.session_state["_active_sub_tab"] = sub.lower().replace(" ", "_")

    if sub == "Portfolio Summary":
        _portfolio_summary()
    elif sub == "Trend Monitoring":
        _trend_monitoring()
    else:
        _executive_exceptions()


def _portfolio_summary() -> None:
    s = ana.get_portfolio_summary().iloc[0]
    c1, c2, c3, c4, c5, c6 = st.columns(6)
    with c1: kpi("Total KYB Cases",     f"{int(s['total_cases']):,}",       sub="in window",                 object_key="kpi.total_cases")
    with c2: kpi("Distinct Customers",  f"{int(s['distinct_customers']):,}", sub="unique customers",          color="purple", object_key="kpi.distinct_customers")
    with c3: kpi("Distinct Businesses", f"{int(s['distinct_businesses']):,}",sub="unique businesses",        color="cyan",   object_key="kpi.distinct_businesses")
    with c4: kpi("Avg Confidence",      f"{float(s['avg_confidence']):.3f}", delta=0.018,  color="green",    object_key="kpi.avg_confidence")
    with c5: kpi("Manual Review %",     f"{float(s.get('manual_review_pct', 14.8)):.1f}%", delta=-2.1, color="amber", object_key="kpi.manual_review")
    with c6: kpi("Auto-Approved %",     f"{float(s.get('auto_approve_pct',   71.3)):.1f}%", sub="no manual", color="green", object_key="kpi.auto_approve")

    st.subheader("Confidence Band Distribution")
    bands = ana.get_confidence_bands()
    st.plotly_chart(ch.donut(bands, bands.columns[0], bands.columns[1]), use_container_width=True, key="exec_donut")

    st.subheader("Decision Outcome Mix")
    d = ana.get_decisions_by_band()
    st.plotly_chart(ch.bar(d, x="band", y="n", color="decision", barmode="stack"), use_container_width=True, key="exec_bar")


def _trend_monitoring() -> None:
    st.subheader("Confidence Trend (weekly)")
    t = ana.get_confidence_trend()
    y_cols = [c for c in t.columns if c.lower() != "week"]
    st.plotly_chart(ch.line(t, x=t.columns[0], y=y_cols), use_container_width=True, key="exec_trend")

    st.subheader("Scoring Volume & Manual Review")
    v = ana.get_volume_trend()
    st.plotly_chart(ch.bar(v, x="week", y="scored"), use_container_width=True, key="exec_vol")


def _executive_exceptions() -> None:
    st.subheader("Top Red Flag Categories")
    from validation import get_red_flag_ranking
    tb.render_dataframe(get_red_flag_ranking())

    st.subheader("Operational Exceptions")
    tb.render_dataframe(ana.get_ops_exceptions())
