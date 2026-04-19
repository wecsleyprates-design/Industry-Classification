# KYB Confidence Intelligence Platform

A production-grade internal web tool for **Know Your Business (KYB)** intelligence: portfolio monitoring, entity-level investigation, validation/red-flag detection, data lineage, and AI-assisted analysis (natural-language → SQL → visualization) backed by Amazon Redshift.

This is a **fresh implementation** built from scratch against the App.pdf specification. It is not a port of any previous `kyb_hub_app.py` / `app_pro.py`. Architecture, rule families, prompts, data-access layer, lineage engine, and UI components are all original.

---

## ✨ What's in here

Three pillars, nine tabs, one trust layer:

| # | Tab | Purpose |
|---|-----|---------|
| 1 | Executive Overview          | Portfolio KPIs, confidence-band mix, trends, executive exceptions |
| 2 | KYB Confidence Monitoring   | Score distributions, PSI stability, prediction volume, explainability |
| 3 | Feature Health & DQ         | Null rates, drift, DQ rules, source reliability |
| 4 | Decision Impact & Operations| Score ↔ outcome, TAT by band, manual review, ops exceptions |
| 5 | Customer / Business 360     | Entity deep-dive: profile, timeline, features, verifications, relationships, red flags |
| 6 | Inconsistency & Red Flags   | Cross-reference checks, red-flag queue, Check-Agent findings, not-matching review |
| 7 | Lineage & Data Discovery    | Table/column catalogs, feature registry, field lineage, repo explorer |
| 8 | Data Explorer               | SQL Runner, Python Runner, dataset health, join validation |
| 9 | AI Copilot & Check-Agent    | Natural-language AI View Generator, Check-Agent console, investigation "war room", glossary |

**Every important object** (KPI card, chart, table, panel, relationship graph) exposes three trust-layer actions: **Ask AI**, **Run Check-Agent**, and **View Lineage** (with four levels: business meaning, warehouse source, transformation logic, repo/code lineage).

---

## 🧱 Architecture

```
kyb_confidence_platform/
├── app.py                       # Streamlit entry point
├── config/
│   ├── settings.py              # env + st.secrets loader
│   ├── lineage_catalog.py       # L1-L4 lineage metadata for every object
│   └── metrics_registry.py      # metric/KPI definitions
├── core/
│   ├── filters.py               # global filter state, date contexts
│   ├── state.py                 # session-state helpers, deep-linking
│   └── logger.py                # structured logging
├── data_access/
│   ├── redshift.py              # psycopg2 pool, read-only connection
│   ├── sql_safety.py            # sqlglot-based SELECT-only validation
│   ├── pii.py                   # TIN/SSN/EIN masking
│   ├── python_sandbox.py        # restricted Python runner
│   └── queries/                 # query templates per domain
│       ├── portfolio.py
│       ├── entity.py
│       ├── features.py
│       ├── decisions.py
│       └── inconsistency.py
├── knowledge/
│   ├── metadata_catalog.py      # tables, columns, features, glossary
│   └── rag/
│       ├── indexer.py           # ChromaDB indexer over repo / docs
│       ├── retriever.py         # similarity search wrapper
│       └── sources.py           # registered knowledge sources
├── ai/
│   ├── client.py                # OpenAI client with fake-key fallback
│   ├── prompts/                 # system + user prompt templates
│   ├── view_generator/
│   │   ├── intent.py            # NL intent parser
│   │   ├── planner.py           # maps intent → metric/segmentation/filter
│   │   ├── sql_synth.py         # LLM SQL synthesis + sqlglot validation
│   │   ├── render.py            # result → chart spec
│   │   └── pipeline.py          # end-to-end orchestrator
│   └── check_agent/
│       ├── engine.py            # deterministic rule runner
│       ├── llm_auditor.py       # LLM cross-referencing layer
│       ├── taxonomy.py          # severity + action vocabulary
│       └── rules/
│           ├── identity.py
│           ├── identifier.py
│           ├── address_contact.py
│           ├── registration.py
│           ├── model_output.py
│           ├── temporal.py
│           └── network.py
├── analytics/                   # portfolio aggregations
├── investigation/               # entity-360 helpers
├── validation/                  # inconsistency aggregations
├── lineage/                     # field lineage resolution
├── explorer/                    # SQL/Python runner orchestration
├── ui/
│   ├── theme.py                 # dark-theme CSS + config
│   └── components/
│       ├── trust_layer.py       # Ask-AI / Run-CheckAgent / Lineage buttons
│       ├── filters_bar.py
│       ├── kpi_card.py
│       ├── charts.py
│       ├── tables.py
│       ├── lineage_modal.py
│       ├── ask_ai_panel.py
│       ├── check_agent_panel.py
│       └── relationship_graph.py
├── pages/
│   ├── 01_executive_overview.py
│   ├── 02_kyb_confidence.py
│   ├── 03_feature_health.py
│   ├── 04_decision_ops.py
│   ├── 05_entity_360.py
│   ├── 06_inconsistency.py
│   ├── 07_lineage_discovery.py
│   ├── 08_data_explorer.py
│   └── 09_ai_copilot.py
├── export/
│   ├── csv_xlsx.py
│   └── pdf_snapshot.py
├── tests/
│   ├── test_sql_safety.py
│   ├── test_pii.py
│   ├── test_check_agent_rules.py
│   └── test_view_generator.py
├── scripts/
│   ├── index_knowledge.py       # CLI to build the ChromaDB index
│   └── verify_redshift.py       # connectivity probe
├── .streamlit/
│   └── config.toml              # dark theme + server settings
├── .env.example
├── .gitignore
├── requirements.txt
├── runtime.txt
├── RUNNING.md                   # full local-run instructions
└── PHASES_COMPLETED.md          # delivery summary (all phases)
```

