const request = require('supertest');
const app = require('../../index.js');

describe('audit_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('audit_manager');
  });

  test('GET /ready returns 200', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /api/v1/info', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toBe('audit_manager');
    expect(res.body.aws).toBe('CloudTrail');
  });

  test('ensure-defaults seeds bootstrap', async () => {
    const pid = 'p-audit_manager-' + Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.defaults.created).toBe(true);
    expect(res.body.defaults.item.name).toBe('bootstrap');
  });
});
