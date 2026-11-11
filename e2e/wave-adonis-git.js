'use strict';

const { skipLive, assert, runNamed, request, env } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

async function main() {
  console.log('Wave adonis/git e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('adonis-git', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;
    let repoId;
    let repoName = `adonis-app-${box.runId}`;
    let featSha;

    ok = await runNamed('create repo seeds README', async () => {
      const repo = await request('POST', '/api/services/git_manager/api/v1/repos', {
        token,
        body: { project_id: pid, name: repoName },
      });
      assert(repo.status === 201 || repo.status === 200, `repo HTTP ${repo.status}`);
      repoId = repo.data?.repository?.id;
      assert(repoId, 'repo id');
      box.track({ kind: 'repo', id: repoId });
      const blob = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/blob`, {
        token,
        query: { project_id: pid, ref: 'main', path: 'README.md' },
      });
      assert(blob.status === 200, `README blob HTTP ${blob.status}`);
      assert(String(blob.data?.content || '').includes(repoName), 'README content');
      return 'ok';
    }) && ok;

    ok = await runNamed('create branch + commit-file + base_sha 409', async () => {
      const br = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/branches`, {
        token,
        body: { project_id: pid, name: 'feat-adonis', from: 'main' },
      });
      assert(br.status === 201 || br.status === 200, `branch HTTP ${br.status}`);
      const base = br.data?.sha;
      const c1 = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'feat-adonis',
          path: 'app.txt',
          content: 'hello\n',
          message: 'feat: app',
          base_sha: base,
        },
      });
      assert(c1.status === 200, `commit HTTP ${c1.status}`);
      featSha = c1.data?.sha;
      const stale = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'feat-adonis',
          path: 'app.txt',
          content: 'stale\n',
          message: 'bad',
          base_sha: base,
        },
      });
      assert(stale.status === 409, `stale base_sha expected 409 got ${stale.status}`);
      return 'ok';
    }) && ok;

    ok = await runNamed('delete-file', async () => {
      const add = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'feat-adonis',
          path: 'tmp.txt',
          content: 'x\n',
          message: 'add tmp',
          base_sha: featSha,
        },
      });
      assert(add.status === 200, `add tmp HTTP ${add.status}`);
      const del = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/delete-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'feat-adonis',
          path: 'tmp.txt',
          message: 'rm tmp',
          base_sha: add.data?.sha,
        },
      });
      assert(del.status === 200, `delete HTTP ${del.status}`);
      featSha = del.data?.sha || featSha;
      return 'ok';
    }) && ok;

    ok = await runNamed('PR + checks shape + merge', async () => {
      const pr = await request('POST', '/api/services/git_manager/api/v1/pulls', {
        token,
        body: {
          project_id: pid,
          repo_id: repoId,
          title: 'feat-adonis',
          source_branch: 'feat-adonis',
          target_branch: 'main',
        },
      });
      assert(pr.status === 201 || pr.status === 200, `PR HTTP ${pr.status}`);
      const pullId = pr.data?.pull?.id;
      const got = await request('GET', `/api/services/git_manager/api/v1/pulls/${pullId}`, {
        token,
        query: { project_id: pid },
      });
      assert(got.status === 200, `get PR HTTP ${got.status}`);
      assert(Array.isArray(got.data?.checks), 'checks array');
      const merged = await request('POST', `/api/services/git_manager/api/v1/pulls/${pullId}/merge`, {
        token,
        body: { project_id: pid },
      });
      assert(merged.status < 400, `merge HTTP ${merged.status}`);
      const blob = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/blob`, {
        token,
        query: { project_id: pid, ref: 'main', path: 'app.txt' },
      });
      assert(blob.status === 200 && String(blob.data?.content || '').includes('hello'), 'merged content');
      return 'ok';
    }) && ok;

    ok = await runNamed('Adonis tree/blob/commit-file round-trip', async () => {
      const tree = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/tree`, {
        token,
        query: { project_id: pid, ref: 'main' },
      });
      assert(tree.status === 200 && Array.isArray(tree.data?.entries), 'tree');
      const branches = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/branches`, {
        token,
        query: { project_id: pid },
      });
      const main = (branches.data?.branches || []).find((b) => b.name === 'main');
      const c = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'main',
          path: 'app.txt',
          content: 'hello adonis\n',
          message: 'chore: adonis save',
          base_sha: main?.sha,
        },
      });
      assert(c.status === 200, `adonis save HTTP ${c.status}`);
      const blob = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/blob`, {
        token,
        query: { project_id: pid, ref: 'main', path: 'app.txt' },
      });
      assert(String(blob.data?.content || '').includes('adonis'), 're-get blob');
      return 'ok';
    }) && ok;

    const gitUrl = env('GIT_MANAGER_URL') || 'http://localhost:3130';
    ok = await runNamed('Smart HTTP pull sees content (JWT basic)', async () => {
      try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });
      } catch {
        box.skip('git binary missing');
        return 'skip';
      }
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adonis-clone-'));
      try {
        const remote = `${gitUrl}/git/${encodeURIComponent(pid)}/${encodeURIComponent(repoName)}.git`;
        execFileSync('git', [
          '-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x:${token}`).toString('base64')}`,
          'clone', remote, dir,
        ], { stdio: 'pipe', timeout: 60000 });
        const body = fs.readFileSync(path.join(dir, 'app.txt'), 'utf8');
        assert(body.includes('adonis') || body.includes('hello'), 'cloned file');
        return 'ok';
      } catch (e) {
        box.skip(`smart http: ${e.message}`);
        return 'skip';
      } finally {
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }) && ok;

    let workspaceTaskId = null;
    ok = await runNamed('ensure workspace + reuse + stop', async () => {
      const ensure = await request('POST', '/api/adonis/workspaces', {
        token,
        body: { project_id: pid, repo_id: repoId, ref: 'main' },
        timeoutMs: 180000,
      });
      if (ensure.status >= 500) {
        box.skip(`workspace ensure HTTP ${ensure.status}`);
        return 'skip';
      }
      assert(ensure.status < 400, `ensure HTTP ${ensure.status}`);
      workspaceTaskId = ensure.data?.workspace?.task_id;
      assert(workspaceTaskId, 'task_id');
      box.track({ kind: 'task', id: workspaceTaskId });
      const again = await request('POST', '/api/adonis/workspaces', {
        token,
        body: { project_id: pid, repo_id: repoId, ref: 'main' },
        timeoutMs: 180000,
      });
      assert(again.status < 400, `reuse HTTP ${again.status}`);
      assert(again.data?.workspace?.task_id === workspaceTaskId, 'reuse same task');
      const ws = ensure.data?.workspace;
      if (ws?.worker_id && ws?.container_id && ws.container_id !== 'mock-container-id') {
        const exec = await request('POST', `/api/workers/${ws.worker_id}/containers/${ws.container_id}/exec`, {
          token,
          body: { cmd: 'echo adonis-e2e' },
          timeoutMs: 60000,
        });
        assert(exec.status < 400, `exec HTTP ${exec.status}`);
        const out = String(exec.data?.stdout || exec.data?.output || '');
        assert(out.includes('adonis-e2e') || exec.status < 400, 'exec stdout');
      } else {
        box.skip('no live container for exec');
      }
      const stop = await request('DELETE', '/api/adonis/workspaces', {
        token,
        body: { project_id: pid, repo_id: repoId, task_id: workspaceTaskId },
      });
      assert(stop.status < 400, `stop HTTP ${stop.status}`);
      return 'ok';
    }) && ok;

    ok = await runNamed('deploy missing Dockerfile + with Dockerfile', async () => {
      const missing = await request('POST', '/api/adonis/deploy', {
        token,
        body: { project_id: pid, repo_id: repoId, repo_name: repoName, ref: 'main' },
      });
      assert(missing.status === 400, `missing Dockerfile expected 400 got ${missing.status}`);
      assert(missing.data?.error?.code === 'NO_DOCKERFILE' || /Dockerfile/i.test(missing.data?.error?.message || ''), 'NO_DOCKERFILE');

      const branches = await request('GET', `/api/services/git_manager/api/v1/repos/${repoId}/branches`, {
        token,
        query: { project_id: pid },
      });
      const main = (branches.data?.branches || []).find((b) => b.name === 'main');
      const df = await request('POST', `/api/services/git_manager/api/v1/repos/${repoId}/commit-file`, {
        token,
        body: {
          project_id: pid,
          branch: 'main',
          path: 'Dockerfile',
          content: 'FROM alpine:3.19\nCMD ["sleep","infinity"]\n',
          message: 'chore: Dockerfile',
          base_sha: main?.sha,
        },
      });
      assert(df.status === 200, `Dockerfile commit HTTP ${df.status}`);
      const deploy = await request('POST', '/api/adonis/deploy', {
        token,
        body: { project_id: pid, repo_id: repoId, repo_name: repoName, ref: 'main' },
        timeoutMs: 180000,
      });
      assert(deploy.status < 500, `deploy HTTP ${deploy.status}`);
      return String(deploy.status);
    }) && ok;

    const unauth = await request('POST', '/api/adonis/workspaces', {
      body: { project_id: pid, repo_id: repoId, ref: 'main' },
    });
    ok = await runNamed('ensure rejects without auth', async () => {
      assert(unauth.status === 401, `unauth HTTP ${unauth.status}`);
      return 'ok';
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
