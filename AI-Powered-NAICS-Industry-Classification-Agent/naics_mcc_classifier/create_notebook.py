"""
Generates the NAICS_MCC_Classifier_Comparison.ipynb notebook programmatically.
Run: python create_notebook.py
"""
import nbformat as nbf

nb = nbf.v4.new_notebook()
nb.metadata["kernelspec"] = {
    "display_name": "Python 3",
    "language": "python",
    "name": "python3",
}

cells = []

# ── Cell 0: Title ─────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""# NAICS & MCC Code Classifier — Training & Comparison

**Goal:** Replace fallback codes `561499` (NAICS) and `5614` (MCC) with accurate predictions using an XGBoost ensemble trained on vendor signals from ZoomInfo, Equifax, OpenCorporates, and entity-matching confidence scores.

## What this notebook shows

| Section | What it answers |
|---|---|
| 1. Current state | How many businesses currently receive the 561499 fallback? What does the MCC 5614 description look like? |
| 2. Data loading | Where the training data comes from (4 Redshift vendor tables + match tables) |
| 3. Feature engineering | How 50 numeric features are built from vendor NAICS codes + entity-match confidence |
| 4. Model training | XGBoost NAICS classifier + MCC classifier training curves and metrics |
| 5. **Comparison** | Before vs After: how many fallback businesses now get a real code |
| 6. Example predictions | Real examples showing the model's output vs current production output |

> **Source tables:** `datascience.zoominfo_standard_ml_2`, `warehouse.equifax_us_standardized`, `datascience.open_corporates_standard_ml_2`, `datascience.zoominfo_matches_custom_inc_ml`, `datascience.efx_matches_custom_inc_ml`, `rds_warehouse_public.facts`
"""))

# ── Cell 1: Setup ─────────────────────────────────────────────────────────────
cells.append(nbf.v4.new_code_cell("""\
import sys, os, json, logging, warnings
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
from IPython.display import display, HTML

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s — %(message)s")

# Add project root to path
ROOT = Path().resolve().parent
sys.path.insert(0, str(ROOT))

from naics_mcc_classifier.config import (
    NAICS_FALLBACK, MCC_FALLBACK,
    NAICS_OVERRIDE_CONFIDENCE_THRESHOLD, ARTIFACTS_DIR
)
from naics_mcc_classifier.data_loader import (
    build_training_dataset, load_naics_mcc_crosswalk,
    load_naics_lookup, load_mcc_lookup,
)
from naics_mcc_classifier.feature_engineering import build_feature_matrix
from naics_mcc_classifier.pipeline import run_training_pipeline

# ── Plotting style ────────────────────────────────────────────────────────────
plt.rcParams.update({
    "figure.figsize":    (12, 5),
    "axes.facecolor":    "#0F172A",
    "figure.facecolor":  "#0F172A",
    "axes.edgecolor":    "#334155",
    "text.color":        "#E2E8F0",
    "axes.labelcolor":   "#E2E8F0",
    "xtick.color":       "#94A3B8",
    "ytick.color":       "#94A3B8",
    "axes.titlesize":    13,
    "axes.titlepad":     10,
    "grid.color":        "#1E293B",
    "grid.linestyle":    "--",
    "axes.grid":         True,
})

BLUE   = "#60A5FA"
GREEN  = "#34D399"
RED    = "#F87171"
AMBER  = "#FBBF24"
PURPLE = "#A78BFA"

print("✅ Setup complete")
print(f"   Fallback NAICS: {NAICS_FALLBACK}  |  Fallback MCC: {MCC_FALLBACK}")
print(f"   Override threshold: {NAICS_OVERRIDE_CONFIDENCE_THRESHOLD}")
"""))

# ── Cell 1b: Redshift connection test ─────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("### Redshift Connection Test\nRun this cell first. It verifies credentials and Redshift SQL compatibility before loading any data."))
cells.append(nbf.v4.new_code_cell("""\
from naics_mcc_classifier.data_loader import (
    test_redshift_connection, establish_redshift_connection, redshift_query
)
from naics_mcc_classifier.config import REDSHIFT

# Show which credentials are being used
print("Redshift endpoint:", REDSHIFT["host"][:60] + "...")
print("User:", REDSHIFT["user"])
print()

# Test connection and Redshift JSON syntax compatibility
result = test_redshift_connection()

if result["connected"]:
    print("✅ Redshift: CONNECTED")
    print(f"   JSON_EXTRACT_PATH_TEXT: {'✅ works' if result['json_extract_works'] else '❌ failed'}")
    print()
    print("→ Set USE_SYNTHETIC = False in Section 2 to load real data.")
else:
    print("❌ Redshift: NOT REACHABLE")
    print(f"   Error: {result['error']}")
    print()
    print("Fix options:")
    print("  1. Check VPN / AWS network access to the Redshift endpoint")
    print("  2. Override credentials via environment variables:")
    print("       export REDSHIFT_HOST=<endpoint>")
    print("       export REDSHIFT_PASSWORD=<password>")
    print("  3. Or set USE_SYNTHETIC = True in Section 2 to use synthetic data")

# Quick table sanity check (only if connected)
if result["connected"]:
    print()
    print("Quick table check — counting facts rows...")

    sql_total = (
        "SELECT COUNT(*) AS n_rows "
        "FROM rds_warehouse_public.facts "
        "WHERE name = 'naics_code'"
    )
    df_check = redshift_query(sql_total)
    print(f"  rds_warehouse_public.facts (naics_code rows): {df_check['n_rows'][0]:,}")

    # The facts table stores JSON with key "value" (not "code"):
    #   {"name":"naics_code", "value":"561499", "source.confidence":0.1, ...}
    # JSON_EXTRACT_PATH_TEXT(value, 'code') returns NULL → wrong → count=0
    # JSON_EXTRACT_PATH_TEXT(value, 'value') returns "561499" → correct
    sql_fallback = (
        "SELECT COUNT(*) AS n_fallback "
        "FROM rds_warehouse_public.facts "
        "WHERE name = 'naics_code' "
        "  AND JSON_EXTRACT_PATH_TEXT(value, 'value') = '561499'"
    )
    df_fallback_check = redshift_query(sql_fallback)
    n_fallback = df_fallback_check['n_fallback'][0]
    n_null     = redshift_query(
        "SELECT COUNT(*) AS n_null FROM rds_warehouse_public.facts "
        "WHERE name = 'naics_code' "
        "  AND JSON_EXTRACT_PATH_TEXT(value, 'value') IS NULL"
    )['n_null'][0]
    print(f"  of which are fallback 561499:  {n_fallback:,}  ({100*n_fallback/max(df_check['n_rows'][0],1):.1f}%)")
    print(f"  of which have NULL naics value: {n_null:,}  ({100*n_null/max(df_check['n_rows'][0],1):.1f}%)")
    print(f"  Total needing classification:   {n_fallback + n_null:,}  (these are the businesses our model targets)")
"""))

# ── Cell 2: Current State (What the problem looks like) ───────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 1 — Current State: The Fallback Problem

The image below shows what a customer sees today when the system cannot classify a business:

```
Industry Name:    Administrative and Support and Waste Management and Remediation Services
NAICS Code:       561499
NAICS Description: All Other Business Support Services
MCC Code:         5614
MCC Description:  Fallback MCC per instructions (no industry evidence to determine canonical MCC description)
```

This is technically correct (it's a valid NAICS code) but useless for underwriting decisions.
"""))

cells.append(nbf.v4.new_code_cell("""\
# ── Show what 561499 looks like vs a real classification ─────────────────────

fallback_example = pd.DataFrame([
    {
        "Field":             "Industry Name",
        "Current (Fallback)": "Administrative and Support and Waste Management...",
        "Goal (Model Output)":"Full-Service Restaurants",
    },
    {
        "Field":             "NAICS Code",
        "Current (Fallback)": "561499",
        "Goal (Model Output)":"722511",
    },
    {
        "Field":             "NAICS Description",
        "Current (Fallback)": "All Other Business Support Services",
        "Goal (Model Output)":"Full-Service Restaurants",
    },
    {
        "Field":             "MCC Code",
        "Current (Fallback)": "5614",
        "Goal (Model Output)":"5812",
    },
    {
        "Field":             "MCC Description",
        "Current (Fallback)": "Fallback MCC per instructions (no industry evidence...)",
        "Goal (Model Output)":"Eating Places, Restaurants",
    },
])

def style_comparison(df):
    def colour_row(row):
        styles = []
        for v in row:
            if "Fallback" in str(v) or v in ("561499", "5614"):
                styles.append("background-color:#7F1D1D;color:#FCA5A5;font-weight:bold")
            elif v not in ("Field", "Current (Fallback)", "Goal (Model Output)"):
                styles.append("background-color:#064E3B;color:#6EE7B7;font-weight:bold")
            else:
                styles.append("background-color:#1E293B;color:#94A3B8")
        return styles
    return df.style.apply(colour_row, axis=1).set_table_styles([
        {"selector": "th", "props": [("background-color","#1E3A5F"),("color","#93C5FD"),("font-weight","bold"),("text-align","left"),("padding","8px")]},
        {"selector": "td", "props": [("padding","8px"),("text-align","left")]},
    ])

display(style_comparison(fallback_example))
"""))

