'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('balancer_manager crud', () => {
  const pid = 'p-balancer_manager-' + Date.now();

  test('create list get update delete + health endpoints', async () => {
    const c = await request(app)
      .post('/api/v1/targets')
      .send({
        project_id: pid,
        name: 'n1',
        address: 'http://127.0.0.1:9',
        pool: 'edge',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/targets?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.some((i) => i.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/targets/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('n1');

    const u = await request(app)
      .patch('/api/v1/targets/' + id + '?' + Q(pid))
      .send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const healthOne = await request(app).get(
      '/api/v1/targets/' + id + '/health?' + Q(pid)
    );
    expect(healthOne.status).toBe(200);
    expect(healthOne.body.total).toBe(1);

    const healthPool = await request(app).get(
      '/api/v1/targets/health?' + Q(pid) + '&pool=edge'
    );
    expect(healthPool.status).toBe(200);
    expect(healthPool.body.total).toBeGreaterThanOrEqual(1);

    const missing = await request(app).get('/api/v1/targets?' + Q(''));
    expect(missing.status).toBe(400);

    const d = await request(app).delete('/api/v1/targets/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });
});
