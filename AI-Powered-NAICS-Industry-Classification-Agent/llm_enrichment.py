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
    # Extended fields from improved prompt
    source_used: str = ""              # registry | vendor_consensus | semantic_search | web_inference
    mcc_risk_note: Optional[str] = None
    registry_conflict: bool = False
    registry_conflict_note: Optional[str] = None


def _build_vendor_signals_block(vendor_signals: Optional[list] = None) -> str:
    """
    Format vendor source signals for LLM prompt injection.
    vendor_signals: list of dicts with keys source, raw_code, taxonomy, label, weight, status, confidence
    """
    if not vendor_signals:
        return ""

    lines = ["VENDOR SOURCE SIGNALS (what our internal databases returned):"]
    agree_codes: dict[str, int] = {}

    for sig in vendor_signals:
        source      = sig.get("source", "unknown")
        code        = sig.get("raw_code", "")
        taxonomy    = sig.get("taxonomy", "")
        label       = sig.get("label", "")
        weight      = sig.get("weight", 0)
        status      = sig.get("status", "")
        confidence  = sig.get("confidence", 0)

        if not code:
            continue

        status_note = ""
        if status == "MATCHED":
            status_note = f"✅ MATCHED ({confidence:.0%} entity match confidence)"
        elif status == "CONFLICT":
            status_note = f"⚠️  CONFLICT ({confidence:.0%})"
        elif status == "POLLUTED":
            status_note = f"🔴 POLLUTED — data quality issue, down-weighted"
        elif status == "SIMULATED":
            status_note = f"🟡 SIMULATED — Redshift not connected"
        else:
            status_note = f"🔵 {status} ({confidence:.0%})"

        tax_short = taxonomy.replace("_", " ") if taxonomy else ""
        lines.append(
            f"  • {source:<16} weight={weight:.2f}  {status_note}"
            f"\n    → {code} ({tax_short}): {label}"
        )

        if status in ("MATCHED", "SIMULATED") and code:
            agree_codes[code] = agree_codes.get(code, 0) + 1

    # Agreement summary
    if agree_codes:
        max_count = max(agree_codes.values())
        top_code  = max(agree_codes, key=lambda k: agree_codes[k])
        n_sources = len([s for s in vendor_signals if s.get("raw_code") and s.get("status") not in ("POLLUTED",)])
        if n_sources > 0:
            lines.append(
                f"\n  Source agreement: {max_count}/{n_sources} sources agree on"
                f" code {top_code}"
                + (" (strong consensus — confirm this code unless registry data contradicts)" if max_count >= 3
                   else " (moderate agreement — cross-check with registry data)")
            )

    return "\n".join(lines)


