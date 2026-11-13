'use strict';

process.env.ICARUS_GRAPH_MEMORY = '1';

const {
  createPlanGraphStore, MemoryPlanGraphStore, RELS,
} = require('../../api/services/graph/PlanGraphStore');
const { SchedulerService } = require('../../api/services/SchedulerService');
const { WatchdogService } = require('../../api/services/WatchdogService');

describe('PlanGraphStore (memory SOR stand-in)', () => {
  let graph;

  beforeEach(() => {
    graph = createPlanGraphStore('proj-1', { forceMemory: true });
    expect(graph).toBeInstanceOf(MemoryPlanGraphStore);
  });

  test('create plan + tasks + readySet respects BEFORE', async () => {
    const plan = await graph.createPlan({ title: 'Ship', goal: 'done' });
    const a = await graph.addTask(plan.id, { title: 'A', priority: 1 });
    const b = await graph.addTask(plan.id, { title: 'B', priority: 2 });
    await graph.linkBefore(a.id, b.id);

    let ready = await graph.readySet(plan.id);
    expect(ready.map((t) => t.title)).toEqual(['A']);

    await graph.setTaskStatus(a.id, 'done');
    ready = await graph.readySet(plan.id);
    expect(ready.map((t) => t.title)).toContain('B');
  });

  test('MUTEX blocks peer while running', async () => {
    const plan = await graph.createPlan({ title: 'Lock' });
    const a = await graph.addTask(plan.id, { title: 'A' });
    const b = await graph.addTask(plan.id, { title: 'B' });
    await graph.linkMutex(a.id, b.id);
    await graph.setTaskStatus(a.id, 'running');
    const ready = await graph.readySet(plan.id);
    expect(ready.find((t) => t.id === b.id)).toBeFalsy();
  });

  test('INVALIDATES marks victim', async () => {
    const plan = await graph.createPlan({ title: 'Dyn' });
    const a = await graph.addTask(plan.id, { title: 'A' });
    const b = await graph.addTask(plan.id, { title: 'B' });
    await graph.invalidate(a.id, b.id, 'stale');
    expect((await graph.getTask(b.id)).status).toBe('invalidated');
    expect(graph.edges.some((e) => e.type === RELS.INVALIDATES)).toBe(true);
  });

  test('subgraph returns tasks and edges', async () => {
    const plan = await graph.createPlan({ title: 'G' });
    const a = await graph.addTask(plan.id, { title: 'A' });
    const b = await graph.addTask(plan.id, { title: 'B' });
    await graph.linkParallel(a.id, b.id);
    const sub = await graph.subgraph(plan.id);
    expect(sub.tasks).toHaveLength(2);
    expect(sub.edges.some((e) => e.type === 'PARALLEL')).toBe(true);
  });

  test('scheduler launches PARALLEL batch within maxParallel', async () => {
    const plan = await graph.createPlan({ title: 'P' });
    const a = await graph.addTask(plan.id, { title: 'A', priority: 5 });
    const b = await graph.addTask(plan.id, { title: 'B', priority: 5 });
    await graph.linkParallel(a.id, b.id);
    const launched = [];
    const sched = new SchedulerService({
      graph,
      maxParallel: 2,
      spawn: async (t) => { launched.push(t.id); },
    });
    const out = await sched.tick(plan.id);
    expect(out.launched).toHaveLength(2);
    expect(launched).toHaveLength(2);
    expect((await graph.getTask(a.id)).status).toBe('running');
  });

  test('watchdog nudges stalled running tasks', async () => {
    const plan = await graph.createPlan({ title: 'W' });
    const t = await graph.addTask(plan.id, { title: 'stuck' });
    await graph.setTaskStatus(t.id, 'running');
    // force old updated_at
    graph.tasks.get(t.id).updated_at = Date.now() - 200_000;
    const nudges = [];
    const wd = new WatchdogService({
      graph,
      options: { stallMs: 1000, tickMs: 60_000 },
      onNudge: async (ev) => { nudges.push(ev); },
    });
    const out = await wd.tick();
    expect(out.stalled.length).toBe(1);
    expect(nudges[0].type).toBe('stall');
  });

  test('projectHierarchy lists phases and nested tasks', async () => {
    const plan = await graph.createPlan({ title: 'Hierarchy' });
    const phase = await graph.addTask(plan.id, { title: 'Phase 1', kind: 'phase' });
    const child = await graph.addTask(plan.id, { title: 'Implement', parentId: phase.id });
    const phases = await graph.listPhases(plan.id);
    expect(phases).toHaveLength(1);
    expect(phases[0].title).toBe('Phase 1');
    const tree = await graph.taskHierarchy(plan.id);
    expect(tree.phases).toHaveLength(1);
    expect(tree.phases[0].children).toHaveLength(1);
    expect(tree.phases[0].children[0].title).toBe('Implement');
    const project = await graph.projectHierarchy();
    expect(project.project_id).toBe('proj-1');
    expect(project.plans).toHaveLength(1);
    expect(project.plans[0].hierarchy[0].children[0].id).toBe(child.id);
  });

  test('recordDecision + checkpoint', async () => {
    const plan = await graph.createPlan({ title: 'D' });
    const t = await graph.addTask(plan.id, { title: 'T' });
    const d = await graph.recordDecision({
      planId: plan.id, taskId: t.id, why: 'because tests',
    });
    expect(d.id).toBeTruthy();
    const cp = await graph.createCheckpoint({
      planId: plan.id, label: 't1', snapshot: { tasks: [t] },
    });
    expect(cp.id).toBeTruthy();
  });
});
