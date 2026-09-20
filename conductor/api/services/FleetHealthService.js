'use strict';

const { Worker, Service, ServiceDeployment } = require('../models');
const { inferRoles, parseCaps, parseResources } = require('./deviceRoles');
const { ramFromResources } = require('./CapacityService');
const { versionInfo } = require('../utils/version');
const SetupService = require('./SetupService');

async function probeService(name) {
  try {
    const hit = await SetupService.probeHealth(name);
    return { service: name, health: hit.ok ? 'up' : 'down', detail: hit.error || hit.via || null };
  } catch (err) {
    return { service: name, health: 'down', detail: err.message };
  }
}

class FleetHealthService {
  async snapshot(projectId) {
    const workers = await Worker.findAll();
    const services = await Service.findAll();
    const byServiceId = {};
    for (const s of services) byServiceId[s.id] = s.name;

    const depWhere = {};
    if (projectId) depWhere.project_id = projectId;
    const deployments = await ServiceDeployment.findAll(Object.keys(depWhere).length ? { where: depWhere } : {});

    const instancesByWorker = {};
    const serviceNames = new Set();
    for (const d of deployments) {
      const name = byServiceId[d.service_id];
      if (!name) continue;
      serviceNames.add(name);
      if (!instancesByWorker[d.worker_id]) instancesByWorker[d.worker_id] = [];
      instancesByWorker[d.worker_id].push({
        service: name,
        status: d.status,
        deployment_id: d.id,
        project_id: d.project_id,
      });
    }

    const probes = await Promise.all([...serviceNames].map((n) => probeService(n)));
    const healthByService = {};
    for (const p of probes) healthByService[p.service] = p;

    const workerRows = workers.map((w) => {
      const instances = (instancesByWorker[w.id] || []).map((inst) => ({
        ...inst,
        health: healthByService[inst.service]?.health || 'unknown',
      }));
      const res = parseResources(w.resources);
      const vi = versionInfo(w);
      return {
        id: w.id,
        hostname: w.hostname,
        display_name: w.display_name || '',
        ip_address: w.ip_address,
        status: w.status,
        version: vi.version,
        outdated: vi.outdated,
        last_seen: w.last_seen,
        overlay_ip: res.overlay_ip || res.tailscale_ip || null,
        capabilities: parseCaps(w.capabilities),
        roles: inferRoles(w, instances),
        instances,
        ram: ramFromResources(res),
        gpu: res.gpu || null,
        loaded_ai: res.loaded_ai || [],
      };
    });

    const online = workerRows.filter((w) => w.status === 'online').length;
    return {
      workers: workerRows,
      summary: {
        worker_count: workerRows.length,
        online,
        instance_count: deployments.length,
      },
    };
  }
}

module.exports = new FleetHealthService();
module.exports.FleetHealthService = FleetHealthService;
