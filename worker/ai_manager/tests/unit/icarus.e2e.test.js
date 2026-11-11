'use strict';

/**
 * Icarus recursive-agents e2e (in-memory). Never touches prod project.
 * Flow: setup facade → Context-Gate dual-stream → plan graph + BEFORE/PARALLEL
 * → scheduler → coding open_pr → higher-model approve → user merge
 * → Orin LoRA (Qwen pin / Gemma4 distribute) → explain/checkpoint/charter.
 */

process.env.ICARUS_GRAPH_MEMORY = '1';

const { forProject } = require('../../api/services/IcarusFacade');
const { createGateway } = require('../../api/services/AgentGateway');
const { resolveLaneIntelligence, defaultLaneIntelligenceNames } = require('../../api/services/laneIntelligence');
const { AgentRuntime } = require('../../api/services/AgentRuntime');

const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const PID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function memAgents() {
  const agents = [];
  const settings = {
    llm_max_concurrent: 2,
    reserved_user_slots: 1,
    max_parallel_workers: 3,
    workspace_root: '/tmp/icarus-e2e',
    write_policy: 'ask_writes',
    write_exceptions: [],
    notify_on_ask: 'queue_only',
    lane_min_interval_ms: 0,
  };
  const messages = [];
  const asks = [];
  const work = [];
  const workers = [];
  const rolls = {};
  const timeline = [];
  let ids = 1;
  const lane = defaultLaneIntelligenceNames('icarus');
  agents.push({
    id: 'ag-e2e',
    name: 'icarus',
    project_id: PID,
    mode: 'agent',
    intelligence: lane.manager,
    options: { lane_intelligence: lane },
    user_id: 'e2e',
    rag_collection: 'icarus-skills',
  });
  return {
    getSettings: async () => settings,
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    addMessage: async (_p, agentId, row) => {
      messages.push({ id: String(ids++), agent_id: agentId, ...row });
    },
    listMessages: async () => messages,
    listPins: async () => [],
    getRolls: async () => rolls,
    createAsk: async (_p, agentId, row) => {
      const ask = {
        id: String(ids++),
        agent_id: agentId,
        status: 'open',
        options_json: JSON.stringify(row.options || []),
        ...row,
      };
      asks.push(ask);
      return ask;
    },
    listAsks: async () => asks,
    createWork: async (_p, agentId, row) => {
      const item = { id: String(ids++), agent_id: agentId, ...row };
      work.push(item);
      return item;
    },
    updateWork: async (projectId, agentId, id, patch) => {
      // support both signatures used in runtime
      const wid = typeof id === 'object' ? agentId : id;
      const p = typeof id === 'object' ? id : patch;
      const w = work.find((x) => x.id === wid);
      if (w) Object.assign(w, p || {});
      return w;
    },
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
    addTimeline: async (_p, agentId, row) => {
      timeline.push({ agent_id: agentId, ...row });
    },
    audit: async () => {},
    notifyDone: async () => {},
    _seed: agents[0],
    _asks: asks,
    _work: work,
    _messages: messages,
    _timeline: timeline,
  };
}

