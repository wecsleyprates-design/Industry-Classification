"""Shared sidebar filter renderer.

All pages import `render_sidebar()` which returns the current filter state.
Session state keys are pre-initialized with defaults so selections PERSIST
when the user switches between pages — Streamlit does not reset them.

Key: widgets use keys prefixed "g_" (global). Because Streamlit stores widget
values in st.session_state under their key, and session_state persists across
page reruns within the same browser session, the user's selections are retained.

The fix for "filter resets on tab change":
  We call `st.session_state.setdefault(key, default)` BEFORE every widget.
  This sets the initial value only once; subsequent reruns (including page
  switches) leave the existing value intact.
"""
from __future__ import annotations

import streamlit as st
from datetime import date, timedelta
import pandas as pd


def _init_session_defaults() -> None:
    """Pre-populate session state with filter defaults on first load only."""
    today = date.today()
    default_from = today - timedelta(days=90)

    if "g_date_from" not in st.session_state:
        st.session_state["g_date_from"] = default_from
    if "g_date_to" not in st.session_state:
        st.session_state["g_date_to"] = today
    if "g_customer_sel" not in st.session_state:
        st.session_state["g_customer_sel"] = "All Customers"
    if "g_customer_id_direct" not in st.session_state:
        st.session_state["g_customer_id_direct"] = "All"
    if "g_business_id" not in st.session_state:
        st.session_state["g_business_id"] = "All Businesses"
    if "g_fact_types" not in st.session_state:
        st.session_state["g_fact_types"] = ["naics_code", "mcc_code"]


