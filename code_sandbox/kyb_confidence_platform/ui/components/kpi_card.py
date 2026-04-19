"""Reusable KPI card with inline trust-layer icon buttons.

The three action buttons (Ask AI 🪄 / Check-Agent 🛡 / Lineage 🌳) are
rendered inside the card's own st.container — no cross-container CSS
positioning hacks required. The card HTML is rendered first, then the
buttons appear as a tightly-spaced row of mini icons directly below the
card value, visually overlapping via CSS margin.
"""
from __future__ import annotations

import streamlit as st

from . import trust_layer


def kpi(
    label: str,
    value: str,
    *,
    sub: str = "",
    delta: float | None = None,
    color: str = "",
    object_key: str | None = None,
    trust: bool = True,
) -> None:
    key = object_key or label
    cls = color or ""

    delta_html = ""
    if delta is not None:
        arrow = "▲" if delta >= 0 else "▼"
        cls_d = "up" if delta >= 0 else "down"
        delta_html = f"<div class='delta {cls_d}'>{arrow} {abs(delta)}</div>"

    # ── KPI card HTML ─────────────────────────────────────────────────────────
    st.markdown(
        f"<div class='kyb-kpi {cls}'>"
        f"<div class='lbl'>{label}</div>"
        f"<div class='val'>{value}</div>"
        f"<div class='sub'>{sub}</div>"
        f"{delta_html}"
        f"</div>",
        unsafe_allow_html=True,
    )

    # ── Trust-layer icon buttons — rendered immediately below the card ─────────
    if trust:
        trust_layer.render(key)

    # ── Expander panels (Ask AI / Check-Agent / Lineage) ─────────────────────
    # These render below the current column — safe, no nesting issues.
    trust_layer.render_panels(key)
