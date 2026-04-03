# Worth AI UK Screening — Complete End-to-End Lineage

> **The full story of how a UK business is verified: Trulioo KYB, watchlists, sanctions, PEPs, adverse media, PSC/UBO screening, and how every result flows from the Trulioo API to the UI and the 360 Report.**  
> Verified against `integration-service/lib/trulioo/**`, `lib/facts/kyb/`, and `handlers/report.ts`.

---

## Why a Separate Document for UK?

Worth AI uses **Middesk** for US business verification (Secretary of State lookups) and **Trulioo** for UK, Canada, and other international businesses. The two systems are architecturally parallel but technically distinct. UK businesses go through a completely different verification flow with different data sources, different watchlist providers, and an automatic PSC (Person of Significant Control) screening that does not exist in the standard US flow.

---

## Section 1 — When Does Trulioo Run? (UK vs. US Routing)

The `canIRun()` function in `truliooBusiness.ts` decides whether Trulioo runs for a given business:

```typescript
// Three conditions must ALL be true:
1. data_integration_settings.trulioo.status === "ENABLED"
2. The business country is in the customer's enabled countries list
   → Fetched via GET /customers/{id}/onboarding-setups/7/countries
   → INTERNATIONAL_BUSINESS_SETUP_ID = 7
3. GB/UK normalisation: both "GB" and "UK" are treated as the same country
```

**If Trulioo runs → Middesk does NOT run for that business.**

| KYB provider | Business type | What it queries |
|---|---|---|
| **Middesk** (platform 16) | US businesses (all 50 states + DC + territories) | Secretary of State API (live, per business) |
| **Trulioo** (platform 38) | UK, Canada, and other enabled international countries | Companies House (UK), corporate registries (Canada), + global watchlists |

For UK businesses, PSC screening is **automatic** — no additional toggle needed. For US businesses, PSC requires the "Advanced Watchlists" toggle to be enabled separately.

---

## Section 2 — Trulioo Authentication & Configuration

### OAuth 2.0 Client Credentials Flow

```http
POST https://api.globaldatacompany.com/oauth2/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={TRULIOO_CLIENT_ID}
&client_secret={TRULIOO_CLIENT_SECRET}
```

**Environment variables:**
```bash
TRULIOO_API_URL=https://api.globaldatacompany.com
TRULIOO_CLIENT_ID=your_client_id
TRULIOO_CLIENT_SECRET=your_client_secret
TRULIOO_KYB_FLOWID=kyb-flow           # Business KYB flow ID
TRULIOO_PSC_FLOWID=psc-screening-flow  # Person PSC screening flow ID
TRULIOO_HTTP_TIMEOUT=30000             # 30 seconds
```

Tokens are cached and auto-refreshed before expiry.

---

## Section 3 — KYB Request Payload for UK Businesses

Trulioo uses a **dynamic flow architecture**: Worth AI first fetches the field structure, then maps business data to it.

### Step 1: Initialize Flow
```http
POST /flows/{TRULIOO_KYB_FLOWID}/init
Authorization: Bearer {token}

Response: { "elements": [
  { "id": "elem_001", "role": "company_name" },
  { "id": "elem_002", "role": "company_regno" },    ← Companies House number
  { "id": "elem_003", "role": "company_country_incorporation" },
  { "id": "elem_004", "role": "company_state_address" },
  { "id": "elem_005", "role": "company_zip" }         ← UK postcode
], "hfSession": "session-uuid-abc123" }
```

### Step 2: Submit Business Data (`TruliooKYBFormData`)

```typescript
// For "Acme Limited, 123 Baker Street, London, W1U 6RG"

// Stored internally — full address WITH suite number:
businessPayload = {
  companyName:                "Acme Limited",
  companyCountryIncorporation: "GB",
  companyStateAddress:         "England",
  companyCity:                 "London",
  companyZip:                  "W1U 6RG",
  companyregno:                "12345678",     // UK Companies House number
  companyAddressFull:          "123 Baker Street, Suite 2, London"  // full
}

// Sent to Trulioo — street ONLY (no suite):
truliooPayload = {
  ...businessPayload,
  companyAddressFull: "123 Baker Street"  // street only → green Address Line 1
}
```

> **Why the address split?** Trulioo's Comprehensive View compares the submitted address against Companies House data. Including a suite/apartment number often causes a false "nomatch" on Address Line 1 because Companies House stores only the street. Worth AI intentionally strips the suite before sending so the registry street name matches correctly.

