# Technical Briefing: Industry Classification
## Worth AI Current Pipeline vs. Global Consensus Engine

**Prepared for:** Engineering Team & Management  
**Date:** March 2026  
**Sources:** `SIC-UK-Codes` repo (integration-service, case-service, warehouse-service), `Entity-Matching` repo (matching_v1.py, build_matching_tables.py), `WORTH_INDUSTRY_CLASSIFICATION_REPORT.md`, and new Consensus Engine codebase

---

## Executive Summary

Worth AI currently classifies businesses through a **FactEngine** that aggregates signals from seven sources using a confidence-weighted maximum rule, with **no ML model** in the classification decision itself — only in entity matching. The output is a single NAICS code and a manually-derived MCC. UK SIC 2007 data is present in vendor responses but silently discarded due to four sequential gaps. Non-US businesses receive either an inappropriate US NAICS code or `naics_id = NULL`.

The new **Global Industry Classification Consensus Engine** replaces this with a three-level XGBoost stacking ensemble that outputs six taxonomy codes simultaneously, assigns calibrated probabilities, surfaces nine AML/KYB risk signals, supports 200+ jurisdictions, and uses Liberty Data as a fourth entity-matching source alongside OpenCorporates, Equifax, and ZoomInfo.

---

## Part 1 — The Worth AI Pipeline: How It Actually Works

### 1.1 The Two Separate XGBoost Models in Worth AI

Worth AI uses XGBoost in **one place only** — entity matching. There is **no XGBoost model** in the classification decision itself.

#### Model 1: Entity Matching XGBoost (`entity_matching_20250127`)

**What it does:** Scores whether a candidate record from a Redshift database table (OpenCorporates, Equifax, ZoomInfo, or Liberty Data) represents the *same real-world company* as the input business.

**Where it lives:** `entity_matching/core/matchers/matching_v1.py`

**How it works:**

```
Input company → canonise name (strip suffixes, accents) →
    Query Redshift tables:
      dev.datascience.open_corporates_standard_ml_2
      dev.warehouse.equifax_us_standardized
      dev.datascience.zoominfo_standard_ml_2
      dev.warehouse.liberty_data_standard (4th source)  →
    For each candidate record: compute similarity features →
    XGBoost predict_proba → match_confidence (0.0–1.0) →
    Top-10 matches stored in {table}_matches
```

**Features used by Entity Matching XGBoost:**

| Feature | Type | Description |
|---------|------|-------------|
| `similarity_jaccard_1` | Float 0–1 | Character 1-gram Jaccard similarity between canonical names |
| `similarity_jaccard_2` | Float 0–1 | Character 2-gram Jaccard similarity |
| `similarity_jaccard_3` | Float 0–1 | Character 3-gram Jaccard similarity |
| `similarity_jaccard_4` | Float 0–1 | Character 4-gram Jaccard similarity |
| `similarity_jaccard_word` | Float 0–1 | Word-level Jaccard similarity |
| `sim_norm_jac_1` | Float 0–1 | Normalised overlap coefficient, 1-gram |
| `sim_norm_jac_2` | Float 0–1 | Normalised overlap coefficient, 2-gram |
| `sim_norm_jac_3` | Float 0–1 | Normalised overlap coefficient, 3-gram |
| `sim_norm_jac_4` | Float 0–1 | Normalised overlap coefficient, 4-gram |
| `sim_norm_jac_word` | Float 0–1 | Normalised overlap coefficient, word-level |
| `match_zipcode` | Binary 0/1 | Exact postal code match |
| `match_city` | Binary 0/1 | Exact city match |
| `match_street_number` | Binary 0/1 | Exact street number match |
| `match_street_block` | Binary 0/1 | Street number within same block |
| `distance_street_number` | Integer | Numeric distance between street numbers |
| `match_address_line_2` | Binary 0/1 | Exact suite/unit match |
| `match_short_name` | Binary 0/1 | Short-name derived match |
| `similarity_street_name_1–4` | Float 0–1 | Jaccard similarity on street names (k=1–4) |
| `sim_norm_street_name_1–4` | Float 0–1 | Normalised overlap on street names |
| `similarity_short_1–4` | Float 0–1 | Jaccard similarity on short names |
| `sim_norm_short_1–4` | Float 0–1 | Normalised overlap on short names |

**Output:** `match_confidence` (float 0–1) per candidate pair. Threshold ≥ 0.80 = MATCHED.

**Training:** Trained on labelled pairs of (known-match, known-non-match) company records from the internal Redshift tables. Model file: `entity_matching_20250127`.

**What it does NOT do:** The entity matching XGBoost does not classify industries. It only answers: "Is this database record the same company as the input?" Once a match is found, the industry code comes directly from the matched record's database fields.

#### Model 2: No Classification XGBoost Exists in Worth AI

There is **no XGBoost model** (or any other ML model) involved in choosing which NAICS code to assign. The classification decision is made by a **rule-based FactEngine**:

```
For each fact (naics_code, industry, mcc_code):
  1. Query all sources for their candidate value
  2. Apply factWithHighestConfidence():
     winner = argmax(source.confidence × source.weight)
  3. When two sources are within WEIGHT_THRESHOLD (0.05):
     use weightedFactSelector() (fact-level weight)
  4. manualOverride() can force a specific value
```

This is a deterministic rule — not a trained model. It has no ability to learn from feedback, detect conflicts systematically, or output probabilities.

### 1.2 The Seven Classification Sources

#### Source 1: Equifax (Batch/File — Internal Redshift)

| Attribute | Value |
|-----------|-------|
| Type | Batch / file ingest |
| Redshift table | `dev.warehouse.equifax_us_standardized` |
| Source weight | 0.70 *(may be days or weeks old)* |
| Entity matching | `entity_matching_20250127` XGBoost using name+address features |

**Fields available vs. used:**

| Field | Used? | Notes |
|-------|-------|-------|
| `primnaicscode` | ✅ USED | Mapped to `naics_code` fact |
| `primnaics_sector/_subsector/_industry_group/_industry` | ❌ DROPPED | 4 hierarchy labels — in `extended_attributes` SQL function only |
| `secnaics1`–`secnaics4` (+ full hierarchy per) | ❌ DROPPED | Up to 4 secondary NAICS with hierarchy |
| `primsic` | ❌ DROPPED | 4-digit US SIC 1987 — no fact defined |
| `secsic1`–`secsic4` | ❌ DROPPED | Secondary SIC codes |

