"""
check_agent_v2.py — KYB Check-Agent for kyb_hub_app_v2.py
==========================================================
Two layers of analysis:
  1. Deterministic cross-field checks   — instant, rule-based, 28 checks
  2. LLM Deep Audit (GPT-4o-mini)       — structured JSON compliance report

No hardcoded API keys. All secrets via st.secrets / env vars.
"""

import os, json, hashlib
import streamlit as st
from openai import OpenAI

# ── API key — same resolution order as kyb_hub_app_v2.get_openai() ────────────
def _get_api_key() -> str:
    """Read the OpenAI key fresh on every call — env var takes priority."""
    # 1. Environment variable (set with: export OPENAI_API_KEY=sk-...)
    key = os.getenv("OPENAI_API_KEY","").strip()
    # 2. secrets.toml
    if not key:
        try:
            key = str(st.secrets.get("OPENAI_API_KEY","") or "").strip()
        except Exception:
            pass
    return key


def get_openai_client():
    key = _get_api_key()
    if not key or not key.startswith("sk-"):
        return None
    return OpenAI(api_key=key)


# ── Fact accessor helpers (compatible with kyb_hub_app.py facts dict) ─────────

def _fv(facts: dict, name: str) -> str:
    """Return fact value as plain string (empty string if missing / too-large / complex)."""
    f = facts.get(name, {})
    if f.get("_too_large"):
        return ""
    v = f.get("value")
    if isinstance(v, (list, dict)):
        return ""
    return str(v).strip() if v is not None else ""


def _fv_lower(facts: dict, name: str) -> str:
    return _fv(facts, name).lower()


def _gc(facts: dict, name: str) -> float:
    """Return source confidence as float."""
    try:
        src = facts.get(name, {}).get("source", {})
        if not isinstance(src, dict):
            return 0.0
        c = src.get("confidence")
        return float(c) if c is not None else 0.0
    except Exception:
        return 0.0


def _gp(facts: dict, name: str) -> str:
    """Return platformId as string."""
    src = facts.get(name, {}).get("source", {})
    if not isinstance(src, dict):
        return ""
    pid = src.get("platformId")
    return "" if pid is None else str(pid)


def _safe_int(v) -> int:
    try:
        return int(float(v or 0))
    except Exception:
        return 0


def _safe_float(v) -> float:
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def _get_status(facts: dict, name: str) -> str:
    """Extract .value.status from a structured fact (e.g. tin_match)."""
    v = facts.get(name, {}).get("value", {})
    if isinstance(v, dict):
        return str(v.get("status", "")).lower()
    return ""


def _get_operating_state(facts: dict) -> str:
    addr = facts.get("primary_address", {}).get("value", {})
    if isinstance(addr, dict):
        return str(addr.get("state", "")).upper().strip()
    return ""


def _get_address_field(facts: dict, field: str) -> str:
    addr = facts.get("primary_address", {}).get("value", {})
    if isinstance(addr, dict):
        return str(addr.get(field, "")).strip()
    return ""


# ── Severity colours ──────────────────────────────────────────────────────────
SEV_COLOR = {
    "CRITICAL": "#ef4444",
    "HIGH":     "#f97316",
    "MEDIUM":   "#f59e0b",
    "LOW":      "#22c55e",
    "NOTICE":   "#3B82F6",
}
SEV_ICON = {
    "CRITICAL": "🔴",
    "HIGH":     "🟠",
    "MEDIUM":   "🟡",
    "LOW":      "🟢",
    "NOTICE":   "🔵",
}


# ══════════════════════════════════════════════════════════════════════════════
#  DETERMINISTIC CHECKS  —  28 rules, zero LLM calls
# ══════════════════════════════════════════════════════════════════════════════

TAX_HAVENS = {"DE", "NV", "WY", "SD", "MT", "NM",
              "DELAWARE", "NEVADA", "WYOMING", "SOUTH DAKOTA", "MONTANA", "NEW MEXICO"}

HIGH_RISK_NAICS = {
    "522390": "Other Activities Related to Credit Intermediation (includes crypto)",
    "523130": "Commodity Contracts Dealing",
    "523210": "Securities & Commodity Exchanges",
    "522110": "Commercial Banking",
    "522120": "Savings Institutions",
    "522130": "Credit Unions",
    "721110": "Hotels & Motels (AML risk)",
    "713210": "Casinos (except Casino Hotels)",
    "713290": "Other Gambling Industries",
    "453991": "Tobacco Stores",
    "446110": "Pharmacies",
    "238910": "Site Preparation Contractors (cash-intensive)",
    "561499": "All Other Business Support Services (FALLBACK)",
}

REGISTERED_AGENT_ADDRESSES = {
    "corporation trust center", "the corporation trust company",
    "corporation service company", "c t corporation", "national registered agents",
    "registered agents inc", "northwest registered agent", "paracorp",
    "incorp services", "harvard business services",
}


