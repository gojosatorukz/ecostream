(() => {
'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.round(n).toLocaleString('en-US');
const paths={grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',server:'<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',leaf:'<path d="M20 4c-8-2-15 1-15 8a6 6 0 0 0 10 4c3-3 3-7 5-12Z"/><path d="M4 21 14 11"/>',bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',cloud:'<path d="M20 16.2A4.5 4.5 0 0 0 18 8a6 6 0 0 0-11.4 1.7A4 4 0 0 0 7 18h11a4 4 0 0 0 2-1.8Z"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const icon=(name)=>`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.grid}</svg>`;
const nav=[['overview','Overview','grid'],['resources','Resources','server'],['recommendations','Recommendations','bolt'],['reports','Reports','file'],['connections','Cloud connections','cloud'],['alerts','Alert sandbox','bell']];
const { VERSION, providers, resources, windowRows, describe, comparison, recommendations } = EcoTelemetry;
const allProviders = ['All clouds', ...providers.map(cloud => cloud.name)];
const environments = ['All environments', 'Production', 'Staging', 'Development'];
let persisted = {};
try { persisted = JSON.parse(localStorage.getItem('ecostream-final-v1') || '{}') || {}; } catch {}
const state = {
  statuses: persisted.statuses || {},
  history: Array.isArray(persisted.history) ? persisted.history : [],
  receipts: Array.isArray(persisted.receipts) ? persisted.receipts : [],
  connected: persisted.connected !== false
};
let provider = 'All clouds', environment = 'All environments', days = 7;
let search = '', health = 'All statuses', page = 1, recTab = 'open', reportFormat = 'pdf', toastTimer;

function persist() {
  try { localStorage.setItem('ecostream-final-v1', JSON.stringify(state)); }
  catch { toast('Browser storage is unavailable. Changes will last for this session.'); }
}
const status = item => state.statuses[item.id] || item.defaultStatus;
const period = () => days === 7 ? '04–10 Nov 2026' : '28 Oct–03 Nov 2026';
const decimal = n => Number(n.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });
function scoped() {
  return resources.filter(row =>
    (row.provider !== 'AWS' || state.connected) &&
    (provider === 'All clouds' || provider === row.provider) &&
    (environment === 'All environments' || environment === row.environment))
    .map(row => describe(row, days !== 7));
}
function activeRecs() {
  const ids = new Set(scoped().map(row => row.id));
  return recommendations.filter(item => ids.has(item.resource.id) && status(item) !== 'dismissed');
}
function metrics() {
  const rows = scoped();
  const valid = rows.filter(row => row.emissions !== null);
  return { rows, valid, total: valid.reduce((sum, row) => sum + row.emissions, 0),
    coverage: rows.length ? (100 * valid.length / rows.length).toFixed(1) : '0.0',
    potential: activeRecs().reduce((sum, item) => sum + item.reduction, 0) };
}
function badge(text,type='neutral'){return `<span class="badge ${type}">${esc(text)}</span>`;}
function btn(text,action,extra='',primary=false){return `<button type="button" class="btn${primary?' primary':''}" data-action="${action}" ${extra}>${text}</button>`;}
function heading(title,sub,action=''){return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${action}</div>`;}
function stat(label,value,note){return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></div>`;}
function notice(text,warning=false){return `<div class="notice${warning?' warning':''}">${icon('info')}<span>${text}</span></div>`;}
function options(values, selected) {
  return values.map(value => `<option${value === selected ? ' selected' : ''}>${value}</option>`).join('');
}
function periodOptions() {
  return `<option value="7"${days===7?' selected':''}>04–10 Nov 2026</option><option value="0"${days===0?' selected':''}>28 Oct–03 Nov 2026</option>`;
}
function filters() {
  return `<div class="filters"><select class="filter" id="provider" aria-label="Cloud provider">${options(allProviders, provider)}</select><select class="filter" id="environment" aria-label="Environment">${options(environments, environment)}</select><select class="filter" id="period" aria-label="Reporting period">${periodOptions()}</select><span class="sync">Demo snapshot · 10 Nov 2026</span></div>`;
}
function chart(series, reference, unit, labels, names) {
  const width = 720, height = 220, left = 55, right = 20, top = 15, bottom = 35;
  const peak = Math.max(1, ...series, ...reference);
  const scale = unit === '%' ? Math.ceil(peak) : Math.ceil(peak / 1000) * 1000;
  const x = i => left + i * (width - left - right) / (series.length - 1);
  const y = value => top + (height - top - bottom) * (1 - value / scale);
  const points = values => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${names.join(' and ')}">
    ${[0, 1, 2, 3].map(i => {
      const value = scale * (1 - i / 3);
      return `<line class="grid" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text x="${left-10}" y="${y(value)+3}" text-anchor="end">${unit === '%' ? value.toFixed(1) + '%' : (value/1000).toFixed(1)+'k'}</text>`;
    }).join('')}
    <polygon class="area" points="${left},${y(0)} ${points(series)} ${x(series.length-1)},${y(0)}"/>
    <polyline class="baseline" fill="none" points="${points(reference)}"/>
    <polyline class="trend" fill="none" points="${points(series)}"/>
    ${labels.map((label, i) => `<text x="${x(i)}" y="${height-8}" text-anchor="middle">${label}</text>`).join('')}
    </svg><div class="chart-legend"><span class="current">● ${names[0]}</span><span>– – ${names[1]}</span></div>`;
}
const dayLabels = ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'];
function empty(title='No resources in this scope',text='Try a different filter or connect a cloud account.'){return `<div class="panel empty">${icon('cloud')}<h2>${title}</h2><p>${text}</p>${btn('Reset filters','reset-filters')}${btn('Cloud connections','go','data-route="connections"',true)}</div>`;}
function overview() {
  const m = metrics();
  const result = comparison(m.rows);
  const deltaLabel = result.delta === null ? 'Unavailable' :
    `${result.delta > 0 ? '+' : ''}${result.delta.toFixed(1)}%`;
  const coverageNote = `${m.valid.length} of ${m.rows.length} resources reporting`;
  return heading('Cloud impact overview', 'Compare estimated operational emissions across AWS, Azure and GCP.', btn('Export report','go','data-route="reports"',true))
    + filters()
    + `<div class="stats">${stat('Estimated emissions',fmt(m.total),'gCO₂eq · selected period')}
      ${stat('Telemetry coverage',m.coverage + '%',coverageNote)}
      ${stat('Matched resources',result.count,'Same IDs in both seven-day windows')}
      ${stat('Open opportunities',activeRecs().length,'Current window · advisory only')}</div>`
    + (m.rows.length ? `<div class="split"><section class="panel"><div class="panel-head"><h2>Matched-period emissions</h2>${badge('gCO₂eq / day')}</div>
      <p class="panel-subtitle">04–10 Nov vs. 28 Oct–03 Nov · ${result.count} reporting resources</p>
      ${result.count ? chart(result.current,result.baseline,'g',dayLabels,['Current window','Previous window']) : '<p class="small">No comparable readings are available.</p>'}</section>
      <section class="panel"><h2>Change in matched cohort</h2><div class="goal-value">${deltaLabel}</div>
      <p class="small">${fmt(result.currentTotal)} vs. ${fmt(result.baselineTotal)} gCO₂eq</p><div class="separator"></div>
      <p class="small">Comparison uses only resource IDs with complete data in both windows. The 25% reduction target per workload unit awaits a real 90-day pilot.</p>
      <div class="actions" style="margin-top:16px">${btn('View calculation method','method')}</div></section></div>
      <section class="panel"><div class="panel-head"><h2>Opportunities worth reviewing</h2>${btn('View all','go','data-route="recommendations"')}</div>${recommendationTable(activeRecs().slice(0,3),true)}</section>` : empty())
    + '<p class="footnote">Synthetic telemetry and regional factors. Estimates cover operational emissions only.</p>';
}
function resourceStatus(r){return badge(r.health,r.health==='Fresh'?'positive':'warning');}
function filteredResources(){return scoped().filter(r=>(!search||(r.name+' '+r.region+' '+r.service+' '+r.provider).toLowerCase().includes(search.toLowerCase()))&&(health==='All statuses'||r.health===health));}
function resourceTable(){const rows=filteredResources(),pages=Math.max(1,Math.ceil(rows.length/8));page=Math.min(page,pages);const shown=rows.slice((page-1)*8,page*8);if(!rows.length)return `<div class="empty"><h2>No matching resources</h2><p>Try another name, region or telemetry status.</p>${btn('Clear search','clear-search')}</div>`;return `<div class="table-wrap"><table><thead><tr><th>Resource</th><th>Service</th><th>Region</th><th>CPU avg.</th><th>Est. gCO₂eq</th><th>Telemetry</th><th>Action</th></tr></thead><tbody>${shown.map(r=>`<tr class="${r.id==='r0'?'highlight':''}"><td>${esc(r.name)}<span class="muted-line">${r.environment}</span></td><td>${r.service}<span class="muted-line">${r.provider}</span></td><td>${r.region}</td><td>${r.cpu===null?'—':r.cpu+'%'}</td><td>${r.emissions===null?'Unavailable':fmt(r.emissions)}</td><td>${resourceStatus(r)}</td><td>${btn('View details','resource',`data-id="${r.id}"`)}</td></tr>`).join('')}</tbody></table></div><div class="table-foot"><span class="small">Showing ${(page-1)*8+1}–${Math.min(page*8,rows.length)} of ${rows.length} resources</span><div class="pagination">${btn('←','page','data-direction="-1" '+(page===1?'disabled':''))}<span>${page} / ${pages}</span>${btn('→','page','data-direction="1" '+(page===pages?'disabled':''))}</div></div>`;}
function resourcePage(){const m=metrics();return heading('Cloud resources','Inspect telemetry, estimated emissions and collection health.',btn('Connect cloud','go','data-route="connections"',true))+filters()+`<div class="stats">${stat('Enrolled resources',m.rows.length,'Selected cloud and environment')}${stat('Reporting normally',m.valid.length,'Complete for the selected window')}${stat('Possible idle resources',activeRecs().length,'Candidates for engineering review')}${stat('Missing telemetry',m.rows.length-m.valid.length,'Excluded from idle detection')}</div>`+(m.rows.length-m.valid.length?notice(`${m.rows.length-m.valid.length} resources have incomplete telemetry. Missing measurements are marked unavailable and excluded from totals.`,true):'')+(m.rows.length?`<section class="panel"><div class="toolbar between"><h2>Resource inventory</h2><div class="actions"><label class="search">${icon('search')}<input id="resource-search" placeholder="Search resources or region" aria-label="Search resources" value="${esc(search)}"></label><select class="filter" id="health" aria-label="Telemetry status">${['All statuses','Fresh','Missing data'].map(h=>`<option${h===health?' selected':''}>${h}</option>`).join('')}</select>${btn('CSV','export-resources')}</div></div><div id="resources-result">${resourceTable()}</div></section>`:empty())+`<p class="footnote">CPU utilisation is provided by the synthetic fixture. Emissions depend on energy models, regional factors and the available data.</p>`;}
function recommendationTable(recs,compact=false){if(!recs.length)return `<div class="empty"><h2>No recommendations here</h2><p>Change your filters or choose a different review status.</p></div>`;return `<div class="table-wrap"><table><thead><tr><th>Resource / environment</th><th>Recommendation</th><th>Projected gCO₂eq / 28 days</th>${compact?'':'<th>Evidence</th>'}<th>Status</th><th></th></tr></thead><tbody>${recs.map(r=>`<tr class="${r.id==='rec0'?'highlight':''}"><td>${r.resource.name}<span class="muted-line">${r.resource.environment}</span></td><td>${r.type}</td><td>${fmt(r.reduction)}</td>${compact?'':`<td>${r.window} days · ${r.resource.cpu}% CPU · ${r.resource.memory}% memory</td>`}<td>${badge(status(r)==='review'?'In review':status(r)==='dismissed'?'Dismissed':'Open',status(r)==='open'?'positive':'neutral')}</td><td>${btn('Review →','review',`data-id="${r.id}"`)}</td></tr>`).join('')}</tbody></table></div>`;}
function recommendationPage(){const scope=new Set(scoped().map(r=>r.id)),all=recommendations.filter(r=>scope.has(r.resource.id)),active=all.filter(r=>status(r)!=='dismissed'),shown=all.filter(r=>recTab==='all'?status(r)!=='dismissed':status(r)===recTab);return heading('Recommendations','Turn resource evidence into actions your engineers can review.',btn('Alert sandbox','go','data-route="alerts"',true))+filters()+`<div class="stats">${stat('Active opportunities',active.length,'Current window · 04–10 Nov')}${stat('Potential reduction',fmt(active.reduce((s,r)=>s+r.reduction,0)),'gCO₂eq / 28 days · projected')}${stat('Ready for review',all.filter(r=>status(r)==='open').length,'Enough evidence available')}${stat('In review',all.filter(r=>status(r)==='review').length,'Marked for engineering review')}</div>`+notice('Recommendations are advisory. EcoStream does not automatically stop, resize or modify cloud resources.')+`<div class="tabs" aria-label="Recommendation status">${[['open','Open'],['review','In review'],['dismissed','Dismissed'],['all','All active']].map(([v,l])=>`<button class="tab ${recTab===v?'active':''}" data-action="rec-tab" data-tab="${v}" aria-pressed="${recTab===v}">${l} · ${v==='all'?active.length:all.filter(r=>status(r)===v).length}</button>`).join('')}</div><section class="panel">${recommendationTable(shown)}<p class="footnote" style="margin-top:16px">Missing or insufficient telemetry is excluded from recommendation rules.</p></section><section class="panel"><h2>Start with the evidence</h2><p class="panel-subtitle">Review the observation window, workload purpose and service owner before making a change. Estimated reductions are projections, not achieved savings.</p></section>`;}
function reviewPage(id) {
  const item = recommendations.find(row => row.id === id);
  if (!item) return empty('Recommendation not found','Choose a recommendation from the list.');
  const r = item.resource, s = status(item);
  const cpu = windowRows(r).map(row => row.cpu);
  return heading('Review recommendation', `${r.name} / ${r.provider} / ${r.environment}`, btn('Back to list','go','data-route="recommendations"'))
    + notice('Advisory workflow. Engineers validate operational impact before making changes.')
    + `<div class="split"><section class="panel stack"><div class="panel-head"><h2>${item.type}</h2>${badge(r.standby?'Standby workload':'Complete telemetry',r.standby?'warning':'positive')}</div>
      <p class="small">04–10 Nov 2026 · seven complete daily readings of CPU and memory</p>
      <div class="resource-meta"><div class="small">Average CPU<strong>${r.cpu}%</strong></div><div class="small">Average memory<strong>${r.memory}%</strong></div><div class="small">Data coverage<strong>100%</strong></div></div>
      <div class="separator"></div><h3>Daily CPU utilisation</h3>${chart(cpu, cpu.map(() => 5), '%', dayLabels, ['Fixture CPU', '5% CPU threshold'])}
      <h3>Detection rule</h3><p class="small">Seven complete days with average CPU below 5% and average memory below 20%. Missing telemetry suppresses the rule. Standby workloads are flagged for manual exception review.</p></section>
      <section class="panel stack">${badge(s==='review'?'In engineering review':s==='dismissed'?'Dismissed':'Open opportunity',s==='open'?'positive':'neutral')}
      <h2>Engineer decision</h2><p class="small">${r.standby?'Verify the standby requirement with the service owner before closing the candidate.':'Check the workload schedule, dependencies and owner before changing capacity.'}</p>
      ${r.standby?'':`<div class="potential">${fmt(item.reduction)}</div><p class="small">Projected gCO₂eq / 28 days if 35% of runtime is avoided. Teaching assumption.</p>`}
      ${s==='open'?btn('Mark for engineering review','set-status',`data-id="${id}" data-status="review"`,true):btn('Reopen recommendation','set-status',`data-id="${id}" data-status="open"`,true)}
      ${s!=='dismissed'?btn('Dismiss recommendation','dismiss',`data-id="${id}"`):''}
      <div class="separator"></div>${btn('View calculation inputs','resource',`data-id="${r.id}"`)}${btn('Open alert sandbox','go','data-route="alerts"')}</section></div>`;
}
function reportPreview(){const m=metrics();return `<section class="panel report-paper"><div class="panel-head"><span class="small">REPORT PREVIEW</span>${badge('Sample data')}</div><div class="brand">${icon('leaf')}EcoStream</div><h1 style="font-size:24px">Cloud emissions summary</h1><p class="subtitle">Demo workspace · ${period()} · ${esc(provider)} compute</p><div class="separator"></div><div class="report-values"><div class="small">Estimated gCO₂eq<strong>${fmt(m.total)}</strong></div><div class="small">Telemetry coverage<strong>${m.coverage}%</strong></div><div class="small">Enrolled resources<strong>${m.rows.length}</strong></div></div><h3>Method and sources</h3><p class="small">Daily allocated power × 24 hours yields estimated kWh. Multiplying by the synthetic region factor yields gCO₂eq. Factor set: ${VERSION}.</p><h3>Coverage and limitations</h3><p class="small">${m.valid.length} of ${m.rows.length} enrolled resources have valid telemetry. ${m.rows.length-m.valid.length} resources are excluded from the emissions total because of missing or stale data. Operational estimates for the academic simulation.</p><div class="separator"></div><p class="footnote">Generated by EcoStream · Demonstration report · Engineering review recommended</p></section>`;}
function reportPage(){return heading('Reports','Create traceable emissions evidence for your selected reporting period.')+`<div class="split report"><section class="panel stack"><h2 style="font-size:20px">Build a report</h2><div class="fields"><label class="field">Reporting period<select id="period">${periodOptions()}</select></label><label class="field">Cloud provider<select id="provider">${options(allProviders, provider)}</select></label><label class="field">Environment<select id="environment">${['All environments','Production','Staging','Development'].map(e=>`<option${e===environment?' selected':''}>${e}</option>`).join('')}</select></label></div><h3>Export format</h3><div class="actions">${['pdf','csv'].map(v=>`<label class="check-label"><input type="radio" name="format" value="${v}"${reportFormat===v?' checked':''}>${v.toUpperCase()}</label>`).join('')}</div><h3>Included in every export</h3><p class="small">✓ Selected period and resource scope<br>✓ Estimated emissions and data coverage<br>✓ Factor sources and model version<br>✓ Assumptions and known limitations</p>${btn(icon('download')+' Generate report','generate-report','',true)}<p class="footnote">A real sample file is generated in your browser.</p></section>${reportPreview()}</div><section class="panel"><div class="panel-head"><h2>Recent reports</h2>${badge(state.history.length+' generated')}</div><div class="table-wrap"><table><thead><tr><th>Report</th><th>Period / scope</th><th>Format</th><th>Status</th><th></th></tr></thead><tbody>${state.history.length?state.history.slice(0,5).map(r=>`<tr><td>Cloud emissions summary</td><td>${esc(r.period)}<span class="muted-line">${esc(r.provider)} · ${esc(r.environment)}</span></td><td>${esc(r.format.toUpperCase())}</td><td>${badge('Ready','positive')}</td><td>${btn('Download again','history-download',`data-id="${esc(r.id)}"`)}</td></tr>`).join(''):'<tr><td colspan="5" class="small">Generate your first sample report above. PDF and CSV exports work offline.</td></tr>'}</tbody></table></div></section>`;}
function connectionPage() {
  return heading('Cloud connections','Explore a common resource model across three provider fixtures.')
    + notice('The AWS read-only connection is simulated. Azure and GCP use preloaded fixtures. Cloud credentials are unnecessary.')
    + `<div class="provider-grid">${providers.map(cloud => {
      const aws = cloud.name === 'AWS';
      const loaded = !aws || state.connected;
      return `<section class="panel provider"><div class="provider-logo ${cloud.name.toLowerCase()}">${cloud.name}</div>
        <h2>${cloud.name==='AWS'?'Amazon Web Services':cloud.name==='Azure'?'Microsoft Azure':'Google Cloud'}</h2>
        <div>${badge(loaded?'Fixture loaded':'Fixture disconnected',loaded?'positive':'neutral')}</div>
        <p>${cloud.service} · ${cloud.region}<br>${loaded?'10 enrolled demo resources':'No AWS resources in scope'}<br>Factor: ${cloud.factor} gCO₂eq/kWh</p>
        ${loaded ? btn('View resources','provider-resources',`data-provider="${cloud.name}"`,true) : btn('Validate read-only fixture','connect-demo','',true)}
        ${aws && loaded ? btn('Disconnect AWS fixture','disconnect') : ''}</section>`;
    }).join('')}</div>`;
}
function alertsPage() {
  return heading('Alert sandbox','Record a simulated notification and inspect its delivery receipt.')
    + notice('This browser acts as the sandbox sink. No Slack or email messages are sent.')
    + `<div class="split alerts"><section class="panel stack"><h2>Test notification</h2>
      <p class="small">The sample alert uses app-staging-03. Its seven-day CPU average is 1.2%, memory average is 12%, and all seven readings are available.</p>
      <div class="actions">${btn('Send to Slack sandbox','test-alert','data-channel="Slack"',true)}${btn('Send to email sandbox','test-alert','data-channel="Email"')}</div>
      ${btn('Review recommendation','review','data-id="rec-r0"')}</section>
      <section class="panel stack"><h2>Sandbox receipts</h2>
      ${state.receipts.length ? state.receipts.map(receipt => `<div class="message-preview"><div>${badge('Received locally','positive')} <strong>${esc(receipt.channel)}</strong></div><p class="small">${esc(receipt.id)} · ${esc(receipt.time)}</p></div>`).join('') : '<p class="small">Send a test notification to record a receipt here.</p>'}</section></div>`;
}
function render(){const route=location.hash.slice(1)||'overview',isReview=route.startsWith('review/'),active=isReview?'recommendations':route;$('#breadcrumb').textContent='Workspace / '+(nav.find(n=>n[0]===active)?.[1]||'Overview');$('#sidebar').innerHTML=`<a class="brand" href="#overview">${icon('leaf')}EcoStream</a><div class="workspace"><div class="eyebrow">ECOSTREAM WORKSPACE</div><p>Cloud sustainability</p></div><div class="eyebrow nav-label">Workspace</div><nav class="nav">${nav.map(([id,label,i])=>`<a href="#${id}" class="${active===id?'active':''}"${active===id?' aria-current="page"':''}>${icon(i)}${label}</a>`).join('')}</nav><div class="sidebar-bottom"><div class="scope-note"><strong>Simulation release</strong>AWS · Azure · GCP<br>30-resource fixture</div><div class="user"><span class="avatar">ES</span><div><strong>EcoStream Demo</strong><small>Browser workspace</small></div></div><button class="reset" data-action="reset-demo">Reset demo data</button></div>`;const views={overview,resources:resourcePage,recommendations:recommendationPage,reports:reportPage,connections:connectionPage,alerts:alertsPage};$('#main').innerHTML=isReview?reviewPage(route.split('/')[1]):(Object.hasOwn(views,route)?views[route]:overview)();document.title=`${nav.find(n=>n[0]===active)?.[1]||'EcoStream'} · EcoStream Demo`;}
function go(route){if($('#dialog').open)$('#dialog').close();$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');if(location.hash==='#'+route)render();else location.hash=route;}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
function modal(title,html){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function snapshot(){const m=metrics();return{id:'report-'+Date.now(),period:period(),provider,environment,days,format:reportFormat,total:m.total,coverage:m.coverage,resourceCount:m.rows.length,validCount:m.valid.length,rows:m.rows.map(({days, ...row})=>row)};}
function csv(report){const lines=[['EcoStream demonstration report'],['Reporting period',report.period],['Provider',report.provider],['Environment',report.environment],['Estimated total gCO2eq',Number(report.total.toFixed(6))],['Telemetry coverage percent',report.coverage],['Method','Allocated kW x 24 h per day x regional factor; '+VERSION],['Limitations','Sample data; modelled emissions; missing telemetry excluded; not audited ESG compliance'],[],['Resource','Provider','Environment','Region','Service','CPU percent','Memory percent','Estimated kWh','Factor gCO2eq/kWh','Estimated gCO2eq','Telemetry status'],...report.rows.map(r=>[r.name,r.provider,r.environment,r.region,r.service,r.cpu??'Unavailable',r.memory??'Unavailable',r.kwh??'Unavailable',r.factor,r.emissions===null?'Unavailable':r.emissions,r.health])];return '\ufeff'+lines.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
function pdf(report){const safe=s=>String(s).normalize('NFKD').replace(/[^\x20-\x7e]/g,'-').replace(/[\\()]/g,'\\$&');const lines=[['EcoStream',26],['CLOUD EMISSIONS SUMMARY',17],['Demonstration report - sample data',11],['',12],['Reporting period: '+report.period,12],['Provider: '+report.provider+'    Environment: '+report.environment,12],['Estimated total: '+fmt(report.total)+' gCO2eq',16],['Telemetry coverage: '+report.coverage+'%',12],['Enrolled resources: '+report.resourceCount+'    Valid telemetry: '+report.validCount,12],['',12],['METHOD AND SOURCES',13],['Daily allocated power multiplied by 24 hours gives estimated energy.',11],['Energy is multiplied by the synthetic regional factor (gCO2eq/kWh).',11],['Factor set: '+VERSION+'.',11],['Factor source: illustrative regional factor set; demonstration only.',11],['',12],['COVERAGE AND LIMITATIONS',13],[`${report.resourceCount-report.validCount} resource(s) with missing or stale data are excluded.`,11],['These are modelled estimates, not directly measured emissions.',11],['The report does not claim audited ESG compliance.',11],['',12],['RESOURCE SAMPLE',13],...report.rows.slice(0,8).map(r=>[`${r.name.padEnd(24)}  ${r.emissions===null?'Unavailable':fmt(r.emissions)+' gCO2eq'}`,10]),['',12],['Download the CSV export for the complete resource inventory.',10]];let y=785,content='';for(const [text,size]of lines){content+=`BT /F1 ${size} Tf 0.08 0.2 0.14 rg 1 0 0 1 45 ${y} Tm (${safe(text)}) Tj ET\n`;y-=size+10;}const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${content.length} >>\nstream\n${content}endstream`];let out='%PDF-1.4\n',offsets=[0];objs.forEach((o,i)=>{offsets.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`;});const start=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return out;}
function download(report,format){const blob=new Blob([format==='pdf'?pdf(report):csv(report)],{type:format==='pdf'?'application/pdf':'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`EcoStream_${report.days===7?'04-10_Nov':'28_Oct-03_Nov'}_2026.${format}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast(format.toUpperCase()+' report downloaded.');}
function showMethod() {
  modal('How emissions are estimated', `<p>Daily allocated power (kW) × 24 hours × the region's teaching factor (gCO₂eq/kWh).</p>
    <p><strong>Example:</strong> app-staging-03 uses 0.04 kW × 24 h = 0.96 kWh. At 400 gCO₂eq/kWh, this gives 384 gCO₂eq for one day.</p>
    <p class="small">Synthetic factor set ${VERSION}. The model covers operational emissions and excludes embodied carbon.</p>`);
}
function showResource(id) {
  const raw = resources.find(row => row.id === id);
  if (!raw) return;
  const r = describe(raw, days !== 7);
  const reading = windowRows(raw, days !== 7)[0];
  modal(r.name, `<dl class="detail-list">
    <dt>Provider / region</dt><dd>${r.provider} · ${r.region}</dd><dt>Environment</dt><dd>${r.environment}</dd>
    <dt>CPU / memory avg.</dt><dd>${r.cpu === null ? 'Unavailable' : r.cpu+'% / '+r.memory+'%'}</dd>
    <dt>Reporting period</dt><dd>${period()}</dd><dt>Telemetry</dt><dd>${resourceStatus(r)}</dd>
    <dt>Window total</dt><dd>${r.emissions === null ? 'Unavailable' : decimal(r.kwh)+' kWh · '+fmt(r.emissions)+' gCO₂eq'}</dd>
    <dt>Factor</dt><dd>${r.factor} gCO₂eq/kWh · ${VERSION}</dd></dl>
    ${reading ? notice(`First day: ${reading.allocatedKw} kW × 24 h = ${reading.kwh} kWh. ${reading.kwh} × ${r.factor} = ${decimal(reading.emissions)} gCO₂eq.`) :
    notice('This resource is excluded from the estimate and idle detection because readings are unavailable.',true)}
    <div class="actions">${btn('Close','close-dialog')}</div>`);
}
const actions = {
  go: button => go(button.dataset.route),
  review: button => go('review/' + button.dataset.id),
  method: showMethod,
  help: () => modal('About this demonstration', `<p>EcoStream models a six-sprint academic release using 30 synthetic resources across AWS, Azure and GCP.</p>
    <p>Compare matched windows, inspect calculation inputs, review advisory candidates, record a local notification receipt and export a filtered report.</p>
    ${notice('Synthetic data, illustrative factors and browser-local state. The 90-day pilot remains a future validation step.')}`),
  'close-dialog': () => $('#dialog').close(),
  'reset-filters': () => { provider='All clouds'; environment='All environments'; days=7; page=1; render(); },
  'clear-search': () => { search=''; health='All statuses'; page=1; render(); },
  page: button => { page+=Number(button.dataset.direction); $('#resources-result').innerHTML=resourceTable(); },
  'rec-tab': button => { recTab=button.dataset.tab; render(); },
  'set-status': button => {
    const { id, status } = button.dataset;
    state.statuses[id]=status;
    persist();
    render();
    toast(status==='review'?'Added to engineering review.':'Recommendation reopened.');
  },
  dismiss: button => modal('Dismiss recommendation', `<p>Dismiss this candidate from active review? You can reopen it from the Dismissed tab.</p>
    <div class="actions">${btn('Dismiss','confirm-dismiss',`data-id="${esc(button.dataset.id)}"`,true)}${btn('Cancel','close-dialog')}</div>`),
  'confirm-dismiss': button => {
    state.statuses[button.dataset.id]='dismissed';
    persist();
    $('#dialog').close();
    render();
    toast('Recommendation dismissed.');
  },
  resource: button => showResource(button.dataset.id),
  'generate-report': () => {
    const report=snapshot();
    if (!report.resourceCount) { toast('Select a scope with enrolled resources first.'); return; }
    state.history=[report, ...state.history].slice(0,5);
    persist();
    download(report, reportFormat);
    render();
    modal('Your sample report is ready', `<p>${esc(report.period)} · ${esc(report.provider)} · ${esc(report.environment)}</p>
      <p><strong>${fmt(report.total)} gCO₂eq</strong> · ${report.coverage}% coverage</p>
      <div class="actions">${btn('Download PDF','history-download',`data-id="${report.id}" data-format="pdf"`,true)}
      ${btn('Download CSV','history-download',`data-id="${report.id}" data-format="csv"`)}</div>`);
  },
  'history-download': button => {
    const report=state.history.find(item => item.id===button.dataset.id);
    if (report) download(report,button.dataset.format||report.format);
  },
  'export-resources': () => {
    const report=snapshot();
    const ids=new Set(filteredResources().map(row=>row.id));
    report.rows=report.rows.filter(row=>ids.has(row.id));
    if (!report.rows.length) { toast('No matching rows to export.'); return; }
    report.total=report.rows.reduce((sum,row)=>sum+(row.emissions??0),0);
    report.resourceCount=report.rows.length;
    report.validCount=report.rows.filter(row=>row.emissions!==null).length;
    report.coverage=(100*report.validCount/report.resourceCount).toFixed(1);
    download(report,'csv');
  },
  'provider-resources': button => { provider=button.dataset.provider; environment='All environments'; page=1; search=''; health='All statuses'; go('resources'); },
  'connect-demo': () => { state.connected=true; persist(); render(); toast('Read-only AWS fixture validated.'); },
  disconnect: () => modal('Disconnect the AWS fixture?', `<p>AWS sample rows are hidden until you validate the fixture again.</p>
    <div class="actions">${btn('Disconnect','confirm-disconnect','',true)}${btn('Cancel','close-dialog')}</div>`),
  'confirm-disconnect': () => { state.connected=false; persist(); $('#dialog').close(); render(); toast('AWS fixture disconnected.'); },
  'test-alert': button => {
    const time = new Date();
    state.receipts = [{ id: 'ES-' + time.getTime().toString(36).toUpperCase(), time: time.toISOString(), channel: button.dataset.channel }, ...state.receipts].slice(0,5);
    persist();
    render();
    toast('Test notification received by the local sandbox.');
  },
  'reset-demo': () => modal('Reset the demonstration?', `<p>Clear browser-local reviews, report history and alert receipts, and restore the AWS fixture.</p>
    <div class="actions">${btn('Reset demo','confirm-reset','',true)}${btn('Cancel','close-dialog')}</div>`),
  'confirm-reset': () => {
    state.statuses={}; state.history=[]; state.receipts=[]; state.connected=true;
    provider='All clouds'; environment='All environments'; days=7; search=''; health='All statuses'; recTab='open'; page=1;
    persist();
    $('#dialog').close();
    go('overview');
    toast('Demo restored.');
  }
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){const fn=actions[b.dataset.action];if(fn)fn(b);}if(e.target.closest('.nav a,.brand')){$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
document.addEventListener('change',e=>{if(e.target.id==='provider'){provider=e.target.value;page=1;render();}else if(e.target.id==='environment'){environment=e.target.value;page=1;render();}else if(e.target.id==='period'){days=Number(e.target.value);page=1;render();}else if(e.target.id==='health'){health=e.target.value;page=1;$('#resources-result').innerHTML=resourceTable();}else if(e.target.name==='format')reportFormat=e.target.value;});
document.addEventListener('input',e=>{if(e.target.id==='resource-search'){search=e.target.value;page=1;$('#resources-result').innerHTML=resourceTable();}});

$('#menu-toggle').addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));});
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);$('#main').focus({preventScroll:true});});
render();
})();
