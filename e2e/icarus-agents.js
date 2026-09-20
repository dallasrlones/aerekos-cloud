'use strict';

/**
 * Live Icarus agents: setup, queued chat, interrupt, connector kinds.
 * Never mutates production project ea370977-3aff-4c76-95a6-a0c50fd2bce7.
 *
 *   AEREKOS_API_URL=https://cloudapi.aerekos.com \
 *   AEREKOS_PROJECT_ID=<dedicated-icarus-project> \
 *   node e2e/icarus-agents.js
 */

const { skipLive, request, adminToken, assert, runNamed, env } = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

async function live() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID') || env('E2E_PROJECT_ID');
  assert(projectId, 'AEREKOS_PROJECT_ID is required');
  assertNotProdProject(projectId);

  const status = await request('GET', '/api/services/ai_manager/api/v1/agents/setup/status', {
    token: admin, query: { project_id: projectId },
  });
  assert(status.status === 200, `setup/status HTTP ${status.status}`);
  assert(status.data?.topology?.computer === 'prod-mini', 'topology computer');
  assert(status.data?.topology?.ai === 'orin', 'topology ai');

  const setup = await request('POST', '/api/services/ai_manager/api/v1/agents/setup', {
    token: admin,
    body: { project_id: projectId, name: 'icarus-e2e', timezone: 'America/Los_Angeles' },
  });
  assert([200, 201].includes(setup.status), `setup HTTP ${setup.status}`);
  const agent = setup.data?.agent;
  assert(agent?.name === 'icarus-e2e', 'setup agent name');
  assert(String(agent?.arn || '').includes('agent:endpoint/icarus-e2e'), 'agent arn');

  const chat = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/chat`, {
    token: admin,
    query: { project_id: projectId },
    body: { project_id: projectId, content: 'hey friend, what is going on today?' },
  });
  assert(chat.status === 202, `chat HTTP ${chat.status}`);
  assert(chat.data?.reply, 'chat reply');

  const stop = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/interrupt`, {
    token: admin,
    query: { project_id: projectId },
    body: { project_id: projectId, content: 'stop' },
  });
  assert(stop.status === 200 && stop.data?.stopped === true, 'interrupt');

  const voice = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/voice`, {
    token: admin,
    query: { project_id: projectId },
    body: { project_id: projectId, transcript: 'hello from voice' },
  });
  assert(voice.status === 202 && voice.data?.compose === true, 'voice compose');

  const asks = await request('GET', `/api/services/ai_manager/api/v1/agents/${agent.id}/asks`, {
    token: admin, query: { project_id: projectId },
  });
  assert(asks.status === 200, `asks HTTP ${asks.status}`);

  const timeline = await request('GET', `/api/services/ai_manager/api/v1/agents/${agent.id}/timeline`, {
    token: admin, query: { project_id: projectId },
  });
  assert(timeline.status === 200, `timeline HTTP ${timeline.status}`);

  const kinds = await request('GET', '/api/services/ai_manager/api/v1/connectors/kinds', { token: admin });
  assert(kinds.status === 200, `kinds HTTP ${kinds.status}`);
  assert((kinds.data?.items || []).some((k) => k.name === 'gmail'), 'gmail kind');

  const tool = await request('POST', `/api/services/ai_manager/api/v1/agents/${agent.id}/tools`, {
    token: admin,
    query: { project_id: projectId },
    body: { project_id: projectId, name: 'file_write', args: { path: 'e2e.txt', content: 'nope' } },
  });
  assert(tool.status === 200 && tool.data?.pending === true, 'write ASK');

  return agent.id;
}

async function main() {
  console.log('Icarus agents e2e');
  if (skipLive()) {
    console.log('  skip live (no conductor URL or ICARUS_C0_SKIP_LIVE=1)');
    process.exit(0);
  }
  const ok = await runNamed('live: setup + chat + interrupt + connector + write ASK', live);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
