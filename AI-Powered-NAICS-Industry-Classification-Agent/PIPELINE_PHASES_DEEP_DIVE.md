# Industry Classification Pipeline Phases
## Worth AI End-to-End Flow vs. Where the Consensus Engine Fits

**Audience:** Engineering team and management  
**Date:** March 2026  
**Purpose:** Explain the complete data journey from applicant submission to industry classification, and precisely where the Consensus Engine replaces Worth AI's logic.

---

## The Central Question This Document Answers

When someone asks: *"How does Worth AI know what industry a company is in?"* — the answer is a 4-phase pipeline. Understanding each phase is essential for understanding:
1. What data exists and where it lives
2. Which phase produces `industry_code_uids` and how
3. Exactly which phase the Consensus Engine replaces
4. Why the rest of the infrastructure does not need to change

---

## The Key Insight Up Front

**Everything that COLLECTS data is unchanged. Only what happens AFTER data collection changes.**

```
Phases 0, 1, 2, 3 → Data collection and entity matching → IDENTICAL in both systems
Phase 4           → Classification decision              → REPLACED by Consensus Engine
```

---

## Phase 0 — Offline Bulk Data Pre-Loading

### What happens

Before any single applicant ever submits a form, Worth AI periodically ingests bulk data exports from data vendors into Amazon Redshift. This is an **offline batch process** — it runs on a schedule (daily/weekly), not in response to individual requests.

### What gets loaded

| Redshift Table | Source | What it contains |
|---------------|--------|-----------------|
| `dev.datascience.open_corporates_standard_ml_2` | OpenCorporates bulk export | Every registered company worldwide: name, address, **`industry_code_uids`**, `jurisdiction_code` |
| `dev.warehouse.equifax_us_standardized` | Equifax commercial file | US companies: name, address, **`primnaicscode`**, `efx_primsic`, secondary NAICS/SIC codes |
| `dev.datascience.zoominfo_standard_ml_2` | ZoomInfo bulk export | Global companies: name, address, **`zi_c_naics6`**, `zi_c_sic4`, industry text |
| `dev.warehouse.liberty_data_standard` | Liberty Data (planned) | Commercial intelligence: name, address, **`lib_naics_code`**, `lib_sic_code`, `lib_uk_sic_code` |

### The critical point: where `industry_code_uids` comes from

`industry_code_uids` is not something Worth AI computes. It is what **OpenCorporates already knows** from government registries:

```
Apple Inc registered with the California Secretary of State
        ↓
California Secretary of State assigns NAICS 334118 to Apple's business type
        ↓
UK Companies House assigns SIC 26400 to Apple's UK subsidiary
        ↓
OpenCorporates scrapes both government registries
        ↓
OpenCorporates stores: industry_code_uids = "us_naics-334118|uk_sic-26400|ca_naics-334118"
        ↓
Worth AI ingests this into Redshift during Phase 0
        ↓
It sits in dev.datascience.open_corporates_standard_ml_2 — waiting
```

**This data exists in Redshift before any applicant submits.** The XGBoost model's job in Phase 3 is simply to find which pre-loaded row belongs to the current applicant.

### Example Redshift row (OpenCorporates)

```sql
-- A single row in open_corporates_standard_ml_2 for Apple Inc:
company_number    : "0000320193"
jurisdiction_code : "us_ca"
company_name      : "Apple Inc."
normalised_name   : "APPLE INC"
street_address    : "1 Infinite Loop"
city              : "Cupertino"
region            : "CA"
postal_code       : "95014"
industry_code_uids: "us_naics-334118|uk_sic-26400|ca_naics-334118"
```

### Why this matters

The `industry_code_uids` field contains **all jurisdiction codes packed into one string** separated by `|`. The format is `scheme-code`:
- `us_naics-334118` → US NAICS 2022 code 334118
- `uk_sic-26400` → UK SIC 2007 code 26400
- `ca_naics-334118` → Canadian NAICS code

