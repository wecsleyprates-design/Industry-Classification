"""How It Works — Full workflow documentation page.

Explains the complete data pipeline:
  1. Worth AI platform: vendors, API, facts storage
  2. Weekly cache refresh: API → SQLite
  3. App analysis: SQLite cache → Redshift lookup enrichment
  4. Platform ID arbitration: confidence scoring, ghost assigner bug

Includes an interactive flow diagram showing the full workflow.
"""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import streamlit as st
import plotly.graph_objects as go
from db.cache_manager import cache_exists, get_cache_meta

st.set_page_config(page_title="How It Works", page_icon="📐", layout="wide")
st.markdown("""<style>
[data-testid="stAppViewContainer"]{background:#0f172a;}
[data-testid="stSidebar"]{background:#1e293b;}
h1,h2,h3,h4{color:#f1f5f9;} .stMarkdown p{color:#cbd5e1;}
</style>""", unsafe_allow_html=True)

st.markdown("# 📐 How It Works — Full Data Pipeline")
st.markdown(
    "This page explains how data flows from vendor integrations through Worth AI's "
    "platform to this dashboard — and why the data you see matches the Admin Portal."
)
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — INTERACTIVE WORKFLOW DIAGRAM
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 🔀 Full Data Workflow")

# ── Clean top-down flowchart using Plotly shapes + annotations ──────────────
# Layout: 5 columns × 5 rows, each node = (col, row, label, color, sublabel)
# Rows go top=1 (vendors) to bottom=5 (app)

W, H = 1200, 700   # canvas size
COL = [0.10, 0.28, 0.46, 0.64, 0.82, 0.95]  # x positions (0-1)
ROW = [0.08, 0.25, 0.45, 0.65, 0.85]          # y positions (0-1, top→bottom)

# node: (x_frac, y_frac, label, bg_color, text_color, sublabel)
nodes = {
    # Row 0 — Vendors (left column, spread vertically)
    "p24":  (COL[0], 0.12, "ZoomInfo (P24)",         "#1e3a5f", "#60a5fa", "Firmographics · conf ~0.8–1.0"),
    "p22":  (COL[0], 0.30, "SERP Scrape (P22)",       "#1a3320", "#4ade80", "Web scraping · conf ~0.3"),
    "p17":  (COL[0], 0.48, "Equifax (P17)",            "#1a3320", "#4ade80", "Bureau data · conf ~0.8"),
    "p16":  (COL[0], 0.63, "Middesk (P16)",            "#3b2a00", "#fbbf24", "SOS registry"),
    "p23":  (COL[0], 0.75, "OpenCorporates (P23)",     "#1a3320", "#4ade80", "Business registry"),
    "p31":  (COL[0], 0.87, "AI Enrichment (P31)",      "#2d1500", "#fb923c", "GPT-4o-mini · conf 0.15"),
    "p0":   (COL[1], 0.50, "⚠️  Applicant Entry (P0)", "#3b0000", "#ef4444", "Onboarding form · conf 1.0 ← BUG"),

    # Row 1 — Arbitration
    "arb":  (COL[2], 0.50, "Fact Arbitration Engine",  "#2d1f5f", "#a78bfa",
             "factWithHighestConfidence\npicks winner, stores alternatives[]"),

    # Row 2 — Storage (split)
    "rds":  (COL[3], 0.30, "PostgreSQL RDS",           "#0d2035", "#38bdf8",
             "rds_warehouse_public.facts\none row per (business_id × fact_name)"),
    "lkp":  (COL[3], 0.72, "Redshift Lookup Tables",   "#1e293b", "#94a3b8",
             "core_naics_code · core_mcc_code\nrel_naics_mcc · billing_prices"),

    # Row 3 — Exit paths
    "api":  (COL[4], 0.18, "Worth AI API",             "#0d2035", "#38bdf8",
             "/facts/business/{id}/all\nAdmin Portal uses this endpoint"),
    "rsfed":(COL[4], 0.45, "Redshift Federated View",  "#1e1035", "#818cf8",
             "Same PostgreSQL data\nMay lag a few minutes"),
    "cache":(COL[4], 0.72, "facts_cache.sqlite",       "#0d2818", "#22c55e",
             "Built by weekly refresh\n~300 MB · ~8 snapshots"),

    # Row 4 — App
    "app":  (COL[5], 0.50, "App Dashboard",            "#1e293b", "#f1f5f9",
             "All 9 analysis pages\nget_data() → cache → Redshift"),
}

