'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-metrics-unit');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}_${process.pid}.db`);
}

require('../../api/models');
const { MetricSeriesService } = require('../../api/services/MetricSeriesService');

describe('MetricSeriesService', () => {
  const svc = new MetricSeriesService();
  const pid = `p-unit-${Date.now()}`;

  test('create requires project_id and name', async () => {
    await expect(svc.create({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create({ project_id: pid })).rejects.toMatchObject({ status: 400 });
  });

  test('create list get update delete round-trip', async () => {
    const created = await svc.create({
      project_id: pid,
      name: 'cpu',
      metric_name: 'cpu',
      value: '0.5',
      labels: '{}',
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('cpu');

    const listed = await svc.list(pid);
    expect(listed.some((r) => r.id === created.id)).toBe(true);

    const got = await svc.get(created.id, pid);
    expect(got.value).toBe('0.5');

    const updated = await svc.update(created.id, pid, { value: '0.9' });
    expect(updated.value).toBe('0.9');

    const del = await svc.del(created.id, pid);
    expect(del.deleted).toBe(true);
    await expect(svc.get(created.id, pid)).rejects.toMatchObject({ status: 404 });
  });

  test('sample upserts by name', async () => {
    const pid2 = `p-sample-${Date.now()}`;
    const first = await svc.sample({
      project_id: pid2,
      name: 'mem',
      value: '10',
      labels: { host: 'a' },
    });
    expect(first.value).toBe('10');
    const second = await svc.sample({
      project_id: pid2,
      name: 'mem',
      value: '20',
      labels: { host: 'a' },
    });
    expect(second.id).toBe(first.id);
    expect(second.value).toBe('20');
  });

  test('create rejects duplicate name', async () => {
    const pid3 = `p-dup-${Date.now()}`;
    await svc.create({ project_id: pid3, name: 'dup', value: '1' });
    await expect(svc.create({ project_id: pid3, name: 'dup', value: '2' })).rejects.toMatchObject({
      status: 409,
    });
  });
});
