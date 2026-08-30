const { McpTool } = require('../models');
class McpToolService {
  constructor() { this.M = McpTool; }
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

  async invoke(id, projectId, args = {}) {
    const axios = require('axios');
    const row = await this.get(id, projectId);
    let schema = {};
    try { schema = JSON.parse(row.input_schema || '{}'); } catch { schema = {}; }
    const endpoint = args.endpoint || schema.endpoint || schema.url || '';
    if (!endpoint) {
      const e = new Error('tool needs input_schema.endpoint (http URL) to invoke');
      e.status = 400;
      throw e;
    }
    const res = await axios({
      method: schema.method || args.method || 'POST',
      url: endpoint,
      data: args.arguments || args.input || args,
      timeout: Number(schema.timeout_ms || 20000),
      validateStatus: () => true,
      headers: { 'Content-Type': 'application/json', ...(schema.headers || {}) },
    });
    return { tool: row, status: res.status, result: res.data };
  }
}
module.exports = { McpToolService };
