"""
KPI card with embedded trust-layer icon buttons.

The three icons (🪄 Ask AI / 🛡 Check-Agent / 🌳 Lineage) are rendered as
small HTML buttons positioned in the TOP-RIGHT corner of the card — exactly
as shown in the design reference.

Technical approach:
  - The card itself is pure HTML (st.markdown unsafe_allow_html).
  - The icon strip is rendered as three tightly-spaced Streamlit buttons
    in a zero-margin column row, placed visually over the card via CSS.
  - The card HTML includes a `data-kpi-key` attribute so the CSS can target
    just the next sibling button row without a fragile :has() selector.
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

    # ── Card HTML ─────────────────────────────────────────────────────────────
    # position:relative so the absolute icon strip can anchor to it
    st.markdown(
        f"<div class='kyb-kpi {cls}' style='position:relative;padding-bottom:28px'>"
        f"<div class='lbl'>{label}</div>"
        f"<div class='val'>{value}</div>"
        f"<div class='sub'>{sub}</div>"
        f"{delta_html}"
        f"</div>",
        unsafe_allow_html=True,
    )

    # ── Trust icon strip ──────────────────────────────────────────────────────
    # Rendered immediately after the card in the same column.
    # The CSS `.kpi-trust-row` pulls it up to overlap the card bottom-right.
    if trust:
        trust_layer.render(key)

    # ── Panel expanders (open below the full row) ─────────────────────────────
    trust_layer.render_panels(key)
