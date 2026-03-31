"""
modeling/production_baseline.py
================================
Replicates the exact production classification logic from:
  warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql
  → sp_recreate_customer_files()

The production rule (Scenario A):
  IF zi_match_confidence > efx_match_confidence:
      primary_naics = zi_c_naics6
  ELSE:
      primary_naics = efx_primnaicscode

This produces:
  - One NAICS code per company
  - No probability
  - No UK SIC (even when OC returns it in industry_code_uids — it is DROPPED)
  - No alternative codes
  - No AML signal
  - No KYB recommendation

This module also computes what the production rule could have returned
but silently dropped (UK SIC from OC, secondary codes, etc.) so we can
quantify the gap.
"""
from __future__ import annotations

import re
import logging
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

_UK_SIC_PREFIXES = {"gb_sic", "uk_sic"}
_NAICS_PREFIXES  = {"us_naics", "naics"}


def _extract_oc_uk_sic(uid_str: str) -> Optional[str]:
    """Extract the first UK SIC code from OC industry_code_uids, if present."""
    if not uid_str or pd.isna(uid_str):
        return None
    for part in str(uid_str).split("|"):
        if "-" in part:
            prefix, code = part.split("-", 1)
            if prefix.strip().lower() in _UK_SIC_PREFIXES:
                return code.strip()
    return None


def _extract_oc_naics(uid_str: str) -> Optional[str]:
    """Extract the first NAICS code from OC industry_code_uids."""
    if not uid_str or pd.isna(uid_str):
        return None
    for part in str(uid_str).split("|"):
        if "-" in part:
            prefix, code = part.split("-", 1)
            if prefix.strip().lower() in _NAICS_PREFIXES:
                c = re.sub(r"[^0-9]", "", code.strip())
                if len(c) == 6:
                    return c
    return None


def _clean_naics(code) -> Optional[str]:
    if code is None or pd.isna(code):
        return None
    c = re.sub(r"[^0-9]", "", str(code))[:6]
    return c if len(c) == 6 else None


class ProductionBaseline:
    """
    Applies the production classification rule to a raw features DataFrame.

    Usage:
        baseline = ProductionBaseline()
        result_df = baseline.run(raw_df)
    """

    def run(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply the production rule to every row.
        Returns the original df with production result columns appended.
        """
        results = []
        for _, row in df.iterrows():
            results.append(self._classify_row(row))

        result_df = pd.DataFrame(results)
        return pd.concat(
            [df.reset_index(drop=True), result_df.reset_index(drop=True)],
            axis=1,
        )

    def _classify_row(self, row: pd.Series) -> dict:
        zi_conf  = float(row.get("zi_confidence",  0) or 0)
        efx_conf = float(row.get("efx_confidence", 0) or 0)

        # ── The production rule from customer_table.sql ───────────────────────
        if zi_conf > efx_conf:
            winning_src  = "zoominfo"
            prod_naics   = _clean_naics(row.get("zi_naics"))
            prod_conf    = zi_conf
        else:
            winning_src  = "equifax"
            prod_naics   = _clean_naics(row.get("efx_naics"))
            prod_conf    = efx_conf

        # ── What production DROPS (the gap) ──────────────────────────────────
        uk_sic_in_oc   = _extract_oc_uk_sic(row.get("oc_industry_uids", ""))
        oc_naics_in_oc = _extract_oc_naics(row.get("oc_industry_uids", ""))

        # Whether OC has a NAICS that disagrees with the production winner
        oc_disagrees = (
            oc_naics_in_oc is not None
            and prod_naics is not None
            and oc_naics_in_oc[:4] != prod_naics[:4]
        )

        return {
            # Production output
            "prod_winning_src":      winning_src,
            "prod_match_conf":       round(prod_conf, 4),
            "prod_naics":            prod_naics,
            "prod_probability":      None,       # rule produces no probability
            "prod_secondary_codes":  None,       # single code only
            "prod_uk_sic_stored":    None,       # no core_uk_sic_code table exists
            "prod_aml_signals":      0,          # no risk engine
            "prod_kyb":              None,       # not produced
            "prod_jurisdiction_used": False,     # jurisdiction never used for routing
            # What production had but dropped
            "gap_uk_sic_available":  uk_sic_in_oc,
            "gap_oc_naics_available": oc_naics_in_oc,
            "gap_oc_disagrees_with_winner": int(bool(oc_disagrees)),
            "gap_source_conflict": int(
                bool(prod_naics)
                and bool(oc_naics_in_oc)
                and oc_naics_in_oc[:4] != (prod_naics or "")[:4]
            ),
        }

    def evaluate(
        self, result_df: pd.DataFrame, ground_truth_col: str = "label_naics"
    ) -> dict:
        """
        Compute evaluation metrics for the production baseline.
        ground_truth_col: column with the true NAICS code.
        """
        if ground_truth_col not in result_df.columns:
            logger.warning(f"Column {ground_truth_col!r} not found — cannot evaluate accuracy.")
            return {}

        total     = len(result_df)
        no_code   = result_df["prod_naics"].isna().sum()
        has_code  = total - no_code

        gt  = result_df[ground_truth_col].astype(str)
        pred = result_df["prod_naics"].astype(str)

        exact_match  = (gt == pred).sum()
        prefix4_match = (gt.str[:4] == pred.str[:4]).sum()

        zi_wins  = (result_df["prod_winning_src"] == "zoominfo").sum()
        efx_wins = (result_df["prod_winning_src"] == "equifax").sum()

        uk_sic_available = result_df["gap_uk_sic_available"].notna().sum()
        oc_conflicts      = result_df["gap_oc_disagrees_with_winner"].sum()

        return {
            "n_total":            total,
            "n_with_code":        int(has_code),
            "coverage_pct":       round(has_code / total * 100, 1),
            "top1_accuracy_pct":  round(exact_match / total * 100, 1),
            "top1_4digit_pct":    round(prefix4_match / total * 100, 1),
            "probability_output": False,
            "zoominfo_wins":      int(zi_wins),
            "equifax_wins":       int(efx_wins),
            "uk_sic_available":   int(uk_sic_available),
            "uk_sic_stored":      0,
            "oc_conflicts_with_winner": int(oc_conflicts),
            "aml_signals":        0,
            "kyb_produced":       False,
            "taxonomies":         ["US_NAICS_2022"],
            "notes": (
                "UK SIC was available from OpenCorporates for "
                f"{uk_sic_available} companies but is silently dropped — "
                "no storage table exists in the production schema."
            ),
        }
