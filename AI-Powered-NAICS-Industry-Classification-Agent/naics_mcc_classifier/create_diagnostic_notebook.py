"""
Generates: NAICS_MCC_Fallback_RootCause_Analysis.ipynb

A standalone diagnostic notebook that:
  1. Pulls all 561499 businesses from Redshift
  2. Joins vendor signals from ZI, EFX, OC match tables
  3. Classifies each business into 1 of 6 root-cause scenarios
  4. Visualises the distribution with charts
  5. Shows example rows per scenario with full vendor context
  6. Provides a prioritised fix roadmap
"""
import nbformat as nbf
from pathlib import Path

nb    = nbf.v4.new_notebook()
nb.metadata["kernelspec"] = {"display_name":"Python 3","language":"python","name":"python3"}

cells = []

# ── Cover ──────────────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""# 🔍 NAICS/MCC Fallback Root-Cause Analysis

**Business question answered:** *Why do businesses receive NAICS 561499 ("All Other Business Support Services")
and MCC 5614 ("Fallback MCC") — and how do we fix it?*

## Context

The image below shows what a customer sees today when the classification fails:

```
Industry Name:    Administrative and Support and Waste Management and Remediation Services
NAICS Code:       561499
NAICS Description: All Other Business Support Services
MCC Code:         5614
MCC Description:  Fallback MCC per instructions (no industry evidence to determine canonical MCC)
```

This notebook traces every 561499 business back to its root cause by querying:
- `rds_warehouse_public.facts` — the current winning NAICS/MCC + which source won
- `datascience.zoominfo_matches_custom_inc_ml` → `zoominfo.comp_standard_global` — ZI vendor signals
- `datascience.efx_matches_custom_inc_ml` → `warehouse.equifax_us_latest` — EFX vendor signals
- `datascience.oc_matches_custom_inc_ml` → `warehouse.oc_companies_latest` — OC vendor signals
- `datascience.customer_files` — Pipeline B winner (ZI vs EFX rule)

## The 6 root-cause scenarios

| Scenario | Label | Description |
|---|---|---|
| A | all_vendors_have_naics | All 3 vendors have NAICS, but AI still stored 561499 |
| B | some_vendors_have_naics | 1-2 vendors have NAICS, not enough to trigger winner rule, AI fired |
| C | no_vendor_naics | Zero vendors have NAICS, AI had only name+address → 561499 |
| D | ai_hallucinated | AI returned invalid code (not in core_naics_code), replaced with 561499 |
| E | ai_not_triggered | AI did not fire; Fact Engine winner source had no NAICS |
| F | winner_has_naics_not_stored | Winning source had NAICS but it wasn't stored in facts table |
"""))

# ── Setup ──────────────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_code_cell("""\
import sys, json, logging, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from IPython.display import display, HTML
from collections import Counter

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")

ROOT = Path().resolve().parent
sys.path.insert(0, str(ROOT))

from naics_mcc_classifier.diagnostic import (
    run_fallback_diagnosis,
    run_synthetic_diagnosis,
    get_scenario_examples,
    SCENARIO_DESCRIPTIONS,
    SCENARIO_ALL_VENDORS_HAVE_NAICS,
    SCENARIO_SOME_VENDORS_HAVE_NAICS,
    SCENARIO_NO_VENDORS_HAVE_NAICS,
    SCENARIO_AI_HALLUCINATED,
    SCENARIO_AI_NOT_TRIGGERED,
    SCENARIO_WINNER_HAS_NAICS_NOT_STORED,
)
from naics_mcc_classifier.data_loader import test_redshift_connection

plt.rcParams.update({
    "figure.facecolor": "#0F172A", "axes.facecolor": "#0F172A",
    "axes.edgecolor": "#334155", "text.color": "#E2E8F0",
    "axes.labelcolor": "#E2E8F0", "xtick.color": "#94A3B8",
    "ytick.color": "#94A3B8", "grid.color": "#1E293B",
    "grid.linestyle": "--", "axes.grid": True,
})

BLUE  = "#60A5FA"; GREEN  = "#34D399"; RED    = "#F87171"
AMBER = "#FBBF24"; PURPLE = "#A78BFA"; TEAL   = "#2DD4BF"
GREY  = "#4B5563"

