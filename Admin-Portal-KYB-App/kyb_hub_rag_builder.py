"""
kyb_hub_rag_builder.py
======================
Builds the RAG index for the KYB Intelligence Hub (kyb_hub_app.py).
Sources: api-docs, integration-service, microsites, warehouse-service,
         plus inline knowledge about Worth Score, Watchlist, Domestic/Foreign.
"""

import os, json, re, math
from pathlib import Path

BASE  = Path(__file__).parent
INDEX = BASE / "kyb_hub_rag_index.json"
CHUNK_SIZE = 40
CHUNK_OVERLAP = 8

SOURCE_FILES = [
    # ── API Docs ────────────────────────────────────────────────────────────
    (BASE/"api-docs/api-reference/integration/facts/kyb.md",          "API_DOCS",
     "KYB facts API: GET /facts/business/{id}/kyb — all KYB fact names, response shape, source.platformId, alternatives[], confidence"),
    (BASE/"api-docs/api-reference/integration/verification/get-verification-details.md", "API_DOCS",
     "Verification details API: GET /verification/businesses/{id} — businessEntityVerification, review tasks, TIN task, SOS match task"),
    (BASE/"api-docs/api-reference/integration/verification/get-business-website-data.md","API_DOCS",
     "Website data API: GET /verification/businesses/{id}/website-data — domain, parked, creation_date, status"),
    (BASE/"api-docs/use-cases/pre-filling-data/step-3-kyb.md",        "API_DOCS",
     "KYB pre-filling flow: how to use the GET /kyb endpoint, response fields, field lineage"),
    (BASE/"api-docs/use-cases/worth-360-report/overview.md",          "API_DOCS",
     "Worth 360 report API: what fields are included, how to request, report structure"),
    (BASE/"api-docs/webhooks/business.md",                             "API_DOCS",
     "Business webhooks: business.kyb_completed, business.updated — event payloads"),
    (BASE/"api-docs/introduction.md",                                  "API_DOCS",
     "Worth AI API introduction: base URL, authentication, rate limits, API versioning"),
    # ── Integration Service — KYB facts ─────────────────────────────────────
    (BASE/"integration-service-main/lib/facts/kyb/index.ts",          "INTEGRATION_SERVICE",
     "KYB fact definitions: sos_filings, tin_match, tin_match_boolean, watchlist, watchlist_hits, "
     "name_match, address_match, idv_status, idv_passed_boolean, dba_found, people, adverse_media_hits. "
     "Source priority, confidence calculation, Middesk/OC/Trulioo logic"),
    (BASE/"integration-service-main/lib/facts/kyb/types.ts",          "INTEGRATION_SERVICE",
     "KYB TypeScript types: SoSRegistration (foreign_domestic, active, state), WatchlistValue, "
     "WatchlistValueMetadatum (PEP, SANCTIONS, ADVERSE_MEDIA), KYBSosFilingValue"),
    (BASE/"integration-service-main/lib/facts/kyb/consolidatedWatchlist.ts", "INTEGRATION_SERVICE",
     "Consolidated watchlist logic: merges business + person hits, deduplication, filterOutAdverseMedia, "
     "createWatchlistDedupKey — adverse_media excluded from consolidated watchlist"),
    (BASE/"integration-service-main/lib/facts/kyb/watchlistHelpers.ts","INTEGRATION_SERVICE",
     "Watchlist helpers: extractWatchlistHitsFromScreenedPeople, transformTruliooBusinessWatchlistResults, "
     "person-level screening, UBO director watchlist hits"),
    (BASE/"integration-service-main/lib/facts/kyb/peopleHelpers.ts",  "INTEGRATION_SERVICE",
     "People/UBO helpers: building screened_people fact, person-level IDV and watchlist"),
    (BASE/"integration-service-main/lib/facts/sources.ts",            "INTEGRATION_SERVICE",
     "Source definitions: Middesk (pid=16, w=2.0, confidence=task-based 0.15+0.20*tasks), "
     "OC (pid=23, w=0.9, confidence=index/55), ZI (pid=24, w=0.8), EFX (pid=17, w=0.7), "
     "Trulioo (pid=38, w=0.8, status-based), AI (pid=31, w=0.1), SERP (pid=22), MAX_CONFIDENCE_INDEX=55"),
    (BASE/"integration-service-main/lib/facts/rules.ts",              "INTEGRATION_SERVICE",
     "Fact Engine winner selection rules: manualOverride (rule1), factWithHighestConfidence (rule2), "
     "weightedFactSelector (rule3), NO minimum confidence cutoff (rule4), AI safety net (rule5), "
     "removeNaicsCode/561499 fallback (rule6), WEIGHT_THRESHOLD=0.05"),
    (BASE/"integration-service-main/lib/facts/factEngine.ts",         "INTEGRATION_SERVICE",
     "Fact Engine implementation: how facts are resolved, source priority, confidence comparison, "
     "alternatives array population — all non-winning sources become alternatives[]"),
    (BASE/"integration-service-main/lib/facts/businessDetails/index.ts","INTEGRATION_SERVICE",
     "Business detail facts: naics_code (EFX w=0.7, ZI w=0.8, OC w=0.9, SERP w=0.3, Trulioo w=0.7, AI w=0.1), "
     "mcc_code (from AI or rel_naics_mcc lookup), industry (2-digit NAICS prefix), "
     "num_employees (EFX corpempcnt, ZI zi_c_employees), revenue, worth_score"),
    (BASE/"integration-service-main/lib/aiEnrichment/aiNaicsEnrichment.ts","INTEGRATION_SERVICE",
     "AI NAICS enrichment: triggers when <1 non-AI source has naics_code, uses GPT, "
     "NAICS_OF_LAST_RESORT=561499, removeNaicsCode() for invalid codes, "
     "web_search only when params.website set, pid=31 weight=0.1"),
    # ── Microsites — KYB UI components ──────────────────────────────────────
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/BackgroundTab.tsx","MICROSITES",
     "Background tab UI: industry, NAICS, MCC, revenue, employees, formation date, entity type fields shown"),
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/BusinessRegistrationTab.tsx","MICROSITES",
     "Business Registration tab UI: SOS filings (domestic/foreign), TIN verification badge, Middesk review tasks"),
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/ContactInformationTab.tsx","MICROSITES",
     "Contact Information tab: addresses (submitted vs found), name match, address match, deliverable check"),
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/WebsiteTab.tsx","MICROSITES",
     "Website tab UI: website URL, parked domain, creation date, expiration date, status badges"),
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/components/SOSBadge.tsx","MICROSITES",
     "SOS badge component: VERIFIED (active=true), MISSING_ACTIVE_FILING (inactive), INVALIDATED — "
     "badge colors, tooltips, conditions for each state"),
    (BASE/"microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/components/TinBadge.tsx","MICROSITES",
     "TIN badge: Verified (tin_match_boolean=true, CheckBadgeIcon), Unverified (failure, ExclamationTriangle), "
     "status=pending shown as Unverified with message"),
    # ── Warehouse Service ────────────────────────────────────────────────────
    (BASE/"warehouse-service-main/datapooler/adapters/redshift/customer_file/tables/customer_table.sql","WAREHOUSE_SERVICE",
     "customer_table SQL: Pipeline B winner-takes-all NAICS (ZI vs EFX), watchlist_verification, watchlist_count, "
     "worth_score, match_confidence, zi_match_confidence, efx_match_confidence"),
    (BASE/"warehouse-service-main/datapooler/adapters/redshift/score/sp_worth_score_auditing_refresh.sql","WAREHOUSE_SERVICE",
     "Worth Score audit stored procedure: warehouse.worth_score_input_audit, fill rates for 100+ model features, "
     "score_date, rows_per_day, fill_naics6, fill_revenue, fill_state, fill_age_bankruptcy"),
    (BASE/"warehouse-service-main/datapooler/adapters/redshift/cases/gather-case-details.sql","WAREHOUSE_SERVICE",
     "Case details SQL: joins rds_manual_score_public.business_scores, weighted_score_850, risk_level, "
     "score_decision, APPROVE/FURTHER_REVIEW_NEEDED/DECLINE, case_id linkage"),
]

