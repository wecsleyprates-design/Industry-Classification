"""Classification Decision Intelligence — all analysis queries.

All queries read from:
  - facts_cache.sqlite (when available) — primary source
  - rds_warehouse_public.facts (Redshift fallback)
  - rds_cases_public.rel_naics_mcc / core_naics_code / core_mcc_code (lookups)

These queries power the Classification Intelligence page.
"""
from __future__ import annotations

import json
import pandas as pd
import streamlit as st
from db.cache_manager import cache_exists, get_conn as _sqlite_conn
from db.connection import run_query as _redshift


# ── Helpers ───────────────────────────────────────────────────────────────────

def _using_cache() -> bool:
    return cache_exists()


def _q(sql: str, params: list = None) -> pd.DataFrame:
    try:
        conn = _sqlite_conn()
        df = pd.read_sql_query(sql, conn, params=params or [])
        conn.close()
        return df
    except Exception as e:
        st.warning(f"Query failed: {e}", icon="⚠️")
        return pd.DataFrame()


def _rq(sql: str) -> pd.DataFrame:
    try:
        result = _redshift(sql)
        return result if result is not None else pd.DataFrame()
    except Exception as e:
        st.warning(f"Redshift query failed: {e}", icon="⚠️")
        return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — Decision Flow Counts
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_flow_counts(client_name: str = None) -> dict:
    """Live counts at every branch of the classification decision tree."""
    if _using_cache():
        clauses = ["is_latest=1"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)

        df = _q(f"""
            SELECT
                COUNT(DISTINCT business_id)                                          AS total_businesses,
                SUM(CASE WHEN naics_code IS NOT NULL AND naics_code!='' THEN 1 ELSE 0 END) AS has_naics,
                SUM(CASE WHEN naics_code IS NULL OR naics_code='' THEN 1 ELSE 0 END)       AS no_naics,
                SUM(CASE WHEN naics_code='561499' THEN 1 ELSE 0 END)                       AS naics_catchall,
                SUM(CASE WHEN mcc_code_found IS NOT NULL THEN 1 ELSE 0 END)                AS ai_mcc_fired,
                SUM(CASE WHEN mcc_code_from_naics IS NOT NULL THEN 1 ELSE 0 END)           AS lookup_mcc_fired,
                SUM(CASE WHEN mcc_code IS NOT NULL THEN 1 ELSE 0 END)                      AS final_mcc_exists,
                SUM(CASE WHEN mcc_code IS NULL THEN 1 ELSE 0 END)                         AS final_mcc_missing,
                SUM(CASE WHEN mcc_code_found IS NOT NULL
                         AND (mcc_code_from_naics IS NULL OR mcc_code_found=mcc_code) THEN 1 ELSE 0 END) AS ai_won_mcc,
                SUM(CASE WHEN mcc_code_from_naics IS NOT NULL
                         AND mcc_code_found IS NULL
                         AND mcc_code IS NOT NULL THEN 1 ELSE 0 END)                      AS lookup_won_mcc,
                SUM(CASE WHEN is_canonical_pair=1 THEN 1 ELSE 0 END)                      AS canonical_pairs,
                SUM(CASE WHEN naics_code='5614' OR mcc_code='5614' THEN 1 ELSE 0 END)     AS has_5614,
                SUM(CASE WHEN mcc_code='7399' THEN 1 ELSE 0 END)                          AS mcc_catchall
            FROM businesses {w}
        """, p)
        if df.empty:
            return {}
        return dict(zip(df.columns, df.iloc[0].tolist()))

    # Redshift fallback
    cte = ""
    if client_name:
        safe = client_name.replace("'","''")
        cte = f"AND bp.client = '{safe}'"
    df = _rq(f"""
        WITH b AS (
            SELECT DISTINCT rbcm.business_id
            FROM rds_cases_public.rel_business_customer_monitoring rbcm
            JOIN datascience.billing_prices bp ON bp.customer_id=rbcm.customer_id
            WHERE bp.client IS NOT NULL {cte}
              AND DATE(rbcm.created_at) >= '2026-01-01'
        )
        SELECT
            COUNT(DISTINCT b.business_id) AS total_businesses,
            SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NOT NULL THEN 1 ELSE 0 END) AS has_naics,
            SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value') IS NULL THEN 1 ELSE 0 END) AS no_naics,
            SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value,'value')='561499' THEN 1 ELSE 0 END) AS naics_catchall
        FROM b
        LEFT JOIN rds_warehouse_public.facts f
            ON f.business_id=b.business_id AND f.name='naics_code' AND LENGTH(f.value)<60000
    """)
    return dict(zip(df.columns, df.iloc[0].tolist())) if not df.empty else {}


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — Confidence Score Distributions
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_confidence_distributions(client_name: str = None) -> pd.DataFrame:
    """Confidence score distribution by source for naics_code facts."""
    if _using_cache():
        clauses = ["is_latest=1", "fact_name='naics_code'", "winning_confidence IS NOT NULL"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                COALESCE(winning_platform_name, 'Unknown') AS source_name,
                winning_platform_id                        AS platform_id,
                COUNT(*)                                   AS fact_count,
                AVG(winning_confidence)                    AS avg_confidence,
                MIN(winning_confidence)                    AS min_confidence,
                MAX(winning_confidence)                    AS max_confidence,
                SUM(CASE WHEN winning_confidence < 0.1  THEN 1 ELSE 0 END) AS tier_0_0_1,
                SUM(CASE WHEN winning_confidence >= 0.1 AND winning_confidence < 0.3 THEN 1 ELSE 0 END) AS tier_0_1_0_3,
                SUM(CASE WHEN winning_confidence >= 0.3 AND winning_confidence < 0.5 THEN 1 ELSE 0 END) AS tier_0_3_0_5,
                SUM(CASE WHEN winning_confidence >= 0.5 AND winning_confidence < 0.8 THEN 1 ELSE 0 END) AS tier_0_5_0_8,
                SUM(CASE WHEN winning_confidence >= 0.8 AND winning_confidence < 1.0 THEN 1 ELSE 0 END) AS tier_0_8_1_0,
                SUM(CASE WHEN winning_confidence = 1.0  THEN 1 ELSE 0 END) AS tier_exactly_1
            FROM facts {w}
            GROUP BY winning_platform_name, winning_platform_id
            ORDER BY fact_count DESC
        """, p)

    return _rq("""
        SELECT
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','name'),'Unknown') AS source_name,
            COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId'),'?') AS platform_id,
            COUNT(*) AS fact_count,
            AVG(CAST(COALESCE(JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence'),'0') AS FLOAT)) AS avg_confidence
        FROM rds_warehouse_public.facts f
        WHERE f.name='naics_code' AND LENGTH(f.value)<60000
          AND JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') IS NOT NULL
        GROUP BY 1,2 ORDER BY 3 DESC
    """)


@st.cache_data(ttl=600, show_spinner=False)
def load_mcc_confidence(client_name: str = None) -> pd.DataFrame:
    """Confidence distribution for mcc_code_found (AI MCC path)."""
    if _using_cache():
        clauses = ["is_latest=1", "fact_name='mcc_code_found'", "winning_confidence IS NOT NULL"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                ROUND(winning_confidence, 2)   AS confidence_bucket,
                COUNT(*)                       AS business_count,
                AVG(winning_confidence)        AS avg_conf
            FROM facts {w}
            GROUP BY ROUND(winning_confidence, 2)
            ORDER BY confidence_bucket
        """, p)
    return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — Alternative Coverage Analysis
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_alternative_coverage(client_name: str = None) -> pd.DataFrame:
    """How many alternatives each winning source has, and agreement rates."""
    if _using_cache():
        clauses = ["f.is_latest=1", "f.fact_name='naics_code'"]
        p = []
        if client_name:
            clauses.append("f.client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                COALESCE(f.winning_platform_name,'Unknown') AS source_name,
                f.winning_platform_id                       AS platform_id,
                COUNT(DISTINCT f.business_id)               AS businesses,
                AVG(alt_counts.n_alts)                      AS avg_alternatives,
                SUM(CASE WHEN alt_counts.n_alts=0 THEN 1 ELSE 0 END) AS businesses_no_alts,
                SUM(CASE WHEN alt_counts.n_alts>=2 THEN 1 ELSE 0 END) AS businesses_2plus_alts
            FROM facts f
            LEFT JOIN (
                SELECT business_id, COUNT(*) AS n_alts
                FROM alternatives
                WHERE is_latest=1 AND fact_name='naics_code'
                GROUP BY business_id
            ) alt_counts ON alt_counts.business_id=f.business_id
            {w}
            GROUP BY f.winning_platform_name, f.winning_platform_id
            ORDER BY businesses DESC
        """, p)
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_vendor_agreement_matrix(client_name: str = None) -> pd.DataFrame:
    """When multiple vendor alternatives exist, do they agree with winner or each other?"""
    if _using_cache():
        clauses = ["f.is_latest=1", "f.fact_name='naics_code'"]
        p = []
        if client_name:
            clauses.append("f.client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                f.winning_platform_name         AS winner_source,
                a.alt_platform_name             AS alt_source,
                COUNT(DISTINCT f.business_id)   AS co_occurrences,
                SUM(CASE WHEN f.winning_value = a.alt_value THEN 1 ELSE 0 END) AS agreed,
                SUM(CASE WHEN f.winning_value != a.alt_value
                         AND a.alt_value IS NOT NULL THEN 1 ELSE 0 END) AS disagreed,
                ROUND(100.0 * SUM(CASE WHEN f.winning_value=a.alt_value THEN 1 ELSE 0 END)
                    / COUNT(DISTINCT f.business_id), 1) AS agreement_pct
            FROM facts f
            JOIN alternatives a
                ON a.business_id=f.business_id
                AND a.fact_name='naics_code'
                AND a.is_latest=1
                AND a.alt_platform_id IN ('17','22','24','31')
            {w}
            GROUP BY f.winning_platform_name, a.alt_platform_name
            ORDER BY co_occurrences DESC
        """, p)
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_suppressed_correct_answer(client_name: str = None) -> pd.DataFrame:
    """Cases where winner is P0/null but vendor alternatives have specific codes.
    These are the definitive cases of correct data being suppressed."""
    if _using_cache():
        clauses = ["f.is_latest=1", "f.fact_name='naics_code'",
                   "f.winning_platform_id='0'",
                   "(f.winning_value IS NULL OR f.winning_value='')"]
        p = []
        if client_name:
            clauses.append("f.client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                f.business_id,
                f.client_name,
                b.business_name,
                f.winning_value                 AS p0_value,
                f.winning_confidence            AS p0_confidence,
                GROUP_CONCAT(a.alt_platform_name || ': ' || a.alt_value, ' | ') AS vendor_alternatives,
                COUNT(DISTINCT a.alt_platform_id) AS vendor_count
            FROM facts f
            LEFT JOIN businesses b ON b.business_id=f.business_id AND b.is_latest=1
            JOIN alternatives a
                ON a.business_id=f.business_id
                AND a.fact_name='naics_code'
                AND a.is_latest=1
                AND a.alt_platform_id IN ('17','22','24')
                AND a.alt_value IS NOT NULL AND a.alt_value != ''
            {w}
            GROUP BY f.business_id, f.client_name, b.business_name,
                     f.winning_value, f.winning_confidence
            ORDER BY vendor_count DESC
            LIMIT 500
        """, p)
    return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — Decision Correctness (Canonical Pair Analysis)
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_canonical_rate_by_source(client_name: str = None) -> pd.DataFrame:
    """For each winning source, what % of their NAICS wins result in canonical NAICS+MCC pairs?"""
    if _using_cache():
        clauses = ["is_latest=1"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                COALESCE(naics_platform_name,'Unknown')  AS source_name,
                naics_platform_id                        AS platform_id,
                COUNT(DISTINCT business_id)              AS total_wins,
                SUM(is_canonical_pair)                   AS canonical_wins,
                ROUND(100.0*SUM(is_canonical_pair)/COUNT(DISTINCT business_id),1) AS canonical_pct,
                SUM(CASE WHEN naics_code='561499' THEN 1 ELSE 0 END) AS catchall_561499,
                SUM(CASE WHEN naics_code IS NULL OR naics_code='' THEN 1 ELSE 0 END) AS null_naics,
                SUM(CASE WHEN mcc_code='7399' THEN 1 ELSE 0 END) AS catchall_7399,
                SUM(CASE WHEN mcc_code='5614' THEN 1 ELSE 0 END) AS invalid_5614
            FROM businesses {w}
            GROUP BY naics_platform_name, naics_platform_id
            ORDER BY total_wins DESC
        """, p)
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_alt_would_be_canonical(client_name: str = None) -> pd.DataFrame:
    """Businesses where winner is non-canonical but an alternative would have been canonical.
    The strongest evidence that the arbitration decision was wrong."""
    if _using_cache():
        try:
            conn = _sqlite_conn()
            # Get canonical pairs from cache or build from Redshift
            canon_rows = conn.execute("""
                SELECT DISTINCT naics_code, mcc_code FROM facts
                WHERE is_latest=1 AND is_canonical_pair=1
            """).fetchall()
            conn.close()
            canonical_set = {(r[0], r[1]) for r in canon_rows}
        except Exception:
            canonical_set = set()

        clauses = ["b.is_latest=1", "b.is_canonical_pair=0",
                   "b.naics_code IS NOT NULL", "b.mcc_code IS NOT NULL"]
        p = []
        if client_name:
            clauses.append("b.client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)

        df = _q(f"""
            SELECT
                b.business_id, b.client_name, b.business_name,
                b.naics_code AS winner_naics, b.mcc_code AS winner_mcc,
                b.naics_platform_name AS winner_source, b.is_canonical_pair,
                a.alt_value AS alt_naics, a.alt_platform_name AS alt_source,
                a.alt_confidence
            FROM businesses b
            JOIN alternatives a
                ON a.business_id=b.business_id
                AND a.fact_name='naics_code'
                AND a.is_latest=1
                AND a.alt_value IS NOT NULL
            {w}
            LIMIT 2000
        """, p)

        if df.empty:
            return pd.DataFrame()

        # Check if alt + current mcc would be canonical
        from db.queries import load_mcc_lookup
        mcc_lkp = load_mcc_lookup()
        from db.cache_manager import get_conn as gc
        try:
            conn = gc()
            canon_df = pd.read_sql_query(
                "SELECT naics_code, mcc_code FROM facts WHERE is_latest=1 AND is_canonical_pair=1 LIMIT 1",
                conn
            )
            conn.close()
        except Exception:
            pass

        return df.head(500)
    return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MCC Decision Audit
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_mcc_path_analysis(client_name: str = None) -> pd.DataFrame:
    """Breakdown of which MCC path won (AI direct vs NAICS lookup vs neither)."""
    if _using_cache():
        clauses = ["is_latest=1"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                CASE
                    WHEN mcc_code_found IS NOT NULL AND mcc_code=mcc_code_found
                        THEN 'AI won (mcc_code_found)'
                    WHEN mcc_code_from_naics IS NOT NULL AND mcc_code=mcc_code_from_naics
                     AND mcc_code_found IS NULL
                        THEN 'Lookup won (mcc_code_from_naics)'
                    WHEN mcc_code_found IS NOT NULL AND mcc_code_from_naics IS NOT NULL
                     AND mcc_code=mcc_code_found
                        THEN 'AI won over Lookup (both ran)'
                    WHEN mcc_code IS NULL
                        THEN 'No MCC at all'
                    ELSE 'Other'
                END AS mcc_path,
                COUNT(DISTINCT business_id) AS businesses,
                SUM(is_canonical_pair)       AS canonical,
                SUM(CASE WHEN mcc_code='7399' THEN 1 ELSE 0 END) AS catchall_7399,
                SUM(CASE WHEN mcc_code='5614' THEN 1 ELSE 0 END) AS invalid_5614,
                ROUND(100.0*SUM(is_canonical_pair)/COUNT(DISTINCT business_id),1) AS canonical_pct
            FROM businesses {w}
            GROUP BY mcc_path
            ORDER BY businesses DESC
        """, p)
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_ai_mcc_accuracy(client_name: str = None) -> pd.DataFrame:
    """AI MCC quality: when AI fires, what does it produce?"""
    if _using_cache():
        clauses = ["is_latest=1", "mcc_code_found IS NOT NULL"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                mcc_code_found                AS ai_mcc_value,
                COUNT(DISTINCT business_id)   AS businesses,
                SUM(is_canonical_pair)        AS canonical,
                ROUND(100.0*SUM(is_canonical_pair)/COUNT(DISTINCT business_id),1) AS canonical_pct,
                CASE
                    WHEN mcc_code_found='5614' THEN '❌ Invalid (AI bug)'
                    WHEN mcc_code_found='7399' THEN '⚠️ Catch-all (7399)'
                    ELSE '✅ Specific'
                END AS quality
            FROM businesses {w}
            GROUP BY mcc_code_found
            ORDER BY businesses DESC
            LIMIT 30
        """, p)
    return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — Source Decision Frequency Over Time
# ═══════════════════════════════════════════════════════════════════════════════

@st.cache_data(ttl=600, show_spinner=False)
def load_source_frequency_over_time(client_name: str = None) -> pd.DataFrame:
    """How many businesses were classified by each source per week (updatedAt)."""
    if _using_cache():
        clauses = ["is_latest=1", "fact_name='naics_code'",
                   "winner_updated_at IS NOT NULL", "winner_updated_at!=''"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                SUBSTR(winner_updated_at, 1, 10)            AS update_date,
                COALESCE(winning_platform_name,'Unknown')    AS source_name,
                winning_platform_id                         AS platform_id,
                COUNT(DISTINCT business_id)                 AS businesses
            FROM facts {w}
            GROUP BY SUBSTR(winner_updated_at,1,10), winning_platform_name, winning_platform_id
            ORDER BY update_date DESC, businesses DESC
        """, p)
    return pd.DataFrame()


@st.cache_data(ttl=600, show_spinner=False)
def load_naics_null_gap_analysis(client_name: str = None) -> pd.DataFrame:
    """Businesses with NO vendor NAICS (only P0 or AI), broken down by what AI produced."""
    if _using_cache():
        clauses = ["is_latest=1",
                   "(naics_platform_id='0' OR naics_platform_id='31' OR naics_code IS NULL)"]
        p = []
        if client_name:
            clauses.append("client_name=?")
            p.append(client_name)
        w = "WHERE " + " AND ".join(clauses)
        return _q(f"""
            SELECT
                client_name,
                naics_platform_name         AS naics_source,
                naics_code                  AS naics_value,
                COUNT(DISTINCT business_id) AS businesses,
                SUM(is_canonical_pair)      AS canonical,
                SUM(CASE WHEN naics_code='561499' THEN 1 ELSE 0 END) AS catchall
            FROM businesses {w}
            GROUP BY client_name, naics_platform_name, naics_code
            ORDER BY client_name, businesses DESC
        """, p)
    return pd.DataFrame()
