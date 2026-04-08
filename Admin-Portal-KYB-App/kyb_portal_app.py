"""
Worth AI — KYB Portal Intelligence Hub
Complete understanding of every field, badge, rule, and lineage
in the Admin Portal KYB tab and sub-tabs.
"""
import io, os, base64, json
import streamlit as st
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from kyb_rag_builder import load_or_build, search as rag_search

# ── Page config ────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="Worth AI — KYB Portal Intelligence Hub",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Constants ──────────────────────────────────────────────────────────────────
BG = "#0F172A"; GRID = "#1E293B"
RED = "#F87171"; AMBER = "#FCD34D"; GREEN = "#34D399"
BLUE = "#60A5FA"; TEAL = "#2DD4BF"; GREY = "#94A3B8"; PURPLE = "#A78BFA"
TEXT = "#E2E8F0"; SUB = "#94A3B8"
N_561499 = 5349

REPO_URLS = {
    "ADMIN_PORTAL": "https://github.com/wecsleyprates-design/Admin-Portal-KYB/blob/main",
    "SIC_UK": "https://github.com/wecsleyprates-design/SIC-UK-Codes/blob/main",
}

# ── CSS ────────────────────────────────────────────────────────────────────────
st.markdown("""<style>
html,body,[class*="css"]{font-family:'Inter','Segoe UI',sans-serif;}
section[data-testid="stSidebar"]{background:#0B1120!important;}
section[data-testid="stSidebar"] *{color:#E2E8F0!important;}
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
.badge{display:inline-block;padding:3px 11px;border-radius:12px;font-size:.73rem;font-weight:700;margin:2px;letter-spacing:.01em;}
.b-blue{background:#1E3A6E;color:#93C5FD;border:1px solid #2563EB;}
.b-green{background:#064E3B;color:#6EE7B7;border:1px solid #059669;}
.b-amber{background:#451A03;color:#FCD34D;border:1px solid #D97706;}
.b-red{background:#450A0A;color:#FCA5A5;border:1px solid #DC2626;}
.b-grey{background:#1E293B;color:#94A3B8;border:1px solid #475569;}
.metric-block{background:#1A2744;border:1px solid #2D4070;border-radius:10px;padding:16px 18px;text-align:center;}
.metric-num{font-size:2rem;font-weight:700;color:#60A5FA;}
.metric-label{font-size:.78rem;color:#94A3B8;margin-top:4px;}
.t{width:100%;border-collapse:collapse;font-size:.87rem;}
.t th{background:#0F2040;color:#93C5FD;font-weight:700;padding:9px 13px;text-align:left;border-bottom:2px solid #2563EB;}
.t td{padding:8px 13px;border-bottom:1px solid #1E293B;vertical-align:top;color:#CBD5E1;background:#0F172A;}
.t tr:nth-child(even) td{background:#141F35;}
.t code{background:#1E3A5F;color:#93C5FD;padding:1px 6px;border-radius:4px;font-size:.82em;}
.sh{background:linear-gradient(135deg,#0F2040 0%,#1D4ED8 100%);color:#E2E8F0;padding:11px 20px;border-radius:8px;font-weight:700;font-size:1.08rem;margin-bottom:12px;border:1px solid #2563EB;}
.cb{background:#0A1628;color:#93C5FD;border:1px solid #1E3A5F;border-radius:6px;padding:12px 16px;font-family:'Courier New',monospace;font-size:.82rem;white-space:pre-wrap;word-break:break-all;line-height:1.55;}
.portal-badge-green{background:#DCFCE7;color:#166534;border:1px solid #4ADE80;border-radius:9999px;padding:2px 10px;font-size:.75rem;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.portal-badge-amber{background:#FEF9C3;color:#854D0E;border:1px solid #FDE047;border-radius:9999px;padding:2px 10px;font-size:.75rem;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.portal-badge-red{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;border-radius:9999px;padding:2px 10px;font-size:.75rem;font-weight:600;display:inline-flex;align-items:center;gap:4px;}
.source-ref{background:#0A1628;border:1px solid #1E3A5F;border-left:4px solid #60A5FA;border-radius:6px;padding:8px 12px;margin:6px 0;font-size:.8rem;color:#93C5FD;}
</style>""", unsafe_allow_html=True)

# ── Helpers ────────────────────────────────────────────────────────────────────
def sh(t): st.markdown(f'<div class="sh">{t}</div>', unsafe_allow_html=True)
def card(t, s=""): st.markdown(f'<div class="card {s}">{t}</div>', unsafe_allow_html=True)
def pbadge(text, kind="green"):
    cls = {"green":"portal-badge-green","amber":"portal-badge-amber","red":"portal-badge-red"}.get(kind,"portal-badge-green")
    icon = {"green":"✅","amber":"⚠️","red":"❌"}.get(kind,"✅")
    return f'<span class="{cls}">{icon} {text}</span>'
def src_ref(source_type, path, line_start, line_end, label=""):
    base = REPO_URLS.get(source_type, "")
    url = f"{base}/{path}#L{line_start}-L{line_end}"
    tag = "🖥️ Admin Portal" if source_type == "ADMIN_PORTAL" else "⚙️ Backend"
    return (f'<div class="source-ref">{tag} '
            f'<a href="{url}" target="_blank" style="color:#60A5FA;text-decoration:none;">'
            f'🔗 {path} L{line_start}–{line_end}</a>'
            f'{"  — " + label if label else ""}</div>')

def metric(label, value, colour="#60A5FA"):
    return (f'<div class="metric-block"><div class="metric-num" style="color:{colour};">'
            f'{value}</div><div class="metric-label">{label}</div></div>')

def fig_img(fig, w=9.0):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor=BG, edgecolor="none")
    buf.seek(0); plt.close(fig); return buf

# ── Load RAG ──────────────────────────────────────────────────────────────────
@st.cache_resource
def get_rag():
    return load_or_build()

rag_index = get_rag()

