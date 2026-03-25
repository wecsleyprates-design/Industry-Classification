# Technical Briefing: Industry Classification — Current State vs. New Consensus Engine

**Audience:** Engineering team and management  
**Purpose:** Compare the existing Worth AI pipeline with the new Global Industry Classification Consensus Engine — covering architecture, data sources, inputs, outputs, modelling approach, and what was improved.

---

## Executive Summary

The existing Worth AI pipeline classifies companies using a **single industry taxonomy (NAICS)**, fed by a **single primary source (OpenCorporates via Redshift)**, processed by a **rule-based LLM prompt** with no statistical confidence model. This approach works for straightforward US companies but fails silently on international entities, returns no risk signals, has no mechanism to detect data quality issues from vendors, and produces a single code with no probability attached.

The new **Global Industry Classification Consensus Engine** replaces this with a **three-level stacking ensemble** that aggregates signals from **six simulated vendor sources**, applies **38-feature engineering**, runs an **XGBoost probabilistic classifier**, and enriches results with **OpenAI GPT-4o-mini** — producing a structured output that includes multiple taxonomy codes, confidence probabilities, and nine categories of AML/KYB risk signals. It covers **200+ jurisdictions worldwide** and **six international taxonomy systems**.

---

## Part 1 — The Current Worth AI Pipeline

### 1.1 How It Works Today

The current pipeline follows a linear, single-pass pattern:

```
Company Name + Address
        ↓
OpenCorporates (Redshift internal table)
        ↓
Raw NAICS code retrieved
        ↓
LLM Prompt (Groq / LLaMA 3.1) — "pick the best NAICS from these candidates"
        ↓
Single NAICS code returned
```

### 1.2 Data Sources — Current

| Source | Type | What it provides | Internal or External |
|--------|------|-----------------|----------------------|
| **OpenCorporates** (via Redshift) | Internal data warehouse | Company registry filing data — legal name, registered address, SIC/NAICS code on file | **Internal** — pre-ingested into Redshift, not a live API call |
| **DuckDuckGo Search** | External API | Web search snippets about the company for context | **External** — live API call per company |
| **Groq / LLaMA 3.1** | External API | LLM reasoning to pick the best NAICS code from candidates | **External** — live API call per company |
| **NAICS code table** (`naics_code.xlsx`) | Internal static file | List of NAICS codes and descriptions for candidate matching | **Internal** — static Excel file |

### 1.3 Inputs — Current

| Input field | Required | Notes |
|-------------|----------|-------|
| Company Name (`Org Name`) | Yes | Cleaned with 9 basic English suffixes (LLC, Inc, Ltd, Corp, Company, Co, Holdings, Group) |
| Address | Yes | Used in web search query only |
| Country | No | Used in web search query only — not used for taxonomy routing |

**What is NOT accepted as input:**
- Sub-national jurisdiction codes (`us_mo`, `ca_bc`, `ae_az`)
- Company website / domain
- Existing vendor codes from other sources
- Historical classification data

### 1.4 Processing — Current

**Step 1 — Name cleaning:**  
Strip 9 hard-coded English suffixes. No recognition of international legal forms (GmbH, SAS, Pty Ltd, KK, Ltda, etc.).

**Step 2 — Web search:**  
DuckDuckGo query using cleaned name + address + country. First 1,500 characters of results used.

**Step 3 — NAICS candidate filtering:**  
Word overlap scoring between the web summary and NAICS descriptions. Top 30 candidates returned. This is a bag-of-words keyword match, not semantic search.

**Step 4 — LLM prompt:**  
Single prompt to LLaMA 3.1 (via Groq API): "Here are 30 NAICS candidates, here is the company summary, pick one." Returns JSON with one code.

**Step 5 — Output:**  
Single NAICS code + description + confidence string (`HIGH / MEDIUM / LOW`) — confidence is self-reported by the LLM, not computed from data.

### 1.5 Outputs — Current

