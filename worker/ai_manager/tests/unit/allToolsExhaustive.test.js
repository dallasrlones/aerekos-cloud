'use strict';

/**
 * Exhaustive tool-call coverage for aerekos-cloud agent surface:
 * every workspaceTools.toolSchemas() name + every connectorCatalog kind.tool.
 * Never the production project UUID.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { AgentRuntime } = require('../../api/services/AgentRuntime');
const {
  toolSchemas, openaiToolSchemas, hangoutReadSchemas, classifyTool, dangerClassify, WRITE_TOOLS, READ_TOOLS,
} = require('../../api/services/workspaceTools');
const { listKinds, getKind } = require('../../api/services/connectorCatalog');
const { forProject } = require('../../api/services/IcarusFacade');

const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const PID = 'cccccccc-dddd-4eee-8fff-000000000001';

jest.mock('../../api/services/WebSearchService', () => ({
  webSearch: async (q) => ({ ok: true, stub: false, results: [{ title: 't', url: 'https://example.com', q }] }),
  webFetch: async (url) => ({ ok: true, stub: false, url, text: 'example body', status: 200 }),
}));

function memAgents(root) {
  const agents = [];
  const settings = {
    llm_max_concurrent: 2,
    reserved_user_slots: 1,
    workspace_root: root,
    write_policy: 'ask_writes',
    write_exceptions: [],
    notify_on_ask: 'queue_only',
  };
  const pins = [];
  const messages = [];
  const asks = [];
  const work = [];
  const workers = [];
  const rolls = {};
  const audit = [];
  const timeline = [];
  let ids = 1;
  return {
    getSettings: async () => settings,
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    addMessage: async (_p, agentId, row) => { messages.push({ id: String(ids++), agent_id: agentId, ...row }); },
    listMessages: async () => messages,
    listPins: async () => pins,
    getRolls: async () => rolls,
    upsertRoll: async (_p, _a, h, body) => { rolls[h] = { horizon: h, body }; return rolls[h]; },
    createAsk: async (_p, agentId, row) => {
      const ask = {
        id: String(ids++), agent_id: agentId, status: 'open',
        options_json: JSON.stringify(row.options || []), ...row,
      };
      asks.push(ask);
      return ask;
    },
    listAsks: async () => asks,
    approve: async (_p, _a, askId, answer) => {
      const ask = asks.find((x) => x.id === askId);
      ask.status = 'answered';
      ask.answer = answer;
      return ask;
    },
    createWork: async (_p, agentId, row) => {
      const item = { id: String(ids++), agent_id: agentId, ...row };
      work.push(item);
      return item;
    },
    listWork: async () => work,
    updateWork: async (id, patch) => {
      let w = work.find((x) => x.id === id);
      if (!w) {
        w = { id, status: 'queued', title: '' };
        work.push(w);
      }
      Object.assign(w, patch || {});
      return w;
    },
    createWorker: async (_p, agentId, row) => {
      const w = { id: String(ids++), agent_id: agentId, transcript: '[]', replan_count: '0', ...row };
      workers.push(w);
      return w;
    },
    listWorkers: async () => workers,
    updateWorker: async (id, patch) => {
      const w = workers.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
      return w;
    },
    upsertBrief: async (_p, agentId, body) => {
      const row = { id: String(ids++), agent_id: agentId, status: 'submitted', ...body };
      work.push({ _brief: row });
      return row;
    },
    latestBrief: async () => {
      const hit = [...work].reverse().find((w) => w._brief);
      return hit?._brief || null;
    },
    updateBrief: async () => ({}),
    addTimeline: async (_p, agentId, row) => { timeline.push({ agent_id: agentId, ...row }); },
    listTimeline: async () => timeline,
    cancelOpenAsks: async () => {
      asks.forEach((a) => { if (a.status === 'open') a.status = 'cancelled'; });
      return { cancelled: true };
    },
    audit: async (_p, agentId, row) => { audit.push({ agent_id: agentId, ...row }); },
    notifyDone: async () => ({}),
    pulse: async () => ({
      agent: agents[0], settings,
      open_asks: asks.filter((a) => a.status === 'open'), work, workers,
      gateway: { max_concurrent: 2, in_flight: [], queued: [] },
    }),
    sendInter: async () => ({}),
    _seed(agent) { agents.push(agent); return agent; },
    _asks: asks,
    _settings: settings,
    _workers: workers,
    _work: work,
  };
}

function memPlans() {
  const plans = [];
  return {
    list: () => plans,
    ensureLoaded: async () => {},
    create: async (_p, _a, row) => {
      const plan = { id: `plan-${plans.length + 1}`, status: 'proposed', steps: [], ...row };
      plans.push(plan);
      return plan;
    },
    accept: async (id) => {
      const p = plans.find((x) => x.id === id);
      if (p) p.status = 'accepted';
      return p;
    },
    revise: async (id, note) => {
      const p = plans.find((x) => x.id === id) || plans[0];
      if (p) p.note = note;
      return p;
    },
  };
}

function memLearn() {
  return {
    propose: async () => ({ sources: [], job_id: 'learn-1' }),
    ingest: async () => ({ ok: true, ingested: 0 }),
  };
}

function toolArgs(name, ctx) {
  const { root, planId, taskId, prId, workerId } = ctx;
  const map = {
    file_read: { path: 'seed.txt' },
    file_list: { path: '.' },
    file_search: { query: 'seed', path: '.' },
    grep: { pattern: 'hello', path: '.' },
    file_write: { path: 'out/write.txt', content: 'written' },
    file_edit: { path: 'seed.txt', old: 'hello', new: 'hello-edited' },
    file_delete: { path: 'tmp-del.txt' },
    shell: { cmd: 'echo ok-shell' },
    git_status: {},
    git_diff: {},
    git_log: {},
    git_commit: { message: 'test commit', path: 'out/write.txt' },
    git_push: { branch: 'icarus/tools-test' },
    git_checkout: { branch: 'icarus/tools-test' },
    web_search: { q: 'aerekos icarus' },
    web_fetch: { url: 'https://example.com' },
    semantic_search: { query: 'plan graph' },
    file_rollback: { path: 'seed.txt', content: 'hello\n' },
    browser_navigate: { url: 'https://example.com' },
    browser_snapshot: {},
    browser_screenshot: {},
    browser_click: { selector: 'Example' },
    browser_type: { text: 'hi', selector: 'input' },
    browser_press: { key: 'Enter' },
    browser_select: { selector: 'select', value: 'a' },
    open_pr: {
      title: 'tools test', summary: 'exhaustive', files: ['seed.txt'],
      diff: 'diff --git a/seed.txt b/seed.txt\n+hello\n', branch: 'icarus/tools-test',
    },
    approve_pr: { pr_id: prId },
    lora_propose: {
      agent_kind: 'coding', base_model: 'qwen', adapter_name: 'coding-qwen-tools',
      dataset_preview: 'file_read examples',
    },
    plan_query: { cypher: 'MATCH (p:Plan) RETURN p LIMIT 5' },
    plan_ready: { plan_id: planId },
    plan_subgraph: { plan_id: planId },
    explain_why: { task_id: taskId },
    ui_navigate: { path: '/agents', note: 'open agents' },
    project_create: { name: 'demo', template: 'blank' },
    iac_schema: {},
    iac_put: { stack: { kind: 'project-stack', wanted: ['queue_manager'] } },
    iac_diff: {},
    iac_apply: {},
    iac_rollback: {},
    'connector.invoke': { connector: 'http-demo', tool: 'request', args: { method: 'GET', url: 'https://example.com' } },
    report_manager: { tried: 'file_read', error: 'none' },
    preview: { type: 'folder', path: 'out', name: 'out', why: 'test' },
    propose_deploy: { target: 'frontend' },
    submit_brief: { goal: 'ship tools test', done_when: 'green', constraints: 'no prod', client_words: 'test tools' },
    update_brief: { goal: 'ship tools test v2', done_when: 'green', unknowns: '' },
    open_ask: { text: 'Need a choice?', kind: 'choice', options: ['A', 'B', 'Other'] },
    open_plan_q: { text: 'Which slice first?', options: ['A', 'B'] },
    propose_plan: { steps: '1) inventory\n2) test\n3) report', origin: 'finish all e2e tests for tools' },
    revise_plan: { note: 'narrow to unit tools only' },
    learn_propose: { sources: 'https://example.com/docs' },
    learn_ingest: { job_id: 'learn-1' },
    spawn_worker: { persona: 'dev', objective: 'edit out/', claim: 'out' },
    update_work: { work_id: 'work-1', status: 'running', title: 'tools chunk' },
    replan_worker: { worker_id: workerId, note: 'retry after checks' },
    report_user: { text: 'Pick a path', options: ['Continue', 'Stop', 'Other'] },
    run_checks: { claim: '.' },
    aerekos_status: {},
    aerekos_search_docs: { q: 'data api' },
    aerekos_call: { manager: 'api_manager', method: 'GET', path: '/api/v1/info' },
    rag_ingest: { text: 'platform docs chunk', collection: 'icarus-knowledge' },
    data_api_apply: { name: 'demo', document: { models: { Item: { fields: { name: 'string' } } } } },
    project_services: {},
  };
  void root;
  if (!map[name]) throw new Error(`no args fixture for ${name}`);
  return map[name];
}

function outcomeOk(out, name) {
  if (!out || typeof out !== 'object') return false;
  const blob = JSON.stringify(out);
  if (/unknown tool/.test(blob)) return false;
  // pending ASK is a valid tool outcome
  if (out.pending === true && out.ask) return true;
  if (out.result && out.result.denied) return true;
  if (out.result && out.result.ok === false && out.result.error && !/unknown tool/.test(out.result.error)) {
    // e.g. proxy down, needs adapter, browser_down — tool path ran
    return true;
  }
  if (out.result && (out.result.ok === true || out.result.ok === false || out.result.stub === false)) return true;
  if (out.ask) return true;
  if (out.review || out.pr_id || out.merged != null) return true;
  // propose_plan / open_plan_q return plan start shapes
  if (out.plan || out.steps || out.question || out.accepted != null) return true;
  if (name === 'run_checks' && (out.result?.passed === false || out.result?.ok === false || out.result?.ok === true)) {
    return true;
  }
  return Boolean(out.result || out.ask || out.pending != null);
}

describe('allToolsExhaustive', () => {
  let root;
  let agents;
  let runtime;
  let planId;
  let taskId;
  let prId;
  let workerId;

  beforeAll(async () => {
    expect(PID).not.toBe(FORBIDDEN);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-tools-'));
    fs.writeFileSync(path.join(root, 'seed.txt'), 'hello\n');
    fs.writeFileSync(path.join(root, 'tmp-del.txt'), 'bye\n');
    fs.mkdirSync(path.join(root, 'out'), { recursive: true });
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'tools@test.local'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Tools Test'], { cwd: root });
    execFileSync('git', ['add', 'seed.txt'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: root });
    execFileSync('git', ['checkout', '-b', 'icarus/tools-test'], { cwd: root });

    agents = memAgents(root);
    agents._seed({
      id: 'ag-tools',
      name: 'tools',
      mode: 'agent',
      intelligence: 'icarus-worker',
      options: { lane_intelligence: { user: 'u', manager: 'm', review: 'r', coding: 'c' } },
    });

    const connectors = {
      list: async () => [{ name: 'http-demo', kind: 'generic-http', status: 'connected', options: { endpoint: 'https://example.com' } }],
      invoke: async (_p, body) => ({
        ok: true,
        connector: body.connector,
        tool: body.tool,
        kind: 'generic-http',
        status: 200,
        body: 'mocked',
        write: false,
      }),
    };

    runtime = new AgentRuntime({
      agents,
      connectors,
      jobs: { submit: async () => ({ id: 'job-tools', status: 'queued' }) },
      plans: memPlans(),
      learn: memLearn(),
    });
    // Patch plan/learn start helpers used by propose_plan / learn_*
    runtime._startPlan = async () => ({ plan: { id: 'plan-ui', status: 'proposed', steps: [{ id: 's1' }] }, pending: true });
    runtime._revisePlanFromChat = async () => ({ plan: { id: 'plan-ui', status: 'proposed' }, revised: true });
    runtime._startLearnAsk = async () => ({
      ask: await agents.createAsk(PID, 'ag-tools', {
        text: 'Learn these sources?', options: ['Ingest', 'Skip'], kind: 'learn',
      }),
      pending: true,
    });
    runtime._ingestLearn = async () => ({ result: { ok: true, ingested: 1 }, pending: false });
    const realRun = runtime._runTool.bind(runtime);
    runtime._runTool = async (name, args, settings, projectId, persona) => {
      if (name === 'run_checks') {
        return { ok: true, passed: true, stdout: 'PASS tools exhaustive (stub)' };
      }
      return realRun(name, args, settings, projectId, persona);
    };

    const icarus = forProject(PID, agents._settings);
    await icarus.boot();
    const plan = await icarus.graph.createPlan({ title: 'tools-plan' });
    planId = plan.id;
    const task = await icarus.graph.addTask(planId, { title: 't1', status: 'ready' });
    taskId = task.id;
    const pr = icarus.prReviews.openFromWorker({
      projectId: PID,
      agent: agents._seed ? await agents.resolve(PID, 'ag-tools') : { id: 'ag-tools' },
      workerId: 'w0',
      title: 'preseed',
      summary: 'for approve_pr',
      files: ['seed.txt'],
      diff: 'diff --git a/seed.txt\n+x\n',
      branch: 'icarus/tools-test',
      taskId,
    });
    prId = pr.id;
    const w = await agents.createWorker(PID, 'ag-tools', {
      persona: 'dev', objective: 'seed', claim_prefix: 'out', status: 'queued',
    });
    workerId = w.id;

    // Accept a chat plan so submit_brief can pass when needsPlan
    await runtime.plans.create(PID, 'ag-tools', { status: 'accepted', steps: [{ id: 's1' }] });
  });

  afterAll(() => {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* */ }
  });

  test('schema inventory is non-empty and openai/hangout projections work', () => {
    const names = toolSchemas().map((t) => t.name);
    expect(names.length).toBeGreaterThan(40);
    expect(new Set(names).size).toBe(names.length);
    const oai = openaiToolSchemas();
    expect(oai.every((t) => t.type === 'function' && t.function.name)).toBe(true);
    const hang = hangoutReadSchemas();
    const hangNames = hang.map((t) => t.function.name).sort();
    expect(hangNames).toEqual(expect.arrayContaining([
      'file_list', 'file_read', 'file_search', 'grep', 'semantic_search',
      'aerekos_status', 'aerekos_search_docs', 'iac_schema', 'iac_diff',
    ]));
    expect(hangNames).not.toContain('approve_pr');
    expect(hangNames).not.toContain('iac_apply');
    for (const n of names) {
      expect(['read', 'write', 'other']).toContain(classifyTool(n));
      expect(dangerClassify(n, {}).level).toBeTruthy();
    }
    expect(WRITE_TOOLS.size).toBeGreaterThan(5);
    expect(READ_TOOLS.size).toBeGreaterThan(5);
  });

  test.each(toolSchemas().map((t) => [t.name]))('tool %s responds without unknown', async (name) => {
    // Restore seed content when editing repeatedly
    if (name === 'file_edit' || name === 'file_rollback') {
      fs.writeFileSync(path.join(root, 'seed.txt'), 'hello\n');
    }
    if (name === 'file_delete') {
      fs.writeFileSync(path.join(root, 'tmp-del.txt'), 'bye\n');
    }
    if (name === 'git_commit') {
      fs.writeFileSync(path.join(root, 'out/write.txt'), `commit-me-${Date.now()}\n`);
    }

    const args = toolArgs(name, { root, planId, taskId, prId, workerId });
    const approved = [
      'file_write', 'file_edit', 'file_delete', 'file_rollback', 'shell',
      'git_commit', 'git_checkout', 'run_checks', 'open_pr',
    ].includes(name);

    let out;
    try {
      out = await runtime.executeApprovedTool(PID, 'ag-tools', {
        name,
        args,
        actor: name === 'spawn_worker' || name === 'replan_worker' || name === 'approve_pr' || name === 'report_user'
          ? 'manager'
          : 'user',
        approved,
        persona: 'dev',
        mode: 'agent',
        claim: 'out',
        goal: 'exercise every tool',
        workerId: name === 'replan_worker' ? workerId : '',
        preview: { type: 'folder', path: 'out', name: 'out' },
        branch: 'icarus/tools-test',
        chunkGrant: name === 'learn_ingest' ? 'learn' : '',
      });
    } catch (e) {
      // deny throws 403 for some danger paths — still a handled tool
      if (e.status === 403 || e.status === 409) {
        out = { result: { ok: false, denied: true, error: e.message }, pending: false };
      } else {
        throw e;
      }
    }

    expect(outcomeOk(out, name)).toBe(true);
    expect(JSON.stringify(out)).not.toMatch(/unknown tool/);
  });

  test('every connector kind×tool is catalogued and invoke path is exercised', async () => {
    const kinds = listKinds();
    expect(kinds.length).toBeGreaterThanOrEqual(6);
    const results = [];
    for (const kind of kinds) {
      const k = getKind(kind.name);
      expect(k.tools.length).toBeGreaterThan(0);
      for (const tool of k.tools) {
        const out = await runtime.executeApprovedTool(PID, 'ag-tools', {
          name: 'connector.invoke',
          args: {
            connector: 'http-demo',
            tool: tool.name,
            args: { method: tool.write ? 'POST' : 'GET', url: 'https://example.com', body: {} },
          },
          actor: 'user',
          approved: true,
          persona: 'dev',
          mode: 'agent',
          claim: 'out',
          preview: { type: 'folder', path: 'out' },
        });
        expect(JSON.stringify(out)).not.toMatch(/unknown tool/);
        expect(outcomeOk(out, 'connector.invoke')).toBe(true);
        results.push({ kind: kind.name, tool: tool.name, ok: true });
      }
    }
    expect(results.length).toBe(kinds.reduce((n, k) => n + k.tools.length, 0));
  });

  test('prod UUID never appears in tool fixtures', () => {
    for (const t of toolSchemas()) {
      const args = toolArgs(t.name, { root, planId, taskId, prId, workerId });
      expect(JSON.stringify(args)).not.toContain(FORBIDDEN);
    }
    expect(PID).not.toBe(FORBIDDEN);
  });
});
