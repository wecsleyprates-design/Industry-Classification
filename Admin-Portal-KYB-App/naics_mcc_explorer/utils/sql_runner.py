"""Shared SQL query runner panel and analyst insight renderer.

Every chart, table and metric in the app can show:
  1. An analyst interpretation callout (insight box)
  2. The exact SQL that produced the data
  3. An inline editable SQL runner against Redshift
"""
from __future__ import annotations

import streamlit as st
import pandas as pd
import textwrap
from db.connection import run_query


# ── Colour scheme for insight levels ──────────────────────────────────────────
_INSIGHT_STYLES = {
    "info":    ("#1e3a5f", "#3b82f6", "ℹ️"),
    "warning": ("#3b2500", "#f59e0b", "⚠️"),
    "danger":  ("#3b0000", "#ef4444", "🚨"),
    "success": ("#0d2818", "#22c55e", "✅"),
}


def analyst_note(
    title: str,
    body: str,
    level: str = "info",       # "info" | "warning" | "danger" | "success"
    bullets: list[str] | None = None,
    action: str = "",
) -> None:
    """Render a coloured analyst interpretation box below any chart or table.

    NOTE: The entire HTML must be on ONE line — multi-line HTML inside
    st.markdown(unsafe_allow_html=True) causes Streamlit's markdown parser
    to treat indented closing tags as code blocks (the </div> bug).
    """
    bg, border, icon = _INSIGHT_STYLES.get(level, _INSIGHT_STYLES["info"])

    bullet_html = ""
    if bullets:
        items = "".join(f"<li style='margin:3px 0;color:#cbd5e1'>{b}</li>" for b in bullets)
        bullet_html = f"<ul style='margin:8px 0 4px 1.2rem;padding:0'>{items}</ul>"

    action_html = ""
    if action:
        action_html = (
            f"<div style='margin-top:10px;padding:8px 10px;background:{bg};"
            f"border-left:3px solid {border};border-radius:4px;"
            f"color:#94a3b8;font-size:.8rem'>"
            f"<strong>Recommended action:</strong> {action}</div>"
        )

    # Single-line HTML — no newlines between tags to avoid Streamlit markdown parsing issues
    html = (
        f"<div style='background:{bg};border:1px solid {border};"
        f"border-left:4px solid {border};border-radius:8px;"
        f"padding:14px 16px;margin:10px 0 4px 0'>"
        f"<div style='color:{border};font-weight:700;font-size:.9rem;margin-bottom:6px'>"
        f"{icon}&nbsp;{title}</div>"
        f"<div style='color:#cbd5e1;font-size:.875rem;line-height:1.5'>{body}</div>"
        f"{bullet_html}"
        f"{action_html}"
        f"</div>"
    )
    st.markdown(html, unsafe_allow_html=True)


def sql_panel(
    label: str,
    sql: str,
    default_open: bool = False,
    key_suffix: str = "",
) -> None:
    """Render a collapsible SQL viewer + inline runner below any element."""
    clean_sql = textwrap.dedent(sql).strip()
    with st.expander(f"🔍 View & Run SQL — {label}", expanded=default_open):
        st.markdown("**SQL used to produce this view:**")
        st.code(clean_sql, language="sql")

        st.markdown("**✏️ Edit and run against Redshift:**")
        edited = st.text_area(
            "SQL",
            value=clean_sql,
            height=220,
            key=f"sql_edit_{key_suffix}_{label[:20].replace(' ','_')}",
            label_visibility="collapsed",
        )
        run_btn = st.button("▶️ Run query", key=f"sql_run_{key_suffix}_{label[:20].replace(' ','_')}")
        if run_btn:
            with st.spinner("Running against Redshift…"):
                result = run_query(edited)
            if result.empty:
                st.info("Query returned no rows.")
            else:
                st.success(f"Returned {len(result):,} rows.")
                st.dataframe(result, use_container_width=True, hide_index=True)
                st.download_button(
                    "⬇️ Download result",
                    result.to_csv(index=False).encode(),
                    f"query_result_{key_suffix}.csv",
                    "text/csv",
                    key=f"dl_{key_suffix}_{label[:10]}",
                )


def platform_legend_panel() -> None:
    """Collapsible platform ID legend."""
    from utils.platform_map import PLATFORM_LEGEND
    with st.expander("📖 Platform ID Legend — what does each platform mean?"):
        st.markdown(PLATFORM_LEGEND)
        st.markdown(
            "**Why does Platform -1 / Legacy Schema appear?**\n\n"
            "The facts table stores two different JSON schemas:\n\n"
            "| Schema | `source` field | Extraction |\n"
            "|---|---|---|\n"
            "| **New** (current) | `{\"platformId\": 31, \"confidence\": 0.15, \"updatedAt\": \"...\"}` "
            "| `JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')` → `\"31\"` |\n"
            "| **Old** (legacy) | `{\"name\": \"AINaicsEnrichment\", \"confidence\": 0.15}` "
            "| Returns `NULL` → shown as **Legacy Schema** |\n\n"
            "Legacy records are not missing data — the actual source is in `source.name` (visible in the raw JSON)."
        )