```json
{
  "naics_code": "722511",
  "description": "Full-Service Restaurants",
  "confidence": "HIGH",
  "reasoning": "The company operates restaurants..."
}
```

| Output field | Present | Notes |
|-------------|---------|-------|
| NAICS 2022 code | ✅ | Single code only |
| UK SIC 2007 code | ❌ | Not produced |
| NACE Rev.2 code | ❌ | Not produced |
| ISIC Rev.4 code | ❌ | Not produced |
| MCC code | ❌ | Not produced |
| Probability score | ❌ | Confidence is a text string from the LLM |
| Risk signals | ❌ | None |
| Source lineage | ❌ | No record of which source contributed what |
| Jurisdiction detection | ❌ | Country field passed to search but not interpreted |
| Entity type | ❌ | Not classified |
| Shell company detection | ❌ | Not present |
| AML/KYB flags | ❌ | Not present |

### 1.6 Known Issues — Current Pipeline

| Issue | Impact |
|-------|--------|
| **NAICS-only output** | UK, EU, APAC companies get a US taxonomy applied to them — meaningless for regulatory purposes |
| **No international suffix recognition** | "Volkswagen AG" → name cleaning fails, "GmbH" remains in the cleaned name, poisoning the web search |
| **9 suffixes only** | Misses GmbH, SAS, Pty Ltd, BV, NV, KK, Ltda, Srl, OOO, and 90+ others |
| **Word overlap candidate filtering** | "restaurant" matches NAICS codes about equipment repair if the word appears in a description — not semantic |
| **LLM self-reported confidence** | "HIGH" from the LLM means nothing statistically — it is the model's opinion, not a calibrated probability |
| **No source validation** | If OpenCorporates has a wrong code, it is passed directly to the LLM with no cross-check |
| **No data quality detection** | Trulioo is known to return 4-digit SIC codes for jurisdictions that use 5–6 digit taxonomies — this is never detected |
| **No temporal awareness** | If a company changed industry codes 3 times in 12 months (a money laundering signal), this is invisible |
| **No risk output** | Holding company registered as "Investment Management" but web presence shows "Electronics Wholesaling" — not flagged |
| **Single point of failure** | If Groq API is down, or if OpenCorporates has no record, output is null |
| **No jurisdiction routing** | A UK company and a US company go through exactly the same NAICS pipeline — UK SIC 2007 is never consulted |

### 1.7 Model Used — Current

| Aspect | Current |
|--------|---------|
| Model type | LLM zero-shot classification (LLaMA 3.1 8B via Groq) |
| Training | None — the LLM uses general pre-training knowledge |
| Features used | Web search text + NAICS descriptions (text only) |
| Output type | Single label (text) |
| Probability calibration | None |
| Retraining mechanism | None |
| Fallback | Returns `null` with confidence `LOW` |

---

## Part 2 — The New Global Industry Classification Consensus Engine

### 2.1 Architecture Overview

The new system implements a **three-level stacking ensemble** — the same pattern used by top-tier KYB providers (LexisNexis, Refinitiv, LSEG):

