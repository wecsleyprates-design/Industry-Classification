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
    Returns None on any error (including federation VARCHAR limit errors).
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


def query_fact(fact_name, limit, extra_cols=""):
    """
    Query a SINGLE fact name.  If the value column exceeds the Redshift
    federation VARCHAR(65535) limit for ANY row, the whole query fails.
    By querying one fact at a time we can skip the offending ones and
    still return data for the others.
    extra_cols: additional SQL expressions to add to the SELECT list.
    """
    cols = f"business_id, '{fact_name}' AS name, value, received_at"
    if extra_cols:
        cols += f", {extra_cols}"
    sql = f"""
        SELECT {cols}
        FROM rds_warehouse_public.facts
        WHERE name = '{fact_name}'
        ORDER BY received_at DESC{_limit_clause(limit)}
    """
    return run_query(sql)


def query_facts_safe(fact_names, limit):
    """
    Query multiple fact names one at a time.
    Silently skips any fact whose value column exceeds the 65535-byte
    Redshift federation VARCHAR limit.
    Returns a combined DataFrame of all facts that succeeded, or None.
    """
    frames = []
    skipped = []
    for name in fact_names:
        df = query_fact(name, limit)
        if df is not None and not df.empty:
            frames.append(df)
        else:
            err = st.session_state.get("_last_db_error", "")
            if "VARCHAR" in err and "too long" in err:
                skipped.append(name)
                st.session_state["_last_db_error"] = ""  # reset so next fact tries fresh

    if skipped:
        # Store for display but don't crash
        st.session_state["_skipped_large_facts"] = skipped

    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)

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
        try:
            if hasattr(cond, 'sum'):
                n = int(cond.astype(bool).sum())
            else:
                n = int(bool(cond))
        except Exception:
            n = 0
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
    raw = query_facts_safe(
        ['sos_active', 'sos_match_boolean', 'sos_match', 'middesk_confidence'],
        limit)
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
        elif r["name"] == "middesk_confidence":
            # middesk_confidence fact stores the direct Middesk match score
            try:
                rows[bid]["middesk_conf"] = max(rows[bid]["middesk_conf"], float(val or 0))
            except Exception:
                pass

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
    raw = query_facts_safe(
        ['tin_match', 'tin_match_boolean', 'tin_submitted'],
        limit)
    if raw is None or raw.empty:
        return None

    def extract_fact_value(row):
        fact = _parse_fact(row["value"])
        v = fact.get("value")
        if v is None:
            return ""
        # Serialise dict/list as proper JSON (not Python repr)
        if isinstance(v, (dict, list)):
            return json.dumps(v)
        return str(v)

    def extract_platform_id(row):
        fact = _parse_fact(row["value"])
        return str(_safe_get(fact, "source", "platformId", default=""))

    raw["fact_value"]  = raw.apply(extract_fact_value, axis=1)
    raw["platform_id"] = raw.apply(extract_platform_id, axis=1)

    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    for col in ("tin_match","tin_match_boolean","tin_submitted"):
        if col not in pivoted.columns:
            pivoted[col] = None

    def parse_tin_match(v):
        """Extract status string from tin_match value.
        Handles: JSON string, plain string like 'success', and dict."""
        if v is None or v == "" or str(v).lower() in ("nan","none"):
            return ""
        if isinstance(v, dict):
            return v.get("status", "")
        s = str(v)
        try:
            obj = json.loads(s)
            if isinstance(obj, dict):
                return obj.get("status", "")
            return str(obj)
        except Exception:
            # If it's a plain word like "success" or "failure", return as-is
            return s.strip()

    # tin_match column holds the JSON-serialised value dict
    # parse_tin_match extracts the 'status' string from it
    pivoted["tin_match_status"] = pivoted["tin_match"].apply(parse_tin_match).fillna("").astype(str)

    # tin_match_boolean is stored as scalar "true"/"false" in the facts table
    pivoted["tin_match_boolean"] = pivoted["tin_match_boolean"].apply(
        lambda v: str(v).lower() in ("true","1","success") if v else False
    ).astype(bool)

    pivoted["tin_submitted"] = pivoted["tin_submitted"].apply(
        lambda v: str(v).lower() not in ("","none","null","false","0") if v else False
    ).astype(bool)

    # Middesk TIN task status — from tin_match where platform_id=16
    mid = raw[(raw["name"]=="tin_match") & (raw["platform_id"]=="16")][["business_id","fact_value"]].copy()
    if not mid.empty:
        mid["middesk_tin_task"] = mid["fact_value"].apply(parse_tin_match).astype(str)
        pivoted = pivoted.merge(mid[["business_id","middesk_tin_task"]], on="business_id", how="left")
    if "middesk_tin_task" not in pivoted.columns:
        pivoted["middesk_tin_task"] = "none"
    pivoted["middesk_tin_task"] = pivoted["middesk_tin_task"].fillna("none").astype(str)

    pivoted["has_middesk"] = pivoted["middesk_tin_task"] != "none"
    trulioo_biz = set(raw.loc[raw["platform_id"]=="38", "business_id"])
    pivoted["has_trulioo"] = pivoted["business_id"].isin(trulioo_biz)
    pivoted["entity_type"] = "Unknown"
    pivoted["state"]       = "Unknown"
    return pivoted


def live_naics(limit):
    # CONFIRMED from top-100: naics_code ✅ 69,949 · mcc_code ✅ 69,681
    # naics_description ✅ 69,681 · mcc_description ✅ 69,681 · industry ✅ 69,681
    raw = query_fact("naics_code", limit)
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

    mcc = query_fact("mcc_code", limit)
    if mcc is not None and not mcc.empty:
        mcc["mcc_code"] = mcc["value"].apply(
            lambda v: str(_parse_fact(v).get("value","")) if v else "")
        raw = raw.merge(mcc[["business_id","mcc_code"]], on="business_id", how="left")
    else:
        raw["mcc_code"] = None

    raw["entity_type"] = "Unknown"
    raw["state"]       = "Unknown"
    return raw


def _discover_fact_names(pattern_list):
    """Query distinct fact names matching any of the given LIKE patterns."""
    likes = " OR ".join(f"name LIKE '{p}'" for p in pattern_list)
    sql = f"""
        SELECT DISTINCT name, COUNT(*) AS rows
        FROM rds_warehouse_public.facts
        WHERE {likes}
        GROUP BY name ORDER BY rows DESC LIMIT 50
    """
    df = run_query(sql)
    if df is not None and not df.empty:
        return df["name"].tolist()
    return []


def live_banking(limit):
    """
    Banking data lives in rds_integration_data (Redshift federated external schema).

    CONFIRMED from live queries:
      rds_integration_data.rel_banking_verifications EXISTS
        - verification_status: 'SUCCESS' (99.94%), 'ERRORED' (0.06%)
        - NOTE: column is verification_status, NOT account_status
        - NOTE: account_id column does NOT exist in this table

      rds_integration_data.bank_accounts EXISTS (from banking.ts source)

    NOTE: Federated external schemas (rds_*) do NOT appear in
    information_schema.tables on Redshift Serverless — skip discovery entirely
    and query the confirmed table names directly.
    """
    # Step 1: verification status summary (confirmed working)
    sql_verif = f"""
        SELECT
            verification_status,
            COUNT(*) AS accounts
        FROM rds_integration_data.rel_banking_verifications
        GROUP BY verification_status
        ORDER BY accounts DESC{_limit_clause(limit)}
    """
    verif_summary = run_query(sql_verif)

    # Step 2: full verification records — discover actual columns first via LIMIT 1
    sql_verif_cols = """
        SELECT * FROM rds_integration_data.rel_banking_verifications LIMIT 1
    """
    verif_sample = run_query(sql_verif_cols)

    # Step 3: bank_accounts — discover columns
    sql_acct_cols = """
        SELECT * FROM rds_integration_data.bank_accounts LIMIT 1
    """
    acct_sample = run_query(sql_acct_cols)

    # Build verification records with available columns
    if verif_sample is not None and not verif_sample.empty:
        cols = list(verif_sample.columns)
        # Find business_id column
        biz_col = next((c for c in cols if "business" in c.lower()), None)
        status_col = next((c for c in cols if "status" in c.lower()), "verification_status")
        ts_col = next((c for c in cols if "creat" in c.lower() or "update" in c.lower()), None)

        select_cols = [c for c in [biz_col, status_col, ts_col] if c]
        select_expr = ", ".join(select_cols) if select_cols else "*"

        order_clause = f"ORDER BY {ts_col} DESC" if ts_col else ""
        sql_verif_full = f"""
            SELECT {select_expr}
            FROM rds_integration_data.rel_banking_verifications
            {order_clause}{_limit_clause(limit)}
        """
        verif = run_query(sql_verif_full)
    else:
        verif = None

    # Store what we found for the UI
    st.session_state["_banking_verif_summary"] = verif_summary
    st.session_state["_banking_verif_cols"]    = list(verif_sample.columns) if verif_sample is not None and not verif_sample.empty else []
    st.session_state["_banking_acct_cols"]     = list(acct_sample.columns)  if acct_sample  is not None and not acct_sample.empty  else []

    if verif_summary is None or verif_summary.empty:
        st.session_state["_banking_error"] = st.session_state.get("_last_db_error","")
        return None

    # Build a per-business DataFrame from the summary + full records
    if verif is not None and not verif.empty:
        df = verif.copy()
    else:
        # Fallback: expand summary into rows (no business_id granularity)
        df = verif_summary.copy()
        df["business_id"] = "aggregated"

    # Normalise status column name
    if "verification_status" in df.columns:
        df["account_status"] = df["verification_status"].apply(
            lambda s: "passed" if str(s).upper()=="SUCCESS"
                      else ("failed" if str(s).upper()=="ERRORED" else "missing"))
    elif "account_status" not in df.columns:
        df["account_status"] = "missing"

    # These don't come from rel_banking_verifications — default gracefully
    df["account_name_status"]  = "missing"
    df["contact_verification"] = "missing"
    df["verify_response_code"] = None
    df["has_bank_account"]     = True
    df["state"]                = "Unknown"
    return df

    # Merge verification + account data
    if verif is not None and not verif.empty and accts is not None and not accts.empty:
        df = verif.merge(accts[["business_id","account_id","account_type",
                                 "account_subtype","institution_name"]],
                         on=["business_id","account_id"], how="left")
    elif verif is not None and not verif.empty:
        df = verif.copy()
        for c in ["account_type","account_subtype","institution_name"]:
            df[c] = None
    else:
        df = accts.copy()
        for c in ["verification_status","verify_response_code","auth_response_code"]:
            df[c] = None

    # Map GIACT response codes to status labels
    def safe_int(v):
        try: return int(float(v))
        except Exception: return None

    if "verify_response_code" in df.columns:
        df["verify_response_code"] = df["verify_response_code"].apply(safe_int)
        df["account_status"] = df["verify_response_code"].apply(
            lambda c: GIACT_ACCOUNT_STATUS.get(c, ("missing",""))[0] if c is not None else "missing")
    else:
        df["account_status"] = df.get("verification_status", "missing")

    if "auth_response_code" in df.columns:
        df["auth_response_code"] = df["auth_response_code"].apply(safe_int)
        df["account_name_status"] = df["auth_response_code"].apply(
            lambda c: GIACT_ACCOUNT_NAME.get(c, ("missing",""))[0] if c is not None else "missing")
        df["contact_verification"] = df["auth_response_code"].apply(
            lambda c: GIACT_CONTACT_VERIFICATION.get(c, ("missing",""))[0] if c is not None else "missing")
    else:
        df["account_name_status"] = "missing"
        df["contact_verification"] = "missing"

    df["has_bank_account"] = True
    df["state"]            = "Unknown"
    return df


def live_worth(limit):
    """
    Worth Score sources (confirmed from schema inspection):

    1. rds_manual_score_public.business_scores
       Confirmed fields: weighted_score_850, weighted_score_100, risk_level,
                         score_decision, created_at
       NOTE: score_status column does NOT exist — removed from all queries.

    2. rds_manual_score_public.data_current_scores
       Latest score per business — join on score_id = business_scores.id

    3. warehouse.worth_score_input_audit (Redshift native table)
       Audit fill rates by date — confirmed working with real data.
       Fields: score_date, rows_per_day, fill_state, fill_naics6, fill_revenue, etc.
    """
    # Primary: latest score per business via data_current_scores
    # No score_status filter — column does not exist in this schema version
    sql_primary = f"""
        SELECT
            cs.business_id,
            bs.weighted_score_850  AS worth_score_850,
            bs.weighted_score_100  AS worth_score_100,
            bs.risk_level,
            bs.score_decision,
            bs.created_at          AS scored_at
        FROM rds_manual_score_public.data_current_scores cs
        JOIN rds_manual_score_public.business_scores bs
          ON bs.id = cs.score_id
        WHERE bs.weighted_score_850 IS NOT NULL
        ORDER BY bs.created_at DESC{_limit_clause(limit)}
    """
    raw = run_query(sql_primary)

    # Fallback 1: business_scores directly (no business_id join)
    if raw is None or raw.empty:
        sql_fallback = f"""
            SELECT
                id               AS score_id,
                weighted_score_850,
                weighted_score_100,
                risk_level,
                score_decision,
                created_at       AS scored_at
            FROM rds_manual_score_public.business_scores
            WHERE weighted_score_850 IS NOT NULL
            ORDER BY created_at DESC{_limit_clause(limit)}
        """
        raw = run_query(sql_fallback)
        if raw is not None and not raw.empty:
            raw["business_id"] = raw.get("score_id", raw.index).astype(str)

    # Fallback 2: use warehouse.worth_score_input_audit aggregate data
    if raw is None or raw.empty:
        sql_audit = f"""
            SELECT
                score_date,
                rows_per_day,
                fill_state,
                fill_naics6,
                fill_revenue,
                fill_age_bankruptcy,
                fill_age_judgment,
                fill_age_lien,
                fill_count_employees,
                fill_count_reviews,
                fill_score_reviews
            FROM warehouse.worth_score_input_audit
            ORDER BY score_date DESC{_limit_clause(limit)}
        """
        audit = run_query(sql_audit)
        if audit is not None and not audit.empty:
            # Return audit data tagged so the section knows to show audit view
            audit["_source"] = "audit"
            return audit
        return None

    if raw is None or raw.empty:
        return None

    raw["worth_score_850"] = pd.to_numeric(raw["worth_score_850"], errors="coerce")
    raw = raw.dropna(subset=["worth_score_850"])
    if raw.empty:
        return None

    # Normalise risk_level to match the rest of the dashboard
    def normalise_risk(v):
        s = str(v or "").upper()
        if s in ("HIGH",):        return "HIGH"
        if s in ("MEDIUM","MOD","MODERATE"): return "MODERATE"
        if s in ("LOW",):         return "LOW"
        # Derive from score if not set
        return ""

    if "risk_level" in raw.columns:
        raw["risk_level"] = raw["risk_level"].apply(normalise_risk)
        # Fill blanks from score thresholds
        mask = raw["risk_level"] == ""
        raw.loc[mask, "risk_level"] = raw.loc[mask, "worth_score_850"].apply(
            lambda s: "HIGH" if s<500 else ("MODERATE" if s<650 else "LOW"))
    else:
        raw["risk_level"] = raw["worth_score_850"].apply(
            lambda s: "HIGH" if s<500 else ("MODERATE" if s<650 else "LOW"))

    # score_decision may not exist in older schema versions
    if "score_decision" not in raw.columns:
        raw["score_decision"] = "UNKNOWN"

    # SHAP data lives in rds_manual_score_public.business_score_factors —
    # default to 0 here; a separate query would be needed for factor breakdown
    for c in ["shap_public_records","shap_company_profile","shap_financials","shap_banking"]:
        raw[c] = 0.0
    raw["count_bk"] = 0; raw["count_judgment"] = 0; raw["count_lien"] = 0
    raw["state"]    = "Unknown"

    # Ensure business_id column exists
    if "business_id" not in raw.columns or raw["business_id"].isna().all():
        raw["business_id"] = raw.get("score_id", raw.index).astype(str)

    return raw


def live_kyc(limit):
    # CONFIRMED fact names from top-100 query:
    #   name_match_boolean       ✅ 73K
    #   address_match_boolean    ✅ 73K
    #   tin_match_boolean        ✅ 73K
    #   address_verification_boolean ✅ 73K
    #   idv_status               ✅ 65K
    #   idv_passed_boolean       ✅ 65K
    #   idv_passed               ✅ 65K
    # compliance_status, risk_score — not in DB yet
    raw = query_facts_safe([
        'name_match_boolean', 'address_match_boolean',
        'tin_match_boolean', 'address_verification_boolean',
        'idv_status', 'idv_passed_boolean', 'idv_passed',
        'is_sole_prop', 'verification_status',
        'compliance_status', 'risk_score',
    ], limit)
    if raw is None or raw.empty:
        return None

    raw["fact_value"] = raw["value"].apply(
        lambda v: str(_parse_fact(v).get("value","")) if v else "")

    pivoted = raw.pivot_table(
        index="business_id", columns="name", values="fact_value", aggfunc="last"
    ).reset_index()
    pivoted.columns.name = None

    def bool_to_match(v):
        s = str(v).lower() if v is not None else ""
        if s in ("true","success","1"): return "success"
        if s in ("false","failure","0"): return "failure"
        return "none"

    # Use confirmed facts — default gracefully when optional IDV facts absent
    pivoted["name_match"]    = pivoted["name_match_boolean"].apply(bool_to_match) if "name_match_boolean" in pivoted.columns else "none"
    pivoted["address_match"] = pivoted["address_match_boolean"].apply(bool_to_match) if "address_match_boolean" in pivoted.columns else "none"
    pivoted["tin_match_ok"]  = pivoted["tin_match_boolean"].apply(bool_to_match) if "tin_match_boolean" in pivoted.columns else "none"

    # IDV — optional, may not exist
    def parse_idv(v):
        if not v: return "UNKNOWN"
        try:
            obj = json.loads(v)
            if isinstance(obj, dict):
                return max(obj, key=obj.get, default="UNKNOWN")
            return str(v).upper()
        except Exception:
            return str(v).upper()

    pivoted["idv_status"] = pivoted["idv_status"].apply(parse_idv) if "idv_status" in pivoted.columns else "UNKNOWN"
    pivoted["idv_passed"] = pivoted["idv_status"] == "SUCCESS"

    def parse_compliance(v):
        if not v: return "unknown"
        s = str(v).lower()
        if "high" in s: return "high_risk"
        if "medium" in s or "med" in s: return "medium_risk"
        if "low" in s: return "low_risk"
        return "unknown"

    pivoted["risk_level"] = pivoted["compliance_status"].apply(parse_compliance) if "compliance_status" in pivoted.columns else "unknown"

    # Fields not in this DB — set neutral defaults
    pivoted["dob_match"]       = "none"
    pivoted["ssn_match"]       = "none"
    pivoted["phone_match"]     = "none"
    pivoted["synthetic_score"] = 0.0
    pivoted["stolen_score"]    = 0.0
    pivoted["entity_type"]     = "Unknown"
    pivoted["state"]           = "Unknown"
    return pivoted


def live_dd(limit):
    """
    Due Diligence data from multiple sources:

    PRIMARY (confirmed in rds_warehouse_public.facts):
      watchlist_hits   ✅ 73K rows — scalar count from Fact Engine
      num_bankruptcies ✅ 64K rows — scalar count
      num_judgements   ✅ 64K rows — scalar count
      num_liens        ✅ 64K rows — scalar count

    SECONDARY (rds_integration_data — direct Redshift Spectrum tables):
      business_entity_review_task WHERE key='watchlist' — full hit details
      clients.customer_table — watchlist_verification + watchlist_count

    Watchlist data flow:
      Vendor → integration_data.business_entity_review_task (RDS)
             → Facts Engine → watchlist_hits fact
             → Redshift: rds_integration_data → clients.customer_table
    """
    def safe_int(v):
        try: return int(float(v or 0))
        except Exception: return 0

    # Step 1: scalar facts from rds_warehouse_public.facts
    raw = query_facts_safe([
        'watchlist_hits', 'adverse_media_hits',
        'num_bankruptcies', 'num_judgements', 'num_liens',
    ], limit)

    if raw is not None and not raw.empty:
        raw["fact_value"] = raw["value"].apply(
            lambda v: str(_parse_fact(v).get("value","")) if v else "0")
        pivoted = raw.pivot_table(
            index="business_id", columns="name", values="fact_value", aggfunc="last"
        ).reset_index()
        pivoted.columns.name = None
    else:
        pivoted = None

    # Step 2: clients.customer_table — try multiple possible column name variants
    # The watchlist column may be named watchlist_count, watchlist_hits, or watchlists
    cust = None
    # Try multiple possible column name variants — include all rows for proper stats
    for wl_col in ["watchlist_count", "watchlists", "watchlist_hits", "watchlist_count_total"]:
        cust_sql = f"""
            SELECT business_id,
                   {wl_col}                AS watchlist_count,
                   watchlist_verification  AS watchlist_verification
            FROM clients.customer_table
            WHERE {wl_col} IS NOT NULL
            ORDER BY {wl_col} DESC{_limit_clause(limit)}
        """
        cust = run_query(cust_sql)
        if cust is not None and not cust.empty:
            st.session_state["_watchlist_col_found"] = wl_col
            break
        st.session_state.pop("_last_db_error", None)

    # Also try the verification_results table
    if cust is None or cust.empty:
        cust_sql2 = f"""
            SELECT business_id,
                   watchlist_count,
                   watchlist_verification
            FROM clients.verification_results
            WHERE watchlist_count IS NOT NULL{_limit_clause(limit)}
        """
        cust = run_query(cust_sql2)

    # Also try sanctions separately using the BERT metadata
    # Sanctions are a listType within the watchlist — filter by type='sanctions' in Python
    sanctions_sql = f"""
        SELECT bev.business_id,
               COUNT(*) AS sanctions_bert_count
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id = bert.business_entity_verification_id
        WHERE bert.key = 'watchlist'
          AND LOWER(bert.status) = 'warning'
        GROUP BY bev.business_id
        HAVING COUNT(*) > 0{_limit_clause(limit)}
    """
    # Note: true sanctions vs PEP split requires parsing metadata JSONB
    # which exceeds federation VARCHAR limit. We use watchlist_status='warning'
    # as a proxy — all warning rows potentially include sanctions.
    # sanctions_hits and pep_hits facts from rds_warehouse_public.facts are the
    # pre-computed split (if stored).

    # Step 3: try rds_integration_data.business_entity_review_task
    # This is the ground-truth source (directly from the vendor hit data)
    bert = None
    bert_sql = f"""
        SELECT bev.business_id,
               bert.status,
               bert.sublabel
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id = bert.business_entity_verification_id
        WHERE bert.key = 'watchlist'
        ORDER BY bev.business_id{_limit_clause(limit)}
    """
    bert = run_query(bert_sql)

    # BERT — count warning-status rows per business (each warning = a hit)
    # Use a separate aggregated query to get correct counts without the record limit
    bert_hits = None
    bert_count_sql = f"""
        SELECT bev.business_id,
               SUM(CASE WHEN LOWER(bert.status) = 'warning' THEN 1 ELSE 0 END) AS watchlist_hits_bert,
               MAX(bert.status)   AS watchlist_status,
               MAX(bert.sublabel) AS watchlist_sublabel
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id = bert.business_entity_verification_id
        WHERE bert.key = 'watchlist'
        GROUP BY bev.business_id
        HAVING SUM(CASE WHEN LOWER(bert.status) = 'warning' THEN 1 ELSE 0 END) > 0
        ORDER BY watchlist_hits_bert DESC{_limit_clause(limit)}
    """
    bert_hits = run_query(bert_count_sql)
    if bert_hits is not None and not bert_hits.empty:
        bert_hits["watchlist_hits_bert"] = bert_hits["watchlist_hits_bert"].apply(safe_int)
    else:
        bert_hits = None

    # ── Priority merge: clients.customer_table is the most reliable source ──────
    # clients.customer_table.watchlist_count = confirmed field from the spreadsheet
    # It counts hits from business_entity_review_task (BERT) via verification_results.sql
    # This is the same field shown in the Admin Portal and in the export spreadsheet.

    # ── Build the final DataFrame — priority order ────────────────────────────
    # 1st: BERT (ground truth — actual vendor hit records)
    # 2nd: clients.customer_table (derived, but confirmed in spreadsheet)
    # 3rd: rds_warehouse_public.facts watchlist_hits (often 0)

    if bert_hits is not None and not bert_hits.empty:
        df = bert_hits.rename(columns={"watchlist_hits_bert":"watchlist_hits"}).copy()
        df.attrs["watchlist_source"] = "rds_integration_data.business_entity_review_task (BERT)"
    elif cust is not None and not cust.empty:
        df = cust.rename(columns={"watchlist_count":"watchlist_hits"}).copy()
        df.attrs["watchlist_source"] = f"clients.customer_table (col={st.session_state.get('_watchlist_col_found','watchlist_count')})"
    elif pivoted is not None and not pivoted.empty:
        df = pivoted.copy()
        df.attrs["watchlist_source"] = "rds_warehouse_public.facts (watchlist_hits)"
    else:
        return None

    # ── Ensure watchlist_hits is numeric ─────────────────────────────────────
    if "watchlist_hits" not in df.columns:
        df["watchlist_hits"] = 0
    df["watchlist_hits"] = df["watchlist_hits"].apply(safe_int)

    # ── Merge BK/Judgment/Lien from facts table ───────────────────────────────
    if pivoted is not None and not pivoted.empty and "business_id" in df.columns:
        for fact_col, target_col in [
            ("num_bankruptcies","bk_hits"),
            ("num_judgements","judgment_hits"),
            ("num_liens","lien_hits"),
            ("adverse_media_hits","adverse_media_hits"),
        ]:
            if fact_col in pivoted.columns:
                subset = pivoted[["business_id",fact_col]].copy()
                subset[fact_col] = subset[fact_col].apply(safe_int)
                df = df.merge(subset.rename(columns={fact_col:target_col}),
                              on="business_id", how="left")
                df[target_col] = df[target_col].fillna(0).astype(int)
            elif target_col not in df.columns:
                df[target_col] = 0
    else:
        for col in ["bk_hits","judgment_hits","lien_hits","adverse_media_hits"]:
            if col not in df.columns:
                df[col] = 0

    # ── Merge BERT status/sublabel ────────────────────────────────────────────
    if bert is not None and not bert.empty and "business_id" in df.columns:
        bert_status = bert.groupby("business_id").agg(
            watchlist_status=("status","first"),
            watchlist_sublabel=("sublabel","first"),
        ).reset_index()
        df = df.merge(bert_status, on="business_id", how="left")
    else:
        df["watchlist_status"]   = None
        df["watchlist_sublabel"] = None

    # ── Store data source metadata ────────────────────────────────────────────
    df.attrs["has_facts"]     = pivoted is not None and not pivoted.empty
    df.attrs["has_cust"]      = cust is not None and not cust.empty
    df.attrs["has_bert"]      = bert is not None and not bert.empty
    df.attrs["has_bert_hits"] = bert_hits is not None and not bert_hits.empty
    if "watchlist_source" not in df.attrs:
        df.attrs["watchlist_source"] = "rds_warehouse_public.facts"

    # Defaults for missing columns
    for col in ["sanctions_hits","pep_hits"]:
        if col not in df.columns:
            df[col] = 0

    df["state"]       = "Unknown"
    df["entity_type"] = "Unknown"
    return df


# Sections that are optional — if their facts don't exist, show info instead of error
OPTIONAL_SECTIONS = {"banking", "kyc", "worth"}

# ── Session-state cache helpers ────────────────────────────────────────────────
def _cache_key(section_key, limit):
    """Unique key for session_state cache — includes limit so changing the
    slider correctly invalidates the cached data."""
    return f"_data_{section_key}_{limit}"

def _cache_ts_key(section_key, limit):
    return f"_ts_{section_key}_{limit}"

def clear_data_cache():
    """Remove all cached DataFrames from session_state.
    Called when the user clicks 'Refresh All Data'.
    Clears: section data, timestamps, consistency facts, and per-business caches."""
    keys_to_del = [k for k in st.session_state
                   if k.startswith(("_data_","_ts_","_biz_","_biz_ts_"))]
    for k in keys_to_del:
        del st.session_state[k]

def get_cache_age(section_key, limit):
    """Return how many seconds ago this dataset was loaded, or None if not cached."""
    ts = st.session_state.get(_cache_ts_key(section_key, limit))
    if ts is None:
        return None
    return int((datetime.now(timezone.utc) - ts).total_seconds())

def get_section_data(section_key, limit):
    """
    Load data with session_state caching.

    Flow:
      1. Check session_state for a cached DataFrame under (section_key, limit).
      2. If found → return immediately (no Redshift query).
      3. If not found → query Redshift, store result in session_state, return.

    Cache is invalidated when:
      - User clicks '🔄 Refresh All Data' in the sidebar (calls clear_data_cache())
      - The 'Records to load' slider value changes (different limit = different key)
      - The Streamlit server restarts (session_state is process-local)
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
    live_fn    = loaders[section_key]
    is_optional = section_key in OPTIONAL_SECTIONS
    cache_key  = _cache_key(section_key, limit)

    # ── Step 1: return cached data if available ────────────────────────────────
    if cache_key in st.session_state:
        cached = st.session_state[cache_key]
        # None is a valid cached value (optional section returned no data)
        if cached is None and is_optional:
            return None
        if cached is not None and not (hasattr(cached,"empty") and cached.empty):
            return cached

    # ── Step 2: not cached — need to query Redshift ────────────────────────────
    if not live:
        st.error("🔴 Not connected to Redshift. Connect VPN and click **Retry connection** in the sidebar.")
        st.stop()

    with st.spinner(f"⏳ Loading {section_key} data from Redshift… (will cache for this session)"):
        df = live_fn(limit)

    # Store in session_state regardless of success/failure (None = no data available)
    st.session_state[cache_key] = df
    st.session_state[_cache_ts_key(section_key, limit)] = datetime.now(timezone.utc)

    if df is None or (hasattr(df, 'empty') and df.empty):
        err = st.session_state.get("_last_db_error", "")
        keyword = section_key.split('_')[0]
        discovery_sql = f"""-- Find all fact names stored for this topic:
SELECT DISTINCT name, COUNT(*) AS rows
FROM rds_warehouse_public.facts
WHERE name LIKE '%{keyword}%'
GROUP BY name ORDER BY rows DESC LIMIT 30;

