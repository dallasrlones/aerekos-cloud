const { applyPullEvent, applyBenchEvent, applyLogAppend } = require('../../app/utils/liveEvents');

describe('liveEvents', () => {
  test('upserts a pull by model', () => {
    const next = applyPullEvent(
      [{ model: 'a', percent: 10, status: 'pulling' }],
      { pull: { model: 'a', percent: 40, status: 'pulling' } },
    );
    expect(next).toEqual([{ model: 'a', percent: 40, status: 'pulling' }]);
  });

  test('merges bench run into existing snapshot', () => {
    const next = applyBenchEvent(
      { run: { status: 'running', done: 0 }, items: [1] },
      { run: { status: 'running', done: 2 } },
    );
    expect(next.run.done).toBe(2);
    expect(next.items).toEqual([1]);
  });

  test('appends logs for the matching source and project', () => {
    const next = applyLogAppend(
      [{ id: '1', message: 'old' }],
      { project_id: 'p1', source: 'compute.t1', logs: [{ id: '2', message: 'new' }] },
      { source: 'compute.t1', projectId: 'p1' },
    );
    expect(next.map((r) => r.id)).toEqual(['1', '2']);
  });

  test('ignores logs for another container', () => {
    const prev = [{ id: '1' }];
    expect(applyLogAppend(prev, {
      source: 'compute.other',
      logs: [{ id: '2' }],
    }, { source: 'compute.t1' })).toEqual(prev);
  });
});
