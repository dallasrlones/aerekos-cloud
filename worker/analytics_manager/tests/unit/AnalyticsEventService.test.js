'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-analytics-unit');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}_${process.pid}.db`);
}

const { AnalyticsEventService } = require('../../api/services/AnalyticsEventService');

describe('AnalyticsEventService', () => {
  const svc = new AnalyticsEventService();
  const pid = `p-unit-${Date.now()}`;

  test('create requires project_id and name', async () => {
    await expect(svc.create({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.create({ project_id: pid })).rejects.toMatchObject({ status: 400 });
  });

  test('create list get update delete round-trip', async () => {
    const created = await svc.create({
      project_id: pid,
      name: 'signup',
      event: 'user.signup',
      value: '1',
      properties: '{"plan":"free"}',
    });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('signup');

    const listed = await svc.list(pid);
    expect(listed.some((r) => r.id === created.id)).toBe(true);

    const got = await svc.get(created.id, pid);
    expect(got.event).toBe('user.signup');

    const updated = await svc.update(created.id, pid, { value: '2' });
    expect(updated.value).toBe('2');

    await expect(svc.create({ project_id: pid, name: 'signup' })).rejects.toMatchObject({
      status: 409,
    });

    const del = await svc.del(created.id, pid);
    expect(del.deleted).toBe(true);
    await expect(svc.get(created.id, pid)).rejects.toMatchObject({ status: 404 });
  });
});
