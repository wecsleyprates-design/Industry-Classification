"""Check-Agent — deterministic rule engine + optional LLM auditor."""
from .engine import run_check_agent, Finding, Severity, Scope

__all__ = ["run_check_agent", "Finding", "Severity", "Scope"]
