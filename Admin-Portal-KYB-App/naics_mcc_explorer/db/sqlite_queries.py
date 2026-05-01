"""SQLite query functions — mirror of db/queries.py but reading from local cache.

All functions return pandas DataFrames with the same column names as the
Redshift equivalents so pages work without modification when the cache exists.

Usage pattern in pages:
    from db.sqlite_queries import cache_available, get_platform_winners
    if cache_available():
        df = get_platform_winners(fact_name, client_name=client_filter)
    else:
        df = load_platform_winners(...)  # Redshift fallback
"""
from __future__ import annotations

import json
import sqlite3
import pandas as pd
from db.cache_manager import get_conn, cache_exists, get_cache_meta, CACHE_DB_STR


def cache_available() -> bool:
    return cache_exists()


# ── Shared filter builder ──────────────────────────────────────────────────────

def _where(
    client_name: str | None = None,
    business_id: str | None = None,
    fact_name: str | None   = None,
    extra_clauses: list[str] | None = None,
) -> tuple[str, list]:
    """Build WHERE clause + params for SQLite queries."""
    clauses = ["is_latest = 1"]
    params  = []
    if client_name:
        clauses.append("client_name = ?")
        params.append(client_name)
    if business_id:
        clauses.append("business_id = ?")
        params.append(business_id)
    if fact_name:
        clauses.append("fact_name = ?")
        params.append(fact_name)
    if extra_clauses:
        clauses.extend(extra_clauses)
    return "WHERE " + " AND ".join(clauses), params


def _q(sql: str, params: list = None) -> pd.DataFrame:
    """Run a query and return a DataFrame."""
    try:
        conn = get_conn()
        df   = pd.read_sql_query(sql, conn, params=params or [])
        conn.close()
        return df
    except Exception as e:
        return pd.DataFrame()


# ── Platform Winners (Page 1) ──────────────────────────────────────────────────

def get_platform_winners(fact_name: str, client_name: str | None = None,
                         business_id: str | None = None) -> pd.DataFrame:
    """Distribution of winning platforms for a fact. Mirrors load_platform_winners()."""
    w, p = _where(client_name, business_id, fact_name)
    return _q(f"""
        SELECT
            winning_platform_id      AS platform_id,
            winning_platform_name    AS legacy_source_name,
            COUNT(DISTINCT business_id) AS business_count,
            AVG(winning_confidence)  AS avg_confidence,
            SUM(CASE WHEN winning_value IS NULL THEN 1 ELSE 0 END) AS null_value_count
        FROM facts {w}
        GROUP BY winning_platform_id, winning_platform_name
        ORDER BY business_count DESC
    """, p)


def get_platform_winner_values(fact_name: str, client_name: str | None = None,
                               business_id: str | None = None) -> pd.DataFrame:
    """Top winning values for a fact. Mirrors load_platform_winner_values()."""
    w, p = _where(client_name, business_id, fact_name,
                  extra_clauses=["winning_value IS NOT NULL"])
    return _q(f"""
        SELECT
            winning_value      AS fact_value,
            winning_platform_id AS platform_id,
            COUNT(DISTINCT business_id) AS business_count
        FROM facts {w}
        GROUP BY winning_value, winning_platform_id
        ORDER BY business_count DESC
        LIMIT 50
    """, p)


