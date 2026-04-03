# Worth AI Admin Portal — Complete Data Lineage Reference

> **Every field, badge, status, tab, and score: where it comes from, which table stores it, which model computes it, which API surfaces it.**  
> Verified against `case-service`, `integration-service`, and `manual-score-service` source code.  
> Cross-referenced against the April 2, 2026 team training session transcript.

---

## Why This Document Exists

When an analyst looks at the Worth AI admin portal (`admin.joinworth.com`) and sees a field like "NAICS Code: 812113 — Nail Salons", a confidence score of 0.95, a green "Verified" badge, or a Worth Score of 819/850, there is no indication in the UI of *where that came from*. Is it from Middesk? ZoomInfo? The XGBoost model? A manual override? A crosswalk table? This document answers that question for every visible element.

---

## The Three Portals

| Portal | URL | Who uses it | What makes it different |
|---|---|---|---|
| **Admin Portal** | `admin.joinworth.com` | Internal Worth AI staff only | Sees all 249 customers, all cases, source names (e.g. "Middesk"), platform IDs, alternatives, confidence per source. Network tab exposes raw API response JSON. |
| **Customer Portal** | `customer.joinworth.com` | Bank/lender/fintech customers | Dashboard with portfolio overview, auto-decisioning rules (pass/fail), case tables. Does NOT show source vendor names — only platform IDs. |
| **Developer/Postman** | REST API | Engineers and analysts | Full facts JSON: `source.confidence`, `source.platformId`, `alternatives[]`, `override`. More data than the UI shows. |

> **Key insight from training (Allison, 00:02:06):** Customers see the platform ID but *not* the vendor name. Internal admin staff see both. The UI is built on the same externalized APIs customers use (confirmed by Mats, 00:26:16) — so whatever appears in admin is available to customers programmatically.

> **How to inspect:** Open Chrome DevTools → Network tab → refresh the page → find the API call → inspect the JSON response. Faster: use Postman. (Allison, 00:03:03)

---

## The Three Primary Identifiers

Every record in Worth AI is uniquely identified by three UUIDs that form a hierarchy:

```
Customer ID  →  Case ID  →  Business ID
```

| ID | Table | Primary use | Daily usage |
|---|---|---|---|
| **Customer ID** | `data_customers.id` | The bank/lender/fintech using Worth AI. Appears in the URL: `admin.joinworth.com/customers/{customer_id}` | Navigate to a customer's cases |
| **Case ID** | `data_cases.id` | Point-in-time snapshot of an onboarding or risk monitoring run. Auditability, traceability, compliance. | Rarely — only to distinguish risk vs. onboarding case for same business |
| **Business ID** | `data_businesses.id` | The merchant/SMB being verified. Stable across all cases. | Primary ID for all analysis. Direct URL: `admin.joinworth.com/{business_id}` |

> **Raj (00:33:18):** Case ID is essential for regulatory compliance. HSBC was fined $1B and forced to sell branches for not having proper case management and auditability. TD Bank had a similar scenario recently.

> **Craig (00:14:57):** "We can use SQL and literally produce a link — all we got to do is insert that customer ID."

---

## Sandbox vs. Production: What Is Real Data?

The "Account Type" badge on every customer entry (Sandbox/Production) controls which vendor endpoints are called. **This is a per-customer setting, not per-case.**

