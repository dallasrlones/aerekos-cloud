'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('cdn_manager crud', () => {
  const pid = 'p-cdn_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app)
      .post('/api/v1/rules')
      .send({
        project_id: pid,
        name: 'static',
        path_pattern: '/a/*',
        origin: 'https://o.example',
        cache_ttl_seconds: '60',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/rules/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('static');

    const u = await request(app)
      .patch('/api/v1/rules/' + id + '?' + Q(pid))
      .send({ name: 'static-2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('static-2');

    const list = await request(app).get('/api/v1/rules?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);

    const d = await request(app).delete('/api/v1/rules/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('purge without CF creds is honest', async () => {
    const res = await request(app).post('/api/v1/purge').send({});
    expect(res.status).toBe(200);
    expect(res.body.purged).toBe(false);
  });

  test('cache-rules parked endpoint never applied:true', async () => {
    const res = await request(app)
      .post('/api/v1/cache-rules')
      .send({ name: 't', expression: 'true', edge_ttl_seconds: 30 });
    expect(res.status).toBe(200);
    expect(res.body.applied).toBe(false);
  });
});
