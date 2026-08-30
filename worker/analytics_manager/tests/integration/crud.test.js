const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('analytics_manager crud', () => {
  const pid = 'p-analytics_manager-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/events').send({ project_id: pid, name: 'n1', name: 'click', event: 'ui.click', value: '1', properties: '{}' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/events/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/events/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/events/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });
});
