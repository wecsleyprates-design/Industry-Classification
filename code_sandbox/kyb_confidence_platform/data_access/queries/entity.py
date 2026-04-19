"""Entity-level query templates (single business)."""
from __future__ import annotations


def profile_sql(business_id: str) -> str:
    return f"""
        SELECT name,
               JSON_EXTRACT_PATH_TEXT(value,'value')                       AS fact_value,
               JSON_EXTRACT_PATH_TEXT(value,'source','platformId')         AS vendor_id,
               CAST(JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS FLOAT) AS conf,
               received_at
        FROM rds_warehouse_public.facts
        WHERE business_id = '{business_id}'
          AND name IN (
            'legal_name','dba','entity_type','jurisdiction','registration_status',
            'formation_state','tin_match_boolean','confidence_score',
            'ubo_verified','watchlist_hits','address_consistency',
            'submitted_at','scored_at','decision_at','activation_at'
          )
        ORDER BY name
    """.strip()


def relationships_sql(business_id: str) -> str:
    return f"""
        SELECT a.business_id AS related_id,
               JSON_EXTRACT_PATH_TEXT(a.value, 'value') AS shared_value,
               a.name                                   AS identifier_type
        FROM rds_warehouse_public.facts a
        JOIN rds_warehouse_public.facts b
          ON a.name = b.name
         AND JSON_EXTRACT_PATH_TEXT(a.value,'value') = JSON_EXTRACT_PATH_TEXT(b.value,'value')
         AND a.business_id <> b.business_id
        WHERE b.business_id = '{business_id}'
          AND a.name IN ('tin','address','phone','email','ubo_id')
        LIMIT 200
    """.strip()
