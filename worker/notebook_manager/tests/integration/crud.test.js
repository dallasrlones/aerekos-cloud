'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('notebook_manager crud + run', () => {
  const pid = 'p-notebook_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/notebooks').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/notebooks?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/notebooks/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/notebooks/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/notebooks/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('run without CONDUCTOR_URL records queued honestly', async () => {
    delete process.env.CONDUCTOR_URL;
    delete process.env.CONDUCTOR_INTERNAL_BASE_URL;
    const c = await request(app).post('/api/v1/notebooks').send({ project_id: pid, name: 'run-me' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const r = await request(app)
      .post('/api/v1/notebooks/' + id + '/run?' + Q(pid))
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('queued');
    expect(String(r.body.note || '')).toMatch(/CONDUCTOR_URL/i);
    expect(r.body.item.status).toBe('queued');
  });
});
