"""
naics_mcc_classifier/pipeline.py
==================================
Orchestrates the full workflow:
  1. Load data (real Redshift or synthetic)
  2. Feature engineering
  3. Train both classifiers
  4. Evaluate on held-out test set
  5. Predict on the fallback (561499) evaluation set
  6. Produce a comparison report

Also exposes a predict() function for inference on new businesses.
"""
from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .config import (
    ARTIFACTS_DIR, NAICS_FALLBACK, MCC_FALLBACK,
    NAICS_LABEL_COL, MCC_LABEL_COL, BUSINESS_ID_COL,
    NAICS_OVERRIDE_CONFIDENCE_THRESHOLD,
)
from .data_loader import (
    build_training_dataset,
    load_naics_mcc_crosswalk,
    load_naics_lookup,
    load_mcc_lookup,
)
from .feature_engineering import build_feature_matrix
from .model import train_and_evaluate, NAICSClassifier, MCCClassifier

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Main training pipeline
# ─────────────────────────────────────────────────────────────────────────────

def run_training_pipeline(
    limit: Optional[int] = None,
    use_synthetic: bool = False,
    save_artifacts: bool = True,
) -> dict:
    """
    Full training pipeline.

    Args:
        limit          — cap rows for quick dev runs (None = all data)
        use_synthetic  — use synthetic data (no Redshift needed)
        save_artifacts — persist models and report to ARTIFACTS_DIR

    Returns:
        report dict with metrics + fallback analysis
    """
    logger.info("=== NAICS/MCC Classifier Training Pipeline ===")

    # ── 1. Load data ──────────────────────────────────────────────────────────
    logger.info("Step 1/5: Loading training and fallback data...")
    train_df, fallback_df = build_training_dataset(
        limit=limit, use_synthetic=use_synthetic
    )

    # ── 2. Load reference tables ──────────────────────────────────────────────
    logger.info("Step 2/5: Loading NAICS/MCC reference tables...")
    try:
        crosswalk_df  = load_naics_mcc_crosswalk()
        naics_lookup  = load_naics_lookup()
        mcc_lookup    = load_mcc_lookup()
    except Exception as e:
        logger.warning("Could not load PG reference tables (%s). Using minimal fallback.", e)
        crosswalk_df = pd.DataFrame(columns=["naics_code", "mcc_code"])
        naics_lookup = pd.DataFrame(columns=["naics_code", "naics_label"])
        mcc_lookup   = pd.DataFrame(columns=["mcc_code", "mcc_label"])

    crosswalk_dict  = crosswalk_df.set_index("naics_code")["mcc_code"].to_dict()
    naics_desc_dict = naics_lookup.set_index("naics_code")["naics_label"].to_dict() if len(naics_lookup) else {}
    mcc_desc_dict   = mcc_lookup.set_index("mcc_code")["mcc_label"].to_dict()       if len(mcc_lookup) else {}

    # ── 3. Feature engineering ────────────────────────────────────────────────
    logger.info("Step 3/5: Building feature matrices...")
    X_train, naics_le = build_feature_matrix(train_df, fit_encoders=True)

    # ── 4. Train models ───────────────────────────────────────────────────────
    logger.info("Step 4/5: Training NAICS and MCC classifiers...")
    naics_clf, mcc_clf, test_metrics = train_and_evaluate(
        train_df=train_df,
        feature_matrix=X_train,
        naics_le=naics_le,
        crosswalk_dict=crosswalk_dict,
    )

    # ── 5. Evaluate on 561499 fallback set ────────────────────────────────────
    logger.info("Step 5/5: Evaluating on 561499 fallback set...")
    fallback_report = _evaluate_fallback_set(
        fallback_df=fallback_df,
        naics_clf=naics_clf,
        mcc_clf=mcc_clf,
        naics_le=naics_le,
        crosswalk_dict=crosswalk_dict,
        naics_desc_dict=naics_desc_dict,
        mcc_desc_dict=mcc_desc_dict,
    )

    # ── Compile full report ────────────────────────────────────────────────────
    report = {
        "test_metrics":      test_metrics,
        "fallback_analysis": fallback_report,
        "dataset_sizes": {
            "n_train_rows":    len(train_df),
            "n_fallback_rows": len(fallback_df),
            "n_naics_classes": len(naics_clf.label_encoder.classes_),
            "n_mcc_classes":   len(mcc_clf.label_encoder.classes_),
        },
        "override_threshold": NAICS_OVERRIDE_CONFIDENCE_THRESHOLD,
        "fallback_naics": NAICS_FALLBACK,
        "fallback_mcc":   MCC_FALLBACK,
    }

    if save_artifacts:
        report_path = ARTIFACTS_DIR / "training_report.json"
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        logger.info("Training report saved to %s", report_path)

        # Save encoder for inference
        with open(ARTIFACTS_DIR / "naics_le.pkl", "wb") as f:
            pickle.dump(naics_le, f)
        with open(ARTIFACTS_DIR / "crosswalk.json", "w") as f:
            json.dump(crosswalk_dict, f)

    logger.info("=== Training pipeline complete ===")
    return report