| Integration | Sandbox customer: API called | Redshift data affected? | No sandbox available? |
|---|---|---|---|
| Equifax | Equifax SANDBOX API | No — same Redshift pre-load | Has sandbox |
| Plaid (banking) | Plaid SANDBOX environment | No | Has sandbox |
| Plaid IDV | Plaid IDV SANDBOX | No | Has sandbox |
| GIACT gVerify/gAuthenticate | GIACT SANDBOX API | No | Has sandbox |
| KYX | KYX SANDBOX endpoints | No | Has sandbox |
| Middesk (KYB) | **SAME production Middesk API** | No | **No sandbox — always production** |
| OpenCorporates | Same Redshift query (no external API) | **Yes — same data as production** | N/A |
| ZoomInfo | Same Redshift query (no external API) | **Yes — same data as production** | N/A |
| **VerData (BYL data)** | **PRODUCTION VerData API** | No | **CONFIRMED: No sandbox (transcript 00:08:02)** |
| **SERP (web scraping)** | **PRODUCTION SERP** | No | **CONFIRMED: No sandbox (transcript 00:08:02)** |
| AI (GPT-5-mini) | Same OpenAI API | No | N/A |

> **Critical implication:** For sandbox customers, OC and ZoomInfo data **will match** the Redshift warehouse (same tables). Equifax and Plaid data **will not match** (sandbox returns test data). VerData BYL data (bankruptcies, judgments, liens) **is always real production data** even for sandbox customers.

---

## Customers List Page

**Path:** `admin.joinworth.com/customers`

| Column | Source table / field | Notes |
|---|---|---|
| Customer ID | `data_customers.id` | UUID, truncated in UI. Matches warehouse. |
| Business Name | `data_businesses.name` (via case) | The merchant's submitted name |
| Account Type | `data_customers.customer_type` | "SANDBOX" or "PRODUCTION". Set at tenant provisioning. |
| Onboarding Date | `data_cases.created_at` | Case creation timestamp (UTC) |
| Customer Owner | `data_users` linked to customer | Worth AI internal user responsible for this account |
| Status | `data_cases.status_id → CASE_STATUS` | Active (6=AUTO_APPROVED), Invited (1), etc. |

---

## Customer Detail Page — Tabs: Overview, Cases, Businesses, Users

### Overview Tab
Shows the customer's account type, status, account owner, and the **April Onboarding Count** (donut chart).

- Onboarding Count source: `onboarding_schema.data_customer_onboarding_limits.current_count`
- Reset monthly by cron job: `monthly-onboarding-limit-reset`
- "No monthly limit set" = no cap configured for this customer

### Cases Tab
One row per `data_cases` record linked to this customer. Key fields:

| Column | Source |
|---|---|
| Case # | `data_cases.id` |
| Type | `data_cases.case_type_id` → ONBOARDING (1), RISK (3) |
| Status | `data_cases.status_id` → 20 possible statuses |
| Integrations | Derived: all `business_integration_tasks` completed/failed? |

> **Standalone Cases tab:** This tab should be deprecated. It contains old data from when Worth AI targeted SMBs directly. The company now focuses on enterprise customers. Any cases there are QA test data only. (Allison, 00:12:03)

---

## What Is a Case?

A **case** is a point-in-time snapshot of all verifications run for a business at a specific moment. It is NOT a live, continuously updating record — it freezes the state at the time it was triggered.

**What creates a new case for the same business?**
1. Worth Score manual refresh (by analyst or by the business owner)
2. Risk monitoring runs and detects a score change
3. A new customer invites the same business

**Case types (from `case-type.constant.ts`):**
- `ONBOARDING (1)` — standard new business application
- `APPLICATION_EDIT (2)` — business updated their application
- `RISK (3)` — ongoing risk monitoring triggered a re-evaluation

> **Important nuance (Craig, 00:35:48):** Score refresh creates a new case but does NOT necessarily re-run all vendor integrations. Some facts may carry over from previous runs.

---

## All 20 Case Statuses

