'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('vpn_manager peers crud', () => {
  const pid = 'p-vpn_manager-crud-' + Date.now();

  test('create get list update delete', async () => {
    const c = await request(app).post('/api/v1/peers').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/peers/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('n1');

    const list = await request(app).get('/api/v1/peers?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((x) => x.id === id)).toBe(true);

    const u = await request(app).patch('/api/v1/peers/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/peers/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });
});
