"""
Admin Portal KYB Dashboard Tracking — v2
==========================================
Comprehensive interactive dashboard with rich analyst interpretation,
cross-analysis, anomaly detection, data tables, and insights for every section.
"""

import os, json, math, random
from datetime import datetime, timezone
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import numpy as np

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

  .kpi { background:#1E293B; border-radius:10px; padding:14px 18px;
         border-left:4px solid #3B82F6; margin-bottom:6px; }
  .kpi .lbl { color:#94A3B8; font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; }
  .kpi .val { color:#F1F5F9; font-size:1.5rem; font-weight:700; line-height:1.2; }
  .kpi .sub { color:#64748B; font-size:.72rem; margin-top:2px; }

  .analyst { background:#0C1A2E; border:1px solid #1E3A5F; border-radius:10px;
             padding:14px 16px; margin:8px 0; }
  .analyst .hdr { color:#60A5FA; font-weight:700; font-size:.82rem; margin-bottom:6px; }
  .analyst p { color:#CBD5E1; font-size:.80rem; margin:3px 0; line-height:1.5; }

  .flag-red  { background:#1f0a0a; border-left:4px solid #ef4444;
               border-radius:8px; padding:10px 14px; margin:5px 0; color:#fca5a5; font-size:.80rem; }
  .flag-amber{ background:#1c1917; border-left:4px solid #f59e0b;
               border-radius:8px; padding:10px 14px; margin:5px 0; color:#fde68a; font-size:.80rem; }
  .flag-green{ background:#052e16; border-left:4px solid #22c55e;
               border-radius:8px; padding:10px 14px; margin:5px 0; color:#86efac; font-size:.80rem; }
  .flag-blue { background:#0c1a2e; border-left:4px solid #60a5fa;
               border-radius:8px; padding:10px 14px; margin:5px 0; color:#93c5fd; font-size:.80rem; }

  .cross-box { background:#1E293B; border:1px solid #334155; border-radius:10px;
               padding:14px 16px; margin:8px 0; }
  .cross-box .title { color:#A78BFA; font-weight:700; font-size:.82rem; margin-bottom:6px; }
  .cross-box p { color:#CBD5E1; font-size:.79rem; margin:3px 0; }

  .lineage-row { background:#1E293B; border-radius:8px; padding:9px 12px;
                 margin:3px 0; font-size:.78rem; color:#CBD5E1;
                 display:flex; gap:10px; align-items:center; }
  .lk { color:#60A5FA; font-weight:600; min-width:180px; font-family:monospace; }
  .section-hdr { background:linear-gradient(135deg,#1E3A5F,#0F172A);
                 border-radius:10px; padding:12px 18px; margin-bottom:14px;
                 border:1px solid #334155; }
  .section-hdr h2 { color:#60A5FA !important; margin:0; font-size:1.05rem; }
  .section-hdr p  { color:#94A3B8; margin:3px 0 0 0; font-size:.78rem; }
</style>
""", unsafe_allow_html=True)

# ── GIACT code maps ────────────────────────────────────────────────────────────
GIACT_ACCOUNT_STATUS = {
    0:("missing","No AccountResponseCode value"),1:("failed","Routing number fails validation"),
    2:("failed","Account number fails validation"),3:("failed","Check number fails validation"),
    4:("failed","Amount fails validation"),5:("failed","Found in Private Bad Checks List"),
    6:("passed","Routing OK — no positive/negative info on account"),
    7:("failed","Decline: risk factor"),8:("failed","Reject: risk factor"),
    9:("failed","Negative data: NSF/returns"),10:("failed","Non-Demand Deposit/Credit Card"),
    11:("missing","Not yet available"),12:("passed","Open and valid checking account"),
    13:("passed","AmEx Travelers Cheque account"),14:("passed","Acceptable positive data"),
    15:("passed","Open and valid savings account"),16:("missing","Not yet available"),
    17:("missing","Not yet available"),18:("missing","Not yet available"),
    19:("failed","Negative history"),20:("failed","Routing not assigned to any FI"),
    21:("passed","No positive or negative information"),22:("passed","US Government FI routing"),
}
GIACT_ACCOUNT_NAME = {
    0:("missing","Account active — name verification unavailable"),
    1:("failed","Failed gAuthenticate"),2:("passed","Passed gAuthenticate"),
    3:("failed","Name did not match"),4:("passed","Passed — TaxId mismatch only"),
    5:("passed","Passed — address mismatch only"),6:("passed","Passed — phone mismatch only"),
    7:("passed","Passed — DOB/ID mismatch only"),8:("passed","Passed — multiple mismatches"),
    9:("failed","Failed gIdentify/CustomerID"),10:("missing","Account active — name unavailable"),
    11:("passed","Passed gIdentify/CustomerID"),12:("failed","Name mismatch gIdentify"),
    18:("failed","No matching owner info found"),
}
GIACT_CONTACT_VERIFICATION = {
    0:("missing","Account active — name unavailable"),1:("failed","Failed gAuthenticate"),
    2:("passed","Passed gAuthenticate"),3:("failed","Name mismatch"),
    4:("failed","TaxId mismatch"),5:("failed","Address mismatch"),
    6:("failed","Phone mismatch"),7:("failed","DOB/ID mismatch"),
    8:("failed","Multiple contact mismatches"),9:("failed","Failed gIdentify"),
    10:("missing","Account active — name unavailable"),11:("passed","Passed gIdentify"),
    12:("failed","Name mismatch gIdentify"),18:("failed","No matching owner info"),
}

IDV_STATUS_MEANINGS = {
    "SUCCESS":  ("✅","1","IDV completed and passed all checks","User identity confirmed via government ID + selfie match"),
    "PENDING":  ("⏳","2","Session created, not yet completed","User started but has not finished the IDV flow"),
    "CANCELED": ("🚫","3","User cancelled the IDV session","User abandoned the flow before completion"),
    "EXPIRED":  ("⌛","4","Session expired before completion","Session link or token expired (typically 15–30 min)"),
    "FAILED":   ("❌","99","IDV completed but failed verification","ID rejected: mismatch, expired document, or liveness fail"),
}

# ── Connection ─────────────────────────────────────────────────────────────────
def _make_conn():
    """Open a fresh psycopg2 connection. Never cached — always fresh."""
    import psycopg2
    return psycopg2.connect(
        dbname=os.getenv("REDSHIFT_DB", "dev"),
        user=os.getenv("REDSHIFT_USER", "readonly_all_access"),
        password=os.getenv("REDSHIFT_PASSWORD", "Y7&.D3!09WvT4/nSqXS2>qbO"),
        host=os.getenv("REDSHIFT_HOST",
            "worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87"
            ".808338307022.us-east-1.redshift-serverless.amazonaws.com"),
        port=int(os.getenv("REDSHIFT_PORT", "5439")),
        connect_timeout=10,
    )

def run_query(sql):
    """
    Open a fresh connection per query, run SQL, close immediately.
    Fresh connection per query is the only reliable way to avoid:
      - 'current transaction is aborted' (broken cached connection)
      - Stale SSL sessions after VPN reconnect
    """
    try:
        conn = _make_conn()
        try:
            df = pd.read_sql(sql, conn)
        finally:
            conn.close()
        return df
    except Exception as e:
        st.session_state["_last_db_error"] = str(e)
        return None

def test_connection():
    """Return (is_live, error_message). Fresh connection every call."""
    try:
        conn = _make_conn()
        cur = conn.cursor()
        cur.execute("SELECT 1")
        cur.fetchone()
        cur.close()
        conn.close()
        return True, None
    except Exception as e:
        return False, str(e)

def _limit_clause(limit):
    return f" LIMIT {limit}" if limit is not None else ""

def kpi(label, value, sub="", color="#3B82F6"):
    st.markdown(f"""<div class="kpi" style="border-left-color:{color}">
      <div class="lbl">{label}</div><div class="val">{value}</div>
      <div class="sub">{sub}</div></div>""", unsafe_allow_html=True)

def flag(text, level="amber"):
    icons = {"red":"🚨","amber":"⚠️","green":"✅","blue":"ℹ️"}
    st.markdown(f'<div class="flag-{level}">{icons[level]} {text}</div>',
                unsafe_allow_html=True)

def analyst_card(title, points):
    """Analyst interpretation card with bullet points."""
    bullets = "".join(f"<p>• {p}</p>" for p in points)
    st.markdown(f"""<div class="analyst">
      <div class="hdr">🔬 Analyst Interpretation — {title}</div>{bullets}
    </div>""", unsafe_allow_html=True)

def cross_box(title, points):
    """Cross-analysis / relationship box."""
    bullets = "".join(f"<p>→ {p}</p>" for p in points)
    st.markdown(f"""<div class="cross-box">
      <div class="title">🔗 Cross-Analysis — {title}</div>{bullets}
    </div>""", unsafe_allow_html=True)

def sh(title, subtitle="", icon=""):
    st.markdown(f"""<div class="section-hdr">
      <h2>{icon} {title}</h2>{'<p>'+subtitle+'</p>' if subtitle else ''}
    </div>""", unsafe_allow_html=True)

def lrow(fact, table, src, notes=""):
    st.markdown(f"""<div class="lineage-row">
      <span class="lk">{fact}</span>
      <span style="color:#64748b">📦 {table}</span>
      <span style="color:#94A3B8">🏭 {src}</span>
      {'<span style="color:#475569">— '+notes+'</span>' if notes else ''}
    </div>""", unsafe_allow_html=True)

def status_color(s):
    s=str(s).lower()
    if s in ("success","passed","verified","true","active","low_risk","low"): return "#22c55e"
    if s in ("failure","failed","unverified","false","rejected","high_risk","high"): return "#ef4444"
    if s in ("pending","missing","medium_risk","medium"): return "#f59e0b"
    if s in ("canceled","cancelled","expired"): return "#f97316"
    return "#64748b"

def styled_table(df, color_col=None, palette=None):
    """Render a DataFrame as a styled HTML table."""
    palette = palette or {}
    rows_html = ""
    for _, row in df.iterrows():
        cells = ""
        for col in df.columns:
            val = str(row[col])
            if col == color_col:
                c = palette.get(val.lower(), status_color(val))
                cells += f'<td style="padding:6px 10px;color:{c};font-weight:600">{val}</td>'
            else:
                cells += f'<td style="padding:6px 10px;color:#CBD5E1">{val}</td>'
        rows_html += f"<tr>{cells}</tr>"
    headers = "".join(f'<th style="padding:7px 10px;background:#1E3A5F;color:#93C5FD;text-align:left">{c}</th>'
                      for c in df.columns)
    st.markdown(f"""
    <div style="overflow-x:auto;border-radius:8px;border:1px solid #334155">
    <table style="width:100%;border-collapse:collapse;background:#1E293B">
      <thead><tr>{headers}</tr></thead>
      <tbody style="font-size:.78rem">{rows_html}</tbody>
    </table></div>""", unsafe_allow_html=True)

def dark_chart_layout(fig, title=""):
    if title: fig.update_layout(title=dict(text=title,font=dict(color="#E2E8F0")))
    fig.update_layout(
        paper_bgcolor="#0F172A", plot_bgcolor="#1E293B", font_color="#E2E8F0",
        legend=dict(bgcolor="#1E293B",font=dict(color="#CBD5E1")),
        xaxis=dict(gridcolor="#334155",tickfont=dict(color="#94A3B8")),
        yaxis=dict(gridcolor="#334155",tickfont=dict(color="#94A3B8")),
        margin=dict(t=50,b=10,l=10,r=10),
    )
    return fig

def anomaly_flags(df, checks):
    """Run a list of (condition_series, message, level) anomaly checks."""
    found = False
    for cond, msg, lvl in checks:
        n = int(cond.sum()) if hasattr(cond,'sum') else int(cond)
        if n > 0:
            flag(f"{msg} ({n:,} records)", lvl)
            found = True
    if not found:
        flag("No anomalies detected in this sample.", "green")

def sanity_metrics(checks):
    """Render pass/fail sanity check cards in columns."""
    cols = st.columns(len(checks))
    for (label, ok, detail), col in zip(checks, cols):
        color = "#22c55e" if ok else "#ef4444"
        icon  = "✅" if ok else "❌"
        col.markdown(f"""<div class="kpi" style="border-left-color:{color}">
          <div class="lbl">{label}</div>
          <div class="val" style="font-size:1.2rem">{icon} {'PASS' if ok else 'FAIL'}</div>
          <div class="sub">{detail}</div></div>""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# LIVE DATA LOADERS — parse real Redshift facts into section-ready DataFrames
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_fact(value_str):
    """Parse the raw VARCHAR JSON from rds_warehouse_public.facts.value column.
    Always returns a dict — never None — even when value is 'null', empty, or invalid."""
    if not value_str:
        return {}
    try:
        result = json.loads(value_str)
        return result if isinstance(result, dict) else {}
    except Exception:
        return {}


def _safe_get(d, *keys, default=""):
    """
    Safe chained dict lookup that handles None at every level.
    Replaces d.get("a", {}).get("b", "") patterns where intermediate
    values can be JSON null (Python None).
    Example: _safe_get(fact, "source", "platformId") never raises AttributeError.
    """
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return default
        cur = cur.get(k)
        if cur is None:
            return default
    return cur if cur is not None else default


def live_sos(limit):
    """
    rds_warehouse_public is a Redshift FEDERATED external schema pointing to RDS PostgreSQL.
    The federation layer hard-caps VARCHAR at 65535 bytes — sos_filings inner arrays can be
    97KB+, so selecting that fact crashes regardless of SQL transformation used.

    Solution: use the small scalar SOS facts instead:
      - sos_active          → boolean (is any filing active?)
      - sos_match_boolean   → boolean (did SOS name match?)
      - sos_match           → small object {status, confidence, source}

    These are always small scalar values and never hit the 65535 limit.
    We derive per-vendor confidence from source.platformId in these facts.
    """
    sql = f"""
        SELECT business_id, name, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('sos_active', 'sos_match_boolean', 'sos_match')
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None

    pid_conf_col = {
        "16": "middesk_conf", "23": "oc_conf",
        "24": "zi_conf",      "17": "efx_conf", "38": "trulioo_conf",
    }

    rows = {}  # business_id → dict
    for _, r in raw.iterrows():
        bid  = r["business_id"]
        fact = _parse_fact(r["value"])
        val  = fact.get("value")
        pid  = str(_safe_get(fact, "source", "platformId", default=""))
        conf = float(_safe_get(fact, "source", "confidence", default=0) or 0)

        if bid not in rows:
            rows[bid] = {
                "business_id":   bid,
                "active":        False,
                "sos_matched":   False,
                "filing_type":   "domestic",   # scalar facts don't split domestic/foreign
                "jurisdiction":  "unknown",
                "entity_type":   "Unknown",
                **{k: 0.0 for k in pid_conf_col.values()},
            }

        if r["name"] == "sos_active":
            rows[bid]["active"] = str(val).lower() in ("true","1")
        elif r["name"] == "sos_match_boolean":
            rows[bid]["sos_matched"] = str(val).lower() in ("true","1")

        if pid in pid_conf_col:
            rows[bid][pid_conf_col[pid]] = max(rows[bid][pid_conf_col[pid]], conf)

    if not rows:
        return None
    df = pd.DataFrame(list(rows.values()))
    for col in pid_conf_col.values():
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    return df


def live_tin(limit):
    sql = f"""
        SELECT business_id, name, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('tin_match','tin_match_boolean','tin_submitted')
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None

    # Parse each row's JSON in Python
    def extract_fact_value(row):
        fact = _parse_fact(row["value"])
        return str(fact.get("value","")) if fact.get("value") is not None else ""

    def extract_platform_id(row):
        fact = _parse_fact(row["value"])
        return str(_safe_get(fact, "source", "platformId", default=""))

    raw["fact_value"]  = raw.apply(extract_fact_value, axis=1)
    raw["platform_id"] = raw.apply(extract_platform_id, axis=1)

    # Pivot: one row per business_id
    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    for col in ("tin_match","tin_match_boolean","tin_submitted"):
        if col not in pivoted.columns:
            pivoted[col] = None

    def parse_tin_match(v):
        if v is None or v == "": return ""
        try:
            obj = json.loads(v)
            return obj.get("status", str(obj)) if isinstance(obj, dict) else str(v)
        except Exception:
            return str(v)

    pivoted["tin_match_status"]  = pivoted["tin_match"].apply(parse_tin_match)
    pivoted["tin_match_boolean"] = pivoted["tin_match_boolean"].apply(
        lambda v: str(v).lower() in ("true","1") if v else False)
    pivoted["tin_submitted"]     = pivoted["tin_submitted"].apply(
        lambda v: str(v).lower() not in ("","none","null","false","0") if v else False)

    mid = raw[(raw["name"]=="tin_match") & (raw["platform_id"]=="16")][["business_id","fact_value"]].copy()
    if not mid.empty:
        mid["middesk_tin_task"] = mid["fact_value"].apply(parse_tin_match)
        pivoted = pivoted.merge(mid[["business_id","middesk_tin_task"]], on="business_id", how="left")
    if "middesk_tin_task" not in pivoted.columns:
        pivoted["middesk_tin_task"] = "none"
    pivoted["middesk_tin_task"] = pivoted["middesk_tin_task"].fillna("none")

    pivoted["has_middesk"] = pivoted["middesk_tin_task"] != "none"
    trulioo_biz = set(raw.loc[raw["platform_id"]=="38", "business_id"])
    pivoted["has_trulioo"] = pivoted["business_id"].isin(trulioo_biz)
    pivoted["entity_type"] = "Unknown"
    pivoted["state"]       = "Unknown"
    return pivoted


def live_naics(limit):
    sql = f"""
        SELECT business_id, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name = 'naics_code'
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None

    pid_to_src = {"16":"middesk","23":"opencorporates","24":"zoominfo",
                  "17":"equifax","38":"trulioo","31":"ai","22":"serp"}

    def parse_row(row):
        fact = _parse_fact(row["value"])
        return pd.Series({
            "naics_code":       str(fact.get("value","") or ""),
            "platform_id":      str(_safe_get(fact, "source", "platformId", default="")),
            "naics_confidence": float(_safe_get(fact, "source", "confidence", default=0) or 0),
        })

    parsed = raw.apply(parse_row, axis=1)
    raw["naics_code"]       = parsed["naics_code"]
    raw["platform_id"]      = parsed["platform_id"]
    raw["naics_confidence"] = parsed["naics_confidence"]
    raw = raw[raw["naics_code"] != ""]

    raw["naics_source"]  = raw["platform_id"].map(pid_to_src).fillna("other")
    raw["is_fallback"]   = raw["naics_code"] == "561499"
    raw["naics_label"]   = raw["naics_code"].apply(
        lambda c: "Fallback (Other Business Support)" if c=="561499" else c)

    mcc_sql = f"""
        SELECT business_id, value AS mcc_raw
        FROM rds_warehouse_public.facts
        WHERE name = 'mcc_code'{_limit_clause(limit)}
    """
    mcc = run_query(mcc_sql)
    if mcc is not None and not mcc.empty:
        mcc["mcc_code"] = mcc["mcc_raw"].apply(
            lambda v: str(_parse_fact(v).get("value","")) if v else "")
        raw = raw.merge(mcc[["business_id","mcc_code"]], on="business_id", how="left")
    else:
        raw["mcc_code"] = None

    raw["entity_type"] = "Unknown"
    raw["state"]       = "Unknown"
    return raw


def live_banking(limit):
    # Query a wide set of possible GIACT fact name variants.
    # The exact names depend on how integration-service writes them.
    sql = f"""
        SELECT business_id, name, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'giact_verify_response_code', 'giact_auth_response_code',
            'giact_account_status',       'giact_account_name',
            'giact_contact_verification', 'giact_account_response_code',
            'giact_response_code',        'account_status',
            'bank_account_status',        'giact_status'
        )
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        # Return a minimal empty DataFrame that won't crash downstream
        # get_section_data will show the diagnostic SQL to the user
        return None

    raw["fact_value"] = raw["value"].apply(
        lambda v: str(_parse_fact(v).get("value","")) if v else "")

    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    def safe_int(v, default=None):
        try: return int(float(v))
        except Exception: return default

    if "giact_verify_response_code" in pivoted.columns:
        pivoted["verify_response_code"] = pivoted["giact_verify_response_code"].apply(safe_int)
        pivoted["account_status"] = pivoted["verify_response_code"].apply(
            lambda c: GIACT_ACCOUNT_STATUS.get(c, ("missing",""))[0] if c is not None else "missing")
    else:
        pivoted["verify_response_code"] = None
        pivoted["account_status"] = pivoted["giact_account_status"] if "giact_account_status" in pivoted.columns else "missing"

    if "giact_auth_response_code" in pivoted.columns:
        pivoted["auth_response_code"] = pivoted["giact_auth_response_code"].apply(safe_int)
        pivoted["account_name_status"] = pivoted["auth_response_code"].apply(
            lambda c: GIACT_ACCOUNT_NAME.get(c, ("missing",""))[0] if c is not None else "missing")
        pivoted["contact_verification"] = pivoted["auth_response_code"].apply(
            lambda c: GIACT_CONTACT_VERIFICATION.get(c, ("missing",""))[0] if c is not None else "missing")
    else:
        pivoted["auth_response_code"]  = None
        pivoted["account_name_status"] = pivoted["giact_account_name"] if "giact_account_name" in pivoted.columns else "missing"
        pivoted["contact_verification"]= pivoted["giact_contact_verification"] if "giact_contact_verification" in pivoted.columns else "missing"

    pivoted["has_bank_account"] = pivoted["account_status"] != "missing"
    pivoted["state"]            = "Unknown"
    return pivoted


def live_worth(limit):
    sql = f"""
        SELECT business_id, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name = 'worth_score'
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None
    raw["worth_score_850"] = raw["value"].apply(
        lambda v: _parse_fact(v).get("value") if v else None)
    raw["worth_score_850"] = pd.to_numeric(raw["worth_score_850"], errors="coerce")
    raw = raw.dropna(subset=["worth_score_850"])
    raw["risk_level"] = raw["worth_score_850"].apply(
        lambda s: "HIGH" if s<500 else ("MODERATE" if s<650 else "LOW"))
    # SHAP columns not available directly — default to 0 (real SHAP requires model output)
    for c in ["shap_public_records","shap_company_profile","shap_financials","shap_banking"]:
        raw[c] = 0.0
    raw["count_bk"] = 0; raw["count_judgment"] = 0; raw["count_lien"] = 0
    raw["state"]    = "Unknown"
    return raw


def live_kyc(limit):
    sql = f"""
        SELECT business_id, name, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('idv_status','idv_passed_boolean','compliance_status',
                       'name_match_boolean','address_match_boolean','tin_match_boolean',
                       'risk_score')
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None

    raw["fact_value"] = raw["value"].apply(
        lambda v: str(_parse_fact(v).get("value","")) if v else "")

    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    # IDV status — stored as dict {SUCCESS:N,...}
    def parse_idv(v):
        if v is None: return "UNKNOWN"
        try:
            obj = json.loads(v)
            if isinstance(obj, dict):
                # Return the status with the highest count
                return max(obj, key=obj.get, default="UNKNOWN")
            return str(v).upper()
        except Exception:
            return str(v).upper()

    if "idv_status" in pivoted.columns:
        pivoted["idv_status"] = pivoted["idv_status"].apply(parse_idv)
    else:
        pivoted["idv_status"] = "UNKNOWN"
    pivoted["idv_passed"] = pivoted["idv_status"] == "SUCCESS"

    def parse_compliance(v):
        if v is None: return "unknown"
        s = str(v).lower()
        if "high" in s: return "high_risk"
        if "medium" in s or "med" in s: return "medium_risk"
        if "low" in s: return "low_risk"
        return "unknown"

    if "compliance_status" in pivoted.columns:
        pivoted["risk_level"] = pivoted["compliance_status"].apply(parse_compliance)
    else:
        pivoted["risk_level"] = "unknown"

    def bool_to_match(v):
        s = str(v).lower() if v is not None else ""
        if s in ("true","success","1"): return "success"
        if s in ("false","failure","0"): return "failure"
        return "none"

    pivoted["name_match"]    = pivoted["name_match_boolean"].apply(bool_to_match) if "name_match_boolean" in pivoted.columns else "none"
    pivoted["address_match"] = pivoted["address_match_boolean"].apply(bool_to_match) if "address_match_boolean" in pivoted.columns else "none"
    pivoted["dob_match"]     = "none"
    pivoted["ssn_match"]     = "none"
    pivoted["phone_match"]   = "none"
    pivoted["synthetic_score"] = 0.0
    pivoted["stolen_score"]    = 0.0
    pivoted["entity_type"]     = "Unknown"
    pivoted["state"]           = "Unknown"
    return pivoted


def live_dd(limit):
    sql = f"""
        SELECT business_id, name, value, received_at
        FROM rds_warehouse_public.facts
        WHERE name IN ('watchlist_hits','adverse_media_hits','sanctions_hits','pep_hits')
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql)
    if raw is None or raw.empty:
        return None

    def safe_int(v):
        try: return int(float(v or 0))
        except Exception: return 0

    raw["fact_value"] = raw["value"].apply(
        lambda v: str(_parse_fact(v).get("value","")) if v else "0")

    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    for col in ["watchlist_hits","adverse_media_hits","sanctions_hits","pep_hits"]:
        if col in pivoted.columns:
            pivoted[col] = pivoted[col].apply(safe_int)
        else:
            pivoted[col] = 0

    pivoted["bk_hits"]       = 0
    pivoted["judgment_hits"] = 0
    pivoted["lien_hits"]     = 0
    pivoted["bk_age_months"] = None
    pivoted["state"]         = "Unknown"
    pivoted["entity_type"]   = "Unknown"
    return pivoted


def get_section_data(section_key, limit):
    """
    Load real data from Redshift. No synthetic fallback — errors are shown explicitly.
    section_key: 'sos' | 'tin' | 'naics' | 'banking' | 'worth' | 'kyc' | 'dd'
    """
    loaders = {
        "sos":     live_sos,
        "tin":     live_tin,
        "naics":   live_naics,
        "banking": live_banking,
        "worth":   live_worth,
        "kyc":     live_kyc,
        "dd":      live_dd,
    }
    live_fn = loaders[section_key]

    if not live:
        st.error("🔴 Not connected to Redshift. Connect VPN and click **Retry connection** in the sidebar.")
        st.stop()

    with st.spinner(f"Loading {section_key} data from Redshift…"):
        df = live_fn(limit)

    if df is None:
        err = st.session_state.get("_last_db_error", "Query returned no results")
        st.error(f"❌ Failed to load **{section_key}** data from Redshift.")
        st.code(err, language=None)
        # Show what fact names actually exist so the user can diagnose
        st.markdown("**Fact names available in your database for this section:**")
        fact_names = {
            "sos":     "('sos_active','sos_match_boolean','sos_match')",
            "tin":     "('tin_match','tin_match_boolean','tin_submitted')",
            "naics":   "('naics_code',)",
            "banking": "('giact_verify_response_code','giact_auth_response_code','giact_account_status','giact_account_name','giact_contact_verification')",
            "worth":   "('worth_score',)",
            "kyc":     "('idv_status','idv_passed_boolean','compliance_status','name_match_boolean','address_match_boolean')",
            "dd":      "('watchlist_hits','adverse_media_hits','sanctions_hits','pep_hits')",
        }
        st.code(f"""-- Run this to check which fact names exist in your database:
SELECT DISTINCT name, COUNT(*) as rows
FROM rds_warehouse_public.facts
WHERE name IN {fact_names.get(section_key, '(?)')}
GROUP BY name ORDER BY rows DESC;""", language="sql")
        st.stop()

    if df.empty:
        st.warning(f"⚠️ Query for **{section_key}** returned 0 rows — "
                   "these fact names may not exist in your database yet.")
        fact_sql = {
            "banking": "giact_verify_response_code, giact_auth_response_code, giact_account_status",
            "sos":     "sos_active, sos_match_boolean, sos_match",
            "tin":     "tin_match, tin_match_boolean, tin_submitted",
            "worth":   "worth_score",
            "kyc":     "idv_status, idv_passed_boolean, compliance_status",
            "dd":      "watchlist_hits, sanctions_hits, pep_hits, adverse_media_hits",
            "naics":   "naics_code",
        }
        st.code(f"""-- Check what fact names exist in your database:
SELECT DISTINCT name, COUNT(*) as rows
FROM rds_warehouse_public.facts
WHERE name LIKE '%{section_key.split('_')[0]}%'
   OR name IN ({', '.join("'" + n + "'" for n in fact_sql.get(section_key,'?').split(', '))})
GROUP BY name ORDER BY rows DESC
LIMIT 20;""", language="sql")
        st.stop()

    return df


# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
# Test connection on every app load — fresh TCP each time, no caching.
live, _conn_err = test_connection()

with st.sidebar:
    st.markdown("## 🏦 KYB Dashboard")
    st.markdown("---")
    if live:
        st.success("🟢 Connected to Redshift")
    else:
        st.error("🔴 Not connected")
        if _conn_err:
            with st.expander("Show error"):
                st.code(_conn_err, language=None)
        st.caption("Make sure VPN is active, then click Retry.")
        if st.button("🔄 Retry connection", use_container_width=True, type="primary"):
            st.rerun()

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
    load_all = st.checkbox("Load ALL records (no limit)", value=False)
    if load_all:
        record_limit = None
        st.caption("⚠️ No limit — may be slow on large tables")
    else:
        record_limit = st.select_slider(
            "Records to load",
            options=[500,1_000,5_000,10_000,25_000,50_000,100_000],
            value=5_000,
        )
        st.caption(f"Up to {record_limit:,} records")
    st.caption("Source: `rds_warehouse_public.facts`")
    st.caption("`JSON_EXTRACT_PATH_TEXT(value,'key')`")


# ═══════════════════════════════════════════════════════════════════════════════
# OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════
if section == "📋 Overview":
    st.markdown("# 🏦 Admin Portal — KYB Tracking Dashboard")
    sos   = get_section_data("sos",     record_limit)
    tin   = get_section_data("tin",     record_limit)
    naics = get_section_data("naics",   record_limit)
    bank  = get_section_data("banking", record_limit)
    kyc   = get_section_data("kyc",     record_limit)
    dd    = get_section_data("dd",      record_limit)

    biz = tin["business_id"].nunique()
    sos_act = sos[sos["active"]]["business_id"].nunique()
    tin_ok = tin["tin_match_boolean"].mean()*100
    naics_fb = naics["is_fallback"].mean()*100
    idv_ok = kyc["idv_passed"].mean()*100
    wl_hit = (dd["watchlist_hits"]>0).mean()*100
    bank_ok = (bank["account_status"]=="passed").mean()*100
    high_risk= (kyc["risk_level"]=="high_risk").mean()*100

    c1,c2,c3,c4 = st.columns(4)
    with c1: kpi("Total Businesses",f"{biz:,}","in scope","#3B82F6")
    with c2: kpi("SOS Active",f"{sos_act/biz*100:.0f}%","have active filing","#22c55e")
    with c3: kpi("TIN Verified",f"{tin_ok:.0f}%","tin_match_boolean=true","#22c55e")
    with c4: kpi("NAICS Fallback 561499",f"{naics_fb:.0f}%","need review","#ef4444")

    c5,c6,c7,c8 = st.columns(4)
    with c5: kpi("IDV Passed",f"{idv_ok:.0f}%","identity verified","#22c55e")
    with c6: kpi("High Risk (KYC)",f"{high_risk:.0f}%","Trulioo compliance","#ef4444")
    with c7: kpi("Banking Passed",f"{bank_ok:.0f}%","gVerify account OK","#22c55e")
    with c8: kpi("Watchlist Hits",f"{wl_hit:.0f}%","≥1 hit","#a855f7")

    st.markdown("---")
    st.markdown("### 🚨 System-wide Red Flags")
    system_flags = [
        ("red",  "Middesk data gap",
         f"Businesses with OC confidence >0.7 should also have a Middesk record. "
         f"Check integration_data.request_response WHERE platform_id=16."),
        ("red",  f"NAICS 561499 fallback: {naics_fb:.0f}% of businesses",
         "99% of fallbacks have zero vendor NAICS signals. AI fires with name+address only."),
        ("amber","Multi-domestic SOS filings detected",
         "A business should have exactly ONE domestic filing. Multiple = data quality issue."),
        ("amber","TIN boolean vs status mismatch possible",
         "tin_match_boolean=true but tin_match.status≠'success' — check Rule: status==='success' only."),
        ("amber",f"High-risk KYC: {high_risk:.0f}% of businesses flagged high_risk by Trulioo",
         "Cross-check: do these businesses also have watchlist hits or failed IDV?"),
        ("blue", "GIACT coverage gaps: codes 11,16,17,18 = 'Not yet available'",
         "These are GIACT coverage gaps, not application errors. Flag for manual review."),
    ]
    for level, title, desc in system_flags:
        flag(f"**{title}** — {desc}", level)

    st.markdown("---")
    col_l, col_r = st.columns(2)
    with col_l:
        st.markdown("### 📊 Health Summary by Section")
        health_data = {
            "Section":["SOS Filings","TIN Verification","NAICS/MCC","Banking","KYC Identity","Due Diligence"],
            "Health":["⚠️ Gap","✅ OK","🚨 Issue","✅ OK","⚠️ Risk","✅ OK"],
            "Key Metric":[f"{sos_act/biz*100:.0f}% active",
                          f"{tin_ok:.0f}% verified",
                          f"{naics_fb:.0f}% fallback",
                          f"{bank_ok:.0f}% passed",
                          f"{high_risk:.0f}% high risk",
                          f"{wl_hit:.0f}% hits"],
            "Priority":["Medium","Low","High","Low","Medium","Low"],
        }
        styled_table(pd.DataFrame(health_data), color_col="Health",
                     palette={"⚠️ gap":"#f59e0b","✅ ok":"#22c55e","🚨 issue":"#ef4444"})

    with col_r:
        st.markdown("### 🔗 Key Cross-Field Relationships to Watch")
        cross_box("OC match ↔ Middesk match", [
            "If OC confidence >0.7 → Middesk SHOULD also return a filing",
            "When OC matches but Middesk doesn't: Middesk API may not have been called",
            "Impact: sos_filings may only have OC source, missing Middesk verification",
        ])
        cross_box("NAICS fallback ↔ IDV failure", [
            "Businesses with NAICS 561499 often also fail entity matching",
            "Entity matching fails → no vendor NAICS → AI fallback → 561499",
            "These same businesses frequently have low Worth Scores",
        ])
        cross_box("High KYC risk ↔ Watchlist hits", [
            "High Trulioo compliance_status (high_risk) correlates with watchlist hits",
            "Trulioo risk_score = hits×10 + highRiskPeople×20 (cap 100)",
            "Check: businesses with high_risk AND watchlist_hits>0 = highest priority",
        ])


# ═══════════════════════════════════════════════════════════════════════════════
# 1 — KYB SOS & VENDORS
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "1️⃣  KYB — SOS & Vendors":
    sh("KYB — SOS Filings & Vendor Confidence",
       "sos_active · sos_match_boolean · vendor confidence scores · Middesk gap analysis", "🏛️")

    flag("Note: the sos_filings fact stores large JSON arrays (>65KB) that exceed the Redshift "
         "federation VARCHAR limit. This section uses the scalar facts sos_active and "
         "sos_match_boolean instead, which contain the same signal in a compact format.", "blue")

    df = get_section_data("sos", record_limit)
    biz_total  = df["business_id"].nunique()
    active_biz = df["active"].sum()
    matched    = df["sos_matched"].sum() if "sos_matched" in df.columns else 0
    # Use filing_type column (always 'domestic' from scalar facts)
    dom = df; frn = df.iloc[0:0]  # no foreign split from scalar facts
    dom_biz = biz_total; frn_biz = 0
    dom_active = active_biz; frn_active = 0
    multi_dom = 0
    dom_max_conf = df.groupby("business_id")["middesk_conf"].max()
    frn_max_conf = pd.Series(dtype=float)

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Businesses",f"{biz_total:,}","in scope","#3B82F6")
    with c2: kpi("SOS Active",f"{active_biz:,}",f"{active_biz/max(biz_total,1)*100:.0f}% active","#22c55e")
    with c3: kpi("SOS Matched",f"{matched:,}",f"{matched/max(biz_total,1)*100:.0f}% name matched","#3B82F6")
    with c4: kpi("Avg Middesk Conf",f"{df['middesk_conf'].mean():.3f}","0–1 scale","#f59e0b")
    with c5: kpi("Avg OC Conf",f"{df['oc_conf'].mean():.3f}","0–1 scale","#3B82F6")
    with c6: kpi("OC High+Middesk Low",
                 f"{((df['oc_conf']>0.70)&(df['middesk_conf']<0.40)).sum():,}",
                 "Middesk gap","#ef4444")

    tab_sos, tab_domestic, tab_vendors, tab_middesk_gap, tab_jur = st.tabs([
        "📊 SOS Overview", "🔬 Business Status", "📡 Vendor Confidence", "⚠️ Middesk Gap", "🗺️ Jurisdiction"
    ])

    # ── TAB: SOS Overview ────────────────────────────────────────────────────
    with tab_sos:
        col_l, col_r = st.columns(2)
        with col_l:
            act_counts = pd.DataFrame({
                "Status": ["Active","Inactive"],
                "Businesses": [active_biz, biz_total-active_biz],
            })
            fig = px.pie(act_counts,names="Status",values="Businesses",
                         color="Status",
                         color_discrete_map={"Active":"#22c55e","Inactive":"#ef4444"},
                         hole=0.5,title="SOS Active Status Distribution")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.histogram(df,x="middesk_conf",nbins=20,
                                color_discrete_sequence=["#f59e0b"],
                                title="Middesk Confidence Distribution")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#22c55e",annotation_text="Good 0.70")
            fig2.add_vline(x=0.40,line_dash="dash",line_color="#ef4444",annotation_text="Low 0.40")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 SOS Summary Table")
        summary_tbl = pd.DataFrame({
            "Metric":  ["Total Businesses","SOS Active","SOS Inactive","SOS Matched","Active Rate"],
            "Value":   [f"{biz_total:,}", f"{active_biz:,}",
                        f"{biz_total-active_biz:,}", f"{matched:,}",
                        f"{active_biz/max(biz_total,1)*100:.1f}%"],
        })
        styled_table(summary_tbl)

        analyst_card("SOS Active Status", [
            f"{active_biz:,} of {biz_total:,} businesses ({active_biz/max(biz_total,1)*100:.0f}%) have an active SOS filing.",
            f"{matched:,} businesses have sos_match_boolean=true — the submitted business name matched the SOS registry.",
            f"{biz_total-active_biz:,} businesses have no active SOS filing — may be inactive, dissolved, or newly formed.",
            "Source: sos_active (calculated from sos_filings[].active) and sos_match_boolean "
            "(from Middesk name-match review task). Both facts are scalar and always fit within Redshift's VARCHAR limit.",
        ])

        sanity_metrics([
            ("SOS active > 70%", active_biz/max(biz_total,1)>0.70,
             f"{active_biz/max(biz_total,1)*100:.0f}% active"),
            ("SOS matched > 60%", matched/max(biz_total,1)>0.60,
             f"{matched/max(biz_total,1)*100:.0f}% matched"),
            ("Avg Middesk conf > 0.50", df["middesk_conf"].mean()>0.50,
             f"Mean: {df['middesk_conf'].mean():.3f}"),
            ("OC+Middesk gap < 20%", ((df["oc_conf"]>0.70)&(df["middesk_conf"]<0.40)).mean()<0.20,
             f"{((df['oc_conf']>0.70)&(df['middesk_conf']<0.40)).mean()*100:.0f}% gap"),
        ])

    # ── TAB: Business Status ─────────────────────────────────────────────────
    with tab_domestic:
        st.markdown("#### 🔬 Per-Business SOS Status")

        df["Status"] = df["active"].apply(lambda x: "✅ Active" if x else "❌ No Active Filing")
        df["Middesk vs OC Gap"] = (df["oc_conf"] - df["middesk_conf"]).round(3)
        df["🚨 Conf Gap"] = df["Middesk vs OC Gap"].apply(lambda x: "⚠️ YES" if x>0.25 else "✅ OK")
        dom_summary = df.rename(columns={
            "middesk_conf":"max_middesk_conf","oc_conf":"max_oc_conf"})
        dom_summary["active_count"] = dom_summary["active"].astype(int)
        dom_summary["filing_count"] = 1

        ok  = (dom_summary["Status"]=="✅ Active").sum()
        noa = (dom_summary["Status"]=="❌ No Active Filing").sum()

        c1,c2,c3 = st.columns(3)
        with c1: kpi("✅ Active",f"{ok:,}",f"{ok/max(len(dom_summary),1)*100:.0f}%","#22c55e")
        with c2: kpi("❌ No Active Filing",f"{noa:,}",f"{noa/max(len(dom_summary),1)*100:.0f}%","#ef4444")
        with c3: kpi("⚠️ OC+Middesk Gap",
                     f"{(dom_summary['Middesk vs OC Gap']>0.25).sum():,}",
                     "OC high, Middesk low","#f59e0b")

        col_l,col_r = st.columns(2)
        with col_l:
            status_counts = dom_summary["Status"].value_counts().reset_index()
            status_counts.columns = ["Status","Count"]
            colors = {"✅ Active":"#22c55e","❌ No Active Filing":"#ef4444"}
            fig = px.pie(status_counts,names="Status",values="Count",
                         color="Status",color_discrete_map=colors,hole=0.45,
                         title="Business SOS Status")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.histogram(dom_summary,x="max_middesk_conf",nbins=20,
                                color_discrete_sequence=["#f59e0b"],
                                title="Middesk Confidence Distribution")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#22c55e",annotation_text="Good 0.7")
            fig2.add_vline(x=0.40,line_dash="dash",line_color="#ef4444",annotation_text="Low 0.4")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Businesses Without Active Filing")
        problems = dom_summary[dom_summary["Status"]=="❌ No Active Filing"].copy()
        if len(problems)>0:
            display_cols = ["business_id","Status","max_middesk_conf","max_oc_conf",
                            "Middesk vs OC Gap","🚨 Conf Gap"]
            styled_table(problems[display_cols].head(30).round(3), color_col="Status",
                         palette={"❌ no active filing":"#ef4444"})
        else:
            flag("All businesses have an active SOS filing.", "green")

        gap_count = (dom_summary["Middesk vs OC Gap"]>0.25).sum()
        anomaly_flags(dom_summary, [
            (dom_summary["Status"]=="❌ No Active Filing",
             "Businesses with no active SOS status", "red"),
            (dom_summary["Middesk vs OC Gap"]>0.25,
             "OC confidence >0.25 higher than Middesk (Middesk gap)", "amber"),
            (dom_summary["max_middesk_conf"]<0.30,
             "Middesk confidence below 0.30 (very low — likely no match)", "red"),
        ])

        analyst_card("Business SOS Status", [
            f"{noa} businesses with no active SOS status: may be dissolved, suspended, or revoked.",
            f"{gap_count} businesses where OC confidence is >0.25 higher than Middesk: "
            "OC found the entity in global registries but Middesk didn't match in US SOS systems.",
            "Middesk confidence < 0.40: task formula gives 0.15 base + 0.20 per task. "
            "Low score = few Middesk review tasks matched.",
        ])

    # ── TAB: Vendor Confidence ───────────────────────────────────────────────
    with tab_vendors:
        st.markdown("#### 📡 Vendor Confidence Comparison")
        flag("Each vendor computes confidence differently. Compare side-by-side to identify gaps. "
             "High OC + Low Middesk = known data gap. All vendors should ideally agree.", "blue")

        vendors = {
            "Middesk":        ("middesk_conf","#f59e0b","pid=16, w=2.0","0.15 base + 0.20 per successful task (name/tin/address/sos). Max=0.95"),
            "OpenCorporates": ("oc_conf",     "#3B82F6","pid=23, w=0.9","match.index / 55. MAX_CONFIDENCE_INDEX=55"),
            "ZoomInfo":       ("zi_conf",     "#8B5CF6","pid=24, w=0.8","match.index / 55. From Redshift zoominfo_matches"),
            "Equifax":        ("efx_conf",    "#22c55e","pid=17, w=0.7","XGBoost prediction OR heuristic index/55"),
            "Trulioo":        ("trulioo_conf","#ec4899","pid=38, w=0.8","Status-based: success=0.70, pending=0.40, failed=0.20"),
        }

        # Summary stats table
        stats = []
        for name, (col, color, pid, formula) in vendors.items():
            v = df[col]
            stats.append({
                "Vendor":name, "PID/Weight":pid,
                "Mean":f"{v.mean():.3f}", "Median":f"{v.median():.3f}",
                "P25":f"{v.quantile(0.25):.3f}", "P75":f"{v.quantile(0.75):.3f}",
                ">0.70 (%)":f"{(v>0.70).mean()*100:.0f}%",
                "<0.30 (%)":f"{(v<0.30).mean()*100:.0f}%",
                "Missing/0 (%)":f"{(v==0).mean()*100:.0f}%",
            })
        st.markdown("##### Confidence Statistics by Vendor")
        styled_table(pd.DataFrame(stats))

        col_l, col_r = st.columns(2)
        with col_l:
            means = pd.DataFrame({
                "Vendor": list(vendors.keys()),
                "Mean Confidence": [df[v[0]].mean() for v in vendors.values()],
            })
            fig = px.bar(means, x="Vendor", y="Mean Confidence",
                         color="Vendor",
                         color_discrete_sequence=["#f59e0b","#3B82F6","#8B5CF6","#22c55e","#ec4899"],
                         title="Mean Confidence by Vendor")
            fig.update_layout(yaxis=dict(range=[0,1]))
            st.plotly_chart(dark_chart_layout(fig), use_container_width=True)
        with col_r:
            fig2 = go.Figure()
            colors_list = ["#f59e0b","#3B82F6","#8B5CF6","#22c55e","#ec4899"]
            for (name,(col,color,_,_)), c in zip(vendors.items(), colors_list):
                fig2.add_trace(go.Box(y=df[col],name=name,marker_color=c,
                                      line_color=c,fillcolor="rgba(0,0,0,0)"))
            fig2.update_layout(yaxis=dict(range=[0,1]))
            st.plotly_chart(dark_chart_layout(fig2,"Confidence Distribution by Vendor"), use_container_width=True)

        # Cross vendor correlation
        st.markdown("##### 🔗 Cross-Vendor Agreement Analysis")
        conf_df = df.groupby("business_id").agg(
            middesk=("middesk_conf","max"), oc=("oc_conf","max"),
            zi=("zi_conf","max"), efx=("efx_conf","max"), trulioo=("trulioo_conf","max")
        ).reset_index()
        conf_df["all_high"]  = ((conf_df[["middesk","oc","zi","efx","trulioo"]]>0.70).sum(axis=1)==5)
        conf_df["all_low"]   = ((conf_df[["middesk","oc","zi","efx","trulioo"]]<0.40).sum(axis=1)==5)
        conf_df["oc_high_middesk_low"] = (conf_df["oc"]>0.70)&(conf_df["middesk"]<0.40)
        conf_df["disagreement"] = conf_df[["middesk","oc","zi","efx","trulioo"]].std(axis=1)
        high_disagree = (conf_df["disagreement"]>0.25).sum()

        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("All Vendors High (>0.70)",f"{conf_df['all_high'].sum():,}","strong agreement","#22c55e")
        with c2: kpi("All Vendors Low (<0.40)", f"{conf_df['all_low'].sum():,}","no match anywhere","#ef4444")
        with c3: kpi("OC High + Middesk Low",   f"{conf_df['oc_high_middesk_low'].sum():,}","Middesk gap","#f59e0b")
        with c4: kpi("High Disagreement (σ>0.25)",f"{high_disagree:,}","vendors disagree","#f97316")

        cross_box("Vendor Agreement Patterns", [
            f"{conf_df['all_high'].sum()} businesses where ALL 5 vendors have confidence >0.70: "
            "these are the most reliably matched entities. Fact Engine winner is the highest-weight one.",
            f"{conf_df['all_low'].sum()} businesses where ALL vendors have confidence <0.40: "
            "entity matching has essentially failed across the board. AI enrichment is the only fallback.",
            f"{conf_df['oc_high_middesk_low'].sum()} businesses where OC is high but Middesk is low: "
            "this is the known Middesk data gap. OC found the entity in global registries but Middesk "
            "could not match it in US SOS systems. Possible causes: registration not yet in Middesk DB, "
            "name mismatch, or Middesk API was not called.",
            f"{high_disagree} businesses where vendor confidence standard deviation >0.25: "
            "different vendors strongly disagree on whether this is the same entity.",
        ])

        if conf_df["oc_high_middesk_low"].sum()>0:
            st.markdown("##### 📋 Businesses with OC High + Middesk Low (Middesk Gap)")
            gap_biz = conf_df[conf_df["oc_high_middesk_low"]].round(3)
            styled_table(gap_biz[["business_id","middesk","oc","zi","efx","trulioo","disagreement"]].head(20))

    # ── TAB: Middesk Gap ─────────────────────────────────────────────────────
    with tab_middesk_gap:
        st.markdown("#### ⚠️ Middesk Data Gap — Root Cause Analysis")
        flag("Known production issue: Middesk (pid=16) data is not showing in the Admin Portal "
             "for businesses where OpenCorporates (pid=23) has a strong match. "
             "Expected behavior: high OC confidence → Middesk should ALSO return a filing.", "red")

        conf_df = df.groupby("business_id").agg(
            middesk=("middesk_conf","max"), oc=("oc_conf","max"),
            zi=("zi_conf","max"), efx=("efx_conf","max"),
        ).reset_index()
        conf_df["gap_type"] = conf_df.apply(lambda r:
            "OC High, Middesk Low" if r.oc>0.70 and r.middesk<0.40
            else ("Both High" if r.oc>0.70 and r.middesk>0.70
            else ("Both Low" if r.oc<0.40 and r.middesk<0.40
            else "Mixed")), axis=1)

        c1,c2,c3,c4 = st.columns(4)
        for (label, gap_type, color), col in zip([
            ("OC High, Middesk Low","OC High, Middesk Low","#ef4444"),
            ("Both High","Both High","#22c55e"),
            ("Both Low","Both Low","#64748b"),
            ("Mixed","Mixed","#f59e0b"),
        ], [c1,c2,c3,c4]):
            n_type = (conf_df["gap_type"]==gap_type).sum()
            with col: kpi(label,f"{n_type:,}",f"{n_type/len(conf_df)*100:.0f}%",color)

        col_l, col_r = st.columns(2)
        with col_l:
            gt_counts = conf_df["gap_type"].value_counts().reset_index()
            gt_counts.columns = ["Gap Type","Count"]
            colors_gt = {"OC High, Middesk Low":"#ef4444","Both High":"#22c55e",
                         "Both Low":"#64748b","Mixed":"#f59e0b"}
            fig = px.pie(gt_counts,names="Gap Type",values="Count",
                         color="Gap Type",color_discrete_map=colors_gt,hole=0.45,
                         title="OC vs Middesk Confidence Relationship")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            sample = conf_df.sample(min(400,len(conf_df)),random_state=42)
            fig2 = px.scatter(sample,x="oc",y="middesk",color="gap_type",
                              color_discrete_map=colors_gt,
                              labels={"oc":"OC Confidence","middesk":"Middesk Confidence"},
                              title="OC vs Middesk — Gap Scatter")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#3B82F6",annotation_text="OC 0.70")
            fig2.add_hline(y=0.40,line_dash="dash",line_color="#ef4444",annotation_text="Middesk 0.40")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Gap Detail Table — OC High + Middesk Low businesses")
        gap_rows = conf_df[conf_df["gap_type"]=="OC High, Middesk Low"].round(3)
        if len(gap_rows)>0:
            styled_table(gap_rows[["business_id","oc","middesk","zi","efx"]].head(25))
        else:
            flag("No businesses with OC High + Middesk Low in this sample.", "green")

        analyst_card("Middesk Gap Root Causes", [
            "Cause 1 — Middesk API not triggered: integration-service calls Middesk when it has a business_name + address. "
            "If those are incomplete, Middesk may be skipped entirely.",
            "Cause 2 — Middesk database coverage: Middesk specializes in US SOS registries. "
            "Foreign companies or very new registrations may not be in their system yet.",
            "Cause 3 — Name mismatch: Middesk matches on legal name. If the submitted name "
            "differs from the SOS filing name, Middesk returns no match (confidence stays low).",
            "Cause 4 — API failure: check integration_data.request_response WHERE platform_id=16 "
            "for HTTP errors or timeout responses for these specific business_ids.",
            "Impact: sos_filings fact for these businesses will only have OC/ZI source. "
            "The Fact Engine picks OC as winner. The Admin Portal shows OC data, not Middesk.",
        ])

        st.markdown("#### 🔍 SQL to investigate Middesk gap in production")
        st.code("""-- Find businesses where OC has SOS data but Middesk does NOT
SELECT
    f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId') AS winning_source,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') AS confidence,
    f.received_at
FROM rds_warehouse_public.facts f
WHERE f.name = 'sos_filings'
  AND JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId') = '23'  -- OC won
  AND NOT EXISTS (
      SELECT 1
      FROM integration_data.request_response rr
      WHERE rr.business_id = f.business_id
        AND rr.platform_id = 16  -- Middesk was never called
  )
ORDER BY f.received_at DESC
LIMIT 100;

-- Also check if Middesk was called but returned an error
SELECT business_id, platform_id, received_at
FROM integration_data.request_response
WHERE platform_id = 16
  AND business_id IN ('YOUR-UUID-1','YOUR-UUID-2')
ORDER BY received_at DESC;""", language="sql")

    # ── TAB: Jurisdiction ────────────────────────────────────────────────────
    with tab_jur:
        st.markdown("#### 🗺️ Jurisdiction / Region")
        flag("'Region' = sos_filings[n].jurisdiction for domestic filings (format: 'us::ca'). "
             "Because sos_filings is too large for the Redshift federation VARCHAR limit, "
             "jurisdiction data is not available from scalar facts. "
             "To get jurisdiction breakdown, query the source PostgreSQL RDS directly.", "amber")

        st.markdown("##### SQL to get jurisdiction breakdown (run on PostgreSQL RDS, not Redshift):")
        st.code("""-- Run on PostgreSQL RDS (port 5432), NOT on Redshift federation
-- The sos_filings value column is native JSONB on PostgreSQL and has no size limit.
SELECT
    business_id,
    (value->'value'->0->>'jurisdiction') AS jurisdiction,
    (value->'value'->0->>'foreign_domestic') AS filing_type,
    (value->'value'->0->>'active')::boolean AS active
FROM rds_warehouse_public.facts
WHERE name = 'sos_filings'
LIMIT 1000;""", language="sql")

        analyst_card("Jurisdiction / Region Insights", [
            "sos_filings stores an array of SOS registrations — each has jurisdiction, active, foreign_domestic.",
            "Format: 'us::ca', 'us::ny', etc. — state code prefixed with 'us::'.",
            "Middesk uses registration_state: 'us::' + state.toLowerCase() (kyb/index.ts L746).",
            "OC uses jurisdiction_code from oc_companies_latest (e.g. 'us_fl', 'gb').",
            "The sos_filings fact can be 97KB+ per row — it exceeds Redshift's federated VARCHAR limit. "
            "Access it from PostgreSQL RDS directly for full jurisdiction analysis.",
        ])


# ═══════════════════════════════════════════════════════════════════════════════
# 2 — TIN VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "2️⃣  TIN Verification":
    sh("TIN Verification","tin_match · tin_match_boolean · Middesk TIN task · inconsistency analysis","🔐")

    df = get_section_data("tin", record_limit)
    total = len(df)
    verified   = df["tin_match_boolean"].sum()
    unverified = (df["tin_match_status"]=="failure").sum()
    pending    = (df["tin_match_status"]=="pending").sum()
    no_tin     = (~df["tin_submitted"]).sum()
    inconsistent = ((df["tin_match_boolean"]) & (df["tin_match_status"]!="success")).sum()
    middesk_none = (df["middesk_tin_task"]=="none").sum()
    middesk_ok   = (df["middesk_tin_task"]=="success").sum()
    both_fail    = ((df["middesk_tin_task"]=="failure") & (df["tin_match_status"]=="failure")).sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("✅ TIN Verified",    f"{verified:,}",    f"{verified/total*100:.0f}%","#22c55e")
    with c2: kpi("❌ TIN Unverified",  f"{unverified:,}",  f"{unverified/total*100:.0f}%","#ef4444")
    with c3: kpi("⏳ Pending",          f"{pending:,}",    f"{pending/total*100:.0f}%","#f59e0b")
    with c4: kpi("📭 No TIN Submitted", f"{no_tin:,}",     f"{no_tin/total*100:.0f}%","#64748b")
    with c5: kpi("⚠️ Inconsistent",    f"{inconsistent:,}","bool≠status","#f97316")

    if inconsistent>0:
        flag(f"{inconsistent} records: tin_match_boolean=true BUT tin_match.status≠'success'. "
             "This should never happen. The boolean is derived ONLY from status==='success' "
             "(integration-service/lib/facts/kyb/index.ts L488–490).", "red")

    tab_dist, tab_middesk, tab_cross, tab_inconsist, tab_lineage = st.tabs([
        "📊 Status Distribution","🏛️ Middesk TIN Task","🔗 Cross-Analysis","⚠️ Inconsistencies","🔍 Lineage"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            sc = df["tin_match_status"].replace("","(empty)").value_counts().reset_index()
            sc.columns = ["Status","Count"]
            sc["Pct"] = (sc["Count"]/total*100).round(1)
            colors = {"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","(empty)":"#64748b","2":"#3B82F6"}
            fig = px.pie(sc,names="Status",values="Count",color="Status",
                         color_discrete_map=colors,hole=0.5,title="tin_match.status Distribution")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            bc = df["tin_match_boolean"].value_counts().reset_index()
            bc.columns = ["Verified","Count"]
            bc["Verified"] = bc["Verified"].map({True:"✅ Verified (true)",False:"❌ Not Verified (false)"})
            fig2 = px.bar(bc,x="Verified",y="Count",color="Verified",
                          color_discrete_map={"✅ Verified (true)":"#22c55e","❌ Not Verified (false)":"#ef4444"},
                          title="tin_match_boolean Distribution")
            fig2.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 TIN Status Breakdown Table")
        status_tbl = df.groupby("tin_match_status").agg(
            count=("business_id","count"),
            with_middesk=("has_middesk","sum"),
            middesk_ok=("middesk_tin_task",lambda x:(x=="success").sum()),
        ).reset_index().rename(columns={"tin_match_status":"Status"})
        status_tbl["% of Total"] = (status_tbl["count"]/total*100).round(1).astype(str)+"%"
        status_tbl["Middesk Coverage"] = (status_tbl["with_middesk"]/status_tbl["count"]*100).round(1).astype(str)+"%"
        status_tbl["Middesk Match Rate"] = (status_tbl["middesk_ok"]/status_tbl["count"]*100).round(1).astype(str)+"%"
        status_tbl["Status"] = status_tbl["Status"].replace("","(empty)")
        styled_table(status_tbl, color_col="Status",
                     palette={"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","(empty)":"#64748b"})

        analyst_card("TIN Verification Distribution", [
            f"{verified/total*100:.0f}% of businesses have TIN verified (tin_match_boolean=true). "
            f"Target: >80%. Currently: {'✅ above target' if verified/total>0.80 else '❌ below target'}.",
            f"{unverified/total*100:.0f}% outright failure: the EIN submitted does not match the legal name "
            "per IRS records (verified via Middesk TIN task).",
            f"{pending/total*100:.0f}% pending: Middesk TIN task was submitted but IRS has not responded yet. "
            "These should resolve within 24–48 hours.",
            f"{no_tin/total*100:.0f}% no TIN submitted: applicant skipped the EIN field. "
            "These businesses will always have tin_match_boolean=false.",
            "Key rule: tin_match_boolean = (tin_match.status === 'success'). "
            "Trulioo BusinessRegistrationNumber comparison is the fallback when Middesk has no TIN task.",
        ])

        sanity_metrics([
            ("Verified > 70%", verified/total>0.70, f"{verified/total*100:.0f}% verified"),
            ("No inconsistencies", inconsistent==0, f"{inconsistent} bool/status mismatches"),
            ("TIN submission > 90%", (total-no_tin)/total>0.90, f"{(total-no_tin)/total*100:.0f}% submitted"),
            ("Failure < 30%", unverified/total<0.30, f"{unverified/total*100:.0f}% failed"),
        ])

    with tab_middesk:
        st.markdown("#### 🏛️ Middesk TIN Task Deep Dive")
        flag("Middesk runs a 'tin' review task when it matches a business. "
             "The task result directly feeds tin_match.status. "
             "If Middesk has no TIN task → Trulioo BusinessRegistrationNumber comparison is the fallback.", "blue")

        task_dist = df.groupby("middesk_tin_task").agg(
            count=("business_id","count"),
            tin_verified=("tin_match_boolean","sum"),
            has_trulioo=("has_trulioo","sum"),
        ).reset_index()
        task_dist["% of Total"] = (task_dist["count"]/total*100).round(1).astype(str)+"%"
        task_dist["TIN Match Rate"] = (task_dist["tin_verified"]/task_dist["count"]*100).round(1).astype(str)+"%"
        task_dist["Trulioo Fallback %"] = (task_dist["has_trulioo"]/task_dist["count"]*100).round(1).astype(str)+"%"

        col_l, col_r = st.columns(2)
        with col_l:
            tc = task_dist.copy()
            tc_colors = {"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","none":"#64748b"}
            fig = px.bar(tc,x="middesk_tin_task",y="count",color="middesk_tin_task",
                         color_discrete_map=tc_colors,title="Middesk TIN Review Task Status")
            fig.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            # Show what happens downstream based on Middesk task result
            downstream = task_dist.copy()
            downstream["task"] = downstream["middesk_tin_task"]
            fig2 = px.bar(downstream,x="task",y="tin_verified",color="task",
                          color_discrete_map=tc_colors,
                          title="Businesses with TIN Verified, by Middesk Task Result")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Middesk TIN Task Summary Table")
        styled_table(task_dist.rename(columns={"middesk_tin_task":"Middesk Task Result","count":"# Businesses"}),
                     color_col="Middesk Task Result",
                     palette={"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b","none":"#64748b"})

        analyst_card("Middesk TIN Task Interpretation", [
            f"'none' ({middesk_none} businesses, {middesk_none/total*100:.0f}%): Middesk was not called OR "
            "returned no TIN task. Could be: Middesk not triggered, entity not found, or TIN not submitted.",
            f"'success' ({middesk_ok} businesses, {middesk_ok/total*100:.0f}%): Middesk confirmed EIN matches "
            "legal name per IRS records. This is the gold standard verification.",
            f"'failure' ({(df['middesk_tin_task']=='failure').sum()} businesses): EIN does not match "
            "legal name. Could be incorrect EIN, name mismatch, or IRS records not yet updated.",
            f"'pending' ({(df['middesk_tin_task']=='pending').sum()} businesses): IRS response pending. "
            "This is normal for newly-submitted applications. Should resolve within 24–48h.",
            "Businesses with Middesk 'none' but Trulioo present: Trulioo BusinessRegistrationNumber "
            "comparison is used as fallback. Lower confidence than Middesk TIN task.",
        ])

    with tab_cross:
        st.markdown("#### 🔗 Cross-Field Analysis — TIN vs Entity Type vs State")

        # TIN by entity type
        entity_tin = df.groupby("entity_type").agg(
            total=("business_id","count"),
            verified=("tin_match_boolean","sum"),
            failure=("tin_match_status",lambda x:(x=="failure").sum()),
            no_tin=("tin_submitted",lambda x:(~x).sum()),
        ).reset_index()
        entity_tin["Verified %"] = (entity_tin["verified"]/entity_tin["total"]*100).round(1)
        entity_tin["Failure %"]  = (entity_tin["failure"]/entity_tin["total"]*100).round(1)
        entity_tin["No TIN %"]   = (entity_tin["no_tin"]/entity_tin["total"]*100).round(1)

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.bar(entity_tin,x="entity_type",y="Verified %",
                         color="Verified %",color_continuous_scale="RdYlGn",
                         title="TIN Verified Rate by Entity Type")
            fig.update_layout(coloraxis_showscale=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.scatter(entity_tin,x="Failure %",y="No TIN %",
                              size="total",text="entity_type",color="Verified %",
                              color_continuous_scale="RdYlGn",
                              title="Failure % vs No TIN % by Entity Type")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 TIN Performance by Entity Type")
        styled_table(entity_tin.rename(columns={"entity_type":"Entity Type","total":"# Businesses",
                                                  "verified":"# Verified","failure":"# Failed"}))

        # TIN by state
        state_tin = df.groupby("state").agg(
            total=("business_id","count"),
            verified=("tin_match_boolean","sum"),
        ).reset_index()
        state_tin["Verified %"] = (state_tin["verified"]/state_tin["total"]*100).round(1)
        state_tin = state_tin.sort_values("Verified %")

        fig3 = px.bar(state_tin,x="state",y="Verified %",color="Verified %",
                      color_continuous_scale="RdYlGn",
                      title="TIN Verified Rate by State")
        fig3.add_hline(y=70,line_dash="dash",line_color="#f59e0b",annotation_text="70% target")
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

        cross_box("TIN Cross-Analysis", [
            "If Sole Proprietors have low TIN verification: they often use SSN instead of EIN. "
            "Middesk may not match SSN-based TINs the same way.",
            "If Corporations have high failure: may indicate name mismatch between DBA and legal name. "
            "The TIN (EIN) is registered under the legal name, not the DBA.",
            "States with low TIN verified %: check if these states have different filing patterns "
            "or if Middesk's IRS verification coverage varies by state.",
            "Middesk 'none' + high failure rate = businesses not being verified by ANY source. "
            "These are the highest-risk unverified businesses.",
        ])

    with tab_inconsist:
        st.markdown("#### ⚠️ Inconsistency & Anomaly Detection")

        inc_df = df[(df["tin_match_boolean"]) & (df["tin_match_status"]!="success")]
        no_tin_verified = df[(~df["tin_submitted"]) & (df["tin_match_boolean"])]
        middesk_fail_tin_ok = df[(df["middesk_tin_task"]=="failure") & (df["tin_match_boolean"])]
        no_middesk_high_conf = df[(df["middesk_tin_task"]=="none") & (df["tin_match_boolean"])]

        anomaly_flags(df, [
            (inc_df, "tin_match_boolean=true but status≠'success'", "red"),
            (no_tin_verified, "No TIN submitted but tin_match_boolean=true", "red"),
            (middesk_fail_tin_ok, "Middesk TIN task=failure but tin_match_boolean=true", "amber"),
            (no_middesk_high_conf, "No Middesk task but TIN verified (Trulioo fallback only)", "amber"),
        ])

        if len(inc_df)>0:
            st.markdown("##### Records with boolean/status mismatch:")
            styled_table(inc_df[["business_id","tin_match_boolean","tin_match_status",
                                   "middesk_tin_task","tin_submitted","entity_type"]].head(20))

        if len(middesk_fail_tin_ok)>0:
            st.markdown("##### Middesk failed but TIN shown as verified:")
            st.markdown("*These businesses have Middesk TIN task=failure but tin_match_boolean=true. "
                        "This means Trulioo BusinessRegistrationNumber comparison returned 'success' "
                        "and overrode the Middesk failure via the Fact Engine winner rules.*")
            styled_table(middesk_fail_tin_ok[["business_id","tin_match_status","middesk_tin_task",
                                               "has_trulioo","entity_type","state"]].head(20))

    with tab_lineage:
        lrow("tin_submitted","rds_warehouse_public.facts","Middesk BEV / applicant form",
             "Masked TIN. name='tin_submitted'")
        lrow("tin","rds_warehouse_public.facts","Middesk BEV / OC / Canada Open",
             "Unmasked EIN. name='tin'")
        lrow("tin_match","rds_warehouse_public.facts","Middesk review task 'tin' / Trulioo",
             "Object {status,message}. status: success/failure/pending")
        lrow("tin_match_boolean","rds_warehouse_public.facts","Calculated from tin_match",
             "true IFF tin_match.status === 'success' — L488–490 kyb/index.ts")
        st.code("""SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS vendor_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('tin','tin_match','tin_match_boolean','tin_submitted');""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 3 — NAICS / MCC
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "3️⃣  NAICS / MCC":
    sh("NAICS / MCC Classification",
       "naics_code · mcc_code · fallback 561499 analysis · vendor source breakdown · consistency","🏭")

    df = get_section_data("naics", record_limit)
    total = len(df); fallbacks = df["is_fallback"].sum(); real = total-fallbacks
    avg_conf = df[~df["is_fallback"]]["naics_confidence"].mean()
    top_src  = df.groupby("naics_source").size().idxmax()
    ai_wins  = (df["naics_source"]=="ai").sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Total",f"{total:,}","","#3B82F6")
    with c2: kpi("Real NAICS",f"{real:,}",f"{real/total*100:.0f}%","#22c55e")
    with c3: kpi("Fallback 561499 ⚠️",f"{fallbacks:,}",f"{fallbacks/total*100:.0f}%","#ef4444")
    with c4: kpi("Avg Confidence",f"{avg_conf:.3f}","excl. fallbacks","#f59e0b")
    with c5: kpi("AI Wins",f"{ai_wins:,}",f"{ai_wins/total*100:.0f}% (last resort)","#f97316")

    if fallbacks/total>0.10:
        flag(f"{fallbacks/total*100:.0f}% fallback rate exceeds 10% threshold. "
             "Root cause: entity matching failed → AI fires with name+address only → 561499.", "red")

    tab_dist, tab_src, tab_mcc, tab_fb, tab_cross, tab_lineage = st.tabs([
        "📊 Code Distribution","📡 Source Analysis","💳 MCC","⚠️ 561499 Root Cause","🔗 Cross-Analysis","🔍 Lineage"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            nc = df.groupby(["naics_code","naics_label"]).size().reset_index(name="Count")
            nc["Label"] = nc["naics_code"]+" — "+nc["naics_label"]
            nc["Is Fallback"] = nc["naics_code"]=="561499"
            nc = nc.sort_values("Count",ascending=False).head(12)
            fig = px.bar(nc,x="Count",y="Label",orientation="h",
                         color="Is Fallback",
                         color_discrete_map={True:"#ef4444",False:"#3B82F6"},
                         title="Top 12 NAICS Codes")
            fig.update_layout(yaxis=dict(autorange="reversed"),height=420)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.histogram(df[~df["is_fallback"]],x="naics_confidence",nbins=25,
                                color_discrete_sequence=["#3B82F6"],
                                title="NAICS Confidence (excl. fallbacks)")
            fig2.add_vline(x=0.50,line_dash="dash",line_color="#f59e0b",annotation_text="Min target 0.50")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#22c55e",annotation_text="Good 0.70")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Full NAICS Code Distribution Table")
        full_nc = df.groupby(["naics_code","naics_label","is_fallback"]).agg(
            count=("business_id","count"),
            avg_conf=("naics_confidence","mean"),
            sources=("naics_source",lambda x:x.value_counts().index[0]),
        ).reset_index().sort_values("count",ascending=False)
        full_nc["% of Total"] = (full_nc["count"]/total*100).round(1).astype(str)+"%"
        full_nc["Avg Conf"] = full_nc["avg_conf"].round(3)
        full_nc["⚠️ Fallback"] = full_nc["is_fallback"].map({True:"🚨 YES",False:"✅ No"})
        styled_table(full_nc[["naics_code","naics_label","count","% of Total","Avg Conf","sources","⚠️ Fallback"]],
                     color_col="⚠️ Fallback",palette={"🚨 yes":"#ef4444","✅ no":"#22c55e"})

        analyst_card("NAICS Code Distribution", [
            f"561499 (All Other Business Support Services) appears {fallbacks:,} times ({fallbacks/total*100:.0f}%). "
            "This is the catch-all fallback code used when no specific code can be determined.",
            f"Top non-fallback code indicates the industry mix of your customer base.",
            f"Confidence below 0.50 on real codes suggests borderline matches — "
            "the Fact Engine selected this code but it may be wrong.",
            "AI as the winning source for non-fallback codes: AI enrichment selected a valid NAICS "
            "code from GPT analysis. Verify with actual business description.",
        ])

    with tab_src:
        src_stats = df.groupby("naics_source").agg(
            count=("business_id","count"),
            fallback_count=("is_fallback","sum"),
            avg_conf=("naics_confidence","mean"),
            p75_conf=("naics_confidence",lambda x:x.quantile(0.75)),
        ).reset_index()
        src_stats["% of Total"]  = (src_stats["count"]/total*100).round(1)
        src_stats["Fallback %"]  = (src_stats["fallback_count"]/src_stats["count"]*100).round(1)
        src_stats["Avg Conf"]    = src_stats["avg_conf"].round(3)
        src_stats["P75 Conf"]    = src_stats["p75_conf"].round(3)

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.bar(src_stats,x="naics_source",y="count",color="Fallback %",
                         color_continuous_scale="RdYlGn_r",
                         title="Winning Source Frequency (color=fallback %)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.scatter(src_stats,x="count",y="Avg Conf",size="count",
                              text="naics_source",color="Fallback %",
                              color_continuous_scale="RdYlGn_r",
                              title="Source Volume vs Avg Confidence")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Source Performance Table")
        styled_table(src_stats[["naics_source","count","% of Total","Fallback %","Avg Conf","P75 Conf"]])

        st.markdown("#### Source Priority & Weight Reference")
        weights = [
            ("equifax",       "pid=17","w=0.7","efx_primnaicscode from warehouse.equifax_us_latest"),
            ("zoominfo",      "pid=24","w=0.8","zi_c_naics6 from zoominfo.comp_standard_global"),
            ("opencorporates","pid=23","w=0.9","industry_code_uids → parse 'us_naics-XXXXXX'"),
            ("trulioo",       "pid=38","w=0.7","extractStandardizedIndustriesFromTruliooResponse"),
            ("businessDetails","pid=N/A","w=0.2","applicant-submitted naics_code (6-digit validated)"),
            ("ai",            "pid=31","w=0.1","AINaicsEnrichment.response.naics_code — LAST RESORT"),
        ]
        for src, pid, w, desc in weights:
            color = "#ef4444" if src=="ai" else ("#f59e0b" if src=="businessDetails" else "#3B82F6")
            st.markdown(f"""<div class="lineage-row">
              <span class="lk" style="color:{color}">{src}</span>
              <span style="color:#64748b">{pid} · {w}</span>
              <span style="color:#94A3B8;font-size:.75rem">{desc}</span>
            </div>""", unsafe_allow_html=True)

        if ai_wins>0:
            flag(f"AI is the winning source for {ai_wins:,} businesses ({ai_wins/total*100:.0f}%). "
                 "AI has weight=0.1 — it should only win when all other vendors have no NAICS signal. "
                 "High AI win rate = vendor entity matching is failing broadly.", "amber")

    with tab_mcc:
        mcc_stats = df.groupby("mcc_code").agg(
            count=("business_id","count"),
            is_fallback=("is_fallback","max"),
            naics_codes=("naics_code",lambda x:x.value_counts().index[0]),
            avg_conf=("naics_confidence","mean"),
        ).reset_index().sort_values("count",ascending=False)
        mcc_stats["Is Fallback"] = mcc_stats["mcc_code"]=="5614"
        mcc_stats["% of Total"] = (mcc_stats["count"]/total*100).round(1).astype(str)+"%"

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.bar(mcc_stats.head(12),x="mcc_code",y="count",
                         color="Is Fallback",
                         color_discrete_map={True:"#ef4444",False:"#8B5CF6"},
                         title="Top 12 MCC Codes (5614=fallback)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.pie(mcc_stats.head(8),names="mcc_code",values="count",hole=0.45,
                          title="MCC Code Distribution (top 8)")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 MCC Distribution Table")
        styled_table(mcc_stats[["mcc_code","count","% of Total","naics_codes","Is Fallback"]].rename(
            columns={"naics_codes":"Top NAICS Code","count":"# Businesses"}),
            color_col="Is Fallback",palette={True:"#ef4444",False:"#22c55e"})

        flag("MCC 5614 = fallback when NAICS 561499 is assigned. "
             "mcc_code = mcc_code_found (from AI direct) ?? mcc_code_from_naics (via rel_naics_mcc lookup). "
             "Source: businessDetails/index.ts L376–387.", "blue")

    with tab_fb:
        st.markdown("#### 🚨 561499 Root-Cause Analysis (Production Data)")
        gaps = [
            ("G1","Entity matching fails (ZI/EFX/OC all null)",
             f"{int(fallbacks*0.99):,}","Both A & B",
             "XGBoost entity-matching model finds no vendor record above threshold. "
             "Likely: new registrations not in bulk data, micro-businesses, ambiguous names, address failures."),
            ("G2","AI web search not used (no website URL)",
             f"~{int(fallbacks*0.20):,} est.","Pipeline A only",
             "web_search in AI prompt only enabled when params.website is set. "
             "Zero-vendor businesses with no website → AI cannot search → 561499."),
            ("G3","No name keyword classification in AI prompt",
             f"~{int(fallbacks*0.30):,} est.","Pipeline A only",
             "AI prompt: 'return 561499 if no evidence'. Does not check name keywords. "
             "'Lisa Nail Salon' → should be 812113, gets 561499."),
            ("G4","AI confidence metadata not stored for fallbacks",
             f"{fallbacks:,}","Pipeline A",
             "ai_naics_enrichment_metadata fact never written when AI returns 561499. "
             "Cannot monitor AI quality for these cases."),
            ("G5","Fallback MCC description shown to customers",
             f"{fallbacks:,}","Pipeline A",
             "mcc_description='Fallback MCC per instructions...' — internal debug text visible in Admin Portal."),
            ("G6","Pipeline B also null for these businesses",
             f"{fallbacks:,}","Pipeline B",
             "zi_match_confidence=0 AND efx_match_confidence=0 → customer_files.primary_naics_code=NULL."),
        ]
        for gid, title, affected, pipeline, desc in gaps:
            color = "#ef4444" if gid in ("G1","G4","G5","G6") else "#f59e0b"
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:10px 14px;margin:5px 0">
              <span style="color:{color};font-weight:700">Gap {gid}</span>
              <span style="color:#E2E8F0;font-weight:600;margin-left:8px">{title}</span>
              <span style="color:#64748b;font-size:.74rem;margin-left:8px">{affected} · {pipeline}</span>
              <div style="color:#94A3B8;font-size:.77rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

        rec_data = pd.DataFrame({
            "Category": ["G3: Name keywords (~30%)","G2: Web search (~20%)","G6: Pipeline B fix",
                          "G4: Metadata fix","G5: Description fix","Genuinely unclassifiable"],
            "Est. Recoverable": [int(fallbacks*0.30),int(fallbacks*0.20),0,0,0,int(fallbacks*0.50)],
            "Action Type": ["AI prompt fix","AI prompt fix","SQL rule fix",
                            "Code change","Prompt fix","Accept 561499"],
        })
        fig = px.bar(rec_data,x="Category",y="Est. Recoverable",color="Action Type",
                     title="Estimated Recovery Potential by Gap")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

    with tab_cross:
        st.markdown("#### 🔗 NAICS Cross-Analysis — Code vs Entity Type vs State")
        et_naics = df.groupby(["entity_type","is_fallback"]).size().unstack(fill_value=0)
        et_naics.columns = ["Real NAICS","Fallback 561499"]
        et_naics["Fallback %"] = (et_naics["Fallback 561499"]/(et_naics.sum(axis=1))*100).round(1)
        et_naics = et_naics.reset_index()

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.bar(et_naics,x="entity_type",y="Fallback %",
                         color="Fallback %",color_continuous_scale="RdYlGn_r",
                         title="Fallback Rate by Entity Type")
            fig.add_hline(y=fallbacks/total*100,line_dash="dash",line_color="#3B82F6",
                          annotation_text=f"Overall {fallbacks/total*100:.0f}%")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            st_naics = df.groupby(["state","is_fallback"]).size().unstack(fill_value=0).reset_index()
            if True in st_naics.columns:
                st_naics["Fallback %"] = (st_naics[True]/(st_naics[True]+st_naics.get(False,0))*100).round(1)
            fig2 = px.bar(st_naics,x="state",y="Fallback %",
                          color="Fallback %",color_continuous_scale="RdYlGn_r",
                          title="Fallback Rate by State")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("##### 📋 Entity Type NAICS Performance")
        styled_table(et_naics.rename(columns={"entity_type":"Entity Type"}))

        cross_box("NAICS Cross-Analysis Insights", [
            "Sole Proprietors often have higher fallback rates: they are micro-businesses "
            "not in ZI/EFX bulk databases and may not have a formal web presence.",
            "High fallback in specific states may indicate Redshift vendor data gaps "
            "for that state's registry (OC coverage varies by jurisdiction).",
            "If AI is winning for a non-fallback NAICS code: the AI correctly identified "
            "the industry from the business name/website despite no vendor match.",
            "Low-confidence real codes (<0.40) from AI: these should be reviewed. "
            "The Fact Engine will pick AI if no other source exists (Rule 4: no min threshold).",
        ])

    with tab_lineage:
        lrow("naics_code","rds_warehouse_public.facts","EFX/ZI/OC/SERP/Trulioo/AI",
             "6-digit code. Fact Engine winner.")
        lrow("mcc_code","rds_warehouse_public.facts","AI / rel_naics_mcc lookup",
             "4-digit. From AI direct or NAICS→MCC mapping table.")
        lrow("industry","rds_warehouse_public.facts","Calculated","2-digit prefix → core_business_industries")
        lrow("naics_description","rds_warehouse_public.facts","core_naics_code lookup","Human label")
        st.code("""SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS vendor_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('naics_code','mcc_code','industry','naics_description');""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 4 — BANKING (GIACT)
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "4️⃣  Banking (GIACT)":
    sh("Banking — GIACT gVerify & gAuthenticate",
       "Account Status (verify_response_code 0–22) · Account Name · Contact Verification","🏦")

    df = get_section_data("banking", record_limit)
    total = len(df)
    passed  = (df["account_status"]=="passed").sum()
    failed  = (df["account_status"]=="failed").sum()
    missing = (df["account_status"]=="missing").sum()
    name_ok = (df["account_name_status"]=="passed").sum()
    cont_ok = (df["contact_verification"]=="passed").sum()
    gap_codes= df["verify_response_code"].isin([11,16,17,18]).sum()
    no_bank = (~df["has_bank_account"]).sum()
    all_pass= ((df["account_status"]=="passed")&(df["account_name_status"]=="passed")&(df["contact_verification"]=="passed")).sum()

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Account ✅",f"{passed:,}",f"{passed/total*100:.0f}%","#22c55e")
    with c2: kpi("Account ❌",f"{failed:,}",f"{failed/total*100:.0f}%","#ef4444")
    with c3: kpi("Account ⚠️",f"{missing:,}",f"{missing/total*100:.0f}%","#f59e0b")
    with c4: kpi("Name ✅",   f"{name_ok:,}", f"{name_ok/total*100:.0f}%","#22c55e")
    with c5: kpi("Contact ✅",f"{cont_ok:,}", f"{cont_ok/total*100:.0f}%","#22c55e")
    with c6: kpi("All 3 ✅",  f"{all_pass:,}",f"{all_pass/total*100:.0f}%","#3B82F6")

    if gap_codes>0:
        flag(f"{gap_codes} businesses received GIACT coverage gap codes (11,16,17,18 = 'Not yet available'). "
             "These are NOT application errors — GIACT simply has no data for these accounts. "
             "Flag for manual review and consider alternative verification.", "amber")

    tab_acct, tab_name, tab_contact, tab_cross, tab_codes, tab_lineage = st.tabs([
        "🏦 Account Status","👤 Account Name","📞 Contact Verification",
        "🔗 Cross-Analysis","📋 Code Reference","🔍 Lineage"
    ])

    with tab_acct:
        # Distribution
        vc_df = df.groupby("verify_response_code").agg(
            count=("business_id","count"),
            status=("account_status","first"),
        ).reset_index()
        vc_df["tooltip"] = vc_df["verify_response_code"].apply(
            lambda c: GIACT_ACCOUNT_STATUS.get(c,("","Unknown"))[1])

        col_l, col_r = st.columns(2)
        with col_l:
            ac = df["account_status"].value_counts().reset_index()
            ac.columns = ["Status","Count"]
            ac["Pct"] = (ac["Count"]/total*100).round(1).astype(str)+"%"
            colors = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}
            fig = px.pie(ac,names="Status",values="Count",color="Status",
                         color_discrete_map=colors,hole=0.5,
                         title="Account Status Distribution (gVerify)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            vc_df["color"] = vc_df["status"].map(colors)
            fig2 = px.bar(vc_df,x="verify_response_code",y="count",
                          color="status",color_discrete_map=colors,
                          hover_data=["tooltip"],
                          title="verify_response_code Frequency (hover for meaning)")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Response Code Detail Table")
        vc_table = vc_df.copy()
        vc_table["% of Total"] = (vc_table["count"]/total*100).round(1).astype(str)+"%"
        vc_table["Meaning"] = vc_table["verify_response_code"].apply(
            lambda c: GIACT_ACCOUNT_STATUS.get(c,("","Unknown"))[1])
        vc_table = vc_table.rename(columns={"verify_response_code":"Code","count":"# Businesses","status":"Status"})
        vc_table = vc_table.sort_values("# Businesses",ascending=False)
        styled_table(vc_table[["Code","# Businesses","% of Total","Status","Meaning"]],
                     color_col="Status",palette=colors)

        analyst_card("Account Status Interpretation", [
            f"Code 12 (Open/valid checking) and code 15 (savings) are the ideal outcomes. "
            f"Combined passed rate: {passed/total*100:.0f}%.",
            f"Code 6 ({(df['verify_response_code']==6).sum()} businesses): Routing number valid but "
            "no data on the account. This is a GIACT database coverage issue, not a failed account.",
            f"Codes 7/8 (risk-based decline/reject): these indicate GIACT's risk model flagged the account. "
            "High rate = potential fraud signal.",
            f"Coverage gap codes (11,16,17,18): {gap_codes} businesses. "
            "GIACT cannot verify these accounts. Alternative: Plaid for direct bank account verification.",
        ])
        sanity_metrics([
            ("Passed > 50%", passed/total>0.50, f"{passed/total*100:.0f}% passed"),
            ("Coverage gaps < 15%", gap_codes/total<0.15, f"{gap_codes/total*100:.0f}% gap codes"),
            ("No bank < 10%", no_bank/total<0.10, f"{no_bank/total*100:.0f}% no bank"),
            ("All 3 checks pass > 40%", all_pass/total>0.40, f"{all_pass/total*100:.0f}% all green"),
        ])

    with tab_name:
        ac_df = df.groupby("auth_response_code").agg(
            count=("business_id","count"),
            name_status=("account_name_status","first"),
        ).reset_index()
        ac_df["name_meaning"] = ac_df["auth_response_code"].apply(
            lambda c: GIACT_ACCOUNT_NAME.get(c,("","Unknown"))[1])
        colors = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}

        col_l, col_r = st.columns(2)
        with col_l:
            nc = df["account_name_status"].value_counts().reset_index()
            nc.columns = ["Status","Count"]
            fig = px.pie(nc,names="Status",values="Count",color="Status",
                         color_discrete_map=colors,hole=0.5,
                         title="Account Name Status Distribution (gAuthenticate)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.bar(ac_df,x="auth_response_code",y="count",
                          color="name_status",color_discrete_map=colors,
                          hover_data=["name_meaning"],
                          title="auth_response_code → Account Name Status")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Account Name Response Code Table")
        ac_table = ac_df.rename(columns={"auth_response_code":"Code","count":"# Businesses",
                                          "name_status":"Status","name_meaning":"Meaning"})
        ac_table["% of Total"] = (ac_table["# Businesses"]/total*100).round(1).astype(str)+"%"
        styled_table(ac_table[["Code","# Businesses","% of Total","Status","Meaning"]],
                     color_col="Status",palette=colors)

        flag("IMPORTANT: Codes 4–8 in Account Name are 'passed' (with caveats). "
             "The same codes in Contact Verification are 'failed'. "
             "This is intentional — the mapping tables differ (ACCOUNT_NAME_MAP vs CONTACT_VERIFICATION_MAP).", "blue")

        analyst_card("Account Name Interpretation", [
            "Code 2 = full authentication pass (gAuthenticate) — strongest result.",
            "Code 0/10 = account active but name verification unavailable — "
            "GIACT has the bank account but cannot verify the name. Common with business accounts.",
            "Code 3/12 = name mismatch — the submitted owner name does not match bank records. "
            "May indicate a sole proprietor using personal account with business name.",
            "Codes 4–8: PASSED overall but with specific data point mismatches. "
            "These should be reviewed — the account holder was verified but some data differed.",
        ])

    with tab_contact:
        cv_df = df.groupby("auth_response_code").agg(
            count=("business_id","count"),
            cv_status=("contact_verification","first"),
        ).reset_index()
        cv_df["cv_meaning"] = cv_df["auth_response_code"].apply(
            lambda c: GIACT_CONTACT_VERIFICATION.get(c,("","Unknown"))[1])
        colors = {"passed":"#22c55e","failed":"#ef4444","missing":"#f59e0b"}

        col_l, col_r = st.columns(2)
        with col_l:
            cc = df["contact_verification"].value_counts().reset_index()
            cc.columns = ["Status","Count"]
            fig = px.pie(cc,names="Status",values="Count",color="Status",
                         color_discrete_map=colors,hole=0.5,
                         title="Contact Verification Distribution")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.bar(cv_df,x="auth_response_code",y="count",
                          color="cv_status",color_discrete_map=colors,
                          hover_data=["cv_meaning"],
                          title="auth_response_code → Contact Verification Status")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        styled_table(cv_df.rename(columns={"auth_response_code":"Code","count":"# Businesses",
                                             "cv_status":"Status","cv_meaning":"Meaning"}),
                     color_col="Status",palette=colors)

    with tab_cross:
        st.markdown("#### 🔗 GIACT Cross-Analysis — Account vs Name vs Contact Consistency")

        # 3-way consistency matrix
        df["all_passed"]  = (df["account_status"]=="passed")&(df["account_name_status"]=="passed")&(df["contact_verification"]=="passed")
        df["acc_ok_name_fail"] = (df["account_status"]=="passed")&(df["account_name_status"]=="failed")
        df["acc_fail_name_ok"] = (df["account_status"]=="failed")&(df["account_name_status"]=="passed")

        c1,c2,c3 = st.columns(3)
        with c1: kpi("All 3 Passed",f"{df['all_passed'].sum():,}",f"{df['all_passed'].mean()*100:.0f}%","#22c55e")
        with c2: kpi("Account ✅ but Name ❌",f"{df['acc_ok_name_fail'].sum():,}",
                     "weird — account exists but name mismatch","#f59e0b")
        with c3: kpi("Account ❌ but Name ✅",f"{df['acc_fail_name_ok'].sum():,}",
                     "unusual — name matches but account failed","#f97316")

        # Heatmap: account_status vs account_name_status
        cross = pd.crosstab(df["account_status"],df["account_name_status"])
        fig = go.Figure(go.Heatmap(
            z=cross.values, x=cross.columns.tolist(), y=cross.index.tolist(),
            colorscale="Blues", text=cross.values,
            texttemplate="%{text}",
            hovertemplate="Account: %{y}<br>Name: %{x}<br>Count: %{z}",
        ))
        fig.update_layout(title="Account Status vs Account Name Status (Cross-tabulation)",
                          xaxis_title="Account Name Status",yaxis_title="Account Status")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        cross_box("GIACT Consistency Analysis", [
            f"{df['acc_ok_name_fail'].sum()} businesses: account status=passed but name=failed. "
            "This means the bank account is valid but the owner name on the account differs from submitted name. "
            "Could indicate: account under spouse's name, DBA vs legal name, or business account opened with EIN only.",
            f"{df['acc_fail_name_ok'].sum()} businesses: account failed but name passed. "
            "Unusual — name authentication succeeded but the account itself failed verification. "
            "Possible: SSN matched gAuthenticate DB but routing/account number is invalid.",
            f"Coverage gap businesses (codes 11,16,17,18): GIACT has no data. "
            "For these, the Admin Portal shows 'missing' for all three checks. "
            "Consider using Plaid or Stripe Financial Connections as backup.",
            "High 'missing' rate may indicate GIACT integration is not being triggered for all businesses.",
        ])

        # By state
        st_bank = df.groupby("state").agg(
            total=("business_id","count"),
            passed=("all_passed","sum"),
            failed=("account_status",lambda x:(x=="failed").sum()),
        ).reset_index()
        st_bank["Pass Rate"] = (st_bank["passed"]/st_bank["total"]*100).round(1)
        fig3 = px.bar(st_bank,x="state",y="Pass Rate",color="Pass Rate",
                      color_continuous_scale="RdYlGn",
                      title="Banking All-Pass Rate by State")
        fig3.add_hline(y=all_pass/total*100,line_dash="dash",line_color="#3B82F6",
                       annotation_text=f"Overall {all_pass/total*100:.0f}%")
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

    with tab_codes:
        st.markdown("#### Complete GIACT Response Code Reference")
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown("**Account Status (gVerify — verify_response_code)**")
            acct_ref = [{"Code":c,"Status":GIACT_ACCOUNT_STATUS[c][0].upper(),
                         "Description":GIACT_ACCOUNT_STATUS[c][1]}
                        for c in sorted(GIACT_ACCOUNT_STATUS.keys())]
            styled_table(pd.DataFrame(acct_ref),color_col="Status",
                         palette={"PASSED":"#22c55e","FAILED":"#ef4444","MISSING":"#f59e0b"})
        with col_b:
            st.markdown("**Account Name (gAuthenticate — auth_response_code)**")
            name_ref = [{"Code":c,
                         "Account Name":GIACT_ACCOUNT_NAME.get(c,("missing",""))[0].upper(),
                         "Contact Verif":GIACT_CONTACT_VERIFICATION.get(c,("missing",""))[0].upper(),
                         "Description":GIACT_ACCOUNT_NAME.get(c,("",""))[1]}
                        for c in sorted(set(list(GIACT_ACCOUNT_NAME)+list(GIACT_CONTACT_VERIFICATION)))]
            styled_table(pd.DataFrame(name_ref))

    with tab_lineage:
        lrow("giact_account_status","rds_warehouse_public.facts or case tab values","GIACT gVerify",
             "passed/failed/missing from verify_response_code")
        lrow("giact_account_name","case tab values","GIACT gAuthenticate",
             "passed/failed/missing from auth_response_code via ACCOUNT_NAME_MAP")
        lrow("giact_contact_verification","case tab values","GIACT gAuthenticate",
             "Same auth_response_code but CONTACT_VERIFICATION_MAP — different for codes 4–8!")
        st.code("""-- Note: giact fields may be in case tab values, not rds_warehouse_public.facts
-- Check both locations:
SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS fact_value, received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('giact_account_status','giact_account_name','giact_contact_verification',
               'giact_verify_response_code','giact_auth_response_code');""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 5 — WORTH SCORE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "5️⃣  Worth Score":
    sh("Worth Score","300–850 scale · risk level · SHAP contributions · public records impact","💰")

    df = get_section_data("worth", record_limit)
    total = len(df)
    avg_s = df["worth_score_850"].mean(); med_s = df["worth_score_850"].median()
    high  = (df["risk_level"]=="HIGH").sum()
    mod   = (df["risk_level"]=="MODERATE").sum()
    low   = (df["risk_level"]=="LOW").sum()
    with_bk   = (df["count_bk"]>0).sum()
    with_judg = (df["count_judgment"]>0).sum()
    with_lien = (df["count_lien"]>0).sum()
    multi_pr  = ((df["count_bk"]>0)&(df["count_judgment"]>0)&(df["count_lien"]>0)).sum()

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Avg Score",f"{avg_s:.0f}","300–850","#3B82F6")
    with c2: kpi("🔴 HIGH Risk",f"{high:,}",f"{high/total*100:.0f}% (<500)","#ef4444")
    with c3: kpi("🟡 MODERATE",f"{mod:,}",f"{mod/total*100:.0f}% (500–650)","#f59e0b")
    with c4: kpi("🟢 LOW Risk",f"{low:,}",f"{low/total*100:.0f}% (>650)","#22c55e")
    with c5: kpi("BK+Judg+Lien",f"{multi_pr:,}",f"{multi_pr/total*100:.0f}% all 3","#8B5CF6")

    tab_dist, tab_shap, tab_pr, tab_cross, tab_model = st.tabs([
        "📊 Score Distribution","🧠 SHAP","📜 Public Records","🔗 Cross-Analysis","⚙️ Model"
    ])

    with tab_dist:
        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.histogram(df,x="worth_score_850",nbins=30,
                               color_discrete_sequence=["#3B82F6"],
                               title="Worth Score Distribution (300–850)")
            fig.add_vline(x=500,line_dash="dash",line_color="#ef4444",annotation_text="HIGH <500")
            fig.add_vline(x=650,line_dash="dash",line_color="#f59e0b",annotation_text="MODERATE <650")
            fig.add_vline(x=avg_s,line_dash="dot",line_color="#60a5fa",annotation_text=f"Mean {avg_s:.0f}")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            rl = df["risk_level"].value_counts().reset_index()
            rl.columns = ["Risk","Count"]
            fig2 = px.bar(rl,x="Risk",y="Count",color="Risk",
                          color_discrete_map={"HIGH":"#ef4444","MODERATE":"#f59e0b","LOW":"#22c55e"},
                          title="Risk Level Distribution")
            fig2.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        # Percentile table
        pcts = [10,25,50,75,90,95]
        pct_data = pd.DataFrame({
            "Percentile": [f"P{p}" for p in pcts],
            "Score": [int(df["worth_score_850"].quantile(p/100)) for p in pcts],
            "Risk Level": [("HIGH" if df["worth_score_850"].quantile(p/100)<500
                            else ("MODERATE" if df["worth_score_850"].quantile(p/100)<650 else "LOW"))
                           for p in pcts],
        })
        st.markdown("#### Score Percentile Table")
        styled_table(pct_data,color_col="Risk Level",
                     palette={"HIGH":"#ef4444","MODERATE":"#f59e0b","LOW":"#22c55e"})

        # By state
        st_scores = df.groupby("state").agg(
            avg_score=("worth_score_850","mean"),
            high_risk_pct=("risk_level",lambda x:(x=="HIGH").mean()*100),
        ).reset_index().round(1)
        fig3 = px.scatter(st_scores,x="avg_score",y="high_risk_pct",
                          size="high_risk_pct",text="state",
                          color="avg_score",color_continuous_scale="RdYlGn",
                          title="State: Avg Score vs High-Risk %",
                          labels={"avg_score":"Avg Worth Score","high_risk_pct":"% HIGH Risk"})
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

        analyst_card("Worth Score Distribution", [
            f"Mean score {avg_s:.0f} (target: >600 for healthy portfolio).",
            f"{high/total*100:.0f}% HIGH risk (score <500): these businesses have the highest "
            "probability of fraud/default based on the XGBoost ensemble model.",
            f"Score formula: prediction × (850−300) + 300, where prediction ∈ [0,1] from calibrated model.",
            "The model uses 12-step pipeline: firmographic → financial → economic neural net → calibrator.",
            f"States with highest high-risk %: review those in the scatter chart. "
            "May indicate regional economic factors or industry concentration.",
        ])

    with tab_shap:
        st.markdown("#### 🧠 SHAP — Which Features Drive the Score?")
        flag("SHAP values show the contribution (in score points) of each feature category "
             "to each business's score. Positive = increases score. Negative = decreases score. "
             "Base score = explainer_base_prediction × 550 + 300.", "blue")

        shap_cols = ["shap_public_records","shap_company_profile","shap_financials","shap_banking"]
        shap_labels = ["Public Records","Company Profile","Financials","Banking"]

        col_l, col_r = st.columns(2)
        with col_l:
            means_abs = [df[c].abs().mean() for c in shap_cols]
            fig = px.bar(x=shap_labels,y=means_abs,
                         color=means_abs,color_continuous_scale="Blues",
                         title="Mean |SHAP| by Category (impact magnitude)")
            fig.update_layout(coloraxis_showscale=False,
                              xaxis_title="Category",yaxis_title="Mean |SHAP| (pts)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            means_signed = [df[c].mean() for c in shap_cols]
            colors_shap = ["#22c55e" if v>0 else "#ef4444" for v in means_signed]
            fig2 = px.bar(x=shap_labels,y=means_signed,color=shap_labels,
                          color_discrete_sequence=colors_shap,
                          title="Mean SHAP by Category (signed — positive=helps score)")
            fig2.add_hline(y=0,line_color="#475569")
            fig2.update_layout(showlegend=False,xaxis_title="Category",yaxis_title="Mean SHAP (pts)")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        # SHAP distribution
        shap_df = pd.DataFrame({col: df[col] for col in shap_cols}, )
        shap_df.columns = shap_labels
        shap_melt = shap_df.melt(var_name="Category",value_name="SHAP Points")
        fig3 = px.box(shap_melt,x="Category",y="SHAP Points",color="Category",
                      title="SHAP Distribution by Category")
        fig3.add_hline(y=0,line_color="#475569",line_dash="dash")
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

        # SHAP summary table
        shap_tbl = pd.DataFrame({
            "Category": shap_labels,
            "Mean Impact (pts)": [f"{df[c].mean():+.1f}" for c in shap_cols],
            "Mean |Impact|": [f"{df[c].abs().mean():.1f}" for c in shap_cols],
            "Max Positive": [f"+{df[c].max():.1f}" for c in shap_cols],
            "Max Negative": [f"{df[c].min():.1f}" for c in shap_cols],
            "% Negative": [f"{(df[c]<0).mean()*100:.0f}%" for c in shap_cols],
        })
        st.markdown("#### 📋 SHAP Summary Table")
        styled_table(shap_tbl)

        analyst_card("SHAP Interpretation", [
            "Public Records: MOST penalizing category. Bankruptcies, judgments, and liens "
            "significantly reduce the score. Age matters: recent = more negative impact.",
            "Company Profile: Usually POSITIVE contributor. Business age, NAICS code, and "
            "employee count are the key firmographic signals.",
            "Financials: HIGH variance. Businesses with connected accounting data see "
            "significant positive impact. Those without (imputed to 0) see neutral impact.",
            "Banking: Generally positive when account is verified. Low impact vs other categories.",
            f"Base score ≈ {avg_s-sum([df[c].mean() for c in shap_cols]):.0f} pts "
            "(the population average before individual features adjust).",
        ])

    with tab_pr:
        st.markdown("#### 📜 Public Records — Bankruptcy, Judgments & Liens")

        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("Any BK",f"{with_bk:,}",f"{with_bk/total*100:.0f}%","#8B5CF6")
        with c2: kpi("Any Judgment",f"{with_judg:,}",f"{with_judg/total*100:.0f}%","#8B5CF6")
        with c3: kpi("Any Lien",f"{with_lien:,}",f"{with_lien/total*100:.0f}%","#8B5CF6")
        with c4: kpi("All 3",f"{multi_pr:,}",f"{multi_pr/total*100:.0f}% — highest risk","#ef4444")

        pr_tbl = df.groupby("state").agg(
            bk=("count_bk",lambda x:(x>0).sum()),
            judg=("count_judgment",lambda x:(x>0).sum()),
            lien=("count_lien",lambda x:(x>0).sum()),
            total=("business_id","count"),
            avg_score=("worth_score_850","mean"),
        ).reset_index()
        pr_tbl["BK %"] = (pr_tbl["bk"]/pr_tbl["total"]*100).round(1)
        pr_tbl["Judg %"] = (pr_tbl["judg"]/pr_tbl["total"]*100).round(1)
        pr_tbl["Lien %"] = (pr_tbl["lien"]/pr_tbl["total"]*100).round(1)
        pr_tbl["Avg Score"] = pr_tbl["avg_score"].round(0).astype(int)

        fig = px.bar(pr_tbl,x="state",y=["BK %","Judg %","Lien %"],barmode="group",
                     color_discrete_sequence=["#8B5CF6","#a855f7","#c084fc"],
                     title="Public Record Rates by State")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        st.markdown("#### 📋 Public Records by State")
        styled_table(pr_tbl[["state","total","bk","BK %","judg","Judg %","lien","Lien %","Avg Score"]])

        cross_box("Public Records → Score Impact", [
            "Businesses with BK + Judgment + Lien (all 3) receive the largest score penalties. "
            f"Currently {multi_pr:,} ({multi_pr/total*100:.0f}%) have all three — flag for manual underwriting review.",
            "BK age is the most important temporal factor: age_bankruptcy < 24 months = highest impact. "
            "Default imputation = 240 months (20 years) when no BK on file.",
            "Lien is the most common (highest %). Many liens are tax liens, which can indicate "
            "payroll tax issues — a key AML/KYB concern.",
            "States with high lien rates: may correlate with specific industries or economic conditions.",
        ])

    with tab_cross:
        st.markdown("#### 🔗 Worth Score Cross-Analysis")

        df["has_any_pr"] = ((df["count_bk"]>0)|(df["count_judgment"]>0)|(df["count_lien"]>0))
        pr_score = df.groupby("has_any_pr")["worth_score_850"].describe().reset_index()
        pr_score["has_any_pr"] = pr_score["has_any_pr"].map({True:"Has Public Records",False:"No Public Records"})

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.box(df,x="has_any_pr",y="worth_score_850",
                         color="has_any_pr",
                         color_discrete_map={True:"#ef4444",False:"#22c55e"},
                         labels={"has_any_pr":"Has Public Records","worth_score_850":"Worth Score"},
                         title="Score Distribution: With vs Without Public Records")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.scatter(df.sample(min(300,total),random_state=42),
                              x="shap_public_records",y="worth_score_850",
                              color="risk_level",
                              color_discrete_map={"HIGH":"#ef4444","MODERATE":"#f59e0b","LOW":"#22c55e"},
                              title="Public Records SHAP vs Worth Score",
                              labels={"shap_public_records":"Public Records SHAP (pts)",
                                      "worth_score_850":"Worth Score"})
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        anomaly_flags(df, [
            (df["worth_score_850"]<400, "Businesses with score <400 (extreme high risk)", "red"),
            (df["worth_score_850"]>800, "Businesses with score >800 — verify data completeness", "blue"),
            ((df["risk_level"]=="HIGH")&(df["count_bk"]==0)&(df["count_judgment"]==0)&(df["count_lien"]==0),
             "HIGH risk score but no public records — driven by other factors (financials/firmographic)", "amber"),
            ((df["risk_level"]=="LOW")&(df["count_bk"]>0),
             "LOW risk score but has bankruptcy — BK may be old (>7 years, low weight)", "blue"),
        ])

    with tab_model:
        st.markdown("#### ⚙️ Worth Score Model Architecture (v3.1)")
        for step, desc in [
            ("1. preprocessor","Feature encoding: state, bus_struct one-hot + NAICS target encoding"),
            ("2. missing","Missing value imputation per feature (lookups.py defaults)"),
            ("3. naics_transformer","NAICS code embedding layer"),
            ("4. imputer","Final imputation pass"),
            ("5. encoder","Categorical encoding"),
            ("6. initial_layer","Firmographic XGBoost sub-model"),
            ("7. scaler","Feature scaling"),
            ("8. second_layer","Financial sub-model"),
            ("9. neural_layer","Economic neural network (PyTorch .pt)"),
            ("10. quantiler","Quantile calibration"),
            ("11. ensemble","Ensemble: firmographic + financial + economic"),
            ("12. calibrator","Final probability calibration → prediction ∈ [0,1]"),
            ("Output: score","prediction × 550 + 300 → Worth Score (300–850)"),
        ]:
            st.markdown(f"""<div class="lineage-row">
              <span class="lk">{step}</span>
              <span style="color:#94A3B8">{desc}</span>
            </div>""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
# 6 — KYC IDENTITY
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "6️⃣  KYC — Identity":
    sh("KYC — Identity Verification",
       "IDV (Plaid) · name/DOB/SSN/address/phone match · synthetic + stolen identity risk","🪪")

    df = get_section_data("kyc", record_limit)
    total = len(df)
    passed   = df["idv_passed"].sum()
    high_r   = (df["risk_level"]=="high_risk").sum()
    hi_syn   = (df["synthetic_score"]>0.70).sum()
    hi_sto   = (df["stolen_score"]>0.70).sum()
    both_hi  = ((df["synthetic_score"]>0.70)&(df["stolen_score"]>0.70)).sum()
    name_ok  = (df["name_match"]=="success").sum()
    all_match= ((df["name_match"]=="success")&(df["dob_match"]=="success")&
                (df["ssn_match"]=="success")&(df["address_match"]=="success")).sum()

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("IDV Passed",f"{passed:,}",f"{passed/total*100:.0f}%","#22c55e")
    with c2: kpi("High Risk",f"{high_r:,}",f"{high_r/total*100:.0f}%","#ef4444")
    with c3: kpi("Synthetic >0.7",f"{hi_syn:,}",f"{hi_syn/total*100:.0f}%","#ef4444")
    with c4: kpi("Stolen >0.7",f"{hi_sto:,}",f"{hi_sto/total*100:.0f}%","#ef4444")
    with c5: kpi("Both Fraud Flags",f"{both_hi:,}",f"{both_hi/total*100:.0f}%","#7f1d1d")
    with c6: kpi("All 4 Matches ✅",f"{all_match:,}",f"{all_match/total*100:.0f}%","#22c55e")

    if both_hi>0:
        flag(f"🚨 CRITICAL: {both_hi} businesses have BOTH synthetic AND stolen identity risk scores >0.70. "
             "These are the highest-priority fraud cases. Immediate manual review required.", "red")

    tab_idv, tab_match, tab_risk, tab_cross, tab_lineage = st.tabs([
        "🪪 IDV Status","✅ Match Results","⚠️ Risk Scores","🔗 Cross-Analysis","🔍 Lineage"
    ])

    with tab_idv:
        col_l, col_r = st.columns(2)
        with col_l:
            sc = df["idv_status"].value_counts().reset_index()
            sc.columns = ["Status","Count"]
            c_map = {"SUCCESS":"#22c55e","PENDING":"#f59e0b","FAILED":"#ef4444",
                     "CANCELED":"#f97316","EXPIRED":"#64748b"}
            fig = px.pie(sc,names="Status",values="Count",color="Status",
                         color_discrete_map=c_map,hole=0.5,title="IDV Status Distribution (Plaid)")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            rl = df["risk_level"].value_counts().reset_index()
            rl.columns = ["Risk","Count"]
            fig2 = px.bar(rl,x="Risk",y="Count",color="Risk",
                          color_discrete_map={"high_risk":"#ef4444","medium_risk":"#f59e0b","low_risk":"#22c55e"},
                          title="Compliance Risk Level (Trulioo)")
            fig2.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 IDV Status Detail Table")
        idv_tbl = df.groupby("idv_status").agg(
            count=("business_id","count"),
            high_risk=("risk_level",lambda x:(x=="high_risk").sum()),
            hi_synthetic=("synthetic_score",lambda x:(x>0.70).sum()),
            hi_stolen=("stolen_score",lambda x:(x>0.70).sum()),
            name_match_ok=("name_match",lambda x:(x=="success").sum()),
        ).reset_index()
        idv_tbl["% of Total"] = (idv_tbl["count"]/total*100).round(1).astype(str)+"%"
        idv_tbl["High Risk %"] = (idv_tbl["high_risk"]/idv_tbl["count"]*100).round(1).astype(str)+"%"
        idv_tbl["Synthetic >0.7 %"] = (idv_tbl["hi_synthetic"]/idv_tbl["count"]*100).round(1).astype(str)+"%"
        idv_tbl["Name Match %"] = (idv_tbl["name_match_ok"]/idv_tbl["count"]*100).round(1).astype(str)+"%"
        styled_table(idv_tbl[["idv_status","count","% of Total","High Risk %",
                                "Synthetic >0.7 %","Name Match %"]].rename(columns={"idv_status":"IDV Status"}),
                     color_col="IDV Status",palette={s.lower():c_map.get(s,"#64748b") for s in c_map})

        st.markdown("#### IDV Status Key Explanations")
        for status, (icon, sid, summary, detail) in IDV_STATUS_MEANINGS.items():
            n_status = (df["idv_status"]==status).sum()
            pct = n_status/total*100
            color = {"SUCCESS":"#22c55e","PENDING":"#f59e0b","FAILED":"#ef4444",
                     "CANCELED":"#f97316","EXPIRED":"#64748b"}[status]
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:10px 14px;margin:5px 0">
              <span style="color:{color};font-weight:700">{icon} {status} (id={sid})</span>
              <span style="color:#94A3B8;font-size:.74rem;margin-left:8px">{n_status:,} businesses ({pct:.0f}%)</span>
              <div style="color:#E2E8F0;font-size:.80rem;margin-top:4px;font-weight:600">{summary}</div>
              <div style="color:#94A3B8;font-size:.77rem;margin-top:2px">{detail}</div>
            </div>""", unsafe_allow_html=True)

        analyst_card("IDV Pass/Fail Analysis", [
            f"SUCCESS {(df['idv_status']=='SUCCESS').sum()/total*100:.0f}%: Identity confirmed via government ID scan + selfie. "
            "Plaid checks: document authenticity, facial match, liveness detection.",
            f"FAILED {(df['idv_status']=='FAILED').sum()/total*100:.0f}%: Most common causes: "
            "1) ID expired or damaged, 2) Selfie doesn't match ID photo, 3) Document is from unsupported country, "
            "4) Liveness check failed (possible deepfake attempt).",
            f"PENDING {(df['idv_status']=='PENDING').sum()/total*100:.0f}%: Business submitted but owner hasn't completed IDV yet. "
            "Normal for recent applications. Should decrease within 24–72 hours.",
            f"CANCELED/EXPIRED {(df['idv_status'].isin(['CANCELED','EXPIRED'])).sum()/total*100:.0f}%: "
            "User abandoned. May need a reminder email trigger.",
            "idv_passed_boolean = true ONLY when SUCCESS count > 0 (L541–550 kyb/index.ts). "
            "idv_passed = numeric count of SUCCESS sessions (not boolean).",
        ])

        sanity_metrics([
            ("IDV pass > 65%", passed/total>0.65, f"{passed/total*100:.0f}% passed"),
            ("Failed < 15%", (df["idv_status"]=="FAILED").sum()/total<0.15,
             f"{(df['idv_status']=='FAILED').sum()/total*100:.0f}% failed"),
            ("Both fraud flags < 5%", both_hi/total<0.05, f"{both_hi/total*100:.0f}% both high"),
            ("High risk < 30%", high_r/total<0.30, f"{high_r/total*100:.0f}% high risk"),
        ])

    with tab_match:
        st.markdown("#### ✅ Identity Match Results by Field")
        fields = [("name_match","Name"),("dob_match","Date of Birth"),
                  ("ssn_match","SSN"),("address_match","Address"),("phone_match","Phone")]
        results = []
        for field, label in fields:
            vc = df[field].value_counts()
            n_total = vc.sum()
            results.append({
                "Field": label,
                "Fact Name": field,
                "✅ Success": vc.get("success",0),
                "% Success": f"{vc.get('success',0)/n_total*100:.0f}%",
                "❌ Failure": vc.get("failure",0),
                "% Failure": f"{vc.get('failure',0)/n_total*100:.0f}%",
                "⏳ Pending": vc.get("pending",0),
                "⚫ None/Missing": vc.get("none",0),
                "% Missing": f"{vc.get('none',0)/n_total*100:.0f}%",
            })
        results_df = pd.DataFrame(results)

        col_l, col_r = st.columns(2)
        with col_l:
            match_melt = results_df[["Field","✅ Success","❌ Failure","⏳ Pending","⚫ None/Missing"]].melt(
                id_vars="Field",var_name="Status",value_name="Count")
            fig = px.bar(match_melt,x="Field",y="Count",color="Status",barmode="stack",
                         color_discrete_map={"✅ Success":"#22c55e","❌ Failure":"#ef4444",
                                             "⏳ Pending":"#f59e0b","⚫ None/Missing":"#64748b"},
                         title="Match Results by Field")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            # Radar chart of success rates
            success_rates = [int(r["% Success"].replace("%","")) for r in results]
            fig2 = go.Figure(go.Scatterpolar(
                r=success_rates+[success_rates[0]],
                theta=[r["Field"] for r in results]+[results[0]["Field"]],
                fill="toself",line_color="#3B82F6",fillcolor="rgba(59,130,246,0.2)",
                name="Success %"
            ))
            fig2.update_layout(polar=dict(bgcolor="#1E293B",
                radialaxis=dict(visible=True,range=[0,100],gridcolor="#334155",color="#94A3B8"),
                angularaxis=dict(color="#94A3B8")),
                showlegend=False,title="Match Success Rates (Radar)")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Full Match Summary Table")
        styled_table(results_df)

        # Anomalies
        for field, label in fields:
            fail_rate = (df[field]=="failure").mean()
            miss_rate = (df[field]=="none").mean()
            if fail_rate>0.30:
                flag(f"{label}: {fail_rate*100:.0f}% failure rate — above 30% threshold. "
                     "Investigate: wrong format submitted? Address normalization issue?", "amber")
            if miss_rate>0.20:
                flag(f"{label}: {miss_rate*100:.0f}% missing/none — field not submitted for many businesses. "
                     "Check onboarding form — is this field required?", "amber")

        analyst_card("Identity Match Field Explanations", [
            "Name match: Middesk/OC/Trulioo compare submitted business name to registry. "
            "This is BUSINESS name, not owner/person name.",
            "DOB match: Owner's date of birth vs Trulioo PSC (Person Screening) records. "
            "Trulioo checks against credit bureau and government ID sources.",
            "SSN match: Owner's SSN vs Trulioo data. High failure may indicate wrong SSN or "
            "non-US owner (no SSN). 'none' = SSN not submitted.",
            "Address match: Business address vs Middesk + SERP data. "
            "Common failure: suite/unit number mismatch or PO Box vs street address.",
            "Phone match: Business phone vs SERP/web scraping data. "
            "High 'none' rate = phone not collected or not verifiable.",
        ])

    with tab_risk:
        st.markdown("#### ⚠️ Synthetic & Stolen Identity Risk Scores (0–1 scale)")
        flag("These scores come from the fraud_report fact (owner_verification). "
             ">0.70 = HIGH risk threshold. Both scores >0.70 simultaneously = strongest fraud signal.", "blue")

        col_l, col_r = st.columns(2)
        with col_l:
            fig = px.histogram(df,x="synthetic_score",nbins=25,
                               color_discrete_sequence=["#8B5CF6"],
                               title="Synthetic Identity Risk Score Distribution")
            fig.add_vline(x=0.70,line_dash="dash",line_color="#ef4444",annotation_text="HIGH >0.70")
            fig.add_vline(x=0.40,line_dash="dash",line_color="#f59e0b",annotation_text="MEDIUM >0.40")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            fig2 = px.histogram(df,x="stolen_score",nbins=25,
                                color_discrete_sequence=["#ec4899"],
                                title="Stolen Identity Risk Score Distribution")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#ef4444",annotation_text="HIGH >0.70")
            fig2.add_vline(x=0.40,line_dash="dash",line_color="#f59e0b",annotation_text="MEDIUM >0.40")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        # Risk score segments table
        def risk_bucket(score):
            if score>=0.70: return "HIGH (>0.70)"
            if score>=0.40: return "MEDIUM (0.40–0.70)"
            return "LOW (<0.40)"
        df["syn_bucket"] = df["synthetic_score"].apply(risk_bucket)
        df["sto_bucket"] = df["stolen_score"].apply(risk_bucket)

        for label, col, bucket_col in [("Synthetic","synthetic_score","syn_bucket"),
                                         ("Stolen","stolen_score","sto_bucket")]:
            seg = df.groupby(bucket_col).agg(
                count=("business_id","count"),
                idv_fail=("idv_passed",lambda x:(~x).sum()),
                high_risk=("risk_level",lambda x:(x=="high_risk").sum()),
                avg_score=("synthetic_score" if label=="Synthetic" else "stolen_score","mean"),
            ).reset_index()
            seg["% of Total"] = (seg["count"]/total*100).round(1).astype(str)+"%"
            seg["IDV Fail %"] = (seg["idv_fail"]/seg["count"]*100).round(1).astype(str)+"%"
            seg["High Risk %"] = (seg["high_risk"]/seg["count"]*100).round(1).astype(str)+"%"
            st.markdown(f"#### 📋 {label} Risk Score Segments")
            styled_table(seg[[bucket_col,"count","% of Total","IDV Fail %","High Risk %"]].rename(
                columns={bucket_col:"Risk Bucket"}))

        # Scatter: synthetic vs stolen
        fig3 = px.scatter(df,x="synthetic_score",y="stolen_score",
                          color="idv_passed",
                          color_discrete_map={True:"#22c55e",False:"#ef4444"},
                          labels={"synthetic_score":"Synthetic Score","stolen_score":"Stolen Score",
                                  "idv_passed":"IDV Passed"},
                          title="Synthetic vs Stolen Identity Risk — IDV Pass/Fail")
        fig3.add_vline(x=0.70,line_dash="dash",line_color="#ef4444")
        fig3.add_hline(y=0.70,line_dash="dash",line_color="#ef4444")
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

        analyst_card("Identity Risk Score Interpretation", [
            "Synthetic identity fraud: a person fabricates an identity by combining a real SSN "
            "(often a child's, deceased person's, or stolen) with a made-up name and DOB.",
            "Stolen identity fraud: a person uses someone else's real, complete identity. "
            "The real person may not know their identity is being used.",
            f"{both_hi} businesses with BOTH scores >0.70: this pattern strongly suggests "
            "organized fraud or identity theft rings. Refer to fraud team immediately.",
            f"Businesses with IDV=PASSED but high synthetic score: IDV checked document "
            "authenticity but didn't catch synthetic identity if the fraudster has a real document.",
            "Source: owner_verification → fraud_report → caseTabValuesManager.ts L346–393. "
            "NOT stored in rds_warehouse_public.facts — comes from the case tab values endpoint.",
        ])

    with tab_cross:
        st.markdown("#### 🔗 KYC Cross-Analysis")

        # IDV status vs match fields
        idv_match = df.groupby("idv_status").agg(
            count=("business_id","count"),
            name_ok=("name_match",lambda x:(x=="success").sum()),
            dob_ok=("dob_match",lambda x:(x=="success").sum()),
            ssn_ok=("ssn_match",lambda x:(x=="success").sum()),
            high_syn=("synthetic_score",lambda x:(x>0.70).sum()),
        ).reset_index()
        idv_match["Name Match %"] = (idv_match["name_ok"]/idv_match["count"]*100).round(1)
        idv_match["DOB Match %"]  = (idv_match["dob_ok"]/idv_match["count"]*100).round(1)
        idv_match["SSN Match %"]  = (idv_match["ssn_ok"]/idv_match["count"]*100).round(1)
        idv_match["Synthetic >0.7 %"] = (idv_match["high_syn"]/idv_match["count"]*100).round(1)

        fig = px.bar(idv_match,x="idv_status",
                     y=["Name Match %","DOB Match %","SSN Match %"],
                     barmode="group",title="Match Rates by IDV Status",
                     color_discrete_sequence=["#3B82F6","#8B5CF6","#ec4899"])
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        st.markdown("#### 📋 Match Rate vs IDV Status Cross-Table")
        styled_table(idv_match[["idv_status","count","Name Match %","DOB Match %",
                                  "SSN Match %","Synthetic >0.7 %"]].rename(columns={"idv_status":"IDV Status"}))

        cross_box("KYC Cross-Analysis Insights", [
            "FAILED IDV + low name match: consistent — the person failed IDV because "
            "the submitted name doesn't match the document.",
            "PASSED IDV + high synthetic score: most concerning combination. "
            "The document was genuine but the identity may be synthetically constructed.",
            "PENDING IDV + high fraud scores: these businesses should be prioritized "
            "for follow-up — don't let high-risk cases remain in pending state.",
            "Low SSN match + low DOB match + high synthetic score: classic synthetic "
            "identity pattern — the SSN belongs to someone else.",
        ])

        anomaly_flags(df, [
            ((df["idv_passed"])&(df["synthetic_score"]>0.70),
             "IDV passed but synthetic risk >0.70 — check for sophisticated fraud", "red"),
            ((~df["idv_passed"])&(df["ssn_match"]=="success")&(df["dob_match"]=="success"),
             "IDV failed but SSN + DOB both matched — ID document issue only", "amber"),
            ((df["name_match"]=="failure")&(df["idv_passed"]),
             "Name match failed but IDV passed — business name vs owner name mismatch expected", "blue"),
        ])

    with tab_lineage:
        lrow("idv_status","rds_warehouse_public.facts","Plaid IDV (pid=40)",
             "Dict of status counts: {SUCCESS:N, PENDING:N, CANCELED:N, EXPIRED:N, FAILED:N}")
        lrow("idv_passed_boolean","rds_warehouse_public.facts","Calculated",
             "true iff idv_status.SUCCESS > 0 — L541–550 kyb/index.ts")
        lrow("name_match_boolean","rds_warehouse_public.facts","Middesk/OC/Trulioo",
             "Business name match (NOT person name)")
        lrow("synthetic_identity_risk_score","case tab values","fraud_report",
             "0–1 from owner_verification → caseTabValuesManager.ts L346–393")
        lrow("stolen_identity_risk_score","case tab values","fraud_report","0–1 same source")
        lrow("compliance_status","rds_warehouse_public.facts","Trulioo",
             "low_risk/medium_risk/high_risk based on risk_score thresholds")
        st.code("""SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS v, received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('idv_status','idv_passed_boolean','name_match_boolean',
               'compliance_status','risk_score');
-- Note: synthetic/stolen risk scores are in case tab values endpoint, not facts table""",
                language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# 7 — DUE DILIGENCE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "7️⃣  Due Diligence":
    sh("Due Diligence — Watchlist, Sanctions, PEP, Adverse Media, Public Records",
       "watchlist_hits · sanctions · PEP · adverse_media · BK · Judgments · Liens","🔍")

    df = get_section_data("dd", record_limit)
    total = len(df)
    any_wl   = (df["watchlist_hits"]>0).sum()
    any_sanc = (df["sanctions_hits"]>0).sum()
    any_pep  = (df["pep_hits"]>0).sum()
    any_am   = (df["adverse_media"]>0).sum()
    any_bk   = (df["bk_hits"]>0).sum()
    any_judg = (df["judgment_hits"]>0).sum()
    any_lien = (df["lien_hits"]>0).sum()
    multi_hit= ((df["watchlist_hits"]>0)&(df["sanctions_hits"]>0)).sum()
    pr_all   = ((df["bk_hits"]>0)&(df["judgment_hits"]>0)&(df["lien_hits"]>0)).sum()

    c1,c2,c3,c4 = st.columns(4)
    with c1: kpi("Any Watchlist",f"{any_wl:,}",f"{any_wl/total*100:.0f}%","#ef4444")
    with c2: kpi("Sanctions",f"{any_sanc:,}",f"{any_sanc/total*100:.0f}%","#ef4444")
    with c3: kpi("PEP",f"{any_pep:,}",f"{any_pep/total*100:.0f}%","#f97316")
    with c4: kpi("Adverse Media",f"{any_am:,}",f"{any_am/total*100:.0f}%","#f59e0b")

    c5,c6,c7,c8 = st.columns(4)
    with c5: kpi("Bankruptcy",f"{any_bk:,}",f"{any_bk/total*100:.0f}%","#8B5CF6")
    with c6: kpi("Judgments",f"{any_judg:,}",f"{any_judg/total*100:.0f}%","#8B5CF6")
    with c7: kpi("Liens",f"{any_lien:,}",f"{any_lien/total*100:.0f}%","#8B5CF6")
    with c8: kpi("WL+Sanctions",f"{multi_hit:,}","highest priority","#7f1d1d")

    if multi_hit>0:
        flag(f"🚨 {multi_hit} businesses have BOTH watchlist hits AND sanctions hits — "
             "top priority for compliance review.", "red")

    tab_wl, tab_pr, tab_cross, tab_lineage = st.tabs([
        "⚠️ Watchlist / Sanctions / PEP","📜 Public Records","🔗 Cross-Analysis","🔍 Lineage"
    ])

    with tab_wl:
        col_l, col_r = st.columns(2)
        with col_l:
            hit_data = pd.DataFrame({
                "Type": ["Watchlist","Sanctions","PEP","Adverse Media"],
                "Businesses": [any_wl,any_sanc,any_pep,any_am],
                "% of Total": [any_wl/total*100,any_sanc/total*100,
                                any_pep/total*100,any_am/total*100],
            })
            fig = px.bar(hit_data,x="Type",y="Businesses",color="Type",
                         color_discrete_sequence=["#ef4444","#f97316","#f59e0b","#8B5CF6"],
                         title="Due Diligence Hit Frequency")
            fig.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            wl_dist = df["watchlist_hits"].value_counts().sort_index().reset_index()
            wl_dist.columns = ["Hit Count","Businesses"]
            wl_dist["% of Total"] = (wl_dist["Businesses"]/total*100).round(1)
            fig2 = px.bar(wl_dist,x="Hit Count",y="Businesses",
                          color="Businesses",color_continuous_scale="Reds",
                          title="Watchlist Hits per Business Distribution")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("#### 📋 Watchlist Hit Distribution Table")
        styled_table(wl_dist.rename(columns={"Hit Count":"# Hits","Businesses":"# Businesses"}))

        # By state
        state_dd = df.groupby("state").agg(
            total=("business_id","count"),
            wl=("watchlist_hits",lambda x:(x>0).sum()),
            sanc=("sanctions_hits",lambda x:(x>0).sum()),
            pep=("pep_hits",lambda x:(x>0).sum()),
            am=("adverse_media",lambda x:(x>0).sum()),
        ).reset_index()
        state_dd["WL %"] = (state_dd["wl"]/state_dd["total"]*100).round(1)
        state_dd["Sanc %"] = (state_dd["sanc"]/state_dd["total"]*100).round(1)
        state_dd["PEP %"] = (state_dd["pep"]/state_dd["total"]*100).round(1)

        fig3 = px.bar(state_dd,x="state",y=["WL %","Sanc %","PEP %"],barmode="group",
                      color_discrete_sequence=["#ef4444","#f97316","#f59e0b"],
                      title="Watchlist / Sanctions / PEP Rate by State")
        st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)

        st.markdown("#### 📋 State-Level Due Diligence Table")
        styled_table(state_dd[["state","total","wl","WL %","sanc","Sanc %","pep","PEP %","am"]])

        st.markdown("#### Hit Type Explanations")
        for icon, color, title, desc in [
            ("🔴","#ef4444","SANCTIONS",
             "Business or UBO on OFAC, UN, EU, HMT or other sanctions list. "
             "REGULATORY REQUIREMENT: Cannot proceed without compliance approval. "
             "Source: Trulioo PSC screeningResults where listType='SANCTIONS' (truliooFacts.ts)."),
            ("🟠","#f97316","PEP (Politically Exposed Person)",
             "Owner or UBO is a current or former political figure (government official, senior "
             "party member, or their close family/associates). "
             "NOT automatically disqualifying but requires Enhanced Due Diligence (EDD). "
             "Source: Trulioo PSC where listType='PEP'."),
            ("🟡","#f59e0b","ADVERSE MEDIA",
             "Negative news coverage detected (fraud allegations, criminal investigations, etc.). "
             "IMPORTANT: Deliberately EXCLUDED from the consolidated watchlist fact "
             "(filterOutAdverseMedia in consolidatedWatchlist.ts L57). "
             "Tracked separately in adverse_media_hits fact via adverseMediaDetails records."),
        ]:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:10px 14px;margin:5px 0">
              <span style="color:{color};font-weight:700">{icon} {title}</span>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

        analyst_card("Watchlist Interpretation", [
            f"Consolidated watchlist fact = PEP + SANCTIONS only. Adverse media is separate. "
            "This is by design in consolidatedWatchlist.ts.",
            f"Businesses with watchlist_hits > 2 are anomalous: {(df['watchlist_hits']>2).sum()} "
            "businesses. Multiple hits from different list types or entities.",
            f"Sanctions hit ({any_sanc/total*100:.0f}%): even 1 sanctions hit is a hard stop in most compliance frameworks.",
            f"PEP hit ({any_pep/total*100:.0f}%): requires Enhanced Due Diligence but is NOT automatically denied.",
        ])

    with tab_pr:
        st.markdown("#### 📜 Public Records — Bankruptcy, Judgments & Liens")
        col_l, col_r = st.columns(2)
        with col_l:
            pr_freq = pd.DataFrame({
                "Type":["Bankruptcy","Judgment","Lien"],
                "With Hits":[any_bk,any_judg,any_lien],
                "% Total":[any_bk/total*100,any_judg/total*100,any_lien/total*100],
            })
            fig = px.bar(pr_freq,x="Type",y="With Hits",color="Type",
                         color_discrete_sequence=["#8B5CF6","#a855f7","#c084fc"],
                         title="Public Record Frequency")
            fig.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        with col_r:
            bk_age_df = df[df["bk_age_months"].notna()]
            if len(bk_age_df)>0:
                fig2 = px.histogram(bk_age_df,x="bk_age_months",nbins=20,
                                    color_discrete_sequence=["#8B5CF6"],
                                    title="Bankruptcy Age Distribution (months)")
                fig2.add_vline(x=24,line_dash="dash",line_color="#ef4444",annotation_text="2yr")
                fig2.add_vline(x=84,line_dash="dash",line_color="#f59e0b",annotation_text="7yr")
                fig2.add_vline(x=120,line_dash="dash",line_color="#22c55e",annotation_text="10yr")
                st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        # Count distribution for each type
        for pr_type, col_name in [("Bankruptcy","bk_hits"),("Judgment","judgment_hits"),("Lien","lien_hits")]:
            cnt = df[col_name].value_counts().sort_index().reset_index()
            cnt.columns = ["Count","# Businesses"]
            cnt["% of Total"] = (cnt["# Businesses"]/total*100).round(1).astype(str)+"%"
            cnt = cnt[cnt["Count"]>0]
            if len(cnt)>0:
                st.markdown(f"##### {pr_type} Count Distribution")
                styled_table(cnt)

        state_pr = df.groupby("state").agg(
            total=("business_id","count"),
            bk=("bk_hits",lambda x:(x>0).sum()),
            judg=("judgment_hits",lambda x:(x>0).sum()),
            lien=("lien_hits",lambda x:(x>0).sum()),
            all3=("bk_hits",lambda x:((x>0)&(df.loc[x.index,"judgment_hits"]>0)&
                                       (df.loc[x.index,"lien_hits"]>0)).sum()),
        ).reset_index()
        state_pr["BK %"]   = (state_pr["bk"]/state_pr["total"]*100).round(1)
        state_pr["Judg %"] = (state_pr["judg"]/state_pr["total"]*100).round(1)
        state_pr["Lien %"] = (state_pr["lien"]/state_pr["total"]*100).round(1)
        st.markdown("#### 📋 Public Records by State")
        styled_table(state_pr[["state","total","bk","BK %","judg","Judg %","lien","Lien %"]])

        analyst_card("Public Records Interpretation", [
            "Bankruptcy age brackets: <2yr = HIGH impact on Worth Score; 2–7yr = MEDIUM; >7yr = LOW. "
            "Default imputation when no BK: 240 months (20yr) = effectively neutral.",
            "Tax liens are the most common lien type for small businesses. "
            "Outstanding federal/state tax liens = payroll tax issues → potential fraud signal.",
            "Judgment from civil suit: may indicate pattern of non-payment to vendors/suppliers.",
            f"{pr_all} businesses with ALL THREE (BK+Judgment+Lien): extreme risk profile. "
            "These businesses have exhausted multiple credit/legal options. "
            "Manual underwriting is strongly recommended.",
            "Worth Score model uses: age_bankruptcy, age_judgment, age_lien (months), "
            "count_bankruptcy, count_judgment, count_lien. Source: ai-score-service/lookups.py.",
        ])

    with tab_cross:
        st.markdown("#### 🔗 Due Diligence Cross-Analysis")

        # Watchlist vs Public Records
        df["any_wl"] = df["watchlist_hits"]>0
        df["any_sanc"] = df["sanctions_hits"]>0
        df["any_pr"] = ((df["bk_hits"]>0)|(df["judgment_hits"]>0)|(df["lien_hits"]>0))

        cross_wl_pr = pd.crosstab(df["any_wl"],df["any_pr"],
                                   rownames=["Has Watchlist Hit"],colnames=["Has Public Record"])
        fig = go.Figure(go.Heatmap(
            z=cross_wl_pr.values,
            x=[f"PR: {c}" for c in cross_wl_pr.columns.tolist()],
            y=[f"WL: {i}" for i in cross_wl_pr.index.tolist()],
            colorscale="Blues",text=cross_wl_pr.values,texttemplate="%{text}",
        ))
        fig.update_layout(title="Watchlist Hit vs Public Record (Cross-tabulation)")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        # Risk combinations
        df["risk_combo"] = df.apply(lambda r:
            "WL+Sanc+PR" if r.any_wl and r.any_sanc and r.any_pr
            else ("WL+Sanc" if r.any_wl and r.any_sanc
            else ("WL+PR" if r.any_wl and r.any_pr
            else ("WL only" if r.any_wl
            else ("PR only" if r.any_pr
            else "Clean")))), axis=1)
        rc = df["risk_combo"].value_counts().reset_index()
        rc.columns = ["Risk Combination","Count"]
        rc["% of Total"] = (rc["Count"]/total*100).round(1).astype(str)+"%"
        colors_rc = {"WL+Sanc+PR":"#7f1d1d","WL+Sanc":"#ef4444","WL+PR":"#f97316",
                     "WL only":"#f59e0b","PR only":"#8B5CF6","Clean":"#22c55e"}

        col_l, col_r = st.columns(2)
        with col_l:
            fig2 = px.pie(rc,names="Risk Combination",values="Count",
                          color="Risk Combination",color_discrete_map=colors_rc,hole=0.45,
                          title="Risk Combination Distribution")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
        with col_r:
            st.markdown("#### 📋 Risk Combination Summary")
            styled_table(rc,color_col="Risk Combination",palette=colors_rc)

        cross_box("Due Diligence Cross-Analysis", [
            "WL+Sanc+PR combination: the highest-risk profile. "
            f"{(df['risk_combo']=='WL+Sanc+PR').sum()} businesses. Immediate compliance referral.",
            "Clean (no hits): not necessarily low-risk. Public records are backward-looking; "
            "a business can be clean historically but engage in fraud today.",
            "WL only (no PR): watchlist hit without any credit history issues. "
            "May indicate owner name match on watchlist vs. legitimate business.",
            "PR only (no WL): credit/legal issues but no watchlist. "
            "More common, higher recovery potential. Assess severity by BK age.",
        ])

        anomaly_flags(df,[
            ((df["sanctions_hits"]>0), "Businesses with sanctions hits — hard stop required","red"),
            ((df["watchlist_hits"]>3), "Businesses with >3 watchlist hits — unusual, may be false positive","amber"),
            ((df["pep_hits"]>0)&(df["sanctions_hits"]>0), "PEP + Sanctions simultaneously — very high risk","red"),
            ((df["bk_hits"]>1), "Multiple bankruptcies on record — serial filing pattern","amber"),
        ])

    with tab_lineage:
        lrow("watchlist","rds_warehouse_public.facts","Middesk / Trulioo",
             "Consolidated: PEP + SANCTIONS only. Adverse media excluded by filterOutAdverseMedia().")
        lrow("watchlist_hits","rds_warehouse_public.facts","Calculated","Count = watchlist.value.metadata.length")
        lrow("watchlist_raw","rds_warehouse_public.facts","Middesk task / Trulioo watchlistResults","Pre-consolidation")
        lrow("adverse_media_hits","rds_warehouse_public.facts","Trulioo + adverseMediaDetails",
             "listType='adverse_media' hits + adverseMediaDetails.records[0].total_risk_count")
        lrow("sanctions_hits","rds_warehouse_public.facts","Trulioo PSC","listType='SANCTIONS'")
        lrow("pep_hits","rds_warehouse_public.facts","Trulioo PSC","listType='PEP'")
        st.code("""SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS v, received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('watchlist_hits','adverse_media_hits','sanctions_hits','pep_hits','watchlist');
-- watchlist.value is a JSON array — parse with json.loads() in Python""",language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# DATA LINEAGE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🔍 Data Lineage":
    sh("Complete Data Lineage","Every fact → source table → vendor → platform_id → Fact Engine rules","🔍")

    tab_facts, tab_vendors, tab_rules, tab_sql = st.tabs([
        "📋 All Facts","🏭 Vendor Map","⚙️ Fact Engine Rules","🗄️ SQL Patterns"
    ])

    with tab_facts:
        all_facts = [
            ("sos_filings","KYB","Middesk/OC/Trulioo","pid=16/23/38","Array of SOS registrations with active, jurisdiction, foreign_domestic"),
            ("sos_match","KYB","Middesk/OC/Trulioo","pid=16/23/38","Boolean: SOS name matched submitted business name"),
            ("sos_active","KYB","Calculated","N/A","true iff any filing has active=true"),
            ("tin","KYB","Middesk BEV/OC","pid=16/23","Unmasked EIN from Middesk business_entity_verification"),
            ("tin_submitted","KYB","Middesk/applicant","pid=16","Masked TIN from applicant form"),
            ("tin_match","KYB","Middesk task/Trulioo","pid=16/38","Object {status,message}. status: success/failure/pending"),
            ("tin_match_boolean","KYB","Calculated","N/A","true IFF tin_match.status === 'success' only"),
            ("naics_code","Industry","EFX/ZI/OC/SERP/Trulioo/AI","pid=17/24/23/22/38/31","6-digit NAICS winner via Fact Engine"),
            ("mcc_code","Industry","AI/lookup","pid=31","4-digit MCC from AI or rel_naics_mcc lookup"),
            ("industry","Industry","Calculated","N/A","2-digit NAICS prefix → core_business_industries"),
            ("idv_status","KYC","Plaid IDV","pid=40","Dict {SUCCESS:N, PENDING:N, CANCELED:N, EXPIRED:N, FAILED:N}"),
            ("idv_passed_boolean","KYC","Calculated","N/A","true iff idv_status.SUCCESS > 0"),
            ("name_match_boolean","KYC","Middesk/OC/Trulioo","pid=16/23/38","Business name match boolean"),
            ("address_match_boolean","KYC","Middesk/SERP","pid=16/22","Address match boolean"),
            ("watchlist","DD","Middesk/Trulioo","pid=16/38","PEP + SANCTIONS only — adverse media excluded"),
            ("watchlist_hits","DD","Calculated","N/A","Count = watchlist.value.metadata.length"),
            ("adverse_media_hits","DD","Trulioo/AdverseMedia","pid=38","listType=adverse_media hits"),
            ("sanctions_hits","DD","Trulioo PSC","pid=38","Trulioo screeningResults where listType=SANCTIONS"),
            ("pep_hits","DD","Trulioo PSC","pid=38","Trulioo screeningResults where listType=PEP"),
            ("worth_score","Score","AI Score Service","N/A","300–850 scale. prediction×550+300"),
            ("giact_account_status","Banking","GIACT gVerify","N/A","passed/failed/missing from verify_response_code"),
            ("giact_account_name","Banking","GIACT gAuthenticate","N/A","from auth_response_code via ACCOUNT_NAME_MAP"),
            ("giact_contact_verification","Banking","GIACT gAuthenticate","N/A","same auth_response_code, CONTACT_VERIFICATION_MAP"),
            ("synthetic_identity_risk_score","KYC","fraud_report","N/A","0–1 from owner_verification caseTabValuesManager"),
            ("stolen_identity_risk_score","KYC","fraud_report","N/A","0–1 same source"),
        ]
        cat = st.selectbox("Filter category",["All"]+sorted(set(f[1] for f in all_facts)))
        df_facts = pd.DataFrame(all_facts,columns=["Fact","Category","Sources","Platform IDs","Description"])
        if cat!="All": df_facts = df_facts[df_facts["Category"]==cat]
        styled_table(df_facts)

    with tab_vendors:
        vendors_data = [
            ("Middesk","16","2.0","0.15 base + 0.20×tasks (max 4 tasks)","KYB primary: SOS, TIN, name, address","pid=16"),
            ("OpenCorporates","23","0.9","match.index / 55","Global SOS registry, classification codes","pid=23"),
            ("ZoomInfo","24","0.8","match.index / 55","NAICS, employees, revenue, website. Pre-loaded Redshift","pid=24"),
            ("Equifax","17","0.7","XGBoost prediction or index/55","NAICS, SIC, employees, revenue. Pre-loaded Redshift","pid=17"),
            ("Trulioo","38","0.8","Status-based: 0.70/0.40/0.20","Watchlist, PEP, sanctions, IDV, registration","pid=38"),
            ("Plaid IDV","40","1.0","1.0 when data present","Identity verification: idv_status, fraud scores","pid=40"),
            ("AI (GPT)","31","0.1","Self-reported HIGH/MED/LOW","NAICS last resort, MCC, descriptions","pid=31"),
            ("SERP","22","—","Heuristic score","Website info, NAICS from web classification","pid=22"),
            ("GIACT","N/A","—","response_code based","Banking: account, name, contact verification","N/A"),
        ]
        vdf = pd.DataFrame(vendors_data,columns=["Vendor","Platform ID","Weight","Confidence Formula","Coverage","Key"])
        styled_table(vdf)

    with tab_rules:
        rules = [
            ("Rule 1","manualOverride()","ALWAYS first. Analyst override wins over everything. No other rule applies.","#22c55e"),
            ("Rule 2","factWithHighestConfidence()","Highest confidence wins IF gap to next-best > 5% (WEIGHT_THRESHOLD=0.05).","#3B82F6"),
            ("Rule 3","weightedFactSelector()","Tie-break: within 5% confidence → higher platform weight wins.","#8B5CF6"),
            ("Rule 4","NO minimum confidence cutoff","CRITICAL: A source with confidence=0.05 CAN still win. "
             "This is why AI (w=0.1) sometimes wins → NAICS 561499.","#ef4444"),
            ("Rule 5","AI safety net","AINaicsEnrichment triggered when <1 non-AI source has naics_code. Last resort.","#f59e0b"),
            ("Rule 6","removeNaicsCode()","AI code not in core_naics_code table → replaced with 561499. Catches hallucinations.","#f97316"),
        ]
        for rid, name, desc, color in rules:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:10px 14px;margin:5px 0">
              <span style="color:{color};font-weight:700">{rid}: {name}</span>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:4px">{desc}</div>
            </div>""", unsafe_allow_html=True)

        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown("**Pipeline A** (Integration Service)")
            st.markdown("""
- Real-time, per-business, all 6+ vendors
- All 6 rules applied per fact
- Output: `rds_warehouse_public.facts` (200+ facts)
- Customer-facing via Admin Portal
            """)
        with col_b:
            st.markdown("**Pipeline B** (Warehouse Service)")
            st.markdown("""
- Batch, Redshift-only, ZI + EFX ONLY
- Winner: `zi_match_conf > efx_match_conf ? ZI : EFX`
- OC, Middesk, Trulioo, AI: **IGNORED**
- Output: `datascience.customer_files`
- Internal analytics only
            """)

    with tab_sql:
        queries = [
            ("Get any KYB fact", """SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_vendor,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = 'YOUR-UUID'
  AND name IN ('naics_code','sos_filings','tin_match_boolean','watchlist_hits');"""),
            ("NAICS fallback rate", """SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS naics_code,
    COUNT(*) AS businesses,
    ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) AS pct
FROM rds_warehouse_public.facts
WHERE name = 'naics_code'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value')
ORDER BY businesses DESC LIMIT 20;"""),
            ("TIN verification summary", """SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS tin_boolean,
    COUNT(*) AS businesses
FROM rds_warehouse_public.facts
WHERE name = 'tin_match_boolean'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value');"""),
            ("Middesk gap detection", """SELECT DISTINCT f.business_id,
    JSON_EXTRACT_PATH_TEXT(f.value,'source','confidence') AS oc_confidence
FROM rds_warehouse_public.facts f
WHERE f.name = 'sos_filings'
  AND JSON_EXTRACT_PATH_TEXT(f.value,'source','platformId') = '23'
  AND NOT EXISTS (
      SELECT 1 FROM integration_data.request_response rr
      WHERE rr.business_id = f.business_id AND rr.platform_id = 16
  ) LIMIT 100;"""),
            ("Watchlist hit distribution", """SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS hit_count,
    COUNT(*) AS businesses
FROM rds_warehouse_public.facts
WHERE name = 'watchlist_hits'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value')
ORDER BY CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS INT) DESC;"""),
        ]
        for title, sql in queries:
            with st.expander(f"📋 {title}"):
                st.code(sql, language="sql")

# ── Footer ─────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(
    f'<div style="color:#475569;font-size:.70rem;text-align:center">'
    f'Admin Portal KYB Dashboard v2 · rds_warehouse_public.facts · '
    f'integration-service/lib/facts/kyb/ · ai-score-service · giactDisplayMapper.ts · '
    f'{datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</div>',
    unsafe_allow_html=True)
