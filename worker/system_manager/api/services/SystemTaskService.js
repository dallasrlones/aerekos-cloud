const { SystemTask } = require('../models');
class SystemTaskService {
  constructor() { this.M = SystemTask; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create(body);
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

  async run(id, projectId) {
    const axios = require('axios');
    const { conductorBase, authHeaders } = require('../../../shared/conductorProxy');
    const row = await this.get(id, projectId);
    let spec = {};
    try { spec = JSON.parse(row.spec_json || '{}'); } catch { spec = {}; }
    if (typeof spec !== 'object' || spec == null) spec = {};
    await this.M.update(id, { state: 'running' });
    const headers = authHeaders(projectId);
    const base = conductorBase();
    try {
      if (spec.image) {
        const res = await axios.post(`${base}/api/services/compute_manager/api/v1/tasks`, {
          project_id: projectId,
          name: `sys-${row.name}-${Date.now().toString(36)}`.slice(0, 64),
          image: spec.image,
          command: spec.command,
          run_mode: spec.run_mode || 'oneshot',
          env: spec.env || {},
        }, { headers, timeout: 60000, validateStatus: () => true });
        const ok = res.status < 400;
        spec.last_run = { status: res.status, at: new Date().toISOString(), task: res.data?.task || res.data };
        await this.M.update(id, { state: ok ? 'succeeded' : 'failed', spec_json: JSON.stringify(spec) });
      } else if (spec.url) {
        const res = await axios({
          method: spec.method || 'GET',
          url: spec.url,
          data: spec.body,
          timeout: Number(spec.timeout_ms || 30000),
          validateStatus: () => true,
          headers: { 'Content-Type': 'application/json', ...(spec.headers || {}) },
        });
        spec.last_run = { status: res.status, at: new Date().toISOString() };
        await this.M.update(id, { state: res.status < 400 ? 'succeeded' : 'failed', spec_json: JSON.stringify(spec) });
      } else {
        const e = new Error('spec_json needs image (compute_manager) or url');
        e.status = 400;
        throw e;
      }
    } catch (err) {
      if (err.status) {
        await this.M.update(id, { state: 'failed' });
        throw err;
      }
      spec.last_run = { error: err.message, at: new Date().toISOString() };
      await this.M.update(id, { state: 'failed', spec_json: JSON.stringify(spec) });
    }
    return this.get(id, projectId);
  }
}
module.exports = { SystemTaskService };
