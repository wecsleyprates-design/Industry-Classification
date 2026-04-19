"""Decision-outcome and TAT queries."""
from __future__ import annotations

from datetime import date


def decision_by_band_sql(start: date, end: date) -> str:
    return f"""
        WITH s AS (
          SELECT business_id,
                 CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT) AS s
          FROM rds_warehouse_public.facts
          WHERE name='confidence_score'
            AND received_at BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        ),
        d AS (
          SELECT business_id, decision
          FROM rds_cases_public.cases
          WHERE decision_at BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low'
               WHEN s < 0.4 THEN 'Low'
               WHEN s < 0.6 THEN 'Medium'
               WHEN s < 0.8 THEN 'High'
               ELSE 'Very High' END AS band,
          d.decision, COUNT(*) AS n
        FROM s JOIN d USING(business_id)
        GROUP BY 1, 2
    """.strip()


def tat_by_band_sql(start: date, end: date) -> str:
    return f"""
        WITH s AS (
          SELECT business_id,
                 CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT) AS s,
                 received_at AS scored_at
          FROM rds_warehouse_public.facts
          WHERE name='confidence_score'
            AND received_at BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
        ),
        d AS (
          SELECT business_id, decision_at
          FROM rds_cases_public.cases
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low'
               WHEN s < 0.4 THEN 'Low'
               WHEN s < 0.6 THEN 'Medium'
               WHEN s < 0.8 THEN 'High'
               ELSE 'Very High' END AS band,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM d.decision_at - s.scored_at)/3600) AS p50_hours,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM d.decision_at - s.scored_at)/3600) AS p90_hours
        FROM s JOIN d USING(business_id)
        GROUP BY 1
    """.strip()
