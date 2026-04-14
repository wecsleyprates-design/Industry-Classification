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
    st.markdown(f'<div class="flag-{level}">{"🚨⚠️✅ℹ️".split()[{"red":0,"amber":1,"green":2,"blue":3}.get(level,3)]} {text}</div>',
                unsafe_allow_html=True)

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
    try: return float(safe_get(facts.get(name,{}),"source","confidence") or 0)
    except: return 0.0

def gp(facts,name):
    return str(safe_get(facts.get(name,{}),"source","platformId") or "")

def get_alts(facts,name):
    alts=facts.get(name,{}).get("alternatives",[]) or []
    return [{"value":a.get("value"),"pid":str(safe_get(a,"source","platformId") or ""),
             "conf":float(safe_get(a,"source","confidence") or 0)} for a in alts if isinstance(a,dict)]

# ── Fact lineage table ────────────────────────────────────────────────────────
def render_lineage(facts, names, title="Fact Lineage"):
    st.markdown(f"##### {title}")
    rows=[]
    for name in names:
        f=facts.get(name,{})
        if not f: continue
        too_large=f.get("_too_large",False)
        v=f.get("value")
        if too_large: dv="📦 [too large — use PostgreSQL RDS SQL below]"
        elif isinstance(v,list): dv=f"📋 list · {len(v)} items"
        elif isinstance(v,dict):
            if name=="idv_status" and isinstance(v,dict): dv=" | ".join(f"{k}:{n}" for k,n in v.items() if n)
            else: dv=f"🗂️ object · {len(v)} keys"
        else: dv=str(v)[:100] if v is not None else "(null)"
        pid=str(safe_get(f,"source","platformId") or "")
        conf=float(safe_get(f,"source","confidence") or 0)
        win_name=pid_info(pid)[0]
        alts=get_alts(facts,name)
        alt_str=" | ".join(f"{pid_info(a['pid'])[0]}({a['conf']:.3f})" for a in alts[:3]) or "—"
        rows.append({"Fact":f"`{name}`","Value":dv,
                     "Winning Source":f"{win_name}({conf:.3f})" if conf>0 else win_name,
                     "Alternatives":alt_str,"Updated":f.get("_received_at","")})
    if rows: st.dataframe(pd.DataFrame(rows),use_container_width=True,hide_index=True)
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
        key=os.getenv("OPENAI_API_KEY","")
        if not key: return None
        return OpenAI(api_key=key)
    except: return None

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
    with st.popover("✨ Ask AI"):
        st.markdown(f"**🤖 AI — {key}**")
        for q in questions:
            if st.button(q,key=f"q_{key}_{q[:15]}"):
                st.session_state[f"pending_q_{key}"]=q
        custom=st.text_input("Custom question:",key=f"cust_{key}")
        if custom and st.button("Send",key=f"csend_{key}",type="primary"):
            st.session_state[f"pending_q_{key}"]=custom
        pending=st.session_state.pop(f"pending_q_{key}",None)
        if pending:
            with st.spinner("Thinking…"):
                ans=ask_ai(pending,f"Business: {bid}\n{context}")
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
        "⚠️ Risk & Watchlist","💰 Worth Score","🤖 AI Agent"])

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
    col_flags, col_donut, col_naics = st.columns([2,1,1])

    with col_flags:
        st.markdown("#### 🚩 Red Flag Distribution")
        flag_type_counts={}
        for b_data in biz_flags.values():
            for _,flag_title,_ in b_data["flags"]:
                base=flag_title.split(" ")[0]+" "+flag_title.split(" ")[1] if len(flag_title.split())>1 else flag_title
                flag_type_counts[base]=flag_type_counts.get(base,0)+1
        if flag_type_counts:
            fdf=pd.DataFrame(list(flag_type_counts.items()),columns=["Issue","Count"]).sort_values("Count",ascending=False)
            color_map={"IDV Failed":"#f59e0b","TIN Failed":"#ef4444","SOS Inactive":"#ef4444",
                       "No NAICS":"#8B5CF6","NAICS Fallback":"#6366f1","Watchlist":"#dc2626",
                       "TIN Missing":"#f97316","No SOS":"#f97316","BK:":"#a855f7"}
            bar_colors=[next((v for k,v in color_map.items() if k in iss),"#64748b") for iss in fdf["Issue"]]
            fig_f=go.Figure(go.Bar(x=fdf["Issue"],y=fdf["Count"],marker_color=bar_colors,
                                   text=fdf["Count"],textposition="outside"))
            fig_f.update_layout(title="Businesses with each issue type",height=260,
                                xaxis_tickangle=-30,margin=dict(t=40,b=60,l=10,r=10))
            st.plotly_chart(dark_chart(fig_f),use_container_width=True)
        else:
            flag("✅ No red flags in this period","green")

    with col_donut:
        st.markdown("#### 🎯 Risk Profile")
        critical=sum(1 for d in biz_flags.values() if d["score"]>=12)
        high=sum(1 for d in biz_flags.values() if 8<=d["score"]<12)
        medium=sum(1 for d in biz_flags.values() if 0<d["score"]<8)
        clean_n=total_biz-critical-high-medium
        fig_d=go.Figure(go.Pie(
            labels=["Critical","High","Medium","Clean"],
            values=[critical,high,medium,clean_n],
            marker=dict(colors=["#ef4444","#f97316","#f59e0b","#22c55e"]),
            hole=0.55,
            textinfo="label+percent",
            textfont=dict(size=11)))
        fig_d.update_layout(height=260,showlegend=False,
                            margin=dict(t=10,b=10,l=10,r=10),
                            annotations=[dict(text=f"{clean_n}<br>clean",
                                              font=dict(size=13,color="#22c55e"),showarrow=False)])
        st.plotly_chart(dark_chart(fig_d),use_container_width=True)
        # mini legend
        for label,count,color in [("CRITICAL ≥12",critical,"#ef4444"),
                                   ("HIGH 8–11",high,"#f97316"),
                                   ("MEDIUM 1–7",medium,"#f59e0b"),
                                   ("CLEAN 0",clean_n,"#22c55e")]:
            st.markdown(f'<div style="color:{color};font-size:.70rem">■ {label}: {count:,}</div>',
                        unsafe_allow_html=True)

    with col_naics:
        st.markdown("#### 🏭 Top Industry Sectors")
        if not naics_sector.empty:
            SECTOR_NAMES={"11":"Agriculture","21":"Mining","22":"Utilities","23":"Construction",
                          "31":"Manufacturing","32":"Manufacturing","33":"Manufacturing",
                          "42":"Wholesale","44":"Retail","45":"Retail","48":"Transport",
                          "49":"Transport","51":"Information","52":"Finance","53":"Real Estate",
                          "54":"Professional Svcs","55":"Mgmt","56":"Admin Svcs",
                          "61":"Education","62":"Health","71":"Arts","72":"Food & Accom",
                          "81":"Other Services","92":"Public Admin"}
            naics_sector["Label"]=naics_sector["Sector"].map(
                lambda s: f"{s} {SECTOR_NAMES.get(s,'')}".strip())
            fig_n=px.bar(naics_sector,x="Count",y="Label",orientation="h",
                         color="Count",color_continuous_scale="Blues",
                         title="NAICS 2-digit sectors")
            fig_n.update_layout(height=260,coloraxis_showscale=False,
                                margin=dict(t=40,b=10,l=10,r=10),yaxis_title="")
            st.plotly_chart(dark_chart(fig_n),use_container_width=True)
        else:
            st.info("No NAICS data available.")

    st.markdown("---")

    # ── Row 4: Public Records + Formation States + SOS/TIN/IDV detail ────────
    col_pr, col_states = st.columns([1,1])

    with col_pr:
        st.markdown("#### 📜 Public Records & Risk")
        pr_data=[
            ("Bankruptcies",bk_biz,rate(bk_biz,n)+" of businesses","#8B5CF6"),
            ("Watchlist hits",wl_biz,rate(wl_biz,n)+" of businesses","#ef4444"),
            ("Adverse Media",(stats_df["adverse_media"].apply(lambda v:_safe_int(v)>0)).sum()
              if stats_df is not None and not stats_df.empty else 0,
              "","#f59e0b"),
        ]
        for label,count,sub,color in pr_data:
            kpi(label,f"{count:,}",sub,color)

    with col_states:
        st.markdown("#### 🗺️ Formation States (Top 10)")
        if not state_counts.empty:
            TAX_HAVENS={"DE","NV","WY"}
            state_counts["Tax Haven"]=state_counts["State"].isin(TAX_HAVENS)
            state_counts["Color"]=state_counts["State"].map(
                lambda s: "#f59e0b" if s in TAX_HAVENS else "#3B82F6")
            fig_s=px.bar(state_counts,x="State",y="Count",
                         color="Tax Haven",
                         color_discrete_map={True:"#f59e0b",False:"#3B82F6"},
                         title="Top 10 formation states · 🟡=tax haven")
            fig_s.update_layout(height=240,showlegend=False,
                                margin=dict(t=40,b=10,l=10,r=10))
            st.plotly_chart(dark_chart(fig_s),use_container_width=True)
        else:
            st.info("No formation state data available.")

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
        st.markdown("#### SOS Registry — Winning Source & Alternatives")
        render_lineage(facts,["sos_active","sos_match","sos_match_boolean","middesk_confidence","middesk_id",
                               "formation_state","formation_date","year_established","corporation"])

        st.markdown("##### Vendor Confidence on SOS Facts")
        vendors=[("Middesk","16"),("OC","23"),("ZI","24"),("EFX","17"),("Trulioo","38")]
        cdata=[]
        for vn,vp in vendors:
            for fn in ["sos_match","sos_match_boolean"]:
                win_pid=gp(facts,fn); wconf=gc(facts,fn)
                aconf=next((a["conf"] for a in get_alts(facts,fn) if a["pid"]==vp),0)
                conf=wconf if win_pid==vp else aconf
                if conf>0: cdata.append({"Vendor":vn,"Fact":fn,"Conf":conf,
                                          "Role":"Winner" if win_pid==vp else "Alternative"})
        if cdata:
            fig=px.bar(pd.DataFrame(cdata),x="Vendor",y="Conf",color="Role",barmode="group",
                       color_discrete_map={"Winner":"#22c55e","Alternative":"#8B5CF6"},
                       title="Vendor Confidence on SOS Facts")
            fig.update_layout(yaxis=dict(range=[0,1]))
            st.plotly_chart(dark_chart(fig),use_container_width=True)

        ai_popup("SOS",f"SOS active:{sos_act} match:{sos_match} middesk_conf:{mdsk_conf:.3f}",[
            "How is Middesk confidence calculated for SOS facts?",
            "Why might sos_match_boolean be false for a real business?",
            "What does sos_active=false mean for underwriting?",
            "How do I query SOS filings from Redshift?",],bid)

        with st.expander("📋 SQL & Python"):
            st.code(sql_for(bid,["sos_active","sos_match","sos_match_boolean","formation_state"]),language="sql")
            st.code(py_for(bid,["sos_active","sos_match","sos_match_boolean"]),language="python")
            st.code(f"""-- sos_filings: run on PostgreSQL RDS port 5432 (too large for Redshift federation):
SELECT value->>'value' AS filings FROM rds_warehouse_public.facts
WHERE business_id='{bid}' AND name='sos_filings';
-- Each filing: active, foreign_domestic, state, entity_type, registration_date""",language="sql")

        analyst_card("SOS Registry — Interpretation",[
            f"sos_active={sos_act}: {'✅ Entity in good standing' if sos_act=='true' else '🚨 NOT in good standing — check for unpaid taxes, missed annual report, or administrative dissolution.'}",
            f"Middesk confidence {mdsk_conf:.3f}: formula = 0.15 base + 0.20 per successful review task (max 4 tasks: name, TIN, address, SOS). This score = ~{round((mdsk_conf-0.15)/0.20)} tasks confirmed.",
            "sos_filings array (too large for Redshift federation) contains each SOS filing with foreign_domestic, active, state, entity_type. Must query from PostgreSQL RDS (port 5432).",
            "Winner selection: Middesk (pid=16, w=2.0) is primary. OC (pid=23, w=0.9) is fallback. Higher confidence × weight wins.",
        ])

    with r2:
        st.markdown("#### Domestic vs Foreign Registration")
        if tax_haven:
            flag(f"Business incorporated in {form_state} (tax-haven state). Almost certainly has "
                 f"a domestic filing in {form_state} AND foreign qualifications in operating states. "
                 "Middesk address-based search may find the FOREIGN record, missing the PRIMARY domestic record. "
                 "This can cause sos_match_boolean=false as a FALSE NEGATIVE.", "amber")

        st.markdown("##### Data Flow — How foreign_domestic Is Determined")
        for i,(step,src,desc) in enumerate([
            ("Middesk (primary, pid=16)","Middesk API registrations[] array",
             "Each registration has foreign_domestic field set by Middesk based on filing type"),
            ("OpenCorporates (fallback, pid=23)","OC home_jurisdiction_code comparison",
             "Same state → 'domestic'. Different state → 'foreign'. company_type keywords also checked."),
            ("sos_filings fact stored","rds_warehouse_public.facts",
             "Array of SoSRegistration objects: {id, state, active, foreign_domestic, entity_type, registration_date}"),
            ("Admin Portal","KYB → Business Registration tab",
             "EntityJurisdictionCell.tsx: domestic='Primary' badge, foreign='Secondary' badge"),
        ]):
            color=["#f59e0b","#3B82F6","#22c55e","#8B5CF6"][i]
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {color};
                border-radius:8px;padding:9px 14px;margin:3px 0">
              <strong style="color:{color}">Step {i+1}: {step}</strong>
              <span style="color:#64748b;margin-left:8px;font-size:.70rem">{src}</span>
              <div style="color:#94A3B8;font-size:.75rem;margin-top:3px">{desc}</div>
            </div>""",unsafe_allow_html=True)

        render_lineage(facts,["formation_state","formation_date","corporation"])

        with st.expander("📋 SQL — sos_filings (PostgreSQL RDS port 5432)"):
            st.code(f"""-- Connect to PostgreSQL RDS (port 5432) — native JSONB, no size limit:
