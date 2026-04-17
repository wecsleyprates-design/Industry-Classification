"""
ui_components.py — Reusable UI components for KYB Hub Pro.
Dark-themed, modern, and accessible.
"""

import streamlit as st
import plotly.graph_objects as go
import json

# ── Platform ID registry ─────────────────────────────────────────────────────
PID_REGISTRY = {
    "16": ("Middesk",          "#f59e0b", 2.0),
    "23": ("OpenCorporates",   "#3B82F6", 0.9),
    "24": ("ZoomInfo",         "#8B5CF6", 0.8),
    "17": ("Equifax",          "#22c55e", 0.7),
    "38": ("Trulioo",          "#ec4899", 0.8),
    "42": ("Trulioo PSC",      "#f43f5e", 0.8),
    "31": ("AI (GPT-4o-mini)", "#f97316", 0.1),
    "36": ("AI Website",       "#fb923c", 0.1),
    "22": ("SERP",             "#a855f7", 0.3),
    "39": ("SERP Google",      "#9333ea", 0.3),
    "40": ("Plaid / KYX",     "#06b6d4", 1.0),
    "18": ("Plaid IDV",        "#0ea5e9", 1.0),
    "1":  ("Plaid Banking",    "#0284c7", 1.0),
    "32": ("Canada Open",      "#10b981", 0.9),
    "4":  ("Verdata",          "#6366f1", 0.7),
    "29": ("Entity Matching",  "#8b5cf6", 0.8),
    "21": ("Manual Upload",    "#64748b", 1.0),
    "0":  ("Applicant",        "#94a3b8", 1.0),
    "-1": ("Calculated",       "#475569", 0.0),
    "":   ("Unknown",          "#374155", 0.0),
}


def pid_name(pid_str):
    """Get human-readable vendor name from platformId."""
    return PID_REGISTRY.get(str(pid_str or ""), ("Unknown", "#374155", 0.0))[0]


def pid_color(pid_str):
    """Get vendor color from platformId."""
    return PID_REGISTRY.get(str(pid_str or ""), ("Unknown", "#374155", 0.0))[1]


# ── CSS Injection ────────────────────────────────────────────────────────────

def inject_css():
    """Inject the global CSS for the Pro app."""
    st.markdown("""<style>
    /* Global */
    .main { background: #0A0F1E; }
    [data-testid="stSidebar"] { background: #0F1629; border-right: 1px solid #1E293B; }
    [data-testid="stSidebar"] .stMarkdown h1 { color: #60A5FA; font-size: 1.3rem; }

    /* KPI Card */
    .kpi-card {
        background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
        border-radius: 12px; padding: 18px 20px;
        border-left: 4px solid #3B82F6; margin-bottom: 8px;
        transition: transform 0.2s, box-shadow 0.2s;
    }
    .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(59,130,246,0.15); }
    .kpi-label { color: #94A3B8; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
    .kpi-value { color: #F1F5F9; font-size: 1.6rem; font-weight: 800; margin: 4px 0; }
    .kpi-sub { color: #64748B; font-size: 0.72rem; }

    /* Status Badge */
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
    .badge-pass { background: #052e16; color: #86efac; border: 1px solid #22c55e33; }
    .badge-fail { background: #1f0a0a; color: #fca5a5; border: 1px solid #ef444433; }
    .badge-warn { background: #1c1917; color: #fde68a; border: 1px solid #f59e0b33; }
    .badge-info { background: #0c1a2e; color: #93c5fd; border: 1px solid #3B82F633; }
    .badge-neutral { background: #1E293B; color: #94A3B8; border: 1px solid #33415533; }

    /* Alert Card */
    .alert-card {
        background: #1E293B; border-radius: 12px; padding: 16px 20px;
        margin: 6px 0; border-left: 4px solid #3B82F6;
        transition: background 0.2s;
    }
    .alert-card:hover { background: #1E293B99; }
    .alert-critical { border-left-color: #ef4444; }
    .alert-high { border-left-color: #f97316; }
    .alert-medium { border-left-color: #f59e0b; }
    .alert-low { border-left-color: #22c55e; }

    /* Fact Row */
    .fact-row {
        background: #0F172A; border-radius: 8px; padding: 10px 14px;
        margin: 4px 0; border: 1px solid #1E293B;
        transition: border-color 0.2s;
    }
    .fact-row:hover { border-color: #3B82F6; }

    /* Section Header */
    .section-header {
        background: linear-gradient(90deg, #1E293B 0%, #0F172A 100%);
        border-radius: 10px; padding: 12px 18px; margin: 12px 0 8px 0;
        border-left: 4px solid #3B82F6;
    }
    .section-header h3 { color: #E2E8F0; margin: 0; font-size: 1.05rem; }
    .section-header p { color: #94A3B8; margin: 2px 0 0 0; font-size: 0.78rem; }

    /* Check Agent */
    .check-result {
        border-radius: 10px; padding: 14px 18px; margin: 6px 0;
        font-size: 0.82rem; line-height: 1.7;
    }
    .check-red { background: #1f0a0a; border: 1px solid #ef4444; color: #fca5a5; }
    .check-yellow { background: #1c1917; border: 1px solid #f59e0b; color: #fde68a; }
    .check-green { background: #052e16; border: 1px solid #22c55e; color: #86efac; }
    .check-blue { background: #0c1a2e; border: 1px solid #3B82F6; color: #93c5fd; }

    /* Progress bar */
    .progress-container { background: #1E293B; border-radius: 6px; height: 8px; margin: 6px 0; overflow: hidden; }
    .progress-fill { height: 8px; border-radius: 6px; transition: width 0.5s ease; }

    /* Vendor pill */
    .vendor-pill {
        display: inline-block; padding: 2px 8px; border-radius: 12px;
        font-size: 0.70rem; font-weight: 600; margin: 1px;
    }

    /* Scrollable table */
    .stDataFrame { border-radius: 8px; overflow: hidden; }

    /* Hide Streamlit branding */
    #MainMenu { visibility: hidden; }
    footer { visibility: hidden; }
    header { visibility: hidden; }
    </style>""", unsafe_allow_html=True)


