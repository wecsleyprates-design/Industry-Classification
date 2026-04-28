# Worth AI — NAICS/MCC Industry Classification Intelligence
## Full Technical and Analytical Reference

**Prepared for:** Worth AI Product, Data Science, Engineering, and KYB Operations  
**Prepared on:** April 28, 2026  
**Scope:** Complete reference covering how NAICS and MCC industry classification works inside Worth AI — from raw vendor signals through FactEngine resolution, storage, API exposure, known gaps, correct SQL queries, and planned analytical improvements for the KYB Hub app.

---

## 1. Executive Summary

Worth AI classifies business industries using a **multi-source fact resolution pipeline**, not a trained multi-class industry classifier. The system collects NAICS candidate values from multiple vendors (Equifax, ZoomInfo, OpenCorporates, Trulioo, SERP, AI enrichment, and the user), scores each by `confidence × source_weight`, selects the highest-scoring candidate as the winner, and persists the result.

The current system has five structural gaps:

| Gap | Description | Solvable Today? |
|---|---|---|
| 1 | MCC has almost no direct vendor sources — it is derived from NAICS, not independently verified | ✅ Yes, via facts analysis |
| 2 | Two distinct paths produce the 561499 fallback; only one is currently visible in analytics | ✅ Partially, via platformId |
| 3 | User-submitted NAICS is one of the lowest-weight sources and is routinely overridden by vendors without an audit trail | ✅ Yes, via alternatives[] |
| 4 | Vendor coverage (who provides any NAICS at all) is never measured before concordance | ✅ Yes, via alternatives[] |
| 5 | The NAICS-MCC canonical pair check uses a 1-to-1 join but the mapping is 1-to-many | ✅ Yes, via corrected SQL |

The key analytical enabler that is already in production but underused is the **`alternatives[]` array** inside every `rds_warehouse_public.facts` record. This array stores every losing candidate value with its source platform ID. Parsing it with Redshift-compatible positional JSON extraction unlocks concordance, user override analysis, and vendor coverage — all without building a new table.

---

## 2. What NAICS and MCC Are

### 2.1 NAICS — North American Industry Classification System

NAICS is the primary industry taxonomy used in the US, Canada, and Mexico. It uses a hierarchical code structure:

| Hierarchy level | Digits | Example |
|---|---|---|
| Sector | 2 | `72` — Accommodation and Food Services |
| Subsector | 3 | `722` — Food Services and Drinking Places |
| Industry group | 4 | `7225` — Restaurants and Other Eating Places |
| NAICS industry | 5 | `72251` — Restaurants and Other Eating Places |
| National industry | 6 | `722511` — Full-Service Restaurants |

Worth uses the **2022 NAICS edition** (hardcoded in the AI enrichment prompt: `aiNaicsEnrichment.ts:100`). Invalid or hallucinated codes are detected by lookup against `rds_cases_public.core_naics_code`.

### 2.2 MCC — Merchant Category Code

MCC is a 4-digit code assigned by card payment networks (Visa, Mastercard) to classify merchant transaction types. It is **not** the same taxonomy as NAICS:

- NAICS describes what a business *does operationally*
- MCC describes how card networks *categorize the merchant's payment transactions*

Example: NAICS `722511` (Full-Service Restaurants) maps to MCC `5812` (Eating Places and Restaurants). The connection exists but is not always exact: a catering company might have NAICS `722320` (Caterers) but accept payments under MCC `5812`.

### 2.3 Why NAICS and MCC Can Legitimately Differ

Not every NAICS-MCC pair difference is an error. Legitimate reasons include:

- A business has multiple lines of activity; the merchant account covers only one
- The legal entity NAICS reflects corporate structure; MCC reflects the retail payment channel
- A vendor returns a parent-company NAICS; the actual location operates in a different sub-industry
- A fallback MCC is derived from the NAICS when no direct MCC evidence exists (the most common case)

The correct analytical framing classifies each NAICS-MCC pair as: **canonical** / **adjacent (acceptable)** / **multi-line plausible** / **noncanonical** / **fallback** — not simply "match" or "error."

---

## 3. How Worth AI Determines NAICS — Complete Lineage

### 3.1 Source File

**`integration-service-main/lib/facts/businessDetails/index.ts`**  
(Not `kyb/index.ts` — a common source of confusion.)

### 3.2 Candidate Sources for `naics_code`

The FactEngine collects candidates from every available platform for each business:

| Source | Platform ID | Field/Path | Explicit Weight | Notes |
|---|---|---|---|---|
| Equifax | 17 | `primnaicscode` | default | Only primary NAICS consumed; SIC and secondary hierarchy fields are dropped |
| ZoomInfo | 24 | `firmographic.zi_c_naics6` | default | 6-digit NAICS; SIC fields dropped |
| OpenCorporates | 23 | `firmographic.industry_code_uids` — parses `us_naics-XXXXXX` pattern | default | UK SIC and CA NAICS paths in the same field are ignored in current production |
| SERP | 22 | `businessLegitimacyClassification.naics_code` | **0.3** | Low weight; flagged for future replacement |
| Trulioo / business | 38 | `clientData.standardizedIndustries[].naicsCode` | default | Regex-validated to 6 digits |
| User submitted | 0 | `naics_code` (businessDetails source) | **0.2** | Customer-submitted value; second-lowest weight |
| AI Enrichment | 31 | `response.naics_code` | **0.1** | Lowest weight; last resort |

### 3.3 FactEngine Resolution Rule

```
candidate_score = source_confidence × source_weight
winner = candidate with highest candidate_score
if top two candidates within 5% threshold → apply weighted tie-breaker
manual override → forces a value regardless of score
```

This is **deterministic** — it does not learn from historical overrides.

### 3.4 The NAICS_OF_LAST_RESORT

```typescript
// aiNaicsEnrichment.ts:63
public readonly NAICS_OF_LAST_RESORT = "561499";
```

The AI enrichment prompt explicitly instructs the model:
> *"If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."*
> — `aiNaicsEnrichment.ts:109`

If the AI returns a code that does not exist in `core_naics_code`, `removeNaicsCode()` replaces it with `561499` and records `naics_removed` in the raw JSON response stored in `integration_data.request_response`.

---

## 4. How Worth AI Determines MCC — Complete Lineage

### 4.1 Critical Understanding: MCC Has Almost No Direct Vendor Sources

**No vendor other than the AI enrichment returns MCC directly.** Equifax, ZoomInfo, OpenCorporates, and Trulioo do not provide MCC candidates in the current pipeline.

### 4.2 The Three-Fact MCC Chain

```
mcc_code_found        ← AI Enrichment only (response.mcc_code, platformId=31)
mcc_code_from_naics   ← Derived: internalGetNaicsCode(final_naics) → rel_naics_mcc lookup
mcc_code              ← mcc_code_found  ??  mcc_code_from_naics
```

**Source file:** `integration-service-main/lib/facts/businessDetails/index.ts:351-387`

### 4.3 Structural Implication

> **MCC quality = NAICS quality.**  
> If NAICS is wrong (fallback, hallucinated, or zero-signal), the derived MCC will also be wrong. Fixing NAICS fixes MCC downstream.

This means the fallback pair 561499/5614 is almost never caused by two independent failures. It is one failure (no vendor NAICS signal) that cascades into both outputs.

---

## 5. The Fallback Problem in Full Detail

### 5.1 The Fallback Pair

- **NAICS 561499** — "All Other Business Support Services" (NAICS_OF_LAST_RESORT)
- **MCC 5614** — Fallback MCC derived from NAICS 561499 via `rel_naics_mcc`

Per the production root-cause analysis, 5,349 businesses (7.7% of the analyzed population) show this fallback pair.

### 5.2 Root Cause Distribution

| Scenario | Count | Share |
|---|---|---|
| C: All vendor NAICS signals missing (zero coverage) | 5,348 | 99.98% |
| E: AI not triggered / winner had no NAICS | 1 | 0.02% |

### 5.3 Two Distinct Paths to 561499

The document previously combined these. They are structurally different:

**Path A — AI explicitly returns 561499:**  
The AI prompt runs, evaluates insufficient evidence, and deliberately returns `naics_code: "561499"`. No replacement occurs. The `source.platformId` on the final fact will be `31` (AI Enrichment).

**Path B — AI returns an invalid/hallucinated code, then 561499 replaces it:**  
The AI returns a code (e.g., `"723999"`) that does not exist in `core_naics_code`. `removeNaicsCode()` scrubs it, stores the original as `naics_removed` in `integration_data.request_response`, and persists `561499`. The `source.platformId` on the final fact will still be `31`.

Both paths are currently indistinguishable from `rds_warehouse_public.facts` alone. Distinguishing them requires joining to `rds_integration_data.request_response` to check for the presence of `naics_removed`.

### 5.4 Fallback Categorization Framework

| Category | Definition | Action |
|---|---|---|
| Recoverable by name | Business name strongly implies an industry (salon, trucking, dental, restaurant) | Deterministic keyword-to-NAICS rules; re-prompt AI with name emphasis |
| Recoverable by website | Vendor signals fail but website/DBA reveals clear industry | Improve SERP/website evidence extraction |
| Truly ambiguous | No reliable evidence from any source | Keep 561499 internally; expose "classification pending" to users |

---

## 6. Data Sources: What Exists in Redshift Today

### 6.1 Primary Analytical Source

**`rds_warehouse_public.facts`** — every resolved fact with full JSON including winner AND all candidates in `alternatives[]`.

