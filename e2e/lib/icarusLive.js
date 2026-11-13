'use strict';

const { URL } = require('url');
const http = require('http');
const https = require('https');

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

function conductorBase() {
  return (env('AEREKOS_API_URL') || env('CONDUCTOR_URL')).replace(/\/$/, '');
}

function skipLive() {
  return env('ICARUS_C0_SKIP_LIVE') === '1' || !conductorBase();
}

function request(method, pathname, { token, query, body, headers, timeoutMs } = {}) {
  const base = conductorBase();
  if (!base) return Promise.reject(new Error('AEREKOS_API_URL or CONDUCTOR_URL is required'));
  const u = new URL(pathname, base.endsWith('/') ? base : `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) u.searchParams.set(k, String(v));
    }
  }
  const payload =
    body == null
      ? null
      : Buffer.isBuffer(body) || typeof body === 'string'
        ? Buffer.from(body)
        : Buffer.from(JSON.stringify(body));
  const hdrs = { ...(headers || {}) };
  if (token) hdrs.Authorization = `Bearer ${token}`;
  if (payload && !hdrs['Content-Type'] && !hdrs['content-type']) {
    hdrs['Content-Type'] = Buffer.isBuffer(body) || typeof body === 'string' ? 'application/octet-stream' : 'application/json';
  }
  if (payload) hdrs['Content-Length'] = String(payload.length);
  const lib = u.protocol === 'https:' ? https : http;
  const timeout = timeoutMs || parseInt(env('CONDUCTOR_PROXY_TIMEOUT_MS') || '120000', 10);
  return new Promise((resolve, reject) => {
    const req = lib.request(u, { method, headers: hdrs, timeout }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        let data = text;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        resolve({ status: res.statusCode, data, buf });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`timeout ${method} ${u.pathname}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function isPlaceholderToken(tok) {
  const t = String(tok || '').trim();
  if (!t) return true;
  if (/^replace-/i.test(t)) return true;
  if (/^your[_-]?token/i.test(t)) return true;
  if (t === 'changeme' || t === 'TODO' || t === 'xxx') return true;
  return false;
}

async function adminToken() {
  const existing = env('AEREKOS_C0_ADMIN_TOKEN') || env('TOKEN') || env('ICARUS_API_TOKEN');
  if (existing && !isPlaceholderToken(existing)) return existing;
  if (existing && isPlaceholderToken(existing)) {
    console.warn('[icarusLive] ignoring placeholder admin token; falling back to login');
  }
  const user = env('AEREKOS_ADMIN_USER') || 'admin';
  const pass = env('AEREKOS_ADMIN_PASSWORD') || 'admin';
  const r = await request('POST', '/api/auth/login', { body: { username: user, password: pass } });
  if (r.status !== 200 || !r.data?.token) throw new Error(`admin login HTTP ${r.status}`);
  return r.data.token;
}

async function mintAppToken(admin, projectId) {
  const clientId = env('AEREKOS_CLIENT_ID');
  const clientSecret = env('AEREKOS_CLIENT_SECRET');
  const pid = projectId || env('AEREKOS_PROJECT_ID');
  if (!clientId || !clientSecret || !pid) {
    if (!admin) throw new Error('need client credentials or admin TOKEN');
    return admin;
  }
  const r = await request('POST', '/api/services/auth_manager/api/v1/auth/token', {
    query: { project_id: pid },
    body: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
  });
  if (r.status !== 200) throw new Error(`token HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
  return r.data.access_token || r.data.token;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runNamed(name, fn) {
  try {
    const detail = await fn();
    console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
    return true;
  } catch (err) {
    console.error(`  FAIL ${name}: ${err.message}`);
    return false;
  }
}

module.exports = {
  env,
  conductorBase,
  skipLive,
  request,
  adminToken,
  mintAppToken,
  assert,
  runNamed,
  isPlaceholderToken,
};
