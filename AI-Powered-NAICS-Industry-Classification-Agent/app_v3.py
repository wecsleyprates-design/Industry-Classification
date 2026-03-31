"""
app_v3.py — Global Industry Classification Engine (v3)
========================================================
Adds to app_v2:
  🧠 SHAP Explainability tab — why the model classified as it did
  🕵️ Record Explorer tab      — per-company drill-down with decision panel
  📜 Audit Trail page         — governance log of all analyst actions
  Decision panel              — APPROVE / REVIEW / ESCALATE / REJECT + notes

Architecture:
  shap_explainer.py — standalone SHAP module (zero changes to consensus_engine)
  All models pre-warmed at startup for instant classification

Same pipeline as v2:
  Fast (default): entity resolver → consensus XGBoost → risk engine  ~0.02s/company
  Deep (optional, single mode): + LLM + SEC EDGAR + Companies House   ~10s
"""
from __future__ import annotations

import io
import re
import sys
import time
import uuid
import logging
import warnings
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter
from typing import Optional

import numpy as np
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.WARNING)
sys.path.insert(0, str(Path(__file__).parent))

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Industry Classification Engine v3",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Design tokens ─────────────────────────────────────────────────────────────
SRC_C   = {"opencorporates":"#68D391","equifax":"#4299E1","trulioo":"#9F7AEA",
            "zoominfo":"#F6E05E","liberty_data":"#FC8181","ai_semantic":"#63B3ED"}
KYB_C   = {"APPROVE":"#48BB78","REVIEW":"#4299E1","ESCALATE":"#ECC94B","REJECT":"#FC8181"}
KYB_BG  = {"APPROVE":"#1a4731","REVIEW":"#1a365d","ESCALATE":"#5c3a00","REJECT":"#5c1a1a"}
RISK_C  = {"CRITICAL":"#9B2335","HIGH":"#FC8181","MEDIUM":"#ECC94B",
            "LOW":"#48BB78","INFO":"#4299E1"}
DEC_C   = {"Approved":"#48BB78","Rejected":"#FC8181","Needs Review":"#ECC94B",
            "Escalated":"#9F7AEA","No Match":"#718096","Unreviewed":"#4A5568"}

DECISION_OPTIONS = ["Unreviewed","Approved","Rejected","Needs Review","Escalated","No Match"]

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
[data-testid="stMetricValue"] { font-size: 1.1rem !important; }
[data-testid="stMetricLabel"] { font-size: 0.75rem !important; }
.src-card { border-radius:10px; padding:14px 16px; margin-bottom:10px;
            background:rgba(255,255,255,0.04); border:2px solid; }
.kyb-banner { border-radius:10px; padding:14px 22px; text-align:center;
              font-size:1.3em; font-weight:800; color:white; margin-bottom:16px; }
