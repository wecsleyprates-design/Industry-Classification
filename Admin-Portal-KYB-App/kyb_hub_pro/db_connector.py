"""
db_connector.py — Redshift connection and query execution for KYB Hub Pro.
Uses the same credentials as the legacy app with improved error handling and caching.
"""

import os
import json
import pandas as pd
import streamlit as st

# ── Redshift credentials (same as legacy app) ────────────────────────────────
REDSHIFT_CONFIG = {
    "dbname":  os.getenv("REDSHIFT_DB", "dev"),
    "user":    os.getenv("REDSHIFT_USER", "readonly_all_access"),
    "password": os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
    "host":    os.getenv("REDSHIFT_HOST",
                         "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
    "port":    int(os.getenv("REDSHIFT_PORT", "5439")),
}


def get_connection():
    """Create a new Redshift connection. Returns (conn, success, error)."""
    try:
        import psycopg2
        conn = psycopg2.connect(**REDSHIFT_CONFIG, connect_timeout=15)
        return conn, True, None
    except Exception as e:
        return None, False, str(e)


def run_query(sql: str):
    """Execute a SQL query and return (DataFrame, error_string)."""
    conn, ok, err = get_connection()
    if not ok:
        return None, err
    try:
        df = pd.read_sql(sql, conn)
        conn.close()
        return df, None
    except Exception as e:
        try:
            conn.close()
        except:
            pass
        return None, str(e)


def run_query_on_conn(sql: str, conn):
    """Execute a SQL query on an existing connection (avoids reconnect overhead)."""
    try:
        return pd.read_sql(sql, conn), None
    except Exception as e:
        return None, str(e)


def parse_fact_json(value_str):
    """Parse a JSON fact value string into a dict."""
    if not value_str:
        return {}
    try:
        r = json.loads(value_str)
        return r if isinstance(r, dict) else {}
    except:
        return {}


def safe_get(d, *keys, default=""):
    """Safely navigate nested dicts."""
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur if cur is not None else default


# ── Large facts that should be excluded from bulk queries ────────────────────
KNOWN_LARGE_FACTS = {
    "sos_filings", "sos_match", "watchlist", "watchlist_raw", "bankruptcies",
    "judgements", "liens", "people", "addresses",
    "internal_platform_matches_combined"
}


# ── Cached data loaders ─────────────────────────────────────────────────────

@st.cache_data(ttl=600, show_spinner=False)
def load_all_facts(business_id: str):
    """
    Load all facts for a business in 2 queries (bulk strategy).
    Returns (dict_of_facts, error_string).
    """
    import psycopg2
    try:
        conn = psycopg2.connect(**REDSHIFT_CONFIG, connect_timeout=15)
    except Exception as e:
        return None, str(e)

    try:
        # Query 1: Get all fact names + timestamps
        names_df, err = run_query_on_conn(
            f"""SELECT DISTINCT name, MAX(received_at) AS received_at
                FROM rds_warehouse_public.facts
                WHERE business_id='{business_id}'
                GROUP BY name ORDER BY name""", conn)
        if names_df is None:
            conn.close()
            return None, err
        if names_df.empty:
            conn.close()
            return {}, None

        all_names = set(names_df["name"].tolist())
        large_names = all_names & KNOWN_LARGE_FACTS
        latest = {}

        # Stubs for large facts
        for name in large_names:
            row = names_df[names_df["name"] == name]
            ts = str(row["received_at"].iloc[0])[:16] if not row.empty else ""
            latest[name] = {"_too_large": True, "_name": name, "_received_at": ts}

        # Query 2: Fetch all small facts in one round-trip
        excl = ",".join(f"'{n}'" for n in KNOWN_LARGE_FACTS) if KNOWN_LARGE_FACTS else "''"
        bulk_df, bulk_err = run_query_on_conn(f"""
            SELECT name, value, received_at
            FROM (
                SELECT name, value, received_at,
                       ROW_NUMBER() OVER (PARTITION BY name ORDER BY received_at DESC) AS rn
                FROM rds_warehouse_public.facts
                WHERE business_id='{business_id}'
                  AND name NOT IN ({excl})
            ) t WHERE rn = 1
        """, conn)

        if bulk_df is not None and not bulk_df.empty:
            for _, row in bulk_df.iterrows():
                name = row["name"]
                f = parse_fact_json(row["value"])
                f["_name"] = name
                f["_received_at"] = str(row["received_at"])[:16]
                latest[name] = f

        conn.close()
        return latest, None
    except Exception as e:
        try:
            conn.close()
        except:
            pass
        return None, str(e)


@st.cache_data(ttl=600, show_spinner=False)
def load_worth_score(business_id: str):
    """Load the latest Worth Score for a business."""
    return run_query(f"""
        SELECT bs.weighted_score_850 AS score_850,
               bs.weighted_score_100 AS score_100,
               bs.risk_level, bs.score_decision, bs.created_at
        FROM rds_manual_score_public.data_current_scores cs
        JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
        WHERE cs.business_id='{business_id}'
        ORDER BY bs.created_at DESC LIMIT 1
    """)


@st.cache_data(ttl=600, show_spinner=False)
def load_score_factors(business_id: str):
    """Load Worth Score factor breakdown."""
    return run_query(f"""
        SELECT category_id, score_100, weighted_score_850
        FROM rds_manual_score_public.business_score_factors
        WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores
                        WHERE business_id='{business_id}' LIMIT 1)
        ORDER BY ABS(weighted_score_850) DESC LIMIT 20
    """)


@st.cache_data(ttl=600, show_spinner=False)
def load_portfolio_businesses(date_from, date_to):
    """Load recently onboarded businesses with KYB stats."""
    parts = []
    if date_from:
        parts.append(f"DATE(rbcm.created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(rbcm.created_at) <= '{date_to}'")
    dc = (" AND " + " AND ".join(parts)) if parts else ""

    sql = f"""
        WITH onboarded AS (
            SELECT DISTINCT business_id
            FROM rds_cases_public.rel_business_customer_monitoring
            WHERE 1=1{dc}
        )
        SELECT
            f.business_id,
            MAX(CASE WHEN f.name='sos_active'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS sos_active,
            MAX(CASE WHEN f.name='tin_match_boolean'   THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS tin_match,
            MAX(CASE WHEN f.name='idv_passed_boolean'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS idv_passed,
            MAX(CASE WHEN f.name='naics_code'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS naics_code,
            MAX(CASE WHEN f.name='watchlist_hits'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS watchlist_hits,
            MAX(CASE WHEN f.name='num_bankruptcies'    THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_bankruptcies,
            MAX(CASE WHEN f.name='num_judgements'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_judgements,
            MAX(CASE WHEN f.name='num_liens'           THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS num_liens,
            MAX(CASE WHEN f.name='adverse_media_hits'  THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS adverse_media,
            MAX(CASE WHEN f.name='revenue'             THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS revenue,
            MAX(CASE WHEN f.name='formation_date'      THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_date,
            MAX(CASE WHEN f.name='formation_state'     THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS formation_state,
            MAX(CASE WHEN f.name='legal_name'          THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS legal_name,
            MAX(CASE WHEN f.name='website'             THEN JSON_EXTRACT_PATH_TEXT(f.value,'value') END) AS website,
            MAX(f.received_at) AS last_seen,
            MIN(f.received_at) AS first_seen,
            COUNT(DISTINCT f.name) AS fact_count
        FROM rds_warehouse_public.facts f
        JOIN onboarded o ON o.business_id = f.business_id
        WHERE f.name IN (
            'sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
            'watchlist_hits','num_bankruptcies','num_judgements','num_liens',
            'adverse_media_hits','revenue','formation_date','formation_state',
            'legal_name','website'
        )
        GROUP BY f.business_id
    """
    df, err = run_query(sql)
    if df is not None and not df.empty:
        return df, None

    # Fallback: facts-only if rbcm not accessible
    parts2 = []
    if date_from:
        parts2.append(f"received_at >= '{date_from}'")
    if date_to:
        parts2.append(f"received_at <= '{date_to} 23:59:59'")
    dc2 = (" AND " + " AND ".join(parts2)) if parts2 else ""
    return run_query(f"""
        SELECT business_id,
            MAX(CASE WHEN name='sos_active'         THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS sos_active,
            MAX(CASE WHEN name='tin_match_boolean'  THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS tin_match,
            MAX(CASE WHEN name='idv_passed_boolean' THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS idv_passed,
            MAX(CASE WHEN name='naics_code'         THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS naics_code,
            MAX(CASE WHEN name='watchlist_hits'     THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS watchlist_hits,
            MAX(CASE WHEN name='num_bankruptcies'   THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_bankruptcies,
            MAX(CASE WHEN name='num_judgements'     THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_judgements,
            MAX(CASE WHEN name='num_liens'          THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_liens,
            MAX(CASE WHEN name='adverse_media_hits' THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS adverse_media,
            MAX(CASE WHEN name='revenue'            THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS revenue,
            MAX(CASE WHEN name='formation_date'     THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS formation_date,
            MAX(CASE WHEN name='formation_state'    THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS formation_state,
            MAX(CASE WHEN name='legal_name'         THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS legal_name,
            MAX(CASE WHEN name='website'            THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS website,
            MAX(received_at) AS last_seen, MIN(received_at) AS first_seen,
            COUNT(DISTINCT name) AS fact_count
        FROM rds_warehouse_public.facts
        WHERE name IN ('sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
            'watchlist_hits','num_bankruptcies','num_judgements','num_liens',
            'adverse_media_hits','revenue','formation_date','formation_state',
            'legal_name','website'){dc2}
        GROUP BY business_id
    """)


@st.cache_data(ttl=600, show_spinner=False)
def load_onboarding_counts(date_from, date_to):
    """Load daily onboarding counts for the timeline chart."""
    parts = []
    if date_from:
        parts.append(f"DATE(created_at) >= '{date_from}'")
    if date_to:
        parts.append(f"DATE(created_at) <= '{date_to}'")
    dc = (" AND " + " AND ".join(parts)) if parts else ""
    return run_query(f"""
        SELECT DATE(created_at) AS onboard_date,
               COUNT(DISTINCT business_id) AS new_businesses
        FROM rds_cases_public.rel_business_customer_monitoring
        WHERE 1=1{dc}
        GROUP BY DATE(created_at)
        ORDER BY onboard_date
    """)


@st.cache_data(ttl=600, show_spinner=False)
def load_watchlist_review_tasks(business_id: str):
    """Load watchlist review task history."""
    return run_query(f"""
        SELECT bev.business_id, bert.status, bert.sublabel, bert.created_at
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id = bert.business_entity_verification_id
        WHERE bev.business_id='{business_id}' AND bert.key='watchlist'
        ORDER BY bert.created_at DESC LIMIT 10
    """)


# ── Fact value helpers ───────────────────────────────────────────────────────

def get_fact_value(facts: dict, name: str):
    """Get the display value of a fact."""
    f = facts.get(name, {})
    if f.get("_too_large"):
        return "[Large — query RDS directly]"
    v = f.get("value")
    if isinstance(v, (list, dict)):
        return None
    return v


def get_fact_confidence(facts: dict, name: str):
    """Get the confidence score of a fact's winning source."""
    try:
        v = facts.get(name, {}).get("source", {})
        if not isinstance(v, dict):
            return 0.0
        c = v.get("confidence")
        return float(c) if c is not None else 0.0
    except:
        return 0.0


def get_fact_platform_id(facts: dict, name: str):
    """Get the platformId of a fact's winning source."""
    src = facts.get(name, {}).get("source", {})
    if not isinstance(src, dict):
        return ""
    pid = src.get("platformId")
    return "" if pid is None else str(pid)


def get_fact_alternatives(facts: dict, name: str):
    """Get the list of alternative sources for a fact."""
    alts = facts.get(name, {}).get("alternatives", []) or []
    result = []
    for a in alts:
        if not isinstance(a, dict):
            continue
        s = a.get("source")
        if isinstance(s, dict):
            pid = str(s.get("platformId", ""))
            conf = float(s.get("confidence", 0) or 0)
        else:
            pid = str(s) if s is not None else ""
            conf = float(a.get("confidence", 0) or 0)
        result.append({"value": a.get("value"), "pid": pid, "conf": conf})
    return result
