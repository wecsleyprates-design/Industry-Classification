"""
naics_mcc_classifier/predictor.py
===================================
Stateless prediction module — loads trained models once, exposes
predict_single() and predict_batch() for use by api.py and the notebook.

Decision logic (mirrors the improved pipeline):
  1. Run XGBoost on vendor signals
  2. If top-1 confidence >= NAICS_OVERRIDE_CONFIDENCE_THRESHOLD → use prediction
  3. If confidence < threshold → signal "send_to_ai" with enrichment context
  4. If ALL vendor signals are null (total zero evidence) → signal "name_only_inference"

The AI enrichment TypeScript code calls /predict before deciding whether to run GPT.
"""
from __future__ import annotations

import json
import logging
import pickle
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from .config import (
    ARTIFACTS_DIR,
    NAICS_FALLBACK, MCC_FALLBACK,
    NAICS_OVERRIDE_CONFIDENCE_THRESHOLD,
    FEATURE_NAMES,
)
from .feature_engineering import build_feature_matrix

logger = logging.getLogger(__name__)

# ── Platform ID → source name mapping (from integration-service constants) ────
PLATFORM_NAMES = {
    "16": "Middesk",
    "17": "Equifax",
    "23": "OpenCorporates",
    "24": "ZoomInfo",
    "31": "AI (GPT)",
    "38": "Trulioo",
}

# ── Outcome codes returned by the predictor ───────────────────────────────────
OUTCOME_USE_PREDICTION   = "use_prediction"    # confidence >= threshold → skip AI
OUTCOME_SEND_TO_AI       = "send_to_ai"        # confidence < threshold → AI with context
OUTCOME_NAME_ONLY        = "name_only_inference"  # all vendor signals null → AI with web search
OUTCOME_KEEP_EXISTING    = "keep_existing"     # current code is non-fallback → no action needed


@dataclass
class VendorSignal:
    """One vendor's contribution — mirrors the alternatives[] structure from the Fact Engine."""
    source_name: str
    platform_id: str
    naics_code: str
    confidence: float
    naics_description: str = ""
    is_primary: bool = False  # True for the Fact Engine winner


@dataclass
class PredictionResult:
    """
    Full output from the predictor.  TypeScript reads this as JSON.
    """
    outcome: str                        # OUTCOME_* constant above
    business_id: str
    current_naics_code: str             # what the system has now (may be 561499 or null)
    current_mcc_code: str

    # Model prediction
    predicted_naics_code: str           # model's top-1 prediction
    predicted_naics_description: str
    predicted_mcc_code: str
    model_confidence: float             # 0-1

    # Top-5 predictions for transparency
    top_5_naics: list[dict] = field(default_factory=list)

    # Vendor signals summary (for AI prompt enrichment)
    vendor_signals: list[dict] = field(default_factory=list)

    # Context string ready to paste into the AI prompt
    ai_enrichment_context: str = ""

    # Flags
    all_vendors_null: bool = False      # True when NO vendor returned any NAICS
    has_website: bool = False
    name_keywords_found: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False)


