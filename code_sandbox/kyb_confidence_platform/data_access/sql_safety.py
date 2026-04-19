"""
SQL safety validator.

Policy:
  * Exactly ONE statement.
  * Must be a SELECT (or a WITH whose top-level is a SELECT).
  * No DDL, DML, COPY, UNLOAD, GRANT, REVOKE, CALL, ALTER SESSION, VACUUM.
  * Auto-inject LIMIT if missing and not present in top-level SELECT.
  * Reject if any identifier references forbidden schemas.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

try:
    import sqlglot
    from sqlglot import expressions as exp
    _HAS_SQLGLOT = True
except ImportError:  # pragma: no cover
    _HAS_SQLGLOT = False


FORBIDDEN_TOKENS = {
    "INSERT", "UPDATE", "DELETE", "MERGE",
    "TRUNCATE", "DROP", "ALTER", "CREATE",
    "COPY", "UNLOAD", "GRANT", "REVOKE",
    "VACUUM", "ANALYZE", "CALL", "EXECUTE",
    "COMMIT", "ROLLBACK", "SET",   # SET may leak settings
}

FORBIDDEN_SCHEMAS = {"pg_catalog", "information_schema"}  # expose via discovery APIs instead


@dataclass
class SafeSQL:
    sql: str
    had_limit: bool
    injected_limit: int | None
    warnings: list[str]


class SQLSafetyError(ValueError):
    """Raised when a SQL string fails safety validation."""


_LIMIT_PATTERN = re.compile(r"\blimit\s+\d+\b", re.IGNORECASE)


def ensure_safe(sql: str, *, default_limit: int = 5000) -> SafeSQL:
    """Validate SQL and return a hardened version."""
    original = sql.strip().rstrip(";")
    if not original:
        raise SQLSafetyError("Empty SQL string")

    warnings: list[str] = []
    uppered = original.upper()

    # Multi-statement via naive scan (sqlglot.parse gives a real count below)
    if ";" in original:
        raise SQLSafetyError("Only a single statement is allowed")

    for tok in FORBIDDEN_TOKENS:
        # Use word boundary so `CREATED_AT` is not mistaken for `CREATE`
        if re.search(rf"\b{tok}\b", uppered):
            raise SQLSafetyError(f"Forbidden SQL token: {tok}")

    if _HAS_SQLGLOT:
        parsed = sqlglot.parse(original, read="redshift")
        if len(parsed) != 1:
            raise SQLSafetyError("Only a single SELECT statement is allowed")
        root = parsed[0]
        if root is None:
            raise SQLSafetyError("Could not parse SQL")
        if not isinstance(root, (exp.Select, exp.Union, exp.Subquery)) and not _is_cte_select(root):
            raise SQLSafetyError("Only SELECT (or WITH ... SELECT) statements are allowed")
        for table in root.find_all(exp.Table):
            schema = (table.db or "").lower()
            if schema and schema in FORBIDDEN_SCHEMAS:
                raise SQLSafetyError(f"Schema '{schema}' is not allowed")
    else:
        warnings.append("sqlglot not installed — only regex-level validation applied.")
        if not uppered.lstrip().startswith(("SELECT", "WITH")):
            raise SQLSafetyError("Only SELECT (or WITH ... SELECT) statements are allowed")

    # Enforce a LIMIT
    had_limit = bool(_LIMIT_PATTERN.search(original))
    injected: int | None = None
    if not had_limit:
        original = f"{original}\nLIMIT {int(default_limit)}"
        injected = default_limit
        warnings.append(f"LIMIT not present — auto-injected LIMIT {default_limit}.")

    return SafeSQL(sql=original, had_limit=had_limit, injected_limit=injected, warnings=warnings)


def _is_cte_select(root) -> bool:  # pragma: no cover
    try:
        return isinstance(root, exp.Select) and root.args.get("with") is not None
    except Exception:
        return False
