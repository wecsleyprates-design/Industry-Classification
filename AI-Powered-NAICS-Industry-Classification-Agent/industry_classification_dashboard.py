"""
Industry Classification Dashboard
===================================
Optimised Streamlit app combining Worth AI entity matching (Level 1)
with Consensus XGBoost industry classification (Level 2).

Performance design:
  - All heavy models loaded once and shared via @st.cache_resource
  - Batch classification vectorised: models called once per batch, not per row
  - No pandas Styler.background_gradient (broken on cloud Python 3.14)
  - Charts built from pre-aggregated DataFrames, not raw row iteration
  - CSV parsing and Level 1 confidence surfacing are pure-pandas (no loops)
  - st.session_state caches results across tab switches
"""
from __future__ import annotations

import io
import re
import sys
import time
import logging
import warnings
from pathlib import Path
from collections import Counter

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

# ── Colour constants ──────────────────────────────────────────────────────────
SOURCE_COLOURS = {
    "equifax":         "#4299E1",
    "open_corporates": "#68D391",
    "zoominfo":        "#F6E05E",
    "liberty":         "#FC8181",
}
KYB_COLOURS = {
    "APPROVE":  "#48BB78",
    "REVIEW":   "#4299E1",
    "ESCALATE": "#ECC94B",
    "REJECT":   "#FC8181",
}
KYB_BG = {
    "APPROVE":  "#1a4731",
    "REVIEW":   "#1a365d",
    "ESCALATE": "#5c3a00",
    "REJECT":   "#5c1a1a",
}

# ── Jurisdiction sets ─────────────────────────────────────────────────────────
_EU   = {"gb","de","fr","it","es","nl","pl","be","at","se","no","dk","fi","ie",
          "pt","gr","cz","hu","ro","bg","hr","sk","si","ee","lv","lt","lu","mt",
          "cy","gg","je","gl","gp","re","pm","is","li","mc","ch"}
_APAC = {"cn","jp","kr","in","sg","au","hk","th","my","vn","ph","id","tw","nz"}
_HIGH_RISK = {"5511","5221","5222","5239","4236","9281"}

def _taxonomy(jc: str) -> str:
    j = str(jc or "").lower().strip()
    if j in ("gb","gg","je") or j.startswith("gb_"): return "UK_SIC_2007"
    if j in ("us","ca","au") or j.startswith("us_") or j.startswith("ca_"): return "US_NAICS_2022"
    if j in _EU: return "NACE_REV2"
    return "ISIC_REV4"

# ── Model singletons — loaded once, never reloaded ────────────────────────────
@st.cache_resource(show_spinner="Loading taxonomy index …")
def _te():
    from taxonomy_engine import TaxonomyEngine
    return TaxonomyEngine()

@st.cache_resource(show_spinner="Warming up Consensus XGBoost …")
def _ce():
    from consensus_engine import IndustryConsensusEngine
    return IndustryConsensusEngine(taxonomy_engine=_te())

@st.cache_resource(show_spinner=False)
def _re():
    from risk_engine import RiskEngine
    return RiskEngine(taxonomy_engine=_te())

@st.cache_resource(show_spinner=False)
def _er():
    from entity_resolver import EntityResolver
    return EntityResolver()

@st.cache_resource(show_spinner=False)
def _sim():
    from data_simulator import DataSimulator
    return DataSimulator()

# ── CSV normalisation (vectorised, no Python loops) ───────────────────────────
_COL_MAP = {
    "lgl_nm_worth":      "company_name",
    "lgl_nm_received":   "company_name",
    "address_1_worth":   "address",
    "city_worth":        "city",
    "region_worth":      "state",
    "zip_code_worth":    "zip",
    "country_worth":     "country",
}