```
INPUT: Company Name + Address + Country / Jurisdiction Code
                ↓
        ┌───────────────────────────────┐
        │   Entity Resolver              │
        │   100+ global legal suffixes   │
        │   200+ jurisdiction codes      │
        │   → clean name, jur_code,      │
        │     entity type, ISO-2, label  │
        └───────────────┬───────────────┘
                        ↓
        ┌───────────────────────────────────────────────┐
        │   LEVEL 0 — Signal Layer (6 vendor sources)   │
        │                                               │
        │   OpenCorporates  → registry filing code      │
        │   Equifax         → commercial bureau code    │
        │   Trulioo         → global KYC/KYB code       │
        │   ZoomInfo        → B2B intelligence code     │
        │   Dun & Bradstreet→ DUNS code                 │
        │   AI Semantic     → web + NLP inferred code   │
        │                                               │
        │   Each source returns: raw_code, taxonomy,    │
        │   label, weight, status, confidence           │
        └───────────────┬───────────────────────────────┘
                        ↓
        ┌───────────────────────────────────────────────┐
        │   LEVEL 1 — Feature Engineering (38 features) │
        │                                               │
        │   6 × weighted source confidence scores       │
        │   6 × source status flags (MATCHED/POLLUTED)  │
        │   Trulioo Pollution Flag                      │
        │   Web-to-Registry Semantic Distance           │
        │   Temporal Pivot Score (3-snapshot history)   │
        │   Cross-Taxonomy Agreement score              │
        │   3 × entity type flags                       │
        │   10 × jurisdiction region one-hot vector     │
        │   2 × jurisdiction meta flags                 │
        │   4 × aggregate code agreement stats          │
        └───────────────┬───────────────────────────────┘
                        ↓
        ┌───────────────────────────────────────────────┐
        │   LEVEL 2 — XGBoost Consensus Layer           │
        │                                               │
        │   Multi-class softprob (2,000 training        │
        │   synthetic samples, 200 trees, depth 6)      │
        │   → Top-5 codes with probabilities            │
        └───────────────┬───────────────────────────────┘
                        ↓
        ┌───────────────────────────────────────────────┐
        │   LLM Enrichment — OpenAI GPT-4o-mini         │
        │   JSON mode, UGO candidate retrieval           │
        │   → Multi-taxonomy codes + reasoning          │
        └───────────────┬───────────────────────────────┘
                        ↓
        ┌───────────────────────────────────────────────┐
        │   Risk Engine — AML/KYB Signal Detection      │
        │   9 signal types, severity scoring            │
        │   → Risk score 0–1, KYB recommendation        │
        └───────────────┬───────────────────────────────┘
                        ↓
        STRUCTURED JSON OUTPUT (see Part 2.5)
```

### 2.2 Data Sources — New Engine

| Source | Type | What it provides | Internal or External | Notes |
|--------|------|-----------------|----------------------|-------|
| **OpenCorporates** | Simulated (production: internal Redshift) | Registry filing data — legal name, registered code, jurisdiction | **Internal** in production | Same as current but with quality scoring |
| **Equifax** | Simulated (production: external API) | Commercial credit bureau classification | **External** API | New — not in current pipeline |
| **Trulioo** | Simulated (production: external API) | Global KYC/KYB identity + classification data | **External** API | New — not in current pipeline. Pollution detection added |
| **ZoomInfo** | Simulated (production: external API) | B2B company intelligence, self-reported industry | **External** API | New — not in current pipeline |
| **Dun & Bradstreet** | Simulated (production: external API) | DUNS number + industry classification | **External** API | New — not in current pipeline |
| **AI Semantic** | Internal (our own pipeline) | Web scrape + NLP enrichment via GPT-4o-mini + DuckDuckGo | **Internal** (uses external APIs) | Enhanced version of current approach |
| **Unified Global Ontology (UGO)** | Internal static index | FAISS vector index of 2,330 codes × 6 taxonomies | **Internal** | New — replaces keyword matching |
| **Taxonomy CSVs** | Internal static files | NAICS 2022, UK SIC 2007, NACE Rev.2, ISIC Rev.4, US SIC 1987, MCC | **Internal** | Expanded from 1 to 6 taxonomies |
| **Jurisdiction Registry** | Internal static module | 200+ OpenCorporates jurisdiction codes with metadata | **Internal** | New — did not exist |
| **OpenAI GPT-4o-mini** | External API | Structured multi-taxonomy reasoning, entity profiling | **External** | Replaces Groq/LLaMA 3.1 |
| **DuckDuckGo Search** | External API | Web intelligence for AI Semantic enrichment | **External** | Same as current |

### 2.3 Inputs — New Engine