-- Top 50 fact names by volume (to see everything available):
SELECT DISTINCT name, COUNT(*) AS rows
FROM rds_warehouse_public.facts
GROUP BY name ORDER BY rows DESC LIMIT 50;"""

        if is_optional:
            # Banking uses rds_integration_data, not rds_warehouse_public.facts
            if section_key == "banking":
                st.info("ℹ️ Banking data could not be loaded from `rds_integration_data`. "
                        "The Banking section will show detailed diagnostics.")
            else:
                st.info(f"ℹ️ No **{section_key}** data found. "
                        "This is expected if this integration is not yet active.")
            with st.expander("🔍 Discovery SQL"):
                st.code(discovery_sql, language="sql")
            return None   # caller handles None for optional sections
        else:
            if err:
                st.error(f"❌ Failed to load **{section_key}** data.")
                st.code(err, language=None)
            else:
                st.warning(f"⚠️ No **{section_key}** data found in your database.")
            with st.expander("🔍 Run this SQL to check what facts are available"):
                st.code(discovery_sql, language="sql")
            st.stop()

    return df


# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
# Test connection on every app load — fresh TCP each time, no caching.
live, _conn_err = test_connection()


# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR — 6 consolidated sections
# ═══════════════════════════════════════════════════════════════════════════════
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
        "🏛️ Identity & Registry",
        "🏭 Classification",
        "💰 Risk & Score",
        "🏦 Banking & Ops",
        "🔎 Business Lookup",
    ])
    st.markdown("---")
    load_all = st.checkbox("Load ALL records", value=False)
    if load_all:
        record_limit = None
        st.caption("⚠️ No limit — may be slow")
    else:
        record_limit = st.select_slider(
            "Records to load",
            options=[500, 1_000, 5_000, 10_000, 25_000, 50_000, 100_000],
            value=5_000,
        )
        st.caption(f"Up to {record_limit:,} records")

    # ── Cache status & refresh ─────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("**📦 Data Cache**")

    ALL_SECTIONS = ["sos","tin","naics","banking","worth","kyc","dd"]
    SECTION_LABELS = {
        "sos":"SOS/Vendors","tin":"TIN","naics":"NAICS/MCC",
        "banking":"Banking","worth":"Worth Score","kyc":"KYC/IDV","dd":"Due Diligence"
    }
    any_cached = False
    for sk in ALL_SECTIONS:
        age = get_cache_age(sk, record_limit)
        if age is not None:
            any_cached = True
            mins = age // 60
            secs = age % 60
            age_str = f"{mins}m {secs}s ago" if mins > 0 else f"{secs}s ago"
            st.caption(f"✅ {SECTION_LABELS[sk]} — {age_str}")
        else:
            st.caption(f"⚪ {SECTION_LABELS[sk]} — not loaded yet")

    if any_cached:
        if st.button("🔄 Refresh All Data", use_container_width=True):
            clear_data_cache()
            st.success("Cache cleared — data will reload on next visit to each section.")
            st.rerun()
    else:
        st.caption("Data loads automatically when you visit each section.")

    st.markdown("---")
    st.caption("Sources: `rds_warehouse_public.facts`")
    st.caption("`rds_manual_score_public.business_scores`")
    st.caption("`rds_integration_data.*`")


# ── PID name map ──────────────────────────────────────────────────────────────
# pid=0  → fact was set by the system internally (businessDetails / applicant form)
# pid=-1 → fact default / no vendor provided this value
# pid="" → fact exists but source metadata is missing
PID = {"16":"Middesk","23":"OC","24":"ZoomInfo","17":"Equifax",
       "38":"Trulioo","31":"AI","22":"SERP","40":"Plaid",
       "0":"Applicant/System","-1":"No vendor (default)","":"Unknown source"}

def pid_name(pid):
    s = str(pid)
    return PID.get(s, f"pid={s}")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — EXECUTIVE OVERVIEW
# ═══════════════════════════════════════════════════════════════════════════════
if section == "📋 Overview":
    st.markdown("# 🏦 Admin Portal — KYB Intelligence Dashboard")
    st.markdown("*All KYB fields · vendor match rates · data quality · risk signals · anomaly detection*")

    # ── Load all datasets (served from session_state cache on repeat visits) ──
    sos   = get_section_data("sos",   record_limit)
    tin   = get_section_data("tin",   record_limit)
    dd    = get_section_data("dd",    record_limit)
    naics = get_section_data("naics", record_limit)
    kyc   = get_section_data("kyc",   record_limit)

    biz = sos["business_id"].nunique()
    sos_active_pct   = sos["active"].mean()*100
    sos_matched_pct  = sos["sos_matched"].mean()*100 if "sos_matched" in sos.columns else None
    tin["tin_match_boolean"] = tin["tin_match_boolean"].astype(bool)
    tin["tin_submitted"]     = tin["tin_submitted"].astype(bool)
    tin["tin_match_status"]  = tin["tin_match_status"].astype(str)
    tin_verified_pct  = tin["tin_match_boolean"].mean()*100
    tin_submitted_pct = tin["tin_submitted"].mean()*100
    tin_failed_pct    = (tin["tin_match_status"]=="failure").mean()*100
    naics_fallback_pct= naics["is_fallback"].mean()*100 if "is_fallback" in naics.columns else None
    wl_hit_pct        = (dd["watchlist_hits"]>0).mean()*100 if "watchlist_hits" in dd.columns else 0
    bk_any_pct        = (dd["bk_hits"]>0).mean()*100 if "bk_hits" in dd.columns else 0
    idv_passed_pct    = kyc["idv_passed"].mean()*100 if kyc is not None and "idv_passed" in kyc.columns else None
    middesk_match_pct = (sos["middesk_conf"]>0.50).mean()*100
    oc_match_pct      = (sos["oc_conf"]>0.50).mean()*100

    # ── Top KPIs ───────────────────────────────────────────────────────────────
    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Businesses",f"{biz:,}","in scope","#3B82F6")
    with c2: kpi("SOS Active",f"{sos_active_pct:.1f}%",
                 "✅ Good" if sos_active_pct>95 else "⚠️ Below 95%",
                 "#22c55e" if sos_active_pct>95 else "#ef4444")
    with c3: kpi("TIN Verified",f"{tin_verified_pct:.1f}%",
                 "of submitted TINs","#22c55e" if tin_verified_pct>70 else "#ef4444")
    with c4: kpi("NAICS Fallback",
                 f"{naics_fallback_pct:.1f}%" if naics_fallback_pct is not None else "N/A",
                 "561499","#ef4444" if (naics_fallback_pct or 0)>10 else "#f59e0b")
    with c5: kpi("Watchlist Hits",f"{wl_hit_pct:.1f}%","≥1 hit","#a855f7")
    with c6: kpi("IDV Passed",
                 f"{idv_passed_pct:.1f}%" if idv_passed_pct is not None else "N/A",
                 "Plaid","#22c55e" if (idv_passed_pct or 0)>65 else "#f59e0b")

    st.markdown("---")

    # ── Data Quality Scorecard ─────────────────────────────────────────────────
    st.markdown("### 🎯 Data Quality Scorecard")
    sanity_checks = [
        ("SOS Active > 95%",       sos_active_pct > 95,   f"{sos_active_pct:.1f}%"),
        ("SOS Match > 90%",        (sos_matched_pct or 0) > 90, f"{sos_matched_pct:.1f}%" if sos_matched_pct else "N/A"),
        ("TIN Submission > 90%",   tin_submitted_pct > 90, f"{tin_submitted_pct:.1f}%"),
        ("TIN Verified > 70%",     tin_verified_pct > 70,  f"{tin_verified_pct:.1f}%"),
        ("TIN Failure < 20%",      tin_failed_pct < 20,    f"{tin_failed_pct:.1f}%"),
        ("NAICS Fallback < 10%",   (naics_fallback_pct or 0) < 10, f"{naics_fallback_pct:.1f}%" if naics_fallback_pct else "N/A"),
        ("Middesk Match > 60%",    middesk_match_pct > 60, f"{middesk_match_pct:.1f}%"),
        ("OC Match > 50%",         oc_match_pct > 50,      f"{oc_match_pct:.1f}%"),
        ("Watchlist Hits < 10%",   wl_hit_pct < 10,        f"{wl_hit_pct:.1f}%"),
        ("IDV Passed > 65%",       (idv_passed_pct or 65) > 65, f"{idv_passed_pct:.1f}%" if idv_passed_pct else "N/A"),
    ]
    pass_count = sum(1 for _,ok,_ in sanity_checks if ok)
    fail_count = len(sanity_checks) - pass_count
    overall_health = "🟢 HEALTHY" if fail_count==0 else ("🟡 WATCH" if fail_count<=2 else "🔴 ACTION NEEDED")
    col_health, col_score = st.columns([1,3])
    with col_health:
        color = "#22c55e" if fail_count==0 else ("#f59e0b" if fail_count<=2 else "#ef4444")
        kpi("Overall Health",overall_health,f"{pass_count}/{len(sanity_checks)} checks passing",color)
    with col_score:
        rows = []
        for label,ok,val in sanity_checks:
            rows.append({"Check":label,"Result":val,
                         "Status":"✅ PASS" if ok else "❌ FAIL"})
        styled_table(pd.DataFrame(rows), color_col="Status",
                     palette={"✅ pass":"#22c55e","❌ fail":"#ef4444"})

    with st.expander("ℹ️ How to read the Data Quality Scorecard — what PASS/FAIL means"):
        st.markdown("""
**What this scorecard measures:** Each row is an industry-standard threshold for a healthy KYB data pipeline.
`✅ PASS` means your data meets the target. `❌ FAIL` means it falls short — see below for root causes.

| Check | Target | What FAIL means | Root cause to investigate |
|---|---|---|---|
| **SOS Active > 95%** | >95% of businesses have an active SOS filing | Too many inactive entities applying | Dissolved/suspended businesses, admin dissolution, state compliance failure |
| **SOS Match > 90%** | >90% name-matched in registry | Submitted name ≠ registry legal name | DBA vs legal name confusion, name format differences |
| **TIN Submission > 90%** | >90% submitted an EIN | EIN field not required or skipped | Onboarding form not collecting EIN properly |
| **TIN Verified > 70%** | >70% of submitted EINs match IRS records | Wrong EIN, name mismatch, or fraud | DBA name submitted instead of legal name; check failure reasons |
| **TIN Failure < 20%** | <20% explicit failure from IRS | High rate of IRS rejections | Name change not reflected, SSN submitted as EIN for sole props |
| **NAICS Fallback < 10%** | <10% receive NAICS 561499 | Entity matching failing broadly | Check vendor data freshness; ZI/EFX/OC bulk data may be stale |
| **Middesk Match > 60%** | >60% match in US SOS via Middesk | Middesk not finding entities | New businesses, name normalization issues, Middesk API failures |
| **OC Match > 50%** | >50% match in global registry via OC | OC not finding entities | Coverage gaps, foreign entities without US presence |
| **Watchlist Hits < 10%** | <10% have any watchlist hit | Abnormally high hit rate | Check for false positive match logic (name collision) |
| **IDV Passed > 65%** | >65% pass Plaid identity verification | Low identity confirmation rate | User abandonment, expired documents, unsupported ID types |

**N/A** means the fact data was not available in the current query.
        """)

    st.markdown("---")

    # ── System Red Flags ───────────────────────────────────────────────────────
    st.markdown("### 🚨 Active Red Flags")
    flags_found = 0
    oc_high_mid_low = int(((sos["oc_conf"]>0.70) & (sos["middesk_conf"]<0.40)).sum())
    both_none       = int(((sos["middesk_conf"]==0) & (sos["oc_conf"]==0)).sum())
    tin_inconsist   = int((tin["tin_match_boolean"] & (tin["tin_match_status"]!="success")).sum())
    inactive_biz    = int((~sos["active"]).sum())
    wl_sanctions    = int((dd["sanctions_hits"]>0).sum()) if "sanctions_hits" in dd.columns else 0

    red_flags = [
        (oc_high_mid_low>0,   "red",   f"{oc_high_mid_low:,} businesses: OC confidence high but Middesk low — known Middesk data gap. These businesses lack US SOS confirmation."),
        (both_none>0,         "red",   f"{both_none:,} businesses: NO vendor matched (Middesk conf=0 AND OC conf=0). Entity existence completely unconfirmed. Do not auto-approve."),
        (tin_inconsist>0,     "red",   f"{tin_inconsist:,} businesses: tin_match_boolean=true but status≠'success'. Boolean derived incorrectly — data integrity issue."),
        (inactive_biz>0,      "amber", f"{inactive_biz:,} businesses have SOS inactive status. Check for perpetual+inactive combination (underwriting red flag)."),
        (wl_sanctions>0,      "red",   f"{wl_sanctions:,} businesses have SANCTIONS hits. Hard stop — cannot auto-approve. Route to compliance immediately."),
        (naics_fallback_pct is not None and naics_fallback_pct>15, "amber",
         f"NAICS 561499 fallback rate {naics_fallback_pct:.1f}% exceeds 15%. Entity matching degraded or new business segment with weak vendor coverage."),
        (tin_failed_pct>20,   "amber", f"TIN failure rate {tin_failed_pct:.1f}% exceeds 20%. High rate of EIN-name mismatches — possible data quality or applicant issue."),
    ]
    for condition, level, msg in red_flags:
        if condition:
            flag(msg, level)
            flags_found += 1
    if flags_found == 0:
        flag("No active red flags detected in this data sample.", "green")

    # ── Cross-analysis overview ────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("### 🔗 Key Relationship Analysis")
    col_l, col_r = st.columns(2)
    with col_l:
        middesk_h = (sos["middesk_conf"]>0.50)
        oc_h      = (sos["oc_conf"]>0.50)
        agree_df = pd.DataFrame({
            "Scenario":["Both matched","Middesk only","OC only","Neither"],
            "Count":[(middesk_h&oc_h).sum(),(middesk_h&~oc_h).sum(),(~middesk_h&oc_h).sum(),(~middesk_h&~oc_h).sum()],
        })
        agree_df["Meaning"] = ["✅ Healthy","⚠️ New incorporation?","🚨 Middesk gap","❌ Entity unconfirmed"]
        fig = px.pie(agree_df,names="Scenario",values="Count",
                     color="Scenario",
                     color_discrete_map={"Both matched":"#22c55e","Middesk only":"#f59e0b",
                                          "OC only":"#ef4444","Neither":"#64748b"},
                     hole=0.45,title="Middesk vs OC Agreement")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
        styled_table(agree_df)

        st.markdown("""
**What each scenario means:**

| Scenario | Meaning | Action |
|---|---|---|
| **Both matched** | Middesk (US SOS) AND OpenCorporates both confirmed this entity. Strongest possible confirmation. | No action needed |
| **Middesk only** | US SOS confirmed but OC did not. Typically means the business just incorporated (OC updates lag 2–4 weeks). | Acceptable if business is < 60 days old |
| **OC only** | OpenCorporates global registry confirmed but Middesk (US SOS live query) did not. This is the **Middesk data gap** — a known system issue. | Check `integration_data.request_response WHERE platform_id=16` for errors |
| **Neither** | NO vendor confirmed this entity exists. The highest-risk segment — entity existence is completely unverified. | **Do not auto-approve.** Route to manual underwriting. |

*Confidence threshold used: >0.50 = "matched". Source: `sos_active`, `sos_match`, `middesk_confidence` facts.*
        """)

    with col_r:
        tin_outcomes = pd.DataFrame({
            "Outcome":["✅ Verified","❌ Failed","⏳ Pending/Other","📭 Not submitted"],
            "Count":[
                int(tin["tin_match_boolean"].sum()),
                int((tin["tin_match_status"]=="failure").sum()),
                int((tin["tin_match_status"].isin(["pending",""])).sum()),
                int((~tin["tin_submitted"]).sum()),
            ]
        })
        fig2 = px.funnel(tin_outcomes,x="Count",y="Outcome",
                         color_discrete_sequence=["#22c55e","#ef4444","#f59e0b","#64748b"],
                         title="TIN Verification Funnel")
        st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        st.markdown("""
**What each TIN outcome means:**

| Outcome | What happened | Root cause | Action |
|---|---|---|---|
| **✅ Verified** | IRS confirmed the EIN matches the submitted legal business name. | EIN and name are correct. | No action needed |
| **❌ Failed** | IRS has no record of this EIN + legal name combination. | Wrong EIN; name mismatch (DBA vs legal); recent name change not yet in IRS system; sole prop submitted SSN. | Ask applicant to resubmit with exact legal name matching their EIN. |
| **⏳ Pending/Other** | The TIN match request was sent to Middesk but IRS has not responded yet. Includes empty status records. | Normal for same-day or next-day submissions. Also includes businesses where Middesk did not run the TIN task. | Wait 24–48h and recheck. If still pending after 72h, investigate Middesk API. |
| **📭 Not submitted** | The applicant did not provide an EIN at all. | EIN field was skipped on the onboarding form. | Require EIN resubmission before approval. |

*Source: `tin_match_boolean`, `tin_match.status`, `tin_submitted` facts from `rds_warehouse_public.facts`.*
        """)

    # ── Anomaly Leaderboard ────────────────────────────────────────────────────
    st.markdown("### ⚡ Anomaly Leaderboard — Top Issues to Investigate")
    anomalies = [
        {"Priority":"🔴 P1","Anomaly":"Entity unconfirmed (no vendor match)",
         "Count":f"{both_none:,}","% of Total":f"{both_none/max(biz,1)*100:.1f}%",
         "Action":"Manual underwriting required — do not auto-approve"},
        {"Priority":"🔴 P1","Anomaly":"Sanctions hit",
         "Count":f"{wl_sanctions:,}","% of Total":f"{wl_sanctions/max(biz,1)*100:.1f}%",
         "Action":"Hard stop — route to compliance immediately"},
        {"Priority":"🔴 P1","Anomaly":"TIN boolean/status inconsistency",
         "Count":f"{tin_inconsist:,}","% of Total":f"{tin_inconsist/max(biz,1)*100:.1f}%",
         "Action":"Data integrity bug — investigate kyb/index.ts L488–490"},
        {"Priority":"🟡 P2","Anomaly":"OC match, no Middesk (gap)",
         "Count":f"{oc_high_mid_low:,}","% of Total":f"{oc_high_mid_low/max(biz,1)*100:.1f}%",
         "Action":"Check integration_data.request_response WHERE platform_id=16"},
        {"Priority":"🟡 P2","Anomaly":"SOS inactive",
         "Count":f"{inactive_biz:,}","% of Total":f"{inactive_biz/max(biz,1)*100:.1f}%",
         "Action":"Check for perpetual+inactive combination — underwriting red flag"},
        {"Priority":"🟡 P2","Anomaly":"TIN failed (EIN-name mismatch)",
         "Count":f"{int(tin_failed_pct*biz/100):,}","% of Total":f"{tin_failed_pct:.1f}%",
         "Action":"Review failure messages — wrong EIN, name change, or fraud signal"},
    ]
    styled_table(pd.DataFrame(anomalies), color_col="Priority",
                 palette={"🔴 p1":"#ef4444","🟡 p2":"#f59e0b"})

    with st.expander("ℹ️ How to investigate each anomaly — step-by-step guide"):
        st.markdown("""
**Priority levels:** 🔴 P1 = immediate action required · 🟡 P2 = investigate within 1 week

| Anomaly | How to check | Expected finding | Escalation |
|---|---|---|---|
| **Entity unconfirmed (no vendor match)** | `SELECT * FROM rds_warehouse_public.facts WHERE business_id='UUID' AND name IN ('sos_active','sos_match_boolean','middesk_confidence')` — look for confidence=0 on both | Entity may be unregistered, very new (<1 week), or using a different legal name | Route 100% to manual underwriting |
| **Sanctions hit** | `SELECT * FROM rds_warehouse_public.facts WHERE business_id='UUID' AND name='watchlist_hits'` then check watchlist metadata for listType='SANCTIONS' | OFAC/UN/EU match on business name or owner | Hard stop — legal/compliance team required before any approval |
| **TIN boolean/status inconsistency** | `SELECT name, value FROM rds_warehouse_public.facts WHERE business_id='UUID' AND name IN ('tin_match','tin_match_boolean')` — compare status in tin_match.value.status vs tin_match_boolean.value | They should always agree. Any disagreement is a code bug. | File bug report for integration-service kyb/index.ts L488–490 |
| **OC match, no Middesk** | `SELECT * FROM integration_data.request_response WHERE business_id='UUID' AND platform_id=16` — check if Middesk was even called | If no row: Middesk was never called for this business. If row exists: check response for error. | Investigate Middesk integration or re-trigger Middesk lookup |
| **SOS inactive** | Use Business Lookup tab → enter UUID → Registry tab → check sos_active value and source_pid | pid=-1 means no vendor provided the status (default inactive). Real inactive has a specific vendor. | Check state SOS portal; request reinstatement documentation from applicant |
| **TIN failed** | `SELECT JSON_EXTRACT_PATH_TEXT(value,'value') FROM rds_warehouse_public.facts WHERE business_id='UUID' AND name='tin_match'` — read the message field | Common messages: 'does not have a record' (wrong EIN), 'associated with different name' (fraud risk) | Ask for corrected EIN + legal name documentation |
        """)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — IDENTITY & REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🏛️ Identity & Registry":
    sh("Identity & Registry",
       "SOS filings · TIN verification · IDV (Plaid) · vendor match rates · "
       "Middesk gap · inactive+perpetual · consistency checks", "🏛️")

    sos = get_section_data("sos",  record_limit)
    tin = get_section_data("tin",  record_limit)
    kyc = get_section_data("kyc",  record_limit)

    tin["tin_match_boolean"] = tin["tin_match_boolean"].astype(bool)
    tin["tin_submitted"]     = tin["tin_submitted"].astype(bool)
    tin["tin_match_status"]  = tin["tin_match_status"].astype(str).fillna("")
    tin["middesk_tin_task"]  = tin["middesk_tin_task"].astype(str).fillna("none")
    biz = sos["business_id"].nunique()

    # ── Top KPIs ───────────────────────────────────────────────────────────────
    sos_active_rate  = sos["active"].mean()*100
    sos_matched_rate = sos["sos_matched"].mean()*100 if "sos_matched" in sos.columns else None
    tin_verified     = int(tin["tin_match_boolean"].sum())
    tin_failed       = int((tin["tin_match_status"]=="failure").sum())
    tin_submitted    = int(tin["tin_submitted"].sum())
    tin_total        = len(tin)
    middesk_gap      = int(((sos["oc_conf"]>0.70)&(sos["middesk_conf"]<0.40)).sum())
    both_no_match    = int(((sos["middesk_conf"]==0)&(sos["oc_conf"]==0)).sum())
    inactive         = int((~sos["active"]).sum())
    idv_passed       = int(kyc["idv_passed"].sum()) if kyc is not None and "idv_passed" in kyc.columns else None

    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("SOS Active",f"{sos_active_rate:.1f}%","registry in good standing",
                 "#22c55e" if sos_active_rate>95 else "#ef4444")
    with c2: kpi("SOS Matched",f"{sos_matched_rate:.1f}%" if sos_matched_rate else "N/A",
                 "name matched registry","#22c55e" if (sos_matched_rate or 0)>90 else "#f59e0b")
    with c3: kpi("TIN Verified",f"{tin_verified/max(tin_total,1)*100:.1f}%",
                 f"{tin_verified:,} businesses","#22c55e" if tin_verified/max(tin_total,1)>0.70 else "#ef4444")
    with c4: kpi("TIN Failed",f"{tin_failed/max(tin_total,1)*100:.1f}%",
                 "EIN-name mismatch","#ef4444" if tin_failed/max(tin_total,1)>0.20 else "#22c55e")
    with c5: kpi("Middesk Gap",f"{middesk_gap:,}",
                 "OC high, Middesk low","#f59e0b")
    with c6: kpi("IDV Passed",f"{idv_passed:,}" if idv_passed else "N/A",
                 "Plaid identity verified","#22c55e")

    # Red flags
    if both_no_match>0:
        flag(f"🚨 {both_no_match:,} businesses: ZERO vendor confirmation (Middesk=0, OC=0). "
             "Entity existence completely unverified — highest risk segment.", "red")
    if inactive>0:
        flag(f"⚠️ {inactive:,} businesses have SOS inactive status. "
             "Inactive+perpetual = entity cannot legally operate. First red flag in underwriting.", "amber")

    tab_sos, tab_tin, tab_idv, tab_cross, tab_vendors, tab_dq = st.tabs([
        "🏛️ SOS Registry","🔐 TIN","🪪 IDV (Plaid)","🔗 Cross-Analysis","📡 Vendors","🔬 Quality Checks"
    ])

    # ── SOS ────────────────────────────────────────────────────────────────────
    with tab_sos:
        col_l, col_r = st.columns(2)
        with col_l:
            act_df = pd.DataFrame({"Status":["Active","Inactive"],"Count":[int(sos["active"].sum()),inactive]})
            fig = px.pie(act_df,names="Status",values="Count",color="Status",
                         color_discrete_map={"Active":"#22c55e","Inactive":"#ef4444"},
                         hole=0.5,title="SOS Active Status")
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            st.markdown("""
**Active** (green) = `sos_active=true` — the entity is legally registered and in good standing.
This means the state has NOT revoked the entity's right to conduct business.

**Inactive** (red) = `sos_active=false` — the entity exists in the registry but is NOT in good standing.
Common causes: (1) failed to file annual report, (2) unpaid state franchise tax,
(3) administrative dissolution. The entity **cannot legally conduct business** in this state.

⚠️ **Important distinction:** "Inactive" ≠ "dissolved". A dissolved entity has been formally ended.
An inactive entity still legally exists but has lost its right to operate — it can be reinstated.
            """)
        with col_r:
            fig2 = px.histogram(sos,x="middesk_conf",nbins=20,
                                color_discrete_sequence=["#f59e0b"],
                                title="Middesk Confidence Distribution")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#22c55e",annotation_text="Target 0.70")
            fig2.add_vline(x=0.40,line_dash="dash",line_color="#ef4444",annotation_text="Low 0.40")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
            st.markdown("""
**What Middesk confidence measures:** How certain Middesk is that the business name and address
submitted by the applicant matches a real Secretary of State (SOS) registry record.

**Scale: 0.0 → 1.0**
- Formula: **0.15 base** + **0.20 per successful review task** (up to 4 tasks: name, TIN, address, SOS match)
- Maximum possible score: 0.15 + (4 × 0.20) = **0.95**

**Threshold interpretation:**
- 🟢 **> 0.70** (green line): Strong match — at least 3 review tasks confirmed
- 🟡 **0.40 – 0.70**: Partial match — 1–2 tasks confirmed; review before approval
- 🔴 **< 0.40** (red line): Weak/no match — Middesk could not verify this entity

**The spike at 0 vs spike at ~1:** A bimodal distribution (spikes at both ends)
means you have two distinct populations: businesses Middesk clearly confirmed (high conf)
and businesses Middesk couldn't find at all (conf=0). This is the expected pattern.
A spread in the middle indicates partial matches needing manual review.
            """)

        st.markdown("#### 📋 SOS Status Summary")
        sos_tbl = pd.DataFrame({
            "Metric":["Total businesses","Active SOS","Inactive SOS","SOS name matched",
                      "Avg Middesk confidence","Avg OC confidence",
                      "Middesk gap (OC high, Middesk low)","Neither vendor matched"],
            "Value":[f"{biz:,}",f"{int(sos['active'].sum()):,} ({sos_active_rate:.1f}%)",
                     f"{inactive:,} ({inactive/max(biz,1)*100:.1f}%)",
                     f"{int(sos['sos_matched'].sum()):,} ({sos_matched_rate:.1f}%)" if sos_matched_rate else "N/A",
                     f"{sos['middesk_conf'].mean():.3f}",f"{sos['oc_conf'].mean():.3f}",
                     f"{middesk_gap:,} ({middesk_gap/max(biz,1)*100:.1f}%)",
                     f"{both_no_match:,} ({both_no_match/max(biz,1)*100:.1f}%)"],
            "Status":["","✅ Good" if sos_active_rate>95 else "❌ Below target",
                      "⚠️ Review" if inactive>0 else "✅ None",
                      "✅ Good" if (sos_matched_rate or 0)>90 else "⚠️ Below target","","",
                      "⚠️ Investigate" if middesk_gap>0 else "✅ None",
                      "🚨 High risk" if both_no_match>0 else "✅ None"],
        })
        styled_table(sos_tbl, color_col="Status",
                     palette={"✅ good":"#22c55e","✅ none":"#22c55e","⚠️ review":"#f59e0b",
                               "⚠️ investigate":"#f59e0b","⚠️ below target":"#f59e0b",
                               "🚨 high risk":"#ef4444","❌ below target":"#ef4444"})

        with st.expander("ℹ️ What each SOS Status Summary row means"):
            st.markdown("""
| Metric | What it measures | Status colour meaning |
|---|---|---|
| **Active SOS** | Businesses where `sos_active=true` — the entity is legally registered and in good standing with the state | ✅ Good > 95% · ❌ Below target if ≤ 95% |
| **Inactive SOS** | Businesses where `sos_active=false` — entity exists but is NOT in good standing | ⚠️ Review — any count needs investigation |
| **SOS name matched** | Businesses where `sos_match_boolean=true` — the submitted business name matched the name in the state registry | ✅ Good > 90% · ⚠️ Below target if ≤ 90% |
| **Avg Middesk confidence** | Average confidence score from Middesk (platform_id=16). Scale 0–1. Formula: 0.15 base + 0.20 per successful review task (max 4 tasks) | >0.70 = strong match · 0.40–0.70 = partial · <0.40 = weak/no match |
| **Avg OC confidence** | Average confidence score from OpenCorporates (platform_id=23). Scale 0–1. Formula: match.index ÷ 55 | >0.70 = strong · <0.30 = poor coverage |
| **Middesk gap** | Businesses where OC confidence >0.70 but Middesk confidence <0.40. OC found the entity globally but Middesk couldn't confirm in US SOS | ⚠️ Investigate — check Middesk API call logs |
| **Neither vendor matched** | Businesses where BOTH Middesk and OC returned confidence=0. Entity existence is completely unverified. | 🚨 High risk — manual underwriting required |
            """)

        # Inactive+perpetual analysis via scalar facts
        st.markdown("#### ⚠️ Inactive + Perpetual Expiration — Live Analysis")
        inactive_sql = """
            SELECT business_id,
                   JSON_EXTRACT_PATH_TEXT(value,'value')               AS is_active,
                   JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS source_pid,
                   received_at
            FROM rds_warehouse_public.facts
            WHERE name = 'sos_active'
              AND JSON_EXTRACT_PATH_TEXT(value,'value') = 'false'
            ORDER BY received_at DESC LIMIT 200
        """
        inactive_df = run_query(inactive_sql)
        if inactive_df is not None and not inactive_df.empty:
            flag(f"🚨 {len(inactive_df):,} businesses with sos_active=false. "
                 "Cross-check sos_filings on PostgreSQL RDS (port 5432) to find perpetual expiration dates.", "red")
            col_a,col_b = st.columns(2)
            with col_a:
                src_counts = inactive_df["source_pid"].apply(pid_name).value_counts().reset_index()
                src_counts.columns = ["Source","Count"]
                fig3 = px.bar(src_counts,x="Source",y="Count",color_discrete_sequence=["#ef4444"],
                              title="Inactive SOS by Source Vendor")
                st.plotly_chart(dark_chart_layout(fig3),use_container_width=True)
            with col_b:
                st.markdown("##### Sample inactive businesses:")
                styled_table(inactive_df[["business_id","is_active","source_pid","received_at"]].head(15))
                st.markdown("""
**Column meanings:**

| Column | What it is |
|---|---|
| `business_id` | The UUID of the business in the Worth AI system |
| `is_active` | The value of the `sos_active` fact — `false` means the entity is NOT in good standing with the state |
| `source_pid` | The platform ID of the vendor that provided this status. `pid=16` = Middesk · `pid=23` = OpenCorporates · `pid=-1` = no vendor (default value) |
| `received_at` | When this fact was last written — shows data freshness |

**What `source_pid=-1` means:** No vendor returned an `sos_active` status for this business.
The value is the system default (false/inactive). This may mean the vendor never matched this entity,
not that the entity is truly inactive. Always cross-check against `sos_match_boolean`.
                """)

        st.markdown("##### What the 'Inactive SOS by Source Vendor' chart shows:")
        st.markdown("""
The bar chart shows **which vendor determined the entity is inactive**. This matters because:
- **Middesk (pid=16)** inactive = US SOS live query confirmed the entity is not in good standing. Most reliable.
- **OC (pid=23)** inactive = OpenCorporates global registry shows the entity as dissolved/inactive. May lag real state status by weeks.
- **pid=-1 (no vendor)** = The system defaulted to inactive because no vendor returned any active status. This is different from a vendor *confirming* the entity is inactive — it's a data absence, not a confirmed status.

**Causal analysis:** A high count under pid=-1 indicates that entity matching is failing for these businesses.
The entity may actually be active, but because no vendor matched it, the system can't confirm active status.
Cross-reference with the "Neither matched" count — they should be similar populations.
        """)

        analyst_card("SOS Registry Analysis", [
            f"Active rate {sos_active_rate:.1f}%: {'✅ healthy' if sos_active_rate>95 else '❌ below 95% — investigate inactive entities'}.",
            f"Inactive+perpetual combination is the #1 underwriting red flag. "
            "Entity cannot legally operate despite having a perpetual charter. "
            "Causes: unpaid taxes, missed annual report, administrative dissolution.",
            f"Middesk gap ({middesk_gap:,} businesses): OC found the entity in global registries "
            "but Middesk could not match in US SOS. Causes: new incorporation, name mismatch, Middesk API failure.",
            f"Neither vendor matched ({both_no_match:,}): entity existence completely unverified. "
            "Route 100% of these to manual underwriting.",
        ])

    # ── TIN ────────────────────────────────────────────────────────────────────
    with tab_tin:
        # ── Summary KPIs with inline explanations ─────────────────────────────
        c1,c2,c3,c4,c5 = st.columns(5)
        tin_pending = int((tin["tin_match_status"]=="pending").sum())
        with c1: kpi("Total Businesses",f"{tin_total:,}","in scope","#3B82F6")
        with c2: kpi("✅ TIN Submitted",f"{tin_submitted:,}",
                     f"{tin_submitted/max(tin_total,1)*100:.1f}% submitted EIN",
                     "#22c55e" if tin_submitted/max(tin_total,1)>0.90 else "#ef4444")
        with c3: kpi("✅ Verified (IRS Match)",f"{tin_verified:,}",
                     f"{tin_verified/max(tin_submitted,1)*100:.1f}% of submitted",
                     "#22c55e" if tin_verified/max(tin_submitted,1)>0.70 else "#ef4444")
        with c4: kpi("❌ Failed",f"{tin_failed:,}",
                     f"{tin_failed/max(tin_submitted,1)*100:.1f}% of submitted",
                     "#ef4444" if tin_failed/max(tin_submitted,1)>0.20 else "#22c55e")
        with c5: kpi("⏳ Pending",f"{tin_pending:,}",
                     f"{tin_pending/max(tin_total,1)*100:.1f}%","#f59e0b")

        col_l,col_r = st.columns(2)
        with col_l:
            tin_outcomes = pd.DataFrame({
                "Outcome":["✅ Verified","❌ Failed","⏳ Pending","📭 Not submitted"],
                "Count":[tin_verified,tin_failed,tin_pending,tin_total-tin_submitted],
            })
            fig = px.bar(tin_outcomes,x="Outcome",y="Count",color="Outcome",
                         color_discrete_map={"✅ Verified":"#22c55e","❌ Failed":"#ef4444",
                                              "⏳ Pending":"#f59e0b","📭 Not submitted":"#64748b"},
                         title="TIN Verification Outcomes")
            fig.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            st.markdown(f"""
