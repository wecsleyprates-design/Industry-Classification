/* ============================================================
   Pages renderer — builds 9-tab UI with sub-tabs and mock data
   ============================================================ */

/* --------------- helpers --------------- */
function kpi({lbl, val, sub, delta, color, objKey}) {
  const dHtml = delta
    ? `<div class="delta ${delta>=0?'up':'down'}">${delta>=0?'▲':'▼'} ${Math.abs(delta)}${typeof delta==='number' && Math.abs(delta)<1?'':'%'}</div>`
    : '';
  return `
    <div class="kpi ${color||''}">
      <div class="trust-bar">
        <button class="trust-btn" title="Ask AI"       onclick="openAskAi('${objKey||lbl}')"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
        <button class="trust-btn" title="Run Check-Agent" onclick="openCheckAgent('${objKey||lbl}')"><i class="fa-solid fa-shield-virus"></i></button>
        <button class="trust-btn" title="View Lineage"    onclick="openLineage('${objKey||lbl}')"><i class="fa-solid fa-sitemap"></i></button>
      </div>
      <div class="lbl">${lbl}</div>
      <div class="val">${val}</div>
      ${sub?`<div class="sub">${sub}</div>`:''}
      ${dHtml}
    </div>`;
}

function panel(title, icon, innerHtml, objKey) {
  return `<div class="panel">
    <div class="trust-bar">
      <button class="trust-btn" title="Ask AI"          onclick="openAskAi('${objKey||title}')"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
      <button class="trust-btn" title="Run Check-Agent" onclick="openCheckAgent('${objKey||title}')"><i class="fa-solid fa-shield-virus"></i></button>
      <button class="trust-btn" title="View Lineage"    onclick="openLineage('${objKey||title}')"><i class="fa-solid fa-sitemap"></i></button>
    </div>
    <h3><i class="fa-solid ${icon}"></i> ${title}</h3>
    ${innerHtml}
  </div>`;
}

function subTabs(tabId, tabs) {
  return `
    <div class="sub-tabs" data-tab="${tabId}">
      ${tabs.map((t,i)=>`<button class="sub-tab ${i===0?'active':''}" data-sub="${t.id}">${t.label}</button>`).join('')}
    </div>
    ${tabs.map((t,i)=>`<div class="sub-page ${i===0?'active':''}" data-sub="${t.id}">${t.html}</div>`).join('')}
  `;
}

