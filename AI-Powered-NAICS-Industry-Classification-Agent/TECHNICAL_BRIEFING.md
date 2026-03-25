# Technical Briefing: Industry Classification
## Worth AI Current Pipeline vs. Global Consensus Engine

**Prepared for:** Engineering Team & Management  
**Date:** March 2026  
**Sources:** `SIC-UK-Codes` repo (integration-service, case-service, warehouse-service, `WORTH_INDUSTRY_CLASSIFICATION_REPORT.md`) + new Consensus Engine codebase

---

## Executive Summary

Worth AI currently classifies businesses using a **FactEngine** that aggregates NAICS codes from **seven sources** (six live vendors + one AI fallback), stores the winning code via a FK reference to `core_naics_code`, and derives an MCC from a join table. The pipeline works reliably for **US businesses** but has **four sequential gaps** that cause UK SIC 2007 codes to be silently discarded before they reach the database — meaning every non-US business either receives an inappropriate US NAICS code or has `naics_id = NULL`. There is **no `core_uk_sic_code` table**, no `uk_sic_id` column on `data_businesses`, and no Canadian NAICS storage — despite all three being present in vendor responses.

The new **Global Industry Classification Consensus Engine** addresses these gaps with a three-level XGBoost stacking ensemble that outputs **six taxonomy codes simultaneously**, assigns **calibrated probabilities** to each, surfaces **nine AML/KYB risk signals**, and supports **200+ jurisdictions** including every US state, Canadian province, and UAE emirate.

---

## Part 1 — The Worth AI Pipeline: How It Actually Works

### 1.1 Architecture

The pipeline is built inside `integration-service` using a **FactEngine** pattern. For each business, a set of **facts** (data points like `naics_code`, `industry`, `mcc_code`) are resolved by querying multiple vendor sources stored in `integration_data.request_response`, applying a confidence-weighted rule to select a winner, and persisting the result to `data_businesses` via a Kafka event.

```
Applicant submits onboarding form
        ↓
data_businesses row created (industry name sanitized against core_business_industries)
        ↓
Integration tasks triggered asynchronously:
  • fetch_business_entity_verification (Trulioo)
  • fetch_public_records (Equifax)
  • ZoomInfo API call
  • OpenCorporates API call
  • SERP scrape
        ↓
Raw JSON responses written to integration_data.request_response
  (one row per vendor per call, discriminated by platform_id)
        ↓
FactEngine runs when facts are requested (reports, scoring, Kafka consumers):
  • Each source's getter queries integration_data.request_response WHERE platform_id = X
  • fn() or path: extracts the candidate value from the raw JSONB response
  • Confidence computed per source (match quality, index score, etc.)
  • factWithHighestConfidence() selects the winner
  • weightedFactSelector() used when confidences are within 0.05 of each other
        ↓
Kafka UPDATE_NAICS_CODE event emitted:
  { business_id, naics_code, naics_title, platform, industry_code }
        ↓
handleNaicsData() resolves naics_id from core_naics_code, mcc_id from rel_naics_mcc
UPDATE data_businesses SET naics_id = X, mcc_id = Y
INSERT/UPDATE rel_business_industry_naics (per-platform audit row)
```

### 1.2 The Seven Sources — Complete Inventory

#### Source 1: Equifax (Batch / File — Internal Warehouse)

| Attribute | Value |
|-----------|-------|
| Source type | **Batch / file ingest** — offline warehouse pipeline |
| Internal or External | **Internal** (data pre-ingested into Redshift from Equifax files at unknown cadence) |
| Source weight | `0.7` — deliberately low because files may be days or weeks old |
| Platform ID | `17` (hardcoded) |

**Industry fields available in the raw response:**

| Field | Type | Used? |
|-------|------|-------|
| `primnaicscode` | 6-digit US NAICS | ✅ **USED** — mapped to `naics_code` fact via `path: "primnaicscode"` |
| `primnaics_sector`, `_subsector`, `_industry_group`, `_industry` | NAICS hierarchy labels | ⚠️ **SILENTLY DROPPED** — in `extended_attributes` SQL function but no TypeScript fact |
| `secnaics1`–`secnaics4` (each with full hierarchy) | Secondary NAICS codes × 4 | ⚠️ **SILENTLY DROPPED** — available in SQL function, not consumed by fact engine |
| `primsic` | 4-digit US SIC 1987 | ⚠️ **SILENTLY DROPPED** — present in `extended_attributes`, no fact defined, no column in `data_businesses` |
| `secsic1`–`secsic4` | Secondary SIC codes × 4 | ⚠️ **SILENTLY DROPPED** |

**Key finding:** Equifax provides a complete 5-level NAICS hierarchy (25 columns total via `integration_data.extended_attributes` SQL function) plus primary and four secondary SIC codes. The fact engine consumes **only `primnaicscode`**. 24 of 25 industry columns are discarded.

---

#### Source 2: ZoomInfo (Live API)

| Attribute | Value |
|-----------|-------|
| Source type | **Live API** |
| Internal or External | **External** — real-time API call |
| Source weight | `0.8` |

**Industry fields available:**