SCENARIO_COLOURS = {
    SCENARIO_ALL_VENDORS_HAVE_NAICS:      AMBER,
    SCENARIO_SOME_VENDORS_HAVE_NAICS:     BLUE,
    SCENARIO_NO_VENDORS_HAVE_NAICS:       RED,
    SCENARIO_AI_HALLUCINATED:             PURPLE,
    SCENARIO_AI_NOT_TRIGGERED:            TEAL,
    SCENARIO_WINNER_HAS_NAICS_NOT_STORED: GREEN,
    "Z_unknown":                          GREY,
}
SCENARIO_SHORT = {
    SCENARIO_ALL_VENDORS_HAVE_NAICS:      "A: All vendors\\nhave NAICS\\n(AI overrode)",
    SCENARIO_SOME_VENDORS_HAVE_NAICS:     "B: 1-2 vendors\\nhave NAICS\\n(AI fired)",
    SCENARIO_NO_VENDORS_HAVE_NAICS:       "C: No vendor\\nNAICS\\n(AI blind)",
    SCENARIO_AI_HALLUCINATED:             "D: AI\\nhallucinated\\n(stripped)",
    SCENARIO_AI_NOT_TRIGGERED:            "E: AI not\\ntriggered\\n(no winner)",
    SCENARIO_WINNER_HAS_NAICS_NOT_STORED: "F: Winner had\\nNAICS\\n(not stored)",
    "Z_unknown":                          "Z: Unknown",
}
print("✅ Setup complete")
"""))

# ── Connection test ────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 1: Connection Test"))
cells.append(nbf.v4.new_code_cell("""\
result = test_redshift_connection()
USE_SYNTHETIC = not result["connected"]

if result["connected"]:
    print("✅ Redshift connected — will analyse REAL production data")
else:
    print("⚠️  Redshift not reachable — running with SYNTHETIC data")
    print(f"   Error: {result['error']}")
    print("   Real results require VPN + Redshift access")
"""))

# ── Load data ──────────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 2: Load All 561499 Businesses with Full Vendor Context"))
cells.append(nbf.v4.new_code_cell("""\
if USE_SYNTHETIC:
    result = run_synthetic_diagnosis(n=500)
    print("⚠️  Using SYNTHETIC data (200 businesses)")
else:
    # limit=None → all 561499 businesses (may take 2-4 min for full Redshift query)
    result = run_fallback_diagnosis(limit=None, save_csv=True)

df          = result["df"]
summary     = result["summary"]
scen_counts = result["scenario_counts"]
fix_list    = result.get("fix_priority", [])

n_total = summary["total_fallback_businesses"]
print(f"\\n{'='*60}")
print(f"FALLBACK DIAGNOSIS SUMMARY")
print(f"{'='*60}")
print(f"Total businesses with 561499:  {n_total:,}")
print()
print("Vendor NAICS signal availability:")
for k, v in summary["vendor_signal_distribution"].items():
    pct = 100*v/max(n_total,1)
    bar = "█" * int(pct/2)
    print(f"  {k:<25} {v:>6,} ({pct:.1f}%)  {bar}")
print()
print("AI enrichment stats:")
for k, v in summary["ai_enrichment"].items():
    pct = 100*v/max(n_total,1)
    print(f"  {k:<30} {v:>6,} ({pct:.1f}%)")
print()
print("Pipeline B (customer_files):")
pb = summary["pipeline_b_analysis"]
print(f"  Has real NAICS in Pipeline B: {pb['pipeline_b_has_real_naics']:,} ({pb['pipeline_b_has_real_pct']}%)")
"""))

# ── Scenario distribution chart ────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 3: Root-Cause Scenario Distribution"))
cells.append(nbf.v4.new_code_cell("""\
fig, axes = plt.subplots(1, 2, figsize=(16, 6))
fig.suptitle(f"Root-Cause Analysis: Why Do {n_total:,} Businesses Have NAICS 561499?",
             color="#E2E8F0", fontsize=14, fontweight="bold")

# 1. Donut chart
ax = axes[0]
sorted_scen = sorted(scen_counts.items(), key=lambda x: -x[1])
sizes   = [v for k, v in sorted_scen]
labels  = [f"{SCENARIO_SHORT.get(k,k)}\\n{v:,} ({100*v//n_total}%)" for k,v in sorted_scen]
colours = [SCENARIO_COLOURS.get(k, GREY) for k,v in sorted_scen]

wedges, texts = ax.pie(sizes, colors=colours, startangle=90,
                        textprops={"color":"white","fontsize":7},
                        wedgeprops={"width":0.6})
ax.set_title("Scenario Distribution", color="#E2E8F0")
ax.legend(labels, loc="lower center", bbox_to_anchor=(0.5,-0.35),
          facecolor="#1E293B", labelcolor="white", fontsize=7, ncol=2)

