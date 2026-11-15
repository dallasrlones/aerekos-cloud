'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('logs_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('logs_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('logs_manager');
  });

  test('GET /api/v1/info returns active payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'logs_manager');
    expect(res.body).toHaveProperty('status', 'active');
  });

  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text || res.body || '')).toMatch(/process_|nodejs_|http_|logs_manager/i);
  });
});
