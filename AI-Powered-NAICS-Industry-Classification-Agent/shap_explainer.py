"""
shap_explainer.py
=================
SHAP-based explainability for the Consensus Level 2 XGBoost model.

Standalone module — zero modifications to consensus_engine.py required.

Usage:
    from shap_explainer import ConsensusExplainer
    explainer = ConsensusExplainer(consensus_engine)
    result = explainer.explain_single(bundle)
    batch   = explainer.explain_batch(bundles)

SHAP for multi:softprob
-----------------------
XGBoost multi-class produces SHAP values of shape:
    (n_samples, n_features, n_classes)

For explaining a single prediction we take the slice for the predicted class:
    shap_values[sample_idx, :, predicted_class_idx]   → shape (38,)

Positive SHAP = feature pushes the model toward this class.
Negative SHAP = feature pushes the model away from this class.

The base value (expected model output in log-odds) is added back to
reconstruct the final prediction.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# ── All 38 feature names in exact order from FeatureEngineer ─────────────────
FEATURE_NAMES: list[str] = [
    # [0-5] Per-source weighted confidence
    "OC weighted confidence",
    "Equifax weighted confidence",
    "Trulioo weighted confidence",
    "ZoomInfo weighted confidence",
    "Liberty weighted confidence",
    "AI Semantic weighted confidence",
    # [6-11] Per-source match flags
    "OC matched (MATCHED=1)",
    "Equifax matched",
    "Trulioo matched",
    "ZoomInfo matched",
    "Liberty matched",
    "AI Semantic matched",
    # [12] Trulioo pollution
    "Trulioo pollution flag",
    # [13] Web vs Registry distance
    "Web↔Registry semantic distance",
    # [14] Temporal pivot
    "Temporal pivot score (AML)",
    # [15] Cross-taxonomy agreement
    "Cross-taxonomy agreement",
    # [16-18] Entity type
    "Entity type: Holding",
    "Entity type: NGO",
    "Entity type: Partnership",
    # [19-28] Jurisdiction one-hot
    "Jurisdiction: US (federal)",
    "Jurisdiction: US state (us_mo …)",
    "Jurisdiction: Canada (federal)",
    "Jurisdiction: CA province",
    "Jurisdiction: EU",
    "Jurisdiction: APAC",
    "Jurisdiction: LATAM",
    "Jurisdiction: MENA",
    "Jurisdiction: Africa",
    "Jurisdiction: Other",
    # [29-30] Jurisdiction flags
    "Is subnational jurisdiction",
    "Is NAICS jurisdiction",
    # [31] Majority code agreement
    "Source majority code agreement",
    # [32] High-risk NAICS
    "High-risk NAICS sector flag",
    # [33] Code diversity
    "Vendor code diversity (n_unique)",
    # [34] Registry vs AI distance
    "Registry vs AI label distance",
    # [35-36] Aggregate confidence
    "Avg source confidence",
    "Max source confidence",
    # [37] Source count
    "Source count (normalised)",
]

# Plain-English interpretation of each feature for the analyst card
FEATURE_INTERPRETATIONS: dict[str, str] = {
    "OC weighted confidence":         "OpenCorporates entity match strength",
    "Equifax weighted confidence":    "Equifax entity match strength",
    "Trulioo weighted confidence":    "Trulioo entity match strength",
    "ZoomInfo weighted confidence":   "ZoomInfo entity match strength",
    "Liberty weighted confidence":    "Liberty Data entity match strength",
    "AI Semantic weighted confidence":"AI web-search entity confidence",
    "OC matched (MATCHED=1)":         "OpenCorporates confirmed entity match",
    "Equifax matched":                "Equifax confirmed entity match",
    "Trulioo matched":                "Trulioo confirmed entity match",
    "ZoomInfo matched":               "ZoomInfo confirmed entity match",
    "Liberty matched":                "Liberty Data confirmed entity match",
    "AI Semantic matched":            "AI confirmed entity match",
    "Trulioo pollution flag":         "Trulioo returned 4-digit SIC (data quality issue)",
    "Web↔Registry semantic distance": "Divergence between web presence and registry label — shell company signal",
    "Temporal pivot score (AML)":     "Industry code change rate — U-Turn fraud signal",
    "Cross-taxonomy agreement":       "How many taxonomies agree on the same cluster",
    "Entity type: Holding":           "Company registered as Holding entity",
    "Entity type: NGO":               "Company registered as NGO / non-profit",
    "Entity type: Partnership":       "Company registered as Partnership",
    "Source majority code agreement": "Fraction of sources returning the same industry code",
    "High-risk NAICS sector flag":    "Code in AML-elevated sector (Holding, Banking, Dual-use, Defence)",
    "Vendor code diversity (n_unique)":"How many different industry codes vendors returned (high = conflict)",
    "Registry vs AI label distance":  "Semantic distance between OC label and AI description",
    "Avg source confidence":          "Average confidence across all 6 sources",
    "Max source confidence":          "Strongest single-source confidence",
    "Source count (normalised)":      "How many sources returned data",
    "Is subnational jurisdiction":    "Company registered at state/province level",
    "Is NAICS jurisdiction":          "Jurisdiction primarily uses NAICS (US/CA/AU)",
}


@dataclass
class ShapResult:
    """SHAP explanation for one company classification."""
    feature_names:      list[str]
    feature_values:     list[float]      # actual feature values
    shap_values:        list[float]      # SHAP contributions for predicted class
    base_value:         float            # expected model output
    predicted_class:    str              # e.g. "541511"
    predicted_prob:     float            # model probability for predicted class
    top_positive:       list[tuple[str, float, float]]  # (name, shap, feature_val) — pushing toward class
    top_negative:       list[tuple[str, float, float]]  # pushing away
    plain_english:      str              # analyst narrative
    global_importance:  Optional[dict[str, float]] = None  # only for batch


@dataclass
class BatchShapResult:
    """Aggregated SHAP across a batch of companies."""
    mean_abs_shap:      dict[str, float]   # feature → mean |SHAP| across all samples and classes
    top_global_features: list[tuple[str, float]]  # sorted (feature, importance)
    per_company:        list[ShapResult]


class ConsensusExplainer:
    """
    Computes SHAP values for the Consensus Level 2 XGBoost model.

    Usage:
        explainer = ConsensusExplainer(consensus_engine_instance)
        result    = explainer.explain_single(bundle, top_n=10)
        batch_res = explainer.explain_batch(bundles)
    """

    def __init__(self, consensus_engine) -> None:
        self._ce        = consensus_engine
        self._explainer = None   # lazy — built on first call
        self._background = None  # background dataset for SHAP

    def _get_explainer(self):
        if self._explainer is not None:
            return self._explainer
        try:
            import shap
            from data_simulator import simulate_training_dataset
            from consensus_engine import FeatureEngineer

            if self._ce._model is None:
                raise RuntimeError("Consensus model not trained.")

            logger.info("Building SHAP TreeExplainer (background: 100 synthetic samples) …")
            fe  = FeatureEngineer(taxonomy_engine=self._ce._taxonomy_engine)
            bg_bundles = simulate_training_dataset(100)
            X_bg = np.vstack([fe.transform(b) for b in bg_bundles])
            self._background = X_bg

            # Use default (raw log-odds) — required for multi:softprob
            # model_output="probability" raises for multi-class in SHAP 0.51+
            self._explainer = shap.TreeExplainer(self._ce._model)
            logger.info("SHAP TreeExplainer ready.")
        except Exception as exc:
            logger.warning(f"SHAP explainer init failed: {exc}")
            self._explainer = None
        return self._explainer

    def explain_single(self, bundle, top_n: int = 10) -> Optional[ShapResult]:
        """
        Compute SHAP explanation for one VendorBundle.
        Returns None if SHAP is unavailable.
        """
        explainer = self._get_explainer()
        if explainer is None:
            return None

        from consensus_engine import FeatureEngineer
        fe   = FeatureEngineer(taxonomy_engine=self._ce._taxonomy_engine)
        feat = fe.transform(bundle)            # shape: (38,)
        X    = feat.reshape(1, -1)

        try:
            import shap
            shap_values = explainer.shap_values(X)
            # shap_values shape: (1, 38, n_classes) for multi:softprob + probability output
            # or (1, 38) for binary — handle both
            probs    = self._ce._raw_probs(X)[0]
            pred_idx = int(probs.argmax())
            pred_prob = float(probs[pred_idx])

            if shap_values.ndim == 3:
                # (1, 38, n_classes) — pick the predicted class slice
                sv = shap_values[0, :, pred_idx]          # (38,)
                ev = explainer.expected_value
                base_val = float(ev[pred_idx]) if hasattr(ev, '__len__') else float(ev)
            else:
                sv = shap_values[0]
                ev = explainer.expected_value
                base_val = float(ev[0]) if hasattr(ev, '__len__') else float(ev)

            pred_code = self._ce._code_map[pred_idx % len(self._ce._code_map)]

        except Exception as exc:
            logger.warning(f"SHAP explain_single failed: {exc}")
            return None

        # Sort features by absolute SHAP value
        pairs = sorted(
            zip(FEATURE_NAMES, sv.tolist(), feat.tolist()),
            key=lambda x: abs(x[1]),
            reverse=True,
        )
        top_pos = [(n, s, v) for n, s, v in pairs if s > 0][:top_n]
        top_neg = [(n, s, v) for n, s, v in pairs if s < 0][:top_n]

        plain = self._build_narrative(pred_code, pred_prob, top_pos, top_neg, base_val)

        return ShapResult(
            feature_names  = FEATURE_NAMES,
            feature_values = feat.tolist(),
            shap_values    = sv.tolist(),
            base_value     = base_val,
            predicted_class = pred_code,
            predicted_prob  = pred_prob,
            top_positive    = top_pos,
            top_negative    = top_neg,
            plain_english   = plain,
        )

    def explain_batch(self, bundles: list, top_n: int = 10) -> Optional[BatchShapResult]:
        """Compute SHAP for a list of VendorBundles. Returns global + per-company."""
        explainer = self._get_explainer()
        if explainer is None or not bundles:
            return None

        from consensus_engine import FeatureEngineer
        fe = FeatureEngineer(taxonomy_engine=self._ce._taxonomy_engine)
        X  = np.vstack([fe.transform(b) for b in bundles])

        try:
            import shap
            shap_values = explainer.shap_values(X)   # (n, 38, n_classes) or (n, 38)
        except Exception as exc:
            logger.warning(f"SHAP batch failed: {exc}")
            return None

        # Global importance: mean |SHAP| across samples and classes
        if shap_values.ndim == 3:
            mean_abs = np.abs(shap_values).mean(axis=(0, 2))  # (38,)
        else:
            mean_abs = np.abs(shap_values).mean(axis=0)        # (38,)

        global_imp = {FEATURE_NAMES[i]: round(float(mean_abs[i]), 6)
                      for i in range(len(FEATURE_NAMES))}
        top_global = sorted(global_imp.items(), key=lambda x: x[1], reverse=True)

        # Per-company results
        per_company = []
        probs_all = self._ce._raw_probs(X)
        for i, bundle in enumerate(bundles):
            probs = probs_all[i]
            pred_idx  = int(probs.argmax())
            pred_prob = float(probs[pred_idx])
            pred_code = self._ce._code_map[pred_idx % len(self._ce._code_map)]

            if shap_values.ndim == 3:
                sv = shap_values[i, :, pred_idx]
                ev = explainer.expected_value
                base_val = float(ev[pred_idx]) if hasattr(ev, '__len__') else float(ev)
            else:
                sv = shap_values[i]
                ev = explainer.expected_value
                base_val = float(ev[0]) if hasattr(ev, '__len__') else float(ev)

            feat = X[i]
            pairs = sorted(
                zip(FEATURE_NAMES, sv.tolist(), feat.tolist()),
                key=lambda x: abs(x[1]), reverse=True,
            )
            top_pos = [(n, s, v) for n, s, v in pairs if s > 0][:top_n]
            top_neg = [(n, s, v) for n, s, v in pairs if s < 0][:top_n]

            per_company.append(ShapResult(
                feature_names   = FEATURE_NAMES,
                feature_values  = feat.tolist(),
                shap_values     = sv.tolist(),
                base_value      = base_val,
                predicted_class = pred_code,
                predicted_prob  = pred_prob,
                top_positive    = top_pos,
                top_negative    = top_neg,
                plain_english   = self._build_narrative(pred_code, pred_prob, top_pos, top_neg, base_val),
                global_importance = global_imp,
            ))

        return BatchShapResult(
            mean_abs_shap        = global_imp,
            top_global_features  = top_global,
            per_company          = per_company,
        )

    @staticmethod
    def _build_narrative(code: str, prob: float, top_pos: list, top_neg: list, base: float) -> str:
        """Generate plain-English explanation from SHAP contributions."""
        lines = [
            f"The model classified this company as **{code}** with "
            f"**{prob:.0%} confidence** (base rate: {base:.0%})."
        ]
        if top_pos:
            pos_bullets = []
            for name, sv, fv in top_pos[:3]:
                interp = FEATURE_INTERPRETATIONS.get(name, name)
                pos_bullets.append(f"- **{interp}** (value: {fv:.3f}) → +{sv:.3f} toward this code")
            lines.append("\n**Pushed toward this classification:**")
            lines.extend(pos_bullets)
        if top_neg:
            neg_bullets = []
            for name, sv, fv in top_neg[:3]:
                interp = FEATURE_INTERPRETATIONS.get(name, name)
                neg_bullets.append(f"- **{interp}** (value: {fv:.3f}) → {sv:.3f} away from this code")
            lines.append("\n**Pushed away from this classification:**")
            lines.extend(neg_bullets)
        if not top_pos and not top_neg:
            lines.append("No dominant features — prediction is close to the base rate.")
        return "\n".join(lines)