| Field | Used? |
|-------|-------|
| `firmographic.zi_c_naics6` — 6-digit US NAICS | ✅ **USED** |
| `firmographic.zi_c_sic4` — 4-digit US SIC | ⚠️ **SILENTLY DROPPED** — in raw response, no fact defined |

---

#### Source 3: OpenCorporates (Live API)

| Attribute | Value |
|-----------|-------|
| Source type | **Live API** — pulls from official government registries worldwide |
| Internal or External | **External** — real-time API call |
| Source weight | `0.9` — highest of all sources (authoritative government data) |

**Industry fields available:**

| Field | Used? |
|-------|-------|
| `firmographic.industry_code_uids` | Pipe-delimited `scheme-code` pairs, e.g. `"us_naics-541110\|uk_sic-62012\|ca_naics-541110"` | |
| `us_naics-XXXXXX` entries | ✅ **USED** — loop filters to `codeName.includes("us_naics")` |
| `uk_sic-XXXXX` entries | ⚠️ **SILENTLY DROPPED AT NAICS RESOLVER** — loop only passes `us_naics`; UK SIC is captured in `classification_codes` fact but has **no downstream consumer** |
| `ca_naics-XXXXXX` entries | ⚠️ **SILENTLY DROPPED** — same reason |
| `classification_codes` fact | All schemes as `Record<string, string>` | ⚠️ **DEAD CODE** — resolved but never consumed by reports, scoring, or persistence |

**This is the most critical gap:** OpenCorporates already returns `uk_sic-62012` for a UK company in the same API response. The data is in the database (`integration_data.request_response`). The `classification_codes` fact even captures it. But because there is no `core_uk_sic_code` reference table and no `uk_sic_id` column on `data_businesses`, the code is thrown away.

---

#### Source 4: Trulioo / "business" (Live API)

| Attribute | Value |
|-----------|-------|
| Source type | **Live API** — primary KYB verification vendor |
| Internal or External | **External** — real-time API call |
| Source weight | `0.8` — comment says "High weight for UK/Canada businesses" |
| Request type | `fetch_business_entity_verification` |

**Industry fields available (in `clientData.standardizedIndustries[]`):**

| Field | Used? |
|-------|-------|
| `.naicsCode` — 6-digit US NAICS | ✅ **USED** — `find(i => i.naicsCode && /^\d{6}$/.test(i.naicsCode))?.naicsCode` |
| `.sicCode` — UK SIC code | ⚠️ **SILENTLY DROPPED** — adjacent field in the same object, never accessed |
| `.industryName` — text label | ✅ **USED** — mapped to `industry` fact |

**Note from `rules.ts`:** A `truliooPreferredRule` exists to give Trulioo precedence for GB/CA businesses. It is wired for address and identity facts. But for `naics_code`, Trulioo's `.sicCode` is never read — the rule has no effect on UK industry classification because `.sicCode` is not consumed.

---

#### Source 5: SERP Scrape (Live API / Web Scrape)

| Attribute | Value |
|-----------|-------|
| Source type | **Live web scrape** — infers industry from search results |
| Internal or External | **External** (internal SERP service calling Google/Bing) |
| Fact-level weight | `0.3` — lowest priority (heuristic, not official data) |
| Note | `@TODO: ENG-24 Replace SERP` — marked for replacement |

**Industry fields available:**

| Field | Used? |
|-------|-------|
| `businessLegitimacyClassification.naics_code` | ✅ **USED** (weight 0.3) |
| `businessLegitimacyClassification.secondary_naics_code` | ⚠️ **SILENTLY DROPPED** |
| `businessLegitimacyClassification.sic_code` | ⚠️ **SILENTLY DROPPED** |

---

#### Source 6: Customer-Submitted (businessDetails)

| Attribute | Value |
|-----------|-------|
| Source type | **Internal** — from applicant's onboarding form |
| Internal or External | **Internal** case-service lookup |
| Source weight | `10` (highest) but **fact-level weight overridden to `0.2`** |
| Confidence | Hardcoded `1` |

**Deliberate down-weighting:** Despite the source weight of 10, the `naics_code` fact overrides this to 0.2 — because customers frequently self-report incorrect codes. Any vendor-verified code will beat a customer submission.

**Input validation:** Zod schema `z.string().regex(/^\d{6}$/)` — only accepts 6-digit numeric NAICS. A UK business submitting SIC 62012 would fail validation.

---

#### Source 7: AI NAICS Enrichment (GPT Fallback)

| Attribute | Value |
|-----------|-------|
| Source type | **AI inference** — OpenAI GPT (described as "GPT-5 mini" in report) |
| Internal or External | **External** API call |
| Fact-level weight | `0.1` — lowest of all sources (fallback only) |
| Trigger | Runs when too few other sources have responded |

**Fields returned:**

| Field | Used? |
|-------|-------|
| `response.naics_code` — 6-digit US NAICS | ✅ **USED** (weight 0.1) |
| `response.mcc_code` — 4-digit MCC | ✅ **USED** (mapped to `mcc_code_found` fact) |
| `response.naics_description`, `response.mcc_description` | ✅ **USED** (in reports) |
| `response.reasoning`, `response.confidence` (HIGH/MED/LOW) | ✅ **USED** (self-reported, not calibrated) |
| UK SIC field | ❌ **STRUCTURALLY IMPOSSIBLE** — not in the Zod schema, not in the prompt |

