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
    # ZoomInfo NAICS source: comp_standard_global is the raw ZI table with zi_c_naics6.
    # zoominfo_standard_ml_2 only has normalized name/address columns for Levenshtein
    # matching — it does NOT contain NAICS codes.
    # smb_zi_oc_efx_ver_combined.sql pulls zi_c_naics6 directly from comp_standard_global.
    zi_source       = "zoominfo.comp_standard_global",
    # equifax_us_latest has NAICS/SIC columns (efx_primnaicscode, efx_secnaics1-4, efx_primsic).
    # equifax_us_standardized only has normalized name/address for Levenshtein matching — no NAICS.
    # The warehouse pipeline (smb_zi_oc_efx_ver_combined.sql line 587) uses equifax_us_latest.
    efx_source      = "warehouse.equifax_us_latest",
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
    # ── ZoomInfo primary NAICS ────────────────────────────────────────────
    "zi_naics6",              # ZI primary 6-digit NAICS (label-encoded)
    "zi_naics4",              # ZI 4-digit NAICS group
    "zi_naics2",              # ZI 2-digit sector
    "zi_naics_confidence",    # ZI internal NAICS confidence score (0-1)
    "zi_sic4",                # ZI primary 4-digit SIC

    # ── ZoomInfo top-3 NAICS candidates (NEW) ────────────────────────────
    # ZI returns its top-3 most likely NAICS codes (pipe-delimited).
    # These capture ZI's internal uncertainty about the classification.
    # If all 3 agree on the same 2-digit sector → high sector confidence.
    # If they span different sectors → ZI itself is uncertain.
    "zi_naics_top3_1",        # ZI top-3 candidate #1 (label-encoded, same as zi_naics6)
    "zi_naics_top3_2",        # ZI top-3 candidate #2
    "zi_naics_top3_3",        # ZI top-3 candidate #3
    "zi_top3_sector_spread",  # Count of distinct 2-digit sectors in top-3 (1=certain, 3=uncertain)
    "zi_sic_top3_1",          # ZI top-3 SIC candidate #1
    "zi_sic_top3_2",          # ZI top-3 SIC candidate #2

    # ── Equifax primary NAICS + SIC ───────────────────────────────────────
    "efx_naics_primary",      # EFX primary NAICS (6-digit, encoded)
    "efx_naics_sector",       # EFX 2-digit sector
    "efx_sic_primary",        # EFX primary SIC (4-digit)

    # ── Equifax secondary NAICS codes (NEW) ──────────────────────────────
    # EFX stores up to 4 secondary NAICS codes in addition to primary.
    # These are EFX's alternative classifications — analogous to ZI's top-3.
    # Checking if EFX's secondary codes match ZI's primary recovers agreement
    # that the current model misses entirely.
    "efx_naics_secondary_1",  # EFX secondary NAICS #1 (encoded)
    "efx_naics_secondary_2",  # EFX secondary NAICS #2
    "efx_naics_secondary_3",  # EFX secondary NAICS #3
    "efx_naics_secondary_4",  # EFX secondary NAICS #4
    "efx_sic_secondary_1",    # EFX secondary SIC #1
    "efx_sic_secondary_2",    # EFX secondary SIC #2

    # ── OpenCorporates NAICS ──────────────────────────────────────────────
    "oc_naics_primary",       # OC parsed primary US NAICS from industry_code_uids
    "oc_naics_sector",        # OC 2-digit sector

    # ── Cross-source agreement (primary codes) ───────────────────────────
    "naics2_agreement",       # Count of sources agreeing on 2-digit sector (0-4)
    "naics4_agreement",       # Count of sources agreeing on 4-digit group
    "naics6_agreement",       # Count of sources agreeing on exact 6-digit code
    "zi_efx_naics_match",     # 1 if ZI and EFX primary sectors match
    "zi_oc_naics_match",      # 1 if ZI and OC primary sectors match
    "efx_oc_naics_match",     # 1 if EFX and OC primary sectors match

    # ── Cross-source agreement using top-3/secondary (NEW) ───────────────
    # Recovers agreement that primary-only comparison misses:
    # e.g. EFX primary differs from ZI primary but matches ZI top-3 candidate #2
    "efx_matches_zi_top3",    # 1 if EFX primary NAICS sector appears in ZI's top-3
    "zi_matches_efx_secondary",# 1 if ZI primary NAICS sector appears in EFX secondary codes
    "sic_cross_source_agree", # 1 if ZI sic4 sector == EFX primsic sector

    # ── SIC-based sector agreement (NEW) ─────────────────────────────────
    # SIC codes are a bridge: ZI and EFX may have different NAICS but same SIC.
    # If SIC agrees on sector → implied NAICS sector agreement.
    "zi_efx_sic_match",       # 1 if ZI sic4 matches EFX primsic (same 4-digit)
    "zi_efx_sic_sector_match",# 1 if ZI sic2 matches EFX sic2 (same sector)

    # ── Entity-matching confidence (XGBoost Level 1 outputs) ─────────────
    "zi_match_confidence",
    "efx_match_confidence",
    "oc_match_confidence",

    # ── Business name tokens ──────────────────────────────────────────────
    "name_token_hash_1",
    "name_token_hash_2",
    "name_token_hash_3",
    "name_len_words",
    "name_has_llc",
    "name_has_restaurant",
    "name_has_salon",
    "name_has_construction",
    "name_has_tech",
    "name_has_medical",

    # ── Jurisdiction ──────────────────────────────────────────────────────
    "state_encoded",
    "country_encoded",
    "is_us_business",

    # ── AI enrichment metadata ────────────────────────────────────────────
    "ai_confidence_high",
    "ai_confidence_med",
    "ai_confidence_low",
    "ai_naics_is_fallback",
    "ai_mcc_is_fallback",
    "ai_has_website",
    "ai_naics_sector",

    # ── Source availability ───────────────────────────────────────────────
    "has_zi_match",
    "has_efx_match",
    "has_oc_match",

    # ── Firmographic (log-scaled) ─────────────────────────────────────────
    "efx_employee_count_log",
    "efx_annual_sales_log",
    "zi_employee_count_log",
    "zi_revenue_log",
]

# Columns used to build the NAICS label
NAICS_LABEL_COL = "label_naics6"
MCC_LABEL_COL   = "label_mcc"
BUSINESS_ID_COL = "business_id"
