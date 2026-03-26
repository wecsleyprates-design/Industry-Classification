# Industry Classification Audit
## What Worth AI Has · What It Uses · What It Drops · What the Consensus Adds

**Supplementary reference document — read alongside the 4 main decks.**

**Full learning portal:** https://wecsleyprates-design.github.io/Industry-Classification/

**Date:** March 2026  
**Scope:** Complete audit of all six data sources (S3 buckets, TypeScript types, Pydantic models, SQL procedures) across integration-service, warehouse-service, case-service, and manual-score-service based on S3 bucket structure, TypeScript types, Pydantic models, and SQL procedures.

---

## The Three-Way Comparison Framework

```
┌─────────────────────────────────────────────────────────────────────┐
│  COLUMN A              COLUMN B              COLUMN C               │
│  Worth AI TODAY        Worth AI COULD DO     Consensus Engine       │
│  (what it delivers)    (with existing data)  (what we built)       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Source 1: OpenCorporates (`integrations/open_corporate/oc_companies/`)

### What the data contains

The `open_corporate.companies` S3/Redshift table has (from `FirmographicResult` TypeScript type):

| Field | Type | Industry relevance |
|-------|------|-------------------|
| `industry_code_uids` | `string` | **Pipe-delimited ALL jurisdiction codes**: `"us_naics-541110\|uk_sic-62012\|ca_naics-541110\|gb_sic-62012"` |
| `jurisdiction_code` | `string` | Company's registered jurisdiction (e.g. `"gb"`, `"us_ca"`, `"de"`) |
| `home_jurisdiction_code` | `string` | Home jurisdiction for foreign branches |
| `naics` | `number \| null` | Optional direct NAICS integer |
| `company_type` | `string` | Legal entity type |
| `current_status` | `string` | Active / dissolved / dormant |

### Column A — Worth AI Today

```
From industry_code_uids = "us_naics-541110|uk_sic-62012|ca_naics-541110"

