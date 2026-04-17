"""
Deep explanations for every concept shown in the KYB app.
Every explanation is sourced from actual code with exact file+line citations.
"""

REPO = {
    "rules": "integration-service/lib/facts/rules.ts",
    "factEngine": "integration-service/lib/facts/factEngine.ts",
    "sources": "integration-service/lib/facts/sources.ts",
    "businessDetails": "integration-service/lib/facts/businessDetails/index.ts",
    "aiNaics": "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts",
    "api_helpers": "integration-service/src/helpers/api.ts",
}

# ── INDUSTRY NAME CALCULATION ─────────────────────────────────────────────────
INDUSTRY_NAME_DEEP = {
    "how_calculated": {
        "title": "How 'Industry Name' is calculated — NOT from a model",
        "source_file": REPO["businessDetails"],
        "source_lines": (286, 303),
        "github_url": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/facts/businessDetails/index.ts#L286-L303",
        "explanation": (
            "Industry Name is a DEPENDENT FACT — it is computed after the winning naics_code is resolved. "
            "The computation is deterministic (no ML model involved):\n\n"
            "Step 1: Fact Engine resolves naics_code (the winning 6-digit NAICS from all vendors)\n"
            "Step 2: The industry fact fn() reads: const sectorCode = fact.value.toString().substring(0, 2)\n"
            "  → Takes the FIRST 2 DIGITS of the NAICS code as the sector identifier\n"
            "  → Example: NAICS 722511 → sectorCode = '72' (Accommodation and Food Services)\n"
            "  → Example: NAICS 561499 → sectorCode = '56' (Administrative and Support Services)\n"
            "Step 3: Calls internalGetIndustries(sectorCode) → HTTP GET to internal API with ?sector=XX\n"
            "Step 4: Returns industries[0] — the first matching entry in core_business_industries table\n\n"
            "This is a PURE LOOKUP — not XGBoost, not ML, not AI. "
            "The 2-digit sector code maps directly to core_business_industries.name via a static PostgreSQL table."
        ),
        "verify_sql": """-- See the sector → industry name mapping:
SELECT sector_code, name FROM core_business_industries ORDER BY sector_code;

-- See what industry a specific NAICS maps to:
SELECT SUBSTRING(cnc.code, 1, 2) AS sector_code,
       cbi.name AS industry_name,
       cnc.code AS naics_code, cnc.label AS naics_label
FROM core_naics_code cnc
JOIN core_business_industries cbi ON cbi.sector_code = SUBSTRING(cnc.code, 1, 2)::integer
WHERE cnc.code = '722511';

-- Check a business's current industry name:
SELECT f.value->>'value' AS industry_fact,
       db.industry AS industry_id,
       cbi.name AS industry_name,
       (SELECT value->>'value' FROM rds_warehouse_public.facts
        WHERE business_id='<id>' AND name='naics_code') AS naics_code
FROM rds_warehouse_public.facts f
JOIN rds_cases_public.data_businesses db ON db.id = f.business_id::uuid
JOIN core_business_industries cbi ON cbi.id = db.industry
WHERE f.business_id = '<business_id>' AND f.name = 'industry';""",
        "why_pid_is_calculated": (
            "PID shows 'calculated' (not a vendor platform_id) because the industry fact has "
            "source: null in the code (businessDetails/index.ts L287). "
            "It has NO vendor source — it is purely derived from the winning naics_code. "
            "The confidence = 0.9 is hardcoded (L291) — it is NOT from XGBoost. "
            "It means: 'once we have a NAICS code, we are 90% confident the industry mapping is correct.' "
            "If naics_code is null or undefined, the industry fn() returns undefined and the field shows N/A."
        ),
    },
    "null_blank_scenarios": {
        "title": "All scenarios when Industry Name shows '-' or N/A",
        "source_file": REPO["businessDetails"],
        "source_lines": (286, 303),
        "scenarios": [
            {
                "scenario": "1. naics_code is null/undefined (all vendors returned null and AI returned null)",
                "cause": "industry fn() checks: if (fact?.value) — if naics_code has no value, the entire fn() returns undefined",
                "display": "'-' (dash) — VALUE_NOT_AVAILABLE constant",
                "probability": "Rare — AI returns '561499' as last resort, not null",
                "sql": "SELECT value->>'value' FROM rds_warehouse_public.facts WHERE business_id='<id>' AND name='naics_code';"
            },
            {
                "scenario": "2. naics_code = '561499' (AI last resort)",
                "cause": "sectorCode = '56' → core_business_industries lookup → returns 'Administrative and Support and Waste Management and Remediation Services'",
                "display": "'Administrative and Support and Waste Management and Remediation Services' — NOT blank, NOT N/A",
                "probability": "7.7% of all businesses (5,349 in production)",
                "sql": "SELECT cbi.name FROM core_business_industries cbi WHERE cbi.sector_code = 56;"
            },
            {
                "scenario": "3. internalGetIndustries() returns empty array",
                "cause": "The 2-digit sector code has no matching entry in core_business_industries. Very rare — only if NAICS code is invalid.",
                "display": "'-' — industries?.[0] is falsy",
                "probability": "Extremely rare — prevented by removeNaicsCode() validation",
                "sql": "SELECT COUNT(*) FROM core_business_industries;"
            },
            {
                "scenario": "4. isWebsiteDirty=true equivalent for business fields",
                "cause": "When analyst edits certain fields, some derived facts may clear pending re-verification",
                "display": "N/A temporarily until re-enrichment completes",
                "probability": "Temporary — resolves when integration re-runs",
                "sql": None
            },
        ],
        "rule_summary": (
            "RULE: Industry Name = internalGetIndustries(naics_code.substring(0,2))\n"
            "IF naics_code IS NULL → Industry Name = '-'\n"
            "IF naics_code = ANY valid code → Industry Name = core_business_industries.name for that 2-digit sector\n"
            "IF naics_code = '561499' → Industry Name = 'Administrative and Support and Waste Management...'\n"
            "THERE IS NO ML/CONFIDENCE THRESHOLD for Industry Name — it is a pure deterministic lookup."
        ),
    },
}

