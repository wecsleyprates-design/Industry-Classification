/* ============================================================
   Main app logic: navigation, charts, modals, AI/Check-Agent mock
   ============================================================ */

const pageContainer = document.getElementById('page-container');
const tabBtns = document.querySelectorAll('.tabs .tab');
let currentTab = '1';
const chartInstances = {};

/* ---------------- TAB NAV ---------------- */
tabBtns.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

function switchTab(id) {
  currentTab = id;
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  const def = PAGES[id];
  if (!def) return;
  pageContainer.innerHTML = `<div class="page active" data-tab="${id}">${def.render()}</div>`;
  attachSubTabs();
  setTimeout(()=> def.postRender && def.postRender(), 0);
  updateDeepLinkUrl();
}

function attachSubTabs() {
  document.querySelectorAll('.sub-tabs').forEach(container => {
    const buttons = container.querySelectorAll('.sub-tab');
    const pages = container.parentElement.querySelectorAll(':scope > .sub-page');
    buttons.forEach(btn => btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.toggle('active', b === btn));
      pages.forEach(p => p.classList.toggle('active', p.dataset.sub === btn.dataset.sub));
      updateDeepLinkUrl();
    }));
  });
}

/* ---------------- FILTERS ---------------- */
function applyFilters() { flash('Filters applied across all tabs.'); updateDeepLinkUrl(); }
function resetFilters() {
  document.getElementById('flt-business').value='';
  flash('Filters reset.');
  updateDeepLinkUrl();
}

function flash(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = `position:fixed;bottom:20px;right:20px;background:#0b2545;color:#fff;
    border:1px solid #1E3A5F;padding:10px 16px;border-radius:8px;z-index:200;font-size:.85rem;box-shadow:0 8px 24px rgba(0,0,0,.5)`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1500);
}

/* ---------------- DEEP LINK ---------------- */
function updateDeepLinkUrl() {
  const activeSub = document.querySelector(`.page[data-tab="${currentTab}"] .sub-tab.active`);
  const sub = activeSub ? activeSub.dataset.sub : 's1';
  const url = new URL(location.href);
  url.searchParams.set('tab', currentTab);
  url.searchParams.set('sub', sub);
  url.searchParams.set('dr', document.getElementById('flt-date-range').value);
  url.searchParams.set('dc', document.getElementById('flt-date-ctx').value);
  url.searchParams.set('c',  document.getElementById('flt-customer').value);
  url.searchParams.set('b',  document.getElementById('flt-business').value || '');
  history.replaceState(null,'',url.toString());
  const box = document.getElementById('deeplink-url');
  if (box) box.value = url.toString();
}

function openDeepLinkModal() { updateDeepLinkUrl(); openModal('deeplink-modal'); }
function copyDeepLink() {
  const el = document.getElementById('deeplink-url');
  el.select(); document.execCommand('copy'); flash('Link copied.');
}
function openExportModal() { openModal('export-modal'); }

/* ---------------- MODALS ---------------- */
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function closeModalOnBackdrop(e,id){ if(e.target.id===id) closeModal(id); }

