'use strict';

/**
 * Contract e2e for Icarus agents. Uses in-memory fakes — never the
 * production project ea370977-3aff-4c76-95a6-a0c50fd2bce7.
 */

const { AgentRuntime } = require('../../api/services/AgentRuntime');
const { listKinds } = require('../../api/services/connectorCatalog');

const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const pid = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

function memAgents() {
  const agents = [];
  const settings = {
    llm_max_concurrent: 1,
    workspace_root: '/tmp/icarus-e2e',
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
  let ids = 1;
  return {
    getSettings: async () => settings,
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    addMessage: async (_p, agentId, row) => { messages.push({ id: String(ids++), agent_id: agentId, ...row }); },
    listMessages: async () => messages,
    completeJobMessage: async (_p, agentId, jobId, content) => {
      const hit = messages.find((m) => m.agent_id === agentId && m.job_id === jobId && m.role === 'assistant');
      if (hit) { hit.content = content; return hit; }
      const row = { id: String(ids++), agent_id: agentId, role: 'assistant', content, layer: 'user', job_id: jobId };
      messages.push(row);
      return row;
    },
    listPins: async () => pins,
    getRolls: async () => rolls,
    upsertRoll: async (_p, _a, h, body) => { rolls[h] = { horizon: h, body }; return rolls[h]; },
    createAsk: async (_p, agentId, row) => {
      const ask = { id: String(ids++), agent_id: agentId, status: 'open', options_json: JSON.stringify(row.options || []), ...row };
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
    createWorker: async (_p, agentId, row) => {
      const w = { id: String(ids++), agent_id: agentId, transcript: '[]', ...row };
      workers.push(w);
      return w;
    },
    listWorkers: async () => workers,
    updateWorker: async (id, patch) => {
      const w = workers.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
      return w;
    },
    updateWork: async (id, patch) => {
      const w = work.find((x) => x.id === id);
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
    addTimeline: async () => ({}),
    listTimeline: async () => [],
    cancelOpenAsks: async () => {
      asks.forEach((a) => { if (a.status === 'open') a.status = 'cancelled'; });
      return { cancelled: true };
    },
    audit: async (_p, agentId, row) => { audit.push({ agent_id: agentId, ...row }); },
    pulse: async () => ({ agent: agents[0], settings, open_asks: asks.filter((a) => a.status === 'open'), work, workers, gateway: { max_concurrent: 1, in_flight: [], queued: [] } }),
    _seed(agent) { agents.push(agent); return agent; },
    _asks: asks,
    _messages: messages,
    _work: work,
    _workers: workers,
    _audit: audit,
  };
}

describe('agents e2e contract', () => {
  test('forbidden project is never used', () => {
    expect(pid).not.toBe(FORBIDDEN);
    expect(String(pid).includes('ea370977')).toBe(false);
  });

  test('setup-like chat, handoff, interrupt, voice, write ASK', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag-1', name: 'icarus', type: 'icarus', mode: 'ask',
      intelligence: '', timezone: 'America/Los_Angeles', display_name: 'Icarus',
      options: '{}', user_id: 'u1', stt: '', tts: '',
    });
    const runtime = new AgentRuntime({
      agents,
      connectors: { list: async () => [], invoke: async () => ({ ok: true }) },
      jobs: { submit: async () => { throw new Error('no intel in unit e2e'); } },
    });

    const chat = await runtime.chat(pid, agent.id, { content: 'hey friend, what is going on today?' });
    expect(chat.handed_off).toBe(false);
    expect(chat.reply).toBeTruthy();
    expect(agents._messages.length).toBeGreaterThan(1);

    const hang = await runtime.chat(pid, agent.id, { content: 'how many emails did I get today from the other inbox' });
    expect(hang.handed_off).toBe(false);
    expect(hang.reply).toBeTruthy();

    agent.mode = 'plan';
    const plan = await runtime.chat(pid, agent.id, { content: 'look up rust iterators and plan a refactor' });
    expect(plan.handed_off).toBe(true);
    expect(plan.ask.kind).toBe('preview');
    expect(plan.goal_id).toBeTruthy();
    expect(agents._work.some((w) => w.kind === 'goal')).toBe(true);

    const stop = await runtime.interrupt(pid, agent.id, { content: 'stop' });
    expect(stop.stopped).toBe(true);

    const voice = await runtime.voice(pid, agent.id, { transcript: 'hello from voice' });
    expect(voice.compose).toBe(true);

    const tool = await runtime.executeApprovedTool(pid, agent.id, {
      name: 'file_write', args: { path: 'x.txt', content: 'nope' }, actor: 'test',
    });
    expect(tool.pending).toBe(true);
    expect(tool.ask).toBeTruthy();
  });

  test('worker tool loop executes tool_calls then finishes', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'icarus-loop-'));
    const agents = memAgents();
    agents.getSettings = async () => ({
      llm_max_concurrent: 1,
      workspace_root: root,
      write_policy: 'ask_writes',
      write_exceptions: [],
      notify_on_ask: 'queue_only',
      workspace_worker_id: '',
    });
    const agent = agents._seed({
      id: 'ag-2', name: 'icarus', type: 'icarus', mode: 'agent',
      intelligence: 'brain', timezone: 'America/Los_Angeles', display_name: 'Icarus',
      options: '{}', user_id: 'u1', stt: '', tts: '',
    });
    let n = 0;
    const cancelled = [];
    const runtime = new AgentRuntime({
      agents,
      connectors: { list: async () => [], invoke: async () => ({ ok: true }) },
      jobs: {
        submit: async () => ({ id: `j${n + 1}`, status: 'queued' }),
        get: async () => {
          n += 1;
          if (n === 1) {
            return {
              status: 'succeeded',
              result: { message: { tool_calls: [{ function: { name: 'file_list', arguments: '{"path":"."}' } }] } },
            };
          }
          return { status: 'succeeded', result: { message: { content: '{"success":true,"data":"listed"}' } } };
        },
        cancel: async (id) => { cancelled.push(id); },
      },
    });
    const worker = await agents.createWorker(pid, agent.id, { objective: 'list files', persona: 'dev' });
    const out = await runtime.runWorker(pid, agent.id, worker.id, { dry: false, approved: true });
    expect(out.steps.some((s) => s.tool === 'file_list' && s.result?.ok)).toBe(true);
    expect(out.steps.some((s) => s.done)).toBe(true);
    await runtime.interrupt(pid, agent.id, { content: 'stop' });
    expect(cancelled.length).toBeGreaterThan(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('user chat sends history and completes the thinking bubble', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag-3', name: 'icarus', type: 'icarus', mode: 'ask',
      intelligence: 'brain', timezone: 'America/Los_Angeles', display_name: 'Icarus',
      options: '{}', user_id: 'u1', stt: '', tts: '',
    });
    await agents.addMessage(pid, agent.id, { role: 'user', content: 'hi', layer: 'user' });
    await agents.addMessage(pid, agent.id, { role: 'assistant', content: 'hey', layer: 'user' });
    let submitted;
    const runtime = new AgentRuntime({
      agents,
      connectors: { list: async () => [] },
      jobs: { submit: async (_p, body) => { submitted = body; return { id: 'job-9', status: 'queued' }; } },
    });
    const chat = await runtime.chat(pid, agent.id, { content: 'what is going on today?' });
    expect(chat.job_id).toBe('job-9');
    expect(chat.reply).toBe('Thinking…');
    expect(agents._messages.some((m) => m.content === 'Thinking…')).toBe(false);
    expect(submitted.messages.some((m) => m.role === 'system')).toBe(true);
    expect(submitted.messages.some((m) => m.content === 'hi')).toBe(true);
    expect(submitted.messages.some((m) => m.content === 'what is going on today?')).toBe(true);
    await agents.completeJobMessage(pid, agent.id, 'job-9', 'quiet day');
    expect(agents._messages.find((m) => m.job_id === 'job-9').content).toBe('quiet day');
  });

  test('connector kinds exist for invoke ASK path', () => {
    expect(listKinds().find((k) => k.name === 'gmail')).toBeTruthy();
  });
});