# ─────────────────────────────────────────────────────────────────────────────
# Fallback evaluation
# ─────────────────────────────────────────────────────────────────────────────

def _evaluate_fallback_set(
    fallback_df: pd.DataFrame,
    naics_clf: NAICSClassifier,
    mcc_clf:   MCCClassifier,
    naics_le,
    crosswalk_dict: dict,
    naics_desc_dict: dict,
    mcc_desc_dict:   dict,
) -> dict:
    """
    For all businesses currently classified as 561499/5614:
    - Run the model
    - Show how many we can now classify with confidence ≥ threshold
    - Show the distribution of predicted NAICS codes
    """
    if len(fallback_df) == 0:
        return {"error": "No fallback rows to evaluate"}

    X_fallback, _ = build_feature_matrix(fallback_df, naics_le=naics_le, fit_encoders=False)

    # NAICS predictions on fallback set
    proba      = naics_clf.model.predict_proba(X_fallback.values)
    top1_idx   = np.argmax(proba, axis=1)
    top1_proba = proba[np.arange(len(proba)), top1_idx]
    top1_codes = naics_clf.label_encoder.inverse_transform(top1_idx)

    # Override mask
    override_mask = top1_proba >= NAICS_OVERRIDE_CONFIDENCE_THRESHOLD

    # MCC for overridden rows
    top1_mcc = np.array([
        crosswalk_dict.get(code, MCC_FALLBACK)
        for code in top1_codes
    ])

    fallback_df = fallback_df.copy()
    fallback_df["model_naics_code"]       = top1_codes
    fallback_df["model_naics_confidence"] = top1_proba
    fallback_df["model_mcc_code"]         = top1_mcc
    fallback_df["would_override"]         = override_mask
    fallback_df["model_naics_desc"]       = [naics_desc_dict.get(c, "Unknown") for c in top1_codes]
    fallback_df["model_mcc_desc"]         = [mcc_desc_dict.get(c, "Unknown")  for c in top1_mcc]

    # Top NAICS predictions for overridden businesses
    predicted_dist = (
        fallback_df[fallback_df["would_override"]]["model_naics_code"]
        .value_counts()
        .head(20)
        .to_dict()
    )

    # Confidence distribution
    conf_bins = [0, 0.4, 0.55, 0.70, 0.85, 1.01]
    conf_labels = ["<0.40", "0.40-0.55", "0.55-0.70", "0.70-0.85", "≥0.85"]
    conf_dist = pd.cut(
        fallback_df["model_naics_confidence"], bins=conf_bins, labels=conf_labels
    ).value_counts().sort_index().to_dict()
    conf_dist = {str(k): int(v) for k, v in conf_dist.items()}

    n_total    = len(fallback_df)
    n_override = int(override_mask.sum())

    report = {
        "n_total_fallback_businesses": n_total,
        "n_can_override":    n_override,
        "n_cannot_override": n_total - n_override,
        "override_rate_pct": round(100 * n_override / max(n_total, 1), 1),
        "confidence_distribution": conf_dist,
        "top_predicted_naics_codes": predicted_dist,
        "avg_model_confidence_all":      float(np.mean(top1_proba)),
        "avg_model_confidence_override": float(top1_proba[override_mask].mean()) if n_override > 0 else 0.0,
        "threshold_used": NAICS_OVERRIDE_CONFIDENCE_THRESHOLD,
    }

    logger.info(
        "Fallback set: %d total, %d overrideable (%.1f%%)",
        n_total, n_override, report["override_rate_pct"]
    )

    # Save the detailed fallback predictions CSV
    out_path = ARTIFACTS_DIR / "fallback_predictions.csv"
    fallback_df[[
        "business_id" if "business_id" in fallback_df.columns else fallback_df.columns[0],
        "model_naics_code", "model_naics_confidence", "model_naics_desc",
        "model_mcc_code", "model_mcc_desc", "would_override",
    ]].to_csv(out_path, index=False)
    logger.info("Fallback predictions saved to %s", out_path)

    return report


