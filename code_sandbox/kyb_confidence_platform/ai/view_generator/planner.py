"""
Planner.

Given an `Intent`, choose which metric/segmentation/visualization to produce.
Used as a fallback when the LLM is offline and to pre-populate the view spec.
"""
from __future__ import annotations

from dataclasses import dataclass

from .intent import Intent


@dataclass
class Plan:
    metric: str
    segment: str | None
    time_grain: str | None
    visualization: str
    summary: str


def plan_from_intent(intent: Intent) -> Plan:
    m = intent.metric_keyword
    viz = "line" if intent.time_grain else "kpi"
    if m in ("decision_mix",):
        viz = "stacked_bar"
    elif m in ("score_psi", "feature_drift"):
        viz = "line"
    elif m in ("red_flag_count", "inconsistency_count"):
        viz = "bar"
    summary = f"Compute {m}" + (f" by {intent.segment}" if intent.segment else "") \
              + (f" per {intent.time_grain}" if intent.time_grain else "")
    return Plan(metric=m, segment=intent.segment, time_grain=intent.time_grain, visualization=viz, summary=summary)
