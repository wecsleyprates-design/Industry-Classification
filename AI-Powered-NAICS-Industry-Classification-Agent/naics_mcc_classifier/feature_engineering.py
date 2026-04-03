"""
naics_mcc_classifier/feature_engineering.py
=============================================
Transforms raw vendor signals + entity-matching outputs into a numeric
feature vector ready for XGBoost.

Feature groups (matches config.FEATURE_NAMES):
  A. Vendor NAICS signals     — ZI, EFX, OC encoded NAICS codes + ZI confidence
  B. Source agreement         — count of sources that agree on sector / code
  C. Entity-match confidence  — XGBoost match scores (Pipeline B)
  D. Business name tokens     — keyword flags + hashed tokens
  E. Jurisdiction              — state, country, is_US
  F. AI enrichment metadata   — confidence level, website flag, current fallback
  G. Firmographic              — employee count, revenue (log-scaled)
"""
from __future__ import annotations

import hashlib
import logging
import re
from typing import Optional

import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from .config import NAICS_FALLBACK, MCC_FALLBACK, FEATURE_NAMES

logger = logging.getLogger(__name__)

# ── Keyword lists for business name signals ───────────────────────────────────
_FOOD_KW    = re.compile(r"\b(restaurant|pizza|cafe|coffee|bakery|grill|diner|sushi|taco|burger|bbq|eatery|bar)\b", re.I)
_SALON_KW   = re.compile(r"\b(salon|spa|beauty|nail|hair|barber|estheti)\b", re.I)
_CONST_KW   = re.compile(r"\b(construction|contractor|builder|plumb|electr|hvac|roof|concrete|mason)\b", re.I)
_TECH_KW    = re.compile(r"\b(software|tech|systems|digital|cyber|cloud|data|computing|solutions|ai|ml)\b", re.I)
_MEDICAL_KW = re.compile(r"\b(medical|health|dental|physician|clinic|hospital|therapy|care|nurse|pharma)\b", re.I)
_LEGAL_KW   = re.compile(r"\b(law|attorney|legal|solicitor|counsel)\b", re.I)
_FINANCE_KW = re.compile(r"\b(capital|invest|financial|fund|wealth|insurance|mortgage|bank|credit|asset)\b", re.I)
_ENTITY_KW  = re.compile(r"\b(llc|inc|corp|ltd|co|lp|llp|plc|pllc|gmbh)\b", re.I)

# Known US state codes (for encoding)
_US_STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
    "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
    "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
    "VA","WA","WV","WI","WY","DC","PR","GU","VI","MISSING",
]
_STATE_MAP = {s: i for i, s in enumerate(_US_STATES)}

_COUNTRY_MAP = {"US": 0, "GB": 1, "CA": 2, "AU": 3, "DE": 4, "FR": 5}


def _name_hash(s: str, idx: int) -> int:
    """Stable 20-bit hash of a name substring for embedding."""
    token = (s.upper().split() + ["", "", ""])[idx]
    return int(hashlib.md5(token.encode()).hexdigest(), 16) % (2**20)


def _log1p_safe(x) -> float:
    try:
        return float(np.log1p(max(0, float(x) if x is not None else 0)))
    except (ValueError, TypeError):
        return 0.0


def _naics_encode(code: str, naics_le: LabelEncoder) -> int:
    """Encode a 6-digit NAICS code using the fitted LabelEncoder. -1 for unknown."""
    if not code or code == NAICS_FALLBACK:
        return -1
    try:
        return int(naics_le.transform([code])[0])
    except ValueError:
        return -1