# edges: (from_key, to_key, label, color)
edges = [
    ("p24",  "arb",   "NAICS + conf",     "#22c55e"),
    ("p22",  "arb",   "NAICS + conf",     "#84cc16"),
    ("p17",  "arb",   "NAICS + conf",     "#16a34a"),
    ("p16",  "arb",   "SOS data",         "#f59e0b"),
    ("p23",  "arb",   "codes",            "#15803d"),
    ("p31",  "arb",   "fallback NAICS",   "#f97316"),
    ("p0",   "arb",   "conf=1.0 ← BUG",  "#ef4444"),
    ("arb",  "rds",   "winner + alts[]",  "#a78bfa"),
    ("rds",  "api",   "live read",        "#38bdf8"),
    ("rds",  "rsfed", "federated view",   "#818cf8"),
    ("lkp",  "cache", "labels + pairs",   "#64748b"),
    ("api",  "cache", "weekly refresh",   "#22c55e"),
    ("rsfed","cache", "biz IDs",          "#818cf8"),
    ("cache","app",   "primary source",   "#22c55e"),
    ("rsfed","app",   "fallback",         "#6366f1"),
    ("lkp",  "app",   "enrichment",       "#64748b"),
]

fig = go.Figure()

def _px(frac, total): return frac * total

# Draw edges first (behind nodes)
for src_k, dst_k, lbl, col in edges:
    sx = _px(nodes[src_k][0], W) + 90
    sy = H - _px(nodes[src_k][1], H)
    dx = _px(nodes[dst_k][0], W) - 10
    dy = H - _px(nodes[dst_k][1], H)
    # Bezier control points
    cx1, cy1 = sx + (dx-sx)*0.4, sy
    cx2, cy2 = dx - (dx-sx)*0.4, dy
    fig.add_shape(type="path",
        path=f"M {sx},{sy} C {cx1},{cy1} {cx2},{cy2} {dx},{dy}",
        line=dict(color=col, width=2),
        opacity=0.6,
    )
    # Edge label at midpoint
    mx = (sx + dx) / 2
    my = (sy + dy) / 2
    fig.add_annotation(x=mx, y=my, text=lbl,
        showarrow=False,
        font=dict(size=8, color=col),
        bgcolor="rgba(15,23,42,0.7)",
        bordercolor=col, borderwidth=1,
        borderpad=2,
    )

# Draw nodes
BOX_W, BOX_H = 140, 52
for key, (xf, yf, label, bg, fg, sub) in nodes.items():
    cx = _px(xf, W)
    cy = H - _px(yf, H)
    # Box
    fig.add_shape(type="rect",
        x0=cx-BOX_W/2, y0=cy-BOX_H/2, x1=cx+BOX_W/2, y1=cy+BOX_H/2,
        fillcolor=bg, line=dict(color=fg, width=2),
        layer="above",
    )
    # Label
    fig.add_annotation(x=cx, y=cy+10, text=f"<b>{label}</b>",
        showarrow=False, font=dict(size=10, color=fg),
        xanchor="center", yanchor="middle",
    )
    # Sub-label
    if sub:
        fig.add_annotation(x=cx, y=cy-14, text=sub,
            showarrow=False, font=dict(size=7.5, color="#94a3b8"),
            xanchor="center", yanchor="middle",
        )

fig.update_layout(
    height=H,
    width=W,
    margin=dict(l=10, r=10, t=10, b=10),
    paper_bgcolor="#0f172a",
    plot_bgcolor="#0f172a",
    xaxis=dict(visible=False, range=[0, W]),
    yaxis=dict(visible=False, range=[0, H]),
    showlegend=False,
)
st.plotly_chart(fig, use_container_width=True)

st.caption(
    "Read left → right. 🔴 Red = Ghost Assigner (P0) — hardcoded confidence 1.0 beats all vendors. "
    "🟢 Green path = weekly refresh: Admin Portal API → SQLite cache → app (current data). "
    "🟣 Purple path = Redshift fallback (when no cache, may lag)."
)
st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — STEP-BY-STEP EXPLANATION
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 📋 Step-by-Step: How Data Gets Into the Dashboard")

