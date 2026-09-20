'use strict';

const { ProjectEnvironment, Project } = require('../models');
const { isSystemProject } = require('../config/systemProject');

const SECRET_ENV_RE = /password|secret|token|key|credential|auth|private/i;

function serialize(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    git_ref: row.git_ref || (row.name === 'prod' ? 'main' : 'develop'),
    protected: Number(row.protected) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function stripSecretEnv(env) {
  const out = {};
  for (const [k, v] of Object.entries(env && typeof env === 'object' ? env : {})) {
    if (SECRET_ENV_RE.test(k)) continue;
    if (v == null || v === '') continue;
    out[k] = v;
  }
  return out;
}

function smProxy() {
  const ServiceManager = require('./ServiceManager');
  const WorkerRepository = require('../repos/WorkerRepository');
  return ServiceManager.getInstance(WorkerRepository);
}

class EnvironmentService {
  async list(projectId) {
    if (!projectId) {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
    const rows = await ProjectEnvironment.findAll({ where: { project_id: projectId } });
    return rows.map(serialize);
  }

  /**
   * Ensure envs for a project.
   * System: prod only.
   * App with existing rows: leave what they have (no backfill).
   * App with no rows: create only opts.envName (default dev).
   */
  async ensureForProject(projectId, projectName = '', opts = {}) {
    const existing = await this.list(projectId);
    const system = isSystemProject(projectId) || String(projectName).toLowerCase() === 'system';
    if (system) {
      if (!existing.some((e) => e.name === 'prod')) {
        await ProjectEnvironment.create({
          project_id: projectId,
          name: 'prod',
          git_ref: 'main',
          protected: 1,
        });
      }
      return this.list(projectId);
    }
    if (existing.length) return existing;
    const name = String(opts.envName || opts.defaultEnvironment || 'dev').trim().toLowerCase() || 'dev';
    await this.create(projectId, {
      name,
      git_ref: name === 'prod' ? 'main' : 'develop',
    });
    return this.list(projectId);
  }

  async ensureAll() {
    const projects = await Project.findAll();
    for (const p of projects || []) {
      const system = isSystemProject(p.id) || String(p.name).toLowerCase() === 'system';
      if (system) await this.ensureForProject(p.id, p.name);
    }
  }

  async create(projectId, body = {}) {
    const name = String(body.name || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) {
      const e = new Error('name: start with a letter, then letters/numbers/hyphens');
      e.status = 400;
      throw e;
    }
    if (isSystemProject(projectId) && name !== 'prod') {
      const e = new Error('system project is prod-only');
      e.status = 400;
      throw e;
    }
    const dup = await ProjectEnvironment.findAll({ where: { project_id: projectId, name } });
    if (dup.length) {
      const e = new Error(`environment ${name} already exists`);
      e.status = 409;
      throw e;
    }
    const row = await ProjectEnvironment.create({
      project_id: projectId,
      name,
      git_ref: String(body.git_ref || (name === 'prod' ? 'main' : name === 'dev' ? 'develop' : name)).trim()
        || (name === 'prod' ? 'main' : 'develop'),
      protected: name === 'prod' ? 1 : 0,
    });
    return serialize(row);
  }

  async resolveByGitRef(projectId, ref) {
    const branch = String(ref || '').replace(/^refs\/heads\//, '');
    const list = await this.list(projectId);
    return list.find((e) => e.git_ref === branch) || null;
  }

  async duplicate(projectId, sourceName, targetName, auth = {}) {
    const source = String(sourceName || '').trim().toLowerCase();
    const target = String(targetName || '').trim().toLowerCase();
    if (!source || !target) {
      const e = new Error('source and target environment names are required');
      e.status = 400;
      throw e;
    }
    if (source === target) {
      const e = new Error('target must be a different environment');
      e.status = 400;
      throw e;
    }
    const list = await this.list(projectId);
    if (!list.some((e) => e.name === source)) {
      const e = new Error(`environment ${source} not found`);
      e.status = 404;
      throw e;
    }
    const created = await this.create(projectId, {
      name: target,
      git_ref: target === 'prod' ? 'main' : 'develop',
    });

    const sm = smProxy();
    const get = async (service, path, query = {}) => {
      try {
        const res = await sm.proxyServiceRequest(service, 'GET', path, null, query, projectId, auth);
        return res.data || {};
      } catch {
        return {};
      }
    };

    const tasks = (await get('compute_manager', '/api/v1/tasks', { environment: source })).tasks || [];
    const copied_tasks = [];
    const skipped_tasks = [];
    for (const t of tasks) {
      try {
        await sm.proxyServiceRequest(
          'compute_manager',
          'POST',
          '/api/v1/tasks',
          {
            name: t.name,
            image: t.image,
            command: t.command,
            env: stripSecretEnv(t.env),
            port_bindings: t.port_bindings,
            volumes: t.volumes,
            run_mode: t.run_mode,
            desired: t.desired,
            environment: created.name,
            network: t.network,
            database_name: t.database_name,
            pin_worker_id: t.pin_worker_id || '',
            balancer_id: t.balancer_id || '',
            resource_limits: t.resource_limits,
          },
          {},
          projectId,
          auth
        );
        copied_tasks.push({ name: t.name, image: t.image });
      } catch (err) {
        skipped_tasks.push({ name: t.name, error: err.message || String(err) });
      }
    }

    const databases = (await get('db_manager', '/api/databases', { project_id: projectId })).databases || [];
    const buckets = (await get('storage_manager', `/api/projects/${projectId}/buckets`)).buckets || [];
    const secrets = (await get('secrets_manager', '/api/v1/secrets', { environment: source })).secrets || [];
    const valuesRes = await get('secrets_manager', '/api/v1/secrets/values', { environment: source });
    const values = valuesRes.values || {};
    const copied_secrets = [];
    for (const s of secrets) {
      const value = values[s.name];
      if (value == null || value === '') continue;
      try {
        await sm.proxyServiceRequest(
          'secrets_manager',
          'POST',
          '/api/v1/secrets',
          { project_id: projectId, name: s.name, value, environment: created.name },
          {},
          projectId,
          auth
        );
        copied_secrets.push({ name: s.name });
      } catch (_) { /* already exists or encrypt failed */ }
    }

    return {
      environment: created,
      copied_tasks,
      skipped_tasks,
      copied_secrets,
      recreate: {
        databases: databases.map((d) => ({ name: d.name, type: d.type })),
        buckets: buckets.map((b) => ({ name: b.name })),
        secrets: secrets.map((s) => ({ name: s.name })),
      },
    };
  }
}

module.exports = new EnvironmentService();
module.exports.EnvironmentService = EnvironmentService;
module.exports.stripSecretEnv = stripSecretEnv;
