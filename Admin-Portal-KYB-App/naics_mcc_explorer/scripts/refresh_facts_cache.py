#!/usr/bin/env python3
"""Weekly refresh script for facts_cache.sqlite.

Fetches all NAICS/MCC facts for every business from the Worth AI API,
enriches with Redshift lookup data, and writes to a local SQLite database.

Usage:
    cd Admin-Portal-KYB-App/naics_mcc_explorer
    python3 scripts/refresh_facts_cache.py

Options (environment variables or command-line):
    --date-from    YYYY-MM-DD   (default: 90 days ago)
    --date-to      YYYY-MM-DD   (default: today)
    --client       "Wholesale"  (default: all paying clients)
    --workers      N            (default: 20 concurrent API calls)
    --keep         N            (default: keep 8 snapshots ~2 months)
    --dry-run                   (fetch but don't save)

Credentials: read from .streamlit/secrets.toml (WORTH_EMAIL, WORTH_PASSWORD)

Output: facts_cache.sqlite in the naics_mcc_explorer/ folder
"""
from __future__ import annotations

import sys
import os
import json
import time
import argparse
import sqlite3
import re
from datetime import datetime, date, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
_DIR = Path(__file__).parent.parent  # naics_mcc_explorer/
sys.path.insert(0, str(_DIR))

import requests

# ── Streamlit secrets loader (outside of Streamlit context) ──────────────────
def _load_secrets() -> dict:
    """Load from .streamlit/secrets.toml without requiring Streamlit."""
    secrets_path = _DIR / ".streamlit" / "secrets.toml"
    if not secrets_path.exists():
        raise FileNotFoundError(
            f"secrets.toml not found at {secrets_path}\n"
            "Create it with:\n"
            "  WORTH_EMAIL    = 'your@email.com'\n"
            "  WORTH_PASSWORD = 'yourpassword'\n"
            "  WORTH_API_BASE = 'https://api.joinworth.com/integration/api/v1'"
        )
    secrets = {}
    with open(secrets_path) as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                key, _, val = line.partition("=")
                secrets[key.strip()] = val.strip().strip('"').strip("'")
    return secrets


# ── Constants ──────────────────────────────────────────────────────────────────
AUTH_BASE = "https://api.joinworth.com/auth/api/v1"
FACTS_OF_INTEREST = {
    "naics_code", "naics_description",
    "mcc_code", "mcc_code_found", "mcc_code_from_naics", "mcc_description",
    "industry", "classification_codes",
    "sos_match_boolean", "sos_active", "formation_state",
    "tin_match_boolean", "idv_passed_boolean",
    "watchlist_hits", "num_bankruptcies", "num_judgements", "num_liens",
    "is_sole_prop", "worth_score",
}

PLATFORM_NAMES = {
    "-1": "Calculated / Dependent",
    "0":  "Applicant Entry",
    "1":  "Plaid Banking",
    "4":  "Verdata",
    "16": "Middesk",
    "17": "Equifax",
    "18": "Plaid IDV",
    "21": "Manual Upload",
    "22": "SERP Scrape",
    "23": "OpenCorporates",
    "24": "ZoomInfo",
    "31": "AI NAICS Enrichment",
    "36": "AI Website Enrichment",
    "38": "Trulioo",
    "39": "SERP Google Profile",
    "40": "Plaid / KYX",
    "42": "Trulioo PSC",
}

NAICS_CATCHALL = {"561499"}
MCC_CATCHALL   = {"7399"}
MCC_INVALID    = {"5614"}


# ── Auth ───────────────────────────────────────────────────────────────────────
def get_admin_token(secrets: dict) -> str:
    email    = secrets["WORTH_EMAIL"]
    password = secrets["WORTH_PASSWORD"]
    for endpoint in ["/admin/sign-in", "/customer/sign-in"]:
        resp = requests.post(
            f"{AUTH_BASE}{endpoint}",
            json={"email": email, "password": password},
            timeout=15,
        )
        if resp.status_code == 200:
            token = resp.json().get("data", {}).get("id_token")
            if token:
                print(f"✓ Authenticated via {endpoint}")
                return token
    raise RuntimeError(f"Auth failed: {resp.status_code} — {resp.text[:200]}")


