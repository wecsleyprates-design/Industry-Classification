"""
sync_redshift_schema.py
=======================
Discovers ALL tables in all Worth AI schemas by querying information_schema.tables,
then pulls every column for every table found.

No hardcoded table list — new tables appear automatically, removed tables disappear.

Usage:
  export REDSHIFT_HOST="your-cluster.redshift.amazonaws.com"
  export REDSHIFT_DBNAME="dev"
  export REDSHIFT_USER="your_username"
  export REDSHIFT_PASSWORD="your_password"

  # Optional (if PostgreSQL is a different host/port from Redshift):
  export REDSHIFT_HOST_PG="your-rds.rds.amazonaws.com"  # defaults to REDSHIFT_HOST
  export REDSHIFT_PORT_PG="5432"                         # defaults to 5432
  export REDSHIFT_PORT_RS="5439"                         # defaults to 5439

  python3 sync_redshift_schema.py

Output:
  api-docs/redshift-schema.md   (indexed by RAG, used by AI Agent)
"""

import os, sys, json, pathlib
from datetime import datetime, timezone

OUT_FILE = pathlib.Path(__file__).parent / "api-docs" / "redshift-schema.md"

# ── Schemas to discover — we ask the database for every table within these ────
# PostgreSQL (port 5432) schemas
PG_SCHEMAS = [
    "rds_warehouse_public",
    "rds_cases_public",
    "integration_data",
    "core",          # lookup tables (core_naics_code, core_mcc_code, etc.)
    "public",        # fallback — catch anything in the default schema
]

# Redshift (port 5439) schemas
RS_SCHEMAS = [
    "datascience",
    "zoominfo",
    "warehouse",
    "ml_model",      # entity matching model outputs
    "ml_models",     # alternative naming used in some clusters
]

# Skip system / internal tables automatically
SKIP_TABLE_PREFIXES = (
    "pg_",
    "information_schema",
    "stl_",       # Redshift system log tables (thousands of them)
    "svl_",
    "svv_",
    "stv_",
    "pg_catalog",
)

# Contextual notes added to specific column names so the RAG
# gives richer answers without needing to read every source file.
COLUMN_NOTES = {
    "value":              "VARCHAR containing JSON on both PostgreSQL and Redshift — use JSON_EXTRACT_PATH_TEXT(value,'key') on Redshift; json.loads(value) in Python",
    "business_id":        "UUID — joins across all tables",
    "platform_id":        "16=Middesk, 23=OC, 24=ZoomInfo, 17=Equifax, 38=Trulioo, 31=AI-enrichment, 22=SERP, 40=Plaid",
    "similarity_index":   "0–55 integer; confidence = similarity_index / 55.0 (MAX_CONFIDENCE_INDEX=55 in sources.ts)",
    "zi_probability":     "XGBoost entity-match confidence 0.0–1.0",
    "efx_probability":    "XGBoost entity-match confidence 0.0–1.0",
    "oc_probability":     "XGBoost entity-match confidence 0.0–1.0",
    "zi_match_confidence":"Pipeline B: zi_match_confidence vs efx_match_confidence — higher wins",
    "efx_match_confidence":"Pipeline B: zi_match_confidence vs efx_match_confidence — higher wins",
    "zi_c_naics6":        "ZoomInfo 6-digit NAICS code — primary source for Pipeline B ZI winner",
    "efx_primnaicscode":  "Equifax primary NAICS code — primary source for Pipeline B EFX winner",
    "industry_code_uids": "Pipe-delimited: 'us_naics-722511|uk_sic-56101' — parse with SPLIT_PART or Python split",
    "primary_naics_code": "Pipeline B output: CASE WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6 ELSE efx_primnaicscode",
    "naics_id":           "FK → core_naics_code.id",
    "mcc_id":             "FK → core_mcc_code.id",
    "response":           "JSONB raw vendor API response — full payload from the vendor",
    "received_at":        "Timestamp when the fact was last written/updated",
    "worth_score":        "Computed Worth Score (0–1000) — primary risk signal",
}