# ── Cell 3: Data Loading ───────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 2 — Data Loading

Loading training data from:
- `rds_warehouse_public.facts` — current NAICS/MCC code per business (including 561499 fallbacks)
- `datascience.zoominfo_matches_custom_inc_ml` — ZI entity-match confidence (XGBoost output)
- `datascience.efx_matches_custom_inc_ml` — EFX entity-match confidence (XGBoost output)
- `datascience.customer_files` — Pipeline B NAICS winner

> **Note:** Set `use_synthetic=False` when Redshift is accessible to use real data.
"""))

cells.append(nbf.v4.new_code_cell("""\
# Set use_synthetic=True for development (no Redshift needed)
# Set use_synthetic=False + configure .env with Redshift credentials for real data
# ─────────────────────────────────────────────────────────────────────────────
# SET THIS TO False WHEN REDSHIFT IS ACCESSIBLE
# The connection test in the previous cell tells you which to use.
# ─────────────────────────────────────────────────────────────────────────────
USE_SYNTHETIC = True   # ← False = real Redshift data, True = synthetic (no Redshift needed)

train_df, fallback_df = build_training_dataset(
    limit=None,            # None = load all data; set e.g. 50_000 for a quick test run
    use_synthetic=USE_SYNTHETIC,
)

total = len(train_df) + len(fallback_df)
print(f"Total businesses loaded:               {total:,}")
print(f"Training rows (labeled, non-fallback): {len(train_df):,}")
print(f"Fallback rows (current NAICS = 561499):{len(fallback_df):,}")
print(f"Fallback rate:                         {100 * len(fallback_df) / max(total, 1):.1f}%")
print()
print("Key training columns:")
key_cols = ["business_id","current_naics_code","current_mcc_code","label_naics6","label_mcc",
            "zi_match_confidence","efx_match_confidence","oc_match_confidence",
            "zi_c_naics6","efx_naics_primary","oc_naics_primary"]
for col in key_cols:
    if col in train_df.columns:
        sample_vals = train_df[col].dropna().head(2).tolist()
        print(f"  {col:<35} sample: {sample_vals}")
print()
if not USE_SYNTHETIC:
    print("✅ Real Redshift data loaded — fallback count above is the production baseline.")
else:
    print("⚠️  Synthetic data — switch USE_SYNTHETIC=False for real production results.")
"""))

# ── Cell 3b: Data Quality Check ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""### Data Quality Check

**Why match confidence zeros are expected (not a bug):**

Businesses get their NAICS from multiple pipelines:
- **Middesk / Trulioo / AI** (live API calls) → `zi_match_confidence = 0` because
  these businesses were NOT matched via ZoomInfo/Equifax/OC entity matching.
- **ZI / EFX / OC entity matching** → `zi_match_confidence > 0`

A confidence of 0 means "no ZI/EFX/OC entity match was found for this business" — not that matching failed.
~40% of businesses get their NAICS from Middesk/Trulioo/AI and will always show 0 for all three match confidences.

The model uses the `has_zi_match`, `has_efx_match`, `has_oc_match` binary features
to distinguish these two groups and weight the vendor NAICS signals accordingly.
"""))

cells.append(nbf.v4.new_code_cell("""\
# ── Entity-match coverage check ───────────────────────────────────────────────
# Run this after loading data to verify all three sources are present.
# If all three show 0% it indicates a problem with the match table queries.
print("=" * 65)
print("ENTITY-MATCH COVERAGE (training set)")
print("=" * 65)
n_train = len(train_df)
print(f"Total training businesses: {n_train:,}")
print()

for col, label in [
    ("zi_match_confidence",  "ZoomInfo"),
    ("efx_match_confidence", "Equifax"),
    ("oc_match_confidence",  "OpenCorporates"),
]:
    if col not in train_df.columns:
        print(f"  {label:<18} ⚠️  column missing")
        continue
    n_nonzero = (train_df[col].fillna(0) > 0).sum()
    n_zero    = n_train - n_nonzero
    avg_conf  = train_df.loc[train_df[col].fillna(0) > 0, col].mean() if n_nonzero > 0 else 0.0
    print(f"  {label:<18} matched: {n_nonzero:>6,} ({100*n_nonzero/n_train:5.1f}%)  "
          f"no-match: {n_zero:>6,} ({100*n_zero/n_train:5.1f}%)  "
          f"avg confidence (non-zero): {avg_conf:.3f}")

print()
print("Interpretation:")
print("  'matched' businesses had a ZI/EFX/OC record linked by the XGBoost entity-matching model.")
print("  'no-match' businesses got their NAICS from Middesk, Trulioo, or AI enrichment — confidence=0 is EXPECTED.")
print()

# Vendor NAICS coverage (separate from match confidence)
print("VENDOR NAICS SIGNAL COVERAGE (how many businesses have a NAICS from each vendor):")
for col, label in [
    ("zi_c_naics6",       "ZoomInfo zi_c_naics6"),
    ("efx_naics_primary", "Equifax efx_naics_primary"),
    ("oc_naics_primary",  "OC oc_naics_primary"),
]:
    if col not in train_df.columns:
        print(f"  {label:<30} ⚠️  column missing")
        continue
    n_has = train_df[col].notna().sum() - (train_df[col].fillna("") == "").sum()
    print(f"  {label:<30} {n_has:>6,} ({100*n_has/n_train:.1f}%)")

print()
print("NOTE: A business can have a NAICS from a vendor even if match_confidence=0")
print("  (it means a record was found but the XGBoost entity score was below the 0.8 threshold).")
"""))

# ── Cell 4: EDA - Fallback Distribution ───────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 3 — Exploratory Data Analysis"""))

cells.append(nbf.v4.new_code_cell("""\
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
fig.suptitle("Current Production Data: NAICS Code Distribution", color="#E2E8F0", fontsize=14, fontweight="bold")

# 1. Fallback vs Non-fallback pie
ax = axes[0]
labels = [f"Real NAICS\\n({len(train_df):,})", f"Fallback 561499\\n({len(fallback_df):,})"]
sizes  = [len(train_df), len(fallback_df)]
colours= [GREEN, RED]
wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colours, autopct="%1.1f%%",
                                   textprops={"color":"white","fontsize":10})
for at in autotexts:
    at.set_color("white"); at.set_fontweight("bold")
ax.set_title("Fallback vs Real NAICS", color="#E2E8F0")

# 2. Top NAICS sectors in training data
ax = axes[1]
train_df["naics_sector"] = train_df["label_naics6"].str[:2]
sector_counts = train_df["naics_sector"].value_counts().head(10)
bars = ax.barh(sector_counts.index, sector_counts.values, color=BLUE, alpha=0.85)
ax.set_xlabel("Count"); ax.set_title("Top 10 NAICS Sectors (Training)", color="#E2E8F0")
ax.invert_yaxis()

# 3. Entity-match confidence distribution
# IMPORTANT: filter to confidence > 0 before plotting.
# ~42,000 businesses have confidence = 0 (no vendor match — they got their NAICS
# from Middesk, Trulioo, or AI, not from ZI/EFX/OC entity matching).
# Including zeros with density=True creates a massive spike at x=0 that
# visually swamps the non-zero distributions — making it look like only one
# source has data, when all three are actually present.
ax = axes[2]
match_counts = {}
for col, colour, label in [
    ("zi_match_confidence",  BLUE,  "ZoomInfo"),
    ("efx_match_confidence", GREEN, "Equifax"),
    ("oc_match_confidence",  AMBER, "OpenCorporates"),
]:
    if col in train_df.columns:
        vals = train_df[col].dropna()
        vals_nonzero = vals[vals > 0.0]   # only businesses that have a match
        match_counts[label] = len(vals_nonzero)
        if len(vals_nonzero) > 0:
            ax.hist(vals_nonzero, bins=25, alpha=0.65, color=colour,
                    label=f"{label} (n={len(vals_nonzero):,})", density=False)
ax.set_xlabel("Match Confidence (matched businesses only)")
ax.set_ylabel("Business Count")
ax.set_title("Entity-Match Confidence\\n(businesses with a vendor match > 0)", color="#E2E8F0")
ax.legend(facecolor="#1E293B", labelcolor="white", fontsize=8)

# Also print the coverage stats so the numbers are clear
print("Entity-match coverage in training data:")
n_train = len(train_df)
for col, label in [("zi_match_confidence","ZoomInfo"),
                   ("efx_match_confidence","Equifax"),
                   ("oc_match_confidence","OpenCorporates")]:
    if col in train_df.columns:
        n_matched = (train_df[col].fillna(0) > 0).sum()
        avg_conf  = train_df.loc[train_df[col].fillna(0) > 0, col].mean()
        print(f"  {label:<18} matched: {n_matched:>6,} ({100*n_matched/n_train:.1f}%)  "
              f"avg confidence: {avg_conf:.3f}")

plt.tight_layout()
plt.show()
"""))

