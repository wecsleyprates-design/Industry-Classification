"""
Worth AI Field Lineage Data
Comprehensive mapping of every API field from the [WS] UCM Q/A sheet to its:
  - Sources (vendors, platform IDs, weights, confidence model)
  - Storage (tables, schemas)
  - Fact Engine rules (how winner is selected)
  - When it is NULL / blank and why
  - Where it appears in the admin UI
  - GPN questions and confirmed answers from the Working Session
"""

# ── Source reference ───────────────────────────────────────────────────────────
SOURCES = {
    "middesk": {
        "name": "Middesk (Secretary of State)",
        "platform_id": 16,
        "weight": 2.0,
        "scope": "business",
        "confidence_model": "Task-based: base 0.15 + 0.20 each for name/TIN/address/SOS tasks passing (max 0.95)",
        "api_type": "Live REST API — called per business submission",
        "storage": "integration_data.request_response (platform_id=16)",
        "description": "Primary SoS registry verifier. Provides entity registration data, TIN match, addresses, officers.",
    },
    "opencorporates": {
        "name": "OpenCorporates",
        "platform_id": 23,
        "weight": 0.9,
        "scope": "business",
        "confidence_model": "XGBoost entity-match model — match.index/55 → probability 0–1",
        "api_type": "Redshift pre-loaded — queried from datascience.oc_matches_custom_inc_ml",
        "storage": "integration_data.request_response (platform_id=23) + warehouse.oc_companies_latest",
        "description": "Global company registry data. Covers UK, EU, Canada, US. Provides SoS filings, classification codes.",
    },
    "zoominfo": {
        "name": "ZoomInfo",
        "platform_id": 24,
        "weight": 0.8,
        "scope": "business",
        "confidence_model": "XGBoost entity-match model — match.index/55",
        "api_type": "Redshift pre-loaded — queried from datascience.zoominfo_matches_custom_inc_ml",
        "storage": "integration_data.request_response (platform_id=24) + zoominfo.comp_standard_global",
        "description": "Commercial firmographic data. Provides NAICS, SIC, employees, revenue, website, addresses.",
    },
    "equifax": {
        "name": "Equifax",
        "platform_id": 17,
        "weight": 0.7,
        "scope": "business",
        "confidence_model": "XGBoost entity-match model — prediction score",
        "api_type": "Redshift pre-loaded — queried from datascience.efx_matches_custom_inc_ml",
        "storage": "integration_data.request_response (platform_id=17) + warehouse.equifax_us_latest",
        "description": "Credit bureau data. Provides NAICS, SIC, employees, addresses, TIN, credit data.",
    },
    "trulioo": {
        "name": "Trulioo (KYB Live API)",
        "platform_id": 38,
        "weight": 0.8,
        "scope": "business",
        "confidence_model": "Status-based: completed/success → high; failed/error → low",
        "api_type": "Live REST API — called per business submission",
        "storage": "integration_data.request_response (platform_id=38)",
        "description": "Global KYB provider. Covers UK, Canada, and others. Provides SoS data, watchlists, director info.",
    },
    "ai_naics": {
        "name": "AI Enrichment — GPT-5-mini (NAICS/MCC)",
        "platform_id": 31,
        "weight": 0.1,
        "scope": "business",
        "confidence_model": "Self-reported: HIGH/MED/LOW from GPT response; stored as ai_naics_enrichment_metadata fact",
        "api_type": "Deferred AI task — triggered by Fact Engine when vendor NAICS count < minimumSources",
        "storage": "integration_data.request_response (platform_id=31); facts table naics_code, mcc_code",
        "description": "Fallback AI classifier. Returns 561499/5614 as last resort when no vendor NAICS found.",
    },
    "plaid": {
        "name": "Plaid (IDV)",
        "platform_id": 40,
        "weight": 1.0,
        "scope": "person",
        "confidence_model": "Status-based: SUCCESS/FAILED/PENDING per owner",
        "api_type": "Live OAuth flow — initiated per owner",
        "storage": "integration_data.request_response (platform_id=40)",
        "description": "Identity verification for owners. Verifies SSN, DOB, address via document or database check.",
    },
    "serp": {
        "name": "SERP / Web Scraping",
        "platform_id": 22,
        "weight": 0.5,
        "scope": "business",
        "confidence_model": "Heuristic — presence of structured data",
        "api_type": "Web scraping — triggered on business submission",
        "storage": "integration_data.request_response (platform_id=22)",
        "description": "Web intelligence — website URL, business description, Google Places ID.",
    },
    "manual": {
        "name": "Manual Override (Worth Analyst)",
        "platform_id": 0,
        "weight": 10.0,
        "scope": "business",
        "confidence_model": "Always 1.0 — highest priority by design",
        "api_type": "Internal — entered by analyst in admin UI or via manual-score-service",
        "storage": "integration_data.request_response (manual platform) + rds_warehouse_public.facts override field",
        "description": "Manual analyst override. Prepended as first rule in Fact Engine — always wins.",
    },
    "businessDetails": {
        "name": "Applicant Submission (OnDemand / UCM)",
        "platform_id": 0,
        "weight": 1.0,
        "scope": "business",
        "confidence_model": "Always 1.0 for submitted values",
        "api_type": "Internal — submitted by customer/UCM at onboarding",
        "storage": "rds_cases_public.data_businesses, data_owners",
        "description": "Data submitted by the applicant: business name, address, TIN, owners, website.",
    },
    "google": {
        "name": "Google Places / Google Profile",
        "platform_id": 29,
        "weight": 0.6,
        "scope": "business",
        "confidence_model": "Match/No-match — address comparison",
        "api_type": "Google Places API — triggered by SERP scraping",
        "storage": "integration_data.request_response (platform_id=29)",
        "description": "Google Business Profile. Verifies address, phone, website, business name.",
    },
    "verdata": {
        "name": "Verdata / VerifiedFirst",
        "platform_id": 35,
        "weight": 0.6,
        "scope": "business",
        "confidence_model": "Match score from vendor response",
        "api_type": "Live API",
        "storage": "integration_data.request_response (platform_id=35)",
        "description": "Alternate registry / domain verification source.",
    },
}

# ── Fact Engine rules reference ────────────────────────────────────────────────
RULES = {
    "manualOverride": "ALWAYS FIRST — if analyst has manually set a value, it wins over all vendor data",
    "factWithHighestConfidence": "Select the vendor whose confidence score is highest; if within 0.05 threshold, use factWithHighestWeight as tiebreaker",
    "factWithHighestWeight": "Select the vendor with the highest source weight (Middesk=2.0, OC=0.9, ZI=0.8, Trulioo=0.8, EFX=0.7, AI=0.1)",
    "combineFacts": "Merge values from all sources into a deduplicated array (used for addresses, names, people)",
    "registryPreferredRule": "Prefer OpenCorporates for classification facts (classification_codes); fall back to highest confidence",
    "truliooPreferredRule": "Prefer Trulioo for UK/Canada businesses; fall back to highest confidence",
    "combineWatchlistMetadata": "Merge watchlist hits from all sources (Middesk, Trulioo-business, Trulioo-person) with deduplication by type+title+entity_name+url",
}

