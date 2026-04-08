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
        "🔄  End-to-End Workflow",
        "🃏  Card-by-Card Lineage",
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
# ─── Key discoveries from microsites source code ───────────────────────
# Used by multiple sections below
ENTITY_JURISDICTION_NOTE = (
    "Domestic = business originally formed in this state (foreign_domestic='domestic'). "
    "Foreign = formed in another state, registered to operate here (foreign_domestic='foreign'). "
    "Source: EntityJurisdictionCell.tsx — JURISDICTION_CONFIG maps 'domestic'→Primary badge, 'foreign'→Secondary badge."
)
SOS_BADGE_NOTE = (
    "SOSBadge.tsx: isInvalidated→INVALIDATED(warning). sosFiling.active=true→VERIFIED(info/blue). "
    "sosFiling.active=false→MISSING ACTIVE FILING(error/red). "
    "SOSFilingCard title: US businesses='Secretary of State Filings', non-US='Registration Filing'. "
    "IMPORTANT: WatchlistsTab — backend consolidates ALL hits (business+person) into watchlist.value.metadata. "
    "No separate people endpoint needed (changed in BEST-65). "
    "Website Status 'Unknown' = websiteData not loaded yet or status field absent."
)

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
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  END-TO-END WORKFLOW                                              ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🔄  End-to-End Workflow":
    sh("🔄  End-to-End Information Workflow — From Submission to Admin Portal Display")

    card("""<b>The big picture: how does information get from the merchant to what the analyst sees?</b><br>
    This section traces the complete journey of every piece of information in the KYB tab —
    from the moment a merchant submits their application, through every vendor API call,
    through the Fact Engine winner selection, through storage, through the API response,
    all the way to the exact React component that renders it on screen.
    """, "card-teal")

    # Full workflow diagram
    st.markdown("### 🔄 The Complete KYB Data Flow")
    st.code("""
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 1: MERCHANT SUBMITS APPLICATION (T+0:00)                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Merchant fills form → POST /businesses/customers/{customerID}              ║
║  Submitted data stored in:                                                  ║
║    rds_cases_public.data_businesses  (name, tin, address, naics_code)       ║
║    rds_cases_public.data_owners      (owners: name, DOB, SSN, address)      ║
║    rds_cases_public.data_cases       (status='pending')                     ║
║  Source in app: businessDetails (pid=0, weight=1.0) — always confidence=1.0 ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 2: VENDOR LOOKUPS (T+0:01 — all parallel)                           ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Each vendor runs independently:                                            ║
║                                                                             ║
║  🏛️  Middesk (pid=16, weight=2.0) — Live REST API                          ║
║       Input: business name + address + TIN                                  ║
║       Output: SoS filings, TIN match (IRS), officers, watchlist, TIN verify ║
║       Storage: integration_data.request_response (platform_id=16)           ║
║       Confidence: 0.15 base + 0.20×tasks_passing (name/tin/address/sos)    ║
║                                                                             ║
║  🌐  OpenCorporates (pid=23, weight=0.9) — Redshift pre-loaded              ║
║       Input: business name + jurisdiction                                    ║
║       Output: SoS filings, registered name, industry_code_uids, officers    ║
║       Storage: integration_data.request_response (pid=23) + oc_companies    ║
║       Confidence: match.index / 55 (XGBoost entity-match model)             ║
║                                                                             ║
║  📊  ZoomInfo (pid=24, weight=0.8) — Redshift pre-loaded                   ║
║       Input: business name + address                                         ║
║       Output: NAICS, SIC, employees, revenue, website, phone                ║
║       Storage: integration_data.request_response (pid=24) + zi tables       ║
║       Confidence: match.index / 55                                           ║
║                                                                             ║
║  📋  Equifax (pid=17, weight=0.7) — Redshift pre-loaded                    ║
║       Input: business name + address + TIN                                   ║
║       Output: NAICS, SIC, employees, revenue, phone, minority/woman/veteran  ║
║       Storage: integration_data.request_response (pid=17) + efx tables      ║
║       Confidence: XGBoost prediction score                                   ║
║                                                                             ║
║  🔍  Trulioo (pid=38, weight=0.8) — Live REST API                          ║
║       Input: business name + address (UK/CA preferred)                       ║
║       Output: SoS, directors, watchlist screening, standardized industries   ║
║       Storage: integration_data.request_response (pid=38)                   ║
║                                                                             ║
║  🌐  SERP / Web scrape (pid=22) — async                                    ║
║       Output: website URL, Google Place ID, WHOIS domain data               ║
║       Storage: integration_data.request_response (pid=22)                   ║
║                                                                             ║
║  🔐  Plaid IDV (pid=40) — per owner, OAuth flow                            ║
║       Output: identity verification per owner (SUCCESS/FAILED/PENDING)      ║
║       Storage: integration_data.request_response (pid=40)                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 3: FACT ENGINE — WINNER SELECTION (T+0:15)                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  For EVERY fact independently (200+ facts per business):                    ║
║                                                                             ║
║  Rule 0: manualOverride() ← ALWAYS FIRST                                   ║
║  Rule 1: factWithHighestConfidence() — highest conf wins if gap > 5%        ║
║  Rule 2: weightedFactSelector() — tie-break by weight                       ║
║  Rule 3: combineFacts() — for arrays (addresses, names, people, watchlists) ║
║  Rule 4: NO minimum confidence cutoff — low-conf still wins if only value   ║
║  Rule 5: AI safety net — fires when <1 non-AI source has naics_code         ║
║  Rule 6: removeNaicsCode() — invalid AI code → replaced with 561499         ║
║                                                                             ║
║  Output stored in: rds_warehouse_public.facts                               ║
║    name='naics_code'  value={"value":"722511","source":{"platformId":23}}   ║
║    name='sos_filings' value={"value":[{...},{...}],"source":...}            ║
║    name='tin_match'   value={"value":{"status":"success"},"source":...}     ║
║    name='watchlist'   value={"value":{"metadata":[...]},"source":...}       ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 4: KAFKA + DATABASE WRITES (T+0:19)                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Kafka: facts.v1 → CALCULATE_BUSINESS_FACTS event                          ║
║  warehouse-service → rds_warehouse_public.facts (JSONB per fact)            ║
║  case-service → rds_cases_public.data_businesses                            ║
║    naics_id → FK to core_naics_code WHERE code = naics_code.value           ║
║    mcc_id   → FK to core_mcc_code (via rel_naics_mcc lookup)                ║
║    industry → FK to core_business_industries (2-digit NAICS prefix)         ║
║  data_cases.status: 'pending' → 'under_review' or 'auto_approved'          ║
║  data_integration_tasks_progress.is_complete: false → true                  ║
║   (triggers: "Integration processing is now complete ✅" banner)            ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 5: API RESPONSE (when admin portal opens the case)                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Portal calls these endpoints simultaneously:                               ║
║                                                                             ║
║  Background tab:                                                            ║
║    GET /facts/business/:id/details → factsBusinessDetails                   ║
║    (business_name, dba, primary_address, revenue, num_employees,            ║
║     naics_code, mcc_code, industry, formation_date, phone, email,           ║
║     minority_owned, woman_owned, veteran_owned)                             ║
║                                                                             ║
║  Business Registration tab:                                                 ║
║    GET /facts/business/:id/kyb → kybFactsData                              ║
║    (legal_name, tin, tin_match, tin_match_boolean,                          ║
║     sos_filings[], sos_active, sos_match_boolean,                           ║
║     names_submitted, addresses, people, watchlist)                          ║
║                                                                             ║
║  Contact Information tab: (same /kyb endpoint, no additional call)          ║
║                                                                             ║
║  Website tab:                                                               ║
║    GET /verification/businesses/:id/website-data → businessWebsiteData     ║
║    (url, domain.creation_date, domain.expiration_date, parked, status,     ║
║     pages[], business_name_match)                                           ║
║                                                                             ║
║  Watchlists tab: (same /kyb endpoint — watchlist.value.metadata)           ║
║    NOTE: backend consolidates ALL hits into watchlist.value.metadata.       ║
║    No separate /people/watchlist call needed (changed in BEST-65).         ║
╚══════════════════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║  STAGE 6: REACT RENDERING (admin.joinworth.com)                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Background tab: BackgroundTab.tsx                                          ║
║    Cards: Business Details + Industry (from fieldConfigs.tsx)               ║
║    business_name → factsBusinessDetails.data.business_name.value           ║
║    legal_name    → getFactsKybData.data.legal_name.value (read-only)       ║
║    naics_code    → factsBusinessDetails.data.naics_code.value (editable)   ║
║    mcc_code      → factsBusinessDetails.data.mcc_code.value (editable)     ║
║    Shows N/A (VALUE_NOT_AVAILABLE) when fact value is null/undefined        ║
║                                                                             ║
║  Business Registration tab: BusinessRegistrationTab.tsx                     ║
║    Business Registration card: TinBadge (tin_match_boolean → Verified)     ║
║      tin_match_boolean.value=true → ✅ Verified (blue, CheckBadgeIcon)     ║
║      tin_match_boolean.value=false → ⚠️ Unverified (warning)               ║
║    SOSFilingCard per sos_filings[n]:                                        ║
║      SOSBadge: sosFiling.active=true → ✅ Verified (info/blue)             ║
║      SOSBadge: sosFiling.active=false → 🔴 Missing Active Filing            ║
║      EntityJurisdictionCell: foreign_domestic → Domestic/Primary badge     ║
║      hasDirtyBusinessRegistrationFields → shows N/A for ALL SoS fields     ║
║                                                                             ║
║  Website tab: WebsiteTab.tsx                                                ║
║    Editable: website URL (from fieldConfigs)                                ║
║    Read-only: Creation Date, Expiration Date, Parked Domain, Status        ║
║    isWebsiteDirty=true → all non-editable fields show N/A                  ║
║    status='online' → ✅ Online badge (CheckCircleIcon)                      ║
║                                                                             ║
║  Watchlists tab: WatchlistsTab.tsx                                          ║
║    watchlist.value.metadata grouped by entity_name                          ║
║    Each entity: WatchlistHitCard or WatchlistHitNullState (No Hits)        ║
║    WatchlistsScannedCard: shows all 14 lists with hit status                ║
╚══════════════════════════════════════════════════════════════════════════════╝
""", language=None)

    st.markdown("---")
    st.markdown("### 🔑 Key Discoveries from Source Code Analysis")

    discoveries = [
        ("SOSFilingCard title changes by country",
         "SOSFilingCard.tsx: US businesses → 'Secretary of State Filings'. "
         "Non-US → 'Registration Filing'. Document title: US → 'Articles of Incorporation', non-US → 'Additional Information'.",
         BLUE),
        ("'Domestic Primary' vs 'Foreign Secondary' badge source",
         "EntityJurisdictionCell.tsx: JURISDICTION_CONFIG maps domestic→{displayLabel:'Domestic',badgeLabel:'Primary'} "
         "and foreign→{displayLabel:'Foreign',badgeLabel:'Secondary'}. "
         "The 'Primary' badge is NOT from Middesk — it is the Worth portal's label for domestic filings.",
         GREEN),
        ("SoS fields go blank when analyst edits Business Registration fields",
         "useBusinessRegistrationTabDetails.tsx: hasDirtyBusinessRegistrationFields=true → "
         "all SoS rows show VALUE_NOT_AVAILABLE. "
         "This prevents stale SoS data from showing while a re-verification is triggered by the edit.",
         AMBER),
        ("Watchlist: ALL hits now consolidated (no separate people endpoint)",
         "WatchlistsTab.tsx comment: 'The backend now consolidates all watchlist hits (business + person) "
         "into watchlist.value.metadata via trulioo_advanced_watchlist_results. "
         "No separate endpoint is needed.' Feature flag: BEST_65_PROXY_FACT.",
         TEAL),
        ("Website non-editable fields go N/A when URL is edited",
         "useWebsiteNonEditableFields.tsx: isWebsiteDirty=true → Creation Date, Expiration Date, "
         "Parked Domain, Status all show N/A. "
         "Reason: changing the website URL invalidates the WHOIS/status data until re-verified.",
         PURPLE),
        ("'Verified' in Business Registration = IRS TIN match, NOT SoS match",
         "TinBadge.tsx: reads tin_match_boolean.value. "
         "TIN Verified = IRS confirmed EIN+legal name match (via Middesk TIN Match service). "
         "SoS Verified (on SoS card) = sosFiling.active=true (SoS filing found and active). "
         "A business can be TIN Verified but have No Registry Data — these are independent checks.",
         RED),
        ("VALUE_NOT_AVAILABLE constant = 'N/A'",
         "Every field uses VALUE_NOT_AVAILABLE from @/constants when the fact value is null/undefined. "
         "This is the single constant used throughout all KYB components. "
         "It is NOT a backend concept — it is a React display fallback.",
         GREY),
    ]

    for title, detail, colour in discoveries:
        st.markdown(
            f'<div class="card" style="border-left-color:{colour};background:#0E1E38;margin-bottom:8px;">'
            f'<b style="color:{colour};">{title}</b><br>'
            f'<span style="color:#CBD5E1;font-size:.88rem;">{detail}</span>'
            f'</div>', unsafe_allow_html=True)

    st.markdown("---")
    st.markdown("### 📐 Source File Map — Where Each Card Comes From")

    source_map = """<table class="t">
    <tr><th>Admin Portal Card</th><th>Source File (microsites)</th><th>Key facts read</th><th>API endpoint</th></tr>
    <tr><td>Business Details card</td><td><code>fieldConfigs.tsx L99-L391</code></td><td>business_name, dba, primary_address, revenue, employees, phone, email...</td><td>/facts/business/:id/details</td></tr>
    <tr><td>Industry card</td><td><code>fieldConfigs.tsx L392-L469</code></td><td>industry, naics_code, naics_description, mcc_code, mcc_description</td><td>/facts/business/:id/details</td></tr>
    <tr><td>Business Registration card (TIN)</td><td><code>TaxContent.tsx + TinBadge.tsx</code></td><td>legal_name, tin, tin_match_boolean</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>SoS Filing card(s)</td><td><code>SOSFilingCard.tsx + SOSBadge.tsx + EntityJurisdictionCell.tsx</code></td><td>sos_filings[n].{active, entity_type, state, filing_date, filing_name, officers}</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>No Registry Data message</td><td><code>useBusinessRegistrationTabDetails.tsx</code></td><td>sos_filings.value = [] (empty array)</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>Addresses card</td><td><code>AddressesCard.tsx</code></td><td>addresses, addresses_deliverable, address_match_boolean, address_verification</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>Business Names card</td><td><code>BusinessNamesCard.tsx</code></td><td>names_submitted, names_found, name_match_boolean</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>Website Details card</td><td><code>WebsiteTab.tsx + useWebsiteNonEditableFields.tsx</code></td><td>website (editable), domain.creation_date, parked, status</td><td>/verification/.../website-data</td></tr>
    <tr><td>Watchlists Scanned card</td><td><code>WatchlistsScannedCard.tsx</code></td><td>watchlist (14 lists shown)</td><td>/facts/business/:id/kyb</td></tr>
    <tr><td>Watchlist Hit cards</td><td><code>WatchlistHitCard.tsx</code></td><td>watchlist.value.metadata grouped by entity_name</td><td>/facts/business/:id/kyb</td></tr>
    </table>"""
    st.markdown(source_map, unsafe_allow_html=True)

    st.markdown("### 🗄️ Storage Tables Reference")
    storage_rows = [
        ("integration_data.request_response", "Raw vendor API responses (Middesk, ZI, EFX, Trulioo, Plaid, SERP)", "Written by integration-service per vendor call", "Redshift/PostgreSQL"),
        ("rds_warehouse_public.facts", "All 200+ resolved facts per business as JSONB {value, source, alternatives[]}", "Written by warehouse-service via Kafka facts.v1", "PostgreSQL"),
        ("rds_cases_public.data_businesses", "Core business record: naics_id→FK, mcc_id→FK, industry→FK, name, address", "Written by case-service on submission + updates", "PostgreSQL"),
        ("rds_cases_public.data_owners", "Owner records: name, SSN (masked/encrypted), DOB, address, email, mobile", "Written by case-service on submission", "PostgreSQL"),
        ("rds_cases_public.data_cases", "Case: status→core_case_statuses, business_id, customer_id, timestamps", "Written by case-service", "PostgreSQL"),
        ("core_naics_code", "NAICS 2022 lookup: id, code (6-digit), label, description", "Static reference table", "PostgreSQL"),
        ("core_mcc_code", "MCC lookup: id, code (4-digit), label", "Static reference table", "PostgreSQL"),
        ("rel_naics_mcc", "NAICS→MCC mapping: naics_id → mcc_id", "Static reference table", "PostgreSQL"),
        ("core_business_industries", "Industry sector lookup: id, name, naics_sector_code (2-digit)", "Static reference table", "PostgreSQL"),
        ("datascience.customer_files", "Pipeline B wide table: primary_naics_code (ZI vs EFX winner-takes-all)", "Written by warehouse-service batch", "Redshift"),
    ]
    thtml = '<table class="t"><tr><th>Table</th><th>Contains</th><th>Written by</th><th>DB</th></tr>'
    for table, contains, writer, db in storage_rows:
        db_c = "#60A5FA" if db == "PostgreSQL" else "#FCD34D"
        thtml += (f"<tr><td><code>{table}</code></td>"
                  f"<td style='color:#94A3B8;font-size:.82rem;'>{contains}</td>"
                  f"<td style='color:#475569;font-size:.78rem;'>{writer}</td>"
                  f"<td><span style='color:{db_c};font-weight:700;'>{db}</span></td></tr>")
    st.markdown(thtml + "</table>", unsafe_allow_html=True)

