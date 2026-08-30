const request = require('supertest');
const app = require('../../index');
const ServiceManager = require('../../api/services/ServiceManager');
const SetupService = require('../../api/services/SetupService');
const StackService = require('../../api/services/StackService');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');
const { PROD_PROJECT_ID } = require('../../../e2e/lib/prodGuard');

describe('IaC hookup', () => {
  let token;
  let project;
  let proxy;

  beforeAll(async () => {
    process.env.IAC_HEALTH_WAIT_MS = '0';
    process.env.IAC_HEALTH_INTERVAL_MS = '50';
    await setupTestDatabase();
    const user = await createTestUser({ role: 'admin', username: `iac-admin-${Date.now()}` });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    token = login.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    project = await createTestProject();
    expect(project.id).not.toBe(PROD_PROJECT_ID);
    proxy = jest.fn(async (svc, method, path) => {
      if (path === '/health') return { status: 200, data: { ok: true } };
      if (method === 'GET' && path === '/api/v1/repos') return { status: 200, data: { repositories: [] } };
      if (method === 'POST' && path === '/api/v1/repos') {
        return { status: 201, data: { repository: { id: 'repo-1', name: 'infra' } } };
      }
      return { status: 200, data: {} };
    });
    jest.spyOn(ServiceManager, 'getInstance').mockReturnValue({ proxyServiceRequest: proxy });
    jest.spyOn(SetupService, 'enableWithDependencies').mockResolvedValue({ enabled: ['code_as_infra'] });
    jest.spyOn(StackService, 'current').mockResolvedValue({ stack: { kind: 'project-stack' }, status: 'ok' });
    jest.spyOn(StackService, 'put').mockResolvedValue({});
    jest.spyOn(StackService, 'empty').mockReturnValue({ kind: 'project-stack' });
    jest.spyOn(StackService, 'upsertIacModule').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /iac/status with no mode + health 200 → missing source', async () => {
    const res = await request(app)
      .get(`/api/projects/${project.id}/iac/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.missing).toContain('source');
  });

  test('GET /iac/status with health fail → missing manager', async () => {
    proxy.mockImplementation(async () => { throw new Error('down'); });
    const res = await request(app)
      .get(`/api/projects/${project.id}/iac/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.missing).toContain('manager');
  });

  test('POST /iac/hookup conductor after healthy enable', async () => {
    const res = await request(app)
      .post(`/api/projects/${project.id}/iac/hookup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'conductor' });
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(true);
    expect(res.body.mode).toBe('conductor');
    expect(res.body.missing).toEqual([]);
  });

  test('POST /iac/hookup git when git health fails', async () => {
    proxy.mockImplementation(async (svc, method, path) => {
      if (svc === 'git_manager' && path === '/health') return { status: 503, data: {} };
      if (path === '/health') return { status: 200, data: { ok: true } };
      return { status: 200, data: {} };
    });
    const res = await request(app)
      .post(`/api/projects/${project.id}/iac/hookup`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mode: 'git', repo: 'infra' });
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.error).toBeTruthy();
    expect(res.body.missing).toContain('git_manager');
  });

  test('GET /iac/status 404 unknown project', async () => {
    const res = await request(app)
      .get('/api/projects/00000000-0000-4000-8000-000000000000/iac/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('fixtures never use the production project UUID', () => {
    expect(project.id).not.toBe(PROD_PROJECT_ID);
  });
});
