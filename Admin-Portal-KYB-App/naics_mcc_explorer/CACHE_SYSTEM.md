# NAICS/MCC Explorer — Local Facts Cache System

## Overview

The NAICS/MCC Explorer includes a **weekly offline cache system** that fetches live fact data from the Worth AI API, stores it in a local SQLite database, and uses that database to power all app analysis. Once the cache is built, the app runs entirely offline — no API calls, no Redshift fact queries — just fast local SQLite reads.

---

## Why This Exists

### The Problem

The app's analysis pages (Platform Winners, NAICS Validity, Customer Intelligence, Misidentification, etc.) originally read directly from `rds_warehouse_public.facts` in Redshift on every page load. This worked but had two limitations:

1. **Stale timestamps** — `facts.received_at` records when the Redshift row was *created*, not when the data was last updated. The real freshness timestamp (`source.updatedAt`) lives *inside* the JSON blob and requires extraction per query.

2. **Alternatives[] are hard to aggregate** — The `alternatives[]` array in each fact contains all the data sources that submitted a value but lost the scoring race. Querying across thousands of businesses and parsing alternatives in Redshift requires complex JSON extraction. Storing them pre-parsed in SQLite makes every analysis dramatically simpler.

### The Solution

A **weekly refresh script** (`scripts/refresh_facts_cache.py`) that:
1. Fetches live facts for every business from the Worth AI API
2. Enriches each fact with NAICS/MCC descriptions, canonical pair status, and misidentification signals
3. Stores everything — winners AND alternatives — in a local SQLite database
4. Detects and flags what changed since the previous week

The app then reads from SQLite for all analysis. **Redshift is used only for:** customer/business ID lists, lookup tables (`core_naics_code`, `core_mcc_code`, `rel_naics_mcc`), and customer names.

---

## The Original TypeScript Script — What It Did and What We Adapted

### Original: `facts-to-csv.ts`

A TypeScript script was shared as the starting point. It was designed for **single-business export** — fetch all KYB facts for one business and write them to a CSV file. Key characteristics:

**Authentication:**
```typescript
async function getAdminToken(): Promise<string> {
    const response = await axios.post(
        `${API_BASE_URL}/auth/api/v1/admin/sign-in`,
        { email, password }
    );
    return response.data.data.id_token;
}
```
The script uses the **admin sign-in endpoint** (`/admin/sign-in`), not the customer endpoint (`/customer/sign-in`). This distinction is critical — Worth AI internal users authenticate through the admin endpoint, and using the wrong one returns "Incorrect username or password" even with correct credentials.

**The key API endpoint it discovered:**
```typescript
async function getFactsData(businessId: string, token: string): Promise<any> {
    const response = await axios.get(
        `${API_BASE_URL}/integration/api/v1/facts/business/${businessId}/all`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
}
```
This endpoint (`/facts/business/{id}/all`) returns **all facts** for a business as a flat dict. This is the same endpoint used by the Admin Portal's own frontend code (`microsites-main/packages/case/src/services/api/integration.service.ts:390`). It returns the complete fact picture — naics_code, mcc_code, sos_filings, tin_match, watchlist, worth_score, and everything else.

**The flattening logic:**
The TypeScript script included a `flattenValue()` function that recursively flattened nested JSON (arrays of objects, nested objects) into dot-notation rows for a CSV:
```typescript
// e.g. sos_filings[0].state → "sos_filings.state"
// e.g. industry.name → "industry.name"
```
This was designed for human-readable CSV export, not for database storage.

**The source mapping logic:**
```typescript
if (sourceName === 'middesk' || sourceName === 'opencorporates') {
    sourceMap = sosJurisdiction + '::secretaryofstate';
} else if (sourceName === 'verdata') {
    sourceMap = 'ONLINE_SCAN';
}
```
A source_map column was produced by mapping source names to semantic identifiers. This was specific to the original export use case.