| Status | ID | Set by | Automatic? |
|---|---|---|---|
| CREATED | 20 | case-service API | Yes — on submission |
| SUBMITTED | 12 | case-service API | Yes — on form submit |
| ONBOARDING | 3 | case-service API | Yes |
| SCORE_CALCULATED | 7 | manual-score-service | Yes |
| PENDING_DECISION | 10 | manual-score-service | Yes — interim state |
| **AUTO_APPROVED** | **6** | **manual-score-service** | **Yes — score ≥ threshold** |
| **AUTO_REJECTED** | **13** | **manual-score-service** | **Yes — score ≤ threshold** |
| **UNDER_MANUAL_REVIEW** | **4** | manual-score-service OR analyst | Both |
| INFORMATION_REQUESTED | 11 | Analyst | No |
| INFORMATION_UPDATED | 19 | case-service API | Yes |
| **MANUALLY_APPROVED** | **5** | Analyst | No |
| **MANUALLY_REJECTED** | **8** | Analyst | No |
| **ARCHIVED** | **9** | Analyst or automated policy | Both |
| RISK_ALERT | 14 | integration-service (risk monitoring) | Yes |
| INVESTIGATING | 15 | Analyst | No |
| ESCALATED | 17 | Analyst | No |
| PAUSED | 18 | Analyst | No |
| DISMISSED | 16 | Analyst | No |
| INVITED | 1 | Deprecated | — |
| INVITE_EXPIRED | 2 | Deprecated | — |

Auto-Approved vs Manual Review is controlled by `score_decision_matrix` — a per-customer table that defines the score thresholds for each decision outcome.

---

## Worth Score — How 819/850 Is Computed

The Worth Score is **not** the XGBoost entity-matching model. It is a separate weighted multi-factor scoring system in `manual-score-service`.

### Scoring Pipeline

```
Business submits → All integrations run → Each completion fires Kafka UPDATE_INTEGRATION_DATA_FOR_SCORE
→ manual-score-service checks: are all required integrations done?
→ If yes: fires Kafka GENERATE_AI_SCORE
→ calculateBankingScore() + calculatePublicRecordsScore() + calculateFinancialScore()
→ Sum all weighted_score_100 → scale to 850
→ score_decision_matrix lookup: Low Risk / Medium Risk / High Risk + decision
→ UPDATE data_cases SET status_id = AUTO_APPROVED | AUTO_REJECTED | UNDER_MANUAL_REVIEW
```

### Score Categories and Data Sources

| Category | Integration | Platform IDs | What is measured |
|---|---|---|---|
| Banking | Plaid bank connection | 1 (Plaid), 34 (Manual Banking) | Avg daily balance, NSF count, overdraft frequency, deposit volume |
| Public Records | Middesk, Trulioo, NPI, Adverse Media | 16, 38, 27, 28 | SOS registration, watchlist hits, adverse media, NPI validity, business age |
| Financial Strength | Rutter (QuickBooks, Xero, etc.), Tax Status | 5-13, 15 | Revenue trends, gross profit, accounts receivable, tax compliance |

### Score Database Tables

| Table | Purpose |
|---|---|
| `business_scores` | Final score per trigger: `weighted_score_850`, `risk_level`, `score_decision` |
| `business_score_factors` | Per-factor breakdown: category, factor code, value, `score_100`, `weighted_score_850` |
| `score_decision_matrix` | Per-customer thresholds: score range → risk_level + decision |
| `score_config_history` | Version history of score weightage configs ("Model 3.0" reference) |
| `data_current_scores` | Latest score per (business_id, customer_id) — what the UI reads |
| `score_inputs` | Raw data snapshot fed into the model (for audit) |

```sql
-- Current score for a business:
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.status
FROM data_current_scores dcs
JOIN business_scores bs ON bs.id = dcs.score_id
WHERE dcs.business_id = '<uuid>' AND dcs.customer_id = '<uuid>';

-- Per-factor breakdown:
SELECT sc.code AS category, scf.code AS factor,
       bsf.value, bsf.score_100, bsf.weighted_score_850
FROM business_score_factors bsf
JOIN score_category_factors scf ON scf.id = bsf.factor_id
JOIN score_categories sc ON sc.id = bsf.category_id
WHERE bsf.score_id = '<score_uuid>';
```

---

## KYB Tab — Know Your Business

