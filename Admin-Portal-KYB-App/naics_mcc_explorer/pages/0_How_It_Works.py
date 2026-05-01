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

# ── Clean left-to-right flowchart ───────────────────────────────────────────
# Nodes positioned in pixel coords on a wide canvas.
# Each node is drawn as a filled rect with title + subtitle on separate lines.
# BOX_W × BOX_H are large enough that text never overlaps.

W, H   = 1400, 820   # canvas pixels
BOX_W  = 200          # node box width
BOX_H  = 80           # node box height — tall enough for 3 lines

# node dict: key → (cx, cy, title_line1, title_line2, sub_line1, sub_line2, bg, border)
nodes = {
    # Column 1 — Vendors (x=130)
    "p24": (130,  90, "ZoomInfo", "(P24)", "Firmographics", "conf ~0.8–1.0", "#0d2035","#3b82f6"),
    "p22": (130, 210, "SERP Scrape", "(P22)", "Web scraping", "conf ~0.3",    "#1a3320","#4ade80"),
    "p17": (130, 330, "Equifax", "(P17)", "Bureau data", "conf ~0.8",          "#1a3320","#4ade80"),
    "p16": (130, 450, "Middesk", "(P16)", "SOS registry", "conf ~0.99",        "#3b2a00","#fbbf24"),
    "p23": (130, 570, "OpenCorporates", "(P23)", "Business registry", "",       "#1a3320","#4ade80"),
    "p31": (130, 690, "AI Enrichment", "(P31)", "GPT-4o-mini fallback", "conf 0.15","#2d1500","#fb923c"),

    # Column 2 — Ghost Assigner (x=390)
    "p0":  (390, 390, "⚠️  Applicant Entry", "(P0 — GHOST ASSIGNER)", "Onboarding form submission", "Hardcoded conf = 1.0  ← THE BUG","#3b0000","#ef4444"),

    # Column 3 — Arbitration (x=640)
    "arb": (640, 390, "Fact Arbitration Engine", "factWithHighestConfidence", "Picks winner by highest score", "Stores all others in alternatives[]","#1e0d4a","#a78bfa"),

    # Column 4 — Storage (x=890)
    "rds": (890, 220, "PostgreSQL RDS", "rds_warehouse_public.facts", "One row per (business_id × fact_name)", "JSON: value + source + alternatives[]","#0d2035","#38bdf8"),
    "lkp": (890, 580, "Redshift Lookup Tables", "core_naics_code · core_mcc_code", "rel_naics_mcc · billing_prices", "Used for labels + canonical pairs","#1e293b","#94a3b8"),

    # Column 5 — Exit paths (x=1150)
    "api":   (1150, 130, "Worth AI API", "/facts/business/{id}/all", "Same PostgreSQL source as Redshift", "Used by Admin Portal & refresh script","#0d2035","#38bdf8"),
    "rsfed": (1150, 390, "Redshift Federated View", "rds_warehouse_public.facts", "Same data — live federated query", "May lag a few minutes","#1e1035","#818cf8"),
    "cache": (1150, 620, "facts_cache.sqlite", "Built by weekly refresh script", "~300 MB · stores 8 snapshots", "Admin Portal data — always current","#0d2818","#22c55e"),

    # Column 6 — App (x=1370)
    "app":   (1370, 390, "App Dashboard", "All 9 analysis pages", "get_data() checks cache first", "Falls back to Redshift if no cache","#1e293b","#f1f5f9"),
}

# edges: (from_key, to_key, arrow_label, color)
edges = [
    ("p24", "arb",   "NAICS + confidence",   "#3b82f6"),
    ("p22", "arb",   "NAICS + confidence",   "#4ade80"),
    ("p17", "arb",   "NAICS + confidence",   "#4ade80"),
    ("p16", "arb",   "SOS data",             "#fbbf24"),
    ("p23", "arb",   "business codes",       "#4ade80"),
    ("p31", "arb",   "fallback NAICS",       "#fb923c"),
    ("p0",  "arb",   "conf=1.0  ← THE BUG", "#ef4444"),
    ("arb", "rds",   "winner + alternatives[]", "#a78bfa"),
    ("rds", "api",   "live read (same RDS)", "#38bdf8"),
    ("rds", "rsfed", "federated view",       "#818cf8"),
    ("lkp", "cache", "labels + canonical pairs","#94a3b8"),
    ("api", "cache", "weekly refresh\n(all businesses)", "#22c55e"),
    ("rsfed","cache","business IDs",         "#818cf8"),
    ("cache","app",  "✅ primary source\n(matches Admin Portal)","#22c55e"),
    ("rsfed","app",  "fallback when\nno cache","#6366f1"),
    ("lkp", "app",   "lookup enrichment",    "#64748b"),
]

