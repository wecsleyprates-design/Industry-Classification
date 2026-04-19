"""
Address / contact rule family.

Detects shared addresses/phones/domains across suspiciously unrelated entities
and USPS/SOS mismatches.
"""
from __future__ import annotations

from typing import Any

from ..taxonomy import RuleFamily, Severity


def _fact(facts, key, default=None):
    v = facts.get(key)
    if isinstance(v, dict):
        return v.get("value", default)
    return v if v is not None else default


def _to_int(x) -> int:
    try: return int(x)
    except Exception: return 0


def run(ctx: dict[str, Any]) -> list:
    from ..engine import Finding
    facts = ctx.get("facts", {}) or {}
    findings: list[Finding] = []
    entity_id = ctx.get("entity_id")

    # ADR-001: address used by many businesses
    n_biz_at_address = _to_int(_fact(facts, "address_shared_business_count", 0))
    if n_biz_at_address >= 5:
        findings.append(Finding(
            rule_id="ADR-001",
            rule_family=RuleFamily.ADDRESS_CONTACT,
            severity=Severity.HIGH,
            title="Address tied to many businesses",
            description=f"This address is filed for {n_biz_at_address} distinct businesses — possible cluster.",
            evidence="facts.address_shared_business_count",
            recommendation="Enhanced due diligence: verify physical presence and corporate relationships.",
            entity_id=entity_id,
        ))
    elif 3 <= n_biz_at_address < 5:
        findings.append(Finding(
            rule_id="ADR-001b",
            rule_family=RuleFamily.ADDRESS_CONTACT,
            severity=Severity.MEDIUM,
            title="Address moderately reused",
            description=f"Address is tied to {n_biz_at_address} distinct businesses.",
            evidence="facts.address_shared_business_count",
            recommendation="Review whether the businesses are part of a known corporate family.",
            entity_id=entity_id,
        ))

    # ADR-002: USPS deliverability failed
    deliverable = _fact(facts, "address_deliverable", None)
    if deliverable in (False, "false", "no", "not_deliverable"):
        findings.append(Finding(
            rule_id="ADR-002",
            rule_family=RuleFamily.ADDRESS_CONTACT,
            severity=Severity.MEDIUM,
            title="Address not deliverable (USPS)",
            description="Primary address failed USPS deliverability check.",
            evidence="facts.address_deliverable",
            recommendation="Request alternative proof-of-address or a suite/unit correction.",
            entity_id=entity_id,
        ))

    # ADR-003: phone shared by many businesses
    n_biz_at_phone = _to_int(_fact(facts, "phone_shared_business_count", 0))
    if n_biz_at_phone >= 4:
        findings.append(Finding(
            rule_id="ADR-003",
            rule_family=RuleFamily.ADDRESS_CONTACT,
            severity=Severity.MEDIUM,
            title="Phone number shared across businesses",
            description=f"Phone is used by {n_biz_at_phone} distinct businesses.",
            evidence="facts.phone_shared_business_count",
            recommendation="Validate this is a service-provider number (e.g., registered agent).",
            entity_id=entity_id,
        ))

    return findings
