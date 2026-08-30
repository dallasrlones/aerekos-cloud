'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 2b tunnel/compute/IAM e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave2b', async (box) => {
    const client = sdkClient(box.token);

    ok = await runNamed('IAM evaluate', async () => {
      const r = await client.proxy('iam_manager', {
        method: 'POST',
        path: '/api/v1/evaluate',
        projectId: box.projectId,
        body: { project_id: box.projectId, action: 'compute:Describe', resource: '*' },
      });
      assert(r.evaluation, 'evaluation missing');
      return String(r.evaluation.allowed);
    }) && ok;

    ok = await runNamed('hostname binding to task id (no CF required)', async () => {
      const created = await client.proxy('domain_manager', {
        method: 'POST',
        path: '/api/v1/dns/hostnames',
        projectId: box.projectId,
        body: {
          project_id: box.projectId,
          hostname: `e2e-${box.runId}.example.test`,
          target_type: 'compute_task',
          target_id: 'e2e-placeholder',
          port: 80,
        },
      });
      const row = created.hostname || created.item;
      box.track({ kind: 'hostname', id: row.id });
      await client.proxy('domain_manager', {
        method: 'DELETE',
        path: `/api/v1/dns/hostnames/${row.id}`,
        projectId: box.projectId,
      });
      return row.hostname;
    }) && ok;

    try {
      await client.proxy('tunnel_manager', {
        path: `/api/v1/tunnels`,
        projectId: box.projectId,
      });
    } catch (err) {
      box.skip(`CF hostname (${err.message})`);
    }
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