DETERMINISTIC_CHECKS = [

    # ── GROUP 1: DATA INTEGRITY ───────────────────────────────────────────────
    {
        "id": "tin_bool_status_mismatch",
        "group": "Data Integrity",
        "name": "TIN Boolean / Status Inconsistency",
        "severity": "CRITICAL",
        "check": lambda f: (
            _fv_lower(f, "tin_match_boolean") == "true" and
            _get_status(f, "tin_match") not in ("success", "")
        ),
        "description": "tin_match_boolean=true BUT tin_match.status is not 'success'. "
                       "This is a backend data integrity bug — the dependent fact derived its value incorrectly.",
        "action": "File a bug report against integration-service lib/facts/kyb/index.ts. "
                  "The tinMatchBoolean derivation condition (status==='success') may have changed.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS bool_val, "
               "JSON_EXTRACT_PATH_TEXT(value,'value','status') AS status "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('tin_match_boolean','tin_match');",
        "facts": ["tin_match_boolean", "tin_match"],
    },
    {
        "id": "sos_active_match_contradiction",
        "group": "Data Integrity",
        "name": "SOS Active=True but SOS Match=False Contradiction",
        "severity": "HIGH",
        "check": lambda f: (
            _fv_lower(f, "sos_active") == "true" and
            _fv_lower(f, "sos_match_boolean") == "false"
        ),
        "description": "sos_active=true (derived from sos_filings[].active) but sos_match_boolean=false "
                       "(Middesk could not match the entity). This is a logical contradiction — "
                       "how can the entity have active filings if it was never matched?",
        "action": "Inspect sos_filings directly (requires PostgreSQL RDS port 5432 — too large for Redshift). "
                  "Verify if the 'active' field came from a stale cached filing.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_active, "
               "JSON_EXTRACT_PATH_TEXT(value,'value') AS sos_match "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_active','sos_match_boolean');",
        "facts": ["sos_active", "sos_match_boolean"],
    },
    {
        "id": "kyb_complete_no_idv",
        "group": "Data Integrity",
        "name": "KYB Complete=True but IDV Not Passed",
        "severity": "HIGH",
        "check": lambda f: (
            _fv_lower(f, "kyb_complete") == "true" and
            _fv_lower(f, "idv_passed_boolean") != "true"
        ),
        "description": "kyb_complete=true requires BOTH business_verified=true AND screened_people non-empty. "
                       "IDV not passed suggests screened_people may be empty or IDV was waived. "
                       "This can indicate an incomplete verification workflow.",
        "action": "Verify screened_people fact and whether Trulioo PSC flow completed. "
                  "Check if the IDV step was intentionally skipped (sole prop exemption).",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('kyb_complete','idv_passed_boolean','kyb_submitted');",
        "facts": ["kyb_complete", "idv_passed_boolean"],
    },
    {
        "id": "name_match_false_sos_active",
        "group": "Data Integrity",
        "name": "Name Match Failed but SOS Active",
        "severity": "MEDIUM",
        "check": lambda f: (
            _fv_lower(f, "name_match_boolean") == "false" and
            _fv_lower(f, "sos_active") == "true"
        ),
        "description": "The business name submitted on onboarding does NOT match the SOS registry name, "
                       "yet the SOS filing is marked active. This is the classic DBA vs. legal name mismatch.",
        "action": "Check if business operates under a DBA. Request IRS EIN certificate to confirm "
                  "the legal name used for TIN matching. Verify if dba_found fact includes the submitted name.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('name_match_boolean','sos_active','legal_name','names_found');",
        "facts": ["name_match_boolean", "sos_active", "legal_name"],
    },

    # ── GROUP 2: IDENTITY & COMPLIANCE ───────────────────────────────────────
    {
        "id": "sos_active_tin_failed",
        "group": "Identity & Compliance",
        "name": "SOS Active + TIN Failed",
        "severity": "MEDIUM",
        "check": lambda f: (
            _fv_lower(f, "sos_active") == "true" and
            _get_status(f, "tin_match") == "failure"
        ),
        "description": "Entity IS legally registered (SOS active) but the EIN-to-name IRS check failed. "
                       "Most common cause: applicant submitted trade name instead of the legal name "
                       "on the EIN certificate. Not necessarily fraud.",
        "action": "Request applicant's IRS EIN confirmation letter (CP-575 or 147C). "
                  "Compare the legal name on the EIN certificate to the legal_name fact.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value','status') AS tin_status, "
               "JSON_EXTRACT_PATH_TEXT(value,'value','message') AS tin_message "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='tin_match';",
        "facts": ["sos_active", "tin_match", "legal_name"],
    },
    {
        "id": "sos_inactive_tin_ok",
        "group": "Identity & Compliance",
        "name": "SOS Inactive + TIN Verified",
        "severity": "HIGH",
        "check": lambda f: (
            _fv_lower(f, "sos_active") == "false" and
            _fv_lower(f, "tin_match_boolean") == "true"
        ),
        "description": "EIN is valid and confirmed by IRS but entity is NOT in good standing per SOS. "
                       "Entity may be dissolved, administratively revoked (missed annual report), "
                       "or voluntarily wound down.",
        "action": "Block approval until SOS good standing is reinstated. "
                  "Check if entity has filed a revival/reinstatement with the state.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS val "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_active','tin_match_boolean','formation_state');",
        "facts": ["sos_active", "tin_match_boolean"],
    },
    {
        "id": "no_sos_data",
        "group": "Identity & Compliance",
        "name": "No SOS Data — Entity Existence Unverified",
        "severity": "HIGH",
        "check": lambda f: (
            _fv(f, "sos_active") == "" and
            _fv(f, "sos_match_boolean") == ""
        ),
        "description": "Neither sos_active nor sos_match_boolean has any value. "
                       "Entity existence is completely unverified — Middesk and OpenCorporates both returned no match.",
        "action": "Investigate if entity is <2 weeks old (not yet in SOS database), "
                  "using a DBA name that doesn't appear in registry, or if vendor integrations failed.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_active','sos_match_boolean','sos_match','middesk_confidence');",
        "facts": ["sos_active", "sos_match_boolean"],
    },
    {
        "id": "idv_passed_name_failed",
        "group": "Identity & Compliance",
        "name": "IDV Passed but Business Name Doesn't Match SOS",
        "severity": "MEDIUM",
        "check": lambda f: (
            _fv_lower(f, "idv_passed_boolean") == "true" and
            _fv_lower(f, "name_match_boolean") == "false"
        ),
        "description": "Owner identity confirmed via Plaid biometrics (government ID + selfie + liveness) "
                       "but the business name submitted does NOT match the SOS registry. "
                       "Owner is real but entity name inconsistency remains.",
        "action": "Check if business operates under a DBA. Verify dba_found fact. "
                  "The entity may be a sole proprietorship operating under a trade name.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val "
               "FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('idv_passed_boolean','name_match_boolean','legal_name');",
        "facts": ["idv_passed_boolean", "name_match_boolean"],
    },
    {
        "id": "watchlist_low_sos_confidence",
        "group": "Identity & Compliance",
        "name": "Watchlist Hit + Low Entity Confidence",
        "severity": "HIGH",
        "check": lambda f: (
            _safe_int(_fv(f, "watchlist_hits")) > 0 and
            _gc(f, "sos_match") < 0.5
        ),
        "description": "Watchlist hit(s) exist AND Middesk entity confidence is low (<0.5). "
                       "Acting on the watchlist hit when entity identity is uncertain risks "
                       "misattributing the hit to the wrong business.",
        "action": "Enhanced due diligence: first verify entity identity (request formation documents, "
                  "EIN letter) before acting on watchlist hit. Do not decline solely on unverified hits.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS watchlist_hits FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='watchlist_hits';",
        "facts": ["watchlist_hits", "sos_match", "middesk_confidence"],
    },
    {
        "id": "high_risk_people",
        "group": "Identity & Compliance",
        "name": "High-Risk People Identified",
        "severity": "HIGH",
        "check": lambda f: _safe_int(_fv(f, "high_risk_people")) > 0,
        "description": "high_risk_people > 0 means one or more individuals associated with this business "
                       "triggered a PEP, sanctions, or adverse media flag during Trulioo PSC screening. "
                       "This is a person-level risk — distinct from the entity watchlist.",
        "action": "Pull the screened_people fact directly from PostgreSQL RDS (too large for Redshift). "
                  "Review each person's watchlistHits array. Escalate to compliance team.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS high_risk_count FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='high_risk_people';",
        "facts": ["high_risk_people", "screened_people"],
    },

    # ── GROUP 3: ENTITY RESOLUTION ────────────────────────────────────────────
    {
        "id": "tax_haven_state",
        "group": "Entity Resolution",
        "name": "Tax-Haven Formation State",
        "severity": "NOTICE",
        "check": lambda f: str(_fv(f, "formation_state") or "").upper() in TAX_HAVENS,
        "description": "Formation state is a corporate tax-haven (DE/NV/WY/SD/MT/NM). "
                       "These states have high entity resolution gap risk: Middesk's address-based SOS search "
                       "finds the FOREIGN qualification filing (operating state), missing the DOMESTIC primary filing (formation state).",
        "action": "Verify both filings: (1) the domestic formation filing in DE/NV/WY "
                  "and (2) the foreign qualification in the operating state. "
                  "Check if the entity has a foreign qualification where it actually operates.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_state FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_state';",
        "facts": ["formation_state"],
    },
    {
        "id": "formation_operating_mismatch",
        "group": "Entity Resolution",
        "name": "Formation State ≠ Operating State",
        "severity": "MEDIUM",
        "check": lambda f: (
            _fv(f, "formation_state") != "" and
            _get_operating_state(f) != "" and
            _fv(f, "formation_state").upper() != _get_operating_state(f)
        ),
        "description": "The entity is incorporated in one state but the primary operating address is in another. "
                       "This is common for DE/NV/WY formations, but increases the risk of Middesk's "
                       "address search returning the WRONG SOS record.",
        "action": "Confirm that sos_filings includes both the domestic (formation state) "
                  "AND foreign (operating state) SOS filings. If only one is present, "
                  "entity resolution may be incomplete.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('formation_state','primary_address');",
        "facts": ["formation_state", "primary_address"],
    },
    {
        "id": "registered_agent_address",
        "group": "Entity Resolution",
        "name": "Address is a Registered Agent (Not Real Business Location)",
        "severity": "MEDIUM",
        "check": lambda f: _fv_lower(f, "address_registered_agent") == "true",
        "description": "The submitted business address is identified as a Registered Agent address "
                       "(e.g., Corporation Trust Center, CSC, Northwest RA). "
                       "This means the address is a legal forwarding address, not where the business operates. "
                       "Cannot be used to verify physical presence.",
        "action": "Request an alternative business address (office, warehouse, storefront). "
                  "A RA address alone is insufficient for AML geographic risk assessment.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS is_registered_agent FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='address_registered_agent';",
        "facts": ["address_registered_agent", "primary_address"],
    },
    {
        "id": "no_vendor_confirmation",
        "group": "Entity Resolution",
        "name": "Zero Vendor Confirmation — Existence Completely Unverified",
        "severity": "HIGH",
        "check": lambda f: (
            _gc(f, "sos_match") == 0.0 and
            _fv(f, "sos_match_boolean") == "" and
            _fv(f, "sos_active") == ""
        ),
        "description": "Neither Middesk nor OpenCorporates returned a confidence score OR a match result. "
                       "The business entity's existence is completely unverified by any commercial vendor.",
        "action": "Manual review required. Check if entity is very new (<2 weeks), "
                  "operates under a DBA not in SOS, or if the vendor integration errored out for this business.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'source','confidence') AS confidence FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('sos_match','sos_match_boolean','middesk_confidence');",
        "facts": ["sos_match", "sos_match_boolean", "middesk_confidence"],
    },

    # ── GROUP 4: INDUSTRY & CLASSIFICATION ───────────────────────────────────
    {
        "id": "naics_fallback",
        "group": "Industry & Classification",
        "name": "NAICS Fallback Code (561499)",
        "severity": "LOW",
        "check": lambda f: _fv(f, "naics_code") == "561499",
        "description": "Industry classified as 561499 ('All Other Business Support Services') — the fallback code. "
                       "All commercial vendors (ZoomInfo, Equifax, OpenCorporates, Middesk, SERP, Trulioo) "
                       "failed to classify the industry, and the AI enrichment (last resort, weight=0.1) "
                       "returned the catch-all code.",
        "action": "Diagnose root cause gap: G1=no website submitted, G2=website present but AI "
                  "didn't receive it, G3=website present + AI received it but still failed. "
                  "Consider manual NAICS classification.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';",
        "facts": ["naics_code", "website"],
    },
    {
        "id": "website_no_naics",
        "group": "Industry & Classification",
        "name": "Website Present but NAICS Fallback — Gap G2 Confirmed",
        "severity": "MEDIUM",
        "check": lambda f: (
            bool(_fv(f, "website")) and
            _fv(f, "naics_code") in ("", "561499", None)
        ),
        "description": "Website URL is present in the facts table but NAICS=561499. "
                       "This is Gap G2: the AI enrichment (aiEnrichment.ts) had access to the website URL "
                       "but either did not pass it to the GPT prompt as params.website, "
                       "or web_search failed. The AI classified from name+address only → fallback.",
        "action": "Check aiEnrichment.ts to verify params.website is passed correctly. "
                  "Re-run NAICS classification with the website URL explicitly provided.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('naics_code','website');",
        "facts": ["naics_code", "website"],
    },
    {
        "id": "high_risk_naics",
        "group": "Industry & Classification",
        "name": "High-Risk Industry (Enhanced Due Diligence Required)",
        "severity": "NOTICE",
        "check": lambda f: _fv(f, "naics_code") in HIGH_RISK_NAICS and _fv(f, "naics_code") != "561499",
        "description": lambda f: (
            f"NAICS {_fv(f, 'naics_code')} — {HIGH_RISK_NAICS.get(_fv(f, 'naics_code'), 'High-Risk Industry')}. "
            "This industry category requires enhanced due diligence under BSA/AML guidelines."
        ),
        "action": "Apply Enhanced Due Diligence (EDD) protocol: additional source of funds documentation, "
                  "UBO verification, and transaction volume monitoring.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS naics FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='naics_code';",
        "facts": ["naics_code"],
    },
    {
        "id": "mcc_naics_mismatch",
        "group": "Industry & Classification",
        "name": "MCC Code Derived from Fallback NAICS",
        "severity": "LOW",
        "check": lambda f: (
            _fv(f, "naics_code") == "561499" and
            bool(_fv(f, "mcc_code"))
        ),
        "description": "MCC code is populated but was derived from NAICS=561499 (fallback). "
                       "The rel_naics_mcc lookup maps 561499 to a generic MCC, "
                       "which may not reflect the business's actual merchant category.",
        "action": "Once NAICS is corrected (manual or re-run), MCC will automatically re-derive "
                  "via the rel_naics_mcc lookup. Verify current MCC is appropriate for payments processing.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('naics_code','mcc_code');",
        "facts": ["naics_code", "mcc_code"],
    },

    # ── GROUP 5: FINANCIAL ANOMALIES ──────────────────────────────────────────
    {
        "id": "high_revenue_low_employees",
        "group": "Financial Anomalies",
        "name": "High Revenue (>$5M) but Extremely Low Employee Count (≤3)",
        "severity": "MEDIUM",
        "check": lambda f: (
            _safe_float(_fv(f, "revenue")) > 5_000_000 and
            0 < _safe_int(_fv(f, "num_employees") or "0") <= 3
        ),
        "description": "Revenue exceeds $5M but employee count is ≤3. "
                       "Possible indicators: shell entity, holding company, mismatched vendor data "
                       "(revenue from one entity matched to employees of another). "
                       "ZoomInfo (pid=24) and Equifax (pid=17) use entity matching — mismatches occur.",
        "action": "Cross-reference revenue source (ZoomInfo pid=24 vs Equifax pid=17). "
                  "Verify whether the matched entity in ZI/EFX is the same legal entity (check EIN).",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val, JSON_EXTRACT_PATH_TEXT(value,'source','platformId') AS pid FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('revenue','num_employees');",
        "facts": ["revenue", "num_employees"],
    },
    {
        "id": "no_firmographic_data",
        "group": "Financial Anomalies",
        "name": "No Firmographic Data — ZoomInfo and Equifax Both Failed to Match",
        "severity": "MEDIUM",
        "check": lambda f: (
            _fv(f, "revenue") == "" and
            _fv(f, "num_employees") == ""
        ),
        "description": "Neither ZoomInfo (pid=24) nor Equifax (pid=17) returned revenue or employee count. "
                       "This means the entity-matching XGBoost model could not link this business "
                       "to either vendor's database. Worth Score financial sub-model will use defaults.",
        "action": "Verify entity is not too new (<2 weeks), not operating under a DBA, "
                  "and that the legal name + address were correctly submitted. "
                  "Revenue=null forces the Worth Score into maximum imputation uncertainty.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('revenue','num_employees','year_established');",
        "facts": ["revenue", "num_employees"],
    },
    {
        "id": "bankruptcy_active_sos",
        "group": "Financial Anomalies",
        "name": "Bankruptcy Record with Active SOS Status",
        "severity": "MEDIUM",
        "check": lambda f: (
            _safe_int(_fv(f, "num_bankruptcies")) > 0 and
            _fv_lower(f, "sos_active") == "true"
        ),
        "description": "Entity has ≥1 bankruptcy filing but SOS shows active status. "
                       "May be post-discharge (entity survived bankruptcy). "
                       "Bankruptcy date matters — post-discharge does not equal no-risk.",
        "action": "Check bankruptcy filing dates in the bankruptcies fact (via PostgreSQL RDS). "
                  "Post-discharge entities can operate but carry elevated credit risk.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('num_bankruptcies','sos_active');",
        "facts": ["num_bankruptcies", "sos_active"],
    },
    {
        "id": "multiple_public_records",
        "group": "Financial Anomalies",
        "name": "Multiple Public Records Across Categories",
        "severity": "HIGH",
        "check": lambda f: (
            _safe_int(_fv(f, "num_bankruptcies")) > 0 and
            (_safe_int(_fv(f, "num_judgements")) > 0 or _safe_int(_fv(f, "num_liens")) > 0)
        ),
        "description": "Entity has bankruptcies AND judgements or liens simultaneously. "
                       "Multiple public record categories active at once indicates systemic financial distress, "
                       "not an isolated event.",
        "action": "Full public records review required before any credit decision. "
                  "Aggregate total exposure across all public record types.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('num_bankruptcies','num_judgements','num_liens');",
        "facts": ["num_bankruptcies", "num_judgements", "num_liens"],
    },

    # ── GROUP 6: RISK SIGNALS ─────────────────────────────────────────────────
    {
        "id": "adverse_media_no_watchlist",
        "group": "Risk Signals",
        "name": "Adverse Media Present but No Formal Watchlist Hit",
        "severity": "NOTICE",
        "check": lambda f: (
            _safe_int(_fv(f, "adverse_media_hits")) > 0 and
            _safe_int(_fv(f, "watchlist_hits")) == 0
        ),
        "description": "Negative news/media coverage exists for this entity or its principals "
                       "but no formal PEP or sanctions listing. Adverse media is intentionally "
                       "excluded from the consolidated watchlist fact (filterOutAdverseMedia in consolidatedWatchlist.ts) "
                       "because it is not a regulatory requirement — but it represents reputational risk.",
        "action": "Review adverse media content. Assess reputational risk. "
                  "Consider whether media relates to the applicant entity or a name-similar entity.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('adverse_media_hits','watchlist_hits');",
        "facts": ["adverse_media_hits", "watchlist_hits"],
    },
    {
        "id": "sole_prop_tin_verification",
        "group": "Risk Signals",
        "name": "Sole Proprietorship — TIN Verification Gap",
        "severity": "NOTICE",
        "check": lambda f: (
            _fv_lower(f, "is_sole_prop") == "true" and
            _fv_lower(f, "tin_match_boolean") != "true"
        ),
        "description": "Entity is classified as a sole proprietorship (is_sole_prop=true) "
                       "and TIN has not passed verification. Sole props can use the owner's SSN as EIN — "
                       "the Middesk TIN check may fail because it checks against business EIN, "
                       "not the personal SSN.",
        "action": "For sole props, request the owner's SSN/ITIN directly. "
                  "The IRS TIN check via Middesk is designed for employer EINs, not SSN verification.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('is_sole_prop','tin_match_boolean','tin_submitted');",
        "facts": ["is_sole_prop", "tin_match_boolean"],
    },
    {
        "id": "no_idv_not_sole_prop",
        "group": "Risk Signals",
        "name": "No IDV Completed for Non-Sole-Prop Entity",
        "severity": "HIGH",
        "check": lambda f: (
            _fv_lower(f, "idv_passed_boolean") != "true" and
            _fv_lower(f, "is_sole_prop") != "true" and
            _fv(f, "idv_passed_boolean") != ""
        ),
        "description": "IDV (Identity Verification of beneficial owner) did not pass for an entity "
                       "that is NOT a sole proprietorship. KYB requires confirming the beneficial owner's "
                       "identity via Plaid biometrics (government ID + selfie + liveness check).",
        "action": "Send IDV link to beneficial owner. Do not approve until IDV is completed. "
                  "Check if idv_passed=false (failed) or null (not triggered).",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('idv_passed_boolean','idv_passed','is_sole_prop');",
        "facts": ["idv_passed_boolean", "is_sole_prop"],
    },
    {
        "id": "no_kyb_complete_sos_ok",
        "group": "Risk Signals",
        "name": "SOS Verified but KYB Not Complete",
        "severity": "NOTICE",
        "check": lambda f: (
            _fv_lower(f, "sos_active") == "true" and
            _fv_lower(f, "tin_match_boolean") == "true" and
            _fv_lower(f, "kyb_complete") != "true"
        ),
        "description": "SOS is verified AND TIN matched, but kyb_complete is still false. "
                       "The missing step is almost always PSC (Person Screening Compliance) — "
                       "screened_people is empty, meaning the Trulioo PSC flow for the beneficial owner "
                       "has not been triggered or completed.",
        "action": "Trigger the Trulioo PSC flow for all beneficial owners. "
                  "Check if screened_people fact is empty (via PostgreSQL RDS).",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('kyb_complete','sos_active','tin_match_boolean');",
        "facts": ["kyb_complete", "sos_active", "tin_match_boolean"],
    },

    # ── GROUP 7: DATA QUALITY ─────────────────────────────────────────────────
    {
        "id": "low_middesk_confidence",
        "group": "Data Quality",
        "name": "Very Low Middesk Confidence Score (<0.20)",
        "severity": "MEDIUM",
        "check": lambda f: (
            0.0 < _safe_float(_fv(f, "middesk_confidence")) < 0.20
        ),
        "description": "Middesk entity confidence is below 0.20. "
                       "Middesk confidence = 0.15 base + 0.20 × (passing tasks / total tasks). "
                       "Score <0.20 means fewer than 1 out of 4 review tasks passed. "
                       "This is extremely low — entity verification is unreliable.",
        "action": "Request original formation documents directly from the applicant. "
                  "Do not rely on automated SOS matching for this business.",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS middesk_confidence FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='middesk_confidence';",
        "facts": ["middesk_confidence"],
    },
    {
        "id": "no_website_no_serp",
        "group": "Data Quality",
        "name": "No Website + No SERP Result — Digital Footprint Absent",
        "severity": "NOTICE",
        "check": lambda f: (
            _fv(f, "website") == "" and
            _fv(f, "serp_id") == "" and
            _fv(f, "website_found") in ("", "[]")
        ),
        "description": "No website URL was submitted, no SERP (Google) result found, "
                       "and website_found is empty. The business has zero digital footprint, "
                       "which is a significant factor in NAICS classification failure (Gap G1). "
                       "Also limits AI enrichment's ability to classify the business.",
        "action": "Ask applicant to provide website URL or social media presence. "
                  "Micro-businesses and very new businesses often lack digital presence.",
        "sql": "SELECT name, JSON_EXTRACT_PATH_TEXT(value,'value') AS val FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name IN ('website','serp_id','website_found');",
        "facts": ["website", "serp_id", "website_found"],
    },
    {
        "id": "no_formation_date",
        "group": "Data Quality",
        "name": "Formation Date Missing — Worth Score Impacted",
        "severity": "LOW",
        "check": lambda f: _fv(f, "formation_date") == "",
        "description": "formation_date is null. The Worth Score uses age_business (derived from formation_date) "
                       "as a primary Company Profile feature. When null, the model imputes a default "
                       "(typically 0 years), which penalizes the score and reduces prediction accuracy.",
        "action": "Check if entity is very new or if Middesk failed to retrieve the formation date. "
                  "Formation date is available in the sos_filings array (PostgreSQL RDS).",
        "sql": "SELECT JSON_EXTRACT_PATH_TEXT(value,'value') AS formation_date FROM rds_warehouse_public.facts WHERE business_id='{bid}' AND name='formation_date';",
        "facts": ["formation_date"],
    },
]


