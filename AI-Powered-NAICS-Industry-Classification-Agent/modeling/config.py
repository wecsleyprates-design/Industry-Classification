"""
modeling/config.py
==================
Single source of truth for all connection parameters, feature definitions,
table names, and thresholds used across the modeling pipeline.

Reads credentials from environment variables / .env file.
Never hard-codes secrets.
"""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Project paths ─────────────────────────────────────────────────────────────
ROOT_DIR    = Path(__file__).parent.parent
MODELING_DIR = ROOT_DIR / "modeling"
ARTIFACTS_DIR = ROOT_DIR / "data" / "modeling"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Redshift connection (Worth AI data warehouse) ─────────────────────────────
REDSHIFT = dict(
    host     = os.getenv("REDSHIFT_HOST",
                "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87"
                ".808338307022.us-east-1.redshift-serverless.amazonaws.com"),
    port     = int(os.getenv("REDSHIFT_PORT", "5439")),
    dbname   = os.getenv("REDSHIFT_DB", "dev"),
    user     = os.getenv("REDSHIFT_USER", "readonly_all_access"),
    password = os.getenv("REDSHIFT_PASSWORD", ""),
    connect_timeout = 8,
)

# ── Case-service PostgreSQL (analyst labels) ──────────────────────────────────
CASESERVICE_PG = dict(
    host     = os.getenv("CASESERVICE_DB_HOST", ""),
    port     = int(os.getenv("CASESERVICE_DB_PORT", "5432")),
    dbname   = os.getenv("CASESERVICE_DB_NAME", "caseservice"),
    user     = os.getenv("CASESERVICE_DB_USER", ""),
    password = os.getenv("CASESERVICE_DB_PASSWORD", ""),
    connect_timeout = 8,
)

# ── Redshift table / schema references ───────────────────────────────────────
# Verified against SIC-UK-Codes warehouse-service SQL files
TABLES = dict(
    customer_files          = "datascience.customer_files",
    efx_matches             = "datascience.efx_matches_custom_inc_ml",
    oc_matches              = "datascience.oc_matches_custom_inc_ml",
    zi_matches              = "datascience.zoominfo_matches_custom_inc_ml",
    oc_source               = "datascience.open_corporates_standard_ml_2",
    efx_source              = "warehouse.equifax_us_standardized",
    zi_source               = "datascience.zoominfo_standard_ml_2",
    liberty_einmst_1        = "liberty.einmst_20260218",
    liberty_einmst_2        = "liberty.einmst_15_5mn",
    liberty_einmst_3        = "liberty.einmst_5_3m_remaining",
    global_trulioo_us_kyb   = "datascience.global_trulioo_us_kyb",
)

# ── Case-service PostgreSQL table references ──────────────────────────────────
PG_TABLES = dict(
    rel_business_industry_naics = "public.rel_business_industry_naics",
    core_naics_code             = "public.core_naics_code",
    data_businesses             = "public.data_businesses",
)

# ── Artifact file names ───────────────────────────────────────────────────────
ARTIFACTS = dict(
    training_dataset    = ARTIFACTS_DIR / "training_dataset.parquet",
    feature_matrix      = ARTIFACTS_DIR / "feature_matrix.parquet",
    level2_model        = ARTIFACTS_DIR / "consensus_model.ubj",
    label_encoder       = ARTIFACTS_DIR / "label_encoder.pkl",
    feature_config      = ARTIFACTS_DIR / "feature_config.json",
    evaluation_report   = ARTIFACTS_DIR / "evaluation_report.json",
    comparison_report   = ARTIFACTS_DIR / "comparison_report.parquet",
)

# ── Modeling hyperparameters ──────────────────────────────────────────────────
LEVEL2_XGB_PARAMS = dict(
    objective         = "multi:softprob",
    tree_method       = "hist",
    max_depth         = 6,
    n_estimators      = 500,
    learning_rate     = 0.05,
    subsample         = 0.8,
    colsample_bytree  = 0.8,
    min_child_weight  = 3,
    n_jobs            = -1,
    verbosity         = 0,
    random_state      = 42,
)

TRAIN_TEST_SPLIT = 0.20
MIN_SAMPLES_PER_CLASS = 2   # classes with fewer samples are dropped before training
MATCH_CONFIDENCE_THRESHOLD = 0.80   # matches below this are treated as "not found"

# ── Source reliability weights (from SOURCE_WEIGHTS in config.py) ─────────────
SOURCE_WEIGHTS = dict(
    oc      = 0.90,
    efx     = 0.70,
    tru     = 0.80,
    zi      = 0.80,
    liberty = 0.78,
    ai      = 0.70,
)

# ── High-risk NAICS prefixes (AML/CTF elevated sectors) ──────────────────────
HIGH_RISK_NAICS_PREFIXES = {"5511", "5221", "5222", "5239", "4236", "9281"}

# ── Level 2 feature column names (in exact order fed to XGBoost) ─────────────
# Group A — match confidence scores (outputs of Level 1)
FEATURES_CONFIDENCE = [
    "oc_confidence", "efx_confidence", "zi_confidence",
    "liberty_confidence", "tru_confidence", "ai_confidence",
]
# Group B — binary match flags (confidence >= threshold)
FEATURES_MATCH_FLAGS = [
    "oc_matched", "efx_matched", "zi_matched",
    "liberty_matched", "tru_matched", "ai_matched",
]
# Group C — industry code agreement signals
FEATURES_CODE_SIGNALS = [
    "tru_pollution_flag",
    "web_registry_distance",
    "temporal_pivot_score",
    "cross_taxonomy_agreement",
    "source_majority_agreement",
    "source_code_diversity",
]
# Group D — jurisdiction one-hot flags (from OC jurisdiction_code)
FEATURES_JURISDICTION = [
    "j_us", "j_us_state", "j_ca", "j_ca_province",
    "j_eu", "j_apac", "j_latam", "j_mena", "j_afr", "j_other",
    "is_subnational", "is_naics_jurisdiction",
]
# Group E — entity type flags
FEATURES_ENTITY_TYPE = ["is_holding", "is_ngo", "is_partnership"]
# Group F — aggregate quality signals
FEATURES_AGGREGATE = [
    "hi_risk_sector", "avg_confidence", "max_confidence", "sources_above_threshold",
]

ALL_FEATURES: list[str] = (
    FEATURES_CONFIDENCE
    + FEATURES_MATCH_FLAGS
    + FEATURES_CODE_SIGNALS
    + FEATURES_JURISDICTION
    + FEATURES_ENTITY_TYPE
    + FEATURES_AGGREGATE
)

LABEL_COLUMN = "label_naics"

# ── Synthetic data config ─────────────────────────────────────────────────────
SYNTHETIC_N_ROWS     = 5_000   # rows to generate when Redshift is unavailable
SYNTHETIC_RANDOM_SEED = 42
