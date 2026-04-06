"""
naics_mcc_classifier/consensus.py
===================================
Deterministic weighted vendor consensus — mirrors Pipeline A Fact Engine weights.

Architecture (replacing the previous 1009-class XGBoost):

  TIER 0 — Analyst override (always wins, from facts table override field)

  TIER 1 — Full weighted consensus (all available vendors agree on sector)
    Sources ranked by Pipeline A weight:
      OC  (weight 0.9, match_confidence >= threshold)
      ZI  (weight 0.8, match_confidence >= threshold)
      EFX (weight 0.7, match_confidence >= threshold)
    Rule: factWithHighestConfidence() → if gap > 0.05 → winner
          else weightedFactSelector() → highest weight wins tie

  TIER 2 — Single high-confidence vendor
    Any source with match_confidence >= HIGH_CONFIDENCE_THRESHOLD

  TIER 3 — XGBoost sector conflict resolver
    When vendors disagree on 2-digit sector → model picks sector,
    then vendor code within that sector is used
    XGBoost input: binary agreement features (NOT raw label-encoded codes)

  TIER 4 — Name keyword inference
    Keywords map business name to a NAICS sector
    Used when vendors have no signal at all

  TIER 5 — Send to AI (GPT with open web search)
    Confidence < ALL thresholds → fire GPT with full vendor context

Key insight: The model's job is NOT to predict NAICS from scratch.
Its job is to ARBITRATE between vendor candidates and resolve conflicts.
"""
from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd

from .config import NAICS_FALLBACK, MCC_FALLBACK

logger = logging.getLogger(__name__)

# ── Pipeline A source weights (from integration-service/lib/facts/sources.ts) ─
SOURCE_WEIGHTS = {
    "oc":  0.9,   # OpenCorporates — global registry, highest vendor weight
    "zi":  0.8,   # ZoomInfo
    "efx": 0.7,   # Equifax
}

# ── Confidence thresholds ─────────────────────────────────────────────────────
WEIGHT_THRESHOLD          = 0.05   # gap to declare clear winner (matches rules.ts)
HIGH_CONFIDENCE_THRESHOLD = 0.75   # single source "just use it"
MEDIUM_CONFIDENCE_THRESHOLD = 0.55 # single source "probably right"
MIN_MATCH_CONFIDENCE      = 0.50   # below this → don't trust the match at all

# ── Outcome labels ────────────────────────────────────────────────────────────
OUTCOME_CONSENSUS      = "consensus"        # ≥2 sources agree
OUTCOME_SINGLE_HIGH    = "single_high"      # 1 source, high confidence
OUTCOME_SINGLE_MEDIUM  = "single_medium"    # 1 source, medium confidence
OUTCOME_CONFLICT       = "conflict"         # sources disagree on sector
OUTCOME_NAME_ONLY      = "name_only"        # no vendor signals
OUTCOME_SEND_TO_AI     = "send_to_ai"       # no reliable signal at all


@dataclass
class VendorCandidate:
    """One vendor's NAICS contribution."""
    source: str                   # "oc" | "zi" | "efx"
    naics6: str                   # 6-digit NAICS code
    naics_sector: str             # 2-digit sector (first 2 chars)
    naics_group: str              # 4-digit group
    match_confidence: float       # entity-matching confidence (0-1)
    naics_source_confidence: float # vendor's own NAICS confidence (0-1, or match_conf)
    weight: float                 # Pipeline A source weight

    @property
    def effective_confidence(self) -> float:
        """Combined confidence: match quality × source weight."""
        return self.match_confidence * self.weight


@dataclass
class ConsensusResult:
    """Output of the consensus layer for one business."""
    outcome: str
    naics6: str               # best NAICS code
    naics_sector: str         # 2-digit sector
    confidence: float         # overall confidence (0-1)
    winning_source: str       # which source won ("oc", "zi", "efx", "name", "none")
    candidates: list[VendorCandidate] = field(default_factory=list)
    sector_agreement: int = 0 # count of sources agreeing on 2-digit sector
    code_agreement: int = 0   # count agreeing on exact 6-digit code
    conflict_sectors: list[str] = field(default_factory=list)
    name_keywords: list[str] = field(default_factory=list)
    explanation: str = ""

    @property
    def is_reliable(self) -> bool:
        return self.outcome in (OUTCOME_CONSENSUS, OUTCOME_SINGLE_HIGH)

    @property
    def needs_xgboost(self) -> bool:
        return self.outcome == OUTCOME_CONFLICT

    @property
    def needs_ai(self) -> bool:
        return self.outcome in (OUTCOME_SEND_TO_AI, OUTCOME_NAME_ONLY)


