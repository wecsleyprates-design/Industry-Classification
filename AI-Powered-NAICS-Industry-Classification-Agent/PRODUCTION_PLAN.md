# Industry Classification — Full Production Plan
## From Data Sources to AWS EC2 Deployment

**Document scope:** End-to-end technical specification covering the complete data flow, both XGBoost models, training requirements, artifact storage, and AWS EC2 deployment for the Global Industry Classification Consensus Engine.

All table names, column names, and logic in this document are verified against the source code in `SIC-UK-Codes` and `Entity-Matching` repositories.

---

## Part 1 — The Complete System in One Picture

Before any code, here is the full journey of one company record from submission to industry classification:

```
Applicant submits company info
          │
          ▼
┌─────────────────────────────────────┐
│  integration-service (Node.js)      │
│  Calls APIs in real time:           │
│  • Trulioo  • Equifax               │
│  • ZoomInfo • Middesk               │
│  Stores raw responses in            │
│  integration-service PostgreSQL     │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  warehouse-service (Python)         │
│  Picks up raw responses             │
│  Runs XGBoost Level 1:              │
│  Entity Matching Model              │
│  Scores each source 0–1             │
│  Writes match results to            │
│  Redshift + local DuckDB            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  Redshift: datascience.customer_    │
│  files (the master fact table)      │
│  Contains: zi_match_confidence,     │
│  efx_match_confidence, zi_naics,    │
│  efx_naics, efx_sic, oc_uids, etc. │
│                                     │
│  Production rule runs here:         │
│  IF zi_conf > efx_conf              │
│    → use zi_naics                   │
│  ELSE → use efx_naics               │
│  (single winner, no probability)    │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  case-service (Node.js + PG)        │
│  Analyst reviews the case           │
│  Fact engine picks winning code     │
│  Stores in case-service PostgreSQL: │
│  • data_businesses.naics_id         │
│  • rel_business_industry_naics      │
│    (per-source opinions)            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  manual-score-service (Node.js+PG)  │
│  Analyst overrides stored here      │
│  ← HIGHEST QUALITY training signal  │
│  for Level 2 Consensus Model        │
└─────────────────────────────────────┘
```

---

## Part 2 — XGBoost Model Level 1: Entity Matching

### What it does

Level 1 answers one question: **"Is this submitted company the same real-world entity as this record in our database?"**

It does not classify industries. It does not score risk. It matches identities.

For every submitted company, it compares the company against candidate records from four sources (OpenCorporates, Equifax, ZoomInfo, Liberty) and outputs a **match confidence score between 0 and 1** for each source.

A score ≥ 0.80 means "matched". A score < 0.80 means "not found".

### How it runs in production

The production matching service (`warehouse-service/datapooler/services/match.py`) runs in real time as companies are submitted:

```
1. Integration-service triggers a match request via Kafka message
2. warehouse-service MatchService receives the message
3. _get_candidates() queries Redshift source tables for candidate records
   (blocking search: same region + first 3 chars of name, or exact name)
4. For each candidate pair: compute 32 similarity features
5. XGBoost model scores each pair → match_confidence
6. Top 10 matches per source stored in Redshift match tables:
   - datascience.efx_matches_custom_inc_ml
   - datascience.oc_matches_custom_inc_ml
   - datascience.zoominfo_matches_custom_inc_ml
7. Top match triggers firmographics generation (NAICS pull)
8. Results published to Kafka for downstream services
```

For batch offline runs (the data science pipeline), `matching_v1.py` writes results to a local DuckDB file: `data/{CLIENT_NAME}_results.parquet`.

### Source tables queried by Level 1

| Source | Redshift table | Country coverage | Key identity columns |
|---|---|---|---|
| OpenCorporates | `dev.datascience.open_corporates_standard_ml_2` | All countries | `company_name`, `street_address`, `postal_code`, `city`, `region`, `country_code`, `jurisdiction_code` |
| Equifax | `dev.warehouse.equifax_us_standardized` | US only | `efx_name`, `efx_eng_address`, `efx_eng_zipcode`, `efx_eng_city`, `efx_eng_state` |
| ZoomInfo | `dev.datascience.zoominfo_standard_ml_2` | US, GB, CA | `zi_c_name`, `zi_eng_address`, `zi_eng_zipcode`, `zi_eng_city`, `zi_eng_state` |
| Liberty | `dev.liberty.einmst_20260218` + `einmst_15_5mn` + `einmst_5_3m_remaining` (UNION) | US only | `businessname`, `street`, `zipcode`, `city`, `state`, `fein` |

Country routing — which sources are queried per jurisdiction:

| Country | Sources used |
|---|---|
| US | OpenCorporates + Equifax + ZoomInfo + Liberty |
| GB | OpenCorporates + ZoomInfo |
| CA | OpenCorporates + ZoomInfo |
| IE | OpenCorporates + ZoomInfo |
| All others | OpenCorporates + ZoomInfo |

