"""
app_v2.py — Global Industry Classification Engine (v2)
========================================================
Rebuilt from the ground up for speed and clarity.

What it produces per company:
  Level 1 — Entity Matching:
    • Match confidence per source (OC, Equifax, ZoomInfo, Liberty, Trulioo, AI)
    • Source status (MATCHED / POLLUTED / INFERRED / CONFLICT / UNAVAILABLE)
    • Best source, average confidence, sources matched ≥ 0.80

  Level 2 — Consensus XGBoost:
    • Primary industry code + label + calibrated probability
    • Top-3 alternative codes
    • Correct taxonomy per jurisdiction (NAICS / UK SIC / NACE / ISIC)
    • 6 AML/KYB risk signal types
    • KYB recommendation: APPROVE / REVIEW / ESCALATE / REJECT

Modes:
  Single company — type a name, get full analysis instantly
  Batch upload   — CSV/Excel with company names, process all, download results

Performance:
  All models cached via @st.cache_resource (load once, reuse forever)
  Batch runs the fast pipeline: no LLM, no HTTP calls (~0.01s per company)
  Single mode runs the full pipeline with LLM enrichment
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
    page_title="Industry Classification Engine v2",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Colour constants ──────────────────────────────────────────────────────────
SOURCE_COLOURS = {
    "opencorporates": "#68D391",
    "equifax":        "#4299E1",
    "trulioo":        "#9F7AEA",
    "zoominfo":       "#F6E05E",
    "liberty":        "#FC8181",
    "ai_semantic":    "#63B3ED",
}
STATUS_COLOURS = {
    "MATCHED":     "#48BB78",
    "INFERRED":    "#4299E1",
    "CONFLICT":    "#ECC94B",
    "POLLUTED":    "#FC8181",
    "UNAVAILABLE": "#718096",
}
KYB_COLOURS = {
    "APPROVE":  "#48BB78",
    "REVIEW":   "#4299E1",
    "ESCALATE": "#ECC94B",
    "REJECT":   "#FC8181",
}
KYB_BG = {
    "APPROVE":  "#1a4731",
    "REVIEW":   "#1a365d",
    "ESCALATE": "#5c3a00",
    "REJECT":   "#5c1a1a",
}

# ── Model singletons ──────────────────────────────────────────────────────────

@st.cache_resource(show_spinner="Loading taxonomy index (2 330 codes) …")
def _te():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()

@st.cache_resource(show_spinner="Warming up Consensus XGBoost …")
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
def _get_redshift_status():
    try:
        from redshift_connector import get_connector
        rc = get_connector()
        return "LIVE" if rc.is_connected else "SIMULATED"
    except Exception:
        return "SIMULATED"

# ── Column name mapping for uploaded CSVs ─────────────────────────────────────
_COL_MAP = {
    "lgl_nm_worth":   "company_name",
    "lgl_nm_received":"company_name",
    "name":           "company_name",
    "business_name":  "company_name",
    "company":        "company_name",
    "address_1_worth":"address",
    "address":        "address",
    "street_address": "address",
    "city_worth":     "city",
    "region_worth":   "state",
    "zip_code_worth": "zip",
    "country_worth":  "country",
}


def _parse_upload(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for src, dst in _COL_MAP.items():
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src].fillna("").astype(str).str.strip()
    if "company_name" not in df.columns:
        for c in df.columns:
            if any(w in c.lower() for w in ("name", "nm", "company")):
                df["company_name"] = df[c].fillna("").astype(str).str.strip()
                break
    if "company_name" not in df.columns:
        st.error("No company name column found. Expected `lgl_nm_worth` or `company_name`.")
        st.stop()
    for col in ("address", "city", "state", "country"):
        if col not in df.columns:
            df[col] = ""
    df["country"] = df["country"].where(df["country"].str.strip() != "", "US")
    return df


# ── Fast batch pipeline (no LLM / no HTTP) ───────────────────────────────────

def _run_batch(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classify all rows with Entity Resolver + DataSimulator +
    ConsensusEngine + RiskEngine. No LLM, no external HTTP calls.
    ~0.01 s per company after model warm-up.
    """
    er  = _er()
    sim = _sim()
    ce  = _ce()
    rev = _re()

    n = len(df)
    prog   = st.progress(0.0, text="Classifying …")
    t0     = time.time()
    rows   = []

    for i, row in df.iterrows():
        name    = str(row.get("company_name", "") or "").strip()
        address = str(row.get("address", "")      or "").strip()
        country = str(row.get("country", "")      or "").strip()
        state   = str(row.get("state", "")        or "").strip()

        if not name:
            rows.append({"_error": "empty name"})
            prog.progress((i + 1) / n)
            continue

        try:
            entity  = er.resolve(name, address, country or state)
            bundle  = sim.fetch(name, address, country or state,
                                entity.jurisdiction_code, "Operating", "")
            cons    = ce.predict(bundle)
            risk    = rev.evaluate(bundle, cons)

            p1   = cons.primary_industry
            sec  = cons.secondary_industries[:2]
            sigs = bundle.signals

            # Level 1 — per-source confidence
            src_conf = {s.source: round(s.confidence, 4) for s in sigs}
            src_stat = {s.source: s.status                for s in sigs}
            src_code = {s.source: s.raw_code              for s in sigs}

            best_src  = max(src_conf, key=src_conf.get) if src_conf else "—"
            avg_conf  = round(float(np.mean(list(src_conf.values()))), 4) if src_conf else 0
            matched   = sum(1 for c in src_conf.values() if c >= 0.80)
            flags_str = "; ".join(s.flag for s in risk.signals) if risk.signals else "—"
            aml_n     = len(risk.signals)

            rows.append({
                # Identity
                "Company":              name,
                "Clean Name":           entity.clean_name,
                "Jurisdiction":         entity.jurisdiction_code,
                "Entity Type":          entity.detected_entity_type,
                # Level 1 — source confidences
                "L1: OC confidence":    src_conf.get("opencorporates", 0),
                "L1: OC status":        src_stat.get("opencorporates", "—"),
                "L1: OC code":          src_code.get("opencorporates", "—"),
                "L1: EFX confidence":   src_conf.get("equifax", 0),
                "L1: EFX status":       src_stat.get("equifax", "—"),
                "L1: EFX code":         src_code.get("equifax", "—"),
                "L1: ZI confidence":    src_conf.get("zoominfo", 0),
                "L1: ZI status":        src_stat.get("zoominfo", "—"),
                "L1: ZI code":          src_code.get("zoominfo", "—"),
                "L1: TRU confidence":   src_conf.get("trulioo", 0),
                "L1: TRU status":       src_stat.get("trulioo", "—"),
                "L1: Liberty confidence": src_conf.get("liberty", 0),
                "L1: Liberty status":   src_stat.get("liberty", "—"),
                "L1: AI confidence":    src_conf.get("ai_semantic", 0),
                "L1: Best source":      best_src,
                "L1: Avg confidence":   avg_conf,
                "L1: Sources ≥ 0.80":  matched,
                # Production rule (ZI vs EFX winner-takes-all)
                "Prod: Winner":         "zoominfo" if src_conf.get("zoominfo",0) > src_conf.get("equifax",0) else "equifax",
                "Prod: Winner conf":    round(max(src_conf.get("zoominfo",0), src_conf.get("equifax",0)), 4),
                "Prod: NAICS code":     src_code.get("zoominfo","—") if src_conf.get("zoominfo",0) > src_conf.get("equifax",0) else src_code.get("equifax","—"),
                # Level 2 — Consensus XGBoost
                "Cons: Primary code":  p1.code,
                "Cons: Primary label": p1.label,
                "Cons: Probability":   f"{p1.consensus_probability:.1%}",
                "Cons: Probability_f": round(p1.consensus_probability, 4),
                "Cons: Taxonomy":      p1.taxonomy,
                "Cons: 2nd code":      sec[0].code  if sec        else "",
                "Cons: 2nd label":     sec[0].label if sec        else "",
                "Cons: 3rd code":      sec[1].code  if len(sec)>1 else "",
                "Cons: 3rd label":     sec[1].label if len(sec)>1 else "",
                "Cons: Risk score":    round(risk.overall_risk_score, 4),
                "Cons: Risk level":    risk.overall_risk_level,
                "Cons: KYB":          risk.kyb_recommendation,
                "Cons: AML flags":    flags_str,
                "Cons: AML count":    aml_n,
            })
        except Exception as exc:
            rows.append({
                "Company": name,
                "Cons: KYB": "REVIEW",
                "Cons: AML flags": str(exc)[:120],
                "_error": str(exc)[:120],
            })

        if (i + 1) % 5 == 0 or (i + 1) == n:
            elapsed = time.time() - t0
            rate    = (i + 1) / elapsed if elapsed > 0 else 999
            eta     = (n - i - 1) / rate if rate > 0 else 0
            prog.progress(
                (i + 1) / n,
                text=f"Classifying {i+1}/{n} — {rate:.0f} companies/s — ETA {eta:.0f}s",
            )

    prog.empty()
    return pd.DataFrame(rows)