**What each bar means:**

| Outcome | Count | What it means |
|---|---|---|
| **✅ Verified** | {tin_verified:,} | IRS confirmed: this EIN matches this exact legal business name. This is the gold-standard verification. |
| **❌ Failed** | {tin_failed:,} | IRS has no record of this EIN + legal name combination. The two facts contradict each other. |
| **⏳ Pending** | {tin_pending:,} | Middesk sent the TIN check to IRS but IRS has not responded yet. Normal for same-day submissions. |
| **📭 Not submitted** | {tin_total-tin_submitted:,} | The applicant did not provide an EIN at all in the onboarding form. |

*Source: `tin_match_boolean` (boolean), `tin_match.status` (string), `tin_submitted` facts from `rds_warehouse_public.facts`.*
            """)
        with col_r:
            funnel_df = pd.DataFrame({
                "Stage":["All Businesses","TIN Submitted","TIN Verified (IRS Match)"],
                "Count":[tin_total,tin_submitted,tin_verified],
            })
            fig2 = px.funnel(funnel_df,x="Count",y="Stage",title="TIN Funnel")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
            st.markdown(f"""
**How to read the TIN Funnel:**

The funnel shows how many businesses make it through each stage of the TIN verification process.

Each step narrows the population:

**All Businesses ({tin_total:,})** → starting point, every business in scope.

**TIN Submitted ({tin_submitted:,}, {tin_submitted/max(tin_total,1)*100:.1f}%)** → businesses that provided an EIN.
The gap from the top ({tin_total-tin_submitted:,} businesses) skipped TIN entirely.
*This is a data collection gap, not a verification failure.*

**TIN Verified ({tin_verified:,}, {tin_verified/max(tin_total,1)*100:.1f}% of all, {tin_verified/max(tin_submitted,1)*100:.1f}% of submitted)** → businesses where IRS confirmed the EIN matches the legal name.

**The two important rates to track:**
- Submission rate: {tin_submitted/max(tin_total,1)*100:.1f}% (target: >90%)
- Verification rate of submitted: {tin_verified/max(tin_submitted,1)*100:.1f}% (target: >75%)
            """)

        analyst_card("TIN Verification — Analyst Interpretation", [
            f"Submission rate: {tin_submitted/max(tin_total,1)*100:.1f}% — "
            f"{'✅ above 90% target' if tin_submitted/max(tin_total,1)>0.90 else '❌ below 90% target — the EIN field may not be required in the onboarding form or applicants are skipping it'}.",
            f"Verification rate of submitted: {tin_verified/max(tin_submitted,1)*100:.1f}% — "
            f"{'✅ above 75% target' if tin_verified/max(tin_submitted,1)>0.75 else '❌ below 75% — EIN-name mismatches are high. Primary cause: applicants submitting DBA name instead of the legal name registered with the IRS'}.",
            f"Failure rate: {tin_failed/max(tin_submitted,1)*100:.1f}% of submitted TINs fail IRS matching. "
            "Failures mean the EIN exists in IRS records but is registered under a DIFFERENT business name than what was submitted. "
            "This is not a typo — it is a structural mismatch between the trading name and legal name.",
            f"Pending: {tin_pending:,} businesses ({tin_pending/max(tin_total,1)*100:.1f}%) are awaiting IRS response. "
            "Normal for same-day submissions (IRS response time: 24–48h). "
            "If pending > 72h, investigate Middesk API connectivity.",
            f"Not submitted: {tin_total-tin_submitted:,} businesses ({(tin_total-tin_submitted)/max(tin_total,1)*100:.1f}%) "
            "provided no EIN. These cannot pass TIN verification by definition. "
            "Consider making EIN a required field in the onboarding form.",
        ])

        # ── Middesk task breakdown ─────────────────────────────────────────────
        st.markdown("---")
        st.markdown("#### 🏛️ Middesk TIN Task Results")
        st.markdown(
            "Middesk runs a dedicated `'tin'` review task that directly queries the IRS. "
            "This is the authoritative source for TIN verification — more reliable than name-matching alone. "
            "When Middesk has no TIN task, Trulioo BusinessRegistrationNumber comparison is used as fallback."
        )
        task_counts = tin["middesk_tin_task"].value_counts().reset_index()
        task_counts.columns = ["Task","Count"]
        task_counts["% of Total"] = (task_counts["Count"]/tin_total*100).round(1).astype(str)+"%"
        task_counts["Meaning"] = task_counts["Task"].map({
            "success":"✅ EIN matches legal name per IRS — highest confidence",
            "failure":"❌ EIN does NOT match IRS record — review failure reasons below",
            "pending":"⏳ IRS response pending — normal for same-day (allow 24–48h)",
            "none":"⚠️ No Middesk TIN task — Trulioo fallback used instead",
            "warning":"⚠️ IRS found a record but with caveats — check sublabel",
        }).fillna("Unknown")
        styled_table(task_counts, color_col="Task",
                     palette={"success":"#22c55e","failure":"#ef4444","pending":"#f59e0b",
                               "none":"#64748b","warning":"#f97316"})

        middesk_none_count = int((tin["middesk_tin_task"]=="none").sum())
        middesk_fail_count = int((tin["middesk_tin_task"]=="failure").sum())
        if middesk_none_count > tin_total * 0.50:
            flag(f"⚠️ {middesk_none_count:,} businesses ({middesk_none_count/max(tin_total,1)*100:.1f}%) "
                 "have NO Middesk TIN task. This means Middesk was not called for these businesses, "
                 "or was called but did not run the TIN review task. "
                 "Trulioo BusinessRegistrationNumber comparison is used as fallback — "
                 "lower confidence than IRS direct query.", "amber")
        if middesk_fail_count > 0:
            flag(f"{middesk_fail_count:,} Middesk TIN task failures. "
                 "Each failure has a specific reason from Middesk (see failure guide below). "
                 "Pull the tin_match.message field for each business to see the exact IRS response.", "amber")

        analyst_card("Middesk TIN Task — What 'none' means and what to do", [
            f"'none' ({middesk_none_count:,} businesses, {middesk_none_count/max(tin_total,1)*100:.1f}%): "
            "Middesk did not run a TIN review task for these businesses. "
            "This happens when: (1) Middesk did not match the entity (low confidence), "
            "(2) The business does not have a TIN in Middesk's records, "
            "or (3) Middesk was not called at all (check platform_id=16 in request_response).",
            f"'success' ({int((tin['middesk_tin_task']=='success').sum()):,} businesses): "
            "These are the best-quality verifications. Middesk called IRS directly and got a positive match. "
            "When you see tin_match_boolean=true AND middesk_tin_task=success, this is the strongest possible TIN confirmation.",
            f"'failure' ({middesk_fail_count:,} businesses): "
            "Middesk called IRS and IRS said the EIN does NOT match this legal name. "
            "This is a definitive failure, not a 'try again' — the EIN and name are genuinely mismatched.",
            "'pending' businesses: Middesk sent the request but IRS hasn't responded. "
            "If pending > 3 days, check Middesk API status and consider re-triggering the verification.",
        ])

        # ── Inconsistency detection ─────────────────────────────────────────────
        st.markdown("---")
        st.markdown("#### ⚠️ TIN Data Integrity Check")
        inconsistent = tin[tin["tin_match_boolean"] & (tin["tin_match_status"]!="success")]
        if len(inconsistent)>0:
            flag(f"🚨 {len(inconsistent):,} businesses: tin_match_boolean=true but status≠'success'. "
                 "Data integrity error — the boolean is derived ONLY from status==='success' "
                 "(integration-service/lib/facts/kyb/index.ts L488–490). "
                 "Any divergence means the derivation logic broke.", "red")
            styled_table(inconsistent[["business_id","tin_match_status","tin_match_boolean",
                                        "middesk_tin_task"]].head(20))
        else:
            flag("✅ No TIN boolean/status inconsistencies detected. "
                 "Every business where tin_match_boolean=true also has tin_match.status='success'. "
                 "The derivation logic is working correctly.", "green")

        # ── Failure reasons table ────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("#### 📋 TIN Failure Reason Guide — What Each Middesk Message Means")
        st.markdown(
            "When `tin_match.status='failure'`, Middesk provides a specific message explaining why. "
            "Read `tin_match.message` for each failed business to understand the exact cause."
        )
        failure_guide = pd.DataFrame({
            "Middesk Message (tin_match.message)":[
                "The IRS has a record for the submitted TIN and Business Name combination",
                "The IRS does not have a record for the submitted TIN and Business Name combination",
                "We believe the submitted TIN is associated with a different Business Name",
                "Duplicate request",
                "Invalid TIN",
                "IRS unavailable",
            ],
            "Status":["success","failure","failure","failure","failure","failure"],
            "Risk":["None","HIGH","HIGH","MEDIUM","HIGH","LOW — retry"],
            "What it means":[
                "✅ EIN + legal name confirmed by IRS. Perfect result.",
                "❌ IRS has no EIN registered under this exact legal name. Wrong EIN or name doesn't match IRS records.",
                "⚠️ The EIN exists but is registered under a DIFFERENT business name. Possible fraud or EIN reuse.",
                "Re-submit needed. Middesk received a duplicate request within a short window.",
                "❌ The EIN format is invalid (wrong length, non-numeric, etc.).",
                "IRS system was temporarily unavailable. Auto-retry. Not a business data issue.",
            ],
            "Action":[
                "No action — approved",
                "Ask applicant: exact legal name on EIN certificate, confirm no recent name change",
                "🚨 HIGH RISK — check for EIN reuse or fraudulent application. Route to fraud review.",
                "Wait 24h and re-submit automatically",
                "Ask applicant to check their EIN certificate — 9-digit number, no dashes required",
                "Auto-retry in 24h — if persistent, check IRS e-verify system status",
            ],
        })
        styled_table(failure_guide, color_col="Risk",
                     palette={"HIGH":"#ef4444","MEDIUM":"#f59e0b","LOW — retry":"#3B82F6","None":"#22c55e"})

    # ── IDV ────────────────────────────────────────────────────────────────────
    with tab_idv:
        if kyc is None:
            st.info("IDV data not available (idv_status fact not found).")
        else:
            idv_total = len(kyc)
            idv_status_counts = kyc["idv_status"].value_counts().reset_index()
            idv_status_counts.columns = ["Status","Count"]
            idv_status_counts["% of Total"] = (idv_status_counts["Count"]/idv_total*100).round(1).astype(str)+"%"
            idv_status_counts["Meaning"] = idv_status_counts["Status"].map({
                "SUCCESS":"✅ Identity confirmed — government ID + selfie matched",
                "PENDING":"⏳ Session started, not completed",
                "FAILED":"❌ ID rejected — mismatch, expired, or liveness fail",
                "CANCELED":"🚫 User abandoned the IDV flow",
                "EXPIRED":"⌛ Session expired before completion",
                "UNKNOWN":"❓ Status unknown",
            }).fillna("Unknown")

            col_l,col_r = st.columns(2)
            with col_l:
                c_map = {"SUCCESS":"#22c55e","PENDING":"#f59e0b","FAILED":"#ef4444",
                          "CANCELED":"#f97316","EXPIRED":"#64748b","UNKNOWN":"#94a3b8"}
                fig = px.pie(idv_status_counts,names="Status",values="Count",
                             color="Status",color_discrete_map=c_map,hole=0.5,
                             title="IDV Status Distribution (Plaid)")
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            with col_r:
                styled_table(idv_status_counts, color_col="Status",
                             palette={k.lower():v for k,v in c_map.items()})
                st.markdown("""
**What each IDV status means — and why it happens:**

| Status | What it means | Most common cause | Action |
|---|---|---|---|
| **SUCCESS** | Owner scanned a government ID, took a selfie, and Plaid's AI confirmed they match. Identity confirmed. | Correct document used correctly | None — approved |
| **PENDING** | The IDV session link was sent but the owner hasn't completed it yet. | Owner hasn't opened the link, or started but didn't finish | Send reminder after 24h; if still pending at 72h, re-trigger IDV |
| **FAILED** | Owner completed the flow but Plaid rejected the verification | (1) Expired ID · (2) Selfie doesn't match ID photo · (3) Liveness check failed (possible deepfake) · (4) ID type not supported in the country | Ask owner to retry with a valid, unexpired government-issued ID |
| **CANCELED** | Owner opened the session but actively chose to exit | User experience friction, distrust of the process, or deliberate avoidance | Follow up by phone; high cancel rate = UX or trust issue |
| **EXPIRED** | The session link expired before the owner used it | Link validity window passed (typically 15–30 min) | Re-issue a new IDV session link |
| **UNKNOWN** | Status could not be determined | Fact not stored or IDV session record missing | Check `idv_status` fact in rds_warehouse_public.facts |

*Source: `idv_status` fact (dict of status counts) from Plaid IDV via integration-service.*
                """)

            # Match results
            st.markdown("#### Identity Match Results")
            match_cols = [("name_match","Name"),("address_match","Address"),("tin_match_ok","TIN")]
            results = []
            for col,label in match_cols:
                if col in kyc.columns:
                    vc = kyc[col].value_counts()
                    n = len(kyc)
                    results.append({"Field":label,
                                    "✅ Success":f"{vc.get('success',0):,} ({vc.get('success',0)/n*100:.0f}%)",
                                    "❌ Failure":f"{vc.get('failure',0):,} ({vc.get('failure',0)/n*100:.0f}%)",
                                    "⚫ Missing":f"{vc.get('none',0):,} ({vc.get('none',0)/n*100:.0f}%)"})
            if results:
                styled_table(pd.DataFrame(results))
                st.markdown("""
**What each match field checks:**
- **Name**: Does the business name submitted match what appears in the SOS registry? (Middesk/OC/Trulioo)
- **Address**: Does the address submitted match what's on file with the registry or Google? (Middesk/SERP)
- **TIN**: Does the EIN submitted match IRS records for this legal name? (Middesk TIN review task)

**⚫ Missing** means the fact is simply not stored — either the vendor didn't return a result or the field wasn't evaluated.
High missing rates indicate an integration gap, not a failure.
                """)

            analyst_card("IDV Causal Analysis", [
                f"Pass rate: {int(kyc['idv_passed'].sum())/max(idv_total,1)*100:.1f}%. Target >65%.",
                "Low pass rate → look at FAILED first. If FAILED is high: document type/quality issue. "
                "If PENDING+EXPIRED is high: UX issue or link delivery problem.",
                "FAILED IDV + low name match: consistent — person failed IDV because "
                "submitted name doesn't match the ID document.",
                "FAILED IDV + high vendor confidence: entity registry is confirmed but owner identity failed. "
                "Possible fraud — someone submitting on behalf of a real business.",
                "PENDING > 48h: session likely abandoned. High PENDING rate = email deliverability issue "
                "or applicants distrust the biometric step.",
                "CANCELED/EXPIRED > 15%: the IDV link UX needs improvement. Consider adding instructions "
                "and extending the session window.",
            ])

    # ── Cross-Analysis ─────────────────────────────────────────────────────────
    with tab_cross:
        st.markdown("#### 🔗 SOS × TIN × IDV Cross-Analysis")
        flag("Cross-analysis reveals combinations that are individually acceptable "
             "but suspicious together. These patterns require human review.", "blue")

        # Merge sos + tin on business_id
        merged = sos.merge(tin[["business_id","tin_match_boolean","tin_match_status"]],
                           on="business_id", how="inner")

        # Quadrant analysis
        merged["SOS Status"] = merged["active"].map({True:"Active",False:"Inactive"})
        merged["TIN Status"] = merged["tin_match_boolean"].map({True:"Verified",False:"Not Verified"})
        cross = pd.crosstab(merged["SOS Status"],merged["TIN Status"])
        fig = go.Figure(go.Heatmap(
            z=cross.values,x=cross.columns.tolist(),y=cross.index.tolist(),
            colorscale="Blues",text=cross.values,texttemplate="%{text}",
            hovertemplate="SOS: %{y}<br>TIN: %{x}<br>Count: %{z}",
        ))
        fig.update_layout(title="SOS Active × TIN Verified (Cross-tabulation)")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        # Risk quadrant interpretation
        try:
            active_verified = int(cross.loc["Active","Verified"])
            active_unverif  = int(cross.loc["Active","Not Verified"])
            inactive_verif  = int(cross.loc["Inactive","Verified"])
            inactive_unverif= int(cross.loc["Inactive","Not Verified"])
        except Exception:
            active_verified=active_unverif=inactive_verif=inactive_unverif=0

        st.markdown("""
**How to read this heatmap:** Each cell shows the number of businesses in that combination.
The X-axis is TIN status (Verified / Not Verified) and Y-axis is SOS status (Active / Inactive).
Darker = more businesses in that cell.
        """)

        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("✅ Active + TIN Verified",f"{active_verified:,}","Cleanest profile","#22c55e")
        with c2: kpi("⚠️ Active + TIN Unverified",f"{active_unverif:,}","Registry OK, TIN gap","#f59e0b")
        with c3: kpi("⚠️ Inactive + TIN Verified",f"{inactive_verif:,}","Inactive entity risk","#f97316")
        with c4: kpi("🚨 Inactive + TIN Unverified",f"{inactive_unverif:,}","Highest risk combination","#ef4444")

        st.markdown("""
**Risk Quadrant Guide:**

| Combination | Risk | What it means | Recommended action |
|---|---|---|---|
| ✅ **Active + TIN Verified** | Low | Entity is registered and active; EIN matches IRS records. Clean profile. | Standard approval flow |
| ⚠️ **Active + TIN Unverified** | Medium | Registry confirms entity exists and is active, but EIN doesn't match. | Ask applicant to re-submit with correct EIN or legal name. Common: DBA submitted instead of legal name |
| ⚠️ **Inactive + TIN Verified** | Medium-High | EIN is valid but entity cannot legally operate. | Require reinstatement documentation. Check if state shows a grace period. |
| 🚨 **Inactive + TIN Unverified** | Critical | Entity cannot operate AND EIN is wrong. Both identity pillars fail. | **Do not approve.** Route to manual underwriting. This combination represents the highest risk. |
        """)

        cross_box("SOS × TIN Cross-Analysis Insights", [
            f"Inactive + TIN Unverified ({inactive_unverif:,}): entity cannot legally operate AND has no IRS match. "
            "Strongest combined risk signal in the KYB dataset. Hard stop recommended.",
            f"Active + TIN Unverified ({active_unverif:,}): registry OK but EIN issue. "
            "Common causes: DBA name mismatch, SSN submitted instead of EIN, or recently changed name.",
            f"Inactive + TIN Verified ({inactive_verif:,}): EIN matches but entity is inactive. "
            "Verify if inactive = grace period (not yet dissolved) or = administratively dissolved.",
        ])

        # Vendor confidence vs TIN outcome
        merged["Avg Vendor Conf"] = (merged["middesk_conf"]+merged["oc_conf"])/2
        fig2 = px.box(merged,x="TIN Status",y="Avg Vendor Conf",color="TIN Status",
                      color_discrete_map={"Verified":"#22c55e","Not Verified":"#ef4444"},
                      title="Vendor Confidence vs TIN Verification Outcome")
        fig2.add_hline(y=0.50,line_dash="dash",line_color="#f59e0b",annotation_text="Threshold 0.50")
        st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

        analyst_card("Cross-Analysis Insight", [
            "Businesses with low vendor confidence AND failed TIN are the strongest combined risk signal.",
            "High vendor confidence + failed TIN: entity exists (registry confirmed) but EIN is wrong. "
            "Most likely cause: business submitted incorrect EIN. Low fraud risk, high data quality issue.",
            "Low vendor confidence + passed TIN: EIN matches but no registry confirmation. "
            "Could be very new incorporation not yet in bulk data. Wait 4-6 weeks and re-check.",
        ])

    # ── Vendors ────────────────────────────────────────────────────────────────
    with tab_vendors:
        st.markdown("#### 📡 Vendor Match Rate Tracking")
        flag("Track match rates weekly. Sudden drops signal data freshness issues "
             "or entity-matching model degradation.", "blue")

        VENDORS = {
            "Middesk":("middesk_conf","#f59e0b",0.50,"pid=16,w=2.0","US SOS live query"),
            "OC":     ("oc_conf",     "#3B82F6",0.50,"pid=23,w=0.9","Global registry DB"),
            "ZoomInfo":("zi_conf",    "#8B5CF6",0.50,"pid=24,w=0.8","Redshift bulk data"),
            "Equifax": ("efx_conf",   "#22c55e",0.50,"pid=17,w=0.7","Redshift bulk data"),
            "Trulioo": ("trulioo_conf","#ec4899",0.40,"pid=38,w=0.8","International/PSC"),
        }
        stats = []
        for name,(col,color,thr,pid,src) in VENDORS.items():
            if col in sos.columns:
                v = sos[col]
                mr = (v>thr).mean()*100
                stats.append({"Vendor":name,"PID/Weight":pid,"Source":src,
                               "Match Rate %":f"{mr:.1f}%","Avg Conf":f"{v.mean():.3f}",
                               "Zero (no match) %":f"{(v==0).mean()*100:.1f}%",
                               "P75 Conf":f"{v.quantile(0.75):.3f}",
                               "Status":"✅ OK" if mr>60 else ("⚠️ Watch" if mr>40 else "❌ Low")})
        if stats:
            sdf = pd.DataFrame(stats)
            styled_table(sdf,color_col="Status",
                         palette={"✅ ok":"#22c55e","⚠️ watch":"#f59e0b","❌ low":"#ef4444"})

            st.markdown("""
**How to read the vendor table:**

| Column | What it means |
|---|---|
| **Match Rate %** | % of businesses where this vendor's confidence exceeded the threshold (0.50 for most, 0.40 for Trulioo). A "match" means the vendor found and confirmed this entity. |
| **Avg Conf** | Average confidence score across ALL businesses (0–1 scale). Includes businesses with zero confidence (no match). |
| **Zero (no match) %** | % of businesses where the vendor returned confidence=0 — meaning the vendor could not find this entity at all. |
| **P75 Conf** | 75th percentile confidence score. Half the "matched" businesses have confidence above this value. |
| **Status** | ✅ OK = match rate > 60% · ⚠️ Watch = 40–60% · ❌ Low = < 40% |

**Why each vendor has a different threshold:**
- Middesk, OC, ZI, EFX: threshold 0.50 because their confidence formula is linear (match.index / 55)
- Trulioo: threshold 0.40 because Trulioo uses status-based confidence (success=0.70, pending=0.40) — a lower threshold captures "in progress" matches

**Causal analysis for low match rates:**
- 📉 **ZoomInfo or Equifax drops suddenly** → check when the Redshift bulk data was last refreshed. These use pre-loaded snapshots, not live queries.
- 📉 **Middesk drops** → check API key expiry, rate limits, or network connectivity in integration-service logs.
- 📉 **OC drops** → OpenCorporates may have changed their API schema or rate limits.
- 📉 **All vendors drop together** → entity-matching model (XGBoost) may have degraded. Check model version.
            """)

            col_l,col_r = st.columns(2)
            with col_l:
                mr_df = pd.DataFrame([{"Vendor":r["Vendor"],
                                        "Match Rate":float(r["Match Rate %"].rstrip("%"))}
                                       for r in stats])
                fig = px.bar(mr_df,x="Vendor",y="Match Rate",color="Vendor",
                             color_discrete_sequence=["#f59e0b","#3B82F6","#8B5CF6","#22c55e","#ec4899"],
                             title="Vendor Match Rates")
                fig.add_hline(y=60,line_dash="dash",line_color="#f59e0b",annotation_text="60% watch")
                fig.update_layout(showlegend=False,yaxis=dict(range=[0,100]))
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            with col_r:
                fig2 = go.Figure()
                for name,(col,color,_,_,_) in VENDORS.items():
                    if col in sos.columns:
                        fig2.add_trace(go.Box(y=sos[col],name=name,marker_color=color,
                                              fillcolor="rgba(0,0,0,0)"))
                st.plotly_chart(dark_chart_layout(fig2,"Vendor Confidence Distribution"),
                                use_container_width=True)
                st.markdown("""
**Reading the box plots:** Each box shows the spread of confidence scores for that vendor across all businesses.
- **Box bottom**: 25th percentile (Q1)
- **Box middle line**: Median (50th percentile)
- **Box top**: 75th percentile (Q3)
- **Whiskers**: Range excluding outliers
- **Dots**: Outlier businesses with unusually high or low confidence