def get_fact_drilldown(fact_name: str, client_name: str | None = None,
                       business_id: str | None = None) -> pd.DataFrame:
    """Per-business winner + all MCC variants + alternatives."""
    w, p = _where(client_name, business_id, fact_name)
    df = _q(f"""
        SELECT
            f.business_id,
            f.customer_id,
            f.client_name,
            f.winning_value,
            f.winning_platform_id,
            f.winning_platform_name  AS winning_platform_name_legacy,
            f.winning_confidence,
            f.winner_updated_at,
            f.rule_applied,
            f.alternatives_json      AS raw_json,
            f.naics_description,
            f.mcc_description,
            f.value_changed,
            f.platform_changed,
            f.prev_winning_value,
            b.mcc_code,
            b.mcc_code_found,
            b.mcc_code_from_naics,
            b.mcc_updated_at,
            b.mcc_found_updated_at,
            b.mcc_from_naics_updated_at
        FROM facts f
        LEFT JOIN (
            SELECT business_id,
                   mcc_code, mcc_code_found, mcc_code_from_naics,
                   mcc_updated_at, mcc_updated_at AS mcc_found_updated_at,
                   mcc_updated_at AS mcc_from_naics_updated_at
            FROM businesses WHERE is_latest=1
        ) b ON b.business_id = f.business_id
        {w}
        ORDER BY f.winner_updated_at DESC
    """, p)
    return df


# ── Validity pages (Pages 3 & 4) ───────────────────────────────────────────────

def get_naics_facts(client_name: str | None = None,
                    business_id: str | None = None) -> pd.DataFrame:
    """Full NAICS validity dataset. Mirrors load_naics_facts()."""
    w, p = _where(client_name, business_id, "naics_code")
    df = _q(f"""
        SELECT
            business_id,
            customer_id,
            client_name,
            (SELECT b2.business_name FROM businesses b2 WHERE b2.business_id=f.business_id AND b2.is_latest=1 LIMIT 1) AS business_name,
            winning_value        AS naics_value,
            winning_platform_id  AS platform_id,
            winning_platform_name AS legacy_source_name,
            winning_confidence   AS confidence,
            winner_updated_at,
            naics_validity,
            naics_description,
            industry_sector_code AS winning_sector,
            value_changed,
            platform_changed,
            prev_winning_value,
            alternatives_json    AS raw_json
        FROM facts {w}
        ORDER BY client_name, business_id
    """, p)
    return df


def get_mcc_facts(client_name: str | None = None,
                  business_id: str | None = None) -> pd.DataFrame:
    """All MCC fact variants. Mirrors load_mcc_facts()."""
    w, p = _where(client_name, business_id)
    # Need all three MCC fact names
    clauses = ["is_latest=1",
               "fact_name IN ('mcc_code','mcc_code_found','mcc_code_from_naics')"]
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    if business_id:
        clauses.append("business_id = ?")
        p.append(business_id)
    where_str = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            business_id,
            customer_id,
            client_name,
            fact_name,
            (SELECT b2.business_name FROM businesses b2 WHERE b2.business_id=f.business_id AND b2.is_latest=1 LIMIT 1) AS business_name,
            winning_value        AS mcc_value,
            winning_platform_id  AS platform_id,
            winning_platform_name AS legacy_source_name,
            winning_confidence   AS confidence,
            winner_updated_at,
            mcc_validity         AS validity_status,
            mcc_description,
            value_changed,
            prev_winning_value,
            alternatives_json    AS raw_json
        FROM facts {where_str}
        ORDER BY client_name, business_id, fact_name
    """, p)


# ── Cascade Analysis (Page 5) ──────────────────────────────────────────────────

def get_cascade_summary(client_name: str | None = None,
                        business_id: str | None = None) -> pd.DataFrame:
    """Per-business NAICS+MCC status. Mirrors load_cascade_summary()."""
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    if business_id:
        clauses.append("business_id = ?")
        p.append(business_id)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            business_id,
            customer_id,
            client_name,
            business_name,
            naics_code           AS naics_value,
            naics_platform_id    AS naics_platform,
            naics_platform_name  AS naics_platform_name,
            naics_updated_at,
            NULL                 AS naics_raw_json,
            mcc_code             AS mcc_value,
            mcc_updated_at,
            mcc_code_found       AS mcc_found_value,
            mcc_updated_at       AS mcc_found_updated_at,
            mcc_code_from_naics  AS mcc_from_naics_value,
            mcc_updated_at       AS mcc_from_naics_updated_at,
            mcc_platform_id,
            mcc_platform_name,
            is_canonical_pair,
            naics_validity,
            mcc_validity,
            signals,
            naics_changed,
            mcc_changed,
            prev_naics_code,
            prev_mcc_code
        FROM businesses {w}
    """, p)


