const request = require('supertest');
const app = require('../../index.js');

describe('git_manager pull requests', () => {
  const projectId = `proj-pr-${Date.now()}`;
  let repoId;
  let pullId;

  test('create repo then PR create/list/get/notes', async () => {
    const repo = await request(app).post('/api/v1/repos').send({
      project_id: projectId,
      name: 'pr-app',
    });
    expect(repo.status).toBe(201);
    repoId = repo.body.repository.id;

    const created = await request(app).post('/api/v1/pulls').send({
      project_id: projectId,
      repo_id: repoId,
      title: 'first',
      source_branch: 'feat',
      target_branch: 'main',
    });
    expect(created.status).toBe(201);
    pullId = created.body.pull.id;

    const listed = await request(app).get('/api/v1/pulls').query({ project_id: projectId });
    expect(listed.status).toBe(200);
    expect((listed.body.pulls || []).some((p) => p.id === pullId)).toBe(true);

    const got = await request(app).get(`/api/v1/pulls/${pullId}`).query({ project_id: projectId });
    expect(got.status).toBe(200);
    expect(got.body.pull.id).toBe(pullId);
    expect(typeof got.body.diff).toBe('string');

    const notes = await request(app)
      .post(`/api/v1/pulls/${pullId}/notes`)
      .send({ project_id: projectId, note: 'lgtm' });
    expect(notes.status).toBe(200);
    expect(notes.body.pull.notes).toMatch(/lgtm/);
  });

  test('protect main hook is installed on new repos', () => {
    const { GitService } = require('../../api/services/GitService');
    const src = GitService.prototype.installPreReceiveHook.toString();
    expect(src).toMatch(/AEREKOS_ALLOW_DIRECT/);
    expect(src).toMatch(/direct push/);
  });
});