steps = [
    ("1️⃣", "Vendor Integrations Run", "#3b82f6",
     "When a business is onboarded, Worth AI's **integration-service** calls multiple external vendors "
     "in parallel: ZoomInfo, Equifax, SERP Scrape, Middesk, OpenCorporates, and others. "
     "Each vendor returns facts about the business — including NAICS industry codes — along with a "
     "confidence score indicating how certain they are. The AI enrichment (GPT-4o-mini) also runs as "
     "a fallback if vendors don't return a NAICS code."),

    ("2️⃣", "Fact Arbitration: factWithHighestConfidence", "#8b5cf6",
     "For each fact type (naics_code, mcc_code, etc.), the Fact Engine applies the "
     "**factWithHighestConfidence** rule: whichever source has the highest confidence score wins. "
     "The winner's value is stored as the main fact. All other sources are stored in **alternatives[]**. "
     "\n\n⚠️ **The Bug:** The applicant's own form submission (`businessDetails`, P0) has confidence "
     "hardcoded to 1.0 — the maximum. This means it always beats ZoomInfo (~0.8) and SERP (~0.3) "
     "in the score comparison, even when the business left the industry field blank. "
     "Fix: lower P0's confidence from 1.0 to 0.1 in `sources.ts:148`."),

    ("3️⃣", "Facts Stored in PostgreSQL RDS", "#22c55e",
     "The winning fact + all alternatives are stored as a single JSON blob in "
     "**`rds_warehouse_public.facts`** (PostgreSQL RDS). One row per `(business_id, fact_name)`. "
     "The JSON contains: `value`, `source.platformId`, `source.confidence`, `source.updatedAt`, "
     "`ruleApplied`, `isNormalized`, and the full `alternatives[]` array. "
     "\n\nThis is the **single source of truth**. Both Redshift and the API read from this same table."),

    ("4️⃣", "Redshift Federated View", "#6366f1",
     "**`rds_warehouse_public.facts`** in Amazon Redshift is a **federated external table** — "
     "it is not a copy. Every query goes directly to the PostgreSQL RDS. "
     "\n\nThe catch: `facts.received_at` is the row creation date (never updates). "
     "The real freshness timestamp is **`source.updatedAt`** inside the JSON blob. "
     "Redshift also has VARCHAR(65535) limits — large facts like `sos_filings[]` can fail without "
     "the `LENGTH(f.value) < 60000` guard. Federated queries can also be slow for large join patterns."),

    ("5️⃣", "Worth AI API — /facts/business/{id}/all", "#0ea5e9",
     "The Admin Portal calls `GET /integration/api/v1/facts/business/{businessId}/all` — "
     "this endpoint reads the **same PostgreSQL RDS** and returns a rich response for every fact: "
     "`value`, `source`, `schema`, `dependencies`, `description`, `ruleApplied`, `isNormalized`, "
     "`override`, plus flat `source.confidence`, `source.platformId`, `source.name` fields, "
     "and the full `alternatives[]`. "
     "\n\nNote: The API has a 2-minute server-side Redis cache. So even live API calls may return "
     "data up to 2 minutes old."),

    ("6️⃣", "Weekly Cache Refresh — facts_cache.sqlite", "#22c55e",
     "The refresh script (`scripts/refresh_facts_cache.py`) runs once a week and:\n\n"
     "1. Authenticates as admin (`POST /auth/api/v1/admin/sign-in`)\n"
     "2. Gets all business IDs from Redshift (`rel_business_customer_monitoring`)\n"
     "3. Fetches `/facts/business/{id}/all` for every business **in parallel** (20 concurrent calls)\n"
     "4. Enriches each fact: looks up NAICS/MCC descriptions from `core_naics_code`/`core_mcc_code`, "
     "checks canonical pair status from `rel_naics_mcc`, computes misidentification signals (S1–S7), "
     "detects changes vs previous snapshot\n"
     "5. Writes everything to `facts_cache.sqlite` — a local SQLite file (~300MB)\n\n"
     "The cache preserves **8 weekly snapshots** for historical comparison. "
     "Once the cache is built, **no further API calls are needed** until the next weekly refresh."),

    ("7️⃣", "Dashboard Reads from Cache → Redshift Fallback", "#f1f5f9",
     "Every analysis page in the app uses `get_data(query_name, **filters)` from `db/data.py`. "
     "This function automatically:\n\n"
     "- **If `facts_cache.sqlite` exists:** reads from SQLite — data matches Admin Portal exactly\n"
     "- **If no cache:** falls back to Redshift — may show older data\n\n"
     "Redshift is still used for lookup tables (`core_naics_code`, `core_mcc_code`, `rel_naics_mcc`) "
     "and customer name mapping (`billing_prices`). These rarely change and don't need weekly refresh."),
]

