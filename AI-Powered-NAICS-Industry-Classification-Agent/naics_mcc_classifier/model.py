"""
naics_mcc_classifier/model.py
===============================
Two XGBoost classifiers:
  1. NAICSClassifier  — predicts the correct 6-digit NAICS 2022 code
  2. MCCClassifier    — predicts the correct 4-digit MCC code

Both use multi:softprob to produce calibrated top-K probabilities.

Design:
  - The NAICS model is the primary model; MCC is derived from the NAICS
    prediction via the rel_naics_mcc crosswalk when confidence is high.
  - Only overrides current 561499/5614 codes when model confidence
    exceeds NAICS_OVERRIDE_CONFIDENCE_THRESHOLD.
  - Fallback chain when model < threshold:
      NAICS: keep 561499 (no override — honest "don't know")
      MCC:   derive from NAICS crosswalk if NAICS changed, else keep 5614
"""
from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.preprocessing import LabelEncoder

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from .config import (
    ARTIFACTS_DIR,
    NAICS_FALLBACK, MCC_FALLBACK,
    NAICS_XGB_PARAMS, MCC_XGB_PARAMS,
    NAICS_OVERRIDE_CONFIDENCE_THRESHOLD,
    MCC_OVERRIDE_CONFIDENCE_THRESHOLD,
    NAICS_LABEL_COL, MCC_LABEL_COL, BUSINESS_ID_COL,
    FEATURE_NAMES,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Helper: Label encoding utilities
# ─────────────────────────────────────────────────────────────────────────────

def make_label_encoder(series: pd.Series) -> LabelEncoder:
    """Fit a LabelEncoder on a code series, filtering to valid non-fallback values."""
    codes = (
        series.dropna()
              .astype(str)
              .str.strip()
              .loc[lambda s: s.str.match(r"^\d+$") & (s != "0")]
              .unique()
    )
    le = LabelEncoder()
    le.fit(sorted(codes))
    return le


def encode_labels(
    series: pd.Series, le: LabelEncoder, fallback_code: str
) -> tuple[pd.Series, np.ndarray]:
    """
    Returns:
        encoded  — integer-encoded labels (unknown codes → -1)
        mask     — boolean mask of rows with valid labels
    """
    encoded = []
    mask    = []
    for val in series.astype(str).str.strip():
        if val == fallback_code or val == "" or val == "nan":
            encoded.append(-1)
            mask.append(False)
        else:
            try:
                encoded.append(int(le.transform([val])[0]))
                mask.append(True)
            except ValueError:
                encoded.append(-1)
                mask.append(False)
    return pd.Series(encoded, index=series.index), np.array(mask)


# ─────────────────────────────────────────────────────────────────────────────
# NAICS Classifier
# ─────────────────────────────────────────────────────────────────────────────

class NAICSClassifier:
    """
    XGBoost multi-class classifier for NAICS 2022 6-digit codes.

    Training:
      - Labels: label_naics6 column (non-fallback rows only)
      - Features: config.FEATURE_NAMES (from feature_engineering.py)
      - Evaluation: top-1 accuracy, top-3 accuracy (sector-level), log-loss

    Inference:
      - Returns top-5 (code, probability) for each business
      - Override threshold: config.NAICS_OVERRIDE_CONFIDENCE_THRESHOLD
    """

    def __init__(self):
        if not HAS_XGB:
            raise ImportError("xgboost is required. pip install xgboost")
        self.model: Optional[xgb.XGBClassifier] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.feature_names = FEATURE_NAMES
        self.metrics: dict = {}

    # ── Training ──────────────────────────────────────────────────────────────

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
    ) -> "NAICSClassifier":
        """
        Fits the NAICS classifier.

        Args:
            X_train, X_val  — feature matrices (from feature_engineering.build_feature_matrix)
            y_train, y_val  — label_naics6 series (will be label-encoded internally)
        """
        # Fit label encoder on TRAINING labels only.
        # Fitting on train+val caused class index mismatches: some NAICS codes appear
        # only in the val split (not in train), so XGBoost sees different unique label
        # sets in train vs val and raises "Invalid classes inferred from unique values of y".
        # By fitting only on train, val examples with unseen codes get -1 from
        # encode_labels() and are filtered out via mask_val — clean and consistent.
        self.label_encoder = make_label_encoder(y_train)
        n_classes = len(self.label_encoder.classes_)
        logger.info("NAICS label encoder: %d unique classes", n_classes)

        y_train_enc, mask_train = encode_labels(y_train, self.label_encoder, NAICS_FALLBACK)
        y_val_enc,   mask_val   = encode_labels(y_val,   self.label_encoder, NAICS_FALLBACK)

        X_tr = X_train[mask_train].values
        y_tr = y_train_enc[mask_train].values
        X_vl = X_val[mask_val].values
        y_vl = y_val_enc[mask_val].values

        logger.info(
            "NAICS training: %d rows, validation: %d rows, classes: %d",
            len(X_tr), len(X_vl), n_classes,
        )

        params = {**NAICS_XGB_PARAMS, "num_class": n_classes}
        early = params.pop("early_stopping_rounds")

        self.model = xgb.XGBClassifier(**params, early_stopping_rounds=early)
        self.model.fit(
            X_tr, y_tr,
            eval_set=[(X_vl, y_vl)],
            verbose=50,
        )

        # Compute metrics
        proba_val = self.model.predict_proba(X_vl)
        preds_val = np.argmax(proba_val, axis=1)
        top1_acc  = float((preds_val == y_vl).mean())
        # Top-3 accuracy
        top3_acc  = float(np.mean([
            y_vl[i] in np.argsort(proba_val[i])[-3:]
            for i in range(len(y_vl))
        ]))
        # Sector-level accuracy (2-digit)
        codes_pred = self.label_encoder.inverse_transform(preds_val)
        codes_true = self.label_encoder.inverse_transform(y_vl)
        sector_acc = float((
            pd.Series(codes_pred).str[:2] == pd.Series(codes_true).str[:2]
        ).mean())

        self.metrics = {
            "val_top1_accuracy":   top1_acc,
            "val_top3_accuracy":   top3_acc,
            "val_sector_accuracy": sector_acc,
            "n_classes":           n_classes,
            "n_train":             len(X_tr),
            "n_val":               len(X_vl),
        }
        logger.info(
            "NAICS validation: top-1=%.3f  top-3=%.3f  sector=%.3f",
            top1_acc, top3_acc, sector_acc,
        )
        return self

    # ── Inference ─────────────────────────────────────────────────────────────

    def predict_top_k(
        self, X: pd.DataFrame, k: int = 5
    ) -> list[list[dict]]:
        """
        Returns top-k (code, probability) for each row.

        Output per row:
          [
            {"naics_code": "722511", "description": "...", "probability": 0.82},
            {"naics_code": "722513", "description": "...", "probability": 0.12},
            ...
          ]
        """
        assert self.model is not None and self.label_encoder is not None

        proba = self.model.predict_proba(X.values)
        results = []
        for row_proba in proba:
            top_idx = np.argsort(row_proba)[::-1][:k]
            results.append([
                {
                    "naics_code":   self.label_encoder.inverse_transform([idx])[0],
                    "probability":  float(row_proba[idx]),
                }
                for idx in top_idx
            ])
        return results

    def predict_with_override(
        self,
        X: pd.DataFrame,
        current_naics: pd.Series,
        current_mcc: pd.Series,
        crosswalk: dict,  # naics_code → mcc_code
    ) -> pd.DataFrame:
        """
        For each row: if current NAICS is the fallback (561499) AND
        model top-1 confidence ≥ THRESHOLD → override with model prediction.
        Also updates MCC via crosswalk.

        Returns DataFrame with columns:
          business_id (index), new_naics_code, new_mcc_code,
          naics_changed (bool), mcc_changed (bool),
          model_naics_confidence, model_top_k (list of top-5 dicts)
        """
        proba      = self.model.predict_proba(X.values)
        top1_idx   = np.argmax(proba, axis=1)
        top1_proba = proba[np.arange(len(proba)), top1_idx]
        top1_codes = self.label_encoder.inverse_transform(top1_idx)

        rows = []
        for i, (idx, code, prob, cur_naics, cur_mcc) in enumerate(zip(
            X.index, top1_codes, top1_proba,
            current_naics.values, current_mcc.values
        )):
            cur_naics_str = str(cur_naics).strip()
            cur_mcc_str   = str(cur_mcc).strip()

            is_currently_fallback = cur_naics_str == NAICS_FALLBACK
            should_override = is_currently_fallback and prob >= NAICS_OVERRIDE_CONFIDENCE_THRESHOLD

            new_naics = code          if should_override else cur_naics_str
            new_mcc   = crosswalk.get(new_naics, cur_mcc_str) if should_override else cur_mcc_str

            # Top-K for transparency
            top_k_idx   = np.argsort(proba[i])[::-1][:5]
            top_k_codes = self.label_encoder.inverse_transform(top_k_idx)
            top_k_info  = [
                {"naics_code": c, "probability": float(proba[i][top_k_idx[j]])}
                for j, c in enumerate(top_k_codes)
            ]

            rows.append({
                "new_naics_code":          new_naics,
                "new_mcc_code":            new_mcc,
                "naics_changed":           new_naics != cur_naics_str,
                "mcc_changed":             new_mcc   != cur_mcc_str,
                "model_naics_confidence":  float(prob),
                "model_top_k":             json.dumps(top_k_info),
                "was_fallback":            is_currently_fallback,
                "override_applied":        should_override,
            })

        out = pd.DataFrame(rows, index=X.index)
        return out

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> Path:
        path = path or ARTIFACTS_DIR / "naics_classifier.pkl"
        with open(path, "wb") as f:
            pickle.dump(self, f)
        logger.info("NAICS classifier saved to %s", path)
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "NAICSClassifier":
        path = path or ARTIFACTS_DIR / "naics_classifier.pkl"
        with open(path, "rb") as f:
            obj = pickle.load(f)
        logger.info("NAICS classifier loaded from %s", path)
        return obj


