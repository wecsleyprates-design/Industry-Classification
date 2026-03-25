"""
Jurisdiction Registry
=====================
Single source of truth for every jurisdiction code the system handles.

Format follows the OpenCorporates convention:
  • Pure country  → ISO 3166-1 alpha-2   e.g. "gb", "de", "th"
  • US state      → "us_<state>"         e.g. "us_mo", "us_ca", "us_dc"
  • Canadian prov → "ca_<prov>"          e.g. "ca_bc", "ca_qc", "ca_nu"
  • UAE emirate   → "ae_<emirate>"       e.g. "ae_az" (Abu Dhabi)
  • Other sub-nat → "<country>_<region>" e.g. "gb_eng", "au_nsw"

Every entry exposes:
  iso2            : ISO 3166-1 alpha-2 of the sovereign country
  region_code     : OpenCorporates jurisdiction_code (lower-case)
  label           : Human-readable name
  is_subnational  : True for state/province/emirate-level codes
  region_bucket   : Coarse grouping used by the FeatureEngineer
                    ("US", "US_STATE", "CA", "CA_PROV", "EU", "APAC",
                     "LATAM", "MENA", "AFRICA", "OTHER")
  preferred_taxonomy : Best-fit taxonomy for this jurisdiction
  is_naics_jurisdiction : True when NAICS 2022 is the primary taxonomy
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class Jurisdiction:
    region_code: str          # lower-case, e.g. "us_mo"
    iso2: str                 # sovereign ISO-2, e.g. "US"
    label: str
    is_subnational: bool
    region_bucket: str        # coarse region for feature engineering
    preferred_taxonomy: str   # e.g. "US_NAICS_2022"
    is_naics_jurisdiction: bool = False


# ── Complete jurisdiction table ───────────────────────────────────────────────
#
# Sources: OpenCorporates jurisdiction list + user-provided codes +
#          ISO 3166 alpha-2 full list.
#
# Organised as: US states → Canadian provinces → UAE emirates → Countries
#
JURISDICTION_TABLE: list[Jurisdiction] = [

    # ── United States — federal ───────────────────────────────────────────────
    Jurisdiction("us",     "US", "United States",               False, "US",       "US_NAICS_2022", True),

    # ── US States / Territories (us_<state>) ─────────────────────────────────
    Jurisdiction("us_al",  "US", "Alabama",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ak",  "US", "Alaska",                      True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_az",  "US", "Arizona",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ar",  "US", "Arkansas",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ca",  "US", "California",                  True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_co",  "US", "Colorado",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ct",  "US", "Connecticut",                 True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_de",  "US", "Delaware",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_dc",  "US", "District of Columbia",        True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_fl",  "US", "Florida",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ga",  "US", "Georgia",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_hi",  "US", "Hawaii",                      True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_id",  "US", "Idaho",                       True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_il",  "US", "Illinois",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_in",  "US", "Indiana",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ia",  "US", "Iowa",                        True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ks",  "US", "Kansas",                      True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ky",  "US", "Kentucky",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_la",  "US", "Louisiana",                   True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_me",  "US", "Maine",                       True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_md",  "US", "Maryland",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ma",  "US", "Massachusetts",               True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_mi",  "US", "Michigan",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_mn",  "US", "Minnesota",                   True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ms",  "US", "Mississippi",                 True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_mo",  "US", "Missouri",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_mt",  "US", "Montana",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ne",  "US", "Nebraska",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nv",  "US", "Nevada",                      True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nh",  "US", "New Hampshire",               True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nj",  "US", "New Jersey",                  True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nm",  "US", "New Mexico",                  True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ny",  "US", "New York",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nc",  "US", "North Carolina",              True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_nd",  "US", "North Dakota",                True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_oh",  "US", "Ohio",                        True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ok",  "US", "Oklahoma",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_or",  "US", "Oregon",                      True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_pa",  "US", "Pennsylvania",                True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ri",  "US", "Rhode Island",                True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_sc",  "US", "South Carolina",              True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_sd",  "US", "South Dakota",                True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_tn",  "US", "Tennessee",                   True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_tx",  "US", "Texas",                       True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_ut",  "US", "Utah",                        True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_vt",  "US", "Vermont",                     True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_va",  "US", "Virginia",                    True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_wa",  "US", "Washington",                  True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_wv",  "US", "West Virginia",               True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_wi",  "US", "Wisconsin",                   True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_wy",  "US", "Wyoming",                     True,  "US_STATE", "US_NAICS_2022", True),

    # ── US Territories ────────────────────────────────────────────────────────
    Jurisdiction("pr",     "US", "Puerto Rico",                 True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_pr",  "US", "Puerto Rico",                 True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_gu",  "US", "Guam",                        True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_vi",  "US", "US Virgin Islands",           True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_as",  "US", "American Samoa",              True,  "US_STATE", "US_NAICS_2022", True),
    Jurisdiction("us_mp",  "US", "Northern Mariana Islands",    True,  "US_STATE", "US_NAICS_2022", True),

    # ── Canada — federal ──────────────────────────────────────────────────────
    Jurisdiction("ca",     "CA", "Canada",                      False, "CA",       "US_NAICS_2022", True),

    # ── Canadian Provinces / Territories ─────────────────────────────────────
    Jurisdiction("ca_ab",  "CA", "Alberta",                     True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_bc",  "CA", "British Columbia",            True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_mb",  "CA", "Manitoba",                    True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_nb",  "CA", "New Brunswick",               True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_nl",  "CA", "Newfoundland and Labrador",   True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_ns",  "CA", "Nova Scotia",                 True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_nt",  "CA", "Northwest Territories",       True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_nu",  "CA", "Nunavut",                     True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_on",  "CA", "Ontario",                     True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_pe",  "CA", "Prince Edward Island",        True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_qc",  "CA", "Quebec",                      True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_sk",  "CA", "Saskatchewan",                True,  "CA_PROV",  "US_NAICS_2022", True),
    Jurisdiction("ca_yt",  "CA", "Yukon",                       True,  "CA_PROV",  "US_NAICS_2022", True),

    # ── UAE — federal + emirates ──────────────────────────────────────────────
    Jurisdiction("ae",     "AE", "United Arab Emirates",        False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_az",  "AE", "Abu Dhabi",                   True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_du",  "AE", "Dubai",                       True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_sh",  "AE", "Sharjah",                     True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_aj",  "AE", "Ajman",                       True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_fu",  "AE", "Fujairah",                    True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_rk",  "AE", "Ras Al Khaimah",              True,  "MENA",     "ISIC_REV4", False),
    Jurisdiction("ae_uq",  "AE", "Umm Al Quwain",               True,  "MENA",     "ISIC_REV4", False),

    # ── Australia — federal + states ──────────────────────────────────────────
    Jurisdiction("au",     "AU", "Australia",                   False, "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_nsw", "AU", "New South Wales",             True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_vic", "AU", "Victoria",                    True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_qld", "AU", "Queensland",                  True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_wa",  "AU", "Western Australia",           True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_sa",  "AU", "South Australia",             True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_tas", "AU", "Tasmania",                    True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_act", "AU", "Australian Capital Territory",True,  "APAC",     "US_NAICS_2022", True),
    Jurisdiction("au_nt",  "AU", "Northern Territory",          True,  "APAC",     "US_NAICS_2022", True),

    # ── United Kingdom ────────────────────────────────────────────────────────
    Jurisdiction("gb",     "GB", "United Kingdom",              False, "EU",       "UK_SIC_2007", False),
    Jurisdiction("gb_eng", "GB", "England",                     True,  "EU",       "UK_SIC_2007", False),
    Jurisdiction("gb_sct", "GB", "Scotland",                    True,  "EU",       "UK_SIC_2007", False),
    Jurisdiction("gb_wls", "GB", "Wales",                       True,  "EU",       "UK_SIC_2007", False),
    Jurisdiction("gb_nir", "GB", "Northern Ireland",            True,  "EU",       "UK_SIC_2007", False),
    Jurisdiction("gg",     "GB", "Guernsey",                    True,  "EU",       "UK_SIC_2007", False),
    Jurisdiction("je",     "GB", "Jersey",                      True,  "EU",       "UK_SIC_2007", False),

    # ── European Union & EEA ──────────────────────────────────────────────────
    Jurisdiction("al",     "AL", "Albania",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("at",     "AT", "Austria",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("be",     "BE", "Belgium",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("bg",     "BG", "Bulgaria",                    False, "EU",       "NACE_REV2", False),
    Jurisdiction("by",     "BY", "Belarus",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("ch",     "CH", "Switzerland",                 False, "EU",       "NACE_REV2", False),
    Jurisdiction("cy",     "CY", "Cyprus",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("cz",     "CZ", "Czech Republic",              False, "EU",       "NACE_REV2", False),
    Jurisdiction("de",     "DE", "Germany",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("dk",     "DK", "Denmark",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("ee",     "EE", "Estonia",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("es",     "ES", "Spain",                       False, "EU",       "NACE_REV2", False),
    Jurisdiction("fi",     "FI", "Finland",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("fr",     "FR", "France",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("gi",     "GI", "Gibraltar",                   False, "EU",       "NACE_REV2", False),
    Jurisdiction("gl",     "GL", "Greenland",                   False, "EU",       "NACE_REV2", False),
    Jurisdiction("gp",     "GP", "Guadeloupe",                  False, "EU",       "NACE_REV2", False),
    Jurisdiction("gr",     "GR", "Greece",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("hr",     "HR", "Croatia",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("hu",     "HU", "Hungary",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("ie",     "IE", "Ireland",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("is",     "IS", "Iceland",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("it",     "IT", "Italy",                       False, "EU",       "NACE_REV2", False),
    Jurisdiction("li",     "LI", "Liechtenstein",               False, "EU",       "NACE_REV2", False),
    Jurisdiction("lt",     "LT", "Lithuania",                   False, "EU",       "NACE_REV2", False),
    Jurisdiction("lu",     "LU", "Luxembourg",                  False, "EU",       "NACE_REV2", False),
    Jurisdiction("lv",     "LV", "Latvia",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("mc",     "MC", "Monaco",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("md",     "MD", "Moldova",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("me",     "ME", "Montenegro",                  False, "EU",       "NACE_REV2", False),
    Jurisdiction("mk",     "MK", "North Macedonia",             False, "EU",       "NACE_REV2", False),
    Jurisdiction("mt",     "MT", "Malta",                       False, "EU",       "NACE_REV2", False),
    Jurisdiction("nl",     "NL", "Netherlands",                 False, "EU",       "NACE_REV2", False),
    Jurisdiction("no",     "NO", "Norway",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("pl",     "PL", "Poland",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("pm",     "PM", "Saint Pierre and Miquelon",   False, "EU",       "NACE_REV2", False),
    Jurisdiction("pt",     "PT", "Portugal",                    False, "EU",       "NACE_REV2", False),
    Jurisdiction("re",     "RE", "Réunion",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("ro",     "RO", "Romania",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("rs",     "RS", "Serbia",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("ru",     "RU", "Russia",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("se",     "SE", "Sweden",                      False, "EU",       "NACE_REV2", False),
    Jurisdiction("si",     "SI", "Slovenia",                    False, "EU",       "NACE_REV2", False),
    Jurisdiction("sk",     "SK", "Slovakia",                    False, "EU",       "NACE_REV2", False),
    Jurisdiction("sm",     "SM", "San Marino",                  False, "EU",       "NACE_REV2", False),
    Jurisdiction("ua",     "UA", "Ukraine",                     False, "EU",       "NACE_REV2", False),
    Jurisdiction("va",     "VA", "Vatican City",                False, "EU",       "NACE_REV2", False),
    Jurisdiction("xk",     "XK", "Kosovo",                      False, "EU",       "NACE_REV2", False),

    # ── Asia-Pacific ──────────────────────────────────────────────────────────
    Jurisdiction("bd",     "BD", "Bangladesh",                  False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("bn",     "BN", "Brunei",                      False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("cn",     "CN", "China",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("hk",     "HK", "Hong Kong",                   False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("id",     "ID", "Indonesia",                   False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("in",     "IN", "India",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("jp",     "JP", "Japan",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("kh",     "KH", "Cambodia",                    False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("kr",     "KR", "South Korea",                 False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("la",     "LA", "Laos",                        False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("lk",     "LK", "Sri Lanka",                   False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("mm",     "MM", "Myanmar",                     False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("mn",     "MN", "Mongolia",                    False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("mo",     "MO", "Macao",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("my",     "MY", "Malaysia",                    False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("np",     "NP", "Nepal",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("nz",     "NZ", "New Zealand",                 False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("ph",     "PH", "Philippines",                 False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("pk",     "PK", "Pakistan",                    False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("sg",     "SG", "Singapore",                   False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("th",     "TH", "Thailand",                    False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("tj",     "TJ", "Tajikistan",                  False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("tl",     "TL", "Timor-Leste",                 False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("to",     "TO", "Tonga",                       False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("tw",     "TW", "Taiwan",                      False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("vn",     "VN", "Vietnam",                     False, "APAC",     "ISIC_REV4", False),
    Jurisdiction("vu",     "VU", "Vanuatu",                     False, "APAC",     "ISIC_REV4", False),

    # ── Latin America & Caribbean ─────────────────────────────────────────────
    Jurisdiction("ar",     "AR", "Argentina",                   False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("aw",     "AW", "Aruba",                       False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("bb",     "BB", "Barbados",                    False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("bo",     "BO", "Bolivia",                     False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("br",     "BR", "Brazil",                      False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("bz",     "BZ", "Belize",                      False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("cl",     "CL", "Chile",                       False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("co",     "CO", "Colombia",                    False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("cr",     "CR", "Costa Rica",                  False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("cu",     "CU", "Cuba",                        False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("cw",     "CW", "Curaçao",                     False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("do",     "DO", "Dominican Republic",          False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("ec",     "EC", "Ecuador",                     False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("gt",     "GT", "Guatemala",                   False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("gy",     "GY", "Guyana",                      False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("hn",     "HN", "Honduras",                    False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("ht",     "HT", "Haiti",                       False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("jm",     "JM", "Jamaica",                     False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("ky",     "KY", "Cayman Islands",              False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("mx",     "MX", "Mexico",                      False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("ni",     "NI", "Nicaragua",                   False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("pa",     "PA", "Panama",                      False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("pe",     "PE", "Peru",                        False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("py",     "PY", "Paraguay",                    False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("sv",     "SV", "El Salvador",                 False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("tt",     "TT", "Trinidad and Tobago",         False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("uy",     "UY", "Uruguay",                     False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("ve",     "VE", "Venezuela",                   False, "LATAM",    "ISIC_REV4", False),
    Jurisdiction("vg",     "VG", "British Virgin Islands",      False, "LATAM",    "ISIC_REV4", False),

    # ── Middle East & North Africa ────────────────────────────────────────────
    Jurisdiction("bh",     "BH", "Bahrain",                     False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("dz",     "DZ", "Algeria",                     False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("eg",     "EG", "Egypt",                       False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("il",     "IL", "Israel",                      False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("iq",     "IQ", "Iraq",                        False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ir",     "IR", "Iran",                        False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("jo",     "JO", "Jordan",                      False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("kw",     "KW", "Kuwait",                      False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("lb",     "LB", "Lebanon",                     False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ly",     "LY", "Libya",                       False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ma",     "MA", "Morocco",                     False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("om",     "OM", "Oman",                        False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ps",     "PS", "Palestine",                   False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("qa",     "QA", "Qatar",                       False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("sa",     "SA", "Saudi Arabia",                False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("sy",     "SY", "Syria",                       False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("tn",     "TN", "Tunisia",                     False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("tr",     "TR", "Turkey",                      False, "MENA",     "ISIC_REV4", False),
    Jurisdiction("ye",     "YE", "Yemen",                       False, "MENA",     "ISIC_REV4", False),

    # ── Africa (Sub-Saharan) ──────────────────────────────────────────────────
    Jurisdiction("ao",     "AO", "Angola",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("bj",     "BJ", "Benin",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("bw",     "BW", "Botswana",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("cd",     "CD", "DR Congo",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("cf",     "CF", "Central African Republic",    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("cg",     "CG", "Republic of Congo",           False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ci",     "CI", "Ivory Coast",                 False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("cm",     "CM", "Cameroon",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("cv",     "CV", "Cape Verde",                  False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("dj",     "DJ", "Djibouti",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("er",     "ER", "Eritrea",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("et",     "ET", "Ethiopia",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ga",     "GA", "Gabon",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("gh",     "GH", "Ghana",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("gm",     "GM", "Gambia",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("gn",     "GN", "Guinea",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("gw",     "GW", "Guinea-Bissau",               False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ke",     "KE", "Kenya",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("km",     "KM", "Comoros",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("lr",     "LR", "Liberia",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ls",     "LS", "Lesotho",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("mg",     "MG", "Madagascar",                  False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ml",     "ML", "Mali",                        False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("mr",     "MR", "Mauritania",                  False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("mu",     "MU", "Mauritius",                   False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("mw",     "MW", "Malawi",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("mz",     "MZ", "Mozambique",                  False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("na",     "NA", "Namibia",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ne",     "NE", "Niger",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ng",     "NG", "Nigeria",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("rw",     "RW", "Rwanda",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("sc",     "SC", "Seychelles",                  False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("sd",     "SD", "Sudan",                       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("sl",     "SL", "Sierra Leone",                False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("sn",     "SN", "Senegal",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("so",     "SO", "Somalia",                     False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ss",     "SS", "South Sudan",                 False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("st",     "ST", "Sao Tome and Principe",       False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("sz",     "SZ", "Eswatini",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("td",     "TD", "Chad",                        False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("tg",     "TG", "Togo",                        False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("tz",     "TZ", "Tanzania",                    False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("ug",     "UG", "Uganda",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("za",     "ZA", "South Africa",                False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("zm",     "ZM", "Zambia",                      False, "AFRICA",   "ISIC_REV4", False),
    Jurisdiction("zw",     "ZW", "Zimbabwe",                    False, "AFRICA",   "ISIC_REV4", False),

    # ── Other / Oceania / Small Islands ──────────────────────────────────────
    Jurisdiction("fj",     "FJ", "Fiji",                        False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("fm",     "FM", "Micronesia",                  False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("ki",     "KI", "Kiribati",                    False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("mh",     "MH", "Marshall Islands",            False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("mp",     "MP", "Northern Mariana Islands",    False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("nr",     "NR", "Nauru",                       False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("pg",     "PG", "Papua New Guinea",            False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("pw",     "PW", "Palau",                       False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("sb",     "SB", "Solomon Islands",             False, "OTHER",    "ISIC_REV4", False),
    Jurisdiction("ws",     "WS", "Samoa",                       False, "OTHER",    "ISIC_REV4", False),
]


# ── Fast lookup indexes built once at import time ─────────────────────────────
_BY_CODE:   dict[str, Jurisdiction] = {j.region_code: j for j in JURISDICTION_TABLE}
_BY_ISO2:   dict[str, list[Jurisdiction]] = {}
_BY_BUCKET: dict[str, list[Jurisdiction]] = {}

for _j in JURISDICTION_TABLE:
    _BY_ISO2.setdefault(_j.iso2, []).append(_j)
    _BY_BUCKET.setdefault(_j.region_bucket, []).append(_j)


# ── Public helpers ────────────────────────────────────────────────────────────

def lookup(jurisdiction_code: str) -> Optional[Jurisdiction]:
    """
    Resolve any jurisdiction_code (case-insensitive) to a Jurisdiction record.
    Returns None for unknown codes.
    """
    return _BY_CODE.get(jurisdiction_code.lower().strip())


def resolve_iso2(jurisdiction_code: str) -> str:
    """
    Return the sovereign ISO-2 for any jurisdiction_code.
    Falls back to uppercasing the input if unknown.
    """
    j = lookup(jurisdiction_code)
    if j:
        return j.iso2
    # Best-effort: if the code has no underscore, assume it IS the ISO-2
    code = jurisdiction_code.lower().strip()
    if "_" not in code and len(code) == 2:
        return code.upper()
    # "us_mo" → "US"
    if "_" in code:
        return code.split("_")[0].upper()
    return "UNKNOWN"


def preferred_taxonomy(jurisdiction_code: str) -> str:
    """Return the best-fit taxonomy for a jurisdiction_code."""
    j = lookup(jurisdiction_code)
    return j.preferred_taxonomy if j else "ISIC_REV4"


def region_bucket(jurisdiction_code: str) -> str:
    """Return the coarse region bucket (US, EU, APAC, …) for feature engineering."""
    j = lookup(jurisdiction_code)
    return j.region_bucket if j else "OTHER"


def all_codes() -> list[str]:
    """Return every registered jurisdiction_code."""
    return list(_BY_CODE.keys())


def is_naics_jurisdiction(jurisdiction_code: str) -> bool:
    """True when NAICS 2022 is the primary taxonomy for this jurisdiction."""
    j = lookup(jurisdiction_code)
    return j.is_naics_jurisdiction if j else False


def is_eu_jurisdiction(jurisdiction_code: str) -> bool:
    return region_bucket(jurisdiction_code) == "EU"


def is_apac_jurisdiction(jurisdiction_code: str) -> bool:
    return region_bucket(jurisdiction_code) == "APAC"


def is_latam_jurisdiction(jurisdiction_code: str) -> bool:
    return region_bucket(jurisdiction_code) == "LATAM"


def is_mena_jurisdiction(jurisdiction_code: str) -> bool:
    return region_bucket(jurisdiction_code) == "MENA"


def is_africa_jurisdiction(jurisdiction_code: str) -> bool:
    return region_bucket(jurisdiction_code) == "AFRICA"


# Region bucket → integer index (for one-hot style encoding)
BUCKET_INDEX: dict[str, int] = {
    "US":       0,
    "US_STATE": 1,
    "CA":       2,
    "CA_PROV":  3,
    "EU":       4,
    "APAC":     5,
    "LATAM":    6,
    "MENA":     7,
    "AFRICA":   8,
    "OTHER":    9,
}
N_BUCKETS = len(BUCKET_INDEX)   # 10


def bucket_one_hot(jurisdiction_code: str) -> list[float]:
    """
    Return a 10-element one-hot vector for the region bucket.
    Used by FeatureEngineer to replace the old 4 hard-coded flags.
    """
    vec = [0.0] * N_BUCKETS
    bucket = region_bucket(jurisdiction_code)
    idx = BUCKET_INDEX.get(bucket, N_BUCKETS - 1)
    vec[idx] = 1.0
    return vec