### The 32 features Level 1 uses

These are all pairwise — they describe the **relationship between the submitted record and the candidate record**, not the records themselves. Every feature is computed for every candidate pair.

**Pre-processing applied to both records before feature computation:**
- Uppercase all text
- Remove accents and diacritics
- Remove special characters (`&` → `AND`, `-/_` → space)
- Strip legal suffixes: LLC, INC, CORP, LTD, LIMITED, LLP, LP, COOP, FOUNDATION, SOCIETY, LTEE, SENCRL, ULC, SCOP, and 40+ more (full list in `build_matching_tables.py` `NORMALIZATION_WORD_PARTS`)
- Strip prefixes: THE, A, AN, LE, LA, LES, L'
- Expand address abbreviations: ST→STREET, AVE→AVENUE, BLVD→BOULEVARD, N→NORTH, etc.
- Compute short name: strip city words from canonized name, concatenate remaining words

---

**Group A — Address Exact Match Flags (binary 0/1)**

| # | Feature name | What it computes |
|---|---|---|
| 1 | `match_zipcode` | submitted_zip == source_zip (exact) |
| 2 | `match_city` | submitted_city == source_city (uppercased) |
| 3 | `match_street_number` | Exact street number equality |
| 4 | `match_street_block` | `(num_a // 100) == (num_b // 100)` — same city block |
| 5 | `match_address_line_2` | Exact match on suite / unit / apartment |
| 6 | `match_short_name` | Exact match on city-stripped concatenated name |

**Group B — Address Distance (numerical)**

| # | Feature name | What it computes |
|---|---|---|
| 7 | `distance_street_number` | `abs(num_a - num_b)`, sentinel 99999 if null |

**Group C — Canonized Business Name, k-gram Jaccard similarity**
*(Jaccard = size of intersection / size of union of character shingles)*

| # | Feature name | Shingle size |
|---|---|---|
| 8 | `similarity_jaccard_1` | 1-character |
| 9 | `similarity_jaccard_2` | 2-character |
| 10 | `similarity_jaccard_3` | 3-character |
| 11 | `similarity_jaccard_4` | 4-character |
| 12 | `similarity_jaccard_word` | Word tokens |

**Group D — Canonized Name, Overlap Coefficient (Normalized Jaccard)**
*(Overlap = intersection / min(size_a, size_b) — more lenient for short names)*

| # | Feature name | Shingle size |
|---|---|---|
| 13 | `sim_norm_jac_1` | 1-character |
| 14 | `sim_norm_jac_2` | 2-character |
| 15 | `sim_norm_jac_3` | 3-character |
| 16 | `sim_norm_jac_4` | 4-character |
| 17 | `sim_norm_jac_word` | Word tokens |

**Group E — Street Name, k-gram Jaccard**

| # | Feature name | Shingle size |
|---|---|---|
| 18 | `similarity_street_name_1` | 1-character |
| 19 | `similarity_street_name_2` | 2-character |
| 20 | `similarity_street_name_3` | 3-character |
| 21 | `similarity_street_name_4` | 4-character |

**Group F — Street Name, Overlap Coefficient**

| # | Feature name | Shingle size |
|---|---|---|
| 22 | `sim_norm_street_name_1` | 1-character |
| 23 | `sim_norm_street_name_2` | 2-character |
| 24 | `sim_norm_street_name_3` | 3-character |
| 25 | `sim_norm_street_name_4` | 4-character |

**Group G — Short Name (city-stripped), k-gram Jaccard**

| # | Feature name | Shingle size |
|---|---|---|
| 26 | `similarity_short_1` | 1-character |
| 27 | `similarity_short_2` | 2-character |
| 28 | `similarity_short_3` | 3-character |
| 29 | `similarity_short_4` | 4-character |

**Group H — Short Name, Overlap Coefficient**

| # | Feature name | Shingle size |
|---|---|---|
| 30 | `sim_norm_short_1` | 1-character |
| 31 | `sim_norm_short_2` | 2-character |
| 32 | `sim_norm_short_3` | 3-character |
| 33 | `sim_norm_short_4` | 4-character |

### Level 1 outputs — where they are stored

**In Redshift (production real-time matches):**

| Table | Schema | What it holds |
|---|---|---|
| `efx_matches_custom_inc_ml` | `datascience` | `business_id`, `efx_id`, `efx_probability`, `similarity_index` |
| `oc_matches_custom_inc_ml` | `datascience` | `business_id`, `company_number`, `jurisdiction_code`, `oc_probability` |
| `zoominfo_matches_custom_inc_ml` | `datascience` | `business_id`, `zi_c_company_id`, `zi_c_location_id`, `zi_es_location_id`, `zi_probability` |
| `customer_files` | `datascience` | Denormalized master fact table — all match confidences + industry codes joined together |

**In local DuckDB (batch/research runs):**

