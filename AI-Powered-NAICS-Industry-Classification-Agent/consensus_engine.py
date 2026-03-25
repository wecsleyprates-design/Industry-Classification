"""
Consensus Engine — XGBoost Stacking Ensemble
=============================================
Implements the three-level stacking architecture:

  Level 0 — Signal Layer   : raw vendor codes (6 sources)
  Level 1 — Feature Eng.   : vectorise + compute advanced features
  Level 2 — Consensus Layer: XGBoostClassifier → top-K probabilistic output

Advanced features
-----------------
  SRW   Source Reliability Weight   dynamic, jurisdiction-calibrated
  TPF   Trulioo Pollution Flag       binary: 4-digit code in 5-digit jurisd.
  WRD   Web-to-Registry Distance    semantic cosine distance
  TPS   Temporal Pivot Score        rate-of-change in last 3 snapshots
  CTA   Cross-Taxonomy Agreement    how many taxonomies map to same cluster

Output schema
-------------
Returns a ConsensusResult dataclass that mirrors the JSON output spec
described in the system design (Joe's Pizza example).
"""

from __future__ import annotations

import os
import logging
import pickle
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Try XGBoost; fall back to sklearn GBM if unavailable ─────────────────────
try:
    import xgboost as xgb
    _XGB_AVAILABLE = True
except ImportError:
    from sklearn.ensemble import GradientBoostingClassifier
    _XGB_AVAILABLE = False
    logger.warning("XGBoost not found; falling back to sklearn GBM.")

from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split

from config import (
    DATA_DIR,
    XGBOOST_MODEL_PATH,
    CONSENSUS_TOP_K,
    N_SYNTHETIC_TRAINING_SAMPLES,
    SOURCE_WEIGHTS,
    HIGH_RISK_NAICS_PREFIXES,
)
from data_simulator import VendorBundle, simulate_training_dataset


# ── Canonical NAICS label map (abbreviated) ──────────────────────────────────
# Used to translate numeric class indices back to NAICS codes.
# The full mapping is built from the training data at fit-time.
_DEFAULT_CODE_MAP: list[str] = [
    "722511","722513","722515","722310","424420","445110","445131",
    "541511","541512","518210","511210","551112","522110","524126",
    "531110","531210","423610","423690","336411","622110","541110",
    "541211","813110","611310","236220","484110","711110","713940",
    "441110","812112",
]


@dataclass
class IndustryCode:
    taxonomy: str
    code: str
    label: str
    consensus_probability: float


@dataclass
class ConsensusResult:
    business_id: str
    company_name: str
    jurisdiction: str
    entity_type: str
    primary_industry: IndustryCode
    secondary_industries: list[IndustryCode] = field(default_factory=list)
    risk_signals: list[dict] = field(default_factory=list)
    source_lineage: dict = field(default_factory=dict)
    feature_debug: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "business_id": self.business_id,
            "consensus_output": {
                "company_name": self.company_name,
                "jurisdiction": self.jurisdiction,
                "entity_type": self.entity_type,
                "primary_industry": {
                    "taxonomy": self.primary_industry.taxonomy,
                    "code": self.primary_industry.code,
                    "label": self.primary_industry.label,
                    "consensus_probability": round(self.primary_industry.consensus_probability, 4),
                },
                "secondary_industries": [
                    {
                        "taxonomy": s.taxonomy,
                        "code": s.code,
                        "label": s.label,
                        "consensus_probability": round(s.consensus_probability, 4),
                    }
                    for s in self.secondary_industries
                ],
                "risk_signals": self.risk_signals,
                "source_lineage": self.source_lineage,
                "feature_debug": self.feature_debug,
            },
        }


