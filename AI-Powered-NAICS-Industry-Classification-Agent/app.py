"""
Global Industry Classification Consensus Engine
================================================
Main Streamlit application.

Pages
-----
1. Single Company Lookup  — real-time full pipeline
2. Batch Classification   — upload CSV/Excel, process all rows
3. Risk Dashboard         — visual AML/KYB signal explorer
4. Taxonomy Explorer      — browse/search the Unified Global Ontology
5. Industry Lookup        — jurisdiction-aware searchable industry dropdown
"""

from __future__ import annotations

import json
import time
import logging
from io import BytesIO
from typing import Optional

import streamlit as st
import pandas as pd

# ── Page config must be the very first Streamlit call ────────────────────────
st.set_page_config(
    page_title="Global Industry Classification Engine",
    page_icon="🌐",
    layout="wide",
    initial_sidebar_state="expanded",
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ── Lazy-load heavy components (cached after first load) ──────────────────────

@st.cache_resource(show_spinner="Step 1/3 — Loading taxonomy index (2,330 industry codes across 6 systems)… ~20s")
def get_taxonomy_engine():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()


@st.cache_resource(show_spinner="Step 2/3 — Training consensus model on 300 samples… ~15s on first load, cached afterwards")
def get_consensus_engine():
    from consensus_engine import IndustryConsensusEngine
    te = get_taxonomy_engine()
    return IndustryConsensusEngine(taxonomy_engine=te)


@st.cache_resource(show_spinner=False)
def get_risk_engine():
    from risk_engine import RiskEngine
    te = get_taxonomy_engine()
    return RiskEngine(taxonomy_engine=te)


@st.cache_resource(show_spinner=False)
def get_entity_resolver():
    from entity_resolver import EntityResolver
    return EntityResolver()


@st.cache_resource(show_spinner=False)
def get_data_simulator():
    from data_simulator import DataSimulator
    return DataSimulator()


# ── Colour palette for risk levels ───────────────────────────────────────────
# Imported from risk_engine so it is defined in exactly one place.
from risk_engine import _RISK_COLOURS

_SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH":     "🟠",
    "MEDIUM":   "🟡",
    "LOW":      "🟢",
    "INFO":     "🔵",
}


def _badge(text: str, colour: str) -> str:
    return (
        f'<span style="background:{colour};color:white;padding:2px 8px;'
        f'border-radius:4px;font-size:12px;font-weight:600">{text}</span>'
    )


def _risk_badge(level: str) -> str:
    return _badge(level, _RISK_COLOURS.get(level, "#666"))


# ────────────────────────────────────────────────────────────────────────────────
# PAGE HELPERS
# ────────────────────────────────────────────────────────────────────────────────

def run_full_pipeline(
    company_name: str,
    address: str = "",
    country: str = "",
    web_summary: str = "",
    force_conflict: bool = False,
) -> tuple:
    """
    Execute the full pipeline:
    EntityResolver → DataSimulator → ConsensusEngine → RiskEngine → LLM Enrichment
    Returns (profile, bundle, consensus_result, risk_profile, llm_result).
    """
    from llm_enrichment import enrich_company_profile, llm_classify

    er   = get_entity_resolver()
    sim  = get_data_simulator()
    ce   = get_consensus_engine()
    re   = get_risk_engine()
    te   = get_taxonomy_engine()

    # 1. Entity resolution
    entity = er.resolve(company_name, address, country)

    # 2. LLM enrichment (web search + GPT profile)
    llm_profile = enrich_company_profile(
        company_name=company_name,
        address=address,
        country=country or entity.detected_jurisdiction,
        web_summary=web_summary,
    )

    # 3. UGO candidate retrieval
    query = f"{llm_profile.primary_business_description} {company_name}"
    ugo_results = te.search(query, top_k=10)

    candidates_by_taxonomy: dict = {}
    for rec, score in ugo_results:
        candidates_by_taxonomy.setdefault(rec.taxonomy, []).append(
            {"code": rec.code, "description": rec.description, "score": round(float(score), 4)}
        )

    # 4a. External registry lookup (SEC EDGAR / Companies House — free, no key needed for EDGAR)
    from external_lookup import lookup_all as _ext_lookup
    external_registry = _ext_lookup(company_name, entity.jurisdiction_code)

    # 4b. LLM multi-taxonomy classification — now acts as referee with full context
    # Prepare vendor signals for prompt injection
    vendor_signals_for_llm = []
    # We don't have bundle yet (it's built in step 5), so we pass None here
    # and the prompt will use the external registry + UGO candidates as anchors.
    # After bundle is built we could re-call, but one LLM call is sufficient.

    llm_result = llm_classify(
        company_name=company_name,
        business_description=llm_profile.primary_business_description,
        jurisdiction=entity.jurisdiction_code,
        candidates_by_taxonomy=candidates_by_taxonomy,
        web_summary=llm_profile.web_summary,
        vendor_signals=None,             # populated post-bundle in display
        external_registry=external_registry,
        entity_type=llm_profile.probable_entity_type,
    )

    # 5. Vendor simulation (OpenCorporates + Equifax + Trulioo + ZoomInfo + Liberty Data + AI)
    bundle = sim.fetch(
        company_name=company_name,
        address=address,
        country=country,
        jurisdiction=entity.jurisdiction_code,
        entity_type=llm_profile.probable_entity_type,
        web_summary=llm_profile.primary_business_description,
        force_conflict=force_conflict,
    )

    # 5a. Re-run LLM classification with vendor signals now available
    # This gives the LLM the full picture: registry + vendor consensus + UGO candidates
    vendor_signals_for_llm = [
        {
            "source":     s.source,
            "raw_code":   s.raw_code,
            "taxonomy":   s.taxonomy,
            "label":      s.label,
            "weight":     s.weight,
            "status":     s.status,
            "confidence": s.confidence,
        }
        for s in bundle.signals
        if s.raw_code  # skip UNAVAILABLE signals
    ]

    llm_result = llm_classify(
        company_name=company_name,
        business_description=llm_profile.primary_business_description,
        jurisdiction=entity.jurisdiction_code,
        candidates_by_taxonomy=candidates_by_taxonomy,
        web_summary=llm_profile.web_summary,
        vendor_signals=vendor_signals_for_llm,
        external_registry=external_registry,
        entity_type=llm_profile.probable_entity_type,
    )

    # 6. Consensus model
    consensus_result = ce.predict(bundle)

    # 7. Risk evaluation
    risk_profile = re.evaluate(bundle, consensus_result)
    consensus_result.risk_signals = [s.to_dict() for s in risk_profile.signals]

    return entity, bundle, consensus_result, risk_profile, llm_result, external_registry