| File | What it holds |
|---|---|
| `data/{CLIENT_NAME}_results.parquet` | `customer_unique_identifier`, `efx_confidence`, `oc_confidence`, `zi_confidence`, `liberty_confidence`, plus matched entity IDs for each source |

### The critical gap Level 1 creates

`customer_files` (alias `global_trulioo_us_kyb`) has the match confidences and the raw industry codes. But the industry classification rule applied to it is:

```sql
-- from customer_table.sql / sp_recreate_customer_files()
primary_naics_code = CASE
    WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6
    ELSE efx_primnaicscode
END
```

This is a **winner-takes-all rule**. It produces:
- One NAICS code
- No probability
- No UK SIC (even though OC returns it in `industry_code_uids`)
- No alternative codes
- No AML signal
- No KYB recommendation

Level 2 is built to replace this rule.

---

## Part 3 — XGBoost Model Level 2: Consensus Industry Classification

### What it does

Level 2 answers: **"Given all available evidence — match confidences, raw industry codes from every source, jurisdiction, entity type — what is the correct industry taxonomy code, and how confident are we?"**

It takes everything Level 1 produced plus the industry codes each matched source returned, and outputs:
- A calibrated probability distribution over industry codes
- Top-3 most likely codes with probabilities
- The correct taxonomy for the jurisdiction (NAICS for US/CA, UK SIC for GB, NACE for EU, etc.)
- AML/KYB risk signals derived from source disagreement and discrepancy patterns
- A KYB recommendation: APPROVE / REVIEW / ESCALATE / REJECT

### The 42 features Level 2 uses

**Group A — Match Confidence Scores (direct outputs of Level 1)**

These are the most important features. The join path to get them:
- `efx_confidence`, `oc_confidence`, `zi_confidence` → from `datascience.customer_files` (already there)
- `liberty_confidence` → from `data/{CLIENT_NAME}_results.parquet` or computed similarly

| # | Feature | Source table | Source column |
|---|---|---|---|
| 1 | `oc_confidence` | `datascience.customer_files` | `oc_probability` |
| 2 | `efx_confidence` | `datascience.customer_files` | `efx_probability` |
| 3 | `zi_confidence` | `datascience.customer_files` | `zi_probability` |
| 4 | `liberty_confidence` | `data/{CLIENT_NAME}_results.parquet` | `liberty_confidence` |
| 5 | `trulioo_confidence` | Trulioo API response | `matchScore` |
| 6 | `ai_semantic_confidence` | Computed at runtime | Cosine similarity between LLM web summary and OC industry label |

**Group B — Entity Match Binary Flags (confidence ≥ 0.80 threshold)**

| # | Feature | Derived from |
|---|---|---|
| 7 | `oc_matched` | `oc_confidence >= 0.80` |
| 8 | `efx_matched` | `efx_confidence >= 0.80` |
| 9 | `zi_matched` | `zi_confidence >= 0.80` |
| 10 | `liberty_matched` | `liberty_confidence >= 0.80` |
| 11 | `trulioo_matched` | `trulioo_confidence >= 0.80` |
| 12 | `ai_matched` | Always 1 — AI always returns a result |

**Group C — Raw Industry Codes per Source**

These are retrieved by joining back from the match result to each source table using the matched entity IDs.

| # | Feature | Source table | Column | Join key |
|---|---|---|---|---|
| 13 | OC industry UIDs (multi-taxonomy) | `open_corporates_standard_ml_2` | `industry_code_uids` | `oc_company_number` + `oc_jurisdiction_code` |
| 14 | OC jurisdiction code | `open_corporates_standard_ml_2` | `jurisdiction_code` | same |
| 15 | Equifax primary NAICS (6-digit) | `equifax_us_standardized` | `efx_primnaicscode` | `efx_id` |
| 16 | Equifax primary SIC (4-digit) | `equifax_us_standardized` | `efx_primsic` | `efx_id` |
| 17 | ZoomInfo NAICS (6-digit) | `zoominfo_standard_ml_2` | `zi_c_naics6` | `zi_c_company_id` + `zi_c_location_id` + `zi_es_location_id` |
| 18 | Liberty NAICS code | `liberty.einmst_*` (UNION) | naics column | `liberty_id` = `fein` |
| 19 | Liberty SIC code | `liberty.einmst_*` (UNION) | sic column | `liberty_id` = `fein` |
| 20 | Trulioo SIC code | Trulioo API | `sicCode` | live API call |

**Group D — Industry Code Discrepancy Signals (AML indicators)**

| # | Feature | How it is computed |
|---|---|---|
| 21 | `trulioo_pollution_flag` | 1 if Trulioo returned a 4-digit SIC for a 5-digit jurisdiction — known data quality defect |
| 22 | `web_registry_distance` | Cosine distance between LLM web summary of company activity and the OC registered industry label |
| 23 | `temporal_pivot_score` | Rate of change of industry code across the last 3 match runs for the same `business_id` |
| 24 | `cross_taxonomy_agreement` | Count of distinct taxonomies (NAICS, UK SIC, NACE, ISIC) that map to the same semantic cluster via UGO |
| 25 | `source_majority_agreement` | Fraction of sources returning the same 6-digit code (e.g. 3 of 5 = 0.60) |
| 26 | `source_code_diversity` | Ratio of unique codes to total codes — high = sources disagree = AML signal |

