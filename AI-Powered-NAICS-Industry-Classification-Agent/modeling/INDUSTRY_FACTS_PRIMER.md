# Industry Classification — Beginner's Guide
## How Worth AI Determines What a Business Does

---

## Start Here: What Is the Goal?

When a business applies through Worth AI, one of the most important questions is:

> **"What industry does this business operate in?"**

The answer — the industry code — drives risk scoring, KYB decisions, AML flags, and what the customer sees in the Worth AI UI and Worth 360 Report.

Worth AI stores the answer as **8 facts** in a database. This document explains where those 8 facts come from, working backwards from what the customer sees all the way to the raw vendor data.

---

## What the Customer Actually Sees

When a customer calls the API, they receive something like this:

```json
{
  "naics_code": {
    "value": "722511",
    "source": { "confidence": 0.95, "platformId": 16 },
    "alternatives": [
      { "value": "722513", "source": 24, "confidence": 0.72 },
      { "value": "722515", "source": 17, "confidence": 0.68 }
    ]
  },
  "mcc_code":          { "value": "5812" },
  "mcc_description":   { "value": "Eating Places, Restaurants" },
  "naics_description": { "value": "Full-Service Restaurants" },
  "industry":          { "value": "Food Service" }
}
```

This comes from the **GET /facts/business/{id}/details** endpoint. Every field in this response traces back to a specific source, a specific database table, and a specific rule.

---

## The 8 Industry Classification Facts — Plain English

All 8 facts live in one database table: **`rds_warehouse_public.facts`** — a key-value store where each row is one fact about one business.

| Fact name | Plain English | Example value |
|---|---|---|
| `naics_code` | The 6-digit industry code that best describes this business | `722511` |
| `naics_description` | The label for that code | `Full-Service Restaurants` |
| `mcc_code` | The 4-digit payment network category code | `5812` |
| `mcc_description` | The label for that MCC | `Eating Places, Restaurants` |
| `mcc_code_found` | Was MCC found directly from a vendor? | `true` |
| `mcc_code_from_naics` | MCC derived by looking up the NAICS in a crosswalk table | `5812` |
| `industry` | Short human-readable category label | `Food Service` |
| `classification_codes` | Every code from every source, before any winner is chosen | (see below) |

---

## Where Do These 8 Facts Come From? (Working Backwards)

### Step 3 → The facts are stored here

```
rds_warehouse_public.facts
  business_id = "uuid-abc123"
  name        = "naics_code"
  value       = { "code": "722511", "description": "Full-Service Restaurants" }
```

One row per fact per business. Updated every time a source gives new information.

---

### Step 2 → The facts are calculated here

The facts come from **the Fact Engine** — a piece of logic inside the `integration-service` that asks each data source: *"What industry code do you have for this business?"* and then picks the best answer.

The Fact Engine:
1. Collects a code + confidence score from each source
2. Picks the source with the **highest confidence** as the winner
3. Stores the winner as the fact, and all others as `alternatives`

---

### Step 1 → The confidence scores come from here

Each data source provides two things: an **industry code** and a **confidence score**. The confidence score answers: *"How sure are we that we found the right company in this vendor's database?"*

| Source | Industry code it provides | How confidence is calculated |
|---|---|---|
| **OpenCorporates** | `us_naics-722511` (from `industry_code_uids`) | Worth AI XGBoost model |
| **ZoomInfo** | `zi_c_naics6 = "722511"` | Worth AI XGBoost model |
| **Equifax** | `efx_primnaicscode = "722513"` | Worth AI XGBoost model |
| **Middesk** | NAICS from SOS filing | XGBoost model + verification tasks |
| **Trulioo** | SIC code from API | String similarity score |
| **AI (GPT-5-mini)** | AI-generated NAICS | Self-reported HIGH/MED/LOW |

The **Worth AI XGBoost entity matching model** runs on pairs of records — the submitted business record vs the vendor record — and outputs a probability 0–1. That probability IS the confidence score.

---

## A Simple Picture

```
                        CUSTOMER SUBMITS A BUSINESS
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              API CALLS        API CALLS       READ FROM
               (live)          (live)          REDSHIFT
                    │               │               │
              Middesk         Trulioo         ZoomInfo
              Middesk SOS     sicCode         zi_c_naics6
              NAICS code                      ─────────────
                                              Equifax
                                              efx_primnaicscode
                                              ─────────────
                                              OpenCorporates
                                              industry_code_uids

                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   FACT ENGINE        │
                         │                      │
                         │  Each source gives:  │
                         │   - industry code     │
                         │   - confidence 0–1   │
                         │  (XGBoost for most)  │
                         │                      │
                         │  Pick highest conf.  │
                         │  → winner selected   │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  8 FACTS STORED     │
                         │                     │
                         │  naics_code         │ ← rds_warehouse_public.facts
                         │  mcc_code           │
                         │  industry           │
                         │  + 5 more           │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  CUSTOMER SEES IT   │
                         │                     │
                         │  GET /facts/        │
                         │  business/{id}/     │
                         │  details            │
                         └─────────────────────┘
```