def render_sidebar() -> dict:
    """Render sidebar filters and return current filter state dict.
    Selections persist across page navigation via session_state.
    Uses cache-aware loaders from db.data when cache is available.
    """
    from db.data import load_customers_unified as load_customers, load_businesses_unified as load_businesses

    # ── Pre-initialize defaults (only runs once per session) ──────────────
    _init_session_defaults()

    st.sidebar.markdown("## 🔎 Global Filters")
    st.sidebar.markdown("*Selections persist when switching pages.*")
    st.sidebar.markdown("---")

    # ── Date Range ────────────────────────────────────────────────────────
    st.sidebar.markdown("**📅 Date Range**")
    today = date.today()

    col1, col2 = st.sidebar.columns(2)
    date_from = col1.date_input(
        "From",
        key="g_date_from",   # reads+writes session_state["g_date_from"]
        max_value=today,
    )
    date_to = col2.date_input(
        "To",
        key="g_date_to",
        max_value=today,
    )

    if date_from > date_to:
        st.sidebar.warning("⚠️ 'From' is after 'To'.")

    df_from = str(date_from)
    df_to   = str(date_to)

    # ── Customer Name (named clients only — no bare UUIDs) ────────────────
    st.sidebar.markdown("**👥 Customer Name**")
    with st.sidebar:
        with st.spinner("Loading customers…"):
            cust_df = load_customers(df_from, df_to)

    customer_id  = None
    client_name  = None   # human-readable name for cache queries

    if not cust_df.empty:
        def _label(row):
            name  = str(row.get("customer_name", "")).strip()
            cid   = str(row.get("customer_id", "")).strip()
            count = row.get("business_count", 0)
            if name and name != cid and len(name) != 36:
                return f"{name}  ({count:,} biz)"
            return None

        cust_df["display"] = cust_df.apply(_label, axis=1)
        named = cust_df[cust_df["display"].notna()]
        name_options = ["All Customers"] + named["display"].tolist()

        prev_name = st.session_state.get("g_customer_sel", "All Customers")
        if prev_name not in name_options:
            st.session_state["g_customer_sel"] = "All Customers"

        selected_name = st.sidebar.selectbox("Customer Name", name_options, key="g_customer_sel")
        if selected_name != "All Customers":
            matched = named[named["display"] == selected_name]
            if not matched.empty:
                customer_id = matched.iloc[0]["customer_id"]
                client_name = matched.iloc[0]["customer_name"]  # real name for cache
    else:
        st.sidebar.info("No named customers found for this date range.")

    # ── Customer ID (uses same cached customer list — no extra Redshift call) ──
    st.sidebar.markdown("**🔑 Customer ID**")
    # Use the same cust_df already loaded — no second Redshift query
    if cust_df is not None and not cust_df.empty:
        all_ids = ["All"] + sorted(cust_df["customer_id"].dropna().unique().tolist())
        prev_cid = st.session_state.get("g_customer_id_direct", "All")
        if prev_cid not in all_ids:
            st.session_state["g_customer_id_direct"] = "All"
        selected_cid = st.sidebar.selectbox("Customer ID", all_ids, key="g_customer_id_direct")
        # Customer ID selection takes precedence over Name selection
        if selected_cid != "All":
            customer_id = selected_cid
            # Try to resolve client_name from the customer_id
            id_match = cust_df[cust_df["customer_id"] == selected_cid]
            if not id_match.empty:
                nm = str(id_match.iloc[0].get("customer_name","")).strip()
                if nm and nm != selected_cid and len(nm) != 36:
                    client_name = nm
    else:
        st.sidebar.info("No customers found.")

    # ── Business ID ────────────────────────────────────────────────────────
    st.sidebar.markdown("**🏢 Business ID**")
    with st.sidebar:
        with st.spinner("Loading businesses…"):
            biz_df = load_businesses(df_from, df_to, customer_id)

    business_id = None
    if not biz_df.empty:
        biz_ids = ["All Businesses"] + biz_df["business_id"].tolist()

        prev_biz = st.session_state.get("g_business_id", "All Businesses")
        if prev_biz not in biz_ids:
            st.session_state["g_business_id"] = "All Businesses"

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
        key="g_fact_types",
    )

    st.sidebar.markdown("---")
    st.sidebar.caption(
        f"📌 `{len(biz_df) if not biz_df.empty else 0:,}` businesses matched  \n"
        f"📌 `{len(cust_df) if not cust_df.empty else 0:,}` customers matched"
    )

    # ── Cache status ──────────────────────────────────────────────────────────
    st.sidebar.markdown("---")
    try:
        from db.cache_manager import cache_exists, get_cache_meta
        if cache_exists():
            meta = get_cache_meta()
            snap = meta.get("snapshot_date","")[:16].replace("T"," ")
            n_biz = meta.get("total_businesses", 0)
            st.sidebar.markdown(
                f"<div style='background:#0d2818;border:1px solid #22c55e;border-radius:6px;"
                f"padding:8px 10px;font-size:.78rem'>"
                f"<div style='color:#22c55e;font-weight:700'>🗄️ Local Cache Active</div>"
                f"<div style='color:#6ee7b7'>Data as of: {snap}</div>"
                f"<div style='color:#6ee7b7'>{n_biz:,} businesses</div>"
                f"</div>",
                unsafe_allow_html=True
            )
        else:
            st.sidebar.markdown(
                "<div style='background:#1c1207;border:1px solid #f59e0b;border-radius:6px;"
                "padding:8px 10px;font-size:.78rem'>"
                "<div style='color:#f59e0b;font-weight:700'>📡 No Local Cache</div>"
                "<div style='color:#fcd34d'>Reading live from Redshift</div>"
                "<div style='color:#fcd34d'>Run the refresh script to build cache</div>"
                "</div>",
                unsafe_allow_html=True
            )
    except Exception:
        pass

    return {
        "date_from":   df_from,
        "date_to":     df_to,
        "customer_id": customer_id,
        "client_name": client_name,   # human-readable name for cache queries
        "business_id": business_id,
        "fact_types":  fact_types,
    }


# ── Shared UI helpers ──────────────────────────────────────────────────────────

def kpi(label: str, value: str, delta: str = "", color: str = "#3b82f6") -> None:
    delta_html = (
        f"<div style='color:#64748b;font-size:.75rem;margin-top:4px'>{delta}</div>"
        if delta else ""
    )
    html = (
        f"<div style='background:#1e293b;border:1px solid #334155;border-left:4px solid {color};"
        f"border-radius:8px;padding:14px 16px;margin:4px 0'>"
        f"<div style='color:#94a3b8;font-size:.75rem;font-weight:600;text-transform:uppercase;"
        f"letter-spacing:.05em;margin-bottom:4px'>{label}</div>"
        f"<div style='color:#f1f5f9;font-size:1.6rem;font-weight:700;line-height:1'>{value}</div>"
        f"{delta_html}</div>"
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
                pid  = str(src.get("platformId", "unknown"))
                conf = src.get("confidence", a.get("confidence", ""))
                ts   = src.get("updatedAt", "")
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
    alts = parse_alternatives(raw_json)
    if alts:
        df = pd.DataFrame(alts)
        df.columns = ["Platform", "ID", "Value", "Confidence", "Updated At"]
        st.dataframe(df, hide_index=True, use_container_width=True)
    else:
        st.caption("No alternatives found.")
