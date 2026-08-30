const request = require('supertest');
const app = require('../../index.js');

const Q = (id) => `project_id=${encodeURIComponent(id)}`;

describe('auth_manager credentials', () => {
  const pid = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';
  const arn = `arn:aerekos:${pid}:ai:llm:endpoint/test-llm`;

  test('create credential → token → verify app claims', async () => {
    const c = await request(app)
      .post('/api/v1/credentials')
      .send({
        project_id: pid,
        name: `cred-${Date.now()}`,
        allowed_resources: [arn],
        scopes: ['ai:InvokeLlm'],
      });
    expect(c.status).toBe(201);
    expect(c.body.client_id).toMatch(/^cred_/);
    expect(c.body.client_secret).toBeTruthy();

    const tok = await request(app)
      .post('/api/v1/auth/token')
      .send({
        grant_type: 'client_credentials',
        client_id: c.body.client_id,
        client_secret: c.body.client_secret,
      });
    expect(tok.status).toBe(200);
    expect(tok.body.access_token).toBeTruthy();

    const ver = await request(app)
      .post('/api/v1/auth/verify')
      .send({ token: tok.body.access_token });
    expect(ver.status).toBe(200);
    expect(ver.body.active).toBe(true);
    expect(ver.body.claims.typ).toBe('app');
    expect(ver.body.claims.project_id).toBe(pid);
    expect(ver.body.claims.resources).toContain(arn);
    expect(ver.body.claims.scope).toContain('ai:InvokeLlm');
  });
});
