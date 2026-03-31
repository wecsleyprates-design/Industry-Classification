# Industry Classification Facts — Complete End-to-End Reference

**Purpose:** Step-by-step explanation of how classification facts are gathered from each vendor source, how the Winning Source is selected, how facts are stored, and what each of the 8 classification facts contains.

---

## Part 1 — What Each Source Delivers

Before any fact is calculated, six vendor sources are queried. Each returns an industry code and a confidence score.

---

### Source 1: ZoomInfo

**How data arrives:** ZoomInfo data is loaded in bulk into Redshift as a standardized table.

**Redshift table:** `dev.datascience.zoominfo_standard_ml_2`

**Key industry fields:**

| Field | Type | What it contains |
|---|---|---|
| `zi_c_naics6` | VARCHAR(6) | **Primary 6-digit NAICS code** — the main industry code used for classification |
| `zi_c_sic4` | VARCHAR(4) | 4-digit SIC code |
| `zi_c_industry` | VARCHAR | Industry text label |
| `zi_c_sub_industry` | VARCHAR | Sub-industry text |
| `zi_match_confidence` | FLOAT | Level 1 XGBoost entity match confidence (0–1) |
| `zi_c_company_id` | VARCHAR | ZoomInfo company identifier |
| `zi_c_location_id` | VARCHAR | ZoomInfo location identifier |

**Industry code used for the naics_code fact:** `zi_c_naics6`

**Example:** `zi_c_naics6 = "334118"` → Computer and Peripheral Equipment Manufacturing

**Weight in Fact Engine:** `0.80`

**Confidence calculation:** `match_index / 55` (where match_index is the entity matching score)

**Geographic coverage:** Global — used for US, GB, CA, IE, and all other countries

**Where to query it:**
```sql
SELECT zi_c_naics6, zi_c_sic4, zi_c_industry, zi_match_confidence
FROM dev.datascience.zoominfo_standard_ml_2
WHERE zi_c_company_id = '<id>';
```

---

### Source 2: Equifax

**How data arrives:** Equifax data is loaded into Redshift as a standardized table (US only).

**Redshift table:** `dev.warehouse.equifax_us_standardized`

**Key industry fields:**

| Field | Type | What it contains |
|---|---|---|
| `efx_primnaicscode` | VARCHAR(6) | **Primary 6-digit NAICS code** — main classification code |
| `efx_primsic` | VARCHAR(4) | Primary SIC code |
| `efx_primnaicsdesc` | VARCHAR | Description of the primary NAICS |
| `efx_secnaics1` … `efx_secnaics4` | VARCHAR | Up to 4 secondary NAICS codes |
| `efx_match_confidence` | FLOAT | Level 1 XGBoost entity match confidence (0–1) |

**Industry code used for the naics_code fact:** `efx_primnaicscode`

**Example:** `efx_primnaicscode = "541511"` → Custom Computer Programming Services

**Weight in Fact Engine:** `0.70`

**Confidence calculation:** AI prediction confidence OR `match_index / 55`

**Geographic coverage:** US only — Equifax is excluded for UK, Canada, and Ireland

**Where to query it:**
```sql
SELECT efx_primnaicscode, efx_primsic, efx_primnaicsdesc, efx_match_confidence
FROM dev.warehouse.equifax_us_standardized
WHERE efx_id = '<id>';
```

---

### Source 3: OpenCorporates (OC)

**How data arrives:** OC data is loaded into Redshift with a pipe-delimited multi-taxonomy field.

**Redshift table:** `dev.datascience.open_corporates_standard_ml_2`

**Key industry fields:**

| Field | Type | What it contains |
|---|---|---|
| `industry_code_uids` | VARCHAR | **Pipe-delimited multi-taxonomy string** — all industry codes from all taxonomies |
| `jurisdiction_code` | VARCHAR | OC jurisdiction (e.g. `us_nj`, `gb`, `de`) |
| `oc_probability` | FLOAT | Level 1 XGBoost entity match confidence (0–1) |
| `company_number` | VARCHAR | OC company identifier |

