const request = require('supertest');
const app = require('../../index.js');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('git_manager /repos CRUD', () => {
  const projectId = `proj-git-${Date.now()}`;

  test('create -> get -> update -> list -> delete', async () => {
    const c = await request(app).post('/api/v1/repos').send({
      project_id: projectId,
      name: 'my-app',
      description: 'demo repository'
    });
    expect(c.status).toBe(201);
    expect(c.body.repository).toMatchObject({
      name: 'my-app',
      default_branch: 'main',
      visibility: 'private'
    });
    expect(c.body.repository.clone_path).toBe(
      `/git/${encodeURIComponent(projectId)}/my-app.git`
    );
    const id = c.body.repository.id;

    const dup = await request(app).post('/api/v1/repos').send({
      project_id: projectId,
      name: 'my-app'
    });
    expect(dup.status).toBe(409);

    const got = await request(app).get(`/api/v1/repos/${id}?${Q(projectId)}`);
    expect(got.status).toBe(200);
    expect(Array.isArray(got.body.repository.branches)).toBe(true);

    const upd = await request(app)
      .patch(`/api/v1/repos/${id}?${Q(projectId)}`)
      .send({ description: 'updated', visibility: 'public' });
    expect(upd.status).toBe(200);
    expect(upd.body.repository.description).toBe('updated');
    expect(upd.body.repository.visibility).toBe('public');

    const list = await request(app).get(`/api/v1/repos?${Q(projectId)}`);
    expect(list.status).toBe(200);
    expect(list.body.repositories.length).toBeGreaterThanOrEqual(1);

    const del = await request(app).delete(`/api/v1/repos/${id}?${Q(projectId)}`);
    expect(del.status).toBe(200);
    expect(del.body.deleted).toBe(true);

    const after = await request(app).get(`/api/v1/repos/${id}?${Q(projectId)}`);
    expect(after.status).toBe(404);
  });

  test('rejects invalid repo names', async () => {
    const res = await request(app)
      .post('/api/v1/repos')
      .send({ project_id: projectId, name: '../escape' });
    expect(res.status).toBe(400);
  });

  test('project_id is required', async () => {
    const res = await request(app).post('/api/v1/repos').send({ name: 'x' });
    expect(res.status).toBe(400);
  });

  test('records push events via the internal sink', async () => {
    const c = await request(app)
      .post('/api/v1/repos')
      .send({ project_id: projectId, name: 'hooked' });
    const id = c.body.repository.id;

    const ev = await request(app).post('/api/v1/internal/push-events').send({
      project_id: projectId,
      repo_id: id,
      ref: 'refs/heads/main',
      old_sha: '0'.repeat(40),
      new_sha: 'a'.repeat(40),
      pusher: 'tester'
    });
    expect(ev.status).toBe(201);
    expect(ev.body.recorded).toBe(true);

    const pushes = await request(app).get(`/api/v1/repos/${id}/pushes?${Q(projectId)}`);
    expect(pushes.status).toBe(200);
    expect(pushes.body.pushes.length).toBe(1);
    expect(pushes.body.pushes[0].ref).toBe('refs/heads/main');
  });

  test('GET /api/v1/info reports active', async () => {
    const res = await request(app).get('/api/v1/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(res.body.service).toBe('git_manager');
  });
});
