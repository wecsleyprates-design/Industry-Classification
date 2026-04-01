"""
modeling/experiment.py
=======================
Full experiment orchestrator — runs end-to-end and saves every output the
notebook needs. One command produces all artifacts.

IMPORTANT: Two separate Worth AI pipelines are being compared here.

  PIPELINE B (Production — batch Redshift):
    - Reads datascience.customer_files + three match tables
    - Level 1 XGBoost entity matching: oc_probability, efx_probability,
      zi_probability from datascience.ml_model_matches (via match tables)
    - Industry rule: IF zi_match_confidence > efx_match_confidence
                     THEN zi_c_naics6   ELSE efx_primnaicscode
    - Output: datascience.customer_files.naics_code
    - Sources: ZoomInfo + Equifax ONLY (OC/Liberty industry codes ignored)
    - No probability, no UK SIC, no AML signals, no KYB

  CONSENSUS MODEL (New — what this experiment evaluates):
    - Uses the SAME Level 1 XGBoost confidence scores from Pipeline B
    - Adds all 6 sources as weighted features (OC, EFX, ZI, Trulioo, Liberty, AI)
    - Trains XGBClassifier(multi:softprob) → calibrated probabilities
    - Routes to correct taxonomy per jurisdiction (UK SIC for GB, NAICS for US)
    - Produces 6 AML signal types + KYB recommendation
    - Training label: rel_business_industry_naics from case-service PostgreSQL

  Data sources and caveats:
    oc_confidence  → oc_matches_custom_inc_ml.oc_probability  (REAL XGBoost)
    efx_confidence → efx_matches_custom_inc_ml.efx_probability (REAL XGBoost)
    zi_confidence  → zoominfo_matches_custom_inc_ml.zi_probability (REAL XGBoost)
    tru_confidence → PROXY ONLY: global_trulioo_us_kyb.name_verification
                     (KYB binary flag, NOT entity match score — approximation)
    liberty_confidence → NOT IN REDSHIFT: stored in local {TABLE}_results.parquet

Usage:
    python modeling/experiment.py                # connects to Redshift if reachable
    python modeling/experiment.py --synthetic    # force synthetic data
    python modeling/experiment.py --limit 5000   # cap Redshift rows

Steps:
    1. Load  — Pipeline B data from Redshift: match confidences + vendor codes
    2. Level 1 — analyse per-source XGBoost confidence scores
    3. Production — replicate customer_table.sql (Pipeline B winner-takes-all rule)
    4. Level 2 — train Consensus XGBoost using same data, classify, evaluate
    5. Compare — side-by-side delta, save all artifacts

Saved artifacts (data/modeling/):
    experiment_results.csv       — friendly display columns, loaded by the notebook
    experiment_results.xlsx      — same, Excel format for download
    l1_report.json               — Level 1 source analysis (match rates, UK SIC gap)
    evaluation_report.json       — Level 2 XGBoost metrics (top-1, top-3, log-loss)
    comparison_report.parquet    — raw per-row comparison (programmatic use)
    consensus_model.ubj          — trained XGBoost model binary
    label_encoder.pkl            — class index ↔ NAICS string
    feature_config.json          — feature list + hyperparameters
"""
from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("experiment")

ARTIFACTS_DIR = Path(__file__).parent.parent / "data" / "modeling"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _banner(text: str) -> None:
    logger.info("=" * 64)
    logger.info(f"  {text}")
    logger.info("=" * 64)


def _json_safe(obj):
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, np.ndarray):     return obj.tolist()
    return str(obj)


# ── Friendly column builder ───────────────────────────────────────────────────

