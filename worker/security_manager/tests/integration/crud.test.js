'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('security_manager crud', () => {
  const pid = 'p-security_manager-' + Date.now();

  test('create get update delete finding', async () => {
    const c = await request(app)
      .post('/api/v1/findings')
      .send({
        project_id: pid,
        name: 'f1',
        severity: 'low',
        source: 'unit',
        details: '{}',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/findings/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('f1');

    const list = await request(app).get('/api/v1/findings?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((i) => i.id === id)).toBe(true);

    const u = await request(app)
      .patch('/api/v1/findings/' + id + '?' + Q(pid))
      .send({ name: 'f2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('f2');

    const d = await request(app).delete('/api/v1/findings/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('POST /api/v1/findings/scan creates metadata-only finding', async () => {
    const res = await request(app)
      .post('/api/v1/findings/scan')
      .send({ project_id: pid, summary: 'closeout scan' });
    expect(res.status).toBe(201);
    expect(res.body.item).toBeTruthy();
    expect(res.body.note).toMatch(/metadata only/i);
  });

  test('missing project_id returns 400', async () => {
    const res = await request(app).post('/api/v1/findings').send({ name: 'no-pid' });
    expect(res.status).toBe(400);
  });
});