# ── KPI Card ─────────────────────────────────────────────────────────────────

def kpi_card(label, value, subtitle="", color="#3B82F6", delta=None):
    """Render a modern KPI card."""
    delta_html = ""
    if delta is not None:
        d_color = "#22c55e" if delta >= 0 else "#ef4444"
        d_icon = "+" if delta >= 0 else ""
        delta_html = f'<span style="color:{d_color};font-size:0.75rem;font-weight:600;margin-left:8px">{d_icon}{delta}%</span>'

    st.markdown(f"""
    <div class="kpi-card" style="border-left-color:{color}">
        <div class="kpi-label">{label}</div>
        <div class="kpi-value">{value}{delta_html}</div>
        <div class="kpi-sub">{subtitle}</div>
    </div>""", unsafe_allow_html=True)


# ── Status Badge ─────────────────────────────────────────────────────────────

def status_badge(text, status="info"):
    """Return HTML for a status badge. status: pass/fail/warn/info/neutral"""
    return f'<span class="badge badge-{status}">{text}</span>'


def render_badge(text, status="info"):
    """Render a status badge directly."""
    st.markdown(status_badge(text, status), unsafe_allow_html=True)


# ── Section Header ───────────────────────────────────────────────────────────

def section_header(title, subtitle="", icon="", color="#3B82F6"):
    """Render a styled section header."""
    st.markdown(f"""
    <div class="section-header" style="border-left-color:{color}">
        <h3>{icon} {title}</h3>
        <p>{subtitle}</p>
    </div>""", unsafe_allow_html=True)


# ── Alert Flag ───────────────────────────────────────────────────────────────

def alert_flag(text, severity="info", icon=None):
    """Render an alert flag. severity: critical/high/medium/low"""
    icons = {"critical": "🚨", "high": "🔴", "medium": "⚠️", "low": "✅", "info": "ℹ️"}
    ic = icon or icons.get(severity, "ℹ️")
    css_class = {
        "critical": "check-red", "high": "check-red",
        "medium": "check-yellow", "low": "check-green", "info": "check-blue"
    }.get(severity, "check-blue")
    st.markdown(f'<div class="check-result {css_class}">{ic} {text}</div>', unsafe_allow_html=True)


# ── Vendor Pill ──────────────────────────────────────────────────────────────

def vendor_pill(pid_str):
    """Return HTML for a vendor pill badge."""
    name = pid_name(pid_str)
    color = pid_color(pid_str)
    return (f'<span class="vendor-pill" style="background:{color}22;color:{color};'
            f'border:1px solid {color}44">{name}</span>')


# ── Progress Bar ─────────────────────────────────────────────────────────────

