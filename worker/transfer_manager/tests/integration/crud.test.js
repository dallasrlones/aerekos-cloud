'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('transfer_manager crud', () => {
  const pid = 'p-transfer_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/endpoints').send({ project_id: pid, name: 'n1', bucket: 'demo' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/endpoints?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/endpoints/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/endpoints/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/endpoints/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('put/get refuse without CONDUCTOR_URL (honest storage proxy)', async () => {
    delete process.env.CONDUCTOR_URL;
    delete process.env.CONDUCTOR_INTERNAL_BASE_URL;
    const c = await request(app).post('/api/v1/endpoints').send({
      project_id: pid,
      name: 'copy-' + Date.now(),
      bucket: 'demo',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const put = await request(app)
      .post('/api/v1/endpoints/' + id + '/put?' + Q(pid))
      .send({ key: 'a.txt', content: 'hello' });
    expect(put.status).toBe(503);
    expect(String(put.body.error?.message || '')).toMatch(/CONDUCTOR_URL/i);

    const get = await request(app)
      .post('/api/v1/endpoints/' + id + '/get?' + Q(pid))
      .send({ key: 'a.txt' });
    expect(get.status).toBe(503);
    expect(String(get.body.error?.message || '')).toMatch(/CONDUCTOR_URL/i);
  });
});