# ─────────────────────────────────────────────────────────────────────────────
# MCC Classifier
# ─────────────────────────────────────────────────────────────────────────────

class MCCClassifier:
    """
    XGBoost classifier for MCC codes.

    In most cases, the NAICS→MCC crosswalk is sufficient. This model
    handles the cases where:
      - The NAICS code changed (via NAICSClassifier) and the new NAICS
        is ambiguous in the crosswalk (one NAICS → multiple MCCs)
      - No NAICS change but MCC is 5614 and direct MCC signal is available

    The MCC model uses the same feature matrix as the NAICS model, plus
    the NAICS model's top-1 prediction as an additional feature.
    """

    def __init__(self):
        if not HAS_XGB:
            raise ImportError("xgboost is required. pip install xgboost")
        self.model: Optional[xgb.XGBClassifier] = None
        self.label_encoder: Optional[LabelEncoder] = None
        self.metrics: dict = {}

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame,
        y_val: pd.Series,
    ) -> "MCCClassifier":
        # Fit on training labels only (not train+val) — same reason as NAICSClassifier
        self.label_encoder = make_label_encoder(y_train)
        n_classes = len(self.label_encoder.classes_)
        logger.info("MCC label encoder: %d unique classes", n_classes)

        y_train_enc, mask_train = encode_labels(y_train, self.label_encoder, MCC_FALLBACK)
        y_val_enc,   mask_val   = encode_labels(y_val,   self.label_encoder, MCC_FALLBACK)

        X_tr = X_train[mask_train].values
        y_tr = y_train_enc[mask_train].values
        X_vl = X_val[mask_val].values
        y_vl = y_val_enc[mask_val].values

        params = {**MCC_XGB_PARAMS, "num_class": n_classes}
        early  = params.pop("early_stopping_rounds")

        self.model = xgb.XGBClassifier(**params, early_stopping_rounds=early)
        self.model.fit(
            X_tr, y_tr,
            eval_set=[(X_vl, y_vl)],
            verbose=50,
        )

        preds = np.argmax(self.model.predict_proba(X_vl), axis=1)
        top1  = float((preds == y_vl).mean())
        self.metrics = {"val_top1_accuracy": top1, "n_classes": n_classes}
        logger.info("MCC validation top-1 accuracy: %.3f", top1)
        return self

    def predict_top_k(self, X: pd.DataFrame, k: int = 3) -> list[list[dict]]:
        proba   = self.model.predict_proba(X.values)
        results = []
        for row_proba in proba:
            top_idx = np.argsort(row_proba)[::-1][:k]
            results.append([
                {"mcc_code": self.label_encoder.inverse_transform([i])[0],
                 "probability": float(row_proba[i])}
                for i in top_idx
            ])
        return results

    def save(self, path: Optional[Path] = None) -> Path:
        path = path or ARTIFACTS_DIR / "mcc_classifier.pkl"
        with open(path, "wb") as f:
            pickle.dump(self, f)
        return path

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "MCCClassifier":
        path = path or ARTIFACTS_DIR / "mcc_classifier.pkl"
        with open(path, "rb") as f:
            return pickle.load(f)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience: train + evaluate both models in one call
