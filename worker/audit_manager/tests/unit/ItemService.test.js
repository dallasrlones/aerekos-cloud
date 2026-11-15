'use strict';

const { ItemService } = require('../../api/services/ItemService');

describe('audit_manager ItemService', () => {
  const service = new ItemService();

  test('create requires project_id and name', async () => {
    await expect(service.create({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ project_id: 'p1' })).rejects.toMatchObject({ status: 400 });
  });

  test('create list get update delete round-trip', async () => {
    const pid = 'p-audit-unit-' + Date.now();
    const created = await service.create({
      project_id: pid,
      name: 'login',
      actor: 'user-1',
      action: 'auth.login',
      detail: '{"ok":true}',
    });
    expect(created.name).toBe('login');
    expect(created.actor).toBe('user-1');
    const listed = await service.list(pid);
    expect(listed.some((x) => x.id === created.id)).toBe(true);
    const got = await service.get(created.id, pid);
    expect(got.action).toBe('auth.login');
    const updated = await service.update(created.id, pid, { name: 'logout' });
    expect(updated.name).toBe('logout');
    const del = await service.del(created.id, pid);
    expect(del.deleted).toBe(true);
    await expect(service.get(created.id, pid)).rejects.toMatchObject({ status: 404 });
  });

  test('ensureDefaults seeds bootstrap once', async () => {
    const pid = 'p-audit-defaults-' + Date.now();
    const first = await service.ensureDefaults(pid);
    expect(first.created).toBe(true);
    expect(first.item.name).toBe('bootstrap');
    const second = await service.ensureDefaults(pid);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);
  });

  test('duplicate name returns 409', async () => {
    const pid = 'p-audit-dup-' + Date.now();
    await service.create({ project_id: pid, name: 'same' });
    await expect(service.create({ project_id: pid, name: 'same' })).rejects.toMatchObject({ status: 409 });
  });
});