**24 of 25 industry columns are discarded.** Only `primnaicscode` is wired in.

#### Source 2: ZoomInfo (Live API → Redshift)

| Redshift table | `dev.datascience.zoominfo_standard_ml_2` |
|---|---|
| Source weight | 0.80 |

| Field | Used? |
|-------|-------|
| `zi_c_naics6` | ✅ USED |
| `zi_c_sic4` | ❌ DROPPED |

#### Source 3: OpenCorporates (Live API → Redshift)

| Redshift table | `dev.datascience.open_corporates_standard_ml_2` |
|---|---|
| Source weight | 0.90 *(highest — authoritative government data)* |

**Critical gap:** OpenCorporates returns `"us_naics-541110|uk_sic-62012|ca_naics-541110"` — all jurisdiction codes in one field. The resolver loop only extracts entries where `codeName.includes("us_naics")`. The UK SIC code (`gb_sic-62012`) is parsed into the `classification_codes` fact but that fact has **no downstream consumer**.

#### Source 4: Trulioo (Live API)

| Source weight | 0.80 |
|---|---|

| Field | Used? |
|-------|-------|
| `.naicsCode` | ✅ USED |
| `.sicCode` | ❌ DROPPED — adjacent field, one line of code away from being used |
| `.industryName` | ✅ USED |

#### Source 5: Liberty Data (Internal Redshift — 4th Entity-Matching Source)

| Redshift table | `dev.warehouse.liberty_data_standard` |
|---|---|
| Source weight | 0.78 |
| Status in build_matching_tables.py | **Not yet added** (to be added to SOURCES dict and COUNTRY_SOURCES) |

Liberty Data provides a commercial intelligence overlay with industry classification, revenue range, and employee count. It is the **fourth source** to add to the entity matching pipeline alongside OpenCorporates, Equifax, and ZoomInfo.

**To add in production:**
```python
# In build_matching_tables.py SOURCES dict:
"liberty_data": """
    SELECT
        lib_business_id || '|' || ROW_NUMBER() OVER(PARTITION BY lib_business_id) as id,
        lib_business_name as business_name,
        lib_address as street_address,
        lib_postal_code as postal_code,
        lib_city as city,
        COALESCE(UPPER(TRIM(lib_state)), 'MISSING') as region,
        lib_country_code as country_code
    FROM dev.warehouse.liberty_data_standard
"""
# In COUNTRY_SOURCES:
"US": ["open_corporates", "equifax", "zoominfo", "liberty_data"],
"GB": ["open_corporates", "zoominfo", "liberty_data"],
"CA": ["open_corporates", "zoominfo", "liberty_data"],
```

#### Source 6: SERP Scrape (Live API)

Weight: 0.30 (fact-level). Uses `businessLegitimacyClassification.naics_code`. Marked `@TODO: ENG-24 Replace SERP`.

#### Source 7: AI NAICS Enrichment (GPT Fallback)

Weight: 0.10. Returns `naics_code`, `mcc_code`, text confidence. No UK SIC in Zod schema.

### 1.3 The Fact Resolution Rule (Not ML)

```
factWithHighestConfidence():
  candidates = [(source_A, confidence_A × weight_A),
                (source_B, confidence_B × weight_B), ...]
  winner = max(candidates, key=lambda x: x[1])
  if (top_two_scores differ by < WEIGHT_THRESHOLD=0.05):
      winner = weightedFactSelector(fact_level_weight)
```

Effective priority for `naics_code`:

| Rank | Source | Effective score formula |
|------|--------|------------------------|
| 1 | OpenCorporates | 0.90 × match_confidence |
| 2 | ZoomInfo | 0.80 × match_confidence |
| 3 | Trulioo | 0.80 × 0.70 (fact override) × match_confidence |
| 4 | Equifax | 0.70 × match_confidence |
| 5 | Liberty Data | 0.78 × match_confidence *(once added)* |
| 6 | Customer-submitted | 0.20 (fact override, despite source weight=10) |
| 7 | SERP | 0.30 × match_confidence |
| 8 | AI enrichment | 0.10 × AI_confidence |

### 1.4 Database Schema — Industry Tables

```
core_naics_code        : id (PK) · code (6-digit UNIQUE) · label  → 1,035 rows
core_mcc_code          : id (PK) · code (4-digit UNIQUE) · label  → 125 rows
rel_naics_mcc          : naics_id FK · mcc_id FK                  → 1,012 mappings
core_business_industries: id · name · code · sector_code          → 20 NAICS sectors
data_businesses        : naics_id FK · mcc_id FK · industry FK
rel_business_industry_naics: business_id · platform · naics_id · industry_id (UNIQUE per platform)
integration_data.request_response: business_id · platform_id · response(JSONB) — ALL vendor raw data
```

**Missing tables (critical gaps):**
- `core_uk_sic_code` → does not exist
- `uk_sic_id` column on `data_businesses` → does not exist

### 1.5 Inputs and Outputs — Worth AI

**Inputs:**

| Field | Notes |
|-------|-------|
| Company name | 9 basic English suffixes stripped only |
| Address | Used in entity matching |
| Country | Stored but NOT used for taxonomy routing |
| Industry name (text) | Fuse-matched to 20-sector `core_business_industries` |

**Outputs:**

| Output | Status |
|--------|--------|
| US NAICS 2022 code | ✅ Stored in `data_businesses.naics_id` |
| MCC code | ✅ Derived via `rel_naics_mcc` JOIN |
| Industry sector (20 buckets) | ✅ Stored in `data_businesses.industry` |
| UK SIC 2007 | ❌ Not stored (no table, no column) |
| NACE Rev.2 | ❌ Not present |
| ISIC Rev.4 | ❌ Not present |
| Calibrated probability | ❌ Text string only (HIGH/MED/LOW) |
| AML/KYB risk signals | ❌ None |
| Source lineage | Partial (`rel_business_industry_naics` per platform) |