def run_deterministic_checks(facts: dict) -> list:
    """Run all deterministic checks. Returns list of triggered findings."""
    results = []
    for chk in DETERMINISTIC_CHECKS:
        try:
            triggered = chk["check"](facts)
        except Exception:
            triggered = False
        if triggered:
            desc = chk["description"]
            if callable(desc):
                try:
                    desc = desc(facts)
                except Exception:
                    desc = str(chk["description"])
            results.append({
                "id":          chk["id"],
                "group":       chk["group"],
                "name":        chk["name"],
                "severity":    chk["severity"],
                "description": desc,
                "action":      chk["action"],
                "sql":         chk.get("sql", ""),
                "facts":       chk.get("facts", []),
            })
    return results


def get_check_summary(results: list) -> dict:
    """Aggregate triggered checks into a severity summary."""
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "NOTICE": 0}
    groups = {}
    for r in results:
        counts[r["severity"]] = counts.get(r["severity"], 0) + 1
        grp = r["group"]
        if grp not in groups:
            groups[grp] = []
        groups[grp].append(r)

    overall = (
        "CRITICAL" if counts["CRITICAL"] > 0 else
        "HIGH"     if counts["HIGH"] > 0 else
        "MEDIUM"   if counts["MEDIUM"] > 0 else
        "LOW"      if counts["LOW"] > 0 else
        "NOTICE"   if counts["NOTICE"] > 0 else
        "CLEAN"
    )
    return {"counts": counts, "overall": overall, "by_group": groups, "total": len(results)}


