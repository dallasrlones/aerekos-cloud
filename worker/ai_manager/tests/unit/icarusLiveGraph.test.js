'use strict';

process.env.ICARUS_GRAPH_MEMORY = '1';

const { createPlanGraphStore } = require('../../api/services/graph/PlanGraphStore');
const { taskTrace, scrubSubgraph } = require('../../api/services/TaskTraceService');
const { forProject } = require('../../api/services/IcarusFacade');

describe('live graph emits + task trace', () => {
  test('setTaskStatus records history and trace lists tools', async () => {
    const f = forProject(`live-${Date.now()}`, {});
    await f.boot();
    const plan = await f.graph.createPlan({ title: 'live' });
    const t = await f.graph.addTask(plan.id, { title: 'work' });
    await f.graph.setTaskStatus(t.id, 'running');
    // ensure distinct timestamps for scrub (same-ms collapses on busy CI)
    await new Promise((r) => setTimeout(r, 2));
    await f.graph.setTaskStatus(t.id, 'done');
    const again = await f.graph.getTask(t.id);
    expect(again.status_history?.length).toBeGreaterThanOrEqual(2);

    f.ledger.append({
      projectId: f.projectId,
      tool: 'file_edit',
      taskId: t.id,
      args: { path: 'x.js', task_id: t.id },
      ok: true,
    });

    const trace = await taskTrace(f, t.id, { projectId: f.projectId });
    expect(trace.task.id).toBe(t.id);
    expect(trace.tools.some((r) => r.tool === 'file_edit')).toBe(true);

    const sub = await f.graph.subgraph(plan.id);
    const mid = again.status_history[0].at;
    const scrubbed = scrubSubgraph(sub, mid);
    expect(scrubbed.tasks.find((x) => x.id === t.id).status).toBe('running');
    const end = scrubSubgraph(sub, again.status_history[1].at);
    expect(end.tasks.find((x) => x.id === t.id).status).toBe('done');
  });

  test('listPlans can filter done', async () => {
    const graph = createPlanGraphStore(`hist-${Date.now()}`, { forceMemory: true });
    const a = await graph.createPlan({ title: 'active' });
    const b = await graph.createPlan({ title: 'old' });
    graph.plans.get(b.id).status = 'done';
    const all = await graph.listPlans();
    expect(all.length).toBe(2);
    expect(all.find((p) => p.id === a.id).status).toBe('active');
  });
});
