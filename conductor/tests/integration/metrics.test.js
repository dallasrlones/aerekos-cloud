const request = require('supertest');
const app = require('../../index.js');

process.env.NODE_ENV = 'test';

describe('Conductor GET /metrics', () => {
  test('returns Prometheus text with aerekos_conductor_http_requests counter', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text/);
    const body = res.text;
    expect(body).toMatch(/aerekos_conductor_http_requests_total/);
  });
});
