# Industry Classification Facts — Complete End-to-End Reference
## A Step-by-Step Storytelling of the Full Worth AI Pipeline

> All content verified against the actual source code in `SIC-UK-Codes` (warehouse-service, integration-service, case-service) and `Entity-Matching-Ref`.

---

## The Two Pipelines — Overview, Goals, and What Users See

Worth AI runs **two completely separate pipelines** for industry classification. They share some input data but have completely different goals, processing logic, outputs, and audiences.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE A — integration-service  (real-time, per business submission)      │
│                                                                               │
│  GOAL: Deliver the best possible industry classification and KYB facts        │
│        to the customer in real-time, using ALL available sources.             │
│                                                                               │
│  Inputs:  Live API calls (Middesk, Trulioo, SERP) +                          │
│           Redshift table reads (ZoomInfo, Equifax, OC)                        │
│  Sources: ZoomInfo, Equifax, OC, Middesk, Trulioo, SERP, AI (6+ sources)    │
│  Confidence: XGBoost model (most sources) + task-based (Middesk)             │
│              + heuristic similarity_index/55 (fallback)                       │
│  Output:  rds_warehouse_public.facts (JSONB, 217 facts)                      │
│                                                                               │
│  ✅ WHAT THE CUSTOMER/USER SEES:                                              │
│    GET /facts/business/{id}/details → naics_code, mcc_code, industry +       │
│      confidence score per source + alternatives from all 6 sources           │
│    GET /businesses/customers/{id}   → simplified naics_code, naics_title     │
│    Worth 360 Report PDF             → naics_code + industry label            │
│    Worth AI UI                      → classification + KYB facts panel       │
│                                                                               │
│  The customer ONLY sees Pipeline A output. Pipeline B is internal.           │
├──────────────────────────────────────────────────────────────────────────────┤
│  PIPELINE B — warehouse-service  (batch, scheduled Redshift SQL jobs)        │
│                                                                               │
│  GOAL: Build a wide, denormalized analytics table in Redshift that            │
│        the data science team uses for model training, risk scoring,           │
│        and bulk data exports. Speed and scale over completeness.              │
│                                                                               │
│  Inputs:  Pre-loaded Redshift bulk tables ONLY (no live API calls)           │
│  Sources: ZoomInfo + Equifax ONLY (by historical design — see Gap below)     │
│  Confidence: XGBoost entity matching model (zi_probability, efx_probability) │
│              + heuristic similarity_index/55 fallback                         │
│  Output:  datascience.customer_files (wide denormalized table)               │
│                                                                               │
│  ⚠️  WHAT IS NOT VISIBLE TO THE CUSTOMER:                                    │
│    customer_files is an internal Redshift analytics table.                   │
│    Customers cannot query it directly via the Worth AI API.                  │
│    It is used internally for: risk model training, data exports,             │
│    Redshift analytics dashboards, global_trulioo_us_kyb training data.       │
└──────────────────────────────────────────────────────────────────────────────┘

INTERSECTION:
  Both pipelines read the same raw Redshift source tables (ZoomInfo, Equifax, OC).
  The naics_code fact (Pipeline A) and primary_naics_code in customer_files
  (Pipeline B) CAN DIFFER because Pipeline B only considers ZI vs EFX while
  Pipeline A considers all 6 sources. If OC or Middesk had a better match,
  the API response will show a different NAICS than the analytics table.

WHAT THE USER/CUSTOMER SEES — ONLY PIPELINE A:
  The 6 source confidence scores shown in GET /facts/business/{id}/details are:
  - OC confidence    (XGBoost model: oc_probability from ml_model_matches)
  - EFX confidence   (XGBoost model: efx_probability from ml_model_matches)
  - ZI confidence    (XGBoost model: zi_probability from ml_model_matches)
  - Middesk confidence (XGBoost via confidenceScoreMany() OR task-based score)
  - Trulioo confidence (heuristic: match.index / 55 — no XGBoost for Trulioo)
  - AI confidence    (GPT self-reported: HIGH/MED/LOW → numeric mapping)
  All shown in the API response under source.confidence + alternatives[].
```

---

## The Story — Full Timeline From Day 0 to Fact Delivery

### Day 0 — Before Any Business Is Submitted: Loading the Vendor Data

Before a single business applies, Worth AI loads bulk data from vendors into Redshift. This is offline work done by the data engineering team.

**What gets loaded and where:**

| Vendor | Redshift table | Key industry column | How loaded |
|---|---|---|---|
| ZoomInfo | `zoominfo.comp_standard_global` → standardized to `datascience.zoominfo_standard_ml_2` | `zi_c_naics6` (6-digit NAICS) | Bulk file ingestion, regular cadence |
| Equifax | `warehouse.equifax_us_latest` → standardized to `warehouse.equifax_us_standardized` | `efx_primnaicscode` (6-digit NAICS), `efx_primsic` (4-digit SIC) | Bulk file ingestion, **unknown cadence** (documented in source code as a weakness) |
| OpenCorporates | `datascience.open_corporates_standard_ml_2` | `industry_code_uids` (pipe-delimited string) | Bulk file ingestion |
| Liberty | `dev.liberty.einmst_20260218`, `einmst_15_5mn`, `einmst_5_3m_remaining` | NAICS, SIC columns | Bulk file ingestion |

**These tables are the raw vendor data.** They contain millions of company records — one row per vendor company record, not per submitted business.

---

### Day 0 — Pipeline B Setup: Building the Heuristic Similarity Tables

**[PIPELINE B ONLY]**

Before the XGBoost model runs, Worth AI needs to find candidate vendor records for each submitted business. This is done by building similarity tables using Levenshtein string distance.

**What `similarity_index` means:**

`similarity_index` is a custom composite score computed by `smb_zoominfo_standardized_joined.sql`:

```sql
similarity_index =
    (20 - levenshtein_distance(submitted_company_name, vendor_company_name))  -- name component (max 20)
  + (20 - levenshtein_distance(submitted_address, vendor_address))            -- address component (max 20)
  + state_match     -- 1 if state matches, 0 otherwise
  + city_match      -- 1 if city matches, 0 otherwise
  + zipcode_match   -- 1 if ZIP matches, 0 otherwise

