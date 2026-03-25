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

@st.cache_resource(show_spinner="Loading Unified Global Ontology …")
def get_taxonomy_engine():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()


@st.cache_resource(show_spinner="Training consensus model …")
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

    # 4. LLM multi-taxonomy classification
    llm_result = llm_classify(
        company_name=company_name,
        business_description=llm_profile.primary_business_description,
        jurisdiction=entity.detected_jurisdiction,
        candidates_by_taxonomy=candidates_by_taxonomy,
        web_summary=llm_profile.web_summary,
    )

    # 5. Vendor simulation (OpenCorporates + Equifax + Trulioo + ZoomInfo + D&B + AI)
    bundle = sim.fetch(
        company_name=company_name,
        address=address,
        country=country,
        jurisdiction=entity.detected_jurisdiction,
        entity_type=llm_profile.probable_entity_type,
        web_summary=llm_profile.primary_business_description,
        force_conflict=force_conflict,
    )

    # 6. Consensus model
    consensus_result = ce.predict(bundle)

    # 7. Risk evaluation
    risk_profile = re.evaluate(bundle, consensus_result)
    consensus_result.risk_signals = [s.to_dict() for s in risk_profile.signals]

    return entity, bundle, consensus_result, risk_profile, llm_result


def display_consensus_result(
    entity, bundle, result, risk_profile, llm_result
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

    # ── LLM reasoning ─────────────────────────────────────────────────────────
    if llm_result.reasoning:
        with st.expander("LLM Classification Reasoning"):
            st.write(llm_result.reasoning)
            if llm_result.mcc_code:
                st.write(f"**MCC Code:** {llm_result.mcc_code} — {llm_result.mcc_label}")

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
- `opencorporates` → Official government company registries worldwide *(highest authority)*
- `equifax` → Equifax commercial credit bureau — batch file from Redshift warehouse
- `trulioo` → Trulioo KYB/KYC verification API — primary vendor for UK/Canada
- `zoominfo` → ZoomInfo B2B firmographic database — live API
- `duns` → Dun & Bradstreet — DUNS number linked industry code
- `ai_semantic` → Our own AI enrichment: web search + GPT-4o-mini inference

**Weight** — how much this source's opinion counts in the consensus (0.0–1.0):
- `opencorporates` = 0.90 *(authoritative government data)*
- `zoominfo` = 0.80, `trulioo` = 0.80 *(high-quality live APIs)*
- `equifax` = 0.70 *(batch file — may be days or weeks old)*
- `ai_semantic` = 0.70 *(AI inference — useful but not authoritative)*
- Higher weight = more influence on the final XGBoost consensus score
""")
        with col_g2:
            st.markdown("""
**Status** — the quality assessment of this source's match:
- 🟢 `MATCHED` — the entity was found in this source's database with high name/address similarity (entity-matching XGBoost score ≥ 0.80). The industry code comes directly from the source's registry record.
- 🔵 `INFERRED` — no direct entity match found; code was inferred by AI from web presence or calculated from context.
- 🟠 `CONFLICT` — the source returned a code but it disagrees significantly with the majority of other sources. Flagged for review.
- 🔴 `POLLUTED` — Trulioo returned a 4-digit SIC code in a jurisdiction that uses 5–6 digit codes. Known data quality issue — this signal is down-weighted automatically.
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

    # ── Raw JSON output ───────────────────────────────────────────────────────
    with st.expander("Full JSON Output"):
        out = result.to_dict()
        out["consensus_output"]["risk_profile"] = risk_profile.to_dict()
        st.json(out)


# ────────────────────────────────────────────────────────────────────────────────
# SIDEBAR NAVIGATION
# ────────────────────────────────────────────────────────────────────────────────

st.sidebar.title("🌐 Global Classification Engine")
st.sidebar.caption(
    "Multi-taxonomy · XGBoost Consensus · AML/KYB Risk · Unified Global Ontology"
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
            entity, bundle, result, risk, llm = run_full_pipeline(
                company_name=company_name.strip(),
                address=address.strip(),
                country=country.strip(),
                web_summary=web_summary.strip(),
                force_conflict=force_conflict,
            )
            elapsed = time.time() - t0

        st.success(f"Pipeline completed in {elapsed:.2f}s")
        display_consensus_result(entity, bundle, result, risk, llm)

    elif submitted:
        st.warning("Please enter a company name.")


# ────────────────────────────────────────────────────────────────────────────────
# PAGE 2 — BATCH CLASSIFICATION
# ────────────────────────────────────────────────────────────────────────────────

elif page == "Batch Classification":
    st.title("Batch Global Classification")
    st.markdown(
        "Upload an Excel or CSV file. Required column: **Org Name**. "
        "Optional: **Address**, **Country**, **Description**."
    )

    uploaded = st.file_uploader("Upload file", type=["csv", "xlsx"])

    if uploaded:
        if uploaded.name.endswith(".xlsx"):
            df_input = pd.read_excel(uploaded)
        else:
            df_input = pd.read_csv(uploaded)
        df_input.columns = df_input.columns.str.strip()

        if "Org Name" not in df_input.columns:
            st.error("File must contain an 'Org Name' column.")
            st.stop()

        df_input["Address"]     = df_input.get("Address", pd.Series([""] * len(df_input)))
        df_input["Country"]     = df_input.get("Country", pd.Series([""] * len(df_input)))
        df_input["Description"] = df_input.get("Description", pd.Series([""] * len(df_input)))

        st.dataframe(df_input.head(10), use_container_width=True)
        st.info(f"{len(df_input)} records loaded.")

        if st.button("Run Batch Classification", type="primary"):
            results = []
            prog = st.progress(0)
            status = st.empty()
            t0 = time.time()

            for i, row in df_input.iterrows():
                status.text(f"Processing {i+1}/{len(df_input)}: {row['Org Name']}")
                try:
                    entity, bundle, result, risk, llm = run_full_pipeline(
                        company_name=str(row["Org Name"]),
                        address=str(row.get("Address", "")),
                        country=str(row.get("Country", "")),
                        web_summary=str(row.get("Description", "")),
                    )
                    results.append({
                        "Org Name":            row["Org Name"],
                        "Clean Name":          entity.clean_name,
                        "Jurisdiction":        entity.detected_jurisdiction,
                        "Entity Type":         entity.detected_entity_type,
                        "Primary Code":        result.primary_industry.code,
                        "Primary Taxonomy":    result.primary_industry.taxonomy,
                        "Primary Label":       result.primary_industry.label,
                        "Consensus Prob":      round(result.primary_industry.consensus_probability, 4),
                        "LLM Code":            llm.primary_code,
                        "LLM Taxonomy":        llm.primary_taxonomy,
                        "LLM Label":           llm.primary_label,
                        "LLM Confidence":      llm.primary_confidence,
                        "MCC Code":            llm.mcc_code or "",
                        "Risk Level":          risk.overall_risk_level,
                        "Risk Score":          round(risk.overall_risk_score, 4),
                        "KYB Recommendation":  risk.kyb_recommendation,
                        "Risk Flags":          "; ".join(s.flag for s in risk.signals),
                    })
                except Exception as exc:
                    results.append({
                        "Org Name": row["Org Name"],
                        "Risk Level": "ERROR",
                        "KYB Recommendation": "REVIEW",
                        "Risk Flags": str(exc),
                    })
                prog.progress((i + 1) / len(df_input))

            elapsed = time.time() - t0
            df_results = pd.DataFrame(results)
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
        "Analyse a portfolio of companies for AML/CTF risk signals. "
        "Generates a synthetic dataset of 50 companies for demonstration."
    )

    n_companies = st.slider("Number of synthetic companies to analyse", 10, 100, 50)

    if st.button("Generate Risk Report", type="primary"):
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

        # Summary metrics
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
        "Semantically search across all six taxonomy systems simultaneously. "
        "The UGO index maps every code into a shared embedding space for "
        "cross-ontology alignment (NAICS ↔ UK SIC ↔ NACE ↔ ISIC ↔ MCC)."
    )

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
        "Select a country or jurisdiction and instantly get the correct official "
        "taxonomy for that location. The dropdown automatically switches to "
        "**SIC 2007** for the UK, **NACE Rev.2** for EU countries, **NAICS 2022** "
        "for US/Canada/Australia, and **ISIC Rev.4** for all other jurisdictions. "
        "Search by code number or keyword."
    )

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
