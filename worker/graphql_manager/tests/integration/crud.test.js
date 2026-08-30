const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('graphql_manager crud', () => {
  const pid = 'p-graphql_manager-crud-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/apis').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/apis/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/apis/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/apis/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });

  test('compile User/Post relationships', async () => {
    const r = await request(app).post('/api/v1/compile').send({
      name: 'app',
      models: {
        User: { fields: { name: 'string' }, settings: { hasMany: ['Post'] } },
        Post: { fields: { title: 'string' }, settings: { belongsTo: ['User'] } },
      },
    });
    expect(r.status).toBe(200);
    expect(r.body.schema).toMatch(/posts: \[Post/);
    expect(r.body.schema).toMatch(/user: User/);
  });
});