for icon, title, color, body in steps:
    st.markdown(
        f"<div style='background:#1e293b;border-left:4px solid {color};"
        f"border-radius:8px;padding:16px 18px;margin:10px 0'>"
        f"<div style='color:{color};font-weight:700;font-size:1.05rem;margin-bottom:8px'>"
        f"{icon} {title}</div>"
        f"<div style='color:#cbd5e1;font-size:.9rem;line-height:1.6'>"
        f"{body.replace(chr(10), '<br>')}</div>"
        f"</div>",
        unsafe_allow_html=True
    )

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — JOIN/MERGE LOGIC
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 🔗 How Cache and Redshift Are Joined")

st.markdown("""
The weekly refresh script does a **three-way join in Python memory**:

```
API response (per business)
        ↓ NAICS value extracted
JOIN  core_naics_code ON code = naics_value     → adds naics_label (description)
JOIN  core_mcc_code   ON code = mcc_value       → adds mcc_label (description)
JOIN  rel_naics_mcc   ON (naics_code, mcc_code) → sets is_canonical_pair flag
LEFT JOIN billing_prices ON customer_id         → adds client_name (e.g. "Wholesale")
```

**Why in Python memory and not in Redshift SQL?**

The API returns facts as nested JSON with `alternatives[]` arrays that can't be efficiently 
queried in SQL. Python parses the full JSON, extracts every alternative, computes signals (S1-S7), 
detects changes vs previous snapshot, and then writes normalized rows to SQLite — one row per 
`(business_id × fact_name × snapshot_date)` in the `facts` table, and one row per alternative 
in the `alternatives` table.

**The Redshift lookup data** (`core_naics_code`, `core_mcc_code`, `rel_naics_mcc`) is fetched 
once at the start of the refresh and held in Python dicts for O(1) lookups during batch processing:

```python
naics_lookup   = {code: label ...}   # {811114: "Specialized Automotive Repair"}
mcc_lookup     = {code: label ...}   # {7538: "Automotive Service Shops"}
canonical_pairs = {(naics, mcc) ...}  # set of known-valid combinations
```

This means each business's enrichment is ~microseconds (dict lookup) rather than another 
Redshift query.
""")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — CURRENT CACHE STATUS
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 🗄️ Current Cache Status")

if cache_exists():
    meta = get_cache_meta()
    snap  = meta.get("snapshot_date","")
    n_biz = meta.get("total_businesses", 0)
    n_fct = meta.get("total_facts", 0)
    n_alt = meta.get("total_alternatives", 0)
    dur   = meta.get("refresh_duration_sec", 0)
    dfrom = meta.get("date_from_filter","")
    dto   = meta.get("date_to_filter","")
    cli   = meta.get("client_filter","all")

    st.markdown(
        f"<div style='background:#0d2818;border:1px solid #22c55e;"
        f"border-radius:8px;padding:16px 18px'>"
        f"<div style='color:#22c55e;font-weight:700;font-size:1rem;margin-bottom:10px'>"
        f"✅ Cache is active — data matches Admin Portal</div>"
        f"<table style='color:#6ee7b7;font-size:.88rem;width:100%'>"
        f"<tr><td><b>Snapshot date</b></td><td>{snap}</td>"
        f"    <td><b>Duration</b></td><td>{dur:.0f}s ({dur/60:.1f} min)</td></tr>"
        f"<tr><td><b>Businesses</b></td><td>{n_biz:,}</td>"
        f"    <td><b>Fact rows</b></td><td>{n_fct:,}</td></tr>"
        f"<tr><td><b>Alternative rows</b></td><td>{n_alt:,}</td>"
        f"    <td><b>Date range</b></td><td>{dfrom} → {dto}</td></tr>"
        f"<tr><td><b>Client filter</b></td><td>{cli}</td><td></td><td></td></tr>"
        f"</table></div>",
        unsafe_allow_html=True
    )
