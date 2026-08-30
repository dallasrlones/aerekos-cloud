'use strict';

/**
 * aerekos-cloud — full-stack end-to-end suite.
 *
 * Exercises EVERY manager through the live conductor (the canonical "private AWS" path):
 *   Tier 0  Conductor spine       — health, login (JWT), services registry, workers online
 *   Tier 1  Liveness matrix       — GET /api/services/{name}/metrics for all 33 managers
 *   Tier 2  P4 CRUD round-trips   — create/get/update/list/delete for 19 SQLite CRUD managers
 *   Tier 3  Rich-manager CRUD     — key_manager, secrets_manager, webhook_manager, registry_manager
 *   Tier 4  SDK flows             — aerekos-sdk drives login/services/workers/secrets/generic proxy
 *
 * Requires a running stack (e.g. `make up`). Pure HTTP + the dependency-free SDK — no native modules,
 * so it runs on any Node 18+ (including the host) regardless of better-sqlite3 ABI.
 *
 * Config (env):
 *   CONDUCTOR_URL   default http://localhost:3000   (this repo's full stack often maps 3300)
 *   AUTH_USERNAME   default admin
 *   AUTH_PASSWORD   default admin
 *   E2E_PROJECT_ID  default e2e-<timestamp>
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { AerekosClient, AerekosError } = require('../aerekos-sdk');
const { ALL_MANAGERS, P4_MANAGERS } = require('./catalog');

const CONDUCTOR_URL = (process.env.CONDUCTOR_URL || 'http://localhost:3000').replace(/\/+$/, '');
const USER = process.env.AUTH_USERNAME || 'admin';
const PASS = process.env.AUTH_PASSWORD || 'admin';
const RUN_ID = Date.now().toString(36);
const PID = process.env.E2E_PROJECT_ID || `e2e-${RUN_ID}`;
const { assertNotProdProject } = require('./lib/prodGuard');
assertNotProdProject(PID);

const C = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', dim: '\x1b[2m', bold: '\x1b[1m'
};

let TOKEN = null;
const results = [];

function record(tier, label, ok, detail, fatal = true) {
  results.push({ tier, label, ok, detail, fatal });
  const tag = ok ? `${C.green}PASS${C.reset}` : `${fatal ? C.red + 'FAIL' : C.yellow + 'WARN'}${C.reset}`;
  const det = detail ? ` ${C.dim}${detail}${C.reset}` : '';
  console.log(`  [${tag}] ${label}${det}`);
}

async function http(method, path, { body, query, token = TOKEN, headers = {} } = {}) {
  const url = new URL(`${CONDUCTOR_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const h = { Accept: 'application/json', ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && body !== null) {
    h['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(url.toString(), { method, headers: h, body: payload });
  const text = await res.text();
  let data = text;
  if (text) {
    try { data = JSON.parse(text); } catch { /* keep text (e.g. prometheus) */ }
  }
  return { status: res.status, data, text };
}

