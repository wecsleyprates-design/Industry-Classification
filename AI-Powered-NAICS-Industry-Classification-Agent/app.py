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
    """Render the full consensus output in the Streamlit UI."""
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Primary Code", result.primary_industry.code)
    with col2:
        st.metric("Taxonomy", result.primary_industry.taxonomy.replace("_", " "))
    with col3:
        st.metric(
            "Consensus Probability",
            f"{result.primary_industry.consensus_probability:.1%}",
        )
    with col4:
        rcolour = _RISK_COLOURS.get(risk_profile.overall_risk_level, "#666")
        st.metric("Risk Level", risk_profile.overall_risk_level)

    st.markdown(f"**Primary Industry:** {result.primary_industry.label}")
    st.markdown(f"**Jurisdiction:** `{result.jurisdiction}` | **Entity Type:** `{result.entity_type}`")

    # ── Result interpretation banner ──────────────────────────────────────────
    prob  = result.primary_industry.consensus_probability
    rlvl  = risk_profile.overall_risk_level
    kyb   = risk_profile.kyb_recommendation

    if prob >= 0.70 and rlvl in ("LOW", "MEDIUM"):
        st.success(
            f"**High-confidence classification.** The consensus model is {prob:.0%} confident "
            f"in this primary code. Sources are largely in agreement and no critical risk signals detected."
        )
    elif prob >= 0.50:
        st.warning(
            f"**Moderate confidence ({prob:.0%}).** The model has reasonable confidence but sources "
            f"show some disagreement. Review the Source Lineage below to understand which vendors "
            f"contributed and whether any conflicts exist."
        )
    elif prob < 0.30:
        src_statuses = [v.get("status","") for v in result.source_lineage.values()]
        n_matched  = sum(1 for s in src_statuses if s == "MATCHED")
        n_inferred = sum(1 for s in src_statuses if s == "INFERRED")
        n_conflict = sum(1 for s in src_statuses if s == "CONFLICT")
        if n_matched < 2:
            st.warning(
                f"**Low consensus probability ({prob:.0%}) — this company was not found in the internal "
                f"Redshift tables (OpenCorporates, Equifax, ZoomInfo).** "
                f"Only {n_matched}/6 sources returned a confirmed match. "
                f"{n_inferred} source(s) returned INFERRED codes (AI-derived, not from a database record) "
                f"and {n_conflict} showed CONFLICT. "
                f"The XGBoost model is uncertain because sources disagree. "
                f"This is expected for private, small, or newly-registered companies. "
                f"Adding more information (website, full address) or manually reviewing the code is recommended."
            )
        else:
            st.error(
                f"**Low consensus probability ({prob:.0%}) — sources have high conflict.** "
                f"{n_matched}/6 sources matched but returned different codes. "
                f"This can indicate a multi-sector conglomerate, a holding company with diverse subsidiaries, "
                f"or a data quality issue across vendors. Check the Source Lineage table below."
            )
    else:
        st.warning(
            f"**Confidence: {prob:.0%}.** Check the Source Lineage and Feature Debug sections below "
            f"to understand what is driving uncertainty."
        )

    # ── External Registry Data ────────────────────────────────────────────────
    if external_registry and external_registry.found_anything:
        with st.expander("External Registry Data — Authoritative Government Sources"):
            ext_dict = external_registry.to_dict()
            if "sec_edgar" in ext_dict:
                ed = ext_dict["sec_edgar"]
                st.markdown(f"**SEC EDGAR (US)**  [{ed.get('name','')}]({ed.get('url','')})")
                col_e1, col_e2, col_e3 = st.columns(3)
                col_e1.metric("SIC Code", ed.get("sic", ""))
                col_e2.metric("SIC Description", ed.get("sic_description", ""))
                col_e3.metric("State / Entity Type", f"{ed.get('state','')} · {ed.get('entity_type','')}")
                if ed.get("ticker"):
                    st.markdown(f"**Ticker:** `{ed['ticker']}` | **CIK:** `{ed['cik']}`")
                if ed.get("former_names"):
                    st.markdown(f"**Former names:** {', '.join(ed['former_names'][:3])}")
            if "companies_house" in ext_dict:
                ch = ext_dict["companies_house"]
                st.markdown(f"**Companies House (UK)**  [{ch.get('name','')}]({ch.get('url','')})")
                col_c1, col_c2 = st.columns(2)
                col_c1.markdown(f"**SIC Codes:** {', '.join(ch.get('sic_codes', []))}")
                col_c1.markdown(f"**Descriptions:** {' | '.join(ch.get('sic_descriptions', []))}")
                col_c2.markdown(f"**Type:** {ch.get('type','')} | **Status:** {ch.get('status','')}")
                if ch.get("incorporated"):
                    col_c2.markdown(f"**Incorporated:** {ch['incorporated']}")
            st.caption(
                "These codes were filed directly by the company with the government registry. "
                "They are the highest-authority source for classification."
            )
    elif external_registry is not None:
        with st.expander("External Registry Data"):
            st.info(
                "No external registry record found for this company. "
                "SEC EDGAR covers US public companies (SEC filers). "
                "Companies House covers UK registered companies (requires COMPANIES_HOUSE_API_KEY). "
                "Classification is based on vendor signals and UGO semantic search."
            )

    # ── LLM reasoning ─────────────────────────────────────────────────────────
    if llm_result.reasoning:
        with st.expander("LLM Classification Reasoning"):
            # Source used badge
            src_used = getattr(llm_result, "source_used", "")
            if src_used:
                src_colour = {
                    "registry":          "#2E7D32",
                    "vendor_consensus":  "#1565C0",
                    "semantic_search":   "#6A1B9A",
                    "web_inference":     "#E65100",
                }.get(src_used, "#546E7A")
                st.markdown(
                    f"**Evidence source used:** "
                    f'<span style="background:{src_colour};color:white;padding:3px 10px;'
                    f'border-radius:4px;font-size:12px">{src_used.replace("_"," ").upper()}</span>',
                    unsafe_allow_html=True,
                )

            st.write(llm_result.reasoning)

            # Registry conflict alert
            if getattr(llm_result, "registry_conflict", False):
                st.warning(
                    f"⚠️ **Registry conflict detected:** {getattr(llm_result, 'registry_conflict_note', '')}"
                )

            # MCC
            if llm_result.mcc_code:
                mcc_risk = getattr(llm_result, "mcc_risk_note", None) or "normal"
                mcc_colour = "#C62828" if "high_risk" in mcc_risk else "#2E7D32"
                st.markdown(
                    f"**MCC Code:** `{llm_result.mcc_code}` — {llm_result.mcc_label}  "
                    f'<span style="background:{mcc_colour};color:white;padding:2px 8px;'
                    f'border-radius:3px;font-size:11px">{mcc_risk.upper()}</span>',
                    unsafe_allow_html=True,
                )

    # ── Secondary codes ───────────────────────────────────────────────────────
    if result.secondary_industries:
        with st.expander("Secondary Industry Classifications"):
            for sec in result.secondary_industries:
                st.markdown(
                    f"- **{sec.taxonomy.replace('_',' ')}** `{sec.code}` "
                    f"— {sec.label} "
                    f"*(prob: {sec.consensus_probability:.1%})*"
                )

    # ── LLM alternative codes ─────────────────────────────────────────────────
    if llm_result.alternative_codes:
        with st.expander("Cross-Taxonomy Alternative Codes (LLM)"):
            for alt in llm_result.alternative_codes:
                st.markdown(
                    f"- **{alt.get('taxonomy','').replace('_',' ')}** "
                    f"`{alt.get('code','')}` — {alt.get('label','')}"
                )

    # ── Risk signals ──────────────────────────────────────────────────────────
    st.subheader("Risk Signals")
    if not risk_profile.signals:
        st.success("No risk signals detected.")
    else:
        for sig in risk_profile.signals:
            sev = sig.severity
            emoji = _SEVERITY_EMOJI.get(sev, "")
            colour = _RISK_COLOURS.get(sev, "#666")
            with st.expander(f"{emoji} [{sev}] {sig.flag}"):
                st.markdown(sig.description)
                if sig.evidence:
                    st.json(sig.evidence)

        rcolour = _RISK_COLOURS.get(risk_profile.overall_risk_level, "#666")
        st.markdown(
            f"**Overall Risk Score:** `{risk_profile.overall_risk_score:.2f}` — "
            + _risk_badge(risk_profile.overall_risk_level)
            + f"&nbsp;&nbsp;**KYB Recommendation:** `{risk_profile.kyb_recommendation}`",
            unsafe_allow_html=True,
        )

    # ── Source lineage ────────────────────────────────────────────────────────
    with st.expander("Source Lineage — What Each Vendor Returned"):
        # Colour-coded status
        STATUS_COLOURS = {
            "MATCHED":     "#2E7D32",
            "INFERRED":    "#1565C0",
            "CONFLICT":    "#E65100",
            "POLLUTED":    "#C62828",
            "UNAVAILABLE": "#9E9E9E",
        }

        lin_rows = []
        for src, v in result.source_lineage.items():
            lin_rows.append({
                "Source":     src,
                "Code":       v["value"].split("-", 2)[-1] if "-" in v["value"] else v["value"],
                "Taxonomy":   v["value"].split("-")[0].upper().replace("_", " ") if "-" in v["value"] else "",
                "Description": v.get("label", ""),
                "Weight":     f"{v['weight']:.2f}",
                "Status":     v["status"],
                "Confidence": f"{v['confidence']:.0%}",
            })
        lin_df = pd.DataFrame(lin_rows)
        st.dataframe(lin_df, use_container_width=True)

        # ── Glossary ──────────────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("##### How to read this table")

        col_g1, col_g2 = st.columns(2)
        with col_g1:
            st.markdown("""
**Source** — which data provider produced this signal:
- `opencorporates` → Official government registries worldwide *(highest authority)* — Redshift: `dev.datascience.open_corporates_standard_ml_2`
- `equifax` → Equifax commercial credit bureau — Redshift batch file: `dev.warehouse.equifax_us_standardized`
- `trulioo` → Trulioo KYB/KYC live API — primary vendor for UK/Canada
- `zoominfo` → ZoomInfo B2B firmographics — Redshift: `dev.datascience.zoominfo_standard_ml_2`
- `liberty_data` → Liberty Data commercial intelligence — Redshift: `dev.warehouse.liberty_data_standard` *(4th entity-matching source)*
- `ai_semantic` → Our own AI enrichment: web search + GPT-4o-mini inference

**Weight** — how much this source's opinion counts in the consensus (0.0–1.0):
- `opencorporates` = 0.90 *(authoritative government data)*
- `zoominfo` = 0.80, `trulioo` = 0.80 *(high-quality APIs)*
- `liberty_data` = 0.78 *(commercial intelligence overlay)*
- `equifax` = 0.70 *(batch file — may be days or weeks old)*
- `ai_semantic` = 0.70 *(AI inference — useful but not authoritative)*
- Higher weight = more influence on the final XGBoost consensus score
""")
        with col_g2:
            st.markdown("""
**Status** — the quality assessment of this source's match:
- 🟢 `MATCHED` — the entity was found in the **real Redshift table** with high name/address similarity (≥ 0.80 confidence). The industry code comes directly from the live database record.
- 🔵 `INFERRED` — no direct database match found; code was inferred by AI from web presence or calculated from context.
- 🟠 `CONFLICT` — the source returned a code but it disagrees significantly with the majority of other sources. Flagged for review.
- 🔴 `POLLUTED` — Trulioo returned a 4-digit SIC code in a jurisdiction that uses 5–6 digit codes. Known data quality issue — this signal is down-weighted automatically.
- 🟡 `SIMULATED` — Redshift credentials are not configured. The signal is **simulated** (not from real data). Set `REDSHIFT_HOST`, `REDSHIFT_USER`, `REDSHIFT_PASSWORD`, `REDSHIFT_DB` environment variables to activate live data for OpenCorporates, Equifax, ZoomInfo, and Liberty Data.
- ⚫ `UNAVAILABLE` — source did not return data for this entity.

**Confidence** — the entity-matching model's certainty (0–100%) that this source's record belongs to the *same real-world company* as the input:
- Computed by the **entity_matching XGBoost model** (model: `entity_matching_20250127`) using name similarity (Jaccard k-gram), address similarity, postal code match, and city match as features — same algorithm as `matching_v1.py`
- ≥ 80%: reliable match — the source's industry code is trustworthy
- 50–80%: moderate match — used but down-weighted
- < 50%: low match — essentially ignored by the consensus
""")

        st.info(
            "**How the final code is chosen:** The XGBoost consensus model takes all 6 source signals "
            "plus 32 additional features (jurisdiction, entity type, temporal history, semantic distance…) "
            "and outputs a probability distribution over all possible industry codes. "
            "The code with the highest consensus probability becomes the primary classification. "
            "It is NOT a simple majority vote — sources with higher weight and higher confidence "
            "have proportionally more influence."
        )

    # ── Feature debug ─────────────────────────────────────────────────────────
    with st.expander("Feature Debug — XGBoost Model Inputs (38 features)"):
        debug = result.feature_debug
        col_d1, col_d2 = st.columns(2)
        with col_d1:
            st.markdown("**Data Quality Features**")
            tp = debug.get("trulioo_polluted", False)
            wrd = debug.get("web_registry_distance", 0)
            tps = debug.get("temporal_pivot_score", 0)
            cta = debug.get("cross_taxonomy_agreement", 0)
            mca = debug.get("majority_code_agreement", 0)
            st.markdown(f"- **Trulioo Polluted:** `{tp}` — {'⚠️ Trulioo returned wrong digit-length code' if tp else '✅ Trulioo data format is correct'}")
            st.markdown(f"- **Web↔Registry Distance:** `{wrd:.2f}` — {'🔴 High gap: web activity differs from registry filing' if wrd > 0.55 else ('🟡 Moderate gap' if wrd > 0.30 else '🟢 Web and registry agree')}")
            st.markdown(f"- **Temporal Pivot Score:** `{tps:.2f}` — {'🔴 Code changed frequently = potential fraud signal' if tps > 0.7 else ('🟡 Some code change' if tps > 0.3 else '🟢 Stable classification history')}")
            st.markdown(f"- **Cross-Taxonomy Agreement:** `{cta:.2f}` — {int(cta*6)}/6 taxonomy systems agree on the same semantic cluster")
            st.markdown(f"- **Majority Code Agreement:** `{mca:.2f}` — {mca:.0%} of sources returned the same code")
        with col_d2:
            st.markdown("**Jurisdiction Features**")
            jc = debug.get("jurisdiction_code", "")
            jl = debug.get("jurisdiction_label", "")
            rb = debug.get("region_bucket", "")
            sub = debug.get("is_subnational", False)
            naics_j = debug.get("is_naics_jurisdiction", False)
            hrisk = debug.get("high_risk_naics_flag", False)
            avg_conf = debug.get("avg_source_confidence", 0)
            st.markdown(f"- **Jurisdiction:** `{jc}` ({jl})")
            st.markdown(f"- **Region Bucket:** `{rb}` → determines which taxonomy is primary")
            st.markdown(f"- **Sub-national:** `{sub}` (state/province/emirate level)")
            st.markdown(f"- **NAICS Jurisdiction:** `{naics_j}` → {'NAICS 2022 is primary taxonomy' if naics_j else 'Non-NAICS taxonomy preferred'}")
            st.markdown(f"- **High-Risk NAICS:** `{hrisk}` — {'⚠️ At least one source code is in an AML-elevated sector' if hrisk else '✅ No high-risk sector codes detected'}")
            st.markdown(f"- **Avg Source Confidence:** `{avg_conf:.0%}` — average entity-matching confidence across all sources")
        with st.expander("Raw JSON (all 38 feature values)"):
            st.json(debug)

    # ── Results summary table + download ─────────────────────────────────────
    st.markdown("---")
    st.subheader("Complete Results — Table View")
    st.caption("All classification and risk data for this company in one downloadable table.")

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

