"""
Metrics Registry — defines every KPI / metric exposed in the UI.

Each metric maps to:
  - a display label
  - a unit
  - a lineage key (→ `config/lineage_catalog`)
  - a resolver (a function in `analytics/` that materializes the value)

The registry keeps metric definitions decoupled from the UI.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MetricDef:
    key: str
    label: str
    unit: str            # "", "%", "score", "count"
    lineage_key: str
    description: str


REGISTRY: dict[str, MetricDef] = {
    "total_cases": MetricDef(
        key="total_cases",
        label="Total KYB Cases",
        unit="count",
        lineage_key="default",
        description="Number of KYB cases in the active filter window.",
    ),
    "distinct_customers": MetricDef(
        key="distinct_customers",
        label="Distinct Customers",
        unit="count",
        lineage_key="default",
        description="Count of unique customer accounts in window.",
    ),
    "distinct_businesses": MetricDef(
        key="distinct_businesses",
        label="Distinct Businesses",
        unit="count",
        lineage_key="default",
        description="Count of unique business entities in window.",
    ),
    "avg_confidence": MetricDef(
        key="avg_confidence",
        label="Average Confidence",
        unit="score",
        lineage_key="kpi.avg_confidence",
        description="Average of latest confidence_score fact per business.",
    ),
    "median_confidence": MetricDef(
        key="median_confidence",
        label="Median Confidence",
        unit="score",
        lineage_key="kpi.avg_confidence",
        description="Median of latest confidence_score fact per business.",
    ),
    "manual_review_pct": MetricDef(
        key="manual_review_pct",
        label="Manual Review %",
        unit="%",
        lineage_key="kpi.manual_review",
        description="Share of cases routed to manual review.",
    ),
    "auto_approve_pct": MetricDef(
        key="auto_approve_pct",
        label="Auto-Approved %",
        unit="%",
        lineage_key="kpi.manual_review",
        description="Share of cases auto-approved without manual review.",
    ),
}


def get(key: str) -> MetricDef | None:
    return REGISTRY.get(key)
