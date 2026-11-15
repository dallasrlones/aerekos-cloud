'use strict';

/**
 * In-process e2e: create → send → receive → ack → delete against the real Express app.
 * Uses SQLite (default) with SKIP_BROKER=1 so rabbitmq/redis engines are not required.
 * Live conductor/proxy smoke remains manual — see tests/e2e/README.md.
 */

const request = require('supertest');

let app;
beforeAll(() => {
  process.env.SKIP_SERVICE_REGISTRATION = 'true';
  process.env.SKIP_BROKER = '1';
  delete process.env.AEREKOS_QUEUE_PROVIDER;
  app = require('../../index');
});

const projectId = 'e2e11111-1111-4111-8111-111111111111';

describe('e2e queue_manager flow', () => {
  const q = `e2e-q-${Date.now()}`;

  test('health and ready', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/ready').expect(200);
  });

  test('full message lifecycle (standard engine)', async () => {
    const created = await request(app)
      .post('/api/v1/queues')
      .send({
        name: q,
        project_id: projectId,
        engine: 'standard',
        visibility_timeout_seconds: 30,
      })
      .expect(201);
    expect(created.body.queue.engine).toBe('standard');
    expect(created.body.queue.arn).toMatch(/^arn:aerekos:/);

    await request(app)
      .post(`/api/v1/queues/${q}/messages`)
      .send({ project_id: projectId, body: { ping: 1 } })
      .expect(201);

    const rec = await request(app)
      .post(`/api/v1/queues/${q}/messages/receive`)
      .send({ project_id: projectId, max_number_of_messages: 1 })
      .expect(200);
    expect(rec.body.Messages).toHaveLength(1);
    const mid = rec.body.Messages[0].MessageId;

    await request(app)
      .delete(`/api/v1/queues/${q}/messages/${mid}`)
      .query({ project_id: projectId })
      .expect(200);

    const empty = await request(app)
      .post(`/api/v1/queues/${q}/messages/receive`)
      .send({ project_id: projectId, max_number_of_messages: 1 })
      .expect(200);
    expect(empty.body.Messages || []).toHaveLength(0);

    await request(app)
      .delete(`/api/v1/queues/${q}`)
      .query({ project_id: projectId })
      .expect(200);
  });

  test('missing queue is 404 (no auto-create of capacity-wait or any name)', async () => {
    const r = await request(app)
      .get('/api/v1/queues/capacity-wait')
      .query({ project_id: projectId });
    expect(r.status).toBe(404);
  });
});
