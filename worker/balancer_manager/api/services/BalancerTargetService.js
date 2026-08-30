'use strict';

const { BalancerTarget } = require('../models');

async function probeAddress(address, path) {
  const base = String(address || '').replace(/\/$/, '');
  const p = path && path.startsWith('/') ? path : `/${path || 'health'}`;
  if (!base.startsWith('http')) {
    return { healthy: false, status: 0, error: 'address must be http(s)' };
  }
  const url = `${base}${p}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    return { healthy: res.ok, status: res.status, url };
  } catch (err) {
    clearTimeout(t);
    return { healthy: false, status: 0, error: err.message, url };
  }
}

class BalancerTargetService {
  constructor() { this.M = BalancerTarget; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create({
      ...body,
      health_check_path: body.health_check_path || '/health',
      health_check_interval: body.health_check_interval == null ? 15 : Number(body.health_check_interval),
      healthy: 0,
      desired: body.desired == null ? 1 : Number(body.desired),
    });
  }
  async list(projectId) { this.assertP(projectId); return this.M.findAll({ where: { project_id: projectId } }); }
  async get(id, projectId) { this.assertP(projectId); const r = await this.M.findAll({ where: { id, project_id: projectId } }); if (!r.length){const e=new Error('Not found');e.status=404;throw e;} return r[0]; }
  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id; delete patch.project_id; delete patch.created_at; delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }
  async del(id, projectId) { await this.get(id, projectId); await this.M.delete(id); return { deleted:true, id }; }

  async probeOne(id, projectId) {
    const row = await this.get(id, projectId);
    const skip = process.env.SKIP_HEALTH === '1' || process.env.SKIP_DOCKER === '1';
    const result = skip
      ? { healthy: true, status: 200, skipped: true }
      : await probeAddress(row.address, row.health_check_path || '/health');
    await this.M.update(id, {
      healthy: result.healthy ? 1 : 0,
      last_health: JSON.stringify({ ...result, at: new Date().toISOString() }),
    });
    const updated = await this.get(id, projectId);
    return { ...updated, probe: result };
  }

  async healthSummary(projectId, { id, pool } = {}) {
    this.assertP(projectId);
    let rows = await this.list(projectId);
    if (id) rows = rows.filter((r) => String(r.id) === String(id));
    if (pool) rows = rows.filter((r) => String(r.pool) === String(pool));
    const probed = [];
    for (const row of rows) {
      probed.push(await this.probeOne(row.id, projectId));
    }
    const healthy_host_count = probed.filter((p) => p.healthy === 1 || p.probe?.healthy).length;
    return { items: probed, healthy_host_count, total: probed.length };
  }
}
module.exports = { BalancerTargetService };