USED:    us_naics → 541110  ✅  → naics_code fact (weight 0.90)
DROPPED: uk_sic  → 62012   ❌  → parsed to classification_codes fact but NO downstream consumer
DROPPED: ca_naics→ 541110  ❌  → same — captured but unused
```

**The `datascience.open_corporates_standard` standardization table does NOT include `industry_code_uids`** — it strips industry data when building the matching table, keeping only identity/address columns.

### Column B — Worth AI Could Deliver (with existing data, zero new APIs)

- **UK SIC 2007**: Already in `industry_code_uids` as `gb_sic-62012`. Needs:
  1. One migration: `CREATE TABLE core_uk_sic_code` + `ALTER TABLE data_businesses ADD uk_sic_id`
  2. One line change: read `gb_sic` entries from the same loop that already reads `us_naics`
- **Canadian NAICS**: Already in `industry_code_uids` as `ca_naics-541110`. Needs a Kafka handler consumer for `classification_codes` fact.
- **All other jurisdiction codes** (NACE, ISIC, etc.) if OC supplies them: same `classification_codes` fact already captures them all.

### Column C — Consensus Engine

- Reads all `industry_code_uids` entries and routes by jurisdiction: `gb` → UK SIC, `de/fr/eu` → NACE, others → ISIC
- UK SIC is the **primary output** for GB companies — not dropped
- Cross-taxonomy comparison via UGO FAISS

---

## Source 2: Equifax (`integrations/credit_bureau/`)

### What the data contains

`warehouse.equifax_us_standardized` / `warehouse.equifax_us_latest` — full Equifax MDS US file:

| Field | Description | Industry relevance |
|-------|-------------|-------------------|
| `efx_primnaicscode` | Primary 6-digit NAICS | **Core industry code** |
| `efx_primnaics_sector` | NAICS sector label | Hierarchy level 1 |
| `efx_primnaics_subsector` | NAICS subsector label | Hierarchy level 2 |
| `efx_primnaics_industry_group` | Industry group label | Hierarchy level 3 |
| `efx_primnaics_industry` | Industry label | Hierarchy level 4 |
| `efx_secnaics1` | Secondary NAICS #1 | Additional activity |
| `efx_secnaics1_sector/subsector/industry_group/industry` | Full hierarchy for secondary #1 | |
| `efx_secnaics2/3/4` + full hierarchies | Up to 4 secondary NAICS codes | |
| `efx_primsic` | Primary SIC 1987 (4-digit) | US legacy classification |
| `efx_secsic1/2/3/4` | Up to 4 secondary SIC codes | |
| `efx_primsicdesc` | Primary SIC description | |
| `efx_secsicdesc1/2/3/4` | Secondary SIC descriptions | |

**Total industry-related columns: 25**

Also available via Athena MDS (`mdsus_tbl`):
- `efx_primnaicscode`, `efx_primnaicsdesc`, `efx_secnaicsdesc1` — used in Equifax pre-match SQL

### Column A — Worth AI Today

```
USED:    efx_primnaicscode   ✅  → naics_code fact (weight 0.70)
DROPPED: efx_primnaics_sector/subsector/industry_group/industry  ❌  (4 columns)
DROPPED: efx_secnaics1-4 + full hierarchies  ❌  (20 columns)
DROPPED: efx_primsic   ❌  → in extended_attributes SQL function, no TypeScript fact
DROPPED: efx_secsic1-4  ❌
DROPPED: efx_primsic descriptions  ❌
```

**1 of 25 industry columns used. 24 silently dropped.**

The `datascience.smb_pr_verification_cs` analytics table DOES include all 25 columns (for reporting), but they are not consumed by the fact engine that drives classification.

### Column B — Worth AI Could Deliver

- **Secondary NAICS codes** (4 × full 5-level hierarchy): already in Redshift, never mapped to any fact
- **US SIC 1987**: already in `efx_primsic` in Redshift, `primsic` exists as a fact in `lib/facts/score/index.ts` (scoring use) but not wired to the `naics_code` / `industry` facts
- **NAICS sector hierarchy**: could provide richer industry context for risk scoring (a 6-digit NAICS code plus its 2-digit sector gives much better AML routing)

### Column C — Consensus Engine

- Uses Equifax primary NAICS (same as Worth AI)
- Adds it as a weighted source signal (`weight=0.70`) with match confidence
- Secondary codes from Equifax appear as secondary industry outputs in the consensus result

---

## Source 3: Trulioo / Business Entity Verification (`integrations/business_entity_verification/`)

### What the data contains

Trulioo `StandardizedIndustries` array (from `extractStandardizedIndustriesFromTruliooResponse`):

| Field | Description |
|-------|-------------|
| `NAICSCode` / `naicsCode` | 6-digit US NAICS 2022 |
| `SICCode` / `sicCode` | **UK SIC code** (or US SIC depending on jurisdiction) |
| `IndustryName` / `industryName` | Industry text label |
| `IndustryDescription` | Extended description |

Trulioo returns BOTH `naicsCode` AND `sicCode` in the **same object**, for the same company.

Also: **Middesk** (also in `business_entity_verification`) has a richer `industry_classification` schema:

```typescript
industry_classification: {
  categories: [{
    classification_system: string,  // e.g. "NAICS", "SIC", "MCC"
    name: string,
    sector: string,
    naics_codes: string[],
    sic_codes: string[],
    mcc_codes: string[],
    high_risk: boolean,
    score: number
  }]
}
```

### Column A — Worth AI Today

```
TRULIOO:
USED:    .naicsCode  ✅  → naics_code fact (weight 0.80, fact override 0.70)
USED:    .industryName  ✅  → industry fact
DROPPED: .sicCode   ❌  → adjacent field in same object, never accessed

