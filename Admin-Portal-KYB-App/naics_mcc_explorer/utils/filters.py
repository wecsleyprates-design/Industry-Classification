"""Shared sidebar filter renderer.

All pages import `render_sidebar()` which returns the current filter state
and caches customer/business lists based on date range + customer selection.
Session state keys are shared so all pages see the same filter values.
"""

import streamlit as st
from datetime import date, timedelta
import pandas as pd


def render_sidebar() -> dict:
    """Render sidebar filters and return current filter state dict."""
    # Import here to avoid circular import at module level
    from db.queries import load_customers, load_businesses

    st.sidebar.markdown("## 🔎 Global Filters")
    st.sidebar.markdown("*All filters are linked — selections cascade automatically.*")
    st.sidebar.markdown("---")

    # ── Date Range ──────────────────────────────────────────────────────────
    st.sidebar.markdown("**📅 Date Range**")
    today = date.today()
    default_from = today - timedelta(days=90)

    col1, col2 = st.sidebar.columns(2)
    date_from = col1.date_input("From", value=default_from, key="g_date_from",
                                 max_value=today)
    date_to   = col2.date_input("To",   value=today,         key="g_date_to",
                                 max_value=today)

    if date_from > date_to:
        st.sidebar.warning("⚠️ 'From' is after 'To'.")

    df_from = str(date_from)
    df_to   = str(date_to)

    # ── Customer (derived from date range) ────────────────────────────────
    st.sidebar.markdown("**👥 Customer**")
    with st.sidebar:
        with st.spinner("Loading customers…"):
            cust_df = load_customers(df_from, df_to)

    cust_ids = ["All Customers"] + (cust_df["customer_id"].tolist() if not cust_df.empty else [])
    customer_id = st.sidebar.selectbox("Customer ID", cust_ids, key="g_customer_id")
    if customer_id == "All Customers":
        customer_id = None

    # ── Business ID (derived from date range + customer) ──────────────────
    st.sidebar.markdown("**🏢 Business ID**")
    with st.sidebar:
        with st.spinner("Loading businesses…"):
            biz_df = load_businesses(df_from, df_to, customer_id)

    biz_ids = ["All Businesses"] + (biz_df["business_id"].tolist() if not biz_df.empty else [])
    business_id = st.sidebar.selectbox("Business ID", biz_ids, key="g_business_id")
    if business_id == "All Businesses":
        business_id = None

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
        f"📌 `{len(biz_df):,}` businesses matched  \n"
        f"📌 `{len(cust_df):,}` customers matched"
    )

    return {
        "date_from":   df_from,
        "date_to":     df_to,
        "customer_id": customer_id,
        "business_id": business_id,
        "fact_types":  fact_types,
    }


def kpi(label: str, value: str, delta: str = "", color: str = "#3b82f6") -> None:
    """Render a styled KPI metric card."""
    st.markdown(f"""
<div style="background:#1e293b;border:1px solid #334155;border-left:4px solid {color};
     border-radius:8px;padding:14px 16px;margin:4px 0">
  <div style="color:#94a3b8;font-size:.75rem;font-weight:600;text-transform:uppercase;
       letter-spacing:.05em;margin-bottom:4px">{label}</div>
  <div style="color:#f1f5f9;font-size:1.6rem;font-weight:700;line-height:1">{value}</div>
  {"<div style='color:#64748b;font-size:.75rem;margin-top:4px'>" + delta + "</div>" if delta else ""}
</div>""", unsafe_allow_html=True)


def no_data(msg: str = "No data for the selected filters.") -> None:
    st.info(f"📭 {msg}", icon="📭")


def section_header(title: str, subtitle: str = "") -> None:
    st.markdown(f"### {title}")
    if subtitle:
        st.caption(subtitle)
    st.markdown("---")