# ── Platform Winner Distribution (Page 1 & Page 8) ────────────────────────────

def get_client_platform_distribution(client_name: str | None = None) -> pd.DataFrame:
    """Per paying-client winner platform distribution. Mirrors load_client_platform_distribution()."""
    clauses = ["is_latest=1", "fact_name='naics_code'"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            client_name               AS client,
            winning_platform_id,
            winning_platform_name     AS platform_name,
            COUNT(DISTINCT business_id) AS businesses,
            AVG(winning_confidence)   AS avg_confidence,
            SUM(CASE WHEN winning_value IS NULL THEN 1 ELSE 0 END) AS null_wins
        FROM facts {w}
        GROUP BY client_name, winning_platform_id, winning_platform_name
        ORDER BY client_name, businesses DESC
    """, p)


# ── Misidentification (Page 9) ────────────────────────────────────────────────

def get_misidentification_signals(client_name: str | None = None,
                                  business_id: str | None = None) -> pd.DataFrame:
    """Full per-business misidentification dataset. Mirrors load_misidentification_signals()."""
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    if business_id:
        clauses.append("business_id = ?")
        p.append(business_id)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            client_name              AS client,
            business_id,
            business_name,
            naics_code               AS winning_naics,
            naics_description,
            naics_platform_id        AS winning_platform_id,
            naics_platform_name      AS platform_name,
            naics_confidence         AS winning_confidence,
            naics_sector_code        AS winning_sector,
            naics_validity           AS winner_quality,
            mcc_code,
            mcc_code_from_naics,
            mcc_code_found,
            mcc_description,
            is_canonical_pair,
            signals,
            naics_changed,
            mcc_changed,
            naics_updated_at         AS winner_updated_at,
            NULL                     AS raw_json   -- alternatives in separate table
        FROM businesses {w}
        ORDER BY client_name, naics_changed DESC, naics_code
    """, p)


def get_alternatives_for_businesses(business_ids: list[str],
                                    fact_name: str = "naics_code") -> pd.DataFrame:
    """Get alternatives for a list of business IDs from the alternatives table."""
    if not business_ids:
        return pd.DataFrame()
    placeholders = ",".join("?" * len(business_ids))
    return _q(f"""
        SELECT
            business_id,
            fact_name,
            alt_rank,
            alt_platform_id,
            alt_platform_name,
            alt_value,
            alt_confidence,
            alt_updated_at
        FROM alternatives
        WHERE is_latest=1
          AND fact_name=?
          AND business_id IN ({placeholders})
        ORDER BY business_id, alt_rank
    """, [fact_name] + list(business_ids))


# ── Change tracking (new — only possible with SQLite) ─────────────────────────

