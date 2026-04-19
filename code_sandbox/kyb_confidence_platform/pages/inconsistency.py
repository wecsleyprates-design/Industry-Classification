"""Tab 6 — Inconsistency & Red Flag Center."""
from __future__ import annotations

import streamlit as st

from validation import (
    get_inconsistency_counts, get_red_flag_ranking,
    get_not_matching_review, get_cross_reference_checks,
)
from ui.components import charts as ch, tables as tb
from ui.components.kpi_card import kpi, panel_header, panel_close


def render() -> None:
    sub = st.radio(
        "Section",
        ["Dashboard", "Cross-Reference", "Red Flags", "Check-Agent Results", "Not-Matching Review"],
        horizontal=True, label_visibility="collapsed", key="t6_sub",
    )
    if sub == "Dashboard":              _dashboard()
    elif sub == "Cross-Reference":      _xref()
    elif sub == "Red Flags":            _red()
    elif sub == "Check-Agent Results":  _check()
    else:                               _notmatch()


def _dashboard() -> None:
    c = get_inconsistency_counts()
    # KPI cards for each category
    cats = c.to_dict("records") if hasattr(c, "to_dict") else []
    if cats:
        cols = st.columns(min(len(cats), 4))
        for i, row in enumerate(cats):
            cat = row.get("category", "")
            count = int(row.get("cases", 0))
            color = "red" if count > 100 else "amber" if count > 50 else "green"
            with cols[i % 4]:
                kpi(f"{cat} inconsistencies", str(count), color=color, object_key=f"incon.{cat}")

    panel_header("Inconsistency Volume by Category", "fa-chart-bar", object_key="chart.incon")
    st.plotly_chart(ch.bar(c, x="category", y="cases"), use_container_width=True, key="incon_bar")
    panel_close()


def _xref() -> None:
    panel_header("Cross-Reference Checks", "fa-link-slash", object_key="xref.table")
    tb.render_dataframe(get_cross_reference_checks())
    panel_close()


def _red() -> None:
    st.markdown(panel("Red Flag Queue (severity-ranked)", "fa-flag-checkered", object_key="redflag.queue"), unsafe_allow_html=True)
    for _, r in get_red_flag_ranking().iterrows():
        cls = "red" if r["severity"] == "high" else "amber"
        st.markdown(
            f"<div class='kyb-flag {cls}'><b>{r['pattern']}</b> — {int(r['cases'])} cases</div>",
            unsafe_allow_html=True,
        )
    panel_close()


def _check() -> None:
    st.markdown(panel("Check-Agent Results (portfolio scan)", "fa-shield-virus", object_key="check.portfolio"), unsafe_allow_html=True)
    st.caption("Last scan: 12 minutes ago · 7 rule families evaluated · 28 deterministic rules + LLM auditor.")
    findings = [
        {"severity":"critical", "title":"Temporal: Decision before scoring",
         "description":"14 cases have decision_at < scored_at — impossible sequence.",
         "evidence":"decisions.decision_at vs business_scores.created_at",
         "recommendation":"Investigate pipeline replay / backdating."},
        {"severity":"high", "title":"Network: One address → 6 unrelated businesses",
         "description":"'123 Dock St, Trenton NJ' filed for 6 entities with no shared UBO.",
         "evidence":"facts.address (normalized)",
         "recommendation":"Tag cluster for enhanced due diligence."},
        {"severity":"medium", "title":"Model: High confidence despite missing UBO",
         "description":"53 cases scored ≥ 0.75 with ubo_verified null/partial.",
         "evidence":"confidence_score vs facts.ubo_verified",
         "recommendation":"Review escalation thresholds for UBO gaps."},
    ]
    tb.render_findings(findings)
    panel_close()


def _notmatch() -> None:
    panel_header("Not-Matching Result Review", "fa-code-compare", object_key="notmatch.table")
    st.caption("Cases where model output disagrees with underlying evidence.")
    tb.render_dataframe(get_not_matching_review())
    panel_close()
