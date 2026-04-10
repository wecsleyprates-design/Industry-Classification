"""
Admin Portal KYB Dashboard Tracking
=====================================
Comprehensive interactive dashboard covering all 6 KYB tracking areas:
  1. KYB — SOS Filings, Vendor Confidence, Middesk gap
  2. TIN Verification
  3. NAICS / MCC Classification
  4. Banking (GIACT gVerify / gAuthenticate)
  5. Worth Score
  6. KYC — IDV, identity risk scores
  7. Due Diligence — Watchlist, Sanctions, PEP, Adverse Media, BK/Liens/Judgments

Data source: rds_warehouse_public.facts + datascience.customer_files
             + integration_data.request_response
Reads live from Redshift using the confirmed credential pattern.
Falls back to synthetic demo data when no connection is available.
"""

import os, json, math, random
from datetime import datetime, timezone
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# ── Page config ──────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Admin Portal — KYB Tracking Dashboard",
    page_icon="🏦",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
  .main { background:#0F172A; }
  section[data-testid="stSidebar"] { background:#1E293B; }
  h1,h2,h3,h4 { color:#E2E8F0 !important; }

  .kpi-card {
    background:#1E293B; border-radius:10px; padding:16px 20px;
    border-left:4px solid #3B82F6; margin-bottom:8px;
  }
  .kpi-card .label { color:#94A3B8; font-size:.78rem; text-transform:uppercase; letter-spacing:.05em; }
  .kpi-card .value { color:#F1F5F9; font-size:1.6rem; font-weight:700; line-height:1.2; }
  .kpi-card .sub   { color:#64748B; font-size:.75rem; margin-top:2px; }

  .insight-ok   { background:#052e16; border-left:4px solid #22c55e;
                  border-radius:8px; padding:10px 14px; margin:6px 0; color:#86efac; font-size:.82rem; }
  .insight-warn { background:#1c1917; border-left:4px solid #f59e0b;
                  border-radius:8px; padding:10px 14px; margin:6px 0; color:#fde68a; font-size:.82rem; }
  .insight-err  { background:#1f0a0a; border-left:4px solid #ef4444;
                  border-radius:8px; padding:10px 14px; margin:6px 0; color:#fca5a5; font-size:.82rem; }
  .insight-info { background:#0c1a2e; border-left:4px solid #60a5fa;
                  border-radius:8px; padding:10px 14px; margin:6px 0; color:#93c5fd; font-size:.82rem; }

  .section-header {
    background:linear-gradient(135deg,#1E3A5F,#0F172A);
    border-radius:10px; padding:14px 20px; margin-bottom:16px;
    border:1px solid #334155;
  }
  .section-header h2 { color:#60A5FA !important; margin:0; font-size:1.1rem; }
  .section-header p  { color:#94A3B8; margin:4px 0 0 0; font-size:.8rem; }

  .source-badge {
    display:inline-block; padding:2px 8px; border-radius:12px;
    font-size:.72rem; font-weight:600; margin:2px;
  }
  .badge-green  { background:#065f46; color:#6ee7b7; }
  .badge-blue   { background:#1e3a5f; color:#93c5fd; }
  .badge-amber  { background:#78350f; color:#fde68a; }
  .badge-red    { background:#7f1d1d; color:#fca5a5; }
  .badge-grey   { background:#1e293b; color:#94a3b8; }

  .lineage-row {
    background:#1E293B; border-radius:8px; padding:10px 14px;
    margin:4px 0; font-size:.8rem; color:#CBD5E1;
    display:flex; gap:12px; align-items:center;
  }
  .lineage-key { color:#60A5FA; font-weight:600; min-width:180px; font-family:monospace; }
  .lineage-src { color:#94A3B8; }

  .inconsistency-table th { background:#1E3A5F !important; color:#93C5FD !important; }
  .inconsistency-table td { background:#1E293B !important; color:#CBD5E1 !important; }
</style>
""", unsafe_allow_html=True)

# ── GIACT code maps (from giactDisplayMapper.ts) ──────────────────────────────
GIACT_ACCOUNT_STATUS = {
    0: ("missing",  "No AccountResponseCode value"),
    1: ("failed",   "Routing number fails validation"),
    2: ("failed",   "Account number fails validation"),
    3: ("failed",   "Check number fails validation"),
    4: ("failed",   "Amount fails validation"),
    5: ("failed",   "Found in Private Bad Checks List"),
    6: ("passed",   "Routing OK — no positive/negative info on account"),
    7: ("failed",   "Decline: risk factor reported"),
    8: ("failed",   "Reject: risk factor reported"),
    9: ("failed",   "Current negative data on account (NSF/returns)"),
    10:("failed",   "Non-Demand Deposit / Credit Card / Line of Credit"),
    11:("missing",  "Not yet available"),
    12:("passed",   "Open and valid checking account"),
    13:("passed",   "American Express Travelers Cheque account"),
    14:("passed",   "Acceptable positive data in transactions"),
    15:("passed",   "Open and valid savings account"),
    16:("missing",  "Not yet available"),
    17:("missing",  "Not yet available"),
    18:("missing",  "Not yet available"),
    19:("failed",   "Negative information in account history"),
    20:("failed",   "Routing number not assigned to any FI"),
    21:("passed",   "No positive or negative information reported"),
    22:("passed",   "Valid US Government FI routing number"),
}
GIACT_ACCOUNT_NAME = {
    0: ("missing",  "Account active — name verification unavailable"),
    1: ("failed",   "Failed gAuthenticate"),
    2: ("passed",   "Customer authentication passed gAuthenticate"),
    3: ("failed",   "Name did not match gAuthenticate"),
    4: ("passed",   "Passed — TaxId mismatch only"),
    5: ("passed",   "Passed — address mismatch only"),
    6: ("passed",   "Passed — phone mismatch only"),
    7: ("passed",   "Passed — DOB/ID mismatch only"),
    8: ("passed",   "Passed — multiple contact mismatches"),
    9: ("failed",   "Failed gIdentify/CustomerID"),
    10:("missing",  "Account active — name verification unavailable"),
    11:("passed",   "Passed gIdentify/CustomerID"),
    12:("failed",   "Name did not match gIdentify/CustomerID"),
    18:("failed",   "No matching owner information found"),
}
GIACT_CONTACT_VERIFICATION = {
    0: ("missing",  "Account active — name verification unavailable"),
    1: ("failed",   "Failed gAuthenticate"),
    2: ("passed",   "Customer authentication passed gAuthenticate"),
    3: ("failed",   "Name mismatch"),
    4: ("failed",   "TaxId (SSN/ITIN) mismatch"),
    5: ("failed",   "Address mismatch"),
    6: ("failed",   "Phone mismatch"),
    7: ("failed",   "DOB/ID mismatch"),
    8: ("failed",   "Multiple contact data points mismatch"),
    9: ("failed",   "Failed gIdentify/CustomerID"),
    10:("missing",  "Account active — name verification unavailable"),
    11:("passed",   "Passed gIdentify/CustomerID"),
    12:("failed",   "Name mismatch gIdentify/CustomerID"),
    18:("failed",   "No matching owner information found"),
}

# ── Redshift connection ───────────────────────────────────────────────────────
@st.cache_resource(ttl=300)
def get_conn():
    try:
        import psycopg2
        conn = psycopg2.connect(
            dbname=os.getenv("REDSHIFT_DB", "dev"),
            user=os.getenv("REDSHIFT_USER", "readonly_all_access"),
            password=os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
            host=os.getenv("REDSHIFT_HOST",
                "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87"
                ".808338307022.us-east-1.redshift-serverless.amazonaws.com"),
            port=int(os.getenv("REDSHIFT_PORT", "5439")),
            connect_timeout=8,
        )
        return conn, True
    except Exception as e:
        return None, False


def run_query(sql, params=None):
    conn, live = get_conn()
    if not live or conn is None:
        return None
    try:
        return pd.read_sql(sql, conn, params=params)
    except Exception:
        return None


# ── Synthetic demo data ───────────────────────────────────────────────────────
def _synth_sos(n=200):
    random.seed(42)
    rows = []
    states = ["us::ca","us::ny","us::tx","us::fl","us::il","us::wa","us::nv","us::de"]
    for i in range(n):
        n_filings = random.randint(1, 3)
        for j in range(n_filings):
            fd = "domestic" if (j == 0 or random.random() > 0.3) else "foreign"
            rows.append({
                "business_id": f"biz-{i:04d}",
                "filing_type": fd,
                "active": random.random() > 0.25,
                "jurisdiction": random.choice(states) if fd == "domestic" else f"us::{random.choice(['de','nv','wy'])}",
                "middesk_conf": round(random.uniform(0.3, 0.95), 3),
                "oc_conf":      round(random.uniform(0.2, 0.90), 3),
                "zi_conf":      round(random.uniform(0.1, 0.85), 3),
                "efx_conf":     round(random.uniform(0.2, 0.80), 3),
                "trulioo_conf": round(random.uniform(0.1, 0.75), 3),
            })
    return pd.DataFrame(rows)

def _synth_tin(n=200):
    random.seed(1)
    statuses = ["success","failure","pending",""]
    weights  = [0.55, 0.25, 0.10, 0.10]
    rows = []
    for i in range(n):
        s = random.choices(statuses, weights=weights)[0]
        rows.append({
            "business_id": f"biz-{i:04d}",
            "tin_match_status": s,
            "tin_match_boolean": s == "success",
            "tin_submitted": bool(random.random() > 0.05),
            "middesk_tin_task": random.choice(["success","failure","pending","none"]),
        })
    return pd.DataFrame(rows)

def _synth_naics(n=200):
    random.seed(2)
    naics_codes = ["722511","561499","541512","621111","448110","531110","423840","712110"]
    mcc_codes   = ["5812","5614","7372","8099","5651","6552","5065","7991"]
    rows = []
    for i in range(n):
        ni = random.randint(0, len(naics_codes)-1)
        rows.append({
            "business_id": f"biz-{i:04d}",
            "naics_code": naics_codes[ni],
            "mcc_code":   mcc_codes[ni],
            "naics_source": random.choice(["equifax","zoominfo","opencorporates","ai","trulioo"]),
            "naics_confidence": round(random.uniform(0.1, 0.95), 3),
            "is_fallback": naics_codes[ni] == "561499",
        })
    return pd.DataFrame(rows)

def _synth_banking(n=200):
    random.seed(3)
    verify_codes = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,19,20,21]
    auth_codes   = [0,1,2,3,4,5,6,7,8,9,10,11,12,18]
    rows = []
    for i in range(n):
        vc = random.choice(verify_codes)
        ac = random.choice(auth_codes)
        rows.append({
            "business_id":         f"biz-{i:04d}",
            "verify_response_code": vc,
            "auth_response_code":   ac,
            "account_status":       GIACT_ACCOUNT_STATUS.get(vc, ("missing","Unknown"))[0],
            "account_name_status":  GIACT_ACCOUNT_NAME.get(ac, ("missing","Unknown"))[0],
            "contact_verification": GIACT_CONTACT_VERIFICATION.get(ac, ("missing","Unknown"))[0],
        })
    return pd.DataFrame(rows)

def _synth_worth(n=200):
    random.seed(4)
    rows = []
    for i in range(n):
        score = random.gauss(650, 90)
        score = max(300, min(850, score))
        rows.append({
            "business_id": f"biz-{i:04d}",
            "worth_score_850": round(score),
            "risk_level": "HIGH" if score < 500 else ("MODERATE" if score < 650 else "LOW"),
            "shap_public_records": round(random.gauss(-20, 15)),
            "shap_company_profile": round(random.gauss(30, 20)),
            "shap_financials": round(random.gauss(10, 25)),
            "shap_banking": round(random.gauss(15, 18)),
        })
    return pd.DataFrame(rows)

def _synth_kyc(n=200):
    random.seed(5)
    rows = []
    for i in range(n):
        verified = random.random() > 0.25
        rows.append({
            "business_id":      f"biz-{i:04d}",
            "idv_passed":       verified,
            "risk_level":       random.choice(["low_risk","medium_risk","high_risk"]),
            "name_match":       random.choice(["success","failure","pending"]),
            "dob_match":        random.choice(["success","failure","pending","none"]),
            "ssn_match":        random.choice(["success","failure","none"]),
            "address_match":    random.choice(["success","failure","pending"]),
            "phone_match":      random.choice(["success","failure","none"]),
            "synthetic_score":  round(random.uniform(0, 1), 3),
            "stolen_score":     round(random.uniform(0, 1), 3),
        })
    return pd.DataFrame(rows)

def _synth_dd(n=200):
    random.seed(6)
    rows = []
    for i in range(n):
        rows.append({
            "business_id":     f"biz-{i:04d}",
            "watchlist_hits":  random.randint(0, 5),
            "sanctions_hits":  random.randint(0, 2),
            "pep_hits":        random.randint(0, 2),
            "adverse_media":   random.randint(0, 3),
            "bk_hits":         random.randint(0, 2),
            "judgment_hits":   random.randint(0, 3),
            "lien_hits":       random.randint(0, 4),
            "bk_age_months":   random.randint(0, 240) if random.random() > 0.6 else None,
        })
    return pd.DataFrame(rows)


# ── Live data loaders ─────────────────────────────────────────────────────────
@st.cache_data(ttl=120)
def load_sos_data(limit=500):
    sql = """
        SELECT
            f.business_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'value')                                AS sos_raw,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId')                AS platform_id,
            JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'confidence')                AS confidence,
            f.received_at
        FROM rds_warehouse_public.facts f
        WHERE f.name = 'sos_filings'
        ORDER BY f.received_at DESC
        LIMIT %s
    """
    df = run_query(sql, (limit,))
    return df

@st.cache_data(ttl=120)
def load_vendor_confidence(limit=500):
    """Pull the winning source confidence per fact for middesk/oc/zi/efx/trulioo."""
    sql = """
        SELECT
            business_id,
            name AS fact_name,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS platform_id,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('sos_filings','sos_match','sos_active','sos_match_boolean')
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_tin_data(limit=500):
    sql = """
        SELECT
            business_id,
            name,
            JSON_EXTRACT_PATH_TEXT(value, 'value')                 AS fact_value,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS platform_id,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('tin_match','tin_match_boolean','tin_submitted','tin')
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_naics_data(limit=500):
    sql = """
        SELECT
            business_id,
            name,
            JSON_EXTRACT_PATH_TEXT(value, 'value')                 AS fact_value,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS platform_id,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('naics_code','mcc_code','naics_description','mcc_description','industry')
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_banking_data(limit=500):
    sql = """
        SELECT
            business_id,
            name,
            JSON_EXTRACT_PATH_TEXT(value, 'value')                 AS fact_value,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS platform_id,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'giact_account_status','giact_account_name',
            'giact_contact_verification','giact_verify_response_code',
            'giact_auth_response_code'
        )
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_worth_score_data(limit=500):
    sql = """
        SELECT
            business_id,
            CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT) AS worth_score,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name = 'worth_score'
          AND JSON_EXTRACT_PATH_TEXT(value,'value') IS NOT NULL
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_kyc_data(limit=500):
    sql = """
        SELECT
            business_id,
            name,
            JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'idv_status','idv_passed_boolean','verification_status',
            'name_match_boolean','address_match_boolean','tin_match_boolean',
            'synthetic_identity_risk_score','stolen_identity_risk_score',
            'risk_score','compliance_status'
        )
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))

@st.cache_data(ttl=120)
def load_dd_data(limit=500):
    sql = """
        SELECT
            business_id,
            name,
            JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,
            JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,
            received_at
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'watchlist_hits','watchlist','adverse_media_hits',
            'pep_hits','sanctions_hits','watchlist_raw'
        )
        ORDER BY received_at DESC
        LIMIT %s
    """
    return run_query(sql, (limit,))


# ── Helper widgets ────────────────────────────────────────────────────────────
def kpi(label, value, sub="", color="#3B82F6"):
    st.markdown(f"""
    <div class="kpi-card" style="border-left-color:{color}">
      <div class="label">{label}</div>
      <div class="value">{value}</div>
      <div class="sub">{sub}</div>
    </div>""", unsafe_allow_html=True)

def insight(text, level="info"):
    icons = {"ok":"✅","warn":"⚠️","err":"❌","info":"ℹ️"}
    st.markdown(f'<div class="insight-{level}">{icons[level]} {text}</div>',
                unsafe_allow_html=True)

def section_header(title, subtitle="", icon=""):
    st.markdown(f"""
    <div class="section-header">
      <h2>{icon} {title}</h2>
      <p>{subtitle}</p>
    </div>""", unsafe_allow_html=True)

def badge(text, kind="blue"):
    return f'<span class="source-badge badge-{kind}">{text}</span>'

def lineage_row(fact, table, sql_snippet, source, notes=""):
    st.markdown(f"""
    <div class="lineage-row">
      <span class="lineage-key">{fact}</span>
      <span class="lineage-src">📦 {table} · 🏭 {source}</span>
      {'<span style="color:#475569">— ' + notes + '</span>' if notes else ''}
    </div>""", unsafe_allow_html=True)

def status_color(s):
    s = str(s).lower()
    if s in ("success","passed","verified","true","active","low_risk"): return "#22c55e"
    if s in ("failure","failed","unverified","false","rejected","high_risk"): return "#ef4444"
    if s in ("pending","missing","medium_risk"): return "#f59e0b"
    return "#64748b"

def status_badge_html(s):
    c = status_color(s)
    return f'<span style="background:{c}22;color:{c};padding:2px 8px;border-radius:10px;font-size:.75rem;font-weight:600">{s}</span>'

def pct_bar(pct, color="#3B82F6"):
    return f"""
    <div style="background:#1E293B;border-radius:4px;height:8px;overflow:hidden;margin-top:4px">
      <div style="background:{color};width:{min(pct,100):.1f}%;height:100%;border-radius:4px"></div>
    </div>"""


# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
_, live = get_conn()

with st.sidebar:
    st.markdown("## 🏦 KYB Dashboard")
    st.markdown("---")

    if live:
        st.success("🟢 Connected to Redshift")
    else:
        st.warning("🟡 Demo mode — synthetic data")
        st.caption("Set REDSHIFT_* env vars to connect live")

    section = st.radio("Navigation", [
        "📋 Overview",
        "1️⃣  KYB — SOS & Vendors",
        "2️⃣  TIN Verification",
        "3️⃣  NAICS / MCC",
        "4️⃣  Banking (GIACT)",
        "5️⃣  Worth Score",
        "6️⃣  KYC — Identity",
        "7️⃣  Due Diligence",
        "🔍 Data Lineage",
    ])
    st.markdown("---")
    record_limit = st.slider("Records to load", 100, 2000, 500, 100)
    st.caption("All data from `rds_warehouse_public.facts`")
    st.caption("Fact value stored as VARCHAR JSON")
    st.caption("`JSON_EXTRACT_PATH_TEXT(value,'key')`")


# ═══════════════════════════════════════════════════════════════════════════════
# OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════
if section == "📋 Overview":
    st.markdown("# 🏦 Admin Portal — KYB Tracking Dashboard")
    st.markdown(
        "Full tracking of all KYB fields across the Admin Portal. "
        "Each section maps to a tab/sub-tab in `admin.joinworth.com`. "
        "Sources: `rds_warehouse_public.facts`, `integration_data.request_response`."
    )

    # Top-level KPIs with synthetic totals
    sos_df  = _synth_sos(record_limit)
    tin_df  = _synth_tin(record_limit)
    naics_df= _synth_naics(record_limit)
    bank_df = _synth_banking(record_limit)
    kyc_df  = _synth_kyc(record_limit)
    dd_df   = _synth_dd(record_limit)

    n_biz = tin_df["business_id"].nunique()
    sos_active_pct = sos_df[sos_df["active"]]["business_id"].nunique() / n_biz * 100
    tin_verified   = tin_df["tin_match_boolean"].mean() * 100
    naics_fallback = naics_df["is_fallback"].mean() * 100
    kyc_pass       = kyc_df["idv_passed"].mean() * 100
    wl_any         = (dd_df["watchlist_hits"] > 0).mean() * 100

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Businesses",          f"{n_biz:,}",   "in scope",    "#3B82F6")
    with c2: kpi("SOS Active",          f"{sos_active_pct:.0f}%", "have active filing", "#22c55e")
    with c3: kpi("TIN Verified",        f"{tin_verified:.0f}%", "tin_match=success",  "#22c55e")
    with c4: kpi("NAICS Fallback 561499",f"{naics_fallback:.0f}%","need review",       "#ef4444")
    with c5: kpi("IDV Passed",          f"{kyc_pass:.0f}%","idv_passed_boolean",    "#f59e0b")
    with c6: kpi("Watchlist Hits",      f"{wl_any:.0f}%","have ≥1 hit",            "#a855f7")

    st.markdown("---")
    st.markdown("### 🗺️ Dashboard Structure")

    sections = [
        ("1️⃣", "KYB — SOS & Vendors",
         "SOS filings domestic/foreign breakdown, active status per type, jurisdiction analysis, "
         "vendor confidence comparison (Middesk, OC, ZI, EFX, Trulioo). "
         "Highlights the known **Middesk data gap** (high OC match → expected Middesk match missing).",
         "sos_filings · sos_active · sos_match · sos_match_boolean"),
        ("2️⃣", "TIN Verification",
         "TIN match status distribution, Middesk task results, inconsistencies between "
         "`tin_match_boolean` and `tin_match.status`, businesses with missing TIN.",
         "tin · tin_match · tin_match_boolean · tin_submitted"),
        ("3️⃣", "NAICS / MCC",
         "Code distribution, fallback 561499 root-cause, winning source breakdown, "
         "confidence distribution by vendor, MCC code distribution.",
         "naics_code · mcc_code · naics_description · mcc_description · industry"),
        ("4️⃣", "Banking (GIACT)",
         "Account Status (gVerify response codes), Account Name (gAuthenticate), "
         "Contact Verification — coverage gaps, code frequency, status distribution.",
         "giact_account_status · verify_response_code · auth_response_code"),
        ("5️⃣", "Worth Score",
         "Score distribution (300–850), risk level breakdown, SHAP category contributions, "
         "score trends over time.",
         "worth_score · risk_level · shap_* categories"),
        ("6️⃣", "KYC — Identity",
         "IDV pass rate, Plaid status breakdown, name/DOB/SSN/address/phone match rates, "
         "synthetic + stolen identity risk score distributions.",
         "idv_status · idv_passed_boolean · name_match · dob_match · ssn_match · synthetic_identity_risk_score"),
        ("7️⃣", "Due Diligence",
         "Watchlist hit frequency, Sanctions vs PEP vs Adverse Media breakdown, "
         "Bankruptcy/Judgment/Lien age and count distributions.",
         "watchlist_hits · sanctions_hits · pep_hits · adverse_media_hits · bk · judgment · lien"),
        ("🔍", "Data Lineage",
         "Full field-to-table-to-source mapping. SQL patterns to retrieve any field. "
         "Platform ID legend. Fact Engine winner rules.",
         "All facts → rds_warehouse_public.facts"),
    ]

    for icon, title, desc, facts in sections:
        with st.expander(f"{icon} {title}", expanded=False):
            st.markdown(f"**{desc}**")
            st.markdown(f"*Facts tracked:* `{facts}`")

    st.markdown("---")
    st.markdown("### ⚠️ Known Issues & Inconsistencies Tracked")
    issues = [
        ("CRITICAL", "Middesk data gap",
         "Businesses with high OC confidence (>0.7) should also have a Middesk match, but many don't. "
         "Check: `sos_filings` sourced from OC (platformId=23) but no Middesk (platformId=16) record in `request_response`."),
        ("HIGH", "NAICS 561499 fallback (5,349 businesses)",
         "99% of fallback businesses have zero vendor NAICS signals. "
         "AI fires with only name+address, returns 561499 when name is ambiguous."),
        ("MEDIUM", "Multiple domestic SOS filings",
         "A business should have exactly one domestic filing. "
         "Multiple domestic filings indicate a data quality issue in the `sos_filings` array."),
        ("MEDIUM", "TIN match status vs boolean inconsistency",
         "`tin_match_boolean=true` but `tin_match.status='pending'` detected in some records. "
         "The boolean is set from `tin_match.status === 'success'` — pending should be false."),
        ("LOW", "GIACT coverage gaps",
         "Response codes 11, 16, 17, 18 map to 'Not yet available' — "
         "these represent GIACT coverage gaps, not application errors."),
    ]
    for severity, title, desc in issues:
        color = {"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","LOW":"#60a5fa"}[severity]
        st.markdown(f"""
        <div style="background:#1E293B;border-left:4px solid {color};border-radius:8px;
                    padding:10px 14px;margin:6px 0;">
          <span style="color:{color};font-weight:700;font-size:.75rem">{severity}</span>
          <span style="color:#E2E8F0;font-weight:600;margin-left:8px">{title}</span>
          <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
        </div>""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 1 — KYB: SOS FILINGS & VENDOR CONFIDENCE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "1️⃣  KYB — SOS & Vendors":
    section_header("KYB — SOS Filings & Vendor Confidence",
        "Tracks sos_filings.foreign_domestic, active status, jurisdiction, and vendor confidence scores",
        "🏛️")

    df = _synth_sos(record_limit)

    # ── KPIs
    dom = df[df["filing_type"] == "domestic"]
    frn = df[df["filing_type"] == "foreign"]
    dom_biz = dom["business_id"].nunique()
    frn_biz = frn["business_id"].nunique()
    dom_active = dom[dom["active"]]["business_id"].nunique()
    frn_active = frn[frn["active"]]["business_id"].nunique()
    multi_dom  = dom.groupby("business_id").size()
    multi_dom_count = (multi_dom > 1).sum()

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Domestic Filings",  f"{dom_biz:,}",  "unique businesses", "#3B82F6")
    with c2: kpi("Foreign Filings",   f"{frn_biz:,}",  "unique businesses", "#8B5CF6")
    with c3: kpi("Domestic Active",   f"{dom_active:,}", f"{dom_active/max(dom_biz,1)*100:.0f}% of domestic", "#22c55e")
    with c4: kpi("Foreign Active",    f"{frn_active:,}", f"{frn_active/max(frn_biz,1)*100:.0f}% of foreign",  "#22c55e")
    with c5: kpi("Multi-Domestic ⚠️", f"{multi_dom_count:,}", "should be 1 only", "#ef4444")
    with c6: kpi("Avg Middesk Conf",  f"{dom['middesk_conf'].mean():.2f}", "0–1 scale", "#f59e0b")

    st.markdown("---")

    tab_sos, tab_vendors, tab_middesk, tab_jur = st.tabs([
        "📊 Filing Analysis", "📡 Vendor Confidence", "⚠️ Middesk Gap", "🗺️ Jurisdiction"
    ])

    with tab_sos:
        col_l, col_r = st.columns(2)

        with col_l:
            st.markdown("#### Domestic vs Foreign Filing Distribution")
            fd_counts = df.groupby("filing_type")["business_id"].nunique().reset_index()
            fd_counts.columns = ["Type", "Businesses"]
            fig = px.pie(fd_counts, names="Type", values="Businesses",
                         color="Type",
                         color_discrete_map={"domestic":"#3B82F6","foreign":"#8B5CF6"},
                         hole=0.5)
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
                              font_color="#E2E8F0", legend_bgcolor="#1E293B",
                              margin=dict(t=30,b=10,l=10,r=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            st.markdown("#### Active vs Inactive by Filing Type")
            active_counts = df.groupby(["filing_type","active"])["business_id"].count().reset_index()
            active_counts.columns = ["Type","Active","Count"]
            active_counts["Active"] = active_counts["Active"].map({True:"Active",False:"Inactive"})
            fig2 = px.bar(active_counts, x="Type", y="Count", color="Active",
                          barmode="group",
                          color_discrete_map={"Active":"#22c55e","Inactive":"#ef4444"})
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", legend_bgcolor="#1E293B",
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=30,b=10,l=10,r=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### 🔬 Domestic Filing Deep Dive (should have exactly 1 per business)")
        dom_summary = dom.groupby("business_id").agg(
            filing_count=("filing_type","count"),
            active_count=("active","sum"),
            max_middesk_conf=("middesk_conf","max"),
            jurisdiction=("jurisdiction","first"),
        ).reset_index()
        dom_summary["status"] = dom_summary.apply(
            lambda r: "⚠️ Multi-domestic" if r["filing_count"] > 1
                else ("✅ OK" if r["active_count"] > 0 else "❌ No active"), axis=1)

        col_a, col_b, col_c = st.columns(3)
        ok_count  = (dom_summary["status"] == "✅ OK").sum()
        multi_cnt = (dom_summary["status"] == "⚠️ Multi-domestic").sum()
        noact_cnt = (dom_summary["status"] == "❌ No active").sum()
        with col_a: kpi("✅ OK (1 active domestic)", f"{ok_count:,}", "", "#22c55e")
        with col_b: kpi("⚠️ Multiple domestic filings", f"{multi_cnt:,}", "data quality issue", "#f59e0b")
        with col_c: kpi("❌ Domestic but no active filing", f"{noact_cnt:,}", "check SOS status", "#ef4444")

        if multi_cnt > 0:
            insight(f"{multi_cnt} businesses have multiple domestic filings. "
                    "A business should have exactly one domestic filing. "
                    "Source: sos_filings array in rds_warehouse_public.facts (name='sos_filings').", "warn")

        st.dataframe(
            dom_summary[dom_summary["status"] != "✅ OK"].head(20),
            use_container_width=True, hide_index=True
        )

    with tab_vendors:
        st.markdown("#### Vendor Confidence Score Comparison")
        st.markdown("*Each vendor has its own entity-match confidence (0–1). "
                    "Higher = more certain the vendor's data matches this business.*")

        vendors = {
            "Middesk":        ("middesk_conf",  "#f59e0b", "pid=16, weight=2.0 — task-based confidence"),
            "OpenCorporates": ("oc_conf",        "#3B82F6", "pid=23, weight=0.9 — match.index/55"),
            "ZoomInfo":       ("zi_conf",        "#8B5CF6", "pid=24, weight=0.8 — match.index/55"),
            "Equifax":        ("efx_conf",       "#22c55e", "pid=17, weight=0.7 — XGBoost or heuristic"),
            "Trulioo":        ("trulioo_conf",   "#ec4899", "pid=38, weight=0.8 — status-based"),
        }

        col_v1, col_v2 = st.columns(2)
        with col_v1:
            plot_data = []
            for name, (col, color, desc) in vendors.items():
                plot_data.append({
                    "Vendor": name,
                    "Mean Confidence": df[col].mean(),
                    "Median": df[col].median(),
                })
            vdf = pd.DataFrame(plot_data)
            fig = px.bar(vdf, x="Vendor", y="Mean Confidence",
                         color="Vendor",
                         color_discrete_sequence=["#f59e0b","#3B82F6","#8B5CF6","#22c55e","#ec4899"],
                         title="Mean Confidence by Vendor")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0", showlegend=False,
                              yaxis=dict(range=[0,1]),
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=40,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_v2:
            conf_cols = [v[0] for v in vendors.values()]
            fig2 = go.Figure()
            for name, (col, color, desc) in vendors.items():
                fig2.add_trace(go.Box(y=df[col], name=name, marker_color=color,
                                      line_color=color, fillcolor=color+"33"))
            fig2.update_layout(title="Confidence Distribution by Vendor",
                               paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", showlegend=False,
                               yaxis=dict(range=[0,1]),
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=40,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### Vendor Details & Source Logic")
        for name, (col, color, desc) in vendors.items():
            pct_above_70 = (df[col] > 0.7).mean() * 100
            pct_below_30 = (df[col] < 0.3).mean() * 100
            st.markdown(f"""
            <div class="lineage-row">
              <span class="lineage-key" style="color:{color}">{name}</span>
              <span style="color:#94A3B8;font-size:.78rem">{desc}</span>
              <span style="color:#22c55e;font-size:.78rem">▲ {pct_above_70:.0f}% > 0.7</span>
              <span style="color:#ef4444;font-size:.78rem">▼ {pct_below_30:.0f}% < 0.3</span>
            </div>""", unsafe_allow_html=True)

    with tab_middesk:
        st.markdown("#### ⚠️ Middesk Data Gap Analysis")
        insight("Known issue: Middesk data is not always showing up in the Admin Portal "
                "even when OC/ZI have high-confidence matches. "
                "If OC confidence > 0.7, we expect a Middesk record too.", "err")

        insight("Root cause to investigate: Check integration_data.request_response "
                "WHERE platform_id = 16 (Middesk) for businesses where OC has a match. "
                "If missing → Middesk API call either failed or was not triggered.", "warn")

        # Simulate: businesses with high OC but low Middesk
        df["oc_high"] = df["oc_conf"] > 0.70
        df["middesk_low"] = df["middesk_conf"] < 0.40
        gap = df[df["oc_high"] & df["middesk_low"]]
        gap_biz = gap["business_id"].nunique()
        total_biz = df["business_id"].nunique()

        col_x, col_y, col_z = st.columns(3)
        with col_x: kpi("High OC Conf (>0.7)", f"{df[df['oc_high']]['business_id'].nunique():,}",
                        "businesses", "#3B82F6")
        with col_y: kpi("Gap: OC High + Middesk Low", f"{gap_biz:,}",
                        f"{gap_biz/max(total_biz,1)*100:.0f}% of total", "#ef4444")
        with col_z: kpi("Expected Middesk Matches", f"{df[df['oc_high']]['business_id'].nunique():,}",
                        "if logic holds", "#22c55e")

        # Scatter: OC conf vs Middesk conf
        sample = df.sample(min(300, len(df)), random_state=42)
        fig = px.scatter(sample, x="oc_conf", y="middesk_conf",
                         color="middesk_low",
                         color_discrete_map={True:"#ef4444", False:"#22c55e"},
                         labels={"oc_conf":"OC Confidence","middesk_conf":"Middesk Confidence",
                                 "middesk_low":"Middesk Gap"},
                         title="OC Confidence vs Middesk Confidence — Gap Highlighted")
        fig.add_vline(x=0.70, line_dash="dash", line_color="#f59e0b",
                      annotation_text="OC threshold 0.7")
        fig.add_hline(y=0.40, line_dash="dash", line_color="#ef4444",
                      annotation_text="Middesk gap threshold")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", legend_bgcolor="#1E293B",
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### 🔍 SQL to investigate Middesk gap in production")
        st.code("""-- Step 1: Find businesses where OC returned a filing but Middesk did NOT
SELECT
    f_oc.business_id,
    JSON_EXTRACT_PATH_TEXT(f_oc.value, 'source', 'confidence')  AS oc_confidence,
    JSON_EXTRACT_PATH_TEXT(f_oc.value, 'source', 'platformId')  AS oc_platform_id,
    f_oc.received_at
FROM rds_warehouse_public.facts f_oc
WHERE f_oc.name = 'sos_filings'
  AND JSON_EXTRACT_PATH_TEXT(f_oc.value, 'source', 'platformId') = '23'  -- OC
  AND NOT EXISTS (
      SELECT 1
      FROM integration_data.request_response rr
      WHERE rr.business_id = f_oc.business_id
        AND rr.platform_id = 16  -- Middesk
  )
ORDER BY f_oc.received_at DESC
LIMIT 100;""", language="sql")

        insight("Platform IDs: 16=Middesk · 23=OpenCorporates · 24=ZoomInfo · "
                "17=Equifax · 38=Trulioo · 31=AI · 22=SERP", "info")

    with tab_jur:
        st.markdown("#### 🗺️ Domestic Filing Jurisdiction Analysis")
        st.markdown("*`jurisdiction` on domestic filings = the state of registration (e.g. `us::ca`). "
                    "This is what we call 'Region' in the Admin Portal.*")

        jur_counts = dom.groupby("jurisdiction")["business_id"].nunique().reset_index()
        jur_counts.columns = ["Jurisdiction","Businesses"]
        jur_counts = jur_counts.sort_values("Businesses", ascending=False).head(20)
        jur_counts["State"] = jur_counts["Jurisdiction"].str.replace("us::","").str.upper()

        fig = px.bar(jur_counts, x="State", y="Businesses",
                     color="Businesses", color_continuous_scale="Blues",
                     title="Top 20 Domestic Jurisdictions (Region)")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", coloraxis_showscale=False,
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### What is 'Region'?")
        insight("'Region' = `sos_filings[].jurisdiction` for domestic filings only. "
                "Format: `us::ca`, `us::ny`, etc. (lowercase state code). "
                "Source: Middesk `registration_state` → `'us::' + state.toLowerCase()` "
                "(integration-service/lib/facts/kyb/index.ts L746–749). "
                "OC uses `jurisdiction_code` from `oc_companies_latest`.", "info")

        insight("For foreign filings, jurisdiction indicates the state of foreign registration "
                "(e.g. `us::de` = Delaware — common for foreign-qualified LLCs). "
                "This is distinct from the domestic home state.", "info")


# ═══════════════════════════════════════════════════════════════════════════════
# 2 — TIN VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "2️⃣  TIN Verification":
    section_header("TIN Verification",
        "tin_match · tin_match_boolean · tin_submitted · Middesk TIN task results",
        "🔐")

    df = _synth_tin(record_limit)
    verified   = df["tin_match_boolean"].sum()
    unverified = (df["tin_match_status"] == "failure").sum()
    pending    = (df["tin_match_status"] == "pending").sum()
    no_tin     = (~df["tin_submitted"]).sum()
    inconsistent = ((df["tin_match_boolean"]) & (df["tin_match_status"] != "success")).sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("✅ TIN Verified",    f"{verified:,}",    f"{verified/len(df)*100:.0f}%", "#22c55e")
    with c2: kpi("❌ TIN Unverified",  f"{unverified:,}",  f"{unverified/len(df)*100:.0f}%", "#ef4444")
    with c3: kpi("⏳ Pending",          f"{pending:,}",    f"{pending/len(df)*100:.0f}%", "#f59e0b")
    with c4: kpi("📭 No TIN Submitted", f"{no_tin:,}",     f"{no_tin/len(df)*100:.0f}%", "#64748b")
    with c5: kpi("⚠️ Inconsistent",    f"{inconsistent:,}", "bool≠status", "#f97316")

    if inconsistent > 0:
        insight(f"{inconsistent} businesses have tin_match_boolean=true but tin_match.status ≠ 'success'. "
                "Check: the boolean should only be true when status === 'success' "
                "(integration-service/lib/facts/kyb/index.ts L482–491).", "warn")

    st.markdown("---")
    tab_dist, tab_middesk, tab_inconsist, tab_lineage = st.tabs([
        "📊 Status Distribution", "🏛️ Middesk TIN Task", "⚠️ Inconsistencies", "🔍 Lineage"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            status_counts = df["tin_match_status"].value_counts().reset_index()
            status_counts.columns = ["Status","Count"]
            colors = {"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","":"#64748b"}
            fig = px.pie(status_counts, names="Status", values="Count",
                         color="Status", color_discrete_map=colors, hole=0.5,
                         title="tin_match.status Distribution")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
                              font_color="#E2E8F0", legend_bgcolor="#1E293B",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            bool_counts = df["tin_match_boolean"].value_counts().reset_index()
            bool_counts.columns = ["Verified","Count"]
            bool_counts["Verified"] = bool_counts["Verified"].map({True:"Verified (true)", False:"Not Verified (false)"})
            fig2 = px.bar(bool_counts, x="Verified", y="Count",
                          color="Verified",
                          color_discrete_map={"Verified (true)":"#22c55e","Not Verified (false)":"#ef4444"},
                          title="tin_match_boolean Distribution")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", showlegend=False,
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### TIN Badge Logic (Admin Portal → KYB → Background → Business Registration)")
        st.markdown("""
| Condition | Badge shown | Component |
|---|---|---|
| `tin_match_boolean.value === true` | ✅ **Verified** (info/blue, CheckBadgeIcon) | `TinBadge.tsx` |
| `tin_match.value.status === 'failure'` | ⚠️ **Unverified** (warning, ExclamationTriangleIcon) | `TinBadge.tsx` |
| Any other status | ⚠️ **{capitalized status}** | `TinBadge.tsx` |
| `loading` | Skeleton spinner | `TinBadge.tsx` |

**Source:** `integration-service-main/lib/facts/kyb/index.ts` L429–491  
**Displayed in:** `microsites-main/.../components/TinBadge.tsx`
        """)

    with tab_middesk:
        st.markdown("#### Middesk TIN Task Results")
        st.markdown("*Middesk runs a `'tin'` review task. The result feeds `tin_match.status`.*")

        task_counts = df["middesk_tin_task"].value_counts().reset_index()
        task_counts.columns = ["Task Result","Count"]
        colors2 = {"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","none":"#64748b"}
        fig = px.bar(task_counts, x="Task Result", y="Count",
                     color="Task Result", color_discrete_map=colors2,
                     title="Middesk TIN Review Task Status")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", showlegend=False,
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        none_count = (df["middesk_tin_task"] == "none").sum()
        if none_count > 0:
            insight(f"{none_count} businesses have no Middesk TIN task result. "
                    "This means Middesk either was not called or returned no TIN review task. "
                    "Trulioo BusinessRegistrationNumber comparison is the fallback.", "warn")

        st.markdown("#### TIN Source Hierarchy")
        for i, (source, desc, pid) in enumerate([
            ("Middesk BEV",      "business_entity_verification.tin — highest priority", "pid=16"),
            ("Trulioo business", "Compares submitted BusinessRegistrationNumber inputs", "pid=38"),
            ("businessDetails",  "Applicant-submitted tin from onboarding form", "pid=N/A"),
        ], 1):
            st.markdown(f"""
            <div class="lineage-row">
              <span style="color:#60A5FA;min-width:20px">{i}.</span>
              <span class="lineage-key">{source}</span>
              <span class="lineage-src">{desc} · <code>{pid}</code></span>
            </div>""", unsafe_allow_html=True)

    with tab_inconsist:
        st.markdown("#### ⚠️ TIN Inconsistency Analysis")

        inc_df = df[
            (df["tin_match_boolean"]) &
            (df["tin_match_status"].isin(["failure","pending",""]))
        ].copy()

        if len(inc_df) > 0:
            insight(f"{len(inc_df)} records: tin_match_boolean=true but status is NOT 'success'. "
                    "This should not happen — the boolean is derived strictly from status === 'success'.", "err")
            st.dataframe(inc_df[["business_id","tin_match_status","tin_match_boolean","middesk_tin_task"]],
                         use_container_width=True, hide_index=True)
        else:
            insight("No TIN boolean vs status inconsistencies detected in this sample.", "ok")

        no_tin_df = df[~df["tin_submitted"]]
        if len(no_tin_df) > 0:
            insight(f"{len(no_tin_df)} businesses did not submit a TIN. "
                    "These will always have tin_match_boolean=false.", "warn")

    with tab_lineage:
        st.markdown("#### Data Lineage")
        lineage_row("tin_submitted", "rds_warehouse_public.facts", "", "Middesk BEV / applicant form",
                    "Masked TIN. name='tin_submitted'")
        lineage_row("tin", "rds_warehouse_public.facts", "", "Middesk BEV / OC / Canada Open",
                    "Unmasked. name='tin'")
        lineage_row("tin_match", "rds_warehouse_public.facts", "", "Middesk review task 'tin' / Trulioo",
                    "Object {status, message}. name='tin_match'")
        lineage_row("tin_match_boolean", "rds_warehouse_public.facts", "", "Calculated from tin_match",
                    "true iff tin_match.status === 'success'. name='tin_match_boolean'")

        st.code("""-- Get TIN facts for a business
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value, 'value')                 AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS vendor_id,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('tin', 'tin_match', 'tin_match_boolean', 'tin_submitted');""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 3 — NAICS / MCC
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "3️⃣  NAICS / MCC":
    section_header("NAICS / MCC Classification",
        "naics_code · mcc_code · industry · fallback 561499 analysis · source breakdown",
        "🏭")

    df = _synth_naics(record_limit)
    total = len(df)
    fallbacks = df["is_fallback"].sum()
    real = total - fallbacks
    top_naics = df.groupby("naics_code").size().idxmax()
    top_src    = df.groupby("naics_source").size().idxmax()
    avg_conf   = df["naics_confidence"].mean()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Total Businesses",    f"{total:,}",    "", "#3B82F6")
    with c2: kpi("Real NAICS Code",     f"{real:,}",     f"{real/total*100:.0f}%", "#22c55e")
    with c3: kpi("Fallback 561499 ⚠️",  f"{fallbacks:,}",f"{fallbacks/total*100:.0f}%", "#ef4444")
    with c4: kpi("Avg Confidence",      f"{avg_conf:.2f}","0–1 scale", "#f59e0b")
    with c5: kpi("Top Source",          top_src,         "", "#8B5CF6")

    if fallbacks / total > 0.10:
        insight(f"{fallbacks/total*100:.0f}% of businesses have NAICS 561499 (fallback). "
                "Root cause: entity matching failed for all vendors → AI fired with name+address only → "
                "no website, ambiguous name → AI correctly returns 561499.", "err")

    st.markdown("---")
    tab_dist, tab_src, tab_mcc, tab_fallback, tab_lineage = st.tabs([
        "📊 Code Distribution", "📡 Source Breakdown", "💳 MCC Distribution", "⚠️ 561499 Root Cause", "🔍 Lineage"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            naics_counts = df["naics_code"].value_counts().head(15).reset_index()
            naics_counts.columns = ["NAICS","Count"]
            naics_counts["Is Fallback"] = naics_counts["NAICS"] == "561499"
            fig = px.bar(naics_counts, x="NAICS", y="Count",
                         color="Is Fallback",
                         color_discrete_map={True:"#ef4444", False:"#3B82F6"},
                         title="Top 15 NAICS Codes")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0", showlegend=True, legend_bgcolor="#1E293B",
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            fig2 = px.histogram(df[~df["is_fallback"]], x="naics_confidence", nbins=25,
                                color_discrete_sequence=["#3B82F6"],
                                title="NAICS Confidence Distribution (excl. fallbacks)")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0",
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

    with tab_src:
        src_counts = df.groupby("naics_source").agg(
            count=("business_id","count"),
            avg_conf=("naics_confidence","mean"),
            fallback_pct=("is_fallback","mean"),
        ).reset_index()
        src_counts["fallback_pct"] = (src_counts["fallback_pct"]*100).round(1)
        src_counts["avg_conf"] = src_counts["avg_conf"].round(3)

        fig = px.bar(src_counts, x="naics_source", y="count",
                     color="avg_conf", color_continuous_scale="Blues",
                     title="Winning Source Frequency")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0",
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        st.markdown("#### NAICS Source Priority & Weights")
        sources = [
            ("Equifax",        "pid=17, weight=0.7", "efx_primnaicscode from warehouse.equifax_us_latest"),
            ("ZoomInfo",       "pid=24, weight=0.8", "zi_c_naics6 from zoominfo.comp_standard_global"),
            ("OpenCorporates", "pid=23, weight=0.9", "industry_code_uids → parse 'us_naics-XXXXXX'"),
            ("SERP",           "pid=22, weight=0.3", "businessLegitimacyClassification.naics_code"),
            ("Trulioo",        "pid=38, weight=0.7", "extractStandardizedIndustriesFromTruliooResponse"),
            ("businessDetails","pid=N/A, weight=0.2","applicant-submitted naics_code (regex 6-digit)"),
            ("AI (GPT)",       "pid=31, weight=0.1", "AINaicsEnrichment.response.naics_code — LAST RESORT"),
        ]
        for name, pid, desc in sources:
            st.markdown(f"""<div class="lineage-row">
              <span class="lineage-key">{name}</span>
              <span class="lineage-src">{pid}</span>
              <span style="color:#64748b;font-size:.75rem">{desc}</span>
            </div>""", unsafe_allow_html=True)

        insight("Rule 4 (Fact Engine): NO minimum confidence cutoff. "
                "The lowest-confidence winner still wins if it is the only source. "
                "This is why AI (weight=0.1) can become the winner.", "info")

    with tab_mcc:
        mcc_counts = df["mcc_code"].value_counts().head(15).reset_index()
        mcc_counts.columns = ["MCC","Count"]
        mcc_counts["Is Fallback"] = mcc_counts["MCC"] == "5614"
        fig = px.bar(mcc_counts, x="MCC", y="Count",
                     color="Is Fallback",
                     color_discrete_map={True:"#ef4444", False:"#8B5CF6"},
                     title="Top 15 MCC Codes (5614 = fallback)")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", showlegend=True, legend_bgcolor="#1E293B",
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        insight("MCC 5614 is the fallback when NAICS 561499 is assigned. "
                "mcc_code = mcc_code_found (from AI) ?? mcc_code_from_naics (via rel_naics_mcc lookup). "
                "Source: businessDetails/index.ts L376–387.", "info")

    with tab_fallback:
        st.markdown("#### 561499 Root-Cause Breakdown")
        st.markdown("*From the full diagnostic analysis (5,349 businesses in production):*")

        scenarios = {
            "C — No vendor NAICS, AI blind (99%)": 5348,
            "E — AI not triggered (1%)": 1,
        }
        fig = px.bar(x=list(scenarios.keys()), y=list(scenarios.values()),
                     color_discrete_sequence=["#ef4444","#f59e0b"],
                     title="561499 Root-Cause Scenarios (production data)")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0",
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        gaps = [
            ("G1","Entity matching fails","5,348 businesses","Both A & B",
             "ZI/EFX/OC entity-match model finds no record above threshold. "
             "Likely: new registrations, micro-businesses not in bulk data, ambiguous names."),
            ("G2","AI web search not used","~1,069 est.","Pipeline A only",
             "web_search only enabled when params.website is set. "
             "Businesses with no website URL → AI cannot search → 561499."),
            ("G3","No name keyword classification","~1,604 est.","Pipeline A only",
             "AI prompt says 'return 561499 if no evidence'. Does not check name keywords "
             "(e.g. 'Lisa's Nail Salon' → should be 812113 Nail Salons, gets 561499)."),
            ("G4","AI metadata not stored","5,349 businesses","Pipeline A only",
             "ai_naics_enrichment_metadata fact never written when AI returns 561499. "
             "ai_confidence/ai_reasoning = null for all fallback cases."),
            ("G5","Fallback description shown to customers","5,349 businesses","Pipeline A only",
             "mcc_description = 'Fallback MCC per instructions...' — internal text exposed in Admin Portal."),
            ("G6","Pipeline B also null","5,349 businesses","Pipeline B",
             "zi_match_confidence=0 AND efx_match_confidence=0 for all 5,349. "
             "customer_files.primary_naics_code = NULL."),
        ]
        for gid, title, affected, pipeline, desc in gaps:
            color = "#ef4444" if gid in ("G1","G4","G5") else "#f59e0b"
            st.markdown(f"""
            <div style="background:#1E293B;border-left:4px solid {color};border-radius:8px;
                        padding:10px 14px;margin:6px 0;">
              <span style="color:{color};font-weight:700">Gap {gid}</span>
              <span style="color:#E2E8F0;font-weight:600;margin-left:8px">{title}</span>
              <span style="color:#64748b;font-size:.75rem;margin-left:8px">{affected} · {pipeline}</span>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

    with tab_lineage:
        lineage_row("naics_code", "rds_warehouse_public.facts", "", "EFX/ZI/OC/SERP/Trulioo/AI",
                    "6-digit code. Winner via Fact Engine rules.")
        lineage_row("mcc_code", "rds_warehouse_public.facts", "", "AI / rel_naics_mcc lookup",
                    "4-digit MCC. Derived from naics_code or AI direct.")
        lineage_row("industry", "rds_warehouse_public.facts", "", "Calculated from naics_code",
                    "2-digit prefix → core_business_industries table.")
        lineage_row("naics_description", "rds_warehouse_public.facts", "", "core_naics_code lookup",
                    "Human-readable label for the NAICS code.")
        st.code("""SELECT name,
       JSON_EXTRACT_PATH_TEXT(value, 'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') AS vendor_id,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('naics_code','mcc_code','industry','naics_description');""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 4 — BANKING (GIACT)
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "4️⃣  Banking (GIACT)":
    section_header("Banking — GIACT gVerify & gAuthenticate",
        "Account Status (verify_response_code) · Account Name · Contact Verification",
        "🏦")

    df = _synth_banking(record_limit)

    passed_acct  = (df["account_status"] == "passed").sum()
    failed_acct  = (df["account_status"] == "failed").sum()
    missing_acct = (df["account_status"] == "missing").sum()
    passed_name  = (df["account_name_status"] == "passed").sum()
    failed_name  = (df["account_name_status"] == "failed").sum()
    passed_cont  = (df["contact_verification"] == "passed").sum()
    coverage_gap = (df["verify_response_code"].isin([11,16,17,18])).sum()

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Account ✅ Passed",  f"{passed_acct:,}",  f"{passed_acct/len(df)*100:.0f}%", "#22c55e")
    with c2: kpi("Account ❌ Failed",  f"{failed_acct:,}",  f"{failed_acct/len(df)*100:.0f}%", "#ef4444")
    with c3: kpi("Account ⚠️ Missing", f"{missing_acct:,}", f"{missing_acct/len(df)*100:.0f}%", "#f59e0b")
    with c4: kpi("Name ✅ Passed",     f"{passed_name:,}",  f"{passed_name/len(df)*100:.0f}%", "#22c55e")
    with c5: kpi("Contact ✅ Passed",  f"{passed_cont:,}",  f"{passed_cont/len(df)*100:.0f}%", "#22c55e")
    with c6: kpi("⚠️ Coverage Gap",   f"{coverage_gap:,}", "codes 11,16,17,18", "#f97316")

    if coverage_gap > 0:
        insight(f"{coverage_gap} businesses received GIACT codes 11, 16, 17, or 18 "
                "('Not yet available'). These represent GIACT coverage gaps — the routing number "
                "exists but GIACT has no data for the account. Flag these for manual review.", "warn")

    st.markdown("---")
    tab_acct, tab_name, tab_contact, tab_codes = st.tabs([
        "🏦 Account Status", "👤 Account Name", "📞 Contact Verification", "📋 Response Code Guide"
    ])

    with tab_acct:
        col_l, col_r = st.columns(2)
        with col_l:
            ac_counts = df["account_status"].value_counts().reset_index()
            ac_counts.columns = ["Status","Count"]
            colors = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}
            fig = px.pie(ac_counts, names="Status", values="Count",
                         color="Status", color_discrete_map=colors, hole=0.5,
                         title="Account Status (gVerify)")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
                              font_color="#E2E8F0", legend_bgcolor="#1E293B",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            vc_counts = df["verify_response_code"].value_counts().sort_index().reset_index()
            vc_counts.columns = ["Response Code","Count"]
            vc_counts["Status"] = vc_counts["Response Code"].apply(
                lambda c: GIACT_ACCOUNT_STATUS.get(c, ("missing",""))[0])
            color_map2 = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}
            fig2 = px.bar(vc_counts, x="Response Code", y="Count",
                          color="Status", color_discrete_map=color_map2,
                          title="verify_response_code Frequency")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", legend_bgcolor="#1E293B",
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### Most Common Response Codes")
        top_codes = df["verify_response_code"].value_counts().head(8)
        for code, count in top_codes.items():
            status, tooltip = GIACT_ACCOUNT_STATUS.get(code, ("missing","Unknown"))
            color = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}[status]
            st.markdown(f"""
            <div class="lineage-row">
              <span class="lineage-key" style="color:{color}">Code {code}</span>
              <span style="color:#94A3B8">{tooltip}</span>
              <span style="color:{color};font-weight:600">{count}x</span>
            </div>""", unsafe_allow_html=True)

    with tab_name:
        nc_counts = df["account_name_status"].value_counts().reset_index()
        nc_counts.columns = ["Status","Count"]
        colors3 = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}
        fig = px.bar(nc_counts, x="Status", y="Count",
                     color="Status", color_discrete_map=colors3,
                     title="Account Name Status (gAuthenticate auth_response_code)")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", showlegend=False,
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        insight("Account Name uses gAuthenticate (auth_response_code, not verify_response_code). "
                "Source: giactDisplayMapper.ts ACCOUNT_NAME_MAP. "
                "Key distinction: code 0 = 'account active but name verification unavailable' (missing, not failed).", "info")

    with tab_contact:
        cc_counts = df["contact_verification"].value_counts().reset_index()
        cc_counts.columns = ["Status","Count"]
        fig = px.pie(cc_counts, names="Status", values="Count",
                     color="Status", color_discrete_map=colors3, hole=0.5,
                     title="Contact Verification Status (gAuthenticate)")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
                          font_color="#E2E8F0", legend_bgcolor="#1E293B",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        insight("Contact Verification uses the SAME auth_response_code as Account Name, "
                "but a different mapping (CONTACT_VERIFICATION_MAP). "
                "Key difference: codes 4–8 are 'failed' here vs 'passed' in Account Name. "
                "Source: giactDisplayMapper.ts L73–94.", "info")

    with tab_codes:
        st.markdown("#### Complete GIACT Response Code Reference")
        st.markdown("**Account Status (gVerify — verify_response_code)**")
        acct_ref = [{"Code": c, "Status": GIACT_ACCOUNT_STATUS[c][0].upper(),
                     "Description": GIACT_ACCOUNT_STATUS[c][1]}
                    for c in sorted(GIACT_ACCOUNT_STATUS.keys())]
        st.dataframe(pd.DataFrame(acct_ref), use_container_width=True, hide_index=True)

        st.markdown("**Account Name / Contact Verification (gAuthenticate — auth_response_code)**")
        name_ref = [{"Code": c,
                     "Account Name Status": GIACT_ACCOUNT_NAME.get(c,("missing",""))[0].upper(),
                     "Contact Status": GIACT_CONTACT_VERIFICATION.get(c,("missing",""))[0].upper(),
                     "Account Name Description": GIACT_ACCOUNT_NAME.get(c,("",""))[1]}
                    for c in sorted(set(list(GIACT_ACCOUNT_NAME.keys()) + list(GIACT_CONTACT_VERIFICATION.keys())))]
        st.dataframe(pd.DataFrame(name_ref), use_container_width=True, hide_index=True)

        insight("Source: integration-service-main/src/core/case-tab-values/giactDisplayMapper.ts. "
                "verify_response_code → account_status. "
                "auth_response_code → account_name AND contact_verification (same code, different maps).", "info")


# ═══════════════════════════════════════════════════════════════════════════════
# 5 — WORTH SCORE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "5️⃣  Worth Score":
    section_header("Worth Score",
        "Score distribution (300–850) · risk level breakdown · SHAP category contributions",
        "💰")

    df = _synth_worth(record_limit)
    avg_score  = df["worth_score_850"].mean()
    med_score  = df["worth_score_850"].median()
    high_risk  = (df["risk_level"] == "HIGH").sum()
    mod_risk   = (df["risk_level"] == "MODERATE").sum()
    low_risk   = (df["risk_level"] == "LOW").sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Avg Worth Score",   f"{avg_score:.0f}",  "300–850 scale", "#3B82F6")
    with c2: kpi("Median Score",      f"{med_score:.0f}",  "", "#60a5fa")
    with c3: kpi("🔴 HIGH Risk",      f"{high_risk:,}",    f"{high_risk/len(df)*100:.0f}%", "#ef4444")
    with c4: kpi("🟡 MODERATE Risk",  f"{mod_risk:,}",     f"{mod_risk/len(df)*100:.0f}%", "#f59e0b")
    with c5: kpi("🟢 LOW Risk",       f"{low_risk:,}",     f"{low_risk/len(df)*100:.0f}%", "#22c55e")

    st.markdown("---")
    tab_dist, tab_shap, tab_model = st.tabs([
        "📊 Score Distribution", "🧠 SHAP Contributions", "⚙️ Model Architecture"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.histogram(df, x="worth_score_850", nbins=30,
                               color_discrete_sequence=["#3B82F6"],
                               title="Worth Score Distribution (300–850)")
            fig.add_vline(x=500, line_dash="dash", line_color="#ef4444",
                          annotation_text="HIGH risk threshold")
            fig.add_vline(x=650, line_dash="dash", line_color="#f59e0b",
                          annotation_text="MODERATE threshold")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0",
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            rl_counts = df["risk_level"].value_counts().reset_index()
            rl_counts.columns = ["Risk Level","Count"]
            fig2 = px.bar(rl_counts, x="Risk Level", y="Count",
                          color="Risk Level",
                          color_discrete_map={"HIGH":"#ef4444","MODERATE":"#f59e0b","LOW":"#22c55e"},
                          title="Risk Level Distribution")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", showlegend=False,
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        insight("Score 300–500 = HIGH risk. 500–650 = MODERATE. 650–850 = LOW. "
                "Formula: prediction × (850−300) + 300. "
                "Source: ai-score-service-main/aiscore.py L43–46.", "info")

    with tab_shap:
        st.markdown("#### SHAP Category Contributions (mean absolute impact, points on 300–850 scale)")
        shap_cols = ["shap_public_records","shap_company_profile","shap_financials","shap_banking"]
        shap_means = df[shap_cols].abs().mean()
        shap_df = pd.DataFrame({
            "Category": ["Public Records","Company Profile","Financials","Banking"],
            "Mean |SHAP| (pts)": shap_means.values,
        })
        fig = px.bar(shap_df, x="Category", y="Mean |SHAP| (pts)",
                     color="Mean |SHAP| (pts)", color_continuous_scale="Blues",
                     title="Mean Absolute SHAP Contribution by Category")
        fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", coloraxis_showscale=False,
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        insight("SHAP points = shap_scores × 550 (range of 850−300). "
                "Base score = explainer_base_prediction × 550 + 300. "
                "Source: ai-score-service-main/aiscore.py L60–87.", "info")

    with tab_model:
        st.markdown("#### Worth Score Model Architecture (v3.1)")
        steps = [
            ("1. preprocessor",   "Feature encoding: state, bus_struct, naics6 one-hot + target encoding"),
            ("2. missing",        "Missing value imputation (per-feature defaults from lookups.py)"),
            ("3. naics_transformer","NAICS code embedding"),
            ("4. imputer",        "Final imputation pass"),
            ("5. encoder",        "Categorical encoding"),
            ("6. initial_layer",  "Firmographic sub-model (XGBoost)"),
            ("7. scaler",         "Feature scaling"),
            ("8. second_layer",   "Financial sub-model"),
            ("9. neural_layer",   "Economic neural network (.pt PyTorch model)"),
            ("10. quantiler",     "Quantile calibration"),
            ("11. ensemble",      "Ensemble combination of all sub-models"),
            ("12. calibrator",    "Final probability calibration → prediction ∈ [0,1]"),
            ("Output: score",     "prediction × 550 + 300 → Worth Score (300–850)"),
        ]
        for step, desc in steps:
            st.markdown(f"""<div class="lineage-row">
              <span class="lineage-key">{step}</span>
              <span class="lineage-src">{desc}</span>
            </div>""", unsafe_allow_html=True)

        st.markdown("#### Key Input Features")
        features = {
            "Public Records":  ["age_bankruptcy (months)","age_judgment","age_lien","count_bankruptcy","count_judgment","count_lien"],
            "Firmographic":    ["state","bus_struct","naics6","primsic","count_employees","count_reviews","score_reviews"],
            "Financial":       ["revenue","is_net_income","bs_total_assets","bs_total_debt","ratio_debt_to_equity","ratio_gross_margin"],
            "Economic":        ["gdp_pch","t10y2y","vix","unemp","cpi","wagegrowth"],
            "Indicators":      ["indicator_government","indicator_education","indicator_nonprofit"],
        }
        for cat, feats in features.items():
            with st.expander(f"📊 {cat} Features ({len(feats)})"):
                st.code(", ".join(feats))


# ═══════════════════════════════════════════════════════════════════════════════
# 6 — KYC / IDENTITY
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "6️⃣  KYC — Identity":
    section_header("KYC — Identity Verification",
        "IDV (Plaid) · name/DOB/SSN/address/phone match · synthetic + stolen identity risk",
        "🪪")

    df = _synth_kyc(record_limit)
    passed   = df["idv_passed"].sum()
    high_syn = (df["synthetic_score"] > 0.70).sum()
    high_sto = (df["stolen_score"] > 0.70).sum()
    name_ok  = (df["name_match"] == "success").sum()
    high_risk= (df["risk_level"] == "high_risk").sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("IDV Passed",             f"{passed:,}",   f"{passed/len(df)*100:.0f}%",    "#22c55e")
    with c2: kpi("High Synthetic Risk",    f"{high_syn:,}", f"{high_syn/len(df)*100:.0f}% >0.7","#ef4444")
    with c3: kpi("High Stolen Risk",       f"{high_sto:,}", f"{high_sto/len(df)*100:.0f}% >0.7","#ef4444")
    with c4: kpi("Name Match Success",     f"{name_ok:,}",  f"{name_ok/len(df)*100:.0f}%",   "#22c55e")
    with c5: kpi("High Risk Compliance",   f"{high_risk:,}",f"{high_risk/len(df)*100:.0f}%", "#ef4444")

    st.markdown("---")
    tab_idv, tab_match, tab_risk, tab_lineage = st.tabs([
        "🪪 IDV Status", "✅ Match Results", "⚠️ Risk Scores", "🔍 Lineage"
    ])

    with tab_idv:
        col_l, col_r = st.columns(2)
        with col_l:
            idv_counts = df["idv_passed"].value_counts().reset_index()
            idv_counts.columns = ["IDV Passed","Count"]
            idv_counts["IDV Passed"] = idv_counts["IDV Passed"].map({True:"✅ Passed",False:"❌ Not Passed"})
            fig = px.pie(idv_counts, names="IDV Passed", values="Count",
                         color="IDV Passed",
                         color_discrete_map={"✅ Passed":"#22c55e","❌ Not Passed":"#ef4444"},
                         hole=0.5, title="IDV Pass Rate (Plaid)")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#0F172A",
                              font_color="#E2E8F0", legend_bgcolor="#1E293B",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            rl_counts = df["risk_level"].value_counts().reset_index()
            rl_counts.columns = ["Risk Level","Count"]
            fig2 = px.bar(rl_counts, x="Risk Level", y="Count",
                          color="Risk Level",
                          color_discrete_map={"high_risk":"#ef4444","medium_risk":"#f59e0b","low_risk":"#22c55e"},
                          title="Compliance Risk Level (Trulioo)")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0", showlegend=False,
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### IDV Status Keys (Plaid → Worth mapping)")
        idv_statuses = [
            ("SUCCESS",  "1", "IDV completed and passed"),
            ("PENDING",  "2", "IDV session created, not yet completed"),
            ("CANCELED", "3", "User cancelled the IDV session"),
            ("EXPIRED",  "4", "Session expired before completion"),
            ("FAILED",   "99","IDV completed but failed verification"),
        ]
        for s, id_, desc in idv_statuses:
            color = "#22c55e" if s == "SUCCESS" else ("#ef4444" if s in ("FAILED",) else "#f59e0b")
            st.markdown(f"""<div class="lineage-row">
              <span class="lineage-key" style="color:{color}">{s} (id={id_})</span>
              <span class="lineage-src">{desc}</span>
            </div>""", unsafe_allow_html=True)

        insight("idv_passed_boolean = true only when idv_status.SUCCESS count > 0. "
                "idv_passed = the numeric COUNT of successful IDV sessions (not boolean). "
                "Source: integration-service/lib/facts/kyb/index.ts L528–550.", "info")

    with tab_match:
        match_fields = ["name_match","dob_match","ssn_match","address_match","phone_match"]
        match_labels = ["Name","DOB","SSN","Address","Phone"]
        results = []
        for field, label in zip(match_fields, match_labels):
            vc = df[field].value_counts()
            results.append({
                "Field": label,
                "Success %": round(vc.get("success",0)/len(df)*100, 1),
                "Failure %": round(vc.get("failure",0)/len(df)*100, 1),
                "Pending %": round(vc.get("pending",0)/len(df)*100, 1),
                "None/Missing %": round(vc.get("none",0)/len(df)*100, 1),
            })
        match_df = pd.DataFrame(results)

        fig = go.Figure()
        for status, color in [("Success %","#22c55e"),("Failure %","#ef4444"),
                               ("Pending %","#f59e0b"),("None/Missing %","#64748b")]:
            fig.add_trace(go.Bar(name=status, x=match_df["Field"], y=match_df[status],
                                 marker_color=color))
        fig.update_layout(barmode="stack", title="KYC Match Results by Field",
                          paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                          font_color="#E2E8F0", legend_bgcolor="#1E293B",
                          xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                          margin=dict(t=50,b=10))
        st.plotly_chart(fig, use_container_width=True)

        for _, row in match_df.iterrows():
            if row["Failure %"] > 30:
                insight(f"{row['Field']} match has {row['Failure %']}% failure rate — above 30% threshold.", "warn")
            if row["None/Missing %"] > 20:
                insight(f"{row['Field']} match missing for {row['None/Missing %']}% of businesses — "
                        "check if this field is being submitted.", "info")

    with tab_risk:
        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.histogram(df, x="synthetic_score", nbins=25,
                               color_discrete_sequence=["#8B5CF6"],
                               title="Synthetic Identity Risk Score Distribution")
            fig.add_vline(x=0.70, line_dash="dash", line_color="#ef4444",
                          annotation_text="High risk threshold")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0",
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            fig2 = px.histogram(df, x="stolen_score", nbins=25,
                                color_discrete_sequence=["#ec4899"],
                                title="Stolen Identity Risk Score Distribution")
            fig2.add_vline(x=0.70, line_dash="dash", line_color="#ef4444",
                           annotation_text="High risk threshold")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0",
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        high_both = ((df["synthetic_score"] > 0.70) & (df["stolen_score"] > 0.70)).sum()
        if high_both > 0:
            insight(f"{high_both} businesses have BOTH synthetic (>0.7) AND stolen (>0.7) risk scores. "
                    "These are the highest-priority fraud signals.", "err")

        insight("Synthetic identity risk: individual has fabricated identity using real + fake data. "
                "Stolen identity risk: individual is using someone else's real identity. "
                "Source: owner_verification → fraud_report (caseTabValuesManager.ts L346–393).", "info")

    with tab_lineage:
        lineage_row("idv_status",              "rds_warehouse_public.facts","","Plaid IDV",
                    "Record of IDV status counts {SUCCESS,PENDING,CANCELED,EXPIRED,FAILED}")
        lineage_row("idv_passed_boolean",       "rds_warehouse_public.facts","","Calculated",
                    "true iff idv_status.SUCCESS > 0")
        lineage_row("name_match_boolean",       "rds_warehouse_public.facts","","Middesk/OC/Trulioo",
                    "Business name match (NOT person name). status === 'success'")
        lineage_row("synthetic_identity_risk_score","rds_warehouse_public.facts","","Fraud report",
                    "0–1 score from fraud_report via owner_verification")
        lineage_row("stolen_identity_risk_score",   "rds_warehouse_public.facts","","Fraud report",
                    "0–1 score from fraud_report via owner_verification")
        lineage_row("compliance_status",        "rds_warehouse_public.facts","","Trulioo",
                    "low_risk/medium_risk/high_risk — risk_score based thresholds")
        st.code("""SELECT name,
       JSON_EXTRACT_PATH_TEXT(value, 'value') AS fact_value,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN (
    'idv_status','idv_passed_boolean',
    'synthetic_identity_risk_score','stolen_identity_risk_score',
    'name_match_boolean','compliance_status'
  );""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 7 — DUE DILIGENCE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "7️⃣  Due Diligence":
    section_header("Due Diligence — Watchlist, Sanctions, PEP, Adverse Media, Public Records",
        "watchlist_hits · sanctions_hits · pep_hits · adverse_media · BK · Judgments · Liens",
        "🔍")

    df = _synth_dd(record_limit)
    any_wl   = (df["watchlist_hits"] > 0).sum()
    any_sanc = (df["sanctions_hits"] > 0).sum()
    any_pep  = (df["pep_hits"] > 0).sum()
    any_am   = (df["adverse_media"] > 0).sum()
    any_bk   = (df["bk_hits"] > 0).sum()
    any_judg = (df["judgment_hits"] > 0).sum()
    any_lien = (df["lien_hits"] > 0).sum()

    c1,c2,c3,c4 = st.columns(4)
    with c1: kpi("Any Watchlist Hit",   f"{any_wl:,}",   f"{any_wl/len(df)*100:.0f}%",   "#ef4444")
    with c2: kpi("Sanctions Hits",      f"{any_sanc:,}", f"{any_sanc/len(df)*100:.0f}%", "#ef4444")
    with c3: kpi("PEP Hits",            f"{any_pep:,}",  f"{any_pep/len(df)*100:.0f}%",  "#f97316")
    with c4: kpi("Adverse Media",       f"{any_am:,}",   f"{any_am/len(df)*100:.0f}%",   "#f59e0b")

    c5,c6,c7 = st.columns(3)
    with c5: kpi("Bankruptcy Hits",     f"{any_bk:,}",   f"{any_bk/len(df)*100:.0f}%",   "#8B5CF6")
    with c6: kpi("Judgment Hits",       f"{any_judg:,}", f"{any_judg/len(df)*100:.0f}%", "#8B5CF6")
    with c7: kpi("Lien Hits",           f"{any_lien:,}", f"{any_lien/len(df)*100:.0f}%", "#8B5CF6")

    st.markdown("---")
    tab_wl, tab_pubrec, tab_lineage = st.tabs([
        "⚠️ Watchlist / Sanctions / PEP", "📜 Public Records (BK/Liens/Judgments)", "🔍 Lineage"
    ])

    with tab_wl:
        col_l, col_r = st.columns(2)
        with col_l:
            hit_types = pd.DataFrame({
                "Type": ["Watchlist","Sanctions","PEP","Adverse Media"],
                "Businesses with Hits": [any_wl, any_sanc, any_pep, any_am],
                "% of Total": [any_wl/len(df)*100, any_sanc/len(df)*100,
                                any_pep/len(df)*100, any_am/len(df)*100],
            })
            fig = px.bar(hit_types, x="Type", y="Businesses with Hits",
                         color="Type",
                         color_discrete_sequence=["#ef4444","#f97316","#f59e0b","#8B5CF6"],
                         title="Due Diligence Hit Frequency by Type")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0", showlegend=False,
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            wl_dist = df["watchlist_hits"].value_counts().sort_index().reset_index()
            wl_dist.columns = ["Hit Count","Businesses"]
            fig2 = px.bar(wl_dist, x="Hit Count", y="Businesses",
                          color_discrete_sequence=["#ef4444"],
                          title="Watchlist Hits per Business")
            fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                               font_color="#E2E8F0",
                               xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                               margin=dict(t=50,b=10))
            st.plotly_chart(fig2, use_container_width=True)

        st.markdown("#### Watchlist Hit Types Explained")
        hit_info = [
            ("🔴 SANCTIONS",    "#ef4444",
             "Business or UBO on OFAC/global sanctions list. "
             "Source: Trulioo PSC screeningResults.watchlistHits where listType='SANCTIONS'. "
             "Stored in: truliooFacts.ts sanctions_hits."),
            ("🟠 PEP",          "#f97316",
             "Politically Exposed Person — owner/UBO is a current or former political figure. "
             "Source: Trulioo PSC screeningResults.watchlistHits where listType='PEP'. "
             "Stored in: truliooFacts.ts pep_hits."),
            ("🟡 ADVERSE MEDIA","#f59e0b",
             "Negative press coverage detected. Filtered OUT from consolidated watchlist "
             "fact (filterOutAdverseMedia in consolidatedWatchlist.ts L57). "
             "Tracked separately in adverse_media_hits fact."),
        ]
        for icon_text, color, desc in hit_info:
            st.markdown(f"""
            <div style="background:#1E293B;border-left:4px solid {color};border-radius:8px;
                        padding:10px 14px;margin:6px 0;">
              <span style="color:{color};font-weight:700">{icon_text}</span>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

        insight("IMPORTANT: Adverse Media is deliberately excluded from the consolidated `watchlist` fact. "
                "It is tracked separately in `adverse_media_hits`. "
                "Source: consolidatedWatchlist.ts L57 `filterOutAdverseMedia(allMetadata)`.", "info")

    with tab_pubrec:
        col_l, col_r = st.columns(2)
        with col_l:
            pub_rec = pd.DataFrame({
                "Type": ["Bankruptcy","Judgment","Lien"],
                "With Hits": [any_bk, any_judg, any_lien],
            })
            fig = px.bar(pub_rec, x="Type", y="With Hits",
                         color="Type",
                         color_discrete_sequence=["#8B5CF6","#a855f7","#c084fc"],
                         title="Public Record Hit Frequency")
            fig.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                              font_color="#E2E8F0", showlegend=False,
                              xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                              margin=dict(t=50,b=10))
            st.plotly_chart(fig, use_container_width=True)

        with col_r:
            bk_with_age = df[df["bk_age_months"].notna()]
            if len(bk_with_age) > 0:
                fig2 = px.histogram(bk_with_age, x="bk_age_months", nbins=20,
                                    color_discrete_sequence=["#8B5CF6"],
                                    title="Bankruptcy Age (months since filing)")
                fig2.add_vline(x=84, line_dash="dash", line_color="#f59e0b",
                               annotation_text="7 years (84 months)")
                fig2.update_layout(paper_bgcolor="#0F172A", plot_bgcolor="#1E293B",
                                   font_color="#E2E8F0",
                                   xaxis_gridcolor="#334155", yaxis_gridcolor="#334155",
                                   margin=dict(t=50,b=10))
                st.plotly_chart(fig2, use_container_width=True)

        insight("BK/Judgment/Lien age is a key Worth Score input. "
                "age_bankruptcy, age_judgment, age_lien (months). "
                "Default imputation: 240 months (20 years) when no record exists. "
                "Source: ai-score-service-main/lookups.py INPUTS dict.", "info")

        insight("Bankruptcies older than 84 months (7 years) carry significantly less "
                "risk weight in the Worth Score model. "
                "Recent BKs (< 24 months) are the strongest negative signal.", "info")

    with tab_lineage:
        lineage_row("watchlist_hits",     "rds_warehouse_public.facts","","Middesk / Trulioo",
                    "Count of consolidated hits. Number = metadata.length")
        lineage_row("watchlist",          "rds_warehouse_public.facts","","Calculated",
                    "Full metadata array (PEP + SANCTIONS only, adverse media excluded)")
        lineage_row("watchlist_raw",      "rds_warehouse_public.facts","","Middesk task / Trulioo watchlistResults",
                    "Raw pre-consolidation watchlist data")
        lineage_row("adverse_media_hits", "rds_warehouse_public.facts","","Trulioo + adverseMediaDetails",
                    "Count where listType='adverse_media'")
        lineage_row("sanctions_hits",     "rds_warehouse_public.facts","","Trulioo PSC",
                    "truliooFacts.ts — screeningResults.watchlistHits where listType='SANCTIONS'")
        lineage_row("pep_hits",           "rds_warehouse_public.facts","","Trulioo PSC",
                    "truliooFacts.ts — screeningResults.watchlistHits where listType='PEP'")
        st.code("""SELECT name,
       JSON_EXTRACT_PATH_TEXT(value, 'value') AS fact_value,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN (
    'watchlist_hits','adverse_media_hits',
    'sanctions_hits','pep_hits','watchlist'
  );
-- Note: watchlist.value is a JSON array — parse in Python with json.loads()""",
                language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LINEAGE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🔍 Data Lineage":
    section_header("Complete Data Lineage",
        "Every fact → source table → vendor → platform_id → Fact Engine rules",
        "🔍")

    tab_facts, tab_vendors, tab_rules, tab_sql = st.tabs([
        "📋 All Facts", "🏭 Vendor Map", "⚙️ Fact Engine Rules", "🗄️ SQL Patterns"
    ])

    with tab_facts:
        all_facts = [
            # KYB / SOS
            ("sos_filings",         "KYB","Middesk/OC/Trulioo","pid=16/23/38","Array of SOS registrations. Each has: active, jurisdiction, foreign_domestic, status, registration_state"),
            ("sos_match",           "KYB","Middesk/OC/Trulioo","pid=16/23/38","Boolean: SOS name matched the submitted business name"),
            ("sos_match_boolean",   "KYB","Calculated",        "N/A",         "true iff sos_match.status === 'success'"),
            ("sos_active",          "KYB","Calculated",        "N/A",         "true iff any filing has active=true"),
            # TIN
            ("tin",                 "KYB","Middesk/OC",        "pid=16/23",   "Unmasked TIN (EIN). Decrypt from Middesk BEV."),
            ("tin_submitted",       "KYB","Middesk/applicant", "pid=16",      "Masked TIN from applicant form"),
            ("tin_match",           "KYB","Middesk/Trulioo",   "pid=16/38",   "Object {status, message}. status: success/failure/pending"),
            ("tin_match_boolean",   "KYB","Calculated",        "N/A",         "true iff tin_match.status === 'success'"),
            # NAICS / MCC
            ("naics_code",          "Industry","EFX/ZI/OC/SERP/Trulioo/AI","pid=17/24/23/22/38/31","6-digit NAICS. Fact Engine winner."),
            ("mcc_code",            "Industry","AI/lookup",    "pid=31",      "4-digit MCC. From AI or rel_naics_mcc table."),
            ("industry",            "Industry","Calculated",   "N/A",         "2-digit NAICS prefix → core_business_industries"),
            ("naics_description",   "Industry","Lookup",       "N/A",         "Human label from core_naics_code table"),
            ("mcc_description",     "Industry","AI/lookup",    "pid=31",      "Human label from AI or core_mcc_code table"),
            # KYC
            ("idv_status",          "KYC","Plaid IDV",         "pid=40",      "Dict of IDV status counts: {SUCCESS:N, PENDING:N, ...}"),
            ("idv_passed",          "KYC","Calculated",        "N/A",         "Numeric count of SUCCESS IDVs"),
            ("idv_passed_boolean",  "KYC","Calculated",        "N/A",         "true iff idv_passed > 0"),
            ("name_match_boolean",  "KYC","Middesk/OC/Trulioo","pid=16/23/38","Business name match boolean"),
            ("address_match_boolean","KYC","Middesk/SERP",     "pid=16/22",   "Address match boolean"),
            ("synthetic_identity_risk_score","KYC","Fraud report","N/A",      "0–1 synthetic identity risk"),
            ("stolen_identity_risk_score",   "KYC","Fraud report","N/A",      "0–1 stolen identity risk"),
            ("compliance_status",   "KYC","Trulioo",           "pid=38",      "low_risk/medium_risk/high_risk"),
            ("risk_score",          "KYC","Trulioo",           "pid=38",      "0–100 risk score (hits × 10 + highRisk × 20)"),
            # Due Diligence
            ("watchlist",           "DD","Middesk/Trulioo",    "pid=16/38",   "Consolidated watchlist metadata (PEP + SANCTIONS)"),
            ("watchlist_hits",      "DD","Calculated",         "N/A",         "Count: watchlist.value.metadata.length"),
            ("watchlist_raw",       "DD","Middesk/Trulioo",    "pid=16/38",   "Pre-consolidation raw watchlist data"),
            ("adverse_media_hits",  "DD","Trulioo/AdverseMedia","pid=38",     "Count of adverse_media type hits"),
            ("sanctions_hits",      "DD","Trulioo PSC",        "pid=38",      "Count where listType='SANCTIONS'"),
            ("pep_hits",            "DD","Trulioo PSC",        "pid=38",      "Count where listType='PEP'"),
            # Banking (not in facts table — in case tab values)
            ("giact_account_status","Banking","GIACT gVerify", "N/A",         "passed/failed/missing — from verify_response_code"),
            ("giact_account_name",  "Banking","GIACT gAuth",   "N/A",         "passed/failed/missing — from auth_response_code"),
            ("giact_contact_verification","Banking","GIACT gAuth","N/A",      "passed/failed/missing — from auth_response_code (diff map)"),
            # Worth Score
            ("worth_score",         "Score","AI Score Service","N/A",         "300–850 scale. Stored in facts or datascience.customer_files"),
        ]
        fact_df = pd.DataFrame(all_facts,
                               columns=["Fact Name","Category","Sources","Platform IDs","Description"])
        category_filter = st.selectbox("Filter by category", ["All"] + sorted(set(f[1] for f in all_facts)))
        if category_filter != "All":
            fact_df = fact_df[fact_df["Category"] == category_filter]
        st.dataframe(fact_df, use_container_width=True, hide_index=True)

    with tab_vendors:
        vendors = [
            ("Middesk",          "16","2.0","task-based: 0.15 + 0.20×successful tasks",
             "SOS filings, TIN match, name match, address verification. Primary KYB source."),
            ("OpenCorporates",   "23","0.9","match.index / 55",
             "SOS filings (global), classification_codes, company type, active status."),
            ("ZoomInfo",         "24","0.8","match.index / 55",
             "naics_code, industry, employees, revenue, website. Pre-loaded in Redshift."),
            ("Equifax",          "17","0.7","XGBoost prediction or heuristic/55",
             "naics_code, employees, revenue, SIC. Pre-loaded in Redshift."),
            ("Trulioo",          "38","0.8","status-based: success=0.7, pending=0.4, failed=0.2",
             "Watchlist, PEP, sanctions, compliance_status, IDV, business registration."),
            ("Plaid IDV",        "40","1.0","1.0 when data present",
             "Identity verification (IDV): idv_status, synthetic/stolen risk scores."),
            ("AI (GPT)",         "31","0.1","self-reported confidence HIGH/MED/LOW",
             "naics_code, mcc_code, mcc_description. LAST RESORT — AI enrichment."),
            ("SERP",             "22","—","heuristic: +0.5 businessMatch, +0.3 if no local",
             "Website info, NAICS from web classification."),
            ("Adverse Media",    "N/A","—","1.0 when records found",
             "adverse_media_hits count. From adverseMediaDetails.records[0].total_risk_count."),
            ("GIACT",            "N/A","—","N/A — response_code based",
             "Banking: account_status (gVerify), account_name, contact_verification (gAuthenticate)."),
        ]
        for name, pid, weight, conf, coverage in vendors:
            st.markdown(f"""
            <div class="lineage-row" style="margin-bottom:6px">
              <span class="lineage-key" style="min-width:160px">{name}</span>
              <span class="source-badge badge-blue">pid={pid}</span>
              <span class="source-badge badge-grey">w={weight}</span>
              <span style="color:#64748b;font-size:.75rem;flex:1">{coverage}</span>
            </div>""", unsafe_allow_html=True)

    with tab_rules:
        st.markdown("#### Fact Engine Winner Selection Rules (Pipeline A)")
        rules = [
            ("Rule 1 — manualOverride()",
             "Always evaluated first. If an analyst has manually set a fact, that value ALWAYS wins. "
             "No other source can override it."),
            ("Rule 2 — factWithHighestConfidence()",
             "The source with the highest confidence score wins, IF the confidence gap to the "
             "next-best source is > 5% (WEIGHT_THRESHOLD=0.05). "
             "Confidence = source.confidence ?? 0.1."),
            ("Rule 3 — weightedFactSelector()",
             "Tie-break: when two sources are within 5% confidence, the one with the higher "
             "platform weight wins (Middesk=2.0, OC=0.9, ZI=0.8, Trulioo=0.8, EFX=0.7)."),
            ("Rule 4 — NO minimum confidence cutoff",
             "CRITICAL: There is NO minimum confidence threshold. A source with confidence=0.05 "
             "can still win if it is the only source. This is why AI (weight=0.1) sometimes wins "
             "and produces NAICS 561499."),
            ("Rule 5 — AI safety net",
             "AI enrichment (pid=31) is triggered when fewer than 1 non-AI source has naics_code. "
             "It is a last resort, not a first choice."),
            ("Rule 6 — removeNaicsCode()",
             "If the winning NAICS code is not in the core_naics_code lookup table, "
             "removeNaicsCode() replaces it with 561499. This catches AI hallucinations."),
        ]
        for rule, desc in rules:
            st.markdown(f"""
            <div style="background:#1E293B;border-left:4px solid #3B82F6;border-radius:8px;
                        padding:10px 14px;margin:6px 0;">
              <div style="color:#60A5FA;font-weight:700;font-size:.82rem">{rule}</div>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("#### Pipeline A vs Pipeline B")
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown("**Pipeline A — Integration Service (real-time)**")
            st.markdown("""
- All 6+ vendors called in parallel
- Fact Engine selects winner per field
- Applies all 6 rules above
- Output: `rds_warehouse_public.facts`
- 200+ facts per business
- **Customer-facing** (Admin Portal KYB tab)
            """)
        with col_b:
            st.markdown("**Pipeline B — Warehouse Service (batch, Redshift)**")
            st.markdown("""
- ZoomInfo + Equifax ONLY
- Winner = `WHEN zi_match_confidence > efx_match_confidence THEN ZI ELSE EFX`
- OC, Middesk, Trulioo, AI — ALL IGNORED
- Output: `datascience.customer_files`
- Internal analytics / risk model training only
- NULL when both confidences = 0
            """)

    with tab_sql:
        st.markdown("#### Confirmed Working SQL Patterns")

        st.code("""-- 1. Get any KYB fact (CONFIRMED WORKING on Redshift Serverless)
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value, 'value')                 AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId')  AS winning_vendor,
       JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('naics_code', 'sos_filings', 'tin_match_boolean', 'watchlist_hits');
""", language="sql")

        st.code("""-- 2. SOS filings analysis across all businesses
SELECT
    business_id,
    JSON_EXTRACT_PATH_TEXT(value, 'value')                AS sos_raw,
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'platformId') AS vendor,
    JSON_EXTRACT_PATH_TEXT(value, 'source', 'confidence') AS confidence,
    received_at
FROM rds_warehouse_public.facts
WHERE name = 'sos_filings'
ORDER BY received_at DESC
LIMIT 500;
-- Then parse sos_raw in Python: json.loads(sos_raw) → list of filings
-- Each filing: {active, jurisdiction, foreign_domestic, status, ...}
""", language="sql")

        st.code("""-- 3. TIN verification summary
SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(value,'value') = 'true'  THEN 1 ELSE 0 END) AS verified,
    SUM(CASE WHEN JSON_EXTRACT_PATH_TEXT(value,'value') = 'false' THEN 1 ELSE 0 END) AS not_verified
FROM rds_warehouse_public.facts
WHERE name = 'tin_match_boolean';
""", language="sql")

        st.code("""-- 4. NAICS fallback rate
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS naics_code,
    COUNT(*) AS businesses,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct
FROM rds_warehouse_public.facts
WHERE name = 'naics_code'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value')
ORDER BY businesses DESC
LIMIT 20;
""", language="sql")

        st.code("""-- 5. Middesk gap: businesses where OC has SOS filing but Middesk does NOT
SELECT DISTINCT f.business_id
FROM rds_warehouse_public.facts f
WHERE f.name = 'sos_filings'
  AND JSON_EXTRACT_PATH_TEXT(f.value, 'source', 'platformId') = '23'  -- OC
  AND NOT EXISTS (
      SELECT 1
      FROM integration_data.request_response rr
      WHERE rr.business_id = f.business_id
        AND rr.platform_id = 16  -- Middesk
  )
LIMIT 100;
""", language="sql")

        st.code("""-- 6. Watchlist hits distribution
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS hit_count,
    COUNT(*) AS businesses
FROM rds_warehouse_public.facts
WHERE name = 'watchlist_hits'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value')
ORDER BY CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS INT) DESC;
""", language="sql")

        st.markdown("#### Python: Parse complex JSON facts")
        st.code("""import psycopg2, json

conn = psycopg2.connect(
    dbname='dev', user='readonly_all_access',
    password='...', host='worthai-services-...redshift-serverless.amazonaws.com',
    port=5439, connect_timeout=10
)
cur = conn.cursor()

# Get SOS filings and parse domestic/foreign
cur.execute(\"\"\"
    SELECT business_id, value, received_at
    FROM rds_warehouse_public.facts
    WHERE name = 'sos_filings'
    LIMIT 100
\"\"\")

rows = []
for business_id, value_str, received_at in cur.fetchall():
    fact = json.loads(value_str)
    filings = fact.get('value', [])  # list of SOS filing objects
    for f in filings:
        rows.append({
            'business_id':    business_id,
            'foreign_domestic': f.get('foreign_domestic'),
            'active':           f.get('active'),
            'jurisdiction':     f.get('jurisdiction'),
            'status':           f.get('status'),
            'received_at':      received_at,
        })
import pandas as pd
df = pd.DataFrame(rows)
print(df.groupby('foreign_domestic')['active'].value_counts())
""", language="python")


# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(
    '<div style="color:#475569;font-size:.72rem;text-align:center">'
    'Admin Portal KYB Dashboard · Source: rds_warehouse_public.facts · '
    'integration-service/lib/facts/kyb/ · ai-score-service · giactDisplayMapper.ts · '
    f'Generated {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}'
    '</div>', unsafe_allow_html=True
)
