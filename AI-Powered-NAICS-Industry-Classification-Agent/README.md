# Global Industry Classification Consensus Engine

An enterprise-grade AI system for **global multi-taxonomy industry classification**, **entity resolution**, **probabilistic risk underwriting**, and **AML/KYB signal detection**.

---

## Architecture

```
Input (Company Name + Metadata)
         │
         ▼
 ┌─────────────────┐
 │ Entity Resolver │  ← 100+ global legal-entity suffixes
 │                 │    jurisdiction detection, entity type
 └────────┬────────┘
          │
          ▼
 ┌──────────────────────────────────┐
 │  Level 0 — Signal Layer          │
 │  Vendor Simulation / API Calls   │
 │  • OpenCorporates (registry)     │
 │  • Equifax (commercial bureau)   │
 │  • Trulioo (global KYC/KYB)      │
 │  • ZoomInfo (B2B intelligence)   │
 │  • Dun & Bradstreet (DUNS)       │
 │  • AI Semantic (web + NLP)       │
 └──────────────┬───────────────────┘
                │
                ▼
 ┌──────────────────────────────────┐
 │  Level 1 — Feature Engineering  │
 │  • Source Reliability Weight     │
 │  • Trulioo Pollution Flag        │
 │  • Web-to-Registry Distance      │
 │  • Temporal Pivot Score          │
 │  • Cross-Taxonomy Agreement      │
 │  • Entity/Jurisdiction flags     │
 └──────────────┬───────────────────┘
                │
                ▼
 ┌──────────────────────────────────┐
 │  Level 2 — Consensus Layer       │
 │  XGBoost Stacking Ensemble       │
 │  → Top-5 probabilistic output    │
 └──────────────┬───────────────────┘
                │
                ▼
 ┌──────────────────────────────────┐
 │  LLM Enrichment (OpenAI)         │
 │  GPT-4o-mini → multi-taxonomy    │
 │  code selection + reasoning      │
 └──────────────┬───────────────────┘
                │
                ▼
 ┌──────────────────────────────────┐
 │  Risk Engine (AML/KYB)           │
 │  • REGISTRY_DISCREPANCY          │
 │  • SHELL_COMPANY_SIGNAL          │
 │  • HIGH_RISK_SECTOR              │
 │  • STRUCTURE_CHANGE / PIVOT      │
 │  • SOURCE_CONFLICT               │
 │  → Risk Score + KYB Action       │
 └──────────────────────────────────┘
```

---

## Supported Classification Systems

| System | Codes | Scope |
|--------|-------|-------|
| **NAICS 2022** | ~1,200 | North America |
| **US SIC 1987** | ~1,000 | United States |
| **UK SIC 2007** | ~600 | United Kingdom |
| **NACE Rev2** | ~900 | European Union |
| **ISIC Rev4** | ~400 | Global (UN) |
| **MCC** | ~300 | Payment networks (Visa/MC) |

---

## Features

- **Unified Global Ontology (UGO)** — FAISS vector index across all 6 taxonomies; cross-ontology semantic alignment (NAICS ↔ UK SIC ↔ NACE ↔ ISIC ↔ MCC)
- **100+ global legal-entity suffixes** — LLC, GmbH, SAS, Pty Ltd, KK, Ltda, and more
- **Automatic jurisdiction detection** — from company name, address, country, and phone prefix
- **XGBoost Consensus Engine** — trained on synthetic multi-vendor data; Top-K probabilistic output
- **AML/KYB Risk Engine** — 9 risk signal types including shell-company detection and temporal pivot analysis
- **OpenAI GPT-4o-mini** — structured multi-taxonomy reasoning in JSON mode
- **Web intelligence** — DuckDuckGo search integration for real-time company profiling
- **Streamlit UI** — 4 pages: Single Lookup, Batch Classification, Risk Dashboard, Taxonomy Explorer

---

## Output Schema

```json
{
  "business_id": "sim-00012345",
  "consensus_output": {
    "primary_industry": {
      "taxonomy": "UK_SIC_2007",
      "code": "56101",
      "label": "Licensed restaurants",
      "consensus_probability": 0.85
    },
    "secondary_industries": [
      {"taxonomy": "US_NAICS_2022", "code": "722511", "label": "Full-Service Restaurants", "consensus_probability": 0.10}
    ],
    "risk_signals": [
      {
        "flag": "REGISTRY_DISCREPANCY",
        "severity": "HIGH",
        "description": "...",
        "score": 0.30
      }
    ],
    "source_lineage": {
      "opencorporates": {"value": "uk_sic_2007-56101", "weight": 0.90, "status": "MATCHED"},
      "trulioo":        {"value": "us_sic_1987-5812",  "weight": 0.70, "status": "POLLUTED"}
    }
  }
}
```

---

## Project Structure

```
├── app.py                          # Main Streamlit app (4 pages)
├── config.py                       # Central config (API keys, thresholds)
├── entity_resolver.py              # 100+ suffix registry, jurisdiction detection
├── taxonomy_engine.py              # UGO FAISS index across 6 taxonomies
├── data_simulator.py               # Multi-vendor API simulation
├── consensus_engine.py             # XGBoost stacking ensemble
├── risk_engine.py                  # AML/KYB signal detection
├── llm_enrichment.py               # OpenAI GPT-4o-mini enrichment
├── Naics.py                        # Legacy interactive agent (upgraded)
├── Naics_agent_batch.py            # Legacy batch agent (upgraded)
├── Naics_agent_with_confidence.py  # Legacy confidence agent (upgraded)
├── naics_agent_without_rag.py      # Legacy LLM-only agent (upgraded)
├── requirements.txt
├── .env                            # OPENAI_API_KEY
└── data/
    ├── naics_2022.csv
    ├── us_sic_1987.csv
    ├── uk_sic_2007.csv
    ├── nace_rev2.csv
    ├── isic_rev4.csv
    └── mcc_codes.csv
```

---

## Quick Start

```bash
pip install -r requirements.txt
streamlit run app.py
```

Open the Streamlit UI and navigate between:
- **Single Company Lookup** — full pipeline for one company
- **Batch Classification** — upload CSV/Excel
- **Risk Dashboard** — AML/KYB portfolio analysis
- **Taxonomy Explorer** — semantic search across the UGO

---

## Tech Stack

- **Python 3.11+**
- **OpenAI GPT-4o-mini** — classification reasoning
- **XGBoost** — consensus stacking model
- **Sentence Transformers** (`all-MiniLM-L6-v2`) — semantic embeddings
- **FAISS** — vector similarity search
- **LangChain** — tool orchestration
- **DuckDuckGo Search** — web intelligence
- **Streamlit** — UI
- **Pandas / NumPy / scikit-learn** — data processing
