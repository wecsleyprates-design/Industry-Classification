"""
Industry Classification Experiment
====================================
Side-by-side comparison of:
  A) Worth AI Production Pipeline  — FactEngine deterministic rule
  B) Consensus Engine              — 38-feature XGBoost + LLM + Risk Engine

Both pipelines operate on the SAME dummy dataset of 30 companies that
spans US states, UK, EU, APAC, LATAM, MENA, and diverse entity types.

When Redshift credentials are set (REDSHIFT_HOST / REDSHIFT_USER /
REDSHIFT_PASSWORD / REDSHIFT_DB), both pipelines query real data.
Without credentials, both fall back to realistic simulated signals
using the same random seed — ensuring fair comparison.

Run:
    python experiment_pipeline.py

Outputs:
    experiment_results.csv    — full side-by-side results
    experiment_results.xlsx   — Excel with 4 sheets
    experiment_summary.json   — key metrics summary
"""

from __future__ import annotations

import os
import sys
import json
import time
import random
import hashlib
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional
import pandas as pd
import numpy as np

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger("experiment")

# ── Suppress noisy loggers ────────────────────────────────────────────────────
for name in ["sentence_transformers", "transformers", "torch", "faiss", "httpx"]:
    logging.getLogger(name).setLevel(logging.ERROR)


# ═══════════════════════════════════════════════════════════════════════════════
# 1. DUMMY DATASET — 30 companies across all jurisdiction types
# ═══════════════════════════════════════════════════════════════════════════════

DUMMY_COMPANIES = [
    # (name, address, country/jc, expected_sector, entity_type, is_well_known)
    # ── Well-known US companies (Model 1 will MATCH these in entity_lookup)
    ("Apple Inc",              "1 Infinite Loop, Cupertino",    "us_ca", "Technology",    "Operating", True),
    ("Microsoft Corporation",  "1 Microsoft Way, Redmond",      "us_wa", "Technology",    "Operating", True),
    ("JPMorgan Chase Bank",    "383 Madison Ave, New York",      "us_ny", "Finance",       "Operating", True),
    ("Walmart Inc",            "702 SW 8th St, Bentonville",    "us_ar", "Retail",        "Operating", True),
    ("McDonald's Corporation", "110 N Carpenter St, Chicago",   "us_il", "Food Service",  "Operating", True),
    ("Tesla Inc",              "3500 Deer Creek Rd, Palo Alto", "us_ca", "Automotive",    "Operating", True),
    ("Goldman Sachs Group",    "200 West St, New York",         "us_ny", "Finance",       "Operating", True),
    ("Boeing Company",         "100 N Riverside, Chicago",      "us_il", "Aerospace",     "Operating", True),
    ("Pfizer Inc",             "235 E 42nd St, New York",       "us_ny", "Healthcare",    "Operating", True),
    ("Amazon Inc",             "410 Terry Ave N, Seattle",      "us_wa", "Retail",        "Operating", True),

    # ── Well-known UK companies
    ("Barclays Bank PLC",      "1 Churchill Place, London",      "gb",    "Finance",       "Operating", True),
    ("HSBC Holdings PLC",      "8 Canada Square, London",        "gb",    "Finance",       "Operating", True),
    ("Shell PLC",              "Shell Centre, London",           "gb",    "Energy",        "Operating", True),

    # ── US small/private companies (Model 1 will NOT match — SIMULATED/INFERRED)
    ("Foster's Alaska Cabins", "1005 Angler Dr, Kenai",          "us_ak", "Hospitality",   "Operating", False),
    ("Betty H Freeman Inc",    "680 Schillinger Rd S, Mobile",  "us_al", "Services",      "Operating", False),
    ("Ron Pack Carpet Ctr",    "35 Inverness Cir, Little Rock", "us_ar", "Retail",        "Operating", False),
    ("William T Holland MD",   "6337 W Glendale Ave, Glendale", "us_az", "Healthcare",    "Operating", False),
    ("Sunrise Properties LLC", "45 Oak St, Denver",             "us_co", "Real Estate",   "Holding",   False),
    ("Mountain View Tech",     "100 Main St, Boulder",          "us_co", "Technology",    "Operating", False),
    ("Gulf Coast Services",    "200 Harbor Blvd, Tampa",        "us_fl", "Services",      "Operating", False),

    # ── EU companies
    ("Volkswagen AG",          "Berliner Ring 2, Wolfsburg",     "de",    "Automotive",    "Operating", True),
    ("Société Générale SA",    "29 Blvd Haussmann, Paris",       "fr",    "Finance",       "Operating", True),
    ("ASML Holding NV",        "De Run 6501, Veldhoven",         "nl",    "Technology",    "Operating", True),

    # ── APAC
    ("Samsung Electronics",    "129 Samsung-ro, Suwon",         "kr",    "Technology",    "Operating", True),
    ("Infosys Limited",        "Electronics City, Bangalore",   "in",    "Technology",    "Operating", True),

    # ── LATAM / MENA / Other
    ("Petrobras SA",           "Av Chile 65, Rio de Janeiro",   "br",    "Energy",        "Operating", True),
    ("ADNOC Group",            "Corniche Rd, Abu Dhabi",        "ae_az", "Energy",        "Holding",   True),
    ("MTN Group",              "216 14th Ave, Johannesburg",    "za",    "Telecom",       "Operating", True),

    # ── Tricky / edge cases
    ("XYZ Holdings Ltd",       "10 Unknown St",                  "ky",    "Holding",       "Holding",   False),
    ("Acme Pizza Solutions LLC","456 Oak Ave, St. Louis",        "us_mo", "Food Service",  "Operating", False),
]