Structure of the `naics_code` fact's value JSON:
```json
{
  "value": "722511",
  "source": {
    "platformId": 23,
    "name": "opencorporates",
    "confidence": 1.0
  },
  "alternatives": [
    {"value": "722513", "source": 17, "confidence": 0.91},
    {"value": "722511", "source": 16, "confidence": 0.95},
    {"value": null,     "source": 24, "confidence": 0.80},
    {"value": "722511", "source": 0,  "confidence": 0.20}
  ]
}
```

### 6.2 Reference and Mapping Tables (Redshift federated from case-service)

| Table | Schema | Role |
|---|---|---|
| `core_naics_code` | `rds_cases_public` | Canonical NAICS code reference; `id`, `code`, `label` |
| `core_mcc_code` | `rds_cases_public` | Canonical MCC code reference; `id`, `code`, `label` |
| `rel_naics_mcc` | `rds_cases_public` | NAICS-to-MCC mapping (1-to-many) |
| `data_businesses` | `rds_cases_public` | Final `naics_id`, `mcc_id` per business |
| `rel_business_customer_monitoring` | `rds_cases_public` | Business-customer join with `created_at` for date/customer filtering |

### 6.3 Platform ID Map

| platformId | Vendor | Notes |
|---|---|---|
| 16 | Middesk | SOS + firmographic data; high confidence |
| 23 | OpenCorporates | Global company registry; parses `us_naics` from `industry_code_uids` |
| 24 | ZoomInfo | B2B firmographic; `zi_c_naics6` field |
| 17 | Equifax / Baselayer | Bureau data; `primnaicscode` |
| 38 | Trulioo | KYB compliance; `naicsCode` field |
| 22 | SERP | Web scrape; weight=0.3 |
| 31 | AI Enrichment | Last resort; weight=0.1 |
| 0 | businessDetails | User-submitted; weight=0.2 |
| -1 | Calculated / Dependent | Derived fact (e.g., mcc_code, mcc_code_from_naics) |

### 6.4 The `alternatives[]` Array: The Mini-Audit-Mart

The `alternatives[]` field in every fact's JSON blob stores every losing candidate with its source platformId, value, and confidence. This is queryable today using positional `JSON_EXTRACT_PATH_TEXT` — the same Redshift-compatible approach used for `sos_filings` analysis.

This array is the **practical equivalent of the concordance audit mart**. It does not require any new engineering to access.

---

## 7. What the User Sees in the Admin Portal and API

The resolved NAICS and MCC are surfaced as:

```json
{
  "industry": { "name": "Accommodation and Food Services" },
  "naics_id": "naics_01",
  "naics_code": "722511",
  "naics_title": "Full-Service Restaurants",
  "mcc_id": "mcc_01",
  "mcc_code": "5812",
  "mcc_title": "Eating Places and Restaurants"
}
```

**Source:** `api-docs/openapi-specs/business-details.json:348-362`

**What is NOT shown to the user:**
- Which vendor provided the winning value
- What other vendors said
- Whether the user's submitted NAICS was overridden
- Whether the result is a fallback
- The effective confidence score of the winner

This missing lineage view is the primary reason NAICS/MCC questions are operationally difficult to answer.

---

## 8. Analytical Plans: Eight Analyses Buildable Today

All eight analyses below use only existing Redshift tables and the `alternatives[]` JSON array. None require building a new table.

---

### Analysis 1: NAICS/MCC Coverage Distribution

**Business question:** How many businesses have a real NAICS vs the fallback 561499 vs null?

**What to show:** Three-bucket KPI cards (Real / Fallback 561499 / Missing) with percentages, drilldown by customer.

**Correct SQL:**
```sql
-- Section 1 filter: date range + customer from rel_business_customer_monitoring
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
naics_facts AS (
  SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS naics_code,
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name') AS winning_vendor,
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') AS winning_platform_id
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code'
    AND LENGTH(f.value) < 60000
)
SELECT
  CASE
    WHEN naics_code = '561499'           THEN 'fallback_561499'
    WHEN naics_code IS NULL OR naics_code = '' THEN 'missing'
    ELSE 'real_naics'
  END AS classification_status,
  COUNT(DISTINCT business_id) AS businesses,
  ROUND(100.0 * COUNT(DISTINCT business_id) / SUM(COUNT(DISTINCT business_id)) OVER (), 2) AS pct
FROM naics_facts
GROUP BY 1
ORDER BY businesses DESC;
```

---

### Analysis 2: Winning Vendor Distribution

**Business question:** Which vendor is driving our NAICS classification? Who wins most often?

