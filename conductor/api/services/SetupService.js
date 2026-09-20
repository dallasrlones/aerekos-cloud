'use strict';

const axios = require('axios');
const { requireShared } = require('../utils/loadWorkerShared');
const { Service, ProjectService: ProjectServiceModel, ServiceDeployment } = require('../models');

const { getSetupMeta, buildDependencyGraph, CORE_STACK, listSetupServices, getPack, listPacks, requiredDepsInOrder, PACKS } = requireShared('setupCatalog');
const { getClickOps, listClickOpsForService } = requireShared('clickOpsCatalog');

async function isServiceEnabledForProject(projectId, serviceName) {
  const { isPlatformDeviceService } = require('../config/platformDeviceServices');
  const rows = await Service.findAll({ where: { name: serviceName } });
  if (!rows.length) return { exists: false, enabled: false, serviceId: null };
  const serviceId = rows[0].id;
  if (isPlatformDeviceService(serviceName)) {
    return { exists: true, enabled: true, serviceId, globalEnabled: true, platform: true };
  }
  const ps = await ProjectServiceModel.findAll({
    where: { project_id: projectId, service_id: serviceId },
  });
  const enabled = ps.length > 0 && ps[0].enabled === 1;
  return { exists: true, enabled, serviceId, globalEnabled: rows[0].enabled === 1 };
}

async function hasDeployment(projectId, serviceName) {
  const rows = await Service.findAll({ where: { name: serviceName } });
  if (!rows.length) return false;
  const deps = await ServiceDeployment.findAll({
    where: { project_id: projectId, service_id: rows[0].id, status: 'deployed' },
  });
  return deps.length > 0;
}

async function listProjectSecretNames(projectId, bearerToken) {
  if (!projectId || !bearerToken) return new Set();
  const port = process.env.PORT || 3000;
  const base = process.env.CONDUCTOR_INTERNAL_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;
  const auth = bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
  try {
    const res = await axios.get(`${base}/api/services/secrets_manager/api/v1/secrets`, {
      params: { project_id: projectId },
      headers: { Authorization: auth },
      timeout: 10000,
      validateStatus: (s) => s < 500,
    });
    if (res.status !== 200 || !Array.isArray(res.data?.secrets)) return new Set();
    return new Set(res.data.secrets.map((s) => s.name));
  } catch (_) {
    return new Set();
  }
}

function healthProbeBases(serviceName) {
  const portMap = require('../config/managerServicePorts');
  const ports = portMap[serviceName];
  if (!ports) return [];
  const port = Object.values(ports)[0];
  const bases = [];
  try {
    const map = JSON.parse(process.env.SERVICE_DIRECT_HOSTS || '{}');
    if (map[serviceName]) bases.push(String(map[serviceName]).replace(/\/$/, ''));
  } catch (_) { /* ignore malformed map */ }
  bases.push(
    `http://${serviceName}:${port}`,
    `http://aerekos-${serviceName}:${port}`,
    `http://localhost:${port}`,
    `http://host.docker.internal:${port}`,
  );
  return bases;
}

async function probeHealth(serviceName) {
  const bases = healthProbeBases(serviceName);
  if (!bases.length) return { ok: false, error: 'no port map' };
  for (const base of bases) {
    try {
      const res = await axios.get(`${base}/health`, { timeout: 3000, validateStatus: () => true });
      if (res.status === 200 && res.data?.status === 'healthy') {
        return { ok: true, latency_ms: null, via: base };
      }
    } catch (_) { /* try next */ }
  }
  return { ok: false, error: 'unreachable' };
}

function depStatus(enabled, healthOk, deferred) {
  if (deferred) return 'deferred';
  if (!enabled) return 'missing';
  if (!healthOk) return 'misconfigured';
  return 'connected';
}

class SetupService {
  getGraph() {
    return buildDependencyGraph();
  }

  getCoreStack() {
    return CORE_STACK;
  }

  async probeHealth(serviceName) {
    return probeHealth(serviceName);
  }

