'use strict';

/**
 * HTTP e2e against a spawned api_manager (no conductor required).
 * Covers apply, relationships, nested CRUD, where/include, unique, scale.
 * Uses Node 20-compatible better-sqlite3 via PATH.
 */

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { assert, runNamed } = require('./lib/icarusLive');
const { runDataApiE2e } = require('./lib/dataApiFlow');

const ROOT = path.join(__dirname, '..');
const PORT = parseInt(process.env.E2E_DATA_API_PORT || '13124', 10);
const BASE = `http://127.0.0.1:${PORT}`;

function request(method, pathname, { query, body, timeoutMs } = {}) {
  let mapped = pathname;
  if (mapped.startsWith('/api/services/api_manager')) {
    mapped = mapped.replace('/api/services/api_manager', '') || '/';
  }
  const u = new URL(mapped, BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) u.searchParams.set(k, String(v));
    }
  }
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  const headers = {};
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = String(payload.length);
  }
  return new Promise((resolve, reject) => {
    const req = http.request(u, { method, headers, timeout: timeoutMs || 20000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = text;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout ${method} ${u.pathname}`)); });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitHealth(tries = 40) {
  return new Promise((resolve, reject) => {
    const tick = async (n) => {
      try {
        const r = await request('GET', '/health');
        if (r.status === 200) return resolve(r);
      } catch (_) { /* not up yet */ }
      if (n <= 0) return reject(new Error('api_manager health timeout'));
      setTimeout(() => tick(n - 1), 150);
    };
    tick(tries);
  });
}

async function main() {
  console.log('Data API local HTTP e2e');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-data-api-e2e-'));
  const child = spawn(process.execPath, ['index.js'], {
    cwd: path.join(ROOT, 'worker/api_manager'),
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      SKIP_SERVICE_REGISTRATION: 'true',
      SKIP_DB_PROVISION: '1',
      SKIP_INVOKE: '1',
      DATABASE_PATH: path.join(tmp, 'api.db'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  const box = {
    projectId: `p-e2e-http-${Date.now().toString(36)}`,
    token: '',
    runId: Date.now().toString(36),
    skips: [],
    skip(reason) { this.skips.push(reason); console.log(`  skip  ${reason}`); },
    track() {},
  };
  let ok = true;
  try {
    await waitHealth();
    ok = await runNamed('sqlite3 apply + relationships + query + scale', async () => {
      const result = await runDataApiE2e(box, { request, assert }, { engine: 'sqlite3', app: 'app' });
      if (result.skipped) throw new Error(`unexpected skip: ${box.skips.join('; ')}`);
      return `${result.app} q=${result.queryEngine} desired=${result.desired}`;
    }) && ok;

    ok = await runNamed('seed-presets include data collection routes', async () => {
      const seed = await request('POST', '/api/v1/endpoints/seed-presets', {
        query: { project_id: box.projectId },
        body: { project_id: box.projectId },
      });
      assert(seed.status === 200, `seed HTTP ${seed.status}`);
      const list = await request('GET', '/api/v1/endpoints', { query: { project_id: box.projectId } });
      const items = list.data?.items || [];
      assert(items.some((r) => r.name === 'data-collection-list'), 'missing data-collection-list');
      assert(items.some((r) => String(r.name || '').startsWith('data-app-')), 'missing apply-seeded data-app-* routes');
      return `${items.length} routes`;
    }) && ok;
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
  if (!ok && stderr) console.error(stderr.slice(-800));
  if (box.skips.length) console.log(`  skipped: ${box.skips.join('; ')}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
