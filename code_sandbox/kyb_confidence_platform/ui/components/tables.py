"""Dataframe rendering helpers + severity badges."""
from __future__ import annotations

from typing import Iterable

import pandas as pd
import streamlit as st


def render_dataframe(df: pd.DataFrame, *, hide_index: bool = True) -> None:
    if df is None or df.empty:
        st.info("No rows.")
        return
    st.dataframe(df, use_container_width=True, hide_index=hide_index)


def severity_pill(severity: str) -> str:
    severity = (severity or "").lower()
    if severity in ("critical", "high"): return "red"
    if severity == "medium": return "amber"
    if severity == "low": return "blue"
    return "gray"


def pill_markdown(text: str, color: str) -> str:
    return f"<span class='kyb-pill {color}'>{text}</span>"


def render_findings(findings: Iterable) -> None:
    any_rendered = False
    for f in findings:
        any_rendered = True
        cls = severity_pill(f.severity.value if hasattr(f, "severity") else f.get("severity", ""))
        title = f.title if hasattr(f, "title") else f.get("title", "")
        desc  = f.description if hasattr(f, "description") else f.get("description", "")
        evid  = f.evidence if hasattr(f, "evidence") else f.get("evidence", "")
        reco  = f.recommendation if hasattr(f, "recommendation") else f.get("recommendation", "")
        sev   = f.severity.value if hasattr(f, "severity") else f.get("severity", "")
        st.markdown(
            f"<div class='kyb-flag {cls}'>"
            f"<b>{title}</b> &nbsp;{pill_markdown(sev.upper(), cls)}<br/>"
            f"{desc}<br/>"
            f"<span style='opacity:.8'>evidence: {evid}</span><br/>"
            f"<span style='opacity:.8'>action: {reco}</span>"
            f"</div>",
            unsafe_allow_html=True,
        )
    if not any_rendered:
        st.markdown("<div class='kyb-flag green'>No findings.</div>", unsafe_allow_html=True)