def build_feature_matrix(
    df: pd.DataFrame,
    naics_le: Optional[LabelEncoder] = None,
    fit_encoders: bool = False,
) -> tuple[pd.DataFrame, LabelEncoder]:
    """
    Converts the raw joined DataFrame into a numeric feature matrix.

    Args:
        df            — output of data_loader.build_training_dataset()
        naics_le      — fitted NAICS LabelEncoder (None when fit_encoders=True)
        fit_encoders  — if True, fit a new LabelEncoder on this data

    Returns:
        features_df   — DataFrame with exactly the columns in config.FEATURE_NAMES
        naics_le      — fitted LabelEncoder for NAICS codes
    """
    feats = pd.DataFrame(index=df.index)

    # ── A. Vendor NAICS signals ───────────────────────────────────────────────
    for col in ["zi_c_naics6", "efx_naics_primary", "oc_naics_primary"]:
        if col not in df.columns:
            df[col] = ""

    # Fit or reuse encoder
    all_naics = pd.concat([
        df["zi_c_naics6"].fillna(""),
        df["efx_naics_primary"].fillna(""),
        df["oc_naics_primary"].fillna(""),
    ], ignore_index=True)
    all_naics = all_naics[all_naics.str.match(r"^\d{6}$")].unique().tolist()
    all_naics = sorted(set(all_naics + [NAICS_FALLBACK, "000000"]))

    if fit_encoders or naics_le is None:
        naics_le = LabelEncoder()
        naics_le.fit(all_naics)

    def _enc(s):
        return _naics_encode(str(s).strip().zfill(6) if str(s).strip() else "", naics_le)

    feats["zi_naics6"]  = df["zi_c_naics6"].fillna("").apply(_enc)
    feats["zi_naics4"]  = df["zi_c_naics6"].fillna("").str[:4].apply(
        lambda x: int(x) if x.isdigit() else 0
    )
    feats["zi_naics2"]  = df["zi_c_naics6"].fillna("").str[:2].apply(
        lambda x: int(x) if x.isdigit() else 0
    )
    feats["zi_naics_confidence"] = pd.to_numeric(
        df.get("zi_c_naics_confidence_score", pd.Series(np.nan, index=df.index)),
        errors="coerce"
    ).fillna(-1.0)

    feats["zi_sic4"] = (
        df.get("zi_c_sic4", pd.Series("", index=df.index))
        .fillna("").apply(lambda x: int(x) if str(x).isdigit() else 0)
    )

    feats["efx_naics_primary"]    = df["efx_naics_primary"].fillna("").apply(_enc)
    feats["efx_naics_sector"]     = df["efx_naics_primary"].fillna("").str[:2].apply(
        lambda x: int(x) if x.isdigit() else 0
    )
    feats["efx_sic_primary"]      = (
        df.get("efx_sic_primary", pd.Series("", index=df.index))
        .fillna("").apply(lambda x: int(x[:4]) if str(x).strip()[:4].isdigit() else 0)
    )
    feats["efx_naics_secondary_1"] = df.get("efx_naics_secondary_1", pd.Series("", index=df.index)).fillna("").apply(_enc)
    feats["efx_naics_secondary_2"] = df.get("efx_naics_secondary_2", pd.Series("", index=df.index)).fillna("").apply(_enc)

    feats["oc_naics_primary"] = df["oc_naics_primary"].fillna("").apply(_enc)
    feats["oc_naics_sector"]  = df.get("oc_naics_sector", pd.Series("", index=df.index)).fillna("").apply(
        lambda x: int(x) if str(x).isdigit() else 0
    )

    # ── B. Source agreement ───────────────────────────────────────────────────
    def _sector2(code_col: str) -> pd.Series:
        return df[code_col].fillna("").str[:2]

    zi_sec  = _sector2("zi_c_naics6")
    efx_sec = _sector2("efx_naics_primary")
    oc_sec  = _sector2("oc_naics_sector") if "oc_naics_sector" in df.columns else pd.Series("", index=df.index)

    feats["naics2_agreement"] = (
        (zi_sec == efx_sec).astype(int) +
        (zi_sec == oc_sec).astype(int)  +
        (efx_sec == oc_sec).astype(int)
    )
    feats["naics4_agreement"] = (
        (df["zi_c_naics6"].fillna("").str[:4] == df["efx_naics_primary"].fillna("").str[:4]).astype(int) +
        (df["zi_c_naics6"].fillna("").str[:4] == df["oc_naics_primary"].fillna("").str[:4]).astype(int)
    )
    feats["naics6_agreement"] = (
        (df["zi_c_naics6"].fillna("") == df["efx_naics_primary"].fillna("")).astype(int) +
        (df["zi_c_naics6"].fillna("") == df["oc_naics_primary"].fillna("")).astype(int)
    )
    feats["zi_efx_naics_match"] = (zi_sec == efx_sec).astype(int)
    feats["zi_oc_naics_match"]  = (zi_sec == oc_sec).astype(int)
    feats["efx_oc_naics_match"] = (efx_sec == oc_sec).astype(int)

    # ── C. Entity-match confidence ────────────────────────────────────────────
    feats["zi_match_confidence"]  = pd.to_numeric(df.get("zi_match_confidence",  0), errors="coerce").fillna(0.0)
    feats["efx_match_confidence"] = pd.to_numeric(df.get("efx_match_confidence", 0), errors="coerce").fillna(0.0)
    feats["oc_match_confidence"]  = pd.to_numeric(df.get("oc_match_confidence",  0), errors="coerce").fillna(0.0)

    # ── D. Business name tokens ───────────────────────────────────────────────
    names = df.get("business_name", df.get("zi_c_name", pd.Series("", index=df.index))).fillna("").str.upper()

    feats["name_token_hash_1"]    = names.apply(lambda n: _name_hash(n, 0))
    feats["name_token_hash_2"]    = names.apply(lambda n: _name_hash(n, 1))
    feats["name_token_hash_3"]    = names.apply(lambda n: _name_hash(n, 2))
    feats["name_len_words"]       = names.str.split().str.len().fillna(0).astype(int)
    feats["name_has_llc"]         = names.apply(lambda n: int(bool(_ENTITY_KW.search(n))))
    feats["name_has_restaurant"]  = names.apply(lambda n: int(bool(_FOOD_KW.search(n))))
    feats["name_has_salon"]       = names.apply(lambda n: int(bool(_SALON_KW.search(n))))
    feats["name_has_construction"]= names.apply(lambda n: int(bool(_CONST_KW.search(n))))
    feats["name_has_tech"]        = names.apply(lambda n: int(bool(_TECH_KW.search(n))))
    feats["name_has_medical"]     = names.apply(lambda n: int(bool(_MEDICAL_KW.search(n))))

    # ── E. Jurisdiction ───────────────────────────────────────────────────────
    states = df.get("state", pd.Series("MISSING", index=df.index)).fillna("MISSING").str.upper()
    feats["state_encoded"]  = states.map(lambda s: _STATE_MAP.get(s, len(_US_STATES)))
    countries = df.get("country_code", pd.Series("US", index=df.index)).fillna("US").str.upper()
    feats["country_encoded"] = countries.map(lambda c: _COUNTRY_MAP.get(c, 99))
    feats["is_us_business"]  = (countries == "US").astype(int)

    # ── F. AI enrichment metadata ─────────────────────────────────────────────
    ai_conf = df.get("ai_enrichment_confidence", pd.Series("", index=df.index)).fillna("").str.upper()
    feats["ai_confidence_high"]    = (ai_conf == "HIGH").astype(int)
    feats["ai_confidence_med"]     = (ai_conf == "MED").astype(int)
    feats["ai_confidence_low"]     = (~ai_conf.isin(["HIGH", "MED"])).astype(int)
    feats["ai_naics_is_fallback"]  = df.get("ai_naics_is_fallback", pd.Series(0, index=df.index)).fillna(0).astype(int)
    feats["ai_mcc_is_fallback"]    = df.get("ai_mcc_is_fallback",   pd.Series(0, index=df.index)).fillna(0).astype(int)
    feats["ai_has_website"]        = (
        df.get("ai_website_summary", pd.Series("", index=df.index)).fillna("").str.len() > 10
    ).astype(int)
    feats["ai_naics_sector"]       = (
        df.get("current_naics_code", pd.Series(NAICS_FALLBACK, index=df.index))
        .fillna(NAICS_FALLBACK).str[:2]
        .apply(lambda x: int(x) if x.isdigit() else 0)
    )

    # ── G. Source availability ────────────────────────────────────────────────
    feats["has_zi_match"]  = df.get("has_zi_match",  pd.Series(0, index=df.index)).fillna(0).astype(int)
    feats["has_efx_match"] = df.get("has_efx_match", pd.Series(0, index=df.index)).fillna(0).astype(int)
    feats["has_oc_match"]  = df.get("has_oc_match",  pd.Series(0, index=df.index)).fillna(0).astype(int)

    # ── H. Firmographic ───────────────────────────────────────────────────────
    feats["efx_employee_count_log"] = df.get("efx_employee_count", pd.Series(0, index=df.index)).apply(_log1p_safe)
    feats["efx_annual_sales_log"]   = df.get("efx_annual_sales",   pd.Series(0, index=df.index)).apply(_log1p_safe)
    feats["zi_employee_count_log"]  = df.get("zi_c_total_employee_count", pd.Series(0, index=df.index)).apply(_log1p_safe)
    feats["zi_revenue_log"]         = df.get("zi_c_annual_revenue",       pd.Series(0, index=df.index)).apply(_log1p_safe)

    # ── Reorder to match config.FEATURE_NAMES ────────────────────────────────
    missing_cols = [c for c in FEATURE_NAMES if c not in feats.columns]
    if missing_cols:
        logger.warning("Missing feature columns (filling 0): %s", missing_cols)
        for c in missing_cols:
            feats[c] = 0

    feats = feats[FEATURE_NAMES].copy()

    # Replace any remaining NaN with -1 (XGBoost handles these natively)
    feats = feats.fillna(-1).astype(float)

    logger.info("Built feature matrix: %d rows × %d features", len(feats), feats.shape[1])
    return feats, naics_le
