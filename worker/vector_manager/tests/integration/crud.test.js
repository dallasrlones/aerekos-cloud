const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('vector_manager crud', () => {
  const pid = 'p-vector_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/indexes').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/indexes/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/indexes/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/indexes/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('local upsert and query (sqlite cosine)', async () => {
    const idx = 'default';
    const up = await request(app).post('/api/v1/upsert').send({
      project_id: pid,
      index: idx,
      items: [
        { id: 'a', vector: [1, 0, 0], metadata: { tag: 'a' } },
        { id: 'b', vector: [0, 1, 0], metadata: { tag: 'b' } },
      ],
    });
    expect(up.status).toBe(200);
    expect(up.body.backend).toBe('sqlite');
    expect(up.body.upserted).toBe(2);

    const q = await request(app).post('/api/v1/query').send({
      project_id: pid,
      index: idx,
      vector: [1, 0, 0],
      top_k: 2,
    });
    expect(q.status).toBe(200);
    expect(q.body.backend).toBe('sqlite');
    expect(q.body.hits.length).toBeGreaterThanOrEqual(1);
    expect(q.body.hits[0].id).toBe('a');
  });

  test('upsert requires project_id', async () => {
    const res = await request(app).post('/api/v1/upsert').send({ items: [{ vector: [1] }] });
    expect(res.status).toBe(400);
  });
});
