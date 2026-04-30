# NAICS/MCC Explorer — Schema Research & Data Source Reference

## Summary: Where Is Each Field Stored?

| API JSON Field | Redshift Table | Column(s) | Notes |
|---|---|---|---|
| `naics_code.value` | `rds_warehouse_public.facts` | `JSON_EXTRACT_PATH_TEXT(value,'value')` where `name='naics_code'` | Winning value after arbitration |
| `naics_code.source.platformId` | `rds_warehouse_public.facts` | `JSON_EXTRACT_PATH_TEXT(value,'source','platformId')` | Winning platform ID (new schema) |
| `naics_code.source.name` | `rds_warehouse_public.facts` | `JSON_EXTRACT_PATH_TEXT(value,'source','name')` | Winning platform name (old schema) |
| `naics_code.source.confidence` | `rds_warehouse_public.facts` | `JSON_EXTRACT_PATH_TEXT(value,'source','confidence')` | Winning confidence score |
| `naics_code.alternatives[]` | `rds_warehouse_public.facts` | `value` column (full JSON blob) | Parse Python-side; Redshift can't array-expand |
| `naics_code.ruleApplied.name` | `rds_warehouse_public.facts` | `JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')` | e.g. `factWithHighestConfidence` |
| `mcc_code.value` | `rds_warehouse_public.facts` | `name='mcc_code'` | Derived fact (platformId=-1, name='dependent') |
| `mcc_code_found.value` | `rds_warehouse_public.facts` | `name='mcc_code_found'` | AI-direct path |
| `mcc_code_from_naics.value` | `rds_warehouse_public.facts` | `name='mcc_code_from_naics'` | NAICS→MCC lookup path |
| `mcc_description.value` | `rds_warehouse_public.facts` | `name='mcc_description'` | Human-readable MCC label |
| `naics_description.value` | `rds_warehouse_public.facts` | `name='naics_description'` | Human-readable NAICS label |
| `industry.value.name` | `rds_warehouse_public.facts` | `name='industry'`, `JSON_EXTRACT_PATH_TEXT(value,'value','name')` | 2-digit NAICS sector name |
| `industry.value.sector_code` | `rds_warehouse_public.facts` | `name='industry'`, `JSON_EXTRACT_PATH_TEXT(value,'value','sector_code')` | 2-digit sector |
| NAICS code lookup | `rds_cases_public.core_naics_code` | `id`, `code`, `title` (and more) | Canonical NAICS taxonomy |
| MCC code lookup | `rds_cases_public.core_mcc_code` | `id`, `code`, `title` (and more) | Canonical MCC list |
| NAICS→MCC mapping | `rds_cases_public.rel_naics_mcc` | `naics_id` → `mcc_id` | Join via `core_naics_code.id` and `core_mcc_code.id` |
| Business↔Customer link | `rds_cases_public.rel_business_customer_monitoring` | `business_id`, `customer_id`, `created_at` | Date filtering anchor |

## Confirmed: rds_cases_public.core_naics_code

**Real usage in kyb_hub_app_v2.py (lines 10861, 11208, 11344, 11362):**
```sql
SELECT DISTINCT nc.code AS naics_code, mc.code AS mcc_code
FROM rds_cases_public.rel_naics_mcc r
JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
JOIN rds_cases_public.core_mcc_code mc   ON mc.id = r.mcc_id
```

**Columns confirmed used:**
- `id`   — integer PK, joined via `rel_naics_mcc.naics_id`
- `code` — the 6-digit NAICS code string (e.g. `"811111"`)

**Additional columns expected (from API schema and businessDetails/index.ts):**
- `title` — human-readable description (e.g. "General Automotive Repair")

## Confirmed: rds_cases_public.core_mcc_code

**Columns confirmed used:**
- `id`   — integer PK, joined via `rel_naics_mcc.mcc_id`
- `code` — the 4-digit MCC string (e.g. `"7538"`)

**Additional columns expected:**
- `title` — human-readable description (e.g. "Automotive Service Shops (Non-Dealer)")

## Confirmed: rds_cases_public.rel_naics_mcc

**Canonical NAICS→MCC mapping table.** Used by `integration-service/lib/facts/businessDetails/index.ts:L359-374`
to compute `mcc_code_from_naics`.

