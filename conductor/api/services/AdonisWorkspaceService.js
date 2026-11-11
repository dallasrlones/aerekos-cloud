'use strict';

const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

function sm() {
  return ServiceManager.getInstance(WorkerRepository);
}

function taskName(projectId, repoId) {
  const safe = String(`${projectId}-${repoId}`).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
  return `adonis-ws-${safe}`;
}

function gitBaseUrl() {
  return String(
    process.env.ADONIS_GIT_BASE
    || process.env.GIT_LAN_URL
    || process.env.PUBLIC_GIT_URL
    || 'http://git_manager:3130'
  ).replace(/\/$/, '');
}

function err(message, status, code) {
  const e = new Error(message);
  e.status = status || 500;
  if (code) e.code = code;
  return e;
}

class AdonisWorkspaceService {
  async proxy(service, method, path, body, query, projectId, headers = {}) {
    return sm().proxyServiceRequest(service, method, path, body, query || {}, projectId, { headers });
  }

  async ensure({ projectId, repoId, ref, token }) {
    if (!projectId) throw err('project_id is required', 400);
    if (!repoId) throw err('repo_id is required', 400);
    if (!token) throw err('Authentication required', 401);

    const repoRes = await this.proxy(
      'git_manager',
      'GET',
      `/api/v1/repos/${repoId}`,
      null,
      { project_id: projectId },
      projectId,
    );
    if (repoRes.status >= 400) {
      throw err(repoRes.data?.error?.message || 'repository not found', repoRes.status || 404);
    }
    const repo = repoRes.data?.repository || repoRes.data;
    const branch = ref || repo.default_branch || 'main';
    const name = taskName(projectId, repoId);
    const cloneUrl = `${gitBaseUrl()}/git/${encodeURIComponent(projectId)}/${encodeURIComponent(repo.name)}.git`;

    const listed = await this.proxy(
      'compute_manager',
      'GET',
      '/api/v1/tasks',
      null,
      { project_id: projectId },
      projectId,
    );
    const tasks = listed.data?.tasks || listed.data?.items || [];
    let task = tasks.find((t) => t.name === name);

    if (task && (task.status === 'running' || task.status === 'pending')) {
      return this.shape(task, repo, branch);
    }

    if (task && (task.status === 'stopped' || task.status === 'exited' || task.status === 'failed')) {
      try {
        await this.proxy(
          'compute_manager',
          'POST',
          `/api/v1/tasks/${task.id}/start`,
          { project_id: projectId },
          {},
          projectId,
        );
        const got = await this.proxy(
          'compute_manager',
          'GET',
          `/api/v1/tasks/${task.id}`,
          null,
          { project_id: projectId },
          projectId,
        );
        return this.shape(got.data?.task || task, repo, branch);
      } catch (e) {
        try {
          await this.proxy(
            'compute_manager',
            'DELETE',
            `/api/v1/tasks/${task.id}`,
            null,
            { project_id: projectId },
            projectId,
          );
        } catch { /* recreate below */ }
        task = null;
      }
    }

    const bootstrap = [
      'bash',
      '-lc',
      [
        'set -euo pipefail',
        'mkdir -p /workspace',
        'cd /workspace',
        'AUTH=$(printf "x:%s" "$ADONIS_GIT_TOKEN" | base64 | tr -d "\\n")',
        'if [ ! -d repo/.git ]; then',
        '  git -c http.extraHeader="Authorization: Basic $AUTH" clone --branch "$ADONIS_GIT_REF" "$ADONIS_GIT_URL" repo \\',
        '    || git -c http.extraHeader="Authorization: Basic $AUTH" clone "$ADONIS_GIT_URL" repo',
        '  cd repo && git checkout "$ADONIS_GIT_REF" || true',
        'fi',
        'cd /workspace/repo',
        'exec sleep infinity',
      ].join('\n'),
    ];

    const created = await this.proxy(
      'compute_manager',
      'POST',
      '/api/v1/tasks',
      {
        project_id: projectId,
        name,
        image: process.env.ADONIS_WORKSPACE_IMAGE || 'node:20-bookworm',
        run_mode: 'service',
        environment: 'dev',
        command: bootstrap,
        env: {
          ADONIS_GIT_TOKEN: token,
          ADONIS_GIT_URL: cloneUrl,
          ADONIS_GIT_REF: branch,
          ADONIS_REPO_ID: String(repoId),
          ADONIS_PROJECT_ID: String(projectId),
        },
        place: 'any',
      },
      {},
      projectId,
    );
    if (created.status >= 400) {
      throw err(created.data?.error?.message || `failed to create workspace (${created.status})`, created.status || 500);
    }
    return this.shape(created.data?.task || created.data, repo, branch);
  }

