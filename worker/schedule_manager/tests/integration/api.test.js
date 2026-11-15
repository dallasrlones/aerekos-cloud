jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn()
}));

const request = require('supertest');
const axios = require('axios');

let app;
const projectId = 'p-22222222-2222-4222-8222-222222222222';

beforeAll(() => {
  axios.get.mockResolvedValue({ status: 200, data: {} });
  axios.post.mockResolvedValue({ status: 201, data: { MessageId: '1' } });
  app = require('../../index');
});

beforeEach(() => {
  axios.get.mockClear();
  axios.post.mockClear();
  axios.get.mockResolvedValue({ status: 200, data: {} });
  axios.post.mockResolvedValue({ status: 201, data: { MessageId: '1' } });
});

describe('health & info', () => {
  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
  test('GET /ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
  });
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
});

describe('schedules (CRUD + run)', () => {
  const name = `s-${Date.now()}`;

  test('create queue target', async () => {
    const r = await request(app)
      .post('/api/v1/schedules')
      .send({
        name,
        project_id: projectId,
        cron_expression: '0 * * * *',
        action_type: 'queue',
        target_queue: 'jobs',
        message_template: JSON.stringify({ hello: 1 })
      })
      .expect(201);
    expect(r.body.schedule.name).toBe(name);
  });

  test('run now dispatches to queue_manager via QUEUE_MANAGER_URL escape hatch', async () => {
    const list = await request(app)
      .get('/api/v1/schedules')
      .query({ project_id: projectId })
      .expect(200);
    const id = list.body.schedules.find((s) => s.name === name).id;
    const prevQm = process.env.QUEUE_MANAGER_URL;
    const prevCu = process.env.CONDUCTOR_URL;
    process.env.QUEUE_MANAGER_URL = 'http://q.internal:3101';
    delete process.env.CONDUCTOR_URL;
    try {
      const r = await request(app)
        .post(`/api/v1/schedules/${id}/run`)
        .send({ project_id: projectId })
        .expect(200);
      expect(r.body.success).toBe(true);
      expect(axios.post).toHaveBeenCalled();
      const [url, body] = axios.post.mock.calls[0];
      expect(url).toBe('http://q.internal:3101/api/v1/queues/jobs/messages');
      expect(body.project_id).toBe(projectId);
    } finally {
      if (prevQm === undefined) delete process.env.QUEUE_MANAGER_URL;
      else process.env.QUEUE_MANAGER_URL = prevQm;
      if (prevCu === undefined) delete process.env.CONDUCTOR_URL;
      else process.env.CONDUCTOR_URL = prevCu;
    }
  });

  test('run now dispatches to queue_manager via conductor proxy', async () => {
    const list = await request(app)
      .get('/api/v1/schedules')
      .query({ project_id: projectId })
      .expect(200);
    const id = list.body.schedules.find((s) => s.name === name).id;
    const prevQm = process.env.QUEUE_MANAGER_URL;
    const prevCu = process.env.CONDUCTOR_URL;
    delete process.env.QUEUE_MANAGER_URL;
    process.env.CONDUCTOR_URL = 'http://conductor.test:3000';
    try {
      const r = await request(app)
        .post(`/api/v1/schedules/${id}/run`)
        .send({ project_id: projectId })
        .expect(200);
      expect(r.body.success).toBe(true);
      expect(axios.post).toHaveBeenCalled();
      const [url, body] = axios.post.mock.calls.find((c) =>
        String(c[0]).includes('/api/services/queue_manager/')
      );
      expect(url).toBe(
        'http://conductor.test:3000/api/services/queue_manager/api/v1/queues/jobs/messages'
      );
      expect(body.project_id).toBe(projectId);
    } finally {
      if (prevQm === undefined) delete process.env.QUEUE_MANAGER_URL;
      else process.env.QUEUE_MANAGER_URL = prevQm;
      if (prevCu === undefined) delete process.env.CONDUCTOR_URL;
      else process.env.CONDUCTOR_URL = prevCu;
    }
  });

  test('queue run without CONDUCTOR_URL or QUEUE_MANAGER_URL fails honestly', async () => {
    const list = await request(app)
      .get('/api/v1/schedules')
      .query({ project_id: projectId })
      .expect(200);
    const id = list.body.schedules.find((s) => s.name === name).id;
    const prevQm = process.env.QUEUE_MANAGER_URL;
    const prevCu = process.env.CONDUCTOR_URL;
    delete process.env.QUEUE_MANAGER_URL;
    delete process.env.CONDUCTOR_URL;
    try {
      const r = await request(app)
        .post(`/api/v1/schedules/${id}/run`)
        .send({ project_id: projectId });
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(String(r.body.error?.message || r.body.message || '')).toMatch(/CONDUCTOR_URL/i);
    } finally {
      if (prevQm === undefined) delete process.env.QUEUE_MANAGER_URL;
      else process.env.QUEUE_MANAGER_URL = prevQm;
      if (prevCu === undefined) delete process.env.CONDUCTOR_URL;
      else process.env.CONDUCTOR_URL = prevCu;
    }
  });

  test('create webhook and run', async () => {
    const n2 = `wh-${Date.now()}`;
    const cr = await request(app)
      .post('/api/v1/schedules')
      .send({
        name: n2,
        project_id: projectId,
        cron_expression: '0 0 * * *',
        action_type: 'webhook',
        target_url: 'https://example.com/hook',
        http_method: 'POST',
        message_template: '{}'
      })
      .expect(201);
    const id = cr.body.schedule.id;
    await request(app)
      .post(`/api/v1/schedules/${id}/run`)
      .send({ project_id: projectId })
      .expect(200);
    expect(axios.post).toHaveBeenCalled();
    expect(axios.post.mock.calls.some((c) => c[0] === 'https://example.com/hook')).toBe(true);
  });

  test('delete', async () => {
    const list = await request(app)
      .get('/api/v1/schedules')
      .query({ project_id: projectId })
      .expect(200);
    for (const s of list.body.schedules) {
      await request(app)
        .delete(`/api/v1/schedules/${s.id}`)
        .query({ project_id: projectId })
        .expect(200);
    }
  });
});
