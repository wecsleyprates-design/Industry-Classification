"""
Industry Dropdown Engine
========================
Jurisdiction-aware, searchable industry classification selector.

Given any jurisdiction_code (us_mo, gb, ca_bc, ae_az, de, tz …),
returns the correct taxonomy with both code and description for display,
e.g.  "62012 — Business and domestic software development"

The taxonomy data is read from CSV files in the data/ directory —
taxonomy updates never require a code deployment, only a CSV swap.

Supported taxonomies per jurisdiction:
  US / CA / AU / NZ / PR → US_NAICS_2022
  GB / GG / JE           → UK_SIC_2007
  EU (DE/FR/IT/ES/NL/…)  → NACE_REV2
  APAC / LATAM / MENA / AFRICA / OTHER → ISIC_REV4
  Fallback               → MCC

Each row is returned as a dict: {code, description, display, taxonomy}
  display = "62012 — Business and domestic software development"
"""

from __future__ import annotations

import os
import functools
import pandas as pd
from typing import Optional

import jurisdiction_registry as JR
from config import DATA_DIR

# ── Map taxonomy name → CSV file ──────────────────────────────────────────────
TAXONOMY_CSV: dict[str, str] = {
    "US_NAICS_2022": "naics_2022.csv",
    "UK_SIC_2007":   "uk_sic_2007.csv",
    "NACE_REV2":     "nace_rev2.csv",
    "ISIC_REV4":     "isic_rev4.csv",
    "US_SIC_1987":   "us_sic_1987.csv",
    "MCC":           "mcc_codes.csv",
}

# ── Human-readable taxonomy labels ───────────────────────────────────────────
TAXONOMY_LABELS: dict[str, str] = {
    "US_NAICS_2022": "NAICS 2022 (North America)",
    "UK_SIC_2007":   "SIC 2007 (United Kingdom — Companies House / ONS)",
    "NACE_REV2":     "NACE Rev.2 (European Union)",
    "ISIC_REV4":     "ISIC Rev.4 (International / UN)",
    "US_SIC_1987":   "SIC 1987 (United States)",
    "MCC":           "MCC (Merchant Category Codes — Visa/Mastercard)",
}

# ── Column names per CSV ───────────────────────────────────────────────────────
_CODE_COL = "code"
_DESC_COL = "description"


@functools.lru_cache(maxsize=16)
def _load_taxonomy(taxonomy: str) -> pd.DataFrame:
    """Load and cache a taxonomy CSV. Cached indefinitely per process."""
    filename = TAXONOMY_CSV.get(taxonomy)
    if not filename:
        return pd.DataFrame(columns=[_CODE_COL, _DESC_COL])
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return pd.DataFrame(columns=[_CODE_COL, _DESC_COL])
    df = pd.read_csv(path, dtype=str).fillna("")
    df.columns = df.columns.str.strip().str.lower()
    # Normalise column names
    if "code" not in df.columns and len(df.columns) >= 2:
        df = df.rename(columns={df.columns[0]: "code", df.columns[1]: "description"})
    df["code"]        = df["code"].str.strip()
    df["description"] = df["description"].str.strip()
    # Remove blank rows
    df = df[(df["code"] != "") & (df["description"] != "")].copy()
    return df


def reload_taxonomy(taxonomy: str) -> None:
    """Force-reload a taxonomy from disk (call after CSV update)."""
    _load_taxonomy.cache_clear()


def taxonomy_for_jurisdiction(jurisdiction_code: str) -> str:
    """
    Return the preferred taxonomy name for a given jurisdiction_code.
    Falls back gracefully for unknown codes.
    """
    return JR.preferred_taxonomy(jurisdiction_code) or "ISIC_REV4"


def get_entries(
    jurisdiction_code: str,
    taxonomy_override: Optional[str] = None,
) -> list[dict]:
    """
    Return a list of industry entries for the given jurisdiction, each as:
      {
        "code":        "62012",
        "description": "Business and domestic software development",
        "display":     "62012 — Business and domestic software development",
        "taxonomy":    "UK_SIC_2007",
      }

    taxonomy_override: if set, forces a specific taxonomy regardless of jurisdiction.
    """
    taxonomy = taxonomy_override or taxonomy_for_jurisdiction(jurisdiction_code)
    df = _load_taxonomy(taxonomy)

    entries = []
    for _, row in df.iterrows():
        code = str(row["code"]).strip()
        desc = str(row["description"]).strip()
        if not code or not desc:
            continue
        entries.append({
            "code":        code,
            "description": desc,
            "display":     f"{code} \u2014 {desc}",
            "taxonomy":    taxonomy,
        })
    return entries


def search_entries(
    jurisdiction_code: str,
    query: str,
    taxonomy_override: Optional[str] = None,
    max_results: int = 200,
) -> list[dict]:
    """
    Search taxonomy entries by code number OR keyword in description.
    Returns filtered list sorted by relevance (exact code match first,
    then description matches sorted by match position).
    """
    query = query.strip().lower()
    all_entries = get_entries(jurisdiction_code, taxonomy_override)

    if not query:
        return all_entries[:max_results]

    exact_code:   list[dict] = []
    prefix_code:  list[dict] = []
    desc_matches: list[dict] = []

    for entry in all_entries:
        code_lower = entry["code"].lower()
        desc_lower = entry["description"].lower()

        if code_lower == query:
            exact_code.append(entry)
        elif code_lower.startswith(query):
            prefix_code.append(entry)
        elif query in desc_lower:
            # Sort by position of match within description
            pos = desc_lower.index(query)
            desc_matches.append((pos, entry))

    desc_matches.sort(key=lambda x: x[0])
    results = exact_code + prefix_code + [e for _, e in desc_matches]
    return results[:max_results]


def get_taxonomy_label(taxonomy: str) -> str:
    return TAXONOMY_LABELS.get(taxonomy, taxonomy)


def get_all_taxonomy_names() -> list[str]:
    return list(TAXONOMY_CSV.keys())


def get_entry_by_code(
    code: str,
    jurisdiction_code: str,
    taxonomy_override: Optional[str] = None,
) -> Optional[dict]:
    """Look up a specific code. Returns None if not found."""
    for entry in get_entries(jurisdiction_code, taxonomy_override):
        if entry["code"] == code.strip():
            return entry
    return None
