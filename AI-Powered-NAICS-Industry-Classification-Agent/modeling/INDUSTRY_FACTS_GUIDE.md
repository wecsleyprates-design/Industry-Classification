# Industry Classification Facts — Complete End-to-End Reference

**Purpose:** Step-by-step explanation of how classification facts are gathered from each vendor, how confidence is calculated (and by whom), how the Winning Source is selected, and what each of the 8 classification facts contains — verified against the actual source code.

---

## CRITICAL CLARIFICATION: Who Produces the Confidence Score?

> **Your question: "The confidence score is done by the Level 1 XGBoost Model, isn't it?"**

**The answer is: it depends on which pipeline you are in — and there are two entirely separate pipelines running in parallel.**

There are **two separate confidence systems** in Worth AI, and they are easy to confuse:

---

### The Two Pipelines at a Glance

```
PIPELINE A — integration-service (real-time, per business submission)
  → Calls vendor APIs live (Middesk, Trulioo, SERP)
  → Reads pre-loaded Redshift tables (ZoomInfo, Equifax, OC)
  → Each source computes its own confidence score (different formulas per source)
  → Fact Engine selects winner from ALL sources (ZI, EFX, OC, Middesk, Trulioo, AI)
  → Produces all 217 facts → publishes to Kafka → stored in rds_warehouse_public.facts

PIPELINE B — warehouse-service (batch, Redshift-only)
  → Reads only pre-loaded Redshift tables (ZoomInfo + Equifax only)
  → Worth AI XGBoost entity matching model produces zi_probability + efx_probability
  → customer_table.sql compares ONLY zi_match_confidence vs efx_match_confidence
  → Produces datascience.customer_files → used for Redshift analytics + data export
```

These two pipelines run in parallel and produce separate outputs. The Fact Engine (Pipeline A) is the primary classification system customers interact with via API. The `customer_files` table (Pipeline B) is a Redshift analytics and data export table.

---

---

### System 1: Source Confidence (integration-service)

This is the confidence used by the **Fact Engine** to pick the winning vendor.

**Each source computes its own confidence score** using different methods:

| Source | Who computes confidence | How |
|---|---|---|
| **Middesk** | Middesk pipeline | `0.15 base + 0.20 per successful verification task` (name, TIN, address, SOS) → max 0.95 |
| **OpenCorporates** | Worth AI's own `confidenceScore()` function | `match.index / MAX_CONFIDENCE_INDEX (55)` — OR `match.prediction` from the XGBoost model if available |
| **ZoomInfo** | Worth AI's own entity matching | `match.index / 55` — OR `match.prediction` from XGBoost |
| **Equifax** | Worth AI's own entity matching | `match.prediction` (XGBoost AI score) preferred; falls back to `match.index / 55` |
| **Verdata/SERP** | Worth AI's `confidenceScore()` function | Name + address similarity score |
| **Canada Open** | The AI prediction score | `rawResponse.prediction` |
| **Trulioo** | Trulioo's own confidence model | Returned directly in API response |
| **AI Enrichment** | GPT-4o-mini self-reports | Text field: `"HIGH"` → ~0.70 / `"MED"` → ~0.50 / `"LOW"` → ~0.30 |

**Source:** `integration-service/lib/facts/sources.ts`, lines 201–238, 281–391

Key constant: `MAX_CONFIDENCE_INDEX = 55` (line 33 of `sources.ts`)

---

### System 2: Entity Match Confidence (warehouse-service / Pipeline B)

This is the **Redshift batch analytics pipeline**. Here the XGBoost entity matching model is central.

---

#### Step B1 — What the XGBoost Model Does

The Worth AI XGBoost entity matching model (`entity_matching_20250127 v1`, in the Entity-Matching repo) answers one question per candidate pair:

> **"Is this submitted business the same real-world entity as this vendor record?"**

It uses **33 pairwise text/address similarity features** — Jaccard k-grams on business name, street name, short name, plus exact matches on city, ZIP, street number, etc.

**Output:** A probability score 0–1 per source per business:
- `zi_probability` → "How likely is this ZoomInfo record the same company?"
- `efx_probability` → "How likely is this Equifax record the same company?"
- `oc_probability` → "How likely is this OC record the same company?"

These scores are written to `datascience.ml_model_matches` — the central XGBoost output table.

---

#### Step B2 — How zi_match_confidence and efx_match_confidence Are Built

The match select procedures read from `ml_model_matches` and build the match tables. From the actual SQL (`zi_match_select.sql`, `efx_match_select.sql`):

