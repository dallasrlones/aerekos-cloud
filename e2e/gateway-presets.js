'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');
const { listPresets } = require('../worker/shared/gatewayPresets');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const first = await request('POST', '/api/services/api_manager/api/v1/endpoints/seed-presets', {
    token, query: { project_id: projectId }, body: { project_id: projectId },
  });
  assert(first.status === 200, `seed HTTP ${first.status}: ${JSON.stringify(first.data).slice(0, 200)}`);
  const expected = listPresets().length;
  assert(
    (first.data.created?.length || 0) + (first.data.updated?.length || 0) === expected,
    `seed count ${JSON.stringify(first.data)} != ${expected}`,
  );
  const second = await request('POST', '/api/services/api_manager/api/v1/endpoints/seed-presets', {
    token, query: { project_id: projectId }, body: { project_id: projectId },
  });
  assert(second.status === 200 && second.data.updated?.length === expected, 'second seed not idempotent');
  const list = await request('GET', '/api/services/api_manager/api/v1/endpoints', {
    token, query: { project_id: projectId },
  });
  assert(list.status === 200, `list HTTP ${list.status}`);
  const items = list.data?.items || [];
  assert(items.some((r) => r.name === 'ai-llm-chat'), 'missing ai-llm-chat preset');
  assert(items.some((r) => String(r.backend_url || r.required_scope || '').includes('ai:InvokeLlm')), 'missing InvokeLlm scope');
  return `${items.length} presets`;
}

async function main() {
  console.log('Icarus T44 gateway-presets');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: seed-presets catalog + scopes', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
