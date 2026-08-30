'use strict';

const axios = require('axios');
const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

const CF_SECRETS = ['cloudflare_api_token', 'cloudflare_account_id', 'cloudflare_zone_id'];

function serviceManager() {
  return ServiceManager.getInstance(WorkerRepository);
}

function authHeader(bearerToken) {
  return bearerToken.startsWith('Bearer ') ? bearerToken : `Bearer ${bearerToken}`;
}

async function listProjectSecretNames(projectId, bearerToken) {
  try {
    const res = await serviceManager().proxyServiceRequest(
      'secrets_manager',
      'GET',
      '/api/v1/secrets',
      null,
      {},
      projectId,
      { authorization: authHeader(bearerToken) },
    );
    if (res.status !== 200 || !Array.isArray(res.data?.secrets)) {
      return { ok: false, status: res.status, names: [] };
    }
    return { ok: true, names: res.data.secrets.map((s) => s.name) };
  } catch (e) {
    const status = e.status || 503;
    return { ok: false, status, names: [], error: e.message };
  }
}

async function probeManagerReady(serviceName) {
  const portMap = require('../config/managerServicePorts');
  const ports = portMap[serviceName];
  if (!ports) return { ok: false, status: 0, error: 'no port map' };
  const port = Object.values(ports)[0];
  const bases = [
    `http://${serviceName}:${port}`,
    `http://aerekos-${serviceName}:${port}`,
    `http://localhost:${port}`,
  ];
  for (const base of bases) {
    try {
      const res = await axios.get(`${base}/ready`, { timeout: 2000, validateStatus: () => true });
      if (res.status === 200) {
        return { ok: true, status: 200, cloudflare: res.data?.cloudflare || null };
      }
      return {
        ok: false,
        status: res.status,
        cloudflare: res.data?.cloudflare || null,
        error: res.data?.error || res.data?.cloudflare?.message || 'not ready',
      };
    } catch (_) { /* try next */ }
  }
  return { ok: false, status: 0, error: 'unreachable' };
}

async function probeZones(projectId, bearerToken) {
  try {
    const res = await serviceManager().proxyServiceRequest(
      'domain_manager',
      'GET',
      '/api/v1/dns/zones',
      null,
      {},
      projectId,
      { authorization: authHeader(bearerToken) },
    );
    if (res.status !== 200) {
      return {
        ok: false,
        status: res.status,
        error: res.data?.error?.message || `zones probe returned ${res.status}`,
      };
    }
    const zones = res.data?.zones || [];
    return { ok: true, status: 200, count: zones.length, zones };
  } catch (e) {
    return { ok: false, status: e.status || 0, error: e.message };
  }
}

class EdgeService {
  /**
   * Cloudflare connect readiness for a project (secrets + live probes).
   */
  async probeCloudflare(projectId, bearerToken) {
    const secretList = await listProjectSecretNames(projectId, bearerToken);
    const nameSet = new Set(secretList.names || []);
    const secrets = {};
    for (const n of CF_SECRETS) {
      secrets[n] = nameSet.has(n);
    }
    const requiredOk = secrets.cloudflare_api_token && secrets.cloudflare_account_id;

    const result = {
      project_id: projectId,
      secrets,
      secrets_list_ok: secretList.ok,
      configured: requiredOk,
      ready: false,
      tunnel: null,
      domain: null,
      message: null,
    };

    if (!secretList.ok) {
      result.message = secretList.error
        ? `secrets_manager: ${secretList.error}`
        : 'secrets_manager unavailable — enable secrets_manager first';
      return result;
    }
    if (!requiredOk) {
      const missing = [];
      if (!secrets.cloudflare_api_token) missing.push('cloudflare_api_token');
      if (!secrets.cloudflare_account_id) missing.push('cloudflare_account_id');
      result.message = `Store project secrets: ${missing.join(', ')}`;
      return result;
    }

    const [tunnel, domain] = await Promise.all([
      probeManagerReady('tunnel_manager'),
      probeZones(projectId, bearerToken),
    ]);
    result.tunnel = tunnel;
    result.domain = domain;
    result.ready = tunnel.ok && domain.ok;
    result.message = result.ready
      ? `Cloudflare connected — ${domain.count} zone(s) visible`
      : [
          !tunnel.ok ? `tunnel_manager: ${tunnel.error || 'not ready'}` : null,
          !domain.ok ? `domain_manager: ${domain.error || 'zones probe failed'}` : null,
        ]
          .filter(Boolean)
          .join('; ') || 'Probe incomplete';
    return result;
  }

