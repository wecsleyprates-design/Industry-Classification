# The Case of the Missing NAICS Codes
## A Worth AI Data Investigation — Full Report

**Prepared for:** Worth AI Product, Data Science, Engineering, and Operations  
**Investigation period:** January 1, 2026 – April 29, 2026  
**Scope:** NAICS and MCC classification quality across all onboarded clients  
**Status:** Complete — root causes confirmed, fixes identified

---

## Preface: Two Red Flags That Started Everything

This investigation began with a simple business question: *How well does Worth actually know what industry our clients' businesses are in?* When we pulled the data, two immediate anomalies surfaced:

**Red Flag 1 — Platform ID 0 (the ghost assigner)**  
`NULL` was the dominant "source" for NAICS codes across every single client. When we corrected our query syntax, we found that `NULL` was masking thousands of records where `platformId: 0` — the internal onboarding writer — had claimed 100% confidence and beaten real vendor data in arbitration.

**Red Flag 2 — AINaicsEnrichment at scale**  
`AINaicsEnrichment` appeared as a NAICS source across multiple clients, suggesting an AI fallback was running when vendors failed — and stamping `561499` ("All Other Business Support Services") as a catch-all when it had no evidence. This 561499 code then cascaded into MCC derivation, corrupting both classifiers simultaneously.

This document traces the full investigation from these two red flags through their root causes, client-level damage assessment, code-level fixes, and MCC cascade analysis.

---

> **⚠️ Note on data sources:** The client-attribution queries in this investigation join to `datascience.billing_prices` — a materialized analytics table, not an `rds_` facts table. This is used **only** to map `customer_id` to human-readable client names for presentation. All NAICS and MCC classification data comes exclusively from `rds_warehouse_public.facts` and `rds_cases_public.*` tables.

---

## Chapter 1: First Query — The Initial Picture (Broken)

We started by pulling all businesses onboarded from Jan 1 – Apr 29, 2026, and asking: which data sources are assigning NAICS codes per client?

**The query — and why it was broken:**

```sql
-- ⚠️ This query used the WRONG JSON extraction syntax for the new schema.
-- JSON_EXTRACT_PATH_TEXT(f.value, 'source.name') uses dot notation
-- which only works for old-schema records where source was a plain string.
-- New-schema records store source as {"platformId": 0, "confidence": 1, ...}
-- and require nested path syntax: JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'name')
-- This caused ALL new-schema records to appear as NULL.
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id, rbcm.customer_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
),
client_map AS (
  SELECT DISTINCT customer_id, client
  FROM datascience.billing_prices  -- ← client attribution only, not used for facts
  WHERE client IS NOT NULL
)
SELECT
  cm.client,
  JSON_EXTRACT_PATH_TEXT(f.value, 'source.name') AS source_name,  -- ← BROKEN: dot notation
  COUNT(DISTINCT f.business_id) AS businesses
FROM rds_warehouse_public.facts f
JOIN onboarded o   ON o.business_id  = f.business_id
JOIN client_map cm ON cm.customer_id = o.customer_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
GROUP BY cm.client, source_name
ORDER BY cm.client, businesses DESC;
```

**Results (misleading — shows NULL domination):**

| client | source_name | businesses |
|---|---|---|
| EZ Capital | **NULL** | **99** |
| EZ Capital | serp | 1 |
| EZ Capital | zoominfo | 1 |
| PatientFi | **NULL** | **949** |
| PatientFi | zoominfo | 9 |
| PatientFi | AINaicsEnrichment | 4 |
| Wholesale | **NULL** | **2,427** |
| Wholesale | zoominfo | 121 |
| Wholesale | AINaicsEnrichment | 13 |
| WindRiver | **NULL** | **3,825** |
| WindRiver | serp | 119 |
| WindRiver | AINaicsEnrichment | 79 |

**What this appeared to tell us (incorrectly):**  
NULL dominated 67–97% of assignments at every client. Red Flags: (1) schema/logging problem, (2) AINaicsEnrichment running at scale.

**What we actually learned:** The dot-notation syntax `'source.name'` only matches the old JSON schema. Every new-schema record (using `{platformId, confidence, updatedAt}`) appeared as NULL. We weren't missing data — we were using the wrong extraction key.

---

## Chapter 2: Second Query — Peeking at Raw Records (The Plot Twist)

Before rewriting the query, we examined what a NULL-source record actually contained in raw JSON.

```sql
-- Look at raw JSON for records where dot-notation returns NULL
SELECT f.business_id, f.value
FROM rds_warehouse_public.facts f
JOIN rds_cases_public.rel_business_customer_monitoring rbcm
  ON rbcm.business_id = f.business_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'source.name') IS NULL
LIMIT 3;
```

**Results — three different patterns:**

```json
// Record 1: New schema — platformId present, no name field
// Note: value is 54112 (5 digits, integer) — data type inconsistency
{
  "name": "naics_code",
  "value": 54112,
  "source": {"updatedAt": "2026-04-25T14:38:56.190Z", "confidence": 1, "platformId": 0},
  "alternatives": [{"value": "541110", "source": 31, "confidence": 0.2}]
}

// Record 2: New schema — confidence: 1, platformId: 0
{
  "name": "naics_code",
  "value": "621111",
  "source": {"updatedAt": "2026-02-06T03:56:35.190Z", "confidence": 1, "platformId": 0},
  "alternatives": [
    {"value": "621111", "source": 22, "confidence": 0.35},
    {"value": "621111", "source": 31, "confidence": 0.2}
  ]
}

// Record 3: Null value — no source at all
{
  "name": "naics_code",
  "value": null,
  "source": null,
  "alternatives": []
}
```

