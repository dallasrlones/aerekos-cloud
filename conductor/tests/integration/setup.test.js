const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');

describe('Setup wizard API', () => {
  let token;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    token = login.body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('GET /api/setup/graph returns dependency DAG', async () => {
    const res = await request(app)
      .get('/api/setup/graph')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.nodes).toBeDefined();
    expect(res.body.coreStack).toContain('key_manager');
  });

  test('POST /api/projects/:id/enable-core-stack returns results', async () => {
    const { createTestProject } = require('../helpers/dbHelper');
    const project = await createTestProject({ name: 'core-stack-test' });
    const res = await request(app)
      .post(`/api/projects/${project.id}/enable-core-stack`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(project.id);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  test('GET /api/services/ai_manager/setup returns progress', async () => {
    const res = await request(app)
      .get('/api/services/ai_manager/setup')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('ai_manager');
    expect(res.body.progress).toBeDefined();
    expect(res.body.dependencies.length).toBeGreaterThan(0);
  });
});
