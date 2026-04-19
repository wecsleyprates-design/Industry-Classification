"""Unit tests for deterministic Check-Agent rules."""
from __future__ import annotations

from ai.check_agent import run_check_agent, Scope
from ai.check_agent.taxonomy import Severity


def test_temporal_impossible_sequence():
    ctx = {
        "entity_id": "bus_x",
        "facts": {
            "submitted_at": "2026-03-12 09:14:00",
            "scored_at":    "2026-03-12 10:00:00",
            "decision_at":  "2026-03-12 09:30:00",  # before scoring
        },
        "score": 0.6,
    }
    res = run_check_agent(ctx, scope=Scope.ENTITY, include_llm_auditor=False)
    assert any(f.rule_id == "TEM-001" for f in res.findings)


def test_high_score_missing_features():
    ctx = {
        "entity_id": "bus_y",
        "facts": {"tin_validation_status": None, "registration_active": None},
        "score": 0.9,
    }
    res = run_check_agent(ctx, scope=Scope.ENTITY, include_llm_auditor=False)
    assert any(f.rule_id == "MDL-001" for f in res.findings)


def test_shared_tin_flag():
    ctx = {
        "entity_id": "bus_z",
        "facts": {"tin": "12-3456789", "shared_tin_count": 4},
        "score": 0.5,
    }
    res = run_check_agent(ctx, scope=Scope.ENTITY, include_llm_auditor=False)
    ids = [f.rule_id for f in res.findings]
    assert "IDR-003" in ids


def test_no_false_positive_when_clean():
    ctx = {
        "entity_id": "bus_clean",
        "facts": {
            "tin_validation_status": "success",
            "registration_active": True,
            "ubo_verified": 1.0,
            "address_consistency": 0.95,
            "submitted_at": "2026-03-01 08:00",
            "scored_at":    "2026-03-01 08:05",
            "decision_at":  "2026-03-01 09:00",
        },
        "score": 0.82,
    }
    res = run_check_agent(ctx, scope=Scope.ENTITY, include_llm_auditor=False)
    # no CRITICAL/HIGH findings should appear
    assert not any(f.severity in (Severity.CRITICAL, Severity.HIGH) for f in res.findings)
