'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('notebook_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('notebook_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('notebook_manager');
  });

  test('GET /api/v1/info returns active payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toBe('notebook_manager');
  });

  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text || res.body || '')).toMatch(/process_|nodejs_|http_|notebook_manager/i);
  });

  test('ensure-defaults seeds lab notebook', async () => {
    const pid = 'p-notebook_manager-' + Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.defaults?.item?.name).toBe('lab');
  });
});
