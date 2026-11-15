const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('audit_manager crud', () => {
  const pid = 'p-audit_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/events').send({
      project_id: pid,
      name: 'n1',
      actor: 'a1',
      action: 'create',
      detail: '{}',
    });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const g = await request(app).get('/api/v1/events/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    expect(g.body.item.name).toBe('n1');
    expect(g.body.item.actor).toBe('a1');

    const u = await request(app).patch('/api/v1/events/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/events/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('ingest creates event with actor/action/detail', async () => {
    const res = await request(app).post('/api/v1/ingest').send({
      project_id: pid,
      name: 'ingested',
      actor: 'svc',
      action: 'write',
      detail: { k: 1 },
    });
    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('ingested');
    expect(res.body.item.actor).toBe('svc');
    expect(res.body.item.action).toBe('write');
    expect(res.body.item.detail).toContain('"k"');
  });
});
