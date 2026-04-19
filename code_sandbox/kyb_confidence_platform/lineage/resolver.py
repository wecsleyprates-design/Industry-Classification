"""
Resolves feature / field lineage.

Combines `knowledge.metadata_catalog` with `knowledge.rag.retriever` hits to
give an upstream/downstream graph for any feature.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from knowledge.metadata_catalog import FEATURES
from knowledge.rag.retriever import retrieve, is_available


@dataclass
class FeatureLineage:
    name: str
    owner: str
    source_table: str
    downstream: list[str] = field(default_factory=list)
    upstream_tables: list[str] = field(default_factory=list)
    related_code: list[str] = field(default_factory=list)


def resolve_feature_lineage(name: str) -> FeatureLineage | None:
    f = next((x for x in FEATURES if x.name == name), None)
    if not f:
        return None
    lin = FeatureLineage(
        name=f.name,
        owner=f.owner,
        source_table=f.source_table,
        downstream=[d.strip() for d in f.downstream.split(",") if d.strip()],
        upstream_tables=[f.source_table],
        related_code=[],
    )

    # If RAG is indexed, pull related code references.
    if is_available():
        for hit in retrieve(f"feature {f.name} lineage", n=3):
            lin.related_code.append(hit.path)

    return lin