# ── Sidebar ────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("""
    <div style="background:linear-gradient(135deg,#0B0F2A 0%,#1a1150 100%);
         border-radius:10px;padding:14px 18px;margin-bottom:8px;
         border:1px solid #2D2080;text-align:center;">
      <div style="font-size:1.3rem;font-weight:900;color:#E2E8F0;">
        <span style="color:#B57BFF;">W</span>ORTH <span style="color:#60A5FA;">AI</span>
      </div>
      <div style="font-size:.6rem;color:#8B8FBF;letter-spacing:.15em;margin-top:2px;">
        KYB PORTAL INTELLIGENCE HUB
      </div>
    </div>""", unsafe_allow_html=True)

    section = st.radio("Navigate", [
        "🗺️  KYB Tab Map",
        "🏷️  Field Lineage Explorer",
        "🔰  Badge & State Decoder",
        "⚠️  NAICS / MCC Deep Dive",
        "🔀  Pipeline A vs B",
        "🤖  AI Agent",
    ], label_visibility="collapsed")
    st.markdown("---")
    st.caption("Source: Admin-Portal-KYB repo + SIC-UK-Codes · April 2026")


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  1 — KYB TAB MAP                                                  ║
# ╚═══════════════════════════════════════════════════════════════════╝
if section == "🗺️  KYB Tab Map":
    sh("🗺️  KYB Tab — Complete Field Map (Admin Portal)")

    card("""<b>The KYB tab in admin.joinworth.com has 5 sub-tabs.</b>
    Each sub-tab is powered by a specific API call and renders specific facts from the Fact Engine.
    The main React component is <code>KnowYourBusiness/index.tsx</code> (731 lines).
    All fact data flows through <code>useGetFactsKyb</code> → <code>GET /facts/business/:id/kyb</code>
    and <code>useGetFactsBusinessDetails</code> → <code>GET /facts/business/:id/details</code>.
    """)
    st.markdown(src_ref("ADMIN_PORTAL",
        "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
        1, 731, "Main KYB component — all 5 sub-tabs"), unsafe_allow_html=True)

    st.markdown("---")

    # Sub-tab cards
    subtabs_data = [
        {
            "name": "📋 Background", "colour": BLUE,
            "api": "GET /facts/business/:id/details  +  GET /facts/business/:id/kyb",
            "hook": "useGetFactsBusinessDetails + useGetFactsKyb",
            "component": "CompanyProfile/Business.tsx + Industry.tsx",
            "fields": [
                ("Business Name", "business_name.value", "businessDetails→ZI→EFX", "business.name"),
                ("DBA", "dba.value[]", "Middesk names[]→ZI→OC", "businessNames[]"),
                ("Business Address", "primary_address.value", "Middesk→OC→ZI→EFX", "business.address"),
                ("Mailing Address", "mailing_address.value", "businessAddresses is_primary=false", "—"),
                ("Business Age", "formation_date", "Middesk formation_date→OC→EFX", "Computed from date"),
                ("Annual Revenue", "revenue.value", "EFX→ZI→accounting", "—"),
                ("Net Income", "is_net_income.value", "Accounting/Rutter", "—"),
                ("Corporation Type", "bus_struct.value", "Middesk→OC entity_type", "business.corporation_type"),
                ("Employees", "num_employees.value", "EFX.corpemployees→ZI→OC", "—"),
                ("Phone", "business_phone.value", "ZI→SERP→Middesk→EFX", "—"),
                ("Email", "email.value", "EFX.efx_email", "—"),
                ("Minority Owned", "minority_owned.value", "EFX.efx_minority_business_enterprise", "—"),
                ("Woman Owned", "woman_owned.value", "EFX.efx_woman_owned_business", "—"),
                ("Veteran Owned", "veteran_owned.value", "EFX.efx_veteran_owned_business", "—"),
                ("Industry Name", "industry.value.name", "NAICS 2-digit → core_business_industries", "business.industry.name"),
                ("NAICS Code", "naics_code.value", "EFX→ZI→OC→SERP→Trulioo→AI", "business.naics_code"),
                ("NAICS Description", "naics_description.value", "core_naics_code.label", "business.naics_title"),
                ("MCC Code", "mcc_code.value", "mcc_code_found(AI)→mcc_code_from_naics", "business.mcc_code"),
                ("MCC Description", "mcc_description.value", "AI response OR core_mcc_code.label", "business.mcc_title"),
            ],
            "null_reason": "Shows '-' (dash) when both businessDetailFacts AND business DB return null. "
                           "NAICS/MCC show '-' when AI enrichment has not run or returns 561499/5614.",
        },
        {
            "name": "🏛️ Business Registration", "colour": GREEN,
            "api": "GET /facts/business/:id/kyb",
            "hook": "useGetFactsKyb",
            "component": "KnowYourBusiness/index.tsx L128-L403",
            "fields": [
                ("Business Name (card header)", "legal_name.value", "Middesk BEV.name→OC→EFX→businessDetails", "—"),
                ("Tax ID (EIN)", "tin.value", "businessDetails (applicant submitted, masked)", "—"),
                ("TIN Badge (Verified/Not Found)", "tin_match.value.status", "Middesk reviewTasks[key='tin'].status", "—"),
                ("Filing Status", "sos_filings[n].active", "Middesk registrations[n].status==='active'", "—"),
                ("Entity Jurisdiction Type", "sos_filings[n].foreign_domestic", "Middesk jurisdiction field → 'domestic'/'foreign'", "—"),
                ("Primary badge", "sos_filings[0]", "First element in sos_filings array = primary", "—"),
                ("State", "sos_filings[n].state", "Middesk registration_state", "—"),
                ("Registration Date", "sos_filings[n].filing_date", "Middesk registrations[n].registration_date", "—"),
                ("Entity Type", "sos_filings[n].entity_type", "Middesk entity_type (normalized: llc/corp/llp)", "—"),
                ("Corporate Officers", "people.value[] filtered by sos.id", "Middesk registrations[n].officers → people fact", "—"),
                ("Legal Entity Name", "sos_filings[n].filing_name", "Middesk registrations[n].name", "—"),
                ("Articles of Incorporation", "sos_filings[n].url", "Middesk source URL (only if direct business link)", "—"),
                ("SoS Verified badge", "sos_match_boolean + sos_active", "getSosBadgeConfig() in SectionHeader.tsx", "—"),
                ("No Registry Data message", "sos_filings.value.length === 0", "Middesk found no registrations for this TIN+name", "—"),
            ],
            "null_reason": "'No Registry Data to Display' appears when sos_filings.value is empty "
                           "(isNonEmptyArray returns false). This means Middesk searched and found NO filings. "
                           "It is NOT a confidence cutoff — if Middesk finds nothing, nothing is shown.",
        },
        {
            "name": "📬 Contact Information", "colour": TEAL,
            "api": "GET /facts/business/:id/kyb (same as Business Registration)",
            "hook": "useGetFactsKyb (shared from parent)",
            "component": "KnowYourBusiness/index.tsx L406-L546",
            "fields": [
                ("Submitted Address", "business_addresses_submitted.value[]", "businessDetails (applicant onboarding)", "—"),
                ("Reported Address (Deliverable)", "addresses.value[] + addresses_deliverable.value[]", "Middesk→OC→ZI→SERP combined via combineFacts", "—"),
                ("Business Registration badge on address", "address_match_boolean OR address_verification_boolean", "Middesk address task OR address_verification fact", "—"),
                ("Google Profile badge on address", "address_verification.value from Google Places", "SERP+Google Places API comparison", "—"),
                ("Submitted Name", "names_submitted.value[]", "businessDetails (applicant submitted)", "—"),
                ("Reported Name", "names_found.value[]", "Middesk BEV→OC→ZI→SERP combined", "—"),
                ("Name Verified badge", "name_match_boolean.value", "Middesk name task OR derived from name comparison", "—"),
            ],
            "null_reason": "Address section only renders when kybFactsData.addresses.value.length > 0 (L406). "
                           "Name section only renders when names_submitted.value.length > 0 (L485). "
                           "If Middesk finds no addresses, the section does not appear.",
        },
        {
            "name": "🌐 Website", "colour": PURPLE,
            "api": "GET /verification/businesses/:id/website-data  +  GET /facts/business/:id/details",
            "hook": "useGetBusinessWebsite + useGetFactsBusinessDetails",
            "component": "CompanyProfile/WebsiteReview.tsx",
            "fields": [
                ("Website URL", "website.value", "ZI.zi_c_url→businessDetails.official_website→SERP→Verdata→EFX.efx_web", "—"),
                ("Creation Date", "domain creation date from WHOIS", "SERP scraping / Verdata WHOIS lookup", "—"),
                ("Expiration Date", "domain expiration", "SERP / Verdata WHOIS", "—"),
                ("Parked Domain", "parked domain flag", "SERP scraping analysis", "N/A shown when unknown"),
                ("Status", "website_found.value OR website status", "SERP + Verdata website status check", "Unknown when no data"),
            ],
            "null_reason": "Website fields show N/A when: (1) applicant did not submit website, "
                           "(2) SERP scraping found no domain, (3) WHOIS has privacy protection enabled. "
                           "Status='Unknown' is the default when verification has not completed.",
        },
        {
            "name": "🔍 Watchlists", "colour": RED,
            "api": "GET /facts/business/:id/kyb  +  GET /verification/businesses/:id/people/watchlist",
            "hook": "useGetFactsKyb + useGetIndividualWatchlistDetails",
            "component": "KnowYourBusiness/index.tsx L554-L709 + WatchlistTitleNew.tsx",
            "fields": [
                ("Hits for [Business Name]", "watchlist.value.metadata (filtered by entity_type=BUSINESS)", "Middesk reviewTasks[key='watchlist'] via combineWatchlistMetadata", "—"),
                ("Hits for [Person Name]", "individualWatchListHits.data.records[]", "GET /verification/businesses/:id/people/watchlist → per-person hits", "—"),
                ("Hit count badge", "watchlist.value.metadata.length", "Length of metadata array after deduplication", "0 = No Hits badge"),
                ("OFAC lists", "watchlist.value.metadata filtered by agency", "SDN, Capta, Foreign Sanctions Evaders, Non-SDN (Iranian/Chinese/Palestinian), Sectoral", "—"),
                ("BIS lists", "watchlist.value.metadata filtered by agency", "Entity List, Denied Persons, Military End User, Unverified List", "—"),
                ("State Dept lists", "watchlist.value.metadata filtered by agency", "ITAR Debarred, Nonproliferation Sanctions", "—"),
                ("No Hits badge", "watchlist.value.metadata.length === 0", "combineWatchlistMetadata returned empty array", "✅ No Hits"),
            ],
            "null_reason": "'No Hits Found' means watchlist scan completed and returned zero matches. "
                           "This is the NORMAL expected result for most businesses. "
                           "The section is hidden for Canadian businesses (excludedCountriesForVerification).",
        },
    ]

    for sub in subtabs_data:
        c = sub["colour"]
        with st.expander(f"**{sub['name']}**  ·  API: `{sub['api']}`"):
            col1, col2 = st.columns([3, 1])
            with col1:
                st.markdown(f"**React Hook:** `{sub['hook']}`")
                st.markdown(f"**Component:** `{sub['component']}`")
            with col2:
                st.markdown(f'<div style="background:{c}22;border:1px solid {c}55;border-radius:6px;'
                            f'padding:8px;font-size:.75rem;color:{c};text-align:center;">'
                            f'<b>{sub["name"]}</b></div>', unsafe_allow_html=True)

            # Field table
            thtml = """<table class="t"><tr>
            <th>UI Field Label</th><th>Fact / Data Path</th><th>Vendor Source</th><th>Fallback</th>
            </tr>"""
            for ui_label, fact_path, source, fallback in sub["fields"]:
                thtml += f"""<tr>
                <td style="color:#E2E8F0;font-weight:600;">{ui_label}</td>
                <td><code>{fact_path}</code></td>
                <td style="color:#94A3B8;font-size:.82rem;">{source}</td>
                <td style="color:#475569;font-size:.82rem;">{fallback}</td></tr>"""
            st.markdown(thtml + "</table>", unsafe_allow_html=True)

            # Null/blank explanation
            st.markdown(f'<div class="card card-amber" style="margin-top:8px;">'
                        f'<b>⚠️ When fields are blank / show N/A:</b><br>{sub["null_reason"]}'
                        f'</div>', unsafe_allow_html=True)


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  2 — FIELD LINEAGE EXPLORER                                       ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🏷️  Field Lineage Explorer":
    sh("🏷️  Field Lineage Explorer — Full Data Lineage per Admin Portal Field")

    FIELD_CATALOG = {
        "NAICS Code (Background tab)": {
            "ui_label": "NAICS Code", "sub_tab": "Background",
            "fact_name": "naics_code",
            "api_path": "GET /facts/business/:id/details → businessDetailFacts.naics_code.value",
            "react_code": "Industry.tsx L44-L49: businessDetailFacts?.naics_code?.value ?? business?.naics_code ?? '-'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
            "react_lines": (44, 49),
            "backend_fact_file": "integration-service/lib/facts/businessDetails/index.ts",
            "backend_fact_lines": (318, 360),
            "sources_ordered": [
                ("Equifax", "pid=17", "w=0.7", "efx_primnaicscode from warehouse.equifax_us_latest"),
                ("ZoomInfo", "pid=24", "w=0.8", "zi_c_naics6 from zoominfo.comp_standard_global"),
                ("OpenCorporates", "pid=23", "w=0.9", "industry_code_uids parsed for us_naics-XXXXXX"),
                ("SERP", "pid=22", "w=0.3", "businessLegitimacyClassification.naics_code"),
                ("Trulioo", "pid=38", "w=0.7", "standardizedIndustries[n].naicsCode"),
                ("Applicant Submission", "pid=0", "w=0.2", "naics_code from onboarding form (schema: /^\\d{6}$/)"),
                ("AI Enrichment (GPT-5-mini)", "pid=31", "w=0.1", "response.naics_code (last resort = 561499)"),
            ],
            "winner_rule": "factWithHighestConfidence() + weightedFactSelector() tie-break. "
                           "manualOverride() always first. Rule 4: NO minimum confidence cutoff.",
            "storage": [
                "rds_warehouse_public.facts  name='naics_code'  JSONB value",
                "rds_cases_public.data_businesses.naics_id → core_naics_code.id",
            ],
            "null_cause": "Shows '-' when: (1) all vendors returned null naics_code, "
                          "(2) AI fired and returned 561499 (which is shown as the code, not '-'), "
                          "(3) businessDetailFacts.naics_code.value AND business.naics_code are both null/undefined.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("When does NAICS show '-' vs '561499'?",
                 "Shows '-' only when both businessDetailFacts.naics_code.value AND business.naics_code are null. "
                 "Shows '561499' when the AI enrichment ran and returned NAICS_OF_LAST_RESORT. "
                 "The AI returns 561499 when no vendor had NAICS data and it had no other evidence."),
                ("If EFX returns 722511 and ZI returns 722512, what does the user see?",
                 "The user sees ONE code — the winner chosen by factWithHighestConfidence(). "
                 "If ZI confidence > EFX confidence by >5%, ZI wins. If within 5%, ZI (weight=0.8) vs EFX (weight=0.7) → ZI wins. "
                 "The alternatives[] array in the JSONB fact stores all vendor responses, but the UI does not display them."),
                ("Does NAICS ever update after first classification?",
                 "Yes — if vendor bulk data updates and the business is re-enriched (via Kafka trigger or manual re-run), "
                 "the Fact Engine will re-evaluate and may select a different winner. "
                 "There is no automatic re-enrichment cadence currently in production."),
            ],
        },
        "MCC Code (Background tab)": {
            "ui_label": "MCC Code", "sub_tab": "Background",
            "fact_name": "mcc_code",
            "api_path": "GET /facts/business/:id/details → businessDetailFacts.mcc_code.value",
            "react_code": "Industry.tsx L53-L59: businessDetailFacts?.mcc_code?.value ?? business?.mcc_code ?? '-'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
            "react_lines": (53, 59),
            "backend_fact_file": "integration-service/lib/facts/businessDetails/index.ts",
            "backend_fact_lines": (391, 440),
            "sources_ordered": [
                ("AI Enrichment (mcc_code_found)", "pid=31", "—", "response.mcc_code — AI-returned MCC directly"),
                ("Calculated from NAICS (mcc_code_from_naics)", "calculated", "—", "rel_naics_mcc lookup: naics_id → mcc_id"),
                ("mcc_code", "combined", "—", "mcc_code_found?.value ?? mcc_code_from_naics?.value"),
            ],
            "winner_rule": "mcc_code = AI-provided MCC (if exists) OR calculated from winning NAICS via rel_naics_mcc. "
                           "NOT a competitive vendor selection — it is a derived/calculated fact.",
            "storage": [
                "rds_warehouse_public.facts  name='mcc_code'  JSONB",
                "rds_warehouse_public.facts  name='mcc_code_found'  (AI direct)",
                "rds_warehouse_public.facts  name='mcc_code_from_naics'  (calculated)",
                "rds_cases_public.data_businesses.mcc_id → core_mcc_code.id",
            ],
            "null_cause": "MCC is almost never null because: if NAICS exists → rel_naics_mcc calculates MCC. "
                          "Shows 5614 ('Fast Food'→actually Fallback) when AI returned last resort. "
                          "mcc_description shows 'Fallback MCC per instructions...' when AI had no evidence.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What is the difference between mcc_code, mcc_code_found, and mcc_code_from_naics?",
                 "mcc_code_found = the MCC returned directly by the AI enrichment (response.mcc_code). "
                 "mcc_code_from_naics = calculated by looking up the winning naics_code in rel_naics_mcc table. "
                 "mcc_code = the final displayed value: mcc_code_found ?? mcc_code_from_naics. "
                 "The AI-provided MCC is preferred over the calculated one."),
                ("Why does MCC Description show 'Fallback MCC per instructions...'?",
                 "This internal debug text is generated by the AI enrichment system prompt (aiNaicsEnrichment.ts L114) "
                 "when the AI has no vendor evidence and returns 5614 as last resort. "
                 "The mcc_description fact stores this text verbatim and the UI displays it directly. "
                 "Fix: change the AI prompt to return 'Classification pending — insufficient public data available.' instead."),
                ("Is rel_naics_mcc a 1-to-1 mapping?",
                 "One NAICS maps to one MCC via the rel_naics_mcc table. "
                 "The code does naicsInfo.find(naics => !!naics.mcc_code)?.mcc_code — it takes the first match. "
                 "If NAICS = 561499 (fallback), the rel_naics_mcc lookup may return 5614 (Admin Services) "
                 "or the AI may have returned 5814 (Fast Food Restaurants) directly — "
                 "these are two different mechanisms producing the MCC."),
            ],
        },
        "TIN Verified Badge (Business Registration)": {
            "ui_label": "Business Registration — ✅ Verified / ❌ Not Found badge",
            "sub_tab": "Business Registration",
            "fact_name": "tin_match",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.tin_match.value.status",
            "react_code": "index.tsx L137-L149: tin_match.value.status==='success' → 'Verified' (green_tick). "
                          "status==='failure' → 'Not Found' (red). Otherwise: capitalize(status) (red).",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (133, 150),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (429, 481),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "reviewTasks.find(task => task.key==='tin'). Returns {status, message, sublabel}"),
                ("Trulioo", "pid=38", "w=0.8", "UK/Canada only — TIN-to-name match via Trulioo KYB"),
            ],
            "winner_rule": "factWithHighestConfidence() — Middesk wins (weight=2.0) for US. "
                           "Trulioo preferred for UK/Canada via truliooPreferredRule.",
            "storage": [
                "rds_warehouse_public.facts  name='tin_match'  {status, message, sublabel}",
                "rds_warehouse_public.facts  name='tin_match_boolean'  (boolean: status==='success')",
            ],
            "null_cause": "Badge shows as 'Not Found' when Middesk TIN task returns status!=='success'. "
                          "This means IRS could not confirm the TIN+legal name match. "
                          "Causes: incorrect TIN submitted, name mismatch, business not yet in IRS records, "
                          "sole proprietor using personal SSN instead of EIN.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (768, 790),
            "questions": [
                ("Can a business have 'Business Registration: Verified' AND 'No Registry Data'?",
                 "YES — and this is NOT contradictory. These are two completely different checks:\n"
                 "• 'Business Registration: Verified' badge = tin_match.value.status === 'success' "
                 "(Middesk confirmed TIN+name via IRS). The EIN exists and matches the legal name.\n"
                 "• 'No Registry Data to Display' = sos_filings.value is empty "
                 "(Middesk searched SoS databases and found no state filings for this TIN).\n"
                 "A business can have a valid EIN confirmed by IRS but no SoS filing "
                 "(e.g., sole proprietors are not required to file with SoS in most states)."),
                ("What exactly does 'Verified' mean — verified against what?",
                 "Verified via Middesk's IRS TIN Match service. Middesk submits the EIN + business name "
                 "to the IRS TIN Matching program. 'success' means the IRS confirmed the TIN and name are a match. "
                 "This is NOT verification against a state SoS database — that is a separate check (sos_match)."),
            ],
        },
        "SoS Verified Badge (Business Registration)": {
            "ui_label": "Secretary of State Filings — ✅ Verified / ⚠️ Unverified / 🔴 Missing Active Filing badge",
            "sub_tab": "Business Registration",
            "fact_name": "sos_match_boolean + sos_active",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.sos_match_boolean + sos_active",
            "react_code": "SectionHeader.tsx L12-L42: getSosBadgeConfig(). "
                          "VERIFIED: sos_match_boolean=true AND sos_active=true. "
                          "MISSING_ACTIVE_FILING (inactive): sos_match_boolean=true AND sos_active=false. "
                          "UNVERIFIED: sos_match='warning'. Default: MISSING_ACTIVE_FILING (none).",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/SectionHeader.tsx",
            "react_lines": (12, 42),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (1371, 1440),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[] → active=status==='active', sos_match from review tasks"),
                ("OpenCorporates", "pid=23", "w=0.9", "current_status='Active' → sos_active; sosFilings[] array"),
            ],
            "winner_rule": "factWithHighestConfidence() — Middesk wins. OC is fallback.",
            "storage": [
                "rds_warehouse_public.facts  name='sos_filings'  (array of SoSRegistration objects)",
                "rds_warehouse_public.facts  name='sos_active'  (boolean)",
                "rds_warehouse_public.facts  name='sos_match'  (object: status/message)",
                "rds_warehouse_public.facts  name='sos_match_boolean'  (boolean)",
            ],
            "null_cause": "'No Registry Data to Display' appears when isNonEmptyArray(sos_filings.value) is false. "
                          "This means Middesk searched all 50 US SoS databases by TIN+name and found ZERO registrations. "
                          "NOT a confidence threshold — if Middesk finds nothing, nothing is shown.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What do 'Domestic' and 'Primary' badges mean on Entity Jurisdiction Type?",
                 "'Domestic' comes from sos_filings[n].foreign_domestic field. "
                 "In kyb/index.ts L717-L780: Middesk jurisdiction field is checked — "
                 "if it contains 'domestic' or 'foreign', that string is used. "
                 "For OC: if home_jurisdiction_code === jurisdiction_code → 'domestic', else → 'foreign'.\n"
                 "'Primary' is added by the admin portal UI for the first (index=0) sos_filing in the array. "
                 "It is a Worth UI label, not a vendor-provided field. "
                 "The first element in the sorted sos_filings array is considered the primary filing."),
                ("If a business has SoS filings in 3 states, which officers does Worth show?",
                 "Officers are shown PER FILING, matched by sos.id. "
                 "In index.tsx L361-L375: kybFactsData.data.people.value is filtered by "
                 "person.source.some(src => src.id === sos.id || src === sos.id). "
                 "This means each SoS filing card shows only the officers associated with THAT specific filing. "
                 "All 3 state filings are shown with their respective officers."),
                ("What causes Filing Status to show 'Inactive' or 'N/A'?",
                 "'Active' = sos.active === true = Middesk registrations[n].status === 'active'.\n"
                 "'Inactive' = sos.active === false = Middesk returned a non-active status.\n"
                 "'N/A' = sos.active === null = Middesk did not return a status for this filing.\n"
                 "Source: index.tsx L312-L316: sos.active != null ? capitalize(sos.active ? 'Active' : 'Inactive') : 'N/A'"),
            ],
        },
        "Industry Name (Background tab)": {
            "ui_label": "Industry Name", "sub_tab": "Background",
            "fact_name": "industry",
            "api_path": "GET /facts/business/:id/details → businessDetailFacts.industry.value.name",
            "react_code": "Industry.tsx L31-L33: businessDetailFacts?.industry?.value?.name ?? business?.industry?.name ?? '-'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
            "react_lines": (31, 33),
            "backend_fact_file": "integration-service/lib/facts/businessDetails/index.ts",
            "backend_fact_lines": (285, 320),
            "sources_ordered": [
                ("Derived from naics_code", "calculated", "—", "First 2 digits of naics_code → core_business_industries lookup"),
                ("ZoomInfo", "pid=24", "w=0.8", "zi_c_industry field (if available)"),
                ("businessDetails", "pid=0", "w=0.2", "Applicant-submitted industry name"),
            ],
            "winner_rule": "Industry is primarily derived from the winning naics_code 2-digit sector prefix. "
                           "It is a dependent fact that reads the resolved naics_code.",
            "storage": [
                "rds_warehouse_public.facts  name='industry'  {name, id}",
                "rds_cases_public.data_businesses.industry → core_business_industries.id",
                "core_business_industries table: id, name, naics_sector_code",
            ],
            "null_cause": "Shows '-' when: (1) naics_code is null (no vendor returned NAICS), "
                          "(2) naics_code is 561499 (may still map to an industry name), "
                          "(3) 2-digit NAICS prefix has no matching entry in core_business_industries.",
            "w360": False,
            "questions": [
                ("Is Industry Name derived from NAICS at render time or stored separately?",
                 "It is stored separately as a fact (name='industry') in rds_warehouse_public.facts. "
                 "It is computed by the Fact Engine as a dependent fact that reads the resolved naics_code "
                 "and looks up the 2-digit sector in core_business_industries. "
                 "If the NAICS code updates via re-enrichment, the industry fact also updates via the same pipeline. "
                 "The admin portal reads businessDetailFacts.industry.value.name, not a computed field."),
                ("What does 'Administrative and Support and Waste Management...' mean?",
                 "This is the NAICS sector name for sector 56 (Administrative and Support and Waste Management and Remediation Services). "
                 "It appears when NAICS code = 561499, which belongs to sector 56. "
                 "561499 itself = 'All Other Business Support Services'. "
                 "The industry NAME in the Background tab is the sector (2-digit), "
                 "while the NAICS Description is the 6-digit code description."),
            ],
        },
        "Watchlist Hits (Watchlists tab)": {
            "ui_label": "Watchlist hits count badge + individual hit cards",
            "sub_tab": "Watchlists",
            "fact_name": "watchlist + individualWatchListHits",
            "api_path": "GET /facts/business/:id/kyb (watchlist.value.metadata) + GET /verification/businesses/:id/people/watchlist",
            "react_code": "index.tsx L558-L574: badge text = metadata.length > 0 ? 'N Hits Found' : 'No Hits'. "
                          "index.tsx L685-L708: per-person hit cards from individualWatchListHits.data.records.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (554, 709),
            "backend_fact_file": "integration-service/lib/facts/rules.ts",
            "backend_fact_lines": (273, 344),
            "sources_ordered": [
                ("Middesk", "pid=16", "—", "reviewTasks[type='watchlist'] — OFAC, BIS, State Dept lists"),
                ("Trulioo (business)", "pid=38", "—", "Business watchlist screening"),
                ("Trulioo (person)", "pid=38", "—", "Per-owner screening via GET /people/watchlist endpoint"),
            ],
            "winner_rule": "combineWatchlistMetadata rule: merges hits from ALL sources, "
                           "deduplicates by type|title/agency|entity_name|url key. "
                           "Adverse media hits are filtered out from the combined list.",
            "storage": [
                "rds_warehouse_public.facts  name='watchlist'  {metadata:[], message:''}",
                "rds_warehouse_public.facts  name='watchlist_hits'  (integer count)",
                "rds_warehouse_public.facts  name='watchlist_raw'  (full merged data)",
                "integration_data.request_response  (raw Middesk + Trulioo responses)",
            ],
            "null_cause": "'No Hits Found' = watchlist.value.metadata.length === 0 after deduplication. "
                          "This is the NORMAL result for most businesses. "
                          "Section is HIDDEN entirely for Canadian businesses (excludedCountriesForVerification L39).",
            "w360": False,
            "questions": [
                ("Which 14 watchlists are checked?",
                 "From the UI (index.tsx L582-L679) and KYB-Tab-Admin-Portal.md:\n"
                 "OFAC: SDN, Capta List, Foreign Sanctions Evaders, Non-SDN Menu-Based, Non-SDN Iranian, "
                 "Non-SDN Chinese Military-Industrial Complex, Non-SDN Palestinian Legislative Council, Sectoral Sanctions.\n"
                 "BIS: Entity List, Denied Persons List, Military End User, Unverified List.\n"
                 "State Dept: ITAR Debarred, Nonproliferation Sanctions.\n"
                 "These lists are checked for: the business (by legal name + DBA) and each corporate officer/principal."),
                ("Does adverse media appear in Watchlists?",
                 "No — adverse media is explicitly FILTERED OUT from the combined watchlist. "
                 "In combineWatchlistMetadata (rules.ts L273-L344): "
                 "filteredMetadata = allMetadata.filter(hit => hit.type !== WATCHLIST_HIT_TYPE.ADVERSE_MEDIA). "
                 "Adverse media appears in the Public Records tab instead."),
                ("If both Middesk and Trulioo find the same OFAC hit, does the user see it twice?",
                 "No — combineWatchlistMetadata deduplicates using the key: "
                 "type|metadata.title|entity_name|url. If the same hit appears in both Middesk "
                 "and Trulioo responses with matching fields, it is shown once."),
            ],
        },
    }

    selected_field = st.selectbox("Select a field to explore its lineage",
                                  list(FIELD_CATALOG.keys()))
    fld = FIELD_CATALOG[selected_field]

    st.markdown(f'## {fld["ui_label"]}')
    st.markdown(f'<span class="badge b-blue">Sub-tab: {fld["sub_tab"]}</span> '
                f'<span class="badge b-grey">Fact: {fld["fact_name"]}</span> '
                f'{"<span class=badge b-green>✅ Worth 360 Report</span>" if fld.get("w360") else ""}',
                unsafe_allow_html=True)
    st.markdown("")

    t1, t2, t3, t4, t5 = st.tabs(["🖥️ UI Rendering", "📡 Sources & Lineage", "🗄️ Storage", "❓ Q&A", "⚠️ Null Causes"])

    with t1:
        st.markdown("### API Call")
        st.code(fld["api_path"], language=None)
        st.markdown("### React Component Code")
        st.code(fld["react_code"], language="typescript")
        st.markdown(src_ref("ADMIN_PORTAL", fld["react_file"],
                             fld["react_lines"][0], fld["react_lines"][1],
                             "Exact line that renders this field"), unsafe_allow_html=True)

    with t2:
        st.markdown("### Data Sources (in priority order)")
        card(f"<b>Winner rule:</b> {fld['winner_rule']}")
        thtml = """<table class="t"><tr><th>#</th><th>Source</th><th>Platform ID</th><th>Weight</th><th>What it provides</th></tr>"""
        for i, (name, pid, w, detail) in enumerate(fld["sources_ordered"], 1):
            wnum = float(w.replace("w=","")) if w.startswith("w=") else 0
            wc = "#FCD34D" if wnum >= 2 else ("#6EE7B7" if wnum >= 0.8 else "#94A3B8")
            thtml += (f"<tr><td style='color:#475569;'>{i}</td>"
                      f"<td style='color:#E2E8F0;font-weight:600;'>{name}</td>"
                      f"<td><code>{pid}</code></td>"
                      f"<td><b style='color:{wc}'>{w}</b></td>"
                      f"<td style='color:#94A3B8;font-size:.82rem;'>{detail}</td></tr>")
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        st.markdown("### Backend Fact Definition")
        st.markdown(src_ref("SIC_UK", fld["backend_fact_file"],
                             fld["backend_fact_lines"][0], fld["backend_fact_lines"][1],
                             "Fact wiring in integration-service"), unsafe_allow_html=True)
        st.markdown("### Data Flow")
        st.code(f"""Business Submitted
       │
       ▼
Vendor API calls in parallel:
{chr(10).join("  " + s[0] + " (" + s[1] + ", " + s[2] + ")" for s in fld["sources_ordered"])}
       │
       ▼
Fact Engine: {fld['winner_rule'][:80]}...
       │
       ▼
rds_warehouse_public.facts  name='{fld["fact_name"]}'
       │
       ▼
GET /facts/business/:id/details OR /kyb
       │
       ▼
Admin Portal: {fld["sub_tab"]} sub-tab → {fld["ui_label"]}""", language=None)

    with t3:
        st.markdown("### Storage Tables")
        for table in fld["storage"]:
            st.markdown(f"- `{table}`")
        if fld.get("w360"):
            st.markdown("### Worth 360 Report")
            card(f"This field appears in the Worth 360 Report.", "card-green")
            st.markdown(src_ref("SIC_UK", f"integration-service/src/messaging/kafka/consumers/handlers/{fld['w360_file']}",
                                 fld["w360_lines"][0], fld["w360_lines"][1],
                                 "report.ts — fetches this fact for W360"), unsafe_allow_html=True)
        st.code("""-- Query to see current value for a business:
SELECT name, value, received_at
FROM rds_warehouse_public.facts
WHERE business_id = '<your_business_id>'
  AND name = '{fact_name}'
ORDER BY received_at DESC LIMIT 1;

-- The value JSONB contains:
-- { "value": ..., "source": {"platformId": N, "confidence": X}, "alternatives": [...] }
-- alternatives[] shows ALL vendor responses before the winner was selected""", language="sql")

    with t4:
        for q, a in fld["questions"]:
            with st.expander(f"❓ {q}"):
                card(a, "card-teal")

    with t5:
        card(f"<b>When this field is blank / shows '-' / shows N/A:</b><br>{fld['null_cause']}", "card-amber")
        card("<b>Rule 4 — No minimum confidence cutoff:</b><br>"
             "Worth AI does NOT suppress field values because confidence is 'too low'. "
             "If a vendor returned a value, it is a valid candidate regardless of its confidence score. "
             "The only reason a field is blank is that no vendor returned a value for this business.",
             "card-green")


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  3 — BADGE & STATE DECODER                                        ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🔰  Badge & State Decoder":
    sh("🔰  Badge & State Decoder — Every Badge/Status in the Admin Portal Explained")

    badges = [
        {
            "badge": "✅ Verified (Business Registration)", "kind": "green",
            "where": "Business Registration card header",
            "condition": "tin_match.value.status === 'success'",
            "source": "Middesk TIN Match task → IRS confirms EIN + legal name match",
            "react_file": "KnowYourBusiness/index.tsx L137-L148",
            "backend_file": "kyb/index.ts L429-L449",
            "null_case": "Shows 'Not Found' (red) when status !== 'success'. Shows nothing for CA businesses.",
            "questions": "Verified = IRS confirmed TIN matches legal name. NOT a SoS check.",
        },
        {
            "badge": "✅ Verified (SoS Filings)", "kind": "green",
            "where": "Secretary of State Filings card header",
            "condition": "sos_match_boolean.value === true AND sos_active.value === true",
            "source": "Middesk: found a SoS filing (sos_match=true) AND filing is active (status='active')",
            "react_file": "SectionHeader.tsx L15-L28 (getSosBadgeConfig)",
            "backend_file": "kyb/index.ts L1371-L1440",
            "null_case": "If no badge shown: Canadian business (excluded). If Unverified: sos_match='warning'.",
            "questions": "SoS Verified ≠ TIN Verified. A business can have one but not the other.",
        },
        {
            "badge": "⚠️ Unverified (SoS Filings)", "kind": "amber",
            "where": "Secretary of State Filings card header",
            "condition": "sos_match.value === 'warning'",
            "source": "Middesk found a filing but its status is unknown/unconfirmed",
            "react_file": "SectionHeader.tsx L30-L35",
            "backend_file": "kyb/index.ts L1371-L1440",
            "null_case": "Less common — occurs when Middesk returns a filing with ambiguous status.",
            "questions": "Tooltip: 'A filing was found but its status is unknown.'",
        },
        {
            "badge": "🔴 Missing Active Filing (SoS)", "kind": "red",
            "where": "Secretary of State Filings card header",
            "condition": "sos_match_boolean=true AND sos_active=false (inactive filing) OR sos_match_boolean=false (no filing found)",
            "source": "Middesk found a filing that is inactive, OR found no filing at all",
            "react_file": "SectionHeader.tsx L19-L28 + SOSBadges.ts",
            "backend_file": "kyb/index.ts L1371-L1440",
            "null_case": "Tooltip variants: 'A filing was found but is not currently active' vs 'No active SoS filing found'.",
            "questions": "Two sub-cases: (1) filing exists but inactive, (2) no filing found at all — both show red badge.",
        },
        {
            "badge": "✅ Verified (Contact Information — Address)", "kind": "green",
            "where": "Contact Information → Addresses section header",
            "condition": "address_verification_boolean.value === true OR address_match_boolean.value === true",
            "source": "Middesk address verification task OR address_match fact",
            "react_file": "KnowYourBusiness/index.tsx L413-L424",
            "backend_file": "kyb/index.ts (address_verification, address_match facts)",
            "null_case": "Shows 'Warning' when address_match='warning' or address_registered_agent.status='warning'.",
            "questions": "Address Verified = found in public records AND matches submitted address.",
        },
        {
            "badge": "⚠️ Unverified (Contact Information — Address)", "kind": "amber",
            "where": "Contact Information → individual address rows",
            "condition": "address not in address_match results",
            "source": "Reported address (from Middesk/OC/ZI) does not match any verified record",
            "react_file": "KnowYourBusiness/index.tsx",
            "backend_file": "kyb/index.ts address_verification fact",
            "null_case": "Last Reported Address variant with different suite number shows Unverified.",
            "questions": "Multiple addresses can appear — each gets its own Verified/Unverified badge.",
        },
        {
            "badge": "✅ Deliverable (Address)", "kind": "green",
            "where": "Contact Information → Reported Address rows",
            "condition": "address is in addresses_deliverable.value[] array",
            "source": "USPS address deliverability check — address is a real deliverable postal address",
            "react_file": "KnowYourBusiness/index.tsx L82-L106 (addressesDeliverable function)",
            "backend_file": "kyb/index.ts addresses_deliverable fact",
            "null_case": "Shows nothing / not deliverable when address is NOT in addresses_deliverable set.",
            "questions": "Deliverable = USPS confirms this is a real mailable address. Separate from Business Registration verification.",
        },
        {
            "badge": "✅ Verified (Business Names)", "kind": "green",
            "where": "Contact Information → Business Names section header",
            "condition": "name_match_boolean.value === true",
            "source": "Middesk name match task — submitted name matches public records",
            "react_file": "KnowYourBusiness/index.tsx L491-L505",
            "backend_file": "kyb/index.ts (name_match_boolean fact)",
            "null_case": "Shows 'Failure' (red) when name_match_boolean=false. Shows status label from name_match.value.sublabel on warning.",
            "questions": "Name Verified = submitted business name found in SoS/IRS records. Can show DBA names found in addition.",
        },
        {
            "badge": "✅ No Hits (Watchlists)", "kind": "green",
            "where": "Watchlists sub-tab — entity name sections",
            "condition": "Per-entity hits array is empty",
            "source": "combineWatchlistMetadata returned no entries for this entity name",
            "react_file": "WatchlistTitleNew.tsx",
            "backend_file": "rules.ts L273-L344 (combineWatchlistMetadata)",
            "null_case": "No Hits = searched and found nothing. This is the EXPECTED normal state.",
            "questions": "Each entity name (business + each officer) gets its own No Hits / N Hits badge.",
        },
        {
            "badge": "N Hits Found (Watchlists)", "kind": "red",
            "where": "Watchlists sub-tab — entity name section",
            "condition": "watchlist hit cards exist for this entity after deduplication",
            "source": "Middesk + Trulioo watchlist screening — found matches on OFAC/BIS/State Dept lists",
            "react_file": "KnowYourBusiness/index.tsx L685-L708",
            "backend_file": "rules.ts L273-L344",
            "null_case": "N = count of unique hits after combineWatchlistMetadata deduplication.",
            "questions": "Each hit shows: list name (agency), entity name, country, source link.",
        },
        {
            "badge": "Integrations are currently processing (orange banner)", "kind": "amber",
            "where": "Bottom-right of admin portal during processing",
            "condition": "is_integration_complete === false from data_integration_tasks_progress",
            "source": "case-management.ts L1570-L1574: LEFT JOIN data_integration_tasks_progress → is_complete",
            "react_file": "CaseDetails.tsx or ViewCaseDetails.tsx",
            "backend_file": "case-management.ts L1555-L1574",
            "null_case": "Banner disappears when all integration tasks are marked complete.",
            "questions": "This banner means Middesk, Trulioo, SERP, ZI, EFX vendor calls are still running. "
                         "KYB data will update automatically when they complete.",
        },
        {
            "badge": "Integration processing is now complete ✅ (green banner)", "kind": "green",
            "where": "Bottom-right — appears briefly when all integrations finish",
            "condition": "is_integration_complete transitions to true",
            "source": "Kafka event from integration-service when all tasks complete",
            "react_file": "Real-time update via WebSocket or polling",
            "backend_file": "data_integration_tasks_progress table",
            "null_case": "Banner auto-dismisses. If never appears, check integration task logs.",
            "questions": "After this banner, the KYB tab fields should be fully populated.",
        },
    ]

    for b in badges:
        badge_html = pbadge(b["badge"], b["kind"])
        with st.expander(f"{b['badge']}  ·  {b['where']}"):
            c1, c2 = st.columns([3, 1])
            with c1:
                st.markdown(f"**Where it appears:** {b['where']}")
                st.markdown(f"**Condition that produces this badge:**")
                st.code(b["condition"], language="typescript")
                st.markdown(f"**Source / vendor:** {b['source']}")
                st.markdown(f"**When blank or different state:** {b['null_case']}")
                card(f"💡 {b['questions']}", "card-teal")
            with c2:
                st.markdown(badge_html, unsafe_allow_html=True)
                st.markdown(src_ref("ADMIN_PORTAL",
                    f"customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/{b['react_file'].split('/')[-1]}",
                    1, 10, "React code"), unsafe_allow_html=True)


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  4 — NAICS / MCC DEEP DIVE                                        ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "⚠️  NAICS / MCC Deep Dive":
    sh("⚠️  NAICS / MCC Deep Dive — Full Lineage, Rules, 561499 Root Cause")

    naics_page = st.radio("View", [
        "🔗 NAICS/MCC Full Lineage",
        "⚠️ 561499 Root-Cause Analysis",
        "🔧 Gap Analysis & Fix Roadmap",
        "💡 The 6 Fact Engine Rules (Correct)",
    ], label_visibility="collapsed", horizontal=True)

    if naics_page == "🔗 NAICS/MCC Full Lineage":
        st.markdown("### How NAICS and MCC flow from vendors to the admin portal")

        card("""<b>What the user sees in Background tab:</b><br>
        Industry Name · NAICS Code · NAICS Description · MCC Code · MCC Description<br><br>
        All 5 fields are populated from <code>GET /facts/business/:id/details</code>
        via <code>useGetFactsBusinessDetails</code>.
        The React component is <code>Industry.tsx</code> which renders
        <code>businessDetailFacts.naics_code.value</code> etc.
        Shows <b>'-'</b> (dash) when both the facts API and the business DB return null/undefined.
        """)
        st.markdown(src_ref("ADMIN_PORTAL",
            "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
            1, 95, "Industry.tsx — renders all 5 NAICS/MCC fields"), unsafe_allow_html=True)

        st.markdown("### naics_code — 7 Sources in Priority Order")
        src_tbl = """<table class="t"><tr><th>Priority</th><th>Source</th><th>Platform ID</th><th>Weight</th><th>Data path</th><th>Table</th></tr>"""
        rows = [
            ("1 (highest)", "OpenCorporates", "23", "0.9", "industry_code_uids parsed for 'us_naics-XXXXXX'", "warehouse.oc_companies_latest"),
            ("2", "ZoomInfo", "24", "0.8", "firmographic.zi_c_naics6", "zoominfo.comp_standard_global"),
            ("3", "Trulioo", "38", "0.7", "standardizedIndustries[n].naicsCode", "integration_data.request_response"),
            ("4", "Equifax", "17", "0.7", "efx.primnaicscode", "warehouse.equifax_us_latest"),
            ("5", "SERP", "22", "0.3", "businessLegitimacyClassification.naics_code", "integration_data.request_response"),
            ("6", "Applicant", "0", "0.2", "naics_code from onboarding form (/^\\d{6}$/)", "rds_cases_public.data_businesses"),
            ("7 (lowest/fallback)", "AI Enrichment", "31", "0.1", "response.naics_code (last resort = 561499)", "integration_data.request_response"),
        ]
        for r in rows:
            wnum = float(r[3])
            wc = "#6EE7B7" if wnum >= 0.8 else ("#FCD34D" if wnum >= 0.3 else "#F87171")
            src_tbl += (f"<tr><td style='color:#94A3B8'>{r[0]}</td>"
                        f"<td style='color:#E2E8F0;font-weight:600'>{r[1]}</td>"
                        f"<td><code>{r[2]}</code></td>"
                        f"<td><b style='color:{wc}'>{r[3]}</b></td>"
                        f"<td style='color:#94A3B8;font-size:.82rem'>{r[4]}</td>"
                        f"<td style='color:#475569;font-size:.78rem'>{r[5]}</td></tr>")
        st.markdown(src_tbl + "</table>", unsafe_allow_html=True)
        st.markdown(src_ref("SIC_UK",
            "integration-service/lib/facts/businessDetails/index.ts",
            318, 360, "naics_code fact wiring — all 7 sources"), unsafe_allow_html=True)

        st.markdown("### mcc_code — 3-Path Resolution")
        st.code("""// From businessDetails/index.ts L391-L440:

mcc_code_found = {
  source: AINaicsEnrichment,
  path: "response.mcc_code"           // AI returns MCC directly
}

mcc_code_from_naics = {
  dependencies: ["naics_code"],
  fn: internalGetNaicsCode(naics_code) → rel_naics_mcc lookup → mcc_id
}

mcc_code = {
  dependencies: ["mcc_code_found", "mcc_code_from_naics"],
  fn: mcc_code_found?.value ?? mcc_code_from_naics?.value
  // AI-provided MCC takes precedence over calculated MCC
}""", language="typescript")

        st.markdown("### Storage Flow")
        st.code("""NAICS/MCC Storage Flow:
integration_data.request_response  (raw vendor API responses)
         │
         ▼ (Fact Engine resolves winner)
rds_warehouse_public.facts
  name='naics_code'      → { value: "722511", source: {platformId: 23, confidence: 0.91} }
  name='naics_description' → { value: "Full-Service Restaurants" }
  name='mcc_code'        → { value: "5812" }
  name='mcc_description' → { value: "Restaurants" }
  name='industry'        → { value: {name: "Accommodation and Food Services", id: 12} }
         │
         ▼ (case-service writes naics_id FK)
rds_cases_public.data_businesses
  naics_id → core_naics_code.id
  mcc_id   → core_mcc_code.id (via rel_naics_mcc)
         │
         ▼ (admin portal reads)
GET /facts/business/:id/details → businessDetailFacts.naics_code.value
Admin Portal: Background tab → Industry section""", language=None)

    elif naics_page == "⚠️ 561499 Root-Cause Analysis":
        # Charts
        fig, axes = plt.subplots(1, 2, figsize=(13, 5), facecolor=BG)
        fig.suptitle(f"Why {N_561499:,} Businesses Show NAICS 561499 in the Admin Portal",
                     color=TEXT, fontsize=12, fontweight="bold")
        ax, ax2 = axes
        ax.set_facecolor(BG)
        ax.pie([5348, 1], colors=[RED, GREEN], startangle=90,
               wedgeprops={"width": 0.55, "edgecolor": BG})
        ax.set_title("Scenario Distribution", color=TEXT, fontsize=10)
        ax.legend(["C: Zero vendor NAICS — AI blind (5,348 / 99.98%)",
                   "E: AI not triggered (1 / 0.02%)"],
                  facecolor=GRID, labelcolor=TEXT, fontsize=8,
                  loc="lower center", bbox_to_anchor=(0.5, -0.35), edgecolor="none")
        ax2.set_facecolor(BG)
        bars = ax2.bar(["C: No vendor\nNAICS (AI blind)", "E: AI not\ntriggered"],
                       [5348, 1], color=[RED, GREEN], width=0.55, edgecolor=BG)
        for bar, val in zip(bars, [5348, 1]):
            ax2.text(bar.get_x()+bar.get_width()/2, bar.get_height()+N_561499*.005,
                     f"{val:,}\n({100*val//N_561499}%)", ha="center", color=TEXT, fontsize=9, fontweight="bold")
        ax2.set_ylabel("Business Count", color=SUB)
        ax2.set_title("Count per Scenario", color=TEXT, fontsize=10)
        ax2.tick_params(colors=SUB)
        for sp in ax2.spines.values(): sp.set_edgecolor(GRID)
        ax2.yaxis.grid(True, color=GRID, linewidth=0.6, linestyle="--")
        ax2.set_axisbelow(True); ax2.set_ylim(0, N_561499*1.18)
        plt.tight_layout()
        st.image(fig_img(fig), caption="Figure 1 — Root-cause distribution. Scenario C (99.98%) = no vendor data at all.")

        c1,c2,c3,c4 = st.columns(4)
        with c1: st.markdown(metric("Total 561499 businesses", "5,349", RED), unsafe_allow_html=True)
        with c2: st.markdown(metric("Zero vendor NAICS", "5,348\n(99.98%)", RED), unsafe_allow_html=True)
        with c3: st.markdown(metric("Recoverable (P1+P2)", "~2,673\n(~50%)", TEAL), unsafe_allow_html=True)
        with c4: st.markdown(metric("561499 IS correct for", "~2,675\n(~50%)", GREY), unsafe_allow_html=True)

        card("""<b>What the analyst sees for a 561499 business:</b><br>
        Industry Name: Administrative and Support and Waste Management and Remediation Services<br>
        NAICS Code: 561499 — All Other Business Support Services<br>
        MCC Code: 5814 (or 5614)<br>
        MCC Description: <em>"Fallback MCC per instructions (no industry evidence to determine canonical MCC description)"</em><br><br>
        <b>This internal system text is shown verbatim to the analyst. It is a known gap (Gap G5).</b>
        """, "card-red")

        st.markdown("### Why 561499 Appears — The Exact Sequence of Events")
        st.code("""T+0:00  Business submitted → POST /businesses/customers/{customerID}
        │
T+0:01  Vendor lookups in parallel:
          Middesk (pid=16, w=2.0)  → Live SoS API → NO MATCH for this EIN+name
          OpenCorporates (pid=23, w=0.9) → Redshift oc_matches → NO MATCH
          ZoomInfo (pid=24, w=0.8)  → Redshift zoominfo_matches → NO MATCH
          Equifax (pid=17, w=0.7)   → Redshift efx_matches → NO MATCH
          Trulioo (pid=38, w=0.8)   → Live KYB API → NAICS field empty
          SERP (pid=22)              → Web scraping → no NAICS code found
        │
T+0:15  Fact Engine: naics_code has 0 non-AI sources → AI enrichment triggered
          (minimumSources=1 not met)
        │
T+0:16  AI (GPT-5-mini, pid=31) receives:
          business_name + address only
          naics_code: null (no vendor produced one)
          website: null (not provided; web_search NOT enabled for zero-vendor case)
        System prompt: "If no evidence → return 561499 and 5614 as last resort"
        │
T+0:17  AI returns: naics_code="561499", mcc_code="5614",
          mcc_description="Fallback MCC per instructions..."
        │
T+0:18  validateNaicsCode("561499") → 561499 IS in core_naics_code → accepted
        │
T+0:19  Kafka facts.v1 → facts table:
          name='naics_code' value={"value":"561499","source":{"platformId":31}}
          name='mcc_code' value={"value":"5614","source":{"platformId":31}}
        │
T+0:20  Admin Portal Background tab shows: NAICS 561499 / MCC 5614""", language=None)

    elif naics_page == "🔧 Gap Analysis & Fix Roadmap":
        tab_g, tab_f, tab_i = st.tabs(["Confirmed Gaps (G1-G6)", "Fix Roadmap (P1-P6)", "Implementation"])

        with tab_g:
            gaps = [
                ("G1", RED, "Entity matching finds no vendor record",
                 "5,348 businesses (99.98%)", "Both A & B",
                 "zoominfo_matches, efx_matches, oc_matches: NO ROW",
                 "XGBoost entity-matching model found no candidate above threshold. "
                 "Causes: new business, sole proprietor, generic name, address mismatch."),
                ("G2", AMBER, "AI web_search blocked when website=null",
                 "~1,069 recoverable (20%)", "Pipeline A",
                 "aiNaicsEnrichment.ts getPrompt(): web_search only enabled when params.website is set",
                 "For zero-vendor businesses without a website, the AI cannot search the web. "
                 "GPT-5-mini has web_search capability but the code blocks it."),
                ("G3", AMBER, "AI prompt has no name keyword classification step",
                 "~1,604 recoverable (30%)", "Pipeline A",
                 "aiNaicsEnrichment.ts system prompt ~line 114: 'return 561499 as last resort'",
                 "'Lisa's Nail Salon' → 561499. The prompt does not check name keywords before giving up. "
                 "Salon/Restaurant/Church/Dental → clearly deducible NAICS."),
                ("G4", GREY, "AI metadata fact not stored for fallback cases",
                 "5,349 — monitoring gap", "Pipeline A",
                 "ai_naics_enrichment_metadata fact never written for 561499 returns",
                 "Cannot monitor AI quality or track prompt improvements."),
                ("G5", RED, "Fallback MCC description shown to analysts",
                 "5,349 — UX issue", "Pipeline A",
                 "AI prompt produces 'Fallback MCC per instructions...' which is shown in the Background tab",
                 "Internal debug text is customer/analyst-facing. Should say 'Classification pending'."),
                ("G6", GREY, "Pipeline B also shows NULL NAICS",
                 "5,349", "Pipeline B",
                 "customer_files.primary_naics_code = NULL (zi_conf=0, efx_conf=0)",
                 "Confirms entity-matching failure is complete across both pipelines."),
            ]
            for gap_id, col, desc, businesses, pipeline, location, detail in gaps:
                st.markdown(
                    f'<div class="card" style="border-left-color:{col};background:#0E1E38;margin-bottom:8px;">'
                    f'<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">'
                    f'<span style="font-size:1.2rem;font-weight:900;color:{col};">{gap_id}</span>'
                    f'<span style="color:#E2E8F0;font-weight:700;">{desc}</span>'
                    f'<span class="badge b-grey">{pipeline}</span>'
                    f'</div>'
                    f'<div style="color:#94A3B8;font-size:.82rem;margin-bottom:4px;">Businesses: <b style="color:#E2E8F0">{businesses}</b></div>'
                    f'<div style="color:#94A3B8;font-size:.82rem;">Location: <code style="color:#60A5FA">{location}</code></div>'
                    f'<div style="color:#CBD5E1;font-size:.85rem;margin-top:6px;">{detail}</div>'
                    f'</div>', unsafe_allow_html=True)

        with tab_f:
            fixes = [
                ("P1", GREEN, "Name keyword → NAICS in AI prompt", "G3", "~1,604 (30%)", "Very Low",
                 "Add STEP 1 to system prompt: check name keywords before returning 561499. "
                 "salon→812113, restaurant→722511, church→813110, dental→621210, etc."),
                ("P2", TEAL, "Enable open web search for zero-vendor businesses", "G2", "~535-1,069 (10-20%)", "Low",
                 "When website=null AND no vendor NAICS: enable unrestricted web_search. "
                 "Search '[business name] [city] [state]'."),
                ("P3", BLUE, "Fix MCC description message", "G5", "5,349 (100%) UX fix", "Very Low",
                 "Replace 'Fallback MCC per instructions...' with 'Classification pending — insufficient public data available.'"),
                ("P4", PURPLE, "Store AI metadata even for fallback cases", "G4", "0 recovered — enables monitoring", "Low",
                 "Write ai_naics_enrichment_metadata fact even when returning 561499. "
                 "Enables quality monitoring and prompt improvement tracking."),
                ("P5", AMBER, "Improve entity matching coverage", "G1, G6", "Unknown", "Medium-High",
                 "(a) Increase ZI/EFX bulk data refresh frequency. "
                 "(b) Add DBA name as matching field. "
                 "(c) Add Liberty data (more micro-business coverage). "
                 "(d) Lower threshold with false-positive monitoring."),
                ("P6", GREY, "Deploy consensus.py + XGBoost API (future)", "future", "0 now; future Scenario B", "Medium",
                 "Once P5 improves entity matching coverage and Scenario B businesses appear, "
                 "the consensus layer resolves conflicts automatically."),
            ]
            for fix_id, col, title, gaps, recovered, effort, desc in fixes:
                st.markdown(
                    f'<div class="card" style="border-left-color:{col};background:#0E1E38;margin-bottom:8px;">'
                    f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
                    f'<span style="font-size:1.3rem;font-weight:900;color:{col};">{fix_id}</span>'
                    f'<span style="color:#E2E8F0;font-weight:700;">{title}</span>'
                    f'<span class="badge b-grey">Effort: {effort}</span>'
                    f'</div>'
                    f'<div style="color:#94A3B8;font-size:.82rem;">Gaps: <b style="color:{col}">{gaps}</b> · Recovered: <b style="color:#E2E8F0">{recovered}</b></div>'
                    f'<div style="color:#CBD5E1;font-size:.85rem;margin-top:6px;">{desc}</div>'
                    f'</div>', unsafe_allow_html=True)

        with tab_i:
            st.markdown("### P1 + P3: Updated AI System Prompt")
            st.code(""""CLASSIFICATION RULES — follow these steps IN ORDER before returning 561499:

STEP 1: Check business name keywords.
  nail/salon/spa/beauty      → 812113 (Nail Salons) or 812112 (Beauty Salons)
  restaurant/pizza/cafe/diner → 722511 (Full-Service Restaurants)
  dental/dentist/orthodont   → 621210 (Offices of Dentists)
  church/ministry/chapel/temple/mosque → 813110 (Religious Organizations)
  construction/contractor/hvac/roofing → 238XXX (Specialty Contractors)
  attorney/law firm/legal    → 541110 (Offices of Lawyers)
  landscap/lawn/garden       → 561730 (Landscaping Services)

STEP 2: If website not provided, search the web.
  Search: "[business name] [city] [state]"

STEP 3: Only return 561499 if ALL of the following are true:
  - No vendor NAICS available
  - Business name contains no industry keywords
  - Web search found no public information
  - Name is genuinely ambiguous (holding company, etc.)

STEP 4: When returning MCC 5614, set mcc_description to:
  "Classification pending - insufficient public data available."
  (NOT "Fallback MCC per instructions...")""", language=None)
            st.markdown(src_ref("SIC_UK",
                "integration-service/lib/aiEnrichment/aiNaicsEnrichment.ts",
                99, 115, "Current system prompt — replace with above"), unsafe_allow_html=True)

    elif naics_page == "💡 The 6 Fact Engine Rules (Correct)":
        rules = [
            (1, "#60A5FA", "factWithHighestConfidence()", "Highest confidence wins if gap > 5% (WEIGHT_THRESHOLD=0.05)", "|conf_A - conf_B| > 0.05 → higher wins", "rules.ts L36-L57"),
            (2, "#34D399", "weightedFactSelector() [Tie-break]", "Within 5%: use source weight. Middesk(2.0) > OC(0.9) > ZI(0.8) = Trulioo(0.8) > EFX(0.7) > SERP(0.3) > AI(0.1)", "Middesk→OC→ZI=Trulioo→EFX→SERP→AI", "rules.ts L63-L76"),
            (3, "#FCD34D", "manualOverride() [ALWAYS WINS]", "Analyst sets via override. Evaluated FIRST before any other rule. Beats any model/AI result.", "override present → wins unconditionally", "rules.ts L109-L123"),
            (4, "#F87171", "NO minimum confidence cutoff", "CRITICAL: No 'confidence >= X' rule. If one source returned a code at confidence 0.05 — it wins. Low confidence IS visible in API but does NOT block the code.", "any valid value from any source → eligible", "rules.ts (confirmed by absence)"),
            (5, "#A78BFA", "AI safety net", "AI fires when n_non_AI_sources < minimumSources=1 AND total < maximumSources=3. Weight=0.1 so AI rarely wins when vendors return data.", "n_non_AI < 1 AND total < 3 → AI fires", "aiNaicsEnrichment.ts L61-L64"),
            (6, "#F87171", 'Last resort: "561499"', "After AI runs: if winning NAICS NOT in core_naics_code → removeNaicsCode() → replaced with '561499'. AI prompt also explicitly uses NAICS_OF_LAST_RESORT='561499' as fallback.", "code NOT IN core_naics_code → '561499'", "aiNaicsEnrichment.ts L67, L193-L215"),
        ]
        for num, col, name, desc, formula, source in rules:
            st.markdown(
                f'<div class="card" style="border-left-color:{col};background:#0E1E38;margin-bottom:8px;">'
                f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">'
                f'<span style="font-size:1.5rem;font-weight:900;color:{col};">Rule {num}</span>'
                f'<span style="color:#E2E8F0;font-weight:700;font-size:1rem;">{name}</span>'
                f'</div>'
                f'<div style="color:#CBD5E1;font-size:.9rem;margin-bottom:4px;">{desc}</div>'
                f'<div style="font-family:Courier New;font-size:.82rem;background:#0A1628;color:{col};padding:4px 8px;border-radius:4px;margin-top:4px;">{formula}</div>'
                f'<div style="color:#475569;font-size:.75rem;margin-top:4px;">Source: {source}</div>'
                f'</div>', unsafe_allow_html=True)


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  5 — PIPELINE A VS B                                              ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🔀  Pipeline A vs B":
    sh("🔀  Pipeline A vs Pipeline B — Complete Comparison")

    c1, c2 = st.columns(2)
    with c1:
        card("""<b>🅐 Pipeline A — Real-Time (Integration Service)</b><br><br>
        Trigger: Per business submission<br>
        Vendors: ALL — Middesk, OC, ZI, EFX, Trulioo, SERP, AI, Plaid<br>
        NAICS selection: 6 Fact Engine rules (factWithHighestConfidence + 5 more)<br>
        AI fallback: YES — fires when &lt;1 non-AI source has NAICS<br>
        Output: rds_warehouse_public.facts (JSONB, 200+ facts per business)<br>
        Admin portal: ALL KYB sub-tabs read from this pipeline<br>
        Update timing: Real-time, within seconds-minutes of submission
        """, "card-green")
    with c2:
        card("""<b>🅑 Pipeline B — Batch Redshift (Warehouse Service)</b><br><br>
        Trigger: Scheduled batch (not real-time)<br>
        Vendors: ZoomInfo and Equifax ONLY<br>
        NAICS selection: CASE WHEN zi_conf &gt; efx_conf THEN zi_naics ELSE efx_naics<br>
        AI fallback: NO — NULL stays NULL<br>
        Output: datascience.customer_files (wide denormalized table)<br>
        Admin portal: NOT shown directly — used for analytics/risk models<br>
        OC/Liberty/Middesk/Trulioo: COMPLETELY IGNORED
        """, "card-amber")

    st.markdown("### Which Pipeline Populates Which Admin Portal Field?")
    field_map = {
        "NAICS Code": ("Pipeline A only", "businessDetailFacts.naics_code (from rds_warehouse_public.facts)", "Pipeline B has primary_naics_code in customer_files (not shown in portal)"),
        "MCC Code": ("Pipeline A only", "businessDetailFacts.mcc_code (from rds_warehouse_public.facts)", "Pipeline B does not store MCC"),
        "Industry Name": ("Pipeline A only", "businessDetailFacts.industry (derived from NAICS)", "Not in Pipeline B"),
        "SoS Filings (all fields)": ("Pipeline A only", "kybFactsData.sos_filings (from rds_warehouse_public.facts)", "Not in Pipeline B"),
        "TIN Verified badge": ("Pipeline A only", "kybFactsData.tin_match (from rds_warehouse_public.facts)", "Not in Pipeline B"),
        "Business Name": ("Pipeline A primary", "businessDetailFacts.business_name (from facts)", "Pipeline B: customer_files.company_name (ZI or EFX winner)"),
        "Number of Employees": ("Pipeline A primary", "businessDetailFacts.num_employees (from facts)", "Pipeline B: customer_files.employee_count (ZI or EFX winner)"),
        "Annual Revenue": ("Pipeline A primary", "businessDetailFacts.revenue (from facts)", "Pipeline B: customer_files.revenue (ZI or EFX winner)"),
        "Watchlist Hits": ("Pipeline A only", "kybFactsData.watchlist (from rds_warehouse_public.facts)", "Not in Pipeline B"),
        "Worth Score": ("Pipeline A calculation", "worth_score fact (from rds_warehouse_public.facts)", "Pipeline B: customer_files.worth_score (same value)"),
        "Address": ("Pipeline A primary", "kybFactsData.addresses (from rds_warehouse_public.facts)", "Pipeline B: customer_files.address (ZI or EFX winner)"),
    }
    thtml = """<table class="t"><tr><th>Admin Portal Field</th><th>Source Pipeline</th><th>Pipeline A path</th><th>Pipeline B</th></tr>"""
    for field, (source, pa, pb) in field_map.items():
        thtml += (f"<tr><td style='color:#E2E8F0;font-weight:600'>{field}</td>"
                  f"<td><span class='badge b-green'>{source}</span></td>"
                  f"<td style='color:#94A3B8;font-size:.82rem'>{pa}</td>"
                  f"<td style='color:#475569;font-size:.78rem'>{pb}</td></tr>")
    st.markdown(thtml + "</table>", unsafe_allow_html=True)

    st.markdown("### Pipeline B — Exact Winner-Takes-All SQL")
    st.code("""-- From customer_table.sql (sp_recreate_customer_files):
-- ONE comparison controls ALL firmographic fields:

COALESCE(
    CASE
        WHEN COALESCE(zi_match_confidence, 0) > COALESCE(efx_match_confidence, 0)
            THEN CAST(zi_c_naics6 AS INTEGER)   -- ZoomInfo NAICS + ALL ZI data wins
        ELSE CAST(efx_primnaicscode AS INTEGER)  -- Equifax NAICS + ALL EFX data wins
    END,
    naics_code   -- fallback to existing or NULL
) AS primary_naics_code

-- Same WHEN clause also controls:
-- employee_count, revenue, company_name, legal_name, address, city, ZIP, website...""", language="sql")
    st.markdown(src_ref("SIC_UK",
        "warehouse-service/datapooler/adapters/redshift/customer_file/tables/customer_table.sql",
        104, 120, "winner-takes-all SQL"), unsafe_allow_html=True)