**Group E — Jurisdiction Flags (from OC `jurisdiction_code`)**

| # | Feature | Value is 1 when |
|---|---|---|
| 27 | `j_us` | `jurisdiction_code == "us"` |
| 28 | `j_us_state` | `jurisdiction_code` starts with `"us_"` (e.g. `us_mo`, `us_ca`) |
| 29 | `j_ca` | `jurisdiction_code == "ca"` |
| 30 | `j_ca_province` | `jurisdiction_code` starts with `"ca_"` (e.g. `ca_bc`, `ca_qc`) |
| 31 | `j_eu` | jurisdiction in EU country list (gb, de, fr, it, es, nl, pl, be, se, no, dk, etc.) |
| 32 | `j_apac` | jurisdiction in APAC list (cn, jp, kr, in, sg, au, hk, th, my, etc.) |
| 33 | `j_latam` | jurisdiction in Latin America list (mx, br, ar, co, cl, pe, etc.) |
| 34 | `j_mena` | jurisdiction in MENA list (ae, sa, ir, tr, eg, dz, etc.) |
| 35 | `j_afr` | jurisdiction in Africa list (za, ng, ke, tz, ug, rw, etc.) |
| 36 | `j_other` | none of the above |
| 37 | `is_subnational` | `jurisdiction_code` contains `_` (has state/province suffix) |
| 38 | `is_naics_jurisdiction` | jurisdiction is US, CA, or AU — meaning NAICS is the correct output taxonomy |

**Group F — Entity Type Flags (from OC company type / name suffix)**

| # | Feature | Value is 1 when |
|---|---|---|
| 39 | `is_holding` | Company type or name suffix indicates holding company |
| 40 | `is_ngo` | Company type indicates non-profit / NGO |
| 41 | `is_partnership` | Company type indicates partnership (LP, LLP, GP) |

**Group G — Aggregate Signal Quality**

| # | Feature | How it is computed |
|---|---|---|
| 42 | `hi_risk_sector` | 1 if any returned code starts with high-risk NAICS prefix: 5511 (Holding), 5221 (Banking), 4236 (Dual-use goods), 9281 (Defence) |
| 43 | `avg_confidence` | Mean of features 1–6 (all six source confidences) |
| 44 | `max_confidence` | Maximum single-source confidence |
| 45 | `sources_above_threshold` | Count of sources with confidence ≥ 0.50, divided by 6 |

---

## Part 4 — Training Data: What Needs to Be Built for Level 2

### The training label (Y)

The ground truth labels for Level 2 do **not** exist as a single ready-to-query Redshift column. They live across two databases and must be assembled with a one-time ETL join.

**Where the labels live:**

| Label source | Database | Table | Column | Quality |
|---|---|---|---|---|
| Analyst-resolved winner | case-service PostgreSQL | `data_businesses` | `naics_id` → `core_naics_code.code` | Medium — fact engine picked it |
| Per-source industry opinions | case-service PostgreSQL | `rel_business_industry_naics` | `naics_id` per `platform` | Medium — pre-resolution opinions |
| Manual analyst overrides | manual-score-service PostgreSQL | `business_scores` + `business_score_factors` | override record | **Highest — human correction** |

The `rel_business_industry_naics` table schema (verified from migration `20241111105459`):

```sql
CREATE TABLE "public"."rel_business_industry_naics" (
    "business_id" uuid NOT NULL,
    "platform"    VARCHAR(255) NOT NULL,   -- which source: 'equifax', 'zoominfo', 'open_corporates', etc.
    "industry_id" INT NULL,                -- FK to core_business_industries
    "naics_id"    INT NULL,                -- FK to core_naics_code
    UNIQUE("business_id", "platform")
);
```

This table exists in **case-service PostgreSQL**, not in Redshift.

### The training features (X)

The features come from Redshift `datascience.customer_files` (the master fact table), enriched with the raw industry codes from each source via the matched entity IDs.

### The ETL join to build the training dataset

This is a one-time script that joins across the two databases:

```
FROM:  Redshift — datascience.customer_files
       → all 45 feature columns (match confidences + industry codes + jurisdiction)

JOIN:  case-service PostgreSQL — rel_business_industry_naics
       → join on business_id
       → pull naics_id → join core_naics_code → get the actual 6-digit NAICS string

ALSO:  manual-score-service PostgreSQL — analyst overrides
       → these override the case-service label where present (highest quality)

OUTPUT: Training CSV / Parquet with columns:
        business_id, feature_1 ... feature_45, label_naics_code
```

