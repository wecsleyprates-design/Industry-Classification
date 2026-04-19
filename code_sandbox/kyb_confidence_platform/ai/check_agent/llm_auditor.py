"""
LLM Auditor — optional cross-field reasoning pass.

Runs ONLY when a live OpenAI key is configured. Returns zero findings otherwise
(deterministic rules are authoritative regardless of LLM availability).
"""
from __future__ import annotations

import json
from typing import Any

from ai.client import chat_completion, openai_status
from ai.prompts import CHECK_AUDITOR_SYSTEM, CHECK_AUDITOR_USER_TEMPLATE
from core.logger import get_logger

from .taxonomy import RuleFamily, Severity

log = get_logger(__name__)


def audit(context: dict[str, Any], deterministic_findings: list) -> list:
    if openai_status() != "live":
        return []

    facts = context.get("facts", {})
    payload = {
        "entity_id": context.get("entity_id"),
        "score":     context.get("score"),
        "band":      context.get("band"),
        "decision":  context.get("decision"),
        "facts":     facts,
        "relationships": context.get("relationships", []),
        "timeline":  context.get("timeline", []),
    }

    messages = [
        {"role": "system", "content": CHECK_AUDITOR_SYSTEM},
        {"role": "user", "content": CHECK_AUDITOR_USER_TEMPLATE.format(
            facts_json=json.dumps(payload, default=str, indent=2),
            deterministic_findings=json.dumps(
                [f.to_dict() for f in deterministic_findings], indent=2
            ),
        )},
    ]
    text = chat_completion(messages, temperature=0.1)

    from .engine import Finding  # local import to avoid cycles
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        log.warning("LLM auditor: non-JSON response, discarding.")
        return []

    out: list[Finding] = []
    for f in parsed.get("findings", []):
        try:
            out.append(Finding(
                rule_id=f"llm.{f.get('rule_family','other')}.{f.get('title','x').lower().replace(' ','_')[:40]}",
                rule_family=RuleFamily(f.get("rule_family", "other")) if f.get("rule_family") in RuleFamily._value2member_map_ else RuleFamily.IDENTITY,
                severity=Severity(f.get("severity", "low")) if f.get("severity") in Severity._value2member_map_ else Severity.LOW,
                title=f.get("title", "LLM finding"),
                description=f.get("description", ""),
                evidence=f.get("evidence", ""),
                recommendation=f.get("recommendation", "Review with analyst."),
                entity_id=context.get("entity_id"),
            ))
        except Exception as exc:  # pragma: no cover
            log.warning("Skipping malformed LLM finding: %s", exc)
    return out
