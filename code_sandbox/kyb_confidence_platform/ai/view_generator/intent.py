"""
Intent parser.

Extracts high-level signals from a natural-language query (metric, segmentation,
time grain) using lightweight heuristics. The LLM handles the rest.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Intent:
    raw: str
    metric_keyword: str
    segment: str | None
    time_grain: str | None


_METRIC_KWS = {
    "confidence": "confidence_score",
    "score":      "confidence_score",
    "manual":     "manual_review_rate",
    "review":     "manual_review_rate",
    "psi":        "score_psi",
    "drift":      "feature_drift",
    "decision":   "decision_mix",
    "turnaround": "tat",
    "tat":        "tat",
    "red flag":   "red_flag_count",
    "inconsist":  "inconsistency_count",
    "watchlist":  "watchlist_hits",
    "ubo":        "ubo_verified",
    "tin":        "tin_validation_status",
    "address":    "address_consistency",
}

_SEGMENT_KWS = {
    "domestic":   "entity_type:domestic",
    "foreign":    "entity_type:foreign",
    "texas":      "state:TX", "florida":"state:FL", "california":"state:CA",
    "delaware":   "state:DE", "nevada":"state:NV", "wyoming":"state:WY",
    "state":      "state:*", "band":"confidence_band:*", "sector":"industry:*",
}

_TIME_KWS = {
    "daily": "day", "per day": "day",
    "weekly": "week", "per week": "week",
    "monthly": "month", "per month": "month",
    "quarter": "month",
}


def parse(text: str) -> Intent:
    t = text.lower()
    metric = "confidence_score"
    for kw, canon in _METRIC_KWS.items():
        if kw in t:
            metric = canon
            break
    segment: str | None = None
    for kw, seg in _SEGMENT_KWS.items():
        if kw in t:
            segment = seg
            break
    grain: str | None = None
    for kw, g in _TIME_KWS.items():
        if kw in t:
            grain = g
            break
    # infer a default
    if grain is None and any(w in t for w in ("trend", "over time", "weekly", "history")):
        grain = "week"
    return Intent(raw=text, metric_keyword=metric, segment=segment, time_grain=grain)