### 1.6 The 4 Confirmed Gaps for UK Businesses

1. **OpenCorporates resolver**: loop only extracts `us_naics` entries → UK SIC (`gb_sic`) passed to `classification_codes` fact which has no consumer
2. **Trulioo `.sicCode`**: field exists in the same object as `.naicsCode`, never read
3. **No persistence layer**: no `core_uk_sic_code` table, no `uk_sic_id` column in any migration
4. **AI enrichment Zod schema**: structurally cannot return UK SIC — field not in schema

**Result:** Every UK business either gets `naics_id = NULL` or an inappropriate US NAICS code applied to it.

### 1.7 The AI Enrichment Step — How It Works in Worth AI

#### What it is
`AINaicsEnrichment` is a **deferrable asynchronous task** that runs OpenAI GPT (currently `gpt-5-mini`) to classify a business's NAICS code, MCC code, and optionally UK SIC code. It is implemented in `integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts`.

#### When is it triggered?
The AI enrichment does NOT run for every business. It runs only when specific **fact-based conditions** are satisfied — this is controlled by the `DEPENDENT_FACTS` object and evaluated by `DeferrableTaskManager.evaluateReadyState()`.

**Trigger conditions for `AINaicsEnrichment`:**

```typescript
static readonly DEPENDENT_FACTS = {
  website:       { minimumSources: 1 },      // MUST have a website fact resolved
  website_found: { minimumSources: 1 },      // MUST have website_found resolved
  business_name: { minimumSources: 1 },      // MUST have a business name
  primary_address:{ minimumSources: 1 },     // MUST have an address
  dba:           { minimumSources: 0 },      // optional DBA name
  naics_code:    {                           // KEY TRIGGER:
    maximumSources: 3,                       //   SKIP if already 3+ sources for NAICS
    minimumSources: 1,                       //   DEFER if 0 sources for NAICS
    ignoreSources: ["AINaicsEnrichment"]     //   Don't count AI's own prior output
  },
  uk_sic_code:   { maximumSources: 3, minimumSources: 0, ignoreSources: ["AINaicsEnrichment"] },
  mcc_code:      { maximumSources: 3, minimumSources: 1, ignoreSources: ["AINaicsEnrichment"] },
  corporation:   { minimumSources: 0 }
}
```

**In plain English:**
- AI enrichment **runs** when: the business has a website, a name, an address, AND already has between 1 and 2 NAICS sources (i.e. some vendors responded but not all 3)
- AI enrichment **skips** (marks SUCCESS without running) when: `naics_code` already has ≥ 3 source confirmations → saves OpenAI credits
- AI enrichment **defers** (waits, retries) when: required facts are not yet resolved → polls via Bull queue up to 10 attempts with exponential backoff
- AI enrichment **force-runs** after: 3-minute timeout (`TASK_TIMEOUT_IN_SECONDS = 60 * 3`) regardless of fact readiness

#### The execution queue
The task is enqueued to **Bull queue** (`QUEUES.AI_ENRICHMENT`), processed by a sandboxed worker (`deferrableTaskWorker.ts`). The worker calls `evaluateJob()` which calls `evaluateReadyState()` to check conditions, then calls `executeDeferrableTask()` which calls `getPrompt()` → `getOpenAIResponse()` → `parseOpenAIResponse()` → `saveRequestResponse()`.

#### The prompt — Worth AI

**System message:**
```
You are a helpful assistant that determines:
1) 6 digit North American Industry Classification System (NAICS) codes as of the 2022 edition.
   Do not use earlier editions only the 2022 edition.
2) The canonical description of the NAICS Code from the 2022 edition.
3) The 5 digit UK Standard Industrial Classification (SIC) code from the 2007 edition.
   This is only required if the business country is GB (United Kingdom).
4) The canonical description of the UK SIC Code.
5) The 4 digit Merchant Category Code (MCC)
6) The canonical description of the MCC Code.
Infer this information from industry info and business names.
If a website URL is available, parse the website for the information.
If a company already has NAICS, UK SIC or MCC information, correct it if it doesn't match the business details.
Return a JSON object with fields reasoning, naics_code, naics_description, uk_sic_code (if applicable),
uk_sic_description (if applicable), mcc_code, mcc_description, confidence (HIGH|MED|LOW),
previous_naics_code, previous_mcc_code.
If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort.
```

**Website tool use:**
If the business has a website URL, the prompt includes a second system message instructing GPT to browse the URL using OpenAI's `web_search` tool, filtering to only the business's own domain:
```typescript
responseCreateWithInput.tools = [{
  type: "web_search",
  filters: { allowed_domains: domainArray },  // only the company's own domain
  search_context_size: "medium"
}];
```

**User message:**
```
START DATA RESEARCH MODE
IMPORTANT: Only use NAICS codes from the 2022 edition!
Business Details: {key}: {value} | {key}: {value} | ...
```
Where business details include: business name, address, DBA name, existing NAICS/MCC codes, corporation type, website.

#### The response schema — Worth AI
```typescript
{
  reasoning: string,
  naics_code: string,              // 6-digit NAICS 2022
  naics_description: string,
  uk_sic_code?: string,            // 5-digit UK SIC — only if country is GB
  uk_sic_description?: string,
  mcc_code: string,                // 4-digit MCC
  mcc_description: string,
  confidence: "HIGH" | "MED" | "LOW",
  previous_naics_code: string,
  previous_mcc_code: string,
  website_url_parsed: string | null,
  website_summary: string | null,
  tools_used: string[],
  tools_summary: string | null
}
```

#### Post-processing — Worth AI
After the AI responds, `executePostProcessing()` validates the returned NAICS code:
1. Calls `internalGetNaicsCode(response.naics_code)` → checks it exists in `core_naics_code` table
2. If the NAICS code is NOT in the table → `removeNaicsCode()` replaces it with `561499` (the "last resort" code = Administrative and Support Services)
3. Sends a Kafka `update_naics_code_event` to persist the result