**Worth AI's resolver loop only reads the `us_naics` entries.** The `uk_sic` entry is parsed into `classification_codes` fact but has no downstream consumer. This is the UK SIC gap — the data exists in Redshift, it is just never used.

---

## Phase 1 — Applicant Submits

### What happens

An applicant fills out Worth AI's onboarding form. This is the only data the system receives from the applicant themselves. Everything else comes from vendors.

### Inputs from the applicant

| Field | Used for | Notes |
|-------|---------|-------|
| Company legal name | Entity matching search key | The only required field |
| DBA / trade name | Fallback entity matching | Catches "Ron Pack Carpet CTR" operating as "James D Owens" |
| Street address | Address similarity features (Model 1) | Dramatically reduces false matches |
| City | Address feature | |
| State / Region | Jurisdiction code computation (`US + AK → us_ak`) | |
| ZIP / Postal code | **Strongest single address feature** — prefix blocks Redshift search | |
| Country | Taxonomy routing in Model 2 / LLM | Routes to correct taxonomy |
| Industry (self-reported) | Fuse-matched to 20-bucket `core_business_industries` | Customer self-report — down-weighted to 0.20 in fact engine |

### What gets created

```sql
INSERT INTO data_businesses (
  id, name, industry,  -- industry = FK to core_business_industries (20 sectors)
  naics_id,            -- NULL at this point
  mcc_id,              -- NULL at this point
  uk_sic_id            -- DOES NOT EXIST (the gap)
)
```

Integration tasks are then queued via Kafka to trigger Phase 2.

---

## Phase 2 — Live Vendor API Calls

### What happens

**Six vendor sources are queried simultaneously** (async Kafka tasks). This happens in parallel — not sequentially. The responses are stored as raw JSONB in `integration_data.request_response`.

### Each vendor call in detail

#### OpenCorporates (Live API, ~1 second)

```
Worth AI sends: company_name + jurisdiction_code
OpenCorporates searches its registry database
        ↓
Returns: firmographic JSON including
  firmographic.industry_code_uids: "us_naics-334118|uk_sic-26400"
  firmographic.jurisdiction_code: "us_ca"
  firmographic.company_type: "operating"
        ↓
Stored in:
  integration_data.request_response
  WHERE platform_id = INTEGRATION_ID.OPENCORPORATES
  AND request_type = 'fetch_business_entity_verification'
```

#### Trulioo (Live API, ~2 seconds)

```
Worth AI sends: company_name + address + country
Trulioo's global KYB platform queries business registries
        ↓
Returns: clientData.standardizedIndustries: [
  { naicsCode: "334118", sicCode: "3571", industryName: "Electronic Computers" }
]
        ↓
Note: Trulioo returns BOTH naicsCode AND sicCode in the same object.
The fact engine reads naicsCode. The sicCode is NEVER READ (the Trulioo gap).
```

#### Equifax (Redshift lookup + entity matching, ~3 seconds)

```
Worth AI does NOT call an Equifax API directly.
Equifax data is pre-loaded in Redshift (Phase 0).
The entity-matching pipeline (Phase 3) finds the right Equifax row.
        ↓
Returns: efx_primnaicscode = "334118", efx_primsic = "3571"
```

#### ZoomInfo (Redshift lookup + entity matching, ~3 seconds)

```
Same as Equifax — pre-loaded in Redshift, entity matching finds the right row.
        ↓
Returns: zi_c_naics6 = "334118", zi_c_sic4 = "3571"
(zi_c_sic4 is SILENTLY DROPPED — the ZoomInfo SIC gap)
```

#### SERP Scrape (Web scrape, ~5 seconds)

```
Worth AI's internal scrape service queries search engines for the company.
Returns: businessLegitimacyClassification.naics_code (inferred from web)
Weight: 0.30 (lowest — heuristic, not official data)
Marked @TODO: ENG-24 Replace SERP
```

#### AI Enrichment (GPT-5-mini, conditional — only runs if other sources are insufficient)

