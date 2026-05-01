"""Unified data router — every page imports from here.

Automatically picks the best available data source:
  1. SQLite cache (facts_cache.sqlite) — built from Admin Portal API, weekly refresh
  2. Redshift (rds_warehouse_public.facts) — live federated, falls back when no cache

All functions return DataFrames with consistent column names so pages
work identically regardless of which source is active.

Import pattern in every page:
    from db.data import get_data, DATA_SOURCE, data_source_banner
    df = get_data("platform_winners", fact_name="naics_code", client_name=client)
    data_source_banner()   # shows the green/amber banner at top of each section
"""
from __future__ import annotations

import pandas as pd
import streamlit as st
from db.cache_manager import cache_exists, get_cache_meta


# ── Which source is active ─────────────────────────────────────────────────────

def _using_cache() -> bool:
    return cache_exists()


def DATA_SOURCE() -> str:
    if _using_cache():
        meta = get_cache_meta()
        snap = (meta.get("snapshot_date","")[:16]).replace("T"," ")
        n    = meta.get("total_businesses", 0)
        return f"🗄️ Local Cache — {n:,} businesses · Data as of {snap} (from Admin Portal API)"
    return "📡 Live Redshift — rds_warehouse_public.facts (may lag behind Admin Portal)"


def data_source_banner() -> None:
    """Show a coloured banner on every page indicating which source is active."""
    if _using_cache():
        meta = get_cache_meta()
        snap = (meta.get("snapshot_date","")[:16]).replace("T"," ")
        n    = meta.get("total_businesses", 0)
        st.markdown(
            f"<div style='background:#0d2818;border:1px solid #22c55e;border-radius:6px;"
            f"padding:8px 14px;margin:4px 0 12px 0;font-size:.82rem'>"
            f"🗄️ <strong style='color:#22c55e'>Using Local Cache</strong>"
            f"<span style='color:#6ee7b7'> — {n:,} businesses · Data as of {snap}"
            f" (fetched from Admin Portal API)</span></div>",
            unsafe_allow_html=True,
        )
    else:
        st.markdown(
            "<div style='background:#1c1207;border:1px solid #f59e0b;border-radius:6px;"
            "padding:8px 14px;margin:4px 0 12px 0;font-size:.82rem'>"
            "📡 <strong style='color:#f59e0b'>Reading from Redshift</strong>"
            "<span style='color:#fcd34d'> — No local cache found. "
            "Run <code>python3 scripts/refresh_facts_cache.py</code> to build the cache "
            "from the Admin Portal API.</span></div>",
            unsafe_allow_html=True,
        )


# ── Universal dispatcher ───────────────────────────────────────────────────────

def get_data(query_name: str, **kwargs) -> pd.DataFrame:
    """Route any query to SQLite cache or Redshift depending on availability.

    query_name options:
      platform_winners, platform_winner_values, fact_drilldown,
      naics_facts, mcc_facts, cascade_summary, overview,
      client_platform_distribution, misidentification_signals,
      canonical_pair_status, canonical_pair_by_customer,
      business_facts, business_customer, changed_businesses,
      snapshot_comparison, paying_clients

    kwargs are passed through to the underlying query function.
    """
    if _using_cache():
        return _cache_dispatch(query_name, **kwargs)
    else:
        return _redshift_dispatch(query_name, **kwargs)


def _cache_dispatch(query_name: str, **kwargs) -> pd.DataFrame:
    from db import sqlite_queries as sq

    client_name = kwargs.get("client_name") or kwargs.get("client")
    business_id = kwargs.get("business_id")
    fact_name   = kwargs.get("fact_name", "naics_code")

    dispatch = {
        "platform_winners":              lambda: sq.get_platform_winners(fact_name, client_name, business_id),
        "platform_winner_values":        lambda: sq.get_platform_winner_values(fact_name, client_name, business_id),
        "fact_drilldown":                lambda: sq.get_fact_drilldown(fact_name, client_name, business_id),
        "naics_facts":                   lambda: sq.get_naics_facts(client_name, business_id),
        "mcc_facts":                     lambda: sq.get_mcc_facts(client_name, business_id),
        "cascade_summary":               lambda: sq.get_cascade_summary(client_name, business_id),
        "overview":                      lambda: sq.get_overview(client_name),
        "client_platform_distribution":  lambda: sq.get_client_platform_distribution(client_name),
        "misidentification_signals":     lambda: sq.get_misidentification_signals(client_name, business_id),
        "canonical_pair_status":         lambda: sq.get_misidentification_signals(client_name, business_id),
        "business_facts":                lambda: sq.get_business_drilldown(business_id).get("facts", pd.DataFrame()),
        "changed_businesses":            lambda: sq.get_changed_businesses(client_name, kwargs.get("field","naics")),
        "snapshot_comparison":           lambda: sq.get_snapshot_comparison(fact_name, client_name),
        "paying_clients":                lambda: sq.get_client_list(client_name),
        "client_naics_length":           lambda: _cache_naics_length(client_name),
        "client_applicant_vs_vendor":    lambda: _cache_p0_data(client_name, business_id),
        "platform_error_rate":           lambda: _cache_error_rate(client_name),
        "sector_mismatch":               lambda: _cache_sector(client_name),
    }

    fn = dispatch.get(query_name)
    if fn is None:
        return pd.DataFrame()
    try:
        return fn() or pd.DataFrame()
    except Exception as e:
        st.warning(f"Cache query '{query_name}' failed: {e}. Falling back to Redshift.", icon="⚠️")
        return _redshift_dispatch(query_name, **kwargs)


