'use strict';

process.env.ICARUS_GRAPH_MEMORY = '1';

const { charter, DEFAULT_CHARTER } = require('../../api/services/CharterService');
const { ActionLedger } = require('../../api/services/ActionLedger');
const { ExplainService } = require('../../api/services/ExplainService');
const { CheckpointService } = require('../../api/services/CheckpointService');
const { TeachByDemo } = require('../../api/services/TeachByDemo');
const { WorldSync } = require('../../api/services/WorldSync');
const { SkillRegistry } = require('../../api/services/SkillRegistry');
const { SkillMarketplace } = require('../../api/services/SkillMarketplace');
const { energy, pickTier } = require('../../api/services/EnergyRouter');
const { uxSlo, SLO } = require('../../api/services/UxSlo');
const { createPlanGraphStore } = require('../../api/services/graph/PlanGraphStore');
const { forProject } = require('../../api/services/IcarusFacade');
const { bundled, effectivePrompts, REVIEW } = require('../../api/services/defaultPrompts');
const { toolSchemas, READ_TOOLS } = require('../../api/services/workspaceTools');

describe('Phase 7–8 platform + prompts + tools', () => {
  test('charter blocks wipe/prod and asks before deploy', () => {
    expect(DEFAULT_CHARTER.never_wipe_prod).toBe(true);
    expect(charter.check('p1', 'wipe production db').allow).toBe(false);
    expect(charter.check('p1', 'deploy frontend').ask).toBe(true);
    expect(charter.check('p1', 'read README').allow).toBe(true);
  });

  test('action ledger undo/diff', () => {
    const led = new ActionLedger();
    const row = led.append({
      projectId: 'p1', tool: 'file_edit', before: 'a', after: 'b', reversible: true,
    });
    expect(led.diff(row.id).before).toBe('a');
    expect(led.markUndone(row.id).undone).toBe(true);
    expect(led.list('p1')).toHaveLength(1);
  });

  test('explain why + checkpoints time-travel', async () => {
    const graph = createPlanGraphStore('p1', { forceMemory: true });
    const plan = await graph.createPlan({ title: 'X' });
    const task = await graph.addTask(plan.id, { title: 'T' });
    await graph.recordDecision({ taskId: task.id, why: 'tests said so' });
    const led = new ActionLedger();
    led.append({
      projectId: 'p1', tool: 'scheduler_spawn', args: { task_id: task.id },
    });
    const explain = new ExplainService({ graph, ledger: led });
    const why = await explain.whyTask('p1', task.id);
    expect(why.summary).toMatch(/T/);

    const cps = new CheckpointService({ graph });
    await graph.setTaskStatus(task.id, 'running');
    const cp = await cps.save('p1', {
      planId: plan.id,
      label: 'mid',
      snapshot: { tasks: [{ id: task.id, status: 'pending' }] },
    });
    await cps.restore('p1', cp.id);
    expect((await graph.getTask(task.id)).status).toBe('pending');
  });

  test('teach-by-demo → skill draft ASK', () => {
    const skills = new SkillRegistry();
    const teach = new TeachByDemo({ skills });
    const s = teach.start('p1', { title: 'click save' });
    teach.addStep(s.id, { tool: 'browser_click', args: { selector: 'Save' } });
    const done = teach.finish(s.id);
    expect(done.ask.type).toBe('promote_skill');
    expect(skills.get(done.skill_id).kind).toBe('prompt');
  });

  test('world sync + marketplace install', async () => {
    const world = new WorldSync();
    await world.ingest('p1', { entityId: 't1', text: 'API is down', source: 'web' });
    expect(world.recent('p1')[0].text).toMatch(/API/);

    const skills = new SkillRegistry();
    const src = skills.upsert({ name: 'ship', kind: 'prompt', body: 'do it' });
    const market = new SkillMarketplace();
    const listing = market.publish({
      projectId: 'p1', skillId: src.id, name: 'ship', visibility: 'project',
    });
    const inst = market.install(listing.id, { projectId: 'p2', skills });
    expect(inst.skill.name).toMatch(/install/);
    expect(listing.installs).toBe(1);
  });

  test('energy: train always Orin; review prefers local_orin', () => {
    expect(pickTier({ lane: 'train' }).tier).toBe('local_orin');
    expect(pickTier({ lane: 'review', preferLocal: true }).tier).toBe('local_orin');
    energy.record('p1', 1);
    expect(energy.spendToday('p1')).toBe(1);
  });

  test('UX SLOs recorded', () => {
    expect(SLO.gate_classify_ms).toBe(100);
    uxSlo.record('gate_classify_ms', 40);
    uxSlo.record('gate_classify_ms', 120);
    const s = uxSlo.summary();
    expect(s.metrics.gate_classify_ms.n).toBeGreaterThanOrEqual(2);
    expect(s.metrics.gate_classify_ms.ok_rate).toBeLessThan(1);
  });

  test('prompts: REVIEW + PR/higher-model + Orin LoRA language', () => {
    const b = bundled();
    expect(b.review).toBe(REVIEW);
    expect(b.manager).toMatch(/higher-model/);
    expect(b.worker).toMatch(/open_pr/);
    expect(b.manager).toMatch(/Orin/);
    const e = effectivePrompts({ prompts: { review: 'custom' } });
    expect(e.review).toBe('custom');
  });

  test('tool schemas include plan + approve_pr + lora_propose', () => {
    const names = toolSchemas().map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'open_pr', 'approve_pr', 'lora_propose', 'plan_query', 'plan_ready', 'plan_subgraph', 'explain_why',
    ]));
    expect(READ_TOOLS.has('plan_query')).toBe(true);
  });

  test('IcarusFacade wires graph/gate/pr/lora', async () => {
    const f = forProject(`proj-${Date.now()}`, { max_parallel_workers: 2 });
    await f.boot();
    const plan = await f.graph.createPlan({ title: 'facade' });
    expect(plan.id).toBeTruthy();
    const gate = await f.gate.route('implement feature');
    expect(gate.route).toBe('MANAGER');
    expect(f.loraTrain.targets().train_host).toBe('orin');
    expect(f.prReviews).toBeTruthy();
    expect(f.gateway().snapshot()).toHaveProperty('max_concurrent');
  });
});
