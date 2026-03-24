#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# run.sh — start the Global Industry Classification Consensus Engine
# ──────────────────────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# ── 1. Check Python ────────────────────────────────────────────────────────────
PYTHON=$(command -v python3 || command -v python)
if [ -z "$PYTHON" ]; then
  echo "ERROR: Python 3 not found. Install Python 3.10+ and try again."
  exit 1
fi
echo "Using Python: $($PYTHON --version)"

# ── 2. Install / verify dependencies ──────────────────────────────────────────
if ! $PYTHON -c "import streamlit" 2>/dev/null; then
  echo "Installing dependencies..."
  $PYTHON -m pip install -q -r requirements.txt
else
  echo "Dependencies already installed."
fi

# ── 3. Load .env if it exists ─────────────────────────────────────────────────
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | xargs)
  echo ".env loaded."
fi

# ── 4. Validate API key ────────────────────────────────────────────────────────
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
  echo ""
  echo "ERROR: OPENAI_API_KEY is not set."
  echo "  Edit the .env file in this directory and set:"
  echo "    OPENAI_API_KEY=sk-..."
  echo ""
  exit 1
fi
echo "OpenAI API key detected."

# ── 5. Pre-warm the UGO index (optional, speeds up first load in Streamlit) ───
echo ""
echo "Pre-warming Unified Global Ontology index..."
$PYTHON -c "
import sys; sys.path.insert(0, '.')
from taxonomy_engine import TaxonomyEngine
te = TaxonomyEngine()
print(f'UGO ready: {te.record_count} taxonomy records')
" 2>&1 | grep -v "^INFO\|^WARN\|Batches\|Loading\|httpx\|hugging"

# ── 6. Launch Streamlit ────────────────────────────────────────────────────────
echo ""
echo "Starting Global Industry Classification Engine..."
echo "Open your browser at: http://localhost:8501"
echo "Press Ctrl+C to stop."
echo ""

$PYTHON -m streamlit run app.py \
  --server.port=8501 \
  --server.headless=true \
  --browser.gatherUsageStats=false
