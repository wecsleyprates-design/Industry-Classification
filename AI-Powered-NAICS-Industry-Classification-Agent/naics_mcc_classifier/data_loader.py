"""
naics_mcc_classifier/data_loader.py
=====================================
Pulls all raw data needed to train and evaluate the NAICS/MCC classifier.

Connection pattern matches your working redshift_query() helper exactly:
  - psycopg2 for the connection
  - cursor.execute() → fetchall() → column names from cur.description
  - Polars DataFrame as the output type
  - No pd.read_sql() (avoids SQLiteDatabase routing bug on Python 3.9)
  - No ::json operators (Redshift uses JSON_EXTRACT_PATH_TEXT instead)

Data sources (all verified against SIC-UK-Codes source code):
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Source          │ Redshift table                        │ Key cols   │
  ├──────────────────────────────────────────────────────────────────────┤
  │ ZoomInfo        │ datascience.zoominfo_standard_ml_2    │ zi_c_naics6│
  │ Equifax         │ warehouse.equifax_us_standardized     │ efx_primnaicscode│
  │ OpenCorporates  │ datascience.open_corporates_standard_ml_2 │ industry_code_uids│
  │ ZI matches      │ datascience.zoominfo_matches_custom_inc_ml│ zi_match_confidence│
  │ EFX matches     │ datascience.efx_matches_custom_inc_ml │ efx_match_confidence│
  │ OC matches      │ datascience.oc_matches_custom_inc_ml  │ oc_match_confidence│
  │ Pipeline B      │ datascience.customer_files            │ primary_naics_code│
  │ Facts (Pipe A)  │ rds_warehouse_public.facts            │ naics_code, mcc_code│
  └──────────────────────────────────────────────────────────────────────┘
"""
from __future__ import annotations

import logging
import re
from typing import Optional

import numpy as np
import pandas as pd
import polars as pl

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

from .config import (
    REDSHIFT, TABLES,
    NAICS_FALLBACK, MCC_FALLBACK, MIN_VENDOR_AGREEMENT,
    BUSINESS_ID_COL, NAICS_LABEL_COL, MCC_LABEL_COL,
)

logger = logging.getLogger(__name__)

# ── OC industry_code_uids parsers ─────────────────────────────────────────────
_US_NAICS_RE = re.compile(r"us_naics-(\d{6})")
_GB_SIC_RE   = re.compile(r"gb_sic-(\d+)")


# ═════════════════════════════════════════════════════════════════════════════
# CONNECTION & QUERY HELPERS
# Exact pattern from your working redshift_query() helper.
# ═════════════════════════════════════════════════════════════════════════════

def establish_redshift_connection() -> "psycopg2.extensions.connection":
    """
    Establishes a psycopg2 connection to Redshift using credentials from config.
    Mirrors your establish_redshift_conn_psycopg2() function exactly.
    """
    if not HAS_PSYCOPG2:
        raise ImportError("psycopg2-binary is required:  pip install psycopg2-binary")
    return psycopg2.connect(**REDSHIFT)


def redshift_query(query: str) -> pl.DataFrame:
    """
    Executes a SQL query on Redshift and returns a Polars DataFrame.

    Mirrors your redshift_query() function exactly:
      - psycopg2 connection context manager
      - cursor.execute() → fetchall()
      - column names from cur.description
      - pd.DataFrame → pl.from_pandas()

    All SQL must use Redshift-compatible syntax:
      ✅  JSON_EXTRACT_PATH_TEXT(col, 'key')     (Redshift)
      ❌  col::json->>'key'                       (PostgreSQL only — breaks in Redshift)
      ✅  CAST(x AS VARCHAR), LOWER(), COALESCE(), GREATEST()
      ✅  Schema.table references in double-quotes: "schema"."table"
    """
    with establish_redshift_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            column_names = [desc[0] for desc in cur.description]
            df_pd = pd.DataFrame(rows, columns=column_names)
            return pl.from_pandas(df_pd)


def test_redshift_connection() -> dict:
    """
    Quick connectivity + Redshift SQL syntax test.
    Run this before the full pipeline to catch credential / VPN issues early.

    Returns a dict:
      { "connected": bool, "ping": str, "json_extract_works": bool, "error": str|None }
    """
    try:
        redshift_query("SELECT 1 AS ping")
        result = redshift_query(
            """SELECT JSON_EXTRACT_PATH_TEXT('{"code":"722511"}', 'code') AS test_code"""
        )
        json_ok = result["test_code"][0] == "722511"
        return {"connected": True, "ping": "ok", "json_extract_works": json_ok, "error": None}
    except Exception as e:
        return {"connected": False, "ping": None, "json_extract_works": False, "error": str(e)}


# ═════════════════════════════════════════════════════════════════════════════
# 1. FACTS TABLE — Current production NAICS and MCC codes (Pipeline A output)
# ═════════════════════════════════════════════════════════════════════════════