**ZoomInfo match table** (`datascience.zoominfo_matches_custom_inc_ml`):
```sql
-- FIRST PREFERENCE: XGBoost probability (if ≥ 0.80)
SELECT business_id, zi_c_company_id, zi_c_location_id, zi_es_location_id, zi_probability
FROM datascience.ml_model_matches
WHERE zi_probability >= 0.8

UNION ALL

-- FALLBACK: Heuristic similarity index (if XGBoost score < 0.80)
SELECT business_id, zi_c_company_id, zi_c_location_id, zi_es_location_id,
       NULL AS zi_probability, similarity_index
FROM datascience.smb_zoominfo_standardized_joined
WHERE similarity_index_rank = 1
  AND similarity_index >= 45                -- minimum similarity threshold
  AND business_id NOT IN (already matched by XGBoost)
```

**Equifax match table** (`datascience.efx_matches_custom_inc_ml`):
```sql
-- Same two-tier pattern:
-- FIRST: ml_model_matches.efx_probability >= 0.80
-- FALLBACK: smb_equifax_standardized_joined.similarity_index >= 45
```

**OpenCorporates match table** (`datascience.oc_matches_custom_inc_ml`):
```sql
-- Same two-tier pattern:
-- FIRST: ml_model_matches.oc_probability >= 0.80
-- FALLBACK: smb_open_corporate_standardized_joined.similarity_index >= 45
```

**Then `zi_match_confidence` and `efx_match_confidence` are computed** in `smb_zi_oc_efx_combined.sql`:
```sql
-- ZoomInfo confidence (zi_match_confidence):
CASE
    WHEN zi_probability IS NOT NULL         THEN zi_probability          -- XGBoost score
    WHEN similarity_index IS NOT NULL
         AND similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0 -- normalized heuristic
    ELSE 0
END AS zi_match_confidence

-- Equifax confidence (efx_match_confidence):
CASE
    WHEN efx_probability IS NOT NULL        THEN efx_probability         -- XGBoost score
    WHEN similarity_index IS NOT NULL
         AND similarity_index / 55.0 >= 0.8 THEN similarity_index / 55.0 -- normalized heuristic
    ELSE 0
END AS efx_match_confidence
```

**Key constant:** `MAX_CONFIDENCE_INDEX = 55` — heuristic similarity scores are normalized by dividing by 55.

---

#### Step B3 — The Customer Table Production Rule

`smb_zi_oc_efx_combined` is joined into `smb_pr_verification_cs`, which is then read by `customer_table.sql` (the stored procedure `sp_recreate_customer_files()`). The NAICS winner-takes-all rule runs here:

```sql
-- From customer_table.sql (the actual production SQL):

-- NAICS code: ZoomInfo wins if its confidence > Equifax confidence
primary_naics_code =
  COALESCE(
    CASE
      WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
        THEN CAST(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', '') AS INTEGER)
      ELSE CAST(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', '') AS INTEGER)
    END,
    naics_code  -- fallback to existing naics_code if both are null
  )

-- The same ZI vs EFX comparison controls ALL other firmographic fields too:
-- employee_count, year_established, revenue, company_name, address, city,
-- zipcode, country, county, website_url, affiliate_parent
```

**This single comparison `zi_match_confidence > efx_match_confidence` decides the winning source for EVERY field in `customer_files`** — not just NAICS.

---

#### Step B4 — Why Only ZoomInfo and Equifax? Why Not OC or Liberty?

This is the most important architectural question. From reading the actual SQL:

**OC IS matched by the XGBoost model** — `oc_probability` exists in `ml_model_matches` and `oc_matches_custom_inc_ml` is built. But:

1. **OC has no NAICS field in its Redshift table.** OC stores `industry_code_uids` (a pipe-delimited string like `us_naics-541110|gb_sic-62012`). The warehouse pipeline was never built to parse this field and extract the NAICS code for use in the `CASE WHEN zi > efx` comparison.

2. **`customer_table.sql` was built when only ZI and EFX had pre-joined Redshift tables** with clean numeric NAICS fields (`zi_c_naics6`, `efx_primnaicscode`). Adding OC would require parsing `industry_code_uids` and handling multi-taxonomy codes — work that was never done in Pipeline B.

3. **Liberty** has no `liberty_match_confidence` column anywhere in the Redshift pipeline. Liberty data (`einmst_*` tables) contains name, address, SIC codes — but was never incorporated into the `customer_files` production rule.

4. **Middesk and Trulioo** return data via live API calls processed by the integration-service (Pipeline A). Their results are not pre-loaded into the Redshift tables that Pipeline B reads.

**In summary:** `zi_match_confidence` and `efx_match_confidence` are the only two confidence scores in `customer_table.sql` because:
- They are the only sources with clean, pre-loaded Redshift tables containing a usable numeric NAICS field
- The SQL was written when only these two sources existed in the Redshift pipeline
- OC, Liberty, Middesk, Trulioo were added later and only integrated into Pipeline A (the Fact Engine)

