"""Unit tests for the AI View Generator (fake-key / offline mode)."""
from __future__ import annotations

from ai.view_generator import generate_view


def test_view_generator_offline_returns_safe_sql(monkeypatch):
    # Force fake-key mode
    monkeypatch.setenv("OPENAI_API_KEY", "sk-FAKE")
    # Force demo mode so we don't attempt a real Redshift query
    monkeypatch.setenv("DEMO_MODE", "true")

    from importlib import reload
    import config.settings as s
    reload(s)

    v = generate_view("Compare domestic vs foreign confidence over the last 90 days")
    assert v.sql.lower().lstrip().startswith(("select", "with"))
    assert "LIMIT" in v.sql.upper()