**What to show:** Horizontal bar chart: Equifax / ZoomInfo / OpenCorporates / Middesk / AI / User / Other — how many businesses each won, and what percentage of those are 561499.

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
naics_facts AS (
  SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS naics_code,
    CASE JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId')
      WHEN '16' THEN 'Middesk'
      WHEN '23' THEN 'OpenCorporates'
      WHEN '24' THEN 'ZoomInfo'
      WHEN '17' THEN 'Equifax'
      WHEN '38' THEN 'Trulioo'
      WHEN '22' THEN 'SERP'
      WHEN '31' THEN 'AI Enrichment'
      WHEN '0'  THEN 'User Submitted'
      ELSE 'Other/Calculated'
    END AS winning_vendor
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code'
    AND LENGTH(f.value) < 60000
)
SELECT
  winning_vendor,
  COUNT(*) AS businesses_won,
  SUM(CASE WHEN naics_code = '561499' THEN 1 ELSE 0 END) AS fallback_count,
  ROUND(100.0 * SUM(CASE WHEN naics_code = '561499' THEN 1 ELSE 0 END) / COUNT(*), 2) AS fallback_pct
FROM naics_facts
GROUP BY 1
ORDER BY businesses_won DESC;
```

---

### Analysis 3: MCC Derivation Path

**Business question:** How many MCCs came directly from AI vs were derived from NAICS? This surfaces the structural NAICS→MCC dependency.

**What to show:** Two-bucket KPI: "AI Direct (mcc_code_found)" vs "NAICS Derived (mcc_code_from_naics)" vs "Missing". Plus: the fallback rate for each path.

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
mcc_direct AS (
  SELECT f.business_id, 'ai_direct' AS mcc_path,
         JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS mcc_code
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'mcc_code_found' AND LENGTH(f.value) < 60000
),
mcc_derived AS (
  SELECT f.business_id, 'naics_derived' AS mcc_path,
         JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS mcc_code
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'mcc_code_from_naics' AND LENGTH(f.value) < 60000
),
all_mcc AS (
  SELECT * FROM mcc_direct
  UNION ALL
  SELECT * FROM mcc_derived
)
SELECT
  mcc_path,
  COUNT(DISTINCT business_id) AS businesses,
  SUM(CASE WHEN mcc_code = '5614' THEN 1 ELSE 0 END) AS fallback_mcc_count,
  ROUND(100.0 * SUM(CASE WHEN mcc_code = '5614' THEN 1 ELSE 0 END) / COUNT(*), 2) AS fallback_pct
FROM all_mcc
GROUP BY 1;
```

---

### Analysis 4: NAICS Sector Distribution

**Business question:** What industries does this portfolio cover? What are the top NAICS sectors?

**What to show:** Bar chart of top 2-digit NAICS sectors (20 possible). Drilldown to 3-digit subsectors. Filter: exclude fallback 561499 for "real industry" view; include for "full portfolio" view.

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
naics_facts AS (
  SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS naics_code
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code'
    AND LENGTH(f.value) < 60000
    AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') NOT IN ('561499', '', 'null')
    AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
)
SELECT
  LEFT(naics_code, 2) AS naics_sector,
  LEFT(naics_code, 3) AS naics_subsector,
  naics_code,
  n.label AS naics_title,
  COUNT(DISTINCT f.business_id) AS businesses,
  ROUND(100.0 * COUNT(DISTINCT f.business_id) / SUM(COUNT(DISTINCT f.business_id)) OVER (), 2) AS pct
FROM naics_facts f
LEFT JOIN rds_cases_public.core_naics_code n ON n.code = f.naics_code
GROUP BY 1, 2, 3, 4
ORDER BY businesses DESC
LIMIT 50;
```

---

### Analysis 5: NAICS-MCC Canonical Pair Check (corrected for 1-to-many)

**Business question:** Does the final NAICS-MCC pair make sense? Is it canonical, noncanonical, fallback, or missing?

**Key correction from the document:** The original SQL used a 1-to-1 join on `rel_naics_mcc`. The correct approach checks if the final MCC is ANY valid MCC for the final NAICS (1-to-many).

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
naics_facts AS (
  SELECT f.business_id,
         JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_naics_code
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
),
mcc_facts AS (
  SELECT f.business_id,
         JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS final_mcc_code
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'mcc_code' AND LENGTH(f.value) < 60000
),
joined AS (
  SELECT
    n.business_id,
    n.final_naics_code,
    m.final_mcc_code,
    nc.label AS naics_title,
    mc.label AS mcc_title
  FROM naics_facts n
  LEFT JOIN mcc_facts m ON m.business_id = n.business_id
  LEFT JOIN rds_cases_public.core_naics_code nc ON nc.code = n.final_naics_code
  LEFT JOIN rds_cases_public.core_mcc_code mc ON mc.code = m.final_mcc_code
),
-- Check: is the MCC one of the VALID MCCs for this NAICS? (1-to-many)
canonical_check AS (
  SELECT
    j.*,
    CASE
      WHEN j.final_naics_code = '561499' OR j.final_mcc_code = '5614' THEN 'fallback_pair'
      WHEN j.final_naics_code IS NULL OR j.final_naics_code = ''       THEN 'naics_missing'
      WHEN j.final_mcc_code IS NULL OR j.final_mcc_code = ''           THEN 'mcc_missing'
      WHEN EXISTS (
        SELECT 1
        FROM rds_cases_public.rel_naics_mcc r
        JOIN rds_cases_public.core_naics_code nc2 ON nc2.id = r.naics_id
        JOIN rds_cases_public.core_mcc_code mc2 ON mc2.id = r.mcc_id
        WHERE nc2.code = j.final_naics_code
          AND mc2.code = j.final_mcc_code
      ) THEN 'canonical_pair'
      ELSE 'noncanonical_pair'
    END AS pair_status
  FROM joined j
)
SELECT
  pair_status,
  COUNT(*) AS business_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM canonical_check
GROUP BY 1
ORDER BY business_count DESC;
```

