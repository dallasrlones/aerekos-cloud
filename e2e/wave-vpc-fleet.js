'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave fleet VPC e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('vpc-fleet', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('list vpcs includes fleet', async () => {
      const r = await request('GET', '/api/workers/vpcs', { token });
      assert(r.status === 200, `vpcs HTTP ${r.status}`);
      assert((r.data.vpcs || []).some((v) => v.id === 'fleet'), 'fleet vpc missing');
      return String(r.data.vpcs.length);
    }) && ok;

    ok = await runNamed('ensure-default docker network still works', async () => {
      const r = await request('POST', '/api/services/network_manager/api/v1/networks/ensure-default', {
        token,
        body: { project_id: pid },
      });
      assert(r.status < 500, `ensure-default HTTP ${r.status}`);
      return String(r.status);
    }) && ok;

    const workers = await request('GET', '/api/workers', { token });
    const list = workers.data?.workers || workers.data || [];
    const first = Array.isArray(list) && list[0];
    if (!first) {
      box.skip('no worker registered to PATCH vpc');
    } else {
      ok = await runNamed('existing worker has vpc_id', async () => {
        assert(first.vpc_id || first.vpc_id === 'fleet', 'vpc_id missing on worker');
        return first.vpc_id || 'fleet';
      }) && ok;
    }
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
