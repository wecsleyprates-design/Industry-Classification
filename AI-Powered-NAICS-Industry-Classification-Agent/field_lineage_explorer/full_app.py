"""
Worth AI — Full Intelligence Hub
Three-section interactive application:
  1. KYB API Field Lineage     — every UCM field, source, rule, null scenario
  2. NAICS/MCC 561499 Report   — root-cause analysis, charts, gaps, roadmap
  3. Pipeline Intelligence     — Pipeline A & B full picture, data lineage, diagrams
"""
import io
import streamlit as st
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from lineage_data import (
    FIELD_LINEAGE, SOURCES, RULES, ALL_SECTIONS, ALL_DATA_TYPES,
    PIPELINE_OVERVIEW, NULL_CAUSE_TYPES, FIELD_NULL_CAUSES,
    CONFIDENCE_SUPPRESSION_FACT, PIPELINE_A_NAICS_RULES,
)

# ═══════════════════════════════════════════════════════════════════
# PAGE CONFIG + GLOBAL STYLE
# ═══════════════════════════════════════════════════════════════════
st.set_page_config(
    page_title="Worth AI Intelligence Hub",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

BG       = "#0F172A"
GRID_COL = "#1E293B"
RED_C    = "#F87171"
AMBER_C  = "#FCD34D"
GREEN_C  = "#34D399"
BLUE_C   = "#60A5FA"
TEAL_C   = "#2DD4BF"
GREY_C   = "#94A3B8"
PURPLE_C = "#A78BFA"
TEXT_COL = "#E2E8F0"
SUBTEXT  = "#94A3B8"
N_TOTAL  = 5349

st.markdown("""
<style>
html,body,[class*="css"]{font-family:'Inter','Segoe UI',sans-serif;}
section[data-testid="stSidebar"]{background:#0B1120!important;}
section[data-testid="stSidebar"] *{color:#E2E8F0!important;}

/* cards */
.card{background:#1A2744;border:1px solid #2D4070;border-left:5px solid #3B82F6;
      border-radius:8px;padding:14px 18px;margin-bottom:10px;color:#CBD5E1;line-height:1.65;}
.card *{color:#CBD5E1!important;} .card b,.card strong{color:#E2E8F0!important;}
.card-red{background:#2A1010;border-left:5px solid #EF4444;color:#FCA5A5!important;}
.card-red *{color:#FCA5A5!important;} .card-red b{color:#FEE2E2!important;}
.card-green{background:#0C2218;border-left:5px solid #10B981;color:#6EE7B7!important;}
.card-green *{color:#6EE7B7!important;} .card-green b{color:#A7F3D0!important;}
.card-amber{background:#221A06;border-left:5px solid #F59E0B;color:#FCD34D!important;}
.card-amber *{color:#FCD34D!important;} .card-amber b{color:#FDE68A!important;}
.card-purple{background:#180D30;border-left:5px solid #8B5CF6;color:#C4B5FD!important;}
.card-purple *{color:#C4B5FD!important;} .card-purple b{color:#DDD6FE!important;}
.card-teal{background:#061B1B;border-left:5px solid #2DD4BF;color:#99F6E4!important;}
.card-teal *{color:#99F6E4!important;} .card-teal b{color:#CCFBF1!important;}

/* badges */
.badge{display:inline-block;padding:3px 11px;border-radius:12px;font-size:.73rem;
       font-weight:700;margin:2px;letter-spacing:.01em;}
.b-blue{background:#1E3A6E;color:#93C5FD;border:1px solid #2563EB;}
.b-green{background:#064E3B;color:#6EE7B7;border:1px solid #059669;}
.b-amber{background:#451A03;color:#FCD34D;border:1px solid #D97706;}
.b-red{background:#450A0A;color:#FCA5A5;border:1px solid #DC2626;}
.b-purple{background:#2E1065;color:#C4B5FD;border:1px solid #7C3AED;}
.b-grey{background:#1E293B;color:#94A3B8;border:1px solid #475569;}
.b-teal{background:#042F2E;color:#5EEAD4;border:1px solid #0D9488;}

/* metric */
.metric-block{background:#1A2744;border:1px solid #2D4070;border-radius:10px;
              padding:16px 18px;text-align:center;}
.metric-num{font-size:2rem;font-weight:700;color:#60A5FA;}
.metric-label{font-size:.78rem;color:#94A3B8;margin-top:4px;}

/* table */
.t{width:100%;border-collapse:collapse;font-size:.87rem;}
.t th{background:#0F2040;color:#93C5FD;font-weight:700;padding:9px 13px;
      text-align:left;border-bottom:2px solid #2563EB;}
.t td{padding:8px 13px;border-bottom:1px solid #1E293B;vertical-align:top;
      color:#CBD5E1;background:#0F172A;}
.t tr:nth-child(even) td{background:#141F35;}
.t code{background:#1E3A5F;color:#93C5FD;padding:1px 6px;border-radius:4px;font-size:.82em;}

/* section header */
.sh{background:linear-gradient(135deg,#0F2040 0%,#1D4ED8 100%);color:#E2E8F0;
    padding:11px 20px;border-radius:8px;font-weight:700;font-size:1.08rem;
    margin-bottom:12px;border:1px solid #2563EB;}

/* code box */
.cb{background:#0A1628;color:#93C5FD;border:1px solid #1E3A5F;border-radius:6px;
    padding:12px 16px;font-family:'Courier New',monospace;font-size:.82rem;
    white-space:pre-wrap;word-break:break-all;line-height:1.55;}

/* pipeline node */
.pnode{background:#1A2744;border:1px solid #2D4070;border-radius:8px;
       padding:10px 14px;text-align:center;font-size:.82rem;color:#E2E8F0;}
.pnode-green{border-color:#059669;background:#0C2218;}
.pnode-amber{border-color:#D97706;background:#221A06;}
.pnode-red{border-color:#DC2626;background:#2A1010;}

/* pill */
.pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
      border-radius:14px;font-size:.72rem;font-weight:600;margin:2px 3px 2px 0;}

[data-null-tip]{cursor:help;}
</style>
""", unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════
# CHART HELPERS
# ═══════════════════════════════════════════════════════════════════
SOURCE_BADGE = {
    "middesk":        ("b-blue",   "Middesk (SoS)"),
    "opencorporates": ("b-green",  "OpenCorporates"),
    "zoominfo":       ("b-purple", "ZoomInfo"),
    "equifax":        ("b-amber",  "Equifax"),
    "trulioo":        ("b-red",    "Trulioo KYB"),
    "ai_naics":       ("b-grey",   "AI Enrichment"),
    "plaid":          ("b-blue",   "Plaid IDV"),
    "serp":           ("b-grey",   "SERP / Web"),
    "manual":         ("b-amber",  "Manual Override"),
    "businessDetails":("b-green",  "Applicant Submission"),
    "google":         ("b-red",    "Google Places"),
    "verdata":        ("b-grey",   "Verdata"),
}

def sbadge(k):
    c, l = SOURCE_BADGE.get(k, ("b-grey", k))
    return f'<span class="badge {c}">{l}</span>'

def fig_to_img(fig, w=9.0):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor=BG, edgecolor="none")
    buf.seek(0); plt.close(fig); return buf, w

def add_img(buf, w=9.0, caption=None):
    p = st.container()
    p.image(buf, width=int(w * 96))
    if caption:
        st.caption(caption)

def styled_metric(label, value, colour="#60A5FA"):
    return (f'<div class="metric-block"><div class="metric-num" style="color:{colour};">'
            f'{value}</div><div class="metric-label">{label}</div></div>')

def card(text, style=""):
    st.markdown(f'<div class="card {style}">{text}</div>', unsafe_allow_html=True)

def sh(text):
    st.markdown(f'<div class="sh">{text}</div>', unsafe_allow_html=True)

# ═══════════════════════════════════════════════════════════════════
# SIDEBAR NAVIGATION
# ═══════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("""
    <div style="background:linear-gradient(135deg,#0B0F2A 0%,#1a1150 100%);
         border-radius:10px;padding:14px 18px;margin-bottom:8px;
         border:1px solid #2D2080;text-align:center;">
      <div style="font-size:1.4rem;font-weight:900;letter-spacing:.06em;color:#E2E8F0;">
        <span style="color:#B57BFF;">W</span>ORTH<span style="color:#60A5FA;"> AI</span>
      </div>
      <div style="font-size:.6rem;color:#8B8FBF;letter-spacing:.18em;margin-top:2px;">
        INTELLIGENCE HUB
      </div>
    </div>""", unsafe_allow_html=True)

    section = st.radio(
        "Section",
        ["🏷️  KYB API Field Lineage",
         "⚠️  NAICS / MCC 561499 Report",
         "🔀  Pipeline A & B Deep Dive"],
        label_visibility="collapsed",
    )
    st.markdown("---")

    if section == "🏷️  KYB API Field Lineage":
        kyb_page = st.radio("View",
            ["🏠 Overview", "🔎 Field Explorer",
             "📡 Source Reference", "📋 Pipeline Diagram",
             "❓ UCM Q&A Tracker"],
            label_visibility="collapsed")
        st.markdown("---")
        if kyb_page in ("🏠 Overview", "🔎 Field Explorer"):
            st.markdown("**Filters**")
            f_section = st.multiselect("Section", ALL_SECTIONS, default=ALL_SECTIONS)
            f_type    = st.multiselect("Data Type", ALL_DATA_TYPES, default=ALL_DATA_TYPES)
            f_null    = st.selectbox("Null / Blank is…",
                                      ["All", "Expected Behaviour", "Potential Error"])
        else:
            f_section = ALL_SECTIONS; f_type = ALL_DATA_TYPES; f_null = "All"
    elif section == "⚠️  NAICS / MCC 561499 Report":
        naics_page = st.radio("View",
            ["📊 Executive Summary", "🔍 Root-Cause Analysis",
             "📡 Vendor Signal Deep Dive", "🤖 AI Enrichment Behaviour",
             "🔧 Gap Analysis & Roadmap", "💡 Fact Engine Rules (Correct)"],
            label_visibility="collapsed")
    else:
        pipeline_page = st.radio("View",
            ["🗺️  Full Pipeline Map", "🅐 Pipeline A Deep Dive",
             "🅑 Pipeline B Deep Dive", "📦 Storage & Tables",
             "⚖️  Pipeline A vs B Comparison"],
            label_visibility="collapsed")

    st.markdown("---")
    st.caption("Worth AI · April 2026 · Industry-Classification repo")


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SECTION 1 — KYB API FIELD LINEAGE                               ║
# ╚═══════════════════════════════════════════════════════════════════╝
if section == "🏷️  KYB API Field Lineage":
    sh("🏷️  KYB API Field Lineage — UCM Working Session Mapping")

    # ── shared: apply filters ──
    filtered = {k: v for k, v in FIELD_LINEAGE.items()
                if (not f_section or v["section"] in f_section)
                and (not f_type or v["data_type"] in f_type)
                and (f_null == "All"
                     or (f_null == "Expected Behaviour" and not v["null_is_error"])
                     or (f_null == "Potential Error" and v["null_is_error"]))}

    # ══════════════════════════════════════════════════
    # KYB PAGE: OVERVIEW
    # ══════════════════════════════════════════════════
    if kyb_page == "🏠 Overview":
        # metrics
        c1,c2,c3,c4,c5 = st.columns(5)
        with c1: st.markdown(styled_metric("Fields Mapped", len(FIELD_LINEAGE)), unsafe_allow_html=True)
        with c2: st.markdown(styled_metric("Vendor Sources", len(SOURCES)), unsafe_allow_html=True)
        with c3: st.markdown(styled_metric("Fact Engine Rules", len(RULES)), unsafe_allow_html=True)
        with c4:
            n_ok = sum(1 for v in FIELD_LINEAGE.values() if not v["null_is_error"])
            st.markdown(styled_metric("Null = Expected", n_ok, "#34D399"), unsafe_allow_html=True)
        with c5:
            n_err = sum(1 for v in FIELD_LINEAGE.values() if v["null_is_error"])
            st.markdown(styled_metric("Null = Error", n_err, "#F87171"), unsafe_allow_html=True)
        st.markdown("---")
        card("""
        <b>🔑 Why do some businesses show "No Registry Data to Display"?</b><br><br>
        • <b>DSS NAILS LLC</b> — Business Registration ✅ Verified, but "No Registry Data to Display"<br>
        • <b>Pizza and a Chef LLC</b> — Full Secretary of State Filings (FL, Active, LLC, 05/31/2023)<br><br>
        <b>This is NOT a Worth confidence rule.</b> Middesk searches all 50 US SoS databases.
        If a filing is found → card shows. If not found → "No Registry Data to Display".
        """, "card-amber")

    def null_tip(is_error, key):
        causes = FIELD_NULL_CAUSES.get(key, [])
        lines = ["NULL IS AN ERROR — required field missing" if is_error
                 else "NULL IS EXPECTED — Worth never suppresses based on confidence (Rule 4)", ""]
        for ct, detail in causes[:5]:
            info = NULL_CAUSE_TYPES.get(ct, {})
            safe_detail = detail.replace('"', "'").replace('<', '').replace('>', '')
            lines.append(f"{info.get('icon','•')} {info.get('label', ct)}: {safe_detail}")
        tip = "\n".join(lines).replace("'", "`")
        if is_error:
            return (f"<span title='{tip}' style=\"color:#FCA5A5;font-weight:700;"
                    f"border-bottom:2px dotted #FCA5A5;cursor:help;\">⚠️ Yes</span>")
        return (f"<span title='{tip}' style=\"color:#6EE7B7;font-weight:700;"
                f"border-bottom:2px dotted #6EE7B7;cursor:help;\">✅ No</span>")

    # ── overview table (only on Overview page) ──
    if kyb_page == "🏠 Overview":
        st.markdown("### All Fields at a Glance")
        st.markdown(
            '<div style="background:#0F2040;border:1px solid #2563EB;border-radius:6px;'
            'padding:8px 14px;font-size:.82rem;color:#93C5FD;margin-bottom:10px;">'
            '💡 Hover the <u>underlined</u> ✅ No / ⚠️ Yes cells for a tooltip with cause details. '
            'Expand any row below for the full breakdown.</div>',
            unsafe_allow_html=True)
        thtml = """<table class="t"><tr>
          <th>API Field Path</th><th>Display Name</th><th>Section</th>
          <th>Type</th><th>Primary Sources</th><th>Null=Error? (hover)</th><th>W360</th>
        </tr>"""
        for key, fld in filtered.items():
            srcs = " ".join(sbadge(s) for s in fld["sources"][:3])
            sec_c = {"KYB":"#60A5FA","KYC":"#A78BFA"}.get(fld["section"],"#94A3B8")
            typ_c = {"Verification":"#93C5FD","Prefill":"#86EFAC",
                     "Risk":"#FCA5A5","Industry":"#FCD34D"}.get(fld["data_type"],"#CBD5E1")
            thtml += (f"<tr>"
                      f"<td><code>{fld['api_field_path']}</code></td>"
                      f"<td style='color:#E2E8F0'>{fld['display_name']}</td>"
                      f"<td style='color:{sec_c};font-weight:600'>{fld['section']}</td>"
                      f"<td style='color:{typ_c}'>{fld['data_type']}</td>"
                      f"<td>{srcs}</td>"
                      f"<td style='text-align:center'>{null_tip(fld['null_is_error'], key)}</td>"
                      f"<td style='text-align:center;color:#6EE7B7'>{'✅' if fld.get('w360') else '<span style=color:#475569>—</span>'}</td>"
                      "</tr>")
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        st.markdown("---")
        st.markdown("**Click any field below for full detail:**")
        for key, fld in filtered.items():
            causes = FIELD_NULL_CAUSES.get(key, [])
            ni = "⚠️" if fld["null_is_error"] else "✅"
            with st.expander(f"{ni}  **{fld['display_name']}**  ·  `{fld['api_field_path']}`"):
                srcs_h = " ".join(sbadge(s) for s in fld["sources"])
                st.markdown(srcs_h, unsafe_allow_html=True)
                st.markdown(fld["description"])
                if causes:
                    for ct, detail in causes:
                        info = NULL_CAUSE_TYPES.get(ct, {})
                        c = info.get("colour","#94A3B8")
                        st.markdown(
                            f'<span class="pill" style="background:{c}22;color:{c};'
                            f'border:1px solid {c}55;">{info.get("icon","•")} {info.get("label","")}</span> '
                            f'<span style="color:#94A3B8;font-size:.82rem;">{detail}</span>',
                            unsafe_allow_html=True)

    # ══════════════════════════════════════════════════
    # KYB PAGE: FIELD EXPLORER
    # ══════════════════════════════════════════════════
    elif kyb_page == "🔎 Field Explorer":
        sh("🔎 Field Detail Explorer")
        sel = st.selectbox("Select a field",
                       list(filtered.keys()),
                       format_func=lambda k: f"{filtered[k]['api_field_path']}  ·  {filtered[k]['display_name']}")
        fld = filtered[sel]
        st.markdown(f"## {fld['display_name']}")
        st.markdown(" ".join(sbadge(s) for s in fld["sources"]), unsafe_allow_html=True)
        st.markdown(f'<div class="cb">API Field:  {fld["api_field_path"]}\nFact name:  {fld["api_fact_name"]}</div>',
                    unsafe_allow_html=True)

        t1,t2,t3,t4,t5,t6 = st.tabs(["📖 Description","📡 Sources","🗄️ Storage","⚠️ Null/Blank","📋 Rules","❓ UCM Q&A"])

        with t1:
            st.markdown(fld["description"])
            card(f'📍 <b>Admin UI:</b> {fld["admin_ui_location"]}', "card-purple")
            c1,c2,c3 = st.columns(3)
            c1.markdown(f"**Requires transformation?** {'✅ Yes' if fld['requires_transformation'] else '❌ No'}")
            if fld.get("transformation_note"): c1.caption(fld["transformation_note"])
            c2.markdown(f"**Worth 360?** {'✅ Yes' if fld.get('w360') else '❌ No'}")
            c3.markdown(f"**W360 display:** {'Decisional' if fld['data_type']=='Risk' else 'Info/Decisional'}")

        with t2:
            for sk in fld["sources"]:
                src = SOURCES.get(sk, {})
                detail = fld.get("source_detail", {}).get(sk, "")
                with st.expander(f"**{src.get('name', sk)}** — weight {src.get('weight','?')} · platform_id {src.get('platform_id','?')}"):
                    a,b = st.columns(2)
                    with a:
                        st.markdown(f"**Platform ID:** `{src.get('platform_id','?')}`")
                        st.markdown(f"**Weight:** `{src.get('weight','?')}`")
                        st.markdown(f"**API Type:** {src.get('api_type','?')}")
                    with b:
                        st.markdown(f"**Confidence Model:** {src.get('confidence_model','?')}")
                        st.markdown(f"**Storage:** `{src.get('storage','?')}`")
                    if detail: st.markdown(f"**For this field:** {detail}")
            flow = "\n".join(f"  {SOURCES.get(s,{}).get('name',s)} (pid={SOURCES.get(s,{}).get('platform_id','?')}, w={SOURCES.get(s,{}).get('weight','?')})"
                             for s in fld["sources"])
            st.code(f"Business Submitted\n       │\n       ▼\nVendor lookups (parallel):\n{flow}\n       │\n       ▼\nFact Engine: {fld['fact_engine_rule']}\n       │\n       ▼\nrds_warehouse_public.facts  name='{fld['api_fact_name']}'\n       │\n       ▼\nAdmin UI: {fld['admin_ui_location']}", language=None)

        with t3:
            for tbl in fld["storage_tables"]: st.markdown(f"- `{tbl}`")
            st.code("""-- rds_warehouse_public.facts schema
SELECT * FROM facts
WHERE business_id = '<id>'
  AND name = '{fact_name}';
-- value JSONB: { "value": ..., "source": { "platformId": N, "confidence": X }, "alternatives": [...] }""", language="sql")

        with t4:
            nc = "card-red" if fld["null_is_error"] else "card-green"
            card(f'{"⚠️" if fld["null_is_error"] else "✅"} <b>NULL is: {"an error" if fld["null_is_error"] else "expected behaviour"}</b><br>{fld["null_reason"]}', nc)
            causes = FIELD_NULL_CAUSES.get(sel, [])
            if causes:
                st.markdown("#### Possible Causes")
                for ct, detail in causes:
                    info = NULL_CAUSE_TYPES.get(ct, {})
                    c = info.get("colour", "#94A3B8")
                    st.markdown(
                        f'<div class="card" style="border-left-color:{c};background:#0E1E38;margin-bottom:6px;">'
                        f'<span class="pill" style="background:{c}22;color:{c};border:1px solid {c}55;">'
                        f'{info.get("icon","•")} {info.get("label","")}</span><br>'
                        f'<b style="color:#E2E8F0;font-size:.9rem;">{detail}</b><br>'
                        f'<span style="color:#94A3B8;font-size:.82rem;">{info.get("explanation","")}</span>'
                        f'</div>', unsafe_allow_html=True)
            st.markdown(fld["null_blank_scenario"])

        with t5:
            st.markdown(f'<div class="cb">Rule: {fld["fact_engine_rule"]}</div>', unsafe_allow_html=True)
            sorted_src = sorted([(k,SOURCES[k]) for k in fld["sources"] if k in SOURCES],
                                key=lambda x: -x[1].get("weight",0))
            thtml2 = '<table class="t"><tr><th>Source</th><th>Platform ID</th><th>Weight</th><th>Confidence Model</th></tr>'
            for sk, src in sorted_src:
                w = src.get("weight", 0)
                wc = "#FCD34D" if w >= 2 else ("#6EE7B7" if w >= 0.8 else "#94A3B8")
                bc, bl = SOURCE_BADGE.get(sk, ("b-grey", sk))
                thtml2 += (f"<tr><td><span class='badge {bc}'>{bl}</span></td>"
                           f"<td><code>{src.get('platform_id','?')}</code></td>"
                           f"<td><b style='color:{wc};font-size:1rem;'>{w}</b></td>"
                           f"<td style='font-size:.82rem;color:#94A3B8;'>{src.get('confidence_model','?')}</td></tr>")
            st.markdown(thtml2 + "</table>", unsafe_allow_html=True)

        with t6:
            a,b = st.columns(2)
            with a:
                st.markdown("**GPN Questions:**")
                if fld["gpn_questions"]:
                    card(f'❓ {fld["gpn_questions"]}', "card-amber")
                else: st.info("No questions raised.")
            with b:
                st.markdown("**Confirmed Answers:**")
                if fld["confirmed_answers"]:
                    card(f'{fld["confirmed_answers"]}', "card-green")
                else: st.warning("No confirmed answers yet.")
            if fld.get("ucm_rule"):
                card(f'⚖️ <b>UCM Rule:</b> {fld["ucm_rule"]}', "card-purple")

    # ══════════════════════════════════════════════════
    # KYB PAGE: SOURCE REFERENCE
    # ══════════════════════════════════════════════════
    elif kyb_page == "📡 Source Reference":
        sh("📡 Vendor Source Reference — All Sources Used in Worth AI KYB")
        for sk, src in SOURCES.items():
            bc, bl = SOURCE_BADGE.get(sk, ("b-grey", sk))
            w = src.get("weight", 0)
            wc = "#FCD34D" if w >= 2 else ("#6EE7B7" if w >= 0.8 else "#94A3B8")
            with st.expander(f"**{src['name']}**  ·  platform_id={src['platform_id']}  ·  weight={src['weight']}"):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown(f"**Platform ID:** `{src['platform_id']}`")
                    st.markdown(f"**Weight:** <b style='color:{wc}'>{src['weight']}</b>", unsafe_allow_html=True)
                    st.markdown(f"**Scope:** `{src['scope']}`")
                    st.markdown(f"**API Type:** {src['api_type']}")
                with c2:
                    st.markdown(f"**Confidence Model:** {src['confidence_model']}")
                    st.markdown(f"**Storage:** `{src['storage']}`")
                st.markdown(f"**Description:** {src['description']}")
                used = [v["display_name"] for v in FIELD_LINEAGE.values() if sk in v["sources"]]
                if used:
                    st.markdown(f"**Used for:** {', '.join(used)}")
        st.markdown("---")
        st.markdown("### Source Weight Comparison")
        weight_df = pd.DataFrame(
            sorted([(s["name"], s["weight"]) for s in SOURCES.values()], key=lambda x: -x[1]),
            columns=["Source", "Weight"]
        )
        st.bar_chart(weight_df.set_index("Source"))
        card("MAX_CONFIDENCE_INDEX = 55. Entity-match confidence = match.index / 55. "
             "A match.index of 55 = confidence 1.0 (perfect match).")

    # ══════════════════════════════════════════════════
    # KYB PAGE: PIPELINE DIAGRAM
    # ══════════════════════════════════════════════════
    elif kyb_page == "📋 Pipeline Diagram":
        sh("📋 Pipeline Diagram — How KYB Facts Flow from Vendor to Customer")
        st.markdown(PIPELINE_OVERVIEW)
        st.markdown("---")
        st.markdown("### Why 'No Registry Data to Display' Appears")
        st.code("""Business Submitted
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
        → NOT a Worth confidence rule — if Middesk finds nothing, nothing shows""", language=None)
        st.markdown("---")
        st.markdown("### Fact Engine Rule Execution Order")
        st.code("""For EVERY field, the Fact Engine runs rules in this order:
1. manualOverride()  ← ALWAYS FIRST. Analyst manual value wins everything.
2. factWithHighestConfidence() — pick vendor with highest confidence (gap > 5%)
3. weightedFactSelector() — tie-break if within 5%: Middesk(2.0)>OC(0.9)>ZI(0.8)>EFX(0.7)>AI(0.1)
4. NO minimum confidence cutoff — low-conf candidate still wins if only valid option
5. AI safety net — fires when <1 non-AI source has naics_code
6. removeNaicsCode() — if AI code not in core_naics_code → replaced with 561499
If no valid options → fact is NULL (no valid vendor response found)""", language=None)
        tref = """<table class="t"><tr><th>Table</th><th>Schema</th><th>Contains</th><th>Written By</th></tr>
        <tr><td><code>facts</code></td><td>rds_warehouse_public</td><td>All 200+ resolved facts per business (JSONB)</td><td>warehouse-service (Kafka facts.v1)</td></tr>
        <tr><td><code>request_response</code></td><td>integration_data</td><td>Raw vendor API responses per platform_id</td><td>integration-service per vendor call</td></tr>
        <tr><td><code>data_businesses</code></td><td>rds_cases_public</td><td>Core business record: naics_id, mcc_id, industry, name</td><td>case-service</td></tr>
        <tr><td><code>data_owners</code></td><td>rds_cases_public</td><td>Owner records: name, SSN (masked), DOB, address</td><td>case-service</td></tr>
        <tr><td><code>customer_files</code></td><td>datascience</td><td>Pipeline B wide table (ZI vs EFX winner)</td><td>warehouse-service batch</td></tr>
        </table>"""
        st.markdown(tref, unsafe_allow_html=True)

    # ══════════════════════════════════════════════════
    # KYB PAGE: UCM Q&A TRACKER
    # ══════════════════════════════════════════════════
    elif kyb_page == "❓ UCM Q&A Tracker":
        sh("❓ UCM Q&A Tracker — Working Session Questions & Confirmed Answers")
        show_open = st.checkbox("Show only fields with open / pending items (⏳)", value=False)
        for key, fld in FIELD_LINEAGE.items():
            has_pending = "⏳" in fld.get("confirmed_answers", "")
            if show_open and not has_pending:
                continue
            icon = "⏳" if has_pending else "✅"
            with st.expander(f"{icon}  **{fld['display_name']}**  ·  `{fld['api_field_path']}`"):
                c1, c2 = st.columns(2)
                with c1:
                    st.markdown("**GPN Questions / Notes:**")
                    if fld["gpn_questions"]:
                        card(f'❓ {fld["gpn_questions"]}', "card-amber")
                    else:
                        st.info("No questions raised.")
                with c2:
                    st.markdown("**Confirmed Answers / Decisions:**")
                    if fld["confirmed_answers"]:
                        bc = "card-amber" if has_pending else "card-green"
                        card(fld["confirmed_answers"], bc)
                    else:
                        st.warning("No confirmed answers yet.")
                st.markdown(f"**UCM Rule:** {fld.get('ucm_rule','Not defined')}")
                st.markdown(f"**Requires Transformation:** {'Yes — ' + fld.get('transformation_note','') if fld.get('requires_transformation') else 'No'}")
                st.markdown(f"**Worth 360 Report:** {'✅ Yes' if fld.get('w360') else '❌ No'}")
        st.markdown("---")
        total = len(FIELD_LINEAGE)
        pending = sum(1 for v in FIELD_LINEAGE.values() if "⏳" in v.get("confirmed_answers",""))
        c1,c2,c3 = st.columns(3)
        with c1: st.metric("Total Fields Mapped", total)
        with c2: st.metric("✅ Confirmed / Closed", total - pending)
        with c3: st.metric("⏳ Pending / Open", pending)


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SECTION 2 — NAICS / MCC 561499 REPORT                           ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "⚠️  NAICS / MCC 561499 Report":

    # ── shared chart builders ────────────────────────────────────────
    def _chart_scenario():
        fig, axes = plt.subplots(1, 2, figsize=(13, 5), facecolor=BG)
        fig.suptitle(f"Root-Cause: Why {N_TOTAL:,} Businesses Have NAICS 561499?",
                     color=TEXT_COL, fontsize=12, fontweight="bold")
        ax, ax2 = axes
        ax.set_facecolor(BG); ax2.set_facecolor(BG)
        wedges, _ = ax.pie([5348, 1], colors=[RED_C, GREEN_C], startangle=90,
                           wedgeprops={"width": 0.55, "edgecolor": BG})
        ax.set_title("Scenario Distribution", color=TEXT_COL, fontsize=10)
        ax.legend(["C: No vendor NAICS — AI blind\n5,348 (99.98%)",
                   "E: AI not triggered\n1 (0.02%)"],
                  facecolor=GRID_COL, labelcolor=TEXT_COL, fontsize=8,
                  loc="lower center", bbox_to_anchor=(0.5,-0.35), edgecolor="none")
        bars = ax2.bar(["C: No vendor\nNAICS (AI blind)", "E: AI not\ntriggered"],
                       [5348, 1], color=[RED_C, GREEN_C], width=0.55, edgecolor=BG)
        for bar, val in zip(bars, [5348,1]):
            ax2.text(bar.get_x()+bar.get_width()/2, bar.get_height()+N_TOTAL*.005,
                     f"{val:,}\n({100*val//N_TOTAL}%)",
                     ha="center", color=TEXT_COL, fontsize=9, fontweight="bold")
        ax2.set_ylabel("Business Count", color=SUBTEXT); ax2.set_title("Count per Scenario", color=TEXT_COL)
        ax2.tick_params(colors=SUBTEXT)
        for sp in ax2.spines.values(): sp.set_edgecolor(GRID_COL)
        ax2.yaxis.grid(True, color=GRID_COL, linewidth=0.6, linestyle="--")
        ax2.set_axisbelow(True); ax2.set_ylim(0, N_TOTAL*1.18)
        plt.tight_layout(); return fig_to_img(fig)

    def _chart_vendor():
        fig, axes = plt.subplots(1, 3, figsize=(15, 5), facecolor=BG)
        fig.suptitle("Vendor Signal Breakdown for 561499 Businesses",
                     color=TEXT_COL, fontsize=12, fontweight="bold")
        cols3 = [RED_C, AMBER_C, BLUE_C, GREEN_C]
        ax = axes[0]; ax.set_facecolor(BG)
        bars = ax.bar([0,1,2,3],[5348,1,0,0],color=cols3,width=0.6,edgecolor=BG)
        for bar,val in zip(bars,[5348,1,0,0]):
            if val>0: ax.text(bar.get_x()+bar.get_width()/2,bar.get_height()+N_TOTAL*.006,
                              f"{val:,}\n({100*val//N_TOTAL}%)",ha="center",color=TEXT_COL,fontsize=9,fontweight="bold")
        ax.set_xticks([0,1,2,3]); ax.set_xticklabels(["0\n(all null)","1 vendor","2 vendors","3 vendors"],color=SUBTEXT,fontsize=8.5)
        ax.set_ylabel("Business Count",color=SUBTEXT); ax.set_title("How Many Sources\nHave NAICS?",color=TEXT_COL,fontsize=10)
        ax.tick_params(colors=SUBTEXT)
        for sp in ax.spines.values(): sp.set_edgecolor(GRID_COL)
        ax.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax.set_axisbelow(True); ax.set_ylim(0,N_TOTAL*1.15)

        ax2 = axes[1]; ax2.set_facecolor(BG)
        ax2.bar([0,1,2],[0,1,0],color=[BLUE_C,GREEN_C,PURPLE_C],width=0.5,edgecolor=BG)
        ax2.text(0,0.1,"0",ha="center",color=GREY_C,fontsize=10)
        ax2.text(1,1.1,"1",ha="center",color=TEXT_COL,fontsize=10,fontweight="bold")
        ax2.text(2,0.1,"0",ha="center",color=GREY_C,fontsize=10)
        ax2.set_xticks([0,1,2]); ax2.set_xticklabels(["ZI only","EFX only","OC only"],color=SUBTEXT,fontsize=9)
        ax2.set_title("When Only 1 Vendor Has NAICS\n— Which One?",color=TEXT_COL,fontsize=10)
        ax2.set_ylabel("Business Count",color=SUBTEXT); ax2.tick_params(colors=SUBTEXT)
        for sp in ax2.spines.values(): sp.set_edgecolor(GRID_COL)
        ax2.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax2.set_axisbelow(True); ax2.set_ylim(0,3)

        ax3 = axes[2]; ax3.set_facecolor(BG)
        bars3 = ax3.bar([0,1,2],[0,5349,0],color=[GREEN_C,RED_C,AMBER_C],width=0.55,edgecolor=BG)
        for bar,val in zip(bars3,[0,5349,0]):
            pct=100*val//N_TOTAL
            ax3.text(bar.get_x()+bar.get_width()/2,bar.get_height()+N_TOTAL*.005,
                     f"{val:,}\n({pct}%)",ha="center",color=TEXT_COL,fontsize=9,fontweight="bold")
        ax3.set_xticks([0,1,2]); ax3.set_xticklabels(["Pipeline B\nhas real NAICS","Pipeline B\nalso null","Pipeline B\nalso 561499"],color=SUBTEXT,fontsize=8.5)
        ax3.set_title("Pipeline B (customer_files)\nfor Same Businesses",color=TEXT_COL,fontsize=10)
        ax3.set_ylabel("Business Count",color=SUBTEXT); ax3.tick_params(colors=SUBTEXT)
        for sp in ax3.spines.values(): sp.set_edgecolor(GRID_COL)
        ax3.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax3.set_axisbelow(True); ax3.set_ylim(0,N_TOTAL*1.15)
        plt.tight_layout(); return fig_to_img(fig)

    def _chart_ai():
        fig, axes = plt.subplots(1, 2, figsize=(13, 5.5), facecolor=BG)
        fig.suptitle("AI Enrichment (GPT-5-mini) — Two Questions, Two Answers",
                     color=TEXT_COL, fontsize=12, fontweight="bold")
        ax = axes[0]; ax.set_facecolor(BG)
        ax.bar([0],[2381],color=AMBER_C,width=0.5,edgecolor=BG,label="AI was Fact Engine winner (2,381 / 44%)")
        ax.bar([0],[2968],color=BLUE_C,width=0.5,edgecolor=BG,bottom=[2381],label="Other source won — also no NAICS (2,968 / 56%)")
        ax.text(0,2381/2,"AI won\n2,381 (44%)",ha="center",va="center",color="#0F172A",fontsize=11,fontweight="bold")
        ax.text(0,2381+2968/2,"Other source\n2,968 (56%)",ha="center",va="center",color="#0F172A",fontsize=11,fontweight="bold")
        ax.set_xticks([0]); ax.set_xticklabels(["5,349 businesses\nwith NAICS 561499"],color=SUBTEXT,fontsize=10)
        ax.set_ylabel("Business Count",color=SUBTEXT); ax.tick_params(colors=SUBTEXT)
        ax.set_title("Q1: Did AI enrichment run?\n(source: winning platformId in facts)",color=TEXT_COL,fontsize=10)
        for sp in ax.spines.values(): sp.set_edgecolor(GRID_COL)
        ax.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax.set_axisbelow(True); ax.set_ylim(0,N_TOTAL*1.22)
        ax.legend(facecolor=GRID_COL,labelcolor=TEXT_COL,fontsize=8.5,loc="upper right",edgecolor="none")
        ax.text(0.5,0.97,"YES — AI ran for ≥ 2,381 businesses",transform=ax.transAxes,
                ha="center",va="top",color=GREEN_C,fontsize=10,fontweight="bold")

        ax2 = axes[1]; ax2.set_facecolor(BG)
        ax2.bar([0],[N_TOTAL],color=RED_C,width=0.5,edgecolor=BG)
        ax2.text(0,N_TOTAL/2,"Metadata\nNOT saved\n5,349 (100%)",
                 ha="center",va="center",color="#0F172A",fontsize=13,fontweight="bold")
        for i,lbl in enumerate(["HIGH conf\nstored","MED conf\nstored","LOW conf\nstored"],1):
            ax2.bar([i],[0],color=GREEN_C,width=0.5,edgecolor=BG)
            ax2.text(i,N_TOTAL*.02,"0 (0%)",ha="center",color=GREY_C,fontsize=9)
        ax2.set_xticks([0,1,2,3])
        ax2.set_xticklabels(["ai_naics_enrichment\n_metadata fact","HIGH conf\nstored","MED conf\nstored","LOW conf\nstored"],color=SUBTEXT,fontsize=8.5)
        ax2.set_ylabel("Business Count",color=SUBTEXT); ax2.tick_params(colors=SUBTEXT)
        ax2.set_title("Q2: Was AI confidence/reasoning saved?\n(source: ai_naics_enrichment_metadata fact)",color=TEXT_COL,fontsize=10)
        for sp in ax2.spines.values(): sp.set_edgecolor(GRID_COL)
        ax2.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax2.set_axisbelow(True); ax2.set_ylim(0,N_TOTAL*1.22)
        ax2.text(0.5,0.97,"NO — metadata fact NEVER written (Gap G4)",
                 transform=ax2.transAxes,ha="center",va="top",color=RED_C,fontsize=10,fontweight="bold")
        plt.tight_layout(); return fig_to_img(fig)

    def _chart_recovery():
        fig, ax = plt.subplots(figsize=(12, 5), facecolor=BG); ax.set_facecolor(BG)
        cats=["Scenario A\n(vendors have NAICS,\nAI overrode)","Scenario B\n(1-2 vendors\nhave NAICS)",
              "Scenario C\nname-deducible\n(est. 30%)","Scenario C\nweb-findable\n(est. 20%)",
              "Scenario C\ngenuinely hard\n(est. 50%)","Scenarios D/E/F\n(other causes)"]
        vals=[0,0,1604,1069,2675,1]
        cols=[AMBER_C,BLUE_C,TEAL_C,TEAL_C,RED_C,GREY_C]
        bars=ax.bar(range(6),vals,color=cols,width=0.62,edgecolor=BG)
        for bar,val in zip(bars,vals):
            if val>0: ax.text(bar.get_x()+bar.get_width()/2,bar.get_height()+N_TOTAL*.01,
                              f"{val:,}\n({100*val//N_TOTAL}%)",ha="center",color=TEXT_COL,fontsize=9.5,fontweight="bold")
        ax.set_xticks(range(6)); ax.set_xticklabels(cats,fontsize=8.5,color=SUBTEXT)
        ax.set_ylabel("Business Count",color=SUBTEXT)
        ax.set_title("Classification of 561499 Businesses by Recovery Category",color=TEXT_COL,fontsize=12,fontweight="bold")
        ax.tick_params(colors=SUBTEXT)
        for sp in ax.spines.values(): sp.set_edgecolor(GRID_COL)
        ax.yaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax.set_axisbelow(True); ax.set_ylim(0,N_TOTAL*1.18)
        legend_patches=[mpatches.Patch(color=AMBER_C,label="Recoverable: fix AI override logic"),
                        mpatches.Patch(color=BLUE_C,label="Recoverable: apply vendor code directly"),
                        mpatches.Patch(color=TEAL_C,label="Recoverable: name keywords + web search"),
                        mpatches.Patch(color=RED_C,label="Accept 561499 (correct — fix description only)"),
                        mpatches.Patch(color=GREY_C,label="Other / edge cases")]
        ax.legend(handles=legend_patches,facecolor=GRID_COL,labelcolor=TEXT_COL,fontsize=8.5,loc="upper right",edgecolor="none")
        plt.tight_layout(); return fig_to_img(fig)

    def _chart_gaps():
        fig, ax = plt.subplots(figsize=(11, 4.5), facecolor=BG); ax.set_facecolor(BG)
        gaps=["G6: Pipeline B also null","G5: MCC description (UX)","G4: AI metadata not stored",
              "G3: No name keyword logic","G2: No web search enabled","G1: Entity match failure"]
        counts=[5349,5349,5349,1604,1069,5348]
        clrs=[GREY_C,AMBER_C,GREY_C,TEAL_C,TEAL_C,RED_C]
        bars=ax.barh(range(6),counts,color=clrs,height=0.55,edgecolor=BG)
        for bar,val in zip(bars,counts):
            ax.text(bar.get_width()+40,bar.get_y()+bar.get_height()/2,
                    f"{val:,}",va="center",color=TEXT_COL,fontsize=9.5,fontweight="bold")
        ax.set_yticks(range(6)); ax.set_yticklabels(gaps,color=TEXT_COL,fontsize=9.5)
        ax.set_xlabel("Businesses Affected",color=SUBTEXT,fontsize=9.5)
        ax.set_title("Confirmed Pipeline Gaps — Businesses Affected",color=TEXT_COL,fontsize=12,fontweight="bold")
        ax.tick_params(colors=SUBTEXT)
        for sp in ax.spines.values(): sp.set_edgecolor(GRID_COL)
        ax.xaxis.grid(True,color=GRID_COL,linewidth=0.6,linestyle="--"); ax.set_axisbelow(True); ax.set_xlim(0,N_TOTAL*1.18)
        plt.tight_layout(); return fig_to_img(fig, w=9.0)

    # ── page routing ────────────────────────────────────────────────
    if naics_page == "📊 Executive Summary":
        sh("⚠️  NAICS/MCC 561499 — Executive Summary (Real Production Data, April 2026)")

        card("""<b>What the customer currently sees for 5,349 businesses:</b><br><br>
        &nbsp;&nbsp;Industry Name: Administrative and Support and Waste Management Services<br>
        &nbsp;&nbsp;NAICS Code: <b>561499</b> — All Other Business Support Services<br>
        &nbsp;&nbsp;MCC Code: <b>5614</b><br>
        &nbsp;&nbsp;MCC Description: <em>"Fallback MCC per instructions (no industry evidence...)"</em><br><br>
        <b>This internal debug text is visible to customers. It reveals system implementation details.
        It should say: "Classification pending — insufficient public data available."</b>
        """, "card-red")

        c1,c2,c3,c4,c5 = st.columns(5)
        with c1: st.markdown(styled_metric("Total Businesses\nwith 561499","5,349",RED_C), unsafe_allow_html=True)
        with c2: st.markdown(styled_metric("Dominant Root Cause","99.98%\nZero vendor signals",RED_C), unsafe_allow_html=True)
        with c3: st.markdown(styled_metric("AI Was Fact Engine Winner","2,381\n(44.5%)",AMBER_C), unsafe_allow_html=True)
        with c4: st.markdown(styled_metric("Recoverable (P1+P2)","~2,673\n(~50%)",TEAL_C), unsafe_allow_html=True)
        with c5: st.markdown(styled_metric("561499 IS Correct For","~2,675\n(~50%)",GREY_C), unsafe_allow_html=True)

        st.markdown("---")
        img, w = _chart_scenario()
        st.image(img, caption="Figure 1 — Root-cause scenario distribution. Scenario C dominates at 99.98%. Scenarios A/B/D/F are zero — not observed in production.")

        st.markdown("---")
        card("""<b>Critical Insight:</b> The entire 561499 problem is caused by one failure —
        entity matching does not find vendor records (ZI/EFX/OC) for these 5,349 businesses.
        Once the AI enrichment fires with no vendor data and no website, it correctly follows
        its prompt: <em>"return 561499 as last resort."</em><br><br>
        <b>The XGBoost consensus model CANNOT help here — it has no vendor inputs to read.</b><br>
        The highest-impact fixes are prompt changes to aiNaicsEnrichment.ts, not model changes.
        """, "card-purple")

        st.markdown("### Key Numbers")
        data = {
            "Metric": ["Total 561499 businesses","Root cause: zero vendor signals","Edge case: AI not triggered",
                       "Scenarios A/B/D/F (other)","AI was winning source","AI metadata fact empty",
                       "AI hallucination rate","Pipeline B also null","Recoverable via name keywords",
                       "Recoverable via web search","Genuinely unclassifiable (561499 correct)"],
            "Value": ["5,349","5,348 (99.98%)","1 (0.02%)","0 (0.00%)","2,381 (44.5%)",
                      "5,349 (100%)","0 (0.00%)","5,349 (100%)","~1,604 (~30%)",
                      "~1,069 (~20%)","~2,675 (~50%)"],
            "Interpretation": [
                "7.7% of all businesses in production","No ZI, EFX, or OC match found",
                "Fact Engine already had ≥3 sources; winner had no NAICS",
                "NOT observed in production","AI ran and returned 561499 as last resort",
                "ai_naics_enrichment_metadata fact never written (Gap G4)",
                "AI returned valid 561499 — no hallucination","Pipeline B: primary_naics_code = NULL",
                "Name clearly indicates industry (salon, church, restaurant…)",
                "Open web search would find info","Holding companies, shells, no public footprint"],
        }
        st.dataframe(pd.DataFrame(data), use_container_width=True, hide_index=True)

    elif naics_page == "🔍 Root-Cause Analysis":
        sh("🔍 Root-Cause Analysis — Scenario Distribution & Vendor Signals")
        img, w = _chart_scenario()
        st.image(img, caption="Figure 1 — Scenario distribution. Scenario C (zero vendor NAICS) = 99.98%.")
        st.markdown("---")
        img2, w2 = _chart_vendor()
        st.image(img2, caption="Figure 2 — Vendor signal breakdown. 5,348 businesses have zero vendor NAICS. Pipeline B also shows null for all 5,349.")

        st.markdown("---")
        st.markdown("### Scenario Definitions")
        scenario_table = """<table class="t">
        <tr><th>Scenario</th><th>Code</th><th>Count</th><th>%</th><th>Description</th><th>Finding</th></tr>
        <tr><td>C</td><td>no_vendor_naics_ai_blind</td><td>5,348</td><td>99.98%</td>
            <td>Zero vendors have NAICS. AI fired with only name+address.</td>
            <td><b style="color:#F87171;">DOMINANT</b> — entity matching found no vendor record</td></tr>
        <tr><td>E</td><td>ai_not_triggered</td><td>1</td><td>0.02%</td>
            <td>AI not triggered (≥3 sources). Winner had no NAICS.</td>
            <td>Edge case — investigate via request_response</td></tr>
        <tr><td>A</td><td>all_vendors_have_naics</td><td>0</td><td>0%</td>
            <td>All vendors agree; AI overrode.</td>
            <td><b style="color:#6EE7B7;">Not observed</b> — hypothesis disproven</td></tr>
        <tr><td>B</td><td>some_vendors_have_naics</td><td>0</td><td>0%</td>
            <td>1-2 vendors have NAICS; AI ignored.</td>
            <td><b style="color:#6EE7B7;">Not observed</b></td></tr>
        <tr><td>D</td><td>ai_hallucinated</td><td>0</td><td>0%</td>
            <td>AI returned invalid NAICS code; stripped.</td>
            <td><b style="color:#6EE7B7;">Not observed</b></td></tr>
        <tr><td>F</td><td>winner_has_naics_not_stored</td><td>0</td><td>0%</td>
            <td>Winner had NAICS but not stored.</td>
            <td><b style="color:#6EE7B7;">Not observed</b></td></tr>
        </table>"""
        st.markdown(scenario_table, unsafe_allow_html=True)

        card("""<b>Critical finding:</b> Scenarios A, B, D, and F — previously hypothesised as
        possible contributors — are ALL absent from production data. The 561499 problem is
        explained entirely by one root cause: entity matching finds no vendor record.
        The fix strategy must target entity matching coverage and AI prompt improvement,
        NOT the consensus layer or XGBoost model.""", "card-red")

    elif naics_page == "📡 Vendor Signal Deep Dive":
        sh("📡 Vendor Signal Deep Dive — Why All Vendors Return Nothing")

        st.markdown("### Why Vendors Have No Record for These Businesses")
        reasons = {
            "Business Type": ["Very new registrations","Sole proprietors / micro-businesses",
                              "Holding companies / shells","Businesses registered under DBA"],
            "Est. %": ["15-20%","20-25%","10-15%","10-15%"],
            "ZI/EFX Coverage": ["Not yet in bulk data","Often absent","Sometimes present","Usually not matched"],
            "OC Coverage": ["Sometimes indexed","Rarely","Sometimes","Rarely"],
            "Recoverable?": ["🟡 Web search","🟡 Name keywords","🔴 561499 correct","🟡 Normalisation fix"],
        }
        st.dataframe(pd.DataFrame(reasons), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("### Entity Matching Architecture")
        st.code("""Business name + address submitted
         │
         ▼
Levenshtein / trigram similarity scoring
→ Find candidate records in vendor bulk data
  (zoominfo.comp_standard_global,
   warehouse.equifax_us_latest,
   warehouse.oc_companies_latest)
         │
         ▼
XGBoost entity-matching model (entity_matching_20250127 v1)
→ 26 pairwise text+address similarity features
→ Output: match.index (0–55) → confidence = match.index / 55
         │
         ├─ confidence ≥ threshold → vendor match ACCEPTED → ALL vendor data used
         │
         └─ confidence < threshold OR no candidate found at all
               → NO vendor data for this business
               → naics_code from this vendor = NULL
               → THIS IS WHAT HAPPENS FOR ALL 5,349 BUSINESSES
         │
         ▼
For 5,348/5,349 businesses:
  zoominfo_matches: NO ROW
  efx_matches:      NO ROW
  oc_matches:       NO ROW
  → NAICS validOptions = []
  → AI enrichment fires (minimumSources=1 not met)""", language=None)

        st.markdown("---")
        st.markdown("### Pipeline B Cross-Check (Confirmation)")
        card("""<b>Pipeline B (customer_files) result for all 5,349 businesses:</b><br><br>
        <code>WHEN COALESCE(zi_match_confidence,0) > COALESCE(efx_match_confidence,0)
        &nbsp;&nbsp;THEN zi_c_naics6
        ELSE efx_primnaicscode</code><br><br>
        For these businesses: zi_match_confidence = 0 AND efx_match_confidence = 0<br>
        → primary_naics_code = NULL (Pipeline B has no AI fallback)<br><br>
        <b>This confirms: entity matching failure is total across BOTH pipelines.</b>
        """, "card-teal")

    elif naics_page == "🤖 AI Enrichment Behaviour":
        sh("🤖 AI Enrichment (GPT-5-mini) Behaviour for 561499 Businesses")
        img, w = _chart_ai()
        st.image(img, caption="Figure 3 — AI Enrichment: two questions, two answers. LEFT: AI ran for 2,381+ businesses (confirmed by winning platformId). RIGHT: AI metadata fact was NEVER written for any of the 5,349 businesses (Gap G4).")

        st.markdown("---")
        card("""<b>⚠️ Important distinction: "AI metadata empty (100%)" ≠ "AI never ran"</b><br><br>
        The ai_naics_enrichment_metadata FACT was not written for any of the 5,349 businesses (Gap G4).<br>
        This does NOT mean AI never ran — the ai_was_winner flag confirms AI ran for 2,381 businesses.<br><br>
        The AI produced confidence and reasoning, but the code path that saves them as a structured fact
        was not triggered for 561499 return cases. The raw response IS in integration_data.request_response
        (platform_id=31) but requires JSON parsing to access.
        """, "card-amber")

        st.markdown("### What AI Receives for 561499 Businesses")
        st.code("""GPT-5-mini receives:
  ✅ business_name  (from applicant onboarding form)
  ✅ primary_address (from applicant onboarding form)
  ❌ naics_code: null  (no vendor produced one)
  ❌ website: null     (not provided; SERP may not have found URL)
  ❌ ZI/EFX/OC NAICS codes NOT included in prompt

System prompt instruction (aiNaicsEnrichment.ts ~line 114):
  "If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."

AI result:
  naics_code = "561499"
  mcc_code   = "5614"
  confidence = "LOW"  ← produced but NEVER SAVED to facts (Gap G4)
  mcc_description = "Fallback MCC per instructions..." ← shown to customers (Gap G5)

Post-processing (executePostProcessing):
  validateNaicsCode("561499")
  → 561499 EXISTS in core_naics_code → accepted (NOT stripped by removeNaicsCode)
  → ai_naics_enrichment_metadata fact NOT written""", language=None)

        st.markdown("### Why AI Cannot Do Better Without Fixes P1-P2")
        thtml = """<table class="t"><tr><th>Gap</th><th>What's missing</th><th>Impact</th><th>Fix</th></tr>
        <tr><td>G2</td><td>web_search only enabled when website URL is known.<br>For zero-vendor businesses: web_search is blocked.</td>
            <td>~1,069 businesses (20%) could be classified via web search</td>
            <td>Enable unrestricted web_search in getPrompt() when website=null</td></tr>
        <tr><td>G3</td><td>AI prompt has no name keyword step before returning 561499.<br>"Lisa's Nail Salon" → 561499 even though name = NAICS 812113.</td>
            <td>~1,604 businesses (30%) have name-deducible industry</td>
            <td>Add STEP 1 to system prompt: check name keywords first</td></tr>
        <tr><td>G4</td><td>ai_naics_enrichment_metadata fact not written for 561499 returns.</td>
            <td>Cannot monitor quality or track improvement</td>
            <td>Always write metadata fact in executePostProcessing()</td></tr>
        <tr><td>G5</td><td>"Fallback MCC per instructions..." shown to customers.</td>
            <td>All 5,349 businesses see this internal debug text</td>
            <td>Change to "Classification pending — insufficient public data available."</td></tr>
        </table>"""
        st.markdown(thtml, unsafe_allow_html=True)

    elif naics_page == "🔧 Gap Analysis & Roadmap":
        sh("🔧 Gap Analysis, Fix Roadmap & Implementation Plan (Sections 12–14)")

        tab_gap, tab_road, tab_impl, tab_conc = st.tabs([
            "🔍 Confirmed Gaps (G1-G6)",
            "📋 Prioritised Fix Roadmap (P1-P6)",
            "🛠️ Implementation Plan",
            "✅ Conclusions & Reframe",
        ])

        # ── TAB 1: Confirmed Gaps ────────────────────────────────────────
        with tab_gap:
            img, w = _chart_gaps()
            st.image(img, caption="Figure 4 — Confirmed gaps by businesses affected. G1, G4, G5, G6 affect all 5,349. G3 affects ~1,604 recoverable. G2 affects ~1,069 recoverable.")
            img2, w2 = _chart_recovery()
            st.image(img2, caption="Figure 5 — Recovery potential by category. ~50% recoverable with P1+P2. ~50% should permanently remain as 561499.")

            st.markdown("---")
            st.markdown("### G1 — Entity Matching Finds No Vendor Record")
            card("""<b>Root cause of 99.98% of all 561499 cases.</b><br><br>
            The heuristic similarity scoring (Levenshtein) and XGBoost entity-matching model
            (entity_matching_20250127 v1) found no vendor record for these 5,348 businesses.
            No candidate in ZoomInfo, Equifax, or OpenCorporates matched above the minimum threshold.<br><br>
            <b>Why matching fails:</b><br>
            • New registrations not yet in ZI/EFX/OC bulk data (loaded on scheduled cadence)<br>
            • Micro-businesses / sole proprietors not in commercial databases<br>
            • Generic/ambiguous names ("Global Holdings LLC") scoring below threshold<br>
            • Address normalisation failures preventing Levenshtein similarity match<br>
            • Recently renamed businesses (name changed after bulk data loaded)<br><br>
            <b>Tables with missing data:</b><br>
            <code>datascience.zoominfo_matches_custom_inc_ml</code> — NO ROW<br>
            <code>datascience.efx_matches_custom_inc_ml</code> — NO ROW<br>
            <code>datascience.oc_matches_custom_inc_ml</code> — NO ROW<br>
            <code>datascience.customer_files.primary_naics_code</code> = NULL<br><br>
            <b>Pipeline:</b> Both A and B
            """, "card-red")

            st.markdown("### G2 — AI web_search Blocked When No Website Provided")
            card("""<b>~1,069 businesses (20% of Scenario C) recoverable if fixed.</b><br><br>
            In <code>aiNaicsEnrichment.ts getPrompt()</code>, the web_search tool is only enabled
            when a website URL is already known (<code>params.website</code> is set).
            For businesses with no vendor match and no website URL, the AI receives only
            business_name + address and cannot search the web.
            GPT-5-mini has web_search capability but it is blocked by the current code path.<br><br>
            <b>Tables affected:</b><br>
            <code>integration_data.request_response</code> — AI stored (web_search not used)<br>
            <code>rds_warehouse_public.facts</code> — naics_code = "561499"<br><br>
            <b>Pipeline:</b> Pipeline A only (AI enrichment step)
            """, "card-amber")

            st.markdown("### G3 — AI Prompt Has No Name Keyword Classification Step")
            card("""<b>~1,604 businesses (30% of Scenario C) recoverable if fixed.</b><br><br>
            The AI system prompt instructs: <em>"If there is no evidence at all, return naics_code
            561499 and mcc_code 5614 as a last resort."</em><br>
            It does NOT instruct the AI to check business name keywords (salon, restaurant, church,
            dental, etc.) before giving up.<br><br>
            A business named "Lisa's Nail Salon" receives 561499 even though the name
            unambiguously indicates NAICS 812113 (Nail Salons).<br><br>
            <b>Examples of recoverable businesses:</b><br>
            "Lisa's Nail Salon" → 812113 (Nail Salons)<br>
            "First Baptist Church" → 813110 (Religious Organizations)<br>
            "Tony's Pizza" → 722511 (Full-Service Restaurants)<br>
            "ABC Dental Care" → 621210 (Offices of Dentists)<br>
            "Mike's Plumbing & Electric" → 238210 (Electrical Contractors)<br><br>
            <b>Tables affected:</b> <code>rds_warehouse_public.facts</code> — naics_code = "561499" despite name indicating sector<br>
            <b>Pipeline:</b> Pipeline A only (AI enrichment prompt)
            """, "card-amber")

            st.markdown("### G4 — AI Enrichment Metadata Not Stored for Fallback Cases")
            card("""<b>All 5,349 businesses affected — critical monitoring gap.</b><br><br>
            The <code>ai_naics_enrichment_metadata</code> fact is not written when AI returns 561499.
            For all 5,349 businesses, ai_confidence, ai_reasoning, and ai_website_summary
            are empty — the diagnostic shows ai_confidence_level = '' for 100% of cases.<br><br>
            The raw response IS stored in <code>integration_data.request_response</code> (platform_id=31)
            but the structured metadata fact is never written. This prevents quality monitoring
            and makes it impossible to track AI improvement.<br><br>
            <b>Tables affected:</b><br>
            <code>rds_warehouse_public.facts</code> — ai_naics_enrichment_metadata: NOT WRITTEN<br>
            <code>integration_data.request_response</code> — raw stored (recoverable via JSON parse)<br><br>
            <b>Pipeline:</b> Pipeline A (post-processing step)
            """, "card-amber")

            st.markdown("### G5 — MCC Fallback Description Is Customer-Facing Internal Text")
            card("""<b>All 5,349 businesses show this internal debug text to customers.</b><br><br>
            The AI system prompt produces:<br>
            <em>"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)"</em><br><br>
            This internal system note is displayed directly to customers in the admin portal.
            It reveals internal implementation details and provides no useful information
            about what the business actually does or why classification failed.<br><br>
            <b>Should be replaced with:</b> "Classification pending — insufficient public data available."<br><br>
            <b>Tables affected:</b> <code>rds_warehouse_public.facts</code> — mcc_description stores internal debug text visible to customers<br>
            <b>Pipeline:</b> Pipeline A (AI enrichment prompt output)
            """, "card-red")

            st.markdown("### G6 — Pipeline B Also Has No NAICS — Confirms Complete Failure")
            card("""<b>All 5,349 businesses confirmed in Pipeline B also.</b><br><br>
            Pipeline B (<code>customer_table.sql</code>) applies the ZI vs EFX winner rule:
            <code>WHEN zi_match_confidence > efx_match_confidence THEN ZI NAICS ELSE EFX NAICS</code><br><br>
            For these 5,349 businesses, BOTH zi_match_confidence = 0 AND efx_match_confidence = 0
            because neither ZI nor EFX entity matching found a record.
            Pipeline B's <code>customer_files.primary_naics_code</code> = NULL for all 5,349.<br><br>
            This confirms the entity-matching failure is complete across both pipelines.
            There is no discrepancy — both pipelines see the same empty match tables.<br><br>
            <b>Pipeline:</b> Pipeline B (batch Redshift)
            """, "card-amber")

        # ── TAB 2: Fix Roadmap ───────────────────────────────────────────
        with tab_road:
            st.markdown("### Prioritised Fix Roadmap — P1 to P6")
            card("""<b>Ordering principle:</b> Fixes are ranked by business impact per effort.
            P1-P3 are all prompt-level changes to <code>aiNaicsEnrichment.ts</code> requiring zero
            model changes, zero new infrastructure, and minimal engineering time.
            They have the highest return on investment of any option available.
            """)

            FIXES = [
                {
                    "id": "P1", "colour": GREEN_C, "effort_colour": GREEN_C,
                    "title": "Name Keyword → NAICS in AI Prompt",
                    "gaps": "G3", "recovered": "~1,604 businesses (30%)",
                    "effort": "Very Low — string change in AI prompt",
                    "file": "aiNaicsEnrichment.ts: getPrompt() system prompt",
                    "description": (
                        "Add a STEP 1 to the AI system prompt: before returning 561499, "
                        "check if the business name contains industry keywords and classify from those. "
                        "The consensus.py module already has 80+ keyword-to-NAICS mappings that can be used as reference."
                    ),
                    "example_keywords": [
                        "nail / salon / spa / beauty → 812113 or 812112",
                        "restaurant / pizza / cafe / diner / grill → 722511",
                        "dental / dentist / orthodont → 621210",
                        "church / ministry / chapel / temple / mosque → 813110",
                        "construction / contractor / plumb / electrician / hvac → 238XXX",
                        "attorney / law firm / legal → 541110",
                        "landscap / lawn / garden → 561730",
                        "daycare / childcare / preschool → 624410",
                        "auto repair / mechanic / tire → 811111",
                        "pharmacy / drug store → 446110",
                    ],
                },
                {
                    "id": "P2", "colour": TEAL_C, "effort_colour": GREEN_C,
                    "title": "Enable Open Web Search for Zero-Vendor Businesses",
                    "gaps": "G2", "recovered": "~535–1,069 businesses (10–20%)",
                    "effort": "Low — 3 lines of TypeScript in getPrompt()",
                    "file": "aiNaicsEnrichment.ts: getPrompt()",
                    "description": (
                        "When website=null AND no vendor NAICS exists, enable unrestricted web_search. "
                        "GPT-5-mini already has the web_search tool — it is just blocked by the current code. "
                        "A search for '[business name] [city] [state]' would find Google Maps listings, "
                        "LinkedIn pages, SOS filings, and other public information for ~20% of these businesses."
                    ),
                    "example_keywords": [],
                },
                {
                    "id": "P3", "colour": BLUE_C, "effort_colour": GREEN_C,
                    "title": "Fix MCC Description Message",
                    "gaps": "G5", "recovered": "5,349 businesses — UX fix (no NAICS change)",
                    "effort": "Very Low — string change in AI prompt",
                    "file": "aiNaicsEnrichment.ts: system prompt ~line 114",
                    "description": (
                        'Replace "Fallback MCC per instructions (no industry evidence to determine '
                        'canonical MCC description)" with "Classification pending — insufficient '
                        'public data available." This removes internal debug text from customer-facing output '
                        'and provides honest, useful language about why classification is unavailable.'
                    ),
                    "example_keywords": [],
                },
                {
                    "id": "P4", "colour": PURPLE_C, "effort_colour": AMBER_C,
                    "title": "Store AI Enrichment Metadata Even for Fallback Cases",
                    "gaps": "G4", "recovered": "0 businesses recovered — enables monitoring",
                    "effort": "Low — TypeScript change to save the fact",
                    "file": "aiNaicsEnrichment.ts: executePostProcessing()",
                    "description": (
                        "When AI returns 561499, still write the ai_naics_enrichment_metadata fact "
                        "with confidence, reasoning, and tools_used. This enables:\n"
                        "• Quality monitoring over time as prompts improve\n"
                        "• Identifying businesses for re-enrichment after P1/P2 are deployed\n"
                        "• Tracking which businesses improved from 561499 to a real code\n"
                        "• Diagnosing why specific businesses received 561499"
                    ),
                    "example_keywords": [],
                },
                {
                    "id": "P5", "colour": AMBER_C, "effort_colour": RED_C,
                    "title": "Improve Entity Matching Coverage",
                    "gaps": "G1, G6", "recovered": "Unknown — depends on implementation scope",
                    "effort": "Medium-High — data engineering + model retraining",
                    "file": "smb_zoominfo/equifax_standardized_joined.sql + entity_matching_20250127 v1",
                    "description": (
                        "Four approaches to improve how many businesses get matched to a vendor record:\n"
                        "(a) Increase ZI/EFX bulk data refresh frequency (currently scheduled, not real-time)\n"
                        "(b) Add DBA name as an additional matching field alongside legal name\n"
                        "(c) Add Liberty data which covers more micro-businesses and sole proprietors\n"
                        "(d) Lower the minimum similarity_index threshold cautiously, monitoring false-positive rate"
                    ),
                    "example_keywords": [],
                },
                {
                    "id": "P6", "colour": GREY_C, "effort_colour": AMBER_C,
                    "title": "Deploy consensus.py + XGBoost API (Future-Proofing)",
                    "gaps": "None now — future Scenario B", "recovered": "0 now; future Scenario B businesses",
                    "effort": "Medium — TypeScript integration of Python API",
                    "file": "aiNaicsEnrichment.ts: executeDeferrableTask() + naics_mcc_classifier/api.py",
                    "description": (
                        "When vendor matches DO exist (after P5 improves entity matching coverage), "
                        "the consensus layer (OC=0.9 > ZI=0.8 > EFX=0.7) applies them directly "
                        "without AI enrichment. Currently Scenario B businesses (vendors have NAICS but disagree) "
                        "are 0% of the fallback population — but this will grow as P5 improves coverage. "
                        "The consensus.py and api.py modules are already built and ready to deploy."
                    ),
                    "example_keywords": [],
                },
            ]

            for fix in FIXES:
                c = fix["colour"]
                with st.expander(f"**{fix['id']}** — {fix['title']}  ·  {fix['recovered']}  ·  Effort: {fix['effort'].split(' — ')[0]}"):
                    col1, col2 = st.columns([2, 1])
                    with col1:
                        st.markdown(f"**Description:**")
                        st.markdown(fix["description"])
                        if fix["example_keywords"]:
                            st.markdown("**Example keyword mappings:**")
                            for kw in fix["example_keywords"]:
                                st.markdown(f"&nbsp;&nbsp;• {kw}")
                    with col2:
                        st.markdown(
                            f'<div class="card" style="border-left-color:{c};background:#0E1E38;">'
                            f'<div style="color:{c};font-size:1.6rem;font-weight:900;">{fix["id"]}</div>'
                            f'<div style="color:#E2E8F0;font-weight:600;margin-top:4px;">{fix["title"]}</div>'
                            f'<hr style="border-color:#1E3A5F;margin:8px 0;">'
                            f'<div style="font-size:.8rem;color:#94A3B8;">Gaps addressed</div>'
                            f'<div style="color:{c};font-weight:600;">{fix["gaps"]}</div>'
                            f'<div style="font-size:.8rem;color:#94A3B8;margin-top:6px;">Est. businesses recovered</div>'
                            f'<div style="color:#E2E8F0;font-size:.85rem;">{fix["recovered"]}</div>'
                            f'<div style="font-size:.8rem;color:#94A3B8;margin-top:6px;">Effort</div>'
                            f'<div style="color:{fix["effort_colour"]};font-size:.85rem;">{fix["effort"]}</div>'
                            f'<div style="font-size:.8rem;color:#94A3B8;margin-top:6px;">File</div>'
                            f'<div style="font-family:Courier New;font-size:.75rem;color:#93C5FD;">{fix["file"]}</div>'
                            f'</div>', unsafe_allow_html=True)

        # ── TAB 3: Implementation Plan ───────────────────────────────────
        with tab_impl:
            st.markdown("### P1 + P3: AI System Prompt Changes (Highest ROI)")
            card("These two fixes require <b>only string changes</b> to the AI system prompt in "
                 "<code>integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts</code>. "
                 "No TypeScript logic changes, no new infrastructure, no model retraining.")

            st.markdown("**BEFORE** (current system prompt ~line 114):")
            st.code('"If there is no evidence at all, return naics_code 561499 and mcc_code 5614 as a last resort."',
                    language=None)

            st.markdown("**AFTER** (updated system prompt — P1 + P3 combined):")
            st.code(""""CLASSIFICATION RULES — follow these steps IN ORDER before returning 561499:

STEP 1: Check business name keywords.
  If the name clearly indicates an industry, classify from name with MED confidence:
    nail/salon/spa/beauty        → 812113 (Nail Salons) or 812112 (Beauty Salons)
    restaurant/pizza/cafe/diner  → 722511 (Full-Service Restaurants)
    dental/dentist/orthodont     → 621210 (Offices of Dentists)
    church/ministry/chapel/temple/mosque/fellowship → 813110 (Religious Organizations)
    construction/contractor/hvac/roofing/plumb/electrician → 238XXX (Specialty Contractors)
    attorney/law firm/legal      → 541110 (Offices of Lawyers)
    landscap/lawn/garden         → 561730 (Landscaping Services)
    daycare/childcare/preschool  → 624410 (Child Day Care Services)
    auto repair/mechanic/tire    → 811111 (General Automotive Repair)
    pharmacy/drug store          → 446110 (Pharmacies and Drug Stores)
  If matched: return that NAICS code with confidence=MED.

STEP 2: If website is not provided, search the web.
  Use web_search to find: "[business name] [city] [state]"
  If results found: classify based on the website/listing content.

STEP 3: Only return naics_code 561499 if ALL of the following are true:
  - No vendor NAICS codes available
  - Business name contains no industry-specific keywords
  - Web search found no public information
  - Name is genuinely ambiguous (holding company, investment group, etc.)

STEP 4: When returning MCC 5614, set mcc_description to:
  "Classification pending - insufficient public data available."
  (NOT "Fallback MCC per instructions...")""", language=None)

            st.markdown("---")
            st.markdown("### P2: Enable Web Search for Zero-Vendor Businesses")
            card("Add this block to <code>aiNaicsEnrichment.ts getPrompt()</code> BEFORE the existing website check:")
            st.code("""// ADD this block in getPrompt() — enables open web search when no vendor data
const hasVendorNaics = params.naics_code && params.naics_code !== "561499";
const hasWebsite = !!params.website;

if (!hasVendorNaics && !hasWebsite) {
  // Zero-evidence case: enable unrestricted web search
  responseCreateWithInput.input.push({
    role: "system",
    content: `Since no vendor data is available for this business, ` +
             `search the web for "${params.business_name} ` +
             `${params.state}" to find any public information.`
  });
  // Ensure web_search tool is enabled
  if (!responseCreateWithInput.tools) {
    responseCreateWithInput.tools = [{ type: "web_search", search_context_size: "medium" }];
    responseCreateWithInput.tool_choice = "auto";
  }
}
// EXISTING website-based search still runs when params.website is set""", language="typescript")

            st.markdown("---")
            st.markdown("### P4: Always Store AI Enrichment Metadata")
            st.code("""// In aiNaicsEnrichment.ts — ensure metadata is saved even for 561499 returns
// In executePostProcessing() or wherever facts are written after AI response:

const enrichmentMetadata = {
  naics_returned:  response.naics_code,
  mcc_returned:    response.mcc_code,
  confidence:      response.confidence,
  reasoning:       response.reasoning,
  website_summary: response.website_summary ?? null,
  tools_used:      response.tools_used ?? [],
  is_fallback:     response.naics_code === "561499",
  timestamp:       new Date().toISOString(),
};

// Write regardless of whether naics_code is 561499:
await this.saveFactToWarehouse(
  "ai_naics_enrichment_metadata",
  JSON.stringify(enrichmentMetadata),
  31,  // platform_id = AI
);
// This writes to: rds_warehouse_public.facts
// name="ai_naics_enrichment_metadata"
// Enables quality monitoring via diagnostic queries""", language="typescript")

            st.markdown("---")
            st.markdown("### Expected Outcomes After Each Fix Phase")
            outcomes = {
                "Metric": [
                    "Businesses with genuine 561499 (correct classification)",
                    "Businesses with 561499 due to missing name keyword logic",
                    "Businesses with 561499 due to blocked web search",
                    "Total 561499 businesses",
                    'MCC "Fallback MCC per instructions" message shown',
                    "AI enrichment metadata stored in facts",
                    "Entity matching coverage",
                    "XGBoost consensus model active",
                ],
                "Current": ["~2,675","~1,604","~1,069","5,349","5,349 businesses","~0%","baseline","not deployed"],
                "After P1+P2+P3": ["~2,675","~0 (name keywords applied)","~535 (50% web success est.)","~3,210 (-40%)","0 (message fixed)","~0%","baseline","not deployed"],
                "After P1-P4": ["~2,675","~0","~535","~3,210 (-40%)","0","~100%","baseline","not deployed"],
                "After P1-P6": ["~2,675","~0","~535","~3,210 (-40%)","0","~100%","improved (P5)","deployed (P6)"],
            }
            st.dataframe(pd.DataFrame(outcomes), use_container_width=True, hide_index=True)

        # ── TAB 4: Conclusions ───────────────────────────────────────────
        with tab_conc:
            st.markdown("### Four Key Conclusions from the Real Data Analysis")

            card("""<b>CONCLUSION 1: The 561499 problem is fully understood and confirmed by production data.</b><br><br>
            5,349 businesses (7.7%) show NAICS 561499. 99.98% (5,348) have one root cause:
            zero vendor NAICS signals — ZoomInfo, Equifax, and OpenCorporates all failed
            to match these businesses in entity matching.
            The AI correctly followed its system prompt and returned 561499 as the last resort.
            This is a coverage gap in entity matching, not an AI failure.
            """, "card-green")

            card("""<b>CONCLUSION 2: The highest-impact fixes require NO model changes and NO new infrastructure.</b><br><br>
            Fixes P1 (name keyword classification) and P3 (MCC description) are string changes
            to the AI system prompt in aiNaicsEnrichment.ts.
            Fix P2 (enable web search) requires 3 lines of TypeScript in getPrompt().
            Together, P1+P2+P3 could recover ~2,673 businesses (50%) and fix the UX issue
            for all 5,349 businesses — with minimal engineering effort and zero infrastructure cost.
            """, "card-green")

            card("""<b>CONCLUSION 3: The XGBoost consensus model is NOT the solution for these 5,349 businesses.</b><br><br>
            The consensus model reads vendor NAICS signals (ZI, EFX, OC).
            For businesses with zero vendor signals, the model has no inputs and cannot predict.
            The model is the correct tool for future Scenario B businesses
            (when vendor matches exist but disagree) — which will emerge as entity matching
            coverage improves after fix P5.<br><br>
            <b>This is confirmed by the production data:</b> Scenarios A and B (where vendors have NAICS)
            are 0% of the fallback population. The consensus model would solve a problem that does not
            currently exist in production.
            """, "card-red")

            card("""<b>CONCLUSION 4: Critical data quality gap — AI enrichment metadata is not stored.</b><br><br>
            The ai_naics_enrichment_metadata fact is empty for all 5,349 businesses.
            We cannot:<br>
            • Monitor AI classification quality over time<br>
            • Track which businesses were re-classified after prompt improvements<br>
            • Identify businesses for re-enrichment as the prompt improves<br>
            • Understand why AI chose 561499 for a specific business<br><br>
            Fix P4 (always store metadata) is critical for long-term system health.
            The raw AI response IS stored in integration_data.request_response (platform_id=31),
            but querying it requires parsing raw JSON rather than reading a structured fact.
            """, "card-amber")

            st.markdown("---")
            st.markdown("### The Important Reframe for Stakeholders")
            card("""<b>Not all 5,349 businesses showing 561499 are "wrong."</b><br><br>
            Approximately 2,675 businesses (~50%) should permanently show NAICS 561499.
            These are holding companies, shell entities, brand-new registrations,
            and businesses with no public footprint. The classification cannot be improved
            for these businesses with available data — 561499 IS the correct answer.<br><br>
            <b>The correct goals for stakeholders:</b><br>
            (a) Reduce 561499 by ~50% (from 5,349 to ~2,675) with P1+P2 fixes<br>
            (b) Ensure 561499 only appears for genuinely unclassifiable businesses<br>
            (c) Replace the misleading MCC description with honest language: "Classification pending — insufficient public data available." (P3)<br>
            (d) Build monitoring capability to track improvement over time (P4)<br>
            (e) Accept that the remaining ~2,675 businesses with 561499 are correctly classified
            """, "card-teal")

            st.markdown("---")
            st.markdown("### Data Sources Used in This Analysis")
            sources_list = [
                ("rds_warehouse_public.facts", "NAICS/MCC codes, winning source platform_id, AI enrichment metadata"),
                ("datascience.zoominfo_matches_custom_inc_ml → zoominfo.comp_standard_global", "NAICS signals from ZoomInfo"),
                ("datascience.efx_matches_custom_inc_ml → warehouse.equifax_us_latest", "NAICS signals from Equifax"),
                ("datascience.oc_matches_custom_inc_ml → warehouse.oc_companies_latest", "NAICS signals from OpenCorporates"),
                ("datascience.customer_files", "Pipeline B NAICS winner (primary_naics_code)"),
                ("integration_data.request_response", "Raw AI enrichment responses (platform_id=31)"),
            ]
            for table, desc in sources_list:
                st.markdown(f"- `{table}` — {desc}")

            st.markdown("### Source Code Files Referenced")
            code_refs = [
                ("aiNaicsEnrichment.ts", "integration-service/lib/aiEnrichment/ — NAICS_OF_LAST_RESORT, removeNaicsCode(), minimumSources, system prompt"),
                ("customer_table.sql", "warehouse-service/datapooler/.../tables/ — Pipeline B winner-takes-all SQL"),
                ("rules.ts", "integration-service/lib/facts/ — factWithHighestConfidence, weightedFactSelector, manualOverride (6 rules)"),
                ("businessDetails/index.ts", "integration-service/lib/facts/ — naics_code source wiring (7 sources)"),
                ("consensus.py", "naics_mcc_classifier/ — 80+ name keyword mappings (reference for P1)"),
                ("diagnostic.py", "naics_mcc_classifier/ — root-cause analysis engine"),
                ("NAICS_MCC_Fallback_RootCause_Analysis.ipynb", "naics_mcc_classifier/ — source of all charts and results"),
            ]
            for f, desc in code_refs:
                st.markdown(f"- `{f}` — {desc}")

    elif naics_page == "💡 Fact Engine Rules (Correct)":
        sh("💡 The 6 Correct Winner-Selection Rules (Pipeline A)")
        card("""This section documents the authoritative rules confirmed from integration-service source code
        (rules.ts, factEngine.ts, aiNaicsEnrichment.ts, businessDetails/index.ts).
        The <b>pipeline_facts.html</b> slide deck was already correct; this view explains them interactively.
        """)

        for rule in PIPELINE_A_NAICS_RULES:
            c = rule["colour"]
            st.markdown(
                f'<div class="card" style="border-left-color:{c};background:#0E1E38;margin-bottom:8px;">'
                f'<div style="display:flex;align-items:center;gap:10px;">'
                f'<span style="font-size:1.4rem;font-weight:900;color:{c};">Rule {rule["number"]}</span>'
                f'<span style="font-weight:700;font-size:1rem;color:#E2E8F0;">{rule["name"]}</span>'
                f'</div>'
                f'<div style="margin-top:6px;color:#CBD5E1;font-size:.9rem;">{rule["description"]}</div>'
                f'<div style="margin-top:6px;font-family:Courier New;font-size:.82rem;'
                f'background:#0A1628;color:{c};padding:5px 8px;border-radius:4px;">'
                f'{rule["formula"]}</div>'
                f'</div>', unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("### Pipeline B — Winner-Takes-All (customer_table.sql)")
        st.code("""-- This one CASE controls EVERY firmographic field:
-- NAICS, employees, revenue, name, address, city, ZIP, country, website...
COALESCE(
    CASE
        WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
            THEN zi_c_naics6        -- ZoomInfo NAICS + ALL ZI data wins
        ELSE efx_primnaicscode      -- Equifax NAICS + ALL EFX data wins
    END,
    naics_code   -- fallback to existing or NULL
) AS primary_naics_code

-- OC, Liberty, Middesk, Trulioo: COMPLETELY IGNORED in Pipeline B
-- Both confidences = 0 → EFX branch → efx_primnaicscode = NULL → primary_naics_code = NULL
-- Pipeline B has NO AI fallback — NULL stays NULL (not replaced with 561499)""", language="sql")

        st.markdown("### naics_code Source Wiring (businessDetails/index.ts)")
        st.code("""naics_code: [
    { source: equifax,         path: "primnaicscode"                              },
    { source: zoominfo,         path: "firmographic.zi_c_naics6"                  },
    { source: opencorporates,   fn: parse industry_code_uids for "us_naics-XXXXXX" },
    { source: serp,             path: "businessLegitimacyClassification.naics_code", weight: 0.3 },
    { source: trulioo (business), fn: extract from standardizedIndustries,         weight: 0.7 },
    { source: businessDetails,  path: "naics_code", schema: /^\\d{6}$/,            weight: 0.2 },
    { source: AINaicsEnrichment, path: "response.naics_code",                      weight: 0.1 },
]

mcc_code_found:     AI direct response → mcc_code from GPT
mcc_code_from_naics: calculated from winning naics_code via rel_naics_mcc table
mcc_code:           foundMcc?.value ?? inferredMcc?.value""", language="typescript")


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SECTION 3 — PIPELINE A & B DEEP DIVE                            ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🔀  Pipeline A & B Deep Dive":

    if pipeline_page == "🗺️  Full Pipeline Map":
        sh("🗺️  Worth AI — Full Pipeline Map (A & B)")

        card("""<b>Two pipelines run in parallel, both reading the same source tables.</b><br>
        They produce different outputs and serve different consumers.<br>
        Understanding which pipeline produced a value is essential for root-cause analysis.
        """)

        cols = st.columns(2)
        with cols[0]:
            st.markdown('<div class="card card-green"><b>🅐 Pipeline A — Real-Time (Integration Service)</b><br>'
                        'Node.js/TypeScript service<br>'
                        'Fires on every business submission<br>'
                        'Calls ALL 6+ vendor sources in parallel<br>'
                        'Has AI enrichment fallback<br>'
                        '<b>Writes to: rds_warehouse_public.facts (JSONB)</b><br>'
                        'Customer sees this output in admin portal<br>'
                        'Produces 200+ facts per business</div>',
                        unsafe_allow_html=True)
        with cols[1]:
            st.markdown('<div class="card card-amber"><b>🅑 Pipeline B — Batch Redshift</b><br>'
                        'Python warehouse-service<br>'
                        'Runs on a scheduled cadence (not real-time)<br>'
                        'Uses ONLY ZoomInfo and Equifax<br>'
                        'Winner-takes-all: ZI vs EFX by match_confidence<br>'
                        '<b>Writes to: datascience.customer_files (wide table)</b><br>'
                        'Used for analytics, reporting, risk model training<br>'
                        'OC / Liberty / Middesk / Trulioo IGNORED</div>',
                        unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("### Side-by-Side Comparison")
        comp = {
            "Dimension": ["Trigger","Speed","Vendor sources","NAICS winner method","MCC fallback",
                          "AI enrichment","Output table","Used by","OC data used?","UK SIC","Update frequency"],
            "Pipeline A": ["Real-time (per submission)","Seconds–minutes","ALL: Middesk, OC, ZI, EFX, Trulioo, SERP, AI",
                           "6 Fact Engine rules (factWithHighestConfidence + tie-break + manual override...)",
                           "AI returns mcc_code OR calculated from NAICS via rel_naics_mcc",
                           "✅ Yes — fires when <1 non-AI NAICS source",
                           "rds_warehouse_public.facts","Customer admin portal, REST API, Worth 360 Report",
                           "✅ Yes — classification_codes from industry_code_uids","✅ Yes (if country=GB)",
                           "Per business, on submission"],
            "Pipeline B": ["Batch (scheduled)","Minutes–hours","ZI and EFX ONLY",
                           "Winner-takes-ALL: WHEN zi_match_confidence > efx_match_confidence",
                           "None — Pipeline B stores NULL when both ZI and EFX have no NAICS",
                           "❌ No AI enrichment","datascience.customer_files",
                           "Internal analytics, risk model training, data export",
                           "❌ Ignored — oc_match_confidence never read in customer_table.sql",
                           "❌ Not captured","Full table rebuilt on each run"],
        }
        st.dataframe(pd.DataFrame(comp), use_container_width=True, hide_index=True)

    elif pipeline_page == "🅐 Pipeline A Deep Dive":
        sh("🅐 Pipeline A — Integration Service Deep Dive")

        st.markdown("### Sequence of Events (T+0:00 → T+0:20)")
        st.code("""T+0:00  POST /businesses/customers/{customerID}
         data_cases created, data_businesses created
         integration tasks queued (Bull queue)
         │
T+0:01  Integration-service fires vendor lookups IN PARALLEL:
         Middesk   (platform_id=16, weight=2.0) → Live SOS API call
           → registrations[], reviewTasks[], tin match, officers, watchlist
         OC        (platform_id=23, weight=0.9) → Redshift: oc_matches_custom_inc_ml
           → firmographic.industry_code_uids (us_naics-XXXXXX|uk_sic-XXXXX)
         ZoomInfo  (platform_id=24, weight=0.8) → Redshift: zoominfo_matches_custom_inc_ml
           → zi_c_naics6, zi_c_sic4, zi_c_employees, zi_c_revenue, website
         Equifax   (platform_id=17, weight=0.7) → Redshift: efx_matches_custom_inc_ml
           → efx_primnaicscode, efx_corpempcnt, efx_state, credit data
         Trulioo   (platform_id=38, weight=0.8) → Live KYB API call
           → business registration, directors, watchlist screening
         SERP      (platform_id=22)              → Web scraping
           → website URL, Google Place ID, domain creation date
         Plaid IDV (platform_id=40, per owner)   → Owner identity verification
           → SSN match, DOB, address, IDV status
         │
T+0:15  Fact Engine runs — for EACH of 200+ facts independently:
         applyRulesToFact(factName, rules):
           1. manualOverride()  ← ALWAYS FIRST
           2. factWithHighestConfidence()
           3. weightedFactSelector() [tie-break if within 5%]
           4. Rule 4: NO minimum confidence cutoff
           [... Rule 5: AI safety net if <1 non-AI NAICS source]
           [... Rule 6: removeNaicsCode() if invalid AI code]
         │
T+0:16  AI enrichment triggered (if naics_code has <1 non-AI source):
         GPT-5-mini receives: business_name, address, website (if available)
         Returns: naics_code, mcc_code, confidence, reasoning
         executePostProcessing(): validates against core_naics_code
           → if valid: stored as-is
           → if invalid: removeNaicsCode() → 561499 (NAICS_OF_LAST_RESORT)
         │
T+0:19  Kafka: facts.v1 → CALCULATE_BUSINESS_FACTS
         warehouse-service writes to: rds_warehouse_public.facts
           name="naics_code" value={"value":"722511","source":{"platformId":16}}
         case-service writes to: rds_cases_public.data_businesses
           naics_id → FK to core_naics_code WHERE code="722511"
           mcc_id   → FK to core_mcc_code (via rel_naics_mcc lookup)
         │
T+0:20  Customer sees result in admin.joinworth.com KYB tab""", language=None)

        st.markdown("---")
        st.markdown("### The 6 Winner-Selection Rules")
        for rule in PIPELINE_A_NAICS_RULES:
            c = rule["colour"]
            st.markdown(
                f'<div class="card" style="border-left-color:{c};background:#0E1E38;'
                f'margin-bottom:8px;padding:10px 14px;">'
                f'<span style="font-weight:900;color:{c};">Rule {rule["number"]}: {rule["name"]}</span>'
                f'<span style="margin-left:14px;font-family:Courier New;font-size:.8rem;'
                f'background:#0A1628;color:{c};padding:2px 8px;border-radius:4px;">'
                f'{rule["formula"]}</span><br>'
                f'<span style="color:#CBD5E1;font-size:.88rem;">{rule["description"]}</span>'
                f'</div>', unsafe_allow_html=True)

        st.markdown("---")
        st.markdown("### Source Confidence Models")
        src_table = """<table class="t">
        <tr><th>Source</th><th>Platform ID</th><th>Weight</th><th>Confidence Model</th><th>API Type</th></tr>"""
        for sk, src in SOURCES.items():
            bc, bl = SOURCE_BADGE.get(sk, ("b-grey", sk))
            w = src.get("weight", 0)
            wc = "#FCD34D" if w >= 2 else ("#6EE7B7" if w >= 0.8 else "#94A3B8")
            src_table += (f"<tr><td><span class='badge {bc}'>{bl}</span></td>"
                          f"<td><code>{src.get('platform_id','?')}</code></td>"
                          f"<td><b style='color:{wc}'>{w}</b></td>"
                          f"<td style='font-size:.82rem;color:#94A3B8;'>{src.get('confidence_model','?')}</td>"
                          f"<td style='font-size:.82rem;color:#94A3B8;'>{src.get('api_type','?')}</td></tr>")
        st.markdown(src_table + "</table>", unsafe_allow_html=True)

    elif pipeline_page == "🅑 Pipeline B Deep Dive":
        sh("🅑 Pipeline B — Batch Redshift Deep Dive (customer_table.sql)")

        card("""<b>Pipeline B produces datascience.customer_files — a wide denormalized table.</b><br>
        It uses a single SQL CASE statement that determines the WINNER for EVERY field:
        NAICS, employees, revenue, company name, address, city, ZIP, country, website, and more.<br>
        <b>OC, Liberty, Middesk, and Trulioo are completely ignored.</b>
        """, "card-amber")

        st.code("""-- customer_table.sql: sp_recreate_customer_files()
-- The winner-takes-ALL rule (same WHEN clause controls all fields):

COALESCE(
    CASE
        WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
            THEN CAST(NULLIF(REGEXP_REPLACE(zi_c_naics6, '[^0-9]', ''), '') AS INTEGER)
        ELSE CAST(NULLIF(REGEXP_REPLACE(efx_primnaicscode, '[^0-9]', ''), '') AS INTEGER)
    END,
    naics_code   -- fallback to existing naics_code or NULL
) AS primary_naics_code,

-- Same WHEN clause for employees:
CASE WHEN COALESCE(zi_match_confidence,0) > COALESCE(efx_match_confidence,0)
    THEN CAST(REGEXP_REPLACE(zi_c_employees,'[^0-9]','') AS INTEGER)
    ELSE CAST(REGEXP_REPLACE(efx_corpempcnt,'[^0-9]','') AS INTEGER)
END AS employee_count,

-- Same for company name, revenue, address, city, ZIP, country, website...""", language="sql")

        st.markdown("---")
        st.markdown("### What Happens in Each Scenario")
        scenarios = {
            "Situation": ["ZI confidence > EFX confidence","EFX confidence > ZI confidence",
                          "Both confidences = 0","OC had better match than ZI/EFX",
                          "Liberty / Middesk / Trulioo matched"],
            "What gets stored in customer_files": [
                "All fields from ZoomInfo (zi_c_naics6, zi_c_name, zi_c_employees…)",
                "All fields from Equifax (efx_primnaicscode, efx_name, efx_corpempcnt…)",
                "COALESCE fallback to existing naics_code or NULL",
                "OC IGNORED — oc_match_confidence never read in this SQL",
                "IGNORED — live API sources not in batch pipeline",
            ],
            "Customer impact": [
                "ZoomInfo data in analytics table",
                "Equifax data in analytics table",
                "NULL industry — no classification",
                "⚠️ Weaker ZI/EFX code used instead of OC",
                "⚠️ Same ZI vs EFX result — live data not included",
            ],
        }
        st.dataframe(pd.DataFrame(scenarios), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("### Key Tables Written by Pipeline B")
        thtml3 = """<table class="t">
        <tr><th>Table</th><th>Schema</th><th>Contains</th></tr>
        <tr><td><code>customer_files</code></td><td>datascience</td>
            <td>Wide denormalized table: NAICS, MCC, employees, revenue, name, address, website,
            worth_score, match_confidence, zi/efx/oc confidence scores, 50+ columns</td></tr>
        <tr><td><code>latest_score</code></td><td>warehouse</td>
            <td>Latest worth score per business</td></tr>
        <tr><td><code>zoominfo_standard_ml_2</code></td><td>datascience</td>
            <td>ZoomInfo entity-matching results (intermediate)</td></tr>
        <tr><td><code>equifax_us_standardized</code></td><td>datascience</td>
            <td>Equifax entity-matching results (intermediate)</td></tr>
        <tr><td><code>open_corporates_standard_ml_2</code></td><td>datascience</td>
            <td>OC entity-matching results (intermediate, NOT used for NAICS in Pipeline B)</td></tr>
        </table>"""
        st.markdown(thtml3, unsafe_allow_html=True)

    elif pipeline_page == "📦 Storage & Tables":
        sh("📦 Storage & Tables — Where Everything Lives")

        st.markdown("### PostgreSQL Tables (rds_cases_public + rds_warehouse_public)")
        pg_tables = {
            "Table": ["facts","request_response","data_businesses","data_owners","data_cases",
                      "core_naics_code","core_mcc_code","rel_naics_mcc","core_business_industries"],
            "Schema": ["rds_warehouse_public","integration_data","rds_cases_public","rds_cases_public",
                       "rds_cases_public","rds_cases_public","rds_cases_public","rds_cases_public","rds_cases_public"],
            "Contains": [
                "ALL 200+ resolved facts per business — JSONB value with source, confidence, alternatives",
                "Raw vendor API responses per platform_id — full JSON, includes reasoning",
                "Core business record: naics_id→FK, mcc_id→FK, industry, name, address",
                "Owner records: name, SSN (masked/encrypted), DOB, address, IDV status",
                "Case status, worth_score, timestamps, integration completion flag",
                "NAICS 2022 lookup table: code (6-digit), label, description",
                "MCC lookup table: code (4-digit), label",
                "NAICS → MCC mapping: naics_id → mcc_id",
                "Industry sector lookup: derived from NAICS 2-digit prefix",
            ],
            "Written by": [
                "warehouse-service (from Kafka facts.v1 topic)",
                "integration-service (per vendor API call)",
                "case-service (on submission + fact updates)",
                "case-service (on submission)",
                "case-service + manual-score-service",
                "Static reference — loaded at deploy",
                "Static reference — loaded at deploy",
                "Static reference — loaded at deploy",
                "Static reference — loaded at deploy",
            ],
        }
        st.dataframe(pd.DataFrame(pg_tables), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("### Redshift Tables (datascience + warehouse + zoominfo)")
        rs_tables = {
            "Table": ["customer_files","zoominfo_standard_ml_2","equifax_us_standardized",
                      "open_corporates_standard_ml_2","comp_standard_global",
                      "equifax_us_latest","oc_companies_latest","latest_score"],
            "Schema": ["datascience","datascience","datascience","datascience",
                       "zoominfo","warehouse","warehouse","warehouse"],
            "Contains": [
                "Pipeline B output — wide denormalized table (50+ columns)",
                "ZoomInfo entity-match results (intermediate matching table)",
                "Equifax entity-match results (intermediate matching table)",
                "OC entity-match results (intermediate, NOT used for NAICS in Pipeline B)",
                "Full ZoomInfo firmographic data: zi_c_naics6, zi_c_employees, zi_c_revenue…",
                "Full Equifax data: efx_primnaicscode, efx_corpempcnt, efx_state…",
                "Full OC data: industry_code_uids (pipe-delimited taxonomy codes)",
                "Latest worth score per business",
            ],
            "Used by": [
                "Analytics, reporting, risk model training, data export",
                "Pipeline B customer_table.sql join",
                "Pipeline B customer_table.sql join",
                "Pipeline A OC source getter (for naics_code fact)",
                "Pipeline A ZoomInfo source getter",
                "Pipeline A Equifax source getter",
                "Pipeline A OC source getter",
                "Pipeline B customer_table.sql",
            ],
        }
        st.dataframe(pd.DataFrame(rs_tables), use_container_width=True, hide_index=True)

        st.markdown("---")
        st.markdown("### Data Flow: How a NAICS code travels from vendor to customer")
        st.code("""Vendor bulk data (Redshift):
  zoominfo.comp_standard_global  → zi_c_naics6 = "722511"
  warehouse.equifax_us_latest    → efx_primnaicscode = "722511"
  warehouse.oc_companies_latest  → industry_code_uids = "us_naics-722511|uk_sic-56101"
         │
         ▼  (entity matching via XGBoost, match.index/55 = confidence)
  datascience.zoominfo_standard_ml_2   → zi_c_naics6="722511", match_confidence=0.94
  datascience.equifax_us_standardized  → efx_primnaicscode="722511", match_confidence=0.88
  datascience.open_corporates_standard_ml_2 → industry_code_uids="...", match_confidence=0.91
         │
         │  PIPELINE A (real-time)                PIPELINE B (batch)
         ▼                                         ▼
  Fact Engine: factWithHighestConfidence()    CASE WHEN zi_conf > efx_conf
  → OC wins (0.91 highest confidence)        → ZI wins (0.94 > 0.88)
  → naics_code = "722511"                    → primary_naics_code = 722511
         │                                         │
         ▼                                         ▼
  rds_warehouse_public.facts               datascience.customer_files
  name="naics_code"                        primary_naics_code = 722511
  value={"value":"722511",                 (+ ALL ZI firmographic data)
          "source":{"platformId":23}}
         │
         ▼
  case-service → data_businesses.naics_id → core_naics_code.id
         │
         ▼
  admin.joinworth.com → KYB → NAICS Code: 722511 — Full-Service Restaurants""", language=None)

    elif pipeline_page == "⚖️  Pipeline A vs B Comparison":
        sh("⚖️  Pipeline A vs Pipeline B — Key Differences")

        card("""<b>Why do Pipeline A and Pipeline B sometimes show different NAICS codes?</b><br>
        This is expected. They use different vendors, different selection rules,
        and run at different times. Pipeline A is what the customer sees.
        Pipeline B is for analytics and risk model training.
        """, "card-teal")

        st.markdown("### The Shared Input — Same Source Tables, Different Rules")
        st.code("""SHARED INPUT (both pipelines read the same Redshift source tables):
  ZoomInfo: zoominfo.comp_standard_global  → zoominfo_standard_ml_2
  Equifax:  warehouse.equifax_us_latest    → equifax_us_standardized
  OC:       warehouse.oc_companies_latest  → open_corporates_standard_ml_2
         │
         ┌──────────────────────────┴─────────────────────────┐
         ▼                                                     ▼
  PIPELINE A OUTPUT                              PIPELINE B OUTPUT
  rds_warehouse_public.facts                    datascience.customer_files
  (JSONB, all 200+ facts)                       (wide denormalized table)

  naics_code fact: winner from                  primary_naics_code: winner
  ALL sources (Middesk, OC, ZI,                 from ZI vs EFX ONLY
  EFX, Trulioo, AI)                             (OC, Middesk, Trulioo ignored)
         │                                             │
         ▼                                             ▼
  REST API response                             Redshift analytics
  Worth 360 Report                              Risk model training
  Customer admin UI                             Data export
  KYB decisions""", language=None)

        st.markdown("---")
        st.markdown("### Why OC Winning in Pipeline A Doesn't Affect Pipeline B")
        card("""<b>Scenario:</b> OC has confidence 0.92, ZI has 0.61, EFX has 0.48.<br><br>
        <b>Pipeline A result:</b> OC wins → naics_code from OC → stored in facts table → customer sees OC NAICS<br>
        <b>Pipeline B result:</b> WHEN COALESCE(0.61,0) > COALESCE(0.48,0) → ZI wins → primary_naics_code from ZI<br><br>
        The customer admin portal shows the Pipeline A result (OC NAICS).<br>
        The analytics/risk model uses the Pipeline B result (ZI NAICS).<br>
        These can be different — this is expected and by design.
        """, "card-purple")

        st.markdown("---")
        st.markdown("### Field-Level Difference: Which Pipeline Produced This Value?")
        field_origins = {
            "Field in Admin UI": ["NAICS Code","MCC Code","Legal Business Name","SoS Filings",
                                  "Officers / Directors","Watchlist Hits","Industry Name","Worth Score"],
            "Source Pipeline": ["A","A","A","A","A","A","A","A (calculation)"],
            "Fact Name": ["naics_code","mcc_code","legal_name","sos_filings","people","watchlist","industry","worth_score"],
            "Winner Rule": ["6 rules (factWithHighestConfidence…)","mcc_code_found ?? mcc_code_from_naics",
                            "factWithHighestConfidence","combineFacts (all sources merged)","combineFacts",
                            "combineWatchlistMetadata","derived from NAICS 2-digit prefix","weighted_score_850 model"],
            "In Pipeline B?": ["✅ primary_naics_code","❌ Not in customer_files","✅ company_name",
                               "❌ Not in customer_files","❌ Not in customer_files","❌ Not in customer_files",
                               "❌ Not in customer_files","✅ worth_score"],
        }
        st.dataframe(pd.DataFrame(field_origins), use_container_width=True, hide_index=True)