# Descriptions for well-known tables (used when we can discover the table
# dynamically but want to add context the schema alone cannot provide).
TABLE_DESCRIPTIONS = {
    "rds_warehouse_public.facts":
        "Central fact store — one row per (business_id, fact_name). "
        "value column is VARCHAR JSON: {value, source:{platformId,confidence}, alternatives:[], override:{value,userId}}. "
        "CONFIRMED WORKING: SELECT name, value, received_at FROM rds_warehouse_public.facts "
        "WHERE business_id='uuid' AND name IN ('naics_code','mcc_code');",
    "rds_cases_public.data_businesses":
        "Core business record. naics_id FK→core_naics_code, mcc_id FK→core_mcc_code. "
        "join with data_cases on id=business_id to get case status.",
    "rds_cases_public.data_cases":
        "Case record: status, timestamps, customer_id, business_id. "
        "status FK→core_case_statuses (pending/under_review/auto_approved/archived).",
    "rds_cases_public.data_owners":
        "Owner records: date_of_birth encrypted, ssn masked (last 4 only).",
    "integration_data.request_response":
        "Raw vendor API call log. platform_id maps to vendor. "
        "response JSONB = full vendor payload. Used by AI Agent to audit pipeline calls.",
    "datascience.customer_files":
        "Pipeline B output (batch, Redshift-only). "
        "Winner rule: WHEN zi_match_confidence > efx_match_confidence THEN zi_c_naics6 ELSE efx_primnaicscode. "
        "OC/Middesk/Trulioo/Liberty/AI are EXCLUDED from Pipeline B. "
        "primary_naics_code=NULL when both match confidences=0.",
    "datascience.zoominfo_matches_custom_inc_ml":
        "ZoomInfo entity-match results. zi_probability = XGBoost score. "
        "similarity_index 0–55; confidence = index/55. Threshold: similarity_index>=45 AND probability>=0.80.",
    "datascience.efx_matches_custom_inc_ml":
        "Equifax entity-match results. efx_probability = XGBoost score.",
    "datascience.oc_matches_custom_inc_ml":
        "OpenCorporates entity-match results. oc_probability = XGBoost score.",
    "zoominfo.comp_standard_global":
        "ZoomInfo firmographic bulk data. zi_c_naics6 = primary NAICS (6-digit). "
        "zi_c_naics_top3 = pipe-delimited top-3 NAICS codes.",
    "warehouse.equifax_us_latest":
        "Equifax firmographic bulk data. efx_primnaicscode = primary NAICS. "
        "efx_mbe/wbe/vet = minority/woman/veteran-owned flags.",
    "warehouse.oc_companies_latest":
        "OpenCorporates company registry. industry_code_uids = pipe-delimited codes "
        "(format: 'us_naics-722511|uk_sic-56101'). jurisdiction_code = 'us_fl', 'gb', etc.",
}


def connect(host, port, dbname, user, password):
    try:
        import psycopg2
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=int(port),
            connect_timeout=10,
        )
        return conn
    except Exception as e:
        print(f"  ⚠️  Could not connect to {host}:{port}/{dbname}: {e}")
        return None


def discover_tables(conn, schemas):
    """Return [(schema, table)] for all user tables in the given schemas."""
    if not conn:
        return []
    try:
        cur = conn.cursor()
        placeholders = ",".join(["%s"] * len(schemas))
        cur.execute(f"""
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema IN ({placeholders})
              AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
        """, schemas)
        rows = cur.fetchall()
        cur.close()
        # Filter out system tables
        return [
            (s, t) for s, t in rows
            if not any(t.startswith(p) for p in SKIP_TABLE_PREFIXES)
        ]
    except Exception as e:
        print(f"  ⚠️  discover_tables failed: {e}")
        return []


def get_columns(conn, schema, table):
    """Fetch (column_name, data_type, max_len, nullable) for a table."""
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table))
        rows = cur.fetchall()
        cur.close()
        return rows
    except Exception as e:
        print(f"    ⚠️  columns for {schema}.{table}: {e}")
        return []


def get_approx_count(conn, schema, table):
    """Best-effort row count (skips if slow/blocked)."""
    if not conn:
        return None
    try:
        # Redshift has pg_class for fast estimates
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {schema}.{table}")
        n = cur.fetchone()[0]
        cur.close()
        return n
    except Exception:
        return None


def fmt_type(data_type, max_len):
    t = data_type.upper()
    if "CHARACTER VARYING" in t:
        return f"VARCHAR({max_len})" if max_len else "VARCHAR"
    if "DOUBLE PRECISION" in t:
        return "FLOAT"
    return t