class NAICSPredictor:
    """
    Singleton-style predictor: loads model artifacts once on first use.
    Thread-safe for concurrent FastAPI requests (models are read-only after load).
    """

    def __init__(self):
        self._naics_clf = None
        self._mcc_clf   = None
        self._naics_le  = None
        self._crosswalk: dict = {}
        self._naics_desc: dict = {}
        self._mcc_desc:   dict = {}
        self._loaded = False

    def load(self) -> "NAICSPredictor":
        """Load all artifacts from ARTIFACTS_DIR. Idempotent."""
        if self._loaded:
            return self

        from .model import NAICSClassifier, MCCClassifier

        naics_path = ARTIFACTS_DIR / "naics_classifier.pkl"
        mcc_path   = ARTIFACTS_DIR / "mcc_classifier.pkl"
        le_path    = ARTIFACTS_DIR / "naics_le.pkl"
        cw_path    = ARTIFACTS_DIR / "crosswalk.json"

        if not naics_path.exists():
            raise FileNotFoundError(
                f"Model not found: {naics_path}. "
                "Run run_training_pipeline() first."
            )

        self._naics_clf = NAICSClassifier.load(naics_path)
        self._mcc_clf   = MCCClassifier.load(mcc_path)

        with open(le_path, "rb") as f:
            self._naics_le = pickle.load(f)

        with open(cw_path) as f:
            self._crosswalk = json.load(f)

        self._loaded = True
        logger.info("NAICSPredictor loaded from %s", ARTIFACTS_DIR)
        return self

    def predict_single(
        self,
        business_id: str,
        business_name: str,
        current_naics_code: str,
        current_mcc_code: str,
        # Vendor NAICS signals from the Fact Engine alternatives[]
        vendor_alternatives: list[dict] | None = None,
        # Raw vendor fields from Redshift (optional — used for richer features)
        zi_c_naics6: str = "",
        zi_c_naics_top3: str = "",
        zi_c_sic4: str = "",
        zi_c_sic_top3: str = "",
        zi_naics_confidence: float = 0.0,
        zi_match_confidence: float = 0.0,
        efx_naics_primary: str = "",
        efx_naics_secondary_1: str = "",
        efx_naics_secondary_2: str = "",
        efx_naics_secondary_3: str = "",
        efx_naics_secondary_4: str = "",
        efx_sic_primary: str = "",
        efx_match_confidence: float = 0.0,
        oc_naics_primary: str = "",
        oc_match_confidence: float = 0.0,
        efx_employee_count: float = 0.0,
        efx_annual_sales: float = 0.0,
        zi_employee_count: float = 0.0,
        zi_revenue: float = 0.0,
        state: str = "MISSING",
        country_code: str = "US",
        has_website: bool = False,
        ai_enrichment_confidence: str = "",
    ) -> PredictionResult:
        """
        Run the full prediction pipeline for a single business.

        Returns a PredictionResult with:
          - outcome: what action to take
          - predicted_naics_code: model's best prediction
          - ai_enrichment_context: ready-to-use string for the AI prompt
        """
        if not self._loaded:
            self.load()

        # ── Determine if current code is already a real (non-fallback) code ──
        is_fallback = (
            not current_naics_code
            or current_naics_code.strip() in ("", "null", NAICS_FALLBACK)
        )
        if not is_fallback:
            return PredictionResult(
                outcome=OUTCOME_KEEP_EXISTING,
                business_id=business_id,
                current_naics_code=current_naics_code,
                current_mcc_code=current_mcc_code,
                predicted_naics_code=current_naics_code,
                predicted_naics_description=self._naics_desc.get(current_naics_code, ""),
                predicted_mcc_code=current_mcc_code,
                model_confidence=1.0,
            )

        # ── STEP 1: Deterministic weighted consensus (new primary layer) ─────────
        # Run the consensus layer FIRST — this mirrors Pipeline A's Fact Engine
        # with explicit OC priority (0.9 > ZI 0.8 > EFX 0.7).
        # The consensus layer directly applies vendor NAICS codes when vendors agree.
        # XGBoost only runs for conflict resolution (OUTCOME_CONFLICT).
        from .consensus import apply_consensus, OUTCOME_CONSENSUS, OUTCOME_SINGLE_HIGH
        from .consensus import OUTCOME_SINGLE_MEDIUM, OUTCOME_CONFLICT
        from .consensus import OUTCOME_NAME_ONLY as C_NAME_ONLY
        from .consensus import OUTCOME_SEND_TO_AI as C_SEND_TO_AI

        consensus = apply_consensus(
            business_name=business_name,
            zi_naics6=zi_c_naics6,
            zi_match_confidence=zi_match_confidence,
            efx_naics6=efx_naics_primary,
            efx_match_confidence=efx_match_confidence,
            oc_naics6=oc_naics_primary,
            oc_match_confidence=oc_match_confidence,
        )

        all_vendors_null = consensus.outcome in (C_NAME_ONLY, C_SEND_TO_AI)
        name_kws = [(kw, "", "", "") for kw in consensus.name_keywords]

        # ── STEP 2: For consensus/single — use vendor code directly ──────────────
        if consensus.outcome in (OUTCOME_CONSENSUS, OUTCOME_SINGLE_HIGH):
            top1_code = consensus.naics6
            top1_conf = consensus.confidence
            top1_desc = self._naics_desc.get(top1_code, "")
            mcc_code  = self._crosswalk.get(top1_code, MCC_FALLBACK)
            top5_info = [{"naics_code": top1_code, "description": top1_desc,
                          "probability": top1_conf}]
            outcome = OUTCOME_USE_PREDICTION

        elif consensus.outcome == OUTCOME_SINGLE_MEDIUM:
            top1_code = consensus.naics6
            top1_conf = consensus.confidence
            top1_desc = self._naics_desc.get(top1_code, "")
            mcc_code  = self._crosswalk.get(top1_code, MCC_FALLBACK)
            top5_info = [{"naics_code": top1_code, "description": top1_desc,
                          "probability": top1_conf}]
            # Medium confidence → send to AI with context (don't auto-apply)
            outcome = OUTCOME_SEND_TO_AI

        elif consensus.outcome == C_NAME_ONLY:
            top1_code = consensus.naics6
            top1_conf = consensus.confidence
            top1_desc = self._naics_desc.get(top1_code, "")
            mcc_code  = self._crosswalk.get(top1_code, MCC_FALLBACK)
            top5_info = [{"naics_code": top1_code, "description": top1_desc,
                          "probability": top1_conf}]
            outcome = OUTCOME_NAME_ONLY

        elif consensus.outcome == OUTCOME_CONFLICT and self._naics_clf is not None:
            # ── STEP 3: XGBoost for conflict resolution ───────────────────────
            # Vendors disagree on sector. Use XGBoost to pick the winning sector,
            # then apply the candidate code from the winning vendor.
            row = {
                "business_name": business_name,
                "current_naics_code": current_naics_code or NAICS_FALLBACK,
                "current_mcc_code": current_mcc_code or MCC_FALLBACK,
                "ai_enrichment_confidence": ai_enrichment_confidence,
                "zi_match_confidence": zi_match_confidence,
                "efx_match_confidence": efx_match_confidence,
                "oc_match_confidence": oc_match_confidence,
                "zi_c_naics6": zi_c_naics6,
                "efx_naics_primary": efx_naics_primary,
                "oc_naics_primary": oc_naics_primary,
                "zi_c_naics_top3": zi_c_naics_top3,
                "efx_naics_secondary_1": efx_naics_secondary_1,
                "efx_naics_secondary_2": efx_naics_secondary_2,
                "efx_sic_primary": efx_sic_primary,
                "zi_c_sic4": zi_c_sic4,
                "zi_c_naics_confidence_score": zi_naics_confidence,
                "zi_c_total_employee_count": zi_employee_count,
                "zi_c_annual_revenue": zi_revenue,
                "efx_employee_count": efx_employee_count,
                "efx_annual_sales": efx_annual_sales,
                "state": state, "country_code": country_code,
                "ai_has_website": int(has_website),
                "match_confidence": max(zi_match_confidence, efx_match_confidence, oc_match_confidence),
            }
            df_row = pd.DataFrame([row])
            X, _ = build_feature_matrix(df_row, naics_le=self._naics_le, fit_encoders=False)

            try:
                proba = self._naics_clf.model.predict_proba(X.values)
                top5_raw_idx = np.argsort(proba[0])[::-1][:5]
                top5_proba   = proba[0][top5_raw_idx]
                top5_codes   = self._naics_clf._decode(top5_raw_idx)
                top1_code    = top5_codes[0]
                top1_conf    = float(top5_proba[0])
                top1_desc    = self._naics_desc.get(top1_code, "")
                mcc_code     = self._crosswalk.get(top1_code, MCC_FALLBACK)
                top5_info    = [{"naics_code": c, "description": self._naics_desc.get(c,""),
                                  "probability": float(p)}
                                 for c, p in zip(top5_codes, top5_proba)]
                if top1_conf >= NAICS_OVERRIDE_CONFIDENCE_THRESHOLD:
                    outcome = OUTCOME_USE_PREDICTION
                else:
                    outcome = OUTCOME_SEND_TO_AI
            except Exception as e:
                logger.warning("XGBoost conflict resolver failed (%s) — sending to AI", e)
                top1_code = consensus.naics6
                top1_conf = consensus.confidence
                top1_desc = self._naics_desc.get(top1_code, "")
                mcc_code  = self._crosswalk.get(top1_code, MCC_FALLBACK)
                top5_info = [{"naics_code": top1_code, "description": top1_desc, "probability": top1_conf}]
                outcome = OUTCOME_SEND_TO_AI

        else:
            # No model, no consensus — send to AI
            top1_code = NAICS_FALLBACK
            top1_conf = 0.0
            top1_desc = ""
            mcc_code  = MCC_FALLBACK
            top5_info = []
            outcome   = OUTCOME_NAME_ONLY if name_kws else OUTCOME_SEND_TO_AI

        # ── Build vendor signals list ─────────────────────────────────────────
        vendor_signals = _build_vendor_signals(
            vendor_alternatives=vendor_alternatives or [],
            zi_c_naics6=zi_c_naics6, zi_match_confidence=zi_match_confidence,
            efx_naics_primary=efx_naics_primary, efx_match_confidence=efx_match_confidence,
            oc_naics_primary=oc_naics_primary,   oc_match_confidence=oc_match_confidence,
            naics_desc=self._naics_desc,
        )

        name_keywords_list = consensus.name_keywords

        # ── Build AI enrichment context string ────────────────────────────────
        top5_for_context = [(d["naics_code"], d["probability"]) for d in top5_info]
        ai_context = _build_ai_context(
            outcome=outcome,
            business_name=business_name,
            predicted_naics=top1_code,
            predicted_desc=top1_desc,
            predicted_conf=top1_conf,
            vendor_signals=vendor_signals,
            top5=top5_for_context,
            all_vendors_null=all_vendors_null,
            name_keywords=[(kw,"","","") for kw in name_keywords_list],
            naics_desc=self._naics_desc,
        )
        # Append consensus explanation
        if consensus.explanation:
            ai_context += f"\n\nConsensus analysis: {consensus.explanation}"

        return PredictionResult(
            outcome=outcome,
            business_id=business_id,
            current_naics_code=current_naics_code or NAICS_FALLBACK,
            current_mcc_code=current_mcc_code or MCC_FALLBACK,
            predicted_naics_code=top1_code,
            predicted_naics_description=top1_desc,
            predicted_mcc_code=mcc_code,
            model_confidence=top1_conf,
            top_5_naics=top5_info,
            vendor_signals=[s.__dict__ if hasattr(s, "__dict__") else s for s in vendor_signals],
            ai_enrichment_context=ai_context,
            all_vendors_null=all_vendors_null,
            has_website=has_website,
            name_keywords_found=name_keywords_list,
        )