-- Maximum possible: 20 + 20 + 1 + 1 + 1 = 43... but can reach 45+ with best-case matches
```

**What `MAX_CONFIDENCE_INDEX = 55` means:**

`MAX_CONFIDENCE_INDEX = 55` is defined in `integration-service/lib/facts/sources.ts` (line 33). It is the denominator used to normalize the `similarity_index` into a 0–1 confidence score:

```
normalized_confidence = similarity_index / 55
```

- `similarity_index = 55` → confidence = 1.0 (perfect match on all fields)
- `similarity_index = 44` → confidence ≈ 0.80 (threshold for being considered matched)
- `similarity_index = 45` → confidence ≈ 0.82 (minimum threshold in SQL: `WHERE similarity_index >= 45`)

This heuristic similarity is the **pre-XGBoost fallback**. It was the original matching method before the XGBoost model was built.

**Tables created at this step:**

| Table | What it contains |
|---|---|
| `datascience.smb_zoominfo_standardized_joined` | Top 1000 ZoomInfo candidate matches per business, ranked by similarity_index |
| `datascience.smb_equifax_standardized_joined` | Top 1000 Equifax candidates per business, ranked by similarity_index |
| `datascience.smb_open_corporate_standardized_joined` | Top 1000 OC candidates per business |

---

### Day 0 — Pipeline B: XGBoost Entity Matching Model Runs

**[PIPELINE B ONLY]**

The Worth AI XGBoost entity matching model (`entity_matching_20250127 v1`) runs on the candidate pairs from the similarity tables. It answers:

> **"Is this submitted business the same real-world entity as this vendor record?"**

**Model inputs (33 pairwise features per candidate pair):**
- Jaccard k-gram similarities on business name (k=1,2,3,4, word-level)
- Jaccard k-gram similarities on street name
- Jaccard k-gram similarities on short name (city-stripped)
- Exact match flags: city, ZIP, street number, address line 2
- Street number distance: `|submitted_num - vendor_num|`
- Block-level match: `submitted_num // 100 == vendor_num // 100`
- Short name match (after stripping legal suffixes: LLC, INC, CORP, etc.)

**Model outputs:** Three probability scores written to `datascience.ml_model_matches`:

| Column | What it means |
|---|---|
| `zi_probability` | Probability that the matched ZoomInfo record is the same business |
| `efx_probability` | Probability that the matched Equifax record is the same business |
| `oc_probability` | Probability that the matched OC record is the same business |

`datascience.ml_model_matches` is **the central XGBoost output table**. It holds one row per business per source showing which vendor record was matched and how confident the model is.

---

### Day 0 — Pipeline B: Building the Match Tables

**[PIPELINE B ONLY]**

Three stored procedures build the final match tables by combining XGBoost results with the heuristic fallback:

**`sp_truncate_and_insert_zoominfo_matches_custom_inc_ml()` → `datascience.zoominfo_matches_custom_inc_ml`**

```sql
-- TIER 1: XGBoost matched with high confidence
SELECT business_id, zi_c_company_id, zi_c_location_id, zi_es_location_id,
       zi_probability
FROM datascience.ml_model_matches
WHERE zi_probability >= 0.8          -- XGBoost threshold

UNION ALL

-- TIER 2: Heuristic fallback (businesses XGBoost didn't match with >= 0.8)
SELECT business_id, zi_c_company_id, zi_c_location_id, zi_es_location_id,
       NULL AS zi_probability, similarity_index
FROM datascience.smb_zoominfo_standardized_joined
WHERE similarity_index_rank = 1      -- best heuristic match
  AND similarity_index >= 45         -- minimum heuristic threshold
  AND business_id NOT IN (XGBoost results)
```

**Same pattern for Equifax** → `datascience.efx_matches_custom_inc_ml`
**Same pattern for OC** → `datascience.oc_matches_custom_inc_ml`

**What these tables contain:**
- For businesses where XGBoost scored ≥ 0.80: the XGBoost probability
- For other businesses: the heuristic similarity_index
- For businesses where neither threshold was met: no row (business has no match)

---

### Day 0 — Pipeline B: Building the Combined Firmographic Table

**[PIPELINE B ONLY]**

`smb_zi_oc_efx_combined.sql` joins the match tables back to the vendor data tables to pull the actual firmographic fields (NAICS, address, name, etc.):

**How `zi_match_confidence` and `efx_match_confidence` are built:**

```sql
-- ZoomInfo confidence (from smb_zi_oc_efx_combined.sql):
zi_match_confidence =
    CASE
        WHEN zi_probability IS NOT NULL          THEN zi_probability         -- XGBoost score (0.8–1.0)
        WHEN similarity_index IS NOT NULL
             AND similarity_index / 55.0 >= 0.8  THEN similarity_index / 55.0 -- heuristic (0.8–1.0)
        ELSE 0                                                                 -- no match
    END

-- Equifax confidence:
efx_match_confidence =
    CASE
        WHEN efx_probability IS NOT NULL         THEN efx_probability
        WHEN similarity_index IS NOT NULL
             AND similarity_index / 55.0 >= 0.8  THEN similarity_index / 55.0
        ELSE 0
    END

-- OC confidence (also computed, but NOT used in customer_table.sql):
oc_match_confidence =
    CASE
        WHEN oc_probability IS NOT NULL          THEN oc_probability
        WHEN similarity_index / 55.0 >= 0.8      THEN similarity_index / 55.0
        ELSE 0
    END
```

