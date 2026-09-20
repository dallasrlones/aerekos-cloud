const { MetricSeries } = require('../models');
class MetricSeriesService {
  constructor() { this.M = MetricSeries; }
  assertP(p) { if (!p||!String(p).trim()){const e=new Error('project_id required');e.status=400;throw e;} }
  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name||'').trim();
    if (!name) { const e = new Error('name required'); e.status=400; throw e; }
    const d = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (d.length) { const e = new Error('name taken'); e.status=409; throw e; }
    return this.M.create(body);
  }

  async sample(body) {
    this.assertP(body.project_id);
    const name = String(body.name || '').trim();
    if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
    const existing = await this.M.findAll({ where: { project_id: body.project_id, name } });
    const patch = {
      metric_name: body.metric_name || name,
      value: String(body.value ?? '0'),
      labels: typeof body.labels === 'string' ? body.labels : JSON.stringify(body.labels || {}),
    };
    if (existing.length) {
      await this.M.update(existing[0].id, patch);
      return this.get(existing[0].id, body.project_id);
    }
    return this.M.create({ ...patch, project_id: body.project_id, name });
  }
  async list(projectId, { metric_name, task_id, limit } = {}) {
    this.assertP(projectId);
    const where = { project_id: projectId };
    if (metric_name) where.metric_name = metric_name;
    let rows = await this.M.findAll({ where });
    if (task_id) {
      rows = rows.filter((r) => {
        try {
          const labels = typeof r.labels === 'string' ? JSON.parse(r.labels || '{}') : (r.labels || {});
          return String(labels.task_id || '') === String(task_id);
        } catch {
          return String(r.name || '').includes(`/${task_id}/`);
        }
      });
    }
    rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
    return rows.slice(0, lim);
  }
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
}
module.exports = { MetricSeriesService };
