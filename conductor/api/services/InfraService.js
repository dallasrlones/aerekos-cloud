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
  ProjectStack,
} = require('../models');
const ProjectRepository = require('../repos/ProjectRepository');
const WorkerRepository = require('../repos/WorkerRepository');
const ServiceManagerModule = require('./ServiceManager');
const ServiceManager = ServiceManagerModule;
const { friendlyDevice } = ServiceManagerModule;
const StackService = require('./StackService');
const { requireShared } = require('../utils/loadWorkerShared');
const { emptyStack, listClickOps, sanitizeResource, collectionPath, itemPath } = requireShared('clickOpsCatalog');

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
      // Worker UUID — the pin apply passes to ServiceManager so a
      // deployment lands on exactly this device.
      id: w.id,
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

  /**
   * Single-writer refresh: after any service-level change (enable / disable
   * via the UI, CLI or SDK), re-record the project's services + wanted into
   * the stack and let put() commit infra.json. Unapplied device pins in the
   * file for services OTHER than the one that changed are preserved, so one
   * explicit change never stomps the user's intent for the rest. Put's
   * no-op guard keeps the revision history clean when nothing changed.
   */
  async recordServiceChange(projectId, { changed = null, record = true } = {}) {
    if (!record) return null;
    const cur = await StackService.current(projectId);
    if (!cur || cur.revision === 0) return null; // not hooked up yet — first export picks it up
    const live = await this.projectServices(projectId);
    const fileByName = new Map();
    for (const s of (cur.stack && cur.stack.services) || []) {
      if (s && s.name) fileByName.set(s.name, s);
    }
    const liveByName = new Map(live.map((s) => [s.name, s]));
    const merged = [];
    for (const ls of live) {
      const fs = fileByName.get(ls.name);
      const unappliedPin = fs && fs.device && fs.device !== 'auto' && fs.device !== ls.device;
      merged.push({
        name: ls.name,
        // An explicit change on this service wins over a stale file pin.
        device: (unappliedPin && ls.name !== changed) ? fs.device : ls.device,
        worker_id: ls.worker_id || null,
        config: ls.config || null,
      });
    }
    for (const [name, fs] of fileByName) {
      if (!liveByName.has(name) && name !== changed) {
        merged.push({ name, device: fs.device || 'auto', worker_id: fs.worker_id || null, config: fs.config || null });
      }
    }
    const content = {
      ...cur.stack,
      services: merged,
      wanted: merged.map((s) => s.name),
      kind: 'project-stack',
      project_id: projectId,
    };
    const out = await StackService.put(projectId, content);
    if (out && out.revision) {
      console.log(`[infra] project=${projectId} service-change → rev ${out.revision} ${changed ? '(change: ' + changed + ')' : '(bake-back)'} services=${merged.length}`);
    }
    return out;
  }

  /**
   * Read endpoint for the Infra tab: the current infra file (from the stack
   * record), the fleet (with disk figures for the UI) and the hookup state.
   */
  async currentInfra(projectId) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }
    const cur = await StackService.current(projectId);
    const file = cur.revision > 0 ? this.toInfraFile(project, cur, {}) : null;
    // Best-effort live placement so the UI can show "running on X" vs "pending".
    const liveByName = new Map();
    try {
      for (const s of await this.projectServices(projectId)) liveByName.set(s.name, s.device);
    } catch {}
    if (file) {
      for (const s of file.services) {
        s.live_device = liveByName.has(s.name) ? liveByName.get(s.name) : null;
      }
    }
    const [devices, hookup] = await Promise.all([
      this.listDevices(),
      (async () => {
        try {
          const IacHookupService = require('./IacHookupService');
          return await IacHookupService.status(projectId);
        } catch {
          return { hooked_up: false, mode: null, repo: null, missing: ['status'] };
        }
      })(),
    ]);
    const devicesOut = devices.map((d) => ({
      ...d,
      disk_free_gb: (d.resources && d.resources.disk && d.resources.disk.available_gb != null) ? d.resources.disk.available_gb : null,
      disk_total_gb: (d.resources && d.resources.disk && d.resources.disk.total_gb != null) ? d.resources.disk.total_gb : null,
    }));
    return {
      file,
      devices: devicesOut,
      hookup,
      revision: cur.revision,
      status: cur.status,
      generated_at: file ? file.generated_at : null,
    };
  }

  /**
   * Write an (edited) infra file back into the stack — the single-writer
   * path for "Edit file" in the UI and PUT /infra. The file's
   * services / wanted / resources / vpc become the new stack content;
   * put() no-ops when nothing changed and commits infra.json otherwise.
   */
  async updateFromFile(projectId, file) {
    console.log(`[infra] project=${projectId} updateFromFile keys=${Object.keys(file || {}).join(',')}`);
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }
    if (!file || typeof file !== 'object' || Array.isArray(file) || !Object.keys(file).length) {
      const e = new Error('file is required (an infra file object)');
      e.status = 400;
      throw e;
    }
    if (file.kind === 'system-infra') {
      const e = new Error('cannot save a system-tier file to a project');
      e.status = 400;
      throw e;
    }
    const cur = await StackService.current(projectId);
    const services = (Array.isArray(file.services) ? file.services : [])
      .filter((x) => x && x.name)
      .map((x) => ({
        name: String(x.name),
        device: x.device || 'auto',
        worker_id: x.worker_id || null,
        config: x.config || null,
      }));
    const content = {
      ...(cur.stack || {}),
      kind: 'project-stack',
      project_id: projectId,
      services,
      // wanted defaults to the file's service list when not given.
      wanted: (Array.isArray(file.wanted) && file.wanted.length)
        ? file.wanted.map(String)
        : services.map((s) => s.name),
      vpc: (file.vpc && typeof file.vpc === 'object' && !Array.isArray(file.vpc))
        ? file.vpc
        : ((cur.stack && cur.stack.vpc) || {}),
    };
    for (const ops of listClickOps()) {
      if (Array.isArray(file.resources && file.resources[ops.stackKey])) {
        content[ops.stackKey] = file.resources[ops.stackKey];
      } else {
        delete content[ops.stackKey]; // file is the source: absent section = no resources
      }
    }
    const out = await StackService.put(projectId, content, { commit: false });
    const infraFile = this.toInfraFile(project, out, {});
    const changed = out.revision !== cur.revision;
    // Single writer (git): mirror the new stack into the project's infra
    // repo — same pattern as export, so the file in git always matches the
    // stack record. A no-op save (no new revision) does not commit, so
    // re-saving an unchanged file doesn't stack identical-content commits.
    let repo = { committed: false, reason: changed ? 'commit skipped' : 'no change', repo: null };
    if (changed) {
      const found = await this._ensureRepo(projectId, 'infra');
      if (found.ok && found.repo && found.repo.id) {
        repo = {
          repo: { id: found.repo.id, name: found.repo.name },
          ...(await this._commitFile(projectId, found.repo, 'infra.json', JSON.stringify(infraFile, null, 2),
            `infra: save ${project.name} (rev ${out.revision})`)),
        };
      } else {
        repo = { committed: false, reason: found.reason || 'no infra repo', repo: null };
      }
    }
    console.log(`[infra] project=${projectId} updateFromFile done rev=${out.revision} changed=${changed} commit=${repo.committed ? (repo.commit || 'yes') : 'no (' + repo.reason + ')'}`);
    return { file: infraFile, revision: out.revision, changed, repo };
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
    console.log(`[infra] project=${projectId} exportProject commit=${commit}`);
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
    console.log(`[infra] project=${projectId} export done rev=${cur.revision} unchanged=${unchanged} commit=${repo.committed ? (repo.commit || 'yes') : 'no (' + repo.reason + ')'}`);
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

  // ---------- apply / down / import (device-aware up + down) ----------

  /**
   * Pick a worker for a service: a pinned device name wins; "auto" resolves
   * to the online worker with the most free disk (fallback: any online,
   * then any worker).
   */
  _pickDevice(devices, pinned, anyDevice) {
    const norm = (v) => String(v || '').toLowerCase();
    const online = devices.filter((d) => d.status === 'online');
    if (pinned && pinned !== 'auto') {
      const found =
        online.find((d) => norm(d.name) === norm(pinned) || norm(d.hostname) === norm(pinned)) ||
        devices.find((d) => norm(d.name) === norm(pinned) || norm(d.hostname) === norm(pinned));
      if (found) return found;
      if (!anyDevice) {
        const e = new Error(`pinned device "${pinned}" not found (online: ${online.map((d) => d.name).join(', ') || 'none'})`);
        e.status = 409;
        throw e;
      }
    }
    const pool = online.length ? online : devices;
    if (!pool.length) {
      const e = new Error('no workers in the fleet');
      e.status = 409;
      throw e;
    }
    const avail = (d) => (d.resources && d.resources.disk && d.resources.disk.available_gb != null)
      ? d.resources.disk.available_gb : -1;
    const withDisk = pool.filter((d) => avail(d) >= 0);
    return (withDisk.length ? withDisk : pool).slice().sort((a, b) => avail(b) - avail(a))[0];
  }

  /**
   * Single writer (git): write the stack as infra.json into the project's
   * `infra` git repo. No-op when the project isn't hooked up.
   */
  async commitInfraFile(projectId, { stack, revision, status } = {}) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) return { committed: false, reason: 'project not found', repo: null };
    const found = await this._ensureRepo(projectId, 'infra');
    if (!found.ok || !found.repo || !found.repo.id) {
      return { committed: false, reason: found.reason || 'no infra repo', repo: null };
    }
    const file = this.toInfraFile(project, { stack, revision: revision || 0, status: status || 'draft' });
    const c = await this._commitFile(projectId, found.repo, 'infra.json', JSON.stringify(file, null, 2),
      `infra: sync ${project.name} (rev ${revision || 0})`);
    console.log(`[infra] project=${projectId} commitInfraFile repo=${found.repo.name} rev=${revision || 0} status=${status || 'draft'} committed=${c.committed ? (c.commit || 'yes') : 'no (' + (c.reason || c.error || '') + ')'}`);
    return { repo: { id: found.repo.id, name: found.repo.name }, ...c };
  }

  /**
   * Device-aware apply: bring the project's live infra in line with an infra
   * file (or its current stack when no file is given):
   *   - enable each wanted service on its pinned device
   *     ("auto" → online worker with the most free disk)
   *   - bake the resolved devices back into a new stack revision
   *   - provision the file's resources (idempotent POSTs to the P4 managers)
   *   - commit infra.json to the project's infra repo
   */
  async applyProject(projectId, { file = null, anyDevice = false } = {}) {
    const PROD = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
    if (projectId === PROD) {
      const e = new Error('never apply to the production project');
      e.status = 403;
      throw e;
    }
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }

    const cur = await StackService.current(projectId);
    const base = emptyStack(projectId);
    const src = file && typeof file === 'object' ? file : cur.stack;
    if (src.kind === 'system-infra') {
      const e = new Error('cannot apply a system-tier file to a project');
      e.status = 400;
      throw e;
    }
    const content = { ...base, ...src, kind: 'project-stack', project_id: projectId };
    if (!Array.isArray(content.services)) content.services = [];

    const devices = await this.listDevices();
    const SetupService = require('./SetupService');
    const names = new Set([
      ...(Array.isArray(content.wanted) ? content.wanted : []),
      ...content.services.map((s) => s && s.name).filter(Boolean),
    ]);
    const plan = [...names].filter((n) => n && n !== 'auth_manager' && n !== 'vllm')
      .map((name) => ({
        name,
        device: ((content.services.find((s) => s && s.name === name) || {}).device) || 'auto',
      }));
    console.log(`[infra] project=${projectId} applyProject file=${!!file} anyDevice=${anyDevice} plan=${plan.length}: ${plan.map((p) => p.name + '@' + p.device).join(', ')}`);

    const results = [];
    for (const p of plan) {
      let device = null;
      let error = null;
      try {
        const pick = this._pickDevice(devices, p.device, anyDevice);
        device = pick.name;
        // record:false — the bake-back below is the single write for the
        // whole apply, so N services don't create N noisy revisions.
        const row = await SetupService.enableWithDependencies(
          projectId, p.name, { with_dependencies: true, defaults: true, workerId: pick.id, record: false });
        const bad = (row.results || []).filter((r) => !r.enabled);
        if (bad.length) error = bad.map((b) => `${b.service}: ${b.error || 'failed'}`).join('; ');
      } catch (e) {
        error = e.message || String(e);
      }
      results.push({ name: p.name, requested: p.device, device, status: error ? 'error' : 'ok', error });
    }

    // Bake the live placements back into the file (it stays the truth).
    const live = await this.projectServices(projectId);
    const liveByName = new Map(live.map((s) => [s.name, s.device]));
    content.services = plan.map((p) => {
      const prev = content.services.find((s) => s && s.name === p.name) || {};
      return { ...prev, name: p.name, device: liveByName.get(p.name) || p.device || 'auto' };
    });
    content.wanted = plan.map((p) => p.name);
    for (const ops of listClickOps()) {
      if (!Array.isArray(content[ops.stackKey]) || !content[ops.stackKey].length) continue;
      const dev = liveByName.get(ops.name);
      if (!dev) continue;
      content[ops.stackKey] = content[ops.stackKey].map((r) => (r && r.system) ? r : { ...r, device: dev });
    }

    await StackService.put(projectId, content, { commit: false });
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    if (rows[0]) {
      await ProjectStack.update(rows[0].id, { status: 'applied', applied: rows[0].content, lock_holder: '' });
    }

    console.log(`[infra] project=${projectId} apply results: ${results.map((r) => r.name + '=' + r.status + (r.device ? '@' + r.device : '') + (r.error ? ' (' + r.error + ')' : '')).join(', ')}`);
    const provisioned = await StackService.provision(projectId, content);
    const final = await StackService.current(projectId);
    const repo = await this.commitInfraFile(projectId, { stack: final.stack, revision: final.revision, status: final.status });
    console.log(`[infra] project=${projectId} apply done rev=${final.revision} commit=${repo.committed ? (repo.commit || 'yes') : 'no (' + repo.reason + ')'} provisioned=${provisioned ? Object.values(provisioned).flat().length : 0}`);
    return { project: project.name, services: results, provisioned, repo, revision: final.revision };
  }

  /**
   * Bring the project's infra down.
   *   soft: detach the services from the project (shared instances keep
   *         running); resources stay. The stack keeps wanted/services so a
   *         later apply re-enables everything.
   *   hard: same, plus DELETE every resource the stack knows about.
   */
  async downProject(projectId, { hard = false } = {}) {
    const project = await ProjectRepository.findById(projectId);
    if (!project) {
      const e = new Error('Project not found');
      e.status = 404;
      throw e;
    }
    const cur = await StackService.current(projectId);
    const names = [...new Set([
      ...(Array.isArray(cur.stack.services) ? cur.stack.services.map((s) => s && s.name) : []),
      ...(Array.isArray(cur.stack.wanted) ? cur.stack.wanted : []),
    ])].filter((n) => n && n !== 'auth_manager' && n !== 'vllm');
    console.log(`[infra] project=${projectId} downProject hard=${hard} services=${names.length}: ${names.join(', ')}`);

    const disabled = [];
    for (const name of names) {
      try {
        const r = await sm().disableService(name, projectId);
        disabled.push({ name, status: r && r.disabled === false && r.platform ? 'platform' : 'detached' });
      } catch (e) {
        disabled.push({ name, status: 'error', error: e.message || String(e) });
      }
    }

    let deleted = {};
    if (hard) {
      for (const ops of listClickOps()) {
        if (!ops.allowDelete) continue;
        const items = Array.isArray(cur.stack[ops.stackKey]) ? cur.stack[ops.stackKey] : [];
        const rows = [];
        for (const item of items) {
          const id = item && item[ops.idField || 'id'];
          if (!id) continue;
          try {
            const res = await sm().proxyServiceRequest(
              ops.name, 'DELETE', `${itemPath(ops, projectId, id)}`, null, {}, projectId, authHeader());
            rows.push({ name: item.name || String(id), status: res.status, ok: res.status < 400 });
          } catch (e) {
            rows.push({ name: item.name || String(id), error: e.message || String(e), ok: false });
          }
        }
        if (rows.length) deleted[ops.stackKey] = rows;
      }
    }

    const next = hard
      ? { ...emptyStack(projectId), kind: 'project-stack', project_id: projectId }
      : { ...cur.stack, kind: 'project-stack', project_id: projectId };
    // commit: hard — a hard down rewrites the file to its empty state, so the
    // single writer must commit it. Soft leaves the content unchanged (no-op
    // put, no new revision, nothing to commit).
    await StackService.put(projectId, next, { commit: hard });
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    if (rows[0]) {
      await ProjectStack.update(rows[0].id, { status: 'downed', applied: rows[0].content, lock_holder: '' });
    }

    const final = await StackService.current(projectId);
    const repo = await this.commitInfraFile(projectId, { stack: final.stack, revision: final.revision, status: final.status });
    console.log(`[infra] project=${projectId} down done hard=${hard} disabled=${disabled.map((d) => d.name + '=' + d.status + (d.error ? ' (' + d.error + ')' : '')).join(', ')} commit=${repo.committed ? (repo.commit || 'yes') : 'no (' + repo.reason + ')'} rev=${final.revision}`);
    return { hard, disabled, deleted, repo, revision: final.revision };
  }

  /**
   * Import an infra file as a brand-new project: create the project, hook up
   * its infra repo (git mode), then apply the file to it.
   */
  async importProject({ name, description = '', file = null, anyDevice = false } = {}, bearerToken = null) {
    if (!name || typeof name !== 'string') {
      const e = new Error('name is required');
      e.status = 400;
      throw e;
    }
    if (!file || typeof file !== 'object' || Array.isArray(file)) {
      const e = new Error('file is required (an infra file object)');
      e.status = 400;
      throw e;
    }
    const existing = await ProjectRepository.findAll();
    if (existing.some((pr) => pr.name === name)) {
      const e = new Error(`project "${name}" already exists`);
      e.status = 409;
      throw e;
    }

    const project = await ProjectRepository.create({ name, description: description || '', config: '{}' });
    const IacHookupService = require('./IacHookupService');
    const hookup = await IacHookupService.hookup(project.id, { mode: 'git' }, bearerToken);
    if (!hookup.hooked_up) {
      const e = new Error(`IAC hookup failed: ${hookup.error || JSON.stringify(hookup.missing || {})}`);
      e.status = 503;
      e.project = { id: project.id, name: project.name };
      throw e;
    }
    const result = await this.applyProject(project.id, { file, anyDevice });
    // applyProject reports project as a bare name string; return the full
    // object so callers can use project.id / project.name.
    return {
      project: { id: project.id, name: project.name },
      hookup,
      services: result.services,
      provisioned: result.provisioned,
      repo: result.repo,
      revision: result.revision,
    };
  }
}

module.exports = new InfraService();
module.exports.InfraService = InfraService;