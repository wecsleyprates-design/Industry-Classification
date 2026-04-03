"""
naics_mcc_classifier/data_loader.py
=====================================
Pulls all raw data needed to train and evaluate the NAICS/MCC classifier.

Data sources (all verified against SIC-UK-Codes source):
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Source             │ Redshift table                      │ Key cols  │
  ├─────────────────────────────────────────────────────────────────────┤
  │ ZoomInfo           │ datascience.zoominfo_standard_ml_2  │ zi_c_naics6, zi_c_naics_confidence_score │
  │ Equifax            │ warehouse.equifax_us_standardized   │ efx_primnaicscode, efx_primsic, efx_secnaics1-4 │
  │ OpenCorporates     │ datascience.open_corporates_standard_ml_2 │ industry_code_uids │
  │ ZI match table     │ datascience.zoominfo_matches_custom_inc_ml │ zi_match_confidence │
  │ EFX match table    │ datascience.efx_matches_custom_inc_ml │ efx_match_confidence │
  │ OC match table     │ datascience.oc_matches_custom_inc_ml │ oc_match_confidence │
  │ Pipeline B winner  │ datascience.customer_files          │ primary_naics_code (current production code) │
  │ AI enrichment facts│ rds_warehouse_public.facts          │ naics_code, mcc_code (incl. 561499/5614) │
  │ Case-service PG    │ public.core_naics_code              │ NAICS → label mapping │
  │ Case-service PG    │ public.core_mcc_code                │ MCC → label mapping  │
  │ Case-service PG    │ public.rel_naics_mcc                │ NAICS → MCC crosswalk │
  └─────────────────────────────────────────────────────────────────────┘

Labeling strategy:
  A training row is labeled with the best available NAICS code:
  1. Analyst override (stored in facts with override.value != null)
  2. Vendor consensus: ≥ MIN_VENDOR_AGREEMENT sources agree on 2-digit sector
     → use highest-confidence vendor's 6-digit code
  3. Single high-confidence vendor (match_confidence ≥ 0.85)
  4. Rows that only have 561499 are used as the *test/evaluation set*
     to measure how many we can now classify correctly.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

import numpy as np
import pandas as pd

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False

from .config import (
    REDSHIFT, CASESERVICE_PG, TABLES, PG_TABLES,
    NAICS_FALLBACK, MCC_FALLBACK, MIN_VENDOR_AGREEMENT,
    BUSINESS_ID_COL, NAICS_LABEL_COL, MCC_LABEL_COL,
)

logger = logging.getLogger(__name__)

# ── OC industry_code_uids regex ───────────────────────────────────────────────
_US_NAICS_RE = re.compile(r"us_naics-(\d{6})")
_GB_SIC_RE   = re.compile(r"gb_sic-(\d+)")


def _connect_redshift():
    if not HAS_PSYCOPG2:
        raise ImportError("psycopg2-binary is required. pip install psycopg2-binary")
    return psycopg2.connect(**REDSHIFT)


def _connect_pg():
    if not HAS_PSYCOPG2:
        raise ImportError("psycopg2-binary is required. pip install psycopg2-binary")
    return psycopg2.connect(**CASESERVICE_PG)


def _query_redshift(sql: str, params=None) -> pd.DataFrame:
    """Execute SQL against Redshift and return a DataFrame."""
    with _connect_redshift() as conn:
        return pd.read_sql(sql, conn, params=params)


def _query_pg(sql: str) -> pd.DataFrame:
    """Execute SQL against case-service PostgreSQL and return a DataFrame."""
    with _connect_pg() as conn:
        return pd.read_sql(sql, conn)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Load reference tables (NAICS codes, MCC codes, crosswalk)
# ─────────────────────────────────────────────────────────────────────────────

def load_naics_lookup() -> pd.DataFrame:
    """
    Returns: business_id → naics_code, naics_label, naics_sector (2-digit)
    Source: case-service PostgreSQL, public.core_naics_code
    """
    sql = f"""
    SELECT
        id         AS naics_id,
        code       AS naics_code,
        label      AS naics_label
    FROM {PG_TABLES['core_naics']}
    ORDER BY code
    """
    df = _query_pg(sql)
    df["naics_sector"] = df["naics_code"].astype(str).str[:2]
    df["naics_group"]  = df["naics_code"].astype(str).str[:4]
    logger.info("Loaded %d NAICS codes from core_naics_code", len(df))
    return df


def load_mcc_lookup() -> pd.DataFrame:
    """
    Returns MCC codes with labels.
    Source: case-service PostgreSQL, public.core_mcc_code
    """
    sql = f"""
    SELECT id AS mcc_id, code AS mcc_code, label AS mcc_label
    FROM {PG_TABLES['core_mcc']}
    ORDER BY code
    """
    df = _query_pg(sql)
    logger.info("Loaded %d MCC codes", len(df))
    return df


def load_naics_mcc_crosswalk() -> pd.DataFrame:
    """
    Returns NAICS → MCC mapping.
    Source: case-service PostgreSQL, public.rel_naics_mcc
    """
    sql = f"""
    SELECT
        nc.code AS naics_code,
        mc.code AS mcc_code
    FROM {PG_TABLES['rel_naics_mcc']} rm
    JOIN {PG_TABLES['core_naics']} nc ON nc.id = rm.naics_id
    JOIN {PG_TABLES['core_mcc']}   mc ON mc.id = rm.mcc_id
    """
    df = _query_pg(sql)
    logger.info("Loaded %d NAICS→MCC crosswalk rows", len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 2. Load current production NAICS/MCC (Pipeline B winner + AI enrichment)
# ─────────────────────────────────────────────────────────────────────────────

def load_production_naics() -> pd.DataFrame:
    """
    Current NAICS and MCC codes as stored by Pipeline A (Fact Engine winners).
    Source: rds_warehouse_public.facts (Redshift mirror)
    Includes the confidence field from the winning source.

    Key column: ai_naics_is_fallback = 1 when the current code is 561499
    """
    sql = f"""
    SELECT
        f_naics.business_id,
        f_naics.value::json->>'code'                  AS current_naics_code,
        f_naics.value::json->'source'->>'confidence'  AS naics_confidence,
        f_naics.value::json->'source'->>'platformId'  AS naics_platform_id,
        f_naics.value::json->>'override'              AS naics_override_raw,
        f_naics.received_at                           AS naics_updated_at,
        f_mcc.value::json->>'code'                    AS current_mcc_code,
        f_mcc.value::json->'source'->>'confidence'    AS mcc_confidence,
        f_ai.value::json->>'confidence'               AS ai_enrichment_confidence,
        f_ai.value::json->>'reasoning'                AS ai_reasoning,
        f_ai.value::json->>'website_summary'          AS ai_website_summary
    FROM {TABLES['facts']} f_naics
    LEFT JOIN {TABLES['facts']} f_mcc
        ON  f_mcc.business_id = f_naics.business_id
        AND f_mcc.name        = 'mcc_code'
    LEFT JOIN {TABLES['facts']} f_ai
        ON  f_ai.business_id = f_naics.business_id
        AND f_ai.name        = 'ai_naics_enrichment_metadata'
    WHERE f_naics.name = 'naics_code'
    """
    df = _query_redshift(sql)
    df["ai_naics_is_fallback"] = (df["current_naics_code"] == NAICS_FALLBACK).astype(int)
    df["ai_mcc_is_fallback"]   = (df["current_mcc_code"]   == MCC_FALLBACK).astype(int)
    df["has_analyst_override"] = (
        df["naics_override_raw"].notna() & (df["naics_override_raw"] != "null")
    ).astype(int)
    df["naics_confidence"] = pd.to_numeric(df["naics_confidence"], errors="coerce")
    logger.info(
        "Loaded %d production NAICS records  (fallback count: %d, %.1f%%)",
        len(df),
        df["ai_naics_is_fallback"].sum(),
        100 * df["ai_naics_is_fallback"].mean(),
    )
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 3. Load vendor NAICS signals
# ─────────────────────────────────────────────────────────────────────────────

def load_zoominfo_signals() -> pd.DataFrame:
    """
    ZoomInfo NAICS, SIC, and confidence data.
    Source: datascience.zoominfo_standard_ml_2

    Key columns:
      zi_c_naics6              — 6-digit NAICS primary code
      zi_c_naics4, zi_c_naics2 — sector codes
      zi_c_naics_confidence_score — ZI's own confidence (0-1 or null)
      zi_c_sic4               — 4-digit SIC
    """
    sql = f"""
    SELECT
        zi_c_company_id || '|' || zi_c_location_id AS zi_key,
        zi_c_naics6,
        zi_c_naics4,
        zi_c_naics2,
        zi_c_naics_confidence_score,
        zi_c_sic4,
        zi_c_total_employee_count,
        zi_c_annual_revenue,
        zi_c_name,
        COALESCE(zi_eng_state, 'MISSING') AS state,
        country_code
    FROM {TABLES['zi_source']}
    WHERE zi_c_naics6 IS NOT NULL
      AND zi_c_naics6 != ''
    """
    df = _query_redshift(sql)
    df["zi_c_naics6"] = df["zi_c_naics6"].astype(str).str.strip()
    df["zi_c_naics_confidence_score"] = pd.to_numeric(
        df["zi_c_naics_confidence_score"], errors="coerce"
    )
    logger.info("Loaded %d ZoomInfo records with NAICS", len(df))
    return df


def load_equifax_signals() -> pd.DataFrame:
    """
    Equifax primary and secondary NAICS + SIC.
    Source: warehouse.equifax_us_standardized

    Key columns:
      efx_primnaicscode      — primary 6-digit NAICS
      efx_secnaics1-4        — secondary NAICS codes
      efx_primsic            — primary 4-digit SIC
    """
    sql = f"""
    SELECT
        CAST(efx_id AS VARCHAR)  AS efx_id,
        efx_name,
        COALESCE(UPPER(TRIM(efx_eng_state)), 'MISSING') AS state,
        CAST(efx_primnaicscode AS VARCHAR) AS efx_naics_primary,
        CAST(efx_secnaics1     AS VARCHAR) AS efx_naics_secondary_1,
        CAST(efx_secnaics2     AS VARCHAR) AS efx_naics_secondary_2,
        CAST(efx_secnaics3     AS VARCHAR) AS efx_naics_secondary_3,
        CAST(efx_secnaics4     AS VARCHAR) AS efx_naics_secondary_4,
        CAST(efx_primsic       AS VARCHAR) AS efx_sic_primary,
        efx_primnaicsdesc      AS efx_naics_primary_desc,
        efx_employees          AS efx_employee_count,
        efx_annual_sales       AS efx_annual_sales
    FROM {TABLES['efx_source']}
    WHERE efx_primnaicscode IS NOT NULL
      AND efx_primnaicscode != 0
    """
    df = _query_redshift(sql)
    # Pad NAICS to 6 digits
    for col in ["efx_naics_primary","efx_naics_secondary_1","efx_naics_secondary_2",
                "efx_naics_secondary_3","efx_naics_secondary_4"]:
        df[col] = df[col].fillna("").str.strip().str.zfill(6).replace("000000", "")
    df["efx_naics_sector"] = df["efx_naics_primary"].str[:2]
    df["efx_employee_count"] = pd.to_numeric(df["efx_employee_count"], errors="coerce").fillna(0)
    df["efx_annual_sales"]   = pd.to_numeric(df["efx_annual_sales"], errors="coerce").fillna(0)
    logger.info("Loaded %d Equifax records with NAICS", len(df))
    return df


def load_oc_signals() -> pd.DataFrame:
    """
    OpenCorporates industry_code_uids — parses NAICS and UK SIC codes.
    Source: datascience.open_corporates_standard_ml_2

    industry_code_uids format: "us_naics-541110|gb_sic-62012|nace-J6201"
    We parse us_naics- entries for NAICS and gb_sic- for UK SIC.
    """
    sql = f"""
    SELECT
        company_number || '|' || jurisdiction_code AS oc_key,
        company_name,
        industry_code_uids,
        jurisdiction_code,
        UPPER(TRIM(region))  AS state
    FROM {TABLES['oc_source']}
    WHERE industry_code_uids IS NOT NULL
      AND industry_code_uids != ''
    """
    df = _query_redshift(sql)

    # Parse NAICS from industry_code_uids
    def parse_us_naics(uid_string: str) -> str:
        if not uid_string:
            return ""
        m = _US_NAICS_RE.search(uid_string)
        return m.group(1) if m else ""

    def parse_gb_sic(uid_string: str) -> str:
        if not uid_string:
            return ""
        m = _GB_SIC_RE.search(uid_string)
        return m.group(1) if m else ""

    df["oc_naics_primary"] = df["industry_code_uids"].apply(parse_us_naics)
    df["oc_gb_sic"]        = df["industry_code_uids"].apply(parse_gb_sic)
    df["oc_naics_sector"]  = df["oc_naics_primary"].str[:2]

    df_with_naics = df[df["oc_naics_primary"] != ""].copy()
    logger.info(
        "Loaded %d OC records total; %d have a parseable US NAICS",
        len(df), len(df_with_naics)
    )
    return df_with_naics


def load_entity_match_confidences() -> pd.DataFrame:
    """
    Load entity-matching confidence scores from XGBoost model outputs.
    Sources:
      datascience.zoominfo_matches_custom_inc_ml  → zi_match_confidence
      datascience.efx_matches_custom_inc_ml       → efx_match_confidence
      datascience.oc_matches_custom_inc_ml        → oc_match_confidence

    These are the same outputs that feed Pipeline B customer_table.sql
    and the Fact Engine confidence scores in Pipeline A.
    """
    sql_zi = f"""
    SELECT
        business_id,
        zi_match_confidence,
        zi_c_company_id,
        zi_c_location_id
    FROM {TABLES['zi_matches']}
    WHERE zi_match_confidence IS NOT NULL
    """
    sql_efx = f"""
    SELECT
        business_id,
        efx_match_confidence,
        efx_id
    FROM {TABLES['efx_matches']}
    WHERE efx_match_confidence IS NOT NULL
    """
    sql_oc = f"""
    SELECT
        business_id,
        oc_match_confidence,
        oc_company_number,
        oc_jurisdiction_code
    FROM {TABLES['oc_matches']}
    WHERE oc_match_confidence IS NOT NULL
    """
    df_zi  = _query_redshift(sql_zi)
    df_efx = _query_redshift(sql_efx)
    df_oc  = _query_redshift(sql_oc)

    df = (
        df_zi
        .merge(df_efx, on="business_id", how="outer")
        .merge(df_oc,  on="business_id", how="outer")
    )
    for col in ["zi_match_confidence", "efx_match_confidence", "oc_match_confidence"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    df["has_zi_match"]  = (df["zi_match_confidence"]  > 0).astype(int)
    df["has_efx_match"] = (df["efx_match_confidence"] > 0).astype(int)
    df["has_oc_match"]  = (df["oc_match_confidence"]  > 0).astype(int)
    logger.info("Loaded entity-match confidences for %d businesses", len(df))
    return df


def load_customer_files_naics() -> pd.DataFrame:
    """
    Pipeline B winner — the ZI vs EFX rule output.
    Source: datascience.customer_files

    This is the NAICS code produced by:
      WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6
      ELSE efx_primnaicscode

    Used as an additional training signal (strong when confidence is high).
    """
    sql = f"""
    SELECT
        business_id,
        primary_naics_code      AS pipeline_b_naics,
        zi_match_confidence,
        efx_match_confidence,
        GREATEST(zi_match_confidence, efx_match_confidence) AS match_confidence
    FROM {TABLES['customer_files']}
    WHERE primary_naics_code IS NOT NULL
      AND primary_naics_code != 0
    """
    df = _query_redshift(sql)
    df["pipeline_b_naics"] = df["pipeline_b_naics"].astype(str).str.strip().str.zfill(6)
    df["pipeline_b_sector"] = df["pipeline_b_naics"].str[:2]
    logger.info("Loaded %d Pipeline B NAICS records", len(df))
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 4. Build the master joined dataset
# ─────────────────────────────────────────────────────────────────────────────

def build_training_dataset(
    limit: Optional[int] = None,
    use_synthetic: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Joins all sources and produces a labeled DataFrame ready for feature engineering.

    Returns:
        train_df  — rows with a reliable NAICS label (ground truth)
        fallback_df — rows currently classified as 561499 (evaluation set)

    Labeling priority:
      1. Analyst override (has_analyst_override == 1)
      2. Vendor consensus (≥ MIN_VENDOR_AGREEMENT sources agree on 2-digit sector)
      3. High-confidence single vendor (match_confidence ≥ 0.85)
      4. Pipeline B winner when match_confidence ≥ 0.80

    Rows that don't meet any criterion above become the fallback_df.
    """
    if use_synthetic:
        logger.warning(
            "use_synthetic=True: generating synthetic data for development. "
            "Set use_synthetic=False when Redshift is accessible."
        )
        return _generate_synthetic_dataset(n=limit or 10_000)

    logger.info("Loading production facts (current NAICS/MCC codes)...")
    prod = load_production_naics()

    logger.info("Loading entity-match confidences...")
    conf = load_entity_match_confidences()

    logger.info("Loading Pipeline B winner codes...")
    pipeB = load_customer_files_naics()

    # Merge on business_id
    df = (
        prod
        .merge(conf,  on="business_id", how="left")
        .merge(pipeB, on="business_id", how="left")
    )

    # ── Assign labels ─────────────────────────────────────────────────────────
    # Start with current_naics_code as the candidate label
    df["label_naics6"] = df["current_naics_code"]

    # Override with Pipeline B when it's a non-fallback code AND confidence is high
    mask_pipeB = (
        df["pipeline_b_naics"].notna() &
        (df["pipeline_b_naics"] != NAICS_FALLBACK) &
        (df["match_confidence"] >= 0.80)
    )
    df.loc[mask_pipeB, "label_naics6"] = df.loc[mask_pipeB, "pipeline_b_naics"]

    # If analyst set an override, that wins unconditionally
    # (override is embedded in current_naics_code by the Fact Engine)
    # We just keep current_naics_code in that case.

    # Mark rows where label is fallback
    df["is_fallback"] = (df["label_naics6"] == NAICS_FALLBACK).astype(int)

    # ── MCC label via crosswalk ───────────────────────────────────────────────
    crosswalk = load_naics_mcc_crosswalk()
    naics_to_mcc = crosswalk.set_index("naics_code")["mcc_code"].to_dict()
    df["label_mcc"] = (
        df["current_mcc_code"]
        .where(df["current_mcc_code"] != MCC_FALLBACK)
        .fillna(df["label_naics6"].map(naics_to_mcc))
        .fillna(MCC_FALLBACK)
    )

    logger.info(
        "Built master dataset: %d rows total, %d labeled (non-fallback), %d fallback",
        len(df),
        (df["is_fallback"] == 0).sum(),
        df["is_fallback"].sum(),
    )

    train_df    = df[df["is_fallback"] == 0].copy()
    fallback_df = df[df["is_fallback"] == 1].copy()

    if limit:
        train_df    = train_df.sample(min(limit, len(train_df)), random_state=42)
        fallback_df = fallback_df.sample(min(limit // 5, len(fallback_df)), random_state=42)

    return train_df, fallback_df


# ─────────────────────────────────────────────────────────────────────────────
# 5. Synthetic data generator (for development without Redshift access)
# ─────────────────────────────────────────────────────────────────────────────

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


def _generate_synthetic_dataset(
    n: int = 10_000,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generates realistic synthetic data for development and CI.
    Mirrors the schema of build_training_dataset() output.
    """
    rng = np.random.default_rng(42)
    n_fallback = n // 5

    def _make_block(size: int, is_fallback: bool) -> pd.DataFrame:
        naics_pool = _SYNTHETIC_NAICS
        rows = []
        for _ in range(size):
            naics_code, mcc_code, desc = naics_pool[rng.integers(len(naics_pool))]
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
            else:
                label_naics = naics_code
                label_mcc   = mcc_code
                ai_conf     = rng.choice(["HIGH", "MED", "LOW"], p=[0.5, 0.35, 0.15])
                zi_naics    = naics_code
                efx_naics   = naics_code
                name        = f"Business {rng.integers(1, 999999)}"
                state       = rng.choice(["NJ", "NY", "CA", "TX", "FL", "OH", "PA"])

            rows.append(dict(
                business_id             = str(rng.integers(10**12, 10**13)),
                current_naics_code      = label_naics,
                current_mcc_code        = label_mcc,
                label_naics6            = label_naics,
                label_mcc               = label_mcc,
                is_fallback             = int(is_fallback),
                naics_confidence        = float(rng.uniform(0.3, 0.95)),
                naics_platform_id       = str(rng.integers(16, 32)),
                has_analyst_override    = 0,
                ai_enrichment_confidence= ai_conf,
                zi_match_confidence     = zi_conf if not is_fallback else float(rng.uniform(0.1, 0.5)),
                efx_match_confidence    = efx_conf if not is_fallback else float(rng.uniform(0.1, 0.5)),
                oc_match_confidence     = oc_conf  if not is_fallback else float(rng.uniform(0.1, 0.5)),
                has_zi_match            = 1 if not is_fallback else 0,
                has_efx_match           = 1 if not is_fallback else 0,
                has_oc_match            = 1 if not is_fallback else 0,
                pipeline_b_naics        = label_naics if not is_fallback else "",
                match_confidence        = max(zi_conf, efx_conf),
                # Vendor NAICS signals (raw, to be feature-engineered)
                zi_c_naics6             = zi_naics,
                zi_c_naics4             = zi_naics[:4] if zi_naics else "",
                zi_c_naics2             = zi_naics[:2] if zi_naics else "",
                zi_c_naics_confidence_score = zi_conf if zi_naics else np.nan,
                zi_c_sic4               = str(rng.integers(1000, 9999)),
                zi_c_total_employee_count = int(rng.integers(1, 5000)),
                zi_c_annual_revenue     = int(rng.integers(50_000, 50_000_000)),
                efx_naics_primary       = efx_naics,
                efx_naics_secondary_1   = efx_naics if not is_fallback else "",
                efx_naics_secondary_2   = "",
                efx_sic_primary         = str(rng.integers(1000, 9999)),
                efx_employee_count      = int(rng.integers(1, 5000)),
                efx_annual_sales        = int(rng.integers(50_000, 50_000_000)),
                oc_naics_primary        = label_naics if not is_fallback else "",
                oc_naics_sector         = label_naics[:2] if not is_fallback else "",
                # Business metadata
                business_name           = name,
                state                   = state,
                country_code            = "US",
                ai_reasoning            = "" if is_fallback else f"Business description for {name}",
                ai_website_summary      = "" if is_fallback else f"Website content for {name}",
            ))
        return pd.DataFrame(rows)

    train_df    = _make_block(n, is_fallback=False)
    fallback_df = _make_block(n_fallback, is_fallback=True)

    logger.info(
        "[SYNTHETIC] Generated %d training rows + %d fallback rows",
        len(train_df), len(fallback_df)
    )
    return train_df, fallback_df
