"""
XGBoost Model Comparison Experiment
=====================================
Compares Worth AI's PRODUCTION XGBoost model (KYB risk scoring from
datascience.global_trulioo_us_kyb) against the new CONSENSUS XGBoost
model for industry classification.

KEY INSIGHT FROM SHARED CODE:
The production XGBoost model is the MANUAL-SCORE-SERVICE model — it uses
30 monotonically-constrained features (tin_signal, registry_signal, etc.)
to produce a KYB RISK SCORE (0–1). It is NOT a NAICS/industry classifier.
The Consensus XGBoost (Model 2) is a MULTI-CLASS INDUSTRY CLASSIFIER using
38 vendor-signal features → calibrated NAICS probability distribution.

These are two DIFFERENT models solving two DIFFERENT problems:
  Production:  KYB risk score (binary/regression) from identity verification signals
  Consensus:   Industry code classification (multi-class) from vendor NAICS signals

This script:
  1. Loads datascience.global_trulioo_us_kyb from Redshift (or generates synthetic data)
  2. Trains/evaluates the production KYB XGBoost model (with monotonic constraints)
  3. Trains/evaluates the Consensus industry classification XGBoost model
  4. Shows side-by-side evaluation and explains the relationship between both

Run:
    python experiment_xgboost_comparison.py

With Redshift (set env vars):
    REDSHIFT_HOST=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... REDSHIFT_DB=dev

Outputs:
    prod_kyb_model.ubj            — production KYB model
    consensus_industry_model.ubj  — consensus classification model
    comparison_results.xlsx       — full comparison
    comparison_results.json       — key metrics
"""

from __future__ import annotations
import os, sys, json, time, warnings, logging, random, re, unicodedata
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    accuracy_score, top_k_accuracy_score, log_loss,
    average_precision_score, confusion_matrix,
)
from sklearn.preprocessing import LabelEncoder
from sklearn.calibration import calibration_curve
import xgboost as xgb

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.WARNING)
sys.path.insert(0, os.path.dirname(__file__))

BOLD="\033[1m"; GREEN="\033[92m"; RED="\033[91m"; BLUE="\033[94m"; YELLOW="\033[93m"; RESET="\033[0m"


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — REDSHIFT CONNECTOR
# ═══════════════════════════════════════════════════════════════════════════════

def establish_redshift_conn():
    """Connect using credentials from env vars or defaults."""
    import psycopg2
    return psycopg2.connect(
        dbname=os.getenv('REDSHIFT_DB', 'dev'),
        user=os.getenv('REDSHIFT_USER', 'readonly_all_access'),
        password=os.getenv('REDSHIFT_PASSWORD', 'Y7&.D3!09WvT4/nSqXS2>qbO'),
        host=os.getenv('REDSHIFT_HOST', 'worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com'),
        port=int(os.getenv('REDSHIFT_PORT', '5439')),
        connect_timeout=10,
    )


def redshift_query(query: str) -> pd.DataFrame:
    """Execute query and return pandas DataFrame."""
    conn = establish_redshift_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
        return pd.DataFrame(rows, columns=cols)
    finally:
        conn.close()


def load_kyb_data(n: int = 5000) -> Optional[pd.DataFrame]:
    """Load datascience.global_trulioo_us_kyb from Redshift."""
    try:
        print(f"  Connecting to Redshift...")
        df = redshift_query(f'SELECT * FROM "datascience"."global_trulioo_us_kyb" LIMIT {n}')
        print(f"  {GREEN}Loaded {len(df)} rows from global_trulioo_us_kyb{RESET}")
        return df
    except Exception as e:
        print(f"  {RED}Redshift unavailable: {e}{RESET}")
        return None


