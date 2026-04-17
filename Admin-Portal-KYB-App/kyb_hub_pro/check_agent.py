"""
check_agent.py — The AI Check-Agent for KYB Hub Pro.
Performs deep anomaly detection, cross-field consistency checks,
and external data cross-referencing using OpenAI GPT.
"""

import os
import json
import streamlit as st
from openai import OpenAI

# ── OpenAI client ────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv(
    "OPENAI_API_KEY",
    "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"
)


def get_openai_client():
    """Get the OpenAI client."""
    return OpenAI(api_key=OPENAI_API_KEY)


# ── Cross-field consistency checks (deterministic, no LLM needed) ────────────

DETERMINISTIC_CHECKS = [
    {
        "id": "tin_bool_status",
        "name": "TIN Boolean / Status Inconsistency",
        "severity": "CRITICAL",
        "check": lambda f: (
            _fv(f, "tin_match_boolean") == "true" and
            _safe_get_status(f, "tin_match") not in ("success", "")
        ),
        "description": "tin_match_boolean=true BUT tin_match.status is not 'success'. Data integrity bug.",
        "action": "File bug report for integration-service. Check lib/facts/kyb/tin_match_boolean.ts.",
    },
    {
        "id": "sos_active_tin_failed",
        "name": "SOS Active + TIN Failed",
        "severity": "MEDIUM",
        "check": lambda f: _fv(f, "sos_active") == "true" and _safe_get_status(f, "tin_match") == "failure",
        "description": "Entity IS registered (SOS active) but EIN-name mismatch per IRS.",
        "action": "Request applicant's IRS EIN confirmation letter. Verify legal name matches exactly.",
    },
    {
        "id": "sos_inactive_tin_ok",
        "name": "SOS Inactive + TIN Verified",
        "severity": "HIGH",
        "check": lambda f: _fv(f, "sos_active") == "false" and _fv(f, "tin_match_boolean") == "true",
        "description": "EIN valid but entity not in good standing. Possibly dissolved or revoked.",
        "action": "Block approval until SOS standing is reinstated.",
    },
    {
        "id": "idv_passed_name_failed",
        "name": "IDV Passed + Name Match Failed",
        "severity": "MEDIUM",
        "check": lambda f: _fv(f, "idv_passed_boolean") == "true" and _fv(f, "name_match_boolean") == "false",
        "description": "Owner identity confirmed but business name doesn't match SOS registry.",
        "action": "Check if business is a sole prop operating under a DBA.",
    },
    {
        "id": "no_vendor_confirmation",
        "name": "No Vendor Confirmation",
        "severity": "HIGH",
        "check": lambda f: _gc(f, "sos_match") == 0.0 and _gc(f, "sos_match_boolean") == 0.0,
        "description": "Neither Middesk nor OpenCorporates could match this entity. Existence UNVERIFIED.",
        "action": "Manual review required. Check if entity is very new or operates under a DBA.",
    },
    {
        "id": "tax_haven_state",
        "name": "Tax Haven Formation State",
        "severity": "NOTICE",
        "check": lambda f: str(_fv(f, "formation_state") or "").upper() in ("DE", "NV", "WY", "DELAWARE", "NEVADA", "WYOMING"),
        "description": "Formation state is a tax-haven (DE/NV/WY). Entity resolution gaps likely.",
        "action": "Verify both domestic and foreign SOS filings separately.",
    },
    {
        "id": "website_no_naics",
        "name": "Website Present but No NAICS",
        "severity": "MEDIUM",
        "check": lambda f: bool(_fv(f, "website")) and _fv(f, "naics_code") in ("", "561499", None),
        "description": "Website URL exists but industry classification failed or fell back to 561499.",
        "action": "Check if AI enrichment received the website URL. Consider re-running classification.",
    },
    {
        "id": "watchlist_low_confidence",
        "name": "Watchlist Hit + Low SOS Confidence",
        "severity": "HIGH",
        "check": lambda f: _safe_int(_fv(f, "watchlist_hits")) > 0 and _gc(f, "sos_match") < 0.5,
        "description": "Watchlist hits exist AND entity identity is uncertain (low Middesk confidence).",
        "action": "Enhanced due diligence: verify entity identity before acting on watchlist hits.",
    },
    {
        "id": "adverse_media_no_watchlist",
        "name": "Adverse Media but No Watchlist",
        "severity": "NOTICE",
        "check": lambda f: _safe_int(_fv(f, "adverse_media_hits")) > 0 and _safe_int(_fv(f, "watchlist_hits")) == 0,
        "description": "Negative news exists but no formal sanctions/PEP hits.",
        "action": "Review adverse media detail. Reputational risk may exist.",
    },
    {
        "id": "bankruptcy_active_sos",
        "name": "Bankruptcy with Active SOS",
        "severity": "MEDIUM",
        "check": lambda f: _safe_int(_fv(f, "num_bankruptcies")) > 0 and _fv(f, "sos_active") == "true",
        "description": "Entity has bankruptcy record(s) but SOS shows active. May be post-discharge.",
        "action": "Check bankruptcy filing dates. Post-discharge entities can be active but carry risk.",
    },
    {
        "id": "no_sos_data",
        "name": "No SOS Data at All",
        "severity": "HIGH",
        "check": lambda f: _fv(f, "sos_active") in ("", None) and _fv(f, "sos_match_boolean") in ("", None),
        "description": "Entity existence completely unverified. No SOS data from any vendor.",
        "action": "Investigate if entity is too new, or if vendor integrations failed.",
    },
    {
        "id": "naics_fallback",
        "name": "NAICS Fallback Code",
        "severity": "LOW",
        "check": lambda f: _fv(f, "naics_code") == "561499",
        "description": "Industry classified as 561499 (fallback). All vendors failed to classify.",
        "action": "AI last resort was used. Consider manual industry classification.",
    },
    {
        "id": "high_revenue_low_employees",
        "name": "High Revenue but Very Low Employee Count",
        "severity": "MEDIUM",
        "check": lambda f: (
            _safe_float(_fv(f, "revenue")) > 5000000 and
            0 < _safe_int(_fv(f, "num_employees") or "0") <= 3
        ),
        "description": "Revenue > $5M but employee count <= 3. Possible shell entity or data mismatch.",
        "action": "Cross-reference revenue source (ZoomInfo vs Equifax). Verify business operations.",
    },
    {
        "id": "formation_state_mismatch",
        "name": "Formation State vs Operating State Mismatch",
        "severity": "MEDIUM",
        "check": lambda f: (
            bool(_fv(f, "formation_state")) and
            bool(_get_operating_state(f)) and
            str(_fv(f, "formation_state") or "").upper() != str(_get_operating_state(f) or "").upper()
        ),
        "description": "Entity formed in one state but operates in another. Potential entity resolution gap.",
        "action": "Verify both domestic (formation) and foreign (operating) SOS filings.",
    },
]


