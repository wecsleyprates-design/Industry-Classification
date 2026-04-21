"""
Portfolio-level query templates.

All queries:
  - Use rds_cases_public.rel_business_customer_monitoring (rbcm) as the
    authoritative onboarding date source (rbcm.created_at).
  - Accept an optional customer_clause (pre-built SQL AND fragment) so the
    analytics layer can pass the active customer filter.
  - Have NO arbitrary LIMIT — we want all data for the window.
"""
from __future__ import annotations

from datetime import date


def summary_sql(start: date, end: date, customer_clause: str = "") -> str:
    """
    Portfolio KPI summary for the date window.
    customer_clause: optional SQL AND fragment, e.g.
      "AND c.name = 'Acme Holdings Inc.'"
    """
    cust_join = ""
    cust_filter = ""
    if customer_clause:
        cust_join = """
            JOIN rds_auth_public.data_customers c ON c.id = rbcm.customer_id
        """
        cust_filter = customer_clause

    return f"""
        SELECT
          COUNT(DISTINCT rbcm.business_id)  AS total_cases,
          COUNT(DISTINCT rbcm.customer_id)  AS distinct_customers,
          COUNT(DISTINCT rbcm.business_id)  AS distinct_businesses,
          AVG(CAST(JSON_EXTRACT_PATH_TEXT(f.value,'value') AS FLOAT)) AS avg_confidence
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        {cust_join}
        JOIN rds_warehouse_public.facts f
          ON f.business_id = rbcm.business_id
         AND f.name = 'confidence_score'
        WHERE DATE(rbcm.created_at) BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
          {cust_filter}
    """.strip()


def bands_sql(start: date, end: date, customer_clause: str = "") -> str:
    """Confidence band distribution for the window."""
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
        )
        SELECT
          CASE WHEN s < 0.2 THEN 'Very Low (0.0–0.2)'
               WHEN s < 0.4 THEN 'Low (0.2–0.4)'
               WHEN s < 0.6 THEN 'Medium (0.4–0.6)'
               WHEN s < 0.8 THEN 'High (0.6–0.8)'
               ELSE              'Very High (0.8–1.0)' END AS band,
          COUNT(*) AS count
        FROM scored
        GROUP BY 1
        ORDER BY MIN(s)
    """.strip()


def trend_sql(start: date, end: date, customer_clause: str = "") -> str:
    """Weekly average confidence trend."""
    cust_join = ""
    cust_filter = ""
    if customer_clause:
        cust_join = "JOIN rds_auth_public.data_customers c ON c.id = rbcm.customer_id"
        cust_filter = customer_clause

    return f"""
        SELECT
          DATE_TRUNC('week', rbcm.created_at)                              AS week,
          AVG(CAST(JSON_EXTRACT_PATH_TEXT(f.value,'value') AS FLOAT))      AS average
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        {cust_join}
        JOIN rds_warehouse_public.facts f ON f.business_id = rbcm.business_id
         AND f.name = 'confidence_score'
        WHERE DATE(rbcm.created_at) BETWEEN '{start.isoformat()}' AND '{end.isoformat()}'
          {cust_filter}
        GROUP BY 1
        ORDER BY 1
    """.strip()
