"""
app_v2.py — Global Industry Classification Engine (v2)
========================================================
Single company or batch upload → same output, same speed.

Performance:
  Fast pipeline (default):  entity resolver + consensus XGBoost + risk engine
                             ~0.02 s per company after first model load
  Deep analysis (optional): adds LLM enrichment + SEC EDGAR + Companies House
                             ~10-20 s per company, opt-in per button click

Both single and batch produce identical output structure:
  • Level 1 source confidence cards + bar chart
  • Level 2 Consensus classification: top-5 codes with probability bars
  • AML/KYB risk panel
  • Analyst interpretation card
  • Full downloadable results table
"""
from __future__ import annotations

import io
import re
import sys
import time
import logging
import warnings
from pathlib import Path
from collections import Counter

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
    page_title="Industry Classification Engine",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Design tokens ─────────────────────────────────────────────────────────────
SRC_C = {
    "opencorporates": "#68D391",
    "equifax":        "#4299E1",
    "trulioo":        "#9F7AEA",
    "zoominfo":       "#F6E05E",
    "liberty":        "#FC8181",
    "ai_semantic":    "#63B3ED",
}
STATUS_C = {
    "MATCHED":     "#48BB78",
    "INFERRED":    "#4299E1",
    "CONFLICT":    "#ECC94B",
    "POLLUTED":    "#FC8181",
    "UNAVAILABLE": "#718096",
}
KYB_C  = {"APPROVE":"#48BB78","REVIEW":"#4299E1","ESCALATE":"#ECC94B","REJECT":"#FC8181"}
KYB_BG = {"APPROVE":"#1a4731","REVIEW":"#1a365d","ESCALATE":"#5c3a00","REJECT":"#5c1a1a"}
RISK_C = {"CRITICAL":"#9B2335","HIGH":"#FC8181","MEDIUM":"#ECC94B","LOW":"#48BB78","INFO":"#4299E1"}

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
/* Shrink st.metric so values don't get cut off */
[data-testid="stMetricValue"] { font-size: 1.1rem !important; }
[data-testid="stMetricLabel"] { font-size: 0.75rem !important; }