# ── Name keyword → NAICS sector mapping ──────────────────────────────────────
# Maps detected name keywords to (naics_sector, candidate_naics6, description)
KEYWORD_NAICS = {
    "restaurant":   ("72", "722511", "Full-Service Restaurants"),
    "pizza":        ("72", "722513", "Limited-Service Restaurants"),
    "cafe":         ("72", "722515", "Snack & Nonalcoholic Beverage Bars"),
    "coffee":       ("72", "722515", "Snack & Nonalcoholic Beverage Bars"),
    "bakery":       ("72", "722515", "Snack & Nonalcoholic Beverage Bars"),
    "grill":        ("72", "722511", "Full-Service Restaurants"),
    "diner":        ("72", "722511", "Full-Service Restaurants"),
    "bar":          ("72", "722410", "Drinking Places (Alcoholic Beverages)"),
    "salon":        ("81", "812113", "Nail Salons"),
    "nail":         ("81", "812113", "Nail Salons"),
    "spa":          ("81", "812199", "Other Personal Care Services"),
    "beauty":       ("81", "812112", "Beauty Salons"),
    "barber":       ("81", "812111", "Barber Shops"),
    "hair":         ("81", "812112", "Beauty Salons"),
    "dental":       ("62", "621210", "Offices of Dentists"),
    "dentist":      ("62", "621210", "Offices of Dentists"),
    "physician":    ("62", "621111", "Offices of Physicians (except Mental Health)"),
    "medical":      ("62", "621111", "Offices of Physicians (except Mental Health)"),
    "clinic":       ("62", "621111", "Offices of Physicians (except Mental Health)"),
    "therapy":      ("62", "621340", "Offices of Physical, Occupational & Speech Therapists"),
    "chiropractic": ("62", "621310", "Offices of Chiropractors"),
    "pharmacy":     ("44", "446110", "Pharmacies & Drug Stores"),
    "attorney":     ("54", "541110", "Offices of Lawyers"),
    "law":          ("54", "541110", "Offices of Lawyers"),
    "legal":        ("54", "541110", "Offices of Lawyers"),
    "solicitor":    ("54", "541110", "Offices of Lawyers"),
    "accounting":   ("54", "541211", "Offices of Certified Public Accountants"),
    "cpa":          ("54", "541211", "Offices of Certified Public Accountants"),
    "bookkeeping":  ("54", "541214", "Payroll Services"),
    "construction": ("23", "238990", "All Other Specialty Trade Contractors"),
    "plumb":        ("23", "238220", "Plumbing, Heating, A/C Contractors"),
    "electrician":  ("23", "238210", "Electrical Contractors"),
    "electric":     ("23", "238210", "Electrical Contractors"),
    "hvac":         ("23", "238220", "Plumbing, Heating, A/C Contractors"),
    "roofing":      ("23", "238160", "Roofing Contractors"),
    "concrete":     ("23", "238110", "Poured Concrete Foundation Contractors"),
    "landscap":     ("56", "561730", "Landscaping Services"),
    "lawn":         ("56", "561730", "Landscaping Services"),
    "cleaning":     ("56", "561720", "Janitorial Services"),
    "janitorial":   ("56", "561720", "Janitorial Services"),
    "software":     ("54", "541511", "Custom Computer Programming Services"),
    "tech":         ("54", "541519", "Other Computer Related Services"),
    "cyber":        ("54", "541512", "Computer Systems Design Services"),
    "cloud":        ("54", "541519", "Other Computer Related Services"),
    "systems":      ("54", "541512", "Computer Systems Design Services"),
    "trucking":     ("48", "484110", "General Freight Trucking, Local"),
    "transport":    ("48", "484110", "General Freight Trucking, Local"),
    "freight":      ("48", "484110", "General Freight Trucking, Local"),
    "logistics":    ("48", "488510", "Freight Transportation Arrangement"),
    "moving":       ("48", "484210", "Used Household & Office Goods Moving"),
    "church":       ("81", "813110", "Religious Organizations"),
    "ministry":     ("81", "813110", "Religious Organizations"),
    "chapel":       ("81", "813110", "Religious Organizations"),
    "temple":       ("81", "813110", "Religious Organizations"),
    "mosque":       ("81", "813110", "Religious Organizations"),
    "synagogue":    ("81", "813110", "Religious Organizations"),
    "daycare":      ("62", "624410", "Child Day Care Services"),
    "childcare":    ("62", "624410", "Child Day Care Services"),
    "preschool":    ("61", "611110", "Elementary & Secondary Schools"),
    "school":       ("61", "611110", "Elementary & Secondary Schools"),
    "auto":         ("81", "811111", "General Automotive Repair"),
    "mechanic":     ("81", "811111", "General Automotive Repair"),
    "collision":    ("81", "811121", "Automotive Body, Paint, Interior Repair"),
    "tires":        ("44", "441320", "Tire Dealers"),
    "realty":       ("53", "531210", "Offices of Real Estate Agents & Brokers"),
    "real estate":  ("53", "531210", "Offices of Real Estate Agents & Brokers"),
    "property":     ("53", "531110", "Lessors of Residential Buildings"),
    "apartment":    ("53", "531110", "Lessors of Residential Buildings"),
    "insurance":    ("52", "524210", "Insurance Agencies & Brokerages"),
    "financial":    ("52", "522110", "Commercial Banking"),
    "mortgage":     ("52", "522292", "Real Estate Credit"),
    "grocery":      ("44", "445110", "Supermarkets & Other Grocery Stores"),
    "retail":       ("44", "459999", "All Other Retailers"),
    "wholesale":    ("42", "423990", "Other Misc Durable Goods Merchant Wholesalers"),
    "staffing":     ("56", "561320", "Temporary Help Services"),
    "marketing":    ("54", "541613", "Marketing Consulting Services"),
    "advertising":  ("54", "541810", "Advertising Agencies"),
    "media":        ("51", "519130", "Internet Publishing & Broadcasting"),
    "printing":     ("32", "323111", "Commercial Printing (except Screen & Books)"),
    "hotel":        ("72", "721110", "Hotels & Motels"),
    "motel":        ("72", "721110", "Hotels & Motels"),
    "farm":         ("11", "111998", "All Other Misc Crop Farming"),
    "agriculture":  ("11", "111998", "All Other Misc Crop Farming"),
    "manufact":     ("31", "339999", "All Other Miscellaneous Manufacturing"),
    "fabricat":     ("33", "332999", "All Other Misc Fabricated Metal Product Mfg"),
    "weld":         ("33", "332811", "Metal Heat Treating"),
    "nonprofit":    ("81", "813319", "Other Social Advocacy Organizations"),
    "foundation":   ("81", "813211", "Grantmaking Foundations"),
    "veterinar":    ("54", "541940", "Veterinary Services"),
    "vet ":         ("54", "541940", "Veterinary Services"),
    "animal":       ("54", "541940", "Veterinary Services"),
    "optom":        ("62", "621320", "Offices of Optometrists"),
    "vision":       ("44", "446130", "Optical Goods Stores"),
    "fitness":      ("71", "713940", "Fitness & Recreational Sports Centers"),
    "gym":          ("71", "713940", "Fitness & Recreational Sports Centers"),
    "yoga":         ("71", "713940", "Fitness & Recreational Sports Centers"),
    "photography":  ("54", "541921", "Photography Studios, Portrait"),
    "photo":        ("54", "541921", "Photography Studios, Portrait"),
}

