"""
Smart Global Industry Classification Agent (Interactive)
=========================================================
Upgraded from single-taxonomy (NAICS-only) to multi-taxonomy global engine.
Replaced Groq with OpenAI GPT-4o-mini.
Expanded entity suffix registry to 100+ global legal forms.
"""

import streamlit as st
import pandas as pd
import json
import os
import re
import time
from io import BytesIO

# ── API key + LLM ─────────────────────────────────────────────────────────────
from config import OPENAI_API_KEY
from openai import OpenAI

_client = OpenAI(api_key=OPENAI_API_KEY)

from langchain_community.tools import DuckDuckGoSearchRun
from entity_resolver import EntityResolver

# ── Page setup ─────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Global Industry Classification Agent",
    page_icon="🌐",
    layout="wide",
)

st.title("🌐 Global Industry Classification Agent")
st.markdown(
    "Upload organisations and classify them across **NAICS 2022, UK SIC 2007, "
    "NACE Rev2, ISIC Rev4, SIC 1987, and MCC** code systems automatically."
)

# ── Sidebar settings ───────────────────────────────────────────────────────────
st.sidebar.title("⚙️ Settings")
show_summary    = st.sidebar.checkbox("Show web summary", False)
show_candidates = st.sidebar.checkbox("Show UGO candidates", False)
max_candidates  = st.sidebar.slider("Candidate codes per taxonomy", 5, 20, 8)

# ── Load taxonomy data ─────────────────────────────────────────────────────────
@st.cache_data(show_spinner="Loading taxonomy data …")
def load_all_taxonomies() -> dict:
    from taxonomy_engine import TaxonomyEngine
    te = TaxonomyEngine()
    return te


@st.cache_resource
def get_taxonomy_engine():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()


te = get_taxonomy_engine()
st.success(f"✅ Unified Global Ontology loaded: {te.record_count:,} codes across 6 taxonomy systems")

# ── Entity resolver ────────────────────────────────────────────────────────────
er = EntityResolver()

search_tool = DuckDuckGoSearchRun()


def get_company_summary(org_name: str, address: str, country: str) -> str:
    profile = er.resolve(org_name, address, country)
    query = (
        f"{profile.clean_name} company industry business "
        f"what does {profile.clean_name} do {address} {country}"
    )
    try:
        result = search_tool.run(query)
        return result[:1800]
    except Exception:
        return ""


def get_ugo_candidates(summary: str, jurisdiction: str) -> dict:
    results = te.search(summary, top_k=max_candidates * 6)
    by_tax: dict = {}
    for rec, score in results:
        by_tax.setdefault(rec.taxonomy, []).append(
            {"code": rec.code, "description": rec.description}
        )
    return {k: v[:max_candidates] for k, v in by_tax.items()}


def predict_global(org_name: str, address: str, country: str):
    profile = er.resolve(org_name, address, country)
    summary = get_company_summary(org_name, address, country) or org_name
    candidates = get_ugo_candidates(summary, profile.detected_jurisdiction)

    prompt = f"""You are an expert global industry classification analyst.

Determine the best industry codes for the company across all relevant taxonomies.

Company Name: {org_name}
Cleaned Name: {profile.clean_name}
Detected Jurisdiction: {profile.detected_jurisdiction}
Detected Entity Type: {profile.detected_entity_type}
Address: {address}
Country: {country}
Web Summary: {summary[:1200]}

Candidate codes from Unified Global Ontology:
{json.dumps(candidates, indent=2)[:3000]}

Select the MOST appropriate code per taxonomy. For the jurisdiction {profile.detected_jurisdiction},
prioritise the most relevant taxonomy (US->NAICS, GB->UK_SIC, EU->NACE, others->ISIC).

Return JSON ONLY:
{{
  "primary_taxonomy": "US_NAICS_2022",
  "primary_code": "XXXXXX",
  "primary_description": "...",
  "confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "...",
  "naics_code": "XXXXXX or null",
  "naics_description": "... or null",
  "uk_sic_code": "XXXXX or null",
  "uk_sic_description": "... or null",
  "nace_code": "... or null",
  "nace_description": "... or null",
  "mcc_code": "XXXX or null",
  "mcc_description": "... or null"
}}"""

    for attempt in range(3):
        try:
            resp = _client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=500,
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content.strip()
            result = json.loads(raw)
            return (
                result.get("primary_taxonomy"),
                result.get("primary_code"),
                result.get("primary_description"),
                result.get("confidence"),
                result.get("reasoning"),
                result.get("naics_code"),
                result.get("naics_description"),
                result.get("uk_sic_code"),
                result.get("uk_sic_description"),
                result.get("nace_code"),
                result.get("nace_description"),
                result.get("mcc_code"),
                result.get("mcc_description"),
                summary,
                candidates,
                profile,
            )
        except Exception:
            if attempt < 2:
                time.sleep(1.5)
            continue

    return (
        "US_NAICS_2022", None, None, "LOW", "Classification failed",
        None, None, None, None, None, None, None, None,
        summary, candidates, profile,
    )