class FeatureEngineer:
    """
    Transforms a VendorBundle into a flat numeric feature vector.

    Feature layout (38 features):
      [0..5]   – per-source weighted confidence (opencorporates, equifax,
                 trulioo, zoominfo, liberty_data, ai_semantic)
      [6..11]  – per-source status flags (MATCHED=1, else=0)
      [12]     – Trulioo pollution flag
      [13]     – web-to-registry semantic distance (0–1)
      [14]     – temporal pivot score (0–1)
      [15]     – cross-taxonomy agreement count (0–1 normalised)
      [16]     – entity_type_holding flag
      [17]     – entity_type_ngo flag
      [18]     – entity_type_partnership flag

      [19..28] – jurisdiction region bucket ONE-HOT (10 classes):
                   idx 0 = US (federal)
                   idx 1 = US_STATE (us_mo, us_ca, pr …)
                   idx 2 = CA (federal)
                   idx 3 = CA_PROV (ca_bc, ca_qc …)
                   idx 4 = EU (gb, de, fr, es, it, nl, …)
                   idx 5 = APAC (cn, jp, in, sg, au, hk, …)
                   idx 6 = LATAM (mx, br, ar, co, …)
                   idx 7 = MENA (ae, ae_az, sa, ae_du, …)
                   idx 8 = AFRICA (za, ng, ke, …)
                   idx 9 = OTHER

      [29]     – is_subnational flag (1 if state/province/emirate level)
      [30]     – is_naics_jurisdiction flag (1 if NAICS is primary taxonomy)
      [31]     – majority_code_agreement (fraction of sources agreeing)
      [32]     – high_risk_naics_flag
      [33]     – n_unique_codes (diversity of vendor opinions)
      [34]     – registry_vs_ai_distance (cosine distance)
      [35]     – avg_source_confidence
      [36]     – max_source_confidence
      [37]     – source_count (how many sources returned data)
    """

    N_FEATURES = 38

    _SOURCES = [
        "opencorporates", "equifax", "trulioo",
        "zoominfo", "liberty_data", "ai_semantic",
    ]

    def __init__(self, taxonomy_engine=None) -> None:
        self._te = taxonomy_engine

    def transform(self, bundle: VendorBundle) -> np.ndarray:
        import jurisdiction_registry as JR
        from collections import Counter

        sig_map = {s.source: s for s in bundle.signals}
        feats = np.zeros(self.N_FEATURES, dtype=np.float32)

        # [0..5] per-source weighted confidence
        for i, src in enumerate(self._SOURCES):
            sig = sig_map.get(src)
            feats[i] = sig.weight * sig.confidence if sig else 0.0

        # [6..11] matched flag
        for i, src in enumerate(self._SOURCES):
            sig = sig_map.get(src)
            feats[6 + i] = 1.0 if (sig and sig.status == "MATCHED") else 0.0

        # [12] Trulioo pollution flag
        trulioo = sig_map.get("trulioo")
        feats[12] = 1.0 if (trulioo and trulioo.status == "POLLUTED") else 0.0

        # [13] web-to-registry semantic distance
        reg = sig_map.get("opencorporates")
        ai  = sig_map.get("ai_semantic")
        if self._te and reg and ai and reg.label and ai.label:
            feats[13] = float(self._te.compute_semantic_distance(reg.label, ai.label))
        else:
            feats[13] = 0.5

        # [14] temporal pivot score
        feats[14] = self._compute_pivot_score(bundle)

        # [15] cross-taxonomy agreement
        feats[15] = self._cross_taxonomy_agreement(bundle)

        # [16..18] entity type flags
        feats[16] = 1.0 if bundle.entity_type == "Holding"     else 0.0
        feats[17] = 1.0 if bundle.entity_type == "NGO"         else 0.0
        feats[18] = 1.0 if bundle.entity_type == "Partnership" else 0.0

        # [19..28] jurisdiction region bucket one-hot (10 buckets)
        # bundle.jurisdiction is stored as the full jurisdiction_code
        jc = bundle.jurisdiction.lower().strip()
        one_hot = JR.bucket_one_hot(jc)        # returns 10-element list
        for k, v in enumerate(one_hot):
            feats[19 + k] = v

        # [29] is_subnational flag
        jr_rec = JR.lookup(jc)
        feats[29] = 1.0 if (jr_rec and jr_rec.is_subnational) else 0.0

        # [30] is_naics_jurisdiction flag
        feats[30] = 1.0 if JR.is_naics_jurisdiction(jc) else 0.0

        # [31] majority code agreement
        codes = [s.raw_code for s in bundle.signals if s.status != "POLLUTED"]
        if codes:
            most_common_count = Counter(codes).most_common(1)[0][1]
            feats[31] = most_common_count / len(codes)
        else:
            feats[31] = 0.0

        # [32] high-risk NAICS prefix
        naics_codes = [s.raw_code for s in bundle.signals if s.taxonomy == "US_NAICS_2022"]
        feats[32] = 1.0 if any(c[:4] in HIGH_RISK_NAICS_PREFIXES for c in naics_codes) else 0.0

        # [33] unique-code diversity
        all_codes = [s.raw_code for s in bundle.signals]
        feats[33] = float(len(set(all_codes))) / max(len(all_codes), 1)

        # [34] registry vs AI distance
        feats[34] = feats[13]

        # [35..36] aggregate confidence stats
        confs = [s.confidence for s in bundle.signals]
        feats[35] = float(np.mean(confs)) if confs else 0.0
        feats[36] = float(np.max(confs))  if confs else 0.0

        # [37] source count
        feats[37] = float(len(bundle.signals)) / 6.0

        return feats

    def _compute_pivot_score(self, bundle: VendorBundle) -> float:
        """
        Measures how much the industry code has changed across historical
        snapshots. High score → business is pivoting → elevated risk.
        """
        hist = bundle.history
        if len(hist) < 2:
            return 0.0

        codes = [h.code for h in hist]
        unique_ratio = len(set(codes)) / len(codes)
        return round(unique_ratio, 4)

    def _cross_taxonomy_agreement(self, bundle: VendorBundle) -> float:
        """
        Count how many distinct taxonomies have been identified (normalised 0–1).
        More taxonomies = better multi-jurisdictional coverage.
        """
        taxonomies = {s.taxonomy for s in bundle.signals}
        return len(taxonomies) / 6.0