# ─────────────────────────────────────────────────────────────────────────────

def train_and_evaluate(
    train_df: pd.DataFrame,
    feature_matrix: pd.DataFrame,
    naics_le: LabelEncoder,
    crosswalk_dict: dict,
    test_size: float = 0.20,
    random_state: int = 42,
) -> tuple[NAICSClassifier, MCCClassifier, dict]:
    """
    Splits data, trains both classifiers, evaluates on held-out test set.

    Args:
        train_df        — raw DataFrame (includes label columns)
        feature_matrix  — numeric features (same index as train_df)
        naics_le        — NAICS LabelEncoder from feature_engineering
        crosswalk_dict  — {naics_code: mcc_code} from load_naics_mcc_crosswalk()
        test_size       — fraction for test split
        random_state    — reproducibility

    Returns:
        naics_clf  — trained NAICSClassifier
        mcc_clf    — trained MCCClassifier
        results    — dict with all evaluation metrics
    """
    y_naics = train_df[NAICS_LABEL_COL].astype(str)
    y_mcc   = train_df[MCC_LABEL_COL].astype(str)

    # ── Stratified split on NAICS 2-digit sector ──────────────────────────────
    # Stratification fails when any sector has fewer than 2 members
    # (sklearn requires at least 2 members per class for StratifiedShuffleSplit).
    # Real production data has rare NAICS sectors with only 1 business.
    # Fix: use stratify only for sectors that have ≥ 2 members; fall back to
    # un-stratified split if too many rare sectors exist.
    strat = y_naics.str[:2]
    sector_counts = strat.value_counts()
    rare_sectors  = sector_counts[sector_counts < 2].index
    if len(rare_sectors) > 0:
        logger.warning(
            "%d NAICS sector(s) have only 1 member — removing from training to allow "
            "stratified split: %s",
            len(rare_sectors), list(rare_sectors)
        )
        keep_mask = ~strat.isin(rare_sectors)
        feature_matrix = feature_matrix[keep_mask]
        y_naics = y_naics[keep_mask]
        y_mcc   = y_mcc[keep_mask]
        strat   = strat[keep_mask]
        logger.info("Kept %d rows after removing rare-sector businesses", keep_mask.sum())

    try:
        X_tr, X_te, yn_tr, yn_te, ym_tr, ym_te = train_test_split(
            feature_matrix, y_naics, y_mcc,
            test_size=test_size,
            stratify=strat,
            random_state=random_state,
        )
    except ValueError as e:
        logger.warning(
            "Stratified split failed (%s) — falling back to random split.", e
        )
        X_tr, X_te, yn_tr, yn_te, ym_tr, ym_te = train_test_split(
            feature_matrix, y_naics, y_mcc,
            test_size=test_size,
            stratify=None,
            random_state=random_state,
        )

    # Further split train into train/val
    strat_tr = yn_tr.str[:2]
    strat_tr_counts = strat_tr.value_counts()
    use_stratify_val = (strat_tr_counts >= 2).all()
    try:
        X_tr2, X_vl, yn_tr2, yn_vl, ym_tr2, ym_vl = train_test_split(
            X_tr, yn_tr, ym_tr,
            test_size=0.15,
            stratify=strat_tr if use_stratify_val else None,
            random_state=random_state,
        )
    except ValueError:
        X_tr2, X_vl, yn_tr2, yn_vl, ym_tr2, ym_vl = train_test_split(
            X_tr, yn_tr, ym_tr,
            test_size=0.15,
            stratify=None,
            random_state=random_state,
        )

    logger.info("Split sizes: train=%d, val=%d, test=%d", len(X_tr2), len(X_vl), len(X_te))

    # ── Train NAICS classifier ────────────────────────────────────────────────
    naics_clf = NAICSClassifier()
    naics_clf.fit(X_tr2, yn_tr2, X_vl, yn_vl)
    naics_clf.save()

    # ── Train MCC classifier ──────────────────────────────────────────────────
    mcc_clf = MCCClassifier()
    mcc_clf.fit(X_tr2, ym_tr2, X_vl, ym_vl)
    mcc_clf.save()

    # ── Test-set evaluation ───────────────────────────────────────────────────
    results = evaluate_on_test(
        naics_clf=naics_clf,
        mcc_clf=mcc_clf,
        X_test=X_te,
        y_naics_test=yn_te,
        y_mcc_test=ym_te,
        crosswalk_dict=crosswalk_dict,
    )

    return naics_clf, mcc_clf, results


