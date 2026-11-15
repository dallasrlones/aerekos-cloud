'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('app_manager crud + scaffold', () => {
  const pid = 'p-app_manager-' + Date.now();

  test('create get update list delete', async () => {
    const c = await request(app)
      .post('/api/v1/apps')
      .send({
        project_id: pid,
        name: 'app1',
        repo_url: 'https://g/a',
        build_command: 'npm test',
        metadata: '{}',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/apps/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('app1');

    const u = await request(app).patch('/api/v1/apps/' + id + '?' + Q(pid)).send({ name: 'app2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('app2');

    const listed = await request(app).get('/api/v1/apps?' + Q(pid));
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x) => x.id === id)).toBe(true);

    const d = await request(app).delete('/api/v1/apps/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('POST /api/v1/apps/scaffold', async () => {
    const res = await request(app)
      .post('/api/v1/apps/scaffold')
      .send({ project_id: pid, name: 'fe', template: 'admin_crud' });
    expect(res.status).toBe(201);
    expect(res.body.open_in_ide).toBe(true);
    expect(res.body.files['package.json']).toBeTruthy();
    expect(res.body.item.name).toBe('fe');
  });

  test('create without project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/apps').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});
