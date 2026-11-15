const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('cicd_manager crud', () => {
  const pid = 'p-cicd_manager-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/pipelines').send({ project_id: pid, name: 'ci', steps_json: '[]', state: 'idle' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const list = await request(app).get('/api/v1/pipelines?'+Q(pid));
    expect(list.status).toBe(200);
    expect((list.body.items || []).some((x) => x.id === id)).toBe(true);
    const g = await request(app).get('/api/v1/pipelines/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/pipelines/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/pipelines/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });
});