def load_production_naics() -> pl.DataFrame:
    """
    Loads the current NAICS and MCC code for every business from the facts table.
    Source: rds_warehouse_public.facts  (Redshift mirror of the PostgreSQL facts table)

    The facts table stores every fact as a JSONB value. In Redshift this is stored
    as a VARCHAR column. We use JSON_EXTRACT_PATH_TEXT() to pull individual keys.

    Schema used:
      facts.name = 'naics_code'  → value contains: {"code":"722511","source":{...},...}
      facts.name = 'mcc_code'    → value contains: {"code":"5812","source":{...},...}

    Returns columns:
      business_id            — UUID string
      current_naics_code     — 6-digit NAICS string (may be '561499' = fallback)
      naics_confidence       — source confidence float (0-1)
      naics_platform_id      — which vendor won (16=Middesk, 23=OC, 24=ZI, 17=EFX, 31=AI, 38=Trulioo)
      naics_override_raw     — non-null if analyst manually overrode the code
      current_mcc_code       — 4-digit MCC string (may be '5614' = fallback)
      ai_enrichment_confidence — 'HIGH'/'MED'/'LOW' from AI enrichment response
    """
    # The facts table value column stores JSON with key "value" for the code:
    # {"name":"naics_code","value":"561499","source.confidence":0.1,
    #  "source.platformId":31,"source.name":"AINaicsEnrichment","alternatives":[]}
    #
    # Note: nested keys like "source.confidence" are stored as FLAT dot-notation
    # strings — NOT as nested JSON objects. JSON_EXTRACT_PATH_TEXT(col,'source.confidence')
    # reads the literal key "source.confidence" from the top-level JSON.
    schema, table = "rds_warehouse_public", "facts"
    sql = f"""
    SELECT
        f_naics.business_id,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'value')               AS current_naics_code,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.confidence')   AS naics_confidence,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.platformId')   AS naics_platform_id,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'override')            AS naics_override_raw,
        f_naics.received_at                                           AS naics_updated_at,
        JSON_EXTRACT_PATH_TEXT(f_mcc.value,   'value')               AS current_mcc_code,
        JSON_EXTRACT_PATH_TEXT(f_mcc.value,   'source.confidence')   AS mcc_confidence,
        JSON_EXTRACT_PATH_TEXT(f_ai.value,    'confidence')          AS ai_enrichment_confidence
    FROM "{schema}"."{table}" f_naics
    LEFT JOIN "{schema}"."{table}" f_mcc
           ON f_mcc.business_id = f_naics.business_id
          AND f_mcc.name        = 'mcc_code'
    LEFT JOIN "{schema}"."{table}" f_ai
           ON f_ai.business_id  = f_naics.business_id
          AND f_ai.name         = 'ai_naics_enrichment_metadata'
    WHERE f_naics.name = 'naics_code'
    """
    df = redshift_query(sql)

    # The facts table stores values as:
    #   {"name":"naics_code","value":"561499","source.confidence":0.1,...}
    # Key is "value" (not "code") — confirmed from raw value diagnostic log.
    # If JSON_EXTRACT_PATH_TEXT returns all NULLs, try the "value" key instead.
    null_count = df["current_naics_code"].is_null().sum()
    if null_count == len(df) and len(df) > 0:
        logger.warning(
            "ALL %d rows have NULL current_naics_code from key 'code'. "
            "Facts table uses key 'value' — requerying with correct key...",
            len(df)
        )
        # The value column JSON uses "value" as the NAICS code key, not "code"
        # Full confirmed format from diagnostic sample:
        # {"name":"naics_code","value":"561499","source.name":"AINaicsEnrichment",
        #  "source.confidence":0.1,"source.platformId":31,"alternatives":[]}
        schema2, table2 = "rds_warehouse_public", "facts"
        sql2 = f"""
        SELECT
            f_naics.business_id,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'value')                          AS current_naics_code,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.confidence')              AS naics_confidence,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.platformId')              AS naics_platform_id,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'override')                       AS naics_override_raw,
            f_naics.received_at                                                      AS naics_updated_at,
            JSON_EXTRACT_PATH_TEXT(f_mcc.value, 'value')                            AS current_mcc_code,
            JSON_EXTRACT_PATH_TEXT(f_mcc.value, 'source.confidence')                AS mcc_confidence,
            JSON_EXTRACT_PATH_TEXT(f_ai.value, 'confidence')                        AS ai_enrichment_confidence
        FROM "{schema2}"."{table2}" f_naics
        LEFT JOIN "{schema2}"."{table2}" f_mcc
               ON f_mcc.business_id = f_naics.business_id
              AND f_mcc.name        = 'mcc_code'
        LEFT JOIN "{schema2}"."{table2}" f_ai
               ON f_ai.business_id  = f_naics.business_id
              AND f_ai.name         = 'ai_naics_enrichment_metadata'
        WHERE f_naics.name = 'naics_code'
        """
        df = redshift_query(sql2)
    elif null_count > 0:
        logger.warning("%d / %d rows have NULL current_naics_code.", null_count, len(df))

    # Normalise business_id to lowercase for consistent merging across tables
    df = df.with_columns([
        pl.col("business_id").cast(pl.Utf8).str.to_lowercase().str.strip_chars().alias("business_id"),
        pl.col("current_naics_code").cast(pl.Utf8).fill_null("").alias("current_naics_code"),
        pl.col("current_mcc_code").cast(pl.Utf8).fill_null("").alias("current_mcc_code"),
    ])

    # Flag fallback rows:
    # A business is "fallback" when:
    #   - current_naics_code == '561499'  (explicit AI last-resort code), OR
    #   - current_naics_code is null/empty (facts table has no NAICS for this business)
    # Both cases mean "the current system doesn't know the NAICS" — our model
    # should try to fill these in using vendor signals.
    df = df.with_columns([
        (
            pl.col("current_naics_code").is_null()
            | (pl.col("current_naics_code") == "")
            | (pl.col("current_naics_code") == NAICS_FALLBACK)
        ).cast(pl.Int8).alias("ai_naics_is_fallback"),
        (
            pl.col("current_mcc_code").is_null()
            | (pl.col("current_mcc_code") == "")
            | (pl.col("current_mcc_code") == MCC_FALLBACK)
        ).cast(pl.Int8).alias("ai_mcc_is_fallback"),
        (
            pl.col("naics_override_raw").is_not_null()
            & (pl.col("naics_override_raw") != "null")
            & (pl.col("naics_override_raw") != "")
        ).cast(pl.Int8).alias("has_analyst_override"),
    ])

    fallback_count = df["ai_naics_is_fallback"].sum()
    logger.info(
        "Loaded %d production NAICS records  (fallback=561499: %d, %.1f%%)",
        len(df), fallback_count, 100 * fallback_count / max(len(df), 1)
    )
    return df


# ═════════════════════════════════════════════════════════════════════════════
# 2. ENTITY-MATCH CONFIDENCE — XGBoost Level 1 outputs
# ═════════════════════════════════════════════════════════════════════════════

