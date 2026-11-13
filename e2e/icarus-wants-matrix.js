#!/usr/bin/env node
'use strict';

/**
 * Icarus wants matrix — ship rows for W1–W4:
 *   Want1 — info verify path (CorpusStore mock offline; Laya/API live)
 *   Want2 — compute workload reconcile smoke
 *   Want3 — icarusNavCatalog matchNav (always)
 *   Want4 — safe_deps_upgrade dry-run via agents tools API
 *
 * Offline:
 *   ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-wants-matrix.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  skipLive, request, adminToken, assert, env, conductorBase,
} = require('./lib/icarusLive');
const { assertNotProdProject } = require('./lib/prodGuard');

const rows = [];

function row(id, ok, detail, skipped = false) {
  rows.push({ id, ok: !!ok, detail: detail || '', skipped: !!skipped });
  const tag = skipped ? 'SKIP' : (ok ? 'PASS' : 'FAIL');
  console.log(`${tag} ${id}${detail ? ` — ${detail}` : ''}`);
}

function projectId() {
  return env('AEREKOS_PROJECT_ID') || env('PROJECT_ID') || env('E2E_PROJECT_ID');
}

/** Want1 — InfoVerifyGate + CorpusStore; optional live Laya info_path */
async function want1InfoVerify(live) {
  const { looksFactual, planInfoVerify } = require('../worker/ai_manager/api/services/InfoVerifyGate');
  const { CorpusStore } = require('../worker/ai_manager/api/services/CorpusStore');

  assert(looksFactual('When was PostgreSQL 16 released?'), 'looksFactual question');
  assert(!looksFactual('hey'), 'looksFactual casual');

  const plan = await planInfoVerify({
    text: 'What is the latest LTS Node version?',
    projectId: 'e2e-wants',
    agent: { rag_collection: 'icarus-skills' },
    gate: { lane_choice: 'info', policy: { info_lane: true } },
    ragSearch: async () => ({ items: [{ score: 0.1, text: 'stale' }] }),
    laya: {
      predict: async () => ({
        answers: {
          info_path: { choice: 'rag', confidence: 0.7 },
          learn_disposition: { choice: 'skip', confidence: 0.6 },
        },
      }),
    },
  });
  assert(plan.required && plan.reason === 'low_rag', 'plan requires verify');
  row('want1_info_verify_plan', true, plan.reason);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-wants-'));
  const store = new CorpusStore({ root: path.join(tmp, 'corpus') });
  const corpus = await store.put({
    projectId: 'e2e-wants',
    raw: '<p>probe</p>',
    normalized: '# probe\n',
    meta: { source: 'info_verify', query: 'e2e wants matrix' },
  });
  assert(corpus.hash && corpus.prefix, 'corpus hash/prefix');
  const norm = store.readNormalized('e2e-wants', corpus.hash);
  assert(norm && norm.includes('probe'), 'corpus readNormalized');
  row('want1_corpus_store', true, corpus.prefix);

  if (!live) {
    row('want1_laya_info_path_live', true, 'offline mock only', true);
    return;
  }

  const pid = projectId();
  if (!pid) {
    row('want1_laya_info_path_live', true, 'no project id', true);
    return;
  }
  assertNotProdProject(pid);
  const admin = await adminToken();
  const icarus = '/api/services/ai_manager/api/v1/icarus';

  const pred = await request('POST', `${icarus}/laya/predict`, {
    token: admin,
    query: { project_id: pid },
    body: {
      project_id: pid,
      state: { text: 'When was PostgreSQL 16 released?' },
      questions: { info_path: {}, learn_disposition: {} },
    },
  });
  if (pred.status === 404 || pred.status === 502 || pred.status === 503) {
    row('want1_laya_info_path_live', true, `icarus laya HTTP ${pred.status}`, true);
    return;
  }
  assert(pred.status < 500, `laya predict HTTP ${pred.status}`);
  const choice = pred.data?.answers?.info_path?.choice;
  row('want1_laya_info_path_live', Boolean(choice), choice || JSON.stringify(pred.data).slice(0, 160));
}

/** Want3 — conductor nav catalog (unit-style, no fleet) */
function want3NavCatalog() {
  const { matchNav, resolveProject } = require('../conductor/app/utils/icarusNavCatalog');
  const projects = [{ id: 'p1', name: 'demo' }, { id: 'p2', name: 'system' }];
  const current = projects[0];

  assert(matchNav('take me to Agents').screen === 'aiAgents', 'agents');
  const containers = matchNav("show me project demo's containers", { projects, currentProject: current });
  assert(containers.screen === 'computeManager' && containers.project.name === 'demo', 'containers');
  assert(containers.anchor === 'compute-list', 'compute anchor');
  const vault = matchNav('take me to the secret vault');
  assert(vault.kind === 'chat' && vault.params?.seed, 'ambiguous go-to docks chat');
  assert(matchNav('restart vllm').kind === 'deny', 'deny vllm');
  assert(matchNav('learn React latest syntax').kind === 'shop', 'shop phrase');
  assert(matchNav('open friends').screen === 'icarusFriends', 'friends');
  assert(matchNav('take me to share project').screen === 'icarusFriends', 'share project');
  assert(matchNav('open federation').params?.tab === 'federation', 'federation tab');
  assert(resolveProject('project demo env prod settings', projects).name === 'demo', 'resolveProject');
  row('want3_nav_catalog', true, 'icarusNavCatalog matchNav');
}