---

## The Two Pipelines — Why They Exist

Worth AI actually has **two separate systems** doing industry classification. They run at the same time but for different purposes.

### Pipeline A — "What does the customer see?"

This runs **every time a business is submitted**. It uses all available sources, picks the best code, and stores the 8 facts. This is what the customer API returns.

- **Runs:** Real-time, per business
- **Sources used:** All 6 (ZoomInfo, Equifax, OC, Middesk, Trulioo, AI)
- **Output:** The 8 facts in `rds_warehouse_public.facts`
- **Customer sees:** YES — via `GET /facts/business/{id}/details`

### Pipeline B — "What does the data science team use?"

This runs as a **scheduled batch job** in Redshift. It only uses ZoomInfo and Equifax (the two sources with pre-loaded Redshift tables and clean numeric NAICS fields). It builds a wide analytics table used for training models and exporting data.

- **Runs:** Batch, on a schedule
- **Sources used:** ZoomInfo and Equifax ONLY
- **Output:** `datascience.customer_files` (a wide analytics table)
- **Customer sees:** NO — internal only

> ⚠️ **These two can disagree.** If OpenCorporates had a better match than ZoomInfo or Equifax, the customer API (Pipeline A) will show OC's NAICS code — but the analytics table (Pipeline B) will still show whichever of ZI or EFX won.

---

## How Each of the 8 Facts Is Built

### `naics_code` — the most important one

**Question it answers:** What 6-digit NAICS code best describes this business?

**How it is built:**
1. Every source returns a code + confidence
2. Fact Engine picks the highest confidence
3. If fewer than 3 sources returned a code → AI (GPT-5-mini) also tries
4. The winning code is validated against `core_naics_code` lookup table
5. If invalid → replaced with `"561499"` (a placeholder meaning "unknown")

**Where stored:** `rds_warehouse_public.facts` (name = `naics_code`)

**Also stored in:** `data_businesses.naics_id` → FK to `core_naics_code` table

---

### `naics_description` — the label

**Question:** What is the English label for the winning NAICS code?

**How it is built:** After `naics_code` is resolved, Worth AI looks it up in `core_naics_code` and stores the description as a separate fact.

**Where stored:** `rds_warehouse_public.facts` (name = `naics_description`)

---

### `mcc_code` — payment network category

**Question:** What 4-digit Merchant Category Code does Visa/Mastercard use for this business?

**How it is built — three paths:**

```
Path A (best): A vendor directly returns an MCC code
  → Middesk or Trulioo includes MCC in their API response
  → stored directly

Path B (most common): Derive it from the NAICS code
  → Look up: SELECT mcc_code FROM rel_naics_mcc WHERE naics_code = '722511'
  → Returns: 5812

Path C (fallback): GPT-5-mini returns MCC alongside NAICS
```

**Where stored:** `rds_warehouse_public.facts` (name = `mcc_code`)

**Also stored in:** `data_businesses.mcc_id` → FK to `core_mcc_code` table

---

### `mcc_description` — the MCC label

**Question:** What is the English label for the MCC code?

**How it is built:** Lookup from `core_mcc_code` table after `mcc_code` is resolved.

---

### `mcc_code_found` — a quality flag

**Question:** Did a vendor directly return an MCC, or was it derived?

- `true` → vendor gave it directly (more reliable)
- `false` → derived from NAICS crosswalk (less reliable)

**Why this matters:** A crosswalk maps one NAICS to one MCC, but some businesses span categories. A directly found MCC is more precise.

---

### `mcc_code_from_naics` — the derived MCC

**Question:** What MCC would you get by looking up this business's NAICS in the crosswalk table?

Always computed alongside `mcc_code`. When `mcc_code_found = false`, both facts contain the same value.

---

### `industry` — the human label

**Question:** What short industry category label should we show in the UI?

**How it is built:** Derived from the first two digits of the NAICS code:

```typescript
const sectorCode = naics_code.substring(0, 2);  // e.g. "72" from "722511"
const industries = await internalGetIndustries(sectorCode);
// Returns: "Food Service" from core_business_industries table
```

**Also receives values from:** ZoomInfo `zi_c_industry`, Trulioo industry text, OC industry labels.

**Where stored:** `rds_warehouse_public.facts` (name = `industry`)
**Also stored in:** `data_businesses.industry` → FK to `core_business_industries`

---

### `classification_codes` — the complete raw picture

**Question:** What did EVERY source return, before any winner was chosen?

This fact captures everything — all taxonomies, all sources — and stores them together:

```json
{
  "codes": [
    { "system": "NAICS",  "code": "722511", "source": "Middesk",   "confidence": 0.95 },
    { "system": "NAICS",  "code": "722511", "source": "OC",         "confidence": 0.89 },
    { "system": "uk_sic", "code": "56101",  "source": "OC",         "confidence": 0.89 },
    { "system": "NAICS",  "code": "722513", "source": "ZoomInfo",   "confidence": 0.72 },
    { "system": "NAICS",  "code": "722515", "source": "Equifax",    "confidence": 0.68 }
  ]
}
```

Note the `uk_sic` entry: OC returns UK SIC codes for UK businesses. These are captured here but **currently have no downstream consumer** — they are stored but not yet used to populate a `uk_sic_code` fact or shown separately in the API. This is a known gap.

---

## The Winning Source Rules — Simplified

```
RULE 1 — Highest confidence wins
  Each source has a confidence score 0–1.
  Whoever is highest wins.

RULE 2 — Tie-break by weight
  If two sources are within 5% of each other:
  Use source weight: Middesk(2.0) > OC(0.9) > ZI(0.8) > EFX(0.7) > AI(0.1)

RULE 3 — Analyst override always wins
  If an analyst manually set the code via the API, that always wins.

RULE 4 — No minimum threshold
  There is no "confidence must be at least X" rule.
  If confidence is 0.10 and that is the best available, it wins.
  The low confidence is visible in the API response.

RULE 5 — AI as safety net
  If fewer than 3 sources returned a code → GPT-5-mini tries too.
  GPT result has weight=0.1 so it rarely wins unless vendors found nothing.

RULE 6 — Last resort
  If GPT also fails, or returns an invalid code:
  naics_code = "561499" (All Other Business Support Services)
  This is a placeholder — an analyst should override it.
```

---

## What Happens in Each Scenario

| Situation | What gets stored | What customer sees |
|---|---|---|
| 3+ sources agree on same code | That code with high confidence | Strong classification, multiple alternatives |
| Sources disagree | Highest-confidence source wins | Winner + alternatives showing the disagreement |
| Only 1 source returned a code | That source wins; AI also runs | Code with possibly low confidence |
| No source returned any code | AI runs; stores whatever GPT returns | AI-generated code or `561499` placeholder |
| Winning code fails validation | Replaced with `561499` | Placeholder code — signals "unknown" |
| Analyst set an override | Override wins | Override code with `override` field populated |

---

## The Lookup Tables That Support the Facts

These tables live in `rds_cases_public` (the case-service PostgreSQL database):

| Table | Purpose | Example content |
|---|---|---|
| `core_naics_code` | All valid 6-digit NAICS codes with labels | `722511 → Full-Service Restaurants` |
| `core_mcc_code` | All valid 4-digit MCC codes with labels | `5812 → Eating Places, Restaurants` |
| `rel_naics_mcc` | NAICS → MCC crosswalk | `722511 → 5812` |
| `core_business_industries` | Short industry category labels | `72 → Food Service` |

When a new NAICS code is added to the system (via the `naics_code` fact), Worth AI looks it up in these tables to get the description, MCC, and industry label.

---

## One-Page Summary

```
SOURCE DATA (pre-loaded into Redshift or called live):
  ZoomInfo   → zi_c_naics6 = "722511"   confidence from XGBoost model
  Equifax    → efx_primnaicscode = "722513"  confidence from XGBoost model
  OC         → industry_code_uids = "us_naics-722511|gb_sic-56101"  XGBoost
  Middesk    → naics from SOS filing     confidence from XGBoost + tasks
  Trulioo    → sicCode                   confidence from string similarity
  AI/GPT     → naics_code + mcc_code     self-reported HIGH/MED/LOW
       │
       ▼
FACT ENGINE (picks winner):
  Collect all codes + confidences
  → highest confidence wins
  → tie within 5%: higher source weight wins
  → analyst override always wins
  → AI runs if < 3 sources found code
  → invalid code → replace with "561499"
       │
       ▼
8 FACTS STORED in rds_warehouse_public.facts:
  naics_code          "722511"
  naics_description   "Full-Service Restaurants"
  mcc_code            "5812"   (direct from vendor OR crosswalk from NAICS)
  mcc_description     "Eating Places, Restaurants"
  mcc_code_found      true     (was MCC directly returned, not derived?)
  mcc_code_from_naics "5812"   (always computed from crosswalk)
  industry            "Food Service"
  classification_codes [all codes from all sources, before winner chosen]

  Also stored:
  data_businesses.naics_id → FK to core_naics_code
  data_businesses.mcc_id   → FK to core_mcc_code
  data_businesses.industry → FK to core_business_industries
       │
       ▼
CUSTOMER SEES (via GET /facts/business/{id}/details):
  naics_code = "722511"  confidence = 0.95  source = Middesk
  alternatives: [ ZoomInfo "722513" 0.72, Equifax "722515" 0.68 ]
  mcc_code = "5812"
  industry = "Food Service"

CUSTOMER ALSO SEES (via GET /businesses/customers/{id}):
  naics_code = "722511"
  naics_title = "Full-Service Restaurants"
  mcc_code = "5812"
```