```
Runs ONLY when: naics_code has 1–2 sources AND website + name + address resolved
SKIPS when: already ≥ 3 NAICS sources (saves OpenAI credits)
        ↓
Returns: naics_code, mcc_code, uk_sic_code (GB only)
Note: uk_sic_code returned but cannot be persisted (no table, no column)
```

### All responses stored in one table

```sql
integration_data.request_response:
  request_id   : UUID (unique per vendor call)
  business_id  : UUID (links to data_businesses)
  platform_id  : INTEGER (vendor discriminator: 17=Equifax, OC=?, Trulioo=?, etc.)
  request_type : VARCHAR ('fetch_business_entity_verification', 'fetch_public_records'…)
  response     : JSONB   ← THE RAW VENDOR PAYLOAD — completely different shape per vendor
  requested_at : TIMESTAMPTZ
```

**This table is the central raw store for ALL vendor data.** Every fact engine query reads from here, filtered by `platform_id`.

---

## Phase 3 — Entity Matching XGBoost (Model 1)

### The problem this phase solves

After Phase 2 stores all vendor responses, the Equifax and ZoomInfo data needs one more step: finding which **specific row** in the multi-million-row Redshift table belongs to THIS applicant.

For OpenCorporates and Trulioo, the live API already returned the right company's data — they do internal entity resolution. For the bulk files (Equifax, ZoomInfo, Liberty Data), Model 1 must match.

### The complete steps

```
INPUT:
  input_company = {
    name:    "Apple Inc",
    address: "1 Infinite Loop, Cupertino, CA 95014",
    country: "US"
  }

STEP 1: Canonise the name
  strip suffixes: LLC, Inc, Corp, GmbH, PLC, SAS, KK, Ltda, SRL, BV, NV…
  strip prefixes: The, A, An, Le, La
  strip accents and special characters
  collapse whitespace
  → canonical_name = "APPLE"

STEP 2: Block candidates from Redshift
  SELECT * FROM open_corporates_standard_ml_2
  WHERE LEFT(normalised_name, 3) = 'APP'  -- prefix blocking (first 3 chars)
  AND region = 'CA'                        -- same state
  → returns ~200 candidate records out of millions
  (blocking is fast — no full table scan)

STEP 3: Compute 26 similarity features for each candidate pair
  For each (input_record, candidate_record):

  NAME FEATURES (10):
    jaccard_1gram: |chars(input) ∩ chars(candidate)| / |chars(input) ∪ chars(candidate)|
    jaccard_2gram: same for 2-character sequences
    jaccard_3gram: same for 3-character sequences
    jaccard_4gram: same for 4-character sequences
    jaccard_word:  word-level Jaccard
    sim_norm_jac_1/2/3/4: normalised overlap coefficient (÷ min set size)
    sim_norm_jac_word: word-level normalised

  ADDRESS FEATURES (10):
    match_zipcode:       1 if postal codes match exactly
    match_city:          1 if cities match
    match_street_number: 1 if street numbers match
    match_street_block:  1 if street numbers within ±10
    distance_street_number: |street_num_input - street_num_candidate|
    match_address_line_2:   1 if suite/unit matches
    match_short_name:    1 if derived short names match
    street_name_jaccard_1/2: Jaccard on street name text
    sim_norm_street_name_1/2: overlap on street name

  SHORT NAME FEATURES (6):
    jaccard_short_1/2/3/4: Jaccard on "short name" (name without city/common words)
    sim_norm_short_1/2: overlap on short name

STEP 4: XGBoost predict_proba(26_features) for each candidate
  → match_confidence = 0.97  "Apple Inc. (CIK 0000320193, Cupertino CA)"  ✅ MATCHED
  → match_confidence = 0.12  "Apple Bank for Savings (NY)"                 ❌
  → match_confidence = 0.08  "Apple Valley Unified School District (CA)"   ❌

STEP 5: Apply threshold ≥ 0.80 → MATCHED
  Pull from matched row:
    OpenCorporates: industry_code_uids = "us_naics-334118|uk_sic-26400"
    Equifax:        primnaicscode = "334118", primsic = "3571"
    ZoomInfo:       zi_c_naics6 = "334118"
    Liberty Data:   lib_naics_code = "334118"
```

