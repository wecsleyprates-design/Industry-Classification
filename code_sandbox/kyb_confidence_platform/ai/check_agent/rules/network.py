"""
Network / cluster rule family.

Flags entities whose relationship graph shows suspicious clusters.
"""
from __future__ import annotations

from typing import Any

from ..taxonomy import RuleFamily, Severity


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")
    rels = ctx.get("relationships", []) or []

    # NET-001: single UBO linked to many businesses
    ubo_links: dict[str, int] = {}
    for r in rels:
        if str(r.get("rel", "")).lower().startswith("ubo") or r.get("type") == "ubo":
            key = r.get("ubo_id") or r.get("ubo") or "unknown"
            ubo_links[str(key)] = ubo_links.get(str(key), 0) + 1

    for ubo, n in ubo_links.items():
        if n >= 4:
            findings.append(Finding(
                rule_id="NET-001",
                rule_family=RuleFamily.NETWORK,
                severity=Severity.HIGH if n >= 6 else Severity.MEDIUM,
                title="UBO linked to many entities",
                description=f"UBO '{ubo}' is tied to {n} distinct businesses.",
                evidence="relationships[type=ubo]",
                recommendation="Request UBO disclosure and verify independent control for each entity.",
                entity_id=entity_id,
            ))

    # NET-002: resubmission pattern with small identity changes
    resub_count = int(ctx.get("resubmission_count", 0) or 0)
    if resub_count >= 3:
        findings.append(Finding(
            rule_id="NET-002",
            rule_family=RuleFamily.NETWORK,
            severity=Severity.MEDIUM,
            title="Suspicious resubmission behavior",
            description=f"Entity has {resub_count} resubmissions with minor identity variations.",
            evidence="ctx.resubmission_count",
            recommendation="Compare identity deltas across resubmissions; escalate if changes are cosmetic.",
            entity_id=entity_id,
        ))

    # NET-003: cluster score from upstream graph analytics
    cluster_size = int(ctx.get("cluster_size", 0) or 0)
    cluster_disjoint = bool(ctx.get("cluster_disjoint", False))
    if cluster_size >= 6 and cluster_disjoint:
        findings.append(Finding(
            rule_id="NET-003",
            rule_family=RuleFamily.NETWORK,
            severity=Severity.HIGH,
            title="Large cluster with no common control",
            description=f"Entity sits in a cluster of {cluster_size} businesses without an identified common owner.",
            evidence="ctx.cluster_size, ctx.cluster_disjoint",
            recommendation="Flag cluster for enhanced due diligence; escalate to compliance.",
            entity_id=entity_id,
        ))

    return findings
