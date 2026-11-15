'use strict';

const { AppProjectService } = require('../../api/services/AppProjectService');

describe('AppProjectService', () => {
  const service = new AppProjectService();

  test('create requires project_id and name', async () => {
    await expect(service.create({ name: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(service.create({ project_id: 'p1' })).rejects.toMatchObject({ status: 400 });
  });

  test('create list get update delete round-trip', async () => {
    const pid = 'p-app-unit-' + Date.now();
    const created = await service.create({
      project_id: pid,
      name: 'demo',
      repo_url: 'https://g/a',
      build_command: 'npm test',
      metadata: '{}',
    });
    expect(created.name).toBe('demo');
    const listed = await service.list(pid);
    expect(listed.some((x) => x.id === created.id)).toBe(true);
    const got = await service.get(created.id, pid);
    expect(got.name).toBe('demo');
    const updated = await service.update(created.id, pid, { name: 'demo2' });
    expect(updated.name).toBe('demo2');
    const del = await service.del(created.id, pid);
    expect(del.deleted).toBe(true);
    await expect(service.get(created.id, pid)).rejects.toMatchObject({ status: 404 });
  });

  test('scaffold returns files and stores metadata JSON', async () => {
    const pid = 'p-app-scaffold-' + Date.now();
    const out = await service.scaffold(pid, { name: 'fe', pages: ['admin', 'custom'] });
    expect(out.open_in_ide).toBe(true);
    expect(out.files['README.md']).toMatch(/Scaffolded/);
    expect(out.files['src/Admin.jsx']).toBeTruthy();
    expect(out.files['src/App.jsx']).toBeTruthy();
    expect(out.item.name).toBe('fe');
    const meta = JSON.parse(out.item.metadata || '{}');
    expect(meta.scaffold).toBe(true);
    expect(meta.files).toContain('README.md');
  });

  test('duplicate name returns 409', async () => {
    const pid = 'p-app-dup-' + Date.now();
    await service.create({ project_id: pid, name: 'same' });
    await expect(service.create({ project_id: pid, name: 'same' })).rejects.toMatchObject({ status: 409 });
  });
});