INLINE_KNOWLEDGE = [
    ("WORTH_SCORE", "Worth Score Architecture",
     """Worth Score is a 300-850 scale risk score computed by ai-score-service using a 3-model ensemble:
1. Firmographic XGBoost (initial_layer): state, bus_struct, naics6, primsic, count_employees, age_business, indicators
2. Financial neural net (second_layer + neural_layer PyTorch): revenue, bs_total_assets, bs_total_debt, ratio_debt_to_equity, cf_operating_cash_flow, is_net_income
3. Economic model: gdp_pch, t10y2y, vix, unemp, cpi, wagegrowth, dolindx
Pipeline: preprocessor → missing imputer → naics_transformer → encoder → initial_layer → scaler → second_layer → neural_layer → quantiler → ensemble → calibrator
Output: prediction (0-1) scaled to 300-850: Score = prediction × 550 + 300
Tables: rds_manual_score_public.business_scores (weighted_score_850, weighted_score_100, risk_level, score_decision)
       rds_manual_score_public.data_current_scores (latest score per business, join on score_id)
       rds_manual_score_public.business_score_factors (SHAP-equivalent factor contributions per category)
       warehouse.worth_score_input_audit (daily fill rates for all 100+ input features)
score_decision values: APPROVE, FURTHER_REVIEW_NEEDED, DECLINE (customer-configurable thresholds)
risk_level: HIGH (<500), MODERATE (500-650), LOW (>650)
NOTE: score_status column does NOT exist in current schema version"""),

    ("WATCHLIST", "Watchlist Data Architecture",
     """Watchlist screening architecture:
Source vendors: Trulioo PSC (listType: PEP, SANCTIONS), Middesk (watchlist review task key='watchlist')
Data flow: Vendor → integration_data.business_entity_review_task (RDS) → Facts Engine → watchlist_raw → watchlist → watchlist_hits
Redshift: rds_integration_data.business_entity_review_task (Spectrum) → clients.verification_results → clients.customer_table
Facts:
  watchlist_raw: direct from vendor, unprocessed
  watchlist: consolidated (business + person hits merged & deduped, adverse_media EXCLUDED)
  watchlist_hits: COUNT of hits (watchlist.value.metadata.length)
  adverse_media_hits: separate count from Trulioo adverse_media listType + adverseMediaDetails.records
  screened_people: array of person-level (UBO/director) screening results
WATCHLIST_HIT_TYPE constants: PEP, SANCTIONS, ADVERSE_MEDIA
Adverse media deliberately excluded from consolidated watchlist (filterOutAdverseMedia in consolidatedWatchlist.ts L57)
Integration table: business_entity_review_task WHERE key='watchlist' AND category='compliance'
  status='warning' = hits found, 'success' = clean
  metadata JSONB = array of hit objects with listType, entityName, url
clients.customer_table: watchlist_count (from verification_results.sql), watchlist_verification (1=clean, 0=hits)
SQL confirmed working: SELECT verification_status, COUNT(*) FROM rds_integration_data.rel_banking_verifications GROUP BY 1"""),

    ("DOMESTIC_FOREIGN", "Domestic vs Foreign SOS Registration",
     """Domestic = business originally incorporated in that state (primary registration)
Foreign = business incorporated in another state, registered to operate here (secondary registration)
US-only concept, shown in Admin Portal KYB → Business Registration tab.
foreign_domestic field determination logic (integration-service/lib/facts/kyb/index.ts):
  Middesk source: registration.foreign_domestic = 'foreign' or 'domestic' from registrations[] array
  OC source:
    if company_type contains 'foreign' → foreign
    if company_type contains 'domestic' → domestic
    if company_type === 'DLLC' → domestic
    if home_jurisdiction_code === jurisdiction_code → domestic (same state)
    if home_jurisdiction_code !== jurisdiction_code → foreign (different state)
  Trulioo: does NOT set foreign_domestic
Priority: Middesk (pid=16) first, then OC (pid=23) fallback
UI badges: domestic → 'Primary' badge, foreign → 'Secondary' badge
Tooltip: 'Domestic – formed in this state. Foreign – formed in another state, registered to operate here.'
TypeScript type: SoSRegistration interface in types.ts
  foreign_domestic?: 'foreign' | 'domestic'
  active?: boolean, state: string, entity_type?: string, registration_date: string
sos_filings fact stored as JSON array, each element is one SOS filing
IMPORTANT: sos_filings is too large for Redshift federation (97KB+) — must query PostgreSQL RDS (port 5432)
formation_state fact = state where entity was incorporated (domestic state, scalar, safe to query)
Entity resolution gap: if business incorporated in DE but operates in TX, address-based Middesk search
  finds Texas foreign qualification (lower confidence), NOT the Delaware domestic record (primary)
Fix recommendation: when sos_match=false AND formation_state ≠ operating state, re-search in formation_state"""),

    ("FACT_ENGINE", "Fact Engine Winner Selection Rules",
     """Fact Engine selects ONE winning source per fact from all vendor inputs.
The winning source value = what the customer sees in the Admin Portal.
All other sources become alternatives[] in the fact JSON.
Rule 1: manualOverride() — analyst override ALWAYS wins, no exceptions
Rule 2: factWithHighestConfidence() — highest confidence wins IF gap to next > WEIGHT_THRESHOLD (0.05 = 5%)
Rule 3: weightedFactSelector() — tie-break by platform weight when within 5% confidence
Rule 4: NO minimum confidence cutoff — a source with confidence=0.05 CAN still win if only source
Rule 5: AI safety net — AINaicsEnrichment triggers when <1 non-AI source has naics_code
Rule 6: removeNaicsCode() — if AI NAICS not in core_naics_code table → replaced with 561499
Confidence formulas by vendor:
  Middesk (pid=16, w=2.0): 0.15 base + 0.20 per successful review task (max 4 tasks: name, TIN, address, SOS)
  OC (pid=23, w=0.9): match.index / MAX_CONFIDENCE_INDEX (55)
  ZoomInfo (pid=24, w=0.8): match.index / 55
  Equifax (pid=17, w=0.7): XGBoost prediction OR heuristic index/55
  Trulioo (pid=38, w=0.8): status-based: success=0.70, pending=0.40, failed=0.20, +bonuses for name/address/UBO
  AI (pid=31, w=0.1): self-reported HIGH≈0.70, MED≈0.50, LOW≈0.20
  SERP (pid=22, w=0.3): heuristic based on businessMatch + local_results
Fact JSON structure: {value: ..., source: {platformId, confidence, updatedAt}, alternatives: [{value, source: {platformId, confidence}}], override: {value, userId}}"""),

    ("NAICS_MCC", "NAICS/MCC Classification Architecture",
     """NAICS code selection (businessDetails/index.ts):
Sources in priority order (by weight * confidence):
  Equifax: efx_primnaicscode, weight=0.7
  ZoomInfo: zi_c_naics6, weight=0.8
  OpenCorporates: industry_code_uids parsed 'us_naics-XXXXXX', weight=0.9 (registryPreferredRule)
  SERP: businessLegitimacyClassification.naics_code, weight=0.3
  Trulioo: extractStandardizedIndustries, weight=0.7
  businessDetails (applicant): naics_code if 6-digit regex, weight=0.2
  AI enrichment: response.naics_code, weight=0.1 (LAST RESORT)
561499 fallback = 'All Other Business Support Services' — assigned when all vendors fail
removeNaicsCode(): validates against core_naics_code table, replaces invalid AI codes with 561499
MCC code: mcc_code_found (from AI) ?? mcc_code_from_naics (via rel_naics_mcc lookup)
mcc_description customer-visible: 'Fallback MCC per instructions...' = Gap G5 (internal debug text exposed)
industry: 2-digit NAICS prefix → core_business_industries table
Tables: rds_warehouse_public.facts (name='naics_code'), clients.customer_table (primary_naics_code from Pipeline B)
Pipeline A: Fact Engine, all 6+ sources → rds_warehouse_public.facts (what customer sees)
Pipeline B: ZI vs EFX winner-takes-all → datascience.customer_files (analytics only)"""),

    ("TIN_VERIFICATION", "TIN/EIN Verification Architecture",
     """TIN = Tax Identification Number (EIN for businesses)
Verification flow:
  1. Applicant submits EIN on onboarding form → tin_submitted fact (pid=applicant)
  2. Middesk runs 'tin' review task → IRS direct query
  3. tin_match fact: {status: 'success'|'failure'|'pending', message: string, sublabel: string}
  4. tin_match_boolean: true IFF tin_match.status === 'success' (integration-service/lib/facts/kyb/index.ts L488-490)
Middesk TIN task messages:
  'The IRS has a record for the submitted TIN and Business Name combination' → success
  'The IRS does not have a record...' → failure (wrong EIN or name mismatch)
  'We believe the submitted TIN is associated with a different Business Name' → failure, FRAUD RISK
  'Duplicate request' → failure, re-submit after 24h
  'Invalid TIN' → failure, format error (must be 9 digits)
  'IRS unavailable' → failure, temporary, auto-retry
If Middesk has no TIN task → Trulioo BusinessRegistrationNumber comparison used as fallback
Data integrity check: tin_match_boolean=true MUST always have tin_match.status='success'
  Any divergence = code bug in integration-service (L488-490)
SQL to check: SELECT name, value FROM rds_warehouse_public.facts WHERE business_id='UUID' AND name IN ('tin','tin_match','tin_match_boolean','tin_submitted')"""),
]


