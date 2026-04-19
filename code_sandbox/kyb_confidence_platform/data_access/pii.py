"""
PII masking helpers.

Applied before any row reaches the UI or an LLM prompt.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

import pandas as pd

from config.settings import SETTINGS

SENSITIVE_COLUMNS = {
    "tin", "ein", "ssn", "tax_id", "taxid",
    "dob", "date_of_birth",
    "passport_number", "passport",
    "driver_license", "drivers_license", "dl",
    "phone_number", "phone",
    "email",
}

_TIN_RE = re.compile(r"\b(\d{2})[- ]?(\d{3,4})[- ]?(\d{4})\b")
_EMAIL_RE = re.compile(r"([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
_PHONE_RE = re.compile(r"(\+?\d{1,2}\s*)?(\(?\d{3}\)?[\s.-]?)(\d{3})[\s.-]?(\d{4})")


def mask_value(v: Any, col_name: str | None = None) -> Any:
    if not SETTINGS.pii_masking:
        return v
    if v is None or pd.isna(v):  # type: ignore[arg-type]
        return v

    name = (col_name or "").lower()
    s = str(v)
    if name in SENSITIVE_COLUMNS:
        if name in {"tin", "ein", "ssn", "tax_id", "taxid"}:
            return _mask_tin(s)
        if name in {"email"}:
            return _EMAIL_RE.sub(r"\1***\2", s)
        if name in {"phone", "phone_number"}:
            return _mask_phone(s)
        if name in {"dob", "date_of_birth"}:
            return "***-**-****"
        return "***"

    # Heuristic masking on free-text columns as well
    s = _TIN_RE.sub(lambda m: f"XX-XXX{m.group(3)}", s)
    s = _EMAIL_RE.sub(r"\1***\2", s)
    s = _PHONE_RE.sub(lambda m: f"{(m.group(1) or '').strip()}(***) ***-{m.group(4)}", s)
    return s


def _mask_tin(s: str) -> str:
    digits = re.sub(r"\D", "", s)
    if len(digits) == 9:
        return f"XX-XXX{digits[-4:]}"
    return "XX-XXX" + (digits[-4:] if len(digits) >= 4 else "****")


def _mask_phone(s: str) -> str:
    digits = re.sub(r"\D", "", s)
    if len(digits) >= 10:
        return f"(***) ***-{digits[-4:]}"
    return "(***) ***-****"


def mask_dataframe(df: pd.DataFrame, extra_sensitive: Iterable[str] = ()) -> pd.DataFrame:
    if df is None or df.empty or not SETTINGS.pii_masking:
        return df
    cols = set(c.lower() for c in df.columns)
    sensitive = {c for c in df.columns if c.lower() in (SENSITIVE_COLUMNS | set(x.lower() for x in extra_sensitive))}
    out = df.copy()
    for c in sensitive:
        out[c] = out[c].map(lambda x: mask_value(x, c))  # noqa: B023
    return out
