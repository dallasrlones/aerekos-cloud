'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('trace_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('trace_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('trace_manager');
  });

  test('GET /api/v1/info returns active payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'trace_manager');
    expect(res.body).toHaveProperty('status', 'active');
  });

  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text || res.body || '')).toMatch(/process_|nodejs_|http_|trace_manager/i);
  });

  test('ensure-defaults seeds sample trace', async () => {
    const pid = 'p-trace_manager-' + Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
