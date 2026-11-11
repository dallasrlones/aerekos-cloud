'use strict';

const ProjectRepository = require('../repos/ProjectRepository');
const SetupService = require('./SetupService');
const StackService = require('./StackService');
const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

function parseConfig(project) {
  if (!project) return {};
  if (project.config && typeof project.config === 'object' && !Array.isArray(project.config)) {
    return { ...project.config };
  }
  try {
    return JSON.parse(project.config || '{}') || {};
  } catch {
    return {};
  }
}

function sm() {
  return ServiceManager.getInstance(WorkerRepository);
}

function authHeader(token) {
  if (!token) return {};
  return { authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
}

function healthWaitMs() {
  const n = parseInt(process.env.IAC_HEALTH_WAIT_MS || '30000', 10);
  return Number.isFinite(n) && n >= 0 ? n : 30000;
}

function healthIntervalMs() {
  const n = parseInt(process.env.IAC_HEALTH_INTERVAL_MS || '1000', 10);
  return Number.isFinite(n) && n >= 50 ? n : 1000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class IacHookupService {
  async waitForHealth(serviceName, projectId, bearerToken) {
    const timeoutMs = healthWaitMs();
    const intervalMs = healthIntervalMs();
    const deadline = Date.now() + timeoutMs;
    let lastErr = 'not probed';
    do {
      try {
        const res = await sm().proxyServiceRequest(
          serviceName,
          'GET',
          '/health',
          null,
          {},
          projectId,
          {},
        );
        if (res.status === 200) return { ok: true };
        lastErr = `HTTP ${res.status}`;
      } catch (err) {
        lastErr = err.message || String(err);
      }
      if (Date.now() >= deadline) break;
      await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
    } while (Date.now() < deadline);
    return { ok: false, error: `${serviceName} health: ${lastErr}` };
  }

  async ensureEnabled(projectId, bearerToken) {
    try {
      await SetupService.enableWithDependencies(projectId, 'code_as_infra', {
        with_dependencies: true,
        defaults: true,
      });
    } catch (err) {
      console.warn('[iac] enable code_as_infra:', err.message);
      return { ok: false, error: err.message };
    }
    try {
      const cur = await StackService.current(projectId);
      if (!cur || cur.status === 'empty') {
        await StackService.put(projectId, StackService.empty(projectId));
      } else {
        await StackService.upsertIacModule(projectId, cur.stack);
      }
    } catch (err) {
      console.warn('[iac] seed stack:', err.message);
    }
    return { ok: true };
  }

  async status(projectId, bearerToken) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }
    const cfg = parseConfig(project);
    const hook = cfg.iac_hookup || {};
    const missing = [];
    let managerOk = true;
    try {
      const res = await sm().proxyServiceRequest(
        'code_as_infra',
        'GET',
        '/health',
        null,
        {},
        projectId,
        {},
      );
      managerOk = res.status === 200;
    } catch {
      managerOk = false;
    }
    if (!managerOk) missing.push('manager');

    const hooked_up = hook.mode === 'conductor' || hook.mode === 'git';
    if (!hooked_up && managerOk) missing.push('source');
    if (hook.mode === 'git' && !hook.repo) missing.push('repo');

    return {
      hooked_up: hooked_up && managerOk,
      mode: hook.mode || null,
      repo: hook.repo || null,
      missing,
      project_id: projectId,
    };
  }

  async hookup(projectId, { mode = 'conductor', repo = 'infra' } = {}, bearerToken) {
    console.log(`[iac] hookup project=${projectId} mode=${mode} repo=${repo}`);
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }
    const enabled = await this.ensureEnabled(projectId, bearerToken);
    if (!enabled.ok) {
      return {
        hooked_up: false,
        mode: null,
        missing: ['manager'],
        error: enabled.error,
      };
    }

    const healthy = await this.waitForHealth('code_as_infra', projectId, bearerToken);
    if (!healthy.ok) {
      return {
        hooked_up: false,
        mode: null,
        missing: ['manager'],
        error: healthy.error,
      };
    }

    const cfg = parseConfig(project);
    let repoName = repo || 'infra';
    if (mode === 'git') {
      try {
        await SetupService.enableWithDependencies(projectId, 'git_manager', {
          with_dependencies: true,
          defaults: true,
        });
      } catch (err) {
        console.warn('[iac] enable git_manager:', err.message);
        return {
          hooked_up: false,
          mode: null,
          missing: ['git_manager'],
          error: err.message,
        };
      }
      const gitHealthy = await this.waitForHealth('git_manager', projectId, bearerToken);
      if (!gitHealthy.ok) {
        return {
          hooked_up: false,
          mode: null,
          missing: ['git_manager'],
          error: gitHealthy.error,
        };
      }
      const listed = await sm().proxyServiceRequest(
        'git_manager',
        'GET',
        '/api/v1/repos',
        null,
        { project_id: projectId },
        projectId,
        authHeader(bearerToken),
      ).catch(() => ({ status: 0, data: {} }));
      const repos = listed.data?.repositories || listed.data?.items || [];
      let found = repos.find((r) => r.name === repoName);
      if (!found) {
        const created = await sm().proxyServiceRequest(
          'git_manager',
          'POST',
          '/api/v1/repos',
          { project_id: projectId, name: repoName },
          {},
          projectId,
          authHeader(bearerToken),
        );
        found = created.data?.repository || created.data?.item;
      }
      const stack = await StackService.current(projectId);
      if (found?.id) {
        const committed = await sm().proxyServiceRequest(
          'git_manager',
          'POST',
          `/api/v1/repos/${found.id}/commit-file`,
          {
            project_id: projectId,
            path: 'stack.json',
            content: JSON.stringify(stack.stack || {}, null, 2),
            message: 'chore: hook up infrastructure as code',
          },
          {},
          projectId,
          authHeader(bearerToken),
        ).catch((err) => console.warn('[iac] commit stack.json:', err.message));
        console.log(`[iac] project=${projectId} git repo=${found.name}(${found.id}) stack.json committed=${!!committed && committed.status < 400}`);
      }
    }

    cfg.iac_hookup = {
      mode,
      repo: mode === 'git' ? repoName : null,
      hooked_up_at: new Date().toISOString(),
    };
    await ProjectRepository.update(projectId, { config: JSON.stringify(cfg) });
    console.log(`[iac] project=${projectId} hookup saved mode=${mode} repo=${mode === 'git' ? repoName : null}`);
    return this.status(projectId, bearerToken);
  }

  async backfillAll() {
    const projects = await ProjectRepository.findAll();
    for (const p of projects) {
      try {
        await this.ensureEnabled(p.id);
        const st = await this.status(p.id);
        if (st.hooked_up) continue;
        // Existing projects get the banner (not auto-conductor) once the manager is enabled.
      } catch (err) {
        console.warn(`[iac] backfill ${p.id}:`, err.message);
      }
    }
  }
}

module.exports = new IacHookupService();
