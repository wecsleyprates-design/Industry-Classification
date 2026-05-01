"""Classification Decision Intelligence — full audit of the naics/mcc classification pipeline.

Covers:
  0. How the classification system works (rich workflow docs)
  1. Decision flow with live counts at every branch
  2. Confidence score distributions by source
  3. Alternative coverage — are correct answers being suppressed?
  4. Decision correctness — canonical pair rates by source
  5. MCC path audit — why AI wins MCC so often
  6. Source frequency over time
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd

from utils.filters import render_sidebar, kpi, section_header, no_data
from utils.platform_map import platform_label, platform_color
from utils.sql_runner import analyst_note, sql_panel, platform_legend_panel
from db.data import data_source_banner
from db.classification_queries import (
    load_flow_counts, load_confidence_distributions, load_mcc_confidence,
    load_alternative_coverage, load_vendor_agreement_matrix,
    load_suppressed_correct_answer, load_canonical_rate_by_source,
    load_mcc_path_analysis, load_ai_mcc_accuracy,
    load_source_frequency_over_time, load_naics_null_gap_analysis,
)

st.set_page_config(page_title="Classification Intelligence", page_icon="🧬", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3,h4{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

filters = render_sidebar()
f_from   = filters["date_from"]
f_to     = filters["date_to"]
f_cust   = filters["customer_id"]
f_client = filters.get("client_name")

st.markdown("# 🧬 Classification Decision Intelligence")
data_source_banner()
st.markdown(
    "A full audit of how the system classifies businesses — from raw supplier inputs "
    "through the arbitration engine to the final `naics_code`, `mcc_code_found`, "
    "`mcc_code_from_naics`, and `mcc_code` facts. "
    "Every decision path is quantified, every confidence score is profiled, "
    "and every place where the wrong answer wins is identified."
)

# Client filter (for pages 8/9 style client selector)
from db.data import _using_cache
from db.sqlite_queries import get_client_list
from db.queries import load_paying_clients

if _using_cache():
    clients_df = get_client_list()
else:
    clients_df = load_paying_clients(f_from, f_to) or pd.DataFrame()

if not clients_df.empty:
    if "client" not in clients_df.columns and "client_name" in clients_df.columns:
        clients_df = clients_df.rename(columns={"client_name":"client"})
    # Filter out bare UUIDs (36-char hex strings)
    clients_df = clients_df[
        clients_df["client"].notna() &
        (clients_df["client"].str.len() != 36)
    ]
    client_opts = ["All Paying Clients"] + clients_df["client"].tolist()
    sel_client = st.selectbox("**Filter by Client**", client_opts, key="ci_client")
    client_filter = None if sel_client == "All Paying Clients" else sel_client
else:
    client_filter = None

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 0 — HOW THE CLASSIFICATION SYSTEM WORKS
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 📖 Section 0 — How the Classification System Works")
st.markdown("*Read this first. Everything else in this page builds on this foundation.*")

with st.expander("### The Full Classification Workflow — Rich Documentation", expanded=True):

    st.markdown("""
## The Four Classification Facts

Every business in Worth AI gets four classification facts computed in a specific order.
Understanding this order is essential to understanding every quality problem we observe.

| Fact | Type | Source | Description |
|---|---|---|---|
| `naics_code` | **Supplier-sourced** | ZoomInfo, Equifax, SERP, AI, or applicant | 6-digit US industry code. The root fact. Everything else derives from this. |
| `mcc_code_found` | **Computed (AI direct)** | AI NAICS Enrichment (P31) | 4-digit payment category code assigned by GPT-4o-mini from business context. |
| `mcc_code_from_naics` | **Computed (lookup)** | Fact Engine (P-1) | 4-digit payment code derived by looking up `naics_code` in `rel_naics_mcc` table. |
| `mcc_code` | **Computed (final)** | Fact Engine (P-1) | Final winner: `mcc_code_found ?? mcc_code_from_naics`. AI wins if it returned anything. |

---

## Step 1: Assigning naics_code

Multiple data sources compete to provide the NAICS code for each business.
The Fact Engine applies the **`factWithHighestConfidence`** rule — the source with the
highest confidence score wins and becomes the `naics_code` winner.
All other sources are stored in `alternatives[]`.

**Sources for `naics_code` — defined in `businessDetails/index.ts:278`:**

| Source | Platform ID | Source weight | Fact-level weight | Runtime confidence | Notes |
|---|---|---|---|---|---|
| Equifax | P17 | 0.7 | (default 1) | set at runtime | First in array |
| ZoomInfo | P24 | 0.8 | (default 1) | set at runtime | Primary firmographics |
| OpenCorporates | P23 | 0.9 | (default 1) | set at runtime | Business registry |
| SERP Scrape | P22 | (default) | **0.3** | heuristic | Variable quality |
| Trulioo (business) | P38 | 0.8 | **0.7** | set at runtime | PSC classification |
| **Applicant Entry** | **P0** | **10** | **0.2** | **1.0 (hardcoded)** | **⚠️ source confidence=1 hardcoded in sources.ts:148** |
| AI NAICS Enrichment | P31 | (default) | **0.1** | 0.1–0.2 (mapped from HIGH/MED/LOW) | Last resort |

**The arbitration rule (`factWithHighestConfidence`, rules.ts:36-75):**

```typescript
// 1. Compare confidence scores
if (|confidenceA - confidenceB| > WEIGHT_THRESHOLD) {
    // Strict confidence ordering — higher wins, no weight applied
} else {
    // Within 0.05: use weightedFactSelector — higher WEIGHT wins
}
// WEIGHT_THRESHOLD = 0.05 (rules.ts:9)
```

