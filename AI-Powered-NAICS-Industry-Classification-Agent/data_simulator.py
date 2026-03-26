"""
Data Simulator — Multi-Source Classification Signal Layer
==========================================================
Provides classification signals from two tiers:

TIER 1 — REAL REDSHIFT SOURCES (live when credentials are set)
  These query the same Redshift tables as build_matching_tables.py.
  When REDSHIFT_HOST / REDSHIFT_USER / REDSHIFT_PASSWORD / REDSHIFT_DB
  are set as environment variables, signals come from real data.

  • OpenCorporates  → dev.datascience.open_corporates_standard_ml_2
  • Equifax         → dev.warehouse.equifax_us_standardized
  • ZoomInfo        → dev.datascience.zoominfo_standard_ml_2
  • Liberty Data    → dev.warehouse.liberty_data_standard

TIER 2 — SIMULATED (always, or when Redshift creds are missing)
  • Trulioo         — live API call required (key needed)
  • AI Semantic     — uses OpenAI + DuckDuckGo (already wired)
  • Fallback        — when a Redshift source returns no result

The fetch() method always returns a complete VendorBundle regardless of
which tier each source falls into. The SourceSignal.status field tells
you exactly what happened:
  MATCHED    = real Redshift record found with high confidence
  INFERRED   = no database record; signal derived from simulation/AI
  CONFLICT   = real record found but disagrees with majority
  POLLUTED   = data quality issue detected
  SIMULATED  = Redshift creds not available; using simulation fallback

The source_registry.py file lists the REDSHIFT credentials needed and
the production SQL for each source.

Jurisdiction codes accepted:
  us_mo, ca_bc, ae_az, gb, de, th, tz, gg, je, pr … (200+ codes)
"""

from __future__ import annotations

import random
import hashlib
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta

import jurisdiction_registry as JR

# ── Simulated code crosswalk pools ───────────────────────────────────────────
# These represent the realistic distributions that vendors return.

_NAICS_POOL = [
    ("722511", "Full-Service Restaurants"),
    ("722513", "Limited-Service Restaurants"),
    ("722515", "Snack and Nonalcoholic Beverage Bars"),
    ("722310", "Food Service Contractors"),
    ("424420", "Packaged Frozen Food Merchant Wholesalers"),
    ("445110", "Supermarkets and Other Grocery Retailers"),
    ("445131", "Convenience Retailers"),
    ("541511", "Custom Computer Programming Services"),
    ("541512", "Computer Systems Design Services"),
    ("518210", "Data Processing and Hosting Services"),
    ("511210", "Software Publishers"),
    ("551112", "Offices of Other Holding Companies"),
    ("522110", "Commercial Banking"),
    ("524126", "Direct Property and Casualty Insurance Carriers"),
    ("531110", "Lessors of Residential Buildings"),
    ("531210", "Offices of Real Estate Agents"),
    ("423610", "Electrical Apparatus and Equipment Merchant Wholesalers"),
    ("423690", "Other Electronic Parts and Equipment Merchant Wholesalers"),
    ("336411", "Aircraft Manufacturing"),
    ("622110", "General Medical and Surgical Hospitals"),
    ("541110", "Offices of Lawyers"),
    ("541211", "Offices of Certified Public Accountants"),
    ("813110", "Religious Organizations"),
    ("611310", "Colleges Universities and Professional Schools"),
    ("236220", "Commercial and Institutional Building Construction"),
    ("484110", "General Freight Trucking Local"),
    ("711110", "Theater Companies and Dinner Theaters"),
    ("713940", "Fitness and Recreational Sports Centers"),
    ("441110", "New Car Dealers"),
    ("812112", "Beauty Salons"),
]

