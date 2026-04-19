# Phases Completed — KYB Confidence Intelligence Platform

All four phases of the Team B blueprint are delivered in this run, plus a shareable static HTML/CSS/JS clickable prototype that lives in the parent workspace and can be deployed directly from the Publish tab.

Two deliverables in one session:

- **A. Full Streamlit Python source tree** — this folder, `kyb_confidence_platform/`.
- **B. Static HTML/CSS/JS prototype of the 9-tab UI** — in the parent workspace (`index.html`, `css/`, `js/`).

All code is fresh. No module, rule, or prompt was copied from `kyb_hub_app.py`, `kyb_hub_app_v2.py`, `check_agent_v2.py`, or `app_pro/`.

---

## Phase 1 — Shell, config, filters, lineage framework

**Delivered**
- `app.py` — top status bar (Redshift + OpenAI chips), global filter bar, 9-tab layout, Share/Export modals, deep-linking via `st.query_params`.
- `config/settings.py` — `st.secrets` → env → defaults loader. No hard-coded credentials.
- `config/lineage_catalog.py` — 4-level lineage registry (L1 business meaning, L2 warehouse, L3 transformation, L4 repo refs).
- `config/metrics_registry.py` — declarative metric definitions.
- `core/filters.py` — global filter bar with 7 filters + custom date window + multiple date contexts.
- `core/state.py` — ensures session state, restores/saves state to URL for deep-linking.
- `core/logger.py` — structured, secret-safe logger.
- `ui/theme.py`, `ui/components/…` — dark theme CSS, KPI cards, chart helpers, table helpers, **Trust Layer** buttons (`Ask AI`, `Run Check-Agent`, `View Lineage`) on every object, lineage modal, relationship graph.

## Phase 2 — Data access, SQL safety, entity 360, rule engine

**Delivered**
- `data_access/redshift.py` — read-only `psycopg2` connection, statement_timeout, graceful ping, demo-mode fallback.
- `data_access/sql_safety.py` — `sqlglot`-based SELECT-only validator, rejects DDL/DML/multi-statements/forbidden schemas, auto-injects `LIMIT`.
- `data_access/pii.py` — TIN/EIN/SSN/email/phone masking, DataFrame-level masking.
- `data_access/python_sandbox.py` — whitelisted-import sandbox (pandas/numpy/math/json/statistics/datetime/re/collections/itertools/functools/decimal), no FS/network, CPU time limit.
- `data_access/queries/…` — query templates for portfolio, entity, features, decisions, inconsistency.
- `data_access/fixtures.py` — deterministic demo data used when Redshift is unreachable.
- `analytics/portfolio.py` — portfolio aggregations.
- `investigation/entity.py` — entity-360 context builder.
- `validation/inconsistency.py` — portfolio inconsistency aggregates.
- `ai/check_agent/` — deterministic rule engine with 7 rule families: `identity`, `identifier`, `address_contact`, `registration`, `model_output`, `temporal`, `network`. Fresh rules — not copied from the Team A repo.
- `ai/check_agent/llm_auditor.py` — optional LLM cross-reference pass (skipped when no live key).
- `pages/05_entity_360.py` — Customer / Business 360 with six sub-tabs (Summary, Timeline, Features, Verification, Related Records, Risk & Flags) + a one-click Check-Agent scan.

## Phase 3 — RAG, lineage explorer, repo/catalog

**Delivered**
- `knowledge/metadata_catalog.py` — curated tables, columns, features, glossary.
- `knowledge/rag/indexer.py` — ChromaDB indexer with chunking and `.ipynb` support.
- `knowledge/rag/retriever.py` — graceful retriever (returns empty on missing index).
- `knowledge/rag/sources.py` — source registration.
- `lineage/resolver.py` — feature lineage combining catalog + RAG hits.
- `pages/07_lineage_discovery.py` — 6 sub-tabs: Table Catalog, Column Catalog, Feature Registry, Field Lineage, Repo Explorer, Glossary.
- `scripts/index_knowledge.py` — CLI to build the ChromaDB index from any folder(s).