**Minimum viable training set:** 2,000 rows with confirmed labels.
**Target for production quality:** 10,000+ rows.
**Expected source:** Every company that has gone through a full KYB case review has a `business_id` in case-service. The number of available training rows equals the number of completed KYB cases.

### Where to save training artifacts

| Artifact | Recommended location | Why |
|---|---|---|
| `training_dataset.parquet` | `s3://worthai-models/consensus/training/training_dataset.parquet` | Versioned, queryable by Athena |
| `consensus_model.ubj` | `s3://worthai-models/consensus/v1/consensus_model.ubj` | XGBoost native binary, loads in <1s |
| `label_encoder.pkl` | `s3://worthai-models/consensus/v1/label_encoder.pkl` | Maps integer class index → NAICS code string |
| `ugo.index` | `s3://worthai-models/consensus/v1/ugo.index` | FAISS semantic index (2,330 taxonomy codes) |
| `ugo_meta.pkl` | `s3://worthai-models/consensus/v1/ugo_meta.pkl` | Metadata for each FAISS vector |
| `feature_config.json` | `s3://worthai-models/consensus/v1/feature_config.json` | Feature list, order, preprocessing steps |
| `evaluation_report.json` | `s3://worthai-models/consensus/v1/evaluation_report.json` | Top-1/Top-3 accuracy, log-loss, confusion matrix |

---

## Part 5 — Step-by-Step: Building Level 2

### Step 1 — Confirm Liberty industry columns

Before anything else, confirm what industry-related columns exist in the three Liberty tables in Redshift:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'liberty'
  AND table_name IN ('einmst_20260218', 'einmst_15_5mn', 'einmst_5_3m_remaining')
  AND column_name ILIKE '%naics%' OR column_name ILIKE '%sic%' OR column_name ILIKE '%industry%'
ORDER BY table_name, column_name;
```

If Liberty carries NAICS/SIC columns, include them in Group C features. If not, Liberty contributes match confidence only (feature 4) and the entity ID for potential future enrichment.

### Step 2 — Extract labels from case-service PostgreSQL

Run this query against case-service PostgreSQL:

```sql
SELECT
    b.id                          AS business_id,
    n.platform,
    c.code                        AS naics_code,
    c.title                       AS naics_title,
    n.industry_id
FROM rel_business_industry_naics n
JOIN data_businesses b ON b.id = n.business_id
JOIN core_naics_code c ON c.id = n.naics_id
WHERE n.naics_id IS NOT NULL
ORDER BY b.id, n.platform;
```

Also extract analyst overrides from manual-score-service PostgreSQL and merge (overrides win over fact-engine decisions).

Save result as `labels.parquet`.

### Step 3 — Extract features from Redshift

```sql
SELECT
    cf.business_id,
    cf.customer_unique_identifier,
    -- Group A: match confidences
    COALESCE(oc.oc_probability,  0.0) AS oc_confidence,
    COALESCE(ef.efx_probability, 0.0) AS efx_confidence,
    COALESCE(zi.zi_probability,  0.0) AS zi_confidence,
    -- Group C: raw industry codes
    oc_src.industry_code_uids          AS oc_industry_uids,
    oc_src.jurisdiction_code           AS oc_jurisdiction_code,
    ef_src.efx_primnaicscode           AS efx_naics,
    ef_src.efx_primsic                 AS efx_sic,
    zi_src.zi_c_naics6                 AS zi_naics
FROM datascience.customer_files cf
LEFT JOIN datascience.oc_matches_custom_inc_ml oc
       ON oc.business_id = cf.business_id
LEFT JOIN datascience.efx_matches_custom_inc_ml ef
       ON ef.business_id = cf.business_id
LEFT JOIN datascience.zoominfo_matches_custom_inc_ml zi
       ON zi.business_id = cf.business_id
LEFT JOIN datascience.open_corporates_standard_ml_2 oc_src
       ON oc_src.company_number   = oc.company_number
      AND oc_src.jurisdiction_code = oc.jurisdiction_code
LEFT JOIN warehouse.equifax_us_standardized ef_src
       ON ef_src.efx_id = ef.efx_id
LEFT JOIN datascience.zoominfo_standard_ml_2 zi_src
       ON zi_src.zi_c_company_id  = zi.zi_c_company_id
      AND zi_src.zi_c_location_id  = zi.zi_c_location_id
      AND zi_src.zi_es_location_id = zi.zi_es_location_id
WHERE cf.business_id IS NOT NULL;
```

Save result as `features.parquet`.

### Step 4 — Join features and labels

```python
import pandas as pd

features = pd.read_parquet("features.parquet")
labels   = pd.read_parquet("labels.parquet")

# Keep only the analyst-resolved winner per business (platform = 'manual' wins, else fact_engine)
labels_resolved = (
    labels.sort_values("platform", key=lambda s: s.map({"manual":0}).fillna(1))
          .groupby("business_id")
          .first()
          .reset_index()
)

