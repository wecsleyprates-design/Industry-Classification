# Industry Classification Modeling Guide
## Production Pipeline vs Consensus XGBoost — Complete Reference

---

## 1. The Core Question This Document Answers

> "The experiment results table shows columns like `Prod: NAICS code`, `Cons: Probability`,
> `Cons: Majority agreement`. What does each column mean, where does the data come from,
> and what is real vs simulated?"

---

## 2. Where the Data Comes From — What Is Real vs Simulated

### What Already Exists in Redshift (REAL data, already produced by production)

Every time a company applies through the Worth AI platform, the production pipeline
runs and writes results to Redshift. This means the following data **already exists**
for every company that has been processed:

| What | Redshift table | Column(s) | Who produced it |
|---|---|---|---|
| Level 1 — OC match confidence | `datascience.oc_matches_custom_inc_ml` | `oc_probability` | Level 1 XGBoost |
| Level 1 — Equifax match confidence | `datascience.efx_matches_custom_inc_ml` | `efx_probability` | Level 1 XGBoost |
| Level 1 — ZoomInfo match confidence | `datascience.zoominfo_matches_custom_inc_ml` | `zi_probability` | Level 1 XGBoost |
| Level 1 — raw confidence (denorm) | `datascience.customer_files` | `zi_match_confidence`, `efx_match_confidence` | Level 1 XGBoost |
| OpenCorporates industry codes | `datascience.open_corporates_standard_ml_2` | `industry_code_uids` | OC API / S3 load |
| Equifax NAICS + SIC | `warehouse.equifax_us_standardized` | `efx_primnaicscode`, `efx_primsic` | Equifax API |
| ZoomInfo NAICS | `datascience.zoominfo_standard_ml_2` | `zi_c_naics6` | ZoomInfo API |
| Liberty NAICS | `liberty.einmst_*` (3 tables UNION) | naics / sic columns | Liberty Data file |
| Production rule output | `datascience.customer_files` | `naics_code` | `customer_table.sql` rule |
| Trulioo SIC | `datascience.global_trulioo_us_kyb` | `sicCode` / equivalent | Trulioo API |

### What the Consensus Model Produces (NEW — not in Redshift yet)

The Consensus Level 2 XGBoost is trained and run in the experiment. Its outputs
do not currently exist in Redshift because the model has not been deployed yet:

| What | Produced by | Status |
|---|---|---|
| Calibrated probability per NAICS code | Level 2 XGBoost | New — not in production |
| Top-3 alternative codes | Level 2 XGBoost | New |
| UK SIC as primary output for GB companies | Level 2 routing | New |
| AML/KYB risk signals (6 types) | Feature engineering + Level 2 | New |
| KYB recommendation (APPROVE/REVIEW/ESCALATE/REJECT) | Risk score | New |

### Two Separate Concepts: Best Source vs Production Classification Winner

**Important distinction:**

- **`best_source`** — the source with the highest Level 1 confidence across ALL sources
  (Equifax, OpenCorporates, ZoomInfo, Liberty). OpenCorporates and Liberty CAN and DO win
  this comparison. The entity_matching_dashboard.py report shows this correctly.

- **`Prod: Winning source` (production classification rule)** — which vendor's INDUSTRY CODE
  gets written to the database. This is a different and more restrictive rule:

```sql
-- customer_table.sql
IF zi_match_confidence > efx_match_confidence
    → use ZoomInfo NAICS code
ELSE
    → use Equifax NAICS code
```

This rule only selects between **two sources** for the industry CODE.
OpenCorporates and Liberty have their Level 1 confidence computed — and OC or Liberty
may even be the best-matching source overall — but the production classification rule
**never reads their industry codes** for the final NAICS output.

So when the experiment results show `Prod: Winning source = zoominfo` or `equifax`,
this refers specifically to which source's NAICS code was selected by the rule —
not which source had the highest entity match confidence overall.

This is one of the four confirmed gaps that the Consensus engine addresses.

---

## 3. The Level 1 XGBoost Model — Inputs and Outputs

### What Level 1 Does

Level 1 (`entity_matching_20250127 v1`, in the Entity-Matching repo) answers:
**"Is this submitted company the same real-world entity as this record in our database?"**

It does NOT classify industries. It matches identities.

### Level 1 Inputs — 33 Pairwise Features

