'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('analytics_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('analytics_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('analytics_manager');
  });

  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toBe('analytics_manager');
    expect(res.body.aws).toBe('Pinpoint / Kinesis Analytics');
  });

  test('GET /metrics returns prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(String(res.text || res.body)).toMatch(/process_|nodejs_|http_|aerekos_/);
  });
});
