const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject, createTestWorker } = require('../helpers/dbHelper');

describe('Search + import/export', () => {
  let token;
  let project;
  let other;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser({ role: 'admin', username: `search-admin-${Date.now()}` });
    token = (await request(app).post('/api/auth/login').send({ username: user.username, password: 'testpass123' })).body.token;
    project = await createTestProject({ name: `search-alpha-${Date.now()}` });
    other = await createTestProject({ name: `search-beta-${Date.now()}` });
    await createTestWorker({ hostname: `search-host-${Date.now()}` });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('GET /api/search returns projects + workers + services', async () => {
    const res = await request(app)
      .get('/api/search')
      .query({ q: 'search' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(50);
    const types = new Set(res.body.items.map((i) => i.type));
    expect(types.has('project')).toBe(true);
  });

  test('export then import onto a second project', async () => {
    const exp = await request(app)
      .get(`/api/projects/${project.id}/export`)
      .set('Authorization', `Bearer ${token}`);
    expect(exp.status).toBe(200);
    expect(exp.body.project.id).toBe(project.id);
    const imp = await request(app)
      .post(`/api/projects/${other.id}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ project: { description: exp.body.project.description || 'imported', config: exp.body.project.config } });
    expect(imp.status).toBe(200);
    expect(imp.body.imported).toBe(true);
  });
});
