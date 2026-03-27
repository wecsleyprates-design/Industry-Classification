"""
modeling/level1_evaluator.py
=============================
Evaluates the existing Level 1 entity matching model (entity_matching_20250127 v1).

We do NOT retrain it here — it is already in production. What we do:
  1. Analyse the distribution of match confidence scores per source
  2. Measure source agreement rates (do ZI, EFX, OC agree on the same company?)
  3. Evaluate: when a source matches at >= 0.80 confidence, how often does its
     NAICS code agree with the analyst ground truth label?
  4. Produce the Level 1 Summary that feeds into the comparison report

The 33 pairwise similarity features that Level 1 uses are documented in
PRODUCTION_PLAN.md — they are not computed here (they live in the
Entity-Matching repo's matching_v1.py). We consume their output.
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

from modeling.config import MATCH_CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)

_SOURCES = ["oc", "efx", "zi", "liberty"]
_CONF_COLS = {
    "oc":      "oc_confidence",
    "efx":     "efx_confidence",
    "zi":      "zi_confidence",
    "liberty": "liberty_confidence",
}
_NAICS_COLS = {
    "efx": "efx_naics",
    "zi":  "zi_naics",
}


class Level1Evaluator:
    """
    Evaluates match confidence outputs from the Level 1 entity matching model.

    Usage:
        ev = Level1Evaluator()
        report = ev.evaluate(raw_df, ground_truth_col="label_naics")
        summary = ev.summary_table(raw_df)
    """

    THR = MATCH_CONFIDENCE_THRESHOLD

    def evaluate(
        self,
        df: pd.DataFrame,
        ground_truth_col: str = "label_naics",
    ) -> dict:
        """
        Full evaluation of Level 1 outputs.
        Returns a structured report dict.
        """
        n = len(df)
        report: dict = {
            "n_total": n,
            "match_rates": {},
            "confidence_stats": {},
            "naics_accuracy_when_matched": {},
            "source_agreement": {},
            "uk_sic_availability": {},
        }

        # ── Match rates (fraction of companies each source matched) ───────────
        for src, col in _CONF_COLS.items():
            if col not in df.columns:
                continue
            conf = pd.to_numeric(df[col], errors="coerce").fillna(0)
            matched = (conf >= self.THR).sum()
            report["match_rates"][src] = {
                "matched":     int(matched),
                "not_matched": int(n - matched),
                "match_pct":   round(matched / n * 100, 1),
            }

        # ── Confidence distribution stats ─────────────────────────────────────
        for src, col in _CONF_COLS.items():
            if col not in df.columns:
                continue
            conf = pd.to_numeric(df[col], errors="coerce").dropna()
            report["confidence_stats"][src] = {
                "mean":   round(float(conf.mean()), 4),
                "median": round(float(conf.median()), 4),
                "std":    round(float(conf.std()), 4),
                "p25":    round(float(conf.quantile(0.25)), 4),
                "p75":    round(float(conf.quantile(0.75)), 4),
                "p90":    round(float(conf.quantile(0.90)), 4),
            }

        # ── NAICS accuracy when source matched ────────────────────────────────
        if ground_truth_col in df.columns:
            for src, naics_col in _NAICS_COLS.items():
                conf_col = _CONF_COLS.get(src)
                if conf_col not in df.columns or naics_col not in df.columns:
                    continue
                conf = pd.to_numeric(df[conf_col], errors="coerce").fillna(0)
                matched_mask = conf >= self.THR
                matched_df = df[matched_mask].copy()
                if matched_df.empty:
                    continue

                gt   = matched_df[ground_truth_col].astype(str)
                pred = matched_df[naics_col].astype(str)
                exact   = (gt == pred).sum()
                prefix4 = (gt.str[:4] == pred.str[:4]).sum()
                m = int(matched_mask.sum())

                report["naics_accuracy_when_matched"][src] = {
                    "n_matched":       m,
                    "top1_exact_pct":  round(exact  / m * 100, 1),
                    "top1_4digit_pct": round(prefix4 / m * 100, 1),
                    "interpretation": (
                        f"When {src.upper()} matches with ≥{self.THR} confidence, "
                        f"its NAICS code is exactly correct {exact/m*100:.1f}% of the time."
                    ),
                }

        # ── Source agreement: how often do sources agree on same 4-digit prefix?
        naics_sources_available = [
            src for src in ["zi", "efx"]
            if _NAICS_COLS[src] in df.columns
        ]
        if len(naics_sources_available) >= 2:
            zi_n  = df["zi_naics"].astype(str).str[:4]
            efx_n = df["efx_naics"].astype(str).str[:4]
            agree = (zi_n == efx_n).sum()
            report["source_agreement"]["zi_vs_efx_4digit_pct"] = round(
                agree / n * 100, 1
            )

            # OC vs ZI agreement
            if "oc_industry_uids" in df.columns:
                oc_has_naics = df["oc_industry_uids"].str.contains(
                    "us_naics|naics", na=False, case=False
                ).sum()
                report["source_agreement"]["oc_has_naics_pct"] = round(
                    oc_has_naics / n * 100, 1
                )

        # ── UK SIC availability from OC ───────────────────────────────────────
        if "oc_industry_uids" in df.columns:
            has_uk_sic = df["oc_industry_uids"].str.contains(
                "gb_sic|uk_sic", na=False, case=False
            ).sum()
            report["uk_sic_availability"] = {
                "available_in_oc":  int(has_uk_sic),
                "pct_of_total":     round(has_uk_sic / n * 100, 1),
                "stored_in_db":     0,
                "gap_note": (
                    f"{has_uk_sic} companies have UK SIC in OC response "
                    f"({has_uk_sic/n*100:.1f}%) — production stores 0 (no table)."
                ),
            }

        return report

    def summary_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Returns a tidy per-source summary DataFrame for display in the notebook.
        """
        rows = []
        n = len(df)
        for src in _SOURCES:
            col = _CONF_COLS.get(src)
            if col not in df.columns:
                continue
            conf = pd.to_numeric(df[col], errors="coerce").fillna(0)
            matched = int((conf >= self.THR).sum())
            naics_col = _NAICS_COLS.get(src, "")
            rows.append({
                "Source":           src.upper(),
                "Matched (≥0.80)":  matched,
                "Match %":          f"{matched/n*100:.1f}%",
                "Mean Confidence":  f"{conf.mean():.3f}",
                "Median Confidence": f"{conf.median():.3f}",
                "Has NAICS column": "Yes" if naics_col in df.columns else "No",
                "Table":            {
                    "oc":      "open_corporates_standard_ml_2",
                    "efx":     "equifax_us_standardized",
                    "zi":      "zoominfo_standard_ml_2",
                    "liberty": "liberty.einmst_*",
                }.get(src, ""),
            })
        return pd.DataFrame(rows)

    def confidence_distribution_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Returns a long-format DataFrame suitable for plotting confidence
        distributions per source.
        """
        rows = []
        for src, col in _CONF_COLS.items():
            if col not in df.columns:
                continue
            conf = pd.to_numeric(df[col], errors="coerce").dropna()
            for v in conf:
                rows.append({"source": src.upper(), "confidence": float(v)})
        return pd.DataFrame(rows)
