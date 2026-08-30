const request = require('supertest');
const app = require('../../index');
const ServiceManager = require('../../api/services/ServiceManager');
const { setupTestDatabase, cleanupTestData, createTestUser } = require('../helpers/dbHelper');

describe('Fleet VPC', () => {
  let token;
  let registrationToken;
  let proxy;

  beforeAll(async () => {
    await setupTestDatabase();
    const user = await createTestUser({ role: 'admin', username: `vpc-admin-${Date.now()}` });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'testpass123' });
    token = login.body.token;
    let tok = await request(app).get('/api/token').set('Authorization', `Bearer ${token}`);
    if (tok.status !== 200 || !tok.body.token) {
      tok = await request(app).post('/api/token/regenerate').set('Authorization', `Bearer ${token}`);
    }
    registrationToken = tok.body.token;
  });

  afterAll(async () => {
    delete process.env.HEADSCALE_URL;
    jest.restoreAllMocks();
    await cleanupTestData();
  });

  beforeEach(() => {
    proxy = jest.fn(async () => ({ status: 200, data: { key: 'preauth' } }));
    jest.spyOn(ServiceManager, 'getInstance').mockReturnValue({ proxyServiceRequest: proxy });
  });

  afterEach(() => {
    delete process.env.HEADSCALE_URL;
    jest.restoreAllMocks();
  });

  test('register sets vpc_id fleet', async () => {
    const res = await request(app)
      .post('/api/workers/register')
      .send({
        token: registrationToken,
        hostname: `vpc-w-${Date.now()}`,
        ip_address: '10.8.0.2',
        resources: { cpu_cores: 2 },
      });
    expect(res.status).toBe(201);
    expect(res.body.worker.vpc_id).toBe('fleet');
  });

  test('register with HEADSCALE_URL calls preauth', async () => {
    process.env.HEADSCALE_URL = 'http://headscale:8080';
    const res = await request(app)
      .post('/api/workers/register')
      .send({
        token: registrationToken,
        hostname: `vpc-hs-${Date.now()}`,
        ip_address: '10.8.0.3',
        resources: { cpu_cores: 2 },
      });
    expect(res.status).toBe(201);
    expect(proxy).toHaveBeenCalledWith(
      'network_manager',
      'POST',
      '/api/v1/mesh/preauth',
      expect.objectContaining({ tags: ['tag:worker'] }),
      expect.any(Object),
      undefined,
    );
  });

  test('GET /vpcs and PATCH /:id/vpc', async () => {
    const created = await request(app)
      .post('/api/workers/register')
      .send({
        token: registrationToken,
        hostname: `vpc-move-${Date.now()}`,
        ip_address: '10.8.0.4',
        resources: { cpu_cores: 1 },
      });
    const id = created.body.worker.id;
    const list = await request(app).get('/api/workers/vpcs').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect((list.body.vpcs || []).some((v) => v.id === 'fleet')).toBe(true);
    const moved = await request(app)
      .patch(`/api/workers/${id}/vpc`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vpc_id: 'lab' });
    expect(moved.status).toBe(200);
    expect(moved.body.worker?.vpc_id || moved.body.vpc_id).toBe('lab');
  });

  test('DELETE worker with HEADSCALE_URL calls revoke-hostname', async () => {
    process.env.HEADSCALE_URL = 'http://headscale:8080';
    const created = await request(app)
      .post('/api/workers/register')
      .send({
        token: registrationToken,
        hostname: `vpc-del-${Date.now()}`,
        ip_address: '10.8.0.5',
        resources: { cpu_cores: 1 },
      });
    const id = created.body.worker.id;
    proxy.mockClear();
    const del = await request(app)
      .delete(`/api/workers/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(proxy).toHaveBeenCalledWith(
      'network_manager',
      'POST',
      '/api/v1/mesh/revoke-hostname',
      expect.objectContaining({ hostname: expect.any(String) }),
      expect.any(Object),
      undefined,
    );
  });
});