---

**These are NOT the same as the Fact Engine confidence.** They are parallel systems serving different purposes:

| | Fact Engine (Pipeline A — integration-service) | Match confidence (Pipeline B — warehouse-service) |
|---|---|---|
| **Runs when** | Business submitted via API (real-time) | Batch SQL job on schedule |
| **Sources covered** | All 6+: ZI, EFX, OC, Middesk, Trulioo, AI | Only ZoomInfo and Equifax |
| **Confidence produced by** | Each source's own logic (XGBoost where available) | Worth AI XGBoost entity matching model |
| **Confidence stored in** | `source.confidence` field on each Fact | `datascience.ml_model_matches.zi_probability`, `efx_probability`, `oc_probability` |
| **Denormalized to** | `rds_warehouse_public.facts` (JSONB) | `datascience.smb_zi_oc_efx_combined` → `smb_pr_verification_cs` → `customer_files` |
| **Used for** | All 217 facts → REST API response | NAICS + ALL firmographic fields in `customer_files` |
| **OC industry codes** | ✅ Used (`industry_code_uids` parsed) | ❌ Not used (field not parsed in SQL) |
| **Liberty industry codes** | ✅ Available | ❌ Not in pipeline |
| **Analyst sees in API** | GET /facts/business/{id}/details | Not directly — analysts use Redshift queries |

---

## Part 1 — What Each Source Delivers and How Confidence Is Calculated

### Source 1: ZoomInfo

**Redshift table:** `dev.datascience.zoominfo_standard_ml_2`

**Industry fields:**

| Field | What it contains |
|---|---|
| `zi_c_naics6` | **Primary 6-digit NAICS code** used for classification |
| `zi_c_sic4` | 4-digit SIC code |
| `zi_c_industry` | Industry text label |

**How confidence is computed (from `sources.ts` lines 281–290):**
```typescript
// ZoomInfo source confidence logic:
weight: 0.8,
getter: async function (businessID) {
    // 1st preference: XGBoost prediction score from entity matching
    // 2nd preference: match.index / 55 (heuristic similarity score)
    // 3rd preference: metadata score / 55
    this.confidence = match?.prediction
        ? match.prediction
        : match?.index
            ? match.index / MAX_CONFIDENCE_INDEX  // MAX_CONFIDENCE_INDEX = 55
            : queryResult.metadata?.result?.matches?.score / MAX_CONFIDENCE_INDEX;
}
```

**The XGBoost model IS involved for ZoomInfo** — `match.prediction` comes from the entity matching XGBoost model when available.

**Source weight:** `0.8`

---

### Source 2: Equifax

**Redshift table:** `dev.warehouse.equifax_us_standardized`

**Industry fields:**

| Field | What it contains |
|---|---|
| `efx_primnaicscode` | **Primary 6-digit NAICS code** |
| `efx_primsic` | Primary SIC code |
| `efx_primnaicsdesc` | NAICS description |

**How confidence is computed (from `sources.ts` lines 315–350):**
```typescript
// Equifax source confidence logic:
weight: 0.7,
getter: async function (businessID) {
    // match.prediction is the most recent using the AI prediction score
    // match.index is from heuristic matching pulling rows from Redshift
    this.confidence = match?.prediction
        ? match.prediction
        : match?.index / MAX_CONFIDENCE_INDEX;
}
```

**The XGBoost model IS involved for Equifax** — same as ZoomInfo: `match.prediction` is the entity matching model score.

**Source weight:** `0.7` — lowest among major sources, partly because Equifax data relies on manual file ingestion at an unknown cadence (comment in source code: `"Equifax has a low weight because it relies upon manual files being ingested at some unknown cadence"`)

**Geographic exclusion:** Equifax NOT used for UK, Canada, Ireland

---

### Source 3: OpenCorporates

**Redshift table:** `dev.datascience.open_corporates_standard_ml_2`

**Industry fields:**

| Field | What it contains |
|---|---|
| `industry_code_uids` | Pipe-delimited string: `us_naics-541110\|gb_sic-62012\|nace-J6201` |
| `jurisdiction_code` | e.g. `us_nj`, `gb`, `de` |

**How confidence is computed (from `sources.ts` lines 297–307):**
```typescript
// OpenCorporates confidence logic:
weight: 0.9,
getter: async function (businessID) {
    const [response, confidence, updatedAt] = await getFromRequestResponse(businessID, {
        confidence: rawResponse => rawResponse?.prediction   // XGBoost prediction
    });
    this.confidence = confidence ?? undefined;
}
```