# ── Full single-company pipeline (with LLM) ───────────────────────────────────

def _run_single(name: str, address: str, country: str) -> tuple:
    from llm_enrichment import enrich_company_profile, llm_classify
    from external_lookup import lookup_all as _ext_lookup

    er  = _er()
    sim = _sim()
    ce  = _ce()
    rev = _re()
    te  = _te()

    entity      = er.resolve(name, address, country)
    llm_profile = enrich_company_profile(name, address, country or entity.detected_jurisdiction, "")
    query       = f"{llm_profile.primary_business_description} {name}"
    ugo         = te.search(query, top_k=10)
    candidates  = {}
    for rec, score in ugo:
        candidates.setdefault(rec.taxonomy, []).append(
            {"code": rec.code, "description": rec.description, "score": round(float(score), 4)}
        )
    ext_reg = _ext_lookup(name, entity.jurisdiction_code)
    bundle  = sim.fetch(name, address, country, entity.jurisdiction_code,
                        llm_profile.probable_entity_type, llm_profile.primary_business_description)
    vendor_signals = [
        {"source": s.source, "raw_code": s.raw_code, "taxonomy": s.taxonomy,
         "label": s.label, "weight": s.weight, "status": s.status, "confidence": s.confidence}
        for s in bundle.signals if s.raw_code
    ]
    llm_result = llm_classify(
        company_name=name,
        business_description=llm_profile.primary_business_description,
        jurisdiction=entity.jurisdiction_code,
        candidates_by_taxonomy=candidates,
        web_summary=llm_profile.web_summary,
        vendor_signals=vendor_signals,
        external_registry=ext_reg,
        entity_type=llm_profile.probable_entity_type,
    )
    cons = ce.predict(bundle)
    risk = rev.evaluate(bundle, cons)
    cons.risk_signals = [s.to_dict() for s in risk.signals]
    return entity, bundle, cons, risk, llm_result, ext_reg


