"""
Wire the SQL and Python runners used by the Data Explorer tab.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pandas as pd

from config.settings import SETTINGS
from core.logger import get_logger
from data_access.pii import mask_dataframe
from data_access.python_sandbox import run as py_run
from data_access.redshift import query as rs_query
from data_access.sql_safety import ensure_safe, SQLSafetyError

log = get_logger(__name__)


@dataclass
class SqlExec:
    sql: str
    notes: list[str]
    dataframe: pd.DataFrame | None
    error: str | None


@dataclass
class PyExec:
    stdout: str
    value: Any
    error: str | None
    truncated: bool


def execute_sql(raw: str, *, default_limit: int | None = None) -> SqlExec:
    try:
        safe = ensure_safe(raw, default_limit=default_limit or SETTINGS.default_query_limit)
    except SQLSafetyError as exc:
        return SqlExec(sql=raw, notes=[], dataframe=None, error=f"SQL rejected: {exc}")

    try:
        df = rs_query(safe.sql)
    except Exception as exc:
        return SqlExec(sql=safe.sql, notes=list(safe.warnings), dataframe=None, error=str(exc))

    df = mask_dataframe(df)
    return SqlExec(sql=safe.sql, notes=list(safe.warnings), dataframe=df, error=None)


def execute_python(code: str, *, timeout_s: int = 15) -> PyExec:
    r = py_run(code, timeout_s=timeout_s)
    return PyExec(stdout=r.stdout, value=r.value, error=r.error, truncated=r.truncated)
