"""
KYB Confidence Intelligence Platform — Streamlit entry point.

Layout:
  - Top status bar
  - Global filter bar
  - Nine tabs (pages.*)

This module wires pages together and initializes global session state.
"""
from __future__ import annotations

import streamlit as st

from config.settings import SETTINGS
from core.state import ensure_session_state, restore_state_from_query_params, sync_state_to_query_params
from core.filters import render_filter_bar
from ui.theme import inject_theme

# Page modules
from pages import (
    executive_overview,
    kyb_confidence,
    feature_health,
    decision_ops,
    entity_360,
    inconsistency,
    lineage_discovery,
    data_explorer,
    ai_copilot,
)


def _top_status_bar() -> None:
    rs_ok, rs_msg = _probe_redshift()
    ai_status = _probe_openai()

    col1, col2, col3, col4, col5 = st.columns([3, 1.2, 1.2, 1.1, 1])
    with col1:
        st.markdown(
            "<div class='app-logo'>🛡️ KYB "
            "<span style='color:#60A5FA'>Confidence</span> Platform "
            "<span class='env-badge'>LOCAL · NO AUTH</span></div>",
            unsafe_allow_html=True,
        )
    with col2:
        cls = "ok" if rs_ok else "err"
        st.markdown(f"<div class='chip {cls}'>🗄 Redshift: {rs_msg}</div>", unsafe_allow_html=True)
    with col3:
        st.markdown(f"<div class='chip {ai_status[0]}'>🤖 OpenAI: {ai_status[1]}</div>", unsafe_allow_html=True)
    with col4:
        if st.button("🔗 Share", use_container_width=True):
            st.session_state["_show_share"] = True
    with col5:
        if st.button("📤 Export", use_container_width=True):
            st.session_state["_show_export"] = True


def _probe_redshift() -> tuple[bool, str]:
    """Lightweight Redshift probe. Does not raise."""
    try:
        from data_access.redshift import ping

        ok, msg = ping()
        return ok, msg
    except Exception as exc:  # pragma: no cover
        return False, f"err ({type(exc).__name__})"


def _probe_openai() -> tuple[str, str]:
    """Return (css-class, label) for the OpenAI status chip."""
    from ai.client import openai_status

    status = openai_status()
    if status == "live":
        return "ok", "live"
    if status == "fake":
        return "warn", "fake-key fallback"
    return "err", "missing"


def _render_share_modal() -> None:
    if not st.session_state.get("_show_share"):
        return
    with st.expander("🔗 Shareable Deep Link", expanded=True):
        link = sync_state_to_query_params(return_url=True)
        st.text_input("Deep link", value=link, label_visibility="collapsed")
        st.caption("Preserves tab, sub-tab, filters, selected entity.")
        if st.button("Close"):
            st.session_state["_show_share"] = False


def _render_export_modal() -> None:
    if not st.session_state.get("_show_export"):
        return
    from export.csv_xlsx import export_current_view

    with st.expander("📤 Export Current View", expanded=True):
        c1, c2, c3, c4 = st.columns(4)
        if c1.button("CSV"):
            export_current_view("csv")
        if c2.button("XLSX"):
            export_current_view("xlsx")
        if c3.button("PDF Snapshot"):
            export_current_view("pdf")
        if c4.button("JSON"):
            export_current_view("json")
        if st.button("Close ", key="exp_close"):
            st.session_state["_show_export"] = False


def main() -> None:
    st.set_page_config(
        page_title="KYB Confidence Platform",
        page_icon="🛡️",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    # Overlay st.secrets AFTER set_page_config — calling st.secrets before
    # set_page_config raises StreamlitSetPageConfigMustBeFirstCommandError.
    from config.settings import SETTINGS
    SETTINGS.refresh()

    inject_theme()
    ensure_session_state()
    restore_state_from_query_params()

    _top_status_bar()
    st.markdown("<hr class='thin-sep'/>", unsafe_allow_html=True)

    # Global filters
    render_filter_bar()

    # Modals
    _render_share_modal()
    _render_export_modal()

    # Tabs
    tabs = st.tabs([
        "📊 Executive Overview",
        "📈 KYB Confidence",
        "❤️ Feature Health",
        "⚖️ Decision & Ops",
        "🔍 Customer/Business 360",
        "🚩 Inconsistency & Red Flags",
        "🌳 Lineage & Discovery",
        "⌨️ Data Explorer",
        "🤖 AI Copilot & Check-Agent",
    ])

    with tabs[0]: executive_overview.render()
    with tabs[1]: kyb_confidence.render()
    with tabs[2]: feature_health.render()
    with tabs[3]: decision_ops.render()
    with tabs[4]: entity_360.render()
    with tabs[5]: inconsistency.render()
    with tabs[6]: lineage_discovery.render()
    with tabs[7]: data_explorer.render()
    with tabs[8]: ai_copilot.render()

    # Persist state back to URL on every rerun so deep links stay current.
    sync_state_to_query_params()


if __name__ == "__main__":
    main()
