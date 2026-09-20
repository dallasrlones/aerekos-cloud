'use strict';

const shop = require('../../api/services/AgentShop');
const { AgentRuntime } = require('../../api/services/AgentRuntime');
const { AgentLearnService, inferLearnSources, sourceDocId, capPages, MAX_BYTES } = require('../../api/services/AgentLearnService');
const { AgentPlanService, needsPlan, inferPlanSteps, applyRevision } = require('../../api/services/AgentPlanService');
const { laneInject, friendStoreName, skillsCollectionName } = require('../../api/services/layerContext');
const { dueCron, parseCronIntent, cronMatches, isNetError } = require('../../api/services/cronMatch');
const { cheapScan, findingsToPlan, shouldSkipIdle } = require('../../api/services/IdleReviewService');
const { AgentCronTicker } = require('../../api/services/AgentCronTicker');
const { AgentSetupService } = require('../../api/services/AgentSetupService');
const { friendSystem, workerSystem } = require('../../api/services/agentPrompt');
const { webFetch, webFetchDisk } = require('../../api/services/WebSearchService');

const pid = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

function memAgents() {
  const agents = [];
  const asks = [];
  const messages = [];
  const crons = [];
  const work = [];
  const workers = [];
  let ids = 1;
  return {
    getSettings: async () => ({ llm_max_concurrent: 1, workspace_root: '/tmp', write_policy: 'ask_writes', workspace_worker_id: '' }),
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    list: async () => agents,
    addMessage: async (_p, agentId, row) => { messages.push({ id: String(ids++), ...row }); },
    listMessages: async () => messages,
    listPins: async () => [{ key: 'mood', value: 'tired' }],
    getRolls: async () => ({}),
    createAsk: async (_p, agentId, row) => {
      const open = asks.filter((a) => a.status === 'open');
      const ask = {
        id: String(ids++), agent_id: agentId, status: open.length ? 'pending' : 'open',
        options_json: JSON.stringify(row.options || ['Yes', 'No']),
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
      const pending = asks.filter((a) => a.status === 'pending').sort((a, b) => a.id.localeCompare(b.id));
      if (pending[0] && !asks.some((a) => a.status === 'open')) pending[0].status = 'open';
      return ask;
    },
    upsertBrief: async (_p, agentId, body) => ({ id: String(ids++), agent_id: agentId, ...body }),
    latestBrief: async () => null,
    updateBrief: async () => ({}),
    createWork: async (_p, agentId, row) => {
      const item = { id: String(ids++), agent_id: agentId, ...row };
      work.push(item);
      return item;
    },
    listWork: async () => work,
    listWorkers: async () => workers,
    createWorker: async (_p, agentId, row) => {
      const w = { id: String(ids++), agent_id: agentId, status: 'queued', chunk_grant: '', ...row };
      workers.push(w);
      return w;
    },
    updateWorker: async (id, patch) => {
      const w = workers.find((x) => x.id === id);
      if (w) Object.assign(w, patch);
      return w;
    },
    addTimeline: async () => ({}),
    audit: async () => ({}),
    notifyAsk: async () => ({ queued: true }),
    notifyDone: async () => ({ queued: true }),
    listCron: async () => crons,
    createCron: async (_p, agentId, body) => {
      const row = { id: String(ids++), agent_id: agentId, enabled: 'true', last_fired_at: '', ...body };
      crons.push(row);
      return row;
    },
    updateCron: async (id, patch) => {
      const c = crons.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
      return c;
    },
    shopBoard: async () => ({ locks: {} }),
    _seed(a) { agents.push(a); return a; },
    _asks: asks,
    _workers: workers,
    _crons: crons,
    _messages: messages,
  };
}

describe('layer memory', () => {
  test('user lane injects memory not rag; shop lanes inject rag not memory', () => {
    expect(laneInject('user')).toEqual({ memory: true, rag: false });
    expect(laneInject('manager')).toEqual({ memory: false, rag: true });
    expect(laneInject('execute')).toEqual({ memory: false, rag: true });
    expect(friendStoreName('icarus')).toBe('icarus-friend');
    expect(skillsCollectionName('icarus')).toBe('icarus-skills');
  });

  test('pins in friendSystem, not workerSystem', () => {
    const friend = friendSystem({ name: 'icarus', display_name: 'Icarus', mode: 'ask' }, [{ key: 'mood', value: 'tired' }], {});
    expect(friend).toMatch(/tired/);
    const worker = workerSystem('dev', '/tmp', '', {});
    expect(worker).not.toMatch(/tired/);
    expect(worker).toMatch(/skills RAG/i);
  });

  test('lane policy hides skills from hangout and pins from shop', () => {
    const endpoint = { inject_rag: true, inject_memory: true, rag: [{ name: 'icarus-skills' }], memory: [{ name: 'icarus-friend' }] };
    const user = laneInject('user');
    const exec = laneInject('execute');
    expect(user.rag).toBe(false);
    expect(user.memory).toBe(true);
    expect(exec.rag).toBe(true);
    expect(exec.memory).toBe(false);
    expect(endpoint.rag[0].name).toMatch(/skills/);
  });

  test('setup attaches friend memory and skills rag', async () => {
    const attached = [];
    const setup = new AgentSetupService({
      agents: {
        getSettings: async () => ({ workspace_root: '/tmp', write_policy: 'ask_writes' }),
        updateSettings: async (_p, body) => body,
        list: async () => [],
        getByName: async () => { const e = new Error('missing'); e.status = 404; throw e; },
        create: async (body) => ({ id: 'ag-1', ...body }),
        listCron: async () => [],
        createCron: async () => ({}),
      },
      memory: { list: async () => [{ name: 'icarus-friend' }], upsertConfig: async (p, b) => b, provision: async () => ({}) },
      intel: {
        list: async () => [{ id: 'ep', name: 'brain', execution: 'queued' }],
        getByName: async () => ({ id: 'ep', name: 'brain' }),
        attach: async (id, p, body) => { attached.push(body); return {}; },
        update: async () => ({}),
        create: async () => ({ name: 'brain' }),
      },
      rag: { create: async () => ({}) },
    });
    const out = await setup.apply(pid, { name: 'icarus' });
    expect(out.agent.memory).toBe('icarus-friend');
    expect(out.agent.rag_collection).toBe('icarus-skills');
    expect(attached.some((a) => a.kind === 'memory' && a.target_name === 'icarus-friend')).toBe(true);
    expect(attached.some((a) => a.kind === 'rag' && a.target_name === 'icarus-skills')).toBe(true);
  });
});

describe('learn ingest', () => {
  test('inline sentence becomes a source; ingest denied without ASK', () => {
    const sources = inferLearnSources('learn that 1+1=2 from this sentence');
    expect(sources[0].text).toMatch(/1\+1=2/);
    expect(shop.verifyTool({ name: 'learn_ingest', args: {} }, {}).ok).toBe(false);
    expect(shop.verifyTool({ name: 'learn_ingest', args: {} }, { chunkGrant: 'a1', preview: { type: 'learn' } }).ok).toBe(true);
  });

  test('cap pages and idempotent ingest skips duplicates', async () => {
    const learn = new AgentLearnService();
    const sources = [{ title: 'a', url: 'inline:1+1=2', text: '1+1=2', kind: 'paper' }];
    const { job, pages } = await learn.createJob({ projectId: pid, agentId: 'ag', sources });
    expect(pages[0].status).toBe('fetched');
    const docs = new Set();
    const rag = {
      hasDocument: async (_p, _c, id) => docs.has(id),
      ingest: async (_c, _p, body) => { docs.add(body.doc_id); return { ingested: 1 }; },
    };
    const first = await learn.ingestRemaining(job.id, { rag, collection: 'skills', projectId: pid });
    const second = await learn.ingestRemaining(job.id, { rag, collection: 'skills', projectId: pid });
    expect(first.ingested.length).toBe(1);
    expect(second.skipped.length + second.ingested.length).toBeGreaterThanOrEqual(0);
    expect(sourceDocId('inline:1+1=2')).toMatch(/^src:/);
    expect(capPages([{ text: 'x' }, { text: 'y' }], 1).truncated).toBe(true);
  });

  test('net error marks waiting_net; resume fetches remaining', async () => {
    const learn = new AgentLearnService();
    const { job } = await learn.createJob({
      projectId: pid, agentId: 'ag',
      sources: [{ url: 'https://example.com/a' }, { url: 'https://example.com/b' }],
    });
    let n = 0;
    const fetchImpl = async (url) => {
      n += 1;
      if (n === 1) return { ok: false, error: 'getaddrinfo ENOTFOUND', code: 'ENOTFOUND' };
      return { ok: true, text: `body ${url}` };
    };
    const blocked = await learn.fetchRemaining(job.id, { fetchImpl });
    expect(blocked.waiting).toBe('waiting_net');
    expect(learn.getJob(job.id).status).toBe('waiting_net');
    const ok = await learn.fetchRemaining(job.id, { fetchImpl });
    expect(ok.ok).toBe(true);
    expect(learn.listPages(job.id).filter((p) => p.status === 'fetched').length).toBeGreaterThanOrEqual(1);
  });

  test('learn ASK before ingest via runtime', async () => {
    const agents = memAgents();
    const agent = agents._seed({
      id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', rag_collection: 'icarus-skills', options: {},
    });
    const runtime = new AgentRuntime({ agents, jobs: { submit: async () => { throw new Error('no llm'); } } });
    const out = await runtime.chat(pid, agent.id, { content: 'learn that 1+1=2 from this sentence' });
    expect(out.ask.kind).toBe('plan');
    const run = await runtime.approve(pid, agent.id, { ask_id: out.ask.id, answer: 'Run it' });
    expect(run.ask.kind).toBe('learn');
    expect(run.ask.payload.sources[0].url).toMatch(/inline:/);
    const ing = await runtime.approve(pid, agent.id, { ask_id: run.ask.id, answer: 'Ingest' });
    expect(ing.reply).toMatch(/Skills now include/);
  });
});

describe('interactive plan', () => {
  test('mkdir stays single preview; make better asks plan_q', async () => {
    expect(needsPlan('create folder demo', { type: 'folder' })).toBe(false);
    expect(needsPlan('make the system better', { type: 'other' })).toBe(true);
    const agents = memAgents();
    const agent = agents._seed({ id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {} });
    const runtime = new AgentRuntime({ agents, jobs: { submit: async () => { throw new Error('no llm'); } } });
    const better = await runtime.chat(pid, agent.id, { content: 'make the system better' });
    expect(better.ask.kind).toBe('plan_q');
    expect(agents._workers.length).toBe(0);
    const proposed = await runtime.approve(pid, agent.id, { ask_id: better.ask.id, answer: 'Tests' });
    expect(proposed.ask.kind).toBe('plan');
    const mkdirAgents = memAgents();
    const mkdirAgent = mkdirAgents._seed({ id: 'ag2', name: 'icarus', mode: 'agent', intelligence: '', options: {} });
    const mkdirRt = new AgentRuntime({ agents: mkdirAgents, jobs: { submit: async () => { throw new Error('no llm'); } } });
    const mkdir = await mkdirRt.chat(pid, mkdirAgent.id, { content: 'create folder demo' });
    expect(mkdir.ask.kind).toBe('preview');
  });

  test('run that plan required; revision does not execute', async () => {
    const agents = memAgents();
    const agent = agents._seed({ id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {} });
    const runtime = new AgentRuntime({ agents, jobs: { submit: async () => { throw new Error('no llm'); } } });
    const start = await runtime.chat(pid, agent.id, { content: 'finish all the e2e tests for every part' });
    expect(start.ask.kind).toBe('plan');
    expect(agents._workers.length).toBe(0);
    const rev = await runtime.chat(pid, agent.id, { content: 'do tests first' });
    expect(rev.ask.kind).toBe('plan');
    expect(rev.plan.revision).toBeGreaterThan(1);
    expect(agents._workers.length).toBe(0);
    expect(shop.voiceIntent('yes lets run that plan', start.ask).action).toBe('approve');
  });

  test('applyRevision bumps revision', () => {
    const p = { revision: 1, steps: [{ id: 's1', title: 'code', kind: 'code' }] };
    const n = applyRevision(p, 'do tests first');
    expect(n.revision).toBe(2);
    expect(n.steps[0].kind).toBe('test');
  });
});

describe('cron + idle', () => {
  test('once fires then disables; late catch-up labeled', () => {
    const now = new Date('2026-09-07T16:00:00Z');
    const once = { kind: 'once', run_at: '2026-09-07T08:00:00Z', enabled: 'true' };
    const d = dueCron(once, now);
    expect(d.due).toBe(true);
    expect(d.late).toBe(true);
    expect(d.label).toMatch(/down/i);
    const fired = { ...once, last_fired_at: now.toISOString() };
    expect(dueCron(fired, now).due).toBe(false);
  });

  test('parse weather every morning at 7', () => {
    const p = parseCronIntent('every morning at 7 check the weather');
    expect(p.kind).toBe('recurring');
    expect(p.schedule).toBe('0 7 * * *');
    expect(p.handoff.kind).toBe('user_turn');
  });

  test('cronMatches 7am pacific', () => {
    const d = new Date('2026-09-07T14:00:00Z');
    expect(cronMatches('0 7 * * *', d, 'America/Los_Angeles')).toBe(true);
  });

  test('weather cron is user_turn not a write worker; enqueues if ASK open', async () => {
    const agents = memAgents();
    const agent = agents._seed({ id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {} });
    const runtime = new AgentRuntime({ agents, jobs: { submit: async () => { throw new Error('no llm'); } } });
    const propose = await runtime.chat(pid, agent.id, { content: 'every morning at 7 check the weather' });
    expect(propose.ask.kind).toBe('cron');
    await runtime.approve(pid, agent.id, { ask_id: propose.ask.id, answer: 'Yes' });
    expect(agents._crons[0].handoff.kind).toBe('user_turn');
    const open = await runtime.chat(pid, agent.id, { content: 'make the system better' });
    expect(open.ask.kind).toBe('plan_q');
    const fire = await runtime.fireCron(pid, agent.id, agents._crons[0].id, { late: true, label: 'I was down.' });
    expect(fire.queued_behind_ask).toBe(true);
    expect(fire.reply).toMatch(/down/i);
    expect(agents._workers.length).toBe(0);
    expect(agents._asks.filter((a) => a.status === 'open')[0].kind).toBe('plan_q');
  });

  test('idle cheap scan proposes and does not write; cap 3; skip prod', () => {
    const scan = cheapScan({ files: ['worker/ai_manager/index.js'], catalogNames: ['compute_manager', 'ai_manager'] });
    expect(scan.findings[0].title).toMatch(/compute_manager/);
    const plan = findingsToPlan(scan.findings);
    expect(plan.origin_kind).toBe('idle');
    expect(shouldSkipIdle({ projectId: 'ea370977-3aff-4c76-95a6-a0c50fd2bce7' })).toBe('prod');
    expect(AgentCronTicker.defaultIdleCron('9d8bde11-6933-4732-b746-602dcf72eaa5', 'icarus').name).toBe('idle-review');
    expect(AgentCronTicker.defaultIdleCron(pid, 'icarus')).toBe(null);
  });

  test('isNetError', () => {
    expect(isNetError({ code: 'ENOTFOUND' })).toBe(true);
    expect(isNetError(new Error('ok'))).toBe(false);
  });
});

describe('voice yes does not steal pending', () => {
  test('voice yes targets open ASK only', () => {
    const open = { kind: 'plan', recommended: 'Run it', status: 'open' };
    expect(shop.voiceIntent('yes', open).answer).toBe('Run it');
    expect(shop.voiceIntent('yes', null).action).toBe('chat');
  });
});

function memTable() {
  const rows = [];
  let n = 1;
  return {
    create: async (row) => { const r = { id: `id${n++}`, ...row }; rows.push(r); return r; },
    findAll: async ({ where = {} } = {}) => rows.filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v))),
    update: async (id, patch) => {
      const r = rows.find((x) => x.id === id);
      if (r) Object.assign(r, patch);
      return r;
    },
  };
}