_KEYWORD_PATTERNS = {k: v for k, v in KEYWORD_NAICS.items()}


def detect_name_keywords(name: str) -> list[tuple[str, str, str, str]]:
    """
    Returns list of (keyword, naics_sector, naics6, description) for detected keywords.
    """
    name_lower = name.lower()
    found = []
    seen_sectors = set()
    for kw, (sector, naics6, desc) in _KEYWORD_PATTERNS.items():
        if kw in name_lower and sector not in seen_sectors:
            found.append((kw, sector, naics6, desc))
            seen_sectors.add(sector)
    return found


def build_candidates(
    zi_naics6: str,
    zi_match_confidence: float,
    efx_naics6: str,
    efx_match_confidence: float,
    oc_naics6: str,
    oc_match_confidence: float,
) -> list[VendorCandidate]:
    """Build the list of valid vendor candidates above minimum threshold."""
    raw = [
        ("oc",  oc_naics6,  oc_match_confidence,  SOURCE_WEIGHTS["oc"]),
        ("zi",  zi_naics6,  zi_match_confidence,  SOURCE_WEIGHTS["zi"]),
        ("efx", efx_naics6, efx_match_confidence, SOURCE_WEIGHTS["efx"]),
    ]
    candidates = []
    for source, naics6, conf, weight in raw:
        code = str(naics6).strip()
        if not code or code == NAICS_FALLBACK or len(code) < 2:
            continue
        if conf < MIN_MATCH_CONFIDENCE:
            continue
        candidates.append(VendorCandidate(
            source=source,
            naics6=code,
            naics_sector=code[:2],
            naics_group=code[:4],
            match_confidence=conf,
            naics_source_confidence=conf,
            weight=weight,
        ))
    return candidates


