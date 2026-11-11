'use strict';

/**
 * Icarus control-plane scorecard: speed, memory, task completion, throughput.
 * Run: npm run bench:icarus
 * Hard: ICARUS_BENCH_HARD=1 npm run bench:icarus
 */

process.env.ICARUS_GRAPH_MEMORY = process.env.ICARUS_GRAPH_MEMORY || '1';

const { SLO } = require('./UxSlo');
const { UserContextGate, dualStreamPolicy, classify } = require('./UserContextGate');
const { createPlanGraphStore } = require('./graph/PlanGraphStore');
const { createGateway } = require('./AgentGateway');
const { SchedulerService } = require('./SchedulerService');
const { PrReviewService } = require('./PrReviewService');
const { planDistribute, MODEL_ROUTES } = require('./LoraDistribute');
const { defaultLaneIntelligenceNames } = require('./laneIntelligence');
const { TOOL_CURRICULA, TRAIN_HOST, loraTrain } = require('./LoraTrainService');
const { forProject } = require('./IcarusFacade');
const { scrubSubgraph, taskTrace } = require('./TaskTraceService');

const EXTRA_SLO = {
  gateway_enqueue_ms: 10,
  scheduler_tick_ms: 50,
  pr_heuristic_ms: 20,
  lora_plan_ms: 10,
  plan_complete_ms_per_task: 2, // wall ms / task for full drain
  ready_set_1k_ms: 15,
  heap_mb_per_1k_tasks: 8,
  completion_rate: 1, // fraction
  gate_accuracy: 0.9,
};