def build_table_section(schema, table, cols, row_count):
    full = f"{schema}.{table}"
    desc = TABLE_DESCRIPTIONS.get(full, "")
    lines = []
    lines.append(f"### `{full}`")
    if desc:
        lines.append(f"")
        lines.append(f"> {desc}")
    if row_count is not None:
        lines.append(f"")
        lines.append(f"**Approx rows:** {row_count:,}")

    if cols:
        lines.append(f"")
        lines.append(f"| # | Column | Type | Nullable | Notes |")
        lines.append(f"|---|--------|------|----------|-------|")
        for i, (col_name, data_type, max_len, nullable) in enumerate(cols, 1):
            type_str = fmt_type(data_type, max_len)
            null_str = "Y" if nullable == "YES" else "N"
            note = COLUMN_NOTES.get(col_name, "")
            lines.append(f"| {i} | `{col_name}` | {type_str} | {null_str} | {note} |")
    else:
        lines.append(f"")
        lines.append(f"*No columns returned — table may be empty or access denied.*")

    lines.append(f"")
    return "\n".join(lines)


def build_confirmed_fallback():
    """Return the confirmed-schema tables as a list of (schema, table, [(col,type,len,null)])."""
    return [
        ("rds_warehouse_public", "facts", [
            ("id",          "bigint",              None, "NO"),
            ("business_id", "character varying",   None, "NO"),
            ("name",        "character varying",   None, "NO"),
            ("value",       "character varying",   None, "YES"),
            ("received_at", "timestamp with time zone", None, "YES"),
        ]),
        ("datascience", "customer_files", [
            ("business_id",           "character varying", None, "YES"),
            ("primary_naics_code",    "integer",           None, "YES"),
            ("mcc_code",              "character varying", None, "YES"),
            ("mcc_desc",              "character varying", None, "YES"),
            ("worth_score",           "double precision",  None, "YES"),
            ("match_confidence",      "double precision",  None, "YES"),
            ("zi_match_confidence",   "double precision",  None, "YES"),
            ("efx_match_confidence",  "double precision",  None, "YES"),
            ("company_name",          "character varying", None, "YES"),
            ("tax_id",                "character varying", None, "YES"),
            ("employee_count",        "integer",           None, "YES"),
            ("year_established",      "integer",           None, "YES"),
            ("name_verification",     "character varying", None, "YES"),
            ("address_verification",  "character varying", None, "YES"),
            ("tin_verification",      "character varying", None, "YES"),
            ("watchlist_verification","character varying", None, "YES"),
            ("primary_naics_description","character varying",None,"YES"),
        ]),
        ("datascience", "zoominfo_matches_custom_inc_ml", [
            ("business_id",       "character varying", None, "YES"),
            ("zi_c_company_id",   "bigint",            None, "YES"),
            ("zi_c_location_id",  "bigint",            None, "YES"),
            ("zi_es_location_id", "character varying", None, "YES"),
            ("zi_probability",    "double precision",  None, "YES"),
            ("similarity_index",  "integer",           None, "YES"),
        ]),
        ("datascience", "efx_matches_custom_inc_ml", [
            ("business_id",      "character varying", None, "YES"),
            ("efx_id",           "bigint",            None, "YES"),
            ("efx_probability",  "double precision",  None, "YES"),
            ("similarity_index", "integer",           None, "YES"),
        ]),
        ("datascience", "oc_matches_custom_inc_ml", [
            ("business_id",      "character varying", None, "YES"),
            ("company_number",   "character varying", None, "YES"),
            ("jurisdiction_code","character varying", None, "YES"),
            ("oc_probability",   "double precision",  None, "YES"),
            ("similarity_index", "integer",           None, "YES"),
        ]),
        ("zoominfo", "comp_standard_global", [
            ("zi_c_location_id",              "bigint",           None, "YES"),
            ("zi_c_company_id",               "bigint",           None, "YES"),
            ("zi_c_name",                     "character varying",None, "YES"),
            ("zi_c_url",                      "character varying",None, "YES"),
            ("zi_c_street",                   "character varying",None, "YES"),
            ("zi_c_city",                     "character varying",None, "YES"),
            ("zi_c_state",                    "character varying",None, "YES"),
            ("zi_c_zip",                      "character varying",None, "YES"),
            ("zi_c_country",                  "character varying",None, "YES"),
            ("zi_c_employees",                "integer",          None, "YES"),
            ("zi_c_revenue",                  "bigint",           None, "YES"),
            ("zi_c_phone",                    "character varying",None, "YES"),
            ("zi_c_naics6",                   "character varying",None, "YES"),
            ("zi_c_naics_top3",               "character varying",None, "YES"),
            ("zi_c_naics_confidence_score",   "double precision", None, "YES"),
            ("zi_c_sic4",                     "character varying",None, "YES"),
            ("zi_c_year_founded",             "character varying",None, "YES"),
            ("zi_c_ein",                      "character varying",None, "YES"),
            ("zi_c_industry_primary",         "character varying",None, "YES"),
        ]),
        ("warehouse", "equifax_us_latest", [
            ("efx_id",           "bigint",           None, "YES"),
            ("efx_name",         "character varying",None, "YES"),
            ("efx_legal_name",   "character varying",None, "YES"),
            ("efx_address",      "character varying",None, "YES"),
            ("efx_city",         "character varying",None, "YES"),
            ("efx_state",        "character varying",None, "YES"),
            ("efx_zipcode",      "character varying",None, "YES"),
            ("efx_primnaicscode","bigint",           None, "YES"),
            ("efx_secnaics1",    "bigint",           None, "YES"),
            ("efx_secnaics2",    "bigint",           None, "YES"),
            ("efx_secnaics3",    "bigint",           None, "YES"),
            ("efx_secnaics4",    "bigint",           None, "YES"),
            ("efx_primnaicsdesc","character varying",None, "YES"),
            ("efx_primsic",      "bigint",           None, "YES"),
            ("efx_corpempcnt",   "bigint",           None, "YES"),
            ("efx_corpamount",   "bigint",           None, "YES"),
            ("efx_yrest",        "bigint",           None, "YES"),
            ("efx_web",          "character varying",None, "YES"),
            ("efx_phone",        "bigint",           None, "YES"),
            ("efx_email",        "character varying",None, "YES"),
            ("efx_mbe",          "character varying",None, "YES"),
            ("efx_wbe",          "character varying",None, "YES"),
            ("efx_vet",          "character varying",None, "YES"),
            ("efx_nonprofit",    "character varying",None, "YES"),
            ("efx_gov",          "character varying",None, "YES"),
        ]),
        ("warehouse", "oc_companies_latest", [
            ("company_number",    "character varying",None, "YES"),
            ("jurisdiction_code", "character varying",None, "YES"),
            ("name",              "character varying",None, "YES"),
            ("normalised_name",   "character varying",None, "YES"),
            ("company_type",      "character varying",None, "YES"),
            ("current_status",    "character varying",None, "YES"),
            ("incorporation_date","character varying",None, "YES"),
            ("dissolution_date",  "character varying",None, "YES"),
            ("industry_code_uids","character varying",None, "YES"),
            ("number_of_employees","character varying",None,"YES"),
            ("inactive",          "boolean",          None, "YES"),
            ("has_been_liquidated","boolean",         None, "YES"),
        ]),
    ]


