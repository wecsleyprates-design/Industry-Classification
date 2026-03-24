"""
Data Simulator — Vendor API & Redshift Source Emulation
=======================================================
Simulates the raw classification signals that would be delivered by
real data providers:
  • OpenCorporates  (registry filing data)
  • Equifax         (commercial credit bureau)
  • Trulioo         (global KYC/KYB data)
  • ZoomInfo        (B2B company intelligence)
  • Dun & Bradstreet (DUNS)
  • AI Semantic     (our own web-scrape + NLP enrichment)
  • Redshift        (historical classifications from our data warehouse)

The simulator returns a realistic VendorBundle containing raw codes,
labels, source weights, and temporal history — all the inputs consumed
by the ConsensusEngine.
"""

from __future__ import annotations

import random
import hashlib
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timedelta

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
        self.weights = base_weights or SOURCE_WEIGHTS

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
        `force_conflict` injects a holding-company code to stress-test
        the discrepancy detection pipeline.
        """
        seed = int(hashlib.md5(company_name.encode()).hexdigest(), 16)
        random.seed(seed)

        bundle = VendorBundle(
            business_id=f"sim-{seed % 1_000_000:08d}",
            company_name=company_name,
            jurisdiction=jurisdiction,
            entity_type=entity_type,
            web_summary=web_summary,
        )

        # ── Registry (OpenCorporates / Redshift) ──────────────────────────────
        oc = self._call_opencorporates(seed, jurisdiction, force_conflict)
        bundle.signals.append(oc)
        bundle.registry_label = oc.label
        bundle.registry_code = oc.raw_code
        bundle.registry_taxonomy = oc.taxonomy

        # ── Equifax ───────────────────────────────────────────────────────────
        bundle.signals.append(self._call_equifax(seed, jurisdiction))

        # ── Trulioo ───────────────────────────────────────────────────────────
        bundle.signals.append(self._call_trulioo(seed, jurisdiction))

        # ── ZoomInfo ──────────────────────────────────────────────────────────
        bundle.signals.append(self._call_zoominfo(seed))

        # ── Dun & Bradstreet ──────────────────────────────────────────────────
        bundle.signals.append(self._call_duns(seed, jurisdiction))

        # ── AI Semantic (our own enrichment) ──────────────────────────────────
        bundle.signals.append(self._call_ai_semantic(seed, web_summary))

        # ── Temporal history (3 historical snapshots) ─────────────────────────
        bundle.history = self._generate_history(seed, jurisdiction)

        return bundle

    # ── Private vendor simulators ─────────────────────────────────────────────

    def _call_opencorporates(
        self, seed: int, jurisdiction: str, force_conflict: bool
    ) -> SourceSignal:
        if force_conflict:
            code, label = "551112", "Offices of Other Holding Companies"
            taxonomy = "US_NAICS_2022"
        elif jurisdiction == "GB":
            code, label = _pick(_UK_SIC_POOL, seed)
            taxonomy = "UK_SIC_2007"
        elif jurisdiction in ("DE", "FR", "IT", "ES", "NL"):
            code, label = _pick(_NACE_POOL, seed + 1)
            taxonomy = "NACE_REV2"
        else:
            code, label = _pick(_NAICS_POOL, seed)
            taxonomy = "US_NAICS_2022"

        return SourceSignal(
            source="opencorporates",
            raw_code=code,
            taxonomy=taxonomy,
            label=label,
            weight=_jitter(self.weights["opencorporates"], 0.05),
            status="MATCHED",
            confidence=_jitter(0.88, 0.07),
            retrieved_at=_ts(0),
        )

    def _call_equifax(self, seed: int, jurisdiction: str) -> SourceSignal:
        if jurisdiction == "US":
            code, label = _pick(_NAICS_POOL, seed + 2)
            taxonomy = "US_NAICS_2022"
        else:
            code, label = _pick(_US_SIC_POOL, seed + 2)
            taxonomy = "US_SIC_1987"

        # Equifax sometimes returns a SIC instead of NAICS for non-US
        conflict = random.random() < 0.15
        return SourceSignal(
            source="equifax",
            raw_code=code,
            taxonomy=taxonomy,
            label=label,
            weight=_jitter(self.weights["equifax"], 0.08),
            status="CONFLICT" if conflict else "MATCHED",
            confidence=_jitter(0.75, 0.1),
            retrieved_at=_ts(0),
        )

    def _call_trulioo(self, seed: int, jurisdiction: str) -> SourceSignal:
        """
        Trulioo known issue: sometimes returns 4-digit SIC for a 5-digit
        NAICS jurisdiction → "pollution" flag.
        """
        polluted = random.random() < 0.25
        if polluted:
            code, label = _pick(_US_SIC_POOL, seed + 3)
            taxonomy = "US_SIC_1987"
            status = "POLLUTED"
        elif jurisdiction == "GB":
            code, label = _pick(_UK_SIC_POOL, seed + 3)
            taxonomy = "UK_SIC_2007"
            status = "MATCHED"
        else:
            code, label = _pick(_NAICS_POOL, seed + 3)
            taxonomy = "US_NAICS_2022"
            status = "MATCHED"

        return SourceSignal(
            source="trulioo",
            raw_code=code,
            taxonomy=taxonomy,
            label=label,
            weight=_jitter(self.weights["trulioo"], 0.07),
            status=status,
            confidence=_jitter(0.70, 0.1),
            retrieved_at=_ts(0),
        )

    def _call_zoominfo(self, seed: int) -> SourceSignal:
        code, label = _pick(_NAICS_POOL, seed + 4)
        return SourceSignal(
            source="zoominfo",
            raw_code=code,
            taxonomy="US_NAICS_2022",
            label=label,
            weight=_jitter(self.weights["zoominfo"], 0.06),
            status="MATCHED",
            confidence=_jitter(0.80, 0.08),
            retrieved_at=_ts(0),
        )

    def _call_duns(self, seed: int, jurisdiction: str) -> SourceSignal:
        if jurisdiction == "US":
            code, label = _pick(_NAICS_POOL, seed + 5)
            taxonomy = "US_NAICS_2022"
        else:
            code, label = _pick(_NACE_POOL, seed + 5)
            taxonomy = "NACE_REV2"

        return SourceSignal(
            source="duns",
            raw_code=code,
            taxonomy=taxonomy,
            label=label,
            weight=_jitter(self.weights["duns"], 0.05),
            status="MATCHED",
            confidence=_jitter(0.83, 0.07),
            retrieved_at=_ts(0),
        )

    def _call_ai_semantic(self, seed: int, web_summary: str) -> SourceSignal:
        """
        Simulates our in-house AI web-scrape enrichment.
        In production this uses GPT-4o-mini + DuckDuckGo.
        """
        if web_summary:
            summary_seed = int(hashlib.md5(web_summary[:50].encode()).hexdigest(), 16)
            code, label = _pick(_NAICS_POOL, summary_seed)
        else:
            code, label = _pick(_NAICS_POOL, seed + 6)

        return SourceSignal(
            source="ai_semantic",
            raw_code=code,
            taxonomy="US_NAICS_2022",
            label=label,
            weight=_jitter(self.weights["ai_semantic"], 0.06),
            status="INFERRED",
            confidence=_jitter(0.78, 0.10),
            retrieved_at=_ts(0),
        )

    def _generate_history(
        self, seed: int, jurisdiction: str, n: int = 3
    ) -> list[TemporalRecord]:
        records = []
        for i in range(n):
            days_ago = (i + 1) * 90   # roughly every quarter
            if jurisdiction == "GB":
                code, label = _pick(_UK_SIC_POOL, seed + i * 7)
                taxonomy = "UK_SIC_2007"
            else:
                code, label = _pick(_NAICS_POOL, seed + i * 7)
                taxonomy = "US_NAICS_2022"
            records.append(
                TemporalRecord(
                    taxonomy=taxonomy,
                    code=code,
                    label=label,
                    source=random.choice(
                        ["opencorporates", "equifax", "trulioo", "zoominfo"]
                    ),
                    retrieved_at=_ts(days_ago),
                )
            )
        return records


def simulate_training_dataset(
    n: int = 500,
    jurisdictions: Optional[list[str]] = None,
) -> list[VendorBundle]:
    """
    Generate a large synthetic dataset for XGBoost training / evaluation.
    """
    if jurisdictions is None:
        jurisdictions = ["US", "GB", "DE", "FR", "AU", "CA", "IN", "SG"]

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
        jur = jurisdictions[i % len(jurisdictions)]
        force_conflict = i % 20 == 0   # 5% have deliberate shell-company signal

        bundle = sim.fetch(
            company_name=name,
            jurisdiction=jur,
            entity_type=random.choice(["Operating", "Holding", "Partnership", "NGO"]),
            web_summary=f"Company {name} provides services in {jur}",
            force_conflict=force_conflict,
        )
        bundles.append(bundle)

    return bundles
