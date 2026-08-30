const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('config_manager crud', () => {
  const pid = 'p-config_manager-crud-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/namespaces').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/namespaces/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/namespaces/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/namespaces/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });

  test('evaluate reads stored flags', async () => {
    const pid2 = 'p-config-eval-'+Date.now();
    const c = await request(app).post('/api/v1/namespaces').send({
      project_id: pid2,
      name: 'app',
      flags: JSON.stringify({ beta: true, example: false }),
    });
    expect(c.status).toBe(201);
    const ev = await request(app).post('/api/v1/evaluate').send({
      project_id: pid2,
      namespace: 'app',
      flag: 'beta',
    });
    expect(ev.status).toBe(200);
    expect(ev.body.value).toBe(true);
    expect(ev.body.unlimited).toBeUndefined();
    const missing = await request(app).post('/api/v1/evaluate').send({
      project_id: pid2,
      namespace: 'app',
      flag: 'nope',
    });
    expect(missing.body.value).toBe(false);
  });
});

