'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const name = `icarus-oidc-${Date.now().toString(36)}`;
  const created = await request('POST', '/api/services/auth_manager/api/v1/providers', {
    token, query: { project_id: projectId },
    body: {
      project_id: projectId,
      name,
      provider_type: 'oidc',
      issuer: 'https://example.test',
      client_id: 'icarus-e2e',
      config_json: '{}',
    },
  });
  assert([200, 201].includes(created.status), `create HTTP ${created.status}: ${JSON.stringify(created.data).slice(0, 200)}`);
  const id = created.data?.item?.id || created.data?.id;
  const listed = await request('GET', '/api/services/auth_manager/api/v1/providers', {
    token, query: { project_id: projectId },
  });
  assert(listed.status === 200, `list HTTP ${listed.status}`);
  const items = listed.data?.items || [];
  assert(items.some((p) => p.id === id || p.name === name), 'created provider missing from list');
  if (id) {
    await request('DELETE', `/api/services/auth_manager/api/v1/providers/${id}`, {
      token, query: { project_id: projectId },
    });
  }
  return name;
}

async function main() {
  console.log('Icarus T43 oauth-identity');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: OIDC provider create + list', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
