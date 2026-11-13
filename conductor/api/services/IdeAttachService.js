'use strict';

const ServiceManager = require('./ServiceManager');
const StackService = require('./StackService');

function sm() {
  const WorkerRepository = require('../repos/WorkerRepository');
  return ServiceManager.getInstance(WorkerRepository);
}

function err(message, status, code) {
  const e = new Error(message);
  e.status = status || 500;
  if (code) e.code = code;
  return e;
}

function fnNameFromPath(filePath) {
  const base = String(filePath || 'handler').split('/').pop() || 'handler';
  const stem = base.replace(/\.[^.]+$/, '');
  return stem.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'handler';
}

function routeNameFromPath(filePath) {
  const parts = String(filePath || '/api/handler').split('/').filter(Boolean);
  const tail = parts.slice(-2).join('-') || 'handler';
  return `ide-${tail}`.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48);
}

function publicPathFromFile(filePath) {
  const stem = fnNameFromPath(filePath);
  return `/ide/${stem}`;
}

function languageRuntime(path) {
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(path)) return 'node20';
  if (/\.py$/i.test(path)) return 'python3';
  return 'node20';
}

function handlerForPath(path) {
  if (/\.py$/i.test(path)) return 'main.handler';
  const base = String(path || '').split('/').pop() || 'index.js';
  const mod = base.replace(/\.[^.]+$/, '');
  return `${mod.replace(/\.js$/, '')}.handler`;
}

class IdeAttachService {
  /**
   * @param {{ proxy?: Function }} [deps]
   */
  constructor(deps = {}) {
    this._proxy = deps.proxy || null;
  }

  async proxy(service, method, path, body, query, projectId) {
    if (this._proxy) return this._proxy(service, method, path, body, query, projectId);
    return sm().proxyServiceRequest(service, method, path, body, query || {}, projectId);
  }

  buildAsk(kind, speakText, plan) {
    return {
      ask: true,
      kind,
      speak_text: speakText,
      plan,
    };
  }

  async attachAsFunction({
    projectId,
    repoId,
    ref,
    path,
    name,
    confirm,
    preview,
    token,
  }) {
    if (!projectId) throw err('project_id is required', 400);
    if (!repoId) throw err('repo_id is required', 400);
    if (!path) throw err('path is required', 400);
    if (!token) throw err('Authentication required', 401);

    const fnName = String(name || fnNameFromPath(path)).trim();
    const plan = {
      action: 'attach_function',
      function: {
        name: fnName,
        runtime: languageRuntime(path),
        handler: handlerForPath(path),
        source: { repo_id: repoId, ref: ref || 'main', path },
      },
      stack: { service: 'function_manager', key: 'functions', name: fnName },
    };

    if (preview === true || confirm !== true) {
      return this.buildAsk(
        'attach_function',
        `Attach ${path} as function "${fnName}"?`,
        plan,
      );
    }

    const blob = await this.proxy(
      'git_manager',
      'GET',
      `/api/v1/repos/${repoId}/blob`,
      null,
      { project_id: projectId, path, ref: ref || 'main' },
      projectId,
    );
    if (blob.status >= 400) {
      throw err(blob.data?.error?.message || 'could not read source file', blob.status || 400);
    }

    const created = await this.proxy(
      'function_manager',
      'POST',
      '/api/v1/functions',
      {
        project_id: projectId,
        name: fnName,
        runtime: plan.function.runtime,
        handler: plan.function.handler,
        trigger: { queue: false },
        env: {
          IDE_SOURCE_PATH: path,
          IDE_SOURCE_REPO: String(repoId),
          IDE_SOURCE_REF: ref || 'main',
        },
      },
      {},
      projectId,
    );
    if (created.status >= 400) {
      throw err(created.data?.error?.message || 'function create failed', created.status || 500);
    }

    const resource = created.data?.function || created.data?.item || created.data;
    const stackResource = {
      ...(resource && typeof resource === 'object' ? resource : {}),
      name: fnName,
      runtime: plan.function.runtime,
      handler: plan.function.handler,
      ide_source: plan.function.source,
    };

    const stack = await StackService.record(projectId, {
      service: 'function_manager',
      key: 'functions',
      resource: stackResource,
    });

    return {
      attached: true,
      function: stackResource,
      stack_revision: stack.revision,
      stack_status: stack.status,
    };
  }

  async exposeViaApi({
    projectId,
    repoId,
    ref,
    path,
    method,
    publicPath,
    functionName,
    confirm,
    preview,
    token,
  }) {
    if (!projectId) throw err('project_id is required', 400);
    if (!path) throw err('path is required', 400);
    if (!token) throw err('Authentication required', 401);

    const verb = String(method || 'GET').toUpperCase();
    const routeName = routeNameFromPath(path);
    const pub = String(publicPath || publicPathFromFile(path)).trim();
    const fn = String(functionName || fnNameFromPath(path)).trim();
    const backend = `function_manager:/api/v1/functions/${encodeURIComponent(fn)}/invoke`;

    const plan = {
      action: 'expose_api',
      route: {
        name: routeName,
        method: verb,
        public_path: pub,
        backend_url: backend,
        target_service: 'function_manager',
        target_path: `/api/v1/functions/${fn}/invoke`,
      },
      stack: { service: 'api_manager', key: 'routes', name: routeName },
      source: { repo_id: repoId, ref: ref || 'main', path },
    };

    if (preview === true || confirm !== true) {
      return this.buildAsk(
        'expose_api',
        `Expose ${path} at ${verb} ${pub}?`,
        plan,
      );
    }

    const created = await this.proxy(
      'api_manager',
      'POST',
      '/api/v1/endpoints',
      {
        project_id: projectId,
        name: routeName,
        method: verb,
        public_path: pub,
        backend_url: backend,
        target_service: 'function_manager',
        target_path: `/api/v1/functions/${fn}/invoke`,
        enabled: 1,
        desired: 1,
      },
      {},
      projectId,
    );
    if (created.status >= 400) {
      throw err(created.data?.error?.message || 'endpoint create failed', created.status || 500);
    }

    const resource = created.data?.item || created.data;
    const stackResource = {
      ...(resource && typeof resource === 'object' ? resource : {}),
      name: routeName,
      method: verb,
      public_path: pub,
      ide_source: plan.source,
    };

    const stack = await StackService.record(projectId, {
      service: 'api_manager',
      key: 'routes',
      resource: stackResource,
    });

    return {
      exposed: true,
      route: stackResource,
      stack_revision: stack.revision,
      stack_status: stack.status,
    };
  }
}

module.exports = { IdeAttachService, fnNameFromPath, publicPathFromFile };
