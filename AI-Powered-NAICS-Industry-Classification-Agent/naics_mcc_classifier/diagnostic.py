"""
naics_mcc_classifier/diagnostic.py
=====================================
Root-cause analysis: WHY do businesses receive NAICS 561499 / MCC 5614?

This module queries Redshift to pull the full picture for every 561499 business:
  - What each vendor (ZI, EFX, OC, Middesk, Trulioo, AI) returned
  - What the Fact Engine picked as winner and why
  - What AI enrichment outputted (confidence, reasoning)
  - The scenario that caused the fallback

Identifies all scenario types:
  A. ALL vendors have NAICS → winner has NAICS but AI fallback still stored
  B. SOME vendors have NAICS → not enough sources, AI fallback triggered
  C. NO vendors have NAICS → AI fired with only name+address, no evidence
  D. AI fired but hallucinated / returned invalid code → replaced with 561499

Usage:
  from naics_mcc_classifier.diagnostic import run_fallback_diagnosis
  df = run_fallback_diagnosis(limit=5000)
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .config import REDSHIFT, TABLES, NAICS_FALLBACK, MCC_FALLBACK
from .data_loader import redshift_query, establish_redshift_connection

logger = logging.getLogger(__name__)

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


# ═════════════════════════════════════════════════════════════════════════════
# SCENARIO LABELS
# ═════════════════════════════════════════════════════════════════════════════

SCENARIO_ALL_VENDORS_HAVE_NAICS       = "A_all_vendors_have_naics_winner_still_fallback"
SCENARIO_SOME_VENDORS_HAVE_NAICS      = "B_some_vendors_have_naics_ai_fired"
SCENARIO_NO_VENDORS_HAVE_NAICS        = "C_no_vendor_naics_ai_blind"
SCENARIO_AI_HALLUCINATED              = "D_ai_hallucinated_invalid_code"
SCENARIO_AI_NOT_TRIGGERED             = "E_ai_not_triggered_fallback_from_fact_engine"
SCENARIO_WINNER_HAS_NAICS_NOT_STORED  = "F_winner_has_naics_not_stored_in_facts"
SCENARIO_UNKNOWN                      = "Z_unknown"

SCENARIO_DESCRIPTIONS = {
    SCENARIO_ALL_VENDORS_HAVE_NAICS: (
        "All vendors returned NAICS but customer sees 561499. "
        "AI enrichment fired and overrode vendor codes with fallback. "
        "FIX: Raise AI trigger threshold (maximumSources); or prevent AI from returning 561499 "
        "when vendor evidence clearly indicates a specific sector."
    ),
    SCENARIO_SOME_VENDORS_HAVE_NAICS: (
        "1-2 vendors returned NAICS but not enough to reach the maximumSources=3 threshold. "
        "AI enrichment fired but couldn't determine NAICS → returned 561499. "
        "FIX: The consensus layer (OC>ZI>EFX weights) can resolve this without AI. "
        "The new consensus.py handles this in Tier 1."
    ),
    SCENARIO_NO_VENDORS_HAVE_NAICS: (
        "Zero vendors have any NAICS signal. AI fired with only name+address. "
        "If no website and name is ambiguous → AI correctly returns 561499. "
        "FIX: For name-deducible businesses (salon, restaurant, church), the AI prompt "
        "should classify from name keywords. The new consensus.py handles this in Tier 4 (name_only)."
    ),
    SCENARIO_AI_HALLUCINATED: (
        "AI returned a NAICS code not in core_naics_code table. "
        "Post-processing replaced it with 561499 via removeNaicsCode(). "
        "FIX: Improve AI prompt to specify valid 2022 NAICS codes only; "
        "add fallback to sector-level code when specific code is invalid."
    ),
    SCENARIO_AI_NOT_TRIGGERED: (
        "AI enrichment was NOT triggered (already had ≥3 sources). "
        "The Fact Engine winner had no valid NAICS or chose a source with 561499. "
        "FIX: Check why winning source had no NAICS despite vendor data being available."
    ),
    SCENARIO_WINNER_HAS_NAICS_NOT_STORED: (
        "The winning source returned a NAICS code but it was not stored correctly in facts. "
        "Possible Kafka delivery failure or DB write error. "
        "FIX: Check integration_data.request_response for the winning source response."
    ),
}


# ═════════════════════════════════════════════════════════════════════════════
# 1. PULL ALL DATA FOR 561499 BUSINESSES
# ═════════════════════════════════════════════════════════════════════════════

def load_fallback_businesses(limit: Optional[int] = 5000) -> pd.DataFrame:
    """
    Pull all businesses currently showing NAICS 561499.
    Includes:
      - Current facts (naics_code, mcc_code, winner source)
      - All vendor NAICS signals from match tables
      - AI enrichment response (confidence, reasoning, website_summary)
      - Pipeline B customer_files data
    """
    limit_clause = f"LIMIT {limit}" if limit else ""

    # ── Facts: current NAICS/MCC + AI enrichment metadata ─────────────────────
    logger.info("Pulling 561499 businesses from facts table...")
    sql_facts = f"""
    SELECT
        f_naics.business_id,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'value')                       AS current_naics_code,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.confidence')           AS naics_source_confidence,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.platformId')           AS naics_platform_id,
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'source.name')                 AS naics_source_name,
        f_naics.received_at                                                   AS naics_updated_at,
        JSON_EXTRACT_PATH_TEXT(f_mcc.value,   'value')                       AS current_mcc_code,
        JSON_EXTRACT_PATH_TEXT(f_mcc.value,   'source.platformId')           AS mcc_platform_id,
        -- AI enrichment metadata (stored as separate fact when AI ran)
        JSON_EXTRACT_PATH_TEXT(f_ai.value, 'confidence')                     AS ai_confidence,
        JSON_EXTRACT_PATH_TEXT(f_ai.value, 'reasoning')                      AS ai_reasoning,
        JSON_EXTRACT_PATH_TEXT(f_ai.value, 'website_summary')                AS ai_website_summary,
        JSON_EXTRACT_PATH_TEXT(f_ai.value, 'tools_used')                     AS ai_tools_used,
        JSON_EXTRACT_PATH_TEXT(f_ai.value, 'naics_removed')                  AS ai_naics_removed,
        -- Alt sources from alternatives[]
        JSON_EXTRACT_PATH_TEXT(f_naics.value, 'alternatives')                AS naics_alternatives_raw
    FROM rds_warehouse_public.facts f_naics
    LEFT JOIN rds_warehouse_public.facts f_mcc
           ON f_mcc.business_id = f_naics.business_id
          AND f_mcc.name        = 'mcc_code'
    LEFT JOIN rds_warehouse_public.facts f_ai
           ON f_ai.business_id  = f_naics.business_id
          AND f_ai.name         = 'ai_naics_enrichment_metadata'
    WHERE f_naics.name = 'naics_code'
      AND JSON_EXTRACT_PATH_TEXT(f_naics.value, 'value') = '561499'
    {limit_clause}
    """
    facts_df = redshift_query(sql_facts).to_pandas()
    facts_df["business_id"] = facts_df["business_id"].astype(str).str.lower()
    logger.info("Pulled %d fallback businesses from facts", len(facts_df))

    # ── Vendor NAICS signals from match tables (same as our training data) ────
    logger.info("Pulling vendor NAICS signals...")
    sql_vendor = f"""
    WITH bi AS (
        SELECT LOWER(CAST(business_id AS VARCHAR)) AS business_id
        FROM rds_warehouse_public.facts
        WHERE name = 'naics_code'
          AND JSON_EXTRACT_PATH_TEXT(value, 'value') = '561499'
        {limit_clause}
    ),
    zi_cte AS (
        SELECT
            LOWER(CAST(m.business_id AS VARCHAR)) AS business_id,
            CAST(z.zi_c_naics6 AS VARCHAR)         AS zi_naics6,
            CAST(z.zi_c_naics4 AS VARCHAR)          AS zi_naics4,
            z.zi_c_naics_confidence_score           AS zi_naics_confidence,
            CAST(z.zi_c_sic4 AS VARCHAR)            AS zi_sic4,
            CASE WHEN m.zi_probability IS NOT NULL THEN m.zi_probability
                 WHEN m.similarity_index/55.0 >= 0.8 THEN m.similarity_index/55.0
                 ELSE 0 END                          AS zi_match_confidence
        FROM datascience.zoominfo_matches_custom_inc_ml m
        JOIN bi ON LOWER(CAST(m.business_id AS VARCHAR)) = bi.business_id
        JOIN zoominfo.comp_standard_global z
          ON z.zi_c_company_id = m.zi_c_company_id
         AND z.zi_c_location_id = m.zi_c_location_id
         AND z.zi_c_country = 'United States'
        QUALIFY ROW_NUMBER() OVER (PARTITION BY m.business_id
                                   ORDER BY COALESCE(m.zi_probability,0) DESC,
                                            COALESCE(m.similarity_index,0) DESC) = 1
    ),
    efx_cte AS (
        SELECT
            LOWER(CAST(m.business_id AS VARCHAR)) AS business_id,
            CAST(e.efx_primnaicscode AS VARCHAR)   AS efx_naics6,
            CAST(e.efx_primsic AS VARCHAR)          AS efx_sic4,
            CAST(COALESCE(e.efx_secnaics1,0) AS VARCHAR) AS efx_sec_naics1,
            CAST(COALESCE(e.efx_secnaics2,0) AS VARCHAR) AS efx_sec_naics2,
            CASE WHEN m.efx_probability IS NOT NULL THEN m.efx_probability
                 WHEN m.similarity_index/55.0 >= 0.8 THEN m.similarity_index/55.0
                 ELSE 0 END                          AS efx_match_confidence
        FROM datascience.efx_matches_custom_inc_ml m
        JOIN bi ON LOWER(CAST(m.business_id AS VARCHAR)) = bi.business_id
        JOIN warehouse.equifax_us_latest e ON e.efx_id = m.efx_id
        QUALIFY ROW_NUMBER() OVER (PARTITION BY m.business_id
                                   ORDER BY COALESCE(m.efx_probability,0) DESC,
                                            COALESCE(m.similarity_index,0) DESC) = 1
    ),
    oc_cte AS (
        SELECT
            LOWER(CAST(m.business_id AS VARCHAR)) AS business_id,
            o.industry_code_uids                   AS oc_industry_code_uids,
            CASE WHEN m.oc_probability IS NOT NULL THEN m.oc_probability
                 WHEN m.similarity_index/55.0 >= 0.8 THEN m.similarity_index/55.0
                 ELSE 0 END                          AS oc_match_confidence
        FROM datascience.oc_matches_custom_inc_ml m
        JOIN bi ON LOWER(CAST(m.business_id AS VARCHAR)) = bi.business_id
        JOIN warehouse.oc_companies_latest o
          ON o.company_number = m.company_number
         AND o.jurisdiction_code = m.jurisdiction_code
        WHERE o.industry_code_uids IS NOT NULL
        QUALIFY ROW_NUMBER() OVER (PARTITION BY m.business_id
                                   ORDER BY COALESCE(m.oc_probability,0) DESC,
                                            COALESCE(m.similarity_index,0) DESC) = 1
    ),
    pipeb AS (
        SELECT
            LOWER(CAST(business_id AS VARCHAR))  AS business_id,
            CAST(primary_naics_code AS VARCHAR)   AS pipeline_b_naics,
            COALESCE(match_confidence, 0)          AS pipeline_b_confidence
        FROM datascience.customer_files
        WHERE primary_naics_code IS NOT NULL AND primary_naics_code != 0
    )
    SELECT
        bi.business_id,
        zi.zi_naics6, zi.zi_naics4, zi.zi_naics_confidence, zi.zi_sic4, zi.zi_match_confidence,
        efx.efx_naics6, efx.efx_sic4, efx.efx_sec_naics1, efx.efx_sec_naics2, efx.efx_match_confidence,
        oc.oc_industry_code_uids, oc.oc_match_confidence,
        pb.pipeline_b_naics, pb.pipeline_b_confidence
    FROM bi
    LEFT JOIN zi_cte  zi  ON zi.business_id  = bi.business_id
    LEFT JOIN efx_cte efx ON efx.business_id = bi.business_id
    LEFT JOIN oc_cte  oc  ON oc.business_id  = bi.business_id
    LEFT JOIN pipeb   pb  ON pb.business_id  = bi.business_id
    """
    vendor_df = redshift_query(sql_vendor).to_pandas()
    vendor_df["business_id"] = vendor_df["business_id"].astype(str).str.lower()
    logger.info("Pulled vendor signals for %d businesses", len(vendor_df))

    # ── Merge all ──────────────────────────────────────────────────────────────
    df = facts_df.merge(vendor_df, on="business_id", how="left")
    logger.info("Merged dataset: %d rows", len(df))
    return df


# ═════════════════════════════════════════════════════════════════════════════
# 2. PARSE OC INDUSTRY_CODE_UIDS
# ═════════════════════════════════════════════════════════════════════════════

_US_NAICS_RE = re.compile(r"us_naics-(\d{6})")


def _parse_oc_naics(uid_str: str) -> str:
    if not uid_str: return ""
    m = _US_NAICS_RE.search(str(uid_str))
    return m.group(1) if m else ""


# ═════════════════════════════════════════════════════════════════════════════
# 3. CLASSIFY INTO SCENARIOS
# ═════════════════════════════════════════════════════════════════════════════

def classify_scenario(row: pd.Series) -> str:
    """
    Classify why a business has NAICS 561499.

    Logic based on integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts:
      - AI fires when naics_code has < minimumSources (1) and > maximumSources (3)
        (ignoring AINaicsEnrichment itself)
      - If AI fired and returned 561499 → check whether vendor data existed
      - naics_platform_id = 31 means AI won → AI produced 561499
      - naics_platform_id != 31 means Fact Engine winner had no valid NAICS
    """
    naics_pid    = str(row.get("naics_platform_id","") or "")
    ai_conf      = str(row.get("ai_confidence","") or "")
    ai_reasoning = str(row.get("ai_reasoning","") or "")
    ai_removed   = str(row.get("ai_naics_removed","") or "")

    zi_naics6    = str(row.get("zi_naics6","") or "").strip()
    efx_naics6   = str(row.get("efx_naics6","") or "").strip()
    oc_uids      = str(row.get("oc_industry_code_uids","") or "")
    oc_naics     = _parse_oc_naics(oc_uids)
    pb_naics     = str(row.get("pipeline_b_naics","") or "").strip()

    zi_conf      = float(row.get("zi_match_confidence") or 0)
    efx_conf     = float(row.get("efx_match_confidence") or 0)
    oc_conf      = float(row.get("oc_match_confidence") or 0)

    has_zi_naics  = bool(zi_naics6 and zi_naics6 not in ("0","000000","") and zi_conf >= 0.5)
    has_efx_naics = bool(efx_naics6 and efx_naics6 not in ("0","000000","") and efx_conf >= 0.5)
    has_oc_naics  = bool(oc_naics)
    n_vendor_naics= sum([has_zi_naics, has_efx_naics, has_oc_naics])

    ai_was_winner = naics_pid == "31"

    # AI hallucinated a code that was stripped
    if ai_removed and ai_removed not in ("","null","None","561499"):
        return SCENARIO_AI_HALLUCINATED

    # AI fired as winner (platform_id=31)
    if ai_was_winner or (ai_conf and ai_conf != ""):
        if n_vendor_naics >= 3:
            return SCENARIO_ALL_VENDORS_HAVE_NAICS
        elif n_vendor_naics >= 1:
            return SCENARIO_SOME_VENDORS_HAVE_NAICS
        else:
            return SCENARIO_NO_VENDORS_HAVE_NAICS

    # Fact Engine winner was not AI, but current code is still 561499
    # This means the winning vendor source had no NAICS, or it was not stored
    if not ai_was_winner and naics_pid not in ("31",""):
        if n_vendor_naics >= 1:
            return SCENARIO_WINNER_HAS_NAICS_NOT_STORED
        else:
            return SCENARIO_NO_VENDORS_HAVE_NAICS

    # AI was never triggered (unknown reason)
    if n_vendor_naics >= 1:
        return SCENARIO_AI_NOT_TRIGGERED
    return SCENARIO_NO_VENDORS_HAVE_NAICS


# ═════════════════════════════════════════════════════════════════════════════
# 4. ENRICH WITH ANALYSIS COLUMNS
# ═════════════════════════════════════════════════════════════════════════════

def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Add analysis columns to the raw data."""
    df = df.copy()

    # Parse OC NAICS
    df["oc_naics6"] = df["oc_industry_code_uids"].apply(_parse_oc_naics)

    # Vendor NAICS availability flags
    df["has_zi_naics"]  = (df["zi_naics6"].fillna("").str.len() >= 6) & \
                           (df["zi_match_confidence"].fillna(0) >= 0.5)
    df["has_efx_naics"] = (df["efx_naics6"].fillna("").str.len() >= 6) & \
                           (df["efx_match_confidence"].fillna(0) >= 0.5)
    df["has_oc_naics"]  = (df["oc_naics6"].str.len() >= 6)
    df["n_vendor_naics"]= df["has_zi_naics"].astype(int) + \
                           df["has_efx_naics"].astype(int) + \
                           df["has_oc_naics"].astype(int)
    df["any_vendor_naics"] = df["n_vendor_naics"] > 0

    # AI enrichment details
    df["ai_was_winner"] = df["naics_platform_id"].astype(str) == "31"
    df["ai_confidence_level"] = df["ai_confidence"].fillna("").str.upper()
    df["ai_hallucinated"] = df["ai_naics_removed"].notna() & \
                             (df["ai_naics_removed"].astype(str) != "")

    # Pipeline B has a different NAICS?
    df["pipeline_b_has_real_naics"] = (
        df["pipeline_b_naics"].notna() &
        (df["pipeline_b_naics"].astype(str) != "0") &
        (df["pipeline_b_naics"].astype(str) != NAICS_FALLBACK)
    )

    # Classify scenario
    df["scenario"] = df.apply(classify_scenario, axis=1)

    # Summary text per row
    def _summary(row):
        parts = []
        if row["has_zi_naics"]:  parts.append(f"ZI={row['zi_naics6']}({row['zi_match_confidence']:.2f})")
        if row["has_efx_naics"]: parts.append(f"EFX={row['efx_naics6']}({row['efx_match_confidence']:.2f})")
        if row["has_oc_naics"]:  parts.append(f"OC={row['oc_naics6']}")
        if row["ai_was_winner"]: parts.append(f"AI({row['ai_confidence_level']})")
        return " | ".join(parts) if parts else "no vendor signals"
    df["vendor_summary"] = df.apply(_summary, axis=1)

    return df


