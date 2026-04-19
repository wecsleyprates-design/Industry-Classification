"""Tab 5 — Customer / Business 360."""
from __future__ import annotations

import streamlit as st

from ai.check_agent import run_check_agent, Scope
from investigation import load_entity_context, build_check_agent_context
from ui.components import tables as tb
from ui.components.kpi_card import kpi
from ui.components import relationship_graph as rg


def render() -> None:
    business_id = st.session_state.get("flt_business_id") or st.session_state.get("selected_entity_id") or "bus_demo"
    ctx = load_entity_context(business_id)

    sub = st.radio(
        "Section",
        ["Summary", "Timeline", "Features", "Verification", "Related Records", "Risk & Flags"],
        horizontal=True, label_visibility="collapsed", key="t5_sub",
    )

    if sub == "Summary":         _summary(ctx)
    elif sub == "Timeline":      _timeline(ctx)
    elif sub == "Features":      _features(ctx)
    elif sub == "Verification":  _verification(ctx)
    elif sub == "Related Records":_related(ctx)
    else:                        _risk(ctx, business_id)


def _summary(ctx) -> None:
    p = ctx["profile_df"].iloc[0] if not ctx["profile_df"].empty else None
    if p is None:
        st.info("No entity loaded.")
        return
    st.markdown(f"### {p.get('legal_name','?')}  &nbsp; <span class='kyb-pill gray'>{p.get('entity_type','?')}</span>", unsafe_allow_html=True)

    c1, c2, c3 = st.columns(3)
    c1.markdown(f"**Business ID**<br/>{p.get('business_id','—')}", unsafe_allow_html=True)
    c2.markdown(f"**DBA**<br/>{p.get('dba','—')}", unsafe_allow_html=True)
    c3.markdown(f"**Customer**<br/>{p.get('customer','—')}", unsafe_allow_html=True)
    c4, c5, c6 = st.columns(3)
    c4.markdown(f"**EIN (masked)**<br/>{p.get('ein','—')}", unsafe_allow_html=True)
    c5.markdown(f"**Jurisdiction**<br/>{p.get('jurisdiction','—')}", unsafe_allow_html=True)
    c6.markdown(f"**Registration**<br/><span class='kyb-pill green'>{p.get('registration','—')}</span>", unsafe_allow_html=True)

    k1, k2, k3, k4 = st.columns(4)
    with k1: kpi("Confidence Score", f"{float(p.get('confidence', 0.63)):.2f}", sub=str(p.get('band', 'Medium')), color="amber", object_key="entity.confidence")
    with k2: kpi("Decision",         str(p.get('decision','—')), sub=f"at {p.get('decision_at','—')}", color="amber", object_key="entity.decision")
    with k3: kpi("Red Flags",        str(int(p.get('red_flags', 3))), color="red", object_key="entity.red_flags")
    with k4: kpi("Time to Score",    "2 min", sub=str(p.get('scored_at','—')), color="green", object_key="entity.tts")


def _timeline(ctx) -> None:
    st.subheader("Event timeline")
    for e in ctx["timeline"]:
        cls = {"green":"green","amber":"amber","red":"red"}.get(e.get("tone"), "blue")
        st.markdown(
            f"<div class='kyb-flag {cls}'>"
            f"<span style='opacity:.7'>{e['ts']}</span> — "
            f"<b>{e['title']}</b><br/>{e['desc']}"
            f"</div>", unsafe_allow_html=True,
        )


def _features(ctx) -> None:
    st.subheader("Feature snapshot")
    tb.render_dataframe(ctx["features_df"])


def _verification(ctx) -> None:
    st.subheader("Verification checklist")
    rows = [
        ["TIN Validation (IRS)", "Pass",  "Middesk",        "EIN matches legal name"],
        ["Registration Status",  "Pass",  "Middesk",        "Active in Delaware SOS"],
        ["Address Verification", "Warn",  "USPS / OC",      "Minor mismatch between filed and operating address"],
        ["UBO Identity (PSC)",   "Warn",  "Trulioo PSC",    "1 of 3 UBOs could not be verified"],
        ["Watchlist Screening",  "Pass",  "Trulioo",        "No sanctions, PEP, or adverse media"],
        ["Bankruptcies/Liens",   "Pass",  "Verdata",        "No records found"],
    ]
    import pandas as pd
    tb.render_dataframe(pd.DataFrame(rows, columns=["check","status","source","detail"]))


def _related(ctx) -> None:
    st.subheader("Relationship graph")
    nodes, links = rg.default_demo()
    st.plotly_chart(rg.build(nodes, links), use_container_width=True)

    st.subheader("Linked entities")
    import pandas as pd
    rels = pd.DataFrame(ctx["relationships"])
    tb.render_dataframe(rels)


def _risk(ctx, business_id: str) -> None:
    st.subheader("Red flags")
    sev_cls = {"high":"red","medium":"amber","low":"blue"}
    for rf in ctx["red_flags"]:
        st.markdown(
            f"<div class='kyb-flag {sev_cls.get(rf['severity'],'amber')}'>"
            f"<b>{rf['title']}</b><br/>{rf['desc']}<br/>"
            f"<span style='opacity:.8'>evidence: {rf['evidence']}</span>"
            f"</div>", unsafe_allow_html=True,
        )

    st.subheader("Check-Agent (deterministic + LLM)")
    if st.button("Run full scan on this entity"):
        cc = build_check_agent_context(business_id)
        st.session_state["_check_agent_context"] = cc
        res = run_check_agent(cc, scope=Scope.ENTITY)
        st.metric("Findings", len(res.findings))
        tb.render_findings(res.findings)