A wide box = high variability (some matches very confident, some marginal).
A narrow box near 0 = vendor mostly returns no match.
A bimodal pattern (spikes at 0 and 1) = vendor is binary — it either matches confidently or not at all.
                """)

    # ── Data Quality Checks ────────────────────────────────────────────────────
    with tab_dq:
        st.markdown("#### 🔬 Registry & Identity Data Quality Checks")
        st.markdown("*Systematic, automated checks replacing manual QA processes.*")

        checks = [
            ("SOS Active rate > 95%",
             sos_active_rate>95, f"{sos_active_rate:.1f}%",
             "Check for administratively dissolved entities still applying."),
            ("SOS Name match rate > 90%",
             (sos_matched_rate or 0)>90,
             f"{sos_matched_rate:.1f}%" if sos_matched_rate else "N/A",
             "Low rate = name normalisation failures between submitted name and registry."),
            ("No multi-domain SOS coverage gaps (Middesk+OC)",
             middesk_gap < biz*0.05,
             f"{middesk_gap:,} ({middesk_gap/max(biz,1)*100:.1f}%)",
             "OC matches but Middesk doesn't: check platform_id=16 in request_response."),
            ("TIN submission > 90%",
             tin_submitted/max(tin_total,1)>0.90,
             f"{tin_submitted/max(tin_total,1)*100:.1f}%",
             "Low submission rate: TIN field may not be required or form is skipped."),
            ("TIN success > 70% of submitted",
             tin_verified/max(tin_submitted,1)>0.70,
             f"{tin_verified/max(tin_submitted,1)*100:.1f}%",
             "Low success: EIN-name mismatch. Check for DBA vs legal name confusion."),
            ("TIN failure < 20% of submitted",
             tin_failed/max(tin_submitted,1)<0.20,
             f"{tin_failed/max(tin_submitted,1)*100:.1f}%",
             "High failure: wrong EIN format, recent name change, or fraud signal."),
            ("No TIN boolean/status inconsistency",
             len(tin[tin["tin_match_boolean"]&(tin["tin_match_status"]!="success")])==0,
             f"{len(tin[tin['tin_match_boolean']&(tin['tin_match_status']!='success')]):,}",
             "Any count > 0 is a data integrity bug in kyb/index.ts L488–490."),
            ("No entity with zero vendor confirmation",
             both_no_match==0,
             f"{both_no_match:,}",
             "Middesk=0 AND OC=0 = completely unconfirmed. Route to manual underwriting."),
        ]
        # Detailed FAIL explanations keyed to each check
        FAIL_REASONS = {
            "SOS Active rate > 95%": {
                "why": f"Your SOS Active rate is {sos_active_rate:.1f}%. "
                       "This means {:.0f}% of businesses in the system have an INACTIVE SOS status — "
                       "they exist in the registry but are NOT in good standing with their state.".format(100-sos_active_rate),
                "causes": [
                    "Administrative dissolution: state automatically dissolves entities that miss annual report filings",
                    "Unpaid franchise tax: state suspends the entity until taxes are paid",
                    "Voluntary dissolution: owners closed the business but didn't remove it from the system",
                    "Data freshness: the SOS fact may reflect an old state, and the entity has since reinstated",
                ],
                "action": "Pull inactive businesses via the SOS Registry tab. For each, check sos_filings on "
                          "PostgreSQL RDS (port 5432) to see the actual state filing status and expiration date.",
            },
            "SOS Name match rate > 90%": {
                "why": f"Only {sos_matched_rate:.1f}% of businesses have sos_match_boolean=true. "
                       "This means the submitted business name did not match the state registry record for the rest.",
                "causes": [
                    "DBA (trade name) submitted instead of legal name: 'Joe's Pizza' vs 'Joseph Smith LLC'",
                    "Punctuation/spacing differences: 'Smith & Jones' vs 'Smith and Jones'",
                    "Abbreviation differences: 'Corp.' vs 'Corporation'",
                    "Name recently changed and not yet updated in vendor databases",
                    "Middesk matched the wrong entity (name collision with similar business)",
                ],
                "action": "Review businesses where sos_match=false but sos_active=true — these need manual "
                          "name reconciliation. Check the submitted name vs the registry legal name.",
            },
            "No multi-domain SOS coverage gaps (Middesk+OC)": {
                "why": f"{middesk_gap:,} businesses ({middesk_gap/max(biz,1)*100:.1f}%) have OpenCorporates "
                       "confidence >0.70 but Middesk confidence <0.40. OC found the entity globally but "
                       "Middesk could not confirm in US SOS systems.",
                "causes": [
                    "Brand new incorporation: OC pulls from public filings which update faster than Middesk's SOS database",
                    "Name mismatch: Middesk matches on exact legal name; slight differences cause misses",
                    "Middesk API failure: the API call failed silently; check integration_data.request_response",
                    "Middesk database lag: some states' SOS data updates slowly in Middesk's system",
                ],
                "action": "Run: SELECT * FROM integration_data.request_response WHERE business_id='UUID' "
                          "AND platform_id=16 — check if Middesk was called and what it returned.",
            },
            "TIN submission > 90%": {
                "why": f"Only {tin_submitted/max(tin_total,1)*100:.1f}% of businesses submitted a TIN (EIN). "
                       f"{tin_total-tin_submitted:,} businesses did not provide an EIN.",
                "causes": [
                    "EIN field not marked required in the onboarding form",
                    "Sole proprietors using SSN (not EIN) — they may not have an EIN at all",
                    "International businesses without a US EIN",
                    "Applicants skipping the step — no enforcement in the form flow",
                ],
                "action": "Work with product to make EIN required before form submission can complete. "
                          "For sole props, allow SSN as alternative with a different verification path.",
            },
            "TIN success > 70% of submitted": {
                "why": f"Of the TINs submitted, only {tin_verified/max(tin_submitted,1)*100:.1f}% match IRS records. "
                       f"{tin_submitted-tin_verified:,} submitted TINs failed or are pending.",
                "causes": [
                    "DBA name submitted: EIN is registered under legal name 'Smith LLC' but applicant submitted 'Joe's Diner'",
                    "Recent name change: EIN not yet updated with IRS to reflect new legal name",
                    "Typo in EIN: transposed digits or missing leading zero",
                    "Sole prop SSN submitted as EIN: different format, IRS can't match",
                    "EIN from a different entity: reused or misremembered EIN",
                ],
                "action": "Pull businesses where tin_match.status='failure' and read tin_match.message — "
                          "Middesk provides specific failure reasons for each.",
            },
            "TIN failure < 20% of submitted": {
                "why": "This check PASSES — TIN failure rate is within acceptable range.",
                "causes": [],
                "action": "No action needed.",
            },
            "No TIN boolean/status inconsistency": {
                "why": "This check PASSES — no inconsistencies found.",
                "causes": [],
                "action": "No action needed.",
            },
            "No entity with zero vendor confirmation": {
                "why": f"{both_no_match:,} businesses have ZERO confirmation from any vendor. "
                       "Both Middesk (US SOS live) and OpenCorporates (global registry) returned confidence=0.",
                "causes": [
                    "Very new incorporation (<1 week): not yet in any vendor database",
                    "Micro-business: sole prop or home-based business with no formal registry presence",
                    "Entity name too generic: 'ABC LLC' matches hundreds of records, none confidently",
                    "Address format mismatch: submitted address differs from registered address",
                    "International entity with no US presence",
                    "Fraudulent submission: fake entity that doesn't exist",
                ],
                "action": "NEVER auto-approve these. Route to manual underwriting. "
                          "Request: state registration certificate, government-issued ID, business documentation.",
            },
        }

        rows = []
        for label,ok,val,action in checks:
            rows.append({"Check":label,"Result":val,"Status":"✅ PASS" if ok else "❌ FAIL","Action":action})

        styled_table(pd.DataFrame(rows),color_col="Status",
                     palette={"✅ pass":"#22c55e","❌ fail":"#ef4444"})

        pass_n = sum(1 for _,ok,_,_ in checks if ok)
        flag(f"{pass_n}/{len(checks)} identity & registry checks passing. "
             f"{'✅ All clear' if pass_n==len(checks) else f'❌ {len(checks)-pass_n} checks failed — see details below.'}",
             "green" if pass_n==len(checks) else "red")

        # Per-FAIL detailed explanations
        failed_checks = [(label,ok,val,action) for label,ok,val,action in checks if not ok]
        if failed_checks:
            st.markdown("#### 🔍 Why Each Check Failed — Root Cause Analysis")
            for label,_,val,_ in failed_checks:
                detail = FAIL_REASONS.get(label)
                if not detail:
                    continue
                color = "#ef4444"
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                    border-radius:8px;padding:14px 18px;margin:10px 0">
                  <div style="color:{color};font-weight:700;font-size:.88rem">
                    ❌ FAIL — {label} (Result: {val})</div>
                  <div style="color:#CBD5E1;font-size:.81rem;margin-top:8px">{detail['why']}</div>
                  {'<div style="color:#94A3B8;font-size:.78rem;margin-top:8px"><strong>Most likely causes:</strong><ul>' + ''.join(f'<li>{c}</li>' for c in detail['causes']) + '</ul></div>' if detail['causes'] else ''}
                  <div style="color:#60A5FA;font-size:.77rem;margin-top:6px">
                    <strong>Action:</strong> {detail['action']}</div>
                </div>""", unsafe_allow_html=True)

        analyst_card("Quality Checks — What They Mean and Why They Matter", [
            "Each check is a threshold derived from industry benchmarks for a healthy SMB KYB pipeline. "
            "FAIL does not mean an error — it means the metric is outside the expected range and needs investigation.",
            "SOS Active < 95%: a healthy portfolio should have almost all entities in good standing. "
            "Rates below 95% suggest administrative issues at the state level or a customer segment "
            "with high compliance problems.",
            "TIN success < 70%: the IRS EIN match rate depends on applicants submitting their exact legal name. "
            "Even a punctuation difference ('LLC' vs 'L.L.C.') can cause a mismatch. "
            "Work with the product team to standardize name collection.",
            "TIN boolean/status inconsistency > 0: this is always a code bug. "
            "The `tin_match_boolean` fact is derived strictly from `tin_match.status === 'success'`. "
            "Any divergence means the derivation logic changed or broke.",
            "Zero vendor confirmation > 0: these businesses should never auto-approve. "
            "Consider adding an automatic hold/review flag when both Middesk and OC return confidence=0.",
            "Middesk gap > 5%: 5% is the expected threshold for new incorporations with OC lag. "
            "Above 5% suggests a systemic Middesk connectivity or name-matching issue.",
        ])


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — CLASSIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🏭 Classification":
    sh("NAICS / MCC Classification",
       "naics_code · mcc_code · 561499 fallback · vendor source breakdown · "
       "entity-type cross-analysis · data quality checks", "🏭")

    naics = get_section_data("naics", record_limit)

    total = len(naics); fallbacks = int(naics["is_fallback"].sum()); real = total-fallbacks
    top_src = naics.groupby("naics_source").size().idxmax() if "naics_source" in naics.columns else "unknown"
    ai_wins = int((naics["naics_source"]=="ai").sum()) if "naics_source" in naics.columns else 0

    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Total",f"{total:,}","","#3B82F6")
    with c2: kpi("Real NAICS",f"{real:,}",f"{real/total*100:.1f}%","#22c55e")
    with c3: kpi("Fallback 561499",f"{fallbacks:,}",f"{fallbacks/total*100:.1f}%",
                 "#ef4444" if fallbacks/total>0.10 else "#f59e0b")
    with c4: kpi("AI Wins",f"{ai_wins:,}",f"{ai_wins/total*100:.1f}% (last resort)","#f97316")
    with c5: kpi("Top Source",top_src,"winning vendor","#8B5CF6")

    if fallbacks/total>0.10:
        flag(f"{fallbacks/total*100:.1f}% NAICS fallback rate > 10%. "
             "Root cause: entity matching failed → AI fires with name+address only → 561499.", "red")

    tab_dist, tab_src, tab_fb, tab_consist, tab_dq = st.tabs([
        "📊 Code Distribution","📡 Source Analysis",
        "⚠️ 561499 Root Cause & Cross-Analysis",
        "🔍 Consistency Checks","🔬 Quality"
    ])

    with tab_dist:
        col_l,col_r = st.columns(2)
        with col_l:
            nc = naics.groupby(["naics_code","naics_label"]).size().reset_index(name="Count")
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
            fig2 = px.histogram(naics[~naics["is_fallback"]],x="naics_confidence",nbins=25,
                                color_discrete_sequence=["#3B82F6"],
                                title="NAICS Confidence (excl. fallbacks)")
            fig2.add_vline(x=0.50,line_dash="dash",line_color="#f59e0b",annotation_text="Min 0.50")
            fig2.add_vline(x=0.70,line_dash="dash",line_color="#22c55e",annotation_text="Good 0.70")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
            st.markdown("""
**What is `naics_confidence`?**

This is the **Fact Engine's winning vendor confidence score** — it is the confidence value
of the single vendor that WON the NAICS fact selection for each business.

**It is NOT an average across all sources.** Each business has exactly one winning vendor,
and this chart shows how confident THAT vendor was.

**How each vendor calculates confidence:**

| Source | Confidence formula | Typical range |
|---|---|---|
| Middesk (pid=16) | 0.15 base + 0.20 × number of successful review tasks (max 4) | 0.15–0.95 |
| OC / ZI / EFX (pid=23/24/17) | `match.index ÷ 55` where 55 = MAX_CONFIDENCE_INDEX | 0.0–1.0 |
| Trulioo (pid=38) | Status-based: success=0.70, pending=0.40, failed=0.20 | Fixed values |
| AI (pid=31) | Self-reported: HIGH≈0.70, MED≈0.50, LOW≈0.20 | Variable |

**How to read this histogram:**
- **Spike at 0.0–0.2**: AI-sourced codes with very low confidence. AI reports LOW confidence when it had no website, no vendor match, and the name alone was ambiguous.
- **Bars at 0.3–0.5**: Trulioo status-based or partial Middesk matches.
- **Spike near 1.0**: ZoomInfo or OC matches where `match.index = 54` or `55` (max). These are the most reliable classifications.
- **Businesses excluded** from this chart: NAICS 561499 fallbacks (their confidence is already meaningless since the code is wrong).

**Target:** the spike near 1.0 should be the tallest bar. A large bar at 0.0–0.2 means many AI-sourced codes with low reliability.
            """)

        st.markdown("#### 📋 Full Code Distribution (15 per page)")
        nc_full = naics.groupby(["naics_code","naics_label","is_fallback"]).agg(
            count=("business_id","count"),
            avg_conf=("naics_confidence","mean")).reset_index()
        nc_full["% of Total"] = (nc_full["count"]/total*100).round(1).astype(str)+"%"
        nc_full["Avg Conf"] = nc_full["avg_conf"].round(3)
        nc_full["⚠️"] = nc_full["is_fallback"].map({True:"🚨 Fallback",False:"✅"})
        nc_display = nc_full[["naics_code","naics_label","count","% of Total","Avg Conf","⚠️"]].sort_values("count",ascending=False).reset_index(drop=True)

        # Pagination
        PAGE_SIZE = 15
        n_pages = max(1, math.ceil(len(nc_display)/PAGE_SIZE))
        if n_pages > 1:
            col_pg1, col_pg2 = st.columns([3,1])
            with col_pg2:
                page_num = st.number_input("Page", min_value=1, max_value=n_pages, value=1, step=1,
                                           key="naics_dist_page")
            with col_pg1:
                st.caption(f"Showing page {page_num} of {n_pages} ({len(nc_display)} NAICS codes total)")
        else:
            page_num = 1
        start = (page_num-1)*PAGE_SIZE
        styled_table(nc_display.iloc[start:start+PAGE_SIZE],
                     color_col="⚠️",palette={"🚨 fallback":"#ef4444","✅":"#22c55e"})

    with tab_src:
        if "naics_source" in naics.columns:
            src = naics.groupby("naics_source").agg(
                count=("business_id","count"),
                fallback_pct=("is_fallback","mean"),
                avg_conf=("naics_confidence","mean")).reset_index()
            src["Fallback %"] = (src["fallback_pct"]*100).round(1)
            src["Avg Conf"] = src["avg_conf"].round(3)
            src["% of Total"] = (src["count"]/total*100).round(1).astype(str)+"%"

            col_l,col_r = st.columns(2)
            with col_l:
                fig = px.bar(src,x="naics_source",y="count",color="Fallback %",
                             color_continuous_scale="RdYlGn_r",
                             title="Source Frequency (color=fallback%)")
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
                st.markdown("""
**How to read this bar chart:**

Each bar = one NAICS source that WON the Fact Engine selection for those businesses.
The bar **height** = how many businesses that source won.
The bar **color** = what % of that source's wins ended up as 561499 fallback:
- 🟢 Green = low fallback % (source is reliable — when it wins, it assigns real codes)
- 🔴 Red = high fallback % (source often wins but still returns 561499)

**What the sources mean:**

| Source | pid | Weight | What it is |
|---|---|---|---|
| `ai` | 31 | 0.1 | GPT AI enrichment — last resort when all vendors fail |
| `equifax` | 17 | 0.7 | Equifax firmographic bulk data (Redshift) |
| `opencorporates` | 23 | 0.9 | Global corporate registry database |
| `serp` | 22 | 0.3 | Google/SERP web scraping of business website |
| `zoominfo` | 24 | 0.8 | ZoomInfo firmographic bulk data (Redshift) |
| `other` | varies | varies | Trulioo, Middesk, businessDetails, or unknown |

**Key insight:** If `ai` is tallest with a red color → entity matching is failing broadly.
                """)
            with col_r:
                fig2 = px.scatter(src,x="count",y="Avg Conf",size="count",
                                  text="naics_source",color="Fallback %",
                                  color_continuous_scale="RdYlGn_r",
                                  title="Source Volume vs Avg Confidence")
                st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
                st.markdown("""
**How to read this scatter plot:**

- **X-axis (count)**: how many businesses this source won
- **Y-axis (Avg Conf)**: average confidence score when this source won
- **Bubble size**: also represents count (larger = more wins)
- **Color**: fallback % (green=low, red=high)

**The ideal source** sits in the **top-right corner** (high volume + high confidence).

**What you want to see:**
- `zoominfo` and `opencorporates` top-right: reliable, high-confidence
- `equifax` mid-right: reliable but lower volume
- `ai` bottom-left: low confidence, high fallback — AI is a last resort, not a good classifier

**What "Avg Conf = 0.145" for AI means:**
AI reports its own confidence. When AI returns 561499 (fallback), it often reports
LOW confidence (~0.20). When AI returns a real code from a website, confidence is ~0.70.
The 0.145 average means most AI wins are low-confidence fallbacks.
                """)

            st.markdown("#### 📋 Source Performance Table")
            styled_table(src[["naics_source","count","% of Total","Avg Conf","Fallback %"]])
            st.markdown("""
**Column meanings:**

| Column | What it means |
|---|---|
| `naics_source` | The vendor/source that WON the NAICS fact for those businesses |
| `count` | Number of businesses where this source won the Fact Engine selection |
| `% of Total` | Share of all businesses |
| `Avg Conf` | Average confidence score of this source across all its wins (0–1) |
| `Fallback %` | % of this source's wins that resulted in NAICS 561499 (fallback) |

**The Fact Engine winner selection rule:** The source with the highest confidence wins,
provided the confidence gap to the next source is > 5% (WEIGHT_THRESHOLD=0.05).
If within 5%, the source with the higher platform weight wins. No minimum confidence cutoff.
            """)

            if ai_wins/total > 0.10:
                flag(f"AI is the winning source for {ai_wins:,} businesses ({ai_wins/total*100:.0f}%). "
                     "AI weight=0.1 — only wins when all other vendors have no NAICS. "
                     "High AI win rate = vendor entity matching is broadly failing.", "amber")

            analyst_card("Source Analysis — Causal Interpretation", [
                f"'{top_src}' is the most common winning source ({src[src['naics_source']==top_src]['count'].sum() if top_src in src['naics_source'].values else 0:,} businesses). "
                f"This tells you which vendor has the widest coverage for your applicant base.",
                f"AI winning {ai_wins:,} businesses ({ai_wins/total*100:.1f}%): "
                "this is the Fact Engine's last resort — AI only wins when ZI, EFX, OC, SERP, Middesk, and Trulioo all failed to return a NAICS code. "
                "A high AI win rate is the most actionable signal of entity-matching failure.",
                f"'other' source winning {src[src['naics_source']=='other']['count'].sum() if 'other' in src['naics_source'].values else 0:,} businesses: "
                "this includes Trulioo, Middesk, businessDetails (applicant-submitted), and unknown sources. "
                "High 'other' count with low fallback % = Trulioo/Middesk are working well for some segment.",
                "Fallback % per source: a source with 0% fallback (like SERP=0.0%) means when SERP wins, "
                "it always assigns a real NAICS code — it never falls back to 561499. "
                "This is the ideal behavior. AI at 34.8% fallback means AI assigns 561499 for 1 in 3 businesses it wins.",
            ])

    with tab_fb:
        st.markdown("#### 🚨 561499 Root-Cause Analysis")
        st.markdown(
            f"**{fallbacks:,} businesses** ({fallbacks/max(total,1)*100:.1f}%) received NAICS 561499 "
            f"(All Other Business Support Services). This section explains the 6 root-cause gaps "
            "identified through diagnostic analysis of production data."
        )

        # Per-gap expanded explanations
        GAP_DETAIL = {
            "G1": {
                "why": f"This affects ~99% of fallback businesses (~{int(fallbacks*0.99):,}). "
                       "The entity-matching model (XGBoost, `entity_matching_20250127 v1`) could not find "
                       "a matching record in any of the three vendor databases: ZoomInfo, Equifax, or OpenCorporates.",
                "causes": [
                    "Business is too new (<2 weeks): vendor bulk data hasn't captured it yet",
                    "Micro-business: sole proprietors with no commercial database presence",
                    "Name too generic or too unique: 'ABC LLC' (too common) or unusual names (too rare)",
                    "Address mismatch: submitted address differs from the registered address",
                    "International entity with no US bulk data footprint",
                ],
                "impact": "Without a vendor match, the AI enrichment fires as a last resort. "
                          "With only name+address, it often cannot classify and returns 561499.",
                "fix": "Improve entity-matching model coverage; for micro-businesses, use name-keyword classification (see G3).",
            },
            "G2": {
                "why": f"Estimated ~{int(fallbacks*0.20):,} businesses (20% of fallbacks). "
                       "These businesses have a website URL stored in the system, but the AI enrichment "
                       "function (aiNaicsEnrichment.ts) did NOT use it for web_search.",
                "causes": [
                    "params.website was null/empty when passed to the AI function",
                    "Website URL was found by SERP but not stored before AI enrichment ran",
                    "Pipeline order issue: AI enrichment ran before SERP stored the website fact",
                ],
                "impact": f"~{int(fallbacks*0.20):,} businesses that COULD have been classified from their website got 561499 instead.",
                "fix": "In aiNaicsEnrichment.ts getPrompt(): ensure params.website is populated before the function runs. "
                       "The website URL is available from the website fact — pass it explicitly.",
            },
            "G3": {
                "why": f"Estimated ~{int(fallbacks*0.30):,} businesses (30% of fallbacks). "
                       "The AI prompt instructs: 'If there is no evidence, return naics_code 561499'. "
                       "It does NOT instruct the AI to check business name keywords before giving up.",
                "causes": [
                    "'Lisa's Nail Salon' → should be 812113 (Nail Salons) but gets 561499",
                    "'Smith Dental Associates' → should be 621210 (Dentist Offices) but gets 561499",
                    "'ABC Plumbing LLC' → should be 238220 (Plumbing) but gets 561499",
                    "Any business with a descriptive name that indicates the industry clearly",
                ],
                "impact": "The most fixable category. No infrastructure change needed — just a prompt update.",
                "fix": "Add keyword classification to the AI prompt: check 80+ industry keywords in the business name "
                       "before defaulting to 561499. Already mapped in consensus.py detect_name_keywords().",
            },
            "G4": {
                "why": f"Affects all {fallbacks:,} fallback businesses. "
                       "When AI returns 561499, the `ai_naics_enrichment_metadata` fact is never written. "
                       "This means: what website did AI find? what was its confidence? why did it give up? — all lost.",
                "causes": [
                    "The metadata fact is only written when AI returns a non-fallback NAICS code",
                    "The pipeline assumes 561499 = 'nothing to record'",
                    "No quality monitoring is possible for fallback cases",
                ],
                "impact": "Cannot measure AI quality for the cases that matter most. "
                          "Cannot distinguish 'AI tried but couldn't classify' from 'AI was never called'.",
                "fix": "Always write ai_naics_enrichment_metadata fact, even for 561499. "
                       "Include: ai_confidence, ai_website_summary, ai_reasoning, ai_website_url.",
            },
            "G5": {
                "why": f"Affects all {fallbacks:,} fallback businesses. "
                       "When AI returns MCC 5614 (the fallback), it also writes mcc_description = "
                       "'Fallback MCC per instructions (no industry evidence to determine canonical MCC description)'. "
                       "This internal debug text is visible to customers in the Admin Portal KYB tab.",
                "causes": [
                    "The AI system prompt was written for internal debugging, not for customer-facing display",
                    "No sanitization layer between AI output and customer-visible fact storage",
                ],
                "impact": "Customers see internal system messages. Reduces trust and appears unprofessional.",
                "fix": "Update the AI system prompt: replace fallback description with "
                       "'Industry classification pending — our team is reviewing this business.'",
            },
            "G6": {
                "why": f"Affects all {fallbacks:,} businesses in Pipeline B (datascience.customer_files). "
                       "Pipeline B uses winner-takes-all: WHEN zi_match_confidence > efx_match_confidence THEN ZI ELSE EFX. "
                       "For these businesses, BOTH zi_match_confidence=0 AND efx_match_confidence=0.",
                "causes": [
                    "Same root cause as G1: entity matching failed for ZoomInfo and Equifax",
                    "Pipeline B ignores OC, Middesk, Trulioo, AI — only ZI vs EFX",
                ],
                "impact": "primary_naics_code=NULL in datascience.customer_files for all fallback businesses. "
                          "Analytics, risk models, and reports that use Pipeline B have no NAICS for these businesses.",
                "fix": "Pipeline B fix: add OC as a fallback when both ZI and EFX are confidence=0.",
            },
        }

        gaps = [
            ("G1","Entity matching fails (ZI/EFX/OC all null)",f"{int(fallbacks*0.99):,}","Both A & B","#ef4444"),
            ("G2","AI web search not used (no website URL)",f"~{int(fallbacks*0.20):,} est.","Pipeline A","#f59e0b"),
            ("G3","No name keyword classification in AI prompt",f"~{int(fallbacks*0.30):,} est.","Pipeline A","#f59e0b"),
            ("G4","AI metadata not stored for fallbacks",f"{fallbacks:,}","Pipeline A","#ef4444"),
            ("G5","Fallback MCC description shown to customers",f"{fallbacks:,}","Pipeline A","#f97316"),
            ("G6","Pipeline B also null for same businesses",f"{fallbacks:,}","Pipeline B","#ef4444"),
        ]
        for gid,title,affected,pipeline,color in gaps:
            detail = GAP_DETAIL.get(gid, {})
            with st.expander(f"{'🔴' if color=='#ef4444' else '🟡'} Gap {gid}: {title} — {affected} · {pipeline}", expanded=(gid=="G1")):
                if detail:
                    st.markdown(f"**Why this happens:** {detail['why']}")
                    if detail.get("causes"):
                        st.markdown("**Specific causes:**")
                        for c in detail["causes"]:
                            st.markdown(f"  - {c}")
                    st.markdown(f"**Business impact:** {detail['impact']}")
                    st.markdown(f"**Recommended fix:** {detail['fix']}")

        analyst_card("561499 Root-Cause — Summary for Leadership", [
            f"Total fallback businesses: {fallbacks:,} ({fallbacks/max(total,1)*100:.1f}%). "
            "Root cause 99% of the time: the entity-matching model could not find this business in any vendor database.",
            "G1 is the primary driver. G2 and G3 are the most actionable — they can be fixed without infrastructure changes.",
            "G2 (website not used): ~20% of fallbacks could be classified if the AI used the available website URL.",
            "G3 (name keywords): ~30% of fallbacks could be classified from the business name alone. "
            "A single prompt change in aiNaicsEnrichment.ts would recover these.",
            "G4 and G5 are quality-of-life fixes — they don't reduce fallback count but "
            "improve monitoring capability (G4) and customer experience (G5).",
            "G6 affects Pipeline B analytics only — customer-facing data (Pipeline A) already handles this via AI fallback.",
        ])

        rec_df = pd.DataFrame({
            "Category":["G3: Name keywords","G2: Web search","G6: Pipeline B",
                         "G4: Metadata fix","G5: Description","Genuinely unclassifiable"],
            "Est. Recoverable":[int(fallbacks*0.30),int(fallbacks*0.20),0,0,0,int(fallbacks*0.50)],
            "Action":["Fix AI prompt","Enable web_search","SQL rule fix",
                       "Code change","Prompt fix","Accept 561499"],
        })
        fig = px.bar(rec_df,x="Category",y="Est. Recoverable",color="Action",
                     title="Estimated Recovery Potential by Fix Type")
        st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

        analyst_card("How to Read the Recovery Potential Chart", [
            "Each bar shows the estimated number of businesses that COULD receive a real NAICS code "
            "if a specific fix was implemented. These are estimates based on the diagnostic analysis.",
            f"'G3: Name keywords' (~30% of fallbacks = ~{int(fallbacks*0.30):,} businesses): "
            "businesses like 'Lisa's Nail Salon' get 561499 because the AI prompt doesn't check name keywords. "
            "Fix: update aiNaicsEnrichment.ts to classify from business name patterns before giving up.",
            f"'G2: Web search' (~20% = ~{int(fallbacks*0.20):,} businesses): "
            "businesses with a website URL that wasn't used for AI classification. "
            "Fix: ensure params.website is always passed to the AI enrichment function.",
            "'Genuinely unclassifiable' (~50%): holding companies, shell entities, brand-new "
            "registrations with no public footprint. For these, 561499 IS the correct answer. "
            "The gap is not the NAICS code but the customer-visible MCC description (Gap G5).",
        ])

        # ── Cross-Analysis merged into this tab ──────────────────────────────
        st.markdown("---")
        st.markdown("#### 🔗 Cross-Analysis — Fallback Rate by Entity Type")
        st.markdown("Understanding which entity types drive the most 561499 fallbacks "
                    "helps prioritize where to focus the fix effort.")

        if "entity_type" in naics.columns:
            et = naics.groupby(["entity_type","is_fallback"]).size().unstack(fill_value=0).reset_index()
            et.columns = ["Entity Type","Real NAICS","Fallback"]
            et["Fallback %"] = (et["Fallback"]/(et["Real NAICS"]+et["Fallback"])*100).round(1)
            et["Total"] = et["Real NAICS"] + et["Fallback"]
            col_l,col_r = st.columns(2)
            with col_l:
                fig_et = px.bar(et,x="Entity Type",y="Fallback %",color="Fallback %",
                             color_continuous_scale="RdYlGn_r",
                             title="561499 Fallback Rate by Entity Type")
                fig_et.add_hline(y=fallbacks/total*100,line_dash="dash",line_color="#3B82F6",
                                  annotation_text=f"Overall avg {fallbacks/total*100:.1f}%")
                st.plotly_chart(dark_chart_layout(fig_et),use_container_width=True)
            with col_r:
                styled_table(et[["Entity Type","Total","Real NAICS","Fallback","Fallback %"]])

            # Identify the entity type with highest fallback
            if len(et)>0:
                worst_type = et.loc[et["Fallback %"].idxmax()]
                best_type  = et.loc[et["Fallback %"].idxmin()]
                analyst_card("Entity Type Cross-Analysis — Why Different Types Have Different Fallback Rates", [
                    f"Highest fallback: '{worst_type['Entity Type']}' at {worst_type['Fallback %']:.1f}%. "
                    "Entity types with high fallback rates are typically those with weaker commercial database coverage: "
                    "sole proprietors, partnerships, and small LLCs are underrepresented in ZI/EFX bulk data.",
                    f"Lowest fallback: '{best_type['Entity Type']}' at {best_type['Fallback %']:.1f}%. "
                    "Corporations and established LLCs tend to have better vendor coverage because "
                    "they appear in more commercial databases.",
                    "Sole proprietors specifically: they may not have a registered SOS presence in all states, "
                    "making entity matching harder. Additionally, they often operate under personal names "
                    "which are less searchable in firmographic databases.",
                    "Actionable insight: if sole props drive the highest fallback rate, "
                    "prioritize the name-keyword classification fix (Gap G3) — sole prop businesses "
                    "often have descriptive names ('Smith's Plumbing') that the AI could classify without vendor data.",
                ])

    with tab_consist:
        st.markdown("#### 🔍 Classification Consistency & Anomaly Detection")
        st.markdown(
            "Checks whether NAICS/MCC codes are internally consistent and concordant "
            "with other available signals (website, description, MCC, sector). "
            "Inconsistencies may indicate mis-classification, AI hallucination, or data gaps."
        )

        # ── Pull enriching facts for cross-check (cached in session_state) ──────
        consist_key = _cache_key("consist_facts", record_limit)
        if consist_key not in st.session_state:
            with st.spinner("Loading website, MCC and description facts for consistency analysis…"):
                st.session_state[consist_key] = query_facts_safe([
                    'naics_code','mcc_code','naics_description','mcc_description',
                    'industry','website','website_found',
                ], record_limit)
                st.session_state[_cache_ts_key("consist_facts", record_limit)] = datetime.now(timezone.utc)
        consist_facts = st.session_state[consist_key]

        if consist_facts is None or consist_facts.empty:
            st.warning("Consistency analysis requires naics_code, mcc_code and website facts.")
        else:
            consist_facts["fact_val"] = consist_facts["value"].apply(
                lambda v: str(_parse_fact(v).get("value","")) if v else "")
            pivot_c = consist_facts.pivot_table(
                index="business_id", columns="name", values="fact_val", aggfunc="last"
            ).reset_index()
            pivot_c.columns.name = None

            # ── 1. NAICS ↔ MCC Concordance ────────────────────────────────────
            st.markdown("---")
            st.markdown("##### 1. NAICS ↔ MCC Code Concordance")
            st.markdown(
                "Each NAICS 6-digit code maps to a specific set of MCC codes via `rel_naics_mcc`. "
                "If `naics_code` and `mcc_code` are from different industry families, "
                "this is a classification conflict — one or both codes may be wrong."
            )

            # Known high-level NAICS→MCC sector concordance (2-digit prefix → MCC range)
            NAICS_SECTOR_MCC = {
                "11": ("Agriculture","0742,1711,5261"),
                "21": ("Mining","5172,5983"),
                "22": ("Utilities","4900,4911,4931"),
                "23": ("Construction","1520,1731,1740,1761,1771"),
                "31": ("Manufacturing","5065,5085,5169"),
                "32": ("Manufacturing","5045,5047,5065"),
                "33": ("Manufacturing","5040,5045,5065,5085"),
                "42": ("Wholesale","5040,5045,5065,5085,5169"),
                "44": ("Retail","5300,5310,5411,5511,5651,5661,5712,5812"),
                "45": ("Retail","5300,5411,5945,5999"),
                "48": ("Transportation","4111,4121,4131,4215,7512"),
                "49": ("Warehousing","4215,4225"),
                "51": ("Information","4814,5045,5734,7372"),
                "52": ("Finance","6011,6012,6051,6211,6300"),
                "53": ("Real Estate","6512,6552,7349"),
                "54": ("Professional Svcs","7372,7374,7389,8000"),
                "56": ("Admin/Support","7389,7392,8742"),
                "61": ("Education","8220,8249,8299"),
                "62": ("Healthcare","8011,8021,8049,8099"),
                "71": ("Arts/Entertainment","7011,7922,7991,7993,7996"),
                "72": ("Accommodation/Food","5812,5813,7011,7012"),
                "81": ("Other Services","7210,7230,7251,7261,7299"),
                "92": ("Government","9211,9222,9399"),
            }

            if "naics_code" in pivot_c.columns and "mcc_code" in pivot_c.columns:
                def naics_sector(n):
                    try: return str(n)[:2]
                    except: return ""

                def check_concordance(row):
                    n = str(row.get("naics_code","") or "")
                    m = str(row.get("mcc_code","")   or "")
                    if not n or not m or n=="561499": return "N/A"
                    sector = n[:2]
                    sector_info = NAICS_SECTOR_MCC.get(sector)
                    if sector_info is None: return "Unknown sector"
                    allowed_mccs = sector_info[1].split(",")
                    # Check if first 2 chars of MCC are in range
                    mcc_prefix = m[:2]
                    if any(mcc_prefix == a[:2] for a in allowed_mccs):
                        return "✅ Concordant"
                    return "⚠️ Potential mismatch"

                pivot_c["concordance"] = pivot_c.apply(check_concordance, axis=1)
                concordance_counts = pivot_c["concordance"].value_counts().reset_index()
                concordance_counts.columns = ["Status","Count"]
                concordance_counts["% of Total"] = (concordance_counts["Count"]/len(pivot_c)*100).round(1).astype(str)+"%"

                col_l, col_r = st.columns(2)
                with col_l:
                    fig = px.pie(concordance_counts, names="Status", values="Count",
                                 color="Status",
                                 color_discrete_map={"✅ Concordant":"#22c55e",
                                                      "⚠️ Potential mismatch":"#ef4444",
                                                      "N/A":"#64748b","Unknown sector":"#f59e0b"},
                                 hole=0.45, title="NAICS ↔ MCC Concordance")
                    st.plotly_chart(dark_chart_layout(fig), use_container_width=True)
                with col_r:
                    styled_table(concordance_counts, color_col="Status",
                                 palette={"✅ concordant":"#22c55e",
                                          "⚠️ potential mismatch":"#ef4444",
                                          "n/a":"#64748b"})
                    mismatch_n = int((pivot_c["concordance"]=="⚠️ Potential mismatch").sum())
                    if mismatch_n>0:
                        flag(f"{mismatch_n:,} businesses have NAICS and MCC from different industry sectors. "
                             "This may indicate: (1) AI chose NAICS from one industry but MCC from another, "
                             "(2) a new business with ambiguous classification, or "
                             "(3) a legitimate multi-industry business (e.g. restaurant + catering).", "amber")
                    else:
                        flag("All NAICS and MCC codes appear concordant.", "green")

                # ── What "Potential mismatch" means ─────────────────────────────
                st.markdown("#### ❓ What does '⚠️ Potential mismatch' mean?")
                st.markdown("""
**⚠️ Potential mismatch** means the NAICS 6-digit code and the MCC 4-digit code come from
**different industry sectors** — they should be describing the same type of business,
but the sector mapping suggests they might not be.

**How the check works:**
Each NAICS 2-digit prefix (sector) maps to an expected set of MCC code families.
For example:
- NAICS sector `72` (Accommodation & Food Service) → expected MCC families: 5812, 5813, 7011, 7012
- NAICS sector `54` (Professional Services) → expected MCC families: 7372, 7374, 8000

If the actual MCC code falls outside the expected family for the NAICS sector,
the row is flagged as "⚠️ Potential mismatch".

**Why mismatches happen:**

| Reason | How common | Severity |
|---|---|---|
| **Different vendors won each fact** — Fact Engine selects naics_code and mcc_code independently. ZoomInfo might win NAICS (restaurant), while AI wins MCC (tech services). | Most common | HIGH |
| **AI hallucination** — AI selected an MCC from a different industry than the vendor-selected NAICS. | Common | HIGH |
| **Legitimate multi-industry** — some businesses genuinely operate across sectors (restaurant with catering, gym with retail). | Rare | LOW |
| **NAICS or MCC is 561499/5614** — fallback codes have no meaningful sector, so any concordance check is N/A. | Expected | None |

**What to do with mismatches:**
1. Check `source.platformId` on both facts — if different vendors won each, that's the cause.
2. Look at the actual business description to see which code is more accurate.
3. Consider using an analyst override (manual correction) for high-value accounts.

**Important caveat:** This is a heuristic check using a simplified sector map.
Some codes genuinely cross sectors. A "potential mismatch" is a signal to investigate,
not an automatic error.
                """)

                # Sample mismatches with enriched explanation
                mismatches = pivot_c[pivot_c["concordance"]=="⚠️ Potential mismatch"][
                    ["business_id","naics_code","mcc_code","concordance"]].head(20)
                if not mismatches.empty:
                    st.markdown("##### Sample NAICS↔MCC mismatches (investigate these):")
                    st.markdown("*For each row: check if the NAICS and MCC describe the same type of business. "
                                "If they don't, one of the two facts needs correction via analyst override.*")
                    styled_table(mismatches)

            # ── 2. NAICS ↔ Description Concordance ───────────────────────────
            st.markdown("---")
            st.markdown("##### 2. NAICS Code ↔ Description Concordance")
            st.markdown(
                "The `naics_description` fact should describe the same industry as `naics_code`. "
                "If the description is null/missing while the code is present, the label pipeline failed. "
                "If the description is the generic fallback text, the AI couldn't classify."
            )

            if "naics_code" in pivot_c.columns and "naics_description" in pivot_c.columns:
                FALLBACK_DESC_MARKERS = [
                    "all other", "not elsewhere classified", "miscellaneous",
                    "other services", "business support", "fallback", ""
                ]
                def check_desc(row):
                    code = str(row.get("naics_code","") or "")
                    desc = str(row.get("naics_description","") or "").lower().strip()
                    if not code: return "No code"
                    if not desc: return "⚠️ Missing description"
                    if any(m in desc for m in FALLBACK_DESC_MARKERS) and code != "561499":
                        return "⚠️ Generic/fallback description"
                    return "✅ Has description"

                pivot_c["desc_check"] = pivot_c.apply(check_desc, axis=1)
                desc_counts = pivot_c["desc_check"].value_counts().reset_index()
                desc_counts.columns = ["Status","Count"]

                col_l, col_r = st.columns(2)
                with col_l:
                    fig2 = px.bar(desc_counts, x="Status", y="Count", color="Status",
                                  color_discrete_map={"✅ Has description":"#22c55e",
                                                       "⚠️ Missing description":"#ef4444",
                                                       "⚠️ Generic/fallback description":"#f59e0b",
                                                       "No code":"#64748b"},
                                  title="NAICS Description Quality")
                    fig2.update_layout(showlegend=False)
                    st.plotly_chart(dark_chart_layout(fig2), use_container_width=True)
                with col_r:
                    styled_table(desc_counts)
                    missing_desc = int((pivot_c["desc_check"]=="⚠️ Missing description").sum())
                    generic_desc = int((pivot_c["desc_check"]=="⚠️ Generic/fallback description").sum())
                    if missing_desc>0:
                        flag(f"{missing_desc:,} businesses have a NAICS code but no description. "
                             "naics_description fact missing — check if label lookup (core_naics_code) is working.", "red")
                    if generic_desc>0:
                        flag(f"{generic_desc:,} businesses have a generic/fallback description despite a specific code. "
                             "The description pipeline may not be reading the AI enrichment correctly.", "amber")

            # ── 3. Website ↔ NAICS Semantic Check ────────────────────────────
            st.markdown("---")
            st.markdown("##### 3. Website ↔ NAICS Classification Consistency")
            st.markdown(
                "If a business has a website URL but still received NAICS 561499 (fallback), "
                "this is a gap: the AI should have used the website to determine the industry "
                "but didn't. Conversely, if a business has no website and a specific NAICS code, "
                "the code likely came from a vendor match (good — no gap)."
            )

            if "naics_code" in pivot_c.columns:
                has_website = pivot_c.get("website", pd.Series([None]*len(pivot_c), index=pivot_c.index))
                if isinstance(has_website, pd.Series):
                    has_website_flag = has_website.apply(lambda v: bool(v and str(v).strip() not in ("","None","nan")))
                else:
                    has_website_flag = pd.Series([False]*len(pivot_c))

                is_fallback_c = pivot_c.get("naics_code","").apply(lambda v: str(v)=="561499")

                combo = pd.DataFrame({
                    "Has Website":   has_website_flag,
                    "Is Fallback":   is_fallback_c,
                }).value_counts().reset_index()
                combo.columns = ["Has Website","Is Fallback","Count"]
                combo["Scenario"] = combo.apply(lambda r:
                    "✅ Has website + real NAICS"   if r["Has Website"] and not r["Is Fallback"]
                    else "🚨 Has website + 561499 fallback"  if r["Has Website"] and r["Is Fallback"]
                    else "⚠️ No website + 561499 fallback"   if not r["Has Website"] and r["Is Fallback"]
                    else "✅ No website + real NAICS (vendor)", axis=1)

                col_l, col_r = st.columns(2)
                with col_l:
                    c_map2 = {
                        "✅ Has website + real NAICS":"#22c55e",
                        "🚨 Has website + 561499 fallback":"#ef4444",
                        "⚠️ No website + 561499 fallback":"#f59e0b",
                        "✅ No website + real NAICS (vendor)":"#3B82F6",
                    }
                    fig3 = px.pie(combo, names="Scenario", values="Count",
                                  color="Scenario", color_discrete_map=c_map2,
                                  hole=0.45, title="Website ↔ NAICS Consistency")
                    st.plotly_chart(dark_chart_layout(fig3), use_container_width=True)
                with col_r:
                    display_combo = combo[["Scenario","Count"]].copy()
                    display_combo["% of Total"] = (display_combo["Count"]/len(pivot_c)*100).round(1).astype(str)+"%"
                    styled_table(display_combo, color_col="Scenario",
                                 palette={k.lower():v for k,v in c_map2.items()})

                # Highlight the worst case
                worst = combo[combo["Scenario"]=="🚨 Has website + 561499 fallback"]["Count"].sum()
                if worst>0:
                    flag(f"🚨 {int(worst):,} businesses have a website URL but still received "
                         "NAICS 561499. This is Gap G2 in action: the AI enrichment did NOT use "
                         "the website to classify. Fix: enable web_search in aiNaicsEnrichment.ts "
                         "when params.website is set.", "red")
                else:
                    flag("All businesses with websites received real NAICS codes.", "green")

            # ── 4. MCC Description Anomaly Check ─────────────────────────────
            st.markdown("---")
            st.markdown("##### 4. MCC Description — Customer-Visible Fallback Text Detection")
            st.markdown(
                "When AI returns MCC 5614 (fallback), it also writes a fallback description: "
                "`'Fallback MCC per instructions (no industry evidence to determine canonical MCC description)'`. "
                "This internal debug text is **visible to customers in the Admin Portal**. "
                "Detect how many businesses have this description exposed."
            )

            FALLBACK_MCC_MARKER = "fallback mcc per instructions"
            mcc_desc_sql = f"""
                SELECT business_id,
                       JSON_EXTRACT_PATH_TEXT(value,'value') AS mcc_description
                FROM rds_warehouse_public.facts
                WHERE name = 'mcc_description'
                  AND LOWER(JSON_EXTRACT_PATH_TEXT(value,'value')) LIKE '%fallback%'
                ORDER BY received_at DESC{_limit_clause(record_limit)}
            """
            fallback_mcc_df = run_query(mcc_desc_sql)
            if fallback_mcc_df is not None and not fallback_mcc_df.empty:
                n_fb_desc = len(fallback_mcc_df)
                flag(f"🚨 {n_fb_desc:,} businesses have the internal fallback MCC description "
                     "exposed in the Admin Portal KYB tab. "
                     "This is Gap G5 — fix the AI system prompt to provide a clean 'Industry not determined' message.", "red")
                styled_table(fallback_mcc_df.head(20))
            else:
                flag("No fallback MCC descriptions detected — or mcc_description fact not accessible.", "green")

            analyst_card("Classification Consistency Insights", [
                "NAICS↔MCC mismatch: the Fact Engine selects naics_code and mcc_code independently. "
                "If different vendors win each fact, their codes may come from different industries. "
                "Always verify: mcc_code should be derivable from naics_code via rel_naics_mcc.",
                "Missing description with present code: the label lookup (core_naics_code JOIN) "
                "failed or was skipped. Check case-service getCaseByIDQuery L1555.",
                "Website+561499 combination is the clearest evidence of Gap G2. "
                "The website URL exists but aiNaicsEnrichment.ts did not run web_search.",
                "Fallback MCC description in customer UI (Gap G5): fix by changing the AI prompt "
                "to output 'Industry classification pending' instead of the internal debug message.",
            ])

            cross_box("Anomalous Relationship Patterns to Investigate", [
                "naics_code=722511 (Full-Service Restaurants) but mcc_code=7372 (Computer Programming): "
                "likely wrong NAICS from AI vs correct MCC from Trulioo. Check source.platformId on each.",
                "naics_description contains 'All Other' but naics_code is specific (e.g. 541512): "
                "the description is from the parent category, not the 6-digit code.",
                "NAICS code from equifax (weight=0.7) but very high confidence (0.95): "
                "investigate — EFX confidence formula caps at index/55, 0.95 would require index=52/55.",
                "business has website_found=true but naics_source='ai': "
                "web scraping found the site but SERP classification lost to AI enrichment — "
                "check SERP weight (0.3) vs AI weight (0.1); SERP should always beat AI.",
            ])

    with tab_dq:
        st.markdown("#### 🔬 NAICS / MCC Quality Checks")
        st.markdown("These automated checks detect systemic classification problems. "
                    "`✅ PASS` = within expected range. `❌ FAIL` = outside benchmark — see explanations below.")
        low_conf = int((naics["naics_confidence"]<0.40).sum()) if "naics_confidence" in naics.columns else 0
        dq_checks = [
            ("Fallback rate < 10%",  fallbacks/total<0.10, f"{fallbacks/total*100:.1f}%",
             "Above 10% means entity-matching is failing broadly across your portfolio."),
            ("AI win rate < 10%",    ai_wins/total<0.10,   f"{ai_wins/total*100:.1f}%",
             "AI (weight=0.1) should only win when ALL other vendors have no NAICS signal."),
            ("Low confidence (<0.40) < 20%", low_conf/total<0.20, f"{low_conf/total*100:.1f}%",
             "Low confidence codes are likely wrong — the vendor matched but wasn't confident."),
            ("No null NAICS codes",  naics["naics_code"].isna().sum()==0,
             f"{naics['naics_code'].isna().sum()} nulls",
             "Should always be 0 — the Fact Engine always produces 561499 as a last resort."),
        ]
        rows = [{"Check":l,"Result":v,"Status":"✅ PASS" if ok else "❌ FAIL","Action":a}
                for l,ok,v,a in dq_checks]
        styled_table(pd.DataFrame(rows),color_col="Status",
                     palette={"✅ pass":"#22c55e","❌ fail":"#ef4444"})

        # Per-FAIL explanations
        naics_fail_reasons = {
            "Fallback rate < 10%": {
                "why": f"Your fallback rate is {fallbacks/total*100:.1f}% — above the 10% benchmark. "
                       f"This means {fallbacks:,} businesses received NAICS 561499 (All Other Business Support Services), "
                       "which is the catch-all code used when the system cannot determine the real industry.",
                "causes": [
                    "Entity matching model (XGBoost) failed to find this business in ZI/EFX/OC databases",
                    "Very new businesses (<1 month) not yet in bulk vendor databases",
                    "Micro-businesses with no commercial database footprint",
                    "AI web_search disabled for businesses without a website URL (Gap G2)",
                    "AI prompt lacks name-keyword classification logic (Gap G3)",
                ],
                "action": "See the '⚠️ 561499 Root Cause & Cross-Analysis' tab for a detailed breakdown "
                          "of why this is happening and estimated recovery potential per fix.",
            },
            "AI win rate < 10%": {
                "why": f"AI (pid=31, weight=0.1) is the winning NAICS source for {ai_wins/total*100:.1f}% of businesses. "
                       "AI has the lowest weight in the Fact Engine and should only win as a last resort.",
                "causes": [
                    "All 4 data vendors (Middesk, OC, ZI, EFX) returned no NAICS signal for these businesses",
                    "Entity matching is failing broadly — no vendor matched these entities",
                    "ZI/EFX bulk data may be stale (check last refresh date in Redshift)",
                ],
                "action": "Check vendor match rates in the '📡 Source Analysis' tab. "
                          "If ZI/EFX match rates are low, the bulk data may need refreshing.",
            },
            "Low confidence (<0.40) < 20%": {
                "why": f"{low_conf/total*100:.1f}% of NAICS codes have confidence below 0.40. "
                       "These are borderline matches where the vendor found something but wasn't confident it was right.",
                "causes": [
                    "Partial entity match: vendor found a similar business name but not exact",
                    "Multiple businesses with similar names — system picked the wrong one",
                    "Sole proprietor or micro-business with minimal vendor data",
                ],
                "action": "Pull businesses with naics_confidence < 0.40 and review their NAICS codes manually. "
                          "Consider adding a flag in the Admin Portal for low-confidence classifications.",
            },
        }

        failed_naics = [(l,ok,v,a) for l,ok,v,a in dq_checks if not ok]
        if failed_naics:
            st.markdown("#### 🔍 FAIL Root Cause Explanations")
            for label,_,val,_ in failed_naics:
                detail = naics_fail_reasons.get(label)
                if not detail:
                    continue
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid #ef4444;
                    border-radius:8px;padding:14px 18px;margin:10px 0">
                  <div style="color:#ef4444;font-weight:700;font-size:.88rem">❌ FAIL — {label} ({val})</div>
                  <div style="color:#CBD5E1;font-size:.81rem;margin-top:8px">{detail['why']}</div>
                  <div style="color:#94A3B8;font-size:.78rem;margin-top:8px"><strong>Root causes:</strong>
                  <ul>{''.join(f'<li>{c}</li>' for c in detail['causes'])}</ul></div>
                  <div style="color:#60A5FA;font-size:.77rem;margin-top:6px">
                  <strong>Action:</strong> {detail['action']}</div>
                </div>""", unsafe_allow_html=True)

        analyst_card("NAICS / MCC Quality — Summary Interpretation", [
            f"Fallback rate {fallbacks/total*100:.1f}%: this is the single most important NAICS quality metric. "
            "Target: < 10%. Current rate tells you how often the pipeline cannot determine the industry.",
            f"AI win rate {ai_wins/total*100:.1f}%: secondary indicator. "
            "AI should win only as a last resort (weight=0.1). High AI win rate = vendor matching is failing.",
            f"Low confidence rate {low_conf/total*100:.1f}%: tertiary indicator. "
            "Even when a code is assigned, low confidence means it may be wrong. "
            "These businesses should be reviewed if the NAICS code is used for underwriting decisions.",
            "The NAICS code directly drives: MCC code selection, industry label in Admin Portal, "
            "Worth Score NAICS feature (naics6 input), and risk categorization. "
            "A wrong NAICS code cascades through multiple downstream decisions.",
        ])


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — RISK & SCORE
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "💰 Risk & Score":
    sh("Risk & Score",
       "Worth Score · score_decision · Due Diligence · watchlist · sanctions · PEP · "
       "BK/judgments/liens · cross-analysis", "💰")

    dd    = get_section_data("dd",    record_limit)
    worth = get_section_data("worth", record_limit)

    # ── Due Diligence KPIs ─────────────────────────────────────────────────────
    biz_dd = dd["business_id"].nunique() if "business_id" in dd.columns else len(dd)
    any_wl   = int((dd["watchlist_hits"]>0).sum()) if "watchlist_hits" in dd.columns else 0
    any_sanc = int((dd["sanctions_hits"]>0).sum()) if "sanctions_hits" in dd.columns else 0
    any_pep  = int((dd["pep_hits"]>0).sum()) if "pep_hits" in dd.columns else 0
    any_am   = int((dd["adverse_media"]>0).sum()) if "adverse_media" in dd.columns else 0
    any_bk   = int((dd["bk_hits"]>0).sum()) if "bk_hits" in dd.columns else 0
    any_judg = int((dd["judgment_hits"]>0).sum()) if "judgment_hits" in dd.columns else 0
    any_lien = int((dd["lien_hits"]>0).sum()) if "lien_hits" in dd.columns else 0

    c1,c2,c3,c4,c5,c6,c7 = st.columns(7)
    with c1: kpi("Watchlist Hits",f"{any_wl:,}",f"{any_wl/max(biz_dd,1)*100:.1f}%","#ef4444" if any_wl>0 else "#22c55e")
    with c2: kpi("🚨 Sanctions",  f"{any_sanc:,}",f"{any_sanc/max(biz_dd,1)*100:.1f}%","#ef4444")
    with c3: kpi("PEP Hits",      f"{any_pep:,}", f"{any_pep/max(biz_dd,1)*100:.1f}%","#f97316")
    with c4: kpi("Adverse Media", f"{any_am:,}",  f"{any_am/max(biz_dd,1)*100:.1f}%","#f59e0b")
    with c5: kpi("Bankruptcy",    f"{any_bk:,}",  f"{any_bk/max(biz_dd,1)*100:.1f}%","#8B5CF6")
    with c6: kpi("Judgments",     f"{any_judg:,}",f"{any_judg/max(biz_dd,1)*100:.1f}%","#8B5CF6")
    with c7: kpi("Liens",         f"{any_lien:,}",f"{any_lien/max(biz_dd,1)*100:.1f}%","#8B5CF6")

    if any_sanc>0:
        flag(f"🚨 HARD STOP: {any_sanc:,} businesses have SANCTIONS hits. "
             "Cannot auto-approve. Route to compliance immediately.", "red")

    # Check if we have audit-only worth data
    is_audit = worth is not None and "_source" in worth.columns and (worth["_source"]=="audit").all()
    has_scores = worth is not None and not is_audit and "worth_score_850" in worth.columns

    tab_dd, tab_risk_combo, tab_score, tab_audit, tab_dq_risk = st.tabs([
        "🔍 Due Diligence","🔗 Risk Combinations","💰 Worth Score","📊 Score Audit","🔬 Quality"
    ])

    with tab_dd:
        # ── Data source transparency ──────────────────────────────────────────
        has_facts = dd.attrs.get("has_facts", True)
        has_cust  = dd.attrs.get("has_cust",  False)
        has_bert  = dd.attrs.get("has_bert",  False)

        has_bert_hits = dd.attrs.get("has_bert_hits", False)
        wl_src = dd.attrs.get("watchlist_source","unknown")
        src_lines = []
        if has_bert_hits: src_lines.append(f"✅ Watchlist hits from `rds_integration_data.business_entity_review_task` (BERT) — most accurate")
        if has_cust:      src_lines.append(f"✅ `clients.customer_table` ({st.session_state.get('_watchlist_col_found','watchlist_count')} column)")
        if has_facts:     src_lines.append("✅ `rds_warehouse_public.facts` — num_bankruptcies, num_judgements, num_liens")
        if has_bert:      src_lines.append("✅ `rds_integration_data.business_entity_review_task` — status/sublabel detail")
        if not any([has_bert_hits, has_cust, has_facts]):
            src_lines.append("⚠️ No watchlist source accessible — check connection and table permissions")
        flag("**Watchlist data source:** " + " · ".join(src_lines) +
             "\n\n**Sanctions note:** Sanctions are stored as a listType WITHIN watchlist hits "
             "(type='sanctions' inside metadata JSONB). The BERT table only stores the consolidated status ('warning'/'success'). "
             "To get the sanctions vs PEP breakdown, the `sanctions_hits` and `pep_hits` facts "
             "from `rds_warehouse_public.facts` are used — if those facts are 0, "
             "the sanctions split is not pre-computed for this population.", "blue")

        # ── Why all zeros? Diagnostic ──────────────────────────────────────────
        all_zero = (any_wl + any_sanc + any_pep + any_am + any_bk + any_judg + any_lien) == 0
        if all_zero:
            flag("⚠️ All Due Diligence metrics show 0. This may be because:", "amber")
            st.markdown("""