# ── Redshift connection status ────────────────────────────────────────────────
from redshift_connector import get_connector as _get_rc
_rc = _get_rc()
if _rc.is_connected:
    st.sidebar.success("🗄️ Redshift: LIVE", icon="✅")
    st.sidebar.caption("OpenCorporates, Equifax, ZoomInfo, Liberty Data querying real tables.")
else:
    st.sidebar.warning("🗄️ Redshift: SIMULATED", icon="⚠️")
    st.sidebar.caption(
        "Set REDSHIFT_HOST / REDSHIFT_USER / REDSHIFT_PASSWORD / REDSHIFT_DB "
        "environment variables to connect to real data. "
        "Trulioo and AI Semantic always require their own API keys."
    )

page = st.sidebar.radio(
    "Navigate",
    [
        "Single Company Lookup",
        "Batch Classification",
        "Risk Dashboard",
        "Taxonomy Explorer",
        "Industry Lookup",
        "Source Architecture",
    ],
    index=0,
)

# Initialise engines on sidebar so they load once
te = get_taxonomy_engine()
ce = get_consensus_engine()
re_engine = get_risk_engine()
er = get_entity_resolver()


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 1 — SINGLE COMPANY LOOKUP
# ────────────────────────────────────────────────────────────────────────────────

if page == "Single Company Lookup":
    st.title("Single Company Global Classification")
    st.markdown(
        "Enter a company name and optional metadata. The engine runs entity resolution, "
        "multi-source vendor simulation, UGO semantic search, XGBoost consensus, "
        "LLM enrichment, and AML/KYB risk scoring in a single pipeline."
    )

    with st.expander("How this pipeline works — click to understand what you're seeing"):
        st.markdown("""
**Step 1 — Entity Resolution**
The company name is canonised using the same algorithm as Worth's `entity_matching` pipeline
(stripping legal suffixes like LLC, GmbH, PLC, SAS; normalising accents and special characters).
The system then looks up the canonical name against a known-entity table — simulating a live query
to the Redshift tables used by `matching_v1.py`:
- `dev.datascience.open_corporates_standard_ml_2`
- `dev.warehouse.equifax_us_standardized`
- `dev.datascience.zoominfo_standard_ml_2`

**Step 2 — Multi-Source Signal Collection (Level 0)**
Six vendor sources are queried simultaneously. For recognised companies, each source returns
its actual industry code from the database record, with a `match_confidence` from the entity-matching
XGBoost model (`entity_matching_20250127`). For unknown companies, signals are simulated.

**Step 3 — Feature Engineering (Level 1)**
38 numeric features are computed from the 6 source signals. These include: per-source weighted
confidence, data quality flags (Trulioo pollution), semantic distance between registry and web
labels, temporal pivot score (how often the code changes), jurisdiction one-hot encoding,
entity type flags, and source agreement scores.

**Step 4 — XGBoost Consensus (Level 2)**
An XGBoost multi-class classifier takes the 38-feature vector and outputs a probability
distribution over all industry codes. The top-5 codes with their probabilities are returned.
A low probability (< 40%) means the model is uncertain — not that the company is risky.

**Step 5 — LLM Enrichment**
GPT-4o-mini selects the best code per taxonomy from UGO semantic search candidates,
considering the company's jurisdiction to pick the correct taxonomy (UK SIC for GB, NACE for EU, etc.).

**Step 6 — Risk Engine**
Nine AML/KYB signal detectors check for: registry vs. web discrepancy, shell company patterns,
high-risk sector codes, industry code pivot history, source conflicts, and data quality issues.
Risk signals reflect data quality and structural patterns — not a judgment on the company's integrity.

**Important note on well-known companies:**
For globally recognised companies (Apple, Google, etc.), the current simulator has entity-matching
data that returns correct codes. If a company shows a low consensus probability or unexpected signals,
it means the entity is either unknown to the simulator, or the "Inject shell-company conflict"
checkbox is enabled.
""")
    st.markdown("---")

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
# PAGE 2 — BATCH CLASSIFICATION
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Batch Classification":
    st.title("Batch Global Classification")
    st.markdown(
        "Process hundreds of companies at once. Upload a file, run the full pipeline "
        "on every row, and download a results spreadsheet with industry codes, "
        "risk scores, and KYB recommendations."
    )

    with st.expander("What this page does — inputs, outputs, and how to interpret results"):
        st.markdown("""
### What it does
Runs the **complete 6-step classification pipeline** (entity resolution → 6-source vendor lookup →
38-feature XGBoost consensus → LLM enrichment → AML/KYB risk engine) on every row in your file simultaneously.

### Input file format
Upload a **CSV or Excel (.xlsx)** file. The app **auto-detects your column names** — including Amex/Worth AI format columns like `lgl_nm_worth`, `dba_nm_worth`, etc.

#### Standard column names (any of these work)

| What the field is | Column names the app recognises |
|---|---|
| **Company name** ✅ Required | `Org Name`, `lgl_nm_worth`, `lgl_nm_received`, `company_name`, `business_name`, `name`, `Company`, `BusinessName` |
| **DBA / Trade name** | `dba_nm_worth`, `dba_nm_received`, `dba_name`, `DBA`, `trade_name` |
| **Full address** | `full_address_worth`, `Address`, `business_address_received`, `address`, `street_address` |
| **Street address line 1** | `address_1_worth`, `address_1`, `street_1`, `Address Line 1` |
| **City** | `city_worth`, `city`, `City` |
| **State / Region** | `region_worth`, `region`, `state`, `State`, `Region` |
| **Postal / ZIP code** | `zip_code_worth`, `postal_code`, `zip`, `postcode`, `ZIP Code` |
| **Country** | `country_worth`, `country`, `Country` |
| **Description / URL** | `Description`, `website`, `url`, `business_description` |
| **UID / Reference** | `uid_worth`, `uid_received` — passed through to output for traceability |

#### How extra fields improve confidence

The more fields you provide, the better the entity matching (Model 1) and classification consensus (Model 2):

| Fields provided | Entity matching | Classification confidence |
|---|---|---|
| Company name only | Low | Low |
| + Country | Low | Medium (correct taxonomy routing) |
| + ZIP / postal code | **High** (strongest address signal) | High |
| + Full address + City | Very high | Very high |
| + DBA name + Region | Excellent | Excellent |

**Minimum recommended:** `lgl_nm_worth` (or `Org Name`) + `country_worth` (or `Country`)

### Output columns explained

| Column | What it means |
|--------|---------------|
| `Clean Name` | Company name after suffix removal (LLC, GmbH, PLC…) and accent normalisation |
| `Jurisdiction` | Detected OpenCorporates jurisdiction code (`us`, `gb`, `us_mo`, `ca_bc`…) |
| `Entity Type` | Detected legal entity type: Operating / Holding / Partnership / NGO / Trust |
| `Primary Taxonomy` | Which classification system was used for the primary code (auto-selected per jurisdiction) |
| `Primary Code` | The winning industry code (e.g. `334118` for Apple, `64191` for Barclays) |
| `Primary Desc` | Human-readable description of the primary code |
| `Consensus Prob` | XGBoost model's confidence in the primary code — **0.0–1.0** (higher = more certain) |
| `LLM Code` | Code selected by GPT-4o-mini from UGO semantic search candidates |
| `LLM Taxonomy` | Taxonomy the LLM used (may differ from XGBoost if sources disagree) |
| `LLM Confidence` | LLM self-reported confidence: HIGH / MEDIUM / LOW |
| `MCC Code` | Merchant Category Code (4-digit Visa/Mastercard payment network code) |
| `Risk Level` | Aggregate AML/KYB risk: **LOW / MEDIUM / HIGH / CRITICAL** |
| `Risk Score` | Numeric risk score 0.00–1.00 (sum of all signal scores, capped at 1.0) |
| `KYB Recommendation` | Action recommendation: **APPROVE / REVIEW / ESCALATE / REJECT** |
| `Risk Flags` | Semicolon-separated list of triggered risk signals |

### How to interpret Consensus Probability
- **≥ 0.70**: High confidence — well-known company or sources strongly agree
- **0.40–0.70**: Moderate confidence — some source disagreement, review recommended
- **< 0.40**: Low confidence — company unknown to databases, or sources heavily conflict

### How to interpret Risk Level
- 🟢 **LOW** (score < 0.25): Standard business. No significant AML signals. → APPROVE
- 🟡 **MEDIUM** (0.25–0.50): Some flags raised. Requires manual review. → REVIEW
- 🟠 **HIGH** (0.50–0.75): Significant signals. Needs escalation. → ESCALATE
- 🔴 **CRITICAL** (≥ 0.75): Multiple serious signals. → REJECT pending investigation

### Tips
- Company names with typos resolve automatically (`Mycrosoft` → Microsoft)
- The `Country` column accepts jurisdiction codes (`us_mo`, `ca_bc`, `ae_az`) for state/province precision
- Download the Excel output, then use the `Risk Level` column to filter for HIGH/CRITICAL cases
""")
    st.markdown("---")

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
            st.success(f"Batch complete in {elapsed:.1f}s")

            # Confidence distribution chart
            if "Consensus Prob" in df_results.columns:
                st.subheader("Consensus Probability Distribution")
                hist = pd.cut(
                    df_results["Consensus Prob"].dropna(),
                    bins=[0, 0.3, 0.5, 0.7, 0.85, 1.0],
                    labels=["<30%", "30–50%", "50–70%", "70–85%", ">85%"],
                ).value_counts().sort_index()
                st.bar_chart(hist)

            # Risk level distribution
            if "Risk Level" in df_results.columns:
                st.subheader("Risk Level Distribution")
                st.bar_chart(df_results["Risk Level"].value_counts())

            # Editable results table
            st.subheader("Results")
            edited = st.data_editor(df_results, use_container_width=True)

            # Download
            def to_excel(df: pd.DataFrame) -> bytes:
                buf = BytesIO()
                df.to_excel(buf, index=False)
                buf.seek(0)
                return buf.read()

            st.download_button(
                "Download Results (Excel)",
                data=to_excel(edited),
                file_name="global_classification_results.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 3 — RISK DASHBOARD
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Risk Dashboard":
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

        col_a, col_b = st.columns(2)
        with col_a:
            st.subheader("Risk Level Distribution")
            st.bar_chart(df_risk["Risk Level"].value_counts())
        with col_b:
            st.subheader("KYB Recommendation Distribution")
            st.bar_chart(df_risk["KYB Action"].value_counts())

        st.subheader("Jurisdiction Risk Breakdown")
        jur_risk = df_risk.groupby("Jurisdiction")["Risk Score"].mean().sort_values(ascending=False)
        st.bar_chart(jur_risk)

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

elif page == "Taxonomy Explorer":
    st.title("Unified Global Ontology Explorer")
    st.markdown(
        "Semantic search engine across all 2,330 industry codes in 6 taxonomy systems. "
        "Type any business description and instantly see cross-taxonomy matches ranked by similarity."
    )

    # ── Show codes from previous search/upload ────────────────────────────────
    _single_tax_df = st.session_state.get("single_taxonomy_df")
    _batch_tax_df  = st.session_state.get("batch_taxonomy_df")
    _single_name   = st.session_state.get("single_result", {}).get("company_name", "")

    if _single_tax_df is not None and not _single_tax_df.empty:
        st.success(f"Showing codes classified for: **{_single_name}**")
        st.subheader(f"Classification Codes for {_single_name}")
        st.dataframe(_single_tax_df, use_container_width=True, hide_index=True)

        # UGO semantic search for each code to show cross-taxonomy neighbours
        te_e = get_taxonomy_engine()
        with st.expander("Cross-taxonomy exploration — find similar codes in other systems"):
            for _, row in _single_tax_df.iterrows():
                if not row.get("Description") or row.get("Prob") == "—":
                    continue
                label = row["Description"]
                sim_results = te_e.search(label, top_k=5)
                st.markdown(f"**{row['Source']} `{row['Code']}`** — *{label}*")
                sim_rows = [
                    {
                        "Taxonomy":    r.taxonomy.replace("_"," "),
                        "Code":        r.code,
                        "Description": r.description,
                        "Similarity":  f"{score:.3f}",
                    }
                    for r, score in sim_results
                    if r.code != row["Code"]
                ][:4]
                if sim_rows:
                    st.dataframe(pd.DataFrame(sim_rows), use_container_width=True, hide_index=True)
        st.markdown("---")
        st.subheader("Search the full taxonomy index below")

    elif _batch_tax_df is not None and not _batch_tax_df.empty:
        n_companies = _batch_tax_df["Company"].nunique() if "Company" in _batch_tax_df.columns else 0
        st.success(f"Showing codes from your batch file — {len(_batch_tax_df)} codes across {n_companies} companies.")
        st.subheader("All Classification Codes from Batch File")

        # Filter by company
        companies = sorted(_batch_tax_df["Company"].unique().tolist()) if "Company" in _batch_tax_df.columns else []
        if len(companies) > 1:
            selected_company = st.selectbox("Filter by company (or show all)", ["All companies"] + companies)
            if selected_company != "All companies":
                show_df = _batch_tax_df[_batch_tax_df["Company"] == selected_company]
            else:
                show_df = _batch_tax_df
        else:
            show_df = _batch_tax_df

        st.dataframe(show_df, use_container_width=True, hide_index=True)

        # Download
        csv_bytes = show_df.to_csv(index=False).encode()
        st.download_button(
            "📥 Download Taxonomy Results (CSV)",
            data=csv_bytes,
            file_name="taxonomy_codes.csv",
            mime="text/csv",
        )
        st.markdown("---")
        st.subheader("Search the full taxonomy index below")
    else:
        st.info(
            "**Tip:** Search a company in **Single Company Lookup** or upload a file in **Batch Classification** "
            "and the codes assigned to your companies will appear here automatically, with cross-taxonomy "
            "exploration for each code."
        )

    with st.expander("What this page does — how semantic search works and how to use it"):
        st.markdown("""
### What it does
This is the **Unified Global Ontology (UGO)** — a FAISS vector index of all 2,330 industry
codes across 6 classification systems, embedded using `all-MiniLM-L6-v2` sentence transformers.

Instead of keyword matching, it uses **cosine similarity** in embedding space: codes whose
*meaning* is similar rank higher, even if the words are different.

### The 6 Taxonomy Systems

| Taxonomy | Authority | Jurisdictions | Codes | Use case |
|----------|-----------|--------------|-------|----------|
| **NAICS 2022** | US Census Bureau | US, Canada, Australia | 1,033 | Primary for North America |
| **UK SIC 2007** | Companies House / ONS | UK, Guernsey, Jersey | 386 | Required for UK regulatory reporting |
| **NACE Rev.2** | Eurostat | All EU/EEA countries | 88 | EU statistical classification |
| **ISIC Rev.4** | United Nations | Global fallback | 439 | International/UN standard |
| **US SIC 1987** | SEC / US Government | United States (legacy) | 79 | Legacy codes; Equifax still uses these |
| **MCC** | Visa / Mastercard | Global (payment networks) | 305 | Payment processing compliance |

### How to Search
Type any business description, product category, or activity. Examples:
- `"restaurant food service"` → UK SIC 56101, NAICS 722511, ISIC 5610
- `"software development consulting"` → UK SIC 62012, NAICS 541512, NACE J62
- `"banking financial services"` → UK SIC 64191, NAICS 522110, NACE K64
- `"pharmaceutical manufacturing"` → NAICS 325412, UK SIC 21200, NACE C21

### Understanding the Similarity Score
The Similarity column shows the **cosine similarity** (0.0–1.0):
- **≥ 0.75**: Very strong semantic match — this code almost certainly describes your business
- **0.55–0.75**: Good match — likely relevant but verify the description
- **< 0.55**: Weak match — tangentially related

### Cross-Taxonomy Distance Matrix
When you search, the app also shows a **semantic distance matrix** between the top 5 results.
- **0.00**: Codes describe identical concepts (e.g. NAICS 722511 and UK SIC 56101 both = "full-service restaurant")
- **0.50+**: Codes describe different sectors (e.g. restaurant vs. financial services)
This demonstrates **Cross-Ontology Embedding Alignment** — the ability to directly compare
codes from different systems without a hardcoded crosswalk table.

### Cross-Taxonomy Agreement
Enter a description in the bottom section to see what each taxonomy maps it to.
High agreement (same concept across 4+ taxonomies) = high classification confidence.
""")
    st.markdown("---")

    te_engine = get_taxonomy_engine()

    st.info(
        f"Loaded **{te_engine.record_count:,}** taxonomy records across "
        f"6 classification systems."
    )

    with st.form("ugo_search"):
        query     = st.text_input("Search query", placeholder="e.g. licensed restaurant food service")
        top_k     = st.slider("Top-K results", 5, 30, 10)
        tax_opts  = ["ALL", "US_NAICS_2022", "US_SIC_1987", "UK_SIC_2007",
                     "NACE_REV2", "ISIC_REV4", "MCC"]
        tax_filter = st.selectbox("Filter by taxonomy", tax_opts)
        search_btn = st.form_submit_button("Search UGO")

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
        st.dataframe(pd.DataFrame(rows), use_container_width=True)

        if len(results) >= 2:
            st.subheader("Cross-Ontology Semantic Distance Matrix")
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
            st.dataframe(dist_df.style.background_gradient(cmap="RdYlGn_r"), use_container_width=True)

    # Cross-taxonomy agreement demo
    st.subheader("Cross-Taxonomy Agreement")
    st.markdown(
        "Enter a free-text description to see what each taxonomy maps it to."
    )
    desc_input = st.text_input("Business description", placeholder="e.g. software development consulting")
    if desc_input.strip():
        agreement = te_engine.cross_taxonomy_agreement(desc_input.strip())
        for taxonomy, records in agreement.items():
            st.markdown(f"**{taxonomy.replace('_',' ')}**")
            for rec in records:
                st.markdown(f"  - `{rec.code}` — {rec.description}")


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 5 — INDUSTRY LOOKUP (Jurisdiction-aware searchable dropdown)
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Industry Lookup":
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

elif page == "Source Architecture":
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