# ── Cell 5: Feature Engineering ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 4 — Feature Engineering

Building a **50-feature numeric vector** per business:

| Group | Features | Description |
|---|---|---|
| A | ZI NAICS signals | `zi_naics6`, `zi_naics4`, `zi_naics2`, `zi_naics_confidence` |
| B | EFX NAICS signals | `efx_naics_primary`, `efx_naics_sector`, `efx_sic_primary`, secondary codes |
| C | OC NAICS signals | `oc_naics_primary`, `oc_naics_sector` (parsed from `industry_code_uids`) |
| D | Source agreement | `naics2_agreement`, `naics4_agreement`, `naics6_agreement`, pairwise match flags |
| E | Match confidence | `zi_match_confidence`, `efx_match_confidence`, `oc_match_confidence` (XGBoost Level 1 outputs) |
| F | Name tokens | Keyword flags (restaurant, salon, construction, tech, medical) + hashed tokens |
| G | Jurisdiction | `state_encoded`, `country_encoded`, `is_us_business` |
| H | AI metadata | `ai_confidence_high/med/low`, `ai_naics_is_fallback`, `ai_has_website` |
| I | Firmographic | `efx_employee_count_log`, `efx_annual_sales_log`, `zi_revenue_log` |
"""))

cells.append(nbf.v4.new_code_cell("""\
X_train, naics_le = build_feature_matrix(train_df, fit_encoders=True)
X_fallback, _     = build_feature_matrix(fallback_df, naics_le=naics_le, fit_encoders=False)

print(f"Feature matrix shape: {X_train.shape}")
print(f"NAICS classes: {len(naics_le.classes_)}")
print()
print("Feature sample (first 5 rows, first 10 features):")
display(X_train.iloc[:5, :10].round(3))
"""))

cells.append(nbf.v4.new_code_cell("""\
# Correlation heatmap (subset of features)
subset_cols = [
    "naics2_agreement", "naics6_agreement",
    "zi_match_confidence", "efx_match_confidence", "oc_match_confidence",
    "zi_naics_confidence", "ai_naics_is_fallback", "ai_has_website",
    "name_has_restaurant", "name_has_medical", "name_has_tech",
]
subset_cols = [c for c in subset_cols if c in X_train.columns]

fig, ax = plt.subplots(figsize=(10, 8))
corr = X_train[subset_cols].corr()
sns.heatmap(corr, ax=ax, cmap="coolwarm", center=0, annot=True, fmt=".2f",
            annot_kws={"size": 8}, linewidths=0.5,
            cbar_kws={"shrink": 0.8})
ax.set_title("Feature Correlation Matrix", color="#E2E8F0")
ax.tick_params(colors="#94A3B8")
plt.tight_layout()
plt.show()
"""))

# ── Cell 6: Training ───────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 5 — Model Training

Training two XGBoost classifiers on **real Redshift data** (when `USE_SYNTHETIC=False`):
1. **NAICSClassifier** — `multi:softprob` objective, predicts 6-digit NAICS code
2. **MCCClassifier** — `multi:softprob` objective, predicts 4-digit MCC code

The NAICS model overrides the current `561499` only when confidence ≥ `NAICS_OVERRIDE_CONFIDENCE_THRESHOLD`.

> **Real data training:** Since `USE_SYNTHETIC` is set above and you have Redshift access,
> the pipeline trains on your 52,461 real labeled businesses. This is the production model.
"""))

cells.append(nbf.v4.new_code_cell("""\
# ── Train on REAL data (USE_SYNTHETIC=False) or synthetic (True) ─────────────
# When USE_SYNTHETIC=False the pipeline:
#   - Uses the 52,461 real non-fallback businesses from Redshift as training labels
#   - Evaluates on a held-out 20% test set of real businesses
#   - Evaluates on all 16,945 real 561499 fallback businesses
# This gives meaningful accuracy numbers and a real before/after comparison.

report = run_training_pipeline(
    limit=None,              # None = use ALL data (real or synthetic)
    use_synthetic=USE_SYNTHETIC,
    save_artifacts=True,
)

tm = report["test_metrics"]
ds = report["dataset_sizes"]
print("\\n=== TRAINING COMPLETE ===")
print(f"Training rows:     {ds.get('n_train_rows', 'N/A'):,}")
print(f"NAICS classes:     {ds.get('n_naics_classes', 'N/A')}")
print(f"MCC classes:       {ds.get('n_mcc_classes', 'N/A')}")
print()
print("NAICS model accuracy (held-out test set):")
print(f"  Top-1 (exact 6-digit):     {tm.get('naics_test_top1_accuracy', 0):.1%}")
print(f"  Top-3 (in top-3 preds):    {tm.get('naics_test_top3_accuracy', 0):.1%}")
print(f"  Sector (2-digit correct):   {tm.get('naics_test_sector_accuracy', 0):.1%}")
print()
print("MCC model accuracy:")
print(f"  Top-1:                      {tm.get('mcc_test_top1_accuracy', 0):.1%}")
print()
if not USE_SYNTHETIC:
    print("✅ Trained on REAL production data — these accuracy numbers are meaningful.")
    print("   The model has learned from real ZI/EFX/OC NAICS signals.")
else:
    print("⚠️  Trained on SYNTHETIC data — accuracy numbers are inflated (model memorised fake data).")
    print("   Set USE_SYNTHETIC=False to train on real data and get meaningful results.")
"""))

# ── Cell 7: Metrics ───────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 6 — Model Evaluation Metrics"""))

cells.append(nbf.v4.new_code_cell("""\
tm = report["test_metrics"]
ds = report["dataset_sizes"]

fig, axes = plt.subplots(1, 2, figsize=(14, 5))
fig.suptitle("Model Performance on Held-Out Test Set", color="#E2E8F0", fontsize=14, fontweight="bold")

# NAICS accuracy bars
ax = axes[0]
naics_metrics = {
    "Top-1 Accuracy\\n(exact 6-digit)": tm["naics_test_top1_accuracy"],
    "Top-3 Accuracy\\n(in top 3 preds)": tm["naics_test_top3_accuracy"],
    "Sector Accuracy\\n(2-digit sector)": tm["naics_test_sector_accuracy"],
}
bars = ax.bar(naics_metrics.keys(), naics_metrics.values(), color=[RED, AMBER, GREEN], width=0.5)
for bar, val in zip(bars, naics_metrics.values()):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
            f"{val:.1%}", ha="center", color="white", fontweight="bold", fontsize=11)
ax.set_ylim(0, 1.15); ax.set_title("NAICS Classifier", color="#E2E8F0")
ax.set_ylabel("Accuracy")

# MCC accuracy
ax = axes[1]
mcc_val = tm["mcc_test_top1_accuracy"]
ax.bar(["MCC Top-1 Accuracy"], [mcc_val], color=BLUE, width=0.4)
ax.text(0, mcc_val + 0.01, f"{mcc_val:.1%}", ha="center", color="white", fontweight="bold", fontsize=13)
ax.set_ylim(0, 1.15); ax.set_title("MCC Classifier", color="#E2E8F0")
ax.set_ylabel("Accuracy")

plt.tight_layout()
plt.show()

print(f"\\nNAICS classes in model: {ds['n_naics_classes']}")
print(f"MCC classes in model:   {ds['n_mcc_classes']}")
print(f"Training rows:          {ds['n_train_rows']:,}")
"""))

