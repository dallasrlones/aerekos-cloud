'use strict';

process.env.ICARUS_GRAPH_MEMORY = '1';

const {
  run, composition, allSlo, completePlan, buildWaveGraph, buildChain, gateAccuracySuite,
} = require('../../api/services/IcarusBenchmark');

describe('IcarusBenchmark scorecard', () => {
  test('composition documents Orin + qwen/gemma routes', () => {
    const c = composition();
    expect(c.train_host).toBe('orin');
    expect(c.model_routes.qwen.move).toBe(false);
    expect(c.model_routes.gemma4.move).toBe(true);
    expect(c.lanes.review).toBe('icarus-manager');
    expect(allSlo().gate_classify_ms).toBe(100);
    expect(allSlo().completion_rate).toBe(1);
  });

  test('gate accuracy suite hits STEER/MANAGER/WEB', () => {
    const g = gateAccuracySuite();
    expect(g.rate).toBeGreaterThanOrEqual(0.9);
  });

  test('wave plan completes all tasks (incl barriers)', async () => {
    const wave = await buildWaveGraph(3, 4);
    const drain = await completePlan(wave.graph, wave.plan.id, { maxParallel: 4 });
    expect(drain.ok).toBe(true);
    // 3 waves * 4 workers + 3 barriers
    expect(drain.done).toBe(15);
  });

  test('chain plan completes under serial scheduler', async () => {
    const chain = await buildChain(20);
    const drain = await completePlan(chain.graph, chain.plan.id, { maxParallel: 1 });
    expect(drain.ok).toBe(true);
    expect(drain.done).toBe(20);
  });

  test('control-plane scorecard passes', async () => {
    const out = await run({
      gateIters: 30,
      graphSizes: [50, 200],
      gatewayIters: 30,
      hard: false,
    });
    if (!out.pass) {
      // eslint-disable-next-line no-console
      console.error('scorecard fail', {
        quality: out.scorecard.quality,
        e2e: out.quality.e2e_shop,
        metrics: Object.fromEntries(
          Object.entries(out.metrics).filter(([, m]) => !m.pass),
        ),
      });
    }
    expect(out.scorecard.quality.plan_complete).toBe(true);
    expect(out.scorecard.quality.chain_complete).toBe(true);
    expect(out.scorecard.quality.gate_accuracy).toBe(true);
    expect(out.scorecard.quality.e2e_shop).toBe(true);
    expect(out.scorecard.memory.heap_mb_per_1k_tasks).toBeLessThan(8);
    expect(out.pass).toBe(true);
  }, 60000);
});