### Confidence Is Per-Source, Not Per-Address

> **Confirmed in training (Wecsley + Allison, 00:25:08):** "I think it's per source. You have a confidence per source at the end. You have the winning source." — "We put the winner at the top and then anything in alternatives is what didn't make the cut."

The Fact Engine computes **one confidence score per vendor source** (not per individual address or name variant). Middesk may return 10 different reported addresses — they all share the single Middesk source confidence. The winning source's data appears at the top of the UI; all alternatives (from other sources) appear below.

### Confidence Computation by Source

| Source | Platform ID | How confidence is computed |
|---|---|---|
| OpenCorporates | 23 | XGBoost entity-matching: `oc_probability` from `ml_model_matches` |
| Middesk | 16 | XGBoost `confidenceScoreMany()` OR 0.15 + 0.20 per passing KYB task |
| ZoomInfo | 24 | XGBoost `zi_probability` OR `similarity_index/55` fallback |
| Equifax | 17 | XGBoost `efx_probability` OR `similarity_index/55` fallback |
| Trulioo | 38 | Heuristic ONLY: `match.index / MAX_CONFIDENCE_INDEX (55)` |
| AI (GPT-5-mini) | 31 | Self-reported: HIGH→0.70 / MED→0.50 / LOW→0.30 |

> **Weight ranking (from `rules.ts`):**  
> Middesk (2.0) > OC (0.9) > ZoomInfo (0.8) = Trulioo (0.8) > Equifax (0.7) > AI (0.1)

> **"Fancy rigging" context (Allison, 00:25:08):** "We did some fancy rigging at one point to sort Middesk above Open Corporates just given…weighting." This is the `SOURCE_WEIGHTS` constant — not manual overriding, but calibrated weights that reflect Middesk's higher reliability (it directly queries Secretary of State filings).

### KYB Background — Every Field Lineage

| Field | Fact name | Winner priority | Source table |
|---|---|---|---|
| Legal Business Name | `legal_business_name` | Middesk → OC → ZI | `business_entity_verification.name` |
| DBA | `dba_names` | Middesk → OC | `business_entity_verification.dba_names` |
| Business Address | `address_*` | Middesk → OC → ZI → EFX | `business_entity_address_source` |
| Business Age | `year_of_incorporation` | Middesk SOS → OC | `business_entity_verification.incorporation_date` |
| Corporation Type | `corporation_type` | Middesk → OC | `business_entity_verification.entity_type` |
| Number of Employees | `employee_count` | ZoomInfo → Equifax | `zoominfo_standard_ml_2.zi_c_employee_count` |
| Annual Revenue | `annual_revenue` | Equifax → ZoomInfo | `equifax_us_standardized.efx_annual_sales` |
| **NAICS Code** | **`naics_code`** | **Middesk (2.0) > OC (0.9) > ZI (0.8) > Trulioo (0.8) > EFX (0.7) > AI (0.1)** | **`rds_warehouse_public.facts`** |
| **MCC Code** | **`mcc_code`** | **Path A: vendor direct → Path B: crosswalk → Path C: AI** | **`rds_warehouse_public.facts`** |
| Industry Name | `industry` | Derived from NAICS sector (first 2 digits) | `core_business_industries` |
| MBE / WBE / VBE | `minority_owned` etc. | Equifax → ZoomInfo | `equifax_us_standardized.efx_minority_business_enterprise` |

> **How to interpret:** Every field visible in KYB Background went through the Fact Engine `factWithHighestConfidence()` → `weightedFactSelector()` → `manualOverride()` chain. The winner is stored in `rds_warehouse_public.facts` as a JSONB value including `source.confidence`, `source.platformId`, and `alternatives[]`.

### KYB Contact Information — Submitted vs. Reported Addresses