def get_changed_businesses(client_name: str | None = None,
                           field: str = "naics") -> pd.DataFrame:
    """Businesses where NAICS or MCC changed since the previous snapshot."""
    changed_col = f"{field}_changed"
    prev_col    = f"prev_{field}_code"
    curr_col    = f"{field}_code"
    clauses = ["is_latest=1", f"{changed_col}=1"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            client_name,
            business_id,
            {curr_col}           AS new_value,
            {prev_col}           AS old_value,
            naics_platform_id    AS platform_id,
            naics_updated_at     AS updated_at,
            signals
        FROM businesses {w}
        ORDER BY client_name, naics_updated_at DESC
    """, p)


def get_snapshot_comparison(fact_name: str = "naics_code",
                            client_name: str | None = None) -> pd.DataFrame:
    """Compare the two most recent snapshots for a fact — shows what changed."""
    dates = []
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT DISTINCT snapshot_date FROM facts ORDER BY snapshot_date DESC LIMIT 2"
        ).fetchall()
        dates = [r[0] for r in rows]
        conn.close()
    except Exception:
        return pd.DataFrame()

    if len(dates) < 2:
        return pd.DataFrame()

    latest, previous = dates[0], dates[1]
    clauses_base = [f"fact_name='{fact_name}'"]
    p1, p2 = [], []
    if client_name:
        clauses_base.append("client_name = ?")
        p1.append(client_name)
        p2.append(client_name)

    w_latest   = "WHERE snapshot_date=? AND " + " AND ".join(clauses_base)
    w_previous = "WHERE snapshot_date=? AND " + " AND ".join(clauses_base)

    return _q(f"""
        SELECT
            a.business_id,
            a.client_name,
            a.winning_value      AS current_value,
            b.winning_value      AS previous_value,
            a.winning_platform_id AS current_platform,
            b.winning_platform_id AS previous_platform,
            a.winner_updated_at  AS current_updated_at,
            CASE WHEN a.winning_value != b.winning_value THEN 1 ELSE 0 END AS value_changed,
            CASE WHEN a.winning_platform_id != b.winning_platform_id THEN 1 ELSE 0 END AS platform_changed
        FROM facts a
        LEFT JOIN facts b ON b.business_id=a.business_id AND b.fact_name=a.fact_name
          AND b.snapshot_date='{previous}'
        {w_latest.replace('?', f"'{latest}'")}
        HAVING value_changed=1 OR platform_changed=1
        ORDER BY a.client_name, value_changed DESC
    """, p1)


# ── Overview / Home ────────────────────────────────────────────────────────────

def get_overview(client_name: str | None = None) -> pd.DataFrame:
    """Overview KPIs. Mirrors load_overview()."""
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            COUNT(DISTINCT business_id)                                      AS total_businesses,
            COUNT(DISTINCT customer_id)                                      AS total_customers,
            SUM(CASE WHEN naics_code IS NOT NULL THEN 1 ELSE 0 END)         AS with_naics,
            SUM(CASE WHEN mcc_code IS NOT NULL THEN 1 ELSE 0 END)           AS with_mcc,
            SUM(CASE WHEN naics_platform_id='0' THEN 1 ELSE 0 END)          AS naics_p0_wins,
            SUM(CASE WHEN naics_code='561499' THEN 1 ELSE 0 END)            AS naics_catchall,
            SUM(CASE WHEN naics_changed=1 THEN 1 ELSE 0 END)                AS naics_changed,
            SUM(CASE WHEN mcc_changed=1 THEN 1 ELSE 0 END)                  AS mcc_changed
        FROM businesses {w}
    """, p)


def get_client_list(client_name: str | None = None) -> pd.DataFrame:
    """List of clients with business counts from cache."""
    clauses = ["is_latest=1"]
    p = []
    if client_name:
        clauses.append("client_name = ?")
        p.append(client_name)
    w = "WHERE " + " AND ".join(clauses)
    return _q(f"""
        SELECT
            client_name        AS client,
            client_name        AS customer_name,
            customer_id,
            COUNT(DISTINCT business_id) AS business_count
        FROM businesses {w}
        GROUP BY client_name, customer_id
        ORDER BY business_count DESC
    """, p)


def get_business_drilldown(business_id: str) -> dict[str, pd.DataFrame]:
    """Full fact picture for a single business from cache.
    Returns dict keyed by fact_name with fact details + alternatives.
    """
    facts_df = _q("""
        SELECT * FROM facts WHERE is_latest=1 AND business_id=?
    """, [business_id])
    alts_df = _q("""
        SELECT * FROM alternatives WHERE is_latest=1 AND business_id=?
        ORDER BY fact_name, alt_rank
    """, [business_id])
    biz_df = _q("""
        SELECT * FROM businesses WHERE is_latest=1 AND business_id=?
    """, [business_id])
    return {"facts": facts_df, "alternatives": alts_df, "business": biz_df}