**How `industry_code_uids` looks:**
```
us_naics-541110|gb_sic-62012|nace-J6201|us_sic-7372
```
Each pipe-separated segment is `{taxonomy}-{code}`. The Fact Engine parses this field.

**Industry code used for the naics_code fact:**
The FactEngine loops through `industry_code_uids`, finds entries prefixed `us_naics`, and extracts the code.
`us_naics-541110` → `naics_code = "541110"`

**Important gap:** The loop only extracts `us_naics`. Codes for `gb_sic`, `uk_sic`, `nace`, `ca_naics` are parsed into the `classification_codes` fact but have **no downstream consumer** — they are not stored to any dedicated column or used by the production rule.

**Weight in Fact Engine:** `0.90` — highest among all vendor sources

**Confidence calculation:** `match_index / 55`

**Geographic coverage:** Global — all countries

**Where to query it:**
```sql
SELECT industry_code_uids, jurisdiction_code, oc_probability
FROM dev.datascience.open_corporates_standard_ml_2
WHERE company_number = '<number>'
  AND jurisdiction_code = '<jc>';
```

---

### Source 4: Middesk

**How data arrives:** Middesk calls a live API during the business verification pipeline.

**Storage:** Results are stored in the integration-service's PostgreSQL database as a task response, then published via Kafka to the warehouse.

**Key industry fields:**

| Field | What it contains |
|---|---|
| `naics_code` | NAICS code from SOS (Secretary of State) filing |
| `sic_code` | SIC code |
| `industry` | Industry description text |
| `entity_type` | LLC, Corporation, etc. |
| Task responses | Middesk runs multiple verification tasks (name, address, TIN, SOS) — each task returns a result with a `success/failure` status |

**Industry code used for naics_code fact:** `naics_code` from Middesk's SOS filing data. If Middesk returns a SIC code without a NAICS, a SIC→NAICS crosswalk is applied.

**Weight in Fact Engine:** `1.0` — highest weight of all sources

**Confidence calculation:** `0.15 base + 0.20 per successful verification task`. Example: if 4 out of 5 tasks pass → confidence = 0.15 + (4 × 0.20) = 0.95

**Geographic coverage:** US only

**Where to query:** Not directly in Redshift. Lives in integration-service PostgreSQL tables; exposed via API.

---

### Source 5: Verdata / SERP Scrape

**How data arrives:** The integration-service runs a SERP (search engine) scrape of the company's web presence and website.

**Key industry fields:**

| Field | What it contains |
|---|---|
| Website content analysis | Industry category inferred from website text, meta tags, Google Business listing |
| SERP result | Google Business category, industry keywords |
| AI label | The AI model's interpretation of the website → maps to NAICS |

**Industry code:** Inferred from web content → mapped to NAICS via AI or keyword rules. Not a direct vendor code.

**Weight in Fact Engine:** n/a as primary source, used as a signal booster

**Confidence calculation:** `0.5 base + 0.3 boost` if corroborating evidence found on website

---

### Source 6: Trulioo

**How data arrives:** Trulioo is called live via API during the business verification pipeline.

**Key industry fields:**

| Field | What it contains |
|---|---|
| `sicCode` | SIC code returned by Trulioo |
| `naicsCode` | NAICS code (when available) |

**Important Trulioo-specific issue — POLLUTED status:**
Trulioo frequently returns a **4-digit SIC code** when a 5 or 6-digit code is expected. Example: returns `5812` instead of `58121`. This truncated code is flagged as `POLLUTED`. The Fact Engine detects this: `digit_count == 4` → sets `tru_pollution_flag = 1` → reduces weight of Trulioo's code in the classification.

**Weight in Fact Engine:** `0.80`, but reduced when POLLUTED

**Confidence calculation:** Trulioo's own confidence model output (0–1)

**Geographic coverage:** Global

---

### Source 7: GPT-4o-mini AI Enrichment

**This is not a primary source — it is the final fallback.**

**Trigger condition:** AI enrichment runs when:
- No vendor source reached sufficient confidence, OR
- The winning vendor code is not found in the `core_naics_code` lookup table (validation step)
- This is configured in `DEPENDENT_FACTS` — specific fact names trigger AI enrichment asynchronously after the initial fact calculation