| Address type | Source | Badge |
|---|---|---|
| **Submitted Address** | `data_businesses.address_*` (applicant entered) | "Business Registration: Verified/Unverified" + "Google Profile: Verified/Unverified" |
| **Reported Address** | `integration_data.business_entity_address_source WHERE submitted=false` | "Business Registration: Verified/Unverified" + optionally "Deliverable" |

- **Verified** = Trulioo Comprehensive View `DatasourceFields` show all address fields as "match" or "missing" (never "nomatch")
- **Unverified** = At least one address field returned "nomatch" in Comprehensive View
- **Deliverable** = USPS confirms mail can be delivered to this address (from Middesk `addressSources[].deliverable`)
- **Google Profile: Verified** = SERP Google Profile (platform 39) found a Google Maps listing with matching address

Multiple reported addresses appear because Middesk and Trulioo query official registries that may have multiple addresses on file (registered office, trading address, historical addresses).

### KYB Business Registration — SOS and EIN Verification

| Field | Source | How verified |
|---|---|---|
| Business Name | `business_entity_names` | Middesk review_task `key="name"` status="success/failure" |
| Tax ID (EIN) | `data_businesses.tin` (AES-256 encrypted) | Middesk review_task `key="tin"` — checks IRS + SOS records |
| Filing Status | `business_entity_verification.sos_status` | Middesk SOS API: "Active", "Inactive", "Dissolved", "Revoked" |
| Entity Jurisdiction | `business_entity_verification.entity_jurisdiction_type` | "Domestic/Primary" vs "Foreign" |
| Registration Date | `business_entity_verification.incorporation_date` | From Middesk SOS filing |
| Corporate Officers | `business_entity_verification.officers JSONB` | From Middesk SOS filing |

---

## KYC Tab — Know Your Customer (Owner Identity)

### Who Fills What

> **Allison (00:19:06):** "We wouldn't get her date of birth and her home address and her phone number and fill it in for her. This is user entered."

During onboarding, the applicant can **select** from a pre-populated list of potential owners returned by Middesk/Trulioo ("is this one of your control persons?") — but they must self-enter all personal PII (DOB, SSN, home address, phone, email). Worth AI does NOT auto-populate these KYC fields from vendor data.

| Field | Yellow highlight? | Source | Verification |
|---|---|---|---|
| Legal First Name | Yes — applicant-submitted | `data_applicants.first_name` | Trulioo `DatasourceFields.FirstGivenName.Status` |
| Legal Last Name | Yes | `data_applicants.last_name` | Same |
| Date of Birth | Yes | `data_applicants.date_of_birth` | Trulioo `DayOfBirth + MonthOfBirth + YearOfBirth` |
| Social Security Number | Yes (masked XXX-XX-XXXX) | `data_owners.ssn` (AES-256 encrypted) | Trulioo `NationalId.Status` |
| Home Address | Yes | `data_owner_addresses` | Trulioo address match (Comprehensive View) |
| Phone Number | Yes | `data_applicants.phone` | Trulioo phone verification |
| Email Address | Yes | `data_applicants.email` | Not verified by default |
| Job Title | Yes | `data_owners.title` | Not verified |
| Ownership % | Yes | `data_owners.ownership_percentage` | Not verified |

### KYC Verification Badges

| Badge | Condition | IDV_STATUS | Source |
|---|---|---|---|
| ✅ Verified | IDV completed, all fields matched | SUCCESS (1) | `data_identity_verifications.status_id = 1` |
| ⏳ Verification Pending | IDV started but not completed | PENDING (2) | `status_id = 2` |
| ⚠️ Unverified — IDV Disabled | Customer has IDV inactive | n/a | `data_integration_settings.identity_verification.status = "INACTIVE"` |
| ❌ Unverified (Expired) | IDV link expired | EXPIRED (4) | `status_id = 4` |
| ❌ Unverified (Failed) | IDV failed | FAILED (99) | `status_id = 99` |

### Match / No Match Badges — How They Work

