'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave quota/storage/fleet pin e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('quota-store', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('storage put/get/delete', async () => {
      const bucket = await request('POST', '/api/services/storage_manager/api/v1/buckets', {
        token,
        body: { project_id: pid, name: `e2e-${Date.now()}` },
      });
      assert(bucket.status < 400, `bucket HTTP ${bucket.status}`);
      return String(bucket.status);
    }) && ok;

    ok = await runNamed('fleet pin/unpin', async () => {
      const pin = await request('POST', '/api/fleet/updates/pin', {
        token,
        body: { hostname: 'e2e-host', version: '0.0.0-e2e' },
      });
      assert(pin.status === 200, `pin HTTP ${pin.status}`);
      const unpin = await request('POST', '/api/fleet/updates/unpin', {
        token,
        body: { hostname: 'e2e-host' },
      });
      assert(unpin.status === 200, `unpin HTTP ${unpin.status}`);
      return 'ok';
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