def load_entity_match_confidences() -> pd.DataFrame:
    """
    Loads entity-matching confidence scores from the XGBoost Level 1 model outputs.

    Actual columns in each match table (verified from warehouse-service stored procedures):
      zoominfo_matches_custom_inc_ml: business_id, zi_c_company_id, zi_c_location_id,
                                       zi_es_location_id, zi_probability, similarity_index
      efx_matches_custom_inc_ml:      business_id, efx_id, efx_probability, similarity_index
      oc_matches_custom_inc_ml:       business_id, company_number, jurisdiction_code,
                                       oc_probability, similarity_index

    zi/efx/oc_match_confidence are NOT stored columns in those tables. They are computed
    in smb_zi_oc_efx_ver_combined.sql. We reproduce that exact CASE expression here:
      WHEN {source}_probability IS NOT NULL  → use XGBoost probability
      WHEN similarity_index / 55.0 >= 0.8   → use heuristic fallback
      ELSE 0

    Each match table may have MULTIPLE rows per business_id (candidate matches).
    We take the MAX confidence per business_id before joining.

    Returns a pandas DataFrame (not Polars) to avoid Polars outer-join key collision.
    """
    # ── ZoomInfo ──────────────────────────────────────────────────────────────
    schema_zi, table_zi = TABLES["zi_matches"].split(".")
    sql_zi = f"""
    SELECT
        LOWER(CAST(business_id AS VARCHAR)) AS business_id,
        MAX(CASE
            WHEN zi_probability IS NOT NULL      THEN zi_probability
            WHEN similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0
            ELSE 0
        END) AS zi_match_confidence
    FROM "{schema_zi}"."{table_zi}"
    GROUP BY business_id
    """
    df_zi = redshift_query(sql_zi).to_pandas()

    # ── Equifax ───────────────────────────────────────────────────────────────
    schema_efx, table_efx = TABLES["efx_matches"].split(".")
    sql_efx = f"""
    SELECT
        LOWER(CAST(business_id AS VARCHAR)) AS business_id,
        MAX(CASE
            WHEN efx_probability IS NOT NULL     THEN efx_probability
            WHEN similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0
            ELSE 0
        END) AS efx_match_confidence
    FROM "{schema_efx}"."{table_efx}"
    GROUP BY business_id
    """
    df_efx = redshift_query(sql_efx).to_pandas()

    # ── OpenCorporates ────────────────────────────────────────────────────────
    schema_oc, table_oc = TABLES["oc_matches"].split(".")
    sql_oc = f"""
    SELECT
        LOWER(CAST(business_id AS VARCHAR)) AS business_id,
        MAX(CASE
            WHEN oc_probability IS NOT NULL      THEN oc_probability
            WHEN similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0
            ELSE 0
        END) AS oc_match_confidence
    FROM "{schema_oc}"."{table_oc}"
    GROUP BY business_id
    """
    df_oc = redshift_query(sql_oc).to_pandas()

    # ── Outer-merge all three using pandas (avoids Polars key collision) ──────
    df = (
        df_zi
        .merge(df_efx, on="business_id", how="outer")
        .merge(df_oc,  on="business_id", how="outer")
    )
    df["zi_match_confidence"]  = pd.to_numeric(df["zi_match_confidence"],  errors="coerce").fillna(0.0)
    df["efx_match_confidence"] = pd.to_numeric(df["efx_match_confidence"], errors="coerce").fillna(0.0)
    df["oc_match_confidence"]  = pd.to_numeric(df["oc_match_confidence"],  errors="coerce").fillna(0.0)
    df["has_zi_match"]  = (df["zi_match_confidence"]  > 0.0).astype(int)
    df["has_efx_match"] = (df["efx_match_confidence"] > 0.0).astype(int)
    df["has_oc_match"]  = (df["oc_match_confidence"]  > 0.0).astype(int)

    logger.info(
        "Loaded entity-match confidences for %d businesses "
        "(ZI: %d matches, EFX: %d matches, OC: %d matches)",
        len(df),
        df["has_zi_match"].sum(),
        df["has_efx_match"].sum(),
        df["has_oc_match"].sum(),
    )
    return df


# ═════════════════════════════════════════════════════════════════════════════
# 3. PIPELINE B WINNER — current ZI-vs-EFX NAICS winner
# ═════════════════════════════════════════════════════════════════════════════

def load_customer_files_naics() -> pl.DataFrame:
    """
    Loads the Pipeline B NAICS winner from datascience.customer_files.

    This is the code produced by customer_table.sql:
      WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6
      ELSE efx_primnaicscode

    Note: Pipeline B uses ZI + EFX ONLY — OC, Middesk, Trulioo are excluded.
    We use this as a high-quality training label when match_confidence >= 0.80.
    """
    # customer_files actual columns (verified from customer_table.sql):
    #   business_id, match_confidence, primary_naics_code, mcc_code, mcc_desc, ...
    # NOTE: zi_match_confidence and efx_match_confidence are NOT stored in customer_files.
    #       Only the winning match_confidence (= MAX(zi, efx)) is stored.
    # primary_naics_code and mcc_code are INTEGER columns in customer_files.
    # COALESCE(integer_col, '') fails — must CAST to VARCHAR first.
    schema, table = TABLES["customer_files"].split(".")
    sql = f"""
    SELECT
        LOWER(CAST(business_id AS VARCHAR))          AS business_id,
        CAST(primary_naics_code AS VARCHAR)          AS pipeline_b_naics,
        COALESCE(CAST(mcc_code AS VARCHAR), '')      AS pipeline_b_mcc,
        COALESCE(match_confidence, 0.0)              AS match_confidence
    FROM "{schema}"."{table}"
    WHERE primary_naics_code IS NOT NULL
      AND primary_naics_code != 0
    """
    df = redshift_query(sql)
    df = df.with_columns([
        pl.col("pipeline_b_naics").str.zfill(6).alias("pipeline_b_naics"),
        pl.col("pipeline_b_naics").str.zfill(6).str.slice(0, 2).alias("pipeline_b_sector"),
        pl.col("pipeline_b_mcc").fill_null("").alias("pipeline_b_mcc"),
    ])
    logger.info("Loaded %d Pipeline B NAICS records", len(df))
    return df


# ═════════════════════════════════════════════════════════════════════════════
# 4. VENDOR NAICS SIGNALS — ZoomInfo, Equifax, OpenCorporates
# ═════════════════════════════════════════════════════════════════════════════

def load_zoominfo_signals() -> pl.DataFrame:
    """
    ZoomInfo NAICS, SIC, and confidence scores.
    Source: zoominfo.comp_standard_global  (the raw ZI table with all NAICS fields)

    Note on table choice:
      - datascience.zoominfo_standard_ml_2 has ONLY normalized name/address columns
        for Levenshtein similarity scoring — it does NOT contain NAICS codes.
      - zoominfo.comp_standard_global is the source table that contains zi_c_naics6,
        confidence scores, firmographics, etc.
      - smb_zi_oc_efx_ver_combined.sql pulls NAICS directly from comp_standard_global.
      - The enriched table zoominfo.enriched_match_reasons_conf_tier_udb also has
        all these columns and can be used as an alternative.

    Key columns returned (all verified from smb_zi_oc_efx_ver_combined.sql line 1237+):
      zi_c_naics6              — 6-digit NAICS primary code
      zi_c_naics4, zi_c_naics2 — sub-sector codes
      zi_c_naics_confidence_score — ZI's own NAICS confidence (0-1)
      zi_c_sic4                — 4-digit SIC primary code
      zi_c_employees           — firmographic: employee count
      zi_c_revenue             — firmographic: annual revenue
    """
    schema, table = TABLES["zi_source"].split(".")
    sql = f"""
    SELECT
        CAST(zi_c_company_id  AS VARCHAR) || '|' ||
        CAST(zi_c_location_id AS VARCHAR)        AS zi_key,
        CAST(zi_c_naics6 AS VARCHAR)             AS zi_c_naics6,
        CAST(zi_c_naics4 AS VARCHAR)             AS zi_c_naics4,
        CAST(zi_c_naics2 AS VARCHAR)             AS zi_c_naics2,
        zi_c_naics_confidence_score,
        CAST(zi_c_sic4 AS VARCHAR)               AS zi_c_sic4,
        zi_c_employees                           AS zi_c_total_employee_count,
        zi_c_revenue                             AS zi_c_annual_revenue,
        zi_c_name,
        COALESCE(zi_c_state,   'MISSING')        AS state,
        zi_c_country                             AS country_code
    FROM "{schema}"."{table}"
    WHERE zi_c_naics6 IS NOT NULL
      AND zi_c_country = 'United States'
    """
    df = redshift_query(sql)
    logger.info("Loaded %d ZoomInfo records with NAICS from %s.%s", len(df), schema, table)
    return df


