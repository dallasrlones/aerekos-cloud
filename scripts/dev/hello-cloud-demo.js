#!/usr/bin/env node
'use strict';

/**
 * W17 — synthetic "hello cloud" walkthrough (no stack required).
 *
 * Prints the narrative steps operators show in demos. When CONDUCTOR_URL or
 * AEREKOS_API_URL is set, performs light API probes and optionally creates a
 * disposable project named `e2e-hello-cloud-<runId>`.
 *
 * Cleanup:
 *   HELLO_CLOUD_CLEANUP=1 node scripts/dev/hello-cloud-demo.js
 *   E2E_PROJECT_ID=<id> node e2e/cleanup-project.js
 *   node e2e/cleanup-project.js   # sweeps e2e-platform-* (not hello-cloud-* by default)
 */

const { skipLive, request, adminToken, env, conductorBase } = require('../../e2e/lib/icarusLive');
const { assertNotProdProject } = require('../../e2e/lib/prodGuard');
const { cleanupProject } = require('../../e2e/cleanup-project');

const RUN_ID = Date.now().toString(36);
const PROJECT_NAME = `e2e-hello-cloud-${RUN_ID}`;

const STEPS = [
  { n: 1, title: 'Conductor health', detail: 'GET /health — control plane up' },
  { n: 2, title: 'Admin session', detail: 'POST /api/auth/login → JWT (no placeholder secrets)' },
  { n: 3, title: 'Create demo project', detail: `POST /api/projects name=${PROJECT_NAME}` },
  { n: 4, title: 'Fleet snapshot', detail: 'GET /api/workers — at least one worker online' },
  { n: 5, title: 'Manager catalog', detail: 'GET /api/services — registry matches docs/catalog.js' },
  { n: 6, title: 'Hello probe', detail: 'GET /api/services/storage_manager/api/v1/info (any GA manager)' },
  { n: 7, title: 'Teardown', detail: 'HELLO_CLOUD_CLEANUP=1 or E2E_PROJECT_ID=… node e2e/cleanup-project.js' },
];

function section(title) {
  console.log('');
  console.log(`== ${title} ==`);
}

function printSynthetic() {
  section('Hello Cloud — synthetic demo (W17)');
  console.log('Run without a stack to rehearse the script:');
  for (const s of STEPS) {
    console.log(`  ${s.n}. ${s.title}`);
    console.log(`     ${s.detail}`);
  }
  console.log('');
  console.log('Live probes: set CONDUCTOR_URL (or AEREKOS_API_URL) and omit ICARUS_C0_SKIP_LIVE.');
  console.log('Project pattern: names prefixed e2e-hello-cloud-* are safe to delete on dev stacks.');
}

async function liveDemo() {
  section('Hello Cloud — live probes');
  const base = conductorBase();
  console.log(`  conductor: ${base}`);

  const token = await adminToken();

  const health = await request('GET', '/health');
  console.log(`  step 1: /health → HTTP ${health.status}`);

  const workers = await request('GET', '/api/workers', { token });
  const list = workers.data?.workers || workers.data || [];
  const online = Array.isArray(list)
    ? list.filter((w) => (w.status || '').toLowerCase() === 'online' || w.online === true).length
    : 0;
  console.log(`  step 4: workers → ${Array.isArray(list) ? list.length : 0} registered, ${online} online`);

  const services = await request('GET', '/api/services', { token });
  const names = (services.data?.services || []).map((s) => s.name);
  console.log(`  step 5: services → ${names.length} registered`);

  let projectId = env('E2E_PROJECT_ID') || env('AEREKOS_PROJECT_ID');
  if (!projectId && env('HELLO_CLOUD_CREATE_PROJECT') !== '0') {
    const created = await request('POST', '/api/projects', {
      token,
      body: { name: PROJECT_NAME, description: 'hello-cloud synthetic demo' },
    });
    if (created.status === 200 || created.status === 201) {
      projectId = created.data?.project?.id || created.data?.id;
      assertNotProdProject(projectId);
      console.log(`  step 3: created project ${PROJECT_NAME} → ${projectId}`);
      console.log(`  export E2E_PROJECT_ID=${projectId}  # for cleanup`);
    } else {
      console.log(`  step 3: skip create project HTTP ${created.status}`);
    }
  } else if (projectId) {
    assertNotProdProject(projectId);
    console.log(`  step 3: using existing project ${projectId}`);
  }

  const info = await request('GET', '/api/services/storage_manager/api/v1/info', {
    token,
    query: projectId ? { project_id: projectId } : undefined,
  });
  console.log(`  step 6: storage_manager /api/v1/info → HTTP ${info.status}`);

  if (env('HELLO_CLOUD_CLEANUP') === '1' && projectId) {
    await cleanupProject({ token, projectId, name: PROJECT_NAME });
    console.log(`  step 7: cleaned project ${projectId}`);
  } else if (projectId) {
    console.log('  step 7: cleanup pending — HELLO_CLOUD_CLEANUP=1 or node e2e/cleanup-project.js');
  }
}

async function main() {
  printSynthetic();
  if (skipLive()) {
    console.log('\n(skip live: no conductor URL or ICARUS_C0_SKIP_LIVE=1)');
    return;
  }
  await liveDemo();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
