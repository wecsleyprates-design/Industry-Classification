"""
LLM Enrichment Layer — OpenAI GPT-4o-mini
==========================================
Handles all LLM-backed operations:

  • Web search via DuckDuckGo
  • Structured entity profile extraction (GPT-4o-mini with JSON mode)
  • Multi-taxonomy code selection from UGO candidates
  • Semantic discrepancy explanation generation

Uses OpenAI exclusively (replaces Groq).
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Optional

from openai import OpenAI
from langchain_community.tools import DuckDuckGoSearchRun

from config import (
    OPENAI_API_KEY,
    OPENAI_CHAT_MODEL,
    WEB_SEARCH_MAX_CHARS,
    WEB_SEARCH_ENABLED,
    DDGS_REGION,
)

logger = logging.getLogger(__name__)

_client = OpenAI(api_key=OPENAI_API_KEY)


# ── Web search ─────────────────────────────────────────────────────────────────

def web_search(query: str, max_chars: int = WEB_SEARCH_MAX_CHARS) -> str:
    """
    DuckDuckGo search. Returns the top result text, capped at max_chars.
    Returns empty string on failure (graceful degradation).
    """
    if not WEB_SEARCH_ENABLED:
        return ""
    try:
        tool = DuckDuckGoSearchRun()
        raw = tool.run(query)
        return raw[:max_chars].strip()
    except Exception as exc:
        logger.warning(f"Web search failed: {exc}")
        return ""


# ── Structured extraction from web summary ────────────────────────────────────

@dataclass
class EnrichedProfile:
    company_name: str
    cleaned_name: str
    probable_jurisdiction: str
    probable_entity_type: str
    primary_business_description: str
    secondary_activities: list[str] = field(default_factory=list)
    web_summary: str = ""
    confidence: str = "MEDIUM"


def enrich_company_profile(
    company_name: str,
    address: str = "",
    country: str = "",
    web_summary: str = "",
) -> EnrichedProfile:
    """
    Use GPT-4o-mini to extract a structured business profile from raw inputs.
    Falls back to heuristics on API error.
    """
    if not web_summary:
        query = f"{company_name} company business industry {country} {address}"
        web_summary = web_search(query)

    prompt = f"""You are a global KYB (Know Your Business) expert.

Analyse the following company information and produce a structured business profile.

Company Name: {company_name}
Address: {address}
Country / Jurisdiction: {country}
Web Intelligence: {web_summary[:1500] if web_summary else "Not available"}

Return a JSON object with these exact keys:
{{
  "cleaned_name": "company name without legal suffix",
  "probable_jurisdiction": "ISO-3166-1 alpha-2 country code (e.g. US, GB, DE)",
  "probable_entity_type": "Operating | Holding | Partnership | Trust | Fund | NGO",
  "primary_business_description": "one sentence description of what the company does",
  "secondary_activities": ["optional list of secondary business activities"],
  "confidence": "HIGH | MEDIUM | LOW"
}}

If any field cannot be determined, use reasonable defaults. Return valid JSON only."""

    for attempt in range(3):
        try:
            response = _client.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=400,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            return EnrichedProfile(
                company_name=company_name,
                cleaned_name=data.get("cleaned_name", company_name),
                probable_jurisdiction=data.get("probable_jurisdiction", country or "UNKNOWN"),
                probable_entity_type=data.get("probable_entity_type", "Operating"),
                primary_business_description=data.get("primary_business_description", ""),
                secondary_activities=data.get("secondary_activities", []),
                web_summary=web_summary,
                confidence=data.get("confidence", "MEDIUM"),
            )
        except Exception as exc:
            logger.warning(f"LLM profile extraction attempt {attempt+1} failed: {exc}")
            if attempt < 2:
                time.sleep(1.5 ** attempt)

    # Fallback
    return EnrichedProfile(
        company_name=company_name,
        cleaned_name=company_name,
        probable_jurisdiction=country or "UNKNOWN",
        probable_entity_type="Operating",
        primary_business_description=web_summary[:200] if web_summary else "",
        web_summary=web_summary,
        confidence="LOW",
    )


# ── Multi-taxonomy code selection ─────────────────────────────────────────────

@dataclass
class LLMClassificationResult:
    primary_taxonomy: str
    primary_code: str
    primary_label: str
    primary_confidence: str
    reasoning: str
    alternative_codes: list[dict] = field(default_factory=list)
    mcc_code: Optional[str] = None
    mcc_label: Optional[str] = None


def llm_classify(
    company_name: str,
    business_description: str,
    jurisdiction: str,
    candidates_by_taxonomy: dict,   # {taxonomy: [{code, description}, ...]}
    web_summary: str = "",
) -> LLMClassificationResult:
    """
    GPT-4o-mini selects the best code per taxonomy from UGO candidates.
    Returns a structured multi-taxonomy classification.
    """
    candidates_json = json.dumps(candidates_by_taxonomy, indent=2)

    prompt = f"""You are a world-class industry classification expert specialising in
