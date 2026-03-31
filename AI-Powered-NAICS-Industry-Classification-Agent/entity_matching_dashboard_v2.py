"""
entity_matching_dashboard_v2.py
================================
Enterprise-grade Entity Resolution / KYB Analyst Dashboard.

Key upgrades over v1:
  - Multi-source candidate comparison panel (ZoomInfo, Equifax, OpenCorporates, Liberty)
  - Cross-source consensus / conflict analysis layer
  - Source-specific XGBoost confidence explainability with reason codes
  - Field-level comparison view (input vs. best candidate per source)
  - Entity Resolution Queue with filters, sorting, pagination
  - Analyst Review Decision Panel (Approve / Reject / Escalate / No Match)
  - Audit trail / history log (session-local)
  - Operational Summary Dashboard
  - Source win / disagreement metrics
  - [NEW] Consensus Level 2 XGBoost Industry Classification tab
    Uses the same Level 1 confidence scores produced by the entity matching
    pipeline to run the Consensus industry classification model and produce:
      • Calibrated probability per industry code (top-3)
      • Correct taxonomy per jurisdiction (NAICS, UK SIC 2007, NACE, ISIC)
      • 6 AML/KYB risk signal types
      • KYB recommendation: APPROVE / REVIEW / ESCALATE / REJECT

All XGBoost confidence scores and pipeline outputs are consumed exactly as
produced by the existing scoring pipeline — this file only changes the UI
and adds a decision/audit layer on top.
"""
from __future__ import annotations

import html
import re
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import duckdb
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import polars as pl
import streamlit as st

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_ROOT = REPO_ROOT / "outputs" / "pipeline_runs"
DB_PATH = REPO_ROOT / "data" / "entity_matching" / "external" / "entity_matching.db"
ENV_DEFAULT = REPO_ROOT / "env_variables.txt"

PIPELINE_STEPS = [
    (1, "Prepare Input", "Map worth columns, apply optional state filter, and create client input file.", 10),
    (2, "Build Matching Tables", "Load source data from Redshift and normalize/process candidate tables.", 90),
    (3, "Run Matching", "Score candidates by source and create final match tables/results.", 420),
    (4, "Export Outputs", "Export final output CSV and prepare report-ready artifacts.", 8),
]

# Source display metadata
SOURCES = ["equifax", "open_corporates", "zoominfo", "liberty"]
SOURCE_LABELS = {
    "equifax": "Equifax",
    "open_corporates": "OpenCorporates",
    "zoominfo": "ZoomInfo",
    "liberty": "Liberty",
}
SOURCE_CONF_COLS = {
    "equifax": "efx_confidence",
    "open_corporates": "oc_confidence",
    "zoominfo": "zi_confidence",
    "liberty": "liberty_confidence",
}
SOURCE_ID_COLS = {
    "equifax": ["efx_id"],
    "open_corporates": ["oc_company_number", "oc_jurisdiction_code"],
    "zoominfo": ["zi_c_company_id", "zi_c_location_id", "zi_es_location_id"],
    "liberty": ["liberty_id"],
}
SOURCE_COLORS = {
    "Equifax": "#2F6BFF",
    "OpenCorporates": "#F97316",
    "ZoomInfo": "#14B8A6",
    "Liberty": "#EAB308",
}
SOURCE_EMOJIS = {
    "Equifax": "🔵",
    "OpenCorporates": "🟠",
    "ZoomInfo": "🟢",
    "Liberty": "🟡",
}

CONF_COL_TO_SOURCE = {v: k for k, v in SOURCE_CONF_COLS.items()}

# Confidence band thresholds
CONF_BANDS = [
    (0.95, "Very High", "🟢"),
    (0.85, "High", "🟢"),
    (0.70, "Medium", "🟡"),
    (0.50, "Low", "🟠"),
    (0.0,  "Very Low", "🔴"),
]

# Review decision options
DECISION_OPTIONS = ["Unreviewed", "Approved", "Rejected", "Needs Review", "Escalated", "No Match"]
DECISION_COLORS = {
    "Unreviewed": "#9CA3AF",
    "Approved": "#10B981",
    "Rejected": "#EF4444",
    "Needs Review": "#F59E0B",
    "Escalated": "#8B5CF6",
    "No Match": "#6B7280",
}

LIBERTY_REDSHIFT_TABLES = [
    "dev.liberty.einmst_20260218",
    "dev.liberty.einmst_15_5mn",
    "dev.liberty.einmst_5_3m_remaining",
]

# ---------------------------------------------------------------------------
# CSS — enterprise card / badge / table styling
# ---------------------------------------------------------------------------
APP_CSS = """
<style>
/* ---- Base ---- */
[data-testid="stAppViewContainer"] { background: #F4F8FC; }
[data-testid="stSidebar"] { background: #0F172A; color: white; }
[data-testid="stSidebar"] * { color: white !important; }
[data-testid="stSidebar"] .stButton > button { background: #2F6BFF; border: none; color: white; border-radius: 8px; }
[data-testid="stSidebar"] .stTextInput > div > input,
[data-testid="stSidebar"] .stSelectbox > div { background: #1E293B; border: 1px solid #334E68; color: white; border-radius: 8px; }

/* ---- Metric cards ---- */
.em-metric-row { display: flex; gap: 14px; flex-wrap: wrap; margin: 10px 0 18px; }
.em-metric { background: white; border-radius: 14px; padding: 16px 20px; flex: 1 1 180px; min-width: 160px;
             box-shadow: 0 4px 14px rgba(15,23,42,0.07); border-left: 5px solid #2F6BFF; }
.em-metric.teal  { border-left-color: #14B8A6; }
.em-metric.orange{ border-left-color: #F97316; }
.em-metric.purple{ border-left-color: #8B5CF6; }
.em-metric.green { border-left-color: #10B981; }
.em-metric.red   { border-left-color: #EF4444; }
.em-metric.slate { border-left-color: #334E68; }
.em-metric .label{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #6B7280; }
.em-metric .value{ font-size: 26px; font-weight: 800; color: #0F172A; line-height: 1.1; margin: 6px 0 4px; }
.em-metric .sub  { font-size: 12px; color: #6B7280; }

/* ---- Source card ---- */
.src-card { background: white; border-radius: 16px; padding: 18px 20px; margin: 8px 0;
            box-shadow: 0 4px 16px rgba(15,23,42,0.07); border-top: 4px solid #E5E7EB; }
.src-card.efx  { border-top-color: #2F6BFF; }
.src-card.oc   { border-top-color: #F97316; }
.src-card.zi   { border-top-color: #14B8A6; }
.src-card.lib  { border-top-color: #EAB308; }
.src-card h4   { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #0F172A; }
.src-card .cand-name { font-size: 20px; font-weight: 700; color: #1D4ED8; margin: 6px 0; }
.src-card .conf-score { font-size: 28px; font-weight: 800; color: #0F172A; }
.src-card .band { font-size: 13px; color: #6B7280; margin-top: 2px; }
.src-card .no-candidate { color: #9CA3AF; font-style: italic; font-size: 14px; }

/* ---- Badge ---- */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
         border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge-green  { background: #D1FAE5; color: #065F46; }
.badge-yellow { background: #FEF3C7; color: #92400E; }
.badge-orange { background: #FFEDD5; color: #9A3412; }
.badge-red    { background: #FEE2E2; color: #991B1B; }
.badge-blue   { background: #DBEAFE; color: #1E40AF; }
.badge-purple { background: #EDE9FE; color: #5B21B6; }
.badge-gray   { background: #F3F4F6; color: #374151; }

/* ---- Reason code chips ---- */
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.chip-match    { background: #D1FAE5; color: #065F46; }
.chip-fuzzy    { background: #FEF9C3; color: #92400E; }
.chip-conflict { background: #FEE2E2; color: #991B1B; }
.chip-missing  { background: #F3F4F6; color: #6B7280; }

/* ---- Risk flags ---- */
.flag { padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 700;
        display: inline-block; margin: 3px 4px 3px 0; }
.flag-high   { background: #FEE2E2; color: #991B1B; }
.flag-medium { background: #FEF3C7; color: #92400E; }
.flag-low    { background: #FEF9C3; color: #6B7280; }

/* ---- Field comparison table ---- */
.fc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.fc-table th { background: #EFF6FF; padding: 8px 12px; text-align: left; font-weight: 700; color: #1E3A5F; }
.fc-table td { padding: 8px 12px; border-bottom: 1px solid #E5E7EB; vertical-align: top; }
.fc-table tr:nth-child(even) td { background: #F9FAFB; }
.fc-match    { color: #065F46; font-weight: 700; }
.fc-fuzzy    { color: #92400E; font-weight: 700; }
.fc-conflict { color: #991B1B; font-weight: 700; }
.fc-missing  { color: #9CA3AF; font-style: italic; }

/* ---- Consensus banner ---- */
.consensus-banner { border-radius: 16px; padding: 16px 22px; margin: 12px 0; font-size: 15px; font-weight: 700; }
.consensus-full     { background: #D1FAE5; color: #065F46; border-left: 6px solid #10B981; }
.consensus-partial  { background: #DBEAFE; color: #1E3A5F; border-left: 6px solid #2F6BFF; }
.consensus-weak     { background: #FEF3C7; color: #78350F; border-left: 6px solid #F59E0B; }
.consensus-conflict { background: #FEE2E2; color: #7F1D1D; border-left: 6px solid #EF4444; }
.consensus-none     { background: #F3F4F6; color: #374151; border-left: 6px solid #9CA3AF; }

/* ---- Decision panel ---- */
.decision-panel { background: white; border-radius: 16px; padding: 20px 24px; margin: 12px 0;
                  box-shadow: 0 4px 16px rgba(15,23,42,0.07); border: 2px solid #E5E7EB; }
.decision-title { font-size: 18px; font-weight: 800; margin-bottom: 12px; color: #0F172A; }

/* ---- Audit timeline ---- */
.audit-item { display: flex; gap: 12px; margin-bottom: 12px; padding-bottom: 12px;
              border-bottom: 1px solid #E5E7EB; }
.audit-dot  { width: 10px; height: 10px; border-radius: 50%; background: #2F6BFF; margin-top: 5px; flex-shrink: 0; }
.audit-dot.green  { background: #10B981; }
.audit-dot.red    { background: #EF4444; }
.audit-dot.orange { background: #F59E0B; }
.audit-dot.purple { background: #8B5CF6; }
.audit-body { flex: 1; }
.audit-body .at-action { font-weight: 700; font-size: 14px; }
.audit-body .at-detail { font-size: 13px; color: #6B7280; margin-top: 2px; }
.audit-body .at-time   { font-size: 11px; color: #9CA3AF; margin-top: 2px; }

/* ---- Queue table ---- */
.queue-status { padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-block; }

/* ---- Explanation bar ---- */
.expl-row { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
.expl-label { width: 160px; font-size: 12px; color: #374151; flex-shrink: 0; }
.expl-bar-bg { flex: 1; background: #E5E7EB; border-radius: 999px; height: 10px; }
.expl-bar-fill { height: 10px; border-radius: 999px; background: #2F6BFF; }
.expl-val { width: 40px; text-align: right; font-size: 12px; font-weight: 700; color: #374151; }

/* ---- Section shell ---- */
.section-shell { background: rgba(255,255,255,0.85); border: 1px solid #E5E7EB; border-radius: 20px;
                 padding: 22px 24px; margin-bottom: 20px;
                 box-shadow: 0 6px 22px rgba(15,23,42,0.06); }
</style>
"""

# ---------------------------------------------------------------------------
# Helpers — text normalisation
# ---------------------------------------------------------------------------

