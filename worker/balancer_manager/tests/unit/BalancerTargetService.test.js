'use strict';

const { BalancerTargetService } = require('../../api/services/BalancerTargetService');

describe('BalancerTargetService', () => {
  const s = new BalancerTargetService();
  const pid = 'p-unit-balancer-' + Date.now();

  test('create requires project_id and name', async () => {
    await expect(s.create({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(s.create({ project_id: pid })).rejects.toMatchObject({ status: 400 });
  });

  test('create list get update delete + healthSummary (SKIP_HEALTH)', async () => {
    const row = await s.create({
      project_id: pid,
      name: 'web',
      address: 'http://127.0.0.1:9',
      pool: 'default',
    });
    expect(row.name).toBe('web');
    expect(row.health_check_path).toBe('/health');

    const listed = await s.list(pid);
    expect(listed.some((r) => r.id === row.id)).toBe(true);

    const got = await s.get(row.id, pid);
    expect(got.name).toBe('web');

    const updated = await s.update(row.id, pid, { name: 'web2' });
    expect(updated.name).toBe('web2');

    const summary = await s.healthSummary(pid, { pool: 'default' });
    expect(summary.total).toBeGreaterThanOrEqual(1);
    expect(summary.healthy_host_count).toBeGreaterThanOrEqual(1);
    expect(summary.items[0].probe?.skipped).toBe(true);

    const del = await s.del(row.id, pid);
    expect(del.deleted).toBe(true);
    await expect(s.get(row.id, pid)).rejects.toMatchObject({ status: 404 });
  });

  test('duplicate name returns 409', async () => {
    await s.create({ project_id: pid, name: 'dup', address: 'http://127.0.0.1:9' });
    await expect(
      s.create({ project_id: pid, name: 'dup', address: 'http://127.0.0.1:9' })
    ).rejects.toMatchObject({ status: 409 });
  });
});
