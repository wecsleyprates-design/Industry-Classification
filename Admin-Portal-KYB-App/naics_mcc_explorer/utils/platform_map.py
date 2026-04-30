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
    # platformId = -1 means "dependent" — fact is computed from other facts by the Fact Engine.
    # NOT a legacy schema issue. Source: integration-service/lib/facts/sources.ts (sources.calculated).
    # Examples: mcc_code (from mcc_code_found??mcc_code_from_naics), mcc_description,
    #           naics_description, industry, primary_address_string.
    # These have no vendor, no confidence score, and no ruleApplied.
    "-1": {"name": "Calculated / Dependent",          "short": "P-1", "type": "calculated","color": "#64748b"},
    # platformId = 0 means "businessDetails" — self-reported onboarding data.
    # Hardcoded confidence:1 — this is the arbitration bug causing ghost assigner wins.
    "0":  {"name": "Applicant Entry (Ghost Assigner)", "short": "P0",  "type": "applicant", "color": "#ef4444"},
    "1":  {"name": "Plaid Banking",                   "short": "P1",  "type": "vendor",    "color": "#0284c7"},
    "4":  {"name": "Verdata",                         "short": "P4",  "type": "vendor",    "color": "#6366f1"},
    "16": {"name": "Middesk",                         "short": "P16", "type": "vendor",    "color": "#22c55e"},
    "17": {"name": "Equifax",                         "short": "P17", "type": "vendor",    "color": "#16a34a"},
    "18": {"name": "Plaid IDV",                       "short": "P18", "type": "vendor",    "color": "#0ea5e9"},
    "21": {"name": "OpenCorporates",                  "short": "P21", "type": "vendor",    "color": "#15803d"},
    "22": {"name": "SERP Scrape",                     "short": "P22", "type": "vendor",    "color": "#84cc16"},
    "23": {"name": "OpenCorporates (US)",             "short": "P23", "type": "vendor",    "color": "#a3a3a3"},
    "24": {"name": "ZoomInfo",                        "short": "P24", "type": "vendor",    "color": "#3b82f6"},
    "29": {"name": "Entity Matching",                 "short": "P29", "type": "internal",  "color": "#8b5cf6"},
    "31": {"name": "AI NAICS Enrichment",             "short": "P31", "type": "ai",        "color": "#a855f7"},
    "32": {"name": "Canada Open",                     "short": "P32", "type": "vendor",    "color": "#10b981"},
    "36": {"name": "AI Website Enrichment",           "short": "P36", "type": "ai",        "color": "#fb923c"},
    "39": {"name": "SERP Google Profile",             "short": "P39", "type": "vendor",    "color": "#9333ea"},
    "40": {"name": "Plaid / KYX",                     "short": "P40", "type": "vendor",    "color": "#06b6d4"},
}

PLATFORM_TYPE_COLORS = {
    "vendor":     "#22c55e",
    "ai":         "#a855f7",
    "applicant":  "#ef4444",
    "calculated": "#64748b",
    "internal":   "#8b5cf6",
    "unknown":    "#475569",
}

FACT_NAMES = [
    "naics_code",
    "mcc_code",
    "mcc_code_found",
    "mcc_code_from_naics",
    "naics_description",
    "mcc_description",
    "industry",
]

# Core classification facts — the ones with real vendor arbitration
CLASSIFICATION_FACTS = ["naics_code", "mcc_code_found"]

# Dependent facts — always platformId=-1, computed from other facts
DEPENDENT_FACT_NAMES = [
    "mcc_code", "mcc_code_from_naics", "mcc_description",
    "naics_description", "industry",
]

CATCH_ALL_NAICS = {"561499"}
CATCH_ALL_MCC   = {"7399"}
KNOWN_INVALID_MCC = {"5614"}  # AI prompt bug fallback

PLATFORM_LEGEND = """
| ID | Platform | Type | Meaning |
|---|---|---|---|
| **-1** | Calculated / Dependent | ⚫ Computed | Fact derived from other facts by the Fact Engine. **Not a vendor.** No confidence, no ruleApplied. Examples: `mcc_code`, `mcc_code_from_naics`, `mcc_description`, `naics_description`, `industry`. Source: `sources.calculated` in `integration-service/lib/facts/sources.ts`. |
| **0** | Applicant Entry | 🔴 Ghost Assigner | Self-reported onboarding data. **Hardcoded `confidence:1`** beats all real vendors in arbitration. Root cause of the NAICS quality bug. Source: `businessDetails` in `sources.ts`. |
| **16** | Middesk | 🟢 Vendor | Business registry + SOS verification |
| **17** | Equifax | 🟢 Vendor | Credit bureau — NAICS from firmographic data |
| **21** | OpenCorporates | 🟢 Vendor | Business registration data |
| **22** | SERP Scrape | 🟢 Vendor | Google Search / web scraping of business website |
| **23** | OpenCorporates US | 🟢 Vendor | US-specific OpenCorporates integration |
| **24** | ZoomInfo | 🟢 Vendor | Firmographics — primary NAICS/MCC source. Confidence ~0.8-1.0. |
| **31** | AI NAICS Enrichment | 🟣 AI | GPT-based NAICS classifier. Fallback when vendors fail. Confidence 0.15. Assigns `561499` as last resort. |
| **36** | AI Website Enrichment | 🟣 AI | AI analysis of business website content |
| **unknown** | Unknown (null) | ⚫ Unknown | `platformId` field missing from JSON. May be old-schema record where source is in `source.name` string field. |
"""

# Facts that are always "dependent" (platformId=-1) — never won by a vendor
DEPENDENT_FACTS = {
    "mcc_code":              "Computed: mcc_code_found ?? mcc_code_from_naics",
    "mcc_code_from_naics":   "Computed: rel_naics_mcc lookup by naics_code value",
    "mcc_description":       "Computed: core_mcc_code lookup by mcc_code value",
    "naics_description":     "Computed: core_naics_code lookup by naics_code value",
    "industry":              "Computed: 2-digit NAICS sector from naics_code.substring(0,2)",
    "primary_address_string":"Computed: formatted string from primary_address",
    "mailing_address_strings":"Computed: formatted string from mailing_address",
    "business_addresses_submitted_strings": "Computed: formatted string from business_addresses_submitted",
}


def platform_label(pid: str | None) -> str:
    if pid is None or str(pid).strip() in ("", "None"):
        return "Unknown (null)"
    pid = str(pid).strip()
    if pid == "unknown":
        return "Unknown (null schema)"
    if pid in PLATFORM_MAP:
        return f"{PLATFORM_MAP[pid]['name']} ({PLATFORM_MAP[pid]['short']})"
    return f"Platform {pid}"


def platform_color(pid: str | None) -> str:
    if pid is None or str(pid).strip() in ("", "None", "unknown"):
        return PLATFORM_TYPE_COLORS["unknown"]
    pid = str(pid).strip()
    if pid in PLATFORM_MAP:
        return PLATFORM_MAP[pid]["color"]
    return PLATFORM_TYPE_COLORS["unknown"]


def pid_type(pid: str | None) -> str:
    if pid is None:
        return "unknown"
    pid = str(pid).strip()
    if pid == "unknown":
        return "unknown"
    return PLATFORM_MAP.get(pid, {}).get("type", "unknown")
