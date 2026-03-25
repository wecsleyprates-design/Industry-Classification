"""
Redshift Connector
==================
Direct connection to the Worth AI Redshift warehouse using the same
psycopg2 pattern as entity_matching/common/utils/redshift_utils.py.

Reads credentials from environment variables:
  REDSHIFT_HOST     — cluster endpoint
  REDSHIFT_PORT     — port (default 5439)
  REDSHIFT_DB       — database name (also accepts REDSHIFT_DBNAME)
  REDSHIFT_USER     — username (also accepts REDSHIFT_IAM)
  REDSHIFT_PASSWORD — password

All four Redshift-backed sources use this module:
  - OpenCorporates  → dev.datascience.open_corporates_standard_ml_2
  - Equifax         → dev.warehouse.equifax_us_standardized
  - ZoomInfo        → dev.datascience.zoominfo_standard_ml_2
  - Liberty Data    → dev.warehouse.liberty_data_standard

When credentials are not available (local dev without VPN, Streamlit Cloud
without secrets), every method returns None gracefully — the data_simulator
then falls back to the simulation layer with SIMULATED status label so the
user always knows what happened.

The app sidebar shows a live connection status indicator.
"""

from __future__ import annotations

import os
import logging
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


# ── Industry field queries per source ─────────────────────────────────────────
# These mirror the SOURCES dict in build_matching_tables.py, but extended
# to also return industry classification fields (not just name/address).

_QUERY_OPENCORPORATES = """
SELECT
    company_number || '|' || jurisdiction_code AS id,
    company_name                               AS business_name,
    street_address,
    postal_code,
    city,
    COALESCE(UPPER(TRIM(region)), 'MISSING')   AS region,
    country_code,
    industry_code_uids                          -- pipe-delimited scheme-code pairs
FROM dev.datascience.open_corporates_standard_ml_2
WHERE UPPER(company_name) LIKE %(name_prefix)s
  AND country_code = %(country_code)s
ORDER BY company_name
LIMIT 25
"""

_QUERY_EQUIFAX = """
SELECT
    cast(efx_id AS varchar)                    AS id,
    efx_name                                   AS business_name,
    efx_eng_address                            AS street_address,
    cast(efx_eng_zipcode AS varchar)           AS postal_code,
    efx_eng_city                               AS city,
    COALESCE(UPPER(TRIM(efx_eng_state)), 'MISSING') AS region,
    'US'                                       AS country_code,
    primnaicscode                               AS naics_code,
    primsic                                    AS sic_code,
    primnaics_sector,
    primnaics_subsector
FROM dev.warehouse.equifax_us_standardized
WHERE UPPER(efx_name) LIKE %(name_prefix)s
ORDER BY efx_name
LIMIT 25
"""

_QUERY_ZOOMINFO = """
SELECT
    zi_c_company_id || '|' || zi_c_location_id AS id,
    zi_c_name                                   AS business_name,
    zi_eng_address                              AS street_address,
    zi_eng_zipcode                              AS postal_code,
    zi_eng_city                                 AS city,
    COALESCE(zi_eng_state, 'MISSING')          AS region,
    country_code,
    zi_c_naics6                                AS naics_code,
    zi_c_sic4                                  AS sic_code,
    zi_c_industry                              AS industry_label
FROM dev.datascience.zoominfo_standard_ml_2
WHERE UPPER(zi_c_name) LIKE %(name_prefix)s
  AND country_code = %(country_code)s
ORDER BY zi_c_name
LIMIT 25
"""

_QUERY_LIBERTY = """
SELECT
    lib_business_id || '|' || ROW_NUMBER() OVER(PARTITION BY lib_business_id) AS id,
    lib_business_name                           AS business_name,
    lib_address                                AS street_address,
    lib_postal_code                            AS postal_code,
    lib_city                                   AS city,
    COALESCE(UPPER(TRIM(lib_state)), 'MISSING') AS region,
    lib_country_code                           AS country_code,
    lib_naics_code                             AS naics_code,
    lib_sic_code                               AS sic_code,
    lib_uk_sic_code,
    lib_industry_description                   AS industry_label,
    lib_business_type
FROM dev.warehouse.liberty_data_standard
WHERE UPPER(lib_business_name) LIKE %(name_prefix)s
  AND lib_country_code = %(country_code)s
ORDER BY lib_business_name
LIMIT 25
"""