  async hookupStatus(projectId, bearerToken) {
    const probe = await this.probeCloudflare(projectId, bearerToken);
    const missing = [];
    if (!probe.secrets?.cloudflare_api_token) missing.push('cloudflare_api_token');
    if (!probe.secrets?.cloudflare_account_id) missing.push('cloudflare_account_id');
    if (!probe.tunnel?.ok) missing.push('tunnel_manager');
    if (!probe.domain?.ok) missing.push('domain_manager');
    return {
      hooked_up: !!probe.ready,
      missing,
      probe,
      message: probe.message,
      project_id: projectId,
    };
  }

  async hookup(projectId, bearerToken) {
    const SetupService = require('./SetupService');
    const ProjectRepository = require('../repos/ProjectRepository');
    const status = await this.hookupStatus(projectId, bearerToken);
    const secretMissing = status.missing.filter((m) => m.startsWith('cloudflare_'));
    if (secretMissing.length) {
      return {
        hooked_up: false,
        missing: secretMissing,
        message: `Store project secrets: ${secretMissing.join(', ')}`,
      };
    }
    await SetupService.enableWithDependencies(projectId, 'tunnel_manager', {
      with_dependencies: true,
      defaults: true,
    }).catch((err) => console.warn('[edge] enable tunnel_manager:', err.message));
    await SetupService.enableWithDependencies(projectId, 'domain_manager', {
      with_dependencies: true,
      defaults: true,
    }).catch((err) => console.warn('[edge] enable domain_manager:', err.message));
    let tunnel = null;
    let hostname = null;
    const auth = { authorization: authHeader(bearerToken) };
    try {
      const created = await serviceManager().proxyServiceRequest(
        'tunnel_manager',
        'POST',
        '/api/v1/tunnels',
        { project_id: projectId, name: `default-${String(projectId).slice(0, 8)}` },
        {},
        projectId,
        auth,
      );
      tunnel = created.data?.tunnel || created.data;
    } catch (err) {
      console.warn('[edge] create tunnel:', err.message);
    }
    const hostnameWanted = process.env.EDGE_BOOTSTRAP_HOSTNAME;
    if (hostnameWanted && tunnel) {
      try {
        const bound = await serviceManager().proxyServiceRequest(
          'domain_manager',
          'POST',
          '/api/v1/dns/hostnames',
          {
            project_id: projectId,
            hostname: hostnameWanted,
            target_type: 'compute_task',
            target_id: process.env.EDGE_BOOTSTRAP_TASK_ID || '',
            tunnel_id: tunnel.cf_tunnel_id || tunnel.id,
            port: Number(process.env.EDGE_BOOTSTRAP_PORT || 80),
          },
          {},
          projectId,
          auth,
        );
        hostname = bound.data?.binding || bound.data;
      } catch (err) {
        console.warn('[edge] bind hostname:', err.message);
      }
    }
    try {
      const project = await ProjectRepository.findById(projectId);
      let cfg = {};
      try { cfg = typeof project.config === 'object' ? { ...project.config } : JSON.parse(project.config || '{}'); } catch { cfg = {}; }
      cfg.edge_hookup = {
        hooked_up_at: new Date().toISOString(),
        tunnel_id: tunnel?.id || tunnel?.cf_tunnel_id || null,
        hostname: hostnameWanted || null,
      };
      await ProjectRepository.update(projectId, { config: JSON.stringify(cfg) });
    } catch (err) {
      console.warn('[edge] persist hookup:', err.message);
    }
    const finalStatus = await this.hookupStatus(projectId, bearerToken);
    return { ...finalStatus, tunnel, hostname };
  }

  async importLiveTunnels(projectId, bearerToken) {
    const auth = { authorization: authHeader(bearerToken) };
    const res = await serviceManager().proxyServiceRequest(
      'tunnel_manager',
      'POST',
      '/api/v1/tunnels/import',
      { project_id: projectId },
      {},
      projectId,
      auth,
    );
    return res.data;
  }