For every candidate pair (submitted company ↔ source record), Level 1 computes:

**Address Exact Matches (binary 0/1):**
- `match_zipcode` — submitted zip == source zip
- `match_city` — submitted city == source city (uppercased)
- `match_street_number` — exact street number equality
- `match_street_block` — `(num_a // 100) == (num_b // 100)` — same city block
- `match_address_line_2` — suite/unit/apt exact match
- `match_short_name` — city-stripped concatenated name exact match

**Address Distance:**
- `distance_street_number` — `|num_a - num_b|` (sentinel 99999 if null)

**Business Name Similarity — Jaccard k-gram (k=1,2,3,4,word):** 5 features
**Business Name Similarity — Overlap Coefficient (k=1,2,3,4,word):** 5 features
**Street Name Similarity — Jaccard (k=1,2,3,4):** 4 features
**Street Name Similarity — Overlap (k=1,2,3,4):** 4 features
**Short Name Similarity — Jaccard (k=1,2,3,4):** 4 features
**Short Name Similarity — Overlap (k=1,2,3,4):** 4 features

**Pre-processing applied to both records before computing features:**
- Uppercase all text
- Remove accents, diacritics, French characters
- Strip legal suffixes (LLC, INC, CORP, LTD, LLP, LP, COOP, FOUNDATION, 40+ more)
- Strip prefixes (THE, A, AN, LE, LA)
- Expand address abbreviations (ST→STREET, AVE→AVENUE, N→NORTH, etc.)
- Compute short name: strip city words, concatenate remaining words

### Level 1 Outputs — One Score per Source

| Output | Column in Redshift | Threshold | Meaning |
|---|---|---|---|
| OC match confidence | `datascience.oc_matches_custom_inc_ml.oc_probability` | ≥ 0.80 = matched | Probability that submitted company = this OC record |
| Equifax match confidence | `datascience.efx_matches_custom_inc_ml.efx_probability` | ≥ 0.80 = matched | Same for Equifax |
| ZoomInfo match confidence | `datascience.zoominfo_matches_custom_inc_ml.zi_probability` | ≥ 0.80 = matched | Same for ZoomInfo |
| Liberty match confidence | `data/{TABLE}_results.parquet` (local, not Redshift) | ≥ 0.80 = matched | Same for Liberty |

### Country Routing for Level 1

Level 1 only queries sources that are available for each country:

| Country | Sources queried |
|---|---|
| US | OpenCorporates + Equifax + ZoomInfo + Liberty |
| GB | OpenCorporates + ZoomInfo |
| CA | OpenCorporates + ZoomInfo |
| IE | OpenCorporates + ZoomInfo |
| All others | OpenCorporates + ZoomInfo |

---

## 4. The Production Pipeline — What Gets Stored

### The Rule (`customer_table.sql`)

```sql
primary_naics_code = CASE
    WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6
    ELSE efx_primnaicscode
END
```

### What Gets Written to the Database

| Data | Stored? | Where |
|---|---|---|
| Winning NAICS code | ✅ Yes | `datascience.customer_files.naics_code` |
| Winning source (ZI or EFX) | ✅ Yes (implicit via confidence columns) | `customer_files` |
| Match confidence per source | ✅ Yes | `customer_files.zi_match_confidence`, `.efx_match_confidence` |
| OC `industry_code_uids` (multi-taxonomy) | ✅ Yes (raw field) | `open_corporates_standard_ml_2` |
| UK SIC from OC `industry_code_uids` | ❌ No — silently dropped | No table exists |
| Probability for the winning code | ❌ No | Never computed |
| Alternative codes | ❌ No | Single code only |
| AML risk signals | ❌ No | No risk engine in production |
| KYB recommendation | ❌ No | Not produced |
| Jurisdiction-based taxonomy routing | ❌ No | Always NAICS regardless of country |

---

## 5. The Experiment Results Table — Column-by-Column Reference

### Production Columns

#### `Prod: NAICS code`
The single industry code written to `datascience.customer_files.naics_code`
by the production `customer_table.sql` rule.

Selected by: `max(zi_match_confidence, efx_match_confidence)` → winner's code.

No probability. No alternatives. No uncertainty measure.

#### `Prod: Winning source`
Which vendor won the binary comparison: `zoominfo` or `equifax`.