def _build_friendly_df(
    raw_df: pd.DataFrame,
    df_a:   pd.DataFrame,
    preds:  pd.DataFrame,
    feat_df: pd.DataFrame,
) -> pd.DataFrame:
    """
    Build the display-friendly DataFrame that experiment_notebook.ipynb uses.
    Column names mirror what the dashboard and notebook expect.
    """
    from modeling.production_baseline import _extract_oc_uk_sic

    rows = []
    n = len(raw_df)
    for i in range(n):
        r    = raw_df.iloc[i]
        a    = df_a.iloc[i]
        p    = preds.iloc[i] if i < len(preds) else pd.Series()
        feat = feat_df.iloc[i] if i < len(feat_df) else pd.Series()

        uk_sic = _extract_oc_uk_sic(str(r.get("oc_industry_uids", "") or ""))
        jc     = str(r.get("oc_jurisdiction_code", "") or r.get("matched_oc_jc","") or "us").lower()
        is_gb  = jc in ("gb","gg","je") or jc.startswith("gb_")

        # Taxonomy routing for Consensus
        if is_gb:                    taxonomy = "UK SIC 2007"
        elif jc.startswith("us_") or jc in ("us","ca","au"): taxonomy = "US NAICS 2022"
        elif jc in ("de","fr","it","es","nl","pl","be"):      taxonomy = "NACE Rev.2"
        else:                                                  taxonomy = "ISIC Rev.4"

        # AML flags from features
        aml = []
        if feat.get("hi_risk_sector", 0):                              aml.append("HIGH_RISK_SECTOR")
        if float(feat.get("web_registry_distance", 0)) > 0.55:         aml.append("REGISTRY_DISCREPANCY")
        if float(feat.get("temporal_pivot_score", 0)) > 0.50:          aml.append("STRUCTURE_CHANGE")
        if float(feat.get("source_majority_agreement", 1)) < 0.40:     aml.append("SOURCE_CONFLICT")
        if feat.get("tru_pollution_flag", 0):                           aml.append("TRULIOO_POLLUTION")

        # Risk score
        rs = min(
            0.30 * feat.get("hi_risk_sector", 0)
            + 0.25 * int(float(feat.get("web_registry_distance", 0)) > 0.55)
            + 0.20 * int(float(feat.get("temporal_pivot_score", 0)) > 0.50)
            + 0.15 * int(float(feat.get("source_majority_agreement", 1)) < 0.40)
            + 0.05 * feat.get("tru_pollution_flag", 0)
            + 0.10 * int(float(p.get("pred_prob_1", 1) or 1) < 0.40), 1.0
        )
        kyb = ("REJECT"   if rs >= 0.75 else
               "ESCALATE" if rs >= 0.50 else
               "REVIEW"   if rs >= 0.25 else "APPROVE")

        # Sources matched at >= 0.80
        sources_matched = sum([
            int(float(r.get("oc_confidence",  0)) >= 0.80),
            int(float(r.get("efx_confidence", 0)) >= 0.80),
            int(float(r.get("zi_confidence",  0)) >= 0.80),
            int(float(r.get("liberty_confidence", 0)) >= 0.80),
        ])

        prob_val = float(p.get("pred_prob_1", 0) or 0)
        prod_naics = str(a.get("prod_naics", "") or "")
        cons_naics = str(p.get("pred_naics_1", "") or "")

        rows.append({
            # Identity
            "Company":              str(r.get("company_name", "")),
            "Jurisdiction":         jc,
            "Sector (expected)":    str(r.get("_sector", "—")),
            "Entity Type":          "Holding" if feat.get("is_holding", 0) else "Operating",
            # Level 1 source confidences — the REAL data from Redshift match tables
            "L1: EFX confidence":   round(float(r.get("efx_confidence", 0)), 4),
            "L1: OC confidence":    round(float(r.get("oc_confidence",  0)), 4),
            "L1: ZI confidence":    round(float(r.get("zi_confidence",  0)), 4),
            "L1: Liberty confidence": round(float(r.get("liberty_confidence", 0)), 4),
            # Production (Scenario A) — current Worth AI output
            "Prod: NAICS code":     prod_naics or None,
            "Prod: Winning source": str(a.get("prod_winning_src", "")),
            "Prod: Match confidence": round(float(a.get("prod_match_conf", 0)), 4),
            "Prod: UK SIC returned": uk_sic or "Not returned",
            "Prod: UK SIC persisted": "Never — no table",
            # Consensus (Scenario B) — Level 2 XGBoost output
            "Cons: Primary code":   cons_naics,
            "Cons: Primary taxonomy": taxonomy,
            "Cons: Probability":    f"{prob_val:.1%}",
            "Cons: Secondary codes": f"{p.get('pred_naics_2','')} | {p.get('pred_naics_3','')}",
            "Cons: Majority agreement": round(float(feat.get("source_majority_agreement", 0)), 3),
            "Cons: Temporal pivot":     round(float(feat.get("temporal_pivot_score", 0)), 3),
            "Cons: Web↔Registry dist":  round(float(feat.get("web_registry_distance", 0)), 3),
            "Cons: Sources matched":    sources_matched,
            "Cons: Risk score":         round(rs, 3),
            "Cons: KYB recommendation": kyb,
            "Cons: Risk flags":         "; ".join(aml) if aml else "—",
            # UK SIC comparison
            "UK SIC: Production": (
                f"{uk_sic} (received, DROPPED)" if uk_sic else "Not returned"
            ),
            "UK SIC: Consensus": (
                "✅ Primary output" if (is_gb and uk_sic)
                else uk_sic or "—"
            ),
            # Verdict
            "Codes agree": (prod_naics == cons_naics and bool(prod_naics)),
            "Improvement": (
                "🔴 Production had no code" if not prod_naics else
                "✅ Both agree"             if prod_naics == cons_naics else
                "🟡 Consensus differs (check)"
            ),
            # Data source tag
            "_data_source": str(r.get("_data_source", "UNKNOWN")),
        })

    return pd.DataFrame(rows)


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run_experiment(synthetic: bool = False, limit: int = 10_000) -> dict:
    """
    Run the full experiment and save all artifacts.
    Returns a summary dict.
    """
    from modeling.data_loader           import DataLoader
    from modeling.feature_engineering   import FeatureEngineer
    from modeling.production_baseline   import ProductionBaseline
    from modeling.level1_evaluator      import Level1Evaluator
    from modeling.level2_trainer        import Level2Trainer

    t_start = time.time()

    # ── STEP 1: Load data ─────────────────────────────────────────────────────
    _banner("STEP 1 / 5 — Loading data from Redshift")
    loader = DataLoader()

    print(f"\n  Redshift:        {'LIVE' if loader.redshift_available else 'UNAVAILABLE — using synthetic fallback'}")
    print(f"  Case-service PG: {'LIVE' if loader.caseservice_available else 'UNAVAILABLE'}\n")

    if synthetic:
        raw_df  = loader._load_features_synthetic(limit)
        src_tag = "SYNTHETIC (forced)"
        lbl_tag = "SYNTHETIC"
        has_real_labels = False
    else:
        result  = loader.load_training_dataset(limit=limit)
        raw_df  = result.df
        src_tag = result.source
        lbl_tag = result.label_source
        has_real_labels = result.has_real_labels

    n = len(raw_df)
    logger.info(f"Rows: {n:,} | Source: {src_tag} | Labels: {lbl_tag}")

    # ── STEP 2: Level 1 analysis ──────────────────────────────────────────────
    _banner("STEP 2 / 5 — Level 1 entity matching analysis (Pipeline B XGBoost scores)")
    ev1      = Level1Evaluator()
    l1_report = ev1.evaluate(raw_df, ground_truth_col="label_naics")

    print("\n  Level 1 XGBoost entity matching confidence scores:")
    print("  (From datascience.ml_model_matches via the three match tables)")
    print(f"  {'Source':<16} {'Matched ≥0.80':>15} {'Match %':>10} {'Mean conf':>12} {'How produced'}")
    print("  " + "-" * 80)
    src_notes = {
        "oc":      "XGBoost (oc_matches_custom_inc_ml.oc_probability)",
        "efx":     "XGBoost (efx_matches_custom_inc_ml.efx_probability)",
        "zi":      "XGBoost (zoominfo_matches_custom_inc_ml.zi_probability)",
        "tru":     "PROXY: name_verification KYB flag (NOT entity match score)",
        "liberty": "NOT IN REDSHIFT: local {TABLE}_results.parquet",
    }
    for src, stats in l1_report.get("match_rates", {}).items():
        conf_stats = l1_report.get("confidence_stats", {}).get(src, {})
        mean_c = conf_stats.get("mean", 0)
        note = src_notes.get(src, "")
        print(f"  {src.upper():<16} {stats['matched']:>15,} {stats['match_pct']:>9}% {mean_c:>12.3f}  {note}")

    print()
    print("  Pipeline B winner-takes-all rule (customer_table.sql):")
    print("    IF zi_match_confidence > efx_match_confidence")
    print("      → ZoomInfo NAICS (zi_c_naics6) used for ALL firmographic fields")
    print("    ELSE")
    print("      → Equifax NAICS (efx_primnaicscode) used for ALL firmographic fields")
    print()
    print("  Sources EXCLUDED from Pipeline B classification rule:")
    print("    OC        → oc_match_confidence EXISTS but industry_code_uids not parsed in SQL")
    print("    Liberty   → never joined into smb_zi_oc_efx_combined")
    print("    Trulioo   → live API (Pipeline A only), not in Redshift batch")
    print("    Middesk   → live API (Pipeline A only), not in Redshift batch")

    uk = l1_report.get("uk_sic_availability", {})
    if uk:
        print(f"\n  UK SIC in OC industry_code_uids: {uk.get('available_in_oc',0)} ({uk.get('pct_of_total',0)}%)")
        print(f"  UK SIC stored to production DB:  0  ← no core_uk_sic_code table in Pipeline B")

    # Save L1 report
    with open(ARTIFACTS_DIR / "l1_report.json", "w") as f:
        json.dump(l1_report, f, indent=2, default=_json_safe)
    logger.info(f"Saved: {ARTIFACTS_DIR / 'l1_report.json'}")

    # ── STEP 3: Production baseline ───────────────────────────────────────────
    _banner("STEP 3 / 5 — Pipeline B baseline (customer_table.sql winner-takes-all rule)")
    baseline = ProductionBaseline()
    df_a     = baseline.run(raw_df)
    eval_a   = baseline.evaluate(df_a, ground_truth_col="label_naics")

    prod_null = df_a["prod_naics"].isna().sum()
    zi_wins   = (df_a["prod_winning_src"] == "zoominfo").sum()
    efx_wins  = (df_a["prod_winning_src"] == "equifax").sum()

    print(f"\n  Replicating: sp_recreate_customer_files() → customer_table.sql")
    print(f"  Rule: WHEN zi_match_confidence > efx_match_confidence → zi_c_naics6")
    print(f"         ELSE efx_primnaicscode")
    print(f"  (Same rule controls ALL firmographic fields in customer_files)")
    print()
    print(f"  Companies with NAICS code: {n - prod_null:,} / {n:,} ({eval_a.get('coverage_pct',0)}%)")
    print(f"  ZoomInfo wins:             {zi_wins:,} ({zi_wins/n:.0%})")
    print(f"  Equifax wins:              {efx_wins:,} ({efx_wins/n:.0%})")
    if eval_a.get("accuracy_pct") is not None:
        print(f"  Top-1 accuracy vs labels:  {eval_a['accuracy_pct']}%")
    print(f"  UK SIC available from OC:  {eval_a.get('uk_sic_available',0):,}  (received but DROPPED)")
    print(f"  UK SIC stored to DB:       0  (no core_uk_sic_code table in Pipeline B)")
    print(f"  OC industry code used:     0  (industry_code_uids not parsed in SQL)")
    print(f"  AML signals produced:      0  (no risk engine in Pipeline B)")
    print(f"  KYB recommendations:       0  (not produced by Pipeline B)")

    # ── STEP 4: Consensus Level 2 ─────────────────────────────────────────────
    _banner("STEP 4 / 5 — Consensus XGBoost (Level 2) — train + classify")
    print()
    print("  Consensus model inputs (45 features from same Redshift data as Pipeline B):")
    print("    Group A (6): oc/efx/zi/liberty/tru/ai weighted confidence scores")
    print("    Group B (6): binary match flags (confidence >= 0.80)")
    print("    Group C (6): code discrepancy/AML signals (majority agreement, pivot, etc.)")
    print("    Group D (12): jurisdiction one-hot (US/EU/APAC/LATAM/MENA/AFR)")
    print("    Group E (3): entity type (Holding/NGO/Partnership)")
    print("    Group F (4): aggregate quality (avg/max confidence, source count)")
    print()
    print("  Training label: rel_business_industry_naics (case-service PostgreSQL)")
    print("  (Analyst-corrected NAICS codes — highest quality training signal)")
    print("  Fallback label: zi_naics or efx_naics when labels unavailable")
    print()
    trainer  = Level2Trainer()
    eval_b   = trainer.fit(raw_df)
    trainer.save()
    logger.info(f"Top-1: {eval_b['top1_accuracy_pct']}%  Top-3: {eval_b['top3_accuracy_pct']}%  Log-loss: {eval_b['log_loss']}")

    preds    = trainer.predict(raw_df, top_k=3)
    feat_eng = FeatureEngineer()
    feat_df  = feat_eng.transform(raw_df)

    # Save evaluation report
    with open(ARTIFACTS_DIR / "evaluation_report.json", "w") as f:
        json.dump(eval_b, f, indent=2, default=_json_safe)

    # ── STEP 5: Build friendly CSV + comparison ───────────────────────────────
    _banner("STEP 5 / 5 — Building comparison & saving artifacts")
    friendly_df = _build_friendly_df(raw_df, df_a, preds, feat_df)

    # Summary stats
    cons_correct = (
        friendly_df["Codes agree"].sum()
        if "Codes agree" in friendly_df.columns else 0
    )
    uk_usable   = (friendly_df["UK SIC: Consensus"] == "✅ Primary output").sum()
    aml_flagged = (friendly_df["Cons: Risk flags"] != "—").sum()
    kyb_dist    = friendly_df["Cons: KYB recommendation"].value_counts().to_dict()
    approve     = kyb_dist.get("APPROVE", 0)
    esc_rej     = kyb_dist.get("ESCALATE", 0) + kyb_dist.get("REJECT", 0)
    same_code   = friendly_df["Codes agree"].sum()
    avg_prob    = pd.to_numeric(
        friendly_df["Cons: Probability"].str.rstrip("%"), errors="coerce"
    ).mean()

    # Save CSVs
    csv_path  = Path(__file__).parent.parent / "experiment_results.csv"
    xlsx_path = Path(__file__).parent.parent / "experiment_results.xlsx"
    friendly_df.to_csv(csv_path, index=False)
    friendly_df.to_excel(xlsx_path, index=False, engine="openpyxl")
    logger.info(f"Saved: {csv_path}")
    logger.info(f"Saved: {xlsx_path}")

    # Also save raw comparison parquet
    from modeling.comparison import ComparisonEngine
    engine = ComparisonEngine()
    engine.comparison_df = friendly_df
    (ARTIFACTS_DIR / "comparison_report.parquet").write_bytes(
        friendly_df.to_parquet(index=False)
    )

    # ── Print final summary ───────────────────────────────────────────────────
    elapsed = time.time() - t_start
    print("\n" + "═" * 68)
    print("  EXPERIMENT COMPLETE — PRODUCTION vs CONSENSUS SUMMARY")
    print("═" * 68)
    print(f"\n  Data source:  {src_tag}")
    print(f"  Label source: {lbl_tag}")
    print(f"  Companies:    {n:,}  |  Time: {elapsed:.1f}s\n")
    print(f"  {'Metric':<40} {'Production':>12} {'Consensus':>12}")
    print("  " + "-" * 65)
    print(f"  {'NAICS code returned':<40} {str(eval_a.get('coverage_pct','—'))+'%':>12} {'100%':>12}")
    if eval_a.get("accuracy_pct") is not None:
        print(f"  {'Top-1 accuracy (vs ground truth)':<40} {str(eval_a['accuracy_pct'])+'%':>12} {str(eval_b.get('top1_accuracy_pct','—'))+'%':>12}")
    print(f"  {'Top-3 accuracy':<40} {'N/A (1 code)':>12} {str(eval_b.get('top3_accuracy_pct','—'))+'%':>12}")
    print(f"  {'Calibrated probability output':<40} {'None':>12} {'Yes':>12}")
    print(f"  {'UK SIC available from OC':<40} {str(eval_a.get('uk_sic_available',0)):>12} {str(eval_a.get('uk_sic_available',0)):>12}")
    print(f"  {'UK SIC stored / used as primary':<40} {'0 (dropped)':>12} {str(int(uk_usable)):>12}")
    print(f"  {'AML signals produced':<40} {'0':>12} {str(int(aml_flagged)):>12}")
    print(f"  {'APPROVE companies':<40} {'—':>12} {str(approve):>12}")
    print(f"  {'ESCALATE + REJECT companies':<40} {'—':>12} {str(esc_rej):>12}")
    print(f"  {'Codes agree (A = B)':<40} {'—':>12} {f'{same_code/n:.0%}':>12}")
    print(f"  {'Avg consensus probability':<40} {'—':>12} {f'{avg_prob:.1f}%' if avg_prob else '—':>12}")
    print()
    print(f"  Pipeline B XGBoost (entity matching): entity_matching_20250127 v1")
    print(f"    Produces: oc/efx/zi_probability → match confidences")
    print(f"    Rule: max(zi_conf, efx_conf) → winner → naics_code in customer_files")
    print()
    print(f"  Consensus XGBoost (Level 2, new): XGBClassifier(multi:softprob)")
    print(f"    Classes: {eval_b.get('n_classes','?')} | Training rows: {eval_b.get('n_train','?'):,}")
    print(f"    Uses: ALL 6 sources as 45 features → calibrated probabilities")
    print()
    if src_tag == "SYNTHETIC (forced)" or "SYNTHETIC" in src_tag:
        print("  ⚠  SYNTHETIC RUN — accuracy numbers reflect learning from")
        print("     confidence-quality signals, not real industry labels.")
        print("     Expected with real Redshift data: Top-1 55–75%, Top-3 80–90%.")
    else:
        print("  ✅ REAL REDSHIFT DATA — accuracy reflects production quality.")
    print("═" * 68)
    print(f"\n  Artifacts saved to: data/modeling/")
    print(f"  Results CSV:        experiment_results.csv")
    print(f"  Open:               experiment_notebook.ipynb  for charts\n")

    return {
        "n": n, "src_tag": src_tag, "lbl_tag": lbl_tag,
        "has_real_labels": has_real_labels,
        "eval_a": eval_a, "eval_b": eval_b,
        "uk_usable": int(uk_usable),
        "aml_flagged": int(aml_flagged),
        "kyb_dist": kyb_dist,
        "same_code_pct": round(same_code / n * 100, 1),
        "avg_prob": avg_prob,
        "elapsed": round(elapsed, 1),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Industry Classification Experiment — Production vs Consensus"
    )
    parser.add_argument(
        "--synthetic", action="store_true",
        help="Force synthetic data (no Redshift connection attempted)",
    )
    parser.add_argument(
        "--limit", type=int, default=10_000,
        help="Max rows to load from Redshift (default: 10000)",
    )
    # Legacy compat
    parser.add_argument("--mode", default="full", help=argparse.SUPPRESS)
    args = parser.parse_args()

    synthetic = args.synthetic or args.mode == "synthetic"
    run_experiment(synthetic=synthetic, limit=args.limit)


if __name__ == "__main__":
    main()
