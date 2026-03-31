# Industry Classification Facts — How They Work End to End

**Scope:** How the 8 classification facts (`industry`, `naics_code`, `naics_description`, `classification_codes`, `mcc_code`, `mcc_code_found`, `mcc_code_from_naics`, `mcc_description`) are calculated, stored, and delivered.

---

## 1. What Is a Fact?

A **fact** is the single best answer Worth AI has for one attribute of a business, chosen from potentially many competing vendor sources.

- The fact engine does not return raw vendor data. It picks **one winner** per attribute based on confidence.
- 217 facts exist in the system today. New ones are added continuously.
- A **feature** is the technical mechanism that computes a fact. Features are internal; facts are what customers see.
- Facts are calculated **on the fly** when an API call is made, then persisted to the database so the next call returns instantly.

---

## 2. Where Facts Are Stored

### Primary Store — PostgreSQL (warehouse-service)

```
Table: rds_warehouse_public.facts  (also mirrored to Redshift)

Columns:
  business_id  VARCHAR   ← composite PK with name
  name         VARCHAR   ← the fact key  e.g. "naics_code"
  value        JSONB     ← flexible payload  e.g. {"code":"5411","description":"..."}
  received_at  TIMESTAMP
  created_at   TIMESTAMP
  updated_at   TIMESTAMP
```

- **One row per fact per business.** If `naics_code` is updated, the existing row is upserted — not duplicated.
- The `value` column is JSONB so each fact can carry a rich payload (code, description, confidence, source, alternatives).

### Redshift Mirror

The same facts are materialized into Redshift for analytics:
- `dev.rds_warehouse_public.facts` — all facts as key-value rows
- `dev.rds_cases_public.core_naics_mcc_code` — NAICS/MCC lookup table
- `dev.rds_cases_public.data_businesses` — `naics_code`, `mcc_code`, `industry` columns per business

---

## 3. How Classification Facts Are Calculated — Step by Step

```
Step 1 — Business submitted
  Customer calls POST /businesses/customers/{customerID}
  Worth AI creates a business_id and triggers the pipeline.

Step 2 — Vendor API calls (integration-service)
  ZoomInfo, Equifax, OpenCorporates, Middesk, Verdata/SERP, Trulioo
  each return their version of the business's industry code.
  Every source also returns a confidence score.

Step 3 — Fact Engine runs (integration-service / lib/facts/)
  For each fact (naics_code, mcc_code, industry, etc.):
    • Collect all vendor values
    • Apply the Winning Source rules (see Section 4)
    • Pick one winner
    • Wrap result in a Fact object with: value, source, confidence, alternatives[]

Step 4 — Kafka publish (facts.v1 topic)
  integration-service publishes a FactEnvelope message.
  Key events:
    CALCULATE_BUSINESS_FACTS
    UPDATE_NAICS_CODE
    PROCESS_COMPLETION_FACTS

Step 5 — Warehouse consumes and persists (warehouse-service)
  FactService.consume() subscribes to facts.v1
  For each fact in the envelope → upsert into rds_warehouse_public.facts
  (business_id + name unique constraint → INSERT ON CONFLICT UPDATE)

Step 6 — case-service updates business record
  Kafka handler receives UPDATE_NAICS_CODE
  Calls addIndustryAndNaicsPlatform()
  Updates data_businesses.naics_code, .mcc_code, .industry

Step 7 — Available via REST API
  GET /facts/business/{businessId}/kyb — returns all KYB facts including classification
  GET /facts/business/{businessId}/details — includes naics_code, mcc_code, industry
  GET /businesses/customers/{customerID} — external-facing, exposes naics_title, mcc_code, industry
```

---

## 4. Winning Source Selection Rules

Multiple vendors can all return a NAICS code. The Fact Engine (`integration-service/lib/facts/rules.ts`) picks one winner.

### Source Weights

| Source | Weight | How confidence is computed |
|---|---|---|
| Middesk | 1.0 | 0.15 base + 0.2 per successful verification task |
| OpenCorporates | 0.9 | match_index / 55 |
| ZoomInfo | 0.8 | match_index / 55 |
| Verdata / SERP | 0.8 | (name_score + address_score) / 2 |
| Trulioo | 0.8 | confidence model output |
| Equifax | 0.7 | AI prediction confidence OR match_index / 55 |
| AI Enrichment (GPT-4o-mini) | variable | HIGH / MEDIUM / LOW → numeric |

