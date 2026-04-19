"""Tab 2 — KYB Confidence Monitoring."""
from __future__ import annotations

import streamlit as st

from analytics import portfolio as ana
from ui.components import charts as ch
from ui.components.kpi_card import kpi


def render() -> None:
    sub = st.radio(
        "Section",
        ["Score Overview", "Score Stability (PSI)", "Prediction Volume", "Model Explainability"],
        horizontal=True, label_visibility="collapsed", key="t2_sub",
    )
    if sub == "Score Overview": _overview()
    elif sub == "Score Stability (PSI)": _stability()
    elif sub == "Prediction Volume": _volume()
    else: _explain()


def _overview() -> None:
    s = ana.get_portfolio_summary().iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    with c1: kpi("Avg Score",    f"{float(s['avg_confidence']):.3f}", color="green", object_key="conf.avg")
    with c2: kpi("Median",       f"{float(s.get('median_confidence', 0.78)):.3f}", object_key="conf.median")
    with c3: kpi("Low Band %",   "11.3%", color="red",   object_key="conf.low_pct")
    with c4: kpi("High Band %",  "71.2%", color="green", object_key="conf.high_pct")

    bands = ana.get_confidence_bands()
    st.plotly_chart(ch.bar(bands, x=bands.columns[0], y=bands.columns[1]), use_container_width=True)


def _stability() -> None:
    psi = ana.get_psi_trend()
    st.caption("Thresholds: <0.10 stable · 0.10–0.25 monitor · >0.25 drift")
    st.plotly_chart(ch.line(psi, x="week", y=["psi"]), use_container_width=True)

    st.subheader("Top drifting features")
    fi = ana.get_feature_importance().sort_values("drift", ascending=False).head(6)
    st.dataframe(fi, use_container_width=True, hide_index=True)


def _volume() -> None:
    v = ana.get_volume_trend()
    st.plotly_chart(ch.bar(v, x="week", y="scored", color=None), use_container_width=True)


def _explain() -> None:
    fi = ana.get_feature_importance().sort_values("importance", ascending=True)
    st.plotly_chart(ch.bar(fi, x="feature", y="importance", horizontal=True), use_container_width=True)