---

### Analysis 6: Pairwise Vendor Concordance (using `alternatives[]`)

**Business question:** When OpenCorporates and Equifax both provide a NAICS, how often do they agree? At what level (exact 6-digit / same sector / different sector)?

**Approach:** Use positional `JSON_EXTRACT_PATH_TEXT` on `alternatives[0..4]` — the same Redshift-compatible pattern used for `sos_filings`. Extract each alternative's `source` (platformId) and `value`, pivot by platformId to get per-vendor NAICS columns.

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
-- Extract winner + up to 5 alternatives using positional JSON extraction
raw_candidates AS (
  SELECT
    f.business_id,
    -- Winner
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId')  AS win_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value')                 AS win_naics,
    -- Alternative 0
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'source') AS a0_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'value')  AS a0_naics,
    -- Alternative 1
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'source') AS a1_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'value')  AS a1_naics,
    -- Alternative 2
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'source') AS a2_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'value')  AS a2_naics,
    -- Alternative 3
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'source') AS a3_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'value')  AS a3_naics,
    -- Alternative 4
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'source') AS a4_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'value')  AS a4_naics
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
),
-- Pivot: assign each candidate to its vendor column by platformId
per_vendor AS (
  SELECT
    business_id,
    -- Winner is added to its vendor column
    MAX(CASE WHEN win_pid = '16' THEN win_naics
             WHEN a0_pid = '16'  THEN a0_naics
             WHEN a1_pid = '16'  THEN a1_naics
             WHEN a2_pid = '16'  THEN a2_naics
             WHEN a3_pid = '16'  THEN a3_naics
             WHEN a4_pid = '16'  THEN a4_naics END) AS middesk_naics,
    MAX(CASE WHEN win_pid = '23' THEN win_naics
             WHEN a0_pid = '23'  THEN a0_naics
             WHEN a1_pid = '23'  THEN a1_naics
             WHEN a2_pid = '23'  THEN a2_naics
             WHEN a3_pid = '23'  THEN a3_naics
             WHEN a4_pid = '23'  THEN a4_naics END) AS oc_naics,
    MAX(CASE WHEN win_pid = '24' THEN win_naics
             WHEN a0_pid = '24'  THEN a0_naics
             WHEN a1_pid = '24'  THEN a1_naics
             WHEN a2_pid = '24'  THEN a2_naics
             WHEN a3_pid = '24'  THEN a3_naics
             WHEN a4_pid = '24'  THEN a4_naics END) AS zoominfo_naics,
    MAX(CASE WHEN win_pid = '17' THEN win_naics
             WHEN a0_pid = '17'  THEN a0_naics
             WHEN a1_pid = '17'  THEN a1_naics
             WHEN a2_pid = '17'  THEN a2_naics
             WHEN a3_pid = '17'  THEN a3_naics
             WHEN a4_pid = '17'  THEN a4_naics END) AS equifax_naics,
    MAX(CASE WHEN win_pid = '31' THEN win_naics
             WHEN a0_pid = '31'  THEN a0_naics
             WHEN a1_pid = '31'  THEN a1_naics
             WHEN a2_pid = '31'  THEN a2_naics
             WHEN a3_pid = '31'  THEN a3_naics
             WHEN a4_pid = '31'  THEN a4_naics END) AS ai_naics,
    MAX(CASE WHEN win_pid = '0'  THEN win_naics
             WHEN a0_pid = '0'   THEN a0_naics
             WHEN a1_pid = '0'   THEN a1_naics
             WHEN a2_pid = '0'   THEN a2_naics
             WHEN a3_pid = '0'   THEN a3_naics
             WHEN a4_pid = '0'   THEN a4_naics END) AS user_naics,
    win_naics AS final_naics
  FROM raw_candidates
  GROUP BY business_id, win_naics
),
-- Pairwise concordance for key pairs
pairs AS (
  SELECT business_id, 'OC vs Equifax'     AS pair, oc_naics AS a, equifax_naics AS b FROM per_vendor
  UNION ALL
  SELECT business_id, 'OC vs ZoomInfo'    AS pair, oc_naics,      zoominfo_naics    FROM per_vendor
  UNION ALL
  SELECT business_id, 'Equifax vs ZoomInfo' AS pair, equifax_naics, zoominfo_naics  FROM per_vendor
  UNION ALL
  SELECT business_id, 'User vs Final'     AS pair, user_naics,    final_naics       FROM per_vendor
  UNION ALL
  SELECT business_id, 'AI vs Final'       AS pair, ai_naics,      final_naics       FROM per_vendor
)
SELECT
  pair,
  CASE
    WHEN a IS NULL AND b IS NULL                        THEN 'both_null'
    WHEN a IS NULL OR b IS NULL                         THEN 'one_null'
    WHEN a = b                                          THEN 'exact_6_digit'
    WHEN LEFT(a,4) = LEFT(b,4)                         THEN 'same_4_digit_group'
    WHEN LEFT(a,3) = LEFT(b,3)                         THEN 'same_3_digit_subsector'
    WHEN LEFT(a,2) = LEFT(b,2)                         THEN 'same_2_digit_sector'
    ELSE                                                     'different_sector'
  END AS concordance_level,
  COUNT(*) AS businesses,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY pair), 2) AS pct_within_pair