MIDDESK:
DROPPED: industry_classification.categories[*].naics_codes  ❌  → Middesk NOT wired to naics_code fact
DROPPED: industry_classification.categories[*].sic_codes    ❌
DROPPED: industry_classification.categories[*].mcc_codes    ❌
DROPPED: industry_classification.categories[*].high_risk    ❌  (AML signal — never used)
```

**Trulioo's `.sicCode` is the most fixable gap: one line of code.**

### Column B — Worth AI Could Deliver

- **UK SIC from Trulioo**: `.sicCode` is in the same object as `.naicsCode`. One missing field access. For GB businesses this is a second UK SIC source (alongside OpenCorporates).
- **Middesk NAICS/SIC/MCC**: Rich structured classification with confidence scores and `high_risk` flag. Zero additional API cost — data is already in `integration_data.request_response`. Needs a new fact mapping.
- **Middesk `high_risk` flag**: A direct AML signal — Middesk labels certain industry categories as high risk. Currently completely unused.

### Column C — Consensus Engine

- Reads both Trulioo `.naicsCode` AND `.sicCode` (simulated)
- Uses Middesk as an additional classification signal
- `high_risk` industry flag feeds directly into the AML risk engine

---

## Source 4: Verdata / Public Records (`integrations/public_records/`)

### What the data contains

Verdata provides Secretary of State (SOS) public records:

| Field | Model | Description |
|-------|-------|-------------|
| `sic_code` | `Seller`, `Merchant` | 4-digit SIC code from public filings |
| `industry` | `SecretaryOfStateMerchant` | Free-text industry description |
| No NAICS | — | Verdata does not provide NAICS |

### Column A — Worth AI Today

```
DROPPED: seller.sic_code  ❌  → Verdata used for phone verification, NOT industry
DROPPED: secretary_of_state.merchant.industry  ❌  → not mapped to any fact
```

### Column B — Worth AI Could Deliver

- **SIC code from public records**: A third independent source of US SIC 1987, from Secretary of State filings — the most authoritative US government record. Never touched by the fact pipeline.

### Column C — Consensus Engine

- Verdata SIC would be an additional source signal (currently simulated)
- Would strengthen the majority-code agreement feature in the 38-feature vector

---

## Source 5: ZoomInfo (`integrations/zoominfo/`)

### What the data contains

`zoominfo.comp_standard_global` / `ZoomInfoFirmographic`:

| Field | Description |
|-------|-------------|
| `zi_c_naics2` | 2-digit NAICS sector |
| `zi_c_naics4` | 4-digit NAICS industry group |
| `zi_c_naics6` | **6-digit NAICS** (primary used field) |
| `zi_c_naics_top3` | Top 3 NAICS codes |
| `zi_c_naics_confidence_score` | ZoomInfo's own confidence |
| `zi_c_naics_top3_confidence_scores` | Per-code confidence |
| `zi_c_sic2` | 2-digit SIC division |
| `zi_c_sic3` | 3-digit SIC group |
| `zi_c_sic4` | **4-digit SIC** |
| `zi_c_sic_top3` | Top 3 SIC codes |
| `zi_c_sic_confidence_score` | SIC confidence |
| `zi_c_industry_primary` | Primary industry text |
| `zi_c_sub_industry_primary` | Sub-industry text |
| `zi_c_industries` | All associated industries |
| `zi_c_sub_industries` | All sub-industries |
| `zi_es_industry` | Standardized industry |
| `zi_es_industry_confidence_score` | Confidence |

### Column A — Worth AI Today

```
USED:    zi_c_naics6  ✅  → naics_code fact (weight 0.80)
DROPPED: zi_c_naics2/4  ❌  → sector hierarchy, not used
DROPPED: zi_c_naics_top3 + confidence scores  ❌
DROPPED: zi_c_sic2/3/4  ❌  → US SIC in Redshift, no fact
DROPPED: zi_c_sic_top3 + confidence  ❌
DROPPED: zi_c_industry_primary/sub_industry  ❌  → text labels, not used
DROPPED: All confidence scores  ❌  → ZoomInfo provides its own confidence — ignored
```

### Column B — Worth AI Could Deliver

- **ZoomInfo SIC 1987** (`zi_c_sic4`): In Redshift, never mapped
- **ZoomInfo NAICS confidence score** (`zi_c_naics_confidence_score`): ZoomInfo assigns its own confidence to its NAICS codes — this could replace the entity-matching confidence as a source-level signal, potentially more accurate
- **ZoomInfo top-3 NAICS alternatives**: Secondary classification already provided by ZoomInfo — never surfaced to users

### Column C — Consensus Engine

- ZoomInfo NAICS used as source signal (weight 0.80)
- Confidence from entity matching used (ZoomInfo's own confidence not yet integrated)

---

## Source 6: Middesk / `warehouse/mdsbma_tbl/` and `mdsus_tbl/`

The `mdsbma_tbl` (business match — US) and `mdsus_tbl` are Athena/Iceberg parquet tables from Equifax MDS. They are used for **entity matching pre-processing** (finding Equifax records by company name/address), not for classification output.

| Field | Present in Athena MDS | Used for classification |
|-------|----------------------|------------------------|
| `efx_primnaicscode` | ✅ | Only for match score, not production fact |
| `efx_primnaicsdesc` | ✅ | Not used in facts |
| Business identity fields | ✅ | Used for entity matching |

---

## Source 7: `warehouse/ca_fed_businesses/`

Canadian federal business registry. The `CanadaOpenBusiness` model has **no industry fields** at all — only company identity and address data. Canadian industry classification comes entirely from OpenCorporates `industry_code_uids` (if the company has OC coverage).

---

## The Full Three-Column Comparison

### Industry Classification Capabilities

| Capability | Worth AI Today (A) | Worth AI Could Do (B) | Consensus Engine (C) |
|-----------|-------------------|----------------------|----------------------|
| **US NAICS 2022 (6-digit)** | ✅ Stored in `data_businesses.naics_id` | ✅ Same + secondary codes | ✅ + calibrated probability |
| **US NAICS hierarchy (sector/subsector/group)** | ❌ In Redshift, never used | ✅ Map Equifax hierarchy to fact | ✅ Derived from code prefix |
| **Secondary NAICS codes (4 alternatives)** | ❌ In Equifax data, dropped | ✅ Wire `efx_secnaics1-4` to facts | ✅ Top-5 from XGBoost |
| **UK SIC 2007** | ❌ In OC + Trulioo data, dropped | ✅ One migration + one line | ✅ Primary for GB/GG/JE |
| **US SIC 1987** | ❌ In Equifax + ZoomInfo + Verdata | ✅ Wire `efx_primsic` to a fact | ✅ Secondary output |
| **Canadian NAICS** | ❌ In OC data, dropped | ✅ Wire `classification_codes` consumer | ✅ Primary for CA_PROV |
| **NACE Rev.2 (EU)** | ❌ Not in any source | ❌ No vendor provides it | ✅ Semantic routing via UGO |
| **ISIC Rev.4 (Global)** | ❌ Not in any source | ❌ No vendor provides it | ✅ Global fallback via UGO |
| **MCC code** | ✅ Derived via NAICS JOIN | ✅ + Middesk MCC directly | ✅ + MCC risk note |
| **ZoomInfo NAICS confidence** | ❌ In data, ignored | ✅ Use as source confidence score | ✅ Per-source confidence in features |
| **Middesk NAICS/SIC/MCC** | ❌ In data, no fact mapped | ✅ Map `industry_classification` to facts | ✅ Additional source signal |
| **Middesk `high_risk` flag** | ❌ In data, never used | ✅ Map to AML risk input | ✅ AML risk engine |
| **Verdata SIC (public records)** | ❌ In data, no fact | ✅ Map `seller.sic_code` | ✅ Additional source signal |
| **Calibrated probability** | ❌ Text string only | ❌ Rule cannot output probabilities | ✅ XGBoost softmax 0–1 |
| **AML/KYB risk signals** | ❌ Zero | ⚠️ Middesk `high_risk` available | ✅ 9 signal types |
| **Source lineage** | ⚠️ NAICS per platform only | ✅ Per-source with industry code | ✅ All sources with weight/status |
| **200+ jurisdiction routing** | ❌ All → NAICS regardless | ⚠️ Partial (GB→UK SIC feasible) | ✅ Full routing |
| **Government registry lookup** | ❌ Never directly queried | ✅ OpenCorporates IS queried via Redshift | ✅ + SEC EDGAR + Companies House |
| **Shell company detection** | ❌ | ❌ | ✅ Registry vs web discrepancy |
| **Temporal pivot / code-change** | ❌ | ❌ | ✅ 3-snapshot history |

---

## Summary Statements

### How Worth AI Is/Does/Works/Delivers — Industry Classification

Worth AI receives industry classification data from **6 sources** (OpenCorporates, ZoomInfo, Trulioo, Equifax, Verdata/SOS, Middesk). The FactEngine applies a deterministic confidence-weighted rule to select one winner: the US NAICS code from whichever source has the highest `confidence × weight` product. The result is stored as `naics_id` in `data_businesses`, and MCC is derived via a JOIN on `rel_naics_mcc`. The customer S3 export delivers `naics_code`, `naics_description`, `mcc_code`, `mcc_description`, and `registry_jurisdiction` (from SOS state field).

**What it delivers today:** Single US NAICS 2022 code + MCC + 20-bucket sector label. No UK SIC. No EU taxonomy. No probability. No risk signals. Text confidence only.

### How Worth AI Could Improve — With Data It Already Has

All of these require **zero new vendor contracts or API calls** — the data is already in Redshift or `integration_data.request_response`:

1. **UK SIC 2007** — OpenCorporates `industry_code_uids` already contains `gb_sic-62012`. One migration (`core_uk_sic_code` table + `uk_sic_id` column) + one line of code (read `gb_sic` entries).

2. **UK SIC from Trulioo** — `.sicCode` is adjacent to `.naicsCode` in the same `StandardizedIndustries` object. One missing field access.

3. **Secondary NAICS codes** — Equifax provides up to 4 secondary NAICS codes with full hierarchy. Wire `efx_secnaics1-4` to facts and surface to users.

4. **US SIC 1987** — Equifax `efx_primsic` + ZoomInfo `zi_c_sic4` + Verdata `seller.sic_code`. Three independent sources. No fact currently maps them.

5. **Canadian NAICS** — OpenCorporates `industry_code_uids` contains `ca_naics` entries. The `classification_codes` fact captures them already — needs a Kafka handler consumer.

6. **Middesk industry classification** — Rich structured data with NAICS/SIC/MCC arrays and `high_risk` boolean. Zero additional cost. Needs fact mappings.

7. **ZoomInfo confidence scores** — `zi_c_naics_confidence_score` could replace entity-matching confidence as a more accurate source-level signal.

### How the Consensus Engine Differs

The Consensus Engine:
- Is a **trained probabilistic model** (XGBoost) instead of a rule
- Outputs a **probability distribution** over all codes, not a single winner
- Routes to the **correct taxonomy per jurisdiction** automatically
- Produces **6 taxonomy outputs simultaneously** (NAICS, UK SIC, NACE, ISIC, SIC, MCC)
- Generates **9 AML/KYB risk signals** from data patterns
- Adds **SEC EDGAR** and **Companies House** as authoritative government sources
- Shows full **source lineage** with weight, status, and confidence per vendor
- Handles **200+ jurisdiction codes** (us_mo, ca_bc, ae_az, gg, tz…)

---

## The P0 Fixes — Two Lines, Zero New APIs, Maximum Impact

```
Fix 1: Add UK SIC to OpenCorporates resolver
  File: integration-service/lib/facts/businessDetails/index.ts
  Change: In the industry_code_uids loop, also extract entries where
          codeName === "gb_sic" and route to uk_sic_code fact

Fix 2: Read Trulioo .sicCode for GB businesses
  File: Same file, Trulioo source definition
  Change: Add .find(i => i.sicCode && country === "GB")?.sicCode
          alongside the existing .find(i => i.naicsCode)?.naicsCode

Fix 3: Add persistence layer
  File: case-service/db/migrations/
  Change: CREATE TABLE core_uk_sic_code (id int, code varchar(5), label varchar)
          ALTER TABLE data_businesses ADD uk_sic_id int NULL REFERENCES core_uk_sic_code(id)

These three changes fix the UK SIC gap for every GB business
with zero new API calls, using data Worth AI already receives.
```

---

*Document prepared by Worth AI Engineering · March 2026*  
*Sources: SIC-UK-Codes repo (all four services), S3 bucket structure analysis*
