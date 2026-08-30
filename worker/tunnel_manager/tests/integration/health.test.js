const request = require('supertest');
const app = require('../../index.js');

describe('tunnel_manager integration', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
  test('GET /api/v1/info returns active payload', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('service');
    expect(res.body).toHaveProperty('status', 'active');
  });
});
