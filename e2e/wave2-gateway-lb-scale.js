'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 2 LB + scale e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave2lb', async (box) => {
    const client = sdkClient(box.token);

    ok = await runNamed('create intelligence + attach LB', async () => {
      const created = await client.intelligence.create(box.projectId, { name: 'e2e-lb' });
      const item = created.item || created;
      box.track({ kind: 'intelligence', id: item.id });
      const attached = await client.intelligence.attachBalancer(box.projectId, 'e2e-lb', {
        address: 'http://127.0.0.1:9',
        health_check_path: '/health',
      });
      assert(attached, 'attachBalancer failed');
      const health = await client.balancer.health(box.projectId);
      assert(typeof health.healthy_host_count === 'number', 'healthy_host_count missing');
      return String(health.healthy_host_count);
    }) && ok;

    ok = await runNamed('scale throwaway task 1→0', async () => {
      let task;
      try {
        const created = await client.compute.create(box.projectId, {
          name: 'e2e-hello',
          image: 'hello-world',
          run_mode: 'oneshot',
        });
        task = created.task || created;
      } catch (err) {
        box.skip(`compute create (${err.message})`);
        return 'skipped';
      }
      box.track({ kind: 'task', id: task.id });
      const scaled = await client.compute.scale(box.projectId, task.id, 0);
      const row = scaled.task || scaled;
      assert(row.desired === 0 || row.status === 'stopped', 'scale to 0 failed');
      await client.compute.remove(box.projectId, task.id);
      return row.status;
    }) && ok;

    if (box.fleet.workerCount < 2) box.skip('multi-replica (workers=1)');
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
