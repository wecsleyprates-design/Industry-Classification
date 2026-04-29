"""Platform ID → metadata mapping.

Source: integration-service/lib/facts/sources.ts
platformId values are integers stored as strings in the facts JSON.
"""
from __future__ import annotations

PLATFORM_MAP: dict[str, dict] = {
    "0":  {"name": "Applicant Entry",       "short": "P0",  "type": "applicant",  "color": "#ef4444"},
    "16": {"name": "Middesk",               "short": "P16", "type": "vendor",     "color": "#22c55e"},
    "17": {"name": "Equifax",               "short": "P17", "type": "vendor",     "color": "#16a34a"},
    "21": {"name": "OpenCorporates",        "short": "P21", "type": "vendor",     "color": "#15803d"},
    "22": {"name": "SERP Scrape",           "short": "P22", "type": "vendor",     "color": "#84cc16"},
    "23": {"name": "Minor Integration",     "short": "P23", "type": "vendor",     "color": "#a3a3a3"},
    "24": {"name": "ZoomInfo",              "short": "P24", "type": "vendor",     "color": "#3b82f6"},
    "31": {"name": "AI NAICS Enrichment",   "short": "P31", "type": "ai",         "color": "#8b5cf6"},
    "32": {"name": "AI MCC Enrichment",     "short": "P32", "type": "ai",         "color": "#a78bfa"},
}

PLATFORM_TYPE_COLORS = {
    "vendor":    "#22c55e",
    "ai":        "#8b5cf6",
    "applicant": "#ef4444",
    "unknown":   "#64748b",
}

FACT_NAMES = [
    "naics_code",
    "mcc_code",
    "mcc_code_found",
    "mcc_code_from_naics",
]

CATCH_ALL_NAICS = {"561499"}
CATCH_ALL_MCC   = {"7399"}
KNOWN_INVALID_MCC = {"5614"}  # AI prompt bug fallback


def platform_label(pid: str | None) -> str:
    if pid is None or str(pid).strip() == "":
        return "Unknown (null)"
    pid = str(pid).strip()
    if pid in PLATFORM_MAP:
        return f"{PLATFORM_MAP[pid]['name']} ({PLATFORM_MAP[pid]['short']})"
    return f"Platform {pid}"


def platform_color(pid: str | None) -> str:
    if pid is None:
        return PLATFORM_TYPE_COLORS["unknown"]
    pid = str(pid).strip()
    if pid in PLATFORM_MAP:
        return PLATFORM_MAP[pid]["color"]
    return PLATFORM_TYPE_COLORS["unknown"]


def pid_type(pid: str | None) -> str:
    if pid is None:
        return "unknown"
    pid = str(pid).strip()
    return PLATFORM_MAP.get(pid, {}).get("type", "unknown")