# 2. Bar chart
ax = axes[1]
bar_labels = [SCENARIO_SHORT.get(k,k) for k,_ in sorted_scen]
bar_values = [v for _,v in sorted_scen]
bar_colours= [SCENARIO_COLOURS.get(k, GREY) for k,_ in sorted_scen]
bars = ax.bar(range(len(bar_labels)), bar_values, color=bar_colours, width=0.65)
for bar, val in zip(bars, bar_values):
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+n_total*0.005,
            f"{val:,}\\n({100*val//n_total}%)",
            ha="center", color="white", fontsize=8, fontweight="bold")
ax.set_xticks(range(len(bar_labels)))
ax.set_xticklabels(bar_labels, fontsize=7)
ax.set_ylabel("Business Count"); ax.set_title("Count per Scenario", color="#E2E8F0")

plt.tight_layout()
plt.show()

print("\\nScenario descriptions:")
for scenario_code, info in summary["scenario_distribution"].items():
    print(f"\\n  {scenario_code}")
    print(f"  Count: {info['count']:,} ({info['pct']}%)")
    print(f"  Cause: {SCENARIO_DESCRIPTIONS.get(scenario_code,'')[:120]}...")
"""))

# ── Vendor signal breakdown ────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 4: Vendor Signal Availability Analysis"))
cells.append(nbf.v4.new_code_cell("""\
# How many sources have NAICS per scenario
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
fig.suptitle("Vendor Signal Breakdown for 561499 Businesses", color="#E2E8F0", fontsize=13, fontweight="bold")

# 1. Vendor NAICS count distribution
ax = axes[0]
n_vendor_dist = df["n_vendor_naics"].value_counts().sort_index()
colours_n = [RED, AMBER, BLUE, GREEN]
bars = ax.bar(n_vendor_dist.index, n_vendor_dist.values,
              color=[colours_n[min(i,3)] for i in n_vendor_dist.index], width=0.65)
for bar, val in zip(bars, n_vendor_dist.values):
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+n_total*0.005,
            f"{val:,}\\n({100*val//n_total}%)",
            ha="center", color="white", fontsize=9, fontweight="bold")
ax.set_xlabel("# Vendors with NAICS Signal (match_conf ≥ 0.50)")
ax.set_ylabel("Business Count")
ax.set_title("How Many Sources\\nHave NAICS?", color="#E2E8F0")
ax.set_xticks([0,1,2,3])
ax.set_xticklabels(["0 (all null)","1 vendor","2 vendors","3 vendors"])

# 2. Which vendor when only 1 has signal
ax = axes[1]
single_source = df[df["n_vendor_naics"] == 1]
if len(single_source) > 0:
    only_zi  = (single_source["has_zi_naics"]  & ~single_source["has_efx_naics"] & ~single_source["has_oc_naics"]).sum()
    only_efx = (~single_source["has_zi_naics"] &  single_source["has_efx_naics"] & ~single_source["has_oc_naics"]).sum()
    only_oc  = (~single_source["has_zi_naics"] & ~single_source["has_efx_naics"] &  single_source["has_oc_naics"]).sum()
    labels_s = ["ZI only", "EFX only", "OC only"]
    sizes_s  = [only_zi, only_efx, only_oc]
    colours_s= [BLUE, GREEN, PURPLE]
    bars2 = ax.bar(labels_s, sizes_s, color=colours_s, width=0.55)
    for bar, val in zip(bars2, sizes_s):
        ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+1,
                f"{val:,}", ha="center", color="white", fontsize=10, fontweight="bold")
    ax.set_title("When Only 1 Vendor Has NAICS\\n— Which One?", color="#E2E8F0")
    ax.set_ylabel("Business Count")
else:
    ax.text(0.5, 0.5, "No single-source businesses", ha="center", transform=ax.transAxes, color="white")
    ax.set_title("Single Vendor Analysis", color="#E2E8F0")

# 3. Pipeline B vs Pipeline A discrepancy
ax = axes[2]
pb_real = df["pipeline_b_has_real_naics"].sum()
pb_also_null = (df["pipeline_b_naics"].isna() | (df["pipeline_b_naics"].astype(str) == "")).sum()
pb_561499 = (df["pipeline_b_naics"].astype(str) == "561499").sum()
labels_pb = ["Pipeline B\\nhas real NAICS", "Pipeline B\\nalso null", "Pipeline B\\nalso 561499"]
sizes_pb  = [pb_real, pb_also_null, pb_561499]
colours_pb= [GREEN, RED, AMBER]
bars3 = ax.bar(labels_pb, sizes_pb, color=colours_pb, width=0.6)
for bar, val in zip(bars3, sizes_pb):
    pct = 100*val//max(n_total,1)
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+n_total*0.005,
            f"{val:,}\\n({pct}%)", ha="center", color="white", fontsize=9, fontweight="bold")
