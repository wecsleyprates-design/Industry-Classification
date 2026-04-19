"""
Global filter bar.

Visible at the top of every tab. Values are persisted in session state and
deep-linked to the URL.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import streamlit as st


DATE_RANGE_OPTIONS = {
    "last_7d":  "Last 7 days",
    "last_30d": "Last 30 days",
    "last_90d": "Last 90 days",
    "ytd":      "Year to date",
    "custom":   "Custom…",
}

DATE_CONTEXT_OPTIONS = {
    "submitted_at": "Submitted At",
    "scored_at":    "Scored At",
    "decision_at":  "Decision At",
    "activated_at": "Activation At",
}

ENTITY_TYPES = ["ALL", "Domestic", "Foreign"]
BANDS = ["ALL", "Very Low", "Low", "Medium", "High", "Very High"]


@dataclass
class FilterState:
    date_range: str
    date_context: str
    customer: str
    business_id: str
    entity_type: str
    confidence_band: str
    manual_only: bool
    custom_start: date | None = None
    custom_end: date | None = None

    def resolve_window(self) -> tuple[date, date]:
        today = date.today()
        if self.date_range == "last_7d":
            return today - timedelta(days=7), today
        if self.date_range == "last_30d":
            return today - timedelta(days=30), today
        if self.date_range == "last_90d":
            return today - timedelta(days=90), today
        if self.date_range == "ytd":
            return date(today.year, 1, 1), today
        if self.date_range == "custom" and self.custom_start and self.custom_end:
            return self.custom_start, self.custom_end
        return today - timedelta(days=30), today


def current_filters() -> FilterState:
    ss = st.session_state
    return FilterState(
        date_range=ss.get("flt_date_range", "last_30d"),
        date_context=ss.get("flt_date_context", "scored_at"),
        customer=ss.get("flt_customer", "ALL"),
        business_id=ss.get("flt_business_id", ""),
        entity_type=ss.get("flt_entity_type", "ALL"),
        confidence_band=ss.get("flt_confidence_band", "ALL"),
        manual_only=ss.get("flt_manual_only", False),
        custom_start=ss.get("flt_custom_start"),
        custom_end=ss.get("flt_custom_end"),
    )


def render_filter_bar() -> None:
    with st.container():
        c1, c2, c3, c4, c5, c6, c7 = st.columns([1.1, 1.1, 1.3, 1.3, 1, 1.1, 1])
        with c1:
            st.selectbox(
                "Date Range",
                options=list(DATE_RANGE_OPTIONS.keys()),
                format_func=lambda k: DATE_RANGE_OPTIONS[k],
                key="flt_date_range",
            )
        with c2:
            st.selectbox(
                "Date Context",
                options=list(DATE_CONTEXT_OPTIONS.keys()),
                format_func=lambda k: DATE_CONTEXT_OPTIONS[k],
                key="flt_date_context",
            )
        with c3:
            st.text_input("Customer", key="flt_customer", placeholder="ALL or customer name")
        with c4:
            st.text_input("Business ID", key="flt_business_id", placeholder="bus_… (UUID)")
        with c5:
            st.selectbox("Entity Type", options=ENTITY_TYPES, key="flt_entity_type")
        with c6:
            st.selectbox("Confidence Band", options=BANDS, key="flt_confidence_band")
        with c7:
            st.checkbox("Manual Review only", key="flt_manual_only")

    if st.session_state.get("flt_date_range") == "custom":
        c8, c9 = st.columns(2)
        with c8:
            st.date_input("From", key="flt_custom_start")
        with c9:
            st.date_input("To", key="flt_custom_end")
