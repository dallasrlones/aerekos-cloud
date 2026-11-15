'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('system_manager crud', () => {
  const pid = 'p-system_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app)
      .post('/api/v1/tasks')
      .send({ project_id: pid, name: 't1', spec_json: '{}', state: 'pending' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/tasks/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('t1');
    const u = await request(app)
      .patch('/api/v1/tasks/' + id + '?' + Q(pid))
      .send({ name: 't2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('t2');
    const d = await request(app).delete('/api/v1/tasks/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('run without image/url returns 400', async () => {
    const c = await request(app)
      .post('/api/v1/tasks')
      .send({ project_id: pid, name: 'run-bad', spec_json: '{}', state: 'pending' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const r = await request(app).post('/api/v1/tasks/' + id + '/run?' + Q(pid));
    expect(r.status).toBe(400);
  });
});