**Does P0 always win? No — it depends on the confidence gap:**

The key insight from reading the actual code:
- P0 source has `confidence: 1.0` (hardcoded, `sources.ts:148`) AND source `weight: 10`
- For `naics_code` specifically, the fact-level entry sets `weight: 0.2` (`businessDetails/index.ts:313`)
- ZoomInfo has source weight `0.8` and no fact-level weight override

**Case 1: ZoomInfo confidence < 0.95**
Gap = 1.0 - 0.95+ = >0.05 → pure confidence comparison → **P0 wins** (even with null value)

**Case 2: ZoomInfo confidence ≥ 0.95 (within 0.05 of P0)**
Gap ≤ 0.05 → `weightedFactSelector` uses weights:
- P0 fact-level weight = **0.2** (defined in businessDetails/index.ts:313)
- ZoomInfo effective weight = **0.8** (source weight, no fact override)
- **ZoomInfo wins the tie-break** (0.8 > 0.2)

**Case 3: businessDetails value is null and schema validation**
The `naics_code` entry for businessDetails has `schema: z.string().regex(/^\\d{6}$/)`.
When P0 submits null or a non-6-digit value, `coerceValueToSchema` is called with
`returnOnFailure: "value"` — meaning schema coercion failure returns the original (bad) value.
The null or invalid value still enters arbitration. However, in the `factWithHighestConfidence`
rule, this line filters out undefined and empty arrays but NOT null:
```typescript
if (fact.value === undefined || (Array.isArray(fact.value) && fact.value.length === 0)) {
    return acc;  // skip this fact
}
```
**null is NOT filtered** — so P0 with null value enters arbitration and wins on confidence.

**When does the API enrichment refresh fix this?**
When `GET /facts/business/{id}/details` is called (or the integration service re-runs),
all sources are re-fetched in a new engine run. If ZoomInfo returns with confidence ≥ 0.95,
ZoomInfo wins via weight (0.8 > 0.2). This explains why calling the API at scale "fixed" the
Redshift data — it triggered re-arbitration where ZoomInfo won on the weight tiebreaker.

---

## Step 2: Computing mcc_code_from_naics

Once `naics_code` is settled, the Fact Engine looks it up in `rel_naics_mcc`:

```
SELECT mcc_code FROM rel_naics_mcc r
JOIN core_naics_code nc ON nc.id = r.naics_id
WHERE nc.code = naics_code.value
```

- If a mapping exists → `mcc_code_from_naics` = the mapped MCC
- If no mapping exists → `mcc_code_from_naics` = null
- Source is always `platformId: -1, name: "dependent"` (computed fact, no supplier)
- Confidence is always **null** — deterministic lookup has no confidence score

**Critical implication:** If `naics_code` is wrong (null, 561499, or wrong code),
`mcc_code_from_naics` will be wrong or null too. The cascade has already started.

---

## Step 3: Computing mcc_code_found (AI direct)

The AI NAICS Enrichment module (GPT-4o-mini) runs independently. It reads the business
name, description, and address — then produces both a NAICS code and an MCC code directly.

The MCC it produces is stored as `mcc_code_found`. This path runs **regardless of whether
a good NAICS code already exists** — it's an independent classification.

```typescript
// aiNaicsEnrichment.ts
// AI prompt returns both naics_code and mcc_code in one call.
// mcc_code is stored as mcc_code_found.
// Confidence is always 0.15 — self-reported by the AI.
```

**Key characteristics of mcc_code_found:**
- Confidence = **always 0.15** (hardcoded, not actually measured)
- Source = P31 (AI NAICS Enrichment)
- Runs for businesses where vendors failed OR as a parallel path
- Quality varies — can produce valid codes, catch-alls (7399), or the invalid bug code (5614)

---

## Step 4: Computing mcc_code (the final winner)

The Fact Engine computes the final `mcc_code` using null-coalescing:

```typescript
// businessDetails/index.ts:376-387
mcc_code: mcc_code_found.value ?? mcc_code_from_naics.value
```

This means: **use AI-assigned MCC if it exists, otherwise use the NAICS-derived MCC**.

**Why AI almost always wins MCC:**

```
mcc_code_found.confidence  = 0.15  (AI ran and returned something)
mcc_code_from_naics.confidence = null  (deterministic lookup, no confidence)
```

The `??` operator checks for null, not confidence. If `mcc_code_found` has any non-null
value — even an incorrect one — it wins over `mcc_code_from_naics`.

**The result:** AI at confidence 0.15 systematically beats the canonical lookup table,
regardless of whether the AI's answer is more or less accurate.

---

## The Full Cascade: How One Bad NAICS Decision Breaks Six Facts

```
naics_code wrong (P0 null wins when supplier confidence < 0.95,
                  OR supplier returns wrong code and wins)
    ↓
mcc_code_from_naics wrong or null
    (rel_naics_mcc lookup of the wrong NAICS → wrong or missing MCC)
    ↓
mcc_code wrong
    (foundMcc?.value ?? inferredMcc?.value — AI at 0.1–0.2 wins over null lookup)
    ↓
mcc_description wrong   (core_mcc_code lookup of wrong mcc_code)
    ↓
naics_description wrong (core_naics_code lookup of wrong naics_code)
    ↓
industry wrong          (naics_code.substring(0,2) → wrong sector)
```

**Six facts broken by one bad NAICS arbitration decision.**

