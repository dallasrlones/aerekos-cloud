'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const shop = require('../../api/services/AgentShop');
const { AgentRuntime } = require('../../api/services/AgentRuntime');
const { AgentPlanService } = require('../../api/services/AgentPlanService');
const { hangoutReadSchemas, extractToolCalls, executeTool } = require('../../api/services/workspaceTools');
const { recordConsole, CONSOLE_CAP } = require('../../api/services/browserDriver');
const Browser = require('../../api/services/BrowserSession');

const pid = 'dddddddd-eeee-4fff-8aaa-111111111111';

function memAgents() {
  const agents = [];
  const settings = {
    llm_max_concurrent: 1,
    workspace_root: '/tmp/icarus-offgrid',
    write_policy: 'ask_writes',
    write_exceptions: [],
    notify_on_ask: 'queue_only',
    workspace_worker_id: '',
  };
  const messages = [];
  const asks = [];
  const work = [];
  const workers = [];
  const briefs = [];
  const timeline = [];
  let ids = 1;
  return {
    getSettings: async () => settings,
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    addMessage: async (_p, agentId, row) => { messages.push({ id: String(ids++), agent_id: agentId, ...row }); },
    listMessages: async () => messages,
    listPins: async () => [],
    getRolls: async () => ({}),
    createAsk: async (_p, agentId, row) => {
      const ask = {
        id: String(ids++), agent_id: agentId, status: 'open',
        options_json: JSON.stringify(row.options || ['Yes', 'No', 'Other']),
        ...row,
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
    cancelOpenAsks: async () => {
      asks.forEach((a) => { if (a.status === 'open') a.status = 'cancelled'; });
      return { cancelled: true };
    },
    createWork: async (_p, agentId, row) => {
      const item = { id: String(ids++), agent_id: agentId, ...row };
      work.push(item);
      return item;
    },
    listWork: async () => work,
    createWorker: async (_p, agentId, row) => {
      const w = {
        id: String(ids++), agent_id: agentId, transcript: '[]', messages_json: '[]',
        retry_count: '0', replan_count: '0', ...row,
      };
      workers.push(w);
      return w;
    },
    listWorkers: async () => workers,
    updateWorker: async (id, patch) => {
      const w = workers.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
      return w;
    },
    shopBoard: async () => shop.shopBoard({ work, workers, asks }),
    notifyAsk: async () => ({ queued: true }),
    notifyDone: async () => ({ queued: true }),
    upsertBrief: async (_p, agentId, body) => {
      const row = { id: String(ids++), agent_id: agentId, status: 'submitted', ...body };
      briefs.push(row);
      return row;
    },
    latestBrief: async () => briefs[briefs.length - 1] || null,
    updateBrief: async (id, patch) => {
      const b = briefs.find((x) => x.id === id);
      if (b) Object.assign(b, patch);
      return b;
    },
    addTimeline: async (_p, agentId, row) => {
      timeline.push({ id: String(ids++), agent_id: agentId, at: new Date().toISOString(), ...row });
    },
    listTimeline: async () => timeline,
    audit: async () => ({}),
    pulse: async () => ({ open_asks: asks.filter((a) => a.status === 'open'), work, workers }),
    list: async () => agents,
    _seed(agent) { agents.push(agent); return agent; },
    _work: work,
    _messages: messages,
    _timeline: timeline,
    _workers: workers,
  };
}

describe('offgrid icarus', () => {
  test('resolveTarget phrases', () => {
    expect(shop.resolveTarget('can you see your own codebase').kind).toBe('self');
    expect(shop.resolveTarget('update yourself').claim).toBe(shop.SELF_CLAIM);
    expect(shop.resolveTarget('fix aerekos-cloud control plane').kind).toBe('cloud');
    expect(shop.resolveTarget('this project needs a fix', {
      projectId: 'abc', projectName: 'demo',
    }).kind).toBe('project');
    expect(shop.speakPreview({
      type: 'other', target_kind: 'self', target_label: 'Icarus on aerekos-cloud',
    })).toMatch(/Edit Icarus on aerekos-cloud/);
    expect(shop.parseRelationships({ related: ['a'], blocks: ['b'] })).toEqual({
      related: ['a'], blocks: ['b'], blocked_by: [],
    });
  });

  test('hangout answers can you see your own codebase without LLM', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag', name: 'icarus', mode: 'ask', intelligence: '', options: {},
      display_name: 'Icarus', timezone: 'America/Los_Angeles',
    });
    const runtime = new AgentRuntime({
      agents,
      jobs: { submit: async () => { throw new Error('must not call llm'); } },
    });
    const out = await runtime.chat(pid, agent.id, { content: 'Can you see your own codebase?' });
    expect(out.reply).toMatch(/Yes\. I'm Icarus/);
    expect(out.reply).toMatch(/ai_manager/);
    expect(out.job_id).toBeFalsy();
  });

  test('hangout read tools on self path only', () => {
    const names = hangoutReadSchemas().map((t) => t.function.name);
    expect(names).toEqual(expect.arrayContaining(['file_read', 'file_list', 'grep', 'semantic_search']));
    expect(names).not.toContain('file_write');
    expect(names).not.toContain('shell');
  });

  test('hangout read tools execute under the claim', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hangout-'));
    fs.writeFileSync(path.join(root, 'AgentRuntime.js'), 'module.exports = {}');
    const listed = executeTool('file_list', { path: '.' }, { root, persona: 'research' });
    expect(listed.entries).toContain('AgentRuntime.js');
    const read = executeTool('file_read', { path: 'AgentRuntime.js' }, { root, persona: 'research' });
    expect(read.content).toMatch(/module.exports/);
    expect(shop.pathUnderClaim('aerekos/aerekos-cloud/worker/ai_manager/x.js', shop.SELF_CLAIM)).toBe(true);
    expect(shop.pathUnderClaim('other/repo/x.js', shop.SELF_CLAIM)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('plan accept links work, subtasks, and related', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {},
    });
    const runtime = new AgentRuntime({
      agents,
      plans: new AgentPlanService({ memory: true }),
      jobs: { submit: async () => { throw new Error('no llm'); } },
    });
    const plan = await runtime.plans.create(pid, agent.id, {
      origin: 'ship the board',
      status: 'proposed',
      steps: [
        { id: 's1', title: 'Parent task', kind: 'code', status: 'queued' },
        { id: 's2', title: 'Subtask', kind: 'code', status: 'queued', parent_id: 's1' },
      ],
    });
    runtime.runManager = async () => ({ ask: null, goal_id: 'skip', task_id: 'skip' });
    await runtime._answerPlan(pid, agent, { id: 'ask1' }, 'Run it', { plan_id: plan.id }, true);
    const work = agents._work;
    const goal = work.find((w) => w.kind === 'goal');
    const parent = work.find((w) => w.title === 'Parent task');
    const sub = work.find((w) => w.title === 'Subtask');
    expect(goal.payload.plan_id).toBe(plan.id);
    expect(parent.parent_id).toBe(goal.id);
    expect(sub.parent_id).toBe(parent.id);
    expect(parent.payload.step_id).toBe('s1');
    expect(shop.parseRelationships(sub.relationships).related).toContain(parent.id);
    expect(runtime.plans.get(pid, agent.id, plan.id).status).toBe('accepted');
    expect(runtime.plans.list(pid, agent.id)).toHaveLength(1);
  });

  test('rollback restores checkpoint on failed checks', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {},
    });
    await agents.createWorker(pid, agent.id, { id: 'w1', persona: 'dev', replan_count: '0' });
    const runtime = new AgentRuntime({
      agents,
      jobs: { submit: async () => { throw new Error('no'); } },
    });
    const calls = [];
    runtime._runTool = async (name, args) => {
      calls.push({ name, args });
      if (name === 'git_checkout') return { ok: true };
      if (name === 'shell') return { ok: true, stdout: 'abc123\n' };
      if (name === 'file_write') {
        return { ok: true, path: 'aerekos/aerekos-cloud/worker/ai_manager/x.js', snapshot: { content: 'old' } };
      }
      if (name === 'run_checks') return { ok: false, passed: false, stdout: 'FAIL' };
      if (name === 'file_rollback') return { ok: true, rolled_back: true };
      return { ok: true };
    };
    const out = await runtime.executeApprovedTool(pid, agent.id, {
      name: 'file_write',
      args: { path: 'aerekos/aerekos-cloud/worker/ai_manager/x.js', content: 'new' },
      actor: 'worker:w1',
      approved: true,
      persona: 'dev',
      chunkGrant: 'ask1',
      mode: 'agent',
      claim: shop.SELF_CLAIM,
      workerId: 'w1',
      preview: { type: 'other', claim: shop.SELF_CLAIM },
    });
    expect(out.result.rolled_back).toBe(true);
    expect(calls.some((c) => c.name === 'file_rollback')).toBe(true);
    expect(calls.some((c) => c.name === 'run_checks')).toBe(true);
  });

  test('browserDriver console ring and session buffer', () => {
    let buf = [];
    for (let i = 0; i < CONSOLE_CAP + 5; i++) buf = recordConsole(buf, { type: 'error', text: `e${i}`, url: '/' });
    expect(buf).toHaveLength(CONSOLE_CAP);
    expect(buf[0].text).toBe('e5');
    Browser.putConsole(pid, 'ag', [{ type: 'pageerror', text: 'boom', url: 'https://x' }]);
    const listed = Browser.listConsole(pid, 'ag');
    expect(listed[listed.length - 1].text).toBe('boom');
  });

  test('extractToolCalls still parses hangout reads', () => {
    const calls = extractToolCalls({
      message: { tool_calls: [{ function: { name: 'file_read', arguments: '{"path":"AgentRuntime.js"}' } }] },
    });
    expect(calls[0]).toEqual({ name: 'file_read', args: { path: 'AgentRuntime.js' } });
  });
});