**Output table:** `datascience.smb_zi_oc_efx_combined` — one row per business with:
- ZoomInfo firmographic fields (`zi_c_naics6`, `zi_c_name`, `zi_c_street`, etc.)
- Equifax firmographic fields (`efx_primnaicscode`, `efx_name`, `efx_address`, etc.)
- OC firmographic fields (company_number, jurisdiction_code, etc.)
- `zi_match_confidence`, `efx_match_confidence`, `oc_match_confidence`

This table then flows through `smb_pr_verification_cs` (which adds verification data from case-service) and finally into `customer_table.sql`.

---

### Day 0 — Pipeline B: The Production Winner-Takes-All Rule

**[PIPELINE B ONLY]**

`sp_recreate_customer_files()` runs `customer_table.sql` and creates `datascience.customer_files`. This is the production Redshift analytics table.

**The classification rule — verified from actual SQL:**

```sql
-- NAICS code selection:
primary_naics_code =
    COALESCE(
        CASE
            WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
                THEN CAST(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', '') AS INTEGER)
            ELSE CAST(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', '') AS INTEGER)
        END,
        naics_code  -- fallback to existing stored naics_code if both are null
    )
```

**This same ZI vs EFX comparison controls ALL firmographic fields** — not just NAICS. If ZoomInfo wins, these all come from ZoomInfo; if Equifax wins, they all come from Equifax:

| Field in customer_files | ZoomInfo source | Equifax source |
|---|---|---|
| `primary_naics_code` | `zi_c_naics6` | `efx_primnaicscode` |
| `employee_count` | `zi_c_employees` | `efx_corpempcnt` |
| `year_established` | `zi_c_year_founded` | `efx_yrest` |
| `revenue` | `zi_c_revenue × 1000` | `efx_locamount × 1000` |
| `company_name_firmographic` | `zi_c_name` | `efx_name` |
| `legal_company_name_firmographic` | `zi_c_company_name` | `efx_legal_name` |
| `address` | `zi_c_street` | `efx_address` |
| `city` | `zi_c_city` | `efx_city` |
| `zipcode` | `LEFT(zi_c_zip, 5)` | `CAST(efx_zipcode AS VARCHAR)` |
| `country` | `zi_c_country` | `efx_ctryname` |
| `website_url` | `zi_c_url` | `efx_web` |

**Why only ZoomInfo and Equifax — not OC, Liberty, Middesk, Trulioo?**

Verified from reading all the SQL files. This is a **historical design limitation**, not a technical impossibility:

1. **OC:** The XGBoost model already produces `oc_probability` in `ml_model_matches`, and `oc_match_confidence` is already computed in `smb_zi_oc_efx_combined`. **The match confidence EXISTS — it is just not used in `customer_table.sql`.** The reason: OC stores industry codes as `industry_code_uids` — a pipe-delimited multi-taxonomy string (`us_naics-541110|gb_sic-62012|nace-J6201`). The `customer_table.sql` was never extended to parse this string and extract a numeric NAICS code for the `CASE WHEN` comparison. The data is there; the SQL was never written to use it.

2. **Liberty:** Exists in Redshift (`einmst_*` tables) with NAICS/SIC columns, but was never joined into `smb_zi_oc_efx_combined`. No `liberty_match_confidence` column exists anywhere in Pipeline B. The XGBoost model has never been run against Liberty data in the batch pipeline.

3. **Middesk:** A live API source. Results live in `integration_data.request_response` table (integration-service PostgreSQL), not in the Redshift tables that Pipeline B reads. Middesk would require a different architecture to include in a batch Redshift pipeline.

4. **Trulioo:** Same as Middesk — live API, integration-service PostgreSQL only. Pipeline B cannot access it.

> ⚠️ **GAP AND IMPROVEMENT OPPORTUNITY — Pipeline B Source Coverage**
>
> Pipeline B's `customer_table.sql` compares only `zi_match_confidence vs efx_match_confidence` because when this SQL was originally written, only ZoomInfo and Equifax had clean pre-loaded Redshift tables with numeric NAICS fields. OC, Liberty, Middesk, and Trulioo were added to the system later and only integrated into Pipeline A.
>
> **What could be improved:**
> - **OC in Pipeline B:** `oc_match_confidence` already exists in `smb_zi_oc_efx_combined`. The only missing piece is parsing `industry_code_uids` in `customer_table.sql` to extract `us_naics-XXXXXX`. This is a moderate SQL change that would bring OC (weight 0.9, highest among vendors) into the Pipeline B winner selection.
> - **Liberty in Pipeline B:** The Liberty `einmst_*` tables already exist in Redshift with NAICS/SIC columns. Running the XGBoost entity matching model against Liberty and joining the result into `smb_zi_oc_efx_combined` would extend Pipeline B to a 3rd source.
> - **Impact:** The current gap means Pipeline B's `primary_naics_code` is often less accurate than Pipeline A's `naics_code fact` — specifically for businesses where OC has a stronger match than ZI or EFX (which is common for non-US companies and businesses that are registered but not publicly traded).

**`customer_files` output table columns (key ones):**