# ── Field-level lineage ────────────────────────────────────────────────────────
FIELD_LINEAGE = {

    "tin.value": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Tax ID Verification",
        "api_fact_name": "tin_match_boolean",
        "api_field_path": "tin.value → use tin_match_boolean.value",
        "display_name": "Tax ID Number (EIN) Verification",
        "admin_ui_location": "KYB → Background → Business Registration card: Tax ID Number (EIN)",
        "description": (
            "tin.value is the raw EIN submitted by the applicant. "
            "The field shown for VERIFICATION in UCM is tin_match_boolean.value (true/false), "
            "not the raw TIN. TRUE = TIN matches legal name per IRS (via Middesk TIN task). "
            "FALSE = Unverified — TIN and legal name do NOT match."
        ),
        "sources": ["middesk", "businessDetails", "trulioo"],
        "source_detail": {
            "middesk": "reviewTasks[key='tin'].status — SUCCESS maps to TRUE, all else maps to FALSE. Middesk submits TIN to IRS and checks legal name match.",
            "trulioo": "Trulioo performs TIN-to-name match for UK/Canada businesses; falls back for US.",
            "businessDetails": "Submitted TIN from onboarding form — this is what gets MASKED and stored as tin_submitted.",
        },
        "fact_engine_rule": "factWithHighestConfidence — Middesk wins (weight=2.0) when TIN task passes",
        "storage_tables": [
            "integration_data.request_response (platform_id=16 Middesk)",
            "rds_warehouse_public.facts name='tin_match' (object: status/message/sublabel)",
            "rds_warehouse_public.facts name='tin_match_boolean' (boolean)",
            "rds_cases_public.data_businesses.tin (masked)",
        ],
        "null_blank_scenario": (
            "NULL / BLANK when:\n"
            "1. Middesk API was not called (business still processing) — shows 'Integrations currently processing'\n"
            "2. Middesk was called but no TIN was submitted by applicant\n"
            "3. Middesk responded but TIN task was not evaluated (entity not found in SoS)\n"
            "4. For non-US businesses: Trulioo may not perform TIN match\n\n"
            "This is NOT a Worth internal rule — it reflects the vendor's response. "
            "If Middesk cannot find a TIN match record, tin_match_boolean is null/false."
        ),
        "null_is_error": False,
        "null_reason": "Vendor response — Middesk found no entity or TIN was not submitted",
        "ucm_rule": "Unverified (FALSE) → Fail the rule. All other results (TRUE) → Pass.",
        "requires_transformation": True,
        "transformation_note": "tin.value (raw integer EIN) → tin_match_boolean.value (boolean true/false) via Middesk TIN task",
        "gpn_questions": (
            "Q: tin.value is an integer — how does it transform to Verified/Unverified?\n"
            "Q: Is the correct field tin_match_boolean.value with TRUE=Verified, FALSE=Unverified?\n"
            "Q: What is the UCM rule logic?"
        ),
        "confirmed_answers": (
            "✅ Confirmed: UCM should use tin_match_boolean.value (not tin.value)\n"
            "✅ Confirmed: TRUE = Verified, FALSE = Unverified\n"
            "✅ Confirmed: Unverified → Fail the rule; All other results → Pass\n"
            "✅ UCM Rule needed; also needs Worth 360 Report display"
        ),
        "w360": True,
    },

    "watchlist.hits.value": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Watchlists",
        "api_fact_name": "watchlist",
        "api_field_path": "watchlist.hits.value",
        "display_name": "Watchlist Hit Count",
        "admin_ui_location": "KYB → Watchlists tab: total hit count banner",
        "description": (
            "Total count of watchlist hits found for the business AND its owners/principals. "
            "Searches 14 watchlists including OFAC SDN, UN, EU, HMT, FBI, Interpol, and others. "
            "Searches cover: Legal Name, DBA names, all officers/principals found in SoS or on application."
        ),
        "sources": ["middesk", "trulioo"],
        "source_detail": {
            "middesk": "Middesk runs watchlist check as part of business verification. Returns watchlist object with hits array.",
            "trulioo": "Trulioo runs watchlist/sanctions screening for business AND person (each owner). Results merged via combineWatchlistMetadata rule.",
        },
        "fact_engine_rule": "combineWatchlistMetadata — merges hits from all sources, deduplicates by type+title+entity_name+url",
        "storage_tables": [
            "integration_data.request_response (platform_id=16 Middesk, platform_id=38 Trulioo)",
            "rds_warehouse_public.facts name='watchlist' (object: {metadata:[], message:''})",
            "rds_warehouse_public.facts name='watchlist_hits' (integer count)",
            "rds_warehouse_public.facts name='watchlist_raw' (full raw combined data)",
        ],
        "null_blank_scenario": (
            "NULL / 'No Hits' when:\n"
            "1. No watchlist hits found for the business or its owners (expected — normal result)\n"
            "2. Middesk not yet called (integrations still processing)\n"
            "3. Trulioo not yet called or returned an error\n\n"
            "'No Hits' is the NORMAL result — not an error. "
            "A NULL count (not 'No Hits') means the watchlist scan has not completed yet."
        ),
        "null_is_error": False,
        "null_reason": "Scan not yet complete (integrations processing) or no hits found",
        "ucm_rule": "UCM Rule needed — logic TBD pending Worth providing watchlist list details and example metadata",
        "requires_transformation": False,
        "transformation_note": "hits.value is integer count. metadata array contains hit details (agency, URL, entity name).",
        "gpn_questions": (
            "Q: Can Worth provide example 360 reports with watchlist hits for business AND owners?\n"
            "Q: Which of the 14 lists will be reviewed?\n"
            "Q: Will all hits have a URL or just some?"
        ),
        "confirmed_answers": (
            "✅ Structure: metadata property contains individual hits; same schema as KYB endpoint docs\n"
            "✅ US Watchlists: 14 lists. Most have URLs but not all link directly to the hit.\n"
            "✅ Each result has agency_abbreviation field indicating the list\n"
            "⏳ UCM Rule logic: TB needs to finalize after Worth provides more examples\n"
            "⏳ Action: Worth to provide CSV example with 2 watchlist hits"
        ),
        "w360": True,
    },

    "watchlist.value.metadata": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Watchlists",
        "api_fact_name": "watchlist",
        "api_field_path": "watchlist.value.metadata",
        "display_name": "Watchlist Hit Details (Metadata)",
        "admin_ui_location": "KYB → Watchlists tab: individual hit cards",
        "description": (
            "Array of individual watchlist hit objects. Each hit contains:\n"
            "- type: hit type (sanctions, PEP, adverse_media, etc.)\n"
            "- agency_abbreviation: the list that flagged the hit\n"
            "- entity_name: name of the entity that matched\n"
            "- url: link to source page (if available; some are CSV files)\n"
            "- metadata.title: agency name\n"
            "- entity_type: BUSINESS or PERSON"
        ),
        "sources": ["middesk", "trulioo"],
        "source_detail": {
            "middesk": "watchlist tasks in reviewTasks; returns structured hits per business entity",
            "trulioo": "business + person screening; Trulioo screens each owner separately. Results merged by combineWatchlistMetadata.",
        },
        "fact_engine_rule": "combineWatchlistMetadata — deduplicates hits across sources using type+title+entity_name+url key",
        "storage_tables": [
            "rds_warehouse_public.facts name='watchlist_raw' (full merged metadata)",
            "integration_data.request_response (platform_id=16, platform_id=38)",
        ],
        "null_blank_scenario": (
            "Empty array [] when no hits found — this is the NORMAL / EXPECTED state.\n"
            "NULL when integrations have not yet completed.\n"
            "Some hits may not have URLs (CSV-based watchlists)."
        ),
        "null_is_error": False,
        "null_reason": "No hits found (normal) or integrations still processing",
        "ucm_rule": "UCM Rule needed — display individual hit details; rule logic pending list finalization",
        "requires_transformation": False,
        "gpn_questions": "Q: Need example metadata with 2 hits showing all fields. Q: Which lists have CSV vs URL sources?",
        "confirmed_answers": (
            "✅ Schema same as KYB endpoint documentation\n"
            "✅ Each hit object has type, agency_abbreviation, entity_name, url fields\n"
            "⏳ Full list of 14 watchlists with metadata examples pending from Worth"
        ),
        "w360": True,
    },

    "legal_name.value": {
        "section": "KYB",
        "data_type": "Prefill",
        "internal_field_name": "Legal Name",
        "api_fact_name": "legal_name",
        "api_field_path": "legal_name.value",
        "display_name": "Legal Entity Name",
        "admin_ui_location": "KYB → Background → Business Registration card: Business Name / Legal Entity Name",
        "description": (
            "The legal name of the business as submitted by the applicant (Global/UCM sends it). "
            "Worth validates the Legal Name against the TIN via IRS (through Middesk). "
            "This is NOT a name Worth discovers — it is what the applicant submitted. "
            "Worth compares the submitted Legal Name with the IRS TIN record and returns match/no-match."
        ),
        "sources": ["businessDetails", "middesk", "opencorporates", "trulioo"],
        "source_detail": {
            "businessDetails": "Submitted by applicant at onboarding. This is the primary source.",
            "middesk": "businessEntityVerification.name — the name Middesk found in SoS records. Used for comparison.",
            "opencorporates": "firmographic.name — registered name in OC registry.",
            "trulioo": "clientData.businessName — name from Trulioo KYB response.",
        },
        "fact_engine_rule": "factWithHighestConfidence — Middesk wins (weight=2.0) for discovered legal name; businessDetails is the submitted name",
        "storage_tables": [
            "rds_cases_public.data_businesses.name (submitted)",
            "rds_warehouse_public.facts name='legal_name' (verified/discovered)",
            "integration_data.request_response (platform_id=16 Middesk)",
        ],
        "null_blank_scenario": (
            "NULL / BLANK when:\n"
            "1. Applicant did not submit a business name (unusual — required field)\n"
            "2. Middesk could not find the entity in SoS (shows blank in verified section)\n"
            "3. Integrations still processing\n\n"
            "For Business Registration card: Legal Name is ALWAYS shown (from submission). "
            "The 'Verified' badge appears only when Middesk confirms TIN+Name match."
        ),
        "null_is_error": False,
        "null_reason": "Not pre-filled by Worth — Global/UCM submits the name. Null = not submitted or entity not found.",
        "ucm_rule": "Info only — TIN Verification rule covers the match/no-match. Legal Name itself has no separate fail rule.",
        "requires_transformation": False,
        "gpn_questions": (
            "Q: Is legal_name pre-filled by Worth or submitted by Global?\n"
            "Q: What UCM rule is needed for legal_name alone?"
        ),
        "confirmed_answers": (
            "✅ Confirmed: NOT pre-filled by Worth. Global sends Legal Name + Tax ID.\n"
            "✅ Worth compares Legal Name with Tax ID Name and advises if there is a match.\n"
            "✅ Tax ID Verification and Legal Name use the SAME UCM Rule (1 rule covers both)\n"
            "✅ No separate action needed for legal_name.value alone"
        ),
        "w360": True,
    },

    "dba_found.value[n]": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "DBA Name",
        "api_fact_name": "dba_found",
        "api_field_path": "dba_found.value[n]",
        "display_name": "DBA (Doing Business As) Names",
        "admin_ui_location": "KYB → Background → Business Registration card: Alternate/Trade Names section",
        "description": (
            "Array of DBA / trade names found for the business across public records. "
            "Sources searched: Middesk (names array where submitted=false), "
            "ZoomInfo (trade names), OpenCorporates (alternate names), SERP/Verdata. "
            "Verification of the DBA name uses name_match_boolean.value which governs "
            "whether the submitted DBA matches what was found."
        ),
        "sources": ["middesk", "zoominfo", "opencorporates", "serp", "verdata", "businessDetails"],
        "source_detail": {
            "middesk": "names array where submitted=false — these are Middesk-discovered trade names",
            "zoominfo": "zi_c_tradename field from ZoomInfo firmographic data",
            "opencorporates": "alternate_names from OC company record",
            "serp": "DBA extracted from web scraping",
            "verdata": "seller.dba_name from Verdata response",
            "businessDetails": "DBA submitted by applicant at onboarding",
        },
        "fact_engine_rule": "combineFacts — deduplicates and merges DBA names from all sources into a single array",
        "storage_tables": [
            "rds_warehouse_public.facts name='dba_found' (array of strings)",
            "rds_warehouse_public.facts name='dba' (submitted DBA from applicant)",
            "integration_data.request_response (platform_id=16 Middesk, platform_id=24 ZoomInfo)",
        ],
        "null_blank_scenario": (
            "NULL / EMPTY ARRAY when:\n"
            "1. Business operates only under its legal name (no DBA — very common)\n"
            "2. No vendor found a DBA name for this entity\n"
            "3. Entity not matched by Middesk/ZoomInfo (SoS filing not found)\n\n"
            "DBA verification result (Verified/Unverified) is governed by name_match_boolean.value. "
            "If no DBA is submitted AND no DBA is found, the field is blank — this is NOT an error. "
            "The blank 'No Registry Data' in the admin UI means Middesk found no SoS filing."
        ),
        "null_is_error": False,
        "null_reason": "Business has no DBA (normal), or entity not found in public records",
        "ucm_rule": "name_match_boolean.value: TRUE=Verified (pass), FALSE=Unverified (fail). UCM Rule needed.",
        "requires_transformation": True,
        "transformation_note": "dba_found.value is an array — UCM displays each element [n]. Verification status comes from name_match_boolean, not dba_found directly.",
        "gpn_questions": (
            "Q: How does dba_found.value[n] (array) transform to Verified/Unverified?\n"
            "Q: What is the business logic for DBA verification?"
        ),
        "confirmed_answers": (
            "✅ Confirmed: name_match_boolean.value governs DBA/alternate name verification\n"
            "✅ TRUE = Verified; FALSE = Unverified\n"
            "✅ Worth 360 shows Verified or Unverified based on confidence score + data logic\n"
            "⏳ Action: Gavin to provide more details on DBA/Location address"
        ),
        "w360": True,
    },

    "google_profile.address": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "DBA/Location Address (Google)",
        "api_fact_name": "google_place_id / address_verification",
        "api_field_path": "google_profile.address",
        "display_name": "Google Business Profile — Address",
        "admin_ui_location": "KYB → Website tab: Google Business Profile section; also in Worth 360 Report",
        "description": (
            "The business address as found on Google Business Profile (Google Places). "
            "Worth uses the Google Places API (triggered via SERP scraping) to find the "
            "business's public listing and compares the address to what was submitted. "
            "Result: Match or No Match."
        ),
        "sources": ["google", "serp"],
        "source_detail": {
            "google": "Google Places API — address field from business listing. platform_id=29.",
            "serp": "SERP scraper finds the google_place_id which is then used to fetch the Places record.",
        },
        "fact_engine_rule": "factWithHighestConfidence — Google Places data is authoritative when available",
        "storage_tables": [
            "integration_data.request_response (platform_id=29 Google, platform_id=22 SERP)",
            "rds_warehouse_public.facts name='google_place_id'",
            "rds_warehouse_public.facts name='address_verification' (sublabel: Verified/Unverified)",
        ],
        "null_blank_scenario": (
            "NULL / NO MATCH when:\n"
            "1. Business has no Google Business Profile (common for new/small businesses)\n"
            "2. SERP scraping could not find a Google Place ID for this business\n"
            "3. Google Places API returned no result for the Place ID\n"
            "4. The address found does not match what was submitted\n\n"
            "This is NOT a Worth internal confidence rule — it depends entirely on whether "
            "the business has a public Google listing. Many legitimate businesses will show 'No Match' "
            "or blank here because they are not on Google Business Profile."
        ),
        "null_is_error": False,
        "null_reason": "No Google Business Profile found — business is not publicly listed on Google Maps",
        "ucm_rule": "Match = Pass; No Match = Fail. Mirrors address_verification sublabel logic.",
        "requires_transformation": False,
        "gpn_questions": (
            "Q: What is the Google-Profile endpoint?\n"
            "Q: What is the UCM rule for google_profile.address?"
        ),
        "confirmed_answers": (
            "✅ Confirmed: Google Profile is from Google Places API, triggered by SERP scraping\n"
            "✅ If verified: result mirrors address_verification rule logic (row 7)\n"
            "⏳ Action: Gavin to provide Google Profile documentation\n"
            "⏳ Action: UCM team to investigate Worth 360 mapping for full details"
        ),
        "w360": True,
    },

    "google_profile.business_name": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "DBA/Location Address (Google) — Name",
        "api_fact_name": "names_found / name_match",
        "api_field_path": "google_profile.business_name",
        "display_name": "Google Business Profile — Business Name",
        "admin_ui_location": "KYB → Website tab: Google Business Profile section",
        "description": (
            "The business name as it appears on Google Business Profile. "
            "Compared against the submitted legal name and DBA to determine name match."
        ),
        "sources": ["google", "serp"],
        "source_detail": {
            "google": "Google Places API — name field from business listing",
            "serp": "SERP scraper provides the business name found on search results page",
        },
        "fact_engine_rule": "combineFacts — name merged into names_found array; name_match_boolean evaluates match",
        "storage_tables": [
            "integration_data.request_response (platform_id=29 Google, platform_id=22 SERP)",
            "rds_warehouse_public.facts name='names_found' (array)",
            "rds_warehouse_public.facts name='name_match_boolean'",
        ],
        "null_blank_scenario": "Same as google_profile.address — no Google Business Profile found for this business",
        "null_is_error": False,
        "null_reason": "No Google Business Profile found",
        "ucm_rule": "name_match_boolean: TRUE=Match (pass), FALSE=No Match (fail)",
        "requires_transformation": False,
        "gpn_questions": "Q: What is the Google-Profile endpoint and what data does it return?",
        "confirmed_answers": "✅ Same logic as google_profile.address — mirrors name_match_boolean rule",
        "w360": True,
    },

    "sos_active.value": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "SoS Active Status",
        "api_fact_name": "sos_active",
        "api_field_path": "sos_active.value",
        "display_name": "Secretary of State — Filing Status",
        "admin_ui_location": "KYB → Business Registration tab → Secretary of State Filings card: Filing Status field",
        "description": (
            "Boolean or string indicating whether the business has an active Secretary of State filing. "
            "TRUE = At least one SoS filing is in 'active' status. "
            "FALSE = Filing exists but is inactive, dissolved, or revoked. "
            "NULL = No SoS filing found at all (shows 'No Registry Data to Display' in admin UI).\n\n"
            "The 'No Registry Data to Display' in the images is triggered by this field being NULL."
        ),
        "sources": ["middesk", "opencorporates"],
        "source_detail": {
            "middesk": "registrations array — each item has status field. 'active' status → sos_active=TRUE. Middesk queries SoS by TIN+name.",
            "opencorporates": "firmographic.current_status: 'Active' → TRUE; 'Dissolved' → FALSE. OC queries global registries.",
        },
        "fact_engine_rule": "factWithHighestConfidence — Middesk wins (weight=2.0) when it has a result; OC (weight=0.9) is fallback",
        "storage_tables": [
            "integration_data.request_response (platform_id=16 Middesk, platform_id=23 OC)",
            "rds_warehouse_public.facts name='sos_active' (boolean)",
            "rds_warehouse_public.facts name='sos_match' (match result object)",
        ],
        "null_blank_scenario": (
            "NULL / 'No Registry Data to Display' WHEN:\n\n"
            "SCENARIO 1 — Entity not found in SoS (most common for 'No Registry Data'):\n"
            "  • Middesk could not find the business in ANY SoS database by TIN+name\n"
            "  • OpenCorporates has no matching record\n"
            "  • Result: sos_active = NULL, sos_filings = []\n"
            "  • Admin UI shows: 'No Registry Data to Display — No Secretary of State filings found'\n"
            "  • Example: DSS NAILS LLC (Image 1) — new/small business not in SoS databases\n\n"
            "SCENARIO 2 — Integrations still processing:\n"
            "  • Middesk API call has not completed yet\n"
            "  • Admin UI shows: 'Integrations are currently processing'\n\n"
            "SCENARIO 3 — Entity found but no active filing:\n"
            "  • Middesk found the entity but status = 'inactive' or 'dissolved'\n"
            "  • sos_active = FALSE\n"
            "  • Admin UI shows: Filing Status = Inactive\n\n"
            "THIS IS NOT A WORTH INTERNAL CONFIDENCE RULE. "
            "Worth does NOT suppress SoS data based on confidence threshold. "
            "If Middesk finds a record, it is shown. If not found, 'No Registry Data' appears. "
            "The blank/null is the vendor's response — the entity was not found in SoS."
        ),
        "null_is_error": False,
        "null_reason": "Entity not found in SoS databases by Middesk — common for new, small, or sole-proprietor businesses",
        "ucm_rule": "sos_active=TRUE → Pass; sos_active=FALSE → Review/Fail; sos_active=NULL → needs investigation",
        "requires_transformation": False,
        "gpn_questions": "Q: Why does DSS NAILS LLC show 'No Registry Data'? Is this an error or expected?",
        "confirmed_answers": (
            "✅ 'No Registry Data to Display' is NOT an error — it means Middesk searched and found no SoS filing\n"
            "✅ This happens for new businesses, sole proprietors, or businesses registered under a different TIN\n"
            "✅ Pizza and a Chef LLC (Image 2) shows full SoS data because Middesk found an active FL filing\n"
            "✅ Worth does NOT suppress data based on confidence — if found, it is shown"
        ),
        "w360": True,
    },

    "sos_filings.value[n].entity_type": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "SoS Entity Type",
        "api_fact_name": "sos_filings",
        "api_field_path": "sos_filings.value[n].entity_type",
        "display_name": "Secretary of State — Entity Type",
        "admin_ui_location": "KYB → Business Registration tab → Secretary of State Filings card: Entity Type field",
        "description": (
            "The legal entity type as recorded in the Secretary of State filing. "
            "Common values: llc, corporation, llp, lp, sole proprietorship. "
            "Worth normalizes the raw SoS entity_type string to a standard set of values."
        ),
        "sources": ["middesk", "opencorporates"],
        "source_detail": {
            "middesk": "registrations[n].entity_type — raw string from SoS. E.g. 'Llc', 'Corp', 'Limited Liability Company'",
            "opencorporates": "company_type field — normalized by Worth to llc/corporation/llp/lp/sole proprietorship logic",
        },
        "fact_engine_rule": "factWithHighestConfidence within sos_filings combined array — Middesk records first, OC appended",
        "storage_tables": [
            "rds_warehouse_public.facts name='sos_filings' (array of SoSRegistration objects)",
            "integration_data.request_response (platform_id=16 Middesk, platform_id=23 OC)",
        ],
        "null_blank_scenario": (
            "NULL when:\n"
            "1. No SoS filing found (same as sos_active = NULL)\n"
            "2. SoS filing found but entity_type field is absent in the registry record\n"
            "3. Entity type string could not be normalized to a known type\n\n"
            "Admin UI shows 'Llc', 'Corporation', etc. as returned and normalized by Worth."
        ),
        "null_is_error": False,
        "null_reason": "No SoS filing found, or entity type field not present in registry record",
        "ucm_rule": "Info only — entity type used for risk scoring but no direct pass/fail rule in UCM",
        "requires_transformation": True,
        "transformation_note": "Raw SoS strings normalized: 'Limited Liability Company' → 'llc', 'Incorporated' → 'corporation', etc.",
        "gpn_questions": "No specific GPN questions for this field",
        "confirmed_answers": "✅ Entity type shown directly from Middesk/OC SoS filing record",
        "w360": True,
    },

    "sos_filings.value[n].filing_date": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "SoS Filing Date",
        "api_fact_name": "sos_filings",
        "api_field_path": "sos_filings.value[n].filing_date",
        "display_name": "Secretary of State — Registration Date",
        "admin_ui_location": "KYB → Business Registration tab → Secretary of State Filings card: Registration Date field",
        "description": (
            "The date the business was registered with the Secretary of State. "
            "For Middesk: registration_date from registrations array. "
            "For OC: incorporation_date from firmographic data. "
            "Also used as the basis for formation_date and year_established facts."
        ),
        "sources": ["middesk", "opencorporates"],
        "source_detail": {
            "middesk": "registrations[n].registration_date — ISO date string from SoS",
            "opencorporates": "incorporation_date from OC company record",
        },
        "fact_engine_rule": "factWithHighestConfidence — Middesk wins; OC used as fallback",
        "storage_tables": [
            "rds_warehouse_public.facts name='sos_filings' (filing_date within each item)",
            "rds_warehouse_public.facts name='formation_date'",
            "rds_warehouse_public.facts name='year_established'",
        ],
        "null_blank_scenario": (
            "NULL when:\n"
            "1. No SoS filing found\n"
            "2. SoS filing found but date field is absent in the registry record\n"
            "3. Date normalization failed\n\n"
            "For Image 2 (Pizza and a Chef LLC): Shows '05/31/2023' from Middesk FL SoS record."
        ),
        "null_is_error": False,
        "null_reason": "No SoS filing found or date not in registry record",
        "ucm_rule": "Used for year_established — businesses < 2 years old may have higher risk scoring",
        "requires_transformation": False,
        "gpn_questions": "No specific GPN questions",
        "confirmed_answers": "✅ Shown directly from Middesk registration_date or OC incorporation_date",
        "w360": True,
    },

    "sos_filings.value[n].state": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "SoS Filing State",
        "api_fact_name": "sos_filings",
        "api_field_path": "sos_filings.value[n].state",
        "display_name": "Secretary of State — State",
        "admin_ui_location": "KYB → Business Registration tab → Secretary of State Filings card: State field",
        "description": (
            "The US state (or jurisdiction) where the business is registered with the SoS. "
            "Also includes Entity Jurisdiction Type (Domestic/Foreign/Primary) derived from "
            "the foreign_domestic flag in the sos_filings record."
        ),
        "sources": ["middesk", "opencorporates"],
        "source_detail": {
            "middesk": "registrations[n].registration_state — 2-letter state code. Jurisdiction derived from 'domestic'/'foreign' in jurisdiction field.",
            "opencorporates": "jurisdiction_code split by '_' → state. home_jurisdiction_code vs jurisdiction_code comparison → domestic vs foreign.",
        },
        "fact_engine_rule": "factWithHighestConfidence within sos_filings array",
        "storage_tables": [
            "rds_warehouse_public.facts name='sos_filings' (state, foreign_domestic within each item)",
            "rds_warehouse_public.facts name='formation_state'",
        ],
        "null_blank_scenario": (
            "NULL when no SoS filing found.\n"
            "For Image 2: Shows 'FL' from Middesk FL registration. Entity Jurisdiction Type shows 'Domestic Primary' "
            "because jurisdiction='domestic' and this is the primary filing."
        ),
        "null_is_error": False,
        "null_reason": "No SoS filing found in Middesk or OC",
        "ucm_rule": "Info only — state shown for review",
        "requires_transformation": False,
        "gpn_questions": "No specific GPN questions",
        "confirmed_answers": "✅ State from Middesk registration_state; Domestic/Foreign/Primary badge from jurisdiction field",
        "w360": True,
    },

    "mcc_code": {
        "section": "KYB",
        "data_type": "Industry",
        "internal_field_name": "MCC Code",
        "api_fact_name": "mcc_code",
        "api_field_path": "mcc_code.value",
        "display_name": "Merchant Category Code (MCC)",
        "admin_ui_location": "KYB → Background tab → Industry section: MCC Code field",
        "description": (
            "4-digit Merchant Category Code. Three sources:\n"
            "1. mcc_code: AI-returned MCC from NAICS enrichment (GPT-5-mini)\n"
            "2. mcc_code_from_naics: Calculated MCC from NAICS→MCC lookup table (rel_naics_mcc)\n"
            "3. mcc_code_found: MCC found directly from vendor sources\n\n"
            "The AI enrichment is the primary source because vendors rarely return MCC directly. "
            "When all vendor NAICS are null, AI returns MCC 5614 as last resort with description "
            "'Fallback MCC per instructions' — which is an internal message incorrectly shown to customers."
        ),
        "sources": ["ai_naics", "middesk", "opencorporates", "zoominfo"],
        "source_detail": {
            "ai_naics": "GPT-5-mini returns mcc_code in structured JSON response. Platform_id=31.",
            "middesk": "industry_classification.mcc_codes from Middesk response (if available)",
            "opencorporates": "classification_codes may include MCC in industry_code_uids",
            "zoominfo": "Rarely returns MCC directly — primarily returns NAICS/SIC",
        },
        "fact_engine_rule": "factWithHighestConfidence — AI (platform_id=31) often wins as other vendors don't return MCC. Calculated MCC from NAICS is also an option.",
        "storage_tables": [
            "rds_warehouse_public.facts name='mcc_code'",
            "rds_warehouse_public.facts name='mcc_description'",
            "rds_cases_public.data_businesses.mcc_id → core_mcc_code.id",
            "core_mcc_code (lookup table: code, label)",
            "rel_naics_mcc (NAICS→MCC mapping table)",
        ],
        "null_blank_scenario": (
            "5,349 businesses (7.7%) show MCC 5614 / 'All Other Business Support Services':\n"
            "• ALL three vendors (ZI, EFX, OC) failed entity matching → no vendor NAICS\n"
            "• AI fires with only name+address → no website, no evidence\n"
            "• AI correctly returns 5614 as last resort per its system prompt\n"
            "• MCC description 'Fallback MCC per instructions...' is shown to customers (Gap G5)\n\n"
            "NULL mcc_code means AI enrichment has not yet completed."
        ),
        "null_is_error": False,
        "null_reason": "AI enrichment not yet complete, OR all vendors had no NAICS and AI returned fallback 5614",
        "ucm_rule": "Industry field — used for risk scoring and compliance decisions",
        "requires_transformation": False,
        "gpn_questions": "Q: MCC code is needed for UCM. Where does it come from?",
        "confirmed_answers": (
            "✅ MCC comes primarily from AI enrichment (NAICS→MCC map + AI-returned MCC)\n"
            "✅ 5614 is the AI fallback code when no industry evidence is available\n"
            "⚠️ 'Fallback MCC per instructions' description shown to customers is a known bug (Gap G5)\n"
            "⚠️ 5,349 businesses (7.7%) currently show MCC 5614 — see NAICS/MCC Root Cause Report"
        ),
        "w360": True,
    },

    "people.value[n].name, people.value[n].titles[n]": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Corporate Officers",
        "api_fact_name": "people",
        "api_field_path": "people.value[n].name, people.value[n].titles[n]",
        "display_name": "Corporate Officers / Directors",
        "admin_ui_location": "KYB → Business Registration tab → Secretary of State Filings card: Corporate Officers field",
        "description": (
            "Array of people (officers, directors, registered agents) associated with the business. "
            "Each person has: name, titles (array), jurisdictions (which SoS filings they appear in). "
            "Sources: Middesk SoS registrations (officers per state), OpenCorporates officers, Trulioo KYB."
        ),
        "sources": ["middesk", "opencorporates", "trulioo"],
        "source_detail": {
            "middesk": "registrations[n].officers array. Also people array from Middesk review tasks.",
            "opencorporates": "officers field from OC company record",
            "trulioo": "business.principals / directors from Trulioo KYB response",
        },
        "fact_engine_rule": "combineFacts — all people from all sources merged into single array; watchlist screening applies to each person",
        "storage_tables": [
            "rds_warehouse_public.facts name='people'",
            "integration_data.request_response (platform_id=16 Middesk, platform_id=38 Trulioo)",
        ],
        "null_blank_scenario": (
            "EMPTY ARRAY / NULL when:\n"
            "1. No SoS filing found (entity not in Middesk) — most common for blank admin UI\n"
            "2. SoS filing exists but no officers listed (e.g. registered agent only)\n"
            "3. Trulioo not available or no directors found\n\n"
            "For Image 2: Shows 'William A. Bergez, MANAGER & REGISTERED AGENT' from Middesk FL filing officers. "
            "For Image 1 (DSS NAILS): No officers shown because no SoS filing was found by Middesk."
        ),
        "null_is_error": False,
        "null_reason": "No SoS filing found, or filing has no officers listed",
        "ucm_rule": "Officers shown for review; each officer/principal is screened against watchlists",
        "requires_transformation": False,
        "gpn_questions": "Q: Do corporate officers appear in the SoS filing or from a separate source?",
        "confirmed_answers": "✅ Officers come from Middesk SoS registrations; also from OC and Trulioo for non-US entities",
        "w360": True,
    },

    "owners[n].first_name": {
        "section": "KYC",
        "data_type": "Prefill",
        "internal_field_name": "Owner First Name",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].first_name",
        "display_name": "Owner First Name",
        "admin_ui_location": "KYC tab → Owner cards: First Name",
        "description": "First name of each beneficial owner as submitted by the applicant. Not discovered by Worth — submitted at onboarding.",
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding in owners array"},
        "fact_engine_rule": "Direct read from submission — no Fact Engine competition",
        "storage_tables": ["rds_cases_public.data_owners.first_name"],
        "null_blank_scenario": "NULL only if applicant did not provide — required field in most flows",
        "null_is_error": True,
        "null_reason": "Applicant did not submit owner first name",
        "ucm_rule": "Info only — used for IDV matching",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted field — Worth does not discover owner names from external sources",
        "w360": False,
    },

    "owners[n].last_name": {
        "section": "KYC",
        "data_type": "Prefill",
        "internal_field_name": "Owner Last Name",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].last_name",
        "display_name": "Owner Last Name",
        "admin_ui_location": "KYC tab → Owner cards: Last Name",
        "description": "Last name of each beneficial owner as submitted by the applicant.",
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding"},
        "fact_engine_rule": "Direct read from submission",
        "storage_tables": ["rds_cases_public.data_owners.last_name"],
        "null_blank_scenario": "NULL only if not submitted",
        "null_is_error": True,
        "null_reason": "Applicant did not submit owner last name",
        "ucm_rule": "Info only",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted field",
        "w360": False,
    },

    "owners[n].date_of_birth": {
        "section": "KYC",
        "data_type": "Verification",
        "internal_field_name": "Owner Date of Birth",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].date_of_birth",
        "display_name": "Owner Date of Birth",
        "admin_ui_location": "KYC tab → Owner cards: Date of Birth",
        "description": (
            "Date of birth submitted by the applicant for each beneficial owner. "
            "Used by Plaid IDV to verify identity. Not stored in plain text — "
            "hashed or encrypted for privacy."
        ),
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding"},
        "fact_engine_rule": "Direct read from submission",
        "storage_tables": ["rds_cases_public.data_owners (encrypted)"],
        "null_blank_scenario": "NULL if not submitted; Plaid IDV cannot complete without DOB",
        "null_is_error": False,
        "null_reason": "Not provided by applicant",
        "ucm_rule": "Required for IDV — missing DOB prevents IDV completion",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted field — used by Plaid for identity verification",
        "w360": False,
    },

    "owners[n].ssn": {
        "section": "KYC",
        "data_type": "Verification",
        "internal_field_name": "Owner SSN",
        "api_fact_name": "tin_submitted / idv",
        "api_field_path": "owners[n].ssn",
        "display_name": "Owner SSN (last 4)",
        "admin_ui_location": "KYC tab → Owner cards: SSN (masked)",
        "description": (
            "Social Security Number submitted by the applicant for each beneficial owner. "
            "ALWAYS stored masked (last 4 digits only). "
            "Full SSN is used by Plaid IDV to verify identity against IRS/credit records. "
            "After verification, only the masked version is accessible via API."
        ),
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding — full SSN only at submission time"},
        "fact_engine_rule": "Direct read — stored as masked value only",
        "storage_tables": ["rds_cases_public.data_owners (SSN encrypted/masked)", "Plaid processes raw SSN in their secure environment"],
        "null_blank_scenario": "NULL if not submitted; IDV cannot complete without SSN",
        "null_is_error": False,
        "null_reason": "Not provided or not required for this flow",
        "ucm_rule": "SSN verified via Plaid IDV — verification_result.account_authentication_response governs the rule",
        "requires_transformation": True,
        "transformation_note": "Full SSN → masked display (last 4 only). API returns masked SSN only.",
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Full SSN used only for Plaid IDV; API always returns masked version",
        "w360": False,
    },

    "owners[n].email": {
        "section": "KYC",
        "data_type": "Prefill",
        "internal_field_name": "Owner Email",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].email",
        "display_name": "Owner Email",
        "admin_ui_location": "KYC tab → Owner cards: Email",
        "description": "Email address submitted by applicant for each owner. Used to send Plaid IDV link.",
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding"},
        "fact_engine_rule": "Direct read from submission",
        "storage_tables": ["rds_cases_public.data_owners.email"],
        "null_blank_scenario": "NULL if not submitted",
        "null_is_error": False,
        "null_reason": "Not provided by applicant",
        "ucm_rule": "Info only — used for Plaid IDV link delivery",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted field",
        "w360": False,
    },

    "owners[n].mobile": {
        "section": "KYC",
        "data_type": "Prefill",
        "internal_field_name": "Owner Mobile",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].mobile",
        "display_name": "Owner Mobile Phone",
        "admin_ui_location": "KYC tab → Owner cards: Mobile",
        "description": "Mobile phone submitted by applicant for each owner. Used for Plaid IDV SMS link delivery.",
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding"},
        "fact_engine_rule": "Direct read from submission",
        "storage_tables": ["rds_cases_public.data_owners.mobile"],
        "null_blank_scenario": "NULL if not submitted — Plaid IDV uses email as fallback",
        "null_is_error": False,
        "null_reason": "Not provided by applicant",
        "ucm_rule": "Info only",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted field",
        "w360": False,
    },

    "owners[n].address_line_1, owners[n].address_line_2, owners[n].address_city, owners[n].address_state, owners[n].address_country, owners[n].address_postal_code, owners[n].address_apartment": {
        "section": "KYC",
        "data_type": "Prefill",
        "internal_field_name": "Owner Address",
        "api_fact_name": "owners",
        "api_field_path": "owners[n].address_*",
        "display_name": "Owner Address",
        "admin_ui_location": "KYC tab → Owner cards: Address fields",
        "description": "Home address of each beneficial owner as submitted at onboarding. Used by Plaid IDV for address verification.",
        "sources": ["businessDetails"],
        "source_detail": {"businessDetails": "Submitted by applicant at onboarding"},
        "fact_engine_rule": "Direct read from submission",
        "storage_tables": ["rds_cases_public.data_owners (address fields)"],
        "null_blank_scenario": "NULL if not submitted",
        "null_is_error": False,
        "null_reason": "Not provided by applicant",
        "ucm_rule": "Used by Plaid IDV — address verification",
        "requires_transformation": False,
        "gpn_questions": "No GPN questions",
        "confirmed_answers": "✅ Submitted fields from applicant onboarding",
        "w360": False,
    },

    "verification_result.account_authentication_response.verification_response": {
        "section": "KYC",
        "data_type": "Verification",
        "internal_field_name": "Owner IDV Result",
        "api_fact_name": "idv_passed / idv_status",
        "api_field_path": "verification_result.account_authentication_response.verification_response",
        "display_name": "Owner Identity Verification — Authentication Result",
        "admin_ui_location": "KYC tab → Owner cards: IDV status badge",
        "description": (
            "Result of Plaid Identity Verification (IDV) for each owner. "
            "Plaid verifies SSN, DOB, name, and address against government records. "
            "Worth maps Plaid statuses to: SUCCESS, FAILED, PENDING, EXPIRED, NEEDS_REVIEW. "
            "idv_passed_boolean = TRUE if at least one SUCCESS IDV for all required owners."
        ),
        "sources": ["plaid"],
        "source_detail": {
            "plaid": "Plaid IDV API — per-owner verification flow. Returns status: success/failed/pending. Platform_id=40."
        },
        "fact_engine_rule": "idv_status aggregates counts per status across all owners; idv_passed_boolean = SUCCESS_COUNT > 0",
        "storage_tables": [
            "integration_data.request_response (platform_id=40 Plaid)",
            "rds_warehouse_public.facts name='idv_status' (count per status)",
            "rds_warehouse_public.facts name='idv_passed_boolean' (boolean)",
        ],
        "null_blank_scenario": (
            "NULL / PENDING when:\n"
            "1. Owner has not yet completed the Plaid IDV link flow\n"
            "2. Plaid link was sent but owner did not open it\n"
            "3. IDV expired (owner did not complete in time window)\n\n"
            "FAILED when Plaid could not match SSN/DOB/name against records."
        ),
        "null_is_error": False,
        "null_reason": "Owner has not completed IDV flow yet — PENDING status",
        "ucm_rule": "IDV FAILED → fail the UCM rule for this owner. PENDING → rule pending. SUCCESS → pass.",
        "requires_transformation": True,
        "transformation_note": "Plaid status → Worth status mapping: success→SUCCESS, failed→FAILED, pending→PENDING",
        "gpn_questions": "Q: How does verification_result map to IDV pass/fail? Q: What is the UCM rule for failed IDV?",
        "confirmed_answers": "✅ Plaid IDV result; TRUE/FALSE via idv_passed_boolean; FAILED→fail UCM rule",
        "w360": False,
    },

    "verification_result.account_verification_response.code": {
        "section": "KYC",
        "data_type": "Verification",
        "internal_field_name": "Bank Account Verification",
        "api_fact_name": "verification_status",
        "api_field_path": "verification_result.account_verification_response.code",
        "display_name": "Bank Account Verification Code",
        "admin_ui_location": "Banking tab → Account Verification section",
        "description": (
            "Result code from bank account verification (Plaid Auth or micro-deposit). "
            "Verifies that the bank account belongs to the business and is accessible. "
            "Common codes: VERIFIED, PENDING_AUTOMATIC_VERIFICATION, PENDING_MANUAL_VERIFICATION, VERIFICATION_FAILED."
        ),
        "sources": ["plaid"],
        "source_detail": {"plaid": "Plaid Auth or Plaid Manual Verification — account verification flow"},
        "fact_engine_rule": "Direct from Plaid API response",
        "storage_tables": [
            "integration_data.request_response (platform_id=40 Plaid)",
            "rds_warehouse_public.facts name='verification_status'",
        ],
        "null_blank_scenario": "NULL if banking section not submitted; PENDING if verification in progress",
        "null_is_error": False,
        "null_reason": "Banking verification not yet initiated or completed",
        "ucm_rule": "VERIFICATION_FAILED → fail; VERIFIED → pass; PENDING → hold for review",
        "requires_transformation": False,
        "gpn_questions": "Q: What is the UCM rule for account verification codes?",
        "confirmed_answers": "✅ Plaid account verification; code maps to UCM rule",
        "w360": False,
    },

    "status": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Case Status",
        "api_fact_name": "verification_status / compliance_status",
        "api_field_path": "status",
        "display_name": "Case / Application Status",
        "admin_ui_location": "Case Details → top right: Case Results card (Pending/Approved/Under Review/Archived)",
        "description": (
            "Overall case status. Determined by the Worth score engine and manual analyst decisions. "
            "Values: Pending (integrations running), Under Review (needs analyst), "
            "Auto-Approved (all rules pass + score above threshold), Archived (closed).\n\n"
            "This is the customer-facing status shown in the admin portal and Worth 360 Report."
        ),
        "sources": ["middesk", "trulioo", "manual"],
        "source_detail": {
            "middesk": "Middesk overall verification status (completed/failed/in_review)",
            "trulioo": "Trulioo clientData.status for UK/CA businesses",
            "manual": "Analyst can manually set status via admin portal or case-service API",
        },
        "fact_engine_rule": "truliooPreferredRule for UK/CA; factWithHighestConfidence for US; manualOverride always wins",
        "storage_tables": [
            "rds_cases_public.data_cases.status → core_case_statuses.code",
            "rds_warehouse_public.facts name='verification_status'",
            "rds_warehouse_public.facts name='compliance_status'",
        ],
        "null_blank_scenario": (
            "'Pending' is the initial status — not null. Shown as 'Pending' with loading bars.\n"
            "In Images 1 and 2: Both show 'Pending' because integrations are still processing.\n"
            "Worth Score: '-' means score has not been calculated yet.\n\n"
            "Status transitions:\n"
            "Pending → Under Review (if score below threshold or any rule fails)\n"
            "Pending → Auto-Approved (if all rules pass and score above threshold)\n"
            "Any → Archived (manually closed)"
        ),
        "null_is_error": False,
        "null_reason": "Integrations still processing — normal for newly submitted cases",
        "ucm_rule": "Used for downstream UCM workflow triggering",
        "requires_transformation": True,
        "transformation_note": "data_cases.status (integer FK) → core_case_statuses.code (string) → display label",
        "gpn_questions": "Q: data.applicant.status mapping. Q: What statuses are returned?",
        "confirmed_answers": "✅ Pending=integrations running; Under Review=manual review needed; Auto-Approved=all pass",
        "w360": True,
    },

    "data.applicant.status": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Applicant Status",
        "api_fact_name": "verification_status",
        "api_field_path": "data.applicant.status",
        "display_name": "Applicant / Business Verification Status",
        "admin_ui_location": "KYB → Business Registration tab → Business Registration card: Verified badge",
        "description": (
            "Overall verification status of the applicant/business entity. "
            "Maps to the 'Verified' badge shown in the Business Registration card. "
            "Middesk: completed → Verified. Trulioo: success → Verified. "
            "The Verified badge appears when at least one high-confidence source confirms the entity exists."
        ),
        "sources": ["middesk", "trulioo"],
        "source_detail": {
            "middesk": "businessEntityVerification.status: 'completed'/'in_review'/'failed'",
            "trulioo": "clientData.status: 'success'/'failed'/'pending'",
        },
        "fact_engine_rule": "truliooPreferredRule for UK/CA; factWithHighestConfidence for US — Middesk wins",
        "storage_tables": [
            "rds_warehouse_public.facts name='verification_status'",
            "rds_warehouse_public.facts name='business_verified'",
        ],
        "null_blank_scenario": (
            "Pending/NULL when:\n"
            "1. Middesk integration not yet completed ('Integrations are currently processing')\n"
            "2. Middesk returned 'in_review' — further processing needed\n\n"
            "In Image 1 (DSS NAILS): 'Business Registration: Verified' badge IS shown — Middesk confirmed the "
            "entity exists (EIN matched) but no SoS filing was found in SoS registries. "
            "Verified = the business entity exists per IRS; SoS filing is separate."
        ),
        "null_is_error": False,
        "null_reason": "Middesk integration still running",
        "ucm_rule": "Verified status informs case auto-approval logic",
        "requires_transformation": True,
        "transformation_note": "Middesk 'completed' → 'Verified'; 'failed' → 'Unverified'; 'in_review' → 'In Review'",
        "gpn_questions": "Q: How does data.applicant.status map to UI columns?",
        "confirmed_answers": "✅ Middesk completed → Verified; status shown in Business Registration card header",
        "w360": True,
    },

    "domain.creation_date": {
        "section": "KYB",
        "data_type": "Verification",
        "internal_field_name": "Domain Creation Date",
        "api_fact_name": "website / website_found",
        "api_field_path": "domain.creation_date",
        "display_name": "Domain Registration Date",
        "admin_ui_location": "KYB → Website tab: Domain Registration section",
        "description": (
            "The date the business's web domain was first registered (WHOIS data). "
            "Very new domains (< 1-2 years) are a risk signal — common in fraud. "
            "Provided by SERP scraping / Verdata WHOIS lookup."
        ),
        "sources": ["serp", "verdata"],
        "source_detail": {
            "serp": "SERP scraper performs WHOIS lookup on found domain",
            "verdata": "Verdata/VerifiedFirst performs domain age check",
        },
        "fact_engine_rule": "factWithHighestConfidence — SERP and Verdata both read WHOIS",
        "storage_tables": [
            "integration_data.request_response (platform_id=22 SERP, platform_id=35 Verdata)",
            "rds_warehouse_public.facts name='website' (includes domain info)",
        ],
        "null_blank_scenario": (
            "NULL when:\n"
            "1. No website found for the business\n"
            "2. WHOIS data not available for the domain (privacy protection)\n"
            "3. SERP scraping did not complete\n\n"
            "Domain age = 0 or very recent is a risk signal, not an error."
        ),
        "null_is_error": False,
        "null_reason": "No website found or WHOIS data unavailable (privacy protection)",
        "ucm_rule": "Domain age risk signal — very new domains (< 1 year) may trigger review",
        "requires_transformation": False,
        "gpn_questions": "Q: What is the domain.creation_date used for in UCM rule logic?",
        "confirmed_answers": "✅ Domain creation date from WHOIS via SERP/Verdata; used for domain age risk signal",
        "w360": True,
    },

    "stolen_identity_risk_score": {
        "section": "KYC",
        "data_type": "Risk",
        "internal_field_name": "Stolen Identity Risk Score",
        "api_fact_name": "risk_score",
        "api_field_path": "stolen_identity_risk_score",
        "display_name": "Stolen Identity Risk Score",
        "admin_ui_location": "KYC tab → Owner cards: Risk Score section",
        "description": (
            "A risk score indicating the likelihood that the owner's identity has been stolen or synthetic. "
            "Computed from Plaid IDV signals, SSN validation, DOB matching, and credit header data. "
            "Scale: typically 0-100 or 0-1 (normalized)."
        ),
        "sources": ["plaid"],
        "source_detail": {"plaid": "Plaid IDV returns identity risk signals including stolen identity indicators"},
        "fact_engine_rule": "Direct from Plaid IDV response",
        "storage_tables": [
            "integration_data.request_response (platform_id=40 Plaid)",
            "rds_warehouse_public.facts name='risk_score'",
        ],
        "null_blank_scenario": (
            "NULL when:\n"
            "1. Owner has not completed Plaid IDV\n"
            "2. Plaid did not return a risk score for this owner\n"
            "3. IDV flow not available in this jurisdiction"
        ),
        "null_is_error": False,
        "null_reason": "IDV not yet complete or not available for this owner",
        "ucm_rule": "High score → fail or review. Threshold TBD by UCM team.",
        "requires_transformation": False,
        "gpn_questions": "Q: What scale is the stolen identity score? Q: What is the UCM threshold?",
        "confirmed_answers": "⏳ UCM team to define threshold. Score from Plaid IDV risk signals.",
        "w360": False,
    },

    "synthetic_identity_risk_score": {
        "section": "KYC",
        "data_type": "Risk",
        "internal_field_name": "Synthetic Identity Risk Score",
        "api_fact_name": "risk_score",
        "api_field_path": "synthetic_identity_risk_score",
        "display_name": "Synthetic Identity Risk Score",
        "admin_ui_location": "KYC tab → Owner cards: Risk Score section",
        "description": (
            "A risk score indicating the likelihood that the owner's identity is synthetic "
            "(a fabricated identity combining real and fake information). "
            "Computed from Plaid IDV signals — SSN velocity, credit thin-file indicators, "
            "DOB mismatch patterns."
        ),
        "sources": ["plaid"],
        "source_detail": {"plaid": "Plaid IDV synthetic identity risk signals"},
        "fact_engine_rule": "Direct from Plaid IDV response",
        "storage_tables": [
            "integration_data.request_response (platform_id=40 Plaid)",
            "rds_warehouse_public.facts name='risk_score'",
        ],
        "null_blank_scenario": "Same as stolen_identity_risk_score — IDV not yet complete",
        "null_is_error": False,
        "null_reason": "IDV not yet complete",
        "ucm_rule": "High score → fail or review. Threshold TBD by UCM team.",
        "requires_transformation": False,
        "gpn_questions": "Q: What scale? Q: What is the UCM threshold?",
        "confirmed_answers": "⏳ UCM team to define threshold. Score from Plaid IDV synthetic identity signals.",
        "w360": False,
    },
}

