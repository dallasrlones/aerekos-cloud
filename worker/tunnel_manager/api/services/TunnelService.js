const { randomUUID } = require('crypto');
const { Tunnel } = require('../models');
const { CloudflareTunnelClient } = require('./CloudflareTunnelClient');

const NAME_RE = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/i;

class TunnelService {
  constructor(deps = {}) {
    this.Tunnel = deps.Tunnel || Tunnel;
    this.client = deps.client || new CloudflareTunnelClient();
  }

  getAccountId() {
    return process.env.CLOUDFLARE_ACCOUNT_ID;
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  assertAccountId() {
    const id = this.getAccountId();
    if (!id) {
      const e = new Error('CLOUDFLARE_ACCOUNT_ID is required to manage tunnels');
      e.status = 503;
      e.code = 'ACCOUNT_ID_MISSING';
      throw e;
    }
    return String(id);
  }

  isSkip() {
    return process.env.SKIP_CLOUDFLARE === '1' || process.env.SKIP_CLOUDFLARE === 'true';
  }

  validateName(name) {
    if (!name || typeof name !== 'string' || !NAME_RE.test(String(name).trim())) {
      const e = new Error(
        'name: use 1-64 chars, letters, numbers, hyphens; must start and end with alphanumeric'
      );
      e.status = 400;
      throw e;
    }
    return String(name).trim();
  }

  /**
   * Create tunnel in Cloudflare and persist a row. Returns token once (never stored in DB).
   */
  async create(body) {
    this.assertProjectId(body.project_id);
    const name = this.validateName(body.name);
    const existing = await this.Tunnel.findAll({ where: { project_id: body.project_id, name } });
    if (existing.length) {
      const e = new Error(`A tunnel named "${name}" already exists in this project`);
      e.status = 409;
      e.code = 'TUNNEL_NAME_TAKEN';
      throw e;
    }

    if (this.isSkip()) {
      const id = `cf-tunnel-mock-${randomUUID()}`;
      const token = `mock-tunnel-token-${randomUUID()}`;
      const row = await this.Tunnel.create({
        project_id: body.project_id,
        name,
        cf_tunnel_id: id,
        cf_status: 'inactive',
        last_error: ''
      });
      return { tunnel: row, token, credentials_file: null };
    }

    const accountId = this.assertAccountId();
    const result = await this.client.createTunnel(accountId, { name, config_src: 'cloudflare' });
    const row = await this.Tunnel.create({
      project_id: body.project_id,
      name: result.name || name,
      cf_tunnel_id: result.id,
      cf_status: result.status || 'inactive',
      last_error: ''
    });
    return {
      tunnel: row,
      token: result.token || null,
      credentials_file: result.credentials_file || null
    };
  }

  async list(projectId) {
    this.assertProjectId(projectId);
    return this.Tunnel.findAll({ where: { project_id: projectId } });
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    let rows = await this.Tunnel.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) rows = await this.Tunnel.findAll({ where: { cf_tunnel_id: id, project_id: projectId } });
    if (!rows.length) rows = await this.Tunnel.findAll({ where: { id } });
    if (!rows.length) rows = await this.Tunnel.findAll({ where: { cf_tunnel_id: id } });
    if (!rows.length) {
      const e = new Error('Tunnel not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  /**
   * Remove from Cloudflare and local DB. Does not return tokens.
   */
  async deleteById(id, projectId) {
    const row = await this.getById(id, projectId);
    if (this.isSkip()) {
      await this.Tunnel.delete(id);
      return { deleted: true, id };
    }
    const accountId = this.assertAccountId();
    await this.client.deleteTunnel(accountId, row.cf_tunnel_id);
    await this.Tunnel.delete(id);
    return { deleted: true, id };
  }

  parseIngress(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.ingress)) return raw.ingress;
    if (typeof raw === 'string' && raw.trim()) {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : (p.ingress || []);
    }
    return [];
  }

  async getIngress(id, projectId) {
    const row = await this.getById(id, projectId);
    let ingress = [];
    try {
      ingress = this.parseIngress(row.ingress_config || row.ingress_json);
    } catch {
      ingress = [];
    }
    if (!this.isSkip() && row.cf_tunnel_id && process.env.CLOUDFLARE_ACCOUNT_ID) {
      try {
        const live = await this.client.getIngress(process.env.CLOUDFLARE_ACCOUNT_ID, row.cf_tunnel_id);
        if (Array.isArray(live) && live.length) ingress = live;
      } catch (e) {
        if (!ingress.length) {
          const err = new Error(`Cloudflare ingress read failed: ${e.message}`);
          err.status = 502;
          throw err;
        }
      }
    }
    return { tunnel_id: row.id, ingress, ingress_rules: ingress.length, cname_target: `${row.cf_tunnel_id}.cfargotunnel.com` };
  }

  mergeRules(existing, hostname, service) {
    const rules = Array.isArray(existing) ? existing.filter((r) => r && (r.hostname || r.service)) : [];
    const withoutCatch = rules.filter((r) => r.hostname && r.service !== 'http_status:404');
    const next = withoutCatch.filter((r) => String(r.hostname).toLowerCase() !== String(hostname).toLowerCase());
    if (hostname && service) next.push({ hostname, service });
    const keptCatch = rules.find((r) => !r.hostname && String(r.service || '').includes('http_status'));
    next.push(keptCatch || { service: 'http_status:404' });
    return next;
  }

  async mergeIngress(id, projectId, { hostname, service, removeHostname }) {
    const current = await this.getIngress(id, projectId);
    let rules = current.ingress || [];
    if (removeHostname) {
      rules = this.mergeRules(rules.filter((r) => String(r.hostname || '').toLowerCase() !== String(removeHostname).toLowerCase()), null, null);
    } else {
      rules = this.mergeRules(rules, hostname, service);
    }
    return this.setIngress(id, projectId, rules);
  }

  async setIngress(id, projectId, ingress) {
    const row = await this.getById(id, projectId);
    const rules = this.parseIngress(ingress);
    await this.Tunnel.update(id, { ingress_config: JSON.stringify(rules) });
    if (!this.isSkip() && row.cf_tunnel_id && process.env.CLOUDFLARE_ACCOUNT_ID) {
      try {
        await this.client.putIngress(process.env.CLOUDFLARE_ACCOUNT_ID, row.cf_tunnel_id, rules);
      } catch (e) {
        const err = new Error(`Cloudflare ingress push failed: ${e.message}`);
        err.status = 502;
        throw err;
      }
    }
    return this.getIngress(id, projectId);
  }

  async adoptKnown(projectId, known = []) {
    this.assertProjectId(projectId);
    const adopted = [];
    for (const k of known) {
      if (!k.cf_tunnel_id) continue;
      const existing = await this.Tunnel.findAll({ where: { cf_tunnel_id: k.cf_tunnel_id } });
      if (existing.length) {
        await this.Tunnel.update(existing[0].id, {
          display_name: k.display_name || existing[0].display_name || '',
          device_hostname: k.device_hostname || existing[0].device_hostname || '',
          origin_mode: k.origin_mode || existing[0].origin_mode || 'host',
        }).catch(() => {});
        adopted.push({ ...existing[0], ...k, id: existing[0].id });
        continue;
      }
      const row = await this.Tunnel.create({
        project_id: projectId,
        name: k.display_name || k.name || k.cf_tunnel_id,
        cf_tunnel_id: k.cf_tunnel_id,
        cf_status: 'healthy',
        last_error: '',
        display_name: k.display_name || '',
        device_hostname: k.device_hostname || '',
        origin_mode: k.origin_mode || 'host',
      });
      adopted.push({ ...k, id: row.id });
    }
    return { adopted };
  }

  async importFromCloudflare(projectId) {
    this.assertProjectId(projectId);
    if (this.isSkip()) {
      return { imported: 0, skipped: true };
    }
    const accountId = this.assertAccountId();
    const remote = await this.client.listTunnels(accountId);
    let imported = 0;
    for (const t of remote) {
      const existing = await this.Tunnel.findAll({ where: { project_id: projectId, cf_tunnel_id: t.id } });
      if (existing.length) continue;
      await this.Tunnel.create({
        project_id: projectId,
        name: t.name || t.id,
        cf_tunnel_id: t.id,
        cf_status: t.status || 'unknown',
        last_error: '',
      });
      imported += 1;
    }
    return { imported, total_remote: remote.length };
  }

  async reconcile(projectId) {
    this.assertProjectId(projectId);
    const list = await this.list(projectId);
    return { reconciled: list.length };
  }
}

module.exports = { TunnelService };
