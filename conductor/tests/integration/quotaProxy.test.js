const request = require('supertest');
const app = require('../../index');
const { setupTestDatabase, cleanupTestData, createTestUser, createTestProject } = require('../helpers/dbHelper');

describe('Conductor proxy quota gate', () => {
  let token;
  let project;
  const prevSkip = process.env.SKIP_QUOTA;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser({ role: 'admin', username: `quota-admin-${Date.now()}` });
    token = (await request(app).post('/api/auth/login').send({ username: user.username, password: 'testpass123' })).body.token;
    project = await createTestProject();
  });

  afterAll(async () => {
    process.env.SKIP_QUOTA = prevSkip;
    jest.resetModules();
    await cleanupTestData();
  });

  test('POST proxy returns 429 when assertQuota throws', async () => {
    process.env.SKIP_QUOTA = '0';
    jest.resetModules();
    jest.doMock('../../api/utils/loadWorkerShared', () => ({
      requireShared: () => ({
        assertQuota: async () => {
          const e = new Error('quota exceeded: manager_writes');
          e.status = 429;
          e.code = 'QUOTA_EXCEEDED';
          throw e;
        },
      }),
    }));
    // loadWorkerShared is required inside the route handler, so mock via the already-loaded module
    const loadWorkerShared = require('../../api/utils/loadWorkerShared');
    jest.spyOn(loadWorkerShared, 'requireShared').mockReturnValue({
      assertQuota: async () => {
        const e = new Error('quota exceeded: manager_writes');
        e.status = 429;
        e.code = 'QUOTA_EXCEEDED';
        throw e;
      },
    });
    const res = await request(app)
      .post('/api/services/code_as_infra/api/v1/modules')
      .set('Authorization', `Bearer ${token}`)
      .send({ project_id: project.id, name: 'q', kind: 'json', content: '{}' });
    expect(res.status).toBe(429);
    expect(res.body.error?.code).toBe('QUOTA_EXCEEDED');
    loadWorkerShared.requireShared.mockRestore();
  });
});
