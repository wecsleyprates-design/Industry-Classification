"""
modeling/experiment.py
=======================
CLI orchestrator — runs the full modeling experiment end to end.

Usage:
    python modeling/experiment.py                    # full run (default)
    python modeling/experiment.py --mode full        # load data, train, compare
    python modeling/experiment.py --mode train-only  # fit Level 2, save artifacts
    python modeling/experiment.py --mode compare     # compare using saved model
    python modeling/experiment.py --mode synthetic   # force synthetic data
    python modeling/experiment.py --mode cv          # cross-validation only
    python modeling/experiment.py --limit 20000      # cap rows from Redshift

Outputs (all in data/modeling/):
    training_dataset.parquet   — features + labels
    consensus_model.ubj        — trained XGBoost model
    label_encoder.pkl          — class index ↔ NAICS string
    feature_config.json        — feature list + params
    evaluation_report.json     — Level 2 metrics
    comparison_report.parquet  — per-row A vs B comparison
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

# Add parent to path so we can import modeling.* regardless of cwd
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("experiment")


def _banner(text: str) -> None:
    width = 64
    logger.info("=" * width)
    logger.info(f"  {text}")
    logger.info("=" * width)


def run_full(args) -> None:
    from modeling.data_loader       import DataLoader
    from modeling.level1_evaluator  import Level1Evaluator
    from modeling.comparison        import ComparisonEngine
    from modeling.config            import ARTIFACTS

    t_start = time.time()

    # ── Step 1: Load data ─────────────────────────────────────────────────────
    _banner("STEP 1 / 4 — Loading data")
    loader = DataLoader()

    if args.mode == "synthetic":
        raw_df = loader._load_features_synthetic(args.limit)
        load_result_source = "SYNTHETIC (forced)"
        load_result_label  = "SYNTHETIC"
        has_real_labels    = False
        logger.info(f"Synthetic dataset: {len(raw_df):,} rows")
    else:
        load_result = loader.load_training_dataset(limit=args.limit)
        raw_df = load_result.df
        load_result_source = load_result.source
        load_result_label  = load_result.label_source
        has_real_labels    = load_result.has_real_labels

    logger.info(
        f"Data source:  {load_result_source}\n"
        f"Label source: {load_result_label}\n"
        f"Rows:         {len(raw_df):,}\n"
        f"Real labels:  {has_real_labels}"
    )

    # ── Step 2: Level 1 evaluation ────────────────────────────────────────────
    _banner("STEP 2 / 4 — Level 1 entity matching analysis")
    ev1 = Level1Evaluator()
    l1_report = ev1.evaluate(raw_df)
    logger.info("Match rates per source:")
    for src, stats in l1_report["match_rates"].items():
        logger.info(f"  {src.upper():12s}: {stats['matched']:>5,} matched ({stats['match_pct']}%)")
    if l1_report.get("uk_sic_availability"):
        uk = l1_report["uk_sic_availability"]
        logger.info(f"UK SIC in OC: {uk['available_in_oc']} ({uk['pct_of_total']}%) — stored: 0")

    # ── Step 3 + 4: Comparison (trains Level 2 inside) ───────────────────────
    _banner("STEP 3 / 4 — Training Level 2 + Production baseline")
    engine = ComparisonEngine()
    comparison_report = engine.run(
        raw_df,
        ground_truth_col="label_naics",
        train_level2=True,
    )

    # ── Print summary ─────────────────────────────────────────────────────────
    _banner("STEP 4 / 4 — Summary")
    elapsed = time.time() - t_start

    a = comparison_report["scenario_a"]
    b = comparison_report["scenario_b"]
    c = comparison_report["comparison"]

    print("\n" + "═" * 64)
    print("  PRODUCTION (Scenario A) vs CONSENSUS (Scenario B)")
    print("═" * 64)
    print(f"\n  Data: {load_result_source}  |  Labels: {load_result_label}")
    print(f"  Companies: {comparison_report['n_total']:,}  |  Time: {elapsed:.1f}s\n")
    print(f"  {'Metric':<35} {'Prod':>12} {'Consensus':>12}")
    print("  " + "-" * 60)
    print(f"  {'NAICS coverage':<35} {str(a.get('coverage_pct','—'))+'%':>12} {'100%':>12}")
    if a.get("accuracy_pct") is not None:
        print(f"  {'Top-1 accuracy*':<35} {str(a['accuracy_pct'])+'%':>12} {str(b.get('accuracy_pct','—'))+'%':>12}")
    print(f"  {'UK SIC available from OC':<35} {str(c['uk_sic_available']):>12} {str(c['uk_sic_available']):>12}")
    print(f"  {'UK SIC stored to DB':<35} {'0':>12} {str(b.get('uk_sic_usable','—')):>12}")
    print(f"  {'AML signals':<35} {'0':>12} {str(b.get('aml_flagged','—')):>12}")
    print(f"  {'KYB output':<35} {'None':>12} {'Yes':>12}")
    print(f"  {'Probability output':<35} {'None':>12} {'Yes':>12}")
    print(f"  {'Codes agree (A = B)':<35} {'—':>12} {str(c['codes_agree_pct'])+'%':>12}")
    if b.get("top1_accuracy_pct") is not None:
        print(f"\n  Consensus model metrics:")
        print(f"    Top-1 accuracy : {b['top1_accuracy_pct']}%")
        print(f"    Top-3 accuracy : {b.get('top3_accuracy_pct','—')}%")
        print(f"    Log-loss       : {b.get('log_loss','—')}")
    print(f"\n  {comparison_report['note']}")
    print("═" * 64 + "\n")

    logger.info("All artifacts saved to data/modeling/")
    logger.info("Open consensus_modeling_experiment.ipynb for charts and analysis.")


def run_train_only(args) -> None:
    from modeling.data_loader    import DataLoader
    from modeling.level2_trainer import Level2Trainer

    loader = DataLoader()
    result = loader.load_training_dataset(limit=args.limit)
    trainer = Level2Trainer()
    report = trainer.fit(result.df)
    trainer.save()
    logger.info(
        f"Training complete: top-1={report['top1_accuracy_pct']}%  "
        f"top-3={report['top3_accuracy_pct']}%"
    )


def run_compare(args) -> None:
    from modeling.data_loader import DataLoader
    from modeling.comparison  import ComparisonEngine
    from modeling.config      import ARTIFACTS

    loader = DataLoader()
    result = loader.load_features(limit=args.limit)
    engine = ComparisonEngine()
    report = engine.run(result, ground_truth_col="label_naics", train_level2=False)
    print(engine.delta_table().to_string(index=False))


def run_cv(args) -> None:
    from modeling.data_loader    import DataLoader
    from modeling.level2_trainer import Level2Trainer

    loader = DataLoader()
    result = loader.load_training_dataset(limit=args.limit)
    trainer = Level2Trainer()
    cv_report = trainer.cross_validate(result.df, n_folds=5)
    logger.info(
        f"Cross-validation (5-fold):\n"
        f"  Top-1: {cv_report['top1_mean']:.1f}% ± {cv_report['top1_std']:.1f}%\n"
        f"  Top-3: {cv_report['top3_mean']:.1f}% ± {cv_report['top3_std']:.1f}%\n"
        f"  Log-loss: {cv_report['log_loss_mean']:.4f} ± {cv_report['log_loss_std']:.4f}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Consensus Industry Classification — modeling experiment"
    )
    parser.add_argument(
        "--mode",
        choices=["full", "train-only", "compare", "synthetic", "cv"],
        default="full",
        help="Experiment mode (default: full)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10_000,
        help="Max rows to load from Redshift (default: 10000)",
    )
    args = parser.parse_args()

    if args.mode in ("full", "synthetic"):
        run_full(args)
    elif args.mode == "train-only":
        run_train_only(args)
    elif args.mode == "compare":
        run_compare(args)
    elif args.mode == "cv":
        run_cv(args)


if __name__ == "__main__":
    main()