| Input field | Required | Format accepted | Notes |
|-------------|----------|----------------|-------|
| Company Name | Yes | Any text | Cleaned with 100+ global suffixes |
| Address | No | Any text | Used in entity resolution + web search |
| Country / Jurisdiction | No | ISO-2, full name, OR OpenCorporates code (`us_mo`, `ca_bc`, `ae_az`, `gg`, `je`, `pr`, `tz`…) | Auto-routed to correct taxonomy |
| Website / Domain | No | URL or domain | Used in AI Semantic enrichment |
| Custom Web Summary | No | Free text | Bypasses web search if provided |
| Existing vendor codes | No (batch) | CSV/Excel columns | Can be ingested as pre-existing signals |

**What can now be accepted that previously could not:**
- `us_mo` → Missouri (US state, NAICS)
- `ca_bc` → British Columbia (Canadian province, NAICS)
- `ae_az` → Abu Dhabi (UAE emirate, ISIC Rev.4)
- `gg` → Guernsey (Crown dependency, UK SIC 2007)
- `je` → Jersey (Crown dependency, UK SIC 2007)
- `tz` → Tanzania (ISIC Rev.4)
- `th` → Thailand (ISIC Rev.4)
- Full country names, city names, state names in any language (auto-resolved)

### 2.4 Feature Engineering — New Engine (38 Features)

The 38-feature vector is the core innovation that makes XGBoost classification possible. Each feature encodes a specific signal:

| # | Feature | What it measures | Why it matters |
|---|---------|-----------------|----------------|
| 0–5 | Per-source weighted confidence | Confidence × reliability weight for each of 6 sources | Higher-reliability sources count more |
| 6–11 | Source status flags | Is each source's code MATCHED, POLLUTED, or CONFLICT? | Polluted/conflicted sources are down-weighted |
| 12 | Trulioo Pollution Flag | Did Trulioo return a 4-digit SIC for a 6-digit jurisdiction? | Known Trulioo data quality issue — auto-detected |
| 13 | Web-to-Registry Semantic Distance | Cosine distance between web-inferred label and registry label | Large distance = potential shell company or misregistration |
| 14 | Temporal Pivot Score | Rate of industry code change across 3 historical snapshots | Rapid changes = business pivot or U-Turn fraud signal |
| 15 | Cross-Taxonomy Agreement | How many of 6 taxonomies agree on the same semantic cluster | High agreement = high confidence |
| 16 | Holding entity flag | Is entity type "Holding"? | Holding companies have elevated AML risk |
| 17 | NGO entity flag | Is entity type "NGO"? | Different risk profile than operating companies |
| 18 | Partnership entity flag | Is entity type "Partnership"? | Different legal obligations |
| 19–28 | Jurisdiction one-hot (10 buckets) | US / US_STATE / CA / CA_PROV / EU / APAC / LATAM / MENA / AFRICA / OTHER | Taxonomy routing, regional risk calibration |
| 29 | Is sub-national | State/province/emirate level? | Sub-national jurisdictions have specific regulatory rules |
| 30 | Is NAICS jurisdiction | Should NAICS be the primary taxonomy? | Ensures correct taxonomy is prioritised |
| 31 | Majority code agreement | What fraction of sources agree on the same code? | Low agreement = high uncertainty |
| 32 | High-risk NAICS prefix | Is any source code in a known AML-risk sector? | Direct AML signal |
| 33 | Unique code diversity | How many different codes did sources return? | High diversity = ambiguous entity |
| 34 | Registry vs AI distance | Semantic gap between official registry and AI inference | Shell company / misregistration indicator |
| 35 | Average source confidence | Mean confidence across all sources | Overall data quality indicator |
| 36 | Maximum source confidence | Best single-source confidence | Upper bound on classification reliability |
| 37 | Source count | How many sources returned data? | Fewer sources = less reliable |

**Comparison with current pipeline features:**

