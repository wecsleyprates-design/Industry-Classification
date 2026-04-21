"""Decision-outcome and TAT queries — no LIMIT, customer-aware."""
from __future__ import annotations

from datetime import date


def decision_by_band_sql(start: date, end: date, customer_clause: str = "") -> str:
    cust_join = ""
    cust_filter = ""
    if customer_clause:
        cust_join = "JOIN rds_auth_public.data_customers c ON c.id = rbcm.customer_id"
        cust_filter = customer_clause

    return f"""
        WITH scored AS (
          SELECT f.business_id,
                 CAST(JSON_EXTRACT_PATH_TEXT(f.value,'value') AS FLOAT) AS s
          FROM rds_cases_public.rel_business_customer_monitoring rbcm
          {cust_join}
          JOIN rds_warehouse_public.facts f ON f.business_id = rbcm.business_id
           AND f.name = 'confidence_score'
          WHERE DATE(rbcm.created_at) BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
            {cust_filter}
        ),
        d AS (
          SELECT business_id, score_decision AS decision
          FROM rds_manual_score_public.data_current_scores cs
          JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low'
               WHEN s < 0.4 THEN 'Low'
               WHEN s < 0.6 THEN 'Medium'
               WHEN s < 0.8 THEN 'High'
               ELSE 'Very High' END AS band,
          d.decision,
          COUNT(*) AS n
        FROM scored LEFT JOIN d USING(business_id)
        GROUP BY 1, 2
        ORDER BY MIN(s), 2
    """.strip()


def tat_by_band_sql(start: date, end: date, customer_clause: str = "") -> str:
    cust_join = ""
    cust_filter = ""
    if customer_clause:
        cust_join = "JOIN rds_auth_public.data_customers c ON c.id = rbcm.customer_id"
        cust_filter = customer_clause

    return f"""
        WITH scored AS (
          SELECT f.business_id,
                 CAST(JSON_EXTRACT_PATH_TEXT(f.value,'value') AS FLOAT) AS s,
                 rbcm.created_at AS onboarded_at
          FROM rds_cases_public.rel_business_customer_monitoring rbcm
          {cust_join}
          JOIN rds_warehouse_public.facts f ON f.business_id = rbcm.business_id
           AND f.name = 'confidence_score'
          WHERE DATE(rbcm.created_at) BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
            {cust_filter}
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low'
               WHEN s < 0.4 THEN 'Low'
               WHEN s < 0.6 THEN 'Medium'
               WHEN s < 0.8 THEN 'High'
               ELSE 'Very High' END AS band,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s) AS p50_score,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY s) AS p90_score,
          COUNT(*) AS n
        FROM scored
        GROUP BY 1
        ORDER BY MIN(s)
    """.strip()
