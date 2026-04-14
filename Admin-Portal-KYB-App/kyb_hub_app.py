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

# ── Load facts (two-pass) ─────────────────────────────────────────────────────
KNOWN_LARGE={"sos_filings","sos_match","watchlist","watchlist_raw","bankruptcies",
             "judgements","liens","people","addresses","internal_platform_matches_combined"}

@st.cache_data(ttl=300)
def load_facts(bid):
    names_df,err=run_sql(f"""SELECT DISTINCT name,MAX(received_at) AS received_at
        FROM rds_warehouse_public.facts WHERE business_id='{bid}' GROUP BY name ORDER BY name""")
    if names_df is None: return None,err
    if names_df.empty: return {},None
    latest={}
    prog=st.progress(0,"Loading facts…")
    for i,name in enumerate(names_df["name"].tolist()):
        prog.progress((i+1)/len(names_df),(f"Loading {name}…"))
        if name in KNOWN_LARGE:
            latest[name]={"_too_large":True,"_name":name,
                          "_received_at":str(names_df[names_df["name"]==name]["received_at"].iloc[0])[:16]}
            continue
        df,_=run_sql(f"""SELECT name,value,received_at FROM rds_warehouse_public.facts
            WHERE business_id='{bid}' AND name='{name}' ORDER BY received_at DESC LIMIT 1""")
        if df is not None and not df.empty:
            f=parse_fact(df.iloc[0]["value"])
            f["_name"]=name; f["_received_at"]=str(df.iloc[0]["received_at"])[:16]
            latest[name]=f
        st.session_state.pop("_last_db_error",None)
    prog.empty()
    return latest,None

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
    st.markdown("---")
    st.markdown("**Sources**")
    for s in ["rds_warehouse_public.facts","rds_manual_score_public.*",
              "rds_integration_data.*","clients.customer_table","warehouse.worth_score_input_audit"]:
        st.caption(f"`{s}`")

# ════════════════════════════════════════════════════════════════════════════════
# HOME
# ════════════════════════════════════════════════════════════════════════════════
if tab=="🏠 Home":
    st.markdown("# 🔬 KYB Intelligence Hub")
    st.markdown("Enter a business UUID to investigate every KYB field with complete data lineage, "
                "winning source + alternatives, SQL/Python code, analyst explanations, and AI assistance.")
    bid=st.text_input("**Business UUID**",placeholder="e.g. af867694-9ed7-47c4-88db-190268d0a435")
    st.session_state["hub_bid"]=bid.strip() if bid else ""
    if bid and len(bid.strip())>10:
        st.success("✅ UUID set — navigate to any section in the sidebar.")
        for sec,desc in [
            ("🏛️ Registry & Identity","SOS Registry (domestic/foreign), TIN, IDV, cross-analysis"),
            ("🏭 Classification & KYB","NAICS/MCC source lineage, Background, Contact, Website"),
            ("⚠️ Risk & Watchlist","Watchlist hits (sanctions/PEP/adverse), public records, BERT analysis"),
            ("💰 Worth Score","Score factors, waterfall chart, model architecture, audit fill rates"),
            ("🤖 AI Agent","RAG-powered chat — ask anything, get SQL, Python, lineage explanations"),
        ]:
            st.markdown(f"""<div class="flow-step"><strong>{sec}</strong><br>
              <span style="color:#94A3B8;font-size:.74rem">{desc}</span></div>""",unsafe_allow_html=True)
        with st.expander("📖 Key concepts"):
            st.markdown("""
**Fact Engine winner selection:** Selects ONE winning source per fact. Rule 2: highest confidence wins if gap>5%.
Rule 3: highest weight breaks ties. Rule 4: NO minimum confidence cutoff. All others → alternatives[].

**Confidence formulas:** Middesk=0.15+0.20×tasks(max4) · OC/ZI/EFX=match.index/55 · Trulioo=status-based · AI=self-reported

**Domestic vs Foreign:** Domestic=incorporated there, Foreign=incorporated elsewhere, registered to operate there.
Entity resolution gap: address-based Middesk search finds the FOREIGN record, missing the primary DOMESTIC record.

**561499 NAICS:** Fallback when all vendors fail and AI can't classify. Cascades to MCC 5614 fallback.

**Watchlist architecture:** Consolidated watchlist=PEP+SANCTIONS (adverse_media deliberately excluded).
Tracked separately in adverse_media_hits. Both person-level and business-level hits merged.
            """)

# ════════════════════════════════════════════════════════════════════════════════
# REGISTRY & IDENTITY
# ════════════════════════════════════════════════════════════════════════════════
elif tab=="🏛️ Registry & Identity":
    bid=st.session_state.get("hub_bid","")
    if not bid: st.warning("Set UUID on Home tab."); st.stop()
    st.markdown(f"## 🏛️ Registry & Identity — `{bid[:16]}…`")
    if not is_live: st.error("🔴 Not connected."); st.stop()

    facts,err=load_facts(bid)
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

    facts,err=load_facts(bid)
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

    facts,err=load_facts(bid)
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

        # BERT live query
        st.markdown("##### Live BERT Query (rds_integration_data)")
        bert_df,bert_err=run_sql(f"""SELECT bev.business_id,bert.status,bert.sublabel,bert.created_at
            FROM rds_integration_data.business_entity_review_task bert
            JOIN rds_integration_data.business_entity_verification bev ON bev.id=bert.business_entity_verification_id
            WHERE bev.business_id='{bid}' AND bert.key='watchlist' ORDER BY bert.created_at DESC LIMIT 5""")
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

    facts,err=load_facts(bid)
    if facts is None: st.error(f"❌ {err}"); st.stop()

    score_df,score_err=run_sql(f"""SELECT bs.weighted_score_850 AS score_850,bs.weighted_score_100 AS score_100,
        bs.risk_level,bs.score_decision,bs.created_at
        FROM rds_manual_score_public.data_current_scores cs
        JOIN rds_manual_score_public.business_scores bs ON bs.id=cs.score_id
        WHERE cs.business_id='{bid}' ORDER BY bs.created_at DESC LIMIT 1""")

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

            factors_df,_=run_sql(f"""SELECT category_id,score_100,weighted_score_850 FROM rds_manual_score_public.business_score_factors
                WHERE score_id=(SELECT score_id FROM rds_manual_score_public.data_current_scores WHERE business_id='{bid}' LIMIT 1)
                ORDER BY ABS(weighted_score_850) DESC LIMIT 20""")
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
        audit_df,audit_err=run_sql("SELECT * FROM warehouse.worth_score_input_audit ORDER BY score_date DESC LIMIT 30")
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