| Feature category | Current | New |
|-----------------|---------|-----|
| Source confidence signals | 0 | 12 (6 weighted + 6 status flags) |
| Data quality detection | 0 | 3 (Trulioo pollution, semantic distance, diversity) |
| Temporal / historical signals | 0 | 1 (pivot score) |
| Entity type signals | 0 | 3 (holding, NGO, partnership) |
| Jurisdiction signals | 0 | 12 (10-bucket one-hot + 2 meta flags) |
| Agreement signals | 0 | 3 (cross-taxonomy, majority, diversity) |
| Risk signals | 0 | 2 (high-risk prefix, registry distance) |
| **Total features** | **0** (LLM text prompt) | **38** |

### 2.5 Outputs — New Engine

```json
{
  "business_id": "sim-00977436",
  "consensus_output": {
    "company_name": "Worth AI",
    "jurisdiction": "us",
    "entity_type": "Operating",
    "primary_industry": {
      "taxonomy": "US_NAICS_2022",
      "code": "541511",
      "label": "Custom Computer Programming Services",
      "consensus_probability": 0.7821
    },
    "secondary_industries": [
      {
        "taxonomy": "US_NAICS_2022",
        "code": "541512",
        "label": "Computer Systems Design Services",
        "consensus_probability": 0.1043
      },
      {
        "taxonomy": "UK_SIC_2007",
        "code": "62012",
        "label": "Business and domestic software development",
        "consensus_probability": 0.0612
      }
    ],
    "risk_signals": [
      {
        "flag": "SOURCE_CONFLICT",
        "severity": "MEDIUM",
        "description": "3/6 sources disagree on primary classification.",
        "score": 0.10,
        "evidence": {"conflict_ratio": 0.5}
      }
    ],
    "source_lineage": {
      "opencorporates": {"value": "us_naics_2022-541511", "weight": 0.90, "status": "MATCHED"},
      "equifax":        {"value": "us_naics_2022-541512", "weight": 0.75, "status": "MATCHED"},
      "trulioo":        {"value": "us_sic_1987-7372",     "weight": 0.70, "status": "POLLUTED"},
      "zoominfo":       {"value": "us_naics_2022-518210", "weight": 0.80, "status": "CONFLICT"},
      "duns":           {"value": "us_naics_2022-541511", "weight": 0.85, "status": "MATCHED"},
      "ai_semantic":    {"value": "us_naics_2022-541512", "weight": 0.80, "status": "INFERRED"}
    },
    "feature_debug": {
      "trulioo_polluted": true,
      "web_registry_distance": 0.12,
      "temporal_pivot_score": 0.33,
      "cross_taxonomy_agreement": 0.67,
      "jurisdiction_code": "us",
      "jurisdiction_label": "United States",
      "region_bucket": "US",
      "is_naics_jurisdiction": true,
      "majority_code_agreement": 0.50,
      "avg_source_confidence": 0.79
    }
  },
  "risk_profile": {
    "overall_risk_score": 0.15,
    "overall_risk_level": "LOW",
    "kyb_recommendation": "APPROVE",
    "signals": [...]
  }
}
```

**Full output comparison:**

| Output field | Current | New |
|-------------|---------|-----|
| Primary industry code | ✅ NAICS only | ✅ Any of 6 taxonomies |
| Secondary industry codes | ❌ | ✅ Up to 4 additional codes |
| UK SIC 2007 | ❌ | ✅ Auto-selected for GB |
| NACE Rev.2 | ❌ | ✅ Auto-selected for EU |
| ISIC Rev.4 | ❌ | ✅ Auto-selected for APAC/LATAM/MENA/Africa |
| MCC code | ❌ | ✅ Always included |
| Probability score | ❌ text only | ✅ Calibrated float 0–1 |
| Source lineage | ❌ | ✅ All 6 sources with weight + status |
| Risk signals | ❌ | ✅ 9 signal types with severity + score |
| Overall risk score | ❌ | ✅ 0–1 aggregate |
| KYB recommendation | ❌ | ✅ APPROVE / REVIEW / ESCALATE / REJECT |
| Entity type | ❌ | ✅ Operating / Holding / NGO / Partnership / Trust |
| Jurisdiction label | ❌ | ✅ Full label + sovereign ISO-2 + bucket |
| Feature debug | ❌ | ✅ All 38 features explained |