.interp-card { border-radius:10px; padding:18px 20px; margin:12px 0;
               background:#1A1F2E; border-left:5px solid; }
.dec-panel { border-radius:10px; padding:16px 20px; margin:12px 0;
             background:#1A202C; border:2px solid #2D3748; }
.audit-row { padding:8px 12px; border-left:3px solid; margin-bottom:6px;
             background:rgba(255,255,255,0.03); border-radius:0 6px 6px 0; }
.prob-bar-wrap { margin-bottom:10px; }
.prob-bar-outer { background:#2D3748; border-radius:4px; height:16px; }
.prob-bar-inner { height:16px; border-radius:4px; display:flex;
                  align-items:center; padding-left:6px; }
.prob-bar-pct { font-size:11px; font-weight:700; color:white; }
.shap-bar-pos { background:linear-gradient(90deg,#FC8181,#FED7D7); }
.shap-bar-neg { background:linear-gradient(90deg,#4299E1,#BEE3F8); }
</style>
""", unsafe_allow_html=True)

# ── Cached model singletons ───────────────────────────────────────────────────
@st.cache_resource(show_spinner=False)
def _te():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()

@st.cache_resource(show_spinner=False)
def _ce():
    from consensus_engine import IndustryConsensusEngine
    return IndustryConsensusEngine(taxonomy_engine=_te())

@st.cache_resource(show_spinner=False)
def _re():
    from risk_engine import RiskEngine
    return RiskEngine(taxonomy_engine=_te())

@st.cache_resource(show_spinner=False)
def _er():
    from entity_resolver import EntityResolver
    return EntityResolver()

@st.cache_resource(show_spinner=False)
def _sim():
    from data_simulator import DataSimulator
    return DataSimulator()

@st.cache_resource(show_spinner=False)
def _shap_exp():
    """SHAP explainer — built once, reused for every explanation."""
    from shap_explainer import ConsensusExplainer
    return ConsensusExplainer(_ce())

def _prewarm() -> None:
    if st.session_state.get("_ready"):
        return
    with st.spinner("⏳ Loading models — first start only (~10s)…"):
        _er(); _te(); _ce(); _re(); _sim(); _shap_exp()
    st.session_state["_ready"] = True

# ── Audit state ───────────────────────────────────────────────────────────────
def _init_state() -> None:
    st.session_state.setdefault("audit", [])
    st.session_state.setdefault("decisions", {})

def _audit(event: str, detail: str, entity: str = "system", colour: str = "#4299E1") -> None:
    st.session_state["audit"].append({
        "id":     str(uuid.uuid4())[:8],
        "ts":     datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "entity": entity,
        "event":  event,
        "detail": detail,
        "colour": colour,
    })

def _save_decision(lookup: str, decision: str, reviewer: str, note: str,
                   override_code: str = "", override_label: str = "") -> None:
    old = st.session_state["decisions"].get(lookup, {}).get("decision", "Unreviewed")
    st.session_state["decisions"][lookup] = {
        "decision":       decision,
        "reviewer":       reviewer,
        "note":           note,
        "override_code":  override_code.strip(),
        "override_label": override_label.strip(),
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    }
    colour = {"Approved":"#48BB78","Rejected":"#FC8181",
               "Escalated":"#9F7AEA","Needs Review":"#ECC94B"}.get(decision, "#718096")
    override_note = f" Override code: {override_code}." if override_code else ""
    _audit(f"Decision → {decision}",
           f"Changed from '{old}'. Reviewer: {reviewer or 'anon'}. Note: {note or '—'}.{override_note}",
           entity=lookup, colour=colour)

# ── CSV parsing ───────────────────────────────────────────────────────────────
_COL = {"lgl_nm_worth":"company_name","lgl_nm_received":"company_name",
        "name":"company_name","business_name":"company_name","company":"company_name",
        "address_1_worth":"address","address":"address","street_address":"address",
        "city_worth":"city","region_worth":"state","zip_code_worth":"zip",
        "country_worth":"country"}

def _parse(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for s, d in _COL.items():
        if s in df.columns and d not in df.columns:
            df[d] = df[s].fillna("").astype(str).str.strip()
    if "company_name" not in df.columns:
        for c in df.columns:
            if any(w in c.lower() for w in ("name","nm","company")):
                df["company_name"] = df[c].fillna("").astype(str).str.strip(); break
    if "company_name" not in df.columns:
        st.error("No company name column."); st.stop()
    for col in ("address","city","state","country"):
        if col not in df.columns: df[col] = ""
    df["country"] = df["country"].where(df["country"].str.strip() != "", "US")
    return df

# ── Fast classification + SHAP ───────────────────────────────────────────────

def _classify_rows(df: pd.DataFrame, compute_shap: bool = True,
                   show_progress: bool = True) -> tuple[pd.DataFrame, list]:
    """
    Returns (results_df, shap_results_list).
    shap_results_list[i] is a ShapResult or None.
    """
    er = _er(); sim = _sim(); ce = _ce(); rev = _re()
    shap_exp = _shap_exp() if compute_shap else None
    n = len(df)
    prog = st.progress(0.0, "Classifying…") if show_progress else None
    t0 = time.time()
    rows, shap_list = [], []

    # US state code → jurisdiction code map
    _US_STATE_JC = {
        "AL":"us_al","AK":"us_ak","AZ":"us_az","AR":"us_ar","CA":"us_ca",
        "CO":"us_co","CT":"us_ct","DE":"us_de","FL":"us_fl","GA":"us_ga",
        "HI":"us_hi","ID":"us_id","IL":"us_il","IN":"us_in","IA":"us_ia",
        "KS":"us_ks","KY":"us_ky","LA":"us_la","ME":"us_me","MD":"us_md",
        "MA":"us_ma","MI":"us_mi","MN":"us_mn","MS":"us_ms","MO":"us_mo",
        "MT":"us_mt","NE":"us_ne","NV":"us_nv","NH":"us_nh","NJ":"us_nj",
        "NM":"us_nm","NY":"us_ny","NC":"us_nc","ND":"us_nd","OH":"us_oh",
        "OK":"us_ok","OR":"us_or","PA":"us_pa","RI":"us_ri","SC":"us_sc",
        "SD":"us_sd","TN":"us_tn","TX":"us_tx","UT":"us_ut","VT":"us_vt",
        "VA":"us_va","WA":"us_wa","WV":"us_wv","WI":"us_wi","WY":"us_wy",
        "DC":"us_dc","PR":"pr",
    }

    for idx, row in df.iterrows():
        name    = str(row.get("company_name","") or "").strip()
        address = str(row.get("address","")      or "").strip()
        country = str(row.get("country","")      or "").strip()
        state   = str(row.get("state","")        or "").strip().upper()
        if not name:
            rows.append({"_error":"empty"}); shap_list.append(None); continue
        try:
            entity = er.resolve(name, address, country or state)

            # If we have a US state code, use the precise state-level jurisdiction
            # (e.g. NJ → us_nj) rather than the country-level 'us'
            jc = entity.jurisdiction_code or "us"
            if state and jc in ("us", "US", "") and state in _US_STATE_JC:
                jc = _US_STATE_JC[state]
            elif state and not jc.startswith("us_") and country.upper() in ("US","USA",""):
                jc = _US_STATE_JC.get(state, jc)

            bundle = sim.fetch(name, address, country or state,
                               jc, "Operating", "")
            cons   = ce.predict(bundle)
            risk   = rev.evaluate(bundle, cons)

            p1   = cons.primary_industry
            sec  = cons.secondary_industries
            sigs = bundle.signals

            src_conf = {s.source: round(s.confidence,4) for s in sigs}
            src_stat = {s.source: s.status for s in sigs}
            src_code = {s.source: s.raw_code for s in sigs}
            src_wt   = {s.source: s.weight for s in sigs}

            best_src  = max(src_conf, key=src_conf.get) if src_conf else "—"
            avg_conf  = round(float(np.mean(list(src_conf.values()))),4) if src_conf else 0
            matched   = sum(1 for c in src_conf.values() if c >= 0.80)
            flags_str = "; ".join(s.flag for s in risk.signals) if risk.signals else "—"
            zi_c = src_conf.get("zoominfo",0); efx_c = src_conf.get("equifax",0)

            row_out = {
                "Company": name, "Clean Name": entity.clean_name,
                "Jurisdiction": jc,   # state-level code (us_nj) when available
                "Entity Type":  entity.detected_entity_type,
                "OC Confidence":  src_conf.get("opencorporates",0),
                "OC Status":      src_stat.get("opencorporates","—"),
                "OC Code":        src_code.get("opencorporates","—"),
                "EFX Confidence": src_conf.get("equifax",0),
                "EFX Status":     src_stat.get("equifax","—"),
                "EFX Code":       src_code.get("equifax","—"),
                "ZI Confidence":  src_conf.get("zoominfo",0),
                "ZI Status":      src_stat.get("zoominfo","—"),
                "ZI Code":        src_code.get("zoominfo","—"),
                "TRU Confidence": src_conf.get("trulioo",0),
                "TRU Status":     src_stat.get("trulioo","—"),
                "TRU Code":       src_code.get("trulioo","—"),
                "LIB Confidence": src_conf.get("liberty_data",0),
                "LIB Status":     src_stat.get("liberty_data","—"),
                "AI Confidence":  src_conf.get("ai_semantic",0),
                "Best Source":    best_src,
                "Avg Confidence": avg_conf,
                "Sources ≥ 0.80": matched,
                "Prod Winner":    "ZoomInfo" if zi_c > efx_c else "Equifax",
                "Prod Confidence":round(max(zi_c,efx_c),4),
                "Prod NAICS":     src_code.get("zoominfo","—") if zi_c > efx_c else src_code.get("equifax","—"),
                "Primary Code":   p1.code,
                "Primary Label":  p1.label,
                "Primary Taxonomy": p1.taxonomy.replace("_"," "),
                "Primary Prob":   round(p1.consensus_probability,4),
                "_signals":       [(s.flag,s.severity,s.description) for s in risk.signals],
                "_sigs_raw":      sigs,
                "_bundle":        bundle,
            }
            for rank in range(1,6):
                all_c = [p1] + list(sec)
                if rank <= len(all_c):
                    c = all_c[rank-1]
                    row_out[f"Rank {rank} Code"]  = c.code
                    row_out[f"Rank {rank} Label"] = c.label
                    row_out[f"Rank {rank} Tax"]   = c.taxonomy.replace("_"," ")
                    row_out[f"Rank {rank} Prob"]  = round(c.consensus_probability,4)
                else:
                    row_out[f"Rank {rank} Code"]  = ""
                    row_out[f"Rank {rank} Label"] = ""
                    row_out[f"Rank {rank} Tax"]   = ""
                    row_out[f"Rank {rank} Prob"]  = 0.0
            row_out.update({
                "Risk Score":  round(risk.overall_risk_score,4),
                "Risk Level":  risk.overall_risk_level,
                "KYB":         risk.kyb_recommendation,
                "AML Flags":   flags_str,
                "AML Count":   len(risk.signals),
            })
            rows.append(row_out)

            # SHAP for this company
            if shap_exp:
                try:
                    sr = shap_exp.explain_single(bundle, top_n=10)
                    shap_list.append(sr)
                except Exception:
                    shap_list.append(None)
            else:
                shap_list.append(None)

        except Exception as exc:
            rows.append({"Company":name,"KYB":"REVIEW",
                         "AML Flags":str(exc)[:120],"_error":str(exc)[:120]})
            shap_list.append(None)

        if prog:
            pos = list(df.index).index(idx)+1
            elapsed = time.time()-t0
            rate = pos/elapsed if elapsed>0 else 999
            eta  = (n-pos)/rate if rate>0 else 0
            if pos%5==0 or pos==n:
                prog.progress(pos/n, text=f"Classifying {pos}/{n} — {rate:.0f}/s — ETA {eta:.0f}s")

    if prog: prog.empty()
    return pd.DataFrame(rows), shap_list

# ── HTML helpers ──────────────────────────────────────────────────────────────

def _prob_bar(rank, code, label, prob, taxonomy):
    pct   = int(prob*100)
    c     = "#48BB78" if pct>=70 else "#ECC94B" if pct>=40 else "#FC8181"
    tag   = "PRIMARY" if rank==1 else f"SECONDARY {rank-1}"
    return (f'<div class="prob-bar-wrap">'
            f'<div style="display:flex;justify-content:space-between;margin-bottom:2px">'
            f'<span style="font-size:10px;font-weight:700;color:#A0AEC0;text-transform:uppercase">{tag}</span>'
            f'<span style="font-size:11px;color:#718096">{taxonomy}</span></div>'
            f'<div style="font-size:15px;font-weight:800;color:#fff;font-family:monospace;letter-spacing:2px;margin-bottom:2px">{code}</div>'
            f'<div style="font-size:13px;color:#CBD5E0;margin-bottom:6px">{label}</div>'
            f'<div class="prob-bar-outer"><div class="prob-bar-inner" style="width:{pct}%;background:{c}">'
            f'<span class="prob-bar-pct">{prob:.0%}</span></div></div></div>')

def _src_card(src_key, conf, status, code):
    col  = SRC_C.get(src_key,"#718096")
    name = src_key.replace("_"," ").title()
    tick = "✅" if conf>=0.80 else "⚠️" if conf>=0.50 else "❌"
    return (f'<div class="src-card" style="border-color:{col}">'
            f'<div style="font-size:10px;color:{col};font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">{name}</div>'
            f'<div style="font-size:26px;font-weight:900;color:#fff;font-family:monospace">{conf:.3f}</div>'
            f'<div style="margin:4px 0"><span style="background:{col};color:#fff;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700">{status}</span>'
            f' <span style="font-size:14px">{tick}</span></div>'
            f'<div style="font-size:11px;color:#A0AEC0;margin-top:4px">{str(code)[:30] if code else "—"}</div></div>')

def _kyb_banner(kyb):
    return (f'<div class="kyb-banner" style="background:{KYB_BG.get(kyb,"#374151")}">'
            f'KYB Recommendation: {kyb}</div>')

def _analyst_card(row, deep=None):
    kyb    = str(row.get("KYB",""))
    prob   = float(row.get("Primary Prob",0))
    avg_c  = float(row.get("Avg Confidence",0))
    matched= int(row.get("Sources ≥ 0.80",0))
    aml_n  = int(row.get("AML Count",0))
    prod_w = str(row.get("Prod Winner",""))
    prod_c = float(row.get("Prod Confidence",0))
    best_s = str(row.get("Best Source",""))
    p_code = str(row.get("Primary Code",""))
    border = KYB_C.get(kyb,"#718096")
    bullets = []
    if matched>=3:
        bullets.append(f"✅ <strong>Strong entity match</strong> — {matched} of 6 sources matched at ≥ 0.80 confidence. Company is well-known in vendor databases.")
    elif matched>=1:
        bullets.append(f"🟡 <strong>Partial entity match</strong> — {matched} source(s) at ≥ 0.80. Company may be small or recently registered.")
    else:
        bullets.append(f"🔴 <strong>Weak entity match</strong> — no source reached 0.80 confidence. Classification based on AI inference. Treat with caution.")
    if best_s in ("opencorporates","liberty_data","trulioo","ai_semantic"):
        bullets.append(f"⚠️ <strong>Production rule gap</strong> — best match from <strong>{best_s.replace('_',' ').title()}</strong> but production rule uses <strong>{prod_w}</strong> (conf {prod_c:.3f}). The production NAICS may use a weaker match.")
    if prob>=0.70:
        bullets.append(f"✅ <strong>High classification confidence ({prob:.0%})</strong> — industry signals are consistent across sources.")
    elif prob>=0.40:
        bullets.append(f"🟡 <strong>Medium confidence ({prob:.0%})</strong> — some source disagreement. Review secondary codes.")
    else:
        bullets.append(f"🔴 <strong>Low confidence ({prob:.0%})</strong> — sources conflict. Manual review required.")
    if kyb in ("ESCALATE","REJECT"):
        bullets.append(f"🚨 <strong>KYB {kyb}</strong> — {aml_n} AML signal(s). Immediate human review required.")
    elif kyb=="REVIEW":
        bullets.append(f"🟡 <strong>KYB REVIEW</strong> — routine analyst review recommended.")
    else:
        bullets.append(f"✅ <strong>KYB APPROVE</strong> — no elevated risk signals.")
    llm = deep.get("llm") if deep else None
    if llm and llm.primary_code:
        agree = llm.primary_code == p_code
        if agree:
            bullets.append(f"✅ <strong>LLM agrees</strong> — GPT-4o-mini independently selected <code>{llm.primary_code}</code>.")
        else:
            bullets.append(f"⚠️ <strong>LLM diverges</strong> — GPT-4o-mini selected <code>{llm.primary_code}</code> ({llm.primary_label}) vs Consensus <code>{p_code}</code>.")
    bhtml = "".join(f"<li style='margin-bottom:8px'>{b}</li>" for b in bullets)
    return (f'<div class="interp-card" style="border-color:{border}">'
            f'<div style="font-size:13px;font-weight:700;color:{border};text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">🧠 Analyst Interpretation</div>'
            f'<ul style="color:#E2E8F0;font-size:13px;line-height:1.7;padding-left:18px;margin:0">{bhtml}</ul></div>')

# ── SHAP rendering ────────────────────────────────────────────────────────────

def _render_shap_single(sr, company_name: str = "") -> None:
    """Render SHAP explanation for one company."""
    from shap_explainer import FEATURE_INTERPRETATIONS

    if sr is None:
        st.warning("SHAP explanation not available for this company.")
        return

    st.markdown(f"**Code:** `{sr.predicted_class}` — predicted with **{sr.predicted_prob:.0%}** confidence")
    st.markdown(sr.plain_english)
    st.divider()

    # Horizontal bar chart — top contributors
    n_show = min(15, len(sr.feature_names))
    pairs  = sorted(zip(sr.feature_names, sr.shap_values),
                    key=lambda x: abs(x[1]), reverse=True)[:n_show]
    names  = [FEATURE_INTERPRETATIONS.get(n, n)[:45] for n, _ in pairs]
    values = [v for _, v in pairs]
    colours = ["#FC8181" if v > 0 else "#4299E1" for v in values]

    fig = go.Figure(go.Bar(
        x=values, y=names, orientation="h",
        marker_color=colours, opacity=0.85,
        text=[f"{v:+.3f}" for v in values],
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>SHAP: %{x:+.4f}<extra></extra>",
    ))
    fig.add_vline(x=0, line_color="white", line_width=1)
    fig.update_layout(
        title=f"SHAP Feature Contributions → '{sr.predicted_class}'",
        xaxis_title="SHAP value (log-odds contribution)",
        yaxis=dict(autorange="reversed"),
        template="plotly_dark", height=420,
        margin=dict(t=50,b=20,l=10,r=60),
        annotations=[dict(
            x=0.01, y=1.02, xref="paper", yref="paper",
            text="🔴 Pushes toward this class   🔵 Pushes away",
            showarrow=False, font=dict(size=11, color="#A0AEC0"),
        )],
    )
    st.plotly_chart(fig, use_container_width=True)

    # ── Analyst interpretation of the SHAP chart ──────────────────────────────
    from shap_explainer import FEATURE_INTERPRETATIONS

    # Separate positive and negative contributors
    pos_pairs = [(FEATURE_INTERPRETATIONS.get(n, n), v, fv)
                 for (n, _), v, fv in zip(pairs, values,
                     [sr.feature_values[sr.feature_names.index(n)]
                      for n, _ in pairs])
                 if v > 0]
    neg_pairs = [(FEATURE_INTERPRETATIONS.get(n, n), v, fv)
                 for (n, _), v, fv in zip(pairs, values,
                     [sr.feature_values[sr.feature_names.index(n)]
                      for n, _ in pairs])
                 if v < 0]

    # Build interpretation text
    interp_bullets = []

    # How to read this chart — always shown
    interp_bullets.append(
        "📊 <strong>How to read this chart:</strong> Each bar represents one input feature. "
        "<span style='color:#FC8181'>Red bars (pointing right)</span> push the model "
        "<strong>toward</strong> classifying this company as NAICS <code>"
        f"{sr.predicted_class}</code>. "
        "<span style='color:#4299E1'>Blue bars (pointing left)</span> push the model "
        "<strong>away</strong> from this code. "
        "The longer the bar, the stronger the influence. "
        "The numbers are in <em>log-odds units</em> — a value of +0.5 roughly doubles "
        "the model's probability for this code; −0.5 roughly halves it."
    )

    # Base rate
    interp_bullets.append(
        f"⚖️ <strong>Starting point (base rate):</strong> Before looking at any features, "
        f"the model assigns a small baseline probability to every possible code equally. "
        f"The SHAP values show how each feature <em>shifts</em> that starting probability "
        f"up or down to reach the final {sr.predicted_prob:.0%} confidence."
    )

    # Top positive drivers
    if pos_pairs:
        top3_pos = pos_pairs[:3]
        pos_bullets = []
        for name, sv, fv in top3_pos:
            pos_bullets.append(
                f"<strong>{name}</strong> (value: {fv:.3f}) → "
                f"<span style='color:#FC8181'>+{sv:.3f}</span> — "
                f"this feature strongly signals that <code>{sr.predicted_class}</code> "
                f"is the correct code"
            )
        interp_bullets.append(
            "🔴 <strong>Strongest signals FOR this classification:</strong><ul style='margin:4px 0'>"
            + "".join(f"<li style='margin:3px 0'>{b}</li>" for b in pos_bullets)
            + "</ul>"
        )

    # Top negative drivers
    if neg_pairs:
        top3_neg = neg_pairs[:3]
        neg_bullets = []
        for name, sv, fv in top3_neg:
            neg_bullets.append(
                f"<strong>{name}</strong> (value: {fv:.3f}) → "
                f"<span style='color:#4299E1'>{sv:.3f}</span> — "
                f"this feature suggests the company may belong to a <em>different</em> industry code"
            )
        interp_bullets.append(
            "🔵 <strong>Signals pushing AGAINST this classification:</strong><ul style='margin:4px 0'>"
            + "".join(f"<li style='margin:3px 0'>{b}</li>" for b in neg_bullets)
            + "</ul>"
        )

    # Confidence interpretation
    total_positive = sum(v for v in values if v > 0)
    total_negative = abs(sum(v for v in values if v < 0))
    net = total_positive - total_negative
    if net > 0.5:
        conf_interp = (
            f"✅ <strong>Strong net positive signal ({net:+.3f} net log-odds).</strong> "
            f"The model has clear, consistent reasons for this classification. "
            f"High confidence ({sr.predicted_prob:.0%}) is well-supported."
        )
    elif net > 0:
        conf_interp = (
            f"🟡 <strong>Moderate net signal ({net:+.3f} net log-odds).</strong> "
            f"The model leans toward this code but there are meaningful counter-signals. "
            f"Review the secondary codes before finalising."
        )
    else:
        conf_interp = (
            f"🔴 <strong>Weak or negative net signal ({net:+.3f} net log-odds).</strong> "
            f"Counter-signals are strong. The model is not confident this is the right code. "
            f"Manual review required."
        )
    interp_bullets.append(conf_interp)

    # Special flag: if high-risk sector is top driver
    top_feat_name = pairs[0][0] if pairs else ""
    if "risk" in top_feat_name.lower() or "aml" in top_feat_name.lower():
        interp_bullets.append(
            "🚨 <strong>AML signal is the dominant driver.</strong> "
            "The model classified this code partly because of a high-risk sector flag, "
            "not just because the vendor codes agree. "
            "Verify the actual business activity independently."
        )

    bhtml = "".join(f"<li style='margin-bottom:10px'>{b}</li>" for b in interp_bullets)
    st.markdown(
        f'<div class="interp-card" style="border-color:#9F7AEA;margin-top:4px">'
        f'<div style="font-size:13px;font-weight:700;color:#9F7AEA;text-transform:uppercase;'
        f'letter-spacing:.5px;margin-bottom:12px">🔬 SHAP Chart — How to Read & Interpret</div>'
        f'<ul style="color:#E2E8F0;font-size:13px;line-height:1.8;padding-left:18px;margin:0">'
        f'{bhtml}</ul></div>',
        unsafe_allow_html=True,
    )
    st.divider()

    # Waterfall chart
    # Take top 8 by abs value, rest collapsed into "Other features"
    top8   = sorted(zip(sr.feature_names, sr.shap_values), key=lambda x: abs(x[1]), reverse=True)[:8]
    rest   = sum(v for _, v in zip(sr.feature_names, sr.shap_values)) - sum(v for _, v in top8)
    wf_labels = [FEATURE_INTERPRETATIONS.get(n,n)[:30] for n,_ in top8] + ["Other features","Final prediction"]
    wf_vals   = [v for _,v in top8] + [rest, None]
    fig_wf = go.Figure(go.Waterfall(
        name="SHAP", orientation="v",
        measure=["relative"]*9 + ["total"],
        x=wf_labels,
        y=wf_vals,
        connector={"line":{"color":"#718096"}},
        decreasing={"marker":{"color":"#4299E1"}},
        increasing={"marker":{"color":"#FC8181"}},
        totals={"marker":{"color":"#48BB78"}},
        text=[f"{v:+.3f}" if v is not None else "" for v in wf_vals],
        textposition="outside",
    ))
    fig_wf.update_layout(
        title="SHAP Waterfall — How features combine to reach the prediction",
        template="plotly_dark", height=380,
        margin=dict(t=50,b=80,l=20,r=20),
        yaxis_title="Log-odds contribution",
    )
    st.plotly_chart(fig_wf, use_container_width=True)

    # Feature value table
    with st.expander("Feature values and SHAP contributions — full table"):
        feat_df = pd.DataFrame({
            "Feature": [FEATURE_INTERPRETATIONS.get(n,n) for n in sr.feature_names],
            "Value":   [round(v,4) for v in sr.feature_values],
            "SHAP":    [round(v,4) for v in sr.shap_values],
        }).sort_values("SHAP", key=abs, ascending=False)
        st.dataframe(feat_df, use_container_width=True, hide_index=True)


def _render_shap_batch(batch_result) -> None:
    """Render global SHAP importance for a batch."""
    if batch_result is None:
        st.warning("SHAP batch explanation not available.")
        return

    from shap_explainer import FEATURE_INTERPRETATIONS

    # Global importance bar chart
    top20 = batch_result.top_global_features[:20]
    names  = [FEATURE_INTERPRETATIONS.get(n,n)[:45] for n,_ in top20]
    values = [v for _,v in top20]
    fig = px.bar(
        x=values, y=names, orientation="h",
        title="Global Feature Importance — Mean |SHAP| across all companies and classes",
        labels={"x":"Mean |SHAP|","y":"Feature"},
        template="plotly_dark", height=500,
        color=values, color_continuous_scale="Reds",
    )
    fig.update_layout(yaxis=dict(autorange="reversed"),
                      margin=dict(t=50,b=20,l=10,r=20),
                      coloraxis_showscale=False)
    st.plotly_chart(fig, use_container_width=True)

    st.markdown("**Interpretation:** Features with the highest mean |SHAP| value have the most influence "
                "on the model's industry classification decisions across all companies in this batch.")
    st.markdown("""
| Feature group | What high importance means |
|---|---|
| Source confidence/match flags | The model relies heavily on which sources confirmed the entity |
| Majority code agreement | When sources agree on the code, the model is more decisive |
| Web↔Registry distance | Shell company signal — high distance pulls the model toward holding/investment codes |
| Temporal pivot score | AML signal — frequent code changes influence the model's risk-awareness |
| Jurisdiction flags | The model correctly routes taxonomy (NAICS vs UK SIC vs NACE) by country |
""")

    # Per-company uncertainty (companies where max |SHAP| is lowest = model least certain why)
    if batch_result.per_company:
        uncertainties = [
            (sr.predicted_class, sr.predicted_prob, max(abs(v) for v in sr.shap_values))
            for sr in batch_result.per_company if sr
        ]
        if uncertainties:
            unc_df = pd.DataFrame(uncertainties, columns=["Predicted Code","Prob","Max |SHAP|"])
            unc_df = unc_df.sort_values("Max |SHAP|").head(10)
            st.markdown("**10 companies with lowest SHAP signal strength** — model is least certain why it classified these:")
            st.dataframe(unc_df, use_container_width=True, hide_index=True)

# ── Decision panel ────────────────────────────────────────────────────────────

def _render_decision_panel(lookup: str) -> None:
    current = st.session_state["decisions"].get(lookup, {})
    st.markdown('<div class="dec-panel">', unsafe_allow_html=True)
    st.markdown("**📋 Analyst Review Decision**")

    # Row 1 — decision + reviewer + timestamp
    c1, c2, c3 = st.columns([2, 2, 2])
    with c1:
        dec = st.selectbox(
            "Decision", DECISION_OPTIONS,
            index=DECISION_OPTIONS.index(current.get("decision", "Unreviewed")),
            key=f"dec_{lookup}",
        )
    with c2:
        rev = st.text_input("Reviewer name", value=current.get("reviewer", ""),
                            key=f"rev_{lookup}")
    with c3:
        st.markdown("")
        st.markdown(f"**Last saved:** {current.get('ts', '—')}")

    # Row 2 — override code + label (analyst correction)
    ov_col1, ov_col2 = st.columns(2)
    with ov_col1:
        override_code = st.text_input(
            "Override industry code (optional)",
            value=current.get("override_code", ""),
            placeholder="e.g. 541511",
            help="Enter the correct 6-digit NAICS or SIC code if the model is wrong.",
            key=f"ov_code_{lookup}",
        )
    with ov_col2:
        override_label = st.text_input(
            "Override label (optional)",
            value=current.get("override_label", ""),
            placeholder="e.g. Custom Computer Programming Services",
            key=f"ov_label_{lookup}",
        )

    # Row 3 — notes
    note = st.text_area(
        "Analyst notes — corrections, reasoning, flags (will appear in Full Results Table)",
        value=current.get("note", ""),
        height=80,
        key=f"note_{lookup}",
    )

    if st.button("💾 Save Decision", key=f"save_{lookup}", use_container_width=True):
        _save_decision(lookup, dec, rev, note, override_code, override_label)
        st.success(f"Decision saved: {dec}")

    # Show current saved values if any
    if current.get("override_code"):
        st.caption(f"Current override: `{current['override_code']}` — {current.get('override_label','')}")

    st.markdown("</div>", unsafe_allow_html=True)

# ── Main render (shared by single + batch) ───────────────────────────────────

def _render(result_df: pd.DataFrame, shap_list: list, deep: dict | None = None) -> None:
    single = len(result_df) == 1
    row    = result_df.iloc[0] if single else None
    sr0    = shap_list[0] if shap_list else None
    n      = len(result_df)
    ok_df  = result_df[~result_df.get("_error", pd.Series(dtype=str)).notna()].copy() \
             if "_error" in result_df.columns else result_df.copy()

    tabs = st.tabs([
        "📊 Summary & Interpretation",
        "🔍 Level 1 — Source Confidences",
        "🏭 Level 2 — Classification",
        "🧠 SHAP Explainability",
        "🕵️ Record Explorer",
        "📋 Full Results Table",
        "📥 Download",
    ])
    tab_sum, tab_l1, tab_l2, tab_shap, tab_rec, tab_table, tab_dl = tabs

    # ══ SUMMARY ══════════════════════════════════════════════════════════════
    with tab_sum:
        if single and row is not None:
            st.markdown(_kyb_banner(str(row.get("KYB",""))), unsafe_allow_html=True)
            m1,m2,m3,m4,m5,m6 = st.columns(6)
            m1.metric("Primary Code",   str(row.get("Primary Code","")))
            m2.metric("Taxonomy",       str(row.get("Primary Taxonomy","")))
            m3.metric("Probability",    f"{float(row.get('Primary Prob',0)):.0%}")
            m4.metric("Risk Score",     f"{float(row.get('Risk Score',0)):.3f}")
            m5.metric("Risk Level",     str(row.get("Risk Level","")))
            m6.metric("Sources ≥ 0.80", str(row.get("Sources ≥ 0.80",0)))
            st.divider()
            st.markdown(_analyst_card(row, deep), unsafe_allow_html=True)
        else:
            kyb_d = ok_df["KYB"].value_counts().to_dict() if "KYB" in ok_df.columns else {}
            prob_c = pd.to_numeric(ok_df.get("Primary Prob", pd.Series()), errors="coerce")
            aml_a  = int((ok_df.get("AML Count",pd.Series(dtype=int)) > 0).sum())
            c1,c2,c3,c4,c5,c6 = st.columns(6)
            c1.metric("Total", n)
            c2.metric("APPROVE",         kyb_d.get("APPROVE",0))
            c3.metric("REVIEW",          kyb_d.get("REVIEW",0))
            c4.metric("ESCALATE/REJECT", kyb_d.get("ESCALATE",0)+kyb_d.get("REJECT",0))
            c5.metric("Avg Probability", f"{prob_c.mean():.0%}" if not prob_c.empty else "—")
            c6.metric("AML Flagged",     aml_a)
            st.divider()
            ca,cb,cc = st.columns(3)
            with ca:
                if not prob_c.empty:
                    fig = go.Figure(go.Histogram(x=prob_c,nbinsx=20,marker_color="#48BB78",opacity=0.85))
                    fig.add_vline(x=0.70,line_dash="dash",line_color="white",annotation_text="70%")
                    fig.add_vline(x=0.40,line_dash="dash",line_color="#ECC94B",annotation_text="40%")
                    fig.update_layout(title="Consensus Probability",xaxis_title="Probability",
                                      yaxis_title="Companies",template="plotly_dark",
                                      height=270,margin=dict(t=40,b=20,l=20,r=10))
                    st.plotly_chart(fig,use_container_width=True)
            with cb:
                if kyb_d:
                    order = ["APPROVE","REVIEW","ESCALATE","REJECT"]
                    fig2  = px.bar(x=order,y=[kyb_d.get(k,0) for k in order],color=order,
                                   color_discrete_map=KYB_C,template="plotly_dark",height=270,
                                   title="KYB",labels={"x":"","y":"Companies"})
                    fig2.update_layout(showlegend=False,margin=dict(t=40,b=20,l=20,r=10))
                    st.plotly_chart(fig2,use_container_width=True)
            with cc:
                src_means = {}
                for lbl,col in [("OC","OC Confidence"),("EFX","EFX Confidence"),
                                 ("ZI","ZI Confidence"),("Trulioo","TRU Confidence"),
                                 ("Liberty","LIB Confidence")]:
                    if col in ok_df.columns:
                        v = pd.to_numeric(ok_df[col],errors="coerce").mean()
                        if not np.isnan(v): src_means[lbl] = round(v,3)
                if src_means:
                    fig3 = px.bar(x=list(src_means.keys()),y=list(src_means.values()),
                                  color=list(src_means.keys()),template="plotly_dark",height=270,
                                  title="Avg Level 1 Confidence",
                                  color_discrete_sequence=["#68D391","#4299E1","#F6E05E","#9F7AEA","#FC8181"])
                    fig3.add_hline(y=0.80,line_dash="dash",line_color="white")
                    fig3.update_layout(showlegend=False,margin=dict(t=40,b=20,l=20,r=10))
                    st.plotly_chart(fig3,use_container_width=True)
            # AML breakdown
            if "AML Flags" in ok_df.columns:
                all_flags = [f.strip() for r in ok_df["AML Flags"]
                             for f in str(r).split(";") if f.strip() and f.strip()!="—"]
                if all_flags:
                    st.markdown("#### AML Signal Breakdown")
                    st.dataframe(pd.DataFrame(Counter(all_flags).most_common(),
                                              columns=["Signal","Count"]),
                                 use_container_width=True, hide_index=True)
            # High-risk callout
            if "Risk Level" in ok_df.columns:
                hi = ok_df[ok_df["Risk Level"].isin(["HIGH","CRITICAL"])]
                if not hi.empty:
                    st.markdown(f"#### ⚠️ {len(hi)} companies — HIGH / CRITICAL risk")
                    show = [c for c in ["Company","Jurisdiction","Primary Code","Primary Label",
                                        "Primary Prob","Risk Score","KYB","AML Flags"] if c in hi.columns]
                    st.dataframe(hi[show].sort_values("Risk Score",ascending=False),
                                 use_container_width=True,hide_index=True)

    # ══ LEVEL 1 ══════════════════════════════════════════════════════════════
    with tab_l1:
        st.markdown("""
**Level 1 XGBoost entity matching** — same model (`entity_matching_20250127 v1`) as in production.  
Outputs a match confidence 0–1 per source using 33 pairwise text/address similarity features.

| Status | Meaning |
|---|---|
| **MATCHED** | Record found in vendor DB with ≥ 0.80 confidence |
| **INFERRED** | Derived from jurisdiction / entity type — no direct vendor match |
| **CONFLICT** | Code returned but contradicts other sources |
| **POLLUTED** | Trulioo returned 4-digit SIC for 5-digit jurisdiction (data quality) |
| **UNAVAILABLE** | Source did not return a result |

> **Production rule:** only ZoomInfo vs Equifax compared for the NAICS code.
> OC, Liberty, Trulioo industry codes are ignored by the current pipeline.
""")
        if single and row is not None:
            sigs = row.get("_sigs_raw",[])
            cols = st.columns(min(len(sigs),3)) if sigs else []
            for i, sig in enumerate(sigs):
                with cols[i%len(cols)] if cols else st:
                    st.markdown(_src_card(sig.source, sig.confidence, sig.status, sig.raw_code), unsafe_allow_html=True)
            if sigs:
                labels  = [s.source.replace("_"," ").title() for s in sigs]
                values  = [s.confidence for s in sigs]
                colours = [SRC_C.get(s.source,"#718096") for s in sigs]
                statuses= [s.status for s in sigs]
                fig = go.Figure(go.Bar(x=labels,y=values,marker_color=colours,
                    text=[f"{v:.3f}<br>{st_}" for v,st_ in zip(values,statuses)],
                    textposition="outside"))
                fig.add_hline(y=0.80,line_dash="dash",line_color="white",
                              annotation_text="0.80 threshold",annotation_position="top right")
                fig.update_layout(title="Level 1 Match Confidence by Source",yaxis=dict(range=[0,1.15]),
                                  template="plotly_dark",height=320,margin=dict(t=40,b=20),showlegend=False)
                st.plotly_chart(fig,use_container_width=True)
        else:
            src_cols = {k:v for k,v in [("OC","OC Confidence"),("EFX","EFX Confidence"),
                        ("ZI","ZI Confidence"),("Trulioo","TRU Confidence"),("Liberty","LIB Confidence")]
                        if v in ok_df.columns}
            if src_cols:
                # Box plots per source — shows distribution, median, spread, outliers
                conf_long = []
                for lbl, col in src_cols.items():
                    vals = pd.to_numeric(ok_df[col], errors="coerce").dropna()
                    for v in vals:
                        conf_long.append({"Source": lbl, "Confidence": float(v)})
                if conf_long:
                    bp_df = pd.DataFrame(conf_long)
                    src_order = list(src_cols.keys())
                    src_colours = {
                        "OC":      "#68D391",
                        "EFX":     "#4299E1",
                        "ZI":      "#F6E05E",
                        "Trulioo": "#9F7AEA",
                        "Liberty": "#FC8181",
                    }
                    fig_bp = go.Figure()
                    for src in src_order:
                        sub = bp_df[bp_df["Source"] == src]["Confidence"]
                        fig_bp.add_trace(go.Box(
                            y=sub, name=src,
                            marker_color=src_colours.get(src, "#718096"),
                            boxmean="sd",
                            hovertemplate=f"<b>{src}</b><br>Confidence: %{{y:.3f}}<extra></extra>",
                        ))
                    fig_bp.add_hline(y=0.80, line_dash="dash", line_color="white",
                                     annotation_text="0.80 threshold",
                                     annotation_position="top right")
                    fig_bp.update_layout(
                        title="Level 1 Confidence Distribution by Source<br>"
                              "<sub>Box = IQR · Line = median · Dot = mean · Whiskers = 1.5×IQR</sub>",
                        yaxis=dict(title="Confidence Score", range=[0, 1.05]),
                        template="plotly_dark", height=360,
                        margin=dict(t=60, b=20, l=40, r=10),
                        showlegend=False,
                    )
                    st.plotly_chart(fig_bp, use_container_width=True)
                    st.caption(
                        "How to read: A high median (line inside box) means that source generally finds "
                        "good matches. A wide box means high variability — the source is very confident "
                        "on some companies but weak on others. Points above the whiskers are outliers."
                    )
            import jurisdiction_registry as _JR
            def _jur_label(jc: str) -> str:
                rec = _JR.lookup(str(jc or "").lower().strip())
                label = rec.label if rec else ""
                return f"{jc} — {label}" if label and label != jc else str(jc)

            l1_df = ok_df.copy()
            if "Jurisdiction" in l1_df.columns:
                l1_df["Jurisdiction"] = l1_df["Jurisdiction"].apply(_jur_label)
            l1_cols = [c for c in [
                "Company","Jurisdiction",
                "OC Confidence","OC Status","OC Code",
                "EFX Confidence","EFX Status","EFX Code",
                "ZI Confidence","ZI Status","ZI Code",
                "TRU Confidence","TRU Status","LIB Confidence","LIB Status",
                "Best Source","Avg Confidence","Sources ≥ 0.80",
                "Prod Winner","Prod Confidence","Prod NAICS",
            ] if c in l1_df.columns]
            st.dataframe(l1_df[l1_cols], use_container_width=True, hide_index=True)

    # ══ LEVEL 2 ══════════════════════════════════════════════════════════════
    with tab_l2:
        st.markdown("""
**Consensus Level 2 XGBoost** — uses all 6 source confidence scores + vendor industry codes
as a **45-feature vector** → calibrated probabilities across all industry codes.
""")
        if single and row is not None:
            c_codes, c_kyb = st.columns([3,2])
            with c_codes:
                st.markdown("#### Top-5 Industry Codes")
                bars = "".join(_prob_bar(r, str(row.get(f"Rank {r} Code","")),
                                         str(row.get(f"Rank {r} Label","")),
                                         float(row.get(f"Rank {r} Prob",0)),
                                         str(row.get(f"Rank {r} Tax","")))
                               for r in range(1,6) if row.get(f"Rank {r} Code"))
                st.markdown(bars, unsafe_allow_html=True)
                if deep and deep.get("llm") and deep["llm"].primary_code:
                    llm = deep["llm"]
                    st.markdown(f"**GPT-4o-mini:** `{llm.primary_code}` — {llm.primary_label} ({llm.primary_confidence})")
            with c_kyb:
                st.markdown("#### AML / KYB Risk Signals")
                sigs_raw = row.get("_signals",[])
                if sigs_raw:
                    for flag,sev,desc in sigs_raw:
                        sc = RISK_C.get(sev,"#718096")
                        st.markdown(f'<div style="border-left:4px solid {sc};padding:8px 12px;'
                                    f'margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:0 6px 6px 0">'
                                    f'<span style="font-weight:700;color:{sc}">{sev}</span> — '
                                    f'<span style="font-weight:600">{flag}</span><br>'
                                    f'<span style="font-size:12px;color:#A0AEC0">{desc}</span></div>',
                                    unsafe_allow_html=True)
                else:
                    st.success("✅ No AML signals")
                if deep:
                    ext = deep.get("ext")
                    if ext and ext.edgar:
                        st.markdown(f"**SEC EDGAR:** SIC `{ext.edgar.sic}` — {ext.edgar.sic_description}")
                    if ext and ext.companies_house:
                        for c,d in zip(ext.companies_house.sic_codes, ext.companies_house.sic_descriptions):
                            st.markdown(f"**Companies House:** SIC `{c}` — {d}")
        else:
            ca,cb = st.columns(2)
            with ca:
                if "Primary Taxonomy" in ok_df.columns:
                    tc = ok_df["Primary Taxonomy"].value_counts().reset_index(); tc.columns=["Taxonomy","Count"]
                    fig_t = px.pie(tc,names="Taxonomy",values="Count",title="Primary Taxonomy Distribution",
                                   template="plotly_dark",height=300)
                    fig_t.update_layout(margin=dict(t=40,b=10))
                    st.plotly_chart(fig_t,use_container_width=True)
            with cb:
                if "Primary Code" in ok_df.columns:
                    top = ok_df["Primary Code"].value_counts().head(10).reset_index(); top.columns=["Code","Count"]
                    fig_c = px.bar(top,x="Count",y="Code",orientation="h",
                                   title="Top-10 Primary Codes",template="plotly_dark",height=300)
                    fig_c.update_layout(margin=dict(t=40,b=10,l=80))
                    st.plotly_chart(fig_c,use_container_width=True)
            # Enrich jurisdiction column with human-readable label
            import jurisdiction_registry as _JR
            def _jur_label(jc: str) -> str:
                rec = _JR.lookup(str(jc or "").lower().strip())
                label = rec.label if rec else ""
                return f"{jc} — {label}" if label and label != jc else str(jc)

            l2_df = ok_df.copy()
            if "Jurisdiction" in l2_df.columns:
                l2_df["Jurisdiction"] = l2_df["Jurisdiction"].apply(_jur_label)
            l2_cols = [c for c in [
                "Company", "Jurisdiction",
                "Rank 1 Code","Rank 1 Label","Rank 1 Tax","Rank 1 Prob",
                "Rank 2 Code","Rank 2 Label","Rank 2 Prob",
                "Rank 3 Code","Rank 3 Label","Rank 3 Prob",
                "Risk Score","Risk Level","KYB","AML Flags",
            ] if c in l2_df.columns]
            st.dataframe(l2_df[l2_cols], use_container_width=True, hide_index=True)

    # ══ SHAP ═════════════════════════════════════════════════════════════════
    with tab_shap:
        st.subheader("🧠 SHAP Explainability — Why did the model predict this?")
        st.markdown("""
**SHAP (SHapley Additive exPlanations)** decomposes each prediction into feature contributions.

- 🔴 **Positive SHAP** — feature pushes the model **toward** this industry code
- 🔵 **Negative SHAP** — feature pushes the model **away** from this code
- The sum of all SHAP values + the base value = the model's log-odds prediction

SHAP is computed using `shap.TreeExplainer` on the Consensus XGBoost model — exact, not approximate.
""")
        if single:
            _render_shap_single(sr0, str(row.get("Company","")) if row is not None else "")
        else:
            # Batch — show global importance first, then per-company selector
            batch_shap = st.session_state.get("_batch_shap")
            if batch_shap:
                _render_shap_batch(batch_shap)
                st.divider()
                st.markdown("#### Per-Company SHAP Explanation")
                companies = ok_df["Company"].tolist() if "Company" in ok_df.columns else []
                sel = st.selectbox("Select company", companies, key="shap_company_sel")
                sel_idx = companies.index(sel) if sel in companies else 0
                sr_sel  = batch_shap.per_company[sel_idx] if sel_idx < len(batch_shap.per_company) else None
                _render_shap_single(sr_sel, sel)
            else:
                st.info("SHAP batch results not yet available. Run classification first.")

    # ══ RECORD EXPLORER ══════════════════════════════════════════════════════
    with tab_rec:
        st.subheader("🕵️ Record Explorer — Investigation View")
        st.caption("Full multi-source candidate comparison, field-level evidence, SHAP explainability, and analyst decision.")

        companies = ok_df["Company"].tolist() if "Company" in ok_df.columns else []
        if not companies:
            st.info("No records to explore.")
        else:
            # ── Company selector + navigation ─────────────────────────────────
            nav1, sel_col, nav2 = st.columns([1, 5, 1])
            with sel_col:
                sel_comp = st.selectbox("Select company", companies, key="rec_explorer_sel",
                                        label_visibility="collapsed")
            sel_idx = companies.index(sel_comp) if sel_comp in companies else 0
            sel_row = ok_df.iloc[sel_idx]
            sel_sr  = shap_list[sel_idx] if sel_idx < len(shap_list) else None
            with nav1:
                if sel_idx > 0 and st.button("← Prev", key="rec_prev"):
                    st.session_state["rec_explorer_sel"] = companies[sel_idx - 1]
            with nav2:
                if sel_idx < len(companies) - 1 and st.button("Next →", key="rec_next"):
                    st.session_state["rec_explorer_sel"] = companies[sel_idx + 1]
            st.caption(f"Record {sel_idx + 1} of {len(companies)}")

            _audit("Record Opened", "Viewed in Record Explorer", entity=sel_comp, colour="#4299E1")

            # ── A. Entity summary ─────────────────────────────────────────────
            st.markdown("### 🏢 Entity Summary")
            col_name, col_jur, col_loc = st.columns(3)
            col_name.metric("Entity Name", sel_comp)
            col_jur.metric("Jurisdiction",  str(sel_row.get("Jurisdiction", "—")))
            col_loc.metric("Entity Type",   str(sel_row.get("Entity Type", "—")))

            cur_dec = st.session_state["decisions"].get(sel_comp, {})
            dec_text = cur_dec.get("decision", "Unreviewed")
            dec_col  = DEC_C.get(dec_text, "#718096")
            st.markdown(
                f'<span style="background:{dec_col};color:white;padding:3px 12px;border-radius:999px;'
                f'font-size:12px;font-weight:700">Current decision: {dec_text}</span>',
                unsafe_allow_html=True,
            )

            # ── B. Consensus banner (entity matching consensus) ───────────────
            src_conf_vals = {
                "OC":      float(sel_row.get("OC Confidence",  0) or 0),
                "EFX":     float(sel_row.get("EFX Confidence", 0) or 0),
                "ZI":      float(sel_row.get("ZI Confidence",  0) or 0),
                "Trulioo": float(sel_row.get("TRU Confidence", 0) or 0),
                "Liberty": float(sel_row.get("LIB Confidence", 0) or 0),
            }
            valid_c = [v for v in src_conf_vals.values() if v > 0]
            max_c   = max(valid_c) if valid_c else 0
            avg_c   = float(np.mean(valid_c)) if valid_c else 0
            n_high  = sum(1 for v in valid_c if v >= 0.80)
            spread  = (max(valid_c) - min(valid_c)) if len(valid_c) >= 2 else 0

            if n_high >= 3:
                banner_cls, banner_txt, banner_act = "consensus-full",    "Full Consensus",    "Auto-Approve Candidate"
            elif n_high >= 2:
                banner_cls, banner_txt, banner_act = "consensus-partial", "Partial Consensus", "Analyst Review Recommended"
            elif n_high == 1:
                banner_cls, banner_txt, banner_act = "consensus-weak",    "Weak Consensus",    "Analyst Review Recommended"
            elif spread >= 0.30:
                banner_cls, banner_txt, banner_act = "consensus-conflict","Conflicting Results","Escalate Due to Conflict"
            else:
                banner_cls, banner_txt, banner_act = "consensus-none",    "No Reliable Match", "No Match Recommended"

            st.markdown(
                f'<div class="consensus-banner {banner_cls}">'
                f'📊 Entity Matching Consensus: <strong>{banner_txt}</strong> &nbsp;|&nbsp; '
                f'Recommended: <strong>{banner_act}</strong> &nbsp;|&nbsp; '
                f'Max conf: {max_c:.3f} &nbsp;|&nbsp; Avg conf: {avg_c:.3f}'
                f'</div>',
                unsafe_allow_html=True,
            )

            st.divider()

            # ── C. Multi-source candidate comparison ──────────────────────────
            st.markdown("### 🔍 Multi-Source Candidate Comparison")
            st.caption("Each card shows the Level 1 XGBoost confidence for this source, the industry code returned, reason codes, and field comparison.")

            SRC_PAIRS = [
                ("opencorporates", "OC",  "OC Confidence",  "OC Status",  "OC Code",  "#68D391"),
                ("equifax",        "EFX", "EFX Confidence", "EFX Status", "EFX Code", "#4299E1"),
                ("zoominfo",       "ZI",  "ZI Confidence",  "ZI Status",  "ZI Code",  "#F6E05E"),
                ("trulioo",        "TRU", "TRU Confidence", "TRU Status", "TRU Code", "#9F7AEA"),
                ("liberty_data",   "LIB", "LIB Confidence", "LIB Status", "",         "#FC8181"),
            ]
            src_tabs_inv = st.tabs([lbl for _, lbl, *_ in SRC_PAIRS])
            for (src_key, lbl, conf_col, stat_col, code_col, colour), src_tab in zip(SRC_PAIRS, src_tabs_inv):
                with src_tab:
                    conf   = float(sel_row.get(conf_col, 0) or 0)
                    status = str(sel_row.get(stat_col, "—") or "—")
                    code   = str(sel_row.get(code_col, "—") or "—") if code_col else "—"
                    tick   = "✅" if conf >= 0.80 else "⚠️" if conf >= 0.50 else "❌"
                    band_lbl = ("Very High" if conf >= 0.95 else "High" if conf >= 0.85
                                else "Medium" if conf >= 0.70 else "Low" if conf >= 0.50 else "Very Low")

                    # Source card header
                    st.markdown(
                        f'<div style="border:2px solid {colour};border-radius:10px;padding:14px 18px;'
                        f'background:rgba(255,255,255,0.04);margin-bottom:12px">'
                        f'<div style="font-size:10px;color:{colour};font-weight:700;text-transform:uppercase;'
                        f'letter-spacing:.8px;margin-bottom:6px">{lbl}</div>'
                        f'<div style="font-size:30px;font-weight:900;color:#fff;font-family:monospace">{conf:.3f}</div>'
                        f'<div style="margin:6px 0">'
                        f'<span style="background:{colour};color:#000;padding:2px 10px;border-radius:20px;'
                        f'font-size:11px;font-weight:700">{band_lbl}</span>'
                        f' <span style="font-size:16px">{tick}</span>'
                        f'<span style="font-size:11px;color:#A0AEC0;margin-left:10px">Status: {status}</span></div>'
                        f'<div style="font-size:12px;color:#A0AEC0">Industry code: <code>{code}</code></div>'
                        f'</div>',
                        unsafe_allow_html=True,
                    )

                    # Reason codes (derived from confidence + status)
                    reason_codes = []
                    if conf >= 0.85:    reason_codes.append(("SOURCE_HIGH_CONFIDENCE", "chip-match"))
                    elif conf < 0.50:   reason_codes.append(("SOURCE_LOW_CONFIDENCE",  "chip-conflict"))
                    if status == "MATCHED":      reason_codes.append(("MATCHED",      "chip-match"))
                    elif status == "CONFLICT":   reason_codes.append(("CONFLICT",     "chip-conflict"))
                    elif status == "POLLUTED":   reason_codes.append(("POLLUTED",     "chip-conflict"))
                    elif status == "INFERRED":   reason_codes.append(("INFERRED",     "chip-fuzzy"))
                    elif status == "UNAVAILABLE":reason_codes.append(("NO_CANDIDATE", "chip-missing"))
                    if code == "—" or not code:  reason_codes.append(("NO_CODE_RETURNED", "chip-missing"))
                    if reason_codes:
                        chips = "".join(f'<span class="chip {cls}">{code_}</span>'
                                       for code_, cls in reason_codes)
                        st.markdown(f'<div class="chip-row">{chips}</div>', unsafe_allow_html=True)

                    # Field comparison table (input vs source code)
                    st.markdown("**Field Comparison**")
                    field_rows = [
                        ("Company Name",   sel_comp,
                         str(sel_row.get("Clean Name", sel_comp)),
                         "✅ Match" if sel_comp.upper()[:6] == str(sel_row.get("Clean Name","")).upper()[:6]
                         else "⚠️ Partial"),
                        ("Jurisdiction",   str(sel_row.get("Jurisdiction","—")), "—", "—"),
                        ("Industry Code",  str(sel_row.get("Prod NAICS","—")), code, "—"),
                        ("Source Status",  "—", status,
                         "✅ Match" if status == "MATCHED" else "❌ Conflict" if status in ("CONFLICT","POLLUTED") else "—"),
                    ]
                    fc_rows_html = "".join(
                        f"<tr><td>{f}</td><td>{iv}</td><td>{sv}</td>"
                        f"<td class=\"{'fc-match' if '✅' in st_ else 'fc-fuzzy' if '⚠' in st_ else 'fc-conflict' if '❌' in st_ else ''}\">{st_}</td></tr>"
                        for f, iv, sv, st_ in field_rows
                    )
                    st.markdown(
                        '<div class="fc-table-wrapper"><table class="fc-table">'
                        '<thead><tr><th>Field</th><th>Input Value</th><th>Source Value</th><th>Status</th></tr></thead>'
                        f'<tbody>{fc_rows_html}</tbody></table></div>',
                        unsafe_allow_html=True,
                    )

            st.divider()

            # ── D. Cross-source comparison summary ────────────────────────────
            st.markdown("### ⚖️ Cross-Source Comparison Summary")
            cross_rows = []
            for src_key, lbl, conf_col, stat_col, code_col, _ in SRC_PAIRS:
                c = float(sel_row.get(conf_col, 0) or 0)
                s = str(sel_row.get(stat_col, "—") or "—")
                cd = str(sel_row.get(code_col, "—") or "—") if code_col else "—"
                band_lbl = ("Very High" if c >= 0.95 else "High" if c >= 0.85
                            else "Medium" if c >= 0.70 else "Low" if c >= 0.50 else "Very Low")
                cross_rows.append({
                    "Source": lbl, "Confidence": f"{c:.3f}", "Band": band_lbl,
                    "Status": s, "Industry Code": cd,
                    "Matched ≥ 0.80": "✅" if c >= 0.80 else "❌",
                })
            st.dataframe(pd.DataFrame(cross_rows), use_container_width=True, hide_index=True)

            # Metrics row
            mc1, mc2, mc3, mc4 = st.columns(4)
            mc1.metric("Sources ≥ 0.80",   str(sel_row.get("Sources ≥ 0.80", 0)))
            mc2.metric("Best Source",       str(sel_row.get("Best Source", "—")).replace("_"," ").title())
            mc3.metric("Best Confidence",   f"{float(sel_row.get('Avg Confidence', 0)):.3f}")
            mc4.metric("Confidence Spread", f"{spread:.3f}" + (" ⚡" if spread >= 0.30 else ""))

            if spread >= 0.30:
                st.warning(
                    f"**High confidence spread ({spread:.3f})** — sources disagree significantly. "
                    "This record should be escalated for manual review.",
                    icon="⚡",
                )

            st.divider()

            # ── E. Level 2 Classification + SHAP side by side ─────────────────
            st.markdown("### 🏭 Level 2 — Consensus Classification")
            col_codes, col_shap = st.columns([3, 2])
            with col_codes:
                bars = "".join(
                    _prob_bar(r, str(sel_row.get(f"Rank {r} Code", "")),
                              str(sel_row.get(f"Rank {r} Label", "")),
                              float(sel_row.get(f"Rank {r} Prob", 0)),
                              str(sel_row.get(f"Rank {r} Tax", "")))
                    for r in range(1, 6) if sel_row.get(f"Rank {r} Code")
                )
                st.markdown(bars, unsafe_allow_html=True)

                st.markdown("**Production rule vs Consensus:**")
                prod_w = str(sel_row.get("Prod Winner", "—"))
                prod_c = float(sel_row.get("Prod Confidence", 0))
                prod_n = str(sel_row.get("Prod NAICS", "—"))
                cons_n = str(sel_row.get("Rank 1 Code", "—"))
                agree  = prod_n == cons_n
                st.markdown(
                    f"- Production used **{prod_w}** (conf {prod_c:.3f}) → NAICS `{prod_n}`\n"
                    f"- Consensus predicts → NAICS `{cons_n}` "
                    f"{'✅ (same)' if agree else '🟡 (different — Consensus may be more accurate)'}"
                )

            with col_shap:
                st.markdown("**SHAP — Why this classification?**")
                if sel_sr:
                    from shap_explainer import FEATURE_INTERPRETATIONS
                    top5 = sorted(zip(sel_sr.feature_names, sel_sr.shap_values),
                                  key=lambda x: abs(x[1]), reverse=True)[:5]
                    for fname, fval in top5:
                        pct   = min(abs(fval) / 2.0, 1.0)
                        colour = "#FC8181" if fval > 0 else "#4299E1"
                        dirn  = "▲" if fval > 0 else "▼"
                        st.markdown(
                            f'<div style="margin-bottom:8px">'
                            f'<div style="font-size:11px;color:#A0AEC0;margin-bottom:2px">'
                            f'{FEATURE_INTERPRETATIONS.get(fname, fname)[:48]}</div>'
                            f'<div style="background:#2D3748;border-radius:4px;height:14px">'
                            f'<div style="background:{colour};height:14px;border-radius:4px;'
                            f'width:{pct*100:.0f}%;display:flex;align-items:center;padding-left:4px">'
                            f'<span style="font-size:10px;font-weight:700;color:white">'
                            f'{dirn} {fval:+.3f}</span></div></div></div>',
                            unsafe_allow_html=True,
                        )
                else:
                    st.caption("SHAP not available for this record.")

            st.divider()

            # ── F. AML / KYB signals ──────────────────────────────────────────
            st.markdown("### 🚨 AML / KYB Risk Signals")
            sigs_t = sel_row.get("_signals", [])
            if sigs_t:
                for flag, sev, desc in sigs_t:
                    sc = RISK_C.get(sev, "#718096")
                    st.markdown(
                        f'<div style="border-left:4px solid {sc};padding:10px 14px;'
                        f'margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:0 8px 8px 0">'
                        f'<div style="font-weight:700;color:{sc};font-size:13px">{sev} — {flag}</div>'
                        f'<div style="font-size:12px;color:#A0AEC0;margin-top:3px">{desc}</div></div>',
                        unsafe_allow_html=True,
                    )
            else:
                st.success("✅ No AML signals detected — clean profile.")

            st.markdown(_kyb_banner(str(sel_row.get("KYB", ""))), unsafe_allow_html=True)

            st.divider()

            # ── G. Analyst interpretation ─────────────────────────────────────
            st.markdown("### 🧠 Analyst Interpretation")
            st.markdown(_analyst_card(sel_row), unsafe_allow_html=True)

            st.divider()

            # ── H. Review decision panel ──────────────────────────────────────
            st.markdown("### 📋 Review Decision")
            lookup_id = str(sel_row.get("Company", sel_comp))
            _render_decision_panel(lookup_id)

    # ══ FULL TABLE ═══════════════════════════════════════════════════════════
    with tab_table:
        st.markdown("Complete results with analyst decisions. Use column headers to sort.")
        display_cols = [c for c in [
            "Company","Clean Name","Jurisdiction","Entity Type",
            "OC Confidence","OC Status","EFX Confidence","EFX Status",
            "ZI Confidence","ZI Status","TRU Confidence","LIB Confidence",
            "Best Source","Avg Confidence","Sources ≥ 0.80",
            "Prod Winner","Prod Confidence","Prod NAICS",
            "Rank 1 Code","Rank 1 Label","Rank 1 Tax","Rank 1 Prob",
            "Rank 2 Code","Rank 2 Label","Rank 2 Prob",
            "Rank 3 Code","Rank 3 Label","Rank 3 Prob",
            "Rank 4 Code","Rank 5 Code",
            "Risk Score","Risk Level","KYB","AML Flags","AML Count",
        ] if c in result_df.columns]
        disp_df = result_df[display_cols].copy()
        for col in [c for c in display_cols if "Prob" in c]:
            disp_df[col] = pd.to_numeric(disp_df[col],errors="coerce").apply(
                lambda v: f"{v:.1%}" if pd.notna(v) else "—")
        for col in [c for c in display_cols if "Confidence" in c or "Score" in c]:
            disp_df[col] = pd.to_numeric(disp_df[col],errors="coerce").apply(
                lambda v: f"{v:.3f}" if pd.notna(v) else "—")
        # Merge all analyst decision fields into the table
        decs = st.session_state.get("decisions", {})
        if "Company" in disp_df.columns:
            disp_df.insert(0, "Analyst Decision", disp_df["Company"].map(
                lambda c: decs.get(c, {}).get("decision", "Unreviewed")))
            disp_df.insert(1, "Override Code", disp_df["Company"].map(
                lambda c: decs.get(c, {}).get("override_code", "")))
            disp_df.insert(2, "Override Label", disp_df["Company"].map(
                lambda c: decs.get(c, {}).get("override_label", "")))
            disp_df.insert(3, "Analyst Notes", disp_df["Company"].map(
                lambda c: decs.get(c, {}).get("note", "")))
            disp_df.insert(4, "Reviewed By", disp_df["Company"].map(
                lambda c: decs.get(c, {}).get("reviewer", "")))

        # Enrich Jurisdiction column with human-readable label
        import jurisdiction_registry as _JR
        def _jur_label_full(jc: str) -> str:
            rec = _JR.lookup(str(jc or "").lower().strip())
            label = rec.label if rec else ""
            return f"{jc} — {label}" if label and label != jc else str(jc)

        if "Jurisdiction" in disp_df.columns:
            disp_df["Jurisdiction"] = disp_df["Jurisdiction"].apply(_jur_label_full)

        st.caption(
            "First 5 columns are analyst inputs. "
            "Override Code / Label replace the model's code when an analyst corrects it. "
            "Analyst Notes appear here and in the download. "
            "Jurisdiction shown as code — full label (e.g. us_nj — New Jersey)."
        )
        st.dataframe(disp_df, use_container_width=True, hide_index=True, height=500)
        with st.expander("Column reference"):
            st.markdown("""
| Column | Source | Meaning |
|---|---|---|
| `OC/EFX/ZI/TRU/LIB Confidence` | Level 1 XGBoost | Entity match confidence 0–1 per source |
| `*Status` | Level 1 | MATCHED / INFERRED / CONFLICT / POLLUTED / UNAVAILABLE |
| `Prod Winner` | Production rule | Which of ZI or EFX won (only these two compared) |
| `Prod NAICS` | Production rule | Code currently written to `customer_files.naics_code` |
| `Rank 1–5 Code` | Consensus L2 | Top-5 industry codes by calibrated probability |
| `Rank 1–5 Prob` | Consensus L2 | Model confidence 0–1 for each code |
| `Risk Score` | Risk engine | Composite AML score 0–1 |
| `KYB` | Risk engine | APPROVE / REVIEW / ESCALATE / REJECT |
| `Analyst Decision` | Analyst input | APPROVE / REVIEW / ESCALATE / REJECT / No Match |
| `Override Code` | Analyst input | Corrected industry code if the model was wrong |
| `Override Label` | Analyst input | Description for the override code |
| `Analyst Notes` | Analyst input | Freetext notes, corrections, flags — saved to session and export |
| `Reviewed By` | Analyst input | Reviewer name entered in the decision panel |
""")

    # ══ DOWNLOAD ═════════════════════════════════════════════════════════════
    with tab_dl:
        st.markdown("Download complete results including analyst decisions.")
        export_cols = [c for c in result_df.columns
                       if not c.startswith("_") and c not in ("_signals","_sigs_raw","_bundle")]
        exp_df = result_df[export_cols].copy()
        decs   = st.session_state.get("decisions", {})
        if "Company" in exp_df.columns:
            exp_df["Analyst Decision"] = exp_df["Company"].map(
                lambda c: decs.get(c, {}).get("decision", "Unreviewed"))
            exp_df["Override Code"]    = exp_df["Company"].map(
                lambda c: decs.get(c, {}).get("override_code", ""))
            exp_df["Override Label"]   = exp_df["Company"].map(
                lambda c: decs.get(c, {}).get("override_label", ""))
            exp_df["Analyst Notes"]    = exp_df["Company"].map(
                lambda c: decs.get(c, {}).get("note", ""))
            exp_df["Reviewed By"]      = exp_df["Company"].map(
                lambda c: decs.get(c, {}).get("reviewer", ""))
        c1,c2 = st.columns(2)
        with c1:
            buf = io.BytesIO()
            exp_df.to_excel(buf,index=False,engine="openpyxl"); buf.seek(0)
            st.download_button("📥 Download Excel", data=buf,
                               file_name="classification_results_v3.xlsx",
                               mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            st.caption("All Level 1 confidences, Level 2 codes, AML flags, analyst decisions")
        with c2:
            st.download_button("📥 Download CSV", data=exp_df.to_csv(index=False),
                               file_name="classification_results_v3.csv", mime="text/csv")

# ── Industry Lookup (from app.py) ─────────────────────────────────────────────
def _render_industry_lookup():
    from industry_dropdown import (get_entries,search_entries,get_taxonomy_label,
        taxonomy_for_jurisdiction,get_all_taxonomy_names,get_entry_by_code,
        reload_taxonomy,TAXONOMY_LABELS)
    import jurisdiction_registry as JR
    st.title("Industry Lookup — Jurisdiction-Aware Classification")
    st.markdown("Browse industry codes using the **correct taxonomy for each country**. UK→SIC 2007. EU→NACE Rev.2. US/CA→NAICS 2022.")
    all_jur = sorted(JR.all_codes())
    jur_display = [f"{jc}  —  {JR.lookup(jc).label if JR.lookup(jc) else jc}" for jc in all_jur]
    jur_map = dict(zip(jur_display,all_jur))
    col_a,col_b,col_c = st.columns([2,2,1])
    with col_a:
        sel_d = st.selectbox("Jurisdiction",jur_display,
                             index=all_jur.index("gb") if "gb" in all_jur else 0)
        jc = jur_map[sel_d]
    with col_b:
        auto_tax = taxonomy_for_jurisdiction(jc)
        all_tax = get_all_taxonomy_names()
        tax_sel = st.selectbox("Taxonomy",all_tax,index=all_tax.index(auto_tax) if auto_tax in all_tax else 0,
                               format_func=lambda t: TAXONOMY_LABELS.get(t,t))
    with col_c:
        if st.button("Reload CSV"): reload_taxonomy(tax_sel); st.success("Reloaded.")
    jr_rec = JR.lookup(jc)
    st.info(f"**Jurisdiction:** `{jc}` — {jr_rec.label if jr_rec else jc}  |  **Taxonomy:** {TAXONOMY_LABELS.get(tax_sel,tax_sel)}")
    sc,cc = st.columns([5,1])
    with sc: search_q = st.text_input("Search",placeholder="62012 or software or restaurant",label_visibility="collapsed")
    with cc:
        if st.button("Clear"): search_q=""
    entries = search_entries(jc,search_q.strip(),taxonomy_override=tax_sel) if search_q.strip() else get_entries(jc,taxonomy_override=tax_sel)
    st.caption(f"{len(entries)} codes")
    if entries:
        opts = [e["display"] for e in entries]; dmap = {e["display"]:e for e in entries}
        sel_e = st.selectbox("Industry code",opts,label_visibility="collapsed")
        entry = dmap[sel_e]
        d1,d2,d3 = st.columns(3)
        d1.metric("Code",entry["code"]); d2.metric("Taxonomy",entry["taxonomy"].replace("_"," ")); d3.metric("Jurisdiction",jc.upper())
        st.markdown(f"**Description:** {entry['description']}")
        with st.expander("JSON output"):
            st.json({"jurisdiction_code":jc,"taxonomy":entry["taxonomy"],
                     "industry_code":entry["code"],"industry_description":entry["description"]})
    with st.expander(f"Browse full {TAXONOMY_LABELS.get(tax_sel,tax_sel)} ({len(entries)} codes)"):
        df_t = pd.DataFrame([{"Code":e["code"],"Description":e["description"]} for e in entries])
        st.dataframe(df_t,use_container_width=True,height=400)
        st.download_button(f"Download CSV",data=df_t.to_csv(index=False).encode(),
                           file_name=f"{tax_sel}_{jc}.csv",mime="text/csv")

# ── Audit Trail page ──────────────────────────────────────────────────────────
def _render_audit():
    st.title("📜 Audit Trail")
    st.caption("All analyst actions and classification runs recorded in this session.")
    trail = st.session_state.get("audit",[])
    decs  = st.session_state.get("decisions",{})
    c1,c2,c3 = st.columns(3)
    c1.metric("Total Events",    len(trail))
    c2.metric("Decisions Made",  len(decs))
    c3.metric("Approved",        sum(1 for d in decs.values() if d.get("decision")=="Approved"))
    st.divider()
    if trail:
        flt = st.multiselect("Filter by event type", list({e["event"] for e in trail}))
        show = [e for e in trail if not flt or e["event"] in flt]
        for ev in reversed(show):
            col = ev.get("colour","#4299E1")
            st.markdown(
                f'<div class="audit-row" style="border-color:{col}">'
                f'<div style="font-size:11px;color:#A0AEC0">{ev["ts"]} — {ev["entity"]}</div>'
                f'<div style="font-weight:700;color:{col}">{ev["event"]}</div>'
                f'<div style="font-size:13px;color:#CBD5E0">{ev["detail"]}</div></div>',
                unsafe_allow_html=True,
            )
        st.divider()
        audit_df = pd.DataFrame(trail)[["ts","entity","event","detail"]]
        st.download_button("📥 Export Audit Log (CSV)", data=audit_df.to_csv(index=False),
                           file_name="audit_log.csv", mime="text/csv")
    else:
        st.info("No events yet. Classify companies and review records to populate the audit trail.")
    if st.button("🗑️ Clear Audit Trail"):
        st.session_state["audit"] = []; st.rerun()
    if st.button("🗑️ Clear All Decisions"):
        st.session_state["decisions"] = {}; st.session_state["audit"] = []; st.rerun()

# ── Sidebar ───────────────────────────────────────────────────────────────────
def _sidebar():
    st.sidebar.title("🏭 Classification Engine v3")
    st.sidebar.caption("Level 1 + Level 2 XGBoost · SHAP · KYB Decisions")
    st.sidebar.divider()
    try:
        from redshift_connector import get_connector
        rc = get_connector()
        if rc.is_connected:
            st.sidebar.success("Redshift: LIVE", icon="✅")
        else:
            st.sidebar.warning("Redshift: SIMULATED", icon="⚠️")
    except Exception:
        st.sidebar.warning("Redshift: SIMULATED", icon="⚠️")
    try:
        from config import _get_openai_key
        k = _get_openai_key()
        if k and len(k) > 10:
            st.sidebar.success("OpenAI: Configured", icon="✅")
        else:
            st.sidebar.info("OpenAI: Not set — LLM disabled", icon="ℹ️")
    except Exception:
        pass
    st.sidebar.divider()
    page = st.sidebar.radio("Navigate",["Classify","Industry Lookup","📜 Audit Trail"],index=0)
    mode = None
    if page == "Classify":
        st.sidebar.divider()
        mode = st.sidebar.radio("Input mode",["Single company","Batch upload"],index=0)
    return page, mode

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    _prewarm()
    _init_state()
    page, mode = _sidebar()

    if page == "Industry Lookup":
        _render_industry_lookup(); return
    if page == "📜 Audit Trail":
        _render_audit(); return

    st.title("🏭 Global Industry Classification Engine v3")
    st.caption("**Level 1** entity matching · **Level 2** Consensus XGBoost · **SHAP** explainability · **KYB** decision panel")
    st.divider()

    # ── SINGLE COMPANY ────────────────────────────────────────────────────────
    if mode == "Single company":
        with st.form("sf"):
            c1,c2,c3 = st.columns([3,2,1])
            with c1: company = st.text_input("Company name",placeholder="e.g. Apple Inc, Worth AI, JPMORGAN CHASE BANK")
            with c2: address = st.text_input("Address (optional)",placeholder="1 Infinite Loop, Cupertino CA")
            with c3: country = st.text_input("Country",value="US",max_chars=5)
            submitted = st.form_submit_button("▶ Classify",type="primary")

        if submitted and company.strip():
            df_in = pd.DataFrame([{"company_name":company.strip(),"address":address.strip(),"country":country.strip(),"state":""}])
            with st.spinner("Classifying…"):
                t0 = time.time()
                results, shap_list = _classify_rows(df_in, compute_shap=True, show_progress=False)
                elapsed = time.time()-t0
            st.success(f"Completed in {elapsed:.2f}s")
            st.session_state["single_result"]    = results
            st.session_state["single_shap"]      = shap_list
            st.session_state["single_deep"]      = None
            _audit("Classification Run", f"Single company: {company.strip()}", entity=company.strip(), colour="#48BB78")

        if "single_result" in st.session_state:
            results    = st.session_state["single_result"]
            shap_list  = st.session_state.get("single_shap",[])
            deep       = st.session_state.get("single_deep")
            row        = results.iloc[0]
            if "_error" in results.columns and pd.notna(row.get("_error","")):
                st.error(f"Error: {row['_error']}")
            else:
                st.markdown(f"## {row.get('Company','')}")
                try:
                    from config import _get_openai_key
                    has_key = bool(_get_openai_key())
                except Exception: has_key = False
                if has_key and deep is None:
                    if st.button("🔬 Deep Analysis (LLM + SEC EDGAR + Companies House ~10s)"):
                        with st.spinner("Running deep analysis…"):
                            from llm_enrichment import enrich_company_profile, llm_classify
                            from external_lookup import lookup_all as _ext
                            name  = str(row.get("Company",""))
                            jc    = str(row.get("Jurisdiction","us"))
                            prof  = enrich_company_profile(name,"","","")
                            ext   = _ext(name, jc)
                            deep  = {"llm": None, "ext": ext}
                        st.session_state["single_deep"] = deep; st.rerun()
                _render(results, shap_list, deep)
        elif not submitted:
            st.info("Enter a company name and click **▶ Classify**.")
            st.markdown("**Try:** `Apple Inc` · `JPMORGAN CHASE BANK` · `Tesco PLC` · `SAP SE` · `Foster's Alaska Cabins`")

    # ── BATCH UPLOAD ──────────────────────────────────────────────────────────
    else:
        st.markdown("Upload CSV or Excel. Required column: `lgl_nm_worth` or `company_name`.")
        uploaded = st.file_uploader("Upload file",type=["csv","xlsx","xls"])
        sample   = Path(__file__).parent / "amex_worth_final_cleaned_data_sample_50_nonrandom.csv"
        if sample.exists() and st.button("📂 Use sample (50 NJ companies)"):
            st.session_state["batch_raw"] = pd.read_csv(sample)
            st.session_state.pop("batch_results",None); st.session_state.pop("batch_shap",None)
        if uploaded:
            st.session_state["batch_raw"] = pd.read_excel(uploaded) if uploaded.name.endswith((".xlsx",".xls")) else pd.read_csv(uploaded)
            st.session_state.pop("batch_results",None); st.session_state.pop("batch_shap",None)
        if "batch_raw" not in st.session_state:
            st.info("Upload a file or click **📂 Use sample** to begin."); return
        raw = st.session_state["batch_raw"]
        df  = _parse(raw); n = len(df)
        st.success(f"{n} companies loaded.")
        with st.expander("Preview (first 5 rows)"):
            st.dataframe(df[["company_name","address","state","country"]].head(5),use_container_width=True)

        col_shap_opt, _ = st.columns([2,3])
        with col_shap_opt:
            compute_shap = st.checkbox("Compute SHAP explanations", value=True,
                help="Adds ~0.05s per company. Disable for very large batches (>500).")

        if st.button("▶ Run Batch Classification",type="primary"):
            t0 = time.time()
            results, shap_list = _classify_rows(df, compute_shap=compute_shap, show_progress=True)
            elapsed = time.time()-t0
            st.session_state["batch_results"] = results
            st.session_state["batch_shap"]    = shap_list
            n_ok = len(results) - (results["_error"].notna().sum() if "_error" in results.columns else 0)
            st.success(f"Done — {n_ok}/{n} classified in {elapsed:.1f}s ({n/elapsed:.0f}/s)")
            _audit("Batch Classification", f"{n} companies from uploaded file", colour="#48BB78")
            # Compute global SHAP if available
            if compute_shap and shap_list:
                bundles = [r.get("_bundle") for _,r in results.iterrows() if r.get("_bundle") is not None]
                if bundles:
                    try:
                        exp = _shap_exp()
                        with st.spinner("Computing global SHAP importance…"):
                            batch_shap = exp.explain_batch(bundles, top_n=10)
                        st.session_state["_batch_shap"] = batch_shap
                    except Exception as exc:
                        st.warning(f"Global SHAP failed: {exc}")

        if "batch_results" not in st.session_state: return
        results    = st.session_state["batch_results"]
        shap_list  = st.session_state.get("batch_shap",[])
        _render(results, shap_list)


if __name__ == "__main__":
    main()
