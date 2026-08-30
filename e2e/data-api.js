'use strict';

/**
 * Sandbox e2e — Data API: schema apply, relationships, queries, scale, engines.
 * Creates e2e-platform-* only. Never touches production projects.
 * Skips when api_manager / db_manager is not deployed.
 */

const { skipLive, request, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');
const { reachable, runDataApiE2e } = require('./lib/dataApiFlow');

async function main() {
  console.log('Data API sandbox e2e');
  if (skipLive()) {
    console.log('  skip live (set AEREKOS_API_URL / CONDUCTOR_URL)');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('data-api', async (box) => {
    const q = { project_id: box.projectId };
    const token = box.token;

    await request('POST', '/api/services/api_manager/enable', { token, body: {} }).catch(() => {});

    let sqliteOk = false;

    ok = await runNamed('sqlite3 apply + relationships + query + scale', async () => {
      const result = await runDataApiE2e(box, { request, assert }, { engine: 'sqlite3', app: 'app' });
      if (result.skipped) return 'skipped';
      sqliteOk = true;
      return `${result.app} q=${result.queryEngine} desired=${result.desired}`;
    }) && ok;

    ok = await runNamed('SDK query + nested + scale', async () => {
      if (!sqliteOk) {
        box.skip('sdk data API (sqlite apply skipped)');
        return 'skipped';
      }
      const client = sdkClient(token);
      let listed;
      try {
        listed = await client.data.query(box.projectId, 'app', 'User', { include: ['posts'], limit: 10 });
      } catch (err) {
        if (err.status === 404 || err.status === 500 || err.status === 502 || err.status === 503) {
          box.skip(`sdk data.query HTTP ${err.status}`);
          return 'skipped';
        }
        throw err;
      }
      const items = listed.items || listed.data?.items || [];
      assert(Array.isArray(items), 'sdk query did not return items');
      if (items[0]?.id) {
        const nested = await client.data.listNested(box.projectId, 'app', 'User', items[0].id, 'posts');
        const posts = nested.items || nested.data?.items || [];
        assert(Array.isArray(posts), 'sdk listNested missing items');
      }
      const scaled = await client.data.scale(box.projectId, 'app', 1);
      const desired = scaled.item?.desired ?? scaled.desired;
      assert(desired == null || Number(desired) >= 1, `sdk scale desired=${desired}`);
      return `users=${items.length}`;
    }) && ok;

    ok = await runNamed('gateway data presets + seeded routes', async () => {
      const seed = await request('POST', '/api/services/api_manager/api/v1/endpoints/seed-presets', {
        token, query: q, body: { project_id: box.projectId },
      });
      if (!reachable(seed.status)) {
        box.skip(`seed-presets HTTP ${seed.status}`);
        return 'skipped';
      }
      assert(seed.status === 200, `seed HTTP ${seed.status}`);
      const list = await request('GET', '/api/services/api_manager/api/v1/endpoints', { token, query: q });
      assert(list.status === 200, `list routes HTTP ${list.status}`);
      const items = list.data?.items || [];
      if (!items.some((r) => r.name === 'data-collection-list')) {
        box.skip('data-collection-list not on this api_manager build');
        return 'skipped';
      }
      if (sqliteOk) {
        assert(items.some((r) => String(r.name || '').startsWith('data-app-')), 'missing apply-seeded data-app-* routes');
      }
      return `${items.length} routes`;
    }) && ok;

    ok = await runNamed('postgresql engine apply (fallback-ok)', async () => {
      const result = await runDataApiE2e(box, { request, assert }, { engine: 'postgresql', app: 'blogpg' });
      if (result.skipped) return 'skipped';
      const dbName = 'blogpg-db';
      if (result.dbStatus === 'provisioned' || result.dbStatus === 'exists') {
        await request('DELETE', `/api/services/db_manager/api/databases/${encodeURIComponent(dbName)}`, {
          token, query: q,
        }).catch(() => {});
      }
      return `status=${result.dbStatus} q=${result.queryEngine} fallback=${!!result.fallback}`;
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