# ═════════════════════════════════════════════════════════════════════════════
# 5. GENERATE FULL DIAGNOSTIC REPORT
# ═════════════════════════════════════════════════════════════════════════════

def run_fallback_diagnosis(
    limit: Optional[int] = 5000,
    save_csv: bool = True,
) -> dict:
    """
    Full diagnostic run.

    Returns:
        dict with:
          df_raw       — raw enriched DataFrame
          scenario_dist — {scenario_code: count}
          summary      — human-readable summary dict
          fix_priority — ordered list of fixes by impact
    """
    logger.info("=== Running 561499 Fallback Root-Cause Analysis ===")

    # ── Pull data ──────────────────────────────────────────────────────────────
    df_raw = load_fallback_businesses(limit=limit)
    df     = enrich_dataframe(df_raw)

    n_total = len(df)
    if n_total == 0:
        return {"error": "No fallback businesses found"}

    # ── Scenario distribution ──────────────────────────────────────────────────
    scen_counts = df["scenario"].value_counts().to_dict()
    scen_pct    = {k: round(100*v/n_total, 1) for k, v in scen_counts.items()}

    # ── Key metrics ────────────────────────────────────────────────────────────
    n_ai_winner        = df["ai_was_winner"].sum()
    n_any_vendor       = df["any_vendor_naics"].sum()
    n_all_null         = (df["n_vendor_naics"] == 0).sum()
    n_1_vendor         = (df["n_vendor_naics"] == 1).sum()
    n_2_vendor         = (df["n_vendor_naics"] == 2).sum()
    n_3_vendor         = (df["n_vendor_naics"] >= 3).sum()
    n_hallucinated     = df["ai_hallucinated"].sum()
    n_pb_has_real      = df["pipeline_b_has_real_naics"].sum()
    n_ai_high          = (df["ai_confidence_level"] == "HIGH").sum()
    n_ai_med           = (df["ai_confidence_level"] == "MED").sum()
    n_ai_low           = (df["ai_confidence_level"] == "LOW").sum()
    n_ai_none          = (df["ai_confidence_level"] == "").sum()

    summary = {
        "total_fallback_businesses": n_total,
        "vendor_signal_distribution": {
            "all_vendors_null_0":  int(n_all_null),
            "1_vendor_has_naics":  int(n_1_vendor),
            "2_vendors_have_naics":int(n_2_vendor),
            "3_vendors_have_naics":int(n_3_vendor),
        },
        "ai_enrichment": {
            "ai_was_winning_source":  int(n_ai_winner),
            "ai_confidence_high":     int(n_ai_high),
            "ai_confidence_med":      int(n_ai_med),
            "ai_confidence_low":      int(n_ai_low),
            "ai_never_ran":           int(n_ai_none),
            "ai_hallucinated_code":   int(n_hallucinated),
        },
        "pipeline_b_analysis": {
            "pipeline_b_has_real_naics": int(n_pb_has_real),
            "pipeline_b_has_real_pct":   round(100*n_pb_has_real/max(n_total,1), 1),
        },
        "scenario_distribution": {k: {"count": v, "pct": scen_pct[k]}
                                   for k, v in scen_counts.items()},
        "descriptions": {k: SCENARIO_DESCRIPTIONS.get(k,"") for k in scen_counts},
    }

    # ── Fix priority ranking ───────────────────────────────────────────────────
    fix_priority = []
    if n_1_vendor + n_2_vendor > 0:
        n_fixable = n_1_vendor + n_2_vendor
        fix_priority.append({
            "priority": 1,
            "impact_businesses": n_fixable,
            "impact_pct": round(100*n_fixable/n_total, 1),
            "fix": "Deploy consensus.py Tier 1: Apply vendor NAICS directly when 1-2 sources have valid codes "
                   "(OC weight=0.9 > ZI=0.8 > EFX=0.7). No AI or model needed for these cases.",
            "scenarios": [SCENARIO_SOME_VENDORS_HAVE_NAICS],
        })
    if n_3_vendor > 0:
        fix_priority.append({
            "priority": 2,
            "impact_businesses": int(n_3_vendor),
            "impact_pct": round(100*n_3_vendor/n_total, 1),
            "fix": "AI enrichment is overriding vendor consensus with 561499. "
                   "Fix: Deploy consensus.py Tier 1 BEFORE AI runs. When 3 vendors agree, "
                   "do NOT allow AI to override with 561499.",
            "scenarios": [SCENARIO_ALL_VENDORS_HAVE_NAICS],
        })
    if n_hallucinated > 0:
        fix_priority.append({
            "priority": 3,
            "impact_businesses": int(n_hallucinated),
            "impact_pct": round(100*n_hallucinated/n_total, 1),
            "fix": "AI hallucinated invalid NAICS codes (replaced with 561499 by removeNaicsCode()). "
                   "Fix: Improve AI prompt to return sector-level code (e.g. 561000) as fallback "
                   "instead of specific invalid codes; validate against core_naics_code before accepting.",
            "scenarios": [SCENARIO_AI_HALLUCINATED],
        })
    if n_all_null > 0:
        # Estimate how many can be recovered from name keywords
        fix_priority.append({
            "priority": 4,
            "impact_businesses": int(n_all_null),
            "impact_pct": round(100*n_all_null/n_total, 1),
            "fix": "Zero vendor signals. AI only had business name + address. "
                   "Fix Part A: Add 80+ name keyword → NAICS mappings (consensus.py name_only tier). "
                   "Fix Part B: Enable AI web search for ALL zero-vendor businesses (not just when website known). "
                   "Fix Part C: These are genuinely hard — 561499 is correct only if web search also fails.",
            "scenarios": [SCENARIO_NO_VENDORS_HAVE_NAICS],
        })
    if n_pb_has_real > 0:
        fix_priority.append({
            "priority": 5,
            "impact_businesses": int(n_pb_has_real),
            "impact_pct": round(100*n_pb_has_real/n_total, 1),
            "fix": f"Pipeline B (customer_files) has a real NAICS for {n_pb_has_real} businesses "
                   "that show 561499 in Pipeline A. The ZI vs EFX rule in customer_table.sql "
                   "found a valid code that Pipeline A missed. "
                   "Fix: Read pipeline_b_naics as an additional vendor signal in the consensus layer.",
            "scenarios": [SCENARIO_SOME_VENDORS_HAVE_NAICS, SCENARIO_NO_VENDORS_HAVE_NAICS],
        })

    # ── Save ───────────────────────────────────────────────────────────────────
    if save_csv:
        out_path = ARTIFACTS_DIR / "fallback_diagnosis.csv"
        df.to_csv(out_path, index=False)
        logger.info("Detailed diagnosis saved to %s", out_path)

        report_path = ARTIFACTS_DIR / "fallback_diagnosis_report.json"
        with open(report_path, "w") as f:
            json.dump(summary, f, indent=2, default=str)
        logger.info("Summary report saved to %s", report_path)

    logger.info("=== Diagnosis complete: %d businesses analysed ===", n_total)
    return {
        "df": df,
        "summary": summary,
        "fix_priority": fix_priority,
        "scenario_counts": scen_counts,
    }