# ── Redshift helpers ───────────────────────────────────────────────────────────
def get_redshift_conn(secrets: dict):
    import psycopg2
    return psycopg2.connect(
        dbname   = secrets.get("REDSHIFT_DB",       "dev"),
        user     = secrets.get("REDSHIFT_USER",     "readonly_all_access"),
        password = secrets.get("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
        host     = secrets.get("REDSHIFT_HOST",
                                "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87."
                                "808338307022.us-east-1.redshift-serverless.amazonaws.com"),
        port     = int(secrets.get("REDSHIFT_PORT", "5439")),
        connect_timeout=15,
    )


def fetch_business_ids(rconn, date_from: str, date_to: str, client: str | None) -> list[dict]:
    """Get all (business_id, customer_id, client_name) from Redshift."""
    client_filter = f"AND bp.client = '{client.replace(chr(39), chr(39)*2)}'" if client else ""
    sql = f"""
        SELECT DISTINCT
            rbcm.business_id,
            rbcm.customer_id,
            COALESCE(bp.client, rbcm.customer_id) AS client_name
        FROM rds_cases_public.rel_business_customer_monitoring rbcm
        LEFT JOIN datascience.billing_prices bp
            ON bp.customer_id = rbcm.customer_id
            AND bp.client IS NOT NULL
        WHERE DATE(rbcm.created_at) BETWEEN '{date_from}' AND '{date_to}'
          {client_filter}
        ORDER BY client_name, rbcm.business_id
    """
    with rconn.cursor() as cur:
        cur.execute(sql)
        return [
            {"business_id": r[0], "customer_id": r[1], "client_name": r[2]}
            for r in cur.fetchall()
        ]


def fetch_naics_lookup(rconn) -> dict[str, str]:
    """Returns {code: label} for all NAICS codes."""
    with rconn.cursor() as cur:
        cur.execute("SELECT CAST(code AS VARCHAR), COALESCE(label,'') FROM rds_cases_public.core_naics_code WHERE code IS NOT NULL")
        return {str(r[0]).strip(): str(r[1]) for r in cur.fetchall()}


def fetch_mcc_lookup(rconn) -> dict[str, str]:
    """Returns {code: label} for all MCC codes."""
    with rconn.cursor() as cur:
        cur.execute("SELECT CAST(code AS VARCHAR), COALESCE(label,'') FROM rds_cases_public.core_mcc_code WHERE code IS NOT NULL")
        return {str(r[0]).strip(): str(r[1]) for r in cur.fetchall()}


def fetch_canonical_pairs(rconn) -> set[tuple[str, str]]:
    """Returns set of (naics_code, mcc_code) canonical pairs."""
    with rconn.cursor() as cur:
        cur.execute("""
            SELECT DISTINCT CAST(nc.code AS VARCHAR), CAST(mc.code AS VARCHAR)
            FROM rds_cases_public.rel_naics_mcc r
            JOIN rds_cases_public.core_naics_code nc ON nc.id = r.naics_id
            JOIN rds_cases_public.core_mcc_code   mc ON mc.id = r.mcc_id
            WHERE nc.code IS NOT NULL AND mc.code IS NOT NULL
        """)
        return {(str(r[0]).strip(), str(r[1]).strip()) for r in cur.fetchall()}


def fetch_sector_lookup(rconn) -> dict[str, str]:
    """Returns {sector_code: sector_name} for 2-digit NAICS sectors."""
    try:
        with rconn.cursor() as cur:
            cur.execute("SELECT CAST(sector_code AS VARCHAR), name FROM rds_cases_public.core_business_industries WHERE sector_code IS NOT NULL")
            return {str(r[0]).strip(): str(r[1]) for r in cur.fetchall()}
    except Exception:
        return {}


# ── API fetch ──────────────────────────────────────────────────────────────────
def fetch_business_facts(business_id: str, token: str, api_base: str) -> dict | None:
    """GET /facts/business/{id}/details — same endpoint as the Admin Portal.

    Source confirmed from Admin Portal frontend:
      microsites-main/packages/case/src/services/api/integration.service.ts:390
      getFactsBusinessDetails(): api.get(`/facts/business/${businessId}/details`)

    Returns the full fact picture for a business — same JSON structure
    shown in the Admin Portal: value, source, schema, dependencies,
    description, ruleApplied, isNormalized, override, alternatives[].
    """
    url = f"{api_base}/facts/business/{business_id}/details"
    try:
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            return data
        return None
    except Exception:
        return None


# ── Validation helpers ─────────────────────────────────────────────────────────
def validate_naics(value: str | None) -> str:
    if not value or str(value).strip() in ("", "None", "null"):
        return "null"
    v = str(value).strip()
    if not re.fullmatch(r"\d{6}", v):
        return "invalid_format"
    if v in NAICS_CATCHALL:
        return "catch_all"
    return "valid"  # lookup check skipped here (done via canonical check)


def validate_mcc(value: str | None) -> str:
    if not value or str(value).strip() in ("", "None", "null"):
        return "null"
    v = str(value).strip()
    if v in MCC_INVALID:
        return "known_invalid"
    if v in MCC_CATCHALL:
        return "catch_all"
    return "valid"


def parse_source(src) -> tuple[str, str, float | None, str]:
    """Returns (platform_id, platform_name, confidence, updated_at)."""
    if src is None:
        return ("", "", None, "")
    if isinstance(src, dict):
        pid  = str(src.get("platformId", "")).strip()
        name = src.get("name", "") or PLATFORM_NAMES.get(pid, "")
        conf = src.get("confidence")
        ts   = src.get("updatedAt", "") or ""
        return (pid, name, float(conf) if conf is not None else None, ts)
    pid = str(src).strip()
    return (pid, PLATFORM_NAMES.get(pid, f"Platform {pid}"), None, "")


def compute_signals(naics_val, winning_pid, alts: list[dict]) -> str:
    """Compute pipe-separated signal flags for a business's naics_code fact."""
    signals = []
    v = str(naics_val or "").strip()
    VENDOR_PIDS = {"17", "22", "24"}

    vendor_alts    = [a for a in alts if str(a.get("alt_platform_id","")) in VENDOR_PIDS]
    vendor_values  = [str(a["alt_value"]).strip() for a in vendor_alts if a.get("alt_value")]
    vendor_sectors = {vv[:2] for vv in vendor_values if len(vv) >= 2}

    if not v or v in ("None", "null", ""):
        signals.append("S1:null_winner")
    elif not re.fullmatch(r"\d{6}", v):
        signals.append("S2:format_error")

    if v in NAICS_CATCHALL:
        signals.append("S3:catchall_winner")

    if winning_pid == "0" and vendor_values and v not in vendor_values:
        signals.append("S4:ghost_override")

    winning_sector = v[:2] if len(v) >= 2 else ""
    if vendor_sectors and winning_sector and winning_sector not in vendor_sectors:
        signals.append("S5:sector_mismatch")

    from collections import Counter
    if len(vendor_values) >= 2:
        mc = Counter(vendor_values).most_common(1)[0]
        if mc[1] >= 2 and mc[0] != v:
            signals.append("S6:vendor_consensus_ignored")

    if v in NAICS_CATCHALL and any(
        vv not in NAICS_CATCHALL and re.fullmatch(r"\d{6}", vv) for vv in vendor_values
    ):
        signals.append("S7:catchall_w_specific_alt")

    return "|".join(signals)


# ── Row builders ───────────────────────────────────────────────────────────────
def build_fact_rows(
    biz: dict, facts_data: dict, snapshot_date: str,
    naics_lookup: dict, mcc_lookup: dict,
    canonical_pairs: set, sector_lookup: dict,
    prev_facts: dict,
) -> tuple[list[dict], list[dict]]:
    """Build (fact_rows, alt_rows) from the API response for one business."""
    fact_rows = []
    alt_rows  = []

    for fact_name, fact_obj in facts_data.items():
        if not isinstance(fact_obj, dict):
            continue
        if fact_name not in FACTS_OF_INTEREST:
            continue

        val     = fact_obj.get("value")
        src     = fact_obj.get("source")
        alts    = fact_obj.get("alternatives") or []
        rule    = (fact_obj.get("ruleApplied") or {}).get("name", "")

        pid, pname, conf, ts = parse_source(src)

        val_str  = str(val).strip() if val is not None else ""

        # Enrichment
        naics_desc = mcc_desc = ""
        sector_code = sector_name = ""
        if fact_name == "naics_code":
            naics_desc  = naics_lookup.get(val_str, "")
            sector_code = val_str[:2] if len(val_str) >= 2 else ""
            sector_name = sector_lookup.get(sector_code, "")
        elif fact_name in ("mcc_code", "mcc_code_found", "mcc_code_from_naics"):
            mcc_desc = mcc_lookup.get(val_str, "")

        # Validity
        naics_v = validate_naics(val_str) if fact_name == "naics_code" else ""
        mcc_v   = validate_mcc(val_str) if "mcc" in fact_name else ""

        # Canonical pair (only meaningful for naics_code)
        naics_code = val_str if fact_name == "naics_code" else ""
        mcc_code   = ""
        is_canon   = 0

        # Alternatives
        parsed_alts = []
        for a in alts:
            a_src = a.get("source", {})
            a_val = a.get("value")
            a_pid, a_pname, a_conf, a_ts = parse_source(a_src)
            parsed_alts.append({
                "alt_platform_id":   a_pid,
                "alt_platform_name": a_pname,
                "alt_value":         str(a_val).strip() if a_val is not None else "",
                "alt_confidence":    float(a_conf) if a_conf is not None else None,
                "alt_updated_at":    a_ts,
            })

        # Change detection
        prev = prev_facts.get((biz["business_id"], fact_name), {})
        prev_val = prev.get("value", "")
        prev_pid = prev.get("platform_id", "")
        val_changed  = int(bool(prev_val) and val_str != prev_val)
        pid_changed  = int(bool(prev_pid) and pid != prev_pid)

        fact_rows.append({
            "business_id":           biz["business_id"],
            "customer_id":           biz["customer_id"],
            "client_name":           biz["client_name"],
            "fact_name":             fact_name,
            "snapshot_date":         snapshot_date,
            "is_latest":             1,
            "winning_value":         val_str or None,
            "winning_platform_id":   pid or None,
            "winning_platform_name": pname or None,
            "winning_confidence":    conf,
            "winner_updated_at":     ts or None,
            "rule_applied":          rule or None,
            "naics_description":     naics_desc or None,
            "mcc_description":       mcc_desc or None,
            "industry_sector_code":  sector_code or None,
            "industry_sector_name":  sector_name or None,
            "naics_validity":        naics_v or None,
            "mcc_validity":          mcc_v or None,
            "is_canonical_pair":     is_canon,
            "prev_winning_value":    prev_val or None,
            "prev_winning_platform_id": prev_pid or None,
            "value_changed":         val_changed,
            "platform_changed":      pid_changed,
            "alternatives_json":     json.dumps(parsed_alts),
            "fetched_at":            datetime.utcnow().isoformat(),
        })

        for i, a in enumerate(parsed_alts):
            alt_rows.append({
                "business_id":     biz["business_id"],
                "fact_name":       fact_name,
                "snapshot_date":   snapshot_date,
                "is_latest":       1,
                "alt_rank":        i,
                **a,
            })

    return fact_rows, alt_rows


def build_business_row(
    biz: dict, facts_data: dict, fact_rows: list[dict],
    snapshot_date: str, naics_lookup: dict, mcc_lookup: dict,
    canonical_pairs: set, sector_lookup: dict, prev_businesses: dict,
) -> dict:
    """Build the businesses summary row from fact rows for this business."""
    def _get(fact_name, field="winning_value"):
        for r in fact_rows:
            if r["fact_name"] == fact_name:
                return r.get(field)
        return None

    naics_val  = _get("naics_code")
    mcc_val    = _get("mcc_code")
    naics_pid  = _get("naics_code", "winning_platform_id")
    naics_pname= _get("naics_code", "winning_platform_name")
    naics_conf = _get("naics_code", "winning_confidence")
    naics_ts   = _get("naics_code", "winner_updated_at")
    mcc_pid    = _get("mcc_code",   "winning_platform_id")
    mcc_pname  = _get("mcc_code",   "winning_platform_name")
    mcc_conf   = _get("mcc_code",   "winning_confidence")
    mcc_ts     = _get("mcc_code",   "winner_updated_at")

    naics_v_str   = str(naics_val or "").strip()
    mcc_v_str     = str(mcc_val or "").strip()
    sector_code   = naics_v_str[:2] if len(naics_v_str) >= 2 else ""
    sector_name   = sector_lookup.get(sector_code, "")
    naics_validity= validate_naics(naics_v_str)
    mcc_validity  = validate_mcc(mcc_v_str)
    is_canon      = int((naics_v_str, mcc_v_str) in canonical_pairs) if naics_v_str and mcc_v_str else 0

    # Signals (from naics_code alternatives)
    naics_alts_json = _get("naics_code", "alternatives_json")
    naics_alts = json.loads(naics_alts_json) if naics_alts_json else []
    signals = compute_signals(naics_v_str, naics_pid or "", naics_alts)

    # Change detection
    prev = prev_businesses.get(biz["business_id"], {})
    naics_changed   = int(bool(prev.get("naics_code")) and naics_v_str != prev["naics_code"])
    mcc_changed     = int(bool(prev.get("mcc_code")) and mcc_v_str != prev["mcc_code"])
    plat_changed    = int(bool(prev.get("naics_platform_id")) and (naics_pid or "") != prev["naics_platform_id"])

    return {
        "business_id":          biz["business_id"],
        "customer_id":          biz["customer_id"],
        "client_name":          biz["client_name"],
        "snapshot_date":        snapshot_date,
        "is_latest":            1,
        "naics_code":           naics_v_str or None,
        "naics_description":    naics_lookup.get(naics_v_str, "") or None,
        "naics_platform_id":    naics_pid,
        "naics_platform_name":  naics_pname,
        "naics_confidence":     naics_conf,
        "naics_updated_at":     naics_ts,
        "naics_validity":       naics_validity,
        "naics_sector_code":    sector_code or None,
        "naics_sector_name":    sector_name or None,
        "mcc_code":             mcc_v_str or None,
        "mcc_description":      mcc_lookup.get(mcc_v_str, "") or None,
        "mcc_code_found":       _get("mcc_code_found"),
        "mcc_code_from_naics":  _get("mcc_code_from_naics"),
        "mcc_platform_id":      mcc_pid,
        "mcc_platform_name":    mcc_pname,
        "mcc_confidence":       mcc_conf,
        "mcc_updated_at":       mcc_ts,
        "mcc_validity":         mcc_validity,
        "is_canonical_pair":    is_canon,
        "signals":              signals or None,
        "naics_changed":        naics_changed,
        "mcc_changed":          mcc_changed,
        "naics_platform_changed": plat_changed,
        "prev_naics_code":      prev.get("naics_code"),
        "prev_mcc_code":        prev.get("mcc_code"),
        "prev_naics_platform_id": prev.get("naics_platform_id"),
        "fetched_at":           datetime.utcnow().isoformat(),
    }


# ── SQLite insert helpers ──────────────────────────────────────────────────────
def upsert_facts(conn, rows: list[dict]) -> None:
    if not rows: return
    keys = list(rows[0].keys())
    placeholders = ",".join("?" * len(keys))
    sql = f"INSERT OR REPLACE INTO facts ({','.join(keys)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(r[k] for k in keys) for r in rows])


def upsert_alts(conn, rows: list[dict]) -> None:
    if not rows: return
    keys = list(rows[0].keys())
    placeholders = ",".join("?" * len(keys))
    sql = f"INSERT OR REPLACE INTO alternatives ({','.join(keys)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(r[k] for k in keys) for r in rows])


def upsert_businesses(conn, rows: list[dict]) -> None:
    if not rows: return
    keys = list(rows[0].keys())
    placeholders = ",".join("?" * len(keys))
    sql = f"INSERT OR REPLACE INTO businesses ({','.join(keys)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(r[k] for k in keys) for r in rows])


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Refresh the NAICS/MCC facts cache")
    parser.add_argument("--date-from",  default=str(date.today() - timedelta(days=90)))
    parser.add_argument("--date-to",    default=str(date.today()))
    parser.add_argument("--client",     default=None, help="Filter to one client name")
    parser.add_argument("--workers",    type=int, default=20)
    parser.add_argument("--keep",       type=int, default=8, help="Snapshots to keep")
    parser.add_argument("--dry-run",    action="store_true")
    args = parser.parse_args()

    start = time.time()
    snapshot_date = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"NAICS/MCC Facts Cache Refresh")
    print(f"Snapshot: {snapshot_date}")
    print(f"Date range: {args.date_from} → {args.date_to}")
    print(f"Client filter: {args.client or 'All paying clients'}")
    print(f"Parallel workers: {args.workers}")
    print(f"{'='*60}\n")

    # ── Load credentials ──────────────────────────────────────────────────────
    secrets = _load_secrets()
    api_base = secrets.get("WORTH_API_BASE", "https://api.joinworth.com/integration/api/v1")

    # ── Authenticate ──────────────────────────────────────────────────────────
    print("Step 1/5 — Authenticating with Worth AI API...")
    token = get_admin_token(secrets)

    # ── Fetch reference data from Redshift ─────────────────────────────────────
    print("Step 2/5 — Loading reference data from Redshift...")
    rconn = get_redshift_conn(secrets)
    businesses  = fetch_business_ids(rconn, args.date_from, args.date_to, args.client)
    naics_lookup  = fetch_naics_lookup(rconn)
    mcc_lookup    = fetch_mcc_lookup(rconn)
    canonical_pairs = fetch_canonical_pairs(rconn)
    sector_lookup   = fetch_sector_lookup(rconn)
    rconn.close()
    print(f"  ✓ {len(businesses):,} businesses | {len(naics_lookup):,} NAICS codes | {len(mcc_lookup):,} MCC codes | {len(canonical_pairs):,} canonical pairs")

    if not businesses:
        print("No businesses found for the selected filters. Exiting.")
        return

    # ── Initialize SQLite ──────────────────────────────────────────────────────
    from db.cache_manager import (
        initialize_db, get_conn, CACHE_DB_STR,
        mark_previous_snapshots, set_latest_snapshot, prune_old_snapshots,
        get_previous_fact_values, get_previous_business_values,
    )
    print(f"Step 3/5 — Initializing SQLite: {CACHE_DB_STR}")
    initialize_db()
    sqlite_conn = get_conn()

    # Load previous snapshot for change detection
    print("  Loading previous snapshot for change detection...")
    prev_facts      = get_previous_fact_values(sqlite_conn, snapshot_date)
    prev_businesses = get_previous_business_values(sqlite_conn, snapshot_date)
    print(f"  ✓ {len(prev_facts):,} previous fact values loaded")

    # ── Fetch facts from API ──────────────────────────────────────────────────
    print(f"\nStep 4/5 — Fetching facts from API ({args.workers} workers)...")
    total   = len(businesses)
    done    = 0
    errors  = 0
    all_fact_rows = []
    all_alt_rows  = []
    all_biz_rows  = []

    def _fetch_one(biz: dict):
        facts_data = fetch_business_facts(biz["business_id"], token, api_base)
        return biz, facts_data

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(_fetch_one, b): b for b in businesses}
        for future in as_completed(futures):
            done += 1
            biz, facts_data = future.result()

            if facts_data is None:
                errors += 1
            else:
                fact_rows, alt_rows = build_fact_rows(
                    biz, facts_data, snapshot_date,
                    naics_lookup, mcc_lookup, canonical_pairs, sector_lookup,
                    prev_facts,
                )
                biz_row = build_business_row(
                    biz, facts_data, fact_rows, snapshot_date,
                    naics_lookup, mcc_lookup, canonical_pairs, sector_lookup,
                    prev_businesses,
                )
                all_fact_rows.extend(fact_rows)
                all_alt_rows.extend(alt_rows)
                all_biz_rows.append(biz_row)

            # Progress bar
            pct  = done / total * 100
            bar  = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
            eta  = (time.time() - start) / done * (total - done) if done > 0 else 0
            print(f"\r  [{bar}] {done:,}/{total:,} ({pct:.0f}%) | errors: {errors} | ETA: {eta:.0f}s   ", end="", flush=True)

    print(f"\n  ✓ {done - errors:,} fetched | {errors} errors | {len(all_fact_rows):,} fact rows | {len(all_alt_rows):,} alternative rows")

    if args.dry_run:
        print("\n[DRY RUN] — not writing to database.")
        return

    # ── Write to SQLite ────────────────────────────────────────────────────────
    print("\nStep 5/5 — Writing to SQLite...")

    mark_previous_snapshots(sqlite_conn, snapshot_date)

    # Write in batches of 1000 to avoid memory spikes
    BATCH = 1000
    for i in range(0, len(all_fact_rows), BATCH):
        upsert_facts(sqlite_conn, all_fact_rows[i:i+BATCH])
    for i in range(0, len(all_alt_rows), BATCH):
        upsert_alts(sqlite_conn, all_alt_rows[i:i+BATCH])
    for i in range(0, len(all_biz_rows), BATCH):
        upsert_businesses(sqlite_conn, all_biz_rows[i:i+BATCH])

    set_latest_snapshot(sqlite_conn, snapshot_date)

    # Write cache_meta
    elapsed = time.time() - start
    sqlite_conn.execute(
        """INSERT OR REPLACE INTO cache_meta
           (snapshot_date, total_businesses, total_facts, total_alternatives,
            date_from_filter, date_to_filter, client_filter, refresh_duration_sec, api_endpoint)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (snapshot_date, len(all_biz_rows), len(all_fact_rows), len(all_alt_rows),
         args.date_from, args.date_to, args.client or "all",
         round(elapsed, 1), api_base),
    )
    sqlite_conn.commit()

    # Prune old snapshots
    prune_old_snapshots(sqlite_conn, keep=args.keep)
    sqlite_conn.close()

    db_size_mb = os.path.getsize(CACHE_DB_STR) / 1024 / 1024
    print(f"\n{'='*60}")
    print(f"✅ Cache refresh complete!")
    print(f"   Snapshot:   {snapshot_date}")
    print(f"   Businesses: {len(all_biz_rows):,}")
    print(f"   Fact rows:  {len(all_fact_rows):,}")
    print(f"   Alt rows:   {len(all_alt_rows):,}")
    print(f"   Changed:    {sum(1 for r in all_biz_rows if r['naics_changed']):,} NAICS | {sum(1 for r in all_biz_rows if r['mcc_changed']):,} MCC")
    print(f"   DB size:    {db_size_mb:.1f} MB")
    print(f"   Duration:   {elapsed:.0f}s ({elapsed/60:.1f} min)")
    print(f"   Location:   {CACHE_DB_STR}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