**What the original script produced:**
- One CSV file per business: `facts_{businessId}.csv`
- One JSON file per business: `facts_{businessId}_raw.json`
- Columns: `field_name`, `source_supplier_name`, `source_map`, `source_confidence`, `source_platform_id`, `value`, `total_count`

### What We Changed and Why

The original script was adapted from a single-business exporter to a **bulk database builder** for all paying clients. Here is every significant change:

#### 1. Language: TypeScript → Python

The app is a Python Streamlit application. Rewriting in Python allows:
- Direct integration with the app's existing `utils/worth_api.py` auth module
- Using psycopg2 for Redshift lookups (already installed)
- SQLite via Python's built-in `sqlite3` module (no new dependencies)
- Threading via `concurrent.futures.ThreadPoolExecutor`

#### 2. Single business → All businesses (parallel)

Original: One business ID from command line argument.

Ours:
```python
businesses = fetch_business_ids(rconn, date_from, date_to, client_filter)
# Returns all (business_id, customer_id, client_name) from Redshift

with ThreadPoolExecutor(max_workers=args.workers) as pool:
    futures = {pool.submit(_fetch_one, b): b for b in businesses}
    for future in as_completed(futures):
        biz, facts_data = future.result()
        # Process and accumulate rows
```
Twenty concurrent API calls run in parallel. For ~8,000 businesses: ~8–10 minutes total.

#### 3. CSV → SQLite with full schema

Original: flat CSV files, one per business.

Ours: a normalized SQLite database with three tables:

```
facts_cache.sqlite
├── facts        — one row per (business_id × fact_name × snapshot_date)
├── alternatives — one row per alternative per fact per snapshot
├── businesses   — one row per (business_id × snapshot_date) — summary
└── cache_meta   — one row per refresh run
```

Why SQLite instead of CSV:
- **Queryable** — the app can filter by client, fact_name, platform, validity, signal with SQL
- **Indexed** — fast reads even for 320,000+ rows
- **Historical** — multiple snapshots preserved, enabling week-over-week comparison
- **Single file** — portable, no server needed, gitignored

#### 4. Source mapping removed, platform IDs kept

The original script's `source_map` (e.g. "US::PA::SECRETARYOFSTATE") was designed for downstream processing in their pipeline. We don't need it — we keep the raw `source.platformId` and look up the human-readable name from our `PLATFORM_NAMES` dict:

```python
PLATFORM_NAMES = {
    "0":  "Applicant Entry",
    "24": "ZoomInfo",
    "31": "AI NAICS Enrichment",
    # ...
}
```

#### 5. Enrichment added (not in original)

After fetching from the API, we enrich each fact row with:

```python
# NAICS description from core_naics_code
naics_desc = naics_lookup.get(val_str, "")

# MCC description from core_mcc_code
mcc_desc = mcc_lookup.get(val_str, "")

# Sector code and name (2-digit NAICS prefix)
sector_code = val_str[:2]
sector_name = sector_lookup.get(sector_code, "")

# Validity check
naics_validity = validate_naics(val_str)  # valid | catch_all | invalid_format | null

# Canonical pair check against rel_naics_mcc
is_canon = int((naics_v_str, mcc_v_str) in canonical_pairs)
```

The lookup data comes from Redshift in Step 2 (fast, one-time queries) and is applied to every business in Python memory.

#### 6. Full alternatives[] parsed into a separate table

Original: alternatives were included in `total_count` and the first element was flattened to CSV.

Ours: every alternative from every fact for every business gets its own row in the `alternatives` table:

```python
for i, a in enumerate(parsed_alts):
    alt_rows.append({
        "business_id":     biz["business_id"],
        "fact_name":       fact_name,
        "snapshot_date":   snapshot_date,
        "alt_rank":        i,            # 0-based position in alternatives[]
        "alt_platform_id":   a_pid,
        "alt_platform_name": a_pname,
        "alt_value":         a_val,
        "alt_confidence":    a_conf,
        "alt_updated_at":    a_ts,       # source.updatedAt for the alternative
    })
```