**Why the dashboard shows all zeros when you have watchlist data:**

The second image you shared (the spreadsheet) shows a `watchlists` column with values > 0.
That data comes from `clients.customer_table.watchlist_count`.
The dashboard currently reads from `rds_warehouse_public.facts` (the `watchlist_hits` fact),
which may be stored differently or use a different population.

**Possible causes:**
1. **`watchlist_hits` fact is 0 for most businesses** — the Fact Engine stores the consolidated watchlist count,
   but it excludes adverse_media (which is tracked separately). If your watchlist tool only returns adverse_media hits,
   `watchlist_hits` would be 0 while the raw data shows hits.
2. **`clients.customer_table` uses different logic** — `watchlist_verification` in that table is a derived flag
   (1=no hits, 0=hits), and `watchlist_count` may count differently than `watchlist_hits` in the facts table.
3. **Cache invalidation needed** — if data was cached before VPN was connected, click 🔄 Refresh All Data in sidebar.

**To verify: run this SQL in Redshift:**
            """)
            st.code("""-- Check watchlist_hits distribution:
SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS hits, COUNT(*) AS businesses
FROM rds_warehouse_public.facts
WHERE name = 'watchlist_hits'
GROUP BY JSON_EXTRACT_PATH_TEXT(value,'value')
ORDER BY CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS INT) DESC
LIMIT 20;

-- Check clients.customer_table:
SELECT watchlist_count, watchlist_verification, COUNT(*) AS businesses
FROM clients.customer_table
GROUP BY watchlist_count, watchlist_verification
ORDER BY watchlist_count DESC
LIMIT 20;

-- Check detailed hit records:
SELECT bev.business_id, bert.status, bert.sublabel, bert.message
FROM rds_integration_data.business_entity_review_task bert
JOIN rds_integration_data.business_entity_verification bev
  ON bev.id = bert.business_entity_verification_id
WHERE bert.key = 'watchlist' AND bert.status = 'warning'
LIMIT 20;""", language="sql")

        # ── Main charts ────────────────────────────────────────────────────────
        col_l,col_r = st.columns(2)
        with col_l:
            hit_data = pd.DataFrame({
                "Type":["Watchlist","Sanctions","PEP","Adverse Media","BK","Judgments","Liens"],
                "Count":[any_wl,any_sanc,any_pep,any_am,any_bk,any_judg,any_lien],
            })
            fig = px.bar(hit_data,x="Type",y="Count",color="Type",
                         color_discrete_sequence=["#ef4444","#7f1d1d","#f97316","#f59e0b","#8B5CF6","#a855f7","#c084fc"],
                         title="Due Diligence Hit Frequency")
            fig.update_layout(showlegend=False)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            st.markdown("""
**What each bar represents:**

| Type | Source | What a hit means | Severity |
|---|---|---|---|
| **Watchlist** | Trulioo PSC / Middesk review task (key='watchlist') | Business or UBO appears on a compliance watchlist (PEP, Sanctions, or other lists) | HIGH |
| **Sanctions** | Trulioo PSC where listType='SANCTIONS' | Business/UBO is on OFAC, UN, EU, or HMT sanctions list | CRITICAL — hard stop |
| **PEP** | Trulioo PSC where listType='PEP' | Owner is a Politically Exposed Person | HIGH — requires EDD |
| **Adverse Media** | adverseMediaDetails.records | Negative news coverage (stored separately from watchlist) | MEDIUM |
| **BK** | num_bankruptcies fact | Business has at least one bankruptcy filing | MEDIUM |
| **Judgments** | num_judgements fact | Business has at least one civil judgment | MEDIUM |
| **Liens** | num_liens fact | Business has at least one outstanding lien | LOW-MEDIUM |
            """)
        with col_r:
            if "watchlist_hits" in dd.columns:
                wl_dist = dd["watchlist_hits"].value_counts().sort_index().reset_index()
                wl_dist.columns = ["Hit Count","Businesses"]
                fig2 = px.bar(wl_dist,x="Hit Count",y="Businesses",
                              color_discrete_sequence=["#ef4444"],
                              title="Watchlist Hits per Business Distribution")
                st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)
                st.markdown("""
**Reading the distribution chart:**
Most businesses should have 0 hits (the leftmost bar should be tallest).
Any business with > 0 hits requires review.
Multiple hits (2+) on the same business is unusual — check if they are from the same list type
(e.g. two aliases of the same person on OFAC) or different types (more concerning).

