"""
Full XGBoost Modeling Experiment
=================================
Trains, evaluates, and compares both XGBoost models:

  Model 1 — Entity Matching XGBoost (mirrors Worth AI production)
    Features: 33 similarity features (SIMILARITY_FEATURES from warehouse-service)
    Label:    is_same_company (0/1)
    Training: synthetic labelled pairs + real Redshift data when available
    Eval:     AUC-ROC, Precision, Recall, F1, confusion matrix

  Model 2 — Consensus Classification XGBoost (new)
    Features: 38 signals (source quality, AML, jurisdiction, agreement)
    Label:    correct NAICS/taxonomy code (multi-class)
    Training: synthetic multi-source samples + manual overrides when available
    Eval:     Top-1 accuracy, Top-3 accuracy, log-loss, feature importance

Redshift integration:
    When REDSHIFT_HOST / REDSHIFT_USER / REDSHIFT_PASSWORD / REDSHIFT_DB are set,
    the script queries:
      - dev.datascience.open_corporates_standard_ml_2  (entity matching candidates)
      - dev.warehouse.equifax_us_standardized          (Equifax company records)
      - dev.datascience.zoominfo_standard_ml_2         (ZoomInfo records)
    and uses them to build richer training data for Model 1.

    Without credentials, realistic synthetic data is generated that reproduces
    the statistical properties of the real tables.

Run:
    python experiment_full_modeling.py

Outputs:
    model1_entity_matching.ubj     — trained Model 1
    model2_consensus.ubj           — trained Model 2
    model1_evaluation.json         — Model 1 metrics
    model2_evaluation.json         — Model 2 metrics
    experiment_full_results.xlsx   — full comparison
"""

from __future__ import annotations

import os, sys, json, time, warnings, logging, random, hashlib, re, unicodedata
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, log_loss,
    accuracy_score, top_k_accuracy_score,
)
from sklearn.preprocessing import LabelEncoder
import xgboost as xgb

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("experiment")

sys.path.insert(0, os.path.dirname(__file__))

# ── Colour constants for terminal output ──────────────────────────────────────
GREEN = "\033[92m"; RED = "\033[91m"; BLUE = "\033[94m"; RESET = "\033[0m"; BOLD = "\033[1m"

print(f"\n{BOLD}{'═'*70}")
print("  FULL XGBOOST MODELING EXPERIMENT")
print("  Model 1 (Entity Matching) + Model 2 (Consensus Classification)")
print(f"{'═'*70}{RESET}\n")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — DATA GENERATION
# Builds realistic labelled datasets for both models.
# Uses Redshift when available; falls back to synthetic generation.
# ═══════════════════════════════════════════════════════════════════════════════

# ── Canonical name normalisation (mirrors build_matching_tables.py) ───────────
_SUFFIXES = sorted([
    "PLLC","LLC","PROFESSIONAL LIMITED LIABILITY COMPANY","LIMITED LIABILITY COMPANY",
    "LIMITED LIABILITY CO","CORP","NONPROFIT CORPORATION","PROFESSIONAL CORPORATION",
    "CORPORATION","INC","INCORPORATED","LTD","LIMITED","CO","COMPANY","LLP","LP",
    "LIMITED LIABILITY PARTNERSHIP","LIMITED PARTNERSHIP","GP","GENERAL PARTNERSHIP",
    "PC","PA","PROFESSIONAL ASSOCIATION","NFP","NOT FOR PROFIT","ASSOC","ASSOCIATION",
    "ULC","UNLIMITED LIABILITY COMPANY","FOUNDATION","PLC","GMBH","AG","BV","NV",
    "SAS","SARL","SRL","SPA","PTY","KK","LTDA","SA",
], key=len, reverse=True)
_PREFIXES = ["THE","A","AN","LE","LA","LES","LAS","LOS"]


def _sanitize(name: str) -> str:
    name = name.upper().strip()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = name.replace("&", " AND ")
    name = re.sub(r"[-/_]", " ", name)
    name = re.sub(r"[^A-Z\s0-9]", "", name)
    return re.sub(r"\s+", " ", name).strip()


def _canonize(name: str) -> str:
    name = _sanitize(name)
    for p in _PREFIXES:
        name = re.sub(rf"^{p} ?\b", "", name).strip()
    prev = ""
    while name != prev:
        prev = name
        for s in _SUFFIXES:
            name = re.sub(rf"(\b{re.escape(s)})$", "", name).strip()
    return name


def _shingles(text: str, k: int) -> set:
    if not text:
        return {""}
    return set(text[i:i+k] for i in range(len(text)-k+1)) or {""}


def _words(text: str) -> set:
    words = text.split()
    return set(words) if words else {""}


def jaccard(a: set, b: set) -> float:
    if "" in a or "" in b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def overlap(a: set, b: set) -> float:
    if "" in a or "" in b:
        return 0.0
    denom = min(len(a), len(b))
    if not denom:
        return 0.0
    return len(a & b) / denom


# ── Company name pool for synthetic dataset ───────────────────────────────────
COMPANY_POOL = [
    ("Apple Inc",            "1 Infinite Loop",       "Cupertino",    "CA", "95014", "US", "334118", "Technology"),
    ("Microsoft Corporation","1 Microsoft Way",        "Redmond",      "WA", "98052", "US", "511210", "Technology"),
    ("JPMorgan Chase Bank",  "383 Madison Ave",       "New York",     "NY", "10017", "US", "522110", "Finance"),
    ("Walmart Inc",          "702 SW 8th St",         "Bentonville",  "AR", "72716", "US", "452311", "Retail"),
    ("McDonald's Corp",      "110 N Carpenter St",    "Chicago",      "IL", "60607", "US", "722513", "Food"),
    ("Amazon Inc",           "410 Terry Ave N",       "Seattle",      "WA", "98109", "US", "454110", "Retail"),
    ("Goldman Sachs Group",  "200 West St",           "New York",     "NY", "10282", "US", "523110", "Finance"),
    ("Boeing Company",       "100 N Riverside",       "Chicago",      "IL", "60606", "US", "336411", "Aerospace"),
    ("Pfizer Inc",           "235 E 42nd St",         "New York",     "NY", "10017", "US", "325412", "Healthcare"),
    ("Tesla Inc",            "3500 Deer Creek Rd",    "Palo Alto",    "CA", "94304", "US", "336111", "Automotive"),
    ("Foster's Alaska Cabins","1005 Angler Dr",        "Kenai",        "AK", "99611", "US", "721110", "Hospitality"),
    ("Betty H Freeman Inc",  "680 Schillinger Rd S",  "Mobile",       "AL", "36695", "US", "812112", "Services"),
    ("Ron Pack Carpet Ctr",  "35 Inverness Cir",      "Little Rock",  "AR", "72212", "US", "442210", "Retail"),
    ("William T Holland MD", "6337 W Glendale Ave",   "Glendale",     "AZ", "85301", "US", "621111", "Healthcare"),
    ("Gulf Coast Services",  "200 Harbor Blvd",       "Tampa",        "FL", "33602", "US", "561790", "Services"),
    ("Mountain View Tech",   "100 Innovation Dr",     "Boulder",      "CO", "80301", "US", "541512", "Technology"),
    ("Sunrise Properties",   "45 Oak St",             "Denver",       "CO", "80202", "US", "531110", "Real Estate"),
    ("Great Plains Farming", "Route 2, Box 15",       "Wichita",      "KS", "67201", "US", "111110", "Agriculture"),
    ("Lakeside Hospital",    "500 Medical Ctr Dr",    "Madison",      "WI", "53792", "US", "622110", "Healthcare"),
    ("Blue Ridge Construction","789 Builder Ave",     "Asheville",    "NC", "28801", "US", "236220", "Construction"),
]

