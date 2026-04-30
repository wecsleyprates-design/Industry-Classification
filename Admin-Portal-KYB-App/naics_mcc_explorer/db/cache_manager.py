"""SQLite cache manager for the NAICS/MCC Explorer.

Creates and manages facts_cache.sqlite — the local database populated by the
weekly refresh script and read by all app pages.

Schema design decisions:
  - Every table has `snapshot_date` so we preserve full history across weekly runs
  - `is_latest = 1` flags the most recent snapshot for each (business_id, fact_name)
  - Change detection compares current vs previous snapshot values
  - alternatives are stored both as JSON (fast access) and as individual rows (queryable)
"""
from __future__ import annotations

import sqlite3
import os
from datetime import datetime
from pathlib import Path

# ── File location ──────────────────────────────────────────────────────────────
# Option A: SQLite file lives next to the app in the naics_mcc_explorer folder
_THIS_DIR   = Path(__file__).parent.parent  # naics_mcc_explorer/
CACHE_DB    = _THIS_DIR / "facts_cache.sqlite"
CACHE_DB_STR = str(CACHE_DB)


def get_conn(path: str = CACHE_DB_STR) -> sqlite3.Connection:
    """Open SQLite connection with WAL mode for concurrent read safety."""
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA cache_size=-64000")  # 64MB page cache
    return conn


def cache_exists() -> bool:
    """Returns True if the SQLite cache file exists and has at least one snapshot."""
    if not CACHE_DB.exists():
        return False
    try:
        conn = get_conn()
        row = conn.execute("SELECT COUNT(*) FROM cache_meta").fetchone()
        conn.close()
        return row[0] > 0
    except Exception:
        return False


def get_cache_meta() -> dict:
    """Returns metadata about the most recent snapshot."""
    if not cache_exists():
        return {}
    try:
        conn = get_conn()
        row = conn.execute(
            "SELECT * FROM cache_meta ORDER BY snapshot_date DESC LIMIT 1"
        ).fetchone()
        conn.close()
        return dict(row) if row else {}
    except Exception:
        return {}


def get_snapshot_dates() -> list[str]:
    """Returns all snapshot dates, most recent first."""
    if not cache_exists():
        return []
    try:
        conn = get_conn()
        rows = conn.execute(
            "SELECT snapshot_date FROM cache_meta ORDER BY snapshot_date DESC"
        ).fetchall()
        conn.close()
        return [r[0] for r in rows]
    except Exception:
        return []


# ── Schema creation ────────────────────────────────────────────────────────────

CREATE_CACHE_META = """
CREATE TABLE IF NOT EXISTS cache_meta (
    snapshot_date        TEXT PRIMARY KEY,
    total_businesses     INTEGER,
    total_facts          INTEGER,
    total_alternatives   INTEGER,
    date_from_filter     TEXT,
    date_to_filter       TEXT,
    client_filter        TEXT,
    refresh_duration_sec REAL,
    api_endpoint         TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
);
"""

CREATE_FACTS = """
CREATE TABLE IF NOT EXISTS facts (
    -- Identity
    business_id             TEXT NOT NULL,
    customer_id             TEXT,
    client_name             TEXT,
    fact_name               TEXT NOT NULL,
    snapshot_date           TEXT NOT NULL,
    is_latest               INTEGER DEFAULT 0,

    -- Winning value
    winning_value           TEXT,
    winning_platform_id     TEXT,
    winning_platform_name   TEXT,
    winning_confidence      REAL,
    winner_updated_at       TEXT,
    rule_applied            TEXT,

    -- Enrichment (from core_naics_code / core_mcc_code / rel_naics_mcc)
    naics_description       TEXT,
    mcc_description         TEXT,
    industry_sector_code    TEXT,
    industry_sector_name    TEXT,
    naics_validity          TEXT,   -- valid | catch_all | not_in_lookup | invalid_format | null
    mcc_validity            TEXT,   -- valid | catch_all | known_invalid | not_in_lookup | null
    is_canonical_pair       INTEGER DEFAULT 0,  -- 1 = NAICS+MCC in rel_naics_mcc

    -- Change detection (vs previous snapshot)
    prev_winning_value      TEXT,
    prev_winning_platform_id TEXT,
    value_changed           INTEGER DEFAULT 0,  -- 1 = value differs from previous snapshot
    platform_changed        INTEGER DEFAULT 0,  -- 1 = platform differs from previous snapshot

    -- Full alternatives array as JSON (for fast Python-side parsing)
    alternatives_json       TEXT,

    -- Housekeeping
    fetched_at              TEXT,

    PRIMARY KEY (business_id, fact_name, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_facts_latest     ON facts(is_latest, fact_name);
CREATE INDEX IF NOT EXISTS idx_facts_client     ON facts(client_name, fact_name, is_latest);
CREATE INDEX IF NOT EXISTS idx_facts_platform   ON facts(winning_platform_id, fact_name, is_latest);
CREATE INDEX IF NOT EXISTS idx_facts_changed    ON facts(value_changed, fact_name, is_latest);
CREATE INDEX IF NOT EXISTS idx_facts_snapshot   ON facts(snapshot_date);
"""