**How it works (`aiNaicsEnrichment.ts`):**
```
Input to GPT-4o-mini:
  - Business name
  - Address
  - Website SERP summary (scraped content)
  - Existing vendor codes (as context)

Prompt instructs GPT-4o-mini to return:
  - 6-digit NAICS code
  - 4-digit MCC code
  - Confidence: "HIGH" | "MEDIUM" | "LOW"
  - Reasoning text (why this code was chosen)

Output example:
  {
    "naics_code": "722511",
    "mcc_code": "5812",
    "confidence": "HIGH",
    "reasoning": "Company operates full-service dining establishments..."
  }
```

**Weight in Fact Engine:** `0.10` — the lowest weight. AI enrichment participates in winner selection but is very unlikely to override a vendor with reasonable confidence.

**Confidence mapping:**
- `"HIGH"` → 0.70
- `"MEDIUM"` → 0.50
- `"LOW"` → 0.30

**Last resort code:** If GPT-4o-mini also cannot determine the code → returns `naics_code = "561499"` (All Other Business Support Services) + `mcc_code = "5614"`. This code appears in `data_businesses.naics_code` for businesses where no source had any usable signal.

**Storage:**
- `rds_warehouse_public.facts` — stored as fact `naics_code` with `source.platformId` = AI enrichment platform ID
- `data_businesses.naics_code` — FK to `core_naics_code`

**Validation step after AI enrichment:**
After any NAICS code is selected (from any source including AI), it is validated against `core_naics_code` table. If the code does not exist in that table → it is replaced with `561499`. This prevents invalid codes from entering the system.

---

## Part 2 — How All Source Data Is Gathered (The Pipeline)

```
Step 1 — Business submitted to Worth AI
  POST /businesses/customers/{customerID}
  → Worth AI generates a business_id (UUID)
  → Triggers the verification + fact calculation pipeline

Step 2 — Vendor API calls run in parallel (integration-service)
  ┌─────────────────────────────────────────────┐
  │  Middesk    → SOS filing NAICS/SIC          │
  │  ZoomInfo   → zi_c_naics6 from Redshift     │
  │  Equifax    → efx_primnaicscode from Redshift│
  │  OC         → industry_code_uids from RS    │
  │  Trulioo    → sicCode (live API call)       │
  │  SERP       → website scrape (async)        │
  └─────────────────────────────────────────────┘
  Each source returns:
    - industry code (NAICS, SIC, or text)
    - confidence score (0–1)
    - entity match data (name, address similarity)

Step 3 — Source data stored in Redshift (warehouse-service)
  Each source's bulk data lives in its own Redshift table:
    ZoomInfo   → dev.datascience.zoominfo_standard_ml_2
    Equifax    → dev.warehouse.equifax_us_standardized
    OC         → dev.datascience.open_corporates_standard_ml_2
    Liberty    → dev.liberty.einmst_* (three tables, UNION)
  Live API results (Middesk, Trulioo) stored in:
    integration-service PostgreSQL → published to Redshift via Kafka

Step 4 — Level 1 XGBoost entity matching runs (Entity-Matching pipeline)
  For each source, 33 pairwise text/address similarity features computed
  → Outputs: efx_probability, oc_probability, zi_probability (0–1 each)
  Stored in:
    dev.datascience.efx_matches_custom_inc_ml.efx_probability
    dev.datascience.oc_matches_custom_inc_ml.oc_probability
    dev.datascience.zoominfo_matches_custom_inc_ml.zi_probability
  These confidence scores become the inputs to the Fact Engine.
```

---

## Part 3 — The 5-Step Winning Source Selection Rules (Fact Engine)

The Fact Engine (`integration-service/lib/facts/rules.ts`) runs for every fact. For `naics_code`, it collects all available source values and applies these rules in order:

### Rule 1: Collect All Candidates

Every source that returned a NAICS-related code becomes a candidate:

```
Candidates for naics_code fact:
  Middesk:     naics_code = "541511"  confidence = 0.95  weight = 1.0
  OC:          naics_code = "541110"  confidence = 0.89  weight = 0.9
  ZoomInfo:    naics_code = "541512"  confidence = 0.72  weight = 0.8
  Equifax:     naics_code = "541511"  confidence = 0.68  weight = 0.7
  Trulioo:     sic_code   = "7372"    confidence = 0.55  weight = 0.8  [POLLUTED]
  AI:          naics_code = "541511"  confidence = 0.70  weight = 0.1
```

### Rule 2: factWithHighestConfidence()

Sort all candidates by confidence (descending). The source with the highest confidence score wins.

```
Sorted:
  Middesk     0.95  ← WINNER (highest confidence)
  OC          0.89
  ZoomInfo    0.72
  AI          0.70
  Equifax     0.68
  Trulioo     0.55

Result: naics_code = "541511" from Middesk
```

### Rule 3: WEIGHT_THRESHOLD = 0.05 (Tie-break)

If two sources are **within 5% confidence of each other**, confidence alone cannot decide. The tie is broken by **source weight** using `weightedFactSelector()`.

```
Example where tie applies:
  OC       0.89  weight = 0.9
  ZoomInfo 0.87  weight = 0.8
  Difference = 0.02 < WEIGHT_THRESHOLD (0.05) → TIE

weightedFactSelector():
  OC weight (0.9) > ZoomInfo weight (0.8)
  → OC wins the tie
```

Source weight ranking (highest to lowest):
1. Middesk: **1.0**
2. OpenCorporates: **0.9**
3. ZoomInfo: **0.8**
4. Verdata / Trulioo: **0.8**
5. Equifax: **0.7**
6. AI Enrichment: **0.1**

### Rule 4: manualOverride()

An analyst can always override any fact via the API:
```
PATCH /facts/business/{businessId}/override/naics_code
Body: { "value": "722511" }
```
A manual override **always wins**, regardless of source confidence. The override is flagged in the fact's `override` field so it is auditable.

### Rule 5: What Happens When No Source Has Usable Data

This is the fallback cascade:

```
Scenario: No source returned a valid NAICS code, OR
          all returned codes are not in core_naics_code table

Step A: Use highest-ranked available source anyway
  → Even if Trulioo only returned a 4-digit SIC (POLLUTED),
    it is still used as the best available signal

Step B: If no vendor code at all → trigger AI Enrichment
  → aiNaicsEnrichment.ts calls GPT-4o-mini
  → Input: business name + address + website SERP summary
  → Output: 6-digit NAICS + 4-digit MCC + confidence (HIGH/MED/LOW)
  → AI result participates in winner selection with weight = 0.10
  → If AI confidence HIGH (0.70) > any vendor → AI wins

Step C: Validate winning code against core_naics_code table
  → If naics_code NOT in core_naics_code → removeNaicsCode()
  → Replace with hardcoded "561499" (All Other Business Support Services)
  → mcc_code set to "5614"
  → This prevents invalid codes from reaching customers

Step D: "561499" is stored in the facts table and data_businesses
  → Customers see "All Other Business Support Services" as the industry
  → Worth AI analysts can override this via the manual override API
```

### Rule 6: Geographic Exclusions

Certain sources are excluded by country to ensure data quality:

| Country | ZoomInfo | Equifax | OC | Middesk | Trulioo |
|---|---|---|---|---|---|
| US | ✅ | ✅ | ✅ | ✅ | ✅ |
| GB (UK) | ✅ | ❌ excluded | ✅ | ❌ | ✅ |
| CA (Canada) | ✅ | ❌ excluded | ✅ (canada_open) | ❌ | ✅ |
| IE (Ireland) | ✅ | ❌ excluded | ✅ | ❌ | ✅ |

---

## Part 4 — Where the Winning Fact Is Stored

After the Fact Engine picks the winner, the result flows through three storage layers:

### Layer 1: Kafka (facts.v1 topic)