### Output of Phase 3

For each of the 6 vendor sources, Phase 3 produces:
```
{
  source:           "opencorporates",
  raw_code:         "334118",           ← the industry code from the matched row
  taxonomy:         "US_NAICS_2022",
  label:            "Computer Terminal Manufacturing",
  match_confidence: 0.97,               ← from Model 1
  status:           "MATCHED"           ← ≥ 0.80 threshold
}
```

---

## Phase 4 — THE DIVERGENCE POINT

This is where Worth AI and the Consensus Engine completely diverge. The inputs are identical — all six vendor signals with their match confidences. What happens next is entirely different.

---

### Phase 4A — Worth AI: The Deterministic Rule

```
ALGORITHM: factWithHighestConfidence()

For each fact (naics_code, industry, mcc_code):

  1. Collect all candidate values from sources:
     opencorporates → "334118" (confidence 0.97, weight 0.90)
     zoominfo       → "334118" (confidence 0.94, weight 0.80)
     trulioo        → "334118" (confidence 0.62, weight 0.70 after fact override)
     equifax        → "334118" (confidence 0.91, weight 0.70)
     SERP           → "334118" (confidence 0.75, weight 0.30)
     AI enrichment  → "334118" (confidence HIGH→0.20, weight 0.10)

  2. Compute effective score per source:
     effective_score = source_confidence × source_weight
     opencorporates: 0.97 × 0.90 = 0.873  ← WINNER
     equifax:        0.91 × 0.70 = 0.637
     zoominfo:       0.94 × 0.80 = 0.752

  3. winner = argmax(effective_score) = opencorporates → "334118"
     (if top two differ by < 0.05: use fact-level weight as tiebreaker)

OUTPUT:
  ONE code: "334118"
  ONE MCC: derived via JOIN on rel_naics_mcc
  No probability — rule always picks exactly one winner
  No UK SIC — loop only reads us_naics entries from industry_code_uids
  No AML signals — rule has no pattern detection
  No jurisdiction routing — all companies get NAICS regardless of country

STORAGE:
  Kafka UPDATE_NAICS_CODE event
  → handleNaicsData() resolves naics_id from core_naics_code
  → UPDATE data_businesses SET naics_id = X, mcc_id = Y
```

---

### Phase 4B — Consensus Engine: 5-Step Stacking

