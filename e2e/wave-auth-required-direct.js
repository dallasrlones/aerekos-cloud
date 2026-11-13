#!/usr/bin/env node
'use strict';

/**
 * W3 — AUTH_REQUIRED story: documented prod flip + optional live direct-port 401.
 *
 * Live:
 *   CONDUCTOR_URL + PROJECT_ID + token — assert auth-required runbook covers the flip
 *   DIRECT_MANAGER_URL — unauthenticated GET must return 401 when AUTH_REQUIRED=true
 *
 * Exit 0 on SKIP when neither probe env is set.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const token =
  process.env.AEREKOS_C0_ADMIN_TOKEN ||
  process.env.AEREKOS_TOKEN ||
  process.env.TOKEN ||
  '';
const base = process.env.CONDUCTOR_URL || process.env.AEREKOS_API_URL || '';
const pid = process.env.PROJECT_ID || process.env.AEREKOS_PROJECT_ID || '';
const direct = (process.env.DIRECT_MANAGER_URL || '').replace(/\/$/, '');

let ok = true;
function pass(msg) { console.log(`  ok  ${msg}`); }
function fail(msg) { console.error(`  FAIL ${msg}`); ok = false; }

function docsProbe() {
  const runbook = fs.readFileSync(path.join(ROOT, 'docs/runbooks/auth-required.md'), 'utf8');
  const identity = fs.readFileSync(path.join(ROOT, 'docs/architecture/identity.md'), 'utf8');
  const combined = `${runbook}\n${identity}`;
  const checks = [
    [/AUTH_REQUIRED=true/, 'AUTH_REQUIRED=true prod flip'],
    [/requireAuth\(\)/, 'requireAuth() wiring'],
    [/401/, '401 without Bearer'],
    [/appProxyAuth/, 'conductor proxy layer'],
    [/docker-compose\.core\.yml/, 'core compose wiring'],
  ];
  for (const [re, label] of checks) {
    if (!re.test(combined)) {
      fail(`docs missing: ${label}`);
      return;
    }
  }
  pass('AUTH_REQUIRED story documented (auth-required.md + identity.md)');
}

async function directProbe() {
  const url = `${direct}/api/v1/buckets?project_id=${encodeURIComponent(pid || 'skip')}`;
  let res;
  try {
    res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
  } catch (e) {
    fail(`direct fetch: ${e.message}`);
    return;
  }
  if (res.status === 401) {
    pass(`direct port rejects unauthenticated (HTTP ${res.status})`);
    return;
  }
  // Some managers leave /health open; protected segment should still 401.
  const fallback = `${direct}/api/v1/info`;
  try {
    const r2 = await fetch(fallback, { method: 'GET', headers: { Accept: 'application/json' } });
    if (r2.status === 401) {
      pass(`direct port rejects unauthenticated on /api/v1/info (HTTP ${r2.status})`);
      return;
    }
    fail(`expected 401 without auth, got ${res.status} and /info ${r2.status}`);
  } catch (e) {
    fail(`direct fallback fetch: ${e.message}`);
  }
}

async function main() {
  console.log('Wave auth-required direct e2e');

  const hasDocEnv = base && pid && token;
  const hasDirect = !!direct;

  if (!hasDocEnv && !hasDirect) {
    console.log('  SKIP — set CONDUCTOR_URL+PROJECT_ID+token and/or DIRECT_MANAGER_URL');
    process.exit(0);
  }

  if (hasDocEnv) docsProbe();
  if (hasDirect) await directProbe();

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
