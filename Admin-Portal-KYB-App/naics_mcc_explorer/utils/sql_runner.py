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
    """Collapsible platform ID legend + schema reference."""
    from utils.platform_map import PLATFORM_LEGEND, NAICS_MCC_DERIVATION
    with st.expander("📖 Platform ID Legend + Schema Reference  ·  📐 See 'How It Works' for full workflow"):
        st.markdown(
            "**📐 See the [How It Works](#) page** (first tab in the sidebar) for the full "
            "workflow diagram showing how supplier data → facts table → Admin Portal API → "
            "SQLite cache → this dashboard.\n\n"
            "**Quick summary:** Vendors run → arbitration picks winner (highest confidence) → "
            "stored in `rds_warehouse_public.facts` → Admin Portal API reads same data → "
            "weekly refresh script fetches API for all businesses → `facts_cache.sqlite` → "
            "all app pages read from cache. Redshift used only for lookups."
        )
        st.markdown("---")
        st.markdown(PLATFORM_LEGEND)
        st.markdown("---")
        st.markdown("**NAICS/MCC derivation chain** (from `businessDetails/index.ts`):")
        st.code(NAICS_MCC_DERIVATION, language=None)
        st.markdown("---")
        st.markdown("**Redshift table reference:**")
        st.markdown(
            "| Table | Key columns | Purpose |\n"
            "|---|---|---|\n"
            "| `rds_warehouse_public.facts` | `business_id`, `name`, `value` (JSON) | All facts: `naics_code`, `mcc_code`, etc. One row per (business_id, name) |\n"
            "| `rds_cases_public.core_naics_code` | `id` (PK), `code`, **`label`** | NAICS taxonomy — column is `label` NOT `title` |\n"
            "| `rds_cases_public.core_mcc_code` | `id` (PK), `code`, **`label`** | MCC list — column is `label` NOT `title` |\n"
            "| `rds_cases_public.rel_naics_mcc` | `naics_id`→core_naics_code.id, `mcc_id`→core_mcc_code.id | Canonical NAICS→MCC mapping |\n"
            "| `rds_cases_public.core_business_industries` | `id` (PK), `name` | 2-digit NAICS sector names |\n"
            "| `rds_cases_public.data_businesses` | `id`, `naics_id`, `mcc_id`, `industry` | Static business record (admin-set values) |\n"
            "| `rds_cases_public.rel_business_customer_monitoring` | `business_id`, `customer_id`, `created_at` | Date + customer anchor. NO `updated_at` column. |\n"
            "| `rds_auth_public.data_customers` | `id` (UUID PK), `name` | Customer name lookup |\n"
        )
        st.markdown("---")
        st.markdown(
            "**Important: platformId = -1 means 'Calculated/Dependent', NOT a legacy schema bug.**\n\n"
            "Facts with `platformId: -1` are computed by the Fact Engine from other facts. "
            "They are never sourced from a supplier. Examples:\n\n"
            "- `mcc_code` — derived from `mcc_code_found ?? mcc_code_from_naics`\n"
            "- `mcc_code_from_naics` — `rel_naics_mcc` lookup keyed by the winning `naics_code`\n"
            "- `mcc_description` — `core_mcc_code` lookup by `mcc_code`\n"
            "- `naics_description` — `core_naics_code` lookup by `naics_code`\n"
            "- `industry` — 2-digit NAICS sector derived from `naics_code[0:2]`\n\n"
            "**If NAICS is wrong, ALL of these dependent facts are also wrong.** "
            "The cascade goes: bad `naics_code` → bad `mcc_code_from_naics` → bad `mcc_code` "
            "→ bad `mcc_description` → bad `industry`.\n\n"
            "| JSON source field | What it means |\n"
            "|---|---|\n"
            "| `{\"platformId\": 24, \"confidence\": 1.0, \"name\": \"zoominfo\"}` | ZoomInfo won arbitration |\n"
            "| `{\"platformId\": 0, \"confidence\": 1.0, \"name\": \"businessDetails\"}` | Ghost Assigner won |\n"
            "| `{\"platformId\": -1, \"name\": \"dependent\"}` | Fact computed from other facts |\n"
            "| `{\"platformId\": 31, \"confidence\": 0.15}` | AI NAICS Enrichment |\n"
            "| `{\"name\": \"AINaicsEnrichment\", \"confidence\": 0.15}` | Old schema — same as P31 |\n"
        )
