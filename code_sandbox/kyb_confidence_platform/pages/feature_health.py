"""Tab 3 — Feature Health & Data Quality."""
from __future__ import annotations

import streamlit as st

from analytics import portfolio as ana
from ui.components import tables as tb


def render() -> None:
    sub = st.radio(
        "Section",
        ["Feature Completeness", "Distribution Monitoring", "Data Quality Checks", "Source Reliability"],
        horizontal=True, label_visibility="collapsed", key="t3_sub",
    )
    if sub == "Feature Completeness": _completeness()
    elif sub == "Distribution Monitoring": _drift()
    elif sub == "Data Quality Checks": _dq()
    else: _sources()


def _completeness() -> None:
    st.subheader("Feature null-rate monitor")
    tb.render_dataframe(ana.get_null_rates())


def _drift() -> None:
    st.subheader("Feature drift (PSI)")
    fi = ana.get_feature_importance().sort_values("drift", ascending=False).head(10)
    st.dataframe(fi[["feature", "drift"]], use_container_width=True, hide_index=True)


def _dq() -> None:
    st.subheader("DQ rule violations")
    st.dataframe([
        {"rule": "tin_format_valid",      "domain": "identifier",  "failed_records": 142, "last_run":"2h ago"},
        {"rule": "address_country_iso",   "domain": "address",     "failed_records": 37,  "last_run":"2h ago"},
        {"rule": "score_between_0_1",     "domain": "model",       "failed_records": 0,   "last_run":"1h ago"},
        {"rule": "registration_date_past","domain": "registration","failed_records": 6,   "last_run":"4h ago"},
    ], use_container_width=True, hide_index=True)


def _sources() -> None:
    st.subheader("Source reliability")
    tb.render_dataframe(ana.get_source_reliability())