# ╔═══════════════════════════════════════════════════════════════════╗
# ║  6 — AI AGENT                                                     ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🤖  AI Agent":
    sh("🤖  KYB Intelligence Agent — Ask Anything About the Admin Portal")

    import os
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
    if not OPENAI_API_KEY:
        try:
            import tomllib, pathlib
            for sp in [pathlib.Path.home()/".streamlit"/"secrets.toml",
                       pathlib.Path(__file__).parent/".streamlit"/"secrets.toml"]:
                if sp.exists():
                    with open(sp, "rb") as f:
                        secrets = tomllib.load(f)
                    OPENAI_API_KEY = secrets.get("OPENAI_API_KEY", "")
                    if OPENAI_API_KEY: break
        except Exception:
            pass

    card("""<b>How this agent works:</b><br>
    1. Your question (or uploaded image/file) is matched against <b>564 indexed code chunks</b>
    from Admin-Portal-KYB + SIC-UK-Codes repos.<br>
    2. Top relevant chunks retrieved (exact compound-term boosting — e.g. 'tin_match_boolean' scores 20× per match).<br>
    3. GPT-4o synthesises an answer citing exact file + line numbers.<br>
    4. Every answer is verifiable — click the GitHub links in the source chunks below.
    """, "card-teal")

    if not OPENAI_API_KEY:
        card("⚠️ No OPENAI_API_KEY found. Run with: OPENAI_API_KEY='sk-...' python3 -m streamlit run kyb_portal_app.py", "card-red")

    # Suggested questions
    st.markdown("#### Quick Questions — click to ask:")
    suggestions = [
        "Why does 'Business Registration: Verified' appear with 'No Registry Data to Display'?",
        "Where does the ✅ Verified badge on Business Registration come from in the code?",
        "What rule produces the SoS Verified/Unverified/Missing Active Filing badge?",
        "How is Industry Name derived from NAICS code?",
        "Why does NAICS show 561499 and MCC description show 'Fallback MCC per instructions'?",
        "Which API endpoint powers the KYB tab and what facts does it return?",
        "What is the difference between sos_match_boolean and sos_active?",
        "How does factWithHighestConfidence pick the winning NAICS vendor?",
        "What causes the Integrations are currently processing banner to appear?",
        "Why do some addresses show Deliverable and others Verified separately?",
        "Where does Corporate Officers data come from and which filing does it show?",
        "What are the 14 watchlists that Worth AI checks and where is this configured?",
    ]
    cols = st.columns(3)
    for i, q in enumerate(suggestions):
        if cols[i % 3].button(q, key=f"sq_{i}", use_container_width=True):
            st.session_state["agent_history"] = st.session_state.get("agent_history", [])
            st.session_state["agent_history"].append({"role": "user", "content": q})
            st.session_state["pending_q"] = q

    st.markdown("---")

    # Chat history
    if "agent_history" not in st.session_state:
        st.session_state["agent_history"] = []

    for msg in st.session_state["agent_history"]:
        if msg["role"] == "user":
            st.markdown(
                f'<div style="background:#1A2744;border:1px solid #2D4070;border-radius:8px;'
                f'padding:10px 14px;margin:6px 0;color:#E2E8F0;"><b>You:</b> {msg["content"]}</div>',
                unsafe_allow_html=True)
        else:
            st.markdown(
                f'<div style="background:#0C2218;border:1px solid #059669;border-radius:8px;'
                f'padding:12px 16px;margin:6px 0;">'
                f'<b style="color:#A7F3D0;">🤖 Agent:</b><br><br>'
                f'<span style="color:#E2E8F0;white-space:pre-wrap;">{msg["content"]}</span>'
                f'</div>', unsafe_allow_html=True)
            if msg.get("sources"):
                with st.expander("📚 Source code chunks used to generate this answer"):
                    for src in msg["sources"][:5]:
                        repo_url = REPO_URLS.get(src.get("source_type","SIC_UK"), "")
                        url = f"{repo_url}/{src['path']}#L{src['line_start']}-L{src['line_end']}"
                        tag = "🖥️ Admin Portal" if src.get("source_type") == "ADMIN_PORTAL" else "⚙️ Backend"
                        st.markdown(
                            f'<div class="source-ref">{tag} '
                            f'<a href="{url}" target="_blank" style="color:#60A5FA;">'
                            f'🔗 {src["path"]} L{src["line_start"]}–{src["line_end"]}</a><br>'
                            f'<span style="color:#94A3B8;">{src.get("description","")[:120]}</span>'
                            f'</div>', unsafe_allow_html=True)
                        st.code(src["text"][:600] + ("…" if len(src["text"]) > 600 else ""),
                                language="typescript" if src["path"].endswith(".tsx") or src["path"].endswith(".ts") else None)

    # File / image upload
    st.markdown("#### Upload a file or screenshot to discuss:")
    uploaded = st.file_uploader("Upload screenshot, PDF, or Excel (optional)",
                                 type=["png","jpg","jpeg","webp","pdf","xlsx"],
                                 key="agent_upload")

    col_input, col_voice = st.columns([5, 1])
    with col_input:
        user_q = st.chat_input("Ask about any field, badge, rule, or lineage in the KYB portal...")
    with col_voice:
        st.markdown("<br>", unsafe_allow_html=True)
        use_voice = st.checkbox("🎙️", help="Voice input (experimental — type your transcription)")

    pending = st.session_state.pop("pending_q", None)
    if pending:
        user_q = pending

    if user_q or (uploaded and user_q):
        full_query = user_q or ""
        if uploaded:
            full_query += f" [File attached: {uploaded.name}]"
        st.session_state["agent_history"].append({"role": "user", "content": full_query})

        with st.spinner("Searching 564 code chunks + generating answer..."):
            retrieved = rag_search(rag_index, full_query, top_k=8)

            context_parts = []
            for chunk in retrieved:
                tag = "Admin Portal Frontend" if chunk.get("source_type") == "ADMIN_PORTAL" else "Backend Service"
                context_parts.append(
                    f"--- [{tag}] {chunk['path']} L{chunk['line_start']}–{chunk['line_end']} ---\n"
                    f"[Context: {chunk.get('description','')[:200]}]\n"
                    f"{chunk['text'][:1500]}\n"
                )
            context = "\n".join(context_parts)

            image_content = None
            if uploaded and uploaded.type.startswith("image/"):
                img_bytes = uploaded.read()
                img_b64 = base64.b64encode(img_bytes).decode()
                image_content = {"type": "image_url",
                                  "image_url": {"url": f"data:{uploaded.type};base64,{img_b64}"}}

            history_for_gpt = [
                {"role": m["role"], "content": m["content"]}
                for m in st.session_state["agent_history"][:-1][-6:]
            ]

            system_prompt = """You are a precise technical assistant for the Worth AI platform admin portal KYB tab.
You answer questions about:
- Every field in the KYB tab (Background, Business Registration, Contact Information, Website, Watchlists sub-tabs)
- What badge/status states mean and what code produces them
- NAICS/MCC codes, 561499 fallback, MCC description issues
- The Fact Engine rules and vendor sources
- Data lineage from vendor API → facts table → admin portal

RULES:
1. ALWAYS cite [FILE: path L123-L145] for every claim. Use exact line numbers from the chunks.
2. Quote relevant code when available. Prefer frontend (Admin Portal) files for UI questions.
3. Use the Admin Portal repo chunks for 'what the user sees' questions.
4. Use the integration-service chunks for 'what produces this' questions.
5. Do NOT hallucinate. Only answer from provided chunks.
6. End with: "✅ Click the source code chunks below to verify these claims."
7. For image uploads: describe what you see in the screenshot and identify which field/badge it shows."""

            user_message: list = [{"type": "text", "text": f"Question: {full_query}\n\nCode chunks:\n{context}"}]
            if image_content:
                user_message.insert(0, image_content)

            if not OPENAI_API_KEY:
                answer = ("⚠️ No OPENAI_API_KEY. Run with: OPENAI_API_KEY='sk-...' python3 -m streamlit run kyb_portal_app.py\n\n"
                          "--- Retrieved chunks (no GPT synthesis) ---\n"
                          + "\n".join(f"📄 {c['path']} L{c['line_start']}:\n{c['text'][:400]}" for c in retrieved[:3]))
            else:
                try:
                    from openai import OpenAI
                    client = OpenAI(api_key=OPENAI_API_KEY)
                    messages = [{"role": "system", "content": system_prompt},
                                *history_for_gpt,
                                {"role": "user", "content": user_message}]
                    resp = client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=messages,
                        temperature=0.1,
                        max_tokens=1400,
                    )
                    answer = resp.choices[0].message.content
                except Exception as e:
                    answer = f"⚠️ GPT error: {e}\n\nChunks:\n" + "\n".join(
                        f"📄 {c['path']} L{c['line_start']}:\n{c['text'][:300]}" for c in retrieved[:3])

        st.session_state["agent_history"].append({
            "role": "assistant", "content": answer, "sources": retrieved
        })
        st.rerun()

    if st.button("🗑️ Clear conversation"):
        st.session_state["agent_history"] = []
        st.rerun()

    st.markdown("---")
    st.markdown("### 📑 Indexed Source Files (564 chunks)")
    file_counts = {}
    for chunk in rag_index["chunks"]:
        k = (chunk["path"], chunk.get("source_type", "?"))
        file_counts[k] = file_counts.get(k, 0) + 1
    thtml = """<table class="t"><tr><th>File</th><th>Type</th><th>Chunks</th><th>Covers</th></tr>"""
    for (path, stype), count in sorted(file_counts.items()):
        tag = "🖥️ Admin Portal" if stype == "ADMIN_PORTAL" else "⚙️ Backend"
        url = f"{REPO_URLS.get(stype,'')}/{path}"
        desc = next((s["description"][:80] for s in rag_index["source_files"] if s["path"]==path), "")
        thtml += (f"<tr><td><a href='{url}' target='_blank' style='color:#60A5FA;font-size:.8rem;font-family:Courier New'>{path}</a></td>"
                  f"<td style='font-size:.8rem'>{tag}</td>"
                  f"<td style='text-align:center;color:#FCD34D'>{count}</td>"
                  f"<td style='color:#475569;font-size:.78rem'>{desc}</td></tr>")
    st.markdown(thtml + "</table>", unsafe_allow_html=True)
