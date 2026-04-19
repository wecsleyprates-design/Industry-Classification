"""
Identity rule family.

Detects inconsistencies in names / entity types / jurisdictions across sources.
"""
from __future__ import annotations

from typing import Any

from ..taxonomy import RuleFamily, Severity


def _fact(facts: dict, key: str, default: Any = None) -> Any:
    v = facts.get(key)
    if isinstance(v, dict):
        return v.get("value", default)
    return v if v is not None else default


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    facts = ctx.get("facts", {}) or {}
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")

    legal = _fact(facts, "legal_name", "")
    dba   = _fact(facts, "dba", "")
    providers = facts.get("providers", {}) or {}

    # Rule I01: legal name present but blank across all providers
    if legal and providers and not any(providers.values()):
        findings.append(Finding(
            rule_id="IDY-001",
            rule_family=RuleFamily.IDENTITY,
            severity=Severity.MEDIUM,
            title="Legal name not confirmed by any provider",
            description=f"Applicant-reported legal name '{legal}' was not found by any identity provider.",
            evidence="facts.legal_name vs facts.providers.*",
            recommendation="Request SOS filing or incorporation certificate.",
            entity_id=entity_id,
        ))

    # Rule I02: legal name vs DBA differ AND provider records disagree
    if legal and dba and legal.strip().lower() != dba.strip().lower():
        discrepant = [p for p, name in providers.items()
                      if name and name.strip().lower() not in {legal.strip().lower(), dba.strip().lower()}]
        if discrepant:
            findings.append(Finding(
                rule_id="IDY-002",
                rule_family=RuleFamily.IDENTITY,
                severity=Severity.HIGH,
                title="Legal vs DBA disagreement with provider records",
                description=(
                    f"Legal name '{legal}' and DBA '{dba}' do not match names reported by: {', '.join(discrepant)}."
                ),
                evidence=f"facts.legal_name={legal!r} dba={dba!r} providers={providers}",
                recommendation="Collect supporting filings; verify name variants against SOS.",
                entity_id=entity_id,
            ))

    # Rule I03: entity_type mismatch
    et_applicant = _fact(facts, "entity_type", "")
    et_registry  = _fact(facts, "entity_type_registry", "")
    if et_applicant and et_registry and et_applicant.lower() != et_registry.lower():
        findings.append(Finding(
            rule_id="IDY-003",
            rule_family=RuleFamily.IDENTITY,
            severity=Severity.MEDIUM,
            title="Entity type disagreement",
            description=f"Applicant says '{et_applicant}' but registry says '{et_registry}'.",
            evidence="facts.entity_type vs facts.entity_type_registry",
            recommendation="Confirm entity type with an authoritative filing.",
            entity_id=entity_id,
        ))

    return findings