---

### 1.3 Inputs — Worth AI Pipeline

| Input | Required | Source | Notes |
|-------|----------|--------|-------|
| Company legal name | Yes | Applicant form | Used as search key for all vendor calls |
| Business address | Yes | Applicant form | Used for identity matching across vendors |
| Country | Yes | Applicant form | Stored but **not used to route taxonomy** — UK companies still go through NAICS pipeline |
| Industry name (text) | Yes (onboarding) | Applicant form | Sanitized against `core_business_industries` (20 NAICS sectors) via Fuse fuzzy match |
| Website | No | Applicant form | Used by SERP scrape |
| Customer-submitted NAICS code | No | Applicant/API | Accepted but down-weighted to 0.2; UK SIC fails Zod validation |

**What is NOT accepted as input:**
- OpenCorporates jurisdiction codes (`gb`, `us_mo`, `ca_bc`, `ae_az`)
- UK SIC codes from the applicant (Zod regex rejects non-6-digit strings)
- Explicit taxonomy preference

---

### 1.4 The Database Schema — Industry Tables

#### `core_naics_code` (case-service PostgreSQL)
```sql
CREATE TABLE public.core_naics_code (
    id   int GENERATED ALWAYS AS IDENTITY NOT NULL,  -- surrogate FK target
    code int NOT NULL UNIQUE,                         -- 6-digit NAICS (e.g. 541110)
    label varchar NOT NULL                            -- sector description
);
```
**1,035 rows** (US NAICS 2022 full list). `data_businesses.naics_id` stores the surrogate `id`, not the raw code — all queries require a JOIN.

#### `core_mcc_code` (case-service PostgreSQL)
```sql
CREATE TABLE public.core_mcc_code (
    id   int GENERATED ALWAYS AS IDENTITY NOT NULL,
    code int NOT NULL UNIQUE,   -- 4-digit MCC
    label varchar NOT NULL
);
```
**125 rows** (initial seed). Extended by `20260310120000-add-additional-mcc-codes-up.sql`.

#### `rel_naics_mcc` (case-service PostgreSQL)
```sql
CREATE TABLE public.rel_naics_mcc (
    naics_id int NULL REFERENCES core_naics_code(id),
    mcc_id   int NULL REFERENCES core_mcc_code(id)
);
```
**1,012 mapping rows** — NAICS to MCC crosswalk. Used by `internalGetNaicsCode()` to derive MCC from a resolved NAICS code.

#### `core_business_industries` (case-service PostgreSQL)
```sql
CREATE TABLE core_business_industries (
    id          INT PRIMARY KEY,
    name        VARCHAR(255) NOT NULL UNIQUE,  -- e.g. "Information"
    code        VARCHAR(255) NOT NULL UNIQUE,  -- slug
    sector_code VARCHAR(10)  NOT NULL UNIQUE   -- e.g. "51" or "31-33"
);
```
**20 rows** — the 20 NAICS 2-digit sectors (Agriculture, Mining, Construction, …, Public Administration). This is the coarse "industry bucket" shown on the Worth dashboard.

#### `data_businesses` — industry columns
```sql
-- Added by migration 20240926041144
ALTER TABLE public.data_businesses ADD naics_id int NULL REFERENCES core_naics_code(id);
ALTER TABLE public.data_businesses ADD mcc_id   int NULL REFERENCES core_mcc_code(id);
-- FK to 20-sector lookup:
-- industry column → core_business_industries(id)
```

**There is NO `uk_sic_id` column. There is NO `core_uk_sic_code` table. There is NO Canadian NAICS storage.** UK SIC codes are in vendor responses, parsed by the fact engine, but cannot be persisted.

#### `rel_business_industry_naics` (audit table)
```sql
CREATE TABLE rel_business_industry_naics (
    business_id uuid NOT NULL REFERENCES data_businesses(id),
    platform    VARCHAR(255) NOT NULL,   -- e.g. "equifax", "zoominfo", "manual"
    industry_id INT NULL REFERENCES core_business_industries(id),
    naics_id    INT NULL REFERENCES core_naics_code(id),
    UNIQUE(business_id, platform)        -- one row per vendor per business
);
```
Platform priority for resolving conflicts: `manual(1) > serp_scrape(2) > tax_status(3) > equifax(4) > frontend(5)`.

#### `integration_data.request_response` (integration-service PostgreSQL — the central raw store)
```sql
CREATE TABLE integration_data.request_response (
    request_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id      uuid NOT NULL,
    platform_id      integer NOT NULL,   -- vendor discriminator
    request_type     varchar,            -- e.g. 'fetch_public_records'
    requested_at     timestamptz,
    response         jsonb,              -- raw vendor payload (varies completely by platform_id)
    status           integer,
    ...
);
```
**This is the single source of all vendor data.** Every fact engine query reads from here filtered by `platform_id`. The raw UK SIC from OpenCorporates and Trulioo sits in `response` JSONB — it is parsed correctly into the `uk_sic_code` fact — but then has nowhere to go because no persistence layer exists for it.

