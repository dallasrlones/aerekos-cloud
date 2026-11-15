'use strict';

const request = require('supertest');
const app = require('../../index.js');

describe('notify_manager health/proxy surface', () => {
  test('GET /health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.service).toBe('notify_manager');
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
    expect(res.body.service).toBe('notify_manager');
    expect(res.body.mock).toBe(true);
  });

  test('GET /api/v1/providers lists channels', async () => {
    const res = await request(app).get('/api/v1/providers');
    expect(res.status).toBe(200);
    expect(res.body.mock).toBe(true);
    expect(Array.isArray(res.body.providers)).toBe(true);
    expect(res.body.providers.some((p) => p.channel === 'email')).toBe(true);
  });

  test('ensure-defaults', async () => {
    const pid = 'p-notify_manager-' + Date.now();
    const res = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