This means any analysis comparing winner vs. alternatives (e.g. "ZoomInfo had the right code but lost to a blank form submission") can be done with a simple SQL JOIN.

#### 7. Change detection added

The original script had no historical awareness. Ours compares every fact value and platform against the previous snapshot:

```python
prev = prev_facts.get((biz["business_id"], fact_name), {})
prev_val = prev.get("value", "")
prev_pid = prev.get("platform_id", "")
val_changed  = int(bool(prev_val) and val_str != prev_val)
pid_changed  = int(bool(prev_pid) and pid != prev_pid)
```

The `businesses` table stores `naics_changed`, `mcc_changed`, `naics_platform_changed` flags and the previous values (`prev_naics_code`, `prev_mcc_code`) for every business. This enables a "what changed this week" view.

#### 8. Misidentification signals pre-computed

Rather than computing signals at display time (which requires parsing alternatives[] in Python for every row on every page load), we compute them once during the refresh:

```python
signals = compute_signals(naics_v_str, naics_pid, naics_alts)
# Returns e.g. "S4:ghost_override|S5:sector_mismatch"
```

The seven signals:
- **S1** — Blank winner (form submission won with null value)
- **S2** — Wrong format (not a 6-digit number)
- **S3** — Generic placeholder (561499 won)
- **S4** — Form overrides vendors (P0 won, vendors had different code)
- **S5** — Wrong industry sector (winner's 2-digit sector ≠ all vendor alternatives)
- **S6** — Multiple vendors agreed but weren't used
- **S7** — Generic placeholder won but specific alternatives existed

#### 9. Critical bug fix: integer codes from Redshift

When fetching lookup data from Redshift, `core_naics_code.code` and `core_mcc_code.code` are stored as `INTEGER` columns. Even with `CAST(code AS VARCHAR)` in SQL, psycopg2 returns them as Python `int` objects in some Redshift configurations. The original TypeScript script didn't have this issue (Node.js type coercion is more forgiving). Our Python fix:

```python
# Wrong (raises AttributeError: 'int' object has no attribute 'strip'):
return {(r[0].strip(), r[1].strip()) for r in cur.fetchall()}

# Fixed — both SQL CAST and Python str():
cur.execute("SELECT DISTINCT CAST(nc.code AS VARCHAR), CAST(mc.code AS VARCHAR) ...")
return {(str(r[0]).strip(), str(r[1]).strip()) for r in cur.fetchall()}
```

---

## File Structure

```
naics_mcc_explorer/
├── scripts/
│   └── refresh_facts_cache.py    ← Weekly refresh runner (654 lines)
├── db/
│   ├── cache_manager.py          ← SQLite schema, connection, utilities (312 lines)
│   └── sqlite_queries.py         ← All query functions for app pages (467 lines)
├── facts_cache.sqlite            ← Generated by refresh (gitignored, ~200-400MB)
└── CACHE_SYSTEM.md               ← This document
```

---

## SQLite Schema — Complete

### `facts` table
One row per **(business_id × fact_name × snapshot_date)**.

| Column | Type | Description |
|---|---|---|
| `business_id` | TEXT | Worth AI business UUID |
| `customer_id` | TEXT | Worth AI customer UUID |
| `client_name` | TEXT | Human-readable client name (from billing_prices) |
| `fact_name` | TEXT | e.g. `naics_code`, `mcc_code`, `sos_active` |
| `snapshot_date` | TEXT | ISO timestamp of the refresh run that produced this row |
| `is_latest` | INTEGER | 1 = most recent snapshot, 0 = historical |
| `winning_value` | TEXT | The fact value that won the scoring race |
| `winning_platform_id` | TEXT | platformId of the winning source (e.g. "24") |
| `winning_platform_name` | TEXT | Human-readable name (e.g. "ZoomInfo") |
| `winning_confidence` | REAL | Confidence score (0.0–1.0) |
| `winner_updated_at` | TEXT | `source.updatedAt` from the JSON — the real freshness timestamp |
| `rule_applied` | TEXT | e.g. "factWithHighestConfidence" |
| `naics_description` | TEXT | Human-readable NAICS label from `core_naics_code.label` |
| `mcc_description` | TEXT | Human-readable MCC label from `core_mcc_code.label` |
| `industry_sector_code` | TEXT | 2-digit NAICS sector prefix |
| `industry_sector_name` | TEXT | Sector name (e.g. "Professional Services") |
| `naics_validity` | TEXT | `valid` \| `catch_all` \| `invalid_format` \| `null` |
| `mcc_validity` | TEXT | `valid` \| `catch_all` \| `known_invalid` \| `null` |
| `is_canonical_pair` | INTEGER | 1 = NAICS+MCC exists in `rel_naics_mcc` |
| `prev_winning_value` | TEXT | Value from the previous snapshot (for change detection) |
| `prev_winning_platform_id` | TEXT | Platform from the previous snapshot |
| `value_changed` | INTEGER | 1 = value differs from previous snapshot |
| `platform_changed` | INTEGER | 1 = platform differs from previous snapshot |
| `alternatives_json` | TEXT | Full `alternatives[]` as JSON (for Python-side parsing) |
| `fetched_at` | TEXT | When the API call was made |

### `alternatives` table
One row per **(business_id × fact_name × snapshot_date × alt_rank)**.

| Column | Type | Description |
|---|---|---|
| `business_id` | TEXT | Business UUID |
| `fact_name` | TEXT | Which fact this alternative belongs to |
| `snapshot_date` | TEXT | Refresh run timestamp |
| `is_latest` | INTEGER | 1 = most recent snapshot |
| `alt_rank` | INTEGER | 0-based position in `alternatives[]` array |
| `alt_platform_id` | TEXT | platformId of this alternative source |
| `alt_platform_name` | TEXT | Human-readable platform name |
| `alt_value` | TEXT | The value this source returned |
| `alt_confidence` | REAL | This source's confidence score |
| `alt_updated_at` | TEXT | `source.updatedAt` for this alternative |

### `businesses` table
One row per **(business_id × snapshot_date)** — the summary view.

| Column | Type | Description |
|---|---|---|
| `business_id` | TEXT | Business UUID |
| `customer_id` | TEXT | Customer UUID |
| `client_name` | TEXT | Paying client name |
| `snapshot_date` | TEXT | Refresh run |
| `is_latest` | INTEGER | 1 = most recent |
| `naics_code` | TEXT | Winning NAICS value |
| `naics_description` | TEXT | NAICS human label |
| `naics_platform_id` | TEXT | Platform that won for NAICS |
| `naics_platform_name` | TEXT | Platform name |
| `naics_confidence` | REAL | Winning confidence |
| `naics_updated_at` | TEXT | `source.updatedAt` for NAICS |
| `naics_validity` | TEXT | Validity status |
| `naics_sector_code` | TEXT | 2-digit sector |
| `naics_sector_name` | TEXT | Sector label |
| `mcc_code` | TEXT | Final winning MCC |
| `mcc_description` | TEXT | MCC human label |
| `mcc_code_found` | TEXT | AI-assigned MCC (`mcc_code_found` fact) |
| `mcc_code_from_naics` | TEXT | NAICS-derived MCC (`mcc_code_from_naics` fact) |
| `mcc_platform_id` | TEXT | Platform that won for MCC |
| `mcc_confidence` | REAL | MCC winning confidence |
| `mcc_updated_at` | TEXT | `source.updatedAt` for MCC |
| `mcc_validity` | TEXT | MCC validity status |
| `is_canonical_pair` | INTEGER | NAICS+MCC in official mapping |
| `signals` | TEXT | Pipe-separated misidentification signals: `S4:ghost_override\|S5:sector_mismatch` |
| `naics_changed` | INTEGER | 1 = NAICS code changed vs previous snapshot |
| `mcc_changed` | INTEGER | 1 = MCC code changed vs previous snapshot |
| `naics_platform_changed` | INTEGER | 1 = winning platform changed for NAICS |
| `prev_naics_code` | TEXT | NAICS code from previous snapshot |
| `prev_mcc_code` | TEXT | MCC code from previous snapshot |
| `prev_naics_platform_id` | TEXT | Platform from previous snapshot |

### `cache_meta` table
One row per refresh run.

| Column | Description |
|---|---|
| `snapshot_date` | Primary key — ISO timestamp of this refresh |
| `total_businesses` | How many businesses were fetched |
| `total_facts` | Total fact rows written |
| `total_alternatives` | Total alternative rows written |
| `date_from_filter` | `--date-from` used for this refresh |
| `date_to_filter` | `--date-to` used for this refresh |
| `client_filter` | `--client` filter (or "all") |
| `refresh_duration_sec` | How long the refresh took |
| `api_endpoint` | API base URL used |

---

## How the Refresh Works — Step by Step

```bash
python3 scripts/refresh_facts_cache.py [options]
```

### Step 1 — Authentication

```python
for endpoint in ["/admin/sign-in", "/customer/sign-in"]:
    resp = requests.post(f"{AUTH_BASE}{endpoint}", json={"email": ..., "password": ...})
    if resp.status_code == 200:
        token = resp.json()["data"]["id_token"]
        break
```

Tries the admin endpoint first (correct for Worth AI internal users). Falls back to customer endpoint. The `id_token` JWT is valid for ~1 hour and used as `Authorization: Bearer <id_token>` on all subsequent calls.

### Step 2 — Redshift reference data

Four fast queries:
1. `rel_business_customer_monitoring` → all (business_id, customer_id, client_name) for the date range
2. `core_naics_code` → {code: label} lookup dict
3. `core_mcc_code` → {code: label} lookup dict
4. `rel_naics_mcc JOIN core_naics_code JOIN core_mcc_code` → set of (naics_code, mcc_code) canonical pairs

All data loaded into Python dicts/sets once. Applied to every business locally.

### Step 3 — SQLite initialization

Creates the four tables and all indexes if they don't exist. On subsequent runs, the schema is unchanged — only rows are added/replaced.

### Step 4 — Parallel API fetch

```python
with ThreadPoolExecutor(max_workers=20) as pool:
    futures = {pool.submit(_fetch_one, biz): biz for biz in businesses}
    for future in as_completed(futures):
        biz, facts_data = future.result()
        # Build fact_rows, alt_rows, biz_row
        # Accumulate in lists
```

Each `_fetch_one()` call fetches `GET /facts/business/{id}/all` and returns the raw JSON dict. Processing (enrichment, signals, change detection) happens in the main thread after the API call returns.

**Progress output:**
```
  [████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░] 1,203/2,706 (44%) | errors: 2 | ETA: 87s
```

### Step 5 — SQLite write

```python
mark_previous_snapshots(conn, snapshot_date)  # is_latest=0 for all old rows
upsert_facts(conn, all_fact_rows)             # INSERT OR REPLACE in batches of 1,000
upsert_alts(conn, all_alt_rows)
upsert_businesses(conn, all_biz_rows)
set_latest_snapshot(conn, snapshot_date)      # is_latest=1 for new rows
prune_old_snapshots(conn, keep=8)             # delete snapshots older than 8 weeks
```

Final output:
```
✅ Cache refresh complete!
   Snapshot:   2026-04-30T22:15:43
   Businesses: 8,247
   Fact rows:  329,880
   Alt rows:   1,847,320
   Changed:    143 NAICS | 89 MCC
   DB size:    312.4 MB
   Duration:   584s (9.7 min)
```

---

## Historical Snapshots and Change Detection

Every weekly run adds a new snapshot. The `is_latest` flag always points to the most recent one.

To compare two weeks:
```python
from db.sqlite_queries import get_snapshot_comparison
df = get_snapshot_comparison(fact_name="naics_code", client_name="Wholesale")
# Returns businesses where naics_code or platform changed between the two most recent snapshots
```

To see all businesses where NAICS changed this week:
```python
from db.sqlite_queries import get_changed_businesses
df = get_changed_businesses(client_name="WindRiver", field="naics")
# Columns: client_name, business_id, new_value, old_value, platform_id, updated_at, signals
```

Up to **8 snapshots** are kept (~2 months of weekly history). Older ones are pruned automatically.

---

## The App — How It Uses the Cache

### Sidebar indicator

The sidebar shows the cache status on every page:

```
🗄️ Local Cache Active
Data as of: 2026-04-30 22:15
8,247 businesses
```

or if no cache exists:

```
📡 No Local Cache
Reading live from Redshift
Run the refresh script to build cache
```

### Page query routing

Every analysis page in the app checks for the cache first. When the cache exists, it reads from SQLite. When it doesn't, it falls back to Redshift:

```python
from db.cache_manager import cache_available
from db.sqlite_queries import get_platform_winners
from db.queries import load_platform_winners  # Redshift fallback

if cache_available():
    df = get_platform_winners("naics_code", client_name=client_filter)
else:
    df = load_platform_winners("naics_code", f_from, f_to, f_cust)
```

The SQLite query functions in `db/sqlite_queries.py` return DataFrames with the same column names as the Redshift equivalents, so pages require no logic changes.

---

## Running the Refresh

### Full refresh (all clients, default 90-day window)
```bash
cd Admin-Portal-KYB-App/naics_mcc_explorer
python3 scripts/refresh_facts_cache.py
```

### Single client test (fast, good for first run)
```bash
python3 scripts/refresh_facts_cache.py --client "Ironwood"
# Ironwood has ~11 businesses — completes in ~5 seconds
```

### Custom date range
```bash
python3 scripts/refresh_facts_cache.py --date-from 2026-01-01 --date-to 2026-04-30
```

### Slower (fewer parallel workers — reduces API load)
```bash
python3 scripts/refresh_facts_cache.py --workers 5
```

### Dry run (fetch without writing to SQLite)
```bash
python3 scripts/refresh_facts_cache.py --dry-run
```

### Weekly schedule (macOS cron — every Monday at 9am)
```bash
crontab -e
# Add:
0 9 * * 1 cd /path/to/Admin-Portal-KYB-App/naics_mcc_explorer && python3 scripts/refresh_facts_cache.py >> logs/cache_refresh.log 2>&1
```

---

## Credentials Setup

The script reads from `.streamlit/secrets.toml` (the same file used by the Streamlit app):

```toml
WORTH_EMAIL    = "your.email@worthai.com"
WORTH_PASSWORD = "yourpassword"
WORTH_API_BASE = "https://api.joinworth.com/integration/api/v1"
```

Redshift credentials are hardcoded as defaults in `get_redshift_conn()` (matching the existing `db/connection.py` pattern). They can be overridden via the same `secrets.toml` keys used by the app (`REDSHIFT_DB`, `REDSHIFT_USER`, etc.).

---

## Cost

**Essentially zero.** The `/facts/business/{id}/all` endpoint calls Worth AI's own internal API — not any paid external vendor. The cost is AWS infrastructure only:
- API Gateway: ~$0.001/month (8,000 calls/week)
- RDS reads: $0 marginal (fixed instance cost)
- No ZoomInfo, Equifax, Middesk, or OpenAI calls — those already ran when the facts were originally computed

---

*Document prepared April 30, 2026. Cache system implemented in `db/cache_manager.py`, `db/sqlite_queries.py`, and `scripts/refresh_facts_cache.py`.*
