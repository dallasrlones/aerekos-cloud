'use strict';

/**
 * W19 — chaos skeleton: manager / worker kill → conductor proxy returns 503.
 *
 * Manual drill (documented — not automated against prod):
 *   1. Note healthy proxy: GET /api/services/storage_manager/health → 200
 *   2. Stop storage_manager container on worker (or kill process)
 *   3. Repeat GET within CONDUCTOR_PROXY_TIMEOUT_MS — expect 502/503/504 (unreachable upstream)
 *   4. Restart manager; health returns 200
 *
 * Live mode (optional): set CHAOS_KILL_SERVICE=storage_manager and CHAOS_CONFIRM=1
 * only when running against a disposable dev stack with operator present.
 */

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

const DRILL = [
  'Stop target manager on worker host (docker stop / kill process)',
  'GET conductor proxy /api/services/{mgr}/health within CONDUCTOR_PROXY_TIMEOUT_MS',
  'Expect 502/503/504 (unreachable upstream) until manager restarts — kill → 503 story',
  'Restart manager; health returns 200',
  'Confirm X-Request-Id present on error body when conductor returns upstream errors',
];

function offlineChaosAssert() {
  assert(Array.isArray(DRILL) && DRILL.length >= 4, 'chaos drill must document kill→503');
  assert(DRILL.some((s) => /503|502|504/.test(s)), 'drill must mention upstream error codes');
  console.log('  offline: drill documented (kill → 503/502/504 until restart)');
  console.log('\nSKIP — set CONDUCTOR_URL for live baseline health; CHAOS_KILL_SERVICE + CHAOS_CONFIRM=1 for kill step');
  process.exit(0);
}

async function main() {
  console.log('Wave chaos 503 e2e');
  console.log('  drill steps:');
  for (const step of DRILL) console.log(`    - ${step}`);

  if (skipLive()) {
    offlineChaosAssert();
  }

  let ok = true;
  await withSandbox('chaos-503', async (box) => {
    assertNotProdProject(box.projectId);
    const { token } = box;

    ok = await runNamed('baseline manager proxy health', async () => {
      const health = await request('GET', '/api/services/storage_manager/health', { token });
      assert(health.status === 200, `expected 200, got ${health.status}`);
      return 'healthy';
    }) && ok;

    const kill = process.env.CHAOS_KILL_SERVICE;
    if (!kill || process.env.CHAOS_CONFIRM !== '1') {
      box.skip('CHAOS_KILL_SERVICE + CHAOS_CONFIRM=1 required for kill step');
      return;
    }

    ok = await runNamed(`post-kill proxy to ${kill} (operator must stop container)`, async () => {
      const probe = await request('GET', `/api/services/${kill}/health`, { token, timeoutMs: 15000 });
      assert(
        probe.status === 503 || probe.status === 502 || probe.status === 504,
        `expected upstream error, got ${probe.status}`,
      );
      return String(probe.status);
    }) && ok;
  });

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
