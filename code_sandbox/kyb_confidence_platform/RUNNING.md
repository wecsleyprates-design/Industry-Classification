# Running the KYB Confidence Platform locally

## 0. Prerequisites

- Python **3.11** (3.10+ works; 3.12 is fine)
- `pip`
- A VPN / network route to your Redshift cluster (read-only)
- Optional: an OpenAI API key for AI Copilot + AI View Generator

## 1. Clone & install

```bash
git clone <your-repo-url>
cd kyb_confidence_platform
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 2. Create your local secrets file (stops the "No secrets found" banner)

```bash
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# then edit .streamlit/secrets.toml with your values (leave blank for demo mode)
```

The app works with **all fields left blank** — it runs on fixture data (`DEMO_MODE=true`).  
The banner disappears as soon as the file exists, even with empty values.

## 3. Configure secrets (optional — for live Redshift / OpenAI)

Two equivalent options — the app reads from **`st.secrets` first**, then falls back to **environment variables**.

### Option A — `.streamlit/secrets.toml` (recommended)

```toml
# kyb_confidence_platform/.streamlit/secrets.toml
OPENAI_API_KEY    = "sk-..."               # or "sk-FAKE" to use offline fallback

REDSHIFT_HOST     = "your-cluster.redshift-serverless.amazonaws.com"
REDSHIFT_PORT     = 5439
REDSHIFT_DB       = "dev"
REDSHIFT_USER     = "readonly_all_access"
REDSHIFT_PASSWORD = "..."

OPENAI_MODEL_CHAT  = "gpt-4o"
OPENAI_MODEL_MINI  = "gpt-4o-mini"
STATEMENT_TIMEOUT_MS = 30000
DEFAULT_QUERY_LIMIT  = 5000
PII_MASKING = true
```

### Option B — `.env`

```bash
cp .env.example .env
# edit values
# and run with:
export $(grep -v '^#' .env | xargs)
```

## 3. (Optional) Build the RAG knowledge index

The AI Copilot and AI View Generator use a ChromaDB knowledge index over your internal repos / SQL / dbt / YAML / notebooks.

```bash
python scripts/index_knowledge.py --source /absolute/path/to/your/repo
```

This builds `./.chroma/` locally. Add more sources:

```bash
python scripts/index_knowledge.py \
  --source /path/to/dbt_project \
  --source /path/to/api-docs
```

Without a built index the app still runs — the Copilot will return deterministic fallback answers and flag that the knowledge layer is not available.

## 4. Verify connections

```bash
python scripts/verify_redshift.py
```

This runs a harmless `SELECT 1` and prints the result plus table counts in the target schemas.

## 5. Run

```bash
streamlit run app.py
```

Open <http://localhost:8501>.

The top-right status chips show:

- `Redshift: OK | error` — with click-through details
- `OpenAI: live | fake-key fallback | missing`

## 6. No-key / offline mode

Leave `OPENAI_API_KEY` unset (or set it to anything starting with `sk-FAKE`) to run the app entirely without LLM calls:

- Copilot answers are deterministic placeholders
- AI View Generator returns a templated SQL + mock chart
- LLM Auditor in Check-Agent is skipped (deterministic rules still run)

Everything else — Redshift access, all 9 tabs, lineage modal, SQL Runner, Python sandbox, deterministic Check-Agent rules — works unchanged.

## 7. Deep linking

Every tab, sub-tab, filter, and selected entity is serialized into the URL. Use the **Share** button in the top bar to copy a link that restores the full state.

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ModuleNotFoundError: chromadb` | `pip install -r requirements.txt` |
| `psycopg2.OperationalError: could not translate host name` | Connect to VPN; check `REDSHIFT_HOST` |
| `403 / 401` from OpenAI | Invalid key; set `OPENAI_API_KEY=sk-FAKE` to use offline fallback |
| `ValueError: Only SELECT statements are allowed` | SQL Runner rejected DDL/DML — correct. Re-write as `SELECT` |
| Port 8501 already in use | `streamlit run app.py --server.port 8510` |
| Charts blank | Hard-refresh browser (Cmd/Ctrl+Shift+R) |
| Knowledge index missing | `python scripts/index_knowledge.py --source <repo>` |

## 9. Tests

```bash
pytest -q
```

Covers: SQL safety parser, PII masking, deterministic Check-Agent rules, AI View Generator pipeline (fake-key mode).
