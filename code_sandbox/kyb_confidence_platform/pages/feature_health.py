"""Tab 3 — Feature Health & Data Quality."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from analytics import portfolio as ana
from ui.components import tables as tb
from ui.components.kpi_card import panel, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Feature Completeness", "Distribution Monitoring", "Data Quality Checks", "Source Reliability"],
        horizontal=True, label_visibility="collapsed", key="t3_sub",
    )
    if sub == "Feature Completeness":      _completeness()
    elif sub == "Distribution Monitoring": _drift()
    elif sub == "Data Quality Checks":     _dq()
    else:                                   _sources()


def _completeness() -> None:
    st.markdown(panel("Feature Null-Rate Monitor", "fa-droplet", object_key="feat.null_rates"), unsafe_allow_html=True)
    tb.render_dataframe(ana.get_null_rates())
    st.markdown(panel_close(), unsafe_allow_html=True)


def _drift() -> None:
    from ui.components import charts as ch
    st.markdown(panel("Feature Distribution Drift", "fa-wave-square", object_key="chart.feat_drift"), unsafe_allow_html=True)
    fi = ana.get_feature_importance().sort_values("drift", ascending=False).head(8)
    st.plotly_chart(ch.bar(fi, x="feature", y="drift", horizontal=True), use_container_width=True, key="feat_drift_bar")
    st.markdown(panel_close(), unsafe_allow_html=True)


def _dq() -> None:
    st.markdown(panel("Data Quality Rule Violations", "fa-list-check", object_key="dq.rules"), unsafe_allow_html=True)
    st.dataframe(pd.DataFrame([
        {"rule":"tin_format_valid",       "domain":"identifier",   "failed_records":142, "last_run":"2h ago"},
        {"rule":"address_country_iso",    "domain":"address",      "failed_records":37,  "last_run":"2h ago"},
        {"rule":"score_between_0_1",      "domain":"model",        "failed_records":0,   "last_run":"1h ago"},
        {"rule":"registration_date_past", "domain":"registration", "failed_records":6,   "last_run":"4h ago"},
    ]), use_container_width=True, hide_index=True)
    st.markdown(panel_close(), unsafe_allow_html=True)


def _sources() -> None:
    st.markdown(panel("Source Reliability", "fa-plug", object_key="src.reliability"), unsafe_allow_html=True)
    tb.render_dataframe(ana.get_source_reliability())
    st.markdown(panel_close(), unsafe_allow_html=True)