def _norm_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).upper().strip()
    text = re.sub(r"[^A-Z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def _postal_norm(value: object) -> str:
    return re.sub(r"\s+", "", _norm_text(value))[:5]


def _token_jaccard(a: object, b: object) -> Optional[float]:
    ta = set(_norm_text(a).split())
    tb = set(_norm_text(b).split())
    if not ta and not tb:
        return None
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _exact_score(a: object, b: object) -> Optional[float]:
    na, nb = _norm_text(a), _norm_text(b)
    if not na and not nb:
        return None
    return 1.0 if na == nb else 0.0


def _normalize_id(value: object) -> Optional[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    text = str(value).strip()
    if text == "" or text.lower() in {"nan", "none"}:
        return None
    if re.fullmatch(r"\d+\.0", text):
        return text[:-2]
    return text


# ---------------------------------------------------------------------------
# Confidence helpers
# ---------------------------------------------------------------------------

def confidence_band(score: Optional[float]) -> tuple[str, str]:
    """Return (label, emoji) for a confidence score."""
    if score is None:
        return "No candidate", "⚫"
    for threshold, label, emoji in CONF_BANDS:
        if score >= threshold:
            return label, emoji
    return "Very Low", "🔴"


def sanitize_dataset_name(raw: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9_]", "_", raw).strip("_").lower()
    if not value:
        value = "entity_matching_run"
    if value[0].isdigit():
        value = f"d_{value}"
    return value


# ---------------------------------------------------------------------------
# Reason codes derivation
# ---------------------------------------------------------------------------

def derive_reason_codes(
    input_row: dict,
    source_row: pd.DataFrame,
    source_key: str,
) -> list[str]:
    """
    Derive human-readable reason codes comparing an input record against
    the best matched source candidate row.
    Returns a list of reason code strings.
    """
    codes: list[str] = []
    if source_row.empty:
        codes.append("SOURCE_NO_CANDIDATE")
        return codes

    sr = source_row.iloc[0].to_dict()

    conf_col = SOURCE_CONF_COLS.get(source_key)
    if conf_col:
        conf = _normalize_float(input_row.get(conf_col))
        if conf is not None:
            if conf >= 0.85:
                codes.append("SOURCE_HIGH_CONFIDENCE")
            elif conf < 0.50:
                codes.append("SOURCE_LOW_CONFIDENCE")

    # Name
    name_score = _token_jaccard(input_row.get("name") or input_row.get("lgl_nm_worth"), sr.get("business_name"))
    if name_score is not None:
        if name_score >= 0.9:
            codes.append("NAME_EXACT")
        elif name_score >= 0.6:
            codes.append("NAME_FUZZY_HIGH")
        elif name_score >= 0.3:
            codes.append("NAME_FUZZY_MEDIUM")
        else:
            codes.append("NAME_CONFLICT")

    # Address
    addr_score = _token_jaccard(
        input_row.get("address") or input_row.get("address_1_worth"),
        sr.get("street_address"),
    )
    if addr_score is not None:
        if addr_score >= 0.85:
            codes.append("ADDRESS_EXACT")
        elif addr_score >= 0.4:
            codes.append("ADDRESS_PARTIAL")
        else:
            codes.append("ADDRESS_CONFLICT")

    # City
    city_score = _exact_score(
        input_row.get("city") or input_row.get("city_worth"),
        sr.get("city"),
    )
    if city_score is not None:
        codes.append("CITY_MATCH" if city_score == 1.0 else "CITY_CONFLICT")

    # State/region
    region_score = _exact_score(
        input_row.get("region") or input_row.get("region_worth"),
        sr.get("region"),
    )
    if region_score is not None:
        codes.append("STATE_MATCH" if region_score == 1.0 else "STATE_CONFLICT")

    # Postal code
    postal_i = _postal_norm(input_row.get("postal_code") or input_row.get("zip_code_worth"))
    postal_s = _postal_norm(sr.get("postal_code"))
    if postal_i and postal_s:
        codes.append("POSTAL_MATCH" if postal_i == postal_s else "POSTAL_CONFLICT")

    # Data completeness
    data_fields = [sr.get(f) for f in ["business_name", "street_address", "city", "region", "postal_code"]]
    filled = sum(1 for f in data_fields if f and str(f).strip() not in {"", "nan", "None"})
    completeness = filled / max(len(data_fields), 1)
    if completeness < 0.4:
        codes.append("LOW_DATA_COMPLETENESS")

    return codes


def _normalize_float(v: object) -> Optional[float]:
    try:
        f = float(v)  # type: ignore[arg-type]
        return None if np.isnan(f) else f
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Consensus classification
# ---------------------------------------------------------------------------

def classify_consensus(source_confs: dict[str, Optional[float]]) -> tuple[str, str, str]:
    """
    Given {source_key: confidence_score | None}, classify consensus.
    Returns (status_label, css_class, recommended_action).
    """
    available = {k: v for k, v in source_confs.items() if v is not None}
    high_conf = {k: v for k, v in available.items() if v >= 0.70}
    strong = {k: v for k, v in available.items() if v >= 0.85}

    if not available:
        return "No Reliable Match", "consensus-none", "No Match Recommended"

    if len(strong) >= 3:
        return "Full Consensus", "consensus-full", "Auto-Approve Candidate"

    if len(high_conf) >= 2:
        # Check if spread is low (sources agree)
        vals = list(high_conf.values())
        spread = max(vals) - min(vals)
        if spread <= 0.15:
            return "Partial Consensus", "consensus-partial", "Analyst Review Recommended"
        return "Partial Consensus (Spread)", "consensus-partial", "Analyst Review Recommended"

    if len(high_conf) == 1:
        return "Weak Consensus", "consensus-weak", "Analyst Review Recommended"

    # Multiple sources available but low conf or large spread
    if len(available) >= 2:
        vals = list(available.values())
        spread = max(vals) - min(vals)
        if spread >= 0.30:
            return "Conflicting Results", "consensus-conflict", "Escalate Due to Conflict"

    return "No Reliable Match", "consensus-none", "No Match Recommended"


# ---------------------------------------------------------------------------
# Field comparison derivation
# ---------------------------------------------------------------------------

FIELD_MAP = [
    ("Legal Name", "name", "lgl_nm_worth", "business_name", "name"),
    ("Address Line 1", "address", "address_1_worth", "street_address", "address_1"),
    ("City", "city", "city_worth", "city", "city"),
    ("State / Region", "region", "region_worth", "region", "region"),
    ("ZIP / Postal", "postal_code", "zip_code_worth", "postal_code", "postal_code"),
    ("Country", "country", "country_worth", "country_code", "country"),
]


def build_field_comparison(input_row: dict, source_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build a DataFrame with columns:
    Field | Input Value | Source Value | Similarity | Status
    """
    rows = []
    sr = source_df.iloc[0].to_dict() if not source_df.empty else {}

    for label, input_key1, input_key2, src_key, _feat in FIELD_MAP:
        inp_val = input_row.get(input_key1) or input_row.get(input_key2)
        src_val = sr.get(src_key)
        inp_str = str(inp_val).strip() if inp_val and str(inp_val).lower() not in {"nan", "none"} else ""
        src_str = str(src_val).strip() if src_val and str(src_val).lower() not in {"nan", "none"} else ""

        if not inp_str and not src_str:
            sim = None
            status = "—"
        elif not inp_str or not src_str:
            sim = None
            status = "Missing"
        else:
            if label in ("Legal Name", "Address Line 1"):
                sim = _token_jaccard(inp_str, src_str)
            else:
                raw_exact = _exact_score(inp_str, src_str)
                sim = float(raw_exact) if raw_exact is not None else None

            if sim is None:
                status = "Missing"
            elif sim >= 0.85:
                status = "✅ Match"
            elif sim >= 0.4:
                status = "⚠️ Partial"
            else:
                status = "❌ Conflict"

        rows.append({
            "Field": label,
            "Input Value": inp_str or "—",
            "Source Value": src_str or "—",
            "Similarity": f"{sim:.2f}" if sim is not None else "—",
            "Status": status,
        })

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Feature analysis (reused from v1)
# ---------------------------------------------------------------------------

def _build_source_row_comparisons(df: pl.DataFrame) -> pd.DataFrame:
    if not DB_PATH.exists():
        return pd.DataFrame()

    needed = [
        "lookup_id", "name", "address", "address_2", "city", "region",
        "postal_code", "country",
        "efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence",
        "efx_id", "oc_company_number", "oc_jurisdiction_code",
        "zi_c_company_id", "zi_c_location_id", "zi_es_location_id", "liberty_id",
    ]
    available = [c for c in needed if c in df.columns]
    if len(available) < 10:
        return pd.DataFrame()

    pdf = df.select(available).to_pandas()
    id_cols = [
        "efx_id", "oc_company_number", "oc_jurisdiction_code",
        "zi_c_company_id", "zi_c_location_id", "zi_es_location_id", "liberty_id",
    ]
    for col in id_cols:
        if col in pdf.columns:
            pdf[col] = pdf[col].apply(_normalize_id)

    with duckdb.connect(str(DB_PATH)) as con:
        con.register("matched_rows", pdf)
        combined = con.execute("""
            SELECT 'equifax' AS source, m.lookup_id, m.efx_confidence AS source_confidence,
                m.name AS input_name, m.address AS input_address_1, m.address_2 AS input_address_2,
                m.city AS input_city, m.region AS input_region, m.postal_code AS input_postal_code,
                m.country AS input_country, s.business_name AS source_name,
                s.street_address AS source_street_address, s.city AS source_city,
                s.region AS source_region, s.postal_code AS source_postal_code,
                s.country_code AS source_country
            FROM matched_rows m
            LEFT JOIN (SELECT *, split_part(id,'|',1) AS efx_key FROM equifax_base) s
                ON s.efx_key = CAST(m.efx_id AS VARCHAR)
            WHERE m.efx_id IS NOT NULL
            UNION ALL
            SELECT 'open_corporates', m.lookup_id, m.oc_confidence,
                m.name, m.address, m.address_2, m.city, m.region, m.postal_code, m.country,
                s.business_name, s.street_address, s.city, s.region, s.postal_code, s.country_code
            FROM matched_rows m
            LEFT JOIN (
                SELECT *, split_part(id,'|',1) AS oc_company_key, split_part(id,'|',2) AS oc_jur_key
                FROM open_corporates_base
            ) s ON s.oc_company_key = CAST(m.oc_company_number AS VARCHAR)
               AND s.oc_jur_key = CAST(m.oc_jurisdiction_code AS VARCHAR)
            WHERE m.oc_company_number IS NOT NULL AND m.oc_jurisdiction_code IS NOT NULL
            UNION ALL
            SELECT 'zoominfo', m.lookup_id, m.zi_confidence,
                m.name, m.address, m.address_2, m.city, m.region, m.postal_code, m.country,
                s.business_name, s.street_address, s.city, s.region, s.postal_code, s.country_code
            FROM matched_rows m
            LEFT JOIN (
                SELECT *, split_part(id,'|',1) AS zi_company_key,
                    split_part(id,'|',2) AS zi_loc_key, split_part(id,'|',3) AS zi_es_key
                FROM zoominfo_base
            ) s ON s.zi_company_key = CAST(m.zi_c_company_id AS VARCHAR)
               AND s.zi_loc_key = CAST(m.zi_c_location_id AS VARCHAR)
               AND s.zi_es_key = CAST(m.zi_es_location_id AS VARCHAR)
            WHERE m.zi_c_company_id IS NOT NULL
              AND m.zi_c_location_id IS NOT NULL
              AND m.zi_es_location_id IS NOT NULL
            UNION ALL
            SELECT 'liberty', m.lookup_id, m.liberty_confidence,
                m.name, m.address, m.address_2, m.city, m.region, m.postal_code, m.country,
                s.business_name, s.street_address, s.city, s.region, s.postal_code, s.country_code
            FROM matched_rows m
            LEFT JOIN (SELECT *, split_part(id,'|',1) AS liberty_key FROM liberty_base) s
                ON s.liberty_key = CAST(m.liberty_id AS VARCHAR)
            WHERE m.liberty_id IS NOT NULL
        """).df()
    return combined


def compute_source_coverage(df: pl.DataFrame) -> pd.DataFrame:
    total = df.height
    if total == 0:
        return pd.DataFrame()

    stats = df.select(
        pl.col("efx_confidence").is_not_null().sum().alias("efx_found"),
        pl.col("oc_confidence").is_not_null().sum().alias("oc_found"),
        pl.col("zi_confidence").is_not_null().sum().alias("zi_found"),
        pl.col("liberty_confidence").is_not_null().sum().alias("liberty_found"),
        (pl.col("efx_confidence").is_not_null() | pl.col("oc_confidence").is_not_null() |
         pl.col("zi_confidence").is_not_null() | pl.col("liberty_confidence").is_not_null()
        ).sum().alias("any_found"),
        (pl.col("efx_confidence") >= 0.8).fill_null(False).sum().alias("efx_high"),
        (pl.col("oc_confidence") >= 0.8).fill_null(False).sum().alias("oc_high"),
        (pl.col("zi_confidence") >= 0.8).fill_null(False).sum().alias("zi_high"),
        (pl.col("liberty_confidence") >= 0.8).fill_null(False).sum().alias("liberty_high"),
        ((pl.col("efx_confidence") >= 0.8).fill_null(False) |
         (pl.col("oc_confidence") >= 0.8).fill_null(False) |
         (pl.col("zi_confidence") >= 0.8).fill_null(False) |
         (pl.col("liberty_confidence") >= 0.8).fill_null(False)
        ).sum().alias("any_high"),
    ).to_dicts()[0]

    recs = []
    for src_key, label in SOURCE_LABELS.items():
        short = _src_short(src_key)
        found = int(stats[f"{short}_found"])
        high = int(stats[f"{short}_high"])
        recs.append({
            "source": src_key,
            "label": label,
            "found_records": found,
            "coverage_pct": 100.0 * found / total,
            "high_conf_records": high,
            "high_conf_pct_of_input": 100.0 * high / total,
            "high_conf_pct_of_found": (100.0 * high / found) if found else 0.0,
        })

    out = pd.DataFrame(recs)
    any_found = int(stats["any_found"])
    any_high = int(stats["any_high"])
    any_row = pd.DataFrame([{
        "source": "any_source", "label": "Any Source",
        "found_records": any_found, "coverage_pct": 100.0 * any_found / total,
        "high_conf_records": any_high, "high_conf_pct_of_input": 100.0 * any_high / total,
        "high_conf_pct_of_found": (100.0 * any_high / any_found) if any_found else 0.0,
    }])
    return pd.concat([out, any_row], ignore_index=True)


def _src_short(src_key: str) -> str:
    return {"equifax": "efx", "open_corporates": "oc", "zoominfo": "zi", "liberty": "liberty"}[src_key]


def compute_source_feature_analysis(df: pl.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    rows = _build_source_row_comparisons(df)
    if rows.empty:
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    r = rows.copy()

    def _norm(col: pd.Series) -> pd.Series:
        return (col.fillna("").str.upper().str.strip()
                .str.replace(r"[^A-Z0-9\s]", " ", regex=True)
                .str.replace(r"\s+", " ", regex=True).str.strip())

    def _token_set(s: pd.Series) -> list[set]:
        return [set(v.split()) if v else set() for v in s]

    def _jaccard_sets(a_sets: list[set], b_sets: list[set]) -> np.ndarray:
        out = np.full(len(a_sets), np.nan)
        for i, (a, b) in enumerate(zip(a_sets, b_sets)):
            if not a and not b:
                continue
            if not a or not b:
                out[i] = 0.0
                continue
            out[i] = len(a & b) / len(a | b)
        return out

    def _exact(a: pd.Series, b: pd.Series) -> np.ndarray:
        na, nb = _norm(a), _norm(b)
        return np.where(na == "", np.nan, np.where(na == nb, 1.0, 0.0)).astype(float)

    def _postal(s: pd.Series) -> pd.Series:
        return _norm(s).str.replace(r"\s+", "", regex=True).str[:5]

    a_name_sets  = _token_set(_norm(r.get("input_name", pd.Series(dtype=str))))
    s_name_sets  = _token_set(_norm(r.get("source_name", pd.Series(dtype=str))))
    a_addr1_sets = _token_set(_norm(r.get("input_address_1", pd.Series(dtype=str))))
    s_addr1_sets = _token_set(_norm(r.get("source_street_address", pd.Series(dtype=str))))

    r["feat_name"]      = _jaccard_sets(a_name_sets, s_name_sets)
    r["feat_address_1"] = _jaccard_sets(a_addr1_sets, s_addr1_sets)
    r["feat_city"]      = _exact(r.get("input_city", pd.Series(dtype=str)), r.get("source_city", pd.Series(dtype=str)))
    r["feat_region"]    = _exact(r.get("input_region", pd.Series(dtype=str)), r.get("source_region", pd.Series(dtype=str)))
    r["feat_postal_code"] = np.where(
        _postal(r.get("input_postal_code", pd.Series(dtype=str))) == "", np.nan,
        np.where(
            _postal(r.get("input_postal_code", pd.Series(dtype=str))) ==
            _postal(r.get("source_postal_code", pd.Series(dtype=str))),
            1.0, 0.0
        )
    ).astype(float)
    r["feat_country"] = _exact(r.get("input_country", pd.Series(dtype=str)), r.get("source_country", pd.Series(dtype=str)))

    feat_cols = ["feat_name", "feat_address_1", "feat_city", "feat_region", "feat_postal_code", "feat_country"]
    r["overall_feature_score"] = r[feat_cols].mean(axis=1, skipna=True)

    conf = pd.to_numeric(r["source_confidence"], errors="coerce")
    for fc in feat_cols:
        r[f"w_{fc}"] = r[fc] * conf

    feat_name_map = {
        "feat_name": "name", "feat_address_1": "address_1", "feat_city": "city",
        "feat_region": "region", "feat_postal_code": "postal_code", "feat_country": "country",
    }
    long_parts = []
    for fc, label in feat_name_map.items():
        part = r[["source", "lookup_id", "source_confidence", "overall_feature_score", fc, f"w_{fc}"]].copy()
        part = part.rename(columns={fc: "feature_score", f"w_{fc}": "weighted_feature_score"})
        part["feature"] = label
        long_parts.append(part)

    feat_df = pd.concat(long_parts, ignore_index=True)
    summary = (
        feat_df.groupby(["source", "feature"], dropna=False)
        .agg(avg_feature_score=("feature_score", "mean"),
             avg_weighted_feature_score=("weighted_feature_score", "mean"),
             rows=("lookup_id", "nunique"))
        .reset_index()
    )
    overall_agg = (
        feat_df.groupby("source", dropna=False)
        .agg(matched_rows=("lookup_id", "nunique"),
             avg_source_confidence=("source_confidence", "mean"),
             avg_feature_score=("feature_score", "mean"),
             avg_weighted_feature_score=("weighted_feature_score", "mean"),
             avg_overall_feature_score=("overall_feature_score", "mean"))
        .reset_index()
        .sort_values(["avg_weighted_feature_score", "avg_source_confidence"], ascending=False)
    )
    return feat_df, summary, overall_agg


def build_source_recommendations(feature_summary: pd.DataFrame, feature_overall: pd.DataFrame) -> tuple[str, pd.DataFrame]:
    if feature_summary.empty or feature_overall.empty:
        return "Not enough matched rows to produce recommendations.", pd.DataFrame()
    best_overall = feature_overall.iloc[0]
    per_feature = (
        feature_summary
        .sort_values(["feature", "avg_weighted_feature_score", "avg_feature_score"], ascending=[True, False, False])
        .groupby("feature", as_index=False).first()
        [["feature", "source", "avg_feature_score", "avg_weighted_feature_score"]]
    )
    sentence = (
        f"Best overall source is {SOURCE_LABELS.get(best_overall['source'], best_overall['source'])} "
        f"(weighted feature score {best_overall['avg_weighted_feature_score']:.3f})."
    )
    return sentence, per_feature


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def latest_result_file(dataset_name: str) -> Optional[Path]:
    candidates = sorted(OUTPUT_ROOT.glob(f"{dataset_name}_results_*.csv"))
    return candidates[-1] if candidates else None


def load_analysis_table(dataset_name: str, result_csv: Path) -> pl.DataFrame:
    results = pl.read_csv(result_csv)
    enriched_input = (
        REPO_ROOT / "data" / "entity_matching" / "raw" / "clients"
        / f"{dataset_name}_input_enriched.csv"
    )
    if enriched_input.exists():
        inp = pl.read_csv(enriched_input)
        merged = inp.join(results, on=["lookup_id", "external_id"], how="left")
    else:
        merged = results

    for col in ["efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence"]:
        if col not in merged.columns:
            merged = merged.with_columns(pl.lit(None).cast(pl.Float64).alias(col))

    merged = merged.with_columns([
        pl.col(col).cast(pl.Float64, strict=False).alias(col)
        for col in ["efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence"]
    ])

    merged = merged.with_columns(
        pl.max_horizontal("efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence")
        .alias("best_confidence")
    )
    merged = merged.with_columns(
        pl.when(pl.col("best_confidence").is_null()).then(pl.lit("none"))
        .when(pl.col("efx_confidence") == pl.col("best_confidence")).then(pl.lit("equifax"))
        .when(pl.col("oc_confidence") == pl.col("best_confidence")).then(pl.lit("open_corporates"))
        .when(pl.col("zi_confidence") == pl.col("best_confidence")).then(pl.lit("zoominfo"))
        .when(pl.col("liberty_confidence") == pl.col("best_confidence")).then(pl.lit("liberty"))
        .otherwise(pl.lit("none"))
        .alias("best_source")
    )
    return merged


@st.cache_data(show_spinner=False)
def compute_analysis_artifacts(dataset_name: str, result_csv_path: str):
    result_csv = Path(result_csv_path)
    df = load_analysis_table(dataset_name, result_csv)
    feat_rows, feat_summary, feat_overall = compute_source_feature_analysis(df)
    coverage_df = compute_source_coverage(df)
    recommendation_text, recommendation_table = build_source_recommendations(feat_summary, feat_overall)
    return df, feat_rows, feat_summary, feat_overall, coverage_df, recommendation_text, recommendation_table


def source_record_details(dataset_name: str, lookup_id: str, row: dict) -> dict[str, pd.DataFrame]:
    out: dict[str, pd.DataFrame] = {}
    if not DB_PATH.exists():
        return out

    efx_id = _normalize_id(row.get("efx_id"))
    oc_company_number = _normalize_id(row.get("oc_company_number"))
    oc_jurisdiction_code = _normalize_id(row.get("oc_jurisdiction_code"))
    zi_c_company_id = _normalize_id(row.get("zi_c_company_id"))
    zi_c_location_id = _normalize_id(row.get("zi_c_location_id"))
    zi_es_location_id = _normalize_id(row.get("zi_es_location_id"))
    liberty_id = _normalize_id(row.get("liberty_id"))

    with duckdb.connect(str(DB_PATH)) as con:
        try:
            out["input_base"] = con.execute(
                f"SELECT * FROM {dataset_name}_base WHERE id = '{lookup_id}' LIMIT 1"
            ).df()
        except Exception:
            out["input_base"] = pd.DataFrame()

        def _safe_query(q: str) -> pd.DataFrame:
            try:
                return con.execute(q).df()
            except Exception:
                return pd.DataFrame()

        out["equifax"] = _safe_query(
            f"SELECT * FROM equifax_base WHERE id LIKE '{efx_id}|%' LIMIT 1"
        ) if efx_id else pd.DataFrame()

        out["open_corporates"] = _safe_query(
            f"SELECT * FROM open_corporates_base WHERE id LIKE '{oc_company_number}|{oc_jurisdiction_code}|%' LIMIT 1"
        ) if oc_company_number and oc_jurisdiction_code else pd.DataFrame()

        out["zoominfo"] = _safe_query(
            f"SELECT * FROM zoominfo_base WHERE id LIKE '{zi_c_company_id}|{zi_c_location_id}|{zi_es_location_id}|%' LIMIT 1"
        ) if zi_c_company_id and zi_c_location_id and zi_es_location_id else pd.DataFrame()

        out["liberty"] = _safe_query(
            f"SELECT * FROM liberty_base WHERE id LIKE '{liberty_id}|%' LIMIT 1"
        ) if liberty_id else pd.DataFrame()

    return out


# ---------------------------------------------------------------------------
# Pipeline execution helpers
# ---------------------------------------------------------------------------

def prepare_uploaded_input(uploaded_file, upload_dir: Path) -> Path:
    upload_dir.mkdir(parents=True, exist_ok=True)
    original_path = upload_dir / uploaded_file.name
    original_path.write_bytes(uploaded_file.getbuffer())
    suffix = original_path.suffix.lower()
    if suffix == ".csv":
        return original_path
    if suffix == ".xlsx":
        converted_path = original_path.with_suffix(".csv")
        try:
            excel_df = pd.read_excel(original_path)
        except Exception as exc:
            raise ValueError("Could not read Excel file.") from exc
        excel_df.to_csv(converted_path, index=False)
        return converted_path
    raise ValueError("Unsupported file format. Please upload .csv or .xlsx")


def _render_pipeline_progress(steps_ph, eta_ph, progress_bar, current_step, step_starts, step_ends, run_start_ts, finished=False, failed=False):
    now = time.time()
    lines = []
    max_step = len(PIPELINE_STEPS)
    for step_id, title, desc, est_sec in PIPELINE_STEPS:
        if finished and step_id <= current_step:
            state_text = "✅ DONE"
        elif failed and step_id == current_step:
            state_text = "❌ FAILED"
        elif step_id < current_step:
            state_text = "✅ DONE"
        elif step_id == current_step and not finished:
            state_text = "⏳ RUNNING"
        else:
            state_text = "⬜ PENDING"
        elapsed = 0
        if step_id in step_starts:
            end_ts = step_ends.get(step_id, now)
            elapsed = int(max(end_ts - step_starts[step_id], 0))
        lines.append(f"- [{state_text}] Step {step_id}: {title}\n  Description: {desc}\n  Elapsed: {elapsed}s | Estimated: ~{est_sec}s")
    steps_ph.markdown("\n".join(lines))
    if finished:
        progress_bar.progress(1.0)
        eta_ph.caption("Estimated remaining: 0s")
        return
    if current_step <= 0:
        progress_bar.progress(0.01)
        eta_ph.caption(f"Estimated remaining: ~{sum(s[3] for s in PIPELINE_STEPS)}s")
        return
    current_est = PIPELINE_STEPS[current_step - 1][3]
    current_elapsed = now - step_starts.get(current_step, run_start_ts)
    current_frac = min(current_elapsed / max(current_est, 1), 0.95)
    overall = ((current_step - 1) + current_frac) / max_step
    progress_bar.progress(float(min(max(overall, 0.01), 0.99 if not finished else 1.0)))
    remaining = max(current_est - current_elapsed, 0)
    for step_id, _t, _d, est_sec in PIPELINE_STEPS:
        if step_id > current_step:
            remaining += est_sec
    eta_ph.caption(f"Estimated remaining: ~{int(remaining)}s")


def run_two_step_pipeline_live(input_path, dataset_name, env_file, state, steps_ph, eta_ph, progress_bar):
    cmd = [
        sys.executable, "-u", "-m",
        "entity_matching.core.matchers.run_worth_two_step",
        "--input-csv", str(input_path.relative_to(REPO_ROOT)),
        "--env-file", str(env_file.relative_to(REPO_ROOT)),
        "--dataset-name", dataset_name,
    ]
    if state:
        cmd.extend(["--state", state])
    logs: list[str] = []
    run_start_ts = time.time()
    step_starts: dict[int, float] = {}
    step_ends: dict[int, float] = {}
    current_step = 1
    step_starts[current_step] = run_start_ts
    _render_pipeline_progress(steps_ph, eta_ph, progress_bar, current_step, step_starts, step_ends, run_start_ts)
    proc = subprocess.Popen(cmd, cwd=str(REPO_ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    assert proc.stdout is not None
    for raw_line in proc.stdout:
        line = raw_line.rstrip("\n")
        logs.append(line)
        marker = re.search(r"\[(\d)\s*/\s*4\]", line)
        if marker:
            parsed = int(marker.group(1))
            if 1 <= parsed <= 4:
                if parsed > current_step:
                    for completed in range(current_step, parsed):
                        step_ends.setdefault(completed, time.time())
                current_step = parsed
                step_starts.setdefault(current_step, time.time())
        _render_pipeline_progress(steps_ph, eta_ph, progress_bar, current_step, step_starts, step_ends, run_start_ts)
    return_code = proc.wait()
    ok = return_code == 0
    if ok:
        for step_id, *_ in PIPELINE_STEPS:
            if step_id in step_starts:
                step_ends.setdefault(step_id, time.time())
    else:
        step_ends.setdefault(current_step, time.time())
    _render_pipeline_progress(steps_ph, eta_ph, progress_bar, 4 if ok else current_step, step_starts, step_ends, run_start_ts, finished=ok, failed=not ok)
    output = "$ " + " ".join(cmd) + "\n\n" + "\n".join(logs)
    return ok, output


# ---------------------------------------------------------------------------
# Session-state helpers for review decisions and audit trail
# ---------------------------------------------------------------------------

def _ensure_review_state() -> None:
    if "decisions" not in st.session_state:
        st.session_state["decisions"] = {}  # {lookup_id: {decision, reviewer, note, source, timestamp}}
    if "audit_trail" not in st.session_state:
        st.session_state["audit_trail"] = []  # list of audit event dicts


def _record_audit(lookup_id: str, action: str, detail: str, tone: str = "blue") -> None:
    st.session_state["audit_trail"].append({
        "id": str(uuid.uuid4())[:8],
        "lookup_id": lookup_id,
        "action": action,
        "detail": detail,
        "tone": tone,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    })


def _get_decision(lookup_id: str) -> dict:
    return st.session_state["decisions"].get(lookup_id, {"decision": "Unreviewed", "reviewer": "", "note": "", "source": "", "timestamp": ""})


# ---------------------------------------------------------------------------
# UI component renderers
# ---------------------------------------------------------------------------

def render_metric_row(metrics: list[tuple[str, str, str, str]]) -> None:
    """Render a horizontal row of metric cards.
    Each item: (label, value, subtitle, color_class)
    """
    cards_html = "".join(
        f'<div class="em-metric {cls}"><div class="label">{html.escape(label)}</div>'
        f'<div class="value">{html.escape(value)}</div>'
        f'<div class="sub">{html.escape(sub)}</div></div>'
        for label, value, sub, cls in metrics
    )
    st.markdown(f'<div class="em-metric-row">{cards_html}</div>', unsafe_allow_html=True)


def render_confidence_badge(score: Optional[float]) -> str:
    band, emoji = confidence_band(score)
    if score is None:
        return f'<span class="badge badge-gray">{emoji} No Match</span>'
    if score >= 0.85:
        cls = "badge-green"
    elif score >= 0.70:
        cls = "badge-yellow"
    elif score >= 0.50:
        cls = "badge-orange"
    else:
        cls = "badge-red"
    return f'<span class="badge {cls}">{emoji} {score:.2f} — {html.escape(band)}</span>'


def render_decision_badge(decision: str) -> str:
    color = DECISION_COLORS.get(decision, "#9CA3AF")
    cls_map = {
        "Approved": "badge-green", "Rejected": "badge-red",
        "Needs Review": "badge-yellow", "Escalated": "badge-purple",
        "No Match": "badge-gray", "Unreviewed": "badge-gray",
    }
    cls = cls_map.get(decision, "badge-gray")
    return f'<span class="badge {cls}">{html.escape(decision)}</span>'


def render_reason_codes(codes: list[str]) -> None:
    if not codes:
        return
    chips = []
    for code in codes:
        if "EXACT" in code or "MATCH" in code or "HIGH_CONFIDENCE" in code:
            css = "chip-match"
        elif "FUZZY" in code or "PARTIAL" in code:
            css = "chip-fuzzy"
        elif "CONFLICT" in code:
            css = "chip-conflict"
        else:
            css = "chip-missing"
        chips.append(f'<span class="chip {css}">{html.escape(code)}</span>')
    st.markdown(f'<div class="chip-row">{"".join(chips)}</div>', unsafe_allow_html=True)


def render_source_card(
    source_key: str,
    conf: Optional[float],
    input_row: dict,
    src_df: pd.DataFrame,
    codes: list[str],
    expanded: bool = False,
) -> None:
    label = SOURCE_LABELS[source_key]
    emoji = SOURCE_EMOJIS[label]
    css_suffix = {"equifax": "efx", "open_corporates": "oc", "zoominfo": "zi", "liberty": "lib"}[source_key]
    band, band_emoji = confidence_band(conf)
    badge_html = render_confidence_badge(conf)

    candidate_name = "—"
    if not src_df.empty:
        candidate_name = str(src_df.iloc[0].get("business_name", "—") or "—")

    header = (
        f'<div class="src-card {css_suffix}">'
        f'<h4>{emoji} {html.escape(label)}</h4>'
        f'<div class="cand-name">{html.escape(candidate_name)}</div>'
        f'<div class="conf-score">{f"{conf:.3f}" if conf is not None else "—"}</div>'
        f'<div class="band">{badge_html}</div>'
        f'</div>'
    )
    st.markdown(header, unsafe_allow_html=True)
    render_reason_codes(codes)

    with st.expander(f"Detail: {label}", expanded=expanded):
        if src_df.empty:
            st.markdown('<div class="fc-missing" style="padding:8px">No candidate found in source database.</div>', unsafe_allow_html=True)
        else:
            fc_df = build_field_comparison(input_row, src_df)
            render_field_comparison_table(fc_df)
            st.dataframe(src_df, use_container_width=True)


def render_field_comparison_table(fc_df: pd.DataFrame) -> None:
    if fc_df.empty:
        return

    def _status_html(status: str) -> str:
        if "Match" in status:
            return f'<td class="fc-match">{html.escape(status)}</td>'
        elif "Partial" in status:
            return f'<td class="fc-fuzzy">{html.escape(status)}</td>'
        elif "Conflict" in status:
            return f'<td class="fc-conflict">{html.escape(status)}</td>'
        elif status == "Missing":
            return f'<td class="fc-missing">{html.escape(status)}</td>'
        return f'<td>{html.escape(status)}</td>'

    rows_html = "".join(
        f"<tr><td>{html.escape(str(r['Field']))}</td>"
        f"<td>{html.escape(str(r['Input Value']))}</td>"
        f"<td>{html.escape(str(r['Source Value']))}</td>"
        f"<td>{html.escape(str(r['Similarity']))}</td>"
        f"{_status_html(str(r['Status']))}</tr>"
        for _, r in fc_df.iterrows()
    )
    table_html = (
        '<table class="fc-table">'
        "<thead><tr><th>Field</th><th>Input Value</th><th>Source Value</th>"
        "<th>Similarity</th><th>Status</th></tr></thead>"
        f"<tbody>{rows_html}</tbody></table>"
    )
    st.markdown(table_html, unsafe_allow_html=True)


def render_consensus_banner(consensus_status: str, css_class: str, recommended_action: str, max_conf: Optional[float], avg_conf: Optional[float]) -> None:
    max_str = f"{max_conf:.3f}" if max_conf is not None else "—"
    avg_str = f"{avg_conf:.3f}" if avg_conf is not None else "—"
    st.markdown(
        f'<div class="consensus-banner {css_class}">'
        f'📊 Consensus: <strong>{html.escape(consensus_status)}</strong> &nbsp;|&nbsp; '
        f'Recommended Action: <strong>{html.escape(recommended_action)}</strong> &nbsp;|&nbsp; '
        f'Max Confidence: {max_str} &nbsp;|&nbsp; Avg Confidence: {avg_str}'
        f'</div>',
        unsafe_allow_html=True,
    )


def render_explainability_bars(conf: Optional[float], codes: list[str], feat_scores: dict[str, float]) -> None:
    """Render a lightweight explainability panel with feature contribution bars."""
    st.markdown("**XGBoost Confidence Explainability**")
    if conf is None:
        st.markdown('<div class="fc-missing" style="padding:8px">No confidence score available.</div>', unsafe_allow_html=True)
        return

    band, emoji = confidence_band(conf)
    st.markdown(f"Confidence: **{conf:.3f}** — {emoji} **{band}**")

    # Natural-language explanation derived from reason codes
    sentences = []
    for code in codes:
        mapping = {
            "NAME_EXACT": "Business name is an exact match.",
            "NAME_FUZZY_HIGH": "Business name is a strong fuzzy match.",
            "NAME_FUZZY_MEDIUM": "Business name partially aligns.",
            "NAME_CONFLICT": "Business name does not align.",
            "ADDRESS_EXACT": "Address is an exact match.",
            "ADDRESS_PARTIAL": "Address partially matches.",
            "ADDRESS_CONFLICT": "Address conflicts between input and source.",
            "CITY_MATCH": "City is an exact match.",
            "CITY_CONFLICT": "City differs between input and source.",
            "STATE_MATCH": "State / region aligns.",
            "STATE_CONFLICT": "State / region conflicts.",
            "POSTAL_MATCH": "ZIP code is an exact match.",
            "POSTAL_CONFLICT": "ZIP code conflicts.",
            "SOURCE_HIGH_CONFIDENCE": "Model confidence is strong for this source.",
            "SOURCE_LOW_CONFIDENCE": "Model confidence is low for this source.",
            "LOW_DATA_COMPLETENESS": "Source record has limited data completeness.",
            "SOURCE_NO_CANDIDATE": "No candidate was found in this source.",
        }
        if code in mapping:
            sentences.append(mapping[code])

    if sentences:
        st.markdown("**Evidence summary:**")
        for s in sentences:
            st.markdown(f"- {s}")

    # Feature contribution bars (derived from feature scores)
    if feat_scores:
        st.markdown("**Feature contribution (proxy from field similarity × confidence):**")
        bars = []
        for feat, score in sorted(feat_scores.items(), key=lambda x: -x[1] if not np.isnan(x[1]) else -999):
            if np.isnan(score):
                continue
            weighted = score * conf
            bars.append((feat, score, weighted))

        if bars:
            bar_html = "".join(
                f'<div class="expl-row">'
                f'<div class="expl-label">{html.escape(feat)}</div>'
                f'<div class="expl-bar-bg"><div class="expl-bar-fill" style="width:{int(weighted*100)}%"></div></div>'
                f'<div class="expl-val">{weighted:.2f}</div>'
                f'</div>'
                for feat, score, weighted in bars
            )
            st.markdown(bar_html, unsafe_allow_html=True)

    # Placeholder for future SHAP integration
    with st.expander("⚙️ SHAP integration (future)", expanded=False):
        st.info(
            "When SHAP values are available from the XGBoost model, per-feature SHAP contributions "
            "will appear here, replacing these proxy scores with precise attribution values."
        )


def render_decision_panel(lookup_id: str) -> None:
    """Render the analyst review decision panel for a single entity."""
    _ensure_review_state()
    current = _get_decision(lookup_id)

    st.markdown('<div class="decision-panel">', unsafe_allow_html=True)
    st.markdown('<div class="decision-title">📋 Analyst Review Decision</div>', unsafe_allow_html=True)

    dec_col1, dec_col2, dec_col3 = st.columns([2, 2, 2])
    with dec_col1:
        decision = st.selectbox(
            "Decision",
            options=DECISION_OPTIONS,
            index=DECISION_OPTIONS.index(current["decision"]) if current["decision"] in DECISION_OPTIONS else 0,
            key=f"decision_{lookup_id}",
        )
    with dec_col2:
        reviewer = st.text_input("Reviewer name", value=current.get("reviewer", ""), key=f"reviewer_{lookup_id}")
    with dec_col3:
        winning_source = st.selectbox(
            "Winning source (if applicable)",
            options=[""] + list(SOURCE_LABELS.values()),
            index=0,
            key=f"winning_src_{lookup_id}",
        )

    note = st.text_area(
        "Review notes (optional)",
        value=current.get("note", ""),
        height=80,
        key=f"note_{lookup_id}",
    )

    if st.button("Save Decision", key=f"save_decision_{lookup_id}", use_container_width=True):
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        old_decision = current.get("decision", "Unreviewed")
        st.session_state["decisions"][lookup_id] = {
            "decision": decision,
            "reviewer": reviewer,
            "note": note,
            "source": winning_source,
            "timestamp": ts,
        }
        tone_map = {
            "Approved": "green", "Rejected": "red",
            "Escalated": "purple", "Needs Review": "orange",
        }
        tone = tone_map.get(decision, "blue")
        _record_audit(
            lookup_id,
            f"Decision → {decision}",
            f"Changed from '{old_decision}' by {reviewer or 'anonymous'}. Note: {note or '—'}. Winning source: {winning_source or '—'}.",
            tone=tone,
        )
        st.success(f"Decision saved: {decision}")

    st.markdown("</div>", unsafe_allow_html=True)


def render_audit_trail(lookup_id: Optional[str] = None) -> None:
    """Render the audit trail, filtered by lookup_id if provided."""
    _ensure_review_state()
    trail = st.session_state.get("audit_trail", [])
    if lookup_id:
        trail = [e for e in trail if e["lookup_id"] == lookup_id]

    if not trail:
        st.markdown('<div class="fc-missing" style="padding:10px">No audit events recorded yet.</div>', unsafe_allow_html=True)
        return

    tone_cls = {"green": "green", "red": "red", "orange": "orange", "purple": "purple", "blue": ""}
    items_html = "".join(
        f'<div class="audit-item">'
        f'<div class="audit-dot {tone_cls.get(e["tone"], "")}"></div>'
        f'<div class="audit-body">'
        f'<div class="at-action">{html.escape(e["action"])}</div>'
        f'<div class="at-detail">Entity: {html.escape(e["lookup_id"])} — {html.escape(e["detail"])}</div>'
        f'<div class="at-time">{html.escape(e["timestamp"])}</div>'
        f'</div></div>'
        for e in reversed(trail)
    )
    st.markdown(items_html, unsafe_allow_html=True)


# ---------------------------------------------------------------------------
# Queue builder
# ---------------------------------------------------------------------------

def build_queue_df(df: pl.DataFrame) -> pd.DataFrame:
    _ensure_review_state()
    pdf = df.select([
        c for c in [
            "lookup_id", "external_id", "name", "lgl_nm_worth",
            "efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence",
            "efx_id", "oc_company_number", "zi_c_company_id", "liberty_id",
            "best_source", "best_confidence", "region_worth", "city_worth",
        ] if c in df.columns
    ]).to_pandas()

    conf_cols = [c for c in ["efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence"] if c in pdf.columns]
    pdf["sources_matched"] = pdf[conf_cols].notna().sum(axis=1)
    pdf["best_conf_display"] = pdf["best_confidence"].apply(lambda v: f"{v:.3f}" if pd.notna(v) else "—")
    pdf["best_source_label"] = pdf["best_source"].map(lambda v: SOURCE_LABELS.get(str(v), str(v)))

    conf_df = pdf[conf_cols].copy()
    source_confs_list = [
        {CONF_COL_TO_SOURCE.get(c, c): _normalize_float(row.get(c)) for c in conf_cols}
        for _, row in pdf.iterrows()
    ]
    pdf["consensus_status"] = [classify_consensus(sc)[0] for sc in source_confs_list]
    pdf["recommended_action"] = [classify_consensus(sc)[2] for sc in source_confs_list]

    # Confidence spread
    pdf["conf_spread"] = conf_df.max(axis=1) - conf_df.min(axis=1)
    pdf["has_conflict"] = pdf["conf_spread"] >= 0.30

    # Decision status from session state
    decisions = st.session_state.get("decisions", {})
    pdf["decision"] = pdf["lookup_id"].map(
        lambda lid: decisions.get(lid, {}).get("decision", "Unreviewed")
    )
    pdf["reviewed_by"] = pdf["lookup_id"].map(
        lambda lid: decisions.get(lid, {}).get("reviewer", "")
    )
    pdf["reviewed_at"] = pdf["lookup_id"].map(
        lambda lid: decisions.get(lid, {}).get("timestamp", "")
    )

    entity_name_col = next((c for c in ["name", "lgl_nm_worth"] if c in pdf.columns), None)
    pdf["entity_name"] = pdf[entity_name_col].fillna("—") if entity_name_col else "—"

    display_cols = [
        "lookup_id", "entity_name", "sources_matched", "best_conf_display",
        "best_source_label", "consensus_status", "conf_spread",
        "has_conflict", "decision", "reviewed_by", "reviewed_at",
    ]
    return pdf[[c for c in display_cols if c in pdf.columns]].rename(columns={
        "lookup_id": "Entity ID",
        "entity_name": "Entity Name",
        "sources_matched": "Sources Matched",
        "best_conf_display": "Best Confidence",
        "best_source_label": "Top Source",
        "consensus_status": "Consensus",
        "conf_spread": "Conf Spread",
        "has_conflict": "⚡ Conflict",
        "decision": "Decision",
        "reviewed_by": "Reviewed By",
        "reviewed_at": "Reviewed At",
    })


# ---------------------------------------------------------------------------
# Summary / operational dashboard helpers
# ---------------------------------------------------------------------------

def render_operational_dashboard(df: pl.DataFrame, coverage_df: pd.DataFrame, feat_overall: pd.DataFrame) -> None:
    _ensure_review_state()
    pdf = df.to_pandas()
    total = len(pdf)
    decisions = st.session_state.get("decisions", {})

    decision_counts = {d: 0 for d in DECISION_OPTIONS}
    for lid in pdf.get("lookup_id", pd.Series(dtype=str)):
        d = decisions.get(str(lid), {}).get("decision", "Unreviewed")
        decision_counts[d] = decision_counts.get(d, 0) + 1

    conf_cols = [c for c in ["efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence"] if c in pdf.columns]
    any_high = int((pdf[conf_cols].max(axis=1) >= 0.80).sum()) if conf_cols else 0
    any_none = int(pdf[conf_cols].isna().all(axis=1).sum()) if conf_cols else 0
    avg_best = float(pdf[conf_cols].max(axis=1).mean()) if conf_cols else 0.0
    avg_sources = float(pdf[conf_cols].notna().sum(axis=1).mean()) if conf_cols else 0.0

    source_confs_list = [
        {CONF_COL_TO_SOURCE.get(c, c): _normalize_float(row.get(c)) for c in conf_cols}
        for _, row in pdf.iterrows()
    ]
    consensus_labels = [classify_consensus(sc)[0] for sc in source_confs_list]
    consensus_series = pd.Series(consensus_labels)
    conflict_rate = float((consensus_series == "Conflicting Results").mean())
    full_consensus_rate = float((consensus_series == "Full Consensus").mean())

    render_metric_row([
        ("Total Records", f"{total:,}", "", ""),
        ("Any Source ≥ 0.80", f"{any_high:,}", f"{100*any_high/max(total,1):.1f}% of input", "teal"),
        ("No Candidate", f"{any_none:,}", f"{100*any_none/max(total,1):.1f}% of input", "orange"),
        ("Avg Best Confidence", f"{avg_best:.3f}", "", "slate"),
        ("Avg Sources / Record", f"{avg_sources:.1f}", "", ""),
        ("Full Consensus Rate", f"{full_consensus_rate:.1%}", "", "green"),
        ("Conflict Rate", f"{conflict_rate:.1%}", "", "red"),
    ])

    # Decision status breakdown
    dec_col1, dec_col2 = st.columns([1, 1])
    with dec_col1:
        st.markdown("**Review Status Distribution**")
        dec_df = pd.DataFrame({
            "Status": list(decision_counts.keys()),
            "Count": list(decision_counts.values()),
        })
        fig_dec = px.bar(
            dec_df, x="Status", y="Count", color="Status",
            color_discrete_map={d: DECISION_COLORS.get(d, "#9CA3AF") for d in DECISION_OPTIONS},
            title="Record Decision Status",
        )
        fig_dec.update_layout(showlegend=False, height=320)
        st.plotly_chart(fig_dec, use_container_width=True)

    with dec_col2:
        st.markdown("**Consensus Status Distribution**")
        cons_df = consensus_series.value_counts().reset_index()
        cons_df.columns = ["Consensus", "Count"]
        fig_cons = px.pie(cons_df, names="Consensus", values="Count", title="Consensus Distribution",
                          color_discrete_sequence=px.colors.qualitative.Set3)
        fig_cons.update_layout(height=320)
        st.plotly_chart(fig_cons, use_container_width=True)

    # Source win chart  
    if "best_source" in df.columns:
        win_pdf = df.to_pandas()
        win_counts = (
            win_pdf[win_pdf["best_source"] != "none"]["best_source"]
            .value_counts().reset_index()
        )
        win_counts.columns = ["source", "wins"]
        win_counts["source_label"] = win_counts["source"].map(lambda v: SOURCE_LABELS.get(v, v))
        fig_win = px.bar(
            win_counts, x="source_label", y="wins",
            color="source_label",
            color_discrete_map={v: SOURCE_COLORS.get(v, "#9CA3AF") for v in SOURCE_COLORS},
            title="Source Win Count (Best Source per Record)",
        )
        fig_win.update_layout(showlegend=False, height=300)
        st.plotly_chart(fig_win, use_container_width=True)

    # Confidence histogram (all sources overlaid)
    long_df = pdf.melt(
        id_vars=["lookup_id"],
        value_vars=[c for c in conf_cols if c in pdf.columns],
        var_name="source_col", value_name="confidence",
    ).dropna()
    long_df["source"] = long_df["source_col"].map(
        lambda v: SOURCE_LABELS.get(CONF_COL_TO_SOURCE.get(v, v), v)
    )
    if not long_df.empty:
        fig_hist = px.histogram(
            long_df, x="confidence", color="source", nbins=30, barmode="overlay",
            color_discrete_map=SOURCE_COLORS, title="Confidence Distribution by Source",
        )
        fig_hist.update_traces(opacity=0.72)
        st.plotly_chart(fig_hist, use_container_width=True)

    # Coverage and feature analysis tables
    if not coverage_df.empty:
        cov_main = coverage_df[coverage_df["source"] != "any_source"].copy()
        fig_cov = px.bar(
            cov_main, x="label", y=["coverage_pct", "high_conf_pct_of_input"],
            barmode="group", title="Source Coverage & High-Confidence Rate",
        )
        st.plotly_chart(fig_cov, use_container_width=True)

    if not feat_overall.empty:
        feat_display = feat_overall.copy()
        feat_display["source_label"] = feat_display["source"].map(lambda v: SOURCE_LABELS.get(v, v))
        fig_feat = px.bar(
            feat_display, x="source_label",
            y=["avg_source_confidence", "avg_feature_score", "avg_weighted_feature_score"],
            barmode="group", title="Overall Source Feature Performance",
            color_discrete_sequence=["#2F6BFF", "#14B8A6", "#F97316"],
        )
        st.plotly_chart(fig_feat, use_container_width=True)


# ---------------------------------------------------------------------------
# Investigation view — full entity detail page
# ---------------------------------------------------------------------------

def render_investigation_view(
    lookup_id: str,
    row: dict,
    details: dict[str, pd.DataFrame],
    feat_rows: pd.DataFrame,
    df: pl.DataFrame,
) -> None:
    _ensure_review_state()
    _record_audit(lookup_id, "Record Opened", f"Analyst opened investigation view.", tone="blue")

    # --- A. Input entity summary card ---
    st.markdown("### 🏢 Input Entity Summary")
    name_val = row.get("name") or row.get("lgl_nm_worth") or "—"
    addr_val = row.get("address") or row.get("address_1_worth") or "—"
    city_val = row.get("city") or row.get("city_worth") or "—"
    region_val = row.get("region") or row.get("region_worth") or "—"
    zip_val = row.get("postal_code") or row.get("zip_code_worth") or "—"

    sum_col1, sum_col2, sum_col3 = st.columns([2, 2, 2])
    sum_col1.metric("Entity Name", str(name_val))
    sum_col2.metric("Entity ID", str(lookup_id))
    sum_col3.metric("Location", f"{city_val}, {region_val} {zip_val}")

    current_dec = _get_decision(lookup_id)
    dec_badge = render_decision_badge(current_dec["decision"])
    st.markdown(f"**Current Decision:** {dec_badge}", unsafe_allow_html=True)

    source_confs = {
        src_key: _normalize_float(row.get(conf_col))
        for src_key, conf_col in SOURCE_CONF_COLS.items()
    }
    consensus_status, consensus_css, recommended_action = classify_consensus(source_confs)
    valid_confs = [v for v in source_confs.values() if v is not None]
    max_conf = max(valid_confs) if valid_confs else None
    avg_conf = float(np.mean(valid_confs)) if valid_confs else None

    # --- B. Consensus banner ---
    render_consensus_banner(consensus_status, consensus_css, recommended_action, max_conf, avg_conf)

    # --- C & D. Multi-source candidate comparison panel ---
    st.markdown("### 🔍 Multi-Source Candidate Comparison")

    src_keys_present = [k for k, c in SOURCE_CONF_COLS.items() if row.get(c) is not None]
    if not src_keys_present:
        st.warning("No source candidates were found for this record.")
    else:
        src_cols = st.columns(min(len(SOURCES), 4))
        for col_idx, src_key in enumerate(SOURCES):
            conf = source_confs.get(src_key)
            src_df = details.get(src_key, pd.DataFrame())
            codes = derive_reason_codes(row, src_df, src_key)
            with src_cols[col_idx]:
                render_source_card(src_key, conf, row, src_df, codes)

    # --- E. Source-specific explainability tabs ---
    st.markdown("### 🧠 Source Explainability & Evidence")

    # Fetch feature scores from feat_rows for this lookup_id
    def _feat_scores_for(src_key: str) -> dict[str, float]:
        if feat_rows.empty:
            return {}
        subset = feat_rows[(feat_rows["lookup_id"] == lookup_id) & (feat_rows["source"] == src_key)]
        if subset.empty:
            return {}
        return dict(zip(subset["feature"].tolist(), subset["feature_score"].tolist()))

    src_tabs = st.tabs([SOURCE_LABELS[k] for k in SOURCES])
    for tab, src_key in zip(src_tabs, SOURCES):
        with tab:
            conf = source_confs.get(src_key)
            src_df = details.get(src_key, pd.DataFrame())
            codes = derive_reason_codes(row, src_df, src_key)
            feat_scores = _feat_scores_for(src_key)
            render_explainability_bars(conf, codes, feat_scores)

            st.markdown("**Field Comparison**")
            fc_df = build_field_comparison(row, src_df)
            render_field_comparison_table(fc_df)

    # --- F. Cross-source comparison view ---
    st.markdown("### ⚖️ Cross-Source Comparison Summary")
    cross_rows = []
    for src_key in SOURCES:
        conf = source_confs.get(src_key)
        src_df = details.get(src_key, pd.DataFrame())
        cand_name = "—"
        if not src_df.empty:
            cand_name = str(src_df.iloc[0].get("business_name", "—") or "—")
        codes = derive_reason_codes(row, src_df, src_key)
        band, band_emoji = confidence_band(conf)
        cross_rows.append({
            "Source": SOURCE_LABELS[src_key],
            "Candidate Name": cand_name,
            "Confidence": f"{conf:.3f}" if conf is not None else "—",
            "Band": f"{band_emoji} {band}",
            "Reason Codes": ", ".join(codes) if codes else "—",
            "Has Candidate": "✅" if conf is not None else "❌",
        })

    cross_df = pd.DataFrame(cross_rows)
    st.dataframe(cross_df, use_container_width=True)

    # Agreement / disagreement summary
    sources_with_candidates = [r["Source"] for r in cross_rows if r["Has Candidate"] == "✅"]
    agreeing_names: dict[str, list[str]] = {}
    for r in cross_rows:
        if r["Candidate Name"] != "—":
            key = _norm_text(r["Candidate Name"])[:20]
            agreeing_names.setdefault(key, []).append(r["Source"])

    most_common_candidate = max(agreeing_names.items(), key=lambda x: len(x[1])) if agreeing_names else None

    agreement_col1, agreement_col2 = st.columns(2)
    with agreement_col1:
        render_metric_row([
            ("Sources with Candidate", str(len(sources_with_candidates)), f"out of {len(SOURCES)}", "teal"),
            ("Consensus Status", consensus_status, recommended_action, ""),
        ])
    with agreement_col2:
        if most_common_candidate:
            agreeing_list = ", ".join(most_common_candidate[1])
            render_metric_row([
                ("Most Common Candidate", most_common_candidate[0][:30], f"Supported by: {agreeing_list}", "green"),
            ])
        if valid_confs:
            spread = max(valid_confs) - min(valid_confs)
            render_metric_row([
                ("Confidence Spread", f"{spread:.3f}", "max - min across sources", "orange" if spread >= 0.30 else ""),
            ])

    # --- G. Review decision panel ---
    st.markdown("### 📋 Review Decision")
    render_decision_panel(lookup_id)

    # --- H. Audit trail ---
    st.markdown("### 📜 Audit Trail")
    render_audit_trail(lookup_id=lookup_id)


# ---------------------------------------------------------------------------
# Consensus Level 2 — Industry Classification
# ---------------------------------------------------------------------------
# These functions live in the Industry-Classification repo at
# AI-Powered-NAICS-Industry-Classification-Agent/.  We locate that repo
# relative to Entity-Matching and add it to sys.path on first call.
# If the repo is not present the tab degrades gracefully.

def _industry_repo_path() -> Optional[Path]:
    """Return the path to the Industry-Classification app directory, or None."""
    candidates = [
        REPO_ROOT.parent / "Industry-Classification" / "AI-Powered-NAICS-Industry-Classification-Agent",
        REPO_ROOT.parent / "industry-classification" / "AI-Powered-NAICS-Industry-Classification-Agent",
        Path.home() / "Industry-Classification" / "AI-Powered-NAICS-Industry-Classification-Agent",
    ]
    for p in candidates:
        if (p / "consensus_engine.py").exists():
            return p
    return None


@st.cache_resource(show_spinner="Loading industry classification models …")
def _load_industry_models():
    """Load Consensus engine, risk engine, entity resolver once per session."""
    repo = _industry_repo_path()
    if repo is None:
        return None, None, None, None
    if str(repo) not in sys.path:
        sys.path.insert(0, str(repo))
    try:
        from taxonomy_engine import TaxonomyEngine
        from consensus_engine import IndustryConsensusEngine
        from risk_engine import RiskEngine
        from entity_resolver import EntityResolver
        te = TaxonomyEngine()
        ce = IndustryConsensusEngine(taxonomy_engine=te)
        re = RiskEngine(taxonomy_engine=te)
        er = EntityResolver()
        return ce, re, er, te
    except Exception as exc:
        st.warning(f"Could not load industry models: {exc}")
        return None, None, None, None


@st.cache_resource(show_spinner=False)
def _load_data_simulator():
    repo = _industry_repo_path()
    if repo is None:
        return None
    if str(repo) not in sys.path:
        sys.path.insert(0, str(repo))
    try:
        from data_simulator import DataSimulator
        return DataSimulator()
    except Exception:
        return None


_IND_TAXONOMY_MAP = {
    "gb": "UK SIC 2007", "gg": "UK SIC 2007", "je": "UK SIC 2007",
    "de": "NACE Rev.2", "fr": "NACE Rev.2", "it": "NACE Rev.2",
    "es": "NACE Rev.2", "nl": "NACE Rev.2", "pl": "NACE Rev.2", "be": "NACE Rev.2",
}
_IND_HIGH_RISK = {"5511", "5221", "5222", "5239", "4236", "9281"}
_IND_KYB_C = {"APPROVE": "#10B981", "REVIEW": "#2F6BFF", "ESCALATE": "#F59E0B", "REJECT": "#EF4444"}


def _industry_taxonomy(jc: str) -> str:
    j = str(jc or "").lower().strip()
    if j in _IND_TAXONOMY_MAP or j.startswith("gb_"):
        return _IND_TAXONOMY_MAP.get(j, "UK SIC 2007")
    if j in ("us", "ca", "au") or j.startswith("us_") or j.startswith("ca_"):
        return "US NAICS 2022"
    if j in _IND_TAXONOMY_MAP:
        return _IND_TAXONOMY_MAP[j]
    return "ISIC Rev.4"


def classify_company_industry(
    name: str,
    address: str,
    jurisdiction: str,
    efx_conf: float,
    oc_conf: float,
    zi_conf: float,
    liberty_conf: float,
) -> dict:
    """
    Run Consensus Level 2 XGBoost classification for a single company.
    Returns a dict of classification results.
    """
    ce, re, er, te = _load_industry_models()
    sim = _load_data_simulator()
    if ce is None or sim is None:
        return {"error": "Industry classification models not available."}
    try:
        entity = er.resolve(name, address, "")
        jc = str(jurisdiction or entity.jurisdiction_code or "us").lower()
        bundle = sim.fetch(
            company_name=name, address=address, country="",
            jurisdiction=jc, entity_type="Operating", web_summary="",
        )
        cons = ce.predict(bundle)
        risk = re.evaluate(bundle, cons)
        p1   = cons.primary_industry
        sec  = cons.secondary_industries[:2]
        taxonomy = _industry_taxonomy(jc)
        flags = [s.flag for s in risk.signals]
        return {
            "taxonomy":        taxonomy,
            "naics_1":         p1.code,
            "label_1":         p1.label,
            "prob_1":          round(p1.consensus_probability, 4),
            "naics_2":         sec[0].code  if sec        else "",
            "label_2":         sec[0].label if sec        else "",
            "prob_2":          round(sec[0].consensus_probability, 4) if sec else 0.0,
            "naics_3":         sec[1].code  if len(sec) > 1 else "",
            "label_3":         sec[1].label if len(sec) > 1 else "",
            "prob_3":          round(sec[1].consensus_probability, 4) if len(sec) > 1 else 0.0,
            "risk_score":      round(risk.overall_risk_score, 4),
            "kyb":             risk.kyb_recommendation,
            "flags":           flags,
            "jurisdiction":    jc,
            "prod_naics":      zi_conf > efx_conf and None,   # placeholder — prod rule
            "oc_industry":     "",   # will be enriched below if OC uid available
        }
    except Exception as exc:
        return {"error": str(exc)[:120]}


def _run_batch_industry(df: pl.DataFrame) -> pd.DataFrame:
    """Classify all rows in df; returns a DataFrame with classification columns."""
    ce, re, er, te = _load_industry_models()
    sim = _load_data_simulator()

    name_col = next((c for c in ["lgl_nm_worth", "name", "business_name"] if c in df.columns), None)
    addr_col = next((c for c in ["address_1_worth", "address", "street_address"] if c in df.columns), None)
    jc_col   = next((c for c in ["oc_jurisdiction_code", "region_worth", "country_worth"] if c in df.columns), None)

    rows = []
    for row in df.to_pandas().itertuples(index=False):
        name    = str(getattr(row, name_col, "") or "") if name_col else ""
        address = str(getattr(row, addr_col, "") or "") if addr_col else ""
        jc_raw  = str(getattr(row, jc_col, "") or "") if jc_col else ""
        efx_c   = float(getattr(row, "efx_confidence", 0) or 0)
        oc_c    = float(getattr(row, "oc_confidence",  0) or 0)
        zi_c    = float(getattr(row, "zi_confidence",  0) or 0)
        lib_c   = float(getattr(row, "liberty_confidence", 0) or 0)
        if not name.strip():
            rows.append({})
            continue
        r = classify_company_industry(name, address, jc_raw, efx_c, oc_c, zi_c, lib_c)
        r["_name"] = name
        r["_lookup_id"] = str(getattr(row, "lookup_id", ""))
        # Production rule (ZI vs EFX — what customer_table.sql does)
        r["prod_winner"] = "zoominfo" if zi_c > efx_c else "equifax"
        r["prod_winner_conf"] = round(max(zi_c, efx_c), 4)
        rows.append(r)
    return pd.DataFrame(rows)


def render_industry_tab(df: pl.DataFrame) -> None:
    """Render the 🏭 Industry Classification tab content."""
    st.subheader("Consensus Level 2 — Industry Classification")
    st.markdown("""
This tab adds **Consensus XGBoost industry classification** on top of the entity matching results.

It uses the **same Level 1 confidence scores** already produced by the entity matching pipeline
(`efx_confidence`, `oc_confidence`, `zi_confidence`, `liberty_confidence`) as input features
for the Consensus XGBoost model (Level 2).

| | Production rule (`customer_table.sql`) | Consensus Level 2 XGBoost |
|---|---|---|
| Sources compared | ZoomInfo vs Equifax only | All 4: OC + EFX + ZI + Liberty |
| Output | 1 NAICS — no probability | Top-3 codes with calibrated probability |
| UK SIC | Received from OC — silently dropped | Primary output for GB companies |
| AML signals | 0 — never produced | 6 signal types |
| KYB recommendation | None | APPROVE / REVIEW / ESCALATE / REJECT |
""")

    repo = _industry_repo_path()
    if repo is None:
        st.warning(
            "Industry classification models not found. "
            "Clone `wecsleyprates-design/Industry-Classification` next to this repo and restart.",
            icon="⚠️",
        )
        return

    n = df.height
    if n == 0:
        st.info("No records to classify.")
        return

    # ── Run classification ────────────────────────────────────────────────────
    cache_key = f"industry_results_{n}"
    if cache_key not in st.session_state:
        with st.spinner(f"Classifying {n} companies with Consensus Level 2 XGBoost …"):
            ind_df = _run_batch_industry(df)
        st.session_state[cache_key] = ind_df
        st.session_state["industry_df"] = ind_df
    else:
        ind_df = st.session_state[cache_key]

    if ind_df.empty or "error" in ind_df.columns and ind_df["error"].notna().all():
        st.error("Classification failed. Check that consensus_engine.py is available.")
        return

    valid = ind_df[ind_df.get("error", pd.Series(dtype=str)).isna()].copy() if "error" in ind_df.columns else ind_df.copy()
    n_v   = len(valid)

    # ── Summary metrics ───────────────────────────────────────────────────────
    kyb_counts = valid["kyb"].value_counts().to_dict() if "kyb" in valid.columns else {}
    avg_prob   = valid["prob_1"].mean() if "prob_1" in valid.columns else 0
    aml_any    = int((valid["flags"].apply(lambda x: len(x) > 0)).sum()) if "flags" in valid.columns else 0
    approve    = kyb_counts.get("APPROVE", 0)
    review     = kyb_counts.get("REVIEW", 0)
    esc_rej    = kyb_counts.get("ESCALATE", 0) + kyb_counts.get("REJECT", 0)
    oc_lib_best = 0
    if "oc_confidence" in df.columns and "zi_confidence" in df.columns and "efx_confidence" in df.columns:
        pdf_tmp = df.select(["oc_confidence","zi_confidence","efx_confidence"]).to_pandas().fillna(0)
        oc_lib_best = int((pdf_tmp["oc_confidence"] > pdf_tmp[["zi_confidence","efx_confidence"]].max(axis=1)).sum())

    mc1, mc2, mc3, mc4, mc5, mc6 = st.columns(6)
    mc1.metric("Classified", n_v)
    mc2.metric("Avg Probability", f"{avg_prob:.0%}")
    mc3.metric("APPROVE", approve)
    mc4.metric("REVIEW", review)
    mc5.metric("ESCALATE/REJECT", esc_rej)
    mc6.metric("AML Flagged", aml_any)

    if oc_lib_best > 0:
        st.warning(
            f"⚠️ **{oc_lib_best} companies** have a stronger OC match than ZoomInfo or Equifax — "
            f"but the production rule ignores OC's industry codes. Consensus uses all 4 sources.",
            icon="⚠️",
        )

    st.divider()

    # ── Charts ────────────────────────────────────────────────────────────────
    col_a, col_b = st.columns(2)
    with col_a:
        if "prob_1" in valid.columns:
            import plotly.graph_objects as go_local
            fig = go_local.Figure(go_local.Histogram(
                x=valid["prob_1"], nbinsx=20,
                marker_color="#10B981", opacity=0.85,
            ))
            fig.add_vline(x=0.70, line_dash="dash", line_color="white",
                         annotation_text="70% = HIGH confidence")
            fig.add_vline(x=0.40, line_dash="dash", line_color="#F59E0B",
                         annotation_text="40% = MEDIUM confidence")
            fig.update_layout(
                title="Consensus Probability Distribution<br><sub>Production has no equivalent</sub>",
                xaxis_title="Top-1 Probability", yaxis_title="Companies",
                template="plotly_dark", height=300, margin=dict(t=50,b=20),
            )
            st.plotly_chart(fig, use_container_width=True)

    with col_b:
        if "kyb" in valid.columns:
            kyb_order = ["APPROVE", "REVIEW", "ESCALATE", "REJECT"]
            kyb_vals  = [kyb_counts.get(k, 0) for k in kyb_order]
            fig2 = px.bar(
                x=kyb_order, y=kyb_vals, color=kyb_order,
                color_discrete_map=_IND_KYB_C,
                title="KYB Recommendation<br><sub>Production never produces this</sub>",
                template="plotly_dark", height=300,
                labels={"x": "Recommendation", "y": "Companies"},
            )
            fig2.update_layout(showlegend=False, margin=dict(t=50,b=20))
            st.plotly_chart(fig2, use_container_width=True)

    # ── Taxonomy distribution ─────────────────────────────────────────────────
    if "taxonomy" in valid.columns:
        tax_counts = valid["taxonomy"].value_counts().reset_index()
        tax_counts.columns = ["Taxonomy", "Count"]
        fig3 = px.pie(
            tax_counts, names="Taxonomy", values="Count",
            title="Primary Taxonomy by Jurisdiction<br><sub>Production always returns NAICS regardless of country</sub>",
            template="plotly_dark", height=280,
        )
        fig3.update_layout(margin=dict(t=50,b=10))
        st.plotly_chart(fig3, use_container_width=True)

    # ── AML signals ───────────────────────────────────────────────────────────
    if "flags" in valid.columns:
        from collections import Counter
        all_flags = [f for fl in valid["flags"] for f in (fl if isinstance(fl, list) else [])]
        if all_flags:
            st.markdown("#### AML Risk Signals")
            fc = Counter(all_flags).most_common()
            flag_df = pd.DataFrame(fc, columns=["Signal", "Count"])
            flag_df["% of Companies"] = (flag_df["Count"] / n_v * 100).round(1).astype(str) + "%"
            flag_df["Meaning"] = flag_df["Signal"].map({
                "HIGH_RISK_SECTOR":     "Code in AML-elevated NAICS (Holding 5511, Banking 5221, Dual-use 4236, Defence 9281)",
                "REGISTRY_DISCREPANCY": "Web presence diverges from OC registry — shell company signal",
                "STRUCTURE_CHANGE":     "Industry code changed across API calls — U-Turn fraud signal",
                "SOURCE_CONFLICT":      "Sources disagree on industry code",
                "TRULIOO_POLLUTION":    "Trulioo returned 4-digit SIC for 5-digit jurisdiction",
                "LOW_CONSENSUS_PROB":   "Model confidence < 40% — data ambiguous",
            }).fillna("")
            st.dataframe(flag_df, use_container_width=True, hide_index=True)
        else:
            st.success("No AML signals fired for this dataset.")

    # ── Per-company results table ─────────────────────────────────────────────
    st.markdown("#### All Companies — Industry Classification Results")
    st.caption(
        "Columns: `prod_winner` = ZoomInfo or Equifax (production rule) | "
        "`prod_winner_conf` = winning source confidence | "
        "`naics_1` = Consensus top-1 code | `prob_1` = calibrated probability | "
        "`kyb` = APPROVE/REVIEW/ESCALATE/REJECT (Consensus only)"
    )

    display_cols = [c for c in [
        "_lookup_id", "_name",
        "taxonomy", "naics_1", "label_1", "prob_1",
        "naics_2", "label_2",
        "naics_3", "label_3",
        "prod_winner", "prod_winner_conf",
        "risk_score", "kyb",
        "jurisdiction",
    ] if c in valid.columns]
    rename_map = {
        "_lookup_id":     "Entity ID",
        "_name":          "Company Name",
        "taxonomy":       "Taxonomy",
        "naics_1":        "Primary Code",
        "label_1":        "Primary Label",
        "prob_1":         "Probability",
        "naics_2":        "Secondary Code 1",
        "label_2":        "Secondary Label 1",
        "naics_3":        "Secondary Code 2",
        "label_3":        "Secondary Label 2",
        "prod_winner":    "Prod Winner",
        "prod_winner_conf": "Prod Conf",
        "risk_score":     "Risk Score",
        "kyb":            "KYB",
        "jurisdiction":   "Jurisdiction",
    }
    display_df = valid[display_cols].rename(columns=rename_map)
    if "Probability" in display_df.columns:
        display_df["Probability"] = display_df["Probability"].apply(
            lambda v: f"{v:.1%}" if pd.notna(v) else "—"
        )
    st.dataframe(display_df, use_container_width=True, hide_index=True)

    # ── Download ──────────────────────────────────────────────────────────────
    import io as _io
    buf = _io.BytesIO()
    display_df.to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    col_dl1, col_dl2 = st.columns(2)
    with col_dl1:
        st.download_button(
            "📥 Download Industry Results (Excel)", data=buf,
            file_name="industry_classification_results.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    with col_dl2:
        st.download_button(
            "📥 Download Industry Results (CSV)",
            data=display_df.to_csv(index=False),
            file_name="industry_classification_results.csv",
            mime="text/csv",
        )

    # ── Per-record deep-dive ──────────────────────────────────────────────────
    st.divider()
    st.markdown("#### Record Deep-Dive — Industry Classification")
    if "_name" in valid.columns:
        company_names = valid["_name"].fillna("").tolist()
        sel_name = st.selectbox("Select company", company_names, key="ind_select")
        sel_row  = valid[valid["_name"] == sel_name].iloc[0] if sel_name else None
        if sel_row is not None:
            c_l, c_r = st.columns(2)
            with c_l:
                kyb_val = str(sel_row.get("kyb", ""))
                bg_map  = {"APPROVE":"#065F46","REVIEW":"#1E3A5F",
                           "ESCALATE":"#78350F","REJECT":"#7F1D1D"}
                st.markdown(
                    f'<div style="background:{bg_map.get(kyb_val,"#374151")};'
                    f'padding:12px 18px;border-radius:8px;font-size:1.1em;'
                    f'font-weight:700;color:white;text-align:center;margin-bottom:12px">'
                    f'KYB: {kyb_val}</div>',
                    unsafe_allow_html=True,
                )
                details_l = [
                    ("Primary code",     str(sel_row.get("naics_1", ""))),
                    ("Primary label",    str(sel_row.get("label_1", ""))),
                    ("Probability",      f"{float(sel_row.get('prob_1', 0)):.1%}"),
                    ("Taxonomy",         str(sel_row.get("taxonomy", ""))),
                    ("Secondary 1",      f"{sel_row.get('naics_2','')} — {sel_row.get('label_2','')}"),
                    ("Secondary 2",      f"{sel_row.get('naics_3','')} — {sel_row.get('label_3','')}"),
                    ("Risk score",       f"{float(sel_row.get('risk_score', 0)):.3f}"),
                    ("Jurisdiction",     str(sel_row.get("jurisdiction", ""))),
                ]
                st.dataframe(pd.DataFrame(details_l, columns=["Field", "Value"]),
                             use_container_width=True, hide_index=True)
            with c_r:
                flags = sel_row.get("flags", [])
                if isinstance(flags, list) and flags:
                    st.markdown("**AML Signals Detected:**")
                    for flag in flags:
                        st.error(f"🚨 {flag}")
                else:
                    st.success("✅ No AML signals — clean profile")

                prod_win  = str(sel_row.get("prod_winner", ""))
                prod_conf = float(sel_row.get("prod_winner_conf", 0))
                prob      = float(sel_row.get("prob_1", 0))

                st.markdown("**Interpretation:**")
                interp = []
                interp.append(
                    f"Production rule used **{prod_win}** (conf {prod_conf:.3f}) — "
                    f"OC and Liberty industry codes were ignored by the rule."
                )
                if prob >= 0.70:
                    interp.append(f"✅ HIGH confidence ({prob:.0%}) — industry signals consistent across sources.")
                elif prob >= 0.40:
                    interp.append(f"🟡 MEDIUM confidence ({prob:.0%}) — review secondary codes.")
                else:
                    interp.append(f"🔴 LOW confidence ({prob:.0%}) — sources conflict. Manual review required.")
                if kyb_val in ("ESCALATE", "REJECT"):
                    interp.append(f"🚨 KYB **{kyb_val}** — immediate human review required.")
                elif kyb_val == "REVIEW":
                    interp.append("🟡 Routine analyst review recommended.")
                else:
                    interp.append("✅ No elevated risk — cleared for automation.")
                for line in interp:
                    st.markdown(f"- {line}")


# ---------------------------------------------------------------------------
# main()
# ---------------------------------------------------------------------------

def main() -> None:
    st.set_page_config(
        page_title="Entity Resolution Platform",
        layout="wide",
        page_icon="🔎",
        initial_sidebar_state="expanded",
    )
    st.markdown(APP_CSS, unsafe_allow_html=True)
    _ensure_review_state()

    if "is_running" not in st.session_state:
        st.session_state["is_running"] = False
    if "last_run_started_at" not in st.session_state:
        st.session_state["last_run_started_at"] = None

    # ---- Sidebar ----
    st.sidebar.markdown("## 🔎 Entity Resolution Platform")
    st.sidebar.markdown("---")

    with st.sidebar.expander("Liberty Source Lineage", expanded=False):
        st.sidebar.caption("Fetched during Step 2 from Redshift → `liberty_base` in local DuckDB.")
        for table_name in LIBERTY_REDSHIFT_TABLES:
            st.sidebar.markdown(f"- `{table_name}`")

    st.sidebar.header("Run Configuration")
    uploaded = st.sidebar.file_uploader("Input dataset (.csv or .xlsx)", type=["csv", "xlsx"])
    dataset_name_input = st.sidebar.text_input("Dataset name", value="amex_worth_final_cleaned_data_ui")
    state_filter = st.sidebar.text_input("State filter (optional)", value="")
    env_file = st.sidebar.text_input("Env file path", value=str(ENV_DEFAULT.relative_to(REPO_ROOT)))

    dataset_name = sanitize_dataset_name(dataset_name_input)
    state = state_filter.strip().upper() or None

    run_col1, run_col2 = st.sidebar.columns(2)
    run_clicked = run_col1.button("▶ Run", use_container_width=True)
    refresh_clicked = run_col2.button("⟳ Load", use_container_width=True)

    # ---- App header ----
    st.markdown(
        '<h1 style="margin-bottom:2px">🔎 Entity Resolution Platform</h1>'
        '<p style="color:#6B7280;margin-bottom:16px">Multi-source KYB / entity matching analyst workspace</p>',
        unsafe_allow_html=True,
    )

    # ---- Pipeline run ----
    if run_clicked:
        if uploaded is None:
            st.error("Upload a CSV or XLSX file first.")
        else:
            upload_dir = REPO_ROOT / "data" / "entity_matching" / "raw" / "uploads"
            try:
                input_path = prepare_uploaded_input(uploaded, upload_dir)
            except Exception as exc:
                st.error(str(exc))
                return

            st.session_state["is_running"] = True
            st.session_state["last_run_started_at"] = time.time()
            progress_bar = st.progress(0.01)
            steps_ph = st.empty()
            eta_ph = st.empty()

            with st.status("Running Entity Matching Pipeline...", expanded=True) as status:
                ok, logs = run_two_step_pipeline_live(
                    input_path=input_path,
                    dataset_name=dataset_name,
                    env_file=(REPO_ROOT / env_file).resolve(),
                    state=state,
                    steps_ph=steps_ph,
                    eta_ph=eta_ph,
                    progress_bar=progress_bar,
                )
                if ok:
                    status.update(label="Pipeline completed.", state="complete", expanded=False)
                else:
                    status.update(label="Pipeline failed.", state="error", expanded=True)

            st.session_state["is_running"] = False
            st.session_state["last_logs"] = logs
            st.session_state["dataset_name"] = dataset_name
            st.session_state["state"] = state
            st.session_state["last_run_ok"] = ok
            st.session_state["last_run_started_at"] = None

            if ok:
                st.success("Run finished. Results ready below.")
                _record_audit("system", "Pipeline Completed", f"Dataset: {dataset_name}", tone="green")
            else:
                st.error("Run failed. See logs for details.")

    if "last_logs" in st.session_state:
        with st.expander("Pipeline logs", expanded=not st.session_state.get("last_run_ok", False)):
            st.code(st.session_state["last_logs"], language="bash")

    current_dataset = st.session_state.get("dataset_name", dataset_name)
    current_state = st.session_state.get("state", state)

    # ---- Load results ----
    if not (refresh_clicked or run_clicked or latest_result_file(current_dataset)):
        st.info("Upload and run the pipeline, or switch to a dataset that already has results.")
        return

    result_csv = latest_result_file(current_dataset)
    if not result_csv:
        st.info("No result CSV found yet for this dataset name.")
        return

    try:
        (
            df, feat_rows, feat_summary, feat_overall,
            coverage_df, recommendation_text, recommendation_table,
        ) = compute_analysis_artifacts(current_dataset, str(result_csv))
    except duckdb.IOException:
        df = load_analysis_table(current_dataset, result_csv)
        feat_rows, feat_summary, feat_overall = pd.DataFrame(), pd.DataFrame(), pd.DataFrame()
        coverage_df = compute_source_coverage(df)
        recommendation_text, recommendation_table = build_source_recommendations(feat_summary, feat_overall)
        st.warning("Database temporarily locked — feature-level analysis will appear after lock is released.")

    # ---- Main tabs ----
    tab_queue, tab_investigate, tab_feature, tab_dashboard, tab_audit, tab_industry = st.tabs([
        "📋 Resolution Queue",
        "🔍 Investigation",
        "📊 Feature Analysis",
        "🏠 Dashboard",
        "📜 Audit Trail",
        "🏭 Industry Classification",
    ])

    # ==================================================================
    # TAB 1 — RESOLUTION QUEUE
    # ==================================================================
    with tab_queue:
        st.subheader("Entity Resolution Queue")
        st.caption("Each row is one input entity. Click an entity to investigate.")

        queue_df = build_queue_df(df)

        # Filters
        with st.expander("🔽 Filters", expanded=False):
            filter_cols = st.columns(4)
            with filter_cols[0]:
                flt_decision = st.multiselect("Decision", options=DECISION_OPTIONS, default=[])
            with filter_cols[1]:
                flt_consensus = st.multiselect(
                    "Consensus",
                    options=queue_df["Consensus"].unique().tolist()
                    if "Consensus" in queue_df.columns else [],
                    default=[],
                )
            with filter_cols[2]:
                flt_conflict = st.checkbox("Only conflict records", value=False)
            with filter_cols[3]:
                flt_search = st.text_input("Search entity name / ID", value="")

            flt_min_conf, flt_max_conf = st.slider(
                "Best Confidence range",
                min_value=0.0, max_value=1.0, value=(0.0, 1.0), step=0.01,
            )

        filtered = queue_df.copy()
        if flt_decision:
            filtered = filtered[filtered["Decision"].isin(flt_decision)]
        if flt_consensus:
            filtered = filtered[filtered["Consensus"].isin(flt_consensus)]
        if flt_conflict and "⚡ Conflict" in filtered.columns:
            filtered = filtered[filtered["⚡ Conflict"] == True]  # noqa: E712
        if flt_search:
            mask = (
                filtered["Entity Name"].str.contains(flt_search, case=False, na=False) |
                filtered["Entity ID"].str.contains(flt_search, case=False, na=False)
            )
            filtered = filtered[mask]
        if "Best Confidence" in filtered.columns:
            def _conf_in_range(v):
                try:
                    f = float(v)
                    return flt_min_conf <= f <= flt_max_conf
                except (ValueError, TypeError):
                    return True
            filtered = filtered[filtered["Best Confidence"].apply(_conf_in_range)]

        st.markdown(f"**{len(filtered):,} records** (of {len(queue_df):,} total)")
        st.dataframe(filtered, use_container_width=True, height=520)

        # Summary metrics for queue
        render_metric_row([
            ("Total in Queue", f"{len(queue_df):,}", "", ""),
            ("Filtered", f"{len(filtered):,}", "", "slate"),
            ("Unreviewed", f"{(queue_df['Decision'] == 'Unreviewed').sum():,}", "", "orange"),
            ("Approved", f"{(queue_df['Decision'] == 'Approved').sum():,}", "", "green"),
            ("Escalated", f"{(queue_df['Decision'] == 'Escalated').sum():,}", "", "purple"),
        ])

    # ==================================================================
    # TAB 2 — INVESTIGATION VIEW
    # ==================================================================
    with tab_investigate:
        st.subheader("Entity Investigation")
        st.caption("Select an entity from the queue to open its full investigation view.")

        options = df["lookup_id"].to_list()
        selected_lookup = st.selectbox("Select Entity ID (lookup_id)", options=options, key="investigation_select")

        selected_row = df.filter(pl.col("lookup_id") == selected_lookup).row(0, named=True)

        try:
            details = source_record_details(current_dataset, selected_lookup, selected_row)
        except duckdb.IOException:
            details = {k: pd.DataFrame() for k in ["input_base", "equifax", "open_corporates", "zoominfo", "liberty"]}
            st.warning("Database locked — source detail records unavailable right now.")

        render_investigation_view(selected_lookup, selected_row, details, feat_rows, df)

        # Next / Previous navigation
        idx = options.index(selected_lookup) if selected_lookup in options else 0
        nav_col1, nav_col2, nav_col3 = st.columns([1, 4, 1])
        with nav_col1:
            if idx > 0:
                if st.button("← Previous", key="nav_prev"):
                    st.session_state["investigation_select"] = options[idx - 1]
        with nav_col3:
            if idx < len(options) - 1:
                if st.button("Next →", key="nav_next"):
                    st.session_state["investigation_select"] = options[idx + 1]

    # ==================================================================
    # TAB 3 — FEATURE ANALYSIS
    # ==================================================================
    with tab_feature:
        st.subheader("Source Feature Analysis")
        st.caption("Field-level similarity and confidence-weighted quality across all sources.")

        with st.expander("How avg_weighted_feature_score is calculated", expanded=False):
            st.markdown(
                "For each matched row and feature:\n\n"
                "`weighted_feature_score = feature_score × source_confidence`\n\n"
                "Then at source level:\n\n"
                "`avg_weighted_feature_score = mean(weighted_feature_score)`"
            )

        st.markdown("#### Source Recommendation")
        st.info(recommendation_text)
        if not recommendation_table.empty:
            rec_display = recommendation_table.copy()
            rec_display["source"] = rec_display["source"].map(lambda v: SOURCE_LABELS.get(v, v))
            st.dataframe(rec_display, use_container_width=True)

        st.markdown("#### Source Coverage and Health")
        if coverage_df.empty:
            st.warning("Coverage analysis unavailable.")
        else:
            cov_main = coverage_df[coverage_df["source"] != "any_source"].copy()
            cov_any = coverage_df[coverage_df["source"] == "any_source"].copy()
            m1, m2, m3, m4 = st.columns(4)
            if not cov_any.empty:
                m1.metric("Any Source Coverage", f"{cov_any.iloc[0]['coverage_pct']:.1f}%")
                m2.metric("Any Source High-Conf (>=0.80)", f"{cov_any.iloc[0]['high_conf_pct_of_input']:.1f}%")
            best_cov = cov_main.sort_values("coverage_pct", ascending=False).iloc[0]
            healthiest = cov_main.sort_values("high_conf_pct_of_found", ascending=False).iloc[0]
            m3.metric("Best Coverage Source", f"{best_cov['label']} ({best_cov['coverage_pct']:.1f}%)")
            m4.metric("Healthiest Source", f"{healthiest['label']} ({healthiest['high_conf_pct_of_found']:.1f}%)")

            fig_cov = px.bar(
                cov_main, x="label", y=["coverage_pct", "high_conf_pct_of_input", "high_conf_pct_of_found"],
                barmode="group", title="Coverage and Health by Source",
                color_discrete_sequence=["#2F6BFF", "#14B8A6", "#F97316"],
            )
            st.plotly_chart(fig_cov, use_container_width=True)
            st.dataframe(coverage_df, use_container_width=True)

        if feat_summary.empty or feat_overall.empty:
            st.warning("Feature-level analysis unavailable.")
        else:
            heat_data = feat_summary.pivot(index="source", columns="feature", values="avg_feature_score").fillna(0)
            heat_weighted = feat_summary.pivot(index="source", columns="feature", values="avg_weighted_feature_score").fillna(0)

            h1, h2 = st.columns(2)
            with h1:
                fig_heat = px.imshow(heat_data, text_auto=".2f", color_continuous_scale="YlGnBu",
                                     zmin=0, zmax=1, title="Feature Score by Source")
                st.plotly_chart(fig_heat, use_container_width=True)
            with h2:
                fig_heat_w = px.imshow(heat_weighted, text_auto=".2f", color_continuous_scale="Oranges",
                                       zmin=0, zmax=1, title="Confidence-Weighted Feature Score")
                st.plotly_chart(fig_heat_w, use_container_width=True)

            feat_overall_display = feat_overall.copy()
            feat_overall_display["source"] = feat_overall_display["source"].map(lambda v: SOURCE_LABELS.get(v, v))
            fig_overall = px.bar(
                feat_overall_display, x="source",
                y=["avg_source_confidence", "avg_feature_score", "avg_weighted_feature_score"],
                barmode="group", title="Overall Source Performance",
            )
            st.plotly_chart(fig_overall, use_container_width=True)

            st.markdown("#### Feature Summary Table")
            feat_summary_display = feat_summary.copy()
            feat_summary_display["source"] = feat_summary_display["source"].map(lambda v: SOURCE_LABELS.get(v, v))
            st.dataframe(feat_summary_display.sort_values(["source", "feature"]).reset_index(drop=True), use_container_width=True)

            st.markdown("#### Per-Match Feature Details")
            feat_rows_display = feat_rows.copy()
            if not feat_rows_display.empty:
                feat_rows_display["source"] = feat_rows_display["source"].map(lambda v: SOURCE_LABELS.get(v, v))
                st.dataframe(
                    feat_rows_display.sort_values(["source", "lookup_id", "feature"]).reset_index(drop=True),
                    use_container_width=True, height=400,
                )

    # ==================================================================
    # TAB 4 — OPERATIONAL DASHBOARD
    # ==================================================================
    with tab_dashboard:
        st.subheader("Operational Summary Dashboard")
        render_operational_dashboard(df, coverage_df, feat_overall)

        # Comprehensive table
        st.markdown("#### Comprehensive Results Table")
        preferred_cols = [
            "lookup_id", "lgl_nm_worth", "city_worth", "region_worth",
            "efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence",
            "efx_id", "oc_company_number", "zi_c_company_id", "liberty_id",
            "best_source", "best_confidence",
        ]
        show_cols = [c for c in preferred_cols if c in df.columns]
        st.dataframe(df.select(show_cols).to_pandas(), use_container_width=True, height=420)

    # ==================================================================
    # TAB 5 — AUDIT TRAIL
    # ==================================================================
    with tab_audit:
        st.subheader("Full Audit Trail")
        st.caption("All analyst actions are recorded here for governance and review.")

        trail = st.session_state.get("audit_trail", [])
        if trail:
            trail_df = pd.DataFrame(trail)
            st.dataframe(
                trail_df[["timestamp", "lookup_id", "action", "detail"]].iloc[::-1].reset_index(drop=True),
                use_container_width=True, height=500,
            )
        else:
            st.info("No audit events yet. Open the Investigation tab to start reviewing records.")

        render_audit_trail()

        if st.button("🗑️ Clear Audit Trail", key="clear_audit"):
            st.session_state["audit_trail"] = []
            st.rerun()

        if st.button("🗑️ Clear All Decisions", key="clear_decisions"):
            st.session_state["decisions"] = {}
            st.session_state["audit_trail"] = []
            st.rerun()

    # ==================================================================
    # TAB 6 — INDUSTRY CLASSIFICATION (Consensus Level 2)
    # ==================================================================
    with tab_industry:
        render_industry_tab(df)


if __name__ == "__main__":
    main()
