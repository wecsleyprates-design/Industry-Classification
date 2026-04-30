"""Worth AI API client for the NAICS/MCC Explorer.

Handles authentication (sign-in + token refresh) and the details endpoint.
Credentials are read from Streamlit secrets (never hardcoded or committed).

Setup: create .streamlit/secrets.toml with:
    WORTH_EMAIL    = "your@email.com"
    WORTH_PASSWORD = "yourpassword"
    WORTH_API_BASE = "https://api.joinworth.com/integration/api/v1"

Auth flow (AWS Cognito via Worth API):
  POST /auth/api/v1/customer/sign-in  → id_token (JWT, ~1h) + refresh_token
  id_token is used as Authorization: Bearer <id_token>
  refresh_token renews id_token before expiry

Token storage: st.session_state (per-browser-session, never persisted to disk).
"""
from __future__ import annotations

import time
import requests
import streamlit as st

# ── Constants ──────────────────────────────────────────────────────────────────
AUTH_BASE = "https://api.joinworth.com/auth/api/v1"
_TOKEN_KEY    = "_worth_id_token"
_REFRESH_KEY  = "_worth_refresh_token"
_EXPIRY_KEY   = "_worth_token_expiry"
_TOKEN_TTL    = 3300  # refresh after 55 min (token lasts ~60 min)


# ── Credential helpers ─────────────────────────────────────────────────────────

def _get_credentials() -> tuple[str, str]:
    """Read email + password from st.secrets. Raises clear error if missing."""
    try:
        email    = st.secrets["WORTH_EMAIL"]
        password = st.secrets["WORTH_PASSWORD"]
    except (KeyError, FileNotFoundError):
        raise RuntimeError(
            "Worth API credentials not found. "
            "Create .streamlit/secrets.toml with:\n"
            "  WORTH_EMAIL    = 'your@email.com'\n"
            "  WORTH_PASSWORD = 'yourpassword'\n"
            "  WORTH_API_BASE = 'https://api.joinworth.com/integration/api/v1'"
        )
    return email, password


def _get_api_base() -> str:
    try:
        return st.secrets.get("WORTH_API_BASE",
                              "https://api.joinworth.com/integration/api/v1")
    except Exception:
        return "https://api.joinworth.com/integration/api/v1"


# ── Sign-in ────────────────────────────────────────────────────────────────────

