'use strict';

/**
 * E2E — AI Manager console path (setup wizard, fleet status, endpoints, deployments).
 *
 *   AEREKOS_API_URL=https://cloudapi.aerekos.com \
 *   AEREKOS_PROJECT_ID=ea370977-3aff-4c76-95a6-a0c50fd2bce7 \
 *   node e2e/ai-manager-console.js
 */

const { skipLive, request, adminToken, assert, runNamed, env } = require('./lib/icarusLive');

async function mainFlow() {
  const admin = await adminToken();
  const projectId = env('AEREKOS_PROJECT_ID') || env('E2E_PROJECT_ID');
  assert(projectId, 'AEREKOS_PROJECT_ID is required');

  const setup = await request('GET', '/api/services/ai_manager/setup', {
    token: admin,
    query: { project_id: projectId },
  });
  assert(setup.status === 200, `setup HTTP ${setup.status}: ${JSON.stringify(setup.data).slice(0, 200)}`);
  assert(setup.data?.service === 'ai_manager', 'setup missing service name');
  assert(typeof setup.data?.progress?.percent === 'number', 'setup missing progress');

  const llmStatus = await request('GET', '/api/services/ai_manager/api/v1/llm/status', { token: admin });
  assert(llmStatus.status === 200, `llm/status HTTP ${llmStatus.status}`);
  assert(llmStatus.data?.reachable === true, 'Ollama not reachable from ai_manager');

  const models = await request('GET', '/api/services/ai_manager/api/v1/llm/models', { token: admin });
  assert(models.status === 200, `llm/models HTTP ${models.status}`);
  const modelList = models.data?.models || [];
  assert(modelList.length > 0, 'no Ollama models reported');

  const embedStatus = await request('GET', '/api/services/ai_manager/api/v1/embeddings/status', { token: admin });
  assert(embedStatus.status === 200, `embeddings/status HTTP ${embedStatus.status}`);

  const providers = await request('GET', '/api/services/ai_manager/api/v1/providers', {
    token: admin,
    query: { project_id: projectId },
  });
  assert(providers.status === 200, `providers HTTP ${providers.status}`);
  const items = providers.data?.items || [];
  assert(items.length > 0, 'no project AI endpoints — run seed-local first');

  const llmEndpoint = items.find((i) => i.capability === 'llm');
  const embedEndpoint = items.find((i) => i.capability === 'embeddings');
  assert(llmEndpoint, 'missing llm endpoint');
  assert(embedEndpoint, 'missing embeddings endpoint');

  const instances = await request('GET', '/api/services/ai_manager/instances', {
    token: admin,
    query: { project_id: projectId },
  });
  assert(instances.status === 200, `instances HTTP ${instances.status}`);
  const deployed = (instances.data?.instances || []).filter((i) => i.status === 'deployed');
  assert(deployed.length > 0, 'no deployed ai_manager instance for project');
  assert(deployed[0].worker_id, 'deployment missing worker_id');
  assert(deployed[0].worker_hostname || deployed[0].worker_ip, 'deployment missing worker identity');

  const worker = await request('GET', `/api/workers/${deployed[0].worker_id}`, { token: admin });
  assert(worker.status === 200, `worker HTTP ${worker.status}`);

  const memory = await request('GET', '/api/services/ai_manager/api/v1/memory/status', {
    token: admin,
    query: { project_id: projectId },
  });
  assert(memory.status === 200 || memory.status === 403 || memory.status === 404, `memory/status unexpected ${memory.status}`);

  return `${modelList.length} models · ${items.length} endpoints · ${deployed[0].worker_hostname || deployed[0].worker_id.slice(0, 8)}`;
}

async function main() {
  console.log('AI Manager console e2e');
  if (skipLive()) {
    console.log('  skip live (set AEREKOS_API_URL / CONDUCTOR_URL)');
    process.exit(0);
  }
  const ok = await runNamed('ai_manager setup + fleet + endpoints + deployment', mainFlow);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
