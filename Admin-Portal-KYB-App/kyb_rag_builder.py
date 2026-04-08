"""
KYB Portal RAG Builder
Indexes source files from Admin-Portal-KYB + SIC-UK-Codes repos.
"""
import os, json, re, math
from pathlib import Path

ADMIN_PORTAL_ROOT = "/tmp/Admin-Portal-KYB"
SIC_UK_ROOT = "/tmp/SIC-UK-Codes"
INDEX_PATH = os.path.join(os.path.dirname(__file__), "kyb_rag_index.json")

SOURCE_FILES = [
    # ── Admin Portal Frontend ──────────────────────────────────────────
    ("customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
     "ADMIN_PORTAL",
     "KYB main component — all 5 sub-tabs rendered here. "
     "Business Registration: tin_match, sos_filings, SOS badge logic (L133-L403). "
     "Contact Info: addresses_deliverable, names_submitted, name_match_boolean (L406-L546). "
     "Watchlists: watchlist.value.metadata, individualWatchListHits (L554-L709). "
     "TIN badge: tin_match.value.status==='success' → 'Verified' (L137-L149)."),
    ("customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/SectionHeader.tsx",
     "ADMIN_PORTAL",
     "SOS badge logic — getSosBadgeConfig(). "
     "VERIFIED: sos_match_boolean=true AND sos_active=true. "
     "MISSING_ACTIVE_FILING (inactive): sos_match_boolean=true AND sos_active=false. "
     "UNVERIFIED: sos_match=warning. MISSING_ACTIVE_FILING (none): default. "
     "Badge tooltips: 'An active filing was found' vs 'No active SoS filing found'."),
    ("customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
     "ADMIN_PORTAL",
     "Industry section — Background sub-tab. "
     "Industry Name: businessDetailFacts.industry.value.name ?? business.industry.name ?? '-'. "
     "NAICS Code: businessDetailFacts.naics_code.value ?? business.naics_code ?? '-'. "
     "MCC Code: businessDetailFacts.mcc_code.value ?? business.mcc_code ?? '-'. "
     "NAICS Description: businessDetailFacts.naics_description.value ?? business.naics_title ?? '-'. "
     "MCC Description: businessDetailFacts.mcc_description.value ?? business.mcc_title ?? '-'. "
     "Shows '-' (dash) when both facts AND business DB have no value."),
    ("customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Business.tsx",
     "ADMIN_PORTAL",
     "Business details — Background sub-tab. "
     "Business Name: businessDetailFacts.business_name.value ?? business.name ?? '-'. "
     "DBA: businessDetailFacts.dba.value (array). "
     "Year Established: business.year_established or formation_date. "
     "Annual Revenue, Net Income, Employees from businessDetailFacts. "
     "Mailing Address: businessAddresses filtered by is_primary=false."),
    ("customer-admin-webapp-main/src/constants/SOSBadges.ts",
     "ADMIN_PORTAL",
     "SOS badge text and tooltip constants. "
     "VERIFIED tooltip: 'An active filing was found and is in good standing.' "
     "UNVERIFIED tooltip: 'A filing was found but its status is unknown.' "
     "MISSING_ACTIVE_FILING_INACTIVE: 'A filing was found but is not currently active.' "
     "MISSING_ACTIVE_FILING_NONE: 'No active Secretary of State filing found for this business.'"),
    ("customer-admin-webapp-main/src/constants/caseTabValues.ts",
     "ADMIN_PORTAL",
     "Case tab values row IDs and labels — the UCM decisioning result rows. "
     "tin_business_registration, business_address_business_registration, "
     "business_address_google_profile, business_name, website_parked_domain, "
     "website_status, watchlist_hits, idv_verification, google_profile, "
     "bankruptcies, judgements, liens, complaints, adverse_media, "
     "giact_account_status, giact_account_name, giact_contact_verification, "
     "email_breach, fraud_results, bot_presence, synthetic_identity_risk_score, stolen_identity_risk_score."),
    ("customer-admin-webapp-main/src/services/api/integration.service.ts",
     "ADMIN_PORTAL",
     "API service calls. "
     "getFactsKyb: GET /facts/business/{businessId}/kyb → all KYB facts. "
     "getFactsBusinessDetails: GET /facts/business/{businessId}/details → Background tab facts. "
     "getBusinessWebsite: GET /verification/businesses/{businessId}/website-data → Website tab. "
     "getIndividualWatchlistDetails: GET /verification/businesses/{businessId}/people/watchlist → Watchlist hits per person."),
    ("KYB-Tab-Admin-Portal.md",
     "ADMIN_PORTAL",
     "KYB Tab full reference guide — all 5 sub-tabs, data sources, API calls. "
     "Background: useGetFactsBusinessDetails + useGetFactsKyb. "
     "Business Registration: SOS filings from Middesk (primary), OC (fallback). "
     "Contact Information: addresses from multiple vendors, combineFacts merge. "
     "Website: useGetBusinessWebsite + useGetFactsBusinessDetails. "
     "Watchlists: useGetFactsKyb + useGetIndividualWatchlistDetails. "
     "Winning source selection rules from integration-service/lib/facts/rules.ts."),
    # ── Integration Service (backend) ──────────────────────────────────
    ("integration-service/lib/facts/kyb/index.ts",
     "SIC_UK",
     "KYB facts wiring — every KYB field definition and its sources. "
     "tin_submitted (L399), tin_match (L429), tin_match_boolean (L482). "
     "sos_filings (L717) from Middesk registrations + OC sosFilings. "
     "sos_active (L1426), sos_match (L1371). "
     "legal_name (L192), dba_found (L318), people (multiple sources). "
     "watchlist (L1442) from Middesk reviewTasks + Trulioo. "
     "verification_status (L618), idv_status (L493), idv_passed_boolean (L541)."),
    ("integration-service/lib/facts/businessDetails/index.ts",
     "SIC_UK",
     "Business detail facts — Background tab sources. "
     "naics_code (L318): equifax.primnaicscode, zoominfo.zi_c_naics6, OC industry_code_uids, SERP(w=0.3), Trulioo(w=0.7), AI(w=0.1). "
     "mcc_code_found (L391): AI response.mcc_code. "
     "mcc_code_from_naics (L399): calculated via rel_naics_mcc lookup. "
     "mcc_code (L416): foundMcc ?? inferredMcc. "
     "industry (L285): derived from naics_code 2-digit prefix → core_business_industries. "
     "num_employees (L385): equifax.corpemployees, zoominfo.zi_c_employees, OC.number_of_employees. "
     "year_established (L447): formation_date year, equifax.yrest, zoominfo.zi_c_year_founded. "
     "business_name (L173): businessDetails.name, zoominfo.zi_c_name, equifax.efx_name."),
    ("integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts",
     "SIC_UK",
     "AI NAICS/MCC enrichment — triggers when < 1 non-AI source has naics_code. "
     "NAICS_OF_LAST_RESORT = '561499' (L67). "
     "minimumSources=1, maximumSources=3 (L61-L63). "
     "removeNaicsCode() (L193): if AI code not in core_naics_code → replaced with 561499. "
     "System prompt (L99-L114): returns naics_code, mcc_code, confidence HIGH/MED/LOW. "
     "mcc fallback: 5614 with 'Fallback MCC per instructions...' description. "
     "web_search only enabled when params.website is set."),
    ("integration-service/lib/facts/rules.ts",
     "SIC_UK",
     "Fact Engine rules — winner selection. "
     "factWithHighestConfidence (L36): highest conf wins if gap > 5%. "
     "weightedFactSelector (L77): tie-break by weight. "
     "manualOverride (L109): always evaluated first. "
     "Rule 4: NO minimum confidence cutoff — low conf still wins. "
     "combineFacts (L77): merges arrays (addresses, names, people) from all sources. "
     "combineWatchlistMetadata (L273): deduplicates watchlist hits. "
     "registryPreferredRule (L157): prefers OC for classification_codes. "
     "truliooPreferredRule (L133): prefers Trulioo for UK/Canada."),
    ("integration-service/lib/facts/sources.ts",
     "SIC_UK",
     "Vendor sources — platform_id and weights. "
     "middesk: pid=16, weight=2.0, confidence=task-based (0.15+0.20×tasks). "
     "opencorporates: pid=23, weight=0.9, confidence=match.index/55. "
     "zoominfo: pid=24, weight=0.8, confidence=match.index/55. "
     "equifax: pid=17, weight=0.7, confidence=XGBoost prediction. "
     "trulioo: pid=38, weight=0.8, status-based confidence. "
     "AINaicsEnrichment: pid=31, weight=0.1. "
     "MAX_CONFIDENCE_INDEX=55. "
     "All responses stored in integration_data.request_response."),
    ("integration-service/src/messaging/kafka/consumers/handlers/report.ts",
     "SIC_UK",
     "Worth 360 Report handler. "
     "Fetches: tin_match_boolean, legal_name, name_match_boolean, sos_filings, sos_match (L763-L793). "
     "Returns: tin_match_boolean.value, sos_filings sorted by registration_date. "
     "Proves W360=Yes for: tin, sos, legal_name, name_match, watchlist."),
    ("integration-service/src/api/v1/modules/facts/controllers.ts",
     "SIC_UK",
     "KYB API facts controller — GET /facts/business/:id/kyb and /details. "
     "Special handling for tin.value (strips Verdata source, L87-L94). "
     "Returns all FactName fields as resolved facts with source.platformId, confidence, alternatives[]."),
    # ── Warehouse / Pipeline B ──────────────────────────────────────────
    ("warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql",
     "SIC_UK",
     "Pipeline B SQL — winner-takes-all. "
     "WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6 ELSE efx_primnaicscode. "
     "Same CASE controls: employees, revenue, name, address, city, ZIP, country, website. "
     "OC/Liberty/Middesk/Trulioo IGNORED in Pipeline B. "
     "Stores to datascience.customer_files. No AI fallback — NULL stays NULL."),
    # ── Case Service ────────────────────────────────────────────────────
    ("case-service/src/api/v1/modules/case-management/case-management.ts",
     "SIC_UK",
     "Case management API — getCaseByIDQuery (L1555-L1574). "
     "Joins data_businesses with core_naics_code, core_mcc_code, core_business_industries. "
     "Returns: naics_code, naics_title, mcc_code, mcc_title, industry_data, worth_score. "
     "Builds the KYB API response consumed by the admin portal Background tab."),
    # ── Microsites — portal rendering source ──────────────────────────────
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/config/BackgroundTab/fieldConfigs.tsx",
     "ADMIN_PORTAL",
     "DEFINITIVE Background tab field config — every field with fieldKey, label, section, editable flag. "
     "business_name(L101 editable), legal_name(L116 read-only), dba(L131 editable), "
     "primary_address(L146 editable), mailing_address(L172 editable), formation_date(L198 editable), "
     "revenue(L214 editable), net_income(L271 editable), corporation(L288 editable dropdown), "
     "num_employees(L303 editable), business_phone(L320 editable), email(L336 editable), "
     "minority_owned(L350 editable dropdown), woman_owned(L364), veteran_owned(L378), "
     "industry(L393 editable), naics_code(L408 editable), naics_description(L423 read-only), "
     "mcc_code(L440 editable), mcc_description(L455 read-only)."),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/components/SOSBadge.tsx",
     "ADMIN_PORTAL",
     "SOSBadge — badge per SoS filing. "
     "isInvalidated→INVALIDATED(warning). sosFiling.active=true→VERIFIED(info/blue,CheckBadgeIcon). "
     "sosFiling.active=false→MISSING_ACTIVE_FILING(error/red,XCircleIcon). "
     "Tooltip: 'An active filing was found and is in good standing.'"),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/components/TinBadge.tsx",
     "ADMIN_PORTAL",
     "TinBadge — TIN verification badge. "
     "tin_match_boolean.value=true→Verified(info,CheckBadgeIcon). "
     "tin_match.value.status='failure'→Unverified(warning,ExclamationTriangleIcon). "
     "Reads tin_match_boolean, tin_match, tin facts from kybFactsData."),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/components/BusinessRegistrationTab/EntityJurisdictionCell.tsx",
     "ADMIN_PORTAL",
     "EntityJurisdictionCell — renders Domestic/Foreign + Primary/Secondary badge. "
     "foreign_domestic='domestic'→Domestic + Primary badge. "
     "foreign_domestic='foreign'→Foreign + Secondary badge. "
     "undefined→N/A. Source: sos_filings[n].foreign_domestic from kyb facts."),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/hooks/BusinessRegistrationTab/useBusinessRegistrationTabDetails.tsx",
     "ADMIN_PORTAL",
     "Business Registration tab data hook — builds taxDetails and enhancedSosFilingsDetails arrays. "
     "taxDetails: Business Name=legal_name.value, Tax ID=tin.value. "
     "enhancedSosFilingsDetails maps sos_filings[n]: Filing Status(active→Active/Inactive), "
     "Entity Jurisdiction Type(EntityJurisdictionCell), State, Registration Date, "
     "Entity Type, Corporate Officers(CorporateOfficers component), Legal Entity Name. "
     "shouldHideSosForIntegration=true→empty (integrations running). "
     "hasDirtyBusinessRegistrationFields=true→shows N/A for all SOS fields."),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/WatchlistsTab/WatchlistsTab.tsx",
     "ADMIN_PORTAL",
     "WatchlistsTab — ALL hits consolidated in watchlist.value.metadata (business+person). "
     "IMPORTANT: No separate people/watchlist endpoint needed — backend now consolidates via "
     "trulioo_advanced_watchlist_results into watchlist.value.metadata. "
     "groupWatchlistHitsByEntityName groups by entity_name. "
     "BEST_65_PROXY_FACT feature flag controls proxy mode."),
    ("microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/hooks/WebsiteTab/useWebsiteNonEditableFields.tsx",
     "ADMIN_PORTAL",
     "Website tab non-editable fields — Creation Date, Expiration Date, Parked Domain, Status. "
     "isWebsiteDirty=true→all N/A (cleared when URL edited). "
     "websiteData.domain.creation_date→formatSourceDate(). "
     "status='online'→CheckCircleIcon badge. parked→Yes/No. "
     "Status values: online(success), offline(error), unknown(secondary)."),
]

