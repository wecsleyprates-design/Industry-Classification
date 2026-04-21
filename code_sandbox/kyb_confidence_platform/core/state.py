"""
Session state + deep-linking helpers.

We serialize the critical UI state (active filters + selected entity) into the
URL query params so any view can be reproduced from a shared link.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import streamlit as st


# Keys that are mirrored into the URL.
_URL_KEYS = [
    ("tab", "_active_tab"),
    ("sub", "_active_sub_tab"),
    ("dr",  "flt_date_range"),
    ("dc",  "flt_date_context"),
    ("c",   "flt_customer"),
    ("b",   "flt_business_id"),
    ("e",   "selected_entity_id"),
]


def ensure_session_state() -> None:
    from datetime import date, timedelta
    _today = date.today()
    defaults: dict[str, Any] = {
        "_active_tab": "executive_overview",
        "_active_sub_tab": "portfolio_summary",
        "flt_date_range": "last_30d",
        "flt_date_context": "scored_at",
        "flt_customer": "ALL",
        "flt_business_id": "",
        "flt_entity_type": "ALL",
        "flt_confidence_band": "ALL",
        "flt_manual_only": False,
        # Custom date range — sensible defaults so the window is never zero-length
        "flt_custom_start": _today - timedelta(days=30),
        "flt_custom_end": _today,
        "selected_entity_id": "",
        "_trust_ctx": None,
        "_lineage_modal_key": None,
        "_ask_ai_open_for": None,
        "_check_agent_open_for": None,
        # Available filter options (populated by render_filter_bar)
        "_available_customers": ["ALL"],
        "_available_business_ids": [],
    }
    for k, v in defaults.items():
        st.session_state.setdefault(k, v)


def restore_state_from_query_params() -> None:
    params = st.query_params
    for url_key, state_key in _URL_KEYS:
        if url_key in params:
            value = params[url_key]
            if isinstance(value, list):
                value = value[0] if value else ""
            st.session_state[state_key] = value


def sync_state_to_query_params(return_url: bool = False) -> str:
    qp: dict[str, str] = {}
    for url_key, state_key in _URL_KEYS:
        val = st.session_state.get(state_key, "")
        if val != "" and val is not None:
            qp[url_key] = str(val)
    # Write to the URL bar (Streamlit handles this)
    try:
        st.query_params.clear()
        for k, v in qp.items():
            st.query_params[k] = v
    except Exception:
        pass
    if return_url:
        # Best effort — Streamlit doesn't expose the full URL, so build a relative one.
        return "./?" + urlencode(qp)
    return ""
