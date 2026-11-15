'use strict';

/**
 * In-process e2e: health → provider → credential→token → user login/verify.
 * Live conductor/proxy smoke remains manual — see tests/e2e/README.md.
 */

const request = require('supertest');

process.env.SKIP_SERVICE_REGISTRATION = 'true';
process.env.AUTH_MANAGER_SECRET = process.env.AUTH_MANAGER_SECRET || 'e2e-auth-manager-secret';

const app = require('../../index');
const projectId = 'e2e22222-2222-4222-8222-222222222222';

describe('e2e auth_manager flow', () => {
  test('health and ready', async () => {
    await request(app).get('/health').expect(200);
    await request(app).get('/ready').expect(200);
  });

  test('provider + credential token + user login lifecycle', async () => {
    const prov = await request(app)
      .post('/api/v1/providers')
      .send({
        project_id: projectId,
        name: `oidc-${Date.now()}`,
        provider_type: 'oidc',
        issuer: 'https://example.test',
        client_id: 'meta-only',
        config_json: '{}',
      })
      .expect(201);
    expect(prov.body.item.id).toBeTruthy();

    const arn = `arn:aerekos:${projectId}:ai:llm:endpoint/e2e`;
    const cred = await request(app)
      .post('/api/v1/credentials')
      .send({
        project_id: projectId,
        name: `cred-${Date.now()}`,
        allowed_resources: [arn],
        scopes: ['ai:InvokeLlm'],
      })
      .expect(201);

    const tok = await request(app)
      .post('/api/v1/auth/token')
      .send({
        grant_type: 'client_credentials',
        client_id: cred.body.client_id,
        client_secret: cred.body.client_secret,
      })
      .expect(200);
    expect(tok.body.access_token).toBeTruthy();

    const verApp = await request(app)
      .post('/api/v1/auth/verify')
      .send({ token: tok.body.access_token })
      .expect(200);
    expect(verApp.body.active).toBe(true);
    expect(verApp.body.claims.typ).toBe('app');

    const uname = `e2e_${Date.now()}`.slice(0, 40);
    const user = await request(app)
      .post('/api/v1/users')
      .send({ project_id: projectId, username: uname, password: 'hunter22', name: 'E2E' })
      .expect(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ project_id: projectId, username: uname, password: 'hunter22' })
      .expect(200);
    expect(login.body.token).toBeTruthy();

    const verUser = await request(app)
      .post('/api/v1/auth/verify')
      .send({ token: login.body.token })
      .expect(200);
    expect(verUser.body.active).toBe(true);
    expect(verUser.body.claims.typ).toBe('user');
    expect(verUser.body.claims.sub).toBe(`user:${user.body.user.id}`);

    await request(app)
      .delete(`/api/v1/users/${user.body.user.id}`)
      .query({ project_id: projectId })
      .expect(200);
    await request(app)
      .delete(`/api/v1/credentials/${cred.body.credential.id}`)
      .query({ project_id: projectId })
      .expect(200);
    await request(app)
      .delete(`/api/v1/providers/${prov.body.item.id}`)
      .query({ project_id: projectId })
      .expect(200);
  });
});
