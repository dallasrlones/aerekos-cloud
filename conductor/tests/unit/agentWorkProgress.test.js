const {
  progressOf, planProgress, currentWork, formatPct,
} = require('../../app/utils/agentWorkProgress');

describe('agentWorkProgress', () => {
  const goal = { id: 'g1', kind: 'goal', title: 'Finish docs', status: 'running' };
  const tasks = [
    { id: 't1', kind: 'task', parent_id: 'g1', title: 'Catalog', status: 'done' },
    { id: 't2', kind: 'task', parent_id: 'g1', title: 'Runbooks', status: 'running' },
    { id: 't3', kind: 'task', parent_id: 'g1', title: 'SDK', status: 'queued' },
  ];
  const work = [goal, ...tasks];

  it('counts descendant tasks for a goal', () => {
    const p = progressOf(goal, work);
    expect(p.total).toBe(3);
    expect(p.done).toBe(1);
    expect(p.pct).toBe(33);
    expect(p.currentTitle).toBe('Runbooks');
  });

  it('includes the task itself plus children', () => {
    const child = { id: 'c1', kind: 'task', parent_id: 't2', title: 'icarus-agents', status: 'queued' };
    const p = progressOf(tasks[1], [...work, child]);
    expect(p.total).toBe(2);
    expect(p.currentTitle).toBe('Runbooks');
  });

  it('falls back to plan steps when the graph is empty', () => {
    const plan = { steps: [{ title: 'A', status: 'done' }, { title: 'B', status: 'queued' }] };
    expect(planProgress(plan)).toMatchObject({ total: 2, done: 1, pct: 50, currentTitle: 'B' });
    expect(progressOf(goal, [goal], plan).source).toBe('plan');
  });

  it('names the in-flight worker', () => {
    const now = currentWork(
      [{ id: 'w1', status: 'running', objective: 'edit llms.txt', work_item_id: 't2', persona: 'dev' }],
      work,
    );
    expect(now.label).toBe('edit llms.txt');
    expect(now.task.title).toBe('Runbooks');
    expect(formatPct({ pct: 33, done: 1, total: 3 })).toBe('33% (1/3)');
  });
});