# ── Null / Blank cause taxonomy ───────────────────────────────────────────────
# Every possible reason a field can be null/blank, grouped by root cause type.
# Used to populate the tooltip and null causes panel in the UI.

NULL_CAUSE_TYPES = {
    "VENDOR_NO_RECORD": {
        "label": "Vendor Found No Record",
        "colour": "#FCA5A5",   # red
        "icon": "🔍",
        "explanation": (
            "The vendor searched its database using the submitted business name and/or TIN "
            "and returned no matching entity. This is NOT a Worth decision — Worth passes the "
            "search request to the vendor and displays whatever the vendor returns. "
            "If the vendor finds nothing, the field is blank."
        ),
        "examples": [
            "Middesk searched all 50 US SoS databases and found no SoS filing for this EIN+name",
            "OpenCorporates has no record for this jurisdiction",
            "ZoomInfo has no firmographic profile for this business",
        ],
    },
    "VENDOR_FIELD_ABSENT": {
        "label": "Vendor Returned Data But Field Was Empty",
        "colour": "#FCD34D",   # amber
        "icon": "📭",
        "explanation": (
            "The vendor returned a response for this business, but the specific field "
            "was not present or was null in the vendor's response. "
            "For example, Middesk may find a SoS filing but the filing may not include "
            "officer names if the state does not require them."
        ),
        "examples": [
            "Middesk found SoS filing but officers field is empty (state does not mandate officer disclosure)",
            "ZoomInfo has a profile but no NAICS code for this business",
            "Equifax record exists but annual revenue field is not populated",
        ],
    },
    "BELOW_CONFIDENCE_THRESHOLD": {
        "label": "Confidence Below Worth Threshold",
        "colour": "#FCD34D",   # amber
        "icon": "📉",
        "explanation": (
            "The Fact Engine evaluated vendor candidates for this field but the highest-confidence "
            "match did not exceed Worth's minimum confidence threshold. "
            "Worth applies a minimum threshold (typically 0.45–0.50 on the 0–1 scale, "
            "equivalent to match.index ≥ 25/55) before accepting a vendor match. "
            "Candidates below this threshold are discarded and the field is left blank "
            "rather than showing a potentially wrong value.\n\n"
            "IMPORTANT: This threshold applies to ENTITY MATCHING (finding the right company "
            "in the vendor database) — NOT to the field value itself. "
            "If the entity-matching score is too low, Worth will not use ANY data from that vendor "
            "for that business, including this field."
        ),
        "examples": [
            "ZoomInfo found a company with similar name but match.index=20/55 (confidence=0.36) — below threshold → no ZI data used",
            "Equifax entity-match XGBoost score=0.42 — below 0.45 threshold → no EFX data used",
            "OpenCorporates matched a company but similarity_index=18 — rejected",
        ],
    },
    "INTEGRATIONS_PROCESSING": {
        "label": "Integrations Still Processing",
        "colour": "#93C5FD",   # blue
        "icon": "⏳",
        "explanation": (
            "The vendor API call has been initiated but has not yet returned a response. "
            "Worth fires all vendor lookups in parallel after submission. "
            "Some vendors (especially Middesk live API calls) can take 15–60 seconds. "
            "The admin UI shows 'Integrations are currently processing' while this is happening. "
            "Once complete, the field will be populated automatically."
        ),
        "examples": [
            "Middesk live SoS API still running — SoS fields all blank",
            "Plaid IDV link sent to owner but owner has not yet completed the flow",
            "Trulioo KYB verification in progress",
        ],
    },
    "NOT_SUBMITTED": {
        "label": "Applicant Did Not Submit This Value",
        "colour": "#A78BFA",   # purple
        "icon": "📋",
        "explanation": (
            "This field is populated from the applicant's onboarding form submission. "
            "If the applicant did not provide this value, the field will be blank. "
            "Worth does not discover or infer applicant-submitted fields from external sources — "
            "it uses exactly what was submitted."
        ),
        "examples": [
            "Owner email not provided during onboarding",
            "Owner mobile number not provided",
            "DBA name not submitted (business operates only under legal name)",
        ],
    },
    "FIELD_NOT_APPLICABLE": {
        "label": "Field Not Applicable for This Business",
        "colour": "#6EE7B7",   # green
        "icon": "✓",
        "explanation": (
            "This field is genuinely not applicable for this business type or jurisdiction. "
            "For example: a sole proprietor in most US states does not need to file with the SoS, "
            "so SoS fields will be blank and this is the CORRECT result. "
            "Similarly, UK SIC codes only apply to GB-jurisdiction businesses."
        ),
        "examples": [
            "Sole proprietor — SoS filing not required in most states",
            "UK SIC code — only applicable when business country = GB",
            "W360 report — only shown when business has completed full KYB",
        ],
    },
    "NO_SUPPRESSION_BY_WORTH": {
        "label": "Worth Does NOT Suppress This Field",
        "colour": "#6EE7B7",   # green
        "icon": "✅",
        "explanation": (
            "Worth does NOT apply a post-match confidence threshold to hide or suppress "
            "field values that a vendor has returned. Once a vendor match passes the "
            "entity-matching confidence threshold, ALL fields from that vendor are used. "
            "Worth does not say 'I have a value but I'm not confident enough to show it.' "
            "If a value is blank, it is because no vendor returned it — not because Worth decided to hide it."
        ),
        "examples": [],
    },
}

