"""
Model-output consistency rule family.

Flags cases where the confidence score disagrees with the underlying evidence
(e.g., high confidence despite missing critical features).
"""
from __future__ import annotations

from typing import Any

from ..taxonomy import RuleFamily, Severity


def _fact(facts, key, default=None):
    v = facts.get(key)
    if isinstance(v, dict):
        return v.get("value", default)
    return v if v is not None else default


def _to_float(x, default=0.0):
    try: return float(x)
    except Exception: return default


CRITICAL_FEATURES = ("tin_validation_status", "registration_active", "ubo_verified", "address_consistency")


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    facts = ctx.get("facts", {}) or {}
    score = _to_float(ctx.get("score"), default=0.0)
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")

    missing = [f for f in CRITICAL_FEATURES if not _fact(facts, f)]

    # MDL-001: high score despite missing critical features
    if score >= 0.75 and len(missing) >= 2:
        findings.append(Finding(
            rule_id="MDL-001",
            rule_family=RuleFamily.MODEL_OUTPUT,
            severity=Severity.HIGH,
            title="High confidence despite missing critical features",
            description=(
                f"Score={score:.2f} while critical features are missing: {', '.join(missing)}."
            ),
            evidence="score vs " + ", ".join(f"facts.{f}" for f in missing),
            recommendation="Hold for manual review; verify feature completeness before approving.",
            entity_id=entity_id,
        ))

    # MDL-002: low score despite clean evidence
    if score <= 0.35 and not missing:
        findings.append(Finding(
            rule_id="MDL-002",
            rule_family=RuleFamily.MODEL_OUTPUT,
            severity=Severity.MEDIUM,
            title="Low confidence despite clean evidence",
            description=f"Score={score:.2f} but all critical features are present.",
            evidence="score vs " + ", ".join(f"facts.{f}" for f in CRITICAL_FEATURES),
            recommendation="Review feature weights / model calibration; consider manual override.",
            entity_id=entity_id,
        ))

    # MDL-003: abrupt score change without data change
    prev = _to_float(ctx.get("previous_score"), default=score)
    data_changed = ctx.get("data_changed_since_last_score", False)
    if abs(score - prev) > 0.3 and not data_changed:
        findings.append(Finding(
            rule_id="MDL-003",
            rule_family=RuleFamily.MODEL_OUTPUT,
            severity=Severity.MEDIUM,
            title="Abrupt score change without underlying data change",
            description=f"Score shifted by {abs(score-prev):.2f} with no new evidence.",
            evidence="previous_score vs score",
            recommendation="Review model version / configuration changes.",
            entity_id=entity_id,
        ))

    return findings
