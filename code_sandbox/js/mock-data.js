/* ============================================================
   KYB Confidence Platform — Mock Data
   All values are synthetic and for prototype visualization only.
   ============================================================ */

const MOCK = {
  portfolio: {
    total_cases: 24716,
    distinct_customers: 5482,
    distinct_businesses: 19124,
    avg_confidence: 0.742,
    median_confidence: 0.781,
    manual_review_pct: 14.8,
    auto_approve_pct: 71.3,
    auto_decline_pct: 13.9,
    delta_avg_conf: +0.018,
    delta_manual: -2.1,
  },

  confidence_bands: [
    { band: "Very Low (0.0–0.2)", count: 862,  color: "#ef4444" },
    { band: "Low (0.2–0.4)",      count: 1940, color: "#f97316" },
    { band: "Medium (0.4–0.6)",   count: 4318, color: "#f59e0b" },
    { band: "High (0.6–0.8)",     count: 9201, color: "#22c55e" },
    { band: "Very High (0.8–1.0)",count: 8395, color: "#16a34a" },
  ],

  confidence_trend: {
    labels: ["Wk1","Wk2","Wk3","Wk4","Wk5","Wk6","Wk7","Wk8","Wk9","Wk10","Wk11","Wk12"],
    avg:      [0.71, 0.72, 0.72, 0.73, 0.74, 0.73, 0.74, 0.75, 0.75, 0.74, 0.75, 0.76],
    domestic: [0.73, 0.74, 0.75, 0.76, 0.77, 0.76, 0.77, 0.78, 0.79, 0.78, 0.79, 0.80],
    foreign:  [0.65, 0.64, 0.66, 0.68, 0.67, 0.65, 0.66, 0.68, 0.69, 0.67, 0.69, 0.70],
  },

  volume_trend: {
    labels: ["Wk1","Wk2","Wk3","Wk4","Wk5","Wk6","Wk7","Wk8","Wk9","Wk10","Wk11","Wk12"],
    scored:     [1820,1910,2050,2160,2230,2190,2340,2410,2380,2450,2520,2616],
    manual_rev: [310, 295, 320, 280, 260, 250, 245, 230, 220, 215, 205, 195],
  },

  psi_trend: {
    labels: ["Wk1","Wk2","Wk3","Wk4","Wk5","Wk6","Wk7","Wk8","Wk9","Wk10","Wk11","Wk12"],
    psi:    [0.08, 0.09, 0.10, 0.12, 0.14, 0.18, 0.22, 0.21, 0.19, 0.16, 0.14, 0.13],
  },

  feature_importance: [
    { feature: "tin_validation_status",       importance: 0.182, drift: 0.04 },
    { feature: "address_consistency_score",   importance: 0.151, drift: 0.07 },
    { feature: "registration_active",         importance: 0.128, drift: 0.02 },
    { feature: "entity_age_days",             importance: 0.102, drift: 0.11 },
    { feature: "ubo_verified",                importance: 0.094, drift: 0.03 },
    { feature: "watchlist_hits",              importance: 0.088, drift: 0.01 },
    { feature: "website_domain_age",          importance: 0.071, drift: 0.09 },
    { feature: "naics_confidence",            importance: 0.065, drift: 0.05 },
    { feature: "number_of_filings",           importance: 0.051, drift: 0.06 },
    { feature: "address_contact_overlap",     importance: 0.068, drift: 0.19 },
  ],

  feature_null_rates: [
    { feature: "ubo_verified",            rate: 0.18, threshold: 0.10, status:"amber" },
    { feature: "website_domain_age",      rate: 0.22, threshold: 0.15, status:"amber" },
    { feature: "address_contact_overlap", rate: 0.09, threshold: 0.10, status:"green" },
    { feature: "tin_validation_status",   rate: 0.03, threshold: 0.05, status:"green" },
    { feature: "naics_confidence",        rate: 0.31, threshold: 0.20, status:"red" },
    { feature: "entity_age_days",         rate: 0.02, threshold: 0.05, status:"green" },
  ],

  sources: [
    { source:"Middesk",       freshness:"6h",  failure:0.012, reliability:"High"    },
    { source:"OpenCorporates",freshness:"12h", failure:0.034, reliability:"High"    },
    { source:"Trulioo",       freshness:"4h",  failure:0.021, reliability:"High"    },
    { source:"Equifax",       freshness:"24h", failure:0.058, reliability:"Medium"  },
    { source:"ZoomInfo",      freshness:"24h", failure:0.041, reliability:"Medium"  },
    { source:"Plaid IDV",     freshness:"2h",  failure:0.009, reliability:"High"    },
    { source:"AI NAICS",      freshness:"1h",  failure:0.085, reliability:"Low"     },
  ],

  decisions: {
    bands: ["Very Low","Low","Medium","High","Very High"],
    approved:   [ 60, 220, 1400, 7100, 8050 ],
    declined:   [ 750, 1510, 1850,  240,  50 ],
    escalated:  [  52, 210,  1068,1861, 295 ],
  },

  tat_by_band: [
    { band:"Very Low", p50: 48, p90: 72 },
    { band:"Low",      p50: 24, p90: 48 },
    { band:"Medium",   p50: 12, p90: 28 },
    { band:"High",     p50:  3, p90:  8 },
    { band:"Very High",p50:  1, p90:  4 },
  ],

  ops_exceptions: [
    { id:"ops-001", type:"Stuck at Scoring",      count: 27, age_h: 18, severity:"medium" },
    { id:"ops-002", type:"Pipeline Failure",      count: 6,  age_h: 36, severity:"high"   },
    { id:"ops-003", type:"Manual Review Overdue", count: 42, age_h: 72, severity:"high"   },
    { id:"ops-004", type:"Stale Feature Usage",   count: 88, age_h: 96, severity:"medium" },
  ],

  entity_360: {
    business_id:   "bus_87f20aa1-9c41-4d1e-b3f1-ea1f3e8c1234",
    legal_name:    "Northgate Logistics LLC",
    dba:           "Northgate Freight",
    customer:      "Acme Holdings Inc.",
    ein:           "XX-XXX4821",           // masked
    entity_type:   "Domestic (LLC)",
    jurisdiction:  "Delaware, USA",
    registration:  "Active",
    submitted_at:  "2026-03-12 09:14",
    scored_at:     "2026-03-12 09:16",
    decision_at:   "2026-03-12 11:48",
    confidence:    0.63,
    band:          "Medium",
    decision:      "Escalated",
    red_flags:     3,

    timeline: [
      { ts:"2026-03-12 09:14", title:"Application Submitted",   desc:"Onboarding form received (Acme Holdings)",        tone:"" },
      { ts:"2026-03-12 09:15", title:"TIN Validation",          desc:"IRS EIN verified via Middesk (status=success)",    tone:"green" },
      { ts:"2026-03-12 09:16", title:"Confidence Scored",       desc:"Score=0.63 (Medium band)",                         tone:"amber" },
      { ts:"2026-03-12 09:17", title:"Address Consistency",     desc:"Minor mismatch between USPS and SOS filing",       tone:"amber" },
      { ts:"2026-03-12 09:20", title:"UBO Verification",        desc:"2 of 3 UBOs verified via Trulioo PSC",             tone:"amber" },
      { ts:"2026-03-12 09:45", title:"Check-Agent Triggered",   desc:"Found 3 cross-source inconsistencies",             tone:"red" },
      { ts:"2026-03-12 11:48", title:"Escalated for Manual",    desc:"Routed to analyst queue (SLA 24h)",                tone:"red" },
    ],

    features: [
      { name:"tin_validation_status", value:"success",  source:"Middesk",        conf:0.92, warn:false },
      { name:"registration_active",   value:"true",     source:"Middesk",        conf:0.88, warn:false },
      { name:"address_consistency",   value:"0.58",     source:"OpenCorporates", conf:0.55, warn:true, note:"Disagrees with USPS" },
      { name:"entity_age_days",       value:"412",      source:"SOS",            conf:0.97, warn:false },
      { name:"ubo_verified",          value:"2/3",      source:"Trulioo PSC",    conf:0.60, warn:true, note:"1 UBO unverified" },
      { name:"watchlist_hits",        value:"0",        source:"Trulioo",        conf:1.00, warn:false },
      { name:"website_domain_age",    value:"2.3y",     source:"SERP",           conf:0.70, warn:false },
      { name:"naics_confidence",      value:"0.71",     source:"AI NAICS",       conf:0.71, warn:false },
      { name:"formation_state",       value:"DE",       source:"Middesk",        conf:0.99, warn:true, note:"Tax-haven state" },
      { name:"num_bankruptcies",      value:"0",        source:"Verdata",        conf:1.00, warn:false },
    ],

    verifications: [
      { check:"TIN Validation (IRS)",     status:"Pass", source:"Middesk",         detail:"EIN matches legal name" },
      { check:"Registration Status",      status:"Pass", source:"Middesk",         detail:"Active in Delaware SOS" },
      { check:"Address Verification",     status:"Warn", source:"USPS / OC",       detail:"Minor mismatch between filed and operating address" },
      { check:"UBO Identity (PSC)",       status:"Warn", source:"Trulioo PSC",     detail:"1 of 3 UBOs could not be verified" },
      { check:"Watchlist Screening",      status:"Pass", source:"Trulioo",         detail:"No sanctions, PEP, or adverse media" },
      { check:"Bankruptcies/Liens",       status:"Pass", source:"Verdata",         detail:"No records found" },
    ],

    related: [
      { id:"bus_b94...", name:"Northgate Freight Inc.",      rel:"Shared TIN",      risk:"high" },
      { id:"bus_f22...", name:"Gate North Shipping LLC",     rel:"Shared Address",  risk:"medium" },
      { id:"bus_a71...", name:"North Freight Holdings",      rel:"Shared UBO",      risk:"medium" },
      { id:"bus_c04...", name:"NorthGate Distribution",      rel:"Shared Phone",    risk:"low" },
    ],

    red_flags: [
      { severity:"high",   title:"Shared TIN with unrelated entity",
        desc:"EIN XX-XXX4821 appears on 2 businesses with different legal names.",
        evidence:"facts.tin_match vs facts.related_records[0].tin" },
      { severity:"medium", title:"Address discrepancy",
        desc:"Filed address (Wilmington, DE) differs from operating address (Trenton, NJ).",
        evidence:"USPS.deliverable vs sos_filing.registered_address" },
      { severity:"medium", title:"UBO partially unverified",
        desc:"1 of 3 UBOs failed IDV at Trulioo PSC.",
        evidence:"trulioo_psc.ubo[2].status=failed" },
    ],
  },

  /* ----- Validation / inconsistencies ----- */
  inconsistency_counts: {
    identity:      182,
    identifier:    94,
    address:       161,
    registration:  58,
    model_output:  73,
    temporal:      29,
    network:       121,
  },

  red_flag_ranking: [
    { pattern: "Shared TIN across unrelated entities",      count: 87, severity:"high" },
    { pattern: "Address tied to 5+ businesses",             count: 62, severity:"high" },
    { pattern: "Foreign registration w/ missing docs",      count: 41, severity:"medium" },
    { pattern: "Legal name ≠ DBA / Provider records",       count: 38, severity:"medium" },
    { pattern: "Decision before scoring timestamp",          count: 14, severity:"high" },
    { pattern: "High conf despite missing critical feat.",   count: 53, severity:"medium" },
    { pattern: "UBO linked to 4+ businesses",                count: 29, severity:"medium" },
  ],

  not_matching: [
    { case:"bus_87f2…1234", score:0.83, evidence:"UBO verified 1/3",            gap:"High confidence vs weak UBO evidence",       sev:"high" },
    { case:"bus_b94a…6612", score:0.77, evidence:"TIN mismatch across sources", gap:"Score ignores Trulioo TIN=fail",              sev:"high" },
    { case:"bus_c1f9…aa01", score:0.28, evidence:"All 3 UBOs verified",         gap:"Low confidence despite clean evidence",       sev:"medium" },
    { case:"bus_d03e…7712", score:0.71, evidence:"Dissolved per OC",            gap:"High conf despite OC dissolved status",       sev:"high" },
    { case:"bus_f221…8829", score:0.55, evidence:"Address mismatch USPS/SOS",   gap:"Conf unchanged despite address gap",          sev:"medium" },
  ],

  /* ----- Lineage & discovery ----- */
  tables: [
    { schema:"rds_warehouse_public", table:"facts",                    rows:"28.4M", freshness:"live",  description:"Central fact store" },
    { schema:"rds_cases_public",     table:"rel_business_customer_monitoring", rows:"5.1M",  freshness:"hourly",description:"Business ↔ customer link" },
    { schema:"datascience",           table:"customer_files",           rows:"1.8M", freshness:"daily", description:"Pipeline B output"},
    { schema:"rds_manual_score_public",table:"business_scores",         rows:"2.6M", freshness:"live",  description:"Confidence score history"},
    { schema:"datascience",           table:"zoominfo_matches_custom_inc_ml", rows:"3.4M", freshness:"daily", description:"ZI entity matches"},
    { schema:"datascience",           table:"efx_matches_custom_inc_ml",       rows:"2.1M", freshness:"daily", description:"EFX entity matches"},
    { schema:"warehouse",             table:"oc_companies_latest",      rows:"220M", freshness:"weekly",description:"OpenCorporates registry"},
  ],

  features_catalog: [
    { name:"tin_validation_status",   type:"text",    source:"rds_warehouse_public.facts", owner:"KYB Core",    active:true,  downstream:"confidence_score" },
    { name:"registration_active",     type:"bool",    source:"rds_warehouse_public.facts", owner:"KYB Core",    active:true,  downstream:"confidence_score" },
    { name:"address_consistency",     type:"number",  source:"rds_warehouse_public.facts", owner:"Address Ops", active:true,  downstream:"confidence_score" },
    { name:"ubo_verified",            type:"number",  source:"rds_warehouse_public.facts", owner:"UBO Team",    active:true,  downstream:"confidence_score,red_flags" },
    { name:"watchlist_hits",          type:"number",  source:"rds_warehouse_public.facts", owner:"Compliance",  active:true,  downstream:"red_flags" },
    { name:"naics_confidence",        type:"number",  source:"datascience.customer_files", owner:"Data Science",active:true,  downstream:"industry_classification" },
  ],

  repo_files: [
    { path:"integration-service/lib/facts/kyb/index.ts",           role:"fact definitions" },
    { path:"integration-service/lib/facts/businessDetails/index.ts", role:"business-detail facts" },
    { path:"integration-service/lib/facts/rules.ts",               role:"winner/priority rules" },
    { path:"integration-service/lib/facts/sources.ts",             role:"source/platformId registry" },
    { path:"ai-score-service/aiscore.py",                          role:"confidence model scoring" },
    { path:"ai-score-service/worth_score_model.py",                role:"model training" },
    { path:"warehouse-service/datapooler/.../customer_table.sql",  role:"Pipeline B join" },
    { path:"api-docs/openapi-specs/get-kyb.json",                  role:"authoritative schema" },
  ],

  glossary: [
    { term:"Confidence Score",     def:"Model-derived probability (0–1) that a business is correctly KYB-verified." },
    { term:"Confidence Band",      def:"Discrete grouping of scores (Very Low / Low / Medium / High / Very High)." },
    { term:"PSI",                  def:"Population Stability Index — measures distribution drift of a feature/score." },
    { term:"Check-Agent",          def:"Automated module that scans data for inconsistencies, red flags, and model-evidence gaps." },
    { term:"UBO",                  def:"Ultimate Beneficial Owner — natural person(s) who ultimately own/control an entity." },
    { term:"Winner Rule",          def:"Deterministic rule that selects the highest-confidence source when multiple providers disagree." },
  ],

  /* ----- Relationship graph (Entity 360) ----- */
  rel_graph_nodes: [
    { id:"E1", label:"Northgate Logistics LLC", type:"business-main", x: 400, y: 170 },
    { id:"E2", label:"Northgate Freight Inc.",  type:"business",      x: 160, y:  90 },
    { id:"E3", label:"Gate North Shipping",     type:"business",      x: 160, y: 250 },
    { id:"E4", label:"North Freight Holdings",  type:"business",      x: 640, y:  90 },
    { id:"E5", label:"NorthGate Distribution",  type:"business",      x: 640, y: 250 },
    { id:"T1", label:"EIN XX-4821",             type:"identifier",    x: 280, y:  30 },
    { id:"A1", label:"123 Dock St, Trenton NJ", type:"address",       x: 280, y: 310 },
    { id:"U1", label:"UBO: Rita Chen",          type:"person",        x: 520, y:  30 },
    { id:"P1", label:"Phone (555) 010-4420",    type:"phone",         x: 520, y: 310 },
  ],
  rel_graph_links: [
    { s:"E1", t:"T1", warn:true  },
    { s:"E2", t:"T1", warn:true  },
    { s:"E1", t:"A1", warn:false },
    { s:"E3", t:"A1", warn:true  },
    { s:"E1", t:"U1", warn:false },
    { s:"E4", t:"U1", warn:true  },
    { s:"E1", t:"P1", warn:false },
    { s:"E5", t:"P1", warn:false },
  ],
};
