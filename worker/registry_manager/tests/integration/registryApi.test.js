const request = require('supertest');
const app = require('../../index.js');

describe('registry_manager API', () => {
  test('GET /api/v1/registry/config returns public shape', async () => {
    const res = await request(app).get('/api/v1/registry/config');
    expect(res.status).toBe(200);
    expect(res.body.registry).toMatchObject({
      mode: expect.any(String),
      public_base_url: expect.any(String),
      default_namespace: expect.any(String),
      auth_expected: expect.any(Boolean)
    });
    expect(res.body.registry.docs).toBeDefined();
    expect(res.body.registry).not.toHaveProperty('password');
  });
});
