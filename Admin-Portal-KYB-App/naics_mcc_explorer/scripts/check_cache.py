#!/usr/bin/env python3
"""Diagnostic script — run this to confirm the cache is working correctly.

Usage:
    cd Admin-Portal-KYB-App/naics_mcc_explorer
    python3 scripts/check_cache.py

This script prints:
  - The exact path where facts_cache.sqlite is expected
  - Whether the file exists and its size
  - The most recent snapshot date and business count
  - A sample of businesses from the cache
  - Confirmation that the app will read from it
"""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.cache_manager import CACHE_DB, CACHE_DB_STR, cache_exists, get_cache_meta, get_snapshot_dates

print("=" * 60)
print("NAICS/MCC Explorer — Cache Diagnostic")
print("=" * 60)
print()
print(f"Expected cache location:")
print(f"  {CACHE_DB_STR}")
print()

if not CACHE_DB.exists():
    print("❌ facts_cache.sqlite NOT FOUND at this location.")
    print()
    print("To build the cache, run:")
    print("  cd Admin-Portal-KYB-App/naics_mcc_explorer")
    print("  python3 scripts/refresh_facts_cache.py")
    print()
    print("Make sure you run the refresh script from the")
    print("naics_mcc_explorer/ folder — not from a parent directory.")
    sys.exit(1)

size_mb = CACHE_DB.stat().st_size / 1024 / 1024
print(f"✅ Cache file found: {size_mb:.1f} MB")
print()

meta = get_cache_meta()
if not meta:
    print("⚠️  Cache file exists but has no snapshots. Re-run the refresh script.")
    sys.exit(1)

print(f"Most recent snapshot:")
print(f"  Date:        {meta.get('snapshot_date','?')}")
print(f"  Businesses:  {meta.get('total_businesses',0):,}")
print(f"  Facts:       {meta.get('total_facts',0):,}")
print(f"  Alternatives:{meta.get('total_alternatives',0):,}")
print(f"  Duration:    {meta.get('refresh_duration_sec',0):.0f}s")
print(f"  Date range:  {meta.get('date_from_filter','?')} → {meta.get('date_to_filter','?')}")
print()

dates = get_snapshot_dates()
print(f"All snapshots: {dates}")
print()

# Sample businesses
try:
    from db.cache_manager import get_conn
    conn = get_conn()
    rows = conn.execute("""
        SELECT client_name, naics_code, mcc_code, naics_platform_id, naics_updated_at
        FROM businesses WHERE is_latest=1
        ORDER BY naics_updated_at DESC LIMIT 5
    """).fetchall()
    conn.close()
    print("Sample businesses (5 most recently updated):")
    print(f"  {'Client':<20} {'NAICS':<10} {'MCC':<8} {'Platform':<8} {'Updated At'}")
    print("  " + "-"*70)
    for r in rows:
        print(f"  {str(r[0]):<20} {str(r[1] or '—'):<10} {str(r[2] or '—'):<8} {str(r[3] or '—'):<8} {str(r[4] or '—')}")
except Exception as e:
    print(f"Could not query businesses: {e}")

print()
print("✅ The app will use this cache for all analysis pages.")
print("   The sidebar will show: 🗄️ Local Cache Active — Data as of [date]")
print()
print("If the app is NOT showing the cache indicator, make sure you are")
print("running 'streamlit run app.py' from the naics_mcc_explorer/ folder:")
print("  cd Admin-Portal-KYB-App/naics_mcc_explorer")
print("  streamlit run app.py")
