"""
Worth AI — Field Lineage Explorer
Streamlit application for exploring API field lineage, data sources, storage,
rules, and blank/null scenarios for every UCM Q/A API field.
"""
import streamlit as st
from lineage_data import (
    FIELD_LINEAGE,
    SOURCES,
    RULES,
    ALL_SECTIONS,
    ALL_DATA_TYPES,
    ALL_FIELD_KEYS,
    PIPELINE_OVERVIEW,
)

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Worth AI — Field Lineage Explorer",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── CSS ────────────────────────────────────────────────────────────────────────
# All cards use DARK backgrounds so text is always visible in Streamlit dark mode.
st.markdown("""
<style>
/* Global font */
html, body, [class*="css"] { font-family: 'Inter', 'Segoe UI', sans-serif; }

/* Sidebar */
section[data-testid="stSidebar"] { background: #0B1120 !important; }
section[data-testid="stSidebar"] * { color: #E2E8F0 !important; }

/* ── Cards (dark backgrounds — readable in both light and dark Streamlit theme) ── */
.field-card {
    background: #1A2744;
    border: 1px solid #2D4070;
    border-left: 5px solid #3B82F6;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 10px;
    color: #CBD5E1 !important;
    line-height: 1.65;
}
.field-card * { color: #CBD5E1 !important; }
.field-card b, .field-card strong { color: #E2E8F0 !important; }

.field-card-red {
    background: #2A1010;
    border-left: 5px solid #EF4444;
    color: #FCA5A5 !important;
}
.field-card-red * { color: #FCA5A5 !important; }
.field-card-red b, .field-card-red strong { color: #FEE2E2 !important; }

.field-card-green {
    background: #0C2218;
    border-left: 5px solid #10B981;
    color: #6EE7B7 !important;
}
.field-card-green * { color: #6EE7B7 !important; }
.field-card-green b, .field-card-green strong { color: #A7F3D0 !important; }

.field-card-amber {
    background: #221A06;
    border-left: 5px solid #F59E0B;
    color: #FCD34D !important;
}
.field-card-amber * { color: #FCD34D !important; }
.field-card-amber b, .field-card-amber strong { color: #FDE68A !important; }

.field-card-purple {
    background: #180D30;
    border-left: 5px solid #8B5CF6;
    color: #C4B5FD !important;
}
.field-card-purple * { color: #C4B5FD !important; }
.field-card-purple b, .field-card-purple strong { color: #DDD6FE !important; }

/* ── Source badges ── */
.badge {
    display: inline-block;
    padding: 3px 11px;
    border-radius: 12px;
    font-size: 0.73rem;
    font-weight: 700;
    margin: 2px;
    letter-spacing: 0.01em;
}
.badge-blue   { background: #1E3A6E; color: #93C5FD; border: 1px solid #2563EB; }
.badge-green  { background: #064E3B; color: #6EE7B7; border: 1px solid #059669; }
.badge-amber  { background: #451A03; color: #FCD34D; border: 1px solid #D97706; }
.badge-red    { background: #450A0A; color: #FCA5A5; border: 1px solid #DC2626; }
.badge-purple { background: #2E1065; color: #C4B5FD; border: 1px solid #7C3AED; }
.badge-grey   { background: #1E293B; color: #94A3B8; border: 1px solid #475569; }

/* ── Metric blocks ── */
.metric-block {
    background: #1A2744;
    border: 1px solid #2D4070;
    border-radius: 10px;
    padding: 16px 18px;
    text-align: center;
}
.metric-num   { font-size: 2rem; font-weight: 700; color: #60A5FA; }
.metric-label { font-size: 0.78rem; color: #94A3B8; margin-top: 4px; }

/* ── Data table ── */
.lineage-table { width: 100%; border-collapse: collapse; font-size: 0.87rem; }
.lineage-table th {
    background: #0F2040;
    color: #93C5FD;
    font-weight: 700;
    padding: 9px 13px;
    text-align: left;
    border-bottom: 2px solid #2563EB;
}
.lineage-table td {
    padding: 8px 13px;
    border-bottom: 1px solid #1E293B;
    vertical-align: top;
    color: #CBD5E1;
    background: #0F172A;
}
.lineage-table tr:nth-child(even) td { background: #141F35; }
.lineage-table tr:hover td { background: #1A2A45; }
.lineage-table code {
    background: #1E3A5F;
    color: #93C5FD;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.82em;
}

/* ── Section header ── */
.section-header {
    background: linear-gradient(135deg, #0F2040 0%, #1D4ED8 100%);
    color: #E2E8F0;
    padding: 11px 20px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 1.08rem;
    margin-bottom: 12px;
    border: 1px solid #2563EB;
    letter-spacing: 0.01em;
}

/* ── Code / flow box ── */
.code-box {
    background: #0A1628;
    color: #93C5FD;
    border: 1px solid #1E3A5F;
    border-radius: 6px;
    padding: 12px 16px;
    font-family: 'Courier New', monospace;
    font-size: 0.82rem;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.55;
}
</style>
""", unsafe_allow_html=True)

