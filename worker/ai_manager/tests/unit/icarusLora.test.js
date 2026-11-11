'use strict';

const {
  loraTrain, TOOL_CURRICULA, TRAIN_HOST, DEFAULT_BASE,
} = require('../../api/services/LoraTrainService');
const {
  planDistribute, routeForBase, normalizeBase, TRAINER, MODEL_ROUTES,
} = require('../../api/services/LoraDistribute');

describe('LoRA Orin trainer — Qwen local + Gemma4 move', () => {
  test('trainer is always Orin', () => {
    expect(TRAIN_HOST).toBe('orin');
    expect(TRAINER.id).toBe('orin');
  });

  test('Qwen trains and serves on Orin (no hop)', () => {
    const route = routeForBase('qwen-2.5-coder');
    expect(route.train_on).toBe('orin');
    expect(route.serve_on).toEqual(['orin']);
    expect(route.move).toBe(false);
    const plan = planDistribute({
      adapterPath: '/models/lora/qwen-tools',
      adapterName: 'coding-qwen-tools',
      baseModel: 'qwen',
      agentKind: 'coding',
    });
    expect(plan.move).toBe(false);
    expect(plan.steps.some((s) => s.step === 'pin_local' && s.host === 'orin')).toBe(true);
    expect(plan.steps.some((s) => s.step === 'copy')).toBe(false);
  });

  test('Gemma4 trains on Orin then copies to prod/dev minis', () => {
    expect(normalizeBase('Gemma 4')).toBe('gemma4');
    const route = routeForBase('gemma4');
    expect(route.move).toBe(true);
    expect(route.serve_on).toEqual(['prod-mini', 'dev-mini']);
    const plan = planDistribute({
      adapterPath: '/models/lora/gemma-tools',
      adapterName: 'user-gemma4-tools',
      baseModel: 'gemma4',
      agentKind: 'user',
    });
    expect(plan.steps.filter((s) => s.step === 'copy').map((s) => s.to).sort())
      .toEqual(['dev-mini', 'prod-mini']);
  });

  test('both coding and manager/review can propose tool-call fine-tunes', () => {
    const coding = loraTrain.propose({
      projectId: 'p1', agentKind: 'coding', baseModel: 'qwen',
    });
    const review = loraTrain.propose({
      projectId: 'p1', agentKind: 'review', baseModel: 'qwen',
    });
    expect(coding.ask).toBe(true);
    expect(coding.train_host).toBe('orin');
    expect(coding.tools).toEqual(TOOL_CURRICULA.coding);
    expect(review.tools).toEqual(TOOL_CURRICULA.review);
    expect(review.message).toMatch(/Orin/);
  });

  test('enqueue → succeed → distribute plan for qwen and gemma4', () => {
    const q = loraTrain.enqueue({
      projectId: 'p1', agentKind: 'manager', baseModel: 'qwen', adapterName: 'mgr-qwen',
    });
    expect(q.status).toBe('queued');
    expect(q.train_host).toBe('orin');
    loraTrain.update(q.id, {
      status: 'succeeded', adapter_path: '/models/lora/mgr-qwen', adapter_version: 'v1',
    });
    expect(loraTrain.get(q.id).distribute.move).toBe(false);

    const g = loraTrain.enqueue({
      projectId: 'p1', agentKind: 'user', baseModel: 'gemma4', adapterName: 'user-gemma',
    });
    loraTrain.update(g.id, {
      status: 'succeeded', adapter_path: '/models/lora/user-gemma',
    });
    expect(loraTrain.get(g.id).distribute.move).toBe(true);
    loraTrain.markDistributeStep(g.id, 1, 'done', { bytes: 12 });
    expect(loraTrain.get(g.id).distribute.steps[1].status).toBe('done');
  });

  test('targets() documents qwen + gemma4 routes', () => {
    const t = loraTrain.targets();
    expect(t.bases.qwen).toMatch(/Orin/);
    expect(t.bases.gemma4).toMatch(/prod-mini/);
    expect(DEFAULT_BASE.coding).toBe('qwen');
    expect(DEFAULT_BASE.user).toBe('gemma4');
    expect(MODEL_ROUTES.qwen.serve_on).toContain('orin');
  });
});