# ── Rendering helpers ─────────────────────────────────────────────────────────

def _confidence_gauge(value: float, title: str) -> go.Figure:
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=value,
        number={"suffix": "", "valueformat": ".3f"},
        title={"text": title, "font": {"size": 13}},
        gauge={
            "axis": {"range": [0, 1], "tickformat": ".1f"},
            "steps": [
                {"range": [0.00, 0.50], "color": "#742A2A"},
                {"range": [0.50, 0.80], "color": "#744210"},
                {"range": [0.80, 1.00], "color": "#276749"},
            ],
            "threshold": {"line": {"color": "white", "width": 3}, "value": 0.80},
            "bar": {"color": "rgba(255,255,255,0.25)"},
        },
    ))
    fig.update_layout(height=180, margin=dict(t=30, b=5, l=10, r=10), template="plotly_dark")
    return fig


def _source_bar(signals) -> go.Figure:
    labels = [s.source.replace("_", " ").title() for s in signals]
    values = [s.confidence for s in signals]
    colours = [SOURCE_COLOURS.get(s.source, "#718096") for s in signals]
    statuses = [s.status for s in signals]

    fig = go.Figure(go.Bar(
        x=labels, y=values,
        marker_color=colours,
        text=[f"{v:.2f}<br><span style='font-size:10px'>{st}</span>"
              for v, st in zip(values, statuses)],
        textposition="outside",
        hovertemplate="<b>%{x}</b><br>Confidence: %{y:.3f}<br>Status: %{customdata}<extra></extra>",
        customdata=statuses,
    ))
    fig.add_hline(y=0.80, line_dash="dash", line_color="white",
                  annotation_text="0.80 threshold", annotation_position="top right")
    fig.update_layout(
        title="Level 1 — Source Match Confidence",
        yaxis=dict(range=[0, 1.1], title="Confidence"),
        template="plotly_dark",
        height=280,
        margin=dict(t=40, b=20, l=20, r=20),
        showlegend=False,
    )
    return fig