_UK_SIC_POOL = [
    ("56101", "Licensed restaurants"),
    ("56102", "Unlicensed restaurants and cafes"),
    ("56103", "Take-away food shops and mobile food stands"),
    ("56301", "Licensed clubs"),
    ("56302", "Public houses and bars"),
    ("62012", "Business and domestic software development"),
    ("62020", "Information technology consultancy activities"),
    ("63110", "Data processing hosting and related activities"),
    ("64209", "Activities of other holding companies nec"),
    ("64191", "Banks"),
    ("65110", "Life insurance"),
    ("68310", "Real estate agencies"),
    ("70229", "Management consultancy activities"),
    ("86101", "Hospital activities"),
    ("85421", "First-degree level higher education"),
    ("47110", "Retail sale in non-specialised stores"),
    ("46342", "Wholesale of wine beer spirits and other alcoholic beverages"),
    ("41201", "Construction of commercial buildings"),
    ("49410", "Freight transport by road"),
    ("90010", "Performing arts"),
]

_US_SIC_POOL = [
    ("5812", "Eating and Drinking Places"),
    ("5411", "Grocery Stores"),
    ("7372", "Computer Programming Integrated Systems Design"),
    ("6726", "Investment Offices"),
    ("6020", "State Commercial Banks"),
    ("6311", "Life Insurance"),
    ("6531", "Real Estate Dealers"),
    ("8062", "Hospitals"),
    ("8111", "Legal Services"),
    ("7371", "Computer Programming Services"),
    ("5065", "Electronic Parts and Equipment"),
    ("4213", "Trucking except Local"),
    ("1521", "General Building Contractors"),
    ("7941", "Professional Sports Clubs"),
    ("7011", "Hotels and Motels"),
]

_NACE_POOL = [
    ("I56", "Food and beverage service activities"),
    ("J62", "Computer programming consultancy and related activities"),
    ("K64", "Financial service activities"),
    ("L68", "Real estate activities"),
    ("M70", "Activities of head offices and management consultancy"),
    ("Q86", "Human health activities"),
    ("P85", "Education"),
    ("G47", "Retail trade"),
    ("H49", "Land transport and transport via pipelines"),
    ("F41", "Construction of buildings"),
]

_MCC_POOL = [
    ("5812", "Eating Places Restaurants"),
    ("5814", "Fast Food Restaurants"),
    ("5411", "Grocery Stores Supermarkets"),
    ("7372", "Computer Programming Integrated Systems Design and Data Processing"),
    ("6099", "Financial Institutions Not Elsewhere Classified"),
    ("8011", "Offices and Clinics of Doctors of Medicine"),
    ("8111", "Legal Services and Attorneys"),
    ("7011", "Lodging Hotels Motels Resorts"),
    ("5045", "Computers Computer Peripheral Equipment Software"),
    ("5065", "Electronic Parts and Equipment Not Elsewhere Classified"),
    ("6300", "Insurance Sales Underwriting and Premiums"),
    ("6531", "Real Estate Agents and Managers"),
]


@dataclass
class SourceSignal:
    source: str
    raw_code: str
    taxonomy: str            # e.g. "US_NAICS_2022"
    label: str
    weight: float            # source reliability weight
    status: str              # MATCHED | POLLUTED | INFERRED | CONFLICT | UNAVAILABLE
    confidence: float        # 0.0–1.0
    retrieved_at: str        # ISO-8601 timestamp
    digit_count: int = 0     # for Trulioo pollution detection

    def __post_init__(self) -> None:
        self.digit_count = len(str(self.raw_code).replace("-", "").replace("_", ""))


@dataclass
class TemporalRecord:
    """Historical classification snapshot from a prior API call."""
    taxonomy: str
    code: str
    label: str
    source: str
    retrieved_at: str


@dataclass
class VendorBundle:
    """All raw vendor signals for a single entity."""
    business_id: str
    company_name: str
    jurisdiction: str
    entity_type: str
    signals: list[SourceSignal] = field(default_factory=list)
    history: list[TemporalRecord] = field(default_factory=list)
    web_summary: str = ""
    registry_label: str = ""
    registry_code: str = ""
    registry_taxonomy: str = ""

    @property
    def source_lineage(self) -> dict:
        return {
            s.source: {
                "value": f"{s.taxonomy.lower()}-{s.raw_code}",
                "label": s.label,
                "weight": s.weight,
                "status": s.status,
                "confidence": s.confidence,
            }
            for s in self.signals
        }


def _jitter(base: float, spread: float = 0.1) -> float:
    return min(1.0, max(0.0, base + random.uniform(-spread, spread)))


