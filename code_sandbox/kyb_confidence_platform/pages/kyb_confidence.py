"""Tab 2 — KYB Confidence Monitoring."""
from __future__ import annotations

import streamlit as st

from analytics import portfolio as ana
from ui.components import charts as ch
from ui.components.kpi_card import kpi, panel, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Score Overview", "Score Stability (PSI)", "Prediction Volume", "Model Explainability"],
        horizontal=True, label_visibility="collapsed", key="t2_sub",
    )
    if sub == "Score Overview":         _overview()
    elif sub == "Score Stability (PSI)":_stability()
    elif sub == "Prediction Volume":    _volume()
    else:                               _explain()


def _overview() -> None:
    s = ana.get_portfolio_summary().iloc[0]
    c1, c2, c3, c4 = st.columns(4)
    with c1: kpi("Avg Score",   f"{float(s['avg_confidence']):.3f}",          sub="across portfolio", color="green", object_key="conf.avg")
    with c2: kpi("Median Score",f"{float(s.get('median_confidence',0.781)):.3f}", sub="p50",          object_key="conf.median")
    with c3: kpi("Low Band %",  "11.3%", sub="score < 0.4",                   color="red",   object_key="conf.low_pct")
    with c4: kpi("High Band %", "71.2%", sub="score ≥ 0.6",                   color="green", object_key="conf.high_pct")

    st.markdown(panel("Confidence Distribution", "fa-chart-area", object_key="chart.conf_dist"), unsafe_allow_html=True)
    bands = ana.get_confidence_bands()
    st.plotly_chart(ch.bar(bands, x=bands.columns[0], y=bands.columns[1]), use_container_width=True, key="conf_dist_bar")
    st.markdown(panel_close(), unsafe_allow_html=True)


def _stability() -> None:
    st.markdown(panel("Population Stability Index (PSI)", "fa-wave-square", object_key="chart.psi"), unsafe_allow_html=True)
    st.caption("Thresholds: **<0.10** stable · **0.10–0.25** monitor · **>0.25** drift")
    psi = ana.get_psi_trend()
    st.plotly_chart(ch.line(psi, x="week", y=["psi"]), use_container_width=True, key="psi_line")
    st.markdown(panel_close(), unsafe_allow_html=True)

    st.markdown(panel("Top Drifting Features", "fa-arrow-trend-up", object_key="feat.drift_top"), unsafe_allow_html=True)
    fi = ana.get_feature_importance().sort_values("drift", ascending=False).head(6)
    st.dataframe(fi[["feature", "drift"]], use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _volume() -> None:
    st.markdown(panel("Prediction Volume & Pipeline Completeness", "fa-chart-column", object_key="chart.volume"), unsafe_allow_html=True)
    v = ana.get_volume_trend()
    st.plotly_chart(ch.bar(v, x="week", y="scored"), use_container_width=True, key="vol_bar")
    st.markdown(panel_close(), unsafe_allow_html=True)

    import pandas as pd
    st.markdown(panel("Pipeline Failure Rates", "fa-bug", object_key="pipe.failures"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([
        {"Stage":"Feature Materialization","Cases":"24,716","Fail %":"0.4%"},
        {"Stage":"Model Scoring",          "Cases":"24,619","Fail %":"0.1%"},
        {"Stage":"Decision Routing",       "Cases":"24,589","Fail %":"0.2%"},
        {"Stage":"External Enrichment",    "Cases":"24,716","Fail %":"3.1%"},
    ]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _explain() -> None:
    st.markdown(panel("Global Feature Importance", "fa-chart-bar", object_key="chart.feat_importance"), unsafe_allow_html=True)
    fi = ana.get_feature_importance().sort_values("importance", ascending=True)
    st.plotly_chart(ch.bar(fi, x="feature", y="importance", horizontal=True), use_container_width=True, key="feat_imp_bar")
    st.markdown(panel_close(), unsafe_allow_html=True)

    st.markdown(panel("What Drives Low-Confidence Cases?", "fa-magnifying-glass-chart", object_key="explain.low_band"), unsafe_allow_html=True)
    st.markdown("""
    - 🔻 **address_contact_overlap** is the top negative signal in 38% of low-band cases.
    - 🔻 **ubo_verified** partial matches contribute in 27% of low-band cases.
    - 🔻 **registration_active = false** appears in 19% of low-band cases.
    """)
    st.markdown(panel_close(), unsafe_allow_html=True)
