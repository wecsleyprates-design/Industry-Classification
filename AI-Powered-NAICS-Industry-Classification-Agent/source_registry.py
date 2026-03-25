"""
Source Registry — All Data Sources (Current and Future)
========================================================
Single file that defines every classification source the Consensus Engine
can use. Adding a new source is one entry here + one connector function.

SOURCE TYPES
────────────
  REDSHIFT_TABLE  — data already in our Redshift warehouse
                    (no external API call needed at runtime)
  API_LIVE        — live external API call per classification request
  API_BATCH       — periodic batch file ingested to Redshift
  INTERNAL_FILE   — our own CSV/Parquet files
  AI_INFERENCE    — LLM / ML inference (no vendor API)

CURRENT STATUS
────────────────
  ACTIVE          — used in the current Consensus Engine
  SIMULATED       — simulated in the app; not yet wired to real API/table
  PLANNED         — designed, not yet implemented

PRODUCTION WIRING (what replaces the simulator)
─────────────────────────────────────────────────
  Each SIMULATED source has a `production_query` or `production_endpoint`
  field showing exactly what to call in production.

LIBERTY DATA NOTE
─────────────────
  Liberty Data is NOT present in build_matching_tables.py.
  The three sources defined there are:
    open_corporates → dev.datascience.open_corporates_standard_ml_2
    equifax         → dev.warehouse.equifax_us_standardized
    zoominfo        → dev.datascience.zoominfo_standard_ml_2
  Liberty Data (if it exists) would be a separate Redshift table
  to be added here when available.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class SourceDefinition:
    id: str                    # unique source identifier (matches data_simulator.py)
    label: str                 # human-readable name
    source_type: str           # REDSHIFT_TABLE | API_LIVE | API_BATCH | INTERNAL_FILE | AI_INFERENCE
    status: str                # ACTIVE | SIMULATED | PLANNED
    default_weight: float      # 0.0–1.0 used by FeatureEngineer
    coverage: str              # geographic coverage
    freshness: str             # how current is this data?
    industry_fields: list[str] # what industry fields does this source provide?
    production_query: str = "" # Redshift SQL or API endpoint for production
    notes: str = ""


SOURCE_REGISTRY: list[SourceDefinition] = [

    # ── ACTIVE / SIMULATED SOURCES ────────────────────────────────────────────

    SourceDefinition(
        id="opencorporates",
        label="OpenCorporates — Government Registry",
        source_type="REDSHIFT_TABLE",
        status="SIMULATED",
        default_weight=0.90,
        coverage="200+ jurisdictions (US, UK, EU, APAC, LATAM, MENA, Africa)",
        freshness="Updated nightly from government registries",
        industry_fields=[
            "industry_code_uids (pipe-delimited: us_naics-XXXXXX|uk_sic-XXXXX|ca_naics-XXXXXX)",
            "jurisdiction_code",
            "company_type",
        ],
        production_query="""
            -- From build_matching_tables.py (matching_v1.py pipeline)
            SELECT
                company_number || '|' || jurisdiction_code as id,
                company_name as business_name,
                street_address, postal_code, city,
                COALESCE(UPPER(TRIM(region)), 'MISSING') as region,
                country_code,
                industry_code_uids  -- pipe-delimited multi-taxonomy codes
            FROM dev.datascience.open_corporates_standard_ml_2
            WHERE company_number = '{matched_id}'
        """,
        notes="Highest weight source. Returns uk_sic, ca_naics, us_naics in one field. "
              "Trulioo .sicCode is the only other UK SIC source.",
    ),

    SourceDefinition(
        id="equifax",
        label="Equifax Commercial — Credit Bureau",
        source_type="REDSHIFT_TABLE",
        status="SIMULATED",
        default_weight=0.70,
        coverage="United States",
        freshness="Batch file — updated at unknown cadence (days to weeks old)",
        industry_fields=[
            "primnaicscode (6-digit US NAICS)",
            "primnaics_sector, _subsector, _industry_group, _industry (hierarchy)",
            "secnaics1–secnaics4 (up to 4 secondary NAICS with full hierarchy)",
            "primsic (4-digit US SIC 1987)",
            "secsic1–secsic4 (up to 4 secondary SIC)",
        ],
        production_query="""
            -- From build_matching_tables.py
            SELECT
                cast(efx_id as varchar) as id,
                efx_name as business_name,
                efx_eng_address as street_address,
                cast(efx_eng_zipcode as varchar) as postal_code,
                efx_eng_city as city,
                COALESCE(UPPER(TRIM(efx_eng_state)), 'MISSING') as region,
                primnaicscode, primsic,
                primnaics_sector, primnaics_subsector,
                secnaics1, secnaics2, secnaics3, secnaics4,
                secsic1, secsic2, secsic3, secsic4
            FROM dev.warehouse.equifax_us_standardized
            WHERE efx_id = '{matched_efx_id}'
        """,
        notes="Weight 0.70 because batch file may be stale. Currently only primnaicscode "
              "is wired in; all 24 other industry columns are available but unused.",
    ),

    SourceDefinition(
        id="trulioo",
        label="Trulioo — Global KYC/KYB",
        source_type="API_LIVE",
        status="SIMULATED",
        default_weight=0.80,
        coverage="UK, Canada, US, EU, APAC",
        freshness="Real-time (live API call per request)",
        industry_fields=[
            "clientData.standardizedIndustries[].naicsCode (6-digit US NAICS)",
            "clientData.standardizedIndustries[].sicCode (UK SIC — currently ignored!)",
            "clientData.standardizedIndustries[].industryName (text label)",
        ],
        production_query="""
            -- Live API call (integration-service sources.ts)
            POST https://api.trulioo.com/verifications/v1/verify
            {
              "AcceptTruliooTermsAndConditions": true,
              "ConfigurationName": "Business Identity Verification",
              "CountryCode": "{country_code}",
              "DataFields": {
                "Business": {
                  "BusinessName": "{company_name}",
                  "BusinessRegistrationNumber": "{reg_number}"
                }
              }
            }
            -- Response: clientData.standardizedIndustries[{naicsCode, sicCode, industryName}]
        """,
        notes="Known issue: sometimes returns 4-digit SIC for 5-digit jurisdiction (Trulioo Pollution). "
              ".sicCode field exists but is NOT read in integration-service. "
              "High weight for UK/Canada per truliooPreferredRule in rules.ts.",
    ),

    SourceDefinition(
        id="zoominfo",
        label="ZoomInfo — B2B Firmographics",
        source_type="REDSHIFT_TABLE",
        status="SIMULATED",
        default_weight=0.80,
        coverage="Global (stronger US coverage)",
        freshness="Updated frequently from ZoomInfo's proprietary database",
        industry_fields=[
            "zi_c_naics6 (6-digit US NAICS)",
            "zi_c_sic4 (4-digit US SIC — available but not wired in)",
            "zi_c_industry (text label)",
            "zi_c_sub_industry (sub-industry text)",
        ],
        production_query="""
            -- From build_matching_tables.py
            SELECT
                zi_c_company_id || '|' || zi_c_location_id as id,
                zi_c_name as business_name,
                zi_eng_address as street_address,
                zi_eng_zipcode as postal_code,
                zi_eng_city as city,
                COALESCE(zi_eng_state, 'MISSING') as region,
                country_code,
                zi_c_naics6,
                zi_c_sic4,      -- available but unused in current pipeline
                zi_c_industry,
                zi_c_sub_industry
            FROM dev.datascience.zoominfo_standard_ml_2
            WHERE zi_c_company_id = '{matched_zi_id}'
        """,
        notes="zi_c_sic4 is available in the Redshift table but not mapped to any fact. "
              "Strong US coverage; weaker for small/private companies.",
    ),

    SourceDefinition(
        id="duns",
        label="Dun & Bradstreet — DUNS",
        source_type="API_LIVE",
        status="SIMULATED",
        default_weight=0.85,
        coverage="Global (220+ countries)",
        freshness="Real-time (live API call)",
        industry_fields=[
            "primaryIndustryCode.usSicV4 (4-digit US SIC)",
            "primaryIndustryCode.naicsCode (6-digit US NAICS)",
            "primaryIndustryCode.description",
            "industryCodes[] (full list of all industry codes)",
        ],
        production_query="""
            -- D&B Direct+ API
            GET https://plus.dnb.com/v1/data/duns/{duns_number}
            Headers: Authorization: Bearer {token}
            -- Response: organization.primaryIndustryCode.naicsCode
            --           organization.industryCodes[*].code
        """,
        notes="Covers NAICS + SIC + NACE for EU entities. Strong global coverage. "
              "Requires DUNS number — entity matching must resolve DUNS first.",
    ),

    SourceDefinition(
        id="ai_semantic",
        label="AI Semantic Enrichment — GPT-4o-mini + Web",
        source_type="AI_INFERENCE",
        status="ACTIVE",
        default_weight=0.70,
        coverage="Global (web search based)",
        freshness="Real-time (live web search + LLM inference)",
        industry_fields=[
            "naics_code (inferred)",
            "uk_sic_code (inferred — if jurisdiction is GB)",
            "mcc_code (inferred)",
            "naics_description, mcc_description, reasoning, confidence",
        ],
        production_query="""
            -- llm_enrichment.py → OpenAI GPT-4o-mini
            -- DuckDuckGo web search for company profile
            -- UGO FAISS semantic search for candidate codes
            -- JSON mode structured output
        """,
        notes="Lowest weight (0.70) — fallback when vendors have no data. "
              "Only source that can return UK SIC for non-UK registry entities.",
    ),

    # ── PLANNED SOURCES ──────────────────────────────────────────────────────

    SourceDefinition(
        id="liberty_data",
        label="Liberty Data (if available in Redshift)",
        source_type="REDSHIFT_TABLE",
        status="PLANNED",
        default_weight=0.75,
        coverage="TBD",
        freshness="TBD — depends on ingestion cadence",
        industry_fields=["TBD — to be determined from Liberty Data schema"],
        production_query="""
            -- Add Liberty Data Redshift table query here
            -- Extend build_matching_tables.py SOURCES dict:
            -- 'liberty_data': 'SELECT ... FROM dev.warehouse.liberty_data_standard'
        """,
        notes="NOT present in current build_matching_tables.py (only open_corporates, "
              "equifax, zoominfo are defined there). Add when table is available.",
    ),

    SourceDefinition(
        id="gleif",
        label="GLEIF — Legal Entity Identifier (LEI)",
        source_type="API_LIVE",
        status="PLANNED",
        default_weight=0.88,
        coverage="Global (all jurisdictions with LEI registration)",
        freshness="Real-time",
        industry_fields=[
            "entity.legalJurisdiction",
            "entity.entityCategory (BRANCH / FUND / SOLE_PROPRIETOR / GENERAL)",
            "entity.associatedEntity (for fund/branch relationships)",
        ],
        production_query="""
            GET https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]={company_name}
            -- Returns LEI, jurisdiction, entity type, ultimate parent
        """,
        notes="No direct industry code but provides authoritative entity type, "
              "jurisdiction, and parent-child relationships. Useful for holding company detection.",
    ),

    SourceDefinition(
        id="companies_house",
        label="Companies House — UK Official Registry",
        source_type="API_LIVE",
        status="PLANNED",
        default_weight=0.95,
        coverage="United Kingdom",
        freshness="Real-time (Companies House public API)",
        industry_fields=[
            "sic_codes[] (list of UK SIC 2007 codes — up to 4)",
            "company_type (ltd, plc, llp…)",
            "company_status (active, dissolved, dormant…)",
        ],
        production_query="""
            GET https://api.company-information.service.gov.uk/search/companies?q={company_name}
            Headers: Authorization: Basic {base64_api_key}
            -- Response: items[0].company_number
            -- Then: GET /company/{company_number} → sic_codes[]
        """,
        notes="Free public API. Would give UK SIC codes with full authority — "
              "higher weight than OpenCorporates for GB entities. "
              "Should be P0 addition for UK classification.",
    ),

    SourceDefinition(
        id="opencorporates_api",
        label="OpenCorporates — Live API (vs Redshift table)",
        source_type="API_LIVE",
        status="PLANNED",
        default_weight=0.92,
        coverage="200+ jurisdictions",
        freshness="Real-time (more current than Redshift table copy)",
        industry_fields=[
            "industry_code_uids (same pipe-delimited format as Redshift table)",
            "but fresher — captures recent re-registrations",
        ],
        production_query="""
            GET https://api.opencorporates.com/v0.4/companies/search?q={company_name}&jurisdiction_code={jc}
            Headers: api_token: {token}
        """,
        notes="Same data as Redshift table but real-time. Use for companies "
              "that don't have a Redshift match (recently registered).",
    ),

    SourceDefinition(
        id="manual_override",
        label="Manual Override — Human-verified classification",
        source_type="INTERNAL_FILE",
        status="ACTIVE",
        default_weight=1.00,
        coverage="Any company that has been manually reviewed",
        freshness="Updated by compliance/underwriting team",
        industry_fields=[
            "naics_code (verified)",
            "uk_sic_code (verified)",
            "industry (verified sector)",
            "reviewed_by, reviewed_at, notes",
        ],
        production_query="""
            -- rel_business_industry_naics WHERE platform = 'manual'
            SELECT naics_id, industry_id FROM rel_business_industry_naics
            WHERE business_id = '{business_id}' AND platform = 'manual'
        """,
        notes="Highest weight (1.00). Always wins over any vendor source. "
              "Used to retrain XGBoost consensus model with ground truth. "
              "Currently the only source that can override AI+vendor consensus.",
    ),
]

# ── Fast lookup helpers ───────────────────────────────────────────────────────
_BY_ID:     dict[str, SourceDefinition] = {s.id: s for s in SOURCE_REGISTRY}
_BY_STATUS: dict[str, list[SourceDefinition]] = {}
for _s in SOURCE_REGISTRY:
    _BY_STATUS.setdefault(_s.status, []).append(_s)


def get_source(source_id: str) -> Optional[SourceDefinition]:
    return _BY_ID.get(source_id)


def active_sources() -> list[SourceDefinition]:
    return _BY_STATUS.get("ACTIVE", []) + _BY_STATUS.get("SIMULATED", [])


def planned_sources() -> list[SourceDefinition]:
    return _BY_STATUS.get("PLANNED", [])


def all_sources() -> list[SourceDefinition]:
    return SOURCE_REGISTRY