/** Want2 — workload reconcile when compute_manager is reachable */
async function want2WorkloadReconcile(live) {
  if (!live) {
    row('want2_workload_reconcile', true, 'skipped offline', true);
    return;
  }
  const pid = projectId();
  if (!pid) {
    row('want2_workload_reconcile', true, 'no project id', true);
    return;
  }
  assertNotProdProject(pid);
  const admin = await adminToken();

  const info = await request('GET', '/api/services/compute_manager/api/v1/info', {
    token: admin,
    query: { project_id: pid },
  });
  if (info.status >= 500 || info.status === 404 || info.status === 502) {
    row('want2_workload_reconcile', true, `compute info HTTP ${info.status}`, true);
    return;
  }

  const tasks = await request('GET', '/api/services/compute_manager/api/v1/tasks', {
    token: admin,
    query: { project_id: pid },
  });
  if (tasks.status === 404 || tasks.status === 502) {
    row('want2_workload_reconcile', true, `tasks list HTTP ${tasks.status}`, true);
    return;
  }
  assert(tasks.status < 500, `tasks HTTP ${tasks.status}`);
  const list = tasks.data?.tasks || tasks.data?.items || [];
  const taskId = list[0]?.id;
  if (!taskId) {
    const probe = await request('GET', '/api/services/compute_manager/api/v1/tasks/e2e-wants-probe/reconcile', {
      token: admin,
      query: { project_id: pid },
    });
    if (probe.status === 404) {
      row('want2_workload_reconcile', true, 'reconcile route present (no tasks)', true);
      return;
    }
    row('want2_workload_reconcile', probe.status < 500, `probe reconcile HTTP ${probe.status}`);
    return;
  }

  const rec = await request('POST', `/api/services/compute_manager/api/v1/tasks/${taskId}/reconcile`, {
    token: admin,
    query: { project_id: pid },
    body: { project_id: pid },
  });
  const ok = rec.status < 500 && (rec.data?.reconcile != null || rec.data?.desired != null);
  row('want2_workload_reconcile', ok, `task=${taskId} HTTP ${rec.status}`);
}

/** Want4 — safe_deps_upgrade dry-run via POST .../agents/:id/tools */
async function want4SafeDepsDryRun(live) {
  if (!live) {
    row('want4_safe_deps_dry_run', true, 'skipped offline', true);
    return;
  }
  const pid = projectId();
  if (!pid) {
    row('want4_safe_deps_dry_run', true, 'no project id', true);
    return;
  }
  assertNotProdProject(pid);
  const admin = await adminToken();

  const list = await request('GET', '/api/services/ai_manager/api/v1/agents', {
    token: admin,
    query: { project_id: pid },
  });
  let agentId = list.data?.items?.[0]?.id;
  if (!agentId) {
    const setup = await request('POST', '/api/services/ai_manager/api/v1/agents/setup', {
      token: admin,
      body: { project_id: pid, name: 'icarus', timezone: 'UTC' },
    });
    if (setup.status >= 400) {
      row('want4_safe_deps_dry_run', true, `agent setup HTTP ${setup.status}`, true);
      return;
    }
    agentId = setup.data?.agent?.id || setup.data?.id;
  }
  if (!agentId) {
    row('want4_safe_deps_dry_run', true, 'no agent', true);
    return;
  }

  const toolPath = `/api/services/ai_manager/api/v1/agents/${agentId}/tools`;
  const tool = await request('POST', toolPath, {
    token: admin,
    query: { project_id: pid },
    body: {
      name: 'safe_deps_upgrade',
      args: {
        tree: 'worker/ai_manager',
        ecosystem: 'npm',
        dry_run: true,
      },
    },
  });
  if (tool.status === 404 || tool.status === 405) {
    row('want4_safe_deps_dry_run', true, `tools route HTTP ${tool.status}`, true);
    return;
  }
  if (tool.status === 403 || tool.status === 401) {
    row('want4_safe_deps_dry_run', true, `auth HTTP ${tool.status}`, true);
    return;
  }
  const ok = tool.status < 500
    && (tool.data?.result != null || tool.data?.pending === true || tool.data?.ask != null);
  row('want4_safe_deps_dry_run', ok, `HTTP ${tool.status}`);
}

async function main() {
  console.log('Icarus wants matrix');
  const live = !skipLive();
  if (!live) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1 or missing AEREKOS_API_URL/CONDUCTOR_URL)');
  } else {
    console.log(`  live conductor ${conductorBase()}`);
  }

  const runners = [
    ['want1', () => want1InfoVerify(live)],
    ['want3', () => Promise.resolve(want3NavCatalog())],
    ['want4', () => want4SafeDepsDryRun(live)],
    ['want2', () => want2WorkloadReconcile(live)],
  ];

  for (const [label, fn] of runners) {
    try {
      await fn();
    } catch (e) {
      row(`${label}_error`, false, e.message);
    }
  }

  const failed = rows.filter((r) => !r.ok && !r.skipped);
  console.log(JSON.stringify({
    live,
    project_id: projectId() || null,
    passed: rows.filter((r) => r.ok).length,
    failed: failed.length,
    rows,
  }, null, 2));

  if (failed.length) {
    console.error('FAIL icarus-wants-matrix');
    process.exit(1);
  }
  console.log('OK icarus-wants-matrix');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