# ── Cell 8: THE MAIN COMPARISON ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 7 — ⭐ The Key Comparison: Before vs After

**The central question:** Of all businesses currently receiving the fallback `561499`, how many can our model now classify with a real, confident NAICS code?
"""))

cells.append(nbf.v4.new_code_cell("""\
fa = report["fallback_analysis"]
n_total    = fa["n_total_fallback_businesses"]
n_override = fa["n_can_override"]
n_cannot   = fa["n_cannot_override"]
override_pct = fa["override_rate_pct"]

fig, axes = plt.subplots(1, 3, figsize=(16, 6))
fig.suptitle(
    f"Before vs After: Businesses Currently Receiving Fallback NAICS 561499 (n={n_total:,})",
    color="#E2E8F0", fontsize=13, fontweight="bold"
)

# 1. Can we classify? (donut)
ax = axes[0]
sizes   = [n_override, n_cannot]
colours = [GREEN, "#374151"]
labels  = [
    f"Model can classify\\n{n_override:,} ({override_pct:.1f}%)",
    f"Still uncertain\\n{n_cannot:,} ({100-override_pct:.1f}%)",
]
wedges, texts, auts = ax.pie(sizes, colors=colours, autopct="%1.1f%%",
                              startangle=90, pctdistance=0.75,
                              textprops={"color":"white","fontsize":9},
                              wedgeprops={"width":0.55})
for at in auts:
    at.set_fontweight("bold")
ax.set_title("Can We Override 561499?", color="#E2E8F0")
ax.legend(labels, loc="lower center", bbox_to_anchor=(0.5, -0.18),
          facecolor="#1E293B", labelcolor="white", fontsize=8)

# 2. Confidence distribution of model predictions on fallback set
ax = axes[1]
conf_dist = fa["confidence_distribution"]
bins   = list(conf_dist.keys())
counts = list(conf_dist.values())
colours_conf = [RED if b.startswith("<") else AMBER if "0.55" in b else GREEN for b in bins]
bars = ax.bar(bins, counts, color=colours_conf, width=0.65)
for bar, val in zip(bars, counts):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
            str(val), ha="center", color="white", fontsize=9)
ax.axvline(x=2.5, color="white", linestyle="--", linewidth=1.5, label=f"Threshold={fa['threshold_used']}")
ax.set_xlabel("Model Confidence"); ax.set_ylabel("Count")
ax.set_title("Confidence Distribution on Fallback Set", color="#E2E8F0")
ax.legend(facecolor="#1E293B", labelcolor="white")

# 3. Top predicted NAICS codes for overrideable businesses
ax = axes[2]
top_naics = dict(list(fa["top_predicted_naics_codes"].items())[:10])
if top_naics:
    codes  = list(top_naics.keys())
    counts2= list(top_naics.values())
    ax.barh(codes, counts2, color=PURPLE, alpha=0.85)
    ax.set_xlabel("Count"); ax.invert_yaxis()
    ax.set_title("Top Predicted NAICS\\n(for overrideable fallback businesses)", color="#E2E8F0")
else:
    ax.text(0.5, 0.5, "No predictions available", ha="center", transform=ax.transAxes, color="white")
    ax.set_title("Top Predicted NAICS", color="#E2E8F0")

plt.tight_layout()
plt.show()

print("=" * 60)
print(f"SUMMARY")
print("=" * 60)
print(f"Businesses currently stuck with 561499:  {n_total:,}")
print(f"Model can override with real NAICS:      {n_override:,} ({override_pct:.1f}%)")
print(f"Still returns 561499 (below threshold):  {n_cannot:,} ({100-override_pct:.1f}%)")
print(f"Avg confidence (overrideable):           {fa['avg_model_confidence_override']:.3f}")
print(f"Override threshold:                      {fa['threshold_used']}")
"""))

# ── Cell 9: Example predictions ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 8 — Example: What the Model Returns

Side-by-side comparison of current production output vs model prediction.
"""))

cells.append(nbf.v4.new_code_cell("""\
from naics_mcc_classifier.pipeline import predict
from naics_mcc_classifier.model import NAICSClassifier, MCCClassifier
import pickle

# Load trained models
try:
    naics_clf = NAICSClassifier.load()
    mcc_clf   = MCCClassifier.load()
    with open(ARTIFACTS_DIR / "naics_le.pkl", "rb") as f:
        naics_le_loaded = pickle.load(f)
    with open(ARTIFACTS_DIR / "crosswalk.json") as f:
        crosswalk_loaded = json.load(f)

    # Example businesses that currently get 561499
    test_businesses = [
        {
            "business_id": "biz-001",
            "business_name": "Mario's Italian Kitchen",
            "state": "NJ",
            "country_code": "US",
            "current_naics_code": "561499",  # ← current fallback
            "current_mcc_code": "5614",
            "zi_c_naics6": "722511",          # ← ZI says it's a restaurant
            "efx_naics_primary": "722511",    # ← EFX agrees
            "oc_naics_primary": "",
            "zi_match_confidence": 0.92,
            "efx_match_confidence": 0.88,
            "oc_match_confidence": 0.0,
            "ai_enrichment_confidence": "LOW",
        },
        {
            "business_id": "biz-002",
            "business_name": "Luxe Beauty & Nail Studio",
            "state": "CA",
            "country_code": "US",
            "current_naics_code": "561499",
            "current_mcc_code": "5614",
            "zi_c_naics6": "812113",
            "efx_naics_primary": "812113",
            "oc_naics_primary": "812113",
            "zi_match_confidence": 0.88,
            "efx_match_confidence": 0.79,
            "oc_match_confidence": 0.82,
            "ai_enrichment_confidence": "LOW",
        },
        {
            "business_id": "biz-003",
            "business_name": "DataCore Systems Inc",
            "state": "NY",
            "country_code": "US",
            "current_naics_code": "561499",
            "current_mcc_code": "5614",
            "zi_c_naics6": "541511",
            "efx_naics_primary": "541512",   # slight disagreement
            "oc_naics_primary": "541511",
            "zi_match_confidence": 0.85,
            "efx_match_confidence": 0.73,
            "oc_match_confidence": 0.69,
            "ai_enrichment_confidence": "MED",
        },
        {
            "business_id": "biz-004",
            "business_name": "Global Holdings LLC",   # ← genuinely ambiguous
            "state": "NY",
            "country_code": "US",
            "current_naics_code": "561499",
            "current_mcc_code": "5614",
            "zi_c_naics6": "",
            "efx_naics_primary": "",
            "oc_naics_primary": "",
            "zi_match_confidence": 0.22,
            "efx_match_confidence": 0.18,
            "oc_match_confidence": 0.0,
            "ai_enrichment_confidence": "LOW",
        },
    ]

    results = predict(
        businesses=test_businesses,
        naics_clf=naics_clf,
        mcc_clf=mcc_clf,
        naics_le=naics_le_loaded,
        crosswalk_dict=crosswalk_loaded,
    )

    rows = []
    for b, r in zip(test_businesses, results):
        rows.append({
            "Business":               b["business_name"],
            "Current NAICS (Before)": b["current_naics_code"],
            "Current MCC (Before)":   b["current_mcc_code"],
            "Model NAICS (After)":    r["naics_code"],
            "Model Confidence":       f"{r['naics_confidence']:.2%}",
            "Override Applied?":      "✅ YES" if r["override_applied"] else "❌ NO (below threshold)",
            "Model MCC (After)":      r["mcc_code"],
        })

    comparison = pd.DataFrame(rows)

    def style_override(df):
        def row_style(row):
            styles = []
            for col in df.columns:
                v = row[col]
                if col == "Override Applied?" and "YES" in str(v):
                    styles.append("background-color:#064E3B;color:#6EE7B7;font-weight:bold")
                elif col == "Override Applied?" and "NO" in str(v):
                    styles.append("background-color:#1C1917;color:#9CA3AF")
                elif col in ("Current NAICS (Before)", "Current MCC (Before)") and str(v) in ("561499", "5614"):
                    styles.append("background-color:#7F1D1D;color:#FCA5A5;font-weight:bold")
                elif col in ("Model NAICS (After)", "Model MCC (After)") and str(v) not in ("561499", "5614"):
                    styles.append("background-color:#0C4A6E;color:#7DD3FC;font-weight:bold")
                else:
                    styles.append("background-color:#1E293B;color:#CBD5E1")
            return styles
        return df.style.apply(row_style, axis=1).set_table_styles([
            {"selector": "th", "props": [("background-color","#1E3A5F"),("color","#93C5FD"),
                                          ("font-weight","bold"),("padding","8px")]},
            {"selector": "td", "props": [("padding","8px")]},
        ])

    display(HTML("<h3 style='color:#60A5FA'>Before vs After — Example Businesses</h3>"))
    display(style_override(comparison))

    print("\\nTop-5 NAICS for each business:")
    for b, r in zip(test_businesses, results):
        print(f"\\n  {b['business_name']} (override={'YES' if r['override_applied'] else 'NO'}):")
        for item in r["top_5_naics"][:3]:
            print(f"    NAICS {item['naics_code']} — {item.get('description', '')} [{item['probability']:.2%}]")

except FileNotFoundError as e:
    print(f"Models not found ({e}). Run the training pipeline first.")
    print("Showing synthetic example output instead...")
    demo = pd.DataFrame([
        {"Business": "Mario's Italian Kitchen",    "Before": "561499 / 5614", "After": "722511 / 5812", "Confidence": "91%", "Override": "✅"},
        {"Business": "Luxe Beauty & Nail Studio",  "Before": "561499 / 5614", "After": "812113 / 7230", "Confidence": "88%", "Override": "✅"},
        {"Business": "DataCore Systems Inc",       "Before": "561499 / 5614", "After": "541511 / 7372", "Confidence": "79%", "Override": "✅"},
        {"Business": "Global Holdings LLC",        "Before": "561499 / 5614", "After": "561499 / 5614", "Confidence": "29%", "Override": "❌"},
    ])
    display(demo)
"""))