def _redshift_dispatch(query_name: str, **kwargs) -> pd.DataFrame:
    from db import queries as q

    date_from   = kwargs.get("date_from")
    date_to     = kwargs.get("date_to")
    customer_id = kwargs.get("customer_id")
    business_id = kwargs.get("business_id")
    fact_name   = kwargs.get("fact_name", "naics_code")
    client_name = kwargs.get("client_name")
    limit       = kwargs.get("limit", 500)

    dispatch = {
        "platform_winners":     lambda: q.load_platform_winners(fact_name, date_from, date_to, customer_id, business_id),
        "platform_winner_values": lambda: q.load_platform_winner_values(fact_name, date_from, date_to, customer_id, business_id),
        "fact_drilldown":       lambda: q.load_fact_drilldown(fact_name, date_from, date_to, customer_id, business_id, limit),
        "naics_facts":          lambda: q.load_naics_facts(date_from, date_to, customer_id, business_id),
        "mcc_facts":            lambda: q.load_mcc_facts(date_from, date_to, customer_id, business_id),
        "cascade_summary":      lambda: q.load_cascade_summary(date_from, date_to, customer_id, business_id),
        "overview":             lambda: q.load_overview(date_from, date_to, customer_id),
        "client_platform_distribution": lambda: q.load_client_platform_distribution(date_from, date_to, client_name),
        "misidentification_signals":    lambda: q.load_misidentification_signals(date_from, date_to, client_name),
        "canonical_pair_status":        lambda: q.load_canonical_pair_status(date_from, date_to, customer_id, business_id),
        "canonical_pair_by_customer":   lambda: q.load_canonical_pair_by_customer(date_from, date_to),
        "business_facts":               lambda: q.load_business_facts(business_id),
        "paying_clients":               lambda: q.load_paying_clients(date_from, date_to),
        "client_naics_length":          lambda: q.load_client_naics_length(date_from, date_to, client_name),
        "client_applicant_vs_vendor":   lambda: q.load_client_applicant_vs_vendor(date_from, date_to, client_name),
        "platform_error_rate":          lambda: q.load_platform_error_rate_by_client(date_from, date_to, client_name),
        "sector_mismatch":              lambda: q.load_sector_mismatch_by_client(date_from, date_to, client_name),
    }

    fn = dispatch.get(query_name)
    if fn is None:
        return pd.DataFrame()
    try:
        result = fn()
        return result if result is not None else pd.DataFrame()
    except Exception as e:
        st.error(f"Redshift query '{query_name}' failed: {e}", icon="🚨")
        return pd.DataFrame()


# ── Cache-specific helper queries (map Redshift queries using SQLite data) ────

def _cache_naics_length(client_name=None) -> pd.DataFrame:
    """NAICS digit length distribution from cache businesses table."""
    from db.cache_manager import get_conn
    import re
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name=?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    conn = get_conn()
    df = pd.read_sql_query(f"""
        SELECT client_name AS client, naics_platform_id AS winning_platform_id,
               CASE WHEN naics_code IS NULL THEN 'null'
                    ELSE CAST(LENGTH(naics_code) AS TEXT) END AS naics_length,
               COUNT(DISTINCT business_id) AS business_count
        FROM businesses {w}
        GROUP BY client_name, naics_platform_id, naics_length
        ORDER BY client_name, business_count DESC
    """, conn, params=p)
    conn.close()
    return df


