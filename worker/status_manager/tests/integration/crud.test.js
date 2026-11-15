'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('status_manager crud', () => {
  const pid = 'p-status_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/incidents').send({
      project_id: pid,
      name: 'n1',
      state: 'investigating',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/incidents?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/incidents/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/incidents/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/incidents/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('GET /api/v1/public aggregates ok/degraded', async () => {
    const pubPid = 'p-status_manager-public-' + Date.now();
    const empty = await request(app).get('/api/v1/public?' + Q(pubPid));
    expect(empty.status).toBe(200);
    expect(empty.body.status).toBe('ok');

    await request(app).post('/api/v1/incidents').send({
      project_id: pubPid,
      name: 'outage',
      state: 'investigating',
    });
    const degraded = await request(app).get('/api/v1/public?' + Q(pubPid));
    expect(degraded.status).toBe(200);
    expect(degraded.body.status).toBe('degraded');
    expect(Array.isArray(degraded.body.incidents)).toBe(true);
  });
});
