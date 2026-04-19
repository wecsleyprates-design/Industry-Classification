"""
Demo-mode fixtures.

Used only when `SETTINGS.demo_mode=True` and Redshift is unreachable. Provides
deterministic DataFrames so the UI can be walked through end-to-end without
a live warehouse.
"""
from __future__ import annotations

import pandas as pd


def portfolio_summary() -> pd.DataFrame:
    return pd.DataFrame([dict(
        total_cases=24716, distinct_customers=5482, distinct_businesses=19124,
        avg_confidence=0.742, median_confidence=0.781, manual_review_pct=14.8,
        auto_approve_pct=71.3, auto_decline_pct=13.9,
    )])


def confidence_bands() -> pd.DataFrame:
    return pd.DataFrame({
        "band":  ["Very Low", "Low", "Medium", "High", "Very High"],
        "count": [862, 1940, 4318, 9201, 8395],
    })


def confidence_trend() -> pd.DataFrame:
    weeks = [f"W{i}" for i in range(1, 13)]
    return pd.DataFrame({
        "week":      weeks,
        "average":   [0.71,0.72,0.72,0.73,0.74,0.73,0.74,0.75,0.75,0.74,0.75,0.76],
        "domestic":  [0.73,0.74,0.75,0.76,0.77,0.76,0.77,0.78,0.79,0.78,0.79,0.80],
        "foreign":   [0.65,0.64,0.66,0.68,0.67,0.65,0.66,0.68,0.69,0.67,0.69,0.70],
    })


def feature_importance() -> pd.DataFrame:
    return pd.DataFrame([
        dict(feature="tin_validation_status",   importance=0.182, drift=0.04),
        dict(feature="address_consistency_score", importance=0.151, drift=0.07),
        dict(feature="registration_active",     importance=0.128, drift=0.02),
        dict(feature="entity_age_days",         importance=0.102, drift=0.11),
        dict(feature="ubo_verified",            importance=0.094, drift=0.03),
        dict(feature="watchlist_hits",          importance=0.088, drift=0.01),
        dict(feature="website_domain_age",      importance=0.071, drift=0.09),
        dict(feature="naics_confidence",        importance=0.065, drift=0.05),
        dict(feature="number_of_filings",       importance=0.051, drift=0.06),
        dict(feature="address_contact_overlap", importance=0.068, drift=0.19),
    ])


def inconsistency_counts() -> pd.DataFrame:
    return pd.DataFrame([
        dict(category="identity",     cases=182),
        dict(category="identifier",   cases=94),
        dict(category="address",      cases=161),
        dict(category="registration", cases=58),
        dict(category="model_output", cases=73),
        dict(category="temporal",     cases=29),
        dict(category="network",      cases=121),
    ])


def entity_profile(business_id: str) -> pd.DataFrame:
    return pd.DataFrame([dict(
        business_id=business_id or "bus_demo",
        legal_name="Northgate Logistics LLC",
        dba="Northgate Freight",
        entity_type="Domestic (LLC)",
        jurisdiction="Delaware, USA",
        registration="Active",
        confidence=0.63,
        band="Medium",
        decision="Escalated",
        red_flags=3,
        submitted_at="2026-03-12 09:14",
        scored_at="2026-03-12 09:16",
        decision_at="2026-03-12 11:48",
        ein="XX-XXX4821",
        customer="Acme Holdings Inc.",
    )])


def entity_features(business_id: str) -> pd.DataFrame:
    return pd.DataFrame([
        dict(name="tin_validation_status", value="success", source="Middesk",        confidence=0.92, warn=False, note=""),
        dict(name="registration_active",   value="true",    source="Middesk",        confidence=0.88, warn=False, note=""),
        dict(name="address_consistency",   value="0.58",    source="OpenCorporates", confidence=0.55, warn=True,  note="Disagrees with USPS"),
        dict(name="entity_age_days",       value="412",     source="SOS",            confidence=0.97, warn=False, note=""),
        dict(name="ubo_verified",          value="2/3",     source="Trulioo PSC",    confidence=0.60, warn=True,  note="1 UBO unverified"),
        dict(name="watchlist_hits",        value="0",       source="Trulioo",        confidence=1.00, warn=False, note=""),
        dict(name="formation_state",       value="DE",      source="Middesk",        confidence=0.99, warn=True,  note="Tax-haven state"),
    ])


def red_flag_ranking() -> pd.DataFrame:
    return pd.DataFrame([
        dict(pattern="Shared TIN across unrelated entities",      cases=87, severity="high"),
        dict(pattern="Address tied to 5+ businesses",             cases=62, severity="high"),
        dict(pattern="Foreign registration w/ missing docs",      cases=41, severity="medium"),
        dict(pattern="Legal name != DBA / Provider records",      cases=38, severity="medium"),
        dict(pattern="Decision before scoring timestamp",         cases=14, severity="high"),
        dict(pattern="High conf despite missing critical feat.",  cases=53, severity="medium"),
        dict(pattern="UBO linked to 4+ businesses",               cases=29, severity="medium"),
    ])


def for_query(sql: str) -> pd.DataFrame:
    """Very dumb SQL router for demo mode. Returns reasonable data based on keywords."""
    s = sql.lower()
    if "psi" in s:
        return pd.DataFrame({"week": [f"W{i}" for i in range(1,13)],
                             "psi":  [0.08,0.09,0.10,0.12,0.14,0.18,0.22,0.21,0.19,0.16,0.14,0.13]})
    if "band" in s or "distribution" in s:
        return confidence_bands()
    if "trend" in s or "domestic" in s or "foreign" in s:
        return confidence_trend()
    if "importance" in s or "shap" in s or "feature" in s:
        return feature_importance()
    if "inconsisten" in s or "red flag" in s:
        return red_flag_ranking()
    # default: portfolio row
    return portfolio_summary()
