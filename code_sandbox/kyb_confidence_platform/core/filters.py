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

    # ── Row 1: date + entity controls ────────────────────────────────────────
    c1, c2, c3, c4, c5 = st.columns([1.2, 1.2, 1.1, 1.1, 1])
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
    with c3:
        st.selectbox("Entity Type", options=ENTITY_TYPES, key="flt_entity_type")
    with c4:
        st.selectbox("Confidence Band", options=BANDS, key="flt_confidence_band")
    with c5:
        st.checkbox("Manual Review only", key="flt_manual_only")

    # ── Custom date row — only shown when "Custom…" is selected ──────────────
    if st.session_state.get("flt_date_range") == "custom":
        cc1, cc2 = st.columns(2)
        _cs = st.session_state.get("flt_custom_start") or today - timedelta(days=30)
        _ce = st.session_state.get("flt_custom_end")   or today
        with cc1:
            new_start = st.date_input(
                "From",
                value=_cs,
                max_value=today,
                key="flt_custom_start",
            )
        with cc2:
            new_end = st.date_input(
                "To",
                value=_ce,
                min_value=new_start,   # enforce start ≤ end in the picker
                max_value=today,
                key="flt_custom_end",
            )
        # Clamp in session state if the user somehow set start > end
        if new_start > new_end:
            st.session_state["flt_custom_end"] = new_start
            st.warning("'To' date was before 'From' — adjusted automatically.")

    # ── Resolve the current window for use in dynamic option loaders ──────────
    f = current_filters()
    start, end = f.resolve_window()
    start_s, end_s = start.isoformat(), end.isoformat()
    date_col = f.date_context

    # ── Row 2: customer + business ID (dynamically linked to date range) ───────
    d1, d2 = st.columns([1.5, 1.5])

    with d1:
        customers = _load_customers(start_s, end_s, date_col)
        # Keep current value if it's still valid, otherwise reset to ALL
        current_cust = st.session_state.get("flt_customer", "ALL")
        if current_cust not in customers:
            current_cust = "ALL"
        cust_idx = customers.index(current_cust)
        chosen_customer = st.selectbox(
            "Customer",
            options=customers,
            index=cust_idx,
            key="flt_customer",
            help="Filtered to customers active in the selected date range.",
        )

    with d2:
        bid_list = _load_business_ids(start_s, end_s, date_col, chosen_customer)
        if bid_list:
            # Dropdown mode — manageable list
            current_bid = st.session_state.get("flt_business_id", "")
            options = [""] + bid_list
            if current_bid not in options:
                current_bid = ""
            bid_idx = options.index(current_bid)
            st.selectbox(
                "Business ID",
                options=options,
                index=bid_idx,
                format_func=lambda v: v or "— all businesses —",
                key="flt_business_id",
                help="Filtered to businesses active in the selected date range and customer.",
            )
        else:
            # Free-text fallback when the list is too large or Redshift unavailable
            st.text_input(
                "Business ID",
                key="flt_business_id",
                placeholder="Paste UUID (e.g. bus_…)",
                help="Filtered to businesses active in the selected date range.",
            )

    # ── Active filter summary chip ────────────────────────────────────────────
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