  async getServiceSetup(serviceName, projectId, bearerToken = null) {
    const meta = getSetupMeta(serviceName);
    const self = projectId ? await isServiceEnabledForProject(projectId, serviceName) : { enabled: false };
    const deployed = projectId ? await hasDeployment(projectId, serviceName) : false;
    const health = self.enabled ? await probeHealth(serviceName) : { ok: false };

    const dependencies = [];
    for (const dep of meta.dependencies || []) {
      const depMeta = getSetupMeta(dep.service);
      const st = projectId
        ? await isServiceEnabledForProject(projectId, dep.service)
        : { enabled: false };
      const h = st.enabled ? await probeHealth(dep.service) : { ok: false };
      const deferred = !!(depMeta.deferredKeys && depMeta.deferredKeys.length);
      dependencies.push({
        service: dep.service,
        required: !!dep.required,
        reason: dep.reason || '',
        status: depStatus(st.enabled, h.ok, deferred),
        enabled: st.enabled,
        health: h.ok,
        message: deferred ? 'Deferred until provider keys configured' : (st.enabled ? (h.ok ? 'Healthy' : 'Enabled but unhealthy') : 'Not enabled for project'),
        fixRoute: dep.service,
      });
    }

    const secretNames = projectId ? await listProjectSecretNames(projectId, bearerToken) : new Set();
    const secrets = (meta.secrets || []).map((s) => {
      const present = secretNames.has(s.name);
      let status = 'optional';
      let message = 'Optional';
      if (s.required) {
        status = present ? 'connected' : 'missing';
        message = present ? 'Stored in secrets_manager' : 'Create in Secrets Manager';
      } else if (present) {
        status = 'connected';
        message = 'Stored';
      }
      return {
        name: s.name,
        required: !!s.required,
        desc: s.desc || '',
        status,
        message,
        present,
      };
    });

    const steps = meta.wizardSteps || ['overview', 'enable'];
    let completed = 0;
    if (self.enabled) completed += 1;
    if (dependencies.filter((d) => d.required).every((d) => d.status === 'connected' || d.status === 'deferred')) {
      completed += 1;
    }
    if (deployed || health.ok) completed += 1;
    const total = Math.max(steps.length, 3);
    const percent = Math.min(100, Math.round((completed / total) * 100));

    return {
      service: serviceName,
      project_id: projectId || null,
      summary: meta.summary,
      docPath: meta.docPath,
      wizardSteps: steps,
      progress: { completed, total, percent },
      dependencies,
      secrets,
      enabled: self.enabled,
      deployed,
      health: health.ok,
      wizardComplete: self.enabled && health.ok && dependencies.filter((d) => d.required).every((d) => d.status === 'connected' || d.status === 'deferred'),
      firstResource: meta.firstResource || null,
      clickOps: getClickOps(serviceName),
      clickOpsAll: listClickOpsForService(serviceName),
      workerHints: meta.workerHints || [],
      deferredKeys: meta.deferredKeys,
    };
  }

  async getProjectSetupSummary(projectId, bearerToken = null) {
    const services = listSetupServices();
    const items = await Promise.all(
      services.map(async (name) => {
        const setup = await this.getServiceSetup(name, projectId, bearerToken);
        return {
          service: name,
          percent: setup.progress.percent,
          enabled: setup.enabled,
          wizardComplete: setup.wizardComplete,
        };
      }),
    );
    const core = await Promise.all(
      CORE_STACK.map((name) => this.getServiceSetup(name, projectId, bearerToken)),
    );
    const coreComplete = core.filter((c) => c.wizardComplete).length;
    const overall = items.length
      ? Math.round(items.reduce((s, i) => s + i.percent, 0) / items.length)
      : 0;
    return {
      project_id: projectId,
      overall_percent: overall,
      core_stack: {
        services: CORE_STACK,
        complete: coreComplete,
        total: CORE_STACK.length,
        percent: Math.round((coreComplete / CORE_STACK.length) * 100),
      },
      services: items,
      packs: listPacks(),
      next_steps: await this.nextSteps(projectId, bearerToken),
    };
  }

