'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('analytics_manager crud + query-on-storage', () => {
  const pid = 'p-analytics_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app)
      .post('/api/v1/events')
      .send({
        project_id: pid,
        name: 'click',
        event: 'ui.click',
        value: '1',
        properties: '{}',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/events?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.some((i) => i.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/events/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('click');

    const u = await request(app)
      .patch('/api/v1/events/' + id + '?' + Q(pid))
      .send({ name: 'click2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('click2');

    const d = await request(app).delete('/api/v1/events/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('POST /api/v1/query-on-storage runs SELECT against loaded events', async () => {
    const c = await request(app)
      .post('/api/v1/events')
      .send({ project_id: pid, name: 'q1', event: 'query.hit', value: '9', properties: '{}' });
    expect(c.status).toBe(201);

    const q = await request(app)
      .post('/api/v1/query-on-storage')
      .send({ project_id: pid, sql: "SELECT name, event FROM events WHERE name = 'q1'" });
    expect(q.status).toBe(200);
    expect(q.body.engine).toBe('sqlite');
    expect(q.body.rows.some((r) => r.name === 'q1' && r.event === 'query.hit')).toBe(true);
  });

  test('query-on-storage rejects ATTACH', async () => {
    const q = await request(app)
      .post('/api/v1/query-on-storage')
      .send({ project_id: pid, sql: 'ATTACH DATABASE \':memory:\' AS other' });
    expect(q.status).toBe(400);
  });
});
