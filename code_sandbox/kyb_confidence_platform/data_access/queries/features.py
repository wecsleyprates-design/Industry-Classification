"""Feature-level query templates."""
from __future__ import annotations


def null_rates_sql() -> str:
    return """
        SELECT name,
               COUNT(*) FILTER (WHERE JSON_EXTRACT_PATH_TEXT(value,'value') IS NULL
                               OR JSON_EXTRACT_PATH_TEXT(value,'value') = '')::FLOAT
                 / NULLIF(COUNT(*),0) AS null_rate,
               COUNT(*) AS n
        FROM rds_warehouse_public.facts
        GROUP BY 1
        ORDER BY null_rate DESC
        LIMIT 100
    """.strip()


def psi_weekly_sql(feature: str) -> str:
    return f"""
        SELECT week, psi
        FROM datascience.score_psi_weekly
        WHERE score_name = '{feature}'
        ORDER BY week
        LIMIT 52
    """.strip()