**The XGBoost entity matching model IS used for OC** — `rawResponse.prediction` is the XGBoost match score.

**Important:** OC's `industry_code_uids` contains codes for ALL taxonomies (US NAICS, UK SIC, NACE, etc.). The FactEngine only extracts `us_naics-` prefixed codes for the `naics_code` fact. UK SIC codes go into `classification_codes` fact but have no downstream consumer — a known gap.

**Source weight:** `0.9` — highest among all sources (except Middesk)

---

### Source 4: Middesk

**Storage:** Live API → integration-service PostgreSQL → Kafka

**Industry fields:** NAICS from SOS (Secretary of State) filings; entity type

**How confidence is computed (from `sources.ts` lines 201–238):**
```typescript
// Middesk confidence — two methods:

// Method A: XGBoost model
const result = await confidenceScoreMany(submittedBusiness, middeskBusiness);
this.confidence = Math.max(...result.map(r => r.prediction));

// Method B: Task-based fallback (when XGBoost not available)
let confidence = 0.15;          // base score
confidence += isTaskSuccess(middeskRecord, "name")                ? 0.2 : 0;
confidence += isTaskSuccess(middeskRecord, "tin")                 ? 0.2 : 0;
confidence += isTaskSuccess(middeskRecord, "address_verification") ? 0.2 : 0;
confidence += isTaskSuccess(middeskRecord, "sos_match")            ? 0.2 : 0;
this.confidence = confidence;   // max = 0.95
```

**Middesk prefers the XGBoost model** but falls back to task counting when XGBoost is unavailable.

**Source weight:** `2` — internally highest weight (weight=2 means it wins ties against weight=0.9 OC)

---

### Source 5: Trulioo

**Storage:** Live API → integration-service PostgreSQL

**Industry fields:** `sicCode` (may be 4-digit — POLLUTED flag)

**How confidence is computed (from `sources.ts` lines 360–375):**
```typescript
// Trulioo confidence:
weight: 0.8,
getter: async function (businessID) {
    // match.index from the entity matching result
    const confidenceValue = fields.response.match.index / MAX_CONFIDENCE_INDEX;
    this.confidence = confidenceValue;
}
```

**Trulioo uses heuristic `match.index / 55`** — not the XGBoost model. The index is a raw similarity score.

---

### Source 6: Verdata / SERP

**How confidence is computed (from `sources.ts` lines 416–440):**
```typescript
// Verdata/SERP — uses the Worth AI confidenceScore() function:
weight: 0.8,
getter: async function (businessID) {
    const confidenceResult = await confidenceScore({
        submittedBusiness, verdataBusinesses
    });
    this.confidence = confidenceResult.prediction;  // XGBoost prediction
}
```

**Verdata uses the XGBoost entity matching model** via `confidenceScore()`.

---

### Source 7: GPT-4o-mini AI Enrichment

**How confidence is computed (from `aiNaicsEnrichment.ts` lines 120–125):**
```typescript
// AI source confidence:
getter: async function (businessID) {
    const [response, confidence, updatedAt] = await getFromRequestResponse(businessID, {
        confidence: response => response?.confidence  // GPT-4o-mini self-reports: "HIGH"|"MED"|"LOW"
    });
    this.confidence = confidence ?? undefined;
}
```

**GPT-4o-mini self-reports its confidence** as text: `"HIGH"` / `"MED"` / `"LOW"`. The system maps this to a numeric score.

**Source weight:** `0.1` — lowest. Acts only as a fallback.

**DEPENDENT_FACTS trigger condition (from `aiNaicsEnrichment.ts` lines 57–68):**
```typescript
static readonly DEPENDENT_FACTS = {
    naics_code: {
        maximumSources: 3,    // If already 3+ sources have naics_code, SKIP AI (save credits)
        minimumSources: 1,    // Must have at least 1 source
        ignoreSources: ["AINaicsEnrichment"]  // Don't count itself
    },
    mcc_code: {
        maximumSources: 3,
        minimumSources: 1,
        ignoreSources: ["AINaicsEnrichment"]
    }
    // ...other facts
}
```

**AI enrichment only runs when fewer than 3 sources have already returned a NAICS code.** This saves OpenAI credits. It returns: `naics_code`, `naics_description`, `uk_sic_code` (if GB), `mcc_code`, `mcc_description`, `confidence`, `reasoning`.

**AI model used:** `gpt-5-mini` (as of current codebase — `MODEL = "gpt-5-mini"` in `aiNaicsEnrichment.ts`)

**Last-resort code:** `"561499"` (All Other Business Support Services). If AI also cannot determine a code OR if the returned code is not found in `core_naics_code` table → `removeNaicsCode()` replaces it with `"561499"`.