### 2.6 Risk Signals — New Engine

The Risk Engine produces structured AML/KYB signals that the current pipeline has no equivalent for:

| Signal | Severity | What it detects |
|--------|----------|----------------|
| `REGISTRY_DISCREPANCY` | HIGH | Registry filing says one industry but web presence shows another — shell company indicator |
| `SHELL_COMPANY_SIGNAL` | HIGH | Holding company registered + operating sector web presence — classic U-Turn fraud pattern |
| `HIGH_RISK_SECTOR` | HIGH | Primary code is in a known AML/CTF-elevated sector (finance, electronics wholesale, holding companies) |
| `STRUCTURE_CHANGE` | HIGH | Industry code changed in every historical snapshot — money laundering pivot signal |
| `SOURCE_CONFLICT` | HIGH/MEDIUM | ≥60% of sources disagree on primary code — data quality or ambiguous entity |
| `TEMPORAL_PIVOT` | MEDIUM | Code changed 2+ times in 12 months — monitor for business pivot fraud |
| `TRULIOO_POLLUTION` | LOW | Trulioo returned 4-digit SIC for 5/6-digit jurisdiction — data quality degradation |
| `HYBRID_ENTITY_DETECTED` | LOW | Significant activity across 2+ unrelated sectors — may be conglomerate or misclassified |
| `LOW_CONSENSUS_PROBABILITY` | MEDIUM | Model confidence < 40% — insufficient data for reliable classification |

### 2.7 The Model — Comparison

| Aspect | Current (LLaMA 3.1 via Groq) | New (XGBoost + GPT-4o-mini) |
|--------|------------------------------|------------------------------|
| **Model type** | Zero-shot LLM classification | 3-level stacking ensemble (XGBoost + LLM) |
| **Training data** | None — uses LLM pre-training | 2,000 synthetic multi-vendor samples |
| **Input representation** | Raw text (web summary + NAICS list) | 38 engineered numeric features |
| **Candidate retrieval** | Keyword word-overlap (bag of words) | FAISS cosine similarity (semantic embeddings) |
| **Output** | Single label (text) | Top-5 codes with calibrated probabilities |
| **Confidence** | Self-reported text string (HIGH/MEDIUM/LOW) | Calibrated softmax probability (0.0–1.0) |
| **Taxonomy support** | NAICS 2022 only | 6 taxonomies (NAICS, UK SIC, NACE, ISIC, SIC, MCC) |
| **Jurisdiction handling** | None | 200+ codes, auto-taxonomy routing |
| **Multi-source fusion** | None (single source) | Weighted voting across 6 sources |
| **Data quality detection** | None | Trulioo pollution, source conflict, semantic distance |
| **Risk output** | None | 9 AML/KYB signal types |
| **Retraining** | Not possible | Re-run `fit_synthetic()` on new ground-truth data |
| **Fallback** | Returns null | Falls back through model → LLM → UGO semantic search |
| **LLM** | LLaMA 3.1 8B (Groq) | GPT-4o-mini (OpenAI) — JSON mode, structured output |
| **Semantic search** | None | FAISS IndexFlatIP on 2,330-code UGO |

---

## Part 3 — What Is Lost vs. What Is Gained

### What is dropped / deprecated

| Item | Why |
|------|-----|
| `langchain_groq` dependency | Replaced by `openai` SDK directly |
| `naics_code.xlsx` static file | Replaced by structured CSV files in `data/` |
| 9-suffix name cleaner | Replaced by 100+ global suffix registry |
| Bag-of-words candidate scoring | Replaced by FAISS semantic search |
| LLM self-reported confidence string | Replaced by XGBoost softmax probability |
| Single-taxonomy output | Replaced by 6-taxonomy output |

### What is gained