# ── Source colour map ──────────────────────────────────────────────────────────
SOURCE_BADGE = {
    "middesk":       ("badge-blue",   "Middesk (SoS)"),
    "opencorporates":("badge-green",  "OpenCorporates"),
    "zoominfo":      ("badge-purple", "ZoomInfo"),
    "equifax":       ("badge-amber",  "Equifax"),
    "trulioo":       ("badge-red",    "Trulioo KYB"),
    "ai_naics":      ("badge-grey",   "AI Enrichment"),
    "plaid":         ("badge-blue",   "Plaid IDV"),
    "serp":          ("badge-grey",   "SERP / Web"),
    "manual":        ("badge-amber",  "Manual Override"),
    "businessDetails":("badge-green", "Applicant Submission"),
    "google":        ("badge-red",    "Google Places"),
    "verdata":       ("badge-grey",   "Verdata"),
}

def source_badge(source_key: str) -> str:
    cls, label = SOURCE_BADGE.get(source_key, ("badge-grey", source_key))
    return f'<span class="badge {cls}">{label}</span>'

def null_badge(is_error: bool) -> str:
    if is_error:
        return '<span class="badge badge-red">⚠️ Potential Error</span>'
    return '<span class="badge badge-green">✅ Expected Behaviour</span>'


# ══════════════════════════════════════════════════════════════════════════════
# SIDEBAR
# ══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("""
    <div style="
        background: linear-gradient(135deg, #0B0F2A 0%, #1a1150 100%);
        border-radius: 10px;
        padding: 14px 18px;
        margin-bottom: 4px;
        border: 1px solid #2D2080;
        text-align: center;
    ">
        <div style="font-size:1.5rem; font-weight:900; letter-spacing:0.06em; color:#E2E8F0;">
            <span style="color:#B57BFF;">W</span>ORTH
        </div>
        <div style="font-size:0.65rem; color:#8B8FBF; letter-spacing:0.18em; margin-top:2px;">
            FIELD LINEAGE EXPLORER
        </div>
    </div>
    """, unsafe_allow_html=True)
    st.markdown("")
    st.markdown("---")

    page = st.radio(
        "Navigation",
        ["🏠 Overview", "🔎 Field Explorer", "📡 Source Reference", "📋 Pipeline Diagram", "❓ UCM Q&A Tracker"],
        label_visibility="collapsed",
    )
    st.markdown("---")

    if page == "🔎 Field Explorer":
        st.markdown("**Filters**")
        filter_section = st.multiselect(
            "Section", ALL_SECTIONS, default=ALL_SECTIONS, key="section_filter"
        )
        filter_type = st.multiselect(
            "Data Type", ALL_DATA_TYPES, default=ALL_DATA_TYPES, key="type_filter"
        )
        filter_null_error = st.selectbox(
            "Null/Blank is…",
            ["All", "Expected Behaviour", "Potential Error"],
            key="null_filter",
        )

    st.markdown("---")
    st.caption("Source: [WS] UCM Q/A · SIC-UK-Codes repo · April 2026")


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: OVERVIEW
# ══════════════════════════════════════════════════════════════════════════════
if page == "🏠 Overview":
    st.markdown('<div class="section-header">📊 Worth AI — Field Lineage Explorer</div>', unsafe_allow_html=True)

    st.markdown("""
    This application provides a **comprehensive lineage map** of every API field from the
    *[GPN version] Worth Field Outputs Working Session* (`[WS] UCM Q/A` tab).

    For each field you can see:
    - **Where the value comes from** (which vendor API, which endpoint)
    - **How it flows** through the pipeline (vendor → Fact Engine → facts table → API → admin UI)
    - **Which rule selects the winner** when multiple vendors return a value
    - **Why it can be blank or NULL** — and whether that is an error or expected behaviour
    - **The GPN questions and confirmed answers** from the working session
    """)

    # Metrics row
    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        st.markdown(f'<div class="metric-block"><div class="metric-num">{len(FIELD_LINEAGE)}</div><div class="metric-label">Fields Mapped</div></div>', unsafe_allow_html=True)
    with c2:
        st.markdown(f'<div class="metric-block"><div class="metric-num">{len(SOURCES)}</div><div class="metric-label">Vendor Sources</div></div>', unsafe_allow_html=True)
    with c3:
        st.markdown(f'<div class="metric-block"><div class="metric-num">{len(RULES)}</div><div class="metric-label">Fact Engine Rules</div></div>', unsafe_allow_html=True)
    with c4:
        n_expected = sum(1 for v in FIELD_LINEAGE.values() if not v["null_is_error"])
        st.markdown(f'<div class="metric-block"><div class="metric-num">{n_expected}</div><div class="metric-label">Fields where NULL = Expected</div></div>', unsafe_allow_html=True)
    with c5:
        n_error = sum(1 for v in FIELD_LINEAGE.values() if v["null_is_error"])
        st.markdown(f'<div class="metric-block"><div class="metric-num">{n_error}</div><div class="metric-label">Fields where NULL = Error</div></div>', unsafe_allow_html=True)

    st.markdown("---")

    # SoS blank explanation — the key question from the images
    st.markdown("### 🔑 Key Question: Why Do Some Businesses Show 'No Registry Data'?")
    st.markdown("""
    <div class="field-card field-card-amber">
    <b>The images show two businesses:</b><br>
    • <b>DSS NAILS LLC</b> — Business Registration ✅ Verified, but "No Registry Data to Display"<br>
    • <b>Pizza and a Chef LLC</b> — Business Registration ✅ Verified + Full Secretary of State Filings<br><br>

    <b>Why the difference?</b><br>
    This is <b>NOT</b> a Worth internal confidence rule or data suppression.<br>
    It is entirely the Middesk (Secretary of State API) response:<br><br>

    1️⃣ <b>Middesk searches SoS databases by TIN + business name</b><br>
    2️⃣ If Middesk finds a SoS filing → sos_filings array is populated → admin UI shows the filing details<br>
    3️⃣ If Middesk does NOT find a SoS filing → sos_filings = [] → admin UI shows "No Registry Data to Display"<br><br>

    <b>Note:</b> "Business Registration: Verified" means Middesk confirmed the EIN matches a legal entity (via IRS).<br>
    "No Registry Data" means no <i>Secretary of State filing</i> was found for that EIN in the SoS registry databases.<br><br>

    <b>Common reasons for no SoS data:</b><br>
    • Business is a sole proprietor (not required to file with SoS in many states)<br>
    • Business registered under a different TIN or name variant<br>
    • New business not yet indexed in Middesk's SoS database<br>
    • Business registered in a state not covered by Middesk's search
    </div>
    """, unsafe_allow_html=True)

    st.markdown("---")

    # Field summary table
    st.markdown("### 📋 All Fields at a Glance")

    def null_cell(is_error: bool) -> str:
        if is_error:
            return '<span style="color:#FCA5A5;font-weight:700;">⚠️ Yes</span>'
        return '<span style="color:#6EE7B7;font-weight:700;">✅ No</span>'

    def w360_cell(has: bool) -> str:
        if has:
            return '<span style="color:#6EE7B7;font-weight:700;">✅</span>'
        return '<span style="color:#64748B;">—</span>'

    def display_name_cell(name: str) -> str:
        return f'<span style="color:#E2E8F0;">{name}</span>'

    def section_cell(s: str) -> str:
        colours = {"KYB": "#60A5FA", "KYC": "#A78BFA", "Banking": "#34D399"}
        c = colours.get(s, "#94A3B8")
        return f'<span style="color:{c};font-weight:600;">{s}</span>'

    def type_cell(t: str) -> str:
        colours = {"Verification": "#93C5FD", "Prefill": "#86EFAC", "Risk": "#FCA5A5", "Industry": "#FCD34D"}
        c = colours.get(t, "#CBD5E1")
        return f'<span style="color:{c};">{t}</span>'

    table_html = """<table class="lineage-table">
    <tr>
      <th>API Field Path</th>
      <th>Display Name</th>
      <th>Section</th>
      <th>Type</th>
      <th>Primary Sources</th>
      <th>Null = Error?</th>
      <th>W360</th>
    </tr>"""
    for key, fld in FIELD_LINEAGE.items():
        src_html = " ".join(source_badge(s) for s in fld["sources"][:3])
        table_html += f"""<tr>
        <td><code>{fld['api_field_path']}</code></td>
        <td>{display_name_cell(fld['display_name'])}</td>
        <td>{section_cell(fld['section'])}</td>
        <td>{type_cell(fld['data_type'])}</td>
        <td>{src_html}</td>
        <td>{null_cell(fld['null_is_error'])}</td>
        <td>{w360_cell(fld.get('w360', False))}</td>
        </tr>"""
    table_html += "</table>"
    st.markdown(table_html, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: FIELD EXPLORER
# ══════════════════════════════════════════════════════════════════════════════
elif page == "🔎 Field Explorer":
    st.markdown('<div class="section-header">🔎 Field-by-Field Lineage Explorer</div>', unsafe_allow_html=True)

    # Filter fields
    filtered_keys = [
        k for k, v in FIELD_LINEAGE.items()
        if (not filter_section or v["section"] in filter_section)
        and (not filter_type or v["data_type"] in filter_type)
        and (
            filter_null_error == "All"
            or (filter_null_error == "Expected Behaviour" and not v["null_is_error"])
            or (filter_null_error == "Potential Error" and v["null_is_error"])
        )
    ]

    if not filtered_keys:
        st.warning("No fields match the current filters. Try adjusting the sidebar filters.")
        st.stop()

    # Field selector
    display_labels = {k: f"{FIELD_LINEAGE[k]['api_field_path']}  ·  {FIELD_LINEAGE[k]['display_name']}" for k in filtered_keys}
    selected_key = st.selectbox(
        "Select API Field",
        options=filtered_keys,
        format_func=lambda k: display_labels[k],
    )

    fld = FIELD_LINEAGE[selected_key]

    st.markdown("---")

    # ── Header ────────────────────────────────────────────────────────────────
    col_h1, col_h2 = st.columns([3, 1])
    with col_h1:
        st.markdown(f"## {fld['display_name']}")
        src_badges = " ".join(source_badge(s) for s in fld["sources"])
        st.markdown(src_badges + f' &nbsp; {null_badge(fld["null_is_error"])}', unsafe_allow_html=True)
    with col_h2:
        st.markdown(f"""
        <div class="metric-block">
        <div style="font-size:0.75rem;color:#64748B;">Section / Type</div>
        <div style="font-size:1rem;font-weight:700;color:#1E40AF;">{fld['section']}</div>
        <div style="font-size:0.85rem;color:#334155;">{fld['data_type']}</div>
        </div>
        """, unsafe_allow_html=True)

    # ── API path ──────────────────────────────────────────────────────────────
    st.markdown(f'<div class="code-box">API Field Path:  {fld["api_field_path"]}\nInternal Fact Name:  {fld["api_fact_name"]}</div>', unsafe_allow_html=True)
    st.markdown("")

    # ── Tabs ──────────────────────────────────────────────────────────────────
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "📖 Description", "📡 Sources & Lineage", "🗄️ Storage", "⚠️ Null / Blank", "📋 Rules", "❓ UCM Q&A"
    ])

    with tab1:
        st.markdown("### What This Field Is")
        st.markdown(fld["description"])

        st.markdown("### Where It Appears in the Admin UI")
        st.markdown(f'<div class="field-card field-card-purple">📍 {fld["admin_ui_location"]}</div>', unsafe_allow_html=True)

        col_t1, col_t2, col_t3 = st.columns(3)
        with col_t1:
            st.markdown("**Requires Transformation?**")
            st.markdown("✅ Yes" if fld["requires_transformation"] else "❌ No")
            if fld.get("transformation_note"):
                st.caption(fld["transformation_note"])
        with col_t2:
            st.markdown("**Worth 360 Report?**")
            st.markdown("✅ Yes" if fld.get("w360") else "❌ No")
        with col_t3:
            st.markdown("**Display in UCM?**")
            st.markdown("✅ Yes" if fld["data_type"] != "Risk" else "Decisional")

    with tab2:
        st.markdown("### Data Sources")
        for src_key in fld["sources"]:
            src = SOURCES.get(src_key, {})
            detail = fld.get("source_detail", {}).get(src_key, "")
            cls, label = SOURCE_BADGE.get(src_key, ("badge-grey", src_key))

            with st.expander(f"**{src.get('name', src_key)}** — weight {src.get('weight', '?')} · platform_id {src.get('platform_id', '?')}"):
                col_s1, col_s2 = st.columns(2)
                with col_s1:
                    st.markdown(f"**Platform ID:** `{src.get('platform_id', '?')}`")
                    st.markdown(f"**Weight:** `{src.get('weight', '?')}`")
                    st.markdown(f"**Scope:** `{src.get('scope', '?')}`")
                    st.markdown(f"**API Type:** {src.get('api_type', '?')}")
                with col_s2:
                    st.markdown(f"**Confidence Model:** {src.get('confidence_model', '?')}")
                    st.markdown(f"**Storage:** `{src.get('storage', '?')}`")
                if detail:
                    st.markdown(f"**For this field:** {detail}")

        st.markdown("### Data Flow Diagram")
        flow_steps = []
        for src_key in fld["sources"]:
            src = SOURCES.get(src_key, {})
            flow_steps.append(f"  {src.get('name', src_key)} (platform_id={src.get('platform_id','?')}, weight={src.get('weight','?')})")
        flow_text = "\n".join(flow_steps)
        st.markdown(f"""
```
Business Submitted (UCM / OnDemand)
         │
         ▼
Integration Service — Vendor Lookups (in parallel):
{flow_text}
         │
         ▼
Fact Engine — applyRulesToFact('{fld['api_fact_name']}')
  Rule: {fld['fact_engine_rule']}
  [manualOverride always checked first]
         │
         ▼
rds_warehouse_public.facts
  name = '{fld['api_fact_name']}'
  value = {{ "value": <result>, "source": {{ "platformId": X, "confidence": Y }}, "alternatives": [...] }}
         │
         ▼
Worth API → KYB endpoint → Admin UI ({fld['admin_ui_location']})
```
""")

    with tab3:
        st.markdown("### Storage Tables")
        for tbl in fld["storage_tables"]:
            st.markdown(f"- `{tbl}`")

        st.markdown("### facts Table Schema")
        st.markdown("""
```sql
-- rds_warehouse_public.facts
CREATE TABLE facts (
    id           BIGSERIAL,
    business_id  VARCHAR     NOT NULL,
    name         VARCHAR     NOT NULL,  -- e.g. 'sos_filings', 'tin_match_boolean'
    value        JSONB,                 -- { "value": ..., "source": { "platformId": N, ... }, "alternatives": [...] }
    received_at  TIMESTAMPTZ,
    PRIMARY KEY  (business_id, name)
);
```
""")
        st.markdown("### Raw Vendor Response Storage")
        st.markdown("""
```sql
-- integration_data.request_response
-- Raw API response from every vendor call
SELECT response, requested_at, platform_id
FROM integration_data.request_response
WHERE business_id = '<business_id>'
  AND platform_id = <N>   -- N = vendor platform_id
ORDER BY requested_at DESC
LIMIT 1;
```
""")
        st.info("💡 The `value` JSONB includes `alternatives[]` — all vendor responses before the winner was selected. This is your full audit trail.")

    with tab4:
        st.markdown("### When Is This Field Blank or NULL?")
        null_cls = "field-card-red" if fld["null_is_error"] else "field-card-green"
        null_icon = "⚠️" if fld["null_is_error"] else "✅"
        st.markdown(f'<div class="field-card {null_cls}">{null_icon} <b>NULL / Blank is: {"a potential error" if fld["null_is_error"] else "expected behaviour"}</b><br><br>{fld["null_reason"]}</div>', unsafe_allow_html=True)

        st.markdown("### Detailed Null Scenarios")
        st.markdown(fld["null_blank_scenario"])

        st.markdown("### Is This a Worth Internal Rule?")
        if fld["null_is_error"]:
            st.error("This field should not be null in normal operation. If null, it may indicate a data pipeline issue.")
        else:
            st.success(
                "Worth does NOT suppress this field based on confidence thresholds. "
                "If the value is blank, it means no vendor returned data for this field for this business. "
                "Worth shows whatever the vendors provide — if they find nothing, the field is blank."
            )

    with tab5:
        st.markdown("### Fact Engine Rule Applied")
        st.markdown(f'<div class="code-box">Rule: {fld["fact_engine_rule"]}</div>', unsafe_allow_html=True)
        st.markdown("")

        st.markdown("### Rule Explanation")
        rule_name = fld["fact_engine_rule"].split(" ")[0].split("(")[0]
        rule_desc = RULES.get(rule_name, RULES.get(fld["fact_engine_rule"].split("—")[0].strip(), ""))
        if rule_desc:
            st.info(rule_desc)

        st.markdown("### All Available Rules")
        for rname, rdesc in RULES.items():
            st.markdown(f"**`{rname}`** — {rdesc}")

        st.markdown("### Source Priority (When Multiple Sources Have This Value)")
        priority_table = """<table class="lineage-table">
        <tr><th>Source</th><th>Platform ID</th><th>Weight</th><th>Confidence Model</th></tr>"""
        sorted_sources = sorted(
            [(k, SOURCES[k]) for k in fld["sources"] if k in SOURCES],
            key=lambda x: -(x[1].get("weight", 0))
        )
        for src_key, src in sorted_sources:
            cls, label = SOURCE_BADGE.get(src_key, ("badge-grey", src_key))
            w = src.get("weight", 0)
            w_colour = "#FCD34D" if w >= 2.0 else ("#6EE7B7" if w >= 0.8 else "#94A3B8")
            priority_table += f"""<tr>
            <td><span class="badge {cls}">{label}</span></td>
            <td><code>{src.get('platform_id', '?')}</code></td>
            <td><b style="color:{w_colour};font-size:1rem;">{src.get('weight', '?')}</b></td>
            <td style="font-size:0.82rem;color:#94A3B8;">{src.get('confidence_model', '?')}</td>
            </tr>"""
        priority_table += "</table>"
        st.markdown(priority_table, unsafe_allow_html=True)

    with tab6:
        st.markdown("### GPN Questions from Working Session")
        if fld["gpn_questions"]:
            st.markdown(f'<div class="field-card field-card-amber">❓ {fld["gpn_questions"]}</div>', unsafe_allow_html=True)
        else:
            st.markdown("*No specific GPN questions for this field.*")

        st.markdown("### Confirmed Answers / Decisions")
        if fld["confirmed_answers"]:
            st.markdown(f'<div class="field-card field-card-green">✅ {fld["confirmed_answers"]}</div>', unsafe_allow_html=True)
        else:
            st.markdown("*No confirmed answers yet.*")

        st.markdown("### UCM Rule")
        if fld.get("ucm_rule"):
            st.markdown(f'<div class="field-card field-card-purple">⚖️ {fld["ucm_rule"]}</div>', unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: SOURCE REFERENCE
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📡 Source Reference":
    st.markdown('<div class="section-header">📡 Vendor Source Reference</div>', unsafe_allow_html=True)

    st.markdown("""
    Every vendor source used by Worth AI's Fact Engine is documented here,
    including platform IDs, weights, confidence models, and storage locations.
    """)

    for src_key, src in SOURCES.items():
        cls, label = SOURCE_BADGE.get(src_key, ("badge-grey", src_key))
        with st.expander(f"**{src['name']}**  ·  platform_id={src['platform_id']}  ·  weight={src['weight']}"):
            c1, c2 = st.columns(2)
            with c1:
                st.markdown(f"**Platform ID:** `{src['platform_id']}`")
                st.markdown(f"**Weight:** `{src['weight']}`")
                st.markdown(f"**Scope:** `{src['scope']}`")
                st.markdown(f"**API Type:** {src['api_type']}")
            with c2:
                st.markdown(f"**Confidence Model:**")
                st.markdown(src['confidence_model'])
                st.markdown(f"**Storage:** `{src['storage']}`")
            st.markdown(f"**Description:** {src['description']}")

            # Which fields use this source
            used_in = [fld["display_name"] for fld in FIELD_LINEAGE.values() if src_key in fld["sources"]]
            if used_in:
                st.markdown(f"**Used for fields:** {', '.join(used_in)}")

    st.markdown("---")
    st.markdown("### Source Weight Comparison")
    weight_data = {src["name"]: src["weight"] for src in SOURCES.values()}
    import pandas as pd
    df_weights = pd.DataFrame(
        [(k, v) for k, v in sorted(weight_data.items(), key=lambda x: -x[1])],
        columns=["Source", "Weight"]
    )
    st.bar_chart(df_weights.set_index("Source"))

    st.markdown("### MAX_CONFIDENCE_INDEX = 55")
    st.info(
        "Entity-match confidence is computed as `match.index / 55`. "
        "A match.index of 55 = confidence 1.0 (perfect match). "
        "The match.index comes from the XGBoost entity-matching model output "
        "(used for ZoomInfo, Equifax, OpenCorporates matches against the business name+address)."
    )


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: PIPELINE DIAGRAM
# ══════════════════════════════════════════════════════════════════════════════
elif page == "📋 Pipeline Diagram":
    st.markdown('<div class="section-header">📋 Worth AI Data Pipeline</div>', unsafe_allow_html=True)
    st.markdown(PIPELINE_OVERVIEW)

    st.markdown("---")
    st.markdown("### Why 'No Registry Data to Display' Appears")
    st.markdown("""
    ```
    Business Submitted
           │
           ▼
    Middesk API called (platform_id=16, weight=2.0)
    │  Middesk queries Secretary of State databases by TIN + Business Name
    │
    ├──► SoS filing FOUND → sos_filings[] populated
    │       → Admin UI: Secretary of State Filings card with full data
    │       → Example: Pizza and a Chef LLC (FL, 05/31/2023, LLC, Active)
    │
    └──► SoS filing NOT FOUND → sos_filings = []
            → Admin UI: "No Registry Data to Display"
            → "No Secretary of State filings were found for the Tax ID Number (EIN)"
            → Example: DSS NAILS LLC
            →
            → REASONS THIS HAPPENS:
            →   • Business is a sole proprietor (SoS filing not required in many states)
            →   • Business registered under different TIN or name variant
            →   • New business not yet in Middesk's SoS database
            →   • State not covered by Middesk's SoS search scope
            →
            → THIS IS NOT A WORTH CONFIDENCE RULE
            → Worth does not hide SoS data because confidence is "too low"
            → If Middesk returns nothing, there is nothing to show
    ```
    """)

    st.markdown("### Fact Engine Rule Execution Order")
    st.markdown("""
    ```
    For every field, the Fact Engine runs rules in this order:

    1. manualOverride  ← ALWAYS FIRST. If analyst manually set value → it wins.
       └─ Reads from manual_source.rawResponse[factName]

    2. Configured rules (from allFacts.ts or kyb/index.ts):
       ├─ factWithHighestConfidence  → pick vendor with highest confidence score
       │   └─ If confidence difference < 0.05 threshold → use factWithHighestWeight
       ├─ factWithHighestWeight     → pick vendor with highest weight (Middesk=2.0 wins)
       ├─ combineFacts              → merge all values into array (for names, addresses, people)
       ├─ registryPreferredRule     → prefer OpenCorporates for classification_codes
       ├─ truliooPreferredRule      → prefer Trulioo for UK/CA businesses
       └─ combineWatchlistMetadata  → merge + deduplicate watchlist hits from all sources

    3. If no valid options → fact is NULL (no valid vendor response found)
    ```
    """)

    st.markdown("### Key Tables Reference")
    table_ref = """<table class="lineage-table">
    <tr><th>Table</th><th>Schema</th><th>Contains</th><th>Written By</th></tr>
    <tr><td><code>facts</code></td><td>rds_warehouse_public</td><td>All 200+ resolved facts per business (JSONB)</td><td>warehouse-service (from Kafka facts.v1)</td></tr>
    <tr><td><code>request_response</code></td><td>integration_data</td><td>Raw vendor API responses per platform_id</td><td>integration-service per vendor call</td></tr>
    <tr><td><code>data_businesses</code></td><td>rds_cases_public</td><td>Core business record: naics_id, mcc_id, industry, name</td><td>case-service on submission + fact updates</td></tr>
    <tr><td><code>data_owners</code></td><td>rds_cases_public</td><td>Owner records: name, SSN (masked), DOB, address</td><td>case-service on submission</td></tr>
    <tr><td><code>data_cases</code></td><td>rds_cases_public</td><td>Case status, worth_score, timestamps</td><td>case-service</td></tr>
    <tr><td><code>core_naics_code</code></td><td>rds_cases_public</td><td>NAICS code lookup (code, label)</td><td>Static reference table</td></tr>
    <tr><td><code>core_mcc_code</code></td><td>rds_cases_public</td><td>MCC code lookup (code, label)</td><td>Static reference table</td></tr>
    <tr><td><code>rel_naics_mcc</code></td><td>rds_cases_public</td><td>NAICS → MCC mapping</td><td>Static reference table</td></tr>
    <tr><td><code>customer_files</code></td><td>datascience</td><td>Pipeline B wide table (ZI vs EFX winner)</td><td>warehouse-service batch</td></tr>
    </table>"""
    st.markdown(table_ref, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════════════════════
# PAGE: UCM Q&A TRACKER
# ══════════════════════════════════════════════════════════════════════════════
elif page == "❓ UCM Q&A Tracker":
    st.markdown('<div class="section-header">❓ UCM Q&A Working Session Tracker</div>', unsafe_allow_html=True)

    st.markdown("""
    All questions from the `[WS] UCM Q/A` tab (column G: GPN Questions and/or Notes)
    with their confirmed answers (column H: Decisions/To-Dos) and lineage mapping.
    """)

    # Filter: show only fields with open questions
    show_open = st.checkbox("Show only fields with open / pending items (⏳)", value=False)

    for key, fld in FIELD_LINEAGE.items():
        has_pending = "⏳" in fld.get("confirmed_answers", "")
        if show_open and not has_pending:
            continue

        status_icon = "⏳" if has_pending else "✅"
        border_cls = "field-card-amber" if has_pending else "field-card-green"

        with st.expander(f"{status_icon}  **{fld['display_name']}**  ·  `{fld['api_field_path']}`"):
            col_q1, col_q2 = st.columns(2)
            with col_q1:
                st.markdown("**GPN Questions / Notes:**")
                if fld["gpn_questions"]:
                    st.markdown(f'<div class="field-card field-card-amber" style="font-size:0.9rem;">{fld["gpn_questions"]}</div>', unsafe_allow_html=True)
                else:
                    st.markdown("*No questions raised.*")

            with col_q2:
                st.markdown("**Confirmed Answers / Decisions:**")
                if fld["confirmed_answers"]:
                    st.markdown(f'<div class="field-card {border_cls}" style="font-size:0.9rem;">{fld["confirmed_answers"]}</div>', unsafe_allow_html=True)
                else:
                    st.markdown("*No answers yet.*")

            st.markdown(f"**UCM Rule:** {fld.get('ucm_rule', 'Not defined')}")
            st.markdown(f"**Requires Transformation:** {'Yes — ' + fld.get('transformation_note', '') if fld.get('requires_transformation') else 'No'}")
            st.markdown(f"**Worth 360 Report:** {'✅ Yes' if fld.get('w360') else '❌ No'}")

    st.markdown("---")
    st.markdown("### Summary Statistics")
    total = len(FIELD_LINEAGE)
    pending = sum(1 for v in FIELD_LINEAGE.values() if "⏳" in v.get("confirmed_answers", ""))
    confirmed = total - pending
    c1, c2, c3 = st.columns(3)
    with c1:
        st.metric("Total Fields Mapped", total)
    with c2:
        st.metric("✅ Confirmed / Closed", confirmed)
    with c3:
        st.metric("⏳ Pending / Open", pending)
