"""
Entity Resolver
===============
• Strips 100+ global legal-entity suffixes across all major jurisdictions.
• Detects the company's likely jurisdiction using the JurisdictionRegistry,
  which understands the full OpenCorporates jurisdiction_code format:
    - plain ISO-2     : "gb", "de", "th"
    - US states       : "us_mo", "us_ca", "us_dc"
    - Canadian provs  : "ca_bc", "ca_qc", "ca_nu"
    - UAE emirates    : "ae_az", "ae_du"
    - AU states       : "au_nsw", "au_vic"
    - etc.
• Classifies entity type (Operating, Holding, Trust, Partnership, NGO, etc.)
• Exposes an EntityProfile dataclass consumed by the rest of the engine,
  including both the full jurisdiction_code and the sovereign ISO-2.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Optional

import jurisdiction_registry as JR

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

# ── Jurisdiction keyword → jurisdiction_code (OpenCorporates format) ──────────
# Covers country names, demonyms, city names, and state/province names.
# Maps to the full OpenCorporates jurisdiction_code so we preserve sub-national detail.
JURISDICTION_KEYWORDS: dict[str, str] = {
    # ── United States (country + states + territories) ────────────────────────
    "united states": "us", "usa": "us", "u.s.a": "us", "u.s.": "us",
    "america": "us",
    "alabama": "us_al", "alaska": "us_ak", "arizona": "us_az",
    "arkansas": "us_ar", "california": "us_ca", "colorado": "us_co",
    "connecticut": "us_ct", "delaware": "us_de",
    "district of columbia": "us_dc", "washington dc": "us_dc", "washington d.c": "us_dc",
    "florida": "us_fl", "georgia": "us_ga", "hawaii": "us_hi",
    "idaho": "us_id", "illinois": "us_il", "indiana": "us_in",
    "iowa": "us_ia", "kansas": "us_ks", "kentucky": "us_ky",
    "louisiana": "us_la", "maine": "us_me", "maryland": "us_md",
    "massachusetts": "us_ma", "michigan": "us_mi", "minnesota": "us_mn",
    "mississippi": "us_ms", "missouri": "us_mo", "montana": "us_mt",
    "nebraska": "us_ne", "nevada": "us_nv", "new hampshire": "us_nh",
    "new jersey": "us_nj", "new mexico": "us_nm", "new york": "us_ny",
    "north carolina": "us_nc", "north dakota": "us_nd", "ohio": "us_oh",
    "oklahoma": "us_ok", "oregon": "us_or", "pennsylvania": "us_pa",
    "rhode island": "us_ri", "south carolina": "us_sc", "south dakota": "us_sd",
    "tennessee": "us_tn", "texas": "us_tx", "utah": "us_ut",
    "vermont": "us_vt", "virginia": "us_va", "washington": "us_wa",
    "west virginia": "us_wv", "wisconsin": "us_wi", "wyoming": "us_wy",
    "puerto rico": "pr",
    # ── Canada (country + provinces/territories) ──────────────────────────────
    "canada": "ca",
    "alberta": "ca_ab", "british columbia": "ca_bc", "manitoba": "ca_mb",
    "new brunswick": "ca_nb", "newfoundland": "ca_nl", "labrador": "ca_nl",
    "nova scotia": "ca_ns", "northwest territories": "ca_nt",
    "nunavut": "ca_nu", "ontario": "ca_on", "prince edward island": "ca_pe",
    "quebec": "ca_qc", "québec": "ca_qc", "saskatchewan": "ca_sk",
    "yukon": "ca_yt",
    # ── United Kingdom (country + nations + crown dependencies) ──────────────
    "united kingdom": "gb", "uk": "gb", "great britain": "gb",
    "england": "gb_eng", "scotland": "gb_sct", "wales": "gb_wls",
    "northern ireland": "gb_nir",
    "guernsey": "gg", "jersey": "je",
    # ── UAE (country + emirates) ──────────────────────────────────────────────
    "united arab emirates": "ae", "uae": "ae", "emirates": "ae",
    "abu dhabi": "ae_az", "dubai": "ae_du", "sharjah": "ae_sh",
    "ajman": "ae_aj", "fujairah": "ae_fu",
    "ras al khaimah": "ae_rk", "umm al quwain": "ae_uq",
    # ── Australia (country + states) ─────────────────────────────────────────
    "australia": "au",
    "new south wales": "au_nsw", "victoria": "au_vic", "queensland": "au_qld",
    "western australia": "au_wa", "south australia": "au_sa",
    "tasmania": "au_tas", "northern territory": "au_nt",
    "australian capital territory": "au_act",
    # ── Europe ────────────────────────────────────────────────────────────────
    "germany": "de", "deutschland": "de",
    "france": "fr",
    "spain": "es", "espana": "es",
    "italy": "it", "italia": "it",
    "netherlands": "nl", "holland": "nl",
    "switzerland": "ch",
    "austria": "at", "belgium": "be", "bulgaria": "bg",
    "croatia": "hr", "cyprus": "cy", "czech republic": "cz", "czechia": "cz",
    "denmark": "dk", "estonia": "ee", "finland": "fi", "greece": "gr",
    "hungary": "hu", "iceland": "is", "ireland": "ie",
    "latvia": "lv", "liechtenstein": "li", "lithuania": "lt",
    "luxembourg": "lu", "malta": "mt", "moldova": "md", "monaco": "mc",
    "montenegro": "me", "north macedonia": "mk", "norway": "no",
    "poland": "pl", "portugal": "pt", "romania": "ro", "russia": "ru",
    "serbia": "rs", "slovakia": "sk", "slovenia": "si", "sweden": "se",
    "ukraine": "ua", "albania": "al", "belarus": "by", "kosovo": "xk",
    "gibraltar": "gi", "greenland": "gl", "guadeloupe": "gp",
    "reunion": "re", "saint pierre and miquelon": "pm",
    # ── Asia-Pacific ──────────────────────────────────────────────────────────
    "china": "cn", "prc": "cn",
    "hong kong": "hk",
    "india": "in",
    "indonesia": "id",
    "japan": "jp",
    "south korea": "kr", "korea": "kr",
    "malaysia": "my",
    "myanmar": "mm", "burma": "mm",
    "new zealand": "nz",
    "philippines": "ph",
    "singapore": "sg",
    "taiwan": "tw",
    "thailand": "th",
    "vietnam": "vn",
    "bangladesh": "bd", "brunei": "bn", "cambodia": "kh",
    "laos": "la", "mongolia": "mn", "nepal": "np", "pakistan": "pk",
    "sri lanka": "lk", "tajikistan": "tj", "timor-leste": "tl",
    "tonga": "to", "vanuatu": "vu",
    # ── Latin America & Caribbean ─────────────────────────────────────────────
    "mexico": "mx", "méxico": "mx",
    "brazil": "br", "brasil": "br",
    "argentina": "ar", "aruba": "aw", "barbados": "bb", "belize": "bz",
    "bolivia": "bo", "cayman islands": "ky", "cayman": "ky",
    "chile": "cl", "colombia": "co", "costa rica": "cr", "cuba": "cu",
    "curacao": "cw", "curaçao": "cw",
    "dominican republic": "do", "ecuador": "ec", "el salvador": "sv",
    "guatemala": "gt", "guyana": "gy", "haiti": "ht", "honduras": "hn",
    "jamaica": "jm", "nicaragua": "ni", "panama": "pa", "paraguay": "py",
    "peru": "pe", "puerto rico": "pr",
    "trinidad and tobago": "tt", "uruguay": "uy", "venezuela": "ve",
    "british virgin islands": "vg",
    # ── Middle East & North Africa ────────────────────────────────────────────
    "saudi arabia": "sa", "iran": "ir", "iraq": "iq", "israel": "il",
    "jordan": "jo", "kuwait": "kw", "lebanon": "lb", "libya": "ly",
    "morocco": "ma", "oman": "om", "qatar": "qa", "syria": "sy",
    "tunisia": "tn", "turkey": "tr", "turkiye": "tr", "yemen": "ye",
    "algeria": "dz", "egypt": "eg", "bahrain": "bh", "palestine": "ps",
    # ── Africa (Sub-Saharan) ──────────────────────────────────────────────────
    "south africa": "za", "nigeria": "ng", "kenya": "ke", "ghana": "gh",
    "ethiopia": "et", "tanzania": "tz", "uganda": "ug", "rwanda": "rw",
    "angola": "ao", "cameroon": "cm", "ivory coast": "ci",
    "cote d'ivoire": "ci", "democratic republic of the congo": "cd",
    "dr congo": "cd", "republic of congo": "cg",
    "mauritius": "mu", "mozambique": "mz", "namibia": "na",
    "senegal": "sn", "zambia": "zm", "zimbabwe": "zw",
    "botswana": "bw", "mali": "ml", "madagascar": "mg",
    "malawi": "mw", "niger": "ne", "sudan": "sd",
}

# ── Phone country prefix → jurisdiction_code ──────────────────────────────────
PHONE_PREFIX_MAP: dict[str, str] = {
    "+1":    "us",   "+44": "gb",   "+49": "de",  "+33": "fr",
    "+39":   "it",   "+34": "es",   "+31": "nl",  "+41": "ch",
    "+61":   "au",   "+81": "jp",   "+86": "cn",  "+91": "in",
    "+55":   "br",   "+52": "mx",   "+7":  "ru",  "+65": "sg",
    "+852":  "hk",   "+971":"ae",   "+82": "kr",  "+886":"tw",
    "+353":  "ie",   "+46": "se",   "+47": "no",  "+45": "dk",
    "+358":  "fi",   "+48": "pl",   "+380":"ua",  "+90": "tr",
    "+966":  "sa",   "+98": "ir",   "+20": "eg",  "+27": "za",
    "+234":  "ng",   "+254":"ke",   "+60": "my",  "+66": "th",
    "+84":   "vn",   "+63": "ph",   "+62": "id",  "+92": "pk",
    "+880":  "bd",   "+94": "lk",   "+977":"np",  "+64": "nz",
    "+507":  "pa",   "+57": "co",   "+56": "cl",  "+51": "pe",
    "+58":   "ve",   "+54": "ar",   "+595":"py",  "+598":"uy",
    "+593":  "ec",   "+502":"gt",   "+503":"sv",  "+504":"hn",
    "+505":  "ni",   "+506":"cr",   "+53": "cu",  "+1-809":"do",
    "+973":  "bh",   "+974":"qa",   "+965":"kw",  "+968":"om",
    "+961":  "lb",   "+962":"jo",   "+963":"sy",  "+967":"ye",
    "+216":  "tn",   "+212":"ma",   "+213":"dz",  "+218":"ly",
    "+249":  "sd",   "+251":"et",   "+255":"tz",  "+256":"ug",
    "+250":  "rw",   "+258":"mz",   "+263":"zw",  "+260":"zm",
    "+267":  "bw",   "+264":"na",   "+233":"gh",  "+237":"cm",
    "+225":  "ci",   "+221":"sn",   "+230":"mu",
}


def _normalize(text: str) -> str:
    """Lower-case, strip accents, collapse whitespace."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", text).strip().lower()


