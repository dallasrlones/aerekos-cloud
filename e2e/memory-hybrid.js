'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const runId = `t27-${Date.now().toString(36)}`;
  const user = 'icarus-t27';
  const session = `sess-${runId}`;
  await request('PUT', '/api/services/ai_manager/api/v1/memory/config', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, store_name_prefix: runId, data_worker_id: 'local' },
  });
  await request('POST', '/api/services/ai_manager/api/v1/memory/setup', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, config: { store_name_prefix: runId, data_worker_id: 'local' } },
  });
  const ingest = await request('POST', '/api/services/ai_manager/api/v1/memory/ingest', {
    token, query: { project_id: projectId },
    body: {
      project_id: projectId, user_id: user, session_id: session, message_id: `msg-${runId}`,
      role: 'user', content: 'Remember I always prefer morning workouts at 6am', seq: 1,
    },
  });
  assert(ingest.status === 200, `ingest HTTP ${ingest.status}: ${JSON.stringify(ingest.data).slice(0, 200)}`);
  const promote = await request('POST', '/api/services/ai_manager/api/v1/memory/promote', {
    token, query: { project_id: projectId }, body: { project_id: projectId, user_id: user, session_id: session },
  });
  assert(promote.status === 200, `promote HTTP ${promote.status}: ${JSON.stringify(promote.data).slice(0, 200)}`);
  const hybrid = await request('POST', '/api/services/ai_manager/api/v1/memory/search', {
    token, query: { project_id: projectId },
    body: {
      project_id: projectId, user_id: user, session_id: session,
      query_text: 'workout time', top_k: 5, short_term: true, long_term: true,
    },
  });
  assert(hybrid.status === 200, `hybrid search HTTP ${hybrid.status}`);
  assert(hybrid.data && (hybrid.data.short_term || hybrid.data.long_term || hybrid.data.items), 'hybrid missing tiers');
  return runId;
}

async function main() {
  console.log('Icarus T27 memory-hybrid');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: ingest + promote + hybrid retrieve', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