**Source:** `watchlist_hits` fact from `rds_warehouse_public.facts`.
Count = `watchlist.value.metadata.length` after deduplication in
`consolidatedWatchlist.ts`. Adverse media is excluded from this count.
                """)

        # Summary table
        dd_summary = pd.DataFrame({
            "Category":["Watchlist Hits","Sanctions Hits","PEP Hits","Adverse Media",
                         "Bankruptcy","Judgments","Liens","BK+Judg+Lien (all 3)"],
            "# Businesses":[any_wl,any_sanc,any_pep,any_am,any_bk,any_judg,any_lien,
                             int(((dd["bk_hits"]>0)&(dd["judgment_hits"]>0)&(dd["lien_hits"]>0)).sum()) if "bk_hits" in dd.columns else 0],
            "% of Total":[f"{v/max(biz_dd,1)*100:.1f}%" for v in [any_wl,any_sanc,any_pep,any_am,any_bk,any_judg,any_lien,
                          int(((dd["bk_hits"]>0)&(dd["judgment_hits"]>0)&(dd["lien_hits"]>0)).sum()) if "bk_hits" in dd.columns else 0]],
            "Severity":["HIGH","CRITICAL","HIGH","MEDIUM","MEDIUM","MEDIUM","LOW","CRITICAL"],
            "Action":["Review each hit","Hard stop — compliance","Enhanced Due Diligence",
                       "Manual review","Assess age/count","Assess amount","Assess status",
                       "Manual underwriting required"],
        })
        styled_table(dd_summary,color_col="Severity",
                     palette={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","LOW":"#64748b"})

        st.markdown("#### Watchlist Hit Type Explanations")
        for icon,color,title,desc in [
            ("🔴","#ef4444","SANCTIONS",
             "OFAC/UN/EU/HMT sanctions list. REGULATORY REQUIREMENT — hard stop. "
             "Source: Trulioo PSC screeningResults where listType='SANCTIONS'."),
            ("🟠","#f97316","PEP (Politically Exposed Person)",
             "Current/former political figure or close associate. NOT disqualifying but requires Enhanced Due Diligence. "
             "Source: Trulioo PSC where listType='PEP'."),
            ("🟡","#f59e0b","ADVERSE MEDIA",
             "Negative news coverage. Deliberately EXCLUDED from consolidated watchlist fact. "
             "Tracked separately in adverse_media_hits. Source: adverseMediaDetails."),
        ]:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:10px 14px;margin:5px 0">
              <span style="color:{color};font-weight:700">{icon} {title}</span>
              <div style="color:#94A3B8;font-size:.78rem;margin-top:3px">{desc}</div>
            </div>""", unsafe_allow_html=True)

    with tab_risk_combo:
        st.markdown("#### 🔗 Risk Combination Analysis")
        if "watchlist_hits" in dd.columns and "bk_hits" in dd.columns:
            dd["any_wl"]   = dd["watchlist_hits"]>0
            dd["any_sanc"] = dd["sanctions_hits"]>0 if "sanctions_hits" in dd.columns else False
            dd["any_pr"]   = (dd["bk_hits"]>0)|(dd["judgment_hits"]>0)|(dd["lien_hits"]>0)
            dd["risk_combo"] = dd.apply(lambda r:
                "🚨 WL+Sanc+PR" if r.any_wl and r.any_sanc and r.any_pr
                else ("🔴 WL+Sanctions" if r.any_wl and r.any_sanc
                else ("🟠 WL+PR" if r.any_wl and r.any_pr
                else ("🟡 WL only" if r.any_wl
                else ("🟣 PR only" if r.any_pr
                else "✅ Clean")))), axis=1)
            rc = dd["risk_combo"].value_counts().reset_index()
            rc.columns = ["Combination","Count"]
            rc["% of Total"] = (rc["Count"]/max(biz_dd,1)*100).round(1).astype(str)+"%"
            colors_rc = {"🚨 WL+Sanc+PR":"#7f1d1d","🔴 WL+Sanctions":"#ef4444",
                          "🟠 WL+PR":"#f97316","🟡 WL only":"#f59e0b",
                          "🟣 PR only":"#8B5CF6","✅ Clean":"#22c55e"}
            col_l,col_r = st.columns(2)
            with col_l:
                fig = px.pie(rc,names="Combination",values="Count",
                             color="Combination",color_discrete_map=colors_rc,hole=0.45,
                             title="Risk Combination Distribution")
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            with col_r:
                styled_table(rc,color_col="Combination",palette={k.lower():v for k,v in colors_rc.items()})

            cross_box("Risk Combination Insights",[
                f"WL+Sanc+PR: {int((dd['risk_combo']=='🚨 WL+Sanc+PR').sum())} businesses — highest risk combination. Immediate compliance referral.",
                "Clean (no hits): not necessarily low-risk — public records are backward-looking.",
                "PR only (no watchlist): credit/legal issues but no sanctions. More common, higher recovery potential.",
            ])

            # Heatmap: watchlist vs public records
            cross_tbl = pd.crosstab(dd["any_wl"],dd["any_pr"],
                                     rownames=["Has Watchlist"],colnames=["Has Public Record"])
            fig2 = go.Figure(go.Heatmap(
                z=cross_tbl.values,
                x=[f"PR: {c}" for c in cross_tbl.columns.tolist()],
                y=[f"WL: {i}" for i in cross_tbl.index.tolist()],
                colorscale="Blues",text=cross_tbl.values,texttemplate="%{text}",
            ))
            fig2.update_layout(title="Watchlist × Public Record Cross-tabulation")
            st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

    with tab_score:
        if has_scores:
            score_df = worth
            total_s = len(score_df); avg_s = score_df["worth_score_850"].mean()
            high = int((score_df["risk_level"]=="HIGH").sum())
            mod  = int((score_df["risk_level"]=="MODERATE").sum())
            low  = int((score_df["risk_level"]=="LOW").sum())

            c1,c2,c3,c4 = st.columns(4)
            with c1: kpi("Avg Score",f"{avg_s:.0f}","300–850","#3B82F6")
            with c2: kpi("🔴 HIGH Risk",f"{high:,}",f"{high/max(total_s,1)*100:.0f}% (<500)","#ef4444")
            with c3: kpi("🟡 MODERATE", f"{mod:,}", f"{mod/max(total_s,1)*100:.0f}% (500-650)","#f59e0b")
            with c4: kpi("🟢 LOW Risk", f"{low:,}", f"{low/max(total_s,1)*100:.0f}% (>650)","#22c55e")

            if "score_decision" in score_df.columns:
                c5,c6,c7 = st.columns(3)
                with c5: kpi("✅ APPROVE",f"{int((score_df['score_decision']=='APPROVE').sum()):,}","","#22c55e")
                with c6: kpi("🔍 FURTHER REVIEW",f"{int((score_df['score_decision']=='FURTHER_REVIEW_NEEDED').sum()):,}","","#f59e0b")
                with c7: kpi("❌ DECLINE",f"{int((score_df['score_decision']=='DECLINE').sum()):,}","","#ef4444")

            col_l,col_r = st.columns(2)
            with col_l:
                fig = px.histogram(score_df,x="worth_score_850",nbins=30,
                                   color_discrete_sequence=["#3B82F6"],
                                   title="Worth Score Distribution (300–850)")
                fig.add_vline(x=500,line_dash="dash",line_color="#ef4444",annotation_text="HIGH <500")
                fig.add_vline(x=650,line_dash="dash",line_color="#f59e0b",annotation_text="MOD <650")
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            with col_r:
                rl = score_df["risk_level"].value_counts().reset_index()
                rl.columns = ["Risk","Count"]
                fig2 = px.bar(rl,x="Risk",y="Count",color="Risk",
                              color_discrete_map={"HIGH":"#ef4444","MODERATE":"#f59e0b","LOW":"#22c55e"},
                              title="Risk Level Distribution")
                fig2.update_layout(showlegend=False)
                st.plotly_chart(dark_chart_layout(fig2),use_container_width=True)

            # Score source info
            flag("Source: rds_manual_score_public.business_scores via Redshift federation. "
                 "NOTE: score_status column does not exist in this schema version.", "blue")
        else:
            st.info("Individual score data not available from rds_manual_score_public.business_scores. "
                    "Check the Score Audit tab for aggregate fill-rate data.")
            st.code("""-- Confirmed working (no score_status filter):
SELECT COUNT(*), AVG(weighted_score_850), MIN(weighted_score_850), MAX(weighted_score_850)
FROM rds_manual_score_public.business_scores
WHERE weighted_score_850 IS NOT NULL;

SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, cs.business_id
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE bs.weighted_score_850 IS NOT NULL
LIMIT 10;""", language="sql")

    with tab_audit:
        if is_audit:
            audit_df = worth
            flag("Individual scores not accessible — showing aggregate fill rates from "
                 "warehouse.worth_score_input_audit.", "amber")
            c1,c2,c3 = st.columns(3)
            with c1: kpi("Audit Days",f"{len(audit_df):,}","scoring days","#3B82F6")
            with c2: kpi("Avg Biz/Day",f"{audit_df['rows_per_day'].mean():.0f}","scored daily","#22c55e")
            with c3: kpi("Latest Date",str(audit_df["score_date"].max()),"","#8B5CF6")

            fill_cols = [c for c in audit_df.columns if c.startswith("fill_")]
            latest = audit_df.iloc[0]
            fill_data = [{"Feature":c.replace("fill_",""),"Fill %":float(latest[c])} for c in fill_cols if c in audit_df.columns]
            fill_df = pd.DataFrame(fill_data).sort_values("Fill %",ascending=True)
            fill_df["Status"] = fill_df["Fill %"].apply(
                lambda v:"Good (>80%)" if v>=80 else("Medium (30-80%)" if v>=30 else"Low (<30%)"))
            fig = px.bar(fill_df.tail(30),x="Fill %",y="Feature",orientation="h",
                         color="Status",
                         color_discrete_map={"Good (>80%)":"#22c55e","Medium (30-80%)":"#f59e0b","Low (<30%)":"#ef4444"},
                         title=f"Feature Fill Rates (latest: {latest['score_date']})")
            fig.update_layout(height=600)
            st.plotly_chart(dark_chart_layout(fig),use_container_width=True)

            zero_features = fill_df[fill_df["Fill %"]==0]["Feature"].tolist()
            if zero_features:
                flag(f"{len(zero_features)} features at 0% fill: {', '.join(zero_features[:10])}. "
                     "These features are not reaching the model.", "red")
        else:
            st.info("Score audit data will appear here when individual scores are also unavailable. "
                    "Both sources were checked.")
            st.code("""SELECT score_date, rows_per_day, fill_state, fill_naics6, fill_revenue
FROM warehouse.worth_score_input_audit
ORDER BY score_date DESC LIMIT 10;""", language="sql")

    with tab_dq_risk:
        st.markdown("#### 🔬 Risk & Score Data Quality Checks")
        pr_all = int(((dd["bk_hits"]>0)&(dd["judgment_hits"]>0)&(dd["lien_hits"]>0)).sum()) if "bk_hits" in dd.columns else 0
        dq = [
            ("Sanctions rate < 1%",any_sanc/max(biz_dd,1)<0.01,f"{any_sanc/max(biz_dd,1)*100:.2f}%",
             "Any sanctions hit must be manually reviewed before approval"),
            ("Watchlist < 15%",any_wl/max(biz_dd,1)<0.15,f"{any_wl/max(biz_dd,1)*100:.1f}%",
             "High rate may indicate false positives or name matching issues"),
            ("BK+Judg+Lien combo < 5%",pr_all/max(biz_dd,1)<0.05,f"{pr_all/max(biz_dd,1)*100:.1f}%",
             "All three together = worst financial profile"),
            ("watchlist_hits col exists",  "watchlist_hits"  in dd.columns,str("watchlist_hits"  in dd.columns),"Required column"),
            ("num_bankruptcies col exists","num_bankruptcies" in dd.columns,str("num_bankruptcies" in dd.columns),"Required column"),
        ]
        rows = [{"Check":l,"Result":v,"Status":"✅ PASS" if ok else "❌ FAIL","Action":a} for l,ok,v,a in dq]
        styled_table(pd.DataFrame(rows),color_col="Status",palette={"✅ pass":"#22c55e","❌ fail":"#ef4444"})


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — BANKING & OPS
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🏦 Banking & Ops":
    sh("Banking & Operations",
       "GIACT verification · rds_integration_data · coverage gaps · "
       "account status · processing volumes", "🏦")

    flag("Banking data source: rds_integration_data.rel_banking_verifications (Redshift Spectrum). "
         "Confirmed working. GIACT does NOT have complete US coverage — "
         "unverified accounts are expected and tracked here.", "blue")

    # Query with session_state caching so the sidebar shows ✅ Banking — Xm Xs ago
    _bank_cache_key = _cache_key("banking", record_limit)
    _bank_ts_key    = _cache_ts_key("banking", record_limit)

    if _bank_cache_key not in st.session_state:
        with st.spinner("Loading Banking data from rds_integration_data…"):
            _verif = run_query(f"""
                SELECT verification_status, COUNT(*) AS accounts,
                       ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) AS pct
                FROM rds_integration_data.rel_banking_verifications
                GROUP BY verification_status ORDER BY accounts DESC
            """)
            # Store in session_state so sidebar cache indicator shows ✅
            st.session_state[_bank_cache_key] = _verif
            st.session_state[_bank_ts_key]    = datetime.now(timezone.utc)
    else:
        _bank_age = get_cache_age("banking", record_limit)
        if _bank_age is not None:
            st.caption(f"📦 Banking data cached ({_bank_age//60}m {_bank_age%60}s ago) — "
                       "click 🔄 Refresh All Data in sidebar to reload.")

    verif_summary = st.session_state.get(_bank_cache_key)

    if verif_summary is not None and not verif_summary.empty:
        total_accts = int(verif_summary["accounts"].sum())
        success_n   = int(verif_summary[verif_summary["verification_status"]=="SUCCESS"]["accounts"].sum()) if "SUCCESS" in verif_summary["verification_status"].values else 0
        errored_n   = int(verif_summary[verif_summary["verification_status"]=="ERRORED"]["accounts"].sum()) if "ERRORED" in verif_summary["verification_status"].values else 0

        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("Total Accounts",f"{total_accts:,}","all verification records","#3B82F6")
        with c2: kpi("✅ SUCCESS",f"{success_n:,}",f"{success_n/max(total_accts,1)*100:.2f}%","#22c55e")
        with c3: kpi("❌ ERRORED",f"{errored_n:,}",f"{errored_n/max(total_accts,1)*100:.2f}%","#ef4444")
        with c4: kpi("Coverage Gap",f"{errored_n:,}","GIACT has no data for these","#f59e0b")

        tab_verif, tab_giact_guide, tab_discover, tab_dq_bank, tab_sql = st.tabs([
            "📊 Verification Status","📖 GIACT Explained",
            "🔍 Discover Columns","🔬 Quality & Anomalies","🗄️ SQL Reference"
        ])

        with tab_verif:
            col_l,col_r = st.columns(2)
            with col_l:
                fig = px.pie(verif_summary,names="verification_status",values="accounts",
                             color="verification_status",
                             color_discrete_map={"SUCCESS":"#22c55e","ERRORED":"#ef4444"},
                             hole=0.5,title="GIACT Verification Status (Live)")
                st.plotly_chart(dark_chart_layout(fig),use_container_width=True)
            with col_r:
                styled_table(verif_summary.rename(columns={
                    "verification_status":"Status","accounts":"# Accounts","pct":"% of Total"}))
                st.markdown("""
**`SUCCESS`** — GIACT completed verification (account is checkable).
Does NOT mean the account is valid for the business — check `verify_response_code` within SUCCESS records.

**`ERRORED`** — GIACT could not verify. Causes:
- Credit union or community bank not in GIACT database (~15% expected)
- Invalid routing number
- API timeout or temporary error

**Action for ERRORED accounts**: route to manual bank statement review or Plaid balance verification.
                """)

            analyst_card("GIACT Coverage Gap Interpretation",[
                "99.94% SUCCESS rate in your data — significantly better than the industry average of ~85%. "
                "This means your applicant base uses mainly large national banks well-covered by GIACT.",
                "0.06% ERRORED (13 accounts): these are the unverifiable accounts. "
                "13 unverifiable accounts is very low and expected.",
                "Track this rate weekly. If ERRORED% rises above 5%, it may indicate: "
                "(1) shift in customer demographic toward credit unions, "
                "(2) GIACT API connectivity issues, or "
                "(3) change in account types being submitted.",
                "GIACT SUCCESS ≠ account passes underwriting. Within SUCCESS, check verify_response_code "
                "for codes 7/8 (risk-based decline) and 9 (NSF/negative history).",
            ])

        with tab_giact_guide:
            st.markdown("#### 📖 Understanding GIACT — Complete Guide")

            st.markdown("##### What GIACT is and what it checks")
            st.markdown("""
GIACT is a bank account verification service used by Worth AI to confirm that a business's
bank account is real, active, and in good standing before processing payments.

GIACT runs **two separate checks** using different data sources:

| Check | GIACT Product | Response Code Field | What it verifies |
|---|---|---|---|
| **Account Status** | gVerify | `verify_response_code` | Does the routing + account number belong to a real, active bank account? |
| **Account Name** | gAuthenticate | `auth_response_code` | Does the account holder's name match the submitted name? |
| **Contact Verification** | gAuthenticate | `auth_response_code` | Do phone, address, and other contact details match the account? |

**The `verification_status` field** (SUCCESS/ERRORED) only reflects whether GIACT's API call
completed without error — NOT whether the account is valid for payments.
A `SUCCESS` means GIACT had data; an `ERRORED` means GIACT had no data.
            """)

            st.markdown("##### SUCCESS vs ERRORED — What each really means")
            col_l, col_r = st.columns(2)
            with col_l:
                st.markdown("""
**✅ `SUCCESS`**

GIACT found this routing+account number in their database and returned a result.
This does NOT mean the account is approved.

Within SUCCESS records, `verify_response_code` tells you the actual outcome:
- Code **12** = Open and valid checking account ✅
- Code **15** = Open and valid savings account ✅
- Code **6** = Routing valid, but no data on this specific account ⚠️
- Code **7/8** = Risk-based decline ❌
- Code **9** = NSF/returns history ❌
- Code **11/16/17/18** = Not yet available (coverage gap) ⚠️

Without `verify_response_code`, SUCCESS just means GIACT responded.
                """)
            with col_r:
                st.markdown("""
**❌ `ERRORED`**

GIACT could not look up this account. Most common causes:

1. **Credit union not in database** (~60% of ERRORED cases)
   GIACT primarily covers major national banks. Small credit unions,
   community banks, and regional institutions are often absent.

2. **Invalid routing number** (~15% of ERRORED)
   The routing number format is invalid or doesn't match any known institution.

3. **API timeout or error** (~5% of ERRORED)
   Temporary connectivity issue — retry automatically resolves.

4. **Online-only bank** (~20% of ERRORED)
   Some fintech banks (Chime, Current, etc.) may not be in GIACT's database.

**Action for ERRORED:** Route to manual bank statement review.
Request 3 months of statements. Use Plaid for balance/transaction verification.
                """)

            st.markdown("##### GIACT Coverage Map — Why 100% coverage is impossible")
            coverage_data = pd.DataFrame({
                "Bank Type": ["Major national banks (JPMorgan, BofA, Wells Fargo, Citi)",
                               "Regional banks (Regions, Truist, Fifth Third)",
                               "Credit unions (Navy Federal, BECU, etc.)",
                               "Community banks (<$1B assets)",
                               "Online-only banks (Chime, Current, Varo)",
                               "International banks"],
                "GIACT Coverage": ["~99%","~85%","~40%","~60%","~30%","~5%"],
                "Worth AI Expected %": ["~70% of accounts","~15% of accounts",
                                         "~8% of accounts","~5% of accounts",
                                         "~1% of accounts","~1% of accounts"],
                "If ERRORED": ["Rare — retry","Possible","Expected","Possible",
                                "Expected","Expected"],
            })
            styled_table(coverage_data)

            st.markdown("##### What the 99.94% SUCCESS rate in your data means")
            analyst_card("GIACT Coverage Analysis for Your Portfolio", [
                "99.94% SUCCESS rate is exceptional — far above the industry average of ~85%. "
                "This strongly suggests your applicant base primarily uses major national banks (JPMorgan Chase, BofA, Wells Fargo, Citi).",
                "0.06% ERRORED (13 accounts) is very low. For context: if 5% of your applicants "
                "used credit unions, you would expect ~5% ERRORED. Your 0.06% means almost no credit union users.",
                "Interpretation: your current customer base is likely concentrated in urban/suburban markets "
                "with standard banking relationships, not rural areas or immigrant communities who often use credit unions.",
                "Warning: if your customer mix shifts (e.g. you expand to rural markets or specific immigrant communities), "
                "ERRORED% could rise to 10–20%. Build the manual review workflow now so you're prepared.",
                "SUCCESS ≠ clean: within your 23,351 SUCCESS accounts, pull verify_response_code distribution. "
                "Codes 7, 8, 9 indicate risk signals. Codes 11/16/17/18 indicate GIACT coverage gaps "
                "even within the SUCCESS category.",
            ])

            st.markdown("##### Cross-reference: GIACT vs Plaid")
            cross_box("GIACT vs Plaid — Two Different Banking Verifications", [
                "GIACT verifies the account EXISTS and checks its history (NSF, returns, risk). "
                "It does NOT confirm current balance or live transaction data.",
                "Plaid provides live balance data, transaction history (90 days), and account owner verification. "
                "It requires the applicant to log in to their bank — higher friction but richer data.",
                "Worth AI uses BOTH: GIACT for quick account validation, Plaid for cash flow analysis "
                "used in the Worth Score (cf_operating_cash_flow, cf_cash_at_end_of_period features).",
                "If GIACT ERROREDs, Plaid data should still be available if the applicant connected their account. "
                "Check warehouse.worth_score_input_audit for cf_* fill rates — low fill = Plaid not connected.",
                "Sanity check: if GIACT=SUCCESS but Plaid cash flow is missing, the account exists "
                "but the applicant didn't grant Plaid access. This is a data gap for the Worth Score.",
            ])

        with tab_dq_bank:
            st.markdown("#### 🔬 Banking Data Quality & Anomaly Analysis")
            flag("Banking data quality checks based on confirmed data: "
                 "23,351 SUCCESS (99.94%), 13 ERRORED (0.06%).", "blue")

            # Run additional queries for richer analysis
            col_verif_detail = run_query("""
                SELECT * FROM rds_integration_data.rel_banking_verifications LIMIT 5
            """)

            c1,c2,c3,c4 = st.columns(4)
            with c1: kpi("SUCCESS Rate",f"{success_n/max(total_accts,1)*100:.2f}%",
                         "✅ Above 85% industry avg","#22c55e")
            with c2: kpi("ERRORED Rate",f"{errored_n/max(total_accts,1)*100:.2f}%",
                         "✅ Well below 15% threshold","#22c55e")
            with c3: kpi("Coverage Gap",f"{errored_n:,}",
                         "cannot be verified by GIACT","#f59e0b")
            with c4: kpi("Manual Review Needed",f"{errored_n:,}",
                         "route to bank statement review","#f59e0b")

            st.markdown("##### Quality Checks")
            bank_checks = [
                ("SUCCESS rate > 85% (industry avg)", success_n/max(total_accts,1)>0.85,
                 f"{success_n/max(total_accts,1)*100:.2f}%",
                 "Below 85%: demographic shift to credit unions or GIACT API issues"),
                ("ERRORED rate < 15%", errored_n/max(total_accts,1)<0.15,
                 f"{errored_n/max(total_accts,1)*100:.2f}%",
                 "Above 15%: too many unverifiable accounts, manual review burden increases"),
                ("Total accounts > 0", total_accts>0,
                 f"{total_accts:,}","No accounts in system — banking integration may not be active"),
                ("ERRORED < 100 absolute count", errored_n<100,
                 f"{errored_n:,}","High absolute count = manual review backlog risk"),
            ]
            rows_b = [{"Check":l,"Result":v,"Status":"✅ PASS" if ok else "❌ FAIL","Action":a}
                      for l,ok,v,a in bank_checks]
            styled_table(pd.DataFrame(rows_b),color_col="Status",
                         palette={"✅ pass":"#22c55e","❌ fail":"#ef4444"})

            st.markdown("##### Anomaly Detection")
            bank_anomalies = []

            if success_n/max(total_accts,1) < 0.85:
                bank_anomalies.append(("🔴 HIGH","SUCCESS rate dropped below 85% industry average",
                    "This may indicate: (1) GIACT API connectivity issues (check status page), "
                    "(2) demographic shift in applicants toward credit unions, "
                    "(3) routing number format issues in the integration.",
                    f"success_rate={success_n/max(total_accts,1)*100:.2f}%"))

            if errored_n > total_accts * 0.15:
                bank_anomalies.append(("🟡 MEDIUM","High ERRORED rate — manual review backlog risk",
                    f"{errored_n:,} accounts ({errored_n/max(total_accts,1)*100:.1f}%) cannot be GIACT-verified. "
                    "This exceeds the 15% threshold. Ensure manual bank statement review capacity is sufficient.",
                    f"errored_rate={errored_n/max(total_accts,1)*100:.1f}%"))

            if not bank_anomalies:
                flag("✅ No banking anomalies detected. SUCCESS/ERRORED rates are within expected ranges.", "green")
            else:
                for sev,title,desc,flds in bank_anomalies:
                    color = "#ef4444" if "HIGH" in sev else "#f59e0b"
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                        border-radius:8px;padding:12px 16px;margin:8px 0">
                      <div style="color:{color};font-weight:700">{sev} — {title}</div>
                      <div style="color:#CBD5E1;font-size:.80rem;margin-top:6px">{desc}</div>
                    </div>""", unsafe_allow_html=True)

            if col_verif_detail is not None and not col_verif_detail.empty:
                st.markdown("##### Sample verification records (actual data from rds_integration_data):")
                st.dataframe(col_verif_detail, use_container_width=True, hide_index=True)
                st.markdown("*These are real records. Use the Discover Columns tab to understand each column.*")

        with tab_discover:
            st.markdown("#### 🔍 Discover Actual Table Schema")
            st.markdown(
                "This tab queries the real `rds_integration_data` tables and shows you the **actual column names** "
                "so you can build correct JOIN queries. The number in parentheses (e.g. '9 columns') is how many "
                "columns exist in that table — it's a schema discovery count, not a row count."
            )

            col_verif_sql = "SELECT * FROM rds_integration_data.rel_banking_verifications LIMIT 1"
            col_acct_sql  = "SELECT * FROM rds_integration_data.bank_accounts LIMIT 1"
            col_v = run_query(col_verif_sql)
            col_a = run_query(col_acct_sql)

            col_l, col_r = st.columns(2)
            with col_l:
                if col_v is not None and not col_v.empty:
                    st.success(f"✅ rel_banking_verifications — {len(col_v.columns)} columns")
                    st.markdown("""
**What this table is:** The GIACT bank account verification results table.
One row per bank account verification attempt.
- Each row = one verification result for one bank account
- `verification_status`: SUCCESS or ERRORED (see GIACT Explained tab)
- The other columns tell you: which account was verified, when, and what the result was
- **Important**: this is NOT a business-level table — one business can have multiple accounts
                    """)
                    st.markdown("**Live column names (from actual table):**")
                    cols_v = col_v.columns.tolist()
                    col_df = pd.DataFrame({
                        "Column Name": cols_v,
                        "Example Value": [str(col_v.iloc[0][c])[:50] if c in col_v.columns else "" for c in cols_v],
                    })
                    styled_table(col_df)
                    st.markdown("**To join with bank_accounts:** use the column shown above "
                                "that references the account ID. "
                                "Run `SELECT * FROM rds_integration_data.rel_banking_verifications LIMIT 1` "
                                "to see the actual FK column name.")
                else:
                    st.warning("rel_banking_verifications not accessible.")

            with col_r:
                if col_a is not None and not col_a.empty:
                    st.success(f"✅ bank_accounts — {len(col_a.columns)} columns")
                    st.markdown("""
**What this table is:** The bank account metadata table from Plaid.
One row per bank account connected by an applicant.
- `business_id`: links to the business that connected this account
- `account_type`: checking / savings / credit / investment
- `account_subtype`: more specific (e.g. 'checking', 'money market')
- `mask`: last 4 digits of account number (for display only)
- `institution_name`: name of the bank (e.g. 'JPMorgan Chase', 'Bank of America')
- **22 columns** = rich metadata including balance, name, status, and timestamps
                    """)
                    st.markdown("**Live column names (from actual table):**")
                    cols_a = col_a.columns.tolist()
                    col_a_df = pd.DataFrame({
                        "Column Name": cols_a,
                        "Example Value": [str(col_a.iloc[0][c])[:50] if c in col_a.columns else "" for c in cols_a],
                    })
                    styled_table(col_a_df)
                else:
                    st.warning("bank_accounts not accessible.")

            st.markdown("---")
            st.markdown("#### Other banking tables in rds_integration_data")
            st.markdown("""
| Table | Purpose | Key Columns |
|---|---|---|
| `rel_banking_verifications` | GIACT verification results | verification_status, verify_response_code, auth_response_code |
| `bank_accounts` | Plaid account metadata | business_id, account_type, institution_name, mask |
| `bank_account_transactions` | Individual Plaid transactions | amount, date, category, merchant_name |
| `banking_balances` | Monthly balance aggregates | business_id, month, avg_balance, total_deposits |
| `banking_balances_daily` | Daily balance snapshots | business_id, date, current_balance |
| `data_processing_history` | Manual processing volumes (annual/monthly/AMEX) | business_id, general_data (JSONB) |

The `clients.customer_table` also has banking fields:
- `watchlist_verification` — 1=no hits, 0=hits (different from GIACT)
- Any Plaid-derived cash flow fields used in Worth Score inputs
            """)

        with tab_sql:
            st.code("""-- ✅ CONFIRMED WORKING — verification status summary:
SELECT verification_status, COUNT(*) AS accounts,
       ROUND(COUNT(*)*100.0/SUM(COUNT(*)) OVER(),2) AS pct
FROM rds_integration_data.rel_banking_verifications
GROUP BY verification_status ORDER BY accounts DESC;

-- Discover actual FK column for joining (run first):
SELECT * FROM rds_integration_data.rel_banking_verifications LIMIT 1;
SELECT * FROM rds_integration_data.bank_accounts LIMIT 1;

-- Processing volumes per business:
SELECT business_id,
       JSON_EXTRACT_PATH_TEXT(general_data,'monthly_volume') AS monthly_volume,
       JSON_EXTRACT_PATH_TEXT(general_data,'annual_volume')  AS annual_volume
FROM rds_integration_data.data_processing_history LIMIT 10;

-- Average transaction size:
SELECT dbit.business_id, AVG(bat.amount) AS avg_transaction_size
FROM rds_integration_data.bank_account_transactions bat
JOIN rds_integration_integrations.data_business_integrations_tasks dbit
  ON bat.business_integration_task_id = dbit.id
GROUP BY dbit.business_id LIMIT 10;""", language="sql")
    else:
        st.error("Could not connect to rds_integration_data.rel_banking_verifications.")
        err = st.session_state.get("_last_db_error","")
        if err:
            with st.expander("Database error"):
                st.code(err, language=None)
        st.code("""-- Run in your Redshift console to confirm access:
SELECT verification_status, COUNT(*) AS accounts
FROM rds_integration_data.rel_banking_verifications
GROUP BY verification_status ORDER BY accounts DESC;""", language="sql")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — BUSINESS LOOKUP
# ═══════════════════════════════════════════════════════════════════════════════
elif section == "🔎 Business Lookup":
    sh("KYB Business Investigation",
       "Full per-business analysis mirroring the Admin Portal KYB tabs — "
       "Background · Registry · Identity · Classification · Risk · Consistency checks", "🔎")

    flag("Systematic replacement of manual KYB analysis. "
         "Checks every field for data quality, consistency, and anomalous relationships.", "blue")

    business_id = st.text_input(
        "Business UUID",
        placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        help="The business_id from rds_cases_public.data_businesses"
    )

    if not business_id or len(business_id) < 10:
        st.info("Enter a business UUID to begin the full KYB investigation.")
        st.markdown("**This tool performs the following checks automatically:**")
        categories = {
            "🏢 Background": ["Business name vs legal name match", "DBA consistency",
                              "NAICS/MCC consistency check", "Industry vs classification concordance",
                              "Revenue/employee data presence"],
            "🏛️ Business Registration": ["SOS active status", "Domestic vs foreign filing check",
                                          "Middesk vs OC concordance", "Perpetual+inactive detection",
                                          "TIN verification (all 3 facts consistency)"],
            "🪪 Identity (KYC)": ["IDV pass/fail reason", "Name match status",
                                   "Address match status", "TIN consistency across facts",
                                   "IDV vs TIN cross-check"],
            "🏭 Classification": ["NAICS ↔ MCC concordance", "Website ↔ NAICS consistency",
                                   "Description vs code check", "Source conflict detection",
                                   "AI vs vendor NAICS comparison"],
            "⚠️ Risk & Watchlist": ["Sanctions/PEP/adverse media", "Bankruptcy age and count",
                                     "Judgment and lien status", "Vendor confidence aggregate risk score"],
            "🔗 Cross-Field Anomalies": ["Entity type vs NAICS sector (e.g. sole prop + manufacturing)",
                                          "State of formation vs operating jurisdiction",
                                          "Website found but NAICS 561499",
                                          "SOS active but TIN failed",
                                          "High vendor conf but no NAICS"],
        }
        for cat, checks in categories.items():
            with st.expander(cat):
                for c in checks:
                    st.markdown(f"  - {c}")
    else:
        bid = business_id.strip()

        biz_cache_key    = f"_biz_{bid}"
        biz_ts_key       = f"_biz_ts_{bid}"

        # Force reload if the user clicked the Refresh button
        # (clear_data_cache() removes _biz_* keys)
        need_load = biz_cache_key not in st.session_state

        if need_load:
            with st.spinner(f"Loading all KYB data for {bid}…"):
                # Step 1: get all fact names for this business (no value, always safe)
                names_sql = f"""
                    SELECT DISTINCT name, MAX(received_at) AS received_at
                    FROM rds_warehouse_public.facts
                    WHERE business_id = '{bid}'
                    GROUP BY name
                    ORDER BY name
                """
                names_df = run_query(names_sql)

                if names_df is None or names_df.empty:
                    st.session_state[biz_cache_key] = None
                    st.session_state[biz_ts_key]    = datetime.now(timezone.utc)
                else:
                    # Step 2: fetch value for each fact individually
                    # Skip any fact whose value exceeds the VARCHAR(65535) federation limit
                    KNOWN_LARGE = {
                        "sos_filings","watchlist","watchlist_raw","bankruptcies",
                        "judgements","liens","people","addresses",
                        "internal_platform_matches_combined","sos_match",
                        "adverse_media","adverse_media_articles",
                    }
                    all_rows = []
                    prog = st.progress(0, text="Fetching facts…")
                    fact_names = names_df["name"].tolist()
                    for i, fact_name in enumerate(fact_names):
                        prog.progress((i+1)/len(fact_names), text=f"Loading {fact_name}…")
                        if fact_name in KNOWN_LARGE:
                            # Add a placeholder row — value too large to fetch via federation
                            all_rows.append({
                                "name": fact_name,
                                "value": '{"value":"[too large — query PostgreSQL RDS directly]"}',
                                "received_at": names_df[names_df["name"]==fact_name]["received_at"].iloc[0],
                            })
                            continue
                        row_sql = f"""
                            SELECT name, value, received_at
                            FROM rds_warehouse_public.facts
                            WHERE business_id = '{bid}'
                              AND name = '{fact_name}'
                            ORDER BY received_at DESC
                            LIMIT 1
                        """
                        row = run_query(row_sql)
                        if row is not None and not row.empty:
                            all_rows.append(row.iloc[0].to_dict())
                        else:
                            # Likely hit VARCHAR limit — add placeholder
                            all_rows.append({
                                "name": fact_name,
                                "value": '{"value":"[too large — query PostgreSQL RDS directly]"}',
                                "received_at": names_df[names_df["name"]==fact_name]["received_at"].iloc[0],
                            })
                        # Clear any error from oversized fact
                        st.session_state.pop("_last_db_error", None)
                    prog.empty()

                    result = pd.DataFrame(all_rows) if all_rows else None
                    st.session_state[biz_cache_key] = result
                    st.session_state[biz_ts_key]    = datetime.now(timezone.utc)
        else:
            # Show cache age — guard against missing ts key
            if biz_ts_key in st.session_state:
                biz_age = int((datetime.now(timezone.utc) - st.session_state[biz_ts_key]).total_seconds())
                st.caption(f"📦 Cached data (loaded {biz_age}s ago). Click **🔄 Refresh All Data** in sidebar to reload.")

        facts_df = st.session_state.get(biz_cache_key)

        # Provide a manual reload button in case of empty/None cache
        if facts_df is None or (hasattr(facts_df,"empty") and facts_df.empty):
            col_retry, _ = st.columns([1,3])
            with col_retry:
                if st.button("🔄 Reload this business", type="primary"):
                    for k in [biz_cache_key, biz_ts_key]:
                        if k in st.session_state:
                            del st.session_state[k]
                    st.rerun()
            st.error(
                f"No facts found for `{bid}`. "
                "Possible causes:\n"
                "1. UUID is incorrect — copy it from the Admin Portal URL\n"
                "2. VPN is not connected — Redshift unreachable\n"
                "3. Previous cached result was empty — click 🔄 Reload above\n\n"
                "Verify the UUID by running this in Redshift:\n"
            )
            st.code(f"SELECT COUNT(*) FROM rds_warehouse_public.facts WHERE business_id = '{bid}';", language="sql")
            st.info("If the query above returns > 0, click **🔄 Reload this business** to force a fresh query. "
                    "The previous result may have been cached from when VPN was disconnected.")
            st.stop()

        # ── Parse all facts into structured dict ─────────────────────────────
        latest = {}
        for _, row in facts_df.iterrows():
            if row["name"] not in latest:
                latest[row["name"]] = _parse_fact(row["value"])

        def gv(name, *path):
            """Get the inner value from a fact, optionally traversing sub-keys.
            Always returns a scalar (str/int/float/bool/None) — never a list or dict
            when no path is specified, so float(gv(...)) never crashes."""
            fact = latest.get(name, {})
            v = fact.get("value")
            if path and isinstance(v, dict):
                for k in path:
                    v = v.get(k) if isinstance(v, dict) else None
            # If value is a list or dict (complex fact), return None for scalar use
            # The caller can check isinstance(v, list) if they need array data
            if isinstance(v, (list, dict)) and not path:
                return None
            return v

        def gv_scalar(name, default=None):
            """Safe scalar extraction — converts to string for int/float operations."""
            v = gv(name)
            if v is None:
                return default
            if isinstance(v, (list, dict)):
                return default
            try:
                return v
            except Exception:
                return default

        def gc(name): return float(_safe_get(latest.get(name,{}),"source","confidence",default=0) or 0)
        def gp(name): return pid_name(str(_safe_get(latest.get(name,{}),"source","platformId",default="")))
        def gts(name): return str(facts_df[facts_df["name"]==name]["received_at"].iloc[0])[:16] if name in facts_df["name"].values else "N/A"

        def fact_row(name, label=None):
            """Build a display row for a single fact."""
            v = gv(name)
            if isinstance(v,(dict,list)): display = json.dumps(v)[:120]
            else: display = str(v)[:120] if v is not None else "(not stored)"
            conf = gc(name)
            return {"Field": label or name, "Value": display,
                    "Source": gp(name), "Confidence": f"{conf:.3f}" if conf>0 else "—",
                    "Updated": gts(name)}

        # ── Summary header ────────────────────────────────────────────────────
        biz_name  = str(gv("business_name")  or gv("legal_name") or "Unknown")
        naics_val = str(gv("naics_code")     or "")
        mcc_val   = str(gv("mcc_code")       or "")
        sos_act   = str(gv("sos_active")     or "").lower()
        tin_bool  = str(gv("tin_match_boolean") or "").lower()
        wl_hits   = int(float(gv("watchlist_hits") or 0))
        idv_val   = str(gv("idv_passed_boolean") or "").lower()

        st.markdown(f"### 🔍 KYB Investigation — `{biz_name}` (`{bid}`)")
        c1,c2,c3,c4,c5 = st.columns(5)
        with c1: kpi("SOS",
                     "✅ Active" if sos_act=="true" else ("🚨 Inactive" if sos_act=="false" else "⚠️ Unknown"),
                     "registry","#22c55e" if sos_act=="true" else "#ef4444")
        with c2: kpi("TIN",
                     "✅ Verified" if tin_bool=="true" else "❌ Not verified",
                     "IRS EIN match","#22c55e" if tin_bool=="true" else "#ef4444")
        with c3: kpi("NAICS",
                     f"{'⚠️ ' if naics_val=='561499' else ''}{naics_val or 'N/A'}",
                     "561499=fallback" if naics_val=="561499" else "classification",
                     "#f59e0b" if naics_val=="561499" else "#22c55e")
        with c4: kpi("Watchlist",
                     f"🚨 {wl_hits} hit(s)" if wl_hits>0 else "✅ Clean",
                     "","#ef4444" if wl_hits>0 else "#22c55e")
        with c5: kpi("IDV",
                     "✅ Passed" if idv_val=="true" else ("❌ Not passed" if idv_val=="false" else "⚠️ Unknown"),
                     "Plaid","#22c55e" if idv_val=="true" else "#f59e0b")

        # ── Tab structure mirroring Admin Portal ─────────────────────────────
        tab_bg, tab_reg, tab_ident, tab_class, tab_risk, tab_worth, tab_anomaly, tab_all = st.tabs([
            "🏢 Background","🏛️ Registry","🪪 Identity","🏭 Classification",
            "⚠️ Risk","💰 Worth Score","🔗 Cross-Field Anomalies","📋 All Facts"
        ])

        # ──────────────────────────────────────────────────────────────────────
        with tab_bg:
            st.markdown("#### 🏢 Background — Firmographic Data")
            bg_facts = [
                fact_row("business_name",   "Business Name"),
                fact_row("legal_name",       "Legal Name"),
                fact_row("dba_found",        "DBA Found"),
                fact_row("corporation",      "Entity Type"),
                fact_row("formation_date",   "Formation Date"),
                fact_row("year_established", "Year Established"),
                fact_row("primary_address",  "Primary Address"),
                fact_row("business_phone",   "Business Phone"),
                fact_row("email",            "Email"),
                fact_row("website",          "Website URL"),
                fact_row("website_found",    "Website Found"),
                fact_row("num_employees",    "Employees"),
                fact_row("revenue",          "Revenue"),
                fact_row("naics_code",       "NAICS Code"),
                fact_row("naics_description","NAICS Description"),
                fact_row("mcc_code",         "MCC Code"),
                fact_row("mcc_description",  "MCC Description"),
                fact_row("industry",         "Industry Sector"),
            ]
            styled_table(pd.DataFrame(bg_facts), color_col="Value")

            with st.expander("ℹ️ How to read this table — Source, Confidence, (not stored), Unknown explained"):
                st.markdown("""
**Value column:**
- Normal value = the actual data stored for this field
- `(not stored)` = this fact does NOT exist in `rds_warehouse_public.facts` for this business. It was either never collected, or the vendor that provides it didn't match this entity.

