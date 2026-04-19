"""Unit tests for the SQL safety validator."""
from __future__ import annotations

import pytest

from data_access.sql_safety import ensure_safe, SQLSafetyError


def test_rejects_ddl():
    with pytest.raises(SQLSafetyError):
        ensure_safe("DROP TABLE rds_warehouse_public.facts")


def test_rejects_dml():
    with pytest.raises(SQLSafetyError):
        ensure_safe("UPDATE rds_warehouse_public.facts SET value='x'")


def test_rejects_multi_statement():
    with pytest.raises(SQLSafetyError):
        ensure_safe("SELECT 1; SELECT 2")


def test_accepts_select_and_injects_limit():
    r = ensure_safe("SELECT 1 AS n FROM rds_warehouse_public.facts", default_limit=100)
    assert "LIMIT 100" in r.sql
    assert r.injected_limit == 100


def test_allows_with_cte():
    r = ensure_safe("WITH a AS (SELECT 1) SELECT * FROM a", default_limit=10)
    assert r.sql.strip().lower().startswith("with")


def test_rejects_forbidden_schema():
    with pytest.raises(SQLSafetyError):
        ensure_safe("SELECT * FROM pg_catalog.pg_tables")