```
integration-service publishes FactEnvelope to Kafka topic facts.v1

Key events triggered:
  CALCULATE_BUSINESS_FACTS  → initial fact calculation
  UPDATE_NAICS_CODE         → when naics_code changes
  PROCESS_COMPLETION_FACTS  → after all verifications complete

Payload (FactEnvelope):
  {
    "business_id": "uuid-...",
    "facts": [
      {
        "name": "naics_code",
        "value": { "code": "541511", "description": "Custom Computer Programming" },
        "source": { "confidence": 0.95, "platformId": 16 },
        "override": null,
        "alternatives": [
          { "value": {"code":"541110"}, "source": 23, "confidence": 0.89 },
          { "value": {"code":"541512"}, "source": 17, "confidence": 0.72 }
        ]
      }
    ]
  }
```

### Layer 2: rds_warehouse_public.facts (PostgreSQL + Redshift mirror)

```
warehouse-service FactService.consume() receives the Kafka message
→ Upserts into the facts table:

Table: rds_warehouse_public.facts

business_id | name               | value (JSONB)                                | received_at
uuid-xxx    | naics_code         | {"code":"541511","description":"Custom..."}  | 2025-03-31T...
uuid-xxx    | naics_description  | {"description":"Custom Computer Programming"} | 2025-03-31T...
uuid-xxx    | mcc_code           | {"code":"7372","description":"Computer..."}  | 2025-03-31T...
uuid-xxx    | industry           | {"value":"Technology"}                        | 2025-03-31T...
uuid-xxx    | classification_codes| {"codes":[{"system":"NAICS","code":"541511"},{"system":"uk_sic","code":"62012"}]} | 2025-03-31T...

Key behaviour:
  - Composite PK: (business_id, name)
  - INSERT ON CONFLICT UPDATE → upsert, never duplicate
  - One row per fact per business
  - value is JSONB → flexible structure per fact type
```

### Layer 3: rds_cases_public.data_businesses (denormalized columns)

```
case-service Kafka handler receives UPDATE_NAICS_CODE event
→ Calls addIndustryAndNaicsPlatform()
→ Updates data_businesses table:

Table: rds_cases_public.data_businesses

Columns updated:
  naics_code  → FK to core_naics_code.id (integer ID, not the code string)
  mcc_code    → FK to core_mcc_code.id
  industry    → FK to core_business_industries.id

Note: data_businesses stores FKs (integer IDs), not the raw codes.
To get the actual code: JOIN core_naics_code ON naics_code = core_naics_code.id
```

---

## Part 5 — The 8 Classification Facts — Full Detail

### Fact 1: `naics_code`

**What it represents:** The single best 6-digit NAICS 2022 code for this company's primary business activity. This is the master industry classification.

**Where it comes from (priority order):**
1. Middesk SOS filing NAICS (weight 1.0, highest)
2. OpenCorporates `industry_code_uids` → `us_naics-XXXXXX` (weight 0.9)
3. ZoomInfo `zi_c_naics6` (weight 0.8)
4. Trulioo `naicsCode` (weight 0.8, reduced if POLLUTED)
5. Equifax `efx_primnaicscode` (weight 0.7)
6. GPT-4o-mini AI enrichment (weight 0.1, fallback only)
7. Hardcoded `"561499"` if all else fails

**JSONB payload in facts table:**
```json
{
  "code": "541511",
  "description": "Custom Computer Programming Services"
}
```

**Database storage:**
```
rds_warehouse_public.facts   → name="naics_code", value={"code":"541511",...}
rds_cases_public.data_businesses → naics_code = <FK integer ID>
```

**Lookup table:**
```sql
SELECT id, code, description FROM dev.rds_cases_public.core_naics_code
WHERE code = '541511';
-- Returns: id=1234, code=541511, description=Custom Computer Programming Services
```

**Query to see it:**
```sql
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'naics_code';
-- Returns: {"code": "541511", "description": "Custom Computer Programming Services"}
```

---

### Fact 2: `naics_description`

**What it represents:** The human-readable label for the winning NAICS code.

**Where it comes from:** Derived automatically after `naics_code` is resolved. The description is looked up from `core_naics_code` table and stored as a separate fact for convenience.

