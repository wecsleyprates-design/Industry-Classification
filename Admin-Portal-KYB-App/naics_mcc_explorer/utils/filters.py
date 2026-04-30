"""Shared sidebar filter renderer.

All pages import `render_sidebar()` which returns the current filter state
and caches customer/business lists based on date range + customer selection.
Session state keys are shared so all pages see the same filter values.
"""
from __future__ import annotations

import streamlit as st
from datetime import date, timedelta
import pandas as pd


def render_sidebar() -> dict:
    """Render sidebar filters and return current filter state dict."""
    from db.queries import load_customers, load_businesses

    st.sidebar.markdown("## 🔎 Global Filters")
    st.sidebar.markdown("*All filters cascade: date → customer → business.*")
    st.sidebar.markdown("---")

    # ── Date Range ──────────────────────────────────────────────────────────
    st.sidebar.markdown("**📅 Date Range**")
    today = date.today()
    default_from = today - timedelta(days=90)

    col1, col2 = st.sidebar.columns(2)
    date_from = col1.date_input("From", value=default_from, key="g_date_from", max_value=today)
    date_to   = col2.date_input("To",   value=today,         key="g_date_to",   max_value=today)

    if date_from > date_to:
        st.sidebar.warning("⚠️ 'From' is after 'To'.")

    df_from = str(date_from)
    df_to   = str(date_to)

    # ── Customer (derived from date range, shown as Name + ID) ────────────
    st.sidebar.markdown("**👥 Customer Name**")
    with st.sidebar:
        with st.spinner("Loading customers…"):
            cust_df = load_customers(df_from, df_to)

    customer_id = None
    if not cust_df.empty:
        # Build "Name (count biz)" label when name != id, else just id
        def _label(row):
            name  = str(row.get("customer_name", "")).strip()
            cid   = str(row.get("customer_id", "")).strip()
            count = row.get("business_count", "")
            if name and name != cid:
                return f"{name}  ({count:,} biz)" if count else f"{name}"
            return f"{cid}  ({count:,} biz)" if count else cid

        cust_df["display"] = cust_df.apply(_label, axis=1)
        options = ["All Customers"] + cust_df["display"].tolist()
        selected = st.sidebar.selectbox("Customer Name", options, key="g_customer_sel")
        if selected != "All Customers":
            matched = cust_df[cust_df["display"] == selected]
            if not matched.empty:
                customer_id = matched.iloc[0]["customer_id"]
    else:
        st.sidebar.info("No customers in date range.")

    # ── Business ID (derived from date range + customer) ──────────────────
    st.sidebar.markdown("**🏢 Business ID**")
    with st.sidebar:
        with st.spinner("Loading businesses…"):
            biz_df = load_businesses(df_from, df_to, customer_id)

    business_id = None
    if not biz_df.empty:
        biz_ids = ["All Businesses"] + biz_df["business_id"].tolist()
        biz_sel = st.sidebar.selectbox("Business ID", biz_ids, key="g_business_id")
        if biz_sel != "All Businesses":
            business_id = biz_sel
    else:
        st.sidebar.info("No businesses matched.")

    # ── Fact Type multiselect ─────────────────────────────────────────────
    st.sidebar.markdown("**📊 Fact Types**")
    from utils.platform_map import FACT_NAMES
    fact_types = st.sidebar.multiselect(
        "Select fact types",
        FACT_NAMES,
        default=["naics_code", "mcc_code"],
        key="g_fact_types",
    )

    st.sidebar.markdown("---")
    st.sidebar.caption(
        f"📌 `{len(biz_df) if not biz_df.empty else 0:,}` businesses matched  \n"
        f"📌 `{len(cust_df) if not cust_df.empty else 0:,}` customers matched"
    )

    return {
        "date_from":   df_from,
        "date_to":     df_to,
        "customer_id": customer_id,
        "business_id": business_id,
        "fact_types":  fact_types,
    }


def kpi(label: str, value: str, delta: str = "", color: str = "#3b82f6") -> None:
    delta_html = f"<div style='color:#64748b;font-size:.75rem;margin-top:4px'>{delta}</div>" if delta else ""
    html = (
        f"<div style='background:#1e293b;border:1px solid #334155;border-left:4px solid {color};"
        f"border-radius:8px;padding:14px 16px;margin:4px 0'>"
        f"<div style='color:#94a3b8;font-size:.75rem;font-weight:600;text-transform:uppercase;"
        f"letter-spacing:.05em;margin-bottom:4px'>{label}</div>"
        f"<div style='color:#f1f5f9;font-size:1.6rem;font-weight:700;line-height:1'>{value}</div>"
        f"{delta_html}"
        f"</div>"
    )
    st.markdown(html, unsafe_allow_html=True)


def no_data(msg: str = "No data for the selected filters.") -> None:
    st.info(f"📭 {msg}", icon="📭")


def section_header(title: str, subtitle: str = "") -> None:
    st.markdown(f"### {title}")
    if subtitle:
        st.caption(subtitle)
    st.markdown("---")


def parse_alternatives(raw_json: str) -> list[dict]:
    """Parse alternatives[] from raw facts JSON. Returns list of dicts."""
    import json
    from utils.platform_map import platform_label
    alts = []
    try:
        obj = json.loads(str(raw_json)) if isinstance(raw_json, str) else (raw_json or {})
        for a in (obj.get("alternatives") or []):
            src = a.get("source", {})
            if isinstance(src, dict):
                pid   = str(src.get("platformId", "unknown"))
                conf  = src.get("confidence", a.get("confidence", ""))
                ts    = src.get("updatedAt", "")
            else:
                pid  = str(src) if src is not None else "unknown"
                conf = a.get("confidence", "")
                ts   = ""
            alts.append({
                "alt_platform":    platform_label(pid),
                "alt_platform_id": pid,
                "alt_value":       a.get("value"),
                "alt_confidence":  conf,
                "alt_updated_at":  ts,
            })
    except Exception:
        pass
    return alts


def alternatives_table(raw_json: str, key: str = "") -> None:
    """Render a mini alternatives table from raw JSON inline."""
    alts = parse_alternatives(raw_json)
    if alts:
        df = pd.DataFrame(alts)
        df.columns = ["Platform", "ID", "Value", "Confidence", "Updated At"]
        st.dataframe(df, hide_index=True, use_container_width=True)
    else:
        st.caption("No alternatives found (or old schema without alternatives array).")
