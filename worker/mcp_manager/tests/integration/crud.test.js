const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('mcp_manager crud', () => {
  const pid = 'p-mcp_manager-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/tools').send({
      project_id: pid,
      name: 't1',
      description: 'd',
      input_schema: '{}',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/tools/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('t1');

    const u = await request(app).patch('/api/v1/tools/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/tools/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('invoke without endpoint returns 400', async () => {
    const c = await request(app).post('/api/v1/tools').send({
      project_id: pid,
      name: 'no-ep',
      description: 'd',
      input_schema: '{}',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const inv = await request(app)
      .post('/api/v1/tools/' + id + '/invoke?' + Q(pid))
      .send({ arguments: { ping: 1 } });
    expect(inv.status).toBe(400);
    expect(inv.body.error.message).toMatch(/endpoint/);
  });
});