```
INPUTS: Exact same 6 vendor signals with match_confidences from Phase 3

STEP A: FEATURE ENGINEERING (38 numeric features)

  Group A — Source Quality (features 0–11):
    For each of 6 sources: weighted_confidence = source_weight × match_confidence
    opencorporates: 0.90 × 0.97 = 0.873
    equifax:        0.70 × 0.91 = 0.637
    trulioo:        0.80 × 0.62 = 0.496
    zoominfo:       0.80 × 0.94 = 0.752
    liberty_data:   0.78 × 0.88 = 0.686
    ai_semantic:    0.70 × 0.78 = 0.546
    MATCHED flag per source (1 if match_confidence ≥ 0.80)

  Group B — Data Quality & AML Signals (features 12–16):
    Trulioo pollution flag: 0 (Trulioo returned correct digit length)
    Web↔Registry distance: 0.04 (registry and web agree — low shell company risk)
    Temporal pivot score: 0.00 (stable code history — not changing every quarter)
    Cross-taxonomy agreement: 0.83 (5/6 taxonomies agree on same semantic cluster)

  Group C — Entity Type (features 16–18):
    Is Holding: 0 (Apple is Operating)
    Is NGO: 0
    Is Partnership: 0

  Group D — Jurisdiction One-Hot (features 19–30):
    US_STATE (us_ca): 1 ← California
    Is sub-national: 1 ← state level
    Is NAICS jurisdiction: 1 ← US → NAICS 2022 primary

  Group E — Agreement & Risk (features 31–37):
    Majority code agreement: 0.83 (5/6 sources returned 334118)
    High-risk NAICS prefix: 0 (334118 not in AML elevated list)
    Unique code diversity: 0.17 (low — sources mostly agree)
    Avg source confidence: 0.87
    Max source confidence: 0.97

STEP B: XGBOOST MODEL 2 (multi:softprob classifier)
  Input: 38-feature vector
  Output: probability distribution over all codes

  P(NAICS 334118) = 0.92  ← Primary
  P(NAICS 541512) = 0.04  ← Secondary
  P(NAICS 519290) = 0.02  ← Secondary
  P(NAICS 551112) = 0.01  ← Secondary
  P(NAICS 423690) = 0.01  ← Secondary

STEP C: EXTERNAL REGISTRY LOOKUP (new — not in Worth AI at all)
  SEC EDGAR: GET data.sec.gov/submissions/CIK0000320193.json
    → sic: "3571", sicDescription: "Electronic Computers"
    → entityType: "operating", stateOfIncorporation: "CA"
    → ticker: "AAPL"
  Companies House (if GB company): GET api.company-information.service.gov.uk/...
    → sic_codes: ["26400"]

  These are AUTHORITATIVE — the company told the government directly.
  Passed to LLM as ground truth.

STEP D: LLM ENRICHMENT (GPT-4o-mini as referee)
  LLM receives ALL evidence simultaneously:

  AUTHORITATIVE REGISTRY DATA:
    SEC EDGAR (AAPL): SIC 3571 — Electronic Computers, incorporated CA

  VENDOR SOURCE SIGNALS:
    opencorporates (weight=0.90, MATCHED 97%): us_naics-334118
    equifax        (weight=0.70, MATCHED 91%): primnaicscode=334118
    trulioo        (weight=0.80, CONFLICT 62%): naicsCode=541511 ← conflict!
    zoominfo       (weight=0.80, MATCHED 94%): zi_c_naics6=334118
    liberty_data   (weight=0.78, MATCHED 88%): lib_naics_code=334118
    Source agreement: 4/5 agree on 334118

  UGO FAISS CANDIDATES (top-8 per taxonomy by cosine similarity):
    US_NAICS_2022: [{334118: "Computer Terminal Mfg", score:0.92}, ...]
    UK_SIC_2007:   [{26400: "Consumer electronics", score:0.88}, ...]
    NACE_REV2:     [{C26: "Computer/electronic products", score:0.85}, ...]

  LLM reasoning order:
    Step 1: Registry data first → SIC 3571 confirms electronic computers
    Step 2: 4/5 vendors agree on 334118 → strong consensus, confirm
    Step 3: Trulioo returns 541511 (conflict) — less reliable at 62%
    Step 4: Select from UGO candidates per taxonomy
    Step 5: MCC selection

  LLM OUTPUT:
    primary_taxonomy: "US_NAICS_2022"
    primary_code: "334118"
    uk_sic_code: "26400"    ← not dropped — properly output
    nace_code: "C26"        ← EU alternative
    mcc_code: "5045"        ← Computers/peripherals/software
    source_used: "vendor_consensus"
    registry_conflict: false
    mcc_risk_note: "normal"

STEP E: RISK ENGINE (9 AML/KYB signal detectors)
  REGISTRY_DISCREPANCY:  NO — registry and web agree (distance=0.04)
  SHELL_COMPANY_SIGNAL:  NO — entity type = Operating + Operating code
  HIGH_RISK_SECTOR:      NO — 334118 not in AML elevated prefix list
  STRUCTURE_CHANGE:      NO — temporal pivot score = 0.00 (stable history)
  SOURCE_CONFLICT:       NO — 4/5 sources agree (below 60% conflict threshold)
  TRULIOO_POLLUTION:     NO — Trulioo returned correct digit-length code
  LOW_CONSENSUS_PROB:    NO — top probability = 0.92 (well above 0.40 threshold)
  HYBRID_ENTITY:         NO — all secondary codes in same sector
  HOLDING_MISMATCH:      NO — entity type = Operating

  Risk score: 0.00 → Risk level: LOW → KYB recommendation: APPROVE

FINAL OUTPUT:
{
  "primary_industry": {
    "taxonomy": "US_NAICS_2022",
    "code": "334118",
    "label": "Computer Terminal Manufacturing",
    "consensus_probability": 0.92
  },
  "secondary_industries": [
    {"taxonomy": "UK_SIC_2007", "code": "26400", "label": "Consumer electronics"},
    {"taxonomy": "NACE_REV2",   "code": "C26",   "label": "Computer/electronic products"},
    {"taxonomy": "MCC",         "code": "5045",  "label": "Computers/peripherals/software"}
  ],
  "risk_signals": [],
  "risk_profile": {
    "overall_risk_score": 0.00,
    "overall_risk_level": "LOW",
    "kyb_recommendation": "APPROVE"
  },
  "source_lineage": {
    "opencorporates": {"status": "MATCHED", "confidence": 0.97, "weight": 0.90},
    "equifax":        {"status": "MATCHED", "confidence": 0.91, "weight": 0.70},
    "trulioo":        {"status": "CONFLICT","confidence": 0.62, "weight": 0.80},
    "zoominfo":       {"status": "MATCHED", "confidence": 0.94, "weight": 0.80},
    "liberty_data":   {"status": "MATCHED", "confidence": 0.88, "weight": 0.78}
  }
}
```