| Column | Source | Type |
|---|---|---|
| `business_id` | Worth AI UUID | VARCHAR |
| `primary_naics_code` | ZI or EFX (winner) | INTEGER |
| `primary_naics_description` | EFX `efx_primnaicsdesc` or `naics_desc` | VARCHAR |
| `mcc_code` | Pre-stored in source tables | VARCHAR |
| `match_confidence` | `max(zi_match_confidence, efx_match_confidence)` | FLOAT |
| `zi_match_confidence` | From `smb_zi_oc_efx_combined` | FLOAT |
| `efx_match_confidence` | From `smb_zi_oc_efx_combined` | FLOAT |
| `worth_score` | From scoring pipeline | FLOAT |
| ... | All other firmographic fields | ... |

**This is Pipeline B's final output.** It is used for:
- Risk model training datasets (`datascience.global_trulioo_us_kyb` reads from it)
- Redshift analytics queries
- Data exports to customers

---

### Day 1+ — Pipeline A: Business Submitted (Real-Time)

**[PIPELINE A ONLY]**

A customer calls `POST /businesses/customers/{customerID}`. Worth AI creates a `business_id` (UUID) and triggers Pipeline A.

**The `integration_data.request_response` table** is the central storage for all live API responses in Pipeline A:

| Column | What it stores |
|---|---|
| `request_id` | UUID for this API call |
| `platform_id` | Which integration made the call (see platform IDs below) |
| `business_id` | The submitted business UUID |
| `response` | JSONB — raw API response from the vendor |
| `confidence` | The computed confidence score for this response. **For ZoomInfo, Equifax, and OC: this is the XGBoost entity matching model score (`match.prediction` from `ml_model_matches`), normalized to 0–1.** For Middesk: XGBoost via `confidenceScoreMany()` or task-based (0.15 + 0.20/task). For Trulioo: heuristic `match.index / 55` only — no XGBoost. For AI (GPT): self-reported text (HIGH/MED/LOW). |
| `request_type` | e.g. `"perform_business_enrichment"` |
| `updated_at` | When this record was last updated |

**Platform IDs (from `integrations.constant.ts`):**

| ID | Source |
|---|---|
| 16 | Middesk |
| 17 | Equifax |
| 22 | SERP Scrape |
| 23 | OpenCorporates |
| 24 | ZoomInfo |
| 29 | Entity Matching (XGBoost) |
| 31 | AI NAICS Enrichment (GPT) |
| 32 | Canada Open |
| 38 | Trulioo |

When the Fact Engine reads a source's data, it queries `integration_data.request_response WHERE platform_id = X` — this is how it retrieves each vendor's raw response and confidence score.

---

### Day 1 — Pipeline A: Each Source's Getter Runs

**[PIPELINE A ONLY]**

Each source in `sources.ts` has a `getter()` function that fetches its data and computes its confidence score. This is where the **two-tier confidence system** applies.

**Source 1 — ZoomInfo (platformId = 24)**
- **What it reads:** Queries `integration_data.request_response` where `platform_id = 24`
- **Industry code:** `zi_c_naics6` from the ZoomInfo firmographic record
- **Confidence computation:**
  ```typescript
  // TIER 1: XGBoost match score (from entity matching pipeline)
  this.confidence = match?.prediction       // XGBoost probability 0–1
  // TIER 2: Heuristic fallback
      ?? match?.index / 55                  // similarity_index / MAX_CONFIDENCE_INDEX
  ```
- **Source weight:** `0.8`
- **Where stored:** `integration_data.request_response.confidence`

**Source 2 — Equifax (platformId = 17)**
- **What it reads:** `integration_data.request_response` where `platform_id = 17`
- **Industry code:** `efx_primnaicscode`
- **Confidence computation:** Same two-tier: XGBoost prediction preferred, `similarity_index / 55` fallback
- **Source weight:** `0.7`
- **Note from source code:** *"Equifax has a low weight because it relies upon manual files being ingested at some unknown cadence"*

**Source 3 — OpenCorporates (platformId = 23)**
- **What it reads:** `integration_data.request_response` where `platform_id = 23`
- **Industry code:** Parses `industry_code_uids` string:
  ```typescript
  // From businessDetails/index.ts:
  for (const uid of oc.firmographic.industry_code_uids.split("|")) {
      const [codeName, code] = uid.split("-", 2);
      if (codeName === "us_naics") return code;      // → naics_code fact
      if (codeName === "gb_sic")   return normalized; // → uk_sic_code fact
  }
  ```
- **Confidence computation:** `rawResponse?.prediction` — XGBoost model score
- **Source weight:** `0.9`

**Source 4 — Middesk (platformId = 16)**
- **What it reads:** `integration_data.request_response` where `platform_id = 16`
- **Industry code:** NAICS from SOS filing
- **Confidence computation:**
  ```typescript
  // TIER 1: XGBoost via confidenceScoreMany()
  this.confidence = Math.max(...confidenceScoreMany(submitted, middesk).map(r => r.prediction));
  // TIER 2: Task-based fallback
  let confidence = 0.15;                           // base score
  confidence += isTaskSuccess("name")     ? 0.2 : 0; // +20% per passing task
  confidence += isTaskSuccess("tin")      ? 0.2 : 0;
  confidence += isTaskSuccess("address")  ? 0.2 : 0;
  confidence += isTaskSuccess("sos")      ? 0.2 : 0; // max = 0.95
  ```
- **Source weight:** `2.0`

**Source 5 — Trulioo (platformId = 38)**
- **What it reads:** `integration_data.request_response` where `platform_id = 38`
- **Industry code:** `sicCode` from API response (may be 4-digit = POLLUTED)
- **Confidence computation:**
  ```typescript
  // Heuristic ONLY — no XGBoost for Trulioo:
  const confidenceValue = fields.response.match.index / MAX_CONFIDENCE_INDEX; // index / 55
  ```
