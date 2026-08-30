const request = require('supertest');
const app = require('../../index.js');
describe('config_manager', () => {
  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });
  test('ensure-defaults', async () => {
    const pid = 'p-config_manager-'+Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