training = features.merge(labels_resolved[["business_id","naics_code"]], on="business_id", how="inner")
training = training[training["naics_code"].notna()]
training.to_parquet("s3://worthai-models/consensus/training/training_dataset.parquet")
print(f"Training rows: {len(training)} | Unique NAICS classes: {training['naics_code'].nunique()}")
```

### Step 5 — Engineer all 45 features

Apply jurisdiction bucketing, binary match flags, AML discrepancy signals, and aggregate measures to the raw data. Save the engineered feature matrix as `X.npy` and labels as `y.npy`.

### Step 6 — Train the Consensus XGBoost model

```python
import xgboost as xgb
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, log_loss, top_k_accuracy_score

le = LabelEncoder()
y = le.fit_transform(training["naics_code"].values)
X = training[FEATURE_COLUMNS].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)

model = xgb.XGBClassifier(
    objective      = "multi:softprob",
    num_class      = len(le.classes_),
    tree_method    = "hist",
    device         = "cuda",          # use GPU if available on EC2 (g4dn.xlarge)
    max_depth      = 6,
    n_estimators   = 500,
    learning_rate  = 0.05,
    subsample      = 0.8,
    colsample_bytree = 0.8,
    min_child_weight = 3,
    n_jobs         = -1,
)
model.fit(
    X_train, y_train,
    eval_set    = [(X_test, y_test)],
    verbose     = 50,
)

# Evaluate
probs  = model.predict_proba(X_test)
top1   = accuracy_score(y_test, probs.argmax(1))
top3   = top_k_accuracy_score(y_test, probs, k=3)
ll     = log_loss(y_test, probs)
print(f"Top-1: {top1:.1%}  Top-3: {top3:.1%}  Log-loss: {ll:.4f}")

# Save
model.save_model("consensus_model.ubj")
import pickle
with open("label_encoder.pkl","wb") as f: pickle.dump(le, f)
```

### Step 7 — Build and save the FAISS semantic index

```python
from taxonomy_engine import TaxonomyEngine
te = TaxonomyEngine(rebuild=True)   # one-time ~20 min build
# Automatically saves ugo.index + ugo_meta.pkl to data/
```

Upload all artifacts to S3:

```bash
aws s3 cp consensus_model.ubj  s3://worthai-models/consensus/v1/
aws s3 cp label_encoder.pkl    s3://worthai-models/consensus/v1/
aws s3 cp data/ugo.index       s3://worthai-models/consensus/v1/
aws s3 cp data/ugo_meta.pkl    s3://worthai-models/consensus/v1/
```

---

## Part 6 — AWS EC2 Production Deployment

### Architecture overview

```
Internet
    │
    │ HTTPS :443
    ▼
┌─────────────────────┐
│ Application Load    │
│ Balancer (ALB)      │
│ SSL via ACM         │
└──────────┬──────────┘
           │ HTTP :8501
           ▼
┌─────────────────────┐        ┌──────────────────────────┐
│ EC2 Instance        │        │ S3 Bucket                │
│ t3.large            │◄───────│ worthai-models/          │
│ us-east-1           │        │ consensus/v1/            │
│ Same VPC as         │        │ *.ubj, *.pkl, *.index    │
│ Redshift            │        └──────────────────────────┘
└──────────┬──────────┘
           │ TCP :5439
           ▼
┌─────────────────────┐
│ Redshift Serverless │
│ Same VPC            │
│ datascience.*       │
│ warehouse.*         │
│ liberty.*           │
└─────────────────────┘
```

### EC2 instance specification

| Parameter | Value | Reason |
|---|---|---|
| Instance type | `t3.large` (2 vCPU, 8 GB RAM) | sentence-transformers needs ~2 GB at load; 8 GB gives comfortable headroom |
| AMI | Ubuntu 22.04 LTS | Stable Python 3.12 support, well-tested with all dependencies |
| Region | `us-east-1` | Same region as Redshift Serverless — low latency, no cross-region data transfer cost |
| VPC | Same VPC as Redshift Serverless | Enables private TCP :5439 connection without public exposure |
| Subnet | Private subnet | No public IP needed — traffic enters via ALB |
| Storage | 30 GB gp3 SSD | Code (500 MB) + FAISS index (500 MB) + model artifacts (200 MB) + OS + logs |
| IAM Role | `industry-app-role` | S3 read access to `worthai-models/` bucket |

### Security groups

**EC2 security group (`sg-industry-app`):**

| Direction | Protocol | Port | Source/Destination | Purpose |
|---|---|---|---|---|
| Inbound | TCP | 8501 | ALB security group | Streamlit app |
| Inbound | TCP | 22 | Your office IP only | SSH for maintenance |
| Outbound | TCP | 5439 | Redshift security group | Redshift queries |
| Outbound | TCP | 443 | 0.0.0.0/0 | OpenAI API, DuckDuckGo, Companies House, S3 |

**Redshift security group — add one inbound rule:**

| Direction | Protocol | Port | Source | Purpose |
|---|---|---|---|---|
| Inbound | TCP | 5439 | EC2 security group (`sg-industry-app`) | Allow app to query Redshift |

### Step-by-step EC2 setup

#### 1. Launch the instance

```bash
# Via AWS Console or CLI:
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \  # Ubuntu 22.04 us-east-1
  --instance-type t3.large \
  --key-name your-keypair \
  --security-group-ids sg-industry-app \
  --subnet-id subnet-xxxxx \          # private subnet in same VPC as Redshift
  --iam-instance-profile Name=industry-app-role \
  --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3} \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=industry-classification-app}]'
