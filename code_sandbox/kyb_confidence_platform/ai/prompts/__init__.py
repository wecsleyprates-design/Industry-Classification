"""Prompt templates for AI Copilot, View Generator, and Check-Agent auditor."""

from .copilot    import COPILOT_SYSTEM, COPILOT_USER_TEMPLATE
from .view_gen   import VIEW_GEN_SYSTEM, VIEW_GEN_USER_TEMPLATE
from .check_llm  import CHECK_AUDITOR_SYSTEM, CHECK_AUDITOR_USER_TEMPLATE

__all__ = [
    "COPILOT_SYSTEM", "COPILOT_USER_TEMPLATE",
    "VIEW_GEN_SYSTEM", "VIEW_GEN_USER_TEMPLATE",
    "CHECK_AUDITOR_SYSTEM", "CHECK_AUDITOR_USER_TEMPLATE",
]