---

## Part 2 — The Full Data Flow

```
STEP 1 — Business submitted
  POST /businesses/customers/{customerID}
  → business_id (UUID) created
  → Integration pipeline triggered

STEP 2 — Vendor data collected (parallel)
  Each source's getter() function is called:
  
  ZoomInfo   → reads zi_c_naics6 from Redshift table
               confidence = XGBoost prediction OR match.index / 55
  
  Equifax    → reads efx_primnaicscode from Redshift table (US only)
               confidence = XGBoost prediction OR match.index / 55
  
  OC         → reads industry_code_uids from Redshift table
               confidence = XGBoost prediction via rawResponse.prediction
  
  Middesk    → calls live SOS verification API
               confidence = XGBoost OR 0.15 + 0.20 per successful task
  
  Trulioo    → calls live API
               confidence = match.index / 55 (heuristic)
  
  SERP/Verdata → scrapes website
                 confidence = XGBoost prediction via confidenceScore()

STEP 3 — Fact Engine runs (integration-service)
  For each fact (naics_code, mcc_code, industry, etc.):
  → Collect all source values
  → Apply Winning Source rules (see Part 3)
  → Produce winner + alternatives[]

STEP 4 — AI Enrichment runs IF < 3 sources returned naics_code
  → GPT-4o-mini called with business name + address + website
  → Returns naics_code + mcc_code + confidence text
  → Participates in Fact Engine with weight = 0.1
  → POST-PROCESSING: validate code against core_naics_code table
     If invalid → replace with "561499" (last resort)

STEP 5 — Kafka: facts.v1 topic
  integration-service publishes FactEnvelope
  Events: CALCULATE_BUSINESS_FACTS, UPDATE_NAICS_CODE

STEP 6 — warehouse-service persists (FactService.consume())
  Upserts into rds_warehouse_public.facts (JSONB key-value)
  One row per fact per business (composite PK: business_id + name)

STEP 7 — case-service updates data_businesses
  Kafka UPDATE_NAICS_CODE → addIndustryAndNaicsPlatform()
  data_businesses.naics_code = FK to core_naics_code.id
  data_businesses.mcc_code   = FK to core_mcc_code.id

STEP 8 — Available via API and Redshift
```

---

## Part 3 — The 5-Step Winning Source Selection Rules

All rules are from `integration-service/lib/facts/rules.ts`.

### Rule 1 — Collect All Candidates

```
Example candidates for naics_code:
  Middesk   value="541511"  confidence=0.95  weight=2.0
  OC        value="541110"  confidence=0.89  weight=0.9
  ZoomInfo  value="541512"  confidence=0.72  weight=0.8
  Equifax   value="541511"  confidence=0.68  weight=0.7
  Trulioo   value="7372"    confidence=0.55  weight=0.8  ← SIC, may be POLLUTED
  AI        value="541511"  confidence=0.70  weight=0.1
```

### Rule 2 — factWithHighestConfidence (from `rules.ts` lines 36–56)

```typescript
export const factWithHighestConfidence: Rule = {
    fn: (_engine, _factName, input: Fact[]): Fact | undefined => {
        return input.reduce((acc, fact) => {
            const factConfidence = fact.confidence ?? fact.source?.confidence ?? 0.1;
            const accConfidence  = acc?.confidence ?? acc?.source?.confidence ?? 0.1;

            if (fact.value === undefined) return acc;
            if (acc === undefined) return fact;

            if (Math.abs(factConfidence - accConfidence) <= WEIGHT_THRESHOLD) {
                // Within 5% — use weight to break the tie
                return weightedFactSelector(fact, acc);
            } else if (factConfidence > accConfidence) {
                return fact;  // Higher confidence wins
            }
            return acc;
        }, undefined);
    }
};
```

**In plain English:**
1. Sort by confidence (descending)
2. If two sources are within `WEIGHT_THRESHOLD = 0.05` → go to Rule 3
3. Otherwise the highest confidence wins outright

### Rule 3 — weightedFactSelector (tie-break, `rules.ts` lines 62–74)

```typescript
export function weightedFactSelector(fact: Fact, otherFact: Fact): Fact {
    // Each fact has its own weight (set per-fact in businessDetails/index.ts)
    // OR falls back to the source-level weight
    const primaryFactWeight = fact.weight !== DEFAULT_FACT_WEIGHT
        ? fact.weight
        : (fact.source?.weight ?? DEFAULT_FACT_WEIGHT);

    const otherFactWeight = otherFact.weight !== DEFAULT_FACT_WEIGHT
        ? otherFact.weight
        : (otherFact.source?.weight ?? DEFAULT_FACT_WEIGHT);

    return primaryFactWeight >= otherFactWeight ? fact : otherFact;
}
```