---

## Section 4 — Trulioo KYB Response Structure

```json
{
  "hfSession": "session-uuid-abc123",
  "clientData": {
    "status": "completed",
    "businessData": {
      "name": "Acme Limited",
      "country": "GB",
      "business_addresses": [{ "is_primary": true, "addressLine1": "123 Baker Street", "postalCode": "W1U 6RG" }],
      "ubos": [{ "fullName": "John Smith", "ownershipPercentage": 75, "title": "Director" }],
      "directors": [{ "fullName": "Jane Doe", "title": "Secretary" }]
    },
    "watchlistResults": [...],
    "flowData": {
      "kyb-flow-id": {
        "serviceData": [{
          "nodeType": "trulioo_business_wl",
          "fullServiceDetails": {
            "Record": {
              "DatasourceResults": [
                {
                  "DatasourceName": "Comprehensive View",
                  "DatasourceFields": [
                    { "FieldName": "BusinessName",       "Status": "match" },
                    { "FieldName": "AddressLine1",        "Status": "match" },
                    { "FieldName": "PostalCode",          "Status": "match" },
                    { "FieldName": "BusinessRegistrationNumber", "Status": "match" }
                  ]
                },
                {
                  "DatasourceName": "Advanced Business Watchlist",
                  "AppendedFields": [{
                    "FieldName": "WatchlistHitDetails",
                    "Data": {
                      "WL_results":  [...],   // Sanctions hits
                      "AM_results":  [...],   // Adverse Media hits
                      "PEP_results": [...]    // PEP hits
                    }
                  }]
                }
              ]
            }
          }
        }]
      }
    }
  }
}
```

### Comprehensive View — Address Verification for UK

Worth AI **only** uses the "Comprehensive View" datasource for address match/no-match decisions. Individual datasources (Business Insights, Business Essentials) are ignored — they sometimes report false "nomatch" results due to incomplete UK data.

| DatasourceField Status | Meaning |
|---|---|
| `"match"` | Field confirmed by Comprehensive View (Companies House, D&B UK, etc.) |
| `"missing"` | Field not in Trulioo's data — NOT a mismatch |
| `"nomatch"` | Field explicitly contradicts submitted value |

**Rule:** If ANY address field (`AddressLine1`, `PostalCode`, `City`) returns `"nomatch"` → overall status = **No Match** → red badge in UI.  
If all are `"match"` or `"missing"` → overall status = **Verified** → green badge.

---

## Section 5 — Watchlists & Sanctions: UK-Specific Sources

Trulioo screens against the **"Advanced Business Watchlist"** — a single consolidated datasource checking hundreds of global lists simultaneously. Results return in three buckets:

- `WL_results` — Watchlist / Sanctions hits
- `AM_results` — Adverse Media hits
- `PEP_results` — Politically Exposed Persons hits

### UK-Specific Watchlists (verified from source code and test fixtures)

| List name | List type | Agency | Description |
|---|---|---|---|
| Register of Insolvencies | SANCTIONS | Accountant in Bankruptcy | Scottish insolvency register (AIB Scotland) |
| Employment Tribunal Decisions | SANCTIONS | Employment Tribunal | UK ET adverse rulings |
| Companies House Disqualified Directors | SANCTIONS | Companies House UK | Directors barred from directorships |
| Insolvency Register | SANCTIONS | Insolvency Service UK | England & Wales insolvency (bankruptcies, IVAs, DROs) |
| UK Financial Sanctions | SANCTIONS | OFSI (HM Treasury) | UK equivalent of OFAC SDN — post-Brexit UK list |
| PEP Database | PEP | Various | UK-specific: MPs, Lords, civil servants, local officials |
| Adverse Media | ADVERSE_MEDIA | Trulioo (aggregated) | UK sources: BBC, Guardian, FT, Reuters, etc. |

### Global Lists Also Applied to UK Businesses

| Agency | Lists |
|---|---|
| OFAC | SDN, SSI, Non-SDN CMIC, Non-SDN Iranian, CAPTA, Non-SDN Palestine LC |
| BIS | Entity List, Denied Persons List, Unverified List |
| EU EEAS | EU Consolidated Sanctions |
| UN Security Council | UN Consolidated List |

---

