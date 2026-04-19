"""Tab 6 — Inconsistency & Red Flag Center."""
from __future__ import annotations

import streamlit as st

from validation import (
    get_inconsistency_counts, get_red_flag_ranking,
    get_not_matching_review, get_cross_reference_checks,
)
from ui.components import charts as ch, tables as tb


def render() -> None:
    sub = st.radio(
        "Section",
        ["Dashboard", "Cross-Reference", "Red Flags", "Check-Agent Results", "Not-Matching Review"],
        horizontal=True, label_visibility="collapsed", key="t6_sub",
    )
    if sub == "Dashboard":             _dashboard()
    elif sub == "Cross-Reference":     _xref()
    elif sub == "Red Flags":           _red()
    elif sub == "Check-Agent Results": _check()
    else:                              _notmatch()


def _dashboard() -> None:
    c = get_inconsistency_counts()
    st.plotly_chart(ch.bar(c, x="category", y="cases"), use_container_width=True)


def _xref() -> None:
    st.subheader("Cross-reference checks")
    tb.render_dataframe(get_cross_reference_checks())


def _red() -> None:
    st.subheader("Red flag queue")
    for _, r in get_red_flag_ranking().iterrows():
        cls = "red" if r["severity"] == "high" else "amber"
        st.markdown(
            f"<div class='kyb-flag {cls}'><b>{r['pattern']}</b> — {int(r['cases'])} cases</div>",
            unsafe_allow_html=True,
        )


def _check() -> None:
    st.info("Portfolio-level Check-Agent. This page shows an aggregate summary. "
            "Run it on a specific entity from the Customer/Business 360 tab.")
    findings = [
        {"severity": "critical", "title": "Temporal: decision before scoring",
         "description": "14 cases have decision_at < scored_at.",
         "evidence": "cases.decision_at vs business_scores.created_at",
         "recommendation": "Investigate pipeline replay / backdating."},
        {"severity": "high", "title": "Network: one address → 6 unrelated businesses",
         "description": "Suspicious cluster around '123 Dock St' with no shared UBO.",
         "evidence": "facts.address (normalized)",
         "recommendation": "Tag cluster for enhanced due diligence."},
        {"severity": "medium", "title": "Model: high confidence despite missing UBO",
         "description": "53 cases scored ≥0.75 with partial/null UBO verification.",
         "evidence": "confidence_score vs facts.ubo_verified",
         "recommendation": "Review escalation thresholds."},
    ]
    tb.render_findings(findings)


def _notmatch() -> None:
    st.subheader("Not-matching result review")
    tb.render_dataframe(get_not_matching_review())
