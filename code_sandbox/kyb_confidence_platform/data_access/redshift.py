"""
Redshift connector.

- Uses read-only credentials from `config.settings.SETTINGS`.
- Sets `statement_timeout` to protect the cluster.
- Returns pandas DataFrames.
- `ping()` is used by the top-bar status chip (never raises).

If Redshift is not reachable AND `SETTINGS.demo_mode = True`, a small fixture
fallback is used so the whole app remains demoable.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import pandas as pd

from config.settings import SETTINGS
from core.logger import get_logger

log = get_logger(__name__)


def _connect():
    if not SETTINGS.has_redshift:
        raise RuntimeError("Redshift credentials not configured")
    import psycopg2  # local import so missing driver only fails where needed
    conn = psycopg2.connect(
        host=SETTINGS.redshift_host,
        port=SETTINGS.redshift_port,
        dbname=SETTINGS.redshift_db,
        user=SETTINGS.redshift_user,
        password=SETTINGS.redshift_password,
        connect_timeout=10,
    )
    conn.set_session(readonly=True, autocommit=True)
    with conn.cursor() as cur:
        cur.execute(f"SET statement_timeout = {int(SETTINGS.statement_timeout_ms)}")
    return conn


@contextmanager
def cursor() -> Iterator[Any]:
    conn = _connect()
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        try:
            conn.close()
        except Exception:  # pragma: no cover
            pass


def query(sql: str, params: dict | tuple | None = None) -> pd.DataFrame:
    """Run a SELECT and return a DataFrame. Caller must ensure SQL is safe."""
    try:
        conn = _connect()
    except Exception as exc:
        if SETTINGS.demo_mode:
            from data_access import fixtures
            log.info("Redshift unavailable — using fixtures (demo_mode). %s", exc)
            return fixtures.for_query(sql)
        raise

    try:
        df = pd.read_sql(sql, conn, params=params)
        return df
    finally:
        try:
            conn.close()
        except Exception:  # pragma: no cover
            pass


def ping() -> tuple[bool, str]:
    """Lightweight probe. Returns (ok, message)."""
    if not SETTINGS.has_redshift:
        return (SETTINGS.demo_mode, "demo fixtures" if SETTINGS.demo_mode else "not configured")
    try:
        conn = _connect()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        conn.close()
        return True, "connected"
    except Exception as exc:
        return False, f"err ({type(exc).__name__})"
