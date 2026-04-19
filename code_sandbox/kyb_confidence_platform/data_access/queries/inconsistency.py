"""Inconsistency / red-flag queries."""
from __future__ import annotations


def shared_tin_sql() -> str:
    return """
        SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS tin,
               COUNT(DISTINCT business_id)           AS n_businesses
        FROM rds_warehouse_public.facts
        WHERE name = 'tin'
        GROUP BY 1
        HAVING COUNT(DISTINCT business_id) > 1
        ORDER BY n_businesses DESC
        LIMIT 100
    """.strip()


def shared_address_sql(threshold: int = 3) -> str:
    return f"""
        SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS address_norm,
               COUNT(DISTINCT business_id)           AS n_businesses
        FROM rds_warehouse_public.facts
        WHERE name = 'address_normalized'
        GROUP BY 1
        HAVING COUNT(DISTINCT business_id) >= {threshold}
        ORDER BY n_businesses DESC
        LIMIT 200
    """.strip()


def temporal_impossible_sql() -> str:
    return """
        SELECT s.business_id, s.received_at AS scored_at, d.decision_at
        FROM rds_warehouse_public.facts s
        JOIN rds_cases_public.cases d
          ON s.business_id = d.business_id
        WHERE s.name = 'confidence_score'
          AND d.decision_at < s.received_at
        LIMIT 500
    """.strip()