def load_equifax_signals() -> pl.DataFrame:
    """
    Equifax primary and secondary NAICS + SIC codes.
    Source: warehouse.equifax_us_standardized

    Key columns:
      efx_naics_primary      — primary 6-digit NAICS
      efx_naics_secondary_1-4 — secondary NAICS codes
      efx_sic_primary        — primary 4-digit SIC
      efx_employee_count     — firmographic: employees
      efx_annual_sales       — firmographic: annual revenue
    """
    schema, table = TABLES["efx_source"].split(".")
    sql = f"""
    SELECT
        CAST(efx_id AS VARCHAR)                             AS efx_id,
        efx_name,
        COALESCE(UPPER(TRIM(efx_eng_state)), 'MISSING')    AS state,
        CAST(efx_primnaicscode AS VARCHAR)                  AS efx_naics_primary,
        CAST(COALESCE(efx_secnaics1, 0) AS VARCHAR)         AS efx_naics_secondary_1,
        CAST(COALESCE(efx_secnaics2, 0) AS VARCHAR)         AS efx_naics_secondary_2,
        CAST(COALESCE(efx_secnaics3, 0) AS VARCHAR)         AS efx_naics_secondary_3,
        CAST(COALESCE(efx_secnaics4, 0) AS VARCHAR)         AS efx_naics_secondary_4,
        CAST(efx_primsic AS VARCHAR)                        AS efx_sic_primary,
        efx_primnaicsdesc                                   AS efx_naics_primary_desc,
        COALESCE(efx_employees, 0)                          AS efx_employee_count,
        COALESCE(efx_annual_sales, 0)                       AS efx_annual_sales
    FROM "{schema}"."{table}"
    WHERE efx_primnaicscode IS NOT NULL
      AND efx_primnaicscode != 0
    """
    df = redshift_query(sql)
    # Zero-pad NAICS codes to 6 digits
    df = df.with_columns([
        pl.col(c).str.zfill(6).alias(c)
        for c in ["efx_naics_primary","efx_naics_secondary_1","efx_naics_secondary_2",
                  "efx_naics_secondary_3","efx_naics_secondary_4"]
    ])
    df = df.with_columns([
        pl.col("efx_naics_primary").str.slice(0, 2).alias("efx_naics_sector"),
    ])
    logger.info("Loaded %d Equifax records with NAICS", len(df))
    return df


def load_oc_signals() -> pl.DataFrame:
    """
    OpenCorporates industry_code_uids — parses NAICS and UK SIC.
    Source: datascience.open_corporates_standard_ml_2

    industry_code_uids is a pipe-delimited multi-taxonomy string:
      "us_naics-541110|gb_sic-62012|nace-J6201|ca_naics-541110"

    We extract:
      oc_naics_primary  — first us_naics- entry
      oc_gb_sic         — first gb_sic- entry (UK businesses)
    """
    schema, table = TABLES["oc_source"].split(".")
    sql = f"""
    SELECT
        company_number || '|' || jurisdiction_code  AS oc_key,
        company_name,
        industry_code_uids,
        jurisdiction_code,
        UPPER(TRIM(region))                         AS state
    FROM "{schema}"."{table}"
    WHERE industry_code_uids IS NOT NULL
      AND industry_code_uids != ''
    """
    df = redshift_query(sql)

    # Parse NAICS and UK SIC from the pipe-delimited string in Python
    # (Redshift regex is limited; this is cleaner and faster for this pattern)
    def _parse_naics(s: str) -> str:
        m = _US_NAICS_RE.search(s or "")
        return m.group(1) if m else ""

    def _parse_gb_sic(s: str) -> str:
        m = _GB_SIC_RE.search(s or "")
        return m.group(1) if m else ""

    # Convert to pandas for the Python-level parsing, then back to Polars
    pdf = df.to_pandas()
    pdf["oc_naics_primary"] = pdf["industry_code_uids"].apply(_parse_naics)
    pdf["oc_gb_sic"]        = pdf["industry_code_uids"].apply(_parse_gb_sic)
    df = pl.from_pandas(pdf)

    df = df.with_columns([
        pl.col("oc_naics_primary").str.slice(0, 2).alias("oc_naics_sector"),
    ])
    df = df.filter(pl.col("oc_naics_primary") != "")
    logger.info("Loaded %d OC records with a parseable US NAICS", len(df))
    return df


# ═════════════════════════════════════════════════════════════════════════════
# 5. REFERENCE TABLES — NAICS/MCC codes + crosswalk
#    Source: case-service PostgreSQL (not Redshift)
#    Fallback: embedded static tables if PG is not accessible
# ═════════════════════════════════════════════════════════════════════════════

def load_naics_mcc_crosswalk() -> pd.DataFrame:
    """
    Returns NAICS → MCC crosswalk as a pandas DataFrame {naics_code, mcc_code}.

    Primary source: public.rel_naics_mcc (case-service PostgreSQL).
    Fallback: queries the Redshift mirror if available, else returns empty DataFrame.

    Note: This table is managed by case-service DB migrations — it is static
    reference data, not updated by the pipeline.
    """
    # Try to load from case-service PostgreSQL
    try:
        from .config import CASESERVICE_PG, PG_TABLES
        import psycopg2 as _pg
        conn = _pg.connect(**CASESERVICE_PG)
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                SELECT nc.code AS naics_code, mc.code AS mcc_code
                FROM {PG_TABLES['rel_naics_mcc']} rm
                JOIN {PG_TABLES['core_naics']} nc ON nc.id = rm.naics_id
                JOIN {PG_TABLES['core_mcc']}   mc ON mc.id = rm.mcc_id
                """)
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
        finally:
            conn.close()
        df = pd.DataFrame(rows, columns=cols)
        logger.info("Loaded %d NAICS→MCC crosswalk rows from case-service PG", len(df))
        return df
    except Exception as e:
        logger.warning("Could not load crosswalk from case-service PG (%s). Using empty crosswalk.", e)
        return pd.DataFrame(columns=["naics_code", "mcc_code"])


def load_naics_lookup() -> pd.DataFrame:
    """
    Returns every NAICS code with its human-readable label.

    Primary source: public.core_naics_code (case-service PostgreSQL).
    Fallback: queries Redshift mirror rds_cases_public.core_naics_code.

    Columns returned:
      naics_code   — 6-digit NAICS string
      naics_label  — human-readable description  (e.g. "Full-Service Restaurants")
      naics_sector — 2-digit sector code         (e.g. "72")
      naics_group  — 4-digit industry group code (e.g. "7225")
    """
    # Try case-service PostgreSQL first
    try:
        from .config import CASESERVICE_PG, PG_TABLES
        import psycopg2 as _pg
        conn = _pg.connect(**CASESERVICE_PG)
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                SELECT id AS naics_id, code AS naics_code, label AS naics_label
                FROM {PG_TABLES['core_naics']}
                ORDER BY code
                """)
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
        finally:
            conn.close()
        df = pd.DataFrame(rows, columns=cols)
        df["naics_sector"] = df["naics_code"].astype(str).str[:2]
        df["naics_group"]  = df["naics_code"].astype(str).str[:4]
        logger.info("Loaded %d NAICS codes from case-service PG", len(df))
        return df
    except Exception as pg_err:
        logger.warning("Could not load NAICS lookup from PG (%s). Trying Redshift mirror...", pg_err)

    # Fallback: Redshift mirror of case-service DB
    try:
        df_pl = redshift_query("""
            SELECT
                CAST(code AS VARCHAR) AS naics_code,
                label                 AS naics_label
            FROM "rds_cases_public"."core_naics_code"
            ORDER BY code
        """)
        df = df_pl.to_pandas()
        df["naics_sector"] = df["naics_code"].astype(str).str[:2]
        df["naics_group"]  = df["naics_code"].astype(str).str[:4]
        logger.info("Loaded %d NAICS codes from Redshift mirror", len(df))
        return df
    except Exception as rs_err:
        logger.warning("Could not load NAICS lookup from Redshift either (%s). Returning empty.", rs_err)
        return pd.DataFrame(columns=["naics_code", "naics_label", "naics_sector", "naics_group"])