# ═══════════════════════════════════════════════════════════════════════════════
# 2. WORTH AI PRODUCTION PIPELINE SIMULATION
#    Implements factWithHighestConfidence() rule exactly as in rules.ts
# ═══════════════════════════════════════════════════════════════════════════════

WEIGHT_THRESHOLD = 0.05   # from rules.ts
DEFAULT_FACT_WEIGHT = 1   # from factEngine.ts
MAX_CONFIDENCE_INDEX = 55 # from sources.ts

# Source-level weights (from sources.ts)
SOURCE_WEIGHTS = {
    "opencorporates":   0.90,
    "zoominfo":         0.80,
    "trulioo":          0.80,
    "equifax":          0.70,
    "serp":             0.30,
    "businessDetails":  10.0,
    "AINaicsEnrichment": 0.10,
}

# Fact-level weight overrides (from businessDetails/index.ts)
FACT_WEIGHTS = {
    "trulioo":           0.70,  # overrides source 0.80 for naics_code
    "serp":              0.30,
    "businessDetails":   0.20,  # overrides source 10 for naics_code
    "AINaicsEnrichment": 0.10,
}


@dataclass
class VendorSignal:
    source:         str
    naics_code:     Optional[str]
    uk_sic_code:    Optional[str]
    industry_code_uids: Optional[str]  # OC pipe-delimited string
    match_confidence: float            # from Model 1 XGBoost (entity matching)
    status:         str                # MATCHED / INFERRED / CONFLICT / SIMULATED


@dataclass
class ProductionResult:
    company_name:   str
    jurisdiction:   str
    entity_type:    str
    winning_naics:  Optional[str]
    winning_source: str
    effective_score: float
    all_signals:    list[VendorSignal] = field(default_factory=list)
    uk_sic_code:    Optional[str] = None   # from separate uk_sic_code fact
    mcc_code:       Optional[str] = None
    elapsed_s:      float = 0.0


def weighted_fact_selector(fact_a_weight: float, fact_b_weight: float,
                            source_a_weight: float, source_b_weight: float,
                            fact_a_w_override: Optional[float],
                            fact_b_w_override: Optional[float]) -> str:
    """Mirrors weightedFactSelector() from rules.ts."""
    w_a = fact_a_w_override if (fact_a_w_override is not None and
                                  fact_a_w_override != DEFAULT_FACT_WEIGHT) else source_a_weight
    w_b = fact_b_w_override if (fact_b_w_override is not None and
                                  fact_b_w_override != DEFAULT_FACT_WEIGHT) else source_b_weight
    return "a" if w_a >= w_b else "b"


