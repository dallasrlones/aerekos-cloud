const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('cluster_manager crud', () => {
  const pid = 'p-cluster_manager-crud-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/clusters').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/clusters/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/clusters/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/clusters/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });

  test('k3s install requires confirm and SKIP_HOST_PATCH skips exec', async () => {
    const c = await request(app).post('/api/v1/clusters').send({ project_id: pid, name: 'k3s-box' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const denied = await request(app).post('/api/v1/clusters/'+id+'/k3s/install').send({ project_id: pid });
    expect(denied.status).toBe(400);
    const skipped = await request(app).post('/api/v1/clusters/'+id+'/k3s/install').send({ project_id: pid, confirm: true });
    expect(skipped.status).toBe(200);
    expect(skipped.body.skipped).toBe(true);
    const st = await request(app).get('/api/v1/clusters/'+id+'/k3s/status?'+Q(pid));
    expect(st.status).toBe(200);
    expect(st.body).toHaveProperty('installed');
  });
});

