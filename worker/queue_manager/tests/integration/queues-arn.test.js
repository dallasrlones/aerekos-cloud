'use strict';

const request = require('supertest');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

let app;
beforeAll(() => {
  process.env.SKIP_SERVICE_REGISTRATION = 'true';
  process.env.SKIP_BROKER = '1';
  app = require('../../index');
});

describe('queue_manager ARN', () => {
  const q = `arn-q-${Date.now()}`;

  test('create returns arn + invoke_scope for UUID project_id', async () => {
    const r = await request(app)
      .post('/api/v1/queues')
      .query({ project_id: PID })
      .send({ name: q, project_id: PID })
      .expect(201);

    expect(r.body.queue.arn).toBe(`arn:aerekos:${PID}:queue:queue/${q.toLowerCase()}`);
    expect(r.body.queue.invoke_scope.send).toBe('queue:Send');
    expect(r.body.queue.invoke_scope.receive).toBe('queue:Receive');

    await request(app)
      .delete(`/api/v1/queues/${q}`)
      .query({ project_id: PID })
      .expect(200);
  });
});