/* ---------------- LINEAGE (Trust Layer Level 1-4) ---------------- */
const LINEAGE_DB = {
  default: {
    l1: "Aggregated metric across the filtered population. Interpret relative to the confidence-band thresholds and the active date context.",
    l2: "Redshift: rds_warehouse_public.facts(name, value, received_at) JOIN rds_manual_score_public.business_scores ON business_id",
    l3: "AVG over filtered window, where name IN ('confidence_score') and received_at BETWEEN :start AND :end",
    l4: [
      {label:"integration-service/lib/facts/kyb/index.ts", url:"#"},
      {label:"ai-score-service/aiscore.py", url:"#"},
      {label:"warehouse-service/.../customer_table.sql", url:"#"},
    ]
  },
  "kpi.avg_confidence": {
    l1: "Mean of the latest confidence_score fact per business in the active filter window.",
    l2: "rds_warehouse_public.facts WHERE name='confidence_score'  ⟶  JSON_EXTRACT_PATH_TEXT(value,'value')",
    l3: "SELECT AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) FROM rds_warehouse_public.facts WHERE name='confidence_score' AND received_at BETWEEN :start AND :end",
    l4: [
      {label:"integration-service/lib/facts/kyb/index.ts", url:"#"},
      {label:"ai-score-service/worth_score_model.py", url:"#"},
      {label:"api-docs/openapi-specs/get-kyb.json", url:"#"},
    ]
  },
  "chart.psi": {
    l1: "Population Stability Index for the confidence score, comparing each week to a 90-day baseline. PSI > 0.25 indicates drift.",
    l2: "datascience.score_psi_weekly(score_name, week, psi)  (derived view)",
    l3: "For each week: sum over buckets of (pct_curr - pct_base) * ln(pct_curr / pct_base)",
    l4: [
      {label:"ai-score-service/stability.py (PSI calc)", url:"#"},
      {label:"warehouse-service/dbt/models/score_psi_weekly.sql", url:"#"},
    ]
  },
  "feature.naics_confidence": {
    l1: "Confidence of the NAICS classification produced by Pipeline B (ZoomInfo winner vs Equifax winner).",
    l2: "datascience.customer_files.primary_naics_code + *_match_confidence columns",
    l3: "CASE WHEN zi_match_confidence>efx_match_confidence THEN zi_match_confidence ELSE efx_match_confidence END",
    l4: [
      {label:"warehouse-service/datapooler/.../customer_table.sql", url:"#"},
      {label:"AI-Powered-NAICS-Industry-Classification-Agent/consensus_engine.py", url:"#"},
    ]
  },
};

function openLineage(objKey) {
  const data = LINEAGE_DB[objKey] || LINEAGE_DB.default;
  document.getElementById('lineage-title').textContent = objKey;
  document.getElementById('lineage-l1').textContent = data.l1;
  document.getElementById('lineage-l2').textContent = data.l2;
  document.getElementById('lineage-l3').textContent = data.l3;
  document.getElementById('lineage-l4').innerHTML = data.l4.map(l=>`<a class="code-link" href="${l.url}">${l.label}</a>`).join('');
  openModal('lineage-modal');
}

/* ---------------- ASK-AI ---------------- */
let _askAiContextKey = '';
function openAskAi(key) {
  _askAiContextKey = key;
  document.getElementById('ask-ai-context').textContent = key;
  document.getElementById('ask-ai-chat').innerHTML =
     `<div class="ask-ai-msg system">Context attached: object=${key}, tab=${currentTab}, filters=applied.</div>`;
  document.getElementById('ask-ai-q').value='';
  openModal('ask-ai-modal');
}
function presetAsk(q){ document.getElementById('ask-ai-q').value=q; sendAskAi(); }

function sendAskAi() {
  const q = document.getElementById('ask-ai-q').value.trim();
  if (!q) return;
  const chat = document.getElementById('ask-ai-chat');
  chat.innerHTML += `<div class="ask-ai-msg user">${escapeHtml(q)}</div>`;
  document.getElementById('ask-ai-q').value='';
  chat.innerHTML += `<div class="ask-ai-msg system">Thinking… (fake-key offline fallback)</div>`;
  chat.scrollTop = chat.scrollHeight;
  setTimeout(()=> {
    chat.lastElementChild.remove();
    const a = fakeAiAnswer(q, _askAiContextKey);
    chat.innerHTML += `<div class="ask-ai-msg ai">${a}</div>`;
    chat.scrollTop = chat.scrollHeight;
  }, 500);
}