---

### 1.5 The Fact Resolution Engine

**Rule: `factWithHighestConfidence`** — the winner is the source with the highest `confidence × weight` product. When two sources are within `WEIGHT_THRESHOLD = 0.05`, `weightedFactSelector` breaks the tie using fact-level `weight`.

**Effective priority ranking for `naics_code`:**

| Priority | Source | Source weight | Fact weight | Effective score |
|----------|--------|---------------|-------------|-----------------|
| 1 (highest) | OpenCorporates | 0.9 | — | 0.9 × match_confidence |
| 2 | ZoomInfo | 0.8 | — | 0.8 × match_confidence |
| 3 | Trulioo | 0.8 | 0.7 | 0.8 × 0.7 × match_confidence |
| 4 | Equifax | 0.7 | — | 0.7 × match_confidence |
| 5 | Customer-submitted | 10 source | **0.2 override** | 0.2 × 1.0 |
| 6 | SERP scrape | — | 0.3 | 0.3 × match_confidence |
| 7 (lowest) | AI enrichment | — | 0.1 | 0.1 × AI_confidence |

**Persistence path:**
1. Fact engine resolves `naics_code` (string)
2. Kafka event `UPDATE_NAICS_CODE`: `{ business_id, naics_code (number), naics_title, platform }`
3. `handleNaicsData()` → `SELECT id FROM core_naics_code WHERE code = $1` → `naics_id`
4. `SELECT mcc_id FROM rel_naics_mcc WHERE naics_id = $1` → `mcc_id`
5. `UPDATE data_businesses SET naics_id = $1, mcc_id = $2`
6. `INSERT/UPDATE rel_business_industry_naics (business_id, platform, naics_id, industry_id)`

---

### 1.6 Outputs — Worth AI Pipeline

| Output | Present | Where stored |
|--------|---------|-------------|
| US NAICS 2022 code (6-digit) | ✅ | `data_businesses.naics_id` → `core_naics_code.code` |
| NAICS description | ✅ | `core_naics_code.label` (JOIN required) |
| MCC code (4-digit) | ✅ | `data_businesses.mcc_id` → `core_mcc_code.code` |
| MCC description | ✅ | `core_mcc_code.label` (JOIN required) |
| Industry sector (20 buckets) | ✅ | `data_businesses.industry` → `core_business_industries` |
| UK SIC 2007 code | ❌ | **Not stored** — no table, no column |
| NACE Rev.2 code | ❌ | **Not stored** |
| ISIC Rev.4 code | ❌ | **Not stored** |
| Canadian NAICS | ❌ | In `classification_codes` fact only — no persistence |
| US SIC 1987 code | ❌ | In Equifax response only — no fact, no column |
| Probability score | ❌ | AI reports text string (HIGH/MED/LOW) only |
| AML/KYB risk signals | ❌ | Not produced |
| Source lineage (who said what) | Partial | `rel_business_industry_naics` has per-platform row but only for NAICS |
| Shell company detection | ❌ | Not present |
| Temporal pivot / code-change history | ❌ | Not present |

---

### 1.7 Known Issues — Confirmed From Codebase

| Issue | Location | Impact |
|-------|----------|--------|
| **UK SIC never persisted** | No `core_uk_sic_code` table, no `uk_sic_id` column | Every UK business gets `naics_id = NULL` or an inappropriate US NAICS |
| **OpenCorporates UK SIC silently dropped** | `businessDetails/index.ts` — loop only matches `us_naics` | `classification_codes` fact has no downstream consumer |
| **Trulioo `.sicCode` never read** | `businessDetails/index.ts` line 282 — `?.naicsCode` only | UK SIC adjacent in same array element, never accessed |
| **Equifax: 24/25 industry columns unused** | `sources.ts:279` — only `primnaicscode` mapped | Secondary NAICS hierarchy, all SIC codes are accessible via SQL only |
| **ZoomInfo `zi_c_sic4` unused** | No fact defined | 4-digit SIC present in raw response, discarded |
| **AI enrichment never asks for UK SIC** | `aiNaicsEnrichment.ts` Zod schema | Structurally impossible to return UK SIC from AI source |
| **Canadian NAICS captured but not persisted** | `classification_codes` fact — no consumer | Canadian companies get US NAICS or NULL |
| **Customer UK SIC rejected by Zod** | `z.string().regex(/^\d{6}$/)` | UK SIC 62012 is 5 digits — validation fails |
| **Platform priority overwrites without merge** | `UNIQUE(business_id, platform)` in audit table | When Equifax re-runs, its row is overwritten; no history |
| **`businessFields.ts` maps to dropped columns** | `naics_code`/`naics_title` columns were dropped in migration | Schema drift — mapper may silently fail or write to NULL |
| **TODO: OpenCorporates handler** | `business.ts` line comment | OpenCorporates verification result not fully wired to DB |
| **TODO: Replace SERP** | `ENG-24` | Known lowest-quality source, marked for replacement |
| **AI confidence is self-reported** | GPT text string HIGH/MED/LOW | Not calibrated; not comparable across sources |
| **`truliooPreferredRule` has no effect on industry** | `rules.ts` | Rule exists for UK/CA address facts but `uk_sic_code` fact not wired to persistence |

