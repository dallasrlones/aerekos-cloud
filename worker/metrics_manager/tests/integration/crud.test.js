const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('metrics_manager crud', () => {
  const pid = 'p-metrics_manager-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/series').send({ project_id: pid, name: 'n1', name: 's1', metric_name: 'cpu', value: '0.1', labels: '{}' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/series/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/series/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/series/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });

  test('list filters metric_name and task_id without colliding names', async () => {
    const pid2 = 'p-metrics-filter-'+Date.now();
    const ts = Date.now();
    await request(app).post('/api/v1/series').send({
      project_id: pid2,
      name: `compute.cpu_percent/task-a/${ts}`,
      metric_name: 'compute.cpu_percent',
      value: '12',
      labels: JSON.stringify({ task_id: 'task-a' }),
    }).expect(201);
    await request(app).post('/api/v1/series').send({
      project_id: pid2,
      name: `compute.cpu_percent/task-b/${ts}`,
      metric_name: 'compute.cpu_percent',
      value: '90',
      labels: JSON.stringify({ task_id: 'task-b' }),
    }).expect(201);
    const listed = await request(app).get(`/api/v1/series?${Q(pid2)}&metric_name=compute.cpu_percent&task_id=task-a`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.length).toBe(1);
    expect(listed.body.items[0].value).toBe('12');
  });
});

