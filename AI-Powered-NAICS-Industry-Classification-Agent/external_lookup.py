"""
External Registry Lookup
========================
Queries free public registries to retrieve authoritative industry
classification codes BEFORE passing them to the LLM.

Sources implemented:
  1. SEC EDGAR   — US companies (free, no API key required)
                   Returns: SIC code + description, state of incorporation,
                   company type, ticker, former names
                   Coverage: US public companies (SEC filers)
                   Rate limit: 10 req/sec — we use a 0.15s sleep

  2. Companies House — UK registered companies (free, API key optional)
                   Returns: SIC codes[] (up to 4), company type, status,
                   date of incorporation, registered office address
                   Coverage: All UK registered companies
                   Rate limit: 600 req/5min — generous

Both sources degrade gracefully — return None when:
  - Company not found in the registry
  - Network/timeout error
  - API key not set (Companies House only)

The results are passed directly into the LLM classification prompt as
"AUTHORITATIVE REGISTRY DATA", giving the LLM ground-truth anchors
from the companies' own regulatory filings rather than inferring from
web search results alone.

Environment variables:
  COMPANIES_HOUSE_API_KEY  — optional; enables Companies House lookup
                             (free key from https://developer.company-information.service.gov.uk/)
"""

from __future__ import annotations

import os
import time
import logging
from dataclasses import dataclass, field
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# ── HTTP session with retry ────────────────────────────────────────────────────
def _make_session(retries: int = 3) -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=retries,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session

_session = _make_session()

# ── User-Agent required by SEC EDGAR ─────────────────────────────────────────
_EDGAR_HEADERS = {
    "User-Agent": "WorthAI-Classification-Engine contact@worthai.com",
    "Accept-Encoding": "gzip, deflate",
    "Host": "efts.sec.gov",
}
_EDGAR_SUBMISSION_HEADERS = {
    "User-Agent": "WorthAI-Classification-Engine contact@worthai.com",
    "Accept-Encoding": "gzip, deflate",
}

COMPANIES_HOUSE_API_KEY = os.getenv("COMPANIES_HOUSE_API_KEY", "")


# ── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class EdgarResult:
    """SEC EDGAR company data — authoritative US government SIC filing."""
    cik: str
    name: str                        # official SEC-registered name
    sic: str                         # 4-digit US SIC 1987 code
    sic_description: str             # e.g. "Electronic Computers"
    entity_type: str                 # e.g. "operating", "investment company"
    state_of_incorporation: str      # e.g. "CA", "DE"
    former_names: list[str] = field(default_factory=list)
    ticker: Optional[str] = None
    ein: Optional[str] = None
    source: str = "sec_edgar"
    url: str = ""

    @property
    def classification_line(self) -> str:
        """One-line summary for injection into LLM prompt."""
        ticker_str = f" ({self.ticker})" if self.ticker else ""
        state_str  = f", incorporated in {self.state_of_incorporation}" if self.state_of_incorporation else ""
        return (
            f"SEC EDGAR filing{ticker_str}: SIC {self.sic} — {self.sic_description}"
            f"{state_str}. Entity type: {self.entity_type}."
        )


@dataclass
class CompaniesHouseResult:
    """Companies House UK company data — authoritative UK registry filing."""
    company_number: str
    name: str
    sic_codes: list[str]             # up to 4 SIC codes e.g. ["62012", "62020"]
    sic_descriptions: list[str]      # descriptions for each SIC code
    company_type: str                # e.g. "ltd", "plc", "llp"
    company_status: str              # e.g. "active", "dissolved"
    date_of_creation: Optional[str] = None
    registered_office_address: Optional[str] = None
    source: str = "companies_house"
    url: str = ""

    @property
    def classification_line(self) -> str:
        """One-line summary for injection into LLM prompt."""
        if not self.sic_codes:
            return f"Companies House: {self.name} — no SIC codes on file."
        codes_str = ", ".join(
            f"{c} — {d}" for c, d in zip(self.sic_codes, self.sic_descriptions)
        )
        return (
            f"Companies House UK filing: SIC codes [{codes_str}]. "
            f"Company type: {self.company_type}, Status: {self.company_status}."
        )