def build_index():
    chunks = []

    def add_chunks(text, source_type, description, path_label=""):
        lines = text.splitlines(keepends=True)
        step = CHUNK_SIZE - CHUNK_OVERLAP
        for start in range(0, len(lines), step):
            end = min(start + CHUNK_SIZE, len(lines))
            segment = "".join(lines[start:end]).strip()
            if not segment or len(segment) < 20:
                continue
            words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", segment.lower())
            compounds = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", segment)
            tf = {}
            for w in words:
                tf[w] = tf.get(w, 0) + 1
            for c in compounds:
                tf[c.lower()] = tf.get(c.lower(), 0) + 5
            chunks.append({
                "id": len(chunks),
                "source_type": source_type,
                "path": path_label,
                "description": description,
                "text": segment[:4000],
                "line_start": start + 1,
                "line_end": end,
                "tf": tf,
            })

    # Index file sources
    for path, source_type, description in SOURCE_FILES:
        if not path.exists():
            print(f"  SKIP (not found): {path.name}")
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
            add_chunks(text, source_type, description, str(path.name))
            n = sum(1 for c in chunks if c["path"] == str(path.name))
            print(f"  ✅ {path.name}: {len(text.splitlines())} lines → {n} chunks")
        except Exception as e:
            print(f"  ERROR {path.name}: {e}")

    # Index inline knowledge
    for source_type, title, knowledge in INLINE_KNOWLEDGE:
        add_chunks(knowledge, source_type, title, f"[inline:{title}]")
        print(f"  ✅ [inline] {title}")

    # Also index api-docs markdown files
    api_docs_dir = BASE / "api-docs"
    if api_docs_dir.exists():
        for md in api_docs_dir.rglob("*.md"):
            try:
                text = md.read_text(encoding="utf-8", errors="replace")
                rel = str(md.relative_to(BASE))
                add_chunks(text, "API_DOCS", f"API documentation: {md.stem}", rel)
            except Exception:
                pass
        extra = sum(1 for c in chunks if c["source_type"]=="API_DOCS" and "[inline" not in c["path"])
        print(f"  ✅ api-docs markdown: {extra} additional chunks")

    # Build IDF
    N = len(chunks)
    df = {}
    for chunk in chunks:
        for word in chunk["tf"]:
            df[word] = df.get(word, 0) + 1
    idf = {w: math.log((N + 1) / (d + 1)) for w, d in df.items()}

    index = {"chunks": chunks, "idf": idf, "N": N,
             "source_files": [str(p.name) for p, _, _ in SOURCE_FILES]}

    INDEX.write_text(json.dumps(index), encoding="utf-8")
    print(f"\n✅ Hub RAG index written: {INDEX}")
    print(f"   Total chunks: {N}")
    return index


def search(index, query, top_k=8):
    idf = index["idf"]
    qwords = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", query.lower())
    qcompounds = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", query.lower())
    scores = []
    for chunk in index["chunks"]:
        score = sum(chunk["tf"].get(w, 0) * idf.get(w, 0) for w in qwords)
        for c in qcompounds:
            score += chunk["tf"].get(c, 0) * idf.get(c, 0) * 4
        if any(c in chunk["text"].lower() for c in qcompounds):
            score *= 1.5
        scores.append((score, chunk))
    scores.sort(key=lambda x: -x[0])
    return [c for _, c in scores[:top_k] if _ > 0]


if __name__ == "__main__":
    print("Building KYB Hub RAG index…")
    build_index()