## Section 6 — Watchlist Extraction: Priority 1 vs. Priority 2

`extractWatchlistResultsFromTruliooResponse()` uses a two-priority strategy:

### Priority 1 — Detailed from `fullServiceDetails` (preferred)

Real UK example from test fixtures:

```json
"WL_results": [
  {
    "score": 1,
    "subjectMatched": "Jacqueline Martin",
    "sourceListType": "Register of Insolvencies",
    "sourceRegion": "Europe",
    "sourceAgencyName": "Accountant in Bankruptcy",
    "URL": "https://example.com/hit1"
  },
  {
    "score": 0.98,
    "subjectMatched": "Martin Jacqueline",
    "sourceListType": "Employment Tribunal Decisions",
    "sourceRegion": "Europe",
    "sourceAgencyName": "Employment Tribunal",
    "URL": "https://example.com/hit2"
  }
]
```

`createWatchlistHit()` transforms this to:
```typescript
{
  listType: "SANCTIONS",
  listName: "Register of Insolvencies",
  confidence: 1.0,          // ← THE SCORE FIELD (0.0–1.0)
  matchDetails: "Jacqueline Martin",
  url: "https://example.com/hit1",
  sourceAgencyName: "Accountant in Bankruptcy",
  sourceRegion: "Europe"
}
```

### Priority 2 — Summary Format Fallback

When `fullServiceDetails` is absent, only aggregate counts are available:

```json
"watchlistResults": {
  "Advanced Watchlist": {
    "watchlistStatus": "Potential Hit",
    "watchlistHitDetails": {
      "wlHitsNumber": 138,   // count of sanctions hits
      "amHitsNumber": 12,    // count of adverse media hits
      "pepHitsNumber": 3,    // count of PEP hits
      "confidence": 0.85
    }
  }
}
```

This creates **placeholder entries** — no entity names, no URLs, no sourceAgencyName. Only counts.

---

## Section 7 — Score / Confidence / Relevancy Fields

There are two distinct score concepts in the UK pipeline:

### 1. Watchlist Hit Score (`hit.score`, captured as `TruliooWatchlistHit.confidence`)

| Aspect | Detail |
|---|---|
| What it is | Trulioo's relevancy score for how well the entity name matches the watchlist entry. 1.0 = exact. 0.85 = close fuzzy. |
| Where it comes from | `fullServiceDetails.WatchlistHitDetails.WL_results[].score` (or `AM_results`, `PEP_results`) |
| Stored in DB? | Raw value in `request_response.response` JSONB. NOT copied to `WatchlistValueMetadatum`. |
| Surfaced in API? | **NO** — this is a confirmed gap. The `watchlist` fact schema has `score: z.number().optional()` but it is never populated from Trulioo's score. |
| Impact | Score 1.0 (exact match) looks identical to score 0.3 (fuzzy match) to analysts. |

### 2. Trulioo Source Confidence (entity match quality for KYB facts)

| Aspect | Detail |
|---|---|
| What it is | How confident Worth AI is that Trulioo found the right business entity (for NAICS, address, firmographics). |
| Primary method | XGBoost entity-matching model: `confidenceScore({ business, integration_business })` |
| Fallback (no XGBoost) | Heuristic: completed → 0.7, pending → 0.4, failed → 0.2 + bonuses for data completeness |
| Stored in DB | `integration_data.request_response.confidence` column |
| Surfaced in API? | **YES** — `GET /facts/business/{id}/details` returns `source.confidence` |

> **Known gap:** The per-hit watchlist relevancy score (0.0–1.0) is lost between `TruliooWatchlistHit.confidence` (which has it) and `WatchlistValueMetadatum` (which has no confidence field). Fix requires: add `score?: number` to `WatchlistValueMetadatum`, copy in `mapWatchlistHits()`.

---

## Section 8 — PEP Screening: UK-Specific

### What Is a UK PEP?

Under UK AML regulations (JMLSG guidance, Money Laundering Regulations 2017), a PEP includes:
- Current or former senior politicians (MPs, Lords, Devolved Assembly Members)
- Government ministers and senior civil servants
- Senior judicial officers (High Court judges and above)
- Ambassadors and high commissioners
- Senior executives of state-owned enterprises
- Immediate family members and known close associates of any of the above

Worth AI screens for PEPs for **both** the business entity (KYB) and each UBO/Director (PSC). PEP hits appear in `PEP_results[]` within `WatchlistHitDetails`.

