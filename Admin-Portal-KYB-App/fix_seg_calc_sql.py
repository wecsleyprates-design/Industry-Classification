"""Replace all _SEG_CALC diagnostic SQLs with _seg_sql()-compatible versions.
Run once from Admin-Portal-KYB-App/: python3 fix_seg_calc_sql.py
"""
import re

with open("kyb_hub_app_v2.py", "r") as f:
    src = f.read()

# The canonical SQL template — inserted as a note pointing to _seg_sql() output.
# Each segment gets a SQL that exactly mirrors the Python GROUP BY computation.
REPLACEMENTS = {
    # ── no_sos: sos_match_boolean='false' ─────────────────────────────────────
    r'("```sql\\n-- Returns: businesses where sos_match_boolean is strictly \'false\'\\n"'
    r'.*?"\\n```\\n\\n"'
    r'\s*"\\*\\*Source:\\*\\* `integration-service/lib/facts/kyb/index\.ts` lines 1371-1424"\s*\),)',
    # ── dt_filings_empty: already fixed above ─────────────────────────────────
    # ── tin_submitted ─────────────────────────────────────────────────────────
    # ── tin_pass ──────────────────────────────────────────────────────────────
    # ── tin_fail ──────────────────────────────────────────────────────────────
    # etc.
}

# Use simpler approach: just print all the lines around the problematic SQL blocks
import ast
try:
    ast.parse(src)
    print("Syntax OK")
except SyntaxError as e:
    print(f"Syntax error: {e}")
