const request = require('supertest');
const app = require('../../index');
const policyEvaluator = require('../../api/services/PolicyEvaluator');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('IAM proxy enforce', () => {
  let adminToken;
  let userToken;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    const admin = await createTestUser({ role: 'admin', username: `iam-admin-${Date.now()}` });
    const user = await createTestUser({ role: 'user', username: `iam-user-${Date.now()}` });
    const a = await request(app).post('/api/auth/login').send({ username: admin.username, password: 'testpass123' });
    const u = await request(app).post('/api/auth/login').send({ username: user.username, password: 'testpass123' });
    adminToken = a.body.token;
    userToken = u.body.token;
    project = await createTestProject();
  });

  afterAll(async () => {
    delete process.env.IAM_ENFORCE_PROXY;
    jest.restoreAllMocks();
    await cleanupTestData();
  });

  afterEach(() => {
    delete process.env.IAM_ENFORCE_PROXY;
    jest.restoreAllMocks();
  });

  test('admin bypasses IAM even when enforce is on', async () => {
    process.env.IAM_ENFORCE_PROXY = 'true';
    const res = await request(app)
      .get('/api/services/code_as_infra/api/v1/modules')
      .query({ project_id: project.id })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).not.toBe(403);
  });

  test('role deny 403 when evaluate rejects', async () => {
    process.env.IAM_ENFORCE_PROXY = 'true';
    jest.spyOn(policyEvaluator, 'evaluate').mockResolvedValue({ allowed: false, reason: 'deny' });
    const res = await request(app)
      .get('/api/services/code_as_infra/api/v1/modules')
      .query({ project_id: project.id })
      .set('Authorization', `Bearer ${userToken}`)
      .set('X-Aerekos-Role', 'developer');
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBeTruthy();
  });

  test('IAM_ENFORCE_PROXY=false skips evaluation', async () => {
    process.env.IAM_ENFORCE_PROXY = 'false';
    const spy = jest.spyOn(policyEvaluator, 'evaluate');
    const res = await request(app)
      .get('/api/services/code_as_infra/api/v1/modules')
      .query({ project_id: project.id })
      .set('Authorization', `Bearer ${userToken}`);
    expect(spy).not.toHaveBeenCalled();
    expect(res.status).not.toBe(403);
  });
});
