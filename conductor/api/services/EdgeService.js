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
      { project_id: projectId },
      projectId,
      { authorization: authHeader(bearerToken) },
    );
    if (res.status !== 200 || !Array.isArray(res.data?.secrets)) {
      return { ok: false, status: res.status, names: [] };
    }
    return { ok: true, names: res.data.secrets.map((s) => s.name) };
  } catch (e) {
    const status = e.status || e.statusCode || 503;
    return { ok: false, status, names: [], error: e.message || e.code || String(e) };
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
    `http://host.docker.internal:${port}`,
    `http://127.0.0.1:${port}`,
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
    const before = await this.hookupStatus(projectId, bearerToken);
    if (!before.probe?.secrets?.cloudflare_api_token || !before.probe?.secrets?.cloudflare_account_id) {
      return {
        hooked_up: false,
        missing: before.missing,
        message: before.message || 'Store cloudflare_api_token and cloudflare_account_id, then hook up.',
        project_id: projectId,
      };
    }

    const SetupService = require('./SetupService');
    try {
      await SetupService.enableWithDependencies(projectId, 'tunnel_manager', {
        with_dependencies: true,
        defaults: true,
      });
    } catch (e) {
      console.warn('[edge] enable tunnel_manager:', e.message);
    }
    try {
      await SetupService.enableWithDependencies(projectId, 'domain_manager', {
        with_dependencies: true,
        defaults: true,
      });
    } catch (e) {
      console.warn('[edge] enable domain_manager:', e.message);
    }

    let named = [];
    let imported = null;
    try {
      named = await this.nameImportedTunnels(projectId, bearerToken);
    } catch (e) {
      console.warn('[edge] adopt-known:', e.message);
    }
    try {
      imported = await this.importLiveTunnels(projectId, bearerToken);
    } catch (e) {
      console.warn('[edge] import live tunnels:', e.message);
    }

    const after = await this.hookupStatus(projectId, bearerToken);
    return {
      ...after,
      adopted: Array.isArray(named) ? named.filter((t) => t.cf_tunnel_id).length : 0,
      imported,
      message: after.hooked_up
        ? `Cloudflare connected — adopted existing tunnels, no new tunnel minted.`
        : after.message,
    };
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
    return require('../config/knownTunnels').knownTunnels();
  }

  /**
   * Write hostname rows for live CF ingress that already matches this task's
   * published ports. Does not merge ingress and does not call bind().
   */
  async importTaskHostnames(projectId, bearerToken, { task_id: taskId }) {
    const auth = { authorization: authHeader(bearerToken) };
    if (!taskId) {
      const e = new Error('task_id is required');
      e.status = 400;
      throw e;
    }
    const taskRes = await serviceManager().proxyServiceRequest(
      'compute_manager',
      'GET',
      `/api/v1/tasks/${encodeURIComponent(taskId)}`,
      null,
      { refresh: '1' },
      projectId,
      auth,
    );
    const task = taskRes.data?.task || taskRes.data;
    if (!task) {
      const e = new Error('task not found');
      e.status = 404;
      throw e;
    }
    const named = await this.nameImportedTunnels(projectId, bearerToken);
    const host = String(task.worker_hostname || '').toLowerCase();
    let deviceTunnels = named.filter((t) => host && String(t.device_hostname || '').toLowerCase() === host);
    if (!deviceTunnels.length) {
      deviceTunnels = named.filter((t) => t.id && t.status !== 'down');
    }
    const published = new Set();
    for (const [k, v] of Object.entries(task.port_bindings || {})) {
      const fromKey = String(k).split('/')[0];
      if (/^\d+$/.test(fromKey)) published.add(fromKey);
      const list = Array.isArray(v) ? v : (v == null ? [] : [v]);
      for (const item of list) {
        const hp = item && typeof item === 'object' ? (item.HostPort || item.hostPort) : item;
        if (hp) published.add(String(hp));
      }
    }
    const listed = await serviceManager().proxyServiceRequest(
      'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
    );
    const existing = listed.data?.hostnames || [];
    const imported = [];
    for (const tun of deviceTunnels) {
      if (!tun.id) continue;
      const ing = await serviceManager().proxyServiceRequest(
        'tunnel_manager', 'GET', `/api/v1/tunnels/${encodeURIComponent(tun.id)}/ingress`,
        null, {}, projectId, auth
      ).catch(() => ({ data: {} }));
      const rules = ing.data?.ingress || ing.data?.config?.ingress || [];
      for (const rule of rules) {
        const hostname = String(rule.hostname || '').toLowerCase();
        const svc = String(rule.service || '');
        const portMatch = svc.match(/:(\d+)\s*$/);
        const port = portMatch ? portMatch[1] : '';
        if (!hostname || !port || !published.has(String(port))) continue;
        if (existing.some((h) => String(h.hostname).toLowerCase() === hostname)) continue;
        const created = await serviceManager().proxyServiceRequest(
          'domain_manager', 'POST', '/api/v1/dns/hostnames',
          {
            project_id: projectId,
            hostname,
            target_type: 'compute_task',
            target_id: taskId,
            port: Number(port),
            tunnel_id: tun.cf_tunnel_id || tun.id,
            environment: task.environment || 'prod',
            imported: true,
          },
          {},
          projectId,
          auth,
        );
        if (created.status < 400) {
          imported.push(created.data?.binding || created.data || { hostname, port });
        }
      }
    }
    return { imported, task_id: taskId };
  }

  async nameImportedTunnels(projectId, bearerToken) {
    const auth = { authorization: authHeader(bearerToken) };
    const known = this.knownTunnels();
    try {
      const workers = await WorkerRepository.findAll();
      for (const k of known) {
        const w = (workers || []).find((row) => {
          const host = String(row.hostname || row.device_hostname || '').toLowerCase();
          return host && host === String(k.device_hostname || '').toLowerCase();
        });
        if (w) k.worker_id = w.id || w.worker_id || '';
      }
    } catch (_) { /* attach worker_id when workers are listed */ }
    const adoptable = known.filter((t) => /^[0-9a-f-]{36}$/i.test(String(t.cf_tunnel_id || '')));
    await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'POST', '/api/v1/tunnels/adopt-known',
      { project_id: projectId, tunnels: adoptable },
      {}, projectId, auth
    ).catch(() => {});
    const listed = await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'GET', '/api/v1/tunnels', null, {}, projectId, auth
    );
    const rows = listed.data?.tunnels || listed.data?.items || (Array.isArray(listed.data) ? listed.data : []);
    const named = [];
    for (const k of known) {
      const row = (Array.isArray(rows) ? rows : []).find((t) => t.cf_tunnel_id === k.cf_tunnel_id || t.id === k.cf_tunnel_id);
      named.push({
        ...k,
        id: row?.id || row?.tunnel_id || k.cf_tunnel_id,
        worker_id: k.worker_id || row?.worker_id || '',
      });
    }
    return named;
  }

  async defaultTunnelForTask(projectId, task, bearerToken) {
    const named = await this.nameImportedTunnels(projectId, bearerToken);
    const host = String(task.worker_hostname || '').toLowerCase();
    const match = named.find((t) => t.default_bind && host && String(t.device_hostname).toLowerCase() === host)
      || named.find((t) => t.default_bind && /prod/i.test(String(t.display_name || '')));
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
    const gitOrigin = !taskId && Number(body.port) === 3130;
    if (!hostname || (!taskId && !gitOrigin)) {
      const e = new Error('task_id and hostname are required');
      e.status = 400;
      throw e;
    }
    if (String(body.port) === '4200' || Number(body.port) === 4200) {
      const e = new Error('port 4200 is reserved');
      e.status = 400;
      throw e;
    }
    const existingHosts = await serviceManager().proxyServiceRequest(
      'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
    );
    const already = (existingHosts.data?.hostnames || []).find(
      (h) => String(h.hostname || '').toLowerCase() === hostname
    );
    if (already) {
      const e = new Error(`${hostname} is already bound`);
      e.status = 409;
      throw e;
    }
    let task = null;
    let hostPort = String(body.port || '');
    if (gitOrigin) {
      hostPort = '3130';
      task = { worker_hostname: String(body.worker_hostname || ''), environment: body.environment || 'prod' };
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
        target_type: gitOrigin ? 'platform' : 'compute_task',
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

  composeHostname(subdomain, domain) {
    return require('../utils/hostnameParts').composeHostname(subdomain, domain);
  }

  originService(port, protocol) {
    return require('../utils/hostnameParts').originService(port, protocol);
  }

  async resolveNamedTunnel(projectId, bearerToken, tunnelId) {
    const named = await this.nameImportedTunnels(projectId, bearerToken);
    const id = String(tunnelId || '');
    const tun = named.find((t) => t.id === id || t.cf_tunnel_id === id || t.display_name === id);
    if (!tun || !(tun.id || tun.cf_tunnel_id)) {
      const e = new Error('tunnel not found');
      e.status = 404;
      throw e;
    }
    return tun;
  }

  async mergeTunnelIngress(projectId, auth, tunnelRef, body) {
    const id = tunnelRef.id || tunnelRef.cf_tunnel_id;
    const got = await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'GET', `/api/v1/tunnels/${encodeURIComponent(id)}/ingress`,
      null, {}, projectId, auth,
    );
    const rowId = got.data?.tunnel_id || id;
    const patched = await serviceManager().proxyServiceRequest(
      'tunnel_manager', 'PATCH', `/api/v1/tunnels/${encodeURIComponent(rowId)}/ingress`,
      { project_id: projectId, ...body },
      {},
      projectId,
      auth,
    );
    if (patched.status >= 400) {
      const e = new Error(patched.data?.error?.message || 'ingress merge failed');
      e.status = patched.status;
      throw e;
    }
    return patched.data;
  }

  async upsertHostnameRow(projectId, auth, { hostname, port, tunnelId, environment, targetId }) {
    const listed = await serviceManager().proxyServiceRequest(
      'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
    );
    const rows = listed.data?.hostnames || [];
    const existing = rows.find((h) => String(h.hostname || '').toLowerCase() === hostname);
    if (existing
      && Number(existing.port) === Number(port)
      && String(existing.tunnel_id || '') === String(tunnelId || '')
      && String(existing.target_id || '') === String(targetId || '')) {
      return existing;
    }
    if (existing?.id && String(existing.target_id || '') !== String(targetId || '')) {
      try {
        const patched = await serviceManager().proxyServiceRequest(
          'domain_manager', 'PATCH', `/api/v1/dns/hostnames/${encodeURIComponent(existing.id)}`,
          { project_id: projectId, target_id: targetId || '', port: Number(port), tunnel_id: tunnelId },
          {},
          projectId,
          auth,
        );
        if (patched.status < 400) return patched.data?.hostname || patched.data;
      } catch (_) { /* fall through to recreate */ }
    }
    if (existing?.id) {
      await serviceManager().proxyServiceRequest(
        'domain_manager', 'DELETE', `/api/v1/dns/hostnames/${encodeURIComponent(existing.id)}`,
        null, {}, projectId, auth,
      ).catch(() => {});
    }
    const created = await serviceManager().proxyServiceRequest(
      'domain_manager', 'POST', '/api/v1/dns/hostnames',
      {
        project_id: projectId,
        hostname,
        target_type: targetId ? 'compute_task' : 'platform',
        target_id: targetId || '',
        port: Number(port),
        tunnel_id: tunnelId,
        environment: environment || 'prod',
        imported: true,
      },
      {},
      projectId,
      auth,
    );
    if (created.status >= 400) {
      return existing || null;
    }
    return created.data?.hostname || created.data?.binding || created.data;
  }

  async attachHostname(projectId, bearerToken, body = {}) {
    const auth = { authorization: authHeader(bearerToken) };
    const hostname = String(body.hostname || this.composeHostname(body.subdomain, body.domain)).trim().toLowerCase();
    const service = this.originService(body.port, body.protocol);
    const port = String(body.port).trim();
    const previous = String(body.previous_hostname || '').trim().toLowerCase();
    const tun = await this.resolveNamedTunnel(projectId, bearerToken, body.tunnel_id);
    const cfId = tun.cf_tunnel_id || tun.id;
    if (previous && previous !== hostname) {
      await this.mergeTunnelIngress(projectId, auth, tun, { removeHostname: previous });
      const listed = await serviceManager().proxyServiceRequest(
        'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
      );
      const old = (listed.data?.hostnames || []).find((h) => String(h.hostname || '').toLowerCase() === previous);
      if (old?.id) {
        await serviceManager().proxyServiceRequest(
          'domain_manager', 'DELETE', `/api/v1/dns/hostnames/${encodeURIComponent(old.id)}`,
          null, {}, projectId, auth,
        ).catch(() => {});
      }
    }
    await this.mergeTunnelIngress(projectId, auth, tun, { hostname, service });
    const binding = await this.upsertHostnameRow(projectId, auth, {
      hostname,
      port,
      tunnelId: cfId,
      environment: body.environment,
      targetId: body.task_id || body.target_id || '',
    });
    return { hostname, port: Number(port), service, tunnel: cfId, binding };
  }

  async detachHostname(projectId, bearerToken, body = {}) {
    const auth = { authorization: authHeader(bearerToken) };
    const hostname = String(body.hostname || '').trim().toLowerCase();
    if (!hostname) {
      const e = new Error('hostname is required');
      e.status = 400;
      throw e;
    }
    const tun = await this.resolveNamedTunnel(projectId, bearerToken, body.tunnel_id);
    await this.mergeTunnelIngress(projectId, auth, tun, { removeHostname: hostname });
    const listed = await serviceManager().proxyServiceRequest(
      'domain_manager', 'GET', '/api/v1/dns/hostnames', null, {}, projectId, auth
    );
    const row = (listed.data?.hostnames || []).find((h) => String(h.hostname || '').toLowerCase() === hostname);
    if (row?.id) {
      await serviceManager().proxyServiceRequest(
        'domain_manager', 'DELETE', `/api/v1/dns/hostnames/${encodeURIComponent(row.id)}`,
        null, {}, projectId, auth,
      ).catch(() => {});
    }
    return { deleted: true, hostname, tunnel: tun.cf_tunnel_id || tun.id };
  }
}

module.exports = new EdgeService();