function allSlo() {
  return { ...SLO, ...EXTRA_SLO };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function memMb() {
  const m = process.memoryUsage();
  return {
    rss_mb: +(m.rss / 1024 / 1024).toFixed(2),
    heap_used_mb: +(m.heapUsed / 1024 / 1024).toFixed(2),
    heap_total_mb: +(m.heapTotal / 1024 / 1024).toFixed(2),
    external_mb: +(m.external / 1024 / 1024).toFixed(2),
  };
}

function timeSync(fn, iters = 100) {
  const samples = [];
  for (let i = 0; i < iters; i += 1) {
    const t0 = process.hrtime.bigint();
    fn(i);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {
    n: iters, p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples[samples.length - 1],
  };
}

async function timeAsync(fn, iters = 50) {
  const samples = [];
  for (let i = 0; i < iters; i += 1) {
    const t0 = process.hrtime.bigint();
    // eslint-disable-next-line no-await-in-loop
    await fn(i);
    samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return {
    n: iters, p50: percentile(samples, 50), p95: percentile(samples, 95), max: samples[samples.length - 1],
  };
}

function composition() {
  return {
    train_host: TRAIN_HOST,
    lanes: defaultLaneIntelligenceNames('icarus'),
    model_routes: MODEL_ROUTES,
    tool_curricula: Object.keys(TOOL_CURRICULA),
    slo: allSlo(),
    modules: [
      'UserContextGate', 'PlanGraphStore', 'AgentGateway', 'SchedulerService',
      'PrReviewService', 'LoraTrainService', 'ActionLedger', 'IcarusFacade', 'TaskTraceService',
    ],
  };
}

/**
 * Fan-out DAG: waves of PARALLEL work gated by a barrier task between waves.
 * Barrier keeps edge count O(waves*width) instead of O(waves*width^2).
 */
async function buildWaveGraph(waves, width) {
  const graph = createPlanGraphStore(`wave-${waves}x${width}-${Date.now()}`, { forceMemory: true });
  const plan = await graph.createPlan({ title: `wave-${waves}x${width}` });
  const waveIds = [];
  let prevBarrier = null;
  let taskCount = 0;
  for (let w = 0; w < waves; w += 1) {
    const ids = [];
    for (let i = 0; i < width; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const t = await graph.addTask(plan.id, {
        title: `w${w}-${i}`, priority: (waves - w) * 10 + i,
      });
      ids.push(t.id);
      taskCount += 1;
      if (i > 0) {
        // eslint-disable-next-line no-await-in-loop
        await graph.linkParallel(ids[i - 1], t.id);
      }
      if (prevBarrier) {
        // eslint-disable-next-line no-await-in-loop
        await graph.linkBefore(prevBarrier, t.id);
      }
    }
    // eslint-disable-next-line no-await-in-loop
    const barrier = await graph.addTask(plan.id, {
      title: `barrier-${w}`, priority: (waves - w) * 10, kind: 'barrier',
    });
    taskCount += 1;
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await graph.linkBefore(id, barrier.id);
    }
    prevBarrier = barrier.id;
    waveIds.push(ids);
  }
  return {
    graph, plan, waveIds, taskCount,
  };
}

async function buildChain(size) {
  const graph = createPlanGraphStore(`chain-${size}-${Date.now()}`, { forceMemory: true });
  const plan = await graph.createPlan({ title: `chain-${size}` });
  const ids = [];
  for (let i = 0; i < size; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const t = await graph.addTask(plan.id, { title: `t${i}`, priority: size - i });
    ids.push(t.id);
    if (i > 0) {
      // eslint-disable-next-line no-await-in-loop
      await graph.linkBefore(ids[i - 1], t.id);
    }
  }
  return { graph, plan, ids, taskCount: size };
}

/**
 * Drain a plan via scheduler until all tasks done (or stuck).
 * Simulates coding workers finishing immediately.
 */
async function completePlan(graph, planId, { maxParallel = 8, maxTicks = 10000 } = {}) {
  const sched = new SchedulerService({
    graph,
    maxParallel,
    spawn: async (task) => {
      // simulate work completing on next microtask
      setImmediate(() => {
        graph.setTaskStatus(task.id, 'done').catch(() => {});
      });
    },
  });
  const t0 = process.hrtime.bigint();
  let ticks = 0;
  let launched = 0;
  for (; ticks < maxTicks; ticks += 1) {
    // eslint-disable-next-line no-await-in-loop
    const out = await sched.tick(planId);
    launched += out.launched.length;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setImmediate(r));
    const tasks = [...graph.tasks.values()].filter((t) => t.plan_id === planId);
    const pending = tasks.filter((t) => !['done', 'cancelled', 'invalidated'].includes(t.status));
    if (!pending.length) break;
    // if nothing launched and nothing running — deadlock
    const running = tasks.filter((t) => t.status === 'running');
    if (!out.launched.length && !running.length && pending.length) {
      return {
        ok: false,
        reason: 'deadlock',
        ticks,
        launched,
        pending: pending.length,
        ms: Number(process.hrtime.bigint() - t0) / 1e6,
        tasks: tasks.length,
      };
    }
  }
  const tasks = [...graph.tasks.values()].filter((t) => t.plan_id === planId);
  const done = tasks.filter((t) => t.status === 'done').length;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return {
    ok: done === tasks.length,
    reason: done === tasks.length ? 'complete' : 'timeout',
    ticks,
    launched,
    done,
    tasks: tasks.length,
    ms,
    ms_per_task: tasks.length ? ms / tasks.length : 0,
    tasks_per_sec: ms > 0 ? (done / ms) * 1000 : 0,
  };
}

function gateAccuracySuite() {
  const cases = [
    { text: 'hey how are you', expect: 'CHAT' },
    { text: 'search for neo4j ready set', expect: 'WEB' },
    { text: 'read the AgentGateway file', expect: 'DIG' },
    { text: 'implement the deploy pipeline', expect: 'MANAGER' },
    { text: 'build a new feature and ship it', expect: 'MANAGER' },
    { text: 'pause browse and do X first', expect: 'STEER', live: true },
    { text: 'focus on deploy first', expect: 'STEER', live: true },
    { text: 'google the latest rust release', expect: 'WEB' },
    { text: 'show me how grep works in the repo', expect: 'DIG' },
    { text: 'what do you mean', expect: 'CLARIFY' },
  ];
  let hit = 0;
  const misses = [];
  for (const c of cases) {
    const r = classify(c.text, { hasLivePlan: Boolean(c.live) });
    if (r.route === c.expect) hit += 1;
    else misses.push({ ...c, got: r.route });
  }
  return { n: cases.length, hit, rate: hit / cases.length, misses };
}

async function e2eShopOnce() {
  const pid = `e2e-shop-${Date.now()}`;
  const f = forProject(pid, { max_parallel_workers: 4, reserved_user_slots: 1 });
  await f.boot();
  const gate = await f.gate.route('implement the e2e shop bench and ship it');
  const plan = await f.graph.createPlan({ title: 'shop', goal: 'done' });
  const a = await f.graph.addTask(plan.id, { title: 'research', priority: 3 });
  const b = await f.graph.addTask(plan.id, { title: 'code', priority: 2 });
  const c = await f.graph.addTask(plan.id, { title: 'review', priority: 1 });
  await f.graph.linkBefore(a.id, b.id);
  await f.graph.linkBefore(b.id, c.id);
  const drain = await completePlan(f.graph, plan.id, { maxParallel: 2 });
  const agent = {
    id: 'ag',
    options: { lane_intelligence: defaultLaneIntelligenceNames('icarus') },
    intelligence: 'icarus-worker',
  };
  const pr = f.prReviews.openFromWorker({
    projectId: pid, agent, title: 'feat', files: ['x.js'], diff: '+ok\n',
  });
  const approved = await f.prReviews.approveWithHigherModel({
    projectId: pid, agent, prId: pr.id, settings: {},
  });
  const prStatus = approved.status;
  let merged = false;
  if (prStatus === 'approved') {
    f.prReviews.markMerged(pr.id);
    merged = true;
  }
  f.ledger.append({
    projectId: pid, tool: 'file_edit', taskId: b.id, args: { task_id: b.id },
  });
  const trace = await taskTrace(f, b.id, { projectId: pid });
  const sub = await f.graph.subgraph(plan.id);
  scrubSubgraph(sub, Date.now());
  const q = loraTrain.propose({ projectId: pid, agentKind: 'coding', baseModel: 'qwen' });
  return {
    gate: gate.route,
    drain,
    pr_approved: prStatus === 'approved',
    pr_status: prStatus,
    merged,
    trace_tools: trace.tools.length,
    lora_orin: q.train_host === 'orin',
    ok: drain.ok && merged && prStatus === 'approved' && gate.route === 'MANAGER' && q.train_host === 'orin',
  };
}

async function run(opts = {}) {
  const hard = opts.hard || process.env.ICARUS_BENCH_HARD === '1';
  const gateIters = opts.gateIters ?? (hard ? 200 : 80);
  const graphSizes = opts.graphSizes ?? (hard ? [50, 200, 500, 1000] : [50, 200, 500]);
  const gatewayIters = opts.gatewayIters ?? (hard ? 200 : 80);
  const slo = allSlo();
  const metrics = {};
  const quality = {};
  const mem = { start: memMb() };

  if (global.gc) global.gc();
  const heapBefore = process.memoryUsage().heapUsed;

  // --- latency suite ---
  const gate = new UserContextGate();
  const texts = [
    'hey', 'search neo4j docs', 'read AgentGateway', 'implement deploy', 'pause and do X first',
  ];
  metrics.gate_classify_ms = await timeAsync(async (i) => {
    await gate.route(texts[i % texts.length], { hasLivePlan: i % 2 === 0 });
  }, gateIters);
  metrics.dual_stream_ack_ms = timeSync((i) => {
    dualStreamPolicy(['CHAT', 'WEB', 'MANAGER', 'STEER'][i % 4]);
  }, gateIters);

  for (const size of graphSizes) {
    const { graph, plan } = await buildChain(size);
    await graph.readySet(plan.id);
    const key = `graph_ready_${size}`;
    metrics[key] = await timeAsync(async () => { await graph.readySet(plan.id); }, hard ? 40 : 25);
    metrics[key].slo_key = size >= 1000 ? 'ready_set_1k_ms' : 'graph_ready_query_ms';
  }

  const gw = createGateway({ maxConcurrent: 4, reservedUserSlots: 1 });
  metrics.gateway_enqueue_ms = await timeAsync(async (i) => {
    await gw.enqueue(i % 3 === 0 ? 'user' : 'execute', async () => {}, {
      priorityClass: i % 3 === 0 ? 1 : 3,
    });
  }, gatewayIters);

  // concurrent burst throughput
  const burstN = hard ? 200 : 80;
  const burstT0 = process.hrtime.bigint();
  await Promise.all(Array.from({ length: burstN }, (_, i) => gw.enqueue(
    i % 4 === 0 ? 'user' : 'execute',
    async () => {},
    { priorityClass: i % 4 === 0 ? 1 : 3 },
  )));
  const burstMs = Number(process.hrtime.bigint() - burstT0) / 1e6;
  quality.gateway_burst = {
    n: burstN,
    ms: +burstMs.toFixed(3),
    jobs_per_sec: +((burstN / burstMs) * 1000).toFixed(1),
  };

  const { graph, plan, ids } = await buildChain(12);
  await graph.linkParallel(ids[1], ids[2]);
  await graph.setTaskStatus(ids[0], 'done');
  const sched = new SchedulerService({ graph, maxParallel: 3, spawn: async () => {} });
  metrics.scheduler_tick_ms = await timeAsync(async () => {
    for (const id of ids.slice(1, 4)) {
      const t = await graph.getTask(id);
      if (t?.status === 'running') await graph.setTaskStatus(id, 'pending');
    }
    await sched.tick(plan.id);
  }, 20);

  const pr = new PrReviewService();
  const opened = pr.openFromWorker({
    projectId: 'b',
    agent: { id: 'a', options: { lane_intelligence: defaultLaneIntelligenceNames('icarus') } },
    title: 'x',
    files: ['a.js'],
    diff: '+ok\n'.repeat(50),
  });
  metrics.pr_heuristic_ms = timeSync(() => { pr.heuristicReview(opened); }, 200);
  metrics.lora_plan_ms = timeSync((i) => {
    planDistribute({
      adapterPath: '/m', adapterName: 'a', baseModel: i % 2 ? 'qwen' : 'gemma4', agentKind: 'coding',
    });
  }, 200);

  // --- completion / throughput ---
  const wave = await buildWaveGraph(hard ? 8 : 5, hard ? 16 : 8);
  const drain = await completePlan(wave.graph, wave.plan.id, { maxParallel: 8 });
  quality.plan_completion = drain;
  metrics.plan_complete_ms_per_task = {
    n: drain.tasks,
    p50: drain.ms_per_task,
    p95: drain.ms_per_task,
    max: drain.ms_per_task,
    value: drain.ms_per_task,
  };

  const chain = await buildChain(hard ? 200 : 80);
  quality.chain_completion = await completePlan(chain.graph, chain.plan.id, { maxParallel: 1 });

  quality.gate_accuracy = gateAccuracySuite();
  quality.e2e_shop = await e2eShopOnce();
  if (hard) {
    quality.e2e_shop_x3 = [];
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      quality.e2e_shop_x3.push(await e2eShopOnce());
    }
  }

  // --- memory ---
  if (global.gc) global.gc();
  const big = await buildChain(hard ? 2000 : 1000);
  await big.graph.readySet(big.plan.id);
  if (global.gc) global.gc();
  const heapAfter = process.memoryUsage().heapUsed;
  const heapDeltaMb = (heapAfter - heapBefore) / 1024 / 1024;
  const per1k = (heapDeltaMb / big.taskCount) * 1000;
  mem.after_build = memMb();
  mem.heap_delta_mb = +heapDeltaMb.toFixed(2);
  mem.heap_mb_per_1k_tasks = +per1k.toFixed(3);
  mem.tasks_held = big.taskCount;
  metrics.heap_mb_per_1k_tasks = {
    n: 1,
    p50: per1k,
    p95: per1k,
    max: per1k,
    value: per1k,
  };
  metrics.ready_set_1k_ms = await timeAsync(async () => {
    await big.graph.readySet(big.plan.id);
  }, 20);
  metrics.ready_set_1k_ms.slo_key = 'ready_set_1k_ms';

  // --- score latency metrics ---
  const results = {};
  let pass = true;
  for (const [name, m] of Object.entries(metrics)) {
    const sloKey = m.slo_key || name;
    const target = slo[sloKey];
    if (target == null) {
      results[name] = { ...m, pass: true };
      continue;
    }
    const cmp = name.includes('rate') || sloKey === 'completion_rate' || sloKey === 'gate_accuracy'
      ? (m.value ?? m.p95) >= target
      : (m.p95 ?? m.value) <= target;
    // heap and ms_per_task use value/p95 lower-is-better except rates
    let ok;
    if (sloKey === 'completion_rate' || sloKey === 'gate_accuracy') {
      ok = (m.value ?? m.p95) >= target;
    } else {
      ok = (m.p95 ?? m.value) <= target;
    }
    if (!ok) pass = false;
    results[name] = {
      ...m, target_ms: target, target, pass: ok, slo_key: sloKey, cmp,
    };
  }

  // quality gates
  const qPass = {
    plan_complete: quality.plan_completion.ok,
    chain_complete: quality.chain_completion.ok,
    gate_accuracy: quality.gate_accuracy.rate >= slo.gate_accuracy,
    e2e_shop: quality.e2e_shop.ok,
  };
  if (Object.values(qPass).some((v) => !v)) pass = false;

  const scorecard = {
    grade: pass ? 'A' : 'needs_work',
    latency_pass: Object.values(results).every((r) => r.pass !== false),
    quality: qPass,
    throughput: {
      wave_tasks_per_sec: quality.plan_completion.tasks_per_sec,
      chain_tasks_per_sec: quality.chain_completion.tasks_per_sec,
      gateway_jobs_per_sec: quality.gateway_burst.jobs_per_sec,
    },
    memory: mem,
    completion: {
      wave: `${quality.plan_completion.done}/${quality.plan_completion.tasks}`,
      chain: `${quality.chain_completion.done}/${quality.chain_completion.tasks}`,
      gate_accuracy: `${quality.gate_accuracy.hit}/${quality.gate_accuracy.n}`,
      e2e_shop: quality.e2e_shop.ok,
    },
  };
  if (
    pass
    && quality.plan_completion.tasks_per_sec > 2000
    && quality.chain_completion.ok
    && quality.gate_accuracy.rate >= 1
    && mem.heap_mb_per_1k_tasks < 5
  ) {
    scorecard.grade = 'A+';
  }

  return {
    hard: Boolean(hard),
    composition: composition(),
    metrics: results,
    quality,
    scorecard,
    pass,
    at: new Date().toISOString(),
  };
}