**Important: the cascade was partially correct in the data we observed.**
When the API was called at scale on May 1, ZoomInfo's returned confidence for many
businesses was ≥ 0.95, putting it within the 0.05 WEIGHT_THRESHOLD of P0's 1.0.
ZoomInfo's fact-level weight (0.8) beat P0's fact-level weight (0.2) → ZoomInfo won →
naics_code was updated → all 6 downstream facts were recomputed correctly.
The Redshift counts changing was a consequence of this re-arbitration, not a bug.

---

## The Canonical Pair Check

`rds_cases_public.rel_naics_mcc` contains Worth AI's official mapping of which NAICS codes
correspond to which MCC codes. When a business has a NAICS+MCC combination that exists
in this table, we call it a **canonical pair** — the system worked correctly.

When the pair is NOT in this table, one of:
1. The NAICS code is wrong (wrong supplier won, or P0 suppressed real data)
2. The AI direct MCC (`mcc_code_found`) overrode the canonical lookup result
3. The NAICS code is valid but not in our mapping table (gap in rel_naics_mcc)

The canonical pair rate is our best proxy for classification accuracy.
    """)

st.markdown("---")

# ── Section 0b: Decision Tree Visualization ───────────────────────────────────
st.markdown("### 🌳 Classification Decision Tree")
st.markdown("Visual representation of the 4-step classification workflow and every decision point.")

# Build a top-down Plotly decision tree using shapes + annotations
# Layout: 5 levels top→bottom, each node at fixed (x, y)
_W, _H = 1200, 700

# nodes: key → (x, y, label_lines, bg, border, shape)
_nodes = {
    # Level 0 — Business submits form
    "form":  (600, 40,  ["Business submits", "onboarding form"], "#1e293b","#94a3b8","rect"),

    # Level 1 — All sources run in parallel
    "p0":    (150, 155, ["Applicant Entry (P0)", "conf=1.0 · weight=0.2"], "#3b0000","#ef4444","rect"),
    "zi":    (350, 155, ["ZoomInfo (P24)", "weight=0.8"], "#0d2035","#3b82f6","rect"),
    "eq":    (550, 155, ["Equifax (P17)", "weight=0.7"], "#0d2035","#22c55e","rect"),
    "serp":  (750, 155, ["SERP Scrape (P22)", "weight=0.3"], "#1a3320","#84cc16","rect"),
    "ai":    (950, 155, ["AI Enrichment (P31)", "conf=0.1–0.2"], "#2d1500","#f97316","rect"),

    # Level 2 — Arbitration
    "arb":   (600, 290, ["factWithHighestConfidence", "winner = highest conf · weight tiebreak at ±0.05"], "#1e0d4a","#a78bfa","rect"),

    # Level 3 — naics_code result (two outcomes)
    "naics_good":  (350, 420, ["naics_code = valid", "6-digit specific code"], "#0d2818","#22c55e","rect"),
    "naics_bad":   (850, 420, ["naics_code = null/wrong", "P0 won or no supplier coverage"], "#3b0000","#ef4444","rect"),

    # Level 4a — from valid naics_code
    "lookup":  (250, 555, ["mcc_code_from_naics", "rel_naics_mcc lookup → MCC"], "#0d2035","#38bdf8","rect"),
    "ai_mcc":  (450, 555, ["mcc_code_found (AI)", "GPT picks MCC directly"], "#2d1500","#f97316","rect"),

    # Level 4b — from bad naics_code
    "lookup_bad": (750, 555, ["mcc_code_from_naics = null/7399", "lookup of wrong code fails"], "#3b0000","#ef4444","rect"),
    "ai_mcc2":    (950, 555, ["mcc_code_found (AI)", "only path left"], "#2d1500","#f97316","rect"),

    # Level 5 — final mcc_code
    "mcc_good":  (350, 665, ["mcc_code = foundMcc ?? inferredMcc", "✅ likely correct"], "#0d2818","#22c55e","rect"),
    "mcc_bad":   (850, 665, ["mcc_code = AI result or null", "⚠️ unreliable"], "#3b0000","#ef4444","rect"),
}

_edges = [
    # form → all sources
    ("form","p0","submits","#ef4444"), ("form","zi","","#3b82f6"),
    ("form","eq","","#22c55e"),        ("form","serp","","#84cc16"),
    ("form","ai","","#f97316"),
    # all sources → arbitration
    ("p0","arb","conf=1.0 wins if gap>0.05","#ef4444"),
    ("zi","arb","conf~0.8-1.0","#3b82f6"),
    ("eq","arb","conf~0.7-1.0","#22c55e"),
    ("serp","arb","conf heuristic","#84cc16"),
    ("ai","arb","conf 0.1-0.2","#f97316"),
    # arbitration → two outcomes
    ("arb","naics_good","supplier wins (weight 0.8>0.2)","#22c55e"),
    ("arb","naics_bad","P0 wins when conf gap >0.05","#ef4444"),
    # valid naics → MCC paths
    ("naics_good","lookup","lookup rel_naics_mcc","#38bdf8"),
    ("naics_good","ai_mcc","AI also runs","#f97316"),
    # bad naics → MCC paths
    ("naics_bad","lookup_bad","lookup fails/7399","#ef4444"),
    ("naics_bad","ai_mcc2","AI fallback","#f97316"),
    # final mcc_code
    ("lookup","mcc_good","foundMcc??inferredMcc","#22c55e"),
    ("ai_mcc","mcc_good","AI wins if non-null","#f97316"),
    ("lookup_bad","mcc_bad","","#ef4444"),
    ("ai_mcc2","mcc_bad","AI at 0.1-0.2","#f97316"),
]

_fig = go.Figure()
_BW, _BH = 185, 52

def _cx(key): return _nodes[key][0]
def _cy(key): return _nodes[key][1]

# Draw edges
for src_k, dst_k, lbl, col in _edges:
    sx = _cx(src_k)
    sy = _cy(src_k) + _BH//2
    dx = _cx(dst_k)
    dy = _cy(dst_k) - _BH//2
    span_y = dy - sy
    cx1, cy1 = sx, sy + span_y*0.35
    cx2, cy2 = dx, dy - span_y*0.35
    _fig.add_shape(type="path",
        path=f"M {sx},{sy} C {cx1},{cy1} {cx2},{cy2} {dx},{dy}",
        line=dict(color=col, width=1.8), opacity=0.6, layer="below")
    if lbl:
        _fig.add_annotation(x=(sx+dx)/2, y=(sy+dy)/2, text=lbl,
            showarrow=False, font=dict(size=8, color=col),
            bgcolor="rgba(15,23,42,0.85)", borderpad=2)

# Draw nodes
for key, (x, y, lines, bg, border, shape) in _nodes.items():
    _fig.add_shape(type="rect",
        x0=x-_BW//2, y0=y-_BH//2, x1=x+_BW//2, y1=y+_BH//2,
        fillcolor=bg, line=dict(color=border, width=2), layer="above")
    for i, ln in enumerate(lines):
        offset = 10 if len(lines)==2 else 0
        _fig.add_annotation(
            x=x, y=y + (8 if i==0 else -10),
            text=f"<b>{ln}</b>" if i==0 else ln,
            showarrow=False, xanchor="center", yanchor="middle",
            font=dict(size=9 if i==0 else 8, color=border))

_fig.update_layout(
    height=_H, margin=dict(l=5,r=5,t=10,b=10),
    paper_bgcolor="#0f172a", plot_bgcolor="#0f172a",
    xaxis=dict(visible=False, range=[0, _W]),
    yaxis=dict(visible=False, range=[0, _H], autorange="reversed"),
    showlegend=False,
)
st.plotly_chart(_fig, use_container_width=True, key="decision_tree")
st.caption(
    "🔴 Red = risk path (P0 wins or wrong NAICS)  "
    "🟢 Green = healthy path (supplier wins, canonical result)  "
    "🟣 Purple = arbitration engine  "
    "🟠 Orange = AI enrichment  "
    "🔵 Blue = data sources / lookup tables"
)

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — LIVE DECISION FLOW COUNTS
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🔢 Section 1 — Live Decision Flow: Where Every Business Goes",
               "Real counts at every branch of the classification pipeline for the current data.")

with st.spinner("Loading flow counts…"):
    flow = load_flow_counts(client_filter)

if flow:
    total   = int(flow.get("total_businesses", 0))
    has_n   = int(flow.get("has_naics", 0))
    no_n    = int(flow.get("no_naics", 0))
    catchall= int(flow.get("naics_catchall", 0))
    ai_fired= int(flow.get("ai_mcc_fired", 0))
    lkp_frd = int(flow.get("lookup_mcc_fired", 0))
    ai_won  = int(flow.get("ai_won_mcc", 0))
    no_mcc  = int(flow.get("final_mcc_missing", 0))
    canon   = int(flow.get("canonical_pairs", 0))
    bad5614 = int(flow.get("has_5614", 0))
    c7399   = int(flow.get("mcc_catchall", 0))

    def _pct(n, d): return f"{100*n/d:.1f}%" if d else "—"

    # Flow diagram as KPI cards
    st.markdown("#### naics_code assignment")
    c1,c2,c3,c4 = st.columns(4)
    with c1: kpi("Total Businesses",    f"{total:,}",       "", "#3b82f6")
    with c2: kpi("✅ Has NAICS value",  f"{has_n:,}",       _pct(has_n,total), "#22c55e")
    with c3: kpi("⬜ No NAICS (null)",  f"{no_n:,}",        _pct(no_n,total), "#ef4444")
    with c4: kpi("⚠️ Catch-all 561499", f"{catchall:,}",   _pct(catchall,total), "#f59e0b")

    st.markdown("")
    st.markdown("#### mcc derivation paths")
    c5,c6,c7,c8 = st.columns(4)
    with c5: kpi("AI MCC fired\n(mcc_code_found)",    f"{ai_fired:,}",  _pct(ai_fired,total), "#8b5cf6")
    with c6: kpi("Lookup MCC fired\n(mcc_code_from_naics)", f"{lkp_frd:,}", _pct(lkp_frd,total), "#6366f1")
    with c7: kpi("AI won final MCC",    f"{ai_won:,}",    _pct(ai_won,total), "#f97316")
    with c8: kpi("No MCC at all",       f"{no_mcc:,}",    _pct(no_mcc,total), "#64748b")

    st.markdown("")
    st.markdown("#### classification quality")
    c9,c10,c11 = st.columns(3)
    with c9:  kpi("✅ Canonical Pairs",     f"{canon:,}",   _pct(canon,total), "#22c55e")
    with c10: kpi("❌ Invalid MCC (5614)",  f"{bad5614:,}", _pct(bad5614,total), "#ef4444")
    with c11: kpi("⚠️ Catch-all MCC (7399)",f"{c7399:,}",  _pct(c7399,total), "#f59e0b")

    analyst_note(
        "What these numbers reveal",
        f"Out of <strong>{total:,} businesses</strong>: "
        f"<strong>{no_n:,} ({_pct(no_n,total)})</strong> have no NAICS value at all — "
        f"this is the direct result of P0 (Applicant Entry) winning with null. "
        f"<strong>{ai_won:,} ({_pct(ai_won,total)})</strong> got their final MCC from AI "
        f"at confidence 0.15 — because AI's non-null answer beats the lookup table's null confidence. "
        f"Only <strong>{_pct(canon,total)}</strong> have a canonical NAICS+MCC pair — "
        f"our best proxy for classification accuracy.",
        level="warning" if no_n > total * 0.1 else "info",
    )
else:
    no_data("Flow counts not available. Build the cache or check the filters.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — CONFIDENCE SCORE DISTRIBUTIONS
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📊 Section 2 — Confidence Score Distributions by Source",
               "How confident is each source, really? And does higher confidence correlate with correctness?")

with st.spinner("Loading confidence data…"):
    conf_df = load_confidence_distributions(client_filter)

if conf_df is not None and not conf_df.empty:
    conf_df["color"] = conf_df["platform_id"].apply(platform_color)

    # Average confidence bar chart
    conf_sorted = conf_df.sort_values("avg_confidence", ascending=True)
    fig_conf = go.Figure(go.Bar(
        x=conf_sorted["avg_confidence"].round(3),
        y=conf_sorted["source_name"],
        orientation="h",
        marker_color=conf_sorted["color"].tolist(),
        text=conf_sorted["avg_confidence"].apply(lambda v: f"{v:.3f}"),
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Avg confidence: %{x:.3f}<extra></extra>",
    ))
    fig_conf.update_layout(
        title="Average Confidence Score by Source (naics_code wins)",
        height=max(260, len(conf_sorted)*38+60),
        margin=dict(l=0,r=80,t=40,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b", range=[0,1.05]),
        yaxis=dict(showgrid=False),
    )
    st.plotly_chart(fig_conf, use_container_width=True, key="conf_avg")

    # Confidence tier heatmap
    if "tier_0_0_1" in conf_df.columns:
        tier_cols = ["tier_0_0_1","tier_0_1_0_3","tier_0_3_0_5","tier_0_5_0_8","tier_0_8_1_0","tier_exactly_1"]
        tier_labels = ["0–0.1","0.1–0.3","0.3–0.5","0.5–0.8","0.8–<1.0","Exactly 1.0"]
        present = [c for c in tier_cols if c in conf_df.columns]
        if present:
            heat_z = conf_df[present].values
            fig_heat = go.Figure(go.Heatmap(
                z=heat_z,
                x=[tier_labels[tier_cols.index(c)] for c in present],
                y=conf_df["source_name"].tolist(),
                colorscale=[[0,"#0f172a"],[0.1,"#1e3a5f"],[1,"#3b82f6"]],
                text=heat_z,
                texttemplate="%{text}",
                hovertemplate="<b>%{y}</b><br>Confidence %{x}: %{z:,} businesses<extra></extra>",
                colorbar=dict(title="Count"),
            ))
            fig_heat.update_layout(
                title="Business count per confidence tier (naics_code wins)",
                height=max(280, len(conf_df)*40+80),
                margin=dict(l=0,r=0,t=40,b=0),
                paper_bgcolor="#0f172a", font_color="#cbd5e1",
            )
            st.plotly_chart(fig_heat, use_container_width=True, key="conf_heat")

    analyst_note(
        "The critical finding: P0 at exactly 1.0",
        "P0 (Applicant Entry) always shows confidence exactly 1.0 — the maximum possible. "
        "This is hardcoded in <code>sources.ts:148</code>, not earned. "
        "The tier heatmap makes this visible: look at the 'Exactly 1.0' column — "
        "P0 will dominate it while ZoomInfo and SERP spread across multiple tiers. "
        "This single hardcoded value is the root cause of the entire arbitration problem.",
        level="danger",
        bullets=[
            "P0 at exactly 1.0 beats ZoomInfo at 0.8–1.0 because the gap exceeds WEIGHT_THRESHOLD (0.05)",
            "AI NAICS Enrichment at exactly 0.15 means the AI is never uncertain — it always fires at the same confidence",
            "SERP Scrape spreading 0.3–1.0 shows genuine confidence calibration",
            "Fix: lower P0 confidence to 0.1 in sources.ts:148",
        ],
    )

    # Full stats table
    display_conf = conf_df[["source_name","platform_id","fact_count","avg_confidence","min_confidence","max_confidence"]].copy()
    display_conf.columns = ["Source","Platform ID","Times Won","Avg Confidence","Min Confidence","Max Confidence"]
    st.dataframe(display_conf, use_container_width=True, hide_index=True,
                 column_config={"Avg Confidence": st.column_config.NumberColumn(format="%.3f"),
                                "Min Confidence": st.column_config.NumberColumn(format="%.3f"),
                                "Max Confidence": st.column_config.NumberColumn(format="%.3f"),
                                "Times Won": st.column_config.NumberColumn(format="%d")})
else:
    no_data()

# mcc_code_found confidence
st.markdown("#### mcc_code_found (AI direct MCC) — Confidence Distribution")
with st.spinner("Loading AI MCC confidence…"):
    mcc_conf_df = load_mcc_confidence(client_filter)

if mcc_conf_df is not None and not mcc_conf_df.empty:
    fig_mcc_conf = go.Figure(go.Bar(
        x=mcc_conf_df["confidence_bucket"].astype(str),
        y=mcc_conf_df["business_count"],
        marker_color="#f97316",
        hovertemplate="Confidence %{x}: %{y:,} businesses<extra></extra>",
    ))
    fig_mcc_conf.update_layout(
        height=260, margin=dict(l=0,r=0,t=10,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis_title="Confidence (rounded to 2dp)", yaxis_title="Businesses",
    )
    st.plotly_chart(fig_mcc_conf, use_container_width=True, key="mcc_conf")

    analyst_note(
        "Why mcc_code_found confidence is always 0.15",
        "The AI NAICS Enrichment module hardcodes confidence=0.15 for ALL its outputs "
        "regardless of how certain it actually is. This means the distribution above will show "
        "nearly all businesses at exactly 0.15. "
        "This is not a measured confidence — it's a declared fallback value. "
        "The AI has no mechanism to say 'I am 80% confident' vs '20% confident'. "
        "It either fires (always at 0.15) or doesn't fire at all.",
        level="info",
    )
else:
    no_data("mcc_code_found confidence data not available.")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ALTERNATIVE COVERAGE
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📦 Section 3 — Alternative Coverage: Are Correct Answers Being Suppressed?",
               "How many other sources submitted values? When multiple vendors agree, do they agree with the winner?")

with st.spinner("Loading alternative coverage…"):
    alt_cov = load_alternative_coverage(client_filter)
    agree_df = load_vendor_agreement_matrix(client_filter)
    suppressed_df = load_suppressed_correct_answer(client_filter)

if alt_cov is not None and not alt_cov.empty:
    st.markdown("**Average number of alternatives per winning source:**")
    alt_cov["color"] = alt_cov["platform_id"].apply(platform_color)
    alt_sorted = alt_cov.sort_values("businesses", ascending=True)
    fig_alts = go.Figure(go.Bar(
        x=alt_sorted["avg_alternatives"].round(2),
        y=alt_sorted["source_name"],
        orientation="h",
        marker_color=alt_sorted["color"].tolist(),
        text=alt_sorted["avg_alternatives"].apply(lambda v: f"{v:.1f} avg alts"),
        textposition="outside",
        hovertemplate="<b>%{y}</b><br>Avg alternatives: %{x:.2f}<extra></extra>",
    ))
    fig_alts.update_layout(
        height=max(240, len(alt_sorted)*38+60),
        margin=dict(l=0,r=120,t=10,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=False),
    )
    st.plotly_chart(fig_alts, use_container_width=True, key="alt_avg")

    display_alt = alt_cov[["source_name","platform_id","businesses","avg_alternatives",
                            "businesses_no_alts","businesses_2plus_alts"]].copy()
    display_alt.columns = ["Source","ID","Times Won","Avg Alternatives",
                            "Won with 0 alternatives","Won with 2+ alternatives"]
    st.dataframe(display_alt, hide_index=True, use_container_width=True,
                 column_config={"Avg Alternatives": st.column_config.NumberColumn(format="%.2f"),
                                "Times Won": st.column_config.NumberColumn(format="%d")})

if agree_df is not None and not agree_df.empty:
    st.markdown("**Supplier agreement matrix — when winner and supplier alternative co-occur, do they agree?**")
    st.caption(
        "Each row = one (winner source, alternative source) pair. "
        "Agreement % = how often they returned the same NAICS code. "
        "High agreement with a low canonical rate = both wrong together. "
        "Low agreement = genuine disagreement about the business's industry."
    )
    agree_display = agree_df[["winner_source","alt_source","co_occurrences",
                               "agreed","disagreed","agreement_pct"]].copy()
    agree_display.columns = ["Winner Source","Alternative Source","Co-occurrences",
                              "Agreed on Same Code","Disagreed","Agreement %"]
    agree_display = agree_display.sort_values("Co-occurrences", ascending=False)
    st.dataframe(agree_display, use_container_width=True, hide_index=True,
                 column_config={
                     "Co-occurrences": st.column_config.NumberColumn(format="%d"),
                     "Agreed on Same Code": st.column_config.NumberColumn(format="%d"),
                     "Disagreed": st.column_config.NumberColumn(format="%d"),
                     "Agreement %": st.column_config.NumberColumn(format="%.1f%%"),
                 })

if suppressed_df is not None and not suppressed_df.empty:
    n_supp = len(suppressed_df)
    st.markdown(f"**⚠️ {n_supp:,} businesses where P0 won with null BUT trusted vendors had specific codes:**")
    analyst_note(
        "The 'suppressed correct answer' — the strongest evidence of the bug",
        f"These <strong>{n_supp:,} businesses</strong> represent the clearest cases of data quality failure: "
        "P0 (the business's own form submission) won with a <strong>null value</strong>, "
        "while ZoomInfo, Equifax, or SERP had a real, specific NAICS code in alternatives[]. "
        "The correct answer existed — it was just overruled by a blank form submission with confidence=1.0.",
        level="danger",
        action="Fix sources.ts:148: lower businessDetails confidence from 1.0 to 0.1. All these businesses will auto-correct on next facts refresh.",
    )
    alt_col = "supplier_alternatives" if "supplier_alternatives" in suppressed_df.columns else "vendor_alternatives"
    cnt_col = "supplier_count" if "supplier_count" in suppressed_df.columns else "vendor_count"
    show_cols = ["business_id","client_name","business_name","p0_value", alt_col, cnt_col]
    show_cols = [c for c in show_cols if c in suppressed_df.columns]
    disp_supp = suppressed_df[show_cols].copy()
    disp_supp.columns = ["Business ID","Client","Legal Name","P0 Value (blank)",
                         "Supplier Alternatives (suppressed)","Supplier Count"][:len(show_cols)]
    st.dataframe(disp_supp, use_container_width=True, hide_index=True)
    st.download_button("⬇️ Download suppressed correct answers",
                       disp_supp.to_csv(index=False).encode(),
                       "suppressed_correct_answers.csv","text/csv", key="dl_supp")
else:
    no_data("Suppressed answer analysis (requires cache with alternatives).")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — DECISION CORRECTNESS: CANONICAL RATES BY SOURCE
# ═══════════════════════════════════════════════════════════════════════════════
section_header("🎯 Section 4 — Decision Correctness: Canonical Pair Rates by Source",
               "When each source wins the NAICS race, what % of results are canonical (correct) NAICS+MCC pairs?")

with st.spinner("Loading canonical rates…"):
    canon_df = load_canonical_rate_by_source(client_filter)

if canon_df is not None and not canon_df.empty:
    canon_df["color"] = canon_df["platform_id"].apply(platform_color)
    canon_sorted = canon_df.sort_values("canonical_pct", ascending=True)

    fig_canon = go.Figure()
    fig_canon.add_trace(go.Bar(
        x=canon_sorted["canonical_pct"],
        y=canon_sorted["source_name"],
        orientation="h",
        name="Canonical %",
        marker_color=canon_sorted["color"].tolist(),
        text=canon_sorted["canonical_pct"].apply(lambda v: f"{v:.1f}%"),
        textposition="outside",
    ))
    fig_canon.update_layout(
        title="Canonical NAICS+MCC pair rate by winning source",
        height=max(260, len(canon_sorted)*38+60),
        margin=dict(l=0,r=80,t=40,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b", range=[0,105],
                   title="% of wins that produce a canonical NAICS+MCC pair"),
        yaxis=dict(showgrid=False),
    )
    st.plotly_chart(fig_canon, use_container_width=True, key="canon_rate")

    display_c = canon_df[["source_name","platform_id","total_wins","canonical_wins",
                           "canonical_pct","catchall_561499","null_naics","catchall_7399","invalid_5614"]].copy()
    display_c.columns = ["Source","ID","Total Wins","Canonical Wins","Canonical %",
                         "561499 count","Null NAICS","7399 MCC","5614 MCC"]
    st.dataframe(display_c, use_container_width=True, hide_index=True,
                 column_config={"Canonical %": st.column_config.NumberColumn(format="%.1f%%"),
                                "Total Wins": st.column_config.NumberColumn(format="%d"),
                                "Canonical Wins": st.column_config.NumberColumn(format="%d")})

    analyst_note(
        "Reading the canonical rate",
        "The canonical rate measures: 'when this source wins, what fraction of results are "
        "valid in Worth AI's own NAICS→MCC mapping table?' "
        "A high canonical rate = the source produces classifications the system recognizes as correct. "
        "A low canonical rate = the source frequently produces code combinations that don't exist "
        "in the official mapping — indicating wrong classification.",
        level="info",
        bullets=[
            "ZoomInfo (P24) should have the highest canonical rate — it's the primary firmographic source",
            "P0 (Applicant Entry) will have a low canonical rate because it often wins with null or whatever the business typed",
            "AI (P31) canonical rate reflects how often GPT's classification aligns with the official mapping",
            "If any source has <50% canonical rate, it's systematically producing wrong classifications",
        ],
    )
else:
    no_data()

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — MCC PATH AUDIT
# ═══════════════════════════════════════════════════════════════════════════════
section_header("💳 Section 5 — MCC Path Audit: Why AI Almost Always Wins",
               "The mcc_code = mcc_code_found ?? mcc_code_from_naics decision: who actually wins and what quality do they produce?")

with st.spinner("Loading MCC path data…"):
    mcc_path_df = load_mcc_path_analysis(client_filter)
    ai_acc_df   = load_ai_mcc_accuracy(client_filter)

if mcc_path_df is not None and not mcc_path_df.empty:
    col_pie, col_tbl = st.columns([2,3])
    with col_pie:
        fig_mcc = go.Figure(go.Pie(
            labels=mcc_path_df["mcc_path"],
            values=mcc_path_df["businesses"],
            hole=0.4,
            textinfo="label+percent",
            hovertemplate="<b>%{label}</b><br>Businesses: %{value:,}<extra></extra>",
        ))
        fig_mcc.update_layout(height=320, margin=dict(l=0,r=0,t=10,b=0),
                               paper_bgcolor="#0f172a", font_color="#cbd5e1",
                               showlegend=False)
        st.plotly_chart(fig_mcc, use_container_width=True, key="mcc_path_pie")

    with col_tbl:
        st.dataframe(mcc_path_df[["mcc_path","businesses","canonical","catchall_7399",
                                    "invalid_5614","canonical_pct"]].rename(columns={
            "mcc_path":"MCC Path","businesses":"Businesses","canonical":"Canonical",
            "catchall_7399":"7399 (catch-all)","invalid_5614":"5614 (invalid)","canonical_pct":"Canonical %"
        }), hide_index=True, use_container_width=True,
        column_config={"Canonical %": st.column_config.NumberColumn(format="%.1f%%"),
                       "Businesses": st.column_config.NumberColumn(format="%d")})

    analyst_note(
        "The mcc_code null-coalescing problem",
        "The final <code>mcc_code</code> is computed as: "
        "<code>mcc_code_found ?? mcc_code_from_naics</code> — meaning AI wins "
        "whenever it returns ANY non-null value. "
        "The problem: <code>mcc_code_from_naics</code> has confidence=null (deterministic lookup), "
        "while <code>mcc_code_found</code> has confidence=0.15. "
        "In the null-coalescing logic, a non-null value at 0.15 always beats null. "
        "This means AI systematically overrides the canonical lookup table — even when the lookup "
        "would have produced a canonical pair and the AI produces a catch-all or invalid code.",
        level="warning",
        bullets=[
            "'AI won over Lookup (both ran)' = the most concerning category — AI overrode a valid lookup result",
            "Compare canonical % for 'AI won' vs 'Lookup won' — lookup should be higher since it uses the official mapping",
            "'No MCC at all' = businesses where both paths failed — these are invisible to payment routing",
        ],
    )

if ai_acc_df is not None and not ai_acc_df.empty:
    st.markdown("**AI MCC output quality — what codes does mcc_code_found actually produce?**")
    ai_acc_df["color"] = ai_acc_df["quality"].map({
        "✅ Specific": "#22c55e",
        "⚠️ Catch-all (7399)": "#f59e0b",
        "❌ Invalid (AI bug)": "#ef4444",
    }).fillna("#64748b")
    top20 = ai_acc_df.head(20).sort_values("businesses", ascending=True)
    fig_ai = go.Figure(go.Bar(
        x=top20["businesses"], y=top20["ai_mcc_value"],
        orientation="h", marker_color=top20["color"].tolist(),
        text=top20["businesses"].apply(lambda v: f"{v:,}"),
        textposition="outside",
        hovertemplate="<b>MCC %{y}</b><br>Businesses: %{x:,}<extra></extra>",
    ))
    fig_ai.update_layout(
        title="Top 20 AI-assigned MCC codes (mcc_code_found)",
        height=500, margin=dict(l=0,r=80,t=40,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=False, type="category"),
    )
    st.plotly_chart(fig_ai, use_container_width=True, key="ai_mcc_top")
    st.caption("🟢 Specific  🟡 Catch-all 7399  🔴 Invalid 5614 (AI bug)")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — SOURCE FREQUENCY OVER TIME
# ═══════════════════════════════════════════════════════════════════════════════
section_header("📅 Section 6 — Source Activity Over Time",
               "When does each source run? Are there patterns — daily batches, weekly gaps, on-demand?")

with st.spinner("Loading source frequency…"):
    time_df = load_source_frequency_over_time(client_filter)
    gap_df  = load_naics_null_gap_analysis(client_filter)

if time_df is not None and not time_df.empty:
    time_df["color"] = time_df["platform_id"].apply(platform_color)
    # Pivot for area chart
    pivot_time = time_df.pivot_table(
        index="update_date", columns="source_name", values="businesses",
        aggfunc="sum", fill_value=0
    ).reset_index()
    pivot_time.columns.name = None
    pivot_time = pivot_time.sort_values("update_date")

    fig_time = go.Figure()
    source_cols = [c for c in pivot_time.columns if c != "update_date"]
    for sc in source_cols:
        pid = time_df[time_df["source_name"]==sc]["platform_id"].iloc[0] if len(time_df[time_df["source_name"]==sc]) else "unknown"
        fig_time.add_trace(go.Scatter(
            x=pivot_time["update_date"],
            y=pivot_time[sc],
            name=sc,
            mode="lines",
            stackgroup="one",
            line=dict(color=platform_color(pid), width=1),
            hovertemplate=f"<b>{sc}</b><br>Date: %{{x}}<br>Businesses: %{{y:,}}<extra></extra>",
        ))
    fig_time.update_layout(
        title="Classification activity by source over time (source.updatedAt)",
        height=400, margin=dict(l=0,r=0,t=40,b=0),
        paper_bgcolor="#0f172a", plot_bgcolor="#0f172a", font_color="#cbd5e1",
        xaxis=dict(showgrid=True, gridcolor="#1e293b"),
        yaxis=dict(showgrid=True, gridcolor="#1e293b", title="Businesses classified"),
        legend=dict(bgcolor="#0f172a", font=dict(color="#94a3b8")),
    )
    st.plotly_chart(fig_time, use_container_width=True, key="time_series")

    analyst_note(
        "What the timeline reveals about the classification pipeline",
        "Each spike in the timeline = a bulk enrichment run by that source. "
        "ZoomInfo runs appear as large one-time batches (when a new client is onboarded). "
        "AI enrichment runs continuously as a fallback. "
        "P0 spikes correspond to business onboarding events. "
        "Gaps = periods where no enrichment ran for that source.",
        level="info",
    )

if gap_df is not None and not gap_df.empty:
    st.markdown("**Coverage gap analysis — businesses with only P0 or AI as their NAICS source:**")
    st.dataframe(gap_df.rename(columns={
        "client_name":"Client","naics_source":"Source",
        "naics_value":"NAICS Value","businesses":"Businesses",
        "canonical":"Canonical","catchall":"Catch-all (561499)"
    }), hide_index=True, use_container_width=True,
    column_config={"Businesses": st.column_config.NumberColumn(format="%d"),
                   "Canonical": st.column_config.NumberColumn(format="%d"),
                   "Catch-all (561499)": st.column_config.NumberColumn(format="%d")})

    analyst_note(
        "Supplier coverage gaps",
        "These businesses have no trusted supplier (ZoomInfo/Equifax/SERP/OpenCorporates) "
        "providing a NAICS code — only the business's own form submission (P0) or AI fallback (P31). "
        "For clients with large gaps, the root cause is usually that the supplier integration "
        "didn't cover those businesses (e.g. ZoomInfo didn't have a match). "
        "AI at 0.15 is the only classification these businesses have.",
        level="warning",
        action="For high-gap clients: request supplier re-enrichment or expand ZoomInfo/Equifax coverage.",
    )

st.markdown("---")
st.markdown(
    "<div style='color:#475569;font-size:.8rem;padding:8px 0'>"
    "Classification Decision Intelligence · Data from local cache (from Admin Portal API) "
    "· Lookup tables from rds_cases_public.rel_naics_mcc, core_naics_code, core_mcc_code</div>",
    unsafe_allow_html=True
)
