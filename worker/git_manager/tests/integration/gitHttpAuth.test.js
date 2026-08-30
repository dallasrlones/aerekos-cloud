const request = require('supertest');
const app = require('../../index.js');

describe('git Smart HTTP auth', () => {
  const prev = {
    GIT_AUTH_TOKEN: process.env.GIT_AUTH_TOKEN,
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  afterEach(() => {
    process.env.GIT_AUTH_TOKEN = prev.GIT_AUTH_TOKEN;
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.JWT_SECRET = prev.JWT_SECRET;
  });

  test('production without token → 401', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GIT_AUTH_TOKEN;
    const res = await request(app).get('/git/proj/repo.git/info/refs').query({ service: 'git-upload-pack' });
    expect(res.status).toBe(401);
  });

  test('accepts GIT_AUTH_TOKEN', async () => {
    process.env.GIT_AUTH_TOKEN = 'shared-secret';
    const res = await request(app)
      .get('/git/proj/missing.git/info/refs')
      .query({ service: 'git-upload-pack' })
      .set('Authorization', 'Bearer shared-secret');
    expect(res.status).toBe(404);
  });

  test('rejects unverified eyJ JWT in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.GIT_AUTH_TOKEN;
    process.env.JWT_SECRET = 'unit-test-secret';
    const bogus = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: 'x' })).toString('base64url')}.`;
    const res = await request(app)
      .get('/git/proj/repo.git/info/refs')
      .query({ service: 'git-upload-pack' })
      .set('Authorization', `Bearer ${bogus}`);
    expect(res.status).toBe(401);
  });
});