# ── Helpers ────────────────────────────────────────────────────────────────────

_KEYWORD_MAP = {
    "restaurant": ["restaurant", "pizza", "cafe", "coffee", "bakery", "grill", "diner", "sushi", "taco", "burger", "bbq", "eatery"],
    "salon_beauty": ["salon", "spa", "beauty", "nail", "hair", "barber", "estheti"],
    "dental": ["dental", "dentist", "orthodont"],
    "medical": ["medical", "physician", "clinic", "hospital", "therapy", "nurse", "health", "pharma"],
    "legal": ["law", "attorney", "legal", "solicitor"],
    "construction": ["construction", "contractor", "builder", "plumb", "electr", "hvac", "roofing", "concrete"],
    "tech": ["software", "tech", "systems", "digital", "cloud", "computing"],
    "church": ["church", "ministry", "chapel", "diocese", "synagogue", "mosque", "temple"],
    "daycare": ["daycare", "childcare", "preschool", "nursery", "kindergarten"],
    "auto": ["auto", "automotive", "car", "vehicle", "tires", "mechanic", "collision"],
    "trucking": ["trucking", "transport", "freight", "logistics", "hauling", "moving"],
    "real_estate": ["realty", "real estate", "property management", "apartments"],
}


def _detect_name_keywords(name: str) -> list[str]:
    name_lower = name.lower()
    found = []
    for category, keywords in _KEYWORD_MAP.items():
        if any(kw in name_lower for kw in keywords):
            found.append(category)
    return found