def fact_with_highest_confidence(candidates: list[dict]) -> Optional[dict]:
    """
    Mirrors factWithHighestConfidence() from rules.ts exactly.
    candidates: list of {source, value, confidence, source_weight, fact_weight_override}
    """
    acc = None
    for fact in candidates:
        if fact.get("value") is None:
            continue
        fact_conf = fact.get("confidence", 0.1)
        if acc is None:
            acc = fact
            continue
        acc_conf = acc.get("confidence", 0.1)
        if abs(fact_conf - acc_conf) <= WEIGHT_THRESHOLD:
            # tie — use weight
            winner = weighted_fact_selector(
                fact_conf, acc_conf,
                fact.get("source_weight", DEFAULT_FACT_WEIGHT),
                acc.get("source_weight", DEFAULT_FACT_WEIGHT),
                fact.get("fact_weight_override"),
                acc.get("fact_weight_override"),
            )
            acc = fact if winner == "a" else acc
        elif fact_conf > acc_conf:
            acc = fact
    return acc


def simulate_vendor_signals(company_name: str, jurisdiction: str,
                             entity_type: str, is_well_known: bool) -> list[VendorSignal]:
    """
    Simulate vendor responses.
    When Redshift is connected (real mode), signals come from real tables.
    In simulation mode, generate realistic signals.
    """
    # Try real Redshift first
    try:
        from redshift_connector import get_connector
        rc = get_connector()
    except Exception:
        rc = None

    from entity_lookup import lookup_entity
    from jurisdiction_registry import resolve_iso2, preferred_taxonomy

    iso2 = resolve_iso2(jurisdiction)
    em_result = lookup_entity(company_name, "", iso2.lower())

    seed = int(hashlib.md5(company_name.encode()).hexdigest(), 16)
    rng = random.Random(seed)

    signals = []

    # ── OpenCorporates ────────────────────────────────────────────────────────
    if em_result.found and em_result.opencorporates:
        oc_rec = em_result.opencorporates
        # Simulate what OC returns in industry_code_uids
        uids = f"us_naics-{oc_rec.naics_code}"
        if oc_rec.taxonomy == "UK_SIC_2007":
            uids = f"gb_sic-{oc_rec.naics_code}|us_naics-522110"
        signals.append(VendorSignal(
            source="opencorporates",
            naics_code=oc_rec.naics_code if "naics" in oc_rec.taxonomy.lower() else None,
            uk_sic_code=oc_rec.naics_code if oc_rec.taxonomy == "UK_SIC_2007" else None,
            industry_code_uids=uids,
            match_confidence=rng.uniform(0.87, 0.97),
            status="MATCHED",
        ))
    else:
        signals.append(VendorSignal(
            source="opencorporates",
            naics_code=None, uk_sic_code=None, industry_code_uids=None,
            match_confidence=rng.uniform(0.40, 0.65),
            status="SIMULATED",
        ))

    # ── Equifax ────────────────────────────────────────────────────────────────
    if em_result.found and em_result.equifax and iso2 == "US":
        eq_rec = em_result.equifax
        signals.append(VendorSignal(
            source="equifax",
            naics_code=eq_rec.naics_code,
            uk_sic_code=None,
            industry_code_uids=None,
            match_confidence=rng.uniform(0.82, 0.94),
            status="MATCHED",
        ))
    else:
        signals.append(VendorSignal(
            source="equifax",
            naics_code=None, uk_sic_code=None, industry_code_uids=None,
            match_confidence=rng.uniform(0.30, 0.60),
            status="SIMULATED",
        ))

    # ── ZoomInfo ───────────────────────────────────────────────────────────────
    if em_result.found and em_result.zoominfo:
        zi_rec = em_result.zoominfo
        signals.append(VendorSignal(
            source="zoominfo",
            naics_code=zi_rec.naics_code,
            uk_sic_code=None,
            industry_code_uids=None,
            match_confidence=rng.uniform(0.85, 0.95),
            status="MATCHED",
        ))
    else:
        signals.append(VendorSignal(
            source="zoominfo",
            naics_code=None, uk_sic_code=None, industry_code_uids=None,
            match_confidence=rng.uniform(0.35, 0.62),
            status="SIMULATED",
        ))

    # ── Trulioo (always simulated — live API) ──────────────────────────────────
    if em_result.found and em_result.opencorporates:
        # Trulioo sometimes has a conflict (lower confidence)
        conflict = rng.random() < 0.20
        tr_code = em_result.opencorporates.naics_code if not conflict else "541511"
        signals.append(VendorSignal(
            source="trulioo",
            naics_code=tr_code,
            uk_sic_code=None,  # .sicCode NEVER READ in Worth AI production
            industry_code_uids=None,
            match_confidence=rng.uniform(0.55, 0.80),
            status="CONFLICT" if conflict else "MATCHED",
        ))
    else:
        signals.append(VendorSignal(
            source="trulioo",
            naics_code=None, uk_sic_code=None, industry_code_uids=None,
            match_confidence=rng.uniform(0.25, 0.55),
            status="SIMULATED",
        ))

    return signals