---

## Part 2 — The New Global Industry Classification Consensus Engine

### 2.1 Architecture

```
INPUT: Company Name + Address + Country/Jurisdiction Code (us_mo / ca_bc / ae_az / gb / tz …)
        ↓
┌─────────────────────────────────────────────────────────┐
│  Entity Resolver                                         │
│  • 100+ global legal suffixes (LLC, GmbH, SAS, KK…)    │
│  • 200+ OpenCorporates jurisdiction codes               │
│  • Detects: clean_name, jurisdiction_code, entity_type  │
│    iso2, region_bucket, preferred_taxonomy              │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LEVEL 0 — Signal Layer (6 vendor sources simulated)    │
│                                                         │
│  Source            Type      What it returns            │
│  ─────────────────────────────────────────────────      │
│  OpenCorporates  Internal*  Registry code + taxonomy    │
│  Equifax         External   NAICS from batch file       │
│  Trulioo         External   NAICS/SIC + jurisdiction    │
│  ZoomInfo        External   NAICS from B2B data         │
│  D&B (DUNS)      External   NAICS per jurisdiction      │
│  AI Semantic     Internal*  Web + NLP inferred code     │
│                                                         │
│  Each returns: raw_code, taxonomy, label,               │
│  weight, status (MATCHED/POLLUTED/CONFLICT), confidence │
│  + 3-snapshot temporal history per source               │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LEVEL 1 — Feature Engineering (38 numeric features)    │
│  (see Part 2.3 for full feature table)                  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LEVEL 2 — XGBoost Consensus Classifier                 │
│  Multi-class softprob → Top-5 codes with probabilities  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LLM Enrichment — OpenAI GPT-4o-mini (JSON mode)       │
│  UGO semantic search → multi-taxonomy code selection    │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Risk Engine — AML/KYB Signal Detection                 │
│  9 signal types → risk score 0–1 + KYB recommendation  │
└─────────────────────────┬───────────────────────────────┘
                          ↓
               STRUCTURED JSON OUTPUT
```

*Internal = uses internal data / simulated vendor response in current version. Production would replace with real API calls.

---

### 2.2 Data Sources — New Engine

| Source | Type | What it provides | Internal / External |
|--------|------|-----------------|---------------------|
| OpenCorporates | Simulated (→ production: internal Redshift + live API) | Registry code in **native taxonomy** for that jurisdiction | **Internal** in production |
| Equifax | Simulated (→ production: external batch API) | NAICS from commercial credit bureau | **External** |
| Trulioo | Simulated (→ production: external live API) | NAICS/SIC/ISIC per jurisdiction | **External** |
| ZoomInfo | Simulated (→ production: external live API) | NAICS from B2B firmographics | **External** |
| Dun & Bradstreet | Simulated (→ production: external API) | NAICS/ISIC per jurisdiction | **External** |
| AI Semantic | Internal (OpenAI GPT-4o-mini + DuckDuckGo) | Web-inferred code, any taxonomy | **Internal** (uses external APIs) |
| Unified Global Ontology (UGO) | Internal FAISS index | 2,330 codes × 6 taxonomies, semantic search | **Internal** static |
| Taxonomy CSVs | Internal static files | NAICS 2022, UK SIC 2007, NACE Rev.2, ISIC Rev.4, US SIC 1987, MCC | **Internal** static |
| Jurisdiction Registry | Internal Python module | 200+ codes → taxonomy routing, region bucket, ISO-2 | **Internal** static |
| OpenAI GPT-4o-mini | External API | Structured taxonomy reasoning, entity profiling | **External** |
| DuckDuckGo Search | External API | Web intelligence per company | **External** |

---

### 2.3 Feature Engineering — 38 Features vs. 0

The fundamental modelling difference: Worth AI uses a text prompt to select one code. The Consensus Engine builds a **38-feature numeric vector** that encodes every signal from every source into a format XGBoost can learn from.

| # | Feature | What it captures | Worth AI equivalent |
|---|---------|-----------------|---------------------|
| 0–5 | Per-source weighted confidence (6 sources) | How confident is each vendor, weighted by source reliability | Not computed |
| 6–11 | Source status flags: MATCHED / POLLUTED / CONFLICT | Is this source's data clean or flagged? | Not computed |
| 12 | Trulioo Pollution Flag | Did Trulioo return a 4-digit SIC for a 6-digit jurisdiction? | Not computed |
| 13 | Web-to-Registry Semantic Distance | Cosine distance between web-inferred label and official registry label | Not computed |
| 14 | Temporal Pivot Score | Rate of industry code change across 3 historical snapshots | Not computed |
| 15 | Cross-Taxonomy Agreement | Fraction of 6 taxonomies pointing to the same semantic cluster | Not computed |
| 16 | Entity type: Holding flag | Is this entity registered as a Holding Company? | Not computed |
| 17 | Entity type: NGO flag | Is this entity an NGO/charity? | Not computed |
| 18 | Entity type: Partnership flag | | Not computed |
| 19–28 | Jurisdiction bucket ONE-HOT (10 classes) | US / US_STATE / CA / CA_PROV / EU / APAC / LATAM / MENA / AFRICA / OTHER | Not computed — country field not used |
| 29 | Is sub-national (state/province/emirate) | Enables state-level NAICS routing | Not computed |
| 30 | Is NAICS jurisdiction | Should NAICS 2022 be primary? | Not computed |
| 31 | Majority code agreement | Fraction of sources agreeing on same code | Not computed |
| 32 | High-risk NAICS prefix flag | Is any source code in an AML-elevated sector? | Not computed |
| 33 | Unique code diversity | How many different codes did sources return? | Not computed |
| 34 | Registry vs AI semantic distance | | Not computed |
| 35 | Average source confidence | Overall data quality signal | Implicit in fact engine weights (not a trained feature) |
| 36 | Maximum source confidence | | Not computed |
| 37 | Source count | How many sources returned data? | Not computed |