# ── Sidebar quick lookup ───────────────────────────────────────────────────────
st.sidebar.subheader("🔎 Quick Lookup")
s_company = st.sidebar.text_input("Company Name")
s_address = st.sidebar.text_input("Address")
s_country  = st.sidebar.text_input("Country")

if st.sidebar.button("Classify"):
    (
        primary_tax, primary_code, primary_desc, conf, reason,
        naics_code, naics_desc, uk_sic_code, uk_sic_desc,
        nace_code, nace_desc, mcc_code, mcc_desc,
        summary, cands, prof,
    ) = predict_global(s_company, s_address, s_country)

    st.sidebar.write("**Primary Taxonomy:**", primary_tax)
    st.sidebar.write("**Code:**", primary_code)
    st.sidebar.write("**Description:**", primary_desc)
    st.sidebar.write("**Confidence:**", conf)
    st.sidebar.write("**Jurisdiction:**", prof.detected_jurisdiction)
    st.sidebar.write("**Entity Type:**", prof.detected_entity_type)
    if naics_code:
        st.sidebar.write("**NAICS:**", naics_code, "—", naics_desc)
    if uk_sic_code:
        st.sidebar.write("**UK SIC:**", uk_sic_code, "—", uk_sic_desc)
    if nace_code:
        st.sidebar.write("**NACE:**", nace_code, "—", nace_desc)
    if mcc_code:
        st.sidebar.write("**MCC:**", mcc_code, "—", mcc_desc)


# ── Batch upload ───────────────────────────────────────────────────────────────
uploaded_file = st.file_uploader("Upload Excel or CSV file", type=["xlsx", "csv"])

if uploaded_file:
    df_input = (
        pd.read_excel(uploaded_file)
        if uploaded_file.name.endswith(".xlsx")
        else pd.read_csv(uploaded_file)
    )
    df_input.columns = df_input.columns.str.strip()
    st.success(f"Loaded {len(df_input)} organisations")

    st.subheader("Data Preview")
    st.dataframe(df_input.head(10))

    required_columns = ["Org Name"]
    missing_cols = [c for c in required_columns if c not in df_input.columns]
    if missing_cols:
        st.error(f"Missing required columns: {', '.join(missing_cols)}")
        st.stop()

    df_input["Address"] = df_input.get("Address", pd.Series([""] * len(df_input)))
    df_input["Country"] = df_input.get("Country", pd.Series([""] * len(df_input)))

    if st.button("🚀 Classify All (Global Multi-Taxonomy)"):
        start = time.time()
        results = []
        progress = st.progress(0)
        status   = st.empty()

        for i, row in df_input.iterrows():
            status.text(f"Processing: {row['Org Name']}")
            (
                primary_tax, primary_code, primary_desc, conf, reason,
                naics_code, naics_desc, uk_sic_code, uk_sic_desc,
                nace_code, nace_desc, mcc_code, mcc_desc,
                summary, cands, prof,
            ) = predict_global(row["Org Name"], row["Address"], row["Country"])

            results.append({
                "Org Name":          row["Org Name"],
                "Clean Name":        prof.clean_name,
                "Jurisdiction":      prof.detected_jurisdiction,
                "Entity Type":       prof.detected_entity_type,
                "Primary Taxonomy":  primary_tax,
                "Primary Code":      primary_code,
                "Primary Desc":      primary_desc,
                "Confidence":        conf,
                "NAICS Code":        naics_code,
                "NAICS Desc":        naics_desc,
                "UK SIC Code":       uk_sic_code,
                "UK SIC Desc":       uk_sic_desc,
                "NACE Code":         nace_code,
                "NACE Desc":         nace_desc,
                "MCC Code":          mcc_code,
                "MCC Desc":          mcc_desc,
                "Reasoning":         reason,
            })
            progress.progress((i + 1) / len(df_input))

        df_results = pd.DataFrame(results)
        elapsed = time.time() - start

        st.success(f"✅ Classification complete in {elapsed:.1f}s")
        st.subheader("Confidence Distribution")
        st.bar_chart(df_results["Confidence"].value_counts())

        edited = st.data_editor(df_results)
        st.dataframe(edited)

        def to_excel(df):
            buf = BytesIO()
            df.to_excel(buf, index=False)
            buf.seek(0)
            return buf

        st.download_button(
            "📥 Download Excel",
            data=to_excel(edited),
            file_name="global_classified_output.xlsx",
        )