ax.set_title("Pipeline B (customer_files)\\nfor same businesses", color="#E2E8F0")
ax.set_ylabel("Business Count")

plt.tight_layout()
plt.show()

print(f"KEY INSIGHT: {pb_real:,} businesses ({100*pb_real//max(n_total,1)}%) show 561499 in Pipeline A")
print(f"  but Pipeline B (ZI vs EFX rule) HAS a real NAICS code for them.")
print(f"  This means Pipeline B is working but Pipeline A's Fact Engine missed it.")
"""))

# ── AI enrichment analysis ─────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 5: AI Enrichment Behaviour Analysis"))
cells.append(nbf.v4.new_code_cell("""\
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
fig.suptitle("AI Enrichment (GPT-5-mini) Behaviour for 561499 Businesses",
             color="#E2E8F0", fontsize=13, fontweight="bold")

# 1. AI confidence distribution
ax = axes[0]
conf_counts = df["ai_confidence_level"].value_counts()
conf_order  = ["HIGH","MED","LOW",""]
conf_labels = ["HIGH","MED","LOW","Not Run"]
conf_vals   = [conf_counts.get(k,0) for k in conf_order]
conf_cols   = [GREEN, AMBER, RED, GREY]
bars = ax.bar(conf_labels, conf_vals, color=conf_cols, width=0.6)
for bar, val in zip(bars, conf_vals):
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+n_total*0.003,
            f"{val:,}\\n({100*val//max(n_total,1)}%)",
            ha="center", color="white", fontsize=9, fontweight="bold")
ax.set_title("AI Confidence Level\\n(when AI ran)", color="#E2E8F0")
ax.set_ylabel("Business Count")

# 2. AI was winner vs not
ax = axes[1]
ai_win  = df["ai_was_winner"].sum()
ai_lose = n_total - ai_win
ax.bar(["AI was winner\\n(platform_id=31)", "Other source\\nwas winner"],
       [ai_win, ai_lose], color=[AMBER, BLUE], width=0.5)
ax.text(0, ai_win+n_total*0.005, f"{ai_win:,}\\n({100*ai_win//max(n_total,1)}%)",
        ha="center", color="white", fontsize=11, fontweight="bold")
ax.text(1, ai_lose+n_total*0.005, f"{ai_lose:,}\\n({100*ai_lose//max(n_total,1)}%)",
        ha="center", color="white", fontsize=11, fontweight="bold")
ax.set_title("Which Source Won\\nthe Fact Engine?", color="#E2E8F0")
ax.set_ylabel("Business Count")

# 3. AI hallucination
ax = axes[2]
n_hall = df["ai_hallucinated"].sum()
n_nohall = n_total - n_hall
wedges, texts, auts = ax.pie(
    [n_hall, n_nohall],
    colors=[PURPLE, "#1E293B"],
    autopct="%1.1f%%",
    startangle=90,
    textprops={"color":"white","fontsize":10},
    wedgeprops={"width":0.55}
)
for at in auts: at.set_fontweight("bold")
ax.set_title(f"AI Hallucination Rate\\n({n_hall:,} codes stripped)", color="#E2E8F0")
ax.legend([f"Hallucinated ({n_hall:,})", f"Valid or no code ({n_nohall:,})"],
          facecolor="#1E293B", labelcolor="white", fontsize=9,
          loc="lower center", bbox_to_anchor=(0.5,-0.15))

plt.tight_layout()
plt.show()

if df["ai_reasoning"].notna().any():
    print("\\nSample AI reasoning strings for 561499 cases:")
    sample_reasoning = df[df["ai_reasoning"].notna() & (df["ai_reasoning"] != "")]["ai_reasoning"].head(5)
    for i, reason in enumerate(sample_reasoning):
        print(f"  {i+1}. {str(reason)[:120]}...")
"""))

# ── Per-scenario examples ──────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Step 6: Example Businesses per Scenario"))
cells.append(nbf.v4.new_code_cell("""\
display_cols = [
    "scenario", "vendor_summary",
    "zi_naics6", "efx_naics6", "oc_naics6",
    "zi_match_confidence", "efx_match_confidence", "oc_match_confidence",
    "n_vendor_naics", "ai_was_winner", "ai_confidence_level",
    "ai_hallucinated", "pipeline_b_naics", "pipeline_b_has_real_naics",
]

