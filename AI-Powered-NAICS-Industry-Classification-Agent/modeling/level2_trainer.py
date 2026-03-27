"""
modeling/level2_trainer.py
===========================
Trains, evaluates, and persists the Level 2 Consensus Industry Classification
XGBoost model.

Architecture:
  Input  : 45-feature vector from feature_engineering.py (numeric, float32)
  Model  : XGBClassifier(objective="multi:softprob")
  Output : Calibrated probability distribution over NAICS 6-digit codes
           → top-1 code, top-3 alternatives, probability per code

Training data:
  X = feature matrix (45 columns)
  Y = 6-digit NAICS code string → label-encoded to contiguous integers

Saved artifacts:
  consensus_model.ubj   — XGBoost binary (loads in <1s)
  label_encoder.pkl     — maps class index ↔ NAICS string
  feature_config.json   — feature list + preprocessing metadata
  evaluation_report.json — metrics for notebook display
"""
from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score, log_loss,
    top_k_accuracy_score, classification_report,
)
import xgboost as xgb

from modeling.config import (
    ALL_FEATURES, LABEL_COLUMN, LEVEL2_XGB_PARAMS,
    TRAIN_TEST_SPLIT, MIN_SAMPLES_PER_CLASS, ARTIFACTS,
)
from modeling.feature_engineering import FeatureEngineer

logger = logging.getLogger(__name__)