  shape(task, repo, branch) {
    return {
      task_id: task.id,
      task_name: task.name,
      status: task.status,
      worker_id: task.worker_id || task.pin_worker_id || null,
      container_id: task.container_id || null,
      project_id: task.project_id,
      repo_id: repo?.id,
      repo_name: repo?.name,
      ref: branch,
    };
  }

  async stop({ projectId, taskId, repoId, token }) {
    if (!projectId) throw err('project_id is required', 400);
    if (!token) throw err('Authentication required', 401);
    let id = taskId;
    if (!id && repoId) {
      const name = taskName(projectId, repoId);
      const listed = await this.proxy(
        'compute_manager',
        'GET',
        '/api/v1/tasks',
        null,
        { project_id: projectId },
        projectId,
      );
      const tasks = listed.data?.tasks || [];
      const found = tasks.find((t) => t.name === name);
      id = found?.id;
    }
    if (!id) throw err('workspace not found', 404);
    try {
      await this.proxy(
        'compute_manager',
        'POST',
        `/api/v1/tasks/${id}/stop`,
        { project_id: projectId },
        {},
        projectId,
      );
    } catch { /* still try delete */ }
    await this.proxy(
      'compute_manager',
      'DELETE',
      `/api/v1/tasks/${id}`,
      null,
      { project_id: projectId },
      projectId,
    );
    return { stopped: true, task_id: id };
  }

  async deploy({ projectId, repoId, repoName, ref, token }) {
    if (!projectId) throw err('project_id: required', 400);
    if (!token) throw err('Authentication required', 401);
    let name = repoName;
    if (!name && repoId) {
      const repoRes = await this.proxy(
        'git_manager',
        'GET',
        `/api/v1/repos/${repoId}`,
        null,
        { project_id: projectId },
        projectId,
      );
      name = repoRes.data?.repository?.name;
    }
    if (!name) throw err('repo name required', 400);

    let hasDockerfile = false;
    try {
      const blob = await this.proxy(
        'git_manager',
        'GET',
        `/api/v1/repos/${repoId}/blob`,
        null,
        { project_id: projectId, ref: ref || 'main', path: 'Dockerfile' },
        projectId,
      );
      hasDockerfile = blob.status === 200;
    } catch {
      hasDockerfile = false;
    }
    if (!hasDockerfile) {
      throw err('add a Dockerfile (or link a pipeline) before Deploy', 400, 'NO_DOCKERFILE');
    }

    const pipes = await this.proxy(
      'cicd_manager',
      'GET',
      '/api/v1/pipelines',
      null,
      { project_id: projectId },
      projectId,
    );
    const items = pipes.data?.pipelines || pipes.data?.items || [];
    let pipe = items.find((p) => p.repo === name || p.repo_name === name || p.repo_id === repoId);
    if (!pipe) {
      const created = await this.proxy(
        'cicd_manager',
        'POST',
        '/api/v1/pipelines',
        {
          project_id: projectId,
          name: `adonis-${name}`,
          repo: name,
          repo_name: name,
          dockerfile: 'Dockerfile',
          git_ref: ref || 'main',
          steps_json: '["deploy"]',
        },
        {},
        projectId,
      );
      if (created.status >= 400) {
        throw err(created.data?.error?.message || 'failed to create pipeline', created.status || 500);
      }
      pipe = created.data?.pipeline || created.data?.item || created.data;
    }

    const run = await this.proxy(
      'cicd_manager',
      'POST',
      '/api/v1/pipelines/run-for-repo',
      {
        project_id: projectId,
        repo: name,
        repo_name: name,
        repo_id: repoId,
        ref: ref || 'main',
      },
      {},
      projectId,
    );
    if (run.status >= 500) {
      throw err(run.data?.error?.message || `deploy failed (${run.status})`, run.status);
    }
    return {
      deployed: true,
      pipeline_id: pipe?.id,
      status: run.status,
      result: run.data,
    };
  }
}

module.exports = { AdonisWorkspaceService, taskName };