def _kyb_badge(kyb: str) -> str:
    bg = KYB_BG.get(kyb, "#374151")
    return (
        f'<div style="background:{bg};padding:10px 20px;border-radius:8px;'
        f'font-size:1.1em;font-weight:800;color:white;text-align:center;">'
        f'KYB: {kyb}</div>'
    )


def _prob_bar(prob: float, code: str, label: str, rank: int) -> str:
    pct    = int(prob * 100)
    colour = "#48BB78" if pct >= 70 else "#ECC94B" if pct >= 40 else "#FC8181"
    return (
        f'<div style="margin-bottom:8px">'
        f'<div style="font-size:11px;color:#A0AEC0;margin-bottom:2px">#{rank} — {code}</div>'
        f'<div style="font-size:13px;color:#E2E8F0;margin-bottom:4px">{label}</div>'
        f'<div style="background:#2D3748;border-radius:4px;height:14px;width:100%">'
        f'<div style="background:{colour};height:14px;border-radius:4px;width:{pct}%;'
        f'display:flex;align-items:center;padding-left:6px">'
        f'<span style="font-size:10px;font-weight:700;color:white">{prob:.0%}</span></div></div></div>'
    )


def _render_single(name, bundle, cons, risk, llm, ext_reg) -> None:
    """Render full single-company analysis."""
    p1   = cons.primary_industry
    sigs = bundle.signals

    # ── Row 1: KYB verdict + summary metrics ─────────────────────────────────
    st.markdown(_kyb_badge(risk.kyb_recommendation), unsafe_allow_html=True)
    st.markdown("")

    m1, m2, m3, m4, m5 = st.columns(5)
    m1.metric("Primary Code",   p1.code)
    m2.metric("Taxonomy",       p1.taxonomy.replace("_", " "))
    m3.metric("Probability",    f"{p1.consensus_probability:.0%}")
    m4.metric("Risk Score",     f"{risk.overall_risk_score:.3f}")
    m5.metric("Risk Level",     risk.overall_risk_level)

    st.divider()

    # ── Row 2: Level 1 bar chart + gauges ────────────────────────────────────
    st.markdown("### Level 1 — Entity Matching Source Confidences")
    st.caption(
        "These confidence scores come from the Level 1 XGBoost entity matching model. "
        "Each score (0–1) measures how well this company matches a record in that vendor's database. "
        "≥ 0.80 = matched. The production rule uses only ZoomInfo vs Equifax for the NAICS code — "
        "OC, Liberty, and Trulioo industry codes are ignored by the current pipeline."
    )

    col_bar, col_info = st.columns([3, 1])
    with col_bar:
        st.plotly_chart(_source_bar(sigs), use_container_width=True)
    with col_info:
        best_src  = max(sigs, key=lambda s: s.confidence) if sigs else None
        avg_c     = np.mean([s.confidence for s in sigs]) if sigs else 0
        matched_n = sum(1 for s in sigs if s.confidence >= 0.80)
        st.markdown(f"**Best source:** {best_src.source if best_src else '—'}")
        st.markdown(f"**Best confidence:** {best_src.confidence:.3f}" if best_src else "")
        st.markdown(f"**Avg confidence:** {avg_c:.3f}")
        st.markdown(f"**Sources ≥ 0.80:** {matched_n}/{len(sigs)}")
        zi_c  = next((s.confidence for s in sigs if s.source == "zoominfo"), 0)
        efx_c = next((s.confidence for s in sigs if s.source == "equifax"), 0)
        prod_win = "zoominfo" if zi_c > efx_c else "equifax"
        st.markdown(f"**Production winner:** {prod_win} ({max(zi_c, efx_c):.3f})")

    # Source lineage table
    with st.expander("Source lineage detail", expanded=False):
        lineage_rows = []
        for s in sigs:
            lineage_rows.append({
                "Source":     s.source.replace("_", " ").title(),
                "Raw Code":   s.raw_code,
                "Taxonomy":   s.taxonomy.replace("_", " "),
                "Label":      s.label[:50] if s.label else "",
                "Confidence": f"{s.confidence:.3f}",
                "Status":     s.status,
                "Weight":     f"{s.weight:.2f}",
            })
        lineage_df = pd.DataFrame(lineage_rows)
        st.dataframe(lineage_df, use_container_width=True, hide_index=True)
        st.caption("""
**Status values:**
- MATCHED — real Redshift record found with high confidence
- INFERRED — derived from entity type / jurisdiction (no direct API match)
- CONFLICT — code returned but contradicts other sources
- POLLUTED — Trulioo 4-digit SIC returned for a 5-digit jurisdiction (data quality issue)
- UNAVAILABLE — source did not return a result
""")

    st.divider()

    # ── Row 3: Level 2 Consensus classification ───────────────────────────────
    st.markdown("### Level 2 — Consensus XGBoost Industry Classification")
    st.caption(
        "The Consensus XGBoost model uses the Level 1 confidence scores + vendor industry codes "
        "as a 45-feature input vector and produces calibrated probabilities across all NAICS classes. "
        "Unlike the production rule, it uses ALL 6 sources and routes to the correct taxonomy per jurisdiction."
    )

    col_codes, col_llm = st.columns(2)

    with col_codes:
        st.markdown("**Top-3 Predictions (Consensus XGBoost)**")
        all_codes = [cons.primary_industry] + cons.secondary_industries[:2]
        prob_html = "".join(
            _prob_bar(c.consensus_probability, c.code, c.label, i + 1)
            for i, c in enumerate(all_codes)
        )
        st.markdown(prob_html, unsafe_allow_html=True)

    with col_llm:
        st.markdown("**GPT-4o-mini Classification (LLM Referee)**")
        if llm and llm.primary_code:
            st.markdown(
                f"**Code:** `{llm.primary_code}` — {llm.primary_label}  \n"
                f"**Taxonomy:** {llm.primary_taxonomy.replace('_',' ')}  \n"
                f"**Confidence:** {llm.primary_confidence}  \n"
                f"**Source used:** {getattr(llm,'source_used','—')}"
            )
            if getattr(llm, "registry_conflict", False):
                st.warning(f"Registry conflict: {getattr(llm,'registry_conflict_note','')}")
        else:
            st.info("LLM unavailable or no API key set.")

    # External registries
    if ext_reg and (ext_reg.edgar or ext_reg.companies_house):
        st.markdown("**Government Registry Sources**")
        reg_rows = []
        if ext_reg.edgar:
            reg_rows.append({"Registry": "SEC EDGAR",
                             "Code": ext_reg.edgar.sic,
                             "Label": ext_reg.edgar.sic_description,
                             "Taxonomy": "US SIC 1987"})
        if ext_reg.companies_house:
            for c, d in zip(ext_reg.companies_house.sic_codes,
                            ext_reg.companies_house.sic_descriptions):
                reg_rows.append({"Registry": "Companies House",
                                 "Code": c, "Label": d, "Taxonomy": "UK SIC 2007"})
        if reg_rows:
            st.dataframe(pd.DataFrame(reg_rows), use_container_width=True, hide_index=True)

    st.divider()

    # ── Row 4: AML / KYB ─────────────────────────────────────────────────────
    st.markdown("### AML / KYB Risk Assessment")
    st.caption("Based on 6 signal types: source conflict, registry discrepancy, "
               "temporal pivot, shell company indicators, Trulioo pollution, low consensus probability.")

    if risk.signals:
        for sig in risk.signals:
            colour = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}.get(sig.severity, "⚪")
            st.markdown(f"{colour} **{sig.flag}** ({sig.severity}) — {sig.description}")
    else:
        st.success("✅ No AML/KYB risk signals detected.")

    st.divider()

    # ── Row 5: Entity resolution ──────────────────────────────────────────────
    with st.expander("Entity resolution detail", expanded=False):
        from entity_resolver import EntityProfile
        st.json({
            "clean_name":         bundle.company_name,
            "jurisdiction_code":  bundle.jurisdiction,
            "entity_type":        bundle.entity_type,
            "web_summary":        (bundle.web_summary[:200] + "…") if bundle.web_summary else "",
        })


