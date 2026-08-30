const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Edge Cloudflare probe API', () => {
  let token;
  let project;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    token = login.body.token;
    project = await createTestProject();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('GET /api/edge/cloudflare/probe requires project_id', async () => {
    const res = await request(app)
      .get('/api/edge/cloudflare/probe')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('GET /api/edge/cloudflare/probe reports missing CF secrets', async () => {
    const res = await request(app)
      .get('/api/edge/cloudflare/probe')
      .query({ project_id: project.id })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.probe).toBeDefined();
    expect(res.body.probe.project_id).toBe(project.id);
    expect(res.body.probe.configured).toBe(false);
    expect(res.body.probe.secrets.cloudflare_api_token).toBe(false);
  });
});