def _cache_p0_data(client_name=None, business_id=None) -> pd.DataFrame:
    """P0 wins with alternatives from cache."""
    from db.cache_manager import get_conn
    clauses = ["b.is_latest=1", "b.naics_platform_id='0'"]
    p = []
    if client_name:
        clauses.append("b.client_name=?")
        p.append(client_name)
    if business_id:
        clauses.append("b.business_id=?")
        p.append(business_id)
    w = "WHERE " + " AND ".join(clauses)
    conn = get_conn()
    df = pd.read_sql_query(f"""
        SELECT b.client_name AS client, b.business_id,
               b.naics_code AS p0_winning_value,
               b.naics_confidence AS p0_confidence,
               b.naics_updated_at AS p0_updated_at,
               f.alternatives_json AS raw_json
        FROM businesses b
        LEFT JOIN facts f ON f.business_id=b.business_id
            AND f.fact_name='naics_code' AND f.is_latest=1
        {w}
        ORDER BY b.naics_updated_at DESC
    """, conn, params=p)
    conn.close()
    return df


def _cache_error_rate(client_name=None) -> pd.DataFrame:
    """Platform error rate from cache."""
    from db.cache_manager import get_conn
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name=?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    conn = get_conn()
    df = pd.read_sql_query(f"""
        SELECT client_name AS client, naics_platform_id AS winning_platform_id,
               COUNT(DISTINCT business_id) AS total_wins,
               SUM(CASE WHEN naics_code IS NULL THEN 1
                        WHEN naics_code='561499' THEN 1
                        WHEN LENGTH(naics_code)!=6 THEN 1 ELSE 0 END) AS flagged_wins,
               ROUND(100.0*SUM(CASE WHEN naics_code IS NULL THEN 1
                        WHEN naics_code='561499' THEN 1
                        WHEN LENGTH(naics_code)!=6 THEN 1 ELSE 0 END)
                    /MAX(1.0*COUNT(DISTINCT business_id)),1) AS flag_pct
        FROM businesses {w}
        GROUP BY client_name, naics_platform_id
        ORDER BY client_name, total_wins DESC
    """, conn, params=p)
    conn.close()
    return df


def _cache_sector(client_name=None) -> pd.DataFrame:
    """Sector distribution from cache."""
    from db.cache_manager import get_conn
    clauses = ["is_latest=1", "naics_code IS NOT NULL"]
    p = []
    if client_name:
        clauses.append("client_name=?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    conn = get_conn()
    df = pd.read_sql_query(f"""
        SELECT client_name AS client,
               SUBSTR(naics_code,1,2) AS winning_sector,
               COUNT(DISTINCT business_id) AS businesses,
               SUM(CASE WHEN naics_code='561499' THEN 1 ELSE 0 END) AS catchall_count,
               AVG(naics_confidence) AS avg_confidence
        FROM businesses {w}
        GROUP BY client_name, winning_sector
        ORDER BY client_name, businesses DESC
    """, conn, params=p)
    conn.close()
    return df


# ── Customer/client name helpers ───────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_customers_unified(date_from=None, date_to=None) -> pd.DataFrame:
    """Returns paying clients from cache or Redshift.
    Columns: customer_id, customer_name, business_count
    """
    if _using_cache():
        from db.cache_manager import get_conn
        conn = get_conn()
        df = pd.read_sql_query(
            "SELECT customer_id, client_name AS customer_name, COUNT(DISTINCT business_id) AS business_count "
            "FROM businesses WHERE is_latest=1 GROUP BY customer_id, client_name ORDER BY business_count DESC",
            conn
        )
        conn.close()
        return df
    else:
        from db.queries import load_customers
        return load_customers(date_from, date_to)


@st.cache_data(ttl=300, show_spinner=False)
def load_businesses_unified(date_from=None, date_to=None, customer_id=None) -> pd.DataFrame:
    """Returns business IDs from cache or Redshift."""
    if _using_cache():
        from db.cache_manager import get_conn
        clauses = ["is_latest=1"]
        p = []
        if customer_id:
            clauses.append("customer_id=?")
            p.append(customer_id)
        conn = get_conn()
        df = pd.read_sql_query(
            f"SELECT DISTINCT business_id FROM businesses WHERE {' AND '.join(clauses)} ORDER BY business_id",
            conn, params=p
        )
        conn.close()
        return df
    else:
        from db.queries import load_businesses
        return load_businesses(date_from, date_to, customer_id)
