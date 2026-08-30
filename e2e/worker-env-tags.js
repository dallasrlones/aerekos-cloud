'use strict';

/**
 * Icarus T65 — worker env + capabilities tags.
 * Skip live with ICARUS_C0_SKIP_LIVE=1 (contract check on the Worker model).
 * Live: POST /api/workers/register with env, GET /api/workers returns it; missing env → null.
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const FAIL = [];
const PASS = [];

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((detail) => {
      PASS.push(name);
      console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
    })
    .catch((err) => {
      FAIL.push({ name, err });
      console.error(`  FAIL ${name}: ${err.message}`);
    });
}

function contractCheck() {
  const src = fs.readFileSync(path.join(ROOT, 'conductor/api/models/index.js'), 'utf8');
  if (!/env:\s*'string'/.test(src)) throw new Error('Worker model missing env');
  if (!/capabilities:\s*'string'/.test(src)) throw new Error('Worker model missing capabilities');
  const routes = fs.readFileSync(path.join(ROOT, 'conductor/api/routes/worker.js'), 'utf8');
  if (!/env:\s*worker\.env/.test(routes) && !/env: worker\.env/.test(routes)) {
    throw new Error('list payload missing env');
  }
}

function conductorBase() {
  return (env('AEREKOS_API_URL') || env('CONDUCTOR_URL')).replace(/\/$/, '');
}

function request(method, pathname, { token, body } = {}) {
  const base = conductorBase();
  if (!base) return Promise.reject(new Error('AEREKOS_API_URL required'));
  const u = new URL(pathname, base.endsWith('/') ? base : `${base}/`);
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  const lib = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(u, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = raw;
        try { data = JSON.parse(raw); } catch { /* text */ }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function live() {
  const token = env('AEREKOS_C0_ADMIN_TOKEN') || env('TOKEN');
  let regToken = env('WORKER_REGISTRATION_TOKEN');
  if (!regToken && token) {
    const tok = await request('GET', '/api/token', { token });
    if (tok.status === 200 && tok.data?.token) regToken = tok.data.token;
  }
  if (!regToken) throw new Error('WORKER_REGISTRATION_TOKEN or GET /api/token required');
  const tagged = await request('POST', '/api/workers/register', {
    body: { token: regToken, hostname: `icarus-t65-${Date.now()}`, ip_address: `10.65.${Date.now() % 250}.1`, env: 'prod', capabilities: ['gpu'] },
  });
  if (tagged.status !== 201 && tagged.status !== 200) {
    throw new Error(`register tagged HTTP ${tagged.status}: ${JSON.stringify(tagged.data).slice(0, 200)}`);
  }
  const envVal = tagged.data?.worker?.env;
  if (envVal !== 'prod') throw new Error(`expected env prod, got ${envVal}`);
  const list = await request('GET', '/api/workers', { token });
  if (list.status !== 200) throw new Error(`list HTTP ${list.status}`);
  const found = (list.data?.workers || []).find((w) => w.id === tagged.data.worker.id);
  if (!found || found.env !== 'prod') throw new Error('list missing env prod');
  const bare = await request('POST', '/api/workers/register', {
    body: { token: regToken, hostname: `icarus-t65-bare-${Date.now()}`, ip_address: `10.66.${Date.now() % 250}.1` },
  });
  if (bare.status !== 201 && bare.status !== 200) throw new Error(`register bare HTTP ${bare.status}`);
  if (bare.data?.worker?.env != null && bare.data.worker.env !== null) {
    throw new Error(`missing env should be null, got ${bare.data.worker.env}`);
  }
}

async function main() {
  console.log('Icarus T65 worker-env-tags');
  await record('contract: Worker.env + capabilities', contractCheck);
  if (env('ICARUS_C0_SKIP_LIVE') === '1' || !conductorBase()) {
    console.log('  skip live');
  } else {
    await record('live: register env prod + missing env null', live);
  }
  console.log(`${PASS.length} passed, ${FAIL.length} failed`);
  if (FAIL.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