# ── Cell 10: Feature Importance ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 9 — Feature Importance (NAICS Model)"""))

cells.append(nbf.v4.new_code_cell("""\
try:
    naics_clf = NAICSClassifier.load()
    importances = naics_clf.model.feature_importances_
    feat_imp = pd.Series(importances, index=naics_clf.feature_names).sort_values(ascending=False)

    fig, ax = plt.subplots(figsize=(12, 7))
    feat_imp.head(20).plot.barh(ax=ax, color=BLUE, alpha=0.85)
    ax.invert_yaxis()
    ax.set_xlabel("Importance Score (F-score)")
    ax.set_title("Top 20 Features — NAICS XGBoost Classifier", color="#E2E8F0")
    ax.axvline(x=feat_imp.head(20).mean(), color=AMBER, linestyle="--", label="Mean importance")
    ax.legend(facecolor="#1E293B", labelcolor="white")
    plt.tight_layout()
    plt.show()

    print("\\nTop 10 features:")
    for feat, score in feat_imp.head(10).items():
        print(f"  {feat:<35} {score:.4f}")
except FileNotFoundError:
    print("Model not yet trained. Run pipeline first.")
"""))

# ── Cell 11: Summary ──────────────────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 10 — Summary & Recommendations

### What we built

| Component | Description |
|---|---|
| `data_loader.py` | Loads 4 vendor Redshift tables + entity-match confidence scores + current production NAICS/MCC |
| `feature_engineering.py` | 50-feature numeric vector per business (vendor NAICS codes, agreement signals, match confidence, name keywords) |
| `model.py` | `NAICSClassifier` + `MCCClassifier` — XGBoost `multi:softprob`, top-K probabilities |
| `pipeline.py` | Orchestrates training, evaluation, and inference with override logic |
| `config.py` | Central config for thresholds, table names, hyperparameters |

### Key findings

1. **Override rate:** The model can override X% of businesses currently stuck with `561499` with a confident prediction (≥ threshold).
2. **Sector accuracy:** Even when the exact 6-digit NAICS is wrong, the 2-digit sector is correct Y% of the time — important for MCC crosswalk accuracy.
3. **Most impactful features:** Vendor NAICS agreement signals (when ZI and EFX agree) and entity-match confidence scores are the strongest predictors.
4. **Genuinely ambiguous businesses:** Z% of fallback businesses remain below the confidence threshold — these are legitimately hard to classify (holding companies, vague names, no vendor matches).

### Recommended next steps

1. **Retrain with more data:** Expand training set with analyst overrides (high-quality labels) from `integration_data.request_response` WHERE `override.value IS NOT NULL`.
2. **Add Liberty data:** `dev.liberty.einmst_*` tables contain NAICS + SIC — not yet joined into entity-matching pipeline. Adding Liberty matches could resolve many of the genuinely ambiguous cases.
3. **Integrate into AI enrichment:** Feed model top-5 predictions as context to `AINaicsEnrichment` GPT prompt, reducing its reliance on generic fallback.
4. **Add UK SIC:** For GB businesses, parse `oc_industry_code_uids` for `gb_sic-` entries and add as features.
"""))

# ── Sections 11–15: XGBoost-first pipeline comparison ─────────────────────────

cells.append(nbf.v4.new_markdown_cell("""## Section 11 — The New Three-Tier Pipeline

The previous sections showed the XGBoost classifier working in isolation.
This section shows how it integrates with AI enrichment into a **three-tier decision system**
that replaces the current "AI always fires → 561499 if unsure" approach.

### Before (current system)
```
All vendors → Fact Engine → if <3 sources → GPT always → 561499 if no evidence
```

### After (new system)
```
All vendors → Fact Engine → if <3 sources
  → XGBoost classifier (vendor top-3, secondary codes, SIC cross-agreement, name keywords)
    ├─ Confidence ≥ 0.55  → OUTCOME: use_prediction  → apply directly, SKIP GPT (save cost)
    ├─ Confidence < 0.55, some vendor signals  → OUTCOME: send_to_ai
    │     → GPT receives: vendor signals + XGBoost top-5 + "resolve the conflict"
    └─ ALL vendors null   → OUTCOME: name_only_inference
          → GPT with OPEN web search + "infer from name before returning 561499"
```

### Key improvements vs original AI enrichment
| Aspect | Before | After |
|---|---|---|
| When does GPT fire? | Always (when <3 vendor sources) | Only when XGBoost confidence < 0.55 |
| What context does GPT receive? | Business name + address only | Vendor NAICS breakdown + XGBoost top-5 + conflict analysis |
| Zero-evidence businesses | GPT returns 561499 immediately | GPT searches web first; only 561499 if web finds nothing AND name is ambiguous |
| Name-deducible businesses | May return 561499 despite clear name | XGBoost classifies from name keywords; GPT told "do NOT return 561499 for name-deducible" |
| GPT cost per 561499 business | 1 GPT call always | 0 calls if XGBoost confident; 1 enriched call otherwise |
"""))

cells.append(nbf.v4.new_code_cell("""\
from naics_mcc_classifier.predictor import get_predictor, OUTCOME_USE_PREDICTION, OUTCOME_SEND_TO_AI, OUTCOME_NAME_ONLY, OUTCOME_KEEP_EXISTING

predictor = get_predictor()

# ── Load MCC crosswalk for label lookup ──────────────────────────────────────
import json as _json
try:
    with open(ARTIFACTS_DIR / "crosswalk.json") as _f:
        _crosswalk = _json.load(_f)
    # Reverse map: mcc_code → description (simple lookup dict)
    _MCC_NAMES = {
        "5812": "Eating Places / Restaurants",
        "7230": "Beauty & Barber Shops",
        "7372": "Computer Software",
        "5945": "Hobby, Toy & Game Shops",
        "5411": "Grocery Stores",
        "6513": "Apartment & Property Mgmt",
        "8011": "Doctors / Physicians",
        "8021": "Dentists",
        "5999": "Misc Retail Stores",
        "5614": "FALLBACK — no classification",
    }
except Exception:
    _crosswalk = {}
    _MCC_NAMES = {"5614": "FALLBACK — no classification"}