describe('Icarus e2e', () => {
  test('never targets prod project id', () => {
    expect(PID).not.toBe(FORBIDDEN);
  });

  test('full recursive loop: gate → graph → swarm → PR → LoRA → explain', async () => {
    const agents = memAgents();
    const settings = await agents.getSettings(PID);
    const icarus = forProject(PID, settings);
    await icarus.boot();

    // --- Phase 0: lane intelligence + gateway reserved capacity ---
    const agent = await agents.resolve(PID, 'ag-e2e');
    expect(resolveLaneIntelligence(agent, 'user').intelligence).toBe('icarus-user');
    expect(resolveLaneIntelligence(agent, 'review').intelligence).toBe('icarus-manager');
    expect(resolveLaneIntelligence(agent, 'execute').intelligence).toBe('icarus-worker');
    const gw = createGateway({
      maxConcurrent: settings.llm_max_concurrent,
      reservedUserSlots: settings.reserved_user_slots,
    });
    expect(gw.snapshot().reserved_user_slots).toBe(1);

    // --- Phase 2: dual-stream Context-Gate ---
    const chat = await icarus.gate.route('hey what are you up to');
    expect(chat.route).toBe('CHAT');
    expect(chat.policy.manager_continues).toBe(true);

    const build = await icarus.gate.route('implement the deploy pipeline and ship it');
    expect(build.route).toBe('MANAGER');
    expect(build.policy.wake_manager).toBe(true);

    // --- Phase 1+3: plan graph, BEFORE, PARALLEL, schedule ---
    const plan = await icarus.graph.createPlan({
      title: 'Ship Icarus e2e',
      goal: 'prove recursive agents',
      agentId: agent.id,
    });
    const tResearch = await icarus.graph.addTask(plan.id, {
      title: 'research', priority: 10, kind: 'info',
    });
    const tCodeA = await icarus.graph.addTask(plan.id, {
      title: 'code-a', priority: 5, kind: 'coding',
    });
    const tCodeB = await icarus.graph.addTask(plan.id, {
      title: 'code-b', priority: 5, kind: 'coding',
    });
    const tReview = await icarus.graph.addTask(plan.id, {
      title: 'review-pr', priority: 1, kind: 'review',
    });
    await icarus.graph.linkBefore(tResearch.id, tCodeA.id);
    await icarus.graph.linkBefore(tResearch.id, tCodeB.id);
    await icarus.graph.linkParallel(tCodeA.id, tCodeB.id);
    await icarus.graph.linkBefore(tCodeA.id, tReview.id);
    await icarus.graph.linkBefore(tCodeB.id, tReview.id);

    let ready = await icarus.graph.readySet(plan.id);
    expect(ready.map((t) => t.title)).toEqual(['research']);

    await icarus.graph.setTaskStatus(tResearch.id, 'done');
    ready = await icarus.graph.readySet(plan.id);
    expect(ready.map((t) => t.title).sort()).toEqual(['code-a', 'code-b']);

    const sched = await icarus.scheduler.tick(plan.id);
    expect(sched.launched).toHaveLength(2);
    expect((await icarus.graph.getTask(tCodeA.id)).status).toBe('running');

    // steer while workers run
    const steer = await icarus.gate.route('do code-a first and pause code-b', { hasLivePlan: true });
    expect(steer.route).toBe('STEER');
    icarus.ledger.append({
      projectId: PID, agentId: agent.id, lane: 'user', tool: 'steer', args: { text: 'pause code-b' },
    });

    await icarus.graph.setTaskStatus(tCodeA.id, 'done');
    await icarus.graph.setTaskStatus(tCodeB.id, 'done');

    // --- PR: coding creates, higher model approves, user merges ---
    icarus.prReviews.jobs = null; // sync heuristic + higher-lane path
    const pr = icarus.prReviews.openFromWorker({
      projectId: PID,
      agent,
      workerId: 'w-coding',
      title: 'feat: e2e',
      summary: 'recursive agents wire',
      files: ['AgentGateway.js', 'PrReviewService.js'],
      diff: '+ expect(true).toBe(true)\n',
      taskId: tCodeA.id,
    });
    expect(pr.created_by).toBe('coding_agent');
    expect(pr.status).toBe('awaiting_review');

    const approved = await icarus.prReviews.approveWithHigherModel({
      projectId: PID, agent, prId: pr.id, settings,
    });
    expect(approved.status).toBe('approved');
    expect(approved.review.intelligence).toBe('icarus-manager');
    expect(approved.review.intelligence).not.toBe('icarus-worker');

    const ask = icarus.prReviews.userAskPayload(approved);
    expect(ask.options).toContain('Merge');
    expect(icarus.prReviews.markMerged(pr.id).status).toBe('merged');

    await icarus.graph.setTaskStatus(tReview.id, 'done');
    await icarus.graph.recordDecision({
      planId: plan.id,
      taskId: tReview.id,
      why: 'higher model approved coding PR; user merged',
    });

    // --- Phase 4: Orin LoRA — Qwen local + Gemma4 move ---
    const qwenAsk = icarus.loraTrain.propose({
      projectId: PID, agentKind: 'coding', baseModel: 'qwen',
    });
    expect(qwenAsk.train_host).toBe('orin');
    expect(qwenAsk.distribute.move).toBe(false);
    const qJob = icarus.loraTrain.enqueue({
      projectId: PID, agentKind: 'manager', baseModel: 'qwen', adapterName: 'mgr-qwen-e2e',
    });
    icarus.loraTrain.update(qJob.id, {
      status: 'succeeded',
      adapter_path: '/models/lora/mgr-qwen-e2e',
      adapter_version: 'e2e1',
    });
    expect(icarus.loraTrain.get(qJob.id).distribute.steps.some((s) => s.step === 'pin_local')).toBe(true);

    const gAsk = icarus.loraTrain.propose({
      projectId: PID, agentKind: 'user', baseModel: 'gemma4',
    });
    expect(gAsk.distribute.move).toBe(true);
    const gJob = icarus.loraTrain.enqueue({
      projectId: PID, agentKind: 'user', baseModel: 'gemma4', adapterName: 'user-gemma-e2e',
    });
    icarus.loraTrain.update(gJob.id, {
      status: 'succeeded',
      adapter_path: '/models/lora/user-gemma-e2e',
    });
    const copies = icarus.loraTrain.get(gJob.id).distribute.steps.filter((s) => s.step === 'copy');
    expect(copies.map((c) => c.to).sort()).toEqual(['dev-mini', 'prod-mini']);

    // --- Phase 7–8: charter, checkpoint, explain, world, UX ---
    expect(icarus.charter.check(PID, 'wipe production').allow).toBe(false);
    expect(icarus.charter.check(PID, 'deploy frontend').ask).toBe(true);

    const sub = await icarus.graph.subgraph(plan.id);
    const cp = await icarus.checkpoints.save(PID, {
      planId: plan.id,
      label: 'e2e-done',
      snapshot: { tasks: sub.tasks.map((t) => ({ id: t.id, status: t.status })) },
    });
    expect(cp.id).toBeTruthy();

    const why = await icarus.explain.whyTask(PID, tReview.id);
    expect(why.summary).toMatch(/review-pr/);

    await icarus.world.ingest(PID, {
      entityId: plan.id, text: 'e2e green', source: 'test',
    });
    expect(icarus.world.recent(PID)[0].text).toBe('e2e green');

    icarus.uxSlo.record('gate_classify_ms', 12);
    icarus.uxSlo.record('graph_ready_query_ms', 8);
    const ux = icarus.uxSlo.summary();
    expect(ux.metrics.gate_classify_ms.ok_rate).toBe(1);

    // energy: train → Orin
    expect(icarus.energy.route(PID, { lane: 'train' }).tier).toBe('local_orin');
    expect(icarus.energy.route(PID, { lane: 'review' }).tier).toBe('local_orin');

    // ledger has steer + PR + train
    const led = icarus.ledger.list(PID, { limit: 50 });
    expect(led.some((r) => r.tool === 'steer')).toBe(true);
    expect(led.some((r) => r.tool === 'open_pr')).toBe(true);
    expect(led.some((r) => r.tool === 'approve_pr')).toBe(true);

    // live graph: status history + task-scoped tools + scrub
    const { taskTrace, scrubSubgraph } = require('../../api/services/TaskTraceService');
    icarus.ledger.append({
      projectId: PID, tool: 'file_edit', taskId: tCodeA.id, args: { task_id: tCodeA.id, path: 'x.js' },
    });
    const traced = await taskTrace(icarus, tCodeA.id, { projectId: PID });
    expect(traced.tools.some((r) => r.tool === 'file_edit')).toBe(true);
    const subLive = await icarus.graph.subgraph(plan.id);
    expect(scrubSubgraph(subLive, Date.now()).tasks.length).toBe(subLive.tasks.length);
  });

  test('AgentRuntime chat gates dual-stream without hitting prod', async () => {
    const agents = memAgents();
    const jobs = {
      submit: async () => ({ id: 'job-e2e', status: 'queued' }),
    };
    const runtime = new AgentRuntime({ agents, jobs });
    // hangout / ask mode path
    const agent = await agents.resolve(PID, 'ag-e2e');
    agent.mode = 'ask';
    const out = await runtime.chat(PID, agent.id, { content: 'search for neo4j ready set' });
    expect(out.gate).toBeTruthy();
    expect(out.gate.route).toBe('WEB');
    expect(out.agent_id).toBe(agent.id);
    expect(PID).not.toBe(FORBIDDEN);
  });

  test('secrets in coding PR are rejected by higher-model heuristic before user merge', async () => {
    const icarus = forProject(`${PID}-sec`, { reserved_user_slots: 1 });
    await icarus.boot();
    const agent = {
      id: 'ag',
      options: { lane_intelligence: defaultLaneIntelligenceNames('icarus') },
      intelligence: 'icarus-worker',
    };
    const pr = icarus.prReviews.openFromWorker({
      projectId: `${PID}-sec`,
      agent,
      title: 'leak',
      files: ['.env'],
      diff: 'SECRET_KEY=abc BEGIN RSA PRIVATE KEY',
    });
    const out = await icarus.prReviews.approveWithHigherModel({
      projectId: `${PID}-sec`, agent, prId: pr.id, settings: {},
    });
    expect(out.status).toBe('rejected');
    expect(() => icarus.prReviews.markMerged(pr.id)).toThrow();
  });
});
