/**
 * Generate documentation from the service catalog (docs/catalog.js):
 *   - docs/services/<name>.md   per-service reference
 *   - docs/services/README.md   index grouped by category
 *   - docs/site/index.html      self-contained, searchable web docs
 *   - docs/site/catalog.json    machine-readable catalog (for tooling)
 *
 * Run: node scripts/gen-docs.mjs   (or: make docs)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const { conductor, managers, CATEGORIES, STATUS_LABEL } = require('../docs/catalog.js');

const servicesDir = path.join(repoRoot, 'docs', 'services');
const siteDir = path.join(repoRoot, 'docs', 'site');
fs.mkdirSync(servicesDir, { recursive: true });
fs.mkdirSync(siteDir, { recursive: true });

const all = [conductor, ...managers];

const badge = (s) => STATUS_LABEL[s] || s;
const proxyPath = (svc) =>
  svc.name === 'conductor' ? '' : `/api/services/${svc.name}`;

// --- per-service markdown ---------------------------------------------------
function exampleFor(svc) {
  if (svc.name === 'conductor') {
    return {
      curl: `# login -> JWT\ncurl -s -X POST $CONDUCTOR/api/auth/login \\\n  -H 'Content-Type: application/json' \\\n  -d '{"username":"admin","password":"admin"}'`,
      sdk: `const { AerekosClient } = require('aerekos-sdk');\nconst client = new AerekosClient({ baseUrl: process.env.CONDUCTOR });\nawait client.auth.login('admin', 'admin');\nconsole.log(await client.services.list());`,
      cli: `aerekos login --url $CONDUCTOR -u admin -p admin\naerekos services`
    };
  }
  const seg = svc.crud ? svc.crud.segment : (svc.endpoints[0] ? svc.endpoints[0].path.split('/').filter(Boolean).pop() : 'info');
  const post = svc.endpoints.find((e) => e.method === 'POST');
  const base = `${svc.proxyBase}/${svc.crud ? svc.crud.segment : ''}`.replace(/\/$/, '');
  const curlPath = post ? post.path : svc.endpoints[0].path;
  return {
    curl: `# through the conductor proxy (JWT)\ncurl -s -X ${post ? 'POST' : 'GET'} \\\n  "$CONDUCTOR/api/services/${svc.name}${curlPath}?project_id=$PID" \\\n  -H "Authorization: Bearer $TOKEN"${post ? ` \\\n  -H 'Content-Type: application/json' \\\n  -d '{"project_id":"'$PID'","name":"demo"}'` : ''}`,
    sdk: svc.crud
      ? `const r = client.resource('${svc.name}', '${svc.crud.segment}');\nawait r.create(PID, { name: 'demo' });\nconsole.log(await r.list(PID));`
      : `// generic proxy\nawait client.proxy('${svc.name}', { method: '${post ? 'POST' : 'GET'}', path: '${curlPath}', projectId: PID${post ? `, body: { name: 'demo' }` : ''} });`,
    cli: svc.crud
      ? `aerekos ${svc.name} ${svc.crud.segment} create --project $PID --data '{"name":"demo"}'\naerekos ${svc.name} ${svc.crud.segment} list --project $PID`
      : `aerekos call ${svc.name} ${post ? 'POST' : 'GET'} "${curlPath}" --project $PID${post ? ` --data '{"name":"demo"}'` : ''}`
  };
}

function serviceMarkdown(svc) {
  const ex = exampleFor(svc);
  const lines = [];
  lines.push(`# ${svc.name}${svc.aws ? ` — ${svc.aws}` : ''}`);
  lines.push('');
  lines.push(`> **${svc.category}** · ${badge(svc.status)}`);
  lines.push('');
  lines.push(svc.summary);
  lines.push('');
  lines.push(`- **Port:** \`${svc.port}\``);
  if (svc.aws) lines.push(`- **AWS analog:** ${svc.aws}`);
  lines.push(`- **Proxy base:** \`${svc.proxyBase}\``);
  if (svc.name !== 'conductor') {
    lines.push(`- **Access:** \`{VERB} {CONDUCTOR}${proxyPath(svc)}{path}\` (JWT or service token)`);
  }
  if (svc.capabilities) lines.push(`- **Capabilities:** ${svc.capabilities.map((c) => `\`${c}\``).join(', ')}`);
  if (svc.needsKeys) {
    lines.push('');
    lines.push(`> ⚠️ **Provider activation:** ${svc.needsKeys}`);
  }
  lines.push('');
  lines.push('## Endpoints');
  lines.push('');
  lines.push('| Method | Path | Description |');
  lines.push('|--------|------|-------------|');
  for (const e of svc.endpoints) {
    lines.push(`| \`${e.method}\` | \`${e.path}\` | ${e.summary} |`);
  }
  lines.push('');
  if (svc.env && svc.env.length) {
    lines.push('## Environment');
    lines.push('');
    lines.push('| Variable | Default | Description |');
    lines.push('|----------|---------|-------------|');
    for (const v of svc.env) lines.push(`| \`${v.name}\` | \`${v.default}\` | ${v.desc} |`);
    lines.push('');
  }
  lines.push('## Examples');
  lines.push('');
  lines.push('**curl**');
  lines.push('');
  lines.push('```bash');
  lines.push(ex.curl);
  lines.push('```');
  lines.push('');
  lines.push('**SDK (Node)**');
  lines.push('');
  lines.push('```js');
  lines.push(ex.sdk);
  lines.push('```');
  lines.push('');
  lines.push('**CLI**');
  lines.push('');
  lines.push('```bash');
  lines.push(ex.cli);
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`_Generated from \`docs/catalog.js\`. Edit the catalog and run \`make docs\` to update._`);
  lines.push('');
  return lines.join('\n');
}

for (const svc of all) {
  fs.writeFileSync(path.join(servicesDir, `${svc.name}.md`), serviceMarkdown(svc));
}

// --- index ------------------------------------------------------------------
function indexMarkdown() {
  const out = [];
  out.push('# aerekos-cloud — service reference');
  out.push('');
  out.push(`Your self-hosted "private AWS": a conductor control plane + **${managers.length} manager services**.`);
  out.push('All managers are reached through the conductor proxy: `{VERB} {CONDUCTOR}/api/services/{name}{path}`.');
  out.push('');
  out.push('See the [web docs](../site/index.html) for a searchable browser. This index and every');
  out.push('per-service page are generated from [`docs/catalog.js`](../catalog.js) via `make docs`.');
  out.push('');
  out.push(`## [Conductor](conductor.md) — control plane (port ${conductor.port})`);
  out.push('');
  for (const cat of CATEGORIES) {
    if (cat === 'Control plane') continue;
    const inCat = managers.filter((m) => m.category === cat);
    if (!inCat.length) continue;
    out.push(`## ${cat}`);
    out.push('');
    out.push('| Service | AWS analog | Port | Status | Summary |');
    out.push('|---------|-----------|------|--------|---------|');
    for (const m of inCat) {
      out.push(`| [\`${m.name}\`](${m.name}.md) | ${m.aws} | ${m.port} | ${m.status} | ${m.summary.split('.')[0]}. |`);
    }
    out.push('');
  }
  return out.join('\n');
}
fs.writeFileSync(path.join(servicesDir, 'README.md'), indexMarkdown());

// --- machine-readable catalog ----------------------------------------------
fs.writeFileSync(
  path.join(siteDir, 'catalog.json'),
  JSON.stringify({ conductor, managers, categories: CATEGORIES }, null, 2)
);

// --- web docs site (self-contained) ----------------------------------------
const siteData = JSON.stringify({ conductor, managers, categories: CATEGORIES });
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>aerekos-cloud — docs</title>
<style>
  :root{--bg:#0b0f16;--panel:#121826;--panel2:#0f1420;--line:#1f2937;--fg:#e5e9f0;--muted:#8b97a8;--accent:#5b9dff;--green:#34d399;--amber:#fbbf24;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
  a{color:var(--accent);text-decoration:none}
  .wrap{display:grid;grid-template-columns:300px 1fr;min-height:100vh}
  aside{border-right:1px solid var(--line);background:var(--panel2);padding:18px 14px;position:sticky;top:0;height:100vh;overflow:auto}
  .brand{font-weight:700;font-size:18px;margin:0 6px 4px}
  .brand small{display:block;color:var(--muted);font-weight:400;font-size:12px;margin-top:2px}
  input[type=search]{width:100%;margin:12px 0;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--fg)}
  .cat{color:var(--muted);text-transform:uppercase;font-size:11px;letter-spacing:.08em;margin:14px 6px 6px}
  .navitem{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-radius:7px;cursor:pointer;color:var(--fg)}
  .navitem:hover{background:var(--panel)}
  .navitem.active{background:#18233a}
  .navitem .aws{color:var(--muted);font-size:11px}
  main{padding:34px 44px;max-width:980px}
  h1{margin:0 0 4px;font-size:30px}
  .sub{color:var(--muted);margin-bottom:18px}
  .pills{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 18px}
  .pill{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted)}
  .pill.ok{color:var(--green);border-color:#14532d}
  .pill.keys{color:var(--amber);border-color:#78350f}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:16px 0}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  code,.mono{font-family:var(--mono);font-size:13px}
  td code{background:var(--panel2);padding:1px 6px;border-radius:5px}
  .method{font-weight:700}
  .GET{color:var(--green)}.POST{color:var(--accent)}.PATCH{color:#c084fc}.PUT{color:#c084fc}.DELETE{color:#f87171}
  pre{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;font-family:var(--mono);font-size:13px}
  .warn{background:#1f1603;border:1px solid #78350f;color:#fbbf24;padding:10px 14px;border-radius:10px;margin:14px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:18px}
  .tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;cursor:pointer}
  .tile:hover{border-color:var(--accent)}
  .tile b{display:block}.tile .aws{color:var(--muted);font-size:12px}
  .foot{color:var(--muted);font-size:12px;margin-top:30px;border-top:1px solid var(--line);padding-top:14px}
  h3{margin:20px 0 8px}
</style>
</head>
<body>
<div class="wrap">
  <aside>
    <div class="brand">aerekos-cloud<small>your private AWS — docs</small></div>
    <input id="q" type="search" placeholder="Search services, AWS analogs…" />
    <div id="nav"></div>
  </aside>
  <main id="main"></main>
</div>
<script id="data" type="application/json">${siteData}</script>
<script>
const DATA = JSON.parse(document.getElementById('data').textContent);
const ALL = [DATA.conductor, ...DATA.managers];
const byName = Object.fromEntries(ALL.map(s => [s.name, s]));
const statusPill = s => s==='implemented'
  ? '<span class="pill ok">Implemented</span>'
  : '<span class="pill keys">Needs provider keys</span>';
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

function renderNav(filter){
  const f=(filter||'').toLowerCase();
  const nav=document.getElementById('nav'); nav.innerHTML='';
  const home=document.createElement('div');
  home.className='navitem'; home.innerHTML='<span>🏠 Overview</span>';
  home.onclick=()=>{location.hash='';renderHome();};
  nav.appendChild(home);
  for(const cat of DATA.categories){
    const items=ALL.filter(s=>s.category===cat && (
      !f || s.name.toLowerCase().includes(f) || (s.aws||'').toLowerCase().includes(f) || (s.summary||'').toLowerCase().includes(f)
    ));
    if(!items.length) continue;
    const h=document.createElement('div'); h.className='cat'; h.textContent=cat; nav.appendChild(h);
    for(const s of items){
      const d=document.createElement('div'); d.className='navitem'+(location.hash==='#'+s.name?' active':'');
      d.innerHTML='<span>'+s.name+'</span><span class="aws">'+(s.aws||'')+'</span>';
      d.onclick=()=>{location.hash=s.name;};
      nav.appendChild(d);
    }
  }
}
function renderHome(){
  const m=document.getElementById('main');
  let h='<h1>aerekos-cloud</h1><div class="sub">A self-hosted "private AWS": one conductor control plane + '+DATA.managers.length+' manager services. Every manager is reached through the conductor proxy: <code>{VERB} {CONDUCTOR}/api/services/{name}{path}</code>.</div>';
  h+='<div class="card"><b>Getting started</b><pre>npm i -g aerekos-sdk   # provides the \`aerekos\` CLI\naerekos login --url http://localhost:3000 -u admin -p admin\naerekos services            # list everything\naerekos git_manager repos create --project demo --data \\'{"name":"hello"}\\'</pre></div>';
  for(const cat of DATA.categories){
    const items=ALL.filter(s=>s.category===cat); if(!items.length) continue;
    h+='<h3>'+cat+'</h3><div class="grid">';
    for(const s of items){
      h+='<div class="tile" onclick="location.hash=\\''+s.name+'\\'"><b>'+s.name+'</b><span class="aws">'+(s.aws||'')+' · :'+s.port+'</span></div>';
    }
    h+='</div>';
  }
  h+='<div class="foot">Generated from <code>docs/catalog.js</code> — run <code>make docs</code> to refresh.</div>';
  m.innerHTML=h; renderNav(document.getElementById('q').value);
}
function renderService(name){
  const s=byName[name]; if(!s) return renderHome();
  const proxy = s.name==='conductor' ? '' : '/api/services/'+s.name;
  let h='<h1>'+s.name+'</h1><div class="sub">'+(s.aws?('AWS analog: <b>'+s.aws+'</b> · '):'')+s.category+'</div>';
  h+='<div class="pills">'+statusPill(s.status)+'<span class="pill">Port '+s.port+'</span><span class="pill">proxy base '+s.proxyBase+'</span></div>';
  h+='<p>'+esc(s.summary)+'</p>';
  if(s.needsKeys) h+='<div class="warn">⚠️ Provider activation: '+esc(s.needsKeys)+'</div>';
  if(s.name!=='conductor') h+='<div class="card"><b>Access</b><pre>{VERB} {CONDUCTOR}'+proxy+'{path}   # JWT or service token</pre></div>';
  h+='<h3>Endpoints</h3><div class="card" style="padding:0"><table><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>';
  for(const e of s.endpoints){
    h+='<tr><td class="method '+e.method.replace(/[^A-Z]/g,'')+'">'+e.method+'</td><td><code>'+esc(e.path)+'</code></td><td>'+esc(e.summary)+'</td></tr>';
  }
  h+='</tbody></table></div>';
  if(s.env&&s.env.length){
    h+='<h3>Environment</h3><div class="card" style="padding:0"><table><thead><tr><th>Variable</th><th>Default</th><th>Description</th></tr></thead><tbody>';
    for(const v of s.env) h+='<tr><td><code>'+v.name+'</code></td><td><code>'+esc(v.default)+'</code></td><td>'+esc(v.desc)+'</td></tr>';
    h+='</tbody></table></div>';
  }
  document.getElementById('main').innerHTML=h; renderNav(document.getElementById('q').value);
}
function route(){ const n=location.hash.slice(1); if(n) renderService(n); else renderHome(); }
document.getElementById('q').addEventListener('input', e=>renderNav(e.target.value));
window.addEventListener('hashchange', route);
route();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(siteDir, 'index.html'), html);

// --- SDK manager table (keeps the SDK + CLI in sync with the catalog) -------
const sdkTable = managers.map((m) => ({
  name: m.name,
  base: m.proxyBase,
  segment: m.crud ? m.crud.segment : null,
  aws: m.aws,
  category: m.category,
  port: m.port,
  status: m.status,
  projectInPath: !!m.projectInPath
}));
const sdkFile = `'use strict';
// GENERATED by scripts/gen-docs.mjs from docs/catalog.js — do not hand-edit.
// Compact manager descriptor table consumed by the SDK and the \`aerekos\` CLI.
module.exports = ${JSON.stringify(sdkTable, null, 2)};
`;
fs.writeFileSync(path.join(repoRoot, 'aerekos-sdk', 'managers.generated.js'), sdkFile);

// --- per-manager agent prompt blocks ---------------------------------------
const agentPromptsDir = path.join(repoRoot, 'docs', 'agents', 'prompts');
fs.mkdirSync(agentPromptsDir, { recursive: true });
for (const svc of all) {
  const lines = [];
  lines.push(`# Agent prompt — ${svc.name}`);
  lines.push('');
  lines.push(svc.summary);
  lines.push('');
  lines.push('Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.');
  if (svc.name !== 'conductor') {
    lines.push('');
    lines.push(`Base: \`{VERB} {CONDUCTOR}/api/services/${svc.name}{path}\``);
  }
  if (svc.needsKeys) {
    lines.push('');
    lines.push(`Provider note: ${svc.needsKeys}`);
  }
  lines.push('');
  lines.push('## Endpoints');
  lines.push('');
  for (const e of svc.endpoints || []) {
    lines.push(`- \`${e.method} ${e.path}\` — ${e.summary}`);
  }
  lines.push('');
  lines.push('Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.');
  lines.push('email/sms/slack/push are queued; outbound send disabled.');
  lines.push('');
  fs.writeFileSync(path.join(agentPromptsDir, `${svc.name}.md`), lines.join('\n'));
}

console.log(`Generated docs for ${all.length} services:`);
console.log(`  - ${servicesDir}/<name>.md (+ README.md index)`);
console.log(`  - ${siteDir}/index.html (web docs) + catalog.json`);
console.log(`  - aerekos-sdk/managers.generated.js (${sdkTable.length} managers)`);
console.log(`  - docs/agents/prompts/<name>.md (${all.length} agent prompts)`);

// Keep platform tools / Laya corpus / e2e matrix in sync whenever docs regen.
try {
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [path.join(__dirname, 'gen-platform-tools.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (r.status) process.exit(r.status || 1);
} catch (e) {
  console.warn('gen-platform-tools skipped:', e.message || e);
}