### Real UK PEP Hit Example

```json
"PEP_results": [
  {
    "score": 1,
    "subjectMatched": "Jane Smith",
    "sourceListType": "PEP Database",
    "sourceRegion": "Europe"
  }
]
```

Transforms to:
```typescript
{ listType: "PEP", listName: "PEP Database", confidence: 1.0, matchDetails: "Jane Smith" }
```

---

## Section 9 — Adverse Media: UK Flow

### Two Sources of Adverse Media

| Source | Platform | Trigger | Output |
|---|---|---|---|
| Trulioo KYB `AM_results` | 38 | Automatic during KYB | News URLs from Trulioo's adverse media databases |
| SERP Adverse Media | 22 | If SERP enabled for customer | Google Search results for fraud/scam/lawsuit queries |

### Trulioo Adverse Media Processing Pipeline

```
Trulioo AM_results[] → extractWatchlistResultsFromTruliooResponse()
→ processAndPersistTruliooAdverseMedia():
    For each AM hit:
      1. Extract title from URL slug (if listName is generic "Adverse Media"):
         extractTitleFromUrl("https://bbc.co.uk/news/acme-ltd-fraud-case")
         → "Acme ltd fraud case"
      2. scoreAdverseMedia(title, entityNames) via OpenAI:
         → keywordsScore, negativeSentimentScore, entityFocusScore
         → finalScore (0–1), riskLevel ("LOW"/"MEDIUM"/"HIGH"), description
      3. Deduplicate by (link, mediaType)
      4. insertAdverseMedia() →
           adverse_media table (total/high/medium/low risk counts)
           adverse_media_articles table (per article with all scores)
```

### adverse_media_articles — What Is Stored

```json
{
  "business_id": "<uuid>",
  "title": "Acme Ltd fraud investigation",
  "link": "https://bbc.co.uk/news/...",
  "source": "bbc.co.uk",
  "keywords_score": 0.92,
  "negative_sentiment_score": 0.88,
  "entity_focus_score": 0.95,
  "final_score": 0.91,
  "risk_level": "HIGH",
  "risk_description": "Article mentions specific fraud allegation against entity",
  "media_type": "business"
}
```

---

## Section 10 — PSC (Person of Significant Control) — Automatic UK Flow

### When PSC Triggers for UK

`shouldScreenPSCsForBusiness()` in `pscScreeningHelpers.ts`:

```typescript
// For UK (GB) business:
const isUS = false  // GB is not US

// Check: is Trulioo (International KYB) enabled?
const internationalKYBEnabled = true  // checked from data_integration_settings

// Non-US + International KYB enabled → PSC is AUTOMATIC:
return { shouldScreen: true, reason: "Non-US business with International KYB enabled" }
```

### Who Gets Screened?

`extractPersonsFromBusinessData()` gathers persons from three sources:

1. **Trulioo `businessData.ubos[]`** — Persons with Significant Control from Companies House
2. **Trulioo `businessData.directors[]`** — Directors from Companies House filing
3. **Applicant-submitted owners** — from `data_owners` (case-service)

Deduplication: `deduplicatePersons()` by full name (case-insensitive).

### PSC Atomic Lock

```sql
-- Only ONE process triggers PSC screening per person (prevents race condition):
INSERT INTO integration_data.business_entity_people
  (business_entity_verification_id, name, submitted, source, titles)
VALUES (...)
ON CONFLICT (business_entity_verification_id, name) DO IGNORE

-- If insert succeeds → this process screens the person
-- If conflict → person already being screened → skip
```

### PSC Watchlist Hits Storage

```typescript
// PSC (person) hits stored with entity_type = "person":
WatchlistValueMetadatum {
  id: "<uuid>",
  type: "pep",            // or "sanctions" | "adverse_media"
  entity_type: "person",  // ← distinguishes from KYB business hits
  metadata: {
    entity_name: "John Smith",
    title: "PEP Database",
    agency: "Politically Exposed Persons"
  }
}
```

---

## Section 11 — SERP: UK Behavior

SERP runs for UK businesses when enabled for the customer. It is NOT country-specific — it runs based on customer integration settings.

