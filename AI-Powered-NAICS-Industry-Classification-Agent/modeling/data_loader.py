"""
modeling/data_loader.py
=======================
Loads raw data for the modeling pipeline from two sources:

  REAL DATA (when credentials + network access are available):
    - Redshift  : datascience.customer_files + match tables + source tables
    - PostgreSQL: case-service rel_business_industry_naics (analyst labels)

  SYNTHETIC FALLBACK (automatic when Redshift is unreachable):
    - Mirrors the exact schema of the real tables
    - Realistic confidence distributions based on known vs unknown companies
    - Deterministic NAICS labels so Level 2 can actually learn a mapping

Usage:
    loader = DataLoader()
    raw_df = loader.load_features()          # Redshift features
    labels = loader.load_labels()            # case-service PostgreSQL labels
    df     = loader.load_training_dataset()  # features + labels joined
"""
from __future__ import annotations

import logging
import random
import re
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from modeling.config import (
    REDSHIFT, CASESERVICE_PG, TABLES, PG_TABLES,
    SYNTHETIC_N_ROWS, SYNTHETIC_RANDOM_SEED, ARTIFACTS,
    HIGH_RISK_NAICS_PREFIXES,
)

logger = logging.getLogger(__name__)

# ── Sector → NAICS mapping used for synthetic data ───────────────────────────
_SECTOR_NAICS: dict[str, list[str]] = {
    "Technology":    ["541511", "541512", "511210", "518210", "334118"],
    "Finance":       ["522110", "523110", "524126", "522291", "551112"],
    "Retail":        ["445110", "452311", "442110", "454110", "447110"],
    "Food":          ["722511", "722513", "722515", "722310", "445230"],
    "Healthcare":    ["621111", "622110", "621210", "621310", "325412"],
    "Construction":  ["236220", "238210", "237310", "236115", "238290"],
    "Manufacturing": ["334413", "335220", "332710", "333111", "336111"],
    "Real Estate":   ["531110", "531120", "531210", "531312", "531390"],
    "Holding":       ["551112", "551111", "551114", "525910", "525920"],
    "Services":      ["561110", "561210", "561320", "561720", "812112"],
    "Hospitality":   ["721110", "721211", "722410", "713940", "713110"],
}
_ALL_NAICS = [c for codes in _SECTOR_NAICS.values() for c in codes]

