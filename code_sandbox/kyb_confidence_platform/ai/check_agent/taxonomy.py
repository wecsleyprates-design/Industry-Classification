"""Severity, rule family, and action vocabulary."""
from __future__ import annotations

from enum import Enum


class Severity(str, Enum):
    LOW      = "low"
    MEDIUM   = "medium"
    HIGH     = "high"
    CRITICAL = "critical"

    def weight(self) -> int:
        return {"low": 1, "medium": 2, "high": 3, "critical": 4}[self.value]


class Scope(str, Enum):
    PORTFOLIO = "portfolio"
    ENTITY    = "entity"
    OBJECT    = "object"


class RuleFamily(str, Enum):
    IDENTITY        = "identity"
    IDENTIFIER      = "identifier"
    ADDRESS_CONTACT = "address_contact"
    REGISTRATION    = "registration"
    MODEL_OUTPUT    = "model_output"
    TEMPORAL        = "temporal"
    NETWORK         = "network"
