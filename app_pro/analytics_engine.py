"""
analytics_engine.py — Advanced analytics for KYB Hub Pro.
Provides entity comparison, trend analysis, cohort analytics, and anomaly scoring.
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

from db_connector import run_query, safe_get, parse_fact_json

# ── Anomaly Scoring Engine ───────────────────────────────────────────────────

class AnomalyScorer:
    """Scores a business entity across multiple risk dimensions."""

    WEIGHTS = {
        "identity":    0.20,  # SOS, TIN, name match
        "financial":   0.15,  # Revenue/employee ratio, bankruptcies
        "compliance":  0.25,  # Watchlist, sanctions, PEP
        "data_quality": 0.15, # Fill rate, null critical fields
        "consistency": 0.15,  # Cross-field consistency
        "external":    0.10,  # Formation state, registered agent, etc.
    }

    def __init__(self, facts: dict, score_info: dict = None):
        self.facts = facts
        self.score_info = score_info or {}

    def _fv(self, name):
        f = self.facts.get(name, {})
        if f.get("_too_large"):
            return ""
        v = f.get("value")
        if isinstance(v, (list, dict)):
            return ""
        return str(v) if v is not None else ""

    def _safe_int(self, v):
        try:
            return int(float(v or 0))
        except:
            return 0

    def _safe_float(self, v):
        try:
            return float(v or 0)
        except:
            return 0.0

    def score_identity(self):
        """Score identity verification dimension (0-100, higher = more risk)."""
        score = 0
        reasons = []

        sos = self._fv("sos_active")
        if sos == "false":
            score += 40
            reasons.append("SOS inactive — entity not in good standing")
        elif not sos:
            score += 25
            reasons.append("SOS status unknown — no vendor data")

        tin = self._fv("tin_match_boolean")
        if tin == "false":
            score += 30
            reasons.append("TIN/EIN verification failed")
        elif not tin:
            score += 15
            reasons.append("TIN verification not completed")

        nm = self._fv("name_match_boolean")
        if nm == "false":
            score += 20
            reasons.append("Business name does not match SOS registry")

        idv = self._fv("idv_passed_boolean")
        if idv == "false":
            score += 10
            reasons.append("Owner identity verification failed")

        return min(score, 100), reasons

    def score_financial(self):
        """Score financial risk dimension."""
        score = 0
        reasons = []

        rev = self._safe_float(self._fv("revenue"))
        emp = self._safe_int(self._fv("num_employees"))

        if rev > 5_000_000 and 0 < emp <= 3:
            score += 40
            reasons.append(f"Revenue ${rev:,.0f} with only {emp} employees — possible shell entity")
        elif rev > 1_000_000 and emp == 0:
            score += 30
            reasons.append(f"Revenue ${rev:,.0f} with 0 employees reported")

        bk = self._safe_int(self._fv("num_bankruptcies"))
        if bk > 0:
            score += min(bk * 20, 40)
            reasons.append(f"{bk} bankruptcy filing(s)")

        liens = self._safe_int(self._fv("num_liens"))
        if liens > 0:
            score += min(liens * 10, 20)
            reasons.append(f"{liens} lien(s) on record")

        jd = self._safe_int(self._fv("num_judgements"))
        if jd > 0:
            score += min(jd * 15, 30)
            reasons.append(f"{jd} civil judgment(s)")

        return min(score, 100), reasons

    def score_compliance(self):
        """Score compliance risk dimension."""
        score = 0
        reasons = []

        wl = self._safe_int(self._fv("watchlist_hits"))
        if wl > 0:
            score += min(wl * 30, 80)
            reasons.append(f"{wl} watchlist hit(s) — sanctions/PEP")

        am = self._safe_int(self._fv("adverse_media_hits"))
        if am > 0:
            score += min(am * 15, 40)
            reasons.append(f"{am} adverse media hit(s)")

        # High-risk NAICS codes
        naics = self._fv("naics_code")
        HIGH_RISK_NAICS = {"522390", "522320", "523130", "812990", "453998"}  # MSBs, pawn, etc.
        if naics in HIGH_RISK_NAICS:
            score += 20
            reasons.append(f"High-risk industry: NAICS {naics}")

        return min(score, 100), reasons

    def score_data_quality(self):
        """Score data quality dimension."""
        score = 0
        reasons = []

        total = len([n for n in self.facts if not n.startswith("_")])
        has_val = sum(1 for n, f in self.facts.items()
                      if not n.startswith("_") and f.get("value") is not None and not f.get("_too_large"))
        fill_rate = has_val / max(total, 1) * 100

        if fill_rate < 30:
            score += 50
            reasons.append(f"Very low data fill rate: {fill_rate:.0f}%")
        elif fill_rate < 50:
            score += 30
            reasons.append(f"Low data fill rate: {fill_rate:.0f}%")
        elif fill_rate < 70:
            score += 10
            reasons.append(f"Moderate data fill rate: {fill_rate:.0f}%")

        # Critical fields missing
        critical = ["sos_active", "tin_match_boolean", "naics_code", "formation_date"]
        missing = [f for f in critical if not self._fv(f)]
        if missing:
            score += len(missing) * 10
            reasons.append(f"Missing critical fields: {', '.join(missing)}")

        if self._fv("naics_code") == "561499":
            score += 15
            reasons.append("NAICS fallback code 561499 — industry unknown")

        return min(score, 100), reasons

    def score_consistency(self):
        """Score cross-field consistency."""
        score = 0
        reasons = []

        # SOS active but TIN failed
        if self._fv("sos_active") == "true" and self._fv("tin_match_boolean") == "false":
            score += 25
            reasons.append("SOS active but TIN failed — name/EIN mismatch")

        # SOS inactive but TIN passed
        if self._fv("sos_active") == "false" and self._fv("tin_match_boolean") == "true":
            score += 30
            reasons.append("SOS inactive but TIN passed — entity may be dissolved")

        # Formation state vs operating state
        form_state = self._fv("formation_state")
        addr = self.facts.get("primary_address", {}).get("value", {})
        op_state = addr.get("state", "") if isinstance(addr, dict) else ""
        if form_state and op_state and form_state.upper() != op_state.upper():
            if form_state.upper() in ("DE", "NV", "WY"):
                score += 15
                reasons.append(f"Formed in tax-haven {form_state} but operates in {op_state}")

        # Score = 0 but SOS active
        ws = self.score_info.get("score_850", 0)
        if ws <= 300 and self._fv("sos_active") == "true":
            score += 20
            reasons.append("Worth Score = 0 despite active SOS — model input data likely missing")

        return min(score, 100), reasons

    def score_external(self):
        """Score external risk indicators."""
        score = 0
        reasons = []

        # Tax haven formation
        fs = self._fv("formation_state")
        if fs and fs.upper() in ("DE", "NV", "WY"):
            score += 15
            reasons.append(f"Formation in tax-haven state: {fs}")

        # Registered agent address
        ra = self._fv("address_registered_agent")
        if ra == "true":
            score += 20
            reasons.append("Business address is a known registered agent address")

        # Website parked
        wp = self._fv("website_parked")
        if wp == "true":
            score += 15
            reasons.append("Website domain is parked — no active business presence")

        # No website at all
        if not self._fv("website"):
            score += 10
            reasons.append("No website URL provided or found")

        return min(score, 100), reasons

    def compute_overall(self):
        """Compute the overall anomaly score and detailed breakdown."""
        dimensions = {}
        all_reasons = []

        for dim_name, weight in self.WEIGHTS.items():
            method = getattr(self, f"score_{dim_name}")
            dim_score, reasons = method()
            dimensions[dim_name] = {
                "score": dim_score,
                "weight": weight,
                "weighted": round(dim_score * weight, 1),
                "reasons": reasons,
            }
            all_reasons.extend(reasons)

        overall = sum(d["weighted"] for d in dimensions.values())
        overall = min(round(overall), 100)

        # Risk tier
        if overall >= 70:
            tier = "CRITICAL"
        elif overall >= 50:
            tier = "HIGH"
        elif overall >= 30:
            tier = "MEDIUM"
        elif overall >= 10:
            tier = "LOW"
        else:
            tier = "CLEAN"

        return {
            "overall_score": overall,
            "tier": tier,
            "dimensions": dimensions,
            "all_reasons": all_reasons,
            "reason_count": len(all_reasons),
        }


# ── Entity Comparison ────────────────────────────────────────────────────────

def compare_entities(facts_a: dict, facts_b: dict, bid_a: str, bid_b: str):
    """Compare two business entities side by side."""
    comparison_fields = [
        ("legal_name", "Legal Name"),
        ("sos_active", "SOS Active"),
        ("sos_match_boolean", "SOS Match"),
        ("tin_match_boolean", "TIN Match"),
        ("idv_passed_boolean", "IDV Passed"),
        ("naics_code", "NAICS Code"),
        ("mcc_code", "MCC Code"),
        ("formation_state", "Formation State"),
        ("formation_date", "Formation Date"),
        ("revenue", "Revenue"),
        ("num_employees", "Employees"),
        ("num_bankruptcies", "Bankruptcies"),
        ("num_judgements", "Judgements"),
        ("num_liens", "Liens"),
        ("watchlist_hits", "Watchlist Hits"),
        ("adverse_media_hits", "Adverse Media"),
        ("website", "Website"),
        ("risk_score", "Risk Score"),
    ]

    rows = []
    for fact_name, display_name in comparison_fields:
        val_a = _get_display_value(facts_a, fact_name)
        val_b = _get_display_value(facts_b, fact_name)
        match = val_a == val_b if val_a and val_b else None

        rows.append({
            "Field": display_name,
            f"Entity A ({bid_a[:8]}...)": val_a or "(null)",
            f"Entity B ({bid_b[:8]}...)": val_b or "(null)",
            "Match": "✅" if match else "❌" if match is False else "⚪",
        })

    return pd.DataFrame(rows)


def _get_display_value(facts, name):
    f = facts.get(name, {})
    if f.get("_too_large"):
        return "[large]"
    v = f.get("value")
    if isinstance(v, (list, dict)):
        return f"[{type(v).__name__}]"
    return str(v) if v is not None else ""


# ── Trend Analysis ───────────────────────────────────────────────────────────

def load_score_history(business_id: str):
    """Load historical Worth Scores for a business."""
    return run_query(f"""
        SELECT bs.weighted_score_850 AS score_850,
               bs.weighted_score_100 AS score_100,
               bs.risk_level, bs.score_decision,
               bs.created_at
        FROM rds_manual_score_public.business_scores bs
        JOIN rds_manual_score_public.data_current_scores cs
          ON cs.business_id = '{business_id}'
        WHERE bs.business_id_ref = '{business_id}'
        ORDER BY bs.created_at ASC
    """)


def load_fact_history(business_id: str, fact_name: str):
    """Load historical values of a specific fact."""
    return run_query(f"""
        SELECT value, received_at
        FROM rds_warehouse_public.facts
        WHERE business_id = '{business_id}'
          AND name = '{fact_name}'
        ORDER BY received_at ASC
    """)


# ── Portfolio Cohort Analysis ────────────────────────────────────────────────

def load_cohort_analysis(date_from, date_to):
    """Load cohort data for portfolio analysis."""
    return run_query(f"""
        WITH cohort AS (
            SELECT business_id,
                   DATE_TRUNC('week', MIN(received_at)) AS cohort_week
            FROM rds_warehouse_public.facts
            WHERE received_at >= '{date_from}'
              AND received_at <= '{date_to} 23:59:59'
            GROUP BY business_id
        )
        SELECT cohort_week,
               COUNT(DISTINCT c.business_id) AS businesses,
               SUM(CASE WHEN f_sos.value IS NOT NULL
                        AND JSON_EXTRACT_PATH_TEXT(f_sos.value, 'value') = 'true'
                   THEN 1 ELSE 0 END) AS sos_pass,
               SUM(CASE WHEN f_tin.value IS NOT NULL
                        AND JSON_EXTRACT_PATH_TEXT(f_tin.value, 'value') = 'true'
                   THEN 1 ELSE 0 END) AS tin_pass
        FROM cohort c
        LEFT JOIN rds_warehouse_public.facts f_sos
          ON f_sos.business_id = c.business_id AND f_sos.name = 'sos_active'
        LEFT JOIN rds_warehouse_public.facts f_tin
          ON f_tin.business_id = c.business_id AND f_tin.name = 'tin_match_boolean'
        GROUP BY cohort_week
        ORDER BY cohort_week
    """)


# ── Helper to avoid import issues ────────────────────────────────────────────

def _safe_int_val(v):
    try:
        return int(float(v or 0))
    except:
        return 0
