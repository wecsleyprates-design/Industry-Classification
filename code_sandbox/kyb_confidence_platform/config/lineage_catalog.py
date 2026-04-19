"""
Lineage Catalog — the single source of truth for the 4-level Trust Layer.

Every important UI object registers a key here. The Lineage modal renders:
  L1 - Business Meaning
  L2 - Warehouse Source
  L3 - Transformation Logic
  L4 - Repo / Code Lineage (file references)
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class LineageEntry:
    key: str
    l1_business: str
    l2_warehouse: str
    l3_transformation: str
    l4_code_refs: tuple[str, ...]


_DEFAULT = LineageEntry(
    key="default",
    l1_business=(
        "Aggregated metric across the filtered population. "
        "Interpret relative to the confidence-band thresholds and the active date context."
    ),
    l2_warehouse=(
        "rds_warehouse_public.facts(business_id, name, value, received_at)"
    ),
    l3_transformation=(
        "Aggregation over the filtered window where facts.name matches the target metric."
    ),
    l4_code_refs=(
        "integration-service/lib/facts/kyb/index.ts",
        "ai-score-service/aiscore.py",
    ),
)


_CATALOG: dict[str, LineageEntry] = {
    "kpi.avg_confidence": LineageEntry(
        key="kpi.avg_confidence",
        l1_business="Mean of the latest confidence_score fact per business within the active filter window.",
        l2_warehouse="rds_warehouse_public.facts WHERE name='confidence_score'",
        l3_transformation=(
            "SELECT AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) "
            "FROM rds_warehouse_public.facts "
            "WHERE name='confidence_score' AND received_at BETWEEN :start AND :end"
        ),
        l4_code_refs=(
            "ai-score-service/aiscore.py",
            "ai-score-service/worth_score_model.py",
        ),
    ),
    "kpi.manual_review": LineageEntry(
        key="kpi.manual_review",
        l1_business="Share of cases routed to manual analyst review (relative to total cases in window).",
        l2_warehouse="rds_cases_public.cases(case_id, manual_review, created_at)",
        l3_transformation="COUNT(CASE WHEN manual_review THEN 1 END) / COUNT(*)",
        l4_code_refs=("case-service/lib/workflow/manualReview.ts",),
    ),
    "chart.bands": LineageEntry(
        key="chart.bands",
        l1_business="Distribution of confidence scores across 5 pre-defined bands.",
        l2_warehouse="rds_warehouse_public.facts WHERE name='confidence_score'",
        l3_transformation=(
            "Bucketize AVG score per business into [0-.2 / .2-.4 / .4-.6 / .6-.8 / .8-1.0]"
        ),
        l4_code_refs=("ai-score-service/lookups.py (band thresholds)",),
    ),
    "chart.confidence_trend": LineageEntry(
        key="chart.confidence_trend",
        l1_business="Weekly average confidence by entity type (domestic vs foreign).",
        l2_warehouse="rds_warehouse_public.facts JOIN rds_cases_public.businesses",
        l3_transformation=(
            "DATE_TRUNC('week', received_at), entity_type, AVG(score) — "
            "grouped by week and segment."
        ),
        l4_code_refs=("warehouse-service/datapooler/confidence_weekly.sql",),
    ),
    "chart.psi": LineageEntry(
        key="chart.psi",
        l1_business=(
            "Population Stability Index of the confidence score, comparing each week "
            "to a trailing 90-day baseline. PSI > 0.25 indicates material drift."
        ),
        l2_warehouse="datascience.score_psi_weekly(score_name, week, psi)",
        l3_transformation="Σ (pct_curr - pct_base) · ln(pct_curr / pct_base) over 10 quantile buckets.",
        l4_code_refs=("ai-score-service/stability.py",),
    ),
    "entity.confidence": LineageEntry(
        key="entity.confidence",
        l1_business="Confidence score for the currently selected business entity.",
        l2_warehouse="rds_warehouse_public.facts WHERE business_id=:id AND name='confidence_score'",
        l3_transformation="Latest record by received_at; value = JSON_EXTRACT_PATH_TEXT(value,'value').",
        l4_code_refs=("ai-score-service/aiscore.py",),
    ),
    "entity.features": LineageEntry(
        key="entity.features",
        l1_business="All feature values materialized for the selected entity, by vendor source.",
        l2_warehouse="rds_warehouse_public.facts",
        l3_transformation="Per feature: pick the highest-confidence source via sources.ts winner rules.",
        l4_code_refs=(
            "integration-service/lib/facts/sources.ts",
            "integration-service/lib/facts/rules.ts",
        ),
    ),
    "entity.rel_graph": LineageEntry(
        key="entity.rel_graph",
        l1_business="Graph of linked entities sharing identifiers (TIN, address, phone, UBO, email).",
        l2_warehouse="rds_warehouse_public.facts (address, tin, phone, ubo) across business_ids",
        l3_transformation="Cluster by normalized identifier; edge exists when two businesses share any identifier.",
        l4_code_refs=("integration-service/lib/match/entityMatching.ts",),
    ),
    "feature.registry": LineageEntry(
        key="feature.registry",
        l1_business="Catalog of model features: owner, activeness, type, and downstream consumers.",
        l2_warehouse="Feature registry is derived from facts + dbt metadata.",
        l3_transformation="Union of distinct facts.name with dbt-defined owner/active/type metadata.",
        l4_code_refs=("ai-score-service/features/registry.yml",),
    ),
}


def get(key: str) -> LineageEntry:
    return _CATALOG.get(key, _DEFAULT)


def all_keys() -> Iterable[str]:
    return _CATALOG.keys()


def register(entry: LineageEntry) -> None:
    _CATALOG[entry.key] = entry