Only these two sources can ever win. OpenCorporates and Liberty are used
by Level 1 for matching but their industry codes are never routed through
the production classification rule.

#### `Prod: Match confidence`
The Level 1 XGBoost match confidence score for the winning source.
This is the raw output of `entity_matching_20250127 v1`.

- **≥ 0.80** = matched (entity found in vendor database)
- **< 0.80** = weak match (but code still used if it wins the ZI vs EFX comparison)

#### `Prod: UK SIC returned`
Whether OpenCorporates returned a UK SIC code in its `industry_code_uids`
pipe-delimited field for this company.

Example OC uid string: `gb_sic-56101|us_naics-722511`

Production extracts this field from the database but **never uses the UK SIC part**.

Values:
- `56101 (received, DROPPED)` — OC returned a UK SIC, production ignored it
- `Not returned` — OC had no UK SIC for this company

#### `Prod: UK SIC persisted`
Always `Never — no table`. The production database has no `core_uk_sic_code`
table. There is nowhere to write UK SIC codes even when they are received.

---

### Consensus Columns

#### `Cons: Primary code`
The top-1 industry code predicted by the Level 2 XGBoost Consensus model.

Unlike production, Level 2 scores every possible NAICS code simultaneously
and returns the one with the highest calibrated probability, using all 6
vendor signals as input (not just ZI vs EFX).

#### `Cons: Primary taxonomy`
Which classification system the primary code belongs to, determined by the
company's jurisdiction code from OpenCorporates:

| Jurisdiction | Taxonomy |
|---|---|
| `us`, `us_*`, `ca`, `ca_*`, `au` | US_NAICS_2022 |
| `gb`, `gg`, `je` | UK_SIC_2007 |
| `de`, `fr`, `it`, `es`, `nl`, `pl`, EU countries | NACE_REV2 |
| All others | ISIC_REV4 |

Production always outputs NAICS regardless of jurisdiction.
A UK company in the Consensus approach gets UK SIC 2007 as its primary code.

#### `Cons: Probability`
Calibrated probability (0–100%) that Level 2 assigns to its top-1 prediction.

This is the `predict_proba()` output of `XGBClassifier(objective="multi:softprob")`.
The probabilities across all NAICS codes sum to 1.

How to interpret:
- **≥ 70%** — High confidence. Clear signal from sources.
- **40–69%** — Medium confidence. Some source disagreement. Secondary review recommended.
- **< 40%** — Low confidence. Sources conflict. `LOW_CONSENSUS_PROB` flag raised.

**Production has no equivalent.** One code is returned with no uncertainty measure.

#### `Cons: Secondary codes`
The 2nd and 3rd most probable NAICS codes from Level 2, pipe-separated.

Useful for: understanding what other industries the model considered, detecting
hybrid businesses, flagging cases where the top-2 codes are in very different sectors
(potential shell company signal).

#### `Cons: Majority agreement`
Fraction of sources (OC, Equifax, ZoomInfo, Liberty) that returned the **same**
6-digit NAICS code. Range 0.0–1.0.

Formula: `count(sources with same code) / total sources with a code`

- **1.0** — All sources agree. Highest confidence.
- **0.333** — Only 1 in 3 agree. `SOURCE_CONFLICT` flag fires below 0.40.
- **0.0** — Every source returned a different code.

**Production ignores this signal entirely** — the winner-takes-all rule makes no
use of whether other sources agree or disagree.

#### `Cons: Temporal pivot`
Rate of change in a company's industry code across the last 3 API calls.

- **Near 0** — Stable industry classification. Normal.
- **> 0.50** — `STRUCTURE_CHANGE` flag fires. Potential AML signal.

In AML/KYB context: a company that frequently changes its registered industry
is a red flag for "U-Turn fraud" or unreported business changes.

**Production has no equivalent.**

#### `Cons: Web↔Registry dist`
Semantic distance between:
1. What the AI found about the company on its web presence
2. What the official registry (OpenCorporates) says the company does

Range: 0.0 (identical) to 1.0 (completely different).

- **< 0.40** — Consistent. Web and registry agree.
- **0.40–0.55** — Some divergence. Normal for growing companies.
- **> 0.55** — `REGISTRY_DISCREPANCY` fires. Strong shell company indicator.

Example: Company registered as "Investment Holding" (low risk) but website describes
"Electronics Wholesaling" (high risk for dual-use goods) → distance 0.70+.

