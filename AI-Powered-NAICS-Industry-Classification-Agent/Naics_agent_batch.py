"""
Batch Global Industry Enrichment Agent (RAG + OpenAI + UGO)
============================================================
Upgraded: Groq → OpenAI GPT-4o-mini, NAICS-only → 6-taxonomy UGO,
limited suffixes → 100+ global entity resolver.
"""

import streamlit as st
import pandas as pd
import numpy as np
import json
import re
from io import BytesIO

from config import OPENAI_API_KEY
from openai import OpenAI
from langchain_community.tools import DuckDuckGoSearchRun
from entity_resolver import EntityResolver

_client = OpenAI(api_key=OPENAI_API_KEY)

st.set_page_config(
    page_title="Batch Global Enrichment Agent",
    page_icon="🌐",
    layout="wide",
)

st.title("🌐 Batch Global Industry Enrichment Agent (RAG + OpenAI + UGO)")
st.markdown(
    "Upload organisations to predict their industry codes across NAICS 2022, "
    "UK SIC 2007, NACE Rev2, ISIC Rev4, US SIC 1987, and MCC using AI + Web Search + RAG."
)

# ── Load UGO ───────────────────────────────────────────────────────────────────
@st.cache_resource(show_spinner="Building Unified Global Ontology …")
def setup_ugo():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()


te = setup_ugo()
er = EntityResolver()
search_tool = DuckDuckGoSearchRun()

st.success(f"✅ UGO loaded: {te.record_count:,} taxonomy records")
st.info("✅ OpenAI GPT-4o-mini and entity resolver ready")


# ── Prediction function ────────────────────────────────────────────────────────
def predict_global_agent(
    org_name: str,
    org_description: str = "",
    country: str = "",
    top_k: int = 8,
) -> dict:
    profile = er.resolve(org_name, country=country)
    query_text = f"{org_name} {org_description} {country}"

    try:
        web_info = search_tool.run(
            f"{profile.clean_name} company profile industry {country}"
        )[:1500]
    except Exception:
        web_info = ""

    full_query = f"{query_text} {web_info[:500]}"
    ugo_results = te.search(full_query, top_k=top_k * 6)

    candidates: dict = {}
    for rec, score in ugo_results:
        candidates.setdefault(rec.taxonomy, []).append(
            {"code": rec.code, "description": rec.description, "score": round(float(score), 4)}
        )
    candidates = {k: v[:top_k] for k, v in candidates.items()}

    prompt = f"""You are a global KYB and industry classification expert.

Organization: {org_name}
Country: {country}
Description: {org_description}
Jurisdiction: {profile.detected_jurisdiction}
Entity Type: {profile.detected_entity_type}
Web Summary: {web_info[:800]}

Candidate codes from Unified Global Ontology:
{json.dumps(candidates, indent=2)[:2500]}

Select the best code per taxonomy. Respond with valid JSON only:
{{
  "primary_taxonomy": "...",
  "primary_code": "...",
  "primary_description": "...",
  "naics_code": "... or null",
  "naics_description": "... or null",
  "uk_sic_code": "... or null",
  "uk_sic_description": "... or null",
  "nace_code": "... or null",
  "nace_description": "... or null",
  "mcc_code": "... or null",
  "mcc_description": "... or null",
  "confidence": "HIGH | MEDIUM | LOW"
}}"""

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
        result["clean_name"] = profile.clean_name
        result["jurisdiction"] = profile.detected_jurisdiction
        result["entity_type"] = profile.detected_entity_type
        return result
    except Exception as exc:
        return {
            "primary_code": None,
            "primary_description": str(exc),
            "confidence": "LOW",
            "clean_name": profile.clean_name,
            "jurisdiction": profile.detected_jurisdiction,
            "entity_type": profile.detected_entity_type,
        }


# ── File upload ────────────────────────────────────────────────────────────────
uploaded_file = st.file_uploader(
    "Upload Excel/CSV with organisations", type=["xlsx", "csv"]
)

if uploaded_file:
    df_input = (
        pd.read_excel(uploaded_file)
        if uploaded_file.name.endswith(".xlsx")
        else pd.read_csv(uploaded_file)
    )
    df_input.columns = df_input.columns.str.strip()
    st.success(f"✅ Loaded {len(df_input)} organisations for enrichment.")

    if "Org Name" not in df_input.columns:
        st.error("Missing required column: Org Name")
        st.stop()

    df_input["Description"] = df_input.get("Description", pd.Series([""] * len(df_input)))
    df_input["Country"]     = df_input.get("Country",     pd.Series([""] * len(df_input)))

    if st.button("🚀 Enrich Organisations (Global Multi-Taxonomy)"):
        results = []
        progress = st.progress(0)
        status   = st.empty()

        for idx, row in df_input.iterrows():
            status.text(f"Processing {idx+1}/{len(df_input)}: {row['Org Name']}")
            res = predict_global_agent(
                org_name=row["Org Name"],
                org_description=str(row.get("Description", "")),
                country=str(row.get("Country", "")),
            )
            results.append({
                "Org Name":          row["Org Name"],
                "Clean Name":        res.get("clean_name", ""),
                "Jurisdiction":      res.get("jurisdiction", ""),
                "Entity Type":       res.get("entity_type", ""),
                "Primary Taxonomy":  res.get("primary_taxonomy", ""),
                "Primary Code":      res.get("primary_code", ""),
                "Primary Desc":      res.get("primary_description", ""),
                "Confidence":        res.get("confidence", ""),
                "NAICS Code":        res.get("naics_code", ""),
                "NAICS Desc":        res.get("naics_description", ""),
                "UK SIC Code":       res.get("uk_sic_code", ""),
                "UK SIC Desc":       res.get("uk_sic_description", ""),
                "NACE Code":         res.get("nace_code", ""),
                "NACE Desc":         res.get("nace_description", ""),
                "MCC Code":          res.get("mcc_code", ""),
                "MCC Desc":          res.get("mcc_description", ""),
            })
            progress.progress((idx + 1) / len(df_input))

        st.success("✅ Enrichment Complete!")
        df_results = pd.DataFrame(results)
        st.dataframe(df_results, use_container_width=True)

        def to_excel(df):
            buf = BytesIO()
            df.to_excel(buf, index=False)
            buf.seek(0)
            return buf

        st.download_button(
            "📥 Download Enriched Excel",
            data=to_excel(df_results),
            file_name="global_enriched_organisations.xlsx",
        )
