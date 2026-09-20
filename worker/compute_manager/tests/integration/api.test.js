const request = require('supertest');

let app;
const projectId = 'p-33333333-3333-4333-8333-333333333333';

beforeAll(() => {
  app = require('../../index');
});

describe('compute_manager', () => {
  test('GET /health & /ready & /api/v1/info', async () => {
    const h = await request(app).get('/health');
    expect(h.status).toBe(200);
    const r = await request(app).get('/ready');
    expect(r.status).toBe(200);
    const i = await request(app).get('/api/v1/info');
    expect(i.status).toBe(200);
    expect(i.body.status).toBe('active');
  });

  const taskName = `t-${Date.now()}`;

  test('create task (SKIP_DOCKER mock)', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .send({
        name: taskName,
        project_id: projectId,
        image: 'alpine:3.19',
        command: ['sh', '-c', 'echo ok'],
        run_mode: 'oneshot'
      })
      .expect(201);
    expect(res.body.task.name).toBe(taskName);
    expect(res.body.task.status).toBe('running');
    expect(res.body.task.container_id).toBe('mock-container-id');
  });

  test('list tasks', async () => {
    const r = await request(app).get('/api/v1/tasks').query({ project_id: projectId }).expect(200);
    expect(r.body.tasks.some((t) => t.name === taskName)).toBe(true);
  });

  test('get task', async () => {
    const list = await request(app).get('/api/v1/tasks').query({ project_id: projectId });
    const id = list.body.tasks.find((t) => t.name === taskName).id;
    const g = await request(app).get(`/api/v1/tasks/${id}`).query({ project_id: projectId }).expect(200);
    expect(g.body.task.id).toBe(id);
  });

  test('GET task stats (SKIP_DOCKER mock)', async () => {
    const created = await request(app)
      .post('/api/v1/tasks')
      .send({
        name: `stats-${Date.now()}`,
        project_id: projectId,
        image: 'alpine:3.19',
        command: ['sh', '-c', 'echo ok'],
        run_mode: 'oneshot',
      })
      .expect(201);
    const id = created.body.task.id;
    const s = await request(app).get(`/api/v1/tasks/${id}/stats`).query({ project_id: projectId }).expect(200);
    expect(s.body.task_id).toBe(id);
    expect(s.body.cpu_percent).toBe(0);
    expect(s.body.memory_bytes).toBe(0);
    await request(app).delete(`/api/v1/tasks/${id}`).query({ project_id: projectId }).expect(200);
  });

  test('stop start replace-image & delete', async () => {
    const list = await request(app).get('/api/v1/tasks').query({ project_id: projectId });
    const id = list.body.tasks.find((t) => t.name === taskName).id;
    await request(app).post(`/api/v1/tasks/${id}/stop`).send({ project_id: projectId }).expect(200);
    const started = await request(app).post(`/api/v1/tasks/${id}/start`).send({ project_id: projectId }).expect(200);
    expect(started.body.task.status).toBe('running');
    const replaced = await request(app).post(`/api/v1/tasks/${id}/replace-image`).send({ project_id: projectId, image: 'alpine:3.20' }).expect(200);
    expect(replaced.body.task.image).toBe('alpine:3.20');
    await request(app).delete(`/api/v1/tasks/${id}`).query({ project_id: projectId }).expect(200);
  });
});
