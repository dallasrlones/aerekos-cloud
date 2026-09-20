const { applyJobEvent } = require('../../app/utils/jobEvents');

describe('applyJobEvent', () => {
  const existing = [{ id: 'a', project_id: 'p1', summary: 'old' }];

  test('prepends a created job and dedupes', () => {
    const next = applyJobEvent(existing, {
      action: 'created',
      project_id: 'p1',
      job: { id: 'b', project_id: 'p1', summary: 'new' },
    }, 'p1');
    expect(next.map((j) => j.id)).toEqual(['b', 'a']);

    const again = applyJobEvent(next, {
      action: 'created',
      project_id: 'p1',
      job: { id: 'b', project_id: 'p1', summary: 'updated' },
    }, 'p1');
    expect(again).toHaveLength(2);
    expect(again[0].summary).toBe('updated');
  });

  test('removes a deleted job', () => {
    const next = applyJobEvent(existing, {
      action: 'deleted',
      project_id: 'p1',
      job: { id: 'a', project_id: 'p1' },
    }, 'p1');
    expect(next).toEqual([]);
  });

  test('ignores jobs from another project', () => {
    const next = applyJobEvent(existing, {
      action: 'created',
      project_id: 'p2',
      job: { id: 'c', project_id: 'p2' },
    }, 'p1');
    expect(next).toEqual(existing);
  });
});
