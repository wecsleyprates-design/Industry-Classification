# NAICS/MCC Data Quality Explorer

Internal monitoring dashboard for NAICS and MCC fact quality across the Worth AI platform.

## Purpose

Built for the Worth AI data engineering and analytics team to:
- Monitor which platform is winning the confidence race for NAICS and MCC facts
- Identify ghost assigner (platformId=0) wins where self-reported data beats real vendors
- Validate NAICS codes (format + lookup) and MCC codes (lookup + known-bad detection)
- Trace the cascade from null NAICS → degraded MCC
- Drill into any individual business's full fact picture

## Running

```bash
cd Admin-Portal-KYB-App/naics_mcc_explorer
pip install -r requirements.txt
streamlit run app.py
```

## Data Sources

All queries use only `rds_**` Redshift tables:
- `rds_warehouse_public.facts` — winning fact + alternatives JSON
- `rds_cases_public.rel_business_customer_monitoring` — business ↔ customer links + dates
- `rds_cases_public.core_naics_code` — NAICS lookup table
- `rds_cases_public.core_mcc_code` — MCC lookup table

## Pages

| Page | Purpose |
|---|---|
| 🏠 Home | Overview KPIs and platform winner snapshot |
| 🏆 Platform Winners | Who wins NAICS vs MCC confidence races, P0 Ghost Assigner analysis |
| 🔭 Fact Explorer | Explore any fact type: winner + alternatives + distribution |
| 🔢 NAICS Validity | Format check + lookup validation, catch-all 561499 breakdown |
| 💳 MCC Validity | MCC lookup validation, source split (AI vs NAICS-derived), 5614 bug detection |
| ⛓️ Cascade Analysis | How null NAICS flows through to degrade MCC quality |
| 🔍 Business Drilldown | Full fact picture for a single business UUID |

## Key Concepts

**platformId: 0 (Ghost Assigner):** `businessDetails` writer in `integration-service`.
Hardcoded `confidence: 1` means it always beats real vendors (ZoomInfo at ~0.8, AI at 0.15)
in the `factWithHighestConfidence` arbitration rule. Fix: `sources.ts:151` → lower to `0.1`.

**561499:** NAICS catch-all ("All Other Business Support Services"). Assigned by AI (P31)
when no confident classification is possible. Also produced by P0 when businesses
submit their own industry code on the onboarding form.

**MCC derivation:** `mcc_code_from_naics` derives directly from the winning NAICS code
via `rds_cases_public.rel_naics_mcc`. If NAICS is null or 561499, `mcc_code_from_naics` produces null or 7399.