def _build_vendor_signals(
    vendor_alternatives: list[dict],
    zi_c_naics6: str,
    zi_match_confidence: float,
    efx_naics_primary: str,
    efx_match_confidence: float,
    oc_naics_primary: str,
    oc_match_confidence: float,
    naics_desc: dict,
) -> list[VendorSignal]:
    """
    Build a clean list of vendor signals, prioritising the alternatives[] from
    the Fact Engine (which includes ALL sources with their platform IDs and
    confidence scores), falling back to the raw Redshift columns.
    """
    signals: list[VendorSignal] = []
    seen_platforms = set()

    # From Fact Engine alternatives (richer — includes confidence per source)
    for alt in vendor_alternatives:
        pid = str(alt.get("source") or alt.get("platform_id") or "")
        code = str(alt.get("value") or alt.get("naics_code") or "").strip()
        conf = float(alt.get("confidence") or 0.0)
        if not code or code == NAICS_FALLBACK or not pid:
            continue
        signals.append(VendorSignal(
            source_name=PLATFORM_NAMES.get(pid, f"Platform {pid}"),
            platform_id=pid,
            naics_code=code,
            confidence=conf,
            naics_description=naics_desc.get(code, ""),
            is_primary=alt.get("is_primary", False),
        ))
        seen_platforms.add(pid)

    # Fill in from raw Redshift columns for any missing sources
    raw_signals = [
        ("24", "ZoomInfo", zi_c_naics6, zi_match_confidence),
        ("17", "Equifax", efx_naics_primary, efx_match_confidence),
        ("23", "OpenCorporates", oc_naics_primary, oc_match_confidence),
    ]
    for pid, name, code, conf in raw_signals:
        if pid not in seen_platforms and code and code != NAICS_FALLBACK:
            signals.append(VendorSignal(
                source_name=name, platform_id=pid,
                naics_code=code, confidence=conf,
                naics_description=naics_desc.get(code, ""),
            ))

    return signals