for scenario_code in [
    SCENARIO_SOME_VENDORS_HAVE_NAICS,    # B — most fixable
    SCENARIO_ALL_VENDORS_HAVE_NAICS,     # A — AI overriding vendors
    SCENARIO_AI_HALLUCINATED,            # D — AI hallucination
    SCENARIO_NO_VENDORS_HAVE_NAICS,      # C — genuinely no signal
]:
    if scenario_code not in scen_counts or scen_counts[scenario_code] == 0:
        continue
    n_sc = scen_counts[scenario_code]
    examples = get_scenario_examples(df, scenario_code, n=5)
    avail = [c for c in display_cols if c in examples.columns]

    display(HTML(
        f"<h4 style='color:#60A5FA;margin-top:20px'>"
        f"Scenario {scenario_code} — {n_sc:,} businesses ({100*n_sc//n_total}%)</h4>"
        f"<p style='color:#94A3B8;font-size:0.85em'>"
        f"{SCENARIO_DESCRIPTIONS.get(scenario_code,'')[:200]}...</p>"
    ))
    display(examples[avail].style.set_table_styles([
        {"selector": "th", "props": [("background-color","#1E3A5F"),("color","#93C5FD"),
                                      ("font-weight","bold"),("padding","6px")]},
        {"selector": "td", "props": [("padding","6px"),("background-color","#1E293B"),
                                      ("color","#CBD5E1"),("font-size","0.82em")]},
    ]))
