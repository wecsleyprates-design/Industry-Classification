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
_RISK_COLOURS = {
    "CRITICAL": "#d32f2f",
    "HIGH":     "#f57c00",
    "MEDIUM":   "#fbc02d",
    "LOW":      "#388e3c",
    "INFO":     "#1976d2",
}

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
    with st.expander("Source Lineage"):
        lin_df = pd.DataFrame([
            {
                "Source": src,
                "Code": v["value"],
                "Label": v["label"],
                "Weight": f"{v['weight']:.2f}",
                "Status": v["status"],
                "Confidence": f"{v['confidence']:.2f}",
            }
            for src, v in result.source_lineage.items()
        ])
        st.dataframe(lin_df, use_container_width=True)

    # ── Feature debug ─────────────────────────────────────────────────────────
    with st.expander("Feature Debug (Model Inputs)"):
        st.json(result.feature_debug)

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
