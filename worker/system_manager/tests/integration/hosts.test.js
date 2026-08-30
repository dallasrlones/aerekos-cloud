jest.mock('../../../shared/conductorProxy', () => ({
  proxy: jest.fn(),
  conductorBase: () => 'http://127.0.0.1:3000',
  authHeaders: () => ({}),
}));

const request = require('supertest');
const { proxy } = require('../../../shared/conductorProxy');
const app = require('../../index.js');

describe('system_manager hosts', () => {
  beforeEach(() => {
    proxy.mockReset();
  });

  test('GET /api/v1/hosts/:workerId/check proxies to conductor', async () => {
    proxy.mockResolvedValue({
      status: 200,
      data: { ok: true, os: { supported: true, updates_available: 0 } },
    });
    const res = await request(app).get('/api/v1/hosts/w1/check');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(proxy).toHaveBeenCalledWith(
      'POST',
      '/api/workers/w1/host/check',
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });

  test('POST /api/v1/hosts/:workerId/update proxies target', async () => {
    proxy.mockResolvedValue({
      status: 200,
      data: { ok: true, target: 'docker', reboot_required: false },
    });
    const res = await request(app)
      .post('/api/v1/hosts/w1/update')
      .send({ target: 'docker' });
    expect(res.status).toBe(200);
    expect(res.body.target).toBe('docker');
    expect(proxy).toHaveBeenCalledWith(
      'POST',
      '/api/workers/w1/host/update',
      expect.objectContaining({ data: { target: 'docker' } })
    );
  });

  test('offline conductor 503 is forwarded', async () => {
    proxy.mockResolvedValue({
      status: 503,
      data: { error: { message: 'Worker is offline', status: 503 } },
    });
    const res = await request(app).post('/api/v1/hosts/w1/check');
    expect(res.status).toBe(503);
    expect(res.body.error.message).toBe('Worker is offline');
  });
});
