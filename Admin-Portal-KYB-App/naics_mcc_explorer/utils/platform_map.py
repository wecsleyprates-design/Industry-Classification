"""Platform ID → metadata mapping.

Source of truth: integration-service-main/src/constants/integrations.constant.ts (INTEGRATION_ID enum)
platformId values are integers stored as strings in the facts JSON.

Key facts about platformId values:
  0  = businessDetails (Applicant Entry) — confidence:1 hardcoded in sources.ts:148
       THE GHOST ASSIGNER. Weight=10. Runs before all vendors. Causes arbitration bug.
  -1 = dependent / calculated — fact computed from other facts by the Fact Engine.
       sources.ts does NOT hardcode this — it is assigned by sources.calculated at runtime.
       NAICS/MCC relevant: mcc_code, mcc_code_from_naics, mcc_description, naics_description, industry.
  null = No source stored — platformId=null means the fact has no source metadata.
         Different from -1. Check ruleApplied to understand origin (e.g. combineFacts).

Bug location: integration-service-main/lib/facts/sources.ts:148
  businessDetails: { confidence: 1, weight: 10, platformId: 0, ... }
  Fix: confidence: 1 → confidence: 0.1

Arbitration rule: integration-service-main/lib/facts/rules.ts:36 (factWithHighestConfidence)
  WEIGHT_THRESHOLD = 0.05 — weight only used as tiebreaker when confidences within 0.05.
  P0 confidence=1.0 vs ZoomInfo ~0.8 → gap=0.2 → weight NEVER applies.

AI fallback codes (aiNaicsEnrichment.ts:63,108):
  NAICS_OF_LAST_RESORT = "561499"  (561499 = All Other Business Support Services)
  MCC last resort = "5614"  (5614 = NOT a valid MCC — AI prompt bug)
"""
from __future__ import annotations

# Full platform map from integrations.constant.ts INTEGRATION_ID enum
PLATFORM_MAP: dict[str, dict] = {
    # Calculated/dependent — sources.calculated, NOT a vendor
    "-1": {"name": "Calculated / Dependent",       "short": "P-1", "type": "calculated","color": "#64748b"},
    # Applicant Entry — businessDetails source — confidence:1 hardcoded (THE BUG)
    "0":  {"name": "Applicant Entry (Ghost Assigner)","short":"P0", "type": "applicant", "color": "#ef4444"},
    # External vendors (from INTEGRATION_ID enum)
    "1":  {"name": "Plaid Banking",                "short": "P1",  "type": "vendor",    "color": "#0284c7"},
    "4":  {"name": "Verdata",                      "short": "P4",  "type": "vendor",    "color": "#6366f1"},
    "15": {"name": "Tax Status",                   "short": "P15", "type": "vendor",    "color": "#a3a3a3"},
    "16": {"name": "Middesk",                      "short": "P16", "type": "vendor",    "color": "#f59e0b"},
    "17": {"name": "Equifax",                      "short": "P17", "type": "vendor",    "color": "#22c55e"},
    "18": {"name": "Plaid IDV",                    "short": "P18", "type": "vendor",    "color": "#0ea5e9"},
    "19": {"name": "Google Places Reviews",         "short": "P19", "type": "vendor",    "color": "#a3a3a3"},
    "20": {"name": "Google Business Reviews",       "short": "P20", "type": "vendor",    "color": "#a3a3a3"},
    "21": {"name": "Manual Upload",                "short": "P21", "type": "vendor",    "color": "#64748b"},
    "22": {"name": "SERP Scrape",                  "short": "P22", "type": "vendor",    "color": "#a855f7"},
    "23": {"name": "OpenCorporates",               "short": "P23", "type": "vendor",    "color": "#3b82f6"},
    "24": {"name": "ZoomInfo",                     "short": "P24", "type": "vendor",    "color": "#8b5cf6"},
    "27": {"name": "Adverse Media",                "short": "P27", "type": "vendor",    "color": "#a3a3a3"},
    "28": {"name": "NPI",                          "short": "P28", "type": "vendor",    "color": "#a3a3a3"},
    "29": {"name": "Entity Matching",              "short": "P29", "type": "internal",  "color": "#6366f1"},
    "30": {"name": "Worth Website Scanning",       "short": "P30", "type": "internal",  "color": "#6366f1"},
    # AI enrichment sources
    "31": {"name": "AI NAICS Enrichment (GPT)",    "short": "P31", "type": "ai",        "color": "#f97316"},
    "32": {"name": "Canada Open",                  "short": "P32", "type": "vendor",    "color": "#10b981"},
    "36": {"name": "AI Website Enrichment",        "short": "P36", "type": "ai",        "color": "#fb923c"},
    "38": {"name": "Trulioo",                      "short": "P38", "type": "vendor",    "color": "#ec4899"},
    "39": {"name": "SERP Google Profile",          "short": "P39", "type": "vendor",    "color": "#9333ea"},
    "40": {"name": "Plaid / KYX",                  "short": "P40", "type": "vendor",    "color": "#06b6d4"},
    "42": {"name": "Trulioo PSC",                  "short": "P42", "type": "vendor",    "color": "#f43f5e"},
    "43": {"name": "Baselayer",                    "short": "P43", "type": "vendor",    "color": "#a3a3a3"},
    # Worth internal
    "99": {"name": "DirectSOS (internal)",         "short": "P99", "type": "internal",  "color": "#06b6d4"},
}

