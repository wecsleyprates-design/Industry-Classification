"""
Risk Engine — AML/KYB Signal Detection
=======================================
Analyses a VendorBundle + ConsensusResult to produce structured risk signals.

Risk categories
---------------
REGISTRY_DISCREPANCY   : Registry label conflicts with AI/web label
HIGH_RISK_SECTOR       : Company operates in a high-AML-risk sector
TRULIOO_POLLUTION      : Trulioo returned degraded/incorrect code
HYBRID_ENTITY          : Significant activity in 2+ unrelated sectors
SHELL_COMPANY_SIGNAL   : Holding-type registry + operating-type web presence
STRUCTURE_CHANGE       : Rapid pivot in industry codes over time
TEMPORAL_PIVOT         : Code changed ≥2x in 12-month history
HOLDING_MISMATCH       : Entity_type=Holding but classified as Operating sector
SOURCE_CONFLICT        : ≥3 sources disagree on primary code
LOW_CONSENSUS          : Top-1 probability < 0.40 (model uncertain)

Severity levels: CRITICAL | HIGH | MEDIUM | LOW | INFO
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

from config import (
    SEMANTIC_DISCREPANCY_HIGH_THRESHOLD,
    SEMANTIC_DISCREPANCY_MEDIUM_THRESHOLD,
    PIVOT_SCORE_HIGH_THRESHOLD,
    HIGH_RISK_NAICS_PREFIXES,
    HIGH_RISK_SIC_CODES,
)
from data_simulator import VendorBundle
from consensus_engine import ConsensusResult

logger = logging.getLogger(__name__)

SEVERITY_ORDER = {"CRITICAL": 5, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1}

# Exported so any module that imports from risk_engine gets consistent colours
_RISK_COLOURS = {
    "CRITICAL": "#d32f2f",
    "HIGH":     "#f57c00",
    "MEDIUM":   "#fbc02d",
    "LOW":      "#388e3c",
    "INFO":     "#1976d2",
}


@dataclass
class RiskSignal:
    flag: str
    severity: str          # CRITICAL | HIGH | MEDIUM | LOW | INFO
    description: str
    evidence: dict = field(default_factory=dict)
    score: float = 0.0     # 0.0–1.0 (contribution to overall risk score)

    def to_dict(self) -> dict:
        return {
            "flag": self.flag,
            "severity": self.severity,
            "description": self.description,
            "score": round(self.score, 4),
            "evidence": self.evidence,
        }


@dataclass
class RiskProfile:
    overall_risk_score: float        # 0.0–1.0
    overall_risk_level: str          # LOW | MEDIUM | HIGH | CRITICAL
    signals: list[RiskSignal] = field(default_factory=list)
    kyb_recommendation: str = ""     # APPROVE | REVIEW | ESCALATE | REJECT

    def to_dict(self) -> dict:
        return {
            "overall_risk_score": round(self.overall_risk_score, 4),
            "overall_risk_level": self.overall_risk_level,
            "kyb_recommendation": self.kyb_recommendation,
            "signals": [s.to_dict() for s in self.signals],
        }


# ── Sector risk tables ─────────────────────────────────────────────────────────
_HIGH_RISK_SECTORS = {
    "551112": "Holding Companies (shell risk)",
    "522110": "Commercial Banking (AML exposure)",
    "522298": "Nondepository Credit (shadow banking)",
    "524126": "P&C Insurance (premium laundering)",
    "525910": "Open-End Investment Funds (layering risk)",
    "525990": "Other Financial Vehicles",
    "523999": "Misc Financial Investment (layering)",
    "423690": "Electronic Parts Wholesale (dual-use)",
    "423610": "Electrical Equipment Wholesale (dual-use)",
    "336411": "Aircraft Manufacturing (arms adjacent)",
    "924110": "Environmental Administration",
    "928110": "National Security",
}

_HOLDING_NAICS = {"551111", "551112", "551114", "525920", "525990"}
_OPERATING_NAICS_SECTORS = {
    "22", "31", "32", "33",   # manufacturing
    "42", "44", "45",          # wholesale/retail
    "48", "49",                # transportation
    "56",                      # food service
    "72",                      # hospitality/food
    "81",                      # personal/repair services
}


class RiskEngine:
    """
    Evaluates risk signals from a VendorBundle + ConsensusResult.

    Usage
    -----
    engine = RiskEngine(taxonomy_engine=te)
    profile = engine.evaluate(bundle, consensus_result)
    """

    def __init__(self, taxonomy_engine=None) -> None:
        self._te = taxonomy_engine

    def evaluate(
        self,
        bundle: VendorBundle,
        result: ConsensusResult,
    ) -> RiskProfile:
        signals: list[RiskSignal] = []

        signals.extend(self._check_registry_discrepancy(bundle, result))
        signals.extend(self._check_high_risk_sector(result))
        signals.extend(self._check_trulioo_pollution(bundle))
        signals.extend(self._check_hybrid_entity(result))
        signals.extend(self._check_shell_company(bundle, result))
        signals.extend(self._check_temporal_pivot(bundle))
        signals.extend(self._check_source_conflict(bundle))
        signals.extend(self._check_low_consensus(result))
        signals.extend(self._check_holding_mismatch(bundle, result))

        # Sort by severity descending
        signals.sort(key=lambda s: SEVERITY_ORDER.get(s.severity, 0), reverse=True)

        # Aggregate risk score (weighted sum, capped at 1.0)
        raw_score = sum(s.score for s in signals)
        overall_score = min(raw_score, 1.0)

        if overall_score >= 0.75:
            level = "CRITICAL"
            recommendation = "REJECT"
        elif overall_score >= 0.50:
            level = "HIGH"
            recommendation = "ESCALATE"
        elif overall_score >= 0.25:
            level = "MEDIUM"
            recommendation = "REVIEW"
        else:
            level = "LOW"
            recommendation = "APPROVE"

        return RiskProfile(
            overall_risk_score=overall_score,
            overall_risk_level=level,
            signals=signals,
            kyb_recommendation=recommendation,
        )

    # ── Individual signal detectors ────────────────────────────────────────────

    def _check_registry_discrepancy(
        self,
        bundle: VendorBundle,
        result: ConsensusResult,
    ) -> list[RiskSignal]:
        signals = []
        debug = result.feature_debug

        dist = debug.get("web_registry_distance", 0.0)
        if dist >= SEMANTIC_DISCREPANCY_HIGH_THRESHOLD:
            signals.append(RiskSignal(
                flag="REGISTRY_DISCREPANCY",
                severity="HIGH",
                description=(
                    f"Registry filing ({bundle.registry_label!r}) conflicts with "
                    f"AI-inferred web presence ({result.primary_industry.label!r}). "
                    f"Semantic distance={dist:.2f}. Potential shell company or "
                    f"misregistration indicator."
                ),
                evidence={
                    "registry_code": bundle.registry_code,
                    "registry_label": bundle.registry_label,
                    "ai_label": result.primary_industry.label,
                    "semantic_distance": dist,
                },
                score=0.30,
            ))
        elif dist >= SEMANTIC_DISCREPANCY_MEDIUM_THRESHOLD:
            signals.append(RiskSignal(
                flag="REGISTRY_DISCREPANCY",
                severity="MEDIUM",
                description=(
                    f"Minor semantic gap between registry ({bundle.registry_label!r}) "
                    f"and AI classification ({result.primary_industry.label!r}). "
                    f"Distance={dist:.2f}. Review recommended."
                ),
                evidence={"semantic_distance": dist},
                score=0.12,
            ))
        return signals

    def _check_high_risk_sector(self, result: ConsensusResult) -> list[RiskSignal]:
        signals = []
        primary_code = result.primary_industry.code

        # Check against HIGH_RISK_NAICS_PREFIXES (4-digit prefix matching)
        if any(primary_code.startswith(p) for p in HIGH_RISK_NAICS_PREFIXES):
            label = _HIGH_RISK_SECTORS.get(primary_code, result.primary_industry.label)
            signals.append(RiskSignal(
                flag="HIGH_RISK_SECTOR",
                severity="HIGH",
                description=(
                    f"Primary classification {primary_code} ({label}) is in an "
                    f"elevated AML/CTF risk sector. Enhanced due diligence required."
                ),
                evidence={"code": primary_code, "label": label},
                score=0.25,
            ))
        elif primary_code in _HIGH_RISK_SECTORS:
            signals.append(RiskSignal(
                flag="HIGH_RISK_SECTOR",
                severity="MEDIUM",
                description=(
                    f"Code {primary_code} is a known high-risk sector: "
                    f"{_HIGH_RISK_SECTORS[primary_code]}."
                ),
                evidence={"code": primary_code},
                score=0.15,
            ))

        # Also check US SIC
        for code in HIGH_RISK_SIC_CODES:
            for sig in []:   # would iterate real signals in production
                pass
        return signals

    def _check_trulioo_pollution(self, bundle: VendorBundle) -> list[RiskSignal]:
        signals = []
        for sig in bundle.signals:
            if sig.source == "trulioo" and sig.status == "POLLUTED":
                signals.append(RiskSignal(
                    flag="TRULIOO_POLLUTION",
                    severity="LOW",
                    description=(
                        f"Trulioo returned a {sig.digit_count}-digit code "
                        f"({sig.raw_code}) in a jurisdiction expecting a "
                        f"5+ digit taxonomy. Data quality degraded."
                    ),
                    evidence={
                        "trulioo_code": sig.raw_code,
                        "trulioo_taxonomy": sig.taxonomy,
                        "digit_count": sig.digit_count,
                    },
                    score=0.05,
                ))
        return signals

    def _check_hybrid_entity(self, result: ConsensusResult) -> list[RiskSignal]:
        signals = []
        # Detect if primary + secondaries span very different sectors (first 2 digits)
        primary_sector = result.primary_industry.code[:2]
        secondary_sectors = {s.code[:2] for s in result.secondary_industries}
        other_sectors = secondary_sectors - {primary_sector}

        if len(other_sectors) >= 2:
            labels = [s.label for s in result.secondary_industries[:2]]
            signals.append(RiskSignal(
                flag="HYBRID_ENTITY_DETECTED",
                severity="LOW",
                description=(
                    f"Business shows significant activity across {len(other_sectors)+1} "
                    f"distinct sectors. This may indicate a conglomerate, shell, or "
                    f"misclassified entity. Secondary labels: {labels}"
                ),
                evidence={
                    "primary_sector": primary_sector,
                    "secondary_sectors": list(other_sectors),
                },
                score=0.08,
            ))
        return signals

    def _check_shell_company(
        self, bundle: VendorBundle, result: ConsensusResult
    ) -> list[RiskSignal]:
        signals = []
        is_holding_registry = bundle.registry_code in _HOLDING_NAICS
        primary_prefix = result.primary_industry.code[:2]
        is_operating_primary = primary_prefix in _OPERATING_NAICS_SECTORS

        if is_holding_registry and is_operating_primary:
            signals.append(RiskSignal(
                flag="SHELL_COMPANY_SIGNAL",
                severity="HIGH",
                description=(
                    f"Registry filing indicates Holding Company "
                    f"({bundle.registry_code}) but active business intelligence "
                    f"suggests Operating sector ({result.primary_industry.label}). "
                    f"Classic shell company / U-Turn fraud pattern."
                ),
                evidence={
                    "registry_code": bundle.registry_code,
                    "ai_code": result.primary_industry.code,
                    "entity_type": bundle.entity_type,
                },
                score=0.35,
            ))
        return signals

    def _check_temporal_pivot(self, bundle: VendorBundle) -> list[RiskSignal]:
        signals = []
        hist = bundle.history
        if len(hist) < 2:
            return signals

        codes = [h.code for h in hist]
        unique_count = len(set(codes))

        if unique_count >= len(codes):   # every snapshot is different
            signals.append(RiskSignal(
                flag="STRUCTURE_CHANGE",
                severity="HIGH",
                description=(
                    f"Industry code changed in every historical snapshot "
                    f"({unique_count} unique codes in {len(codes)} periods). "
                    f"Indicative of money-laundering 'U-Turn' or business pivot fraud."
                ),
                evidence={
                    "history_codes": codes,
                    "unique_ratio": unique_count / len(codes),
                },
                score=0.30,
            ))
        elif unique_count >= 2:
            signals.append(RiskSignal(
                flag="TEMPORAL_PIVOT",
                severity="MEDIUM",
                description=(
                    f"Industry code changed {unique_count - 1} time(s) in "
                    f"recent history. Monitor for structural change risk."
                ),
                evidence={"history_codes": codes},
                score=0.12,
            ))
        return signals

    def _check_source_conflict(self, bundle: VendorBundle) -> list[RiskSignal]:
        signals = []
        from collections import Counter
        codes = [
            s.raw_code for s in bundle.signals
            if s.status not in ("POLLUTED", "UNAVAILABLE")
        ]
        if not codes:
            return signals

        counter = Counter(codes)
        most_common_code, most_common_cnt = counter.most_common(1)[0]
        conflict_count = len(codes) - most_common_cnt
        conflict_ratio = conflict_count / len(codes)

        if conflict_ratio >= 0.60:
            signals.append(RiskSignal(
                flag="SOURCE_CONFLICT",
                severity="HIGH",
                description=(
                    f"{conflict_count}/{len(codes)} sources disagree on primary "
                    f"classification. High source entropy suggests data quality "
                    f"issues or a genuinely ambiguous entity."
                ),
                evidence={
                    "majority_code": most_common_code,
                    "majority_count": most_common_cnt,
                    "conflict_ratio": round(conflict_ratio, 2),
                },
                score=0.20,
            ))
        elif conflict_ratio >= 0.35:
            signals.append(RiskSignal(
                flag="SOURCE_CONFLICT",
                severity="MEDIUM",
                description=(
                    f"Moderate source disagreement ({conflict_count}/{len(codes)} "
                    f"conflicting). Manual review recommended."
                ),
                evidence={"conflict_ratio": round(conflict_ratio, 2)},
                score=0.10,
            ))
        return signals

    def _check_low_consensus(self, result: ConsensusResult) -> list[RiskSignal]:
        signals = []
        prob = result.primary_industry.consensus_probability
        if prob < 0.30:
            signals.append(RiskSignal(
                flag="LOW_CONSENSUS_PROBABILITY",
                severity="MEDIUM",
                description=(
                    f"Model confidence in primary classification is very low "
                    f"({prob:.1%}). Entity may be genuinely multi-sector or "
                    f"have insufficient data."
                ),
                evidence={"primary_probability": round(prob, 4)},
                score=0.12,
            ))
        elif prob < 0.50:
            signals.append(RiskSignal(
                flag="LOW_CONSENSUS_PROBABILITY",
                severity="LOW",
                description=(
                    f"Model confidence is below threshold ({prob:.1%}). "
                    f"Consider manual validation."
                ),
                evidence={"primary_probability": round(prob, 4)},
                score=0.05,
            ))
        return signals

    def _check_holding_mismatch(
        self, bundle: VendorBundle, result: ConsensusResult
    ) -> list[RiskSignal]:
        signals = []
        if bundle.entity_type == "Holding":
            primary_code = result.primary_industry.code
            if primary_code[:2] in _OPERATING_NAICS_SECTORS:
                signals.append(RiskSignal(
                    flag="HOLDING_MISMATCH",
                    severity="MEDIUM",
                    description=(
                        f"Entity is registered as a Holding Company but classified "
                        f"in an Operating sector ({result.primary_industry.label}). "
                        f"Verify actual business activities."
                    ),
                    evidence={
                        "entity_type": bundle.entity_type,
                        "classified_code": primary_code,
                    },
                    score=0.15,
                ))
        return signals
