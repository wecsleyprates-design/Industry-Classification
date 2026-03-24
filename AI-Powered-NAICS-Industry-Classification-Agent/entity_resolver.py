"""
Entity Resolver
===============
• Strips 100+ global legal-entity suffixes across all major jurisdictions.
• Detects the company's likely jurisdiction / country from name tokens,
  address, phone prefix, or explicit country field.
• Classifies entity type (Operating, Holding, Trust, Partnership, NGO, etc.)
• Exposes a clean EntityProfile dataclass consumed by the rest of the engine.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

# ── Global legal-entity suffix registry ──────────────────────────────────────
# Format: (regex_pattern, jurisdiction_hint, entity_type)
# Keep longest / most specific patterns first so they match before substrings.

SUFFIX_REGISTRY: list[tuple[str, str, str]] = [
    # ── United States ──────────────────────────────────────────────────────────
    (r"\bllc\b",                        "US", "Operating"),
    (r"\bl\.l\.c\b",                    "US", "Operating"),
    (r"\bplc\b",                        "US", "Operating"),
    (r"\binc(?:orporated)?\b",          "US", "Operating"),
    (r"\bcorp(?:oration)?\b",           "US", "Operating"),
    (r"\bco(?:mpany)?\b",               "US", "Operating"),
    (r"\bltd\b",                        "US", "Operating"),
    (r"\blimited\b",                    "US", "Operating"),
    (r"\bholdings?\b",                  "US", "Holding"),
    (r"\bgroup\b",                      "US", "Holding"),
    (r"\benterprises?\b",               "US", "Operating"),
    (r"\bassociates?\b",                "US", "Operating"),
    (r"\bpartners?\b",                  "US", "Partnership"),
    (r"\blp\b",                         "US", "Partnership"),
    (r"\bl\.p\.\b",                     "US", "Partnership"),
    (r"\bllp\b",                        "US", "Partnership"),
    (r"\bl\.l\.p\.\b",                  "US", "Partnership"),
    (r"\bpa\b",                         "US", "Operating"),   # Professional Association
    (r"\bpc\b",                         "US", "Operating"),   # Professional Corp
    (r"\bpllc\b",                       "US", "Operating"),
    (r"\bfoundation\b",                 "US", "NGO"),
    (r"\btrust\b",                      "US", "Trust"),
    (r"\bfund\b",                       "US", "Fund"),
    (r"\bventures?\b",                  "US", "Operating"),
    (r"\bindustries\b",                 "US", "Operating"),
    (r"\bsolutions?\b",                 "US", "Operating"),
    (r"\btechnologies\b",               "US", "Operating"),
    (r"\bservices?\b",                  "US", "Operating"),
    (r"\bsystems?\b",                   "US", "Operating"),
    (r"\binternational\b",              "*",  "Operating"),
    (r"\bglobal\b",                     "*",  "Operating"),
    (r"\bworldwide\b",                  "*",  "Operating"),
    (r"\bnationwide\b",                 "US", "Operating"),
    (r"\bamerican\b",                   "US", "Operating"),
    # ── United Kingdom ────────────────────────────────────────────────────────
    (r"\bplc\b",                        "GB", "Operating"),
    (r"\bpublic limited company\b",     "GB", "Operating"),
    (r"\blimited liability partnership\b", "GB", "Partnership"),
    (r"\bchartered\b",                  "GB", "Operating"),
    (r"\bcommunity interest company\b", "GB", "NGO"),
    (r"\bcic\b",                        "GB", "NGO"),
    (r"\blbg\b",                        "GB", "NGO"),          # Ltd by Guarantee
    (r"\bscio\b",                       "GB", "NGO"),          # Scottish Charity
    # ── Germany ───────────────────────────────────────────────────────────────
    (r"\bgmbh\b",                       "DE", "Operating"),
    (r"\bag\b",                         "DE", "Operating"),
    (r"\bkg\b",                         "DE", "Partnership"),
    (r"\bkgaa\b",                       "DE", "Operating"),
    (r"\be\.v\.\b",                     "DE", "NGO"),
    (r"\bvvag\b",                       "DE", "Operating"),
    (r"\bobg\b",                        "DE", "Operating"),
    # ── France ────────────────────────────────────────────────────────────────
    (r"\bsa(?:s)?\b",                   "FR", "Operating"),
    (r"\bsarl\b",                       "FR", "Operating"),
    (r"\bsc\b",                         "FR", "Partnership"),
    (r"\bsci\b",                        "FR", "Operating"),
    (r"\bsas\b",                        "FR", "Operating"),
    (r"\bsnc\b",                        "FR", "Partnership"),
    # ── Netherlands ───────────────────────────────────────────────────────────
    (r"\bb\.v\.\b",                     "NL", "Operating"),
    (r"\bbv\b",                         "NL", "Operating"),
    (r"\bn\.v\.\b",                     "NL", "Operating"),
    (r"\bnv\b",                         "NL", "Operating"),
    # ── Spain ─────────────────────────────────────────────────────────────────
    (r"\bs\.a\.\b",                     "ES", "Operating"),
    (r"\bs\.l\.\b",                     "ES", "Operating"),
    (r"\bsl\b",                         "ES", "Operating"),
    (r"\bslu\b",                        "ES", "Operating"),
    # ── Italy ─────────────────────────────────────────────────────────────────
    (r"\bs\.p\.a\.\b",                  "IT", "Operating"),
    (r"\bspa\b",                        "IT", "Operating"),
    (r"\bs\.r\.l\.\b",                  "IT", "Operating"),
    (r"\bsrl\b",                        "IT", "Operating"),
    # ── Switzerland ───────────────────────────────────────────────────────────
    (r"\bag\b",                         "CH", "Operating"),
    (r"\bsa\b",                         "CH", "Operating"),
    # ── Australia ─────────────────────────────────────────────────────────────
    (r"\bpty\s+ltd\b",                  "AU", "Operating"),
    (r"\bpty\b",                        "AU", "Operating"),
    # ── Canada ────────────────────────────────────────────────────────────────
    (r"\bulc\b",                        "CA", "Operating"),   # Unlimited Liability Co
    (r"\bltée\b",                       "CA", "Operating"),
    # ── Japan ─────────────────────────────────────────────────────────────────
    (r"\bkk\b",                         "JP", "Operating"),   # Kabushiki Kaisha
    (r"\bgk\b",                         "JP", "Partnership"), # Godo Kaisha
    # ── China ─────────────────────────────────────────────────────────────────
    (r"\byouxian gongsi\b",             "CN", "Operating"),
    (r"\bco\.\s*ltd\b",                 "CN", "Operating"),
    # ── India ─────────────────────────────────────────────────────────────────
    (r"\bpvt\s*\.?\s*ltd\b",            "IN", "Operating"),
    (r"\bprivate limited\b",            "IN", "Operating"),
    # ── Brazil ────────────────────────────────────────────────────────────────
    (r"\bltda\b",                       "BR", "Operating"),
    (r"\bs\.a\.\b",                     "BR", "Operating"),
    (r"\beireli\b",                     "BR", "Operating"),
    # ── Mexico ────────────────────────────────────────────────────────────────
    (r"\bs\.a\.\s*de\s*c\.v\.\b",      "MX", "Operating"),
    (r"\bs\.a\.p\.i\.\s*de\s*c\.v\.\b","MX", "Operating"),
    # ── Russia ────────────────────────────────────────────────────────────────
    (r"\booo\b",                        "RU", "Operating"),
    (r"\bzao\b",                        "RU", "Operating"),
    (r"\bpao\b",                        "RU", "Operating"),
    # ── Cayman / Offshore ─────────────────────────────────────────────────────
    (r"\bexempted company\b",           "KY", "Holding"),
    (r"\boffshore\b",                   "*",  "Holding"),
    # ── Generic international ─────────────────────────────────────────────────
    (r"\bse\b",                         "*",  "Operating"),   # Societas Europaea
    (r"\bsociety\b",                    "*",  "NGO"),
    (r"\bcooperative\b",                "*",  "Operating"),
    (r"\bunion\b",                      "*",  "NGO"),
    (r"\bassociation\b",                "*",  "NGO"),
    (r"\binstitute\b",                  "*",  "NGO"),
    (r"\binstitution\b",                "*",  "NGO"),
    (r"\buniversity\b",                 "*",  "NGO"),
    (r"\bcollege\b",                    "*",  "NGO"),
    (r"\bschool\b",                     "*",  "NGO"),
    (r"\bhospital\b",                   "*",  "NGO"),
    (r"\bchurch\b",                     "*",  "NGO"),
    (r"\bcharity\b",                    "*",  "NGO"),
]

# ── Jurisdiction keyword → ISO-3166-1 alpha-2 ────────────────────────────────
JURISDICTION_KEYWORDS: dict[str, str] = {
    # Countries by name token in address / country field
    "united states": "US", "usa": "US", "u.s.a": "US", "u.s": "US",
    "united kingdom": "GB", "uk": "GB", "england": "GB", "scotland": "GB",
    "wales": "GB", "northern ireland": "GB", "great britain": "GB",
    "germany": "DE", "deutschland": "DE",
    "france": "FR",
    "spain": "ES", "españa": "ES",
    "italy": "IT", "italia": "IT",
    "netherlands": "NL", "holland": "NL",
    "switzerland": "CH",
    "australia": "AU",
    "canada": "CA",
    "japan": "JP",
    "china": "CN", "prc": "CN",
    "india": "IN",
    "brazil": "BR", "brasil": "BR",
    "mexico": "MX", "méxico": "MX",
    "russia": "RU",
    "cayman": "KY", "cayman islands": "KY",
    "ireland": "IE",
    "luxembourg": "LU",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "finland": "FI",
    "poland": "PL",
    "singapore": "SG",
    "hong kong": "HK",
    "south africa": "ZA",
    "nigeria": "NG",
    "kenya": "KE",
    "uae": "AE", "emirates": "AE", "dubai": "AE", "abu dhabi": "AE",
    "saudi arabia": "SA",
    "south korea": "KR", "korea": "KR",
    "taiwan": "TW",
    "indonesia": "ID",
    "malaysia": "MY",
    "thailand": "TH",
    "vietnam": "VN",
    "philippines": "PH",
    "new zealand": "NZ",
    "argentina": "AR",
    "colombia": "CO",
    "chile": "CL",
    "peru": "PE",
}

# ── Phone country prefix → ISO ────────────────────────────────────────────────
PHONE_PREFIX_MAP: dict[str, str] = {
    "+1": "US", "+44": "GB", "+49": "DE", "+33": "FR",
    "+39": "IT", "+34": "ES", "+31": "NL", "+41": "CH",
    "+61": "AU", "+1-CA": "CA", "+81": "JP", "+86": "CN",
    "+91": "IN", "+55": "BR", "+52": "MX", "+7": "RU",
    "+65": "SG", "+852": "HK", "+971": "AE", "+82": "KR",
    "+886": "TW", "+353": "IE", "+46": "SE", "+47": "NO",
    "+45": "DK", "+358": "FI", "+48": "PL",
}


def _normalize(text: str) -> str:
    """Lower-case, strip accents, collapse whitespace."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip().lower()


