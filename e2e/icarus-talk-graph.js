'use strict';

/**
 * Sacred talk path + graph live events.
 *
 *   AEREKOS_API_URL=https://cloudapi.aerekos.com \
 *   AEREKOS_PROJECT_ID=<non-prod project> \
 *   node e2e/icarus-talk-graph.js
 */

const { skipLive, request, adminToken, assert, runNamed, env } = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

async function talkAndGraph() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID') || env('E2E_PROJECT_ID');
  assert(projectId, 'AEREKOS_PROJECT_ID is required');
  assertNotProdProject(projectId);

  const setup = await request('POST', '/api/services/ai_manager/api/v1/agents/setup', {
    token: admin,
    body: { project_id: projectId, name: 'icarus', timezone: 'America/Los_Angeles' },
  });
  assert([200, 201].includes(setup.status), `setup HTTP ${setup.status}`);
  const agent = setup.data?.agent || (await request('GET', '/api/services/ai_manager/api/v1/agents', {
    token: admin, query: { project_id: projectId },
  })).data?.items?.[0];
  assert(agent?.id, 'agent id');

  const hey = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/chat`, {
    token: admin,
    query: { project_id: projectId },
    body: { project_id: projectId, content: 'hey how are you' },
  });
  assert([200, 202].includes(hey.status), `hey chat HTTP ${hey.status}`);
  assert(hey.data?.job_id || hey.data?.reply, 'hey returns job_id or reply');
  const heyRoute = String(hey.data?.route || hey.data?.gate || hey.data?.handed_off || '').toUpperCase();
  if (heyRoute) {
    assert(!heyRoute.includes('MANAGER') || hey.data?.handed_off !== true, 'hey should prefer CHAT');
  }

  const msgs = await request('GET', `/api/services/ai_manager/api/v1/agents/${agent.id}/messages`, {
    token: admin, query: { project_id: projectId },
  });
  assert(msgs.status === 200, `messages HTTP ${msgs.status}`);
  assert((msgs.data?.items || msgs.data || []).length >= 1, 'messages persisted');

  const work = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/chat`, {
    token: admin,
    query: { project_id: projectId },
    body: {
      project_id: projectId,
      content: 'implement a tiny no-op task and plan it in the graph',
    },
  });
  assert([200, 202].includes(work.status), `do-work chat HTTP ${work.status}`);

  const plans = await request('GET', '/api/services/ai_manager/api/v1/icarus/plans', {
    token: admin, query: { project_id: projectId },
  });
  // Graph HTTP may 404 on older ai_manager images; LiveRoom allowlist is the hard gate for UI live updates.
  if (plans.status !== 200) {
    console.log(`  note: icarus plans HTTP ${plans.status} (worker may lack /icarus routes yet)`);
  }

  for (const event of ['ai:icarus.graph', 'ai:icarus.task', 'ai:icarus.tool', 'ai:icarus.bench']) {
    const liveProbe = await request('POST', '/api/live', {
      token: admin,
      body: {
        room: `ai:live:${projectId}`,
        event,
        data: { project_id: projectId, probe: true },
      },
    });
    assert(liveProbe.status !== 400, `live allowlist must accept ${event} (got ${liveProbe.status})`);
  }

  return { agentId: agent.id, heyJob: hey.data?.job_id, workJob: work.data?.job_id };
}

async function main() {
  console.log('Icarus talk + graph e2e');
  if (skipLive()) {
    console.log('  skip live (no conductor URL or ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: hey CHAT + do-work + icarus live events', talkAndGraph);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
