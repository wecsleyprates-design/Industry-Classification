"""
Identifier rule family.

Detects TIN/EIN/registration-number anomalies, duplicates, and format errors.
"""
from __future__ import annotations

import re
from typing import Any

from ..taxonomy import RuleFamily, Severity


_TIN_RE = re.compile(r"^\d{2}-?\d{7}$")


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

    tin = _fact(facts, "tin", "") or _fact(facts, "ein", "")
    tin_match = _fact(facts, "tin_match", None)

    # IDR-001: malformed TIN
    if tin and not _TIN_RE.match(str(tin).strip().replace(" ", "")):
        findings.append(Finding(
            rule_id="IDR-001",
            rule_family=RuleFamily.IDENTIFIER,
            severity=Severity.LOW,
            title="TIN format looks unusual",
            description=f"TIN '{tin}' does not match the XX-XXXXXXX pattern.",
            evidence=f"facts.tin={tin!r}",
            recommendation="Re-collect the TIN or verify with IRS letter.",
            entity_id=entity_id,
        ))

    # IDR-002: TIN reported but match failed
    if tin and tin_match in (False, "failed", "failure", "no"):
        findings.append(Finding(
            rule_id="IDR-002",
            rule_family=RuleFamily.IDENTIFIER,
            severity=Severity.HIGH,
            title="TIN did not match IRS records",
            description="Applicant-reported TIN failed the IRS TIN/name match.",
            evidence="facts.tin vs facts.tin_match",
            recommendation="Request an IRS EIN confirmation letter.",
            entity_id=entity_id,
        ))

    # IDR-003: one TIN linked to multiple unrelated businesses (via shared_tin_count)
    shared = _fact(facts, "shared_tin_count", 0) or 0
    try:
        shared = int(shared)
    except (TypeError, ValueError):
        shared = 0
    if shared >= 2:
        findings.append(Finding(
            rule_id="IDR-003",
            rule_family=RuleFamily.IDENTIFIER,
            severity=Severity.HIGH,
            title="TIN shared across multiple businesses",
            description=f"The TIN for this business appears on {shared} distinct business records.",
            evidence="facts.shared_tin_count",
            recommendation="Investigate relationship graph for this TIN; require disambiguation.",
            entity_id=entity_id,
        ))

    return findings
