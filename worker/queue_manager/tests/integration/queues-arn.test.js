const request = require('supertest');
const express = require('express');
const { QueueService } = require('../../api/services/QueueService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/QueueService');
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('queue_manager ARN', () => {
  let app;

  beforeEach(() => {
    QueueService.mockImplementation(() => ({
      createQueue: jest.fn().mockResolvedValue({
        id: 'q1',
        name: 'jobs',
        project_id: PID,
        visibility_timeout_seconds: 30,
        created_at: new Date().toISOString(),
      }),
    }));

    delete require.cache[require.resolve('../../api/routes/queues')];
    delete require.cache[require.resolve('../../api/routes/index')];
    const routes = require('../../api/routes/index');

    app = express();
    app.use(express.json());
    app.use('/api/v1', routes);
  });

  test('create returns arn + invoke_scope', async () => {
    const r = await request(app)
      .post('/api/v1/queues')
      .query({ project_id: PID })
      .send({ name: 'jobs' });

    expect(r.status).toBe(201);
    expect(r.body.queue.arn).toBe(`arn:aerekos:${PID}:queue:queue/jobs`);
    expect(r.body.queue.invoke_scope.send).toBe('queue:Send');
  });
});