def evaluate_on_test(
    naics_clf: NAICSClassifier,
    mcc_clf:   MCCClassifier,
    X_test: pd.DataFrame,
    y_naics_test: pd.Series,
    y_mcc_test:   pd.Series,
    crosswalk_dict: dict,
) -> dict:
    """Compute test-set metrics for both classifiers."""

    # NAICS predictions
    proba_naics  = naics_clf.model.predict_proba(X_test.values)
    top1_idx     = np.argmax(proba_naics, axis=1)
    top1_codes   = naics_clf.label_encoder.inverse_transform(top1_idx)
    top1_proba   = proba_naics[np.arange(len(proba_naics)), top1_idx]

    true_enc, mask = encode_labels(y_naics_test, naics_clf.label_encoder, NAICS_FALLBACK)
    true_enc_np    = true_enc[mask].values
    pred_enc_np    = top1_idx[mask]
    true_codes     = naics_clf.label_encoder.inverse_transform(true_enc_np)
    pred_codes_filt= top1_codes[mask]

    naics_top1_acc     = float((pred_enc_np == true_enc_np).mean())
    naics_sector_acc   = float(
        (pd.Series(pred_codes_filt).str[:2].values == pd.Series(true_codes).str[:2].values).mean()
    )
    # Top-3 accuracy
    naics_top3_acc = float(np.mean([
        true_enc_np[i] in np.argsort(proba_naics[mask][i])[-3:]
        for i in range(len(true_enc_np))
    ]))

    # MCC predictions
    proba_mcc   = mcc_clf.model.predict_proba(X_test.values)
    top1_mcc_idx= np.argmax(proba_mcc, axis=1)
    top1_mcc    = mcc_clf.label_encoder.inverse_transform(top1_mcc_idx)

    true_mcc_enc, mask_mcc = encode_labels(y_mcc_test, mcc_clf.label_encoder, MCC_FALLBACK)
    mcc_top1_acc = float(
        (top1_mcc_idx[mask_mcc] == true_mcc_enc[mask_mcc].values).mean()
    )

    results = {
        "naics_test_top1_accuracy":   naics_top1_acc,
        "naics_test_top3_accuracy":   naics_top3_acc,
        "naics_test_sector_accuracy": naics_sector_acc,
        "mcc_test_top1_accuracy":     mcc_top1_acc,
        "n_test_naics":               int(mask.sum()),
        "n_test_mcc":                 int(mask_mcc.sum()),
        "naics_val_metrics":          naics_clf.metrics,
        "mcc_val_metrics":            mcc_clf.metrics,
    }
    logger.info(
        "TEST — NAICS top-1=%.3f top-3=%.3f sector=%.3f | MCC top-1=%.3f",
        naics_top1_acc, naics_top3_acc, naics_sector_acc, mcc_top1_acc,
    )
    return results
