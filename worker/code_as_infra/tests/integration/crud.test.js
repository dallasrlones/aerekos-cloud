const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('code_as_infra crud', () => {
  const pid = 'p-code_as_infra-' + Date.now();

  test('create get update list delete', async () => {
    const c = await request(app)
      .post('/api/v1/modules')
      .send({ project_id: pid, name: 'm1', kind: 'json', content: '{}' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/modules/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('m1');

    const u = await request(app)
      .patch('/api/v1/modules/' + id + '?' + Q(pid))
      .send({ name: 'm2', content: '{"ok":true}' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('m2');

    const list = await request(app).get('/api/v1/modules?' + Q(pid));
    expect(list.status).toBe(200);
    expect(list.body.items.some((x) => x.id === id)).toBe(true);

    const d = await request(app).delete('/api/v1/modules/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('create rejects missing project_id', async () => {
    const res = await request(app).post('/api/v1/modules').send({ name: 'x' });
    expect(res.status).toBe(400);
  });
});
