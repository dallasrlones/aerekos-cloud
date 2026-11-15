'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('waf_manager crud + evaluate', () => {
  const pid = 'p-waf_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/rules').send({
      project_id: pid,
      name: 'n1',
      action: 'block',
      path: '/admin',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/rules?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/rules/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/rules/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/rules/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('evaluate applies local path/cidr rules (not a cloud WAF engine)', async () => {
    const evalPid = 'p-waf_manager-eval-' + Date.now();
    const created = await request(app).post('/api/v1/rules').send({
      project_id: evalPid,
      name: 'block-admin',
      action: 'block',
      path: '/admin',
    });
    expect(created.status).toBe(201);

    const blocked = await request(app)
      .post('/api/v1/evaluate')
      .send({ project_id: evalPid, path: '/admin/users', ip: '1.2.3.4' });
    expect(blocked.status).toBe(200);
    expect(blocked.body.action).toBe('block');

    const allowed = await request(app)
      .post('/api/v1/evaluate')
      .send({ project_id: evalPid, path: '/public', ip: '1.2.3.4' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.action).toBe('allow');
  });
});