def llm_classify(
    company_name: str,
    business_description: str,
    jurisdiction: str,
    candidates_by_taxonomy: dict,
    web_summary: str = "",
    vendor_signals: Optional[list] = None,
    external_registry=None,          # ExternalRegistryData from external_lookup.py
    entity_type: str = "Operating",
    entity_profile: Optional[dict] = None,
) -> LLMClassificationResult:
    """
    GPT-4o-mini classifies the company across all taxonomies.

    Improved prompt strategy — the LLM acts as a REFEREE, not a blind classifier:
      1. External registry data (SEC EDGAR / Companies House) — ground truth
      2. Vendor source signals — what our 4 Redshift databases say
      3. UGO FAISS semantic candidates — semantic similarity baseline
      4. Web summary — general business description
      5. Entity type + jurisdiction metadata — routing context

    The LLM is asked to:
      - Confirm codes where sources agree (save reasoning effort)
      - Adjudicate conflicts where sources disagree (the real value-add)
      - Flag discrepancies between registry filings and web presence
      - Select best code per taxonomy from the UGO candidates
    """
    # ── Build prompt sections ─────────────────────────────────────────────────
    import jurisdiction_registry as JR
    jr_rec = JR.lookup(jurisdiction.lower().strip())
    jur_label  = jr_rec.label if jr_rec else jurisdiction
    jur_bucket = jr_rec.region_bucket if jr_rec else "OTHER"
    pref_tax   = jr_rec.preferred_taxonomy if jr_rec else "US_NAICS_2022"
    is_naics_j = jr_rec.is_naics_jurisdiction if jr_rec else True

    # Taxonomy routing instruction
    if pref_tax == "UK_SIC_2007":
        primary_tax_instruction = (
            f"PRIMARY TAXONOMY for this jurisdiction: UK_SIC_2007 (UK Standard Industrial Classification 2007).\n"
            f"This is the official Companies House / ONS taxonomy. Always select a UK SIC code as primary."
        )
    elif pref_tax == "NACE_REV2":
        primary_tax_instruction = (
            f"PRIMARY TAXONOMY for this jurisdiction: NACE_REV2 (EU Statistical Classification).\n"
            f"Select NACE Rev.2 as primary. Also provide US_NAICS_2022 as secondary for US comparability."
        )
    elif pref_tax == "ISIC_REV4":
        primary_tax_instruction = (
            f"PRIMARY TAXONOMY for this jurisdiction: ISIC_REV4 (UN International Standard).\n"
            f"Select ISIC Rev.4 as primary. Also provide MCC for payment compliance."
        )
    else:
        primary_tax_instruction = (
            f"PRIMARY TAXONOMY for this jurisdiction: US_NAICS_2022 (North American Industry Classification 2022).\n"
            f"Select a 6-digit NAICS 2022 code as primary. Also provide MCC for payment compliance."
        )

    # Registry block
    registry_block = ""
    if external_registry and external_registry.found_anything:
        registry_block = external_registry.to_prompt_block()

    # Vendor signals block
    signals_block = _build_vendor_signals_block(vendor_signals)

    # UGO candidates
    candidates_json = json.dumps(candidates_by_taxonomy, indent=2)

    # ── Compose the full prompt ────────────────────────────────────────────────
    prompt = f"""You are a world-class global industry classification expert and KYB analyst.
Your task is to classify the following company across multiple taxonomy systems.

═══════════════════════════════════════════════════════════════════
COMPANY INFORMATION
═══════════════════════════════════════════════════════════════════
Company Name:    {company_name}
Jurisdiction:    {jurisdiction} — {jur_label} (region: {jur_bucket})
Entity Type:     {entity_type}
Business Description: {business_description or "Not available"}
Web Summary:     {(web_summary[:800] + "...") if web_summary and len(web_summary) > 800 else (web_summary or "Not available")}

═══════════════════════════════════════════════════════════════════
TAXONOMY ROUTING INSTRUCTION
═══════════════════════════════════════════════════════════════════
{primary_tax_instruction}

═══════════════════════════════════════════════════════════════════
{registry_block if registry_block else "AUTHORITATIVE REGISTRY DATA: Not available for this jurisdiction or company."}
═══════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════
{signals_block if signals_block else "VENDOR SOURCE SIGNALS: Not available (Redshift not connected — using simulation)."}
═══════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════
UGO SEMANTIC SEARCH CANDIDATES (top candidates by cosine similarity)
═══════════════════════════════════════════════════════════════════
{candidates_json[:3000]}

═══════════════════════════════════════════════════════════════════
YOUR CLASSIFICATION TASK
═══════════════════════════════════════════════════════════════════
Using ALL the evidence above, classify this company. Follow this reasoning order:

STEP 1 — Registry data first
  If authoritative registry data (SEC EDGAR / Companies House) is available,
  it is the ground truth. The company self-reported this code to the government.
  Start here. Do not override it without strong evidence from web/business description.

STEP 2 — Vendor signal consensus
  If 3+ vendor sources agree on a code, confirm it.
  If sources conflict, adjudicate: which source is most authoritative for this
  jurisdiction? (opencorporates weight 0.90 > zoominfo 0.80 > liberty_data 0.78
  > equifax 0.70 for non-US jurisdictions)

STEP 3 — Resolve discrepancies
  If registry/vendor codes conflict with the web business description,
  note this in your reasoning. A Holding company registered code but an
  Operating company web presence is a significant signal.

STEP 4 — Select from UGO candidates
  From the semantic candidates above, select the best code per taxonomy.
  Prefer candidates that match the registry/vendor evidence.

STEP 5 — Select MCC
  Choose the most appropriate 4-digit Merchant Category Code.
  Note if the MCC is in a high-risk category (financial services, electronics
  wholesale, dual-use goods).

Return ONLY this JSON object:
{{
  "primary_taxonomy": "e.g. US_NAICS_2022",
  "primary_code": "e.g. 722511",
  "primary_label": "Full-Service Restaurants",
  "primary_confidence": "HIGH | MEDIUM | LOW",
  "reasoning": "2-3 sentences explaining which evidence was used and why",
  "source_used": "registry | vendor_consensus | semantic_search | web_inference",
  "mcc_code": "e.g. 5812 or null",
  "mcc_label": "e.g. Eating Places Restaurants or null",
  "mcc_risk_note": "normal | high_risk (brief reason if high) or null",
  "registry_conflict": true or false,
  "registry_conflict_note": "explain conflict if true, else null",
  "alternative_codes": [
    {{"taxonomy": "UK_SIC_2007", "code": "56101", "label": "Licensed restaurants"}},
    {{"taxonomy": "NACE_REV2", "code": "I56", "label": "Food and beverage service activities"}}
  ]
}}"""

    for attempt in range(3):
        try:
            response = _client.chat.completions.create(
                model=OPENAI_CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
                max_tokens=800,
                response_format={"type": "json_object"},
            )
            raw  = response.choices[0].message.content.strip()
            data = json.loads(raw)
            return LLMClassificationResult(
                primary_taxonomy=data.get("primary_taxonomy", pref_tax),
                primary_code=data.get("primary_code", ""),
                primary_label=data.get("primary_label", ""),
                primary_confidence=data.get("primary_confidence", "LOW"),
                reasoning=data.get("reasoning", ""),
                alternative_codes=data.get("alternative_codes", []),
                mcc_code=data.get("mcc_code"),
                mcc_label=data.get("mcc_label"),
                # Extended fields
                source_used=data.get("source_used", ""),
                mcc_risk_note=data.get("mcc_risk_note"),
                registry_conflict=bool(data.get("registry_conflict", False)),
                registry_conflict_note=data.get("registry_conflict_note"),
            )
        except Exception as exc:
            logger.warning(f"LLM classify attempt {attempt+1} failed: {exc}")
            if attempt < 2:
                time.sleep(1.5 ** attempt)

    return LLMClassificationResult(
        primary_taxonomy=pref_tax,
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