- **Source weight:** `0.8`

**Source 6 — SERP/Verdata (platformId = 22)**
- **What it reads:** `integration_data.request_response` where `platform_id = 22`
- **Industry code:** AI inferred from website content
- **Confidence computation:** XGBoost via `confidenceScore()` function
- **Source weight:** `0.8`

**Source 7 — AI NAICS Enrichment (platformId = 31)**
- **What it reads:** `integration_data.request_response` where `platform_id = 31`
- **Industry code:** GPT-5-mini returns naics_code + mcc_code + confidence text
- **Confidence computation:**
  ```typescript
  this.confidence = response?.confidence;  // GPT self-reports "HIGH"|"MED"|"LOW"
  ```
- **Trigger condition:** Only runs if fewer than 3 sources already returned a NAICS code (`maximumSources: 3`)
- **Source weight:** `0.1`

---

### Day 1 — Pipeline A: The Fact Engine Selects the Winner

**[PIPELINE A ONLY]**

After all getter functions run, the Fact Engine (`integration-service/lib/facts/rules.ts`) selects the winning source for each fact.

**Example — selecting the winner for `naics_code`:**

```
Candidates collected:
  Middesk    value="541511"  confidence=0.95  weight=2.0  ← [PIPELINE A: Middesk live API]
  OC         value="541110"  confidence=0.89  weight=0.9  ← [PIPELINE A: OC via XGBoost]
  ZoomInfo   value="541512"  confidence=0.72  weight=0.8  ← [PIPELINE A: ZI via XGBoost]
  Equifax    value="541511"  confidence=0.68  weight=0.7  ← [PIPELINE A: EFX via XGBoost]
  Trulioo    value="7372"    confidence=0.55  weight=0.8  ← [PIPELINE A: Trulioo heuristic]
  AI         value="541511"  confidence=0.70  weight=0.1  ← [PIPELINE A: GPT fallback]

Step 1 — factWithHighestConfidence() [rules.ts line 36]:
  Sort by confidence: Middesk(0.95) > OC(0.89) > ZI(0.72) > AI(0.70) > EFX(0.68) > Trulioo(0.55)
  Compare top two: |0.95 - 0.89| = 0.06 > WEIGHT_THRESHOLD(0.05)
  → Middesk wins outright (confidence difference > 5%)

If top two were within 5%:
Step 2 — weightedFactSelector() [rules.ts line 62]:
  Compare source weights → higher weight wins the tie

If analyst override exists:
Step 3 — manualOverride() [rules.ts line 108]:
  Always wins regardless of confidence

Result: naics_code = "541511"  source=Middesk  confidence=0.95
```

**The winner is stored as a Fact object with full lineage:**
```json
{
  "name": "naics_code",
  "value": "541511",
  "source": { "confidence": 0.95, "platformId": 16 },
  "override": null,
  "alternatives": [
    { "value": "541110", "source": 23, "confidence": 0.89 },
    { "value": "541512", "source": 24, "confidence": 0.72 }
  ]
}
```

---

### Day 1 — Pipeline A: Kafka and Persistence

**[PIPELINE A ONLY]**

The Fact Engine publishes the FactEnvelope to **Kafka topic `facts.v1`**:

```
Key Kafka events triggered:
  CALCULATE_BUSINESS_FACTS      → initial fact calculation complete
  UPDATE_NAICS_CODE             → when naics_code changes
  PROCESS_COMPLETION_FACTS      → after all verifications done
  FACT_OVERRIDE_CREATED_AUDIT   → when analyst creates an override
```

The **warehouse-service** `FactService.consume()` subscribes to `facts.v1` and upserts each fact into:

**`rds_warehouse_public.facts` — the primary fact store:**

```
Table schema (from datapooler/adapters/db/models/facts.py):
  business_id  VARCHAR   (composite PK with name)
  name         VARCHAR   (the fact key)
  value        JSONB     (flexible payload)
  received_at  TIMESTAMP
  created_at   TIMESTAMP
  updated_at   TIMESTAMP

Upsert behaviour:
  session.merge(fact_db)  → INSERT ON CONFLICT (business_id, name) DO UPDATE
  → Never creates duplicate rows
  → Always overwrites with latest value
```

**The case-service** subscribes to `UPDATE_NAICS_CODE` and calls `addIndustryAndNaicsPlatform()`, which updates:

**`rds_cases_public.data_businesses`:**
```sql
data_businesses.naics_code → FK to core_naics_code.id (integer, NOT the code string)
data_businesses.mcc_code   → FK to core_mcc_code.id
data_businesses.industry   → FK to core_business_industries.id
```

---

## The Intersection Between Pipeline A and Pipeline B

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SHARED INPUT (both pipelines read the same Redshift source tables)         │
│                                                                              │
│  ZoomInfo:  zoominfo.comp_standard_global → zoominfo_standard_ml_2         │
│  Equifax:   warehouse.equifax_us_latest → equifax_us_standardized           │
│  OC:        datascience.open_corporates_standard_ml_2                       │
│                                                                              │
│  Both pipelines also run the SAME Worth AI XGBoost entity matching model   │
│  to produce zi_probability, efx_probability, oc_probability                 │
│  (stored in datascience.ml_model_matches)                                   │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
          ┌────────────────────┴─────────────────────┐
          ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE A OUTPUT          │         PIPELINE B OUTPUT                     │
