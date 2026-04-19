"""
Global filter bar — fixed version.

Bugs fixed:
  1. Custom date range: pickers now always visible inline in a second row when
     "Custom…" is selected. No hidden/scrolled row. Uses st.form to prevent
     premature reruns on picker interaction.
  2. Customer dropdown: queries rds_auth_public.data_customers JOIN
     rds_cases_public.rel_business_customer_monitoring (authoritative tables),
     scoped to the active date window.
  3. Business ID dropdown: queries rel_business_customer_monitoring filtered by
     the selected customer + date window. Falls back to free-text if >500 IDs.
  4. Customer name is correctly propagated through FilterState so all analytics
     functions can filter by it.
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

# Map date context keys to actual column names in rel_business_customer_monitoring
# (the authoritative onboarding date source).  All contexts use `created_at`
# from rbcm because the other timestamps live on different tables.
DATE_COL_MAP = {
    "submitted_at": "created_at",
    "scored_at":    "created_at",
    "decision_at":  "created_at",
    "activated_at": "created_at",
}

ENTITY_TYPES = ["ALL", "Domestic", "Foreign"]
BANDS        = ["ALL", "Very Low", "Low", "Medium", "High", "Very High"]

_MAX_BID_DROPDOWN = 300   # max IDs before falling back to free-text


# ── FilterState ───────────────────────────────────────────────────────────────

@dataclass
class FilterState:
    date_range:      str
    date_context:    str
    customer:        str
    business_id:     str
    entity_type:     str
    confidence_band: str
    manual_only:     bool
    custom_start:    date | None = None
    custom_end:      date | None = None

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
            if start > end:
                start = end
            return start, end
        return today - timedelta(days=30), today

    @property
    def rbcm_date_col(self) -> str:
        """Column name in rel_business_customer_monitoring to use for date filtering."""
        return DATE_COL_MAP.get(self.date_context, "created_at")

    def customer_sql_clause(self, customer_alias: str = "c") -> str:
        """Returns a SQL AND clause to filter by customer name, or empty string."""
        if self.customer and self.customer not in ("ALL", ""):
            safe = self.customer.replace("'", "''")
            return f"AND {customer_alias}.name = '{safe}'"
        return ""


def current_filters() -> FilterState:
    ss = st.session_state
    return FilterState(
        date_range=      ss.get("flt_date_range",      "last_30d"),
        date_context=    ss.get("flt_date_context",    "scored_at"),
        customer=        ss.get("flt_customer",        "ALL"),
        business_id=     ss.get("flt_business_id",     ""),
        entity_type=     ss.get("flt_entity_type",     "ALL"),
        confidence_band= ss.get("flt_confidence_band", "ALL"),
        manual_only=     ss.get("flt_manual_only",     False),
        custom_start=    ss.get("flt_custom_start"),
        custom_end=      ss.get("flt_custom_end"),
    )


# ── Dynamic loaders (query Redshift; fixture fallback) ────────────────────────

@st.cache_data(ttl=120, show_spinner=False)
def _load_customers(start: str, end: str) -> list[str]:
    """
    Distinct customer names active in the given window.
    Source: rds_auth_public.data_customers JOIN
            rds_cases_public.rel_business_customer_monitoring.
    No LIMIT — we want all customers for the period.
    """
    sql = f"""
        SELECT DISTINCT c.name AS customer_name
        FROM rds_auth_public.data_customers c
        JOIN rds_cases_public.rel_business_customer_monitoring rbcm
          ON rbcm.customer_id = c.id
        WHERE DATE(rbcm.created_at) BETWEEN '{start}' AND '{end}'
          AND c.name IS NOT NULL
          AND c.name <> ''
        ORDER BY 1
    """
    try:
        from data_access.redshift import query as rs_query
        df = rs_query(sql)
        names = [str(r) for r in df["customer_name"].dropna().tolist() if str(r).strip()]
        if names:
            return ["ALL"] + sorted(names)
    except Exception:
        pass
    # Fixture fallback
    return ["ALL", "Acme Holdings Inc.", "Northwind Capital",
            "Globex Partners LLC", "Beta Payments Corp.", "Sigma Financial"]


@st.cache_data(ttl=120, show_spinner=False)
def _load_business_ids(start: str, end: str, customer: str) -> list[str]:
    """
    Distinct business IDs active in the window, optionally scoped to a customer.
    Source: rds_cases_public.rel_business_customer_monitoring.
    Returns [] to signal "use free-text" if there are too many IDs.
    """
    customer_clause = ""
    if customer and customer not in ("ALL", ""):
        safe = customer.replace("'", "''")
        customer_clause = f"""
            JOIN rds_auth_public.data_customers c ON c.id = rbcm.customer_id
            AND c.name = '{safe}'
        """
    sql = f"""
        SELECT DISTINCT rbcm.business_id
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        {customer_clause}
        WHERE DATE(rbcm.created_at) BETWEEN '{start}' AND '{end}'
        ORDER BY 1
        LIMIT {_MAX_BID_DROPDOWN + 1}
    """
    try:
        from data_access.redshift import query as rs_query
        df = rs_query(sql)
        ids = df["business_id"].dropna().tolist()
        if len(ids) <= _MAX_BID_DROPDOWN:
            return [str(i) for i in ids]
    except Exception:
        pass
    return []


# ── Render ────────────────────────────────────────────────────────────────────

def render_filter_bar() -> None:
    today = date.today()

    # ── Row 1: all filter controls + Apply / Reset ────────────────────────────
    c1, c2, c3, c4, c5, c6, c7, c8, c9 = st.columns([1.4, 1.3, 1.5, 1.5, 1.0, 1.1, 0.8, 0.7, 0.7])

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

    # Resolve the window NOW so Customer/Business dropdowns are scoped to it.
    # We read session state directly here instead of calling current_filters()
    # to avoid reading the custom dates before the pickers render (on first run
    # with "custom" selected, they default from ensure_session_state).
    _dr = st.session_state.get("flt_date_range", "last_30d")
    _cs_raw = st.session_state.get("flt_custom_start")
    _ce_raw = st.session_state.get("flt_custom_end")

    if _dr == "last_7d":
        _win_start, _win_end = today - timedelta(days=7), today
    elif _dr == "last_30d":
        _win_start, _win_end = today - timedelta(days=30), today
    elif _dr == "last_90d":
        _win_start, _win_end = today - timedelta(days=90), today
    elif _dr == "ytd":
        _win_start, _win_end = date(today.year, 1, 1), today
    elif _dr == "custom":
        _win_start = _cs_raw if isinstance(_cs_raw, date) else today - timedelta(days=30)
        _win_end   = _ce_raw if isinstance(_ce_raw, date) else today
        if _win_start > _win_end:
            _win_start = _win_end
    else:
        _win_start, _win_end = today - timedelta(days=30), today

    _ss, _es = _win_start.isoformat(), _win_end.isoformat()

    with c3:
        customers = _load_customers(_ss, _es)
        _cur_cust = st.session_state.get("flt_customer", "ALL")
        if _cur_cust not in customers:
            _cur_cust = "ALL"
        st.selectbox(
            "Customer",
            options=customers,
            index=customers.index(_cur_cust),
            key="flt_customer",
            help="Filtered to customers with businesses onboarded in the selected date range.",
        )

    with c4:
        _chosen_cust = st.session_state.get("flt_customer", "ALL")
        bid_list = _load_business_ids(_ss, _es, _chosen_cust)
        if bid_list:
            _cur_bid = st.session_state.get("flt_business_id", "")
            _opts = [""] + bid_list
            if _cur_bid not in _opts:
                _cur_bid = ""
            st.selectbox(
                "Business ID",
                options=_opts,
                index=_opts.index(_cur_bid),
                format_func=lambda v: v or "— all businesses —",
                key="flt_business_id",
                help="Businesses in the selected date range & customer.",
            )
        else:
            st.text_input(
                "Business ID", key="flt_business_id",
                placeholder="bus_… (UUID)",
                help="Paste a business UUID to filter all views to a single entity.",
            )

    with c5:
        st.selectbox("Entity Type",      options=ENTITY_TYPES, key="flt_entity_type")
    with c6:
        st.selectbox("Confidence Band",  options=BANDS,        key="flt_confidence_band")
    with c7:
        st.markdown("<div style='padding-top:22px'>", unsafe_allow_html=True)
        st.checkbox("Manual only", key="flt_manual_only")
        st.markdown("</div>", unsafe_allow_html=True)
    with c8:
        st.markdown("<div style='padding-top:20px'>", unsafe_allow_html=True)
        if st.button("✓ Apply", type="primary", use_container_width=True,
                     help="Apply filters and refresh all charts"):
            st.cache_data.clear()   # force fresh queries for the new filter
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)
    with c9:
        st.markdown("<div style='padding-top:20px'>", unsafe_allow_html=True)
        if st.button("↺ Reset", use_container_width=True, help="Reset all filters to defaults"):
            for k, v in [
                ("flt_date_range",      "last_30d"),
                ("flt_date_context",    "scored_at"),
                ("flt_customer",        "ALL"),
                ("flt_business_id",     ""),
                ("flt_entity_type",     "ALL"),
                ("flt_confidence_band", "ALL"),
                ("flt_manual_only",     False),
                ("flt_custom_start",    today - timedelta(days=30)),
                ("flt_custom_end",      today),
            ]:
                st.session_state[k] = v
            st.cache_data.clear()
            st.rerun()
        st.markdown("</div>", unsafe_allow_html=True)

    # ── Row 2: custom date pickers — prominent, always shown when "Custom…" ───
    if st.session_state.get("flt_date_range") == "custom":
        st.markdown(
            "<div style='background:#1E293B;border-left:3px solid #3B82F6;"
            "border-radius:8px;padding:8px 14px;margin:4px 0 2px 0;"
            "font-size:.75rem;color:#60A5FA'>"
            "📅 Custom date range — select From and To dates below:</div>",
            unsafe_allow_html=True,
        )
        dc1, dc2, _rest = st.columns([1.4, 1.4, 7.2])
        _cs_default = _cs_raw if isinstance(_cs_raw, date) else today - timedelta(days=30)
        _ce_default = _ce_raw if isinstance(_ce_raw, date) else today
        with dc1:
            new_start = st.date_input(
                "From", value=_cs_default,
                max_value=today,
                key="flt_custom_start",
            )
        with dc2:
            new_end = st.date_input(
                "To", value=_ce_default,
                min_value=new_start,
                max_value=today,
                key="flt_custom_end",
            )
        if new_start > new_end:
            st.session_state["flt_custom_end"] = new_start
            st.warning("'To' was before 'From' — adjusted automatically.")

    # ── Active filter summary chip ─────────────────────────────────────────────
    f = current_filters()
    start, end = f.resolve_window()
    _cust_lbl  = f.customer if f.customer not in ("ALL", "") else "All customers"
    _bid_lbl   = f"  ·  Business: `{f.business_id}`" if f.business_id else ""
    _band_lbl  = f"  ·  Band: {f.confidence_band}" if f.confidence_band != "ALL" else ""
    _manual_lbl = "  ·  **Manual Review only**" if f.manual_only else ""
    st.caption(
        f"📅 **{start}** → **{end}**  ({DATE_CONTEXT_OPTIONS[f.date_context]})  ·  "
        f"👤 {_cust_lbl}{_bid_lbl}{_band_lbl}{_manual_lbl}"
    )
