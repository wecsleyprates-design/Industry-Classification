"""Tab 4 — Decision Impact & Operations."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from analytics import portfolio as ana
from ui.components import charts as ch, tables as tb
from ui.components.kpi_card import kpi, panel, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Confidence vs. Decision", "Confidence vs. TAT", "Manual Review", "Operational Exceptions"],
        horizontal=True, label_visibility="collapsed", key="t4_sub",
    )
    if sub == "Confidence vs. Decision": _decision()
    elif sub == "Confidence vs. TAT":    _tat()
    elif sub == "Manual Review":         _manual()
    else:                                _ops()


def _decision() -> None:
    st.markdown(panel("Confidence vs. Decision Outcome", "fa-scale-balanced", object_key="chart.decision_mix"), unsafe_allow_html=True)
    d = ana.get_decisions_by_band()
    if "n" not in d.columns and "count" in d.columns:
        d = d.rename(columns={"count": "n"})
    if "n" in d.columns:
        st.plotly_chart(
            ch.bar(d, x="band", y="n",
                   color="decision" if "decision" in d.columns else None,
                   barmode="stack"),
            use_container_width=True, key="decision_ops_bar",
        )
    st.markdown(panel_close(), unsafe_allow_html=True)


def _tat() -> None:
    st.markdown(panel("Turnaround Time by Confidence Band", "fa-stopwatch", object_key="chart.tat"), unsafe_allow_html=True)
    t = ana.get_tat_by_band()
    st.dataframe(t, use_container_width=True, hide_index=True)
    long = t.melt(id_vars=["band"], value_vars=["p50_hours","p90_hours"], var_name="percentile", value_name="hours")
    st.plotly_chart(
        ch.bar(long, x="band", y="hours", color="percentile", barmode="group"),
        use_container_width=True, key="decision_ops_tat",
    )
    st.markdown(panel_close(), unsafe_allow_html=True)


def _manual() -> None:
    c1, c2, c3 = st.columns(3)
    with c1: kpi("Manual Reviews (period)", "3,652", sub="14.8% of cases", color="amber", object_key="manual.total")
    with c2: kpi("Open Queue",              "214",   sub="analyst workload",              object_key="manual.queue")
    with c3: kpi("SLA Breaches",            "28",    sub=">24h in review",  color="red",  object_key="manual.sla")

    st.markdown(panel("Top Reasons Routed to Manual", "fa-user-gear", object_key="manual.reasons"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([
        {"reason":"UBO partial verification",         "share":"28%"},
        {"reason":"Address/SOS mismatch",              "share":"22%"},
        {"reason":"Watchlist hit / adverse media",     "share":"17%"},
        {"reason":"Score in review band (0.4–0.6)",    "share":"19%"},
        {"reason":"Pipeline/Source failure",           "share":"8%"},
        {"reason":"Other",                             "share":"6%"},
    ]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _ops() -> None:
    st.markdown(panel("Operational Exceptions (detailed)", "fa-triangle-exclamation", object_key="ops.table"), unsafe_allow_html=True)
    tb.render_dataframe(ana.get_ops_exceptions())
    st.markdown(panel_close(), unsafe_allow_html=True)
