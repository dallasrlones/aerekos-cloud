const request = require('supertest');
const app = require('../../index.js');
describe('vpn_manager', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
  test('ensure-defaults', async () => {
    const pid = 'p-vpn_manager-'+Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  test('GET /status reports missing HEADSCALE_URL', async () => {
    delete process.env.HEADSCALE_URL;
    delete process.env.HEADSCALE_API_KEY;
    const res = await request(app).get('/api/v1/status');
    expect(res.status).toBe(200);
    expect(res.body.hooked_up).toBe(false);
    expect(res.body.missing).toContain('HEADSCALE_URL');
  });
});