def apply_consensus(
    business_name: str,
    zi_naics6: str = "",
    zi_match_confidence: float = 0.0,
    efx_naics6: str = "",
    efx_match_confidence: float = 0.0,
    oc_naics6: str = "",
    oc_match_confidence: float = 0.0,
) -> ConsensusResult:
    """
    Core consensus logic. Returns a ConsensusResult indicating what to do.

    This mirrors Pipeline A's factWithHighestConfidence() + weightedFactSelector()
    but with explicit OC priority and direct NAICS code propagation.
    """
    candidates = build_candidates(
        zi_naics6, zi_match_confidence,
        efx_naics6, efx_match_confidence,
        oc_naics6, oc_match_confidence,
    )

    name_kws = detect_name_keywords(business_name)

    # ── No vendor signals at all ───────────────────────────────────────────────
    if not candidates:
        if name_kws:
            best_kw = name_kws[0]  # take first keyword match
            return ConsensusResult(
                outcome=OUTCOME_NAME_ONLY,
                naics6=best_kw[2],
                naics_sector=best_kw[1],
                confidence=0.40,
                winning_source="name",
                candidates=[],
                name_keywords=[kw for kw, _, _, _ in name_kws],
                explanation=f"No vendor matches. Name keyword '{best_kw[0]}' → NAICS {best_kw[2]}"
            )
        return ConsensusResult(
            outcome=OUTCOME_SEND_TO_AI,
            naics6=NAICS_FALLBACK,
            naics_sector="",
            confidence=0.0,
            winning_source="none",
            candidates=[],
            name_keywords=[],
            explanation="No vendor signals and no deducible keywords."
        )

    # ── Sort by effective confidence (match_confidence × weight) ──────────────
    candidates.sort(key=lambda c: c.effective_confidence, reverse=True)

    # ── Count sector and code agreement ───────────────────────────────────────
    sector_counts: dict[str, int] = {}
    for c in candidates:
        sector_counts[c.naics_sector] = sector_counts.get(c.naics_sector, 0) + 1
    dominant_sector = max(sector_counts, key=sector_counts.get)
    sector_agreement = sector_counts[dominant_sector]

    code_counts: dict[str, int] = {}
    for c in candidates:
        code_counts[c.naics6] = code_counts.get(c.naics6, 0) + 1
    dominant_code = max(code_counts, key=code_counts.get)
    code_agreement = code_counts[dominant_code]

    conflict_sectors = [s for s in sector_counts if s != dominant_sector]

    # ── TIER 1: factWithHighestConfidence() logic ──────────────────────────────
    top = candidates[0]
    second = candidates[1] if len(candidates) > 1 else None

    if second is None:
        # Only one candidate
        if top.effective_confidence >= HIGH_CONFIDENCE_THRESHOLD * top.weight:
            return ConsensusResult(
                outcome=OUTCOME_SINGLE_HIGH,
                naics6=top.naics6,
                naics_sector=top.naics_sector,
                confidence=top.effective_confidence,
                winning_source=top.source,
                candidates=candidates,
                sector_agreement=1,
                code_agreement=1,
                name_keywords=[kw for kw, _, _, _ in name_kws],
                explanation=f"Single vendor {top.source.upper()}: {top.naics6} (conf={top.effective_confidence:.2f})"
            )
        elif top.effective_confidence >= MEDIUM_CONFIDENCE_THRESHOLD * top.weight:
            return ConsensusResult(
                outcome=OUTCOME_SINGLE_MEDIUM,
                naics6=top.naics6,
                naics_sector=top.naics_sector,
                confidence=top.effective_confidence,
                winning_source=top.source,
                candidates=candidates,
                name_keywords=[kw for kw, _, _, _ in name_kws],
                explanation=f"Single vendor {top.source.upper()} medium conf: {top.naics6}"
            )
        else:
            return ConsensusResult(
                outcome=OUTCOME_SEND_TO_AI,
                naics6=NAICS_FALLBACK,
                naics_sector="",
                confidence=top.effective_confidence,
                winning_source="none",
                candidates=candidates,
                name_keywords=[kw for kw, _, _, _ in name_kws],
                explanation=f"Only vendor {top.source.upper()} below threshold ({top.effective_confidence:.2f})"
            )

    # Gap between top and second
    gap = top.effective_confidence - second.effective_confidence

    # ── Sector conflict: sources disagree on 2-digit sector ───────────────────
    if conflict_sectors and sector_agreement < len(candidates):
        # Name keyword can resolve if it agrees with one side
        if name_kws:
            kw_sector = name_kws[0][1]
            sector_match = [c for c in candidates if c.naics_sector == kw_sector]
            if sector_match:
                winner = max(sector_match, key=lambda c: c.effective_confidence)
                return ConsensusResult(
                    outcome=OUTCOME_CONSENSUS,
                    naics6=winner.naics6,
                    naics_sector=winner.naics_sector,
                    confidence=min(winner.effective_confidence + 0.10, 0.95),
                    winning_source=winner.source,
                    candidates=candidates,
                    sector_agreement=sector_agreement + 1,  # +1 for name keyword
                    code_agreement=code_agreement,
                    conflict_sectors=conflict_sectors,
                    name_keywords=[kw for kw, _, _, _ in name_kws],
                    explanation=f"Vendor conflict resolved by name keyword '{name_kws[0][0]}'"
                )
        return ConsensusResult(
            outcome=OUTCOME_CONFLICT,
            naics6=top.naics6,   # best guess — XGBoost should arbitrate
            naics_sector=dominant_sector,
            confidence=top.effective_confidence,
            winning_source=top.source,
            candidates=candidates,
            sector_agreement=sector_agreement,
            code_agreement=code_agreement,
            conflict_sectors=conflict_sectors,
            name_keywords=[kw for kw, _, _, _ in name_kws],
            explanation=f"Vendors disagree on sector: {[c.naics_sector for c in candidates]}"
        )

    # ── Sources agree on sector ───────────────────────────────────────────────
    # Apply factWithHighestConfidence / weightedFactSelector
    if gap > WEIGHT_THRESHOLD:
        # Clear winner by confidence gap
        winner = top
    else:
        # Tie-break by Pipeline A weight (OC > ZI > EFX)
        winner = max(candidates, key=lambda c: (c.weight, c.effective_confidence))

    # Use code with highest agreement count
    best_code = dominant_code if code_agreement >= 2 else winner.naics6
    combined_conf = sum(c.effective_confidence for c in candidates) / len(candidates)
    combined_conf = min(combined_conf * 1.2, 0.97)  # boost for agreement

    return ConsensusResult(
        outcome=OUTCOME_CONSENSUS,
        naics6=best_code,
        naics_sector=best_code[:2],
        confidence=combined_conf,
        winning_source=winner.source,
        candidates=candidates,
        sector_agreement=len(candidates),
        code_agreement=code_agreement,
        name_keywords=[kw for kw, _, _, _ in name_kws],
        explanation=(
            f"{len(candidates)} sources agree on sector {best_code[:2]}. "
            f"Winner: {winner.source.upper()} (weight={winner.weight}). "
            f"Code agreement: {code_agreement}/{len(candidates)} on {best_code}"
        )
    )