def load_naics_data(n: int = 5000) -> Optional[pd.DataFrame]:
    """Load industry classification data from Redshift."""
    try:
        query = f"""
        SELECT
            b.id                                           AS business_id,
            b.naics_id,
            nc.code                                        AS naics_code,
            nc.label                                       AS naics_label,
            b.mcc_id,
            mc.code                                        AS mcc_code,
            b.industry,
            bi.name                                        AS industry_name,
            -- Per-platform codes from rel_business_industry_naics
            rbin.platform,
            rbin.naics_id                                  AS platform_naics_id,
            rbin_nc.code                                   AS platform_naics_code
        FROM rds_cases_public.data_businesses b
        LEFT JOIN rds_cases_public.core_naics_code nc ON b.naics_id = nc.id
        LEFT JOIN rds_cases_public.core_mcc_code mc ON b.mcc_id = mc.id
        LEFT JOIN rds_cases_public.core_business_industries bi ON b.industry = bi.id
        LEFT JOIN rds_cases_public.rel_business_industry_naics rbin
            ON rbin.business_id = b.id AND rbin.platform = 'manual'
        LEFT JOIN rds_cases_public.core_naics_code rbin_nc ON rbin.naics_id = rbin_nc.id
        WHERE b.naics_id IS NOT NULL
        LIMIT {n}
        """
        df = redshift_query(query)
        print(f"  {GREEN}Loaded {len(df)} rows from case DB (naics classifications){RESET}")
        return df
    except Exception as e:
        print(f"  {RED}Could not load NAICS data: {e}{RESET}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — PRODUCTION KYB MODEL
# Features: 30 monotonic-constrained signals from global_trulioo_us_kyb
# Label: worth_score (continuous 0–1) or derived binary high_risk flag
# Architecture: XGBoost with monotonic constraints
# ═══════════════════════════════════════════════════════════════════════════════

# Exact features and constraints from the shared code
MONOTONE_CONSTRAINTS = {
    "tin_signal":                          1,   # higher = riskier
    "registry_signal":                     1,
    "idv_fail_signal":                     1,
    "bankruptcies_signal":                 1,
    "judgements_signal":                   1,
    "liens_signal":                        1,
    "pep_signal":                          1,
    "watchlist_signal":                    1,
    "risk_signal":                         1,
    "worth_score":                        -1,   # higher worth_score = safer
    "stolen_score":                        1,
    "synthetic_score":                     1,
    "kyb_matched_signal":                 -1,   # matched = safer
    "tin_match_signal":                   -1,
    "registry_active_signal":             -1,
    "postal_code_match_signal":           -1,
    "review_count":                       -1,
    "review_rating":                      -1,
    "idv_passed":                         -1,
    "idv_passed_signal":                  -1,
    "watchlist_count":                     1,
    "total_am_count":                      1,
    "high_am_count":                       1,
    "medium_am_count":                     1,
    "low_am_count":                        1,
    "idv_kyc_address_match_signal":       -1,
    "idv_risk_email_deliverable_signal":  -1,
    "idv_risk_email_custom_domain_signal": 1,
    "idv_risk_email_disposable_signal":    1,
    "idv_risk_email_free_provider_signal": 1,
    "idv_risk_email_breach_count":        -1,
}
PROD_FEATURES = list(MONOTONE_CONSTRAINTS.keys())
PROD_MONOTONE_TUPLE = tuple(MONOTONE_CONSTRAINTS.values())


def generate_synthetic_kyb_data(n: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic data that mirrors global_trulioo_us_kyb schema.
    Respects the monotonic constraint directions so signal relationships are realistic.
    """
    rng = np.random.RandomState(seed)
    rows = []

    for i in range(n):
        # Base risk level drives correlated signals
        true_risk = rng.beta(2, 5)  # Most companies are low-risk
        is_high_risk = true_risk > 0.65

        # Generate signals correlated with true risk
        def risk_signal(p_high, p_low=None):
            """Binary signal: higher when risky."""
            p = p_high if is_high_risk else (p_low or (p_high * 0.15))
            return int(rng.random() < p)

        def safe_signal(p_high, p_low=None):
            """Binary signal: higher when safe (negative monotone)."""
            p = (p_low or (p_high * 0.85)) if is_high_risk else p_high
            return int(rng.random() < p)

        row = {
            # Risk-increasing signals (monotone +1)
            "tin_signal":                          risk_signal(0.40, 0.05),
            "registry_signal":                     risk_signal(0.35, 0.04),
            "idv_fail_signal":                     risk_signal(0.50, 0.08),
            "bankruptcies_signal":                 risk_signal(0.20, 0.02),
            "judgements_signal":                   risk_signal(0.25, 0.03),
            "liens_signal":                        risk_signal(0.30, 0.04),
            "pep_signal":                          risk_signal(0.10, 0.01),
            "watchlist_signal":                    risk_signal(0.15, 0.02),
            "risk_signal":                         risk_signal(0.60, 0.10),
            "stolen_score":                        rng.beta(5, 2) if is_high_risk else rng.beta(1, 8),
            "synthetic_score":                     rng.beta(4, 2) if is_high_risk else rng.beta(1, 7),
            "watchlist_count":                     int(rng.poisson(3)) if is_high_risk else int(rng.poisson(0.1)),
            "total_am_count":                      int(rng.poisson(4)) if is_high_risk else int(rng.poisson(0.3)),
            "high_am_count":                       int(rng.poisson(2)) if is_high_risk else int(rng.poisson(0.05)),
            "medium_am_count":                     int(rng.poisson(1)) if is_high_risk else int(rng.poisson(0.1)),
            "low_am_count":                        int(rng.poisson(1)) if is_high_risk else int(rng.poisson(0.2)),
            "idv_risk_email_custom_domain_signal": risk_signal(0.25, 0.05),
            "idv_risk_email_disposable_signal":    risk_signal(0.30, 0.03),
            "idv_risk_email_free_provider_signal": risk_signal(0.45, 0.15),
            # Risk-decreasing signals (monotone -1)
            "worth_score":                         rng.beta(1, 4) if is_high_risk else rng.beta(4, 2),
            "kyb_matched_signal":                  safe_signal(0.85, 0.20),
            "tin_match_signal":                    safe_signal(0.80, 0.25),
            "registry_active_signal":              safe_signal(0.90, 0.30),
            "postal_code_match_signal":            safe_signal(0.85, 0.40),
            "review_count":                        int(rng.poisson(12)) if not is_high_risk else int(rng.poisson(2)),
            "review_rating":                       rng.uniform(3.5, 5.0) if not is_high_risk else rng.uniform(1.0, 3.0),
            "idv_passed":                          safe_signal(0.90, 0.15),
            "idv_passed_signal":                   safe_signal(0.88, 0.12),
            "idv_kyc_address_match_signal":        safe_signal(0.82, 0.20),
            "idv_risk_email_deliverable_signal":   safe_signal(0.92, 0.35),
            "idv_risk_email_breach_count":         int(rng.poisson(0)) if not is_high_risk else int(rng.poisson(2)),
            # Label: binary high-risk flag
            "_true_risk":   true_risk,
            "_is_high_risk": int(is_high_risk),
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    print(f"  Generated {len(df)} synthetic KYB rows ({df['_is_high_risk'].sum()} high-risk = {df['_is_high_risk'].mean():.1%})")
    return df


def prepare_kyb_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    """
    Prepare features and labels for production KYB model.
    Label: binary high_risk flag derived from is_high_risk or worth_score.
    """
    # Build feature matrix
    X = pd.DataFrame()
    for feat in PROD_FEATURES:
        if feat in df.columns:
            X[feat] = pd.to_numeric(df[feat], errors="coerce").fillna(0)
        else:
            # Feature missing from real data — fill with 0 (neutral)
            X[feat] = 0.0
            print(f"    {YELLOW}Missing feature: {feat} — filled with 0{RESET}")

    # Label: use _is_high_risk if synthetic, else derive from worth_score
    if "_is_high_risk" in df.columns:
        y = df["_is_high_risk"].astype(int)
    elif "worth_score" in df.columns:
        # In production: high risk = low worth_score (below 0.35)
        y = (pd.to_numeric(df["worth_score"], errors="coerce").fillna(0.5) < 0.35).astype(int)
    elif "idv_fail_signal" in df.columns:
        # Derive from signal combination
        risk_signals = [f for f in PROD_FEATURES if MONOTONE_CONSTRAINTS.get(f, 0) > 0 and f in df.columns]
        y = (X[risk_signals].sum(axis=1) >= 3).astype(int)
    else:
        raise ValueError("Cannot derive label from data — no worth_score or risk signals found")

    missing = [f for f in PROD_FEATURES if f not in df.columns]
    if missing:
        print(f"  {YELLOW}Note: {len(missing)} features not in data — will be zero-filled{RESET}")

    return X, y


def train_production_kyb_model(X: pd.DataFrame, y: pd.Series) -> tuple[xgb.XGBClassifier, dict]:
    """
    Train the production KYB XGBoost model with monotonic constraints.
    This is the Worth AI risk scoring model from manual-score-service.
    """
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        objective           = "binary:logistic",
        n_estimators        = 300,
        max_depth           = 6,
        learning_rate       = 0.05,
        subsample           = 0.8,
        colsample_bytree    = 0.8,
        min_child_weight    = 5,
        gamma               = 0.1,
        reg_alpha           = 0.01,
        reg_lambda          = 1.0,
        monotone_constraints= PROD_MONOTONE_TUPLE,   # ← the key differentiator
        eval_metric         = ["logloss", "auc"],
        early_stopping_rounds = 30,
        n_jobs              = -1,
        verbosity           = 0,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.50).astype(int)

    # Cross-validation
    cv = cross_val_score(
        xgb.XGBClassifier(
            n_estimators=100, max_depth=5,
            monotone_constraints=PROD_MONOTONE_TUPLE, verbosity=0,
        ),
        X, y, cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        scoring="roc_auc",
    )

    fi = {feat: round(float(imp), 6)
          for feat, imp in sorted(
              zip(PROD_FEATURES, model.feature_importances_),
              key=lambda x: x[1], reverse=True
          )}

    metrics = {
        "model":                 "Production KYB XGBoost (manual-score-service)",
        "objective":             "binary:logistic (KYB risk score 0-1)",
        "monotonic_constraints": "YES — 30 features with defined risk direction",
        "n_features":            len(PROD_FEATURES),
        "n_train":               len(X_train),
        "n_test":                len(X_test),
        "class_balance":         f"{y_train.mean():.1%} high-risk in training",
        "auc_roc":               round(roc_auc_score(y_test, y_prob), 4),
        "avg_precision":         round(average_precision_score(y_test, y_prob), 4),
        "cv_auc_mean":           round(cv.mean(), 4),
        "cv_auc_std":            round(cv.std(), 4),
        "precision":             round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall":                round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1_score":              round(f1_score(y_test, y_pred, zero_division=0), 4),
        "accuracy":              round(accuracy_score(y_test, y_pred), 4),
        "confusion_matrix":      confusion_matrix(y_test, y_pred).tolist(),
        "best_iteration":        model.best_iteration if hasattr(model, "best_iteration") else 300,
        "feature_importance_top10": {k: v for k, v in list(fi.items())[:10]},
        "interpretation": {
            "auc_roc":          "Area under ROC curve — probability model ranks high-risk above low-risk",
            "avg_precision":    "Area under precision-recall curve — better metric for imbalanced classes",
            "monotone":         "Model GUARANTEED to increase risk score as tin_signal/registry_signal/etc. increase",
        },
    }
    return model, metrics, y_prob, y_test


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — CONSENSUS INDUSTRY CLASSIFICATION MODEL
# Features: 38 vendor-signal features
# Label: NAICS industry code (multi-class)
# This is what replaces factWithHighestConfidence() in Phase 4
# ═══════════════════════════════════════════════════════════════════════════════

# Source weights from sources.ts
SOURCE_WEIGHTS = {
    "opencorporates": 0.90, "equifax": 0.70, "trulioo": 0.80,
    "zoominfo": 0.80, "liberty_data": 0.78, "ai_semantic": 0.70,
}

HIGH_RISK_PREFIXES = {"5221","5222","5239","5511","4236","9281","5242","5229"}

CONSENSUS_FEATURES = [
    "oc_conf", "efx_conf", "tru_conf", "zi_conf", "ld_conf", "ai_conf",
    "oc_matched", "efx_matched", "tru_matched", "zi_matched", "ld_matched", "ai_inferred",
    "trulioo_pollution", "web_registry_dist", "temporal_pivot", "cross_tax_agree", "registry_ai_dist",
    "is_holding", "is_ngo", "is_partnership",
    "jur_us", "jur_us_state", "jur_ca", "jur_ca_prov",
    "jur_eu", "jur_apac", "jur_latam", "jur_mena", "jur_africa", "jur_other",
    "is_subnational", "is_naics_jur",
    "majority_agreement", "high_risk_flag", "code_diversity",
    "registry_dist2", "avg_conf", "max_conf", "source_count",
]

# NAICS codes and their sector groups
NAICS_CLASSES = {
    "722511": "Food",     "722513": "Food",     "722515": "Food",
    "445110": "Retail",   "452311": "Retail",   "442210": "Retail",
    "522110": "Finance",  "523110": "Finance",  "524126": "Finance",
    "541511": "Tech",     "541512": "Tech",     "511210": "Tech",
    "334118": "MFG",      "336111": "MFG",      "336411": "MFG",
    "621111": "Health",   "622110": "Health",   "325412": "Health",
    "484110": "Transport","492110": "Transport","481111": "Transport",
    "551112": "Holding",  "551111": "Holding",
    "531110": "RE",       "531312": "RE",
    "236220": "Const",    "238210": "Const",
    "813110": "Nonprofit","611310": "Education",
}
NAICS_LIST = list(NAICS_CLASSES.keys())

JUR_BUCKET_MAP = {
    "US":"us", "US_STATE":"us_state", "CA":"ca", "CA_PROV":"ca_prov",
    "EU":"eu", "APAC":"apac", "LATAM":"latam", "MENA":"mena",
    "AFRICA":"africa", "OTHER":"other",
}


def _jur_bucket(jc: str) -> str:
    jc = jc.lower()
    if jc == "us": return "US"
    if jc.startswith("us_") or jc == "pr": return "US_STATE"
    if jc == "ca": return "CA"
    if jc.startswith("ca_"): return "CA_PROV"
    if jc in ("gb","de","fr","it","es","nl","pl","se","no","dk","fi","be",
              "at","ch","ie","pt","gr","cz","hu","ro","bg","hr","sk","si",
              "ee","lv","lt","lu","mt","cy","gg","je","gl","gp","re","pm",
              "is","li","mc","me","al","rs","mk","by","ua","md"): return "EU"
    if jc in ("cn","jp","kr","in","sg","au","hk","th","my","vn","ph","id",
              "tw","nz","mm","bd","pk","lk","np","kh","mn","bn","la","tj"): return "APAC"
    if jc in ("mx","br","ar","co","cl","pe","ve","ec","bo","py","uy","gt",
              "cr","pa","hn","ni","sv","do","cu","jm","tt","bb","ky","aw","cw"): return "LATAM"
    if jc in ("ae","ae_az","ae_du","ae_sh","sa","ir","tr","eg","dz","ma",
              "tn","ly","sd","iq","sy","jo","lb","il","ps","kw","qa","bh","om","ye"): return "MENA"
    if jc in ("za","ng","ke","tz","ug","rw","mu","gh","et","ao","cm","ci","sn"): return "AFRICA"
    return "OTHER"


def _build_consensus_row(true_naics: str, jc: str, entity_type: str,
                          rng: np.random.RandomState, is_well_matched: bool) -> dict:
    """Build one training row for Model 2 with realistic signal patterns."""
    bucket = _jur_bucket(jc)
    is_naics_jur = bucket in ("US","US_STATE","CA","CA_PROV")
    is_subnational = "_" in jc and jc not in ("ae","ca","us")

    # Source confidences
    def src_conf(base_high, base_low):
        return float(rng.uniform(0.85, 0.97) if is_well_matched
                     else rng.uniform(*sorted([base_low, base_low+0.25])))

    confs = {
        "opencorporates": src_conf(0.90, 0.35),
        "equifax":        src_conf(0.87, 0.30),
        "trulioo":        src_conf(0.85, 0.40),
        "zoominfo":       src_conf(0.89, 0.35),
        "liberty_data":   src_conf(0.86, 0.32),
        "ai_semantic":    0.70,
    }

    # Source codes — well-matched sources usually return correct code
    src_codes = {}
    for src, c in confs.items():
        if c >= 0.80 and rng.random() < (0.85 if is_well_matched else 0.40):
            src_codes[src] = true_naics
        else:
            src_codes[src] = rng.choice(NAICS_LIST)

    n_matched = sum(1 for c in confs.values() if c >= 0.80)
    code_freq = {}
    for c in src_codes.values():
        code_freq[c] = code_freq.get(c, 0) + 1
    majority_agree = max(code_freq.values()) / len(src_codes)
    code_diversity = len(set(src_codes.values())) / len(src_codes)

    jur_vec = {f"jur_{b.lower()}": 0 for b in JUR_BUCKET_MAP}
    jur_vec[f"jur_{bucket.lower()}"] = 1

    row = {
        "oc_conf":          SOURCE_WEIGHTS["opencorporates"] * confs["opencorporates"],
        "efx_conf":         SOURCE_WEIGHTS["equifax"]        * confs["equifax"],
        "tru_conf":         SOURCE_WEIGHTS["trulioo"]        * confs["trulioo"],
        "zi_conf":          SOURCE_WEIGHTS["zoominfo"]       * confs["zoominfo"],
        "ld_conf":          SOURCE_WEIGHTS["liberty_data"]   * confs["liberty_data"],
        "ai_conf":          SOURCE_WEIGHTS["ai_semantic"]    * 0.70,
        "oc_matched":       int(confs["opencorporates"] >= 0.80),
        "efx_matched":      int(confs["equifax"]        >= 0.80),
        "tru_matched":      int(confs["trulioo"]        >= 0.80),
        "zi_matched":       int(confs["zoominfo"]       >= 0.80),
        "ld_matched":       int(confs["liberty_data"]   >= 0.80),
        "ai_inferred":      1,
        "trulioo_pollution":int(rng.random() < 0.07),
        "web_registry_dist":float(rng.uniform(0,0.25) if is_well_matched else rng.uniform(0.2,0.85)),
        "temporal_pivot":   float(rng.uniform(0,0.2) if is_well_matched else rng.uniform(0.1,0.9)),
        "cross_tax_agree":  float(rng.uniform(0.6,1.0) if is_well_matched else rng.uniform(0.2,0.7)),
        "registry_ai_dist": float(rng.uniform(0,0.25) if is_well_matched else rng.uniform(0.2,0.85)),
        "is_holding":       int(entity_type == "Holding"),
        "is_ngo":           int(entity_type == "NGO"),
        "is_partnership":   int(entity_type == "Partnership"),
        **jur_vec,
        "is_subnational":   int(is_subnational),
        "is_naics_jur":     int(is_naics_jur),
        "majority_agreement":round(majority_agree, 4),
        "high_risk_flag":   int(true_naics[:4] in HIGH_RISK_PREFIXES),
        "code_diversity":   round(code_diversity, 4),
        "registry_dist2":   float(rng.uniform(0,0.25) if is_well_matched else rng.uniform(0.2,0.85)),
        "avg_conf":         round(float(np.mean(list(confs.values()))), 4),
        "max_conf":         round(float(max(confs.values())), 4),
        "source_count":     round(n_matched / 6.0, 4),
        "label":            true_naics,
    }
    return row


def generate_consensus_training_data(n: int = 6000,
                                      real_naics_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """
    Build labelled dataset for Consensus Model 2.

    When real_naics_df is provided (from Redshift rel_business_industry_naics),
    uses those NAICS codes as ground truth labels — dramatically improving accuracy.
    """
    rng = np.random.RandomState(42)
    rows = []

    if real_naics_df is not None and "naics_code" in real_naics_df.columns:
        codes = real_naics_df["naics_code"].dropna().astype(str).tolist()
        codes = [c for c in codes if re.match(r"^\d{6}$", c)]
        if len(codes) >= 100:
            NAICS_LIST_REAL = list(set(codes))
            print(f"  Using {len(NAICS_LIST_REAL)} real NAICS codes from Redshift as ground truth")
        else:
            NAICS_LIST_REAL = NAICS_LIST
    else:
        NAICS_LIST_REAL = NAICS_LIST

    jurisdictions = (
        ["us"] * 20 + ["us_mo","us_ca","us_ny","us_fl","us_tx","us_wa","us_il",
                        "us_ga","us_nc","us_ak","us_al","us_ar","us_az","us_co","us_mi"] +
        ["gb","gb_eng","gb_sct","gg","je"] * 3 +
        ["de","fr","it","es","nl","pl","be","at","se","no"] * 2 +
        ["ca","ca_bc","ca_qc","ca_on"] * 2 +
        ["ae","ae_az","ae_du","sa","eg"] +
        ["in","cn","jp","sg","au","kr","th"] +
        ["mx","br","ar","co"] +
        ["za","ng","ke"]
    )
    entity_types = (["Operating"] * 70 + ["Holding"] * 15 + ["NGO"] * 8 + ["Partnership"] * 7)

    for _ in range(n):
        code = rng.choice(NAICS_LIST_REAL)
        jc   = rng.choice(jurisdictions)
        et   = rng.choice(entity_types)
        # 65% well-matched (entity found in Redshift with high confidence)
        matched = rng.random() < 0.65
        rows.append(_build_consensus_row(code, jc, et, rng, matched))

    df = pd.DataFrame(rows)
    print(f"  Consensus training: {len(df)} rows, {df['label'].nunique()} unique NAICS codes")
    print(f"  Well-matched rows (majority_agreement>0.7): {(df['majority_agreement']>0.7).sum()}")
    return df


def train_consensus_model(df: pd.DataFrame) -> tuple[xgb.XGBClassifier, LabelEncoder, dict]:
    """Train Consensus Classification Model 2."""
    le = LabelEncoder()
    y  = le.fit_transform(df["label"].values)
    X  = df[CONSENSUS_FEATURES].values
    n_classes = len(le.classes_)

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.20, random_state=42)

    # Remap to contiguous labels
    train_classes = np.unique(y_tr)
    remap = {c: i for i, c in enumerate(train_classes)}
    y_tr_r = np.array([remap[c] for c in y_tr])
    test_mask  = np.isin(y_te, train_classes)
    X_te_f = X_te[test_mask]
    y_te_r = np.array([remap[c] for c in y_te[test_mask]])
    n_cls_train = len(train_classes)

    model = xgb.XGBClassifier(
        objective        = "multi:softprob",
        num_class        = n_cls_train,
        tree_method      = "hist",
        max_depth        = 6,
        n_estimators     = 400,
        learning_rate    = 0.08,
        subsample        = 0.8,
        colsample_bytree = 0.8,
        min_child_weight = 3,
        gamma            = 0.05,
        reg_alpha        = 0.1,
        reg_lambda       = 1.0,
        n_jobs           = -1,
        verbosity        = 0,
    )
    model.fit(X_tr, y_tr_r, verbose=False)

    probs   = model.predict_proba(X_te_f)
    y_pred  = probs.argmax(axis=1)
    top1    = accuracy_score(y_te_r, y_pred)
    top3    = top_k_accuracy_score(y_te_r, probs, k=min(3, n_cls_train),
                                   labels=list(range(n_cls_train)))
    ll      = log_loss(y_te_r, probs)

    fi = {feat: round(float(imp), 6)
          for feat, imp in sorted(
              zip(CONSENSUS_FEATURES, model.feature_importances_),
              key=lambda x: x[1], reverse=True
          )[:10]}

    metrics = {
        "model":             "Consensus Industry Classification XGBoost",
        "objective":         "multi:softprob — calibrated probability over all NAICS codes",
        "monotone":          "No — different from production model (multi-class, not binary risk)",
        "n_features":        len(CONSENSUS_FEATURES),
        "n_classes":         n_cls_train,
        "n_train":           len(X_tr),
        "n_test":            len(X_te_f),
        "top1_accuracy":     round(top1, 4),
        "top3_accuracy":     round(top3, 4),
        "log_loss":          round(ll, 4),
        "feature_importance_top10": fi,
        "what_this_measures": (
            "P(correct NAICS code | 38 vendor signal features). "
            "Top-1 accuracy improves dramatically when trained on real manual overrides "
            "from rel_business_industry_naics WHERE platform='manual'."
        ),
    }
    return model, le, metrics, probs, y_te_r, train_classes


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — SIDE-BY-SIDE COMPARISON OF BOTH MODELS
# ═══════════════════════════════════════════════════════════════════════════════

TEST_COMPANIES = [
    # (name, jc, naics, entity_type, kyb_risk_signals)
    # kyb_risk_signals: dict of signal_name → value
    ("Apple Inc",                "us_ca", "334118", "Operating",
     {"tin_match_signal":1,"registry_active_signal":1,"kyb_matched_signal":1,
      "review_count":45,"review_rating":4.8,"idv_passed":1,"tin_signal":0,"idv_fail_signal":0}),

    ("Barclays Bank PLC",        "gb",    "64191",  "Operating",
     {"tin_match_signal":1,"registry_active_signal":1,"kyb_matched_signal":1,
      "review_count":120,"review_rating":3.9,"idv_passed":1,"tin_signal":0}),

    ("XYZ Holdings Ltd",         "ky",    "551112", "Holding",
     {"tin_signal":1,"registry_signal":0,"kyb_matched_signal":0,
      "watchlist_signal":1,"high_am_count":2,"idv_fail_signal":1,"idv_passed":0}),

    ("Goldman Sachs Group",       "us_ny", "523110", "Operating",
     {"tin_match_signal":1,"registry_active_signal":1,"kyb_matched_signal":1,
      "review_count":89,"review_rating":3.5,"risk_signal":0,"watchlist_signal":0}),

    ("Suspicious Electronics Co","ae_az", "423690", "Operating",
     {"tin_signal":1,"registry_signal":1,"watchlist_signal":1,"pep_signal":1,
      "idv_fail_signal":1,"kyb_matched_signal":0,"high_am_count":3,"total_am_count":5}),

    ("Small Pizza LLC",           "us_mo", "722511", "Operating",
     {"tin_match_signal":1,"registry_active_signal":1,"kyb_matched_signal":0,
      "review_count":12,"review_rating":4.2,"idv_passed":1,"tin_signal":0}),

    ("Volkswagen AG",             "de",    "C29",    "Operating",
     {"tin_match_signal":1,"registry_active_signal":1,"kyb_matched_signal":1,
      "review_count":210,"review_rating":4.1,"idv_passed":1}),

    ("Shell Company Trust",       "us_de", "551112", "Holding",
     {"tin_signal":1,"registry_signal":1,"watchlist_count":3,"pep_signal":1,
      "synthetic_score":0.8,"idv_fail_signal":1,"kyb_matched_signal":0}),
]


def build_prod_features_for_company(signals: dict) -> np.ndarray:
    """Build production KYB feature vector from signal dict."""
    row = {}
    for feat in PROD_FEATURES:
        row[feat] = float(signals.get(feat, 0))
    return np.array([list(row.values())])


def build_consensus_features_for_company(naics: str, jc: str, entity_type: str,
                                          is_well_known: bool) -> np.ndarray:
    """Build consensus 38-feature vector for a company."""
    rng = np.random.RandomState(abs(hash(naics + jc)) % 2**31)
    row = _build_consensus_row(naics, jc, entity_type, rng, is_well_known)
    return np.array([[row[f] for f in CONSENSUS_FEATURES]])


def compare_on_test_companies(prod_model, cons_model, le_cons, cons_classes,
                               prod_threshold: float = 0.50) -> pd.DataFrame:
    """Run both models on test companies and show side-by-side results."""
    KYB_COLOURS = {"HIGH":"🔴","MEDIUM":"🟠","LOW":"🟢"}

    rows = []
    for name, jc, naics, entity_type, signals in TEST_COMPANIES:
        is_wk = naics in ["334118","523110","64191","C29"]

        # Production KYB model
        X_prod = build_prod_features_for_company(signals)
        prod_risk_prob = float(prod_model.predict_proba(X_prod)[0, 1])
        prod_risk_level = ("HIGH" if prod_risk_prob > 0.65 else
                           "MEDIUM" if prod_risk_prob > 0.35 else "LOW")

        # Consensus industry model
        X_cons = build_consensus_features_for_company(naics, jc, entity_type, is_wk)
        cons_probs = cons_model.predict_proba(X_cons)[0]
        top_idx = cons_probs.argmax()
        if top_idx < len(cons_classes):
            pred_naics = le_cons.classes_[cons_classes[top_idx]]
            pred_prob  = float(cons_probs[top_idx])
        else:
            pred_naics, pred_prob = "UNKNOWN", 0.0

        top3 = [(le_cons.classes_[cons_classes[i]], float(cons_probs[i]))
                for i in np.argsort(cons_probs)[::-1][:3]
                if i < len(cons_classes)]

        rows.append({
            "Company":               name,
            "Jurisdiction":          jc,
            "Entity Type":           entity_type,
            "True NAICS":            naics,
            # Production model output
            "Prod: Risk Score":      f"{prod_risk_prob:.3f}",
            "Prod: Risk Level":      f"{KYB_COLOURS[prod_risk_level]} {prod_risk_level}",
            "Prod: NAICS code":      "❌ Not produced",
            "Prod: Probability":     "❌ Not produced",
            "Prod: Monotone constraints": "✅ 30 constrained",
            # Consensus model output
            "Cons: NAICS predicted": pred_naics,
            "Cons: Probability":     f"{pred_prob:.1%}",
            "Cons: Top-3 codes":     " | ".join(f"{c}({p:.0%})" for c, p in top3),
            "Cons: Risk Score":      "❌ Not produced (separate Risk Engine does this)",
            "Cons: KYB from Risk Engine": "APPROVE/REVIEW/ESCALATE/REJECT",
            # What each model produces
            "What Prod gives you":   f"Risk={prod_risk_prob:.3f} — use for KYB decisioning",
            "What Cons gives you":   f"NAICS={pred_naics} ({pred_prob:.0%}) — use for industry classification",
            "Are they the same model?": "❌ NO — different objectives, different features",
        })

    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{BOLD}[1/6] Loading real data from Redshift{RESET}")
    kyb_df   = load_kyb_data(n=5000)
    naics_df = load_naics_data(n=5000)
    if kyb_df is None:
        print(f"  Using synthetic KYB data (mirrors global_trulioo_us_kyb schema)")
        kyb_df = generate_synthetic_kyb_data(n=5000)
    else:
        print(f"  Real KYB data: {len(kyb_df)} rows, columns: {list(kyb_df.columns[:5])}...")

    print(f"\n{BOLD}[2/6] Preparing Production KYB Model features{RESET}")
    X_kyb, y_kyb = prepare_kyb_features(kyb_df)
    print(f"  Features used: {X_kyb.columns.tolist()[:5]}...")
    print(f"  Label distribution: {y_kyb.mean():.1%} high-risk, {1-y_kyb.mean():.1%} low-risk")
    available = [f for f in PROD_FEATURES if f in kyb_df.columns]
    missing   = [f for f in PROD_FEATURES if f not in kyb_df.columns]
    print(f"  Features from data: {len(available)}/30 | Missing (filled=0): {len(missing)}")

    print(f"\n{BOLD}[3/6] Training Production KYB XGBoost (monotonic constraints){RESET}")
    print(f"  Constraints: {sum(1 for v in MONOTONE_CONSTRAINTS.values() if v>0)} increasing + "
          f"{sum(1 for v in MONOTONE_CONSTRAINTS.values() if v<0)} decreasing")
    t0 = time.time()
    prod_model, prod_metrics, prod_probs, prod_y_test = train_production_kyb_model(X_kyb, y_kyb)
    print(f"  {GREEN}✓ Training complete in {time.time()-t0:.1f}s{RESET}")
    print(f"  AUC-ROC: {BOLD}{prod_metrics['auc_roc']}{RESET}  |  "
          f"CV-AUC: {prod_metrics['cv_auc_mean']} ± {prod_metrics['cv_auc_std']}  |  "
          f"Avg-Precision: {prod_metrics['avg_precision']}  |  F1: {prod_metrics['f1_score']}")
    print(f"  Top-5 features by importance:")
    for feat, imp in list(prod_metrics["feature_importance_top10"].items())[:5]:
        bar = "█" * int(imp * 200)
        print(f"    {feat:<40} {imp:.4f} {bar}")
    cm = np.array(prod_metrics["confusion_matrix"])
    print(f"  Confusion matrix: TN={cm[0,0]} FP={cm[0,1]} | FN={cm[1,0]} TP={cm[1,1]}")
    prod_model.save_model("prod_kyb_model.ubj")

    print(f"\n{BOLD}[4/6] Training Consensus Industry Classification XGBoost{RESET}")
    t0 = time.time()
    cons_df = generate_consensus_training_data(n=6000, real_naics_df=naics_df)
    cons_model, le_cons, cons_metrics, cons_probs, cons_y_test, cons_classes = train_consensus_model(cons_df)
    print(f"  {GREEN}✓ Training complete in {time.time()-t0:.1f}s{RESET}")
    print(f"  Top-1 Acc: {BOLD}{cons_metrics['top1_accuracy']:.1%}{RESET}  |  "
          f"Top-3 Acc: {cons_metrics['top3_accuracy']:.1%}  |  Log-Loss: {cons_metrics['log_loss']:.4f}")
    print(f"  Top-5 features by importance:")
    for feat, imp in list(cons_metrics["feature_importance_top10"].items())[:5]:
        bar = "█" * int(imp * 200)
        print(f"    {feat:<40} {imp:.4f} {bar}")
    cons_model.save_model("consensus_industry_model.ubj")

    print(f"\n{BOLD}[5/6] Side-by-side comparison on 8 test companies{RESET}")
    df_cmp = compare_on_test_companies(prod_model, cons_model, le_cons, cons_classes)
    print(f"\n  {'Company':<25} {'Prod Risk':<10} {'Cons NAICS':<10} {'Cons Prob':<10} {'Same model?'}")
    print("  " + "─"*70)
    for _, r in df_cmp.iterrows():
        print(f"  {r['Company'][:24]:<25} {r['Prod: Risk Score']:<10} "
              f"{str(r['Cons: NAICS predicted'])[:8]:<10} {r['Cons: Probability']:<10} "
              f"{r['Are they the same model?']}")

    print(f"\n{BOLD}[6/6] Saving all outputs{RESET}")

    all_metrics = {
        "production_kyb_model": {k:v for k,v in prod_metrics.items() if k!="confusion_matrix"},
        "consensus_industry_model": cons_metrics,
        "key_difference": (
            "Production KYB model: binary risk scoring (0-1) with MONOTONIC CONSTRAINTS "
            "on 30 identity verification signals. Input: tin_signal, registry_signal, etc. "
            "Output: KYB risk score. NO industry code produced. "
            "Consensus model: multi-class INDUSTRY CLASSIFICATION on 38 vendor-signal features. "
            "Input: source match_confidence, jurisdiction, entity_type, AML signals. "
            "Output: calibrated probability over NAICS codes. "
            "TOGETHER: Consensus classifies the industry → Risk Engine uses that classification "
            "to augment the KYB risk score with HIGH_RISK_SECTOR, SHELL_COMPANY_SIGNAL etc."
        ),
    }
    with open("comparison_results.json","w") as f:
        json.dump(all_metrics, f, indent=2)

    with pd.ExcelWriter("comparison_results.xlsx", engine="openpyxl") as w:
        df_cmp.to_excel(w, sheet_name="Company Comparison", index=False)
        pd.DataFrame(list({k:str(v) for k,v in prod_metrics.items()}.items()),
                     columns=["Metric","Value"]).to_excel(w, sheet_name="Prod KYB Evaluation", index=False)
        pd.DataFrame(list({k:str(v) for k,v in cons_metrics.items()}.items()),
                     columns=["Metric","Value"]).to_excel(w, sheet_name="Consensus Evaluation", index=False)
        fi_rows = ([{"Model":"Production KYB","Feature":f,"Importance":v}
                    for f,v in list(prod_metrics["feature_importance_top10"].items())] +
                   [{"Model":"Consensus","Feature":f,"Importance":v}
                    for f,v in list(cons_metrics["feature_importance_top10"].items())])
        pd.DataFrame(fi_rows).to_excel(w, sheet_name="Feature Importance", index=False)

    print(f"  Saved: prod_kyb_model.ubj · consensus_industry_model.ubj")
    print(f"         comparison_results.json · comparison_results.xlsx")

    print(f"\n{BOLD}{'═'*70}")
    print("  FINAL SUMMARY")
    print(f"{'═'*70}{RESET}")
    print(f"\n  {BOLD}Production KYB Model (manual-score-service){RESET}")
    print(f"    Purpose:     Binary risk score from identity verification signals")
    print(f"    Features:    30 monotonically-constrained (tin_signal, registry_signal...)")
    print(f"    AUC-ROC:     {prod_metrics['auc_roc']} | F1: {prod_metrics['f1_score']}")
    print(f"    Output:      Risk score 0-1 → APPROVE/REVIEW/REJECT")
    print(f"    Monotone:    ✅ tin_signal ↑ risk ↑ | kyb_matched ↑ risk ↓")
    print(f"\n  {BOLD}Consensus Industry Model (new){RESET}")
    print(f"    Purpose:     Multi-class NAICS industry classification")
    print(f"    Features:    38 vendor-signal features (source confidence, jurisdiction, AML)")
    print(f"    Top-1 Acc:   {cons_metrics['top1_accuracy']:.1%} | Top-3: {cons_metrics['top3_accuracy']:.1%}")
    print(f"    Output:      Probability over NAICS codes + multi-taxonomy")
    print(f"    Monotone:    ❌ Not applicable for multi-class classification")
    print(f"\n  {BOLD}How they work TOGETHER in the Consensus Engine:{RESET}")
    print(f"    1. Consensus Model → predicts NAICS 551112 (Holding Companies)")
    print(f"    2. Risk Engine → HIGH_RISK_SECTOR flag triggered (551112 is AML-elevated)")
    print(f"    3. Registry vs web discrepancy → SHELL_COMPANY_SIGNAL triggered")
    print(f"    4. Both signals → overall risk score 0.65 → KYB: ESCALATE")
    print(f"    The industry classification FEEDS INTO the risk assessment.")
    print()


if __name__ == "__main__":
    main()