# ══════════════════════════════════════════════════════════════════════════════
#  LLM DEEP AUDIT
# ══════════════════════════════════════════════════════════════════════════════

AUDIT_SYSTEM_PROMPT = """You are a senior KYB (Know Your Business) compliance analyst and underwriting expert.
You have deep knowledge of:
- The Worth AI KYB platform fact structure (Fact Engine, factWithHighestConfidence, combineFacts, dependent facts)
- Vendor integrations: Middesk (pid=16), OpenCorporates (pid=23), ZoomInfo (pid=24), Equifax (pid=17), Trulioo (pid=38), SERP (pid=22), Plaid IDV (pid=18), AI enrichment (pid=31)
- Worth Score model (3-model ensemble: firmographic XGBoost + financial neural net + economic model, 300-850 scale)
- KYB compliance requirements: SOS verification, TIN/EIN matching via IRS, IDV via Plaid biometrics, watchlist screening (PEP + OFAC sanctions)
- AML/BSA risk factors: cash-intensive industries, tax-haven entities, shell entity indicators, public records

Your job is to:
1. VERIFY data consistency across ALL facts (cross-field validation)
2. IDENTIFY red flags indicating fraud, shell entities, or compliance risk
3. DETECT anomalies (unusual patterns, missing critical fields, contradictions)
4. ASSESS Worth Score impact (which missing facts hurt the score most)
5. RECOMMEND specific underwriter actions with priority ordering
6. SUGGEST external verification steps when internal data is insufficient

RULES:
- Be specific. Reference exact fact names and values from the data provided.
- Severity: CRITICAL (block approval immediately), HIGH (requires manual review before proceeding),
  MEDIUM (investigate before decision), LOW (informational, note in file), CLEAN (no issue found).
- Explain WHY each finding matters for KYB compliance and/or credit risk.
- Consider fact relationships: formation_state vs operating address, revenue vs employees,
  SOS status vs TIN status, watchlist hits vs entity confidence.
- Consider industry-specific risk based on the NAICS code.

OUTPUT FORMAT — strict JSON only, no extra text:
{
  "overall_risk": "CRITICAL|HIGH|MEDIUM|LOW|CLEAN",
  "data_quality_score": 0-100,
  "summary": "Two-sentence executive summary for the underwriting manager",
  "kyb_completeness": {
    "sos_verified": true|false,
    "tin_verified": true|false,
    "idv_completed": true|false,
    "watchlist_screened": true|false,
    "industry_classified": true|false
  },
  "findings": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW|CLEAN",
      "category": "Identity|Compliance|Financial|Entity Resolution|Data Quality|Industry Risk",
      "title": "Short descriptive title",
      "description": "Detailed explanation referencing specific fact names and values",
      "facts_involved": ["fact_name_1", "fact_name_2"],
      "worth_score_impact": "High|Medium|Low|None — brief explanation of score impact",
      "recommended_action": "Specific action for the underwriter",
      "external_verification": "Optional: specific external source to check (e.g., 'Check SEC EDGAR for XYZ Corp')"
    }
  ],
  "recommended_next_steps": ["Step 1 (highest priority)", "Step 2", "Step 3"],
  "underwriting_decision_guidance": "APPROVE|FURTHER_REVIEW|DECLINE — with one sentence rationale"
}"""