# ── Charts for batch results ──────────────────────────────────────────────────

def _batch_charts(df: pd.DataFrame) -> None:
    n = len(df)

    ca, cb, cc = st.columns(3)

    with ca:
        if "Cons: Probability_f" in df.columns:
            probs = pd.to_numeric(df["Cons: Probability_f"], errors="coerce").dropna()
            fig = go.Figure(go.Histogram(x=probs, nbinsx=20,
                                         marker_color="#48BB78", opacity=0.85))
            fig.add_vline(x=0.70, line_dash="dash", line_color="white",
                          annotation_text="70% HIGH")
            fig.add_vline(x=0.40, line_dash="dash", line_color="#ECC94B",
                          annotation_text="40% MED")
            fig.update_layout(title="Consensus Probability",
                              xaxis_title="Top-1 Probability", yaxis_title="Companies",
                              template="plotly_dark", height=280, margin=dict(t=40,b=20))
            st.plotly_chart(fig, use_container_width=True)

    with cb:
        if "Cons: KYB" in df.columns:
            kyb_order  = ["APPROVE", "REVIEW", "ESCALATE", "REJECT"]
            kyb_counts = df["Cons: KYB"].value_counts()
            vals = [kyb_counts.get(k, 0) for k in kyb_order]
            fig2 = px.bar(x=kyb_order, y=vals, color=kyb_order,
                          color_discrete_map={k: KYB_COLOURS[k] for k in kyb_order},
                          template="plotly_dark", height=280,
                          title="KYB Recommendations",
                          labels={"x": "", "y": "Companies"})
            fig2.update_layout(showlegend=False, margin=dict(t=40,b=20))
            st.plotly_chart(fig2, use_container_width=True)

    with cc:
        # L1 source confidence comparison
        src_means = {}
        for src, col in [("OC","L1: OC confidence"),("EFX","L1: EFX confidence"),
                          ("ZI","L1: ZI confidence"),("Liberty","L1: Liberty confidence"),
                          ("Trulioo","L1: TRU confidence")]:
            if col in df.columns:
                src_means[src] = round(pd.to_numeric(df[col], errors="coerce").mean(), 3)
        if src_means:
            fig3 = px.bar(
                x=list(src_means.keys()), y=list(src_means.values()),
                title="Avg Level 1 Confidence by Source",
                template="plotly_dark", height=280,
                labels={"x": "Source", "y": "Avg Confidence"},
                color=list(src_means.keys()),
                color_discrete_sequence=["#68D391","#4299E1","#F6E05E","#FC8181","#9F7AEA"],
            )
            fig3.add_hline(y=0.80, line_dash="dash", line_color="white")
            fig3.update_layout(showlegend=False, margin=dict(t=40,b=20))
            st.plotly_chart(fig3, use_container_width=True)

    # AML signal breakdown
    if "Cons: AML flags" in df.columns:
        all_flags = [
            f.strip() for row in df["Cons: AML flags"]
            for f in str(row).split(";")
            if f.strip() and f.strip() != "—"
        ]
        if all_flags:
            fc = Counter(all_flags).most_common()
            st.markdown("**AML Signal Breakdown**")
            flag_df = pd.DataFrame(
                [(f, c, f"{c/n:.0%}") for f, c in fc],
                columns=["Signal", "Companies", "% of Total"],
            )
            st.dataframe(flag_df, use_container_width=True, hide_index=True)