CREATE_ALTERNATIVES = """
CREATE TABLE IF NOT EXISTS alternatives (
    -- Identity
    business_id         TEXT NOT NULL,
    fact_name           TEXT NOT NULL,
    snapshot_date       TEXT NOT NULL,
    is_latest           INTEGER DEFAULT 0,
    alt_rank            INTEGER NOT NULL,   -- 0-based position in alternatives[]

    -- Alternative source data
    alt_platform_id     TEXT,
    alt_platform_name   TEXT,
    alt_value           TEXT,
    alt_confidence      REAL,
    alt_updated_at      TEXT,

    PRIMARY KEY (business_id, fact_name, snapshot_date, alt_rank)
);
CREATE INDEX IF NOT EXISTS idx_alt_latest   ON alternatives(is_latest, fact_name);
CREATE INDEX IF NOT EXISTS idx_alt_platform ON alternatives(alt_platform_id, fact_name, is_latest);
CREATE INDEX IF NOT EXISTS idx_alt_value    ON alternatives(alt_value, fact_name, is_latest);
"""

CREATE_BUSINESSES = """
CREATE TABLE IF NOT EXISTS businesses (
    -- Identity
    business_id                 TEXT NOT NULL,
    customer_id                 TEXT,
    client_name                 TEXT,
    snapshot_date               TEXT NOT NULL,
    is_latest                   INTEGER DEFAULT 0,

    -- NAICS
    naics_code                  TEXT,
    naics_description           TEXT,
    naics_platform_id           TEXT,
    naics_platform_name         TEXT,
    naics_confidence            REAL,
    naics_updated_at            TEXT,
    naics_validity              TEXT,
    naics_sector_code           TEXT,
    naics_sector_name           TEXT,

    -- MCC
    mcc_code                    TEXT,
    mcc_description             TEXT,
    mcc_code_found              TEXT,   -- AI-assigned
    mcc_code_from_naics         TEXT,   -- NAICS-derived
    mcc_platform_id             TEXT,
    mcc_platform_name           TEXT,
    mcc_confidence              REAL,
    mcc_updated_at              TEXT,
    mcc_validity                TEXT,

    -- Classification quality
    is_canonical_pair           INTEGER DEFAULT 0,
    signals                     TEXT,   -- pipe-separated: S1:null_winner|S3:catchall_winner

    -- Change detection
    naics_changed               INTEGER DEFAULT 0,
    mcc_changed                 INTEGER DEFAULT 0,
    naics_platform_changed      INTEGER DEFAULT 0,
    prev_naics_code             TEXT,
    prev_mcc_code               TEXT,
    prev_naics_platform_id      TEXT,

    -- Housekeeping
    fetched_at                  TEXT,

    PRIMARY KEY (business_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_biz_latest   ON businesses(is_latest);
CREATE INDEX IF NOT EXISTS idx_biz_client   ON businesses(client_name, is_latest);
CREATE INDEX IF NOT EXISTS idx_biz_changed  ON businesses(naics_changed, is_latest);
CREATE INDEX IF NOT EXISTS idx_biz_platform ON businesses(naics_platform_id, is_latest);
CREATE INDEX IF NOT EXISTS idx_biz_validity ON businesses(naics_validity, is_latest);
CREATE INDEX IF NOT EXISTS idx_biz_snapshot ON businesses(snapshot_date);
"""