@dataclass
class RedshiftRow:
    """A single row returned from a Redshift entity lookup."""
    source: str
    row_id: str
    business_name: str
    country_code: str
    naics_code: Optional[str] = None
    sic_code: Optional[str] = None
    uk_sic_code: Optional[str] = None
    industry_code_uids: Optional[str] = None   # OpenCorporates pipe-delimited
    industry_label: Optional[str] = None
    match_confidence: float = 0.0              # set by entity matching later
    region: Optional[str] = None


class RedshiftConnector:
    """
    Queries Redshift classification tables directly via psycopg2.

    Usage
    -----
    rc = RedshiftConnector()
    if rc.is_connected:
        rows = rc.lookup_opencorporates("Apple", "US")
    else:
        # credentials not available — use simulation fallback
        pass
    """

    def __init__(self) -> None:
        self._conn = None
        self._available = False
        self._error_msg: str = ""
        self._try_connect()

    def _try_connect(self) -> None:
        host     = os.getenv("REDSHIFT_HOST", "")
        port     = os.getenv("REDSHIFT_PORT", "5439")
        dbname   = os.getenv("REDSHIFT_DB") or os.getenv("REDSHIFT_DBNAME", "")
        user     = os.getenv("REDSHIFT_USER") or os.getenv("REDSHIFT_IAM", "")
        password = os.getenv("REDSHIFT_PASSWORD", "")

        missing = [k for k, v in {
            "REDSHIFT_HOST": host,
            "REDSHIFT_DB":   dbname,
            "REDSHIFT_USER": user,
            "REDSHIFT_PASSWORD": password,
        }.items() if not v]

        if missing:
            self._error_msg = (
                f"Redshift credentials not set: {', '.join(missing)}. "
                f"Using simulation fallback."
            )
            logger.info(self._error_msg)
            return

        try:
            import psycopg2
            self._conn = psycopg2.connect(
                host=host, port=int(port), dbname=dbname,
                user=user, password=password,
                connect_timeout=8,
            )
            self._conn.autocommit = True
            self._available = True
            logger.info("Redshift connection established.")
        except Exception as exc:
            self._error_msg = f"Redshift connection failed: {exc}. Using simulation fallback."
            logger.warning(self._error_msg)

    @property
    def is_connected(self) -> bool:
        return self._available and self._conn is not None

    @property
    def connection_status(self) -> str:
        if self.is_connected:
            host = os.getenv("REDSHIFT_HOST", "?")
            return f"LIVE — connected to {host}"
        return f"SIMULATED — {self._error_msg}"

    def _run(self, sql: str, params: dict) -> list[dict]:
        if not self.is_connected:
            return []
        try:
            with self._conn.cursor() as cur:
                cur.execute(sql, params)
                cols = [d[0] for d in cur.description]
                return [dict(zip(cols, row)) for row in cur.fetchall()]
        except Exception as exc:
            logger.warning(f"Redshift query failed: {exc}")
            return []

    def _name_prefix(self, company_name: str, prefix_len: int = 4) -> str:
        """Build SQL LIKE prefix from the first N chars of canonical name."""
        from entity_lookup import _canonize
        canon = _canonize(company_name)
        prefix = canon[:prefix_len].upper() if len(canon) >= prefix_len else canon.upper()
        return prefix + "%"

    def _best_row(self, rows: list[dict], company_name: str) -> Optional[dict]:
        """Pick best matching row using rapidfuzz against business_name."""
        if not rows:
            return None
        if len(rows) == 1:
            return rows[0]
        try:
            from rapidfuzz import fuzz, process as rfprocess
            from entity_lookup import _canonize
            canon = _canonize(company_name)
            names = [_canonize(r.get("business_name", "")) for r in rows]
            _, score, idx = rfprocess.extractOne(canon, names, scorer=fuzz.token_set_ratio)
            if score >= 72:
                return rows[idx]
        except Exception:
            pass
        return rows[0]   # fallback: first result

    def _compute_confidence(self, row: Optional[dict], company_name: str) -> float:
        """Estimate match confidence from name similarity (mirrors entity_matching XGBoost)."""
        if row is None:
            return 0.0
        try:
            from rapidfuzz import fuzz
            from entity_lookup import _canonize
            score = fuzz.token_set_ratio(
                _canonize(company_name),
                _canonize(row.get("business_name", "")),
            )
            return round(score / 100.0, 3)
        except Exception:
            return 0.70

    # ── Public lookup methods ─────────────────────────────────────────────────

    def lookup_opencorporates(
        self, company_name: str, country_code: str = "US"
    ) -> Optional[RedshiftRow]:
        rows = self._run(_QUERY_OPENCORPORATES, {
            "name_prefix": self._name_prefix(company_name),
            "country_code": country_code.upper(),
        })
        best = self._best_row(rows, company_name)
        if not best:
            return None
        conf = self._compute_confidence(best, company_name)
        return RedshiftRow(
            source="opencorporates",
            row_id=str(best.get("id", "")),
            business_name=str(best.get("business_name", "")),
            country_code=str(best.get("country_code", "")),
            industry_code_uids=best.get("industry_code_uids"),
            match_confidence=conf,
            region=best.get("region"),
        )

    def lookup_equifax(
        self, company_name: str, country_code: str = "US"
    ) -> Optional[RedshiftRow]:
        if country_code.upper() != "US":
            return None   # Equifax US-only
        rows = self._run(_QUERY_EQUIFAX, {
            "name_prefix": self._name_prefix(company_name),
            "country_code": "US",
        })
        best = self._best_row(rows, company_name)
        if not best:
            return None
        conf = self._compute_confidence(best, company_name)
        return RedshiftRow(
            source="equifax",
            row_id=str(best.get("id", "")),
            business_name=str(best.get("business_name", "")),
            country_code="US",
            naics_code=best.get("naics_code") or best.get("primnaicscode"),
            sic_code=best.get("sic_code") or best.get("primsic"),
            industry_label=best.get("primnaics_sector"),
            match_confidence=conf,
            region=best.get("region"),
        )

    def lookup_zoominfo(
        self, company_name: str, country_code: str = "US"
    ) -> Optional[RedshiftRow]:
        rows = self._run(_QUERY_ZOOMINFO, {
            "name_prefix": self._name_prefix(company_name),
            "country_code": country_code.upper(),
        })
        best = self._best_row(rows, company_name)
        if not best:
            return None
        conf = self._compute_confidence(best, company_name)
        return RedshiftRow(
            source="zoominfo",
            row_id=str(best.get("id", "")),
            business_name=str(best.get("business_name", "")),
            country_code=str(best.get("country_code", "")),
            naics_code=best.get("naics_code") or best.get("zi_c_naics6"),
            sic_code=best.get("sic_code") or best.get("zi_c_sic4"),
            industry_label=best.get("industry_label") or best.get("zi_c_industry"),
            match_confidence=conf,
            region=best.get("region"),
        )

    def lookup_liberty_data(
        self, company_name: str, country_code: str = "US"
    ) -> Optional[RedshiftRow]:
        rows = self._run(_QUERY_LIBERTY, {
            "name_prefix": self._name_prefix(company_name),
            "country_code": country_code.upper(),
        })
        best = self._best_row(rows, company_name)
        if not best:
            return None
        conf = self._compute_confidence(best, company_name)
        return RedshiftRow(
            source="liberty_data",
            row_id=str(best.get("id", "")),
            business_name=str(best.get("business_name", "")),
            country_code=str(best.get("country_code", "")),
            naics_code=best.get("naics_code") or best.get("lib_naics_code"),
            sic_code=best.get("sic_code") or best.get("lib_sic_code"),
            uk_sic_code=best.get("uk_sic_code") or best.get("lib_uk_sic_code"),
            industry_label=best.get("industry_label") or best.get("lib_industry_description"),
            match_confidence=conf,
            region=best.get("region"),
        )

    def close(self) -> None:
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass


# ── Module-level singleton — created once, reused across requests ─────────────
_connector: Optional[RedshiftConnector] = None


def get_connector() -> RedshiftConnector:
    global _connector
    if _connector is None:
        _connector = RedshiftConnector()
    return _connector


def parse_opencorporates_uid(industry_code_uids: str) -> dict[str, str]:
    """
    Parse OpenCorporates pipe-delimited industry_code_uids into a dict.
    e.g. "us_naics-541110|uk_sic-62012|ca_naics-541110"
      → {"us_naics": "541110", "uk_sic": "62012", "ca_naics": "541110"}
    """
    result: dict[str, str] = {}
    if not industry_code_uids:
        return result
    for uid in industry_code_uids.split("|"):
        uid = uid.strip()
        if "-" in uid:
            scheme, code = uid.split("-", 1)
            result[scheme.strip()] = code.strip()
    return result


def best_naics_from_opencorporates(industry_code_uids: str) -> Optional[str]:
    parsed = parse_opencorporates_uid(industry_code_uids)
    for key in parsed:
        if "us_naics" in key:
            return parsed[key]
    return None


def best_uk_sic_from_opencorporates(industry_code_uids: str) -> Optional[str]:
    parsed = parse_opencorporates_uid(industry_code_uids)
    for key in parsed:
        if "gb_sic" in key or "uk_sic" in key:
            return parsed[key]
    return None