function fakeAiAnswer(q, ctx) {
  const t = q.toLowerCase();
  if (t.includes('why')) {
    return `In this prototype (fake-key fallback), the deterministic explainer reports: the metric tied to <b>${ctx}</b> changed mainly due to shifts in <i>address_contact_overlap</i> and <i>ubo_verified</i> completeness over the active window. Attach a real OpenAI key to get a context-grounded explanation.`;
  }
  if (t.includes('lineage') || t.includes('source') || t.includes('where')) {
    return `See the Lineage modal for <b>${ctx}</b> — it covers the four levels (business meaning, warehouse source, transformation, and repo code).`;
  }
  if (t.includes('sql') || t.includes('query')) {
    return `<pre class="lineage-level" style="padding:8px 10px;background:#0f172a;border:1px solid #1e3a5f;border-radius:6px;">SELECT ... FROM rds_warehouse_public.facts
WHERE name='confidence_score'
  AND received_at BETWEEN :start AND :end
LIMIT 1000;</pre> This is a mock query — the real AI View Generator will synthesize executable Redshift SQL.`;
  }
  return `Offline fallback answer for "<i>${escapeHtml(q)}</i>" in context <b>${ctx}</b>. With a real OpenAI key, this would be a grounded, lineage-aware response powered by the RAG layer + live Redshift data.`;
}

/* ---------------- CHECK-AGENT ---------------- */
function openCheckAgent(key) {
  document.getElementById('check-agent-title').textContent = key;
  const findings = generateMockFindings(key);
  document.getElementById('check-agent-body').innerHTML = `
    <p class="muted small">Scanning <b>${key}</b> across 7 rule families (identity, identifier, address/contact, registration, model-output, temporal, network).</p>
    <div>${findings.map(f=>`
      <div class="check-finding ${f.severity}">
        <h5>${f.title} <span class="pill ${f.severity==='critical'?'red':f.severity==='high'?'red':f.severity==='medium'?'amber':'blue'}">${f.severity.toUpperCase()}</span></h5>
        <p>${f.desc}</p>
        <p class="muted small"><b>Action:</b> ${f.action}</p>
        <div class="evid">evidence: ${f.evidence}</div>
      </div>`).join('')}</div>
  `;
  openModal('check-agent-modal');
}

function generateMockFindings(ctx) {
  const base = [
    { severity:'critical', title:'Temporal: decision before scoring',
      desc:'4 cases have decision_at < scored_at (impossible sequence).',
      action:'Investigate pipeline replay / backdating.',
      evidence:'business_scores.created_at vs decisions.decision_at' },
    { severity:'high', title:'Network: 6 businesses share one address',
      desc:'Suspicious cluster around 123 Dock St, Trenton NJ with no shared UBO.',
      action:'Tag cluster for enhanced due diligence.',
      evidence:'facts.address (normalized)' },
    { severity:'medium', title:'Model-output: high conf + weak evidence',
      desc:'Cases scored ≥0.75 while ubo_verified is partial or null.',
      action:'Review escalation thresholds for UBO gaps.',
      evidence:'confidence_score vs facts.ubo_verified' },
    { severity:'low', title:'Registration: DE formation for domestic entity',
      desc:'Notice-level signal; tax-haven formation state (DE/NV/WY) present.',
      action:'Confirm operating state vs. formation state.',
      evidence:'facts.formation_state' },
  ];
  return base;
}

function runCheckAgentConsole() {
  const out = document.getElementById('check-agent-console-out');
  const scope = document.getElementById('check-scope').value;
  const rules = document.getElementById('check-rules').value;
  out.innerHTML = `<p class="muted small">Scanning ${scope} with <b>${rules}</b>…</p>`;
  setTimeout(()=> {
    const f = generateMockFindings('console.'+scope);
    out.innerHTML = f.map(x=>`
      <div class="check-finding ${x.severity}">
        <h5>${x.title} <span class="pill ${x.severity==='critical'||x.severity==='high'?'red':x.severity==='medium'?'amber':'blue'}">${x.severity.toUpperCase()}</span></h5>
        <p>${x.desc}</p>
        <p class="muted small"><b>Action:</b> ${x.action}</p>
        <div class="evid">evidence: ${x.evidence}</div>
      </div>`).join('');
  }, 600);
}

