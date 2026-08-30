const request = require('supertest');
const app = require('../../index.js');
describe('code_as_infra', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
});
