"""
Check-Agent engine.

Orchestrates deterministic rules across the 7 rule families and (optionally)
augments results with an LLM auditor pass.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from core.logger import get_logger

from .taxonomy import RuleFamily, Scope, Severity
from .rules import identity, identifier, address_contact, registration, model_output, temporal, network
from . import llm_auditor

log = get_logger(__name__)


@dataclass
class Finding:
    rule_id: str
    rule_family: RuleFamily
    severity: Severity
    title: str
    description: str
    evidence: str
    recommendation: str
    entity_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "rule_family": self.rule_family.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "evidence": self.evidence,
            "recommendation": self.recommendation,
            "entity_id": self.entity_id,
        }


RuleFn = Callable[[dict[str, Any]], list[Finding]]

RULE_REGISTRY: list[tuple[RuleFamily, RuleFn]] = [
    (RuleFamily.IDENTITY,        identity.run),
    (RuleFamily.IDENTIFIER,      identifier.run),
    (RuleFamily.ADDRESS_CONTACT, address_contact.run),
    (RuleFamily.REGISTRATION,    registration.run),
    (RuleFamily.MODEL_OUTPUT,    model_output.run),
    (RuleFamily.TEMPORAL,        temporal.run),
    (RuleFamily.NETWORK,         network.run),
]


@dataclass
class CheckResult:
    scope: Scope
    findings: list[Finding] = field(default_factory=list)
    summary: dict[str, int] = field(default_factory=dict)

    def by_severity(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for f in self.findings:
            counts[f.severity.value] = counts.get(f.severity.value, 0) + 1
        return counts


def run_check_agent(
    context: dict[str, Any],
    *,
    scope: Scope = Scope.ENTITY,
    families: list[RuleFamily] | None = None,
    include_llm_auditor: bool = True,
) -> CheckResult:
    """
    `context` is a flexible dict. Typical keys:
      entity_id, facts (dict), score, band, decision, relationships, timeline, evidence
    """
    selected = set(families) if families else {fam for fam, _ in RULE_REGISTRY}

    findings: list[Finding] = []
    for family, fn in RULE_REGISTRY:
        if family not in selected:
            continue
        try:
            out = fn(context) or []
            findings.extend(out)
        except Exception as exc:  # pragma: no cover
            log.warning("Rule family %s failed: %s", family.value, exc)

    if include_llm_auditor:
        try:
            findings.extend(llm_auditor.audit(context, findings))
        except Exception as exc:
            log.info("LLM auditor skipped (%s)", exc)

    # Sort by severity, strongest first
    findings.sort(key=lambda f: -f.severity.weight())

    result = CheckResult(scope=scope, findings=findings)
    result.summary = result.by_severity()
    return result
