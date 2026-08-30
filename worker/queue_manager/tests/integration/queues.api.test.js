const request = require('supertest');

// Ensure app loads after beforeFile has set DATABASE_PATH
let app;
beforeAll(() => {
  process.env.SKIP_SERVICE_REGISTRATION = 'true';
  app = require('../../index');
});

const projectId = 'p-11111111-1111-4111-8111-111111111111';

describe('queue_manager API (SQS-like)', () => {
  const q = `work-q-${Date.now()}`;

  test('create queue', async () => {
    const r = await request(app)
      .post('/api/v1/queues')
      .send({ name: q, project_id: projectId, visibility_timeout_seconds: 10 })
      .expect(201);
    expect(r.body.queue.name).toBe(q);
    expect(r.body.queue.visibility_timeout_seconds).toBe(10);
  });

  test('list queues', async () => {
    const r = await request(app)
      .get('/api/v1/queues')
      .query({ project_id: projectId })
      .expect(200);
    expect(Array.isArray(r.body.queues)).toBe(true);
    expect(r.body.queues.find((x) => x.name === q)).toBeDefined();
  });

  test('send and receive', async () => {
    await request(app)
      .post(`/api/v1/queues/${q}/messages`)
      .send({ project_id: projectId, body: 'hello' })
      .expect(201);
    const r = await request(app)
      .post(`/api/v1/queues/${q}/messages/receive`)
      .send({ project_id: projectId, max_number_of_messages: 5, visibility_timeout_seconds: 3 })
      .expect(200);
    expect(r.body.Messages).toBeDefined();
    expect(r.body.Messages.length).toBe(1);
    expect(r.body.Messages[0].Body).toBe('hello');
    const mid = r.body.Messages[0].MessageId;
    await request(app)
      .delete(`/api/v1/queues/${q}/messages/${mid}`)
      .query({ project_id: projectId })
      .expect(200);
  });

  test('delete message', async () => {
    await request(app)
      .post(`/api/v1/queues/${q}/messages`)
      .send({ project_id: projectId, body: 'delme' })
      .expect(201);
    const rec = await request(app)
      .post(`/api/v1/queues/${q}/messages/receive`)
      .send({ project_id: projectId, max_number_of_messages: 1, visibility_timeout_seconds: 30 })
      .expect(200);
    const id = rec.body.Messages[0].MessageId;
    await request(app)
      .delete(`/api/v1/queues/${q}/messages/${id}`)
      .query({ project_id: projectId })
      .expect(200);
  });

  test('delete queue', async () => {
    const r = await request(app)
      .delete(`/api/v1/queues/${q}`)
      .query({ project_id: projectId })
      .expect(200);
    expect(r.body.deleted).toBe(true);
  });
});
