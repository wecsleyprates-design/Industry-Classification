"""
naics_mcc_classifier/config.py
================================
Single source of truth for connection parameters, table names,
fallback codes, and model thresholds.
"""
from __future__ import annotations
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # dotenv optional; fall back to environment variables

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR      = Path(__file__).parent.parent
MODULE_DIR    = Path(__file__).parent
ARTIFACTS_DIR = MODULE_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Redshift connection ───────────────────────────────────────────────────────
# Credentials match the pattern from your working redshift_query() helper.
# Set env vars to override; hardcoded defaults are the known read-only endpoint.
REDSHIFT = dict(
    host     = os.getenv("REDSHIFT_HOST",
                         "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87"
                         ".808338307022.us-east-1.redshift-serverless.amazonaws.com"),
    port     = int(os.getenv("REDSHIFT_PORT", "5439")),
    dbname   = os.getenv("REDSHIFT_DB",       "dev"),
    user     = os.getenv("REDSHIFT_USER",     "readonly_all_access"),
    password = os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
    connect_timeout = 10,
)

# ── Case-service PostgreSQL ───────────────────────────────────────────────────
CASESERVICE_PG = dict(
    host     = os.getenv("CASESERVICE_DB_HOST", ""),
    port     = int(os.getenv("CASESERVICE_DB_PORT", "5432")),
    dbname   = os.getenv("CASESERVICE_DB_NAME", "caseservice"),
    user     = os.getenv("CASESERVICE_DB_USER", ""),
    password = os.getenv("CASESERVICE_DB_PASSWORD", ""),
    connect_timeout = 8,
)

# ── Redshift table names ──────────────────────────────────────────────────────
TABLES = dict(
    # Vendor standardised source tables (pre-loaded bulk)
    zi_source       = "datascience.zoominfo_standard_ml_2",
    efx_source      = "warehouse.equifax_us_standardized",
    oc_source       = "datascience.open_corporates_standard_ml_2",
    liberty_1       = "liberty.einmst_20260218",
    liberty_2       = "liberty.einmst_15_5mn",
    liberty_3       = "liberty.einmst_5_3m_remaining",

    # Entity-matching intermediate tables
    zi_matches      = "datascience.zoominfo_matches_custom_inc_ml",
    efx_matches     = "datascience.efx_matches_custom_inc_ml",
    oc_matches      = "datascience.oc_matches_custom_inc_ml",
    ml_matches      = "datascience.ml_model_matches",

    # Pipeline B winner table
    customer_files  = "datascience.customer_files",

    # Raw AI enrichment outputs stored in warehouse mirror
    facts           = "rds_warehouse_public.facts",

    # Trulioo KYB data
    trulioo_kyb     = "datascience.global_trulioo_us_kyb",
)

# ── Case-service PostgreSQL table names ───────────────────────────────────────
PG_TABLES = dict(
    core_naics      = "public.core_naics_code",
    core_mcc        = "public.core_mcc_code",
    rel_naics_mcc   = "public.rel_naics_mcc",
    data_businesses = "public.data_businesses",
    request_response = "integration_data.request_response",
)

# ── Fallback / last-resort codes ──────────────────────────────────────────────
NAICS_FALLBACK = "561499"   # "All Other Business Support Services"
MCC_FALLBACK   = "5614"     # "Business Services Not Elsewhere Classified"

# These are the codes the current system emits when it truly doesn't know.
# Our model targets replacing these with accurate predictions.

# ── Model thresholds ──────────────────────────────────────────────────────────
# Only override 561499 when model confidence exceeds this threshold.
# Below this we leave the existing code (conservative approach).
NAICS_OVERRIDE_CONFIDENCE_THRESHOLD = 0.55
MCC_OVERRIDE_CONFIDENCE_THRESHOLD   = 0.50

# Minimum number of vendor sources agreeing on a NAICS sector (2-digit)
# for a training row to be considered a "reliable label".
MIN_VENDOR_AGREEMENT = 2

# ── XGBoost hyperparameters ───────────────────────────────────────────────────
NAICS_XGB_PARAMS = dict(
    objective        = "multi:softprob",
    tree_method      = "hist",
    max_depth        = 6,
    learning_rate    = 0.05,
    n_estimators     = 500,
    subsample        = 0.8,
    colsample_bytree = 0.8,
    min_child_weight = 5,
    gamma            = 0.1,
    reg_alpha        = 0.1,
    reg_lambda       = 1.0,
    random_state     = 42,
    n_jobs           = -1,
    eval_metric      = "mlogloss",
    early_stopping_rounds = 30,
)