│  [CUSTOMER-FACING]          │         [INTERNAL ONLY]                       │
│                             │                                               │
│  rds_warehouse_public.facts │         datascience.customer_files            │
│  (JSONB, 217 facts)         │         (wide denormalized table)             │
│                             │                                               │
│  naics_code fact:           │         primary_naics_code:                  │
│  winner from ALL 6 sources  │  ←CAN→  winner from ZI vs EFX ONLY           │
│  using XGBoost confidence   │ DIFFER  using XGBoost zi/efx_match_confidence│
│                             │                                               │
│  Includes: OC ✅             │         OC: XGBoost runs ✅ but SQL gap ⚠️  │
│            Middesk ✅        │         Middesk: live API, not in batch ❌   │
│            Trulioo ✅        │         Trulioo: live API, not in batch ❌   │
│            AI/GPT ✅         │         AI/GPT: integration-service only ❌  │
│            Liberty ✅        │         Liberty: never joined into batch ❌  │
└─────────────────────────────┘         └─────────────────────────────────────┘
          │                                           │
          ▼                                           ▼
   ✅ WHAT CUSTOMERS/USERS SEE:           ⚠️ INTERNAL USE ONLY:
   REST API response                       Redshift analytics queries
   Worth 360 Report PDF                    KYB risk model training data
   Worth AI UI (classification panel)      datascience.global_trulioo_us_kyb
   GET /facts/business/{id}/details        Data science experiments
     → naics_code + confidence per source  Bulk customer data exports
     → all 6 source confidences shown
     → alternatives[] with all sources
   GET /businesses/customers/{id}
     → simplified naics_code, mcc_code
```

**The 6 confidence scores shown to the customer (Pipeline A output):**

All sourced from `integration_data.request_response.confidence`, which is populated by:

| Source shown in API | `source.confidence` value | Produced by |
|---|---|---|
| OpenCorporates (platformId=23) | `oc_probability` from `ml_model_matches` | **Worth AI XGBoost model** |
| Equifax (platformId=17) | `efx_probability` from `ml_model_matches` | **Worth AI XGBoost model** |
| ZoomInfo (platformId=24) | `zi_probability` from `ml_model_matches` | **Worth AI XGBoost model** |
| Middesk (platformId=16) | XGBoost via `confidenceScoreMany()` OR `0.15 + 0.20 × tasks passed` | **Worth AI XGBoost model** (preferred) or task-based fallback |
| Trulioo (platformId=38) | `match.index / 55` (Levenshtein heuristic) | **Heuristic only — no XGBoost** |
| AI/GPT (platformId=31) | Self-reported: `"HIGH"`→~0.70 / `"MED"`→~0.50 / `"LOW"`→~0.30 | **GPT self-assessment** |

**When do Pipeline A and Pipeline B show different NAICS codes?**

If OC or Middesk won in Pipeline A (higher XGBoost confidence than ZI or EFX), then:
- Customer sees via API: `naics_code` = OC or Middesk's code (Pipeline A winner)
- In Redshift `customer_files`: `primary_naics_code` = whichever of ZI or EFX won (Pipeline B winner)

These can and do disagree. This is most common for non-US businesses (where OC has better data than ZI/EFX) and for recently registered businesses (where Middesk SOS filings have more current data than the periodic bulk loads).

---

## The 8 Classification Facts — Full Specification

### Storage infrastructure for all 8 facts

```
PRIMARY STORE:  rds_warehouse_public.facts
  One row per fact per business.
  Schema: (business_id, name) → value (JSONB), received_at
  Upsert on (business_id, name) — always latest value wins.

DENORMALIZED:   rds_cases_public.data_businesses
  naics_code → FK to core_naics_code.id
  mcc_code   → FK to core_mcc_code.id
  industry   → FK to core_business_industries.id

LOOKUP TABLES:
  core_naics_code           (id, code, description, sector...)
  core_mcc_code             (id, code, description)
  core_naics_mcc_code       (joined NAICS + MCC mappings)
  rel_naics_mcc             (NAICS ↔ MCC crosswalk)
  core_business_industries  (industry category labels)
```

---

### Fact 1: `naics_code`
**[PIPELINE A — Fact Engine winner]**

**What it is:** The single best 6-digit NAICS 2022 code for this business.

**Winner selection priority (confidence × weight):**

| Priority | Source | Code field | Weight | Confidence method |
|---|---|---|---|---|
| 1st | Middesk | SOS filing NAICS | 2.0 | XGBoost OR task-based (0.15 + 0.20/task) |
| 2nd | OpenCorporates | `us_naics-XXXXXX` from `industry_code_uids` | 0.9 | XGBoost prediction |
| 3rd | ZoomInfo | `zi_c_naics6` | 0.8 | XGBoost OR similarity_index/55 |
| 4th | Trulioo | `naicsCode` (may be POLLUTED) | 0.8 | similarity_index/55 only |
| 5th | Equifax | `efx_primnaicscode` | 0.7 | XGBoost OR similarity_index/55 |
| 6th | GPT-5-mini AI | AI-generated code | 0.1 | Self-reported HIGH/MED/LOW |
| Last | Hardcoded | `"561499"` | n/a | Validation failure fallback |

**Post-processing — validation step (from `aiNaicsEnrichment.ts`):**
```typescript
// After winner selected — validate against core_naics_code table:
const naicsInfo = await internalGetNaicsCode(winner.naics_code);
if (!naicsInfo?.[0]?.naics_label) {
    removeNaicsCode();  // replace with "561499"
}
```

**JSONB payload in `rds_warehouse_public.facts`:**
```json
{
  "code": "541511",
  "description": "Custom Computer Programming Services",
  "source": { "confidence": 0.95, "platformId": 16 },
  "override": null,
  "alternatives": [
    { "value": "541110", "source": 23, "confidence": 0.89 },
    { "value": "541512", "source": 24, "confidence": 0.72 }
  ]
}
```

**Queries:**
```sql
-- From facts table:
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'naics_code';