def _fv(facts, name):
    """Get fact value as string."""
    f = facts.get(name, {})
    if f.get("_too_large"):
        return ""
    v = f.get("value")
    if isinstance(v, (list, dict)):
        return ""
    return str(v) if v is not None else ""


def _gc(facts, name):
    """Get fact confidence."""
    try:
        src = facts.get(name, {}).get("source", {})
        if not isinstance(src, dict):
            return 0.0
        c = src.get("confidence")
        return float(c) if c is not None else 0.0
    except:
        return 0.0


def _safe_get_status(facts, name):
    """Get status from a fact's value object."""
    v = facts.get(name, {}).get("value", {})
    if isinstance(v, dict):
        return str(v.get("status", "")).lower()
    return ""


def _safe_int(v):
    try:
        return int(float(v or 0))
    except:
        return 0


def _safe_float(v):
    try:
        return float(v or 0)
    except:
        return 0.0


def _get_operating_state(facts):
    """Try to extract operating state from primary_address."""
    addr = facts.get("primary_address", {}).get("value", {})
    if isinstance(addr, dict):
        return addr.get("state", "")
    return ""


def run_deterministic_checks(facts: dict):
    """Run all deterministic cross-field checks. Returns list of triggered checks."""
    results = []
    for check in DETERMINISTIC_CHECKS:
        try:
            if check["check"](facts):
                results.append({
                    "id": check["id"],
                    "name": check["name"],
                    "severity": check["severity"],
                    "description": check["description"],
                    "action": check["action"],
                })
        except Exception:
            pass
    return results


