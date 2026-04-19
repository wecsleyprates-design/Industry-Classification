"""Reusable KPI card with the trust-layer buttons wired in."""
from __future__ import annotations

import streamlit as st

from . import trust_layer


def kpi(label: str, value: str, *, sub: str = "", delta: float | None = None,
        color: str = "", object_key: str | None = None, trust: bool = True) -> None:
    key = object_key or label
    cls = color or ""
    delta_html = ""
    if delta is not None:
        arrow = "▲" if delta >= 0 else "▼"
        cls_d = "up" if delta >= 0 else "down"
        mag = abs(delta)
        delta_html = f"<div class='delta {cls_d}'>{arrow} {mag}</div>"

    st.markdown(
        f"<div class='kyb-kpi {cls}'>"
        f"<div class='lbl'>{label}</div>"
        f"<div class='val'>{value}</div>"
        f"<div class='sub'>{sub}</div>"
        f"{delta_html}"
        f"</div><span class='trustlayer-hook'></span>",
        unsafe_allow_html=True,
    )
    if trust:
        trust_layer.render(key)