### Selection Algorithm

```
1. factWithHighestConfidence()
   → Sort all sources by their confidence score (0–1)
   → The source with the highest confidence wins

2. WEIGHT_THRESHOLD = 0.05
   → If two sources are within 5% confidence of each other:
      → factWithHighestWeight() uses source weight (Middesk > OC > ZI…)
      → Higher weight breaks the tie

3. manualOverride()
   → If an analyst has manually set the fact via the override API
     (GET/PATCH /facts/business/{id}/override/{factName})
   → Override always wins, regardless of source confidence

4. If no source meets a minimum threshold:
   → The highest-ranked available source is still used
   → No "blank" fallback — the system always returns something
   → The AI enrichment (GPT-4o-mini) acts as a final fallback:
     calls aiNaicsEnrichment.ts → returns 6-digit NAICS + MCC + confidence
     Fallback code if AI also fails: 561499 (All Other Business Support Services)

5. Geographic exclusions:
   → Equifax is NOT used for UK, Canada, or Ireland companies
   → canada_open (OC Canada) is NOT used for US, UK, or Ireland
   → ZoomInfo and OpenCorporates run for all regions
```

### What the Winning Source Record Looks Like

Every fact returned by the API includes:
```json
{
  "name": "naics_code",
  "value": "722511",
  "source": {
    "confidence": 0.85,
    "platformId": 17
  },
  "override": null,
  "alternatives": [
    { "value": "722513", "source": 16, "confidence": 0.72 },
    { "value": "722515", "source": 24, "confidence": 0.60 }
  ]
}
```

- `value` — the winning answer
- `source.confidence` — how confident the winning source was (0–1)
- `source.platformId` — which platform won (17 = ZoomInfo, 16 = Middesk, 23 = OpenCorporates, 24 = Equifax, etc.)
- `alternatives[]` — what other sources said (ordered by confidence)

---

## 5. The 8 Classification Facts — What Each One Contains

### `industry`
- **What it is:** High-level industry category label (free text)
- **Where it comes from:** OpenCorporates `industry_code_uids`, ZoomInfo SIC/NAICS mapped to label, or SERP AI scrape
- **Example value:** `"Food Service"` or `"Technology - Software"`
- **Stored in:** `facts` table, `data_businesses.industry`

---

### `naics_code`
- **What it is:** The 6-digit NAICS 2022 code identifying the company's primary business activity
- **Where it comes from:** Vendor with highest confidence — ZoomInfo `zi_c_naics6`, Equifax `efx_primnaicscode`, Middesk SIC→NAICS crosswalk, or GPT-4o-mini AI enrichment
- **Example value:** `"722511"` (Full-Service Restaurants)
- **Stored in:** `facts` table (`name = "naics_code"`), `data_businesses.naics_code` (FK to `core_naics_code.id`)
- **JSONB payload:**
  ```json
  { "code": "722511", "description": "Full-Service Restaurants" }
  ```

---

### `naics_description`
- **What it is:** Human-readable label for the winning NAICS code
- **Where it comes from:** Looked up from `core_naics_code` table after `naics_code` is resolved
- **Example value:** `"Full-Service Restaurants"`
- **Stored in:** `facts` table or derived at query time from `core_naics_code`

---

### `classification_codes`
- **What it is:** All classification codes returned by all sources, before the winner is selected — the full multi-source picture
- **Where it comes from:** Aggregation across all vendor responses (NAICS, SIC, UK SIC, NACE all included)
- **Example value:**
  ```json
  [
    { "system": "NAICS", "code": "722511", "source": "ZoomInfo", "confidence": 0.85 },
    { "system": "SIC",   "code": "5812",   "source": "Equifax",  "confidence": 0.72 },
    { "system": "NAICS", "code": "722513", "source": "Middesk",  "confidence": 0.60 }
  ]
  ```
- **Why it matters:** This is the multi-source raw view before the Fact Engine picks a winner. Useful for auditing disagreements.

---

### `mcc_code`
- **What it is:** 4-digit Merchant Category Code — used by payment processors (Visa/Mastercard) to categorize a business for interchange and fraud rules
- **Where it comes from:** Either directly from a source that returns MCC, or derived from `naics_code` via the `rel_naics_mcc` crosswalk table, or from GPT-4o-mini AI enrichment
- **Example value:** `"5812"` (Eating Places, Restaurants)
- **Stored in:** `facts` table, `data_businesses.mcc_code` (FK to `core_mcc_code.id`)