**JSONB payload:**
```json
{ "description": "Custom Computer Programming Services" }
```

**Query:**
```sql
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'naics_description';
```

---

### Fact 3: `mcc_code`

**What it represents:** The 4-digit Merchant Category Code used by payment networks (Visa/Mastercard) to categorize businesses for interchange rates, rewards programs, and fraud rules.

**Where it comes from (three possible paths):**

**Path A — Direct from vendor:**
Some sources (Middesk, Trulioo) directly return an MCC code. This is the most reliable.

**Path B — Derived from naics_code (most common):**
After `naics_code` is resolved, the FactEngine looks up the MCC via the crosswalk table:
```sql
SELECT mcc_code FROM dev.rds_cases_public.rel_naics_mcc
WHERE naics_code = '541511';
-- Returns: 7372 (Computer Programming, Data Processing)
```

**Path C — AI Enrichment fallback:**
GPT-4o-mini returns both `naics_code` and `mcc_code` together.

**JSONB payload:**
```json
{ "code": "7372", "description": "Computer Programming, Data Processing" }
```

**Database storage:**
```
rds_warehouse_public.facts   → name="mcc_code", value={"code":"7372",...}
rds_cases_public.data_businesses → mcc_code = <FK integer ID to core_mcc_code>
```

**Lookup table:**
```sql
SELECT id, code, description FROM dev.rds_cases_public.core_mcc_code
WHERE code = '7372';
```

---

### Fact 4: `mcc_code_found`

**What it represents:** Boolean — was the MCC code found directly from a vendor source (not derived from NAICS)?

**Values:**
- `true` → A vendor directly returned an MCC code (Middesk or Trulioo)
- `false` → The MCC was derived from the NAICS crosswalk (`mcc_code_from_naics`)

**Why it matters:** A directly found MCC (from an authoritative source) is more reliable than one derived via the NAICS→MCC crosswalk, because the crosswalk maps one NAICS to one MCC and may not perfectly capture a multi-category business.

**JSONB payload:**
```json
{ "value": true }
```

**Query:**
```sql
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'mcc_code_found';
```

---

### Fact 5: `mcc_code_from_naics`

**What it represents:** The MCC code that was derived (cross-walked) from the winning `naics_code`. This exists separately from `mcc_code` so analysts can see whether the MCC came from a direct source or was computed.

**How it is computed:**
```sql
-- Crosswalk table: core_naics_mcc_code
-- Maps NAICS 6-digit → MCC 4-digit

SELECT mcc_code
FROM dev.rds_cases_public.rel_naics_mcc
WHERE naics_code = '541511';
-- Returns: 7372
```

**When used:** When `mcc_code_found = false`. The `mcc_code` fact will contain the same value as `mcc_code_from_naics` in this case.

**JSONB payload:**
```json
{ "code": "7372", "description": "Computer Programming, Data Processing" }
```

---

### Fact 6: `mcc_description`

**What it represents:** Human-readable label for the MCC code. Same pattern as `naics_description`.

**Where it comes from:** Looked up from `core_mcc_code` table after `mcc_code` is resolved.

**JSONB payload:**
```json
{ "description": "Computer Programming, Data Processing" }
```

**Query:**
```sql
SELECT value FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>' AND name = 'mcc_description';
```

---

### Fact 7: `industry`

**What it represents:** A high-level human-readable industry category label — less precise than NAICS but easier to display in a UI.

**Where it comes from:**
- OpenCorporates industry text from `industry_code_uids`
- ZoomInfo `zi_c_industry` or `zi_c_sub_industry`
- SERP scrape AI interpretation
- Derived from NAICS → mapped to a human-readable category via `core_business_industries` table

**JSONB payload:**
```json
{ "value": "Technology - Software" }
```
or
```json
{ "value": "Food Service" }
```

**Stored in:**
```
rds_warehouse_public.facts       → name="industry"
rds_cases_public.data_businesses → industry = <FK integer ID to core_business_industries>
```

**Lookup table:**
```sql
SELECT id, name FROM dev.rds_cases_public.core_business_industries
WHERE id = <industry_id>;
```