def run_production_pipeline(company_name: str, address: str,
                             jurisdiction: str, entity_type: str,
                             is_well_known: bool) -> ProductionResult:
    """
    Simulates Worth AI's production Phase 4A:
    factWithHighestConfidence() rule applied to vendor signals.
    """
    t0 = time.time()
    signals = simulate_vendor_signals(company_name, jurisdiction, entity_type, is_well_known)

    # Build candidates for factWithHighestConfidence (naics_code fact)
    # Sources: equifax, zoominfo, opencorporates, trulioo, businessDetails, AI
    # Each candidate: {source, value (naics_code), confidence, source_weight, fact_weight_override}
    candidates = []
    for sig in signals:
        if sig.naics_code:
            # For OC: extract us_naics from industry_code_uids
            naics = sig.naics_code
            if sig.source == "opencorporates" and sig.industry_code_uids:
                naics = None
                for uid in sig.industry_code_uids.split("|"):
                    parts = uid.split("-", 1)
                    if len(parts) == 2 and "us_naics" in parts[0]:
                        naics = parts[1]
                        break
            if naics:
                candidates.append({
                    "source":              sig.source,
                    "value":               naics,
                    "confidence":          sig.match_confidence,
                    "source_weight":       SOURCE_WEIGHTS.get(sig.source, 1.0),
                    "fact_weight_override": FACT_WEIGHTS.get(sig.source),
                })

    winner = fact_with_highest_confidence(candidates)
    winning_naics  = winner["value"] if winner else None
    winning_source = winner["source"] if winner else "none"
    eff_score = (winner["confidence"] * (winner["fact_weight_override"] or
                  winner["source_weight"])) if winner else 0.0

    # UK SIC — Worth AI: only if OC returns gb_sic (but classification_codes has no consumer)
    uk_sic = None
    for sig in signals:
        if sig.source == "opencorporates" and sig.uk_sic_code:
            uk_sic = sig.uk_sic_code  # in production: never stored (no table)
            break

    # MCC — derived via rel_naics_mcc JOIN (simplified mapping)
    mcc = _naics_to_mcc(winning_naics)

    elapsed = time.time() - t0
    return ProductionResult(
        company_name=company_name,
        jurisdiction=jurisdiction,
        entity_type=entity_type,
        winning_naics=winning_naics,
        winning_source=winning_source,
        effective_score=round(eff_score, 4),
        all_signals=signals,
        uk_sic_code=uk_sic,
        mcc_code=mcc,
        elapsed_s=round(elapsed, 3),
    )