_COMPANY_TEMPLATES = [
    # (name, addr, city, state, jc, sector, is_known)
    ("APPLE INC",           "1 INFINITE LOOP",      "CUPERTINO",   "CA", "us_ca", "Technology",    True),
    ("MICROSOFT CORP",      "1 MICROSOFT WAY",       "REDMOND",     "WA", "us_wa", "Technology",    True),
    ("JPMORGAN CHASE BANK", "383 MADISON AVE",       "NEW YORK",    "NY", "us_ny", "Finance",       True),
    ("WALMART INC",         "702 SW 8TH ST",         "BENTONVILLE", "AR", "us_ar", "Retail",        True),
    ("MCDONALDS CORP",      "110 N CARPENTER ST",    "CHICAGO",     "IL", "us_il", "Food",          True),
    ("AMAZON INC",          "410 TERRY AVE N",       "SEATTLE",     "WA", "us_wa", "Retail",        True),
    ("GOLDMAN SACHS",       "200 WEST ST",           "NEW YORK",    "NY", "us_ny", "Finance",       True),
    ("BOEING COMPANY",      "100 N RIVERSIDE",       "CHICAGO",     "IL", "us_il", "Manufacturing", True),
    ("PFIZER INC",          "235 E 42ND ST",         "NEW YORK",    "NY", "us_ny", "Healthcare",    True),
    ("TESLA INC",           "3500 DEER CREEK RD",    "PALO ALTO",   "CA", "us_ca", "Manufacturing", True),
    ("BARCLAYS PLC",        "1 CHURCHILL PLACE",     "LONDON",      "",   "gb",    "Finance",       True),
    ("TESCO PLC",           "TESCO HOUSE",           "WELWYN",      "",   "gb",    "Retail",        True),
    ("SAP SE",              "DIETMAR HOPP ALLEE",    "WALLDORF",    "",   "de",    "Technology",    True),
    ("SHOP LOCAL LLC",      "123 MAIN ST",           "DALLAS",      "TX", "us_tx", "Retail",        False),
    ("SUNRISE CAFE INC",    "45 OAK ST",             "DENVER",      "CO", "us_co", "Food",          False),
    ("COASTAL BUILDERS",    "789 BUILDER AVE",       "CHARLOTTE",   "NC", "us_nc", "Construction",  False),
    ("MIDLAND ENERGY CO",   "300 ENERGY BLVD",       "MIDLAND",     "TX", "us_tx", "Manufacturing", False),
    ("LAKESIDE HOSPITAL",   "500 MEDICAL CTR DR",    "MADISON",     "WI", "us_wi", "Healthcare",    False),
    ("BLUE PEAK HOLDINGS",  "1000 CORPORATE DR",     "BOSTON",      "MA", "us_ma", "Holding",       False),
    ("SUNSET PROPERTIES",   "200 REAL ESTATE BLVD",  "PHOENIX",     "AZ", "us_az", "Real Estate",   False),
    ("LAKEWOOD HOTEL",      "100 RESORT DR",         "ORLANDO",     "FL", "us_fl", "Hospitality",   False),
    ("ZENITH STAFFING",     "50 HR PLAZA",           "ATLANTA",     "GA", "us_ga", "Services",      False),
    ("NORTHERN TRUST",      "50 S LASALLE ST",       "CHICAGO",     "IL", "us_il", "Finance",       False),
    ("PACIFIC RIM TECH",    "999 SILICON WAY",       "SAN JOSE",    "CA", "us_ca", "Technology",    False),
]

_EFX_SIC_MAP = {
    "541511": "7372", "522110": "6020", "722511": "5812",
    "452311": "5311", "334118": "3571", "336111": "3711",
    "531110": "6500", "551112": "6726", "621111": "8011",
    "236220": "1520", "561110": "7389", "721110": "7011",
}

_JC_TO_JUR: dict[str, str] = {
    "gb": "gb", "de": "de", "fr": "fr",
    "us_ca": "us_ca", "us_ny": "us_ny", "us_tx": "us_tx",
    "us_wa": "us_wa", "us_il": "us_il", "us_ar": "us_ar",
    "us_nc": "us_nc", "us_co": "us_co", "us_wi": "us_wi",
    "us_ma": "us_ma", "us_az": "us_az", "us_fl": "us_fl",
    "us_ga": "us_ga", "us_mo": "us_mo",
}


@dataclass
class LoadResult:
    df: pd.DataFrame
    source: str           # "REDSHIFT_REAL", "REDSHIFT_SYNTHETIC", "CASESERVICE_REAL" …
    n_rows: int
    label_source: str     # "CASESERVICE_PG", "PROXY_PRODUCTION_RULE", "SYNTHETIC"
    has_real_labels: bool