```

#### 2. Install system dependencies

```bash
ssh ubuntu@<EC2-IP>

sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv python3.12-dev \
                    git build-essential awscli
```

#### 3. Clone the repository and install Python packages

```bash
git clone https://github.com/wecsleyprates-design/Industry-Classification.git
cd Industry-Classification/AI-Powered-NAICS-Industry-Classification-Agent

python3.12 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

#### 4. Download model artifacts from S3

```bash
mkdir -p data

aws s3 cp s3://worthai-models/consensus/v1/consensus_model.ubj  data/
aws s3 cp s3://worthai-models/consensus/v1/label_encoder.pkl    data/
aws s3 cp s3://worthai-models/consensus/v1/ugo.index            data/
aws s3 cp s3://worthai-models/consensus/v1/ugo_meta.pkl         data/
aws s3 cp s3://worthai-models/consensus/v1/feature_config.json  data/
```

#### 5. Set environment variables

Create `/home/ubuntu/.env` (not committed to git, not readable by other users):

```bash
chmod 600 /home/ubuntu/.env
cat > /home/ubuntu/.env << 'EOF'
OPENAI_API_KEY=sk-...
REDSHIFT_HOST=worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com
REDSHIFT_PORT=5439
REDSHIFT_DB=dev
REDSHIFT_USER=readonly_all_access
REDSHIFT_PASSWORD=...
COMPANIES_HOUSE_API_KEY=...
EOF
```

#### 6. Set up systemd service (runs on boot, restarts on failure)

```bash
sudo tee /etc/systemd/system/industry-app.service << 'EOF'
[Unit]
Description=Industry Classification Streamlit App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/Industry-Classification/AI-Powered-NAICS-Industry-Classification-Agent
EnvironmentFile=/home/ubuntu/.env
ExecStart=/home/ubuntu/Industry-Classification/.venv/bin/python -m streamlit run app.py \
    --server.port 8501 \
    --server.headless true \
    --server.enableCORS false \
    --server.enableXsrfProtection false
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable industry-app
sudo systemctl start industry-app
sudo systemctl status industry-app
```

#### 7. Set up Application Load Balancer

```
AWS Console → EC2 → Load Balancers → Create Application Load Balancer

Name:          industry-app-alb
Scheme:        Internet-facing
IP type:       IPv4
VPC:           same VPC as EC2
Subnets:       2× public subnets (ALB must be in public subnets)

Security group: allow inbound :443 from 0.0.0.0/0

Listener:      HTTPS :443
Certificate:   ACM certificate for your domain (e.g. classify.worthai.com)

Target group:
  Type:        Instances
  Protocol:    HTTP :8501
  Health check: HTTP /healthz or GET / (Streamlit returns 200)
  Targets:     register the EC2 instance
```

#### 8. DNS

In Route 53 (or your DNS provider), add an A record:
```
classify.worthai.com → ALB DNS name (industry-app-alb-xxx.us-east-1.elb.amazonaws.com)
```

### Monitoring

```bash
# View live app logs
sudo journalctl -u industry-app -f

# Restart the app after a code update
cd /home/ubuntu/Industry-Classification
git pull origin main
sudo systemctl restart industry-app

# Check memory usage (important — sentence-transformers uses ~2 GB)
free -h
```

---

## Part 7 — Continuous Model Retraining

Once Level 2 is in production, the model should be retrained regularly as new analyst decisions accumulate.

### Retraining trigger

| Condition | Action |
|---|---|
| Weekly cron (every Monday 02:00 UTC) | Run ETL to check for new labels |
| New labels > 200 since last training | Retrain Level 2 model |
| Analyst override rate > 15% of cases | Flag for review — source data quality may have shifted |
| Any source's NAICS agreement drops below 60% | Reweight source confidences |

### Retraining script (weekly cron on EC2)

```bash
# /home/ubuntu/retrain.sh
#!/bin/bash
set -e
source /home/ubuntu/.env
source /home/ubuntu/Industry-Classification/.venv/bin/activate

cd /home/ubuntu/Industry-Classification/AI-Powered-NAICS-Industry-Classification-Agent

python3 run_experiment.py --retrain --upload-to-s3

# If new model is better than current production model:
aws s3 cp data/consensus_model.ubj s3://worthai-models/consensus/v$(date +%Y%m%d)/
sudo systemctl restart industry-app

echo "Retraining complete: $(date)"
```

