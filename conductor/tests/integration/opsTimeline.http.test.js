const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');

describe('GET /api/ops/timeline', () => {
  let token;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser({ role: 'admin', username: `ops-admin-${Date.now()}` });
    token = (await request(app).post('/api/auth/login').send({ username: user.username, password: 'testpass123' })).body.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('returns broken + events', async () => {
    const res = await request(app)
      .get('/api/ops/timeline')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.broken).toBe('number');
    expect(Array.isArray(res.body.events)).toBe(true);
  });
});