def _pick(pool: list[tuple[str, str]], seed_idx: int) -> tuple[str, str]:
    """Deterministically pick from pool using a seed, then jitter."""
    return pool[seed_idx % len(pool)]


def _ts(days_ago: int = 0) -> str:
    dt = datetime.utcnow() - timedelta(days=days_ago)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class DataSimulator:
    """
    Simulates multi-source vendor API responses for a given company.

    In production, each `_call_*` method would be replaced by a real
    HTTP request to the respective data provider.
    """

    def __init__(self, base_weights: Optional[dict] = None) -> None:
        from config import SOURCE_WEIGHTS
        self.weights = dict(base_weights or SOURCE_WEIGHTS)
        # Liberty Data default weight (not in config yet)
        self.weights.setdefault("liberty_data", 0.78)

    # ── Public API ────────────────────────────────────────────────────────────

    def fetch(
        self,
        company_name: str,
        address: str = "",
        country: str = "",
        jurisdiction: str = "US",
        entity_type: str = "Operating",
        web_summary: str = "",
        force_conflict: bool = False,
    ) -> VendorBundle:
        """
        Simulate a complete multi-vendor data fetch.

        For well-known companies: first performs an Entity Matching lookup
        (simulating the Redshift + XGBoost matching pipeline from
        entity_matching/core/matchers/matching_v1.py). If found, uses the
        real industry codes from OpenCorporates, Equifax, and ZoomInfo.

        For unknown companies: falls back to random-pool simulation.
        `force_conflict` injects a holding-company code to stress-test
        the discrepancy detection pipeline.
        """
        from entity_lookup import lookup_entity
        seed = int(hashlib.md5(company_name.encode()).hexdigest(), 16)
        random.seed(seed)

        # ── Entity Matching lookup (Redshift simulation) ───────────────────────
        em_result = lookup_entity(company_name, address, country)
        if em_result.found and not force_conflict:
            # Use jurisdiction hint from known-entity table if not overridden
            if em_result.jurisdiction_hint and jurisdiction in ("US", "us"):
                jurisdiction = em_result.jurisdiction_hint
            if em_result.entity_type:
                entity_type = em_result.entity_type

        bundle = VendorBundle(
            business_id=f"sim-{seed % 1_000_000:08d}",
            company_name=company_name,
            jurisdiction=jurisdiction,
            entity_type=entity_type,
            web_summary=web_summary,
        )

        if em_result.found and not force_conflict:
            # ── Known entity: use Redshift/entity-matching results ─────────────
            oc = self._signal_from_record(em_result.opencorporates, "opencorporates",
                                          self.weights["opencorporates"])
            eq = self._signal_from_record(em_result.equifax, "equifax",
                                          self.weights["equifax"])
            zi = self._signal_from_record(em_result.zoominfo, "zoominfo",
                                          self.weights["zoominfo"])
            # Liberty Data: derive from opencorporates record for known entities
            ld = self._liberty_data_from_known(em_result.opencorporates, seed)
            bundle.signals.append(oc)
            bundle.signals.append(eq)
            bundle.signals.append(self._call_trulioo(seed, jurisdiction))
            bundle.signals.append(zi)
            bundle.signals.append(ld)
            bundle.signals.append(self._call_ai_semantic(seed, web_summary))
            bundle.registry_label = oc.label
            bundle.registry_code  = oc.raw_code
            bundle.registry_taxonomy = oc.taxonomy
            bundle.history = self._stable_history(oc.raw_code, oc.label, oc.taxonomy)
        else:
            # ── Unknown entity or stress-test: try Redshift then fall back ─────
            oc = self._call_opencorporates(seed, jurisdiction, force_conflict, company_name)
            bundle.signals.append(oc)
            bundle.registry_label = oc.label
            bundle.registry_code  = oc.raw_code
            bundle.registry_taxonomy = oc.taxonomy
            bundle.signals.append(self._call_equifax(seed, jurisdiction, company_name))
            bundle.signals.append(self._call_trulioo(seed, jurisdiction))
            bundle.signals.append(self._call_zoominfo(seed, jurisdiction, company_name))
            bundle.signals.append(self._call_liberty_data(seed, jurisdiction, company_name))
            bundle.signals.append(self._call_ai_semantic(seed, web_summary))
            bundle.history = self._generate_history(seed, jurisdiction)

        return bundle

    # ── Private vendor simulators ─────────────────────────────────────────────

    # ── Build a SourceSignal from an EntityMatchResult record ─────────────────

    def _signal_from_record(self, record, source: str, base_weight: float) -> "SourceSignal":
        """Convert a known-entity SourceRecord into a SourceSignal."""
        if record is None:
            return SourceSignal(
                source=source, raw_code="", taxonomy="US_NAICS_2022", label="",
                weight=_jitter(base_weight, 0.05), status="UNAVAILABLE",
                confidence=0.0, retrieved_at=_ts(0),
            )
        return SourceSignal(
            source=source,
            raw_code=record.naics_code,
            taxonomy=record.taxonomy,
            label=record.naics_label,
            weight=_jitter(base_weight, 0.04),
            status=record.status,
            confidence=_jitter(record.match_confidence, 0.03),
            retrieved_at=_ts(0),
        )

    def _stable_history(self, code: str, label: str, taxonomy: str, n: int = 3) -> list:
        """Known entities have a stable classification history (no pivot)."""
        return [
            TemporalRecord(
                taxonomy=taxonomy, code=code, label=label,
                source="opencorporates", retrieved_at=_ts((i + 1) * 90),
            )
            for i in range(n)
        ]

    # ── Internal: resolve taxonomy pool from jurisdiction_code ───────────────

    @staticmethod
    def _taxonomy_pool(jc: str, seed_offset: int) -> tuple[str, str, str]:
        """
        Return (code, label, taxonomy) appropriate for the given
        OpenCorporates jurisdiction_code, using the registry.
        """
        pref = JR.preferred_taxonomy(jc)
        if pref == "UK_SIC_2007":
            code, label = _pick(_UK_SIC_POOL, seed_offset)
            return code, label, "UK_SIC_2007"
        elif pref == "NACE_REV2":
            code, label = _pick(_NACE_POOL, seed_offset)
            return code, label, "NACE_REV2"
        elif pref == "ISIC_REV4":
            code, label = _pick(_MCC_POOL, seed_offset)
            return code, label, "ISIC_REV4"
        else:
            code, label = _pick(_NAICS_POOL, seed_offset)
            return code, label, "US_NAICS_2022"

    # ── Private vendor simulators ─────────────────────────────────────────────

    def _call_opencorporates(
        self, seed: int, jurisdiction: str, force_conflict: bool,
        company_name: str = "",
    ) -> SourceSignal:
        jc = jurisdiction.lower().strip()
        iso2 = JR.resolve_iso2(jc)

        if force_conflict:
            return SourceSignal(
                source="opencorporates",
                raw_code="551112", taxonomy="US_NAICS_2022",
                label="Offices of Other Holding Companies",
                weight=_jitter(self.weights["opencorporates"], 0.05),
                status="MATCHED", confidence=_jitter(0.88, 0.05),
                retrieved_at=_ts(0),
            )

        # ── Try real Redshift first ────────────────────────────────────────────
        if company_name:
            from redshift_connector import get_connector, best_naics_from_opencorporates, best_uk_sic_from_opencorporates, parse_opencorporates_uid
            rc = get_connector()
            if rc.is_connected:
                row = rc.lookup_opencorporates(company_name, iso2)
                if row and row.match_confidence >= 0.60:
                    # Parse the pipe-delimited industry_code_uids field
                    uids = row.industry_code_uids or ""
                    parsed = parse_opencorporates_uid(uids)
                    # Select best code for this jurisdiction
                    naics = best_naics_from_opencorporates(uids)
                    uk_sic = best_uk_sic_from_opencorporates(uids)
                    if iso2 == "GB" and uk_sic:
                        code, taxonomy, label = uk_sic, "UK_SIC_2007", f"UK SIC {uk_sic}"
                    elif naics:
                        code, taxonomy, label = naics, "US_NAICS_2022", f"NAICS {naics}"
                    elif parsed:
                        first_key = next(iter(parsed))
                        code, taxonomy, label = parsed[first_key], first_key.upper(), f"{first_key}-{parsed[first_key]}"
                    else:
                        code, taxonomy, label = "", "US_NAICS_2022", "No industry code on file"
                    status = "MATCHED" if row.match_confidence >= 0.80 else "CONFLICT"
                    return SourceSignal(
                        source="opencorporates",
                        raw_code=code, taxonomy=taxonomy, label=label,
                        weight=_jitter(self.weights["opencorporates"], 0.05),
                        status=status, confidence=_jitter(row.match_confidence, 0.03),
                        retrieved_at=_ts(0),
                    )

        # ── Fallback: simulation ───────────────────────────────────────────────
        code, label, taxonomy = self._taxonomy_pool(jc, seed)
        r = random.random()
        if r < 0.35:
            status, confidence = "SIMULATED", _jitter(0.52, 0.12)
        elif r < 0.55:
            status, confidence = "CONFLICT",  _jitter(0.63, 0.10)
        else:
            status, confidence = "SIMULATED", _jitter(0.71, 0.09)
        return SourceSignal(
            source="opencorporates",
            raw_code=code, taxonomy=taxonomy, label=label,
            weight=_jitter(self.weights["opencorporates"], 0.05),
            status=status, confidence=confidence,
            retrieved_at=_ts(0),
        )

    def _call_equifax(self, seed: int, jurisdiction: str, company_name: str = "") -> SourceSignal:
        jc = jurisdiction.lower().strip()
        iso2 = JR.resolve_iso2(jc)

        # ── Try real Redshift first (US only) ──────────────────────────────────
        if company_name and iso2 == "US":
            from redshift_connector import get_connector
            rc = get_connector()
            if rc.is_connected:
                row = rc.lookup_equifax(company_name, "US")
                if row and row.match_confidence >= 0.60:
                    code = row.naics_code or ""
                    taxonomy = "US_NAICS_2022"
                    label = row.industry_label or f"NAICS {code}"
                    if not code and row.sic_code:
                        code, taxonomy, label = row.sic_code, "US_SIC_1987", f"SIC {row.sic_code}"
                    status = "MATCHED" if row.match_confidence >= 0.80 else "CONFLICT"
                    return SourceSignal(
                        source="equifax",
                        raw_code=code, taxonomy=taxonomy, label=label,
                        weight=_jitter(self.weights["equifax"], 0.08),
                        status=status, confidence=_jitter(row.match_confidence, 0.03),
                        retrieved_at=_ts(0),
                    )

        # ── Fallback: simulation ───────────────────────────────────────────────
        if JR.is_naics_jurisdiction(jc):
            code, label = _pick(_NAICS_POOL, seed + 2)
            taxonomy = "US_NAICS_2022"
        else:
            code, label = _pick(_US_SIC_POOL, seed + 2)
            taxonomy = "US_SIC_1987"

        r = random.random()
        if r < 0.30:
            status, confidence = "SIMULATED", _jitter(0.48, 0.12)
        elif r < 0.50:
            status, confidence = "CONFLICT",  _jitter(0.61, 0.10)
        else:
            status, confidence = "SIMULATED", _jitter(0.68, 0.09)
        return SourceSignal(
            source="equifax",
            raw_code=code, taxonomy=taxonomy, label=label,
            weight=_jitter(self.weights["equifax"], 0.08),
            status=status, confidence=confidence,
            retrieved_at=_ts(0),
        )

    def _call_trulioo(self, seed: int, jurisdiction: str) -> SourceSignal:
        """
        Trulioo known issue: sometimes returns 4-digit SIC regardless of jurisdiction.
        """
        jc = jurisdiction.lower().strip()
        polluted = random.random() < 0.25
        if polluted:
            code, label = _pick(_US_SIC_POOL, seed + 3)
            return SourceSignal(
                source="trulioo",
                raw_code=code, taxonomy="US_SIC_1987", label=label,
                weight=_jitter(self.weights["trulioo"], 0.07),
                status="POLLUTED", confidence=_jitter(0.70, 0.1),
                retrieved_at=_ts(0),
            )
        code, label, taxonomy = self._taxonomy_pool(jc, seed + 3)
        return SourceSignal(
            source="trulioo",
            raw_code=code, taxonomy=taxonomy, label=label,
            weight=_jitter(self.weights["trulioo"], 0.07),
            status="MATCHED", confidence=_jitter(0.70, 0.1),
            retrieved_at=_ts(0),
        )

    def _call_zoominfo(self, seed: int, jurisdiction: str = "us", company_name: str = "") -> SourceSignal:
        jc = jurisdiction.lower().strip()
        iso2 = JR.resolve_iso2(jc)

        # ── Try real Redshift first ────────────────────────────────────────────
        if company_name:
            from redshift_connector import get_connector
            rc = get_connector()
            if rc.is_connected:
                row = rc.lookup_zoominfo(company_name, iso2)
                if row and row.match_confidence >= 0.60:
                    code = row.naics_code or ""
                    taxonomy = "US_NAICS_2022"
                    label = row.industry_label or f"NAICS {code}"
                    if not code and row.sic_code:
                        code, taxonomy, label = row.sic_code, "US_SIC_1987", f"SIC {row.sic_code}"
                    status = "MATCHED" if row.match_confidence >= 0.80 else "CONFLICT"
                    return SourceSignal(
                        source="zoominfo",
                        raw_code=code, taxonomy=taxonomy, label=label,
                        weight=_jitter(self.weights["zoominfo"], 0.06),
                        status=status, confidence=_jitter(row.match_confidence, 0.03),
                        retrieved_at=_ts(0),
                    )

        # ── Fallback: simulation ───────────────────────────────────────────────
        code, label = _pick(_NAICS_POOL, seed + 4)
        r = random.random()
        if r < 0.25:
            status, confidence = "SIMULATED", _jitter(0.55, 0.12)
        elif r < 0.40:
            status, confidence = "CONFLICT",  _jitter(0.65, 0.10)
        else:
            status, confidence = "SIMULATED", _jitter(0.72, 0.08)
        return SourceSignal(
            source="zoominfo",
            raw_code=code, taxonomy="US_NAICS_2022", label=label,
            weight=_jitter(self.weights["zoominfo"], 0.06),
            status=status, confidence=confidence,
            retrieved_at=_ts(0),
        )

    def _call_duns(self, seed: int, jurisdiction: str) -> SourceSignal:
        jc = jurisdiction.lower().strip()
        code, label, taxonomy = self._taxonomy_pool(jc, seed + 5)
        # Unknown entities: D&B may have limited coverage for small/private companies
        r = random.random()
        if r < 0.20:
            status, confidence = "INFERRED", _jitter(0.50, 0.12)
        elif r < 0.35:
            status, confidence = "CONFLICT",  _jitter(0.63, 0.10)
        else:
            status, confidence = "MATCHED",   _jitter(0.70, 0.08)
        return SourceSignal(
            source="duns",
            raw_code=code, taxonomy=taxonomy, label=label,
            weight=_jitter(self.weights["duns"], 0.05),
            status=status, confidence=confidence,
            retrieved_at=_ts(0),
        )

    def _call_liberty_data(self, seed: int, jurisdiction: str, company_name: str = "") -> SourceSignal:
        """
        Liberty Data — commercial business intelligence (Redshift table).
        Fourth entity-matching source alongside open_corporates, equifax, zoominfo.
        Queries dev.warehouse.liberty_data_standard when Redshift creds are set.
        """
        jc = jurisdiction.lower().strip()
        iso2 = JR.resolve_iso2(jc)

        # ── Try real Redshift first ────────────────────────────────────────────
        if company_name:
            from redshift_connector import get_connector
            rc = get_connector()
            if rc.is_connected:
                row = rc.lookup_liberty_data(company_name, iso2)
                if row and row.match_confidence >= 0.60:
                    code = row.naics_code or ""
                    taxonomy = "US_NAICS_2022"
                    label = row.industry_label or f"NAICS {code}"
                    if iso2 == "GB" and row.uk_sic_code:
                        code, taxonomy, label = row.uk_sic_code, "UK_SIC_2007", f"UK SIC {row.uk_sic_code}"
                    elif not code and row.sic_code:
                        code, taxonomy, label = row.sic_code, "US_SIC_1987", f"SIC {row.sic_code}"
                    status = "MATCHED" if row.match_confidence >= 0.80 else "CONFLICT"
                    return SourceSignal(
                        source="liberty_data",
                        raw_code=code, taxonomy=taxonomy, label=label,
                        weight=_jitter(self.weights["liberty_data"], 0.05),
                        status=status, confidence=_jitter(row.match_confidence, 0.03),
                        retrieved_at=_ts(0),
                    )

        # ── Fallback: simulation ───────────────────────────────────────────────
        code, label, taxonomy = self._taxonomy_pool(jc, seed + 8)
        r = random.random()
        if r < 0.30:
            status, confidence = "SIMULATED", _jitter(0.50, 0.12)
        elif r < 0.48:
            status, confidence = "CONFLICT",  _jitter(0.62, 0.10)
        else:
            status, confidence = "SIMULATED", _jitter(0.68, 0.08)
        return SourceSignal(
            source="liberty_data",
            raw_code=code, taxonomy=taxonomy, label=label,
            weight=_jitter(self.weights["liberty_data"], 0.05),
            status=status, confidence=confidence,
            retrieved_at=_ts(0),
        )

    def _liberty_data_from_known(self, oc_record, seed: int) -> SourceSignal:
        """For known entities: Liberty Data agrees with OpenCorporates record."""
        if oc_record is None:
            return self._call_liberty_data(seed, "us")
        return SourceSignal(
            source="liberty_data",
            raw_code=oc_record.naics_code,
            taxonomy=oc_record.taxonomy,
            label=oc_record.naics_label,
            weight=_jitter(self.weights["liberty_data"], 0.04),
            status="MATCHED",
            confidence=_jitter(oc_record.match_confidence * 0.93, 0.03),
            retrieved_at=_ts(0),
        )

    def _call_ai_semantic(self, seed: int, web_summary: str) -> SourceSignal:
        """In production: GPT-4o-mini + DuckDuckGo."""
        if web_summary:
            summary_seed = int(hashlib.md5(web_summary[:50].encode()).hexdigest(), 16)
            code, label = _pick(_NAICS_POOL, summary_seed)
        else:
            code, label = _pick(_NAICS_POOL, seed + 6)
        return SourceSignal(
            source="ai_semantic",
            raw_code=code, taxonomy="US_NAICS_2022", label=label,
            weight=_jitter(self.weights["ai_semantic"], 0.06),
            status="INFERRED", confidence=_jitter(0.78, 0.10),
            retrieved_at=_ts(0),
        )

    def _generate_history(
        self, seed: int, jurisdiction: str, n: int = 3
    ) -> list[TemporalRecord]:
        jc = jurisdiction.lower().strip()
        records = []
        for i in range(n):
            days_ago = (i + 1) * 90
            code, label, taxonomy = self._taxonomy_pool(jc, seed + i * 7)
            records.append(TemporalRecord(
                taxonomy=taxonomy, code=code, label=label,
                source=random.choice(["opencorporates", "equifax", "trulioo", "zoominfo"]),
                retrieved_at=_ts(days_ago),
            ))
        return records


