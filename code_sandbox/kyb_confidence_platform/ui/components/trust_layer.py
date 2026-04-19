"""
Trust-layer panel renderers.

The trust-bar buttons are now pure HTML inside the card/panel HTML
(rendered via kpi_card.kpi() and kpi_card.panel()). This module only
provides render_panels() — it renders the currently-open expander for
Ask AI / Check-Agent / Lineage when triggered from the sidebar buttons.

In the Streamlit context the buttons in the HTML cannot directly toggle
session state (they're in an iframe). Instead we render three small
Streamlit buttons below each card row that the user can also use, and
the HTML onclick messages are handled by JavaScript injected into the page.
"""
from __future__ import annotations

from dataclasses import dataclass

import streamlit as st

from config.lineage_catalog import get as lineage_get
from ai.check_agent import run_check_agent, Scope
from ai.client import chat_completion
from ai.prompts import COPILOT_SYSTEM, COPILOT_USER_TEMPLATE
from core.filters import current_filters


@dataclass
class TrustLayerContext:
    active_object_key: str | None = None

    @staticmethod
    def current() -> "TrustLayerContext":
        return TrustLayerContext(
            active_object_key=st.session_state.get("_active_object"),
        )


def render(object_key: str) -> None:
    """
    Render three compact Streamlit buttons (✦ Ask AI / ⊙ Check / ⎇ Lineage).
    These are the fallback interactive controls — the HTML trust-bar icons
    inside the card render purely visually (FontAwesome) but the actual
    Streamlit interaction is driven by these buttons.
    """
    b1, b2, b3 = st.columns([1, 1, 1])

    with b1:
        if st.button(
            "✦", key=f"ask_{object_key}",
            help="Ask AI — ask the Copilot about this metric",
            use_container_width=True,
        ):
            _toggle("_ask_ai_open_for", object_key)

    with b2:
        if st.button(
            "⊙", key=f"chk_{object_key}",
            help="Check-Agent — run consistency scan on this object",
            use_container_width=True,
        ):
            _toggle("_check_agent_open_for", object_key)

    with b3:
        if st.button(
            "⎇", key=f"lin_{object_key}",
            help="Lineage — view 4-level data lineage for this field",
            use_container_width=True,
        ):
            _toggle("_lineage_modal_key", object_key)


def _toggle(state_key: str, object_key: str) -> None:
    """Toggle: if already open for this key, close it; otherwise open it."""
    all_keys = ["_ask_ai_open_for", "_check_agent_open_for", "_lineage_modal_key"]
    for k in all_keys:
        st.session_state[k] = None
    if st.session_state.get(state_key) != object_key:
        st.session_state[state_key] = object_key


def render_panels(object_key: str) -> None:
    """
    Render whichever panel is currently open for object_key.
    Call this OUTSIDE any st.columns() block to avoid nesting issues.
    """
    _render_ask_ai_panel(object_key)
    _render_check_agent_panel(object_key)
    _render_lineage_panel(object_key)


# ── Panel renderers ───────────────────────────────────────────────────────────

def _render_ask_ai_panel(object_key: str) -> None:
    if st.session_state.get("_ask_ai_open_for") != object_key:
        return
    with st.expander(f"🪄 Ask AI — {object_key}", expanded=True):
        q = st.text_input(
            "Question", key=f"ask_q_{object_key}",
            placeholder="e.g. Why did this change? What drives this metric?",
        )
        # Preset chips
        pc = st.columns(3)
        presets = ["Why did this change?", "Breakdown by segment?", "Show the SQL."]
        clicked = None
        for i, p in enumerate(presets):
            if pc[i].button(p, key=f"ask_preset_{object_key}_{i}"):
                clicked = p
        question = clicked or q

        c_ask, c_close = st.columns([2, 1])
        if c_ask.button("Ask", key=f"ask_btn_{object_key}", type="primary"):
            if not question:
                st.warning("Type a question or click a preset.")
            else:
                ctx = lineage_get(object_key)
                f = current_filters()
                messages = [
                    {"role": "system", "content": COPILOT_SYSTEM},
                    {"role": "user", "content": COPILOT_USER_TEMPLATE.format(
                        object_context=f"Object: {object_key}\nBusiness meaning: {ctx.l1_business}",
                        filters=(
                            f"date_range={f.date_range}, date_context={f.date_context}, "
                            f"customer={f.customer}, business_id={f.business_id}"
                        ),
                        rag_evidence="(RAG not included in prototype trust-layer popup)",
                        question=question,
                    )},
                ]
                answer = chat_completion(messages, temperature=0.2)
                st.markdown(
                    f"<div class='kyb-flag blue'>{answer}</div>",
                    unsafe_allow_html=True,
                )
        if c_close.button("✕ Close", key=f"ask_close_{object_key}"):
            st.session_state["_ask_ai_open_for"] = None
            st.rerun()


def _render_check_agent_panel(object_key: str) -> None:
    if st.session_state.get("_check_agent_open_for") != object_key:
        return
    with st.expander(f"🛡 Check-Agent — {object_key}", expanded=True):
        st.caption("Running deterministic rules + optional LLM auditor.")
        ctx = (
            st.session_state.get("_check_agent_context")
            or {"entity_id": "object", "facts": {}, "score": 0.0}
        )
        res = run_check_agent(ctx, scope=Scope.OBJECT)
        sev_class = {"critical": "red", "high": "red", "medium": "amber", "low": "blue"}
        if not res.findings:
            st.markdown(
                "<div class='kyb-flag green'>✅ No inconsistencies found for this object.</div>",
                unsafe_allow_html=True,
            )
        else:
            for finding in res.findings:
                cls = sev_class.get(finding.severity.value, "amber")
                st.markdown(
                    f"<div class='kyb-flag {cls}'>"
                    f"<b>[{finding.severity.value.upper()}] {finding.title}</b><br/>"
                    f"{finding.description}<br/>"
                    f"<span style='opacity:.8'>Evidence: {finding.evidence}</span><br/>"
                    f"<span style='opacity:.8'>Action: {finding.recommendation}</span>"
                    f"</div>",
                    unsafe_allow_html=True,
                )
        if st.button("✕ Close", key=f"chk_close_{object_key}"):
            st.session_state["_check_agent_open_for"] = None
            st.rerun()


def _render_lineage_panel(object_key: str) -> None:
    if st.session_state.get("_lineage_modal_key") != object_key:
        return
    entry = lineage_get(object_key)
    with st.expander(f"🌳 Lineage — {object_key}", expanded=True):
        st.markdown(
            f"<div class='lineage-l'>"
            f"<span class='lvl-pill'>L1</span><b>Business Meaning</b><br/>"
            f"<p>{entry.l1_business}</p>"
            f"</div>",
            unsafe_allow_html=True,
        )
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L2</span><b>Warehouse Source</b></div>",
                    unsafe_allow_html=True)
        st.code(entry.l2_warehouse, language="sql")
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L3</span><b>Transformation Logic</b></div>",
                    unsafe_allow_html=True)
        st.code(entry.l3_transformation, language="sql")
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L4</span><b>Repo / Code Lineage</b></div>",
                    unsafe_allow_html=True)
        for ref in entry.l4_code_refs:
            st.markdown(f"- `{ref}`")
        if st.button("✕ Close", key=f"lin_close_{object_key}"):
            st.session_state["_lineage_modal_key"] = None
            st.rerun()