# ── Per-field null causes structured breakdown ─────────────────────────────────
# For each API field: a list of (cause_type, specific_detail) tuples
# describing every scenario that can produce a blank/null value.
FIELD_NULL_CAUSES = {
    "tin.value": [
        ("INTEGRATIONS_PROCESSING", "Middesk live API not yet completed — TIN task pending"),
        ("VENDOR_NO_RECORD", "Middesk searched SoS by TIN+name and found no entity — EIN may be incorrect or not yet in IRS records"),
        ("VENDOR_FIELD_ABSENT", "Middesk found entity but TIN task was not evaluated (e.g. TIN not submitted by applicant)"),
        ("NOT_SUBMITTED", "Applicant did not provide a TIN/EIN during onboarding"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth never hides TIN match result based on confidence — if Middesk returns it, it is shown"),
    ],
    "watchlist.hits.value": [
        ("INTEGRATIONS_PROCESSING", "Middesk or Trulioo watchlist scan not yet completed"),
        ("FIELD_NOT_APPLICABLE", "No hits found = empty array [] — this is the NORMAL expected result for most businesses"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth never suppresses watchlist hits — all hits from all sources are combined and shown"),
    ],
    "watchlist.value.metadata": [
        ("INTEGRATIONS_PROCESSING", "Watchlist scan not yet completed"),
        ("FIELD_NOT_APPLICABLE", "Empty array [] = no watchlist hits found — correct and expected for clean businesses"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth shows all hits regardless of severity — no confidence-based suppression"),
    ],
    "legal_name.value": [
        ("INTEGRATIONS_PROCESSING", "Middesk not yet returned — legal name from Middesk SoS pending"),
        ("NOT_SUBMITTED", "Applicant did not submit a business name (rare — required field)"),
        ("VENDOR_NO_RECORD", "Middesk found no SoS entity for this EIN — no verified legal name available from registry"),
        ("NO_SUPPRESSION_BY_WORTH", "Submitted name is always shown; verified name from Middesk shown when found"),
    ],
    "dba_found.value[n]": [
        ("FIELD_NOT_APPLICABLE", "Business operates only under its legal name — no DBA registered or found (very common, not an error)"),
        ("VENDOR_NO_RECORD", "No vendor (Middesk, ZoomInfo, OC) found any alternate/trade name for this entity"),
        ("INTEGRATIONS_PROCESSING", "Vendor scans not yet completed"),
        ("NO_SUPPRESSION_BY_WORTH", "All DBA names from all sources are combined via combineFacts rule — none are hidden"),
    ],
    "google_profile.address": [
        ("VENDOR_NO_RECORD", "Business has no Google Business Profile — not listed on Google Maps/Places"),
        ("VENDOR_FIELD_ABSENT", "Google Places found a listing but address field was not populated"),
        ("INTEGRATIONS_PROCESSING", "SERP scraping not yet completed — no Google Place ID retrieved yet"),
        ("FIELD_NOT_APPLICABLE", "Many legitimate small businesses have no public Google listing"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth shows Google address if found — no confidence threshold hides it"),
    ],
    "google_profile.business_name": [
        ("VENDOR_NO_RECORD", "No Google Business Profile found"),
        ("INTEGRATIONS_PROCESSING", "SERP scraping still running"),
        ("NO_SUPPRESSION_BY_WORTH", "Shown directly from Google Places API when available"),
    ],
    "sos_active.value": [
        ("VENDOR_NO_RECORD", "Middesk searched all US SoS databases and found NO filing for this TIN+name — the single most common reason for 'No Registry Data to Display'"),
        ("INTEGRATIONS_PROCESSING", "Middesk live API still running — SoS data pending"),
        ("FIELD_NOT_APPLICABLE", "Sole proprietor — SoS filing not required in most states; blank is CORRECT"),
        ("BELOW_CONFIDENCE_THRESHOLD", "OpenCorporates entity-match score below threshold — OC record discarded; Middesk also found nothing → both sources empty"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth never hides sos_active based on a confidence rule — if Middesk returns active/inactive, Worth shows it"),
    ],
    "sos_filings.value[n].entity_type": [
        ("VENDOR_NO_RECORD", "No SoS filing found by Middesk or OpenCorporates"),
        ("VENDOR_FIELD_ABSENT", "SoS filing found but state registry does not publish entity type (uncommon)"),
        ("NO_SUPPRESSION_BY_WORTH", "Shown directly from Middesk registration.entity_type — not filtered"),
    ],
    "sos_filings.value[n].filing_date": [
        ("VENDOR_NO_RECORD", "No SoS filing found"),
        ("VENDOR_FIELD_ABSENT", "Filing found but registration date absent in state registry record"),
        ("NO_SUPPRESSION_BY_WORTH", "Shown directly from Middesk or OC — not filtered by Worth"),
    ],
    "sos_filings.value[n].state": [
        ("VENDOR_NO_RECORD", "No SoS filing found — most common for 'No Registry Data' screen"),
        ("NO_SUPPRESSION_BY_WORTH", "State shown from Middesk registration.registration_state — not filtered"),
    ],
    "mcc_code": [
        ("VENDOR_NO_RECORD", "All three entity-matching vendors (ZI, EFX, OC) found no record — AI enrichment returned fallback MCC 5614"),
        ("BELOW_CONFIDENCE_THRESHOLD", "Vendor found a candidate but entity-match score below threshold → vendor data rejected → AI enrichment fires as fallback → returns 5614"),
        ("INTEGRATIONS_PROCESSING", "AI enrichment deferred task not yet completed"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth always stores a MCC — either from vendor, calculated from NAICS, or AI fallback 5614. Never blank unless AI task pending."),
    ],
    "people.value[n].name, people.value[n].titles[n]": [
        ("VENDOR_NO_RECORD", "No SoS filing found by Middesk — no officers available from SoS"),
        ("VENDOR_FIELD_ABSENT", "SoS filing found but state does not require officer disclosure (e.g. some states only require registered agent)"),
        ("INTEGRATIONS_PROCESSING", "Middesk still processing"),
        ("NO_SUPPRESSION_BY_WORTH", "All people from all sources are combined — none hidden by Worth"),
    ],
    "owners[n].first_name": [
        ("NOT_SUBMITTED", "Applicant did not provide owner first name — required field, absence is an error"),
    ],
    "owners[n].last_name": [
        ("NOT_SUBMITTED", "Applicant did not provide owner last name — required field, absence is an error"),
    ],
    "owners[n].date_of_birth": [
        ("NOT_SUBMITTED", "Applicant did not provide owner date of birth — Plaid IDV cannot complete without DOB"),
    ],
    "owners[n].ssn": [
        ("NOT_SUBMITTED", "SSN not provided by applicant or not required for this flow"),
        ("FIELD_NOT_APPLICABLE", "Non-US owners may not have SSN — different ID type used"),
    ],
    "owners[n].email": [
        ("NOT_SUBMITTED", "Owner email not provided — Plaid IDV link cannot be sent"),
    ],
    "owners[n].mobile": [
        ("NOT_SUBMITTED", "Owner mobile not provided — Plaid will use email for IDV link delivery"),
        ("FIELD_NOT_APPLICABLE", "Mobile optional when email is provided"),
    ],
    "owners[n].address_line_1, owners[n].address_line_2, owners[n].address_city, owners[n].address_state, owners[n].address_country, owners[n].address_postal_code, owners[n].address_apartment": [
        ("NOT_SUBMITTED", "Owner address not provided by applicant"),
        ("FIELD_NOT_APPLICABLE", "Some address sub-fields optional (line_2, apartment)"),
    ],
    "verification_result.account_authentication_response.verification_response": [
        ("INTEGRATIONS_PROCESSING", "Owner has not yet clicked the Plaid IDV link — flow is PENDING"),
        ("INTEGRATIONS_PROCESSING", "Plaid IDV link expired — owner did not complete in time window"),
        ("VENDOR_NO_RECORD", "Plaid could not match owner's SSN/DOB/name against credit header or government records"),
        ("NO_SUPPRESSION_BY_WORTH", "Worth shows IDV result as returned by Plaid — no suppression based on score"),
    ],
    "verification_result.account_verification_response.code": [
        ("INTEGRATIONS_PROCESSING", "Banking verification not yet initiated or Plaid Auth still processing"),
        ("NOT_SUBMITTED", "Banking section not submitted by applicant"),
        ("NO_SUPPRESSION_BY_WORTH", "Verification code shown directly from Plaid response"),
    ],
    "status": [
        ("INTEGRATIONS_PROCESSING", "Case is in 'Pending' state — all vendor integrations still running. Worth Score not yet calculated."),
        ("NO_SUPPRESSION_BY_WORTH", "Status transitions automatically as integrations complete — Worth does not hide status"),
    ],
    "data.applicant.status": [
        ("INTEGRATIONS_PROCESSING", "Middesk live verification not yet returned — 'Verified' badge pending"),
        ("VENDOR_NO_RECORD", "Middesk returned 'in_review' — SoS search still in progress at Middesk side"),
        ("NO_SUPPRESSION_BY_WORTH", "Verification status shown directly from Middesk/Trulioo response"),
    ],
    "domain.creation_date": [
        ("VENDOR_NO_RECORD", "No website found for this business — no domain to look up"),
        ("VENDOR_FIELD_ABSENT", "Website found but WHOIS data unavailable (domain privacy protection enabled)"),
        ("INTEGRATIONS_PROCESSING", "SERP scraping not yet completed"),
        ("FIELD_NOT_APPLICABLE", "Many businesses (especially brick-and-mortar) have no website"),
        ("NO_SUPPRESSION_BY_WORTH", "Domain date shown when found — never hidden by Worth"),
    ],
    "stolen_identity_risk_score": [
        ("INTEGRATIONS_PROCESSING", "Owner has not yet completed Plaid IDV — score not yet generated"),
        ("VENDOR_FIELD_ABSENT", "Plaid IDV completed but did not return a stolen identity risk score for this owner"),
        ("FIELD_NOT_APPLICABLE", "IDV not available in this jurisdiction or for this flow type"),
        ("NO_SUPPRESSION_BY_WORTH", "Risk score shown as returned by Plaid — no Worth confidence filter applied"),
    ],
    "synthetic_identity_risk_score": [
        ("INTEGRATIONS_PROCESSING", "Plaid IDV not yet complete"),
        ("VENDOR_FIELD_ABSENT", "Plaid completed IDV but synthetic score not returned"),
        ("FIELD_NOT_APPLICABLE", "IDV not available for this jurisdiction"),
        ("NO_SUPPRESSION_BY_WORTH", "Risk score shown as returned by Plaid — no Worth confidence filter applied"),
    ],
}

# ── The confidence suppression question — definitive answer ───────────────────
CONFIDENCE_SUPPRESSION_FACT = {
    "question": (
        "Does Worth suppress or hide field values when confidence is too low, "
        "even if the vendor HAS returned a value?"
    ),
    "answer": "NO. Rule 4 of the 6 Pipeline A rules explicitly confirms there is NO minimum confidence cutoff.",
    "detail": """
THE 6 PIPELINE A WINNER-SELECTION RULES (confirmed from integration-service source code):

RULE 1 — factWithHighestConfidence()
  Sort all VALID sources by confidence. Highest wins outright if gap > 5%.
  |conf_A - conf_B| > 0.05 → higher wins

RULE 2 — weightedFactSelector() [Tie-break]
  If top two within WEIGHT_THRESHOLD = 0.05, use source weight:
  Middesk(2.0) > OC(0.9) > ZI(0.8) = Trulioo(0.8) > EFX(0.7) > SERP(0.3) > AI(0.1)

RULE 3 — manualOverride() [ALWAYS WINS]
  Analyst sets via PATCH /facts/.../override/{factName}.
  override:{...} field. Beats any model/AI result.

RULE 4 — NO minimum confidence cutoff  ← CRITICAL
  There is NO "confidence must be >= X" rule.
  If only one source returned a code at confidence 0.05 — it wins.
  Low confidence IS visible in API (source.confidence) but does NOT block display.

RULE 5 — AI safety net
  AI triggers when n_non_AI_sources < minimumSources=1 AND total < maximumSources=3.
  Weight=0.1 so AI rarely wins unless vendors found nothing.

RULE 6 — Last resort: "561499"
  If winning NAICS not in core_naics_code → removeNaicsCode() → replaces with "561499".
  AI prompt also explicitly uses NAICS_OF_LAST_RESORT="561499" when no evidence.

PIPELINE B — Winner-Takes-All (customer_table.sql):
  WHEN COALESCE(zi_match_confidence,0) > COALESCE(efx_match_confidence,0)
    THEN zi_c_naics6   (ZoomInfo NAICS — ALL ZI firmographic data wins)
  ELSE efx_primnaicscode  (Equifax NAICS — ALL EFX firmographic data wins)
  OC / Liberty / Middesk / Trulioo IGNORED entirely in Pipeline B.

CONCLUSION — a blank or 561499 NAICS means:
  (a) No vendor returned a record for this business (no match in their database)
  (b) All vendors returned null naics_code in their firmographic response
  (c) AI fired and returned 561499 (no evidence + NAICS_OF_LAST_RESORT)
  (d) AI returned an invalid code → removeNaicsCode() → replaced with 561499
  NOT: Worth dropped a low-confidence value (Rule 4 prohibits this)
""",
    "source_code_reference": (
        "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts: "
        "NAICS_OF_LAST_RESORT='561499', removeNaicsCode(), minimumSources=1, maximumSources=3. "
        "integration-service/lib/facts/rules.ts: factWithHighestConfidence(), "
        "weightedFactSelector(), manualOverride() — no minimum cutoff anywhere. "
        "integration-service/lib/facts/businessDetails/index.ts: naics_code source list. "
        "warehouse-service/.../customer_table.sql: Pipeline B winner-takes-all SQL."
    ),
}

# ── The 6 Pipeline A rules (for display in the Streamlit app) ─────────────────
PIPELINE_A_NAICS_RULES = [
    {
        "number": 1,
        "name": "factWithHighestConfidence()",
        "colour": "#60A5FA",
        "description": (
            "Sort all VALID sources by confidence. Highest wins if gap > 5% (WEIGHT_THRESHOLD=0.05). "
            "Confidence = XGBoost entity-match score (match.index/55) for ZI/EFX/OC."
        ),
        "formula": "|conf_A - conf_B| > 0.05 → higher wins",
    },
    {
        "number": 2,
        "name": "weightedFactSelector() [Tie-break]",
        "colour": "#34D399",
        "description": (
            "If top two sources within 5% confidence, break tie using source weight: "
            "Middesk(2.0) > OC(0.9) > ZI(0.8) = Trulioo(0.8) > EFX(0.7) > SERP(0.3) > AI(0.1)"
        ),
        "formula": "Middesk(2.0) > OC(0.9) > ZI(0.8)=TRU(0.8) > EFX(0.7) > AI(0.1)",
    },
    {
        "number": 3,
        "name": "manualOverride() [ALWAYS WINS]",
        "colour": "#FCD34D",
        "description": (
            "Analyst sets via PATCH /facts/.../override/{factName}. "
            "Stored in override:{...} field. Evaluated FIRST before any other rule."
        ),
        "formula": "override present → wins unconditionally",
    },
    {
        "number": 4,
        "name": "NO minimum confidence cutoff",
        "colour": "#F87171",
        "description": (
            "CRITICAL: NO 'confidence >= X' rule exists. "
            "If one source returned a code at confidence 0.05 — it wins. "
            "Low confidence IS visible in API (source.confidence) but does NOT block the code."
        ),
        "formula": "any valid value from any source → eligible to win",
    },
    {
        "number": 5,
        "name": "AI safety net",
        "colour": "#A78BFA",
        "description": (
            "AI (GPT-5-mini, weight=0.1) triggers when n_non_AI_sources < minimumSources=1 "
            "AND total_sources < maximumSources=3. Weight=0.1 so AI rarely wins."
        ),
        "formula": "n_non_AI_sources < 1 AND total_sources < 3 → AI fires",
    },
    {
        "number": 6,
        "name": 'Last resort: "561499"',
        "colour": "#F87171",
        "description": (
            "After AI runs: if winning NAICS NOT in core_naics_code (invalid code), "
            "removeNaicsCode() replaces with '561499'. "
            "AI prompt also returns NAICS_OF_LAST_RESORT='561499' when it has no evidence."
        ),
        "formula": "code NOT IN core_naics_code → removeNaicsCode() → '561499'",
    },
]

# ── Metadata for the app ───────────────────────────────────────────────────────
ALL_SECTIONS = sorted(set(v["section"] for v in FIELD_LINEAGE.values()))
ALL_DATA_TYPES = sorted(set(v["data_type"] for v in FIELD_LINEAGE.values()))
ALL_FIELD_KEYS = list(FIELD_LINEAGE.keys())

PIPELINE_OVERVIEW = """
## Worth AI Data Pipeline Overview

When a business is submitted (POST /businesses/customers/{customerID}), the following pipeline runs:

### Pipeline A — Real-Time (Integration Service)
1. **Applicant data** stored in `rds_cases_public.data_businesses` and `data_owners`
2. **Vendor lookups** fired in parallel:
   - Middesk (SoS, TIN, watchlist) → platform_id=16, weight=2.0
   - OpenCorporates (global registry) → platform_id=23, weight=0.9
   - ZoomInfo (firmographic) → platform_id=24, weight=0.8
   - Trulioo (KYB, watchlist, UK/CA) → platform_id=38, weight=0.8
   - Equifax (credit bureau) → platform_id=17, weight=0.7
   - SERP (web scraping, WHOIS) → platform_id=22
   - Plaid IDV (per owner) → platform_id=40
3. **Fact Engine** runs rules per field → selects winning value
4. **Deferred tasks** (AI Enrichment, manual review) run after initial facts
5. **Facts stored** in `rds_warehouse_public.facts` (business_id + name → JSONB value)
6. **Kafka** publishes facts to `facts.v1` topic → warehouse-service writes to Redshift

### Pipeline B — Batch Redshift
- Runs on scheduled cadence
- ZoomInfo vs Equifax winner rule only
- Stored in `datascience.customer_files`

### Key Tables
| Table | Schema | Purpose |
|-------|--------|---------|
| `facts` | `rds_warehouse_public` | All 200+ facts per business (JSONB) |
| `request_response` | `integration_data` | Raw vendor API responses |
| `data_businesses` | `rds_cases_public` | Core business record |
| `data_owners` | `rds_cases_public` | Owner/officer records |
| `data_cases` | `rds_cases_public` | Case status and metadata |
| `core_naics_code` | `rds_cases_public` | NAICS lookup |
| `core_mcc_code` | `rds_cases_public` | MCC lookup |
| `customer_files` | `datascience` | Pipeline B wide table |

### Why Blank/NULL Values Appear
1. **Integrations still processing** — vendor API not yet returned → "Integrations currently processing" banner
2. **Entity not found by vendor** — Middesk searched SoS and found nothing → "No Registry Data to Display"
3. **Vendor returned null field** — Middesk found entity but that field is absent in their response
4. **AI enrichment returned fallback** — all vendor NAICS null → AI returns 561499/5614
5. **Applicant did not submit** — required field missing from onboarding form
6. **IDV not yet initiated** — owner has not clicked the Plaid link

**Worth does NOT suppress data based on confidence thresholds for display.**
The Fact Engine selects the best available value, but if no vendor returned any value, the field is blank.
"""

# ── Code References: exact file + line for every claim ────────────────────────
# Repo base URLs for generating clickable GitHub links
REPO_BASE_URLS = {
    "SIC-UK-Codes": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main",
    "Industry-Classification": "https://github.com/wecsleyprates-design/Industry-Classification/blob/main",
    "Entity-Matching": "https://github.com/wecsleyprates-design/Entity-Matching/blob/main",
}

def ref(repo, path, line_start, line_end, claim, what_it_proves):
    """Helper to build a single code reference entry."""
    return {
        "repo": repo,
        "path": path,
        "line_start": line_start,
        "line_end": line_end,
        "claim": claim,
        "what_it_proves": what_it_proves,
        "url": f"{REPO_BASE_URLS.get(repo,'')}/{path}#L{line_start}-L{line_end}",
    }

FIELD_CODE_REFERENCES = {
    "tin.value": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 399, 428,
            "tin_submitted is the raw EIN from the applicant (masked)",
            "The getter reads businessDetails.tin and maskString(tin). Source: businessDetails (applicant submission)."),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 429, 481,
            "tin_match is the Middesk TIN task result object",
            "middesk.reviewTasks.find(task => task.key === 'tin') — returns {status, message, sublabel}"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 482, 491,
            "tin_match_boolean is the boolean derived from tin_match.status === 'success'",
            "dependencies: ['tin_match'], fn: value?.status === 'success' → TRUE else FALSE"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/rules.ts", 109, 123,
            "manualOverride always checked first for every fact",
            "engine.getManualSource()?.rawResponse?.[factName] — analyst override wins unconditionally"),
        ref("SIC-UK-Codes",
            "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts", 55, 64,
            "AI enrichment trigger: naics_code minimumSources=1, mcc_code minimumSources=1",
            "DEPENDENT_FACTS config: naics_code: { maximumSources:3, minimumSources:1 }"),
    ],
    "watchlist.hits.value": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/rules.ts", 273, 344,
            "combineWatchlistMetadata merges hits from all sources with deduplication",
            "Dedup key: type|title/agency|entity_name|url. Filters out ADVERSE_MEDIA hits."),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 1442, 1480,
            "watchlist fact is populated from Middesk reviewTasks and Trulioo business/person responses",
            "middesk.reviewTasks.find(task => task.type === 'watchlist') + Trulioo watchlist results"),
    ],
    "watchlist.value.metadata": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/rules.ts", 273, 344,
            "combineWatchlistMetadata builds the metadata array with entity_type per hit",
            "Each hit: {type, metadata:{title}, entity_name, url, entity_type: BUSINESS|PERSON}"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 1442, 1480,
            "watchlist_raw fact stores the full combined watchlist object",
            "name='watchlist_raw' in rds_warehouse_public.facts stores full merged metadata"),
    ],
    "legal_name.value": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 192, 239,
            "legal_name fact is wired to middesk businessEntityVerification.name as primary source",
            "middesk: 'businessEntityVerification.name' path — highest weight 2.0 wins"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/sources.ts", 189, 230,
            "Middesk source has weight=2.0, confidence from task-based scoring",
            "dictionary.middesk: { weight: 2, confidence: 0.15 + 0.20×tasks_passing }"),
    ],
    "dba_found.value[n]": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 318, 355,
            "dba_found is populated from Middesk names[] where submitted=false",
            "middesk: names.filter(n => n.submitted===false).map(n => n.name)"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/rules.ts", 77, 98,
            "combineFacts rule merges DBA names from all sources into deduplicated array",
            "flatMap + Array.from(new Set()) — all DBA names from all vendors combined"),
    ],
    "sos_active.value": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 1426, 1440,
            "sos_active is computed from sos_filings — true if any filing has active:true",
            "sos_filings.some(f => f.active === true) → sos_active=true"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 717, 860,
            "sos_filings is populated from Middesk registrations[] and OpenCorporates sosFilings[]",
            "middesk: registrations.map({status, entity_type, registration_date, state, officers}). OC: sosFilings.map(...)"),
    ],
    "sos_filings.value[n].entity_type": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 717, 780,
            "entity_type comes from Middesk registrations[n].entity_type",
            "SoSRegistration object: { entity_type, active, filing_date, state, officers, foreign_domestic }"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 781, 860,
            "OC entity_type normalised: company_type string → llc/corporation/llp/lp/sole proprietorship",
            "company_type.toLowerCase().includes('llc') → entity_type='llc' etc."),
    ],
    "sos_filings.value[n].filing_date": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 717, 780,
            "filing_date = registration_date from Middesk registrations[n].registration_date",
            "SoSRegistration: { filing_date: registration_date, registration_date }"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/businessDetails/index.ts", 340, 370,
            "formation_date also populated from same Middesk data via businessEntityVerification.formation_date",
            "middesk: businessEntityVerification.formation_date.toISOString()"),
    ],
    "sos_filings.value[n].state": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 717, 780,
            "state = registration_state from Middesk registrations[n].registration_state",
            "SoSRegistration: { state: registration_state, jurisdiction: 'us::'+state.toLowerCase() }"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 781, 860,
            "OC state derived from jurisdiction_code: split by '_' → second part → uppercase",
            "jurisdictionCodeToState('us_fl') → 'FL'. foreign_domestic from home_jurisdiction_code comparison."),
    ],
    "mcc_code": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/businessDetails/index.ts", 391, 415,
            "mcc_code_found = AI direct response, mcc_code_from_naics = calculated via rel_naics_mcc",
            "mcc_code_found: { source: AINaicsEnrichment, path: 'response.mcc_code' }"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/businessDetails/index.ts", 416, 440,
            "mcc_code = foundMcc?.value ?? inferredMcc?.value (AI-provided preferred over derived)",
            "fn: (engine) => foundMcc?.value ?? inferredMcc?.value — AI wins, then lookup"),
        ref("SIC-UK-Codes",
            "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts", 67, 67,
            "NAICS_OF_LAST_RESORT = '561499' — the fallback when AI has no evidence",
            "public readonly NAICS_OF_LAST_RESORT = '561499'"),
        ref("SIC-UK-Codes",
            "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts", 193, 215,
            "removeNaicsCode() replaces invalid AI code with 561499",
            "if AI code NOT in core_naics_code → naics_code = NAICS_OF_LAST_RESORT"),
        ref("SIC-UK-Codes",
            "warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql", 113, 118,
            "Pipeline B: CASE WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6",
            "COALESCE(CASE WHEN zi_conf>efx_conf THEN zi_c_naics6 ELSE efx_primnaicscode END, naics_code)"),
    ],
    "people.value[n].name, people.value[n].titles[n]": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 717, 780,
            "officers come from Middesk registrations[n].officers array",
            "peopleFact.fn(engine, middesk) → filter by jurisdictions matching registration_state"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/rules.ts", 77, 98,
            "people are merged via combineFacts from all sources",
            "combineFacts deduplicates people across Middesk, OC, Trulioo"),
    ],
    "verification_result.account_authentication_response.verification_response": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 493, 527,
            "idv_status aggregates Plaid IDV results per owner with status counts",
            "plaidIdv source: countBy(plaidStatus → worthStatus). Returns {SUCCESS:N, FAILED:N, PENDING:N}"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 528, 553,
            "idv_passed = count of SUCCESS IDV responses; idv_passed_boolean = idv_passed > 0",
            "dependencies:['idv_status']. fn: idvStatus?.SUCCESS — count of successful verifications"),
    ],
    "status": [
        ref("SIC-UK-Codes",
            "case-service/src/api/v1/modules/case-management/case-management.ts", 1555, 1574,
            "Case status read from data_cases.status → core_case_statuses.code in getCaseByIDQuery",
            "LEFT JOIN core_case_statuses ON core_case_statuses.id = data_cases.status"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 618, 630,
            "verification_status fact from Trulioo clientData.status",
            "truliooResponse?.clientData?.status — 'completed'/'success'/'failed'/'pending'"),
    ],
    "data.applicant.status": [
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/kyb/index.ts", 618, 630,
            "verification_status from Trulioo for UK/CA, from Middesk for US",
            "truliooResponse?.clientData?.status OR middesk businessEntityVerification.status"),
        ref("SIC-UK-Codes",
            "integration-service/lib/facts/sources.ts", 189, 280,
            "Middesk source computes confidence as task-based score; business_verified derived from confidence",
            "confidence = 0.15 + isTaskSuccess(middesk,'name')×0.2 + ... → business_verified when confidence high"),
    ],
}