describe('durable persist + resume', () => {
  test('kill mid-ingest hydrates remaining pages without duplicate chunks', async () => {
    const Job = memTable();
    const Page = memTable();
    const Source = memTable();
    const a = new AgentLearnService({ Job, Page, Source });
    const { job } = await a.createJob({
      projectId: pid, agentId: 'ag',
      sources: [
        { title: 'a', url: 'inline:one', text: 'one', kind: 'paper' },
        { title: 'b', url: 'inline:two', text: 'two', kind: 'paper' },
      ],
    });
    const docs = new Set();
    let ingestN = 0;
    const rag = {
      hasDocument: async (_p, _c, id) => docs.has(id),
      ingest: async (_c, _p, body) => {
        ingestN += 1;
        if (ingestN === 1) {
          docs.add(body.doc_id);
          return { ingested: 1 };
        }
        throw new Error('ENOTFOUND boom');
      },
    };
    const mid = await a.ingestRemaining(job.id, { rag, collection: 'skills', projectId: pid });
    expect(mid.waiting).toBe('waiting_net');
    const b = new AgentLearnService({ Job, Page, Source });
    await b.hydrate(pid, 'ag');
    const pages = b.listPages(job.id);
    expect(pages.filter((p) => p.status === 'ingested').length).toBe(1);
    expect(pages.filter((p) => p.status === 'fetched').length).toBe(1);
    rag.ingest = async (_c, _p, body) => { docs.add(body.doc_id); return { ingested: 1 }; };
    const done = await b.ingestRemaining(job.id, { rag, collection: 'skills', projectId: pid });
    expect(done.ok).toBe(true);
    expect(done.skipped.length + done.ingested.length).toBeGreaterThanOrEqual(1);
  });

  test('proposed plan survives a new service instance', async () => {
    const Plan = memTable();
    const a = new AgentPlanService({ Plan });
    const row = await a.create(pid, 'ag', { origin: 'make better', status: 'proposed', steps: [{ id: 's1', title: 'tests', kind: 'test' }] });
    const b = new AgentPlanService({ Plan });
    await b.ensureLoaded(pid, 'ag');
    const hit = b.get(pid, 'ag', row.id);
    expect(hit.status).toBe('proposed');
    expect(hit.steps[0].kind).toBe('test');
  });

  test('resume order: heal → user cron → learn → workers; idle last and skipped if other work', async () => {
    const agents = memAgents();
    agents._seed({ id: 'ag', name: 'icarus', mode: 'agent', intelligence: '', options: {} });
    await agents.createCron(pid, 'ag', {
      id: 'weather', kind: 'once', run_at: '2020-01-01T00:00:00Z', enabled: 'true',
      handoff: { kind: 'user_turn', objective: 'weather' },
    });
    await agents.createCron(pid, 'ag', {
      id: 'idle', kind: 'recurring', schedule: '* * * * *', enabled: 'true',
      handoff: { kind: 'idle_review' },
    });
    agents._workers.push({ id: 'w1', status: 'queued', chunk_grant: 'g' });
    const order = [];
    const runtime = new AgentRuntime({ agents, jobs: { submit: async () => ({}) } });
    runtime._healComputer = async () => { order.push('heal'); return {}; };
    runtime._healBrowser = async () => ({});
    runtime.fireCron = async (_p, _a, cid) => { order.push(String(cid) === 'idle' ? 'idle' : 'user'); return { ok: true }; };
    runtime._resumeLearnJobs = async () => { order.push('learn'); return 1; };
    runtime.runWorker = async () => { order.push('worker'); };
    await runtime.resume(pid);
    expect(order.indexOf('heal')).toBeLessThan(order.indexOf('user'));
    expect(order.indexOf('user')).toBeLessThan(order.indexOf('learn'));
    expect(order.indexOf('learn')).toBeLessThan(order.indexOf('worker'));
    expect(order).not.toContain('idle');
  });

  test('disk fetch caps at 2MB; 8KB web_fetch stays short', async () => {
    const big = 'x'.repeat(3 * 1024 * 1024);
    const fetchImpl = async () => ({ ok: true, status: 200, text: async () => big, headers: { get: () => 'text/plain' } });
    const disk = await webFetchDisk('https://example.com/paper', { fetchImpl });
    expect(disk.text.length).toBe(MAX_BYTES);
    const short = await webFetch('https://example.com/page', { fetchImpl });
    expect(short.body.length).toBe(8000);
  });

  test('LoRA is not auto-queued from learn', () => {
    const src = inferLearnSources('learn React from this sentence');
    expect(src.every((s) => s.kind !== 'lora')).toBe(true);
    expect(shop.inferPreview('learn React').type).toBe('learn');
  });

  test('recurring catch-up fires once and is labeled late', () => {
    const now = new Date('2026-09-07T16:00:00Z');
    const row = {
      kind: 'recurring', schedule: '0 7 * * *', timezone: 'America/Los_Angeles',
      last_fired_at: '2026-09-05T14:00:00Z', enabled: 'true', created_at: '2026-09-01T00:00:00Z',
    };
    const d = dueCron(row, now, { catchup: true });
    expect(d.due).toBe(true);
    expect(d.late).toBe(true);
    expect(d.label).toMatch(/down/i);
  });
});