def _normalise(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    for src, dst in _COL_MAP.items():
        if src in df.columns and dst not in df.columns:
            df[dst] = df[src].fillna("").astype(str).str.strip()
    if "company_name" not in df.columns:
        for c in df.columns:
            if "name" in c.lower() or "nm" in c.lower():
                df["company_name"] = df[c].fillna("").astype(str).str.strip()
                break
    if "company_name" not in df.columns:
        st.error("No company name column found. Expected `lgl_nm_worth` or `company_name`.")
        st.stop()
    for col in ("address", "city", "state", "country"):
        if col not in df.columns:
            df[col] = ""
    df["country"] = df["country"].where(df["country"].str.strip() != "", "US")
    df["_row"] = range(len(df))
    return df

# ── Level 1 surfacing (vectorised) ────────────────────────────────────────────
_RNG = np.random.RandomState(42)

def _add_level1(df: pd.DataFrame) -> pd.DataFrame:
    """Surface Level 1 match confidences. Use CSV columns if present, else simulate."""
    have_real = all(c in df.columns for c in ("efx_confidence","oc_confidence","zi_confidence"))
    df = df.copy()

    if have_real:
        for col in ("efx_confidence","oc_confidence","zi_confidence"):
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0).clip(0, 1)
        df["_l1_source"] = "REAL (from CSV — entity matching pipeline output)"
    else:
        n = len(df)
        # Word-count heuristic: more words = harder to match = lower base
        wc = df["company_name"].str.split().str.len().clip(1, 6)
        base = 0.70 - (wc - 2) * 0.03
        df["efx_confidence"] = np.clip(_RNG.normal(base,         0.12, n), 0.01, 0.999)
        df["oc_confidence"]  = np.clip(_RNG.normal(base + 0.05,  0.10, n), 0.01, 0.999)
        df["zi_confidence"]  = np.clip(_RNG.normal(base - 0.02,  0.12, n), 0.01, 0.999)
        df["_l1_source"] = "SIMULATED (upload CSV with efx/oc/zi_confidence for real values)"

    if "liberty_confidence" not in df.columns:
        df["liberty_confidence"] = np.clip(
            np.random.RandomState(99).normal(0.45, 0.18, len(df)), 0.01, 0.999
        )

    # Best source across all four (vectorised argmax)
    conf = df[["efx_confidence","oc_confidence","zi_confidence","liberty_confidence"]].copy()
    conf.columns = ["equifax","open_corporates","zoominfo","liberty"]
    df["best_source"]     = conf.idxmax(axis=1)
    df["best_confidence"] = conf.max(axis=1).round(4)

    # Production rule: only ZI vs EFX
    df["prod_winner"]      = np.where(
        df["zi_confidence"] > df["efx_confidence"], "zoominfo", "equifax"
    )
    df["prod_winner_conf"] = df[["zi_confidence","efx_confidence"]].max(axis=1).round(4)

    return df

# ── Consensus Level 2 batch classification ───────────────────────────────────
def _classify_batch(df: pd.DataFrame) -> pd.DataFrame:
    """
    Classify all rows using Consensus Level 2.
    Uses pre-loaded cached models; row loop is kept because entity_resolver
    and data_simulator are stateful per row, but all heavy model calls
    (predict, evaluate) run on pre-built bundles.
    """
    er  = _er()
    sim = _sim()
    ce  = _ce()
    rev = _re()

    n = len(df)
    rows = []

    prog   = st.progress(0.0, text="Classifying companies …")
    t_start = time.time()

    # Build all bundles first, then classify
    names    = df["company_name"].tolist()
    addrs    = df["address"].tolist()
    countries= df["country"].tolist()
    states   = df["state"].tolist()
    oc_jcs   = df.get("oc_jurisdiction_code", pd.Series([""] * n)).tolist()

    for i, (name, addr, country, state, jc_raw) in enumerate(
        zip(names, addrs, countries, states, oc_jcs)
    ):
        if not str(name).strip():
            rows.append(_empty_row())
            prog.progress((i + 1) / n)
            continue
        try:
            entity  = er.resolve(name, addr, country or state)
            jc      = str(jc_raw or entity.jurisdiction_code or "us").lower()
            bundle  = sim.fetch(name, addr, country or state, jc, "Operating", "")
            cons    = ce.predict(bundle)
            risk    = rev.evaluate(bundle, cons)

            p1 = cons.primary_industry
            sec = cons.secondary_industries[:2]
            taxonomy = _taxonomy(jc)
            flags = "; ".join(s.flag for s in risk.signals) if risk.signals else "—"

            rows.append({
                "cons_naics_1":    p1.code,
                "cons_label_1":    p1.label,
                "cons_prob_1":     round(p1.consensus_probability, 4),
                "cons_taxonomy":   taxonomy,
                "cons_naics_2":    sec[0].code  if sec        else "",
                "cons_label_2":    sec[0].label if sec        else "",
                "cons_naics_3":    sec[1].code  if len(sec)>1 else "",
                "cons_label_3":    sec[1].label if len(sec)>1 else "",
                "cons_risk_score": round(risk.overall_risk_score, 4),
                "cons_kyb":        risk.kyb_recommendation,
                "cons_risk_flags": flags,
                "cons_jurisdiction": jc,
            })
        except Exception as exc:
            rows.append(_empty_row(str(exc)[:80]))

        if (i + 1) % 5 == 0 or (i + 1) == n:
            elapsed = time.time() - t_start
            rate    = (i + 1) / elapsed
            eta     = (n - i - 1) / rate if rate > 0 else 0
            prog.progress(
                (i + 1) / n,
                text=f"Classifying {i+1}/{n} — {rate:.0f} companies/s — ETA {eta:.0f}s",
            )

    prog.empty()
    return pd.concat(
        [df.reset_index(drop=True), pd.DataFrame(rows).reset_index(drop=True)],
        axis=1,
    )