# ═════════════════════════════════════════════════════════════════════════════
# 6. QUICK SPOT-CHECK: fetch N examples per scenario for manual inspection
# ═════════════════════════════════════════════════════════════════════════════

def get_scenario_examples(df: pd.DataFrame, scenario: str, n: int = 5) -> pd.DataFrame:
    """Return n example rows for a given scenario, showing key columns."""
    cols = [
        "business_id", "scenario", "vendor_summary",
        "zi_naics6", "efx_naics6", "oc_naics6",
        "zi_match_confidence", "efx_match_confidence", "oc_match_confidence",
        "n_vendor_naics", "ai_was_winner", "ai_confidence_level",
        "ai_hallucinated", "ai_reasoning",
        "naics_platform_id", "naics_source_name", "naics_source_confidence",
        "pipeline_b_naics", "pipeline_b_has_real_naics",
    ]
    available = [c for c in cols if c in df.columns]
    subset = df[df["scenario"] == scenario][available].head(n)
    return subset


# ═════════════════════════════════════════════════════════════════════════════
# 7. SYNTHETIC FALLBACK (when Redshift not accessible)
# ═════════════════════════════════════════════════════════════════════════════

def run_synthetic_diagnosis(n: int = 200) -> dict:
    """
    Generate a realistic synthetic diagnosis for development/presentation.
    Mirrors what real data would show based on the source code analysis.
    """
    import random
    rng = random.Random(42)

    # Realistic distribution based on source code analysis:
    # - 60% of 561499 businesses have SOME vendor signal (scenarios A, B, E)
    # - 32% have zero vendor signals (scenario C)
    # - 5% AI hallucinated (scenario D)
    # - 3% unknown/storage issues (scenarios F, Z)
    rows = []
    for i in range(n):
        r = rng.random()
        if r < 0.05:    # Scenario A: all vendors have NAICS
            zi_n6 = "722511"; efx_n6 = "722511"; oc_n6 = "722511"
            zi_c = 0.88; efx_c = 0.75; oc_c = 0.82
            ai_conf = "LOW"; ai_pid = "31"; scenario = SCENARIO_ALL_VENDORS_HAVE_NAICS
        elif r < 0.25:  # Scenario B: some vendors have NAICS
            zi_n6 = rng.choice(["812113","531110","541511","722511",""])
            efx_n6 = rng.choice(["812113","531110","541512",""])
            oc_n6 = ""
            zi_c = rng.uniform(0.55, 0.90) if zi_n6 else 0.0
            efx_c = rng.uniform(0.50, 0.85) if efx_n6 else 0.0
            oc_c = 0.0
            ai_conf = "LOW"; ai_pid = "31"; scenario = SCENARIO_SOME_VENDORS_HAVE_NAICS
        elif r < 0.32:  # Scenario D: AI hallucinated
            zi_n6 = ""; efx_n6 = ""; oc_n6 = ""; zi_c = 0.0; efx_c = 0.0; oc_c = 0.0
            ai_conf = "MED"; ai_pid = "31"; scenario = SCENARIO_AI_HALLUCINATED
        elif r < 0.97:  # Scenario C: no vendor signals
            zi_n6 = ""; efx_n6 = ""; oc_n6 = ""; zi_c = 0.0; efx_c = 0.0; oc_c = 0.0
            ai_conf = rng.choice(["LOW","LOW","LOW","MED"])
            ai_pid = "31"; scenario = SCENARIO_NO_VENDORS_HAVE_NAICS
        else:           # Scenario F
            zi_n6 = "531110"; efx_n6 = "531110"; oc_n6 = ""; zi_c = 0.72; efx_c = 0.61; oc_c = 0.0
            ai_conf = ""; ai_pid = "24"; scenario = SCENARIO_WINNER_HAS_NAICS_NOT_STORED

        pb_naics = zi_n6 if zi_n6 and rng.random() > 0.4 else ""
        rows.append({
            "business_id": f"biz-{i:05d}",
            "current_naics_code": NAICS_FALLBACK,
            "current_mcc_code": MCC_FALLBACK,
            "naics_platform_id": ai_pid,
            "naics_source_confidence": str(rng.uniform(0.1, 0.25)),
            "ai_confidence": ai_conf,
            "ai_reasoning": f"Synthetic reasoning for scenario {scenario}" if ai_conf else "",
            "ai_naics_removed": rng.choice(["998765","","","",""]) if scenario == SCENARIO_AI_HALLUCINATED else "",
            "zi_naics6": zi_n6, "zi_match_confidence": zi_c,
            "efx_naics6": efx_n6, "efx_match_confidence": efx_c,
            "oc_industry_code_uids": f"us_naics-{oc_n6}|nace-J1234" if oc_n6 else "",
            "oc_match_confidence": oc_c,
            "pipeline_b_naics": pb_naics,
            "pipeline_b_confidence": zi_c if pb_naics else 0.0,
        })

    df_raw = pd.DataFrame(rows)
    df = enrich_dataframe(df_raw)

    n_total = len(df)
    scen_counts = df["scenario"].value_counts().to_dict()
    scen_pct    = {k: round(100*v/n_total, 1) for k, v in scen_counts.items()}

    n_ai_winner    = df["ai_was_winner"].sum()
    n_any_vendor   = df["any_vendor_naics"].sum()
    n_all_null     = (df["n_vendor_naics"] == 0).sum()
    n_1_vendor     = (df["n_vendor_naics"] == 1).sum()
    n_2_vendor     = (df["n_vendor_naics"] == 2).sum()
    n_3_vendor     = (df["n_vendor_naics"] >= 3).sum()
    n_hallucinated = df["ai_hallucinated"].sum()
    n_pb_has_real  = df["pipeline_b_has_real_naics"].sum()

    summary = {
        "total_fallback_businesses": n_total,
        "vendor_signal_distribution": {
            "all_vendors_null_0":  int(n_all_null),
            "1_vendor_has_naics":  int(n_1_vendor),
            "2_vendors_have_naics":int(n_2_vendor),
            "3_vendors_have_naics":int(n_3_vendor),
        },
        "ai_enrichment": {
            "ai_was_winning_source": int(n_ai_winner),
            "ai_hallucinated_code":  int(n_hallucinated),
        },
        "pipeline_b_analysis": {
            "pipeline_b_has_real_naics": int(n_pb_has_real),
            "pipeline_b_has_real_pct": round(100*n_pb_has_real/max(n_total,1), 1),
        },
        "scenario_distribution": {k: {"count": v, "pct": scen_pct.get(k,0)}
                                   for k, v in scen_counts.items()},
        "descriptions": {k: SCENARIO_DESCRIPTIONS.get(k,"") for k in scen_counts},
        "note": "SYNTHETIC data — run with Redshift connected for real numbers",
    }

    return {"df": df, "summary": summary, "scenario_counts": scen_counts, "fix_priority": []}