**Weight ranking:**
- Middesk: **2.0**
- OpenCorporates: **0.9**
- ZoomInfo: **0.8**
- Trulioo: **0.8**
- Equifax: **0.7**
- AI Enrichment: **0.1**

Note: Weights can also be set **per-fact** in `businessDetails/index.ts`. For example, `uk_sic_code` from Trulioo has `weight: 0.7` overriding the source default.

### Rule 4 — manualOverride (always wins, `rules.ts` lines 108–120)

```typescript
export const manualOverride: Rule = {
    fn: (engine, factName: FactName): Fact | undefined => {
        const manualEntry = engine.getManualSource()?.rawResponse?.[factName];
        if (manualEntry) {
            return {
                name: factName,
                source: sources.manual,
                value: manualEntry.value,
                override: manualEntry ?? null
            } as Fact;
        }
    }
};
```

An analyst override set via `PATCH /facts/business/{id}/override/{factName}` **always wins**, regardless of any source confidence.

### Rule 5 — No Valid Code Fallback Cascade

```
If no source returned a valid naics_code:

A. AI Enrichment runs (if < 3 sources already exist):
   → GPT-4o-mini reads business name + address + website
   → Returns naics_code, mcc_code, confidence text
   → Participates in selection with weight=0.1

B. POST-PROCESSING: validate winning code
   → internalGetNaicsCode(code) queries core_naics_code table
   → If code NOT found: removeNaicsCode() → replace with "561499"
   → "561499" = All Other Business Support Services
   → "5614"   = the matching MCC code

C. Analyst can correct via:
   PATCH /facts/business/{id}/override/naics_code
   Body: { "value": "722511" }
```

### Geographic Exclusions

From `sources.ts` and `rules.ts`:

| Country | ZoomInfo | Equifax | OC | Middesk | Trulioo |
|---|---|---|---|---|---|
| US | ✅ | ✅ | ✅ | ✅ | ✅ |
| GB (UK) | ✅ | ❌ | ✅ | ❌ | ✅ |
| CA (Canada) | ✅ | ❌ | ✅ (canada_open) | ❌ | ✅ |
| IE (Ireland) | ✅ | ❌ | ✅ | ❌ | ✅ |

---

## Part 4 — Storage: Three Layers

### Layer 1: FactEnvelope on Kafka (facts.v1)

```
Topic: facts.v1
Events:
  CALCULATE_BUSINESS_FACTS
  UPDATE_NAICS_CODE
  FACT_OVERRIDE_CREATED_AUDIT
  PROCESS_COMPLETION_FACTS

Payload structure (from fact.py):
  FactEnvelope {
    scope: string
    business_id: UUID
    data: {
      "naics_code": { value: "541511", source: {...}, confidence: 0.95, alternatives: [...] },
      "mcc_code":   { value: "7372",   source: {...}, confidence: 0.95 },
      ...
    }
    calculated_at: datetime
  }
```

### Layer 2: rds_warehouse_public.facts (PostgreSQL + Redshift mirror)

From `datapooler/adapters/db/models/facts.py`:
```python
class FactDb(TimestampMixin, Base):
    __tablename__ = "facts"

    id          = Column(BigInteger, autoincrement=True)
    business_id = Column(String, primary_key=True, index=True)
    name        = Column(String, primary_key=True, index=True)
    value       = Column(JSONB)
    received_at = Column(DateTime(timezone=True), index=True)

    __table_args__ = (UniqueConstraint("business_id", "name"),)
```

**Upsert behaviour** (from `facts.py` line 84):
```python
session.merge(fact_db)  # SQLAlchemy merge = INSERT ON CONFLICT UPDATE
```

### Layer 3: rds_cases_public.data_businesses (denormalized FKs)

```sql
-- data_businesses columns (from migration files):
naics_code  INTEGER  → FK to core_naics_code.id
mcc_code    INTEGER  → FK to core_mcc_code.id
industry    INTEGER  → FK to core_business_industries.id
```

---

## Part 5 — The 8 Classification Facts — Full Detail

### Fact 1: `naics_code`

**What it is:** The single best 6-digit NAICS 2022 code for this business's primary activity.

**Source priority (by confidence × weight):**
1. Middesk SOS filing — weight 2.0, XGBoost or task-based confidence
2. OpenCorporates `us_naics-XXXXXX` from `industry_code_uids` — weight 0.9
3. ZoomInfo `zi_c_naics6` — weight 0.8
4. Trulioo `naicsCode` — weight 0.8 (reduced if 4-digit SIC returned = POLLUTED)
5. Equifax `efx_primnaicscode` — weight 0.7
6. GPT-4o-mini AI enrichment — weight 0.1 (fallback only)
7. Hardcoded `"561499"` if all else fails

