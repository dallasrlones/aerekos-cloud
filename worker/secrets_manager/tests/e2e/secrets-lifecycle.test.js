'use strict';

/**
 * Process-local e2e: full create → list → values → reveal → patch → delete.
 * Does not require a live conductor stack (MOCK_KEY_MANAGER via tests/setup.js).
 * Live-stack proxy scenarios remain in tests/e2e/README.md.
 */
const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId, extra = '') =>
  `project_id=${encodeURIComponent(projectId)}${extra ? `&${extra}` : ''}`;

describe('e2e secrets lifecycle', () => {
  // ARN enrichment requires a UUID project_id (see worker/shared/arn.js).
  const projectId = '22222222-2222-4222-8222-222222222222';
  let secretId;

  test('create → list redacted → values map → reveal → patch → delete', async () => {
    const created = await request(app)
      .post('/api/v1/secrets')
      .send({
        project_id: projectId,
        name: 'e2e_demo_token',
        value: 'e2e-plain-1',
        environment: 'dev',
        metadata: { source: 'e2e' },
      });
    expect(created.status).toBe(201);
    expect(created.body.secret).toMatchObject({
      name: 'e2e_demo_token',
      project_id: projectId,
      environment: 'dev',
    });
    expect(created.body.secret.arn).toBeTruthy();
    expect(created.body.secret).not.toHaveProperty('value');
    secretId = created.body.secret.id;

    const list = await request(app).get(`/api/v1/secrets?${Q(projectId, 'environment=dev')}`);
    expect(list.status).toBe(200);
    expect(list.body.secrets.some((s) => s.id === secretId)).toBe(true);
    for (const s of list.body.secrets) {
      expect(s).not.toHaveProperty('value');
    }

    const values = await request(app).get(
      `/api/v1/secrets/values?${Q(projectId, 'environment=dev')}`
    );
    expect(values.status).toBe(200);
    expect(values.body.values.e2e_demo_token).toBe('e2e-plain-1');

    const revealed = await request(app).get(
      `/api/v1/secrets/${secretId}?${Q(projectId)}&reveal=1`
    );
    expect(revealed.status).toBe(200);
    expect(revealed.body.secret.value).toBe('e2e-plain-1');

    const patched = await request(app)
      .patch(`/api/v1/secrets/${secretId}?${Q(projectId)}`)
      .send({ value: 'e2e-plain-2' });
    expect(patched.status).toBe(200);
    expect(patched.body.secret).not.toHaveProperty('value');

    const after = await request(app).get(
      `/api/v1/secrets/${secretId}?${Q(projectId)}&reveal=1`
    );
    expect(after.body.secret.value).toBe('e2e-plain-2');

    const del = await request(app).delete(`/api/v1/secrets/${secretId}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const missing = await request(app).get(
      `/api/v1/secrets/${secretId}?${Q(projectId)}&reveal=1`
    );
    expect(missing.status).toBe(404);
  });

  test('health and info are up', async () => {
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('healthy');
    const info = await request(app).get('/api/v1/info');
    expect(info.status).toBe(200);
    expect(info.body.service).toBe('secrets_manager');
  });
});
