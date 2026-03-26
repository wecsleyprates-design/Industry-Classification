"""
Central configuration for the Global Industry Classification Consensus Engine.
All tuneable parameters, API keys, source weights, and feature flags live here.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# ── OpenAI ───────────────────────────────────────────────────────────────────
# Priority order:
#   1. Streamlit Community Cloud secrets (st.secrets)
#   2. Environment variable / .env file
def _get_openai_key() -> str:
    try:
        import streamlit as st
        return st.secrets.get("OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
    except Exception:
        return os.getenv("OPENAI_API_KEY", "")

OPENAI_API_KEY: str = _get_openai_key()
OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
OPENAI_EMBED_MODEL: str = "text-embedding-3-small"  # 1536-dim, cost-efficient

# ── Local sentence-transformer fallback (no API cost) ────────────────────────
LOCAL_EMBED_MODEL: str = "all-MiniLM-L6-v2"

# ── Taxonomy data files (bundled in data/ folder) ────────────────────────────
DATA_DIR: str = os.path.join(os.path.dirname(__file__), "data")

TAXONOMY_FILES = {
    "US_NAICS_2022": "naics_2022.csv",
    "US_SIC_1987":   "us_sic_1987.csv",
    "UK_SIC_2007":   "uk_sic_2007.csv",
    "NACE_REV2":     "nace_rev2.csv",
    "ISIC_REV4":     "isic_rev4.csv",
    "MCC":           "mcc_codes.csv",
}

# ── Source reliability weights (default; dynamically overridden by SRW) ──────
SOURCE_WEIGHTS = {
    "opencorporates": 0.90,
    "equifax":        0.75,
    "zoominfo":       0.80,
    "trulioo":        0.70,
    "duns":           0.85,
    "ai_semantic":    0.80,
    "web_scrape":     0.65,
    "user_provided":  1.00,
}

# ── XGBoost consensus model ───────────────────────────────────────────────────
XGBOOST_MODEL_PATH: str = os.path.join(DATA_DIR, "consensus_model.ubj")
N_SYNTHETIC_TRAINING_SAMPLES: int = 300    # minimal — fast cold-start on Streamlit Cloud
CONSENSUS_TOP_K: int = 5            # top-K codes returned in output

# ── FAISS / UGO ───────────────────────────────────────────────────────────────
FAISS_INDEX_PATH: str = os.path.join(DATA_DIR, "ugo_faiss.index")
FAISS_META_PATH:  str = os.path.join(DATA_DIR, "ugo_meta.pkl")
UGO_TOP_K: int = 8                  # candidates retrieved per taxonomy

# ── Risk / AML thresholds ────────────────────────────────────────────────────
SEMANTIC_DISCREPANCY_HIGH_THRESHOLD: float = 0.55   # cosine distance
SEMANTIC_DISCREPANCY_MEDIUM_THRESHOLD: float = 0.30
PIVOT_SCORE_HIGH_THRESHOLD: float = 0.70            # rate-of-change score
HIGH_RISK_NAICS_PREFIXES = [                        # dual-use / high-risk sectors
    "4244",  # Grocery & related product merchant wholesalers
    "4248",  # Beer, wine, distilled beverage
    "4249",  # Misc nondurable goods — chemicals
    "4234",  # Professional & commercial equipment
    "4236",  # Electrical & electronic goods
    "5221",  # Depository credit intermediation
    "5222",  # Nondepository credit
    "5229",  # Other finance
    "5239",  # Other financial investment
    "5242",  # Insurance agencies / brokerages
    "5511",  # Holding companies
    "5239",  # Commodity contracts
    "9281",  # Defense
]

HIGH_RISK_SIC_CODES = [
    "6020", "6022", "6099",  # Banks / finance
    "6726",                   # Investment offices
    "5065",                   # Electronic parts wholesale
    "5040",                   # Professional equipment wholesale
]

# ── Web search ────────────────────────────────────────────────────────────────
WEB_SEARCH_MAX_CHARS: int = 2_000
WEB_SEARCH_ENABLED: bool = True
DDGS_REGION: str = "wt-wt"         # worldwide

# ── Entity resolution ─────────────────────────────────────────────────────────
FUZZY_MATCH_THRESHOLD: int = 85    # rapidfuzz score 0–100