**JSONB payload in facts table:**
```json
{
  "code": "541511",
  "description": "Custom Computer Programming Services",
  "source": { "confidence": 0.95, "platformId": 16 },
  "override": null,
  "alternatives": [
    { "value": "541110", "source": 23, "confidence": 0.89 },
    { "value": "541512", "source": 17, "confidence": 0.72 }
  ]
}
```

**Storage:**
```
rds_warehouse_public.facts  (name="naics_code", value=JSONB above)
rds_cases_public.data_businesses.naics_code  → FK integer to core_naics_code
```

**Query:**
```sql
-- From facts table:
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'naics_code';

-- Decoded with lookup:
SELECT n.code, n.description
FROM dev.rds_cases_public.data_businesses b
JOIN dev.rds_cases_public.core_naics_code n ON n.id = b.naics_code
WHERE b.id = '<uuid>';
```

---

### Fact 2: `naics_description`

**What it is:** Human-readable label for the winning NAICS code.

**Where it comes from:** After `naics_code` is resolved, the description is looked up from `core_naics_code` and stored as a separate fact.

**JSONB payload:**
```json
{ "description": "Custom Computer Programming Services" }
```

---

### Fact 3: `mcc_code`

**What it is:** 4-digit Merchant Category Code for payment network classification.

**Three paths:**
- **Path A (direct):** Middesk or Trulioo directly returns an MCC → most reliable
- **Path B (crosswalk, most common):** After `naics_code` resolved → lookup via `rel_naics_mcc` table: `NAICS 541511 → MCC 7372`
- **Path C (AI):** GPT-4o-mini returns `mcc_code` alongside `naics_code`

**JSONB payload:**
```json
{ "code": "7372", "description": "Computer Programming, Data Processing" }
```

**Storage:**
```
rds_warehouse_public.facts  (name="mcc_code")
rds_cases_public.data_businesses.mcc_code → FK to core_mcc_code.id
```

---

### Fact 4: `mcc_code_found`

**What it is:** Boolean — was MCC found directly from a vendor (not derived via crosswalk)?

- `true` → A vendor directly returned an MCC (Middesk or Trulioo)
- `false` → MCC was derived from NAICS via `rel_naics_mcc`

**JSONB payload:**
```json
{ "value": true }
```

---

### Fact 5: `mcc_code_from_naics`

**What it is:** The MCC code derived specifically from the winning NAICS code via the crosswalk table.

**Query used:**
```sql
SELECT mcc_code FROM dev.rds_cases_public.rel_naics_mcc
WHERE naics_code = '541511';
-- Returns: 7372
```

**Used when:** `mcc_code_found = false`. In this case, `mcc_code` and `mcc_code_from_naics` contain the same value.

**JSONB payload:**
```json
{ "code": "7372", "description": "Computer Programming, Data Processing" }
```

---

### Fact 6: `mcc_description`

**What it is:** Human-readable label for the MCC code.

**Where it comes from:** Lookup from `core_mcc_code` after `mcc_code` is resolved.

**JSONB payload:**
```json
{ "description": "Computer Programming, Data Processing" }
```

---

### Fact 7: `industry`

**What it is:** High-level category label for easy display.

**Where it comes from:**
- ZoomInfo `zi_c_industry` or `zi_c_sub_industry`
- OC industry text from `industry_code_uids`
- SERP scrape AI interpretation
- Derived from NAICS → mapped via `core_business_industries` lookup

**JSONB payload:**
```json
{ "value": "Technology - Software" }
```

**Storage:**
```
rds_warehouse_public.facts  (name="industry")
rds_cases_public.data_businesses.industry → FK to core_business_industries.id
```

---

### Fact 8: `classification_codes`

**What it is:** All industry codes from all sources and all taxonomies — the complete pre-winner picture.

**From `businessDetails/index.ts`:** The FactEngine aggregates every code before selection, including UK SIC, NACE, and Canadian NAICS from OC.

**JSONB payload:**
```json
{
  "codes": [
    { "system": "NAICS",  "code": "541511", "source": "Middesk",   "confidence": 0.95 },
    { "system": "NAICS",  "code": "541110", "source": "OC",         "confidence": 0.89 },
    { "system": "uk_sic", "code": "62012",  "source": "OC",         "confidence": 0.89 },
    { "system": "NAICS",  "code": "541512", "source": "ZoomInfo",   "confidence": 0.72 },
    { "system": "NAICS",  "code": "541511", "source": "Equifax",    "confidence": 0.68 }
  ]
}
```

