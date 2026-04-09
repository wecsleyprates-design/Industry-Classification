"""
sync_redshift_schema.py
=======================
Connects to Redshift and exports the current schema for all Worth AI tables
into a structured markdown file that the RAG index can read.

Run this when:
  - A new column is added to any table
  - A new table is added
  - Column names or types change
  - You want to verify the app's knowledge is current

Usage:
  # Set credentials (never hardcode — use environment variables)
  export REDSHIFT_HOST="your-cluster.redshift.amazonaws.com"
  export REDSHIFT_DBNAME="dev"
  export REDSHIFT_USER="your_username"
  export REDSHIFT_PASSWORD="your_password"

  python3 sync_redshift_schema.py

Output:
  api-docs/redshift-schema.md  ← indexed by RAG, used by AI Agent
"""

import os, sys, json, pathlib
from datetime import datetime

OUT_FILE = pathlib.Path(__file__).parent / "api-docs" / "redshift-schema.md"

# ── Tables to document ────────────────────────────────────────────────────────
# Format: (schema, table, description, is_postgresql)
TABLES = [
    # Redshift tables (port 5439)
    ("rds_warehouse_public", "facts",
     "All 200+ resolved facts per business — JSONB value with source, confidence, alternatives[]",
     True),  # Actually PostgreSQL but same connection info
    ("rds_cases_public",     "data_businesses",
     "Core business record: naics_id FK, mcc_id FK, industry FK, name, address, tin",
     True),
    ("rds_cases_public",     "data_owners",
     "Owner records: name, email, mobile, date_of_birth (encrypted), ssn (masked last-4)",
     True),
    ("rds_cases_public",     "data_cases",
     "Case status, timestamps, business_id FK, customer_id FK, worth_score",
     True),
    ("integration_data",     "request_response",
     "Raw vendor API responses — platform_id, business_id, response JSONB, requested_at",
     True),
    ("datascience",          "customer_files",
     "Pipeline B output — ZI vs EFX winner-takes-all: primary_naics_code, mcc_code, worth_score, employee_count",
     False),  # Redshift
    ("datascience",          "zoominfo_matches_custom_inc_ml",
     "ZI entity match results: business_id, zi_c_location_id, zi_probability, similarity_index",
     False),
    ("datascience",          "efx_matches_custom_inc_ml",
     "EFX entity match results: business_id, efx_id, efx_probability, similarity_index",
     False),
    ("datascience",          "oc_matches_custom_inc_ml",
     "OC entity match results: business_id, company_number, jurisdiction_code, oc_probability",
     False),
    ("zoominfo",             "comp_standard_global",
     "ZoomInfo firmographic source: zi_c_naics6, zi_c_employees, zi_c_revenue, zi_c_url, zi_c_name",
     False),
    ("warehouse",            "equifax_us_latest",
     "Equifax firmographic source: efx_primnaicscode, efx_corpempcnt, efx_mbe/wbe/vet, efx_email",
     False),
    ("warehouse",            "oc_companies_latest",
     "OpenCorporates source: company_number, jurisdiction_code, name, industry_code_uids, current_status",
     False),
    ("warehouse",            "latest_score",
     "Latest Worth score per business: business_id, score, created_at",
     False),
]

LOOKUP_TABLES = [
    ("core_naics_code",          "NAICS 2022 lookup: id, code VARCHAR(6), label"),
    ("core_mcc_code",            "MCC lookup: id, code VARCHAR(4), label"),
    ("rel_naics_mcc",            "NAICS → MCC mapping: naics_id FK, mcc_id FK"),
    ("core_business_industries", "Industry sector: id, name, sector_code INT (2-digit NAICS)"),
    ("core_case_statuses",       "Case status lookup: id, code (pending/under_review/auto_approved/archived), label"),
]


def try_connect_pg():
    """Try connecting to PostgreSQL (rds_warehouse_public etc.)"""
    try:
        import psycopg2
        return psycopg2.connect(
            host=os.environ["REDSHIFT_HOST"],
            port=int(os.environ.get("REDSHIFT_PORT_PG", "5432")),
            dbname=os.environ["REDSHIFT_DBNAME"],
            user=os.environ["REDSHIFT_USER"],
            password=os.environ["REDSHIFT_PASSWORD"],
            sslmode="require",
            connect_timeout=10,
        )
    except Exception as e:
        print(f"  ⚠️  PostgreSQL connection failed: {e}")
        return None


