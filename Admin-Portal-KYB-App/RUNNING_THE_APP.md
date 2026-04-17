# 🔬 KYB Intelligence Hub — How to Run the App

## Prerequisites

Make sure you have the following installed on your machine:

- **Python 3.9+** — check with `python3 --version`
- **pip** — check with `pip3 --version`
- **Git** — check with `git --version`
- **VPN** — must be connected to access Redshift

---

## Step 1 — Clone or pull the repository

### First time (clone):
```bash
git clone https://github.com/wecsleyprates-design/Industry-Classification.git
cd Industry-Classification
git checkout cursor/ai-classification-agent-7910
```

### Already cloned (pull latest):
```bash
cd /path/to/Industry-Classification
git pull origin cursor/ai-classification-agent-7910
```

---

## Step 2 — Install dependencies

```bash
pip3 install streamlit pandas plotly psycopg2-binary openai openpyxl
```

Or install everything at once:

```bash
pip3 install -r Admin-Portal-KYB-App/requirements.txt
```

> If `requirements.txt` is missing, run the line above with individual packages.

---

## Step 3 — Set up the OpenAI API key (for AI Agent tab)

Create the Streamlit secrets file:

```bash
mkdir -p Admin-Portal-KYB-App/.streamlit
cat > Admin-Portal-KYB-App/.streamlit/secrets.toml << 'EOF'
OPENAI_API_KEY = "sk-svcacct-your-key-here"
EOF
```

> This file is already in `.gitignore` — it will never be committed.

---

## Step 4 — Connect to VPN

The app connects to **Worth AI's Redshift** cluster on port 5439.  
You **must be on VPN** before running the app, otherwise all data queries will fail.

Check VPN is active, then verify the connection works:

```bash
python3 -c "
import psycopg2, os
conn = psycopg2.connect(
    dbname='dev', user='readonly_all_access',
    password='Y7&.D3!09WvT4/nSqXS2>qbO',
    host='worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com',
    port=5439, connect_timeout=5
)
print('✅ Redshift connected'); conn.close()
"
```

---

## Step 5 — Run the app

```bash
cd /path/to/Industry-Classification
python3 -m streamlit run Admin-Portal-KYB-App/kyb_hub_app.py
```

The app will open automatically in your browser at:
```
http://localhost:8501
```

---

## Running in Cursor terminal (one-liner)

From anywhere on your machine:

```bash
cd ~/Documents/Industry-Classification && git pull origin cursor/ai-classification-agent-7910 && python3 -m streamlit run Admin-Portal-KYB-App/kyb_hub_app.py
```

---

## Stopping the app

Press **`Ctrl + C`** in the terminal where the app is running.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'streamlit'` | Run `pip3 install streamlit` |
| `ModuleNotFoundError: No module named 'psycopg2'` | Run `pip3 install psycopg2-binary` |
| `🔴 Not connected` in the sidebar | Check VPN is active and retry |
| `No businesses found for this period` | Widen the date range or select "All Customers" |
| `OPENAI_API_KEY env var to enable AI` | Add key to `.streamlit/secrets.toml` (Step 3) |
| Port 8501 already in use | Run `streamlit run ... --server.port 8502` |
| App shows blank/white page | Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) |

---

## Key files

```
Industry-Classification/
└── Admin-Portal-KYB-App/
    ├── kyb_hub_app.py          ← Main app (run this)
    ├── .streamlit/
    │   ├── config.toml         ← Streamlit config (dark theme, port, etc.)
    │   └── secrets.toml        ← Your secrets (NOT committed — create manually)
    ├── api-docs/               ← API documentation (OpenAPI specs, md files)
    ├── integration-service-main/  ← Fact Engine source code
    └── RUNNING_THE_APP.md      ← This file
```

---

## Branch

All development is on:
```
cursor/ai-classification-agent-7910
```

Always pull this branch before running to get the latest version.