# ─────────────────────────────────────────────────────────────────────────────
# Inference: predict NAICS + MCC for one or more businesses
# ─────────────────────────────────────────────────────────────────────────────

def predict(
    businesses: list[dict],
    naics_clf: Optional[NAICSClassifier] = None,
    mcc_clf:   Optional[MCCClassifier]   = None,
    naics_le   = None,
    crosswalk_dict: Optional[dict] = None,
    naics_desc_dict: Optional[dict] = None,
    mcc_desc_dict:   Optional[dict] = None,
) -> list[dict]:
    """
    Predict NAICS + MCC for a list of business dicts.
    Auto-loads models from ARTIFACTS_DIR if not provided.

    Args:
        businesses — list of dicts with keys matching the raw feature schema
                     (at minimum: business_name, zi_c_naics6, efx_naics_primary, etc.)

    Returns:
        list of dicts:
          {
            "business_id":             str,
            "naics_code":              str,   # predicted or unchanged
            "naics_description":       str,
            "naics_confidence":        float,
            "mcc_code":                str,
            "mcc_description":         str,
            "mcc_confidence":          float,
            "was_fallback":            bool,
            "override_applied":        bool,
            "top_5_naics":             list,
          }
    """
    # Load models if not supplied
    if naics_clf is None:
        naics_clf = NAICSClassifier.load()
    if mcc_clf is None:
        mcc_clf   = MCCClassifier.load()
    if naics_le is None:
        with open(ARTIFACTS_DIR / "naics_le.pkl", "rb") as f:
            naics_le = pickle.load(f)
    if crosswalk_dict is None:
        with open(ARTIFACTS_DIR / "crosswalk.json") as f:
            crosswalk_dict = json.load(f)

    df = pd.DataFrame(businesses)

    # Fill required columns that may be missing
    for col in ["zi_c_naics6", "efx_naics_primary", "oc_naics_primary",
                "current_naics_code", "current_mcc_code", "ai_enrichment_confidence"]:
        if col not in df.columns:
            df[col] = ""

    current_naics = df["current_naics_code"].fillna(NAICS_FALLBACK).astype(str)
    current_mcc   = df["current_mcc_code"].fillna(MCC_FALLBACK).astype(str)

    X, _ = build_feature_matrix(df, naics_le=naics_le, fit_encoders=False)

    # NAICS predictions
    proba_n    = naics_clf.model.predict_proba(X.values)
    top1_idx_n = np.argmax(proba_n, axis=1)
    top1_prob_n= proba_n[np.arange(len(proba_n)), top1_idx_n]
    top1_code_n= naics_clf.label_encoder.inverse_transform(top1_idx_n)

    # MCC predictions
    proba_m    = mcc_clf.model.predict_proba(X.values)
    top1_idx_m = np.argmax(proba_m, axis=1)
    top1_prob_m= proba_m[np.arange(len(proba_m)), top1_idx_m]
    top1_code_m= mcc_clf.label_encoder.inverse_transform(top1_idx_m)

    results = []
    for i in range(len(df)):
        cur_naics = current_naics.iloc[i]
        cur_mcc   = current_mcc.iloc[i]
        is_fb     = cur_naics == NAICS_FALLBACK
        override  = is_fb and float(top1_prob_n[i]) >= NAICS_OVERRIDE_CONFIDENCE_THRESHOLD

        new_naics = top1_code_n[i] if override else cur_naics
        # MCC: use model if override, else crosswalk, else keep current
        new_mcc = (
            top1_code_m[i]
            if override and float(top1_prob_m[i]) >= 0.50
            else crosswalk_dict.get(new_naics, cur_mcc)
        )

        # Top-5 NAICS
        top5_idx   = np.argsort(proba_n[i])[::-1][:5]
        top5_codes = naics_clf.label_encoder.inverse_transform(top5_idx)
        top5 = [
            {"naics_code": c,
             "description": (naics_desc_dict or {}).get(c, ""),
             "probability": float(proba_n[i][top5_idx[j]])}
            for j, c in enumerate(top5_codes)
        ]

        results.append({
            "business_id":       str(df.iloc[i].get("business_id", f"row_{i}")),
            "naics_code":        new_naics,
            "naics_description": (naics_desc_dict or {}).get(new_naics, ""),
            "naics_confidence":  float(top1_prob_n[i]),
            "mcc_code":          new_mcc,
            "mcc_description":   (mcc_desc_dict or {}).get(new_mcc, ""),
            "mcc_confidence":    float(top1_prob_m[i]),
            "was_fallback":      is_fb,
            "override_applied":  override,
            "top_5_naics":       top5,
        })

    return results