  knownTunnels() {
    return [
      { display_name: 'prod', cf_tunnel_id: 'd33010ac-473f-496b-938f-1bac352e415d', device_hostname: 'aerekos-server', default_bind: true, origin_mode: 'host' },
      { display_name: 'prod-ssh', cf_tunnel_id: '17dd5eb6-a5a9-411c-8d2e-50d8f6617b18', device_hostname: 'aerekos-server', default_bind: false, origin_mode: 'host' },
      { display_name: 'dev', cf_tunnel_id: '689acb6e-c4c3-4c2a-9e32-898e3c2780a0', device_hostname: 'aerekos-M5-PLUS', default_bind: true, origin_mode: 'host' },
      { display_name: 'orin', cf_tunnel_id: 'd0efca3a-9127-47ea-a083-9461df4cb25d', device_hostname: 'ubuntu', default_bind: true, origin_mode: 'host' },
    ];
  }

  async nameImportedTunnels(projectId, bearerToken) {
    const auth = { authorization: authHeader(bearerToken) };
    await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'POST', '/api/v1/tunnels/adopt-known',
      { project_id: projectId, tunnels: this.knownTunnels() },
      {}, projectId, auth
    ).catch(() => {});
    const listed = await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'GET', '/api/v1/tunnels', null, {}, projectId, auth
    );
    const rows = listed.data?.tunnels || listed.data?.items || (Array.isArray(listed.data) ? listed.data : []);
    const named = [];
    for (const known of this.knownTunnels()) {
      const row = (Array.isArray(rows) ? rows : []).find((t) => t.cf_tunnel_id === known.cf_tunnel_id || t.id === known.cf_tunnel_id);
      named.push({ ...known, id: row?.id || row?.tunnel_id || known.cf_tunnel_id });
    }
    return named;
  }

  async defaultTunnelForTask(projectId, task, bearerToken) {
    const named = await this.nameImportedTunnels(projectId, bearerToken);
    const host = String(task.worker_hostname || '').toLowerCase();
    const match = named.find((t) => t.default_bind && host && String(t.device_hostname).toLowerCase() === host)
      || named.find((t) => t.display_name === 'prod' && t.default_bind);
    return match || null;
  }

  hostPort(task, port) {
    const wanted = String(port);
    const pb = task.port_bindings || {};
    for (const [k, v] of Object.entries(pb)) {
      const host = Array.isArray(v) ? (v[0]?.HostPort || v[0]) : v;
      if (String(k).split('/')[0] === wanted || String(host) === wanted) return String(host);
    }
    if (wanted) return wanted;
    const e = new Error('no host-published port to bind');
    e.status = 400;
    throw e;
  }

  async bind(projectId, bearerToken, body = {}) {
    const auth = { authorization: authHeader(bearerToken) };
    const taskId = body.task_id;
    const hostname = String(body.hostname || '').trim().toLowerCase();
    const platformGit = !taskId && hostname === 'git.aerekos.com' && Number(body.port || 3130) === 3130;
    if (!hostname || (!taskId && !platformGit)) {
      const e = new Error('task_id and hostname are required');
      e.status = 400;
      throw e;
    }
    if (String(body.port) === '4200' || Number(body.port) === 4200) {
      const e = new Error('port 4200 is reserved');
      e.status = 400;
      throw e;
    }
    let task = null;
    let hostPort = String(body.port || '');
    if (platformGit) {
      hostPort = '3130';
      task = { worker_hostname: 'aerekos-server', environment: 'prod' };
    } else {
      const taskRes = await serviceManager().proxyServiceRequest(
        'compute_manager', 'GET', `/api/v1/tasks/${encodeURIComponent(taskId)}`, null, {}, projectId, auth
      );
      task = taskRes.data?.task || taskRes.data;
      if (!task) {
        const e = new Error('task not found');
        e.status = 404;
        throw e;
      }
      if (task.database_name || String(task.image || '').includes('db_manager')) {
        const e = new Error('public hostnames are denied for databases');
        e.status = 403;
        throw e;
      }
      const adopted = task.env && (task.env.AEREKOS_ADOPTED === '1' || task.env.AEREKOS_ADOPTED === 1);
      if (adopted && /icarus/i.test(String(task.name || ''))) {
        const e = new Error('will not auto-bind adopted icarus-assistant');
        e.status = 403;
        throw e;
      }
      hostPort = this.hostPort(task, body.port);
    }
    let tunnel = null;
    if (body.tunnel_id) {
      const got = await serviceManager().proxyServiceRequest(
        'tunnel_manager', 'GET', `/api/v1/tunnels/${encodeURIComponent(body.tunnel_id)}`, null, {}, projectId, auth
      );
      tunnel = got.data?.tunnel || got.data;
    } else {
      tunnel = await this.defaultTunnelForTask(projectId, task, bearerToken);
    }
    if (!tunnel || !(tunnel.cf_tunnel_id || tunnel.id)) {
      const e = new Error('this device has no cloudflared');
      e.status = 409;
      throw e;
    }
    const cfId = tunnel.cf_tunnel_id || tunnel.id;
    const originMode = tunnel.origin_mode || 'host';
    const serviceUrl = originMode === 'docker'
      ? `http://host.docker.internal:${hostPort}`
      : `http://localhost:${hostPort}`;
    const created = await serviceManager().proxyServiceRequest(
      'domain_manager', 'POST', '/api/v1/dns/hostnames',
      {
        project_id: projectId,
        hostname,
        target_type: platformGit ? 'platform' : 'compute_task',
        target_id: taskId || 'git_manager',
        port: Number(hostPort),
        tunnel_id: cfId,
        environment: body.environment || task.environment || 'prod',
      },
      {},
      projectId,
      auth,
    );
    if (created.status >= 400) {
      const e = new Error(created.data?.error?.message || 'hostname bind failed');
      e.status = created.status;
      throw e;
    }
    const tunnelRowId = tunnel.id || body.tunnel_id;
    if (tunnelRowId) {
      const ing = await serviceManager().proxyServiceRequest(
        'tunnel_manager', 'PATCH', `/api/v1/tunnels/${encodeURIComponent(tunnelRowId)}/ingress`,
        { project_id: projectId, hostname, service: serviceUrl },
        {},
        projectId,
        auth,
      );
      if (ing.status >= 400) {
        const e = new Error(ing.data?.error?.message || 'ingress merge failed');
        e.status = ing.status;
        throw e;
      }
    }
    return { binding: created.data?.binding || created.data, hostname, port: Number(hostPort), tunnel: cfId, service: serviceUrl };
  }

  async unbind(projectId, bearerToken, bindingId) {
    const auth = { authorization: authHeader(bearerToken) };
    const listed = await serviceManager().proxyServiceRequest(
      'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
    );
    const rows = listed.data?.hostnames || [];
    const row = rows.find((h) => h.id === bindingId);
    if (!row) {
      const e = new Error('binding not found');
      e.status = 404;
      throw e;
    }
    if (row.tunnel_id) {
      const tunnels = await serviceManager().proxyServiceRequest(
        'tunnel_manager', 'GET', '/api/v1/tunnels', null, {}, projectId, auth
      );
      const trows = tunnels.data?.tunnels || [];
      const tun = trows.find((t) => t.cf_tunnel_id === row.tunnel_id || t.id === row.tunnel_id);
      if (tun?.id) {
        await serviceManager().proxyServiceRequest(
          'tunnel_manager', 'PATCH', `/api/v1/tunnels/${encodeURIComponent(tun.id)}/ingress`,
          { project_id: projectId, removeHostname: row.hostname },
          {},
          projectId,
          auth,
        );
      }
    }
    if (row.dns_record_id) {
      await serviceManager().proxyServiceRequest(
        'domain_manager', 'DELETE', `/api/v1/dns/records/${encodeURIComponent(row.dns_record_id)}`,
        null, {}, projectId, auth,
      ).catch(() => {});
    }
    await serviceManager().proxyServiceRequest(
      'domain_manager', 'DELETE', `/api/v1/dns/hostnames/${encodeURIComponent(bindingId)}`,
      null, {}, projectId, auth,
    );
    return { deleted: true, id: bindingId };
  }
}

module.exports = new EdgeService();