SELECT
    business_id,
    filing->>'foreign_domestic' AS filing_type,
    filing->>'state'            AS state,
    filing->>'active'           AS active,
    filing->>'entity_type'      AS entity_type,
    filing->>'registration_date' AS reg_date
FROM rds_warehouse_public.facts
CROSS JOIN jsonb_array_elements(value->'value') AS filing
WHERE name='sos_filings' AND business_id='{bid}'
ORDER BY (filing->>'active')::boolean DESC;""",language="sql")

        analyst_card("Domestic vs Foreign — Key Insights",[
            "A business incorporated in Delaware but operating in Texas has: (1) Domestic filing in Delaware (primary), and (2) Foreign qualification in Texas (secondary).",
            "Entity resolution gap: Middesk searches by the submitted address (Texas). It finds the Texas FOREIGN record, missing the Delaware DOMESTIC primary record.",
            f"{'⚠️ ' + form_state + ' is a tax-haven state. Verify both domestic AND foreign filings.' if tax_haven else '✅ No tax-haven state detected.'}",
            "Fix: when sos_match=false AND formation_state≠operating_state, re-search Middesk using formation_state as jurisdiction.",
        ])

    with r3:
        st.markdown("#### TIN Verification")
        render_lineage(facts,["tin","tin_submitted","tin_match","tin_match_boolean"])

        c1,c2,c3=st.columns(3)
        with c1: kpi("Submitted","✅ Yes" if gv(facts,"tin_submitted") else "❌ No",
                     "tin_submitted","#22c55e" if gv(facts,"tin_submitted") else "#ef4444")
        with c2: kpi("IRS Status",tin_status.capitalize() or "Unknown","tin_match.value.status",
                     "#22c55e" if tin_status=="success" else "#ef4444")
        with c3: kpi("Boolean",tin_bool,"Derived from status==='success'",
                     "#22c55e" if tin_bool=="true" else "#ef4444")

        if tin_msg: flag(f"Middesk TIN message: \"{tin_msg}\"","amber" if tin_status!="success" else "green")

        # Consistency check
        checks=[
            ("TIN submitted",str(gv(facts,"tin_submitted") or "").lower() not in ("","false","0"),
             str(gv(facts,"tin_submitted") or "(null)"),"EIN must be submitted"),
            ("tin_match.status",tin_status in ("success","failure","pending"),
             tin_status or "(missing)","Must be success/failure/pending"),
            ("tin_match_boolean",tin_bool in ("true","false"),tin_bool,"Must be true or false"),
            ("Boolean↔status consistent",tin_bool=="true"==(tin_status=="success"),
             f"bool={tin_bool},status={tin_status}","CRITICAL: bool=true ONLY when status=success"),
        ]
        st.dataframe(pd.DataFrame([{"Check":l,"Result":v,"Status":"✅ OK" if ok else "❌ ISSUE","Detail":d}
                                    for l,ok,v,d in checks]),use_container_width=True,hide_index=True)

        # Failure reason
        if tin_status=="failure" and tin_msg:
            FAILURE_MAP={
                "does not have a record":("Wrong EIN or name mismatch","HIGH","Ask applicant for exact legal name on EIN certificate"),
                "associated with a different":("🚨 FRAUD: EIN belongs to different entity","CRITICAL","Escalate to fraud review immediately"),
                "duplicate":("Duplicate request","LOW","Wait 24h and re-submit"),
                "invalid":("Invalid EIN format","HIGH","Must be exactly 9 digits"),
                "unavailable":("IRS temporary outage","LOW","Auto-retry in 24h"),
            }
            for kw,(reason,sev,action) in FAILURE_MAP.items():
                if kw.lower() in tin_msg.lower():
                    lvl="red" if sev in ("CRITICAL","HIGH") else "amber"
                    flag(f"Failure: **{reason}** (Severity:{sev}) → {action}",lvl); break

        ai_popup("TIN",f"TIN status:{tin_status} msg:{tin_msg} bool:{tin_bool}",[
            "How is tin_match_boolean derived from tin_match.status?",
            "What does 'associated with a different Business Name' mean?",
            "What is the Trulioo fallback for TIN when Middesk has no task?",
            "How do I query TIN data from Redshift?",],bid)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["tin","tin_submitted","tin_match","tin_match_boolean"]),language="sql")

        analyst_card("TIN Verification — Interpretation",[
            f"tin_match_boolean={tin_bool}: This is what the Admin Portal shows. "
            f"{'✅ IRS confirmed EIN matches legal name.' if tin_bool=='true' else '❌ EIN-name combination NOT confirmed by IRS.'}",
            "Source: Middesk (pid=16) primary via direct IRS query. If Middesk has no TIN task → Trulioo BusinessRegistrationNumber comparison is fallback.",
            "CRITICAL data integrity check: tin_match_boolean=true MUST only happen when tin_match.status='success'. Any divergence = code bug in integration-service L488-490.",
        ])

    with r4:
        st.markdown("#### IDV — Identity Verification (Plaid)")
        render_lineage(facts,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"])

        idv_raw=facts.get("idv_status",{}).get("value",{})
        IDV_INFO={"SUCCESS":("✅","#22c55e","Government ID + selfie confirmed. Identity verified."),
                  "PENDING":("⏳","#f59e0b","Session not yet completed. Send reminder after 24h."),
                  "FAILED":("❌","#ef4444","Expired ID, selfie mismatch, liveness fail, or unsupported ID type."),
                  "CANCELED":("🚫","#f97316","User exited. Possible UX friction or deliberate avoidance."),
                  "EXPIRED":("⌛","#64748b","Session link expired (15-30min). Re-issue new link.")}
        if isinstance(idv_raw,dict) and idv_raw:
            for status,count in sorted(idv_raw.items(),key=lambda x:-x[1]):
                info=IDV_INFO.get(status.upper(),("❓","#94a3b8","Unknown"))
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {info[1]};
                    border-radius:8px;padding:9px 14px;margin:3px 0">
                  <span style="color:{info[1]};font-weight:700">{info[0]} {status}: {count} sessions</span>
                  <div style="color:#94A3B8;font-size:.75rem;margin-top:3px">{info[2]}</div>
                </div>""",unsafe_allow_html=True)
        else:
            flag(f"idv_passed_boolean={idv_val}. Full IDV status dict not available (may be null).","blue")

        ai_popup("IDV",f"IDV passed:{idv_val}",[
            "What are the most common reasons IDV fails?",
            "How is idv_passed_boolean calculated from idv_status?",
            "What does is_sole_prop=true mean for IDV interpretation?",
            "How do I query IDV data from Redshift?",],bid)

        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["idv_status","idv_passed","idv_passed_boolean","is_sole_prop"]),language="sql")

    with r5:
        st.markdown("#### Cross-Field Anomaly Detection")
        name_m=str(gv(facts,"name_match_boolean") or "").lower()
        wl_hits=int(float(gv(facts,"watchlist_hits") or 0))
        mdsk_c=gc(facts,"sos_match")
        oc_c=gc(facts,"sos_match_boolean") if gp(facts,"sos_match_boolean")=="23" else 0.0

        checks=[
            ("SOS Active + TIN Failed",sos_act=="true" and tin_status=="failure","MEDIUM",
             "Entity is registered but EIN-name mismatch. Likely cause: DBA submitted instead of legal name."),
            ("SOS Inactive + TIN Verified",sos_act=="false" and tin_bool=="true","HIGH",
             "EIN valid but entity cannot legally operate. Requires reinstatement before approval."),
            ("IDV Passed + Name Match Failed",idv_val=="true" and name_m=="false","MEDIUM",
             "Person identity confirmed but business name doesn't match registry. Expected for sole props with DBA."),
            ("TIN bool/status inconsistency",tin_bool=="true" and tin_status not in ("success",""),"CRITICAL",
             f"DATA INTEGRITY BUG: boolean=true but status='{tin_status}'. File bug report for integration-service."),
            ("No vendor confirmation",mdsk_c==0.0 and oc_c==0.0,"HIGH",
             "Neither Middesk nor OC matched this business. Entity existence completely unverified."),
            ("Tax haven formation state",tax_haven,"NOTICE",
             f"{form_state} = tax-haven state. Verify domestic AND foreign SOS filings separately."),
        ]
        found=[(t,s,d) for t,cond,s,d in checks if cond]
        if found:
            for title,sev,desc in sorted(found,key=lambda x:{"CRITICAL":0,"HIGH":1,"MEDIUM":2,"NOTICE":3}.get(x[1],4)):
                col={"CRITICAL":"#ef4444","HIGH":"#f97316","MEDIUM":"#f59e0b","NOTICE":"#3B82F6"}.get(sev,"#64748b")
                st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col};
                    border-radius:8px;padding:12px 16px;margin:8px 0">
                  <div style="color:{col};font-weight:700">{sev} — {title}</div>
                  <div style="color:#CBD5E1;font-size:.79rem;margin-top:6px">{desc}</div>
                </div>""",unsafe_allow_html=True)
        else: flag("✅ No cross-field anomalies detected.","green")

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

    c1,c2,c3,c4=st.columns(4)
    with c1: kpi("NAICS",naics or "N/A",f"561499=fallback · {pid_info(naics_src)[0]}",
                 "#f59e0b" if naics=="561499" else "#22c55e")
    with c2: kpi("NAICS Conf",f"{naics_conf:.3f}","0=no match 1=perfect","#22c55e" if naics_conf>0.70 else "#f59e0b")
    with c3: kpi("MCC",mcc or "N/A",pid_info(gp(facts,"mcc_code"))[0],"#3B82F6")
    with c4: kpi("Industry",str(gv(facts,"industry") or "N/A")[:20],"2-digit NAICS sector","#8B5CF6")

    cl1,cl2,cl3,cl4=st.tabs(["🏭 NAICS/MCC","🏢 Background","📬 Contact","🌐 Website"])

    with cl1:
        st.markdown("#### NAICS/MCC Classification — Full Source Lineage")
        SOURCE_PRIORITY=pd.DataFrame([
            ("Equifax","17","0.7","efx_primnaicscode","warehouse.equifax_us_latest"),
            ("ZoomInfo","24","0.8","zi_c_naics6","zoominfo.comp_standard_global"),
            ("OpenCorporates","23","0.9","industry_code_uids → parse us_naics-XXXXXX","OC API"),
            ("SERP","22","0.3","businessLegitimacyClassification.naics_code","Google/web"),
            ("Trulioo","38","0.7","extractStandardizedIndustriesFromTruliooResponse","Trulioo API"),
            ("businessDetails","0","0.2","applicant naics_code (6-digit validated)","onboarding form"),
            ("AI (GPT)","31","0.1","AINaicsEnrichment.response.naics_code","GPT-4o-mini LAST RESORT"),
        ],columns=["Vendor","pid","Weight","Data Field","Data Source"])
        SOURCE_PRIORITY["Won?"]=[("✅ YES" if r["pid"]==naics_src else "—") for _,r in SOURCE_PRIORITY.iterrows()]
        st.dataframe(SOURCE_PRIORITY,use_container_width=True,hide_index=True)

        render_lineage(facts,["naics_code","mcc_code","naics_description","mcc_description","industry"])

        alts=get_alts(facts,"naics_code")
        if alts:
            st.markdown("##### Alternative NAICS Sources (lost to Fact Engine)")
            st.dataframe(pd.DataFrame([{"Vendor":pid_info(a["pid"])[0],"pid":a["pid"],
                "Alt NAICS":str(a["value"])[:20] if a["value"] else "(null)",
                "Conf":f"{a['conf']:.3f}",
                "Why lost?":f"Conf {a['conf']:.3f} < winner {naics_conf:.3f}" if a["conf"]<naics_conf else "Lower weight"}
               for a in alts]),use_container_width=True,hide_index=True)

        if naics=="561499":
            st.markdown("#### ⚠️ 561499 Root Cause")
            flag("All vendors failed to classify industry. AI fired as last resort but also couldn't determine it.","amber")
            website_v=gv(facts,"website")
            if website_v and naics=="561499":
                flag(f"🚨 Gap G2 CONFIRMED: website='{str(website_v)[:50]}' exists but NAICS=561499. "
                     "AI had the URL but web_search was not enabled (params.website not passed).","red")
            for g,d in [("G1: Entity matching failed","All ZI/EFX/OC/Middesk failed to match — no commercial NAICS available"),
                        ("G2: AI web_search not used","params.website null → AI couldn't search the website"),
                        ("G3: Name keyword missing","AI prompt doesn't check name keywords before defaulting to 561499")]:
                st.markdown(f'<div class="flow-step"><strong>{g}</strong><br><span style="color:#94A3B8;font-size:.73rem">{d}</span></div>',unsafe_allow_html=True)

        ai_popup("NAICS",f"NAICS:{naics} conf:{naics_conf:.3f} src:{pid_info(naics_src)[0]}",[
            "Why did this vendor win the NAICS classification?",
            "What are the root causes of NAICS 561499 fallback?",
            "How does the Fact Engine select the winning NAICS source?",
            "What SQL shows NAICS data from Redshift?",
            "What is the relationship between NAICS and MCC codes?",],bid)

        with st.expander("📋 SQL & Python"):
            st.code(sql_for(bid,["naics_code","mcc_code","naics_description","mcc_description","industry"]),language="sql")
            st.code(py_for(bid,["naics_code","mcc_code"]),language="python")

        analyst_card("NAICS Classification — Full Interpretation",[
            f"Winning source: {pid_info(naics_src)[0]} (pid={naics_src}) · confidence {naics_conf:.3f}. "
            f"{'Confidence formula: match.index÷55 (MAX_CONFIDENCE_INDEX=55).' if naics_src in ('23','24','17') else 'AI self-reported confidence (LOW/MED/HIGH).' if naics_src=='31' else '0.15+0.20×tasks (Middesk).' if naics_src=='16' else 'Status-based (Trulioo).'}",
            f"NAICS confidence {naics_conf:.3f}: {'above 0.70 — reliable classification' if naics_conf>0.70 else 'between 0.40-0.70 — moderate confidence, verify' if naics_conf>0.40 else 'below 0.40 — low confidence, may be wrong'}",
            "MCC = mcc_code_found (AI direct) ?? mcc_code_from_naics (rel_naics_mcc lookup). If NAICS=561499 → MCC defaults to 5614.",
            f"{'⚠️ 561499 fallback: vendor entity matching failed for this business.' if naics=='561499' else ''}",
        ])

    with cl2:
        render_lineage(facts,["business_name","legal_name","dba_found","corporation",
                               "formation_date","year_established","revenue","num_employees","kyb_submitted"])
        ai_popup("Background","firmographic data",[
            "What is the source for business_name vs legal_name?","How is dba_found determined?",
            "Where does revenue data come from?","What does kyb_submitted=true mean?"],bid)
        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["business_name","legal_name","dba_found","corporation","formation_date","revenue","num_employees"]),language="sql")

    with cl3:
        render_lineage(facts,["primary_address","business_phone","email","address_match",
                               "address_match_boolean","addresses_deliverable","name_match","name_match_boolean"])
        ai_popup("Contact","contact facts",[
            "How is name_match_boolean derived?","What does addresses_deliverable mean?",
            "How is address_match determined?"],bid)

    with cl4:
        render_lineage(facts,["website","website_found","serp_id","review_rating","review_count"])
        website_v=gv(facts,"website"); web_found=str(gv(facts,"website_found") or "").lower()
        c1,c2=st.columns(2)
        with c1: kpi("Website Found","✅ Yes" if web_found=="true" else "❌ No",
                     str(website_v)[:40] if website_v else "No URL","#22c55e" if web_found=="true" else "#f59e0b")
        with c2: kpi("SERP ID","✅ Found" if gv(facts,"serp_id") else "❌ Not found","Google My Business",
                     "#22c55e" if gv(facts,"serp_id") else "#64748b")
        if web_found=="true" and naics=="561499":
            flag("🚨 Website found but NAICS=561499. Gap G2 confirmed — AI had URL but web_search not triggered.","red")

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
        render_lineage(facts,["num_bankruptcies","num_judgements","num_liens"])
        if bk>0 or ju>0 or li>0:
            st.dataframe(pd.DataFrame({
                "Type":["BK","Judgments","Liens"],"Count":[bk,ju,li],
                "Model Feature":["count_bankruptcy+age_bankruptcy","count_judgment+age_judgment","count_lien+age_lien"],
                "Score Impact (est)":["−40pts each (cap−120)","−20pts each (cap−60)","−10pts each (cap−40)"],
            }),use_container_width=True,hide_index=True)
        with st.expander("📋 SQL"):
            st.code(sql_for(bid,["num_bankruptcies","num_judgements","num_liens"]),language="sql")

    with rw3:
        combos=[]
        if wl>0 and bk>0: combos.append(("🔴 CRITICAL","Watchlist+BK","Compliance+credit both flagged. Manual underwriting mandatory."))
        if wl>0 and am>0: combos.append(("🔴 HIGH","Watchlist+Adverse Media","Compliance hit + negative press. Verify if related."))
        if bk>0 and ju>0 and li>0: combos.append(("🔴 HIGH","BK+Judgment+Lien","Worst financial profile. Thorough document review required."))
        if wl==0 and bk==0: combos.append(("✅ CLEAN","No compliance or credit issues","Neither watchlist nor public record concerns."))
        for sev,title,desc in combos:
            col={"🔴 CRITICAL":"#ef4444","🔴 HIGH":"#f97316","✅ CLEAN":"#22c55e"}.get(sev,"#f59e0b")
            st.markdown(f"""<div style="background:#1E293B;border-left:4px solid {col};
                border-radius:8px;padding:12px 16px;margin:8px 0">
              <div style="color:{col};font-weight:700">{sev} — {title}</div>
              <div style="color:#CBD5E1;font-size:.79rem;margin-top:6px">{desc}</div>
            </div>""",unsafe_allow_html=True)

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

    ws1,ws2,ws3=st.tabs(["💰 Score","📊 Waterfall","📊 Audit"])

    with ws1:
        if score_df is not None and not score_df.empty:
            row=score_df.iloc[0]
            score=float(row.get("score_850") or 0); risk=str(row.get("risk_level","") or "")
            dec=str(row.get("score_decision","") or ""); scored_at=str(row.get("created_at",""))[:16]
            rc={"HIGH":"#ef4444","MODERATE":"#f59e0b","MEDIUM":"#f59e0b","LOW":"#22c55e"}.get(risk.upper(),"#64748b")
            dc={"APPROVE":"#22c55e","FURTHER_REVIEW_NEEDED":"#f59e0b","DECLINE":"#ef4444"}.get(dec,"#64748b")
            c1,c2,c3,c4=st.columns(4)
            with c1: kpi("Worth Score",f"{score:.0f}","300–850","#3B82F6")
            with c2: kpi("Risk Level",risk or "Unknown","",rc)
            with c3: kpi("Decision",dec.replace("_"," ") or "Unknown","",dc)
            with c4: kpi("Scored At",scored_at,"rds_manual_score_public","#8B5CF6")

            for lv,ex in [("LOW","✅ 650–850: entity passes major factors. Standard approval."),
                          ("MODERATE","🟡 500–649: some risk factors. Review before approving."),
                          ("HIGH","🔴 300–499: significant risk signals. Manual underwriting required.")]:
                if lv==risk.upper(): flag(f"Risk Level={risk}: {ex}","blue"); break

            DECISIONS={"APPROVE":"Model probability ABOVE acceptance threshold. Business meets risk criteria for the product.",
                       "FURTHER_REVIEW_NEEDED":"Score near threshold — uncertain zone. Human analyst must review before decision.",
                       "DECLINE":"Model probability BELOW minimum threshold. Business exceeds maximum acceptable risk."}
            if dec in DECISIONS: flag(f"Decision={dec.replace('_',' ')}: {DECISIONS[dec]}","blue")

            factors_df,_=load_score_factors(bid)
            if factors_df is not None and not factors_df.empty:
                st.markdown("##### Factor Contributions (business_score_factors)"); st.dataframe(factors_df,use_container_width=True,hide_index=True)
            else: flag("business_score_factors not accessible — showing estimated waterfall in next tab.","blue")
        else:
            flag(f"No score found. {score_err or ''}","amber")
            st.code(f"""SELECT bs.weighted_score_850,bs.risk_level,bs.score_decision,bs.created_at