/* ---------------- AI VIEW GENERATOR ---------------- */
function presetAiView(q){ document.getElementById('ai-view-prompt').value=q; generateAiView(); }
function generateAiView() {
  const prompt = document.getElementById('ai-view-prompt').value.trim();
  const out = document.getElementById('ai-view-output');
  if (!prompt) { out.innerHTML = `<span class="muted small">Enter a prompt to generate a view.</span>`; return; }
  out.innerHTML = `<span class="muted small">Interpreting intent…</span>`;
  setTimeout(()=> {
    const sql = mockSqlForPrompt(prompt);
    out.innerHTML = `
      <div style="margin-bottom:8px"><b style="color:#93c5fd">Interpreted intent:</b>
        <span class="muted small"> Aggregate confidence metrics with segmentation and a time-window filter.</span></div>
      <pre>${escapeHtml(sql)}</pre>
      <div style="margin-top:10px"><b style="color:#86efac">Executed on mock Redshift</b> — 12 rows returned. Rendered as line chart below.</div>
      <div class="chart-wrap short" style="margin-top:8px"><canvas id="ch-ai-view"></canvas></div>
      <div class="muted small" style="margin-top:6px">Trust layer: result carries lineage to <code>rds_warehouse_public.facts</code> (primary source) and <code>aiscore.py</code> (model).</div>
    `;
    setTimeout(()=> renderAiViewChart(),0);
  }, 500);
}

function mockSqlForPrompt(p) {
  return `-- Prompt: ${p}
SELECT
  DATE_TRUNC('week', received_at)             AS week,
  CASE WHEN JSON_EXTRACT_PATH_TEXT(value,'entity_type')='domestic'
       THEN 'Domestic' ELSE 'Foreign' END      AS segment,
  AVG(CAST(JSON_EXTRACT_PATH_TEXT(value,'value') AS FLOAT)) AS avg_conf
FROM rds_warehouse_public.facts
WHERE name='confidence_score'
  AND received_at BETWEEN :start AND :end
GROUP BY 1, 2
ORDER BY 1
LIMIT 500;`;
}

function renderAiViewChart() {
  const ctx = document.getElementById('ch-ai-view'); if (!ctx) return;
  new Chart(ctx, {
    type:'line',
    data:{ labels: MOCK.confidence_trend.labels,
      datasets:[
        {label:'Domestic', data: MOCK.confidence_trend.domestic, borderColor:'#22c55e', tension:.3, pointRadius:2},
        {label:'Foreign',  data: MOCK.confidence_trend.foreign,  borderColor:'#f59e0b', tension:.3, pointRadius:2},
      ]},
    options: chartOptsLine(),
  });
}

/* ---------------- SQL / PYTHON RUNNERS (mock) ---------------- */
function runSqlMock() {
  const out = document.getElementById('sql-output');
  out.innerHTML = `<span class="muted small">Validating SQL (SELECT-only, LIMIT enforced)…</span>`;
  setTimeout(()=> {
    out.innerHTML = `
      <table class="data-table">
        <thead><tr><th>business_id</th><th>score</th></tr></thead>
        <tbody>
          <tr><td>bus_87f2…1234</td><td>0.63</td></tr>
          <tr><td>bus_b94a…6612</td><td>0.77</td></tr>
          <tr><td>bus_c1f9…aa01</td><td>0.28</td></tr>
          <tr><td>bus_d03e…7712</td><td>0.71</td></tr>
          <tr><td>bus_f221…8829</td><td>0.55</td></tr>
        </tbody>
      </table>
      <div class="muted small" style="margin-top:8px">Rows: 5 / LIMIT applied / ~42ms (mock).</div>`;
  }, 500);
}
function runPyMock() {
  const out = document.getElementById('py-output');
  out.innerHTML = `<span class="muted small">Sandboxed Python executing (pandas/numpy only)…</span>`;
  setTimeout(()=> {
    out.innerHTML = `<pre>     band   count    pct
0  VeryLow    862    3.5
1      Low   1940    7.8
2   Medium   4318   17.5
3     High   9201   37.2
4 VeryHigh   8395   34.0
</pre><div class="muted small">Execution: 61ms · memory: 14MB (mock).</div>`;
  }, 500);
}