def try_connect_rs():
    """Try connecting to Redshift (datascience.*, zoominfo.*, warehouse.*)"""
    try:
        import psycopg2
        return psycopg2.connect(
            host=os.environ.get("REDSHIFT_HOST_RS", os.environ["REDSHIFT_HOST"]),
            port=int(os.environ.get("REDSHIFT_PORT_RS", "5439")),
            dbname=os.environ.get("REDSHIFT_DBNAME_RS", os.environ["REDSHIFT_DBNAME"]),
            user=os.environ["REDSHIFT_USER"],
            password=os.environ["REDSHIFT_PASSWORD"],
            sslmode="require",
            connect_timeout=10,
        )
    except Exception as e:
        print(f"  ⚠️  Redshift connection failed: {e}")
        return None


def get_columns(conn, schema, table):
    """Fetch column names and types from information_schema."""
    if conn is None:
        return None
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
        """, (schema, table))
        rows = cur.fetchall()
        cur.close()
        return rows if rows else None
    except Exception as e:
        print(f"    ⚠️  Could not fetch {schema}.{table}: {e}")
        return None


def get_row_count(conn, schema, table):
    """Get approximate row count."""
    if conn is None:
        return None
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) FROM {schema}.{table}")
        count = cur.fetchone()[0]
        cur.close()
        return count
    except Exception:
        return None


def format_type(data_type, max_len):
    """Format a column type nicely."""
    if max_len and "character" in data_type:
        return f"VARCHAR({max_len})"
    return data_type.upper().replace("CHARACTER VARYING", "VARCHAR").replace("DOUBLE PRECISION", "FLOAT")


def build_markdown(pg_conn, rs_conn, confirmed_schemas: dict) -> str:
    """Build the full schema markdown document."""
    lines = [
        f"# Worth AI — Redshift & PostgreSQL Schema Reference",
        f"",
        f"<!-- Auto-generated by sync_redshift_schema.py on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} -->",
        f"<!-- Source: information_schema.columns queries against production databases -->",
        f"",
        f"## How to read this document",
        f"",
        f"- **Redshift tables** (port 5439): `datascience.*`, `zoominfo.*`, `warehouse.*`",
        f"- **PostgreSQL tables** (port 5432): `rds_warehouse_public.*`, `rds_cases_public.*`, `integration_data.*`",
        f"- **JSON extraction**: Use `JSON_EXTRACT_PATH_TEXT(value, 'key')` for Redshift varchar JSON columns",
        f"- **Confirmed working**: `SELECT name, value, received_at FROM rds_warehouse_public.facts WHERE business_id='uuid' AND name='fact_name'`",
        f"",
    ]

    # Main tables
    for schema, table, description, is_pg in TABLES:
        full_name = f"{schema}.{table}"
        db_type = "PostgreSQL" if is_pg else "Redshift"
        conn = pg_conn if is_pg else rs_conn
        port = "5432" if is_pg else "5439"

        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## `{full_name}`")
        lines.append(f"**Database:** {db_type} (port {port})")
        lines.append(f"**Purpose:** {description}")
        lines.append(f"")

        # Try to get live columns
        cols = get_columns(conn, schema, table)

        if cols:
            count = get_row_count(conn, schema, table)
            if count is not None:
                lines.append(f"**Row count (approx):** {count:,}")
                lines.append(f"")
            lines.append(f"**Columns ({len(cols)} total):**")
            lines.append(f"")
            lines.append(f"| Column | Type | Notes |")
            lines.append(f"|--------|------|-------|")
            for col_name, data_type, max_len in cols:
                type_str = format_type(data_type, max_len)
                # Add contextual notes for key columns
                note = ""
                if col_name == "value" and "facts" in table:
                    note = "VARCHAR containing JSON — use `JSON_EXTRACT_PATH_TEXT(value, 'key')` on Redshift"
                elif col_name == "business_id":
                    note = "UUID — matches across all tables"
                elif col_name == "platform_id" and "request_response" in table:
                    note = "16=Middesk, 24=ZoomInfo, 23=OC, 17=Equifax, 38=Trulioo, 22=SERP, 31=AI, 40=Plaid"
                elif "naics" in col_name.lower():
                    note = "NAICS code"
                elif "confidence" in col_name.lower() or "probability" in col_name.lower():
                    note = "0.0–1.0 match confidence"
                elif col_name == "similarity_index":
                    note = "0–55; confidence = similarity_index / 55.0"
                elif col_name == "industry_code_uids":
                    note = "Pipe-delimited: 'us_naics-722511|uk_sic-56101' — parse with SPLIT_PART"
                lines.append(f"| `{col_name}` | {type_str} | {note} |")
            lines.append(f"")
        else:
            # Use confirmed schema from the schemas provided by user
            conf = confirmed_schemas.get(f"{schema}.{table}")
            if conf:
                lines.append(f"**Columns (from confirmed schema):**")
                lines.append(f"")
                lines.append(f"```")
                for c in conf:
                    lines.append(f"  {c}")
                lines.append(f"```")
            else:
                lines.append(f"*Could not connect to fetch live schema.*")
            lines.append(f"")

    # Lookup tables (PostgreSQL static reference)
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Static Lookup Tables (PostgreSQL, rds_cases_public)")
    lines.append(f"")
    lines.append(f"These tables contain reference data that rarely changes:")
    lines.append(f"")
    for table_name, desc in LOOKUP_TABLES:
        lines.append(f"- **`{table_name}`** — {desc}")
    lines.append(f"")

    # Key queries section
    lines.append(f"---")
    lines.append(f"")
    lines.append(f"## Key Queries (confirmed working)")
    lines.append(f"")
    lines.append(f"### Fetch any KYB fact (Redshift/PostgreSQL):")
    lines.append(f"```sql")
    lines.append(f"SELECT name,")
    lines.append(f"       JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,")
    lines.append(f"       JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') AS winning_vendor,")
    lines.append(f"       JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,")
    lines.append(f"       received_at")
    lines.append(f"FROM rds_warehouse_public.facts")
    lines.append(f"WHERE business_id = 'YOUR-UUID'")
    lines.append(f"  AND name IN ('naics_code', 'mcc_code', 'business_name', 'tin_match_boolean');")
    lines.append(f"```")
    lines.append(f"")
    lines.append(f"### Pipeline B winner (Redshift only):")
    lines.append(f"```sql")
    lines.append(f"SELECT business_id, primary_naics_code, mcc_code, worth_score,")
    lines.append(f"       zi_match_confidence, efx_match_confidence,")
    lines.append(f"       CASE WHEN zi_match_confidence > efx_match_confidence")
    lines.append(f"            THEN 'ZoomInfo (pid=24)' ELSE 'Equifax (pid=17)'")
    lines.append(f"       END AS pipeline_b_winner")
    lines.append(f"FROM datascience.customer_files")
    lines.append(f"WHERE business_id = 'YOUR-UUID';")
    lines.append(f"```")
    lines.append(f"")
    lines.append(f"### See all vendor responses for NAICS (parse alternatives in Python):")
    lines.append(f"```sql")
    lines.append(f"SELECT name, value, received_at")
    lines.append(f"FROM rds_warehouse_public.facts")
    lines.append(f"WHERE business_id = 'YOUR-UUID' AND name = 'naics_code';")
    lines.append(f"-- In Python: fact=json.loads(value); alts=fact.get('alternatives',[])")
    lines.append(f"```")

    return "\n".join(lines)


def main():
    print("=" * 60)
    print("Worth AI — Redshift Schema Sync")
    print("=" * 60)

    # Check credentials
    missing = [k for k in ["REDSHIFT_HOST", "REDSHIFT_USER", "REDSHIFT_PASSWORD", "REDSHIFT_DBNAME"]
               if not os.environ.get(k)]
    if missing:
        print(f"\n⚠️  Missing environment variables: {', '.join(missing)}")
        print("\nSet them and re-run:")
        print("  export REDSHIFT_HOST='your-cluster.redshift.amazonaws.com'")
        print("  export REDSHIFT_DBNAME='dev'")
        print("  export REDSHIFT_USER='your_username'")
        print("  export REDSHIFT_PASSWORD='your_password'")
        print("\nGenerating schema file from CONFIRMED columns (no live connection)...")
        use_confirmed = True
    else:
        use_confirmed = False

    pg_conn = None if use_confirmed else try_connect_pg()
    rs_conn = None if use_confirmed else try_connect_rs()

    # Confirmed schemas provided by user (fallback when no live connection)
    confirmed_schemas = {
        "datascience.zoominfo_matches_custom_inc_ml": [
            "business_id         VARCHAR",
            "zi_c_company_id     BIGINT",
            "zi_c_location_id    BIGINT",
            "zi_es_location_id   VARCHAR",
            "zi_probability      FLOAT      -- XGBoost confidence 0.0-1.0",
            "similarity_index    INT        -- 0-55; confidence = similarity_index / 55.0",
        ],
        "datascience.efx_matches_custom_inc_ml": [
            "business_id         VARCHAR",
            "efx_id              BIGINT",
            "efx_probability     FLOAT      -- XGBoost confidence 0.0-1.0",
            "similarity_index    INT        -- 0-55; confidence = similarity_index / 55.0",
        ],
        "datascience.oc_matches_custom_inc_ml": [
            "business_id         VARCHAR",
            "company_number      VARCHAR",
            "jurisdiction_code   VARCHAR",
            "oc_probability      FLOAT      -- XGBoost confidence 0.0-1.0",
            "similarity_index    INT        -- 0-55",
        ],
        "zoominfo.comp_standard_global": [
            "zi_c_location_id                BIGINT",
            "zi_c_company_id                 BIGINT",
            "zi_c_name                       VARCHAR    -- company name",
            "zi_c_url                        VARCHAR    -- website",
            "zi_c_street / zi_c_city / zi_c_state / zi_c_zip / zi_c_country",
            "zi_c_employees                  INT        -- employee count",
            "zi_c_revenue                    BIGINT     -- annual revenue",
            "zi_c_phone                      VARCHAR",
            "zi_c_naics6                     VARCHAR    -- 6-digit NAICS code",
            "zi_c_naics_top3                 VARCHAR    -- pipe-delimited top 3",
            "zi_c_naics_confidence_score     FLOAT",
            "zi_c_naics_top3_confidence_scores VARCHAR",
            "zi_c_sic4                       VARCHAR    -- SIC code",
            "zi_c_year_founded               VARCHAR",
            "zi_c_ein                        VARCHAR",
            "zi_c_industry_primary           VARCHAR",
        ],
        "warehouse.equifax_us_latest": [
            "efx_id              BIGINT",
            "efx_name            VARCHAR    -- company name",
            "efx_legal_name      VARCHAR",
            "efx_address / efx_city / efx_state / efx_zipcode",
            "efx_primnaicscode   BIGINT     -- primary NAICS code",
            "efx_secnaics1-4     BIGINT     -- secondary NAICS codes",
            "efx_primnaicsdesc   VARCHAR",
            "efx_primsic         BIGINT     -- primary SIC code",
            "efx_secsic1-4       BIGINT",
            "efx_corpempcnt      BIGINT     -- corporate employee count",
            "efx_corpamount      BIGINT     -- corporate revenue",
            "efx_yrest           BIGINT     -- year established",
            "efx_web             VARCHAR    -- website",
            "efx_phone           BIGINT",
            "efx_email           VARCHAR",
            "efx_mbe             VARCHAR    -- minority business enterprise (Y/N)",
            "efx_wbe             VARCHAR    -- woman-owned business (Y/N)",
            "efx_vet             VARCHAR    -- veteran-owned business (Y/N)",
            "efx_nonprofit       VARCHAR",
            "efx_gov             VARCHAR",
        ],
        "warehouse.oc_companies_latest": [
            "company_number                  VARCHAR",
            "jurisdiction_code               VARCHAR    -- e.g. 'us_fl', 'gb'",
            "name                            VARCHAR    -- registered company name",
            "normalised_name                 VARCHAR",
            "company_type                    VARCHAR    -- e.g. 'LLC', 'Corporation'",
            "current_status                  VARCHAR    -- Active/Dissolved/etc.",
            "incorporation_date              VARCHAR",
            "dissolution_date                VARCHAR",
            "industry_code_uids              VARCHAR    -- pipe-delimited: 'us_naics-722511|uk_sic-56101'",
            "number_of_employees             VARCHAR",
            "registered_address.street_address VARCHAR",
            "registered_address.region       VARCHAR",
            "registered_address.postal_code  VARCHAR",
            "registered_address.country      VARCHAR",
            "home_jurisdiction_code          VARCHAR",
            "inactive                        BOOLEAN",
            "has_been_liquidated             BOOLEAN",
        ],
        "rds_warehouse_public.facts": [
            "id              BIGINT (autoincrement)",
            "business_id     VARCHAR  NOT NULL  (composite PK with name)",
            "name            VARCHAR  NOT NULL  -- fact name e.g. 'naics_code', 'tin_match_boolean'",
            "value           VARCHAR (JSONB on PostgreSQL) -- JSON: {value, source:{platformId,confidence}, alternatives:[], override:{value,userId}}",
            "received_at     TIMESTAMPTZ",
            "UNIQUE(business_id, name)",
        ],
    }

    print("\n📋 Building schema document...")
    md = build_markdown(pg_conn, rs_conn, confirmed_schemas)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(md, encoding="utf-8")

    if pg_conn: pg_conn.close()
    if rs_conn: rs_conn.close()

    source = "live database" if (pg_conn or rs_conn) else "confirmed schemas (no live connection)"
    print(f"✅ Schema file written: {OUT_FILE}")
    print(f"   Source: {source}")
    print(f"   Size:   {OUT_FILE.stat().st_size:,} bytes")
    print(f"\nNext: rebuild RAG index to include updated schema")
    print(f"  cd Admin-Portal-KYB-App && python3 kyb_rag_builder.py")
    print(f"  git add api-docs/redshift-schema.md kyb_rag_index.json")
    print(f"  git commit -m 'sync: Redshift schema' && git push")


if __name__ == "__main__":
    main()
