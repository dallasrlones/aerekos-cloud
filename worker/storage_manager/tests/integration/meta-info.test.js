'use strict';

const request = require('supertest');
const express = require('express');

describe('GET /api/info', () => {
  let app;

  beforeEach(() => {
    process.env.SERVICE_NAME = 'storage_manager';
    process.env.SERVICE_VERSION = '1.0.0';
    delete require.cache[require.resolve('../../api/routes/meta')];
    const metaRoutes = require('../../api/routes/meta');
    app = express();
    app.use('/api', metaRoutes);
  });

  it('returns service metadata', async () => {
    const response = await request(app).get('/api/info').expect(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        service: 'storage_manager',
        title: 'Storage Manager',
        version: '1.0.0',
        status: 'active',
      })
    );
    expect(String(response.body.message || '')).toMatch(/key_manager/i);
    expect(String(response.body.message || '')).toMatch(/MOCK_KEY_MANAGER/);
  });
});