**Production has no equivalent.**

#### `Cons: Sources matched`
Count of the 4 data sources (OC, Equifax, ZoomInfo, Liberty) that matched this
company at or above the 0.80 confidence threshold from Level 1.

- **3–4** — Well-known, verifiable entity. Multiple sources confirm.
- **1–2** — Known but limited coverage.
- **0** — Unknown company or very new. No source has a confident match. High uncertainty.

Note: OpenCorporates and Liberty can contribute to this count even though they
can never "win" the production rule. In the Consensus model, all 4 sources are
weighted contributors.

#### `Cons: Risk score`
Composite AML/KYB risk score from 0.0 to 1.0, computed from the feature signals:

| Signal | Weight | Threshold |
|---|---|---|
| Code in high-risk NAICS sector | 30% | Any (5511, 5221, 4236, 9281) |
| Registry↔Web discrepancy | 25% | > 0.55 |
| Temporal pivot (structure change) | 20% | > 0.50 |
| Source majority disagreement | 15% | Agreement < 0.40 |
| Trulioo pollution flag | 5% | 4-digit SIC returned |
| Low consensus probability | 10% | Top-1 prob < 40% |

**Production risk score: always 0 (not computed).**

#### `Cons: KYB recommendation`
Underwriting action based on risk score:

| Risk Score | Recommendation | Action |
|---|---|---|
| < 0.25 | **APPROVE** | Proceed automatically |
| 0.25–0.49 | **REVIEW** | Human review recommended |
| 0.50–0.74 | **ESCALATE** | Senior analyst required |
| ≥ 0.75 | **REJECT** | Decline or intensive KYB |

**Production KYB recommendation: None produced.**

#### `Cons: Risk flags`
Specific AML/KYB signal types that fired:

| Flag | What triggers it |
|---|---|
| `HIGH_RISK_SECTOR` | NAICS prefix: 5511 (Holding), 5221 (Banking), 4236 (Dual-use), 9281 (Defence) |
| `REGISTRY_DISCREPANCY` | Web↔Registry distance > 0.55 |
| `STRUCTURE_CHANGE` | Temporal pivot score > 0.50 |
| `SOURCE_CONFLICT` | Source majority agreement < 0.40 |
| `TRULIOO_POLLUTION` | Trulioo returned 4-digit SIC for 5-digit jurisdiction |
| `LOW_CONSENSUS_PROB` | Level 2 top-1 probability < 40% |

---

### Comparison Columns

#### `UK SIC: Production` / `UK SIC: Consensus`
Side-by-side showing what production received from OC vs what Consensus actually uses:

| UK SIC: Production | UK SIC: Consensus | Meaning |
|---|---|---|
| `56101 (received, DROPPED)` | `✅ Primary output` | UK company: OC returned SIC, production dropped it, Consensus uses it as primary |
| `Not returned` | `—` | US company: OC returned NAICS, no UK SIC in OC response |

#### `Codes agree`
- `True` — Production and Consensus returned the same code
- `False` — They differ. Worth checking which is more accurate.

#### `Improvement`
- `✅ Both agree` — Both pipelines agree. High confidence.
- `🟡 Consensus differs (check)` — Consensus overrides production. Review which is correct.
- `🔴 Production had no code` — Production returned nothing; Consensus still produced an answer.

---

## 6. The 45 Features Fed to Level 2 XGBoost

Level 2 uses these 45 features, all derived from data already in Redshift:

### Group A — Source Confidence Scores (6 features)
Level 1 outputs, weighted by source reliability:

| Feature | Source | Weight | Redshift column |
|---|---|---|---|
| `oc_confidence` | OC match probability × 0.90 | 0.90 | `oc_matches_custom_inc_ml.oc_probability` |
| `efx_confidence` | EFX match probability × 0.70 | 0.70 | `efx_matches_custom_inc_ml.efx_probability` |
| `zi_confidence` | ZI match probability × 0.80 | 0.80 | `zoominfo_matches_custom_inc_ml.zi_probability` |
| `liberty_confidence` | Liberty match probability × 0.78 | 0.78 | `liberty._results.parquet` (local) |
| `tru_confidence` | Trulioo match probability × 0.80 | 0.80 | `global_trulioo_us_kyb` |
| `ai_confidence` | AI semantic confidence × 0.70 | 0.70 | Computed at runtime |