| Capability | Business value |
|-----------|---------------|
| **UK SIC 2007 output** | Regulatory compliance for UK entities — Companies House, FCA, ONS reporting |
| **NACE Rev.2 output** | EU regulatory compliance — EBA, ESMA, GDPR sector classification |
| **ISIC Rev.4 output** | UN/World Bank compatible classification for global entities |
| **MCC output** | Payment network compliance — Visa/Mastercard merchant categorisation |
| **AML/KYB risk signals** | Automated red flags for compliance teams — reduces manual review burden |
| **Shell company detection** | Registry vs. web discrepancy analysis — fraud prevention |
| **Temporal pivot detection** | Historical code change analysis — money laundering signal |
| **Calibrated probabilities** | Enables downstream risk scoring, portfolio analytics |
| **Source lineage** | Full audit trail — which vendor said what, with what weight |
| **200+ jurisdiction support** | Global KYB coverage — US states, Canadian provinces, UAE emirates, all countries |
| **Trulioo pollution detection** | Automated data quality gate — prevents bad codes from influencing decisions |
| **Jurisdiction-aware dropdown** | Correct taxonomy shown per country — UX and compliance accuracy |

---

## Part 4 — Deployment & Integration

### Current deployment
- Script-based, run locally or via Streamlit
- No persistent storage of results
- No API endpoint

### New deployment
- Streamlit multi-page app (5 pages)
- Deployable to Streamlit Community Cloud (free, public HTTPS URL)
- All taxonomy data is CSV-driven — taxonomy updates require no code change
- XGBoost model can be retrained on real ground-truth data (manual overrides) by re-running `fit_synthetic()`
- API-ready: all components are Python classes that can be wrapped in FastAPI/Flask

### How to run

```bash
git clone git@github.com:wecsleyprates-design/Industry-Classification.git
cd Industry-Classification/AI-Powered-NAICS-Industry-Classification-Agent
pip3 install -r requirements.txt
echo "OPENAI_API_KEY=sk-..." > .env
python3 -m streamlit run app.py
```

---

## Part 5 — Recommended Next Steps

| Priority | Action | Effort |
|----------|--------|--------|
| **P0** | Replace vendor simulation with real API calls (Trulioo, Equifax, ZoomInfo live endpoints) | Medium — each vendor has a client SDK |
| **P0** | Wire OpenCorporates Redshift table as the real `opencorporates` signal | Low — already in Redshift, replace the simulator's `_call_opencorporates` |
| **P1** | Collect ground-truth manual overrides to retrain XGBoost on real data | Ongoing — quality improves with each override |
| **P1** | Extend Jurisdiction Registry with company-specific regulatory rules (e.g. FCA-regulated sectors in GB) | Medium |
| **P2** | Build a FastAPI wrapper to expose the pipeline as an internal REST API | Low — Python classes are already structured for this |
| **P2** | Add GLEIF (Legal Entity Identifier) as a 7th source signal | Medium |
| **P3** | Implement Source Reliability Weight (SRW) training — learn which vendor is most accurate per jurisdiction from override history | High — requires labelled historical data |

---

## Appendix — Taxonomy Reference

| Taxonomy | Full name | Authority | Jurisdictions | Codes |
|----------|-----------|-----------|---------------|-------|
| **NAICS 2022** | North American Industry Classification System | US Census Bureau | US, Canada, Mexico, Australia, NZ | 1,033 |
| **UK SIC 2007** | UK Standard Industrial Classification | Companies House / ONS | United Kingdom, Guernsey, Jersey | 386 |
| **NACE Rev.2** | Statistical Classification of Economic Activities in the EU | Eurostat | All EU/EEA member states | 88 |
| **ISIC Rev.4** | International Standard Industrial Classification | United Nations | All other countries | 439 |
| **US SIC 1987** | Standard Industrial Classification | SEC / US Government | United States (legacy) | 79 |
| **MCC** | Merchant Category Codes | Visa / Mastercard | Global — payment processing | 305 |
| **Total** | | | | **2,330** |

---

*Document prepared by: AI Classification Agent — Worth AI Engineering*  
*Last updated: March 2026*