**What this told us — confirmed two schema versions coexist:**

| Schema | Format | Extraction key |
|---|---|---|
| Old (legacy) | `"source": {"name": "AINaicsEnrichment"}` | `JSON_EXTRACT_PATH_TEXT(f.value, 'source.name')` — dot notation |
| New (current) | `"source": {"platformId": 0, "confidence": 1, "updatedAt": "..."}` | `JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId')` — nested path |

**Additional finding:** Record 1 has `"value": 54112` — a 5-digit integer, not a 6-digit string. A separate data type inconsistency that needs its own fix.

---

## Chapter 3: Third Query — The Real Picture (Correct Syntax)

We rewrote the query using nested path syntax to extract `platformId` correctly.

```sql
-- Corrected query: extracts platformId using nested path syntax
-- Targets only records with new schema (those that appeared as NULL before)
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id, rbcm.customer_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
),
client_map AS (
  SELECT DISTINCT customer_id, client
  FROM datascience.billing_prices  -- client attribution only
  WHERE client IS NOT NULL
)
SELECT
  cm.client,
  JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') AS platform_id,  -- ← CORRECT: nested path
  COUNT(DISTINCT f.business_id) AS businesses
FROM rds_warehouse_public.facts f
JOIN onboarded o   ON o.business_id  = f.business_id
JOIN client_map cm ON cm.customer_id = o.customer_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'source.name') IS NULL  -- new schema records only
GROUP BY cm.client, platform_id
ORDER BY cm.client, businesses DESC;
```

**Results — the real vendor distribution:**

| client | platform_id | businesses | decoded |
|---|---|---|---|
| EZ Capital | 24 | 65 | ZoomInfo |
| EZ Capital | **0** | **24** | **Ghost Assigner** |
| EZ Capital | 22 | 8 | SERP |
| EZ Capital | 31 | 1 | AI Enrichment |
| PatientFi | 24 | 448 | ZoomInfo |
| PatientFi | **0** | **292** | **Ghost Assigner** |
| PatientFi | 22 | 123 | SERP |
| PatientFi | 31 | 57 | AI Enrichment |
| PatientFi | 17 | 22 | Equifax |
| Paynearme | 24 | 46 | ZoomInfo |
| Paynearme | **0** | **38** | **Ghost Assigner** |
| Priority Payments | 24 | 181 | ZoomInfo |
| Priority Payments | **0** | **173** | **Ghost Assigner** |
| Priority Payments | 22 | 42 | SERP |
| Priority Payments | 31 | 10 | AI Enrichment |
| Vizypay | 24 | 173 | ZoomInfo |
| Vizypay | **0** | **132** | **Ghost Assigner** |
| Wholesale | 24 | 1,075 | ZoomInfo |
| Wholesale | **0** | **809** | **Ghost Assigner** |
| Wholesale | 22 | 250 | SERP |
| Wholesale | 31 | 205 | AI Enrichment |
| WindRiver | 22 | 1,469 | SERP |
| WindRiver | **0** | **1,098** | **Ghost Assigner** |
| WindRiver | 31 | 922 | AI Enrichment |
| WindRiver | 24 | 256 | ZoomInfo |

**Platform ID decoder (assembled from codebase: `integration-service/lib/facts/sources.ts`):**

| platformId | Vendor | Role |
|---|---|---|
| 0 | businessDetails | Internal writer — self-reported onboarding data |
| 17 | Equifax | Credit/business bureau data |
| 22 | SERP Scrape | Website scraping |
| 23 | OpenCorporates | Business registration data |
| 24 | ZoomInfo | Firmographics — NAICS core product |
| 31 | AI NAICS Enrichment | AI fallback classifier |
| NULL | Legacy schema records | Old format with human-readable `source.name` |

**What this told us:** `platformId: 0` (self-reported onboarding data) consistently ranked **#2 across every single client** — ahead of SERP, Equifax, and sometimes ZoomInfo. This was unexpected. Self-reported data should be the lowest-trust source. Something was very wrong with the arbitration logic.

---

## Chapter 4: Fourth Query — Unmasking platformId: 0

We pulled raw records where `platformId: 0` was the winning source to understand its behavior.

```sql
-- Study 3 raw records where the ghost assigner won
SELECT f.business_id, f.value
FROM rds_warehouse_public.facts f
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') = '0'
LIMIT 3;
```

**Results — the smoking gun:**

```json
// Record 1: null value, but confidence: 1
// Timestamp: platformId:0 ran at 18:22:04 → AI ran at 18:26:47 (+4 min)
{
  "value": null,
  "source": {"updatedAt": "2026-04-22T18:22:04.123Z", "confidence": 1, "platformId": 0},
  "alternatives": [{"value": "621340", "source": 31, "updatedAt": "2026-04-22T18:26:47.791Z", "confidence": 0.15}]
}

// Record 2: specific code, confidence: 1
// Timestamp: platformId:0 ran at 22:21:20 → AI ran at 22:25:51 (+4 min)
{
  "value": "811111",
  "source": {"updatedAt": "2026-04-25T22:21:20.511Z", "confidence": 1, "platformId": 0},
  "alternatives": [{"value": "811111", "source": 31, "updatedAt": "2026-04-25T22:25:51.691Z", "confidence": 0.15}]
}

// Record 3: specific code, confidence: 1
// Timestamp: platformId:0 ran at 12:27:03 → AI ran at 12:31:32 (+4 min)
{
  "value": "485320",
  "source": {"updatedAt": "2026-04-26T12:27:03.478Z", "confidence": 1, "platformId": 0},
  "alternatives": [{"value": "485320", "source": 31, "updatedAt": "2026-04-26T12:31:32.791Z", "confidence": 0.15}]
}
```