class Level2Trainer:
    """
    Trains and evaluates the Consensus XGBoost industry classification model.

    Usage:
        trainer = Level2Trainer()
        report  = trainer.fit(raw_df)           # train from raw data
        preds   = trainer.predict(raw_df)       # predict on new raw data
        trainer.save()                           # save all artifacts
        trainer.load()                           # load saved model
    """

    def __init__(self) -> None:
        self.model: Optional[xgb.XGBClassifier] = None
        self.label_encoder  = LabelEncoder()
        self.feature_engineer = FeatureEngineer()
        self._class_index: Optional[np.ndarray] = None  # subset of classes in training
        self._trained = False

    # ── Public API ────────────────────────────────────────────────────────────

    def fit(self, raw_df: pd.DataFrame) -> dict:
        """
        Train the model on raw_df. Handles class filtering, label encoding,
        train/test split, model fitting and evaluation.
        Returns evaluation report dict.
        """
        logger.info("Starting Level 2 training …")

        # Build feature matrix
        feat_df = self.feature_engineer.transform(raw_df)

        # Validate label column
        if LABEL_COLUMN not in feat_df.columns:
            raise ValueError(
                f"Label column '{LABEL_COLUMN}' not found. "
                "Run data_loader.load_training_dataset() first."
            )

        # Drop classes with fewer than MIN_SAMPLES_PER_CLASS examples
        label_counts = feat_df[LABEL_COLUMN].value_counts()
        valid_labels = label_counts[label_counts >= MIN_SAMPLES_PER_CLASS].index
        dropped = len(label_counts) - len(valid_labels)
        if dropped:
            logger.info(
                f"Dropped {dropped} NAICS classes with < {MIN_SAMPLES_PER_CLASS} samples."
            )
        feat_df = feat_df[feat_df[LABEL_COLUMN].isin(valid_labels)].copy()

        if len(feat_df) < 50:
            raise ValueError(
                f"Only {len(feat_df)} valid training rows after filtering. "
                "Need at least 50. Check data source and label column."
            )

        # Encode labels
        y_str = feat_df[LABEL_COLUMN].astype(str).values
        y_enc = self.label_encoder.fit_transform(y_str)

        # Feature matrix
        missing = [c for c in ALL_FEATURES if c not in feat_df.columns]
        if missing:
            logger.warning(f"Missing {len(missing)} features — filling with 0: {missing[:5]}")
            for c in missing:
                feat_df[c] = 0.0
        X = feat_df[ALL_FEATURES].values.astype(np.float32)

        # Train / test split
        X_tr, X_te, y_tr, y_te = train_test_split(
            X, y_enc,
            test_size=TRAIN_TEST_SPLIT,
            random_state=42,
        )

        # Remap labels to contiguous range (required after split may exclude classes)
        classes_in_train = np.unique(y_tr)
        remap = {c: i for i, c in enumerate(classes_in_train)}
        y_tr_r = np.array([remap[c] for c in y_tr])

        mask_te = np.isin(y_te, classes_in_train)
        y_te_r  = np.array([remap[c] for c in y_te[mask_te]])
        X_te_r  = X_te[mask_te]

        n_cls = len(classes_in_train)
        self._class_index = classes_in_train

        logger.info(
            f"Training: {len(X_tr)} rows | Test: {int(mask_te.sum())} rows | "
            f"Classes: {n_cls}"
        )

        # Build and fit the model
        params = {**LEVEL2_XGB_PARAMS, "num_class": n_cls}
        self.model = xgb.XGBClassifier(**params)
        self.model.fit(
            X_tr, y_tr_r,
            eval_set=[(X_te_r, y_te_r)],
            verbose=False,
        )
        self._trained = True

        # Evaluate
        report = self._evaluate(X_te_r, y_te_r, n_cls, feat_df, X, y_enc, remap)
        report["n_train"]   = len(X_tr)
        report["n_test"]    = int(mask_te.sum())
        report["n_classes"] = n_cls
        report["n_total"]   = len(feat_df)
        report["data_source"] = str(feat_df.get("_data_source", pd.Series(["unknown"]))[0]
                                    if "_data_source" in feat_df.columns
                                    else "unknown")

        logger.info(
            f"Level 2 results → "
            f"Top-1: {report['top1_accuracy_pct']:.1f}%  "
            f"Top-3: {report['top3_accuracy_pct']:.1f}%  "
            f"Log-loss: {report['log_loss']:.4f}"
        )

        # Save evaluation report
        with open(ARTIFACTS["evaluation_report"], "w") as f:
            json.dump(report, f, indent=2, default=_json_safe)
        logger.info(f"Evaluation report → {ARTIFACTS['evaluation_report']}")

        return report

    def predict(
        self, raw_df: pd.DataFrame, top_k: int = 3
    ) -> pd.DataFrame:
        """
        Predict industry codes for new raw data.
        Returns DataFrame with columns:
          pred_naics_1, pred_prob_1, pred_naics_2, pred_prob_2, pred_naics_3, pred_prob_3
        """
        if not self._trained:
            self.load()

        feat_df = self.feature_engineer.transform(raw_df)
        for c in ALL_FEATURES:
            if c not in feat_df.columns:
                feat_df[c] = 0.0
        X = feat_df[ALL_FEATURES].values.astype(np.float32)

        probs = self.model.predict_proba(X)  # shape (n, n_train_classes)

        rows = []
        for i, prob_vec in enumerate(probs):
            top_idx = np.argsort(prob_vec)[::-1][:top_k]
            row = {}
            for rank, idx in enumerate(top_idx, 1):
                # Map from training-class index back to original label-encoder index
                orig_idx = self._class_index[idx]
                naics    = self.label_encoder.classes_[orig_idx]
                row[f"pred_naics_{rank}"] = naics
                row[f"pred_prob_{rank}"]  = round(float(prob_vec[idx]), 4)
            rows.append(row)

        return pd.DataFrame(rows)

    def save(self) -> None:
        """Persist all artifacts to ARTIFACTS_DIR."""
        if not self._trained:
            raise RuntimeError("Model has not been trained yet.")

        self.model.save_model(str(ARTIFACTS["level2_model"]))
        with open(ARTIFACTS["label_encoder"], "wb") as f:
            pickle.dump(self.label_encoder, f)
        with open(ARTIFACTS["feature_config"], "w") as f:
            json.dump({
                "features":          ALL_FEATURES,
                "n_features":        len(ALL_FEATURES),
                "label_column":      LABEL_COLUMN,
                "n_classes":         int(len(self.label_encoder.classes_)),
                "xgb_params":        LEVEL2_XGB_PARAMS,
            }, f, indent=2)

        logger.info(
            f"Saved model artifacts:\n"
            f"  {ARTIFACTS['level2_model']}\n"
            f"  {ARTIFACTS['label_encoder']}\n"
            f"  {ARTIFACTS['feature_config']}"
        )

    def load(self) -> None:
        """Load persisted artifacts."""
        if not Path(ARTIFACTS["level2_model"]).exists():
            raise FileNotFoundError(
                f"Model artifact not found: {ARTIFACTS['level2_model']}. "
                "Run trainer.fit() first."
            )
        params = {**LEVEL2_XGB_PARAMS}
        params.pop("random_state", None)
        self.model = xgb.XGBClassifier(**params)
        self.model.load_model(str(ARTIFACTS["level2_model"]))
        with open(ARTIFACTS["label_encoder"], "rb") as f:
            self.label_encoder = pickle.load(f)
        self._trained = True
        logger.info(f"Loaded model from {ARTIFACTS['level2_model']}")

    # ── Evaluation helpers ────────────────────────────────────────────────────

    def _evaluate(
        self,
        X_te: np.ndarray,
        y_te: np.ndarray,
        n_cls: int,
        feat_df: pd.DataFrame,
        X_full: np.ndarray,
        y_full: np.ndarray,
        remap: dict,
    ) -> dict:
        probs  = self.model.predict_proba(X_te)
        preds  = probs.argmax(axis=1)
        labels = list(range(n_cls))

        top1 = accuracy_score(y_te, preds)
        top3 = top_k_accuracy_score(y_te, probs, k=min(3, n_cls), labels=labels)
        ll   = log_loss(y_te, probs, labels=labels)

        # Feature importance top-10
        fi = dict(
            sorted(
                zip(ALL_FEATURES, self.model.feature_importances_),
                key=lambda x: x[1], reverse=True,
            )[:10]
        )

        # Per-sector accuracy (if sector column available)
        per_sector: dict = {}
        if "_sector" in feat_df.columns:
            # Remap y_full to contiguous for evaluation
            mask_full = np.isin(y_full, list(remap.keys()))
            y_full_r  = np.array([remap[c] for c in y_full[mask_full]])
            probs_full = self.model.predict_proba(X_full[mask_full])
            feat_sub   = feat_df[mask_full].copy()
            feat_sub["__pred"] = probs_full.argmax(axis=1)
            feat_sub["__true"] = y_full_r
            feat_sub["__ok"]   = (feat_sub["__pred"] == feat_sub["__true"]).astype(int)
            for sector, grp in feat_sub.groupby("_sector"):
                per_sector[str(sector)] = {
                    "n":        len(grp),
                    "top1_pct": round(grp["__ok"].mean() * 100, 1),
                }

        return {
            "top1_accuracy_pct": round(top1 * 100, 1),
            "top3_accuracy_pct": round(top3 * 100, 1),
            "log_loss":          round(ll, 4),
            "top10_features":    {k: round(float(v), 5) for k, v in fi.items()},
            "per_sector":        per_sector,
        }

    def cross_validate(self, raw_df: pd.DataFrame, n_folds: int = 5) -> dict:
        """
        Run stratified k-fold cross-validation. Returns mean ± std of metrics.
        Useful with small datasets where a single split is noisy.
        """
        feat_df = self.feature_engineer.transform(raw_df)
        label_counts = feat_df[LABEL_COLUMN].value_counts()
        valid_labels = label_counts[label_counts >= n_folds].index
        feat_df = feat_df[feat_df[LABEL_COLUMN].isin(valid_labels)].copy()

        le = LabelEncoder()
        y  = le.fit_transform(feat_df[LABEL_COLUMN].astype(str).values)
        for c in ALL_FEATURES:
            if c not in feat_df.columns:
                feat_df[c] = 0.0
        X  = feat_df[ALL_FEATURES].values.astype(np.float32)

        skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
        top1_scores, top3_scores, ll_scores = [], [], []

        for fold, (tr_idx, te_idx) in enumerate(skf.split(X, y), 1):
            X_tr, X_te = X[tr_idx], X[te_idx]
            y_tr, y_te = y[tr_idx], y[te_idx]

            classes_tr = np.unique(y_tr)
            remap = {c: i for i, c in enumerate(classes_tr)}
            mask  = np.isin(y_te, classes_tr)
            y_tr_r = np.array([remap[c] for c in y_tr])
            y_te_r = np.array([remap[c] for c in y_te[mask]])
            n_cls  = len(classes_tr)

            m = xgb.XGBClassifier(**{**LEVEL2_XGB_PARAMS, "num_class": n_cls})
            m.fit(X_tr, y_tr_r, verbose=False)
            probs = m.predict_proba(X_te[mask])
            labels = list(range(n_cls))

            top1_scores.append(accuracy_score(y_te_r, probs.argmax(1)))
            top3_scores.append(top_k_accuracy_score(y_te_r, probs, k=min(3,n_cls), labels=labels))
            ll_scores.append(log_loss(y_te_r, probs, labels=labels))
            logger.info(
                f"  Fold {fold}/{n_folds}: "
                f"Top-1={top1_scores[-1]:.1%}  Top-3={top3_scores[-1]:.1%}"
            )

        return {
            "n_folds":          n_folds,
            "top1_mean":        round(float(np.mean(top1_scores)) * 100, 1),
            "top1_std":         round(float(np.std(top1_scores)) * 100, 1),
            "top3_mean":        round(float(np.mean(top3_scores)) * 100, 1),
            "top3_std":         round(float(np.std(top3_scores)) * 100, 1),
            "log_loss_mean":    round(float(np.mean(ll_scores)), 4),
            "log_loss_std":     round(float(np.std(ll_scores)), 4),
        }


def _json_safe(obj):
    if isinstance(obj, (np.integer,)):  return int(obj)
    if isinstance(obj, (np.floating,)): return float(obj)
    if isinstance(obj, np.ndarray):     return obj.tolist()
    return str(obj)