**Worth AI: 0 numeric features. New engine: 38 numeric features.**

---

### 2.4 The Model — Comparison

| Aspect | Worth AI (FactEngine + AI) | New Consensus Engine |
|--------|---------------------------|----------------------|
| **Core algorithm** | Confidence-weighted max rule (`factWithHighestConfidence`) + LLM zero-shot | 3-level XGBoost stacking ensemble |
| **Training data** | None — rule-based + LLM pre-training | 2,000 synthetic multi-vendor samples (→ real overrides in production) |
| **Input representation** | Source confidence × weight (scalar per source) + text prompt to LLM | 38-feature numeric vector |
| **Candidate retrieval** | No retrieval — LLM picks from all NAICS or fact engine picks highest-confidence raw code | FAISS cosine similarity search across 2,330-code UGO |
| **Output** | Single NAICS code (string) | Top-5 codes with calibrated softmax probabilities |
| **Confidence** | Text string (HIGH/MED/LOW) — LLM self-report | Float 0.0–1.0 — XGBoost softmax probability |
| **Taxonomy** | US NAICS 2022 only | 6 taxonomies simultaneously |
| **Jurisdiction routing** | None — all businesses go through NAICS | 200+ codes → auto-routes to correct taxonomy |
| **UK SIC output** | Parsed but not persisted | Primary output for GB/GG/JE jurisdictions |
| **AML/KYB signals** | None | 9 signal types |
| **Retraining** | Not applicable | Re-run on accumulated ground-truth overrides |
| **Fallback chain** | Returns null if AI fails | XGBoost → LLM → UGO semantic search → graceful fallback |
| **LLM** | OpenAI GPT (described as GPT-5 mini) | OpenAI GPT-4o-mini, **JSON mode** (structured output guaranteed) |

---

### 2.5 Inputs — New Engine

| Input | Required | Format accepted | Notes |
|-------|----------|----------------|-------|
| Company Name | Yes | Any text | Cleaned with 100+ global suffixes |
| Address | No | Any text | Entity resolution + web search |
| Country / Jurisdiction | No | ISO-2, full name, **or OpenCorporates code** (`us_mo`, `ca_bc`, `ae_az`, `gg`, `tz`…) | Auto-routes to correct taxonomy |
| Website / domain | No | URL | AI Semantic enrichment |
| Custom web summary | No | Free text | Bypasses web search |
| Existing vendor codes | No | CSV/Excel column | Can be pre-loaded as source signals |

---

### 2.6 Outputs — New Engine

```json
{
  "business_id": "sim-00977436",
  "consensus_output": {
    "company_name": "Barclays Bank PLC",
    "jurisdiction": "gb",
    "jurisdiction_label": "United Kingdom",
    "entity_type": "Operating",
    "primary_industry": {
      "taxonomy": "UK_SIC_2007",
      "code": "64191",
      "label": "Banks",
      "consensus_probability": 0.8241
    },
    "secondary_industries": [
      {"taxonomy": "NACE_REV2",     "code": "K64",   "label": "Financial service activities",    "consensus_probability": 0.1012},
      {"taxonomy": "US_NAICS_2022", "code": "522110", "label": "Commercial Banking",             "consensus_probability": 0.0421},
      {"taxonomy": "ISIC_REV4",     "code": "6419",  "label": "Other monetary intermediation",  "consensus_probability": 0.0210},
      {"taxonomy": "MCC",           "code": "6099",  "label": "Financial Institutions NEC",     "consensus_probability": 0.0116}
    ],
    "risk_signals": [
      {
        "flag": "HIGH_RISK_SECTOR",
        "severity": "HIGH",
        "description": "Primary classification 64191 (Banks) is in an elevated AML/CTF risk sector.",
        "score": 0.25
      }
    ],
    "source_lineage": {
      "opencorporates": {"value": "uk_sic_2007-64191", "weight": 0.90, "status": "MATCHED"},
      "equifax":        {"value": "us_naics_2022-522110", "weight": 0.75, "status": "MATCHED"},
      "trulioo":        {"value": "us_sic_1987-6020", "weight": 0.70, "status": "POLLUTED"},
      "zoominfo":       {"value": "us_naics_2022-522110", "weight": 0.80, "status": "MATCHED"},
      "duns":           {"value": "uk_sic_2007-64191", "weight": 0.85, "status": "MATCHED"},
      "ai_semantic":    {"value": "us_naics_2022-522110", "weight": 0.80, "status": "INFERRED"}
    },
    "feature_debug": {
      "jurisdiction_code": "gb",
      "jurisdiction_label": "United Kingdom",
      "region_bucket": "EU",
      "is_subnational": false,
      "is_naics_jurisdiction": false,
      "trulioo_polluted": true,
      "web_registry_distance": 0.09,
      "temporal_pivot_score": 0.00,
      "majority_code_agreement": 0.67,
      "high_risk_naics_flag": true,
      "avg_source_confidence": 0.81
    },
    "risk_profile": {
      "overall_risk_score": 0.30,
      "overall_risk_level": "MEDIUM",
      "kyb_recommendation": "REVIEW",
      "signals": [...]
    }
  }
}
```