@dataclass
class EntityProfile:
    original_name: str
    clean_name: str                    # after suffix removal
    jurisdiction_code: str            # OpenCorporates format: "us_mo", "ca_bc", "gb", "ae_az"…
    detected_jurisdiction: str        # Sovereign ISO-2: "US", "GB", "AE"… (backwards compat)
    jurisdiction_label: str           # Human label: "Missouri", "British Columbia", "United Kingdom"
    region_bucket: str                # Coarse bucket: "US_STATE", "EU", "APAC", "MENA"…
    preferred_taxonomy: str           # Best-fit taxonomy for this jurisdiction
    is_naics_jurisdiction: bool       # True when NAICS 2022 is primary
    detected_entity_type: str         # Operating / Holding / Partnership / NGO / Trust / Fund
    suffixes_found: list[str] = field(default_factory=list)
    jurisdiction_confidence: float = 0.0   # 0.0–1.0


class EntityResolver:
    """
    Resolves a raw company name + optional metadata into a clean EntityProfile.

    Accepts jurisdiction input in any of these formats:
      • OpenCorporates code : "us_mo", "ca_bc", "ae_az", "gb", "de"
      • ISO-2 country       : "US", "GB", "DE"
      • Country name        : "United States", "Missouri", "Germany"
      • City/state name     : "Dubai", "New York", "Queensland"

    Usage
    -----
    er = EntityResolver()
    profile = er.resolve("Joe's Pizza LLC", address="123 Main St", country="us_mo")
    profile = er.resolve("Barclays Bank PLC", country="gb")
    profile = er.resolve("Volkswagen AG", country="Germany")
    """

    def __init__(self) -> None:
        self._compiled = [
            (re.compile(pattern, re.IGNORECASE), jur, etype)
            for pattern, jur, etype in SUFFIX_REGISTRY
        ]

    # ── Public API ────────────────────────────────────────────────────────────

    def resolve(
        self,
        company_name: str,
        address: str = "",
        country: str = "",
        phone: str = "",
        jurisdiction_code: str = "",   # explicit OpenCorporates code; highest priority
    ) -> EntityProfile:
        norm_name = _normalize(company_name)
        working   = norm_name
        found_suffixes: list[str] = []
        # candidates: list of (jurisdiction_code_lower, confidence)
        candidates: list[tuple[str, float]] = []
        detected_type: str = "Operating"

        # ── Pass 0: explicit jurisdiction_code (highest priority) ─────────────
        if jurisdiction_code:
            jc = jurisdiction_code.strip().lower()
            if JR.lookup(jc):
                candidates.append((jc, 1.0))

        # ── Pass 1: suffix scan — strip suffixes, collect sovereign hints ─────
        for pattern, jur, etype in self._compiled:
            m = pattern.search(working)
            if m:
                found_suffixes.append(m.group())
                working = pattern.sub("", working)
                working = re.sub(r"\s+", " ", working).strip(" ,.-")
                if jur != "*":
                    # suffix hints give ISO-2; map to country-level jc
                    jc_hint = jur.lower()
                    candidates.append((jc_hint, 0.40))
                detected_type = etype

        # ── Pass 2: parse the country/jurisdiction field ──────────────────────
        if country:
            clow = _normalize(country)
            # Direct OpenCorporates code match (e.g. "us_mo", "ca_bc")
            if JR.lookup(clow):
                candidates.append((clow, 0.95))
            else:
                # ISO-2 match (e.g. "US", "GB")
                if len(clow) == 2 and clow.isalpha() and JR.lookup(clow):
                    candidates.append((clow, 0.90))
                else:
                    # Keyword lookup
                    for kw, jc in JURISDICTION_KEYWORDS.items():
                        if kw in clow or clow == jc:
                            candidates.append((jc, 0.90))
                            break

        # ── Pass 3: address field ─────────────────────────────────────────────
        if address:
            alow = _normalize(address)
            for kw, jc in JURISDICTION_KEYWORDS.items():
                if kw in alow:
                    candidates.append((jc, 0.65))
                    break

        # ── Pass 4: phone prefix ──────────────────────────────────────────────
        if phone:
            for prefix, jc in PHONE_PREFIX_MAP.items():
                if phone.startswith(prefix):
                    candidates.append((jc, 0.75))
                    break

        # ── Aggregate: vote by jurisdiction_code, pick winner ─────────────────
        best_jc   = "unknown"
        best_conf = 0.0

        if candidates:
            vote: dict[str, float] = {}
            for jc, conf in candidates:
                # Normalise to lower; if a candidate is just an ISO-2, keep it
                vote[jc] = vote.get(jc, 0.0) + conf
            best_jc   = max(vote, key=lambda k: vote[k])
            total     = sum(vote.values())
            best_conf = min(vote[best_jc] / total, 1.0) if total else 0.0

        # ── Lookup registry record ────────────────────────────────────────────
        jr_rec = JR.lookup(best_jc)
        if jr_rec:
            sovereign_iso2    = jr_rec.iso2
            jur_label         = jr_rec.label
            bucket            = jr_rec.region_bucket
            pref_taxonomy     = jr_rec.preferred_taxonomy
            is_naics          = jr_rec.is_naics_jurisdiction
        else:
            # Unknown code — best-effort extraction from the code itself
            parts             = best_jc.split("_")
            sovereign_iso2    = parts[0].upper() if parts else "UNKNOWN"
            jur_label         = best_jc.upper()
            bucket            = "OTHER"
            pref_taxonomy     = "ISIC_REV4"
            is_naics          = False

        clean = " ".join(w.capitalize() for w in working.split())

        return EntityProfile(
            original_name=company_name,
            clean_name=clean or company_name,
            jurisdiction_code=best_jc,
            detected_jurisdiction=sovereign_iso2,    # backwards-compat field
            jurisdiction_label=jur_label,
            region_bucket=bucket,
            preferred_taxonomy=pref_taxonomy,
            is_naics_jurisdiction=is_naics,
            detected_entity_type=detected_type,
            suffixes_found=list(dict.fromkeys(found_suffixes)),
            jurisdiction_confidence=round(best_conf, 3),
        )

    def batch_resolve(
        self,
        records: list[dict],
        name_col: str = "Org Name",
        address_col: str = "Address",
        country_col: str = "Country",
        jc_col: str = "jurisdiction_code",
    ) -> list[EntityProfile]:
        return [
            self.resolve(
                r.get(name_col, ""),
                r.get(address_col, ""),
                r.get(country_col, ""),
                jurisdiction_code=r.get(jc_col, ""),
            )
            for r in records
        ]
