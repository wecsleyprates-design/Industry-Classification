"""
Entity-level context assembly.

Returns a dict that is consumed by:
  * the Entity 360 page
  * the Check-Agent engine
"""
from __future__ import annotations

from typing import Any

from core.logger import get_logger
from data_access import fixtures
from data_access.pii import mask_dataframe
from data_access.redshift import query as rs_query
from data_access.queries import entity as entity_q

log = get_logger(__name__)


def load_entity_context(business_id: str) -> dict[str, Any]:
    if not business_id:
        business_id = "bus_demo"

    # Profile
    profile_df = None
    try:
        df = rs_query(entity_q.profile_sql(business_id))
        profile_df = df if df is not None and not df.empty else None
    except Exception as exc:
        log.info("entity profile query failed — fixtures. (%s)", exc)

    if profile_df is None:
        profile_df = fixtures.entity_profile(business_id)
        features = fixtures.entity_features(business_id)
    else:
        # Fold fact rows back into a wide profile
        features = profile_df.copy()

    profile_df = mask_dataframe(profile_df)
    features   = mask_dataframe(features)

    # Relationships
    try:
        rel_df = rs_query(entity_q.relationships_sql(business_id))
        relationships = rel_df.to_dict("records") if rel_df is not None else []
    except Exception as exc:
        log.info("entity relationships query failed — demo. (%s)", exc)
        relationships = [
            {"related_id": "bus_b94...", "identifier_type": "tin",      "shared_value": "XX-XXX4821", "risk": "high",   "rel":"Shared TIN"},
            {"related_id": "bus_f22...", "identifier_type": "address",  "shared_value": "123 Dock St…","risk": "medium", "rel":"Shared Address"},
            {"related_id": "bus_a71...", "identifier_type": "ubo",      "shared_value": "Rita Chen",   "risk": "medium", "rel":"Shared UBO", "ubo_id":"UBO-1"},
            {"related_id": "bus_c04...", "identifier_type": "phone",    "shared_value": "(***) ***-4420", "risk":"low",  "rel":"Shared Phone"},
        ]

    return {
        "entity_id": business_id,
        "profile_df": profile_df,
        "features_df": features,
        "relationships": relationships,
        "timeline": _build_timeline(),
        "red_flags": _build_red_flags(),
    }


def _build_timeline() -> list[dict[str, Any]]:
    return [
        {"ts": "2026-03-12 09:14", "title": "Application Submitted",    "desc": "Onboarding form received",                       "tone":"info"},
        {"ts": "2026-03-12 09:15", "title": "TIN Validation",            "desc": "IRS EIN verified via Middesk (status=success)", "tone":"green"},
        {"ts": "2026-03-12 09:16", "title": "Confidence Scored",         "desc": "Score=0.63 (Medium band)",                      "tone":"amber"},
        {"ts": "2026-03-12 09:17", "title": "Address Consistency",      "desc": "Minor mismatch USPS vs SOS",                    "tone":"amber"},
        {"ts": "2026-03-12 09:20", "title": "UBO Verification",         "desc": "2/3 UBOs verified via Trulioo PSC",             "tone":"amber"},
        {"ts": "2026-03-12 09:45", "title": "Check-Agent Triggered",    "desc": "3 cross-source inconsistencies",                 "tone":"red"},
        {"ts": "2026-03-12 11:48", "title": "Escalated to Manual",      "desc": "Routed to analyst queue (SLA 24h)",              "tone":"red"},
    ]


def _build_red_flags() -> list[dict[str, Any]]:
    return [
        {"severity": "high",   "title": "Shared TIN with unrelated entity",
         "desc": "EIN appears on 2 businesses with different legal names.",
         "evidence": "facts.tin_match vs facts.related_records[0].tin"},
        {"severity": "medium", "title": "Address discrepancy",
         "desc": "Filed address (Wilmington, DE) differs from operating address (Trenton, NJ).",
         "evidence": "USPS.deliverable vs sos_filing.registered_address"},
        {"severity": "medium", "title": "UBO partially unverified",
         "desc": "1/3 UBOs failed IDV at Trulioo PSC.",
         "evidence": "trulioo_psc.ubo[2].status=failed"},
    ]


def build_check_agent_context(business_id: str) -> dict[str, Any]:
    """Shape an entity's data into the structure the Check-Agent engine expects."""
    ctx = load_entity_context(business_id)
    features = {row["name"]: row.get("value") for _, row in ctx["features_df"].iterrows()} \
               if "name" in ctx["features_df"].columns else {}

    facts = {
        "legal_name":                ctx["profile_df"].get("legal_name", [""])[0] if not ctx["profile_df"].empty else "",
        "dba":                       ctx["profile_df"].get("dba", [""])[0]        if not ctx["profile_df"].empty else "",
        "entity_type":               ctx["profile_df"].get("entity_type", [""])[0] if not ctx["profile_df"].empty else "",
        "registration_active":       True,
        "registration_status":       "Active",
        "applicant_registration_status": "active",
        "tin":                       ctx["profile_df"].get("ein", [""])[0] if not ctx["profile_df"].empty else "",
        "tin_match":                 True,
        "shared_tin_count":          2,
        "address_shared_business_count": 3,
        "phone_shared_business_count":   2,
        "ubo_verified":              0.66,
        "address_consistency":       0.58,
        "submitted_at":              "2026-03-12 09:14",
        "scored_at":                 "2026-03-12 09:16",
        "decision_at":               "2026-03-12 11:48",
        **features,
    }
    return {
        "entity_id":       business_id,
        "facts":           facts,
        "score":           0.63,
        "band":            "Medium",
        "decision":        "Escalated",
        "previous_score":  0.61,
        "data_changed_since_last_score": True,
        "relationships":   ctx["relationships"],
        "timeline":        ctx["timeline"],
        "resubmission_count": 1,
        "cluster_size":     4,
        "cluster_disjoint": True,
    }