PLATFORM_TYPE_COLORS = {
    "vendor":     "#22c55e",
    "ai":         "#f97316",
    "applicant":  "#ef4444",
    "calculated": "#64748b",
    "internal":   "#6366f1",
    "unknown":    "#475569",
}

# ── Core classification facts ──────────────────────────────────────────────────
# Facts that participate in real vendor arbitration (can have any platformId winner)
CLASSIFICATION_FACTS = ["naics_code", "mcc_code_found"]

# Facts that are ALWAYS calculated/dependent (platformId=-1, no vendor wins)
# Source: businessDetails/index.ts — these use dependencies[] not source vendors
DEPENDENT_FACT_NAMES = [
    "mcc_code",              # from mcc_code_found ?? mcc_code_from_naics
    "mcc_code_from_naics",   # rel_naics_mcc lookup by naics_code
    "mcc_description",       # core_mcc_code lookup by mcc_code (column: label)
    "naics_description",     # core_naics_code lookup by naics_code (column: label)
    "industry",              # 2-digit sector from naics_code.substring(0,2)
]

# All fact names relevant to NAICS/MCC/industry classification
FACT_NAMES = [
    "naics_code",
    "naics_description",
    "mcc_code",
    "mcc_code_found",
    "mcc_code_from_naics",
    "mcc_description",
    "industry",
    "classification_codes",
]

# Catch-all codes (valid format but meaningless classification)
CATCH_ALL_NAICS = {"561499"}   # "All Other Business Support Services" — AI last resort
CATCH_ALL_MCC   = {"7399"}     # "Business Services NEC" — MCC equivalent
KNOWN_INVALID_MCC = {"5614"}   # AI prompt bug — not a real MCC code

# Confirmed table structure (from warehouse-service SQL + api.ts return types):
# rds_cases_public.core_naics_code: id (PK), code (VARCHAR), label (VARCHAR)
#   NOTE: column is 'label' NOT 'title' — confirmed in review_metrics.sql:79 (nid.label)
# rds_cases_public.core_mcc_code:   id (PK), code (VARCHAR), label (VARCHAR)
#   NOTE: column is 'label' NOT 'title' — confirmed in review_metrics.sql:83 (mid.label)
# rds_cases_public.rel_naics_mcc:   naics_id (FK→core_naics_code.id), mcc_id (FK→core_mcc_code.id)
# rds_cases_public.core_business_industries: id (PK), name (VARCHAR) — 2-digit sector names
# rds_cases_public.data_businesses: id (PK), naics_id (FK), mcc_id (FK), industry (FK)
#   This is the STATIC business record. naics_id/mcc_id are the admin-set values from the UI.
#   The dynamic/live values come from rds_warehouse_public.facts.
# rds_auth_public.data_customers: id (UUID PK), name (VARCHAR) — customer name lookup
# rds_cases_public.rel_business_customer_monitoring: business_id, customer_id, created_at
#   created_at = true onboarding date. NO updated_at column.

