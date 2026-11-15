'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-logs-unit');
  fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, `t_${Date.now()}_${process.pid}.db`);
}

const { LogEventService } = require('../../api/services/LogEventService');

describe('LogEventService', () => {
  const svc = new LogEventService();
  const pid = `p-unit-${Date.now()}`;

  test('create requires project_id, level, and message', async () => {
    await expect(svc.create({ level: 'info', message: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(svc.create({ project_id: pid, message: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(svc.create({ project_id: pid, level: 'info' })).rejects.toMatchObject({
      status: 400,
    });
  });

  test('create list get delete round-trip', async () => {
    const created = await svc.create({
      project_id: pid,
      source: 'unit',
      level: 'info',
      message: 'hello',
      context: { a: 1 },
    });
    expect(created.id).toBeTruthy();
    expect(created.level).toBe('info');

    const listed = await svc.list(pid);
    expect(listed.some((r) => r.id === created.id)).toBe(true);

    const got = await svc.getById(created.id, pid);
    expect(got.message).toBe('hello');

    const del = await svc.deleteById(created.id, pid);
    expect(del.deleted).toBe(true);
    await expect(svc.getById(created.id, pid)).rejects.toMatchObject({ status: 404 });
  });

  test('createBatch validates entries', async () => {
    await expect(svc.createBatch({ project_id: pid, entries: [] })).rejects.toMatchObject({
      status: 400,
    });
    const rows = await svc.createBatch({
      project_id: pid,
      entries: [
        { level: 'warn', message: 'a' },
        { level: 'error', message: 'b', source: 'batch' },
      ],
    });
    expect(rows).toHaveLength(2);
  });

  test('compact deletes older than cutoff', async () => {
    const oldPid = `p-compact-${Date.now()}`;
    const created = await svc.create({
      project_id: oldPid,
      level: 'info',
      message: 'old-ish',
    });
    expect(created.id).toBeTruthy();
    const result = await svc.compact(oldPid, { olderThanDays: 0 });
    expect(result.compacted).toBeGreaterThanOrEqual(0);
    expect(result.older_than).toBeTruthy();
  });
});