-- Decoded with label:
SELECT b.id, n.code, n.description
FROM dev.rds_cases_public.data_businesses b
JOIN dev.rds_cases_public.core_naics_code n ON n.id = b.naics_code
WHERE b.id = '<uuid>';
```

---

### Fact 2: `naics_description`
**[PIPELINE A — derived from naics_code]**

**What it is:** Human-readable label for the winning NAICS code.

**How computed:** After `naics_code` is resolved, `internalGetNaicsCode(code)` queries `core_naics_code` and the description is stored as a separate fact.

**JSONB payload:** `{ "description": "Custom Computer Programming Services" }`

---

### Fact 3: `mcc_code`
**[PIPELINE A — three possible paths]**

**What it is:** 4-digit Merchant Category Code used by Visa/Mastercard to categorize businesses for interchange rates and fraud rules.

**Three paths — in priority order:**

```
Path A — Direct from vendor (most reliable):
  Middesk or Trulioo directly returns an MCC code in their API response.
  → stored immediately as mcc_code fact
  → mcc_code_found = true

Path B — Crosswalk from NAICS (most common):
  After naics_code is resolved, look up the mapping:
  SELECT mcc_code FROM dev.rds_cases_public.rel_naics_mcc
  WHERE naics_code = '541511';
  → Returns: 7372
  → stored as mcc_code fact
  → mcc_code_found = false, mcc_code_from_naics = "7372"

Path C — AI Enrichment (fallback):
  GPT-5-mini returns mcc_code alongside naics_code.
  → stored as mcc_code fact
```

**JSONB payload:** `{ "code": "7372", "description": "Computer Programming, Data Processing" }`

**Storage:**
```
rds_warehouse_public.facts  (name="mcc_code")
rds_cases_public.data_businesses.mcc_code → FK to core_mcc_code.id
```

---

### Fact 4: `mcc_code_found`
**[PIPELINE A — boolean flag]**

**What it is:** Was MCC found directly from a vendor source (not derived via NAICS crosswalk)?

- `true` → Middesk or Trulioo directly returned the MCC
- `false` → MCC was derived from the NAICS→MCC crosswalk table

**Why it matters:** A directly found MCC is authoritative; a derived one is an approximation via a many-to-many crosswalk.

**JSONB payload:** `{ "value": true }` or `{ "value": false }`

---

### Fact 5: `mcc_code_from_naics`
**[PIPELINE A — crosswalk derivation]**

**What it is:** The specific MCC code derived from the NAICS→MCC crosswalk, separately recorded.

**Crosswalk query used:**
```sql
SELECT mcc_code FROM dev.rds_cases_public.rel_naics_mcc
WHERE naics_code = '541511';
-- Returns: 7372 (Computer Programming)
```

**When stored:** Always computed alongside mcc_code. If `mcc_code_found = false`, then `mcc_code` and `mcc_code_from_naics` contain the same value.

**JSONB payload:** `{ "code": "7372", "description": "Computer Programming, Data Processing" }`

---

### Fact 6: `mcc_description`
**[PIPELINE A — derived from mcc_code]**

**What it is:** Human-readable label for the MCC code.

**How computed:** After `mcc_code` is resolved, `internalGetMccCode(code)` queries `core_mcc_code`.

**JSONB payload:** `{ "description": "Computer Programming, Data Processing" }`

---

### Fact 7: `industry`
**[PIPELINE A — Fact Engine winner]**

**What it is:** High-level category label for easy UI display. Less precise than NAICS but more human-readable.

**Sources:**
- ZoomInfo `zi_c_industry` or `zi_c_sub_industry`
- OC industry text from `industry_code_uids`
- SERP scrape AI text interpretation
- Derived from NAICS → mapped via `core_business_industries` lookup

**Storage:**
```
rds_warehouse_public.facts  (name="industry")
rds_cases_public.data_businesses.industry → FK to core_business_industries.id
```

**Lookup:**
```sql
SELECT i.name AS industry_label
FROM dev.rds_cases_public.data_businesses b
JOIN dev.rds_cases_public.core_business_industries i ON i.id = b.industry
WHERE b.id = '<uuid>';
```

---

### Fact 8: `classification_codes`
**[PIPELINE A — pre-winner snapshot, all sources]**

**What it is:** The complete raw picture — every industry code from every source and every taxonomy system — captured BEFORE the Fact Engine picks a winner.

**How populated (from `businessDetails/index.ts`):**
Every vendor's codes are collected into this fact:
- OC `industry_code_uids`: `us_naics-541110|gb_sic-62012|nace-J6201` → all three extracted
- ZoomInfo: `zi_c_naics6` + `zi_c_sic4`
- Equifax: `efx_primnaicscode` + `efx_primsic` + up to 4 secondary NAICS

**JSONB payload:**
```json
{
  "codes": [
    { "system": "NAICS",  "code": "541511", "source": "Middesk",   "confidence": 0.95 },
    { "system": "NAICS",  "code": "541110", "source": "OC",         "confidence": 0.89 },
    { "system": "uk_sic", "code": "62012",  "source": "OC",         "confidence": 0.89 },
    { "system": "nace",   "code": "J6201",  "source": "OC",         "confidence": 0.89 },
    { "system": "NAICS",  "code": "541512", "source": "ZoomInfo",   "confidence": 0.72 },
    { "system": "NAICS",  "code": "541511", "source": "Equifax",    "confidence": 0.68 }
  ]
}
```

**Critical known gap:** UK SIC, NACE, Canadian NAICS codes are correctly captured in this fact. But **no Kafka consumer, API endpoint, PDF report, or database column reads `classification_codes`**. The UK SIC code `62012` from OC exists in the system but is never used by any downstream process. This is one of the four confirmed gaps the Consensus Engine addresses.

**Storage:** `rds_warehouse_public.facts` ONLY — not in `data_businesses`

---

## Complete Data Flow Summary

```
T=0  Vendor data pre-loaded into Redshift (bulk, offline)
     zoominfo_standard_ml_2 ← zi_c_naics6, zi_c_name, etc.
     equifax_us_standardized ← efx_primnaicscode, efx_name, etc.
     open_corporates_standard_ml_2 ← industry_code_uids, jurisdiction_code