# ── LLM-powered deep audit ──────────────────────────────────────────────────

AUDIT_SYSTEM_PROMPT = """You are a senior KYB (Know Your Business) compliance analyst and data quality auditor.
You are given the complete fact profile of a business entity from a KYB onboarding platform.

Your job is to:
1. VERIFY data consistency across all facts (cross-field validation)
2. IDENTIFY red flags that indicate potential fraud, shell entities, or compliance risk
3. DETECT anomalies in the data (unusual patterns, missing critical fields, contradictions)
4. RECOMMEND specific actions for the underwriting team
5. When relevant, suggest EXTERNAL VERIFICATION steps (e.g., "check SEC EDGAR for this entity", "verify this address on Google Maps")

IMPORTANT RULES:
- Be specific. Reference exact fact names and values.
- Severity levels: CRITICAL (block approval), HIGH (requires manual review), MEDIUM (investigate), LOW (informational), CLEAN (no issue).
- For each finding, explain WHY it matters for KYB compliance.
- Consider the relationships between facts (e.g., formation_state vs operating address, revenue vs employees, SOS status vs TIN status).
- Consider industry-specific risks (e.g., MSBs, cannabis, crypto require enhanced due diligence).

OUTPUT FORMAT (strict JSON):
{
  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW|CLEAN",
  "summary": "One-paragraph executive summary",
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|CLEAN",
      "title": "Short title",
      "description": "Detailed explanation",
      "facts_involved": ["fact_name_1", "fact_name_2"],
      "recommended_action": "What the underwriter should do",
      "external_verification": "Optional: external source to check"
    }
  ],
  "recommended_next_steps": ["Step 1", "Step 2", "Step 3"],
  "data_quality_score": 0-100
}"""


def build_fact_summary(facts: dict):
    """Build a concise fact summary for the LLM."""
    summary = {}
    for name, f in facts.items():
        if name.startswith("_"):
            continue
        if f.get("_too_large"):
            summary[name] = {"value": "[LARGE_OBJECT]", "source": "see_rds"}
            continue
        v = f.get("value")
        src = f.get("source", {})
        pid = src.get("platformId") if isinstance(src, dict) else None
        conf = src.get("confidence") if isinstance(src, dict) else None
        rule = f.get("ruleApplied", {})
        rule_name = rule.get("name") if isinstance(rule, dict) else str(rule) if rule else None
        alts_count = len(f.get("alternatives", []) or [])

        summary[name] = {
            "value": v if not isinstance(v, (list, dict)) else f"[{type(v).__name__}:{len(v)}items]",
            "source_vendor": pid,
            "confidence": conf,
            "rule": rule_name,
            "alternatives": alts_count,
        }
    return summary


def run_llm_audit(facts: dict, business_id: str, score_info: dict = None):
    """Run the full LLM-powered audit on a business."""
    client = get_openai_client()

    fact_summary = build_fact_summary(facts)

    user_prompt = f"""Analyze this business entity for KYB compliance risks and data quality issues.

Business ID: {business_id}

FACT PROFILE:
{json.dumps(fact_summary, indent=2, default=str)}

"""
    if score_info:
        user_prompt += f"""
WORTH SCORE INFO:
{json.dumps(score_info, indent=2, default=str)}
"""

    user_prompt += """
Perform a thorough audit. Check for:
1. Cross-field inconsistencies (e.g., SOS active but TIN failed)
2. Missing critical data (SOS, TIN, IDV, NAICS)
3. High-risk indicators (watchlist hits, bankruptcies, tax-haven states)
4. Data quality issues (null fields, fallback codes, low confidence scores)
5. Entity resolution concerns (formation state vs operating state)
6. Revenue/employee anomalies
7. Industry-specific risks based on NAICS code

Return your analysis as the specified JSON format."""

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": AUDIT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        result_text = response.choices[0].message.content
        return json.loads(result_text), None
    except Exception as e:
        return None, str(e)