fig = go.Figure()

# ── Draw edges (bezier curves) ────────────────────────────────────────────────
for src_k, dst_k, lbl, col in edges:
    n_s = nodes[src_k]
    n_d = nodes[dst_k]
    sx = n_s[0] + BOX_W // 2       # right edge of source
    sy = n_s[1]
    dx = n_d[0] - BOX_W // 2 + 5  # left edge of dest
    dy = n_d[1]
    # Horizontal bezier — control points extend 35% of distance
    span = dx - sx
    cx1, cy1 = sx + span * 0.4, sy
    cx2, cy2 = dx - span * 0.4, dy
    fig.add_shape(type="path",
        path=f"M {sx},{sy} C {cx1},{cy1} {cx2},{cy2} {dx},{dy}",
        line=dict(color=col, width=2.5),
        opacity=0.7,
        layer="below",
    )
    # Arrow tip
    fig.add_annotation(
        x=dx, y=dy, ax=dx - 12, ay=dy,
        xref="x", yref="y", axref="x", ayref="y",
        showarrow=True, arrowhead=2, arrowsize=1.2,
        arrowwidth=2, arrowcolor=col,
    )
    # Edge label — midpoint, offset slightly above curve
    mx = (sx + dx) / 2
    my = (sy + dy) / 2 - 10
    fig.add_annotation(
        x=mx, y=my, text=lbl,
        showarrow=False,
        font=dict(size=9, color=col),
        bgcolor="rgba(15,23,42,0.85)",
        bordercolor=col, borderwidth=1, borderpad=3,
        xanchor="center",
    )

# ── Draw nodes ────────────────────────────────────────────────────────────────
for key, (cx, cy, t1, t2, s1, s2, bg, border) in nodes.items():
    x0, x1 = cx - BOX_W//2, cx + BOX_W//2
    y0, y1 = cy - BOX_H//2, cy + BOX_H//2
    # Box fill
    fig.add_shape(type="rect",
        x0=x0, y0=y0, x1=x1, y1=y1,
        fillcolor=bg,
        line=dict(color=border, width=2.5),
        layer="above",
    )
    # Title line 1 — bold, large
    fig.add_annotation(
        x=cx, y=cy + 26, text=f"<b>{t1}</b>",
        showarrow=False, font=dict(size=12, color=border),
        xanchor="center", yanchor="middle",
    )
    # Title line 2
    fig.add_annotation(
        x=cx, y=cy + 10, text=t2,
        showarrow=False, font=dict(size=10, color=border),
        xanchor="center", yanchor="middle",
    )
    # Sub line 1
    if s1:
        fig.add_annotation(
            x=cx, y=cy - 8, text=s1,
            showarrow=False, font=dict(size=9, color="#94a3b8"),
            xanchor="center", yanchor="middle",
        )
    # Sub line 2
    if s2:
        fig.add_annotation(
            x=cx, y=cy - 24, text=s2,
            showarrow=False, font=dict(size=9, color="#64748b"),
            xanchor="center", yanchor="middle",
        )

fig.update_layout(
    height=H,
    margin=dict(l=5, r=5, t=10, b=10),
    paper_bgcolor="#0f172a",
    plot_bgcolor="#0f172a",
    xaxis=dict(visible=False, range=[-10, W + 10]),
    yaxis=dict(visible=False, range=[-10, H + 10]),
    showlegend=False,
)
st.plotly_chart(fig, use_container_width=True)

st.markdown(
    "<div style='font-size:.85rem;color:#94a3b8;padding:6px 0'>"
    "🔵 Blue = data storage/API  &nbsp;|&nbsp;  "
    "🟢 Green = vendor data providers  &nbsp;|&nbsp;  "
    "🟠 Orange = AI fallback  &nbsp;|&nbsp;  "
    "🔴 Red = Applicant Entry (the scoring bug — confidence 1.0 beats all vendors)  &nbsp;|&nbsp;  "
    "🟣 Purple = Arbitration engine  &nbsp;|&nbsp;  "
    "🟩 Green border = SQLite cache (Admin Portal data, built weekly)  &nbsp;|&nbsp;  "
    "⚪ White = Dashboard</div>",
    unsafe_allow_html=True,
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