# ── Full jurisdiction list drawn from registry ────────────────────────────────
# Used by simulate_training_dataset to cover all 200+ known codes.
_ALL_JURISDICTION_CODES: list[str] = JR.all_codes()


def simulate_training_dataset(
    n: int = 500,
    jurisdictions: Optional[list[str]] = None,
) -> list[VendorBundle]:
    """
    Generate a large synthetic dataset for XGBoost training / evaluation.
    Jurisdictions default to a representative sample that covers every
    region bucket (US states, Canadian provinces, UAE emirates, EU,
    APAC, LATAM, MENA, Africa) to ensure the model learns all encodings.
    """
    if jurisdictions is None:
        # Representative sample: ~30 codes spanning all region buckets
        jurisdictions = [
            # US — federal + every state/territory
            "us", "us_mo", "us_ca", "us_tx", "us_ny", "us_fl", "us_il",
            "us_wa", "us_co", "us_nd", "us_sd", "us_vt", "us_va", "us_ks",
            "us_ma", "us_mi", "us_oh", "us_ar", "us_ri", "us_wi", "us_ak",
            "us_wy", "us_nc", "us_de", "us_dc", "us_nv", "us_nm", "us_ky",
            "us_ne", "us_az", "us_pa", "us_al", "us_nj", "us_mn", "us_id",
            "us_la", "us_nh", "us_or", "us_sc", "us_mt", "us_ut", "us_ct",
            "us_md", "us_ga", "us_hi", "us_ia", "us_ms", "us_ok", "us_wv",
            "us_tn", "us_in", "us_me", "pr",
            # Canada
            "ca", "ca_bc", "ca_qc", "ca_on", "ca_ab", "ca_ns", "ca_pe",
            "ca_nu", "ca_sk", "ca_mb", "ca_nb", "ca_nl", "ca_nt", "ca_yt",
            # United Kingdom + Crown dependencies
            "gb", "gb_eng", "gb_sct", "gb_wls", "gb_nir", "gg", "je",
            # UAE + emirates
            "ae", "ae_az", "ae_du", "ae_sh",
            # Australia + states
            "au", "au_nsw", "au_vic", "au_qld", "au_wa",
            # Europe
            "de", "fr", "it", "es", "nl", "pl", "ch", "at", "be", "se",
            "no", "dk", "fi", "pt", "gr", "ie", "cz", "ro", "hu", "bg",
            "hr", "sk", "si", "ee", "lv", "lt", "cy", "mt", "lu", "is",
            "li", "mc", "me", "al", "rs", "mk", "by", "ua", "md", "gi",
            "gl", "gp", "re", "pm",
            # Asia-Pacific
            "in", "cn", "jp", "kr", "sg", "hk", "au", "my", "th", "vn",
            "ph", "id", "tw", "nz", "mm", "bd", "pk", "lk", "np", "kh",
            "mn", "bn", "la", "tj", "tl", "to", "vu",
            # Latin America & Caribbean
            "mx", "br", "ar", "co", "cl", "pe", "ve", "ec", "bo", "py",
            "uy", "gt", "cr", "pa", "hn", "ni", "sv", "do", "cu", "jm",
            "tt", "bb", "ky", "aw", "cw", "bz", "gy", "vg",
            # MENA
            "sa", "ae", "ir", "tr", "eg", "dz", "ma", "tn", "ly", "sd",
            "iq", "sy", "jo", "lb", "il", "ps", "kw", "qa", "bh", "om", "ye",
            # Africa
            "za", "ng", "ke", "gh", "et", "tz", "ug", "rw", "ao", "cm",
            "ci", "sn", "mu", "mz", "zw", "zm", "bw", "na", "mg", "ml",
            "mw", "ne", "cd", "cg",
        ]

    sim = DataSimulator()
    bundles: list[VendorBundle] = []

    company_name_templates = [
        "Alpha {n} Corp", "Beta {n} Ltd", "Gamma {n} LLC", "Delta {n} Inc",
        "Zeta {n} Holdings", "Eta {n} Partners", "Theta {n} Group",
        "Lambda {n} Services", "Mu {n} Technologies", "Nu {n} Solutions",
        "Xi {n} Enterprises", "Omicron {n} Ventures", "Pi {n} Capital",
        "Rho {n} Industries", "Sigma {n} Consulting", "Tau {n} Logistics",
        "Upsilon {n} Healthcare", "Phi {n} Education", "Chi {n} Energy",
        "Psi {n} Retail",
    ]

    for i in range(n):
        template = company_name_templates[i % len(company_name_templates)]
        name = template.format(n=i)
        jur  = jurisdictions[i % len(jurisdictions)]
        force_conflict = i % 20 == 0

        bundle = sim.fetch(
            company_name=name,
            jurisdiction=jur,
            entity_type=random.choice(["Operating", "Holding", "Partnership", "NGO"]),
            web_summary=f"Company {name} provides services in {jur}",
            force_conflict=force_conflict,
        )
        bundles.append(bundle)

    return bundles