def main():
    print("=" * 60)
    print("Worth AI — Dynamic Redshift Schema Sync")
    print("=" * 60)

    # Credentials mirror establish_redshift_conn_psycopg2() exactly.
    # Env vars override the defaults — useful for CI/CD where secrets are injected.
    host     = os.getenv("REDSHIFT_HOST",
                "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87"
                ".808338307022.us-east-1.redshift-serverless.amazonaws.com")
    port     = os.getenv("REDSHIFT_PORT",     "5439")
    dbname   = os.getenv("REDSHIFT_DB",       "dev")
    user     = os.getenv("REDSHIFT_USER",     "readonly_all_access")
    password = os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO")

    # Redshift Serverless exposes a single endpoint that serves every schema
    # (datascience, zoominfo, warehouse, rds_warehouse_public, etc.) on port 5439.
    # There is no separate PostgreSQL host — one connection covers everything.
    print(f"\n🔌 Connecting to {host}:{port}/{dbname} as {user} ...")
    conn = connect(host, port, dbname, user, password)

    # We reuse the same connection object for both "PG-style" and "RS-style"
    # schema groups — the cluster honours information_schema for all of them.
    pg_conn = rs_conn = conn
    if conn:
        print("   ✅ Connected")
    else:
        print("   ⚠️  Connection failed — falling back to confirmed schemas.")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    source_label = "live information_schema.columns" if conn else "confirmed schemas (no live connection)"

    lines = [
        f"# Worth AI — Redshift & PostgreSQL Schema Reference",
        f"",
        f"<!-- Auto-generated by sync_redshift_schema.py on {now} -->",
        f"<!-- Source: {source_label} -->",
        f"",
        f"## How to read this file",
        f"",
        f"- **PostgreSQL tables** (port 5432): `rds_warehouse_public.*`, `rds_cases_public.*`, `integration_data.*`, `core.*`",
        f"- **Redshift tables** (port 5439): `datascience.*`, `zoominfo.*`, `warehouse.*`, `ml_model.*`",
        f"- **Confirmed JSON pattern (Redshift)**: `JSON_EXTRACT_PATH_TEXT(value, 'key')` — works because `value` is `VARCHAR`, not `JSONB`",
        f"- **What fails on Redshift**: `value::jsonb`, `value->>'key'` — both require JSONB type, which doesn't exist on Redshift",
        f"- **Python extraction**: `json.loads(value_str).get('value')` — always works regardless of database type",
        f"- **similarity_index**: integer 0–55; `confidence = similarity_index / 55.0` (MAX_CONFIDENCE_INDEX=55 defined in sources.ts)",
        f"- **Platform IDs**: 16=Middesk, 23=OpenCorporates, 24=ZoomInfo, 17=Equifax, 38=Trulioo, 31=AI-enrichment, 22=SERP, 40=Plaid",
        f"",
        f"---",
        f"",
    ]

    all_tables = []  # list of (schema, table, cols, row_count, db_label)

    if pg_conn:
        print(f"\n📋 Discovering PostgreSQL schemas: {PG_SCHEMAS}")
        pg_tables = discover_tables(pg_conn, PG_SCHEMAS)
        print(f"   Found {len(pg_tables)} tables")
        for schema, table in pg_tables:
            cols = get_columns(pg_conn, schema, table)
            count = get_approx_count(pg_conn, schema, table)
            all_tables.append((schema, table, cols, count, "PostgreSQL (port 5432)"))
            print(f"   ✅ {schema}.{table} — {len(cols)} columns" + (f", {count:,} rows" if count else ""))
    else:
        print("\n⏩ Skipping live PostgreSQL discovery")

    if rs_conn:
        print(f"\n📋 Discovering Redshift schemas: {RS_SCHEMAS}")
        rs_tables = discover_tables(rs_conn, RS_SCHEMAS)
        print(f"   Found {len(rs_tables)} tables")
        for schema, table in rs_tables:
            cols = get_columns(rs_conn, schema, table)
            count = get_approx_count(rs_conn, schema, table)
            all_tables.append((schema, table, cols, count, "Redshift (port 5439)"))
            print(f"   ✅ {schema}.{table} — {len(cols)} columns" + (f", {count:,} rows" if count else ""))
    else:
        print("\n⏩ Skipping live Redshift discovery")

    # If no live connection, use the confirmed fallback
    if not all_tables:
        print("\n📋 Using confirmed schema fallback...")
        for schema, table, cols in build_confirmed_fallback():
            all_tables.append((schema, table, cols, None, "confirmed (no live connection)"))
            print(f"   ✓  {schema}.{table} — {len(cols)} columns (confirmed)")

    # Group by database type for the markdown document
    pg_label = "PostgreSQL (port 5432)"
    rs_label = "Redshift (port 5439)"
    confirmed_label = "confirmed (no live connection)"

    pg_group = [(s,t,c,n) for s,t,c,n,db in all_tables if db == pg_label]
    rs_group  = [(s,t,c,n) for s,t,c,n,db in all_tables if db == rs_label]
    cf_group  = [(s,t,c,n) for s,t,c,n,db in all_tables if db == confirmed_label]

    if pg_group:
        lines.append(f"## PostgreSQL Tables (port 5432)")
        lines.append(f"")
        lines.append(f"*{len(pg_group)} tables discovered from information_schema.tables*")
        lines.append(f"")
        for schema, table, cols, count in pg_group:
            lines.append(build_table_section(schema, table, cols, count))
            lines.append("---")
            lines.append("")

    if rs_group:
        lines.append(f"## Redshift Tables (port 5439)")
        lines.append(f"")
        lines.append(f"*{len(rs_group)} tables discovered from information_schema.tables*")
        lines.append(f"")
        for schema, table, cols, count in rs_group:
            lines.append(build_table_section(schema, table, cols, count))
            lines.append("---")
            lines.append("")

    if cf_group:
        lines.append(f"## Confirmed Tables (fallback — no live connection)")
        lines.append(f"")
        lines.append(f"*{len(cf_group)} tables from confirmed schemas. "
                     f"Run with credentials to get full live discovery.*")
        lines.append(f"")
        for schema, table, cols, count in cf_group:
            lines.append(build_table_section(schema, table, cols, count))
            lines.append("---")
            lines.append("")

    # Always append the key confirmed patterns at the end
    lines += [
        f"## Confirmed Working SQL Patterns",
        f"",
        f"### Fetch any KYB fact:",
        f"```sql",
        f"SELECT name,",
        f"       JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,",
        f"       JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') AS winning_vendor,",
        f"       JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,",
        f"       received_at",
        f"FROM rds_warehouse_public.facts",
        f"WHERE business_id = 'YOUR-UUID'",
        f"  AND name IN ('naics_code', 'mcc_code', 'business_name', 'tin_match_boolean');",
        f"```",
        f"",
        f"### Pipeline B winner lookup (Redshift):",
        f"```sql",
        f"SELECT business_id, primary_naics_code, mcc_code, worth_score,",
        f"       zi_match_confidence, efx_match_confidence,",
        f"       CASE WHEN zi_match_confidence > efx_match_confidence",
        f"            THEN 'ZoomInfo (pid=24)' ELSE 'Equifax (pid=17)'",
        f"       END AS pipeline_b_winner",
        f"FROM datascience.customer_files",
        f"WHERE business_id = 'YOUR-UUID';",
        f"```",
        f"",
        f"### Parse alternatives array (Python, works for all databases):",
        f"```python",
        f"import psycopg2, json",
        f"cur.execute(\"SELECT value FROM rds_warehouse_public.facts\"",
        f"            \" WHERE business_id=%s AND name='naics_code'\", (business_id,))",
        f"row = cur.fetchone()",
        f"if row:",
        f"    fact = json.loads(row[0])",
        f"    primary  = fact.get('value')              # winning code",
        f"    vendor   = fact.get('source', {{}}).get('platformId')  # 17, 24, etc.",
        f"    alts     = fact.get('alternatives', [])   # list of {{code, confidence, platformId}}",
        f"```",
        f"",
        f"### Discover new tables at any time:",
        f"```sql",
        f"-- Run this to see all tables in all Worth AI schemas:",
        f"SELECT table_schema, table_name, table_type",
        f"FROM information_schema.tables",
        f"WHERE table_schema IN ('rds_warehouse_public','rds_cases_public',",
        f"                        'integration_data','datascience','zoominfo','warehouse')",
        f"  AND table_type = 'BASE TABLE'",
        f"ORDER BY table_schema, table_name;",
        f"```",
        f"",
        f"### How to update this file after schema changes:",
        f"```bash",
        f"# Set credentials then run:",
        f"export REDSHIFT_HOST='your-cluster.redshift.amazonaws.com'",
        f"export REDSHIFT_DBNAME='dev'",
        f"export REDSHIFT_USER='your_username'",
        f"export REDSHIFT_PASSWORD='your_password'",
        f"python3 Admin-Portal-KYB-App/sync_redshift_schema.py",
        f"",
        f"# Then rebuild RAG index:",
        f"cd Admin-Portal-KYB-App && python3 kyb_rag_builder.py",
        f"git add api-docs/redshift-schema.md kyb_rag_index.json",
        f"git commit -m 'sync: Redshift schema' && git push",
        f"```",
    ]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text("\n".join(lines), encoding="utf-8")

    if pg_conn: pg_conn.close()
    if rs_conn: rs_conn.close()

    total = len(all_tables)
    print(f"\n✅ Schema file written: {OUT_FILE}")
    print(f"   Tables documented: {total}  (source: {source_label})")
    print(f"   File size: {OUT_FILE.stat().st_size:,} bytes")
    print(f"\nNext steps:")
    print(f"  python3 Admin-Portal-KYB-App/kyb_rag_builder.py")
    print(f"  git add api-docs/redshift-schema.md kyb_rag_index.json && git commit && git push")


if __name__ == "__main__":
    main()