.src-card {
    border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;
    background: rgba(255,255,255,0.04); border: 2px solid;
}
.kyb-banner {
    border-radius: 10px; padding: 14px 22px; text-align: center;
    font-size: 1.3em; font-weight: 800; color: white; margin-bottom: 16px;
}
.interp-card {
    border-radius: 10px; padding: 18px 20px; margin: 12px 0;
    background: #1A1F2E; border-left: 5px solid;
}
.prob-bar-wrap { margin-bottom: 10px; }
.prob-bar-label { font-size: 11px; color: #A0AEC0; margin-bottom: 2px; }
.prob-bar-desc  { font-size: 13px; color: #E2E8F0; margin-bottom: 4px; }
.prob-bar-outer { background: #2D3748; border-radius: 4px; height: 16px; }
.prob-bar-inner { height: 16px; border-radius: 4px; display: flex;
                  align-items: center; padding-left: 6px; }
.prob-bar-pct   { font-size: 11px; font-weight: 700; color: white; }
</style>
""", unsafe_allow_html=True)

# ── Cached model singletons ───────────────────────────────────────────────────
# All models are pre-warmed at startup so the first Classify click is instant.
# Streamlit calls these functions when the app first renders — not on button click.

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


def _prewarm_models() -> None:
    """
    Call every singleton at startup.
    Shows a single loading bar so the user knows what's happening once,
    then all subsequent classifications are instant.
    """
    if st.session_state.get("_models_ready"):
        return
    with st.spinner("⏳ Loading models on first start — this takes ~10s once, then instant…"):
        _er()   # entity resolver — fast
        te = _te()   # taxonomy engine + sentence-transformers — 7s on first load
        _ce()   # consensus XGBoost — loads from data/consensus_model.ubj
        _re()   # risk engine
        _sim()  # data simulator
    st.session_state["_models_ready"] = True

# ── CSV normalisation ─────────────────────────────────────────────────────────
_COL_MAP = {
    "lgl_nm_worth":"company_name","lgl_nm_received":"company_name",
    "name":"company_name","business_name":"company_name","company":"company_name",
    "address_1_worth":"address","address":"address","street_address":"address",
    "city_worth":"city","region_worth":"state","zip_code_worth":"zip",
    "country_worth":"country",
}

def _parse_upload(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for src, dst in _COL_MAP.items():
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src].fillna("").astype(str).str.strip()
    if "company_name" not in df.columns:
        for c in df.columns:
            if any(w in c.lower() for w in ("name","nm","company")):
                df["company_name"] = df[c].fillna("").astype(str).str.strip(); break
    if "company_name" not in df.columns:
        st.error("No company name column found. Expected `lgl_nm_worth` or `company_name`.")
        st.stop()
    for col in ("address","city","state","country"):
        if col not in df.columns: df[col] = ""
    df["country"] = df["country"].where(df["country"].str.strip() != "", "US")
    return df

# ── Fast classification (shared by both single and batch) ─────────────────────
def _classify_rows(df: pd.DataFrame, show_progress: bool = True) -> pd.DataFrame:
    """
    Fast pipeline: entity resolver → data simulator → consensus → risk.
    No LLM, no HTTP. ~0.02s per company after model warm-up.
    """
    er = _er(); sim = _sim(); ce = _ce(); rev = _re()
    n = len(df)
    prog = st.progress(0.0, text="Classifying …") if show_progress else None
    t0 = time.time()
    rows = []

    for idx, row in df.iterrows():
        name    = str(row.get("company_name","") or "").strip()
        address = str(row.get("address","")      or "").strip()
        country = str(row.get("country","")      or "").strip()
        state   = str(row.get("state","")        or "").strip()

        if not name:
            rows.append({"_error":"empty"})
            continue
        try:
            entity = er.resolve(name, address, country or state)
            bundle = sim.fetch(name, address, country or state,
                               entity.jurisdiction_code, "Operating", "")
            cons   = ce.predict(bundle)
            risk   = rev.evaluate(bundle, cons)

            p1  = cons.primary_industry
            sec = cons.secondary_industries
            sigs = bundle.signals

            src_conf = {s.source: round(s.confidence, 4) for s in sigs}
            src_stat = {s.source: s.status for s in sigs}
            src_code = {s.source: s.raw_code for s in sigs}
            src_lbl  = {s.source: s.label for s in sigs}
            src_tax  = {s.source: s.taxonomy for s in sigs}
            src_wt   = {s.source: s.weight for s in sigs}

            best_src  = max(src_conf, key=src_conf.get) if src_conf else "—"
            avg_conf  = round(float(np.mean(list(src_conf.values()))), 4) if src_conf else 0
            matched   = sum(1 for c in src_conf.values() if c >= 0.80)
            flags_str = "; ".join(s.flag for s in risk.signals) if risk.signals else "—"
            zi_c      = src_conf.get("zoominfo", 0)
            efx_c     = src_conf.get("equifax",  0)

            row_out = {
                "Company":          name,
                "Clean Name":       entity.clean_name,
                "Jurisdiction":     entity.jurisdiction_code,
                "Entity Type":      entity.detected_entity_type,
                # Level 1 — source confidences (raw model outputs)
                "OC Confidence":    src_conf.get("opencorporates", 0),
                "OC Status":        src_stat.get("opencorporates", "—"),
                "OC Code":          src_code.get("opencorporates", "—"),
                "EFX Confidence":   src_conf.get("equifax", 0),
                "EFX Status":       src_stat.get("equifax", "—"),
                "EFX Code":         src_code.get("equifax", "—"),
                "ZI Confidence":    src_conf.get("zoominfo", 0),
                "ZI Status":        src_stat.get("zoominfo", "—"),
                "ZI Code":          src_code.get("zoominfo", "—"),
                "TRU Confidence":   src_conf.get("trulioo", 0),
                "TRU Status":       src_stat.get("trulioo", "—"),
                "TRU Code":         src_code.get("trulioo", "—"),
                "LIB Confidence":   src_conf.get("liberty", 0),
                "LIB Status":       src_stat.get("liberty", "—"),
                "AI Confidence":    src_conf.get("ai_semantic", 0),
                "Best Source":      best_src,
                "Avg Confidence":   avg_conf,
                "Sources ≥ 0.80":   matched,
                # Production rule output (ZI vs EFX)
                "Prod Winner":      "ZoomInfo" if zi_c > efx_c else "Equifax",
                "Prod Confidence":  round(max(zi_c, efx_c), 4),
                "Prod NAICS":       src_code.get("zoominfo","—") if zi_c > efx_c else src_code.get("equifax","—"),
                # Level 2 — Consensus XGBoost
                "Primary Code":     p1.code,
                "Primary Label":    p1.label,
                "Primary Taxonomy": p1.taxonomy.replace("_"," "),
                "Primary Prob":     round(p1.consensus_probability, 4),
            }
            # Top-5 codes
            all_codes = [p1] + list(sec)
            for rank in range(1, 6):
                if rank <= len(all_codes):
                    c = all_codes[rank-1]
                    row_out[f"Rank {rank} Code"]  = c.code
                    row_out[f"Rank {rank} Label"] = c.label
                    row_out[f"Rank {rank} Tax"]   = c.taxonomy.replace("_"," ")
                    row_out[f"Rank {rank} Prob"]  = round(c.consensus_probability, 4)
                else:
                    row_out[f"Rank {rank} Code"]  = ""
                    row_out[f"Rank {rank} Label"] = ""
                    row_out[f"Rank {rank} Tax"]   = ""
                    row_out[f"Rank {rank} Prob"]  = 0.0

            row_out.update({
                "Risk Score":    round(risk.overall_risk_score, 4),
                "Risk Level":    risk.overall_risk_level,
                "KYB":           risk.kyb_recommendation,
                "AML Flags":     flags_str,
                "AML Count":     len(risk.signals),
                # store signals list for rendering
                "_signals":      [(s.flag, s.severity, s.description) for s in risk.signals],
                "_sigs_raw":     sigs,
            })
            rows.append(row_out)

        except Exception as exc:
            rows.append({"Company": name, "KYB": "REVIEW",
                         "AML Flags": str(exc)[:120], "_error": str(exc)[:120]})

        if prog:
            i_pos = list(df.index).index(idx) + 1
            elapsed = time.time() - t0
            rate = i_pos / elapsed if elapsed > 0 else 999
            eta  = (n - i_pos) / rate if rate > 0 else 0
            if i_pos % 5 == 0 or i_pos == n:
                prog.progress(i_pos / n,
                    text=f"Classifying {i_pos}/{n} — {rate:.0f} companies/s — ETA {eta:.0f}s")

    if prog: prog.empty()
    return pd.DataFrame(rows)

# ── Optional deep enrichment (LLM + external registries) ─────────────────────
def _deep_enrich(row: pd.Series) -> dict:
    """Run LLM enrichment and external registry lookup for one company."""
    name    = str(row.get("Company",""))
    jc      = str(row.get("Jurisdiction","us"))
    address = str(row.get("Clean Name",""))  # best we have post-resolve
    try:
        from llm_enrichment import enrich_company_profile, llm_classify
        prof = enrich_company_profile(name, "", "", "")
        from taxonomy_engine import TaxonomyEngine
        te = _te()
        ugo = te.search(f"{prof.primary_business_description} {name}", top_k=10)
        candidates = {}
        for rec, score in ugo:
            candidates.setdefault(rec.taxonomy, []).append(
                {"code": rec.code, "description": rec.description, "score": round(float(score),4)})
        llm = llm_classify(name, prof.primary_business_description, jc,
                            candidates, prof.web_summary, None, None,
                            prof.probable_entity_type)
    except Exception as exc:
        llm = None

    try:
        from external_lookup import lookup_all as _ext
        ext = _ext(name, jc)
    except Exception:
        ext = None

    return {"llm": llm, "ext": ext}

# ════════════════════════════════════════════════════════════
# RENDERING  (identical for single and batch)
# ════════════════════════════════════════════════════════════

def _html_prob_bar(rank: int, code: str, label: str, prob: float, taxonomy: str) -> str:
    pct    = int(prob * 100)
    colour = "#48BB78" if pct >= 70 else "#ECC94B" if pct >= 40 else "#FC8181"
    type_label = "PRIMARY" if rank == 1 else f"SECONDARY {rank-1}"
    return f"""
<div class="prob-bar-wrap">
  <div style="display:flex;justify-content:space-between;margin-bottom:2px">
    <span style="font-size:10px;font-weight:700;color:#A0AEC0;text-transform:uppercase;
                 letter-spacing:.5px">{type_label}</span>
    <span style="font-size:11px;color:#718096">{taxonomy}</span>
  </div>
  <div style="font-size:15px;font-weight:800;color:#fff;font-family:monospace;
              letter-spacing:2px;margin-bottom:2px">{code}</div>
  <div style="font-size:13px;color:#CBD5E0;margin-bottom:6px">{label}</div>
  <div class="prob-bar-outer">
    <div class="prob-bar-inner" style="width:{pct}%;background:{colour}">
      <span class="prob-bar-pct">{prob:.0%}</span>
    </div>
  </div>
</div>"""


def _html_src_card(src_key: str, conf: float, status: str, code: str, label: str = "") -> str:
    colour   = SRC_C.get(src_key, "#718096")
    st_col   = STATUS_C.get(status, "#718096")
    src_name = src_key.replace("_"," ").title()
    matched  = conf >= 0.80
    tick     = "✅" if matched else "⚠️" if conf >= 0.50 else "❌"
    return f"""
<div class="src-card" style="border-color:{colour}">
  <div style="font-size:10px;color:{colour};font-weight:700;text-transform:uppercase;
              letter-spacing:.8px;margin-bottom:4px">{src_name}</div>
  <div style="font-size:26px;font-weight:900;color:#fff;font-family:monospace">{conf:.3f}</div>
  <div style="margin:4px 0">
    <span style="background:{st_col};color:#fff;padding:2px 8px;border-radius:20px;
                 font-size:10px;font-weight:700">{status}</span>
    <span style="margin-left:6px;font-size:14px">{tick}</span>
  </div>
  <div style="font-size:11px;color:#A0AEC0;margin-top:4px">{code[:30] if code else '—'}</div>
</div>"""


def _analyst_card(row: pd.Series, deep: dict | None = None) -> str:
    kyb     = str(row.get("KYB",""))
    prob    = float(row.get("Primary Prob", 0))
    avg_c   = float(row.get("Avg Confidence", 0))
    matched = int(row.get("Sources ≥ 0.80", 0))
    aml_n   = int(row.get("AML Count", 0))
    prod_w  = str(row.get("Prod Winner",""))
    prod_c  = float(row.get("Prod Confidence", 0))
    best_s  = str(row.get("Best Source",""))
    p_code  = str(row.get("Primary Code",""))
    p_label = str(row.get("Primary Label",""))
    risk_l  = str(row.get("Risk Level",""))
    border  = KYB_C.get(kyb, "#718096")

    bullets = []

    # Entity matching quality
    if matched >= 3:
        bullets.append(f"✅ <strong>Strong entity match</strong> — {matched} of 6 sources matched with ≥ 0.80 confidence, "
                       f"including {best_s.replace('_',' ').title()}. High confidence this company exists in vendor databases.")
    elif matched >= 1:
        bullets.append(f"🟡 <strong>Partial entity match</strong> — only {matched} source(s) matched at ≥ 0.80. "
                       f"Company may be small, newly registered, or not yet in all vendor databases.")
    else:
        bullets.append(f"🔴 <strong>Weak entity match</strong> — no source reached 0.80 confidence. "
                       f"Classification relies on AI inference rather than direct vendor match. Treat with caution.")

    # Production rule gap
    if best_s in ("opencorporates","liberty","trulioo","ai_semantic"):
        bullets.append(f"⚠️ <strong>Production rule gap</strong> — the best match came from "
                       f"<strong>{best_s.replace('_',' ').title()}</strong>, but the current production rule "
                       f"only compares ZoomInfo vs Equifax for the NAICS code. "
                       f"The production output may be based on a weaker match ({prod_w}, conf {prod_c:.3f}).")

    # Classification confidence
    if prob >= 0.70:
        bullets.append(f"✅ <strong>High classification confidence ({prob:.0%})</strong> — industry signals are "
                       f"consistent across sources. Primary code <code>{p_code}</code> ({p_label}) is reliable.")
    elif prob >= 0.40:
        bullets.append(f"🟡 <strong>Medium classification confidence ({prob:.0%})</strong> — some source disagreement. "
                       f"Review the secondary codes before using <code>{p_code}</code> as the final answer.")
    else:
        bullets.append(f"🔴 <strong>Low classification confidence ({prob:.0%})</strong> — sources conflict significantly. "
                       f"Manual review required before accepting <code>{p_code}</code>.")

    # AML/KYB
    if kyb in ("ESCALATE","REJECT"):
        bullets.append(f"🚨 <strong>KYB {kyb}</strong> — {aml_n} AML signal(s) detected. "
                       f"This company requires immediate human review before any onboarding decision.")
    elif kyb == "REVIEW":
        bullets.append(f"🟡 <strong>KYB REVIEW</strong> — routine analyst review recommended. "
                       f"{aml_n} signal(s) detected; none are critical individually but warrant verification.")
    else:
        bullets.append(f"✅ <strong>KYB APPROVE</strong> — no elevated risk signals. "
                       f"Company can proceed through automated onboarding with standard monitoring.")

    # LLM second opinion
    llm = deep.get("llm") if deep else None
    if llm and llm.primary_code:
        agree = llm.primary_code == p_code
        if agree:
            bullets.append(f"✅ <strong>LLM agrees</strong> — GPT-4o-mini independently selected "
                           f"<code>{llm.primary_code}</code> with {llm.primary_confidence} confidence.")
        else:
            bullets.append(f"⚠️ <strong>LLM diverges</strong> — GPT-4o-mini selected "
                           f"<code>{llm.primary_code}</code> ({llm.primary_label}) vs Consensus "
                           f"<code>{p_code}</code>. Review both codes before making a final decision.")

    bullet_html = "".join(f"<li style='margin-bottom:8px'>{b}</li>" for b in bullets)
    return f"""
<div class="interp-card" style="border-color:{border}">
  <div style="font-size:13px;font-weight:700;color:{border};text-transform:uppercase;
              letter-spacing:.5px;margin-bottom:10px">🧠 Analyst Interpretation</div>
  <ul style="color:#E2E8F0;font-size:13px;line-height:1.7;padding-left:18px;margin:0">
    {bullet_html}
  </ul>
</div>"""


def _render_result(result_df: pd.DataFrame, deep: dict | None = None) -> None:
    """
    Render the full output — identical layout for single company or batch.
    For single company: result_df has 1 row.
    For batch: result_df has N rows; extra portfolio charts added.
    """
    single = len(result_df) == 1
    row = result_df.iloc[0] if single else None
    n   = len(result_df)

    # Filter error rows for display
    ok_df = result_df[~result_df.get("_error", pd.Series(dtype=str)).notna()].copy() if "_error" in result_df.columns else result_df.copy()

    # ── TAB STRUCTURE ─────────────────────────────────────────────────────────
    tab_summary, tab_l1, tab_l2, tab_table, tab_download = st.tabs([
        "📊 Summary & Interpretation",
        "🔍 Level 1 — Source Confidences",
        "🏭 Level 2 — Classification",
        "📋 Full Results Table",
        "📥 Download",
    ])

    # ════════════════════════════════════════════════════════
    # TAB 1 — SUMMARY & INTERPRETATION
    # ════════════════════════════════════════════════════════
    with tab_summary:

        if single and row is not None:
            # Single company — KYB banner + analyst card
            kyb = str(row.get("KYB",""))
            bg  = KYB_BG.get(kyb,"#374151")
            st.markdown(
                f'<div class="kyb-banner" style="background:{bg}">KYB Recommendation: {kyb}</div>',
                unsafe_allow_html=True,
            )

            # Metric row
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
            # Batch — portfolio summary metrics
            kyb_dist = ok_df["KYB"].value_counts().to_dict() if "KYB" in ok_df.columns else {}
            prob_col  = pd.to_numeric(ok_df.get("Primary Prob", pd.Series()), errors="coerce")
            aml_any   = int((ok_df.get("AML Count", pd.Series(dtype=int)) > 0).sum())
            matched_hi = int((pd.to_numeric(ok_df.get("Avg Confidence", pd.Series()), errors="coerce") >= 0.80).sum())

            c1,c2,c3,c4,c5,c6 = st.columns(6)
            c1.metric("Total", n)
            c2.metric("APPROVE",        kyb_dist.get("APPROVE",0))
            c3.metric("REVIEW",         kyb_dist.get("REVIEW",0))
            c4.metric("ESCALATE/REJECT",kyb_dist.get("ESCALATE",0)+kyb_dist.get("REJECT",0))
            c5.metric("Avg Probability",f"{prob_col.mean():.0%}" if not prob_col.empty else "—")
            c6.metric("AML Flagged",    aml_any)

            st.divider()

            # Charts row
            ca,cb,cc = st.columns(3)
            with ca:
                if not prob_col.empty:
                    fig = go.Figure(go.Histogram(x=prob_col,nbinsx=20,
                                                 marker_color="#48BB78",opacity=0.85))
                    fig.add_vline(x=0.70,line_dash="dash",line_color="white",annotation_text="70%")
                    fig.add_vline(x=0.40,line_dash="dash",line_color="#ECC94B",annotation_text="40%")
                    fig.update_layout(title="Consensus Probability",xaxis_title="Probability",
                                      yaxis_title="Companies",template="plotly_dark",
                                      height=270,margin=dict(t=40,b=20,l=20,r=10))
                    st.plotly_chart(fig,use_container_width=True)

            with cb:
                if kyb_dist:
                    order = ["APPROVE","REVIEW","ESCALATE","REJECT"]
                    fig2 = px.bar(x=order,y=[kyb_dist.get(k,0) for k in order],color=order,
                                  color_discrete_map=KYB_C,template="plotly_dark",height=270,
                                  title="KYB Recommendations",labels={"x":"","y":"Companies"})
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
                                  title="Avg Level 1 Confidence",labels={"x":"","y":"Avg"},
                                  color_discrete_sequence=["#68D391","#4299E1","#F6E05E","#9F7AEA","#FC8181"])
                    fig3.add_hline(y=0.80,line_dash="dash",line_color="white")
                    fig3.update_layout(showlegend=False,margin=dict(t=40,b=20,l=20,r=10))
                    st.plotly_chart(fig3,use_container_width=True)

            # AML signal breakdown
            if "AML Flags" in ok_df.columns:
                all_flags = [f.strip() for row_f in ok_df["AML Flags"]
                             for f in str(row_f).split(";")
                             if f.strip() and f.strip() != "—"]
                if all_flags:
                    st.markdown("#### AML Signal Breakdown")
                    fc = Counter(all_flags).most_common()
                    flag_meanings = {
                        "HIGH_RISK_SECTOR":     "Code in AML-elevated NAICS sector (Holding, Banking, Dual-use, Defence)",
                        "REGISTRY_DISCREPANCY": "Web presence diverges from registry — shell company signal",
                        "STRUCTURE_CHANGE":     "Industry code changed across calls — U-Turn fraud signal",
                        "SOURCE_CONFLICT":      "Sources return different industry codes",
                        "TRULIOO_POLLUTION":    "Trulioo returned 4-digit SIC for 5-digit jurisdiction",
                        "LOW_CONSENSUS_PROB":   "Model confidence < 40% — data is ambiguous",
                    }
                    flag_df = pd.DataFrame([
                        {"Signal": f, "Companies": c,
                         "% of Total": f"{c/n:.0%}",
                         "Meaning": flag_meanings.get(f,"")}
                        for f,c in fc
                    ])
                    st.dataframe(flag_df,use_container_width=True,hide_index=True)

            # High-risk companies callout
            if "Risk Level" in ok_df.columns:
                hi = ok_df[ok_df["Risk Level"].isin(["HIGH","CRITICAL"])]
                if not hi.empty:
                    st.markdown(f"#### ⚠️ {len(hi)} companies — HIGH / CRITICAL risk")
                    show = [c for c in ["Company","Jurisdiction","Primary Code","Primary Label",
                                        "Primary Prob","Risk Score","KYB","AML Flags"]
                            if c in hi.columns]
                    st.dataframe(hi[show].sort_values("Risk Score",ascending=False),
                                 use_container_width=True,hide_index=True)

    # ════════════════════════════════════════════════════════
    # TAB 2 — LEVEL 1 SOURCE CONFIDENCES
    # ════════════════════════════════════════════════════════
    with tab_l1:
        st.markdown("""
**Level 1 XGBoost entity matching** — the same model (`entity_matching_20250127 v1`) that runs in the Worth AI production pipeline.  
For each company it outputs a **match confidence 0–1 per source** by comparing name + address using 33 pairwise text similarity features.

| Status | Meaning |
|---|---|
| **MATCHED** | Real vendor record found with high confidence (≥ 0.80) |
| **INFERRED** | Derived from jurisdiction / entity type — no direct vendor match |
| **CONFLICT** | Code returned but contradicts other sources |
| **POLLUTED** | Trulioo returned 4-digit SIC for a 5-digit jurisdiction (data quality) |
| **UNAVAILABLE** | Source did not return a result |

> **Production rule:** only ZoomInfo vs Equifax are compared for the NAICS code. OC, Liberty, Trulioo industry codes are computed but ignored by the current pipeline.
""")

        if single and row is not None:
            # Source cards for single company
            sigs_raw = row.get("_sigs_raw", [])
            cols = st.columns(min(len(sigs_raw), 3)) if sigs_raw else []
            for i, sig in enumerate(sigs_raw):
                with cols[i % len(cols)] if cols else st:
                    st.markdown(_html_src_card(
                        sig.source, sig.confidence, sig.status,
                        sig.raw_code, sig.label
                    ), unsafe_allow_html=True)

            # Bar chart
            if sigs_raw:
                labels  = [s.source.replace("_"," ").title() for s in sigs_raw]
                values  = [s.confidence for s in sigs_raw]
                colours = [SRC_C.get(s.source,"#718096") for s in sigs_raw]
                statuses= [s.status for s in sigs_raw]
                fig = go.Figure(go.Bar(
                    x=labels, y=values, marker_color=colours,
                    text=[f"{v:.3f}<br>{st_}" for v,st_ in zip(values,statuses)],
                    textposition="outside",
                ))
                fig.add_hline(y=0.80,line_dash="dash",line_color="white",
                              annotation_text="0.80 threshold",annotation_position="top right")
                fig.update_layout(title="Level 1 Match Confidence by Source",
                                  yaxis=dict(range=[0,1.15]),template="plotly_dark",
                                  height=320,margin=dict(t=40,b=20),showlegend=False)
                st.plotly_chart(fig,use_container_width=True)

            # Production rule comparison
            zi_c  = float(row.get("ZI Confidence",0))
            efx_c = float(row.get("EFX Confidence",0))
            oc_c  = float(row.get("OC Confidence",0))
            prod_w = str(row.get("Prod Winner",""))
            prod_c = float(row.get("Prod Confidence",0))
            best   = str(row.get("Best Source",""))

            st.markdown("#### Production Rule vs Best Source")
            st.markdown(f"""
| | Source | Confidence | Industry code used |
|---|---|---|---|
| **Best across all sources** | {best.replace('_',' ').title()} | {max(zi_c,efx_c,oc_c):.3f} | {'Yes — but only if ZI or EFX' if best in ('zoominfo','equifax') else '❌ Ignored by production rule'} |
| **Production rule winner** | {prod_w} | {prod_c:.3f} | ✅ NAICS code written to DB |
""")
        else:
            # Batch — confidence heatmap + table
            src_cols = {
                "OC":"OC Confidence","EFX":"EFX Confidence",
                "ZI":"ZI Confidence","Trulioo":"TRU Confidence","Liberty":"LIB Confidence",
            }
            avail = {k:v for k,v in src_cols.items() if v in ok_df.columns}
            if avail:
                heat_data = ok_df[list(avail.values())].apply(
                    pd.to_numeric, errors="coerce").fillna(0).head(50)
                heat_data.columns = list(avail.keys())
                fig_h = px.imshow(heat_data.T,color_continuous_scale="Blues",
                                  aspect="auto",zmin=0,zmax=1,
                                  title="Level 1 Confidence Heatmap (first 50 companies)",
                                  template="plotly_dark",height=300)
                fig_h.update_layout(margin=dict(t=50,b=10,l=80,r=10))
                st.plotly_chart(fig_h,use_container_width=True)

            # Coverage table
            rows_cov = []
            for lbl,col in avail.items():
                v = pd.to_numeric(ok_df[col],errors="coerce").fillna(0)
                hi = int((v>=0.80).sum())
                rows_cov.append({
                    "Source": lbl,
                    "Mean Confidence": f"{v.mean():.3f}",
                    "Median": f"{v.median():.3f}",
                    "≥ 0.80 (Matched)": f"{hi} ({hi/n:.0%})",
                    "< 0.50 (Weak)": f"{(v<0.50).sum()} ({(v<0.50).mean():.0%})",
                    "Used by production?": "✅ NAICS code" if lbl in ("EFX","ZI")
                                           else "⚠️ Match only — NAICS ignored",
                })
            st.dataframe(pd.DataFrame(rows_cov),use_container_width=True,hide_index=True)

            l1_cols = [c for c in ["Company","Jurisdiction",
                "OC Confidence","OC Status","OC Code",
                "EFX Confidence","EFX Status","EFX Code",
                "ZI Confidence","ZI Status","ZI Code",
                "TRU Confidence","TRU Status",
                "LIB Confidence","LIB Status",
                "Best Source","Avg Confidence","Sources ≥ 0.80",
                "Prod Winner","Prod Confidence","Prod NAICS",
            ] if c in ok_df.columns]
            st.dataframe(ok_df[l1_cols],use_container_width=True,hide_index=True)

    # ════════════════════════════════════════════════════════
    # TAB 3 — LEVEL 2 CLASSIFICATION
    # ════════════════════════════════════════════════════════
    with tab_l2:
        st.markdown("""
**Consensus Level 2 XGBoost** — uses all 6 source confidence scores + vendor industry codes  
as a 45-feature vector to produce calibrated probabilities across all industry codes.

Unlike the production rule (1 winner, no probability), Level 2 returns:
top-5 codes with probabilities, correct taxonomy per jurisdiction, and AML/KYB signals.
""")

        if single and row is not None:
            col_codes, col_kyb = st.columns([3, 2])
            with col_codes:
                st.markdown("#### Top-5 Industry Codes — Consensus XGBoost")
                bars_html = ""
                for rank in range(1, 6):
                    code  = str(row.get(f"Rank {rank} Code",""))
                    label = str(row.get(f"Rank {rank} Label",""))
                    prob  = float(row.get(f"Rank {rank} Prob",0))
                    tax   = str(row.get(f"Rank {rank} Tax",""))
                    if code:
                        bars_html += _html_prob_bar(rank, code, label, prob, tax)
                st.markdown(bars_html, unsafe_allow_html=True)

                # LLM column
                if deep and deep.get("llm") and deep["llm"].primary_code:
                    llm = deep["llm"]
                    st.markdown("#### GPT-4o-mini Second Opinion")
                    st.markdown(f"""
- **Code:** `{llm.primary_code}` — {llm.primary_label}
- **Taxonomy:** {llm.primary_taxonomy.replace('_',' ')}
- **Confidence:** {llm.primary_confidence}
""")

            with col_kyb:
                # AML risk signals
                st.markdown("#### AML / KYB Risk Signals")
                sigs_raw = row.get("_signals",[])
                if sigs_raw:
                    for flag, sev, desc in sigs_raw:
                        col_sev = RISK_C.get(sev,"#718096")
                        st.markdown(
                            f'<div style="border-left:4px solid {col_sev};padding:8px 12px;'
                            f'margin-bottom:8px;background:rgba(255,255,255,0.03);border-radius:0 6px 6px 0">'
                            f'<span style="font-weight:700;color:{col_sev}">{sev}</span> — '
                            f'<span style="font-weight:600">{flag}</span><br>'
                            f'<span style="font-size:12px;color:#A0AEC0">{desc}</span></div>',
                            unsafe_allow_html=True,
                        )
                else:
                    st.success("✅ No AML signals detected")

                # External registries
                if deep:
                    ext = deep.get("ext")
                    if ext and ext.edgar:
                        st.markdown("#### SEC EDGAR")
                        st.markdown(f"SIC `{ext.edgar.sic}` — {ext.edgar.sic_description}")
                    if ext and ext.companies_house:
                        st.markdown("#### Companies House")
                        for c,d in zip(ext.companies_house.sic_codes,
                                       ext.companies_house.sic_descriptions):
                            st.markdown(f"SIC `{c}` — {d}")

        else:
            # Batch — taxonomy pie + classification table
            col_a, col_b = st.columns(2)
            with col_a:
                if "Primary Taxonomy" in ok_df.columns:
                    tc = ok_df["Primary Taxonomy"].value_counts().reset_index()
                    tc.columns = ["Taxonomy","Count"]
                    fig_t = px.pie(tc,names="Taxonomy",values="Count",
                                   title="Primary Taxonomy Distribution",
                                   template="plotly_dark",height=300,
                                   color_discrete_sequence=px.colors.qualitative.Safe)
                    fig_t.update_layout(margin=dict(t=40,b=10))
                    st.plotly_chart(fig_t,use_container_width=True)
            with col_b:
                if "Primary Code" in ok_df.columns:
                    top_codes = ok_df["Primary Code"].value_counts().head(10).reset_index()
                    top_codes.columns = ["Code","Count"]
                    fig_c = px.bar(top_codes,x="Count",y="Code",orientation="h",
                                   title="Top-10 Primary Codes",template="plotly_dark",
                                   height=300)
                    fig_c.update_layout(margin=dict(t=40,b=10,l=80))
                    st.plotly_chart(fig_c,use_container_width=True)

            l2_cols = [c for c in [
                "Company","Jurisdiction",
                "Rank 1 Code","Rank 1 Label","Rank 1 Tax","Rank 1 Prob",
                "Rank 2 Code","Rank 2 Label","Rank 2 Prob",
                "Rank 3 Code","Rank 3 Label","Rank 3 Prob",
                "Rank 4 Code","Rank 5 Code",
                "Risk Score","Risk Level","KYB","AML Flags",
            ] if c in ok_df.columns]
            st.dataframe(ok_df[l2_cols],use_container_width=True,hide_index=True)

    # ════════════════════════════════════════════════════════
    # TAB 4 — FULL RESULTS TABLE
    # ════════════════════════════════════════════════════════
    with tab_table:
        st.markdown("Complete results — every column. Use the search box to filter.")

        # Pretty display table
        display_cols = [c for c in [
            "Company","Clean Name","Jurisdiction","Entity Type",
            # Level 1
            "OC Confidence","OC Status","EFX Confidence","EFX Status",
            "ZI Confidence","ZI Status","TRU Confidence","LIB Confidence",
            "Best Source","Avg Confidence","Sources ≥ 0.80",
            # Production
            "Prod Winner","Prod Confidence","Prod NAICS",
            # Level 2
            "Rank 1 Code","Rank 1 Label","Rank 1 Tax","Rank 1 Prob",
            "Rank 2 Code","Rank 2 Label","Rank 2 Prob",
            "Rank 3 Code","Rank 3 Label","Rank 3 Prob",
            "Rank 4 Code","Rank 4 Label","Rank 4 Prob",
            "Rank 5 Code","Rank 5 Label","Rank 5 Prob",
            # Risk
            "Risk Score","Risk Level","KYB","AML Flags","AML Count",
        ] if c in result_df.columns]

        # Format probability columns
        disp_df = result_df[display_cols].copy()
        for col in [c for c in display_cols if "Prob" in c]:
            disp_df[col] = pd.to_numeric(disp_df[col],errors="coerce").apply(
                lambda v: f"{v:.1%}" if pd.notna(v) else "—"
            )
        for col in [c for c in display_cols if "Confidence" in c or "Score" in c]:
            disp_df[col] = pd.to_numeric(disp_df[col],errors="coerce").apply(
                lambda v: f"{v:.3f}" if pd.notna(v) else "—"
            )

        st.dataframe(disp_df, use_container_width=True, hide_index=True, height=500)

    # ════════════════════════════════════════════════════════
    # TAB 5 — DOWNLOAD
    # ════════════════════════════════════════════════════════
    with tab_download:
        st.markdown("Download the complete results in your preferred format.")

        export_cols = [c for c in result_df.columns
                       if not c.startswith("_") and c not in ("_signals","_sigs_raw")]
        export_df = result_df[export_cols].copy()
        for col in [c for c in export_cols if "Prob" in c]:
            export_df[col] = pd.to_numeric(export_df[col],errors="coerce")

        c1,c2 = st.columns(2)
        with c1:
            buf = io.BytesIO()
            export_df.to_excel(buf,index=False,engine="openpyxl")
            buf.seek(0)
            st.download_button(
                "📥 Download Excel (.xlsx)",
                data=buf,
                file_name="industry_classification_results.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            st.caption("Full results with all Level 1 confidences, Level 2 codes, AML flags")
        with c2:
            st.download_button(
                "📥 Download CSV (.csv)",
                data=export_df.to_csv(index=False),
                file_name="industry_classification_results.csv",
                mime="text/csv",
            )
            st.caption("Same data in CSV format for programmatic use")

        # Column dictionary
        with st.expander("Column reference — what each column means"):
            st.markdown("""
| Column | Source | Meaning |
|---|---|---|
| `OC Confidence` | Level 1 XGBoost | OpenCorporates entity match confidence (0–1) |
| `EFX Confidence` | Level 1 XGBoost | Equifax entity match confidence (0–1) |
| `ZI Confidence` | Level 1 XGBoost | ZoomInfo entity match confidence (0–1) |
| `TRU Confidence` | Level 1 XGBoost | Trulioo entity match confidence (0–1) |
| `LIB Confidence` | Level 1 XGBoost | Liberty Data match confidence (0–1) |
| `*Status` | Level 1 | MATCHED / INFERRED / CONFLICT / POLLUTED / UNAVAILABLE |
| `Prod Winner` | Production rule | Which source won (ZI vs EFX only) |
| `Prod NAICS` | Production rule | Code currently written to `customer_files.naics_code` |
| `Rank 1–5 Code` | Consensus L2 | Top-5 NAICS/SIC codes by calibrated probability |
| `Rank 1–5 Prob` | Consensus L2 | Model confidence for each code (0–1) |
| `Rank 1–5 Tax` | Consensus L2 | Taxonomy (NAICS 2022 / UK SIC / NACE / ISIC) |
| `Risk Score` | Risk engine | Composite AML score 0–1 |
| `KYB` | Risk engine | APPROVE / REVIEW / ESCALATE / REJECT |
| `AML Flags` | Risk engine | Signal types detected |
""")


# ═══════════════════════════════════════════════════════════════════════════════
# SIDEBAR + MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def _sidebar():
    st.sidebar.title("🏭 Classification Engine v2")
    st.sidebar.caption("Level 1 Entity Matching + Consensus Level 2 XGBoost")
    st.sidebar.divider()

    # Connection status
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
        key = _get_openai_key()
        if key and len(key) > 10:
            st.sidebar.success("OpenAI: Configured", icon="✅")
        else:
            st.sidebar.info("OpenAI: Not set — LLM disabled", icon="ℹ️")
    except Exception:
        pass

    st.sidebar.divider()
    page = st.sidebar.radio(
        "Navigate",
        ["Classify", "Industry Lookup"],
        index=0,
    )
    mode = None
    if page == "Classify":
        st.sidebar.divider()
        mode = st.sidebar.radio("Input mode", ["Single company", "Batch upload"], index=0)
    return page, mode


# ── Industry Lookup page (ported from app.py) ─────────────────────────────────

def _render_industry_lookup() -> None:
    from industry_dropdown import (
        get_entries, search_entries, get_taxonomy_label,
        taxonomy_for_jurisdiction, get_all_taxonomy_names,
        get_entry_by_code, reload_taxonomy, TAXONOMY_LABELS,
    )
    import jurisdiction_registry as JR

    st.title("Industry Lookup — Jurisdiction-Aware Classification")
    st.markdown(
        "Browse and search industry codes using the **correct taxonomy for each country**. "
        "UK → SIC 2007. EU → NACE Rev.2. US/Canada → NAICS 2022. Others → ISIC Rev.4."
    )

    with st.expander("What this page does — inputs, outputs, and how taxonomy routing works"):
        st.markdown("""
**Industry code selector** for cases where a human needs to choose or verify a classification manually.

| Jurisdiction | Taxonomy shown | Why |
|---|---|---|
| `gb`, `gg`, `je` (UK) | **UK SIC 2007** | Required by Companies House and ONS |
| `us`, `us_*`, `ca`, `ca_*`, `au` | **NAICS 2022** | Official North American standard |
| `de`, `fr`, `it`, `es`, `nl`, `pl`… (EU) | **NACE Rev.2** | Eurostat statistical classification |
| `ae`, `th`, `tz`, `in`… (global) | **ISIC Rev.4** | UN international standard |

1. Select a jurisdiction (type to search — e.g. `gb`, `us_mo`, `ca_bc`, `ae_az`)
2. Type in the Search box to filter by code number OR keyword
3. Click a result to see the full detail card with JSON output
""")

    st.markdown("---")

    # ── 1. Jurisdiction selector ──────────────────────────────────────────────
    st.subheader("1. Select Jurisdiction")
    col_a, col_b, col_c = st.columns([2, 2, 1])

    all_jur = sorted(JR.all_codes())
    jur_display = [f"{jc}  —  {JR.lookup(jc).label if JR.lookup(jc) else jc}" for jc in all_jur]
    jur_map = dict(zip(jur_display, all_jur))

    with col_a:
        default_idx = all_jur.index("gb") if "gb" in all_jur else 0
        selected_display = st.selectbox(
            "Jurisdiction / Country",
            options=jur_display,
            index=default_idx,
            help="Type to search — e.g. 'united kingdom', 'us_mo', 'ca_bc'",
        )
        jc = jur_map[selected_display]

    with col_b:
        auto_tax = taxonomy_for_jurisdiction(jc)
        all_tax_opts = get_all_taxonomy_names()
        auto_idx = all_tax_opts.index(auto_tax) if auto_tax in all_tax_opts else 0
        taxonomy_override_sel = st.selectbox(
            "Taxonomy (auto-selected, can override)",
            options=all_tax_opts,
            index=auto_idx,
            format_func=lambda t: TAXONOMY_LABELS.get(t, t),
        )

    with col_c:
        if st.button("Reload CSV"):
            reload_taxonomy(taxonomy_override_sel)
            st.success("Reloaded.")

    jr_rec    = JR.lookup(jc)
    tax_used  = taxonomy_override_sel
    tax_label = TAXONOMY_LABELS.get(tax_used, tax_used)
    st.info(
        f"**Jurisdiction:** `{jc}` — {jr_rec.label if jr_rec else jc}  |  "
        f"**Sovereign country:** `{jr_rec.iso2 if jr_rec else '?'}`  |  "
        f"**Region:** {jr_rec.region_bucket if jr_rec else '?'}  |  "
        f"**Taxonomy in use:** {tax_label}"
    )

    # ── 2. Search bar ─────────────────────────────────────────────────────────
    st.subheader("2. Search Industry")
    search_col, clear_col = st.columns([5, 1])
    with search_col:
        search_q = st.text_input(
            "Search", placeholder="e.g.  62012   or   software   or   restaurant",
            label_visibility="collapsed",
        )
    with clear_col:
        if st.button("Clear"):
            search_q = ""

    if search_q.strip():
        entries = search_entries(jc, search_q.strip(), taxonomy_override=tax_used)
        st.caption(f"{len(entries)} result(s) for **\"{search_q}\"**")
    else:
        entries = get_entries(jc, taxonomy_override=tax_used)
        st.caption(f"{len(entries)} codes in {tax_label}")

    # ── 3. Select code ────────────────────────────────────────────────────────
    st.subheader("3. Select Industry Code")
    if not entries:
        st.warning("No codes found. Try a different search term or taxonomy.")
    else:
        display_options = [e["display"] for e in entries]
        display_map     = {e["display"]: e for e in entries}
        selected_display_code = st.selectbox(
            "Industry code", options=display_options, label_visibility="collapsed",
        )
        selected_entry = display_map[selected_display_code]

        st.markdown("---")
        st.subheader("Selected Classification")
        d1, d2, d3 = st.columns(3)
        d1.metric("Code",       selected_entry["code"])
        d2.metric("Taxonomy",   selected_entry["taxonomy"].replace("_"," "))
        d3.metric("Jurisdiction", jc.upper())
        st.markdown(f"**Description:** {selected_entry['description']}")
        st.markdown(f"**Official Taxonomy:** {tax_label}")
        if jr_rec:
            st.markdown(
                f"**Jurisdiction:** {jr_rec.label} "
                f"({'Sub-national' if jr_rec.is_subnational else 'Country'} — {jr_rec.iso2})"
            )

        with st.expander("Copy-ready JSON output"):
            st.json({
                "jurisdiction_code":    jc,
                "jurisdiction_label":   jr_rec.label if jr_rec else jc,
                "sovereign_country":    jr_rec.iso2 if jr_rec else "",
                "taxonomy":             selected_entry["taxonomy"],
                "taxonomy_label":       tax_label,
                "industry_code":        selected_entry["code"],
                "industry_description": selected_entry["description"],
            })

    # ── Full browsable table ──────────────────────────────────────────────────
    with st.expander(f"Browse full {tax_label} table ({len(entries)} codes)"):
        df_table = pd.DataFrame([
            {"Code": e["code"], "Description": e["description"]} for e in entries
        ])
        st.dataframe(df_table, use_container_width=True, height=400)
        st.download_button(
            f"Download {tax_used} CSV",
            data=df_table.to_csv(index=False).encode(),
            file_name=f"{tax_used}_{jc}.csv",
            mime="text/csv",
        )

    # ── Cross-taxonomy comparison ─────────────────────────────────────────────
    st.markdown("---")
    st.subheader("Compare Across Taxonomies")
    compare_q = st.text_input("Keyword for cross-taxonomy comparison",
                              placeholder="e.g. restaurant")
    if compare_q.strip():
        compare_cols = st.columns(3)
        for idx, tax in enumerate(["US_NAICS_2022","UK_SIC_2007","NACE_REV2",
                                    "ISIC_REV4","MCC","US_SIC_1987"]):
            matches = search_entries(jc, compare_q.strip(), taxonomy_override=tax, max_results=5)
            with compare_cols[idx % 3]:
                st.markdown(f"**{TAXONOMY_LABELS.get(tax, tax)}**")
                if matches:
                    for m in matches:
                        st.markdown(f"- `{m['code']}` {m['description'][:50]}")
                else:
                    st.caption("No matches")


def main():
    # Pre-warm all models on first render — shows spinner once, then instant
    _prewarm_models()

    page, mode = _sidebar()

    # ── INDUSTRY LOOKUP ───────────────────────────────────────────────────────
    if page == "Industry Lookup":
        _render_industry_lookup()
        return

    # ── CLASSIFY ─────────────────────────────────────────────────────────────
    st.title("🏭 Global Industry Classification Engine v2")
    st.caption(
        "**Level 1** — entity matching confidence per source · "
        "**Level 2** — Consensus XGBoost with calibrated probabilities · "
        "AML / KYB risk signals · Production rule comparison"
    )
    st.divider()

    # ── SINGLE COMPANY ────────────────────────────────────────────────────────
    if mode == "Single company":
        with st.form("single_form"):
            col1, col2, col3 = st.columns([3, 2, 1])
            with col1:
                company = st.text_input("Company name",
                    placeholder="e.g. Apple Inc, Worth AI, JPMORGAN CHASE BANK")
            with col2:
                address = st.text_input("Address (optional)",
                    placeholder="e.g. 1 Infinite Loop, Cupertino CA")
            with col3:
                country = st.text_input("Country", value="US", max_chars=5)
            submitted = st.form_submit_button("▶ Classify", type="primary")

        if submitted and company.strip():
            df_input = pd.DataFrame([{
                "company_name": company.strip(),
                "address":      address.strip(),
                "country":      country.strip(),
                "state":        "",
            }])
            with st.spinner("Classifying …"):
                t0 = time.time()
                results = _classify_rows(df_input, show_progress=False)
                elapsed = time.time() - t0
            st.success(f"Completed in {elapsed:.2f}s")
            st.session_state["single_result"] = results
            st.session_state["single_deep"]   = None

        if "single_result" in st.session_state and st.session_state["single_result"] is not None:
            results = st.session_state["single_result"]
            row     = results.iloc[0]

            if "_error" in results.columns and pd.notna(row.get("_error","")):
                st.error(f"Classification error: {row['_error']}")
            else:
                company_name = str(row.get("Company",""))
                st.markdown(f"## Results for **{company_name}**")

                # Optional deep analysis
                deep = st.session_state.get("single_deep")
                try:
                    from config import _get_openai_key
                    has_key = bool(_get_openai_key())
                except Exception:
                    has_key = False

                if has_key and deep is None:
                    if st.button("🔬 Run Deep Analysis (LLM + external registries)",
                                 help="Adds GPT-4o-mini classification + SEC EDGAR + Companies House (~10s)"):
                        with st.spinner("Running deep analysis …"):
                            deep = _deep_enrich(row)
                        st.session_state["single_deep"] = deep
                        st.rerun()
                elif deep:
                    st.caption("✅ Deep analysis complete (LLM + external registries)")
                else:
                    st.caption("ℹ️ Set OPENAI_API_KEY to enable LLM enrichment")

                _render_result(results, deep=st.session_state.get("single_deep"))

        elif not submitted:
            st.info("Enter a company name above and click **▶ Classify**.")
            st.markdown("""
**Try these examples:**
- `Apple Inc` (US technology)
- `JPMORGAN CHASE BANK` (US finance)
- `Tesco PLC` (UK retail — will show UK SIC 2007)
- `SAP SE` (Germany — will show NACE Rev.2)
- `Foster's Alaska Cabins` (small US business)
""")

    # ── BATCH UPLOAD ──────────────────────────────────────────────────────────
    else:
        st.markdown(
            "Upload a CSV or Excel file. "
            "Required column: `lgl_nm_worth` or `company_name`. "
            "Optional: `address_1_worth`, `city_worth`, `region_worth`, `country_worth`."
        )

        uploaded = st.file_uploader("Upload file", type=["csv","xlsx","xls"])

        sample_path = Path(__file__).parent / "amex_worth_final_cleaned_data_sample_50_nonrandom.csv"
        if sample_path.exists() and st.button("📂 Use sample file (50 NJ companies)"):
            st.session_state["batch_raw"] = pd.read_csv(sample_path)
            st.session_state.pop("batch_results", None)

        if uploaded:
            if uploaded.name.endswith((".xlsx",".xls")):
                st.session_state["batch_raw"] = pd.read_excel(uploaded)
            else:
                st.session_state["batch_raw"] = pd.read_csv(uploaded)
            st.session_state.pop("batch_results", None)

        if "batch_raw" not in st.session_state:
            st.info("Upload a file or click **📂 Use sample file** to begin.")
            return

        raw = st.session_state["batch_raw"]
        df  = _parse_upload(raw)
        n   = len(df)
        st.success(f"{n} companies loaded.")

        with st.expander("Preview input (first 5 rows)"):
            st.dataframe(df[["company_name","address","state","country"]].head(5),
                         use_container_width=True)

        if st.button("▶ Run Batch Classification", type="primary"):
            t0 = time.time()
            results = _classify_rows(df, show_progress=True)
            elapsed = time.time() - t0
            st.session_state["batch_results"] = results
            n_ok = len(results) - (results.get("_error",pd.Series()).notna().sum()
                                   if "_error" in results.columns else 0)
            st.success(f"Done — {n_ok}/{n} classified in {elapsed:.1f}s  "
                       f"({n/elapsed:.0f} companies/s)")

        if "batch_results" not in st.session_state:
            return

        results = st.session_state["batch_results"]
        _render_result(results, deep=None)


if __name__ == "__main__":
    main()