/* ============================================================
   TAB 1 — Executive Overview
============================================================ */
function renderTab1() {
  const p = MOCK.portfolio;
  const kpiGrid = `
    <div class="kpi-grid">
      ${kpi({lbl:"Total KYB Cases",   val:p.total_cases.toLocaleString(),  sub:"in period",                        color:"",       objKey:"kpi.total_cases"})}
      ${kpi({lbl:"Distinct Customers",val:p.distinct_customers.toLocaleString(), sub:"unique customer accounts",  color:"purple", objKey:"kpi.distinct_customers"})}
      ${kpi({lbl:"Distinct Businesses",val:p.distinct_businesses.toLocaleString(),sub:"unique business entities", color:"cyan",   objKey:"kpi.distinct_businesses"})}
      ${kpi({lbl:"Avg Confidence",    val:p.avg_confidence.toFixed(3),     delta:p.delta_avg_conf,                 color:"green",  objKey:"kpi.avg_confidence"})}
      ${kpi({lbl:"Manual Review %",   val:p.manual_review_pct+"%",         delta:p.delta_manual,                   color:"amber",  objKey:"kpi.manual_review"})}
      ${kpi({lbl:"Auto-Approved %",   val:p.auto_approve_pct+"%",          sub:"no manual required",               color:"green",  objKey:"kpi.auto_approve"})}
    </div>`;

  const summary = `
    ${kpiGrid}
    ${panel("Confidence Band Distribution","fa-chart-pie", `<div class="chart-wrap"><canvas id="ch-bands"></canvas></div>`, "chart.bands")}
    ${panel("Decision Outcome Mix","fa-scale-balanced",    `<div class="chart-wrap"><canvas id="ch-decisions"></canvas></div>`, "chart.decisions")}
  `;

  const trends = `
    ${panel("Confidence Score Trend (Domestic vs Foreign)","fa-chart-line",
       `<div class="chart-wrap tall"><canvas id="ch-trend"></canvas></div>`, "chart.confidence_trend")}
    ${panel("Scoring Volume & Manual Review Trend","fa-chart-column",
       `<div class="chart-wrap tall"><canvas id="ch-volume"></canvas></div>`, "chart.volume_trend")}
  `;

  const exc = `
    ${panel("Top Red Flag Categories (portfolio)","fa-triangle-exclamation", `
      <table class="data-table">
        <thead><tr><th>Pattern</th><th>Cases</th><th>Severity</th></tr></thead>
        <tbody>
          ${MOCK.red_flag_ranking.map(r=>`
            <tr><td>${r.pattern}</td><td>${r.count}</td>
              <td><span class="pill ${r.severity==='high'?'red':r.severity==='medium'?'amber':'blue'}">${r.severity.toUpperCase()}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    `, "exec.red_flag_top")}
    ${panel("Operational Exceptions","fa-gears", `
      <table class="data-table">
        <thead><tr><th>Type</th><th>Count</th><th>Oldest (h)</th><th>Severity</th></tr></thead>
        <tbody>
          ${MOCK.ops_exceptions.map(r=>`
            <tr><td>${r.type}</td><td>${r.count}</td><td>${r.age_h}</td>
              <td><span class="pill ${r.severity==='high'?'red':'amber'}">${r.severity.toUpperCase()}</span></td></tr>`).join('')}
        </tbody>
      </table>
    `, "exec.ops_exceptions")}
  `;

  return `
    <div class="page-header">
      <div><h1>Executive Overview</h1><p>Portfolio-level KYB confidence, trends, and exceptions.</p></div>
    </div>
    ${subTabs('t1',[
      {id:'s1', label:'Portfolio Summary',  html: summary},
      {id:'s2', label:'Trend Monitoring',   html: trends},
      {id:'s3', label:'Executive Exceptions', html: exc},
    ])}
  `;
}

/* ============================================================
   TAB 2 — KYB Confidence Monitoring
============================================================ */
function renderTab2() {
  const overview = `
    <div class="kpi-grid">
      ${kpi({lbl:"Avg Score",    val:MOCK.portfolio.avg_confidence.toFixed(3), sub:"across portfolio", color:"green",  objKey:"conf.avg"})}
      ${kpi({lbl:"Median Score", val:MOCK.portfolio.median_confidence.toFixed(3), sub:"p50",            color:"",       objKey:"conf.median"})}
      ${kpi({lbl:"Low Band %",   val:"11.3%", sub:"score < 0.4",                color:"red",    objKey:"conf.low_pct"})}
      ${kpi({lbl:"High Band %",  val:"71.2%", sub:"score ≥ 0.6",                color:"green",  objKey:"conf.high_pct"})}
    </div>
    ${panel("Confidence Distribution","fa-chart-area", `<div class="chart-wrap"><canvas id="ch-conf-dist"></canvas></div>`, "chart.conf_dist")}
  `;
  const stability = `
    ${panel("Population Stability Index (PSI)","fa-wave-square",
        `<p class="muted small">Thresholds: <span class="pill green">&lt;0.10 stable</span> <span class="pill amber">0.10–0.25 monitor</span> <span class="pill red">&gt;0.25 drift</span></p>
         <div class="chart-wrap"><canvas id="ch-psi"></canvas></div>`, "chart.psi")}
    ${panel("Top Drifting Features","fa-arrow-trend-up", `
      <table class="data-table">
        <thead><tr><th>Feature</th><th>PSI</th><th>Status</th></tr></thead>
        <tbody>
          ${MOCK.feature_importance.slice().sort((a,b)=>b.drift-a.drift).slice(0,6).map(f=>`
            <tr><td>${f.feature}</td><td>${f.drift.toFixed(2)}</td>
                <td><span class="pill ${f.drift>0.25?'red':f.drift>0.10?'amber':'green'}">
                    ${f.drift>0.25?'DRIFT':f.drift>0.10?'MONITOR':'STABLE'}</span></td></tr>`).join('')}
        </tbody>
      </table>
    `, "feat.drift_top")}
  `;
  const volume = `
    ${panel("Prediction Volume & Pipeline Completeness","fa-chart-column",
       `<div class="chart-wrap"><canvas id="ch-volume-2"></canvas></div>`, "chart.volume")}
    ${panel("Pipeline Failure Rates","fa-bug", `
      <table class="data-table">
        <thead><tr><th>Stage</th><th>Cases</th><th>Fail %</th></tr></thead>
        <tbody>
          <tr><td>Feature Materialization</td><td>24,716</td><td>0.4%</td></tr>
          <tr><td>Model Scoring</td>          <td>24,619</td><td>0.1%</td></tr>
          <tr><td>Decision Routing</td>       <td>24,589</td><td>0.2%</td></tr>
          <tr><td>External Enrichment</td>    <td>24,716</td><td>3.1%</td></tr>
        </tbody></table>
    `, "pipe.failures")}
  `;
  const explain = `
    ${panel("Global Feature Importance","fa-chart-bar",
       `<div class="chart-wrap tall"><canvas id="ch-feat-imp"></canvas></div>`, "chart.feat_importance")}
    ${panel("What Drives Low-Confidence Cases?","fa-magnifying-glass-chart",`
      <p class="muted small">Aggregated SHAP contributions across cases with score &lt; 0.4.</p>
      <ul>
        <li>🔻 <b>address_contact_overlap</b> is the top negative signal in 38% of low-band cases.</li>
        <li>🔻 <b>ubo_verified</b> partial matches contribute in 27% of low-band cases.</li>
        <li>🔻 <b>registration_active = false</b> appears in 19% of low-band cases.</li>
      </ul>
    `, "explain.low_band")}
  `;

  return `
    <div class="page-header"><div><h1>KYB Confidence Monitoring</h1><p>Model outputs, stability, and explainability.</p></div></div>
    ${subTabs('t2',[
      {id:'s1', label:'Score Overview',       html: overview},
      {id:'s2', label:'Score Stability (PSI)', html: stability},
      {id:'s3', label:'Prediction Volume',     html: volume},
      {id:'s4', label:'Model Explainability',  html: explain},
    ])}
  `;
}

/* ============================================================
   TAB 3 — Feature Health & Data Quality
============================================================ */
function renderTab3() {
  const completeness = `
    ${panel("Feature Null-Rate Monitor","fa-droplet", `
      <table class="data-table">
        <thead><tr><th>Feature</th><th>Null Rate</th><th>Threshold</th><th>Status</th></tr></thead>
        <tbody>${MOCK.feature_null_rates.map(f=>`
          <tr><td>${f.feature}</td><td>${(f.rate*100).toFixed(1)}%</td><td>${(f.threshold*100).toFixed(1)}%</td>
              <td><span class="pill ${f.status==='green'?'green':f.status==='amber'?'amber':'red'}">${f.status.toUpperCase()}</span></td></tr>`).join('')}
        </tbody></table>
    `, "feat.null_rates")}
  `;
  const dist = panel("Feature Distribution Drift","fa-wave-square",
    `<div class="chart-wrap"><canvas id="ch-feat-drift"></canvas></div>`, "chart.feat_drift");

  const dq = `
    ${panel("Data Quality Rule Violations","fa-list-check", `
      <table class="data-table">
        <thead><tr><th>Rule</th><th>Domain</th><th>Failed Records</th><th>Last Run</th></tr></thead>
        <tbody>
          <tr><td>tin_format_valid</td><td>identifier</td><td>142</td><td>2h ago</td></tr>
          <tr><td>address_country_iso</td><td>address</td><td>37</td><td>2h ago</td></tr>
          <tr><td>score_between_0_1</td><td>model</td><td>0</td><td>1h ago</td></tr>
          <tr><td>registration_date_past</td><td>registration</td><td>6</td><td>4h ago</td></tr>
        </tbody></table>
    `, "dq.rules")}
  `;
  const srcRel = panel("Source Reliability","fa-plug", `
    <table class="data-table">
      <thead><tr><th>Source</th><th>Freshness</th><th>Failure %</th><th>Reliability</th></tr></thead>
      <tbody>${MOCK.sources.map(s=>`
        <tr><td>${s.source}</td><td>${s.freshness}</td><td>${(s.failure*100).toFixed(1)}%</td>
            <td><span class="pill ${s.reliability==='High'?'green':s.reliability==='Medium'?'amber':'red'}">${s.reliability}</span></td></tr>`).join('')}
      </tbody></table>
  `, "src.reliability");

  return `
    <div class="page-header"><div><h1>Feature Health & Data Quality</h1><p>Completeness, drift, rule violations, and source reliability.</p></div></div>
    ${subTabs('t3',[
      {id:'s1', label:'Feature Completeness', html: completeness},
      {id:'s2', label:'Distribution Monitoring', html: dist},
      {id:'s3', label:'Data Quality Checks', html: dq},
      {id:'s4', label:'Source Reliability', html: srcRel},
    ])}
  `;
}

/* ============================================================
   TAB 4 — Decision Impact & Operations
============================================================ */
function renderTab4() {
  const decision = panel("Confidence vs. Decision Outcome","fa-scale-balanced",
    `<div class="chart-wrap tall"><canvas id="ch-decision-mix"></canvas></div>`, "chart.decision_mix");

  const tat = panel("Turnaround Time by Confidence Band","fa-stopwatch", `
    <table class="data-table">
      <thead><tr><th>Band</th><th>p50 (hrs)</th><th>p90 (hrs)</th></tr></thead>
      <tbody>${MOCK.tat_by_band.map(r=>`<tr><td>${r.band}</td><td>${r.p50}</td><td>${r.p90}</td></tr>`).join('')}</tbody>
    </table>
    <div class="chart-wrap short"><canvas id="ch-tat"></canvas></div>
  `, "chart.tat");

  const manual = `
    <div class="kpi-grid">
      ${kpi({lbl:"Manual Reviews (period)", val:"3,652",  sub:"14.8% of cases", color:"amber", objKey:"manual.total"})}
      ${kpi({lbl:"Open Queue",              val:"214",    sub:"analyst workload",color:"",     objKey:"manual.queue"})}
      ${kpi({lbl:"SLA Breaches",            val:"28",     sub:">24h in review",  color:"red",  objKey:"manual.sla"})}
    </div>
    ${panel("Top Reasons Routed to Manual","fa-user-gear", `
      <table class="data-table"><thead><tr><th>Reason</th><th>Share</th></tr></thead>
        <tbody>
          <tr><td>UBO partial verification</td><td>28%</td></tr>
          <tr><td>Address/SOS mismatch</td><td>22%</td></tr>
          <tr><td>Watchlist hit / adverse media</td><td>17%</td></tr>
          <tr><td>Score in review band (0.4–0.6)</td><td>19%</td></tr>
          <tr><td>Pipeline/Source failure</td><td>8%</td></tr>
          <tr><td>Other</td><td>6%</td></tr>
        </tbody></table>
    `, "manual.reasons")}
  `;

  const ops = panel("Operational Exceptions (detailed)","fa-triangle-exclamation", `
    <table class="data-table">
      <thead><tr><th>Exception Type</th><th>Count</th><th>Oldest (h)</th><th>Severity</th><th>Action</th></tr></thead>
      <tbody>${MOCK.ops_exceptions.map(r=>`
        <tr><td>${r.type}</td><td>${r.count}</td><td>${r.age_h}</td>
            <td><span class="pill ${r.severity==='high'?'red':'amber'}">${r.severity.toUpperCase()}</span></td>
            <td><button class="btn-ghost small">Investigate →</button></td></tr>`).join('')}
      </tbody></table>
  `, "ops.table");

  return `
    <div class="page-header"><div><h1>Decision Impact & Operations</h1><p>How confidence maps to decisions, SLAs, and operational exceptions.</p></div></div>
    ${subTabs('t4',[
      {id:'s1', label:'Confidence vs. Decision',       html: decision},
      {id:'s2', label:'Confidence vs. Turnaround Time',html: tat},
      {id:'s3', label:'Manual Review Monitoring',     html: manual},
      {id:'s4', label:'Operational Exceptions',       html: ops},
    ])}
  `;
}

/* ============================================================
   TAB 5 — Customer / Business 360
============================================================ */
function renderTab5() {
  const e = MOCK.entity_360;
  const summary = `
    <div class="panel">
      <div class="trust-bar">
        <button class="trust-btn" onclick="openAskAi('entity.summary')"><i class="fa-solid fa-wand-magic-sparkles"></i></button>
        <button class="trust-btn" onclick="openCheckAgent('entity.summary')"><i class="fa-solid fa-shield-virus"></i></button>
        <button class="trust-btn" onclick="openLineage('entity.summary')"><i class="fa-solid fa-sitemap"></i></button>
      </div>
      <h3><i class="fa-solid fa-building"></i> ${e.legal_name} <span class="pill gray" style="margin-left:10px">${e.entity_type}</span></h3>
      <div class="grid-3">
        <div><div class="muted small">Business ID</div><div>${e.business_id}</div></div>
        <div><div class="muted small">DBA</div><div>${e.dba}</div></div>
        <div><div class="muted small">Customer</div><div>${e.customer}</div></div>
        <div><div class="muted small">EIN (masked)</div><div>${e.ein}</div></div>
        <div><div class="muted small">Jurisdiction</div><div>${e.jurisdiction}</div></div>
        <div><div class="muted small">Registration</div><div><span class="pill green">${e.registration}</span></div></div>
      </div>
    </div>
    <div class="kpi-grid">
      ${kpi({lbl:"Confidence Score", val:e.confidence.toFixed(2),  sub:e.band+" band",     color:"amber", objKey:"entity.confidence"})}
      ${kpi({lbl:"Decision",         val:e.decision,                sub:"at "+e.decision_at, color:"amber", objKey:"entity.decision"})}
      ${kpi({lbl:"Red Flags",        val:e.red_flags,               sub:"open severity",     color:"red",   objKey:"entity.red_flags"})}
      ${kpi({lbl:"Time to Score",    val:"2 min",                    sub:e.scored_at,         color:"green", objKey:"entity.tts"})}
    </div>
  `;

  const timeline = panel("Event Timeline","fa-timeline", `
    <div class="timeline">
      ${e.timeline.map(t=>`
        <div class="tl-event ${t.tone}">
          <div class="tl-time">${t.ts}</div>
          <div class="tl-title">${t.title}</div>
          <div class="tl-desc">${t.desc}</div>
        </div>`).join('')}
    </div>`, "entity.timeline");

  const features = panel("Feature Snapshot","fa-table-cells", `
    <table class="data-table">
      <thead><tr><th>Feature</th><th>Value</th><th>Source</th><th>Confidence</th><th>Note</th></tr></thead>
      <tbody>${e.features.map(f=>`
        <tr><td>${f.name}</td><td>${f.value}</td><td>${f.source}</td><td>${f.conf.toFixed(2)}</td>
            <td>${f.warn?`<span class="pill amber">⚠ ${f.note||'check'}</span>`:'<span class="pill green">OK</span>'}</td></tr>`).join('')}
      </tbody></table>
  `, "entity.features");

  const verif = panel("Verification Checklist","fa-clipboard-check", `
    <table class="data-table">
      <thead><tr><th>Check</th><th>Status</th><th>Source</th><th>Detail</th></tr></thead>
      <tbody>${e.verifications.map(v=>`
        <tr><td>${v.check}</td>
            <td><span class="pill ${v.status==='Pass'?'green':v.status==='Warn'?'amber':'red'}">${v.status}</span></td>
            <td>${v.source}</td><td>${v.detail}</td></tr>`).join('')}
      </tbody></table>
  `, "entity.verification");

  const related = `
    ${panel("Relationship Graph","fa-diagram-project", `<div id="rel-graph" class="rel-graph"></div>`, "entity.rel_graph")}
    ${panel("Linked Entities","fa-link", `
      <table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Relationship</th><th>Risk</th></tr></thead>
        <tbody>${e.related.map(r=>`
          <tr><td>${r.id}</td><td>${r.name}</td><td>${r.rel}</td>
              <td><span class="pill ${r.risk==='high'?'red':r.risk==='medium'?'amber':'green'}">${r.risk.toUpperCase()}</span></td></tr>`).join('')}
        </tbody></table>
    `, "entity.related")}
  `;

  const risk = `
    ${panel("Case Red Flags","fa-flag", `
      ${e.red_flags.map(rf=>`
        <div class="flag ${rf.severity==='high'?'red':'amber'}">
          <b>${rf.title}</b><br/>${rf.desc}<br/>
          <span class="muted small">evidence: ${rf.evidence}</span>
        </div>`).join('')}
    `, "entity.flags")}
    ${panel("Investigation Notes","fa-pen-to-square", `
      <textarea class="code-editor" style="min-height:120px" placeholder="Analyst notes (not persisted in prototype)…"></textarea>
      <div class="editor-bar"><span class="muted small">Autosaved to local browser in real app.</span>
        <button class="btn-primary">Save Note</button></div>
    `, "entity.notes")}
  `;

  return `
    <div class="page-header">
      <div><h1>Customer / Business 360</h1><p>Entity-level deep dive. Select a business from the global filter.</p></div>
    </div>
    ${subTabs('t5',[
      {id:'s1', label:'Summary Profile',  html: summary},
      {id:'s2', label:'Timeline',          html: timeline},
      {id:'s3', label:'Feature Snapshot',  html: features},
      {id:'s4', label:'Verification',      html: verif},
      {id:'s5', label:'Related Records',   html: related},
      {id:'s6', label:'Risk & Red Flags',  html: risk},
    ])}
  `;
}

/* ============================================================
   TAB 6 — Inconsistency & Red Flag Center
============================================================ */
function renderTab6() {
  const dash = `
    <div class="kpi-grid">
      ${Object.entries(MOCK.inconsistency_counts).map(([k,v])=>
        kpi({lbl:k+" inconsistencies", val:v, color: v>100?'red':v>50?'amber':'green', objKey:"incon."+k})).join('')}
    </div>
    ${panel("Inconsistency Volume by Category","fa-chart-bar",
       `<div class="chart-wrap"><canvas id="ch-incon"></canvas></div>`, "chart.incon")}
  `;
  const xref = panel("Cross-Reference Checks","fa-link-slash", `
    <table class="data-table">
      <thead><tr><th>Pattern</th><th>Cases</th><th>Severity</th><th>Action</th></tr></thead>
      <tbody>${MOCK.red_flag_ranking.map(r=>`
        <tr><td>${r.pattern}</td><td>${r.count}</td>
            <td><span class="pill ${r.severity==='high'?'red':'amber'}">${r.severity.toUpperCase()}</span></td>
            <td><button class="btn-ghost small" onclick="openCheckAgent('xref.'+'${r.pattern}')">Inspect →</button></td></tr>`).join('')}
      </tbody></table>
  `, "xref.table");

  const red = panel("Red Flag Queue (severity-ranked)","fa-flag-checkered", `
    ${MOCK.red_flag_ranking.map(r=>`
      <div class="flag ${r.severity==='high'?'red':'amber'}">
        <b>${r.pattern}</b> — ${r.count} cases affected
        <div class="muted small" style="margin-top:4px">Recommended: review the top 10 entities and confirm identity cluster.</div>
      </div>`).join('')}
  `, "redflag.queue");

  const check = panel("Check-Agent Results (portfolio scan)","fa-shield-virus", `
    <p class="muted small">Last scan: 12 minutes ago · 7 rule families evaluated · 28 deterministic rules + LLM auditor.</p>
    <div class="check-finding critical">
      <h5>Temporal: Decision before scoring <span class="pill red">CRITICAL</span></h5>
      <p>14 cases have decision_at &lt; scored_at — impossible sequence suggesting backdating or pipeline replay.</p>
      <div class="evid">evidence: decisions.decision_at vs business_scores.created_at</div>
    </div>
    <div class="check-finding high">
      <h5>Network: One address → 6 unrelated businesses <span class="pill red">HIGH</span></h5>
      <p>“123 Dock St, Trenton NJ” is filed as registered address for 6 entities with no shared UBO.</p>
      <div class="evid">evidence: facts.address (cluster by normalized address)</div>
    </div>
    <div class="check-finding medium">
      <h5>Model: High confidence despite missing UBO <span class="pill amber">MEDIUM</span></h5>
      <p>53 cases scored ≥ 0.75 with ubo_verified null/partial.</p>
      <div class="evid">evidence: confidence.score vs facts.ubo_verified</div>
    </div>
  `, "check.portfolio");

  const notmatch = panel("Not-Matching Result Review","fa-code-compare", `
    <p class="muted small">Cases where model output disagrees with underlying evidence.</p>
    <table class="data-table">
      <thead><tr><th>Case</th><th>Score</th><th>Evidence Summary</th><th>Gap</th><th>Sev</th></tr></thead>
      <tbody>${MOCK.not_matching.map(r=>`
        <tr><td>${r.case}</td><td>${r.score.toFixed(2)}</td><td>${r.evidence}</td><td>${r.gap}</td>
            <td><span class="pill ${r.sev==='high'?'red':'amber'}">${r.sev.toUpperCase()}</span></td></tr>`).join('')}
      </tbody></table>
  `, "notmatch.table");

  return `
    <div class="page-header"><div><h1>Inconsistency & Red Flag Center</h1><p>Detect mismatches, cross-reference risks, and model/evidence disagreements.</p></div></div>
    ${subTabs('t6',[
      {id:'s1', label:'Inconsistency Dashboard', html: dash},
      {id:'s2', label:'Cross-Reference Checks', html: xref},
      {id:'s3', label:'Red Flag Detection',      html: red},
      {id:'s4', label:'Check-Agent Results',     html: check},
      {id:'s5', label:'Not-Matching Review',     html: notmatch},
    ])}
  `;
}

/* ============================================================
   TAB 7 — Lineage & Data Discovery
============================================================ */
function renderTab7() {
  const tables = panel("Table Catalog","fa-database", `
    <input type="text" id="table-search" class="filter-group" style="min-width:260px;margin-bottom:10px" placeholder="Search schemas / tables…" oninput="filterTables(this.value)"/>
    <table class="data-table" id="tbl-catalog">
      <thead><tr><th>Schema</th><th>Table</th><th>Rows</th><th>Freshness</th><th>Description</th></tr></thead>
      <tbody>${MOCK.tables.map(t=>`
        <tr><td>${t.schema}</td><td><a href="#" onclick="openLineage('table.'+'${t.schema}.${t.table}');return false;">${t.table}</a></td>
            <td>${t.rows}</td><td>${t.freshness}</td><td>${t.description}</td></tr>`).join('')}
      </tbody></table>
  `, "catalog.tables");

  const cols = panel("Column / Field Catalog","fa-table-columns", `
    <p class="muted small">Search column metadata across all tables.</p>
    <table class="data-table">
      <thead><tr><th>Column</th><th>Type</th><th>Example Tables</th><th>Sensitivity</th></tr></thead>
      <tbody>
        <tr><td>business_id</td><td>VARCHAR (UUID)</td><td>facts, business_scores, customer_files</td><td><span class="pill amber">INTERNAL</span></td></tr>
        <tr><td>name</td><td>VARCHAR</td><td>facts</td><td><span class="pill blue">LOW</span></td></tr>
        <tr><td>value</td><td>VARCHAR (JSON)</td><td>facts</td><td><span class="pill amber">INTERNAL</span></td></tr>
        <tr><td>weighted_score_850</td><td>FLOAT</td><td>business_scores</td><td><span class="pill blue">LOW</span></td></tr>
        <tr><td>tax_id</td><td>VARCHAR</td><td>customer_files</td><td><span class="pill red">SENSITIVE — MASKED</span></td></tr>
      </tbody></table>
  `, "catalog.columns");

  const features = panel("Feature Registry","fa-boxes-stacked", `
    <table class="data-table">
      <thead><tr><th>Feature</th><th>Type</th><th>Source Table</th><th>Owner</th><th>Active</th><th>Downstream</th></tr></thead>
      <tbody>${MOCK.features_catalog.map(f=>`
        <tr><td><a href="#" onclick="openLineage('feature.${f.name}');return false;">${f.name}</a></td>
            <td>${f.type}</td><td>${f.source}</td><td>${f.owner}</td>
            <td><span class="pill ${f.active?'green':'gray'}">${f.active?'active':'retired'}</span></td>
            <td>${f.downstream}</td></tr>`).join('')}
      </tbody></table>
  `, "feature.registry");

  const lineage = panel("Field Lineage Explorer","fa-diagram-project", `
    <p class="muted small">Select a feature to see upstream sources and downstream consumers.</p>
    <select id="lineage-select" onchange="renderFieldLineage(this.value)">
      ${MOCK.features_catalog.map(f=>`<option value="${f.name}">${f.name}</option>`).join('')}
    </select>
    <div id="field-lineage-view" style="margin-top:12px"></div>
  `, "lineage.explorer");

  const repo = panel("Repo Explorer","fa-folder-tree", `
    <table class="data-table">
      <thead><tr><th>Path</th><th>Role</th></tr></thead>
      <tbody>${MOCK.repo_files.map(r=>`
        <tr><td><code>${r.path}</code></td><td>${r.role}</td></tr>`).join('')}
      </tbody></table>
  `, "repo.explorer");

  return `
    <div class="page-header"><div><h1>Lineage & Data Discovery</h1><p>Catalog of tables, fields, features, lineage, and source code.</p></div></div>
    ${subTabs('t7',[
      {id:'s1', label:'Table Catalog',     html: tables},
      {id:'s2', label:'Column Catalog',    html: cols},
      {id:'s3', label:'Feature Registry',  html: features},
      {id:'s4', label:'Field Lineage',     html: lineage},
      {id:'s5', label:'Repo Explorer',     html: repo},
    ])}
  `;
}

/* ============================================================
   TAB 8 — Data Explorer (SQL / Python Runners)
============================================================ */
function renderTab8() {
  const sqlRunner = panel("SQL Runner","fa-terminal", `
    <p class="muted small">Read-only connection. SELECT-only statements are allowed. LIMIT is enforced automatically.</p>
    <textarea id="sql-editor" class="code-editor">-- Top 10 cases scored in the last 24h
SELECT business_id, JSON_EXTRACT_PATH_TEXT(value,'value') AS score
FROM rds_warehouse_public.facts
WHERE name='confidence_score'
  AND received_at >= CURRENT_DATE - INTERVAL '1 day'
ORDER BY received_at DESC
LIMIT 10;</textarea>
    <div class="editor-bar">
      <span class="muted small">Mock result (prototype)</span>
      <div>
        <button class="btn-ghost small">Validate</button>
        <button class="btn-primary" onclick="runSqlMock()"><i class="fa-solid fa-play"></i> Run</button>
      </div>
    </div>
    <div id="sql-output" class="view-gen-output"><span class="muted small">Results will appear here.</span></div>
  `, "explorer.sql");

  const pyRunner = panel("Python Runner (sandboxed)","fa-code", `
    <p class="muted small">Pandas + numpy available. No filesystem or network. 15s CPU limit.</p>
    <textarea id="py-editor" class="code-editor">import pandas as pd
df = pd.DataFrame({
  'band':['VeryLow','Low','Medium','High','VeryHigh'],
  'count':[862,1940,4318,9201,8395]
})
df['pct'] = df['count'] / df['count'].sum() * 100
df.round(1)</textarea>
    <div class="editor-bar">
      <span class="muted small">Mock execution (prototype)</span>
      <button class="btn-primary" onclick="runPyMock()"><i class="fa-solid fa-play"></i> Run</button>
    </div>
    <div id="py-output" class="view-gen-output"><span class="muted small">Output will appear here.</span></div>
  `, "explorer.python");

  const health = panel("Dataset Health","fa-heart-pulse", `
    <div class="kpi-grid">
      ${kpi({lbl:"Null Spikes (24h)",  val:"3",  color:"amber", objKey:"dataset.nulls"})}
      ${kpi({lbl:"Duplicate Keys",      val:"0",  color:"green", objKey:"dataset.dups"})}
      ${kpi({lbl:"Join Coverage",       val:"99.2%", color:"green", objKey:"dataset.joins"})}
      ${kpi({lbl:"Source Disagreements",val:"218", color:"amber", objKey:"dataset.dis"})}
    </div>
  `, "dataset.health");

  const joins = panel("Join & Key Validation","fa-arrows-left-right-to-line", `
    <table class="data-table">
      <thead><tr><th>Left</th><th>Right</th><th>Key</th><th>Match %</th><th>Orphans</th></tr></thead>
      <tbody>
        <tr><td>facts</td><td>business_scores</td><td>business_id</td><td>99.8%</td><td>52</td></tr>
        <tr><td>business_scores</td><td>rel_business_customer_monitoring</td><td>business_id</td><td>99.1%</td><td>236</td></tr>
        <tr><td>customer_files</td><td>zoominfo_matches_custom_inc_ml</td><td>business_id</td><td>97.4%</td><td>4,721</td></tr>
      </tbody></table>
  `, "joins.validation");

  return `
    <div class="page-header"><div><h1>Data Explorer</h1><p>Ad-hoc SQL and Python against Redshift + data-health tools.</p></div></div>
    ${subTabs('t8',[
      {id:'s1', label:'SQL Runner',         html: sqlRunner},
      {id:'s2', label:'Python Runner',      html: pyRunner},
      {id:'s3', label:'Dataset Health',     html: health},
      {id:'s4', label:'Join & Key Validation', html: joins},
    ])}
  `;
}

/* ============================================================
   TAB 9 — AI Copilot & Check-Agent
============================================================ */
function renderTab9() {
  const ask = panel("Ask the AI — natural language analysis","fa-wand-magic-sparkles", `
    <p class="muted small">Describe what you want to analyze. The AI View Generator will interpret intent, write SQL, execute it, and render a visual.</p>
    <input type="text" id="ai-view-prompt" class="code-editor" style="min-height:50px"
           placeholder="e.g. Compare domestic vs foreign confidence scores over the last 90 days"/>
    <div class="editor-bar">
      <div class="ask-ai-suggestions">
        <span class="chip" onclick="presetAiView('Show weekly trend of low-confidence cases in Texas.')">Weekly trend — low-conf in Texas</span>
        <span class="chip" onclick="presetAiView('Top 10 addresses tied to more than 3 businesses.')">Top shared-address clusters</span>
        <span class="chip" onclick="presetAiView('Which features drift the most this quarter?')">Biggest drifting features</span>
      </div>
      <button class="btn-primary" onclick="generateAiView()"><i class="fa-solid fa-bolt"></i> Generate View</button>
    </div>
    <div id="ai-view-output" class="view-gen-output"><span class="muted small">Interpreted intent, generated SQL, executed result, and visualization will appear here.</span></div>
  `, "copilot.view_gen");

  const check = panel("Check-Agent Console","fa-shield-virus", `
    <p class="muted small">Run a deep scan on portfolio or a specific entity. Findings include severity, evidence, and recommended action.</p>
    <div class="flex-row" style="gap:10px;margin-bottom:10px">
      <select id="check-scope">
        <option value="portfolio">Portfolio (full)</option>
        <option value="entity">Current Entity</option>
        <option value="visible">Visible Object</option>
      </select>
      <select id="check-rules">
        <option>All rule families</option>
        <option>Identity / Identifier</option>
        <option>Address / Contact</option>
        <option>Registration / Temporal</option>
        <option>Model-Output Consistency</option>
        <option>Network / Cluster</option>
      </select>
      <button class="btn-primary" onclick="runCheckAgentConsole()"><i class="fa-solid fa-magnifying-glass"></i> Run Scan</button>
    </div>
    <div id="check-agent-console-out"><span class="muted small">Click <b>Run Scan</b> to see findings.</span></div>
  `, "copilot.check");

  const war = panel("Investigation Workspace (War Room)","fa-helmet-safety", `
    <div class="grid-2">
      <div>
        <h4>Profile</h4>
        <p class="muted small">${MOCK.entity_360.legal_name} · ${MOCK.entity_360.business_id}</p>
        <ul>
          <li>Confidence: <b>${MOCK.entity_360.confidence}</b> (${MOCK.entity_360.band})</li>
          <li>Decision: <b>${MOCK.entity_360.decision}</b></li>
          <li>Red flags: <b>${MOCK.entity_360.red_flags}</b></li>
        </ul>
        <h4>Key Evidence</h4>
        <ul>${MOCK.entity_360.red_flags.length ? MOCK.entity_360.red_flags.map?MOCK.entity_360.red_flags.map(r=>`<li>${r.title}</li>`).join(''):'' : ''}</ul>
      </div>
      <div>
        <h4>AI Explanation</h4>
        <div class="flag blue">
          The entity received a <b>Medium confidence score (0.63)</b> primarily because of two conflicting signals:
          (1) a partial UBO verification, and (2) an address discrepancy between USPS and SOS filings.
          Check-Agent flagged a shared-TIN pattern with an unrelated entity, raising cross-reference risk.
          Recommended action: request IRS confirmation of EIN and re-run UBO check.
        </div>
      </div>
    </div>
  `, "copilot.war_room");

  const glossary = panel("Glossary & Definitions","fa-book", `
    <table class="data-table">
      <thead><tr><th>Term</th><th>Definition</th></tr></thead>
      <tbody>${MOCK.glossary.map(g=>`<tr><td><b>${g.term}</b></td><td>${g.def}</td></tr>`).join('')}</tbody>
    </table>
  `, "copilot.glossary");

  return `
    <div class="page-header"><div><h1>AI Copilot & Check-Agent</h1><p>Natural language analysis, portfolio scans, and an investigation war room.</p></div></div>
    ${subTabs('t9',[
      {id:'s1', label:'Ask the AI',             html: ask},
      {id:'s2', label:'Check-Agent Console',     html: check},
      {id:'s3', label:'Investigation Workspace', html: war},
      {id:'s4', label:'Glossary & Definitions',  html: glossary},
    ])}
  `;
}

/* ============================================================
   PAGE REGISTRY (post-renders are defined in app.js after Chart is loaded)
============================================================ */
const PAGES = {
  '1': {render: renderTab1, postRender: () => window.postRenderTab1 && window.postRenderTab1()},
  '2': {render: renderTab2, postRender: () => window.postRenderTab2 && window.postRenderTab2()},
  '3': {render: renderTab3, postRender: () => window.postRenderTab3 && window.postRenderTab3()},
  '4': {render: renderTab4, postRender: () => window.postRenderTab4 && window.postRenderTab4()},
  '5': {render: renderTab5, postRender: () => window.postRenderTab5 && window.postRenderTab5()},
  '6': {render: renderTab6, postRender: () => window.postRenderTab6 && window.postRenderTab6()},
  '7': {render: renderTab7, postRender: () => renderFieldLineage(MOCK.features_catalog[0].name)},
  '8': {render: renderTab8, postRender: () => {}},
  '9': {render: renderTab9, postRender: () => {}},
};