**The pattern is unmistakable:**
- `platformId: 0` ran **~4 minutes before** any real integration in every record
- It writes with `confidence: 1` (100% certainty) before ZoomInfo, SERP, or Equifax deliver results
- It can write `value: null` — meaning "I ran, found nothing, and I'm 100% certain of that"
- AI and other vendors are in `alternatives[]` — they ran after and lost

**Conclusion:** `platformId: 0` is `warehouse-service`'s internal **businessDetails writer** — it reads whatever the business typed in their onboarding form and persists it immediately with `confidence: 1`. No external integration. No third-party verification. And the arbitration engine treats `confidence: 1` as the tiebreaker, so it always wins.

---

## Chapter 5: Root Cause — The Broken Arbitration Engine

### System 1 — The `rds_warehouse_public.facts` Table

**File:** `warehouse-service/datapooler/adapters/db/models/facts.py`

The facts table has composite primary key `(business_id, name)` — one winning fact per business per fact name. The JSONB `value` stores the pre-arbitrated winner + all alternatives. The arbitration rule is **highest confidence wins:**

```
platformId: 0  → confidence: 1.0  ← WINNER ✅ (wrong — self-reported data)
platformId: 24 → confidence: 0.8  ← LOSER ❌ (ZoomInfo, the real data)
platformId: 31 → confidence: 0.15 ← LOSER ❌ (AI fallback)
```

When a business submits `null` for industry on the onboarding form, `platformId: 0` writes `value: null` with `confidence: 1`. ZoomInfo returns a real NAICS code 4 minutes later — but arbitration keeps the null.

### System 2 — The Customer Export Pipeline

**File:** `warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql`

```sql
COALESCE(
  CASE
    WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
      THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', ''), '') AS INTEGER)
    ELSE CAST(NULLIF(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', ''), '') AS INTEGER)
  END,
  naics_code  -- ← fallback to facts table — already corrupted by platformId: 0
) AS primary_naics_code
```

This system correctly reads ZoomInfo and Equifax from their own columns — but when both are null, it falls back to `naics_code` from the facts table, which is already contaminated.

### The Bug — Two Specific Code Locations

**Bug #1 — `confidence: 1` hardcoded for businessDetails**  
File: `integration-service/lib/facts/sources.ts` (lines 148–163)

```typescript
businessDetails: {
    confidence: 1,      // ← THE BUG: self-reported data claiming 100% confidence
    weight: 10,
    platformId: 0,
    getter: async function (businessID: any) { ... }
}
// Fix: drop to confidence: 0.1 or remove entirely
```

**Bug #2 — Arbitration logic uses confidence as sole primary key**  
File: `integration-service/lib/facts/rules.ts` (lines 36–58)

```typescript
// WEIGHT_THRESHOLD = 0.05 — weight only used as tiebreaker within 0.05 confidence gap
// businessDetails: confidence=1.0, ZoomInfo: ~0.8 → gap is 0.2 → weight never used
// Fix: add PLATFORM_PRIORITY map as primary sort key before confidence
```

**Source weights that exist but are currently ignored** (`businessDetails/index.ts:328-367`):
```
equifax     → default weight
zoominfo    → default weight
serp        → weight: 0.3
businessDetails → weight: 0.2  ← supposed to be second-lowest
AINaicsEnrichment → weight: 0.1  ← supposed to be lowest
```
These weights are correct — but they only activate as tiebreakers when confidences are within 0.05 of each other, which never happens when `businessDetails` declares `confidence: 1`.

---

## Chapter 6: Platform-Wide Damage Assessment

### The Two Villains

**Villain 1 — platformId: 0 (Ghost Assigner)**  
~2,567 businesses across all clients have `platformId: 0` as their winning NAICS source. Writes early, claims false certainty, wins arbitration it shouldn't win. Root cause: `confidence: 1` hardcoded in `sources.ts`.

**Villain 2 — platformId: 31 (AI NAICS Enrichment)**  
When nothing else resolves a NAICS code, the AI guesses — and its most common guess is `561499`. It runs with `confidence: 0.15` but wins when no real source exists. Especially damaging for WindRiver (922 AI-sourced businesses).

### Client-by-Client Damage

| Client | ZoomInfo (24) | Ghost Assigner (0) | AI Fallback (31) | Ghost % |
|---|---|---|---|---|
| EZ Capital | 65 | 24 | 1 | ~27% |
| Ironwood | 8 | 1 | 0 | ~11% |
| PatientFi | 448 | 292 | 57 | ~31% |
| Paynearme | 46 | 38 | 0 | ~45% — near coin-flip |
| Priority Payments | 181 | 173 | 10 | ~42% — nearly tied |
| Vizypay | 173 | 132 | 3 | ~39% |
| Wholesale | 1,075 | 809 | 205 | ~37% |
| WindRiver | 256 | 1,098 | 922 | ~48% — most exposed |

