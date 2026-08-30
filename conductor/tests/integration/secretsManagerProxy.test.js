const request = require('supertest');
const app = require('../../index');
const ServiceManager = require('../../api/services/ServiceManager');
const WorkerRepository = require('../../api/repos/WorkerRepository');
const {
  setupTestDatabase,
  cleanupTestData,
  createTestUser,
  createTestProject,
  createTestService
} = require('../helpers/dbHelper');

process.env.NODE_ENV = 'test';

describe('secrets_manager proxy (conductor → secrets_manager)', () => {
  let authToken;
  let testProject;
  let proxySpy;
  const serviceToken = `svc-sm-${Date.now()}`;

  beforeAll(async () => {
    await setupTestDatabase();

    const user = await createTestUser({ role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    authToken = login.body.token;

    testProject = await createTestProject({ name: 'secrets-proxy-project' });
    await createTestService({
      name: 'secrets_manager',
      enabled: 1,
      docker_image: 'aerekos-secrets_manager:latest',
      config: '{}',
      service_token: serviceToken
    });

    const sm = ServiceManager.getInstance(WorkerRepository);
    proxySpy = jest.spyOn(sm, 'proxyServiceRequest').mockResolvedValue({
      status: 200,
      data: { secrets: [{ id: 's1', name: 'cloudflare_api_token', project_id: testProject.id }] }
    });
  });

  afterAll(async () => {
    if (proxySpy) {
      proxySpy.mockRestore();
    }
    await cleanupTestData();
  });

  it('GET /api/services/secrets_manager/api/v1/secrets maps to /api/v1/secrets and passes project_id', async () => {
    const res = await request(app)
      .get('/api/services/secrets_manager/api/v1/secrets')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ project_id: testProject.id })
      .expect(200);

    expect(res.body.secrets).toHaveLength(1);
    expect(res.body.secrets[0].name).toBe('cloudflare_api_token');

    const last = proxySpy.mock.calls[proxySpy.mock.calls.length - 1];
    expect(last[0]).toBe('secrets_manager');
    expect(last[1]).toBe('GET');
    expect(last[2]).toBe('/api/v1/secrets');
    expect(last[5]).toBe(testProject.id);
  });

  it('accepts secrets_manager service_token Bearer', async () => {
    proxySpy.mockClear();
    await request(app)
      .get('/api/services/secrets_manager/api/v1/secrets')
      .set('Authorization', `Bearer ${serviceToken}`)
      .query({ project_id: testProject.id })
      .expect(200);

    expect(proxySpy).toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', async () => {
    await request(app)
      .get('/api/services/secrets_manager/api/v1/secrets')
      .query({ project_id: testProject.id })
      .expect(401);
  });
});
