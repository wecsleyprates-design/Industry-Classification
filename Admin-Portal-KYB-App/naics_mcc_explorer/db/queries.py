"""All SQL query functions for the NAICS/MCC Explorer.

Rules:
- Only rds_** tables used for facts data.
- LENGTH(f.value) < 60000 guard on every facts join (Redshift VARCHAR limit).
- JSON_EXTRACT_PATH_TEXT with nested paths for new-schema records.
- Filters applied via WITH onboarded AS (...) CTE — no IN (list) size limits.

Platform -1 / "unknown" explanation:
  Older fact records use the schema {"source": {"name": "AINaicsEnrichment"}} —
  a human-readable string, not a numeric platformId. COALESCE(...) returns NULL
  for these, which becomes 'unknown' in GROUP BY. These are displayed as
  "Legacy Schema (P?)" in the UI.
"""
from __future__ import annotations

import streamlit as st
import pandas as pd
from db.connection import run_query


# ── Filter CTE builders ────────────────────────────────────────────────────────

def _onboarded_cte(date_from=None, date_to=None, customer_id=None, business_id=None) -> str:
    parts = ["1=1"]
    if date_from:
        parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    if customer_id:
        parts.append(f"rbcm.customer_id = '{customer_id}'")
    if business_id:
        parts.append(f"rbcm.business_id = '{business_id}'")
    where = " AND ".join(parts)
    return (
        "WITH onboarded AS (\n"
        "  SELECT DISTINCT rbcm.business_id, rbcm.customer_id\n"
        "  FROM rds_cases_public.rel_business_customer_monitoring rbcm\n"
        f"  WHERE {where}\n"
        ")\n"
    )


# ── Sidebar population queries ─────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_customers(date_from=None, date_to=None) -> pd.DataFrame:
    """Distinct customers in the date range.
    Uses customer_id directly — no join to a customers name table,
    as rds_cases_public.customers does not exist in this cluster."""
    parts = ["1=1"]
    if date_from:
        parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    where = " AND ".join(parts)
    try:
        df = run_query(f"""
            SELECT DISTINCT
                rbcm.customer_id,
                rbcm.customer_id AS customer_name
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            WHERE {where}
            ORDER BY rbcm.customer_id
        """)
        return df if df is not None else pd.DataFrame(columns=["customer_id","customer_name"])
    except Exception:
        return pd.DataFrame(columns=["customer_id","customer_name"])


@st.cache_data(ttl=300, show_spinner=False)
def load_businesses(date_from=None, date_to=None, customer_id=None) -> pd.DataFrame:
    parts = ["1=1"]
    if date_from:
        parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    if customer_id:
        parts.append(f"rbcm.customer_id = '{customer_id}'")
    where = " AND ".join(parts)
    return run_query(f"""
        SELECT DISTINCT rbcm.business_id
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        WHERE {where}
        ORDER BY rbcm.business_id
        LIMIT 5000
    """)


# ── Lookup tables ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=3600, show_spinner=False)
def load_naics_lookup() -> set[str]:
    df = run_query("SELECT DISTINCT CAST(code AS VARCHAR) AS code FROM rds_cases_public.core_naics_code")
    if df.empty:
        return set()
    return set(df["code"].dropna().astype(str).str.strip())


@st.cache_data(ttl=3600, show_spinner=False)
def load_mcc_lookup() -> set[str]:
    df = run_query("SELECT DISTINCT CAST(code AS VARCHAR) AS code FROM rds_cases_public.core_mcc_code")
    if df.empty:
        return set()
    return set(df["code"].dropna().astype(str).str.strip())


# ── Platform Winner Distribution ───────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_platform_winners(fact_name: str, date_from=None, date_to=None,
                          customer_id=None, business_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + f"""
        SELECT
            COALESCE(
                JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                'unknown'
            )                                                                      AS platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                     AS legacy_source_name,
            COUNT(DISTINCT f.business_id)                                          AS business_count,
            AVG(CAST(COALESCE(
                JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                '0') AS FLOAT))                                                    AS avg_confidence,
            SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NULL
                THEN 1 ELSE 0 END)                                                 AS null_value_count
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name = '{fact_name}'
          AND LENGTH(f.value) < 60000
        GROUP BY 1, 2
        ORDER BY 3 DESC
    """)


@st.cache_data(ttl=300, show_spinner=False)
def load_platform_winner_values(fact_name: str, date_from=None, date_to=None,
                                customer_id=None, business_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + f"""
        SELECT
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS fact_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS platform_id,
            COUNT(DISTINCT f.business_id)                                           AS business_count
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name = '{fact_name}'
          AND LENGTH(f.value) < 60000
          AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 50
    """)


# ── Fact Explorer ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_fact_explorer(fact_name: str, date_from=None, date_to=None,
                       customer_id=None, business_id=None,
                       limit: int = 500) -> pd.DataFrame:
    """Full fact rows with raw JSON for alternatives parsing."""
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + f"""
        SELECT
            f.business_id,
            o.customer_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS winning_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS winning_platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                      AS legacy_source_name,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                     '0')                                                           AS winning_confidence,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'updatedAt'),
                     '')                                                            AS winner_updated_at,
            f.value                                                                 AS raw_json,
            f.received_at
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name = '{fact_name}'
          AND LENGTH(f.value) < 60000
        ORDER BY f.received_at DESC
        LIMIT {limit}
    """)