def _build_ai_context(
    outcome: str,
    business_name: str,
    predicted_naics: str,
    predicted_desc: str,
    predicted_conf: float,
    vendor_signals: list[VendorSignal],
    top5: list[tuple],
    all_vendors_null: bool,
    name_keywords: list[str],
    naics_desc: dict,
) -> str:
    """
    Build a context string that integrates into the AI enrichment prompt.
    The TypeScript code appends this to the system prompt before calling GPT.
    """
    lines = ["=== XGBoost Classifier Pre-Analysis ==="]

    # ── Vendor signals ────────────────────────────────────────────────────────
    if vendor_signals:
        lines.append("\nVendor NAICS signals (from Redshift — do NOT trust these blindly):")
        for s in vendor_signals:
            desc = f" — {s.naics_description}" if s.naics_description else ""
            lines.append(
                f"  {s.source_name} (platform {s.platform_id}): "
                f"NAICS {s.naics_code}{desc}  [match confidence: {s.confidence:.2f}]"
            )
    else:
        lines.append("\nNo vendor NAICS signals available from ZoomInfo, Equifax, or OpenCorporates.")

    # ── XGBoost prediction ────────────────────────────────────────────────────
    lines.append(f"\nXGBoost classifier prediction:")
    lines.append(f"  Top-1: NAICS {predicted_naics} — {predicted_desc} (confidence: {predicted_conf:.2%})")
    if len(top5) > 1:
        lines.append("  Top-5 candidates:")
        for code, prob in top5[:5]:
            desc = naics_desc.get(code, "")
            lines.append(f"    NAICS {code} — {desc} ({prob:.2%})")

    # ── Outcome-specific instructions ─────────────────────────────────────────
    if outcome == OUTCOME_USE_PREDICTION:
        lines.append(
            f"\n✅ Model confidence {predicted_conf:.2%} exceeds threshold. "
            f"Predicted NAICS {predicted_naics} is already being applied. "
            f"Your task: VERIFY this prediction is correct given the business context. "
            f"If you disagree, provide your correction and reasoning."
        )
    elif outcome == OUTCOME_NAME_ONLY:
        kw_str = ", ".join(name_keywords) if name_keywords else "none detected"
        lines.append(
            f"\n⚠️  ALL vendor sources returned null/no-match for this business. "
            f"Name keyword signals detected: {kw_str}. "
            f"\nYour task:"
            f"\n  1. SEARCH THE WEB for '{business_name}' to find any public information "
            f"(Google Maps, LinkedIn, company website, news, state registry)."
            f"\n  2. If you find evidence → classify based on that evidence with appropriate confidence."
            f"\n  3. If name keywords clearly indicate an industry (salon, dental, restaurant, etc.) "
            f"→ classify from the name alone with MED confidence."
            f"\n  4. If you find NOTHING and the name is ambiguous → return 561499 with LOW confidence. "
            f"561499 means the customer will see 'Administrative Services' — only use it as a genuine last resort."
        )
    else:  # OUTCOME_SEND_TO_AI
        lines.append(
            f"\n⚠️  Model confidence {predicted_conf:.2%} is below threshold ({NAICS_OVERRIDE_CONFIDENCE_THRESHOLD:.0%}). "
            f"Vendor signals are conflicting or weak."
            f"\nYour task:"
            f"\n  1. Review the vendor signals above — consider which source is most reliable."
            f"\n  2. The XGBoost top-1 prediction is NAICS {predicted_naics} ({predicted_conf:.2%}) "
            f"— does the vendor evidence support this?"
            f"\n  3. Use the website (if available) to resolve the conflict."
            f"\n  4. Provide your best classification with reasoning. "
            f"Avoid 561499 unless you have genuinely exhausted all signals."
        )

    lines.append("=== End Pre-Analysis ===")
    return "\n".join(lines)


# ── Module-level singleton ────────────────────────────────────────────────────
_predictor: Optional[NAICSPredictor] = None


def get_predictor() -> NAICSPredictor:
    """Return the module-level singleton predictor, loading on first call."""
    global _predictor
    if _predictor is None:
        _predictor = NAICSPredictor()
    if not _predictor._loaded:
        try:
            _predictor.load()
        except FileNotFoundError as e:
            logger.warning("Models not trained yet (%s). Train first.", e)
    return _predictor