# ── Sidebar ───────────────────────────────────────────────────────────────────

def _sidebar():
    st.sidebar.title("🏭 Classification Engine v2")
    st.sidebar.caption("Level 1 Entity Matching + Consensus Level 2 XGBoost")
    st.sidebar.divider()

    # Redshift status
    rs_status = _get_redshift_status()
    if rs_status == "LIVE":
        st.sidebar.success("Redshift: LIVE", icon="✅")
    else:
        st.sidebar.warning("Redshift: SIMULATED", icon="⚠️")
        st.sidebar.caption("Set REDSHIFT_* env vars to use real data.")

    # OpenAI status
    try:
        from config import _get_openai_key
        key = _get_openai_key()
        if key and len(key) > 10:
            st.sidebar.success("OpenAI: Configured", icon="✅")
        else:
            st.sidebar.warning("OpenAI: Not set", icon="⚠️")
            st.sidebar.caption("LLM enrichment disabled in Single mode.")
    except Exception:
        pass

    st.sidebar.divider()
    mode = st.sidebar.radio(
        "Input mode",
        ["Single company", "Batch upload"],
        index=0,
    )
    return mode


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    mode = _sidebar()

    st.title("🏭 Global Industry Classification Engine v2")
    st.markdown(
        "**Level 1** entity matching confidence per source · "
        "**Level 2** Consensus XGBoost classification · "
        "Production rule comparison · AML/KYB risk signals"
    )
    st.divider()

    # ═══════════════════════════════════════════════════════════════
    # MODE A — SINGLE COMPANY
    # ═══════════════════════════════════════════════════════════════
    if mode == "Single company":
        with st.form("single_form"):
            col1, col2, col3 = st.columns([3, 2, 1])
            with col1:
                company = st.text_input("Company name", placeholder="e.g. Apple Inc")
            with col2:
                address = st.text_input("Address (optional)", placeholder="1 Infinite Loop, CA")
            with col3:
                country = st.text_input("Country", value="US", max_chars=5)
            submitted = st.form_submit_button("▶ Classify", type="primary")

        if submitted and company.strip():
            with st.spinner("Running full pipeline (entity resolution → LLM → consensus → risk) …"):
                t0 = time.time()
                try:
                    entity, bundle, cons, risk, llm, ext_reg = _run_single(
                        company.strip(), address.strip(), country.strip()
                    )
                    elapsed = time.time() - t0
                    st.success(f"Completed in {elapsed:.1f}s")
                    st.session_state["single_result"] = (company, entity, bundle, cons, risk, llm, ext_reg)
                except Exception as exc:
                    st.error(f"Pipeline error: {exc}")
                    st.session_state.pop("single_result", None)

        if "single_result" in st.session_state:
            company, entity, bundle, cons, risk, llm, ext_reg = st.session_state["single_result"]
            st.markdown(f"## {company}")
            _render_single(company, bundle, cons, risk, llm, ext_reg)

        elif not submitted:
            st.info("Enter a company name above and click **▶ Classify**.")

    # ═══════════════════════════════════════════════════════════════
    # MODE B — BATCH UPLOAD
    # ═══════════════════════════════════════════════════════════════
    else:
        st.markdown(
            "Upload a CSV or Excel file with company names. "
            "Supported column names: `lgl_nm_worth`, `company_name`, `name`. "
            "Optional: `address_1_worth`, `city_worth`, `region_worth`, `country_worth`."
        )

        uploaded = st.file_uploader("Upload file", type=["csv", "xlsx", "xls"])

        # Sample data button
        sample_path = Path(__file__).parent / "amex_worth_final_cleaned_data_sample_50_nonrandom.csv"
        if sample_path.exists():
            if st.button("📂 Use sample file (50 companies)"):
                st.session_state["batch_upload_df"] = pd.read_csv(sample_path)
                st.session_state.pop("batch_results", None)

        if uploaded:
            if uploaded.name.endswith((".xlsx", ".xls")):
                raw_df = pd.read_excel(uploaded)
            else:
                raw_df = pd.read_csv(uploaded)
            st.session_state["batch_upload_df"] = raw_df
            st.session_state.pop("batch_results", None)

        if "batch_upload_df" not in st.session_state:
            st.info("Upload a file or click **Use sample file** to begin.")
            return

        raw_df = st.session_state["batch_upload_df"]
        df     = _parse_upload(raw_df)
        n      = len(df)
        st.success(f"{n} companies loaded. Click **▶ Run Batch Classification** to classify.")

        with st.expander("Preview input", expanded=False):
            st.dataframe(df[["company_name", "address", "state", "country"]].head(10),
                         use_container_width=True)

        if st.button("▶ Run Batch Classification", type="primary"):
            t0 = time.time()
            results_df = _run_batch(df)
            elapsed = time.time() - t0
            st.session_state["batch_results"] = results_df
            st.success(f"Done — {n} companies classified in {elapsed:.1f}s ({n/elapsed:.0f}/s)")

        if "batch_results" not in st.session_state:
            return

        results_df = st.session_state["batch_results"]
        n_ok = results_df["_error"].isna().sum() if "_error" in results_df.columns else len(results_df)

        # ── Summary metrics ───────────────────────────────────────────────────
        kyb_dist = results_df["Cons: KYB"].value_counts().to_dict() if "Cons: KYB" in results_df.columns else {}
        prob_col  = pd.to_numeric(results_df.get("Cons: Probability_f", pd.Series()), errors="coerce")
        aml_any   = int((results_df.get("Cons: AML count", pd.Series()) > 0).sum())

        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("Total", n)
        c2.metric("APPROVE",         kyb_dist.get("APPROVE", 0))
        c3.metric("REVIEW",          kyb_dist.get("REVIEW", 0))
        c4.metric("ESCALATE/REJECT", kyb_dist.get("ESCALATE",0)+kyb_dist.get("REJECT",0))
        c5.metric("Avg Probability",  f"{prob_col.mean():.0%}" if not prob_col.empty else "—")
        c6.metric("AML Flagged",     aml_any)

        st.divider()

        # ── Tabs: charts / L1 table / L2 table / full table / download ────────
        tab_charts, tab_l1, tab_l2, tab_full = st.tabs([
            "📊 Charts",
            "🔍 Level 1 — Source Confidences",
            "🏭 Level 2 — Classification",
            "📋 Full Results",
        ])

        with tab_charts:
            _batch_charts(results_df)

        with tab_l1:
            st.markdown("""
**Level 1 XGBoost entity matching confidence scores per source.**

Each confidence is the output of `entity_matching_20250127 v1` — the probability
that this company record is the same real-world entity as a record in that vendor's database.

| Value | Meaning |
|---|---|
| ≥ 0.80 | Matched — confident the company was found |
| 0.50–0.79 | Possible match — use with caution |
| < 0.50 | Weak / no match |

**Production rule:** only ZoomInfo vs Equifax are compared for the NAICS code.
OC and Liberty confidences are computed but their industry codes are ignored.
""")
            l1_cols = [c for c in [
                "Company", "Jurisdiction",
                "L1: OC confidence",   "L1: OC status",   "L1: OC code",
                "L1: EFX confidence",  "L1: EFX status",  "L1: EFX code",
                "L1: ZI confidence",   "L1: ZI status",   "L1: ZI code",
                "L1: TRU confidence",  "L1: TRU status",
                "L1: Liberty confidence", "L1: Liberty status",
                "L1: Best source", "L1: Avg confidence", "L1: Sources ≥ 0.80",
                "Prod: Winner", "Prod: Winner conf", "Prod: NAICS code",
            ] if c in results_df.columns]
            st.dataframe(results_df[l1_cols], use_container_width=True, hide_index=True)

        with tab_l2:
            st.markdown("""
**Consensus Level 2 XGBoost classification results.**

The model uses all 6 source confidence scores + vendor industry codes
as a 45-feature input vector and outputs calibrated probabilities.

| Column | Meaning |
|---|---|
| Cons: Primary code | Top-1 NAICS/SIC/NACE code |
| Cons: Probability | Calibrated confidence (0–100%) |
| Cons: Taxonomy | Correct taxonomy for this jurisdiction |
| Cons: KYB | APPROVE / REVIEW / ESCALATE / REJECT |
| Cons: AML flags | Risk signals detected |
""")
            l2_cols = [c for c in [
                "Company", "Jurisdiction",
                "Cons: Primary code",  "Cons: Primary label", "Cons: Probability",
                "Cons: Taxonomy",
                "Cons: 2nd code",  "Cons: 2nd label",
                "Cons: 3rd code",  "Cons: 3rd label",
                "Cons: Risk score", "Cons: Risk level",
                "Cons: KYB", "Cons: AML flags",
            ] if c in results_df.columns]
            st.dataframe(results_df[l2_cols], use_container_width=True, hide_index=True)

            # High-risk table
            if "Cons: Risk level" in results_df.columns:
                high_risk = results_df[results_df["Cons: Risk level"].isin(["HIGH","CRITICAL"])]
                if not high_risk.empty:
                    st.markdown(f"**⚠️ {len(high_risk)} companies — HIGH / CRITICAL risk:**")
                    st.dataframe(
                        high_risk[l2_cols].sort_values("Cons: Risk score", ascending=False),
                        use_container_width=True, hide_index=True,
                    )

        with tab_full:
            all_cols = [c for c in results_df.columns if not c.startswith("_")]
            st.dataframe(results_df[all_cols], use_container_width=True, hide_index=True)

        # ── Download ──────────────────────────────────────────────────────────
        st.divider()
        export_cols = [c for c in results_df.columns if not c.startswith("_")]
        c_d1, c_d2 = st.columns(2)
        with c_d1:
            buf = io.BytesIO()
            results_df[export_cols].to_excel(buf, index=False, engine="openpyxl")
            buf.seek(0)
            st.download_button("📥 Download Excel", data=buf,
                               file_name="classification_results_v2.xlsx",
                               mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        with c_d2:
            st.download_button("📥 Download CSV",
                               data=results_df[export_cols].to_csv(index=False),
                               file_name="classification_results_v2.csv",
                               mime="text/csv")


if __name__ == "__main__":
    main()