/* ---------------- FIELD LINEAGE VIEW (Tab 7) ---------------- */
function renderFieldLineage(name) {
  const f = MOCK.features_catalog.find(x=>x.name===name) || MOCK.features_catalog[0];
  const el = document.getElementById('field-lineage-view'); if (!el) return;
  el.innerHTML = `
    <div class="grid-3">
      <div class="panel"><h3><i class="fa-solid fa-angles-up"></i> Upstream</h3>
        <ul>
          <li><b>${f.source}</b> (raw fact)</li>
          <li>Vendor source per integration (Middesk/Trulioo/etc.)</li>
        </ul>
      </div>
      <div class="panel"><h3><i class="fa-solid fa-circle-dot"></i> Feature</h3>
        <p><b>${f.name}</b> (${f.type})</p>
        <p class="muted small">Owner: ${f.owner} · Active: ${f.active}</p>
      </div>
      <div class="panel"><h3><i class="fa-solid fa-angles-down"></i> Downstream</h3>
        <ul>${f.downstream.split(',').map(d=>`<li>${d.trim()}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

function filterTables(q) {
  const t = q.toLowerCase();
  document.querySelectorAll('#tbl-catalog tbody tr').forEach(r=>{
    r.style.display = r.textContent.toLowerCase().includes(t)?'':'none';
  });
}

/* ---------------- RELATIONSHIP GRAPH ---------------- */
function renderRelGraph() {
  const host = document.getElementById('rel-graph'); if (!host) return;
  const W = host.clientWidth, H = 340;
  const nodes = MOCK.rel_graph_nodes;
  const links = MOCK.rel_graph_links;
  const nid = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const color = {
    'business-main':'#60A5FA',
    'business':'#334155',
    'identifier':'#f59e0b',
    'address':'#22c55e',
    'person':'#a855f7',
    'phone':'#06b6d4',
  };
  const svgns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgns,'svg');
  svg.setAttribute('viewBox',`0 0 ${Math.max(W,800)} ${H}`);
  svg.setAttribute('preserveAspectRatio','xMidYMid meet');

  // links
  links.forEach(l=>{
    const a=nid[l.s], b=nid[l.t]; if(!a||!b) return;
    const line = document.createElementNS(svgns,'line');
    line.setAttribute('x1',a.x); line.setAttribute('y1',a.y);
    line.setAttribute('x2',b.x); line.setAttribute('y2',b.y);
    line.setAttribute('class','rel-link'+(l.warn?' warn':''));
    svg.appendChild(line);
  });
  // nodes
  nodes.forEach(n=>{
    const g = document.createElementNS(svgns,'g');
    g.setAttribute('class','rel-node');
    g.setAttribute('transform',`translate(${n.x},${n.y})`);
    const c = document.createElementNS(svgns,'circle');
    c.setAttribute('r', n.type==='business-main'?18:12);
    c.setAttribute('fill', color[n.type]||'#334155');
    g.appendChild(c);
    const t = document.createElementNS(svgns,'text');
    t.setAttribute('text-anchor','middle');
    t.setAttribute('dy', (n.type==='business-main'?32:24));
    t.textContent = n.label;
    g.appendChild(t);
    svg.appendChild(g);
  });

  host.innerHTML=''; host.appendChild(svg);
}

/* ---------------- CHARTS helpers ---------------- */
function destroyChart(id){ if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } }

const gridColor = 'rgba(148,163,184,.12)';
const tickColor = '#94A3B8';

function chartOptsBase(){
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{labels:{color:tickColor}} },
    scales:{
      x:{ ticks:{color:tickColor}, grid:{color:gridColor} },
      y:{ ticks:{color:tickColor}, grid:{color:gridColor} }
    }
  };
}
function chartOptsLine(){ return chartOptsBase(); }
function chartOptsBar() { return chartOptsBase(); }

