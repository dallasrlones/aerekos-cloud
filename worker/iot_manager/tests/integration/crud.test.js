'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('iot_manager crud', () => {
  const pid = 'p-iot_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/things').send({ project_id: pid, name: 'n1', topic: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/things?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/things/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/things/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/things/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('publish skips outbound under SKIP_OUTBOUND', async () => {
    const res = await request(app)
      .post('/api/v1/publish')
      .send({ project_id: pid, topic: 'demo', payload: { ping: 1 } });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.skipped).toBe(true);
  });
});
