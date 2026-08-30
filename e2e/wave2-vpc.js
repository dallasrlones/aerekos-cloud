'use strict';

const { skipLive, assert, runNamed } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { sdkClient } = require('./lib/sdk');

async function main() {
  console.log('Wave 2c VPC e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('wave2c', async (box) => {
    const client = sdkClient(box.token);

    ok = await runNamed('default docker network', async () => {
      const r = await client.proxy('network_manager', {
        method: 'POST',
        path: '/api/v1/networks/ensure-default',
        projectId: box.projectId,
        body: { project_id: box.projectId },
      });
      const net = r.network || r;
      assert(net && net.name === 'default', 'default network missing');
      box.track({ kind: 'network', id: net.id });
      return net.docker_network_name || net.id;
    }) && ok;

    ok = await runNamed('mint and revoke test preauth key', async () => {
      const minted = await client.proxy('network_manager', {
        method: 'POST',
        path: '/api/v1/mesh/preauth',
        projectId: box.projectId,
        body: { project_id: box.projectId, tags: ['tag:e2e'] },
      });
      assert(minted.preauth_key, 'preauth key missing');
      const rev = await client.proxy('network_manager', {
        method: 'POST',
        path: `/api/v1/mesh/preauth/${minted.id}/revoke`,
        projectId: box.projectId,
      });
      assert(rev.revoked, 'revoke failed');
      return minted.id.slice(0, 8);
    }) && ok;

    if (box.fleet.workerCount < 2) box.skip('mesh ping (workers=1)');
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
