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

describe('key_manager proxy (conductor → key_manager)', () => {
  let authToken;
  let testProject;
  let proxySpy;
  const serviceToken = `svc-km-${Date.now()}`;

  beforeAll(async () => {
    await setupTestDatabase();

    const user = await createTestUser({ role: 'admin' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    authToken = login.body.token;

    testProject = await createTestProject({ name: 'key-proxy-project' });
    await createTestService({
      name: 'key_manager',
      enabled: 1,
      docker_image: 'aerekos-key_manager:latest',
      config: '{}',
      service_token: serviceToken
    });

    const sm = ServiceManager.getInstance(WorkerRepository);
    proxySpy = jest.spyOn(sm, 'proxyServiceRequest').mockResolvedValue({
      status: 200,
      data: {
        key_name: 'test-key',
        key_material: '0'.repeat(64),
        key_version: 1,
        algorithm: 'AES-256-GCM'
      }
    });
  });

  afterAll(async () => {
    if (proxySpy) {
      proxySpy.mockRestore();
    }
    await cleanupTestData();
  });

  it('GET /api/services/key_manager/api/keys/:name maps to /api/keys/:name and passes project_id (user JWT)', async () => {
    const res = await request(app)
      .get('/api/services/key_manager/api/keys/test-key')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ project_id: testProject.id })
      .expect(200);

    expect(res.body.key_name).toBe('test-key');
    expect(res.body.key_material).toBe('0'.repeat(64));

    expect(proxySpy).toHaveBeenCalled();
    const last = proxySpy.mock.calls[proxySpy.mock.calls.length - 1];
    expect(last[0]).toBe('key_manager');
    expect(last[1]).toBe('GET');
    expect(last[2]).toBe('/api/keys/test-key');
    expect(last[5]).toBe(testProject.id);
  });

  it('accepts key_manager service_token Bearer (service-to-service)', async () => {
    proxySpy.mockClear();
    await request(app)
      .get('/api/services/key_manager/api/keys/another')
      .set('Authorization', `Bearer ${serviceToken}`)
      .query({ project_id: testProject.id })
      .expect(200);

    expect(proxySpy).toHaveBeenCalled();
  });

  it('returns 401 when no Authorization header', async () => {
    await request(app)
      .get('/api/services/key_manager/api/keys/x')
      .query({ project_id: testProject.id })
      .expect(401);
  });
});
