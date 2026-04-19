"""
Trust-layer buttons.

Attaches three actions to every important object: Ask AI, Run Check-Agent,
View Lineage. The object is identified by a `key` that maps into
`config.lineage_catalog`.
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
    """Tracks which object, if any, currently has Ask/Check/Lineage open."""
    active_object_key: str | None = None

    @staticmethod
    def current() -> "TrustLayerContext":
        return TrustLayerContext(
            active_object_key=st.session_state.get("_active_object"),
        )


def render(object_key: str, *, inline: bool = True) -> None:
    """Render Ask / Check-Agent / Lineage buttons for `object_key`."""
    c1, c2, c3 = st.columns([1, 1, 1])
    
    label_ask = "🪄" if inline else "🪄 Ask AI"
    label_chk = "🛡" if inline else "🛡 Check-Agent"
    label_lin = "🌳" if inline else "🌳 Lineage"
    
    with c1:
        if st.button(label_ask, key=f"ask_{object_key}", use_container_width=True, help="Ask the Copilot about this object"):
            st.session_state["_ask_ai_open_for"] = object_key
    with c2:
        if st.button(label_chk, key=f"chk_{object_key}", use_container_width=True, help="Scan this object for inconsistencies"):
            st.session_state["_check_agent_open_for"] = object_key
    with c3:
        if st.button(label_lin, key=f"lin_{object_key}", use_container_width=True, help="View 4-level lineage"):
            st.session_state["_lineage_modal_key"] = object_key

    _render_ask_ai_panel(object_key)
    _render_check_agent_panel(object_key)
    _render_lineage_panel(object_key)


def _render_ask_ai_panel(object_key: str) -> None:
    if st.session_state.get("_ask_ai_open_for") != object_key:
        return
    with st.expander(f"🪄 Ask AI — {object_key}", expanded=True):
        q = st.text_input("Question", key=f"ask_q_{object_key}", placeholder="What changed and why?")
        cols = st.columns([1, 1, 1, 1])
        presets = ["Why did this change?", "Breakdown by segment?", "Lineage of this field?", "Show the SQL."]
        clicked = None
        for i, p in enumerate(presets):
            if cols[i].button(p, key=f"ask_preset_{object_key}_{i}"):
                clicked = p
        question = clicked or q
        if st.button("Ask", key=f"ask_btn_{object_key}"):
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
                            f"customer={f.customer}, business_id={f.business_id}, "
                            f"entity_type={f.entity_type}, band={f.confidence_band}, manual_only={f.manual_only}"
                        ),
                        rag_evidence="(RAG not included in prototype trust-layer popup)",
                        question=question,
                    )},
                ]
                answer = chat_completion(messages, temperature=0.2)
                st.markdown(f"<div class='kyb-flag blue'>{answer}</div>", unsafe_allow_html=True)
        if st.button("Close", key=f"ask_close_{object_key}"):
            st.session_state["_ask_ai_open_for"] = None


def _render_check_agent_panel(object_key: str) -> None:
    if st.session_state.get("_check_agent_open_for") != object_key:
        return
    with st.expander(f"🛡 Check-Agent — {object_key}", expanded=True):
        st.caption("Running deterministic rules + (optional) LLM auditor.")
        # For object-level scans we build a lightweight context. Entity-level
        # scans pass through `investigation.entity.build_check_agent_context`
        # from the Entity 360 page.
        ctx = st.session_state.get("_check_agent_context") or {"entity_id": "object", "facts": {}, "score": 0.0}
        res = run_check_agent(ctx, scope=Scope.OBJECT)
        if not res.findings:
            st.markdown("<div class='kyb-flag green'>No inconsistencies found for this object.</div>", unsafe_allow_html=True)
        else:
            sev_class = {"critical":"red","high":"red","medium":"amber","low":"blue"}
            for f in res.findings:
                cls = sev_class.get(f.severity.value, "amber")
                st.markdown(
                    f"<div class='kyb-flag {cls}'>"
                    f"<b>[{f.severity.value.upper()}] {f.title}</b><br/>"
                    f"{f.description}<br/>"
                    f"<span class='small'>evidence: {f.evidence}</span><br/>"
                    f"<span class='small'>recommendation: {f.recommendation}</span>"
                    f"</div>", unsafe_allow_html=True)
        if st.button("Close", key=f"chk_close_{object_key}"):
            st.session_state["_check_agent_open_for"] = None


def _render_lineage_panel(object_key: str) -> None:
    if st.session_state.get("_lineage_modal_key") != object_key:
        return
    entry = lineage_get(object_key)
    with st.expander(f"🌳 Lineage — {object_key}", expanded=True):
        st.markdown(
            f"<div class='lineage-l'><span class='lvl-pill'>L1</span><b>Business Meaning</b><br/>{entry.l1_business}</div>",
            unsafe_allow_html=True,
        )
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L2</span><b>Warehouse Source</b></div>", unsafe_allow_html=True)
        st.code(entry.l2_warehouse, language="sql")
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L3</span><b>Transformation Logic</b></div>", unsafe_allow_html=True)
        st.code(entry.l3_transformation, language="sql")
        st.markdown("<div class='lineage-l'><span class='lvl-pill'>L4</span><b>Repo / Code Lineage</b></div>", unsafe_allow_html=True)
        for ref in entry.l4_code_refs:
            st.markdown(f"- `{ref}`")
        if st.button("Close", key=f"lin_close_{object_key}"):
            st.session_state["_lineage_modal_key"] = None