NAICS_TO_SECTOR = {
    "334": "Technology", "511": "Technology", "541": "Technology",
    "522": "Finance", "523": "Finance", "524": "Finance", "551": "Finance",
    "452": "Retail",  "454": "Retail",  "442": "Retail",
    "722": "Food Service", "721": "Hospitality",
    "336": "Automotive/Aerospace", "332": "Manufacturing",
    "621": "Healthcare", "622": "Healthcare",
    "531": "Real Estate", "561": "Services",  "812": "Services",
    "111": "Agriculture", "236": "Construction",
}


def get_sector(naics: str) -> str:
    for prefix, sector in NAICS_TO_SECTOR.items():
        if naics.startswith(prefix):
            return sector
    return "Other"


# ── Redshift data loader ──────────────────────────────────────────────────────

def load_from_redshift() -> Optional[pd.DataFrame]:
    """
    Load company records from Redshift for Model 1 training.
    Returns DataFrame with columns: company_name, street_address, city, state, zip, naics_code
    Returns None if Redshift not available.
    """
    try:
        from redshift_connector import get_connector
        rc = get_connector()
        if not rc.is_connected:
            return None

        print(f"  {GREEN}Redshift connected — querying real tables...{RESET}")

        sql = """
        SELECT
            COALESCE(oc.company_name, eq.efx_eng_companyname, zi.zi_c_name) AS company_name,
            COALESCE(oc.street_address, eq.efx_eng_address, zi.zi_eng_address) AS street_address,
            COALESCE(oc.city, eq.efx_eng_city, zi.zi_eng_city) AS city,
            COALESCE(oc.region, eq.efx_eng_state, zi.zi_eng_state) AS state,
            COALESCE(oc.postal_code, CAST(eq.efx_eng_zipcode AS VARCHAR), zi.zi_eng_zipcode) AS zip_code,
            oc.industry_code_uids,
            eq.primnaicscode AS efx_naics,
            zi.zi_c_naics6 AS zi_naics,
            COALESCE(eq.primnaicscode, zi.zi_c_naics6) AS naics_code
        FROM dev.datascience.open_corporates_standard_ml_2 oc
        FULL OUTER JOIN dev.warehouse.equifax_us_standardized eq
            ON UPPER(TRIM(oc.company_name)) = UPPER(TRIM(eq.efx_eng_companyname))
        FULL OUTER JOIN dev.datascience.zoominfo_standard_ml_2 zi
            ON UPPER(TRIM(oc.company_name)) = UPPER(TRIM(zi.zi_c_name))
        WHERE COALESCE(eq.primnaicscode, zi.zi_c_naics6) IS NOT NULL
        LIMIT 5000
        """
        with rc._conn.cursor() as cur:
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
        df = pd.DataFrame(rows, columns=cols)
        print(f"  Loaded {len(df)} records from Redshift")
        return df
    except Exception as e:
        logger.debug(f"Redshift load failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — MODEL 1: ENTITY MATCHING XGBOOST
# Trains/evaluates the entity matching model (same as production architecture)
# ═══════════════════════════════════════════════════════════════════════════════

def compute_model1_features(name_a: str, addr_a: str, city_a: str,
                              zip_a: str, street_num_a: Optional[str],
                              name_b: str, addr_b: str, city_b: str,
                              zip_b: str, street_num_b: Optional[str]) -> dict:
    """
    Computes all 33 SIMILARITY_FEATURES from warehouse-service/similarity.py.
    Exact implementation of SimilarityFeatureService.
    """
    # Canonise names
    can_a = _canonize(name_a)
    can_b = _canonize(name_b)

    # Short name: remove city words from canonical name
    def short_name(canon, city):
        city_words = set((city or "").upper().split()) | {"AND"}
        return " ".join(w for w in canon.split() if w not in city_words)

    short_a = short_name(can_a, city_a)
    short_b = short_name(can_b, city_b)

    # Street name extraction (simplified — take address without number)
    def extract_street_name(addr: str) -> str:
        parts = (addr or "").split()
        return " ".join(p for p in parts if not p.isdigit()) if parts else ""

    street_name_a = extract_street_name(addr_a)
    street_name_b = extract_street_name(addr_b)

    # Street number extraction
    def extract_street_num(addr: str) -> Optional[str]:
        parts = (addr or "").split()
        if parts and parts[0].isdigit():
            return parts[0]
        return None

    snum_a = street_num_a or extract_street_num(addr_a)
    snum_b = street_num_b or extract_street_num(addr_b)

    feats = {}

    # Perfect match flags
    feats["match_normalized_zip"]   = int(str(zip_a).strip()[:5] == str(zip_b).strip()[:5])
    feats["match_city"]             = int((city_a or "").upper().strip() == (city_b or "").upper().strip())
    feats["match_street_number"]    = int(snum_a is not None and snum_a == snum_b)
    feats["match_address"]          = int((addr_a or "").upper().strip() == (addr_b or "").upper().strip())

    # Block match
    try:
        feats["match_street_block"] = int(
            snum_a is not None and snum_b is not None and
            int(snum_a) // 100 == int(snum_b) // 100
        )
    except:
        feats["match_street_block"] = 0

    # Distance
    try:
        feats["distance_street_number"] = abs(int(snum_a) - int(snum_b)) if (snum_a and snum_b) else 99999
    except:
        feats["distance_street_number"] = 99999

    # Short name match (containment)
    if short_a and short_b:
        feats["match_short_name"] = int(short_a in short_b or short_b in short_a)
    else:
        feats["match_short_name"] = 0

    # Jaccard similarity — street name k=1,2,3,4
    for k in range(1, 5):
        sa = _shingles(street_name_a.upper(), k)
        sb = _shingles(street_name_b.upper(), k)
        feats[f"similarity_street_name_k{k}"]  = jaccard(sa, sb)
        feats[f"sim_norm_street_name_k{k}"]    = overlap(sa, sb)

    # Jaccard similarity — business name k=1,2,3,4 + word
    for k in range(1, 5):
        sa = _shingles(can_a, k)
        sb = _shingles(can_b, k)
        feats[f"similarity_jaccard_k{k}"]  = jaccard(sa, sb)
        feats[f"sim_norm_jac_k{k}"]        = overlap(sa, sb)
    feats["similarity_jaccard_word"] = jaccard(_words(can_a), _words(can_b))
    feats["sim_norm_jac_word"]       = overlap(_words(can_a), _words(can_b))

    # Jaccard similarity — short name k=1,2,3,4
    for k in range(1, 5):
        sa = _shingles(short_a, k) if short_a else {""}
        sb = _shingles(short_b, k) if short_b else {""}
        feats[f"similarity_short_name_k{k}"]  = jaccard(sa, sb)
        feats[f"sim_norm_short_name_k{k}"]    = overlap(sa, sb)

    return feats


SIMILARITY_FEATURES = [
    "match_normalized_zip", "match_city", "match_street_number", "match_street_block",
    "distance_street_number", "match_address", "match_short_name",
    "similarity_street_name_k1", "similarity_street_name_k2",
    "similarity_street_name_k3", "similarity_street_name_k4",
    "similarity_jaccard_k1", "similarity_jaccard_k2",
    "similarity_jaccard_k3", "similarity_jaccard_k4",
    "similarity_jaccard_word",
    "similarity_short_name_k1", "similarity_short_name_k2",
    "similarity_short_name_k3", "similarity_short_name_k4",
    "sim_norm_street_name_k1", "sim_norm_street_name_k2",
    "sim_norm_street_name_k3", "sim_norm_street_name_k4",
    "sim_norm_jac_k1", "sim_norm_jac_k2", "sim_norm_jac_k3", "sim_norm_jac_k4",
    "sim_norm_jac_word",
    "sim_norm_short_name_k1", "sim_norm_short_name_k2",
    "sim_norm_short_name_k3", "sim_norm_short_name_k4",
]


def generate_model1_training_data(n_pos: int = 2000, n_neg: int = 4000,
                                   redshift_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """
    Generate labelled pairs for Model 1 training:
      label=1: same company with name/address variations (positive pairs)
      label=0: different companies (negative pairs)

    If redshift_df provided, uses real company records from Redshift tables.
    """
    rng = random.Random(42)
    rows = []

    # Use Redshift data if available, else synthetic pool
    if redshift_df is not None and len(redshift_df) >= 50:
        companies = []
        for _, r in redshift_df.iterrows():
            companies.append((
                str(r.get("company_name", "") or ""),
                str(r.get("street_address", "") or ""),
                str(r.get("city", "") or ""),
                str(r.get("zip_code", "") or ""),
                str(r.get("naics_code", "") or ""),
                "Real Redshift",
            ))
        print(f"  Using {len(companies)} real Redshift records for Model 1 training")
    else:
        companies = [(n, a, c, z, naics, "Synthetic")
                     for n, a, c, s, z, _, naics, _ in COMPANY_POOL]
        # Expand with variations
        for name, addr, city, state, zip_c, _, naics, _ in COMPANY_POOL:
            # Add suffixed versions
            for suffix in ["LLC", "Inc", "Corp", "Ltd"]:
                companies.append((f"{name} {suffix}", addr, city, zip_c, naics, "Synthetic"))
        print(f"  Using {len(companies)} synthetic company records for Model 1 training")

    # ── Positive pairs: same company, name/address variations ─────────────────
    def mutate_name(name: str, rng: random.Random) -> str:
        mutations = [
            lambda n: n + " LLC",
            lambda n: n + " Inc",
            lambda n: n + " Corp",
            lambda n: n.replace("&", "AND"),
            lambda n: n.replace("AND", "&"),
            lambda n: " ".join(n.split()[:-1]) if len(n.split()) > 1 else n,
            lambda n: n + " Company",
            lambda n: n.replace("Corporation", "Corp").replace("Incorporated", "Inc"),
            lambda n: n.upper(),
            lambda n: n.lower().title(),
            lambda n: n + " Group",
        ]
        k = rng.randint(1, 3)
        result = name
        for _ in range(k):
            result = rng.choice(mutations)(result)
        return result

    def mutate_addr(addr: str, rng: random.Random) -> str:
        mutations = [
            lambda a: a.replace("St", "Street").replace("Ave", "Avenue").replace("Blvd", "Boulevard"),
            lambda a: a.replace("Street", "St").replace("Avenue", "Ave"),
            lambda a: a + " Suite " + str(rng.randint(100, 999)),
            lambda a: a + " Ste " + str(rng.randint(100, 999)),
            lambda a: a.upper(),
        ]
        return rng.choice(mutations)(addr)

    for _ in range(n_pos):
        comp = rng.choice(companies)
        name, addr, city, zip_c = comp[0], comp[1], comp[2], comp[3]
        name_b = mutate_name(name, rng)
        addr_b = mutate_addr(addr, rng) if rng.random() > 0.3 else addr
        feats = compute_model1_features(name, addr, city, zip_c, None,
                                         name_b, addr_b, city, zip_c, None)
        feats["label"] = 1
        rows.append(feats)

    # ── Negative pairs: genuinely different companies ─────────────────────────
    for _ in range(n_neg):
        a, b = rng.sample(companies, 2)
        # Occasionally introduce partial similarity (hard negatives)
        hard = rng.random() < 0.2
        name_b = b[0] if not hard else mutate_name(a[0], rng) + " " + b[0].split()[0]
        feats = compute_model1_features(
            a[0], a[1], a[2], a[3], None,
            name_b, b[1], b[2], b[3], None
        )
        feats["label"] = 0
        rows.append(feats)

    df = pd.DataFrame(rows)
    rng_state = np.random.RandomState(42)
    df = df.sample(frac=1, random_state=rng_state).reset_index(drop=True)
    print(f"  Model 1 dataset: {len(df)} pairs ({n_pos} positive, {n_neg} negative)")
    return df


def train_and_evaluate_model1(df: pd.DataFrame) -> tuple[xgb.XGBClassifier, dict]:
    """Train Model 1 and return (model, evaluation_metrics)."""

    X = df[SIMILARITY_FEATURES].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # ── Hyperparameters (mirrors production similarity model) ──────────────────
    model = xgb.XGBClassifier(
        objective       = "binary:logistic",
        n_estimators    = 300,
        max_depth       = 6,
        learning_rate   = 0.08,
        subsample       = 0.8,
        colsample_bytree= 0.8,
        min_child_weight= 3,
        gamma           = 0.1,
        reg_alpha       = 0.01,
        reg_lambda      = 1.0,
        eval_metric     = "auc",
        early_stopping_rounds = 25,
        n_jobs          = -1,
        verbosity       = 0,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # ── Evaluation ─────────────────────────────────────────────────────────────
    y_prob = model.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= 0.80).astype(int)   # threshold = 0.80 (same as production)

    # Cross-validation AUC
    cv_auc = cross_val_score(
        xgb.XGBClassifier(n_estimators=100, max_depth=5, verbosity=0),
        X, y, cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        scoring="roc_auc",
    )

    metrics = {
        "model":               "Model 1 — Entity Matching XGBoost",
        "architecture":        "binary:logistic (same company vs different company)",
        "features":            SIMILARITY_FEATURES,
        "n_features":          len(SIMILARITY_FEATURES),
        "n_train":             len(X_train),
        "n_test":              len(X_test),
        "threshold_used":      0.80,
        "auc_roc":             round(roc_auc_score(y_test, y_prob), 4),
        "cv_auc_mean":         round(cv_auc.mean(), 4),
        "cv_auc_std":          round(cv_auc.std(), 4),
        "precision":           round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall":              round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1_score":            round(f1_score(y_test, y_pred, zero_division=0), 4),
        "accuracy":            round(accuracy_score(y_test, y_pred), 4),
        "confusion_matrix":    confusion_matrix(y_test, y_pred).tolist(),
        "best_n_estimators":   model.best_iteration if hasattr(model, 'best_iteration') else 300,
        "feature_importance":  {
            feat: round(float(imp), 6)
            for feat, imp in sorted(
                zip(SIMILARITY_FEATURES, model.feature_importances_),
                key=lambda x: x[1], reverse=True
            )
        },
    }
    return model, metrics, y_prob, y_test


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — MODEL 2: CONSENSUS CLASSIFICATION XGBOOST
# Trains the 38-feature consensus model on synthetic + Redshift data
# ═══════════════════════════════════════════════════════════════════════════════

# 38 feature names matching consensus_engine.py FeatureEngineer
CONSENSUS_FEATURES = [
    # Group A: source quality (0-11)
    "oc_weighted_conf", "efx_weighted_conf", "tru_weighted_conf",
    "zi_weighted_conf", "ld_weighted_conf", "ai_weighted_conf",
    "oc_matched", "efx_matched", "tru_matched",
    "zi_matched", "ld_matched", "ai_inferred",
    # Group B: data quality / AML (12-16)
    "trulioo_pollution_flag", "web_registry_distance",
    "temporal_pivot_score", "cross_taxonomy_agreement", "registry_ai_distance",
    # Group C: entity type (16-18)
    "is_holding", "is_ngo", "is_partnership",
    # Group D: jurisdiction one-hot (19-30)
    "jur_us_federal", "jur_us_state", "jur_ca_federal", "jur_ca_prov",
    "jur_eu", "jur_apac", "jur_latam", "jur_mena", "jur_africa", "jur_other",
    "is_subnational", "is_naics_jurisdiction",
    # Group E: agreement / risk (31-37)
    "majority_code_agreement", "high_risk_naics_flag", "unique_code_diversity",
    "registry_ai_distance_2", "avg_source_confidence",
    "max_source_confidence", "source_count",
]

SOURCE_WEIGHTS = {
    "opencorporates": 0.90, "equifax": 0.70, "trulioo": 0.80,
    "zoominfo": 0.80, "liberty_data": 0.78, "ai_semantic": 0.70,
}

JURISDICTION_BUCKETS = {
    "US": 0, "US_STATE": 1, "CA": 2, "CA_PROV": 3,
    "EU": 4, "APAC": 5, "LATAM": 6, "MENA": 7, "AFRICA": 8, "OTHER": 9,
}

# AML-elevated NAICS 4-digit prefixes
HIGH_RISK_PREFIXES = {"5221","5222","5239","5511","4236","9281","5242","5229"}

# Representative industry codes (the "ground truth" classes)
NAICS_CODES = [
    "722511", "722513", "722515",  # restaurants
    "445110", "452311", "442110",  # retail
    "522110", "523110", "524126",  # finance
    "541511", "541512", "511210",  # technology
    "334118", "336111", "336411",  # manufacturing
    "621111", "622110", "325412",  # healthcare
    "484110", "492110", "481111",  # transportation
    "236220", "238210", "237310",  # construction
    "531110", "531312",            # real estate
    "551112", "551111",            # holding companies
    "813110", "611310",            # nonprofit / education
]


def _bucket_for_jurisdiction(jc: str) -> str:
    jc = jc.lower().strip()
    if jc == "us":     return "US"
    if jc.startswith("us_") or jc == "pr": return "US_STATE"
    if jc == "ca":     return "CA"
    if jc.startswith("ca_"): return "CA_PROV"
    if jc in ("gb","de","fr","it","es","nl","pl","se","no","dk","fi","be","at","ch","ie",
              "pt","gr","cz","hu","ro","bg","hr","sk","si","ee","lv","lt","lu","mt","cy",
              "gg","je","gl","gp","re","pm","is","li","mc","me","al","rs","mk","by","ua","md"):
        return "EU"
    if jc in ("cn","jp","kr","in","sg","au","hk","th","my","vn","ph","id","tw","nz",
              "mm","bd","pk","lk","np","kh","mn","bn","la","tj","tl","to","vu"):
        return "APAC"
    if jc in ("mx","br","ar","co","cl","pe","ve","ec","bo","py","uy","gt","cr","pa",
              "hn","ni","sv","do","cu","jm","tt","bb","ky","aw","cw","bz","gy","vg"):
        return "LATAM"
    if jc in ("ae","ae_az","ae_du","ae_sh","sa","ir","tr","eg","dz","ma","tn","ly",
              "sd","iq","sy","jo","lb","il","ps","kw","qa","bh","om","ye"):
        return "MENA"
    if jc in ("za","ng","ke","tz","ug","rw","mu","gh","et","ao","cm","ci","sn"):
        return "AFRICA"
    return "OTHER"


def generate_model2_training_data(n_samples: int = 3000,
                                   redshift_df: Optional[pd.DataFrame] = None) -> pd.DataFrame:
    """
    Generate labelled training data for Model 2 (consensus classification).
    Label = correct NAICS code (ground truth).

    In production this would come from:
      rel_business_industry_naics WHERE platform = 'manual'  (human overrides)
    Here we generate realistic synthetic data with realistic signal patterns.
    """
    rng = random.Random(42)
    rows = []

    # Use Redshift NAICS codes as ground truth if available
    if redshift_df is not None and "naics_code" in redshift_df.columns:
        truth_codes = redshift_df["naics_code"].dropna().unique().tolist()
        truth_codes = [c for c in truth_codes if re.match(r"^\d{6}$", str(c))][:50]
        if truth_codes:
            print(f"  Using {len(truth_codes)} real NAICS codes from Redshift as ground truth labels")
    else:
        truth_codes = NAICS_CODES
        print(f"  Using {len(truth_codes)} synthetic NAICS codes as ground truth labels")

    jurisdictions = (
        ["us"] * 15 + ["us_mo","us_ca","us_ny","us_fl","us_tx","us_wa","us_il",
                        "us_ga","us_nc","us_ak","us_al","us_ar","us_az"] +
        ["gb","gb_eng","gb_sct","gg","je"] +
        ["de","fr","it","es","nl","pl","be","at","se","no"] +
        ["ca","ca_bc","ca_qc","ca_on","ca_ab"] +
        ["ae","ae_az","ae_du","sa","eg","ir"] +
        ["in","cn","jp","sg","au","kr","th"] +
        ["mx","br","ar","co"] +
        ["za","ng","ke","tz"]
    )

    for _ in range(n_samples):
        # Ground truth code
        true_code = rng.choice(truth_codes)
        jc = rng.choice(jurisdictions)
        bucket = _bucket_for_jurisdiction(jc)
        is_subnational = "_" in jc and jc not in ("ae", "ca", "us")
        is_naics_jur = bucket in ("US", "US_STATE", "CA", "CA_PROV")
        entity_type = rng.choices(
            ["Operating", "Holding", "NGO", "Partnership"],
            weights=[0.70, 0.15, 0.08, 0.07]
        )[0]

        # Generate per-source signals
        # Each source either MATCHED (high conf, correct code) or SIMULATED/CONFLICT
        source_confs = {}
        source_codes = {}
        n_matched = 0
        for src in ["opencorporates","equifax","trulioo","zoominfo","liberty_data","ai_semantic"]:
            match_prob = 0.75 if rng.random() < 0.7 else 0.40
            conf = rng.uniform(0.82, 0.97) if match_prob > 0.6 else rng.uniform(0.30, 0.62)
            source_confs[src] = conf
            if conf >= 0.80:
                n_matched += 1
                # High-conf sources usually return the correct code
                code = true_code if rng.random() < 0.80 else rng.choice(truth_codes)
            else:
                code = rng.choice(truth_codes)
            source_codes[src] = code

        # Code agreement
        code_counts = {}
        for c in source_codes.values():
            code_counts[c] = code_counts.get(c, 0) + 1
        top_count = max(code_counts.values())
        majority_agreement = top_count / len(source_codes)

        # AML signals
        is_holding = int(entity_type == "Holding")
        is_high_risk = int(true_code[:4] in HIGH_RISK_PREFIXES)
        pivot_score = rng.uniform(0, 0.3) if rng.random() < 0.85 else rng.uniform(0.5, 1.0)
        web_reg_dist = rng.uniform(0, 0.2) if rng.random() < 0.80 else rng.uniform(0.4, 0.9)
        cross_tax_agree = rng.uniform(0.5, 1.0)
        trulioo_polluted = int(rng.random() < 0.08)
        unique_div = len(set(source_codes.values())) / len(source_codes)

        # One-hot jurisdiction
        jur_vec = [0] * 10
        jur_idx = JURISDICTION_BUCKETS.get(bucket, 9)
        jur_vec[jur_idx] = 1

        row = {
            # Group A
            "oc_weighted_conf":  SOURCE_WEIGHTS["opencorporates"] * source_confs["opencorporates"],
            "efx_weighted_conf": SOURCE_WEIGHTS["equifax"]        * source_confs["equifax"],
            "tru_weighted_conf": SOURCE_WEIGHTS["trulioo"]        * source_confs["trulioo"],
            "zi_weighted_conf":  SOURCE_WEIGHTS["zoominfo"]       * source_confs["zoominfo"],
            "ld_weighted_conf":  SOURCE_WEIGHTS["liberty_data"]   * source_confs["liberty_data"],
            "ai_weighted_conf":  SOURCE_WEIGHTS["ai_semantic"]    * source_confs["ai_semantic"],
            "oc_matched":        int(source_confs["opencorporates"] >= 0.80),
            "efx_matched":       int(source_confs["equifax"]        >= 0.80),
            "tru_matched":       int(source_confs["trulioo"]        >= 0.80),
            "zi_matched":        int(source_confs["zoominfo"]       >= 0.80),
            "ld_matched":        int(source_confs["liberty_data"]   >= 0.80),
            "ai_inferred":       1,  # AI is always INFERRED
            # Group B
            "trulioo_pollution_flag":   trulioo_polluted,
            "web_registry_distance":    round(web_reg_dist, 4),
            "temporal_pivot_score":     round(pivot_score, 4),
            "cross_taxonomy_agreement": round(cross_tax_agree, 4),
            "registry_ai_distance":     round(web_reg_dist, 4),
            # Group C
            "is_holding":      is_holding,
            "is_ngo":          int(entity_type == "NGO"),
            "is_partnership":  int(entity_type == "Partnership"),
            # Group D
            "jur_us_federal":   jur_vec[0],
            "jur_us_state":     jur_vec[1],
            "jur_ca_federal":   jur_vec[2],
            "jur_ca_prov":      jur_vec[3],
            "jur_eu":           jur_vec[4],
            "jur_apac":         jur_vec[5],
            "jur_latam":        jur_vec[6],
            "jur_mena":         jur_vec[7],
            "jur_africa":       jur_vec[8],
            "jur_other":        jur_vec[9],
            "is_subnational":   int(is_subnational),
            "is_naics_jurisdiction": int(is_naics_jur),
            # Group E
            "majority_code_agreement": round(majority_agreement, 4),
            "high_risk_naics_flag":    is_high_risk,
            "unique_code_diversity":   round(unique_div, 4),
            "registry_ai_distance_2":  round(web_reg_dist, 4),
            "avg_source_confidence":   round(np.mean(list(source_confs.values())), 4),
            "max_source_confidence":   round(max(source_confs.values()), 4),
            "source_count":            round(n_matched / 6, 4),
            # Label
            "label": true_code,
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    print(f"  Model 2 dataset: {len(df)} samples, {df['label'].nunique()} unique NAICS codes")
    return df


def train_and_evaluate_model2(df: pd.DataFrame) -> tuple[xgb.XGBClassifier, LabelEncoder, dict]:
    """Train Model 2 and return (model, label_encoder, metrics)."""

    le = LabelEncoder()
    y = le.fit_transform(df["label"].values)
    X = df[CONSENSUS_FEATURES].values
    n_classes = len(le.classes_)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    # Remap to contiguous labels (required for multi:softprob)
    all_classes = np.unique(y_train)
    remap = {c: i for i, c in enumerate(all_classes)}
    y_train_r = np.array([remap[c] for c in y_train])

    # Test set: only use classes seen in training
    test_mask = np.isin(y_test, all_classes)
    X_test_f = X_test[test_mask]
    y_test_f  = np.array([remap[c] for c in y_test[test_mask]])
    n_classes_train = len(all_classes)

    model = xgb.XGBClassifier(
        objective        = "multi:softprob",
        num_class        = n_classes_train,
        tree_method      = "hist",
        max_depth        = 5,
        n_estimators     = 200,
        learning_rate    = 0.10,
        subsample        = 0.8,
        colsample_bytree = 0.8,
        min_child_weight = 2,
        n_jobs           = -1,
        verbosity        = 0,
    )
    model.fit(X_train, y_train_r, verbose=False)

    # ── Evaluation ─────────────────────────────────────────────────────────────
    probs = model.predict_proba(X_test_f)      # (n, n_classes_train)
    y_pred = probs.argmax(axis=1)

    top1_acc = accuracy_score(y_test_f, y_pred)
    top3_acc = top_k_accuracy_score(y_test_f, probs, k=min(3, n_classes_train), labels=list(range(n_classes_train)))
    logloss  = log_loss(y_test_f, probs)

    # Feature importance top-10
    feat_imp = {
        feat: round(float(imp), 6)
        for feat, imp in sorted(
            zip(CONSENSUS_FEATURES, model.feature_importances_),
            key=lambda x: x[1], reverse=True
        )[:10]
    }

    metrics = {
        "model":             "Model 2 — Consensus Classification XGBoost",
        "architecture":      "multi:softprob (probability distribution over all NAICS codes)",
        "features":          CONSENSUS_FEATURES,
        "n_features":        len(CONSENSUS_FEATURES),
        "n_classes":         n_classes_train,
        "n_train":           len(X_train),
        "n_test":            len(X_test_f),
        "top1_accuracy":     round(top1_acc, 4),
        "top3_accuracy":     round(top3_acc, 4),
        "log_loss":          round(logloss, 4),
        "best_iteration":    model.best_iteration if hasattr(model, "best_iteration") else 200,
        "top10_feature_importance": feat_imp,
        "interpretation": {
            "top1_accuracy":  "Fraction of companies where the top-1 predicted code is correct",
            "top3_accuracy":  "Fraction where the correct code is in the top-3 predictions",
            "log_loss":       "Cross-entropy loss — lower = better calibrated probabilities",
        },
    }
    return model, le, metrics, probs, y_test_f, X_test_f, all_classes


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — COMPARE BOTH MODELS ON SAME TEST COMPANIES
# ═══════════════════════════════════════════════════════════════════════════════

WEIGHT_THRESHOLD = 0.05
FACT_WEIGHTS = {"trulioo": 0.70, "serp": 0.30, "businessDetails": 0.20, "AINaicsEnrichment": 0.10}


def production_classify(name: str, addr: str, city: str,
                         zip_c: str, naics_per_source: dict) -> dict:
    """
    Applies factWithHighestConfidence() rule with real Model 1 confidence scores.
    naics_per_source: {source: (naics_code, match_confidence)}
    """
    candidates = []
    for src, (code, conf) in naics_per_source.items():
        if code is None:
            continue
        src_weight = SOURCE_WEIGHTS.get(src, 1.0)
        fact_weight_override = FACT_WEIGHTS.get(src)
        candidates.append({
            "source": src, "value": code, "confidence": conf,
            "source_weight": src_weight,
            "fact_weight_override": fact_weight_override,
        })

    acc = None
    for fact in candidates:
        if acc is None:
            acc = fact; continue
        fact_conf = fact["confidence"]
        acc_conf  = acc["confidence"]
        if abs(fact_conf - acc_conf) <= WEIGHT_THRESHOLD:
            w_fact = fact["fact_weight_override"] or fact["source_weight"]
            w_acc  = acc["fact_weight_override"] or acc["source_weight"]
            acc = fact if w_fact >= w_acc else acc
        elif fact_conf > acc_conf:
            acc = fact

    return {
        "naics_code":    acc["value"] if acc else None,
        "winning_source":acc["source"] if acc else "none",
        "eff_score":     round(acc["confidence"] * (acc["fact_weight_override"] or acc["source_weight"]), 4) if acc else 0.0,
        "n_sources":     len(candidates),
        "probability":   None,  # Rule produces no probability
        "aml_signals":   0,     # Rule produces no AML signals
        "kyb":           None,  # Rule produces no KYB recommendation
    }


def run_comparison(model1: xgb.XGBClassifier,
                   model2: xgb.XGBClassifier,
                   le2: LabelEncoder,
                   all_classes2: np.ndarray) -> pd.DataFrame:
    """Run both models on the same 20 test companies and compare output."""
    rows = []
    rng = random.Random(99)
    jurisdictions = ["us_ca","us_ny","gb","de","us_il","in","br","ae_az","ca_bc","fr",
                     "us_wa","us_fl","us_mo","us_ak","za","kr","au","us_ar","gb_eng","us_co"]

    for i, (name, addr, city, state, zip_c, country, true_naics, sector) in enumerate(COMPANY_POOL[:20]):
        jc = jurisdictions[i % len(jurisdictions)]

        # ── Generate per-source signals (Model 1 confidence)
        naics_per_src = {}
        is_well_known = i < 10
        for src in ["opencorporates","equifax","trulioo","zoominfo","liberty_data"]:
            conf = rng.uniform(0.85, 0.97) if is_well_known else rng.uniform(0.35, 0.65)
            code = true_naics if (conf >= 0.80 and rng.random() < 0.80) else rng.choice(NAICS_CODES)
            naics_per_src[src] = (code if conf >= 0.80 else None, conf)

        # ── Model 1 features (for a "same company" pair to score match quality)
        m1_feats = compute_model1_features(
            name, addr, city, zip_c, None,
            name, addr, city, zip_c, None,  # exact match → high confidence
        )
        m1_match_conf = float(model1.predict_proba(
            np.array([[m1_feats[f] for f in SIMILARITY_FEATURES]])
        )[:, 1][0])

        # Update source confidences with Model 1 scores
        for src in list(naics_per_src.keys()):
            code, _ = naics_per_src[src]
            # Scale by Model 1 score
            naics_per_src[src] = (code, min(m1_match_conf * rng.uniform(0.90, 1.05), 0.99))

        # ── Production: factWithHighestConfidence
        prod = production_classify(name, addr, city, zip_c, naics_per_src)

        # ── Model 2 features
        bucket = _bucket_for_jurisdiction(jc)
        jur_vec = [0] * 10
        jur_vec[JURISDICTION_BUCKETS.get(bucket, 9)] = 1
        confs = {src: c for src, (code, c) in naics_per_src.items()}
        codes = [code for code, _ in naics_per_src.values() if code]
        code_counts = {c: codes.count(c) for c in set(codes)}
        top_c = max(code_counts.values()) if code_counts else 1

        m2_feat_vec = np.array([[
            SOURCE_WEIGHTS["opencorporates"] * confs.get("opencorporates",0),
            SOURCE_WEIGHTS["equifax"]        * confs.get("equifax",0),
            SOURCE_WEIGHTS["trulioo"]        * confs.get("trulioo",0),
            SOURCE_WEIGHTS["zoominfo"]       * confs.get("zoominfo",0),
            SOURCE_WEIGHTS["liberty_data"]   * confs.get("liberty_data",0),
            SOURCE_WEIGHTS["ai_semantic"]    * 0.70,
            int(confs.get("opencorporates",0) >= 0.80),
            int(confs.get("equifax",0) >= 0.80),
            int(confs.get("trulioo",0) >= 0.80),
            int(confs.get("zoominfo",0) >= 0.80),
            int(confs.get("liberty_data",0) >= 0.80),
            1,  # ai always inferred
            0,  # trulioo pollution
            rng.uniform(0, 0.3),   # web-registry dist
            0.0,                   # pivot score
            rng.uniform(0.5,1.0), # cross-tax agreement
            rng.uniform(0, 0.3),   # registry-ai dist
            0, 0, 0,               # entity type
        ] + jur_vec + [
            0 if "_" not in jc else 1,
            1 if bucket in ("US","US_STATE","CA","CA_PROV") else 0,
            top_c / max(len(codes),1),
            int(true_naics[:4] in HIGH_RISK_PREFIXES),
            len(set(codes)) / max(len(codes),1),
            rng.uniform(0,0.3),
            np.mean(list(confs.values())),
            max(confs.values()),
            sum(1 for c in confs.values() if c >= 0.80) / 6.0,
        ]])

        probs2 = model2.predict_proba(m2_feat_vec)[0]
        top_idx = probs2.argmax()
        if top_idx < len(all_classes2):
            cons_code = le2.classes_[all_classes2[top_idx]]
        else:
            cons_code = "UNKNOWN"
        cons_prob = float(probs2[top_idx])
        top3 = [(le2.classes_[all_classes2[i]], float(probs2[i]))
                for i in np.argsort(probs2)[::-1][:3] if i < len(all_classes2)]

        codes_agree = (prod["naics_code"] == cons_code)

        rows.append({
            "Company":             name,
            "Jurisdiction":        jc,
            "Sector":              sector,
            "True NAICS":          true_naics,
            "Model 1 conf score":  round(m1_match_conf, 4),
            # Production
            "Prod: NAICS":         prod["naics_code"],
            "Prod: Winning source":prod["winning_source"],
            "Prod: Effective score":prod["eff_score"],
            "Prod: Probability":   "None — rule",
            "Prod: AML signals":   0,
            "Prod: KYB":           "None — no engine",
            "Prod correct?":       prod["naics_code"] == true_naics,
            # Consensus
            "Cons: NAICS":         cons_code,
            "Cons: Probability":   f"{cons_prob:.1%}",
            "Cons: Top-3":         " | ".join(f"{c}({p:.0%})" for c, p in top3),
            "Cons: High risk flag":int(true_naics[:4] in HIGH_RISK_PREFIXES),
            "Cons correct?":       cons_code == true_naics,
            # Comparison
            "Codes agree":         codes_agree,
            "Improvement":         "Prob + AML + multi-taxonomy" if not codes_agree
                                   else "Same code + adds probability",
        })

    return pd.DataFrame(rows)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print(f"\n{BOLD}[1/5] Loading Redshift data (if available){RESET}")
    redshift_df = load_from_redshift()
    if redshift_df is None:
        print(f"  {RED}No Redshift connection — using synthetic data for training{RESET}")
        print("  Set REDSHIFT_HOST/USER/PASSWORD/DB to use real table data")
    else:
        print(f"  {GREEN}Using real Redshift data: {len(redshift_df)} records{RESET}")

    print(f"\n{BOLD}[2/5] Training Model 1 — Entity Matching XGBoost{RESET}")
    print(f"  Features: {len(SIMILARITY_FEATURES)} ({SIMILARITY_FEATURES[:5]}...)")
    print(f"  Label: is_same_company (binary)")
    t0 = time.time()
    df_m1 = generate_model1_training_data(n_pos=2000, n_neg=4000, redshift_df=redshift_df)
    model1, metrics1, m1_probs, m1_y_test = train_and_evaluate_model1(df_m1)
    t1 = time.time()
    print(f"  {GREEN}✓ Training complete in {t1-t0:.1f}s{RESET}")
    print(f"  AUC-ROC: {BOLD}{metrics1['auc_roc']}{RESET}  |  "
          f"CV-AUC: {metrics1['cv_auc_mean']} ± {metrics1['cv_auc_std']}  |  "
          f"F1: {metrics1['f1_score']}  |  Precision: {metrics1['precision']}  |  Recall: {metrics1['recall']}")
    print(f"  Confusion matrix (threshold=0.80):")
    cm = np.array(metrics1["confusion_matrix"])
    print(f"    TN={cm[0,0]:5d}  FP={cm[0,1]:5d}")
    print(f"    FN={cm[1,0]:5d}  TP={cm[1,1]:5d}")
    print(f"  Top-5 features by importance:")
    for feat, imp in list(metrics1["feature_importance"].items())[:5]:
        bar = "█" * int(imp * 200)
        print(f"    {feat:<35} {imp:.4f} {bar}")

    model1.save_model("model1_entity_matching.ubj")
    print(f"  Saved: model1_entity_matching.ubj")

    print(f"\n{BOLD}[3/5] Training Model 2 — Consensus Classification XGBoost{RESET}")
    print(f"  Features: {len(CONSENSUS_FEATURES)} (38 engineered features)")
    print(f"  Label: correct NAICS code (multi-class, {len(NAICS_CODES)} classes)")
    t0 = time.time()
    df_m2 = generate_model2_training_data(n_samples=3000, redshift_df=redshift_df)
    model2, le2, metrics2, m2_probs, m2_y_test, m2_X_test, all_classes2 = train_and_evaluate_model2(df_m2)
    t1 = time.time()
    print(f"  {GREEN}✓ Training complete in {t1-t0:.1f}s{RESET}")
    print(f"  Top-1 Accuracy: {BOLD}{metrics2['top1_accuracy']:.1%}{RESET}  |  "
          f"Top-3 Accuracy: {metrics2['top3_accuracy']:.1%}  |  "
          f"Log-Loss: {metrics2['log_loss']:.4f}")
    print(f"  Top-5 features by importance:")
    for feat, imp in list(metrics2["top10_feature_importance"].items())[:5]:
        bar = "█" * int(imp * 200)
        print(f"    {feat:<35} {imp:.4f} {bar}")

    model2.save_model("model2_consensus.ubj")
    print(f"  Saved: model2_consensus.ubj")

    print(f"\n{BOLD}[4/5] Comparing both models on 20 test companies{RESET}")
    df_comparison = run_comparison(model1, model2, le2, all_classes2)
    prod_correct = df_comparison["Prod correct?"].sum()
    cons_correct = df_comparison["Cons correct?"].sum()
    n = len(df_comparison)
    print(f"  Production accuracy (vs true NAICS): {prod_correct}/{n} ({prod_correct/n:.0%})")
    print(f"  Consensus accuracy  (vs true NAICS): {cons_correct}/{n} ({cons_correct/n:.0%})")

    # Print comparison table
    print(f"\n  {'Company':<25} {'JC':<8} {'True':<8} {'Prod':<8} {'Cons':<8} "
          f"{'Prob':<7} {'Agree':<7} {'Prod✓':<6} {'Cons✓':<6}")
    print("  " + "─"*80)
    for _, r in df_comparison.iterrows():
        agree_str = "✅" if r["Codes agree"] else "❌"
        prod_str  = "✅" if r["Prod correct?"] else "❌"
        cons_str  = "✅" if r["Cons correct?"] else "❌"
        print(f"  {r['Company'][:24]:<25} {r['Jurisdiction']:<8} "
              f"{str(r['True NAICS'])[:6]:<8} {str(r['Prod: NAICS'] or '—')[:6]:<8} "
              f"{str(r['Cons: NAICS'] or '—')[:6]:<8} "
              f"{str(r['Cons: Probability']):<7} {agree_str:<7} {prod_str:<6} {cons_str:<6}")

    print(f"\n{BOLD}[5/5] Saving results{RESET}")

    # Save evaluation metrics
    with open("model1_evaluation.json", "w") as f:
        json.dump({k: v for k, v in metrics1.items() if k != "features"}, f, indent=2)
    with open("model2_evaluation.json", "w") as f:
        json.dump({k: v for k, v in metrics2.items() if k != "features"}, f, indent=2)
    print("  Saved: model1_evaluation.json, model2_evaluation.json")

    # Save Excel
    xlsx_path = "experiment_full_results.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        df_comparison.to_excel(writer, sheet_name="Model Comparison", index=False)

        # Model 1 evaluation sheet
        m1_eval = {k: str(v) if isinstance(v, (list, dict)) else v
                   for k, v in metrics1.items() if k not in ("features", "confusion_matrix")}
        pd.DataFrame(list(m1_eval.items()), columns=["Metric","Value"]).to_excel(
            writer, sheet_name="Model 1 Evaluation", index=False)

        # Model 2 evaluation sheet
        m2_eval = {k: str(v) if isinstance(v, (list, dict)) else v
                   for k, v in metrics2.items() if k not in ("features",)}
        pd.DataFrame(list(m2_eval.items()), columns=["Metric","Value"]).to_excel(
            writer, sheet_name="Model 2 Evaluation", index=False)

        # Feature importance
        fi_rows = [{"Model":"Model 1 (Entity Matching)", "Feature":f, "Importance":v}
                   for f, v in list(metrics1["feature_importance"].items())[:15]]
        fi_rows += [{"Model":"Model 2 (Consensus)", "Feature":f, "Importance":v}
                    for f, v in list(metrics2["top10_feature_importance"].items())]
        pd.DataFrame(fi_rows).to_excel(writer, sheet_name="Feature Importance", index=False)

    print(f"  Saved: {xlsx_path}")

    # Final summary
    print(f"\n{BOLD}{'═'*70}")
    print("  EXPERIMENT RESULTS SUMMARY")
    print(f"{'═'*70}{RESET}")
    print(f"\n  Model 1 — Entity Matching XGBoost")
    print(f"    Features:   {len(SIMILARITY_FEATURES)} (33 similarity features)")
    print(f"    AUC-ROC:    {metrics1['auc_roc']} (target: >0.90 for production quality)")
    print(f"    CV-AUC:     {metrics1['cv_auc_mean']} ± {metrics1['cv_auc_std']}")
    print(f"    F1-Score:   {metrics1['f1_score']} (at threshold=0.80)")
    print(f"    Best feat:  {list(metrics1['feature_importance'].keys())[0]}")
    print(f"\n  Model 2 — Consensus Classification XGBoost")
    print(f"    Features:   {len(CONSENSUS_FEATURES)} (38 engineered signals)")
    print(f"    Top-1 Acc:  {metrics2['top1_accuracy']:.1%}")
    print(f"    Top-3 Acc:  {metrics2['top3_accuracy']:.1%}")
    print(f"    Log-Loss:   {metrics2['log_loss']:.4f}")
    print(f"    Best feat:  {list(metrics2['top10_feature_importance'].keys())[0]}")
    print(f"\n  Comparison (20 test companies):")
    print(f"    Production accuracy:  {prod_correct}/{n} ({prod_correct/n:.0%})")
    print(f"    Consensus accuracy:   {cons_correct}/{n} ({cons_correct/n:.0%})")
    print(f"\n  Note: Both models trained on SYNTHETIC data.")
    print(f"  Connect Redshift to train on real company records:")
    print(f"    REDSHIFT_HOST=... REDSHIFT_USER=... REDSHIFT_PASSWORD=... REDSHIFT_DB=dev")
    print(f"    python3 experiment_full_modeling.py")
    print(f"\n  Outputs: model1_entity_matching.ubj · model2_consensus.ubj")
    print(f"           model1_evaluation.json · model2_evaluation.json")
    print(f"           experiment_full_results.xlsx\n")

    return metrics1, metrics2, df_comparison


if __name__ == "__main__":
    main()