# ── AI Chat Agent ────────────────────────────────────────────────────────────

CHAT_SYSTEM_PROMPT = """You are a KYB Intelligence Agent embedded in the KYB Hub Pro dashboard.
You have deep knowledge of:
- The Worth AI KYB platform architecture
- Fact Engine rules (factWithHighestConfidence, combineFacts, dependent facts)
- Vendor integrations (Middesk pid=16, OpenCorporates pid=23, ZoomInfo pid=24, Equifax pid=17, Trulioo pid=38, AI pid=31)
- Worth Score model (3-model ensemble: firmographic XGBoost + financial neural net + economic model)
- Redshift data model (rds_warehouse_public.facts, rds_manual_score_public.business_scores)
- KYB compliance requirements (SOS verification, TIN matching, IDV, watchlist screening)

When answering questions:
- Be specific and reference exact table names, fact names, and vendor IDs
- Provide SQL queries when relevant
- Explain the "why" behind data patterns
- If you don't know something, say so clearly

You are currently looking at a specific business. The user may ask about its facts, score, or compliance status."""


def chat_with_agent(messages: list, facts_context: str = ""):
    """Send a chat message to the AI agent."""
    client = get_openai_client()

    system_msg = CHAT_SYSTEM_PROMPT
    if facts_context:
        system_msg += f"\n\nCURRENT BUSINESS CONTEXT:\n{facts_context}"

    full_messages = [{"role": "system", "content": system_msg}] + messages

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=full_messages,
            temperature=0.3,
            max_tokens=2000,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        return None, str(e)


# ── External data cross-reference (web search via LLM) ──────────────────────

EXTERNAL_CHECK_PROMPT = """You are a KYB compliance investigator. Given the following business information,
perform an external verification analysis. Consider what you would find if you searched:
1. SEC EDGAR for corporate filings
2. State Secretary of State websites
3. Google Maps for the business address
4. BBB (Better Business Bureau) for complaints
5. News articles about the company
6. LinkedIn for employee verification

Based on the business profile provided, identify:
- What external sources SHOULD be checked
- What red flags would you look for
- What discrepancies might exist between internal data and public records
- Specific URLs or databases to query

Return a structured analysis with specific, actionable recommendations."""


def run_external_check(facts: dict, business_id: str):
    """Run external data cross-reference analysis."""
    client = get_openai_client()

    # Build business profile
    profile = {
        "business_id": business_id,
        "legal_name": _fv(facts, "legal_name"),
        "dba": _fv(facts, "dba_found") or _fv(facts, "dba"),
        "formation_state": _fv(facts, "formation_state"),
        "formation_date": _fv(facts, "formation_date"),
        "naics_code": _fv(facts, "naics_code"),
        "website": _fv(facts, "website"),
        "sos_active": _fv(facts, "sos_active"),
        "tin_match": _fv(facts, "tin_match_boolean"),
        "watchlist_hits": _fv(facts, "watchlist_hits"),
        "num_bankruptcies": _fv(facts, "num_bankruptcies"),
        "revenue": _fv(facts, "revenue"),
        "num_employees": _fv(facts, "num_employees"),
    }

    # Get operating address
    addr = facts.get("primary_address", {}).get("value", {})
    if isinstance(addr, dict):
        profile["address"] = {
            "line1": addr.get("line_1", ""),
            "city": addr.get("city", ""),
            "state": addr.get("state", ""),
            "zip": addr.get("postal_code", ""),
        }

    try:
        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": EXTERNAL_CHECK_PROMPT},
                {"role": "user", "content": f"Business Profile:\n{json.dumps(profile, indent=2, default=str)}\n\nPerform external verification analysis."}
            ],
            temperature=0.3,
            max_tokens=3000,
        )
        return response.choices[0].message.content, None
    except Exception as e:
        return None, str(e)