| Feature | Runs for UK? | Notes |
|---|---|---|
| Google SERP scraping | Yes (if enabled) | Searches "[business name] [city]" for contact info |
| Google Business Profile (platform 39) | Yes | Fetches UK Google Maps listing |
| Worth Website Scanning (platform 30) | Yes | Domain age, SSL, malware — works for .co.uk |
| Address: Google Profile Verified | Yes | Matches UK postcode against Google Maps address |

---

## Section 12 — All Storage Tables for UK Screening

| Table | Schema | What is stored |
|---|---|---|
| `request_response` | `integration_data` | Full raw Trulioo response + confidence score per call |
| `business_entity_verification` | `integration_data` | KYB result: name, status, incorporation_date, entity_type |
| `business_entity_address_source` | `integration_data` | All addresses: submitted=true/false, deliverable |
| `business_entity_names` | `integration_data` | Submitted and reported names |
| `business_entity_review_task` | `integration_data` | Review tasks: watchlist, tin, name, address_verification |
| `business_entity_people` | `integration_data` | UBOs/Directors from PSC screening + results |
| `adverse_media` | `rds_cases_public` | Adverse media aggregate counts |
| `adverse_media_articles` | `rds_cases_public` | OpenAI-scored articles with risk levels |
| `facts` | `rds_warehouse_public` | Computed watchlist, adverse_media_hits, address_verification facts |

---

## Section 13 — Fact Engine Transformation

### watchlist_raw Fact
Sources checked in order:
1. Trulioo `clientData.watchlistResults` (pre-processed array)
2. `extractWatchlistResultsFromTruliooResponse()` → Priority 1 from `fullServiceDetails`
3. `business_entity_review_task` with `key="watchlist"`

### watchlist (Consolidated) Fact
`calculateConsolidatedWatchlist()` merges:
- `watchlist_raw` (business KYB hits, `entity_type="business"`)
- `screened_people` (PSC hits per person, `entity_type="person"`)

Deduplication: `createWatchlistDedupKey(hit)` = `title + "::" + agency + "::" + entity_name`

### Fact Schema (JSONB)
```json
{
  "metadata": [
    {
      "id": "<uuid>",
      "type": "sanctions",
      "entity_type": "business",
      "metadata": {
        "abbr": "AiB",
        "title": "Register of Insolvencies",
        "agency": "Accountant in Bankruptcy",
        "entity_name": "Acme Limited"
      },
      "url": "https://www.aib.gov.uk/...",
      "list_country": "Europe",
      "score": null   ← NOTE: NOT populated (known gap)
    }
  ],
  "message": "Found 1 watchlist hit(s)"
}
```

---

## Section 14 — API Responses: Where UK Screening Data Is Surfaced

| Endpoint | What is returned |
|---|---|
| `GET /facts/business/{id}/details` | `watchlist` fact, `watchlist_hits` count, `adverse_media_hits` count, `source.confidence` for Trulioo |
| `GET /facts/business/{id}/all` (admin) | All 217 facts including `watchlist_raw`, `screened_people`, `adverse_media_hits` |
| `GET /facts/business/{id}/kyb` | watchlist and related facts as part of KYB set |
| 360 Report (Kafka: FETCH_REPORT_DATA) | `watchlist_hits`, `watchlist_hits_count`, `people_watchlist` (per person), `watchlist_entries` |
| Admin UI — KYB Watchlists tab | Reads from `watchlist` fact; groups by entity_type (business/person) |

### 360 Report Watchlist Assembly (`_getWatchlistData()`)

```typescript
const hits = watchlist?.value?.metadata ?? []   // all consolidated hits

// Groups hits by business name / person name:
const watchlistEntries = createWatchlistEntries(watchlist, names_submitted, people, legal_name)

// Groups hits by entity name for people_watchlist:
const groupedHitsByEntity = groupWatchlistHitsByEntityName(hits)

return {
  watchlist_hits: hits.length > 0 ? hits : null,
  watchlist_hits_count: watchlistHitsCount,
  people_watchlist: [{ name: "John Smith", watchlist_results: [...] }],
  watchlist_entries: [{ entity: "Acme Ltd", hits: [...] }]
}
```

---

## Section 15 — Consistency Guarantees & Known Gaps

### Consistency Mechanisms

| Mechanism | What it protects |
|---|---|
| Single source of truth: `watchlist` fact | All API endpoints and 360 Report read from the same computed fact |
| `createWatchlistDedupKey()` | Business + PSC hits not double-counted |
| Upsert on `facts` table | Score recalculations don't create duplicate facts |
| Atomic lock in `business_entity_people` | PSC not triggered twice for same person |
| Comprehensive View as single arbiter | Address match result consistent across UI tabs and API |

