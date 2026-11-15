'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('vpn_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toMatch(/vpn_manager/);
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /api/v1/info returns active payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toMatch(/vpn_manager/);
  });

  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text || res.body || '')).toMatch(/process_|nodejs_|http_/i);
  });

  test('ensure-defaults', async () => {
    const pid = 'p-vpn_manager-' + Date.now();
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

  test('POST /preauth-keys returns 503 when not hooked up', async () => {
    delete process.env.HEADSCALE_URL;
    delete process.env.HEADSCALE_API_KEY;
    const res = await request(app).post('/api/v1/preauth-keys').send({});
    expect(res.status).toBe(503);
    expect(res.body.hooked_up).toBe(false);
  });
});