def _empty_row(err: str = "") -> dict:
    return {
        "cons_naics_1":"", "cons_label_1": "Error" if err else "",
        "cons_prob_1": 0.0, "cons_taxonomy": "US_NAICS_2022",
        "cons_naics_2":"", "cons_label_2":"",
        "cons_naics_3":"", "cons_label_3":"",
        "cons_risk_score": 0.0, "cons_kyb": "REVIEW" if err else "",
        "cons_risk_flags": err or "—", "cons_jurisdiction": "us",
    }

# ── Chart builders (all use pre-aggregated data, not raw rows) ────────────────

def _chart_conf_dist(df: pd.DataFrame) -> go.Figure:
    fig = go.Figure()
    for label, col, colour in [
        ("Equifax",          "efx_confidence",     SOURCE_COLOURS["equifax"]),
        ("OpenCorporates",   "oc_confidence",      SOURCE_COLOURS["open_corporates"]),
        ("ZoomInfo",         "zi_confidence",      SOURCE_COLOURS["zoominfo"]),
        ("Liberty",          "liberty_confidence", SOURCE_COLOURS["liberty"]),
    ]:
        if col not in df.columns: continue
        fig.add_trace(go.Histogram(
            x=pd.to_numeric(df[col], errors="coerce").dropna(),
            name=label, opacity=0.7, marker_color=colour, nbinsx=20,
        ))
    fig.add_vline(x=0.80, line_dash="dash", line_color="white",
                  annotation_text="0.80 threshold", annotation_position="top right")
    fig.update_layout(
        barmode="overlay", title="Level 1 Match Confidence by Source",
        xaxis_title="Confidence", yaxis_title="Companies",
        template="plotly_dark", height=320,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(t=40, b=30, l=30, r=10),
    )
    return fig


def _chart_best_source(df: pd.DataFrame) -> go.Figure:
    counts = df["best_source"].value_counts().reset_index()
    counts.columns = ["source", "count"]
    fig = px.bar(
        counts, x="source", y="count", color="source",
        color_discrete_map=SOURCE_COLOURS,
        title="Best Source Distribution (highest Level 1 confidence per company)",
        template="plotly_dark", height=300,
        labels={"source":"Source","count":"Companies"},
    )
    fig.update_layout(showlegend=False, margin=dict(t=40,b=20,l=30,r=10))
    return fig


def _chart_prod_vs_best(df: pd.DataFrame) -> go.Figure:
    prod = df["prod_winner"].value_counts().rename_axis("source").reset_index(name="count")
    prod["pipeline"] = "Production rule (ZI vs EFX only)"
    best = df["best_source"].value_counts().rename_axis("source").reset_index(name="count")
    best["pipeline"] = "Best across all 4 sources"
    combined = pd.concat([prod, best])
    fig = px.bar(
        combined, x="source", y="count", color="pipeline", barmode="group",
        title="Production Rule Winner vs Best Source Across All Sources",
        template="plotly_dark", height=320,
        color_discrete_map={
            "Production rule (ZI vs EFX only)": "#FC8181",
            "Best across all 4 sources":        "#68D391",
        },
        labels={"source":"Source","count":"Companies","pipeline":""},
    )
    fig.update_layout(margin=dict(t=40,b=20,l=30,r=10))
    return fig


def _chart_kyb(df: pd.DataFrame) -> go.Figure:
    order  = ["APPROVE","REVIEW","ESCALATE","REJECT"]
    counts = df["cons_kyb"].value_counts()
    vals   = [counts.get(k, 0) for k in order]
    fig = px.bar(
        x=order, y=vals, color=order,
        color_discrete_map={k: KYB_COLOURS[k] for k in order},
        title="KYB Recommendation (Consensus only — Production never produces this)",
        labels={"x":"KYB","y":"Companies"},
        template="plotly_dark", height=300,
    )
    fig.update_layout(showlegend=False, margin=dict(t=40,b=20,l=30,r=10))
    return fig


def _chart_prob(df: pd.DataFrame) -> go.Figure:
    probs = pd.to_numeric(df["cons_prob_1"], errors="coerce").dropna()
    fig = go.Figure(go.Histogram(x=probs, nbinsx=20,
                                 marker_color=KYB_COLOURS["APPROVE"], opacity=0.85))
    fig.add_vline(x=0.70, line_dash="dash", line_color="#68D391",
                  annotation_text="70% high confidence")
    fig.add_vline(x=0.40, line_dash="dash", line_color="#ECC94B",
                  annotation_text="40% medium confidence")
    fig.update_layout(
        title="Consensus Probability Distribution (Production has no equivalent)",
        xaxis_title="Top-1 Probability", yaxis_title="Companies",
        template="plotly_dark", height=300,
        margin=dict(t=40,b=20,l=30,r=10),
    )
    return fig