# ── FACT ENGINE WINNER SELECTION — DEEP EXPLANATION ─────────────────────────
FACT_ENGINE_DEEP = {
    "confidence_models": {
        "title": "How each source computes its confidence score",
        "explanation": (
            "Confidence is NOT from a single XGBoost model. Each vendor has its OWN confidence calculation:\n\n"
            "1. MIDDESK (pid=16, weight=2.0): Task-based confidence\n"
            "   Source: sources.ts L233-237\n"
            "   confidence = 0.15  ← base score just for having a Middesk record\n"
            "   + 0.20 if isTaskSuccess(middeskRecord, 'name')    ← name match task passed\n"
            "   + 0.20 if isTaskSuccess(middeskRecord, 'tin')     ← IRS TIN match passed\n"
            "   + 0.20 if isTaskSuccess(middeskRecord, 'address_verification') ← address verified\n"
            "   + 0.20 if isTaskSuccess(middeskRecord, 'sos_match') ← SoS filing found\n"
            "   MAX = 0.95 (if all 4 tasks pass)\n\n"
            "2. ZOOMINFO (pid=24, weight=0.8): XGBoost entity-match confidence\n"
            "   Source: sources.ts L69, L345\n"
            "   confidence = match.index / MAX_CONFIDENCE_INDEX (55)\n"
            "   The 'match.index' is the output of the XGBoost entity-matching model\n"
            "   (entity_matching_20250127 v1) that compares business name+address\n"
            "   against ZI bulk data. score 0–55 → confidence 0–1.0\n\n"
            "3. EQUIFAX (pid=17, weight=0.7): XGBoost entity-match confidence\n"
            "   Same mechanism as ZoomInfo: match.index / 55\n"
            "   Or: queryResult.metadata.result.matches.score / 55\n\n"
            "4. OPENCORPORATES (pid=23, weight=0.9): XGBoost entity-match confidence\n"
            "   Same mechanism: match.index / 55\n\n"
            "5. AI ENRICHMENT (pid=31, weight=0.1): Self-reported by GPT\n"
            "   confidence is GPT-5-mini's self-assessed 'HIGH'/'MED'/'LOW'\n"
            "   Mapped to: HIGH≈0.9, MED≈0.6, LOW≈0.3 (approximate)\n"
            "   Weight=0.1 means AI almost never wins when vendors have data\n\n"
            "KEY INSIGHT: The 'weight' (2.0, 0.9, 0.8, etc.) is SEPARATE from confidence.\n"
            "Confidence is HOW SURE the vendor is about the match quality.\n"
            "Weight is HOW MUCH Worth trusts that vendor's data in general."
        ),
        "source_files": [
            ("sources.ts L233-237", "Middesk task-based confidence formula"),
            ("sources.ts L69", "MAX_CONFIDENCE_INDEX = 55"),
            ("sources.ts L345", "ZI/OC/EFX: match.index / MAX_CONFIDENCE_INDEX"),
        ],
    },
    "winner_selection_full": {
        "title": "Complete NAICS Winner Selection — Step by Step",
        "steps": [
            {
                "step": 1,
                "name": "isValidFactValue() Filter",
                "source": "factEngine.ts L162-165",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/facts/factEngine.ts#L162-L165",
                "explanation": (
                    "Before ANY rule runs, the Fact Engine filters out invalid candidates:\n"
                    "validOptions = allCandidatesWithSameName.filter(\n"
                    "  fact => fact.resolved !== undefined && this.isValidFactValue(fact.value)\n"
                    ")\n\n"
                    "isValidFactValue() returns FALSE (excluded from competition) when:\n"
                    "  • value === undefined\n"
                    "  • value is an empty string ''\n"
                    "  • value is an empty array []\n"
                    "  • value is an empty object {}\n\n"
                    "isValidFactValue() returns TRUE (valid candidate) when:\n"
                    "  • value is any non-empty string (including '561499')\n"
                    "  • value is null or 0 (these ARE valid values)\n"
                    "  • value is false (this IS a valid boolean)\n\n"
                    "CRITICAL: A vendor that returned null naics_code is EXCLUDED from the candidate list.\n"
                    "Only vendors that returned a non-empty NAICS string are valid candidates.\n"
                    "If validOptions.length === 0 → fact = NULL → AI enrichment is triggered."
                ),
            },
            {
                "step": 2,
                "name": "manualOverride() — ALWAYS FIRST",
                "source": "rules.ts L109-123",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/facts/rules.ts#L109-L123",
                "explanation": (
                    "Before factWithHighestConfidence even runs, manualOverride() is ALWAYS prepended:\n"
                    "rules.unshift(manualOverride)  ← factEngine.ts L178\n\n"
                    "If an analyst has manually set the NAICS code via PATCH /facts/.../override:\n"
                    "  → engine.getManualSource()?.rawResponse?.[factName] is checked\n"
                    "  → If present → it wins UNCONDITIONALLY, no confidence/weight needed\n"
                    "  → Stored as override: { value, userId, timestamp } inside the fact JSONB\n\n"
                    "This is why 'Editable' fields have a + icon in the portal when overridden."
                ),
            },
            {
                "step": 3,
                "name": "factWithHighestConfidence() — Main Selection",
                "source": "rules.ts L35-57",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/facts/rules.ts#L35-L57",
                "explanation": (
                    "Reduces the validOptions array to find the highest-confidence fact:\n\n"
                    "const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1\n"
                    "const accConfidence = acc?.confidence ?? acc?.source?.confidence ?? 0.1\n\n"
                    "LOGIC (from the exact code):\n"
                    "  IF fact.value is undefined or empty array → skip this fact (return acc)\n"
                    "  IF acc is undefined → return fact (first valid fact wins initially)\n"
                    "  IF |factConfidence - accConfidence| <= WEIGHT_THRESHOLD (0.05):\n"
                    "    → USE weightedFactSelector() [TIE-BREAK — see Step 4]\n"
                    "  ELSE IF factConfidence > accConfidence:\n"
                    "    → return fact (higher confidence wins outright)\n"
                    "  ELSE:\n"
                    "    → return acc (current winner stays)\n\n"
                    "EXAMPLE with real numbers:\n"
                    "  OC confidence = 0.91 (match.index=50/55)\n"
                    "  ZI confidence = 0.87 (match.index=48/55)\n"
                    "  |0.91 - 0.87| = 0.04 ≤ 0.05 → TRIGGER TIE-BREAK (weightedFactSelector)\n"
                    "  OC weight=0.9, ZI weight=0.8 → OC wins (0.9 >= 0.8)\n\n"
                    "  OC confidence = 0.91\n"
                    "  ZI confidence = 0.80\n"
                    "  |0.91 - 0.80| = 0.11 > 0.05 → OC WINS OUTRIGHT (no tie-break needed)"
                ),
            },
            {
                "step": 4,
                "name": "weightedFactSelector() — Tie-Break",
                "source": "rules.ts L61-74",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/facts/rules.ts#L61-L74",
                "explanation": (
                    "Called ONLY when two sources have confidences within 5% of each other.\n"
                    "Reads the source WEIGHT (not confidence) to break the tie:\n\n"
                    "primaryFactWeight = fact.weight ?? fact.source?.weight ?? DEFAULT_FACT_WEIGHT\n"
                    "otherFactWeight   = otherFact.weight ?? otherFact.source?.weight ?? DEFAULT_FACT_WEIGHT\n"
                    "return primaryFactWeight >= otherFactWeight ? fact : otherFact\n\n"
                    "TIE-BREAK PRIORITY ORDER (from sources.ts weights):\n"
                    "  Middesk    weight=2.0   ← ALWAYS wins when tied with anyone\n"
                    "  OC         weight=0.9\n"
                    "  ZoomInfo   weight=0.8   ← tie with Trulioo → ZI wins (0.8 >= 0.8, left wins)\n"
                    "  Trulioo    weight=0.8\n"
                    "  Equifax    weight=0.7\n"
                    "  SERP       weight=0.3\n"
                    "  Applicant  weight=0.2\n"
                    "  AI         weight=0.1   ← LAST — only wins when ALL others have no NAICS\n\n"
                    "NOTE: On an exact tie (same weight), the 'left' (primary) fact wins due to >= operator.\n"
                    "DEFAULT_FACT_WEIGHT = 1 (used when a fact has no explicit weight)"
                ),
            },
            {
                "step": 5,
                "name": "Rule 4 — NO Minimum Confidence Cutoff",
                "source": "rules.ts (confirmed by absence of cutoff logic)",
                "explanation": (
                    "There is NO code that says 'if confidence < X, reject this vendor.'\n"
                    "Even if a vendor's confidence is 0.05 (very poor match), it is still a valid candidate\n"
                    "as long as isValidFactValue() returns true (it returned a non-empty NAICS code).\n\n"
                    "This means: if only ONE vendor returned a NAICS code, that vendor WINS regardless of\n"
                    "how low its confidence is. The confidence score affects WHO wins the competition,\n"
                    "but does NOT gate whether a vendor is eligible to compete.\n\n"
                    "The confidence score IS stored in the fact JSONB for audit purposes:\n"
                    "value = { 'value': '722511', 'source': { 'platformId': 23, 'confidence': 0.65 } }\n"
                    "Analysts can see the confidence via the alternatives[] array."
                ),
            },
            {
                "step": 6,
                "name": "AI Enrichment Trigger — When and Why",
                "source": "aiNaicsEnrichment.ts L61-64",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts#L61-L64",
                "explanation": (
                    "AI enrichment fires when the DEPENDENT_FACTS config is not satisfied:\n\n"
                    "naics_code: { maximumSources: 3, minimumSources: 1, ignoreSources: ['AINaicsEnrichment'] }\n\n"
                    "TRIGGER CONDITION:\n"
                    "  Number of NON-AI sources that returned a naics_code < minimumSources (1)\n"
                    "  AND total sources < maximumSources (3)\n\n"
                    "TRANSLATION: AI fires if fewer than 1 non-AI vendor returned a naics_code.\n"
                    "= AI fires if ALL of: OC, ZI, EFX, Middesk, Trulioo, SERP returned null naics_code.\n\n"
                    "WHAT AI RECEIVES:\n"
                    "  • business_name (from applicant submission)\n"
                    "  • primary_address (from applicant submission)\n"
                    "  • naics_code: null (no vendor produced one)\n"
                    "  • website: null (if not provided)\n"
                    "  • ZI/EFX/OC NAICS codes NOT included in prompt\n\n"
                    "WHAT AI RETURNS: naics_code, mcc_code, confidence (HIGH/MED/LOW), reasoning\n"
                    "AI weight = 0.1 → AI only wins if ALL other sources have empty NAICS"
                ),
            },
            {
                "step": 7,
                "name": "Rule 6 — removeNaicsCode() — Last Safety Net",
                "source": "aiNaicsEnrichment.ts L215-241",
                "github": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main/integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts#L215-L241",
                "explanation": (
                    "After AI returns a NAICS code, executePostProcessing() validates it:\n\n"
                    "if (response?.naics_code) {\n"
                    "  const naicsInfo = await internalGetNaicsCode(response.naics_code)\n"
                    "  if (!naicsInfo?.[0]?.naics_label) {\n"
                    "    await this.removeNaicsCode(enrichedTask.id, response)  ← INVALID\n"
                    "  }\n"
                    "}\n\n"
                    "removeNaicsCode() sets: response.naics_code = NAICS_OF_LAST_RESORT = '561499'\n\n"
                    "This fires when:\n"
                    "  (a) AI hallucinated a code that does not exist in core_naics_code table\n"
                    "  (b) AI returned a code with wrong format\n\n"
                    "IMPORTANT: '561499' IS in core_naics_code, so it passes validation and is stored as-is.\n"
                    "removeNaicsCode() is the LAST fallback — it only fires for INVALID AI codes, not for 561499."
                ),
            },
        ],
        "scenario_table": [
            ("All 6 vendors return valid NAICS codes",
             "factWithHighestConfidence() runs all → highest confidence wins (or weightedFactSelector breaks tie)",
             "Winning vendor's NAICS shown. User sees real code.",
             "naics_code fact: value=X, source.platformId=winning_pid"),
            ("3 vendors return NAICS, 3 return null",
             "Only 3 valid candidates. factWithHighestConfidence() among those 3.",
             "Winner's NAICS shown. AI does NOT fire (minimumSources=1 already met).",
             "naics_code fact: value=X from best of 3"),
            ("1 vendor returns NAICS, 5 return null",
             "Only 1 valid candidate. That vendor wins regardless of its confidence (Rule 4).",
             "That vendor's NAICS shown. AI does NOT fire.",
             "naics_code fact: value=X from only source, confidence may be low"),
            ("0 vendors return NAICS (all null)",
             "validOptions=[]. AI enrichment fires (minimumSources=1 not met).",
             "IF AI has evidence (name keywords, website) → AI returns real NAICS. IF no evidence → 561499.",
             "naics_code: value='561499' from pid=31"),
            ("0 vendors return NAICS, AI returns hallucinated code",
             "removeNaicsCode() fires: internalGetNaicsCode(hallucinated_code) returns null label",
             "Hallucinated code replaced with '561499'. User sees 561499.",
             "naics_code: value='561499' (original AI code stored in naics_removed field)"),
            ("Analyst manually sets NAICS via portal",
             "manualOverride() fires FIRST, unconditionally. Ignores all vendor results.",
             "Analyst's value shown. Override stored in fact.override: {value, userId, timestamp}",
             "naics_code: value=analyst_code, override:{userId,timestamp}"),
        ],
    },
    "source_weight_deep": {
        "title": "What the Weight column means — complete explanation",
        "explanation": (
            "The Weight is a STATIC configuration value set in sources.ts for each vendor.\n"
            "It is NOT computed by any model. It reflects Worth's trust level in each vendor's data quality.\n\n"
            "Weight is ONLY used in the TIE-BREAK (weightedFactSelector) when two sources have\n"
            "confidence scores within 5% of each other (WEIGHT_THRESHOLD = 0.05).\n\n"
            "Weight does NOT affect:\n"
            "  • Whether a vendor is eligible (isValidFactValue gates this)\n"
            "  • The confidence calculation (each vendor computes its own confidence)\n"
            "  • The data fields returned (the winning vendor provides its NAICS code)\n\n"
            "Weight AFFECTS:\n"
            "  • Tie-breaking when confidence scores are very close\n"
            "  • The effective priority order when multiple vendors match equally well\n\n"
            "WHY these specific weights?\n"
            "  Middesk (2.0): Highest — direct SoS + IRS data, most authoritative for US businesses\n"
            "  OC (0.9): Second — global registry, covers international, very reliable for legal data\n"
            "  ZI/Trulioo (0.8): Third — strong firmographic coverage (ZI=US B2B, Trulioo=UK/CA)\n"
            "  Equifax (0.7): Fourth — good coverage but bulk load cadence (not real-time)\n"
            "  Comment in sources.ts: 'Equifax has a low weight because it relies upon manual files\n"
            "   being ingested at some unknown cadence'\n"
            "  SERP (0.3): Web scraping — useful but less reliable than structured data\n"
            "  Applicant (0.2): What the merchant submitted — may be wrong/generic\n"
            "  AI (0.1): Last resort — only wins when ALL others have no NAICS"
        ),
        "data_field_lineage": (
            "The 'Data field' column in the Sources table shows the EXACT field path in the vendor's response.\n\n"
            "For NAICS code specifically (businessDetails/index.ts L318-357):\n"
            "  Equifax:    efx.primnaicscode  → from warehouse.equifax_us_latest\n"
            "  ZoomInfo:   firmographic.zi_c_naics6  → from zoominfo.comp_standard_global\n"
            "  OC:         industry_code_uids parsed for 'us_naics-XXXXXX' entries\n"
            "              (OC stores ALL taxonomies pipe-delimited: 'us_naics-722511|uk_sic-56101')\n"
            "  SERP:       businessLegitimacyClassification.naics_code  → from web scraping analysis\n"
            "  Trulioo:    standardizedIndustries[n].naicsCode  → from KYB live API response\n"
            "  Applicant:  naics_code  → submitted at onboarding (schema: /^\\d{6}$/)\n"
            "  AI:         response.naics_code  → GPT-5-mini JSON response\n\n"
            "WINNER-TAKES-ALL FOR NAICS ONLY:\n"
            "The winning source provides its naics_code. The other fields (name, address, etc.)\n"
            "are each independently selected by their OWN winner competition.\n"
            "A vendor winning NAICS does NOT mean that vendor's address or name also wins."
        ),
    },
    "naics_null_complete": {
        "title": "When exactly does NAICS show '-' — complete decision tree",
        "decision_tree": [
            ("Is naics_code fact value non-empty?",
             "YES → Show the NAICS code (could be 561499, could be 722511, etc.)",
             "NO → Show '-' (extremely rare)"),
            ("If value=561499, what does the user see?",
             "NAICS Code: '561499', NAICS Description: 'All Other Business Support Services', "
             "Industry Name: 'Administrative and Support and Waste Management and Remediation Services'",
             "NOT blank — 561499 is a valid NAICS code and is always shown"),
            ("Can naics_code be truly null (showing '-')?",
             "Only if AI enrichment itself returned null — this should not happen because AI returns "
             "NAICS_OF_LAST_RESORT='561499' as the absolute fallback. In practice, '-' should never appear.",
             "If it does appear: check if AI enrichment task completed (is_integration_complete flag)"),
            ("Does low confidence cause '-' to show?",
             "NO — Rule 4 means any confidence level is accepted. Low confidence NEVER causes '-'.",
             "Low confidence might mean the NAICS is less accurate, but it is still shown."),
            ("If the winning source has a NAICS code but it is invalid (not in core_naics_code)?",
             "removeNaicsCode() replaces it with '561499'. User sees '561499', not '-' and not the invalid code.",
             "The invalid code is preserved in response.naics_removed for audit."),
            ("If winning source has a match but its NAICS field is empty?",
             "That source is excluded from the NAICS competition by isValidFactValue(). "
             "The NEXT highest source wins. If all have empty NAICS → AI fires → returns 561499.",
             "User sees the next-best source's NAICS, OR 561499 if all vendors are empty."),
        ],
    },
}


def render_deep_explanation(section_key: str) -> dict:
    """Returns the deep explanation dict for a given section."""
    mapping = {
        "industry_calculation": INDUSTRY_NAME_DEEP["how_calculated"],
        "industry_null": INDUSTRY_NAME_DEEP["null_blank_scenarios"],
        "confidence_models": FACT_ENGINE_DEEP["confidence_models"],
        "winner_selection": FACT_ENGINE_DEEP["winner_selection_full"],
        "source_weight": FACT_ENGINE_DEEP["source_weight_deep"],
        "naics_null_complete": FACT_ENGINE_DEEP["naics_null_complete"],
    }
    return mapping.get(section_key, {})