**Source column — who provided this field:**
| Source | Platform ID | What it means |
|---|---|---|
| **Middesk** | pid=16 | US Secretary of State live query via Middesk API |
| **OC** | pid=23 | OpenCorporates global registry database |
| **ZoomInfo** | pid=24 | ZoomInfo firmographic bulk data (Redshift) |
| **Equifax** | pid=17 | Equifax firmographic bulk data (Redshift) |
| **Trulioo** | pid=38 | Trulioo KYB / person screening API |
| **AI** | pid=31 | GPT-4o AI enrichment (last resort) |
| **SERP** | pid=22 | Google/SERP web scraping |
| **Plaid** | pid=40 | Plaid identity verification |
| **Applicant/System** | pid=0 | Data submitted by the applicant on the onboarding form, or set by the system internally |
| **No vendor (default)** | pid=-1 | No vendor returned a value — this is the system default, not a real source |
| **Unknown source** | pid="" | The fact exists but its source metadata is missing |

**Confidence column:**
- `—` = no confidence score was stored (common for applicant-submitted data or calculated facts)
- `0.000–1.000` = vendor's confidence that this fact is correct for this business. Formula varies by vendor (e.g. Middesk: 0.15 + 0.20×tasks; OC/ZI/EFX: match.index/55)

**Why specific fields show "(not stored)":**

| Field | Why (not stored) | Who should provide it | Action |
|---|---|---|---|
| **DBA Found** | No vendor matched DBA names for this business. DBA requires Middesk to find the entity AND have DBA records. | Middesk (review tasks) | If Middesk confidence is low, DBA won't be found. Check middesk_confidence. |
| **Entity Type** | The `corporation` fact was not written. Usually comes from Middesk registration type or OC company_type. | Middesk or OC | Low vendor match rate → no entity type. |
| **Business Phone** | No vendor returned a phone number AND applicant didn't submit one. | ZoomInfo (zi_c_phone) or applicant | Check if ZoomInfo matched this business. |
| **Email** | Not collected at onboarding or not found by any vendor. | ZoomInfo or applicant form | Applicant may have skipped the field. |
| **Website Found** | `website_found` fact not written = SERP (pid=22) didn't find a matching web presence. | SERP / Google | SERP runs only after entity matching. If no entity match, SERP may not run. |

**Why "Unknown source" appears:**
The fact exists and has a value, but the `source.platformId` field in the JSON is empty or null. This happens when:
1. The fact was set by a pipeline step that didn't write source metadata
2. A manual override was applied without a source tag
3. The fact was migrated from an older system version that didn't track sources
                """)

            # Consistency: business_name vs legal_name
            bname = str(gv("business_name") or "").lower().strip()
            lname = str(gv("legal_name")    or "").lower().strip()
            if bname and lname:
                if bname == lname:
                    flag("Business name and legal name are identical — expected for most entities.", "green")
                elif bname in lname or lname in bname:
                    flag("Business name is a subset of legal name (or vice versa). "
                         "This is normal for DBAs — verify it matches what was submitted.", "blue")
                else:
                    flag(f"Business name ('{str(gv('business_name',''))[:40]}') differs significantly from "
                         f"legal name ('{str(gv('legal_name',''))[:40]}'). "
                         "Could be a DBA or a name discrepancy. TIN is verified against legal name.", "amber")

            # Formation date sanity
            fd = gv("formation_date")
            ye = gv("year_established")
            if fd and ye:
                try:
                    fd_year = int(str(fd)[:4])
                    ye_year = int(str(ye)[:4])
                    if abs(fd_year - ye_year) > 2:
                        flag(f"Formation date year ({fd_year}) differs from year_established ({ye_year}) by >2 years. "
                             "These should be the same year. May indicate different sources reporting differently.", "amber")
                    else:
                        flag(f"Formation date ({fd}) and year established ({ye}) are consistent.", "green")
                except Exception:
                    pass

        # ──────────────────────────────────────────────────────────────────────
        with tab_reg:
            st.markdown("#### 🏛️ Business Registration")
            reg_facts = [
                fact_row("sos_active",           "SOS Active"),
                fact_row("sos_match",            "SOS Name Match"),
                fact_row("sos_match_boolean",    "SOS Match (boolean)"),
                fact_row("formation_state",      "Formation State"),
                fact_row("tin",                  "TIN (EIN)"),
                fact_row("tin_submitted",        "TIN Submitted"),
                fact_row("tin_match",            "TIN Match (full object)"),
                fact_row("tin_match_boolean",    "TIN Match (boolean)"),
                fact_row("middesk_confidence",   "Middesk Confidence"),
                fact_row("address_registered_agent","Registered Agent Address"),
            ]
            styled_table(pd.DataFrame(reg_facts))

            st.markdown("##### SOS Analysis")
            mdsk_conf = gc("sos_match")
            oc_conf   = gc("sos_match_boolean") if gp("sos_match_boolean")=="OC" else 0.0
            sos_source = gp("sos_match")

            if sos_act=="false":
                flag("🚨 SOS INACTIVE. Entity cannot legally conduct business. "
                     "Check if this is a grace period or formal dissolution. "
                     "This is the #1 underwriting red flag — do NOT auto-approve.", "red")
            elif sos_act=="true":
                flag(f"✅ SOS Active. Winning vendor: {sos_source} (confidence: {mdsk_conf:.3f}).", "green")

            # TIN consistency
            st.markdown("##### TIN Consistency Check")
            tin_submitted_val = str(gv("tin_submitted") or "").lower()
            tin_match_obj = latest.get("tin_match",{}).get("value")
            tin_status_actual = ""
            tin_message = ""
            if isinstance(tin_match_obj, dict):
                tin_status_actual = tin_match_obj.get("status","").lower()
                tin_message       = tin_match_obj.get("message","")
            elif tin_match_obj:
                try:
                    obj = json.loads(str(tin_match_obj))
                    tin_status_actual = obj.get("status","").lower()
                    tin_message       = obj.get("message","")
                except Exception:
                    pass

            tin_consistency_checks = [
                ("TIN submitted",         tin_submitted_val not in ("","none","false","0"),
                 tin_submitted_val, "TIN field must be filled"),
                ("tin_match.status",      tin_status_actual in ("success","failure","pending"),
                 tin_status_actual or "(not set)", "Status must be one of success/failure/pending"),
                ("tin_match_boolean",     tin_bool in ("true","false"),
                 tin_bool, "Must be true or false"),
                ("Boolean matches status",tin_bool=="true" == (tin_status_actual=="success"),
                 f"bool={tin_bool}, status={tin_status_actual}",
                 "boolean=true ONLY when status=success (kyb/index.ts L488–490)"),
            ]
            rows_t = [{"Check":l,"Result":v,"Status":"✅ OK" if ok else "❌ ISSUE","Detail":d}
                      for l,ok,v,d in tin_consistency_checks]
            styled_table(pd.DataFrame(rows_t), color_col="Status",
                         palette={"✅ ok":"#22c55e","❌ issue":"#ef4444"})

            if tin_message:
                st.markdown(f"**Middesk TIN message:** `{tin_message}`")
                if "does not have a record" in tin_message.lower():
                    flag("TIN failure reason: IRS has no record for this EIN + name combination. "
                         "Could be wrong EIN, very new business, or name mismatch.", "amber")
                elif "associated with a different" in tin_message.lower():
                    flag("🚨 TIN failure reason: EIN is associated with a DIFFERENT business name. "
                         "High risk — possible fraud or EIN reuse.", "red")

        # ──────────────────────────────────────────────────────────────────────
        with tab_ident:
            st.markdown("#### 🪪 Identity (KYC / IDV)")
            ident_facts = [
                fact_row("idv_status",           "IDV Status (Plaid)"),
                fact_row("idv_passed",           "IDV Passed Count"),
                fact_row("idv_passed_boolean",   "IDV Passed (boolean)"),
                fact_row("name_match",           "Name Match (full)"),
                fact_row("name_match_boolean",   "Name Match (boolean)"),
                fact_row("address_match",        "Address Match (full)"),
                fact_row("address_match_boolean","Address Match (boolean)"),
                fact_row("address_verification", "Address Verification"),
                fact_row("address_verification_boolean","Address Verified (boolean)"),
                fact_row("addresses_deliverable","Address Deliverable"),
                fact_row("is_sole_prop",         "Is Sole Proprietor"),
                fact_row("verification_status",  "Verification Status (Trulioo)"),
            ]
            styled_table(pd.DataFrame(ident_facts))

            st.markdown("##### IDV Status Explanation")
            idv_status_raw = gv("idv_status")
            if isinstance(idv_status_raw, dict):
                for status_key, count in idv_status_raw.items():
                    meaning = IDV_STATUS_MEANINGS.get(status_key.upper(), ("❓","?","Unknown",""))
                    color = "#22c55e" if status_key.upper()=="SUCCESS" else ("#ef4444" if status_key.upper()=="FAILED" else "#f59e0b")
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                        border-radius:8px;padding:8px 14px;margin:3px 0;display:flex;gap:12px">
                      <span style="color:{color};font-weight:700">{meaning[0]} {status_key}: {count}</span>
                      <span style="color:#94A3B8;font-size:.78rem">{meaning[2]}</span>
                    </div>""", unsafe_allow_html=True)

            # Address consistency
            st.markdown("##### Address Consistency")
            addr_match  = str(gv("address_match_boolean") or "").lower()
            addr_verif  = str(gv("address_verification_boolean") or "").lower()
            addr_deliv  = str(gv("addresses_deliverable") or "").lower()
            addr_checks = [
                ("address_match_boolean",       addr_match=="true",   addr_match,  "Business name matches at this address"),
                ("address_verification_boolean",addr_verif=="true",   addr_verif,  "Address formally verified"),
                ("addresses_deliverable",        addr_deliv not in ("","none","false","0"), addr_deliv,
                 "Address is physically deliverable (USPS/postal check)"),
            ]
            rows_a = [{"Check":l,"Result":v,"Status":"✅ OK" if ok else "⚠️ Check","Detail":d}
                      for l,ok,v,d in addr_checks]
            styled_table(pd.DataFrame(rows_a), color_col="Status",
                         palette={"✅ ok":"#22c55e","⚠️ check":"#f59e0b"})

            if addr_match=="false" and tin_bool=="true":
                flag("⚠️ Interesting combination: TIN verified (name matches IRS) but address does NOT match "
                     "the registry at that address. Could indicate a business operating at a different location "
                     "than the registered address.", "amber")

        # ──────────────────────────────────────────────────────────────────────
        with tab_class:
            st.markdown("#### 🏭 Industry Classification")
            class_facts = [
                fact_row("naics_code",       "NAICS Code"),
                fact_row("naics_description","NAICS Description"),
                fact_row("industry",         "Industry Sector"),
                fact_row("mcc_code",         "MCC Code"),
                fact_row("mcc_description",  "MCC Description"),
                fact_row("website",          "Website URL"),
                fact_row("website_found",    "Website Found"),
                fact_row("serp_id",          "SERP ID (Google)"),
            ]
            styled_table(pd.DataFrame(class_facts))

            # NAICS source analysis
            naics_src = gp("naics_code")
            naics_conf= gc("naics_code")
            mcc_src   = gp("mcc_code")
            mcc_desc  = str(gv("mcc_description") or "")
            website   = str(gv("website") or "")
            web_found = str(gv("website_found") or "").lower()

            c1,c2,c3 = st.columns(3)
            with c1: kpi("NAICS Source", naics_src, "winning vendor",
                         "#22c55e" if naics_src in ("Middesk","OC","ZoomInfo","Equifax") else "#f59e0b")
            with c2: kpi("NAICS Confidence", f"{naics_conf:.3f}",
                         "0–1 scale","#22c55e" if naics_conf>0.70 else ("#f59e0b" if naics_conf>0.40 else "#ef4444"))
            with c3: kpi("MCC Source", mcc_src, "winning vendor","#3B82F6")

            # Consistency checks
            st.markdown("##### Classification Consistency Checks")
            consist = []

            if naics_val=="561499":
                consist.append(("NAICS is fallback (561499)",False,naics_val,
                                 "Entity not classified — check vendor match rates and website availability"))
            else:
                consist.append(("NAICS is real code",True,naics_val,"Classification succeeded"))

            if naics_src=="AI" and naics_val!="561499":
                consist.append(("AI won for real NAICS code",False,f"AI source, code={naics_val}",
                                 "AI weight=0.1 — should only win when all vendors failed. Verify code is correct"))
            elif naics_src in ("Middesk","OC","ZoomInfo","Equifax","Trulioo"):
                consist.append(("NAICS from trusted vendor",True,naics_src,"Strong source"))

            if website and naics_val=="561499":
                consist.append(("Website exists but NAICS is fallback",False,
                                 f"website={website[:40]}, naics=561499",
                                 "Gap G2: AI did not use web_search despite website being available"))
            elif website and naics_val!="561499":
                consist.append(("Website consistent with real NAICS",True,website[:40],"Good"))

            if "fallback" in mcc_desc.lower():
                consist.append(("MCC description is internal fallback text",False,mcc_desc[:60],
                                 "Gap G5: customer-visible internal debug text. Fix AI system prompt"))
            elif mcc_desc:
                consist.append(("MCC description present",True,mcc_desc[:60],"Good"))

            # NAICS ↔ MCC sector concordance for this business
            if naics_val and mcc_val and naics_val!="561499":
                sector = naics_val[:2]
                # Reuse the same concordance map defined in the Classification section
                _NSM = {"11":("Agriculture","0742,1711,5261"),"21":("Mining","5172,5983"),
                        "22":("Utilities","4900,4911,4931"),"23":("Construction","1520,1731,1740"),
                        "31":("Manufacturing","5065,5085,5169"),"32":("Manufacturing","5045,5065"),
                        "33":("Manufacturing","5040,5045,5065"),"42":("Wholesale","5040,5045,5085"),
                        "44":("Retail","5300,5411,5511,5651,5812"),"45":("Retail","5300,5411,5945"),
                        "48":("Transportation","4111,4121,4215,7512"),"49":("Warehousing","4215,4225"),
                        "51":("Information","4814,5045,5734,7372"),"52":("Finance","6011,6051,6211,6300"),
                        "53":("Real Estate","6512,6552,7349"),"54":("Professional","7372,7374,7389"),
                        "56":("Admin/Support","7389,7392,8742"),"61":("Education","8220,8249,8299"),
                        "62":("Healthcare","8011,8021,8049,8099"),"71":("Arts","7011,7922,7991"),
                        "72":("Food/Lodging","5812,5813,7011,7012"),"81":("Other Svcs","7210,7230,7261"),
                        "92":("Government","9211,9222,9399")}
                sector_info = _NSM.get(sector)
                if sector_info:
                    allowed = sector_info[1].split(",")
                    concordant = any(mcc_val[:2]==a[:2] for a in allowed)
                    consist.append((f"NAICS {naics_val} ↔ MCC {mcc_val} concordance",
                                    concordant,
                                    f"NAICS sector {sector} ({sector_info[0]}) vs MCC {mcc_val}",
                                    f"Expected MCC families: {sector_info[1]}" if not concordant else "Codes are concordant"))

            rows_c = [{"Check":l,"Result":v,"Status":"✅ OK" if ok else "⚠️ Issue","Detail":d}
                      for l,ok,v,d in consist]
            styled_table(pd.DataFrame(rows_c), color_col="Status",
                         palette={"✅ ok":"#22c55e","⚠️ issue":"#ef4444"})

        # ──────────────────────────────────────────────────────────────────────
        with tab_risk:
            st.markdown("#### ⚠️ Risk & Due Diligence")
            risk_facts = [
                fact_row("watchlist_hits",     "Watchlist Hits"),
                fact_row("watchlist",          "Watchlist (consolidated)"),
                fact_row("adverse_media_hits", "Adverse Media Hits"),
                fact_row("num_bankruptcies",   "# Bankruptcies"),
                fact_row("num_judgements",     "# Judgments"),
                fact_row("num_liens",          "# Liens"),
                fact_row("bankruptcies",       "Bankruptcies (detail)"),
            ]
            styled_table(pd.DataFrame(risk_facts))

            # Risk scorecard — use gv_scalar to avoid list/dict crash
            def _safe_count(name):
                v = gv_scalar(name, 0)
                try: return int(float(str(v) or "0"))
                except Exception: return 0

            wl_hits_n  = _safe_count("watchlist_hits")
            am_hits_n  = _safe_count("adverse_media_hits")
            bk_n       = _safe_count("num_bankruptcies")
            judg_n     = _safe_count("num_judgements")
            lien_n     = _safe_count("num_liens")

            c1,c2,c3,c4,c5 = st.columns(5)
            with c1: kpi("Watchlist",str(wl_hits_n),"hits","#ef4444" if wl_hits_n>0 else "#22c55e")
            with c2: kpi("Adverse Media",str(am_hits_n),"hits","#f59e0b" if am_hits_n>0 else "#22c55e")
            with c3: kpi("Bankruptcies",str(bk_n),"count","#8B5CF6" if bk_n>0 else "#22c55e")
            with c4: kpi("Judgments",str(judg_n),"count","#8B5CF6" if judg_n>0 else "#22c55e")
            with c5: kpi("Liens",str(lien_n),"count","#8B5CF6" if lien_n>0 else "#22c55e")

            risk_checks = []
            if wl_hits_n>0: risk_checks.append(f"🚨 {wl_hits_n} watchlist hit(s) — mandatory compliance review")
            else:            risk_checks.append("✅ No watchlist hits")
            if bk_n>0 and judg_n>0 and lien_n>0:
                risk_checks.append("🚨 All three public record types present (BK+Judgment+Lien) — worst financial profile")
            if bk_n>1:
                risk_checks.append(f"⚠️ Multiple bankruptcies ({bk_n}) — serial filing pattern")
            if bk_n==0 and judg_n==0 and lien_n==0 and wl_hits_n==0:
                risk_checks.append("✅ No public records or watchlist hits")
            for r in risk_checks:
                level = "red" if r.startswith("🚨") else ("amber" if r.startswith("⚠️") else "green")
                flag(r, level)

        # ──────────────────────────────────────────────────────────────────────
        with tab_worth:
            st.markdown("#### 💰 Worth Score Deep Dive")
            st.markdown(
                "A full causal analysis of this business's Worth Score — "
                "which factors drive it up or down, what combinations of facts create risk signals, "
                "and what the analyst should focus on to understand the score."
            )

            # ── Step 1: Fetch Worth Score from rds_manual_score_public ────────
            worth_sql = f"""
                SELECT bs.weighted_score_850  AS score_850,
                       bs.weighted_score_100  AS score_100,
                       bs.risk_level,
                       bs.score_decision,
                       bs.created_at
                FROM rds_manual_score_public.data_current_scores cs
                JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
                WHERE cs.business_id = '{bid}'
                ORDER BY bs.created_at DESC LIMIT 1
            """
            worth_df = run_query(worth_sql)

            # ── Step 2: Display score and context ─────────────────────────────
            if worth_df is not None and not worth_df.empty:
                score   = float(worth_df.iloc[0].get("score_850") or 0)
                score_100 = float(worth_df.iloc[0].get("score_100") or 0)
                risk_level = str(worth_df.iloc[0].get("risk_level") or "")
                decision   = str(worth_df.iloc[0].get("score_decision") or "")
                scored_at  = str(worth_df.iloc[0].get("created_at",""))[:16]

                risk_color = {"HIGH":"#ef4444","MODERATE":"#f59e0b","MEDIUM":"#f59e0b","LOW":"#22c55e"}.get(
                    risk_level.upper(), "#64748b")
                dec_color  = {"APPROVE":"#22c55e","FURTHER_REVIEW_NEEDED":"#f59e0b","DECLINE":"#ef4444"}.get(
                    decision, "#64748b")

                c1,c2,c3,c4 = st.columns(4)
                with c1: kpi("Worth Score (300–850)", f"{score:.0f}","Higher = less risk",
                             "#22c55e" if score>=650 else ("#f59e0b" if score>=500 else "#ef4444"))
                with c2: kpi("Score (0–100)",    f"{score_100:.0f}","Alternative scale",risk_color)
                with c3: kpi("Risk Level",        risk_level or "Unknown","",risk_color)
                with c4: kpi("Decision",          decision or "Unknown","",dec_color)

                st.caption(f"Scored at: {scored_at} · Source: `rds_manual_score_public.business_scores`")

                # Risk level badge meaning
                risk_badges = {
                    "LOW":      ("🟢","Score 650–850","Entity presents low financial risk. "
                                 "Public records clean, strong financials, established business.","✅ Standard approval flow"),
                    "MODERATE": ("🟡","Score 500–649","Moderate risk — some factors require attention. "
                                 "May have minor public records, thin financials, or newer business.","⚠️ Review flagged items before approving"),
                    "MEDIUM":   ("🟡","Score 500–649","Same as MODERATE.","⚠️ Review flagged items"),
                    "HIGH":     ("🔴","Score 300–499","High financial risk. "
                                 "May have bankruptcies, judgments, poor revenue, or other negative signals.","🚨 Manual underwriting required"),
                }
                badge_info = risk_badges.get(risk_level.upper(), ("⚫","Unknown","Score not yet computed or risk level not set.","Check scoring pipeline"))
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {risk_color};
                    border-radius:10px;padding:16px 20px;margin:10px 0">
                  <div style="font-size:1.2rem;font-weight:700;color:{risk_color}">{badge_info[0]} {risk_level} RISK — {badge_info[1]}</div>
                  <div style="color:#CBD5E1;font-size:.85rem;margin-top:8px">{badge_info[2]}</div>
                  <div style="color:#60A5FA;font-size:.80rem;margin-top:6px"><strong>Underwriting action:</strong> {badge_info[3]}</div>
                </div>""", unsafe_allow_html=True)

                decision_info = {
                    "APPROVE": ("✅","Approved","The Worth Score model determined this business meets the risk threshold for approval. "
                                "All major factors (public records, financials, entity confirmation) are within acceptable ranges."),
                    "FURTHER_REVIEW_NEEDED": ("🔍","Further Review Required","The model identified factors that require human review before a decision. "
                                "This is NOT a decline — it means the automated model is uncertain and a human analyst should evaluate the specific factors."),
                    "DECLINE": ("❌","Declined","The Worth Score model determined this business exceeds the risk threshold. "
                                "Significant negative signals (public records, financials, or entity confirmation failures) drove this decision."),
                }
                if decision in decision_info:
                    di = decision_info[decision]
                    st.markdown(f"**Score Decision: {di[0]} {di[1]}** — {di[2]}")

            else:
                flag(f"No Worth Score found for business `{bid}`. "
                     "This means either: (1) the business hasn't been scored yet, "
                     "(2) the score is in a different schema, or "
                     "(3) rds_manual_score_public is not accessible.", "amber")
                st.code(f"""-- Check directly in Redshift:
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 5;""", language="sql")
                score = None

            # ── Step 3: Factor Analysis from facts ───────────────────────────
            st.markdown("---")
            st.markdown("#### 🔬 Score Factor Analysis — What Drives This Score")
            st.markdown(
                "The Worth Score (v3.1) is an ensemble ML model using 100+ features across 5 categories. "
                "Below is a per-category analysis of the known factors for this business based on stored facts."
            )

            # Category 1: Public Records
            st.markdown("##### 📜 Public Records (most penalizing category)")
            bk_n   = _safe_int_gv("num_bankruptcies")
            judg_n = _safe_int_gv("num_judgements")
            lien_n = _safe_int_gv("num_liens")
            pr_checks = [
                ("# Bankruptcies",   bk_n,   bk_n==0,  "0 is ideal",
                 "Each bankruptcy reduces the score significantly. Age matters: BK < 2 years = highest penalty. "
                 "Model feature: `count_bankruptcy`, `age_bankruptcy` (months since filing)."),
                ("# Judgments",      judg_n, judg_n==0,"0 is ideal",
                 "Civil judgments indicate unpaid obligations. Recent judgments (< 1 year) have the highest impact. "
                 "Model feature: `count_judgment`, `age_judgment`."),
                ("# Liens",          lien_n, lien_n==0,"0 is ideal",
                 "Tax and financial liens. Federal tax liens (IRS) are the most severe. "
                 "Model feature: `count_lien`, `age_lien`."),
            ]
            pr_score = "🟢 Clean" if bk_n==0 and judg_n==0 and lien_n==0 else "🔴 Has Public Records"
            pr_color = "#22c55e" if bk_n==0 and judg_n==0 and lien_n==0 else "#ef4444"
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {pr_color};
                border-radius:8px;padding:12px 16px;margin:6px 0">
              <span style="color:{pr_color};font-weight:700">{pr_score}</span>
              <span style="color:#94A3B8;font-size:.78rem;margin-left:10px">
                BK: {bk_n} · Judgments: {judg_n} · Liens: {lien_n}</span>
            </div>""", unsafe_allow_html=True)
            for label,val,good,target,explanation in pr_checks:
                color = "#22c55e" if good else "#ef4444"
                icon  = "✅" if good else "❌"
                st.markdown(f"""<div style="background:#0F172A;border-left:3px solid {color};
                    border-radius:6px;padding:8px 14px;margin:3px 0;font-size:.80rem">
                  <span style="color:{color};font-weight:600">{icon} {label}: {val}</span>
                  <span style="color:#64748b;margin-left:8px">Target: {target}</span>
                  <div style="color:#94A3B8;margin-top:4px">{explanation}</div>
                </div>""", unsafe_allow_html=True)

            # Category 2: Company Profile / Firmographic
            st.markdown("##### 🏢 Company Profile (positive contributor when complete)")
            form_date_v = str(gv("formation_date") or "")
            yr_est_v    = str(gv("year_established") or "")
            num_emp_v   = gv("num_employees")
            naics_v     = str(gv("naics_code") or "")
            corp_v      = str(gv("corporation") or "")

            try: age_years = datetime.now(timezone.utc).year - int(str(form_date_v)[:4])
            except Exception: age_years = None

            profile_rows = []
            if age_years is not None:
                profile_rows.append(("Business Age", f"{age_years} years",
                    age_years>=2, "≥ 2 years",
                    f"Older businesses score higher. Model feature: `age_business` (months). "
                    f"{'✅ Established business — positive signal.' if age_years>=2 else '⚠️ Very new business — model penalizes for lack of track record.'}"))
            if naics_v:
                profile_rows.append(("NAICS Code", naics_v,
                    naics_v!="561499", "Real classification (not 561499)",
                    "NAICS drives the `naics6` model feature. Specific codes are better than 561499 (fallback). "
                    "Some NAICS codes carry higher inherent risk (e.g. cash-intensive businesses)."))
            if corp_v:
                profile_rows.append(("Entity Type", corp_v,
                    corp_v.lower() not in ("sole_prop","sole proprietorship"), "LLC/Corp preferred",
                    "Model feature: `bus_struct`. Corporations and LLCs score slightly better than sole proprietors "
                    "due to higher default legal protections and financial separation."))
            if num_emp_v and str(num_emp_v) not in ("","None","[too large"):
                try:
                    emp = int(float(str(num_emp_v)))
                    profile_rows.append(("# Employees", str(emp),
                        emp>=1, "≥ 1 employee",
                        f"Model feature: `count_employees`. "
                        f"{'Sole proprietor / no employees — less track record.' if emp==0 else 'Has employees — positive signal.'}"))
                except Exception:
                    pass

            for label,val,good,target,explanation in profile_rows:
                color = "#22c55e" if good else "#f59e0b"
                icon  = "✅" if good else "⚠️"
                st.markdown(f"""<div style="background:#0F172A;border-left:3px solid {color};
                    border-radius:6px;padding:8px 14px;margin:3px 0;font-size:.80rem">
                  <span style="color:{color};font-weight:600">{icon} {label}: {val}</span>
                  <span style="color:#64748b;margin-left:8px">Target: {target}</span>
                  <div style="color:#94A3B8;margin-top:4px">{explanation}</div>
                </div>""", unsafe_allow_html=True)

            # Category 3: Identity & Registry verification
            st.markdown("##### 🏛️ Identity & Registry (trust signals)")
            sos_act_v = str(gv("sos_active") or "").lower()
            tin_ok_v  = str(gv("tin_match_boolean") or "").lower()
            wl_hits_v = _safe_int_gv("watchlist_hits")

            identity_rows = [
                ("SOS Active", "Yes" if sos_act_v=="true" else "No",
                 sos_act_v=="true", "Active",
                 "Active SOS status = entity is in good legal standing with the state. "
                 "Inactive entities (missed annual reports, unpaid taxes) are penalized. "
                 "This is the #1 underwriting red flag when combined with a perpetual charter."),
                ("TIN Verified (IRS match)", "Yes" if tin_ok_v=="true" else "No",
                 tin_ok_v=="true", "Verified",
                 "IRS EIN match confirms the legal entity identity. "
                 "Unverified TIN indicates name/EIN mismatch — common source of underwriting concern."),
                ("Watchlist Hits", str(wl_hits_v),
                 wl_hits_v==0, "0 hits",
                 f"{'✅ No watchlist hits.' if wl_hits_v==0 else '🚨 ' + str(wl_hits_v) + ' watchlist hit(s). Sanctions/PEP hits directly penalize the score.'}"),
            ]
            for label,val,good,target,explanation in identity_rows:
                color = "#22c55e" if good else "#ef4444"
                icon  = "✅" if good else ("🚨" if not good and "hit" in label.lower() else "⚠️")
                st.markdown(f"""<div style="background:#0F172A;border-left:3px solid {color};
                    border-radius:6px;padding:8px 14px;margin:3px 0;font-size:.80rem">
                  <span style="color:{color};font-weight:600">{icon} {label}: {val}</span>
                  <span style="color:#64748b;margin-left:8px">Target: {target}</span>
                  <div style="color:#94A3B8;margin-top:4px">{explanation}</div>
                </div>""", unsafe_allow_html=True)

            # Category 4: Financial Signals
            st.markdown("##### 💵 Financial Signals (from Plaid / accounting data)")
            rev_v = gv("revenue")
            flag("Financial model features (revenue, cash flow, financial ratios) come from Plaid-connected "
                 "bank accounts and accounting integrations. If the business did not connect Plaid, these features "
                 "are imputed to 0 in the model — which is neutral, not penalizing.", "blue")

            if rev_v and str(rev_v) not in ("","None","[too large"):
                try:
                    rev = float(str(rev_v).replace(",",""))
                    color = "#22c55e" if rev>50000 else ("#f59e0b" if rev>10000 else "#ef4444")
                    st.markdown(f"""<div style="background:#0F172A;border-left:3px solid {color};
                        border-radius:6px;padding:8px 14px;margin:3px 0;font-size:.80rem">
                      <span style="color:{color};font-weight:600">💵 Revenue: ${rev:,.0f}</span>
                      <div style="color:#94A3B8;margin-top:4px">Model feature: `revenue`. Higher revenue = higher score capacity. 
                      Ratios (gross margin, debt/equity, return on assets) are derived from revenue + financial statements.</div>
                    </div>""", unsafe_allow_html=True)
                except Exception:
                    st.caption("Revenue: could not parse value")
            else:
                st.markdown("""<div style="background:#0F172A;border-left:3px solid #64748b;
                    border-radius:6px;padding:8px 14px;margin:3px 0;font-size:.80rem">
                  <span style="color:#64748b;font-weight:600">💵 Revenue: Not available</span>
                  <div style="color:#94A3B8;margin-top:4px">No revenue data found. Model uses imputed value (0). 
                  This is neutral — the model was trained on businesses without connected financials. 
                  Connecting Plaid or accounting data could improve the score if financials are strong.</div>
                </div>""", unsafe_allow_html=True)

            # Category 5: Score Improvement Opportunities
            st.markdown("---")
            st.markdown("#### 💡 Score Improvement Opportunities")
            st.markdown("*Based on the facts available for this business, these are the highest-leverage changes:*")

            improvements = []

            if sos_act_v=="false":
                improvements.append(("🔴 CRITICAL","Reinstate SOS filing",
                    "SOS inactive status is the strongest negative signal in the model. "
                    "Reinstating the entity with the state (filing missing annual reports, paying fees) "
                    "would remove this penalty immediately.","Contact state SOS to reinstate"))

            if tin_ok_v!="true":
                improvements.append(("🔴 HIGH","Fix TIN verification",
                    "TIN failure (EIN-name mismatch) signals identity uncertainty to the model. "
                    "Correcting the submitted EIN or legal name to match IRS records would resolve this.","Resubmit with correct EIN and exact legal name"))

            if wl_hits_v>0:
                improvements.append(("🔴 HIGH","Resolve watchlist hits",
                    f"{wl_hits_v} watchlist hit(s) are penalizing the score. "
                    "Review each hit to determine if it's a false positive (name collision) or true match.","Request watchlist review — pull metadata for each hit"))

            if bk_n>0:
                improvements.append(("🟡 MEDIUM",f"Address {bk_n} bankruptcy filing(s)",
                    "Bankruptcies reduce the score proportionally to count and recency. "
                    "Filed >7 years ago: impact is minimal. Filed <2 years: significant penalty.","No immediate fix — score improves as bankruptcy ages"))

            if naics_v=="561499":
                improvements.append(("🟡 MEDIUM","Correct NAICS classification",
                    "NAICS 561499 (fallback) suggests the industry couldn't be determined. "
                    "A correct NAICS code allows the model to use industry-specific benchmarks.","Request an analyst NAICS override with the correct 6-digit code"))

            if improvements:
                for priority, title, explanation, action in improvements:
                    color = "#ef4444" if "CRITICAL" in priority or "HIGH" in priority else "#f59e0b"
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                        border-radius:8px;padding:12px 16px;margin:8px 0">
                      <div style="color:{color};font-weight:700;font-size:.88rem">{priority} — {title}</div>
                      <div style="color:#CBD5E1;font-size:.80rem;margin-top:6px">{explanation}</div>
                      <div style="color:#60A5FA;font-size:.77rem;margin-top:6px"><strong>Action:</strong> {action}</div>
                    </div>""", unsafe_allow_html=True)
            else:
                flag("✅ No obvious score improvement opportunities identified based on available facts. "
                     "If the score is lower than expected, financial data (Plaid connection) "
                     "or economic indicators may be the primary driver.", "green")

            # Causal Analysis Summary
            analyst_card("Worth Score — Causal Analysis Summary", [
                "The Worth Score (300–850) is built by an ensemble of 3 sub-models: "
                "(1) Firmographic XGBoost (entity age, NAICS, structure, size), "
                "(2) Financial neural network (revenue, cash flow, ratios from Plaid), "
                "(3) Economic model (macro indicators: Fed rates, unemployment, VIX, GDP). "
                "The three are combined via an ensemble layer and calibrated to 300–850.",
                "Public records (BK/Judgment/Lien) are the MOST penalizing category. "
                "A single recent bankruptcy can reduce the score by 50–150 points. "
                "The model uses both count AND age — older records have less impact.",
                "SOS inactive + TIN failed combination is the #1 identity risk signal. "
                "If both are present, the score is typically <500 (HIGH risk). "
                "These are binary flags — fixing one removes its full penalty immediately.",
                "Missing financial data (no Plaid connection) is imputed to 0 — NEUTRAL. "
                "It does not directly penalize the score, but it means the model cannot "
                "use positive financial signals (strong revenue, healthy cash flow) to improve it.",
                "The score_decision (APPROVE/FURTHER_REVIEW/DECLINE) is set by a calibrated "
                "threshold on the raw model probability. These thresholds are customer-configurable "
                "and represent the risk appetite of the underwriter.",
                "Worth Score source: `rds_manual_score_public.business_scores` (RDS PostgreSQL). "
                "Joined via `data_current_scores` for the latest score per business. "
                "`score_status` column does not exist in this schema version.",
            ])

            st.code(f"""-- Get full score history for this business:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level,
       bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 10;