FROM pairs
GROUP BY 1, 2
ORDER BY pair, businesses DESC;
```

---

### Analysis 7: User vs Vendor Override Analysis

**Business question:** How often does the user submit a NAICS that vendors override? When they disagree, how severe is the disagreement?

**Approach:** Parse `alternatives[]` to find platformId=0 (user submitted). If present but not the winner, user was overridden.

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
raw AS (
  SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') AS win_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'value')                AS final_naics,
    -- Find user-submitted value in alternatives
    COALESCE(
      CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'source') = '0'
           THEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'value') END,
      CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'source') = '0'
           THEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'value') END,
      CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'source') = '0'
           THEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'value') END,
      CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'source') = '0'
           THEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'value') END,
      CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'source') = '0'
           THEN JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'value') END
    ) AS user_naics_in_alt,
    -- Or user won outright
    CASE WHEN JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') = '0'
         THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END AS user_naics_winner
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
),
classified AS (
  SELECT
    business_id,
    final_naics,
    COALESCE(user_naics_winner, user_naics_in_alt) AS user_naics,
    CASE
      WHEN user_naics_winner IS NOT NULL          THEN 'user_won'
      WHEN user_naics_in_alt IS NOT NULL
       AND user_naics_in_alt != final_naics        THEN 'user_overridden'
      WHEN user_naics_in_alt IS NOT NULL
       AND user_naics_in_alt = final_naics          THEN 'user_agreed_with_winner'
      ELSE                                              'no_user_submission'
    END AS override_status,
    CASE
      WHEN COALESCE(user_naics_winner, user_naics_in_alt) IS NULL OR final_naics IS NULL
        THEN 'na'
      WHEN COALESCE(user_naics_winner, user_naics_in_alt) = final_naics
        THEN 'exact_match'
      WHEN LEFT(COALESCE(user_naics_winner, user_naics_in_alt), 2)
         = LEFT(final_naics, 2)
        THEN 'same_sector'
      ELSE 'different_sector'
    END AS disagreement_severity
  FROM raw
)
SELECT
  override_status,
  disagreement_severity,
  COUNT(*) AS businesses,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM classified
GROUP BY 1, 2
ORDER BY businesses DESC;
```

---

### Analysis 8: Vendor Coverage Heatmap

**Business question:** For each vendor, what percentage of businesses in the portfolio did they provide ANY NAICS signal for?