---

## 🚀 Quick start

```bash
# 1. Python 3.11 recommended
python -m venv .venv && source .venv/bin/activate

# 2. Install
pip install -r requirements.txt

# 3. Configure secrets (copy and edit)
cp .env.example .env
# or put values in .streamlit/secrets.toml

# 4. (Optional) Build the knowledge/RAG index — only needed for AI Copilot / View Gen
python scripts/index_knowledge.py --source /path/to/your/internal/repo

# 5. Run
streamlit run app.py
```

Open <http://localhost:8501>. No auth required.

If `OPENAI_API_KEY` is unset or starts with `sk-FAKE`, the app falls back to deterministic offline responses for Copilot / View Generator / LLM auditor — everything else (Redshift queries, deterministic Check-Agent rules, lineage, dashboards) keeps working.

See **`RUNNING.md`** for the full setup guide (VPN, Redshift, OpenAI, environment, troubleshooting).

---

## 🔐 Security

- No hard-coded credentials. Secrets are read from `st.secrets` first, then `os.environ`.
- Redshift connects with a **read-only** user. All SQL from the AI View Generator and the SQL Runner is parsed with `sqlglot` and **rejected** if it is not a pure `SELECT` (no DDL/DML, no multi-statement, no `COPY`, etc.). A `LIMIT` is enforced automatically and `statement_timeout` caps runtime.
- PII fields (TIN, EIN, SSN, DOB) are **masked** at the data-access layer before any value reaches the UI or an LLM prompt.
- The Python Runner is sandboxed: a whitelist of modules (`pandas`, `numpy`, `math`, `statistics`, `json`, `datetime`), no filesystem / network, CPU-time limit, memory limit.

---

## 🧪 Data model & storage

- **Primary warehouse:** Amazon Redshift (read-only user). Canonical fact store: `rds_warehouse_public.facts(business_id, name, value, received_at)` where `value` is a VARCHAR JSON. Pipeline B winners in `datascience.customer_files`. Scores in `rds_manual_score_public.business_scores`.
- **Vector store:** local **ChromaDB** (`./.chroma/`) for RAG over repo / docs / SQL / YAML / notebooks.
- **App state:** Streamlit session state + URL query params (for deep-linking). No database is written by the app itself.

---

## 🔗 Deep links

Every filter, tab, sub-tab, and selected entity is encoded into the URL (`?tab=&sub=&dr=&dc=&c=&b=&entity=`). Click **Share** in the top bar to copy a deep link. Loading the URL reconstructs the full state.

---

## 📦 Exports

- CSV / XLSX of any table
- PDF snapshot of a tab
- JSON export including the filter state and lineage metadata

---

## 🧩 Extending

- **New metric:** add to `config/metrics_registry.py` + expose via `analytics/` — lineage entries go in `config/lineage_catalog.py`.
- **New check rule:** drop a module in `ai/check_agent/rules/` implementing the rule interface (`check(context) -> list[Finding]`).
- **New knowledge source for RAG:** register in `knowledge/rag/sources.py`, then `python scripts/index_knowledge.py`.

---

## 📍 Status

See `PHASES_COMPLETED.md`.
