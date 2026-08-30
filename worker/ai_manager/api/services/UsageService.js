'use strict';

const { IntelligenceUsage } = require('../models');

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

function estimateTokens(messages, result) {
  const reply = result?.message?.content || result?.response || result?.text || '';
  const prompt = Array.isArray(messages)
    ? messages.map((m) => String(m?.content || '')).join(' ')
    : '';
  const prompt_tokens = Math.max(1, Math.ceil(String(prompt).length / 4));
  const completion_tokens = Math.max(0, Math.ceil(String(reply).length / 4));
  return { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens };
}

class UsageService {
  constructor() {
    this.M = IntelligenceUsage;
  }

  assertP(p) {
    if (!p || !String(p).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  async record(body) {
    this.assertP(body.project_id);
    const row = await this.M.create({
      project_id: body.project_id,
      endpoint_name: String(body.endpoint_name || ''),
      user_id: String(body.user_id || ''),
      session_id: String(body.session_id || ''),
      model: String(body.model || ''),
      prompt_tokens: Number(body.prompt_tokens || 0),
      completion_tokens: Number(body.completion_tokens || 0),
      total_tokens: Number(body.total_tokens || 0),
      latency_ms: Number(body.latency_ms || 0),
    });
    return row;
  }

  async purgeExpired(projectId) {
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const where = projectId ? { project_id: projectId } : {};
    const rows = await this.M.findAll({ where });
    let deleted = 0;
    for (const row of rows) {
      const created = row.created_at || '';
      if (created && created < cutoff) {
        await this.M.delete(row.id);
        deleted += 1;
      }
    }
    return { deleted };
  }

  async list(projectId, { user_id, endpoint_name, limit = 50, offset = 0 } = {}) {
    this.assertP(projectId);
    await this.purgeExpired(projectId);
    let rows = await this.M.findAll({ where: { project_id: projectId } });
    if (user_id) rows = rows.filter((r) => String(r.user_id) === String(user_id));
    if (endpoint_name) rows = rows.filter((r) => String(r.endpoint_name) === String(endpoint_name));
    rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const total = rows.length;
    const lim = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const off = Math.max(0, parseInt(offset, 10) || 0);
    return {
      items: rows.slice(off, off + lim),
      total,
      limit: lim,
      offset: off,
    };
  }

  async delForProject(projectId) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    for (const row of rows) await this.M.delete(row.id);
    return { deleted: rows.length };
  }
}

module.exports = { UsageService, estimateTokens };
