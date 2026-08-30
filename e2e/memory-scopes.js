'use strict';
const { skipLive, request, adminToken, mintAppToken, env, assert, runNamed } = require('./lib/icarusLive');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID');
  const token = await mintAppToken(admin, projectId);
  const runId = `t26-${Date.now().toString(36)}`;
  const user = 'icarus-t26';
  const session = `sess-${runId}`;
  const cfg = await request('PUT', '/api/services/ai_manager/api/v1/memory/config', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, store_name_prefix: runId, data_worker_id: 'local', window_size: 50 },
  });
  assert(cfg.status === 200, `config HTTP ${cfg.status}: ${JSON.stringify(cfg.data).slice(0, 180)}`);
  const setup = await request('POST', '/api/services/ai_manager/api/v1/memory/setup', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, config: { store_name_prefix: runId, data_worker_id: 'local', window_size: 50 } },
  });
  assert([200, 201, 409].includes(setup.status), `setup HTTP ${setup.status}: ${JSON.stringify(setup.data).slice(0, 180)}`);
  const ingest = await request('POST', '/api/services/ai_manager/api/v1/memory/ingest', {
    token, query: { project_id: projectId },
    body: {
      project_id: projectId, user_id: user, session_id: session, message_id: `msg-${runId}`,
      role: 'user', content: 'Remember I prefer morning workouts at 6am', seq: 1,
    },
  });
  assert(ingest.status === 200, `ingest HTTP ${ingest.status}: ${JSON.stringify(ingest.data).slice(0, 200)}`);
  const search = await request('POST', '/api/services/ai_manager/api/v1/memory/search', {
    token, query: { project_id: projectId },
    body: { project_id: projectId, user_id: user, session_id: session, query_text: 'workout', top_k: 5, short_term: true },
  });
  assert(search.status === 200, `search HTTP ${search.status}`);
  const del = await request('DELETE', `/api/services/ai_manager/api/v1/memory/sessions/${session}`, {
    token, query: { project_id: projectId },
  });
  assert(del.status === 200 && del.data?.deleted, `delete HTTP ${del.status}: ${JSON.stringify(del.data).slice(0, 160)}`);
  return runId;
}

async function main() {
  console.log('Icarus T26 memory-scopes');
  if (skipLive()) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: ingest + search + delete session', live);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