```bash
# Add to crontab
crontab -e
# Add line:
0 2 * * 1 /home/ubuntu/retrain.sh >> /home/ubuntu/retrain.log 2>&1
```

---

## Part 8 — Complete Checklist: Everything Needed Before Launch

### Infrastructure (AWS)

- [ ] EC2 instance `t3.large` launched in same VPC as Redshift
- [ ] Security group rules set: EC2 ↔ Redshift TCP 5439, ALB → EC2 TCP 8501
- [ ] Redshift security group updated: inbound TCP 5439 from EC2 security group
- [ ] ALB created with HTTPS listener and ACM certificate
- [ ] DNS A record pointing domain to ALB
- [ ] IAM role with S3 read access attached to EC2 instance
- [ ] S3 bucket `worthai-models` created with versioning enabled

### Database permissions

- [ ] `GRANT SELECT ON datascience.open_corporates_standard_ml_2 TO readonly_all_access`
- [ ] `GRANT SELECT ON datascience.customer_files TO readonly_all_access`
- [ ] `GRANT SELECT ON datascience.oc_matches_custom_inc_ml TO readonly_all_access`
- [ ] `GRANT SELECT ON datascience.efx_matches_custom_inc_ml TO readonly_all_access`
- [ ] `GRANT SELECT ON datascience.zoominfo_matches_custom_inc_ml TO readonly_all_access`
- [ ] `GRANT SELECT ON warehouse.equifax_us_standardized TO readonly_all_access`
- [ ] `GRANT SELECT ON datascience.zoominfo_standard_ml_2 TO readonly_all_access`
- [ ] `GRANT SELECT ON liberty.einmst_20260218 TO readonly_all_access`
- [ ] `GRANT SELECT ON liberty.einmst_15_5mn TO readonly_all_access`
- [ ] `GRANT SELECT ON liberty.einmst_5_3m_remaining TO readonly_all_access`
- [ ] Confirm Liberty industry columns: query `information_schema.columns` for NAICS/SIC fields

### Level 2 model training

- [ ] ETL script built to export labels from case-service PostgreSQL (`rel_business_industry_naics`)
- [ ] ETL script built to export analyst overrides from manual-score-service PostgreSQL
- [ ] Feature extraction query run against Redshift `datascience.customer_files`
- [ ] Labels and features joined on `business_id` → `training_dataset.parquet` (target: ≥2,000 rows)
- [ ] 45-feature engineering pipeline implemented and tested
- [ ] XGBoost Level 2 model trained and evaluated (target: top-1 ≥ 50%, top-3 ≥ 75%)
- [ ] `consensus_model.ubj` uploaded to S3
- [ ] `label_encoder.pkl` uploaded to S3
- [ ] FAISS UGO index built offline (one-time ~20 min) and uploaded to S3
- [ ] `feature_config.json` defines exact feature order and preprocessing

### Application

- [ ] All model artifacts downloaded to EC2 `data/` directory
- [ ] `/home/ubuntu/.env` created with all credentials (chmod 600)
- [ ] `requirements.txt` installs cleanly on Python 3.12
- [ ] `systemd` service created, enabled, started, and confirmed healthy
- [ ] ALB health check passing
- [ ] App loads at `https://classify.worthai.com` with Redshift: LIVE status
- [ ] Companies House API key set (optional but recommended for UK companies)
- [ ] Weekly retraining cron configured

### Operational

- [ ] Log rotation configured (`/etc/logrotate.d/industry-app`)
- [ ] CloudWatch agent installed for CPU/memory/disk alarms
- [ ] SNS alert if systemd service crashes
- [ ] Git pull + systemctl restart deployment script documented for the team

---

## Summary: The Critical Path

The single sequence of tasks that must happen in order, where each step depends on the previous:

```
1. Add EC2 security group to Redshift inbound rules     [15 min — AWS access needed]
     ↓
2. Grant SELECT on all required Redshift tables         [15 min — DBA needed]
     ↓
3. Confirm Liberty industry column names                [1 hour — SQL query]
     ↓
4. Export labels from case-service + manual-score-service PostgreSQL   [1 day]
     ↓
5. Extract features from Redshift and join to labels    [2-4 hours]
     ↓
6. Train Level 2 Consensus XGBoost model                [2-4 hours]
     ↓
7. Build FAISS UGO semantic index offline               [20-30 min]
     ↓
8. Upload all artifacts to S3                           [15 min]
     ↓
9. Launch EC2 instance, install app, configure service  [2-3 hours]
     ↓
10. Set up ALB + DNS + HTTPS                            [2 hours]
     ↓
11. Verify: Redshift LIVE, Model loaded, Classify works [30 min testing]
```

Total elapsed time from start to production: **2-3 working days**, assuming database access and AWS permissions are available from day one.