---

### 2.7 Risk Signals — 9 Types (No Worth AI Equivalent)

| Signal | Severity | What it detects |
|--------|----------|----------------|
| `REGISTRY_DISCREPANCY` | HIGH | Registry label vs web presence semantic distance > threshold → shell company indicator |
| `SHELL_COMPANY_SIGNAL` | HIGH | Holding company registered + operating sector web presence → U-Turn fraud pattern |
| `HIGH_RISK_SECTOR` | HIGH | Primary code in known AML/CTF-elevated sector (finance, electronics wholesale, holding companies) |
| `STRUCTURE_CHANGE` | HIGH | Industry code changed in every historical snapshot → money laundering pivot signal |
| `SOURCE_CONFLICT` | HIGH/MEDIUM | ≥60% of sources disagree on primary code |
| `TEMPORAL_PIVOT` | MEDIUM | Code changed 2+ times in recent history → monitor |
| `TRULIOO_POLLUTION` | LOW | Trulioo returned 4-digit SIC in 5/6-digit jurisdiction → auto-detected data quality issue |
| `HYBRID_ENTITY_DETECTED` | LOW | Activity spans 2+ unrelated sectors |
| `LOW_CONSENSUS_PROBABILITY` | MEDIUM | XGBoost confidence < 40% — insufficient data |

---

## Part 3 — Side-by-Side Comparison

### 3.1 Data Available vs. Data Used

| Data point | Available in Worth AI raw data | Used/persisted by Worth AI | Used by New Engine |
|------------|-------------------------------|---------------------------|-------------------|
| US NAICS 2022 (6-digit) | ✅ All 7 sources | ✅ Primary stored code | ✅ One of 6 outputs |
| US NAICS sector hierarchy (5 levels) | ✅ Equifax only | ❌ Dropped | ✅ Used in sector classification |
| Secondary NAICS codes (×4) | ✅ Equifax | ❌ Dropped | ✅ Secondary industry output |
| UK SIC 2007 | ✅ OpenCorporates + Trulioo | ❌ Dropped (no table/column) | ✅ **Primary output for GB jurisdictions** |
| Canadian NAICS | ✅ OpenCorporates | ❌ Dropped | ✅ Primary output for CA_PROV jurisdictions |
| NACE Rev.2 | ❌ Not in any source | ❌ Not present | ✅ Primary output for EU jurisdictions |
| ISIC Rev.4 | ❌ Not in any source | ❌ Not present | ✅ Primary output for APAC/LATAM/MENA/Africa |
| US SIC 1987 | ✅ Equifax + ZoomInfo | ❌ Dropped | ✅ Available as secondary output |
| MCC code | ✅ AI enrichment + NAICS lookup | ✅ Derived via `rel_naics_mcc` | ✅ Direct output per jurisdiction |
| Source-level confidence | Partial (computed by fact engine) | ❌ Not stored or exposed | ✅ All 6 sources exposed in lineage |
| Data quality flags | ❌ None | ❌ None | ✅ POLLUTED / CONFLICT / MATCHED per source |
| Temporal history | ❌ None | ❌ None | ✅ 3-snapshot pivot score |
| AML risk signals | ❌ None | ❌ None | ✅ 9 signal types |
| Shell company detection | ❌ None | ❌ None | ✅ `SHELL_COMPANY_SIGNAL` flag |
| Calibrated probability | ❌ None (text string) | ❌ None | ✅ Softmax float 0–1 |
| Jurisdiction-aware taxonomy | ❌ All go through NAICS | ❌ NAICS only | ✅ 200+ codes → correct taxonomy |

### 3.2 Full Output Comparison

