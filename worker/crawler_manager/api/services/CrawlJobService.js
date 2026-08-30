const { CrawlJob } = require('../models');
class CrawlJobService {
  constructor() { this.M = CrawlJob; }
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
    const row = await this.get(id, projectId);
    const url = String(row.start_url || '').trim();
    if (!url) {
      const e = new Error('start_url required');
      e.status = 400;
      throw e;
    }
    if (process.env.SKIP_CRAWL === '1' || process.env.SKIP_CRAWL === 'true') {
      await this.M.update(id, { state: 'done', result_summary: JSON.stringify({ skipped: true, url }) });
      return this.get(id, projectId);
    }
    await this.M.update(id, { state: 'running' });
    const started = Date.now();
    try {
      const r0 = await axios.get(url, { timeout: 15000, maxRedirects: 5, validateStatus: () => true, maxContentLength: 2 * 1024 * 1024 });
      const html = typeof r0.data === 'string' ? r0.data : '';
      const title = (html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '';
      const summary = JSON.stringify({
        status: r0.status,
        ms: Date.now() - started,
        bytes: Buffer.byteLength(html),
        title: String(title).trim().slice(0, 200),
        url,
      });
      await this.M.update(id, { state: r0.status < 500 ? 'done' : 'failed', result_summary: summary.slice(0, 4000) });
    } catch (err) {
      await this.M.update(id, { state: 'failed', result_summary: JSON.stringify({ error: err.message, url }) });
    }
    return this.get(id, projectId);
  }
}
module.exports = { CrawlJobService };