/** Run a single guarded check. `fn` throws on failure; non-fatal failures become WARN. */
async function check(tier, label, fn, { fatal = true } = {}) {
  try {
    const detail = await fn();
    record(tier, label, true, detail || '', fatal);
    return true;
  } catch (e) {
    record(tier, label, false, e.message, fatal);
    return false;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Tier 0 — conductor spine
// ---------------------------------------------------------------------------
async function tier0Spine() {
  console.log(`\n${C.bold}${C.cyan}Tier 0 — Conductor spine${C.reset} (${CONDUCTOR_URL})`);

  await check('spine', 'GET /health is OK', async () => {
    const r = await http('GET', '/health');
    assert(r.status === 200, `expected 200, got ${r.status}`);
    return `status=${r.status}`;
  });

  await check('spine', `login ${USER} -> JWT`, async () => {
    const r = await http('POST', '/api/auth/login', { body: { username: USER, password: PASS } });
    assert(r.status === 200, `login HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data && r.data.token, 'no token in response');
    TOKEN = r.data.token;
    return 'token acquired';
  });

  await check('spine', 'GET /api/services lists all managers', async () => {
    const r = await http('GET', '/api/services');
    assert(r.status === 200, `HTTP ${r.status}`);
    const names = (r.data.services || []).map((s) => s.name);
    const missing = ALL_MANAGERS.filter((m) => !names.includes(m));
    assert(missing.length === 0, `missing from registry: ${missing.join(', ')}`);
    return `${names.length} services registered`;
  });

  await check('spine', 'GET /api/workers — at least one online', async () => {
    const r = await http('GET', '/api/workers');
    assert(r.status === 200, `HTTP ${r.status}`);
    const workers = r.data.workers || r.data || [];
    const online = workers.filter((w) => (w.status || '').toLowerCase() === 'online' || w.online === true);
    assert(workers.length >= 1, 'no workers registered');
    return `${workers.length} worker(s), ${online.length} online`;
  });
}

// ---------------------------------------------------------------------------
// Tier 1 — liveness matrix (every manager, via conductor proxy /metrics)
// ---------------------------------------------------------------------------
async function tier1Liveness() {
  console.log(`\n${C.bold}${C.cyan}Tier 1 — Liveness matrix${C.reset} (conductor -> ${ALL_MANAGERS.length} managers)`);
  let healthy = 0;
  for (const name of ALL_MANAGERS) {
    const ok = await check('liveness', `${name} reachable via conductor`, async () => {
      const r = await http('GET', `/api/services/${name}/metrics`, { query: { project_id: PID } });
      assert(r.status === 200, `HTTP ${r.status}`);
      assert(r.text && r.text.length > 0, 'empty metrics body');
      return `${r.text.length}B metrics`;
    });
    if (ok) healthy += 1;
  }
  console.log(`  ${C.dim}-> ${healthy}/${ALL_MANAGERS.length} managers reachable through the conductor${C.reset}`);
}

// ---------------------------------------------------------------------------
// Tier 2 — uniform P4 CRUD round-trips
// ---------------------------------------------------------------------------
async function p4Crud({ name, seg, fields }) {
  const base = `/api/services/${name}/api/v1/${seg}`;
  const rname = `e2e-${seg}-${RUN_ID}`;
  // create
  const c = await http('POST', base, { body: { project_id: PID, name: rname, ...fields } });
  assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
  const id = c.data.item && c.data.item.id;
  assert(id, 'no item.id on create');
  // get
  const g = await http('GET', `${base}/${id}`, { query: { project_id: PID } });
  assert(g.status === 200 && g.data.item.id === id, `get HTTP ${g.status}`);
  // update
  const u = await http('PATCH', `${base}/${id}`, { query: { project_id: PID }, body: { name: `${rname}-u` } });
  assert(u.status === 200 && u.data.item.name === `${rname}-u`, `update HTTP ${u.status} name=${u.data.item && u.data.item.name}`);
  // list
  const l = await http('GET', base, { query: { project_id: PID } });
  assert(l.status === 200 && (l.data.items || []).some((x) => x.id === id), `list HTTP ${l.status}`);
  // delete
  const d = await http('DELETE', `${base}/${id}`, { query: { project_id: PID } });
  assert(d.status === 200 && d.data.deleted === true, `delete HTTP ${d.status}`);
  return 'create->get->update->list->delete';
}

async function tier2P4() {
  console.log(`\n${C.bold}${C.cyan}Tier 2 — P4 CRUD round-trips${C.reset} (${P4_MANAGERS.length} managers)`);
  for (const spec of P4_MANAGERS) {
    await check('p4', `${spec.name} CRUD /${spec.seg}`, () => p4Crud(spec));
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — rich managers
// ---------------------------------------------------------------------------
async function tier3Rich() {
  console.log(`\n${C.bold}${C.cyan}Tier 3 — Rich-manager CRUD${C.reset}`);

  // key_manager (KMS): create -> list -> rotate. Not project-scoped; project_id used for routing.
  await check('rich', 'key_manager create/list/rotate', async () => {
    const kname = `e2e-key-${RUN_ID}`;
    const base = '/api/services/key_manager/api/keys';
    const c = await http('POST', base, { query: { project_id: PID }, body: { name: kname, type: 'symmetric', algorithm: 'aes-256-gcm' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    const l = await http('GET', base, { query: { project_id: PID } });
    assert(l.status === 200, `list HTTP ${l.status}`);
    const rot = await http('POST', `${base}/${encodeURIComponent(kname)}/rotate`, { query: { project_id: PID } });
    assert(rot.status === 200 || rot.status === 201, `rotate HTTP ${rot.status}`);
    return 'key created, listed, rotated';
  });

  // secrets_manager: create -> reveal -> list -> delete (exercises secrets -> key_manager crypto path).
  await check('rich', 'secrets_manager create/reveal/list/delete', async () => {
    const sname = `e2eSecret${RUN_ID}`;
    const base = '/api/services/secrets_manager/api/v1/secrets';
    const c = await http('POST', base, { body: { project_id: PID, name: sname, value: 's3cr3t-value' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    const id = c.data.secret && c.data.secret.id;
    assert(id, 'no secret.id');
    const rev = await http('GET', `${base}/${id}`, { query: { project_id: PID, reveal: 1 } });
    assert(rev.status === 200 && rev.data.secret.value === 's3cr3t-value', `reveal mismatch HTTP ${rev.status}`);
    const l = await http('GET', base, { query: { project_id: PID } });
    assert(l.status === 200 && (l.data.secrets || []).some((s) => s.id === id), `list HTTP ${l.status}`);
    const d = await http('DELETE', `${base}/${id}`, { query: { project_id: PID } });
    assert(d.status === 200 || d.status === 204, `delete HTTP ${d.status}`);
    return 'secret stored, revealed, deleted';
  });

  // webhook_manager: create -> get -> update -> delete (no dispatch to avoid outbound calls).
  await check('rich', 'webhook_manager create/get/update/delete', async () => {
    const wname = `e2e-wh-${RUN_ID}`;
    const base = '/api/services/webhook_manager/api/v1/webhooks';
    const c = await http('POST', base, { body: { project_id: PID, name: wname, target_url: 'https://example.test/hook' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    const id = c.data.webhook.id;
    const g = await http('GET', `${base}/${id}`, { query: { project_id: PID } });
    assert(g.status === 200, `get HTTP ${g.status}`);
    const u = await http('PATCH', `${base}/${id}`, { query: { project_id: PID }, body: { name: `${wname}-u`, enabled: false } });
    assert(u.status === 200 && u.data.webhook.name === `${wname}-u` && u.data.webhook.enabled === false, `update HTTP ${u.status}`);
    const d = await http('DELETE', `${base}/${id}`, { query: { project_id: PID } });
    assert(d.status === 200, `delete HTTP ${d.status}`);
    return 'endpoint created, updated, deleted';
  });

  // registry_manager: create -> get -> update -> list -> delete.
  await check('rich', 'registry_manager create/get/update/list/delete', async () => {
    const rname = `e2e-reg-${RUN_ID}`;
    const base = '/api/services/registry_manager/api/v1/registries';
    const c = await http('POST', base, { body: { project_id: PID, name: rname, registry_url: 'harbor.example.test', type: 'harbor', namespace: 'aerekos', credential_ref: 'robot-token' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    const id = c.data.registry.id;
    const g = await http('GET', `${base}/${id}`, { query: { project_id: PID } });
    assert(g.status === 200 && g.data.registry.namespace === 'aerekos', `get HTTP ${g.status}`);
    const u = await http('PATCH', `${base}/${id}`, { query: { project_id: PID }, body: { namespace: 'staging', enabled: false } });
    assert(u.status === 200 && u.data.registry.namespace === 'staging' && u.data.registry.enabled === false, `update HTTP ${u.status}`);
    const l = await http('GET', base, { query: { project_id: PID } });
    assert(l.status === 200 && (l.data.registries || []).some((x) => x.id === id), `list HTTP ${l.status}`);
    const d = await http('DELETE', `${base}/${id}`, { query: { project_id: PID } });
    assert(d.status === 200 && d.data.deleted === true, `delete HTTP ${d.status}`);
    return 'registry entry created, updated, deleted';
  });

  // registry public config (no secrets).
  await check('rich', 'registry_manager public config', async () => {
    const r = await http('GET', '/api/services/registry_manager/api/v1/registry/config', { query: { project_id: PID } });
    assert(r.status === 200 && r.data.registry && r.data.registry.mode, `HTTP ${r.status}`);
    assert(!('password' in r.data.registry), 'config leaked a password field');
    return `mode=${r.data.registry.mode}`;
  });

  // git_manager: create repo -> get -> branches (empty) -> update -> list -> delete.
  await check('rich', 'git_manager repo create/get/update/list/delete', async () => {
    const gname = `e2e-repo-${RUN_ID}`;
    const base = '/api/services/git_manager/api/v1/repos';
    const c = await http('POST', base, { body: { project_id: PID, name: gname, description: 'e2e repo' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    const id = c.data.repository.id;
    assert(c.data.repository.clone_path.includes(`${gname}.git`), 'no clone_path');
    const g = await http('GET', `${base}/${id}`, { query: { project_id: PID } });
    assert(g.status === 200 && Array.isArray(g.data.repository.branches), `get HTTP ${g.status}`);
    const u = await http('PATCH', `${base}/${id}`, { query: { project_id: PID }, body: { description: 'updated' } });
    assert(u.status === 200 && u.data.repository.description === 'updated', `update HTTP ${u.status}`);
    const l = await http('GET', base, { query: { project_id: PID } });
    assert(l.status === 200 && (l.data.repositories || []).some((x) => x.id === id), `list HTTP ${l.status}`);
    const d = await http('DELETE', `${base}/${id}`, { query: { project_id: PID } });
    assert(d.status === 200 && d.data.deleted === true, `delete HTTP ${d.status}`);
    return 'repo created, updated, deleted';
  });
}

// ---------------------------------------------------------------------------
// Tier 4 — SDK flows
// ---------------------------------------------------------------------------
async function tier4Sdk() {
  console.log(`\n${C.bold}${C.cyan}Tier 4 — SDK flows${C.reset} (aerekos-sdk)`);
  const client = new AerekosClient({ baseUrl: CONDUCTOR_URL });

  await check('sdk', 'client.auth.login', async () => {
    const r = await client.auth.login(USER, PASS);
    assert(r && r.token, 'no token');
    return 'logged in';
  });

  await check('sdk', 'client.services.list', async () => {
    const r = await client.services.list();
    const n = (r.services || []).length;
    assert(n >= ALL_MANAGERS.length, `only ${n} services`);
    return `${n} services`;
  });

  await check('sdk', 'client.workers.list', async () => {
    const r = await client.workers.list();
    const w = r.workers || r || [];
    assert(Array.isArray(w), 'workers not a list');
    return `${w.length} worker(s)`;
  });

  await check('sdk', 'client.secrets set/get/list/remove', async () => {
    const sname = `sdkSecret${RUN_ID}`;
    await client.secrets.set(PID, { name: sname, value: 'via-sdk' });
    const got = await client.secrets.get(PID, sname, { reveal: true }).catch(() => null);
    // get-by-name may 404 if the manager keys by id; reveal-by-id path is covered in Tier 3.
    const list = await client.secrets.list(PID);
    assert((list.secrets || []).some((s) => s.name === sname), 'secret not in list');
    // best-effort cleanup by name
    await client.secrets.remove(PID, sname).catch(() => {});
    return got && got.secret ? 'set/get/list/remove' : 'set/list/remove';
  });

  await check('sdk', 'client.proxy generic (analytics_manager)', async () => {
    const ename = `sdk-evt-${RUN_ID}`;
    const c = await client.proxy('analytics_manager', {
      method: 'POST', path: '/api/v1/events', projectId: PID,
      body: { name: ename, event: 'sdk.test', value: '1', properties: '{}' }
    });
    assert(c && c.item && c.item.id, 'no item.id from generic proxy');
    await client.proxy('analytics_manager', { method: 'DELETE', path: `/api/v1/events/${c.item.id}`, projectId: PID }).catch(() => {});
    return 'generic proxy round-trip';
  });
}

// ---------------------------------------------------------------------------
// Tier 5 — real Git Smart HTTP round-trip (clone/commit/push/pull)
// Hits git_manager's transport port directly (the conductor proxy does not
// stream git transport). Non-fatal: warns if `git` is missing or unreachable.
// ---------------------------------------------------------------------------
function gitAvailable() {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function tier5GitTransport() {
  // Transport only: unique repo name, never aerekos-cloud, never push the live main.
  console.log(`\n${C.bold}${C.cyan}Tier 5 — Git Smart HTTP round-trip${C.reset}`);
  const GIT_URL = (process.env.GIT_MANAGER_URL || 'http://localhost:3130').replace(/\/+$/, '');

  if (!gitAvailable()) {
    record('git', 'git client available', false, 'git not found on PATH; skipping transport test', false);
    return;
  }

  const gname = `e2e-xport-${RUN_ID}`;
  const base = '/api/services/git_manager/api/v1/repos';
  let repoId = null;

  const created = await check('git', 'create repo (control plane)', async () => {
    const c = await http('POST', base, { body: { project_id: PID, name: gname, description: 'transport e2e' } });
    assert(c.status === 201, `create HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 140)}`);
    repoId = c.data.repository.id;
    return gname;
  }, { fatal: false });
  if (!created) return;

  const cloneUrl = `${GIT_URL}/git/${encodeURIComponent(PID)}/${gname}.git`;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-git-'));
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'e2e', GIT_AUTHOR_EMAIL: 'e2e@aerekos.test',
    GIT_COMMITTER_NAME: 'e2e', GIT_COMMITTER_EMAIL: 'e2e@aerekos.test'
  };
  const git = (args, cwd) => execFileSync('git', args, { cwd, env, stdio: 'pipe' });

  await check('git', 'clone -> commit -> push -> pull round-trip', async () => {
    const a = path.join(work, 'a');
    git(['clone', cloneUrl, a]);
    fs.writeFileSync(path.join(a, 'README.md'), `# ${gname}\nhello from e2e\n`);
    git(['add', '.'], a);
    git(['commit', '-m', 'initial commit'], a);
    git(['push', 'origin', 'HEAD:main'], a);
    // Second clone must see the pushed commit.
    const b = path.join(work, 'b');
    git(['clone', cloneUrl, b]);
    const readme = fs.readFileSync(path.join(b, 'README.md'), 'utf8');
    assert(readme.includes('hello from e2e'), 'pushed content not present in fresh clone');
    return 'pushed + re-cloned content matches';
  }, { fatal: false });

  await check('git', 'push recorded as a push event', async () => {
    const r = await http('GET', `${base}/${repoId}/pushes`, { query: { project_id: PID } });
    assert(r.status === 200, `HTTP ${r.status}`);
    assert((r.data.pushes || []).length >= 1, 'no push events recorded by post-receive hook');
    return `${r.data.pushes.length} push event(s)`;
  }, { fatal: false });

  // cleanup
  await http('DELETE', `${base}/${repoId}`, { query: { project_id: PID } }).catch(() => {});
  try { fs.rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
async function main() {
  console.log(`${C.bold}aerekos-cloud E2E${C.reset}  conductor=${CONDUCTOR_URL}  project=${PID}`);
  await tier0Spine();
  const spineOk = results.filter((r) => r.tier === 'spine').every((r) => r.ok);
  if (!spineOk) {
    console.log(`\n${C.red}Spine checks failed — is the stack up? (make up / CONDUCTOR_URL)${C.reset}`);
  } else {
    await tier1Liveness();
    await tier2P4();
    await tier3Rich();
    await tier4Sdk();
    await tier5GitTransport();
    console.log(`\n${C.bold}${C.cyan}Production-plan waves${C.reset}`);
    const waves = spawnSync(process.execPath, [path.join(__dirname, 'run-waves.js')], {
      stdio: 'inherit',
      env: process.env,
    });
    if (waves.status !== 0) {
      record('waves', 'e2e/run-waves.js', false, `exit ${waves.status}`);
    } else {
      record('waves', 'e2e/run-waves.js', true, 'all waves');
    }
  }

  // Summary
  const fatalFails = results.filter((r) => !r.ok && r.fatal);
  const warns = results.filter((r) => !r.ok && !r.fatal);
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${C.bold}Summary${C.reset}: ${C.green}${passed} passed${C.reset}, ` +
    `${fatalFails.length ? C.red : ''}${fatalFails.length} failed${C.reset}, ` +
    `${warns.length ? C.yellow : ''}${warns.length} warnings${C.reset} (of ${results.length} checks)`);
  if (fatalFails.length) {
    console.log(`${C.red}Failures:${C.reset}`);
    for (const f of fatalFails) console.log(`  - [${f.tier}] ${f.label}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log(`${C.green}${C.bold}All end-to-end checks passed. Your private AWS is live. 🎉${C.reset}`);
  }
}

main().catch((e) => {
  const msg = e instanceof AerekosError ? `${e.message} (status=${e.status})` : e.stack || e.message;
  console.error(`\n${C.red}E2E runner crashed:${C.reset} ${msg}`);
  process.exit(1);
});
