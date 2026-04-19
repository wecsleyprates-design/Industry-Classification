"""
KPI card that exactly matches the HTML prototype reference.

The trust-bar (Ask AI / Check-Agent / Lineage buttons) is rendered INSIDE
the card HTML using FontAwesome icons — positioned absolute top-right, semi-
transparent, hover reveals full opacity. This matches the prototype exactly.

The panel() helper wraps any content block (charts, tables) in the same
panel HTML structure with its own trust-bar header.
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
    """Render a KPI card with embedded trust-bar icons."""
    key = object_key or label
    cls = color or ""

    delta_html = ""
    if delta is not None:
        arrow = "▲" if delta >= 0 else "▼"
        cls_d = "up" if delta >= 0 else "down"
        delta_html = f"<div class='delta {cls_d}'>{arrow} {abs(delta)}</div>"

    trust_html = ""
    if trust:
        trust_html = f"""
        <div class="trust-bar">
          <button class="trust-btn" title="Ask AI"
            onclick="window.parent.postMessage({{type:'ask_ai',key:'{key}'}}, '*')">
            <i class="fa-solid fa-wand-magic-sparkles"></i></button>
          <button class="trust-btn" title="Check-Agent"
            onclick="window.parent.postMessage({{type:'check_agent',key:'{key}'}}, '*')">
            <i class="fa-solid fa-shield-virus"></i></button>
          <button class="trust-btn" title="Lineage"
            onclick="window.parent.postMessage({{type:'lineage',key:'{key}'}}, '*')">
            <i class="fa-solid fa-sitemap"></i></button>
        </div>"""

    sub_html = f"<div class='sub'>{sub}</div>" if sub else ""
    st.markdown(
        f"<div class='kyb-kpi {cls}'>"
        f"{trust_html}"
        f"<div class='lbl'>{label}</div>"
        f"<div class='val'>{value}</div>"
        f"{sub_html}"
        f"{delta_html}"
        f"</div>",
        unsafe_allow_html=True,
    )

    # Render the action panel (expander) if this card's button was clicked
    if trust:
        trust_layer.render_panels(key)


def panel(
    title: str,
    icon: str = "fa-chart-bar",
    *,
    object_key: str | None = None,
) -> str:
    """
    Return the opening HTML for a panel section with a trust-bar header.
    Usage:
        st.markdown(panel("My Chart", "fa-chart-pie", object_key="chart.bands"), unsafe_allow_html=True)
        st.plotly_chart(...)
        st.markdown("</div>", unsafe_allow_html=True)  # close panel

    Or use the context-manager style helper panel_wrap() below.
    """
    key = object_key or title
    return f"""
<div class="kyb-panel">
  <div class="trust-bar">
    <button class="trust-btn" title="Ask AI"
      onclick="window.parent.postMessage({{type:'ask_ai',key:'{key}'}}, '*')">
      <i class="fa-solid fa-wand-magic-sparkles"></i></button>
    <button class="trust-btn" title="Check-Agent"
      onclick="window.parent.postMessage({{type:'check_agent',key:'{key}'}}, '*')">
      <i class="fa-solid fa-shield-virus"></i></button>
    <button class="trust-btn" title="Lineage"
      onclick="window.parent.postMessage({{type:'lineage',key:'{key}'}}, '*')">
      <i class="fa-solid fa-sitemap"></i></button>
  </div>
  <h3><i class="fa-solid {icon}"></i> {title}</h3>
"""


def panel_close() -> str:
    """Return the closing </div> for a panel() block."""
    return "</div>"
