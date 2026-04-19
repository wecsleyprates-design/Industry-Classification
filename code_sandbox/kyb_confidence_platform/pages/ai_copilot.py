"""Tab 9 — AI Copilot & Check-Agent."""
from __future__ import annotations

import json

import streamlit as st

from ai.check_agent import run_check_agent, Scope
from ai.check_agent.taxonomy import RuleFamily
from ai.client import chat_completion, openai_status
from ai.prompts import COPILOT_SYSTEM, COPILOT_USER_TEMPLATE
from ai.view_generator import generate_view
from core.filters import current_filters
from knowledge.metadata_catalog import GLOSSARY
from investigation import build_check_agent_context
from ui.components import tables as tb


def render() -> None:
    sub = st.radio(
        "Section",
        ["Ask the AI", "Check-Agent Console", "Investigation Workspace", "Glossary"],
        horizontal=True, label_visibility="collapsed", key="t9_sub",
    )
    if sub == "Ask the AI":                   _ask()
    elif sub == "Check-Agent Console":         _console()
    elif sub == "Investigation Workspace":     _war_room()
    else:                                      _glossary()


def _ask() -> None:
    st.caption(f"AI status: **{openai_status()}**. Without a live key, offline fallback answers are returned.")
    mode = st.radio("Mode", ["Chat", "AI View Generator"], horizontal=True, key="copilot_mode")
    if mode == "Chat":
        _chat()
    else:
        _view_gen()


def _chat() -> None:
    q = st.text_input("Your question", key="copilot_q", placeholder="e.g. Why did manual review rise for foreign entities?")
    if st.button("Ask", type="primary"):
        if not q:
            st.warning("Type a question.")
        else:
            f = current_filters()
            msgs = [
                {"role":"system","content": COPILOT_SYSTEM},
                {"role":"user","content": COPILOT_USER_TEMPLATE.format(
                    object_context="Copilot general chat",
                    filters=f"date_range={f.date_range}, date_context={f.date_context}, customer={f.customer}, business_id={f.business_id}",
                    rag_evidence="(retrieval enabled if ChromaDB index is built)",
                    question=q,
                )},
            ]
            st.markdown(f"<div class='kyb-flag blue'>{chat_completion(msgs)}</div>", unsafe_allow_html=True)


def _view_gen() -> None:
    st.caption("Describe an analysis in plain English. The AI will interpret → write SQL → execute → render a visual.")
    prompt = st.text_input("Prompt", key="vg_prompt",
                           placeholder="e.g. Weekly trend of low-confidence cases in Texas")
    if st.button("Generate View", type="primary"):
        if not prompt:
            st.warning("Type a prompt.")
            return
        view = generate_view(prompt, active_filters={"customer": st.session_state.get("flt_customer")})
        st.markdown(f"**Intent:** {view.intent_summary}")
        st.code(view.sql, language="sql")
        if view.error:
            st.error(view.error)
        if view.figure is not None:
            st.plotly_chart(view.figure, use_container_width=True)
        if view.dataframe is not None and not view.dataframe.empty:
            st.dataframe(view.dataframe, use_container_width=True, hide_index=True)
        with st.expander("Raw AI envelope"):
            st.code(json.dumps(view.raw_envelope, indent=2), language="json")


def _console() -> None:
    scope = st.selectbox("Scope", ["portfolio", "entity", "object"])
    families = st.multiselect(
        "Rule families",
        [f.value for f in RuleFamily],
        default=[f.value for f in RuleFamily],
    )
    include_llm = st.checkbox("Include LLM auditor", value=True)

    if st.button("Run scan", type="primary"):
        ctx = build_check_agent_context(st.session_state.get("flt_business_id", "bus_demo"))
        res = run_check_agent(
            ctx,
            scope=Scope(scope),
            families=[RuleFamily(f) for f in families],
            include_llm_auditor=include_llm,
        )
        st.metric("Findings", len(res.findings))
        tb.render_findings(res.findings)


def _war_room() -> None:
    st.subheader("Investigation Workspace")
    bid = st.session_state.get("flt_business_id") or "bus_demo"
    ctx = build_check_agent_context(bid)
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**Profile**")
        st.markdown(f"- Business ID: `{ctx['entity_id']}`")
        st.markdown(f"- Confidence: **{ctx['score']:.2f}** ({ctx['band']})")
        st.markdown(f"- Decision: **{ctx['decision']}**")
        st.markdown("**Key evidence**")
        for k, v in list(ctx["facts"].items())[:8]:
            st.markdown(f"- `{k}` = `{v}`")
    with c2:
        st.markdown("**AI explanation**")
        msgs = [
            {"role":"system","content": COPILOT_SYSTEM},
            {"role":"user","content": COPILOT_USER_TEMPLATE.format(
                object_context=f"Entity context for {bid}",
                filters="(current filters)",
                rag_evidence="(RAG optional)",
                question=f"Summarize the top risks and recommended actions for {bid}.",
            )},
        ]
        st.markdown(f"<div class='kyb-flag blue'>{chat_completion(msgs)}</div>", unsafe_allow_html=True)


def _glossary() -> None:
    import pandas as pd
    st.dataframe(pd.DataFrame(GLOSSARY, columns=["term","definition"]), use_container_width=True, hide_index=True)
