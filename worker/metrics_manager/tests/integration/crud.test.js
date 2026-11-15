'use strict';

const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => `project_id=${encodeURIComponent(id)}`;

describe('metrics_manager series + alarms', () => {
  const pid = `p-metrics_manager-${Date.now()}`;

  test('create get update delete series', async () => {
    const c = await request(app)
      .post('/api/v1/series')
      .send({ project_id: pid, name: 's1', metric_name: 'cpu', value: '0.1', labels: '{}' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get(`/api/v1/series/${id}?${Q(pid)}`);
    expect(g.status).toBe(200);
    const u = await request(app).patch(`/api/v1/series/${id}?${Q(pid)}`).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete(`/api/v1/series/${id}?${Q(pid)}`);
    expect(d.status).toBe(200);
  });

  test('list filters metric_name and task_id without colliding names', async () => {
    const pid2 = `p-metrics-filter-${Date.now()}`;
    const ts = Date.now();
    await request(app)
      .post('/api/v1/series')
      .send({
        project_id: pid2,
        name: `compute.cpu_percent/task-a/${ts}`,
        metric_name: 'compute.cpu_percent',
        value: '12',
        labels: JSON.stringify({ task_id: 'task-a' }),
      })
      .expect(201);
    await request(app)
      .post('/api/v1/series')
      .send({
        project_id: pid2,
        name: `compute.cpu_percent/task-b/${ts}`,
        metric_name: 'compute.cpu_percent',
        value: '90',
        labels: JSON.stringify({ task_id: 'task-b' }),
      })
      .expect(201);
    const listed = await request(app).get(
      `/api/v1/series?${Q(pid2)}&metric_name=compute.cpu_percent&task_id=task-a`,
    );
    expect(listed.status).toBe(200);
    expect(listed.body.items.length).toBe(1);
    expect(listed.body.items[0].value).toBe('12');
  });

  test('POST /series/sample upserts', async () => {
    const pid3 = `p-sample-int-${Date.now()}`;
    const a = await request(app)
      .post('/api/v1/series/sample')
      .send({ project_id: pid3, name: 'latency', value: '1', labels: { region: 'us' } });
    expect(a.status).toBe(201);
    const b = await request(app)
      .post('/api/v1/series/sample')
      .send({ project_id: pid3, name: 'latency', value: '2', labels: { region: 'us' } });
    expect(b.status).toBe(201);
    expect(b.body.item.id).toBe(a.body.item.id);
    expect(b.body.item.value).toBe('2');
  });

  test('alarms CRUD and evaluate with SKIP_OUTBOUND', async () => {
    process.env.SKIP_OUTBOUND = '1';
    const pid4 = `p-alarm-${Date.now()}`;
    const c = await request(app)
      .post('/api/v1/alarms')
      .send({
        project_id: pid4,
        name: 'high-cpu',
        metric_name: 'cpu',
        threshold: '80',
        op: 'gt',
      });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const listed = await request(app).get(`/api/v1/alarms?${Q(pid4)}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((a) => a.id === id)).toBe(true);

    const evalHit = await request(app)
      .post('/api/v1/alarms/evaluate')
      .send({ project_id: pid4, metric_name: 'cpu', value: 90 });
    expect(evalHit.status).toBe(200);
    expect(evalHit.body.skipped).toBe(true);
    expect(evalHit.body.fired.some((f) => f.name === 'high-cpu')).toBe(true);

    const evalMiss = await request(app)
      .post('/api/v1/alarms/evaluate')
      .send({ project_id: pid4, metric_name: 'cpu', value: 10 });
    expect(evalMiss.status).toBe(200);
    expect(evalMiss.body.fired.length).toBe(0);

    const d = await request(app).delete(`/api/v1/alarms/${id}?${Q(pid4)}`);
    expect(d.status).toBe(200);
    expect(d.body.deleted).toBe(true);
  });

  test('POST /series rejects missing project_id', async () => {
    const bad = await request(app).post('/api/v1/series').send({ name: 'x' });
    expect(bad.status).toBe(400);
  });
});