def display_consensus_result(
    entity, bundle, result, risk_profile, llm_result, external_registry=None
) -> None:
    """Render the full consensus output — clean story-driven layout."""

    prob    = result.primary_industry.consensus_probability
    rlvl    = risk_profile.overall_risk_level
    kyb     = risk_profile.kyb_recommendation
    debug   = result.feature_debug

    # ── KYB action colour ─────────────────────────────────────────────────────
    KYB_COLOUR = {"APPROVE":"#2E7D32","REVIEW":"#F57F17","ESCALATE":"#E65100","REJECT":"#C62828"}
    kyb_colour = KYB_COLOUR.get(kyb, "#546E7A")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 1 — VERDICT (what the team needs to know in 3 seconds)
    # ═══════════════════════════════════════════════════════════════════════════
    st.markdown("## Classification Verdict")

    v1, v2, v3, v4, v5 = st.columns(5)
    v1.metric("Company", entity.clean_name)
    v2.metric("Jurisdiction", f"{debug.get('jurisdiction_code','')} — {debug.get('jurisdiction_label','')}")
    v3.metric("Entity Type", result.entity_type)
    v4.metric("Consensus Probability", f"{prob:.1%}",
              help="XGBoost Model 2 softmax probability. ≥70% = high confidence. <40% = review needed.")
    kyb_delta = {"APPROVE":"✅ Low risk","REVIEW":"🟡 Review needed","ESCALATE":"🟠 Escalate","REJECT":"🔴 Reject"}
    v5.metric("KYB Recommendation", kyb, delta=kyb_delta.get(kyb,""), delta_color="off")

    # Confidence interpretation banner
    if prob >= 0.70 and rlvl == "LOW":
        st.success(
            f"✅ **APPROVE — High confidence, low risk.** "
            f"The consensus model is **{prob:.0%}** confident. "
            f"Sources are largely in agreement. No AML signals detected.",
            icon="✅"
        )
    elif prob >= 0.70 and rlvl in ("MEDIUM","HIGH"):
        st.warning(
            f"🟡 **{kyb} — High classification confidence but risk signals present.** "
            f"Model confidence is {prob:.0%} but {len(risk_profile.signals)} risk signal(s) were triggered. "
            f"Review the Risk Assessment section below.",
            icon="⚠️"
        )
    elif prob >= 0.40:
        st.warning(
            f"🟡 **{kyb} — Moderate confidence ({prob:.0%}).** "
            f"Sources show some disagreement. See Model 1 Source Evidence below to understand which vendors "
            f"contributed and whether any conflicts exist.",
            icon="⚠️"
        )
    else:
        src_statuses = [v.get("status","") for v in result.source_lineage.values()]
        n_matched = sum(1 for s in src_statuses if s == "MATCHED")
        st.error(
            f"🔴 **{kyb} — Low confidence ({prob:.0%}).** "
            f"Only {n_matched}/6 sources returned a confirmed match. "
            f"Company may be private, small, or newly registered. "
            f"Manual review of the classification is recommended.",
            icon="🚨"
        )

    st.markdown("---")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 2 — CLASSIFICATION OUTPUT (Model 1 → Model 2 → LLM)
    # ═══════════════════════════════════════════════════════════════════════════
    st.markdown("## Industry Classification — Complete Output")
    st.caption(
        "The table below shows what each stage of the pipeline produced. "
        "**Model 1** (Entity Matching XGBoost) found the right vendor records. "
        "**Model 2** (Consensus XGBoost) turned all signals into calibrated probabilities. "
        "**GPT-4o-mini** selected the best code per taxonomy from semantic candidates."
    )

    # Build the single classification table
    class_rows = []

    # Government registry rows (highest authority)
    if external_registry:
        if external_registry.edgar:
            ed = external_registry.edgar
            class_rows.append({
                "Stage":         "0 — Government Registry",
                "Source":        f"SEC EDGAR ({ed.ticker or 'US'})",
                "Taxonomy":      "US SIC 1987",
                "Code":          ed.sic,
                "Description":   ed.sic_description,
                "Confidence":    "Registry filing (ground truth)",
                "What this means": "Apple itself reported this SIC to the US government. Highest possible authority.",
            })
        if external_registry.companies_house:
            ch = external_registry.companies_house
            for c, d in zip(ch.sic_codes[:2], ch.sic_descriptions[:2]):
                class_rows.append({
                    "Stage":         "0 — Government Registry",
                    "Source":        "Companies House (UK)",
                    "Taxonomy":      "UK SIC 2007",
                    "Code":          c,
                    "Description":   d,
                    "Confidence":    "Registry filing (ground truth)",
                    "What this means": "Filed directly with UK Companies House. Official registration code.",
                })

    # Model 1 source evidence rows
    src_label = {
        "opencorporates": "OC (Redshift — gov registry)",
        "equifax":        "Equifax (Redshift batch)",
        "trulioo":        "Trulioo (live KYB API)",
        "zoominfo":       "ZoomInfo (Redshift)",
        "liberty_data":   "Liberty Data (Redshift)",
        "ai_semantic":    "AI Semantic (GPT + web)",
    }
    status_meaning = {
        "MATCHED":   "✅ Entity confirmed in database (Model 1 ≥ 0.80)",
        "CONFLICT":  "⚠️ Match found but code differs from majority — down-weighted",
        "POLLUTED":  "🔴 Data quality issue — digit mismatch detected",
        "SIMULATED": "🟡 No live Redshift — simulated signal",
        "INFERRED":  "🔵 No database match — AI inferred from web",
        "UNAVAILABLE": "⚫ No data returned",
    }
    for src, v in result.source_lineage.items():
        if not v.get("value"):
            continue
        code  = v["value"].split("-",2)[-1] if "-" in v["value"] else v["value"]
        tax   = v["value"].split("-")[0].upper().replace("_"," ") if "-" in v["value"] else ""
        status = v.get("status","")
        conf   = v.get("confidence", 0)
        weight = v.get("weight", 0)
        label  = v.get("label","")
        class_rows.append({
            "Stage":         "1 — Model 1: Entity Match",
            "Source":        src_label.get(src, src),
            "Taxonomy":      tax,
            "Code":          code,
            "Description":   label[:55] if label else "",
            "Confidence":    f"{conf:.0%} match · weight {weight:.2f} → effective {conf*weight:.2f}",
            "What this means": status_meaning.get(status, status),
        })

    # Model 2 output rows
    all_model2 = [result.primary_industry] + result.secondary_industries
    for i, code_obj in enumerate(all_model2):
        label_type = "PRIMARY (highest probability)" if i == 0 else f"SECONDARY #{i}"
        class_rows.append({
            "Stage":         "2 — Model 2: Consensus XGBoost",
            "Source":        label_type,
            "Taxonomy":      code_obj.taxonomy.replace("_"," "),
            "Code":          code_obj.code,
            "Description":   code_obj.label,
            "Confidence":    f"{code_obj.consensus_probability:.1%} softmax probability",
            "What this means": (
                f"XGBoost Model 2 output. {'≥70% = high confidence → APPROVE threshold' if code_obj.consensus_probability >= 0.70 else '40–70% = moderate → REVIEW recommended' if code_obj.consensus_probability >= 0.40 else '<40% = low → manual review required'}."
            ),
        })

    # LLM output rows
    if llm_result.primary_code:
        src_used = getattr(llm_result, "source_used", "semantic_search") or "semantic_search"
        class_rows.append({
            "Stage":         "3 — LLM Enrichment (GPT-4o-mini)",
            "Source":        f"Primary — {src_used.replace('_',' ')}",
            "Taxonomy":      llm_result.primary_taxonomy.replace("_"," "),
            "Code":          llm_result.primary_code,
            "Description":   llm_result.primary_label,
            "Confidence":    llm_result.primary_confidence,
            "What this means": (
                "GPT-4o-mini selected this code from UGO semantic candidates after reviewing "
                "registry data, vendor signals, and source agreements. "
                + (f"⚠️ Registry conflict: {getattr(llm_result,'registry_conflict_note','')}" if getattr(llm_result,'registry_conflict',False) else "")
            ),
        })
    for alt in (llm_result.alternative_codes or []):
        class_rows.append({
            "Stage":         "3 — LLM Enrichment (GPT-4o-mini)",
            "Source":        "Alternative (cross-taxonomy)",
            "Taxonomy":      alt.get("taxonomy","").replace("_"," "),
            "Code":          alt.get("code",""),
            "Description":   alt.get("label",""),
            "Confidence":    "Cross-taxonomy alternative",
            "What this means": "Best equivalent code in this taxonomy system.",
        })
    if llm_result.mcc_code:
        mcc_risk = getattr(llm_result, "mcc_risk_note", "normal") or "normal"
        class_rows.append({
            "Stage":         "3 — LLM Enrichment (GPT-4o-mini)",
            "Source":        "MCC (payment compliance)",
            "Taxonomy":      "MCC (Visa/Mastercard)",
            "Code":          llm_result.mcc_code,
            "Description":   llm_result.mcc_label or "",
            "Confidence":    mcc_risk,
            "What this means": f"Merchant Category Code for payment processing compliance. {'⚠️ HIGH RISK MCC — enhanced due diligence required' if 'high_risk' in mcc_risk else '✅ Standard MCC — no elevated payment risk'}.",
        })

    df_class = pd.DataFrame(class_rows)
    st.dataframe(df_class, use_container_width=True, hide_index=True,
                 column_config={
                     "Stage": st.column_config.TextColumn("Pipeline Stage", width="medium"),
                     "Source": st.column_config.TextColumn("Source", width="medium"),
                     "Taxonomy": st.column_config.TextColumn("Taxonomy", width="small"),
                     "Code": st.column_config.TextColumn("Code", width="small"),
                     "Description": st.column_config.TextColumn("Description", width="large"),
                     "Confidence": st.column_config.TextColumn("Confidence / Weight", width="large"),
                     "What this means": st.column_config.TextColumn("Interpretation", width="large"),
                 })

    if llm_result.reasoning:
        with st.expander("GPT-4o-mini Classification Reasoning (how it chose the codes)"):
            st.write(llm_result.reasoning)

    st.markdown("---")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 3 — RISK ASSESSMENT
    # ═══════════════════════════════════════════════════════════════════════════
    st.markdown("## AML / KYB Risk Assessment")

    # Risk score bar
    score = risk_profile.overall_risk_score
    score_pct = int(score * 100)
    bar_colour = _RISK_COLOURS.get(rlvl, "#546E7A")
    st.markdown(
        f'<div style="background:#f0f4f8;border-radius:8px;padding:12px 16px;margin-bottom:12px">'
        f'<div style="display:flex;align-items:center;gap:16px">'
        f'<div style="font-size:1.8em;font-weight:900;color:{bar_colour}">{score:.2f}</div>'
        f'<div style="flex:1">'
        f'<div style="background:#ddd;border-radius:4px;height:12px;overflow:hidden">'
        f'<div style="background:{bar_colour};width:{score_pct}%;height:100%;border-radius:4px"></div>'
        f'</div>'
        f'<div style="font-size:0.72em;color:#546E7A;margin-top:4px">Risk Score: {score:.2f} / 1.00 &nbsp;·&nbsp; '
        f'{len(risk_profile.signals)} signal(s) triggered &nbsp;·&nbsp; '
        f'Level: <strong style="color:{bar_colour}">{rlvl}</strong></div>'
        f'</div>'
        f'<div style="background:{bar_colour};color:white;padding:6px 18px;border-radius:6px;font-weight:700;font-size:0.88em">KYB: {kyb}</div>'
        f'</div></div>',
        unsafe_allow_html=True,
    )

    if not risk_profile.signals:
        st.success("✅ No AML/KYB risk signals detected. All 9 signal detectors returned clean.")
    else:
        # Risk signals table
        risk_rows = []
        action_map = {
            "CRITICAL": "Immediate investigation required before any approval",
            "HIGH":     "Escalate to compliance team — do not auto-approve",
            "MEDIUM":   "Manual review by underwriter required",
            "LOW":      "Note for file — monitor but can proceed",
            "INFO":     "Informational — no action required",
        }
        for sig in risk_profile.signals:
            risk_rows.append({
                "Severity":      sig.severity,
                "Signal":        sig.flag,
                "Score":         f"+{sig.score:.2f}",
                "What happened": sig.description[:120] + ("…" if len(sig.description)>120 else ""),
                "Required action": action_map.get(sig.severity, "Review"),
            })
        df_risk = pd.DataFrame(risk_rows)
        st.dataframe(df_risk, use_container_width=True, hide_index=True,
                     column_config={
                         "Severity": st.column_config.TextColumn("Severity", width="small"),
                         "Signal":   st.column_config.TextColumn("Signal", width="medium"),
                         "Score":    st.column_config.TextColumn("Contributes", width="small"),
                         "What happened": st.column_config.TextColumn("What was detected", width="large"),
                         "Required action": st.column_config.TextColumn("Required Action", width="large"),
                     })

    st.markdown("---")

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 4 — MODEL INPUTS (what the 38 features looked like — for audit)
    # ═══════════════════════════════════════════════════════════════════════════
    with st.expander("Model Inputs Audit — 38 XGBoost Features (for compliance/audit trail)"):
        st.caption(
            "These are the 38 numeric features fed to XGBoost Model 2. "
            "They are derived from Model 1 (entity matching confidence per source) "
            "plus jurisdiction, entity type, AML signals, and source agreement. "
            "This section is for audit and explainability — not needed for day-to-day use."
        )
        tp    = debug.get("trulioo_polluted", False)
        wrd   = debug.get("web_registry_distance", 0)
        tps   = debug.get("temporal_pivot_score", 0)
        cta   = debug.get("cross_taxonomy_agreement", 0)
        mca   = debug.get("majority_code_agreement", 0)
        hrisk = debug.get("high_risk_naics_flag", False)
        avg_conf = debug.get("avg_source_confidence", 0)
        jc    = debug.get("jurisdiction_code", "")
        jl    = debug.get("jurisdiction_label", "")
        rb    = debug.get("region_bucket", "")
        naics_j = debug.get("is_naics_jurisdiction", False)

        feat_rows = [
            {"Feature Group": "Source Quality (Model 1 output)", "Feature": "Avg source match confidence", "Value": f"{avg_conf:.0%}", "Interpretation": "Average entity-matching confidence across all 6 sources from Model 1"},
            {"Feature Group": "Source Quality (Model 1 output)", "Feature": "Majority code agreement",    "Value": f"{mca:.0%}", "Interpretation": f"{mca:.0%} of sources returned the same primary code"},
            {"Feature Group": "AML / Semantic signals",          "Feature": "Web ↔ Registry distance",   "Value": f"{wrd:.3f}", "Interpretation": "🔴 Shell company signal" if wrd>0.55 else ("🟡 Minor gap" if wrd>0.30 else "🟢 Sources agree")},
            {"Feature Group": "AML / Semantic signals",          "Feature": "Temporal pivot score",       "Value": f"{tps:.3f}", "Interpretation": "🔴 U-Turn fraud signal" if tps>0.70 else ("🟡 Some history change" if tps>0.30 else "🟢 Stable history")},
            {"Feature Group": "AML / Semantic signals",          "Feature": "Cross-taxonomy agreement",   "Value": f"{cta:.2f}", "Interpretation": f"{int(cta*6)}/6 taxonomy systems agree on same semantic cluster"},
            {"Feature Group": "AML / Semantic signals",          "Feature": "Trulioo pollution flag",     "Value": str(tp),     "Interpretation": "⚠️ 4-digit SIC in 5/6-digit jurisdiction" if tp else "✅ Correct format"},
            {"Feature Group": "AML / Semantic signals",          "Feature": "High-risk NAICS prefix",     "Value": str(hrisk),  "Interpretation": "⚠️ AML-elevated sector detected" if hrisk else "✅ Standard sector"},
            {"Feature Group": "Jurisdiction routing",            "Feature": "Jurisdiction code",          "Value": jc,           "Interpretation": f"{jl} ({rb} bucket) → primary taxonomy: {'NAICS 2022' if naics_j else 'non-NAICS'}"},
        ]
        st.dataframe(pd.DataFrame(feat_rows), use_container_width=True, hide_index=True)

    # ═══════════════════════════════════════════════════════════════════════════
    # SECTION 5 — DOWNLOAD
    # ═══════════════════════════════════════════════════════════════════════════
    st.markdown("---")
    st.markdown("## Download Results")

    def _to_excel_multi(frames: dict) -> bytes:
        from io import BytesIO
        buf = BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            for sheet, df in frames.items():
                df.to_excel(writer, sheet_name=sheet[:31], index=False)
        buf.seek(0)
        return buf.read()

    dl1, dl2 = st.columns(2)
    with dl1:
        excel_bytes = _to_excel_multi({
            "Classification": df_class,
            "Risk Signals":   pd.DataFrame(risk_rows if risk_profile.signals else []),
            "Model Inputs":   pd.DataFrame(feat_rows),
        })
        st.download_button(
            label="📥 Download Full Results (Excel)",
            data=excel_bytes,
            file_name=f"classification_{entity.clean_name.replace(' ','_')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )
    with dl2:
        import json as _json
        out = result.to_dict()
        out["consensus_output"]["risk_profile"] = risk_profile.to_dict()
        if external_registry:
            out["consensus_output"]["external_registry"] = external_registry.to_dict()
        st.download_button(
            label="📥 Download Full Results (JSON)",
            data=_json.dumps(out, indent=2),
            file_name=f"classification_{entity.clean_name.replace(' ','_')}.json",
            mime="application/json",
        )

    # Full JSON (collapsed)
    with st.expander("Full JSON Output (raw)"):
        st.json(out)

    # Build a flat table of all results
    table_rows = []

    # Primary + secondary codes
    all_codes = [result.primary_industry] + result.secondary_industries
    for i, code in enumerate(all_codes):
        row_type = "PRIMARY" if i == 0 else f"SECONDARY {i}"
        table_rows.append({
            "Type":               row_type,
            "Taxonomy":           code.taxonomy.replace("_", " "),
            "Code":               code.code,
            "Description":        code.label,
            "Consensus Prob":     f"{code.consensus_probability:.1%}",
            "Source":             "XGBoost Consensus",
        })

    # LLM codes
    if llm_result.primary_code:
        table_rows.append({
            "Type":       "LLM PRIMARY",
            "Taxonomy":   llm_result.primary_taxonomy.replace("_", " "),
            "Code":       llm_result.primary_code,
            "Description": llm_result.primary_label,
            "Consensus Prob": llm_result.primary_confidence,
            "Source":     f"GPT-4o-mini ({getattr(llm_result,'source_used','') or 'semantic_search'})",
        })
    for alt in (llm_result.alternative_codes or []):
        table_rows.append({
            "Type":       "LLM ALTERNATIVE",
            "Taxonomy":   alt.get("taxonomy", "").replace("_", " "),
            "Code":       alt.get("code", ""),
            "Description": alt.get("label", ""),
            "Consensus Prob": "—",
            "Source":     "GPT-4o-mini (alternative)",
        })
    if llm_result.mcc_code:
        table_rows.append({
            "Type":       "MCC",
            "Taxonomy":   "MCC (Visa/Mastercard)",
            "Code":       llm_result.mcc_code,
            "Description": llm_result.mcc_label or "",
            "Consensus Prob": "—",
            "Source":     f"GPT-4o-mini — {getattr(llm_result,'mcc_risk_note','normal') or 'normal'}",
        })

    # External registry
    if external_registry:
        if external_registry.edgar:
            table_rows.append({
                "Type":       "REGISTRY (SEC EDGAR)",
                "Taxonomy":   "US SIC 1987",
                "Code":       external_registry.edgar.sic,
                "Description": external_registry.edgar.sic_description,
                "Consensus Prob": "—",
                "Source":     f"SEC EDGAR — official US government filing ({external_registry.edgar.ticker or external_registry.edgar.name})",
            })
        if external_registry.companies_house:
            for code, desc in zip(
                external_registry.companies_house.sic_codes,
                external_registry.companies_house.sic_descriptions,
            ):
                table_rows.append({
                    "Type":       "REGISTRY (Companies House)",
                    "Taxonomy":   "UK SIC 2007",
                    "Code":       code,
                    "Description": desc,
                    "Consensus Prob": "—",
                    "Source":     f"Companies House UK — official government filing ({external_registry.companies_house.name})",
                })

    df_results_table = pd.DataFrame(table_rows)
    st.dataframe(df_results_table, use_container_width=True, hide_index=True)

    # Risk signals table
    if risk_profile.signals:
        st.markdown("**Risk Signals**")
        risk_rows = [
            {
                "Severity": s.severity,
                "Flag":     s.flag,
                "Score":    f"{s.score:.2f}",
                "Description": s.description[:120] + ("…" if len(s.description) > 120 else ""),
            }
            for s in risk_profile.signals
        ]
        st.dataframe(pd.DataFrame(risk_rows), use_container_width=True, hide_index=True)

    # Source lineage table
    st.markdown("**Source Lineage**")
    lineage_rows = [
        {
            "Source":      src,
            "Code":        v.get("value", "").split("-", 2)[-1] if "-" in v.get("value","") else v.get("value",""),
            "Taxonomy":    v.get("value", "").split("-")[0].upper().replace("_"," ") if "-" in v.get("value","") else "",
            "Description": v.get("label", ""),
            "Weight":      f"{v.get('weight', 0):.2f}",
            "Status":      v.get("status", ""),
            "Confidence":  f"{v.get('confidence', 0):.0%}",
        }
        for src, v in result.source_lineage.items()
    ]
    st.dataframe(pd.DataFrame(lineage_rows), use_container_width=True, hide_index=True)

    # Company metadata table
    st.markdown("**Company Metadata**")
    meta_debug = result.feature_debug
    meta_rows = [
        {"Field": "Company Name",          "Value": result.company_name},
        {"Field": "Jurisdiction Code",     "Value": meta_debug.get("jurisdiction_code", result.jurisdiction)},
        {"Field": "Jurisdiction Label",    "Value": meta_debug.get("jurisdiction_label", "")},
        {"Field": "Region Bucket",         "Value": meta_debug.get("region_bucket", "")},
        {"Field": "Entity Type",           "Value": result.entity_type},
        {"Field": "Is Sub-national",       "Value": str(meta_debug.get("is_subnational", False))},
        {"Field": "NAICS Jurisdiction",    "Value": str(meta_debug.get("is_naics_jurisdiction", False))},
        {"Field": "Overall Risk Score",    "Value": f"{risk_profile.overall_risk_score:.3f}"},
        {"Field": "Risk Level",            "Value": risk_profile.overall_risk_level},
        {"Field": "KYB Recommendation",    "Value": risk_profile.kyb_recommendation},
        {"Field": "Avg Source Confidence", "Value": f"{meta_debug.get('avg_source_confidence', 0):.0%}"},
        {"Field": "Web↔Registry Distance", "Value": f"{meta_debug.get('web_registry_distance', 0):.3f}"},
        {"Field": "Temporal Pivot Score",  "Value": f"{meta_debug.get('temporal_pivot_score', 0):.3f}"},
        {"Field": "Majority Code Agree",   "Value": f"{meta_debug.get('majority_code_agreement', 0):.0%}"},
    ]
    if external_registry and external_registry.edgar:
        meta_rows += [
            {"Field": "SEC EDGAR CIK",     "Value": external_registry.edgar.cik},
            {"Field": "SEC EDGAR SIC",     "Value": f"{external_registry.edgar.sic} — {external_registry.edgar.sic_description}"},
            {"Field": "Incorporated In",   "Value": external_registry.edgar.state_of_incorporation},
            {"Field": "Ticker",            "Value": external_registry.edgar.ticker or "—"},
        ]
    st.dataframe(pd.DataFrame(meta_rows), use_container_width=True, hide_index=True)

    # ── Download buttons ──────────────────────────────────────────────────────
    def _to_excel_multi(frames: dict) -> bytes:
        """Write multiple DataFrames to one Excel workbook, one sheet each."""
        from io import BytesIO
        buf = BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            for sheet_name, df in frames.items():
                df.to_excel(writer, sheet_name=sheet_name[:31], index=False)
        buf.seek(0)
        return buf.read()

    dl_col1, dl_col2 = st.columns(2)

    with dl_col1:
        excel_bytes = _to_excel_multi({
            "Classification Codes": df_results_table,
            "Risk Signals":         pd.DataFrame(risk_rows) if risk_profile.signals else pd.DataFrame(),
            "Source Lineage":       pd.DataFrame(lineage_rows),
            "Company Metadata":     pd.DataFrame(meta_rows),
        })
        st.download_button(
            label="📥 Download Full Results (Excel)",
            data=excel_bytes,
            file_name=f"classification_{result.company_name.replace(' ','_')}.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            type="primary",
        )

    with dl_col2:
        import json as _json
        out_json = result.to_dict()
        out_json["consensus_output"]["risk_profile"] = risk_profile.to_dict()
        if external_registry:
            out_json["consensus_output"]["external_registry"] = external_registry.to_dict()
        json_str = _json.dumps(out_json, indent=2)
        st.download_button(
            label="📥 Download Full Results (JSON)",
            data=json_str,
            file_name=f"classification_{result.company_name.replace(' ','_')}.json",
            mime="application/json",
        )

    # ── Raw JSON output ───────────────────────────────────────────────────────
    with st.expander("Full JSON Output"):
        out = result.to_dict()
        out["consensus_output"]["risk_profile"] = risk_profile.to_dict()
        if external_registry:
            out["consensus_output"]["external_registry"] = external_registry.to_dict()
        st.json(out)


# ────────────────────────────────────────────────────────────────────────────────
# SIDEBAR NAVIGATION
# ────────────────────────────────────────────────────────────────────────────────

st.sidebar.title("🌐 Global Classification Engine")
st.sidebar.caption(
    "Multi-taxonomy · XGBoost Consensus · AML/KYB Risk · Unified Global Ontology"
)

# ── Redshift connection status (lazy — never blocks startup) ─────────────────
@st.cache_resource(show_spinner=False)
def _get_redshift_connector():
    """Connect to Redshift once, cache result. Never blocks the UI on failure."""
    try:
        from redshift_connector import get_connector
        return get_connector()
    except Exception:
        return None

_rc = _get_redshift_connector()
_rc_connected = _rc is not None and getattr(_rc, "is_connected", False)
if _rc_connected:
    st.sidebar.success("Redshift: LIVE", icon="✅")
    st.sidebar.caption("OpenCorporates, Equifax, ZoomInfo, Liberty Data querying real tables.")
else:
    st.sidebar.warning("Redshift: SIMULATED", icon="⚠️")
    st.sidebar.caption(
        "Set REDSHIFT_HOST / REDSHIFT_USER / REDSHIFT_PASSWORD / REDSHIFT_DB "
        "in Streamlit secrets to connect to real data."
    )

page = st.sidebar.radio(
    "Navigate",
    [
        "Classify",
        "Industry Lookup",
        "Taxonomy Explorer",
    ],
    index=0,
)

# Initialise engines on sidebar so they load once
te = get_taxonomy_engine()
ce = get_consensus_engine()
re_engine = get_risk_engine()
er = get_entity_resolver()


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 1 — CLASSIFY (single company OR batch file — merged)
# ────────────────────────────────────────────────────────────────────────────────

if page == "Classify":
    st.title("Industry Classification")
    st.caption(
        "Classify a single company by name, or upload a file of companies. "
        "The same full pipeline runs either way: entity matching → XGBoost consensus → "
        "LLM enrichment → AML/KYB risk scoring."
    )

    mode_tab = st.radio(
        "Input mode",
        ["Single company", "Upload file (batch)"],
        horizontal=True,
        label_visibility="collapsed",
    )
    st.markdown("---")

if page == "Classify" and mode_tab == "Single company":
    with st.expander("How the pipeline works — 4 steps"):
        st.markdown(
            "**Step 1 — Entity Matching (Model 1 XGBoost):** Canonises name, searches OpenCorporates / "
            "Equifax / ZoomInfo / Liberty Data in Redshift. Outputs `match_confidence` per source.\n\n"
            "**Step 2 — Consensus (Model 2 XGBoost):** 38 features from all signals → softmax probability "
            "distribution over all codes. Top-5 codes with calibrated probabilities.\n\n"
            "**Step 3 — LLM Enrichment (GPT-4o-mini):** Reviews vendor evidence + SEC EDGAR / Companies House "
            "ground truth. Selects best code per taxonomy (NAICS, UK SIC, NACE, ISIC, MCC).\n\n"
            "**Step 4 — Risk Engine:** 9 AML/KYB detectors → risk score 0–1 → "
            "KYB: APPROVE / REVIEW / ESCALATE / REJECT."
        )

    with st.form("single_lookup"):
        c1, c2 = st.columns(2)
        with c1:
            company_name = st.text_input("Company Name *", placeholder="Joe's Pizza LLC")
            address      = st.text_input("Address", placeholder="123 Main St, London")
        with c2:
            country      = st.text_input("Country", placeholder="GB")
            web_summary  = st.text_area("Custom Web Summary (optional)", height=80)
        force_conflict = st.checkbox(
            "Inject shell-company conflict (stress test)",
            value=False,
        )
        submitted = st.form_submit_button("Run Classification Pipeline", type="primary")

    if submitted and company_name.strip():
        with st.spinner("Running full pipeline …"):
            t0 = time.time()
            entity, bundle, result, risk, llm, ext_reg = run_full_pipeline(
                company_name=company_name.strip(),
                address=address.strip(),
                country=country.strip(),
                web_summary=web_summary.strip(),
                force_conflict=force_conflict,
            )
            elapsed = time.time() - t0

        st.success(f"Pipeline completed in {elapsed:.2f}s")

        # ── Store in session state for Risk Dashboard + Taxonomy Explorer ──────
        st.session_state["single_result"] = {
            "entity":    entity,
            "bundle":    bundle,
            "result":    result,
            "risk":      risk,
            "llm":       llm,
            "ext_reg":   ext_reg,
            "company_name": company_name.strip(),
        }
        # Build a one-row DataFrame for Risk Dashboard compatibility
        from risk_engine import _RISK_COLOURS as _RC
        single_risk_row = {
            "Company":       company_name.strip(),
            "Jurisdiction":  entity.jurisdiction_code,
            "Entity Type":   entity.detected_entity_type,
            "Primary Code":  result.primary_industry.code,
            "Primary Label": result.primary_industry.label,
            "Risk Score":    round(risk.overall_risk_score, 4),
            "Risk Level":    risk.overall_risk_level,
            "KYB Action":    risk.kyb_recommendation,
            "Flags":         "; ".join(s.flag for s in risk.signals[:5]),
        }
        st.session_state["single_risk_df"] = pd.DataFrame([single_risk_row])

        # Build UGO code rows for Taxonomy Explorer
        all_classification_codes = []
        for code in [result.primary_industry] + result.secondary_industries:
            all_classification_codes.append({
                "Company":     company_name.strip(),
                "Source":      "XGBoost Consensus",
                "Taxonomy":    code.taxonomy.replace("_", " "),
                "Code":        code.code,
                "Description": code.label,
                "Prob":        f"{code.consensus_probability:.1%}",
            })
        if llm.primary_code:
            all_classification_codes.append({
                "Company":     company_name.strip(),
                "Source":      "GPT-4o-mini",
                "Taxonomy":    llm.primary_taxonomy.replace("_", " "),
                "Code":        llm.primary_code,
                "Description": llm.primary_label,
                "Prob":        llm.primary_confidence,
            })
        for alt in (llm.alternative_codes or []):
            all_classification_codes.append({
                "Company":     company_name.strip(),
                "Source":      "GPT-4o-mini (alt)",
                "Taxonomy":    alt.get("taxonomy","").replace("_"," "),
                "Code":        alt.get("code",""),
                "Description": alt.get("label",""),
                "Prob":        "—",
            })
        if ext_reg and ext_reg.edgar:
            all_classification_codes.append({
                "Company":     company_name.strip(),
                "Source":      "SEC EDGAR",
                "Taxonomy":    "US SIC 1987",
                "Code":        ext_reg.edgar.sic,
                "Description": ext_reg.edgar.sic_description,
                "Prob":        "Registry",
            })
        if ext_reg and ext_reg.companies_house:
            for c, d in zip(ext_reg.companies_house.sic_codes, ext_reg.companies_house.sic_descriptions):
                all_classification_codes.append({
                    "Company":     company_name.strip(),
                    "Source":      "Companies House",
                    "Taxonomy":    "UK SIC 2007",
                    "Code":        c,
                    "Description": d,
                    "Prob":        "Registry",
                })
        st.session_state["single_taxonomy_df"] = pd.DataFrame(all_classification_codes)

        display_consensus_result(entity, bundle, result, risk, llm, ext_reg)

    elif submitted:
        st.warning("Please enter a company name.")


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 1b — CLASSIFY / BATCH (merged into Classify page, Upload File mode)
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Classify" and mode_tab == "Upload file (batch)":
    pass  # header already printed above

if page == "Classify" and mode_tab == "Upload file (batch)":
    st.caption(
        "Upload a CSV or Excel file. Column names are auto-detected — including Worth AI / Amex format "
        "(`lgl_nm_worth`, `dba_nm_worth`, `full_address_worth`, `city_worth`, `region_worth`, `zip_code_worth`, `country_worth`). "
        "More fields = higher entity matching confidence. Minimum: company name."
    )
    with st.expander("Accepted column names and confidence tips"):
        st.markdown("""
| Field | Accepted column names | Impact |
|---|---|---|
| **Company name** ✅ | `lgl_nm_worth`, `Org Name`, `company_name`, `business_name`, `name` | Required |
| DBA / Trade name | `dba_nm_worth`, `DBA`, `trade_name` | Catches trade name variants |
| Full address | `full_address_worth`, `Address`, `full_address` | High — disambiguates same-name companies |
| City | `city_worth`, `city`, `City` | Medium |
| State / Region | `region_worth`, `region`, `state` | Derives jurisdiction (US+AK → `us_ak`) |
| ZIP / Postal code | `zip_code_worth`, `postal_code`, `zip` | **Highest impact — prefix-blocks Redshift search** |
| Country | `country_worth`, `country`, `Country` | Routes to correct taxonomy (GB→UK SIC, DE→NACE) |
| UID / Reference | `uid_worth`, `uid_received` | Passed through to output unchanged |
""")

    uploaded = st.file_uploader("Upload file", type=["csv", "xlsx"])

    if uploaded:
        if uploaded.name.endswith(".xlsx"):
            df_input = pd.read_excel(uploaded)
        else:
            df_input = pd.read_csv(uploaded)
        df_input.columns = df_input.columns.str.strip()

        # ── Auto-detect and map column names ──────────────────────────────────
        def _find_col(df: pd.DataFrame, candidates: list[str]) -> str | None:
            """Return the first matching column name (case-insensitive)."""
            cols_lower = {c.lower(): c for c in df.columns}
            for c in candidates:
                if c.lower() in cols_lower:
                    return cols_lower[c.lower()]
            return None

        # Priority-ordered candidate lists — most specific first
        COL_ORG_NAME  = ["lgl_nm_worth", "lgl_nm_received", "Org Name", "org_name",
                         "company_name", "business_name", "Company", "BusinessName",
                         "name", "legal_name"]
        COL_DBA       = ["dba_nm_worth", "dba_nm_received", "dba_name", "DBA",
                         "trade_name", "dba"]
        COL_ADDRESS   = ["full_address_worth", "Address", "full_address",
                         "business_address_received", "address", "street_address",
                         "Address Line 1"]
        COL_ADDR1     = ["address_1_worth", "address_1", "addr1", "street_1",
                         "address1"]
        COL_CITY      = ["city_worth", "city", "City"]
        COL_REGION    = ["region_worth", "region", "state", "State", "Region",
                         "province"]
        COL_ZIP       = ["zip_code_worth", "zip_code", "postal_code", "zip",
                         "postcode", "ZIP Code", "PostalCode"]
        COL_COUNTRY   = ["country_worth", "country", "Country", "country_code"]
        COL_DESC      = ["Description", "description", "website", "url",
                         "business_description", "web_summary"]
        COL_UID       = ["uid_worth", "uid_received", "uid", "ID", "reference",
                         "external_id"]

        c_org    = _find_col(df_input, COL_ORG_NAME)
        c_dba    = _find_col(df_input, COL_DBA)
        c_addr   = _find_col(df_input, COL_ADDRESS)
        c_addr1  = _find_col(df_input, COL_ADDR1)
        c_city   = _find_col(df_input, COL_CITY)
        c_region = _find_col(df_input, COL_REGION)
        c_zip    = _find_col(df_input, COL_ZIP)
        c_ctry   = _find_col(df_input, COL_COUNTRY)
        c_desc   = _find_col(df_input, COL_DESC)
        c_uid    = _find_col(df_input, COL_UID)

        if c_org is None:
            st.error(
                "Could not find a company name column. The file must contain one of: "
                + ", ".join(f"`{c}`" for c in COL_ORG_NAME[:5]) + "…"
            )
            st.stop()

        # Show detected mapping to user
        detected = {
            "Company name": c_org,
            "DBA / Trade name": c_dba or "—",
            "Address": c_addr or c_addr1 or "—",
            "City": c_city or "—",
            "Region / State": c_region or "—",
            "ZIP / Postal code": c_zip or "—",
            "Country": c_ctry or "—",
            "Description / URL": c_desc or "—",
            "UID / Reference": c_uid or "—",
        }
        with st.expander("Column mapping detected — click to review"):
            for field, col in detected.items():
                icon = "✅" if col != "—" else "➖"
                bonus = ""
                if col != "—":
                    if field in ("ZIP / Postal code", "Country"):
                        bonus = " ← **high impact on accuracy**"
                    elif field in ("Address", "City"):
                        bonus = " ← improves entity matching"
                    elif field == "DBA / Trade name":
                        bonus = " ← catches trade name variations"
                st.markdown(f"{icon} **{field}**: `{col}`{bonus}")

            missing_high_impact = [f for f, c in {
                "Country": c_ctry, "ZIP / Postal code": c_zip,
            }.items() if c is None]
            if missing_high_impact:
                st.warning(
                    f"Missing high-impact fields: **{', '.join(missing_high_impact)}**. "
                    f"Adding these would significantly improve entity matching confidence."
                )

        # Build normalised address string
        def _build_address(row) -> str:
            parts = []
            if c_addr and row.get(c_addr, ""):
                parts.append(str(row[c_addr]))
            elif c_addr1 and row.get(c_addr1, ""):
                parts.append(str(row[c_addr1]))
            if c_city and row.get(c_city, ""):
                parts.append(str(row[c_city]))
            if c_region and row.get(c_region, ""):
                parts.append(str(row[c_region]))
            if c_zip and row.get(c_zip, ""):
                parts.append(str(row[c_zip]))
            return ", ".join(p for p in parts if p and p != "nan")

        # Build jurisdiction from country + region (e.g. US + AK → us_ak)
        def _build_jurisdiction(row) -> str:
            country = str(row.get(c_ctry, "") or "").strip().upper() if c_ctry else ""
            region  = str(row.get(c_region, "") or "").strip().upper() if c_region else ""
            if country == "US" and region and len(region) == 2:
                return f"us_{region.lower()}"
            return country.lower() if country else ""

        # Build company name — prefer legal name, fall back to DBA
        def _get_company_name(row) -> str:
            name = str(row.get(c_org, "") or "").strip()
            if not name or name == "nan":
                if c_dba:
                    name = str(row.get(c_dba, "") or "").strip()
            return name

        # Compatibility: create standard columns the rest of the pipeline expects
        df_input["__org_name"]  = df_input.apply(_get_company_name, axis=1)
        df_input["__address"]   = df_input.apply(_build_address, axis=1)
        df_input["__country"]   = df_input.apply(_build_jurisdiction, axis=1)
        df_input["__dba"]       = df_input[c_dba].fillna("") if c_dba else ""
        df_input["__uid"]       = df_input[c_uid].astype(str) if c_uid else ""
        df_input["__desc"]      = df_input[c_desc].fillna("") if c_desc else ""

        # Preview using original columns but highlight detected name
        preview_cols = [c for c in [c_org, c_dba, c_addr or c_addr1, c_city, c_region, c_zip, c_ctry] if c]
        st.dataframe(df_input[preview_cols].head(10), use_container_width=True)
        st.info(f"{len(df_input)} records loaded. Company name column: **`{c_org}`**")

        if st.button("Run Batch Classification", type="primary"):
            results = []
            prog = st.progress(0)
            status = st.empty()
            t0 = time.time()

            for i, row in df_input.iterrows():
                company_name = row["__org_name"]
                address      = row["__address"]
                country      = row["__country"]
                web_summary  = str(row.get("__desc", "") or "")
                uid_val      = str(row.get("__uid", "") or "")
                dba_val      = str(row.get("__dba", "") or "")

                status.text(f"Processing {i+1}/{len(df_input)}: {company_name}")
                try:
                    entity, bundle, result, risk, llm, ext_reg = run_full_pipeline(
                        company_name=company_name,
                        address=address,
                        country=country,
                        web_summary=web_summary,
                    )
                    results.append({
                        # ── Input fields (pass-through for traceability) ──────
                        "UID":                 uid_val,
                        "Org Name":            company_name,
                        "DBA Name":            dba_val,
                        "Address Used":        address,
                        "Jurisdiction Input":  country,
                        # ── Entity resolution ─────────────────────────────────
                        "Clean Name":          entity.clean_name,
                        "Jurisdiction":        entity.jurisdiction_code,
                        "Jurisdiction Label":  entity.jurisdiction_label,
                        "Entity Type":         entity.detected_entity_type,
                        # ── Classification ────────────────────────────────────
                        "Primary Code":        result.primary_industry.code,
                        "Primary Taxonomy":    result.primary_industry.taxonomy,
                        "Primary Label":       result.primary_industry.label,
                        "Consensus Prob":      round(result.primary_industry.consensus_probability, 4),
                        "LLM Code":            llm.primary_code,
                        "LLM Taxonomy":        llm.primary_taxonomy,
                        "LLM Label":           llm.primary_label,
                        "LLM Confidence":      llm.primary_confidence,
                        "LLM Source Used":     getattr(llm, "source_used", ""),
                        "Registry Conflict":   getattr(llm, "registry_conflict", False),
                        "MCC Code":            llm.mcc_code or "",
                        "MCC Risk":            getattr(llm, "mcc_risk_note", "") or "",
                        # ── Government registry ───────────────────────────────
                        "SEC EDGAR SIC":       ext_reg.edgar.sic if ext_reg and ext_reg.edgar else "",
                        "SEC EDGAR SIC Desc":  ext_reg.edgar.sic_description if ext_reg and ext_reg.edgar else "",
                        "CH SIC Codes":        ", ".join(ext_reg.companies_house.sic_codes) if ext_reg and ext_reg.companies_house else "",
                        # ── Risk ──────────────────────────────────────────────
                        "Risk Level":          risk.overall_risk_level,
                        "Risk Score":          round(risk.overall_risk_score, 4),
                        "KYB Recommendation":  risk.kyb_recommendation,
                        "Risk Flags":          "; ".join(s.flag for s in risk.signals),
                    })
                except Exception as exc:
                    results.append({
                        "UID":      uid_val,
                        "Org Name": company_name,
                        "DBA Name": dba_val,
                        "Risk Level": "ERROR",
                        "KYB Recommendation": "REVIEW",
                        "Risk Flags": str(exc),
                    })
                prog.progress((i + 1) / len(df_input))

            elapsed = time.time() - t0
            df_results = pd.DataFrame(results)
            # Store in session state so Risk Dashboard and Taxonomy Explorer can use it
            st.session_state["batch_results"] = df_results
            # Clear single-company state so batch takes priority
            st.session_state.pop("single_risk_df", None)
            st.session_state.pop("single_taxonomy_df", None)
            # Build taxonomy DataFrame from batch results for Taxonomy Explorer
            tax_rows = []
            for _, row in df_results.iterrows():
                if row.get("Primary Code"):
                    tax_rows.append({
                        "Company":     row.get("Org Name",""),
                        "Source":      "XGBoost Consensus",
                        "Taxonomy":    str(row.get("Primary Taxonomy","")).replace("_"," "),
                        "Code":        row.get("Primary Code",""),
                        "Description": row.get("Primary Desc",""),
                        "Prob":        str(row.get("Consensus Prob","")),
                    })
                if row.get("LLM Code"):
                    tax_rows.append({
                        "Company":     row.get("Org Name",""),
                        "Source":      "GPT-4o-mini",
                        "Taxonomy":    str(row.get("LLM Taxonomy","")).replace("_"," "),
                        "Code":        row.get("LLM Code",""),
                        "Description": row.get("LLM Label",""),
                        "Prob":        str(row.get("LLM Confidence","")),
                    })
                if row.get("MCC Code"):
                    tax_rows.append({
                        "Company":     row.get("Org Name",""),
                        "Source":      "MCC",
                        "Taxonomy":    "MCC",
                        "Code":        row.get("MCC Code",""),
                        "Description": "",
                        "Prob":        "—",
                    })
            st.session_state["batch_taxonomy_df"] = pd.DataFrame(tax_rows)
            status.empty()
            n_total = len(df_results)
            st.success(f"Done — {n_total} companies classified in {elapsed:.1f}s")

            # ── Portfolio summary cards ───────────────────────────────────────
            st.markdown("### Portfolio Summary")
            kyb_counts = df_results["KYB Recommendation"].value_counts() if "KYB Recommendation" in df_results.columns else pd.Series(dtype=int)
            risk_col = df_results["Risk Score"].dropna() if "Risk Score" in df_results.columns else pd.Series(dtype=float)
            prob_col  = df_results["Consensus Prob"].dropna() if "Consensus Prob" in df_results.columns else pd.Series(dtype=float)

            sm1, sm2, sm3, sm4, sm5 = st.columns(5)
            sm1.metric("Total", n_total)
            sm2.metric("APPROVE",  kyb_counts.get("APPROVE", 0),  delta=None)
            sm3.metric("REVIEW",   kyb_counts.get("REVIEW", 0),   delta=None)
            sm4.metric("ESCALATE / REJECT", kyb_counts.get("ESCALATE",0)+kyb_counts.get("REJECT",0), delta=None)
            sm5.metric("Avg Confidence", f"{prob_col.mean():.0%}" if not prob_col.empty else "—")

            # Risk distribution bar chart
            if "Risk Level" in df_results.columns:
                import plotly.express as px
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**KYB Recommendation**")
                    kyb_df = kyb_counts.reset_index()
                    kyb_df.columns = ["Recommendation", "Count"]
                    kyb_colours = {"APPROVE":"#48BB78","REVIEW":"#4299E1",
                                   "ESCALATE":"#ECC94B","REJECT":"#FC8181"}
                    fig = px.bar(kyb_df, x="Recommendation", y="Count",
                                 color="Recommendation",
                                 color_discrete_map=kyb_colours,
                                 template="plotly_dark")
                    fig.update_layout(showlegend=False, margin=dict(t=20,b=20,l=0,r=0),
                                      height=280)
                    st.plotly_chart(fig, use_container_width=True)
                with c2:
                    st.markdown("**Risk Level Distribution**")
                    rl = df_results["Risk Level"].value_counts().reset_index()
                    rl.columns = ["Risk Level", "Count"]
                    rl_colours = {"CRITICAL":"#9B2335","HIGH":"#FC8181",
                                  "MEDIUM":"#ECC94B","LOW":"#48BB78","INFO":"#4299E1"}
                    fig2 = px.bar(rl, x="Risk Level", y="Count",
                                  color="Risk Level",
                                  color_discrete_map=rl_colours,
                                  template="plotly_dark")
                    fig2.update_layout(showlegend=False, margin=dict(t=20,b=20,l=0,r=0),
                                       height=280)
                    st.plotly_chart(fig2, use_container_width=True)

            # High-risk entities highlighted
            if "Risk Level" in df_results.columns:
                df_high = df_results[df_results["Risk Level"].isin(["HIGH","CRITICAL"])]
                if not df_high.empty:
                    st.markdown(f"**⚠️ {len(df_high)} company/companies require immediate review (HIGH/CRITICAL):**")
                    show_cols = [c for c in ["Org Name","Jurisdiction","Primary Code","Primary Label","Risk Level","Risk Score","KYB Recommendation","Risk Flags"] if c in df_high.columns]
                    st.dataframe(df_high[show_cols].sort_values("Risk Score",ascending=False), use_container_width=True, hide_index=True)

            st.markdown("---")
            st.markdown("### All Results")

            # Show/hide columns for clarity
            key_cols = [c for c in [
                "UID","Org Name","Clean Name","Jurisdiction","Entity Type",
                "Primary Taxonomy","Primary Code","Primary Desc","Consensus Prob",
                "LLM Code","LLM Taxonomy","LLM Label","LLM Confidence",
                "MCC Code","Risk Level","Risk Score","KYB Recommendation","Risk Flags",
                "SEC EDGAR SIC","SEC EDGAR SIC Desc",
            ] if c in df_results.columns]
            st.dataframe(df_results[key_cols], use_container_width=True, hide_index=True)

            # Download
            def to_excel(df: pd.DataFrame) -> bytes:
                buf = BytesIO()
                df.to_excel(buf, index=False)
                buf.seek(0)
                return buf.read()

            st.download_button(
                "📥 Download Results (Excel)",
                data=to_excel(df_results[key_cols]),
                file_name="classification_results.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                type="primary",
            )


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 3 — RISK DASHBOARD
# ────────────────────────────────────────────────────────────────────────────────

elif page == "__removed_risk_dashboard__":
    st.title("AML / KYB Risk Dashboard")
    st.markdown(
        "Portfolio-level AML/CTF risk analysis. Analyse your uploaded batch file **or** "
        "generate a synthetic demo portfolio."
    )

    # ── Explain tab relationships ─────────────────────────────────────────────
    st.info(
        "**How this tab relates to the others:**\n\n"
        "- **If you ran Batch Classification** (Tab 2) and classified a file, those results "
        "appear automatically here — select **'Use my batch results'** below.\n"
        "- **Single Company Lookup** (Tab 1) results are NOT shown here — that tab has its "
        "own risk signals directly on the result page.\n"
        "- **Generate Synthetic Demo** creates fake companies just for demonstration — "
        "it has no connection to anything you typed or uploaded."
    )

    with st.expander("What this page does — how risk is scored and what each signal means"):
        st.markdown("""
### What it does
Generates a synthetic portfolio of companies across all jurisdictions and runs the full
**Risk Engine** on each one. Produces a portfolio-level risk report with charts,
drill-down tables, and a downloadable Excel.

### How Risk Scoring Works
Each company is evaluated against **9 signal detectors**. Each triggered signal
contributes a score (0.05–0.35) to the overall risk score (capped at 1.0):

| Signal | Severity | Score | What triggers it |
|--------|----------|-------|-----------------|
| `SHELL_COMPANY_SIGNAL` | HIGH | +0.35 | Registered as Holding Co but web presence shows Operating sector |
| `REGISTRY_DISCREPANCY` | HIGH | +0.30 | Semantic distance between registry label and AI-inferred label > 0.55 |
| `STRUCTURE_CHANGE` | HIGH | +0.30 | Industry code changed in every historical snapshot (potential U-Turn fraud) |
| `SOURCE_CONFLICT` | HIGH | +0.20 | ≥60% of sources disagree on primary code |
| `HIGH_RISK_SECTOR` | HIGH | +0.25 | Primary code is in AML-elevated sector (finance, electronics wholesale, holding companies) |
| `TEMPORAL_PIVOT` | MEDIUM | +0.12 | Code changed 2+ times in recent history |
| `HOLDING_MISMATCH` | MEDIUM | +0.15 | Entity type = Holding but classified in Operating sector |
| `LOW_CONSENSUS_PROBABILITY` | MEDIUM | +0.12 | XGBoost confidence < 40% |
| `TRULIOO_POLLUTION` | LOW | +0.05 | Trulioo returned wrong digit-length code for this jurisdiction |

### Reading the Charts

**Risk Level Distribution** — shows how many companies in the portfolio fall into each risk bucket.
A healthy portfolio should be predominantly LOW/MEDIUM.

**KYB Recommendation Distribution** — APPROVE/REVIEW/ESCALATE/REJECT distribution.
High ESCALATE or REJECT counts indicate either a risky portfolio or data quality issues.

**Jurisdiction Risk Breakdown** — average risk score per jurisdiction.
High-risk jurisdictions (Cayman Islands, offshore centers) will naturally score higher.

**High-Risk Entity Detail** — all companies with HIGH or CRITICAL risk, sorted by score.
These are the entities that need immediate manual review.

### What "CRITICAL" means
A CRITICAL risk score (≥ 0.75) means multiple serious signals fired simultaneously.
For example: SHELL_COMPANY_SIGNAL + REGISTRY_DISCREPANCY + SOURCE_CONFLICT = 0.85.
This does NOT mean the company is necessarily fraudulent — it means the data
across sources is highly inconsistent and the entity requires thorough KYB investigation.

### Simulation Note
In this demo, companies are synthetically generated. In production, this page would
run against real companies from your onboarding pipeline, with signals derived from
real Redshift data (OpenCorporates, Equifax, ZoomInfo, Liberty Data).
""")
    st.markdown("---")

    # ── Source selector ───────────────────────────────────────────────────────
    single_available = "single_risk_df" in st.session_state and st.session_state["single_risk_df"] is not None
    batch_available  = "batch_results"  in st.session_state and st.session_state["batch_results"]  is not None

    options = []
    if single_available:
        cname = st.session_state.get("single_result", {}).get("company_name", "last searched company")
        options.append(f"Single company result — {cname}")
    if batch_available:
        nrows = len(st.session_state["batch_results"])
        options.append(f"Batch file results — {nrows} companies")
    options.append("Generate synthetic demo portfolio")

    if len(options) > 1:
        mode = st.radio("Data source for risk analysis", options, index=0)
    else:
        mode = options[0]
        if "synthetic" in mode:
            st.caption(
                "No company results available yet. "
                "Search a company in **Single Company Lookup** or upload a file in **Batch Classification**, "
                "then come back here to see its risk profile."
            )

    n_companies = st.slider(
        "Number of synthetic companies (demo mode only)", 10, 100, 50,
        disabled=("synthetic" not in mode.lower()),
    )

    if st.button("Generate Risk Report", type="primary"):

        # ── Mode: single company ──────────────────────────────────────────────
        if single_available and "single company" in mode.lower():
            df_risk = st.session_state["single_risk_df"]
            cname = st.session_state.get("single_result", {}).get("company_name", "")
            st.success(f"Showing risk profile for: **{cname}**")

        # ── Mode: batch results ────────────────────────────────────────────────
        elif batch_available and "batch file" in mode.lower():
            df_batch = st.session_state["batch_results"]
            st.success(f"Loaded {len(df_batch)} companies from your batch classification results.")
            risk_rows = []
            for _, row in df_batch.iterrows():
                risk_rows.append({
                    "Company":       row.get("Org Name", ""),
                    "Jurisdiction":  row.get("Jurisdiction", ""),
                    "Entity Type":   row.get("Entity Type", ""),
                    "Primary Code":  row.get("Primary Code", ""),
                    "Primary Label": row.get("Primary Desc", ""),
                    "Risk Score":    float(row.get("Risk Score", 0)) if str(row.get("Risk Score", "")).replace(".","").isdigit() else 0.0,
                    "Risk Level":    row.get("Risk Level", ""),
                    "KYB Action":    row.get("KYB Recommendation", ""),
                    "Flags":         str(row.get("Risk Flags", ""))[:80],
                })
            df_risk = pd.DataFrame(risk_rows)

        # ── Mode: synthetic demo ───────────────────────────────────────────────
        else:
        # ── Mode: synthetic demo ───────────────────────────────────────────────
            from data_simulator import simulate_training_dataset

            with st.spinner("Simulating vendor data and running risk analysis …"):
                bundles = simulate_training_dataset(n=n_companies)
                risk_rows = []
                ce_engine = get_consensus_engine()
                re_e = get_risk_engine()

                for b in bundles:
                    result = ce_engine.predict(b)
                    rp = re_e.evaluate(b, result)
                    result.risk_signals = [s.to_dict() for s in rp.signals]
                    risk_rows.append({
                        "Company":     b.company_name,
                        "Jurisdiction":b.jurisdiction,
                        "Entity Type": b.entity_type,
                    "Primary Code":result.primary_industry.code,
                    "Primary Label":result.primary_industry.label,
                    "Risk Score":  round(rp.overall_risk_score, 4),
                    "Risk Level":  rp.overall_risk_level,
                    "KYB Action":  rp.kyb_recommendation,
                    "Flags":       "; ".join(s.flag for s in rp.signals[:3]),
                })

            df_risk = pd.DataFrame(risk_rows)

        # ── Charts and tables (shared by both modes) ──────────────────────────
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Total Companies", len(df_risk))
        m2.metric("High/Critical Risk",
                  len(df_risk[df_risk["Risk Level"].isin(["HIGH","CRITICAL"])]))
        m3.metric("Requiring Review",
                  len(df_risk[df_risk["KYB Action"].isin(["REVIEW","ESCALATE","REJECT"])]))
        m4.metric("Avg Risk Score", f"{df_risk['Risk Score'].mean():.3f}")

        import plotly.express as px
        col_a, col_b = st.columns(2)
        with col_a:
            st.subheader("Risk Level Distribution")
            rl2 = df_risk["Risk Level"].value_counts().reset_index()
            rl2.columns = ["Risk Level", "Count"]
            rl_colours = {"CRITICAL":"#9B2335","HIGH":"#FC8181",
                          "MEDIUM":"#ECC94B","LOW":"#48BB78","INFO":"#4299E1"}
            fig_rl = px.bar(rl2, x="Risk Level", y="Count",
                            color="Risk Level", color_discrete_map=rl_colours,
                            template="plotly_dark")
            fig_rl.update_layout(showlegend=False, margin=dict(t=20,b=20,l=0,r=0), height=300)
            st.plotly_chart(fig_rl, use_container_width=True)
        with col_b:
            st.subheader("KYB Recommendation Distribution")
            kyb2 = df_risk["KYB Action"].value_counts().reset_index()
            kyb2.columns = ["Recommendation", "Count"]
            kyb_colours = {"APPROVE":"#48BB78","REVIEW":"#4299E1",
                           "ESCALATE":"#ECC94B","REJECT":"#FC8181"}
            fig_kyb = px.bar(kyb2, x="Recommendation", y="Count",
                             color="Recommendation", color_discrete_map=kyb_colours,
                             template="plotly_dark")
            fig_kyb.update_layout(showlegend=False, margin=dict(t=20,b=20,l=0,r=0), height=300)
            st.plotly_chart(fig_kyb, use_container_width=True)

        st.subheader("Jurisdiction Risk Breakdown")
        jur_risk = (df_risk.groupby("Jurisdiction")["Risk Score"]
                    .mean()
                    .sort_values(ascending=True)
                    .reset_index())
        jur_risk.columns = ["Jurisdiction", "Avg Risk Score"]
        fig_jur = px.bar(jur_risk, x="Avg Risk Score", y="Jurisdiction",
                         orientation="h", template="plotly_dark",
                         color="Avg Risk Score",
                         color_continuous_scale=["#48BB78","#ECC94B","#FC8181"])
        fig_jur.update_layout(margin=dict(t=20,b=20,l=0,r=0),
                              height=max(200, len(jur_risk) * 30))
        st.plotly_chart(fig_jur, use_container_width=True)

        st.subheader("High-Risk Entity Detail")
        df_high = df_risk[df_risk["Risk Level"].isin(["HIGH","CRITICAL"])].sort_values(
            "Risk Score", ascending=False
        )
        st.dataframe(df_high, use_container_width=True)

        st.subheader("Full Risk Portfolio")
        st.dataframe(df_risk.sort_values("Risk Score", ascending=False), use_container_width=True)

        def to_excel(df: pd.DataFrame) -> bytes:
            buf = BytesIO()
            df.to_excel(buf, index=False)
            buf.seek(0)
            return buf.read()

        st.download_button(
            "Download Risk Report (Excel)",
            data=to_excel(df_risk),
            file_name="aml_kyb_risk_report.xlsx",
        )


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 4 — TAXONOMY EXPLORER
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Taxonomy Explorer":  # Tab 3
    st.title("Taxonomy Explorer")
    te_engine = get_taxonomy_engine()

    # ── Determine context from session state ─────────────────────────────────
    has_single = (
        "single_taxonomy_df" in st.session_state
        and st.session_state["single_taxonomy_df"] is not None
        and not st.session_state["single_taxonomy_df"].empty
    )
    has_batch = (
        "batch_taxonomy_df" in st.session_state
        and st.session_state["batch_taxonomy_df"] is not None
        and not st.session_state["batch_taxonomy_df"].empty
    )

    # ── Section 1: Results from last classification ───────────────────────────
    if has_single or has_batch:
        if has_single and not has_batch:
            cname = st.session_state.get("single_result", {}).get("company_name", "last searched company")
            ctx_label = f"Classification codes for **{cname}**"
            ctx_df = st.session_state["single_taxonomy_df"].copy()
            is_batch_ctx = False
        elif has_batch and not has_single:
            n_companies = st.session_state["batch_taxonomy_df"]["Company"].nunique()
            ctx_label = f"Classification codes from last batch upload — **{n_companies} companies**"
            ctx_df = st.session_state["batch_taxonomy_df"].copy()
            is_batch_ctx = True
        else:
            # Both exist — prefer whichever was most recently set
            # single_taxonomy_df is cleared when a batch runs, so if both exist single is newer
            cname = st.session_state.get("single_result", {}).get("company_name", "last searched company")
            ctx_label = f"Classification codes for **{cname}**"
            ctx_df = st.session_state["single_taxonomy_df"].copy()
            is_batch_ctx = False

        st.markdown(f"### {ctx_label}")

        # ── Company selector for batch mode ──────────────────────────────────
        selected_company = None
        if is_batch_ctx:
            companies = sorted(ctx_df["Company"].dropna().unique().tolist())
            selected_company = st.selectbox(
                "Select a company to explore its codes:",
                options=companies,
                index=0,
            )
            ctx_df = ctx_df[ctx_df["Company"] == selected_company].copy()
            st.caption(f"Showing taxonomy codes for **{selected_company}**")

        # ── Code cards ────────────────────────────────────────────────────────
        if ctx_df.empty:
            st.info("No classification codes available for this company.")
        else:
            # Colour map per source
            source_colours = {
                "XGBoost Consensus": "#1976d2",
                "GPT-4o-mini":       "#7b1fa2",
                "GPT-4o-mini (alt)": "#9c27b0",
                "SEC EDGAR":         "#d32f2f",
                "Companies House":   "#2e7d32",
                "MCC":               "#e65100",
            }

            cols = st.columns(min(len(ctx_df), 3))
            for i, (_, row) in enumerate(ctx_df.iterrows()):
                col = cols[i % len(cols)]
                src = row.get("Source", "")
                colour = source_colours.get(src, "#546e7a")
                prob_str = str(row.get("Prob", ""))
                desc = row.get("Description", "")
                code = row.get("Code", "")
                taxonomy = row.get("Taxonomy", "")
                with col:
                    st.markdown(
                        f"""<div style="border:2px solid {colour};border-radius:8px;padding:14px;
                                        margin-bottom:10px;background:rgba(255,255,255,0.04);">
                        <div style="font-size:10px;color:{colour};font-weight:700;text-transform:uppercase;
                                    letter-spacing:1px;margin-bottom:6px;">{src}</div>
                        <div style="font-size:26px;font-weight:800;color:#ffffff;font-family:monospace;
                                    letter-spacing:2px;margin-bottom:4px;">{code}</div>
                        <div style="font-size:11px;color:#aab4c8;margin-bottom:8px;">{taxonomy}</div>
                        <div style="font-size:13px;color:#e0e6f0;margin-bottom:8px;line-height:1.4;">{desc}</div>
                        <div style="font-size:12px;color:{colour};font-weight:700;">
                            Confidence: {prob_str}</div>
                        </div>""",
                        unsafe_allow_html=True,
                    )

            st.markdown("")

            # Full table
            with st.expander("Full codes table — all sources", expanded=False):
                st.dataframe(ctx_df.drop(columns=["Company"], errors="ignore"),
                             use_container_width=True)
                csv_ctx = ctx_df.to_csv(index=False)
                st.download_button(
                    "Download as CSV",
                    data=csv_ctx,
                    file_name=f"taxonomy_codes_{(selected_company or 'company').replace(' ','_')}.csv",
                    mime="text/csv",
                )

            # ── UGO deep-dive: pre-fill search with the primary code's description
            primary_row = ctx_df[ctx_df["Source"] == "XGBoost Consensus"].head(1)
            if primary_row.empty:
                primary_row = ctx_df.head(1)
            prefill_desc = primary_row["Description"].iloc[0] if not primary_row.empty else ""
            prefill_code = primary_row["Code"].iloc[0] if not primary_row.empty else ""
            prefill_tax  = primary_row["Taxonomy"].iloc[0].replace(" ","_") if not primary_row.empty else ""

            st.markdown("---")
            st.markdown("#### Explore in the Unified Global Ontology")
            st.caption(
                "The search below is pre-filled with the primary classification code's description. "
                "It searches all 2,330 codes across all 6 taxonomies to find semantically similar codes — "
                "useful for cross-taxonomy translation or verifying the classification."
            )

            # Cross-taxonomy agreement for primary code
            if prefill_desc:
                with st.expander(
                    f"Cross-taxonomy mapping for `{prefill_code}` — {prefill_desc[:60]}…",
                    expanded=True
                ):
                    agreement = te_engine.cross_taxonomy_agreement(prefill_desc)
                    tax_cols = st.columns(3)
                    for idx, (taxonomy, records) in enumerate(agreement.items()):
                        with tax_cols[idx % 3]:
                            st.markdown(f"**{taxonomy.replace('_',' ')}**")
                            for rec in records[:3]:
                                st.markdown(
                                    f"<span style='font-family:monospace;font-weight:700'>{rec.code}</span> "
                                    f"<span style='font-size:12px;color:#555'>{rec.description[:50]}</span>",
                                    unsafe_allow_html=True,
                                )

            # Semantic distance matrix across the company's own codes
            if len(ctx_df) >= 2:
                with st.expander("Semantic distance between this company's codes (cross-ontology alignment)"):
                    sample_rows = ctx_df.head(5)
                    mat_labels = [
                        f"{r['Code']} ({r['Taxonomy'][:8]})"
                        for _, r in sample_rows.iterrows()
                    ]
                    dist_mat = []
                    for _, r1 in sample_rows.iterrows():
                        row_dists = []
                        for _, r2 in sample_rows.iterrows():
                            d = te_engine.compute_semantic_distance(
                                str(r1["Description"]), str(r2["Description"])
                            )
                            row_dists.append(round(d, 3))
                        dist_mat.append(row_dists)
                    dist_df = pd.DataFrame(dist_mat, index=mat_labels, columns=mat_labels)
                    st.caption(
                        "Values close to 0 = semantically identical codes across taxonomies. "
                        "Values close to 1 = codes describe very different activities — potential registry discrepancy signal."
                    )
                    st.dataframe(dist_df, use_container_width=True)

        st.markdown("---")

    else:
        # No classification has been run yet
        st.info(
            "No company has been classified yet. "
            "Go to the **Classify** tab, search for a company or upload a CSV, "
            "then come back here to explore the taxonomy codes found."
        )
        st.markdown("")

    # ── Section 2: Manual UGO search ─────────────────────────────────────────
    st.markdown("### Search the Unified Global Ontology")
    st.caption(
        f"Search all **{te_engine.record_count:,}** industry codes across 6 classification systems "
        "(NAICS, UK SIC, NACE, ISIC, MCC, SIC) by keyword or description."
    )

    # Pre-fill query from context if available
    prefill_query = ""
    if has_single or has_batch:
        _s = st.session_state.get("single_taxonomy_df")
        _b = st.session_state.get("batch_taxonomy_df")
        ctx_df_pf = _s if (_s is not None and not _s.empty) else _b
        if ctx_df_pf is not None and not ctx_df_pf.empty:
            primary_pf = ctx_df_pf[ctx_df_pf["Source"] == "XGBoost Consensus"].head(1)
            if primary_pf.empty:
                primary_pf = ctx_df_pf.head(1)
            if not primary_pf.empty:
                prefill_query = str(primary_pf["Description"].iloc[0])

    with st.form("ugo_search"):
        query = st.text_input(
            "Search query",
            value=prefill_query,
            placeholder="e.g. licensed restaurant food service",
        )
        col_k, col_f = st.columns([1, 2])
        with col_k:
            top_k = st.slider("Top-K results", 5, 30, 10)
        with col_f:
            tax_opts   = ["ALL", "US_NAICS_2022", "US_SIC_1987", "UK_SIC_2007",
                          "NACE_REV2", "ISIC_REV4", "MCC"]
            tax_filter = st.selectbox("Filter by taxonomy", tax_opts)
        search_btn = st.form_submit_button("Search")

    if search_btn and query.strip():
        filter_list = None if tax_filter == "ALL" else [tax_filter]
        results = te_engine.search(query.strip(), top_k=top_k, taxonomy_filter=filter_list)

        rows = [
            {
                "Taxonomy":    r.taxonomy.replace("_", " "),
                "Code":        r.code,
                "Description": r.description,
                "Similarity":  f"{score:.4f}",
            }
            for r, score in results
        ]
        if rows:
            st.dataframe(pd.DataFrame(rows), use_container_width=True)

            if len(results) >= 2:
                with st.expander("Cross-Ontology Semantic Distance Matrix"):
                    sample = results[:5]
                    labels = [f"{r.code} ({r.taxonomy[:6]})" for r, _ in sample]
                    dist_mat = []
                    for r1, _ in sample:
                        row_dists = []
                        for r2, _ in sample:
                            d = te_engine.compute_semantic_distance(r1.description, r2.description)
                            row_dists.append(d)
                        dist_mat.append(row_dists)
                    dist_df = pd.DataFrame(dist_mat, index=labels, columns=labels)
                    st.dataframe(dist_df, use_container_width=True)
        else:
            st.info("No results found. Try a broader keyword.")


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 5 — INDUSTRY LOOKUP (Jurisdiction-aware searchable dropdown)
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Industry Lookup":  # Tab 2
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
### What it does
This is the **industry code selector** for cases where a human needs to choose or verify
a classification manually. It presents the correct taxonomy for the selected jurisdiction
as a **searchable dropdown** — the same codes that would appear in a KYB onboarding form.

### Why the Taxonomy Changes by Jurisdiction
Different countries have different official standards:

| Jurisdiction | Taxonomy shown | Why |
|---|---|---|
| `gb`, `gg`, `je` (UK + Crown Dependencies) | **UK SIC 2007** | Required by Companies House and ONS for all UK entities |
| `us`, `us_*`, `ca`, `ca_*`, `au`, `au_*` | **NAICS 2022** | Official North American standard |
| `de`, `fr`, `it`, `es`, `nl`, `pl`… (EU) | **NACE Rev.2** | Eurostat statistical classification for EU reporting |
| `ae`, `ae_az`, `th`, `tz`, `in`… (global) | **ISIC Rev.4** | UN international standard — most universal |
| Any | Manual override | You can force any taxonomy regardless of jurisdiction |

### How to Use the Dropdown
1. **Select a jurisdiction** — type to search (e.g. "United Kingdom", "gb", "Missouri", "us_mo")
2. **Type in the Search box** — filter by code number OR keyword:
   - `62012` → shows only that exact UK SIC code
   - `software` → shows all codes containing "software" in the description
   - `restaurant` → shows SIC 56101, 56102, 56103 for UK; NAICS 722511 for US
3. **Click a result** to see the full detail card with JSON output

### Output — What You Get
- **Selected code** with taxonomy label and jurisdiction metadata
- **Copy-ready JSON** with all fields needed for an API call or database insert
- **Full browsable table** of all codes in that taxonomy — downloadable as CSV
- **Cross-taxonomy comparison** — see how 6 different systems classify the same keyword

### Acceptance Criteria (implemented)
- ✅ Dropdown switches to SIC 2007 when jurisdiction is `gb` (UK)
- ✅ Displays both code and description: `62012 — Business and domestic software development`
- ✅ Searchable by code number OR keyword
- ✅ Taxonomy data is stored as CSV files in `data/` — update taxonomy by swapping CSV (no code deployment)
- ✅ Works for all 200+ jurisdiction codes: `us_mo`, `ca_bc`, `ae_az`, `gg`, `je`, `pr`, `tz`…
""")
    st.markdown("---")

    # ── Jurisdiction selector ─────────────────────────────────────────────────
    st.subheader("1. Select Jurisdiction")

    col_a, col_b, col_c = st.columns([2, 2, 1])

    # Build sorted list of all known jurisdiction codes with labels
    all_jur = sorted(JR.all_codes())
    jur_display = [f"{jc}  —  {JR.lookup(jc).label if JR.lookup(jc) else jc}" for jc in all_jur]
    jur_map = dict(zip(jur_display, all_jur))

    with col_a:
        # Default to "gb" so UK example is obvious
        default_idx = all_jur.index("gb") if "gb" in all_jur else 0
        selected_display = st.selectbox(
            "Jurisdiction / Country",
            options=jur_display,
            index=default_idx,
            help="Type to search — e.g. 'united kingdom', 'us_mo', 'ca_bc', 'ae_az'",
        )
        jc = jur_map[selected_display]

    with col_b:
        # Taxonomy auto-detected from jurisdiction; allow manual override
        auto_tax = taxonomy_for_jurisdiction(jc)
        jr_rec = JR.lookup(jc)
        all_tax_opts = get_all_taxonomy_names()
        auto_idx = all_tax_opts.index(auto_tax) if auto_tax in all_tax_opts else 0

        taxonomy_override_sel = st.selectbox(
            "Taxonomy (auto-selected, can override)",
            options=all_tax_opts,
            index=auto_idx,
            format_func=lambda t: TAXONOMY_LABELS.get(t, t),
        )

    with col_c:
        if st.button("Reload taxonomy from CSV", help="Force-reload CSV from disk"):
            reload_taxonomy(taxonomy_override_sel)
            st.success("Reloaded.")

    # ── Info banner ───────────────────────────────────────────────────────────
    jr_rec   = JR.lookup(jc)
    tax_used = taxonomy_override_sel
    tax_label = TAXONOMY_LABELS.get(tax_used, tax_used)

    st.info(
        f"**Jurisdiction:** `{jc}` — {jr_rec.label if jr_rec else jc}  |  "
        f"**Sovereign country:** `{jr_rec.iso2 if jr_rec else '?'}`  |  "
        f"**Region:** {jr_rec.region_bucket if jr_rec else '?'}  |  "
        f"**Taxonomy in use:** {tax_label}"
    )

    # ── Search bar ────────────────────────────────────────────────────────────
    st.subheader("2. Search Industry")

    search_col, clear_col = st.columns([5, 1])
    with search_col:
        search_q = st.text_input(
            "Search by code or keyword",
            placeholder="e.g.  62012   or   software   or   restaurant",
            label_visibility="collapsed",
        )
    with clear_col:
        if st.button("Clear"):
            search_q = ""

    # ── Load and filter entries ───────────────────────────────────────────────
    if search_q.strip():
        entries = search_entries(jc, search_q.strip(), taxonomy_override=tax_used)
        result_label = f"{len(entries)} result(s) for **\"{search_q}\"**"
    else:
        entries = get_entries(jc, taxonomy_override=tax_used)
        result_label = f"{len(entries)} codes in {tax_label}"

    st.caption(result_label)

    # ── Interactive dropdown ──────────────────────────────────────────────────
    st.subheader("3. Select Industry Code")

    if not entries:
        st.warning("No codes found. Try a different search term or taxonomy.")
    else:
        display_options = [e["display"] for e in entries]
        display_map     = {e["display"]: e for e in entries}

        selected_display_code = st.selectbox(
            "Industry code and description",
            options=display_options,
            label_visibility="collapsed",
        )

        selected_entry = display_map[selected_display_code]

        # ── Detail card ───────────────────────────────────────────────────────
        st.markdown("---")
        st.subheader("Selected Classification")

        d1, d2, d3 = st.columns(3)
        d1.metric("Code", selected_entry["code"])
        d2.metric("Taxonomy", selected_entry["taxonomy"].replace("_", " "))
        d3.metric("Jurisdiction", jc.upper())

        st.markdown(f"**Description:** {selected_entry['description']}")
        st.markdown(f"**Official Taxonomy:** {tax_label}")

        if jr_rec:
            st.markdown(
                f"**Jurisdiction detail:** {jr_rec.label} "
                f"({'Sub-national' if jr_rec.is_subnational else 'Country'} — "
                f"{jr_rec.iso2})"
            )

        # ── Copy-ready output ─────────────────────────────────────────────────
        with st.expander("Copy-ready JSON output"):
            st.json({
                "jurisdiction_code":  jc,
                "jurisdiction_label": jr_rec.label if jr_rec else jc,
                "sovereign_country":  jr_rec.iso2 if jr_rec else "",
                "taxonomy":           selected_entry["taxonomy"],
                "taxonomy_label":     tax_label,
                "industry_code":      selected_entry["code"],
                "industry_description": selected_entry["description"],
            })

    # ── Full browsable table ──────────────────────────────────────────────────
    with st.expander(f"Browse full {tax_label} table ({len(entries)} codes)"):
        table_rows = [
            {"Code": e["code"], "Description": e["description"]}
            for e in entries
        ]
        df_table = pd.DataFrame(table_rows)
        st.dataframe(df_table, use_container_width=True, height=400)

        # Download button
        csv_bytes = df_table.to_csv(index=False).encode()
        st.download_button(
            f"Download {tax_used} CSV",
            data=csv_bytes,
            file_name=f"{tax_used}_{jc}.csv",
            mime="text/csv",
        )

    # ── Side-by-side comparison ───────────────────────────────────────────────
    st.markdown("---")
    st.subheader("Compare Across Taxonomies")
    st.markdown(
        "Enter a keyword to see how different taxonomy systems classify the same concept."
    )

    compare_q = st.text_input("Keyword for cross-taxonomy comparison", placeholder="e.g. restaurant")
    if compare_q.strip():
        compare_cols = st.columns(3)
        compare_taxonomies = ["US_NAICS_2022", "UK_SIC_2007", "NACE_REV2", "ISIC_REV4", "MCC", "US_SIC_1987"]
        for idx, tax in enumerate(compare_taxonomies):
            col = compare_cols[idx % 3]
            matches = search_entries(jc, compare_q.strip(), taxonomy_override=tax, max_results=5)
            with col:
                st.markdown(f"**{TAXONOMY_LABELS.get(tax, tax)}**")
                if matches:
                    for m in matches:
                        st.markdown(f"- `{m['code']}` {m['description'][:55]}")
                else:
                    st.caption("No matches")


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 6 — SOURCE ARCHITECTURE
# ────────────────────────────────────────────────────────────────────────────────

elif page == "__removed_source_arch__":
    from source_registry import all_sources, active_sources, planned_sources, SOURCE_REGISTRY

    st.title("Source Architecture — All Classification Data Sources")
    st.markdown(
        "Complete map of every data source the Consensus Engine uses or plans to use. "
        "Shows what each source provides, how it is queried, and its current status."
    )

    # ── Name matching explanation ─────────────────────────────────────────────
    st.subheader("How Company Name Matching Works")
    st.markdown("""
The entity lookup pipeline handles typos, case differences, suffix variations, and spacing issues
through a **5-pass matching strategy** (same algorithm as `entity_matching/core/matchers/matching_v1.py`):
""")

    col_m1, col_m2, col_m3 = st.columns(3)
    with col_m1:
        st.markdown("""
**Pass 1 — Canonical normalisation**
Handles automatically — no fuzzy needed:
- `Apple Inc.` → `APPLE`
- `APPLE INC` → `APPLE`
- `Apple Incorporated` → `APPLE`
- `Apple Corp` → `APPLE`
- `microsoft corporation` → `MICROSOFT`
- `McDonald's` → `MCDONALDS`
- `Mc Donalds` → `MCDONALDS`
- `J.P. Morgan Chase` → `JP MORGAN CHASE`
- `The Apple Company` → `APPLE`
- `Microsoft  Corporation` (double space) → `MICROSOFT`
""")
    with col_m2:
        st.markdown("""
**Pass 2–4 — Structural variations**
Substring, no-space, prefix matching:
- `Apple Inc USA` (extra word) → `APPLE` ✅
- `JPMorgan Chase` → `JP MORGAN CHASE` ✅
- `Apple Store Technology` → `APPLE` ✅

**Pass 5 — Fuzzy edit-distance (rapidfuzz)**
Handles real typos (threshold: 84/100):
- `Mycrosoft` (y→i) → **Microsoft** ✅
- `Aple Inc` (missing p) → **Apple** ✅
- `Microsft` (missing o) → **Microsoft** ✅
- `Amazzon` (double z) → **Amazon** ✅
- `Googel` (transposed) → **Google** ✅
- `Teslla` (double l) → **Tesla** ✅
- `Walmrt` (missing a) → **Walmart** ✅
""")
    with col_m3:
        st.markdown("""
**What is NOT handled (falls back to unknown):**
- Names that are too short and ambiguous (`XY Corp`)
- Names with no overlap to any known entity (`Banana Corp`)
- Companies not in the known-entity table yet

**In production (real Redshift + Entity Matching XGBoost):**
The `matching_v1.py` XGBoost model uses Jaccard k-gram similarity,
overlap coefficient, perfect match on postal code, city, and street
number — producing a `match_confidence` score per candidate pair.
Threshold ≥ 0.80 for MATCHED status.

**For unknown companies:** The engine correctly reports `INFERRED`
or `CONFLICT` status with lower confidence — meaning "we queried the
databases but could not confirm this entity with high certainty."
""")

    # ── Source table ──────────────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("All Data Sources")

    STATUS_CHIP = {
        "ACTIVE":    "🟢 ACTIVE",
        "SIMULATED": "🟡 SIMULATED",
        "PLANNED":   "🔵 PLANNED",
    }
    TYPE_CHIP = {
        "REDSHIFT_TABLE": "🗄️ Redshift",
        "API_LIVE":       "⚡ Live API",
        "API_BATCH":      "📦 Batch API",
        "INTERNAL_FILE":  "📁 Internal File",
        "AI_INFERENCE":   "🤖 AI Inference",
    }

    filter_status = st.multiselect(
        "Filter by status",
        ["ACTIVE", "SIMULATED", "PLANNED"],
        default=["ACTIVE", "SIMULATED", "PLANNED"],
    )

    for src in SOURCE_REGISTRY:
        if src.status not in filter_status:
            continue
        with st.expander(
            f"{STATUS_CHIP.get(src.status, src.status)}  |  "
            f"{TYPE_CHIP.get(src.source_type, src.source_type)}  |  "
            f"**{src.label}**  |  Weight: `{src.default_weight}`"
        ):
            c1, c2 = st.columns([1, 1])
            with c1:
                st.markdown(f"**Coverage:** {src.coverage}")
                st.markdown(f"**Freshness:** {src.freshness}")
                st.markdown(f"**Weight in XGBoost:** `{src.default_weight}` "
                            f"({'highest priority' if src.default_weight >= 0.90 else 'high' if src.default_weight >= 0.80 else 'medium' if src.default_weight >= 0.70 else 'low'})")
                if src.notes:
                    st.info(src.notes)
            with c2:
                st.markdown("**Industry fields provided:**")
                for f in src.industry_fields:
                    st.markdown(f"- `{f}`")
            if src.production_query:
                with st.expander("Production query / endpoint"):
                    st.code(src.production_query.strip(), language="sql")

    # ── Future architecture ───────────────────────────────────────────────────
    st.markdown("---")
    st.subheader("Future Architecture — Adding New Sources")
    st.markdown("""
**Yes, the architecture is fully designed to support new API sources.**
Adding a new source requires three steps:

**Step 1 — Add to `source_registry.py`**
```python
SourceDefinition(
    id="companies_house",
    label="Companies House — UK Official Registry",
    source_type="API_LIVE",
    status="PLANNED",
    default_weight=0.95,
    production_query="GET https://api.company-information.service.gov.uk/...",
    ...
)
```

**Step 2 — Add a connector in `data_simulator.py`**
```python
def _call_companies_house(self, company_name: str, jurisdiction: str) -> SourceSignal:
    # In production: call the real API
    # response = requests.get(f"https://api.company-information.service.gov.uk/search/companies?q={company_name}")
    # sic_codes = response.json()["items"][0]["sic_codes"]
    ...
```

**Step 3 — The XGBoost model automatically uses the new signal**
The feature vector gains 2 new features (confidence + status flag) for the new source.
Re-run `fit_synthetic()` to retrain the model with the expanded feature space.

**Sources that can be added immediately (no new Redshift tables needed):**
- **Companies House API** (free, no auth for basic search) → best UK SIC source
- **OpenCorporates Live API** → fresher than Redshift table copy
- **GLEIF LEI** (free, global) → entity type + parent company detection
- **D&B Direct+** (paid) → NAICS + NACE + SIC globally

**Sources that need Redshift tables first:**
- **Liberty Data** → add Redshift table + entry in `build_matching_tables.py` SOURCES dict
- Any new batch vendor → ingest to Redshift → add SQL query here
""")

    # ── Liberty Data clarification ────────────────────────────────────────────
    st.markdown("---")
    st.info("""
**Note on Liberty Data:**
Liberty Data is **not** currently defined in `entity_matching/core/matchers/build_matching_tables.py`.
The three sources in that file are: `open_corporates`, `equifax`, and `zoominfo`.
If Liberty Data exists as a Redshift table, it can be added by:
1. Adding it to the `SOURCES` dict in `build_matching_tables.py` with its Redshift SQL query
2. Adding it to `COUNTRY_SOURCES` dict for the jurisdictions it covers
3. Adding a `SourceDefinition` entry in `source_registry.py`
4. Adding a `_call_liberty_data()` connector in `data_simulator.py`
The XGBoost consensus model will automatically incorporate it as a new feature.
""")
