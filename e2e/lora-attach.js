'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const train = await request('POST', '/api/services/ai_manager/api/v1/lora/train', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, name: `icarus-t40-attach-${Date.now().toString(36)}` },
  });
  assert([200, 201].includes(train.status), `train HTTP ${train.status}`);
  const adapterId = train.data?.adapter?.id || train.data?.job_id;
  const attach = await request('POST', '/api/services/ai_manager/api/v1/lora/attach', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, adapter_id: adapterId },
  });
  assert(attach.status === 200 && attach.data?.attached, `attach HTTP ${attach.status}: ${JSON.stringify(attach.data).slice(0, 180)}`);
  return adapterId;
}

async function main() {
  console.log('Icarus T40 lora-attach');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: attach adapter', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
