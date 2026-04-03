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

    sql_fallback = (
        "SELECT COUNT(*) AS n_fallback "
        "FROM rds_warehouse_public.facts "   # trailing space is required
        "WHERE name = 'naics_code' "
        "  AND JSON_EXTRACT_PATH_TEXT(value, 'code') = '561499'"
    )
    df_fallback_check = redshift_query(sql_fallback)
    print(f"  of which are fallback 561499: {df_fallback_check['n_fallback'][0]:,}")
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
ax = axes[2]
for col, colour, label in [
    ("zi_match_confidence", BLUE, "ZoomInfo"),
    ("efx_match_confidence", GREEN, "Equifax"),
    ("oc_match_confidence", AMBER, "OpenCorporates"),
]:
    if col in train_df.columns:
        vals = train_df[col].dropna()
        ax.hist(vals, bins=30, alpha=0.6, color=colour, label=label, density=True)
ax.set_xlabel("Match Confidence"); ax.set_title("Entity-Match Confidence (Training)", color="#E2E8F0")
ax.legend(facecolor="#1E293B", labelcolor="white")

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

Training two XGBoost classifiers:
1. **NAICSClassifier** — `multi:softprob` objective, predicts 6-digit NAICS code
2. **MCCClassifier** — `multi:softprob` objective, predicts 4-digit MCC code

The NAICS model overrides the current `561499` only when confidence ≥ `NAICS_OVERRIDE_CONFIDENCE_THRESHOLD`.
"""))

cells.append(nbf.v4.new_code_cell("""\
# Run the full pipeline (trains both models, evaluates on test set, evaluates on fallback set)
report = run_training_pipeline(
    limit=20_000 if USE_SYNTHETIC else None,
    use_synthetic=USE_SYNTHETIC,
    save_artifacts=True,
)

print("\\n=== TRAINING COMPLETE ===")
print(json.dumps(report["test_metrics"], indent=2))
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

nb.cells = cells

# Write notebook — nbf.write() writes valid .ipynb directly (do NOT use json.dump around it)
from pathlib import Path as _Path
nb_path = _Path(__file__).parent / "NAICS_MCC_Classifier_Comparison.ipynb"
with open(nb_path, "w", encoding="utf-8") as f:
    nbf.write(nb, f, version=4)
print(f"Notebook written to: {nb_path}")
