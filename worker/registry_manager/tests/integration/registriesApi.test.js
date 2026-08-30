const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('registry_manager /registries CRUD', () => {
  const projectId = `proj-reg-${Date.now()}`;

  test('create -> get -> update -> list -> delete', async () => {
    const c = await request(app).post('/api/v1/registries').send({
      project_id: projectId,
      name: 'harbor-prod',
      registry_url: 'harbor.example.com',
      type: 'harbor',
      namespace: 'aerekos',
      username: 'robot$ci',
      credential_ref: 'harbor-robot-token'
    });
    expect(c.status).toBe(201);
    expect(c.body.registry).toMatchObject({
      name: 'harbor-prod',
      registry_url: 'harbor.example.com',
      type: 'harbor',
      enabled: true
    });
    // Credentials are referenced, never echoed back as plaintext.
    expect(c.body.registry).not.toHaveProperty('password');
    const id = c.body.registry.id;

    const dup = await request(app).post('/api/v1/registries').send({
      project_id: projectId,
      name: 'harbor-prod',
      registry_url: 'harbor2.example.com'
    });
    expect(dup.status).toBe(409);

    const got = await request(app).get(`/api/v1/registries/${id}?${Q(projectId)}`);
    expect(got.status).toBe(200);
    expect(got.body.registry.namespace).toBe('aerekos');

    const upd = await request(app)
      .patch(`/api/v1/registries/${id}?${Q(projectId)}`)
      .send({ namespace: 'aerekos-staging', enabled: false });
    expect(upd.status).toBe(200);
    expect(upd.body.registry.namespace).toBe('aerekos-staging');
    expect(upd.body.registry.enabled).toBe(false);

    const list = await request(app).get(`/api/v1/registries?${Q(projectId)}`);
    expect(list.status).toBe(200);
    expect(list.body.registries.length).toBeGreaterThanOrEqual(1);

    const del = await request(app).delete(`/api/v1/registries/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const after = await request(app).get(`/api/v1/registries/${id}?${Q(projectId)}`);
    expect(after.status).toBe(404);
  });

  test('project_id is required', async () => {
    const res = await request(app).post('/api/v1/registries').send({ name: 'x', registry_url: 'y' });
    expect(res.status).toBe(400);
  });

  test('GET /images/project is project-scoped and not host inventory', async () => {
    process.env.SKIP_DOCKER = '1';
    const pid = `proj-img-${Date.now()}`;
    await request(app).post('/api/v1/artifacts').send({
      project_id: pid, name: 'aer-cmp-demo:abc', kind: 'docker', uri: 'aer-cmp-demo:abc',
    });
    const inv = await request(app).get(`/api/v1/inventory?${Q(pid)}`);
    expect(inv.status).toBe(200);
    const proj = await request(app).get(`/api/v1/images/project?${Q(pid)}`);
    expect(proj.status).toBe(200);
    expect(Array.isArray(proj.body.images)).toBe(true);
    expect(proj.body.images.some((i) => i.ref === 'aer-cmp-demo:abc')).toBe(true);
    expect(JSON.stringify(proj.body.images)).not.toMatch(/aerekos-cloud-conductor/);
  });

  test('POST /images/import is registry-shaped and skips host docker when SKIP_DOCKER', async () => {
    process.env.SKIP_DOCKER = '1';
    const pid = `proj-imp-${Date.now()}`;
    const res = await request(app).post('/api/v1/images/import').send({
      project_id: pid,
      name: 'imported:1',
    });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(true);
    expect(res.body.ref).toBe('imported:1');
  });
});

