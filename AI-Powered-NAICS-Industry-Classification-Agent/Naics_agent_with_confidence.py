"""
Batch Global Enrichment Agent with Confidence Scoring (OpenAI + UGO + FAISS)
=============================================================================
Upgraded: Groq → OpenAI GPT-4o-mini, NAICS-only → 6-taxonomy UGO,
limited suffixes → 100+ global entity resolver.
Confidence is derived from UGO vector distance + source agreement.
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
    page_title="Global Enrichment Agent (with Confidence)",
    page_icon="🌐",
    layout="wide",
)

st.title("🌐 Global Enrichment Agent (OpenAI + UGO + Confidence Scoring)")
st.markdown("Upload organisations and get multi-taxonomy classification with confidence scores.")

# ── Load UGO ───────────────────────────────────────────────────────────────────
@st.cache_resource(show_spinner="Building Unified Global Ontology …")
def setup_ugo():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()


te = setup_ugo()
er = EntityResolver()
search_tool = DuckDuckGoSearchRun()

st.success(f"✅ UGO loaded: {te.record_count:,} records")
st.info("✅ Embedding model and FAISS index ready")


# ── Confidence calculation ─────────────────────────────────────────────────────
def calculate_confidence(similarity_score: float, rank: int) -> str:
    if similarity_score >= 0.75 and rank == 0:
        return "HIGH"
    elif similarity_score >= 0.55 and rank <= 2:
        return "MEDIUM"
    else:
        return "LOW"


# ── Prediction function ────────────────────────────────────────────────────────
def predict_global_with_confidence(
    org_name: str,
    description: str = "",
    country: str = "",
):
    profile = er.resolve(org_name, country=country)

    try:
        web_info = search_tool.run(
            f"{profile.clean_name} company industry business {country}"
        )[:1200]
    except Exception:
        web_info = ""

    query_text = f"{org_name} {description} {web_info[:400]}"
    ugo_results = te.search(query_text, top_k=30)

    # Organise top results by taxonomy
    candidates: dict = {}
    by_taxonomy_scores: dict = {}
    for rec, score in ugo_results:
        candidates.setdefault(rec.taxonomy, []).append(
            {"code": rec.code, "description": rec.description}
        )
        by_taxonomy_scores.setdefault(rec.taxonomy, []).append(float(score))
    candidates = {k: v[:6] for k, v in candidates.items()}

    # Top UGO result info for confidence
    top_score = float(ugo_results[0][1]) if ugo_results else 0.5
    top_rank  = 0
    raw_confidence = calculate_confidence(top_score, top_rank)

    prompt = f"""You are a global industry classification expert.

Organization: {org_name} (jurisdiction: {profile.detected_jurisdiction})
Entity Type: {profile.detected_entity_type}
Description: {description}
Web Summary: {web_info[:800]}

UGO Candidates:
{json.dumps(candidates, indent=2)[:2500]}

Return valid JSON only:
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
  "mcc_description": "... or null"
}}"""

    try:
        resp = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=500,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content.strip())
        data["confidence"]   = raw_confidence
        data["ugo_score"]    = round(top_score, 4)
        data["jurisdiction"] = profile.detected_jurisdiction
        data["entity_type"]  = profile.detected_entity_type
        data["clean_name"]   = profile.clean_name
        return data
    except Exception as exc:
        return {
            "primary_code":   None,
            "primary_description": str(exc),
            "confidence":     "LOW",
            "ugo_score":      0.0,
            "jurisdiction":   profile.detected_jurisdiction,
            "entity_type":    profile.detected_entity_type,
            "clean_name":     profile.clean_name,
        }


# ── File upload ────────────────────────────────────────────────────────────────
uploaded_file = st.file_uploader("Upload Excel or CSV file", type=["xlsx", "csv"])

if uploaded_file:
    df_input = (
        pd.read_excel(uploaded_file)
        if uploaded_file.name.endswith(".xlsx")
        else pd.read_csv(uploaded_file)
    )
    df_input.columns = df_input.columns.str.strip()
    st.success(f"Loaded {len(df_input)} organisations")

    if "Org Name" not in df_input.columns:
        st.error("Input file must contain 'Org Name' column")
        st.stop()

    df_input["Description"] = df_input.get("Description", pd.Series([""] * len(df_input)))
    df_input["Country"]     = df_input.get("Country",     pd.Series([""] * len(df_input)))

    if st.button("🚀 Enrich with Confidence Scoring"):
        results = []
        progress = st.progress(0)

        for i, row in df_input.iterrows():
            res = predict_global_with_confidence(
                org_name=str(row["Org Name"]),
                description=str(row.get("Description", "")),
                country=str(row.get("Country", "")),
            )
            results.append({
                "Org Name":         row["Org Name"],
                "Clean Name":       res.get("clean_name", ""),
                "Jurisdiction":     res.get("jurisdiction", ""),
                "Entity Type":      res.get("entity_type", ""),
                "Primary Taxonomy": res.get("primary_taxonomy", ""),
                "Primary Code":     res.get("primary_code", ""),
                "Primary Desc":     res.get("primary_description", ""),
                "Confidence":       res.get("confidence", ""),
                "UGO Score":        res.get("ugo_score", ""),
                "NAICS Code":       res.get("naics_code", ""),
                "NAICS Desc":       res.get("naics_description", ""),
                "UK SIC Code":      res.get("uk_sic_code", ""),
                "UK SIC Desc":      res.get("uk_sic_description", ""),
                "NACE Code":        res.get("nace_code", ""),
                "NACE Desc":        res.get("nace_description", ""),
                "MCC Code":         res.get("mcc_code", ""),
                "MCC Desc":         res.get("mcc_description", ""),
            })
            progress.progress((i + 1) / len(df_input))

        df_results = pd.DataFrame(results)
        st.success("✅ Enrichment Completed")

        st.subheader("Confidence Distribution")
        st.bar_chart(df_results["Confidence"].value_counts())

        st.subheader("UGO Similarity Score Distribution")
        st.bar_chart(
            pd.cut(
                df_results["UGO Score"].dropna().astype(float),
                bins=5,
                labels=["Very Low","Low","Medium","High","Very High"],
            ).value_counts().sort_index()
        )

        st.dataframe(df_results, use_container_width=True)

        def to_excel(df):
            buf = BytesIO()
            df.to_excel(buf, index=False)
            buf.seek(0)
            return buf

        st.download_button(
            "📥 Download Enriched Excel",
            data=to_excel(df_results),
            file_name="global_enriched_with_confidence.xlsx",
        )
