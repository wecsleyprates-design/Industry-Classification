"""
modeling/feature_engineering.py
================================
Transforms raw rows (from data_loader.py) into the 45-feature numeric vector
fed to the Level 2 Consensus XGBoost model.

Feature groups (45 total):
  A.  6  Source confidence scores          (Level 1 outputs)
  B.  6  Binary match flags                (confidence >= 0.80)
  C.  6  Code discrepancy / AML signals
  D. 12  Jurisdiction one-hot flags
  E.  3  Entity type flags
  F.  4  Aggregate signal quality measures
      4  Extra raw-code boolean features
       ───
     41  (+ 4 = 45 total)

All features are numeric (float32 / int8) — no strings fed to XGBoost.
"""
from __future__ import annotations

import re
import logging
from typing import Optional

import numpy as np
import pandas as pd

from modeling.config import (
    ALL_FEATURES, MATCH_CONFIDENCE_THRESHOLD,
    SOURCE_WEIGHTS, HIGH_RISK_NAICS_PREFIXES,
)

logger = logging.getLogger(__name__)

# ── Jurisdiction bucket sets (from jurisdiction_registry.py) ──────────────────
_EU_JC = {
    "gb","de","fr","it","es","nl","pl","be","at","se","no","dk","fi",
    "ie","pt","gr","cz","hu","ro","bg","hr","sk","si","ee","lv","lt",
    "lu","mt","cy","gg","je","gl","gp","re","pm","is","li","mc","me",
    "al","rs","mk","by","ua","md","ch",
}
_APAC_JC = {
    "cn","jp","kr","in","sg","au","hk","th","my","vn","ph","id","tw",
    "nz","mm","bd","pk","lk","np","kh",
}
_LATAM_JC = {
    "mx","br","ar","co","cl","pe","ve","ec","bo","py","uy","gt","cr",
    "pa","hn","ni","sv","do","cu","jm","tt","bb","ky","aw","bz","pr",
}
_MENA_JC = {
    "ae","ae_az","ae_du","sa","ir","tr","eg","dz","ma","tn","ly","iq",
    "sy","jo","lb","il","ps","kw","qa","bh","om","ye",
}
_AFR_JC = {
    "za","ng","ke","tz","ug","rw","mu","gh","et","ao","cm",
}

# OC uid taxonomy prefixes we recognise
_NAICS_PREFIXES = {"us_naics", "naics"}
_UK_SIC_PREFIXES = {"gb_sic", "uk_sic"}
_NACE_PREFIXES = {"nace", "eu_nace"}


def _parse_oc_uids(uid_str: str) -> dict[str, list[str]]:
    """
    Parse OpenCorporates industry_code_uids pipe-delimited field.
    Example: "gb_sic-56101|us_naics-722511|nace-I5610"
    Returns dict keyed by taxonomy bucket.
    """
    result: dict[str, list[str]] = {
        "naics": [], "uk_sic": [], "nace": [], "other": [],
    }
    if not uid_str or pd.isna(uid_str):
        return result
    for part in str(uid_str).split("|"):
        part = part.strip()
        if "-" not in part:
            continue
        prefix, code = part.split("-", 1)
        prefix = prefix.strip().lower()
        code = code.strip()
        if prefix in _NAICS_PREFIXES:
            result["naics"].append(code)
        elif prefix in _UK_SIC_PREFIXES:
            result["uk_sic"].append(code)
        elif prefix in _NACE_PREFIXES:
            result["nace"].append(code)
        else:
            result["other"].append(code)
    return result


def _jur_bucket(jc: str) -> str:
    j = str(jc or "").lower().strip()
    if j == "us":              return "US"
    if j.startswith("us_") or j == "pr": return "US_STATE"
    if j == "ca":              return "CA"
    if j.startswith("ca_"):   return "CA_PROVINCE"
    if j in _EU_JC:            return "EU"
    if j in _APAC_JC:          return "APAC"
    if j in _LATAM_JC:         return "LATAM"
    if j in _MENA_JC:          return "MENA"
    if j in _AFR_JC:           return "AFR"
    return "OTHER"


def _is_naics_jurisdiction(jc: str) -> bool:
    j = str(jc or "").lower().strip()
    return j in ("us", "ca", "au") or j.startswith("us_") or j.startswith("ca_") or j.startswith("au_")


