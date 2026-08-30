'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const train = await request('POST', '/api/services/ai_manager/api/v1/lora/train', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, name: `icarus-t40-${Date.now().toString(36)}`, examples: [{ in: 'hi', out: 'hello' }] },
  });
  assert([200, 201].includes(train.status), `train HTTP ${train.status}: ${JSON.stringify(train.data).slice(0, 200)}`);
  const adapterId = train.data?.adapter?.id || train.data?.job_id;
  assert(adapterId, 'no adapter id');
  return adapterId;
}

async function main() {
  console.log('Icarus T40 lora-train');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: train adapter', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
