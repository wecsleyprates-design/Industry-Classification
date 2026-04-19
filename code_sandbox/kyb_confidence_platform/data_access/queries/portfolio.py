"""
Portfolio-level query templates.

Each function returns a parameterized SQL string. Execution happens in
`data_access.redshift.query()`. In demo mode, fixtures kick in.
"""
from __future__ import annotations

from datetime import date


def summary_sql(start: date, end: date, date_col: str = "received_at") -> str:
    return f"""
        SELECT
          COUNT(DISTINCT business_id)                                 AS total_cases,
          COUNT(DISTINCT JSON_EXTRACT_PATH_TEXT(value,'customer_id')) AS distinct_customers,
          COUNT(DISTINCT business_id)                                 AS distinct_businesses,
          AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT))    AS avg_confidence
        FROM rds_warehouse_public.facts
        WHERE name = 'confidence_score'
          AND {date_col} BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        LIMIT 1
    """.strip()


def bands_sql(start: date, end: date) -> str:
    return f"""
        WITH scored AS (
          SELECT business_id,
                 CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT) AS s
          FROM rds_warehouse_public.facts
          WHERE name='confidence_score'
            AND received_at BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low'
               WHEN s < 0.4 THEN 'Low'
               WHEN s < 0.6 THEN 'Medium'
               WHEN s < 0.8 THEN 'High'
               ELSE 'Very High' END AS band,
          COUNT(*) AS count
        FROM scored
        GROUP BY 1
        ORDER BY 1
    """.strip()


def trend_sql(start: date, end: date) -> str:
    return f"""
        SELECT DATE_TRUNC('week', received_at)                          AS week,
               AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) AS average
        FROM rds_warehouse_public.facts
        WHERE name='confidence_score'
          AND received_at BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        GROUP BY 1
        ORDER BY 1
    """.strip()