/* ---------------- POST-RENDER (per-tab charts) ---------------- */
function postRenderTab1() {
  // bands
  destroyChart('ch-bands');
  const b = MOCK.confidence_bands;
  const c1 = document.getElementById('ch-bands');
  if (c1) chartInstances['ch-bands'] = new Chart(c1, {
    type:'doughnut',
    data:{ labels: b.map(x=>x.band), datasets:[{data:b.map(x=>x.count), backgroundColor:b.map(x=>x.color), borderColor:'#0F172A'}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:tickColor}}} }
  });

  // decisions mix (stacked bar)
  destroyChart('ch-decisions');
  const d = MOCK.decisions;
  const c2 = document.getElementById('ch-decisions');
  if (c2) chartInstances['ch-decisions'] = new Chart(c2, {
    type:'bar',
    data:{ labels:d.bands, datasets:[
      {label:'Approved',  data:d.approved,  backgroundColor:'#22c55e'},
      {label:'Escalated', data:d.escalated, backgroundColor:'#f59e0b'},
      {label:'Declined',  data:d.declined,  backgroundColor:'#ef4444'},
    ]},
    options:{ ...chartOptsBar(), scales:{ x:{stacked:true, ticks:{color:tickColor}, grid:{color:gridColor}},
                                          y:{stacked:true, ticks:{color:tickColor}, grid:{color:gridColor}}} }
  });

  // trend
  destroyChart('ch-trend');
  const t = MOCK.confidence_trend;
  const c3 = document.getElementById('ch-trend');
  if (c3) chartInstances['ch-trend'] = new Chart(c3, {
    type:'line',
    data:{ labels:t.labels, datasets:[
      {label:'Average',  data:t.avg,      borderColor:'#60A5FA', tension:.3, pointRadius:2},
      {label:'Domestic', data:t.domestic, borderColor:'#22c55e', tension:.3, pointRadius:2},
      {label:'Foreign',  data:t.foreign,  borderColor:'#f59e0b', tension:.3, pointRadius:2},
    ]},
    options: chartOptsLine()
  });

  // volume
  destroyChart('ch-volume');
  const v = MOCK.volume_trend;
  const c4 = document.getElementById('ch-volume');
  if (c4) chartInstances['ch-volume'] = new Chart(c4, {
    type:'bar',
    data:{ labels:v.labels, datasets:[
      {label:'Scored',        data:v.scored,     backgroundColor:'#3B82F6', yAxisID:'y'},
      {label:'Manual Review', data:v.manual_rev, backgroundColor:'#f59e0b', type:'line', borderColor:'#f59e0b', yAxisID:'y1', tension:.3},
    ]},
    options: { ...chartOptsBar(),
      scales:{
        x:{ticks:{color:tickColor},grid:{color:gridColor}},
        y:{ticks:{color:tickColor},grid:{color:gridColor}},
        y1:{position:'right',ticks:{color:tickColor},grid:{display:false}}
      }
    }
  });
}

function postRenderTab2() {
  destroyChart('ch-conf-dist');
  const c1 = document.getElementById('ch-conf-dist');
  if (c1) chartInstances['ch-conf-dist'] = new Chart(c1, {
    type:'bar',
    data:{ labels:['0.0','0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9','1.0'],
      datasets:[{label:'Cases', data:[80,190,420,760,1250,2170,3680,5240,5910,3150,1866],
                backgroundColor:'#3B82F6'}]},
    options: chartOptsBar()
  });
  destroyChart('ch-psi');
  const c2 = document.getElementById('ch-psi');
  if (c2) chartInstances['ch-psi'] = new Chart(c2, {
    type:'line',
    data:{ labels: MOCK.psi_trend.labels,
           datasets:[{label:'PSI', data:MOCK.psi_trend.psi, borderColor:'#f59e0b',
                      backgroundColor:'rgba(245,158,11,.18)', fill:true, tension:.3, pointRadius:2}]},
    options: chartOptsLine()
  });
  destroyChart('ch-volume-2');
  const c3 = document.getElementById('ch-volume-2');
  if (c3) chartInstances['ch-volume-2'] = new Chart(c3, {
    type:'bar',
    data:{ labels:MOCK.volume_trend.labels, datasets:[
      {label:'Scored', data:MOCK.volume_trend.scored, backgroundColor:'#3B82F6'},
    ]},
    options: chartOptsBar()
  });
  destroyChart('ch-feat-imp');
  const c4 = document.getElementById('ch-feat-imp');
  if (c4) {
    const fi = MOCK.feature_importance.slice().sort((a,b)=>b.importance-a.importance);
    chartInstances['ch-feat-imp'] = new Chart(c4, {
      type:'bar',
      data:{ labels: fi.map(f=>f.feature),
             datasets:[{label:'Importance', data:fi.map(f=>f.importance), backgroundColor:'#8b5cf6'}]},
      options: { ...chartOptsBar(), indexAxis:'y' }
    });
  }
}