# ── SIC descriptions (SEC EDGAR returns numeric code only) ────────────────────
# Subset of common codes; the lookup fills in from the SEC response field
# `sicDescription` which is included in the JSON directly.
_SIC_DESCRIPTIONS: dict[str, str] = {
    "3571": "Electronic Computers",
    "3672": "Printed Circuit Boards",
    "7372": "Prepackaged Software",
    "7374": "Computer Processing and Data Preparation",
    "5812": "Eating and Drinking Places",
    "6022": "State Commercial Banks",
    "6020": "National Commercial Banks",
    "6211": "Security Brokers and Dealers",
    "5411": "Grocery Stores",
    "7011": "Hotels and Motels",
    "4911": "Electric Services",
    "2911": "Petroleum Refining",
    "3711": "Motor Vehicles and Passenger Car Bodies",
    "3721": "Aircraft",
    "8011": "Offices and Clinics of Doctors of Medicine",
    "4813": "Telephone Communications",
    "6726": "Investment Offices",
    "5961": "Catalog and Mail-Order Houses",
    "4512": "Air Transportation",
    "3825": "Instruments for Measuring",
}


# ── SEC EDGAR Connector ───────────────────────────────────────────────────────

class EdgarConnector:
    """
    Queries SEC EDGAR for US company SIC classification.

    No API key needed. Rate-limited to 10 req/sec by SEC policy.
    Uses the EDGAR full-text search to find CIK from company name,
    then fetches the company submission JSON.
    """

    SEARCH_URL      = "https://efts.sec.gov/LATEST/search-index"
    SUBMISSION_URL  = "https://data.sec.gov/submissions/CIK{cik}.json"
    TICKER_URL      = "https://www.sec.gov/files/company_tickers.json"

    # Cached ticker→CIK map (loaded once)
    _ticker_map: Optional[dict] = None

    def lookup(self, company_name: str, jurisdiction: str = "us") -> Optional[EdgarResult]:
        """
        Look up a company in SEC EDGAR by name.
        Returns None if not a US jurisdiction or company not found.
        """
        # Only applicable for US jurisdictions
        if not jurisdiction.lower().startswith("us"):
            return None

        cik = self._find_cik(company_name)
        if not cik:
            return None

        return self._fetch_submission(cik)

    def _find_cik(self, company_name: str) -> Optional[str]:
        """Search EDGAR full-text search for company name → CIK."""
        try:
            time.sleep(0.15)   # SEC rate limit: 10 req/sec
            resp = _session.get(
                self.SEARCH_URL,
                params={
                    "q": f'"{company_name}"',
                    "dateRange": "custom",
                    "startdt": "2020-01-01",
                    "forms": "10-K",
                },
                headers={"User-Agent": "WorthAI-Classification-Engine contact@worthai.com"},
                timeout=8,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            hits = data.get("hits", {}).get("hits", [])
            if not hits:
                return self._find_cik_by_ticker_map(company_name)

            # Take first hit's entity_id (which is the CIK, zero-padded to 10)
            first_hit = hits[0]
            entity_id = first_hit.get("_source", {}).get("entity_id", "")
            if entity_id:
                return str(entity_id).zfill(10)

            return self._find_cik_by_ticker_map(company_name)

        except Exception as exc:
            logger.debug(f"EDGAR search failed for '{company_name}': {exc}")
            return None

    def _find_cik_by_ticker_map(self, company_name: str) -> Optional[str]:
        """Fallback: search the company_tickers.json bulk file."""
        try:
            if self._ticker_map is None:
                time.sleep(0.15)
                resp = _session.get(
                    self.TICKER_URL,
                    headers={"User-Agent": "WorthAI-Classification-Engine contact@worthai.com"},
                    timeout=8,
                )
                if resp.status_code == 200:
                    EdgarConnector._ticker_map = resp.json()
                else:
                    EdgarConnector._ticker_map = {}

            name_lower = company_name.lower().replace(",", "").replace(".", "").replace(" inc", "").replace(" corp", "").strip()
            for entry in (self._ticker_map or {}).values():
                entry_name = entry.get("title", "").lower().replace(",", "").replace(".", "").replace(" inc", "").replace(" corp", "").strip()
                if name_lower == entry_name or name_lower in entry_name:
                    cik = str(entry.get("cik_str", "")).zfill(10)
                    return cik
        except Exception as exc:
            logger.debug(f"EDGAR ticker map fallback failed: {exc}")
        return None

    def _fetch_submission(self, cik: str) -> Optional[EdgarResult]:
        """Fetch company submission JSON from data.sec.gov."""
        try:
            time.sleep(0.15)
            url = self.SUBMISSION_URL.format(cik=cik)
            resp = _session.get(
                url,
                headers=_EDGAR_SUBMISSION_HEADERS,
                timeout=8,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            sic         = str(data.get("sic", "") or "")
            sic_desc    = str(data.get("sicDescription", "") or _SIC_DESCRIPTIONS.get(sic, ""))
            name        = str(data.get("name", "") or "")
            entity_type = str(data.get("entityType", "") or "")
            state       = str(data.get("stateOfIncorporation", "") or "")
            tickers     = data.get("tickers", [])
            ticker      = tickers[0] if tickers else None
            ein         = str(data.get("ein", "") or "")

            former_names = [
                fn.get("name", "") for fn in data.get("formerNames", [])
                if fn.get("name")
            ]

            if not sic:
                return None   # No industry code → not useful

            return EdgarResult(
                cik=cik,
                name=name,
                sic=sic,
                sic_description=sic_desc,
                entity_type=entity_type,
                state_of_incorporation=state,
                former_names=former_names,
                ticker=ticker,
                ein=ein,
                url=f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}",
            )
        except Exception as exc:
            logger.debug(f"EDGAR submission fetch failed for CIK {cik}: {exc}")
            return None


# ── Companies House Connector ────────────────────────────────────────────────

class CompaniesHouseConnector:
    """
    Queries Companies House (UK) for SIC codes.

    Free API key available at:
      https://developer.company-information.service.gov.uk/

    Set COMPANIES_HOUSE_API_KEY environment variable.
    Without a key, this connector returns None gracefully.
    Coverage: all UK registered companies (limited partnerships, LLPs, etc.)
    """

    SEARCH_URL  = "https://api.company-information.service.gov.uk/search/companies"
    COMPANY_URL = "https://api.company-information.service.gov.uk/company/{number}"

    # Cached SIC description lookup (from Companies House open data)
    _SIC_DESC_URL = "https://raw.githubusercontent.com/companieshouse/sic-code-data/main/sic_codes.json"
    _sic_desc_map: Optional[dict] = None

    def lookup(self, company_name: str, jurisdiction: str = "gb") -> Optional[CompaniesHouseResult]:
        """
        Look up a UK company. Returns None if not GB jurisdiction,
        key not set, or company not found.
        """
        jc_lower = jurisdiction.lower()
        if not any(jc_lower.startswith(p) for p in ("gb", "gg", "je", "uk")):
            return None

        if not COMPANIES_HOUSE_API_KEY:
            logger.debug("COMPANIES_HOUSE_API_KEY not set — skipping Companies House lookup")
            return None

        company_number = self._search(company_name)
        if not company_number:
            return None

        return self._fetch_company(company_number)

    def _search(self, company_name: str) -> Optional[str]:
        """Search by company name, return company_number."""
        try:
            resp = _session.get(
                self.SEARCH_URL,
                params={"q": company_name, "items_per_page": 5},
                auth=(COMPANIES_HOUSE_API_KEY, ""),
                timeout=8,
            )
            if resp.status_code != 200:
                return None

            items = resp.json().get("items", [])
            if not items:
                return None

            # Fuzzy match: pick item whose title best matches company_name
            from rapidfuzz import fuzz
            from entity_lookup import _canonize
            canon = _canonize(company_name)
            best_num, best_score = None, 0
            for item in items:
                title = _canonize(item.get("title", ""))
                score = fuzz.token_set_ratio(canon, title)
                if score > best_score:
                    best_score = score
                    best_num = item.get("company_number")

            return best_num if best_score >= 65 else None
        except Exception as exc:
            logger.debug(f"Companies House search failed for '{company_name}': {exc}")
            return None

    def _fetch_company(self, company_number: str) -> Optional[CompaniesHouseResult]:
        """Fetch company profile including SIC codes."""
        try:
            resp = _session.get(
                self.COMPANY_URL.format(number=company_number),
                auth=(COMPANIES_HOUSE_API_KEY, ""),
                timeout=8,
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            sic_codes   = data.get("sic_codes", [])
            name        = data.get("company_name", "")
            co_type     = data.get("type", "")
            status      = data.get("company_status", "")
            created     = data.get("date_of_creation", "")

            addr_obj    = data.get("registered_office_address", {})
            addr_parts  = [
                addr_obj.get("address_line_1", ""),
                addr_obj.get("locality", ""),
                addr_obj.get("postal_code", ""),
            ]
            addr_str    = ", ".join(p for p in addr_parts if p)

            # Resolve SIC descriptions
            sic_descs   = [self._sic_description(c) for c in sic_codes]

            return CompaniesHouseResult(
                company_number=company_number,
                name=name,
                sic_codes=sic_codes,
                sic_descriptions=sic_descs,
                company_type=co_type,
                company_status=status,
                date_of_creation=created,
                registered_office_address=addr_str,
                url=f"https://find-and-update.company-information.service.gov.uk/company/{company_number}",
            )
        except Exception as exc:
            logger.debug(f"Companies House profile fetch failed for {company_number}: {exc}")
            return None

    def _sic_description(self, code: str) -> str:
        """Get description for a UK SIC code from local CSV or cache."""
        # First try our local taxonomy CSV
        try:
            from config import DATA_DIR
            import csv, os
            csv_path = os.path.join(DATA_DIR, "uk_sic_2007.csv")
            if os.path.exists(csv_path):
                with open(csv_path) as f:
                    for row in csv.DictReader(f):
                        if row.get("code", "").strip() == code.strip():
                            return row.get("description", code)
        except Exception:
            pass
        return code   # fallback: just return the code


# ── Module-level singletons ───────────────────────────────────────────────────
_edgar = EdgarConnector()
_ch    = CompaniesHouseConnector()


@dataclass
class ExternalRegistryData:
    """Combined result from all external registry lookups."""
    edgar:           Optional[EdgarResult]           = None
    companies_house: Optional[CompaniesHouseResult]  = None

    @property
    def found_anything(self) -> bool:
        return self.edgar is not None or self.companies_house is not None

    def to_prompt_block(self) -> str:
        """
        Format all registry data as a structured block for LLM prompt injection.
        Returns empty string if nothing was found.
        """
        lines = []
        if self.edgar:
            lines.append(f"  • {self.edgar.classification_line}")
            if self.edgar.former_names:
                lines.append(f"    Former names: {', '.join(self.edgar.former_names[:3])}")
        if self.companies_house:
            lines.append(f"  • {self.companies_house.classification_line}")
            if self.companies_house.date_of_creation:
                lines.append(f"    Incorporated: {self.companies_house.date_of_creation}")

        if not lines:
            return ""
        return "AUTHORITATIVE REGISTRY DATA (official government filings):\n" + "\n".join(lines)

    def to_dict(self) -> dict:
        """Serialisable dict for UI display and debugging."""
        result = {}
        if self.edgar:
            result["sec_edgar"] = {
                "name":              self.edgar.name,
                "cik":               self.edgar.cik,
                "sic":               self.edgar.sic,
                "sic_description":   self.edgar.sic_description,
                "entity_type":       self.edgar.entity_type,
                "state":             self.edgar.state_of_incorporation,
                "ticker":            self.edgar.ticker,
                "former_names":      self.edgar.former_names,
                "url":               self.edgar.url,
            }
        if self.companies_house:
            result["companies_house"] = {
                "name":              self.companies_house.name,
                "company_number":    self.companies_house.company_number,
                "sic_codes":         self.companies_house.sic_codes,
                "sic_descriptions":  self.companies_house.sic_descriptions,
                "type":              self.companies_house.company_type,
                "status":            self.companies_house.company_status,
                "incorporated":      self.companies_house.date_of_creation,
                "url":               self.companies_house.url,
            }
        return result


def lookup_all(
    company_name: str,
    jurisdiction: str,
    timeout_per_source: float = 10.0,
) -> ExternalRegistryData:
    """
    Run all applicable external registry lookups for a company.
    Each source is tried independently — one failure doesn't affect others.

    Args:
        company_name:  raw company name (not canonised — we need it for search)
        jurisdiction:  OpenCorporates jurisdiction code (us, us_mo, gb, de…)
        timeout_per_source: per-source timeout in seconds (not enforced internally
                            — use this to skip sources if overall latency matters)

    Returns:
        ExternalRegistryData with results from each applicable source.
        Unreachable / not-found sources return None in their field.
    """
    result = ExternalRegistryData()

    jc = jurisdiction.lower().strip()

    # SEC EDGAR — US jurisdictions only
    if jc.startswith("us") or jc in ("pr", "gu", "vi"):
        try:
            result.edgar = _edgar.lookup(company_name, jc)
            if result.edgar:
                logger.info(f"EDGAR found: {result.edgar.name} SIC={result.edgar.sic}")
        except Exception as exc:
            logger.warning(f"EDGAR lookup error: {exc}")

    # Companies House — GB jurisdictions only
    if jc in ("gb", "gb_eng", "gb_sct", "gb_wls", "gb_nir", "gg", "je", "uk"):
        try:
            result.companies_house = _ch.lookup(company_name, jc)
            if result.companies_house:
                logger.info(f"Companies House found: {result.companies_house.name} SIC={result.companies_house.sic_codes}")
        except Exception as exc:
            logger.warning(f"Companies House lookup error: {exc}")

    return result