**What to show:** Table with one row per vendor, showing coverage rate (% of businesses where this vendor had a candidate) and "win rate" (% of businesses where this vendor's candidate was selected as final).

**Correct SQL:**
```sql
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
    AND rbcm.customer_id = '{customer_id}'
),
total AS (SELECT COUNT(DISTINCT business_id) AS total_biz FROM onboarded),
raw AS (
  SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') AS win_pid,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'source') AS a0,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '0', 'value')  AS a0_val,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'source') AS a1,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '1', 'value')  AS a1_val,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'source') AS a2,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '2', 'value')  AS a2_val,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'source') AS a3,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '3', 'value')  AS a3_val,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'source') AS a4,
    JSON_EXTRACT_PATH_TEXT(f.value, 'alternatives', '4', 'value')  AS a4_val
  FROM rds_warehouse_public.facts f
  JOIN onboarded o ON o.business_id = f.business_id
  WHERE f.name = 'naics_code' AND LENGTH(f.value) < 60000
),
vendor_coverage AS (
  -- For each vendor: did they have a non-null value (winner or alternative)?
  SELECT business_id, '16' AS pid, 1 AS covered, CASE WHEN win_pid='16' THEN 1 ELSE 0 END AS won
  FROM raw WHERE win_pid='16' OR (a0='16' AND a0_val IS NOT NULL)
                             OR (a1='16' AND a1_val IS NOT NULL)
                             OR (a2='16' AND a2_val IS NOT NULL)
                             OR (a3='16' AND a3_val IS NOT NULL)
                             OR (a4='16' AND a4_val IS NOT NULL)
  UNION ALL
  SELECT business_id, '23', 1, CASE WHEN win_pid='23' THEN 1 ELSE 0 END FROM raw
  WHERE win_pid='23' OR (a0='23' AND a0_val IS NOT NULL) OR (a1='23' AND a1_val IS NOT NULL)
                     OR (a2='23' AND a2_val IS NOT NULL) OR (a3='23' AND a3_val IS NOT NULL)
                     OR (a4='23' AND a4_val IS NOT NULL)
  UNION ALL
  SELECT business_id, '24', 1, CASE WHEN win_pid='24' THEN 1 ELSE 0 END FROM raw
  WHERE win_pid='24' OR (a0='24' AND a0_val IS NOT NULL) OR (a1='24' AND a1_val IS NOT NULL)
                     OR (a2='24' AND a2_val IS NOT NULL) OR (a3='24' AND a3_val IS NOT NULL)
                     OR (a4='24' AND a4_val IS NOT NULL)
  UNION ALL
  SELECT business_id, '17', 1, CASE WHEN win_pid='17' THEN 1 ELSE 0 END FROM raw
  WHERE win_pid='17' OR (a0='17' AND a0_val IS NOT NULL) OR (a1='17' AND a1_val IS NOT NULL)
                     OR (a2='17' AND a2_val IS NOT NULL) OR (a3='17' AND a3_val IS NOT NULL)
                     OR (a4='17' AND a4_val IS NOT NULL)
  UNION ALL
  SELECT business_id, '31', 1, CASE WHEN win_pid='31' THEN 1 ELSE 0 END FROM raw
  WHERE win_pid='31' OR (a0='31' AND a0_val IS NOT NULL) OR (a1='31' AND a1_val IS NOT NULL)
                     OR (a2='31' AND a2_val IS NOT NULL) OR (a3='31' AND a3_val IS NOT NULL)
                     OR (a4='31' AND a4_val IS NOT NULL)
)
SELECT
  CASE pid
    WHEN '16' THEN 'Middesk'
    WHEN '23' THEN 'OpenCorporates'
    WHEN '24' THEN 'ZoomInfo'
    WHEN '17' THEN 'Equifax'
    WHEN '31' THEN 'AI Enrichment'
    ELSE pid
  END AS vendor,
  COUNT(DISTINCT business_id) AS businesses_with_signal,
  (SELECT total_biz FROM total) AS total_businesses,
  ROUND(100.0 * COUNT(DISTINCT business_id) / (SELECT total_biz FROM total), 2) AS coverage_pct,
  SUM(won) AS businesses_won,
  ROUND(100.0 * SUM(won) / (SELECT total_biz FROM total), 2) AS win_rate_pct
FROM vendor_coverage
GROUP BY 1
ORDER BY coverage_pct DESC;
```

---

## 9. Summary: What Each Analysis Answers

| Analysis | Key Question Answered |
|---|---|
| 1: Coverage Distribution | What % of businesses have real NAICS vs fallback vs missing? |
| 2: Winning Vendor Distribution | Which vendor drives our NAICS classification? Who wins most often? |
| 3: MCC Derivation Path | What % of MCCs are AI-direct vs NAICS-derived? (Surfaces NAICS→MCC dependency) |
| 4: NAICS Sector Distribution | What industries does this portfolio cover? Top sectors? |
| 5: NAICS-MCC Canonical Pair | Are NAICS and MCC consistent with each other? |
| 6: Pairwise Vendor Concordance | Do OpenCorporates, Equifax, ZoomInfo agree? At what level? |
| 7: User vs Vendor Override | How often does a vendor override the user's submitted NAICS? How severely? |
| 8: Vendor Coverage Heatmap | For each vendor: what % of businesses do they provide any signal for? |

---

## 10. What Cannot Be Built Today (and Why)

| Analysis | Why Not Today | What Would Enable It |
|---|---|---|
| Historical drift over time | No time-series snapshots of classification state; only current resolved value exists | Periodic materialized snapshots; engineering investment |
| Full pre-built audit mart | No `industry_classification_candidates` table exists | Engineering work to materialize alternatives[] into a normalized table at write time |
| Distinguishing Path A vs Path B to 561499 | Requires joining to `integration_data.request_response` to check `naics_removed` field | Complex federated join; feasible but expensive |

---

## 11. Improvements and Recommended Actions

### 11.1 Stop persisting 561499 as a business-visible code

**Problem:** Customers see "All Other Business Support Services" or the MCC title "Fallback MCC per instructions" — internal wording.  
**Fix:** Add a `is_fallback` flag to the fact. Surface "Industry classification pending verification" in the UI. Keep 561499 internally for pipeline tracking.

### 11.2 Add deterministic name-keyword fallback recovery

**Problem:** 99.98% of fallbacks are zero vendor signals — but many of those businesses have a name like "Miami Dental Center" or "Fast Lane Trucking" that strongly implies an industry.  
**Fix:** Before calling AI enrichment, apply a keyword-to-NAICS lookup table. If the name matches a high-confidence pattern, skip the "no evidence" path and assign a specific NAICS directly.

### 11.3 Improve AI prompt evidence capture

**Problem:** The AI is allowed to return 561499 when evidence is "insufficient." But the prompt does not currently require the model to explain what evidence it did receive before giving up.  
**Fix:** Require the AI to list what evidence it evaluated (business name, DBA, website, address) and to return `confidence: LOW` with a specific NAICS before resorting to 561499. Remove the explicit "return 561499 if no evidence" instruction — instead use null and let the FactEngine handle the null case.

### 11.4 Add source lineage to the Admin Portal NAICS view

**Problem:** The current UI shows only the final NAICS/MCC. No user, underwriter, or customer support agent can see why that value was chosen or what the alternatives were.  
**Fix:** Add an expandable "Industry Classification Lineage" panel in the KYB Hub showing: winning vendor / winning score / all candidates by vendor / concordance status / fallback reason if applicable.

### 11.5 Fix the MCC multi-mapping canonical check

**Problem:** The NAICS-MCC pair check uses a 1-to-1 join, but `rel_naics_mcc` is 1-to-many. Valid pairs are falsely classified as noncanonical.  
**Fix:** Use an EXISTS subquery instead of a direct join (shown in Analysis 5 above).

### 11.6 Capture UK SIC for non-US businesses

**Problem:** OpenCorporates' `industry_code_uids` may contain `uk_sic-XXXX` or `ca_naics-XXXXXX` codes that are currently silently dropped.  
**Fix:** Parse and store all taxonomy types from `industry_code_uids`. Add a `taxonomy` column to the naics_code fact or create parallel fact names (`uk_sic_code`, `ca_naics_code`). For non-US businesses, surface the local taxonomy as primary.

---

## 12. Sources and References

| Reference | Location in Repo | What It Documents |
|---|---|---|
| NAICS code fact definition (all sources, weights) | `Admin-Portal-KYB-App/integration-service-main/lib/facts/businessDetails/index.ts:278-322` | Source list, paths, weights for naics_code |
| MCC fact chain definition | `Admin-Portal-KYB-App/integration-service-main/lib/facts/businessDetails/index.ts:351-387` | mcc_code_found, mcc_code_from_naics, mcc_code |
| NAICS_OF_LAST_RESORT constant | `Admin-Portal-KYB-App/integration-service-main/lib/aiEnrichment/aiNaicsEnrichment.ts:63` | Hardcoded 561499 |
| AI prompt last-resort instruction | `Admin-Portal-KYB-App/integration-service-main/lib/aiEnrichment/aiNaicsEnrichment.ts:100-109` | "return 561499 and 5614 as last resort" |
| removeNaicsCode (Path B to 561499) | `Admin-Portal-KYB-App/integration-service-main/lib/aiEnrichment/aiNaicsEnrichment.ts:187-233` | Invalid code replacement logic |
| internalGetNaicsCode (NAICS→MCC lookup) | `Admin-Portal-KYB-App/integration-service-main/src/helpers/api.ts:999-1016` | Internal API call to case-service |
| Warehouse NAICS/MCC facts pivot | `Admin-Portal-KYB-App/warehouse-service-main/datapooler/adapters/redshift/customer_file/procedures/build-customer-export.sql:46-113` | How naics_code/mcc_code land in rds_warehouse_public.facts |
| review_metrics.sql NAICS join | `Admin-Portal-KYB-App/warehouse-service-main/datapooler/adapters/redshift/customer_file/tables/review_metrics.sql:73-93` | Joins data_businesses → core_naics_code → core_mcc_code |
| API schema: naics_code, mcc_code fields | `Admin-Portal-KYB-App/api-docs/openapi-specs/business-details.json:348-362` | Customer-facing field definitions |
| NAICS_MCC_Fallback_Root_Cause_Report.docx | `AI-Powered-NAICS-Industry-Classification-Agent/naics_mcc_classifier/` | 5,349 businesses / 7.7% fallback rate; 99.98% Scenario C |
| Current Section 6.2 app code | `Admin-Portal-KYB-App/kyb_hub_app_v2.py:~9683-9747` | Existing NAICS anomaly UI |

---

*Document prepared April 28, 2026. All SQL queries validated against actual Redshift schema using rds_warehouse_public.facts and rds_cases_public.* tables. The alternatives[] extraction pattern follows the same positional JSON approach used in _load_sos_filings_for_bids (kyb_hub_app_v2.py). No new tables are required to run any analysis in Sections 8.1–8.8.*