def build_fact_summary(facts: dict) -> dict:
    """Build a compact fact summary for LLM (avoids sending huge raw JSON)."""
    summary = {}
    for name, f in facts.items():
        if name.startswith("_"):
            continue
        if f.get("_too_large"):
            summary[name] = {"value": "[LARGE_OBJECT — query RDS directly]", "note": "too large for Redshift"}
            continue
        v = f.get("value")
        src = f.get("source", {})
        pid = src.get("platformId") if isinstance(src, dict) else None
        conf = src.get("confidence") if isinstance(src, dict) else None
        rule = f.get("ruleApplied", {})
        rule_name = rule.get("name") if isinstance(rule, dict) else None
        alts = len(f.get("alternatives", []) or [])
        summary[name] = {
            "value": (v if not isinstance(v, (list, dict))
                      else f"[{type(v).__name__}: {len(v)} items]"),
            "source_vendor_id": pid,
            "confidence": conf,
            "rule": rule_name,
            "alternatives_count": alts,
        }
    return summary


@st.cache_data(ttl=1800, show_spinner=False)
def run_llm_audit(facts_json: str, business_id: str, score_json: str = "",
                  _api_key_hint: str = "") -> tuple:
    """
    Run GPT-powered deep audit. Cached per (facts_hash, bid, api_key_hint).
    _api_key_hint: last 8 chars of the active key — included so a new key
    automatically busts the old cached 401 error without forcing a full rerun.
    Returns (result_dict, error_str).
    """
    client = get_openai_client()
    if not client:
        return None, "OpenAI API key not configured — set OPENAI_API_KEY env var or secrets.toml."

    try:
        facts = json.loads(facts_json)
        score = json.loads(score_json) if score_json else {}
    except Exception as e:
        return None, f"JSON parse error: {e}"

    fact_summary = build_fact_summary(facts)

    user_prompt = (
        f"Analyze this business entity for KYB compliance risk and data quality.\n\n"
        f"Business ID: {business_id}\n\n"
        f"FACT PROFILE:\n{json.dumps(fact_summary, indent=2, default=str)}\n"
    )
    if score:
        user_prompt += f"\nWORTH SCORE INFO:\n{json.dumps(score, indent=2, default=str)}\n"

    user_prompt += (
        "\nFocus your analysis on:\n"
        "1. Cross-field inconsistencies (e.g., SOS active but TIN failed)\n"
        "2. Missing critical KYB data (SOS, TIN, IDV, NAICS)\n"
        "3. High-risk indicators (watchlist, bankruptcies, tax-haven states)\n"
        "4. Shell entity signals (high revenue + few employees, RA address, no digital footprint)\n"
        "5. Entity resolution concerns (formation vs operating state)\n"
        "6. Worth Score impact of missing data\n"
        "7. Industry-specific risk from NAICS code\n\n"
        "Return ONLY the JSON response, no preamble."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": AUDIT_SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content), None
    except Exception as e:
        return None, str(e)


def facts_cache_key(facts: dict) -> str:
    """Stable hash of the facts dict for cache keying."""
    return hashlib.md5(json.dumps(facts, sort_keys=True, default=str).encode()).hexdigest()[:12]