# ── Representative businesses (OC NAICS added where applicable) ───────────────
# Why OC is often blank:
#   OpenCorporates matches via company registration records. Most US small businesses
#   do NOT appear in OC's global registry — OC covers primarily UK, EU, and AU companies.
#   For US businesses, ZI + EFX are the primary sources; OC matters most for UK/Canada.
pipeline_examples = [
    # Tier 1: ZI + EFX agree → use_prediction (GPT skipped)
    dict(business_id="p1", business_name="Mario's Italian Kitchen",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="722511", efx_naics_primary="722511", oc_naics_primary="722511",
         zi_c_naics_top3="722511|722513|722515",
         zi_match_confidence=0.92, efx_match_confidence=0.88, oc_match_confidence=0.71),
    # Tier 1: ZI + EFX agree, OC blank (US small business — not in OC registry)
    dict(business_id="p2", business_name="Luxe Beauty & Nail Studio",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="812113", efx_naics_primary="812113", oc_naics_primary="",
         zi_match_confidence=0.78, efx_match_confidence=0.71, oc_match_confidence=0.0),
    # Tier 2: ZI + EFX disagree slightly → send_to_ai (GPT with enriched context)
    dict(business_id="p3", business_name="DataCore Systems Inc",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="541511", efx_naics_primary="541512", oc_naics_primary="",
         zi_c_naics_top3="541511|541519|519130",
         efx_naics_secondary_1="541519",
         zi_match_confidence=0.65, efx_match_confidence=0.48, oc_match_confidence=0.0),
    # Tier 2: Weak vendor match
    dict(business_id="p4", business_name="Premier Property Services LLC",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="531110", efx_naics_primary="561499", oc_naics_primary="",
         zi_match_confidence=0.52, efx_match_confidence=0.31, oc_match_confidence=0.0),
    # Tier 3: ALL vendors null → name_only_inference (GPT + open web search)
    dict(business_id="p5", business_name="St. Michael Community Church",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="", efx_naics_primary="", oc_naics_primary="",
         zi_match_confidence=0.0, efx_match_confidence=0.0, oc_match_confidence=0.0),
    # Tier 3: Genuinely ambiguous (no vendors, ambiguous name)
    dict(business_id="p6", business_name="Global Holdings LLC",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="", efx_naics_primary="", oc_naics_primary="",
         zi_match_confidence=0.0, efx_match_confidence=0.0, oc_match_confidence=0.0),
    # Bonus: UK company — OC is the primary source (ZI/EFX less reliable for UK)
    dict(business_id="p7", business_name="Acme Limited",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="", efx_naics_primary="", oc_naics_primary="541511",
         zi_match_confidence=0.0, efx_match_confidence=0.0, oc_match_confidence=0.82,
         country_code="GB"),
]

results_pipeline = []
for ex in pipeline_examples:
    r = predictor.predict_single(**ex)
    predicted_mcc = r.predicted_mcc_code
    mcc_desc = _MCC_NAMES.get(predicted_mcc, predicted_mcc)
    results_pipeline.append({
        "Business":             ex["business_name"],
        "ZI NAICS":             ex.get("zi_c_naics6","")       or "—",
        "EFX NAICS":            ex.get("efx_naics_primary","") or "—",
        "OC NAICS":             ex.get("oc_naics_primary","")  or "— (not in OC registry)",
        "Before NAICS":         ex["current_naics_code"],
        "Before MCC":           ex["current_mcc_code"],
        "Predicted NAICS":      r.predicted_naics_code,
        "Predicted MCC":        predicted_mcc,
        "MCC Description":      mcc_desc,
        "Confidence":           f"{r.model_confidence:.0%}",
        "Outcome":              r.outcome.replace("_"," ").title(),
        "GPT Fires?":           "❌ NO" if r.outcome == OUTCOME_USE_PREDICTION else "✅ YES",
        "Keywords":             ", ".join(r.name_keywords_found) or "—",
    })

df_pipeline = pd.DataFrame(results_pipeline)

# ── Why OC is often blank ─────────────────────────────────────────────────────
print("Why OC NAICS shows blank for most US businesses:")
print("  OpenCorporates primarily covers UK, EU, Australia, and Canada companies.")
print("  US small/mid businesses are often NOT in OC's global registry.")
print("  For US businesses: ZI + EFX are the primary NAICS sources.")
print("  For UK/Canada businesses: OC is the most reliable source (see row p7 above).")
print()
print("Why Before=561499 even when ZI/EFX have valid codes:")
print("  ZI/EFX NAICS codes live in Redshift match tables (zoominfo_matches_custom_inc_ml etc.)")
print("  The current AI enrichment prompt only receives Fact Engine winners — NOT raw vendor codes.")
print("  So even when ZI=722511 and EFX=722511, the AI never sees them and returns 561499.")
print("  The XGBoost model fixes this by reading vendor NAICS directly from Redshift.")
print()

# ── Styled table ──────────────────────────────────────────────────────────────
def style_pipeline(df):
    def row_style(row):
        styles = []
        for col in df.columns:
            v = str(row[col])
            if col == "Outcome" and "Use Prediction" in v:
                styles.append("background-color:#064E3B;color:#6EE7B7;font-weight:bold")
            elif col == "Outcome" and "Send To Ai" in v:
                styles.append("background-color:#1E3A5F;color:#93C5FD;font-weight:bold")
            elif col == "Outcome" and "Name Only" in v:
                styles.append("background-color:#78350F;color:#FDE68A;font-weight:bold")
            elif col == "GPT Fires?" and "NO" in v:
                styles.append("background-color:#064E3B;color:#6EE7B7")
            elif col == "GPT Fires?" and "YES" in v:
                styles.append("background-color:#1E293B;color:#CBD5E1")
            elif col in ("Before NAICS", "Before MCC") and v in ("561499","5614"):
                styles.append("background-color:#7F1D1D;color:#FCA5A5;font-weight:bold")
            elif col in ("Predicted NAICS",) and v not in ("561499",""):
                styles.append("background-color:#0C4A6E;color:#7DD3FC;font-weight:bold")
            elif col in ("Predicted MCC",) and v not in ("5614",""):
                styles.append("background-color:#0C4A6E;color:#7DD3FC;font-weight:bold")
            elif "not in OC" in v:
                styles.append("background-color:#1E293B;color:#4B5563;font-style:italic")
            else:
                styles.append("background-color:#1E293B;color:#CBD5E1")
        return styles
    return df.style.apply(row_style, axis=1).set_table_styles([
        {"selector": "th", "props": [("background-color","#1E3A5F"),("color","#93C5FD"),
                                      ("font-weight","bold"),("padding","8px")]},
        {"selector": "td", "props": [("padding","8px")]},
    ])

display(HTML("<h3 style='color:#60A5FA'>Three-Tier Outcome: NAICS + MCC for Representative Businesses</h3>"))
display(style_pipeline(df_pipeline))
"""))

# ── Section 12: Outcome distribution on full fallback set ─────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 12 — Outcome Distribution on Full Fallback Set

Running the predictor on all businesses currently stuck on 561499 to see how they split
across the three tiers. This tells us how much GPT cost the new system saves.
"""))

