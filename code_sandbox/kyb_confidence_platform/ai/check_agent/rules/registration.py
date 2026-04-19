"""
Registration rule family.

Detects disagreement between applicant-reported and authoritative registry
fields (active/dissolved, domestic/foreign), and jurisdiction anomalies.
"""
from __future__ import annotations

from typing import Any

from ..taxonomy import RuleFamily, Severity


def _fact(facts, key, default=None):
    v = facts.get(key)
    if isinstance(v, dict):
        return v.get("value", default)
    return v if v is not None else default


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    facts = ctx.get("facts", {}) or {}
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")

    status_registry = str(_fact(facts, "registration_status", "") or "").lower()
    status_applicant = str(_fact(facts, "applicant_registration_status", "") or "").lower()
    is_registered = _fact(facts, "registration_active", None)

    # REG-001: registry says dissolved while scoring still runs
    if "dissolv" in status_registry and is_registered is True:
        findings.append(Finding(
            rule_id="REG-001",
            rule_family=RuleFamily.REGISTRATION,
            severity=Severity.CRITICAL,
            title="Dissolved entity flagged as active",
            description="Registry reports dissolved status while the business is treated as active.",
            evidence=f"facts.registration_status={status_registry!r} vs facts.registration_active={is_registered}",
            recommendation="Halt onboarding; confirm reinstatement before proceeding.",
            entity_id=entity_id,
        ))

    # REG-002: applicant says active, registry says otherwise
    if status_applicant and status_registry and status_applicant != status_registry:
        findings.append(Finding(
            rule_id="REG-002",
            rule_family=RuleFamily.REGISTRATION,
            severity=Severity.HIGH,
            title="Applicant vs registry status disagreement",
            description=f"Applicant-reported '{status_applicant}' vs registry '{status_registry}'.",
            evidence="facts.applicant_registration_status vs facts.registration_status",
            recommendation="Reconcile with authoritative SOS filing.",
            entity_id=entity_id,
        ))

    # REG-003: foreign entity with missing qualification docs
    entity_type = str(_fact(facts, "entity_type", "") or "").lower()
    foreign = "foreign" in entity_type or _fact(facts, "is_foreign", False)
    foreign_docs_ok = _fact(facts, "foreign_qualification_docs", None)
    if foreign and foreign_docs_ok in (False, None, "", "missing"):
        findings.append(Finding(
            rule_id="REG-003",
            rule_family=RuleFamily.REGISTRATION,
            severity=Severity.MEDIUM,
            title="Foreign entity missing qualification docs",
            description="Entity appears foreign but qualification/registration documents are not available.",
            evidence="facts.entity_type + facts.foreign_qualification_docs",
            recommendation="Collect foreign qualification filing for operating states.",
            entity_id=entity_id,
        ))

    return findings
