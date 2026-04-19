"""
Metadata catalog — tables, columns, features, glossary.

Curated by engineering. Used by the Lineage tab and by the AI View Generator
to resolve natural-language concepts to concrete SQL identifiers.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class TableMeta:
    schema: str
    table: str
    description: str
    rows_est: str
    freshness: str


@dataclass(frozen=True)
class ColumnMeta:
    table: str
    column: str
    dtype: str
    sensitive: bool
    description: str


@dataclass(frozen=True)
class FeatureMeta:
    name: str
    dtype: str
    source_table: str
    owner: str
    active: bool
    downstream: str
    description: str


TABLES: list[TableMeta] = [
    TableMeta("rds_warehouse_public", "facts",                    "Central fact store", "28.4M", "live"),
    TableMeta("rds_cases_public",      "cases",                    "KYB cases + decisions", "6.1M", "live"),
    TableMeta("rds_cases_public",      "rel_business_customer_monitoring", "Business ↔ customer link", "5.1M", "hourly"),
    TableMeta("datascience",            "customer_files",           "Pipeline B output", "1.8M", "daily"),
    TableMeta("rds_manual_score_public","business_scores",          "Confidence score history", "2.6M", "live"),
    TableMeta("datascience",            "zoominfo_matches_custom_inc_ml", "ZI entity matches", "3.4M", "daily"),
    TableMeta("datascience",            "efx_matches_custom_inc_ml",       "EFX entity matches", "2.1M", "daily"),
    TableMeta("warehouse",              "oc_companies_latest",      "OpenCorporates registry", "220M", "weekly"),
]


COLUMNS: list[ColumnMeta] = [
    ColumnMeta("rds_warehouse_public.facts", "business_id", "VARCHAR(UUID)", False, "Business identifier — joins across all KYB tables."),
    ColumnMeta("rds_warehouse_public.facts", "name",        "VARCHAR",        False, "Fact name (e.g., 'confidence_score')."),
    ColumnMeta("rds_warehouse_public.facts", "value",       "VARCHAR JSON",   False, "JSON payload. Use JSON_EXTRACT_PATH_TEXT(value,'value')."),
    ColumnMeta("rds_warehouse_public.facts", "received_at", "TIMESTAMP",      False, "Write timestamp of the fact."),
    ColumnMeta("rds_cases_public.cases",     "decision",    "VARCHAR",        False, "Final decision: Approved / Declined / Escalated."),
    ColumnMeta("datascience.customer_files", "tax_id",      "VARCHAR",        True,  "Tax identifier. Must be masked in the UI."),
]


FEATURES: list[FeatureMeta] = [
    FeatureMeta("tin_validation_status", "text",   "rds_warehouse_public.facts", "KYB Core",    True,  "confidence_score",          "IRS TIN match status"),
    FeatureMeta("registration_active",   "bool",   "rds_warehouse_public.facts", "KYB Core",    True,  "confidence_score",          "Secretary-of-State active flag"),
    FeatureMeta("address_consistency",   "number", "rds_warehouse_public.facts", "Address Ops", True,  "confidence_score",          "0–1 score comparing USPS/SOS/provider addresses"),
    FeatureMeta("ubo_verified",          "number", "rds_warehouse_public.facts", "UBO Team",    True,  "confidence_score,red_flags","Share of verified UBOs"),
    FeatureMeta("watchlist_hits",        "number", "rds_warehouse_public.facts", "Compliance",  True,  "red_flags",                 "Count of watchlist matches"),
    FeatureMeta("naics_confidence",      "number", "datascience.customer_files", "Data Science",True,  "industry_classification",   "Confidence of primary NAICS classification"),
    FeatureMeta("entity_age_days",       "number", "rds_warehouse_public.facts", "KYB Core",    True,  "confidence_score",          "Days since formation_date"),
]


GLOSSARY: list[tuple[str, str]] = [
    ("Confidence Score", "Model-derived probability (0–1) that a business is correctly KYB-verified."),
    ("Confidence Band",  "Discrete grouping of scores (Very Low / Low / Medium / High / Very High)."),
    ("PSI",              "Population Stability Index — measures distribution drift of a feature or score."),
    ("Check-Agent",      "Automated module that scans data for inconsistencies, red flags, and model/evidence gaps."),
    ("UBO",              "Ultimate Beneficial Owner — natural person(s) who ultimately own/control an entity."),
    ("Winner Rule",      "Deterministic rule that selects the highest-confidence source when multiple providers disagree."),
    ("Trust Layer",      "Four-level lineage (business meaning, warehouse source, transformation, repo code) attached to every object."),
    ("Not-Matching",     "A disagreement between the model output and underlying evidence."),
]
