'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('push_manager crud', () => {
  const pid = 'p-push_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/subscriptions').send({
      project_id: pid,
      name: 'n1',
      endpoint: 'device-token-1',
      kind: 'web',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/subscriptions?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/subscriptions/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/subscriptions/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/subscriptions/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('send under SKIP_PUSH / SKIP_OUTBOUND stays queue-only', async () => {
    const res = await request(app)
      .post('/api/v1/send')
      .send({ to: 'device-token', title: 'hi', body: 'hello' });
    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(true);
    expect(String(res.body.reason || '')).toMatch(/queue_only|queued/);
  });

  test('create without project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/subscriptions').send({ name: 'no-pid' });
    expect(res.status).toBe(400);
  });
});