def initialize_db(path: str = CACHE_DB_STR) -> None:
    """Create all tables and indexes if they don't exist."""
    conn = get_conn(path)
    conn.executescript(CREATE_CACHE_META)
    conn.executescript(CREATE_FACTS)
    conn.executescript(CREATE_ALTERNATIVES)
    conn.executescript(CREATE_BUSINESSES)
    conn.commit()
    conn.close()


def mark_previous_snapshots(conn: sqlite3.Connection, snapshot_date: str) -> None:
    """Set is_latest=0 for all rows from previous snapshots before inserting new ones."""
    conn.execute("UPDATE facts        SET is_latest=0 WHERE snapshot_date != ?", (snapshot_date,))
    conn.execute("UPDATE alternatives SET is_latest=0 WHERE snapshot_date != ?", (snapshot_date,))
    conn.execute("UPDATE businesses   SET is_latest=0 WHERE snapshot_date != ?", (snapshot_date,))


def set_latest_snapshot(conn: sqlite3.Connection, snapshot_date: str) -> None:
    """Set is_latest=1 for all rows from the newest snapshot."""
    conn.execute("UPDATE facts        SET is_latest=1 WHERE snapshot_date=?", (snapshot_date,))
    conn.execute("UPDATE alternatives SET is_latest=1 WHERE snapshot_date=?", (snapshot_date,))
    conn.execute("UPDATE businesses   SET is_latest=1 WHERE snapshot_date=?", (snapshot_date,))


def prune_old_snapshots(conn: sqlite3.Connection, keep: int = 8) -> None:
    """Keep only the N most recent snapshots to control database size.
    8 snapshots ≈ 2 months of weekly refreshes.
    """
    old = conn.execute(
        "SELECT snapshot_date FROM cache_meta ORDER BY snapshot_date DESC LIMIT -1 OFFSET ?",
        (keep,)
    ).fetchall()
    for row in old:
        sd = row[0]
        conn.execute("DELETE FROM facts        WHERE snapshot_date=?", (sd,))
        conn.execute("DELETE FROM alternatives WHERE snapshot_date=?", (sd,))
        conn.execute("DELETE FROM businesses   WHERE snapshot_date=?", (sd,))
        conn.execute("DELETE FROM cache_meta   WHERE snapshot_date=?", (sd,))
    if old:
        conn.commit()


def get_previous_fact_values(conn: sqlite3.Connection, snapshot_date: str) -> dict[str, dict]:
    """Get the winning value and platform from the snapshot immediately before this one.
    Returns dict keyed by (business_id, fact_name) → {value, platform_id}.
    """
    prev_rows = conn.execute(
        """
        SELECT business_id, fact_name, winning_value, winning_platform_id
        FROM facts
        WHERE snapshot_date = (
            SELECT MAX(snapshot_date) FROM cache_meta
            WHERE snapshot_date < ?
        )
        """,
        (snapshot_date,)
    ).fetchall()
    return {
        (r["business_id"], r["fact_name"]): {
            "value":       r["winning_value"],
            "platform_id": r["winning_platform_id"],
        }
        for r in prev_rows
    }


def get_previous_business_values(conn: sqlite3.Connection, snapshot_date: str) -> dict[str, dict]:
    """Get NAICS/MCC from the snapshot before this one for change detection."""
    prev_rows = conn.execute(
        """
        SELECT business_id, naics_code, mcc_code, naics_platform_id
        FROM businesses
        WHERE snapshot_date = (
            SELECT MAX(snapshot_date) FROM cache_meta
            WHERE snapshot_date < ?
        )
        """,
        (snapshot_date,)
    ).fetchall()
    return {
        r["business_id"]: {
            "naics_code":        r["naics_code"],
            "mcc_code":          r["mcc_code"],
            "naics_platform_id": r["naics_platform_id"],
        }
        for r in prev_rows
    }