# ── NAICS Validity ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_naics_facts(date_from=None, date_to=None,
                     customer_id=None, business_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + """
        SELECT
            f.business_id,
            o.customer_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS naics_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                      AS legacy_source_name,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                     '0')                                                           AS confidence,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'updatedAt'),
                     '')                                                            AS winner_updated_at,
            f.received_at,
            f.value                                                                 AS raw_json
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name = 'naics_code'
          AND LENGTH(f.value) < 60000
        ORDER BY f.business_id
    """)


# ── MCC Validity ──────────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_mcc_facts(date_from=None, date_to=None,
                   customer_id=None, business_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + """
        SELECT
            f.business_id,
            o.customer_id,
            f.name                                                                  AS fact_name,
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS mcc_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                      AS legacy_source_name,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                     '0')                                                           AS confidence,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'updatedAt'),
                     '')                                                            AS winner_updated_at,
            f.received_at,
            f.value                                                                 AS raw_json
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name IN ('mcc_code', 'mcc_code_found', 'mcc_code_from_naics')
          AND LENGTH(f.value) < 60000
        ORDER BY f.business_id, f.name
    """)


# ── Cascade Analysis ───────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_cascade_summary(date_from=None, date_to=None,
                         customer_id=None, business_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + """
        SELECT
            o.business_id,
            o.customer_id,
            MAX(CASE WHEN f.name = 'naics_code'
                THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END)                 AS naics_value,
            MAX(CASE WHEN f.name = 'naics_code'
                THEN COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                              'unknown') END)                                       AS naics_platform,
            MAX(CASE WHEN f.name = 'naics_code'
                THEN f.received_at::VARCHAR END)                                    AS naics_received_at,
            MAX(CASE WHEN f.name = 'naics_code'
                THEN f.value END)                                                   AS naics_raw_json,
            MAX(CASE WHEN f.name = 'mcc_code'
                THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END)                 AS mcc_value,
            MAX(CASE WHEN f.name = 'mcc_code'
                THEN f.received_at::VARCHAR END)                                    AS mcc_received_at,
            MAX(CASE WHEN f.name = 'mcc_code_found'
                THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END)                 AS mcc_found_value,
            MAX(CASE WHEN f.name = 'mcc_code_found'
                THEN f.received_at::VARCHAR END)                                    AS mcc_found_received_at,
            MAX(CASE WHEN f.name = 'mcc_code_from_naics'
                THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END)                 AS mcc_from_naics_value,
            MAX(CASE WHEN f.name = 'mcc_code_from_naics'
                THEN f.received_at::VARCHAR END)                                    AS mcc_from_naics_received_at,
            MAX(CASE WHEN f.name = 'mcc_code'
                THEN COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                              'unknown') END)                                       AS mcc_platform
        FROM onboarded o
        LEFT JOIN rds_warehouse_public.facts f
            ON f.business_id = o.business_id
            AND f.name IN ('naics_code', 'mcc_code', 'mcc_code_found', 'mcc_code_from_naics')
            AND LENGTH(f.value) < 60000
        GROUP BY o.business_id, o.customer_id
    """)


# ── Business Drilldown ────────────────────────────────────────────────────────

@st.cache_data(ttl=60, show_spinner=False)
def load_business_facts(business_id: str) -> pd.DataFrame:
    return run_query(f"""
        SELECT
            f.name                                                                  AS fact_name,
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS winning_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS winning_platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                      AS legacy_source_name,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                     '0')                                                           AS winning_confidence,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'updatedAt'),
                     '')                                                            AS winner_updated_at,
            f.value                                                                 AS raw_json,
            f.received_at,
            f.created_at
        FROM rds_warehouse_public.facts f
        WHERE f.business_id = '{business_id}'
          AND f.name IN ('naics_code', 'mcc_code', 'mcc_code_found', 'mcc_code_from_naics')
          AND LENGTH(f.value) < 60000
        ORDER BY f.name, f.received_at DESC
    """)


@st.cache_data(ttl=60, show_spinner=False)
def load_business_customer(business_id: str) -> pd.DataFrame:
    return run_query(f"""
        SELECT DISTINCT rbcm.customer_id,
               rbcm.customer_id AS customer_name,
               MIN(rbcm.created_at) AS first_seen,
               MAX(rbcm.created_at) AS last_seen
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        WHERE rbcm.business_id = '{business_id}'
        GROUP BY rbcm.customer_id
    """)


# ── Overview / Home ───────────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_overview(date_from=None, date_to=None, customer_id=None) -> pd.DataFrame:
    cte = _onboarded_cte(date_from, date_to, customer_id)
    return run_query(cte + """
        SELECT
            COUNT(DISTINCT o.business_id)                                           AS total_businesses,
            COUNT(DISTINCT o.customer_id)                                           AS total_customers,
            COUNT(DISTINCT CASE WHEN f.name = 'naics_code'
                AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
                THEN f.business_id END)                                             AS with_naics,
            COUNT(DISTINCT CASE WHEN f.name = 'mcc_code'
                AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
                THEN f.business_id END)                                             AS with_mcc,
            COUNT(DISTINCT CASE WHEN f.name = 'naics_code'
                AND COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                             'unknown') = '0'
                THEN f.business_id END)                                             AS naics_p0_wins,
            COUNT(DISTINCT CASE WHEN f.name = 'naics_code'
                AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') = '561499'
                THEN f.business_id END)                                             AS naics_catchall
        FROM onboarded o
        LEFT JOIN rds_warehouse_public.facts f
            ON f.business_id = o.business_id
            AND f.name IN ('naics_code', 'mcc_code')
            AND LENGTH(f.value) < 60000
    """)
