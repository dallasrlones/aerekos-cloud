const request = require('supertest');
const express = require('express');
const { setupPrometheus } = require('../shared/simplePrometheusMetrics');

describe('shared simplePrometheusMetrics', () => {
  test('serves /metrics and increments counter for API paths', async () => {
    const app = express();
    app.use(express.json());
    setupPrometheus(app, { serviceName: 'test_service' });
    app.get('/api/hi', (req, res) => {
      res.json({ ok: 1 });
    });

    const m = await request(app).get('/metrics');
    expect(m.status).toBe(200);
    expect(m.text).toMatch(/aerekos_test_service/);
    expect(m.text).toMatch(/http_requests_total/);

    await request(app).get('/api/hi');
    const m2 = await request(app).get('/metrics');
    expect(m2.text).toMatch(/method="GET"/);
  });
});
