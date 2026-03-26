# The Two XGBoost Models in Industry Classification
## A Deep Dive: What Worth AI Has, What Is Missing, and Why the Consensus Engine Needs Both

**📚 Deck 3 of 4 — Read after Technical Briefing.**

| Reading Order | Document | Slides |
|---|---|---|
| 1 | [PIPELINE_PHASES_DEEP_DIVE.md](PIPELINE_PHASES_DEEP_DIVE.md) | [phases.html](https://wecsleyprates-design.github.io/Industry-Classification/phases.html) |
| 2 | [TECHNICAL_BRIEFING.md](TECHNICAL_BRIEFING.md) | [slides.html](https://wecsleyprates-design.github.io/Industry-Classification/slides.html) |
| **3 → You are here** | This document | [models.html](https://wecsleyprates-design.github.io/Industry-Classification/models.html) |
| 4 | — | [presentation.html](https://wecsleyprates-design.github.io/Industry-Classification/presentation.html) |

**Full learning portal:** https://wecsleyprates-design.github.io/Industry-Classification/

**Audience:** Engineering team, data scientists, product managers  
**Date:** March 2026  
**Source:** `entity_matching/core/matchers/matching_v1.py`, `integration-service/lib/facts/`, new Consensus Engine codebase

---

## Overview: Two Completely Different Questions

Before going into any detail, the most important thing to understand is that both models answer **completely different questions**:

| | Model 1 — Entity Matching | Model 2 — Classification Consensus |
|---|---|---|
| **Question** | *"Is this database record the same company as the input?"* | *"Given everything we know, what industry code is most likely correct — and how confident are we?"* |
| **Problem type** | Binary / probabilistic similarity | Multi-class probabilistic classification |
| **Input** | Name + address similarity features between two company records | 38 engineered signals aggregated from all vendors, jurisdiction, history |
| **Output** | A single `match_confidence` score (0–1) per candidate record | A probability distribution over all industry codes |
| **Exists in Worth AI** | ✅ Yes (`entity_matching_20250127`) | ❌ No (replaced by a deterministic rule) |
| **Exists in Consensus** | ✅ Yes (extended) | ✅ Yes (new, `XGBClassifier multi:softprob`) |

---

## Part 1 — Model 1: Entity Matching XGBoost

### 1.1 The Problem It Solves

When a user submits a company ("Apple Inc, 1 Infinite Loop, Cupertino CA"), the system needs to find the matching record in each vendor database. This is not trivial:

- OpenCorporates has **16+ million GB companies alone** and millions more globally
- Equifax has a **standardized US company file** with millions of records
- ZoomInfo has **hundreds of millions** of company records worldwide
- Liberty Data has a commercial intelligence overlay of its own

A simple name search returns dozens of candidates. "Apple" matches "Apple Inc," "Apple Computer Inc," "Apple Bank for Savings," "Apple Valley Unified School District," and thousands of others. Without a model to score which candidate is the *same real-world company* as the input, every vendor lookup would return noise.

### 1.2 What It Does — Step by Step

```
INPUT: company_name = "Apple Inc"
       address = "1 Infinite Loop, Cupertino, CA 95014"
       country = "US"

STEP 1: Canonise the name
   strip legal suffixes (LLC, Inc, Corp, GmbH, PLC, SAS, KK…)
   strip prefixes (The, A, An)
   strip accents, special characters
   collapse whitespace
   → canonical_name = "APPLE"

STEP 2: Block candidates from Redshift
   SELECT * FROM open_corporate.companies
   WHERE LEFT(normalised_name, 3) = 'APP'  -- prefix blocking
   AND region = 'CA'
   → returns ~200 candidate records

STEP 3: Compute similarity features for each candidate pair
   (input_record, candidate_record) → 26 numeric features

STEP 4: XGBoost predict_proba(features)
   → match_confidence = 0.97  for "Apple Inc. (CIK 0000320193, CA)"
   → match_confidence = 0.12  for "Apple Bank for Savings (NY)"
   → match_confidence = 0.08  for "Apple Valley USD (CA)"

STEP 5: Apply threshold
   match_confidence ≥ 0.80 → MATCHED
   → Use this record's industry_code_uids for classification
```

### 1.3 The 26 Input Features — Complete Specification

All features compare the **canonical input** against a **candidate record** from Redshift:

#### Name Similarity Features (10 features)

| Feature | Formula | What it captures |
|---------|---------|-----------------|
| `similarity_jaccard_1` | Jaccard( chars_1gram(input), chars_1gram(candidate) ) | Character-level overlap — catches typos, extra spaces |
| `similarity_jaccard_2` | Jaccard( chars_2gram(input), chars_2gram(candidate) ) | 2-character bigrams — better for mid-word differences |
| `similarity_jaccard_3` | Jaccard( chars_3gram(input), chars_3gram(candidate) ) | 3-character trigrams — catches transpositions |
| `similarity_jaccard_4` | Jaccard( chars_4gram(input), chars_4gram(candidate) ) | 4-character n-grams — longer structural similarity |
| `similarity_jaccard_word` | Jaccard( words(input), words(candidate) ) | Word-level match — catches word order differences |
| `sim_norm_jac_1` | Overlap coefficient, 1-gram | Normalised version (÷ by smaller set size — better for short names) |
| `sim_norm_jac_2` | Overlap coefficient, 2-gram | |
| `sim_norm_jac_3` | Overlap coefficient, 3-gram | |
| `sim_norm_jac_4` | Overlap coefficient, 4-gram | |
| `sim_norm_jac_word` | Overlap coefficient, word | |

**Jaccard similarity** = |A ∩ B| / |A ∪ B|  
**Overlap coefficient** = |A ∩ B| / min(|A|, |B|)

The overlap coefficient is better for short company names because a short name matching a long name still scores high — whereas Jaccard would penalise the length difference.

#### Address Features (10 features)

| Feature | Formula | What it captures |
|---------|---------|-----------------|
| `match_zipcode` | 1 if postal_code(input) == postal_code(candidate) | Exact postal code match |
| `match_city` | 1 if city(input) == city(candidate) | Exact city match |
| `match_street_number` | 1 if street_number(input) == street_number(candidate) | Exact street number |
| `match_street_block` | 1 if street numbers within same block (±10) | Addresses nearby but not identical |
| `distance_street_number` | abs(street_num_input − street_num_candidate) | Numeric distance for nearby addresses |
| `match_address_line_2` | 1 if suite/unit matches | Exact secondary address |
| `match_short_name` | 1 if derived short names match | Handles abbreviated names |
| `similarity_street_name_1` | Jaccard 1-gram on street names | |
| `similarity_street_name_2` | Jaccard 2-gram on street names | |
| `sim_norm_street_name_1/2` | Overlap coefficient on street names | |

#### Short Name Features (6 features)

| Feature | What it captures |
|---------|-----------------|
| `similarity_short_1/2/3/4` | Jaccard k-gram similarity on derived "short name" (name without city, common words) |
| `sim_norm_short_1/2` | Overlap coefficient on short names |

### 1.4 Training

**Training data:** Labelled pairs from internal Redshift matching history — `(input_company, candidate_record, label)` where label = 1 (same company) or 0 (different company).

**Model:** XGBoost binary classifier trained to output `P(same_company | features)`.

**Model file:** `entity_matching_20250127` — the date suffix indicates this was trained on January 27, 2025 data.

**Threshold:** ≥ 0.80 → MATCHED status. This is a business decision: below 0.80 the model isn't confident enough to trust the vendor's industry code.

### 1.5 Output and How It Is Used

```python
match_confidence = model.predict_proba(features)[:, 1]
# → 0.97 for Apple Inc. in OpenCorporates
# → status = "MATCHED"
# → industry_code_uids = "us_naics-334118|uk_sic-26400"
```

In Worth AI's pipeline, this match confidence becomes:
- The **confidence** value passed to `factWithHighestConfidence()` to decide which source wins
- The **weight multiplier**: `effective_score = source_weight × match_confidence`
  - OpenCorporates: `0.90 × 0.97 = 0.873`
  - Equifax: `0.70 × 0.91 = 0.637`
  - → OpenCorporates wins (highest effective score)

In the Consensus Engine, the match confidence becomes **an input feature** for Model 2 (see Part 3).

### 1.6 What Model 1 Cannot Do

Model 1 is a matching model, not a classification model. Once it finds the right record, it has finished its job. It cannot:

- Choose between different industry codes when sources disagree
- Output a probability for the chosen industry code
- Factor in that 4/5 sources agree (which should increase confidence)
- Detect that Trulioo's 62% match confidence makes it less reliable on this input
- Route to UK SIC instead of NAICS for a GB company
- Flag that this company's code has changed 3 times in recent history
- Detect that the registry label conflicts with the web presence

All of those require a separate model — Model 2.

---

## Part 2 — The Gap: Why Model 1 Alone Is Not Enough

### 2.1 What Worth AI Does After Entity Matching

After Model 1 finds the matching records, Worth AI uses a **deterministic rule** — `factWithHighestConfidence()` — to select the winning industry code:

```
winner = argmax(source.confidence × source.weight)

if top_two_scores differ by < 0.05:
    use weightedFactSelector(fact_level_weight)
```

This rule has fundamental limitations that no rule-based system can overcome:

### 2.2 The 7 Structural Gaps of the Rule

#### Gap 1: No Probability Output

The rule always produces exactly one winner. There is no uncertainty estimate. Whether 5/5 sources agree on the same code or 5/5 give different codes, the output format is identical: one code, no probability. A user receiving NAICS 334118 has no way to know whether the system is 95% confident or 20% confident.

**Why this matters:** In KYB and underwriting, confidence level determines the decision path. High confidence → auto-approve. Low confidence → manual review. Without calibrated probabilities, every classification is treated identically.

#### Gap 2: No Learning From Feedback

When a human reviewer overrides the classification (stored in `rel_business_industry_naics WHERE platform = 'manual'`), the rule ignores this information. Next time the same company is classified, the same potentially wrong code is output again.

**Why this matters:** Worth AI has accumulated manual overrides — ground truth labels from underwriters and compliance teams. This is exactly the training data a model needs to improve. A rule cannot learn. A trained model can be re-fit on this data.

#### Gap 3: No Systematic Conflict Detection

If OpenCorporates says NAICS 722511 (Restaurants) and Equifax says NAICS 551112 (Holding Companies), the rule picks the one with higher `confidence × weight` and outputs it. The conflict is invisible to downstream consumers.

**Why this matters:** Source conflict is itself an AML/KYB signal. A company registered as a restaurant that Equifax classifies as a holding company is worth flagging. The rule treats conflict as a tie-breaking problem, not an alert.

#### Gap 4: Source Confidence Not Aggregated

The rule considers each source independently — it compares them to find a winner. It does not ask: *"Given that 4 out of 5 sources agree, how much more confident should we be?"*

**Why this matters:** Convergent evidence should increase confidence. Divergent evidence should decrease it. The rule applies source weights as fixed scalars — it does not learn that when multiple sources agree, the effective confidence should be higher.

#### Gap 5: No Jurisdiction-Aware Taxonomy Routing

The rule produces US NAICS regardless of jurisdiction. It cannot say: "This company is in GB (jurisdiction_code = 'gb'), so UK SIC 2007 should be the primary output, not NAICS."

**Why this matters:** Even though `jurisdiction_code` exists in Redshift for millions of companies, a rule would need explicit jurisdiction→taxonomy mapping hard-coded for every jurisdiction. With 200+ jurisdiction codes and 6 taxonomy systems, a rule-based approach scales poorly. A trained model encodes this routing as learned feature weights.

#### Gap 6: No Temporal Awareness

The rule has no concept of history. If a company had NAICS 722511 (Restaurants) for 3 years and suddenly has NAICS 551112 (Holding Companies), the rule treats this as a normal classification — the new code wins based on source weights.

**Why this matters:** Rapid industry code changes are a pattern associated with money laundering ("U-Turn fraud") and business structure fraud. A model with a temporal pivot score feature can learn to flag this pattern.

#### Gap 7: No Multi-Taxonomy Output

The rule produces one code from one taxonomy. It cannot output NAICS 334118 AND UK SIC 26400 AND NACE C26 simultaneously. Producing multiple taxonomy outputs is structurally impossible with a single-winner rule.

**Why this matters:** A UK business needs UK SIC for Companies House compliance. A EU business needs NACE for Eurostat reporting. An e-commerce company needs MCC for Visa/Mastercard compliance. All from the same classification event.

---

## Part 3 — Model 2: Classification Consensus XGBoost

### 3.1 The Problem It Solves

After Model 1 has matched each vendor source and pulled their industry codes, Model 2 asks: *"Given all of this information — the match confidences, the codes each vendor returned, whether they agree or conflict, the jurisdiction, the entity type, the historical stability — what is the probability distribution over all possible industry codes?"*

This is a **multi-class probabilistic classification** problem. The input is a 38-feature numeric vector. The output is a softmax probability distribution over all codes in the code map.

### 3.2 Architecture

```python
XGBClassifier(
    objective        = "multi:softprob",   # outputs probability per class
    num_class        = N,                  # total unique codes seen in training
    tree_method      = "hist",             # fast histogram-based tree building
    max_depth        = 5,                  # tree depth — controls complexity
    n_estimators     = 80,                 # number of boosting rounds
    learning_rate    = 0.10,               # shrinkage per round
    subsample        = 0.8,                # row sampling — reduces overfitting
    colsample_bytree = 0.8,                # column sampling per tree
)
```

**`multi:softprob`:** This objective function outputs one probability per class per sample, where all probabilities sum to 1.0. This is the XGBoost equivalent of a neural network's softmax output layer.

**Why XGBoost instead of a neural network?**
- Handles mixed numeric features natively (no normalisation required)
- Works well with small-to-medium training sets (the Consensus Engine starts with synthetic data and improves with real manual overrides)
- Produces calibrated probabilities with `multi:softprob`
- Fast inference — sub-millisecond per prediction
- Interpretable — SHAP values can explain why each prediction was made

### 3.3 The 38-Feature Vector — Complete Specification

The feature vector is computed by `FeatureEngineer.transform(bundle)` where `bundle` contains all vendor signals for one company.

#### Group A — Source Quality Signals (Features 0–11)

These 12 features encode **how reliable each of the 6 vendor signals is** for this specific company:

| Index | Feature | Formula | Interpretation |
|-------|---------|---------|----------------|
| 0 | opencorporates weighted confidence | `OC_weight × OC_match_confidence` | Highest authority source — 0.90 × match quality |
| 1 | equifax weighted confidence | `EFX_weight × EFX_match_confidence` | Batch file staleness reflected in weight 0.70 |
| 2 | trulioo weighted confidence | `TRU_weight × TRU_match_confidence` | Live API, down-weighted at fact level |
| 3 | zoominfo weighted confidence | `ZI_weight × ZI_match_confidence` | Strong US B2B firmographic coverage |
| 4 | liberty_data weighted confidence | `LD_weight × LD_match_confidence` | 4th entity-matching source |
| 5 | ai_semantic weighted confidence | `AI_weight × AI_inference_confidence` | Lowest weight — AI fallback |
| 6 | opencorporates MATCHED flag | 1 if OC match_confidence ≥ 0.80 | Entity confirmed in government registry |
| 7 | equifax MATCHED flag | 1 if EFX match_confidence ≥ 0.80 | Entity confirmed in credit bureau |
| 8 | trulioo MATCHED flag | 1 if TRU match_confidence ≥ 0.80 | |
| 9 | zoominfo MATCHED flag | 1 if ZI match_confidence ≥ 0.80 | |
| 10 | liberty_data MATCHED flag | 1 if LD match_confidence ≥ 0.80 | |
| 11 | ai_semantic MATCHED flag | 1 if AI status = INFERRED | AI never MATCHED — always INFERRED |

**Why these 12 features matter:** The effective weight of each source's code is not just its static source weight (0.90, 0.70…) — it depends on how confident the entity match was. If OpenCorporates only matched at 0.55 confidence (a weak match), its industry code is much less trustworthy than if it matched at 0.97. Features 0–5 encode this. Features 6–11 provide a binary "do we trust this source on this specific company" signal.

#### Group B — Data Quality and Semantic Signals (Features 12–16)

| Index | Feature | Formula | Interpretation |
|-------|---------|---------|----------------|
| 12 | Trulioo Pollution Flag | 1 if Trulioo returned 4-digit SIC in 6-digit jurisdiction | Known Trulioo data quality bug — automatically detected |
| 13 | Web↔Registry Semantic Distance | cosine_distance(embed(registry_label), embed(ai_label)) | High distance → registry filing ≠ actual business → shell company indicator |
| 14 | Temporal Pivot Score | unique_codes / total_snapshots (over 3 quarters) | High → code changed frequently → AML U-Turn fraud signal |
| 15 | Cross-Taxonomy Agreement | fraction of 6 taxonomies mapping to same semantic cluster | High → high classification confidence |
| 16 | Registry vs AI Distance (copy) | Same as feature 13 | Retained for backward compatibility |

**Why feature 13 (Web↔Registry Distance) matters:** If OpenCorporates has `industry_code_uids = "us_naics-551112"` (Holding Companies) but the AI enrichment inferred "restaurant food service" from the company website, the cosine distance between those two labels in the UGO embedding space will be very high (>0.55). This is the semantic discrepancy signal. A Holding Company registered on paper but operating as a restaurant is suspicious — it is one of the most common patterns in KYB fraud. Model 2 can learn to assign lower confidence to the primary code when this distance is high.

**Why feature 14 (Temporal Pivot Score) matters:** A legitimate restaurant that has been NAICS 722511 for 5 years will have pivot_score = 0.0. A company that was NAICS 722511, then changed to NAICS 551112 (Holding), then back to NAICS 541511 (Software) in three consecutive quarters has pivot_score = 1.0 (every snapshot is different). This is a money laundering signal — businesses that frequently change their stated industry may be structuring transactions to avoid sector-based compliance checks.

#### Group C — Entity Type Signals (Features 16–18)

| Index | Feature | Formula | Interpretation |
|-------|---------|---------|----------------|
| 16 | Is Holding entity | 1 if entity_type = "Holding" | Holding companies have different risk profile and taxonomy preference |
| 17 | Is NGO entity | 1 if entity_type = "NGO" | Different sector expectations |
| 18 | Is Partnership entity | 1 if entity_type = "Partnership" | Different legal and tax structure |

**Why entity type matters for classification:** A company registered as a "Holding Company" should almost always classify as NAICS 551112 or UK SIC 6420x. If vendor sources are giving it a restaurant code, that is a mismatch. The model can learn that Holding entity_type + Operating-sector code = high discrepancy → lower confidence + HOLDING_MISMATCH risk signal.

#### Group D — Jurisdiction One-Hot (Features 19–30)

| Index | Feature | Value = 1 when |
|-------|---------|----------------|
| 19 | US (federal) | jurisdiction_code = "us" |
| 20 | US_STATE | `us_mo`, `us_ca`, `us_ny`, `pr`, `us_dc`… |
| 21 | CA (Canada federal) | jurisdiction_code = "ca" |
| 22 | CA_PROV | `ca_bc`, `ca_qc`, `ca_nu`… |
| 23 | EU | `gb`, `de`, `fr`, `it`, `es`, `nl`, `pl`, `gl`… |
| 24 | APAC | `in`, `cn`, `jp`, `sg`, `au`, `hk`, `th`, `mm`… |
| 25 | LATAM | `mx`, `br`, `ar`, `do`, `cw`, `aw`… |
| 26 | MENA | `ae`, `ae_az`, `sa`, `ir`, `tn`, `eg`… |
| 27 | AFRICA | `za`, `ng`, `ke`, `tz`, `ug`, `mu`… |
| 28 | OTHER | All other jurisdictions |
| 29 | Is sub-national | 1 if state/province/emirate level (`us_mo`, `ca_bc`, `ae_az`…) |
| 30 | Is NAICS jurisdiction | 1 if US/CA/AU → NAICS 2022 is the primary taxonomy |

**Why 12 jurisdiction features instead of just country:** A one-hot encoding with 200 separate columns (one per country) would create a sparse, overparameterised feature space for the training data available. Grouping into 10 region buckets captures the taxonomically meaningful distinctions (US→NAICS, EU→NACE, GB specifically→UK SIC, APAC→ISIC) while keeping the feature space manageable. The model learns: when feature 23 (EU) = 1, UK SIC and NACE codes should receive higher probability weight than NAICS codes.

#### Group E — Agreement and Risk Signals (Features 31–37)

| Index | Feature | Formula | Interpretation |
|-------|---------|---------|----------------|
| 31 | Majority code agreement | most_common_code_count / total_sources | High = strong consensus → high model confidence |
| 32 | High-risk NAICS prefix flag | 1 if any source code starts with AML-elevated 4-digit prefix | Direct AML sector signal |
| 33 | Unique code diversity | unique_codes / total_codes | High = sources heavily disagree → low confidence |
| 34 | Registry vs AI distance (copy) | Same as feature 13 | |
| 35 | Average source confidence | mean(all_source_confidences) | Overall data quality indicator |
| 36 | Maximum source confidence | max(all_source_confidences) | Upper bound — best case reliability |
| 37 | Source count | sources_returning_data / 6 | Fewer sources → less reliable |

**Why feature 31 (Majority code agreement) is critical:** If 5 out of 6 sources return the same NAICS code, the model should assign very high probability to that code. If all 6 sources return different codes, the model should assign low probability to every code and ideally flag `LOW_CONSENSUS_PROBABILITY`. This aggregation of source agreement is fundamentally impossible with a rule — a rule picks one winner regardless of how many agree.

**High-risk NAICS prefixes (feature 32):** Certain 4-digit NAICS prefixes are associated with elevated AML/CTF risk:
- `5221/5222/5239` — Banking and financial intermediation
- `5511` — Holding companies
- `4236` — Electronic goods wholesale (dual-use goods risk)
- `9281` — Defense/security

When any vendor returns a code starting with these prefixes, the flag = 1, which feeds directly into the Risk Engine's `HIGH_RISK_SECTOR` signal.

### 3.4 Training Process

```python
# Generate synthetic training data covering all jurisdictions and scenarios
bundles = simulate_training_dataset(n=300)  
# Each bundle = 1 company × 6 vendor signals × all 38 features

X = np.vstack([feature_engineer.transform(b) for b in bundles])  # shape: (300, 38)
y = [majority_code(b) for b in bundles]  # ground truth label per bundle

# Encode labels to contiguous 0..n-1
code_map = list(dict.fromkeys(y))  # ordered unique codes
y_enc = [code_map.index(c) for c in y]

# Train
model.fit(X, y_enc)
```

**In production:** Replace synthetic samples with real manual overrides from `rel_business_industry_naics WHERE platform = 'manual'`. Every time a compliance officer or underwriter corrects a classification, that becomes a training example. The model improves continuously.

### 3.5 Output — What It Produces

```python
probs = model.predict_proba(features)  # shape: (1, n_classes)
# → [0.92, 0.04, 0.02, 0.01, 0.01, ...]

top_5 = argsort(probs)[::-1][:5]
# → [
#     IndustryCode(code="334118", label="Computer Terminal Manufacturing", prob=0.92),
#     IndustryCode(code="541512", label="Computer Systems Design",        prob=0.04),
#     IndustryCode(code="519290", label="Web Portals",                    prob=0.02),
#     IndustryCode(code="551112", label="Offices of Holding Companies",   prob=0.01),
#     IndustryCode(code="423690", label="Electronic Parts Wholesale",     prob=0.01),
#   ]
```

**What the probabilities mean:**
- `0.92` → The model is 92% confident this company is in NAICS 334118. High enough to auto-approve.
- `0.14` → Low confidence — multiple codes are plausible. Flag for manual review.
- The probabilities are **calibrated** — 0.92 means roughly 92% of companies with similar features are correctly classified to this code. This is actionable: you can set approval thresholds.

**Multi-taxonomy output:** The LLM enrichment step then takes the top candidates and cross-maps them across all 6 taxonomies using the UGO FAISS index:

```json
{
  "primary_industry": {
    "taxonomy": "US_NAICS_2022",
    "code": "334118",
    "label": "Computer Terminal Manufacturing",
    "consensus_probability": 0.92
  },
  "secondary_industries": [
    {"taxonomy": "UK_SIC_2007", "code": "26400", "label": "Manufacture of consumer electronics", "prob": 0.04},
    {"taxonomy": "NACE_REV2",   "code": "C26",   "label": "Manufacture of computer electronic products", "prob": 0.02}
  ]
}
```

### 3.6 What Model 2 Enables That Model 1 Cannot

| Capability | With Model 1 Only | With Model 2 Added |
|-----------|-------------------|-------------------|
| **Classification output** | Single code from highest-confidence source | Top-5 codes with calibrated probabilities |
| **Uncertainty quantification** | Not possible — rule always picks a winner | Low probability = automatic flag for review |
| **Source conflict handling** | Silent tie-breaking | Conflict encoded in features → lower confidence output |
| **Learning from overrides** | Not possible — rule is static | Re-train on manual overrides → continuous improvement |
| **Jurisdiction taxonomy routing** | Not possible — all → NAICS | Features 19–30 encode jurisdiction → correct taxonomy |
| **AML temporal signal** | Not possible | Feature 14 (pivot score) → STRUCTURE_CHANGE risk signal |
| **Shell company detection** | Not possible | Feature 13 (semantic distance) → REGISTRY_DISCREPANCY |
| **Multi-taxonomy output** | Not possible — one code, one taxonomy | Simultaneous output across 6 taxonomy systems |
| **Confidence threshold gating** | Not possible | `prob < 0.40` → LOW_CONSENSUS_PROBABILITY risk signal |
| **AML sector flagging** | Not possible | Feature 32 (high-risk NAICS prefix) → HIGH_RISK_SECTOR signal |

---

## Part 4 — Why the Consensus Engine Needs Both Models

The two models are **complementary, not alternatives**. Removing either one breaks the pipeline:

### Without Model 1 (entity matching):

The system cannot reliably find the right vendor records for a given company. It might match "Apple Inc" to "Apple Bank for Savings" (wrong industry code), or fail to find a match at all. Without a reliable match, the vendor industry codes are meaningless — you cannot trust data from the wrong company.

Model 2 receives match_confidence as a key input (features 0–5, 6–11). If Model 1 doesn't exist, these features are undefined and Model 2 cannot compute its 38-feature vector.

### Without Model 2 (classification consensus):

The system can find the right vendor records but cannot handle disagreements intelligently. If 5 vendors return different NAICS codes, the rule picks one based on static weights — ignoring the distribution of opinions, jurisdiction context, historical stability, and data quality signals.

The result is a single output code with no probability — unusable for risk scoring, threshold-based auto-approval, or multi-taxonomy regulatory compliance.

### Together:

```
Model 1 → "This OC record is Apple Inc with 97% confidence"
         "This Equifax record is Apple Inc with 91% confidence"
         "This ZoomInfo record is Apple Inc with 94% confidence"
                    ↓
                 38 features built from these match confidences
                 + jurisdiction (us)
                 + entity type (Operating)
                 + temporal history (stable, pivot=0.00)
                 + source agreement (4/5 agree on 334118)
                 + semantic distance (low — registry and web agree)
                    ↓
Model 2 → "P(NAICS 334118) = 0.92, P(541512) = 0.04, P(519290) = 0.02…"
         "Primary: UK SIC 26400 for GB, NACE C26 for EU"
         "Risk: LOW. KYB: APPROVE"
```

The two models form a complete two-stage pipeline: **resolve** (Model 1) then **classify with confidence** (Model 2).

---

## Summary

| | Model 1 — Entity Matching | Model 2 — Classification Consensus |
|---|---|---|
| **Purpose** | Find the right vendor record for each company | Classify the company given all vendor evidence |
| **Type** | Binary/probabilistic similarity | Multi-class probabilistic classification |
| **Features** | 26 name+address similarity features | 38 engineered signals (quality, jurisdiction, AML, agreement) |
| **Output** | `match_confidence` 0–1 per source | Probability distribution over all industry codes |
| **In Worth AI** | ✅ Yes | ❌ No (replaced by deterministic rule) |
| **Gap without Model 2** | Cannot handle disagreement, jurisdiction routing, AML signals, probability output | — |
| **Training data** | Labelled (same/different) company pairs | Manual overrides from `rel_business_industry_naics` + synthetic samples |
| **Improves over time** | Yes (re-train on new labelled pairs) | Yes (re-train on compliance officer corrections) |

---

*Sources: `entity_matching/core/matchers/matching_v1.py`, `entity_matching/core/features/feature_generator.py`, `integration-service/lib/facts/businessDetails/index.ts`, new Consensus Engine `consensus_engine.py`*  
*Prepared by Worth AI Engineering · March 2026*
