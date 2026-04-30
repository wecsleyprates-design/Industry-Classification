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
    """Distinct customers with human-readable names and business counts.

    Primary source: rds_auth_public.data_customers (same as kyb_hub_app_v2.py).
    Fallback: customer_id only if the join fails.
    Columns returned: customer_id, customer_name, business_count
    """
    parts = ["1=1"]
    if date_from:
        parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    where = " AND ".join(parts)

    # Primary: join to rds_auth_public.data_customers for human-readable names
    try:
        df = run_query(f"""
            SELECT
                rbcm.customer_id,
                dc.name                             AS customer_name,
                COUNT(DISTINCT rbcm.business_id)    AS business_count
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            JOIN rds_auth_public.data_customers dc ON dc.id = rbcm.customer_id
            WHERE {where}
            GROUP BY rbcm.customer_id, dc.name
            ORDER BY business_count DESC, dc.name
        """)
        if df is not None and not df.empty and "customer_name" in df.columns:
            return df
    except Exception:
        pass

    # Fallback: customer_id as the name
    try:
        df = run_query(f"""
            SELECT
                rbcm.customer_id,
                rbcm.customer_id                    AS customer_name,
                COUNT(DISTINCT rbcm.business_id)    AS business_count
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            WHERE {where}
            GROUP BY rbcm.customer_id
            ORDER BY business_count DESC
        """)
        return df if df is not None else pd.DataFrame(columns=["customer_id","customer_name","business_count"])
    except Exception:
        return pd.DataFrame(columns=["customer_id","customer_name","business_count"])


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
# Confirmed table structure from kyb_hub_app_v2.py usage:
#   core_naics_code: id (PK), code (6-digit string), title (human-readable)
#   core_mcc_code:   id (PK), code (4-digit string), title (human-readable)
#   rel_naics_mcc:   naics_id (FK→core_naics_code.id), mcc_id (FK→core_mcc_code.id)
# Source: rds_cases_public schema (Redshift federated from RDS PostgreSQL)

@st.cache_data(ttl=3600, show_spinner=False)
def load_naics_lookup() -> set[str]:
    """Returns set of valid 6-digit NAICS code strings."""
    try:
        df = run_query("""
            SELECT DISTINCT CAST(code AS VARCHAR) AS code
            FROM rds_cases_public.core_naics_code
            WHERE code IS NOT NULL
        """)
        if df is None or df.empty:
            return set()
        return set(df["code"].dropna().astype(str).str.strip())
    except Exception:
        return set()


@st.cache_data(ttl=3600, show_spinner=False)
def load_naics_lookup_full() -> pd.DataFrame:
    """Returns DataFrame with code + label for NAICS codes.
    Column name: 'label' (confirmed from warehouse review_metrics.sql:79, nid.label).
    Source: rds_cases_public.core_naics_code (id PK, code VARCHAR, label VARCHAR)
    """
    try:
        df = run_query("""
            SELECT CAST(code AS VARCHAR) AS code,
                   COALESCE(label, '') AS label
            FROM rds_cases_public.core_naics_code
            WHERE code IS NOT NULL
            ORDER BY code
        """)
        return df if df is not None else pd.DataFrame(columns=["code","label"])
    except Exception:
        try:
            df = run_query("SELECT DISTINCT CAST(code AS VARCHAR) AS code FROM rds_cases_public.core_naics_code WHERE code IS NOT NULL")
            if df is not None and not df.empty:
                df["label"] = ""
                return df
        except Exception:
            pass
        return pd.DataFrame(columns=["code","label"])


@st.cache_data(ttl=3600, show_spinner=False)
def load_mcc_lookup() -> set[str]:
    """Returns set of valid 4-digit MCC code strings."""
    try:
        df = run_query("""
            SELECT DISTINCT CAST(code AS VARCHAR) AS code
            FROM rds_cases_public.core_mcc_code
            WHERE code IS NOT NULL
        """)
        if df is None or df.empty:
            return set()
        return set(df["code"].dropna().astype(str).str.strip())
    except Exception:
        return set()


@st.cache_data(ttl=3600, show_spinner=False)
def load_mcc_lookup_full() -> pd.DataFrame:
    """Returns DataFrame with code + label for MCC codes.
    Column name: 'label' (confirmed from warehouse review_metrics.sql:83, mid.label).
    Source: rds_cases_public.core_mcc_code (id PK, code VARCHAR, label VARCHAR)
    """
    try:
        df = run_query("""
            SELECT CAST(code AS VARCHAR) AS code,
                   COALESCE(label, '') AS label
            FROM rds_cases_public.core_mcc_code
            WHERE code IS NOT NULL
            ORDER BY code
        """)
        return df if df is not None else pd.DataFrame(columns=["code","label"])
    except Exception:
        try:
            df = run_query("SELECT DISTINCT CAST(code AS VARCHAR) AS code FROM rds_cases_public.core_mcc_code WHERE code IS NOT NULL")
            if df is not None and not df.empty:
                df["label"] = ""
                return df
        except Exception:
            pass
        return pd.DataFrame(columns=["code","label"])