class IndustryConsensusEngine:
    """
    Level-2 stacking consensus model.

    Workflow
    --------
    1. Call `fit_synthetic()` to train on simulated data (or load existing model).
    2. Call `predict(bundle)` to get a ConsensusResult with top-K ranked codes.
    """

    def __init__(self, taxonomy_engine=None, model_path: Optional[str] = None) -> None:
        self._fe = FeatureEngineer(taxonomy_engine)
        self._taxonomy_engine = taxonomy_engine
        self._le = LabelEncoder()
        self._model = None
        self._code_map: list[str] = _DEFAULT_CODE_MAP
        self._loaded = False

        actual_path = model_path or XGBOOST_MODEL_PATH
        if os.path.exists(actual_path):
            self._load_model(actual_path)
        else:
            logger.info("No pre-trained model found; training on synthetic data …")
            self.fit_synthetic()
            self._save_model(actual_path)

    # ── Public API ────────────────────────────────────────────────────────────

    def predict(self, bundle: VendorBundle) -> ConsensusResult:
        """Run consensus prediction on a single VendorBundle."""
        feats = self._fe.transform(bundle).reshape(1, -1)
        probs = self._raw_probs(feats)[0]

        top_k_idx = np.argsort(probs)[::-1][:CONSENSUS_TOP_K]

        primary_idx = top_k_idx[0]
        primary_code = self._code_map[primary_idx % len(self._code_map)]
        primary_label = self._code_to_label(primary_code, bundle)
        primary_tax = self._code_to_taxonomy(primary_code, bundle)

        primary = IndustryCode(
            taxonomy=primary_tax,
            code=primary_code,
            label=primary_label,
            consensus_probability=float(probs[primary_idx]),
        )

        secondaries: list[IndustryCode] = []
        for idx in top_k_idx[1:]:
            code = self._code_map[idx % len(self._code_map)]
            secondaries.append(IndustryCode(
                taxonomy=self._code_to_taxonomy(code, bundle),
                code=code,
                label=self._code_to_label(code, bundle),
                consensus_probability=float(probs[idx]),
            ))

        import jurisdiction_registry as JR
        jc = bundle.jurisdiction.lower().strip()
        jr_rec = JR.lookup(jc)

        feature_debug = {
            "trulioo_polluted":          bool(feats[0][12]),
            "web_registry_distance":     round(float(feats[0][13]), 4),
            "temporal_pivot_score":      round(float(feats[0][14]), 4),
            "cross_taxonomy_agreement":  round(float(feats[0][15]), 4),
            "jurisdiction_code":         jc,
            "jurisdiction_label":        jr_rec.label if jr_rec else jc,
            "region_bucket":             JR.region_bucket(jc),
            "is_subnational":            bool(feats[0][29]),
            "is_naics_jurisdiction":     bool(feats[0][30]),
            "majority_code_agreement":   round(float(feats[0][31]), 4),
            "high_risk_naics_flag":      bool(feats[0][32]),
            "avg_source_confidence":     round(float(feats[0][35]), 4),
        }

        return ConsensusResult(
            business_id=bundle.business_id,
            company_name=bundle.company_name,
            jurisdiction=bundle.jurisdiction,
            entity_type=bundle.entity_type,
            primary_industry=primary,
            secondary_industries=secondaries,
            source_lineage=bundle.source_lineage,
            feature_debug=feature_debug,
        )

    def fit_synthetic(self, n_samples: int = N_SYNTHETIC_TRAINING_SAMPLES) -> None:
        """Generate synthetic training data and fit the consensus model."""
        logger.info(f"Generating {n_samples} synthetic training samples …")
        bundles = simulate_training_dataset(n=n_samples)

        X = np.vstack([self._fe.transform(b) for b in bundles])

        # Label: majority-vote code from non-polluted signals
        y_labels = [self._majority_code(b) for b in bundles]
        self._code_map = list(dict.fromkeys(y_labels))   # ordered unique

        y_enc = np.array([self._code_map.index(c) for c in y_labels])

        n_classes = len(self._code_map)
        X_tr, X_val, y_tr, y_val = train_test_split(
            X, y_enc, test_size=0.15, random_state=42
        )

        if _XGB_AVAILABLE:
            self._model = xgb.XGBClassifier(
                objective="multi:softprob",
                num_class=n_classes,
                tree_method="hist",
                max_depth=6,
                n_estimators=200,
                learning_rate=0.08,
                subsample=0.8,
                colsample_bytree=0.8,
                eval_metric="mlogloss",
                early_stopping_rounds=20,
                n_jobs=-1,
                verbosity=0,
            )
            self._model.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )
        else:
            self._model = GradientBoostingClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.08,
                subsample=0.8,
            )
            self._model.fit(X_tr, y_tr)

        logger.info(f"Model trained on {len(X_tr)} samples, {n_classes} classes.")
        self._loaded = True

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _raw_probs(self, X: np.ndarray) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("Model not trained. Call fit_synthetic() first.")
        if _XGB_AVAILABLE:
            probs = self._model.predict_proba(X)
        else:
            probs = self._model.predict_proba(X)

        # Pad probabilities to cover all entries in code_map
        n_classes = len(self._code_map)
        padded = np.zeros((probs.shape[0], n_classes), dtype=np.float32)
        padded[:, :probs.shape[1]] = probs
        return padded

    def _majority_code(self, bundle: VendorBundle) -> str:
        """Return the most-common code from non-polluted sources."""
        from collections import Counter
        codes = [
            s.raw_code for s in bundle.signals
            if s.status not in ("POLLUTED", "UNAVAILABLE")
        ]
        if not codes:
            return self._code_map[0] if self._code_map else "722511"
        return Counter(codes).most_common(1)[0][0]

    def _code_to_label(self, code: str, bundle: VendorBundle) -> str:
        """Best-effort: look up label from bundle signals or taxonomy engine."""
        for s in bundle.signals:
            if s.raw_code == code:
                return s.label
        if self._taxonomy_engine:
            rec = self._taxonomy_engine.lookup_code(code)
            if rec:
                return rec.description
        return f"Code {code}"

    def _code_to_taxonomy(self, code: str, bundle: VendorBundle) -> str:
        """Detect taxonomy from bundle signals, code format, or jurisdiction."""
        import jurisdiction_registry as JR
        for s in bundle.signals:
            if s.raw_code == code:
                return s.taxonomy
        # Use jurisdiction preferred taxonomy as context
        pref = JR.preferred_taxonomy(bundle.jurisdiction.lower())
        # Validate code format matches a known taxonomy
        if len(code) == 6 and code.isdigit():
            return "US_NAICS_2022"
        if len(code) == 5 and code.isdigit():
            return "UK_SIC_2007"
        if len(code) == 4 and code.isdigit():
            return "US_SIC_1987"
        if len(code) <= 4 and not code.isdigit():
            return "NACE_REV2"
        return pref

    def _save_model(self, path: str) -> None:
        os.makedirs(DATA_DIR, exist_ok=True)
        meta = {"code_map": self._code_map}
        meta_path = path.replace(".ubj", "_meta.pkl").replace(".json", "_meta.pkl")
        with open(meta_path, "wb") as f:
            pickle.dump(meta, f)

        if _XGB_AVAILABLE:
            self._model.save_model(path)
        else:
            with open(path.replace(".ubj", ".pkl"), "wb") as f:
                pickle.dump(self._model, f)
        logger.info(f"Model saved to {path}")

    def _load_model(self, path: str) -> None:
        meta_path = path.replace(".ubj", "_meta.pkl").replace(".json", "_meta.pkl")
        if os.path.exists(meta_path):
            with open(meta_path, "rb") as f:
                meta = pickle.load(f)
            self._code_map = meta.get("code_map", _DEFAULT_CODE_MAP)

        if _XGB_AVAILABLE and os.path.exists(path):
            self._model = xgb.XGBClassifier()
            self._model.load_model(path)
        else:
            pkl_path = path.replace(".ubj", ".pkl")
            if os.path.exists(pkl_path):
                with open(pkl_path, "rb") as f:
                    self._model = pickle.load(f)

        if self._model is not None:
            self._loaded = True
            logger.info(f"Model loaded from {path}")
        else:
            logger.warning("Could not load model; will train synthetic.")
            self.fit_synthetic()
            self._save_model(path)