The green "Match" badges come from **Trulioo PSC person screening** (for UK/Canada) or **Plaid IDV** (for US with IDV enabled) — NOT from the XGBoost entity-matching model.

**Trulioo PSC flow:**
1. Trulioo compares submitted owner fields against official databases
2. Returns `DatasourceFields[{FieldName, Status}]` per field
3. `Status = "match"` → green Match badge
4. `Status = "nomatch"` → red No Match badge
5. `Status = "missing"` → no badge (field not in Trulioo's data)

**Plaid IDV flow:**
1. Applicant completes photo ID + selfie
2. Plaid compares submitted details against government ID
3. Returns field-level match results
4. Stored in `data_identity_verifications`

### Fraud Report (Plaid IDV only)

| Field | Plaid API field | What it means |
|---|---|---|
| Synthetic Identity Risk Score | `risk_check.identity_abuse_signals.synthetic_identity.score` | 0–100: likelihood identity was fabricated. >70 = HIGH risk. |
| Stolen Identity Risk Score | `risk_check.identity_abuse_signals.stolen_identity.score` | 0–100: likelihood identity was stolen. >70 = HIGH risk. |
| Fraud Ring | `risk_check.fraud_ring_detected` | Coordinated fraud ring signal |
| Bot Presence | `risk_check.bot_detected` | Automated behavior detected during IDV session |

---

## KYB Watchlists Tab

Screening results for the business AND all UBOs/Directors against global sanctions and regulatory watchlists. Data from Trulioo KYB (business) and Trulioo PSC (person/owner screening).

**Lists checked include:**
- OFAC: SDN, SSI, Non-SDN CMIC, Non-SDN Iranian Sanctions, CAPTA, Non-SDN Palestine
- BIS: Entity List, Denied Persons List, Unverified List
- PEP: Politically Exposed Persons databases
- Adverse Media: aggregated news source monitoring
- UK-specific: OFSI Financial Sanctions, Register of Insolvencies, Companies House Disqualified Directors, Employment Tribunal Decisions

**Results structure:**
- "Hits for {Business Name}" — business-level hits (`entity_type = "business"`)
- "Hits for {Owner Name}" — owner PSC hits (`entity_type = "person"`)
- "No Hits Found ✓" — clean screening result

Stored in: `integration_data.business_entity_review_task` with `key="watchlist"` and `metadata = WatchlistValueMetadatum[]`.

> **Known gap:** The Trulioo match relevancy score (0.0–1.0 per hit) is captured in raw responses but NOT surfaced in the UI or API. A score of 1.0 (exact name match) looks the same as 0.3 (fuzzy match) to analysts.

---

## Public Records Tab

| Panel | Source | Platform ID |
|---|---|---|
| SOS Registration | Middesk SOS API | 16 |
| Watchlists / Sanctions | Trulioo KYB + PSC | 38, 42 |
| Adverse Media (scored) | SERP + VerData + OpenAI scoring | 22, 4 |
| NPI (healthcare) | NPPES public API | 28 |
| BYL (Bankruptcies, Judgments, Liens) | **VerData** | 4 |

> **Allison (00:31:21):** "There's been more than normal questions about liens and judgments and bankruptcies...the source that's coming back on it is VerData." VerData has NO sandbox environment — it always calls the production endpoint.

---

## Banking Tab

| Element | Source | Tables |
|---|---|---|
| Bank accounts | Plaid bank connection (platform 1) | `data_connections`, `plaid_accounts`, `plaid_balances` |
| Statements | Plaid OR manual upload (platform 34) | `bank_statements`, S3 storage |
| GIACT verification | GIACT gVerify (platform 26) | `integration_data.request_response` |
| Transactions | Plaid (platform 1) | `plaid_transactions` → feeds Banking score category |

---

## All Storage Tables

| Table | Schema | What it contains |
|---|---|---|
| `facts` | `rds_warehouse_public` | All 217 computed facts as JSONB. One row per (business_id, name). Always latest. |
| `data_businesses` | `rds_cases_public` | Submitted business fields: name, address, tin (encrypted), industry FK |
| `data_cases` | `rds_cases_public` | Case records: status_id, case_type_id, score_trigger_id |
| `data_owners` | `rds_cases_public` | Owner PII: ssn (encrypted), dob, ownership_percentage |
| `data_identity_verifications` | `rds_cases_public` | Plaid IDV results per owner |
| `business_entity_verification` | `integration_data` | KYB results: name, status, officers, incorporation_date |
| `business_entity_review_task` | `integration_data` | Per-fact review tasks: watchlist, tin, name, address_verification |
| `business_entity_address_source` | `integration_data` | All addresses: submitted=true/false, deliverable |
| `request_response` | `integration_data` | Raw API responses from all vendors + confidence per call |
| `business_scores` | `rds_cases_public` | Worth Score: weighted_score_850, risk_level, score_decision |
| `business_score_factors` | `rds_cases_public` | Per-factor score breakdown |
| `score_decision_matrix` | `rds_cases_public` | Per-customer score thresholds → Auto Approved/Rejected/Review |
| `data_current_scores` | `rds_cases_public` | Latest score per (business_id, customer_id) |
| `adverse_media_articles` | `rds_cases_public` | OpenAI-scored adverse media articles |
| `customer_files` | `datascience` (Redshift) | Pipeline B analytics: primary_naics_code, zi/efx_match_confidence |

---

## API Endpoints

| Endpoint | naics_code? | Access | What is returned |
|---|---|---|---|
| `GET /facts/business/{id}/details` | Yes — primary | Admin/Customer/Applicant | Full fact: code + confidence + platformId + alternatives[] |
| `GET /facts/business/{id}/kyb` | Yes | Admin/Customer/Applicant | naics_code + mcc_code + industry as part of KYB set |
| `GET /businesses/customers/{id}` | Yes — simplified | Admin/Customer | Flat fields: naics_code + naics_title (no lineage) |
| `GET /facts/business/{id}/all` | Yes — admin only | Admin ONLY | All 217 facts |
| `PATCH /facts/.../override/naics_code` | Yes — write | Admin/Customer | Sets analyst override — always wins future Fact Engine runs |

---

## Tenants, Standalone Cases, and URL Patterns

**Tenants** were implemented for SSO (e.g., Repay + Okta). For internal users, tenants have no impact — all customers are always visible in the Customers tab regardless of tenant.

**Standalone Cases** (deprecated): Cases where `data_cases.customer_id IS NULL`. Created in the SMB era when businesses could self-submit without a customer invitation. The company now focuses on enterprise only. This tab contains only QA test data and should be ignored.

**URL patterns:**

| Navigation | URL |
|---|---|
| Customer list | `admin.joinworth.com/customers` |
| Customer detail | `admin.joinworth.com/customers/{customer_id}` |
| Case detail | `admin.joinworth.com/customers/{customer_id}/cases/{case_id}` |
| Business direct (fastest) | `admin.joinworth.com/{business_id}` |

---

## Worthipedia Documentation Priorities (from Craig, 00:31:21)

1. **Industry classification** — Wecsley leading. Covered in `Industry_Classification_Worthopedia.docx`
2. **KYC / fraud components for global launch** — Raj leading. Covered in this document + UK Screening doc
3. **Worth Score questions** — Self-serve. Covered in Section 3 of this document
4. **Secretary of State nuances** (NJ/Delaware status gaps) — Team effort
5. **Risk components** (BYL, watchlist, PEP, adverse media) — Covered in UK Screening document
6. **Auto-decisioning pass/fail rules** — Only visible in `customer.joinworth.com` (admin portal gap)

---

*Document verified against: `case-service/src/constants/`, `integration-service/lib/trulioo/`, `manual-score-service/src/workers/score/`, April 2 2026 training transcript.*
