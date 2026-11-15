'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('event_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('event_manager');
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
    expect(res.body.service).toBe('event_manager');
  });

  test('ensure-defaults', async () => {
    const pid = 'p-event_manager-' + Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.defaults.default.item.name).toBe('default');
    expect(res.body.defaults['aerekos.fleet'].item.name).toBe('aerekos.fleet');
  });
});