@st.cache_data(ttl=3600, show_spinner=False)
def load_canonical_pairs() -> pd.DataFrame:
    """All canonical NAICS→MCC pairs from rel_naics_mcc with human-readable labels.

    Confirmed column names from warehouse-service review_metrics.sql:
      nid.label = NAICS description (naics_label)
      mid.label = MCC description (mcc_label)
    NOT 'title' — 'label' is the correct column name.

    Same join pattern as kyb_hub_app_v2.py lines 10860-10862.
    Return columns: naics_code, naics_label, mcc_code, mcc_label
    """
    try:
        df = run_query("""
            SELECT DISTINCT
                nc.code              AS naics_code,
                COALESCE(nc.label, '') AS naics_label,
                mc.code              AS mcc_code,
                COALESCE(mc.label, '') AS mcc_label
            FROM rds_cases_public.rel_naics_mcc r
            JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
            JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
            WHERE nc.code IS NOT NULL AND mc.code IS NOT NULL
            ORDER BY nc.code, mc.code
        """)
        return df if df is not None else pd.DataFrame(columns=["naics_code","naics_label","mcc_code","mcc_label"])
    except Exception:
        try:
            df = run_query("""
                SELECT DISTINCT nc.code AS naics_code, mc.code AS mcc_code
                FROM rds_cases_public.rel_naics_mcc r
                JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
                JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
                WHERE nc.code IS NOT NULL AND mc.code IS NOT NULL
            """)
            if df is not None and not df.empty:
                df["naics_label"] = ""
                df["mcc_label"]   = ""
                return df
        except Exception:
            pass
        return pd.DataFrame(columns=["naics_code","naics_label","mcc_code","mcc_label"])


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


# ── Platform-fact drilldown (winner + all MCC variants for the same business) ──

@st.cache_data(ttl=300, show_spinner=False)
def load_fact_drilldown(fact_name: str, date_from=None, date_to=None,
                        customer_id=None, business_id=None,
                        limit: int = 500) -> pd.DataFrame:
    """Per-business drilldown: winning value + all MCC variants + raw JSON for alternatives.

    Returns one row per business with:
      - winning NAICS (or MCC) value, platform, confidence, updated_at, received_at
      - mcc_code (final), mcc_code_found (AI), mcc_code_from_naics (NAICS-derived)
      - raw_json for alternatives[] parsing
    """
    cte = _onboarded_cte(date_from, date_to, customer_id, business_id)
    return run_query(cte + f"""
        SELECT
            o.business_id,
            o.customer_id,
            -- Winning fact
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                               AS winning_value,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'),
                     'unknown')                                                     AS winning_platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')                      AS winning_platform_name_legacy,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence'),
                     '')                                                            AS winning_confidence,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'updatedAt'),
                     '')                                                            AS winner_updated_at,
            f.received_at                                                           AS winner_received_at,
            f.value                                                                 AS raw_json,
            -- MCC variants (always joined regardless of selected fact)
            MAX(CASE WHEN mf.name = 'mcc_code'
                THEN JSON_EXTRACT_PATH_TEXT(mf.value, 'value') END)                AS mcc_code,
            MAX(CASE WHEN mf.name = 'mcc_code'
                THEN mf.received_at::VARCHAR END)                                   AS mcc_received_at,
            MAX(CASE WHEN mf.name = 'mcc_code_found'
                THEN JSON_EXTRACT_PATH_TEXT(mf.value, 'value') END)                AS mcc_code_found,
            MAX(CASE WHEN mf.name = 'mcc_code_found'
                THEN mf.received_at::VARCHAR END)                                   AS mcc_found_received_at,
            MAX(CASE WHEN mf.name = 'mcc_code_from_naics'
                THEN JSON_EXTRACT_PATH_TEXT(mf.value, 'value') END)                AS mcc_code_from_naics,
            MAX(CASE WHEN mf.name = 'mcc_code_from_naics'
                THEN mf.received_at::VARCHAR END)                                   AS mcc_from_naics_received_at,
            MAX(CASE WHEN mf.name = 'mcc_description'
                THEN JSON_EXTRACT_PATH_TEXT(mf.value, 'value') END)                AS mcc_description,
            MAX(CASE WHEN mf.name = 'naics_description'
                THEN JSON_EXTRACT_PATH_TEXT(mf.value, 'value') END)                AS naics_description
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        LEFT JOIN rds_warehouse_public.facts mf
            ON mf.business_id = f.business_id
            AND mf.name IN ('mcc_code', 'mcc_code_found', 'mcc_code_from_naics',
                            'mcc_description', 'naics_description')
            AND LENGTH(mf.value) < 60000
        WHERE f.name = '{fact_name}'
          AND LENGTH(f.value) < 60000
        GROUP BY
            o.business_id, o.customer_id,
            f.value, f.received_at
        ORDER BY f.received_at DESC
        LIMIT {limit}
    """)


