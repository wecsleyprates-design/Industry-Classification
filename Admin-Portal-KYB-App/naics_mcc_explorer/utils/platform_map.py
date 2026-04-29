"""Platform ID → metadata mapping.

Source: integration-service/lib/facts/sources.ts
platformId values are integers stored as strings in the facts JSON.

IMPORTANT — What is Platform -1?
  platformId = -1 means the fact record uses the OLD JSON schema where the
  source is stored as a plain string (source.name = "AINaicsEnrichment") rather
  than a numeric object (source.platformId = 31). Because COALESCE(
  JSON_EXTRACT_PATH_TEXT(...,'source','platformId'), ...) returns NULL for these
  records, the fallback literal 'unknown' is returned by some queries. When the
  raw SQL casts this to integer it becomes -1.
  In this app we intercept '-1' and display it as "Legacy Schema (old format)".

  Platform -1 / "unknown" in charts = fact was written by the old integration
  pipeline before platformId was added to the schema. The actual source is
  stored in source.name as a human-readable string (e.g. "AINaicsEnrichment",
  "zoominfo"). These records predate the schema migration.
"""
from __future__ import annotations

PLATFORM_MAP: dict[str, dict] = {
    "-1": {"name": "Legacy Schema (pre-platformId)",  "short": "P?",  "type": "legacy",   "color": "#94a3b8"},
    "0":  {"name": "Applicant Entry",                 "short": "P0",  "type": "applicant", "color": "#ef4444"},
    "16": {"name": "Middesk",                         "short": "P16", "type": "vendor",    "color": "#22c55e"},
    "17": {"name": "Equifax",                         "short": "P17", "type": "vendor",    "color": "#16a34a"},
    "21": {"name": "OpenCorporates",                  "short": "P21", "type": "vendor",    "color": "#15803d"},
    "22": {"name": "SERP Scrape",                     "short": "P22", "type": "vendor",    "color": "#84cc16"},
    "23": {"name": "Minor Integration",               "short": "P23", "type": "vendor",    "color": "#a3a3a3"},
    "24": {"name": "ZoomInfo",                        "short": "P24", "type": "vendor",    "color": "#3b82f6"},
    "31": {"name": "AI NAICS Enrichment",             "short": "P31", "type": "ai",        "color": "#8b5cf6"},
    "32": {"name": "AI MCC Enrichment",               "short": "P32", "type": "ai",        "color": "#a78bfa"},
}

PLATFORM_TYPE_COLORS = {
    "vendor":    "#22c55e",
    "ai":        "#8b5cf6",
    "applicant": "#ef4444",
    "legacy":    "#94a3b8",
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

PLATFORM_LEGEND = """
| ID | Platform | Type | Meaning |
|---|---|---|---|
| **-1** | Legacy Schema | Legacy | Old JSON format — `source.name` string, no `platformId` field. Source name visible in raw JSON. |
| **0** | Applicant Entry | ⚠️ Ghost Assigner | Self-reported onboarding data. Hardcoded `confidence:1` beats all real vendors. |
| **16** | Middesk | Vendor | Business registry + SOS data |
| **17** | Equifax | Vendor | Credit bureau — NAICS from firmographic data |
| **21** | OpenCorporates | Vendor | Business registration data |
| **22** | SERP Scrape | Vendor | Web scraping from business website |
| **23** | Minor Integration | Vendor | Small/auxiliary integration |
| **24** | ZoomInfo | Vendor | Firmographics — primary NAICS/MCC source |
| **31** | AI NAICS Enrichment | AI | GPT-based NAICS classifier — fallback when vendors fail |
| **32** | AI MCC Enrichment | AI | GPT-based MCC classifier |
| **unknown** | Unknown (null) | Unknown | platformId field is missing entirely from JSON |
"""


def platform_label(pid: str | None) -> str:
    if pid is None or str(pid).strip() in ("", "None"):
        return "Unknown (null)"
    pid = str(pid).strip()
    # Treat both '-1' and 'unknown' as legacy schema
    if pid in ("-1", "unknown"):
        return "Legacy Schema (P?)"
    if pid in PLATFORM_MAP:
        return f"{PLATFORM_MAP[pid]['name']} ({PLATFORM_MAP[pid]['short']})"
    return f"Platform {pid}"


def platform_color(pid: str | None) -> str:
    if pid is None or str(pid).strip() in ("", "None", "unknown"):
        return PLATFORM_TYPE_COLORS["legacy"]
    pid = str(pid).strip()
    if pid == "-1":
        return PLATFORM_TYPE_COLORS["legacy"]
    if pid in PLATFORM_MAP:
        return PLATFORM_MAP[pid]["color"]
    return PLATFORM_TYPE_COLORS["unknown"]


def pid_type(pid: str | None) -> str:
    if pid is None:
        return "unknown"
    pid = str(pid).strip()
    if pid in ("-1", "unknown"):
        return "legacy"
    return PLATFORM_MAP.get(pid, {}).get("type", "unknown")