#### Confidence mapping — Worth AI
```typescript
calculateConfidence(input: "HIGH" | "MED" | "LOW"): number {
  "HIGH" → 0.20
  "MED"  → 0.15
  "LOW"  → 0.10   // becomes the source weight in the fact engine
}
```
**Critical observation:** The AI's confidence text string is mapped to a very small numeric weight (0.10–0.20). This means even when the AI returns "HIGH", it only has weight 0.10–0.20 compared to OpenCorporates at 0.90. The AI is explicitly the **last resort** in the fact engine.

#### What the AI enrichment produces — Worth AI
| Field | Persisted? | Where |
|-------|-----------|-------|
| `naics_code` | ✅ | `integration_data.request_response` → Kafka → `data_businesses.naics_id` |
| `mcc_code` | ✅ | Same path → `data_businesses.mcc_id` |
| `uk_sic_code` | ⚠️ Parsed but NOT persisted | No `core_uk_sic_code` table |
| `reasoning` | ✅ | Stored in task metadata |
| `confidence` | ✅ | Stored as source weight |
| `website_summary` | ✅ | Stored in task metadata |
| `previous_naics_code` | ✅ | Stored in task metadata (audit trail) |

#### Critical UK SIC gap — Even in AI enrichment
The prompt explicitly says "uk_sic_code is only required if the business country is GB". However, even when the AI returns a valid UK SIC code:
- There is no `core_uk_sic_code` table to validate it against
- There is no `uk_sic_id` column on `data_businesses` to store it
- The code sits in `integration_data.request_response` JSONB only
- It is never consumed by any report, Kafka handler, or downstream system

### 1.8 Known Issues and TODOs From the Codebase

| Issue | Location |
|-------|----------|
| `// TODO: Handle OpenCorporate verification & record population` | `business.ts` |
| `// TODO: This should interact with the Business class directly` | `fetch_public_records` |
| `@TODO: ENG-24 Replace SERP` | `dataScrapeService.ts` |
| `truliooPreferredRule` for UK has no effect on industry | `rules.ts` |
| `businessFields.ts` maps to dropped columns (`naics_code`, `naics_title`) | Schema drift |
| AI confidence is self-reported text — not calibrated | `aiNaicsEnrichment.ts` |

---

## Part 2 — The New Global Industry Classification Consensus Engine

### 2.1 The Two XGBoost Models in the Consensus Engine

The Consensus Engine uses XGBoost in **two complementary roles** — entity matching AND classification consensus.

#### Model 1: Entity Matching XGBoost (Same as Worth AI)

Same algorithm as `matching_v1.py`. Now extended to include **Liberty Data** as a fourth source alongside OpenCorporates, Equifax, and ZoomInfo. The entity matching model scores name+address similarity to determine `match_confidence` per source.

#### Model 2: Classification Consensus XGBoost (NEW — does not exist in Worth AI)

**What it does:** Takes all vendor signals plus 38 engineered features and outputs a **probability distribution over all industry codes**. This is a trained multi-class classifier — not a rule.

**Model type:** `XGBClassifier(objective="multi:softprob")`

**Training data:** Synthetic multi-vendor samples covering all 200+ jurisdictions and all 6 taxonomy systems. In production: replaced with real manual override history from `rel_business_industry_naics WHERE platform = 'manual'`.

**Key hyperparameters:**
```python
XGBClassifier(
    objective       = "multi:softprob",  # outputs probability per class
    n_estimators    = 200,
    max_depth       = 6,
    learning_rate   = 0.08,
    subsample       = 0.8,
    colsample_bytree= 0.8,
    eval_metric     = "mlogloss",
    early_stopping_rounds = 20,
)
```

**Output:** `predict_proba(X)` → softmax probability distribution over all codes → Top-5 codes with calibrated probabilities.

### 2.2 The AI Enrichment Step — How It Works in the Consensus Engine

The Consensus Engine AI enrichment is fundamentally different from Worth AI's in architecture, trigger logic, prompt, model, and output.

#### When is it triggered?
The AI enrichment in the Consensus Engine runs **always as step 4** in the pipeline — not conditionally. There is no Bull queue, no deferrable task manager, no fact-source counting. It runs synchronously on every classification request:

```
Every request → Entity Resolver → 6-source signals → XGBoost consensus → LLM enrichment (always) → Risk Engine
```

**Why always?** Because AI is used for a different purpose: not to fill a gap when vendors don't respond, but to **select among UGO semantic search candidates** and produce **multi-taxonomy codes** (NAICS + UK SIC + NACE + ISIC simultaneously) that no single vendor can provide.

#### The two AI calls in the Consensus Engine

**Call 1 — Entity Profile Extraction** (`enrich_company_profile()`):

Extracts cleaned name, jurisdiction, entity type, and one-sentence business description from company name + address + DuckDuckGo web search.

```
System: "You are a global KYB expert. Produce a structured business profile."
User:   "Company Name: {name} / Address: {address} / Country: {country} / Web: {ddg_summary}"
Output: { cleaned_name, probable_jurisdiction, probable_entity_type,
          primary_business_description, secondary_activities, confidence }
```

**Call 2 — Multi-Taxonomy Code Selection** (`llm_classify()`):

Selects the best code for every taxonomy from FAISS UGO semantic search candidates.

```
User: "You are a world-class industry classification expert.
       Company: {name} | Jurisdiction: {jc} | Description: {desc} | Web: {summary}
       Candidate codes from UGO (top-8 per taxonomy via FAISS cosine search):
       { US_NAICS_2022: [{code, description, score}...],
         UK_SIC_2007:   [{code, description, score}...], ... }
       Instructions:
       1. Pick primary taxonomy for jurisdiction (US→NAICS, GB→UK_SIC, EU→NACE, other→ISIC)
       2. Select single MOST appropriate code from candidates
       3. Select best MCC code
       4. List up to 2 alternative codes from other taxonomies
       5. Provide reasoning.
       Return JSON: { primary_taxonomy, primary_code, primary_label, primary_confidence,
                      reasoning, mcc_code, mcc_label, alternative_codes[] }"
```

#### Prompt comparison — Worth AI vs. Consensus Engine

