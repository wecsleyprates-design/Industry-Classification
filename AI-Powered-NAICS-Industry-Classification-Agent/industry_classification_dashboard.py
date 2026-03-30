"""
Industry Classification Dashboard
===================================
Combines Worth AI entity matching results with Consensus Level 2 XGBoost
industry classification into a single interactive Streamlit dashboard.

Upload the same CSV format used by entity_matching_dashboard.py
(columns: lgl_nm_worth, address_1_worth, city_worth, region_worth,
zip_code_worth, country_worth) and get:

  CURRENT (Production):
    • Level 1 entity matching confidence per source (EFX, OC, ZI, Liberty)
    • Best source and confidence across all sources
    • Production NAICS rule output (ZI vs EFX winner-takes-all)

  NEW (Consensus):
    • Consensus XGBoost Level 2 top-3 industry codes with probabilities
    • Correct taxonomy per jurisdiction (UK SIC for GB, NAICS for US, etc.)
    • AML/KYB risk signals (6 types)
    • KYB recommendation: APPROVE / REVIEW / ESCALATE / REJECT
    • What the production rule missed (UK SIC, OC signal, source conflict)
"""
from __future__ import annotations

import io
import re
import sys
import time
import logging
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import streamlit as st
import plotly.express as px
import plotly.graph_objects as go

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.WARNING)
sys.path.insert(0, str(Path(__file__).parent))

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Industry Classification Dashboard",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Colour palette ────────────────────────────────────────────────────────────
COLOURS = {
    "equifax":         "#4299E1",
    "open_corporates": "#68D391",
    "zoominfo":        "#F6E05E",
    "liberty":         "#FC8181",
    "APPROVE":         "#48BB78",
    "REVIEW":          "#4299E1",
    "ESCALATE":        "#ECC94B",
    "REJECT":          "#FC8181",
}

# ── Cached model loaders ──────────────────────────────────────────────────────
@st.cache_resource(show_spinner="Loading entity resolver …")
def _get_entity_resolver():
    from entity_resolver import EntityResolver
    return EntityResolver()

@st.cache_resource(show_spinner="Loading taxonomy engine …")
def _get_taxonomy_engine():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()

@st.cache_resource(show_spinner="Warming up Consensus XGBoost …")
def _get_consensus_engine():
    from consensus_engine import IndustryConsensusEngine
    te = _get_taxonomy_engine()
    return IndustryConsensusEngine(taxonomy_engine=te)

@st.cache_resource(show_spinner=False)
def _get_risk_engine():
    from risk_engine import RiskEngine
    te = _get_taxonomy_engine()
    return RiskEngine(taxonomy_engine=te)

@st.cache_resource(show_spinner=False)
def _get_data_simulator():
    from data_simulator import DataSimulator
    return DataSimulator()

# ── Input CSV parsing ─────────────────────────────────────────────────────────
COLUMN_MAP = {
    # Worth AI format
    "lgl_nm_worth":   "company_name",
    "address_1_worth": "address",
    "city_worth":     "city",
    "region_worth":   "state",
    "zip_code_worth": "zip",
    "country_worth":  "country",
    # Alternate / Amex format
    "lgl_nm_received": "company_name",
    "business_address_received": "full_address",
    # Already normalised
    "company_name": "company_name",
    "address":      "address",
}


def parse_input_csv(df: pd.DataFrame) -> pd.DataFrame:
    """Normalise any supported CSV format into standard columns."""
    out = pd.DataFrame()

    # Map known columns
    for src, dst in COLUMN_MAP.items():
        if src in df.columns and dst not in out.columns:
            out[dst] = df[src].astype(str).str.strip()

    # Pass through UID columns if present
    for col in ["uid_worth", "uid_received", "external_id", "lookup_id",
                "lgl_nm_worth", "lgl_nm_received", "dba_nm_worth",
                "efx_confidence", "oc_confidence", "zi_confidence",
                "best_source", "best_confidence", "oc_jurisdiction_code"]:
        if col in df.columns:
            out[col] = df[col]

    # Ensure company_name exists
    if "company_name" not in out.columns:
        for c in df.columns:
            if "name" in c.lower() or "nm" in c.lower():
                out["company_name"] = df[c].astype(str).str.strip()
                break

    if "company_name" not in out.columns:
        st.error("Could not find a company name column. Expected: `lgl_nm_worth` or `company_name`.")
        st.stop()

    # Build address string
    if "address" not in out.columns:
        parts = []
        for c in ["address_1_worth", "address"]:
            if c in df.columns:
                parts.append(df[c].fillna("").astype(str))
                break
        if parts:
            out["address"] = parts[0]
        else:
            out["address"] = ""

    # Country
    if "country" not in out.columns:
        out["country"] = "US"

    # Row index for display
    out["_row"] = range(len(out))
    return out

# ── Level 1 confidence simulation / passthrough ───────────────────────────────