**Known gap:** UK SIC, NACE, and Canadian NAICS codes are captured here correctly — but **no Kafka handler, API endpoint, or PDF report reads this fact**. It exists in the data but has no downstream consumer.

**Storage:** `rds_warehouse_public.facts` only — not in `data_businesses`

---

## Part 6 — Where Facts Appear

### Internal API (integration-service)
```
GET /facts/business/{businessId}/details
  → naics_code, mcc_code, industry with full source + confidence + alternatives

GET /facts/business/{businessId}/all  (admin only)
  → all 217 facts

PATCH /facts/business/{businessId}/override/{factName}
  → analyst manual override
```

### External API (case-service)
```
GET /businesses/customers/{customerID}
  → naics_code, naics_title, mcc_code, industry (simplified, no source lineage)
```

### Redshift
```sql
-- All 8 classification facts:
SELECT name, value, received_at
FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>'
  AND name IN ('naics_code','naics_description','mcc_code','mcc_description',
               'mcc_code_found','mcc_code_from_naics','industry','classification_codes');

-- Denormalized:
SELECT b.id, n.code AS naics, m.code AS mcc, i.name AS industry
FROM dev.rds_cases_public.data_businesses b
JOIN dev.rds_cases_public.core_naics_code n ON n.id = b.naics_code
JOIN dev.rds_cases_public.core_mcc_code   m ON m.id = b.mcc_code
JOIN dev.rds_cases_public.core_business_industries i ON i.id = b.industry
WHERE b.id = '<uuid>';
```

---

## Part 7 — Complete Workflow Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Business submitted                                          │
│  POST /businesses/customers/{customerID} → business_id created      │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│  STEP 2: Each source's getter() runs to collect vendor data         │
│                                                                      │
│  Source       Industry Code         How confidence computed          │
│  ─────────    ──────────────────    ────────────────────────────     │
│  Middesk      naics_code (SOS)      XGBoost OR 0.15+0.20/task        │
│  OC           industry_code_uids    XGBoost (rawResponse.prediction) │
│  ZoomInfo     zi_c_naics6           XGBoost OR match.index/55        │
│  Equifax      efx_primnaicscode     XGBoost OR match.index/55        │
│  Trulioo      sicCode (may pollute) match.index/55 (heuristic only)  │
│  SERP         website inferred      XGBoost via confidenceScore()    │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│  STEP 3: Fact Engine selects winner (rules.ts)                       │
│                                                                      │
│  factWithHighestConfidence():                                        │
│    → Sort by confidence                                              │
│    → If diff < 0.05: weightedFactSelector() uses source weight       │
│    → manualOverride() always wins regardless                         │
│                                                                      │
│  If < 3 sources returned a code → AI enrichment runs (gpt-5-mini)   │
│  AI output: naics_code + mcc_code + uk_sic_code + confidence text   │
│                                                                      │
│  POST-PROCESSING: validate code against core_naics_code              │
│    If not found → removeNaicsCode() → replace with "561499"         │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│  STEP 4: 8 classification facts produced                             │
│                                                                      │
│  naics_code          → winning 6-digit code                         │
│  naics_description   → its label                                     │
│  mcc_code            → 4-digit MCC (direct or crosswalk)            │
│  mcc_description     → its label                                     │
│  mcc_code_found      → was MCC found directly?                       │
│  mcc_code_from_naics → MCC derived via rel_naics_mcc crosswalk      │
│  industry            → high-level text label                         │
│  classification_codes→ ALL codes from ALL sources (pre-winner)      │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│  STEP 5: Kafka → facts.v1 → warehouse upsert                        │
│                                                                      │
│  rds_warehouse_public.facts:                                         │
│    (business_id, name) → JSONB value + received_at                  │
│    INSERT ON CONFLICT UPDATE (upsert, never duplicates)              │
│                                                                      │
│  rds_cases_public.data_businesses:                                   │
│    naics_code → FK integer to core_naics_code.id                    │
│    mcc_code   → FK integer to core_mcc_code.id                      │
│    industry   → FK integer to core_business_industries.id           │
└───────────────────────┬─────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────────────┐
│  STEP 6: Available to consumers                                      │
│                                                                      │
│  Internal:  GET /facts/business/{id}/details → full fact + lineage  │
│  External:  GET /businesses/customers/{id}   → simplified fields    │
│  Redshift:  SELECT FROM dev.rds_warehouse_public.facts               │
│  PDF:       Worth 360 Report shows naics_code + industry            │
│                                                                      │
│  NOTE: classification_codes has no downstream consumer              │
│  (UK SIC, Canadian NAICS captured but never read by any service)    │
└─────────────────────────────────────────────────────────────────────┘
```
