'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 2 registry e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave2a', async (box) => {
    const client = sdkClient(box.token);
    ok = await runNamed('inventory on worker', async () => {
      const r = await client.proxy('registry_manager', {
        path: '/api/v1/inventory',
        projectId: box.projectId,
      });
      assert(r && Array.isArray(r.images), 'inventory.images missing');
      return `${r.images.length} images`;
    }) && ok;

    ok = await runNamed('wanted CRUD', async () => {
      const created = await client.proxy('registry_manager', {
        method: 'POST',
        path: '/api/v1/wanted',
        projectId: box.projectId,
        body: { project_id: box.projectId, name: 'e2e-hello', upstream: 'library/hello-world:latest' },
      });
      const item = created.item || created;
      box.track({ kind: 'wanted', id: item.id });
      await client.proxy('registry_manager', {
        method: 'DELETE',
        path: `/api/v1/wanted/${item.id}`,
        projectId: box.projectId,
      });
      return item.id.slice(0, 8);
    }) && ok;

    if ((box.fleet.arches && box.fleet.arches.size < 2) || box.fleet.workerCount < 2) {
      box.skip('per-arch deploy registry (single arch fleet)');
    }
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