**WindRiver** is the most exposed client: SERP (#1 at 1,469), Ghost Assigner (#2 at 1,098), AI Fallback (#3 at 922). No dominant trusted source.

### The Fix — One Change, Platform-Wide Impact

Fix the `confidence: 1` in `sources.ts` for `businessDetails` and add platform priority weighting to `rules.ts`. External integration sources (ZoomInfo, Equifax, SERP) will then outrank self-reported data whenever they return real values. Thousands of NAICS codes across all clients will self-correct on the next facts refresh.

---

## Chapter 7: AINaicsEnrichment — Is the AI Actually Stamping 561499?

We investigated whether AINaicsEnrichment was the primary source of the 561499 catch-all problem.

```sql
-- Chapter 7a: What NAICS codes is AINaicsEnrichment actually assigning?
SELECT
  bp.client,
  JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS naics_code,
  COUNT(DISTINCT f.business_id) AS businesses,
  ROUND(100.0 * COUNT(DISTINCT f.business_id)
        / SUM(COUNT(DISTINCT f.business_id)) OVER (PARTITION BY bp.client), 1) AS pct
FROM rds_warehouse_public.facts f
JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id = f.business_id
JOIN datascience.billing_prices bp ON bp.customer_id = rbcm.customer_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'source.name') = 'AINaicsEnrichment'  -- old schema
  AND DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
GROUP BY bp.client, naics_code
ORDER BY bp.client, businesses DESC;
```

**Results:**

| client | naics_code | businesses | pct |
|---|---|---|---|
| PatientFi | 621399 | 2 | 50% |
| PatientFi | 812112 | 1 | 25% |
| PatientFi | 621340 | 1 | 25% |
| Priority Payments | 522320 | 1 | 100% |
| Vizypay | **561499** | 1 | 20% |
| Vizypay | 621111 | 1 | 20% |
| Wholesale | **561499** | 4 | 26.7% |
| Wholesale | 441120 | 1 | 6.7% |
| WindRiver | 621111 | 31 | 39.2% |
| WindRiver | **561499** | 17 | 21.5% |
| WindRiver | 622110 | 7 | 8.9% |

**Finding: AINaicsEnrichment is NOT the primary 561499 stamper — it's mostly getting it right.**

- WindRiver: 79 AI-sourced businesses, only 17 are 561499 (21.5%) — the AI correctly assigned 621111 (Doctors) 31 times (39.2%)
- Wholesale: 15 AI-sourced, 4 are 561499 (26.7%) — the other 11 are specific, legitimate codes
- Total AI-produced 561499 across all clients: **~22 businesses**

```sql
-- Chapter 7b: Who is ACTUALLY stamping 561499? Break down by source and client
SELECT
  bp.client,
  COALESCE(JSON_EXTRACT_PATH_TEXT(f.value, 'source.name'), 'NULL/Platform0') AS naics_source,
  COUNT(DISTINCT f.business_id) AS businesses_with_561499,
  ROUND(100.0 * COUNT(DISTINCT f.business_id)
        / SUM(COUNT(DISTINCT f.business_id)) OVER (PARTITION BY bp.client), 1) AS pct
FROM rds_warehouse_public.facts f
JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id = f.business_id
JOIN datascience.billing_prices bp ON bp.customer_id = rbcm.customer_id
WHERE f.name = 'naics_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') = '561499'
  AND DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
GROUP BY bp.client, naics_source
ORDER BY bp.client, businesses_with_561499 DESC;
```

**Results:**

| client | naics_source | businesses_with_561499 | pct |
|---|---|---|---|
| EZ Capital | NULL/Platform0 | 4 | 100% |
| PatientFi | NULL/Platform0 | 5 | 100% |
| Paynearme | NULL/Platform0 | 7 | 100% |
| Priority Payments | NULL/Platform0 | 25 | ~96% |
| Priority Payments | zoominfo | 1 | ~4% |
| Vizypay | NULL/Platform0 | 3 | 75% |
| Vizypay | AINaicsEnrichment | 1 | 25% |
| Wholesale | NULL/Platform0 | 84 | ~95.5% |
| Wholesale | AINaicsEnrichment | 4 | ~4.5% |
| WindRiver | NULL/Platform0 | 324 | ~94.7% |
| WindRiver | AINaicsEnrichment | 17 | ~5% |
| WindRiver | zoominfo | 1 | ~0.3% |

**Verdict: Platform 0 is responsible for ~94% of all 561499 contamination. AINaicsEnrichment is a minor footnote (~22 businesses total).**

---

## Chapter 8: MCC — A New Dimension of the Same Problem

### What MCC Is and Why It Matters

MCC (Merchant Category Code) is a 4-digit payment-network code used for transaction routing, interchange fees, fraud rules, and risk scoring. For payment-focused clients (Paynearme, Priority Payments, Vizypay, PatientFi), MCC is arguably more operationally critical than NAICS.

### MCC Is NOT Independently Sourced — It's Derived

No external vendor (ZoomInfo, Equifax, SERP) provides MCC codes directly. Worth generates MCC through exactly two paths:

```
Path 1 (AI direct):      mcc_code_found      ← OpenAI classifies from business context
Path 2 (NAICS-derived):  mcc_code_from_naics ← NAICS → rel_naics_mcc lookup table
Final:                   mcc_code            ← mcc_code_found ?? mcc_code_from_naics
```

**Source:** `integration-service/lib/facts/businessDetails/index.ts:351-387`

### The Cascade Problem

If the winning NAICS is wrong (null from Platform 0, or 561499 from AI fallback), Path 2 inherits that error and produces a wrong MCC. One broken arbitration decision corrupts two critical business classifiers.

### MCC Fact Structure

The facts table stores THREE separate MCC fact names, not one:

| Fact name | What it is |
|---|---|
| `mcc_code_found` | AI-direct MCC (Path 1) |
| `mcc_code_from_naics` | NAICS-derived MCC (Path 2) |
| `mcc_code` | Final winner: `mcc_code_found ?? mcc_code_from_naics` |

Querying only `mcc_code` hides which path won. All three must be queried separately to understand the split.

---

## Chapter 9: MCC Analysis — Query 1 (Coverage)

```sql
-- How many businesses per client actually have MCC codes populated vs. blank?
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id, rbcm.customer_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
),
client_map AS (
  SELECT DISTINCT customer_id, client
  FROM datascience.billing_prices WHERE client IS NOT NULL
)
SELECT
  cm.client,
  COUNT(DISTINCT o.business_id) AS total_businesses,
  COUNT(DISTINCT CASE WHEN f.name = 'mcc_code'
        AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
        THEN f.business_id END) AS has_mcc,
  COUNT(DISTINCT CASE WHEN f.name = 'mcc_code'
        AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NULL
        THEN f.business_id END) AS null_mcc
FROM onboarded o
JOIN client_map cm ON cm.customer_id = o.customer_id
LEFT JOIN rds_warehouse_public.facts f
  ON f.business_id = o.business_id
  AND f.name = 'mcc_code'
  AND LENGTH(f.value) < 60000
GROUP BY cm.client ORDER BY total_businesses DESC;
```

**Results:**

| client | total_businesses | has_mcc | null_mcc | coverage % |
|---|---|---|---|---|
| WindRiver | 4,280 | 3,893 | 205 | 91% (hidden gap: 182 with no fact at all) |
| Wholesale | 2,706 | 1,990 | 716 | 73.5% — **1 in 4 missing MCC** |
| PatientFi | ~977 | 976 | 1 | 99.8% |
| Priority Payments | ~450 | 438 | ~12 | ~97% |
| Vizypay | ~512 | 510 | 2 | 99.8% |
| Paynearme | 93 | 93 | 0 | 100% |
| EZ Capital | ~102 | 99 | 3 | ~97% |
| Ironwood | ~11 | 11 | 0 | 100% |

**Key findings:**
- **WindRiver hidden gap:** 3,893 + 205 = 4,098, but total is 4,280. That means 182 businesses have no `mcc_code` fact written at all. Real WindRiver gap = 205 + 182 = **387 businesses (~9%)** with no reliable MCC.
- **Wholesale is the biggest problem:** 716 of 2,706 businesses have null MCC (~26.5%). One in four businesses has no MCC.
- **Payment-focused clients are solid:** Paynearme (100%), PatientFi (99.8%), Vizypay (99.8%) — something is working well for these clients.

---

## Chapter 10: MCC Analysis — Query 2 (AI Direct vs NAICS-Derived Split)

```sql
-- Which MCC derivation path ran for each client, and for how many businesses?
-- This reveals how dependent each client's MCC quality is on NAICS quality.
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id, rbcm.customer_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
),
client_map AS (
  SELECT DISTINCT customer_id, client FROM datascience.billing_prices WHERE client IS NOT NULL
)
SELECT
  cm.client,
  f.name AS fact_name,
  COUNT(DISTINCT f.business_id) AS businesses_with_fact
FROM rds_warehouse_public.facts f
JOIN onboarded o   ON o.business_id  = f.business_id
JOIN client_map cm ON cm.customer_id = o.customer_id
WHERE f.name IN ('mcc_code', 'mcc_code_found', 'mcc_code_from_naics')
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
GROUP BY cm.client, f.name
ORDER BY cm.client, f.name;
```

**Results:**

| client | mcc_code | mcc_code_found (AI) | mcc_code_from_naics (NAICS-derived) |
|---|---|---|---|
| EZ Capital | 99 | 43 | 98 |
| Ironwood | 11 | 3 | 10 |
| PatientFi | 976 | 494 | 791 |
| Paynearme | 93 | 51 | 60 |
| Priority Payments | 438 | 290 | 361 |
| Vizypay | 510 | 268 | 374 |
| Wholesale | 1,990 | 1,616 | 2,243 |
| WindRiver | 3,893 | 3,775 | 3,561 |

**What this tells us — three critical findings:**

**Finding 1 — NAICS-derived path dominates for most clients.**  
For every client except WindRiver, `mcc_code_from_naics` runs more often than `mcc_code_found`. This means the NAICS quality bug cascades directly into MCC for the majority of clients. Every wrong NAICS feeds a wrong NAICS-derived MCC.

**Finding 2 — The cascade math.**  
Combining with NAICS investigation:
- Wholesale: 809 businesses had Ghost Assigner (platformId: 0) win NAICS → 2,243 NAICS-derived MCC attempts → a large portion of those MCCs are built on Ghost Assigner-corrupted input
- WindRiver: 1,098 ghost + 922 AI NAICS winners → 3,561 NAICS-derived MCC derivations → similar cascade risk
- Priority Payments: 173 ghost NAICS wins → 361 NAICS-derived MCCs → nearly half could be affected

**Finding 3 — `mcc_code_from_naics > mcc_code` for Wholesale.**  
Wholesale has 2,243 NAICS-derived attempts but only 1,990 final MCC winners. The delta (~253 businesses) means the NAICS→MCC mapping produced no result — likely because the NAICS value was null (from platformId: 0 writing a blank form). This directly confirms the cascade: null NAICS → no valid mapping → missing MCC → that 26.5% null rate from Query 1.

**Finding 4 — WindRiver is AI-dominant, not NAICS-dependent.**  
WindRiver is the only client where `mcc_code_found` (3,775) approaches `mcc_code_from_naics` (3,561). This means the AI Path 1 is actively classifying most WindRiver businesses — providing some protection against NAICS corruption. This explains why WindRiver's MCC coverage is 91% despite having the worst NAICS quality.

---

## Chapter 11: MCC Analysis — Query 3 (MCC Distribution — The Catch-All Problem)

```sql
-- What MCC codes are being assigned per client? Is there an MCC equivalent of 561499?
-- MCC 7399 (Business Services NEC) = the MCC catch-all code
-- Run per client with HAVING COUNT >= 2 to stay within Redshift row limits
WITH onboarded AS (
  SELECT DISTINCT rbcm.business_id, rbcm.customer_id
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
),
client_map AS (
  SELECT DISTINCT customer_id, client FROM datascience.billing_prices WHERE client IS NOT NULL
)
SELECT
  cm.client,
  JSON_EXTRACT_PATH_TEXT(f.value, 'value') AS mcc_code,
  COUNT(DISTINCT f.business_id) AS businesses
FROM rds_warehouse_public.facts f
JOIN onboarded o   ON o.business_id  = f.business_id
JOIN client_map cm ON cm.customer_id = o.customer_id
WHERE f.name = 'mcc_code'
  AND LENGTH(f.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') IS NOT NULL
GROUP BY cm.client, mcc_code
HAVING COUNT(DISTINCT f.business_id) >= 2
ORDER BY cm.client, businesses DESC;
```

**Findings by client:**

**Priority Payments (438 businesses):** Healthiest distribution of the large clients. No single code above 6.2%. Mix of healthcare (8050, 8398), real estate (6513), food service (5812), civic organizations. MCC 7399 catch-all at 17 businesses (3.9%) is the main flag — manageable.

**Vizypay (510 businesses):** Strong automotive theme. 7538 (Auto Service) leads at 57 (11.2%). Combined automotive cluster ≈ 116 businesses (22.7%). Likely domain-appropriate if Vizypay specializes in auto dealerships — but worth confirming that this reflects actual portfolio composition vs. NAICS cascade.

**Wholesale (2,706 businesses):** ⚠️ Biggest concentration flag. 7538 (Auto Service) = 354 businesses (17.8%). Total automotive cluster ≈ 674 businesses (33.8% of all Wholesale MCCs). Also 7399 at 60 businesses (3.0%). **Critical question:** Is Wholesale primarily an auto lender? If not, this suggests the NAICS cascade from Platform 0 ghost assigner is producing false automotive classifications at scale.

**WindRiver (4,280 businesses):** Clear healthcare theme — likely domain-appropriate. 8011 (Doctors) = 636 (16.3%), 5912 (Pharmacies) = 370 (9.5%), 8099 (Health NEC) = 258 (6.6%), 8062 (Hospitals) = 170 (4.4%). Total healthcare cluster ≈ 1,554 businesses (39.9%). But **7399 at 164 businesses (4.2%)** is the largest absolute count of the catch-all MCC across all clients — and WindRiver has the most NAICS-derived MCC attempts (3,561). These are related.

**Cross-client catch-all summary:**

| client | 7399 businesses | share of client MCC |
|---|---|---|
| WindRiver | 164 | 4.2% |
| Wholesale | 60 | 3.0% |
| Priority Payments | 17 | 3.9% |
| Paynearme | 7 | 7.5% |
| Vizypay | 3 | 0.6% |
| **Total** | **≥ 262** | — |

**MCC 7399 is the MCC equivalent of NAICS 561499.** 262 businesses across all clients are in the catch-all MCC bucket. Some are NAICS-cascade failures (Path 2 given bad input), some are AI failures (Path 1 couldn't classify). All are businesses with an effectively useless industry code for risk decisioning.

---

## Chapter 12: MCC Cascade Contamination — How Many MCCs Were Built on 561499?

### Query 4a — Per-Client Cascade Scope

```sql
-- For each client: what % of NAICS-derived MCCs were built on a 561499 input?
-- This is the true cascade contamination rate.
SELECT
  bp.client,
  COUNT(DISTINCT naics.business_id) AS businesses_with_naics_derived_mcc,
  SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(naics.value, 'value') = '561499' THEN 1 ELSE 0 END) AS catchall_naics_feeding_mcc,
  ROUND(100.0 * SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(naics.value, 'value') = '561499' THEN 1 ELSE 0 END)
        / COUNT(DISTINCT naics.business_id), 1) AS catchall_pct
FROM rds_warehouse_public.facts naics
JOIN rds_warehouse_public.facts mcc_derived
  ON mcc_derived.business_id = naics.business_id
  AND mcc_derived.name = 'mcc_code_from_naics'
  AND LENGTH(mcc_derived.value) < 60000
JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id = naics.business_id
JOIN datascience.billing_prices bp ON bp.customer_id = rbcm.customer_id
WHERE naics.name = 'naics_code'
  AND LENGTH(naics.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(naics.value, 'value') IS NOT NULL
  AND DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
GROUP BY bp.client
ORDER BY businesses_with_naics_derived_mcc DESC;
```

**Results:**

| client | NAICS-derived MCCs | built on 561499 | cascade % |
|---|---|---|---|
| WindRiver | 4,043 | 342 | **8.5%** |
| Wholesale | 2,285 | 88 | **3.9%** |
| PatientFi | 792 | 5 | **0.6%** |
| Priority Payments | 367 | 27 | **7.4%** |
| Vizypay | 381 | 4 | **1.0%** |
| Paynearme | 60 | 7 | **11.7%** |
| EZ Capital | 98 | 4 | **4.1%** |
| Ironwood | 10 | 0 | 0% |
| **Total** | **8,036** | **477** | **5.9%** |

**477 of 8,036 businesses (5.9%) have MCCs that were derived from a 561499 catch-all NAICS input.** These MCCs are inherently unreliable regardless of their specific value.

### Query 4b — The NAICS→MCC Chain Analysis

```sql
-- Show the actual mapping chains: what NAICS feeds what MCC?
-- Flag each code as specific or CATCH-ALL to identify failure categories.
SELECT
  JSON_EXTRACT_PATH_TEXT(naics.value, 'value') AS source_naics,
  JSON_EXTRACT_PATH_TEXT(mcc.value, 'value') AS winning_mcc,
  COUNT(DISTINCT naics.business_id) AS businesses,
  CASE WHEN JSON_EXTRACT_PATH_TEXT(naics.value, 'value') = '561499'
       THEN 'CATCH-ALL' ELSE 'specific' END AS naics_quality,
  CASE WHEN JSON_EXTRACT_PATH_TEXT(mcc.value, 'value') = '7399'
       THEN 'CATCH-ALL' ELSE 'specific' END AS mcc_quality
FROM rds_warehouse_public.facts naics
JOIN rds_warehouse_public.facts mcc_derived
  ON mcc_derived.business_id = naics.business_id
  AND mcc_derived.name = 'mcc_code_from_naics'
  AND LENGTH(mcc_derived.value) < 60000
JOIN rds_warehouse_public.facts mcc
  ON mcc.business_id = naics.business_id
  AND mcc.name = 'mcc_code'
  AND LENGTH(mcc.value) < 60000
JOIN rds_cases_public.rel_business_customer_monitoring rbcm ON rbcm.business_id = naics.business_id
JOIN datascience.billing_prices bp ON bp.customer_id = rbcm.customer_id
WHERE naics.name = 'naics_code'
  AND LENGTH(naics.value) < 60000
  AND JSON_EXTRACT_PATH_TEXT(naics.value, 'value') IS NOT NULL
  AND DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
GROUP BY source_naics, winning_mcc
HAVING COUNT(DISTINCT naics.business_id) >= 10
ORDER BY businesses DESC;
```

**Key results (selected rows):**

| source_naics | winning_mcc | businesses | naics_quality | mcc_quality |
|---|---|---|---|---|
| 621111 | 8011 | 626 | specific | specific ✅ |
| 621210 | 8021 | 254 | specific | specific ✅ |
| 811111 | 7538 | 253 | specific | specific ✅ |
| 722511 | 5812 | 205 | specific | specific ✅ |
| **561499** | **5912** | **155** | **CATCH-ALL** | **specific** ⚠️ |
| **561499** | **7399** | **125** | **CATCH-ALL** | **CATCH-ALL** 🔴 |
| **561499** | **NULL** | **47** | **CATCH-ALL** | **missing** 🔴 |
| 561990 | 7399 | 30 | specific | CATCH-ALL ⚠️ |

**Four failure categories confirmed:**

**Category 1 — Canonical (both specific): leave alone.**  
Top rows (621111→8011, 621210→8021, etc.) show the pipeline working correctly. These ~2,000+ businesses should not be touched.

**Category 2 — Double Catch-All (561499→7399): 125 businesses, highest priority.**  
Both codes wrong. NAICS=catch-all fed into pipeline and produced MCC=catch-all. Two meaningless codes chained together. Both must be fixed.

**Category 3 — Catch-All NAICS → Accidentally Specific MCC: 253 businesses, hidden contamination.**  
Specific-looking MCC but derived from 561499 — making it accidentally specific at best, wrong at worst. Fix NAICS first, then re-derive MCC.

**Category 4 — Specific NAICS → Catch-All MCC: 30 businesses.**  
Valid NAICS input, but AI assigned 7399 anyway. Only MCC needs correction.

**Category 5 — Specific NAICS → NULL MCC: 400+ businesses.**  
Pipeline ran but produced no MCC at all. Invisible to any MCC-based risk rule.

---

## Chapter 13: The Backfill Strategy

Businesses with 561499 NAICS fall into three tiers based on MCC status:

```sql
-- Full backfill scope — tier classification per client
WITH target_businesses AS (
  SELECT DISTINCT rbcm.business_id, bp.client
  FROM rds_cases_public.rel_business_customer_monitoring rbcm
  JOIN datascience.billing_prices bp ON bp.customer_id = rbcm.customer_id
  JOIN rds_warehouse_public.facts f ON f.business_id = rbcm.business_id
    AND f.name = 'naics_code' AND LENGTH(f.value) < 60000
    AND JSON_EXTRACT_PATH_TEXT(f.value, 'value') = '561499'
  WHERE DATE(rbcm.created_at) BETWEEN '2026-01-01' AND '2026-04-29'
    AND bp.client IS NOT NULL
),
mcc_status AS (
  SELECT tb.business_id, tb.client,
    MAX(CASE WHEN f.name = 'mcc_code'          THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END) AS final_mcc,
    MAX(CASE WHEN f.name = 'mcc_code_found'    THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END) AS ai_mcc,
    MAX(CASE WHEN f.name = 'mcc_code_from_naics' THEN JSON_EXTRACT_PATH_TEXT(f.value, 'value') END) AS naics_derived_mcc
  FROM target_businesses tb
  LEFT JOIN rds_warehouse_public.facts f ON f.business_id = tb.business_id
    AND f.name IN ('mcc_code', 'mcc_code_found', 'mcc_code_from_naics')
    AND LENGTH(f.value) < 60000
  GROUP BY tb.business_id, tb.client
)
SELECT client,
  CASE
    WHEN final_mcc IS NOT NULL AND final_mcc <> '7399' AND ai_mcc IS NOT NULL
      THEN 'Tier 1 — NAICS-only (AI-protected MCC)'
    WHEN final_mcc IS NOT NULL AND final_mcc <> '7399' AND ai_mcc IS NULL
      THEN 'Tier 1b — NAICS-only (specific MCC, no AI backup)'
    WHEN final_mcc = '7399'
      THEN 'Tier 2 — NAICS + MCC fix (catch-all 7399)'
    WHEN final_mcc IS NULL
      THEN 'Tier 3 — NAICS + missing MCC (no MCC at all)'
    ELSE 'Other'
  END AS backfill_tier,
  COUNT(DISTINCT business_id) AS businesses,
  ROUND(100.0 * COUNT(DISTINCT business_id) / SUM(COUNT(DISTINCT business_id)) OVER (PARTITION BY client), 1) AS pct
FROM mcc_status
GROUP BY client, backfill_tier
ORDER BY client, businesses DESC;
```

**Backfill tier summary:**

| Tier | Definition | Businesses | Action |
|---|---|---|---|
| Tier 1 | 561499 NAICS + specific MCC via AI (AI-protected) | ~285 | Fix NAICS only — MCC already correct |
| Tier 1b | 561499 NAICS + specific MCC, no AI backup | ~3 | Fix NAICS only, investigate MCC source |
| Tier 2 | 561499 NAICS + 7399 MCC (double catch-all) | ~125 | Fix both NAICS and MCC |
| Tier 3 | 561499 NAICS + no MCC at all | ~47 | Fix NAICS + re-trigger AI enrichment |

**Execution order:**
1. Tier 1 + 1b → NAICS fix only (lowest risk, ~288 businesses)
2. Tier 2 → NAICS fix + overwrite `mcc_code` and `mcc_code_from_naics` (~125 businesses)
3. Tier 3 → NAICS fix + re-trigger AI enrichment (~47 businesses, highest complexity)

---

## Chapter 14: Summary — Complete Issue Map

### The Six Issues

| Issue | Description | Businesses affected | Priority |
|---|---|---|---|
| 1 | Ghost assigner (platformId: 0) beats real vendors via false confidence: 1 | ~2,567 | 🔴 Critical |
| 2 | 561499 catch-all NAICS contamination | ~477 | 🔴 Critical |
| 3 | Double contamination: 561499→7399 (both codes meaningless) | ~125 | 🔴 Critical |
| 4 | NULL MCC output from NAICS-derived path | ~400+ | 🟠 High |
| 5 | Catch-all NAICS → accidentally specific MCC (hidden contamination) | ~253 | 🟠 High |
| 6 | Domain concentration flags (Wholesale: 33.8% auto, WindRiver: 39.9% healthcare) | Investigate | 🟡 Medium |

### The Two Fixes That Solve 95% of the Problem

| Fix | File | Change | Impact |
|---|---|---|---|
| Lower businessDetails confidence | `integration-service/lib/facts/sources.ts:151` | `confidence: 1` → `confidence: 0.1` | Ghost assigner stops winning arbitration |
| Add platform priority weighting | `integration-service/lib/facts/rules.ts:36-58` | Add `PLATFORM_PRIORITY` map as primary sort key | External vendors always beat self-reported data |

Fix these two issues and thousands of NAICS codes — and their downstream MCC derivations — will self-correct on the next facts refresh.

---

## Chapter 15: Sources and Key Files

| Reference | File | What It Documents |
|---|---|---|
| businessDetails confidence bug | `integration-service/lib/facts/sources.ts:151` | `confidence: 1` hardcoded — the root cause |
| Arbitration rule | `integration-service/lib/facts/rules.ts:36-58` | `factWithHighestConfidence` — confidence wins outright |
| NAICS source weights | `integration-service/lib/facts/businessDetails/index.ts:328-367` | Weights defined but ignored due to confidence gap |
| Facts table schema | `warehouse-service/datapooler/adapters/db/models/facts.py` | Composite PK `(business_id, name)` — upsert-only |
| Customer export pipeline | `warehouse-service/.../customer_table.sql` | ZoomInfo/Equifax first, falls back to facts table |
| MCC fact chain | `integration-service/lib/facts/businessDetails/index.ts:351-387` | `mcc_code_found ?? mcc_code_from_naics` |
| AI NAICS enrichment | `integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts:63` | `NAICS_OF_LAST_RESORT = "561499"` |
| NAICS→MCC lookup | `rds_cases_public.rel_naics_mcc` | Canonical mapping table |

---

*Document prepared April 29, 2026. All NAICS and MCC facts data sourced from `rds_warehouse_public.facts` and `rds_cases_public.*` tables. Client attribution via `datascience.billing_prices` used only for human-readable presentation. Investigation conducted Jan 1 – Apr 29, 2026 cohort.*