---

### Fact 8: `classification_codes`

**What it represents:** The complete raw multi-source, multi-taxonomy view — all industry codes returned by all sources BEFORE the Fact Engine picks a winner. This is a pre-decision snapshot.

**Where it comes from:** The FactEngine aggregates every vendor's code before selection:
```
ZoomInfo:    { system: "NAICS", code: "541511", confidence: 0.72 }
Equifax:     { system: "NAICS", code: "541511", confidence: 0.68 }
OC:          { system: "NAICS", code: "541110", confidence: 0.89 }
OC:          { system: "uk_sic", code: "62012", confidence: 0.89 }  ← UK SIC also captured
OC:          { system: "nace",   code: "J6201", confidence: 0.89 }  ← NACE also captured
Middesk:     { system: "NAICS", code: "541511", confidence: 0.95 }
```

**JSONB payload:**
```json
{
  "codes": [
    { "system": "NAICS", "code": "541511", "source": "Middesk",   "confidence": 0.95 },
    { "system": "NAICS", "code": "541110", "source": "OC",        "confidence": 0.89 },
    { "system": "uk_sic","code": "62012",  "source": "OC",        "confidence": 0.89 },
    { "system": "NAICS", "code": "541511", "source": "ZoomInfo",  "confidence": 0.72 },
    { "system": "NAICS", "code": "541511", "source": "Equifax",   "confidence": 0.68 }
  ]
}
```

**Critical known limitation:** `classification_codes` correctly captures UK SIC, NACE, and Canadian NAICS codes from OC's `industry_code_uids`. However, **no Kafka handler, scorer, or report reader currently consumes this fact**. The UK SIC code exists in the data but is never used by the production pipeline. This is one of the core gaps the Consensus Engine addresses.

**Stored in:** `rds_warehouse_public.facts` only — not in `data_businesses`

---

## Part 6 — What Customers See (API & Reports)

### Internal API (integration-service) — full fact detail
```
GET /facts/business/{businessId}/details

Returns per-fact structure including winning value, source confidence,
platform ID, and all alternatives:

{
  "naics_code": {
    "name": "naics_code",
    "value": "541511",
    "source": { "confidence": 0.95, "platformId": 16 },
    "override": null,
    "alternatives": [
      { "value": "541110", "source": 23, "confidence": 0.89 },
      { "value": "541512", "source": 17, "confidence": 0.72 }
    ]
  },
  "mcc_code": { ... },
  "industry":  { ... }
}
```

### External API (case-service) — customer-facing
```
GET /businesses/customers/{customerID}  (or GET /businesses/{businessId})

Returns simplified fields:
  naics_code    → "541511"
  naics_title   → "Custom Computer Programming Services"
  mcc_code      → "7372"
  industry      → "Technology - Software"

Note: Full source lineage (confidence, alternatives, platformId)
is NOT exposed in this external endpoint.
```

### Worth 360 Report (PDF)
- `naics_code` and `industry` appear as business classification fields
- The NAICS code is used to label the industry section of the report

### Direct Redshift queries
```sql
-- All 8 classification facts for one business
SELECT name, value, received_at
FROM dev.rds_warehouse_public.facts
WHERE business_id = '<uuid>'
  AND name IN (
    'naics_code', 'naics_description',
    'mcc_code', 'mcc_description',
    'mcc_code_found', 'mcc_code_from_naics',
    'industry', 'classification_codes'
  )
ORDER BY name;

-- Denormalized business record
SELECT
  b.id,
  n.code  AS naics_code,
  n.description AS naics_description,
  m.code  AS mcc_code,
  m.description AS mcc_description,
  i.name  AS industry
FROM dev.rds_cases_public.data_businesses b
LEFT JOIN dev.rds_cases_public.core_naics_code n ON n.id = b.naics_code
LEFT JOIN dev.rds_cases_public.core_mcc_code   m ON m.id = b.mcc_code
LEFT JOIN dev.rds_cases_public.core_business_industries i ON i.id = b.industry
WHERE b.id = '<uuid>';
```