def load_mcc_lookup() -> pd.DataFrame:
    """
    Returns every MCC code with its human-readable label.

    Primary source: public.core_mcc_code (case-service PostgreSQL).
    Fallback: queries Redshift mirror rds_cases_public.core_mcc_code.

    Columns returned:
      mcc_code  — 4-digit MCC string  (e.g. "5812")
      mcc_label — human-readable label (e.g. "Eating Places, Restaurants")
    """
    # Try case-service PostgreSQL first
    try:
        from .config import CASESERVICE_PG, PG_TABLES
        import psycopg2 as _pg
        conn = _pg.connect(**CASESERVICE_PG)
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                SELECT id AS mcc_id, code AS mcc_code, label AS mcc_label
                FROM {PG_TABLES['core_mcc']}
                ORDER BY code
                """)
                rows = cur.fetchall()
                cols = [d[0] for d in cur.description]
        finally:
            conn.close()
        df = pd.DataFrame(rows, columns=cols)
        logger.info("Loaded %d MCC codes from case-service PG", len(df))
        return df
    except Exception as pg_err:
        logger.warning("Could not load MCC lookup from PG (%s). Trying Redshift mirror...", pg_err)

    # Fallback: Redshift mirror
    try:
        df_pl = redshift_query("""
            SELECT
                CAST(code AS VARCHAR) AS mcc_code,
                label                 AS mcc_label
            FROM "rds_cases_public"."core_mcc_code"
            ORDER BY code
        """)
        df = df_pl.to_pandas()
        logger.info("Loaded %d MCC codes from Redshift mirror", len(df))
        return df
    except Exception as rs_err:
        logger.warning("Could not load MCC lookup from Redshift either (%s). Returning empty.", rs_err)
        return pd.DataFrame(columns=["mcc_code", "mcc_label"])


# ═════════════════════════════════════════════════════════════════════════════
# 6. MASTER DATASET BUILDER
# ═════════════════════════════════════════════════════════════════════════════

def build_training_dataset(
    limit: Optional[int] = None,
    use_synthetic: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Joins all sources into a single labeled DataFrame for model training.

    Steps:
      1. Load current NAICS/MCC from facts table (Pipeline A output)
      2. Load entity-match confidence scores (XGBoost Level 1 outputs)
      3. Load Pipeline B NAICS winner (ZI vs EFX rule)
      4. Join all three on business_id
      5. Load vendor NAICS signals (ZI, EFX, OC) and join via match tables
      6. Assign labels by priority:
           a. Analyst override → keep current code (already embedded in facts)
           b. Pipeline B winner when match_confidence >= 0.80
           c. Current code as-is for all other non-fallback rows
      7. Split into train_df (non-fallback) and fallback_df (561499 eval set)

    Args:
        limit        — cap rows for quick dev runs (None = all data)
        use_synthetic — generate realistic synthetic data (no Redshift needed)

    Returns:
        train_df    — pandas DataFrame: rows with reliable NAICS label
        fallback_df — pandas DataFrame: rows currently classified as 561499
    """
    if use_synthetic:
        logger.warning(
            "use_synthetic=True — generating synthetic data. "
            "Set use_synthetic=False with Redshift credentials for real training."
        )
        return _generate_synthetic_dataset(n=limit or 10_000)

    # ── ONE SINGLE REDSHIFT QUERY — all joins done server-side ───────────────
    # Previously we loaded full vendor tables into Python and joined there.
    # zoominfo.comp_standard_global has millions of rows globally — loading it
    # entirely caused the 16+ minute hang.
    #
    # Fix: push ALL joins into one CTE query on Redshift (same pattern as
    # smb_zi_oc_efx_ver_combined.sql). Redshift only returns one row per
    # business_id with the best matched vendor signals. ~1-3 minutes total.
    #
    # New features added vs previous version:
    #   zi_c_naics_top3  — ZoomInfo's top-3 NAICS candidates (pipe-delimited)
    #   zi_c_sic_top3    — ZoomInfo's top-3 SIC candidates
    #   efx_secnaics1-4  — Equifax 4 secondary NAICS codes
    #   efx_secsic1-4    — Equifax 4 secondary SIC codes
    #   oc_industry_code_uids — all OC taxonomy codes (parsed for NAICS + SIC)

    t_facts    = "rds_warehouse_public.facts"
    t_zi_match = TABLES["zi_matches"]
    t_efx_match= TABLES["efx_matches"]
    t_oc_match = TABLES["oc_matches"]
    t_zi_src   = TABLES["zi_source"]       # zoominfo.comp_standard_global
    t_efx_src  = TABLES["efx_source"]      # warehouse.equifax_us_standardized
    t_oc_src   = TABLES["oc_source"]       # datascience.open_corporates_standard_ml_2
    t_cust     = TABLES["customer_files"]

    logger.info("Executing single Redshift query — all vendor signals joined server-side...")
    limit_clause = f"LIMIT {limit}" if limit else ""

    sql_master = f"""
    WITH
    -- ── facts: current Pipeline A NAICS/MCC ─────────────────────────────────
    facts_cte AS (
        SELECT
            LOWER(CAST(f_naics.business_id AS VARCHAR))              AS business_id,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'value')           AS current_naics_code,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.confidence') AS naics_confidence,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.platformId')  AS naics_platform_id,
            JSON_EXTRACT_PATH_TEXT(f_naics.value, 'override')        AS naics_override_raw,
            JSON_EXTRACT_PATH_TEXT(f_mcc.value,   'value')           AS current_mcc_code,
            JSON_EXTRACT_PATH_TEXT(f_ai.value,    'confidence')      AS ai_enrichment_confidence
        FROM {t_facts} f_naics
        LEFT JOIN {t_facts} f_mcc
               ON f_mcc.business_id = f_naics.business_id AND f_mcc.name = 'mcc_code'
        LEFT JOIN {t_facts} f_ai
               ON f_ai.business_id  = f_naics.business_id AND f_ai.name  = 'ai_naics_enrichment_metadata'
        WHERE f_naics.name = 'naics_code'
    ),

    -- ── Pipeline B winner (ZI vs EFX rule) ──────────────────────────────────
    pipeb_cte AS (
        SELECT
            LOWER(CAST(business_id AS VARCHAR))      AS business_id,
            CAST(primary_naics_code AS VARCHAR)      AS pipeline_b_naics,
            COALESCE(CAST(mcc_code AS VARCHAR), '')  AS pipeline_b_mcc,
            COALESCE(match_confidence, 0.0)          AS match_confidence
        FROM {t_cust}
        WHERE primary_naics_code IS NOT NULL AND primary_naics_code != 0
    ),

    -- ── Entity-match confidence: best match per business ─────────────────────
    zi_conf_cte AS (
        SELECT business_id,
               MAX(CASE WHEN zi_probability IS NOT NULL  THEN zi_probability
                        WHEN similarity_index/55.0>=0.8  THEN similarity_index/55.0
                        ELSE 0 END) AS zi_match_confidence
        FROM {t_zi_match} GROUP BY business_id
    ),
    efx_conf_cte AS (
        SELECT business_id,
               MAX(CASE WHEN efx_probability IS NOT NULL THEN efx_probability
                        WHEN similarity_index/55.0>=0.8  THEN similarity_index/55.0
                        ELSE 0 END) AS efx_match_confidence
        FROM {t_efx_match} GROUP BY business_id
    ),
    oc_conf_cte AS (
        SELECT business_id,
               MAX(CASE WHEN oc_probability IS NOT NULL  THEN oc_probability
                        WHEN similarity_index/55.0>=0.8  THEN similarity_index/55.0
                        ELSE 0 END) AS oc_match_confidence
        FROM {t_oc_match} GROUP BY business_id
    ),

    -- ── Best ZI match per business → join comp_standard_global ───────────────
    -- Only fetch ZI records for matched businesses (avoids full table scan)
    zi_best_cte AS (
        SELECT business_id, zi_c_company_id, zi_c_location_id,
               ROW_NUMBER() OVER (PARTITION BY business_id
                                  ORDER BY COALESCE(zi_probability,0) DESC,
                                           COALESCE(similarity_index,0) DESC) AS rn
        FROM {t_zi_match}
    ),
    zi_naics_cte AS (
        SELECT
            LOWER(CAST(b.business_id AS VARCHAR))     AS business_id,
            CAST(z.zi_c_naics6 AS VARCHAR)            AS zi_c_naics6,
            CAST(z.zi_c_naics4 AS VARCHAR)            AS zi_c_naics4,
            CAST(z.zi_c_naics2 AS VARCHAR)            AS zi_c_naics2,
            CAST(z.zi_c_naics_top3 AS VARCHAR)        AS zi_c_naics_top3,
            CAST(z.zi_c_sic4 AS VARCHAR)              AS zi_c_sic4,
            CAST(z.zi_c_sic_top3 AS VARCHAR)          AS zi_c_sic_top3,
            z.zi_c_naics_confidence_score,
            z.zi_c_employees                          AS zi_c_total_employee_count,
            z.zi_c_revenue                            AS zi_c_annual_revenue,
            COALESCE(z.zi_c_state, 'MISSING')         AS zi_state
        FROM zi_best_cte b
        JOIN {t_zi_src} z
          ON z.zi_c_company_id  = b.zi_c_company_id
         AND z.zi_c_location_id = b.zi_c_location_id
         AND z.zi_c_country = 'United States'
        WHERE b.rn = 1
    ),

    -- ── Best EFX match per business → join equifax_us_standardized ───────────
    efx_best_cte AS (
        SELECT business_id, efx_id,
               ROW_NUMBER() OVER (PARTITION BY business_id
                                  ORDER BY COALESCE(efx_probability,0) DESC,
                                           COALESCE(similarity_index,0) DESC) AS rn
        FROM {t_efx_match}
    ),
    efx_naics_cte AS (
        SELECT
            LOWER(CAST(b.business_id AS VARCHAR))            AS business_id,
            CAST(e.efx_primnaicscode AS VARCHAR)             AS efx_naics_primary,
            CAST(COALESCE(e.efx_secnaics1, 0) AS VARCHAR)   AS efx_naics_secondary_1,
            CAST(COALESCE(e.efx_secnaics2, 0) AS VARCHAR)   AS efx_naics_secondary_2,
            CAST(COALESCE(e.efx_secnaics3, 0) AS VARCHAR)   AS efx_naics_secondary_3,
            CAST(COALESCE(e.efx_secnaics4, 0) AS VARCHAR)   AS efx_naics_secondary_4,
            CAST(e.efx_primsic AS VARCHAR)                   AS efx_sic_primary,
            CAST(COALESCE(e.efx_secsic1, 0) AS VARCHAR)     AS efx_sic_secondary_1,
            CAST(COALESCE(e.efx_secsic2, 0) AS VARCHAR)     AS efx_sic_secondary_2,
            COALESCE(e.efx_employees, 0)                     AS efx_employee_count,
            COALESCE(e.efx_annual_sales, 0)                  AS efx_annual_sales,
            COALESCE(UPPER(TRIM(e.efx_eng_state)), 'MISSING') AS efx_state
        FROM efx_best_cte b
        JOIN {t_efx_src} e ON e.efx_id = b.efx_id
        WHERE b.rn = 1
    ),

    -- ── Best OC match per business → keep industry_code_uids ─────────────────
    oc_best_cte AS (
        SELECT business_id, company_number, jurisdiction_code,
               ROW_NUMBER() OVER (PARTITION BY business_id
                                  ORDER BY COALESCE(oc_probability,0) DESC,
                                           COALESCE(similarity_index,0) DESC) AS rn
        FROM {t_oc_match}
    ),
    oc_naics_cte AS (
        SELECT
            LOWER(CAST(b.business_id AS VARCHAR))  AS business_id,
            o.industry_code_uids                   AS oc_industry_code_uids,
            o.jurisdiction_code                    AS oc_jurisdiction_code
        FROM oc_best_cte b
        JOIN {t_oc_src} o
          ON o.company_number    = b.company_number
         AND o.jurisdiction_code = b.jurisdiction_code
        WHERE b.rn = 1
          AND o.industry_code_uids IS NOT NULL
    )

    -- ── Final join ────────────────────────────────────────────────────────────
    SELECT
        f.business_id,
        f.current_naics_code,
        f.naics_confidence,
        f.naics_platform_id,
        f.naics_override_raw,
        f.current_mcc_code,
        f.ai_enrichment_confidence,
        -- Pipeline B
        p.pipeline_b_naics,
        p.pipeline_b_mcc,
        p.match_confidence,
        -- Match confidences
        COALESCE(zc.zi_match_confidence,  0.0) AS zi_match_confidence,
        COALESCE(ec.efx_match_confidence, 0.0) AS efx_match_confidence,
        COALESCE(oc.oc_match_confidence,  0.0) AS oc_match_confidence,
        -- ZoomInfo NAICS signals (primary + top3 + SIC top3)
        zi.zi_c_naics6,
        zi.zi_c_naics4,
        zi.zi_c_naics2,
        zi.zi_c_naics_top3,
        zi.zi_c_sic4,
        zi.zi_c_sic_top3,
        zi.zi_c_naics_confidence_score,
        zi.zi_c_total_employee_count,
        zi.zi_c_annual_revenue,
        zi.zi_state             AS zi_state,
        -- Equifax NAICS signals (primary + 4 secondary + SIC secondary)
        efx.efx_naics_primary,
        efx.efx_naics_secondary_1,
        efx.efx_naics_secondary_2,
        efx.efx_naics_secondary_3,
        efx.efx_naics_secondary_4,
        efx.efx_sic_primary,
        efx.efx_sic_secondary_1,
        efx.efx_sic_secondary_2,
        efx.efx_employee_count,
        efx.efx_annual_sales,
        efx.efx_state,
        -- OC industry codes (full pipe-delimited string — parsed in Python)
        oc2.oc_industry_code_uids,
        oc2.oc_jurisdiction_code
    FROM facts_cte f
    LEFT JOIN pipeb_cte     p   ON p.business_id  = f.business_id
    LEFT JOIN zi_conf_cte   zc  ON zc.business_id = f.business_id
    LEFT JOIN efx_conf_cte  ec  ON ec.business_id = f.business_id
    LEFT JOIN oc_conf_cte   oc  ON oc.business_id = f.business_id
    LEFT JOIN zi_naics_cte  zi  ON zi.business_id = f.business_id
    LEFT JOIN efx_naics_cte efx ON efx.business_id= f.business_id
    LEFT JOIN oc_naics_cte  oc2 ON oc2.business_id= f.business_id
    {limit_clause}
    """

    logger.info("Running master Redshift query (all joins server-side)...")
    pdf = redshift_query(sql_master).to_pandas()
    logger.info("Master query returned %d rows", len(pdf))

    # ── Parse OC industry_code_uids in Python ─────────────────────────────────
    # Full pipe-delimited string: "us_naics-541110|gb_sic-62012|nace-J6201"
    def _parse_oc_naics(s):
        if not s: return ""
        m = _US_NAICS_RE.search(str(s))
        return m.group(1) if m else ""

    def _parse_oc_gb_sic(s):
        if not s: return ""
        m = _GB_SIC_RE.search(str(s))
        return m.group(1) if m else ""

    pdf["oc_naics_primary"] = pdf["oc_industry_code_uids"].apply(_parse_oc_naics)
    pdf["oc_gb_sic"]        = pdf["oc_industry_code_uids"].apply(_parse_oc_gb_sic)
    pdf["oc_naics_sector"]  = pdf["oc_naics_primary"].str[:2]

    # ── Parse ZI top-3 NAICS and SIC (pipe-delimited: "722511|722513|722515") ─
    def _split_top3(s, idx):
        """Return the idx-th code from a pipe-delimited top-3 string."""
        if not s or str(s).strip() == "": return ""
        parts = str(s).split("|")
        return parts[idx].strip() if idx < len(parts) else ""

    pdf["zi_c_naics_top3_1"] = pdf["zi_c_naics_top3"].apply(lambda x: _split_top3(x, 0))
    pdf["zi_c_naics_top3_2"] = pdf["zi_c_naics_top3"].apply(lambda x: _split_top3(x, 1))
    pdf["zi_c_naics_top3_3"] = pdf["zi_c_naics_top3"].apply(lambda x: _split_top3(x, 2))
    pdf["zi_c_sic_top3_1"]   = pdf["zi_c_sic_top3"].apply(lambda x: _split_top3(x, 0))
    pdf["zi_c_sic_top3_2"]   = pdf["zi_c_sic_top3"].apply(lambda x: _split_top3(x, 1))
    pdf["zi_c_naics_sector"]  = pdf["zi_c_naics6"].fillna("").str[:2]

    # ── Step 6: Assign labels ─────────────────────────────────────────────────

    # ── Label assignment ──────────────────────────────────────────────────────
    # Start with current Pipeline A NAICS as candidate label.
    # Null/empty means the system has no code at all — treat same as 561499.
    pdf["label_naics6"] = (
        pdf["current_naics_code"]
        .fillna(NAICS_FALLBACK)
        .replace("", NAICS_FALLBACK)
    )

    # Upgrade label to Pipeline B when confidence is high and code is real
    # Pipeline B winner uses match_confidence (not zi/efx separately)
    match_conf = pd.to_numeric(pdf.get("match_confidence", 0), errors="coerce").fillna(0)
    mask_pipeB = (
        pdf["pipeline_b_naics"].notna()
        & (pdf["pipeline_b_naics"] != NAICS_FALLBACK)
        & (pdf["pipeline_b_naics"] != "")
        & (match_conf >= 0.80)
    )
    pdf.loc[mask_pipeB, "label_naics6"] = pdf.loc[mask_pipeB, "pipeline_b_naics"]

    # Mark rows where the label is still the fallback code (our target set)
    # These are the businesses the model aims to reclassify.
    pdf["is_fallback"] = (
        pdf["label_naics6"].isna()
        | (pdf["label_naics6"] == "")
        | (pdf["label_naics6"] == NAICS_FALLBACK)
    ).astype(int)

    # ── MCC label: use crosswalk to derive from NAICS ─────────────────────────
    crosswalk = load_naics_mcc_crosswalk()
    naics_to_mcc = crosswalk.set_index("naics_code")["mcc_code"].to_dict() if len(crosswalk) else {}
    pdf["label_mcc"] = (
        pdf["current_mcc_code"]
        .where(
            pdf["current_mcc_code"].notna()
            & (pdf["current_mcc_code"] != "")
            & (pdf["current_mcc_code"] != MCC_FALLBACK)
        )
        # Also use Pipeline B mcc_code when available and non-fallback
        .fillna(
            pdf.get("pipeline_b_mcc", pd.Series(dtype=str))
            .where(
                pdf.get("pipeline_b_mcc", pd.Series(dtype=str)).notna()
                & (pdf.get("pipeline_b_mcc", pd.Series(dtype=str)) != "")
                & (pdf.get("pipeline_b_mcc", pd.Series(dtype=str)) != MCC_FALLBACK)
            )
        )
        # Derive from NAICS crosswalk as next best
        .fillna(pdf["label_naics6"].map(naics_to_mcc))
        .fillna(MCC_FALLBACK)
    )

    # ── Step 7: Split ─────────────────────────────────────────────────────────
    train_df    = pdf[pdf["is_fallback"] == 0].copy()
    fallback_df = pdf[pdf["is_fallback"] == 1].copy()

    logger.info(
        "Dataset built: %d total | %d training (non-fallback) | %d fallback (561499)",
        len(pdf), len(train_df), len(fallback_df)
    )

    if limit:
        train_df    = train_df.sample(min(limit, len(train_df)), random_state=42)
        fallback_df = fallback_df.sample(min(limit // 5, len(fallback_df)), random_state=42)

    return train_df, fallback_df


# ═════════════════════════════════════════════════════════════════════════════
# 7. SYNTHETIC DATA (development / CI — no Redshift needed)
# ═════════════════════════════════════════════════════════════════════════════

_SYNTHETIC_NAICS = [
    ("722511", "5812", "Full-Service Restaurants"),
    ("812113", "7230", "Nail Salons"),
    ("541511", "7372", "Custom Computer Programming"),
    ("238210", "1731", "Electrical Contractors"),
    ("621111", "8011", "Offices of Physicians"),
    ("441110", "5511", "New Car Dealers"),
    ("531110", "6512", "Lessors of Residential Buildings"),
    ("561720", "7349", "Janitorial Services"),
    ("722513", "5812", "Limited-Service Restaurants"),
    ("811111", "7538", "General Automotive Repair"),
    ("541219", "8999", "Other Accounting Services"),
    ("448110", "5611", "Men's Clothing Stores"),
    ("454110", "5999", "Electronic Shopping"),
    ("621210", "8021", "Offices of Dentists"),
    ("623110", "8049", "Nursing Care Facilities"),
]

_FALLBACK_NAMES = [
    ("Acme Holdings LLC", "NJ"),
    ("Global Investment Partners Inc", "NY"),
    ("Premier Business Solutions Corp", "CA"),
    ("Universal Services Group", "TX"),
    ("Strategic Capital Management", "FL"),
]


def _generate_synthetic_dataset(n: int = 10_000) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generates realistic synthetic data for development and CI.
    Schema mirrors the output of build_training_dataset() exactly.
    """
    rng = np.random.default_rng(42)
    n_fallback = n // 5

    def _make_block(size: int, is_fallback: bool) -> pd.DataFrame:
        rows = []
        for _ in range(size):
            naics_code, mcc_code, _ = _SYNTHETIC_NAICS[rng.integers(len(_SYNTHETIC_NAICS))]
            zi_conf  = float(rng.uniform(0.6, 1.0))
            efx_conf = float(rng.uniform(0.5, 0.95))
            oc_conf  = float(rng.uniform(0.4, 0.90))

            if is_fallback:
                label_naics = NAICS_FALLBACK
                label_mcc   = MCC_FALLBACK
                ai_conf     = "LOW"
                zi_naics    = ""
                efx_naics   = ""
                name, state = _FALLBACK_NAMES[rng.integers(len(_FALLBACK_NAMES))]
                zi_conf = efx_conf = oc_conf = float(rng.uniform(0.1, 0.4))
            else:
                label_naics = naics_code
                label_mcc   = mcc_code
                ai_conf     = rng.choice(["HIGH", "MED", "LOW"], p=[0.5, 0.35, 0.15])
                zi_naics    = naics_code
                efx_naics   = naics_code
                name        = f"Business {rng.integers(1, 999999)}"
                state       = rng.choice(["NJ", "NY", "CA", "TX", "FL", "OH", "PA"])

            rows.append(dict(
                business_id              = str(rng.integers(10**12, 10**13)),
                current_naics_code       = label_naics,
                current_mcc_code         = label_mcc,
                label_naics6             = label_naics,
                label_mcc                = label_mcc,
                is_fallback              = int(is_fallback),
                naics_confidence         = float(rng.uniform(0.3, 0.95)),
                naics_platform_id        = str(rng.integers(16, 32)),
                has_analyst_override     = 0,
                ai_enrichment_confidence = ai_conf,
                ai_naics_is_fallback     = int(is_fallback),
                ai_mcc_is_fallback       = int(is_fallback),
                zi_match_confidence      = zi_conf,
                efx_match_confidence     = efx_conf,
                oc_match_confidence      = oc_conf,
                has_zi_match             = int(not is_fallback),
                has_efx_match            = int(not is_fallback),
                has_oc_match             = int(not is_fallback),
                pipeline_b_naics         = label_naics if not is_fallback else "",
                match_confidence         = max(zi_conf, efx_conf),
                zi_c_naics6              = zi_naics,
                zi_c_naics4              = zi_naics[:4] if zi_naics else "",
                zi_c_naics2              = zi_naics[:2] if zi_naics else "",
                zi_c_naics_confidence_score = zi_conf if zi_naics else np.nan,
                zi_c_sic4                = str(rng.integers(1000, 9999)),
                zi_c_total_employee_count= int(rng.integers(1, 5000)),
                zi_c_annual_revenue      = int(rng.integers(50_000, 50_000_000)),
                efx_naics_primary        = efx_naics,
                efx_naics_secondary_1    = efx_naics if not is_fallback else "",
                efx_naics_secondary_2    = "",
                efx_sic_primary          = str(rng.integers(1000, 9999)),
                efx_employee_count       = int(rng.integers(1, 5000)),
                efx_annual_sales         = int(rng.integers(50_000, 50_000_000)),
                oc_naics_primary         = label_naics if not is_fallback else "",
                oc_naics_sector          = label_naics[:2] if not is_fallback else "",
                business_name            = name,
                state                    = state,
                country_code             = "US",
                ai_reasoning             = "",
                ai_website_summary       = "",
            ))
        return pd.DataFrame(rows)

    train_df    = _make_block(n, is_fallback=False)
    fallback_df = _make_block(n_fallback, is_fallback=True)
    logger.info("[SYNTHETIC] %d training rows + %d fallback rows", len(train_df), len(fallback_df))
    return train_df, fallback_df
