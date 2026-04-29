"""NAICS and MCC format/lookup validators."""

import re
from utils.platform_map import CATCH_ALL_NAICS, CATCH_ALL_MCC, KNOWN_INVALID_MCC


def validate_naics(value, naics_lookup: set[str]) -> tuple[str, str]:
    """
    Returns (status, reason) where status is one of:
      'valid'      — 6-digit, numeric, in lookup table
      'catch_all'  — valid format but known catch-all (561499)
      'not_in_lookup' — valid format, not in lookup table
      'invalid_format' — wrong length, non-numeric, etc.
      'null'       — None or empty
    """
    if value is None or str(value).strip() in ("", "None", "null"):
        return "null", "Winning value is null"

    val = str(value).strip()

    if not re.fullmatch(r"\d{6}", val):
        if re.fullmatch(r"\d{1,5}", val):
            return "invalid_format", f"Too short ({len(val)} digits, need 6)"
        if re.fullmatch(r"\d{7,}", val):
            return "invalid_format", f"Too long ({len(val)} digits)"
        if re.search(r"\D", val):
            return "invalid_format", f"Non-numeric characters: '{val}'"
        return "invalid_format", f"Invalid format: '{val}'"

    if val in CATCH_ALL_NAICS:
        return "catch_all", f"{val} — known catch-all code"

    if naics_lookup and val not in naics_lookup:
        return "not_in_lookup", f"{val} not in rds_cases_public.core_naics_code"

    return "valid", "Valid 6-digit NAICS code in lookup table"


def validate_mcc(value, mcc_lookup: set[str]) -> tuple[str, str]:
    """
    Returns (status, reason) where status is one of:
      'valid'      — in lookup table
      'catch_all'  — 7399 (Business Services NEC)
      'known_invalid' — known bad value (e.g. 5614 from AI bug)
      'not_in_lookup' — not in lookup table
      'null'       — None or empty
    """
    if value is None or str(value).strip() in ("", "None", "null"):
        return "null", "Winning value is null"

    val = str(value).strip()

    if val in KNOWN_INVALID_MCC:
        return "known_invalid", f"{val} — known invalid (AI prompt bug fallback)"

    if val in CATCH_ALL_MCC:
        return "catch_all", f"{val} — catch-all MCC (Business Services NEC)"

    if mcc_lookup and val not in mcc_lookup:
        return "not_in_lookup", f"{val} not in rds_cases_public.core_mcc_code"

    return "valid", "Valid MCC code in lookup table"


STATUS_COLORS = {
    "valid":          "#22c55e",
    "catch_all":      "#f59e0b",
    "not_in_lookup":  "#f97316",
    "invalid_format": "#ef4444",
    "known_invalid":  "#ef4444",
    "null":           "#64748b",
}

STATUS_ICONS = {
    "valid":          "✅",
    "catch_all":      "⚠️",
    "not_in_lookup":  "🟠",
    "invalid_format": "❌",
    "known_invalid":  "❌",
    "null":           "⬜",
}
