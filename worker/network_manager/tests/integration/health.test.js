const request = require('supertest');
const app = require('../../index.js');

describe('network_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('network_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.service).toBe('network_manager');
  });

  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service', 'network_manager');
    expect(res.body).toHaveProperty('status', 'active');
  });

  test('GET /api/v1/mesh returns status', async () => {
    const res = await request(app).get('/api/v1/mesh');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('nodes');
  });
});