T=1  [PIPELINE B] Heuristic similarity tables built (Redshift SQL jobs)
     smb_zoominfo_standardized_joined  ← similarity_index (Levenshtein score)
     smb_equifax_standardized_joined   ← similarity_index
     smb_open_corporate_standardized_joined ← similarity_index
     NOTE: similarity_index = name_distance(max 20) + address_distance(max 20)
            + state_match(0/1) + city_match(0/1) + zipcode_match(0/1)
           MAX_CONFIDENCE_INDEX = 55 (used to normalize: index/55 = 0–1)

T=2  [PIPELINE B] XGBoost entity matching model runs
     Input: 33 pairwise text/address features per candidate pair
     Output: datascience.ml_model_matches
       → zi_probability (0–1): "Is this ZI record the same business?"
       → efx_probability (0–1): "Is this EFX record the same business?"
       → oc_probability (0–1): "Is this OC record the same business?"

T=3  [PIPELINE B] Match tables built
     efx_matches_custom_inc_ml: XGBoost efx_probability ≥ 0.8 UNION heuristic ≥ 45/55
     zoominfo_matches_custom_inc_ml: XGBoost zi_probability ≥ 0.8 UNION heuristic ≥ 45/55
     oc_matches_custom_inc_ml: XGBoost oc_probability ≥ 0.8 UNION heuristic ≥ 45/55

T=4  [PIPELINE B] Combined firmographic table built
     smb_zi_oc_efx_combined:
       zi_match_confidence = zi_probability ?? similarity_index/55 ?? 0
       efx_match_confidence = efx_probability ?? similarity_index/55 ?? 0
       oc_match_confidence = oc_probability ?? similarity_index/55 ?? 0
       + all firmographic fields joined from vendor tables

T=5  [PIPELINE B] Production rule runs → customer_files created
     WHEN zi_match_confidence > efx_match_confidence → ALL fields from ZoomInfo
     ELSE → ALL fields from Equifax
     Output: datascience.customer_files (NAICS, name, address, revenue, etc.)
     Used by: analytics, risk model training, data exports

===== Business Submitted (T=6, real-time) =====

T=6  [PIPELINE A] Business submitted via API
     → business_id (UUID) created in case-service PostgreSQL
     → integration pipeline triggered
     → integration_data.request_response table receives all API responses

T=7  [PIPELINE A] Live API sources called
     Middesk (platform_id=16): SOS verification API
       → returns NAICS from filing, task results, confidence
       → stored in integration_data.request_response
     Trulioo (platform_id=38): business verification API
       → returns sicCode (may be 4-digit = POLLUTED)
     SERP (platform_id=22): website scrape

T=8  [PIPELINE A] Redshift table sources read
     ZoomInfo (platform_id=24): reads zoominfo_standard_ml_2
       confidence = match.prediction (XGBoost) ?? match.index/55
     Equifax (platform_id=17): reads equifax_us_standardized
       confidence = match.prediction (XGBoost) ?? match.index/55
     OC (platform_id=23): reads open_corporates_standard_ml_2
       confidence = rawResponse.prediction (XGBoost)
       industry = parses industry_code_uids → us_naics, gb_sic, nace

T=9  [PIPELINE A] Fact Engine selects winner (integration-service)
     factWithHighestConfidence() → sort all sources by confidence
     If diff < 0.05 → weightedFactSelector() → use source weight
     manualOverride() → analyst override always wins
     AI runs IF < 3 sources returned naics_code (saves OpenAI credits)
     POST-PROCESSING: validate code against core_naics_code → 561499 if invalid

T=10 [PIPELINE A] 8 classification facts produced
     naics_code, naics_description, mcc_code, mcc_description,
     mcc_code_found, mcc_code_from_naics, industry, classification_codes
     ALL stored in integration_data.request_response (source: platform_id=31)

T=11 [PIPELINE A] Kafka: facts.v1 topic
     FactEnvelope published with all 8 facts + alternatives + source lineage

T=12 [PIPELINE A] warehouse-service persists
     rds_warehouse_public.facts: (business_id, name) → JSONB value
       Upsert: INSERT ON CONFLICT (business_id, name) DO UPDATE
     case-service: data_businesses.naics_code → FK to core_naics_code.id

T=13 [BOTH PIPELINES] Data available to consumers
     PIPELINE A:
       GET /facts/business/{id}/details → full fact with confidence + alternatives
       GET /businesses/customers/{id}   → simplified naics_code, mcc_code, industry
       Worth 360 Report PDF             → naics_code + industry
     PIPELINE B:
       SELECT FROM datascience.customer_files → wide table for analytics
       SELECT FROM rds_warehouse_public.facts → JSONB fact store
```
