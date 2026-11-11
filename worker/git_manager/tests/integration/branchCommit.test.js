const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');

const Q = (projectId) => `project_id=${encodeURIComponent(projectId)}`;

describe('git_manager branch / commit-file / delete-file (real git)', () => {
  const prevSkip = process.env.SKIP_GIT;
  const prevRoot = process.env.GIT_REPOS_ROOT;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-git-real-'));
  let app;
  let hasGit = false;

  beforeAll(() => {
    try {
      require('child_process').execFileSync('git', ['--version'], { stdio: 'ignore' });
      hasGit = true;
    } catch {
      hasGit = false;
    }
    process.env.SKIP_GIT = hasGit ? '0' : '1';
    process.env.GIT_REPOS_ROOT = root;
    jest.resetModules();
    app = require('../../index.js');
  });

  afterAll(() => {
    process.env.SKIP_GIT = prevSkip;
    process.env.GIT_REPOS_ROOT = prevRoot;
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('seed README → branch → commit → 409 stale base_sha → delete → PR merge', async () => {
    if (!hasGit) {
      console.warn('skip real-git suite: git binary not on PATH');
      return;
    }
    const projectId = `proj-real-${Date.now()}`;
    const created = await request(app).post('/api/v1/repos').send({
      project_id: projectId,
      name: 'real-app',
    });
    if (created.status !== 201) {
      // eslint-disable-next-line no-console
      console.error('create failed', created.status, created.body);
    }
    expect(created.status).toBe(201);
    const id = created.body.repository.id;

    const blobReadme = await request(app)
      .get(`/api/v1/repos/${id}/blob`)
      .query({ project_id: projectId, ref: 'main', path: 'README.md' });
    expect(blobReadme.status).toBe(200);
    expect(blobReadme.body.content).toMatch(/real-app/);

    const branchesBefore = await request(app)
      .get(`/api/v1/repos/${id}/branches`)
      .query({ project_id: projectId });
    expect(branchesBefore.status).toBe(200);
    const main = (branchesBefore.body.branches || []).find((b) => b.name === 'main');
    expect(main?.sha).toBeTruthy();

    const branched = await request(app)
      .post(`/api/v1/repos/${id}/branches`)
      .send({ project_id: projectId, name: 'feat-x', from: 'main' });
    expect(branched.status).toBe(201);
    expect(branched.body.name).toBe('feat-x');

    const committed = await request(app)
      .post(`/api/v1/repos/${id}/commit-file`)
      .send({
        project_id: projectId,
        branch: 'feat-x',
        path: 'hello.txt',
        content: 'hello adonis\n',
        message: 'feat: add hello',
        base_sha: branched.body.sha,
      });
    expect(committed.status).toBe(200);
    expect(committed.body.committed).toBe(true);
    expect(committed.body.sha).toBeTruthy();
    const tipAfter = committed.body.sha;

    const stale = await request(app)
      .post(`/api/v1/repos/${id}/commit-file`)
      .send({
        project_id: projectId,
        branch: 'feat-x',
        path: 'hello.txt',
        content: 'stale\n',
        message: 'should fail',
        base_sha: branched.body.sha,
      });
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe('BASE_SHA_MISMATCH');

    const ok = await request(app)
      .post(`/api/v1/repos/${id}/commit-file`)
      .send({
        project_id: projectId,
        branch: 'feat-x',
        path: 'hello.txt',
        content: 'hello again\n',
        message: 'feat: update hello',
        base_sha: tipAfter,
      });
    expect(ok.status).toBe(200);

    const extra = await request(app)
      .post(`/api/v1/repos/${id}/commit-file`)
      .send({
        project_id: projectId,
        branch: 'feat-x',
        path: 'tmp-del.txt',
        content: 'bye\n',
        message: 'feat: add tmp',
      });
    expect(extra.status).toBe(200);

    const deleted = await request(app)
      .post(`/api/v1/repos/${id}/delete-file`)
      .send({
        project_id: projectId,
        branch: 'feat-x',
        path: 'tmp-del.txt',
        message: 'chore: remove tmp',
        base_sha: extra.body.sha,
      });
    expect(deleted.status).toBe(200);
    expect(deleted.body.deleted).toBe(true);

    const gone = await request(app)
      .get(`/api/v1/repos/${id}/blob`)
      .query({ project_id: projectId, ref: 'feat-x', path: 'tmp-del.txt' });
    expect(gone.status).toBe(404);

    const compare = await request(app)
      .get(`/api/v1/repos/${id}/compare`)
      .query({ project_id: projectId, base: 'main', head: 'feat-x' });
    expect(compare.status).toBe(200);
    expect(typeof compare.body.diff).toBe('string');

    const pr = await request(app).post('/api/v1/pulls').send({
      project_id: projectId,
      repo_id: id,
      title: 'feat-x',
      source_branch: 'feat-x',
      target_branch: 'main',
    });
    expect(pr.status).toBe(201);
    const pullId = pr.body.pull.id;

    const merged = await request(app)
      .post(`/api/v1/pulls/${pullId}/merge`)
      .send({ project_id: projectId });
    expect(merged.status).toBeLessThan(400);

    const mainBlob = await request(app)
      .get(`/api/v1/repos/${id}/blob`)
      .query({ project_id: projectId, ref: 'main', path: 'hello.txt' });
    expect(mainBlob.status).toBe(200);
    expect(mainBlob.body.content).toMatch(/hello again/);
  });
});
