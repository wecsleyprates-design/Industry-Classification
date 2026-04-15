"""
KYB Intelligence Hub — kyb_hub_app.py
========================================
Full per-business KYB investigation with complete data lineage,
winning source + alternatives + confidence, SQL/Python code,
analyst explanations, per-card AI quick-questions, global AI agent.

Run:   streamlit run Admin-Portal-KYB-App/kyb_hub_app.py
Keys:  export OPENAI_API_KEY=your-key
       export REDSHIFT_DB=dev REDSHIFT_USER=... REDSHIFT_PASSWORD=...
"""

import os, json, re, math
from datetime import datetime, timezone
from pathlib import Path
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(page_title="KYB Intelligence Hub", page_icon="🔬",
                   layout="wide", initial_sidebar_state="expanded")
BASE = Path(__file__).parent

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""<style>
  .main{background:#0A0F1E}.kpi{background:#1E293B;border-radius:10px;
  padding:14px 18px;border-left:4px solid #3B82F6;margin-bottom:6px}
  .kpi .lbl{color:#94A3B8;font-size:.70rem;text-transform:uppercase;letter-spacing:.05em}
  .kpi .val{color:#F1F5F9;font-size:1.4rem;font-weight:700}
  .kpi .sub{color:#64748B;font-size:.70rem;margin-top:2px}
  .analyst{background:#0C1A2E;border:1px solid #1E3A5F;border-radius:10px;
  padding:14px 16px;margin:8px 0}
  .analyst .hdr{color:#60A5FA;font-weight:700;font-size:.82rem;margin-bottom:6px}
  .analyst p{color:#CBD5E1;font-size:.79rem;margin:3px 0;line-height:1.5}
  .flow-step{background:#1E293B;border-left:3px solid #3B82F6;border-radius:8px;
  padding:9px 14px;margin:3px 0;font-size:.76rem;color:#CBD5E1}
  .flag-red{background:#1f0a0a;border-left:4px solid #ef4444;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#fca5a5;font-size:.80rem}
  .flag-amber{background:#1c1917;border-left:4px solid #f59e0b;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#fde68a;font-size:.80rem}
  .flag-green{background:#052e16;border-left:4px solid #22c55e;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#86efac;font-size:.80rem}
  .flag-blue{background:#0c1a2e;border-left:4px solid #60a5fa;border-radius:8px;
  padding:10px 14px;margin:5px 0;color:#93c5fd;font-size:.80rem}
</style>""", unsafe_allow_html=True)

# ── Platform ID map ───────────────────────────────────────────────────────────
PID = {
    "16":("Middesk","#f59e0b","US SOS live query · w=2.0 · confidence=0.15+0.20×tasks"),
    "23":("OpenCorporates","#3B82F6","Global registry · w=0.9 · confidence=match.index/55"),
    "24":("ZoomInfo","#8B5CF6","ZI firmographic bulk · w=0.8 · confidence=match.index/55"),
    "17":("Equifax","#22c55e","EFX firmographic bulk · w=0.7 · confidence=XGBoost or index/55"),
    "38":("Trulioo","#ec4899","KYB/PSC · w=0.8 · confidence=status-based(0.70/0.40/0.20)"),
    "31":("AI (GPT)","#f97316","AI enrichment LAST RESORT · w=0.1 · confidence=self-reported"),
    "22":("SERP","#a855f7","Google/web scraping · w=0.3 · confidence=heuristic"),
    "40":("Plaid","#06b6d4","Bank/IDV · w=1.0"),
    "0":("Applicant","#64748b","Submitted on onboarding form"),
    "-1":("Default","#475569","System default — no vendor"),
    "":("Unknown","#374151","Source metadata missing"),
}
def pid_info(pid): return PID.get(str(pid or ""), (f"pid={pid}","#374151","Unknown source"))

# ── Helpers ───────────────────────────────────────────────────────────────────
def kpi(label, value, sub="", color="#3B82F6"):
    st.markdown(f'<div class="kpi" style="border-left-color:{color}"><div class="lbl">{label}</div>'
                f'<div class="val">{value}</div><div class="sub">{sub}</div></div>',
                unsafe_allow_html=True)

def flag(text, level="blue"):
    _icons = {"red":"🚨","amber":"⚠️","green":"✅","blue":"ℹ️"}
    icon = _icons.get(level,"ℹ️")
    st.markdown(f'<div class="flag-{level}">{icon} {text}</div>', unsafe_allow_html=True)

def analyst_card(title, points):
    bullets = "".join(f"<p>• {p}</p>" for p in points)
    st.markdown(f'<div class="analyst"><div class="hdr">🔬 {title}</div>{bullets}</div>',
                unsafe_allow_html=True)

def dark_chart(fig):
    fig.update_layout(paper_bgcolor="#0A0F1E",plot_bgcolor="#1E293B",font_color="#E2E8F0",
                      legend=dict(bgcolor="#1E293B"),margin=dict(t=50,b=10,l=10,r=10))
    return fig

def parse_fact(v):
    if not v: return {}
    try:
        r = json.loads(v)
        return r if isinstance(r,dict) else {}
    except: return {}

def safe_get(d,*keys,default=""):
    cur=d
    for k in keys:
        if not isinstance(cur,dict): return default
        cur=cur.get(k)
        if cur is None: return default
    return cur if cur is not None else default

# ── Redshift ──────────────────────────────────────────────────────────────────
def get_conn():
    try:
        import psycopg2
        conn=psycopg2.connect(
            dbname=os.getenv("REDSHIFT_DB","dev"),user=os.getenv("REDSHIFT_USER","readonly_all_access"),
            password=os.getenv("REDSHIFT_PASSWORD","Y7&.D3!09WvT4/nSqXS2>qbO"),
            host=os.getenv("REDSHIFT_HOST","worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
            port=int(os.getenv("REDSHIFT_PORT","5439")),connect_timeout=10)
        return conn,True,None
    except Exception as e: return None,False,str(e)

def run_sql(sql):
    conn,ok,err=get_conn()
    if not ok: return None,err
    try:
        df=pd.read_sql(sql,conn); conn.close(); return df,None
    except Exception as e: return None,str(e)

# ── Load facts — BULK (2 queries total, not N+1) ──────────────────────────────
KNOWN_LARGE={"sos_filings","sos_match","watchlist","watchlist_raw","bankruptcies",
             "judgements","liens","people","addresses","internal_platform_matches_combined"}

def _large_exclusion():
    names = ",".join(f"'{n}'" for n in KNOWN_LARGE)
    return f"AND name NOT IN ({names})"

def run_sql_conn(sql, conn):
    """Run a query on an already-open connection (no open/close overhead)."""
    try:
        return pd.read_sql(sql, conn), None
    except Exception as e:
        return None, str(e)

@st.cache_data(ttl=600, show_spinner=False)
def load_facts(bid):
    """2-query bulk loader: 1 query for names, 1 bulk query for all small facts."""
    import psycopg2
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("REDSHIFT_DB","dev"),
            user=os.getenv("REDSHIFT_USER","readonly_all_access"),
            password=os.getenv("REDSHIFT_PASSWORD","Y7&.D3!09WvT4/nSqXS2>qbO"),
            host=os.getenv("REDSHIFT_HOST","worthai-services-redshift-endpoint-k9sdhv2ja6lgojidri87.808338307022.us-east-1.redshift-serverless.amazonaws.com"),
            port=int(os.getenv("REDSHIFT_PORT","5439")),
            connect_timeout=15)
    except Exception as e:
        return None, str(e)

    try:
        # Query 1 — get all fact names + timestamps (tiny result)
        names_df, err = run_sql_conn(
            f"""SELECT DISTINCT name, MAX(received_at) AS received_at
                FROM rds_warehouse_public.facts
                WHERE business_id='{bid}'
                GROUP BY name ORDER BY name""", conn)
        if names_df is None:
            conn.close(); return None, err
        if names_df.empty:
            conn.close(); return {}, None

        all_names = set(names_df["name"].tolist())
        large_names = all_names & KNOWN_LARGE
        small_names = all_names - KNOWN_LARGE

        latest = {}

        # Pre-populate stubs for large facts (no query needed)
        for name in large_names:
            row = names_df[names_df["name"]==name]
            ts = str(row["received_at"].iloc[0])[:16] if not row.empty else ""
            latest[name] = {"_too_large": True, "_name": name, "_received_at": ts}

        # Query 2 — fetch ALL small facts in one round-trip
        # QUALIFY keeps only the latest row per name (Redshift supports QUALIFY)
        excl = ",".join(f"'{n}'" for n in KNOWN_LARGE) if KNOWN_LARGE else "''"
        bulk_df, bulk_err = run_sql_conn(f"""
            SELECT name, value, received_at
            FROM (
                SELECT name, value, received_at,
                       ROW_NUMBER() OVER (PARTITION BY name ORDER BY received_at DESC) AS rn
                FROM rds_warehouse_public.facts
                WHERE business_id='{bid}'
                  AND name NOT IN ({excl})
            ) t
            WHERE rn = 1
        """, conn)

        if bulk_df is not None and not bulk_df.empty:
            for _, row in bulk_df.iterrows():
                name = row["name"]
                f = parse_fact(row["value"])
                f["_name"] = name
                f["_received_at"] = str(row["received_at"])[:16]
                latest[name] = f

        conn.close()
        return latest, None
    except Exception as e:
        try: conn.close()
        except: pass
        return None, str(e)

# ── Cached per-business queries (TTL=600) ────────────────────────────────────
@st.cache_data(ttl=600, show_spinner=False)
def load_score(bid):
    return run_sql(f"""SELECT bs.weighted_score_850 AS score_850,bs.weighted_score_100 AS score_100,
        bs.risk_level,bs.score_decision,bs.created_at
        FROM rds_manual_score_public.data_current_scores cs
        JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
        WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1""")

@st.cache_data(ttl=600, show_spinner=False)
def load_score_factors(bid):
    return run_sql(f"""SELECT category_id,score_100,weighted_score_850
        FROM rds_manual_score_public.business_score_factors
        WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores
                        WHERE business_id='{bid}' LIMIT 1)
        ORDER BY ABS(weighted_score_850) DESC LIMIT 20""")

@st.cache_data(ttl=600, show_spinner=False)
def load_bert(bid):
    return run_sql(f"""SELECT bev.business_id,bert.status,bert.sublabel,bert.created_at
        FROM rds_integration_data.business_entity_review_task bert
        JOIN rds_integration_data.business_entity_verification bev
          ON bev.id=bert.business_entity_verification_id
        WHERE bev.business_id='{bid}' AND bert.key='watchlist'
        ORDER BY bert.created_at DESC LIMIT 5""")

# Audit is not per-business — longer TTL (30 min)
@st.cache_data(ttl=1800, show_spinner=False)
def load_audit():
    return run_sql("SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 30")

# ── Cached Home-tab population queries (keyed by date range) ─────────────────
@st.cache_data(ttl=600, show_spinner=False)
def load_home_recent(date_from, date_to):
    parts=[]
    if date_from: parts.append(f"received_at >= '{date_from}'")
    if date_to:   parts.append(f"received_at <= '{date_to} 23:59:59'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""
    return run_sql(f"""
        SELECT business_id, MIN(received_at) AS first_seen, MAX(received_at) AS last_updated,
               COUNT(DISTINCT name) AS fact_count
        FROM rds_warehouse_public.facts
        WHERE 1=1{dc}
        GROUP BY business_id
        ORDER BY first_seen DESC
        LIMIT 200
    """)

@st.cache_data(ttl=600, show_spinner=False)
def load_home_kyb_stats(date_from, date_to):
    """One bulk query returning all KYB health metrics per business for the dashboard."""
    parts=[]
    if date_from: parts.append(f"received_at >= '{date_from}'")
    if date_to:   parts.append(f"received_at <= '{date_to} 23:59:59'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""
    # Pivot scalar KYB facts into columns using conditional aggregation
    return run_sql(f"""
        SELECT
            business_id,
            MAX(CASE WHEN name='sos_active'          THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS sos_active,
            MAX(CASE WHEN name='tin_match_boolean'   THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS tin_match,
            MAX(CASE WHEN name='idv_passed_boolean'  THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS idv_passed,
            MAX(CASE WHEN name='naics_code'          THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS naics_code,
            MAX(CASE WHEN name='watchlist_hits'      THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS watchlist_hits,
            MAX(CASE WHEN name='num_bankruptcies'    THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_bankruptcies,
            MAX(CASE WHEN name='num_judgements'      THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_judgements,
            MAX(CASE WHEN name='num_liens'           THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS num_liens,
            MAX(CASE WHEN name='adverse_media_hits'  THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS adverse_media,
            MAX(CASE WHEN name='revenue'             THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS revenue,
            MAX(CASE WHEN name='formation_date'      THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS formation_date,
            MAX(CASE WHEN name='formation_state'     THEN JSON_EXTRACT_PATH_TEXT(value,'value') END) AS formation_state,
            MAX(received_at) AS last_seen,
            MIN(received_at) AS first_seen,
            COUNT(DISTINCT name) AS fact_count
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'sos_active','tin_match_boolean','idv_passed_boolean','naics_code',
            'watchlist_hits','num_bankruptcies','num_judgements','num_liens',
            'adverse_media_hits','revenue','formation_date','formation_state'
        ){dc}
        GROUP BY business_id
    """)

@st.cache_data(ttl=600, show_spinner=False)
def load_home_flags(date_from, date_to):
    parts=[]
    if date_from: parts.append(f"received_at >= '{date_from}'")
    if date_to:   parts.append(f"received_at <= '{date_to} 23:59:59'")
    dc=(" AND "+" AND ".join(parts)) if parts else ""
    return run_sql(f"""
        SELECT business_id, name,
               JSON_EXTRACT_PATH_TEXT(value,'value') AS val,
               received_at
        FROM rds_warehouse_public.facts
        WHERE name IN (
            'sos_active','tin_match_boolean','watchlist_hits',
            'naics_code','idv_passed_boolean','num_bankruptcies',
            'num_judgements','num_liens','sos_match_boolean'
        ){dc}
        ORDER BY business_id, name, received_at DESC
    """)

def load_facts_with_ui(bid, tab_key):
    """Load facts showing a spinner, with a per-tab refresh button."""
    cache_key = f"facts_loaded_{bid}"
    col_info, col_ref = st.columns([5,1])
    with col_ref:
        if st.button("🔄 Refresh", key=f"ref_{tab_key}",
                     help="Clear cached facts and reload from Redshift (takes ~3–5s)"):
            load_facts.clear()
            if cache_key in st.session_state: del st.session_state[cache_key]
            st.rerun()
    with col_info:
        cached = cache_key in st.session_state
        st.caption(f"{'⚡ Instant — from cache' if cached else '🔃 Loading from Redshift (bulk query)…'} · "
                   f"UUID: `{bid[:16]}…` · TTL: 10 min")
    with st.spinner("Loading facts from Redshift…" if not cached else "Reading from cache…"):
        facts, err = load_facts(bid)
    if facts is not None:
        st.session_state[cache_key] = True
    return facts, err

def gv(facts,name):
    f=facts.get(name,{})
    if f.get("_too_large"): return "[too large — query PostgreSQL RDS port 5432]"
    v=f.get("value")
    if isinstance(v,(list,dict)): return None
    return v

def gc(facts,name):
    try:
        v = facts.get(name,{}).get("source",{})
        if not isinstance(v,dict): return 0.0
        c = v.get("confidence")
        return float(c) if c is not None else 0.0
    except: return 0.0

def gp(facts,name):
    """Return platformId as string — handles 0 (Applicant) correctly."""
    src = facts.get(name,{}).get("source",{})
    if not isinstance(src,dict): return ""
    pid = src.get("platformId")
    return "" if pid is None else str(pid)

def _alt_pid(a):
    """Alternatives store source as bare int OR as nested dict {platformId:...}."""
    s = a.get("source")
    if isinstance(s, dict): return str(s.get("platformId",""))
    if s is not None: return str(s)
    return ""

def _alt_conf(a):
    s = a.get("source")
    if isinstance(s, dict):
        c = s.get("confidence")
        return float(c) if c is not None else 0.0
    # bare int source means conf stored at top level
    c = a.get("confidence")
    return float(c) if c is not None else 0.0

def get_alts(facts,name):
    alts=facts.get(name,{}).get("alternatives",[]) or []
    return [{"value":a.get("value"),"pid":_alt_pid(a),"conf":_alt_conf(a)}
            for a in alts if isinstance(a,dict)]

# ── Fact lineage table ────────────────────────────────────────────────────────
def _fmt_value(name, v):
    if v is None: return "(null)"
    if isinstance(v,list): return f"📋 list · {len(v)} item(s)"
    if isinstance(v,dict):
        if name=="idv_status": return " | ".join(f"{k}:{n}" for k,n in v.items() if n)
        inner = v.get("status") or v.get("value") or v.get("message")
        if inner: return str(inner)[:80]
        return f"🗂️ object · {len(v)} keys"
    return str(v)[:120]

def _pid_label(pid_str):
    """Return human name for a platformId — handles 0=Applicant correctly."""
    if pid_str=="": return "Unknown"
    return pid_info(pid_str)[0]

# ── Fact Engine rule explanations (from integration-service/lib/facts/rules.ts)
RULE_EXPLAIN = {
    "factWithHighestConfidence": (
        "factWithHighestConfidence",
        "Winner = vendor with highest confidence score. "
        "If two vendors are within 5% (WEIGHT_THRESHOLD=0.05) of each other, "
        "the one with the higher platform weight wins (Middesk w=2.0 > OC w=0.9 > ZI w=0.8 > Trulioo w=0.8 > EFX w=0.7 > SERP w=0.3 > AI w=0.1). "
        "Source: integration-service/lib/facts/rules.ts L36–59"
    ),
    "combineFacts": (
        "combineFacts",
        "Merges values from ALL vendors into one deduplicated array. "
        "No single winner — every vendor contributes. Used for: addresses, names_found, dba_found. "
        "Source: integration-service/lib/facts/rules.ts L76–96"
    ),
    "combineWatchlistMetadata": (
        "combineWatchlistMetadata",
        "Merges watchlist hits from business-level (Middesk) AND person-level (Trulioo PSC) screenings, "
        "deduplicates by hit ID, excludes adverse_media category. "
        "Source: integration-service/lib/facts/rules.ts L253+"
    ),
    "dependentFact": (
        "Dependent (computed)",
        "This fact is not queried from a vendor. It is computed by the Fact Engine from another fact. "
        "platformId=-1, confidence=null. Example: sos_active ← derived from sos_filings[].active. "
        "Source: integration-service/lib/facts/rules.ts L98–107"
    ),
    "—": (
        "Dependent / No rule",
        "ruleApplied=null means this fact is a dependent fact — computed from its listed dependencies[], "
        "not won from a vendor competition. The source.platformId=-1 confirms this. "
        "See the 'dependencies' field in the JSON to know which fact it derives from."
    ),
    "factWithHighestWeight": (
        "factWithHighestWeight",
        "Winner = vendor with the highest platform weight, regardless of confidence. "
        "Rare rule used when confidence scores are not meaningful. "
        "Source: integration-service/lib/facts/rules.ts L11–34"
    ),
    "manualOverride": (
        "Manual Analyst Override",
        "An analyst manually changed this fact in the Admin Portal. "
        "The override value replaces the vendor-selected value for all downstream consumers. "
        "Source: integration-service/lib/facts/rules.ts L112+"
    ),
}

def _rule_label(rule_str):
    return RULE_EXPLAIN.get(rule_str, (rule_str, ""))[0] if rule_str else "Dependent / No rule"

def render_fact_engine_explainer():
    """Render a comprehensive Fact Engine workflow card."""
    st.markdown("""<div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:16px 20px;margin:10px 0">
<div style="color:#60A5FA;font-weight:700;font-size:.95rem;margin-bottom:10px">
  ⚙️ How the Fact Engine Builds Every Row in This Table
</div>
<div style="color:#CBD5E1;font-size:.80rem;line-height:1.8">

<strong style="color:#a5b4fc">Step 1 — Vendor data collection</strong><br>
Multiple vendors (Middesk, OpenCorporates, ZoomInfo, Equifax, Trulioo, SERP, AI) each provide their 
version of the same fact. All responses are stored as raw candidates.

<br><br><strong style="color:#a5b4fc">Step 2 — Fact Engine rule selection</strong><br>
For each fact, one rule is applied to determine the winner:<br>
<span style="color:#22c55e">■ factWithHighestConfidence</span> — the vendor with the highest confidence wins. 
If two vendors are within 5% of each other (WEIGHT_THRESHOLD=0.05), the one with the higher 
<em>platform weight</em> wins. Weights: Middesk=2.0 · OC=0.9 · ZI=0.8 · Trulioo=0.8 · EFX=0.7 · SERP=0.3 · AI=0.1<br>
<span style="color:#3B82F6">■ combineFacts</span> — all vendor values merged into one deduplicated array (used for addresses, names_found, dba_found)<br>
<span style="color:#8B5CF6">■ Dependent fact</span> — computed from another fact. No vendor, no rule, no confidence (platformId=-1)

<br><br><strong style="color:#a5b4fc">Step 3 — Winner stored in Redshift</strong><br>
The winning vendor's value, source.platformId, source.confidence, and ruleApplied are written to 
<code>rds_warehouse_public.facts</code> (received_at = write timestamp).<br>
All losing vendors are stored in the <code>alternatives[]</code> array of the same JSON row.

<br><br><strong style="color:#a5b4fc">Step 4 — Admin Portal reads from facts</strong><br>
The Admin Portal calls <code>GET /api/v1/facts/business/{'{'}bid{'}'}/kyb</code> → returns the winning value 
(and alternatives) for every fact. Cached in Redis for 2 minutes.

<br><br><strong style="color:#a5b4fc">Confidence formulas by vendor:</strong><br>
Middesk: <code>0.15 + 0.20 × (passing review tasks, max 4)</code> · 
OC/ZI/EFX: <code>match.index ÷ 55</code> · 
Trulioo: <code>0.70=SUCCESS · 0.40=FAILED · 0.20=OTHER</code> · 
AI (pid=31): self-reported (LOW→0.3 · MED→0.6 · HIGH→0.9) · 
Applicant (pid=0): <code>1.0</code> by convention · 
Dependent (pid=-1): <code>null</code> (not applicable)

</div>
</div>""", unsafe_allow_html=True)

def render_lineage(facts, names, title="Fact Lineage", show_rule_explainer=False):
    st.markdown(f"##### {title}")
    if show_rule_explainer:
        render_fact_engine_explainer()
    rows=[]
    for name in names:
        f=facts.get(name,{})
        if not f: continue
        too_large=f.get("_too_large",False)
        v=f.get("value")
        dv = "📦 [too large — use PostgreSQL RDS SQL below]" if too_large else _fmt_value(name,v)

        # Source — handle pid=0 correctly (falsy but valid = Applicant)
        src = f.get("source") or {}
        pid = "" if not isinstance(src,dict) else (
            "" if src.get("platformId") is None else str(src["platformId"]))
        conf_raw = src.get("confidence") if isinstance(src,dict) else None
        conf = float(conf_raw) if conf_raw is not None else None
        win_name = _pid_label(pid)
        src_name = f.get("source",{}).get("name","") if isinstance(f.get("source"),dict) else ""

        # Meaningful source label
        if pid == "-1":
            # Dependent fact — get the dependency name if available
            deps = f.get("dependencies") or f.get("source",{}).get("dependencies") if isinstance(f.get("source"),dict) else None
            dep_str = ""
            if isinstance(deps,list) and deps: dep_str = f" ← {deps[0]}"
            win_str = f"📐 Computed{dep_str}"
            conf_str = "n/a (derived)"
        elif pid == "":
            win_str = "❓ Unknown source"
            conf_str = f"{conf:.4f}" if conf is not None else "n/a"
        elif conf is None:
            win_str = f"{win_name}"
            conf_str = "n/a"
        else:
            win_str = f"{win_name}"
            conf_str = f"{conf:.4f}"

        # Rule applied — with human label
        raw_rule = safe_get(f,"ruleApplied","name") or "—"
        rule_label = _rule_label(raw_rule)
        _, rule_desc = RULE_EXPLAIN.get(raw_rule, (raw_rule, "See integration-service/lib/facts/rules.ts"))

        # Dependencies for dependent facts
        deps_raw = f.get("dependencies")
        if deps_raw and isinstance(deps_raw, list):
            dep_display = " → ".join(deps_raw)
        else:
            dep_display = ""

        # Alternatives
        alts = get_alts(facts,name)
        alt_str = " | ".join(
            f"{_pid_label(a['pid'])}({a['conf']:.4f})" for a in alts[:4]
        ) or ("—" if pid!="-1" else "n/a (computed fact)")

        rows.append({
            "Fact": name,
            "Value": dv,
            "Winning Source": win_str,
            "Confidence": conf_str,
            "Rule": rule_label,
            "Dependencies / Alternatives": dep_display or alt_str,
            "Updated": f.get("_received_at",""),
            "_raw_fact": f,       # kept for JSON panel — stripped before display
            "_name": name,
        })

    if rows:
        display_rows = [{k: v for k,v in r.items() if not k.startswith("_")} for r in rows]
        df = pd.DataFrame(display_rows)
        st.dataframe(df, use_container_width=True, hide_index=True,
                     column_config={
                         "Fact": st.column_config.TextColumn("Fact", width="medium"),
                         "Value": st.column_config.TextColumn("Value", width="medium"),
                         "Winning Source": st.column_config.TextColumn("Winning Source", width="small"),
                         "Confidence": st.column_config.TextColumn("Confidence", width="small"),
                         "Rule": st.column_config.TextColumn("Rule Applied", width="medium"),
                         "Dependencies / Alternatives": st.column_config.TextColumn("Deps / Alternatives", width="large"),
                     })

        # ── Per-fact JSON panels ──────────────────────────────────────────────
        st.caption("▼ Click any fact below to see its full JSON value, all alternatives, and field-by-field annotations")
        for r in rows:
            fname = r["_name"]
            f_obj = r["_raw_fact"]
            dv_disp = r["Value"]
            v = f_obj.get("value")
            src = f_obj.get("source") or {}
            alts_raw = f_obj.get("alternatives") or []
            deps_raw2 = f_obj.get("dependencies") or []
            rule_raw2 = safe_get(f_obj,"ruleApplied","name") or "null"
            rule_desc2 = safe_get(f_obj,"ruleApplied","description") or ""
            too_large = f_obj.get("_too_large", False)

            # Build value block
            if too_large:
                val_display = '"[too large for Redshift federation — query PostgreSQL RDS port 5432]"'
            elif v is None:
                val_display = "null"
            elif isinstance(v, (dict, list)):
                val_display = json.dumps(v, default=str, indent=4)
            else:
                val_display = json.dumps(v, default=str)

            # Build source block
            pid_disp = src.get("platformId","null") if isinstance(src,dict) else "null"
            conf_disp = src.get("confidence","null") if isinstance(src,dict) else "null"
            src_name_disp = src.get("name","null") if isinstance(src,dict) else "null"
            pid_annotation = {
                "16":"← Middesk (weight=2.0, highest priority)", "23":"← OpenCorporates (weight=0.9)",
                "24":"← ZoomInfo (weight=0.8)", "17":"← Equifax (weight=0.7)",
                "38":"← Trulioo (weight=0.8)", "31":"← AI GPT-4o-mini (weight=0.1, last resort)",
                "22":"← SERP/Google (weight=0.3)", "40":"← Plaid (weight=1.0)",
                "0":"← Applicant (businessDetails, confidence=1.0 by convention)",
                "-1":"← System computed (dependent fact, no vendor)",
            }.get(str(pid_disp),"")

            # Build alternatives block
            if alts_raw:
                alts_lines = []
                for i,a in enumerate(alts_raw):
                    a_src = a.get("source")
                    if isinstance(a_src, dict):
                        a_pid = a_src.get("platformId","?"); a_conf = a_src.get("confidence","?")
                    else:
                        a_pid = a_src; a_conf = a.get("confidence","?")
                    a_val = a.get("value")
                    a_val_str = json.dumps(a_val, default=str)[:120] if isinstance(a_val,(list,dict)) else json.dumps(a_val, default=str)
                    a_vendor = _pid_label(str(a_pid)) if a_pid is not None else "Unknown"
                    alts_lines.append(f'    // [{i}] {a_vendor} (pid={a_pid}, conf={a_conf})')
                    alts_lines.append(f'    {{"value": {a_val_str}, "source": {a_pid}, "confidence": {a_conf}}}{"," if i<len(alts_raw)-1 else ""}')
                alts_block = "\n".join(alts_lines)
            else:
                alts_block = "    // No alternative sources — only one vendor provided this fact"

            deps_block = json.dumps(deps_raw2) if deps_raw2 else "[]"

            # Header color by value type
            if too_large:
                h_color = "#f59e0b"; h_icon = "📦"
            elif v is None:
                h_color = "#64748b"; h_icon = "⚪"
            elif isinstance(v, list):
                h_color = "#3B82F6"; h_icon = "📋"
            elif isinstance(v, dict):
                h_color = "#8B5CF6"; h_icon = "🗂️"
            else:
                h_color = "#22c55e"; h_icon = "✅"

            summary_label = f'{h_icon} <code style="color:#60A5FA">{fname}</code> — {dv_disp[:60]}'
            if isinstance(v, list): summary_label += f' &nbsp;<span style="color:#3B82F6;font-size:.68rem">({len(v)} items — expand to see all)</span>'
            elif isinstance(v, dict): summary_label += f' &nbsp;<span style="color:#8B5CF6;font-size:.68rem">({len(v)} keys)</span>'

            json_block = f'''{{{"\n"}  "name": "{fname}",
  "value": {val_display},                {f"← {dv_disp[:60]}" if not isinstance(v,(list,dict,type(None))) else ("← list with " + str(len(v)) + " items, all shown above" if isinstance(v,list) else ("← object with " + str(len(v)) + " keys" if isinstance(v,dict) else "← null = no vendor provided data"))}
  "source": {{
    "confidence": {conf_disp},           {f"← {_rule_label(rule_raw2)} confidence formula" if conf_disp not in (None,"null") else "← null = dependent/computed fact, no vendor query"}
    "platformId": {pid_disp},            {pid_annotation}
    "name": "{src_name_disp}"
  }},
  "ruleApplied": {{
    "name": "{rule_raw2}",               ← {rule_raw2}: {rule_desc2 or _rule_label(rule_raw2)}
  }},
  "dependencies": {deps_block},          {f"← computed from: {', '.join(deps_raw2)}" if deps_raw2 else "← no dependencies (vendor-supplied fact)"}
  "alternatives": [
{alts_block}
  ]
}}'''

            st.markdown(
                f"<details style='background:#0A0F1E;border-left:3px solid {h_color};"
                f"border-radius:8px;padding:6px 12px;margin:3px 0'>"
                f"<summary style='color:{h_color};font-size:.75rem;cursor:pointer;list-style:none'>"
                f"📄 {summary_label}</summary>"
                f"<pre style='color:#CBD5E1;font-size:.70rem;background:#0f172a;padding:10px;"
                f"border-radius:6px;overflow:auto;margin:6px 0;max-height:400px'>{json_block}</pre>"
                f"</details>",
                unsafe_allow_html=True
            )

        # Rule legend below
        used_rules = set(r["Rule"] for r in rows if r["Rule"] not in ("","—","n/a (computed fact)"))
        if used_rules:
            st.markdown("<div style='margin-top:6px'>", unsafe_allow_html=True)
            for rule_key, (rl, rd) in RULE_EXPLAIN.items():
                if rl in used_rules:
                    st.markdown(
                        f"<div style='background:#0f172a;border-left:3px solid #3B82F6;padding:6px 10px;"
                        f"border-radius:6px;margin:2px 0;font-size:.70rem'>"
                        f"<span style='color:#60A5FA;font-weight:600'>{rl}:</span> "
                        f"<span style='color:#94A3B8'>{rd}</span></div>",
                        unsafe_allow_html=True)
            st.markdown("</div>", unsafe_allow_html=True)
    return rows

def sql_for(bid,names):
    ns=", ".join(f"'{n}'" for n in names)
    return f"""-- Redshift (VPN required):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}' AND name IN ({ns})
ORDER BY name, received_at DESC;"""

def py_for(bid,names):
    return f"""import psycopg2,json
conn=psycopg2.connect(dbname='dev',user='readonly_all_access',
    password='...',host='worthai-services-...redshift-serverless.amazonaws.com',port=5439)
cur=conn.cursor()
cur.execute(\"\"\"
    SELECT name,value,received_at FROM rds_warehouse_public.facts
    WHERE business_id=%s AND name IN {tuple(names) if len(names)>1 else f"('{names[0]}')"}
    ORDER BY name,received_at DESC
\"\"\", ('{bid}',))
for name,val_str,ts in cur.fetchall():
    fact=json.loads(val_str)
    print(name,'→',fact.get('value'),
          '| winner:',fact.get('source',{{}}).get('platformId'),
          '| conf:',fact.get('source',{{}}).get('confidence'),
          '| alts:',len(fact.get('alternatives',[])))
conn.close()"""

# ── AI / RAG ──────────────────────────────────────────────────────────────────
@st.cache_resource
def load_rag():
    p=BASE/"kyb_hub_rag_index.json"
    if p.exists() and p.stat().st_size>100:
        with open(p) as f: return json.load(f)
    return None

def rag_search(q,top_k=8):
    idx=load_rag()
    if not idx: return []
    idf=idx["idf"]
    qw=re.findall(r"[a-zA-Z_][a-zA-Z0-9_]{2,}",q.lower())
    qc=re.findall(r"[a-z][a-zA-Z0-9]*(?:_[a-zA-Z0-9]+)+",q.lower())
    scores=[]
    for chunk in idx["chunks"]:
        s=sum(chunk["tf"].get(w,0)*idf.get(w,0) for w in qw)
        for c in qc: s+=chunk["tf"].get(c,0)*idf.get(c,0)*4
        if any(c in chunk["text"].lower() for c in qc): s*=1.5
        scores.append((s,chunk))
    scores.sort(key=lambda x:-x[0])
    return [c for _,c in scores[:top_k] if _>0]

@st.cache_resource
def get_openai():
    try:
        from openai import OpenAI
        # 1. Environment variable
        key = os.getenv("OPENAI_API_KEY","")
        # 2. Streamlit secrets (secrets.toml or Streamlit Cloud secrets)
        if not key:
            try:
                key = st.secrets["OPENAI_API_KEY"]
            except Exception:
                pass
        # 3. Hardcoded fallback for local dev (do not commit real keys to git)
        if not key:
            key = ""
        if not key or not str(key).startswith("sk-"):
            return None
        return OpenAI(api_key=str(key))
    except Exception:
        return None

SYSTEM="""You are the KYB Intelligence Hub AI — expert on Worth AI's KYB data pipeline.
Rules: cite exact source (file, table, fact name, API endpoint). Always provide SQL/Python.
Never invent fact names or table names. Platform IDs: 16=Middesk,23=OC,24=ZI,17=EFX,38=Trulioo,31=AI,22=SERP,40=Plaid.
Redshift: use JSON_EXTRACT_PATH_TEXT, never ::json or ->> (fails on federation)."""

def ask_ai(question, context="", history=None):
    client=get_openai()
    if not client: return "⚠️ Set OPENAI_API_KEY env var to enable AI responses."
    chunks=rag_search(question,top_k=6)
    rag="\n\n".join(f"[{c['source_type']}] {c['description']}\n{c['text'][:600]}" for c in chunks)
    msgs=[{"role":"system","content":SYSTEM}]
    if history: msgs.extend(history[-8:])
    msgs.append({"role":"user","content":f"RAG:\n{rag}\n\nContext:\n{context}\n\nQuestion: {question}"})
    try:
        r=get_openai().chat.completions.create(model="gpt-4o-mini",messages=msgs,max_tokens=1200,temperature=0.2)
        return r.choices[0].message.content
    except Exception as e: return f"⚠️ AI error: {e}"

def ai_popup(key, context, questions, bid):
    import hashlib
    with st.popover("✨ Ask AI"):
        st.markdown(f"**🤖 AI — {key}**")
        for q in questions:
            # Use full question hash so keys are always unique even with identical prefixes
            q_hash = hashlib.md5(f"{key}|{q}".encode()).hexdigest()[:8]
            if st.button(q, key=f"qaip_{q_hash}"):
                st.session_state[f"pending_q_{key}"] = q
        custom = st.text_input("Custom question:", key=f"cust_{key}")
        if custom and st.button("Send", key=f"csend_{key}", type="primary"):
            st.session_state[f"pending_q_{key}"] = custom
        pending = st.session_state.pop(f"pending_q_{key}", None)
        if pending:
            with st.spinner("Thinking…"):
                ans = ask_ai(pending, f"Business: {bid}\n{context}")
            st.markdown(f"**Q:** {pending}")
            st.markdown(f"**A:** {ans}")

# ════════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ════════════════════════════════════════════════════════════════════════════════
_,is_live,conn_err=get_conn()
with st.sidebar:
    st.markdown("# 🔬 KYB Intelligence Hub")
    if is_live: st.success("🟢 Redshift connected")
    else:
        st.error("🔴 Not connected"); st.caption(str(conn_err or "")[:60])
        if st.button("🔄 Retry"): st.cache_data.clear(); st.rerun()
    st.markdown("---")
    tab=st.radio("Section",[
        "🏠 Home","🏛️ Registry & Identity","🏭 Classification & KYB",
        "⚠️ Risk & Watchlist","💰 Worth Score","📋 All Facts","🤖 AI Agent"])

    # ── Date Range Filter ────────────────────────────────────────────────────
    st.markdown("---")
    st.markdown("**📅 Date Range**")
    use_dates = st.toggle("Filter by date", value=False,
                          help="Filter all queries to a specific onboarding period (received_at)")
    if use_dates:
        today = datetime.now(timezone.utc).date()
        d_from = st.date_input("From", value=today - pd.Timedelta(days=30),
                                max_value=today, key="hub_dfrom", label_visibility="collapsed")
        d_to   = st.date_input("To",   value=today,
                                max_value=today, key="hub_dto",   label_visibility="collapsed")
        if d_from > d_to: d_from = d_to
        st.caption(f"📅 {d_from} → {d_to}")
        hub_date_from, hub_date_to = str(d_from), str(d_to)
    else:
        hub_date_from, hub_date_to = None, None
        st.caption("Showing all data (no date filter)")

    def hub_date_clause(col="received_at"):
        parts = []
        if hub_date_from: parts.append(f"{col} >= '{hub_date_from}'")
        if hub_date_to:   parts.append(f"{col} <= '{hub_date_to} 23:59:59'")
        return (" AND " + " AND ".join(parts)) if parts else ""

    st.markdown("---")
    st.markdown("**Sources**")
    for s in ["rds_warehouse_public.facts","rds_manual_score_public.*",
              "rds_integration_data.*","clients.customer_table","warehouse.worth_score_input_audit"]:
        st.caption(f"`{s}`")

# ════════════════════════════════════════════════════════════════════════════════
# HOME — Live Dashboard
# ════════════════════════════════════════════════════════════════════════════════
if tab=="🏠 Home":
    st.markdown("# 🔬 KYB Intelligence Hub")

    # ── UUID quick-jump ──────────────────────────────────────────────────────
    col_bid, col_go = st.columns([4,1])
    with col_bid:
        bid_input = st.text_input("🔍 Jump to Business UUID",
                                   placeholder="Paste UUID here to investigate…",
                                   label_visibility="collapsed",
                                   key="home_bid_input")
    with col_go:
        if st.button("Investigate ▶", type="primary", use_container_width=True):
            if bid_input.strip():
                st.session_state["hub_bid"] = bid_input.strip()
                st.success(f"UUID set → navigate to any section in the sidebar.")

    if not is_live:
        st.error("🔴 Not connected to Redshift. Connect VPN and click Retry in the sidebar.")
        st.stop()

    # ── Date range label + refresh ────────────────────────────────────────────
    period_label = f"{hub_date_from} → {hub_date_to}" if hub_date_from else "All time"
    hdr_c, ref_c = st.columns([5,1])
    with hdr_c:
        st.caption(f"📅 Period: **{period_label}** · Toggle 'Filter by date' in sidebar to change")
    with ref_c:
        if st.button("🔄 Refresh", key="home_refresh", help="Clear cached data and reload from Redshift"):
            load_home_recent.clear(); load_home_flags.clear(); load_home_kyb_stats.clear(); st.rerun()
    st.markdown("---")

    # ── Load recently onboarded businesses (cached) ───────────────────────────
    with st.spinner("Loading portfolio data…"):
        recent_df, recent_err = load_home_recent(hub_date_from, hub_date_to)

    if recent_df is None or recent_df.empty:
        st.warning(f"No businesses found for this period. {recent_err or ''}")
        st.stop()

    total_biz = len(recent_df)

    # ── Red flag scoring (cached) ──────────────────────────────────────────────
    with st.spinner("Scoring red flags…"):
        flag_df, flag_err = load_home_flags(hub_date_from, hub_date_to)

    # Build per-business red flag summary
    biz_flags = {}  # business_id → {flags:[...], score:int}
    if flag_df is not None and not flag_df.empty:
        # Keep latest fact per business per name
        latest_facts = (flag_df.sort_values("received_at", ascending=False)
                               .drop_duplicates(subset=["business_id","name"])
                               .set_index(["business_id","name"])["val"]
                               .to_dict())

        for bid_check in recent_df["business_id"].tolist():
            flags = []
            score = 0  # higher = more red flags

            def fv(n):
                return str(latest_facts.get((bid_check,n),"") or "").lower()

            # Check each flag
            if fv("sos_active") == "false":
                flags.append(("🔴","SOS Inactive","Entity cannot legally operate"))
                score += 10
            if fv("sos_active") == "" and fv("sos_match_boolean") == "":
                flags.append(("🔴","No SOS data","Entity existence unverified"))
                score += 8
            if fv("tin_match_boolean") == "false":
                flags.append(("🔴","TIN Failed","EIN-name mismatch per IRS"))
                score += 6
            if fv("tin_match_boolean") == "":
                flags.append(("🟡","TIN Missing","EIN not submitted or not checked"))
                score += 3
            wl = int(float(fv("watchlist_hits") or 0)) if fv("watchlist_hits").replace(".","").isdigit() else 0
            if wl > 0:
                flags.append(("🔴",f"Watchlist {wl} hit(s)","Sanctions/PEP screening hit"))
                score += 12
            if fv("naics_code") == "561499":
                flags.append(("🟡","NAICS Fallback","Industry unclassified (561499)"))
                score += 2
            if fv("naics_code") == "":
                flags.append(("🟡","No NAICS","Classification missing"))
                score += 3
            if fv("idv_passed_boolean") == "false":
                flags.append(("🟡","IDV Failed","Identity verification failed"))
                score += 4
            bk = int(float(fv("num_bankruptcies") or 0)) if fv("num_bankruptcies").replace(".","").isdigit() else 0
            if bk > 0:
                flags.append(("🟡",f"BK: {bk}","Bankruptcy on record"))
                score += 3 * bk
            if flags or score > 0:
                biz_flags[bid_check] = {"flags": flags, "score": score}

    # ── Load enriched KYB stats (single bulk query) ───────────────────────────
    with st.spinner("Loading KYB metrics…"):
        stats_df, stats_err = load_home_kyb_stats(hub_date_from, hub_date_to)

    # Build per-business flag map from the pivoted stats_df (faster than flag_df loop)
    biz_flags = {}
    if stats_df is not None and not stats_df.empty:
        def _safe_str(v): return str(v or "").lower().strip()
        def _safe_int(v):
            try: return int(float(v or 0))
            except: return 0

        for _, sr in stats_df.iterrows():
            bid_check = sr["business_id"]
            flags=[]; score=0
            if _safe_str(sr["sos_active"])=="false":
                flags.append(("🔴","SOS Inactive","Entity cannot legally operate")); score+=10
            if _safe_str(sr["sos_active"])=="":
                flags.append(("🔴","No SOS data","Entity existence unverified")); score+=8
            if _safe_str(sr["tin_match"])=="false":
                flags.append(("🔴","TIN Failed","EIN-name mismatch per IRS")); score+=6
            if _safe_str(sr["tin_match"])=="":
                flags.append(("🟡","TIN Missing","EIN not submitted")); score+=3
            wl=_safe_int(sr["watchlist_hits"])
            if wl>0:
                flags.append(("🔴",f"Watchlist {wl} hit(s)","Sanctions/PEP hit")); score+=12
            nc=_safe_str(sr["naics_code"])
            if nc=="561499":
                flags.append(("🟡","NAICS Fallback","Industry unclassified")); score+=2
            elif nc=="":
                flags.append(("🟡","No NAICS","Classification missing")); score+=3
            if _safe_str(sr["idv_passed"])=="false":
                flags.append(("🟡","IDV Failed","Identity verification failed")); score+=4
            bk=_safe_int(sr["num_bankruptcies"])
            if bk>0:
                flags.append(("🟡",f"BK: {bk}","Bankruptcy on record")); score+=3*bk
            if flags: biz_flags[bid_check]={"flags":flags,"score":score}

    # Merge flags into recent_df
    recent_df["flag_score"] = recent_df["business_id"].map(lambda b: biz_flags.get(b,{}).get("score",0))
    recent_df["flag_count"] = recent_df["business_id"].map(lambda b: len(biz_flags.get(b,{}).get("flags",[])))
    recent_df["has_flags"]  = recent_df["flag_score"] > 0
    flagged_biz = recent_df[recent_df["has_flags"]].sort_values("flag_score",ascending=False)
    clean_biz   = recent_df[~recent_df["has_flags"]]

    # ── Helper: rate % ────────────────────────────────────────────────────────
    def rate(num, den): return f"{num/max(den,1)*100:.0f}%"

    # ── Pre-compute KYB health rates from stats_df ────────────────────────────
    if stats_df is not None and not stats_df.empty:
        n = len(stats_df)
        sos_ok   = (stats_df["sos_active"].str.lower().str.strip()=="true").sum()
        sos_fail = (stats_df["sos_active"].str.lower().str.strip()=="false").sum()
        sos_miss = n - sos_ok - sos_fail
        tin_ok   = (stats_df["tin_match"].str.lower().str.strip()=="true").sum()
        tin_fail = (stats_df["tin_match"].str.lower().str.strip()=="false").sum()
        idv_ok   = (stats_df["idv_passed"].str.lower().str.strip()=="true").sum()
        idv_fail = (stats_df["idv_passed"].str.lower().str.strip()=="false").sum()
        wl_biz   = (stats_df["watchlist_hits"].apply(lambda v: _safe_int(v)>0)).sum()
        naics_ok = (~stats_df["naics_code"].isin(["561499","",None]) &
                    stats_df["naics_code"].notna()).sum()
        naics_fb = (stats_df["naics_code"].str.strip()=="561499").sum()
        naics_ms = (stats_df["naics_code"].isna() | (stats_df["naics_code"].str.strip()=="")).sum()
        bk_biz   = (stats_df["num_bankruptcies"].apply(lambda v: _safe_int(v)>0)).sum()
        has_rev  = stats_df["revenue"].notna().sum()
        # formation state distribution
        state_counts = (stats_df["formation_state"]
                        .dropna().str.upper().str.strip()
                        .value_counts().head(10).reset_index())
        state_counts.columns=["State","Count"]
        # NAICS 2-digit sector
        def _sector(c):
            try: return str(int(str(c)[:2])) if c and str(c).strip() not in ("","561499") else None
            except: return None
        naics_sector = (stats_df["naics_code"].apply(_sector)
                        .dropna().value_counts().head(12).reset_index())
        naics_sector.columns=["Sector","Count"]
        # Onboarding timeline
        stats_df["first_seen_dt"] = pd.to_datetime(stats_df["first_seen"], errors="coerce")
        timeline = (stats_df.dropna(subset=["first_seen_dt"])
                    .set_index("first_seen_dt")
                    .resample("D")["business_id"].count()
                    .reset_index())
        timeline.columns=["Date","New Businesses"]
    else:
        n=total_biz; sos_ok=sos_fail=sos_miss=tin_ok=tin_fail=0
        idv_ok=idv_fail=wl_biz=naics_ok=naics_fb=naics_ms=bk_biz=has_rev=0
        state_counts=pd.DataFrame(); naics_sector=pd.DataFrame(); timeline=pd.DataFrame()

    # ════════════════════════════════════════════════════════════════════════
    # PORTFOLIO OVERVIEW DASHBOARD
    # ════════════════════════════════════════════════════════════════════════
    st.markdown("### 📊 Portfolio Overview")
    st.caption(f"📅 **{period_label}** · {total_biz:,} businesses · data from `rds_warehouse_public.facts`")

    # ── Row 1: KPI cards ─────────────────────────────────────────────────────
    c1,c2,c3,c4,c5,c6 = st.columns(6)
    with c1: kpi("Total","" + f"{total_biz:,}","businesses","#3B82F6")
    with c2: kpi("🚨 Red Flags",f"{len(flagged_biz):,}",rate(len(flagged_biz),total_biz)+" flagged","#ef4444" if flagged_biz.shape[0]>0 else "#22c55e")
    with c3: kpi("SOS Active",f"{sos_ok:,}",rate(sos_ok,n)+" pass rate","#22c55e" if sos_ok/max(n,1)>0.8 else "#f97316")
    with c4: kpi("TIN Verified",f"{tin_ok:,}",rate(tin_ok,n)+" pass rate","#22c55e" if tin_ok/max(n,1)>0.8 else "#f59e0b")
    with c5: kpi("IDV Passed",f"{idv_ok:,}",rate(idv_ok,n)+" pass rate","#22c55e" if idv_ok/max(n,1)>0.7 else "#f59e0b")
    with c6: kpi("Watchlist Hits",f"{wl_biz:,}",rate(wl_biz,n)+" affected","#ef4444" if wl_biz>0 else "#22c55e")

    st.markdown("---")

    # ── Row 2: KYB Health Gauges + Onboarding Timeline ───────────────────────
    col_health, col_timeline = st.columns([1,2])

    with col_health:
        st.markdown("#### 🩺 KYB Health Rates")
        metrics = [
            ("SOS Active",    sos_ok,   sos_fail, sos_miss,  n, "#22c55e","#ef4444"),
            ("TIN Verified",  tin_ok,   tin_fail, n-tin_ok-tin_fail, n, "#22c55e","#ef4444"),
            ("IDV Passed",    idv_ok,   idv_fail, n-idv_ok-idv_fail, n, "#22c55e","#f59e0b"),
            ("NAICS Classified", naics_ok, naics_fb, naics_ms, n, "#22c55e","#f59e0b"),
            ("Revenue Known", has_rev,  0, n-has_rev, n, "#22c55e","#64748b"),
        ]
        for label,ok_n,fail_n,miss_n,total_n,ok_col,fail_col in metrics:
            ok_pct   = int(ok_n/max(total_n,1)*100)
            fail_pct = int(fail_n/max(total_n,1)*100)
            miss_pct = 100-ok_pct-fail_pct
            bar_html = (
                f'<div style="display:flex;height:10px;border-radius:5px;overflow:hidden;margin:3px 0">'
                f'<div style="width:{ok_pct}%;background:{ok_col}"></div>'
                f'<div style="width:{fail_pct}%;background:{fail_col}"></div>'
                f'<div style="width:{miss_pct}%;background:#334155"></div>'
                f'</div>'
            )
            st.markdown(f"""<div style="margin:6px 0">
              <div style="display:flex;justify-content:space-between">
                <span style="color:#CBD5E1;font-size:.78rem;font-weight:600">{label}</span>
                <span style="color:{ok_col};font-size:.78rem;font-weight:700">{ok_pct}% ✓</span>
              </div>
              {bar_html}
              <div style="display:flex;gap:12px;font-size:.68rem;color:#64748b;margin-top:1px">
                <span style="color:{ok_col}">✓ {ok_n:,}</span>
                <span style="color:{fail_col}">✗ {fail_n:,}</span>
                <span>? {miss_n:,}</span>
              </div>
            </div>""", unsafe_allow_html=True)

    with col_timeline:
        st.markdown("#### 📈 Onboarding Timeline")
        if not timeline.empty:
            fig_t = px.area(timeline, x="Date", y="New Businesses",
                            title=f"Daily New Businesses ({period_label})",
                            color_discrete_sequence=["#3B82F6"])
            fig_t.update_traces(fill="tozeroy", fillcolor="rgba(59,130,246,0.15)",
                                line=dict(width=2))
            fig_t.update_layout(height=260, margin=dict(t=40,b=20,l=10,r=10))
            st.plotly_chart(dark_chart(fig_t), use_container_width=True)
        else:
            st.info("Timeline requires date-filtered data. Enable 'Filter by date' in sidebar.")

    st.markdown("---")

    # ── Row 3: Red Flag Distribution + Risk Donut + NAICS Sectors ────────────
    # ── Row 3a: Red Flag Distribution (horizontal, consolidated) + NAICS ────────
    col_flags, col_naics = st.columns([3,2])

    with col_flags:
        st.markdown("#### 🚩 Red Flag Distribution")
        # Consolidate: merge all "Watchlist N hit(s)" → "Watchlist hits"
        #              merge all "BK: N" → "Bankruptcy"
        flag_type_counts={}
        for b_data in biz_flags.values():
            for _,flag_title,_ in b_data["flags"]:
                if flag_title.startswith("Watchlist"): key="Watchlist hits"
                elif flag_title.startswith("BK:"): key="Bankruptcy"
                else: key=flag_title
                flag_type_counts[key]=flag_type_counts.get(key,0)+1
        if flag_type_counts:
            fdf=pd.DataFrame(list(flag_type_counts.items()),columns=["Issue","Count"])\
                  .sort_values("Count",ascending=True)  # ascending for horizontal bar
            COLOR_MAP={
                "IDV Failed":"#f59e0b","TIN Failed":"#ef4444","TIN Missing":"#f97316",
                "SOS Inactive":"#dc2626","No SOS data":"#f97316",
                "NAICS Fallback":"#6366f1","No NAICS":"#8B5CF6",
                "Watchlist hits":"#dc2626","Bankruptcy":"#a855f7",
            }
            bar_colors=[COLOR_MAP.get(iss,"#64748b") for iss in fdf["Issue"]]
            fig_f=go.Figure(go.Bar(
                x=fdf["Count"], y=fdf["Issue"],
                orientation="h",
                marker_color=bar_colors,
                text=fdf["Count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                textfont=dict(color="#E2E8F0", size=12),
            ))
            fig_f.update_layout(
                height=max(180, len(fdf)*38),
                margin=dict(t=30, b=10, l=10, r=60),
                xaxis=dict(showgrid=False, showticklabels=False, title=""),
                yaxis=dict(title="", tickfont=dict(size=12)),
            )
            st.plotly_chart(dark_chart(fig_f), use_container_width=True)
            st.caption("Each bar = number of businesses with that specific issue. "
                       "One business can appear in multiple bars.")
        else:
            flag("✅ No red flags detected in this period","green")

    with col_naics:
        st.markdown("#### 🏭 Top Industry Sectors")
        SECTOR_NAMES={"11":"Agriculture","21":"Mining","22":"Utilities","23":"Construction",
                      "31":"Manufacturing","32":"Manufacturing","33":"Manufacturing",
                      "42":"Wholesale","44":"Retail","45":"Retail","48":"Transport",
                      "49":"Transport","51":"Information","52":"Finance","53":"Real Estate",
                      "54":"Professional Svcs","55":"Mgmt","56":"Admin Svcs",
                      "61":"Education","62":"Health","71":"Arts","72":"Food & Accom",
                      "81":"Other Services","92":"Public Admin"}
        if not naics_sector.empty:
            naics_sector["Label"]=naics_sector["Sector"].map(
                lambda s: f"{SECTOR_NAMES.get(s,s)} ({s})")
            naics_sector_plot=naics_sector.sort_values("Count",ascending=True)
            fig_n=go.Figure(go.Bar(
                x=naics_sector_plot["Count"], y=naics_sector_plot["Label"],
                orientation="h",
                marker_color="#3B82F6",
                text=naics_sector_plot["Count"].apply(lambda v: f"{v:,}"),
                textposition="outside",
                textfont=dict(color="#E2E8F0",size=11),
            ))
            fig_n.update_layout(
                height=max(180,len(naics_sector_plot)*38),
                margin=dict(t=30,b=10,l=10,r=60),
                xaxis=dict(showgrid=False,showticklabels=False,title=""),
                yaxis=dict(title="",tickfont=dict(size=11)),
            )
            st.plotly_chart(dark_chart(fig_n),use_container_width=True)
        else:
            st.info("No NAICS data available.")

    st.markdown("---")

    # ── Row 3b: Worth Score Distribution ─────────────────────────────────────
    st.markdown("#### 💰 Worth Score Distribution")
    st.caption("From `rds_manual_score_public.business_scores` · score_decision breakdown across portfolio")

    @st.cache_data(ttl=600, show_spinner=False)
    def load_worth_score_dist(date_from, date_to):
        parts=[]
        if date_from: parts.append(f"bs.created_at >= '{date_from}'")
        if date_to:   parts.append(f"bs.created_at <= '{date_to} 23:59:59'")
        dc=(" AND "+" AND ".join(parts)) if parts else ""
        return run_sql(f"""
            SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision
            FROM rds_manual_score_public.data_current_scores cs
            JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
            WHERE 1=1{dc}
            LIMIT 5000
        """)

    ws_df, ws_err = load_worth_score_dist(hub_date_from, hub_date_to)
    if ws_df is not None and not ws_df.empty:
        ws_df["weighted_score_850"] = pd.to_numeric(ws_df["weighted_score_850"], errors="coerce")
        ws_df = ws_df.dropna(subset=["weighted_score_850"])

        wc1,wc2,wc3,wc4 = st.columns(4)
        approved   = (ws_df["score_decision"]=="APPROVE").sum()
        review     = (ws_df["score_decision"]=="FURTHER_REVIEW_NEEDED").sum()
        declined   = (ws_df["score_decision"]=="DECLINE").sum()
        median_sc  = ws_df["weighted_score_850"].median()
        with wc1: kpi("Median Score",f"{median_sc:.0f}","300–850 scale","#3B82F6")
        with wc2: kpi("✅ Approve",f"{approved:,}",rate(approved,len(ws_df)),"#22c55e")
        with wc3: kpi("🔎 Review",f"{review:,}",rate(review,len(ws_df)),"#f59e0b")
        with wc4: kpi("❌ Decline",f"{declined:,}",rate(declined,len(ws_df)),"#ef4444")

        wsc1, wsc2 = st.columns([2,1])
        with wsc1:
            fig_ws = px.histogram(
                ws_df, x="weighted_score_850", nbins=40,
                color="score_decision",
                color_discrete_map={
                    "APPROVE":"#22c55e",
                    "FURTHER_REVIEW_NEEDED":"#f59e0b",
                    "DECLINE":"#ef4444",
                },
                labels={"weighted_score_850":"Worth Score (300–850)","score_decision":"Decision"},
                title="Worth Score Distribution by Decision",
                barmode="stack",
            )
            fig_ws.update_layout(height=300,legend=dict(orientation="h",y=-0.2),
                                 margin=dict(t=40,b=40,l=10,r=10))
            st.plotly_chart(dark_chart(fig_ws),use_container_width=True)
        with wsc2:
            # Decision breakdown by risk_level
            rl_counts = ws_df.groupby(["risk_level","score_decision"]).size().reset_index(name="Count")
            if not rl_counts.empty:
                fig_rl=px.bar(rl_counts,x="risk_level",y="Count",color="score_decision",
                              barmode="stack",
                              color_discrete_map={"APPROVE":"#22c55e",
                                                  "FURTHER_REVIEW_NEEDED":"#f59e0b",
                                                  "DECLINE":"#ef4444"},
                              title="By Risk Level",
                              labels={"risk_level":"Risk Level","score_decision":"Decision"})
                fig_rl.update_layout(height=300,showlegend=False,
                                     margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_rl),use_container_width=True)
    else:
        st.info(f"Worth Score data not available. {ws_err or 'Check VPN / Redshift access.'}")

    st.markdown("---")

    # ── Row 4: Domestic/Foreign + TIN Sources + Formation States ─────────────
    col_domfor, col_tin, col_states = st.columns([1,1,1])

    with col_domfor:
        st.markdown("#### 🗺️ Domestic vs Foreign Registration")
        if stats_df is not None and not stats_df.empty:
            TAX_HAVENS={"DE","NV","WY","SD","MT","NM"}
            total_with_state = stats_df["formation_state"].notna().sum()
            th_count = stats_df["formation_state"].str.upper().str.strip().isin(TAX_HAVENS).sum()
            non_th   = total_with_state - th_count
            no_state = n - total_with_state

            # Pie: tax haven vs non-tax-haven vs missing
            fig_dom=go.Figure(go.Pie(
                labels=["Tax-Haven State\n(DE/NV/WY/SD/MT/NM)","Other State","No State Data"],
                values=[th_count, non_th, no_state],
                marker=dict(colors=["#f59e0b","#3B82F6","#334155"]),
                hole=0.5,
                textinfo="percent+value",
                textfont=dict(size=11),
            ))
            fig_dom.update_layout(height=220,showlegend=False,
                                  margin=dict(t=10,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_dom),use_container_width=True)
            st.caption("Tax-haven states (DE, NV, WY, SD, MT, NM) are high-risk for entity resolution gaps: "
                       "Middesk finds the FOREIGN filing, missing the DOMESTIC primary record.")

            # Top states table
            if not state_counts.empty:
                sc2=state_counts.copy()
                sc2["Tax Haven"]=sc2["State"].isin(TAX_HAVENS).map({True:"⚠️ Yes",False:"No"})
                st.dataframe(sc2[["State","Count","Tax Haven"]].head(8),
                             use_container_width=True,hide_index=True)
        else:
            st.info("No formation state data available.")

    with col_tin:
        st.markdown("#### 🔐 TIN Verification Breakdown")
        if stats_df is not None and not stats_df.empty:
            tin_true  = (stats_df["tin_match"].str.lower().str.strip()=="true").sum()
            tin_false = (stats_df["tin_match"].str.lower().str.strip()=="false").sum()
            tin_null  = n - tin_true - tin_false

            # Donut: pass/fail/missing
            fig_tin=go.Figure(go.Pie(
                labels=["✅ TIN Verified","❌ TIN Failed","⚪ Not Checked"],
                values=[tin_true,tin_false,tin_null],
                marker=dict(colors=["#22c55e","#ef4444","#334155"]),
                hole=0.5,
                textinfo="percent+value",
                textfont=dict(size=11),
            ))
            fig_tin.update_layout(height=220,showlegend=False,
                                  margin=dict(t=10,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_tin),use_container_width=True)

            # Source concordance: SOS active vs TIN verified cross-tab
            st.markdown("**Source Concordance — SOS × TIN**")
            if stats_df is not None and not stats_df.empty:
                def _sos_label(v):
                    s=str(v or "").lower().strip()
                    return "SOS Active" if s=="true" else ("SOS Inactive" if s=="false" else "SOS Unknown")
                def _tin_label(v):
                    s=str(v or "").lower().strip()
                    return "TIN Pass" if s=="true" else ("TIN Fail" if s=="false" else "TIN Unknown")
                ct=stats_df.copy()
                ct["SOS"]=ct["sos_active"].apply(_sos_label)
                ct["TIN"]=ct["tin_match"].apply(_tin_label)
                cross=ct.groupby(["SOS","TIN"]).size().reset_index(name="Count")
                cross=cross.sort_values("Count",ascending=False)
                # Color code
                def _cross_color(row):
                    if row["SOS"]=="SOS Active" and row["TIN"]=="TIN Pass": return "✅ Good"
                    if row["SOS"]=="SOS Inactive" or row["TIN"]=="TIN Fail": return "🔴 Review"
                    return "🟡 Check"
                cross["Signal"]=cross.apply(_cross_color,axis=1)
                st.dataframe(cross[["SOS","TIN","Count","Signal"]],
                             use_container_width=True,hide_index=True)
        else:
            st.info("No TIN data available.")

    with col_states:
        st.markdown("#### 📜 Public Records & Sources")
        if stats_df is not None and not stats_df.empty:
            am_count=(stats_df["adverse_media"].apply(lambda v:_safe_int(v)>0)).sum()

            # Public records summary
            pr_items=[
                ("Watchlist hits",wl_biz,"#ef4444","Businesses with ≥1 PEP/Sanctions hit"),
                ("Adverse Media",am_count,"#f59e0b","Businesses with negative press coverage"),
                ("Bankruptcies",bk_biz,"#8B5CF6","Businesses with ≥1 bankruptcy on file"),
            ]
            for label,count,color,desc in pr_items:
                pct=rate(count,n)
                st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                    border-radius:8px;padding:10px 14px;margin:4px 0">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#CBD5E1;font-weight:600;font-size:.82rem">{label}</span>
                    <span style="color:{color};font-weight:700;font-size:1.1rem">{count:,}</span>
                  </div>
                  <div style="color:#64748b;font-size:.70rem;margin-top:2px">{pct} · {desc}</div>
                </div>""",unsafe_allow_html=True)

            # IDV source concordance
            st.markdown("**IDV × SOS Concordance**")
            def _idv_label(v):
                s=str(v or "").lower().strip()
                return "IDV Pass" if s=="true" else ("IDV Fail" if s=="false" else "IDV Unknown")
            ct2=stats_df.copy()
            ct2["SOS"]=ct2["sos_active"].apply(lambda v: "SOS Active" if str(v or "").lower().strip()=="true" else ("SOS Inactive" if str(v or "").lower().strip()=="false" else "SOS Unknown"))
            ct2["IDV"]=ct2["idv_passed"].apply(_idv_label)
            cross2=ct2.groupby(["SOS","IDV"]).size().reset_index(name="Count").sort_values("Count",ascending=False)
            def _c2(row):
                if row["SOS"]=="SOS Active" and row["IDV"]=="IDV Pass": return "✅"
                if row["SOS"]=="SOS Inactive" or row["IDV"]=="IDV Fail": return "🔴"
                return "🟡"
            cross2["OK"]=cross2.apply(_c2,axis=1)
            st.dataframe(cross2[["SOS","IDV","Count","OK"]],
                         use_container_width=True,hide_index=True)
        else:
            st.info("No public records data available.")

    st.markdown("---")

    # ── Recently Onboarded (most recent 10) ──────────────────────────────────
    st.markdown("### 🕐 Recently Onboarded Businesses")
    st.markdown("*Most recently seen in the facts table — ordered by first_seen DESC.*")

    recent_10 = recent_df.head(10).copy()
    recent_10["Status"] = recent_10.apply(lambda r:
        f"🔴 {r['flag_count']} flag(s)" if r["flag_score"]>0 else "✅ Clean", axis=1)
    recent_10["first_seen"] = recent_10["first_seen"].astype(str).str[:16]
    recent_10["last_updated"] = recent_10["last_updated"].astype(str).str[:16]

    for _, row in recent_10.iterrows():
        bid_check = row["business_id"]
        b_data    = biz_flags.get(bid_check, {})
        flags     = b_data.get("flags",[])
        score     = b_data.get("score",0)
        border    = "#ef4444" if score>=10 else ("#f59e0b" if score>0 else "#22c55e")

        def _pill_bg(ic): return {"🔴":"#7f1d1d","🟡":"#78350f"}.get(ic,"#1e293b")
        def _pill_fg(ic): return {"🔴":"#fca5a5","🟡":"#fde68a"}.get(ic,"#cbd5e1")
        flags_html = "".join(
            f'<span style="background:{_pill_bg(icon)};color:{_pill_fg(icon)};'
            f'padding:2px 6px;border-radius:10px;font-size:.68rem;margin:1px">{icon} {title}</span>'
            for icon,title,_ in flags
        ) if flags else '<span style="color:#22c55e;font-size:.72rem">✅ No issues detected</span>'

        col_card, col_btn = st.columns([5,1])
        with col_card:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {border};
                border-radius:10px;padding:12px 16px;margin:4px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:#60A5FA;font-family:monospace;font-size:.80rem;font-weight:700">
                  {bid_check}</span>
                <span style="color:#64748b;font-size:.70rem">
                  First seen: {row['first_seen']} · {row['fact_count']} facts</span>
              </div>
              <div style="margin-top:6px">{flags_html}</div>
            </div>""", unsafe_allow_html=True)
        with col_btn:
            st.markdown("<br>", unsafe_allow_html=True)
            if st.button("Investigate →", key=f"inv_{bid_check}", use_container_width=True):
                st.session_state["hub_bid"] = bid_check
                st.success(f"UUID set. Navigate to any section in the sidebar.")

    st.markdown("---")

    # ── Top 10 Red Flags ─────────────────────────────────────────────────────
    st.markdown("### 🚨 Top 10 Businesses Needing Attention")
    st.markdown("*Ranked by severity of red flags — highest risk at the top.*")

    # Weight metadata for score breakdown tooltip
    FLAG_WEIGHT_META = {
        "SOS Inactive":      (10, "🔴", "sos_active = false",       "Entity not in good standing with Secretary of State. Cannot legally operate."),
        "No SOS data":       ( 8, "🔴", "sos_active + sos_match = ∅","Entity existence completely unverified — vendor lookup may have failed."),
        "TIN Failed":        ( 6, "🔴", "tin_match_boolean = false", "IRS EIN-name mismatch. Potential identity fraud or incorrect EIN filing."),
        "TIN Missing":       ( 3, "🟡", "tin_match_boolean = ∅",    "EIN not submitted or TIN check not yet run. May be onboarding lag."),
        "IDV Failed":        ( 4, "🟡", "idv_passed_boolean = false","Beneficial owner identity not confirmed via Plaid/Trulioo."),
        "NAICS Fallback":    ( 2, "🟡", "naics_code = 561499",      "Industry unclassified — all vendors failed, AI used fallback code."),
        "No NAICS":          ( 3, "🟡", "naics_code = ∅",           "No industry classification stored at all."),
    }

    if flagged_biz.empty:
        flag("✅ No red flags detected in this period. All businesses appear clean.", "green")
    else:
        top10 = flagged_biz.head(10)
        for rank, (_, row) in enumerate(top10.iterrows(), 1):
            bid_check = row["business_id"]
            b_data    = biz_flags.get(bid_check, {})
            flags_list = b_data.get("flags",[])
            score      = b_data.get("score",0)

            sev_color = "#ef4444" if score>=10 else "#f97316" if score>=6 else "#f59e0b"
            sev_label = "🔴 CRITICAL" if score>=12 else "🔴 HIGH" if score>=8 else "🟡 MEDIUM"

            def _pill2(icon,title):
                bg={"🔴":"#7f1d1d","🟡":"#78350f"}.get(icon,"#1e293b")
                fg={"🔴":"#fca5a5","🟡":"#fde68a"}.get(icon,"#cbd5e1")
                return f'<span style="background:{bg};color:{fg};padding:2px 7px;border-radius:10px;font-size:.70rem;margin:2px;display:inline-block">{icon} {title}</span>'
            flag_pills  = "".join(_pill2(i,t) for i,t,_ in flags_list)
            flag_detail = " · ".join(desc for _,_,desc in flags_list)

            col_rank, col_card, col_btn = st.columns([0.3,5,1])
            with col_rank:
                st.markdown(f"""<div style="background:{sev_color}22;border-radius:8px;
                    padding:8px;text-align:center;margin-top:6px">
                  <div style="color:{sev_color};font-weight:700;font-size:1rem">#{rank}</div>
                  <div style="color:{sev_color};font-size:.60rem">score {score}</div>
                </div>""", unsafe_allow_html=True)
            with col_card:
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {sev_color};
                    border-radius:10px;padding:12px 16px;margin:4px 0">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start">
                    <span style="color:#60A5FA;font-family:monospace;font-size:.82rem;font-weight:700">
                      {bid_check}</span>
                    <span style="color:{sev_color};font-size:.72rem;font-weight:700">{sev_label}</span>
                  </div>
                  <div style="margin:6px 0">{flag_pills}</div>
                  <div style="color:#94A3B8;font-size:.72rem;margin-top:4px;font-style:italic">
                    {flag_detail}</div>
                  <div style="color:#475569;font-size:.68rem;margin-top:4px">
                    First seen: {str(row['first_seen'])[:16]} · {row['fact_count']} facts stored</div>
                </div>""", unsafe_allow_html=True)

                # ── Score breakdown expander ──────────────────────────────
                with st.expander(f"📊 Score breakdown — {score} pts from {len(flags_list)} flag(s)"):
                    # Build rows: match each flag to its metadata
                    breakdown_rows = []
                    running = 0
                    for icon, title, desc in flags_list:
                        # Watchlist is dynamic (title contains hit count)
                        if "Watchlist" in title:
                            wl_count = int(''.join(filter(str.isdigit, title)) or 0)
                            pts = 12
                            fact_field = f"watchlist_hits = {wl_count}"
                            explanation = "Sanctions/PEP screening hit (OFAC/FinCEN). Hard stop — compliance review mandatory."
                        elif "BK:" in title:
                            bk_count = int(''.join(filter(str.isdigit, title)) or 1)
                            pts = 3 * bk_count
                            fact_field = f"num_bankruptcies = {bk_count}"
                            explanation = f"Public bankruptcy record(s). Score = +3 per filing (×{bk_count})."
                        else:
                            meta = FLAG_WEIGHT_META.get(title, (0, icon, "—", desc))
                            pts, _, fact_field, explanation = meta
                        running += pts
                        bar_pct = int(pts / max(score, 1) * 100)
                        bar_color = "#ef4444" if icon == "🔴" else "#f59e0b"
                        breakdown_rows.append((icon, title, pts, running, bar_pct, bar_color, fact_field, explanation))

                    # Render score receipt
                    st.markdown("""<div style="font-size:.72rem;color:#94A3B8;margin-bottom:6px">
                        Each row = one detected condition → its fixed weight → running total.
                        Total = sum of all weights. No ML, no normalization.</div>""",
                        unsafe_allow_html=True)

                    for icon, title, pts, cumul, bar_pct, bar_color, fact_field, explanation in breakdown_rows:
                        st.markdown(f"""<div style="background:#0f172a;border-radius:8px;
                            padding:10px 14px;margin:4px 0;border:1px solid #1e293b">
                          <div style="display:flex;justify-content:space-between;align-items:center">
                            <div>
                              <span style="color:{bar_color};font-weight:700;font-size:.82rem">
                                {icon} {title}</span>
                              <span style="color:#64748b;font-size:.70rem;margin-left:8px">
                                fact: <code style="color:#93c5fd">{fact_field}</code></span>
                            </div>
                            <div style="text-align:right">
                              <span style="color:{bar_color};font-weight:700;font-size:.90rem">
                                +{pts} pts</span>
                              <span style="color:#475569;font-size:.68rem;margin-left:6px">
                                → {cumul} total</span>
                            </div>
                          </div>
                          <div style="background:#1e293b;border-radius:4px;height:4px;margin:6px 0">
                            <div style="background:{bar_color};width:{bar_pct}%;height:4px;
                              border-radius:4px"></div>
                          </div>
                          <div style="color:#94A3B8;font-size:.70rem">{explanation}</div>
                        </div>""", unsafe_allow_html=True)

                    # Final score summary bar
                    max_possible = 12+10+8+6+4+3+3+3  # all flags triggered
                    overall_pct  = int(score / max_possible * 100)
                    st.markdown(f"""<div style="background:#1e293b;border-radius:8px;
                        padding:10px 14px;margin-top:8px;border:1px solid #334155">
                      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                        <span style="color:#e2e8f0;font-weight:700;font-size:.80rem">
                          Total Red Flag Score</span>
                        <span style="color:{sev_color};font-weight:700;font-size:.95rem">
                          {score} / {max_possible} pts max · {sev_label}</span>
                      </div>
                      <div style="background:#0f172a;border-radius:4px;height:8px">
                        <div style="background:{sev_color};width:{overall_pct}%;height:8px;
                          border-radius:4px"></div>
                      </div>
                      <div style="color:#64748b;font-size:.68rem;margin-top:4px">
                        Max possible = 49 pts (all flags triggered simultaneously).
                        Score ≥12=CRITICAL · 8–11=HIGH · 1–7=MEDIUM.
                        This is a triage heuristic — not the Worth Score, not a regulatory score.
                      </div>
                    </div>""", unsafe_allow_html=True)

                    # Recommended action
                    if score >= 12:
                        action = "🚨 **Immediate action required.** Compliance review before any underwriting decision. If SANCTIONS hit present — hard stop, escalate to Compliance team."
                    elif score >= 8:
                        action = "⚠️ **Manual underwriting required.** Review SOS reinstatement status, TIN documentation, and IDV retry before approval."
                    else:
                        action = "🟡 **Low-priority review.** Check for data freshness — flags may reflect onboarding lag rather than genuine risk."
                    st.markdown(f"**Recommended action:** {action}")

            with col_btn:
                st.markdown("<br>", unsafe_allow_html=True)
                if st.button("Investigate →", key=f"top10_{bid_check}", use_container_width=True):
                    st.session_state["hub_bid"] = bid_check
                    st.success("UUID set. Navigate to any section in the sidebar.")

        st.markdown("---")
        st.markdown("#### 🧮 Red Flag Score — Methodology Card")
        st.markdown("""<div style="background:#1E293B;border-left:4px solid #6366f1;border-radius:10px;padding:16px 20px;margin:8px 0">

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin-bottom:6px">
  📐 What is this score?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  This is a <strong>custom additive heuristic</strong> built specifically for this dashboard.
  It is <em>not</em> sourced from any external scoring model, regulatory framework, or vendor.
  It is not the Worth Score, not an AML risk score, and not a credit score.
  It exists solely to <strong>rank and surface businesses needing manual review</strong>
  on the Home tab — a triage signal, not a decisioning tool.
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  ⚙️ How is it calculated?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  Each detected condition adds a fixed integer to a running total.
  Conditions are checked independently — a business can accumulate multiple flags.
  The final score is the <strong>sum of all triggered weights</strong>.
  There is no normalization, no probability model, and no ML inference involved.
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  🏗️ Why these specific weights?
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  Weights reflect <strong>compliance and underwriting priority order</strong>, derived from
  the internal KYB decision logic documented across the Fact Engine, integration-service rules,
  and the Worth Score model feature importance. The relative ordering follows these principles:
  <ul style="margin:6px 0 0 16px;color:#CBD5E1">
    <li><strong>Sanctions/Watchlist (+12)</strong> — regulatory hard stop per OFAC/FinCEN guidance.
      Any watchlist hit mandates compliance review before any other action. Highest weight.</li>
    <li><strong>SOS Inactive (+10)</strong> — a business that is not in good standing with its
      Secretary of State cannot legally operate. Maps to the <code>sos_active</code> fact from Middesk.</li>
    <li><strong>No SOS data (+8)</strong> — entity existence is completely unverified.
      Slightly lower than inactive because the vendor lookup may simply have failed,
      not because the entity is confirmed bad.</li>
    <li><strong>TIN Failed (+6)</strong> — IRS EIN-name mismatch (Middesk TIN check).
      Indicates possible identity fraud or incorrect filing. Serious but recoverable
      with corrected documentation.</li>
    <li><strong>IDV Failed (+4)</strong> — beneficial owner identity not confirmed (Trulioo/IDology).
      Significant for KYC but does not by itself block merchant from existing.</li>
    <li><strong>Missing TIN / NAICS (+2–3)</strong> — data gaps. May be timing (not yet enriched)
      rather than a true problem. Lower weight to avoid false alarms on newly onboarded merchants.</li>
    <li><strong>Bankruptcy (+3 each)</strong> — public record on file. Weighted per occurrence
      because multiple bankruptcies compound the credit risk signal.</li>
  </ul>
</div>

<div style="color:#a5b4fc;font-weight:700;font-size:.95rem;margin:12px 0 6px">
  ⚠️ Limitations & intended use
</div>
<div style="color:#CBD5E1;font-size:.82rem;line-height:1.7">
  <ul style="margin:4px 0 0 16px">
    <li>This score is a <strong>triage / prioritisation tool only</strong>. It should not be used
      for automated approval or decline decisions.</li>
    <li>Weights are <strong>not statistically calibrated</strong>. They have not been validated
      against historical default or fraud rates.</li>
    <li>A score of 0 does not mean the business is safe — it means no flags were detected
      in the facts currently stored in Redshift.</li>
    <li>Data latency in <code>rds_warehouse_public.facts</code> means some flags may appear
      minutes or hours after onboarding.</li>
    <li>To make this score production-grade, replace it with the Worth Score
      (<code>rds_manual_score_public.business_scores</code>) or the BERT review signal
      (<code>rds_integration_data.business_entity_review_task</code>).</li>
  </ul>
</div>

<div style="color:#475569;font-size:.72rem;margin-top:12px;border-top:1px solid #334155;padding-top:8px">
  Source: Custom dashboard heuristic. Internal reference:
  integration-service <code>lib/facts/rules.ts</code> (rule priority ordering),
  Worth Score feature importance (<code>ai-score-service/worth_score_model.py</code>),
  OFAC/FinCEN KYC guidance (watchlist hard-stop).
  Not a regulatory-compliant risk score.
</div>
</div>""", unsafe_allow_html=True)

        st.markdown("**Score weights at a glance:**")
        st.markdown("""
| Flag | Score | Regulatory / operational basis |
|---|---|---|
| 🔴 Watchlist hit | +12 | OFAC/FinCEN hard stop — highest compliance priority |
| 🔴 SOS Inactive | +10 | Entity legally cannot operate in its state |
| 🔴 No SOS data | +8 | Entity existence unverifiable — vendor lookup may have failed |
| 🔴 TIN Failed | +6 | IRS EIN-name mismatch — potential identity fraud signal |
| 🟡 IDV Failed | +4 | Beneficial owner identity not confirmed |
| 🟡 Missing TIN | +3 | EIN not submitted or not yet checked |
| 🟡 No / Fallback NAICS | +2–3 | Classification gap — industry unverified |
| 🟡 Bankruptcy (per occurrence) | +3 | Public record — additive per filing |

**Score ≥ 12** = Critical · **8–11** = High · **1–7** = Medium · **0** = No flags detected
        """)

# ════════════════════════════════════════════════════════════════════════════════
# REGISTRY & IDENTITY
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🏛️ Registry & Identity":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 🏛️ Registry & Identity — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"registry")
    if facts is None: st.error(f"❌ {err}"); st.stop()
    if not facts: st.error("No facts found."); st.stop()
    st.caption(f"✅ {len(facts)} facts loaded")

    sos_act  =str(gv(facts,"sos_active") or "").lower()
    sos_match=str(gv(facts,"sos_match_boolean") or "").lower()
    tin_bool =str(gv(facts,"tin_match_boolean") or "").lower()
    tin_obj  =facts.get("tin_match",{}).get("value",{})
    if isinstance(tin_obj,dict): tin_status=tin_obj.get("status","").lower(); tin_msg=tin_obj.get("message","")
    else: tin_status=tin_msg=""
    idv_val  =str(gv(facts,"idv_passed_boolean") or "").lower()
    mdsk_conf=gc(facts,"sos_match")
    form_state=str(gv(facts,"formation_state") or "")

    c1,c2,c3,c4,c5=st.columns(5)
    with c1: kpi("SOS","✅ Active" if sos_act=="true" else "🚨 Inactive" if sos_act=="false" else "⚠️ Unknown",
                 "sos_active","#22c55e" if sos_act=="true" else "#ef4444")
    with c2: kpi("SOS Match","✅ Matched" if sos_match=="true" else "❌ No match" if sos_match=="false" else "⚠️ Unknown",
                 f"Middesk conf: {mdsk_conf:.3f}","#22c55e" if sos_match=="true" else "#ef4444")
    with c3: kpi("TIN","✅ Verified" if tin_bool=="true" else f"❌ {tin_status.capitalize()}" if tin_status else "⚠️ Unknown",
                 "tin_match_boolean","#22c55e" if tin_bool=="true" else "#ef4444")
    with c4: kpi("IDV","✅ Passed" if idv_val=="true" else "❌ Not passed" if idv_val=="false" else "⚠️ Unknown",
                 "idv_passed_boolean","#22c55e" if idv_val=="true" else "#f59e0b")
    with c5:
        tax_haven=form_state.upper() in ("DE","NV","WY")
        kpi("Formation State",form_state or "Unknown",
            "⚠️ Tax haven — entity resolution gap risk" if tax_haven else "formation_state fact",
            "#f59e0b" if tax_haven else "#3B82F6")

    r1,r2,r3,r4,r5=st.tabs(["🏛️ SOS","🗺️ Dom/Foreign","🔐 TIN","🪪 IDV","🔗 Cross-Analysis"])

    with r1:
        st.markdown("#### SOS Registry — Full Data Lineage")
        st.caption("""**Data source:** `rds_warehouse_public.facts` (Redshift federated view of PostgreSQL RDS) ·
        **Winning source:** Middesk (pid=16, weight=2.0) or OpenCorporates (pid=23, weight=0.9) ·
        **Rule applied:** `factWithHighestConfidence` — highest confidence×weight wins""")

        render_lineage(facts,["sos_active","sos_match","sos_match_boolean","middesk_confidence","middesk_id",
                               "formation_state","formation_date","year_established","corporation"],
                      show_rule_explainer=True)

        # Source concordance chart
        st.markdown("##### Vendor Confidence Comparison")
        vendors=[("Middesk","16"),("OpenCorporates","23"),("ZoomInfo","24"),("Equifax","17"),("Trulioo","38")]
        cdata=[]
        for vn,vp in vendors:
            for fn in ["sos_match","sos_match_boolean"]:
                win_pid=gp(facts,fn); wconf=gc(facts,fn)
                aconf=next((a["conf"] for a in get_alts(facts,fn) if a["pid"]==vp),0.0)
                conf=wconf if win_pid==vp else aconf
                if conf>0: cdata.append({"Vendor":vn,"Fact":fn,"Conf":round(conf,4),
                                          "Role":"Winner ✓" if win_pid==vp else "Alternative"})
        if cdata:
            cdf=pd.DataFrame(cdata)
            fig=px.bar(cdf,x="Vendor",y="Conf",color="Role",barmode="group",
                       color_discrete_map={"Winner ✓":"#22c55e","Alternative":"#8B5CF6"},
                       title="Vendor Confidence — SOS facts (winner vs alternatives)")
            fig.update_layout(yaxis=dict(range=[0,1.05],title="Confidence (0–1)"),height=300)
            st.plotly_chart(dark_chart(fig),use_container_width=True)
            st.dataframe(cdf,use_container_width=True,hide_index=True)
        else:
            st.info("No vendor confidence data available for this business.")

        # JSON structure explanation
        with st.expander("📄 JSON structure — how this fact looks in the API response"):
            st.markdown("""```json
{
  "sos_active": {
    "name": "sos_active",
    "value": true,                          ← what the Admin Portal shows
    "source": {
      "confidence": null,                   ← null = derived (dependent) fact
      "platformId": -1,                     ← -1 = system computed
      "name": "dependent"
    },
    "dependencies": ["sos_filings"],        ← computed FROM sos_filings.value[].active
    "ruleApplied": null,                    ← no rule = pure dependency
    "alternatives": []
  },
  "sos_match": {
    "name": "sos_match",
    "value": "success",
    "source": {
      "confidence": 0.9989,                 ← Middesk formula: 0.15 + 0.20×tasks
      "platformId": 16,                     ← 16 = Middesk (weight=2.0, highest)
      "name": "middesk"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" },
    "alternatives": [
      { "value": "success", "source": 23, "confidence": 1.0 }   ← OC fallback
    ]
  }
}
```""")

        ai_popup("SOS",f"SOS active:{sos_act} match:{sos_match} conf:{mdsk_conf:.4f} state:{form_state}",[
            "How is Middesk confidence calculated for SOS facts?",
            "Why might sos_match_boolean be false for a real business?",
            "What does sos_active=false mean for underwriting?",
            "How do I query SOS filings from Redshift?",
            "What is the difference between sos_match and sos_active?"],bid)

        with st.expander("📋 SQL & Python — how to load this data"):
            st.markdown("**Redshift (VPN required) — scalar SOS facts:**")
            st.code(sql_for(bid,["sos_active","sos_match","sos_match_boolean","formation_state","middesk_confidence"]),language="sql")
            st.markdown("**PostgreSQL RDS port 5432 — sos_filings array (too large for Redshift federation):**")
            st.code(f"""-- Run on PostgreSQL RDS (native JSONB, no VARCHAR(65535) limit):
SELECT
    filing->>'foreign_domestic'   AS filing_type,
    filing->>'state'              AS state,
    filing->>'active'             AS is_active,
    filing->>'entity_type'        AS entity_type,
    filing->>'registration_date'  AS reg_date,
    filing->>'filing_name'        AS filing_name,
    filing->>'url'                AS registry_url
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}'
ORDER BY (filing->>'active')::boolean DESC;""",language="sql")
            st.markdown("**API endpoint that returns this data:**")
            st.code(f"""GET https://api.joinworth.com/integration/api/v1/facts/business/{bid}/kyb
Authorization: Bearer <token>
# Response: data.sos_active, data.sos_match, data.sos_filings, ...
# Cached in Redis: integration-express-cache::{bid}::/api/v1/facts/business/{bid}/kyb""",language="bash")
            st.code(py_for(bid,["sos_active","sos_match","sos_match_boolean"]),language="python")

        analyst_card("🔬 SOS Registry — Full Interpretation",[
            f"sos_active = {sos_act}: {'✅ Entity in good standing with its Secretary of State.' if sos_act=='true' else '🚨 NOT in good standing — check for: unpaid taxes, missed annual report filing, or administrative dissolution by the state.' if sos_act=='false' else '⚠️ Unknown — Middesk may not have returned a SOS filing yet.'}",
            f"Middesk confidence = {mdsk_conf:.4f}: Formula = 0.15 (base) + 0.20 × (number of passing review tasks, max 4). Tasks: name verification, TIN check, address verification, SOS lookup. Score of {mdsk_conf:.4f} implies ~{max(0,round((mdsk_conf-0.15)/0.20))} tasks passed.",
            "sos_active is a DEPENDENT fact (platformId=-1, source='dependent'). It is derived by the Fact Engine from sos_filings.value[].active — not queried directly. sos_filings is queried by Middesk (pid=16) from the state Secretary of State registry.",
            "sos_match is the WINNING fact (pid=16 Middesk, w=2.0). OpenCorporates (pid=23, w=0.9) is the alternative. The Fact Engine applies rule 'factWithHighestConfidence×weight'. The winner's value and source are stored in rds_warehouse_public.facts.",
            "sos_filings is too large for Redshift federation (VARCHAR 65535 limit). It contains an array of SoSRegistration objects with: id, jurisdiction, filing_date, entity_type, active, foreign_domestic, state, url, filing_name, registration_date, officers[].",
            "Admin Portal path: KYB tab → Business Registration → 'Verified' badge = sos_match_boolean=true AND sos_active=true. Rendered by microsites/packages/case/src/page/Cases/KYB/BusinessRegistration.tsx.",
        ])

    with r2:
        st.markdown("#### 🗺️ Domestic vs Foreign Registration — Complete Analysis")
        st.caption("**Source fact:** `sos_filings` (too large for Redshift — PostgreSQL RDS required) · "
                   "**Proxy facts:** `formation_state` + `primary_address.state` (Redshift OK) · "
                   "**Admin Portal path:** KYB → Business Registration → jurisdiction badges (Primary/Secondary)")

        # ── Per-business status ───────────────────────────────────────────────
        op_state = ""
        pa = facts.get("primary_address",{}).get("value",{})
        if isinstance(pa, dict): op_state = str(pa.get("state","") or "").upper().strip()
        form_state_up = form_state.upper().strip()
        TAX_HAVENS = {"DE","NV","WY","SD","MT","NM"}
        states_differ = form_state_up and op_state and form_state_up != op_state
        is_th = form_state_up in TAX_HAVENS

        # KPI row
        c1,c2,c3,c4 = st.columns(4)
        with c1: kpi("Formation State (domestic)",form_state or "⚠️ Unknown","Where entity was incorporated","#3B82F6")
        with c2: kpi("Operating State",op_state or "⚠️ Unknown","primary_address.state","#3B82F6")
        with c3:
            if states_differ:
                kpi("State Match","❌ Different",f"{form_state_up} ≠ {op_state} — foreign qual. likely","#f59e0b")
            elif form_state_up:
                kpi("State Match","✅ Same state","No foreign qualification needed","#22c55e")
            else:
                kpi("State Match","⚠️ Unknown","formation_state missing","#64748b")
        with c4:
            kpi("Tax Haven?","⚠️ YES — "+form_state_up if is_th else "✅ No",
                "DE/NV/WY/SD/MT/NM = entity resolution gap risk" if is_th else "Low entity resolution risk",
                "#f59e0b" if is_th else "#22c55e")

        if is_th:
            flag(f"🚨 **ENTITY RESOLUTION GAP RISK:** This business is incorporated in **{form_state_up}** "
                 f"(a tax-haven state), but operating in **{op_state or '?'}**. "
                 f"Middesk searches by submitted address ({op_state or '?'}) → finds the **FOREIGN qualification** record. "
                 f"The PRIMARY DOMESTIC filing in {form_state_up} may be MISSED. "
                 f"This can cause **sos_match_boolean=false as a FALSE NEGATIVE**.", "red")
        elif states_differ:
            flag(f"⚠️ Formation state ({form_state_up}) differs from operating state ({op_state}). "
                 f"Business likely has both a domestic filing in {form_state_up} AND a foreign qualification in {op_state}. "
                 "Verify both filings using the SQL below.", "amber")
        else:
            flag(f"✅ Formation state ({form_state_up}) matches operating state ({op_state or '?'}). "
                 "Business is likely domestic-only in this state. Low entity resolution gap risk.", "green")

        st.markdown("---")

        # ── Sanity check: sos_match_boolean vs state mismatch ────────────────
        st.markdown("##### 🔍 Entity Resolution Gap Detection — For This Business")
        checks_dom = [
            ("sos_match_boolean value", sos_match,
             sos_match=="true",
             "true = Middesk found AND matched the SOS record"),
            ("Formation state known", bool(form_state_up),
             bool(form_state_up),
             "Required to check domestic vs foreign"),
            ("Operating state known", bool(op_state),
             bool(op_state),
             "Required to check if states differ"),
            ("States are the same", not states_differ,
             not states_differ,
             "Same state = domestic only, no gap risk"),
            ("Not a tax-haven state", not is_th,
             not is_th,
             "DE/NV/WY = highest probability of gap"),
            ("Gap risk present", states_differ and sos_match!="true",
             not (states_differ and sos_match!="true"),
             "sos_match=false AND states differ = likely false negative"),
        ]
        st.dataframe(pd.DataFrame([{
            "Check":c,"Result":r,"Status":"✅ OK" if ok else "🔴 Flag","Interpretation":d
        } for c,r,ok,d in checks_dom]), use_container_width=True, hide_index=True)

        if states_differ and sos_match!="true":
            flag("🚨 **High confidence this is a false negative:** "
                 "sos_match_boolean=false AND formation_state ≠ operating_state. "
                 "Middesk found the foreign qualification record in the operating state, "
                 "but could NOT match the name — possibly because the domestic legal name "
                 "in the formation state differs from the submitted DBA name. "
                 "**Recommended action:** re-run Middesk with formation_state as jurisdiction.", "red")

        st.markdown("---")

        # ── Plotly workflow diagram ────────────────────────────────────────────
        st.markdown("##### 🔄 Entity Resolution Pipeline — How This Fact Flows")
        _col_l, _col_r = st.columns([3,2])
        with _col_l:
            fig_flow = go.Figure()
            # Nodes as scatter with text
            nodes_x  = [0.1, 0.1, 0.5, 0.5, 0.5, 0.9, 0.9]
            nodes_y  = [0.85, 0.55, 0.85, 0.65, 0.45, 0.75, 0.45]
            nodes_lbl= [
                "Merchant\nsubmits address",
                "Middesk API\n(pid=16, w=2.0)",
                "OC Fallback\n(pid=23, w=0.9)",
                "Fact Engine\nfactWithHighestConf",
                "sos_filings\nrds_warehouse_public.facts",
                "Admin Portal\nPrimary/Secondary badge",
                "sos_active\n(derived from filings[].active)",
            ]
            nodes_color = ["#f59e0b","#f59e0b","#3B82F6","#8B5CF6","#22c55e","#60A5FA","#94a3b8"]
            fig_flow.add_trace(go.Scatter(
                x=nodes_x, y=nodes_y, mode="markers+text",
                text=nodes_lbl,
                textposition=["middle right","middle right","middle right",
                              "middle right","middle right","middle left","middle left"],
                marker=dict(size=18, color=nodes_color, symbol="circle",
                            line=dict(color="#1E293B",width=2)),
                textfont=dict(size=9, color="#E2E8F0"),
                hoverinfo="text",
            ))
            # Arrows as annotations
            arrows = [
                (0.1,0.85,0.1,0.60,"submits address"),
                (0.1,0.55,0.47,0.85,"SOS search by address"),
                (0.1,0.55,0.47,0.65,"(same request)"),
                (0.53,0.85,0.53,0.70,"name-based search"),
                (0.53,0.65,0.87,0.78,"winner stored"),
                (0.53,0.45,0.87,0.48,"active field"),
            ]
            for x0,y0,x1,y1,lbl in arrows:
                fig_flow.add_annotation(ax=x0,ay=y0,x=x1,y=y1,
                    xref="x",yref="y",axref="x",ayref="y",
                    arrowhead=2,arrowwidth=1.5,arrowcolor="#475569",
                    showarrow=True)
            fig_flow.update_layout(
                height=320,
                xaxis=dict(visible=False,range=[-0.05,1.2]),
                yaxis=dict(visible=False,range=[0.3,1.0]),
                margin=dict(t=20,b=10,l=10,r=10),
                title="Entity Resolution Data Flow",
            )
            st.plotly_chart(dark_chart(fig_flow), use_container_width=True)

        with _col_r:
            st.markdown("**Pipeline stages:**")
            for step,desc,color in [
                ("① Merchant submits","Operating address + legal name to onboarding form","#f59e0b"),
                ("② Middesk (primary)","Live SOS search by address in each state registry","#f59e0b"),
                ("③ OC (fallback)","Global search by name — may find domestic record Middesk missed","#3B82F6"),
                ("④ Fact Engine","factWithHighestConfidence selects winner between Middesk & OC","#8B5CF6"),
                ("⑤ Stored","sos_filings array with foreign_domestic per filing written to Redshift","#22c55e"),
                ("⑥ Admin Portal","EntityJurisdictionCell.tsx: domestic='Primary', foreign='Secondary'","#60A5FA"),
                ("⑦ Derived","sos_active = any(filing.active for filing in sos_filings)","#94a3b8"),
            ]:
                st.markdown(f"""<div style="background:#1E293B;border-left:3px solid {color};
                    padding:5px 10px;border-radius:6px;margin:3px 0;font-size:.72rem">
                  <span style="color:{color};font-weight:600">{step}</span>
                  <span style="color:#CBD5E1;margin-left:6px">{desc}</span></div>""",
                    unsafe_allow_html=True)

        st.markdown("---")

        # ── Fact lineage for this business ────────────────────────────────────
        render_lineage(facts,["formation_state","formation_date","corporation","year_established"])

        st.markdown("---")
        st.markdown("##### 📖 The Delaware Problem — Why Tax-Haven States Break Entity Resolution")
        st.markdown("""
**Why businesses incorporate in DE/NV/WY even if they operate elsewhere:**

| State | Why businesses choose it | Entity resolution problem |
|---|---|---|
| **Delaware** | Court of Chancery (predictable corporate law) · no state income tax · flexible equity structures · investor-friendly | DE filing name often differs from submitted DBA; Middesk searches Texas address, finds Texas foreign record, misses DE domestic |
| **Nevada** | Strong liability protection · no corporate income tax · no disclosure of shareholders | Operating in CA/TX/NY but incorporated NV; address search returns wrong record |
| **Wyoming** | LLC privacy (no public officer disclosure required) · lowest fees | Particularly common for anonymous holding companies; very hard to resolve by name |

**What this means for this pipeline:**

```
Business: "Joe's Pizza LLC" operating in Texas, incorporated in Delaware as "JPL Holdings LLC"
                    ↓
Middesk searches: Texas SOS registry (by submitted Texas address)
Finds: "JPL Holdings LLC" (Texas foreign qualification, filed 2022)
      Name mismatch vs submitted "Joe's Pizza LLC" → sos_match_boolean = FALSE ❌
                    ↓
The Delaware DOMESTIC record ("JPL Holdings LLC") is NEVER searched
The business IS legitimately registered — we searched the wrong state
```

**Recommended fixes** (from integration-service codebase analysis):
1. When `sos_match_boolean=false` AND `formation_state ≠ operating_state` → re-run Middesk with `jurisdiction=formation_state`
2. For all DE/NV/WY incorporations → always run DUAL search (formation state + operating state)
3. Add a `has_foreign_qualification` boolean fact to the Fact Engine as an explicit flag
4. Flag these cases for manual underwriter review — they are high-probability false negatives
        """)

        with st.expander("📋 SQL — Query sos_filings directly (PostgreSQL RDS port 5432 required)"):
            st.code(f"""-- sos_filings is too large for Redshift federation (VARCHAR 65535 limit).
-- All queries below must run on PostgreSQL RDS (port 5432) with native JSONB.

-- 1. All SOS filings for this business with domestic/foreign classification:
SELECT
    filing->>'foreign_domestic'   AS type,             -- 'domestic' | 'foreign'
    filing->>'state'              AS state,
    filing->>'active'             AS is_active,
    filing->>'entity_type'        AS entity_type,       -- LLC | Corp | etc.
    filing->>'registration_date'  AS registration_date,
    filing->>'filing_name'        AS legal_filing_name, -- may differ from submitted name!
    filing->>'url'                AS registry_url,
    filing->'officers'            AS officers
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}'
ORDER BY
    (filing->>'active')::boolean DESC,
    CASE filing->>'foreign_domestic' WHEN 'domestic' THEN 0 ELSE 1 END;

-- 2. Scalar facts (Redshift OK — no size limit):
{sql_for(bid,["formation_state","formation_date","sos_active","sos_match","sos_match_boolean"])}

-- 3. Cross-check: businesses where sos_match=false but have domestic filing
--    (entity resolution false negatives) — run on PostgreSQL RDS:
SELECT f.business_id,
    sos.value->>'value'       AS sos_match_boolean,
    filing->>'foreign_domestic' AS filing_type,
    filing->>'state'            AS filing_state,
    filing->>'active'           AS is_active
FROM rds_warehouse_public.facts f
CROSS JOIN jsonb_array_elements(f.value->'value') AS filing
JOIN rds_warehouse_public.facts sos
  ON sos.business_id=f.business_id AND sos.name='sos_match_boolean'
WHERE f.name='sos_filings'
  AND sos.value->>'value'='false'
  AND filing->>'foreign_domestic'='domestic'
  AND filing->>'active'='true'
LIMIT 100;""", language="sql")

        analyst_card("🔬 Domestic vs Foreign — Complete Engineering Analysis",[
            f"CURRENT BUSINESS: formation_state={form_state_up or '(unknown)'}, "
            f"operating_state={op_state or '(unknown)'}, states_differ={states_differ}, "
            f"tax_haven={is_th}, sos_match_boolean={sos_match}. "
            f"{'⚠️ ENTITY RESOLUTION GAP LIKELY — verify both domestic and foreign filings.' if states_differ and sos_match!='true' else '✅ No entity resolution gap detected for this specific business.'}",
            "sos_filings fact: stores an array of SoSRegistration objects. Each has: id, jurisdiction (us::state), "
            "filing_date, entity_type, active (bool), foreign_domestic ('domestic'|'foreign'), state, url, "
            "filing_name, registration_date, officers[]. Source: Middesk (pid=16) wins via factWithHighestConfidence if conf > OC.",
            "foreign_domestic field is set by Middesk from their API's registrations[].foreignDomestic field. "
            "OC sets it by comparing home_jurisdiction_code to the filing's jurisdiction. "
            "If Middesk wins, OC's assessment of domestic/foreign is in the alternatives[].",
            "sos_active is a DERIVED fact (platformId=-1, ruleApplied=null, source='dependent'). "
            "It is computed by the Fact Engine as: ANY(filing.active for filing in sos_filings.value). "
            "It is NOT a direct vendor query. The 'dependencies' field lists ['sos_filings'].",
            "Admin Portal: KYB → Business Registration → EntityJurisdictionCell.tsx. "
            "Domestic filing → green 'Primary' badge. Foreign filing → grey 'Secondary' badge. "
            "Sorted by active=true first, then by domestic before foreign. Multiple badges possible.",
            "sos_filings exceeds Redshift federation VARCHAR(65535) limit. Must be queried from "
            "PostgreSQL RDS (port 5432) using JSONB operators (->>, jsonb_array_elements). "
            "The scalar proxy facts (sos_active, sos_match_boolean, formation_state) are safe in Redshift.",
        ])

    with r3:
        st.markdown("#### TIN Verification — Full Data Lineage")
        st.caption("""**Source:** Middesk (pid=16) TIN review task → direct IRS query. 
        **Fallback:** Trulioo BusinessRegistrationNumber comparison (pid=38). 
        **Stored in:** `rds_warehouse_public.facts` (name='tin_match', 'tin_match_boolean', 'tin', 'tin_submitted')""")

        render_lineage(facts,["tin","tin_submitted","tin_match","tin_match_boolean"])

        # KPI row
        tin_submitted_val=str(gv(facts,"tin_submitted") or "")
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("EIN Submitted","✅ Yes" if tin_submitted_val else "❌ No",
                     f"Masked: {tin_submitted_val[:9]}" if tin_submitted_val else "tin_submitted fact","#22c55e" if tin_submitted_val else "#ef4444")
        with c2: kpi("IRS Status",tin_status.capitalize() or "⚠️ Unknown","tin_match.value.status",
                     "#22c55e" if tin_status=="success" else "#ef4444" if tin_status=="failure" else "#f59e0b")
        with c3: kpi("IRS Message",tin_msg[:30]+"…" if len(tin_msg)>30 else (tin_msg or "(none)"),
                     "tin_match.value.message","#22c55e" if tin_status=="success" else "#ef4444")
        with c4: kpi("Boolean Result",tin_bool or "⚠️ Unknown","Admin Portal shows this value",
                     "#22c55e" if tin_bool=="true" else "#ef4444")

        if tin_msg: flag(f"Middesk TIN message: **\"{tin_msg}\"**","green" if tin_status=="success" else "amber")

        # Source concordance
        st.markdown("##### Source Concordance — Who provided the TIN")
        tin_sources=[]
        for fname in ["tin","tin_submitted"]:
            f=facts.get(fname,{})
            if f:
                src=f.get("source") or {}
                pid="" if not isinstance(src,dict) else ("" if src.get("platformId") is None else str(src["platformId"]))
                conf_raw=src.get("confidence") if isinstance(src,dict) else None
                conf=float(conf_raw) if conf_raw is not None else None
                tin_sources.append({
                    "Fact":fname,
                    "Value":str(f.get("value",""))[:20],
                    "Source":_pid_label(pid),
                    "platformId":pid,
                    "Confidence":f"{conf:.4f}" if conf is not None else "n/a (dependent)",
                    "Rule":safe_get(f,"ruleApplied","name") or "—",
                    "Notes":"Applicant-submitted — confidence=1.0 by definition" if pid=="0"
                            else "Middesk confirmed from IRS system" if pid=="16"
                            else "Trulioo fallback via BusinessRegistrationNumber" if pid=="38"
                            else "Unknown source" if pid=="" else ""
                })
                # Also show alternatives
                for alt in (f.get("alternatives") or []):
                    if not isinstance(alt,dict): continue
                    ap=_alt_pid(alt); ac=_alt_conf(alt)
                    tin_sources.append({
                        "Fact":f"{fname} [alt]",
                        "Value":str(alt.get("value",""))[:20],
                        "Source":_pid_label(ap),
                        "platformId":ap,
                        "Confidence":f"{ac:.4f}" if ac else "n/a",
                        "Rule":"alternative (lost to winner)",
                        "Notes":"",
                    })
        if tin_sources:
            st.dataframe(pd.DataFrame(tin_sources),use_container_width=True,hide_index=True)

        # Consistency checks
        st.markdown("##### Data Integrity Checks")
        checks=[
            ("EIN submitted", bool(tin_submitted_val), tin_submitted_val or "(null)", "EIN must be submitted before IRS check can run"),
            ("tin_match.status present", tin_status in ("success","failure","pending"), tin_status or "(missing)", "Must be 'success', 'failure', or 'pending'"),
            ("tin_match_boolean set", tin_bool in ("true","false"), tin_bool or "(missing)", "Must be true or false — null means IRS check not yet run"),
            ("Boolean ↔ status consistent", (tin_bool=="true")==(tin_status=="success"), f"bool={tin_bool}, status={tin_status}","CRITICAL: tin_match_boolean=true MUST derive only from status='success' — any divergence = integration-service bug"),
            ("Winning source is Middesk", gp(facts,"tin_match")=="16", f"pid={gp(facts,'tin_match')}", "Middesk (pid=16) is the only IRS-direct TIN checker. If pid≠16, TIN is not IRS-verified."),
        ]
        st.dataframe(pd.DataFrame([{"Check":l,"Result":v,"Status":"✅ OK" if ok else "❌ ISSUE","Explanation":d}
                                    for l,ok,v,d in checks]),use_container_width=True,hide_index=True)

        # Failure diagnosis
        if tin_status=="failure" and tin_msg:
            FAILURE_MAP={
                "does not have a record":("Wrong EIN or legal name mismatch","HIGH",
                    "Ask applicant for the exact legal name on the IRS EIN certificate (not DBA). Submit name exactly as shown on SS-4 form."),
                "associated with a different":("🚨 FRAUD SIGNAL: EIN belongs to different entity","CRITICAL",
                    "Escalate to Compliance immediately. Do NOT approve. The EIN is registered to a different business — potential identity theft or intentional fraud."),
                "duplicate":("Duplicate IRS request","LOW",
                    "IRS blocks repeat TIN checks within 24h. Wait 24 hours and retry automatically."),
                "invalid":("Invalid EIN format","HIGH",
                    "EIN must be exactly 9 digits (format: XX-XXXXXXX). Ask applicant to resubmit with correct EIN."),
                "unavailable":("IRS system temporarily unavailable","LOW",
                    "IRS API outage — system will auto-retry in 24h. No action needed."),
            }
            for kw,(reason,sev,action) in FAILURE_MAP.items():
                if kw.lower() in tin_msg.lower():
                    lvl="red" if sev in ("CRITICAL","HIGH") else "amber"
                    flag(f"**{reason}** (Severity: {sev})<br>{action}",lvl); break

        with st.expander("📄 JSON structure — TIN facts in API response"):
            st.markdown("""```json
{
  "tin": {
    "value": "931667813",              ← actual EIN (9 digits, unmasked in Redshift)
    "source": {
      "confidence": 1.0,
      "platformId": 0,                 ← 0 = Applicant (businessDetails)
      "name": "businessDetails"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" },
    "alternatives": [
      { "value": "931667813", "source": 16, "confidence": 0.9989 }   ← Middesk confirms
    ]
  },
  "tin_submitted": {
    "value": "XXXXX7813",              ← masked for display
    "source": { "platformId": 0, "name": "businessDetails" }
  },
  "tin_match": {
    "value": {
      "status": "success",             ← "success" | "failure" | "pending"
      "message": "The IRS has a record for the submitted TIN and Business Name combination",
      "sublabel": "Found"
    },
    "source": { "confidence": 0.9989, "platformId": 16, "name": "middesk" }
  },
  "tin_match_boolean": {
    "value": true,                     ← derived: status==="success"
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["tin_match"]
  }
}
```""")

        ai_popup("TIN",f"TIN status:{tin_status} msg:{tin_msg} bool:{tin_bool} pid:{gp(facts,'tin_match')}",[
            "How is tin_match_boolean derived from tin_match.status?",
            "What does 'associated with a different Business Name' mean and what action to take?",
            "When is Trulioo the fallback for TIN instead of Middesk?",
            "How do I query TIN data from Redshift and what do the fields mean?",
            "Why might tin_match_boolean be null even though tin_submitted is not empty?"],bid)

        with st.expander("📋 SQL & Python — how to load TIN data"):
            st.code(sql_for(bid,["tin","tin_submitted","tin_match","tin_match_boolean"]),language="sql")
            st.code(f"""-- Redshift: get TIN match details
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value','status')   AS irs_status,
    JSON_EXTRACT_PATH_TEXT(value,'value','message')  AS irs_message,
    JSON_EXTRACT_PATH_TEXT(value,'value','sublabel') AS sublabel,
    JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}' AND name='tin_match'
ORDER BY received_at DESC LIMIT 5;""",language="sql")
            st.code(py_for(bid,["tin","tin_submitted","tin_match","tin_match_boolean"]),language="python")

        analyst_card("🔬 TIN Verification — Full Interpretation",[
            f"tin_match_boolean = {tin_bool}: This is exactly what the Admin Portal's 'Tax ID Number (EIN)' field shows under KYB → Business Registration. {'✅ IRS confirmed this EIN and legal name combination is valid.' if tin_bool=='true' else '❌ IRS did NOT confirm this combination. The EIN may be wrong, the name may not match exactly, or the IRS system was unavailable.' if tin_bool=='false' else '⚠️ No IRS check has been run yet — the TIN check may not have been triggered.'}",
            "Source hierarchy: (1) Middesk (pid=16, w=2.0) queries IRS directly via TIN review task — this is the ONLY source that confirms with IRS. (2) If Middesk has no TIN task → Trulioo (pid=38) BusinessRegistrationNumber comparison is fallback (not IRS-direct). (3) Applicant (pid=0) submits the raw EIN — this has confidence=1.0 by convention but means nothing about IRS validity.",
            "tin vs tin_submitted: 'tin' = actual 9-digit EIN (unmasked in Redshift). 'tin_submitted' = masked version (XXXXX1234) returned to frontend. Both are stored as separate facts.",
            "CRITICAL: tin_match_boolean=true MUST derive only from tin_match.value.status='success'. Any case where boolean=true but status≠'success' = data integrity bug in integration-service (see lib/facts/kyb/tin_match_boolean.ts).",
            "Admin Portal path: KYB → Business Registration tab → 'Tax ID Number (EIN)' row. Verified badge appears only when tin_match_boolean=true AND tin_submitted is not null.",
            f"Current winning source: {_pid_label(gp(facts,'tin_match'))} (pid={gp(facts,'tin_match')}). Confidence: {gc(facts,'tin_match'):.4f}. {('✅ IRS-direct verification.' if gp(facts,'tin_match')=='16' else '⚠️ NOT IRS-direct — this is Trulioo fallback or applicant-submitted, not confirmed by IRS.' if gp(facts,'tin_match') not in ('','16') else '⚠️ Source unknown.')}",
        ])

    with r4:
        st.markdown("#### 🪪 IDV — Identity Verification (Plaid)")
        st.caption("""**Vendor:** Plaid Identity Verification (pid=40, platformId=18 in some contexts) ·
        **Trigger:** Sent via link when onboarding form submitted ·
        **Stored in:** `rds_warehouse_public.facts` (idv_status, idv_passed, idv_passed_boolean) ·
        **Admin Portal path:** KYB → Identity Verification tab · badge shows idv_passed_boolean""")

        # ── Data pipeline diagram ─────────────────────────────────────────────
        IDV_PIPELINE=[
            ("1","Onboarding form submitted","Applicant","Merchant submits onboarding form. If not sole_prop (has EIN), IDV flow is triggered for beneficial owners.","#f59e0b"),
            ("2","Plaid IDV link sent","Plaid (pid=40)","Unique IDV session link sent to owner. Session expires in 15–30 min (configurable). Statuses: PENDING immediately.","#06b6d4"),
            ("3","Owner completes IDV","Plaid biometrics engine","Owner: (a) scans government-issued ID, (b) takes selfie, (c) liveness check, (d) ID data extraction + match.","#06b6d4"),
            ("4","Plaid webhook received","integration-service","Plaid sends webhook with final status (SUCCESS/FAILED/CANCELED/EXPIRED). Stored in rds_integration_data.","#8B5CF6"),
            ("5","idv_status fact computed","Fact Engine","Object: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. Counts of ALL sessions ever, not just latest.","#22c55e"),
            ("6","idv_passed_boolean derived","Fact Engine (dependent)","true when idv_passed >= 1 (at least one SUCCESS session). platformId=-1, ruleApplied=null.","#22c55e"),
            ("7","Admin Portal display","microsites IDV tab","Shows latest session status. Badge: ✅ Verified (passed) or ❌ Not Verified (failed/pending).","#60A5FA"),
        ]
        for num,title,src,desc,color in IDV_PIPELINE:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:3px 0">
              <div style="display:flex;justify-content:space-between">
                <span style="color:{color};font-weight:700;font-size:.83rem">Step {num}: {title}</span>
                <span style="color:#64748b;font-size:.68rem">{src}</span>
              </div>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:3px">{desc}</div>
            </div>""",unsafe_allow_html=True)

        st.markdown("---")

        # ── KPI cards ────────────────────────────────────────────────────────
        sole_prop=str(gv(facts,"is_sole_prop") or "").lower()
        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("IDV Passed","✅ Yes" if idv_val=="true" else "❌ No" if idv_val=="false" else "⚠️ Unknown",
                     "idv_passed_boolean","#22c55e" if idv_val=="true" else "#ef4444" if idv_val=="false" else "#64748b")
        with c2:
            idv_raw=facts.get("idv_status",{}).get("value",{})
            total_sessions=sum(idv_raw.values()) if isinstance(idv_raw,dict) else 0
            kpi("Total Sessions",str(total_sessions),"All IDV sessions ever sent","#3B82F6")
        with c3:
            success_n=idv_raw.get("SUCCESS",0) if isinstance(idv_raw,dict) else 0
            kpi("Successful",str(success_n),"Sessions with SUCCESS status","#22c55e" if success_n>0 else "#64748b")
        with c4: kpi("Sole Prop","✅ Yes" if sole_prop=="true" else "❌ No" if sole_prop=="false" else "⚠️ Unknown",
                     "is_sole_prop — skips IDV if true","#f59e0b" if sole_prop=="true" else "#3B82F6")

        if sole_prop=="true":
            flag("is_sole_prop=true: business has no EIN or EIN was not submitted. IDV is skipped for sole proprietors in some configurations. idv_passed_boolean may be null or false — this is expected.", "amber")

        # ── Session status breakdown ──────────────────────────────────────────
        st.markdown("##### IDV Session Status Breakdown")
        IDV_INFO={
            "SUCCESS":("✅","#22c55e",
                "Government-issued ID scanned, selfie taken, liveness confirmed, name extracted matches record. "
                "idv_passed += 1. If idv_passed >= 1 → idv_passed_boolean=true."),
            "PENDING":("⏳","#f59e0b",
                "Session created but not yet completed by the owner. Link may still be active. "
                "Send a reminder after 24h. Does NOT increment idv_passed."),
            "FAILED":("❌","#ef4444",
                "Common failure causes: (1) Expired/damaged ID, (2) Selfie/ID face mismatch, "
                "(3) Liveness check fail (blinking/moving required), (4) Unsupported ID type, "
                "(5) Poor lighting. Owner can retry — a new session link is needed."),
            "CANCELED":("🚫","#f97316",
                "Owner clicked 'Cancel' or exited the flow without completing. Possible UX friction, "
                "technical issue, or deliberate avoidance. Requires re-engagement."),
            "EXPIRED":("⌛","#64748b",
                "Session link expired (Plaid default: 15–30 min). A new session link must be issued. "
                "Common for delayed owners."),
        }
        if isinstance(idv_raw,dict) and idv_raw:
            # Chart
            idv_chart_df=pd.DataFrame([{"Status":k,"Count":v} for k,v in idv_raw.items() if v>=0])
            col_chart,col_cards=st.columns([1,2])
            with col_chart:
                fig_idv=go.Figure(go.Pie(
                    labels=idv_chart_df["Status"],values=idv_chart_df["Count"],
                    marker=dict(colors=["#22c55e","#f59e0b","#ef4444","#f97316","#64748b"]),
                    hole=0.5,textinfo="label+value",
                ))
                fig_idv.update_layout(height=220,showlegend=False,margin=dict(t=10,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_idv),use_container_width=True)
            with col_cards:
                for status,count in sorted(idv_raw.items(),key=lambda x:-x[1]):
                    info=IDV_INFO.get(status.upper(),("❓","#94a3b8","Unknown status"))
                    st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {info[1]};
                        border-radius:8px;padding:8px 14px;margin:3px 0">
                      <div style="display:flex;justify-content:space-between">
                        <span style="color:{info[1]};font-weight:700">{info[0]} {status}: {count} session(s)</span>
                      </div>
                      <div style="color:#94A3B8;font-size:.72rem;margin-top:3px">{info[2]}</div>
                    </div>""",unsafe_allow_html=True)
        else:
            flag(f"idv_status fact is null. idv_passed_boolean={idv_val}. "
                 "Possible causes: (1) Sole proprietor — IDV not triggered, "
                 "(2) Business onboarded before Plaid IDV was enabled, "
                 "(3) Plaid webhook not yet received.", "blue")

        # ── Fact lineage ─────────────────────────────────────────────────────
        st.markdown("---")
        render_lineage(facts,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"])

        # ── JSON structure ───────────────────────────────────────────────────
        with st.expander("📄 JSON structure — idv_status in API response"):
            st.markdown("""```json
{
  "idv_status": {
    "value": {
      "SUCCESS": 1,    ← count of successful IDV sessions
      "PENDING": 0,
      "CANCELED": 0,
      "EXPIRED": 0,
      "FAILED": 0
    },
    "source": {
      "confidence": null,
      "platformId": 18,    ← 18 = Plaid IDV (note: differs from pid=40 Plaid banking)
      "name": "plaidIdv"
    },
    "ruleApplied": { "name": "factWithHighestConfidence" }
  },
  "idv_passed": {
    "value": 1,            ← COUNT of successful sessions (idv_status.SUCCESS)
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["idv_status"]
  },
  "idv_passed_boolean": {
    "value": true,         ← true when idv_passed >= 1
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["idv_passed"]
  },
  "is_sole_prop": {
    "value": false,        ← true when tin_submitted=null AND idv_passed_boolean=true
    "source": { "platformId": -1, "name": "dependent" },
    "dependencies": ["tin_submitted", "idv_passed_boolean"]
  }
}
```""")

        with st.expander("📋 SQL — how to query IDV data"):
            st.code(sql_for(bid,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"]),language="sql")
            st.code(f"""-- Plaid IDV session history (rds_integration_data):
SELECT piv.business_id, piv.status, piv.created_at, piv.updated_at
FROM rds_integration_data.plaid_identity_verification piv
WHERE piv.business_id = '{bid}'
ORDER BY piv.created_at DESC;

-- Or via BERT review tasks:
SELECT bert.status, bert.sublabel, bert.created_at
FROM rds_integration_data.business_entity_review_task bert
JOIN rds_integration_data.business_entity_verification bev
  ON bev.id = bert.business_entity_verification_id
WHERE bev.business_id = '{bid}' AND bert.key IN ('idv','identity_verification')
ORDER BY bert.created_at DESC;""",language="sql")

        analyst_card("🔬 IDV — Full Engineering Analysis",[
            f"idv_passed_boolean={idv_val}: This is the single boolean the Admin Portal displays as the IDV badge. "
            f"It is a DERIVED fact (platformId=-1, dependent) computed as: idv_passed >= 1. "
            f"idv_passed = COUNT(sessions where status=SUCCESS). Both are dependent facts — NOT direct vendor queries.",
            "idv_status is the primary Plaid fact (platformId=18, name='plaidIdv'). It stores an OBJECT (not array) "
            "of status counts: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N}. It counts ALL sessions ever, "
            "not just the most recent. A business with 2 FAILED and 1 SUCCESS has idv_passed_boolean=true.",
            f"is_sole_prop={sole_prop}: Derived from tin_submitted=null AND idv_passed_boolean=true. "
            "When true, some IDV configurations skip the flow. This is why sole proprietors may have "
            "idv_passed_boolean=null even though no error occurred — IDV was not triggered.",
            "IDV flow: Link sent → owner opens on mobile → (1) scan front+back of government ID, "
            "(2) take selfie, (3) liveness check, (4) data extraction + name/DOB match vs submitted info. "
            "Session expires in 15-30 min. Multiple sessions per business are possible (retries, multiple owners).",
            "Admin Portal path: KYB tab → Identity Verification → Verified/Not Verified badge. "
            "Rendered by microsites/packages/case/src/page/Cases/KYB/IdentityVerification.tsx. "
            "Badge = idv_passed_boolean. Detail = idv_status object breakdown.",
        ])

        ai_popup("IDV",f"IDV passed:{idv_val} sessions:{total_sessions} SUCCESS:{success_n} sole_prop:{sole_prop}",[
            "What are the most common reasons IDV fails?",
            "How is idv_passed_boolean derived from idv_status?",
            "What does is_sole_prop=true mean for IDV and why is it skipped?",
            "How do I query Plaid IDV session history from the database?",
            "Can a business with FAILED sessions still have idv_passed_boolean=true?"],bid)

    with r5:
        st.markdown("#### 🔗 Cross-Field Consistency & Anomaly Detection")
        st.caption("Each check compares facts from different vendors to detect inconsistencies, data integrity bugs, and high-risk patterns. "
                   "CRITICAL = likely data bug · HIGH = compliance/underwriting action needed · MEDIUM = investigate further · NOTICE = informational")

        name_m=str(gv(facts,"name_match_boolean") or "").lower()
        wl_hits_n=int(float(gv(facts,"watchlist_hits") or 0))
        mdsk_c=gc(facts,"sos_match")
        oc_c=gc(facts,"sos_match_boolean") if gp(facts,"sos_match_boolean")=="23" else 0.0
        am_n=int(float(gv(facts,"adverse_media_hits") or 0))
        bk_n=int(float(gv(facts,"num_bankruptcies") or 0))
        naics_v=str(gv(facts,"naics_code") or "")
        website_v=str(gv(facts,"website") or "")

        # Extended check set with root cause + action + source reference
        CHECKS=[
            # (name, condition, severity, description, root_cause, action, source_ref)
            ("TIN bool/status inconsistency",
             tin_bool=="true" and tin_status not in ("success",""),
             "CRITICAL",
             f"tin_match_boolean=true BUT tin_match.value.status='{tin_status}'",
             "tin_match_boolean is derived from tin_match.status='success'. If the boolean is true but status is not success, the derivation rule is broken.",
             "File bug report for integration-service. Check lib/facts/kyb/tin_match_boolean.ts. This is a data integrity issue — the value shown in Admin Portal may be wrong.",
             "integration-service/lib/facts/kyb/tin_match_boolean.ts"),
            ("SOS Active + TIN Failed",
             sos_act=="true" and tin_status=="failure",
             "MEDIUM",
             f"sos_active=true (entity registered) BUT tin_match.status=failure",
             "Entity IS registered and legally operating (SOS confirms). However, the EIN-name combination did not match IRS records. Common cause: DBA submitted instead of legal name on EIN certificate.",
             "Request applicant's IRS EIN confirmation letter (SS-4 notice). Verify legal name matches exactly. Do NOT approve until TIN is verified.",
             "rds_warehouse_public.facts: sos_active, tin_match"),
            ("SOS Inactive + TIN Verified",
             sos_act=="false" and tin_bool=="true",
             "HIGH",
             f"sos_active=false (not in good standing) BUT tin_match_boolean=true",
             "EIN is valid and matches IRS records. BUT the entity is not in good standing with its Secretary of State — possibly dissolved, administratively revoked, or has unpaid fees.",
             "Block approval until SOS standing is reinstated. Entity cannot legally operate in this state.",
             "rds_warehouse_public.facts: sos_active, tin_match_boolean"),
            ("IDV Passed + Name Match Failed",
             idv_val=="true" and name_m=="false",
             "MEDIUM",
             f"idv_passed_boolean=true (person verified) BUT name_match_boolean=false",
             "The owner's identity was confirmed by Plaid (government ID + selfie). However, the business name doesn't match SOS registry. Expected pattern: sole prop with DBA submitted instead of legal name.",
             "Check if business is a sole prop operating under a DBA. If DBA — acceptable. If not — investigate name discrepancy.",
             "rds_warehouse_public.facts: idv_passed_boolean, name_match_boolean"),
            ("No vendor confirmation",
             mdsk_c==0.0 and oc_c==0.0,
             "HIGH",
             "Both Middesk AND OpenCorporates have confidence=0 for sos_match",
             "Neither primary (Middesk, w=2.0) nor fallback (OC, w=0.9) vendor could match this entity in any SOS registry. Entity existence is COMPLETELY UNVERIFIED.",
             "Manual review required. Check if entity is very new (<2 weeks), operates under a DBA, or is incorporated in a state not covered by submitted address search.",
             "rds_warehouse_public.facts: sos_match (pid=16 conf), sos_match_boolean (pid=23 conf)"),
            ("Tax haven formation state",
             tax_haven,
             "NOTICE",
             f"formation_state={form_state} is a tax-haven state (DE/NV/WY)",
             "Tax-haven states create entity resolution gaps. The domestic filing in DE/NV/WY may differ from the submitted address state. Middesk address-based search may have found the WRONG record.",
             "Verify both domestic (formation state) and foreign (operating state) SOS filings separately. Consider re-running Middesk with formation_state as jurisdiction.",
             "rds_warehouse_public.facts: formation_state + primary_address.state"),
            ("Website but no NAICS",
             website_v and naics_v in ("","561499"),
             "MEDIUM",
             f"website='{website_v[:40]}' is set BUT naics_code={'561499 (fallback)' if naics_v=='561499' else 'missing'}",
             "Gap G2: The AI enrichment (last resort vendor) had access to the website URL but could not classify the industry. Possible cause: the website URL was not passed to the AI as a searchable parameter.",
             "Check integration-service/lib/aiEnrichment/aiEnrichment.ts — verify params.website is being passed. Consider re-running AI enrichment with web_search enabled.",
             "integration-service/lib/aiEnrichment/aiEnrichment.ts"),
            ("Watchlist hit with low SOS confidence",
             wl_hits_n>0 and mdsk_c<0.5,
             "HIGH",
             f"watchlist_hits={wl_hits_n} AND Middesk confidence={mdsk_c:.3f} (<0.50)",
             "The entity has watchlist hits AND Middesk couldn't confidently match it. The entity being screened may not be the same legal entity as the one being operated.",
             "Enhanced due diligence: verify entity identity via manual document review before acting on watchlist hits. The watchlist hit may belong to a different entity with a similar name.",
             "rds_warehouse_public.facts: watchlist_hits, sos_match confidence"),
            ("Adverse media but no watchlist",
             am_n>0 and wl_hits_n==0,
             "NOTICE",
             f"adverse_media_hits={am_n} BUT watchlist_hits=0",
             "Adverse media (negative news) exists but no formal sanctions/PEP list hits. Adverse media is deliberately excluded from the consolidated watchlist fact.",
             "Review adverse_media_hits detail. Negative press may indicate reputational risk even without formal sanctions.",
             "integration-service/lib/facts/kyb/consolidatedWatchlist.ts (filterOutAdverseMedia)"),
            ("Bankruptcy with active SOS",
             bk_n>0 and sos_act=="true",
             "MEDIUM",
             f"num_bankruptcies={bk_n} BUT sos_active=true",
             "Entity is currently in good standing (SOS active) but has bankruptcy history. May be a discharged bankruptcy — entity survived restructuring.",
             "Check bankruptcy age and type (Chapter 7=liquidation vs Chapter 11=reorganization). Discharged BK with active SOS is manageable; recent BK requires enhanced review.",
             "rds_warehouse_public.facts: num_bankruptcies, sos_active"),
        ]

        found_checks=[(name,sev,desc,root,action,src) for name,cond,sev,desc,root,action,src in CHECKS if cond]
        not_found=[(name,sev) for name,cond,sev,desc,root,action,src in CHECKS if not cond]

        if found_checks:
            st.markdown(f"**{len(found_checks)} issue(s) detected** (ordered by severity):")
            for name,sev,desc,root,action,src in sorted(found_checks,
                key=lambda x:{"CRITICAL":0,"HIGH":1,"MEDIUM":2,"NOTICE":3}.get(x[1],4)):
                col={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","NOTICE":"#3B82F6"}.get(sev,"#64748b")
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col};
                    border-radius:10px;padding:14px 18px;margin:8px 0">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="color:{col};font-weight:700;font-size:.88rem">{sev} — {name}</span>
                    <span style="color:#475569;font-size:.68rem;font-family:monospace">{src}</span>
                  </div>
                  <div style="color:#CBD5E1;font-size:.78rem;margin-bottom:6px"><strong>Detected:</strong> {desc}</div>
                  <div style="color:#94A3B8;font-size:.75rem;margin-bottom:4px"><strong>Root cause:</strong> {root}</div>
                  <div style="color:#60A5FA;font-size:.75rem">⚡ <strong>Action:</strong> {action}</div>
                </div>""",unsafe_allow_html=True)
        else:
            flag("✅ No cross-field anomalies detected across all checks.","green")

        # Checks that passed (green)
        with st.expander(f"✅ {len(not_found)} checks passed — click to see"):
            for name,sev in not_found:
                st.markdown(f"<span style='color:#22c55e;font-size:.75rem'>✅ {name}</span>",unsafe_allow_html=True)

        st.markdown("---")

        # Summary matrix
        st.markdown("##### Key Field Consistency Matrix")
        matrix_rows=[]
        for field_a,field_b,val_a,val_b,expected,ok in [
            ("sos_active","sos_match_boolean",sos_act,sos_match,"Should agree (both true or both false)",sos_act==sos_match or sos_act=="true"),
            ("tin_match_boolean","tin_match.status",tin_bool,tin_status,"bool=true only when status='success'",not(tin_bool=="true" and tin_status not in ("success",""))),
            ("idv_passed_boolean","idv_status.SUCCESS",idv_val,str(success_n if isinstance(idv_raw,dict) else "?"),"boolean=true requires SUCCESS>0",not(idv_val=="true" and success_n==0)),
            ("sos_active","formation_state",sos_act,form_state,"active entity should have formation state",(sos_act!="true") or bool(form_state)),
            ("naics_code","mcc_code",naics_v,str(gv(facts,"mcc_code") or ""),"both should be set if classification succeeded",not(bool(naics_v) and not gv(facts,"mcc_code"))),
        ]:
            matrix_rows.append({"Field A":field_a,"Value A":val_a or "(null)","Field B":field_b,"Value B":val_b or "(null)","Expected":expected,"Status":"✅ OK" if ok else "⚠️ CHECK"})
        st.dataframe(pd.DataFrame(matrix_rows),use_container_width=True,hide_index=True)

        analyst_card("🔬 Cross-Analysis — Engineering Interpretation",[
            "Cross-field checks detect three types of issues: (1) Data integrity bugs in integration-service derivation logic, (2) Genuine business risk patterns (BK+active, watchlist+low_conf), (3) Expected patterns that look like errors (IDV passed + name_match=false for sole props with DBA).",
            "TIN bool/status inconsistency is the most critical check — if triggered, the Admin Portal is showing WRONG data. The derivation in lib/facts/kyb/tin_match_boolean.ts may have a bug or the wrong fact is being read.",
            "No vendor confirmation (Middesk conf=0 + OC conf=0) means the entity existence is completely unverified. All subsequent KYB facts (SOS filings, TIN, IDV) may belong to the wrong entity or be fabricated.",
            f"Current status: {len(found_checks)} issue(s) detected, {len(not_found)} checks passed. "
            f"{'⚠️ Manual review recommended.' if len(found_checks)>0 else '✅ No anomalies detected.'}",
        ])

# ════════════════════════════════════════════════════════════════════════════════
# CLASSIFICATION & KYB
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🏭 Classification & KYB":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 🏭 Classification & KYB — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"classification")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    naics=str(gv(facts,"naics_code") or "")
    mcc=str(gv(facts,"mcc_code") or "")
    naics_conf=gc(facts,"naics_code"); naics_src=gp(facts,"naics_code")
    is_fallback=naics=="561499"

    c1,c2,c3,c4,c5=st.columns(5)
    with c1: kpi("NAICS",naics or "N/A",f"{'⚠️ Fallback code' if is_fallback else 'Industry code'} · {pid_info(naics_src)[0]}",
                 "#ef4444" if is_fallback else "#22c55e" if naics else "#64748b")
    with c2: kpi("NAICS Conf",f"{naics_conf:.4f}","0=no match · 1=perfect · formula varies by vendor",
                 "#22c55e" if naics_conf>0.70 else "#f59e0b" if naics_conf>0.40 else "#ef4444")
    with c3: kpi("MCC",mcc or "N/A",f"Merchant Category Code · {pid_info(gp(facts,'mcc_code'))[0]}","#3B82F6")
    with c4: kpi("Industry",str(gv(facts,"industry") or "N/A")[:22],"2-digit NAICS sector group","#8B5CF6")
    with c5:
        alts_n=len(get_alts(facts,"naics_code"))
        kpi("Alt Sources",str(alts_n),f"Other vendors that also classified","#60A5FA" if alts_n>0 else "#64748b")

    if is_fallback:
        flag("🚨 NAICS 561499 = fallback code ('All Other Business Support Services'). "
             "This business's industry could NOT be determined. All vendors failed to classify. "
             "This impacts Worth Score (company_profile feature = low confidence) and MCC (defaults to 5614).", "red")
    elif not naics:
        flag("⚠️ No NAICS code stored. Classification has not been run or all vendors returned null.", "amber")

    cl1,cl2,cl3,cl4=st.tabs(["🏭 NAICS/MCC Pipeline","🏢 Background & Firmographic","📬 Contact & Address","🌐 Website & Digital"])

    with cl1:
        st.markdown("#### 🏭 NAICS/MCC Classification — Complete Pipeline")
        st.caption("""**Fact name:** `naics_code` · **Table:** `rds_warehouse_public.facts` ·
        **Rule:** `factWithHighestConfidence` · **Worth Score impact:** `naics6` feature in Company Profile category ·
        **Admin Portal:** KYB → Background tab → Industry field""")

        # ── Vendor pipeline ───────────────────────────────────────────────────
        st.markdown("##### How NAICS is Determined — Vendor Cascade (ordered by priority)")
        SOURCE_PRIORITY=pd.DataFrame([
            ("Equifax","17","0.7","efx_primnaicscode","warehouse.equifax_us_latest","Bulk firmographic — matched by EFX entity model"),
            ("ZoomInfo","24","0.8","zi_c_naics6","zoominfo.comp_standard_global","Bulk firmographic — matched by ZI entity model"),
            ("OpenCorporates","23","0.9","industry_code_uids → us_naics-XXXXXX","OC company API","Parsed from OC industry tags: 'us_naics-541512' → NAICS 541512"),
            ("SERP (Google)","22","0.3","businessLegitimacyClassification.naics_code","Google Business Profile","Google My Business category → mapped to NAICS"),
            ("Trulioo","38","0.7","extractStandardizedIndustriesFromTruliooResponse","Trulioo KYB API","Industry field from Trulioo company verification response"),
            ("Applicant","0","0.2","naics_code (6-digit, validated)","Onboarding form","Self-reported by merchant — lowest trust"),
            ("AI (GPT-4o-mini)","31","0.1","AINaicsEnrichment.response.naics_code","integration-service/lib/aiEnrichment","LAST RESORT: fires only when ALL vendors fail. Prompts GPT with name+address+(website if available)"),
        ],columns=["Vendor","pid","Weight","Data Field","Data Source","How it works"])
        SOURCE_PRIORITY["Won?"]=["✅ YES" if r["pid"]==naics_src else "—" for _,r in SOURCE_PRIORITY.iterrows()]
        SOURCE_PRIORITY["Conf formula"]=[
            "match.index ÷ 55 (MAX=55)","match.index ÷ 55","match.index ÷ 55",
            "heuristic","status-based","1.0 (self-reported)","self-reported (LOW=0.3 MED=0.6 HIGH=0.9)"
        ]
        st.dataframe(SOURCE_PRIORITY,use_container_width=True,hide_index=True)

        # ── Winner detail ─────────────────────────────────────────────────────
        if naics_src:
            win_name=pid_info(naics_src)[0]
            conf_formula={"23":"match.index ÷ 55 (where match.index = rank of OC search result, max=55)",
                          "24":"match.index ÷ 55 (ZI entity match rank)",
                          "17":"XGBoost entity match score OR match.index ÷ 55",
                          "16":"0.15 + 0.20 × passing Middesk review tasks (max 4)",
                          "38":"status-based: SUCCESS=0.70 · PARTIAL=0.40 · FAILED=0.20",
                          "31":"self-reported: LOW=0.30 · MEDIUM=0.60 · HIGH=0.90",
                          "0":"1.00 by convention (applicant self-reported)",
                          "22":"heuristic based on SERP result quality"}.get(naics_src,"see Fact Engine")
            st.markdown(f"""<div style="background:#052e16;border-left:4px solid #22c55e;border-radius:10px;padding:12px 16px;margin:8px 0">
              <div style="color:#22c55e;font-weight:700;font-size:.88rem">✅ Winner: {win_name} (pid={naics_src})</div>
              <div style="color:#CBD5E1;font-size:.78rem;margin-top:6px">
                <strong>NAICS code:</strong> {naics or '(null)'} · 
                <strong>Confidence:</strong> {naics_conf:.4f} ({conf_formula}) ·
                <strong>Rule:</strong> factWithHighestConfidence (highest conf×weight, WEIGHT_THRESHOLD=0.05)
              </div>
            </div>""",unsafe_allow_html=True)

        # ── Fact lineage table ────────────────────────────────────────────────
        render_lineage(facts,["naics_code","mcc_code","naics_description","mcc_description","industry"])

        # ── Alternatives ──────────────────────────────────────────────────────
        alts=get_alts(facts,"naics_code")
        if alts:
            st.markdown("##### Alternative NAICS Sources (competed but lost)")
            alt_rows=[]
            for a in alts:
                vname=pid_info(a["pid"])[0]
                why=(f"Confidence {a['conf']:.4f} < winner {naics_conf:.4f}"
                     if a["conf"]<naics_conf
                     else f"Lower platform weight (tie-break) — same conf range ±0.05")
                alt_rows.append({"Vendor":vname,"pid":a["pid"],
                    "NAICS code":str(a.get("value",""))[:20] if a.get("value") else "(null)",
                    "Confidence":f"{a['conf']:.4f}","Why lost":why})
            st.dataframe(pd.DataFrame(alt_rows),use_container_width=True,hide_index=True)
            st.caption("These are the exact values from alternatives[] in the JSON stored in rds_warehouse_public.facts")
        else:
            st.info("No alternative NAICS sources — only one vendor returned a classification for this business.")

        # ── MCC derivation ────────────────────────────────────────────────────
        st.markdown("##### MCC Derivation")
        st.markdown(f"""<div style="background:#0c1a2e;border-left:3px solid #3B82F6;border-radius:8px;padding:12px 16px;margin:8px 0;font-size:.78rem">
          <div style="color:#60A5FA;font-weight:600;margin-bottom:6px">How MCC is computed (two-step logic):</div>
          <div style="color:#CBD5E1">
            Step 1 — Direct AI classification: if AI (pid=31) returned an MCC code directly → use <code>mcc_code_found</code><br>
            Step 2 — NAICS→MCC lookup: if no direct MCC → look up <code>naics_code</code> in <code>rel_naics_mcc</code> mapping table → <code>mcc_code_from_naics</code><br>
            Step 3 — Fallback: if NAICS=561499 (fallback) → MCC defaults to <strong>5614</strong> (Business Services NEC)<br>
            <br><strong>Current:</strong> NAICS={naics or '(null)'} → MCC={mcc or '(null)'}
          </div>
        </div>""",unsafe_allow_html=True)

        # ── 561499 root cause ─────────────────────────────────────────────────
        if is_fallback:
            st.markdown("---")
            st.markdown("#### 🚨 561499 Root Cause Analysis")
            st.markdown("NAICS 561499 = 'All Other Business Support Services' — the industry the Fact Engine assigns when ALL other options fail.")
            website_v=str(gv(facts,"website") or "")
            for gap,desc,is_present,evidence in [
                ("G1: Entity matching failed — no commercial NAICS available",
                 "None of ZI, EFX, OC, Middesk could match this entity in their database. "
                 "The entity may be too new (<2 weeks), too small (no commercial database presence), "
                 "or submitted with a name/address that doesn't match any registry record.",
                 len(alts)==0 and naics_conf<0.1,
                 f"Alternatives: {len(alts)} source(s) | Winner conf: {naics_conf:.4f}"),
                ("G2: AI web_search not triggered (Gap G2)",
                 "The AI enrichment (last resort) received the business name+address but NOT the website URL. "
                 "The AI cannot search the web without the website parameter. "
                 "Source: integration-service/lib/aiEnrichment/aiEnrichment.ts — params.website must be non-null.",
                 bool(website_v) and is_fallback,
                 f"website fact = '{website_v[:50]}' (not empty — URL exists but was not passed to AI)"),
                ("G3: AI classification failed — insufficient signals",
                 "AI received name+address (and possibly website) but could not confidently classify. "
                 "Common causes: generic name ('ABC LLC'), no web presence, or website with insufficient content. "
                 "AI prompt requires sufficient business description to return a specific NAICS.",
                 naics_src=="31" and is_fallback,
                 f"Winner is AI (pid={naics_src}) with conf={naics_conf:.4f} → returned 561499 anyway"),
            ]:
                color="#ef4444" if is_present else "#334155"
                prefix="🔴 CONFIRMED" if is_present else "⚪ Not confirmed"
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                    border-radius:8px;padding:10px 14px;margin:4px 0">
                  <div style="color:{color};font-weight:700;font-size:.82rem">{prefix} — {gap}</div>
                  <div style="color:#94A3B8;font-size:.74rem;margin-top:4px">{desc}</div>
                  <div style="color:#475569;font-size:.68rem;margin-top:2px">Evidence: {evidence}</div>
                </div>""",unsafe_allow_html=True)

        # ── JSON structure ────────────────────────────────────────────────────
        with st.expander("📄 JSON structure — naics_code in API response"):
            st.markdown(f"""```json
{{
  "naics_code": {{
    "name": "naics_code",
    "value": "{naics or 'null'}",           ← shown in Admin Portal KYB → Background → Industry
    "source": {{
      "confidence": {naics_conf:.4f},        ← formula varies by vendor (see table above)
      "platformId": {naics_src or 'null'},   ← winning vendor
      "name": "{pid_info(naics_src)[0].lower()}"
    }},
    "ruleApplied": {{ "name": "factWithHighestConfidence" }},
    "alternatives": [
      // All other vendors that returned a NAICS code, with their confidence
      // {{ "value": "541512", "source": 23, "confidence": 0.8182 }}
      // {{ "value": "722511", "source": 24, "confidence": 0.5455 }}
    ]
  }},
  "mcc_code": {{
    "value": "{mcc or 'null'}",             ← mcc_code_found ?? mcc_code_from_naics
    "source": {{ "platformId": -1, "name": "dependent" }}  ← derived fact
  }}
}}
```""")

        ai_popup("NAICS",f"NAICS:{naics} conf:{naics_conf:.4f} src:{pid_info(naics_src)[0]} MCC:{mcc} fallback:{is_fallback}",[
            "Why did this specific vendor win the NAICS classification?",
            "What is the exact algorithm for factWithHighestConfidence with WEIGHT_THRESHOLD=0.05?",
            "What are all 3 root causes of NAICS 561499 and how to fix each?",
            "How does the rel_naics_mcc lookup table map NAICS to MCC?",
            "What SQL shows NAICS history and all alternative sources?"],bid)

        with st.expander("📋 SQL & Python"):
            st.code(sql_for(bid,["naics_code","mcc_code","naics_description","mcc_description","industry"]),language="sql")
            st.code(f"""-- NAICS history (all versions, including alternatives):
SELECT
    name,
    JSON_EXTRACT_PATH_TEXT(value,'value')               AS naics_code,
    JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS winning_pid,
    JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence,
    JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')  AS rule,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}' AND name IN ('naics_code','mcc_code','naics_description','industry')
ORDER BY name, received_at DESC;""",language="sql")
            st.code(py_for(bid,["naics_code","mcc_code"]),language="python")

        analyst_card("🔬 NAICS Classification — Complete Engineering Analysis",[
            f"Winning source: {pid_info(naics_src)[0]} (pid={naics_src}) · "
            f"confidence {naics_conf:.4f} · rule: factWithHighestConfidence (WEIGHT_THRESHOLD=0.05). "
            f"{'⚠️ AI wins only when ALL commercial vendors fail.' if naics_src=='31' else '✅ Commercial vendor won.'}",
            f"Confidence interpretation: {naics_conf:.4f} → "
            f"{'Reliable (>0.70)' if naics_conf>0.70 else 'Moderate (0.40–0.70), verify with alternatives' if naics_conf>0.40 else 'LOW (<0.40) — classification may be wrong'}. "
            f"For OC/ZI/EFX: conf = entity_match_rank ÷ 55 where 55=MAX_CONFIDENCE_INDEX. "
            f"A conf of 0.35 means the entity was the 35th-ranked result in the vendor search.",
            "MCC derivation: (1) AI direct MCC if returned → (2) rel_naics_mcc lookup from NAICS → (3) 5614 if NAICS=561499. "
            "MCC is a DERIVED fact (pid=-1, dependent). It is NOT independently verified by any vendor.",
            f"{'⚠️ 561499 fallback: this code impacts Worth Score (naics6 feature in Company Profile category). ' if is_fallback else ''}"
            "naics6 is a Worth Score model input — unknown NAICS reduces model confidence and may lower score.",
            f"Alternatives found: {len(alts)} other vendor(s) also provided NAICS codes. "
            f"{'They are visible in alternatives[] of the JSON. The Fact Engine rejected them because their confidence×weight was lower.' if alts else 'No alternatives — only one vendor returned a classification.'}",
        ])

    with cl2:
        st.markdown("#### 🏢 Background & Firmographic Data")
        st.caption("""**Sources:** ZoomInfo (pid=24, w=0.8), Equifax (pid=17, w=0.7), Middesk (pid=16, w=2.0), Applicant (pid=0) ·
        **Admin Portal:** KYB → Background tab · **Worth Score features:** revenue, count_employees, age_business""")

        # KPIs
        biz_name=str(gv(facts,"business_name") or "")
        legal_name_v=str(gv(facts,"legal_name") or "")
        revenue_v=str(gv(facts,"revenue") or "")
        emp_v=str(gv(facts,"num_employees") or "")
        kyb_sub=str(gv(facts,"kyb_submitted") or "").lower()
        kyb_comp=str(gv(facts,"kyb_complete") or "").lower()

        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("KYB Submitted","✅ Yes" if kyb_sub=="true" else "❌ No","Onboarding form submitted","#22c55e" if kyb_sub=="true" else "#f59e0b")
        with c2: kpi("KYB Complete","✅ Yes" if kyb_comp=="true" else "❌ No","Business verified + people screened","#22c55e" if kyb_comp=="true" else "#f59e0b")
        with c3: kpi("Revenue",revenue_v[:18] if revenue_v else "Not available","ZI/EFX bulk data · Worth Score input","#3B82F6" if revenue_v else "#64748b")
        with c4: kpi("Employees",emp_v if emp_v else "Not available","num_employees · Worth Score feature: count_employees","#3B82F6" if emp_v else "#64748b")

        # Name lineage
        st.markdown("##### Name Lineage — business_name vs legal_name")
        st.markdown("""<div style="background:#0c1a2e;border-left:3px solid #f59e0b;border-radius:8px;padding:10px 14px;margin:6px 0;font-size:.78rem">
          <div style="color:#fde68a;font-weight:600">⚠️ business_name ≠ legal_name — understand the difference:</div>
          <div style="color:#CBD5E1;margin-top:4px">
            <strong>business_name</strong> = what the merchant submitted on the onboarding form (may be DBA / trade name)<br>
            <strong>legal_name</strong> = the entity's legal name as registered with the Secretary of State (from Middesk/OC)<br>
            <strong>names_found</strong> = combineFacts array of ALL names found across ALL vendors (merged, deduplicated)<br>
            <strong>dba_found</strong> = DBA names from applicant submission + registry filings (also combineFacts)<br>
            A mismatch between business_name and legal_name is expected for DBAs. It does NOT indicate fraud.
          </div>
        </div>""",unsafe_allow_html=True)

        render_lineage(facts,["business_name","legal_name","names_found","dba_found","corporation",
                               "formation_date","year_established","revenue","num_employees",
                               "kyb_submitted","kyb_complete","compliance_status","risk_score"])

        # Worth Score features
        st.markdown("##### Worth Score Feature Mapping — Firmographic inputs")
        try:
            fd_str=str(gv(facts,"formation_date") or "")
            biz_age=datetime.now(timezone.utc).year-int(fd_str[:4]) if fd_str and fd_str[:4].isdigit() else None
        except: biz_age=None

        feat_rows=[
            ("age_business",f"{biz_age} years" if biz_age else "Unknown","formation_date → current year minus formation year","Company Profile","Older businesses = lower default risk"),
            ("revenue",revenue_v or "null","revenue fact from ZI/EFX","Business Operations","Primary P&L input to financial sub-model"),
            ("count_employees",emp_v or "null","num_employees fact from ZI/EFX","Company Profile","Proxy for business scale and stability"),
            ("naics6",naics or "null","naics_code fact (6-digit)","Company Profile","Industry risk classification — 561499 = penalty"),
            ("bus_struct",str(gv(facts,"corporation") or ""),"corporation fact","Company Profile","LLC vs Corp vs Sole Prop — different risk profiles"),
        ]
        st.dataframe(pd.DataFrame(feat_rows,columns=["Worth Score Feature","Current Value","Source fact","Model Category","Why it matters"]),
                     use_container_width=True,hide_index=True)

        ai_popup("Background",f"revenue:{revenue_v} employees:{emp_v} kyb_submitted:{kyb_sub}",[
            "What is the difference between business_name and legal_name?",
            "How is dba_found determined and what sources contribute?",
            "How does revenue data from ZoomInfo affect the Worth Score?",
            "What does kyb_complete=false mean and what is blocking it?"],bid)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["business_name","legal_name","dba_found","corporation",
                                  "formation_date","revenue","num_employees","kyb_submitted","kyb_complete"]),language="sql")

    with cl3:
        st.markdown("#### 📬 Contact & Address Verification")
        st.caption("""**Address winner:** Middesk (pid=16) for primary, combineFacts for all addresses ·
        **Name match winner:** Middesk (pid=16) · **Admin Portal:** KYB → Contact Information tab""")

        am_bool=str(gv(facts,"address_match_boolean") or "").lower()
        nm_bool=str(gv(facts,"name_match_boolean") or "").lower()
        ra_v=facts.get("address_registered_agent",{}).get("value",{})

        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("Address Match","✅ Matched" if am_bool=="true" else "❌ No match" if am_bool=="false" else "⚠️ Unknown",
                     "address_match_boolean","#22c55e" if am_bool=="true" else "#ef4444")
        with c2: kpi("Name Match","✅ Matched" if nm_bool=="true" else "❌ No match" if nm_bool=="false" else "⚠️ Unknown",
                     "name_match_boolean","#22c55e" if nm_bool=="true" else "#ef4444")
        with c3: kpi("Deliverable Address","✅ Yes" if gv(facts,"addresses_deliverable") else "⚠️ Unknown",
                     "USPS confirmed deliverable","#22c55e" if gv(facts,"addresses_deliverable") else "#64748b")
        with c4:
            ra_status=ra_v.get("status","") if isinstance(ra_v,dict) else ""
            kpi("Registered Agent Addr","⚠️ WARNING" if ra_status=="warning" else "✅ OK",
                "address_registered_agent","#f59e0b" if ra_status=="warning" else "#22c55e")

        if ra_status=="warning":
            ra_msg=ra_v.get("message","") if isinstance(ra_v,dict) else ""
            flag(f"⚠️ address_registered_agent WARNING: '{ra_msg}'. "
                 "The submitted office address matches a known registered agent (e.g. a law firm or incorporation service). "
                 "This is common for tax-haven incorporations (DE/NV/WY) and may indicate the entity is not physically operating at this address.", "amber")

        render_lineage(facts,["primary_address","addresses","addresses_submitted","addresses_found",
                               "addresses_deliverable","address_match","address_match_boolean",
                               "address_verification","address_verification_boolean","address_registered_agent",
                               "business_phone","phone_found","email",
                               "name_match","name_match_boolean"])

        st.markdown("##### Address Verification Pipeline")
        for step,src,desc,color in [
            ("1. Applicant submits address","Onboarding form (pid=0)","addresses_submitted fact — what the merchant claims their address is","#f59e0b"),
            ("2. Middesk verifies address","Middesk API (pid=16, w=2.0)","Middesk searches SOS registry and USPS for the submitted address. Returns: status (success/failure), matched addresses, deliverable subset.","#f59e0b"),
            ("3. address_verification stored","rds_warehouse_public.facts","Object: {addresses[], baseAddresses[], status, message, label, sublabel}. Winner: Middesk via factWithHighestConfidence.","#22c55e"),
            ("4. address_match_boolean derived","Fact Engine (dependent, pid=-1)","true when address_verification.status='success'. Dependencies: ['address_verification'].","#22c55e"),
            ("5. addresses_deliverable stored","Middesk (pid=16)","Subset of addresses confirmed deliverable by USPS via Middesk. Used for mail-based verification.","#3B82F6"),
            ("6. Admin Portal display","microsites ContactInformation.tsx","Shows primary_address (derived from addresses). Address verification badge = address_match_boolean.","#60A5FA"),
        ]:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};border-radius:6px;
                padding:7px 12px;margin:3px 0;font-size:.73rem">
              <strong style="color:{color}">{step}</strong>
              <span style="color:#64748b;margin-left:8px">{src}</span>
              <div style="color:#94A3B8;margin-top:2px">{desc}</div>
            </div>""",unsafe_allow_html=True)

        ai_popup("Contact",f"addr_match:{am_bool} name_match:{nm_bool} reg_agent:{ra_status}",[
            "How is address_match_boolean derived from address_verification?",
            "What does addresses_deliverable mean and how is it different from addresses_found?",
            "What does address_registered_agent warning mean for underwriting?",
            "How is name_match_boolean determined?"],bid)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["primary_address","addresses","address_match_boolean",
                                  "address_verification","addresses_deliverable","address_registered_agent",
                                  "name_match","name_match_boolean"]),language="sql")

    with cl4:
        st.markdown("#### 🌐 Website & Digital Presence")
        st.caption("""**Website source:** Applicant (pid=0) or SERP (pid=22) · 
        **SERP data:** Google My Business via SERP API · **NAICS link:** AI uses website for classification (Gap G2 if missing)""")

        website_v=str(gv(facts,"website") or "")
        web_found_v=gv(facts,"website_found")
        web_found_str=str(web_found_v or "").lower() if not isinstance(web_found_v,list) else "true" if web_found_v else "false"
        serp_id=str(gv(facts,"serp_id") or "")
        rating=str(gv(facts,"review_rating") or "")
        rev_count=str(gv(facts,"review_count") or "")

        c1,c2,c3,c4=st.columns(4)
        with c1: kpi("Website",website_v[:30] if website_v else "❌ Not submitted","Applicant-submitted URL","#22c55e" if website_v else "#f59e0b")
        with c2: kpi("Website Found","✅ Yes" if web_found_str=="true" else "❌ No","Verified by SERP/Middesk","#22c55e" if web_found_str=="true" else "#64748b")
        with c3: kpi("SERP/GMB ID","✅ Found" if serp_id else "❌ Not found","Google My Business presence","#22c55e" if serp_id else "#64748b")
        with c4: kpi("Review Rating",rating if rating else "N/A",f"{rev_count} reviews" if rev_count else "No reviews","#3B82F6" if rating else "#64748b")

        # NAICS-website link warning
        if website_v and is_fallback:
            flag("🚨 Gap G2 CONFIRMED: website is set but NAICS=561499. "
                 "The AI enrichment (last resort) had access to the website URL in the facts table BUT "
                 "integration-service/lib/aiEnrichment/aiEnrichment.ts did not pass params.website to the AI prompt. "
                 "Fix: pass website URL as a parameter so AI can use web_search to determine industry.", "red")
        elif not website_v and is_fallback:
            flag("Gap G1/G3: No website submitted AND NAICS=561499. AI had no URL to search. "
                 "Common for micro-businesses, sole props, and new businesses.", "amber")
        elif website_v and not is_fallback:
            flag(f"✅ Website present ('{website_v[:40]}') and NAICS classified ({naics}). "
                 "No Gap G2 detected.", "green")

        render_lineage(facts,["website","website_found","serp_id","all_google_place_ids",
                               "review_rating","review_count","google_review_count","google_review_rating"])

        st.markdown("""<div style="background:#0c1a2e;border-left:3px solid #8B5CF6;border-radius:8px;padding:10px 14px;margin:8px 0;font-size:.78rem">
          <div style="color:#a5b4fc;font-weight:600">How website data feeds NAICS classification (the G2 gap)</div>
          <div style="color:#CBD5E1;margin-top:4px">
            <code>website</code> fact (pid=0 or pid=22) → passed to AI enrichment as <code>params.website</code><br>
            AI prompt: "Given business name=X, address=Y, website=Z, what is the 6-digit NAICS code?"<br>
            If <code>params.website=null</code> → AI cannot use web_search → classifies from name+address only → often returns 561499<br>
            <strong>Source:</strong> integration-service/lib/aiEnrichment/aiEnrichment.ts · lib/aiEnrichment/constants.ts
          </div>
        </div>""",unsafe_allow_html=True)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["website","website_found","serp_id","review_rating","review_count"]),language="sql")

# ════════════════════════════════════════════════════════════════════════════════
# RISK & WATCHLIST
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="⚠️ Risk & Watchlist":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## ⚠️ Risk & Watchlist — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"risk")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    wl=int(float(gv(facts,"watchlist_hits") or 0))
    am=int(float(gv(facts,"adverse_media_hits") or 0))
    bk=int(float(gv(facts,"num_bankruptcies") or 0))
    ju=int(float(gv(facts,"num_judgements") or 0))
    li=int(float(gv(facts,"num_liens") or 0))

    c1,c2,c3,c4,c5=st.columns(5)
    with c1: kpi("Watchlist Hits",str(wl),"PEP+Sanctions (adverse_media separate)","#ef4444" if wl>0 else "#22c55e")
    with c2: kpi("Adverse Media",str(am),"Separate from watchlist","#f59e0b" if am>0 else "#22c55e")
    with c3: kpi("Bankruptcies",str(bk),"num_bankruptcies","#8B5CF6" if bk>0 else "#22c55e")
    with c4: kpi("Judgments",str(ju),"num_judgements","#8B5CF6" if ju>0 else "#22c55e")
    with c5: kpi("Liens",str(li),"num_liens","#8B5CF6" if li>0 else "#22c55e")
    if wl>0: flag(f"🚨 {wl} watchlist hit(s). SANCTIONS=hard stop · PEP=Enhanced Due Diligence · Other=manual review.","red")

    rw1,rw2,rw3=st.tabs(["🔍 Watchlist Detail","📜 Public Records","🔗 Risk Combinations"])

    with rw1:
        render_lineage(facts,["watchlist_hits","adverse_media_hits","screened_people"])

        st.markdown("##### Watchlist Data Flow (9 steps)")
        for i,(s,src,d) in enumerate([
            ("Vendor Screening","Trulioo PSC + Middesk review task","Screen business + UBOs against global watchlists"),
            ("integration_data.business_entity_review_task","RDS PostgreSQL","key='watchlist',category='compliance',status='warning'|'success',metadata=JSONB hits"),
            ("Facts Engine → watchlist_raw","integration-service","Direct vendor output (pid=38 Trulioo or pid=16 Middesk)"),
            ("consolidatedWatchlist.ts","integration-service","Merge business + person hits, deduplicate, EXCLUDE adverse_media (filterOutAdverseMedia)"),
            ("watchlist fact","rds_warehouse_public.facts","PEP + SANCTIONS only. metadata=[{type,entityName,url,listType}]"),
            ("watchlist_hits fact","rds_warehouse_public.facts","COUNT of hits (watchlist.value.metadata.length)"),
            ("adverse_media_hits fact","rds_warehouse_public.facts","SEPARATE count — Trulioo adverse_media + adverseMediaDetails.records"),
            ("clients.customer_table","Redshift warehouse-service","watchlist_count, watchlist_verification (1=clean, 0=hits)"),
            ("Admin Portal KYB → Watchlists tab","UI","Shows hits grouped by entity_name. Sanctions=🔴 PEP=🟠 Other=🟡"),
        ]):
            color=["#f59e0b","#ef4444","#8B5CF6","#8B5CF6","#22c55e","#22c55e","#22c55e","#3B82F6","#60a5fa"][i]
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:2px 0;font-size:.74rem">
              <strong style="color:{color}">{i+1}. {s}</strong>
              <span style="color:#64748b;margin-left:8px;font-size:.68rem">{src}</span>
              <div style="color:#94A3B8;margin-top:2px">{d}</div>
            </div>""",unsafe_allow_html=True)

        # BERT live query (cached)
        st.markdown("##### Live BERT Query (rds_integration_data)")
        bert_df,bert_err=load_bert(bid)
        if bert_df is not None and not bert_df.empty: st.dataframe(bert_df,use_container_width=True,hide_index=True)
        else: flag(f"BERT table not accessible. {bert_err or ''}","blue")

        for hit_type,icon,label,desc in [
            ("SANCTIONS","🔴","OFAC/UN/EU/HMT sanctions","HARD STOP — cannot approve without compliance clearance"),
            ("PEP","🟠","Politically Exposed Person","Enhanced Due Diligence required — NOT automatic denial"),
            ("ADVERSE_MEDIA","🟡","Negative news coverage","EXCLUDED from consolidated watchlist fact — tracked in adverse_media_hits"),
            ("OTHER","⚪","Other compliance lists","Manual review required"),
        ]:
            color={"SANCTIONS":"#ef4444","PEP":"#f97316","ADVERSE_MEDIA":"#f59e0b","OTHER":"#64748b"}[hit_type]
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:8px 14px;margin:3px 0">
              <span style="color:{color};font-weight:700">{icon} {hit_type}: {label}</span>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:3px">{desc}</div>
            </div>""",unsafe_allow_html=True)

        ai_popup("Watchlist",f"wl_hits:{wl} adverse_media:{am}",[
            "Why is adverse media excluded from the consolidated watchlist?",
            "What is the difference between SANCTIONS and PEP hits?",
            "How is watchlist_hits count calculated?",
            "What SQL shows watchlist data from clients.customer_table?",],bid)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["watchlist_hits","adverse_media_hits"]),language="sql")
            st.code(f"""-- BERT detailed hits:
SELECT bert.status,bert.sublabel,bert.created_at
FROM rds_integration_data.business_entity_review_task bert
JOIN rds_integration_data.business_entity_verification bev ON bev.id=bert.business_entity_verification_id
WHERE bev.business_id='{bid}' AND bert.key='watchlist';

-- Customer table:
SELECT watchlist_count,watchlist_verification FROM clients.customer_table WHERE business_id='{bid}';""",language="sql")

        analyst_card("Watchlist Architecture — Key Points",[
            f"watchlist_hits={wl}: PEP+SANCTIONS only. Adverse media EXCLUDED (filterOutAdverseMedia in consolidatedWatchlist.ts L57).",
            f"adverse_media_hits={am}: Tracked separately. Different due diligence action required than sanctions/PEP.",
            "consolidatedWatchlist merges BOTH business-level (Middesk review task) AND person-level (Trulioo PSC screening of UBOs/directors) hits.",
            "clients.customer_table.watchlist_verification: 1=clean, 0=has hits. This is the 'watchlists' column in exports.",
        ])

    with rw2:
        st.markdown("#### 📜 Public Records — Bankruptcies, Judgments & Liens")
        st.caption("""**Sources:** Equifax (pid=17) public records database · **Stored in:** `rds_warehouse_public.facts` ·
        **Worth Score impact:** Public Records category — highest negative impact features ·
        **Admin Portal:** KYB → Public Records tab""")

        render_lineage(facts,["num_bankruptcies","num_judgements","num_liens"])

        # Impact table
        st.markdown("##### Worth Score Impact — Public Records Features")
        impact_data=[
            ("Bankruptcies",bk,"count_bankruptcy","age_bankruptcy",
             "−40 pts per filing (cap: −120 pts)","Chapter 7=liquidation · Chapter 11=reorganization · Chapter 13=personal debt adjustment",
             "Public Records","#ef4444" if bk>0 else "#22c55e"),
            ("Judgments",ju,"count_judgment","age_judgment",
             "−20 pts per filing (cap: −60 pts)","Civil court judgments — creditor won lawsuit against business. Indicates payment disputes.",
             "Public Records","#f97316" if ju>0 else "#22c55e"),
            ("Liens",li,"count_lien","age_lien",
             "−10 pts per lien (cap: −40 pts)","Tax liens (IRS) or mechanic liens. Business owes money secured against assets.",
             "Public Records","#f59e0b" if li>0 else "#22c55e"),
        ]
        for label,count,feat_count,feat_age,impact,desc,cat,color in impact_data:
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:10px;padding:12px 16px;margin:6px 0">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="color:{color};font-weight:700;font-size:.88rem">{label}: {count}</span>
                <span style="color:#64748b;font-size:.70rem">Worth Score: {impact}</span>
              </div>
              <div style="color:#94A3B8;font-size:.74rem;margin-top:4px">{desc}</div>
              <div style="color:#475569;font-size:.70rem;margin-top:2px">
                Model features: <code>{feat_count}</code> + <code>{feat_age}</code> · Category: {cat}
              </div>
            </div>""",unsafe_allow_html=True)

        if bk==0 and ju==0 and li==0:
            flag("✅ No bankruptcies, judgments, or liens found. Public Records category contributes positively to Worth Score.", "green")

        st.markdown("##### What the Raw Arrays Contain (PostgreSQL RDS required — too large for Redshift)")
        st.code(f"""-- bankruptcies array (PostgreSQL RDS port 5432):
SELECT
    filing->>'type'         AS bankruptcy_type,     -- Chapter 7, 11, 13
    filing->>'status'       AS status,              -- open, closed, discharged
    filing->>'filed_at'     AS filed_date,
    filing->>'closed_at'    AS closed_date,
    filing->>'assets'       AS assets,
    filing->>'liabilities'  AS liabilities
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='bankruptcies' AND business_id='{bid}';

-- judgements array:
SELECT
    j->>'plaintiff', j->>'amount', j->>'status', j->>'filed_at'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS j
WHERE name='judgements' AND business_id='{bid}';

-- liens array:
SELECT
    l->>'type', l->>'amount', l->>'status', l->>'filed_at'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS l
WHERE name='liens' AND business_id='{bid}';

-- Scalar counts (Redshift OK):
{sql_for(bid,["num_bankruptcies","num_judgements","num_liens"])}""",language="sql")

        analyst_card("🔬 Public Records — Engineering Analysis",[
            f"Current: BK={bk}, Judgments={ju}, Liens={li}. "
            f"Estimated Worth Score impact: ~{-(min(bk*40,120)+min(ju*20,60)+min(li*10,40))} points from public records alone.",
            "Source: Equifax (pid=17) public records. Equifax queries court records, IRS tax liens, and civil judgment databases. These are updated monthly in bulk — not real-time.",
            "num_bankruptcies/judgements/liens are SCALAR COUNTS extracted from the large arrays (bankruptcies, judgements, liens). The scalar counts are safe to query from Redshift. The full arrays (with dates, amounts, types) must be queried from PostgreSQL RDS.",
            "Worth Score features use BOTH count AND age: count_bankruptcy (how many) + age_bankruptcy (years since most recent filing). A 10-year-old bankruptcy carries less weight than a 6-month-old one.",
            "CRITICAL: num_bankruptcies=0 does not mean the business has no bankruptcy history — it means Equifax found no records OR Equifax could not match this entity. Very new businesses and micro-businesses often have no Equifax coverage.",
        ])

    with rw3:
        st.markdown("#### 🔗 Risk Combination Analysis")
        st.caption("Cross-signal analysis — identifying which combinations of risk signals require specific underwriting actions")

        RISK_COMBOS=[
            # (condition, severity, title, detail, action)
            (wl>0 and bk>0,
             "CRITICAL","🔴 Watchlist + Bankruptcy",
             f"Watchlist hits={wl} AND bankruptcies={bk}. Both compliance AND credit risk are flagged simultaneously.",
             "Hard stop on compliance side (watchlist). Cannot approve regardless of credit. File SAR if SANCTIONS hit. Manual underwriting required."),
            (wl>0 and am>0,
             "HIGH","🔴 Watchlist + Adverse Media",
             f"Watchlist hits={wl} AND adverse_media_hits={am}. Formal compliance hit plus negative press coverage.",
             "Verify if adverse media is related to the watchlist hit entity. Enhanced due diligence required. Both signals point to the same risk."),
            (wl>0 and bk==0 and am==0,
             "HIGH","🔴 Watchlist Only",
             f"Watchlist hits={wl} with no bankruptcy or adverse media.",
             "Compliance review required. Determine hit type: SANCTIONS=hard stop, PEP=enhanced DD, OTHER=manual review."),
            (bk>0 and ju>0 and li>0,
             "HIGH","🔴 Full Public Records Trifecta",
             f"BK={bk}, Judgments={ju}, Liens={li}. Worst possible public records profile.",
             "Thorough financial document review. May indicate ongoing distress or poor payment history. High Worth Score penalty: estimated {-(min(bk*40,120)+min(ju*20,60)+min(li*10,40))} pts."),
            (bk>0 and ju==0 and li==0,
             "MEDIUM","🟡 Bankruptcy Only",
             f"bankruptcy={bk}, no judgments or liens.",
             f"Check bankruptcy type and age. Discharged BK > 5 years ago is manageable. Recent BK (< 2 years) requires enhanced review."),
            (am>0 and wl==0,
             "MEDIUM","🟡 Adverse Media Only",
             f"adverse_media_hits={am} but no formal watchlist hits.",
             "Adverse media is tracked separately. Review content. Negative press ≠ automatic denial. Requires qualitative assessment."),
            (wl==0 and bk==0 and ju==0 and li==0 and am==0,
             "CLEAN","✅ No Risk Signals",
             "No watchlist hits, no bankruptcies, no judgments, no liens, no adverse media.",
             "Clean profile. Standard underwriting proceeds. Monitor via risk monitoring alerts."),
        ]

        found_combos=[(sev,title,detail,action) for cond,sev,title,detail,action in RISK_COMBOS if cond]
        for sev,title,detail,action in found_combos:
            color={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","CLEAN":"#22c55e"}.get(sev,"#64748b")
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:10px;padding:14px 18px;margin:8px 0">
              <div style="color:{color};font-weight:700;font-size:.90rem;margin-bottom:6px">{title}</div>
              <div style="color:#CBD5E1;font-size:.79rem;margin-bottom:8px">{detail}</div>
              <div style="background:#0f172a;border-radius:6px;padding:8px 12px">
                <span style="color:#60A5FA;font-size:.74rem;font-weight:600">⚡ Required action: </span>
                <span style="color:#94A3B8;font-size:.74rem">{action}</span>
              </div>
            </div>""",unsafe_allow_html=True)

        # Risk signal summary bar chart
        risk_vals=[("Watchlist Hits",wl,"#ef4444"),("Adverse Media",am,"#f59e0b"),
                   ("Bankruptcies",bk,"#8B5CF6"),("Judgments",ju,"#8B5CF6"),("Liens",li,"#6366f1")]
        if any(v>0 for _,v,_ in risk_vals):
            fig_risk=go.Figure(go.Bar(
                x=[r[0] for r in risk_vals],y=[r[1] for r in risk_vals],
                marker_color=[r[2] for r in risk_vals],
                text=[str(r[1]) for r in risk_vals],textposition="outside",
            ))
            fig_risk.update_layout(title="Risk Signal Counts for this Business",
                                   height=280,xaxis_title="",yaxis_title="Count",
                                   margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_risk),use_container_width=True)

        with st.expander("📋 SQL — risk signal queries"):
            st.code(f"""-- All risk signals in one query:
SELECT
    JSON_EXTRACT_PATH_TEXT(value,'value') AS count_value,
    received_at
FROM rds_warehouse_public.facts
WHERE business_id='{bid}'
  AND name IN ('watchlist_hits','adverse_media_hits','num_bankruptcies','num_judgements','num_liens')
ORDER BY name;

-- Watchlist detail (clients.customer_table):
SELECT watchlist_count, watchlist_verification, adverse_media_hits
FROM clients.customer_table
WHERE business_id='{bid}';

-- Worth Score public records feature impact:
SELECT category_id, score_100, weighted_score_850
FROM rds_manual_score_public.business_score_factors
WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{bid}' LIMIT 1)
  AND category_id='public_records';""",language="sql")

# ════════════════════════════════════════════════════════════════════════════════
# WORTH SCORE
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="💰 Worth Score":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 💰 Worth Score — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"worthscore")
    if facts is None: st.error(f"❌ {err}"); st.stop()

    with st.spinner("Loading Worth Score…"):
        score_df,score_err=load_score(bid)

    ws1,ws2,ws3=st.tabs(["💰 Score & Architecture","📊 Waterfall & Features","📊 Feature Fill Rates"])

    with ws1:
        # ── Model architecture explainer ──────────────────────────────────────
        st.markdown("#### Worth Score Model Architecture")
        st.markdown("""<div style="background:#0c1a2e;border:1px solid #1e3a5f;border-radius:12px;padding:16px 20px;margin:8px 0">
<div style="color:#60A5FA;font-weight:700;font-size:.92rem;margin-bottom:10px">📐 How the Worth Score is Built</div>
<div style="color:#CBD5E1;font-size:.80rem;line-height:1.8">

<strong style="color:#a5b4fc">Step 1 — Feature extraction from KYB facts</strong><br>
ai-score-service reads from rds_warehouse_public.facts → extracts model inputs (age_business, count_bankruptcy, 
naics6, revenue, bs_total_liabilities, ratio_debt_to_equity, gdp_pch, etc.)

<br><br><strong style="color:#a5b4fc">Step 2 — 3-component ensemble model (worth_score_model.py)</strong><br>
■ Firmographic XGBoost — features: age, NAICS, state, employees, entity type, SIC, public records counts/ages<br>
■ Financial neural net (PyTorch) — features: P&L, balance sheet, cash flow, profitability/solvency ratios from Plaid banking<br>
■ Economic model — features: macro indicators (GDP, CPI, interest rates, unemployment, VIX, dollar index, etc.)<br>
All three produce a probability → combined via ensemble → isotonic calibrator → final_proba ∈ [0,1]

<br><br><strong style="color:#a5b4fc">Step 3 — Score scaling</strong><br>
<code>score_300_850 = final_proba × 550 + 300</code> (source: aiscore.py L44)<br>
<code>score_0_100 = final_proba × 100</code><br>
Example: probability=0.72 → score_300_850 = 0.72×550+300 = <strong>696</strong>

<br><br><strong style="color:#a5b4fc">Step 4 — Decision thresholds (score_decision_matrix table)</strong><br>
Default cutoffs (configurable per customer in score_decision_matrix):<br>
■ <span style="color:#22c55e">700–850 → LOW risk → APPROVE</span><br>
■ <span style="color:#f59e0b">550–699 → MODERATE risk → FURTHER_REVIEW_NEEDED</span><br>
■ <span style="color:#ef4444">0–549 → HIGH risk → DECLINE</span><br>
Source: manual-score-service/db/migrations/.../20240109130303-initial-tables-up.sql

<br><br><strong style="color:#a5b4fc">Step 5 — Storage</strong><br>
Score → Kafka message → manual-score-service → PostgreSQL (rds_manual_score_public.business_scores)<br>
Federated view in Redshift: rds_manual_score_public.data_current_scores JOIN business_scores<br>
customer_files.worth_score: from warehouse.latest_score (datascience schema) — uses score from awsdatacatalog

</div></div>""",unsafe_allow_html=True)

        st.markdown("---")

        # ── Score KPIs ────────────────────────────────────────────────────────
        score=None
        if score_df is not None and not score_df.empty:
            row=score_df.iloc[0]
            score=float(row.get("score_850") or 0)
            score_100=float(row.get("score_100") or 0) if "score_100" in row else (score-300)/550*100
            risk=str(row.get("risk_level","") or "")
            dec=str(row.get("score_decision","") or "")
            scored_at=str(row.get("created_at",""))[:16]
            # Reverse-compute probability
            prob=round((score-300)/550,4) if score>0 else 0
            rc={"HIGH":"#ef4444","MODERATE":"#f59e0b","MEDIUM":"#f59e0b","LOW":"#22c55e"}.get(risk.upper(),"#64748b")
            dc={"APPROVE":"#22c55e","FURTHER_REVIEW_NEEDED":"#f59e0b","DECLINE":"#ef4444"}.get(dec,"#64748b")

            c1,c2,c3,c4,c5=st.columns(5)
            with c1: kpi("Worth Score (850)",f"{score:.0f}","score_300_850 = p × 550 + 300","#3B82F6")
            with c2: kpi("Score (100)",f"{score_100:.1f}","score_0_100 = p × 100","#3B82F6")
            with c3: kpi("Model Probability",f"{prob:.4f}","final_proba from calibrated ensemble","#8B5CF6")
            with c4: kpi("Risk Level",risk or "Unknown","from score_decision_matrix",rc)
            with c5: kpi("Decision",dec.replace("_"," ")[:16] or "Unknown","configurable per customer",dc)

            # Score gauge
            score_pct=int((score-300)/550*100)
            gauge_color=dc
            st.markdown(f"""<div style="margin:12px 0">
              <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#94A3B8">
                <span>300 (min)</span><span>DECLINE &lt;550</span><span>REVIEW 550-699</span><span>APPROVE ≥700</span><span>850 (max)</span>
              </div>
              <div style="position:relative;background:linear-gradient(90deg,#ef4444 0%,#ef4444 45%,#f59e0b 45%,#f59e0b 73%,#22c55e 73%,#22c55e 100%);
                border-radius:8px;height:14px;margin:4px 0">
                <div style="position:absolute;left:{score_pct}%;top:-4px;width:3px;height:22px;
                  background:white;border-radius:2px;transform:translateX(-50%)"></div>
              </div>
              <div style="text-align:left;margin-left:{score_pct}%;font-size:.78rem;color:white;font-weight:700;margin-top:2px">
                {score:.0f}
              </div>
            </div>""",unsafe_allow_html=True)

            # Decision explanation
            DECISION_DETAIL={
                "APPROVE":(
                    "✅ APPROVE",
                    f"Score {score:.0f} ≥ 700 threshold. "
                    "Model probability {:.4f} is above the acceptance threshold. "
                    "Business passes major risk factors. Standard approval process.",
                    f"Thresholds are stored in score_decision_matrix table (configurable per customer). "
                    "Default: 700=APPROVE threshold.",
                ),
                "FURTHER_REVIEW_NEEDED":(
                    "🔎 FURTHER REVIEW NEEDED",
                    f"Score {score:.0f} is in the uncertain zone (550–699). "
                    "Model cannot confidently approve or decline. "
                    "A human analyst must review before making a decision.",
                    "Typical profile: entity is legitimate but has some risk factors. "
                    "May have bankruptcy history, moderate public records, or limited banking data.",
                ),
                "DECLINE":(
                    "❌ DECLINE",
                    f"Score {score:.0f} < 550 threshold. "
                    "Model probability {:.4f} is below the minimum acceptance threshold. "
                    "Business exceeds maximum acceptable risk for this product.",
                    "Do NOT approve without Compliance override. Document decline reason. "
                    "Check if decline is due to watchlist (compliance issue) or credit (financial issue).",
                ),
            }
            if dec in DECISION_DETAIL:
                title,detail,action=DECISION_DETAIL[dec]
                col_dec=dc
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col_dec};
                    border-radius:10px;padding:14px 18px;margin:10px 0">
                  <div style="color:{col_dec};font-weight:700;font-size:.90rem;margin-bottom:6px">{title}</div>
                  <div style="color:#CBD5E1;font-size:.79rem;margin-bottom:6px">{detail}</div>
                  <div style="color:#94A3B8;font-size:.74rem">{action}</div>
                </div>""",unsafe_allow_html=True)

            # Factor contributions
            factors_df,_=load_score_factors(bid)
            if factors_df is not None and not factors_df.empty:
                st.markdown("##### SHAP Factor Contributions by Category")
                st.caption("Each row = one model category's contribution to the final score. "
                           "Positive = adds to score. Negative = reduces score. "
                           "Source: rds_manual_score_public.business_score_factors")
                # Add category names
                CAT_NAMES={
                    "public_records":"📜 Public Records (BK/Judgments/Liens)",
                    "company_profile":"🏢 Company Profile (Age/NAICS/State/Structure)",
                    "financial_trends":"📈 Financial Trends (Economics/Ratios)",
                    "business_operations":"💼 Business Operations (Revenue/P&L/Balance Sheet)",
                    "performance_measures":"📊 Performance Measures (Profitability/Risk flags)",
                }
                factors_df["Category"]=factors_df["category_id"].map(lambda c: CAT_NAMES.get(c,c))
                factors_df["Impact (pts)"]=factors_df["weighted_score_850"].apply(lambda v: f"{v:+.1f}")
                factors_df["Score (0-100)"]=factors_df["score_100"].apply(lambda v: f"{v:.1f}" if pd.notna(v) else "n/a")
                st.dataframe(factors_df[["Category","Score (0-100)","Impact (pts)"]],
                             use_container_width=True,hide_index=True)
            else:
                flag("business_score_factors not accessible from Redshift federation. "
                     "See waterfall tab for estimated factor breakdown.", "blue")
        else:
            flag(f"No score found for this business. {score_err or ''} "
                 "Possible causes: (1) score not yet computed, (2) business too new, (3) insufficient features.", "amber")
            st.code(f"""-- Check Worth Score:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 5;

-- Alternative (warehouse):
SELECT worth_score, score_date FROM warehouse.latest_score WHERE business_id='{bid}';""",language="sql")

        ai_popup("WorthScore",f"Score:{score} risk:{risk if score else 'N/A'} prob:{prob if score else 'N/A'}",[
            "Explain the exact formula for converting model probability to 300-850 score",
            "What are the 5 feature categories and which facts feed each one?",
            "What SQL shows factor contributions for this specific business?",
            "What is the most impactful action this business could take to improve its score?",
            "How does the score_decision_matrix work and can thresholds be customized?"],bid)

        with st.expander("📋 SQL — Worth Score queries"):
            st.code(f"""-- Current score + decision:
SELECT bs.weighted_score_850, bs.weighted_score_100, bs.risk_level, bs.score_decision,
       bs.created_at, bs.id AS score_id
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}'
ORDER BY bs.created_at DESC LIMIT 1;

-- Factor contributions by category:
SELECT category_id, score_100, weighted_score_850
FROM rds_manual_score_public.business_score_factors
WHERE score_id = (SELECT score_id FROM rds_manual_score_public.data_current_scores
                  WHERE business_id = '{bid}' LIMIT 1)
ORDER BY ABS(weighted_score_850) DESC;

-- Score history (all versions):
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.business_scores bs
WHERE bs.id IN (SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{bid}')
ORDER BY bs.created_at DESC LIMIT 10;

-- Decision thresholds (global config):
SELECT range_start, range_end, risk_level, decision FROM score_decision_matrix ORDER BY range_start;""",language="sql")

    with ws2:
        st.markdown("#### 📊 Score Waterfall — Factor Contributions")
        st.caption("Estimated from KYB facts. The waterfall approximates the model's contribution breakdown. "
                   "Exact SHAP values are in business_score_factors (Score tab).")

        if score_df is not None and not score_df.empty:
            score_v=float(score_df.iloc[0]["score_850"])
            bk_w=int(float(gv(facts,"num_bankruptcies") or 0))
            ju_w=int(float(gv(facts,"num_judgements") or 0))
            li_w=int(float(gv(facts,"num_liens") or 0))
            sos_a=str(gv(facts,"sos_active") or "").lower()=="true"
            tin_ok=str(gv(facts,"tin_match_boolean") or "").lower()=="true"
            wl_n=int(float(gv(facts,"watchlist_hits") or 0))
            has_rev=gv(facts,"revenue") is not None and str(gv(facts,"revenue") or "") not in ("","None","[too large")
            naics_ok=str(gv(facts,"naics_code") or "561499")!="561499"
            fd_w=str(gv(facts,"formation_date") or "")
            try: age_w=datetime.now(timezone.utc).year-int(fd_w[:4]) if fd_w and fd_w[:4].isdigit() else None
            except: age_w=None

            # Estimated contributions
            pr_est=-(min(bk_w*40,120)+min(ju_w*20,60)+min(li_w*10,40))
            perf_est=(10 if sos_a else -10)+(10 if tin_ok else -5)-min(wl_n*25,100)
            fin_est=30 if has_rev else -10
            ops_est=(40 if (age_w or 0)>=5 else 25 if (age_w or 0)>=2 else 10 if (age_w or 0)>=1 else -5)
            profile_est=20 if naics_ok else -10
            # Residual goes to Financial Trends (macro/banking)
            explained=pr_est+perf_est+fin_est+ops_est+profile_est
            trends_est=score_v-300-explained

            cats=["📦 Base\n(300 floor)","📜 Public Records\n(BK/Judg/Lien)","⚖️ KYB Performance\n(SOS/TIN/WL)",
                  "💼 Business Ops\n(Revenue/Banking)","🕐 Operations\n(Age/Scale)","🏢 Company Profile\n(NAICS/State)",
                  "📈 Financial Trends\n(Macro/Ratios)","🎯 Final Score"]
            conts=[300,pr_est,perf_est,fin_est,ops_est,profile_est,trends_est,0]
            running=300; bases=[]; colors=[]; texts=[]; tooltips=[]
            for i,(c,ct) in enumerate(zip(cats,conts)):
                if i==0:
                    bases.append(0); colors.append("#6366f1"); texts.append("300")
                    tooltips.append("Base score (model intercept). All scores start here.")
                elif i==len(cats)-1:
                    bases.append(0); colors.append("#EC4899"); texts.append(f"{score_v:.0f}")
                    tooltips.append(f"Final Worth Score: {score_v:.0f}/850")
                else:
                    bases.append(running if ct>=0 else running+ct); running+=ct
                    colors.append("#22c55e" if ct>=0 else "#ef4444")
                    texts.append(f"{'+' if ct>=0 else ''}{int(ct)}")

            fig_wf=go.Figure(go.Bar(
                x=cats,
                y=[abs(c) if i not in (0,len(conts)-1) else c for i,c in enumerate(conts)],
                base=bases,marker_color=colors,
                text=texts,textposition="outside",textfont=dict(color="#E2E8F0",size=11),
                hovertext=[f"{c}: {'+' if v>=0 and i>0 else ''}{int(v)}"
                           for i,(c,v) in enumerate(zip(cats,conts))],
                hoverinfo="text",
            ))
            fig_wf.update_layout(
                title=f"Worth Score Factor Waterfall — {score_v:.0f}/850 (estimated)",
                yaxis=dict(range=[200,920],title="Score"),height=440,
                xaxis_tickangle=-10,
            )
            st.plotly_chart(dark_chart(fig_wf),use_container_width=True)
            st.caption("⚠️ This waterfall is ESTIMATED from KYB facts using simplified model weights. "
                       "For exact SHAP values, see Score tab → Factor Contributions table.")

            # Factor table
            st.markdown("##### Estimated Factor Breakdown — Source Facts & Model Features")
            factor_table=[
                ("📜 Public Records",f"{pr_est:+.0f}",
                 "count_bankruptcy, count_judgment, count_lien, age_bankruptcy, age_judgment, age_lien",
                 "num_bankruptcies, num_judgements, num_liens (Redshift) + detail arrays (PostgreSQL RDS)",
                 f"BK={bk_w} (est. {min(bk_w*40,120):.0f}pts), Judg={ju_w} (est. {min(ju_w*20,60):.0f}pts), Liens={li_w} (est. {min(li_w*10,40):.0f}pts)"),
                ("⚖️ KYB Performance",f"{perf_est:+.0f}",
                 "sos_active, tin_match_boolean, watchlist_hits",
                 "sos_active, tin_match_boolean, watchlist_hits facts",
                 f"SOS={'✅' if sos_a else '❌'}, TIN={'✅' if tin_ok else '❌'}, WL={wl_n} hit(s)"),
                ("💼 Business Operations",f"{fin_est:+.0f}",
                 "revenue, is_net_income, cf_cash_at_end_of_period, bs_total_liabilities",
                 "revenue, net_income facts + Plaid banking facts",
                 f"Revenue={'available' if has_rev else 'missing'} — Plaid banking features drive this"),
                ("🕐 Operations",f"{ops_est:+.0f}",
                 "age_business, count_employees",
                 "formation_date (→ age), num_employees facts",
                 f"Business age: {f'{age_w} years' if age_w else 'unknown'}, Employees: {str(gv(facts,'num_employees') or 'unknown')[:20]}"),
                ("🏢 Company Profile",f"{profile_est:+.0f}",
                 "naics6, primsic, state, bus_struct, indicator_* flags",
                 "naics_code, formation_state, corporation facts",
                 f"NAICS={'561499 (fallback⚠️)' if not naics_ok else naics}, state={form_state}"),
                ("📈 Financial Trends",f"{trends_est:+.0f}",
                 "gdp_pch, cpi, vix, t10y2y, unemployment, ratio_debt_to_equity, ...",
                 "Macro: Liberty/Fed data · Ratios: Plaid balance sheet computation",
                 "Macro indicators (residual from other categories)"),
            ]
            st.dataframe(pd.DataFrame(factor_table,
                columns=["Category","Est. Impact (pts)","Model Features","Source Facts","This Business"]),
                use_container_width=True,hide_index=True)
        else:
            st.info("Score data not available for waterfall chart.")

        with st.expander("📋 SQL — factor contributions"):
            st.code(f"""-- Exact factor contributions (SHAP values) per category:
SELECT
    category_id,
    score_100          AS category_score_0_100,
    weighted_score_850 AS category_impact_pts
FROM rds_manual_score_public.business_score_factors
WHERE score_id = (
    SELECT score_id FROM rds_manual_score_public.data_current_scores
    WHERE business_id = '{bid}' LIMIT 1
)
ORDER BY ABS(weighted_score_850) DESC;""",language="sql")

    with ws3:
        st.markdown("#### 📊 Feature Fill Rates — Model Input Data Quality")
        st.caption("""**Source:** `warehouse.worth_score_input_audit` · 
        **What it shows:** For each model input feature, what % of scored businesses have a non-null value ·
        **Why it matters:** Null features are imputed with defaults, reducing model accuracy for that business""")

        audit_df,audit_err=load_audit()
        if audit_df is not None and not audit_df.empty:
            fill_cols=[c for c in audit_df.columns if c.startswith("fill_")]
            lr=audit_df.iloc[0]
            fd2=[{"Feature":c.replace("fill_",""),
                  "Fill %":round(float(lr[c]),1),
                  "Category":"📜 Public Records" if any(x in c for x in ["bankruptcy","judgment","lien","reviews"])
                            else "🏢 Company Profile" if any(x in c for x in ["age_business","state","naics","primsic","struct","employee","indicator"])
                            else "📈 Financial Trends" if any(x in c for x in ["gdp","cpi","vix","t10y","unemp","ratio","wag","usd","ppi","brent","wti","csentiment","dolindx","ccdelinq"])
                            else "💼 Business Ops" if any(x in c for x in ["revenue","net_income","cf_","bs_","is_"])
                            else "📊 Performance" if any(x in c for x in ["ratio_return","ratio_gross","ratio_net","ratio_equity","ratio_income","flag_"])
                            else "Other"
                  }
                 for c in fill_cols if c in audit_df.columns]
            fdf=pd.DataFrame(fd2).sort_values("Fill %",ascending=True)
            fdf["Status"]=fdf["Fill %"].apply(lambda v:"🟢 Good" if v>=80 else("🟡 Medium" if v>=30 else"🔴 Low"))

            # Category summary
            cat_summary=fdf.groupby("Category")["Fill %"].mean().reset_index()
            cat_summary.columns=["Category","Avg Fill %"]
            cat_summary["Avg Fill %"]=cat_summary["Avg Fill %"].round(1)
            cat_summary["Status"]=cat_summary["Avg Fill %"].apply(lambda v:"🟢 Good" if v>=80 else("🟡 Medium" if v>=30 else"🔴 Low"))

            col_cat,col_chart=st.columns([1,2])
            with col_cat:
                st.markdown("**Category averages:**")
                st.dataframe(cat_summary,use_container_width=True,hide_index=True)
                st.markdown(f"**Score date:** {lr.get('score_date','N/A')}")
                st.caption("Low fill rate = feature is imputed with default value → less accurate prediction for this category")
            with col_chart:
                fig_fill=px.bar(fdf.tail(40),x="Fill %",y="Feature",orientation="h",
                                color="Status",
                                color_discrete_map={"🟢 Good":"#22c55e","🟡 Medium":"#f59e0b","🔴 Low":"#ef4444"},
                                title=f"Model Feature Fill Rates (top 40)")
                fig_fill.update_layout(height=700,showlegend=True,
                                       margin=dict(t=40,b=10,l=10,r=10))
                st.plotly_chart(dark_chart(fig_fill),use_container_width=True)

            # Low fill rate features
            low_fill=fdf[fdf["Fill %"]<30].sort_values("Fill %")
            if not low_fill.empty:
                st.markdown("##### ⚠️ Features with Low Fill Rate (<30%) — Imputed with defaults")
                st.markdown("These features are null for most businesses. When null, the model uses imputed defaults from lookups.py. "
                            "This reduces model confidence and may cause the Worth Score to be less accurate.")
                st.dataframe(low_fill[["Feature","Fill %","Category"]],use_container_width=True,hide_index=True)
        else:
            flag(f"Audit table not accessible. {audit_err or ''}", "amber")
            st.code("""-- Try directly:
SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 5;""",language="sql")

# ════════════════════════════════════════════════════════════════════════════════
# ALL FACTS — grouped, enriched, with lineage
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="📋 All Facts":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab first, then return here."); st.stop()
    st.markdown(f"## 📋 All Facts — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts_with_ui(bid,"allfacts")
    if facts is None: st.error(f"❌ {err}"); st.stop()
    if not facts: st.error("No facts found for this business."); st.stop()

    # ── Group definitions (from kyb_dashboard.py, extended) ──────────────────
    FACT_GROUPS = {
        "🏢 Identity / Name": [
            "business_name","legal_name","names","names_found","names_submitted",
            "dba_found","people","kyb_submitted","external_id","customer_ids",
            "compliance_status","kyb_complete","risk_score","high_risk_people",
        ],
        "🏛️ Registry / SOS": [
            "sos_filings","sos_active","sos_match","sos_match_boolean",
            "formation_date","formation_state","year_established","corporation",
            "middesk_confidence","middesk_id","screened_people",
        ],
        "🔐 TIN / EIN": [
            "tin","tin_submitted","tin_match","tin_match_boolean","is_sole_prop",
            "npi","stock_symbol",
        ],
        "📍 Address / Location": [
            "primary_address","addresses","addresses_submitted","addresses_found",
            "addresses_deliverable","address_match","address_match_boolean",
            "address_verification","address_verification_boolean",
            "address_registered_agent","countries","city","state",
        ],
        "📞 Contact": [
            "business_phone","phone_found","email",
        ],
        "🌐 Website / Digital": [
            "website","website_found","serp_id","all_google_place_ids",
            "review_rating","review_count","google_review_count","google_review_rating",
        ],
        "🏭 Industry / Classification": [
            "naics_code","naics_description","mcc_code","mcc_description",
            "industry","classification_codes","revenue_confidence",
        ],
        "💼 Firmographic": [
            "num_employees","revenue","net_income","revenue_equally_weighted_average",
            "revenue_all_sources","minority_owned","woman_owned","veteran_owned",
            "business_verified","verification_status","shareholder_document",
        ],
        "🪪 Identity Verification (KYC)": [
            "idv_status","idv_passed","idv_passed_boolean",
            "name_match","name_match_boolean",
        ],
        "📊 Financial Ratios (Worth Score inputs)": [
            "bs_total_liabilities_and_equity","ratio_operating_margin","flag_equity_negative",
            "ratio_income_quality_ratio","bs_accounts_payable","ratio_gross_margin",
            "flag_total_liabilities_over_assets","is_operating_expense","ratio_return_on_assets",
            "bs_total_liabilities","ratio_total_liabilities_cash","ratio_debt_to_equity",
            "is_net_income","ratio_accounts_payable_cash","cf_cash_at_end_of_period",
        ],
        "⚠️ Risk / Watchlist": [
            "watchlist","watchlist_hits","watchlist_raw",
            "adverse_media_hits","sanctions_hits","pep_hits",
            "num_bankruptcies","num_judgements","num_liens",
            "bankruptcies","judgements","liens",
        ],
        "🔗 Vendor / Integration": [
            "internal_platform_matches","internal_platform_matches_count",
            "internal_platform_matches_combined","canadaopen_confidence",
            "canadaopen_id","canadaopen_match_mode",
        ],
        "🇨🇦 Canada (if applicable)": [
            "canada_business_number_found","canada_business_number_match",
            "canada_id_number_match","canada_corporate_id_found","canada_corporate_id_match",
        ],
    }

    fact_to_group = {n:g for g,ns in FACT_GROUPS.items() for n in ns}

    # ── Deep explanations per fact ─────────────────────────────────────────────
    FACT_EXPLAIN = {
        "sos_active":          ("Middesk (pid=16)","dependent from sos_filings[].active","true if ANY sos_filing is active. Admin Portal 'SOS' badge."),
        "sos_match":           ("Middesk (pid=16)","factWithHighestConfidence","String: 'success'|'failure'. Middesk SOS name/address match result."),
        "sos_match_boolean":   ("Middesk (pid=16)","dependent from sos_match","true when sos_match='success'. What the Admin Portal verified badge derives from."),
        "middesk_confidence":  ("Middesk (pid=16)","formula","0.15 base + 0.20 per passing review task (name/TIN/address/SOS). Max=0.95."),
        "tin":                 ("Applicant (pid=0)","factWithHighestConfidence","Raw EIN (9 digits unmasked). Source=Applicant (businessDetails) confidence=1.0."),
        "tin_submitted":       ("Applicant (pid=0)","factWithHighestConfidence","Masked EIN (XXXXX1234) returned to frontend. Source=Applicant."),
        "tin_match":           ("Middesk (pid=16)","factWithHighestConfidence","Object: {status, message, sublabel}. status='success'=IRS confirmed."),
        "tin_match_boolean":   ("Middesk (pid=16)","dependent from tin_match","true only when tin_match.status='success'. Admin Portal EIN verified badge."),
        "is_sole_prop":        ("System (pid=-1)","dependent from tin_submitted+idv_passed_boolean","true if EIN not submitted and IDV passed — inferred sole prop."),
        "naics_code":          ("EFX/ZI/OC/SERP/Trulioo/Applicant/AI","factWithHighestConfidence","6-digit NAICS. 561499=fallback. Winner = highest confidence×weight."),
        "mcc_code":            ("System (pid=-1)","derived from naics_code","4-digit MCC. mcc_code_found ?? mcc_code_from_naics. 5614=NAICS 561499 fallback."),
        "watchlist_hits":      ("System (pid=-1)","dependent from watchlist","COUNT of hits in watchlist.metadata[]. PEP+SANCTIONS only. Adverse media excluded."),
        "watchlist":           ("System (pid=-1)","combineWatchlistMetadata","Merged business+person watchlist hits. adverse_media filtered out."),
        "adverse_media_hits":  ("Trulioo (pid=38)","dependent","COUNT of adverse media records. Tracked SEPARATELY from sanctions/PEP."),
        "idv_passed_boolean":  ("Plaid (pid=40)","dependent from idv_passed","true when idv_passed>=1. Admin Portal identity verification badge."),
        "idv_status":          ("Plaid (pid=40)","factWithHighestConfidence","Object: {SUCCESS:N, PENDING:N, FAILED:N, CANCELED:N, EXPIRED:N} counts."),
        "name_match_boolean":  ("Middesk (pid=16)","dependent from name_match","true when name_match.status='success'. Business name matched registry."),
        "formation_state":     ("Middesk (pid=16)","factWithHighestConfidence","US state code where business was incorporated. DE/NV/WY = tax-haven risk."),
        "formation_date":      ("Middesk (pid=16)","factWithHighestConfidence","ISO-8601 incorporation date. Used for business age calculation in Worth Score."),
        "revenue":             ("ZoomInfo (pid=24) / Equifax (pid=17)","factWithHighestConfidence","Annual revenue in USD. Used in Worth Score financial model."),
        "num_employees":       ("ZoomInfo (pid=24) / Equifax (pid=17)","factWithHighestConfidence","Employee count. Worth Score feature: staffing_level."),
        "num_bankruptcies":    ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of bankruptcy filings. Worth Score impact: -40pts each."),
        "num_judgements":      ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of civil judgments. Worth Score impact: -20pts each."),
        "num_liens":           ("Equifax (pid=17) / public records","factWithHighestConfidence","Count of tax/mechanic liens. Worth Score impact: -10pts each."),
        "website":             ("Applicant (pid=0) / SERP (pid=22)","factWithHighestConfidence","Business website URL. Used by AI enrichment for NAICS classification."),
        "primary_address":     ("System (pid=-1)","dependent from addresses","Structured address object. Derived from addresses fact."),
        "addresses":           ("Middesk/OC/ZI/EFX","combineFacts","Array of all known addresses across vendors. Combined from all sources."),
        "addresses_deliverable":("Middesk (pid=16)","factWithHighestConfidence","Subset of addresses confirmed deliverable by USPS."),
        "dba_found":           ("Applicant (pid=0) / Middesk","combineFacts","Array of DBA names. Combined from applicant submission and registry."),
        "people":              ("Middesk (pid=16)","factWithHighestConfidence","Array of persons: {name, titles, submitted, source, jurisdictions}."),
        "screened_people":     ("Trulioo (pid=38)","factWithHighestConfidence","PSC-screened individuals with watchlistHits[] per person."),
        "risk_score":          ("System (pid=-1)","dependent from watchlist_hits+high_risk_people","0-100 risk score. 0=clean. Based on watchlist and high-risk persons."),
    }

    # ── Categorise all loaded facts ───────────────────────────────────────────
    grouped = {}; grouped_meta = {}
    for name, f in facts.items():
        if name.startswith("_"): continue
        too_large = f.get("_too_large", False)
        v = f.get("value")

        # Value display
        if too_large:          dv, detail = "📦 [too large — use SQL below]", None
        elif v is None:        dv, detail = "(null)", None
        elif isinstance(v,list): dv, detail = f"📋 list · {len(v)} item(s)", v
        elif isinstance(v,dict):
            if name=="idv_status": dv, detail = " | ".join(f"{k}:{n}" for k,n in v.items() if n), v
            elif "status" in v:   dv, detail = f"status: {v.get('status')} · {v.get('message','')[:40]}", v
            else:                  dv, detail = f"🗂️ object · {len(v)} key(s)", v
        else:                  dv, detail = str(v)[:120], None

        # Source (handles pid=0 Applicant correctly)
        src = f.get("source") or {}
        pid = "" if not isinstance(src,dict) else ("" if src.get("platformId") is None else str(src["platformId"]))
        conf_raw = src.get("confidence") if isinstance(src,dict) else None
        conf = float(conf_raw) if conf_raw is not None else None
        win_name = _pid_label(pid)
        rule = safe_get(f,"ruleApplied","name") or "—"
        override = safe_get(f,"override","value") or ""

        # Alternatives
        alts = get_alts(facts, name)

        # Deep explanation
        explain = FACT_EXPLAIN.get(name, None)

        grp = fact_to_group.get(name, "📦 Other")
        if grp not in grouped:
            grouped[grp]=[]
            grouped_meta[grp]=[]

        grouped[grp].append({
            "Fact":            f"`{name}`",
            "Value":           dv,
            "Winning Source":  win_name,
            "Confidence":      f"{conf:.4f}" if conf is not None else "n/a (derived)",
            "Rule Applied":    rule,
            "Alternatives":    f"{len(alts)} source(s)" if alts else "—",
            "Updated":         f.get("_received_at",""),
            "Override":        f"⚠️ {str(override)[:60]}" if override else "",
        })
        grouped_meta[grp].append({
            "name":name,"detail":detail,"fact":f,"alts":alts,"explain":explain,"dv":dv,"too_large":too_large
        })

    # ── Summary KPIs ──────────────────────────────────────────────────────────
    total = len([n for n in facts if not n.startswith("_")])
    has_val = sum(1 for n,f in facts.items() if not n.startswith("_") and f.get("value") is not None and not f.get("_too_large"))
    null_n  = sum(1 for n,f in facts.items() if not n.startswith("_") and f.get("value") is None)
    large_n = sum(1 for n,f in facts.items() if f.get("_too_large"))
    with_alts = sum(1 for n,f in facts.items() if not n.startswith("_") and len(get_alts(facts,n))>0)

    st.markdown("### 📊 Facts Overview")
    c1,c2,c3,c4,c5 = st.columns(5)
    with c1: kpi("Total Facts",f"{total}","in rds_warehouse_public.facts","#3B82F6")
    with c2: kpi("✅ Has Value",f"{has_val}",f"{has_val/max(total,1)*100:.0f}% fill rate","#22c55e")
    with c3: kpi("⚪ Null",f"{null_n}","no vendor provided data","#64748b")
    with c4: kpi("📦 Too Large",f"{large_n}","query PostgreSQL RDS","#f59e0b")
    with c5: kpi("🔀 Has Alts",f"{with_alts}","facts with alternative sources","#8B5CF6")

    # Fill rate bar
    fill_pct = int(has_val/max(total,1)*100)
    fill_color = "#22c55e" if fill_pct>=80 else "#f59e0b" if fill_pct>=50 else "#ef4444"
    st.markdown(f"""<div style="margin:8px 0">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;color:#CBD5E1">
        <span>Overall KYB Data Fill Rate</span><span style="color:{fill_color};font-weight:700">{fill_pct}%</span>
      </div>
      <div style="background:#1e293b;border-radius:4px;height:10px;margin:4px 0">
        <div style="background:{fill_color};width:{fill_pct}%;height:10px;border-radius:4px"></div>
      </div>
      <div style="color:#64748b;font-size:.68rem">{has_val} facts with values · {null_n} null · {large_n} too large for Redshift federation</div>
    </div>""",unsafe_allow_html=True)

    st.markdown("---")

    # ── Column guide (collapsible) ─────────────────────────────────────────────
    with st.expander("ℹ️ How to read the tables — every column explained"):
        st.markdown("""
#### Columns explained

| Column | What it means | Example |
|---|---|---|
| **Fact** | The internal fact name stored in `rds_warehouse_public.facts` | `tin_match_boolean` |
| **Value** | The winning value the Admin Portal uses. `(null)`=no vendor matched. `📋 list`=array (expand below). `📦 too large`=query RDS directly. | `true` |
| **Winning Source** | The vendor the Fact Engine selected as the winner for this fact. One value is shown in the Admin Portal — this is who provided it. | `Middesk` |
| **Confidence** | Winner's confidence score (0–1). Formula depends on vendor: Middesk=0.15+0.20×tasks. ZI/EFX/OC=match.index÷55. Trulioo=status-based. AI=self-reported. `n/a (derived)`=dependent fact computed from other facts. | `0.9989` |
| **Rule Applied** | The Fact Engine rule that selected this winner: `factWithHighestConfidence` = highest conf×weight wins. `combineFacts` = merged array from all vendors. `dependent` = computed from another fact. | `factWithHighestConfidence` |
| **Alternatives** | Number of other vendors that also provided this fact but LOST to the winner. Click the ▶ expander to see each alternative with its source and confidence. | `2 source(s)` |
| **Updated** | When this fact was last written to `rds_warehouse_public.facts` (received_at). | `2026-04-14 19:15` |
| **Override** | ⚠️ = an analyst manually changed this value in the Admin Portal. The override replaces the vendor value in the UI. | `⚠️ Analyst override: ...` |

#### Vendor platform IDs (platformId)
| platformId | Vendor | Weight | Confidence formula |
|---|---|---|---|
| 16 | Middesk | 2.0 | 0.15 + 0.20 × passing review tasks (max 4) |
| 23 | OpenCorporates | 0.9 | match.index ÷ 55 |
| 24 | ZoomInfo | 0.8 | match.index ÷ 55 |
| 17 | Equifax | 0.7 | XGBoost score or match.index ÷ 55 |
| 38 | Trulioo | 0.8 | status-based: SUCCESS=0.70, FAILED=0.40, OTHER=0.20 |
| 31 | AI (GPT-4o-mini) | 0.1 | self-reported (LOW/MED/HIGH → 0.3/0.6/0.9) |
| 22 | SERP (Google) | 0.3 | heuristic |
| 40 | Plaid | 1.0 | session-based |
| 0 | Applicant (businessDetails) | — | 1.0 by convention |
| -1 | System / Dependent | — | null (computed) |

#### Why is a fact null?
1. **Entity matching failed** — no vendor could match this business in their database
2. **Optional field** — not submitted by the applicant (e.g. email, phone)
3. **Calculated dependency** — derived from another fact that is also null
4. **Integration not active** — this vendor was not enabled when the business was onboarded
5. **Too large** — value exists but exceeds Redshift's VARCHAR(65535) federation limit (query PostgreSQL RDS port 5432 instead)
        """)

    st.markdown("---")

    # ── Group-level fill rate chart ───────────────────────────────────────────
    group_summary = []
    for grp in list(FACT_GROUPS.keys())+["📦 Other"]:
        rows = grouped.get(grp,[])
        if not rows: continue
        g_total = len(rows)
        g_val   = sum(1 for r in rows if r["Value"] not in ("(null)",""))
        g_null  = g_total - g_val
        group_summary.append({"Group":grp.split(" ",1)[1] if " " in grp else grp,
                               "Total":g_total,"With Value":g_val,"Null":g_null,
                               "Fill %":round(g_val/max(g_total,1)*100)})

    if group_summary:
        gdf = pd.DataFrame(group_summary).sort_values("Fill %",ascending=True)
        fig_g = go.Figure()
        fig_g.add_trace(go.Bar(x=gdf["Fill %"],y=gdf["Group"],orientation="h",
                               marker_color=[("#22c55e" if v>=80 else "#f59e0b" if v>=50 else "#ef4444")
                                             for v in gdf["Fill %"]],
                               text=[f"{v}%  ({r['With Value']}/{r['Total']})" for _,r in gdf.iterrows()],
                               textposition="outside",textfont=dict(size=10,color="#CBD5E1")))
        fig_g.update_layout(title="Fill Rate by Fact Group",
                            height=max(250,len(gdf)*34),
                            xaxis=dict(range=[0,115],showticklabels=False,showgrid=False),
                            yaxis=dict(tickfont=dict(size=11)),
                            margin=dict(t=40,b=10,l=10,r=80))
        st.plotly_chart(dark_chart(fig_g),use_container_width=True)
        st.caption("Green ≥80% · Amber 50–79% · Red <50%")

    st.markdown("---")

    # ── Render each group ─────────────────────────────────────────────────────
    AUTO_EXPAND = {"🏢 Identity / Name","🏛️ Registry / SOS","🔐 TIN / EIN"}

    for grp in list(FACT_GROUPS.keys())+["📦 Other"]:
        rows     = grouped.get(grp,[])
        meta     = grouped_meta.get(grp,[])
        if not rows: continue

        g_val  = sum(1 for r in rows if r["Value"] not in ("(null)",""))
        g_null = len(rows) - g_val
        label  = f"{grp}  ({len(rows)} facts · {g_val} with values · {g_null} null)"

        with st.expander(label, expanded=(grp in AUTO_EXPAND)):

            # ── Group analyst card ─────────────────────────────────────────
            GROUP_CARDS = {
                "🏢 Identity / Name":[
                    "Contains: legal_name (winner), names_found (all vendor names), dba_found, people (officers).",
                    "legal_name winner is typically Applicant (pid=0, conf=1.0) or Middesk (pid=16). OC is fallback.",
                    "names_found uses combineFacts rule — merges ALL vendor names into one array, not a winner/loser selection.",
                    "dba_found = DBA names from applicant submission AND registry filings. Important for sole props.",
                    "kyb_submitted=true means the onboarding form was completed. kyb_complete=true means business verified + people screened.",
                ],
                "🏛️ Registry / SOS":[
                    "sos_active is DERIVED (pid=-1, dependent) from sos_filings[].active — Middesk sets the raw filing, the Fact Engine derives the boolean.",
                    "sos_filings is TOO LARGE for Redshift federation. Contains array of SoSRegistration objects with: id, state, active, foreign_domestic, entity_type, officers[].",
                    "middesk_confidence formula: 0.15 base + 0.20 × (tasks passed). Tasks: name verification, TIN, address, SOS (max 4 tasks = 0.95 max).",
                    "sos_match winning source: Middesk (pid=16, w=2.0) > OC (pid=23, w=0.9). Rule: factWithHighestConfidence.",
                    "Admin Portal path: KYB → Business Registration → 'Verified' badge = sos_match_boolean=true AND sos_active=true.",
                ],
                "🔐 TIN / EIN":[
                    "tin = raw 9-digit EIN (unmasked in Redshift). Source=Applicant (pid=0), confidence=1.0 by convention.",
                    "tin_submitted = masked version (XXXXX1234). Source=Applicant. tin_match = IRS verification result from Middesk TIN review task.",
                    "tin_match_boolean=true ONLY when tin_match.value.status='success'. Derived (pid=-1, dependent).",
                    "Winning source for tin_match MUST be Middesk (pid=16) for IRS-direct verification. If pid=38 (Trulioo), it is a fallback — NOT IRS-direct.",
                    "Admin Portal: KYB → Business Registration → Tax ID Number (EIN) row. 'Verified' badge = tin_match_boolean=true.",
                ],
                "📍 Address / Location":[
                    "addresses uses combineFacts rule — merges addresses from ALL vendors (Middesk, OC, ZI, EFX) into one array.",
                    "addresses_deliverable = subset confirmed deliverable by USPS via Middesk. Used for mail-based verification.",
                    "address_registered_agent: if true, submitted address is a known registered agent address — entity resolution gap risk.",
                    "primary_address = DERIVED (pid=-1, dependent) from addresses. Structured object: {line_1, city, state, postal_code, country}.",
                ],
                "🏭 Industry / Classification":[
                    "naics_code winner selected by factWithHighestConfidence across: EFX(w=0.7) > ZI(w=0.8) > OC(w=0.9) > SERP(w=0.3) > Trulioo(w=0.8) > Applicant(w=0.2) > AI(w=0.1).",
                    "561499 = fallback when ALL vendors fail and AI cannot classify. Cascades to MCC 5614.",
                    "mcc_code = mcc_code_found (AI direct) ?? mcc_from_naics (rel_naics_mcc lookup table). Not a direct vendor fact.",
                    "AI (pid=31) is LAST RESORT — only fires when all other vendors have confidence below threshold. Weight=0.1.",
                ],
                "⚠️ Risk / Watchlist":[
                    "watchlist = consolidated PEP+SANCTIONS hits only. adverse_media deliberately EXCLUDED by filterOutAdverseMedia in consolidatedWatchlist.ts.",
                    "watchlist_hits = COUNT of watchlist.metadata[] items (per-entity hits). Used in Worth Score and Admin Portal badge.",
                    "adverse_media_hits = tracked SEPARATELY. Different compliance action than sanctions/PEP.",
                    "sos_filings, watchlist, bankruptcies, judgements, liens = TOO LARGE for Redshift federation. Query PostgreSQL RDS port 5432.",
                    "num_bankruptcies/judgements/liens = scalar counts extracted from the large arrays. Safe to query from Redshift.",
                ],
                "📊 Financial Ratios (Worth Score inputs)":[
                    "All ratio_* and bs_* facts are extracted from Plaid banking statements by the Worth Score pipeline.",
                    "These are PRIMARY model features for the financial sub-model (PyTorch neural net component).",
                    "Null ratios = Plaid banking data not connected or not processed yet. Low fill rates reduce model accuracy.",
                    "flag_equity_negative / flag_total_liabilities_over_assets = binary risk flags, high Worth Score impact.",
                ],
            }
            if grp in GROUP_CARDS:
                analyst_card(f"{grp} — Data Lineage Notes", GROUP_CARDS[grp])

            # ── Facts table ───────────────────────────────────────────────
            display_df = pd.DataFrame([{k:v for k,v in r.items() if k!="Override"}
                                        for r in rows])
            st.dataframe(display_df, use_container_width=True, hide_index=True)

            # ── Per-fact expandable detail ─────────────────────────────────
            for row_data, m in zip(rows, meta):
                name      = m["name"]
                detail    = m["detail"]
                alts      = m["alts"]
                explain   = m["explain"]
                fact_obj  = m["fact"]
                too_large = m["too_large"]
                dv        = m["dv"]
                override  = fact_obj.get("override")

                # Expandable value detail (lists/dicts)
                if detail is not None:
                    if isinstance(detail, list):
                        items_html = "".join(
                            f"<li style='margin:2px 0'><code style='color:#93c5fd;font-size:.72rem'>"
                            f"{json.dumps(item,default=str)[:300] if isinstance(item,(dict,list)) else str(item)[:300]}"
                            f"</code></li>" for item in detail
                        )
                        inner = f"<ol style='color:#CBD5E1;font-size:.72rem;margin:4px 0 4px 16px'>{items_html}</ol>"
                    else:
                        inner = (f"<pre style='color:#CBD5E1;font-size:.70rem;background:#0F172A;"
                                 f"padding:8px;border-radius:6px;overflow:auto;max-height:300px'>"
                                 f"{json.dumps(detail,default=str,indent=2)[:3000]}</pre>")

                    alts_html = ""
                    if alts:
                        alt_rows = "".join(
                            f"<tr><td style='padding:3px 8px;color:#94A3B8;font-size:.70rem'>{_pid_label(a['pid'])}</td>"
                            f"<td style='padding:3px 8px;color:#CBD5E1;font-size:.70rem'>{str(a.get('value',''))[:60]}</td>"
                            f"<td style='padding:3px 8px;color:#64748b;font-size:.70rem'>{a['conf']:.4f}</td></tr>"
                            for a in alts
                        )
                        alts_html = (
                            f"<br><span style='color:#60A5FA;font-size:.70rem;font-weight:600'>"
                            f"Alternative sources ({len(alts)}) — lost to winner:</span>"
                            f"<table style='width:100%'><tr>"
                            f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Vendor</th>"
                            f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Value</th>"
                            f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Confidence</th></tr>"
                            f"{alt_rows}</table>"
                        )

                    explain_html = ""
                    if explain:
                        src_txt, rule_txt, desc_txt = explain
                        explain_html = (
                            f"<div style='background:#0c1a2e;border-left:3px solid #3B82F6;padding:6px 10px;"
                            f"border-radius:6px;margin:6px 0;font-size:.70rem'>"
                            f"<span style='color:#60A5FA;font-weight:600'>Source:</span> "
                            f"<span style='color:#CBD5E1'>{src_txt}</span> · "
                            f"<span style='color:#60A5FA;font-weight:600'>Rule:</span> "
                            f"<span style='color:#CBD5E1'>{rule_txt}</span><br>"
                            f"<span style='color:#94A3B8'>{desc_txt}</span></div>"
                        )

                    st.markdown(
                        f"<details style='background:#0F172A;border-radius:6px;padding:5px 10px;margin:2px 0'>"
                        f"<summary style='color:#60A5FA;font-size:.74rem;cursor:pointer'>"
                        f"🔍 <code>{name}</code> — {dv[:80]}</summary>"
                        f"{explain_html}{inner}{alts_html}</details>",
                        unsafe_allow_html=True)

                elif too_large:
                    st.markdown(
                        f"<details style='background:#0F172A;border-radius:6px;padding:5px 10px;margin:2px 0'>"
                        f"<summary style='color:#f59e0b;font-size:.74rem;cursor:pointer'>"
                        f"📦 <code>{name}</code> — too large for Redshift (click for SQL)</summary>"
                        f"<div style='color:#94A3B8;font-size:.70rem;margin:4px 0'>This fact exceeds Redshift's VARCHAR(65535) "
                        f"federation limit. Query directly from PostgreSQL RDS (port 5432) using JSONB operators:</div>"
                        f"<pre style='color:#22c55e;background:#052e16;padding:8px;border-radius:6px;font-size:.68rem'>"
                        f"-- PostgreSQL RDS port 5432 (native JSONB — no size limit):\nSELECT value->'value'\nFROM rds_warehouse_public.facts\n"
                        f"WHERE business_id = '{bid}' AND name = '{name}';</pre>"
                        + (f"<div style='color:#94A3B8;font-size:.70rem;margin-top:4px'>{FACT_EXPLAIN[name][2]}</div>" if name in FACT_EXPLAIN else "")
                        + f"</details>", unsafe_allow_html=True)

                elif alts:
                    alt_rows = "".join(
                        f"<tr><td style='padding:3px 8px;color:#94A3B8;font-size:.70rem'>{_pid_label(a['pid'])}</td>"
                        f"<td style='padding:3px 8px;color:#CBD5E1;font-size:.70rem'>{str(a.get('value',''))[:80]}</td>"
                        f"<td style='padding:3px 8px;color:#64748b;font-size:.70rem'>{a['conf']:.4f}</td></tr>"
                        for a in alts
                    )
                    explain_html2 = ""
                    if explain:
                        src_txt,rule_txt,desc_txt = explain
                        explain_html2 = (f"<div style='color:#94A3B8;font-size:.70rem;margin:4px 0'>"
                                         f"<b style='color:#60A5FA'>Source:</b> {src_txt} · "
                                         f"<b style='color:#60A5FA'>Rule:</b> {rule_txt}<br>{desc_txt}</div>")
                    st.markdown(
                        f"<details style='background:#0F172A;border-radius:6px;padding:5px 10px;margin:2px 0'>"
                        f"<summary style='color:#8B5CF6;font-size:.74rem;cursor:pointer'>"
                        f"🔀 <code>{name}</code> — {len(alts)} alternative source(s)</summary>"
                        f"{explain_html2}"
                        f"<table style='width:100%'><tr>"
                        f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Vendor</th>"
                        f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Value</th>"
                        f"<th style='color:#60A5FA;text-align:left;padding:2px 8px;font-size:.70rem'>Confidence</th></tr>"
                        f"{alt_rows}</table></details>",
                        unsafe_allow_html=True)

                if override and str(override) not in ("","None"):
                    flag(f"Analyst override on `{name}`: **{str(override)[:80]}**", "amber")

            # ── Null facts explanation ─────────────────────────────────────
            null_facts = [r["Fact"].strip("`") for r in rows if r["Value"]=="(null)"]
            if null_facts:
                null_items = "".join(
                    f"<li style='margin:2px 0'><code style='color:#93c5fd'>{fn}</code>: "
                    f"<span style='color:#64748b;font-size:.70rem'>"
                    f"{FACT_EXPLAIN[fn][2] if fn in FACT_EXPLAIN else 'Source not documented — check integration-service lib/facts/'}</span></li>"
                    for fn in null_facts
                )
                st.markdown(
                    f"<details style='background:#0F172A;border-radius:6px;padding:5px 10px;margin:6px 0'>"
                    f"<summary style='color:#94A3B8;font-size:.72rem;cursor:pointer'>"
                    f"❓ Why are {len(null_facts)} fact(s) null in this group?</summary>"
                    f"<div style='color:#94A3B8;font-size:.71rem;margin-top:4px'>"
                    f"Possible causes: entity matching failed · optional field not submitted · "
                    f"calculated from another null fact · integration not enabled at onboarding time.<br>"
                    f"<ul style='margin:4px 0 0 16px'>{null_items}</ul></div></details>",
                    unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("#### 🔍 SQL Reference — Full Business Investigation")
    st.code(f"""-- All facts for this business (Redshift):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'value')                AS fact_value,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winning_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS confidence,
       JSON_EXTRACT_PATH_TEXT(value,'ruleApplied','name')   AS rule_applied,
       received_at
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
ORDER BY name;

-- Facts with alternatives (Redshift):
SELECT name,
       JSON_EXTRACT_PATH_TEXT(value,'source','platformId')  AS winner_pid,
       JSON_EXTRACT_PATH_TEXT(value,'source','confidence')  AS winner_conf,
       JSON_ARRAY_LENGTH(JSON_EXTRACT_PATH_TEXT(value,'alternatives')) AS alt_count
FROM rds_warehouse_public.facts
WHERE business_id = '{bid}'
  AND JSON_ARRAY_LENGTH(JSON_EXTRACT_PATH_TEXT(value,'alternatives')) > 0;

-- Worth Score (Redshift):
SELECT bs.weighted_score_850, bs.risk_level, bs.score_decision, bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id = cs.score_id
WHERE cs.business_id = '{bid}' ORDER BY bs.created_at DESC LIMIT 1;

-- Large facts (PostgreSQL RDS port 5432 — JSONB native):
-- sos_filings:
SELECT filing->>'state', filing->>'active', filing->>'foreign_domestic'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}';

-- watchlist hits:
SELECT hit->>'type', hit->'metadata'->>'entity_name'
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value'->'metadata') AS hit
WHERE name='watchlist' AND business_id='{bid}';

-- API endpoint:
-- GET https://api.joinworth.com/integration/api/v1/facts/business/{bid}/kyb
-- Redis cache key: integration-express-cache::{bid}::/api/v1/facts/business/{bid}/kyb""",
            language="sql")

# ════════════════════════════════════════════════════════════════════════════════
# AI AGENT
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🤖 AI Agent":
    bid=st.session_state.get("hub_bid","")
    st.markdown("## 🤖 KYB Intelligence AI Agent")
    st.markdown("Ask anything about KYB data, field lineage, source attribution, confidence formulas, SQL queries, or any result for this business.")
    if bid: st.info(f"📍 Business context: `{bid[:16]}…`")
    flag("RAG: api-docs (87 files) + integration-service + microsites + warehouse-service + inline knowledge (Worth Score, Watchlist, Domestic/Foreign, Fact Engine, NAICS, TIN). 1,965 chunks.","blue")

    if not get_openai():
        st.warning("⚠️ OpenAI key not detected. To enable AI responses, choose **one** of these options:")
        c1,c2=st.columns(2)
        with c1:
            st.markdown("**Option A — Streamlit secrets (recommended):**")
            st.code("""# Edit Admin-Portal-KYB-App/.streamlit/secrets.toml
OPENAI_API_KEY = "sk-svcacct-your-key-here"
""",language="toml")
        with c2:
            st.markdown("**Option B — Terminal / shell:**")
            st.code('export OPENAI_API_KEY="sk-svcacct-your-key-here"\nstreamlit run kyb_hub_app.py',language="bash")
        st.caption("After adding the key, click 🔄 Refresh in the sidebar or restart the app.")

    st.markdown("#### 💡 Quick Questions")
    quick={"🏛️ Registry":["How is sos_match_boolean determined?","Why might Middesk confidence be low?","What is the entity resolution gap for tax-haven states?"],
           "🔐 TIN":["How is tin_match_boolean derived?","What does 'associated with different Business Name' mean?"],
           "🏭 NAICS":["What sources provide NAICS codes and in what priority order?","What causes the 561499 fallback?"],
           "⚠️ Watchlist":["Why is adverse media excluded from consolidated watchlist?","What is the difference between SANCTIONS and PEP?"],
           "💰 Worth Score":["How is the 300-850 score calculated?","What are the 3 model components?"],
           "🗄️ SQL":["Write SQL to get all facts for a business","Write SQL to get the Worth Score","Write Python code to load KYB facts from Redshift"]}
    for section,questions in quick.items():
        with st.expander(section):
            for q in questions:
                if st.button(q,key=f"aqq_{q[:20]}"): st.session_state["agent_q"]=q; st.session_state["agent_pending"]=True

    st.markdown("---")
    if "agent_history" not in st.session_state: st.session_state["agent_history"]=[]
    for msg in st.session_state["agent_history"]:
        st.markdown(f"**{'🧑' if msg['role']=='user' else '🤖'} {'You' if msg['role']=='user' else 'Agent'}:** {msg['content']}")
        st.markdown("---")

    if st.session_state.get("agent_pending"):
        q=st.session_state.pop("agent_q",""); st.session_state.pop("agent_pending",None)
        if q:
            with st.spinner("Thinking…"): ans=ask_ai(q,f"Business ID: {bid}")
            st.session_state["agent_history"].extend([{"role":"user","content":q},{"role":"assistant","content":ans}]); st.rerun()

    col1,col2=st.columns([5,1])
    with col1: user_q=st.text_input("Your question:",key="agent_input",placeholder="e.g. Why does this business have NAICS 561499?")
    with col2: st.markdown("<br>",unsafe_allow_html=True); send=st.button("Send ▶",type="primary")
    if send and user_q:
        with st.spinner("Thinking…"): ans=ask_ai(user_q,f"Business ID: {bid}",st.session_state["agent_history"])
        st.session_state["agent_history"].extend([{"role":"user","content":user_q},{"role":"assistant","content":ans}]); st.rerun()
    if st.session_state["agent_history"]:
        if st.button("🗑️ Clear chat"): st.session_state["agent_history"]=[]; st.rerun()

# ── Footer ────────────────────────────────────────────────────────────────────
st.markdown("---")
st.markdown(f'<div style="color:#475569;font-size:.68rem;text-align:center">KYB Intelligence Hub · Worth AI · {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</div>',unsafe_allow_html=True)