PLATFORM_LEGEND = """
| ID | Platform | Type | Source |
|---|---|---|---|
| **-1** | Calculated / Dependent | ⚫ Computed | Fact derived from other facts by Fact Engine. No vendor, no confidence, no ruleApplied. NAICS/MCC: `mcc_code`, `mcc_code_from_naics`, `mcc_description`, `naics_description`, `industry`. |
| **0** | Applicant Entry | 🔴 Ghost Assigner | `businessDetails` in `sources.ts:148`. Hardcoded `confidence:1`. Runs first. Beats all vendors. THE BUG. |
| **16** | Middesk | 🟡 Vendor | US SOS live registry. Weight=2.0. |
| **17** | Equifax | 🟢 Vendor | Firmographic + public records. Weight=0.7. NAICS from `primnaicscode`. |
| **22** | SERP Scrape | 🟣 Vendor | Google Search scraping. Weight=0.3. NAICS from `businessLegitimacyClassification.naics_code`. |
| **23** | OpenCorporates | 🔵 Vendor | Global company registry. NAICS from `firmographic.industry_code_uids` (us_naics prefix). |
| **24** | ZoomInfo | 🔵 Vendor | Firmographics. Weight=0.8. NAICS from `firmographic.zi_c_naics6`. Primary NAICS source. |
| **31** | AI NAICS Enrichment | 🟠 AI | GPT-4o-mini. Weight=0.1. Confidence=0.15. Falls back to NAICS `561499` + MCC `5614` when no evidence. |
| **36** | AI Website Enrichment | 🟠 AI | AI analysis of website content. Weight=0.1. |
| **38** | Trulioo | 🔴 Vendor | KYB/PSC compliance screening. NAICS from `extractStandardizedIndustriesFromTruliooResponse`. |
| **null** | No source | ⚫ Unknown | `platformId=null` in DB. Fact has no source metadata. Use `ruleApplied` to understand origin (e.g. `combineFacts`). |
"""

# Detailed NAICS/MCC derivation chain (from businessDetails/index.ts)
NAICS_MCC_DERIVATION = """
NAICS/MCC Derivation Chain (integration-service/lib/facts/businessDetails/index.ts):

naics_code sources (in priority order via factWithHighestConfidence):
  P17 Equifax       → path: "primnaicscode"
  P24 ZoomInfo      → path: "firmographic.zi_c_naics6"
  P23 OpenCorporates → fn: industry_code_uids with us_naics prefix, length=6
  P22 SERP          → weight:0.3, path: "businessLegitimacyClassification.naics_code"
  P38 Trulioo       → fn: extractStandardizedIndustriesFromTruliooResponse[].naicsCode
  P0  businessDetails → path: "industry" (onboarding form — GHOST ASSIGNER)
  P31 AI NAICS      → weight:0.1, path: "response.naics_code" (LAST RESORT)

mcc_code_found sources:
  P31 AI NAICS Enrichment → path: "response.mcc_code" (direct AI MCC output)

mcc_code_from_naics (calculated, P-1):
  dependencies: ["naics_code"]
  fn: internalGetNaicsCode(naics_code.value) → naicsInfo[].mcc_code
  DB query: GET v1/internal/core/naics?code={naics_code} → rel_naics_mcc lookup

mcc_code (calculated, P-1):
  dependencies: ["mcc_code_found", "mcc_code_from_naics"]
  fn: mcc_code_found.value ?? mcc_code_from_naics.value

mcc_description (calculated, P-1):
  dependencies: ["mcc_code"]
  fn: internalGetMccCode(mcc_code.value) → mccInfo[].mcc_label
      fallback: AINaicsEnrichment.rawResponse.mcc_description

naics_description (calculated, P-1):
  dependencies: ["naics_code"]
  fn: internalGetNaicsCode(naics_code.value) → naicsInfo[].naics_label

industry (calculated, P-1):
  dependencies: ["naics_code"]
  fn: naics_code.value.substring(0,2) → core_business_industries lookup
"""

# ruleApplied values from facts/rules.ts
RULE_APPLIED = {
    "factWithHighestConfidence": "Picks winner by highest confidence. Tiebreaker: weight if within 0.05. WEIGHT_THRESHOLD=0.05 in rules.ts:9.",
    "combineFacts":              "Combines all fact values from all platforms into an array. No winner selection.",
    None:                        "No rule applied — fact is calculated/dependent (P-1) or has no source.",
}


def platform_label(pid: str | None) -> str:
    if pid is None or str(pid).strip() in ("", "None"):
        return "Unknown (null platformId)"
    pid = str(pid).strip()
    if pid == "unknown":
        return "Unknown (null platformId)"
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
    if pid in ("unknown", ""):
        return "unknown"
    return PLATFORM_MAP.get(pid, {}).get("type", "unknown")