### Known Gaps

| Gap | Impact | Fix |
|---|---|---|
| Watchlist hit score (0.0–1.0) NOT surfaced in API | Analysts cannot see match relevancy — 0.3 looks same as 1.0 | Add `score` to `WatchlistValueMetadatum`; copy in `mapWatchlistHits()` |
| UK SIC codes NOT surfaced | UK companies' `gb_sic-XXXXX` codes captured in `classification_codes` fact but never exposed | Add Kafka handler + new API endpoint |
| Adverse media count inconsistency | Trulioo raw AM count ≠ OpenAI-scored count | Document clearly; use scored count as primary |
| Priority 2 hits lack entity detail | Summary format hits have no name, URL, or agency | Try to ensure Trulioo always returns `fullServiceDetails` |

---

## Section 16 — Full End-to-End Timeline

```
T+0:00  UK Business submits (country=GB)
  data_businesses.address_country = "GB"
  canIRun(): GB in enabled countries + Trulioo enabled → true
       ↓
T+0:02  OAuth token acquired from Trulioo
       ↓
T+0:03  KYB Flow init → hfSession received
       ↓
T+0:04  KYB payload submitted (street-only address)
  companyName="Acme Limited", companyCountryIncorporation="GB",
  companyZip="W1U 6RG", companyregno="12345678",
  companyAddressFull="123 Baker Street"  ← street only, no suite
       ↓
T+0:15  Trulioo KYB response received:
  status="completed"
  Comprehensive View: BusinessName=match, AddressLine1=match, PostalCode=match
  Advanced Business Watchlist → WatchlistHitDetails:
    WL_results: [{ score:1.0, subjectMatched:"Acme Ltd", sourceListType:"Register of Insolvencies" }]
    AM_results: [{ score:0.95, URL:"https://bbc.co.uk/..." }]
       ↓
T+0:16  storeBusinessVerificationResults():
  1. request_response → FULL raw Trulioo response
  2. business_entity_verification → name, status, entity_type
  3. business_entity_address_source → submitted + reported addresses
  4. business_entity_review_task key="address_verification" → "success"
  5. business_entity_names → "Acme Limited" (submitted + reported)
  6. storeBusinessWatchlistResults() → business_entity_review_task key="watchlist"
  7. processAndPersistTruliooAdverseMedia() → OpenAI scoring → adverse_media_articles
       ↓
T+0:17  PSC Screening (AUTOMATIC for UK):
  shouldScreenPSCsForBusiness("GB") → true
  Persons: John Smith (UBO, 75%) + Jane Doe (Director) from businessData
  For each person: atomic lock INSERT → screenPersonWithPSCFlow()
  Results: business_entity_people.screening_results
       ↓
T+0:25  Kafka: facts.v1 CALCULATE_BUSINESS_FACTS
  Fact Engine:
    watchlist_raw → from business_entity_review_task
    screened_people → from business_entity_people
    watchlist (consolidated) → merge + dedup → 1 SANCTIONS hit
    adverse_media_hits → 1 (from adverse_media_articles)
    address_verification_boolean → true
       ↓
T+0:30  Customer API ready:
  GET /facts/business/{id}/details:
    watchlist.metadata: [SANCTIONS hit "Register of Insolvencies"]
    watchlist_hits: 1
    adverse_media_hits: 1
    source.confidence: 0.85 (Trulioo entity match quality)
    
  NOTE: Watchlist hit score (1.0) NOT in this response (known gap)
       ↓
T+varies  360 Report generated:
  _getWatchlistData() → createWatchlistEntries() → groupWatchlistHitsByEntityName()
  Report shows: "Acme Limited: 1 SANCTIONS hit (Register of Insolvencies, Accountant in Bankruptcy)"
  John Smith: No PSC hits (clean screening)
```

---

*Document verified against: `integration-service/lib/trulioo/**` (all 24 TypeScript files), `lib/facts/kyb/index.ts`, `lib/trulioo/common/utils.ts`, `truliooAdverseMediaProcessor.ts`, `pscScreeningHelpers.ts`, `handlers/report.ts`, test fixtures: `extractWatchlistResults.test.ts`.*