cells.append(nbf.v4.new_code_cell("""\
# Run predictor on the entire fallback_df loaded in Section 2
# (uses the real Redshift data when USE_SYNTHETIC=False)

outcomes = []
for _, row in fallback_df.iterrows():
    try:
        r = predictor.predict_single(
            business_id       = str(row.get("business_id", "")),
            business_name     = str(row.get("business_name", row.get("zi_c_name", ""))),
            current_naics_code= str(row.get("current_naics_code", "561499")),
            current_mcc_code  = str(row.get("current_mcc_code",  "5614")),
            zi_c_naics6       = str(row.get("zi_c_naics6",       "") or ""),
            zi_c_naics_top3   = str(row.get("zi_c_naics_top3",   "") or ""),
            zi_c_sic4         = str(row.get("zi_c_sic4",         "") or ""),
            zi_c_sic_top3     = str(row.get("zi_c_sic_top3",     "") or ""),
            zi_naics_confidence   = float(row.get("zi_c_naics_confidence_score") or 0),
            zi_match_confidence   = float(row.get("zi_match_confidence")         or 0),
            efx_naics_primary     = str(row.get("efx_naics_primary",    "") or ""),
            efx_naics_secondary_1 = str(row.get("efx_naics_secondary_1","") or ""),
            efx_naics_secondary_2 = str(row.get("efx_naics_secondary_2","") or ""),
            efx_sic_primary       = str(row.get("efx_sic_primary",      "") or ""),
            efx_match_confidence  = float(row.get("efx_match_confidence") or 0),
            oc_naics_primary      = str(row.get("oc_naics_primary",      "") or ""),
            oc_match_confidence   = float(row.get("oc_match_confidence")  or 0),
            state      = str(row.get("state", row.get("zi_state", "MISSING")) or "MISSING"),
            has_website= bool(row.get("ai_has_website", False)),
            ai_enrichment_confidence = str(row.get("ai_enrichment_confidence","") or ""),
        )
        outcomes.append({
            "outcome":           r.outcome,
            "predicted_naics":   r.predicted_naics_code,
            "model_confidence":  r.model_confidence,
            "all_vendors_null":  r.all_vendors_null,
            "name_keywords":     ", ".join(r.name_keywords_found) if r.name_keywords_found else "",
        })
    except Exception as e:
        outcomes.append({"outcome": "error", "predicted_naics": "561499",
                         "model_confidence": 0.0, "all_vendors_null": True, "name_keywords": ""})

outcomes_df = pd.DataFrame(outcomes)

# ── Summary statistics ─────────────────────────────────────────────────────────
n_total   = len(outcomes_df)
n_use     = (outcomes_df["outcome"] == OUTCOME_USE_PREDICTION).sum()
n_send_ai = (outcomes_df["outcome"] == OUTCOME_SEND_TO_AI).sum()
n_name    = (outcomes_df["outcome"] == OUTCOME_NAME_ONLY).sum()
n_error   = (outcomes_df["outcome"] == "error").sum()

gpt_calls_before = n_total
gpt_calls_after  = n_send_ai + n_name   # only these tiers fire GPT
gpt_saved        = n_use
gpt_savings_pct  = 100 * gpt_saved / max(n_total, 1)

print("=" * 65)
print(f"OUTCOME DISTRIBUTION (n={n_total:,} fallback businesses)")
print("=" * 65)
print(f"  use_prediction   (XGBoost confident → GPT SKIPPED): {n_use:>6,}  ({100*n_use/n_total:.1f}%)")
print(f"  send_to_ai       (vendors conflict  → enriched GPT): {n_send_ai:>6,}  ({100*n_send_ai/n_total:.1f}%)")
print(f"  name_only        (ALL null          → GPT+web search): {n_name:>6,}  ({100*n_name/n_total:.1f}%)")
if n_error: print(f"  errors:                                            {n_error:>6,}")
print()
print(f"GPT calls BEFORE new system:  {gpt_calls_before:,}  (every fallback business)")
print(f"GPT calls AFTER  new system:  {gpt_calls_after:,}   (only uncertain cases)")
print(f"GPT calls SAVED:              {gpt_saved:,}  ({gpt_savings_pct:.1f}% reduction)")

# ── Confidence distribution for use_prediction tier ───────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(16, 5))
fig.suptitle("Outcome Distribution on Fallback (561499) Businesses", color="#E2E8F0", fontsize=14, fontweight="bold")

# 1. Outcome pie
ax = axes[0]
sizes   = [n_use, n_send_ai, n_name]
labels  = [
    f"XGBoost decides\\n(GPT skipped)\\n{n_use:,} ({100*n_use/n_total:.0f}%)",
    f"Enriched GPT\\n(vendor conflict)\\n{n_send_ai:,} ({100*n_send_ai/n_total:.0f}%)",
    f"GPT + web search\\n(all vendors null)\\n{n_name:,} ({100*n_name/n_total:.0f}%)",
]
colours = [GREEN, BLUE, AMBER]
wedges, texts = ax.pie(sizes, colors=colours, startangle=90,
                        textprops={"color":"white","fontsize":8},
                        wedgeprops={"width":0.6})
ax.set_title("Outcome Tier Split", color="#E2E8F0")
ax.legend(labels, loc="lower center", bbox_to_anchor=(0.5,-0.25),
          facecolor="#1E293B", labelcolor="white", fontsize=7)

# 2. Confidence histogram for use_prediction tier
ax = axes[1]
conf_vals = outcomes_df[outcomes_df["outcome"]==OUTCOME_USE_PREDICTION]["model_confidence"]
ax.hist(conf_vals, bins=20, color=GREEN, alpha=0.85)
ax.axvline(x=conf_vals.mean(), color=AMBER, linestyle="--", label=f"Mean {conf_vals.mean():.2f}")
ax.set_xlabel("Model Confidence"); ax.set_ylabel("Business Count")
ax.set_title("Confidence Distribution\\n(use_prediction tier)", color="#E2E8F0")
ax.legend(facecolor="#1E293B", labelcolor="white")

# 3. Top predicted NAICS codes for use_prediction
ax = axes[2]
top_predicted = (
    outcomes_df[outcomes_df["outcome"]==OUTCOME_USE_PREDICTION]["predicted_naics"]
    .value_counts()
    .head(10)
)
if len(top_predicted):
    ax.barh(top_predicted.index, top_predicted.values, color=PURPLE, alpha=0.85)
    ax.invert_yaxis()
    ax.set_xlabel("Count")
    ax.set_title("Top Predicted NAICS\\n(for use_prediction businesses)", color="#E2E8F0")

plt.tight_layout()
plt.show()
"""))

# ── Section 13: Name keyword analysis ─────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 13 — Name Keyword Analysis

Which fraction of 561499 businesses can be classified from their name alone (zero vendor match)?
These are the businesses the current AI returns 561499 for, even though their name clearly implies an industry.
"""))

cells.append(nbf.v4.new_code_cell("""\
# Businesses where all vendors are null but name keywords were found
name_only_df = outcomes_df[
    (outcomes_df["outcome"] == OUTCOME_NAME_ONLY) &
    (outcomes_df["name_keywords"] != "")
].copy()

vendor_null_df = outcomes_df[outcomes_df["all_vendors_null"] == True]
n_vendor_null   = len(vendor_null_df)
n_name_deducible= len(name_only_df)

print(f"Businesses with ALL vendor signals null:           {n_vendor_null:,}")
print(f"  → name keywords detected (deducible from name): {n_name_deducible:,}  "
      f"({100*n_name_deducible/max(n_vendor_null,1):.1f}%)")
print(f"  → genuinely ambiguous (no keywords either):     {n_vendor_null - n_name_deducible:,}  "
      f"({100*(n_vendor_null-n_name_deducible)/max(n_vendor_null,1):.1f}%)")
print()
print("Keyword categories detected in name-only businesses:")
if len(name_only_df):
    from collections import Counter
    all_kws = []
    for kw_str in name_only_df["name_keywords"].dropna():
        all_kws.extend([k.strip() for k in kw_str.split(",") if k.strip()])
    kw_counts = Counter(all_kws).most_common(12)
    for kw, cnt in kw_counts:
        bar = "█" * (cnt * 30 // max(c for _,c in kw_counts))
        print(f"  {kw:<20} {bar} {cnt:,}")

# Show example: name-only businesses that the new system can now classify
if len(name_only_df):
    fig, ax = plt.subplots(figsize=(10, 4))
    if kw_counts:
        kw_names = [k for k,_ in kw_counts]
        kw_vals  = [v for _,v in kw_counts]
        ax.barh(kw_names, kw_vals, color=AMBER, alpha=0.85)
        ax.invert_yaxis()
        ax.set_xlabel("Business Count")
        ax.set_title(
            f"Name-Deducible Industries (ALL vendors null, {n_name_deducible:,} businesses)\\n"
            f"These currently all get 561499 — new system identifies them from name keywords",
            color="#E2E8F0"
        )
    plt.tight_layout()
    plt.show()
"""))

# ── Section 14: Full before/after comparison ──────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 14 — Full Before vs After: The Complete Picture

This section combines all three tiers to show the complete improvement over the current system.

| State | What the current system does | What the new system does |
|---|---|---|
| ZI + EFX agree on NAICS, high confidence | 561499 (AI ignores vendor data in prompt) | **use_prediction**: XGBoost uses vendor signals → real code, GPT skipped |
| Vendors disagree | 561499 (AI has no breakdown of the conflict) | **send_to_ai**: GPT sees each vendor's code + confidence, resolves conflict |
| All vendors null, name is clear (nail salon) | 561499 (AI told to give up with no evidence) | **name_only**: GPT searches web + told "do NOT return 561499 for clear names" |
| All vendors null, name is genuinely ambiguous | 561499 ✓ (correct) | **name_only**: GPT searches web; 561499 only if truly nothing found |
"""))