---

## Side-by-Side: Same Input, Completely Different Phase 4

| | Worth AI (Phase 4A) | Consensus Engine (Phase 4B) |
|---|---|---|
| **Algorithm** | Deterministic rule: `argmax(conf × weight)` | 5-step stacking: features → XGBoost → registry → LLM → risk |
| **Primary output** | `NAICS 334118` (string) | `NAICS 334118` with probability `0.92` |
| **UK SIC output** | ❌ Dropped at loop filter | ✅ `UK SIC 26400` (from OC + LLM) |
| **NACE output** | ❌ Not present | ✅ `NACE C26` (from LLM + UGO) |
| **MCC output** | ✅ Derived via JOIN on `rel_naics_mcc` | ✅ Direct from LLM + MCC risk note |
| **Confidence** | None — rule always picks one winner | Float `0.92` — calibrated probability |
| **Trulioo conflict** | Silent — rule picks OC over Trulioo | Visible — `CONFLICT` status, encoded in features |
| **Government registry** | Never queried for classification | SEC EDGAR + Companies House = ground truth |
| **AML signals** | ❌ Zero | ✅ 9 signal types with severity and score |
| **KYB recommendation** | ❌ Not produced | ✅ `APPROVE` |
| **Storage** | `data_businesses.naics_id` (FK) | Full JSON output + risk profile |

---

## Why Phases 0–3 Don't Need to Change

Phase 0–3 do four things:
1. **Collect** industry codes from vendors
2. **Store** raw responses in `integration_data.request_response`
3. **Match** vendor records to the applicant using name/address similarity
4. **Produce** one `{source, code, match_confidence, status}` per vendor

The Consensus Engine needs exactly these four outputs as its inputs. The 38 features it builds in Step A come entirely from the match_confidence values produced by Phase 3 and the raw codes extracted from `integration_data.request_response`.

**Replacing Phase 4 with the Consensus Engine requires:**
- No new vendor contracts
- No changes to Redshift tables
- No changes to Kafka topics
- No changes to the entity matching XGBoost model
- Only: replace `factWithHighestConfidence()` with `ConsensusEngine.predict()`

---

## Summary: The Single Sentence Answer

**The Consensus Engine replaces only Phase 4 — the moment after all vendor data is collected and entity-matched, where Worth AI currently runs a deterministic rule to pick one winner, the Consensus Engine instead runs a 5-step stacking pipeline (feature engineering → XGBoost → external registry → LLM → risk engine) to produce a probability-weighted, multi-taxonomy, AML-annotated classification.**

---

*Sources: `SIC-UK-Codes` repo (integration-service, case-service, warehouse-service), `Entity-Matching` repo, Consensus Engine codebase*  
*Prepared by Worth AI Engineering · March 2026*
