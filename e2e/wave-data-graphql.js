'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave data/graphql e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('data-gql', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('graphql compile/defaults hits data api', async () => {
      await request('POST', '/api/setup/enable', {
        token,
        body: { project_id: pid, service: 'graphql_manager', with_dependencies: true, defaults: true },
        timeoutMs: 180000,
      }).catch(() => {});
      const compiled = await request('POST', '/api/services/graphql_manager/api/v1/compile', {
        token,
        body: {
          project_id: pid,
          name: 'app',
          models: {
            User: { fields: { name: 'string' } },
            Post: { fields: { title: 'string' } },
          },
        },
        timeoutMs: 120000,
      });
      assert(compiled.status < 500, `compile HTTP ${compiled.status}`);
      const exec = await request('POST', '/api/services/graphql_manager/api/v1/execute', {
        token,
        body: { project_id: pid, query: '{ users { id } }' },
        timeoutMs: 120000,
      });
      if (exec.status === 404 && /data api not found/i.test(JSON.stringify(exec.data))) {
        throw new Error('data api not found: app — GraphQL defaults did not apply');
      }
      assert(exec.status < 500, `execute HTTP ${exec.status}: ${JSON.stringify(exec.data).slice(0, 160)}`);
      return String(exec.status);
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