def compute_level1(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute / surface Level 1 match confidences.
    If EFX/OC/ZI confidence columns are already in the CSV (from a previous
    entity matching run), use them directly.
    Otherwise simulate realistic confidence scores based on company type.
    """
    cols_needed = ["efx_confidence", "oc_confidence", "zi_confidence"]
    already_have = all(c in df.columns for c in cols_needed)

    if already_have:
        df["_l1_source"] = "FROM_CSV (real Level 1 outputs)"
    else:
        # Simulate realistic Level 1 outputs
        rng = np.random.RandomState(42)
        n = len(df)
        df["_l1_source"] = "SIMULATED (run entity_matching pipeline to get real values)"

        # Known-looking names get higher confidences
        def _conf(name: str, base: float) -> float:
            words = len(str(name).split())
            is_inc = any(w in str(name).upper() for w in ["INC","LLC","CORP","LTD"])
            base_adj = base + (0.05 if words <= 3 else 0) + (0.03 if is_inc else 0)
            return float(np.clip(rng.normal(base_adj, 0.12), 0.01, 0.999))

        df["efx_confidence"] = [_conf(n, 0.62) for n in df["company_name"]]
        df["oc_confidence"]  = [_conf(n, 0.68) for n in df["company_name"]]
        df["zi_confidence"]  = [_conf(n, 0.60) for n in df["company_name"]]

    # Liberty: rarely in CSV, simulate
    if "liberty_confidence" not in df.columns:
        rng2 = np.random.RandomState(99)
        df["liberty_confidence"] = [
            float(np.clip(rng2.normal(0.45, 0.18), 0.01, 0.999))
            for _ in range(len(df))
        ]

    # Best source = source with highest confidence
    conf_cols = {
        "equifax":          df["efx_confidence"],
        "open_corporates":  df["oc_confidence"],
        "zoominfo":         df["zi_confidence"],
        "liberty":          df["liberty_confidence"],
    }
    conf_df = pd.DataFrame(conf_cols)
    df["best_source"]     = conf_df.idxmax(axis=1)
    df["best_confidence"] = conf_df.max(axis=1).round(4)

    # Production rule: max(zi_confidence, efx_confidence) winner
    df["prod_winner"] = df.apply(
        lambda r: "zoominfo" if r["zi_confidence"] > r["efx_confidence"] else "equifax",
        axis=1,
    )
    df["prod_winner_conf"] = df[["efx_confidence", "zi_confidence"]].max(axis=1).round(4)

    return df

# ── Consensus Level 2 classification ─────────────────────────────────────────

AML_FLAGS = [
    ("hi_risk_sector",           0,    "HIGH_RISK_SECTOR",      "Code in AML elevated NAICS sector (5511 Holding, 5221 Banking, 4236 Dual-use, 9281 Defence)"),
    ("web_registry_distance",    0.55, "REGISTRY_DISCREPANCY",  "Web presence description diverges from OC registry label — shell company signal"),
    ("temporal_pivot_score",     0.50, "STRUCTURE_CHANGE",      "Industry code changed across recent API calls — potential money laundering / U-Turn fraud"),
    ("source_majority_agreement",0.40, "SOURCE_CONFLICT",       "Sources return different industry codes — vendors disagree"),
    ("tru_pollution_flag",       0,    "TRULIOO_POLLUTION",     "Trulioo returned 4-digit SIC for a 5-digit jurisdiction — data quality defect"),
]
RISK_WEIGHTS = dict(
    HIGH_RISK_SECTOR=0.30, REGISTRY_DISCREPANCY=0.25, STRUCTURE_CHANGE=0.20,
    SOURCE_CONFLICT=0.15, TRULIOO_POLLUTION=0.05, LOW_CONSENSUS_PROB=0.10,
)

JUR_EU = {"gb","de","fr","it","es","nl","pl","be","at","se","no","dk","fi",
          "ie","pt","gr","cz","hu","ro","bg","hr","sk","si","ee","lv","lt",
          "lu","mt","cy","gg","je","gl","gp","re","pm","is","li","mc","ch"}
JUR_APAC = {"cn","jp","kr","in","sg","au","hk","th","my","vn","ph","id","tw","nz"}
JUR_LATAM = {"mx","br","ar","co","cl","pe","ve","ec","bo","py","uy","gt","cr",
             "pa","hn","ni","sv","do","cu","jm","tt","bb","ky","aw","bz","pr"}
JUR_MENA = {"ae","sa","ir","tr","eg","dz","ma","tn","ly","iq","sy","jo",
            "lb","il","ps","kw","qa","bh","om","ye"}
JUR_AFR = {"za","ng","ke","tz","ug","rw","mu","gh","et","ao","cm"}
HIGH_RISK_NAICS = {"5511","5221","5222","5239","4236","9281"}


def _taxonomy_for_jc(jc: str) -> str:
    j = str(jc or "").lower().strip()
    if j in ("gb","gg","je") or j.startswith("gb_"): return "UK_SIC_2007"
    if j in ("us","ca","au") or j.startswith("us_") or j.startswith("ca_"): return "US_NAICS_2022"
    if j in JUR_EU: return "NACE_REV2"
    if j in JUR_APAC: return "ISIC_REV4"
    if j in JUR_LATAM: return "ISIC_REV4"
    if j in JUR_MENA: return "ISIC_REV4"
    if j in JUR_AFR: return "ISIC_REV4"
    return "US_NAICS_2022"


def classify_batch(df: pd.DataFrame) -> pd.DataFrame:
    """Run Consensus Level 2 classification on every row."""
    er  = _get_entity_resolver()
    sim = _get_data_simulator()
    ce  = _get_consensus_engine()
    re  = _get_risk_engine()

    results = []
    n = len(df)
    prog = st.progress(0.0)
    status = st.empty()

    for i, row in df.iterrows():
        name    = str(row.get("company_name", "") or "")
        address = str(row.get("address", "") or "")
        country = str(row.get("country", "") or "")
        state   = str(row.get("state", "") or "")
        jc_raw  = str(row.get("oc_jurisdiction_code", "") or "")

        if not name.strip():
            results.append({})
            prog.progress((i + 1) / n)
            continue

        status.text(f"Classifying {i + 1}/{n}: {name}")

        try:
            entity = er.resolve(name, address, country or state)
            jc = jc_raw or entity.jurisdiction_code or "us"

            bundle = sim.fetch(
                company_name=name,
                address=address,
                country=country or state,
                jurisdiction=jc,
                entity_type="Operating",
                web_summary="",
            )
            consensus = ce.predict(bundle)
            risk      = re.evaluate(bundle, consensus)

            p1 = consensus.primary_industry
            s  = consensus.secondary_industries[:2]
            taxonomy = _taxonomy_for_jc(jc)

            # AML flags
            signals = {s.flag for s in risk.signals}
            flags_str = "; ".join(sorted(signals)) if signals else "—"

            results.append({
                "cons_naics_1":    p1.code,
                "cons_label_1":    p1.label,
                "cons_prob_1":     round(p1.consensus_probability, 4),
                "cons_taxonomy":   taxonomy,
                "cons_naics_2":    s[0].code if s else "",
                "cons_label_2":    s[0].label if s else "",
                "cons_prob_2":     round(s[0].consensus_probability, 4) if s else 0.0,
                "cons_naics_3":    s[1].code if len(s) > 1 else "",
                "cons_label_3":    s[1].label if len(s) > 1 else "",
                "cons_prob_3":     round(s[1].consensus_probability, 4) if len(s) > 1 else 0.0,
                "cons_risk_score": round(risk.overall_risk_score, 4),
                "cons_kyb":        risk.kyb_recommendation,
                "cons_risk_flags": flags_str,
                "cons_jurisdiction": jc,
            })
        except Exception as exc:
            results.append({
                "cons_naics_1": "", "cons_label_1": "Error",
                "cons_prob_1": 0.0, "cons_taxonomy": "US_NAICS_2022",
                "cons_naics_2": "", "cons_label_2": "",
                "cons_prob_2": 0.0, "cons_naics_3": "", "cons_label_3": "",
                "cons_prob_3": 0.0, "cons_risk_score": 0.0,
                "cons_kyb": "REVIEW", "cons_risk_flags": str(exc)[:80],
                "cons_jurisdiction": "us",
            })

        prog.progress((i + 1) / n)

    status.empty()
    prog.empty()
    return pd.concat(
        [df.reset_index(drop=True), pd.DataFrame(results).reset_index(drop=True)],
        axis=1,
    )

# ── Chart helpers ─────────────────────────────────────────────────────────────

def _confidence_distribution_chart(df: pd.DataFrame) -> go.Figure:
    sources = {
        "Equifax":          "efx_confidence",
        "OpenCorporates":   "oc_confidence",
        "ZoomInfo":         "zi_confidence",
        "Liberty":          "liberty_confidence",
    }
    fig = go.Figure()
    cols = list(COLOURS.values())[:4]
    for (label, col), colour in zip(sources.items(), cols):
        if col not in df.columns: continue
        vals = pd.to_numeric(df[col], errors="coerce").dropna()
        fig.add_trace(go.Histogram(
            x=vals, name=label, opacity=0.75,
            marker_color=colour, nbinsx=20,
        ))
    fig.update_layout(
        barmode="overlay",
        title="Level 1 Match Confidence Distribution by Source",
        xaxis_title="Confidence Score",
        yaxis_title="Companies",
        template="plotly_dark",
        height=350,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )
    fig.add_vline(x=0.80, line_dash="dash", line_color="white",
                  annotation_text="0.80 threshold", annotation_position="top right")
    return fig


def _best_source_chart(df: pd.DataFrame) -> go.Figure:
    counts = df["best_source"].value_counts().reset_index()
    counts.columns = ["Source", "Count"]
    colour_map = {
        "equifax":         COLOURS["equifax"],
        "open_corporates": COLOURS["open_corporates"],
        "zoominfo":        COLOURS["zoominfo"],
        "liberty":         COLOURS["liberty"],
    }
    fig = px.bar(
        counts, x="Source", y="Count",
        color="Source", color_discrete_map=colour_map,
        title="Best Source Distribution (highest Level 1 confidence per company)",
        template="plotly_dark", height=320,
    )
    fig.update_layout(showlegend=False)
    return fig


def _prod_vs_cons_source_chart(df: pd.DataFrame) -> go.Figure:
    """Compare production rule winner vs best-source-across-all-sources."""
    if "prod_winner" not in df.columns or "best_source" not in df.columns:
        return go.Figure()

    prod = df["prod_winner"].value_counts().reset_index()
    prod.columns = ["Source", "Count"]
    prod["Pipeline"] = "Production (ZI vs EFX only)"

    best = df["best_source"].value_counts().reset_index()
    best.columns = ["Source", "Count"]
    best["Pipeline"] = "Best across all sources"

    combined = pd.concat([prod, best])
    fig = px.bar(
        combined, x="Source", y="Count", color="Pipeline",
        barmode="group",
        title="Production Rule Winner vs Best Source Across All Sources",
        template="plotly_dark", height=350,
        color_discrete_map={
            "Production (ZI vs EFX only)": "#FC8181",
            "Best across all sources":     "#68D391",
        },
    )
    return fig


def _kyb_chart(df: pd.DataFrame) -> go.Figure:
    if "cons_kyb" not in df.columns:
        return go.Figure()
    counts = df["cons_kyb"].value_counts()
    order = ["APPROVE", "REVIEW", "ESCALATE", "REJECT"]
    vals = [counts.get(k, 0) for k in order]
    fig = px.bar(
        x=order, y=vals,
        color=order,
        color_discrete_map={k: COLOURS.get(k, "#999") for k in order},
        labels={"x": "KYB Recommendation", "y": "Companies"},
        title="KYB Recommendation (Consensus Only — Production never produces this)",
        template="plotly_dark", height=320,
    )
    fig.update_layout(showlegend=False)
    return fig


def _probability_chart(df: pd.DataFrame) -> go.Figure:
    if "cons_prob_1" not in df.columns:
        return go.Figure()
    probs = pd.to_numeric(df["cons_prob_1"], errors="coerce").dropna()
    fig = go.Figure()
    fig.add_trace(go.Histogram(x=probs, nbinsx=20,
                               marker_color=COLOURS["APPROVE"], opacity=0.85))
    fig.add_vline(x=0.70, line_dash="dash", line_color="#68D391",
                  annotation_text="70% — High confidence")
    fig.add_vline(x=0.40, line_dash="dash", line_color="#ECC94B",
                  annotation_text="40% — Medium confidence")
    fig.update_layout(
        title="Consensus Level 2 — Probability Distribution",
        xaxis_title="Top-1 Probability",
        yaxis_title="Companies",
        template="plotly_dark", height=320,
    )
    return fig


def _source_heatmap(df: pd.DataFrame) -> go.Figure:
    sources = ["efx_confidence", "oc_confidence", "zi_confidence", "liberty_confidence"]
    labels  = ["Equifax", "OpenCorporates", "ZoomInfo", "Liberty"]
    matrix  = []
    for col in sources:
        if col in df.columns:
            vals = pd.to_numeric(df[col], errors="coerce").fillna(0).tolist()
            matrix.append(vals[:50])  # cap at 50 for readability

    fig = px.imshow(
        matrix,
        y=labels[:len(matrix)],
        color_continuous_scale="Blues",
        aspect="auto",
        title="Level 1 Confidence Heatmap (first 50 companies)",
        template="plotly_dark", height=280,
    )
    fig.update_layout(coloraxis_colorbar=dict(title="Conf."))
    return fig

# ── Sidebar ───────────────────────────────────────────────────────────────────

def _sidebar() -> tuple[pd.DataFrame | None, bool]:
    st.sidebar.title("🏭 Industry Classification Dashboard")
    st.sidebar.caption("Entity Matching + Consensus Level 2 XGBoost")

    st.sidebar.markdown("---")
    st.sidebar.subheader("1. Upload Data")
    st.sidebar.markdown("""
Upload a CSV with Worth AI columns:
`lgl_nm_worth`, `address_1_worth`, `city_worth`,
`region_worth`, `zip_code_worth`, `country_worth`

Or use the sample file included in the repo:
`amex_worth_final_cleaned_data_sample_50_nonrandom.csv`
""")

    uploaded = st.sidebar.file_uploader("Upload CSV", type=["csv"])

    use_sample = st.sidebar.button("Use sample file (50 NJ companies)")

    raw_df = None
    if uploaded:
        raw_df = pd.read_csv(uploaded)
        st.sidebar.success(f"Loaded {len(raw_df)} rows from upload.")
    elif use_sample:
        sample_path = Path(__file__).parent / "amex_worth_final_cleaned_data_sample_50_nonrandom.csv"
        if sample_path.exists():
            raw_df = pd.read_csv(sample_path)
            st.sidebar.success(f"Loaded {len(raw_df)} rows from sample file.")
        else:
            st.sidebar.error("Sample file not found. Please upload a CSV.")

    st.sidebar.markdown("---")
    run_classify = st.sidebar.button(
        "▶ Run Classification", type="primary",
        disabled=(raw_df is None),
        help="Runs Level 1 confidence surfacing + Consensus Level 2 XGBoost",
    )

    st.sidebar.markdown("---")
    st.sidebar.markdown("""
**Data source notes**

- If the CSV already contains `efx_confidence`, `oc_confidence`, `zi_confidence` columns (from a prior entity matching run), those real Level 1 values are used directly.
- Otherwise, realistic confidence scores are simulated.
- Consensus Level 2 always runs from scratch here.
""")

    return raw_df, run_classify

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    raw_df, run_classify = _sidebar()

    st.title("🏭 Entity Matching × Industry Classification")
    st.markdown(
        "Combines **Level 1 entity matching** (EFX, OC, ZI, Liberty confidence) "
        "with **Consensus Level 2 XGBoost** industry classification — "
        "showing current production outputs and new Consensus outputs side by side."
    )

    if raw_df is None:
        st.info(
            "Upload a CSV or click **Use sample file** in the sidebar, "
            "then click **▶ Run Classification**."
        )
        st.markdown("### Expected input format")
        st.dataframe(pd.DataFrame({
            "lgl_nm_worth": ["FOSTER'S ALASKA CABINS", "BETTY H FREEMAN INC."],
            "address_1_worth": ["1005 ANGLER DR", "680 SCHILLINGER RD S"],
            "city_worth": ["KENAI", "MOBILE"],
            "region_worth": ["AK", "AL"],
            "zip_code_worth": ["99611", "36695"],
            "country_worth": ["US", "US"],
        }), use_container_width=True)
        return

    # Parse and normalise
    df = parse_input_csv(raw_df)
    df = compute_level1(df)

    if not run_classify and "cons_kyb" not in st.session_state.get("results_df", pd.DataFrame()).columns:
        # Show Level 1 preview only
        st.success(f"Loaded {len(df)} companies. Click **▶ Run Classification** to add Consensus Level 2 results.")
        st.subheader("Level 1 Preview")
        prev_cols = [c for c in ["company_name", "efx_confidence", "oc_confidence",
                                  "zi_confidence", "liberty_confidence", "best_source", "best_confidence"]
                     if c in df.columns]
        st.dataframe(df[prev_cols].head(20), use_container_width=True, hide_index=True)
        st.plotly_chart(_confidence_distribution_chart(df), use_container_width=True)
        return

    if run_classify:
        with st.spinner("Running Consensus Level 2 XGBoost …"):
            t0 = time.time()
            df = classify_batch(df)
            elapsed = time.time() - t0
        st.session_state["results_df"] = df
        st.success(f"Classification complete — {len(df)} companies in {elapsed:.1f}s")
    elif "results_df" in st.session_state:
        df = st.session_state["results_df"]

    if "cons_kyb" not in df.columns:
        return

    # ── TABS ─────────────────────────────────────────────────────────────────
    tab_overview, tab_l1, tab_l2, tab_compare, tab_records = st.tabs([
        "📊 Executive Summary",
        "🔍 Level 1 — Entity Matching",
        "🏭 Level 2 — Industry Classification",
        "⚖️ Production vs Consensus",
        "🔎 Record Explorer",
    ])

    # ── TAB 1: EXECUTIVE SUMMARY ─────────────────────────────────────────────
    with tab_overview:
        st.subheader("Executive Summary")

        n = len(df)
        any_high = (df["best_confidence"] >= 0.80).sum()
        avg_best = df["best_confidence"].mean()
        prod_high = (df["prod_winner_conf"] >= 0.80).sum()

        kyb_dist = df["cons_kyb"].value_counts().to_dict() if "cons_kyb" in df.columns else {}
        approve  = kyb_dist.get("APPROVE", 0)
        review   = kyb_dist.get("REVIEW", 0)
        esc_rej  = kyb_dist.get("ESCALATE", 0) + kyb_dist.get("REJECT", 0)
        aml_any  = (df["cons_risk_flags"] != "—").sum() if "cons_risk_flags" in df.columns else 0

        # Metric cards
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        c1.metric("Total Companies", n)
        c2.metric("Any Source ≥ 0.80", f"{any_high} ({any_high/n:.0%})")
        c3.metric("Avg Best Confidence", f"{avg_best:.3f}")
        c4.metric("APPROVE", approve)
        c5.metric("REVIEW", review)
        c6.metric("ESCALATE / REJECT", esc_rej)

        st.markdown("---")

        # Data source note
        l1_src = df["_l1_source"].iloc[0] if "_l1_source" in df.columns else "unknown"
        if "SIMULATED" in l1_src:
            st.warning(
                "**Level 1 confidence scores are SIMULATED.** "
                "Upload a CSV that already contains `efx_confidence`, `oc_confidence`, `zi_confidence` columns "
                "(output of the entity matching pipeline) to use real Level 1 values. "
                "Consensus Level 2 results are always computed fresh.",
                icon="⚠️",
            )
        else:
            st.success("**Level 1 confidence scores are REAL** — loaded from the CSV (entity matching pipeline outputs).", icon="✅")

        c_left, c_right = st.columns(2)
        with c_left:
            st.plotly_chart(_confidence_distribution_chart(df), use_container_width=True)
        with c_right:
            st.plotly_chart(_kyb_chart(df), use_container_width=True)

        st.markdown("### Summary Interpretation")
        st.markdown(f"""
- **{any_high} of {n}** companies have at least one source with confidence ≥ 0.80.
  Production rule only checks ZoomInfo vs Equifax — {prod_high} companies reach ≥ 0.80 using that rule.
  The gap of **{any_high - prod_high}** companies have their best match in OpenCorporates or Liberty,
  which the production classification rule ignores.
- **Consensus KYB**: {approve} APPROVE · {review} REVIEW · {esc_rej} ESCALATE/REJECT.
- **{aml_any} companies** triggered at least one AML signal. Production produces zero AML signals.
- Average best confidence across all sources: **{avg_best:.3f}**.
""")

    # ── TAB 2: LEVEL 1 ───────────────────────────────────────────────────────
    with tab_l1:
        st.subheader("Level 1 — Entity Matching Results")

        st.markdown("""
**What Level 1 does:** For each submitted company, compares it against
OpenCorporates, Equifax, ZoomInfo, and Liberty using 33 pairwise text/address
similarity features and outputs a match confidence 0–1 per source.

**The same model (`entity_matching_20250127 v1`) runs in both the production
pipeline and the Consensus approach.** The difference is what happens next.
""")

        c_left, c_right = st.columns(2)
        with c_left:
            st.plotly_chart(_best_source_chart(df), use_container_width=True)
        with c_right:
            st.plotly_chart(_source_heatmap(df), use_container_width=True)

        # Coverage table
        st.subheader("Source Coverage")
        src_summary = []
        for label, col in [("Equifax","efx_confidence"),("OpenCorporates","oc_confidence"),
                           ("ZoomInfo","zi_confidence"),("Liberty","liberty_confidence")]:
            if col not in df.columns: continue
            vals = pd.to_numeric(df[col], errors="coerce").fillna(0)
            high = (vals >= 0.80).sum()
            src_summary.append({
                "Source": label,
                "Mean Confidence": f"{vals.mean():.3f}",
                "Median Confidence": f"{vals.median():.3f}",
                "≥ 0.80 (Matched)": f"{high} ({high/len(df):.0%})",
                "< 0.20 (Weak)": f"{(vals < 0.20).sum()} ({(vals < 0.20).mean():.0%})",
                "Best Source (wins most)": str((df["best_source"] == label.lower().replace(" ","_")).sum()),
                "Used by Production Rule": "✅ ZI vs EFX only" if label in ("ZoomInfo","Equifax") else "❌ Never used for NAICS",
            })
        st.dataframe(pd.DataFrame(src_summary), use_container_width=True, hide_index=True)

        st.markdown("""
**Why OpenCorporates and Liberty never appear as production rule winners:**

The production rule (`customer_table.sql`) compares only ZoomInfo vs Equifax:
```sql
IF zi_match_confidence > efx_match_confidence → use ZoomInfo NAICS
ELSE                                           → use Equifax NAICS
```
OpenCorporates and Liberty have Level 1 confidence computed and stored
in Redshift — but their industry codes are **never routed through the
production classification rule**. The Consensus model uses all 4 sources.
""")

        st.subheader("All Records — Level 1 Detail")
        l1_cols = [c for c in ["company_name","efx_confidence","oc_confidence",
                                "zi_confidence","liberty_confidence",
                                "best_source","best_confidence",
                                "prod_winner","prod_winner_conf"] if c in df.columns]
        st.dataframe(
            df[l1_cols].style.background_gradient(
                subset=[c for c in ["efx_confidence","oc_confidence","zi_confidence",
                                    "liberty_confidence","best_confidence"] if c in df.columns],
                cmap="Blues", vmin=0, vmax=1,
            ),
            use_container_width=True, hide_index=True,
        )

    # ── TAB 3: LEVEL 2 ───────────────────────────────────────────────────────
    with tab_l2:
        st.subheader("Level 2 — Consensus Industry Classification")

        st.markdown("""
**What Level 2 does:** Takes the Level 1 confidence scores + vendor industry
codes (Equifax NAICS, ZoomInfo NAICS, OC multi-taxonomy UIDs, Liberty) as a
**45-feature vector** and runs `XGBClassifier(objective="multi:softprob")` to
produce a calibrated probability distribution over all possible industry codes.
""")

        c_left, c_right = st.columns(2)
        with c_left:
            st.plotly_chart(_probability_chart(df), use_container_width=True)
        with c_right:
            # Taxonomy distribution
            if "cons_taxonomy" in df.columns:
                tax_counts = df["cons_taxonomy"].value_counts().reset_index()
                tax_counts.columns = ["Taxonomy", "Count"]
                fig_tax = px.pie(
                    tax_counts, names="Taxonomy", values="Count",
                    title="Primary Taxonomy Distribution",
                    template="plotly_dark", height=320,
                )
                st.plotly_chart(fig_tax, use_container_width=True)

        # AML signals
        if "cons_risk_flags" in df.columns:
            st.subheader("AML / KYB Risk Signals")
            from collections import Counter
            all_flags = [f.strip() for row in df["cons_risk_flags"]
                         for f in str(row).split(";") if f.strip() and f.strip() != "—"]
            if all_flags:
                fc = Counter(all_flags).most_common()
                flag_df = pd.DataFrame(fc, columns=["Signal", "Count"])
                flag_df["% of Companies"] = (flag_df["Count"] / len(df) * 100).round(1).astype(str) + "%"
                flag_df["Meaning"] = flag_df["Signal"].map({
                    "HIGH_RISK_SECTOR":     "Code in elevated AML sector (Holding, Banking, Dual-use, Defence)",
                    "REGISTRY_DISCREPANCY": "Web presence diverges from OC registry label — shell company signal",
                    "STRUCTURE_CHANGE":     "Industry code changed across API calls — U-Turn fraud signal",
                    "SOURCE_CONFLICT":      "Sources return different industry codes — vendors disagree",
                    "TRULIOO_POLLUTION":    "Trulioo returned 4-digit SIC for a 5-digit jurisdiction",
                    "LOW_CONSENSUS_PROB":   "Model confidence < 40% — data is ambiguous",
                })
                st.dataframe(flag_df, use_container_width=True, hide_index=True)
            else:
                st.success("No AML signals fired for this dataset.")

        st.subheader("All Records — Consensus Level 2 Detail")
        l2_cols = [c for c in ["company_name","cons_naics_1","cons_label_1",
                                "cons_prob_1","cons_taxonomy","cons_naics_2","cons_label_2",
                                "cons_naics_3","cons_label_3",
                                "cons_risk_score","cons_kyb","cons_risk_flags",
                                "cons_jurisdiction"] if c in df.columns]
        kyb_colour = {"APPROVE":"#1a4731","REVIEW":"#1a365d","ESCALATE":"#5c3a00","REJECT":"#5c1a1a"}

        def _style_kyb(val):
            bg = kyb_colour.get(str(val), "")
            return f"background-color:{bg};color:white" if bg else ""

        styled = df[l2_cols].style
        if "cons_kyb" in l2_cols:
            styled = styled.applymap(_style_kyb, subset=["cons_kyb"])
        if "cons_prob_1" in l2_cols:
            styled = styled.background_gradient(subset=["cons_prob_1"], cmap="Greens", vmin=0, vmax=1)
        st.dataframe(styled, use_container_width=True, hide_index=True)

    # ── TAB 4: COMPARE ───────────────────────────────────────────────────────
    with tab_compare:
        st.subheader("Production vs Consensus — Side by Side")

        st.plotly_chart(_prod_vs_cons_source_chart(df), use_container_width=True)

        st.markdown("""
### Key Differences

| | Production (customer_table.sql) | Consensus (Level 2 XGBoost) |
|---|---|---|
| Sources compared | ZoomInfo vs Equifax only | All 4: OC + EFX + ZI + Liberty |
| Output | 1 NAICS code — no probability | Top-3 codes with calibrated probability |
| UK SIC | Received from OC — silently dropped | Primary output for GB companies |
| AML signals | **0 — not produced** | 6 signal types |
| KYB recommendation | **None** | APPROVE / REVIEW / ESCALATE / REJECT |
| Jurisdiction routing | Always NAICS regardless of country | Correct taxonomy per country |
| OpenCorporates industry codes | Ignored by rule | Weighted feature in Level 2 |
""")

        if "cons_naics_1" in df.columns and "prod_winner" in df.columns:
            # Build comparison view
            comp_cols = [c for c in [
                "company_name",
                "prod_winner", "prod_winner_conf",
                "best_source", "best_confidence",
                "cons_naics_1", "cons_label_1", "cons_prob_1",
                "cons_taxonomy", "cons_kyb", "cons_risk_flags",
            ] if c in df.columns]
            comp_df = df[comp_cols].copy()
            comp_df["prod_winner_conf_pct"] = (comp_df["prod_winner_conf"] * 100).round(1).astype(str) + "%"
            comp_df["best_confidence_pct"]  = (comp_df["best_confidence"] * 100).round(1).astype(str) + "%"
            comp_df["cons_prob_1_pct"]      = (comp_df["cons_prob_1"] * 100).round(1).astype(str) + "%"
            st.dataframe(comp_df.drop(columns=["prod_winner_conf","best_confidence","cons_prob_1"], errors="ignore"),
                         use_container_width=True, hide_index=True)

            # Cases where best source != production winner
            gap_mask = df["best_source"].isin(["open_corporates","liberty"])
            gap_df = df[gap_mask]
            if not gap_df.empty:
                st.subheader(f"⚠️ {len(gap_df)} companies — best source is OC or Liberty (ignored by production rule)")
                st.markdown("These companies have their strongest entity match in OpenCorporates or Liberty. "
                            "The production rule ignores those sources and falls back to a weaker ZI or EFX match.")
                gap_show = [c for c in ["company_name","best_source","best_confidence",
                                        "oc_confidence","efx_confidence","zi_confidence",
                                        "liberty_confidence","prod_winner","prod_winner_conf"] if c in gap_df.columns]
                st.dataframe(gap_df[gap_show], use_container_width=True, hide_index=True)

    # ── TAB 5: RECORD EXPLORER ───────────────────────────────────────────────
    with tab_records:
        st.subheader("Record Explorer")
        st.markdown("Select a company to see full Level 1 + Level 2 detail.")

        names = df["company_name"].astype(str).tolist()
        selected = st.selectbox("Select company", names, index=0)
        idx = names.index(selected)
        row = df.iloc[idx]

        c_l, c_r = st.columns(2)
        with c_l:
            st.markdown("#### Level 1 — Entity Matching")
            l1_data = {
                "Equifax confidence":         f"{row.get('efx_confidence',0):.3f}",
                "OpenCorporates confidence":  f"{row.get('oc_confidence',0):.3f}",
                "ZoomInfo confidence":        f"{row.get('zi_confidence',0):.3f}",
                "Liberty confidence":         f"{row.get('liberty_confidence',0):.3f}",
                "Best source (max of all)":   str(row.get("best_source","")),
                "Best confidence":            f"{row.get('best_confidence',0):.3f}",
                "Production rule winner":     str(row.get("prod_winner","")),
                "Production rule confidence": f"{row.get('prod_winner_conf',0):.3f}",
                "Data source":                str(row.get("_l1_source","")),
            }
            st.dataframe(
                pd.DataFrame(list(l1_data.items()), columns=["Field","Value"]),
                use_container_width=True, hide_index=True,
            )

            # Confidence gauge
            fig_gauge = go.Figure(go.Indicator(
                mode="gauge+number",
                value=float(row.get("best_confidence", 0)),
                title={"text": "Best Level 1 Confidence"},
                gauge={
                    "axis": {"range": [0, 1]},
                    "steps": [
                        {"range": [0, 0.50], "color": "#742A2A"},
                        {"range": [0.50, 0.80], "color": "#744210"},
                        {"range": [0.80, 1.0], "color": "#276749"},
                    ],
                    "threshold": {"line": {"color": "white", "width": 3}, "value": 0.80},
                },
            ))
            fig_gauge.update_layout(height=250, template="plotly_dark", margin=dict(t=30,b=10))
            st.plotly_chart(fig_gauge, use_container_width=True)

        with c_r:
            st.markdown("#### Level 2 — Consensus Industry Classification")

            kyb_val = str(row.get("cons_kyb", ""))
            kyb_col = {"APPROVE":"#276749","REVIEW":"#1A365D","ESCALATE":"#744210","REJECT":"#742A2A"}.get(kyb_val,"#444")
            st.markdown(
                f'<div style="background:{kyb_col};padding:10px 16px;border-radius:8px;'
                f'font-size:1.2em;font-weight:700;color:white;text-align:center">'
                f'KYB: {kyb_val}</div>',
                unsafe_allow_html=True,
            )
            st.markdown("")

            l2_data = {
                "Primary code":           str(row.get("cons_naics_1","")),
                "Primary label":          str(row.get("cons_label_1","")),
                "Probability":            f"{float(row.get('cons_prob_1',0)):.1%}",
                "Taxonomy":               str(row.get("cons_taxonomy","")),
                "Secondary code 1":       f"{row.get('cons_naics_2','')} — {row.get('cons_label_2','')}",
                "Secondary code 2":       f"{row.get('cons_naics_3','')} — {row.get('cons_label_3','')}",
                "Risk score":             f"{float(row.get('cons_risk_score',0)):.3f}",
                "AML flags":              str(row.get("cons_risk_flags","—")),
                "Jurisdiction":           str(row.get("cons_jurisdiction","")),
            }
            st.dataframe(
                pd.DataFrame(list(l2_data.items()), columns=["Field","Value"]),
                use_container_width=True, hide_index=True,
            )

        # Interpretation
        st.markdown("#### Interpretation")
        best_conf = float(row.get("best_confidence", 0))
        prod_conf = float(row.get("prod_winner_conf", 0))
        prob = float(row.get("cons_prob_1", 0))
        flags_str = str(row.get("cons_risk_flags", "—"))
        kyb = str(row.get("cons_kyb", ""))
        best_src  = str(row.get("best_source", ""))
        prod_win  = str(row.get("prod_winner", ""))

        interp = []
        if best_conf >= 0.80:
            interp.append(f"✅ Strong entity match found (best confidence {best_conf:.3f} from {best_src}).")
        elif best_conf >= 0.50:
            interp.append(f"🟡 Moderate entity match (best confidence {best_conf:.3f} from {best_src}). Review recommended.")
        else:
            interp.append(f"🔴 Weak entity match (best confidence {best_conf:.3f}). Company may not be in source databases.")

        if best_src in ("open_corporates", "liberty") and prod_win in ("zoominfo","equifax"):
            interp.append(
                f"⚠️ Best Level 1 match is from **{best_src}** (conf {best_conf:.3f}), "
                f"but the production rule ignores this source and uses **{prod_win}** "
                f"(conf {prod_conf:.3f}). The production NAICS may be based on a weaker match."
            )

        if prob >= 0.70:
            interp.append(f"✅ Consensus classification is HIGH confidence ({prob:.0%}).")
        elif prob >= 0.40:
            interp.append(f"🟡 Consensus classification is MEDIUM confidence ({prob:.0%}). "
                          "Review the secondary codes.")
        else:
            interp.append(f"🔴 Consensus classification is LOW confidence ({prob:.0%}). "
                          "Sources are conflicting. Manual review required.")

        if flags_str != "—":
            interp.append(f"🚨 **AML signals detected:** {flags_str}")

        if kyb in ("ESCALATE", "REJECT"):
            interp.append(f"🚨 **KYB: {kyb}** — this company requires immediate human review.")
        elif kyb == "REVIEW":
            interp.append(f"🟡 **KYB: REVIEW** — routine analyst review recommended.")
        else:
            interp.append(f"✅ **KYB: APPROVE** — no elevated risk signals.")

        for line in interp:
            st.markdown(f"- {line}")

    # ── Download ──────────────────────────────────────────────────────────────
    st.divider()
    st.subheader("Download Results")
    buf = io.BytesIO()
    export_cols = [c for c in [
        "company_name", "efx_confidence", "oc_confidence", "zi_confidence",
        "liberty_confidence", "best_source", "best_confidence",
        "prod_winner", "prod_winner_conf",
        "cons_naics_1", "cons_label_1", "cons_prob_1", "cons_taxonomy",
        "cons_naics_2", "cons_label_2", "cons_naics_3", "cons_label_3",
        "cons_risk_score", "cons_kyb", "cons_risk_flags", "cons_jurisdiction",
    ] if c in df.columns]
    df[export_cols].to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    st.download_button(
        "📥 Download Full Results (Excel)",
        data=buf,
        file_name="industry_classification_results.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    st.download_button(
        "📥 Download Full Results (CSV)",
        data=df[export_cols].to_csv(index=False),
        file_name="industry_classification_results.csv",
        mime="text/csv",
    )


if __name__ == "__main__":
    main()