CHUNK_SIZE = 30
CHUNK_OVERLAP = 5


def build_index():
    chunks = []
    for rel_path, source_type, description in SOURCE_FILES:
        if source_type == "ADMIN_PORTAL":
            full_path = os.path.join(ADMIN_PORTAL_ROOT, rel_path)
        else:
            full_path = os.path.join(SIC_UK_ROOT, rel_path)

        if not os.path.exists(full_path):
            print(f"  SKIP: {rel_path}")
            continue

        try:
            with open(full_path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except Exception as e:
            print(f"  ERROR {rel_path}: {e}")
            continue

        total = len(lines)
        step = CHUNK_SIZE - CHUNK_OVERLAP
        for start in range(0, total, step):
            end = min(start + CHUNK_SIZE, total)
            text = "".join(lines[start:end]).strip()
            if not text:
                continue
            split_words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", text.lower())
            compounds = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", text)
            all_terms = split_words + [c.lower() for c in compounds]
            tf = {}
            for w in all_terms:
                tf[w] = tf.get(w, 0) + 1
            for c in compounds:
                cl = c.lower()
                tf[cl] = tf.get(cl, 0) + 3
            chunks.append({
                "id": len(chunks),
                "source_type": source_type,
                "path": rel_path,
                "line_start": start + 1,
                "line_end": end,
                "description": description,
                "text": text[:3000],
                "tf": tf,
            })

        print(f"  {rel_path}: {total} lines → {len([c for c in chunks if c['path']==rel_path])} chunks")

    N = len(chunks)
    df = {}
    for chunk in chunks:
        for word in chunk["tf"]:
            df[word] = df.get(word, 0) + 1
    idf = {w: math.log((N + 1) / (d + 1)) for w, d in df.items()}

    index = {"chunks": chunks, "idf": idf, "N": N,
             "source_files": [{"path": p, "source": s, "description": d}
                               for p, s, d in SOURCE_FILES]}
    with open(INDEX_PATH, "w") as f:
        json.dump(index, f)
    print(f"\nIndex: {INDEX_PATH}  ({N} chunks)")
    return index


def search(index, query, top_k=8):
    idf = index["idf"]
    query_words = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}", query.lower())
    query_compounds = re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+", query.lower())
    camel = re.findall(r"[a-z][a-zA-Z0-9]+[A-Z][a-zA-Z0-9]+", query)
    query_compounds += [c.lower() for c in camel]
    scores = []
    for chunk in index["chunks"]:
        text_lower = chunk["text"].lower()
        score = sum(chunk["tf"].get(w, 0) * idf.get(w, 0) for w in query_words)
        for c in query_compounds:
            if c in text_lower:
                score += 20.0 * text_lower.count(c)
            for pat in [f"{c}:", f'"{c}"', f"'{c}'"]:
                if pat in text_lower:
                    score += 30.0
        desc_lower = chunk.get("description", "").lower()
        for c in query_compounds:
            if c in desc_lower:
                score += 5.0
        scores.append((score, chunk))
    scores.sort(key=lambda x: -x[0])
    results = [c for s, c in scores[:top_k] if s > 0]
    if not results:
        for c in query_compounds:
            for chunk in index["chunks"]:
                if c in chunk["text"].lower():
                    results.append(chunk)
        results = results[:top_k]
    return results


def load_or_build():
    if os.path.exists(INDEX_PATH):
        with open(INDEX_PATH) as f:
            return json.load(f)
    return build_index()


if __name__ == "__main__":
    build_index()