class FeatureEngineer:
    """
    Transforms a raw DataFrame (output of DataLoader) into the 45-feature
    numeric matrix used by Level2Trainer.

    Usage:
        fe = FeatureEngineer()
        X_df = fe.transform(raw_df)          # returns DataFrame with feature cols
        X    = fe.to_matrix(raw_df)          # returns np.ndarray float32
    """

    THR = MATCH_CONFIDENCE_THRESHOLD

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply all feature engineering to raw_df.
        Returns a DataFrame containing exactly ALL_FEATURES columns + any
        pass-through columns (business_id, label_naics, _data_source, etc.)
        """
        feats = []
        for _, row in df.iterrows():
            feats.append(self._row_to_features(row))
        feat_df = pd.DataFrame(feats)

        # Merge with any non-feature columns from original df
        passthrough = [c for c in df.columns if c not in feat_df.columns]
        result = pd.concat(
            [df[passthrough].reset_index(drop=True), feat_df.reset_index(drop=True)],
            axis=1,
        )
        return result

    def to_matrix(self, df: pd.DataFrame) -> np.ndarray:
        """Return float32 numpy matrix of ALL_FEATURES in canonical order."""
        feat_df = self.transform(df)
        missing = [c for c in ALL_FEATURES if c not in feat_df.columns]
        if missing:
            logger.warning(f"Missing features (defaulting to 0): {missing}")
            for c in missing:
                feat_df[c] = 0.0
        return feat_df[ALL_FEATURES].values.astype(np.float32)

    # ── Row-level feature computation ─────────────────────────────────────────

    def _row_to_features(self, row: pd.Series) -> dict:
        f: dict = {}

        # ── Group A: Source confidence scores ────────────────────────────────
        oc_c  = float(row.get("oc_confidence",  0) or 0)
        efx_c = float(row.get("efx_confidence", 0) or 0)
        zi_c  = float(row.get("zi_confidence",  0) or 0)
        lib_c = float(row.get("liberty_confidence", 0) or 0)
        tru_c = float(row.get("tru_confidence", 0) or 0)
        # AI confidence: if web_registry_distance available, invert it
        ai_c  = float(row.get("ai_confidence", SOURCE_WEIGHTS["ai"]))

        f["oc_confidence"]       = round(oc_c  * SOURCE_WEIGHTS["oc"], 4)
        f["efx_confidence"]      = round(efx_c * SOURCE_WEIGHTS["efx"], 4)
        f["zi_confidence"]       = round(zi_c  * SOURCE_WEIGHTS["zi"], 4)
        f["liberty_confidence"]  = round(lib_c * SOURCE_WEIGHTS["liberty"], 4)
        f["tru_confidence"]      = round(tru_c * SOURCE_WEIGHTS["tru"], 4)
        f["ai_confidence"]       = round(ai_c  * SOURCE_WEIGHTS["ai"], 4)

        # ── Group B: Binary match flags ───────────────────────────────────────
        f["oc_matched"]      = int(oc_c  >= self.THR)
        f["efx_matched"]     = int(efx_c >= self.THR)
        f["zi_matched"]      = int(zi_c  >= self.THR)
        f["liberty_matched"] = int(lib_c >= self.THR)
        f["tru_matched"]     = int(tru_c >= self.THR)
        f["ai_matched"]      = 1  # AI always returns something

        # ── Group C: Code discrepancy / AML signals ───────────────────────────
        # Parse OC uids
        oc_parsed = _parse_oc_uids(row.get("oc_industry_uids", ""))
        oc_naics_codes = oc_parsed["naics"]
        oc_uk_sic_codes = oc_parsed["uk_sic"]

        # Trulioo pollution: returned a 4-digit SIC when 5-digit expected
        tru_sic = str(row.get("tru_sic", "") or "")
        f["tru_pollution_flag"] = int(
            bool(tru_sic) and len(re.sub(r"[^0-9]", "", tru_sic)) == 4
        )

        # Web-to-registry semantic distance (provided or estimated)
        wrd = float(row.get("web_registry_distance", 0) or 0)
        if wrd == 0 and oc_naics_codes:
            # Estimate: if efx and OC codes agree, distance is low
            efx_n = str(row.get("efx_naics", "") or "")
            wrd = 0.15 if any(c[:4] == efx_n[:4] for c in oc_naics_codes) else 0.45
        f["web_registry_distance"] = round(float(wrd), 4)

        # Temporal pivot score (provided or estimated from confidence variance)
        tps = float(row.get("temporal_pivot_score", 0) or 0)
        if tps == 0:
            tps = float(np.std([oc_c, efx_c, zi_c])) * 0.5
        f["temporal_pivot_score"] = round(tps, 4)

        # Cross-taxonomy agreement: count distinct taxonomy types in OC uids
        tax_types = sum([
            bool(oc_parsed["naics"]),
            bool(oc_parsed["uk_sic"]),
            bool(oc_parsed["nace"]),
        ])
        f["cross_taxonomy_agreement"] = tax_types

        # Source majority agreement: fraction of sources returning same 6-digit code
        codes = [
            c[:6] for c in [
                str(row.get("zi_naics",  "") or ""),
                str(row.get("efx_naics", "") or ""),
                (oc_naics_codes[0] if oc_naics_codes else ""),
            ]
            if re.match(r"^\d{6}$", c[:6]) if len(c) >= 6
        ]
        if codes:
            from collections import Counter
            most_common_count = Counter(codes).most_common(1)[0][1]
            f["source_majority_agreement"] = round(most_common_count / len(codes), 4)
        else:
            f["source_majority_agreement"] = 0.0

        # Source code diversity: ratio of unique codes to total codes (high = conflict)
        f["source_code_diversity"] = round(
            len(set(codes)) / max(len(codes), 1), 4
        ) if codes else 1.0

        # ── Group D: Jurisdiction one-hot flags ───────────────────────────────
        jc = str(row.get("oc_jurisdiction_code", "") or
                 row.get("matched_oc_jc", "") or "").lower().strip()
        bucket = _jur_bucket(jc)

        f["j_us"]           = int(bucket == "US")
        f["j_us_state"]     = int(bucket == "US_STATE")
        f["j_ca"]           = int(bucket == "CA")
        f["j_ca_province"]  = int(bucket == "CA_PROVINCE")
        f["j_eu"]           = int(bucket == "EU")
        f["j_apac"]         = int(bucket == "APAC")
        f["j_latam"]        = int(bucket == "LATAM")
        f["j_mena"]         = int(bucket == "MENA")
        f["j_afr"]          = int(bucket == "AFR")
        f["j_other"]        = int(bucket == "OTHER")
        f["is_subnational"] = int("_" in jc)
        f["is_naics_jurisdiction"] = int(_is_naics_jurisdiction(jc))

        # ── Group E: Entity type flags ────────────────────────────────────────
        name_upper = str(row.get("company_name", "") or "").upper()
        f["is_holding"]     = int(any(w in name_upper for w in
                                      ["HOLDING", "HOLDCO", "HOLDINGS"]))
        f["is_ngo"]         = int(any(w in name_upper for w in
                                      ["FOUNDATION", "CHARITY", "NFP", "NON-PROFIT",
                                       "NOT FOR PROFIT", "NONPROFIT"]))
        f["is_partnership"] = int(any(w in name_upper for w in
                                      [" LP", " LLP", " GP", "PARTNER"]))

        # ── Group F: Aggregate signal quality ─────────────────────────────────
        # High-risk sector: any vendor code starts with elevated prefix
        all_naics = [str(row.get("zi_naics","") or ""),
                     str(row.get("efx_naics","") or "")] + oc_naics_codes
        f["hi_risk_sector"] = int(
            any(c[:4] in HIGH_RISK_NAICS_PREFIXES for c in all_naics if len(c) >= 4)
        )

        conf_vals = [oc_c, efx_c, zi_c, lib_c, tru_c, ai_c]
        f["avg_confidence"]          = round(float(np.mean(conf_vals)), 4)
        f["max_confidence"]          = round(float(max(conf_vals)), 4)
        f["sources_above_threshold"] = round(
            sum(1 for c in conf_vals if c >= 0.50) / 6.0, 4
        )

        return f

    # ── Summary stats ─────────────────────────────────────────────────────────

    @staticmethod
    def feature_summary(feat_df: pd.DataFrame) -> pd.DataFrame:
        """Return a summary table of feature statistics."""
        cols = [c for c in ALL_FEATURES if c in feat_df.columns]
        stats = feat_df[cols].describe().T
        stats["nulls"] = feat_df[cols].isna().sum()
        return stats