global taxonomy systems (NAICS 2022, US SIC 1987, UK SIC 2007, NACE Rev2, ISIC Rev4, MCC).

Company: {company_name}
Jurisdiction: {jurisdiction}
Business Description: {business_description}
Web Summary: {web_summary[:1000] if web_summary else "N/A"}

Candidate codes retrieved from the Unified Global Ontology:
{candidates_json[:3000]}

Instructions:
1. Determine the primary taxonomy based on jurisdiction ({jurisdiction}).
   - For US → prefer US_NAICS_2022
   - For GB → prefer UK_SIC_2007
   - For EU (DE/FR/IT/ES/NL/...) → prefer NACE_REV2
   - For others → prefer ISIC_REV4 or US_NAICS_2022
2. Select the single MOST appropriate code from that taxonomy's candidates.
3. Select the best MCC code if MCC candidates are provided.
4. List up to 2 alternative codes from other taxonomies.
5. Provide concise reasoning.

Return a JSON object with these exact keys:
{{
  "primary_taxonomy": "e.g. US_NAICS_2022",
  "primary_code": "e.g. 722511",
  "primary_label": "Full-Service Restaurants",
  "primary_confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "brief explanation",
  "mcc_code": "e.g. 5812 or null",
  "mcc_label": "e.g. Eating Places Restaurants or null",
  "alternative_codes": [
    {{"taxonomy": "UK_SIC_2007", "code": "56101", "label": "Licensed restaurants"}},
    {{"taxonomy": "NACE_REV2", "code": "I56", "label": "Food and beverage service activities"}}
  ]
}}

Return valid JSON only."""

    for attempt in range(3):
        try:
            response = _client.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=600,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            data = json.loads(raw)
            return LLMClassificationResult(
                primary_taxonomy=data.get("primary_taxonomy", "US_NAICS_2022"),
                primary_code=data.get("primary_code", ""),
                primary_label=data.get("primary_label", ""),
                primary_confidence=data.get("primary_confidence", "LOW"),
                reasoning=data.get("reasoning", ""),
                alternative_codes=data.get("alternative_codes", []),
                mcc_code=data.get("mcc_code"),
                mcc_label=data.get("mcc_label"),
            )
        except Exception as exc:
            logger.warning(f"LLM classify attempt {attempt+1} failed: {exc}")
            if attempt < 2:
                time.sleep(1.5 ** attempt)

    return LLMClassificationResult(
        primary_taxonomy="US_NAICS_2022",
        primary_code="",
        primary_label="Classification failed",
        primary_confidence="LOW",
        reasoning="LLM unavailable; fallback to UGO semantic search result.",
    )


# ── Discrepancy explanation ───────────────────────────────────────────────────

def explain_discrepancy(
    company_name: str,
    registry_label: str,
    ai_label: str,
    semantic_distance: float,
) -> str:
    """
    Ask GPT-4o-mini to explain why a discrepancy exists and what it might mean.
    """
    prompt = f"""A company called "{company_name}" has the following classification discrepancy:

Registry Filing:   {registry_label}
AI/Web Analysis:   {ai_label}
Semantic Distance: {semantic_distance:.2f} (scale 0=identical, 1=completely different)

In 2-3 sentences, explain:
1. What the discrepancy most likely means.
2. Whether this is a compliance concern (AML/shell company risk).
3. What manual review action is recommended.

Be concise and professional."""

    try:
        response = _client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning(f"Discrepancy explanation failed: {exc}")
        return (
            f"Registry label ({registry_label!r}) differs from AI-inferred label "
            f"({ai_label!r}) with a semantic distance of {semantic_distance:.2f}. "
            f"Manual review is recommended."
        )


# ── Simple NAICS-only classify (backwards-compat for legacy files) ────────────

def classify_naics_only(
    company_name: str,
    address: str,
    country: str,
    candidates: list[dict],
    web_summary: str = "",
) -> dict:
    """
    Simplified single-taxonomy NAICS classifier (used by legacy Streamlit pages).
    Returns {"naics_code", "description", "confidence", "reasoning"}.
    """
    candidates_str = json.dumps(candidates[:20], indent=2)
    prompt = f"""You are an expert NAICS 2022 industry classification analyst.

Company: {company_name}
Address: {address}
Country: {country}
Web Summary: {web_summary[:1000] if web_summary else "N/A"}

Candidate NAICS Codes:
{candidates_str}

Select the MOST appropriate NAICS 2022 code from the candidates.

Return valid JSON only:
{{
  "naics_code": "XXXXXX",
  "description": "NAICS description",
  "confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "brief explanation"
}}"""

    for attempt in range(3):
        try:
            response = _client.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=300,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            return json.loads(raw)
        except Exception as exc:
            logger.warning(f"classify_naics_only attempt {attempt+1}: {exc}")
            if attempt < 2:
                time.sleep(1.5 ** attempt)

    return {
        "naics_code": None,
        "description": None,
        "confidence": "LOW",
        "reasoning": "Classification failed after retries.",
    }