class DataLoader:
    """
    Loads and prepares data for both production baseline and Consensus modeling.

    Automatic fallback chain:
      Redshift available → load real features
      Redshift unavailable → generate synthetic features (same schema)

      Case-service PG available → load real analyst labels
      Case-service PG unavailable + Redshift available → use production rule as proxy label
      Neither available → use synthetic deterministic labels
    """

    def __init__(self) -> None:
        self._redshift_conn = None
        self._pg_conn = None
        self._redshift_ok = False
        self._pg_ok = False
        self._try_connections()

    # ── Public API ────────────────────────────────────────────────────────────

    def load_features(self, limit: int = 10_000) -> pd.DataFrame:
        """
        Load raw feature data (Level 1 outputs + vendor industry codes).
        Returns a DataFrame with the columns needed by feature_engineering.py.
        """
        if self._redshift_ok:
            logger.info("Loading features from Redshift …")
            return self._load_features_redshift(limit)
        else:
            logger.info("Redshift unavailable — generating synthetic features …")
            return self._load_features_synthetic(SYNTHETIC_N_ROWS)

    def load_labels(self) -> pd.DataFrame:
        """
        Load analyst-corrected industry labels.
        Returns DataFrame with columns: [business_id, naics_code, label_source].
        """
        if self._pg_ok:
            logger.info("Loading labels from case-service PostgreSQL …")
            return self._load_labels_pg()
        elif self._redshift_ok:
            logger.info("Case-service PG unavailable — using production rule as proxy labels …")
            return self._load_labels_proxy_redshift()
        else:
            logger.info("No DB available — using synthetic deterministic labels …")
            return pd.DataFrame()  # caller handles empty case

    def load_training_dataset(self, limit: int = 10_000) -> LoadResult:
        """
        Main entry point — loads features + labels joined, ready for training.
        Handles all fallback scenarios transparently.
        """
        features_df = self.load_features(limit)
        labels_df   = self.load_labels()

        source      = "REDSHIFT_REAL" if self._redshift_ok else "SYNTHETIC"
        label_src   = ("CASESERVICE_PG"         if self._pg_ok
                       else "PROXY_PRODUCTION_RULE" if self._redshift_ok
                       else "SYNTHETIC")
        has_real    = self._pg_ok

        if labels_df.empty:
            # Synthetic: labels embedded in features_df already
            df = features_df
        else:
            # Real: join on business_id, keep highest-quality label per business
            # (manual override > fact-engine resolution > proxy)
            df = features_df.merge(
                labels_df[["business_id", "naics_code"]],
                on="business_id",
                how="inner",
            ).rename(columns={"naics_code": "label_naics"})

        # Drop rows with no label
        df = df[df["label_naics"].notna()].copy()
        df["label_naics"] = df["label_naics"].astype(str).str.strip()
        df = df[df["label_naics"].str.match(r"^\d{6}$")].copy()

        logger.info(
            f"Training dataset: {len(df):,} rows | "
            f"{df['label_naics'].nunique()} unique NAICS classes | "
            f"source={source} | labels={label_src}"
        )

        # Save to disk
        df.to_parquet(ARTIFACTS["training_dataset"], index=False)
        logger.info(f"Saved training dataset → {ARTIFACTS['training_dataset']}")

        return LoadResult(
            df=df, source=source, n_rows=len(df),
            label_source=label_src, has_real_labels=has_real,
        )

    @property
    def redshift_available(self) -> bool:
        return self._redshift_ok

    @property
    def caseservice_available(self) -> bool:
        return self._pg_ok

    # ── Connection management ─────────────────────────────────────────────────

    def _try_connections(self) -> None:
        try:
            import psycopg2
            conn = psycopg2.connect(**REDSHIFT)
            conn.autocommit = True
            self._redshift_conn = conn
            self._redshift_ok = True
            logger.info("Redshift connection established.")
        except Exception as exc:
            logger.warning(f"Redshift unavailable: {str(exc)[:80]}")

        if CASESERVICE_PG["host"]:
            try:
                import psycopg2
                conn = psycopg2.connect(**CASESERVICE_PG)
                conn.autocommit = True
                self._pg_conn = conn
                self._pg_ok = True
                logger.info("Case-service PostgreSQL connection established.")
            except Exception as exc:
                logger.warning(f"Case-service PG unavailable: {str(exc)[:80]}")

    def _query_redshift(self, sql: str) -> pd.DataFrame:
        with self._redshift_conn.cursor() as cur:
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            return pd.DataFrame(cur.fetchall(), columns=cols)

    def _query_pg(self, sql: str) -> pd.DataFrame:
        with self._pg_conn.cursor() as cur:
            cur.execute(sql)
            cols = [d[0] for d in cur.description]
            return pd.DataFrame(cur.fetchall(), columns=cols)

    # ── Real data loaders ─────────────────────────────────────────────────────

    def _load_features_redshift(self, limit: int) -> pd.DataFrame:
        """
        Pull all Level 1 outputs and vendor industry codes from Redshift.

        Data pulled (all REAL — already produced by the production pipeline):
          - Level 1 match confidence per source (oc, efx, zi from match tables)
          - Trulioo SIC code and match signal from global_trulioo_us_kyb
          - Vendor industry codes from each source table
          - Production rule output (naics_code already stored in customer_files)
          - OC jurisdiction_code (drives taxonomy routing in Consensus)

        Liberty match confidence is stored locally (parquet), not in Redshift.
        It defaults to 0 here; real liberty_confidence can be joined if the
        {TABLE}_results.parquet is available.
        """
        sql = f"""
        SELECT
            cf.business_id,
            cf.customer_unique_identifier,
            cf.company_name,
            cf.company_address,
            cf.company_city,
            cf.company_state,
            cf.company_postalcode,

            -- ── Level 1 outputs (REAL — already computed by entity_matching model) ──
            -- OC match confidence
            COALESCE(oc.oc_probability,       0.0) AS oc_confidence,
            -- Equifax match confidence
            COALESCE(ef.efx_probability,      0.0) AS efx_confidence,
            -- ZoomInfo match confidence
            COALESCE(zi.zi_probability,       0.0) AS zi_confidence,
            -- Liberty: stored locally in parquet, not in Redshift → default 0
            0.0::FLOAT                             AS liberty_confidence,
            -- Trulioo: name_verification acts as a proxy confidence signal
            COALESCE(tru.name_verification,   0.0) AS tru_confidence,

            -- ── Vendor industry codes (REAL — returned by API calls, stored in Redshift) ──
            -- OpenCorporates: pipe-delimited multi-taxonomy (us_naics-XXXX|gb_sic-XXXX|...)
            oc_src.industry_code_uids              AS oc_industry_uids,
            oc_src.jurisdiction_code               AS oc_jurisdiction_code,
            -- Equifax: primary NAICS + SIC
            ef_src.efx_primnaicscode               AS efx_naics,
            ef_src.efx_primsic                     AS efx_sic,
            -- ZoomInfo: 6-digit NAICS
            zi_src.zi_c_naics6                     AS zi_naics,
            -- Trulioo: SIC code returned by API
            tru.mcc_code                           AS tru_sic,

            -- ── Production rule output (REAL — what customer_table.sql stored) ──
            cf.naics_code                          AS production_naics,
            cf.zi_match_confidence                 AS zi_match_conf_raw,
            cf.efx_match_confidence                AS efx_match_conf_raw,

            -- ── Jurisdiction (from OC — drives taxonomy routing in Consensus) ──
            COALESCE(oc.jurisdiction_code, '')     AS matched_oc_jc,

            -- ── Entity IDs (for joining Liberty parquet if available) ──
            oc.company_number                      AS oc_company_number,
            ef.efx_id                              AS efx_id,
            zi.zi_c_company_id                     AS zi_company_id,
            zi.zi_c_location_id                    AS zi_location_id,
            zi.zi_es_location_id                   AS zi_es_location_id

        FROM {TABLES["customer_files"]} cf
        LEFT JOIN {TABLES["oc_matches"]}  oc   ON oc.business_id  = cf.business_id
        LEFT JOIN {TABLES["efx_matches"]} ef   ON ef.business_id  = cf.business_id
        LEFT JOIN {TABLES["zi_matches"]}  zi   ON zi.business_id  = cf.business_id
        LEFT JOIN {TABLES["global_trulioo_us_kyb"]} tru
               ON tru.customer_unique_identifier = cf.customer_unique_identifier
        LEFT JOIN {TABLES["oc_source"]}   oc_src
               ON oc_src.company_number    = oc.company_number
              AND oc_src.jurisdiction_code = oc.jurisdiction_code
        LEFT JOIN {TABLES["efx_source"]}  ef_src
               ON ef_src.efx_id            = ef.efx_id
        LEFT JOIN {TABLES["zi_source"]}   zi_src
               ON zi_src.zi_c_company_id   = zi.zi_c_company_id
              AND zi_src.zi_c_location_id   = zi.zi_c_location_id
              AND zi_src.zi_es_location_id  = zi.zi_es_location_id
        WHERE cf.business_id IS NOT NULL
        LIMIT {limit}
        """
        df = self._query_redshift(sql)
        df["_data_source"] = "REDSHIFT_REAL"

        # Annotate each column with its source for transparency in the notebook
        df["_src_oc_confidence"]  = "Level 1 XGBoost output (oc_matches_custom_inc_ml.oc_probability)"
        df["_src_efx_confidence"] = "Level 1 XGBoost output (efx_matches_custom_inc_ml.efx_probability)"
        df["_src_zi_confidence"]  = "Level 1 XGBoost output (zoominfo_matches_custom_inc_ml.zi_probability)"
        df["_src_tru_confidence"] = "Trulioo API → global_trulioo_us_kyb.name_verification"
        df["_src_oc_uids"]        = "OC API → open_corporates_standard_ml_2.industry_code_uids"
        df["_src_efx_naics"]      = "Equifax API → equifax_us_standardized.efx_primnaicscode"
        df["_src_zi_naics"]       = "ZoomInfo API → zoominfo_standard_ml_2.zi_c_naics6"
        df["_src_prod_naics"]     = "Production rule → customer_files.naics_code"

        return df

    def _load_labels_pg(self) -> pd.DataFrame:
        """
        Pull analyst-corrected industry labels from case-service PostgreSQL.
        Priority: manual override > fact-engine resolution.
        Verified against migration 20241111105459.
        """
        sql = f"""
        SELECT
            b.id                                AS business_id,
            n.platform,
            c.code                              AS naics_code,
            c.title                             AS naics_title,
            CASE
                WHEN n.platform = 'manual' THEN 1
                ELSE 2
            END AS priority
        FROM {PG_TABLES["rel_business_industry_naics"]} n
        JOIN {PG_TABLES["data_businesses"]}  b ON b.id = n.business_id
        JOIN {PG_TABLES["core_naics_code"]}  c ON c.id = n.naics_id
        WHERE n.naics_id IS NOT NULL
        ORDER BY b.id, priority
        """
        df = self._query_pg(sql)
        # Keep highest-priority label per business
        df = (
            df.sort_values("priority")
              .groupby("business_id")
              .first()
              .reset_index()
        )
        df["label_source"] = "CASESERVICE_PG"
        return df[["business_id", "naics_code", "label_source"]]

    def _load_labels_proxy_redshift(self) -> pd.DataFrame:
        """
        When case-service PG is unavailable, use the production rule output
        (naics_code already in customer_files) as a proxy training label.
        Weaker than analyst labels but still useful.
        """
        sql = f"""
        SELECT
            business_id,
            naics_code
        FROM {TABLES["customer_files"]}
        WHERE naics_code IS NOT NULL
          AND naics_code ~ '^[0-9]{{6}}$'
        LIMIT 50000
        """
        df = self._query_redshift(sql)
        df["label_source"] = "PROXY_PRODUCTION_RULE"
        return df[["business_id", "naics_code", "label_source"]]

    # ── Synthetic data generator ──────────────────────────────────────────────

    def _load_features_synthetic(self, n: int) -> pd.DataFrame:
        """
        Generate synthetic data that mirrors datascience.customer_files schema.
        Realistic confidence distributions, deterministic labels per company.
        """
        rng_py  = random.Random(SYNTHETIC_RANDOM_SEED)
        np_rng  = np.random.RandomState(SYNTHETIC_RANDOM_SEED)

        rows = []
        for i in range(n):
            tmpl = rng_py.choice(_COMPANY_TEMPLATES)
            name, addr, city, state, jc, sector, is_known = tmpl
            suffix = rng_py.choice(["", " LLC", " INC", " CORP", ""])
            company = f"{name}{suffix}".strip()
            true_naics = rng_py.choice(_SECTOR_NAICS[sector])

            # Match confidences — known companies score higher
            def conf(base_hi, base_lo):
                if is_known:
                    return float(np.clip(np_rng.normal(base_hi, 0.06), 0, 1))
                return float(np.clip(np_rng.normal(base_lo, 0.12), 0, 1))

            oc_conf  = conf(0.88, 0.38)
            efx_conf = conf(0.82, 0.35)
            zi_conf  = conf(0.85, 0.40)
            lib_conf = conf(0.78, 0.30) if state else 0.0

            # Vendor NAICS codes — correct ~75% of the time when well-matched
            def src_naics(c: float) -> str:
                if c >= 0.70 and rng_py.random() < 0.75:
                    return true_naics
                return rng_py.choice(_ALL_NAICS)

            zi_naics  = src_naics(zi_conf)
            efx_naics = src_naics(efx_conf)
            efx_sic   = _EFX_SIC_MAP.get(true_naics, "7389")

            # OC industry_code_uids — pipe-delimited multi-taxonomy
            oc_uids = f"us_naics-{true_naics}"
            if jc in ("gb",) and rng_py.random() < 0.70:
                uk_sic = rng_py.choice(["56101", "62012", "64191", "72200",
                                        "85100", "47190", "41100"])
                oc_uids = f"gb_sic-{uk_sic}|{oc_uids}"
            elif rng_py.random() < 0.05:
                oc_uids += f"|nace-{rng_py.choice(['G4711','J6201','K6419','I5610'])}"

            rows.append({
                "business_id":              f"B{i:06d}",
                "customer_unique_identifier": f"E{i:06d}",
                "company_name":              company,
                "company_address":           addr,
                "company_city":              city,
                "company_state":             state,
                "company_postalcode":        f"{rng_py.randint(10000,99999)}",
                "oc_confidence":             round(oc_conf, 4),
                "efx_confidence":            round(efx_conf, 4),
                "zi_confidence":             round(zi_conf, 4),
                "liberty_confidence":        round(lib_conf, 4),
                "oc_industry_uids":          oc_uids,
                "oc_jurisdiction_code":      jc,
                "efx_naics":                 efx_naics,
                "efx_sic":                   efx_sic,
                "zi_naics":                  zi_naics,
                "production_naics":          zi_naics if zi_conf > efx_conf else efx_naics,
                "zi_match_conf_raw":         round(zi_conf, 4),
                "efx_match_conf_raw":        round(efx_conf, 4),
                "matched_oc_jc":             jc,
                "oc_company_number":         f"OC{i:06d}" if oc_conf >= 0.80 else None,
                "efx_id":                    f"EFX{i:06d}" if efx_conf >= 0.80 else None,
                "zi_company_id":             f"ZI{i:06d}" if zi_conf >= 0.80 else None,
                "zi_location_id":            f"ZIL{i:06d}" if zi_conf >= 0.80 else None,
                "zi_es_location_id":         f"ZIEL{i:06d}" if zi_conf >= 0.80 else None,
                # Synthetic ground truth — deterministic label for training
                "label_naics":               true_naics,
                "_sector":                   sector,
                "_is_known":                 int(is_known),
                "_data_source":              "SYNTHETIC",
            })

        return pd.DataFrame(rows)
