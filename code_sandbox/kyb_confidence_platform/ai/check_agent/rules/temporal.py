"""
Temporal rule family.

Detects impossible event sequences and stale-data usage.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from ..taxonomy import RuleFamily, Severity


def _parse_ts(v: Any) -> datetime | None:
    if not v:
        return None
    if isinstance(v, datetime):
        return v
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(str(v), fmt)
        except ValueError:
            continue
    return None


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    facts = ctx.get("facts", {}) or {}
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")

    submitted = _parse_ts(facts.get("submitted_at") or ctx.get("submitted_at"))
    scored    = _parse_ts(facts.get("scored_at")    or ctx.get("scored_at"))
    decision  = _parse_ts(facts.get("decision_at")  or ctx.get("decision_at"))

    # TEM-001: decision before scoring
    if scored and decision and decision < scored:
        findings.append(Finding(
            rule_id="TEM-001",
            rule_family=RuleFamily.TEMPORAL,
            severity=Severity.CRITICAL,
            title="Decision recorded before scoring timestamp",
            description=f"decision_at={decision} < scored_at={scored}. Impossible sequence.",
            evidence="facts.decision_at vs facts.scored_at",
            recommendation="Investigate pipeline replay / backdating; freeze record.",
            entity_id=entity_id,
        ))

    # TEM-002: scoring before submission
    if submitted and scored and scored < submitted:
        findings.append(Finding(
            rule_id="TEM-002",
            rule_family=RuleFamily.TEMPORAL,
            severity=Severity.CRITICAL,
            title="Scoring recorded before submission",
            description=f"scored_at={scored} < submitted_at={submitted}.",
            evidence="facts.scored_at vs facts.submitted_at",
            recommendation="Investigate clock skew / replay.",
            entity_id=entity_id,
        ))

    # TEM-003: stale feature (> 180d)
    stale: list[str] = []
    for k, v in (facts or {}).items():
        if isinstance(v, dict) and "received_at" in v:
            ts = _parse_ts(v.get("received_at"))
            if ts and datetime.utcnow() - ts > timedelta(days=180):
                stale.append(k)
    if len(stale) >= 3:
        findings.append(Finding(
            rule_id="TEM-003",
            rule_family=RuleFamily.TEMPORAL,
            severity=Severity.MEDIUM,
            title="Stale features used in scoring",
            description=f"{len(stale)} features are older than 180 days: {', '.join(stale[:8])}",
            evidence="facts.*.received_at",
            recommendation="Trigger data refresh before re-scoring.",
            entity_id=entity_id,
        ))

    return findings