-- Get score factor contributions (SHAP-equivalent):
SELECT * FROM rds_manual_score_public.business_score_factors
WHERE score_id IN (
    SELECT score_id FROM rds_manual_score_public.data_current_scores
    WHERE business_id = '{bid}'
) LIMIT 50;

-- Score audit fill rates (what data was available for scoring):
SELECT * FROM warehouse.worth_score_input_audit
ORDER BY score_date DESC LIMIT 3;""", language="sql")

        # ──────────────────────────────────────────────────────────────────────
        with tab_anomaly:
            st.markdown("#### 🔗 Cross-Field Anomaly Detection")
            st.markdown(
                "Checks for unusual *relationships between fields* — individually acceptable values "
                "that are suspicious **in combination**. Even if each field looks normal alone, "
                "certain combinations are statistically rare or logically inconsistent."
            )
            flag("All 20+ checks run automatically. If 'No anomalies' appears, it means "
                 "this specific business passed all checks — not that the pipeline is perfect. "
                 "The checks are bounded by what facts are stored.", "blue")

            anomalies = []

            # Pull additional context facts needed for richer checks
            addr_match_b   = str(gv("address_match_boolean")        or "").lower()
            addr_verif_b   = str(gv("address_verification_boolean") or "").lower()
            addr_deliv     = str(gv("addresses_deliverable")        or "").lower()
            name_match_b   = str(gv("name_match_boolean")           or "").lower()
            naics_desc_val = str(gv("naics_description")            or "").lower()
            mcc_desc_lower = mcc_desc.lower()
            primary_addr   = gv("primary_address") or {}
            if isinstance(primary_addr, dict):
                addr_state = str(primary_addr.get("state","") or "").upper()
            else:
                addr_state = ""
            form_state = str(gv("formation_state") or "").upper()
            form_date  = str(gv("formation_date")  or "")
            num_emp    = gv("num_employees")
            revenue_v  = gv("revenue")
            is_sole    = str(gv("is_sole_prop") or "").lower()

            # ── 1. SOS active vs TIN failed ───────────────────────────────────
            if sos_act=="true" and tin_status_actual=="failure":
                anomalies.append(("🟡 MEDIUM","SOS Active + TIN Failed",
                    "Entity is registered and active (SOS confirms it exists and is in good standing) "
                    "BUT the EIN submitted does not match the legal name per IRS records. "
                    "This is a contradiction: the state knows this entity but the IRS EIN link is broken. "
                    "Most likely cause: business submitted its DBA (trade) name instead of the exact legal name "
                    "on the EIN registration. Even a difference like 'LLC' vs 'L.L.C.' fails IRS matching. "
                    "Action: ask applicant to resubmit using the EXACT legal name on their EIN certificate.",
                    "sos_active=true AND tin_match.status=failure"))

            # ── 2. SOS inactive vs TIN verified ──────────────────────────────
            if sos_act=="false" and tin_bool=="true":
                anomalies.append(("🔴 HIGH","SOS Inactive + TIN Verified — perpetual+inactive risk",
                    "EIN matches IRS records (TIN verified) BUT the entity is NOT in good standing with the state. "
                    "This means the legal entity exists (it has a valid EIN) but cannot legally conduct business "
                    "because of a state compliance failure (missed annual report, unpaid franchise tax, etc.). "
                    "This is the #1 underwriting red flag: a perpetual entity that is administratively inactive. "
                    "Action: route to manual underwriting. Request state reinstatement certificate before approval.",
                    "sos_active=false AND tin_match_boolean=true"))

            # ── 3. Website exists but NAICS = 561499 ─────────────────────────
            if website and naics_val=="561499":
                anomalies.append(("🔴 HIGH","Website URL exists but NAICS is 561499 (Gap G2 confirmed)",
                    f"This business has website URL '{website[:50]}' stored in the system, "
                    "but received NAICS 561499 (the catch-all fallback meaning 'could not classify'). "
                    "The AI enrichment (aiNaicsEnrichment.ts) should have performed a web_search using this URL "
                    "to determine the industry. The fact that it still returned 561499 confirms Gap G2: "
                    "web_search is only enabled when params.website is passed to the AI function, "
                    "and for this record it was not. The website content was never analyzed. "
                    "Action: check integration-service aiNaicsEnrichment.ts getPrompt() — verify params.website was set.",
                    f"website={website[:40]}, naics_code=561499"))

            # ── 4. No website, no DBA, no NAICS → completely dark entity ─────
            dba_val = gv("dba_found")
            if not website and not dba_val and naics_val=="561499" and sos_act!="false":
                anomalies.append(("🟡 MEDIUM","Entity has no web presence, no DBA, and no NAICS — completely dark",
                    "This business has: no website URL, no DBA name found, and received the NAICS 561499 fallback. "
                    "This is a 'dark entity' — it has an SOS registration but no discoverable public footprint. "
                    "This is the most common legitimate cause of NAICS fallback (Gap G1+G3 combined). "
                    "It is also a common characteristic of shell companies or holding entities. "
                    "It is NOT automatically fraud, but it requires additional due diligence. "
                    "Action: request business description from applicant; check for any Google Maps/SERP presence manually.",
                    "website=(empty), dba_found=(empty), naics_code=561499"))

            # ── 5. NAICS from AI but website exists ──────────────────────────
            if naics_src=="AI" and naics_val!="561499" and website:
                anomalies.append(("🟡 MEDIUM","NAICS from AI despite website being available — SERP should have won",
                    f"NAICS {naics_val} was provided by AI (weight=0.1), but this business has a website. "
                    "SERP (pid=22, weight=0.3) should have classified the industry from the website and "
                    "beaten AI in the Fact Engine. That SERP didn't win suggests either: "
                    "(1) SERP ran but returned no classification, or "
                    "(2) SERP's classification confidence was still below AI's for some reason. "
                    "Since AI has a lower weight, this is unexpected and the code may be correct. "
                    "But verify: the NAICS should match what's on the website.",
                    f"naics_source=AI, website={website[:40]}, expected_winner=SERP(pid=22)"))

            # ── 6. NAICS description inconsistent with NAICS code ────────────
            if naics_val and naics_val!="561499" and naics_desc_val:
                # Check if description mentions a very different sector than what the code suggests
                sector = naics_val[:2]
                sector_keywords = {
                    "72":["restaurant","food","lodging","hotel","hospitality"],
                    "54":["consulting","legal","accounting","professional","tech"],
                    "62":["health","medical","dental","care","clinic"],
                    "44":["retail","store","shop","clothing"],
                    "52":["finance","bank","insurance","investment"],
                    "81":["repair","maintenance","salon","beauty","gym"],
                }
                expected_kws = sector_keywords.get(sector,[])
                if expected_kws and not any(kw in naics_desc_val for kw in expected_kws):
                    if website and any(kw in website.lower() for kw in expected_kws):
                        anomalies.append(("🟡 MEDIUM","NAICS description doesn't match website domain keywords",
                            f"NAICS {naics_val} (sector {sector}) has description '{naics_desc_val[:60]}' "
                            f"but the website URL '{website[:40]}' suggests a different industry. "
                            "This may indicate the vendor matched on name but assigned the wrong NAICS. "
                            "Action: verify the NAICS code against the actual business activity.",
                            f"naics_code={naics_val}, naics_description={naics_desc_val[:40]}, website={website[:40]}"))

            # ── 7. Formation state vs operating state mismatch ───────────────
            if form_state and addr_state and form_state!=addr_state:
                is_tax_haven = form_state in ("DE","NV","WY","FL")
                if is_tax_haven:
                    anomalies.append(("🟠 NOTICE",
                        f"Incorporated in {form_state} (tax-haven state) but operating address is in {addr_state}",
                        f"Business was formed in {form_state} (a common tax-optimization state) "
                        f"but the primary address is in {addr_state}. "
                        "This is LEGAL and very common for LLCs and corporations (Delaware especially). "
                        "It is worth noting as it increases complexity of SOS verification: "
                        "Middesk must check both states. "
                        "Anomaly: if the SOS filing shows 'foreign' entity type in the operating state, "
                        "this is expected. If it shows 'domestic' in both states, that's unusual.",
                        f"formation_state={form_state}, primary_address.state={addr_state}"))
                else:
                    anomalies.append(("🟠 NOTICE",
                        f"Formation state ({form_state}) differs from operating state ({addr_state})",
                        f"Business incorporated in {form_state} but operates in {addr_state}. "
                        "Not inherently suspicious, but verify the business is registered as a "
                        f"foreign entity in {addr_state} if required by that state.",
                        f"formation_state={form_state}, primary_address.state={addr_state}"))

            # ── 8. AI won NAICS with very low confidence ──────────────────────
            if naics_src=="AI" and naics_conf<0.20 and naics_val!="561499":
                anomalies.append(("🟡 MEDIUM","AI won NAICS with very low confidence — possible hallucination",
                    f"AI (pid=31, weight=0.1) won the NAICS fact with confidence {naics_conf:.3f}. "
                    f"This means all other vendors (Middesk, OC, ZI, EFX, Trulioo) failed to match this entity, "
                    "leaving AI as the only source. AI selected NAICS {naics_val} from the business name/address alone. "
                    "With no website and no vendor match, the AI is essentially guessing. "
                    "The lower the confidence, the more likely this is a hallucination. "
                    "Action: verify NAICS {naics_val} actually matches this business's actual activity.",
                    f"naics_source=AI, naics_confidence={naics_conf:.3f}, naics_code={naics_val}"))

            # ── 9. Website found but SERP didn't store URL ───────────────────
            if not website and web_found=="true":
                anomalies.append(("🟡 MEDIUM","website_found=true but no website URL stored — SERP pipeline gap",
                    "The `website_found` fact is true, meaning SERP (Google scraping) detected a web presence "
                    "for this business. However, the `website` fact (the actual URL) was never stored. "
                    "This is a pipeline gap: the URL should have been extracted from the SERP result "
                    "and stored as the `website` fact. Because the URL is missing, the AI enrichment "
                    "could not perform a web_search on the actual content. "
                    "Action: check SERP integration in integration-service — why wasn't the URL extracted?",
                    "website_found=true, website=(not stored)"))

            # ── 10. IDV passed but name match failed ──────────────────────────
            if idv_val=="true" and name_match_b=="false":
                if is_sole=="true":
                    anomalies.append(("🟠 NOTICE","IDV Passed + Name Match Failed (sole prop pattern)",
                        "Identity verification confirmed the owner's personal identity (Plaid IDV), "
                        "but the BUSINESS name doesn't match what's in the registry. "
                        "Since this is flagged as a sole proprietor, this is EXPECTED: "
                        "Plaid verified the person (e.g. 'John Smith') but the business name "
                        "('Smith's Auto Repair LLC') appears differently in the SOS registry. "
                        "Action: confirm the sole prop is operating under this DBA — low risk.",
                        "idv_passed_boolean=true, name_match_boolean=false, is_sole_prop=true"))
                else:
                    anomalies.append(("🟡 MEDIUM","IDV Passed + Name Match Failed (non-sole-prop)",
                        "Identity verification confirmed the owner's personal identity, "
                        "but the BUSINESS name doesn't match the registry. "
                        "For a non-sole-proprietor, this is more concerning: the business has a formal legal name "
                        "but it doesn't match what's in the SOS registry. "
                        "Could indicate: name recently changed, DBA operating under different name, "
                        "or the wrong business was matched by the vendor. "
                        "Action: request documentation showing the connection between applicant and business.",
                        "idv_passed_boolean=true, name_match_boolean=false, is_sole_prop≠true"))

            # ── 11. TIN boolean/status inconsistency (code bug) ───────────────
            if tin_bool=="true" and tin_status_actual not in ("success",""):
                anomalies.append(("🔴 HIGH","DATA INTEGRITY BUG: tin_match_boolean contradicts tin_match.status",
                    f"tin_match_boolean=true BUT tin_match.status='{tin_status_actual}'. "
                    "The boolean MUST be derived ONLY from status==='success' per kyb/index.ts L488–490. "
                    "This inconsistency means the derivation logic is broken or was applied to different data. "
                    "Impact: the Admin Portal shows TIN as 'Verified' even though the IRS check did not succeed. "
                    "Action: this is a code defect — file a P0 bug report for integration-service team. "
                    "Until fixed, do not trust the tin_match_boolean fact for this business.",
                    f"tin_match_boolean=true, tin_match.status={tin_status_actual}"))

            # ── 12. Old business with 561499 ──────────────────────────────────
            if naics_val=="561499" and form_date:
                try:
                    form_year = int(form_date[:4])
                    age_years = datetime.now(timezone.utc).year - form_year
                    if age_years > 3:
                        anomalies.append(("🟡 MEDIUM",
                            f"Established business ({age_years}y old) still has NAICS 561499 fallback",
                            f"Business formed in {form_year} ({age_years} years ago) — this is NOT a new incorporation. "
                            "For an established business, NAICS 561499 indicates vendor data is stale or absent. "
                            "ZI/EFX bulk data should have records for any business > 2 years old. "
                            "If vendors have no record: either the business changed its legal name, "
                            "moved states, or operates in a cash-only industry with minimal public presence. "
                            "Action: manually verify the industry. Consider an analyst NAICS override.",
                            f"formation_date={form_date}, age={age_years}y, naics_code=561499"))
                except Exception:
                    pass

            # ── 13. Fallback MCC description customer-visible ─────────────────
            if "fallback" in mcc_desc_lower or "per instructions" in mcc_desc_lower:
                anomalies.append(("🟠 NOTICE","Internal debug text visible in MCC description (Gap G5)",
                    f"mcc_description value: '{mcc_desc[:100]}'. "
                    "This is an internal system message generated by the AI enrichment prompt, "
                    "not a real MCC description. It is visible to customers in the Admin Portal "
                    "KYB → Background tab → MCC Description field. "
                    "This reveals internal pipeline implementation details to the customer. "
                    "Action: update aiNaicsEnrichment.ts system prompt to output "
                    "'Industry classification pending' instead of the debug message.",
                    "mcc_description contains 'fallback'"))

            # ── 14. Address not deliverable but address match = true ──────────
            if addr_match_b=="true" and addr_deliv=="false":
                anomalies.append(("🟡 MEDIUM","Address matched registry but is NOT deliverable (USPS check failed)",
                    "The business address matches what's in the SOS registry (address_match=true), "
                    "but the USPS deliverability check returned false (addresses_deliverable=false). "
                    "This means: the address is legally registered but mail cannot be delivered there. "
                    "Common causes: PO Box used instead of physical address, building demolished/renumbered, "
                    "or commercial mail receiving agency (CMRA) address. "
                    "Concern: if the business cannot receive mail at its registered address, "
                    "any physical documents or notices cannot be served. "
                    "Action: request a physical address confirmation from the applicant.",
                    "address_match_boolean=true, addresses_deliverable=false"))

            # ── 15. No address match AND no name match ────────────────────────
            if addr_match_b=="false" and name_match_b=="false" and sos_act=="true":
                anomalies.append(("🟡 MEDIUM","SOS Active but NEITHER name NOR address matched",
                    "The entity is active in the SOS registry, but: "
                    "(1) the submitted name doesn't match the registry name, AND "
                    "(2) the submitted address doesn't match the registry address. "
                    "Both key identifiers are mismatched. This suggests the vendor matched the entity "
                    "by a partial/fuzzy criterion but the submitted data is significantly different from the filing. "
                    "Could indicate: business recently moved and changed name, "
                    "or the vendor matched the wrong entity. "
                    "Action: pull the actual SOS filing and compare manually.",
                    "sos_active=true AND address_match_boolean=false AND name_match_boolean=false"))

            # ── 16. High revenue but no employees ────────────────────────────
            if revenue_v and num_emp:
                try:
                    rev = float(str(revenue_v).replace(",",""))
                    emp = float(str(num_emp).replace(",",""))
                    if rev > 1_000_000 and emp < 2:
                        anomalies.append(("🟠 NOTICE","High revenue but very few employees — unusual for operating business",
                            f"Revenue: ${rev:,.0f} | Employees: {emp:.0f}. "
                            "A business reporting >$1M revenue with fewer than 2 employees is unusual "
                            "for most business types. This pattern is more common for: "
                            "(1) Holding companies or investment entities (normal), "
                            "(2) Sole proprietors with contractors (normal), "
                            "(3) Revenue-per-employee ratio error in vendor data (investigate). "
                            f"Cross-check: NAICS is {naics_val}. For this industry, "
                            "does high revenue + low employees make sense? "
                            "Action: verify revenue source (accounting data vs vendor estimate).",
                            f"revenue={rev:,.0f}, num_employees={emp:.0f}, naics={naics_val}"))
                except Exception:
                    pass

            # ── 17. No TIN submitted but TIN verified ─────────────────────────
            tin_submitted_val = str(gv("tin_submitted") or "").lower()
            if tin_submitted_val in ("false","0","") and tin_bool=="true":
                anomalies.append(("🔴 HIGH","TIN not submitted but tin_match_boolean=true — impossible combination",
                    "tin_submitted=false (applicant did not provide an EIN) "
                    "but tin_match_boolean=true (TIN is verified). "
                    "This is logically impossible: you cannot verify a TIN that was never submitted. "
                    "This indicates a data integrity issue in the pipeline. "
                    "The tin_match_boolean fact may be stale from a previous submission, "
                    "or the tin_submitted fact may have been reset incorrectly. "
                    "Action: check the timestamps on both facts. If tin_match_boolean is older, "
                    "it may be correct but tin_submitted was reset by a form re-submission.",
                    "tin_submitted=false, tin_match_boolean=true"))

            # ── 18. Watchlist hits but no sanctions ───────────────────────────
            def _safe_int_gv(name):
                v = gv(name)
                if v is None: return 0
                try: return int(float(str(v)))
                except Exception: return 0

            if wl_hits>0:
                sanctions_val = _safe_int_gv("sanctions_hits")
                pep_val       = _safe_int_gv("pep_hits")
                if sanctions_val==0 and pep_val==0:
                    anomalies.append(("🟠 NOTICE","Watchlist hits but no sanctions or PEP flags",
                        f"{wl_hits} watchlist hit(s) found, but none are classified as SANCTIONS or PEP. "
                        "The consolidated watchlist fact (pid=16 Middesk or pid=38 Trulioo) tracks: "
                        "SANCTIONS, PEP, and other list types (adverse media is excluded). "
                        "Non-sanctions/non-PEP hits may come from: law enforcement watchlists, "
                        "industry-specific exclusion lists, or other compliance databases. "
                        "These are lower severity than OFAC sanctions but still require review. "
                        "Action: pull the watchlist metadata to see the exact list type and entity match.",
                        f"watchlist_hits={wl_hits}, sanctions_hits=0, pep_hits=0"))

            # ── 19. Sole prop but corporation entity type ─────────────────────
            corp_val = str(gv("corporation") or "").lower()
            if is_sole=="true" and corp_val and "corp" in corp_val:
                anomalies.append(("🟡 MEDIUM","is_sole_prop=true but entity type suggests corporation",
                    f"is_sole_prop=true but the entity type field shows: '{gv('corporation')}'. "
                    "A sole proprietorship and a corporation are mutually exclusive legal structures. "
                    "This contradiction may mean: "
                    "(1) The is_sole_prop fact was set based on TIN logic (SSN vs EIN), "
                    "not the actual legal entity type, OR "
                    "(2) The business changed structure after onboarding. "
                    "Action: verify the SOS filing — what is the actual registered entity type?",
                    f"is_sole_prop=true, corporation={gv('corporation')}"))

            # ── 20. Check all facts sourced from pid=0 or Unknown ─────────────
            facts_pid0 = [row["name"] for _,row in facts_df.iterrows()
                          if str(_safe_get(_parse_fact(row["value"]),"source","platformId",default="")) in ("0","-1","")]
            if len(facts_pid0) > 5:
                anomalies.append(("🟠 NOTICE",
                    f"{len(facts_pid0)} facts have no vendor source (pid=0/-1/empty)",
                    "These facts were set by the applicant onboarding form or by a system default, "
                    "not confirmed by any external vendor. "
                    f"Fields: {', '.join(facts_pid0[:8])}{'...' if len(facts_pid0)>8 else ''}. "
                    "This is normal for submitted data (business_name, primary_address, etc.) "
                    "but unusual for derived facts (naics_code, sos_active, tin_match). "
                    "Action: verify which of these should have vendor confirmation and why they don't.",
                    f"{len(facts_pid0)} facts without vendor source"))

            # ── Render results ────────────────────────────────────────────────
            if not anomalies:
                flag("✅ No cross-field anomalies detected for this business across all 20 checks.", "green")
                st.markdown("""
**What was checked:**
The following 20 relationship checks were evaluated. All passed for this business:

| # | Check | Fields evaluated |
|---|---|---|
| 1 | SOS Active + TIN Failed | sos_active, tin_match.status |
| 2 | SOS Inactive + TIN Verified (perpetual risk) | sos_active, tin_match_boolean |
| 3 | Website exists + NAICS 561499 (Gap G2) | website, naics_code |
| 4 | Dark entity (no website, no DBA, no NAICS) | website, dba_found, naics_code |
| 5 | AI won NAICS despite website (SERP should win) | naics_source, website |
| 6 | NAICS description vs website domain mismatch | naics_code, naics_description, website |
| 7 | Formation state vs operating state (tax haven) | formation_state, primary_address.state |
| 8 | AI hallucination risk (very low conf, real code) | naics_source, naics_confidence |
| 9 | website_found=true but URL not stored | website_found, website |
| 10 | IDV passed + name match failed (sole prop check) | idv_passed_boolean, name_match_boolean, is_sole_prop |
| 11 | TIN boolean contradicts status (code bug) | tin_match_boolean, tin_match.status |
| 12 | Established business (>3y) with NAICS fallback | formation_date, naics_code |
| 13 | Fallback MCC description customer-visible | mcc_description |
| 14 | Address matches registry but not deliverable | address_match_boolean, addresses_deliverable |
| 15 | SOS Active + both name AND address mismatched | sos_active, name_match_boolean, address_match_boolean |
| 16 | High revenue with very few employees | revenue, num_employees, naics_code |
| 17 | TIN not submitted but boolean=true (impossible) | tin_submitted, tin_match_boolean |
| 18 | Watchlist hits but no sanctions/PEP | watchlist_hits, sanctions_hits, pep_hits |
| 19 | Sole prop + corporation entity type contradiction | is_sole_prop, corporation |
| 20 | Many facts with no vendor source | all facts, source.platformId |
                """)
            else:
                priority_order = {"🔴 HIGH":0,"🟡 MEDIUM":1,"🟠 NOTICE":2}
                anomalies.sort(key=lambda x: priority_order.get(x[0],3))
                n_high   = sum(1 for a in anomalies if a[0]=="🔴 HIGH")
                n_medium = sum(1 for a in anomalies if a[0]=="🟡 MEDIUM")
                n_notice = sum(1 for a in anomalies if a[0]=="🟠 NOTICE")
                c1,c2,c3 = st.columns(3)
                with c1: kpi("🔴 HIGH",f"{n_high}","require immediate action","#ef4444" if n_high else "#22c55e")
                with c2: kpi("🟡 MEDIUM",f"{n_medium}","investigate within 24h","#f59e0b" if n_medium else "#22c55e")
                with c3: kpi("🟠 NOTICE",f"{n_notice}","review at next check","#f97316" if n_notice else "#22c55e")

                for severity,title,explanation,fields in anomalies:
                    color = {"🔴 HIGH":"#ef4444","🟡 MEDIUM":"#f59e0b","🟠 NOTICE":"#f97316"}.get(severity,"#64748b")
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                        border-radius:8px;padding:14px 18px;margin:10px 0">
                      <div style="color:{color};font-weight:700;font-size:.88rem">{severity} — {title}</div>
                      <div style="color:#CBD5E1;font-size:.80rem;margin-top:8px;line-height:1.6">{explanation}</div>
                      <div style="color:#475569;font-size:.73rem;margin-top:6px;font-family:monospace">
                        Fields checked: {fields}</div>
                    </div>""", unsafe_allow_html=True)

        # ──────────────────────────────────────────────────────────────────────
        with tab_all:
            st.markdown("#### 📋 All Stored Facts — Grouped by KYB Category")
            st.markdown("Facts are grouped by the KYB domain they belong to. "
                        "Each group matches a sub-tab in the Admin Portal.")

            # Group definitions — each fact maps to a category
            FACT_GROUPS = {
                "🏢 Identity / Name": [
                    "business_name","legal_name","names","names_found","names_submitted",
                    "dba_found","people","kyb_submitted","external_id","customer_ids"
                ],
                "🏛️ Registry / SOS": [
                    "sos_filings","sos_active","sos_match","sos_match_boolean",
                    "formation_date","formation_state","year_established","corporation",
                    "middesk_confidence","middesk_id"
                ],
                "🔐 TIN / EIN": [
                    "tin","tin_submitted","tin_match","tin_match_boolean","is_sole_prop"
                ],
                "📍 Address / Location": [
                    "primary_address","primary_address_string","primary_city","mailing_address",
                    "mailing_address_strings","addresses","addresses_submitted",
                    "addresses_found","address_match","address_match_boolean",
                    "address_verification","address_verification_boolean",
                    "addresses_deliverable","address_registered_agent",
                    "business_addresses_submitted","business_addresses_submitted_strings",
                    "city","state"
                ],
                "📞 Contact": [
                    "business_phone","phone_found","email","stock_symbol","countries"
                ],
                "🌐 Website / Digital": [
                    "website","website_found","serp_id","all_google_place_ids",
                    "review_rating","review_count","google_review_count","google_review_rating"
                ],
                "🏭 Industry / Classification": [
                    "naics_code","naics_description","mcc_code","mcc_description",
                    "industry","classification_codes","revenue_confidence"
                ],
                "💼 Firmographic": [
                    "num_employees","revenue","net_income","revenue_equally_weighted_average",
                    "revenue_all_sources","minority_owned","woman_owned","veteran_owned"
                ],
                "🪪 Identity Verification (KYC)": [
                    "idv_status","idv_passed","idv_passed_boolean","idv_status",
                    "name_match","name_match_boolean","verification_status"
                ],
                "📊 Financial Ratios (Worth Score inputs)": [
                    "bs_total_liabilities_and_equity","ratio_operating_margin","flag_equity_negative",
                    "ratio_income_quality_ratio","bs_accounts_payable","ratio_gross_margin",
                    "flag_total_liabilities_over_assets","is_operating_expense","ratio_return_on_assets",
                    "bs_total_liabilities","ratio_total_liabilities_cash","ratio_debt_to_equity",
                    "is_net_income","ratio_accounts_payable_cash","cf_cash_at_end_of_period"
                ],
                "⚠️ Risk / Watchlist": [
                    "watchlist","watchlist_hits","watchlist_raw",
                    "adverse_media_hits","sanctions_hits","pep_hits",
                    "num_bankruptcies","num_judgements","num_liens",
                    "bankruptcies","judgements","liens"
                ],
                "🔗 Vendor / Integration": [
                    "internal_platform_matches","internal_platform_matches_count",
                    "internal_platform_matches_combined","canadaopen_confidence",
                    "canadaopen_id","canadaopen_match_mode"
                ],
                "🇨🇦 Canada (if applicable)": [
                    "canada_business_number_found","canada_business_number_match",
                    "canada_id_number_match","canada_corporate_id_found","canada_corporate_id_match"
                ],
            }

            # Build a lookup: fact_name → group
            fact_to_group = {}
            for grp, names in FACT_GROUPS.items():
                for n in names:
                    fact_to_group[n] = grp

            # Group all facts
            grouped = {}
            for _, row in facts_df.drop_duplicates("name").iterrows():
                f  = _parse_fact(row["value"])
                v  = f.get("value")
                if isinstance(v,(dict,list)):
                    dv = f"[{type(v).__name__}, {len(v) if isinstance(v,list) else len(v)} item(s)]"
                else:
                    dv = str(v)[:120] if v is not None else "(null)"
                conf = float(_safe_get(f,"source","confidence",default=0) or 0)
                grp  = fact_to_group.get(row["name"],"📦 Other")
                if grp not in grouped:
                    grouped[grp] = []
                grouped[grp].append({
                    "Fact":       row["name"],
                    "Value":      dv,
                    "Source":     pid_name(str(_safe_get(f,"source","platformId",default=""))),
                    "Confidence": f"{conf:.3f}" if conf>0 else "—",
                    "Updated":    str(row["received_at"])[:16],
                })

            # Show counts summary first
            total_facts = facts_df["name"].nunique()
            stored_count = sum(1 for _,row in facts_df.drop_duplicates("name").iterrows()
                               if _parse_fact(row["value"]).get("value") is not None)
            null_count = total_facts - stored_count
            c1,c2,c3 = st.columns(3)
            with c1: kpi("Total Facts",f"{total_facts}","stored in system","#3B82F6")
            with c2: kpi("Has Value",f"{stored_count}","non-null facts","#22c55e")
            with c3: kpi("Null/Missing",f"{null_count}","(null) value","#f59e0b")

            # Render each group in an expander
            group_order = list(FACT_GROUPS.keys()) + ["📦 Other"]
            for grp in group_order:
                facts_in_grp = grouped.get(grp, [])
                if not facts_in_grp:
                    continue
                has_val  = sum(1 for r in facts_in_grp if r["Value"] not in ("(null)","(not stored)",""))
                null_in  = len(facts_in_grp) - has_val
                label = f"{grp} ({len(facts_in_grp)} facts · {has_val} with values · {null_in} null)"
                with st.expander(label, expanded=(grp in ("🏢 Identity / Name","🏛️ Registry / SOS","🔐 TIN / EIN"))):
                    styled_table(pd.DataFrame(facts_in_grp))

            st.markdown("---")
            st.markdown("#### 🔍 SQL for deeper investigation")
            st.code(f"""-- All facts for this business:
SELECT name, value, received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
ORDER BY name;

-- Worth Score:
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 1;

-- All vendor API calls:
SELECT platform_id, received_at
FROM integration_data.request_response
WHERE business_id = '{bid}'
ORDER BY received_at DESC;

-- Banking verification:
SELECT * FROM rds_integration_data.rel_banking_verifications
WHERE business_id = '{bid}';""", language="sql")


# ── Footer ──────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(
    f'<div style="color:#475569;font-size:.70rem;text-align:center">'
    f'Admin Portal KYB Dashboard v3 · 6 consolidated sections · '
    f'rds_warehouse_public.facts · rds_manual_score_public · rds_integration_data · '
    f'{datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}'
    f'</div>', unsafe_allow_html=True)