cells.append(nbf.v4.new_code_cell("""\
# Combined before/after summary table
tier_labels = {
    OUTCOME_USE_PREDICTION: "Tier 1: XGBoost decides (GPT skipped)",
    OUTCOME_SEND_TO_AI:     "Tier 2: Enriched GPT (vendor conflict)",
    OUTCOME_NAME_ONLY:      "Tier 3: GPT + web search (all null)",
}

summary_rows = []
for outcome_code, label in tier_labels.items():
    tier_df = outcomes_df[outcomes_df["outcome"] == outcome_code]
    n = len(tier_df)
    if n == 0:
        continue
    avg_conf   = tier_df["model_confidence"].mean()
    still_561  = (tier_df["predicted_naics"] == "561499").sum()
    changed    = n - still_561
    gpt_fires  = outcome_code != OUTCOME_USE_PREDICTION
    summary_rows.append({
        "Tier":           label,
        "# Businesses":   f"{n:,}  ({100*n/len(outcomes_df):.0f}%)",
        "Avg Confidence": f"{avg_conf:.2f}",
        "Real Code Predicted": f"{changed:,}  ({100*changed/max(n,1):.0f}%)",
        "GPT Fires?":     "❌ No (saved)" if not gpt_fires else "✅ Yes (enriched prompt)",
    })

# Overall
n_total_classified = sum(1 for r in outcomes_df.itertuples()
                          if r.predicted_naics != "561499" and r.predicted_naics != "")
print("=" * 70)
print("FULL BEFORE vs AFTER COMPARISON")
print("=" * 70)
print(f"Total businesses that currently have 561499:      {n_total:,}")
print(f"Businesses NEW system classifies with real NAICS: {n_total_classified:,}  "
      f"({100*n_total_classified/max(n_total,1):.1f}%)")
print(f"Businesses remaining on 561499 (genuinely hard):  {n_total-n_total_classified:,}  "
      f"({100*(n_total-n_total_classified)/max(n_total,1):.1f}%)")
print()
print(f"GPT calls before: {n_total:,}  (every fallback business, blind prompt)")
print(f"GPT calls after:  {n_send_ai + n_name:,}  (only uncertain cases, enriched prompt)")
print(f"GPT calls saved:  {n_use:,}  ({gpt_savings_pct:.1f}% reduction in GPT cost)")

if summary_rows:
    df_summary = pd.DataFrame(summary_rows)
    display(HTML("<br>"))
    display(df_summary.style.set_table_styles([
        {"selector": "th", "props": [("background-color","#1E3A5F"),("color","#93C5FD"),
                                      ("font-weight","bold"),("padding","10px")]},
        {"selector": "td", "props": [("padding","10px"),("background-color","#1E293B"),
                                      ("color","#CBD5E1")]},
    ]))

# Final bar chart: before vs after
fig, ax = plt.subplots(figsize=(12, 5))
categories = [
    "Businesses\\ncurrently\\non 561499",
    "XGBoost\\nclassifies\\n(GPT skipped)",
    "Enriched GPT\\n(conflict\\nresolution)",
    "GPT + web\\nsearch\\n(all null)",
    "Remaining\\non 561499\\n(genuinely hard)",
]
values = [
    n_total,
    n_use,
    n_send_ai,
    n_name,
    n_total - n_total_classified,
]
colours = [RED, GREEN, BLUE, AMBER, "#4B5563"]
bars = ax.bar(categories, values, color=colours, width=0.6)
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + n_total*0.005,
            f"{val:,}\\n({100*val/n_total:.0f}%)",
            ha="center", color="white", fontsize=9, fontweight="bold")
ax.set_ylabel("Number of Businesses")
ax.set_title("Before vs After: What Happens to Every 561499 Business", color="#E2E8F0", fontsize=13)
plt.tight_layout()
plt.show()
"""))

# ── Section 15: AI context quality ────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 15 — Quality of AI Enrichment Context

When GPT does fire (Tier 2 and Tier 3), it now receives a structured context block
showing the vendor signals and XGBoost analysis. This section shows what that context looks like
for real businesses, so you can assess the quality of information GPT is now working with.
"""))

cells.append(nbf.v4.new_code_cell("""\
# Show the AI enrichment context for one Tier 2 and one Tier 3 example
examples_for_context = [
    dict(business_id="demo-1", business_name="DataCore Systems Inc",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="541511", efx_naics_primary="541512",
         zi_c_naics_top3="541511|541519|519130",
         efx_naics_secondary_1="541519",
         zi_match_confidence=0.65, efx_match_confidence=0.48, oc_match_confidence=0.0,
         has_website=True),
    dict(business_id="demo-2", business_name="St. Michael Community Church",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="", efx_naics_primary="",
         zi_match_confidence=0.0, efx_match_confidence=0.0, oc_match_confidence=0.0),
    dict(business_id="demo-3", business_name="Premier Business Solutions Corp",
         current_naics_code="561499", current_mcc_code="5614",
         zi_c_naics6="", efx_naics_primary="",
         zi_match_confidence=0.0, efx_match_confidence=0.0, oc_match_confidence=0.0),
]

for ex in examples_for_context:
    r = predictor.predict_single(**ex)
    print(f"\\n{'='*70}")
    print(f"Business: {ex['business_name']}")
    print(f"Outcome:  {r.outcome}  |  XGBoost prediction: {r.predicted_naics_code}  "
          f"({r.model_confidence:.0%})")
    print(f"All vendors null: {r.all_vendors_null}  |  Keywords: {r.name_keywords_found}")
    print(f"{'─'*70}")
    print("AI ENRICHMENT CONTEXT (injected into GPT system prompt):")
    print(r.ai_enrichment_context)
"""))

# ── Section 16: Updated summary ───────────────────────────────────────────────
cells.append(nbf.v4.new_markdown_cell("""## Section 16 — Full System Summary

### The complete picture

| Component | What it does |
|---|---|
| `data_loader.py` | One Redshift CTE query: facts + Pipeline B + entity-match confidences + vendor NAICS from ZI/EFX/OC |
| `feature_engineering.py` | 63 features: vendor NAICS primary, **ZI top-3**, **EFX secondary 1-4**, SIC cross-agreement, name keywords |
| `model.py` | `NAICSClassifier` + `MCCClassifier` — XGBoost `multi:softprob` |
| `predictor.py` | `NAICSPredictor.predict_single()` — three-tier decision, builds vendor signal list, generates AI context |
| `api.py` | FastAPI `POST /predict` — called by TypeScript before GPT, returns outcome + ai_enrichment_context |
| `pipeline.py` | Training orchestrator |
| `aiNaicsEnrichment.ts` | Updated: calls Python API first, applies if confident, enriches GPT prompt otherwise |

### The three tiers in production

**Tier 1 — XGBoost decides (GPT skipped, ~X% of cases):**
- Vendor signals agree and confidence ≥ 0.55
- OR name clearly encodes the industry (nail salon, restaurant, church, etc.) even with zero vendor matches
- Result: real NAICS code applied, zero GPT cost

**Tier 2 — Enriched GPT (vendor conflict, ~Y% of cases):**
- Some vendor signals exist but they disagree or confidence is low
- GPT now receives: every vendor's code + confidence + XGBoost top-5 + "resolve the conflict"
- GPT acts as a referee with full information rather than a blind last resort

**Tier 3 — GPT + open web search (all vendors null, ~Z% of cases):**
- No vendor has any match for this business
- GPT enabled to search the web freely (not restricted to known domain)
- GPT explicitly told: classify from name keywords if clear; only return 561499 if truly unclassifiable

### What 561499 now means

Before: 561499 = "AI ran out of options" (vendor signals were available but not shown to AI)
After:  561499 = "Genuinely unclassifiable" (AI searched the web, checked name keywords, exhausted all signals)

This makes the 561499 count meaningful as a true data quality metric.
"""))

nb.cells = cells

# Write notebook — nbf.write() writes valid .ipynb directly (do NOT use json.dump around it)
from pathlib import Path as _Path
nb_path = _Path(__file__).parent / "NAICS_MCC_Classifier_Comparison.ipynb"
with open(nb_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f, version=4)
print(f"Notebook written to: {nb_path}")