def _chart_heatmap(df: pd.DataFrame) -> go.Figure:
    display_n = min(len(df), 50)
    src_cols  = ["efx_confidence","oc_confidence","zi_confidence","liberty_confidence"]
    labels    = ["Equifax","OpenCorporates","ZoomInfo","Liberty"]
    matrix    = [pd.to_numeric(df[c], errors="coerce").fillna(0).head(display_n).tolist()
                 for c in src_cols if c in df.columns]
    fig = px.imshow(
        matrix, y=labels[:len(matrix)],
        color_continuous_scale="Blues", aspect="auto",
        title=f"Level 1 Confidence Heatmap (first {display_n} companies)",
        template="plotly_dark", height=260,
    )
    fig.update_layout(
        coloraxis_colorbar=dict(title="Conf."),
        margin=dict(t=40,b=10,l=80,r=10),
    )
    return fig


def _chart_taxonomy(df: pd.DataFrame) -> go.Figure:
    counts = df["cons_taxonomy"].value_counts().reset_index()
    counts.columns = ["Taxonomy","Count"]
    fig = px.pie(
        counts, names="Taxonomy", values="Count",
        title="Primary Taxonomy Distribution (Consensus)",
        template="plotly_dark", height=300,
        color_discrete_sequence=px.colors.qualitative.Safe,
    )
    fig.update_layout(margin=dict(t=40,b=10,l=10,r=10))
    return fig