---

## Part 7 — Complete Workflow Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Business submitted                                              │
│  POST /businesses/customers/{customerID}                                 │
│  → business_id created, pipeline triggered                               │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 2: Vendor data collected (parallel)                                │
│                                                                          │
│  ZoomInfo   → zi_c_naics6         from Redshift (bulk table)            │
│  Equifax    → efx_primnaicscode   from Redshift (bulk table, US only)   │
│  OC         → industry_code_uids  from Redshift (bulk table, all codes) │
│  Middesk    → naics_code          from live API (SOS filing)            │
│  Trulioo    → sicCode             from live API (may be POLLUTED)       │
│  SERP/AI    → website content     scraped asynchronously                │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 3: Level 1 XGBoost entity matching                                 │
│  → For each source: 33 text/address similarity features computed        │
│  → Output: confidence score 0–1 per source                              │
│     oc_probability   → oc_matches_custom_inc_ml.oc_probability          │
│     efx_probability  → efx_matches_custom_inc_ml.efx_probability        │
│     zi_probability   → zoominfo_matches_custom_inc_ml.zi_probability    │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 4: Fact Engine runs (integration-service/lib/facts/rules.ts)       │
│                                                                          │
│  For naics_code fact:                                                    │
│  1. Collect candidates from all sources                                  │
│  2. factWithHighestConfidence() → sort by confidence, pick winner        │
│  3. If tie within 5%: weightedFactSelector() → use source weight         │
│  4. manualOverride() → analyst override always wins                      │
│  5. If no valid code: trigger AI enrichment (GPT-4o-mini)               │
│  6. Validate against core_naics_code → replace invalid with 561499      │
│                                                                          │
│  Same algorithm runs for: mcc_code, industry, classification_codes       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 5: Publish to Kafka (facts.v1 topic)                               │
│  Events: CALCULATE_BUSINESS_FACTS, UPDATE_NAICS_CODE                    │
│  Payload: FactEnvelope with all 8 classification facts                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 6: warehouse-service persists (FactService.consume())              │
│                                                                          │
│  rds_warehouse_public.facts (JSONB key-value, one row per fact):        │
│    naics_code          → {"code":"541511","description":"..."}           │
│    naics_description   → {"description":"Custom Computer..."}            │
│    mcc_code            → {"code":"7372","description":"..."}             │
│    mcc_description     → {"description":"Computer Programming..."}       │
│    mcc_code_found      → {"value": true}                                 │
│    mcc_code_from_naics → {"code":"7372","description":"..."}             │
│    industry            → {"value":"Technology - Software"}               │
│    classification_codes→ {"codes":[...all sources, all taxonomies...]}  │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 7: case-service updates data_businesses                            │
│  Kafka: UPDATE_NAICS_CODE → addIndustryAndNaicsPlatform()               │
│  rds_cases_public.data_businesses:                                       │
│    naics_code  → FK to core_naics_code.id                               │
│    mcc_code    → FK to core_mcc_code.id                                  │
│    industry    → FK to core_business_industries.id                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│  STEP 8: Available to consumers                                          │
│                                                                          │
│  Internal API:  GET /facts/business/{id}/details                         │
│                 → full fact with confidence, alternatives, platformId    │
│  External API:  GET /businesses/customers/{customerID}                   │
│                 → simplified naics_code, naics_title, mcc_code           │
│  Redshift:      SELECT FROM dev.rds_warehouse_public.facts               │
│  Worth 360:     naics_code + industry in PDF report                      │
└─────────────────────────────────────────────────────────────────────────┘

WHAT HAPPENS WHEN NO SOURCE HAS A VALID CODE:
  → All vendors returned empty or invalid codes
  → AI enrichment (GPT-4o-mini) runs
       Input: name + address + website text
       Output: naics_code + mcc_code + confidence
  → If AI confidence > any vendor → AI wins
  → Validate: if code not in core_naics_code → replace with "561499"
  → "561499" (All Other Business Support Services) stored as naics_code
  → Analyst can override via PATCH /facts/business/{id}/override/naics_code
```