# ── Canonical pair analysis ─────────────────────────────────────────────────────

@st.cache_data(ttl=300, show_spinner=False)
def load_canonical_pair_status(date_from=None, date_to=None,
                               customer_id=None) -> pd.DataFrame:
    """For each business: classify NAICS+MCC as canonical, non-canonical, etc.
    Uses rds_cases_public.rel_naics_mcc as the ground truth mapping.
    Same approach as kyb_hub_app_v2.py Section 6.2."""
    cte = _onboarded_cte(date_from, date_to, customer_id)
    return run_query(cte + """
        , naics_f AS (
            SELECT f.business_id,
                   JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_naics,
                   COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId'), 'unknown') AS naics_platform
            FROM rds_warehouse_public.facts f
            JOIN onboarded o ON o.business_id = f.business_id
            WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
        ),
        mcc_f AS (
            SELECT f.business_id,
                   JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_mcc
            FROM rds_warehouse_public.facts f
            JOIN onboarded o ON o.business_id = f.business_id
            WHERE f.name = 'mcc_code' AND LENGTH(f.value) < 60000
        ),
        canonical_pairs AS (
            SELECT DISTINCT nc.code AS naics_code, mc.code AS mcc_code
            FROM rds_cases_public.rel_naics_mcc r
            JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
            JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
        )
        SELECT
            n.business_id,
            n.final_naics,
            n.naics_platform,
            m.final_mcc,
            CASE
                WHEN n.final_naics = '561499' OR m.final_mcc = '5614' THEN 'Fallback / Invalid'
                WHEN n.final_naics IS NULL OR n.final_naics = ''      THEN 'NAICS Missing'
                WHEN m.final_mcc   IS NULL OR m.final_mcc   = ''      THEN 'MCC Missing'
                WHEN cp.naics_code IS NOT NULL                         THEN 'Canonical Pair ✅'
                ELSE 'Non-Canonical Pair ⚠️'
            END AS pair_status,
            CASE WHEN cp.naics_code IS NOT NULL THEN 1 ELSE 0 END AS is_canonical
        FROM naics_f n
        LEFT JOIN mcc_f m ON m.business_id = n.business_id
        LEFT JOIN canonical_pairs cp
            ON cp.naics_code = n.final_naics AND cp.mcc_code = m.final_mcc
    """)


@st.cache_data(ttl=300, show_spinner=False)
def load_canonical_pair_by_customer(date_from=None, date_to=None) -> pd.DataFrame:
    """Canonical pair status aggregated by customer, with customer name."""
    cte = _onboarded_cte(date_from, date_to)
    return run_query(cte + """
        , naics_f AS (
            SELECT f.business_id,
                   JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_naics
            FROM rds_warehouse_public.facts f JOIN onboarded o ON o.business_id = f.business_id
            WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
        ),
        mcc_f AS (
            SELECT f.business_id,
                   JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_mcc
            FROM rds_warehouse_public.facts f JOIN onboarded o ON o.business_id = f.business_id
            WHERE f.name = 'mcc_code' AND LENGTH(f.value) < 60000
        ),
        canonical_pairs AS (
            SELECT DISTINCT nc.code AS naics_code, mc.code AS mcc_code
            FROM rds_cases_public.rel_naics_mcc r
            JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
            JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
        ),
        classified AS (
            SELECT o.customer_id, n.business_id,
                CASE
                    WHEN n.final_naics='561499' OR m.final_mcc='5614' THEN 'Fallback / Invalid'
                    WHEN n.final_naics IS NULL OR n.final_naics=''    THEN 'NAICS Missing'
                    WHEN m.final_mcc   IS NULL OR m.final_mcc=''      THEN 'MCC Missing'
                    WHEN cp.naics_code IS NOT NULL                     THEN 'Canonical Pair'
                    ELSE 'Non-Canonical Pair'
                END AS pair_status
            FROM naics_f n
            JOIN onboarded o ON o.business_id = n.business_id
            LEFT JOIN mcc_f m ON m.business_id = n.business_id
            LEFT JOIN canonical_pairs cp
                ON cp.naics_code = n.final_naics AND cp.mcc_code = m.final_mcc
        )
        SELECT
            c.customer_id,
            COALESCE(dc.name, c.customer_id) AS customer_name,
            c.pair_status,
            COUNT(DISTINCT c.business_id)    AS businesses,
            ROUND(100.0 * COUNT(DISTINCT c.business_id)
                / SUM(COUNT(DISTINCT c.business_id)) OVER (PARTITION BY c.customer_id), 1) AS pct
        FROM classified c
        LEFT JOIN rds_auth_public.data_customers dc ON dc.id = c.customer_id
        GROUP BY c.customer_id, dc.name, c.pair_status
        ORDER BY c.customer_id, businesses DESC
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
