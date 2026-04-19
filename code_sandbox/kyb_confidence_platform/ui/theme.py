"""Injects the app-wide dark theme CSS (matches `.streamlit/config.toml`)."""
from __future__ import annotations

import streamlit as st


_CSS = """
<style>
/* Top bar */
.app-logo {
    font-size: 1.15rem; font-weight: 700; color: #F1F5F9;
    padding-top: 6px; letter-spacing: .01em;
}
.env-badge {
    background: #0B2545; color: #60A5FA; border: 1px solid #1E3A5F;
    padding: 2px 10px; border-radius: 14px; font-size: .7rem;
    font-weight: 600; letter-spacing: .05em; margin-left: 10px;
}
.chip {
    background: #1E293B; border: 1px solid #334155;
    padding: 4px 10px; border-radius: 14px; font-size: .74rem; color:#94A3B8;
    display: inline-block; margin: 0 4px; white-space: nowrap;
}
.chip.ok   { border-color:#14532d; color:#86efac; }
.chip.warn { border-color:#78350f; color:#fde68a; }
.chip.err  { border-color:#7f1d1d; color:#fca5a5; }
hr.thin-sep { margin: 6px 0; border-color: #1E3A5F; }

/* KPI card */
.kyb-kpi {
    background: #1E293B; border-radius: 10px; padding: 12px 16px;
    border-left: 4px solid #3B82F6; margin-bottom: 6px;
}
.kyb-kpi .lbl   { color:#94A3B8; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; font-weight:600;}
.kyb-kpi .val   { color:#F1F5F9; font-size:1.45rem; font-weight:700; margin-top:2px;}
.kyb-kpi .sub   { color:#64748B; font-size:.72rem; margin-top:2px;}
.kyb-kpi .delta.up   { color:#22c55e; font-size:.7rem; font-weight:600;}
.kyb-kpi .delta.down { color:#ef4444; font-size:.7rem; font-weight:600;}

.kyb-kpi.green  { border-left-color:#22c55e; }
.kyb-kpi.amber  { border-left-color:#f59e0b; }
.kyb-kpi.red    { border-left-color:#ef4444; }
.kyb-kpi.purple { border-left-color:#a855f7; }
.kyb-kpi.cyan   { border-left-color:#06b6d4; }

/* Flag boxes */
.kyb-flag { border-radius:8px; padding:10px 14px; margin:6px 0; font-size:.85rem; }
.kyb-flag.red    { background:#1f0a0a; border-left:4px solid #ef4444; color:#fca5a5; }
.kyb-flag.amber  { background:#1c1917; border-left:4px solid #f59e0b; color:#fde68a; }
.kyb-flag.green  { background:#052e16; border-left:4px solid #22c55e; color:#86efac; }
.kyb-flag.blue   { background:#0c1a2e; border-left:4px solid #60a5fa; color:#93c5fd; }

/* Lineage modal contents */
.lineage-l pre {
    background:#0F172A; border:1px solid #1E3A5F; border-radius:6px;
    padding:10px 12px; font-size:.78rem; white-space:pre-wrap;
}
.lvl-pill {
    display:inline-block; background:#2563EB; color:#fff;
    padding:2px 8px; border-radius:10px; font-size:.65rem;
    font-weight:700; margin-right:8px;
}

/* Pills */
.kyb-pill { display:inline-block; padding:2px 9px; border-radius:12px; font-size:.7rem; font-weight:600; }
.kyb-pill.green  { background:#052e16; color:#86efac; }
.kyb-pill.amber  { background:#1c1917; color:#fde68a; }
.kyb-pill.red    { background:#1f0a0a; color:#fca5a5; }
.kyb-pill.blue   { background:#0c1a2e; color:#93c5fd; }
.kyb-pill.gray   { background:#273445; color:#94A3B8; }

/* Trust-layer icon button strip — compact row of 3 micro-buttons */
.trust-btn-row { display:flex; gap:4px; margin-top:2px; margin-bottom:4px; }
/* Shrink Streamlit's default button padding for the trust-layer columns */
div[data-testid="column"]:has(button[kind="secondary"]) button[kind="secondary"] {
    padding: 2px 6px !important;
    height: 26px !important;
    min-height: 26px !important;
    font-size: 0.82rem !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    background: rgba(255,255,255,0.04) !important;
    color: #94A3B8 !important;
    border-radius: 5px !important;
}
div[data-testid="column"]:has(button[kind="secondary"]) button[kind="secondary"]:hover {
    background: rgba(255,255,255,0.10) !important;
    border-color: rgba(255,255,255,0.35) !important;
    color: #F1F5F9 !important;
}
</style>
"""


def inject_theme() -> None:
    st.markdown(_CSS, unsafe_allow_html=True)