| Aspect | Worth AI (`AINaicsEnrichment`) | Consensus Engine (`llm_classify`) |
|--------|-------------------------------|-----------------------------------|
| **Model** | `gpt-5-mini` via `openai.responses.create` | `gpt-4o-mini` via `chat.completions` |
| **Output schema** | Zod schema with `text.format.json_schema` (strict) | `response_format={"type":"json_object"}` |
| **Website tool** | Real `web_search` tool (browses company's domain directly) | DuckDuckGo search pre-fetched, passed as text |
| **Candidate pre-filtering** | None — AI picks from all NAICS 2022 | FAISS UGO semantic search pre-filters top-8 per taxonomy |
| **Taxonomies produced** | NAICS + MCC + UK SIC (GB only) | All 6 taxonomies simultaneously |
| **Trigger** | Conditional: 1 ≤ naics_sources ≤ 2, website+name+address resolved | Always — every request |
| **Queue** | Bull async queue, 10 attempts, exponential backoff | Synchronous, 3 retries |
| **Last resort** | Hardcoded `561499` | Returns empty code + `LOW_CONSENSUS_PROBABILITY` risk signal |
| **Confidence** | HIGH=0.20, MED=0.15, LOW=0.10 (used as fact weight) | HIGH/MED/LOW (displayed in UI, not a numeric weight) |
| **UK SIC** | Only when country=GB | Always included for GB, shown in output for all |

#### How LLM output is used differently in each system

**Worth AI:** LLM output → `integration_data.request_response` → Kafka `update_naics_code_event` → fact engine as `AINaicsEnrichment` source (weight 0.10) → may influence winner but usually loses to vendor sources with weights 0.70–0.90.

**Consensus Engine:** LLM output is used in **two separate roles**:
1. **Source signal** — the LLM's primary code enters the 38-feature vector as `ai_semantic` signal (weight 0.70, status `INFERRED`) — influences XGBoost probability
2. **Enrichment output** — full multi-taxonomy result (all 6 codes, MCC, reasoning, alternatives) is returned in `consensus_output.LLMClassificationResult` — shown separately in the UI under "LLM Classification Reasoning" and "Cross-Taxonomy Alternative Codes"

This means XGBoost and LLM can independently suggest different codes. Both are shown — the user understands the difference between model consensus and LLM reasoning.

### 2.3 The 38-Feature Vector — Complete Specification

This is the core innovation. Worth AI produces **0 numeric features** for its classification decision (pure rule). The Consensus Engine produces **38 numeric features**:

#### Group A — Source Quality Signals (12 features, [0..11])

| Feature | Index | Formula | Why it matters |
|---------|-------|---------|----------------|
| opencorporates weighted confidence | 0 | `weight × match_confidence` | Highest-authority source gets proportional influence |
| equifax weighted confidence | 1 | `weight × match_confidence` | Batch file — weight 0.70 penalises staleness |
| trulioo weighted confidence | 2 | `weight × match_confidence` | Live API, down-weighted at fact level for NAICS |
| zoominfo weighted confidence | 3 | `weight × match_confidence` | Strong US firmographic coverage |
| liberty_data weighted confidence | 4 | `weight × match_confidence` | 4th entity-matching source |
| ai_semantic weighted confidence | 5 | `weight × confidence` | AI fallback — lowest weight |
| opencorporates MATCHED flag | 6 | 1 if status=MATCHED | Entity was confirmed in the database |
| equifax MATCHED flag | 7 | 1 if status=MATCHED | |
| trulioo MATCHED flag | 8 | 1 if status=MATCHED | |
| zoominfo MATCHED flag | 9 | 1 if status=MATCHED | |
| liberty_data MATCHED flag | 10 | 1 if status=MATCHED | |
| ai_semantic MATCHED flag | 11 | 1 if status=INFERRED | (INFERRED, not MATCHED for AI) |

#### Group B — Data Quality & Semantic Signals (5 features, [12..16])

| Feature | Index | Formula | Interpretation |
|---------|-------|---------|----------------|
| Trulioo Pollution Flag | 12 | 1 if Trulioo returned 4-digit SIC in 6-digit jurisdiction | Known Trulioo data quality bug |
| Web↔Registry Semantic Distance | 13 | Cosine distance (UGO embeddings) between registry label and AI label | > 0.55 = shell company indicator |
| Temporal Pivot Score | 14 | Unique codes / total snapshots over 3 historical periods | > 0.70 = AML U-Turn fraud signal |
| Cross-Taxonomy Agreement | 15 | Fraction of 6 taxonomies mapping to same semantic cluster | High = high confidence |
| Registry vs AI Distance | 16 | Same as [13] — retained for backward compat | |

#### Group C — Entity Type Signals (3 features, [17..19] internal index starts at 16)

| Feature | Formula |
|---------|---------|
| Is Holding entity | 1 if entity_type = "Holding" |
| Is NGO entity | 1 if entity_type = "NGO" |
| Is Partnership entity | 1 if entity_type = "Partnership" |

#### Group D — Jurisdiction One-Hot (12 features, [19..30])

This is a **10-element one-hot vector** (10 region buckets) plus 2 meta flags:

| Index | Feature | Value |
|-------|---------|-------|
| 19 | US (federal) | 1 if jurisdiction_code = "us" |
| 20 | US_STATE (any state/territory) | 1 if us_mo, us_ca, pr, us_dc… |
| 21 | CA (Canada federal) | 1 if jurisdiction_code = "ca" |
| 22 | CA_PROV (province) | 1 if ca_bc, ca_qc, ca_nu… |
| 23 | EU (UK + all European) | 1 if gb, de, fr, it, es, nl, pl, gl, gp… |
| 24 | APAC | 1 if in, cn, jp, sg, au, hk, th, mm… |
| 25 | LATAM | 1 if mx, br, ar, do, cw, aw… |
| 26 | MENA | 1 if ae, ae_az, sa, ir, tn, eg… |
| 27 | AFRICA | 1 if za, ng, ke, tz, ug, mu… |
| 28 | OTHER | 1 for all other jurisdictions |
| 29 | Is sub-national | 1 if state/province/emirate level (us_mo, ca_bc, ae_az…) |
| 30 | Is NAICS jurisdiction | 1 if US/CA/AU → NAICS 2022 is primary taxonomy |

**Worth AI equivalent:** 0 features. Country field is stored but not used in classification.

#### Group E — Agreement & Risk Signals (7 features, [31..37])

| Feature | Index | Formula | Interpretation |
|---------|-------|---------|----------------|
| Majority code agreement | 31 | Most-common code count / total sources | High = sources agree |
| High-risk NAICS prefix | 32 | 1 if any source code starts with AML-elevated 4-digit prefix | Direct AML sector flag |
| Unique code diversity | 33 | Unique codes / total source codes | High = high disagreement |
| Registry vs AI distance (copy) | 34 | Same as [13] | |
| Average source confidence | 35 | Mean confidence across 6 sources | Overall data quality |
| Maximum source confidence | 36 | Best single-source confidence | Upper bound reliability |
| Source count | 37 | Sources returning data / 6 | Fewer sources = less reliable |

### 2.3 How the Consensus Engine Selects a Winner

```
Input → Entity Lookup (fuzzy 5-pass matching)
     → 6 vendor signals (known entity: MATCHED + real codes;
                         unknown entity: INFERRED/CONFLICT + random pool)
     → FeatureEngineer.transform() → 38-feature numpy array
     → XGBClassifier.predict_proba() → probability over all codes
     → top_k_codes = argsort(probs)[::-1][:5]
     → Primary: codes[0], prob[0]
       Secondary: codes[1..4], prob[1..4]
     → LLM enrichment: GPT-4o-mini (JSON mode) selects code per taxonomy
       from UGO FAISS semantic search candidates
     → Risk Engine: 9 signal detectors → risk score + KYB recommendation
     → ConsensusResult JSON output
```

**Key difference from Worth AI:** Worth AI's rule always picks exactly one winner with no probability. The Consensus Engine outputs a **full probability distribution** — you know not just what the best code is, but how confident the model is and what the alternatives are.

### 2.4 The 5-Pass Name Matching (Entity Resolution)

Worth AI uses 9 suffix patterns. The Consensus Engine uses a **5-pass strategy** with rapidfuzz:

| Pass | Method | Example handled |
|------|--------|----------------|
| 1 | Canonical normalisation | `Apple Inc.` → `APPLE`; `MICROSOFT CORP` → `MICROSOFT` |
| 2 | Substring/superset | `Apple Inc USA` → contains `APPLE` → match |
| 3 | No-space comparison | `JPMORGAN` = `JP MORGAN` |
| 4 | First-word prefix (≥4 chars) | `Apple Store Technology` → `APPLE` |
| 5 | Fuzzy edit-distance (rapidfuzz, threshold 84/100) | `Mycrosoft` → 89% → Microsoft ✅ |

**Result:** Typos like `Mycrosoft`, `Aple`, `Amazzon`, `Googel`, `Teslla`, `Microsft`, `Walmrt` all resolve correctly.

### 2.5 The 9 AML/KYB Risk Signals

| Signal | Severity | Score contribution | Trigger condition |
|--------|----------|-------------------|------------------|
| SHELL_COMPANY_SIGNAL | HIGH | +0.35 | Holding registered + Operating web presence |
| REGISTRY_DISCREPANCY | HIGH | +0.30 | Semantic distance registry↔AI > 0.55 |
| STRUCTURE_CHANGE | HIGH | +0.30 | Code changed every snapshot |
| HIGH_RISK_SECTOR | HIGH | +0.25 | Code in AML-elevated sector prefix |
| SOURCE_CONFLICT | HIGH/MED | +0.20 | ≥60% sources disagree |
| HOLDING_MISMATCH | MEDIUM | +0.15 | entity_type=Holding, Operating code |
| TEMPORAL_PIVOT | MEDIUM | +0.12 | Code changed 2+ times recently |
| LOW_CONSENSUS_PROBABILITY | MEDIUM | +0.12 | XGBoost confidence < 40% |
| TRULIOO_POLLUTION | LOW | +0.05 | 4-digit SIC in 6-digit jurisdiction |

**Risk score aggregation:** Sum of all triggered signals, capped at 1.0.

**KYB recommendation:** APPROVE (< 0.25) | REVIEW (0.25–0.50) | ESCALATE (0.50–0.75) | REJECT (≥ 0.75).

### 2.6 The Unified Global Ontology (UGO)

A FAISS IndexFlatIP (inner product = cosine on L2-normalised vectors) built from:

| Taxonomy | Codes |
|----------|-------|
| NAICS 2022 | 1,033 |
| UK SIC 2007 | 386 |
| ISIC Rev.4 | 439 |
| NACE Rev.2 | 88 |
| US SIC 1987 | 79 |
| MCC | 305 |
| **Total** | **2,330** |

Embedding model: `all-MiniLM-L6-v2` (384-dim). Each description encoded as `"{taxonomy}: {description}"`.

**Cross-Ontology Embedding Alignment:** `UK SIC 56101 "Licensed restaurants"` and `NAICS 722511 "Full-Service Restaurants"` land near each other in the vector space. A semantic search for "licensed restaurant food service" returns UK SIC 56101 first (similarity: 0.741), then NAICS 722511 (0.672). No hardcoded crosswalk table needed.

### 2.7 Inputs — Consensus Engine

| Input | Accepted formats |
|-------|-----------------|
| Company Name | Any text. Typos handled via 5-pass fuzzy matching. |
| Address | Any text. Used in entity matching. |
| Country / Jurisdiction | ISO-2, full name, or OpenCorporates code (`us_mo`, `ca_bc`, `ae_az`, `gg`, `je`, `pr`, `tz`…) |
| Website / Domain | URL. Used by AI Semantic enrichment. |
| Custom Web Summary | Free text. Bypasses web search. |

### 2.8 Outputs — Consensus Engine

```json
{
  "business_id": "sim-00977436",
  "consensus_output": {
    "company_name": "Apple Inc",
    "jurisdiction": "us",
    "entity_type": "Operating",
    "primary_industry": {
      "taxonomy": "US_NAICS_2022",
      "code": "334118",
      "label": "Computer Terminal and Other Computer Peripheral Equipment Manufacturing",
      "consensus_probability": 0.9241
    },
    "secondary_industries": [
      {"taxonomy": "UK_SIC_2007", "code": "26400", "label": "Manufacture of consumer electronics", "consensus_probability": 0.0412},
      {"taxonomy": "NACE_REV2",   "code": "C26",   "label": "Manufacture of computer electronic and optical products", "consensus_probability": 0.0198}
    ],
    "risk_signals": [],
    "source_lineage": {
      "opencorporates": {"status": "MATCHED",  "confidence": 0.97, "weight": 0.90},
      "equifax":        {"status": "MATCHED",  "confidence": 0.91, "weight": 0.70},
      "trulioo":        {"status": "MATCHED",  "confidence": 0.88, "weight": 0.80},
      "zoominfo":       {"status": "MATCHED",  "confidence": 0.94, "weight": 0.80},
      "liberty_data":   {"status": "MATCHED",  "confidence": 0.90, "weight": 0.78},
      "ai_semantic":    {"status": "INFERRED", "confidence": 0.78, "weight": 0.70}
    },
    "feature_debug": {
      "jurisdiction_code":         "us",
      "jurisdiction_label":        "United States",
      "region_bucket":             "US",
      "is_naics_jurisdiction":     true,
      "trulioo_polluted":          false,
      "web_registry_distance":     0.04,
      "temporal_pivot_score":      0.00,
      "majority_code_agreement":   0.83,
      "avg_source_confidence":     0.90,
      "high_risk_naics_flag":      false
    }
  },
  "risk_profile": {
    "overall_risk_score": 0.00,
    "overall_risk_level": "LOW",
    "kyb_recommendation": "APPROVE"
  }
}
```

---

## Part 3 — Complete Model Comparison

### 3.1 XGBoost — Entity Matching (same in both; extended in Consensus Engine)

| Aspect | Worth AI | Consensus Engine |
|--------|----------|-----------------|
| Model | `entity_matching_20250127` | Same model, extended |
| Sources | OpenCorporates, Equifax, ZoomInfo (3) | + Liberty Data (4) |
| Features | 26 name+address similarity features | Same |
| Output | `match_confidence` per source | Same + used as features for classification |
| Threshold | ≥ 0.80 = MATCHED | Same |

### 3.2 XGBoost — Industry Classification

| Aspect | Worth AI | Consensus Engine |
|--------|----------|-----------------|
| Model exists | ❌ **No ML model** — pure rule | ✅ XGBClassifier (multi:softprob) |
| Training data | N/A | 2,000+ synthetic → real overrides |
| Input features | 0 (rule-based) | **38 numeric features** |
| Output | 1 code (deterministic) | Top-5 codes with calibrated probabilities |
| Probability | Self-reported text (HIGH/MED/LOW) | Float 0.0–1.0 (softmax) |
| Can learn from feedback | ❌ | ✅ Re-run fit() on new overrides |
| Taxonomy | NAICS only | 6 taxonomies |
| Jurisdiction-aware | ❌ | ✅ 200+ codes, auto-routing |

### 3.3 The Full Capability Comparison

| Capability | Worth AI | Consensus Engine |
|-----------|----------|-----------------|
| US NAICS 2022 | ✅ Stored | ✅ |
| UK SIC 2007 | ❌ Not stored | ✅ Auto-selected for GB/GG/JE |
| NACE Rev.2 (EU) | ❌ | ✅ Auto-selected for EU |
| ISIC Rev.4 (Global) | ❌ | ✅ Auto-selected for APAC/LATAM/MENA |
| MCC code | ✅ Derived via JOIN | ✅ Direct per jurisdiction |
| Secondary codes | ❌ | ✅ Up to 4 cross-taxonomy |
| Calibrated probability | ❌ Text string | ✅ Float 0.0–1.0 |
| AML/KYB risk signals | ❌ | ✅ 9 signal types |
| Shell company detection | ❌ | ✅ |
| Temporal pivot/code-change | ❌ | ✅ |
| Full source lineage | Partial | ✅ All 6 sources |
| Data quality detection | ❌ | ✅ Trulioo pollution, conflict |
| Liberty Data as 4th source | ❌ (planned) | ✅ Simulated |
| 200+ jurisdiction codes | ❌ | ✅ us_mo, ca_bc, ae_az, gg… |
| Typo-tolerant name matching | ❌ (9 suffixes only) | ✅ 5-pass + rapidfuzz |
| KYB recommendation | ❌ | ✅ APPROVE/REVIEW/ESCALATE/REJECT |
| Taxonomy explorer (UGO) | ❌ | ✅ 2,330 codes, semantic search |
| Cross-taxonomy alignment | ❌ | ✅ NAICS ↔ UK SIC ↔ NACE without crosswalk |

---

## Part 4 — The Application — 6 Pages Explained

### Page 1: Single Company Lookup
**Input:** Company name + address + country/jurisdiction code  
**Processing:** Full 6-step pipeline (entity resolution → 6 vendors → 38-feature XGBoost → LLM enrichment → Risk Engine)  
**Output:** Primary industry code + taxonomy, up to 4 secondary codes, 9 AML risk signals, source lineage table with explanation of every value, feature debug panel

### Page 2: Batch Classification
**Input:** CSV/Excel with `Org Name` column (plus optional Address, Country, Description)  
**Processing:** Full pipeline on every row  
**Output:** Downloadable Excel with: Clean Name, Jurisdiction, Entity Type, Primary Code/Taxonomy/Desc, Consensus Probability, LLM Code, MCC, Risk Level, Risk Score, KYB Recommendation, Risk Flags  
**Use case:** Onboarding portfolio review, bulk KYB processing, periodic re-classification

### Page 3: Risk Dashboard
**Input:** Slider to choose portfolio size (10–100 companies)  
**Processing:** Synthetic portfolio generation + full Risk Engine on all companies  
**Output:** Risk level distribution chart, KYB recommendation chart, jurisdiction risk heatmap, high-risk entity detail table, downloadable Excel report  
**Use case:** AML/CTF portfolio monitoring, compliance reporting

### Page 4: Taxonomy Explorer
**Input:** Search query (free text) + optional taxonomy filter + top-K slider  
**Processing:** FAISS cosine similarity search across 2,330 UGO codes  
**Output:** Ranked results with similarity scores, cross-ontology semantic distance matrix, cross-taxonomy agreement panel  
**Use case:** Industry research, code verification, cross-taxonomy translation

### Page 5: Industry Lookup
**Input:** Jurisdiction code or country name → code/keyword search  
**Processing:** Jurisdiction → taxonomy routing → filtered code list  
**Output:** Searchable dropdown showing `code — description`, detail card, copy-ready JSON, full taxonomy CSV download, cross-taxonomy comparison  
**Use case:** Onboarding form industry selector, manual code verification, regulatory compliance

### Page 6: Source Architecture
**Input:** Status filter (Active / Simulated / Planned)  
**Processing:** Static registry of all 11 data sources  
**Output:** Per-source details (type, weight, coverage, industry fields, production SQL/API), name matching explanation, future architecture guide  
**Use case:** Engineering documentation, onboarding new engineers, planning new source integrations

---

## Part 5 — Data Available vs. Used

| Data point | In Worth AI raw data | Used/persisted | Used by Consensus Engine |
|------------|---------------------|----------------|--------------------------|
| US NAICS 2022 | ✅ All 7 sources | ✅ Primary stored | ✅ One of 6 outputs |
| Equifax NAICS hierarchy (5 levels) | ✅ `extended_attributes` | ❌ Dropped | ✅ Sector classification |
| Secondary NAICS codes (×4) | ✅ Equifax | ❌ Dropped | ✅ Secondary industry output |
| UK SIC 2007 | ✅ OpenCorporates + Trulioo | ❌ Dropped | ✅ Primary for GB |
| Canadian NAICS | ✅ OpenCorporates | ❌ Dropped | ✅ Primary for CA_PROV |
| NACE Rev.2 | ❌ No source | ❌ | ✅ Primary for EU |
| ISIC Rev.4 | ❌ No source | ❌ | ✅ Primary for APAC/LATAM/MENA/Africa |
| US SIC 1987 | ✅ Equifax + ZoomInfo | ❌ Dropped | ✅ Secondary output |
| MCC code | ✅ AI + NAICS JOIN | ✅ Derived | ✅ Direct per jurisdiction |
| Liberty Data industry codes | ✅ Redshift table | ❌ Not wired yet | ✅ 4th entity-matching source |
| Match confidence per source | Partial (entity matching) | ❌ Not exposed | ✅ Features 0–5, 6–11 |
| Temporal code history | ❌ | ❌ | ✅ Feature 14 (pivot score) |
| AML risk signals | ❌ | ❌ | ✅ 9 signal types |
| Calibrated probability | ❌ | ❌ | ✅ XGBoost softmax |

---

## Part 6 — Recommended Next Steps

| Priority | Action | Effort | Value |
|----------|--------|--------|-------|
| **P0** | Add `core_uk_sic_code` table + `uk_sic_id` column on `data_businesses` | Low (one migration) | Fixes UK persistence with zero new API calls |
| **P0** | Read Trulioo `.sicCode` for GB businesses | Very Low (one line) | Adds 2nd UK SIC source immediately |
| **P0** | Wire `classification_codes` fact to a persistence handler | Low | Unlocks CA NAICS, all OC schemes |
| **P0** | Add Liberty Data to `build_matching_tables.py` SOURCES dict | Low (one SQL query) | 4th entity-matching source |
| **P1** | Replace AI NAICS enrichment with full Consensus Engine pipeline | Medium | Multi-taxonomy, calibrated confidence, AML signals |
| **P1** | Train XGBoost consensus on real manual overrides from `rel_business_industry_naics` | Medium | Ground-truth model replaces synthetic training |
| **P1** | Add Companies House API connector (free, no auth) | Low | Best UK SIC source — weight 0.95 |
| **P2** | Wire Equifax secondary NAICS + SIC into fact engine | Low | 24 industry columns currently discarded |
| **P2** | Add `jurisdiction_code` field to integration-service FactEngine | Medium | Enables correct taxonomy routing per country |
| **P3** | Add GLEIF LEI as 5th entity-matching source | Medium | Global entity type + parent detection |

---

## Appendix A — Taxonomy Reference

| Taxonomy | Authority | Jurisdictions | Codes | Worth AI | Consensus Engine |
|----------|-----------|--------------|-------|----------|-----------------|
| NAICS 2022 | US Census | US, CA, AU, MX | 1,033 | ✅ Stored | ✅ |
| UK SIC 2007 | Companies House / ONS | GB, GG, JE | 386 | ❌ Dropped | ✅ |
| NACE Rev.2 | Eurostat | EU/EEA | 88 | ❌ | ✅ |
| ISIC Rev.4 | United Nations | Global | 439 | ❌ | ✅ |
| US SIC 1987 | SEC / US Gov | US (legacy) | 79 | ❌ Dropped | ✅ |
| MCC | Visa / Mastercard | Global | 305 | ✅ Derived | ✅ |
| **Total** | | | **2,330** | **2 types used** | **6 types** |

## Appendix B — Jurisdiction Registry Summary

200+ OpenCorporates-format jurisdiction codes supported:
- **US:** `us` + all 50 states + DC + territories (`us_mo`, `us_ca`, `us_ny`, `pr`…)
- **Canada:** `ca` + all 13 provinces/territories (`ca_bc`, `ca_qc`, `ca_nu`…)
- **UAE:** `ae` + all 7 emirates (`ae_az` Abu Dhabi, `ae_du` Dubai, `ae_sh` Sharjah…)
- **Australia:** `au` + all states/territories (`au_nsw`, `au_vic`, `au_qld`…)
- **UK:** `gb`, `gb_eng`, `gb_sct`, `gb_wls`, `gb_nir`, `gg` (Guernsey), `je` (Jersey)
- **Europe:** All EU/EEA (`de`, `fr`, `it`, `es`, `nl`, `pl`, `gl`, `gp`, `re`…)
- **APAC, LATAM, MENA, Africa:** Full coverage of all ISO-3166 countries

---

*Sources: `SIC-UK-Codes` repo (integration-service, case-service, warehouse-service), `Entity-Matching` repo (`matching_v1.py`, `build_matching_tables.py`, `feature_generator.py`), `WORTH_INDUSTRY_CLASSIFICATION_REPORT.md` (March 2026)*  
*Document prepared by Worth AI Engineering — March 2026*