MCC_XGB_PARAMS = dict(
    objective        = "multi:softprob",
    tree_method      = "hist",
    max_depth        = 5,
    learning_rate    = 0.05,
    n_estimators     = 400,
    subsample        = 0.8,
    colsample_bytree = 0.8,
    min_child_weight = 5,
    gamma            = 0.1,
    reg_alpha        = 0.1,
    reg_lambda       = 1.0,
    random_state     = 42,
    n_jobs           = -1,
    eval_metric      = "mlogloss",
    early_stopping_rounds = 30,
)

# ── Feature groups ────────────────────────────────────────────────────────────
# Exact column names produced by feature_engineering.py
FEATURE_NAMES = [
    # ── Vendor NAICS signals ──────────────────────────────────────────────
    "zi_naics6",            # ZoomInfo 6-digit NAICS (label-encoded)
    "zi_naics4",            # ZoomInfo 4-digit NAICS sector
    "zi_naics2",            # ZoomInfo 2-digit sector
    "zi_naics_confidence",  # ZoomInfo internal NAICS confidence (0-1 or NaN)
    "zi_sic4",              # ZoomInfo 4-digit SIC
    "efx_naics_primary",    # Equifax primary NAICS (6-digit, encoded)
    "efx_naics_sector",     # Equifax 2-digit sector
    "efx_sic_primary",      # Equifax primary SIC (4-digit)
    "efx_naics_secondary_1",# Equifax secondary NAICS 1
    "efx_naics_secondary_2",# Equifax secondary NAICS 2
    "oc_naics_primary",     # OC parsed primary US NAICS from industry_code_uids
    "oc_naics_sector",      # OC 2-digit sector

    # ── Source agreement ──────────────────────────────────────────────────
    "naics2_agreement",     # Count of sources agreeing on 2-digit sector (0-4)
    "naics4_agreement",     # Count of sources agreeing on 4-digit group
    "naics6_agreement",     # Count of sources agreeing on 6-digit code
    "zi_efx_naics_match",   # 1 if ZI and EFX primary NAICS sectors match
    "zi_oc_naics_match",    # 1 if ZI and OC primary NAICS sectors match
    "efx_oc_naics_match",   # 1 if EFX and OC primary NAICS sectors match

    # ── Entity-matching confidence scores (XGBoost outputs) ──────────────
    "zi_match_confidence",  # Entity matching confidence for ZI record
    "efx_match_confidence", # Entity matching confidence for EFX record
    "oc_match_confidence",  # Entity matching confidence for OC record

    # ── Business name tokens (hashed) ─────────────────────────────────────
    "name_token_hash_1",    # MurmurHash of cleaned name token 1
    "name_token_hash_2",    # MurmurHash of cleaned name token 2
    "name_token_hash_3",    # MurmurHash of cleaned name token 3
    "name_len_words",       # Word count in business name
    "name_has_llc",         # Binary: name contains LLC/INC/CORP etc.
    "name_has_restaurant",  # Binary: name contains food/restaurant keywords
    "name_has_salon",       # Binary: name contains salon/spa/beauty
    "name_has_construction",# Binary: name contains construction/contractor
    "name_has_tech",        # Binary: name contains tech/software/systems
    "name_has_medical",     # Binary: name contains medical/health/dental

    # ── Jurisdiction / geography ──────────────────────────────────────────
    "state_encoded",        # US state (label-encoded)
    "country_encoded",      # Country code (label-encoded)
    "is_us_business",       # Binary

    # ── AI enrichment metadata ────────────────────────────────────────────
    "ai_confidence_high",   # 1 if AI returned confidence=HIGH
    "ai_confidence_med",    # 1 if AI returned confidence=MED
    "ai_confidence_low",    # 1 if AI returned confidence=LOW or missing
    "ai_naics_is_fallback", # 1 if current naics_code == 561499
    "ai_mcc_is_fallback",   # 1 if current mcc_code == 5614
    "ai_has_website",       # 1 if website was available for AI enrichment
    "ai_naics_sector",      # AI-suggested NAICS 2-digit sector (0 if fallback)

    # ── Source availability ───────────────────────────────────────────────
    "has_zi_match",         # 1 if ZI entity match found
    "has_efx_match",        # 1 if EFX entity match found
    "has_oc_match",         # 1 if OC entity match found

    # ── EFX firmographic signals ──────────────────────────────────────────
    "efx_employee_count_log",  # log(employee_count + 1)
    "efx_annual_sales_log",    # log(annual_sales + 1)

    # ── ZI firmographic ───────────────────────────────────────────────────
    "zi_employee_count_log",   # log(zi_c_total_employee_count + 1)
    "zi_revenue_log",          # log(zi_c_annual_revenue + 1)
]

# Columns used to build the NAICS label
NAICS_LABEL_COL = "label_naics6"
MCC_LABEL_COL   = "label_mcc"
BUSINESS_ID_COL = "business_id"