function postRenderTab3() {
  destroyChart('ch-feat-drift');
  const c = document.getElementById('ch-feat-drift');
  if (c) {
    const fi = MOCK.feature_importance.slice().sort((a,b)=>b.drift-a.drift).slice(0,8);
    chartInstances['ch-feat-drift'] = new Chart(c, {
      type:'bar',
      data:{ labels: fi.map(f=>f.feature),
             datasets:[{label:'PSI (drift)', data:fi.map(f=>f.drift), backgroundColor:'#f59e0b'}]},
      options:{ ...chartOptsBar(), indexAxis:'y' }
    });
  }
}

function postRenderTab4() {
  destroyChart('ch-decision-mix');
  const d = MOCK.decisions;
  const c = document.getElementById('ch-decision-mix');
  if (c) chartInstances['ch-decision-mix'] = new Chart(c,{
    type:'bar',
    data:{ labels:d.bands, datasets:[
      {label:'Approved',  data:d.approved,  backgroundColor:'#22c55e'},
      {label:'Escalated', data:d.escalated, backgroundColor:'#f59e0b'},
      {label:'Declined',  data:d.declined,  backgroundColor:'#ef4444'},
    ]},
    options:{ ...chartOptsBar(),
      scales:{ x:{stacked:true, ticks:{color:tickColor}, grid:{color:gridColor}},
               y:{stacked:true, ticks:{color:tickColor}, grid:{color:gridColor}}} }
  });
  destroyChart('ch-tat');
  const c2 = document.getElementById('ch-tat');
  if (c2) chartInstances['ch-tat'] = new Chart(c2,{
    type:'bar',
    data:{ labels: MOCK.tat_by_band.map(r=>r.band), datasets:[
      {label:'p50 (hrs)', data: MOCK.tat_by_band.map(r=>r.p50), backgroundColor:'#3B82F6'},
      {label:'p90 (hrs)', data: MOCK.tat_by_band.map(r=>r.p90), backgroundColor:'#a855f7'},
    ]},
    options: chartOptsBar()
  });
}

function postRenderTab5() { renderRelGraph(); }

function postRenderTab6() {
  destroyChart('ch-incon');
  const c = document.getElementById('ch-incon');
  const entries = Object.entries(MOCK.inconsistency_counts);
  if (c) chartInstances['ch-incon'] = new Chart(c,{
    type:'bar',
    data:{ labels: entries.map(e=>e[0]),
           datasets:[{label:'Cases', data: entries.map(e=>e[1]), backgroundColor:'#ef4444'}]},
    options: chartOptsBar()
  });
}

/* ---------------- UTIL ---------------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------------- INIT ---------------- */
(function init() {
  // Restore from deep-link
  const p = new URL(location.href).searchParams;
  const tab = p.get('tab'); if (tab && PAGES[tab]) currentTab = tab;
  if (p.get('dr')) document.getElementById('flt-date-range').value = p.get('dr');
  if (p.get('dc')) document.getElementById('flt-date-ctx').value = p.get('dc');
  if (p.get('c'))  document.getElementById('flt-customer').value = p.get('c');
  if (p.get('b'))  document.getElementById('flt-business').value = p.get('b');

  switchTab(currentTab);

  // Apply sub-tab if present
  const sub = p.get('sub');
  if (sub) {
    setTimeout(()=>{
      const btn = document.querySelector(`.page[data-tab="${currentTab}"] .sub-tab[data-sub="${sub}"]`);
      if (btn) btn.click();
    }, 50);
  }
})();
