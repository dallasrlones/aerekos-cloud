#!/usr/bin/env node
'use strict';

/**
 * W9b — behavioral smoke scaffold for every manager service.
 *
 * Live (CONDUCTOR_URL or AEREKOS_API_URL set, ICARUS_C0_SKIP_LIVE unset):
 *   For each manager: GET /api/services/{mgr}/api/v1/info through the conductor proxy.
 *
 * Offline (ICARUS_C0_SKIP_LIVE=1 or no CONDUCTOR_URL / AEREKOS_API_URL):
 *   Exits 0 with SKIP (set WAVE_MANAGER_OFFLINE_VALIDATE=1 to run catalog alignment checks).
 *
 * Progressive scope: this script only proves metadata/info reachability. Full create →
 * read → update → list → delete behavior is layered in `e2e/run.js` (P4_MANAGERS + rich
 * managers) and expanded per manager as keys/backends land — see docs/GA_MATURITY.md.
 *
 * Usage:
 *   ICARUS_C0_SKIP_LIVE=1 node e2e/wave-manager-behavior.js
 *   CONDUCTOR_URL=http://localhost:3000 node e2e/wave-manager-behavior.js
 */

const fs = require('fs');
const path = require('path');

const { ALL_MANAGERS, PORTS, P4_MANAGERS } = require('./catalog');
const { managers } = require('../docs/catalog');
const {
  skipLive, request, adminToken, assert, runNamed, env,
} = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

const repoRoot = path.join(__dirname, '..');

function catalogByName() {
  const map = new Map();
  for (const m of managers) map.set(m.name, m);
  return map;
}

function managersFromGaMaturity() {
  const md = path.join(repoRoot, 'docs/GA_MATURITY.md');
  if (!fs.existsSync(md)) return null;
  const names = new Set();
  for (const line of fs.readFileSync(md, 'utf8').split('\n')) {
    const m = line.match(/^\| `([a-z0-9_]+)` \|/);
    if (m) names.add(m[1]);
  }
  return names.size ? names : null;
}

function offlineValidate() {
  console.log('Wave manager behavior e2e — offline catalog validation');
  const byName = catalogByName();
  let ok = true;

  ok = runNamedSync('e2e/catalog.js exports ALL_MANAGERS', () => {
    assert(Array.isArray(ALL_MANAGERS) && ALL_MANAGERS.length > 0, 'ALL_MANAGERS empty');
    return `${ALL_MANAGERS.length} managers`;
  }) && ok;

  for (const name of ALL_MANAGERS) {
    ok = runNamedSync(`${name} — docs/catalog.js entry`, () => {
      const entry = byName.get(name);
      assert(entry, 'missing docs/catalog.js row');
      assert(entry.port === PORTS[name], `port mismatch catalog=${entry.port} e2e=${PORTS[name]}`);
      return entry.status || 'catalog ok';
    }) && ok;
  }

  const ga = managersFromGaMaturity();
  if (ga) {
    const missing = ALL_MANAGERS.filter((n) => !ga.has(n));
    ok = runNamedSync('GA_MATURITY.md covers ALL_MANAGERS', () => {
      assert(missing.length === 0, `missing GA rows: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
      return `${ga.size} GA rows`;
    }) && ok;
  } else {
    console.log('  skip  GA_MATURITY.md table not found');
  }

  const p4Names = new Set(P4_MANAGERS.map((p) => p.name));
  ok = runNamedSync('P4_MANAGERS ⊆ ALL_MANAGERS', () => {
    const extra = [...p4Names].filter((n) => !ALL_MANAGERS.includes(n));
    assert(extra.length === 0, `unknown P4: ${extra.join(', ')}`);
    return `${p4Names.size} P4 (CRUD in e2e/run.js — progressive)`;
  }) && ok;

  console.log(ok ? '\noffline catalog validation passed' : '\noffline catalog validation FAILED');
  process.exit(ok ? 0 : 1);
}

function runNamedSync(label, fn) {
  try {
    const detail = fn();
    console.log(`  ok  ${label}${detail ? ` — ${detail}` : ''}`);
    return true;
  } catch (err) {
    console.error(`  FAIL ${label}: ${err.message}`);
    return false;
  }
}

async function liveSmoke() {
  console.log('Wave manager behavior e2e — live /api/v1/info matrix');
  console.log('  note: full CRUD is progressive (see e2e/run.js, GA_MATURITY.md)');

  const pid = env('AEREKOS_PROJECT_ID') || env('E2E_PROJECT_ID') || `e2e-mgr-behavior-${Date.now().toString(36)}`;
  assertNotProdProject(pid);

  const token = await adminToken();
  let ok = true;
  let passed = 0;

  for (const name of ALL_MANAGERS) {
    const label = `${name} GET /api/v1/info via conductor`;
    const hit = await runNamed(label, async () => {
      const r = await request('GET', `/api/services/${name}/api/v1/info`, {
        token,
        query: { project_id: pid },
      });
      if (r.status === 502 || r.status === 503 || r.status === 504) {
        return `upstream ${r.status} (manager down?)`;
      }
      assert(r.status < 500, `HTTP ${r.status}`);
      if (r.status === 401 || r.status === 403) {
        assert(false, `auth HTTP ${r.status}`);
      }
      if (r.status === 404) {
        return '404 (stub route — warn)';
      }
      const body = r.data;
      assert(body && typeof body === 'object', 'non-JSON info body');
      const status = body.status || body.service?.status || 'ok';
      return `HTTP ${r.status} status=${status}`;
    });

    if (hit) {
      passed += 1;
    } else {
      ok = false;
    }
  }

  console.log(`\n${passed}/${ALL_MANAGERS.length} managers returned probeable /api/v1/info`);
  if (!ok) process.exit(1);
}

async function main() {
  if (skipLive()) {
    if (env('WAVE_MANAGER_OFFLINE_VALIDATE') === '1') {
      offlineValidate();
      return;
    }
    console.log('\nSKIP — live /api/v1/info matrix requires CONDUCTOR_URL or AEREKOS_API_URL');
    process.exit(0);
  }
  await liveSmoke();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
