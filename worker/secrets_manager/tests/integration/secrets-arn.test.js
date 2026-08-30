const request = require('supertest');
const express = require('express');
const { SecretService } = require('../../api/services/SecretService');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

jest.mock('../../api/services/SecretService');
jest.mock('../../../shared/authManagerClient', () => ({
  requireAuth: () => (req, res, next) => {
    req.auth = { typ: 'service', sub: 'test' };
    next();
  },
}));

describe('secrets_manager ARN', () => {
  let app;
  let mockService;

  beforeEach(() => {
    mockService = {
      create: jest.fn(),
      list: jest.fn(),
      getById: jest.fn(),
    };
    SecretService.mockImplementation(() => mockService);

    delete require.cache[require.resolve('../../api/routes/secrets')];
    delete require.cache[require.resolve('../../api/routes/index')];
    const routes = require('../../api/routes/index');

    app = express();
    app.use(express.json());
    app.use('/api/v1', routes);
  });

  test('create returns arn + invoke_scope', async () => {
    const name = 'api-key';
    const row = { id: 's1', project_id: PID, name, key_name: 'k', key_version: 1 };
    mockService.create.mockResolvedValue(row);

    const r = await request(app)
      .post('/api/v1/secrets')
      .query({ project_id: PID })
      .send({ name, value: 'sekrit' });

    expect(r.status).toBe(201);
    expect(r.body.secret.arn).toBe(`arn:aerekos:${PID}:secrets:secret/${name}`);
    expect(r.body.secret.invoke_scope.get).toBe('secrets:GetValue');
  });
});
