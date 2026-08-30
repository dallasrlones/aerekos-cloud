'use strict';

const { PlatformJob } = require('../models');

class JobService {
  async create({ project_id, kind, summary, detail, status } = {}) {
    return PlatformJob.create({
      project_id: project_id || '',
      kind: kind || 'generic',
      summary: summary || '',
      detail: detail || '',
      status: status || 'succeeded',
    });
  }

  async list({ project_id, limit } = {}) {
    const where = {};
    if (project_id) where.project_id = project_id;
    const rows = await PlatformJob.findAll(Object.keys(where).length ? { where } : {});
    const sorted = [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return sorted.slice(0, Math.min(Number(limit) || 20, 100));
  }

  async get(id) {
    const rows = await PlatformJob.findAll({ where: { id } });
    return rows[0] || null;
  }

  async del(id) {
    const row = await this.get(id);
    if (!row) return { deleted: false };
    await PlatformJob.delete(id);
    return { deleted: true, id };
  }
}

module.exports = new JobService();
