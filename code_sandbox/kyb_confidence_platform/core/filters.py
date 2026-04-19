"""
Global filter bar.

Visible at the top of every tab. Values are persisted in session state and
deep-linked to the URL.

Fixes applied:
  - Custom date range: both pickers get proper default values (not None) and are
    always shown when "Custom…" is selected, with start clamped ≤ end.
  - Customer dropdown: populated dynamically from Redshift/fixtures for the
    current date window — not a free-text field.
  - Business ID dropdown: populated based on the selected customer + date window.
    Falls back to free-text if the list is too large (>500 IDs).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import streamlit as st


DATE_RANGE_OPTIONS = {
    "last_7d":  "Last 7 days",
    "last_30d": "Last 30 days",
    "last_90d": "Last 90 days",
    "ytd":      "Year to date",
    "custom":   "Custom…",
}

DATE_CONTEXT_OPTIONS = {
    "submitted_at": "Submitted At",
    "scored_at":    "Scored At",
    "decision_at":  "Decision At",
    "activated_at": "Activation At",
}

ENTITY_TYPES = ["ALL", "Domestic", "Foreign"]
BANDS = ["ALL", "Very Low", "Low", "Medium", "High", "Very High"]

# Maximum business IDs to show in a dropdown before switching to free-text.
_MAX_BID_DROPDOWN = 500


@dataclass
class FilterState:
    date_range: str
    date_context: str
    customer: str
    business_id: str
    entity_type: str
    confidence_band: str
    manual_only: bool
    custom_start: date | None = None
    custom_end: date | None = None

    def resolve_window(self) -> tuple[date, date]:
        today = date.today()
        if self.date_range == "last_7d":
            return today - timedelta(days=7), today
        if self.date_range == "last_30d":
            return today - timedelta(days=30), today
        if self.date_range == "last_90d":
            return today - timedelta(days=90), today
        if self.date_range == "ytd":
            return date(today.year, 1, 1), today
        if self.date_range == "custom":
            start = self.custom_start or today - timedelta(days=30)
            end   = self.custom_end   or today
            # Ensure start ≤ end
            if start > end:
                start = end
            return start, end
        # Fallback (should never reach here)
        return today - timedelta(days=30), today


def current_filters() -> FilterState:
    ss = st.session_state
    return FilterState(
        date_range=ss.get("flt_date_range", "last_30d"),
        date_context=ss.get("flt_date_context", "scored_at"),
        customer=ss.get("flt_customer", "ALL"),
        business_id=ss.get("flt_business_id", ""),
        entity_type=ss.get("flt_entity_type", "ALL"),
        confidence_band=ss.get("flt_confidence_band", "ALL"),
        manual_only=ss.get("flt_manual_only", False),
        custom_start=ss.get("flt_custom_start"),
        custom_end=ss.get("flt_custom_end"),
    )


# ── dynamic option loaders ────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def _load_customers(start: str, end: str, date_col: str) -> list[str]:
    """
    Load distinct customer names for the current date window.
    Returns ["ALL", ...] with "ALL" prepended.
    Falls back to the fixture list if Redshift is not reachable.
    """
    sql = f"""
        SELECT DISTINCT JSON_EXTRACT_PATH_TEXT(value, 'customer_name') AS customer_name
        FROM rds_warehouse_public.facts
        WHERE name = 'customer_name'
          AND {date_col} BETWEEN '{start}' AND '{end}'
          AND JSON_EXTRACT_PATH_TEXT(value, 'customer_name') IS NOT NULL
        ORDER BY 1
        LIMIT 500
    """
    try:
        from data_access.redshift import query as rs_query
        df = rs_query(sql)
        names = [str(r) for r in df["customer_name"].dropna().unique().tolist() if str(r).strip()]
        if names:
            return ["ALL"] + sorted(names)
    except Exception:
        pass
    # Fallback: fixture customers
    return ["ALL", "Acme Holdings Inc.", "Northgate Logistics LLC",
            "Beta Payments Corp.", "Sigma Financial", "OmegaCo"]


@st.cache_data(ttl=300, show_spinner=False)
def _load_business_ids(start: str, end: str, date_col: str, customer: str) -> list[str]:
    """
    Load distinct business IDs for the current date window + customer filter.
    Returns at most _MAX_BID_DROPDOWN IDs, or [] to signal "use free-text".
    """
    customer_clause = (
        f"AND JSON_EXTRACT_PATH_TEXT(value, 'customer_name') = '{customer}'"
        if customer and customer != "ALL"
        else ""
    )
    sql = f"""
        SELECT DISTINCT business_id
        FROM rds_warehouse_public.facts
        WHERE {date_col} BETWEEN '{start}' AND '{end}'
          {customer_clause}
        ORDER BY 1
        LIMIT {_MAX_BID_DROPDOWN + 1}
    """
    try:
        from data_access.redshift import query as rs_query
        df = rs_query(sql)
        ids = df["business_id"].dropna().unique().tolist()
        if len(ids) <= _MAX_BID_DROPDOWN:
            return sorted(str(i) for i in ids)
    except Exception:
        pass
    return []  # empty → use free-text input


# ── render ────────────────────────────────────────────────────────────────────

def render_filter_bar() -> None:
    today = date.today()

    # ── All controls in one responsive row (matches prototype filter-bar) ──────
    c1, c2, c3, c4, c5, c6, c7, c8, c9 = st.columns([1.2, 1.2, 1.3, 1.3, 1.0, 1.1, 0.8, 0.7, 0.7])

    with c1:
        st.selectbox(
            "Date Range",
            options=list(DATE_RANGE_OPTIONS.keys()),
            format_func=lambda k: DATE_RANGE_OPTIONS[k],
            key="flt_date_range",
        )
    with c2:
        st.selectbox(
            "Date Context",
            options=list(DATE_CONTEXT_OPTIONS.keys()),
            format_func=lambda k: DATE_CONTEXT_OPTIONS[k],
            key="flt_date_context",
        )

    # Resolve window now so customer/business dropdowns are scoped correctly
    _f_pre = current_filters()
    _s, _e = _f_pre.resolve_window()
    _ss, _es = _s.isoformat(), _e.isoformat()

    with c3:
        customers = _load_customers(_ss, _es, _f_pre.date_context)
        current_cust = st.session_state.get("flt_customer", "ALL")
        if current_cust not in customers:
            current_cust = "ALL"
        st.selectbox(
            "Customer",
            options=customers,
            index=customers.index(current_cust),
            key="flt_customer",
            help="Customers active in the selected date range.",
        )

    with c4:
        chosen_cust = st.session_state.get("flt_customer", "ALL")
        bid_list = _load_business_ids(_ss, _es, _f_pre.date_context, chosen_cust)
        if bid_list:
            current_bid = st.session_state.get("flt_business_id", "")
            options = [""] + bid_list
            if current_bid not in options:
                current_bid = ""
            st.selectbox(
                "Business ID",
                options=options,
                index=options.index(current_bid),
                format_func=lambda v: v or "— all —",
                key="flt_business_id",
                help="Businesses in the selected date range & customer.",
            )
        else:
            st.text_input(
                "Business ID", key="flt_business_id",
                placeholder="bus_… (UUID)",
            )

    with c5:
        st.selectbox("Entity Type", options=ENTITY_TYPES, key="flt_entity_type")
    with c6:
        st.selectbox("Confidence Band", options=BANDS, key="flt_confidence_band")
    with c7:
        st.markdown("<div style='padding-top:22px'>", unsafe_allow_html=True)
        st.checkbox("Manual only", key="flt_manual_only")
        st.markdown("</div>", unsafe_allow_html=True)
    with c8:
        st.markdown("<div style='padding-top:20px'>", unsafe_allow_html=True)
        if st.button("✓ Apply", type="primary", use_container_width=True):
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
    with c9:
        st.markdown("<div style='padding-top:20px'>", unsafe_allow_html=True)
        if st.button("↺ Reset", use_container_width=True):
            st.session_state["flt_date_range"]     = "last_30d"
            st.session_state["flt_date_context"]   = "scored_at"
            st.session_state["flt_customer"]        = "ALL"
            st.session_state["flt_business_id"]    = ""
            st.session_state["flt_entity_type"]    = "ALL"
            st.session_state["flt_confidence_band"]= "ALL"
            st.session_state["flt_manual_only"]    = False
            st.session_state["flt_custom_start"]   = today - timedelta(days=30)
            st.session_state["flt_custom_end"]     = today
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    # ── Custom date picker (shown inline below when "Custom…" selected) ────────
    if st.session_state.get("flt_date_range") == "custom":
        _cs = st.session_state.get("flt_custom_start") or today - timedelta(days=30)
        _ce = st.session_state.get("flt_custom_end")   or today
        dc1, dc2, _dc3 = st.columns([1, 1, 7])
        with dc1:
            new_start = st.date_input("From", value=_cs, max_value=today, key="flt_custom_start")
        with dc2:
            new_end = st.date_input("To", value=_ce, min_value=new_start, max_value=today, key="flt_custom_end")
        if new_start > new_end:
            st.session_state["flt_custom_end"] = new_start

    # ── Active filter summary ──────────────────────────────────────────────────
    f = current_filters()
    start, end = f.resolve_window()
    _render_active_filter_chip(f, start, end)


def _render_active_filter_chip(f: FilterState, start: date, end: date) -> None:
    """Compact one-line summary of the active filter state."""
    cust_label = f.customer if f.customer and f.customer != "ALL" else "All customers"
    bid_label  = f"  ·  Business: `{f.business_id}`" if f.business_id else ""
    band_label = f"  ·  Band: {f.confidence_band}" if f.confidence_band != "ALL" else ""
    manual_label = "  ·  **Manual Review only**" if f.manual_only else ""
    st.caption(
        f"📅 **{start}** → **{end}** ({DATE_CONTEXT_OPTIONS[f.date_context]})  ·  "
        f"👤 {cust_label}{bid_label}{band_label}{manual_label}"
    )