FROM rds_manual_score_public.data_current_scores cs
JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1;""",language="sql")
            score=None

        ai_popup("WorthScore",f"Score:{score}",[
            "Why is this business's Worth Score at this level?",
            "How is the 300-850 scale calculated from model output?",
            "What SQL shows factor contributions for this business?",
            "What would improve this business's score the most?",
            "What are the 3 model components of the Worth Score?",],bid)

        analyst_card("Worth Score Architecture",[
            "Score = prediction × 550 + 300. Raw model output (0–1 probability) scaled to 300–850.",
            "3-model ensemble: (1) Firmographic XGBoost, (2) Financial neural net (PyTorch), (3) Economic model. Combined via ensemble → calibrator.",
            "business_score_factors: SHAP-equivalent contributions per category (Public Records, Company Profile, Financials, Banking, Economic).",
            "NOTE: score_status column does NOT exist in current schema. Filter by score_decision instead.",
        ])

    with ws2:
        if score_df is not None and not score_df.empty:
            score_v=float(score_df.iloc[0]["score_850"])
            bk=int(float(gv(facts,"num_bankruptcies") or 0))
            ju=int(float(gv(facts,"num_judgements") or 0))
            li=int(float(gv(facts,"num_liens") or 0))
            sos_a=str(gv(facts,"sos_active") or "").lower()=="true"
            tin_ok=str(gv(facts,"tin_match_boolean") or "").lower()=="true"
            wl_n=int(float(gv(facts,"watchlist_hits") or 0))
            has_rev=gv(facts,"revenue") is not None and str(gv(facts,"revenue") or "") not in ("","None","[too large")
            naics_ok=str(gv(facts,"naics_code") or "561499")!="561499"
            fd=str(gv(facts,"formation_date") or "")
            try: age=datetime.now(timezone.utc).year-int(fd[:4]) if fd else None
            except: age=None

            BASE=300
            pr=-(min(bk*40,120)+min(ju*20,60)+min(li*10,40))
            perf=(10 if sos_a else 0)+(10 if tin_ok else 0)-min(wl_n*20,80)
            fin=25 if has_rev else 0; ops=(30 if (age or 0)>=5 else 20 if (age or 0)>=2 else 10 if (age or 0)>=1 else 0)
            profile=15 if naics_ok else 5; explained=pr+perf+fin+ops+profile
            fin+=score_v-BASE-explained

            cats=["Base Score","Performance\n(SOS/TIN/WL)","Financial\n(Plaid/Revenue)",
                  "Public Records\n(BK/Judg/Lien)","Operations\n(Age/Employees)","Company Profile\n(NAICS)","Final Score"]
            conts=[BASE,perf,fin,pr,ops,profile,0]
            running=BASE; bases=[]; colors=[]; texts=[]
            for i,(c,ct) in enumerate(zip(cats,conts)):
                if i==0:
                    bases.append(0); colors.append("#C4A8FF"); texts.append(str(int(ct)))
                elif i==len(cats)-1:
                    bases.append(0); colors.append("#EC4899"); texts.append(str(int(score_v)))
                else:
                    bases.append(running if ct>=0 else running+ct); running+=ct
                    colors.append("#22c55e" if ct>=0 else "#ef4444")
                    texts.append(f"{'+' if ct>=0 else ''}{int(ct)}")

            fig=go.Figure(go.Bar(x=cats,y=[abs(c) if i not in (0,len(conts)-1) else c for i,c in enumerate(conts)],
                base=bases,marker_color=colors,text=texts,textposition="outside",
                textfont=dict(color="#E2E8F0",size=12)))
            fig.update_layout(title=f"Worth Score Waterfall (estimated) — {score_v:.0f}/850",yaxis=dict(range=[250,870]),height=420)
            st.plotly_chart(dark_chart(fig),use_container_width=True)
            st.caption("Estimated from available facts. Exact values in business_score_factors.")
        else: st.info("Score data not available for waterfall chart.")

    with ws3:
        audit_df,audit_err=load_audit()
        if audit_df is not None and not audit_df.empty:
            fill_cols=[c for c in audit_df.columns if c.startswith("fill_")]
            lr=audit_df.iloc[0]
            fd2=[{"Feature":c.replace("fill_",""),"Fill %":float(lr[c])} for c in fill_cols if c in audit_df.columns]
            fdf=pd.DataFrame(fd2).sort_values("Fill %",ascending=True)
            fdf["Status"]=fdf["Fill %"].apply(lambda v:"Good" if v>=80 else("Medium" if v>=30 else"Low"))
            fig=px.bar(fdf.tail(30),x="Fill %",y="Feature",orientation="h",color="Status",
                       color_discrete_map={"Good":"#22c55e","Medium":"#f59e0b","Low":"#ef4444"},
                       title=f"Feature Fill Rates ({lr['score_date']})")
            fig.update_layout(height=600)
            st.plotly_chart(dark_chart(fig),use_container_width=True)
        else: flag(f"Audit table not accessible. {audit_err or ''}","amber")

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
        flag("Set OPENAI_API_KEY environment variable to enable AI: export OPENAI_API_KEY=your-key","amber")

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
