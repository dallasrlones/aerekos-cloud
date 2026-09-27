'use strict';

/**
 * InfraService — exports live state as infra-as-code files (task 5).
 *
 * Two tiers (see docs/iac_explained.md):
 *   - Per-project : infra.json in the project's `infra` git repo.
 *                   Captures every service enabled for the project (where it
 *                   runs + config) and every resource the P4 managers know
 *                   about for this project.
 *   - System tier : system/infra.json in the `system` project's `infra` repo.
 *                   Devices (with capabilities / disk), system resources
 *                   (system buckets, platform services) and an index of every
 *                   project's infra file.
 *
 * Device selection: an explicit device name pins an entry to that device;
 * "auto" is resolved at apply time (co-locate with owning service →
 * capability annotations → capacity).
 *
 * Every change = a new stack revision, so the file is a point-in-time
 * snapshot of the live system — copy-pasteable, commit-able, diff-able.
 */

const axios = require('axios');
const {
  Worker,
  Service,
  ProjectService: ProjectServiceModel,
  ServiceDeployment,
} = require('../models');
const ProjectRepository = require('../repos/ProjectRepository');
const WorkerRepository = require('../repos/WorkerRepository');
const ServiceManagerModule = require('./ServiceManager');
const ServiceManager = ServiceManagerModule;
const { friendlyDevice } = ServiceManagerModule;
const StackService = require('./StackService');
const { requireShared } = require('../utils/loadWorkerShared');
const { emptyStack, listClickOps, sanitizeResource } = requireShared('clickOpsCatalog');

function sm() {
  return ServiceManager.getInstance(WorkerRepository);
}

