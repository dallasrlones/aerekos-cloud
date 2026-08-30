'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 3 stack/cicd e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave3', async (box) => {
    const client = sdkClient(box.token);
    const pid = box.projectId;

    ok = await runNamed('PUT stack then diff/apply/drift/rollback', async () => {
      await client.put(`/api/projects/${pid}/stack`, {
        kind: 'project-stack',
        compute: [{ name: 'e2e-hello', desired: 1 }],
        hostnames: [],
        load_balancers: [],
      });
      const diff = await client.post(`/api/projects/${pid}/stack/diff`, {});
      assert(diff && typeof diff.changed === 'boolean', 'diff missing');
      const applied = await client.post(`/api/projects/${pid}/stack/apply`, {});
      assert(applied.revision >= 1, 'apply revision');
      const drift = await client.get(`/api/projects/${pid}/stack/drift`);
      assert(typeof drift.drifted === 'boolean', 'drift missing');
      await client.post(`/api/projects/${pid}/stack/rollback`, {});
      const proposed = await client.post(`/api/projects/${pid}/stack/propose`, { prompt: 'noop' });
      assert(proposed.auto_apply === false, 'propose must not auto-apply');
      return String(applied.revision);
    }) && ok;

    ok = await runNamed('cicd apply-stack run', async () => {
      const pipe = await client.proxy('cicd_manager', {
        method: 'POST',
        path: '/api/v1/pipelines',
        projectId: pid,
        body: { project_id: pid, name: 'e2e-pipe', steps_json: '["apply-stack","compute-up"]' },
      });
      const item = pipe.item || pipe;
      box.track({ kind: 'pipeline', id: item.id });
      const ran = await client.proxy('cicd_manager', {
        method: 'POST',
        path: `/api/v1/pipelines/${item.id}/run`,
        projectId: pid,
        body: { action: 'apply-stack' },
      });
      assert(ran.ok, 'pipeline run failed');
      return item.id.slice(0, 8);
    }) && ok;

    if (box.fleet.workerCount < 2) box.skip('anti-affinity / reschedule-on-death (workers=1)');
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