def _sign_in() -> dict:
    """Try admin sign-in first, fall back to customer sign-in.

    admin.joinworth.com uses the admin endpoint (POST /admin/sign-in).
    The customer endpoint (POST /customer/sign-in) is for external customers,
    not Worth AI internal users.
    """
    email, password = _get_credentials()

    # Try admin endpoint first (internal Worth AI users / admin portal)
    for endpoint in ["/admin/sign-in", "/customer/sign-in"]:
        resp = requests.post(
            f"{AUTH_BASE}{endpoint}",
            json={"email": email, "password": password},
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            id_token      = data.get("id_token")
            refresh_token = data.get("refresh_token")
            if id_token:
                return {"id_token": id_token, "refresh_token": refresh_token or ""}
        # 400 = wrong credentials for this endpoint type → try next
        elif resp.status_code not in (400, 401, 403):
            try:
                detail = resp.json().get("message", resp.text[:200])
            except Exception:
                detail = resp.text[:200]
            raise RuntimeError(f"Worth API sign-in failed ({resp.status_code}): {detail}")

    # Both endpoints returned 400/401 — credentials are genuinely wrong
    try:
        detail = resp.json().get("message", "Incorrect username or password.")
    except Exception:
        detail = "Incorrect username or password."
    raise RuntimeError(
        f"Worth API sign-in failed: {detail}\n\n"
        "Check your credentials in .streamlit/secrets.toml:\n"
        "  WORTH_EMAIL    = 'your@worthai.com'\n"
        "  WORTH_PASSWORD = 'yourpassword'\n"
        "Both /admin/sign-in and /customer/sign-in were tried."
    )


def _refresh_token(refresh_token: str) -> dict:
    """Refresh the id_token. Tries admin refresh first, then customer.
    Falls back to full sign-in if both fail."""
    for endpoint in ["/refresh-token/admin", "/refresh-token/customer"]:
        try:
            resp = requests.post(
                f"{AUTH_BASE}{endpoint}",
                json={"refresh_token": refresh_token},
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {})
                id_token = data.get("id_token")
                if id_token:
                    return {"id_token": id_token,
                            "refresh_token": data.get("refresh_token", refresh_token)}
        except Exception:
            pass
    # All refresh attempts failed — do a full sign-in
    return _sign_in()


# ── Token management ───────────────────────────────────────────────────────────

def get_valid_token() -> str:
    """Return a valid Bearer id_token, signing in or refreshing as needed.

    Token is cached in st.session_state for the browser session.
    Automatically refreshes 5 minutes before expiry.
    """
    now = time.time()
    expiry = st.session_state.get(_EXPIRY_KEY, 0)

    if expiry and now < expiry:
        # Token still valid
        return st.session_state[_TOKEN_KEY]

    # Try refresh first
    existing_refresh = st.session_state.get(_REFRESH_KEY)
    if existing_refresh:
        tokens = _refresh_token(existing_refresh)
    else:
        tokens = _sign_in()

    st.session_state[_TOKEN_KEY]   = tokens["id_token"]
    st.session_state[_REFRESH_KEY] = tokens.get("refresh_token", existing_refresh or "")
    st.session_state[_EXPIRY_KEY]  = now + _TOKEN_TTL
    return tokens["id_token"]


def is_configured() -> bool:
    """Returns True if credentials are available in secrets."""
    try:
        st.secrets["WORTH_EMAIL"]
        st.secrets["WORTH_PASSWORD"]
        return True
    except Exception:
        return False


# ── API calls ──────────────────────────────────────────────────────────────────

def get_business_details(business_id: str) -> dict:
    """GET /facts/business/{businessId}/details

    This is the exact endpoint the Admin Portal calls (integration.service.ts line 390):
        `${MICROSERVICE.INTEGRATION}/facts/business/${businessId}/details`

    Returns the full fact picture — naics_code, mcc_code, mcc_code_found,
    mcc_code_from_naics, naics_description, mcc_description, industry,
    alternatives[], source.platformId, source.confidence, source.updatedAt,
    ruleApplied — identical to what the Admin Portal shows.

    businessId = the FIRST UUID in the Admin Portal URL:
        admin.joinworth.com/businesses/{THIS_ONE}/cases/{not_this}/kyb/...
    This ID is the same as business_id in rds_warehouse_public.facts.

    Raises RuntimeError on auth failure or network error.
    """
    token   = get_valid_token()
    base    = _get_api_base()
    url     = f"{base}/facts/business/{business_id}/details"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    }

    resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 401:
        # Token expired mid-session — force re-auth and retry once
        st.session_state.pop(_EXPIRY_KEY, None)
        token = get_valid_token()
        headers["Authorization"] = f"Bearer {token}"
        resp = requests.get(url, headers=headers, timeout=15)

    if resp.status_code == 404:
        raise RuntimeError(
            f"Business `{business_id}` not found.\n\n"
            "Use the FIRST UUID from the Admin Portal URL:\n"
            "admin.joinworth.com/businesses/**{THIS_UUID}**/cases/{...}/kyb/..."
        )
    if resp.status_code == 403:
        raise RuntimeError(
            "Access denied. Your admin account may not have permission to read this business."
        )
    if resp.status_code != 200:
        try:
            detail = resp.json().get("message", resp.text[:200])
        except Exception:
            detail = resp.text[:200]
        raise RuntimeError(f"Facts Details API error ({resp.status_code}): {detail}")

    payload = resp.json()
    # Response: {"status": "success", "data": { naics_code: {...}, mcc_code: {...}, ... }}
    return payload.get("data", payload)


def extract_fact(details: dict, fact_name: str) -> dict | None:
    """Extract a single fact dict from the details response by name.

    Returns the fact object (value, source, alternatives, ruleApplied, etc.)
    or None if the fact is not present.
    """
    return details.get(fact_name)


def extract_classification_facts(details: dict) -> dict[str, dict]:
    """Extract NAICS/MCC classification facts from the API details response.

    Preserves the full Admin Portal JSON format for each fact, including:
      name, value, schema, source (with platformId, confidence, updatedAt, name),
      override, dependencies, description, ruleApplied, isNormalized, alternatives[]
      + flat source.confidence / source.platformId / source.name fields

    Returns a dict keyed by fact name with the complete fact object.
    """
    CLASSIFICATION_FACT_NAMES = [
        "naics_code",
        "naics_description",
        "mcc_code",
        "mcc_code_found",
        "mcc_code_from_naics",
        "mcc_description",
        "industry",
        "classification_codes",
    ]
    result = {}
    for name in CLASSIFICATION_FACT_NAMES:
        fact = details.get(name)
        if fact is None:
            continue
        # Ensure the fact object preserves all Admin Portal fields
        if isinstance(fact, dict):
            # Add flat source.* fields if not already present (mirror Admin Portal format)
            src = fact.get("source") or {}
            if isinstance(src, dict):
                fact.setdefault("source.confidence", src.get("confidence"))
                fact.setdefault("source.platformId",  src.get("platformId"))
                fact.setdefault("source.name",        src.get("name"))
        result[name] = fact
    return result
