'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('host_manager crud', () => {
  const pid = 'p-host_manager-' + Date.now();

  test('create list get update delete', async () => {
    const c = await request(app)
      .post('/api/v1/hosts')
      .send({
        project_id: pid,
        name: 'h1',
        hostname: 'n1',
        address: '10.0.0.1',
        role: 'worker',
        metadata: '{}',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    expect(c.body.item.name).toBe('h1');

    const list = await request(app).get('/api/v1/hosts?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.some((h) => h.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/hosts/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.hostname).toBe('n1');

    const u = await request(app)
      .patch('/api/v1/hosts/' + id + '?' + Q(pid))
      .send({ name: 'h2', address: '10.0.0.2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('h2');
    expect(u.body.item.address).toBe('10.0.0.2');

    const d = await request(app).delete('/api/v1/hosts/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);

    const missing = await request(app).get('/api/v1/hosts/' + id + '?' + Q(pid));
    expect(missing.status).toBe(404);
  });

  test('create requires project_id and name', async () => {
    const noProject = await request(app).post('/api/v1/hosts').send({ name: 'x' });
    expect(noProject.status).toBe(400);
    const noName = await request(app).post('/api/v1/hosts').send({ project_id: pid });
    expect(noName.status).toBe(400);
  });

  test('sync without conductor returns 503', async () => {
    const prev = process.env.CONDUCTOR_URL;
    const prevInternal = process.env.CONDUCTOR_INTERNAL_BASE_URL;
    delete process.env.CONDUCTOR_URL;
    delete process.env.CONDUCTOR_INTERNAL_BASE_URL;
    const res = await request(app).post('/api/v1/sync').send({ project_id: pid });
    expect(res.status).toBe(503);
    if (prev !== undefined) process.env.CONDUCTOR_URL = prev;
    if (prevInternal !== undefined) process.env.CONDUCTOR_INTERNAL_BASE_URL = prevInternal;
  });
});