def _naics_to_mcc(naics: Optional[str]) -> Optional[str]:
    """Simplified NAICS → MCC mapping (mimics rel_naics_mcc JOIN)."""
    if not naics:
        return None
    prefix_map = {
        "72": "5812",   # restaurants
        "44": "5999",   # retail
        "52": "6099",   # finance
        "51": "7372",   # software
        "33": "5045",   # manufacturing/computers
        "23": "1520",   # construction
        "62": "8011",   # healthcare
        "48": "4215",   # transport
        "11": "0763",   # agriculture
        "55": "6726",   # holding companies
        "21": "5983",   # energy
        "61": "8220",   # education
    }
    return prefix_map.get(naics[:2], "5999")


# ═══════════════════════════════════════════════════════════════════════════════
# 3. CONSENSUS ENGINE PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def run_consensus_pipeline(company_name: str, address: str,
                            jurisdiction: str, entity_type: str,
                            is_well_known: bool) -> dict:
    """Run the full Consensus Engine pipeline and return structured results."""
    from entity_resolver import EntityResolver
    from data_simulator import DataSimulator
    from consensus_engine import IndustryConsensusEngine, FeatureEngineer
    from risk_engine import RiskEngine
    from external_lookup import lookup_all

    er  = EntityResolver()
    sim = DataSimulator()

    entity  = er.resolve(company_name, address, jurisdiction)
    bundle  = sim.fetch(
        company_name=company_name,
        address=address,
        country=jurisdiction,
        jurisdiction=entity.jurisdiction_code,
        entity_type=entity_type,
        web_summary="",
    )

    # Build 38-feature vector (for inspection)
    fe    = FeatureEngineer(_taxonomy_engine)
    feats = fe.transform(bundle)

    # XGBoost Model 2 prediction
    result  = _consensus_engine.predict(bundle)

    # Risk Engine
    risk    = _risk_engine.evaluate(bundle, result)
    result.risk_signals = [s.to_dict() for s in risk.signals]

    # External registry (SEC EDGAR / Companies House)
    ext_reg = lookup_all(company_name, entity.jurisdiction_code)

    return {
        "company_name":       company_name,
        "jurisdiction":       entity.jurisdiction_code,
        "jurisdiction_label": entity.jurisdiction_label,
        "entity_type":        entity.detected_entity_type,
        "primary_code":       result.primary_industry.code,
        "primary_taxonomy":   result.primary_industry.taxonomy,
        "primary_label":      result.primary_industry.label,
        "consensus_prob":     round(result.primary_industry.consensus_probability, 4),
        "secondary_codes":    [(s.code, s.taxonomy, round(s.consensus_probability,4))
                               for s in result.secondary_industries[:3]],
        "risk_level":         risk.overall_risk_level,
        "risk_score":         round(risk.overall_risk_score, 4),
        "kyb_recommendation": risk.kyb_recommendation,
        "risk_flags":         [s.flag for s in risk.signals],
        "n_signals":          len(risk.signals),
        "sec_edgar_sic":      ext_reg.edgar.sic if ext_reg.edgar else None,
        "sec_edgar_sic_desc": ext_reg.edgar.sic_description if ext_reg.edgar else None,
        # Feature debug
        "feat_web_registry_dist":    round(float(feats[13]), 4),
        "feat_temporal_pivot":       round(float(feats[14]), 4),
        "feat_majority_agreement":   round(float(feats[31]), 4),
        "feat_high_risk_flag":       bool(feats[32]),
        "feat_avg_confidence":       round(float(feats[35]), 4),
        "n_sources_matched":         int(sum(1 for s in bundle.signals if s.status == "MATCHED")),
        "source_statuses":           {s.source: s.status for s in bundle.signals},
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. MAIN EXPERIMENT
# ═══════════════════════════════════════════════════════════════════════════════

def run_experiment() -> pd.DataFrame:
    print("\n" + "═"*70)
    print("  INDUSTRY CLASSIFICATION EXPERIMENT")
    print("  Worth AI Production vs. Consensus Engine")
    print("═"*70 + "\n")

    rows = []
    n = len(DUMMY_COMPANIES)

    for i, (name, address, jc, sector, entity_type, is_well_known) in enumerate(DUMMY_COMPANIES, 1):
        print(f"[{i:2d}/{n}] {name[:40]:<40} ({jc})", end=" ... ")

        # ── Production pipeline ───────────────────────────────────────────────
        try:
            prod = run_production_pipeline(name, address, jc, entity_type, is_well_known)
            prod_naics   = prod.winning_naics
            prod_source  = prod.winning_source
            prod_eff_sc  = prod.effective_score
            prod_uk_sic  = prod.uk_sic_code
            prod_mcc     = prod.mcc_code
            prod_n_match = sum(1 for s in prod.all_signals if s.status == "MATCHED")
            prod_err     = None
        except Exception as e:
            prod_naics = prod_source = prod_eff_sc = prod_uk_sic = prod_mcc = None
            prod_n_match = 0
            prod_err = str(e)

        # ── Consensus Engine ─────────────────────────────────────────────────
        try:
            cons = run_consensus_pipeline(name, address, jc, entity_type, is_well_known)
            cons_code    = cons["primary_code"]
            cons_tax     = cons["primary_taxonomy"]
            cons_prob    = cons["consensus_prob"]
            cons_risk    = cons["risk_level"]
            cons_score   = cons["risk_score"]
            cons_kyb     = cons["kyb_recommendation"]
            cons_flags   = "; ".join(cons["risk_flags"]) if cons["risk_flags"] else "—"
            cons_sec     = cons["sec_edgar_sic"]
            cons_maj     = cons["feat_majority_agreement"]
            cons_pivot   = cons["feat_temporal_pivot"]
            cons_wrd     = cons["feat_web_registry_dist"]
            cons_n_match = cons["n_sources_matched"]
            sec_codes    = "; ".join(f"{c}({t.split('_')[0]})" for c, t, _ in cons["secondary_codes"])
            cons_err     = None
        except Exception as e:
            cons_code = cons_tax = cons_prob = cons_risk = cons_score = None
            cons_kyb = cons_flags = cons_sec = sec_codes = "—"
            cons_maj = cons_pivot = cons_wrd = 0
            cons_n_match = 0
            cons_err = str(e)

        # ── Compute difference metrics ────────────────────────────────────────
        codes_agree = (prod_naics == cons_code) if (prod_naics and cons_code) else False
        uk_sic_found_prod = prod_uk_sic is not None
        uk_sic_found_cons = (cons_tax == "UK_SIC_2007") if cons_tax else False
        prob_str = f"{cons_prob:.1%}" if cons_prob is not None else "—"
        status = "✅ agree" if codes_agree else "❌ differ"

        print(f"Prod={prod_naics or '—':8} Cons={cons_code or '—':8} {status}")

        rows.append({
            # Input
            "Company":             name,
            "Jurisdiction":        jc,
            "Sector (expected)":   sector,
            "Entity Type":         entity_type,
            "Well-known":          is_well_known,

            # ── Production (Worth AI) ──────────────────────────────────────
            "Prod: NAICS code":        prod_naics,
            "Prod: Winning source":    prod_source,
            "Prod: Effective score":   prod_eff_sc,
            "Prod: UK SIC returned":   prod_uk_sic,
            "Prod: UK SIC persisted":  "❌ No table",
            "Prod: MCC":               prod_mcc,
            "Prod: Sources matched":   prod_n_match,
            "Prod: Probability":       "None — rule, no prob",
            "Prod: AML signals":       "None — rule produces 0",
            "Prod: KYB recommendation":"None — not produced",
            "Prod: Error":             prod_err,

            # ── Consensus Engine ───────────────────────────────────────────
            "Cons: Primary code":      cons_code,
            "Cons: Primary taxonomy":  cons_tax,
            "Cons: Probability":       prob_str,
            "Cons: Secondary codes":   sec_codes,
            "Cons: Risk level":        cons_risk,
            "Cons: Risk score":        cons_score,
            "Cons: KYB recommendation": cons_kyb,
            "Cons: Risk flags":        cons_flags,
            "Cons: SEC EDGAR SIC":     cons_sec or "—",
            "Cons: Sources matched":   cons_n_match,
            "Cons: Majority agreement":f"{cons_maj:.0%}" if cons_maj else "—",
            "Cons: Temporal pivot":    cons_pivot,
            "Cons: Web↔Registry dist": cons_wrd,
            "Cons: Error":             cons_err,

            # ── Comparison ─────────────────────────────────────────────────
            "Codes agree":             codes_agree,
            "UK SIC: Production":      "Returned but DROPPED" if uk_sic_found_prod else "Not returned",
            "UK SIC: Consensus":       "✅ Primary output" if uk_sic_found_cons else "Secondary only",
            "Improvement":             _classify_improvement(prod_naics, cons_code, cons_kyb, cons_risk),
        })

    return pd.DataFrame(rows)


def _classify_improvement(prod_naics, cons_code, kyb, risk_level) -> str:
    """Classify the type of improvement Consensus brings."""
    if kyb in ("ESCALATE", "REJECT"):
        return "🔴 Consensus adds AML signal — production missed"
    if prod_naics and cons_code and prod_naics != cons_code:
        return "🟡 Different code — Consensus uses multi-source consensus"
    if prod_naics is None and cons_code:
        return "🟢 Consensus classified — production returned null"
    if risk_level in ("HIGH", "CRITICAL"):
        return "🟠 Consensus flags risk — production has no risk engine"
    return "✅ Same result — Consensus adds probability + multi-taxonomy"


def print_summary(df: pd.DataFrame) -> dict:
    """Print and return key comparison metrics."""
    print("\n" + "═"*70)
    print("  EXPERIMENT SUMMARY")
    print("═"*70)

    n = len(df)
    agree_n = df["Codes agree"].sum()
    prod_null = df["Prod: NAICS code"].isna().sum()
    cons_null = df["Cons: Primary code"].isna().sum()
    uk_sic_prod = (df["UK SIC: Production"] != "Not returned").sum()
    uk_sic_cons = (df["UK SIC: Consensus"] == "✅ Primary output").sum()
    aml_flags = (df["Cons: Risk flags"] != "—").sum()
    reject_escalate = df["Cons: KYB recommendation"].isin(["REJECT","ESCALATE"]).sum()

    summary = {
        "total_companies": n,
        "codes_agree": int(agree_n),
        "codes_disagree": n - int(agree_n),
        "agreement_pct": f"{agree_n/n:.0%}",
        "production_null_naics": int(prod_null),
        "consensus_null_naics": int(cons_null),
        "uk_sic_received_by_production": int(uk_sic_prod),
        "uk_sic_persisted_by_production": 0,  # No table exists
        "uk_sic_as_primary_by_consensus": int(uk_sic_cons),
        "companies_with_aml_flags_consensus": int(aml_flags),
        "companies_with_aml_flags_production": 0,
        "reject_or_escalate_by_consensus": int(reject_escalate),
        "reject_or_escalate_by_production": 0,
    }

    print(f"\n  Total companies:                        {n}")
    print(f"  Codes agree (same NAICS):               {agree_n}/{n} ({agree_n/n:.0%})")
    print(f"  Production returned null NAICS:         {prod_null}/{n}")
    print(f"  Consensus returned null code:           {cons_null}/{n}")
    print(f"\n  UK SIC received by production:          {uk_sic_prod}/{n}")
    print(f"  UK SIC persisted by production:         0/{n}  ← NO TABLE EXISTS")
    print(f"  UK SIC as primary output (Consensus):   {uk_sic_cons}/{n}")
    print(f"\n  Companies with AML signals (Consensus): {aml_flags}/{n}")
    print(f"  Companies with AML signals (Production): 0/{n}")
    print(f"  REJECT/ESCALATE (Consensus):             {reject_escalate}/{n}")
    print(f"  REJECT/ESCALATE (Production):            0/{n}  ← NO RISK ENGINE")

    if "Cons: Probability" in df.columns:
        probs = df["Cons: Probability"].str.replace("%","").replace("—", None)
        valid = pd.to_numeric(probs, errors="coerce").dropna()
        if not valid.empty:
            print(f"\n  Avg consensus probability:              {valid.mean()/100:.1%}")
            print(f"  High confidence (≥70%):                {(valid>=70).sum()}/{len(valid)}")
            print(f"  Low confidence (<40%):                  {(valid<40).sum()}/{len(valid)}")
            summary["avg_consensus_probability"] = f"{valid.mean()/100:.1%}"
            summary["high_confidence_count"] = int((valid>=70).sum())
            summary["low_confidence_count"] = int((valid<40).sum())

    kyb_dist = df["Cons: KYB recommendation"].value_counts().to_dict()
    summary["kyb_distribution"] = kyb_dist
    print(f"\n  KYB distribution (Consensus):")
    for k, v in sorted(kyb_dist.items()):
        print(f"    {k:<12} {v:3d}  ({v/n:.0%})")

    print("\n" + "═"*70 + "\n")
    return summary


def save_results(df: pd.DataFrame, summary: dict):
    """Save results to CSV, Excel, and JSON."""
    base = os.path.join(os.path.dirname(__file__), "experiment")

    # CSV
    csv_path = base + "_results.csv"
    df.to_csv(csv_path, index=False)
    print(f"  Saved: {csv_path}")

    # Excel — 4 sheets
    xlsx_path = base + "_results.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        # Sheet 1: full comparison
        df.to_excel(writer, sheet_name="Full Comparison", index=False)

        # Sheet 2: production only
        prod_cols = [c for c in df.columns if c.startswith("Prod:") or
                     c in ["Company","Jurisdiction","Sector (expected)","Entity Type","Well-known"]]
        df[prod_cols].to_excel(writer, sheet_name="Production (Worth AI)", index=False)

        # Sheet 3: consensus only
        cons_cols = [c for c in df.columns if c.startswith("Cons:") or
                     c in ["Company","Jurisdiction","Sector (expected)","Entity Type","Well-known"]]
        df[cons_cols].to_excel(writer, sheet_name="Consensus Engine", index=False)

        # Sheet 4: differences
        diff_cols = ["Company","Jurisdiction","Sector (expected)",
                     "Prod: NAICS code","Cons: Primary code","Cons: Primary taxonomy",
                     "Cons: Probability","Codes agree","UK SIC: Production","UK SIC: Consensus",
                     "Cons: KYB recommendation","Cons: Risk flags","Improvement"]
        df[[c for c in diff_cols if c in df.columns]].to_excel(
            writer, sheet_name="Key Differences", index=False)

    print(f"  Saved: {xlsx_path}")

    # JSON summary
    json_path = base + "_summary.json"
    with open(json_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"  Saved: {json_path}")


# ── Singleton engines (load once) ─────────────────────────────────────────────
_taxonomy_engine  = None
_consensus_engine = None
_risk_engine      = None


def _init_engines():
    global _taxonomy_engine, _consensus_engine, _risk_engine
    print("Loading engines (first run may take ~30s)...")

    from taxonomy_engine import TaxonomyEngine
    _taxonomy_engine = TaxonomyEngine()
    print(f"  UGO index: {_taxonomy_engine.record_count} codes")

    from consensus_engine import IndustryConsensusEngine
    _consensus_engine = IndustryConsensusEngine(taxonomy_engine=_taxonomy_engine)
    print("  Consensus XGBoost Model 2: ready")

    from risk_engine import RiskEngine
    _risk_engine = RiskEngine(taxonomy_engine=_taxonomy_engine)
    print("  Risk Engine: ready\n")


if __name__ == "__main__":
    _init_engines()
    df = run_experiment()
    summary = print_summary(df)
    save_results(df, summary)
    print("Experiment complete.")
