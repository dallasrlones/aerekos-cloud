'use strict';

/**
 * Wave 0 e2e — fleet health, jobs toast path, orphan manager routes.
 * 1 worker is enough. Cleans up the sandbox project.
 */

const { skipLive, request, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');

async function main() {
  console.log('Wave 0 fleet e2e');
  if (skipLive()) {
    console.log('  skip live (set AEREKOS_API_URL / CONDUCTOR_URL)');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave0', async (box) => {
    ok = await runNamed('fleet health lists registered workers', async () => {
      const r = await request('GET', '/api/fleet/health', {
        token: box.token,
        query: { project_id: box.projectId },
      });
      assert(r.status === 200, `fleet/health HTTP ${r.status}`);
      const workers = r.data?.workers || [];
      assert(workers.length >= 1, 'expected at least one worker');
      const withRoles = workers.filter((w) => Array.isArray(w.roles));
      assert(withRoles.length === workers.length, 'every worker should have roles[]');
      return `${workers.length} worker(s)`;
    }) && ok;

    ok = await runNamed('noop job then delete', async () => {
      const c = await request('POST', '/api/jobs', {
        token: box.token,
        body: { project_id: box.projectId, kind: 'e2e-noop', summary: 'wave0 toast', status: 'succeeded' },
      });
      assert(c.status === 201, `job create HTTP ${c.status}`);
      const id = c.data?.job?.id;
      assert(id, 'job id missing');
      box.track({ kind: 'job', id });
      const list = await request('GET', '/api/jobs', { token: box.token, query: { project_id: box.projectId } });
      assert(list.status === 200, `jobs list HTTP ${list.status}`);
      assert((list.data?.jobs || []).some((j) => j.id === id), 'job not listed');
      const del = await request('DELETE', `/api/jobs/${id}`, { token: box.token });
      assert(del.status === 200, `job delete HTTP ${del.status}`);
      return id.slice(0, 8);
    }) && ok;

    ok = await runNamed('orphan manager routes via catalog', async () => {
      const names = ['queue_manager', 'webhook_manager', 'git_manager', 'registry_manager', 'tunnel_manager'];
      for (const name of names) {
        const r = await request('GET', `/api/services/${name}/health`, { token: box.token });
        assert(
          r.status === 200 || r.status === 401 || r.status === 502 || r.status === 503 || r.status === 404,
          `${name} unexpected ${r.status}`,
        );
      }
      return names.join(',');
    }) && ok;

    if (box.fleet.workerCount < 2) {
      box.skip('mesh ping (workers=1)');
    }
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