function authHeader() {
  const token = process.env.SERVICE_TOKEN || process.env.CONDUCTOR_TOKEN || '';
  if (!token) return {};
  return { authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function conductorBase() {
  const port = process.env.PORT || 3000;
  return process.env.CONDUCTOR_INTERNAL_BASE_URL?.replace(/\/+$/, '') || `http://127.0.0.1:${port}`;
}

class InfraService {
  /** Devices (workers) in the fleet, as they appear in infra files and UI. */
  async listDevices() {
    const workers = await Worker.findAll();
    return workers.map((w) => ({
      name: friendlyDevice(w) || w.hostname || w.id,
      hostname: w.hostname || null,
      ip_address: w.ip_address || null,
      status: w.status || null,
      last_seen: w.last_seen || null,
      env: w.env || null,
      capabilities: parseJson(w.capabilities, []),
      resources: parseJson(w.resources, null),
    }));
  }

  /**
   * Services enabled for a project, with the device they actually run on (if
   * any) and their project-scoped config. device is "auto" when not deployed
   * yet — the file stays valid and apply will place it.
   */
  async projectServices(projectId) {
    const [psRows, services, workers, deps] = await Promise.all([
      ProjectServiceModel.findAll({ where: { project_id: projectId, enabled: 1 } }),
      Service.findAll(),
      Worker.findAll(),
      ServiceDeployment.findAll(),
    ]);
    const svcById = new Map(services.map((s) => [s.id, s]));
    const workerById = new Map(workers.map((w) => [w.id, w]));
    const liveIds = new Set(workers.filter((w) => w.status === 'online' || w.status === 'active').map((w) => w.id));
    const out = [];
    for (const ps of psRows) {
      const svc = svcById.get(ps.service_id);
      if (!svc) continue;
      // Deployment rows may be stale (re-registered workers get new UUIDs), so
      // prefer rows that resolve to a LIVE worker, project-scoped first.
      const rows = deps.filter(
        (d) => d.service_id === ps.service_id && (d.status === 'deployed' || d.status === 'running')
      );
      const projectRows = rows.filter((d) => d.project_id === projectId);
      const match =
        projectRows.find((d) => liveIds.has(d.worker_id)) ||
        projectRows[0] ||
        rows.find((d) => liveIds.has(d.worker_id)) ||
        rows[0] ||
        null;
      const worker = match ? workerById.get(match.worker_id) : null;
      out.push({
        name: svc.name,
        device: friendlyDevice(worker) || 'auto',
        worker_id: match ? match.worker_id : null,
        config: parseJson(ps.config, {}),
      });
    }
    return out;
  }

  /**
   * Everything the P4 managers currently know about for this project, keyed by
   * stack key. Mirrors StackService.sync — live state IS the source.
   */
  async listResources(projectId) {
    const base = conductorBase();
    const headers = {
      ...authHeader(),
      'x-project-id': projectId,
      'Content-Type': 'application/json',
    };
    const out = {};
    await Promise.all(listClickOps().map(async (ops) => {
      if (!ops.provision) return;
      const path = (ops.listPath || ops.createPath || `${ops.proxyBase}/${ops.segment}`)
        .replace(/\{projectId\}/g, projectId)
        .replace(/\/apply$/, '');
      try {
        const res = await axios.get(`${base}/api/services/${ops.name}${path}`, {
          headers,
          params: { project_id: projectId },
          timeout: 15000,
          validateStatus: () => true,
        });
        if (res.status >= 400) return;
        const data = res.data || {};
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data[ops.listKey]) ? data[ops.listKey] : null;
        if (list) out[ops.stackKey] = list.map((row) => sanitizeResource(ops, row));
      } catch {
        // Manager not deployed / offline — skip; the file simply won't list it.
      }
    }));
    return out;
  }

  /** Stack (DB shape) → the infra file (copy-paste shape). */
  toInfraFile(project, cur, resources) {
    const s = cur.stack || {};
    const res = {};
    for (const ops of listClickOps()) {
      const key = ops.stackKey;
      if (Array.isArray(resources && resources[key])) res[key] = resources[key];
      else if (Array.isArray(s[key])) res[key] = s[key];
    }
    return {
      kind: 'project-infra',
      version: 1,
      project: project.name,
      project_id: s.project_id || project.id,
      revision: cur.revision,
      status: cur.status,
      generated_at: new Date().toISOString(),
      services: (s.services || []).map((x) => ({
        name: x.name,
        device: x.device || 'auto',
        worker_id: x.worker_id || null,
        config: x.config || null,
      })),
      wanted: s.wanted || [],
      resources: res,
      vpc: s.vpc || {},
    };
  }

  // ---------- git (single-writer) helpers ----------

  /** Find (or create) a project's git repo by name via git_manager. */
  async _ensureRepo(projectId, name) {
    try {
      const listed = await sm().proxyServiceRequest('git_manager', 'GET', '/api/v1/repos', null, {
        project_id: projectId,
      }, projectId, authHeader());
      if (listed.status >= 400) return { ok: false, reason: `git_manager list: HTTP ${listed.status}` };
      const repos = listed.data?.repositories || listed.data?.items || (Array.isArray(listed.data) ? listed.data : []);
      let found = repos.find((r) => r.name === name);
      if (!found) {
        const created = await sm().proxyServiceRequest('git_manager', 'POST', '/api/v1/repos', {
          project_id: projectId,
          name,
        }, {}, projectId, authHeader());
        if (created.status >= 400) {
          return { ok: false, reason: `git_manager create: HTTP ${created.status} ${JSON.stringify(created.data).slice(0, 200)}` };
        }
        found = created.data?.repository || created.data?.item || created.data;
      }
      return { ok: true, repo: found };
    } catch (e) {
      return { ok: false, reason: e.message || String(e) };
    }
  }

  async _commitFile(projectId, repo, path, content, message) {
    try {
      const res = await sm().proxyServiceRequest('git_manager', 'POST', `/api/v1/repos/${repo.id}/commit-file`, {
        project_id: projectId,
        path,
        content,
        message,
      }, {}, projectId, authHeader());
      if (res.status < 400) return { committed: true, status: res.status };
      return { committed: false, reason: `commit-file: HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 200)}` };
    } catch (e) {
      return { committed: false, reason: e.message || String(e) };
    }
  }

  async _readRepoFile(projectId, repo, path) {
    try {
      const res = await sm().proxyServiceRequest('git_manager', 'GET', `/api/v1/repos/${repo.id}/blob`, null, {
        project_id: projectId,
        path,
        ref: 'main',
      }, projectId, authHeader());
      if (res.status >= 400) return null;
      const b = res.data || {};
      const raw = typeof b.content === 'string' ? b.content : (typeof b === 'string' ? b : null);
      if (raw == null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        try {
          return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
        } catch {
          return null;
        }
      }
    } catch {
      return null;
    }
  }

  // ---------- exports ----------

  /**
   * Per-project tier: read live state, record it as a new stack revision,
   * write the infra file, and commit it to the project's `infra` git repo.
   */
  async exportProject(projectId, { commit = true } = {}) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }

    const services = await this.projectServices(projectId);
    const deviceByName = new Map(services.map((s) => [s.name, s.device]));
    const resources = await this.listResources(projectId);
    // Co-location rule: a resource's device defaults to where its owning
    // manager service runs for this project.
    for (const ops of listClickOps()) {
      if (Array.isArray(resources[ops.stackKey])) {
        const device = deviceByName.get(ops.name) || 'auto';
        resources[ops.stackKey] = resources[ops.stackKey].map((r) => ({ ...r, device }));
      }
    }

    const base = emptyStack(projectId);
    const wanted = services.map((s) => s.name);
    const content = { ...base, ...resources, services, wanted, kind: 'project-stack', project_id: projectId };

    // Skip the revision bump when the live state is unchanged.
    const cur0 = await StackService.current(projectId);
    const unchanged = cur0.revision > 0 && JSON.stringify(cur0.stack) === JSON.stringify(content);
    const cur = unchanged ? cur0 : await StackService.put(projectId, content);

    const file = this.toInfraFile(project, cur, resources);

    let repo = { committed: false, reason: 'commit skipped', repo: null };
    if (commit) {
      const found = await this._ensureRepo(projectId, 'infra');
      if (found.ok && found.repo && found.repo.id) {
        repo = {
          repo: { id: found.repo.id, name: found.repo.name },
          ...(await this._commitFile(projectId, found.repo, 'infra.json', JSON.stringify(file, null, 2),
            `infra: export ${project.name} (rev ${cur.revision})`)),
        };
      } else {
        repo = { committed: false, reason: found.reason || 'no infra repo', repo: null };
      }
    }
    return { file, revision: cur.revision, unchanged, repo };
  }

  /** System buckets across all storage systems, stamped with their device. */
  async listAllSystemBuckets(storageDevice, projectId) {
    const base = conductorBase();
    const headers = {
      ...authHeader(),
      'Content-Type': 'application/json',
      ...(projectId ? { 'x-project-id': projectId } : {}),
    };
    let systems = [];
    try {
      const res = await axios.get(`${base}/api/services/storage_manager/api/systems`, {
        headers,
        timeout: 10000,
        validateStatus: () => true,
      });
      if (res.status < 400) systems = res.data?.systems || [];
    } catch {
      // storage offline — system file simply has no buckets section.
    }
    const out = [];
    for (const sys of systems) {
      const id = sys.id || sys.name;
      if (!id) continue;
      try {
        const res = await axios.get(
          `${base}/api/services/storage_manager/api/systems/${encodeURIComponent(id)}/buckets`,
          { headers, timeout: 10000, validateStatus: () => true }
        );
        if (res.status >= 400) continue;
        for (const b of res.data?.buckets || []) {
          out.push({
            system: id,
            name: b.name,
            base_path: b.base_path || null,
            device: storageDevice || 'auto',
          });
        }
      } catch {
        // skip
      }
    }
    return out;
  }

  /**
   * System tier: devices + system resources + index of every project's infra
   * file, committed to the `system` project's `infra` repo at system/infra.json.
   */
  async exportSystem() {
    const projects = await ProjectRepository.findAll();
    const systemProject = projects.find((p) => p.name === 'system');
    if (!systemProject) {
      const e = new Error('System project not found (create a project named "system")');
      e.status = 404;
      throw e;
    }

    const [devices, services, workers, deps] = await Promise.all([
      this.listDevices(),
      Service.findAll(),
      Worker.findAll(),
      ServiceDeployment.findAll(),
    ]);
    const svcById = new Map(services.map((s) => [s.id, s]));
    const workerById = new Map(workers.map((w) => [w.id, w]));

    // Platform services: shared (non-project-scoped) deployments — the
    // always-on layer (git_manager, worker_manager, ...).
    const platform = [];
    const seen = new Set();
    for (const d of deps) {
      if (d.project_id) continue;
      if (d.status !== 'deployed' && d.status !== 'running') continue;
      const svc = svcById.get(d.service_id);
      if (!svc || seen.has(svc.name)) continue;
      seen.add(svc.name);
      platform.push({ name: svc.name, device: friendlyDevice(workerById.get(d.worker_id)) || 'auto' });
    }

    const storageDevice = platform.find((p) => p.name === 'storage_manager')?.device || 'auto';
    const buckets = await this.listAllSystemBuckets(storageDevice === 'auto' ? null : storageDevice, systemProject.id);

    // Index of every project. Details live in each project's own infra.json
    // (its `infra` git repo) — this file only carries a summary, so the
    // system file stays small and doesn't duplicate the estate.
    const index = [];
    for (const p of projects) {
      let file = null;
      const found = await this._ensureRepo(p.id, 'infra');
      if (found.ok && found.repo && found.repo.id) {
        file = await this._readRepoFile(p.id, found.repo, 'infra.json');
      }
      if (!file) {
        const cur = await StackService.current(p.id);
        if (cur.revision > 0) file = this.toInfraFile(p, cur, null);
      }
      index.push({
        name: p.name,
        infra: `${p.name}/infra.json`,
        revision: file ? file.revision : 0,
        generated_at: file ? file.generated_at : null,
        services: file ? file.services.map((s) => ({ name: s.name, device: s.device })) : [],
      });
    }

    const file = {
      kind: 'system-infra',
      version: 1,
      generated_at: new Date().toISOString(),
      devices,
      system_resources: { buckets, services: platform },
      projects: index,
    };

    let repoInfo = { committed: false, reason: 'commit skipped', repo: null };
    const found = await this._ensureRepo(systemProject.id, 'infra');
    if (found.ok && found.repo && found.repo.id) {
      repoInfo = {
        repo: { id: found.repo.id, name: found.repo.name },
        ...(await this._commitFile(systemProject.id, found.repo, 'system/infra.json',
          JSON.stringify(file, null, 2), 'infra: export system tier')),
      };
    } else {
      repoInfo = { committed: false, reason: found.reason || 'no infra repo', repo: null };
    }
    return { file, repo: repoInfo };
  }
}

module.exports = new InfraService();
module.exports.InfraService = InfraService;