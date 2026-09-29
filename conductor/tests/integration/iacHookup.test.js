/**
 * IaC hookup — refactored onto the shared test helpers (auth / apiClient /
 * proxyMock) so every test file gets the same streamlined flow:
 *   login once, then api.get/post against a mocked service proxy.
 */
const app = require('../../index');
const SetupService = require('../../api/services/SetupService');
const StackService = require('../../api/services/StackService');
const { setupTestDatabase, cleanupTestData, createTestProject } = require('../helpers/dbHelper');
const { loginAsAdmin } = require('../helpers/auth');
const { createApiClient } = require('../helpers/apiClient');
const { mockServiceProxy, restoreProxyMock } = require('../helpers/proxyMock');
const { PROD_PROJECT_ID } = require('../../../e2e/lib/prodGuard');

describe('IaC hookup', () => {
  let token;
  let api;
  let project;
  let proxy;

  beforeAll(async () => {
    process.env.IAC_HEALTH_WAIT_MS = '0';
    process.env.IAC_HEALTH_INTERVAL_MS = '50';
    await setupTestDatabase();
    const session = await loginAsAdmin(app, { username: `iac-admin-${Date.now()}` });
    token = session.token;
    api = createApiClient(app, token);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    project = await createTestProject();
    expect(project.id).not.toBe(PROD_PROJECT_ID);
    proxy = mockServiceProxy([
      { path: (p) => p === '/health', response: { status: 200, data: { ok: true } } },
      { service: 'git_manager', method: 'GET', path: (p) => p === '/api/v1/repos',
        response: { status: 200, data: { repositories: [] } } },
      { service: 'git_manager', method: 'POST', path: (p) => p === '/api/v1/repos',
        response: { status: 201, data: { repository: { id: 'repo-1', name: 'infra' } } } },
    ]);
    jest.spyOn(SetupService, 'enableWithDependencies').mockResolvedValue({ enabled: ['code_as_infra'] });
    jest.spyOn(StackService, 'current').mockResolvedValue({ stack: { kind: 'project-stack' }, status: 'ok' });
    jest.spyOn(StackService, 'put').mockResolvedValue({});
    jest.spyOn(StackService, 'empty').mockReturnValue({ kind: 'project-stack' });
    jest.spyOn(StackService, 'upsertIacModule').mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreProxyMock();
  });

  test('GET /iac/status with no mode + health 200 → missing source', async () => {
    const res = await api.get(`/api/projects/${project.id}/iac/status`);
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.missing).toContain('source');
  });

  test('GET /iac/status with health fail → missing manager', async () => {
    proxy.proxyServiceRequest.mockImplementation(async () => { throw new Error('down'); });
    const res = await api.get(`/api/projects/${project.id}/iac/status`);
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.missing).toContain('manager');
  });

  test('POST /iac/hookup conductor after healthy enable', async () => {
    const res = await api.post(`/api/projects/${project.id}/iac/hookup`, { mode: 'conductor' });
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(true);
    expect(res.body.mode).toBe('conductor');
    expect(res.body.missing).toEqual([]);
  });

  test('POST /iac/hookup git when git health fails', async () => {
    proxy.proxyServiceRequest.mockImplementation(async (svc, method, path) => {
      if (svc === 'git_manager' && path === '/health') return { status: 503, data: {} };
      if (path === '/health') return { status: 200, data: { ok: true } };
      return { status: 200, data: {} };
    });
    const res = await api.post(`/api/projects/${project.id}/iac/hookup`, { mode: 'git', repo: 'infra' });
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.error).toBeTruthy();
    expect(res.body.missing).toContain('git_manager');
  });

  test('GET /iac/status 404 unknown project', async () => {
    const res = await api.get('/api/projects/00000000-0000-4000-8000-000000000000/iac/status');
    expect(res.status).toBe(404);
  });

  test('fixtures never use the production project UUID', () => {
    expect(project.id).not.toBe(PROD_PROJECT_ID);
  });
});
