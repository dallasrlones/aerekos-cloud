const request = require('supertest');
const express = require('express');
const { WebhookService } = require('../../api/services/WebhookService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/WebhookService');
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('webhook_manager ARN', () => {
  let app;

  beforeEach(() => {
    WebhookService.mockImplementation(() => ({
      createEndpoint: jest.fn().mockResolvedValue({
        id: 'w1',
        project_id: PID,
        name: 'stripe',
        target_url: 'https://example.com/hook',
        secret: '',
        headers: '',
        enabled: '1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }));

    delete require.cache[require.resolve('../../api/routes/webhooks')];
    delete require.cache[require.resolve('../../api/routes/index')];
    const routes = require('../../api/routes/index');

    app = express();
    app.use(express.json());
    app.use('/api/v1', routes);
  });

  test('create returns arn + invoke_scope', async () => {
    const r = await request(app)
      .post('/api/v1/webhooks')
      .query({ project_id: PID })
      .send({ name: 'stripe', target_url: 'https://example.com/hook' });

    expect(r.status).toBe(201);
    expect(r.body.webhook.arn).toBe(`arn:aerekos:${PID}:webhook:endpoint/stripe`);
    expect(r.body.webhook.invoke_scope.dispatch).toBe('webhook:Dispatch');
  });
});