def progress_bar(value, max_val=100, color="#3B82F6", label=""):
    """Render a custom progress bar."""
    pct = min(int(value / max(max_val, 1) * 100), 100)
    st.markdown(f"""
    <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#CBD5E1;margin-bottom:2px">
        <span>{label}</span><span style="color:{color};font-weight:700">{pct}%</span>
    </div>
    <div class="progress-container">
        <div class="progress-fill" style="width:{pct}%;background:{color}"></div>
    </div>""", unsafe_allow_html=True)


# ── Dark Chart Theme ─────────────────────────────────────────────────────────

def apply_dark_theme(fig):
    """Apply the Pro dark theme to a Plotly figure."""
    fig.update_layout(
        paper_bgcolor="#0A0F1E",
        plot_bgcolor="#1E293B",
        font_color="#E2E8F0",
        legend=dict(bgcolor="#1E293B", font=dict(color="#CBD5E1")),
        margin=dict(t=50, b=10, l=10, r=10),
        xaxis=dict(gridcolor="#334155", zerolinecolor="#334155"),
        yaxis=dict(gridcolor="#334155", zerolinecolor="#334155"),
    )
    return fig


# ── Fact Detail Expander ─────────────────────────────────────────────────────

def fact_detail_card(fact_name, fact_obj, facts_dict):
    """Render a detailed fact card with source, confidence, alternatives, and JSON."""
    from db_connector import get_fact_value, get_fact_confidence, get_fact_platform_id, get_fact_alternatives, safe_get

    v = fact_obj.get("value")
    src = fact_obj.get("source", {})
    pid = get_fact_platform_id(facts_dict, fact_name)
    conf = get_fact_confidence(facts_dict, fact_name)
    alts = get_fact_alternatives(facts_dict, fact_name)
    rule = safe_get(fact_obj, "ruleApplied", "name") or "dependent"
    deps = fact_obj.get("dependencies", []) or []
    too_large = fact_obj.get("_too_large", False)

    # Value display
    if too_large:
        val_display = "📦 [Too large for Redshift — query RDS port 5432]"
    elif v is None:
        val_display = "(null)"
    elif isinstance(v, list):
        val_display = f"📋 List with {len(v)} item(s)"
    elif isinstance(v, dict):
        val_display = f"🗂️ Object with {len(v)} key(s)"
    else:
        val_display = str(v)[:120]

    # Color coding
    if too_large:
        border_color = "#f59e0b"
    elif v is None:
        border_color = "#64748b"
    elif isinstance(v, (list, dict)):
        border_color = "#8B5CF6"
    else:
        border_color = "#22c55e"

    with st.expander(f"{'📦' if too_large else '✅' if v else '⚪'} **{fact_name}** — {val_display[:50]}"):
        col1, col2, col3 = st.columns(3)
        with col1:
            st.markdown(f"**Source:** {vendor_pill(pid)}", unsafe_allow_html=True)
        with col2:
            st.markdown(f"**Confidence:** `{conf:.4f}`" if conf else "**Confidence:** `n/a (derived)`")
        with col3:
            st.markdown(f"**Rule:** `{rule}`")

        if deps:
            st.markdown(f"**Dependencies:** {', '.join(f'`{d}`' for d in deps)}")

        if alts:
            st.markdown(f"**Alternatives:** {len(alts)} competing source(s)")
            for a in alts:
                st.markdown(
                    f"&nbsp;&nbsp;&nbsp;&nbsp;{vendor_pill(a['pid'])} "
                    f"conf=`{a['conf']:.4f}` — value: `{str(a['value'])[:60]}`",
                    unsafe_allow_html=True
                )

        # JSON
        clean = {
            "name": fact_name,
            "value": val_display if too_large else v,
            "source": {
                "platformId": src.get("platformId") if isinstance(src, dict) else None,
                "confidence": src.get("confidence") if isinstance(src, dict) else None,
                "name": src.get("name") if isinstance(src, dict) else None,
            },
            "ruleApplied": rule,
            "dependencies": deps or None,
            "alternatives_count": len(alts),
        }
        st.code(json.dumps(clean, indent=2, default=str, ensure_ascii=False), language="json")

        # SQL
        st.code(
            f"SELECT name, value, received_at\n"
            f"FROM rds_warehouse_public.facts\n"
            f"WHERE business_id='<business_id>'\n"
            f"  AND name='{fact_name}'\n"
            f"ORDER BY received_at DESC LIMIT 1;",
            language="sql"
        )