---

### `mcc_code_found`
- **What it is:** Boolean — was an MCC code found from a direct source (not derived)?
- **Example value:** `true` if ZoomInfo or Equifax directly returned an MCC; `false` if it was derived from NAICS
- **Why it matters:** A directly found MCC is more reliable than one derived via crosswalk

---

### `mcc_code_from_naics`
- **What it is:** The MCC code derived from the winning NAICS code via the `rel_naics_mcc` relationship table
- **Why it exists:** Many vendors return NAICS but not MCC. This fact bridges the gap by looking up the NAICS → MCC mapping from `core_naics_mcc_code`.
- **Example:** NAICS `722511` → MCC `5812` (Eating Places, Restaurants)
- **Used when:** `mcc_code_found = false` — the direct MCC was not available

---

### `mcc_description`
- **What it is:** Human-readable label for the MCC code
- **Where it comes from:** Looked up from `core_mcc_code` table
- **Example value:** `"Eating Places, Restaurants"`

---

## 6. AI Enrichment — GPT-4o-mini as a Safety Net

When vendor sources have low confidence or disagree significantly, `aiNaicsEnrichment.ts` kicks in:

```
Input:  business name, address, website SERP summary
Model:  GPT-4o-mini (OpenAI)
Output:
  - 6-digit NAICS code
  - MCC code
  - confidence: "HIGH" | "MEDIUM" | "LOW"
  - reasoning (why this code was chosen)

Fallback: If AI also cannot determine the code → NAICS 561499
          (All Other Business Support Services)
```

The AI result is treated as one more source with a weight — it participates in the same winning source selection as other vendors.

---

## 7. Where Classification Facts Appear to Customers

### Internal APIs (integration-service)
```
GET /facts/business/{businessId}/details
  → includes: industry, naics_code, mcc_code, classification_codes

GET /facts/business/{businessId}/all
  → all 217 facts (admin only)

GET /facts/business/{businessId}/kyb
  → KYB facts including classification

PATCH /facts/business/{businessId}/override/{factName}
  → Analyst manually overrides naics_code, mcc_code, etc.
```

### External APIs (case-service)
```
GET /businesses/customers/{customerID}
  → exposes: naics_code, naics_title, mcc_code, industry

Worth 360 Report
  → naics_code and industry appear in the PDF report
```

### Redshift (direct query)
```sql
-- All classification facts for a business
SELECT name, value, received_at
FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>'
  AND name IN ('naics_code','mcc_code','industry',
               'classification_codes','mcc_description',
               'naics_description','mcc_code_found','mcc_code_from_naics');

-- NAICS lookup
SELECT code, description
FROM dev.rds_cases_public.core_naics_code
WHERE code = '722511';

-- Business-level denormalized
SELECT naics_code, mcc_code, industry
FROM dev.rds_cases_public.data_businesses
WHERE id = '<uuid>';
```

---

## 8. One-Page Summary

```
Business submitted
      │
      ▼
Vendor API calls: ZoomInfo, Equifax, OpenCorporates, Middesk, Trulioo, SERP
      │
      ▼
Each vendor returns: industry code + confidence score
      │
      ▼
Fact Engine (integration-service/lib/facts/rules.ts):
  → factWithHighestConfidence() picks the winner
  → If tie within 5%: factWithHighestWeight() uses source weight
  → manualOverride() wins if analyst has set it
  → AI (GPT-4o-mini) is fallback; code 561499 is last resort
      │
      ▼
8 classification facts produced:
  naics_code           → 6-digit NAICS (winner's code)
  naics_description    → label for that NAICS
  mcc_code             → 4-digit MCC (direct or from NAICS crosswalk)
  mcc_description      → label for that MCC
  mcc_code_found       → was MCC found directly (not derived)?
  mcc_code_from_naics  → MCC derived via NAICS→MCC table
  industry             → high-level label
  classification_codes → all sources, all codes, pre-winner selection
      │
      ▼
Kafka (facts.v1 topic) → warehouse-service upserts into:
  rds_warehouse_public.facts      (JSONB key-value, all 217 facts)
  rds_cases_public.data_businesses (denormalized columns)
      │
      ▼
Available via:
  REST API  → GET /facts/business/{id}/details
  Redshift  → SELECT FROM dev.rds_warehouse_public.facts
  Worth 360 Report → naics_code + industry in PDF
```