else:
    st.markdown(
        "<div style='background:#1c1207;border:1px solid #f59e0b;"
        "border-radius:8px;padding:16px 18px'>"
        "<div style='color:#f59e0b;font-weight:700;margin-bottom:8px'>"
        "⚠️ No cache found — app is reading from Redshift (may be behind Admin Portal)</div>"
        "<div style='color:#fcd34d;font-size:.88rem'>"
        "To build the cache, run from the naics_mcc_explorer/ folder:<br><br>"
        "<code style='background:#0f172a;padding:4px 8px;border-radius:4px'>"
        "python3 scripts/refresh_facts_cache.py</code><br><br>"
        "This takes ~8-10 minutes for all clients and only needs to run once a week."
        "</div></div>",
        unsafe_allow_html=True
    )

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — PLATFORM ID REFERENCE
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 🏷️ Platform ID Reference")

st.markdown("""
Every fact in the facts table records **which data source won** via `source.platformId`. 
Source: `integration-service/src/constants/integrations.constant.ts`
""")

platform_data = [
    ("-1", "Calculated / Dependent",    "⚫ Computed",   "Derived from other facts. Never from a vendor. Examples: `mcc_code`, `mcc_description`, `naics_description`, `industry`. No confidence, no ruleApplied."),
    ("0",  "Applicant Entry",           "🔴 Bug source", "Self-reported onboarding form. Confidence hardcoded to 1.0 — beats all vendors. Root cause of the ghost assigner problem. Fix: lower to 0.1 in `sources.ts:148`."),
    ("16", "Middesk",                   "🟡 Vendor",     "US Secretary of State live registry lookup. Weight=2.0. SOS verification."),
    ("17", "Equifax",                   "🟢 Vendor",     "Credit bureau + firmographic data. Weight=0.7. NAICS from `primnaicscode`."),
    ("22", "SERP Scrape",               "🟣 Vendor",     "Google Search scraping. Weight=0.3. NAICS from website content."),
    ("23", "OpenCorporates",            "🔵 Vendor",     "Global business registry. NAICS from `firmographic.industry_code_uids` (us_naics prefix)."),
    ("24", "ZoomInfo",                  "🔵 Vendor",     "Primary firmographics source. Weight=0.8. NAICS from `firmographic.zi_c_naics6`. Best NAICS source."),
    ("31", "AI NAICS Enrichment (GPT)", "🟠 AI",         "GPT-4o-mini classifier. Weight=0.1. Confidence=0.15. Last resort — assigns 561499 when no evidence. Source: `aiNaicsEnrichment.ts:63`."),
    ("36", "AI Website Enrichment",     "🟠 AI",         "AI analysis of business website content. Weight=0.1."),
    ("38", "Trulioo",                   "🟢 Vendor",     "KYB/PSC compliance screening. NAICS from industry classification response."),
]

import pandas as pd
pf = pd.DataFrame(platform_data, columns=["Platform ID","Platform Name","Type","Description"])
st.dataframe(pf, use_container_width=True, hide_index=True)

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — KEY FILES
# ═══════════════════════════════════════════════════════════════════════════════
st.markdown("## 📁 Key Files")

st.markdown("""
| File | Purpose |
|---|---|
| `scripts/refresh_facts_cache.py` | Weekly refresh — fetches Admin Portal API for all businesses, writes to SQLite |
| `db/cache_manager.py` | SQLite schema (facts, alternatives, businesses, cache_meta tables), connection utilities |
| `db/sqlite_queries.py` | All query functions for app pages when cache is active |
| `db/data.py` | Universal router — `get_data()` picks SQLite or Redshift automatically |
| `db/queries.py` | Redshift query functions (fallback path) |
| `utils/worth_api.py` | Worth AI API client (auth, token refresh, /facts endpoint) |
| `utils/filters.py` | Sidebar filters — uses cache for customer names when available |
| `facts_cache.sqlite` | Generated by refresh script (~300MB, gitignored) |
| `CACHE_SYSTEM.md` | Full technical documentation of the cache system |

**Key codebase files (integration-service):**

| File | What it defines |
|---|---|
| `src/constants/integrations.constant.ts` | Full INTEGRATION_ID enum (all platform IDs) |
| `lib/facts/sources.ts:148` | `businessDetails.confidence = 1` — the ghost assigner bug |
| `lib/facts/rules.ts:36` | `factWithHighestConfidence` arbitration rule |
| `lib/facts/businessDetails/index.ts:278` | `naics_code` source priority order |
| `lib/aiEnrichment/aiNaicsEnrichment.ts:63` | `NAICS_OF_LAST_RESORT = "561499"` |
| `src/helpers/api.ts:1012` | `/facts/business/{id}/all` endpoint path |
""")
