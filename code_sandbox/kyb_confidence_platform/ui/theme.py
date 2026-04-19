"""
Injects the full dark-theme CSS matching the HTML/JS prototype reference exactly.

Key design decisions (copied from prototype css/style.css):
  - Trust-bar: 3 icon buttons (Ask AI / Check-Agent / Lineage) positioned
    absolute top-right inside every KPI card and panel.
  - KPI cards: dark bg, 4px left border, larger value font (1.55rem).
  - Panels: same card styling with a trust-bar under the panel title.
  - Font Awesome icons via CDN (injected in the <head> equivalent).
  - Modals: full-screen overlay via `position:fixed;inset:0` — rendered via
    Streamlit session state toggles.
"""
from __future__ import annotations

import streamlit as st

# Inject FontAwesome and Google Fonts via st.markdown in <head>
_HEAD_LINKS = """
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
"""

_CSS = """
<style>
/* ── Reset defaults that conflict ────────────────────────────────────────── */
[data-testid="stAppViewContainer"] > section > div { padding-top: 0 !important; }

/* ── CSS variables (match prototype exactly) ─────────────────────────────── */
:root {
  --bg-0:      #0A0F1E;
  --bg-1:      #0F172A;
  --bg-2:      #111827;
  --bg-3:      #1E293B;
  --bg-4:      #273445;
  --border:    #1E3A5F;
  --border-2:  #334155;

  --text-0:    #F1F5F9;
  --text-1:    #CBD5E1;
  --text-2:    #94A3B8;
  --text-3:    #64748B;

  --accent:    #3B82F6;
  --accent-2:  #60A5FA;
  --accent-3:  #2563EB;

  --green:     #22C55E;
  --green-bg:  #052E16;
  --amber:     #F59E0B;
  --amber-bg:  #1C1917;
  --red:       #EF4444;
  --red-bg:    #1F0A0A;
  --purple:    #A855F7;
  --cyan:      #06B6D4;
  --shadow:    0 8px 24px rgba(0,0,0,.35);
  --radius:    10px;
  --radius-sm: 6px;
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
.app-logo {
  font-size: 1.1rem; font-weight: 700; color: var(--text-0);
  font-family: 'Inter', sans-serif;
}
.logo-accent { color: var(--accent-2); }
.env-badge {
  background: #0B2545; color: var(--accent-2); border: 1px solid var(--border);
  padding: 3px 10px; border-radius: 14px; font-size: .68rem;
  font-weight: 600; letter-spacing: .06em; margin-left: 10px;
}
.chip { /* status chips */
  background: var(--bg-3); border: 1px solid var(--border-2);
  padding: 4px 10px; border-radius: 14px; font-size: .72rem; color: var(--text-2);
  display: inline-block;
}
.chip.ok   { border-color: #14532d; color: #86efac; }
.chip.warn { border-color: #78350f; color: #fde68a; }
.chip.err  { border-color: #7f1d1d; color: #fca5a5; }
hr.thin-sep { margin: 4px 0; border-color: var(--border); }

/* ── KPI cards ───────────────────────────────────────────────────────────── */
/*
  Full card rendered as HTML so the trust-bar can be positioned inside.
  Layout mirrors the prototype exactly:
    .kpi > .trust-bar (absolute top-right)
    .kpi > .lbl
    .kpi > .val
    .kpi > .sub
    .kpi > .delta
*/
.kyb-kpi {
  background: var(--bg-3);
  border-radius: var(--radius);
  padding: 14px 18px;
  border-left: 4px solid var(--accent);
  position: relative;
  margin-bottom: 6px;
  font-family: 'Inter', sans-serif;
}
.kyb-kpi.green  { border-left-color: var(--green); }
.kyb-kpi.amber  { border-left-color: var(--amber); }
.kyb-kpi.red    { border-left-color: var(--red); }
.kyb-kpi.purple { border-left-color: var(--purple); }
.kyb-kpi.cyan   { border-left-color: var(--cyan); }

.kyb-kpi .lbl {
  color: var(--text-2); font-size: .72rem;
  text-transform: uppercase; letter-spacing: .05em; font-weight: 600;
}
.kyb-kpi .val {
  color: var(--text-0); font-size: 1.55rem; font-weight: 700; margin-top: 4px;
}
.kyb-kpi .sub   { color: var(--text-3); font-size: .72rem; margin-top: 2px; }
.kyb-kpi .delta { font-size: .7rem; font-weight: 600; margin-top: 4px; }
.kyb-kpi .delta.up   { color: var(--green); }
.kyb-kpi .delta.down { color: var(--red); }

/* ── Trust-bar (inside KPI cards and panels) ─────────────────────────────── */
.trust-bar {
  display: flex; gap: 5px;
  position: absolute; top: 8px; right: 8px;
  opacity: 0.55; transition: opacity .15s;
}
.trust-bar:hover { opacity: 1; }
.trust-btn {
  background: var(--bg-4); color: var(--text-2);
  border: 1px solid var(--border-2);
  width: 24px; height: 24px; border-radius: 5px; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: .68rem; line-height: 1;
  transition: all .15s;
}
.trust-btn:hover { color: var(--accent-2); border-color: var(--accent); }

/* ── Panels / chart wrappers ─────────────────────────────────────────────── */
.kyb-panel {
  background: var(--bg-3); border-radius: var(--radius);
  padding: 16px 18px; margin-bottom: 14px;
  position: relative; border: 1px solid transparent;
  font-family: 'Inter', sans-serif;
}
.kyb-panel .trust-bar { top: 12px; right: 14px; }
.kyb-panel h3 {
  margin: 0 0 12px; font-size: .95rem; color: var(--text-0);
  font-weight: 600; display: flex; align-items: center; gap: 8px;
}
.kyb-panel h3 i { color: var(--accent-2); }
.kyb-panel .muted { color: var(--text-2); font-size: .82rem; }

/* ── Flag / alert boxes ──────────────────────────────────────────────────── */
.kyb-flag { border-radius: 8px; padding: 10px 14px; margin: 6px 0; font-size: .82rem; }
.kyb-flag.red    { background: var(--red-bg);   border-left: 4px solid var(--red);   color: #fca5a5; }
.kyb-flag.amber  { background: var(--amber-bg); border-left: 4px solid var(--amber); color: #fde68a; }
.kyb-flag.green  { background: var(--green-bg); border-left: 4px solid var(--green); color: #86efac; }
.kyb-flag.blue   { background: #0c1a2e;         border-left: 4px solid var(--accent-2); color: #93c5fd; }

/* ── Pills / badges ──────────────────────────────────────────────────────── */
.kyb-pill { display: inline-block; padding: 2px 9px; border-radius: 12px; font-size: .7rem; font-weight: 600; }
.kyb-pill.green  { background: #052e16; color: #86efac; }
.kyb-pill.amber  { background: #1c1917; color: #fde68a; }
.kyb-pill.red    { background: #1f0a0a; color: #fca5a5; }
.kyb-pill.blue   { background: #0c1a2e; color: #93c5fd; }
.kyb-pill.gray   { background: var(--bg-4); color: var(--text-2); }

/* ── Lineage modal ───────────────────────────────────────────────────────── */
.lineage-l pre {
  background: #0F172A; border: 1px solid var(--border);
  border-radius: 6px; padding: 10px 12px; font-size: .76rem;
  white-space: pre-wrap; word-break: break-word;
  font-family: 'SF Mono','Monaco','Consolas',monospace;
  color: var(--text-1); margin: 4px 0;
}
.lvl-pill {
  display: inline-block; background: var(--accent-3); color: #fff;
  padding: 2px 8px; border-radius: 10px; font-size: .65rem;
  font-weight: 700; margin-right: 8px;
}

/* ── Check-Agent finding cards ───────────────────────────────────────────── */
.check-finding {
  background: var(--bg-4); border-radius: var(--radius-sm);
  padding: 12px 14px; margin-bottom: 10px; border-left: 4px solid var(--accent);
}
.check-finding.critical { border-left-color: var(--red); }
.check-finding.high     { border-left-color: #f97316; }
.check-finding.medium   { border-left-color: var(--amber); }
.check-finding.low      { border-left-color: var(--accent-2); }
.check-finding h5 {
  margin: 0 0 4px; font-size: .86rem; color: var(--text-0); font-weight: 600;
}
.check-finding p { margin: 2px 0; font-size: .8rem; color: var(--text-1); }
.check-finding .evid { color: var(--text-3); font-size: .74rem; margin-top: 6px; font-family: monospace; }

/* ── Trust-layer button strip (below cards, compact) ────────────────────── */
/* When Streamlit renders the trust strip buttons below the HTML card,
   shrink the entire row to be visually tight and non-intrusive */
.stHorizontalBlock { gap: 4px !important; }

/* Streamlit's st.button inside the trust strip columns */
div[data-testid="stVerticalBlock"] .stButton > button {
  font-family: 'Inter', sans-serif;
}

/* ── Check-Agent / Ask-AI / Lineage panels (opened via expander) ─────────── */
/* Style the Streamlit expanders to look like the modal body */
[data-testid="stExpander"] {
  background: var(--bg-2) !important;
  border: 1px solid var(--border) !important;
  border-radius: var(--radius) !important;
}
[data-testid="stExpander"] summary {
  background: var(--bg-2) !important;
  color: var(--text-0) !important;
  font-weight: 600;
  font-size: .92rem;
}
</style>
"""


def inject_theme() -> None:
    st.markdown(_HEAD_LINKS + _CSS, unsafe_allow_html=True)