### Group B — Binary Match Flags (6 features)
Whether each source matched at ≥ 0.80 threshold:
`oc_matched`, `efx_matched`, `zi_matched`, `liberty_matched`, `tru_matched`, `ai_matched`

### Group C — Industry Code Agreement Signals (6 features)
`tru_pollution_flag`, `web_registry_distance`, `temporal_pivot_score`,
`cross_taxonomy_agreement`, `source_majority_agreement`, `source_code_diversity`

### Group D — Jurisdiction Flags (12 features)
One-hot encoding of the OC `jurisdiction_code`:
`j_us`, `j_us_state`, `j_ca`, `j_ca_province`, `j_eu`, `j_apac`,
`j_latam`, `j_mena`, `j_afr`, `j_other`, `is_subnational`, `is_naics_jurisdiction`

### Group E — Entity Type Flags (3 features)
Derived from company name suffix:
`is_holding`, `is_ngo`, `is_partnership`

### Group F — Aggregate Quality Measures (4 features)
`hi_risk_sector`, `avg_confidence`, `max_confidence`, `sources_above_threshold`

---

## 7. How to Get Real Results (Using Redshift Data)

When Redshift is reachable, `data_loader.py` automatically uses real data.
The Redshift query pulls:
- Level 1 confidence scores from the three match tables
- Vendor industry codes from source tables (joined via matched entity IDs)
- Production rule output from `customer_files`

When Redshift is **not** reachable (no VPN / public access not enabled), the
data loader generates synthetic data that mirrors the exact schema and realistic
confidence distributions.

**To use real data:**

Option A — Enable Redshift public access (AWS Console → Redshift Serverless →
Workgroup → Edit → Toggle "Publicly accessible" ON).

Option B — Run from inside the AWS VPC (EC2 instance, local machine with VPN).

Then set environment variables:
```bash
export REDSHIFT_HOST=worthai-services-redshift-endpoint-...
export REDSHIFT_USER=readonly_all_access
export REDSHIFT_PASSWORD=...
export REDSHIFT_DB=dev
```

And delete `experiment_results.csv` to force a fresh load, then re-run the notebook.

---

## 8. The Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  SOURCES (data already received and stored in Redshift)         │
│                                                                 │
│  OpenCorporates  →  industry_code_uids (multi-taxonomy pipe)    │
│  Equifax         →  efx_primnaicscode, efx_primsic              │
│  ZoomInfo        →  zi_c_naics6                                 │
│  Liberty         →  naics, sic columns                          │
│  Trulioo         →  sicCode (via global_trulioo_us_kyb)         │
└──────────────────────────────┬──────────────────────────────────┘
                               │ All stored in Redshift
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  LEVEL 1 XGBOOST (entity_matching_20250127 v1)                  │
│  Same model used by BOTH production and consensus               │
│                                                                 │
│  Input:  33 pairwise text/address similarity features           │
│  Output: match_confidence per source (0.0 – 1.0)               │
│                                                                 │
│  oc_probability  → oc_matches_custom_inc_ml                     │
│  efx_probability → efx_matches_custom_inc_ml                    │
│  zi_probability  → zoominfo_matches_custom_inc_ml               │
│  liberty_conf    → {TABLE}_results.parquet (local)              │
└──────────────────┬──────────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌────────────────┐   ┌───────────────────────────────────────────┐
│   PRODUCTION   │   │   CONSENSUS ENGINE (Level 2 XGBoost)      │
│                │   │                                           │
│  Rule:         │   │  Input: 45 features built from Level 1    │
│  max(zi,efx)   │   │  outputs + vendor industry codes          │
│  wins          │   │                                           │
│                │   │  Model: XGBClassifier(multi:softprob)     │
│  Output:       │   │  Label: rel_business_industry_naics        │
│  1 NAICS code  │   │  (analyst corrections in case-service PG) │
│  No prob       │   │                                           │
│  No UK SIC     │   │  Output:                                  │
│  No AML        │   │  • Top-3 codes with probabilities         │
│  No KYB        │   │  • UK SIC as primary for GB companies     │
└────────┬───────┘   │  • 6 AML signal types                    │
         │           │  • APPROVE/REVIEW/ESCALATE/REJECT         │
         ▼           └───────────────────────────────────────────┘
  Stored in:
  customer_files.naics_code
```