@dataclass
class EntityProfile:
    original_name: str
    clean_name: str                     # after suffix removal
    detected_jurisdiction: str          # ISO-3166-1 alpha-2, or "UNKNOWN"
    detected_entity_type: str           # Operating / Holding / Partnership / NGO / Trust / Fund
    suffixes_found: list[str] = field(default_factory=list)
    jurisdiction_confidence: float = 0.0  # 0.0–1.0


class EntityResolver:
    """
    Resolves a raw company name + optional metadata into a clean EntityProfile.

    Usage
    -----
    er = EntityResolver()
    profile = er.resolve("Joe's Pizza LLC", address="123 Main St", country="US")
    """

    def __init__(self) -> None:
        # Pre-compile all suffix patterns for speed
        self._compiled = [
            (re.compile(pattern, re.IGNORECASE), jur, etype)
            for pattern, jur, etype in SUFFIX_REGISTRY
        ]

    def resolve(
        self,
        company_name: str,
        address: str = "",
        country: str = "",
        phone: str = "",
    ) -> EntityProfile:
        norm_name = _normalize(company_name)
        working = norm_name
        found_suffixes: list[str] = []
        detected_jur: list[tuple[str, float]] = []  # (iso, confidence)
        detected_type: str = "Operating"

        # ── Pass 1: remove suffixes, collect jurisdiction hints ───────────────
        for pattern, jur, etype in self._compiled:
            m = pattern.search(working)
            if m:
                found_suffixes.append(m.group())
                # Remove the matched suffix token
                working = pattern.sub("", working)
                working = re.sub(r"\s+", " ", working).strip(" ,.-")
                if jur != "*":
                    detected_jur.append((jur, 0.5))
                detected_type = etype   # last match wins; acceptable heuristic

        # ── Pass 2: country field ─────────────────────────────────────────────
        if country:
            clow = _normalize(country)
            for kw, iso in JURISDICTION_KEYWORDS.items():
                if kw in clow or clow == iso.lower():
                    detected_jur.append((iso, 0.95))
                    break

        # ── Pass 3: address field ─────────────────────────────────────────────
        if address:
            alow = _normalize(address)
            for kw, iso in JURISDICTION_KEYWORDS.items():
                if kw in alow:
                    detected_jur.append((iso, 0.70))
                    break

        # ── Pass 4: phone prefix ──────────────────────────────────────────────
        if phone:
            for prefix, iso in PHONE_PREFIX_MAP.items():
                if phone.startswith(prefix):
                    detected_jur.append((iso, 0.75))
                    break

        # ── Aggregate jurisdiction by confidence ──────────────────────────────
        if detected_jur:
            # Simple vote: pick ISO with highest total confidence
            vote: dict[str, float] = {}
            for iso, conf in detected_jur:
                vote[iso] = vote.get(iso, 0.0) + conf
            best_iso = max(vote, key=lambda k: vote[k])
            best_conf = min(vote[best_iso] / sum(v for v in vote.values()), 1.0)
        else:
            best_iso = "UNKNOWN"
            best_conf = 0.0

        # Capitalise company name nicely
        clean = " ".join(w.capitalize() for w in working.split())

        return EntityProfile(
            original_name=company_name,
            clean_name=clean or company_name,
            detected_jurisdiction=best_iso,
            detected_entity_type=detected_type,
            suffixes_found=list(dict.fromkeys(found_suffixes)),  # dedupe, order-preserve
            jurisdiction_confidence=round(best_conf, 3),
        )

    def batch_resolve(
        self,
        records: list[dict],
        name_col: str = "Org Name",
        address_col: str = "Address",
        country_col: str = "Country",
    ) -> list[EntityProfile]:
        return [
            self.resolve(
                r.get(name_col, ""),
                r.get(address_col, ""),
                r.get(country_col, ""),
            )
            for r in records
        ]