function printHuman(out) {
  const sc = out.scorecard;
  // eslint-disable-next-line no-console
  console.log(`\n=== Icarus scorecard  grade=${sc.grade}  pass=${out.pass}  hard=${out.hard} ===`);
  // eslint-disable-next-line no-console
  console.log('Completion:', sc.completion);
  // eslint-disable-next-line no-console
  console.log('Throughput:', sc.throughput);
  // eslint-disable-next-line no-console
  console.log('Memory:', sc.memory);
  // eslint-disable-next-line no-console
  console.log('Quality gates:', sc.quality);
  const rows = Object.entries(out.metrics).map(([k, m]) => ({
    metric: k,
    p50: m.p50?.toFixed?.(4) ?? m.p50,
    p95: m.p95?.toFixed?.(4) ?? m.p95,
    target: m.target ?? m.target_ms,
    pass: m.pass,
  }));
  // eslint-disable-next-line no-console
  console.table(rows);
}

async function main() {
  const out = await run({ hard: process.env.ICARUS_BENCH_HARD === '1' });
  printHuman(out);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
  if (!out.pass) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  run,
  composition,
  timeSync,
  timeAsync,
  allSlo,
  EXTRA_SLO,
  completePlan,
  buildWaveGraph,
  buildChain,
  gateAccuracySuite,
  memMb,
};