| Output field | Worth AI | New Engine |
|-------------|----------|------------|
| Primary industry code | ✅ NAICS only | ✅ Auto-selected per jurisdiction |
| UK SIC 2007 | ❌ | ✅ Auto-selected for GB/GG/JE |
| NACE Rev.2 | ❌ | ✅ Auto-selected for EU |
| ISIC Rev.4 | ❌ | ✅ Auto-selected for APAC/LATAM/MENA |
| MCC code | ✅ Derived from NAICS via join | ✅ Direct, per-jurisdiction |
| Up to 4 secondary codes | ❌ | ✅ Cross-taxonomy |
| Calibrated probability | ❌ text string | ✅ Float 0–1 |
| Source lineage | Partial (`rel_business_industry_naics`) | ✅ All 6 sources with weight, status, label |
| AML/KYB risk signals | ❌ | ✅ 9 types with severity + score |
| Shell company detection | ❌ | ✅ |
| Temporal pivot detection | ❌ | ✅ |
| KYB recommendation | ❌ | ✅ APPROVE / REVIEW / ESCALATE / REJECT |
| Entity type classification | ❌ | ✅ Operating / Holding / NGO / Partnership |
| Jurisdiction label + metadata | ❌ | ✅ Full label, ISO-2, region bucket |
| Feature debug output | ❌ | ✅ All 38 features explained |

---

## Part 4 — What Was Dropped vs. What Was Gained

### Data that Worth AI already has but drops today (zero new APIs needed)

| Data | Where it is today | Why it is dropped | What the new engine does |
|------|------------------|------------------|--------------------------|
| UK SIC from OpenCorporates `gb_sic-XXXXX` | `integration_data.request_response` | No `core_uk_sic_code` table, no `uk_sic_id` column | Routes to `UK_SIC_2007` for GB — **persists it** |
| UK SIC from Trulioo `.sicCode` | Same table | `.sicCode` field never read in `businessDetails/index.ts` | Reads both `.naicsCode` and `.sicCode` per jurisdiction |
| Canadian NAICS from OpenCorporates `ca_naics-XXXXXX` | `classification_codes` fact | No downstream consumer | Routes CA_PROV to NAICS with CA-specific handling |
| Equifax secondary NAICS (×4) + full hierarchy | `integration_data.request_response` response JSONB | No fact defined | Used as secondary industry codes |
| Equifax + ZoomInfo SIC 1987 | Same | No fact, no table | Available as US_SIC_1987 secondary output |

### New capabilities that require additional work in production

| Capability | What it needs |
|-----------|---------------|
| NACE Rev.2 for EU companies | New data source (no current vendor returns NACE) |
| ISIC Rev.4 for global companies | New data source |
| AML/KYB risk signals | New logic layer (built in Risk Engine) |
| Temporal pivot detection | Historical fact snapshots (built into FactEngine pattern already) |
| Calibrated probabilities | XGBoost model trained on manual overrides |

---

## Part 5 — Recommended Next Steps

| Priority | Action | Effort | Value |
|----------|--------|--------|-------|
| **P0** | Add `core_uk_sic_code` table + `uk_sic_id` column to `data_businesses` | Low — one migration | Fixes UK SIC persistence gap with **zero new API calls** |
| **P0** | Wire OpenCorporates `gb_sic` entries from `classification_codes` fact to `uk_sic_id` update | Low — one Kafka handler | Activates data already in the database |
| **P0** | Read Trulioo `.sicCode` field for GB businesses (one-line change in `businessDetails/index.ts`) | Very Low | Adds a second source for UK SIC immediately |
| **P1** | Add `classification_codes` downstream consumer — persist all jurisdiction codes to a `rel_business_classification_codes` table | Medium | Enables CA NAICS, NACE, ISIC without new vendors |
| **P1** | Replace AI NAICS prompt with the new Consensus Engine pipeline | Medium | Multi-taxonomy output, calibrated confidence, AML signals |
| **P1** | Train XGBoost on real manual override history from `rel_business_industry_naics` | Medium | Replaces synthetic training with ground truth |
| **P2** | Wire Equifax secondary NAICS + SIC hierarchy into fact engine | Low — add path mappings | Exposes richer Equifax data at no extra cost |
| **P2** | Integrate `jurisdiction_code` as an input to the integration-service FactEngine | Medium | Enables correct taxonomy routing per country |
| **P3** | Add `core_nace_code` + `core_isic_code` tables and NACE/ISIC vendor sources | High | Full global taxonomy coverage |

---

## Appendix — Taxonomy Reference

| Taxonomy | Authority | Jurisdictions | Codes | Worth AI today | New Engine |
|----------|-----------|--------------|-------|----------------|-----------|
| NAICS 2022 | US Census Bureau | US, Canada, Mexico, AU, NZ | 1,035 | ✅ Primary (stored) | ✅ |
| UK SIC 2007 | Companies House / ONS | GB, GG, JE | 386 | ⚠️ Parsed, not stored | ✅ |
| NACE Rev.2 | Eurostat | EU/EEA | 88 | ❌ | ✅ |
| ISIC Rev.4 | United Nations | All other countries | 439 | ❌ | ✅ |
| US SIC 1987 | SEC / US Government | United States (legacy) | 79 | ⚠️ In raw data, dropped | ✅ |
| MCC | Visa / Mastercard | Global (payments) | 305 | ✅ Derived via NAICS join | ✅ |
| **Total** | | | **2,351** | **2 stored, 4 dropped** | **6 used** |

---

*Prepared by Worth AI Engineering*  
*Sources: `SIC-UK-Codes` repo (integration-service, case-service, warehouse-service), `WORTH_INDUSTRY_CLASSIFICATION_REPORT.md` (March 23 2026), and new Consensus Engine codebase*
