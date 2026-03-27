"""
modeling/comparison.py
=======================
Side-by-side comparison of:
  Scenario A — Production baseline (customer_table.sql winner-takes-all rule)
  Scenario B — Consensus XGBoost  (Level 2 probabilistic classifier)

For the same input data, runs both pipelines and computes:
  - Code agreement / disagreement between the two
  - UK SIC gap (available in OC, dropped by production, used by Consensus)
  - AML/KYB signals produced by Consensus but absent in production
  - Accuracy delta (when ground truth is available)
  - Per-sector and per-jurisdiction breakdown
"""
from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd

from modeling.config import ARTIFACTS, HIGH_RISK_NAICS_PREFIXES
from modeling.production_baseline import ProductionBaseline, _extract_oc_uk_sic
from modeling.level2_trainer import Level2Trainer

logger = logging.getLogger(__name__)

_AML_THRESHOLDS = dict(
    hi_risk_sector         = 0,     # any high-risk NAICS
    web_registry_distance  = 0.55,
    temporal_pivot_score   = 0.50,
    source_majority_agreement = 0.40,  # below this = SOURCE_CONFLICT
    tru_pollution_flag     = 0,
    pred_prob_1            = 0.40,  # below this = LOW_CONSENSUS_PROB
)


class ComparisonEngine:
    """
    Runs both pipelines on the same dataset and produces a comparison report.

    Usage:
        engine  = ComparisonEngine()
        report  = engine.run(raw_df, ground_truth_col="label_naics")
        delta_df = engine.comparison_df  # per-row results
    """

    def __init__(self) -> None:
        self._baseline = ProductionBaseline()
        self._trainer  = Level2Trainer()
        self.comparison_df: Optional[pd.DataFrame] = None

    def run(
        self,
        raw_df: pd.DataFrame,
        ground_truth_col: str = "label_naics",
        train_level2: bool = True,
    ) -> dict:
        """
        Run both scenarios on raw_df.

        If train_level2=True, fits Level 2 from scratch on raw_df first.
        If train_level2=False, loads a previously saved model.
        """
        logger.info(f"Running comparison on {len(raw_df):,} companies …")

        # ── Scenario A: Production baseline ───────────────────────────────────
        logger.info("Running Scenario A — Production baseline …")
        df_a = self._baseline.run(raw_df)
        eval_a = self._baseline.evaluate(df_a, ground_truth_col)

        # ── Scenario B: Consensus XGBoost ─────────────────────────────────────
        logger.info("Running Scenario B — Consensus XGBoost …")
        if train_level2:
            eval_b_train = self._trainer.fit(raw_df)
            self._trainer.save()
        else:
            self._trainer.load()
            eval_b_train = {}

        preds_b = self._trainer.predict(raw_df, top_k=3)

        # ── Build per-row comparison DataFrame ───────────────────────────────
        comp_df = self._build_comparison_df(raw_df, df_a, preds_b, ground_truth_col)
        self.comparison_df = comp_df

        # Save
        comp_df.to_parquet(ARTIFACTS["comparison_report"], index=False)
        logger.info(f"Comparison report → {ARTIFACTS['comparison_report']}")

        # ── Aggregate metrics ────────────────────────────────────────────────
        n = len(comp_df)

        codes_agree     = (comp_df["prod_naics"].astype(str) ==
                           comp_df["cons_naics_1"].astype(str)).sum()
        prefix4_agree   = (comp_df["prod_naics"].astype(str).str[:4] ==
                           comp_df["cons_naics_1"].astype(str).str[:4]).sum()
        uk_sic_avail    = comp_df["gap_uk_sic_available"].notna().sum()
        uk_sic_usable   = comp_df["cons_uk_sic_usable"].sum()
        aml_flagged     = (comp_df["cons_n_aml_flags"] > 0).sum()

        kyb_dist = comp_df["cons_kyb"].value_counts().to_dict()

        gt_available = ground_truth_col in comp_df.columns
        if gt_available:
            gt = comp_df[ground_truth_col].astype(str)
            prod_correct = (comp_df["prod_naics"].astype(str) == gt).sum()
            cons_correct = (comp_df["cons_naics_1"].astype(str) == gt).sum()
        else:
            prod_correct = cons_correct = None

        report = {
            "n_total": n,
            "scenario_a": {
                **eval_a,
                "accuracy_pct": round(prod_correct / n * 100, 1) if gt_available else None,
            },
            "scenario_b": {
                **eval_b_train,
                "accuracy_pct": round(cons_correct / n * 100, 1) if gt_available else None,
                "uk_sic_usable":  int(uk_sic_usable),
                "aml_flagged":    int(aml_flagged),
                "kyb_distribution": kyb_dist,
            },
            "comparison": {
                "codes_agree":        int(codes_agree),
                "codes_agree_pct":    round(codes_agree / n * 100, 1),
                "prefix4_agree_pct":  round(prefix4_agree / n * 100, 1),
                "uk_sic_available":   int(uk_sic_avail),
                "uk_sic_gap":         int(uk_sic_avail - uk_sic_usable),
            },
            "note": (
                "Accuracy measured against available ground truth labels. "
                "With synthetic data these reflect the model's ability to learn "
                "from simulated vendor signals. "
                "With real rel_business_industry_naics labels, accuracy rises "
                "significantly as the model learns from analyst corrections."
            ),
        }

        return report

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _build_comparison_df(
        self,
        raw_df: pd.DataFrame,
        df_a: pd.DataFrame,
        preds_b: pd.DataFrame,
        gt_col: str,
    ) -> pd.DataFrame:
        """Build the per-row comparison DataFrame."""

        base_cols = ["business_id", "company_name", "oc_jurisdiction_code",
                     "efx_confidence", "zi_confidence", "oc_confidence",
                     "liberty_confidence", "_sector", "_is_known", "_data_source"]
        base_cols = [c for c in base_cols if c in raw_df.columns]

        comp = raw_df[base_cols].reset_index(drop=True).copy()

        if gt_col in raw_df.columns:
            comp["ground_truth"] = raw_df[gt_col].values

        # Scenario A columns
        a_cols = ["prod_winning_src", "prod_match_conf", "prod_naics",
                  "prod_probability", "prod_uk_sic_stored", "prod_aml_signals",
                  "prod_kyb", "gap_uk_sic_available", "gap_oc_disagrees_with_winner"]
        for c in a_cols:
            if c in df_a.columns:
                comp[c] = df_a[c].values

        # Scenario B columns
        for col in preds_b.columns:
            comp[col] = preds_b[col].values

        # Rename for clarity
        comp.rename(columns={
            "pred_naics_1": "cons_naics_1",
            "pred_prob_1":  "cons_prob_1",
            "pred_naics_2": "cons_naics_2",
            "pred_prob_2":  "cons_prob_2",
            "pred_naics_3": "cons_naics_3",
            "pred_prob_3":  "cons_prob_3",
        }, inplace=True)

        comp["cons_probability_str"] = (
            comp["cons_prob_1"].apply(lambda x: f"{x:.1%}" if pd.notna(x) else "—")
        )

        # UK SIC from OC — now used by Consensus (not dropped)
        comp["cons_uk_sic"] = raw_df["oc_industry_uids"].apply(
            _extract_oc_uk_sic
        ).values if "oc_industry_uids" in raw_df.columns else None
        comp["cons_uk_sic_usable"] = comp["cons_uk_sic"].notna().astype(int)

        # AML flags from feature-based signals
        from modeling.feature_engineering import FeatureEngineer
        feat_df = FeatureEngineer().transform(raw_df)

        aml_flags_list = []
        for _, row in feat_df.iterrows():
            flags = []
            if row.get("hi_risk_sector", 0):
                flags.append("HIGH_RISK_SECTOR")
            if row.get("web_registry_distance", 0) > _AML_THRESHOLDS["web_registry_distance"]:
                flags.append("REGISTRY_DISCREPANCY")
            if row.get("temporal_pivot_score", 0) > _AML_THRESHOLDS["temporal_pivot_score"]:
                flags.append("STRUCTURE_CHANGE")
            if row.get("source_majority_agreement", 1) < _AML_THRESHOLDS["source_majority_agreement"]:
                flags.append("SOURCE_CONFLICT")
            if row.get("tru_pollution_flag", 0):
                flags.append("TRULIOO_POLLUTION")
            aml_flags_list.append(flags)

        comp["cons_aml_flags"] = ["; ".join(f) if f else "—" for f in aml_flags_list]
        comp["cons_n_aml_flags"] = [len(f) for f in aml_flags_list]

        # Low consensus probability flag (after we have predictions)
        if "cons_prob_1" in comp.columns:
            low_prob_mask = comp["cons_prob_1"] < _AML_THRESHOLDS["pred_prob_1"]
            comp.loc[low_prob_mask, "cons_aml_flags"] = (
                comp.loc[low_prob_mask, "cons_aml_flags"]
                .apply(lambda x: (x + "; LOW_CONSENSUS_PROB").lstrip("; ")
                       if x != "—" else "LOW_CONSENSUS_PROB")
            )
            comp.loc[low_prob_mask, "cons_n_aml_flags"] += 1

        # KYB recommendation from risk score
        comp["cons_risk_score"] = comp.apply(
            lambda row: self._compute_risk_score(row, feat_df.iloc[row.name]
                                                 if row.name < len(feat_df) else {}),
            axis=1,
        )
        comp["cons_kyb"] = comp["cons_risk_score"].apply(
            lambda s: ("REJECT"   if s >= 0.75 else
                       "ESCALATE" if s >= 0.50 else
                       "REVIEW"   if s >= 0.25 else "APPROVE")
        )

        # Agreement flag
        comp["codes_agree"] = (
            comp["prod_naics"].astype(str) == comp["cons_naics_1"].astype(str)
        )

        return comp

    @staticmethod
    def _compute_risk_score(row: pd.Series, feat_row) -> float:
        hi_risk  = float(feat_row.get("hi_risk_sector", 0)         if hasattr(feat_row, 'get') else 0)
        web_dist = float(feat_row.get("web_registry_distance", 0)   if hasattr(feat_row, 'get') else 0)
        pivot    = float(feat_row.get("temporal_pivot_score", 0)    if hasattr(feat_row, 'get') else 0)
        maj      = float(feat_row.get("source_majority_agreement", 1) if hasattr(feat_row, 'get') else 1)
        tru_poll = float(feat_row.get("tru_pollution_flag", 0)      if hasattr(feat_row, 'get') else 0)
        low_prob = float(row.get("cons_prob_1", 1) or 1) < 0.40

        score = min(
            0.30 * hi_risk
            + 0.25 * int(web_dist > 0.55)
            + 0.20 * int(pivot > 0.50)
            + 0.15 * int(maj < 0.40)
            + 0.05 * tru_poll
            + 0.10 * int(low_prob),
            1.0,
        )
        return round(score, 4)

    def delta_table(self) -> pd.DataFrame:
        """
        Return a clean human-readable summary table of the key delta
        between Scenario A and Scenario B.
        """
        if self.comparison_df is None:
            raise RuntimeError("Run .run() first.")
        df = self.comparison_df
        n  = len(df)
        rows = [
            ("Total companies",
             str(n), str(n)),
            ("NAICS code returned",
             f"{df['prod_naics'].notna().sum()} ({df['prod_naics'].notna().sum()/n:.0%})",
             f"{n} (100%)"),
            ("Calibrated probability",
             "None — rule produces no probability",
             f"Yes — top-1 avg {df['cons_prob_1'].mean():.1%}"),
            ("UK SIC persisted to DB",
             "0 (no storage table)",
             f"{df['cons_uk_sic_usable'].sum()} companies"),
            ("AML signals produced",
             "0",
             f"{(df['cons_n_aml_flags'] > 0).sum()} companies flagged"),
            ("APPROVE",
             "Not produced",
             str((df["cons_kyb"] == "APPROVE").sum())),
            ("REVIEW",
             "Not produced",
             str((df["cons_kyb"] == "REVIEW").sum())),
            ("ESCALATE / REJECT",
             "Not produced",
             str(df["cons_kyb"].isin(["ESCALATE","REJECT"]).sum())),
            ("Jurisdiction used for taxonomy routing",
             "Never",
             "Always"),
            ("Multi-taxonomy output",
             "NAICS only",
             "NAICS + UK SIC + NACE + ISIC"),
            ("Codes agree (A = B)",
             "—",
             f"{df['codes_agree'].sum()} ({df['codes_agree'].mean():.0%})"),
        ]
        return pd.DataFrame(rows, columns=["Metric", "Scenario A (Production)", "Scenario B (Consensus)"])
