const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('secrets_manager API', () => {
  const projectId = 'proj-secrets-1';

  test('POST /api/v1/secrets stores without returning ciphertext', async () => {
    const res = await request(app)
      .post('/api/v1/secrets')
      .send({ project_id: projectId, name: 'my.token', value: 'supersecret', metadata: { env: 'dev' } });
    expect(res.status).toBe(201);
    expect(res.body.secret).toMatchObject({ name: 'my.token', project_id: projectId });
    expect(res.body.secret).not.toHaveProperty('ciphertext');
    expect(res.body.secret).not.toHaveProperty('value');
  });

  test('GET list has no values', async () => {
    const res = await request(app).get(`/api/v1/secrets?${Q(projectId)}`);
    expect(res.status).toBe(200);
    expect(res.body.secrets.length).toBeGreaterThan(0);
    for (const s of res.body.secrets) {
      expect(s).not.toHaveProperty('value');
      expect(s).not.toHaveProperty('ciphertext');
    }
  });

  test('GET by id with reveal=1 returns plaintext', async () => {
    const list = await request(app).get(`/api/v1/secrets?${Q(projectId)}`);
    const id = list.body.secrets[0].id;
    const res = await request(app).get(`/api/v1/secrets/${id}?${Q(projectId)}&reveal=1`);
    expect(res.status).toBe(200);
    expect(res.body.secret.value).toBe('supersecret');
  });

  test('GET by id without reveal has no value', async () => {
    const list = await request(app).get(`/api/v1/secrets?${Q(projectId)}`);
    const id = list.body.secrets[0].id;
    const res = await request(app).get(`/api/v1/secrets/${id}?${Q(projectId)}`);
    expect(res.status).toBe(200);
    expect(res.body.secret).not.toHaveProperty('value');
  });

  test('POST duplicate name returns 409', async () => {
    const res = await request(app)
      .post('/api/v1/secrets')
      .send({ project_id: projectId, name: 'my.token', value: 'x' });
    expect(res.status).toBe(409);
  });

  test('DELETE removes secret', async () => {
    const c = await request(app)
      .post('/api/v1/secrets')
      .send({ project_id: projectId, name: 'to.nuke', value: 'v' });
    const id = c.body.secret.id;
    const del = await request(app).delete(`/api/v1/secrets/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    const get = await request(app).get(`/api/v1/secrets/${id}?${Q(projectId)}&reveal=1`);
    expect(get.status).toBe(404);
  });
});