  async nextSteps(projectId, bearerToken = null, environment = null) {
    const { isSystemProject } = require('../config/systemProject');
    const steps = [];
    const auth = bearerToken ? { authorization: bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}` } : {};
    const sm = () => {
      const ServiceManager = require('./ServiceManager');
      const WorkerRepository = require('../repos/WorkerRepository');
      return ServiceManager.getInstance(WorkerRepository);
    };
    const get = async (service, path, query = {}) => {
      try {
        const res = await sm().proxyServiceRequest(
          service,
          'GET',
          path,
          null,
          { ...query, project_id: projectId },
          projectId,
          auth,
        );
        if (res.status >= 400) return { _failed: true };
        return { ...(res.data || {}), _failed: false };
      } catch {
        return { _failed: true };
      }
    };
    const envQuery = environment ? { environment } : {};
    const repoRes = await get('git_manager', '/api/v1/repos');
    const repos = repoRes._failed ? [] : (repoRes.repositories || []);
    const secretQuery = isSystemProject(projectId)
      ? {}
      : { environment: environment || 'prod' };
    const secretRes = await get('secrets_manager', '/api/v1/secrets', secretQuery);
    const secretNames = await listProjectSecretNames(projectId, bearerToken);
    const secrets = secretNames.size
      ? [...secretNames].map((name) => ({ name }))
      : (secretRes._failed ? null : (secretRes.secrets || []));
    const taskRes = await get('compute_manager', '/api/v1/tasks', envQuery);
    const tasks = taskRes._failed ? null : (taskRes.tasks || []);
    const hostRes = await get('domain_manager', '/api/v1/dns/hostnames');
    const hostnames = hostRes._failed ? null : (hostRes.hostnames || []);
    const tunRes = await get('tunnel_manager', '/api/v1/tunnels');
    let tunnels = tunRes._failed ? [] : (tunRes.tunnels || []);
    try {
      const named = require('../config/knownTunnels').knownTunnels();
      if (named.length) tunnels = tunnels.concat(named);
    } catch (_) { /* named inventory is optional */ }
    const pulls = (await get('git_manager', '/api/v1/pulls')).pulls || [];
    const EnvironmentService = require('./EnvironmentService');
    const envs = await EnvironmentService.list(projectId).catch(() => []);

    if (!repos.length) {
      steps.push({
        id: 'add_remote',
        status: 'ready',
        reason: 'Create a repository, then copy the remote commands.',
        action: 'add_remote',
      });
    } else {
      steps.push({
        id: 'add_remote',
        status: 'done',
        reason: `${repos.length} repositor${repos.length === 1 ? 'y' : 'ies'} on this origin.`,
        action: 'add_remote',
      });
    }

    if (!isSystemProject(projectId) && !envs.length) {
      steps.push({
        id: 'create_env',
        status: 'ready',
        reason: 'This project has no environment yet.',
        action: 'create_env',
      });
    } else {
      steps.push({
        id: 'create_env',
        status: 'done',
        reason: isSystemProject(projectId)
          ? 'System project is prod-only.'
          : `${envs.length} environment${envs.length === 1 ? '' : 's'} on this project.`,
        action: 'create_env',
      });
    }

    if (secrets === null) {
      steps.push({
        id: 'fill_secret',
        status: 'blocked',
        reason: 'Could not list secrets. Try again from Key Manager.',
        action: 'fill_secret',
      });
    } else if (!secrets.length && !isSystemProject(projectId)) {
      steps.push({
        id: 'fill_secret',
        status: 'ready',
        reason: 'This environment has no secrets yet.',
        action: 'fill_secret',
      });
    } else {
      steps.push({
        id: 'fill_secret',
        status: 'done',
        reason: secrets && secrets.length
          ? `${secrets.length} secret name(s) stored.`
          : 'System secrets are in Key Manager.',
        action: 'fill_secret',
      });
    }

    if (isSystemProject(projectId)) {
      steps.push({
        id: 'launch',
        status: 'done',
        reason: 'System project does not launch app containers.',
        action: 'launch',
      });
    } else if (tasks === null) {
      steps.push({
        id: 'launch',
        status: 'blocked',
        reason: 'Could not list containers. Try again from Compute.',
        action: 'launch',
      });
    } else if (!tasks.length) {
      steps.push({
        id: 'launch',
        status: 'ready',
        reason: 'No container yet. Launch one for this environment.',
        action: 'launch',
      });
    } else {
      steps.push({
        id: 'launch',
        status: 'done',
        reason: `${tasks.length} container(s) on this project.`,
        action: 'launch',
      });
    }

    const gitBound = Array.isArray(hostnames) && hostnames.some(
      (h) => Number(h.port) === 3130 || String(h.target_id || '') === 'git_manager'
    );
    const { cloudConsoleTunnels } = require('../config/knownTunnels');
    const fleetUp = cloudConsoleTunnels().some((t) => t.status === 'healthy');
    if (isSystemProject(projectId) && fleetUp) {
      steps.push({
        id: 'bind',
        status: 'done',
        reason: 'Fleet tunnels (prod-mini, dev-mini, orin) are attached.',
        action: 'bind',
      });
    } else if (hostnames === null) {
      steps.push({
        id: 'bind',
        status: 'blocked',
        reason: 'Could not list hostnames. Try again from Edge.',
        action: 'bind',
      });
    } else if (tunnels.length && !hostnames.length) {
      steps.push({
        id: 'bind',
        status: 'ready',
        reason: 'No public URL yet. Bind a hostname to this container.',
        action: 'bind',
      });
    } else if (!tunnels.length && !gitBound && !hostnames.length) {
      steps.push({
        id: 'bind',
        status: 'ready',
        reason: 'No public URL yet. Bind a hostname to this container.',
        action: 'bind',
      });
    } else {
      steps.push({
        id: 'bind',
        status: 'done',
        reason: gitBound ? 'Git origin hostname is bound.' : `${hostnames.length} hostname(s) bound.`,
        action: 'bind',
      });
    }

    const open = (pulls || []).filter((p) => p.status === 'open');
    if (isSystemProject(projectId)) {
      steps.push({
        id: 'open_pr',
        status: 'done',
        reason: 'Fleet repo lives on the system project — no app PR required.',
        action: 'open_pr',
      });
    } else if (repos.length && !open.length) {
      steps.push({
        id: 'open_pr',
        status: 'ready',
        reason: 'Push a branch, then open a PR here.',
        action: 'open_pr',
      });
    } else if (open.length) {
      steps.push({
        id: 'open_pr',
        status: 'ready',
        reason: `${open.length} open PR(s) ready to merge.`,
        action: 'open_pr',
      });
    } else {
      steps.push({
        id: 'open_pr',
        status: 'blocked',
        reason: 'Create a repository first.',
        action: 'open_pr',
      });
    }

    return steps;
  }

  async callEnsureDefaults(serviceName, projectId, extra = {}) {
    const bases = healthProbeBases(serviceName);
    for (const base of bases) {
      try {
        const res = await axios.post(
          `${base}/api/v1/ensure-defaults`,
          { project_id: projectId, ...extra },
          { timeout: 15000, validateStatus: () => true, headers: { 'x-project-id': projectId } },
        );
        if (res.status < 500) {
          return { ok: res.status < 400, status: res.status, data: res.data, via: base };
        }
      } catch (_) { /* try next */ }
    }
    return { ok: false, skipped: true, error: 'unreachable' };
  }

  async enableService(projectId, serviceName, { defaults = true } = {}) {
    const ServiceManager = require('./ServiceManager');
    const WorkerRepository = require('../repos/WorkerRepository');
    const sm = ServiceManager.getInstance(WorkerRepository);
    let enabledOk = false;
    let error = null;
    try {
      await sm.enableService(serviceName, null, projectId);
      enabledOk = true;
    } catch (err) {
      error = err.message || String(err);
      // Project association may still have been written; treat as enabled-with-warning.
      const st = await isServiceEnabledForProject(projectId, serviceName);
      enabledOk = !!st.enabled;
    }
    let def = null;
    if (defaults && enabledOk) {
      def = await this.callEnsureDefaults(serviceName, projectId);
    }
    if (enabledOk) {
      try {
        const StackService = require('./StackService');
        await StackService.recordWanted(projectId, serviceName);
      } catch (_) { /* stack wanted is best-effort */ }
    }
    return { service: serviceName, enabled: enabledOk, error, defaults: def };
  }

  async enableWithDependencies(projectId, serviceName, { with_dependencies = true, defaults = true } = {}) {
    const names = with_dependencies ? requiredDepsInOrder(serviceName) : [serviceName];
    const enabled = [];
    const defaultsOut = {};
    for (const name of names) {
      const row = await this.enableService(projectId, name, { defaults });
      enabled.push(row);
      if (row.defaults) defaultsOut[name] = row.defaults;
    }
    return { project_id: projectId, service: serviceName, enabled: enabled.map((e) => e.service), results: enabled, defaults: defaultsOut };
  }

  async enablePack(projectId, packName, { defaults = true } = {}) {
    const pack = getPack(packName);
    if (!pack) {
      const e = new Error(`Unknown pack: ${packName}`);
      e.status = 404;
      throw e;
    }
    const seen = new Set();
    const enabled = [];
    const defaultsOut = {};
    for (const svc of pack.services) {
      const names = requiredDepsInOrder(svc);
      for (const name of names) {
        if (seen.has(name)) continue;
        seen.add(name);
        const row = await this.enableService(projectId, name, { defaults });
        enabled.push(row);
        if (row.defaults) defaultsOut[name] = row.defaults;
      }
    }
    return {
      project_id: projectId,
      pack: packName,
      services: pack.services,
      enabled: enabled.map((e) => e.service),
      results: enabled,
      defaults: defaultsOut,
    };
  }
}

module.exports = new SetupService();
module.exports.PACKS = PACKS;
