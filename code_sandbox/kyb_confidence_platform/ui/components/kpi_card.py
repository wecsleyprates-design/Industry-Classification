"""
KPI card + panel helpers with fully functional trust-layer buttons.

Approach:
  - KPI card HTML has NO onclick buttons (postMessage doesn't work in Streamlit iframes).
  - Instead, three real st.button() calls are rendered immediately after the card HTML
    inside a negative-margin CSS wrapper (.trust-row) that visually floats them into the
    card's top-right corner, matching the prototype look exactly.
  - panel() / panel_close() work the same way: panel renders the header HTML + title,
    then the caller renders content, then calls panel_buttons() to attach the trust buttons,
    then panel_close() closes the div.
"""
from __future__ import annotations

import streamlit as st

from . import trust_layer


# ── KPI card ─────────────────────────────────────────────────────────────────

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

    sub_html = f"<div class='sub'>{sub}</div>" if sub else ""

    # Card HTML — no onclick buttons inside (they don't work in Streamlit iframe)
    st.markdown(
        f"<div class='kyb-kpi {cls}'>"
        f"<div class='lbl'>{label}</div>"
        f"<div class='val'>{value}</div>"
        f"{sub_html}"
        f"{delta_html}"
        f"</div>",
        unsafe_allow_html=True,
    )

    # Real interactive buttons — CSS pulls them into the card's top-right corner
    if trust:
        _trust_buttons(key)
        trust_layer.render_panels(key)


def _trust_buttons(key: str) -> None:
    """
    Render Ask AI / Check-Agent / Lineage as real st.buttons.
    CSS class .trust-row gives them a negative top-margin so they visually
    float up into the card above them (matching the prototype layout).
    """
    st.markdown("<div class='trust-row'>", unsafe_allow_html=True)
    b1, b2, b3, _pad = st.columns([1, 1, 1, 9])
    with b1:
        if st.button("🪄", key=f"ask_{key}",
                     help="Ask AI about this metric",
                     use_container_width=True):
            trust_layer.open_ask(key)
    with b2:
        if st.button("🛡", key=f"chk_{key}",
                     help="Run Check-Agent scan on this object",
                     use_container_width=True):
            trust_layer.open_check(key)
    with b3:
        if st.button("🌳", key=f"lin_{key}",
                     help="View 4-level data lineage",
                     use_container_width=True):
            trust_layer.open_lineage(key)
    st.markdown("</div>", unsafe_allow_html=True)


# ── Panel helpers ─────────────────────────────────────────────────────────────

def panel_header(title: str, icon: str = "fa-chart-bar", *,
                 object_key: str | None = None) -> None:
    """Render the panel opening HTML + title. Call panel_close() after content."""
    st.markdown(
        f"<div class='kyb-panel'>"
        f"<h3><i class='fa-solid {icon}'></i> {title}</h3>",
        unsafe_allow_html=True,
    )
    if object_key or title:
        _trust_buttons(object_key or title)
        trust_layer.render_panels(object_key or title)


def panel_close() -> None:
    """Close the panel div opened by panel_header()."""
    st.markdown("</div>", unsafe_allow_html=True)


# Keep backward-compatible string-returning panel() for pages that use
# st.markdown(panel(...), unsafe_allow_html=True) pattern.
def panel(title: str, icon: str = "fa-chart-bar", *,
          object_key: str | None = None) -> str:
    """
    Backward-compatible: returns opening HTML string.
    Pages that use this pattern should migrate to panel_header() / panel_close().
    The trust buttons are rendered via the returned HTML's own CSS — they are
    NOT functional via this path. Use panel_header() for interactive buttons.
    """
    return (
        f"<div class='kyb-panel'>"
        f"<h3><i class='fa-solid {icon}'></i> {title}</h3>"
    )