**Columns:** `naics_id` (FK → core_naics_code.id), `mcc_id` (FK → core_mcc_code.id)

This is Worth's own canonical table — if a NAICS+MCC pair is in this table, it's a
**canonical pair**. If not, it's **non-canonical** (either wrong or unmapped).

## Key Facts Stored in rds_warehouse_public.facts

All facts use this pattern — one row per (business_id, name):

```json
{
  "name": "naics_code",
  "value": "811111",
  "source": {
    "confidence": 1,
    "platformId": 24,
    "updatedAt": "2026-04-22T12:49:40.236Z",
    "name": "zoominfo"
  },
  "ruleApplied": {
    "name": "factWithHighestConfidence"
  },
  "isNormalized": null,
  "alternatives": [
    {"value": "811114", "source": 17, "confidence": 1, "updatedAt": "..."}
  ]
}
```

### platformId = -1 means "dependent"

From the API JSON (`mcc_code`, `mcc_code_from_naics`, `mcc_description`, `naics_description`,
`industry`, `primary_address_string`, etc.):

```json
"source": {"confidence": null, "platformId": -1, "name": "dependent"}
```

This is NOT a legacy schema issue — `platformId: -1` is the current schema value for facts
that are **computed from other facts** (not from a vendor). The `sources.calculated` entry
in `integration-service/lib/facts/sources.ts` uses `platformId: -1`.

### platformId = 0 means "businessDetails" (self-reported)

Applicant Entry — what the business typed on the onboarding form.
Hardcoded `confidence: 1` — this is the arbitration bug.

### Legacy schema (old format)

Some older records store source as:
```json
"source": {"name": "AINaicsEnrichment", "confidence": 0.15}
```
No `platformId` field. `JSON_EXTRACT_PATH_TEXT(value,'source','platformId')` returns NULL.

## Additional Fact Names Available (for future analyses)

From the API JSON provided:
- `industry` — 2-digit NAICS sector, derived from `naics_code` (dependent)
- `naics_description` — text label for the NAICS code (dependent)
- `mcc_description` — text label for the MCC code (dependent)
- `classification_codes` — null in example, may hold SIC/other codes

From kyb_hub_app_v2.py (lines 310-343):
- `naics_code`, `mcc_code`, `mcc_code_found`, `mcc_code_from_naics` — main classification facts
- `legal_name`, `business_name`, `primary_address` — business identity
- `sos_filings`, `sos_match_boolean`, `sos_active` — registry verification
- `tin_match_boolean`, `tin_submitted` — EIN verification
- `watchlist_hits`, `num_bankruptcies`, `num_judgements`, `num_liens` — risk signals
- `worth_score` — final score (also in `rds_manual_score_public.data_current_scores`)

## Lookup Query Pattern (Correct)

```sql
-- Get canonical NAICS→MCC pairs with human-readable labels
SELECT
    nc.code  AS naics_code,
    nc.title AS naics_title,
    mc.code  AS mcc_code,
    mc.title AS mcc_title
FROM rds_cases_public.rel_naics_mcc r
JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
ORDER BY nc.code, mc.code;
```

```sql
-- Validate a NAICS code
SELECT id, code, title
FROM rds_cases_public.core_naics_code
WHERE code = '811111';
```

```sql
-- Validate an MCC code
SELECT id, code, title
FROM rds_cases_public.core_mcc_code
WHERE code = '7538';
```

## The "dependent" Platform (-1) — What It Means

From the API JSON, these facts have `platformId: -1, name: "dependent"`:
- `mcc_code` — computed from `mcc_code_found ?? mcc_code_from_naics`
- `mcc_code_from_naics` — computed from `rel_naics_mcc` lookup keyed by `naics_code`
- `mcc_description` — computed from `core_mcc_code` lookup by MCC code
- `naics_description` — computed from `core_naics_code` lookup by NAICS code
- `industry` — computed as 2-digit sector from NAICS code
- `primary_address_string` — computed from `primary_address`
- `mailing_address_strings` — computed from `mailing_address`

None of these are from vendors. They have no confidence score because they are deterministic
computations inside the Fact Engine, not probabilistic vendor outputs.

**In the Explorer UI:** these show as "Calculated (P-1)" and should be treated as
"downstream of NAICS/MCC" — if NAICS is wrong, all dependent facts are also wrong.