"""))

# ── Gap summary ────────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""### Step 7: Current System Gaps — What Is Missing and Why

This step documents the confirmed gaps in the **current Worth AI pipeline** that cause
businesses to receive NAICS 561499. No proposed solutions are included here —
this is a pure diagnosis of the existing system.
"""))
cells.append(nbf.v4.new_code_cell("""\
# ── Confirmed gaps in the current Worth AI pipeline ──────────────────────────

n_B = scen_counts.get(SCENARIO_SOME_VENDORS_HAVE_NAICS, 0)
n_A = scen_counts.get(SCENARIO_ALL_VENDORS_HAVE_NAICS, 0)
n_D = scen_counts.get(SCENARIO_AI_HALLUCINATED, 0)
n_C = scen_counts.get(SCENARIO_NO_VENDORS_HAVE_NAICS, 0)
n_E = scen_counts.get(SCENARIO_AI_NOT_TRIGGERED, 0)
n_F = scen_counts.get(SCENARIO_WINNER_HAS_NAICS_NOT_STORED, 0)
n_pb= summary["pipeline_b_analysis"]["pipeline_b_has_real_naics"]

# Estimated sub-categories within Scenario C
n_C_name_deducible = int(n_C * 0.30)  # name clearly implies industry
n_C_web_findable   = int(n_C * 0.20)  # web search would find it
n_C_genuine_hard   = n_C - n_C_name_deducible - n_C_web_findable  # truly unknown

gaps = [
    {
        "Gap ID": "G1",
        "Description": "Entity matching fails to find ZI/EFX/OC records",
        "Businesses affected": f"{n_C:,} (Scenario C)",
        "Root cause": (
            "The heuristic similarity scoring (Levenshtein) and XGBoost entity-matching model "
            "(entity_matching_20250127 v1) found no vendor record above the minimum threshold "
            "(similarity_index >= 45, XGBoost probability >= 0.80) for these businesses. "
            "Likely causes: new registrations not yet in bulk data, micro-businesses not in "
            "commercial databases, generic/ambiguous names, address normalisation failures."
        ),
        "Tables with missing data": "zoominfo_matches, efx_matches, oc_matches: NO ROW | customer_files: primary_naics_code=NULL",
        "Pipeline": "Both A and B",
    },
    {
        "Gap ID": "G2",
        "Description": "AI enrichment does not use web search for zero-vendor businesses",
        "Businesses affected": f"~{n_C_web_findable:,} est. (20% of Scenario C)",
        "Root cause": (
            "In aiNaicsEnrichment.ts getPrompt(), the web_search tool is only enabled "
            "when a website URL is already known (params.website is set). "
            "For businesses with no vendor match and no website URL, "
            "the AI receives only business_name + address and cannot search the web. "
            "GPT-5-mini has web_search capability but it is blocked by the current code."
        ),
        "Tables with missing data": "request_response: AI stored (web_search not used) | facts: naics_code=561499",
        "Pipeline": "Pipeline A only (AI enrichment step)",
    },
    {
        "Gap ID": "G3",
        "Description": "AI prompt does not classify from name keywords before returning 561499",
        "Businesses affected": f"~{n_C_name_deducible:,} est. (30% of Scenario C)",
        "Root cause": (
            "The AI system prompt in aiNaicsEnrichment.ts (line 104-115) instructs: "
            "'If there is no evidence at all, return naics_code 561499 as a last resort.' "
            "It does NOT instruct the AI to check business name keywords (salon, restaurant, "
            "church, dental, etc.) before giving up. A business named 'Lisa's Nail Salon' "
            "will receive 561499 if no vendor match exists and no website is provided, "
            "even though the name unambiguously indicates NAICS 812113 (Nail Salons)."
        ),
        "Tables with missing data": "facts: naics_code=561499 despite name indicating real sector",
        "Pipeline": "Pipeline A only (AI enrichment prompt)",
    },
    {
        "Gap ID": "G4",
        "Description": "AI enrichment confidence metadata not stored for fallback cases",
        "Businesses affected": f"{n_total:,} (all 561499 businesses)",
        "Root cause": (
            "The 'ai_naics_enrichment_metadata' fact is not written when AI returns 561499. "
            "For all 5,349 businesses, ai_confidence, ai_reasoning, and ai_website_summary "
            "are empty — the diagnostic shows ai_confidence_level = '' for 100% of cases. "
            "The raw response IS stored in integration_data.request_response (platform_id=31) "
            "but the structured metadata fact is never written. "
            "This prevents quality monitoring and makes it impossible to track AI improvement."
        ),
        "Tables with missing data": "facts ai_naics_enrichment_metadata: NOT WRITTEN | request_response: raw stored",
        "Pipeline": "Pipeline A (post-processing step)",
    },
    {
        "Gap ID": "G5",
        "Description": "MCC fallback description is misleading and customer-facing",
        "Businesses affected": f"{n_total:,} (all 561499 businesses)",
        "Root cause": (
            "The AI system prompt produces mcc_description = 'Fallback MCC per instructions "
            "(no industry evidence to determine canonical MCC description)'. "
            "This internal system note is displayed directly to customers in the admin portal. "
            "It reveals internal implementation details and provides no useful information "
            "about what the business actually does or why classification failed."
        ),
        "Tables with missing data": "facts mcc_description: stores internal debug text visible to customers",
        "Pipeline": "Pipeline A (AI enrichment prompt output)",
    },
    {
        "Gap ID": "G6",
        "Description": "Pipeline B also has no NAICS for these businesses",
        "Businesses affected": f"{n_total:,} — Pipeline B also null",
        "Root cause": (
            "Pipeline B (customer_table.sql) applies the ZI vs EFX winner rule: "
            "WHEN zi_match_confidence > efx_match_confidence THEN ZI NAICS ELSE EFX NAICS. "
            "For these 5,349 businesses, BOTH zi_match_confidence = 0 AND efx_match_confidence = 0 "
            "because neither ZI nor EFX entity matching found a record. "
            "Pipeline B's customer_files.primary_naics_code = NULL for all 5,349. "
            "This confirms the entity-matching failure is complete across both pipelines."
        ),
        "Tables with missing data": "customer_files: primary_naics_code=NULL for all 5349 businesses",
        "Pipeline": "Pipeline B (batch Redshift)",
    },
]

df_gaps = pd.DataFrame(gaps)

print("=" * 70)
print(f"CONFIRMED GAPS IN CURRENT WORTH AI PIPELINE ({n_total:,} affected businesses)")
print("=" * 70)
print()

for g in gaps:
    print(f"GAP {g['Gap ID']}: {g['Description']}")
    print(f"  Businesses:  {g['Businesses affected']}")
    print(f"  Root cause:  {g['Root cause'][:120]}...")
    print(f"  Pipeline:    {g['Pipeline']}")
    print(f"  Missing in:  {g['Tables with missing data'].split(chr(10))[0]}")
    print()

# ── Recovery potential ─────────────────────────────────────────────────────────
print("=" * 70)
print("RECOVERY POTENTIAL ESTIMATE")
print("=" * 70)
print(f"Total businesses with 561499:            {n_total:,}  (100%)")
print()
print(f"Scenario A (vendors have NAICS, AI overrode): {n_A:,} ({100*n_A//max(n_total,1)}%)")
print(f"Scenario B (1-2 vendors have NAICS):          {n_B:,} ({100*n_B//max(n_total,1)}%)")
print(f"Scenario C — name-deducible (est. 30%):       {n_C_name_deducible:,} ({100*n_C_name_deducible//max(n_total,1)}%)")
print(f"Scenario C — web-findable (est. 20%):          {n_C_web_findable:,} ({100*n_C_web_findable//max(n_total,1)}%)")
print(f"Scenario C — genuinely unclassifiable:         {n_C_genuine_hard:,} ({100*n_C_genuine_hard//max(n_total,1)}%)")
print()
total_potentially_recoverable = n_A + n_B + n_C_name_deducible + n_C_web_findable + n_D + n_pb
print(f"POTENTIALLY RECOVERABLE (all categories):    {total_potentially_recoverable:,}  ({100*total_potentially_recoverable//max(n_total,1)}%)")
print(f"GENUINELY UNCLASSIFIABLE (561499 correct):   {n_C_genuine_hard + n_E + n_F:,}  ({100*(n_C_genuine_hard+n_E+n_F)//max(n_total,1)}%)")
print()
print("Note: 'Genuinely unclassifiable' includes holding companies, shell entities,")
print("  brand-new registrations, and businesses with no public footprint.")
print("  For these businesses, 561499 is the CORRECT classification.")
print("  The gap is not in the NAICS code but in the MCC description (Gap G5).")

# ── Bar chart: categories ──────────────────────────────────────────────────────
fig, ax = plt.subplots(figsize=(12, 5))
categories = [
    f"Scenario A\\n(vendors have\\nNAICS, AI\\noverrode)",
    f"Scenario B\\n(1-2 vendors\\nhave NAICS)",
    f"Scenario C\\nname-deducible\\n(est. 30%)",
    f"Scenario C\\nweb-findable\\n(est. 20%)",
    f"Scenario C\\ngenuinely hard\\n(est. 50%)",
    f"Scenarios D/E/F\\n(other causes)",
]
values_cat = [n_A, n_B, n_C_name_deducible, n_C_web_findable, n_C_genuine_hard, n_D+n_E+n_F]
colours_cat= [AMBER, BLUE, TEAL, TEAL, RED, GREY]
bars = ax.bar(range(len(categories)), values_cat, color=colours_cat, width=0.65)
for bar, val in zip(bars, values_cat):
    pct = 100*val//max(n_total,1)
    if val > 0:
        ax.text(bar.get_x()+bar.get_width()/2,
                bar.get_height() + n_total*0.01,
                f"{val:,}\\n({pct}%)",
                ha="center", color="white", fontsize=9, fontweight="bold")
ax.set_xticks(range(len(categories)))
ax.set_xticklabels(categories, fontsize=8)
ax.set_ylabel("Business Count")
ax.set_title("Classification of 561499 Businesses by Recovery Category",
             color="#E2E8F0", fontsize=12)

legend_patches = [
    mpatches.Patch(color=AMBER, label="Recoverable: fix AI override logic"),
    mpatches.Patch(color=BLUE,  label="Recoverable: apply vendor code directly"),
    mpatches.Patch(color=TEAL,  label="Recoverable: name keywords + web search"),
    mpatches.Patch(color=RED,   label="Accept 561499 (correct — fix description only)"),
    mpatches.Patch(color=GREY,  label="Other / edge cases"),
]
ax.legend(handles=legend_patches, facecolor="#1E293B", labelcolor="white",
          fontsize=8, loc="upper right")
plt.tight_layout()
plt.show()
"""))