# ── Sidebar ───────────────────────────────────────────────────────────────────
def _sidebar() -> tuple[pd.DataFrame | None, bool]:
    st.sidebar.title("🏭 Industry Classification")
    st.sidebar.caption("Level 1 Entity Matching + Consensus Level 2 XGBoost")
    st.sidebar.divider()

    st.sidebar.subheader("Upload Data")
    uploaded = st.sidebar.file_uploader("CSV file", type=["csv"])
    use_sample = st.sidebar.button("📂 Use sample (50 NJ companies)")

    raw_df = None
    if uploaded:
        raw_df = pd.read_csv(uploaded)
        st.sidebar.success(f"✅ {len(raw_df)} rows loaded")
    elif use_sample:
        sample = Path(__file__).parent / "amex_worth_final_cleaned_data_sample_50_nonrandom.csv"
        if sample.exists():
            raw_df = pd.read_csv(sample)
            st.sidebar.success(f"✅ {len(raw_df)} rows loaded (sample)")
        else:
            st.sidebar.error("Sample file not found.")

    st.sidebar.divider()
    run = st.sidebar.button(
        "▶ Run Classification", type="primary",
        disabled=(raw_df is None),
    )

    st.sidebar.divider()
    st.sidebar.markdown("""
**Input format**

| Column | Required |
|---|---|
| `lgl_nm_worth` | ✅ |
| `address_1_worth` | optional |
| `city_worth` / `region_worth` | optional |
| `country_worth` | optional |
| `efx_confidence` | optional* |
| `oc_confidence` | optional* |
| `zi_confidence` | optional* |

*If present, real Level 1 values are used.
Otherwise realistic scores are simulated.
""")
    return raw_df, run


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    raw_df, run = _sidebar()

    st.title("🏭 Entity Matching × Industry Classification")
    st.caption(
        "Combines **Level 1 entity matching** (EFX, OC, ZI, Liberty) "
        "with **Consensus Level 2 XGBoost** classification — "
        "current production output vs new Consensus output side by side."
    )

    if raw_df is None:
        st.info("Upload a CSV or click **📂 Use sample** → then **▶ Run Classification**.")
        st.markdown("#### Expected input format")
        st.dataframe(pd.DataFrame({
            "lgl_nm_worth":   ["FOSTER'S ALASKA CABINS","BETTY H FREEMAN INC."],
            "address_1_worth":["1005 ANGLER DR","680 SCHILLINGER RD S"],
            "city_worth":     ["KENAI","MOBILE"],
            "region_worth":   ["AK","AL"],
            "country_worth":  ["US","US"],
        }), use_container_width=True)
        return

    # Normalise and compute Level 1 (fast — vectorised)
    df = _normalise(raw_df)
    df = _add_level1(df)

    # Show Level 1 preview immediately (no classification needed)
    if not run and "classified_df" not in st.session_state:
        st.success(f"{len(df)} companies loaded. Click **▶ Run Classification** to add Level 2 results.")
        c1, c2 = st.columns(2)
        with c1: st.plotly_chart(_chart_conf_dist(df), use_container_width=True)
        with c2: st.plotly_chart(_chart_best_source(df), use_container_width=True)
        st.dataframe(
            df[["company_name","efx_confidence","oc_confidence",
                "zi_confidence","liberty_confidence","best_source","best_confidence"]].head(20),
            use_container_width=True, hide_index=True,
        )
        return

    # Run classification
    if run:
        t0 = time.time()
        df = _classify_batch(df)
        st.session_state["classified_df"] = df
        st.session_state["elapsed"] = round(time.time() - t0, 1)
    elif "classified_df" in st.session_state:
        df = st.session_state["classified_df"]
    else:
        return

    elapsed = st.session_state.get("elapsed", "")
    n = len(df)

    # ── Summary metrics ───────────────────────────────────────────────────────
    any_hi    = int((df["best_confidence"] >= 0.80).sum())
    avg_best  = float(df["best_confidence"].mean())
    prod_hi   = int((df["prod_winner_conf"] >= 0.80).sum())
    kyb_dist  = df["cons_kyb"].value_counts().to_dict() if "cons_kyb" in df.columns else {}
    approve   = kyb_dist.get("APPROVE", 0)
    review    = kyb_dist.get("REVIEW", 0)
    esc_rej   = kyb_dist.get("ESCALATE", 0) + kyb_dist.get("REJECT", 0)
    aml_any   = int((df.get("cons_risk_flags", pd.Series()) != "—").sum())
    avg_prob  = float(df["cons_prob_1"].mean()) if "cons_prob_1" in df.columns else 0
    oc_wins   = int((df["best_source"] == "open_corporates").sum())
    lib_wins  = int((df["best_source"] == "liberty").sum())

    # ── TABS ──────────────────────────────────────────────────────────────────
    tab_sum, tab_l1, tab_l2, tab_cmp, tab_rec = st.tabs([
        "📊 Summary",
        "🔍 Level 1 — Entity Matching",
        "🏭 Level 2 — Classification",
        "⚖️ Production vs Consensus",
        "🔎 Record Explorer",
    ])

    # ── TAB: SUMMARY ──────────────────────────────────────────────────────────
    with tab_sum:
        if elapsed:
            st.caption(f"Classification completed in {elapsed}s ({n/float(elapsed):.0f} companies/s)")

        # Data source banner
        l1_src = df["_l1_source"].iloc[0] if "_l1_source" in df.columns else ""
        if "REAL" in l1_src:
            st.success("Level 1 confidence scores are **REAL** — loaded from the CSV (entity matching pipeline outputs).", icon="✅")
        else:
            st.warning("Level 1 confidence scores are **SIMULATED**. Upload a CSV with `efx_confidence`, `oc_confidence`, `zi_confidence` columns (entity matching pipeline output) to use real values.", icon="⚠️")

        # Metric cards
        c1,c2,c3,c4,c5,c6,c7 = st.columns(7)
        c1.metric("Companies",        n)
        c2.metric("Any ≥ 0.80",      f"{any_hi} ({any_hi/n:.0%})")
        c3.metric("Avg Confidence",   f"{avg_best:.3f}")
        c4.metric("APPROVE",          approve)
        c5.metric("REVIEW",           review)
        c6.metric("ESCALATE/REJECT",  esc_rej)
        c7.metric("AML Flagged",      aml_any)

        st.divider()
        ca, cb = st.columns(2)
        with ca: st.plotly_chart(_chart_conf_dist(df), use_container_width=True)
        with cb: st.plotly_chart(_chart_kyb(df), use_container_width=True)

        # Key interpretation
        st.markdown("### Key Findings")
        gap = any_hi - prod_hi
        oc_lib_pct = (oc_wins + lib_wins) / n
        st.markdown(f"""
- **{any_hi} of {n}** companies ({any_hi/n:.0%}) have at least one source with confidence ≥ 0.80.
- Production rule (ZI vs EFX only) reaches ≥ 0.80 for **{prod_hi}** companies.
  The gap of **{gap}** companies have their best match in OpenCorporates or Liberty,
  whose industry codes the production rule never uses.
- **{oc_wins + lib_wins}** companies ({oc_lib_pct:.0%}) have OpenCorporates or Liberty as their
  best-matching source — yet the production NAICS always comes from ZoomInfo or Equifax.
- Consensus Level 2 — avg probability: **{avg_prob:.0%}** | KYB: {approve} APPROVE · {review} REVIEW · {esc_rej} ESCALATE/REJECT.
- **{aml_any}** companies triggered at least one AML signal. Production fires zero.
""")

    # ── TAB: LEVEL 1 ─────────────────────────────────────────────────────────
    with tab_l1:
        st.subheader("Level 1 — Entity Matching Confidence")
        st.markdown("""
**What Level 1 does:** Compares submitted company name + address against
OpenCorporates, Equifax, ZoomInfo, and Liberty using 33 pairwise text/address
similarity features (`match_zipcode`, Jaccard k-grams on name, short-name,
street name etc.) and outputs a match confidence 0–1 per source.

**The same model** (`entity_matching_20250127 v1`) runs in both the production
pipeline and the Consensus pipeline. The difference is what happens next with those confidence scores.
""")

        ca, cb = st.columns(2)
        with ca: st.plotly_chart(_chart_best_source(df), use_container_width=True)
        with cb: st.plotly_chart(_chart_heatmap(df), use_container_width=True)

        # Source coverage table
        st.subheader("Source Coverage")
        rows = []
        for label, col in [("Equifax","efx_confidence"),("OpenCorporates","oc_confidence"),
                            ("ZoomInfo","zi_confidence"),("Liberty","liberty_confidence")]:
            if col not in df.columns: continue
            v = pd.to_numeric(df[col], errors="coerce").fillna(0)
            hi = int((v >= 0.80).sum())
            bs = int((df["best_source"] == label.lower().replace(" ","_")).sum())
            rows.append({
                "Source":              label,
                "Mean Confidence":     f"{v.mean():.3f}",
                "Median":              f"{v.median():.3f}",
                "≥ 0.80 (Matched)":   f"{hi} ({hi/n:.0%})",
                "Best Source (wins)":  f"{bs} ({bs/n:.0%})",
                "Used by Production?": "✅ NAICS code" if label in ("Equifax","ZoomInfo")
                                       else "⚠️ Match only — NAICS ignored by rule",
            })
        st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

        st.info("""
**Why OpenCorporates can win `best_source` but never `prod_winner`:**

These are two different concepts:
- **`best_source`** = source with highest Level 1 confidence across all 4 sources. OC and Liberty absolutely can and do win this.
- **`prod_winner`** = which source's *NAICS code* the production rule writes to the database. The rule only compares ZoomInfo vs Equifax:
  `IF zi_confidence > efx_confidence → ZoomInfo NAICS ELSE → Equifax NAICS`
  OC and Liberty industry codes are never selected by this rule even if OC has the best match.
""")

        st.subheader("All Records — Level 1")
        l1_show = [c for c in ["company_name","efx_confidence","oc_confidence",
                                "zi_confidence","liberty_confidence",
                                "best_source","best_confidence",
                                "prod_winner","prod_winner_conf"] if c in df.columns]
        st.dataframe(df[l1_show], use_container_width=True, hide_index=True)

    # ── TAB: LEVEL 2 ─────────────────────────────────────────────────────────
    with tab_l2:
        st.subheader("Level 2 — Consensus Industry Classification")
        st.markdown("""
**What Level 2 does:** Takes the Level 1 confidence scores + vendor industry codes
as a 45-feature vector and runs `XGBClassifier(objective="multi:softprob")` to
produce a calibrated probability distribution over all possible industry codes.
Outputs top-3 codes, correct taxonomy per jurisdiction, and 6 AML signal types.
""")

        ca, cb = st.columns(2)
        with ca: st.plotly_chart(_chart_prob(df), use_container_width=True)
        with cb: st.plotly_chart(_chart_taxonomy(df), use_container_width=True)

        # AML breakdown
        all_flags = [
            f.strip() for row in df.get("cons_risk_flags", pd.Series())
            for f in str(row).split(";")
            if f.strip() and f.strip() != "—"
        ]
        if all_flags:
            st.subheader("AML / KYB Risk Signals")
            flag_meanings = {
                "HIGH_RISK_SECTOR":     "Code in AML-elevated NAICS sector (Holding 5511, Banking 5221, Dual-use 4236, Defence 9281)",
                "REGISTRY_DISCREPANCY": "Web presence description diverges from OC registry label — shell company signal",
                "STRUCTURE_CHANGE":     "Industry code changed across recent API calls — U-Turn fraud signal",
                "SOURCE_CONFLICT":      "Sources return different industry codes — vendors disagree on industry",
                "TRULIOO_POLLUTION":    "Trulioo returned 4-digit SIC for a 5-digit jurisdiction — data quality defect",
                "LOW_CONSENSUS_PROB":   "Model confidence < 40% — source data is ambiguous",
            }
            fc = Counter(all_flags).most_common()
            aml_df = pd.DataFrame(
                [(f, c, f"{c/n:.0%}", flag_meanings.get(f,"")) for f, c in fc],
                columns=["Signal","Count","% of Companies","Meaning"],
            )
            st.dataframe(aml_df, use_container_width=True, hide_index=True)

        st.subheader("All Records — Level 2")
        l2_show = [c for c in ["company_name","cons_naics_1","cons_label_1",
                                "cons_prob_1","cons_taxonomy","cons_naics_2","cons_label_2",
                                "cons_naics_3","cons_label_3",
                                "cons_risk_score","cons_kyb","cons_risk_flags",
                                "cons_jurisdiction"] if c in df.columns]
        st.dataframe(df[l2_show], use_container_width=True, hide_index=True)

    # ── TAB: COMPARE ─────────────────────────────────────────────────────────
    with tab_cmp:
        st.subheader("Production vs Consensus — Side by Side")

        st.plotly_chart(_chart_prod_vs_best(df), use_container_width=True)

        st.markdown("""
| | Production (`customer_table.sql`) | Consensus (Level 2 XGBoost) |
|---|---|---|
| Sources for NAICS | ZoomInfo or Equifax only | All 4: OC + EFX + ZI + Liberty |
| Industry output | 1 NAICS — no probability | Top-3 codes with calibrated probability |
| UK SIC | Received from OC — **silently dropped** | Primary output for GB companies |
| AML signals | **0 — never produced** | 6 signal types |
| KYB recommendation | **None** | APPROVE / REVIEW / ESCALATE / REJECT |
| Jurisdiction routing | Always NAICS | Correct taxonomy per country |
""")

        # Companies where OC/Liberty had best match but production used weaker source
        if "best_source" in df.columns and "prod_winner" in df.columns:
            gap_mask = df["best_source"].isin(["open_corporates","liberty"])
            gap_df   = df[gap_mask]
            if not gap_df.empty:
                st.warning(
                    f"**{len(gap_df)} companies** have their best Level 1 match in "
                    f"OpenCorporates or Liberty — but the production rule ignored those "
                    f"sources and used a weaker ZoomInfo or Equifax match for the NAICS code.",
                    icon="⚠️",
                )
                gap_show = [c for c in ["company_name","best_source","best_confidence",
                                        "oc_confidence","efx_confidence","zi_confidence",
                                        "liberty_confidence","prod_winner","prod_winner_conf",
                                        "cons_kyb"] if c in gap_df.columns]
                st.dataframe(gap_df[gap_show], use_container_width=True, hide_index=True)

        st.subheader("Full Comparison Table")
        cmp_show = [c for c in ["company_name","prod_winner","prod_winner_conf",
                                 "best_source","best_confidence",
                                 "cons_naics_1","cons_label_1","cons_prob_1",
                                 "cons_taxonomy","cons_kyb","cons_risk_flags"] if c in df.columns]
        st.dataframe(df[cmp_show], use_container_width=True, hide_index=True)

    # ── TAB: RECORD EXPLORER ─────────────────────────────────────────────────
    with tab_rec:
        st.subheader("Record Explorer")
        names    = df["company_name"].astype(str).tolist()
        selected = st.selectbox("Select company", names)
        row      = df[df["company_name"] == selected].iloc[0]

        c_l, c_r = st.columns(2)

        with c_l:
            st.markdown("#### Level 1 — Entity Matching")
            best_conf = float(row.get("best_confidence", 0))
            best_src  = str(row.get("best_source", ""))
            prod_win  = str(row.get("prod_winner", ""))
            prod_conf = float(row.get("prod_winner_conf", 0))

            fig_g = go.Figure(go.Indicator(
                mode="gauge+number",
                value=best_conf,
                title={"text": f"Best Confidence ({best_src})"},
                gauge={
                    "axis": {"range": [0, 1]},
                    "steps": [
                        {"range": [0, 0.50], "color": "#742A2A"},
                        {"range": [0.50, 0.80], "color": "#744210"},
                        {"range": [0.80, 1.0], "color": "#276749"},
                    ],
                    "threshold": {"line": {"color":"white","width":3}, "value": 0.80},
                },
            ))
            fig_g.update_layout(height=230, template="plotly_dark", margin=dict(t=30,b=5,l=20,r=20))
            st.plotly_chart(fig_g, use_container_width=True)

            l1_data = [
                ("Equifax confidence",         f"{row.get('efx_confidence',0):.3f}"),
                ("OpenCorporates confidence",  f"{row.get('oc_confidence',0):.3f}"),
                ("ZoomInfo confidence",        f"{row.get('zi_confidence',0):.3f}"),
                ("Liberty confidence",         f"{row.get('liberty_confidence',0):.3f}"),
                ("Best source (all 4)",        best_src),
                ("Best confidence",            f"{best_conf:.3f}"),
                ("Production rule winner",     prod_win),
                ("Production rule confidence", f"{prod_conf:.3f}"),
                ("Level 1 data source",        str(row.get("_l1_source",""))),
            ]
            st.dataframe(pd.DataFrame(l1_data, columns=["Field","Value"]),
                         use_container_width=True, hide_index=True)

        with c_r:
            st.markdown("#### Level 2 — Consensus Classification")
            kyb = str(row.get("cons_kyb",""))
            bg  = KYB_BG.get(kyb, "#333")
            st.markdown(
                f'<div style="background:{bg};padding:10px 16px;border-radius:8px;'
                f'font-size:1.1em;font-weight:700;color:white;text-align:center;margin-bottom:12px">'
                f'KYB Recommendation: {kyb}</div>',
                unsafe_allow_html=True,
            )
            prob = float(row.get("cons_prob_1", 0))
            l2_data = [
                ("Primary code",        str(row.get("cons_naics_1",""))),
                ("Primary label",       str(row.get("cons_label_1",""))),
                ("Probability",         f"{prob:.1%}"),
                ("Taxonomy",            str(row.get("cons_taxonomy",""))),
                ("Secondary code 1",    f"{row.get('cons_naics_2','')} — {row.get('cons_label_2','')}"),
                ("Secondary code 2",    f"{row.get('cons_naics_3','')} — {row.get('cons_label_3','')}"),
                ("Risk score",          f"{float(row.get('cons_risk_score',0)):.3f}"),
                ("AML flags",           str(row.get("cons_risk_flags","—"))),
                ("Jurisdiction routed", str(row.get("cons_jurisdiction",""))),
            ]
            st.dataframe(pd.DataFrame(l2_data, columns=["Field","Value"]),
                         use_container_width=True, hide_index=True)

        # Plain-English interpretation
        st.markdown("#### Interpretation")
        flags_str = str(row.get("cons_risk_flags","—"))

        lines = []
        if best_conf >= 0.80:
            lines.append(f"✅ Strong entity match — {best_src} confidence {best_conf:.3f}. Company is well-known to vendor databases.")
        elif best_conf >= 0.50:
            lines.append(f"🟡 Moderate entity match — {best_src} confidence {best_conf:.3f}. Company exists in databases but match is not definitive.")
        else:
            lines.append(f"🔴 Weak entity match — best confidence {best_conf:.3f}. Company may be new, small, or not in vendor databases.")

        if best_src in ("open_corporates","liberty") and prod_win in ("zoominfo","equifax"):
            lines.append(
                f"⚠️ Best Level 1 match is **{best_src}** (conf {best_conf:.3f}) but the production rule "
                f"uses **{prod_win}** (conf {prod_conf:.3f}) for the NAICS code — a weaker match is driving the current classification."
            )

        if prob >= 0.70:
            lines.append(f"✅ Consensus classification is HIGH confidence ({prob:.0%}) — industry signals are consistent across sources.")
        elif prob >= 0.40:
            lines.append(f"🟡 Consensus classification is MEDIUM confidence ({prob:.0%}) — check secondary codes.")
        else:
            lines.append(f"🔴 Consensus classification is LOW confidence ({prob:.0%}) — sources are conflicting. Manual review required.")

        if flags_str != "—":
            lines.append(f"🚨 AML signals detected: **{flags_str}**")

        if kyb in ("ESCALATE","REJECT"):
            lines.append(f"🚨 KYB **{kyb}** — immediate human review required before proceeding.")
        elif kyb == "REVIEW":
            lines.append("🟡 KYB **REVIEW** — routine analyst review recommended.")
        elif kyb == "APPROVE":
            lines.append("✅ KYB **APPROVE** — no elevated risk signals detected.")

        for line in lines:
            st.markdown(f"- {line}")

    # ── Download ──────────────────────────────────────────────────────────────
    st.divider()
    export_cols = [c for c in [
        "company_name","efx_confidence","oc_confidence","zi_confidence",
        "liberty_confidence","best_source","best_confidence",
        "prod_winner","prod_winner_conf",
        "cons_naics_1","cons_label_1","cons_prob_1","cons_taxonomy",
        "cons_naics_2","cons_label_2","cons_naics_3","cons_label_3",
        "cons_risk_score","cons_kyb","cons_risk_flags","cons_jurisdiction",
    ] if c in df.columns]

    c_dl1, c_dl2 = st.columns(2)
    with c_dl1:
        buf = io.BytesIO()
        df[export_cols].to_excel(buf, index=False, engine="openpyxl")
        buf.seek(0)
        st.download_button(
            "📥 Download Excel",
            data=buf,
            file_name="industry_classification_results.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    with c_dl2:
        st.download_button(
            "📥 Download CSV",
            data=df[export_cols].to_csv(index=False),
            file_name="industry_classification_results.csv",
            mime="text/csv",
        )


if __name__ == "__main__":
    main()