# ╔═══════════════════════════════════════════════════════════════════╗
# ║  CARD-BY-CARD LINEAGE                                             ║
# ╚═══════════════════════════════════════════════════════════════════╝
elif section == "🃏  Card-by-Card Lineage":
    sh("🃏  Card-by-Card Lineage — Every Card in Every KYB Sub-Tab")

    card("""<b>Source of truth for this section:</b>
    Every field label, editability, data path, and fact name comes directly from
    <code>microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/config/BackgroundTab/fieldConfigs.tsx</code>
    (470 lines) — the authoritative field configuration file for the Background tab.
    This file defines every card, every field, whether it is editable, which fact it reads, and which API call loads it.
    """, "card-teal")
    st.markdown(src_ref("ADMIN_PORTAL",
        "microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/config/BackgroundTab/fieldConfigs.tsx",
        99, 470, "BACKGROUND_TAB_FIELD_CONFIGS — every Background tab field definition"),
        unsafe_allow_html=True)

    kyb_subtab = st.radio("Select Sub-Tab", [
        "📋 Background — Business Details Card",
        "📋 Background — Industry Card",
        "🏛️ Business Registration — All Cards",
        "📬 Contact Information — All Cards",
        "🌐 Website — All Cards",
        "🔍 Watchlists — All Cards",
    ], horizontal=False)

    if kyb_subtab == "📋 Background — Business Details Card":
        sh("📋 Background Sub-Tab — Business Details Card")
        card("""<b>API calls that populate this card:</b><br>
        • <code>GET /facts/business/:id/details</code> → <code>factsBusinessDetails</code> (businessDetails, financials)<br>
        • <code>GET /facts/business/:id/kyb</code> → <code>getFactsKybData</code> (legal_name, email, corporation, minority/woman/veteran)<br>
        Source: <code>BackgroundTab.tsx</code> — <code>useBackgroundTabData(businessId)</code>
        """)

        BDET_FIELDS = [
            {
                "label": "Provided Business Name",
                "fieldKey": "business_name",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.business_name.value",
                "factName": "business_name",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [
                    ("Applicant submission", "pid=0", "w=1.0", "Submitted at onboarding form — this is the name the merchant provided"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_name from ZoomInfo firmographic data"),
                    ("Equifax", "pid=17", "w=0.7", "efx_name from Equifax business record"),
                ],
                "winner_rule": "factWithHighestConfidence() — applicant submission (confidence=1.0) usually wins unless manually overridden",
                "storage": "rds_warehouse_public.facts name='business_name' + rds_cases_public.data_businesses.name",
                "null_cause": "Empty string only if applicant did not submit a name (very rare — required field)",
                "editable_note": "Editable by analyst. Override stored as: facts.value.override = {value, userId, timestamp}",
                "tags": ["✏️ Editable", "📝 Applicant Submitted"],
                "react_lines": (101, 115),
                "verify_sql": """SELECT name, value->>'value' AS fact_value,
       value->'source'->>'platformId' AS source_pid,
       value->'override'->>'value' AS override_value
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'business_name';""",
            },
            {
                "label": "Legal Business Name",
                "fieldKey": "legal_name",
                "editable": False,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.legal_name.value",
                "factName": "legal_name",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [
                    ("Middesk", "pid=16", "w=2.0", "businessEntityVerification.name — name found in SoS records via IRS TIN match"),
                    ("OpenCorporates", "pid=23", "w=0.9", "firmographic.name from OC global registry"),
                    ("Trulioo", "pid=38", "w=0.8", "clientData.businessName for UK/Canada"),
                ],
                "winner_rule": "factWithHighestConfidence() — Middesk wins (weight=2.0) for US. Read-only field.",
                "storage": "rds_warehouse_public.facts name='legal_name'",
                "null_cause": "Empty string when: (1) Middesk still processing, (2) Middesk could not confirm entity",
                "editable_note": "NOT editable (editable=false in fieldConfigs.tsx L120). Read-only — shows what Middesk found.",
                "tags": ["🔒 Read-Only", "🔍 Vendor-Discovered"],
                "react_lines": (116, 130),
                "verify_sql": """SELECT name, value->>'value' AS legal_name,
       value->'source'->>'platformId' AS source_pid
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'legal_name';""",
            },
            {
                "label": "DBA (Doing Business As)",
                "fieldKey": "dba",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.dba.value",
                "factName": "dba / dba_found",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [
                    ("Middesk", "pid=16", "w=2.0", "names[] where submitted=false — DBA names Middesk found in SoS"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_tradename from ZoomInfo firmographic"),
                    ("OpenCorporates", "pid=23", "w=0.9", "alternate_names from OC registry"),
                    ("Applicant submission", "pid=0", "w=1.0", "DBA submitted at onboarding"),
                ],
                "winner_rule": "combineFacts — all DBA names from all sources merged and deduplicated into array",
                "storage": "rds_warehouse_public.facts name='dba_found' (discovered) + name='dba' (submitted)",
                "null_cause": "Empty when business operates only under legal name. Very common — NOT an error.",
                "editable_note": "Editable by analyst. Override stored in dba fact.",
                "tags": ["✏️ Editable", "📝 Multi-Source Array"],
                "react_lines": (131, 145),
                "verify_sql": """SELECT name, value->>'value' AS dba_value
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('dba', 'dba_found', 'names_found');""",
            },
            {
                "label": "Business Address",
                "fieldKey": "primary_address",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.primary_address_string.value",
                "factName": "primary_address / primary_address_string",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [
                    ("Middesk", "pid=16", "w=2.0", "businessEntityVerification addresses + addressSources"),
                    ("OpenCorporates", "pid=23", "w=0.9", "firmographic registered_address"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_street, zi_c_city, zi_c_state, zi_c_zip"),
                    ("Equifax", "pid=17", "w=0.7", "efx_address1, efx_city, efx_state"),
                    ("Applicant submission", "pid=0", "w=1.0", "address submitted at onboarding"),
                ],
                "winner_rule": "factWithHighestConfidence() for primary_address. combineFacts for addresses array.",
                "storage": "rds_warehouse_public.facts name='primary_address' (object) + name='primary_address_string' (formatted string)",
                "null_cause": "Empty if applicant did not submit address or all vendors returned no address.",
                "editable_note": "Editable. Has showSuggestionIcon — suggests addresses from vendor data.",
                "tags": ["✏️ Editable", "🗺️ Has Google Maps Pin", "💡 Suggestions Available"],
                "react_lines": (146, 171),
                "verify_sql": """SELECT name, value->>'value' AS addr,
       value->'source'->>'platformId' AS source
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('primary_address', 'primary_address_string', 'addresses');""",
            },
            {
                "label": "Mailing Address",
                "fieldKey": "mailing_address",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.mailing_address_strings.value",
                "factName": "mailing_address / mailing_address_strings",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [("Applicant submission", "pid=0", "w=1.0", "Mailing address submitted at onboarding (if different from primary)")],
                "winner_rule": "Direct from applicant submission. Worth does not discover mailing addresses from vendors.",
                "storage": "rds_warehouse_public.facts name='mailing_address' + name='mailing_address_strings'",
                "null_cause": "N/A when no mailing address submitted (same as primary address or not provided).",
                "editable_note": "Editable. separate from primary_address.",
                "tags": ["✏️ Editable", "📝 Applicant Submitted"],
                "react_lines": (172, 197),
                "verify_sql": """SELECT name, value FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('mailing_address', 'mailing_address_strings');""",
            },
            {
                "label": "Business Age",
                "fieldKey": "formation_date",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.formation_date.value",
                "factName": "formation_date",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [
                    ("Middesk", "pid=16", "w=2.0", "businessEntityVerification.formation_date from SoS"),
                    ("OpenCorporates", "pid=23", "w=0.9", "incorporation_date from OC registry"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_year_founded"),
                    ("Equifax", "pid=17", "w=0.7", "efx_yrest (year established)"),
                ],
                "winner_rule": "factWithHighestConfidence() — Middesk wins. Display formatted as: 'MM/DD/YYYY (N years)'",
                "storage": "rds_warehouse_public.facts name='formation_date' + name='year_established'",
                "null_cause": "N/A when no SoS filing found AND no vendor returned formation date.",
                "editable_note": "Editable (date input type). formatDisplayValue converts to 'MM/DD/YYYY (N years)' format.",
                "tags": ["✏️ Editable", "📅 Date Field", "🔢 Computed Age Display"],
                "react_lines": (198, 213),
                "verify_sql": """SELECT name, value->>'value' AS date_value
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('formation_date', 'year_established');""",
            },
            {
                "label": "Annual Revenue",
                "fieldKey": "revenue",
                "editable": True,
                "loadingKey": "financials",
                "dataPath": "getFactsFinancialsData.data.revenue.value",
                "factName": "revenue",
                "apiEndpoint": "GET /facts/business/:id/financials",
                "sources": [
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_revenue — annual revenue from ZI firmographic"),
                    ("Equifax", "pid=17", "w=0.7", "efx_locamount or efx_corpamount × 1000"),
                    ("Accounting/Rutter", "pid=various", "—", "Accounting integration data (if connected)"),
                ],
                "winner_rule": "factWithHighestConfidence(). Tooltip: 'This value is generated using the most reputable source available.'",
                "storage": "rds_warehouse_public.facts name='revenue' + name='revenue_all_sources'",
                "null_cause": "N/A when no vendor has revenue data for this business.",
                "editable_note": "Editable. formatDisplayValue: getCurrencyDisplayValue() formats as $XXX,XXX.",
                "tags": ["✏️ Editable", "💰 Currency Format", "ℹ️ Has Tooltip"],
                "react_lines": (214, 240),
                "verify_sql": """SELECT name, value->>'value' AS revenue,
       value->'source'->>'platformId' AS source_pid
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('revenue', 'revenue_all_sources', 'revenue_confidence');""",
            },
            {
                "label": "Avg. Annual Revenue",
                "fieldKey": "revenue_equally_weighted_average",
                "editable": False,
                "loadingKey": "financials",
                "dataPath": "getFactsFinancialsData.data.revenue_equally_weighted_average.value",
                "factName": "revenue_equally_weighted_average",
                "apiEndpoint": "GET /facts/business/:id/financials",
                "sources": [("Calculated", "calculated", "—", "Equally weighted average across all revenue sources")],
                "winner_rule": "Calculated fact — average of all revenue values from all sources.",
                "storage": "rds_warehouse_public.facts name='revenue_equally_weighted_average'",
                "null_cause": "N/A when no revenue sources available.",
                "editable_note": "Read-only (editable=false). Calculated automatically.",
                "tags": ["🔒 Read-Only", "🔢 Calculated", "ℹ️ Has Tooltip"],
                "react_lines": (241, 270),
                "verify_sql": """SELECT value->>'value' AS avg_revenue
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name = 'revenue_equally_weighted_average';""",
            },
            {
                "label": "Net Income",
                "fieldKey": "net_income",
                "editable": True,
                "loadingKey": "financials",
                "dataPath": "getFactsFinancialsData.data.net_income.value",
                "factName": "net_income",
                "apiEndpoint": "GET /facts/business/:id/financials",
                "sources": [("Accounting/Rutter", "pid=various", "—", "From connected accounting integration. Not from ZI/EFX.")],
                "winner_rule": "Primarily from accounting integration data (Rutter/QuickBooks).",
                "storage": "rds_warehouse_public.facts name='net_income' + name='is_net_income'",
                "null_cause": "N/A for most businesses — only populated when accounting integration is connected.",
                "editable_note": "Editable. formatDisplayValue: getCurrencyDisplayValue().",
                "tags": ["✏️ Editable", "💰 Currency Format", "🔗 Accounting Integration"],
                "react_lines": (271, 287),
                "verify_sql": """SELECT name, value->>'value' AS net_income
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('net_income', 'is_net_income');""",
            },
            {
                "label": "Corporation Type",
                "fieldKey": "corporation",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.corporation.value",
                "factName": "corporation",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [
                    ("Middesk", "pid=16", "w=2.0", "registrations[0].entity_type normalised from SoS"),
                    ("OpenCorporates", "pid=23", "w=0.9", "company_type → llc/corporation/llp/lp"),
                    ("Applicant submission", "pid=0", "w=1.0", "corporation_type from onboarding form"),
                ],
                "winner_rule": "factWithHighestConfidence(). Dropdown with options: LLC, Corporation, Partnership, Sole Proprietorship, etc.",
                "storage": "rds_warehouse_public.facts name='corporation' + rds_cases_public.data_businesses.corporation",
                "null_cause": "N/A when no SoS filing found and applicant did not submit corporation type.",
                "editable_note": "Editable dropdown. CORPORATION_TYPE_OPTIONS defined in constants/fieldOptions.",
                "tags": ["✏️ Editable", "📋 Dropdown", "🏛️ SoS Source"],
                "react_lines": (288, 302),
                "verify_sql": """SELECT name, value->>'value' AS corp_type
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name = 'corporation';""",
            },
            {
                "label": "Number of Employees",
                "fieldKey": "num_employees",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.num_employees.value",
                "factName": "num_employees",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [
                    ("Equifax", "pid=17", "w=0.7", "efx_corpempcnt (corporate employee count)"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_employees"),
                    ("OpenCorporates", "pid=23", "w=0.9", "number_of_employees from OC registry"),
                ],
                "winner_rule": "factWithHighestConfidence(). formatDisplayValue shows 'N/A' for empty values.",
                "storage": "rds_warehouse_public.facts name='num_employees'",
                "null_cause": "N/A when no vendor has employee count for this business. Common for small/new businesses.",
                "editable_note": "Editable. Shows N/A in display mode if empty.",
                "tags": ["✏️ Editable", "🔢 Numeric"],
                "react_lines": (303, 319),
                "verify_sql": """SELECT name, value->>'value' AS employees,
       value->'source'->>'platformId' AS source_pid
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name = 'num_employees';""",
            },
            {
                "label": "Business Phone Number",
                "fieldKey": "business_phone",
                "editable": True,
                "loadingKey": "businessDetails",
                "dataPath": "factsBusinessDetails.data.business_phone.value",
                "factName": "business_phone",
                "apiEndpoint": "GET /facts/business/:id/details",
                "sources": [
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_phone from ZoomInfo firmographic"),
                    ("SERP scraping", "pid=22", "w=0.5", "phone extracted from web scraping"),
                    ("Middesk", "pid=16", "w=2.0", "phone_numbers[0] from Middesk verification"),
                    ("Equifax", "pid=17", "w=0.7", "contact phone from Equifax record"),
                ],
                "winner_rule": "factWithHighestConfidence(). Formatted display via PhoneNumber component.",
                "storage": "rds_warehouse_public.facts name='business_phone'",
                "null_cause": "N/A when no vendor has phone data. Common for new or small businesses.",
                "editable_note": "Editable. Placeholder: 'e.g. (800) 123-4567 or +18001234567'",
                "tags": ["✏️ Editable", "📞 Phone Format"],
                "react_lines": (320, 335),
                "verify_sql": """SELECT value->>'value' AS phone
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name = 'business_phone';""",
            },
            {
                "label": "Business Email",
                "fieldKey": "email",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.email.value",
                "factName": "email",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [
                    ("Equifax", "pid=17", "w=0.7", "efx_email from Equifax contact data"),
                ],
                "winner_rule": "factWithHighestConfidence(). Equifax is the primary vendor providing business email.",
                "storage": "rds_warehouse_public.facts name='email'",
                "null_cause": "N/A — business email rarely in commercial databases. Common to see N/A here.",
                "editable_note": "Editable text field.",
                "tags": ["✏️ Editable", "📧 Email"],
                "react_lines": (336, 349),
                "verify_sql": """SELECT value->>'value' AS email FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'email';""",
            },
            {
                "label": "Minority Business Enterprise",
                "fieldKey": "minority_owned",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.minority_owned.value",
                "factName": "minority_owned",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [("Equifax", "pid=17", "w=0.7", "efx_minority_business_enterprise flag from Equifax")],
                "winner_rule": "factWithHighestConfidence(). Dropdown: Yes / No / N/A",
                "storage": "rds_warehouse_public.facts name='minority_owned'",
                "null_cause": "N/A when Equifax does not have this flag for the business.",
                "editable_note": "Editable dropdown: YES_NO_NA_OPTIONS",
                "tags": ["✏️ Editable", "📋 Dropdown (Yes/No/N/A)", "🏢 Equifax Source"],
                "react_lines": (350, 363),
                "verify_sql": """SELECT value->>'value' AS minority_owned FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'minority_owned';""",
            },
            {
                "label": "Woman-Owned Business",
                "fieldKey": "woman_owned",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.woman_owned.value",
                "factName": "woman_owned",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [("Equifax", "pid=17", "w=0.7", "efx_woman_owned_business flag from Equifax")],
                "winner_rule": "factWithHighestConfidence(). Dropdown: Yes / No / N/A",
                "storage": "rds_warehouse_public.facts name='woman_owned'",
                "null_cause": "N/A when Equifax does not have this flag.",
                "editable_note": "Editable dropdown: YES_NO_NA_OPTIONS",
                "tags": ["✏️ Editable", "📋 Dropdown (Yes/No/N/A)", "🏢 Equifax Source"],
                "react_lines": (364, 377),
                "verify_sql": """SELECT value->>'value' AS woman_owned FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'woman_owned';""",
            },
            {
                "label": "Veteran-Owned Business",
                "fieldKey": "veteran_owned",
                "editable": True,
                "loadingKey": "kyb",
                "dataPath": "getFactsKybData.data.veteran_owned.value",
                "factName": "veteran_owned",
                "apiEndpoint": "GET /facts/business/:id/kyb",
                "sources": [("Equifax", "pid=17", "w=0.7", "efx_veteran_owned_business flag from Equifax")],
                "winner_rule": "factWithHighestConfidence(). Dropdown: Yes / No / N/A",
                "storage": "rds_warehouse_public.facts name='veteran_owned'",
                "null_cause": "N/A when Equifax does not have this flag.",
                "editable_note": "Editable dropdown: YES_NO_NA_OPTIONS",
                "tags": ["✏️ Editable", "📋 Dropdown (Yes/No/N/A)", "🏢 Equifax Source"],
                "react_lines": (378, 391),
                "verify_sql": """SELECT value->>'value' AS veteran_owned FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'veteran_owned';""",
            },
        ]

        def render_field_card(f):
            tag_html = " ".join(f'<span class="badge b-grey">{t}</span>' for t in f["tags"])
            edit_icon = "✏️" if f["editable"] else "🔒"
            col_label = GREEN if f["editable"] else GREY
            st.markdown(
                f'<div class="card" style="border-left-color:{col_label};background:#0E1E38;margin-bottom:8px;">'
                f'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">'
                f'<span style="font-size:1rem;font-weight:700;color:#E2E8F0;">{edit_icon} {f["label"]}</span>'
                f'{tag_html}'
                f'</div>'
                f'<div style="font-size:.8rem;color:#94A3B8;margin-bottom:4px;">'
                f'Fact: <code>{f["factName"]}</code> · API: <code>{f["apiEndpoint"]}</code>'
                f'</div>'
                f'<div style="font-size:.8rem;color:#475569;">'
                f'Data path: <code>{f["dataPath"]}</code>'
                f'</div>'
                f'</div>', unsafe_allow_html=True)

            with st.expander(f"🔍 Full lineage for '{f['label']}'"):
                c1, c2 = st.columns([3, 2])
                with c1:
                    st.markdown("**Sources (in priority order):**")
                    src_tbl = '<table class="t"><tr><th>Source</th><th>PID</th><th>Weight</th><th>Data path</th></tr>'
                    for name, pid, w, detail in f["sources"]:
                        wnum = float(w.replace("w=","")) if w.startswith("w=") else 0
                        wc = "#FCD34D" if wnum >= 2 else ("#6EE7B7" if wnum >= 0.8 else "#94A3B8")
                        src_tbl += f"<tr><td style='color:#E2E8F0'>{name}</td><td><code>{pid}</code></td><td><b style='color:{wc}'>{w}</b></td><td style='font-size:.78rem;color:#94A3B8'>{detail}</td></tr>"
                    st.markdown(src_tbl + "</table>", unsafe_allow_html=True)
                    st.markdown(f"**Winner rule:** {f['winner_rule']}")
                    st.markdown(f"**Storage:** `{f['storage']}`")
                    if f.get("editable_note"):
                        card(f"✏️ {f['editable_note']}", "card-green")
                    card(f"⚠️ **When blank/N/A:** {f['null_cause']}", "card-amber")
                with c2:
                    st.markdown("**Verify with SQL:**")
                    st.code(f["verify_sql"], language="sql")
                    st.markdown("**Python to load:**")
                    st.code(f"""import psycopg2, pandas as pd, json
conn = psycopg2.connect(
    host='<rds_host>', dbname='<db>',
    user='<user>', password='<pw>'
)
df = pd.read_sql(
    "SELECT name, value FROM rds_warehouse_public.facts "
    "WHERE business_id = %s AND name = %s",
    conn, params=['<business_id>', '{f["factName"].split("/")[0].strip()}']
)
# Parse JSONB value
df['fact_value'] = df['value'].apply(lambda x: x.get('value') if isinstance(x, dict) else json.loads(x).get('value'))
print(df[['name','fact_value']])""", language="python")
                st.markdown(src_ref("ADMIN_PORTAL",
                    "microsites-main/packages/case/src/page/Cases/CaseDetails/Tabs/KYB/config/BackgroundTab/fieldConfigs.tsx",
                    f["react_lines"][0], f["react_lines"][1], f"fieldConfig for '{f['label']}'"),
                    unsafe_allow_html=True)

        st.markdown(f"### Business Details Card — {len(BDET_FIELDS)} fields")
        for f in BDET_FIELDS:
            render_field_card(f)

    elif kyb_subtab == "📋 Background — Industry Card":
        sh("📋 Background Sub-Tab — Industry Card")
        card("""<b>API call:</b> <code>GET /facts/business/:id/details</code> → <code>factsBusinessDetails</code><br>
        All 5 Industry card fields read from <code>factsBusinessDetails.data.*</code>.
        Source: <code>fieldConfigs.tsx L392-L469</code> — all 5 field definitions.
        Industry Name and NAICS Code are editable; Description fields are read-only.
        """)
        INDUSTRY_FIELDS = [
            {
                "label": "Industry Name",
                "fieldKey": "industry",
                "editable": True,
                "dataPath": "factsBusinessDetails.data.industry.value.name",
                "factName": "industry",
                "sources": [
                    ("Derived from NAICS", "calculated", "—", "2-digit NAICS sector prefix → core_business_industries lookup"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_industry field (if available)"),
                    ("Applicant submission", "pid=0", "w=0.2", "industry name submitted at onboarding"),
                ],
                "winner_rule": "Dependent fact — reads resolved naics_code and maps 2-digit prefix to core_business_industries.name",
                "storage": "rds_warehouse_public.facts name='industry' {name, id} + rds_cases_public.data_businesses.industry → core_business_industries.id",
                "null_cause": "'-' when naics_code is null OR 2-digit NAICS prefix has no match in core_business_industries",
                "editable_note": "Editable text field with suggestionKey='industry'",
                "tags": ["✏️ Editable", "🔢 NAICS-Derived"],
                "react_lines": (393, 407),
                "verify_sql": """SELECT f.name, f.value->>'value' AS industry_value,
       cbi.name AS industry_name
FROM rds_warehouse_public.facts f
LEFT JOIN rds_cases_public.data_businesses db ON db.id = f.business_id::uuid
LEFT JOIN core_business_industries cbi ON cbi.id = db.industry
WHERE f.business_id = '<business_id>' AND f.name = 'industry';""",
            },
            {
                "label": "NAICS Code",
                "fieldKey": "naics_code",
                "editable": True,
                "dataPath": "factsBusinessDetails.data.naics_code.value",
                "factName": "naics_code",
                "sources": [
                    ("OpenCorporates", "pid=23", "w=0.9", "industry_code_uids parsed for us_naics-XXXXXX"),
                    ("ZoomInfo", "pid=24", "w=0.8", "zi_c_naics6 from comp_standard_global"),
                    ("Trulioo", "pid=38", "w=0.7", "standardizedIndustries[n].naicsCode"),
                    ("Equifax", "pid=17", "w=0.7", "efx.primnaicscode from equifax_us_latest"),
                    ("SERP", "pid=22", "w=0.3", "businessLegitimacyClassification.naics_code"),
                    ("Applicant", "pid=0", "w=0.2", "naics_code submitted at onboarding"),
                    ("AI Enrichment", "pid=31", "w=0.1", "GPT-5-mini response.naics_code (last resort=561499)"),
                ],
                "winner_rule": "factWithHighestConfidence() → weightedFactSelector() tie-break → manualOverride() first. Rule 4: NO minimum confidence cutoff.",
                "storage": "rds_warehouse_public.facts name='naics_code' + rds_cases_public.data_businesses.naics_id → core_naics_code.id",
                "null_cause": "Shows '-' only if ALL vendors null AND AI returned null. AI returns '561499' not null when no evidence.",
                "editable_note": "Editable. schema: /^\\d{6}$/ — must be 6 digits. Override stores analyst correction.",
                "tags": ["✏️ Editable", "🔢 6-Digit Code", "7 Sources"],
                "react_lines": (408, 422),
                "verify_sql": """-- Check NAICS from facts table (Pipeline A):
SELECT value->>'value' AS naics_code,
       value->'source'->>'platformId' AS winning_pid,
       value->'source'->>'confidence' AS confidence,
       jsonb_array_length(value->'alternatives') AS num_alternatives
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'naics_code';

-- Check all alternatives (every vendor's response):
SELECT alt->>'platformId' as pid, alt->>'value' as naics
FROM rds_warehouse_public.facts,
     jsonb_array_elements(value->'alternatives') as alt
WHERE business_id = '<business_id>' AND name = 'naics_code';

-- Check Pipeline B (batch):
SELECT primary_naics_code, zi_c_naics6, efx_primnaicscode,
       zi_match_confidence, efx_match_confidence
FROM datascience.customer_files
WHERE business_id = '<business_id>';""",
            },
            {
                "label": "NAICS Description",
                "fieldKey": "naics_description",
                "editable": False,
                "dataPath": "factsBusinessDetails.data.naics_description.value",
                "factName": "naics_description",
                "sources": [("core_naics_code lookup", "calculated", "—", "label from core_naics_code WHERE code = naics_code.value")],
                "winner_rule": "Read-only. Computed from winning naics_code → core_naics_code.label lookup.",
                "storage": "rds_warehouse_public.facts name='naics_description' + core_naics_code.label",
                "null_cause": "N/A when naics_code is null or not in core_naics_code table.",
                "editable_note": "NOT editable (editable=false). Auto-derived from naics_code.",
                "tags": ["🔒 Read-Only", "🔢 Auto-Derived"],
                "react_lines": (423, 438),
                "verify_sql": """SELECT f.value->>'value' AS naics_desc,
       cnc.label AS db_label
FROM rds_warehouse_public.facts f
JOIN rds_cases_public.data_businesses db ON db.id = f.business_id::uuid
JOIN core_naics_code cnc ON cnc.id = db.naics_id
WHERE f.business_id = '<business_id>' AND f.name = 'naics_description';""",
            },
            {
                "label": "MCC Code",
                "fieldKey": "mcc_code",
                "editable": True,
                "dataPath": "factsBusinessDetails.data.mcc_code.value",
                "factName": "mcc_code / mcc_code_found / mcc_code_from_naics",
                "sources": [
                    ("AI Enrichment (mcc_code_found)", "pid=31", "—", "response.mcc_code from GPT-5-mini (preferred)"),
                    ("Calculated from NAICS", "calculated", "—", "rel_naics_mcc lookup: naics_id → mcc_id"),
                ],
                "winner_rule": "mcc_code = mcc_code_found?.value ?? mcc_code_from_naics?.value. AI-provided preferred over calculated.",
                "storage": "rds_warehouse_public.facts name='mcc_code' + name='mcc_code_found' + name='mcc_code_from_naics' + rds_cases_public.data_businesses.mcc_id → core_mcc_code",
                "null_cause": "Almost never null — if NAICS exists, rel_naics_mcc calculates MCC. 5614='Fallback' when AI had no evidence.",
                "editable_note": "Editable. suggestionKey='mcc_code'. Override allows analyst correction.",
                "tags": ["✏️ Editable", "🔢 4-Digit Code", "🤖 AI + Calculated"],
                "react_lines": (440, 454),
                "verify_sql": """SELECT name, value->>'value' AS mcc_value
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('mcc_code', 'mcc_code_found', 'mcc_code_from_naics', 'mcc_description');""",
            },
            {
                "label": "MCC Description",
                "fieldKey": "mcc_description",
                "editable": False,
                "dataPath": "factsBusinessDetails.data.mcc_description.value",
                "factName": "mcc_description",
                "sources": [
                    ("AI Enrichment", "pid=31", "—", "AI prompt produces mcc_description text"),
                    ("core_mcc_code lookup", "calculated", "—", "label from core_mcc_code WHERE code = mcc_code"),
                ],
                "winner_rule": "Read-only. Either AI-provided text OR core_mcc_code.label lookup.",
                "storage": "rds_warehouse_public.facts name='mcc_description' + core_mcc_code.label",
                "null_cause": "Shows 'Fallback MCC per instructions...' when AI had no evidence — KNOWN BUG (Gap G5). Should show 'Classification pending...' instead.",
                "editable_note": "NOT editable (editable=false L461). This is why 'Fallback MCC per instructions...' cannot be manually corrected by analyst.",
                "tags": ["🔒 Read-Only", "⚠️ Known Bug: Fallback Text Exposed"],
                "react_lines": (455, 469),
                "verify_sql": """SELECT value->>'value' AS mcc_desc FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>' AND name = 'mcc_description';
-- If this shows 'Fallback MCC per instructions...' the AI had no vendor evidence""",
            },
        ]
        st.markdown(f"### Industry Card — {len(INDUSTRY_FIELDS)} fields")
        for f in INDUSTRY_FIELDS:
            render_field_card(f)

    elif kyb_subtab == "🏛️ Business Registration — All Cards":
        sh("🏛️ Business Registration — Business Registration Card + SoS Filings Card")
        card("""<b>API call:</b> <code>GET /facts/business/:id/kyb</code> → <code>kybFactsData</code><br>
        Component: <code>KnowYourBusiness/index.tsx</code> L128-L403<br>
        Two distinct cards: (1) Business Registration (TIN section) and (2) Secretary of State Filings
        """)
        thtml = '<table class="t"><tr><th>Card</th><th>Field</th><th>Fact Name</th><th>Source</th><th>Editable?</th><th>Blank/N/A when</th></tr>'
        biz_reg_rows = [
            ("Business Registration", "Business Name (header)", "legal_name.value", "Middesk BEV.name (pid=16, w=2.0)", "🔒 No", "Middesk not yet complete"),
            ("Business Registration", "Tax ID (EIN)", "tin.value (masked)", "Applicant submitted (masked)", "🔒 No", "Applicant did not submit TIN"),
            ("Business Registration", "✅/❌ Verified badge", "tin_match.value.status", "Middesk IRS TIN Match reviewTasks[key='tin']", "🔒 Auto", "Processing or IRS no match"),
            ("SoS Filings", "Filing Status", "sos_filings[n].active", "Middesk registrations[n].status === 'active'", "🔒 No", "No SoS filing found → 'No Registry Data'"),
            ("SoS Filings", "Entity Jurisdiction Type", "sos_filings[n].foreign_domestic", "Middesk jurisdiction field → domestic/foreign", "🔒 No", "No filing or jurisdiction field missing"),
            ("SoS Filings", "State", "sos_filings[n].state", "Middesk registration_state (2-letter)", "🔒 No", "N/A if state absent from SoS record"),
            ("SoS Filings", "Registration Date", "sos_filings[n].filing_date", "Middesk registrations[n].registration_date", "🔒 No", "N/A if date absent from SoS record"),
            ("SoS Filings", "Entity Type", "sos_filings[n].entity_type", "Middesk entity_type (normalised: llc/corp/llp)", "🔒 No", "N/A if state doesn't disclose entity type"),
            ("SoS Filings", "Corporate Officers", "people.value[] filtered by sos.id", "Middesk officers per filing, matched by sos.id", "🔒 No", "N/A if state doesn't require officer disclosure"),
            ("SoS Filings", "Legal Entity Name", "sos_filings[n].filing_name", "Middesk registrations[n].name (SoS filing name)", "🔒 No", "N/A if filing has no name field"),
            ("SoS Filings", "Articles of Incorporation", "sos_filings[n].url", "Middesk source URL (only if isDirectBusinessLink=true)", "🔒 No", "N/A if URL not a direct business link"),
            ("SoS Filings badge", "✅ Verified badge", "sos_match_boolean=true AND sos_active=true", "SectionHeader.tsx getSosBadgeConfig()", "🔒 Auto", "No active filing found"),
        ]
        for card_name, field, fact, source, editable, blank in biz_reg_rows:
            thtml += f"<tr><td style='color:#60A5FA;font-weight:600'>{card_name}</td><td style='color:#E2E8F0'>{field}</td><td><code>{fact}</code></td><td style='color:#94A3B8;font-size:.78rem'>{source}</td><td>{editable}</td><td style='color:#475569;font-size:.78rem'>{blank}</td></tr>"
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        st.markdown(src_ref("ADMIN_PORTAL",
            "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            128, 403, "Business Registration + SoS Filings rendering"),
            unsafe_allow_html=True)
        st.code("""-- Verify TIN match result:
SELECT name, value->>'value' AS status, value->>'message' AS message
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('tin_match', 'tin_match_boolean', 'tin_submitted');

-- Verify SoS filings:
SELECT name, jsonb_array_length(value->'value') AS filing_count,
       value->'value'->0->>'state' AS first_state,
       value->'value'->0->>'active' AS first_active
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('sos_filings', 'sos_active', 'sos_match_boolean');""", language="sql")

    elif kyb_subtab == "📬 Contact Information — All Cards":
        sh("📬 Contact Information Sub-Tab — Addresses + Business Names Cards")
        card("API: <code>GET /facts/business/:id/kyb</code> → <code>kybFactsData</code> (same as Business Registration). "
             "Component: <code>KnowYourBusiness/index.tsx</code> L406-L546.")
        thtml = '<table class="t"><tr><th>Card</th><th>Field</th><th>Fact Name</th><th>Source</th><th>Blank when</th></tr>'
        contact_rows = [
            ("Addresses", "Submitted Address", "business_addresses_submitted.value[]", "Applicant onboarding form", "Applicant did not submit"),
            ("Addresses", "Reported Address + Deliverable badge", "addresses.value[] + addresses_deliverable.value[]", "Middesk→OC→ZI combined via combineFacts. USPS deliverability check.", "No vendors found addresses"),
            ("Addresses", "Business Registration badge", "address_match_boolean OR address_verification_boolean", "Middesk address verification task", "Not yet complete or not verified"),
            ("Addresses", "Google Profile badge", "address_verification.value.sublabel (Google)", "SERP+Google Places API comparison", "No Google Business Profile found"),
            ("Business Names", "Submitted Name", "names_submitted.value[]", "Applicant onboarding form", "Applicant did not submit"),
            ("Business Names", "Reported Name", "names_found.value[]", "Middesk BEV→OC→ZI→SERP combined via combineFacts", "No vendor found business names"),
            ("Business Names", "✅ Verified badge", "name_match_boolean.value", "Middesk name match task (submitted name found in SoS)", "Name not in SoS records"),
        ]
        for card_name, field, fact, source, blank in contact_rows:
            thtml += f"<tr><td style='color:#2DD4BF;font-weight:600'>{card_name}</td><td style='color:#E2E8F0'>{field}</td><td><code>{fact}</code></td><td style='color:#94A3B8;font-size:.78rem'>{source}</td><td style='color:#475569;font-size:.78rem'>{blank}</td></tr>"
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        st.code("""SELECT name, jsonb_array_length(CASE WHEN jsonb_typeof(value->'value') = 'array' THEN value->'value' ELSE '[]' END) AS array_len,
       value->>'value' AS val
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('addresses', 'addresses_deliverable', 'addresses_found',
             'address_match_boolean', 'address_verification_boolean',
             'names_submitted', 'names_found', 'name_match_boolean');""", language="sql")

    elif kyb_subtab == "🌐 Website — All Cards":
        sh("🌐 Website Sub-Tab — Website Details Card")
        card("API: <code>GET /verification/businesses/:id/website-data</code> → <code>useGetBusinessWebsite</code> + "
             "<code>GET /facts/business/:id/details</code>. Component: <code>WebsiteTab.tsx</code>.")
        thtml = '<table class="t"><tr><th>Field</th><th>Fact Name</th><th>Source</th><th>Shows N/A when</th></tr>'
        web_rows = [
            ("Website URL", "website.value", "ZI.zi_c_url→businessDetails.official_website→SERP→Verdata→EFX.efx_web", "No website found by any source"),
            ("Creation Date", "website.domain.creation_date", "SERP WHOIS lookup OR Verdata domain check", "No website found OR WHOIS privacy protection"),
            ("Expiration Date", "website.domain.expiration_date", "SERP WHOIS OR Verdata", "No website OR WHOIS privacy"),
            ("Parked Domain", "website.domain.parked", "SERP scraping analysis", "No = not parked or unknown"),
            ("Status", "website.status OR website_found.value", "SERP + Verdata website status", "'Unknown' = verification not complete"),
        ]
        for field, fact, source, blank in web_rows:
            thtml += f"<tr><td style='color:#E2E8F0;font-weight:600'>{field}</td><td><code>{fact}</code></td><td style='color:#94A3B8;font-size:.78rem'>{source}</td><td style='color:#475569;font-size:.78rem'>{blank}</td></tr>"
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        st.code("""SELECT name, value->>'value' AS website_value
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('website', 'website_found', 'website_status');""", language="sql")

    elif kyb_subtab == "🔍 Watchlists — All Cards":
        sh("🔍 Watchlists Sub-Tab — Watchlists Scanned + Individual Hits")
        card("API: <code>GET /facts/business/:id/kyb</code> (watchlist fact) + "
             "<code>GET /verification/businesses/:id/people/watchlist</code> (per-person hits).")
        thtml = '<table class="t"><tr><th>Card/Section</th><th>Field</th><th>Source</th><th>No Hits when</th></tr>'
        watch_rows = [
            ("Watchlists Scanned", "Badge: No Hits / N Hits Found", "watchlist.value.metadata.length from combineWatchlistMetadata()", "metadata array is empty after deduplication"),
            ("OFAC section", "SDN, Capta, Foreign Sanctions, Non-SDN (Iranian/Chinese/Palestinian), Sectoral", "Middesk reviewTasks[type='watchlist'] + Trulioo business screening", "No match on these lists"),
            ("BIS section", "Entity List, Denied Persons, Military End User, Unverified List", "Middesk + Trulioo", "No match on BIS lists"),
            ("State Dept section", "ITAR Debarred, Nonproliferation Sanctions", "Middesk + Trulioo", "No match on State Dept lists"),
            ("Individual Hits (per person)", "Hits for [Business Name], [Officer Name]", "GET /verification/businesses/:id/people/watchlist → per-entity screening", "Person screened and clean"),
        ]
        for card_name, field, source, blank in watch_rows:
            thtml += f"<tr><td style='color:#F87171;font-weight:600'>{card_name}</td><td style='color:#E2E8F0'>{field}</td><td style='color:#94A3B8;font-size:.78rem'>{source}</td><td style='color:#475569;font-size:.78rem'>{blank}</td></tr>"
        st.markdown(thtml + "</table>", unsafe_allow_html=True)
        card("⚠️ <b>Adverse media is NOT shown in Watchlists tab.</b> "
             "combineWatchlistMetadata filters: filteredMetadata = allMetadata.filter(hit => hit.type !== WATCHLIST_HIT_TYPE.ADVERSE_MEDIA). "
             "Adverse media appears in Public Records tab instead.", "card-amber")
        st.code("""-- Watchlist fact:
SELECT name, jsonb_array_length(value->'value'->'metadata') AS hit_count,
       value->'value'->>'message' AS message
FROM rds_warehouse_public.facts
WHERE business_id = '<business_id>'
AND name IN ('watchlist', 'watchlist_hits', 'watchlist_raw');

-- Individual hit details:
SELECT (hit->>'type') AS hit_type,
       (hit->'metadata'->>'title') AS list_name,
       (hit->>'entity_name') AS entity_name,
       (hit->>'url') AS source_url
FROM rds_warehouse_public.facts,
     jsonb_array_elements(value->'value'->'metadata') AS hit
WHERE business_id = '<business_id>' AND name = 'watchlist_raw';""", language="sql")

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
        # ── UCM Q/A Spreadsheet fields ─────────────────────────────────────
        "tin.value [UCM: Tax ID Verification]": {
            "ui_label": "Tax ID Number (EIN) — Verification", "sub_tab": "Business Registration",
            "fact_name": "tin_match / tin_match_boolean",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.tin_match.value.status",
            "react_code": "index.tsx L137-L149: tin_match.value.status==='success' → badge 'Verified' (green_tick). status==='failure' → 'Not Found' (red).",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (133, 150),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (399, 491),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "reviewTasks.find(task => task.key==='tin'). IRS TIN Match. Returns {status, message, sublabel}."),
                ("Trulioo", "pid=38", "w=0.8", "UK/Canada businesses only — TIN-to-name match via Trulioo KYB API."),
                ("Applicant submission", "pid=0", "w=1.0", "tin_submitted: raw EIN from onboarding form (masked). NOT used for verification — only display."),
            ],
            "winner_rule": "tin.value = raw EIN from applicant (tin_submitted fact). The VERIFICATION is tin_match_boolean.value (bool). UCM should use tin_match_boolean.value not tin.value directly.",
            "storage": [
                "rds_warehouse_public.facts  name='tin_submitted'  (masked EIN string)",
                "rds_warehouse_public.facts  name='tin_match'  {status, message, sublabel}",
                "rds_warehouse_public.facts  name='tin_match_boolean'  (boolean: status==='success')",
                "integration_data.request_response  (pid=16 Middesk raw response)",
            ],
            "null_cause": "Verified badge missing: Middesk has not yet completed (integrations processing). "
                          "Not Found: IRS did not confirm TIN+name match (wrong EIN, name mismatch, or not in IRS records). "
                          "tin.value itself is never null if applicant submitted it — it is always shown masked.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (768, 790),
            "questions": [
                ("UCM: tin.value is an integer — how does it transform to Verified/Unverified?",
                 "tin.value is the raw EIN integer. UCM should use tin_match_boolean.value (boolean) for verification display. "
                 "TRUE = Verified (TIN+name match confirmed by IRS via Middesk). FALSE = Unverified. "
                 "Confirmed decision: Unverified → Fail the UCM rule. All other results → Pass."),
                ("What does 'Verified' mean here — verified against what?",
                 "Verified = Middesk submitted the EIN + business legal name to the IRS TIN Matching program. "
                 "The IRS confirmed the TIN and name are a registered match. "
                 "This is an IRS check, not a Secretary of State check."),
            ],
        },
        "watchlist.hits.value [UCM: Watchlist Hit Count]": {
            "ui_label": "Watchlist — Hit Count", "sub_tab": "Watchlists",
            "fact_name": "watchlist_hits / watchlist",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.watchlist.value.metadata.length",
            "react_code": "index.tsx L558-L574: badge = metadata.length > 0 ? 'N Hits Found' : 'No Hits'. "
                          "Badge type: metadata.length > 0 → red_exclamation_circle, else → green_tick.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (558, 575),
            "backend_fact_file": "integration-service/lib/facts/rules.ts",
            "backend_fact_lines": (273, 344),
            "sources_ordered": [
                ("Middesk", "pid=16", "—", "reviewTasks watchlist review — OFAC, BIS, State Dept lists for the business entity."),
                ("Trulioo (business)", "pid=38", "—", "Business watchlist screening via Trulioo KYB."),
                ("Trulioo (person)", "pid=38", "—", "Per-owner screening: GET /verification/businesses/:id/people/watchlist endpoint."),
            ],
            "winner_rule": "combineWatchlistMetadata rule — merges ALL sources, deduplicates by type|title|entity_name|url key. "
                           "Adverse media hits FILTERED OUT (separate Public Records tab).",
            "storage": [
                "rds_warehouse_public.facts  name='watchlist'  {metadata:[], message:''}",
                "rds_warehouse_public.facts  name='watchlist_hits'  (integer count)",
                "rds_warehouse_public.facts  name='watchlist_raw'  (full merged data before filtering)",
            ],
            "null_cause": "'No Hits' = watchlist.value.metadata.length === 0 — scan ran and found nothing (normal expected state). "
                          "Section hidden entirely for Canadian businesses. NULL metadata = scan not yet completed.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("Which 14 lists are checked?",
                 "OFAC: SDN, Capta, Foreign Sanctions Evaders, Non-SDN Menu-Based, Non-SDN Iranian, "
                 "Non-SDN Chinese Military-Industrial Complex, Non-SDN Palestinian Legislative Council, Sectoral Sanctions (8). "
                 "BIS: Entity List, Denied Persons, Military End User, Unverified List (4). "
                 "State Dept: ITAR Debarred, Nonproliferation Sanctions (2). Total = 14."),
                ("watchlist.hits.value is an integer — what does it represent?",
                 "It is the count of unique watchlist hits after deduplication via combineWatchlistMetadata. "
                 "0 = No Hits (green badge). N > 0 = N Hits Found (red badge). "
                 "The metadata array contains the individual hit details."),
            ],
        },
        "watchlist.value.metadata [UCM: Watchlist Metadata]": {
            "ui_label": "Watchlist — Individual Hit Details", "sub_tab": "Watchlists",
            "fact_name": "watchlist",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.watchlist.value.metadata[]",
            "react_code": "WatchlistTitle.tsx: renders each list with hit status. "
                          "index.tsx L685-L708: HitCard per hit {title, agency, country, sourceLink}.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (685, 708),
            "backend_fact_file": "integration-service/lib/facts/rules.ts",
            "backend_fact_lines": (273, 344),
            "sources_ordered": [
                ("Middesk + Trulioo (combined)", "pid=16,38", "—", "combineWatchlistMetadata merges hits from all sources with deduplication."),
            ],
            "winner_rule": "combineWatchlistMetadata deduplicates by type|metadata.title|entity_name|url. "
                           "Each hit has: type, metadata.title (agency name), entity_name, url, entity_type (BUSINESS|PERSON).",
            "storage": ["rds_warehouse_public.facts  name='watchlist'  {metadata:[{type, metadata:{title,agency}, entity_name, url, entity_type}], message:''}"],
            "null_cause": "Empty array [] = no hits found (normal). NULL metadata = watchlist scan not yet completed.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What structure does each metadata hit have?",
                 "Each hit: { type: 'sanctions'|'pep'|'adverse_media', metadata: {title, agency}, "
                 "entity_name, url, entity_type: 'BUSINESS'|'PERSON', list_country }. "
                 "Adverse media hits are filtered out from this array (shown in Public Records instead)."),
            ],
        },
        "legal_name.value [UCM: Legal Name]": {
            "ui_label": "Business Name / Legal Entity Name", "sub_tab": "Business Registration",
            "fact_name": "legal_name",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.legal_name.value",
            "react_code": "index.tsx L236: kybFactsData?.data?.legal_name?.value ?? ''",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (224, 244),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (192, 239),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "businessEntityVerification.name — the name Middesk found in SoS records."),
                ("OpenCorporates", "pid=23", "w=0.9", "firmographic.name — registered name in OC registry."),
                ("Trulioo", "pid=38", "w=0.8", "clientData.businessName from Trulioo KYB response."),
                ("Applicant submission", "pid=0", "w=1.0", "Business name submitted at onboarding (businessDetails source)."),
            ],
            "winner_rule": "factWithHighestConfidence() — Middesk wins (weight=2.0) for US businesses. "
                           "legal_name.value is the VERIFIED name from public records, shown in Business Registration card header.",
            "storage": [
                "rds_warehouse_public.facts  name='legal_name'",
                "rds_cases_public.data_businesses.name  (submitted name)",
            ],
            "null_cause": "Empty string when: (1) Middesk not yet completed, (2) no vendor returned a legal name. "
                          "NOTE: UCM confirmed legal_name is NOT pre-filled — Global sends Legal Name + Tax ID, Worth compares and returns match result.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("Is legal_name pre-filled by Worth or submitted by the applicant?",
                 "NOT pre-filled by Worth. Global/UCM sends the Legal Name + Tax ID. "
                 "Worth compares the submitted Legal Name against the IRS TIN record via Middesk. "
                 "legal_name.value is what Worth FOUND in public records (Middesk SoS), not what was submitted. "
                 "The submitted name is in names_submitted and business_name facts."),
                ("Can Business Name and Legal Entity Name ever disagree?",
                 "Yes — Business Name in the card header is legal_name.value (found by Middesk in SoS). "
                 "Legal Entity Name in each SoS filing row is sos_filings[n].filing_name (the specific state filing name). "
                 "These can differ when a business uses different names in different states."),
            ],
        },
        "dba_found.value[n] [UCM: DBA Name]": {
            "ui_label": "DBA (Doing Business As) Names", "sub_tab": "Contact Information",
            "fact_name": "dba_found",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.dba_found (array)",
            "react_code": "Business.tsx L190-L200: businessDetailFacts?.dba?.value rendered as array. "
                          "DBA verification via name_match_boolean.value.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Business.tsx",
            "react_lines": (179, 205),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (318, 355),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "names[] array where submitted=false — trade names Middesk discovered in SoS."),
                ("ZoomInfo", "pid=24", "w=0.8", "zi_c_tradename field from ZoomInfo firmographic data."),
                ("OpenCorporates", "pid=23", "w=0.9", "alternate_names from OC company record."),
                ("SERP / Verdata", "pid=22,35", "w=0.3", "DBA extracted from web scraping and Verdata."),
                ("Applicant submission", "pid=0", "w=1.0", "DBA submitted by applicant at onboarding."),
            ],
            "winner_rule": "combineFacts rule — deduplicates and merges DBA names from ALL sources into single array. "
                           "DBA VERIFICATION uses name_match_boolean.value (TRUE=Verified, FALSE=Unverified).",
            "storage": [
                "rds_warehouse_public.facts  name='dba_found'  (array of strings)",
                "rds_warehouse_public.facts  name='dba'  (submitted DBA from applicant)",
            ],
            "null_cause": "Empty array: business operates only under legal name (no DBA registered anywhere). "
                          "This is common and NOT an error. DBA section only renders when names_submitted.value.length > 0.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("How does dba_found.value[n] (array) transform to Verified/Unverified?",
                 "name_match_boolean.value governs DBA verification: TRUE=Verified, FALSE=Unverified. "
                 "The name_match_boolean is computed from Middesk name task result. "
                 "The array dba_found shows which DBA names were found. The verification badge applies to the section overall."),
                ("Can DBA be verified if the submitted DBA is different from what Middesk found?",
                 "If the submitted DBA appears in Middesk's names[] for this business, name_match → success → Verified. "
                 "If Middesk found a completely different name, name_match → failure → Unverified."),
            ],
        },
        "google_profile.address [UCM: Google Address]": {
            "ui_label": "Google Business Profile — Address", "sub_tab": "Contact Information",
            "fact_name": "address_verification (Google profile component)",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.address_verification / address_match",
            "react_code": "index.tsx L413-L444: Google Profile badge from address_verification.value.sublabel and address_match. "
                          "Contact Information sub-tab shows 'Google Profile' badge per address.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (406, 482),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (60, 120),
            "sources_ordered": [
                ("Google Places API", "pid=29", "w=0.6", "Address field from Google Business Profile listing for this business."),
                ("SERP scraping", "pid=22", "w=0.5", "SERP scraper finds google_place_id, then Google Places API is called."),
            ],
            "winner_rule": "factWithHighestConfidence() for address_verification fact. "
                           "Google Profile address compared against submitted address → Match/No Match → Verified/Unverified badge.",
            "storage": [
                "rds_warehouse_public.facts  name='google_place_id'",
                "rds_warehouse_public.facts  name='address_verification'  {status, sublabel, message, addresses[]}",
                "rds_warehouse_public.facts  name='address_match_boolean'  (boolean)",
            ],
            "null_cause": "Google Profile badge shows 'Unverified' when: (1) business has no Google Business Profile, "
                          "(2) SERP scraping found no Place ID, (3) Google address does not match submitted address. "
                          "Many legitimate businesses have no Google Business listing — this is NOT an error.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What does 'Unverified' mean for Google Profile address?",
                 "Unverified = Google Business Profile either (a) not found for this business, "
                 "or (b) found but shows a different address than what was submitted. "
                 "The admin portal shows 'Unverified' badge (amber) from address_verification.value.sublabel. "
                 "This does NOT mean the address is wrong — many businesses have no Google listing."),
            ],
        },
        "google_profile.business_name [UCM: Google Business Name]": {
            "ui_label": "Google Business Profile — Business Name", "sub_tab": "Contact Information",
            "fact_name": "names_found (Google component) / name_match",
            "api_path": "GET /facts/business/:id/kyb → names_found, name_match_boolean",
            "react_code": "index.tsx L488-L544: Business Names section. name_match_boolean controls Verified badge.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (485, 547),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (192, 319),
            "sources_ordered": [
                ("Google Places API", "pid=29", "—", "Name from Google Business Profile listing."),
                ("SERP scraping", "pid=22", "—", "Business name found via web search."),
            ],
            "winner_rule": "names_found uses combineFacts (all sources merged). name_match_boolean governs the Verified badge.",
            "storage": ["rds_warehouse_public.facts  name='names_found'  (array)", "rds_warehouse_public.facts  name='name_match_boolean'  (boolean)"],
            "null_cause": "No Google Business Profile found for this business — SERP could not find a Google Place ID.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What is the Google-Profile endpoint?",
                 "The admin portal fetches Google Business Profile data via the SERP scraping pipeline. "
                 "SERP (platform_id=22) searches for the business, finds its google_place_id, "
                 "then calls the Google Places API to retrieve name, address, phone. "
                 "The google_place_id fact stores the ID; address_verification and names_found store the results."),
            ],
        },
        "sos_active.value [UCM: SoS Active Status]": {
            "ui_label": "Secretary of State — Filing Status (Active/Inactive)", "sub_tab": "Business Registration",
            "fact_name": "sos_active",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.sos_filings[n].active",
            "react_code": "index.tsx L312-L316: sos.active != null ? capitalize(sos.active ? 'Active' : 'Inactive') : 'N/A'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (307, 316),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (717, 780),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[n].status === 'active' → active=true. Middesk queries SoS by TIN+name."),
                ("OpenCorporates", "pid=23", "w=0.9", "current_status: 'Active' → true; 'Dissolved' → false."),
            ],
            "winner_rule": "sos_active is computed from sos_filings: any filing with active=true → sos_active=true. "
                           "SoS badge uses sos_match_boolean AND sos_active together (getSosBadgeConfig in SectionHeader.tsx).",
            "storage": [
                "rds_warehouse_public.facts  name='sos_active'  (boolean)",
                "rds_warehouse_public.facts  name='sos_filings'  (array, each with active: boolean field)",
            ],
            "null_cause": "'N/A' when sos.active === null (Middesk did not return a status for this specific filing). "
                          "'No Registry Data to Display' when sos_filings array is empty (Middesk found no SoS filings at all). "
                          "This is NOT a confidence rule — if Middesk finds nothing, nothing is shown.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("'No Registry Data' vs blank sos_active — what is the difference?",
                 "'No Registry Data to Display' = sos_filings array is empty (Middesk found NO state registrations for this EIN+name). "
                 "sos_active = null/N/A = Middesk found a filing but did not return a status field for it. "
                 "sos_active = false = Filing found but status is 'inactive', 'dissolved', etc."),
            ],
        },
        "sos_filings.value[n].state [UCM: SoS State]": {
            "ui_label": "Secretary of State — State", "sub_tab": "Business Registration",
            "fact_name": "sos_filings[n].state",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.sos_filings[n].state",
            "react_code": "index.tsx L329-L331: sos.state || 'N/A'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (325, 332),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (717, 780),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[n].registration_state — 2-letter state code from SoS."),
                ("OpenCorporates", "pid=23", "w=0.9", "jurisdiction_code split by '_' → second part → uppercase (e.g. 'us_fl' → 'FL')."),
            ],
            "winner_rule": "sos_filings array populated from Middesk registrations (primary) + OC sosFilings (appended if not duplicate).",
            "storage": ["rds_warehouse_public.facts  name='sos_filings'  (array of SoSRegistration objects)"],
            "null_cause": "Shows 'N/A' when registration_state is missing from Middesk record. "
                          "No SoS data at all = sos_filings array empty.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What is Entity Jurisdiction Type 'Domestic Primary'?",
                 "'Domestic' comes from sos_filings[n].foreign_domestic. "
                 "Middesk jurisdiction field: if it contains 'domestic' → 'domestic'. For OC: home_jurisdiction === jurisdiction → 'domestic'. "
                 "'Primary' is the Worth UI label for index=0 in the sos_filings array (first filing = primary). "
                 "It is NOT a vendor field — it is a Worth portal label."),
            ],
        },
        "sos_filings.value[n].filing_date [UCM: SoS Registration Date]": {
            "ui_label": "Secretary of State — Registration Date", "sub_tab": "Business Registration",
            "fact_name": "sos_filings[n].filing_date",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.sos_filings[n].filing_date",
            "react_code": "index.tsx L298-L305: sos.filing_date ? convertToLocalDate(new Date(sos.filing_date), 'MM-DD-YYYY') : 'N/A'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (295, 306),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (717, 780),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[n].registration_date — ISO date from SoS database."),
                ("OpenCorporates", "pid=23", "w=0.9", "incorporation_date from OC company record."),
            ],
            "winner_rule": "Each sos_filing in the array has its own filing_date. Middesk records appear first.",
            "storage": ["rds_warehouse_public.facts  name='sos_filings'  (each item has filing_date field)"],
            "null_cause": "Shows 'N/A' when registration_date absent in SoS registry record. "
                          "Date is normalised to MM-DD-YYYY format by convertToLocalDate() in the React component.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("Is Registration Date the SoS date or the date Worth first saw the business?",
                 "It is the Secretary of State registration_date from Middesk — the actual date the business filed with the SoS. "
                 "NOT the date Worth processed the business. "
                 "Worth normalises the date format to MM-DD-YYYY for display."),
            ],
        },
        "sos_filings.value[n].entity_type [UCM: SoS Entity Type]": {
            "ui_label": "Secretary of State — Entity Type", "sub_tab": "Business Registration",
            "fact_name": "sos_filings[n].entity_type",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.sos_filings[n].entity_type",
            "react_code": "index.tsx L320-L323: sos.entity_type || 'N/A'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (317, 324),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (717, 860),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[n].entity_type — raw string from SoS (e.g. 'Llc', 'Corp')."),
                ("OpenCorporates", "pid=23", "w=0.9", "company_type normalized: 'Limited Liability Company' → 'llc', 'Incorporated' → 'corporation', etc."),
            ],
            "winner_rule": "Worth normalises entity_type: 'llc', 'corporation', 'llp', 'lp', 'sole proprietorship'. "
                           "Admin portal shows the raw value from Middesk (e.g. 'Llc') capitalised.",
            "storage": ["rds_warehouse_public.facts  name='sos_filings'  (each item has entity_type field)"],
            "null_cause": "Shows 'N/A' when entity_type absent from SoS registry record. "
                          "Most state SoS records include entity_type — absence is unusual.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("Is entity_type the same as Corporation Type in the Background tab?",
                 "No — Business Registration tab shows entity_type from sos_filings[n] (SoS official filing). "
                 "Background tab shows bus_struct.value (from Fact Engine, separate fact). "
                 "They may differ: one is the SoS-registered type, the other is the Fact Engine winner from multiple vendors."),
            ],
        },
        "status [UCM: Case/Applicant Status]": {
            "ui_label": "Case Status / Applicant Status", "sub_tab": "Case Results panel",
            "fact_name": "verification_status / compliance_status",
            "api_path": "GET /cases/:id → case_management.ts getCaseByIDQuery (data_cases.status → core_case_statuses.code)",
            "react_code": "CaseDetails.tsx: status from data_cases.status joined to core_case_statuses. "
                          "Shows: Pending / Under Review / Auto-Approved / Archived.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CaseDetails.tsx",
            "react_lines": (1, 50),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [
                ("Middesk", "pid=16", "—", "businessEntityVerification.status feeds verification_status fact."),
                ("Trulioo", "pid=38", "—", "clientData.status for UK/Canada businesses."),
                ("Manual override", "pid=0", "—", "Analyst can manually change case status via admin portal."),
                ("Worth Score engine", "calculated", "—", "Auto-Approved when all rules pass and score above threshold."),
            ],
            "winner_rule": "Case status is NOT a Fact Engine fact — it lives in rds_cases_public.data_cases.status "
                           "→ core_case_statuses.code. Transitions: Pending → Under Review (rules fail) or Auto-Approved (all pass).",
            "storage": [
                "rds_cases_public.data_cases.status → core_case_statuses.id",
                "core_case_statuses: {id, code: 'pending'|'under_review'|'auto_approved'|'archived', label}",
                "rds_warehouse_public.facts  name='verification_status'  (Middesk/Trulioo verification status)",
            ],
            "null_cause": "Shows 'Pending' (with loading bars) while integrations are processing. "
                          "This is NOT null — Pending is the initial state. Worth Score shows '-' until calculation completes.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (1, 10),
            "questions": [
                ("What transitions a case from Pending to Under Review vs Auto-Approved?",
                 "Auto-Approved: all UCM decisioning rules pass AND Worth Score above configured threshold. "
                 "Under Review: one or more rules fail (e.g. TIN Unverified, watchlist hits found, IDV failed). "
                 "The threshold and rules are configured per customer/integration settings."),
                ("Can an analyst manually change the status?",
                 "Yes — analysts can change status via the admin portal. "
                 "Manual changes go through the case-service API (PATCH /cases/:id). "
                 "Manual status is stored in data_cases.status."),
            ],
        },
        "domain.creation_date [UCM: Domain Creation Date]": {
            "ui_label": "Website — Domain Creation Date", "sub_tab": "Website",
            "fact_name": "website (domain metadata)",
            "api_path": "GET /verification/businesses/:id/website-data → useGetBusinessWebsite",
            "react_code": "WebsiteReview.tsx or CompanyProfile/WebsiteReview.tsx: creation_date field from website data.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/WebsiteReview.tsx",
            "react_lines": (1, 50),
            "backend_fact_file": "integration-service/lib/facts/sources.ts",
            "backend_fact_lines": (415, 430),
            "sources_ordered": [
                ("SERP scraping", "pid=22", "w=0.5", "SERP scraper performs WHOIS lookup on found domain → creation_date."),
                ("Verdata", "pid=35", "w=0.6", "Verdata/VerifiedFirst performs domain age check via WHOIS."),
            ],
            "winner_rule": "factWithHighestConfidence() for website fact. Domain creation date part of WHOIS data.",
            "storage": [
                "rds_warehouse_public.facts  name='website'  (includes domain metadata)",
                "integration_data.request_response  (pid=22 SERP, pid=35 Verdata raw WHOIS data)",
            ],
            "null_cause": "Shows 'N/A' when: (1) no website found for the business, "
                          "(2) WHOIS data unavailable (domain privacy protection enabled), "
                          "(3) SERP scraping did not complete. "
                          "Many businesses with no website will show N/A for all domain fields.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What does 'Creation Date: N/A' mean?",
                 "Either (a) no website was found for this business — SERP could not find a domain, "
                 "or (b) the domain has WHOIS privacy protection enabled, "
                 "or (c) SERP/Verdata integration did not complete. "
                 "This is expected for many small businesses with no public web presence."),
            ],
        },
        "data.applicant.status [UCM: Business Verified Status]": {
            "ui_label": "Business Registration — Verified/Not Verified badge", "sub_tab": "Business Registration",
            "fact_name": "verification_status / business_verified",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.tin_match (drives the Business Registration Verified badge)",
            "react_code": "index.tsx L133-L150: Business Registration SectionHeader gets badgeText from tin_match.value.status. "
                          "'success' → 'Verified' (green_tick). 'failure' → 'Not Found' (red).",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (133, 150),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (618, 630),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "Overall businessEntityVerification.status: 'completed'/'in_review'/'failed'."),
                ("Trulioo", "pid=38", "w=0.8", "clientData.status for UK/Canada businesses."),
            ],
            "winner_rule": "data.applicant.status maps to tin_match.value.status for the Business Registration card badge. "
                           "Middesk 'completed' → 'Verified'. 'failed' → 'Not Found'.",
            "storage": [
                "rds_warehouse_public.facts  name='verification_status'  (Middesk/Trulioo overall status)",
                "rds_warehouse_public.facts  name='tin_match'  (drives the Business Registration badge)",
            ],
            "null_cause": "Badge missing: integrations still processing (is_integration_complete=false). "
                          "Badge shows 'Not Found': Middesk could not confirm TIN+name via IRS.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("How does data.applicant.status map to the Business Registration badge?",
                 "The Business Registration card badge is driven by tin_match.value.status (IRS TIN match). "
                 "data.applicant.status is the overall applicant/case status (Pending/Under Review/Auto-Approved). "
                 "These are different concepts: tin_match drives the Business Registration Verified badge; "
                 "data.applicant.status drives the Case Results panel on the right side."),
            ],
        },
        "owners[n].first_name [UCM: Owner First Name]": {
            "ui_label": "Owner First Name", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners.first_name",
            "react_code": "KYC/Owners component: owner.first_name from applicant submission.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Submitted at onboarding — NOT discovered by Worth.")],
            "winner_rule": "Direct read from rds_cases_public.data_owners. No Fact Engine competition — applicant-submitted.",
            "storage": ["rds_cases_public.data_owners.first_name"],
            "null_cause": "NULL only if applicant did not provide — required field in most flows.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("Is owner first name discovered by Worth or submitted by the applicant?",
                 "Submitted by the applicant at onboarding. Worth does NOT discover owner names from external sources. "
                 "Worth only verifies the submitted owners against watchlists and IDV."),
            ],
        },
        "owners[n].last_name [UCM: Owner Last Name]": {
            "ui_label": "Owner Last Name", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners.last_name",
            "react_code": "KYC/Owners component: owner.last_name from applicant submission.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Submitted at onboarding.")],
            "winner_rule": "Direct read from rds_cases_public.data_owners.",
            "storage": ["rds_cases_public.data_owners.last_name"],
            "null_cause": "NULL only if not submitted by applicant.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [],
        },
        "owners[n].date_of_birth [UCM: Owner DOB]": {
            "ui_label": "Owner Date of Birth", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners.date_of_birth (encrypted)",
            "react_code": "KYC/Owners: DOB used for Plaid IDV — not displayed directly after submission.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Submitted at onboarding — used for Plaid IDV verification.")],
            "winner_rule": "Stored encrypted. Used by Plaid IDV for identity verification. Not shown after submission.",
            "storage": ["rds_cases_public.data_owners.date_of_birth  (encrypted)"],
            "null_cause": "NULL if not submitted. Plaid IDV cannot complete without DOB.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("Is DOB ever shown to analysts?",
                 "DOB is stored encrypted and is NOT displayed to analysts after initial submission. "
                 "It is only used internally for Plaid IDV verification. "
                 "The IDV result (pass/fail) is what analysts see."),
            ],
        },
        "owners[n].ssn [UCM: Owner SSN]": {
            "ui_label": "Owner SSN (last 4 shown)", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "tin_submitted (owner level)",
            "api_path": "GET /businesses/:id → data_owners.ssn (always masked — last 4 only)",
            "react_code": "KYC/Owners: shows masked SSN (last 4 digits). Full SSN used only by Plaid IDV.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (555, 610),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Full SSN submitted at onboarding. Immediately masked — last 4 only stored in displayable form.")],
            "winner_rule": "Full SSN used by Plaid IDV in their secure environment. API always returns masked version (last 4).",
            "storage": ["rds_cases_public.data_owners  (SSN encrypted/masked)", "Plaid processes full SSN in their secure environment"],
            "null_cause": "NULL if not submitted or not required for this flow. Some non-US flows use different ID type.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("Is the full SSN ever accessible after submission?",
                 "No — the full SSN is only used at submission time for Plaid IDV. "
                 "After that, only the last 4 digits are accessible via the API. "
                 "Worth never stores or returns the full SSN in any API response."),
            ],
        },
        "owners[n].address_line_1 [UCM: Owner Address]": {
            "ui_label": "Owner Home Address", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners (address fields)",
            "react_code": "KYC/Owners: address fields from applicant submission.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "All address fields submitted at onboarding. Used for Plaid IDV address verification.")],
            "winner_rule": "Direct read from rds_cases_public.data_owners. No vendor competition.",
            "storage": ["rds_cases_public.data_owners  (address_line_1, address_line_2, address_city, address_state, address_country, address_postal_code, address_apartment)"],
            "null_cause": "NULL if not submitted. address_line_2 and address_apartment are optional.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [],
        },
        "owners[n].mobile [UCM: Owner Mobile]": {
            "ui_label": "Owner Mobile Phone", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners.mobile",
            "react_code": "KYC/Owners: mobile from applicant submission. Used to send Plaid IDV link.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Mobile submitted at onboarding for Plaid IDV SMS delivery.")],
            "winner_rule": "Direct read from rds_cases_public.data_owners.",
            "storage": ["rds_cases_public.data_owners.mobile"],
            "null_cause": "NULL if not provided. Plaid uses email as fallback for IDV link delivery.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [],
        },
        "owners[n].email [UCM: Owner Email]": {
            "ui_label": "Owner Email", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "owners (submitted data)",
            "api_path": "GET /businesses/:id → data_owners.email",
            "react_code": "KYC/Owners: email from applicant submission. Used to send Plaid IDV link.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "case-service/src/api/v1/modules/case-management/case-management.ts",
            "backend_fact_lines": (1555, 1574),
            "sources_ordered": [("Applicant submission", "pid=0", "w=1.0", "Email submitted at onboarding for Plaid IDV link delivery.")],
            "winner_rule": "Direct read from rds_cases_public.data_owners.",
            "storage": ["rds_cases_public.data_owners.email"],
            "null_cause": "NULL if not provided — Plaid IDV link cannot be sent without email or mobile.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [],
        },
        "synthetic_identity_risk_score [UCM: Synthetic Identity Risk]": {
            "ui_label": "Synthetic Identity Risk Score", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "risk_score (synthetic)",
            "api_path": "GET /cases/:id/tab-values → caseTabValues.synthetic_identity_risk_score",
            "react_code": "CaseTabValuesResults.tsx: caseTabValues row 'synthetic_identity_risk_score'. "
                          "Constant in caseTabValues.ts L21: 'synthetic_identity_risk_score' → 'Synthetic Identity Risk Score'.",
            "react_file": "customer-admin-webapp-main/src/constants/caseTabValues.ts",
            "react_lines": (21, 21),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (493, 555),
            "sources_ordered": [
                ("Plaid IDV", "pid=40", "—", "Plaid identity verification returns synthetic identity risk signals for each owner."),
            ],
            "winner_rule": "Computed from Plaid IDV response signals. High score = likely synthetic identity (fabricated from real+fake info).",
            "storage": [
                "integration_data.request_response  (pid=40 Plaid IDV raw response)",
                "rds_warehouse_public.facts  name='risk_score'  (or as caseTabValues result)",
            ],
            "null_cause": "NULL when: (1) owner has not completed Plaid IDV, (2) Plaid did not return synthetic risk score, "
                          "(3) IDV not available for this jurisdiction.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("What scale is the synthetic identity risk score on?",
                 "The score comes from Plaid IDV signals and is typically 0-100 or 0-1 normalised. "
                 "High score indicates higher likelihood of synthetic identity. "
                 "Appears as a caseTabValues decisioning result row — the UCM team defines the threshold for pass/fail."),
            ],
        },
        "stolen_identity_risk_score [UCM: Stolen Identity Risk]": {
            "ui_label": "Stolen Identity Risk Score", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "risk_score (stolen)",
            "api_path": "GET /cases/:id/tab-values → caseTabValues.stolen_identity_risk_score",
            "react_code": "CaseTabValuesResults.tsx: caseTabValues row 'stolen_identity_risk_score'. "
                          "Constant in caseTabValues.ts L22: 'stolen_identity_risk_score' → 'Stolen Identity Risk Score'.",
            "react_file": "customer-admin-webapp-main/src/constants/caseTabValues.ts",
            "react_lines": (22, 22),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (493, 555),
            "sources_ordered": [
                ("Plaid IDV", "pid=40", "—", "Plaid IDV returns stolen identity risk signals: SSN velocity, credit thin-file, DOB mismatch."),
            ],
            "winner_rule": "Computed from Plaid IDV signals. High score = likely stolen identity (someone else's real identity being used).",
            "storage": [
                "integration_data.request_response  (pid=40 Plaid IDV raw response)",
                "rds_warehouse_public.facts  name='risk_score'  (or as caseTabValues result)",
            ],
            "null_cause": "Same as synthetic_identity_risk_score — NULL when Plaid IDV not yet complete.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("What is the difference between synthetic_identity and stolen_identity risk scores?",
                 "Synthetic identity = a fabricated identity combining real and fake information (e.g. real SSN with fake name/DOB). "
                 "Stolen identity = using another real person's complete identity. "
                 "Both come from Plaid IDV signals but measure different fraud patterns."),
            ],
        },
        "verification_result.account_verification_response.code [UCM: Bank Account Verification]": {
            "ui_label": "Bank Account Verification Code", "sub_tab": "Banking tab",
            "fact_name": "verification_status (banking)",
            "api_path": "GET /banking/:businessId → bank verification status via Plaid Auth or micro-deposit",
            "react_code": "Banking/BankVerification.tsx: account verification code and status.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/Banking/BankVerification.tsx",
            "react_lines": (1, 50),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (493, 555),
            "sources_ordered": [
                ("Plaid Auth", "pid=40", "—", "Plaid Auth instant verification — verifies account ownership via bank login."),
                ("Plaid Manual Verification", "pid=40", "—", "Micro-deposit verification — 2 small deposits confirmed by user."),
            ],
            "winner_rule": "Direct from Plaid API response. Common codes: VERIFIED, PENDING_AUTOMATIC_VERIFICATION, PENDING_MANUAL_VERIFICATION, VERIFICATION_FAILED.",
            "storage": [
                "integration_data.request_response  (pid=40 Plaid banking response)",
                "rds_warehouse_public.facts  name='verification_status'  (banking verification code)",
            ],
            "null_cause": "NULL if banking section not submitted by applicant. PENDING if verification in progress.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("What are the possible verification codes and their meanings?",
                 "VERIFIED = Plaid confirmed account ownership (instant or micro-deposit). "
                 "PENDING_AUTOMATIC_VERIFICATION = Plaid Auth in progress. "
                 "PENDING_MANUAL_VERIFICATION = Micro-deposits sent, waiting for user confirmation. "
                 "VERIFICATION_FAILED = Account could not be verified. "
                 "UCM rule: VERIFICATION_FAILED → fail; VERIFIED → pass; PENDING → hold for review."),
            ],
        },
        "verification_result.account_authentication_response.verification_response [UCM: Owner IDV Result]": {
            "ui_label": "Owner Identity Verification (IDV) Result", "sub_tab": "KYC tab → Owner cards",
            "fact_name": "idv_status / idv_passed_boolean",
            "api_path": "GET /facts/business/:id/kyb → idv_status, idv_passed_boolean",
            "react_code": "KYC/Owners IDV status section: idv_status aggregates Plaid results. "
                          "idv_passed_boolean = true if at least one SUCCESS across all required owners.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/",
            "react_lines": (1, 1),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (493, 553),
            "sources_ordered": [
                ("Plaid IDV", "pid=40", "—", "Per-owner identity verification. Status: success/failed/pending/expired. "
                                              "idv_status: {SUCCESS:N, FAILED:N, PENDING:N, EXPIRED:N} counts."),
            ],
            "winner_rule": "idv_status aggregates counts per status across all owners. "
                           "idv_passed_boolean = idv_status.SUCCESS > 0. "
                           "Worth maps Plaid status to: SUCCESS, FAILED, PENDING, EXPIRED, NEEDS_REVIEW.",
            "storage": [
                "integration_data.request_response  (pid=40 Plaid IDV per-owner response)",
                "rds_warehouse_public.facts  name='idv_status'  {SUCCESS:N, FAILED:N, PENDING:N}",
                "rds_warehouse_public.facts  name='idv_passed_boolean'  (boolean)",
                "rds_warehouse_public.facts  name='idv_passed'  (count of SUCCESS)",
            ],
            "null_cause": "PENDING when owner has not yet clicked the Plaid IDV link. "
                          "EXPIRED when link expired before completion. "
                          "FAILED when Plaid could not match SSN/DOB/name against government records.",
            "w360": False, "w360_file": "report.ts", "w360_lines": (1, 1),
            "questions": [
                ("What is the difference between idv_status and idv_passed_boolean?",
                 "idv_status = {SUCCESS:2, FAILED:0, PENDING:1} — counts per status across ALL owners. "
                 "idv_passed_boolean = true if idv_status.SUCCESS > 0 (at least one successful IDV). "
                 "idv_passed = the number of successful IDV completions. "
                 "UCM rule: FAILED → fail; SUCCESS → pass; PENDING → hold."),
                ("Who initiates the Plaid IDV link?",
                 "Worth sends the Plaid IDV link via email (and optionally SMS to mobile) using the owner.email and owner.mobile submitted at onboarding. "
                 "The owner clicks the link, completes document or database verification via Plaid's UI, "
                 "then Plaid posts the result back to Worth via webhook."),
            ],
        },
        "people.value[n].name [UCM: Corporate Officers]": {
            "ui_label": "Corporate Officers (per SoS filing)", "sub_tab": "Business Registration",
            "fact_name": "people",
            "api_path": "GET /facts/business/:id/kyb → kybFactsData.data.people.value (filtered per sos.id)",
            "react_code": "index.tsx L361-L393: people.value filtered by person.source.some(src => src.id === sos.id). "
                          "Shows: capitalize(officer.name) - capitalize(officer.title) per filing.",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/KnowYourBusiness/index.tsx",
            "react_lines": (354, 394),
            "backend_fact_file": "integration-service/lib/facts/kyb/index.ts",
            "backend_fact_lines": (717, 780),
            "sources_ordered": [
                ("Middesk", "pid=16", "w=2.0", "registrations[n].officers array. Officers linked to specific SoS filing by sos.id."),
                ("OpenCorporates", "pid=23", "w=0.9", "officers field from OC company record."),
                ("Trulioo", "pid=38", "w=0.8", "business principals/directors from Trulioo KYB response."),
            ],
            "winner_rule": "combineFacts — people from all sources merged. Each person linked to specific SoS filing(s) via source.id. "
                           "React filters people by sos.id to show only officers for THAT specific filing.",
            "storage": [
                "rds_warehouse_public.facts  name='people'  (array of {name, titles[], source[], jurisdictions[]})",
            ],
            "null_cause": "Shows 'N/A' when: (1) no SoS filing found (no officers data possible), "
                          "(2) SoS filing found but state does not require officer disclosure. "
                          "Corporate Officers section shows 'N/A' per filing when no officers are linked to that sos.id.",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("If a business has filings in 3 states, which officers are shown?",
                 "Officers are shown PER FILING row. Each SoS filing card shows only the officers "
                 "whose source.id matches that specific sos.id. "
                 "If a person is an officer in all 3 states, they appear in all 3 filing cards. "
                 "The filter is: people.value.filter(person => person.source.some(src => src.id === sos.id))."),
            ],
        },
        "mcc_code [UCM: MCC Code]": {
            "ui_label": "MCC Code", "sub_tab": "Background",
            "fact_name": "mcc_code",
            "api_path": "GET /facts/business/:id/details → businessDetailFacts.mcc_code.value",
            "react_code": "Industry.tsx L55-L59: businessDetailFacts?.mcc_code?.value ?? business?.mcc_code ?? '-'",
            "react_file": "customer-admin-webapp-main/src/pages/Cases/CompanyProfile/Industry.tsx",
            "react_lines": (53, 59),
            "backend_fact_file": "integration-service/lib/facts/businessDetails/index.ts",
            "backend_fact_lines": (391, 440),
            "sources_ordered": [
                ("AI Enrichment (mcc_code_found)", "pid=31", "—", "response.mcc_code from GPT-5-mini. Direct AI-provided MCC."),
                ("Calculated from NAICS (mcc_code_from_naics)", "calculated", "—", "rel_naics_mcc lookup: winning naics_id → mcc_id."),
                ("Combined (mcc_code)", "combined", "—", "mcc_code_found?.value ?? mcc_code_from_naics?.value"),
            ],
            "winner_rule": "mcc_code = AI-provided MCC (preferred) OR calculated from winning NAICS via rel_naics_mcc. "
                           "NOT a competitive vendor selection. mcc_description shows AI text or core_mcc_code.label.",
            "storage": [
                "rds_warehouse_public.facts  name='mcc_code'",
                "rds_warehouse_public.facts  name='mcc_code_found'  (AI direct)",
                "rds_warehouse_public.facts  name='mcc_code_from_naics'  (calculated)",
                "rds_cases_public.data_businesses.mcc_id → core_mcc_code.id",
                "core_mcc_code  (lookup: code, label)",
                "rel_naics_mcc  (naics_id → mcc_id mapping)",
            ],
            "null_cause": "MCC is almost never null — if NAICS exists, rel_naics_mcc calculates MCC. "
                          "5614 shown with 'Fallback MCC per instructions...' when AI had no evidence (Gap G5 — known bug).",
            "w360": True, "w360_file": "report.ts", "w360_lines": (763, 793),
            "questions": [
                ("What is the difference between mcc_code, mcc_code_found, and mcc_code_from_naics?",
                 "mcc_code_found = AI enrichment directly returned this MCC in its response. "
                 "mcc_code_from_naics = calculated by looking up winning naics_code in rel_naics_mcc table. "
                 "mcc_code = mcc_code_found ?? mcc_code_from_naics (AI-provided preferred). "
                 "The user sees the mcc_code value. mcc_description is stored separately."),
                ("Why does MCC Description say 'Fallback MCC per instructions...'?",
                 "When the AI has no vendor evidence and returns 5614 as last resort, the system prompt produces this internal debug text. "
                 "It is stored in mcc_description fact and displayed directly in the Background tab. "
                 "Fix (Gap G5): change AI prompt to return 'Classification pending — insufficient public data available.' instead."),
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

    # ── Image paste / upload ──────────────────────────────────────────
    st.markdown("#### 📎 Attach a screenshot or file:")
    st.markdown(
        '<div class="card card-teal" style="font-size:.82rem;padding:8px 14px;">'
        '💡 <b>To paste a screenshot:</b> Take a screenshot (Cmd+Shift+4 on Mac / Win+Shift+S on Windows), '
        'then click "Browse files" and select the saved file — or drag & drop it into the uploader below. '
        'The AI agent will read the image and identify every field and badge shown, '
        'then trace its lineage to the source code.'
        '</div>', unsafe_allow_html=True)

    uploaded = st.file_uploader(
        "Upload screenshot, PDF, or Excel (optional)",
        type=["png","jpg","jpeg","webp","pdf","xlsx"],
        key="agent_upload",
        help="Upload a screenshot of the admin portal — the AI will identify every field and badge and explain where it comes from."
    )

    # Show uploaded image preview
    if uploaded and uploaded.type.startswith("image/"):
        st.image(uploaded, caption=f"📸 Uploaded: {uploaded.name}", use_column_width=True)
        uploaded.seek(0)  # Reset after preview

    col_input, col_voice = st.columns([5, 1])
    with col_input:
        user_q = st.chat_input("Ask about any field, badge, rule, or lineage — or paste a screenshot above and ask about it...")
    with col_voice:
        st.markdown("<br>", unsafe_allow_html=True)
        use_voice = st.checkbox("🎙️", help="Voice: type your question after speaking it aloud")

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
- The exact card structure: Business Details card, Industry card, Secretary of State Filings card, etc.
- What badge/status states mean and what code produces them (Verified, Unverified, No Registry Data, etc.)
- NAICS/MCC codes, 561499 fallback, MCC description issues
- The Fact Engine rules and vendor sources
- Data lineage from vendor API → facts table → admin portal
- Who provided each value, which source, where it is stored, how to verify it

RULES:
1. ALWAYS cite [FILE: path L123-L145] for every claim. Use exact line numbers from the chunks.
2. Quote relevant code when available. Prefer frontend (Admin Portal) files for UI questions.
3. Use the Admin Portal repo chunks for 'what the user sees' questions.
4. Use the integration-service chunks for 'what produces this' questions.
5. Do NOT hallucinate. Only answer from provided chunks.
6. End with: "✅ Click the source code chunks below to verify these claims."

7. FOR SCREENSHOT/IMAGE UPLOADS: Identify every visible field, badge, and card in the screenshot.
   For each element, explain: what fact/API field produces it, which vendor source provides the value,
   what the badge state means, and what causes blank/N/A values.
   Reference the fieldConfigs.tsx file which defines every Background tab field.

8. ALWAYS PROVIDE VERIFICATION CODE when the user asks about data:
   a) If data lives in REDSHIFT (datascience.customer_files, zoominfo/equifax tables):
      Provide a SQL query like:
      ```sql
      SELECT primary_naics_code, zi_c_naics6, efx_primnaicscode, worth_score
      FROM datascience.customer_files
      WHERE business_id = '<business_id>'
      LIMIT 1;
      ```
   b) If data lives in POSTGRESQL (rds_warehouse_public.facts, rds_cases_public.data_businesses):
      Provide a SQL query like:
      ```sql
      SELECT name, value->>'value' as fact_value, value->'source'->>'platformId' as source_pid
      FROM rds_warehouse_public.facts
      WHERE business_id = '<business_id>'
      AND name IN ('naics_code', 'mcc_code', 'tin_match_boolean', 'sos_filings')
      ORDER BY name;
      ```
   c) If the user wants Python code to load and inspect:
      Provide psycopg2/pandas code like:
      ```python
      import psycopg2, pandas as pd
      conn = psycopg2.connect(host='<host>', dbname='<db>', user='<user>', password='<pw>')
      df = pd.read_sql(
          "SELECT name, value FROM rds_warehouse_public.facts WHERE business_id = %s",
          conn, params=['<business_id>']
      )
      print(df)
      ```
   Always clarify which database (Redshift vs PostgreSQL) and which schema/table.

9. FOR FIELD LINEAGE QUESTIONS, structure your answer as:
   📍 WHERE in admin portal → exact card + sub-tab
   📡 WHICH API call → exact endpoint
   🔧 WHICH fact → exact fact name in rds_warehouse_public.facts
   📦 WHICH source → vendor with platform_id and weight
   🗄️ WHERE stored → exact schema.table
   ✅ HOW TO VERIFY → SQL query to confirm the value
   📝 WHY BLANK/N/A → exact condition from React code"""

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
