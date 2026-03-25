"""
Global Classification Agent (LLM-Only, no RAG)
===============================================
Upgraded: Groq → OpenAI GPT-4o-mini, NAICS-only → multi-taxonomy,
limited suffixes → 100+ global entity resolver.
Uses only GPT-4o-mini with web search — no vector index retrieval.
"""

import streamlit as st
import pandas as pd
import json
import re
from io import BytesIO

from config import OPENAI_API_KEY
from openai import OpenAI
from langchain_community.tools import DuckDuckGoSearchRun
from entity_resolver import EntityResolver

_client = OpenAI(api_key=OPENAI_API_KEY)

st.set_page_config(
    page_title="Global Classification Agent (LLM-Only)",
    page_icon="🌐",
    layout="wide",
)

st.title("🌐 Global Classification Agent (LLM-Only, No RAG)")
st.markdown(
    "Classify organisations across multiple taxonomy systems using OpenAI GPT-4o-mini "
    "and web search — without vector retrieval."
)

er = EntityResolver()
search_tool = DuckDuckGoSearchRun()


def get_company_summary(org_name: str, country: str) -> str:
    profile = er.resolve(org_name, country=country)
    query = f"{profile.clean_name} company industry business what does it do {country}"
    try:
        return search_tool.run(query)[:1500]
    except Exception:
        return ""


def predict_global_llm_only(
    org_name: str,
    address: str = "",
    country: str = "",
) -> dict:
    profile  = er.resolve(org_name, address, country)
    summary  = get_company_summary(org_name, country) or org_name

    prompt = f"""You are a world-class global industry classification expert.

Based solely on the information below, classify this company across all major
industry taxonomy systems. Use your training knowledge to assign the best codes.

Company Name: {org_name}
Cleaned Name: {profile.clean_name}
Address: {address}
Country: {country}
Detected Jurisdiction: {profile.detected_jurisdiction}
Detected Entity Type: {profile.detected_entity_type}
Detected Legal Suffixes: {profile.suffixes_found}
Web Summary: {summary[:1500]}

Assign the best code for each taxonomy. Return valid JSON only:
{{
  "primary_taxonomy": "US_NAICS_2022 | UK_SIC_2007 | NACE_REV2 | ISIC_REV4",
  "primary_code": "...",
  "primary_description": "...",
  "primary_confidence": "HIGH | MEDIUM | LOW",
  "naics_code": "6-digit code or null",
  "naics_description": "... or null",
  "uk_sic_code": "5-digit code or null",
  "uk_sic_description": "... or null",
  "nace_code": "e.g. I56 or null",
  "nace_description": "... or null",
  "isic_code": "4-digit code or null",
  "isic_description": "... or null",
  "mcc_code": "4-digit code or null",
  "mcc_description": "... or null",
  "reasoning": "brief explanation"
}}"""

    try:
        resp = _client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        data = json.loads(resp.choices[0].message.content.strip())
        data["jurisdiction"]   = profile.detected_jurisdiction
        data["entity_type"]    = profile.detected_entity_type
        data["clean_name"]     = profile.clean_name
        data["suffixes_found"] = ", ".join(profile.suffixes_found)
        data["web_summary"]    = summary
        return data
    except Exception as exc:
        return {
            "primary_code":         None,
            "primary_description":  str(exc),
            "primary_confidence":   "LOW",
            "reasoning":            "Classification failed",
            "jurisdiction":         profile.detected_jurisdiction,
            "entity_type":          profile.detected_entity_type,
            "clean_name":           profile.clean_name,
            "suffixes_found":       "",
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

    required_columns = ["Org Name", "Address"]
    missing = [c for c in required_columns if c not in df_input.columns]
    if missing:
        st.error(f"Missing required columns: {', '.join(missing)}")
        st.stop()

    df_input["Country"] = df_input.get("Country", pd.Series([""] * len(df_input)))

    if st.button("🚀 Classify (LLM-Only, Global)"):
        results = []
        progress = st.progress(0)

        for i, row in df_input.iterrows():
            res = predict_global_llm_only(
                org_name=row["Org Name"],
                address=str(row.get("Address", "")),
                country=str(row.get("Country", "")),
            )
            results.append({
                "Org Name":          row["Org Name"],
                "Clean Name":        res.get("clean_name", ""),
                "Address":           row.get("Address", ""),
                "Country":           row.get("Country", ""),
                "Jurisdiction":      res.get("jurisdiction", ""),
                "Entity Type":       res.get("entity_type", ""),
                "Suffixes":          res.get("suffixes_found", ""),
                "Primary Taxonomy":  res.get("primary_taxonomy", ""),
                "Primary Code":      res.get("primary_code", ""),
                "Primary Desc":      res.get("primary_description", ""),
                "Confidence":        res.get("primary_confidence", ""),
                "NAICS Code":        res.get("naics_code", ""),
                "NAICS Desc":        res.get("naics_description", ""),
                "UK SIC Code":       res.get("uk_sic_code", ""),
                "UK SIC Desc":       res.get("uk_sic_description", ""),
                "NACE Code":         res.get("nace_code", ""),
                "NACE Desc":         res.get("nace_description", ""),
                "ISIC Code":         res.get("isic_code", ""),
                "ISIC Desc":         res.get("isic_description", ""),
                "MCC Code":          res.get("mcc_code", ""),
                "MCC Desc":          res.get("mcc_description", ""),
                "Reasoning":         res.get("reasoning", ""),
            })
            progress.progress((i + 1) / len(df_input))

        df_results = pd.DataFrame(results)
        st.success("✅ Classification Completed")
        st.dataframe(df_results, use_container_width=True)

        def to_excel(df):
            buf = BytesIO()
            df.to_excel(buf, index=False)
            buf.seek(0)
            return buf

        st.download_button(
            "📥 Download Excel",
            data=to_excel(df_results),
            file_name="global_classified_llm_only.xlsx",
        )