## Phase 4 — AI Copilot, AI View Generator, Data Explorer, exports, tests

**Delivered**
- `ai/client.py` — OpenAI client with **fake-key offline fallback**. The app stays fully usable without a key.
- `ai/prompts/` — three prompt families: Copilot, View Generator, Check-Agent LLM Auditor. Enforce JSON envelopes and Redshift-SQL safety rules.
- `ai/view_generator/` — full natural-language-to-analysis pipeline: `intent → plan → synthesize SQL (LLM or fallback) → validate with sqlglot → execute on Redshift → render Plotly`.
- `explorer/runners.py` — SQL Runner (safe) + Python Runner (sandboxed), wired into `pages/08_data_explorer.py`.
- `pages/09_ai_copilot.py` — Chat, AI View Generator, Check-Agent Console, Investigation Workspace (war room), Glossary.
- `export/csv_xlsx.py` + `export/pdf_snapshot.py` — CSV / XLSX / JSON / PDF downloads with filter metadata.
- `tests/` — unit tests for SQL safety, PII masking, deterministic Check-Agent rules, and AI View Generator in fake-key mode.

---

## 9-tab ↔ Sub-tab coverage

| # | Tab                           | Sub-tabs implemented |
|---|-------------------------------|----------------------|
| 1 | Executive Overview            | Portfolio Summary · Trend Monitoring · Executive Exceptions |
| 2 | KYB Confidence                | Score Overview · Score Stability (PSI) · Prediction Volume · Model Explainability |
| 3 | Feature Health & DQ           | Feature Completeness · Distribution Monitoring · Data Quality Checks · Source Reliability |
| 4 | Decision & Ops                | Confidence vs Decision · Confidence vs TAT · Manual Review · Operational Exceptions |
| 5 | Customer / Business 360       | Summary · Timeline · Features · Verification · Related Records · Risk & Flags |
| 6 | Inconsistency & Red Flags     | Dashboard · Cross-Reference · Red Flags · Check-Agent Results · Not-Matching Review |
| 7 | Lineage & Discovery           | Table Catalog · Column Catalog · Feature Registry · Field Lineage · Repo Explorer · Glossary |
| 8 | Data Explorer                 | SQL Runner · Python Runner · Dataset Health · Join & Key Validation |
| 9 | AI Copilot & Check-Agent      | Ask the AI · Check-Agent Console · Investigation Workspace · Glossary |

Every important object exposes the **Trust Layer** (Ask AI · Run Check-Agent · View Lineage with 4-level detail).

## Security properties

- No hard-coded secrets.
- Redshift connects **read-only**; `statement_timeout` enforced; all ad-hoc SQL goes through `sqlglot`.
- PII masking applied at the data layer before any row reaches the UI or an LLM.
- Python sandbox with import whitelist, no FS/network, CPU time limit.
- Safe offline behavior: the app is always usable without an OpenAI key.

## Known limitations / next steps

- **Real Redshift schema nuances:** the SQL templates assume the KYB fact-store pattern (`rds_warehouse_public.facts` + JSON `value`). Adjust column names in `data_access/queries/` to match your specific cluster.
- **LLM model selection:** default is `gpt-4o` (chat) and `gpt-4o-mini` (utility). Change in `.env` / `secrets.toml`.
- **RAG embedding:** uses Chroma's built-in embedding. Switch to OpenAI embeddings in `knowledge/rag/indexer.py` if you prefer larger models.
- **Authentication:** intentionally none (local-only deployment).
- **Production deployment:** add a process manager (systemd / Docker) and SSL termination; Streamlit handles the rest.

## How to run

See `RUNNING.md` for the full guide. TL;DR:

```bash
pip install -r requirements.txt
cp .env.example .env     # or edit .streamlit/secrets.toml
streamlit run app.py
```