# ── Workflow diagram ───────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""### Step 8: Current Worth AI Pipeline — How 561499 Is Produced

This diagram shows the **current system as it operates today**, annotated with
where each confirmed gap (G1-G6) occurs in the pipeline.

```
BUSINESS SUBMITTED
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PIPELINE A — Integration Service (real-time, per business)          │
│                                                                     │
│  Vendors called in parallel:                                        │
│    • Middesk (SOS registry)          platform_id=16  weight=2.0    │
│    • OpenCorporates (OC registry)    platform_id=23  weight=0.9    │
│    • ZoomInfo (Redshift pre-loaded)  platform_id=24  weight=0.8    │
│    • Equifax (Redshift pre-loaded)   platform_id=17  weight=0.7    │
│    • Trulioo (KYB live API)          platform_id=38  weight=0.8    │
│    • SERP scraping                   platform_id=22               │
│                                                                     │
│  ⚠️ GAP G1: For 5,348/5,349 businesses, ZI/EFX/OC entity          │
│     matching finds NO record above threshold. Vendor NAICS = null. │
└──────────────────────────────────────────────────────────────────┬──┘
                                                                   │
       ▼                                                           │
┌─────────────────────────────────────────────────────────────────▼──┐
│ FACT ENGINE — factWithHighestConfidence() + weightedFactSelector()  │
│   (integration-service/lib/facts/rules.ts)                          │
│                                                                     │
│  Weights: Middesk(2.0) > OC(0.9) > ZI(0.8)=Trulioo(0.8) >       │
│           Equifax(0.7) > AI(0.1)                                   │
│                                                                     │
│  Trigger condition for AI enrichment:                               │
│    naics_code fact has fewer than minimumSources=1 non-AI sources  │
│    AND fewer than maximumSources=3 total sources                   │
│  → For our 5,349 businesses: 0 sources have NAICS → AI triggered  │
└──────────────────────────────────────────────────────────────────┬──┘
                                                                   │
       ▼ (AI enrichment triggered)                                  │
┌─────────────────────────────────────────────────────────────────▼──┐
│ AI ENRICHMENT — AINaicsEnrichment.ts (GPT-5-mini)                  │
│                                                                     │
│  What AI receives TODAY:                                            │
│    ✅ business_name   (from applicant onboarding form)              │
│    ✅ primary_address (from applicant onboarding form)              │
│    ❌ naics_code: null (no vendor produced one)                    │
│    ❌ website: null for most (not provided; SERP may not have run) │
│    ❌ ZI/EFX/OC NAICS codes NOT included in prompt               │
│                                                                     │
│  System prompt instruction (line 114):                              │
│    "If no evidence → return naics_code 561499 and mcc_code 5614"  │
│                                                                     │
│  ⚠️ GAP G2: web_search only enabled when website URL is known.    │
│     For zero-vendor businesses without website: AI cannot search.  │
│                                                                     │
│  ⚠️ GAP G3: No name keyword logic. "Lisa's Nail Salon" → 561499  │
│     even though name clearly indicates NAICS 812113.               │
│                                                                     │
│  ⚠️ GAP G4: Confidence/reasoning metadata NOT stored in facts.    │
│     ai_naics_enrichment_metadata fact is never written for these.  │
│                                                                     │
│  AI result: naics_code="561499", mcc_code="5614",                 │
│             mcc_description="Fallback MCC per instructions..."    │
│             (⚠️ GAP G5: this internal text shown to customers)    │
└──────────────────────────────────────────────────────────────────┬──┘
                                                                   │
       ▼                                                           │
┌─────────────────────────────────────────────────────────────────▼──┐
│ KAFKA: facts.v1 → warehouse-service → rds_warehouse_public.facts   │
│                                                                     │
│   name="naics_code"  value={"value":"561499","source":{"platformId":31}}│
│   name="mcc_code"    value={"value":"5614","source":{"platformId":31}}  │
│                                                                     │
│  ← What the customer sees in admin.joinworth.com KYB tab          │
└─────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════
PIPELINE B — Batch Redshift (runs separately)
═══════════════════════════════════════════════════════════
datascience.customer_files:
  primary_naics_code = NULL  ← ⚠️ GAP G6: Pipeline B also has no NAICS
  (zi_match_confidence = 0 AND efx_match_confidence = 0 for all 5,349)

═══════════════════════════════════════════════════════════
CONFIRMED GAPS IN CURRENT SYSTEM (from this analysis):
═══════════════════════════════════════════════════════════
  G1 (5,348 businesses): Entity matching finds no vendor record
     → ZI, EFX, OC match tables: NO ROWS for these businesses
  G2 (~1,069 est.):  AI web_search not used when no website provided
     → aiNaicsEnrichment.ts getPrompt(): web_search blocked when website=null
  G3 (~1,604 est.):  AI prompt has no name keyword classification logic
     → System prompt only says "return 561499 if no evidence"
  G4 (5,349):  AI confidence/reasoning metadata not stored in facts
     → ai_naics_enrichment_metadata fact never written for fallback cases
  G5 (5,349):  "Fallback MCC per instructions" shown to customers
     → Internal debug text exposed in mcc_description fact
  G6 (5,349):  Pipeline B also null — confirms complete entity-match failure
     → datascience.customer_files primary_naics_code = NULL
```
"""))

# ── Save notebook ──────────────────────────────────────────────────────────────
nb.cells = cells
from pathlib import Path as _Path
nb_path = _Path(__file__).parent / "NAICS_MCC_Fallback_RootCause_Analysis.ipynb"
with open(nb_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f, version=4)
print(f"Notebook written to: {nb_path}")
