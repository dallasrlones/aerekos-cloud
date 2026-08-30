'use strict';

const { AuditLog } = require('../models');

/**
 * Append-only audit trail for security-sensitive actions.
 */
class AuditService {
  async log(entry) {
    const row = await AuditLog.create({
      action: String(entry.action || 'unknown'),
      actor_type: entry.actor_type || 'system',
      actor_id: entry.actor_id || '',
      resource_type: entry.resource_type || '',
      resource_id: entry.resource_id || '',
      project_id: entry.project_id || '',
      ip_address: entry.ip_address || '',
      request_id: entry.request_id || '',
      outcome: entry.outcome || 'success',
      detail: entry.detail ? JSON.stringify(entry.detail) : '{}',
    });
    return row;
  }

  async list({ limit = 100, offset = 0, action, project_id } = {}) {
    const where = {};
    if (action) where.action = action;
    if (project_id) where.project_id = project_id;
    const rows = await AuditLog.findAll({
      where,
      limit: Math.min(limit, 500),
      offset,
    });
    const sorted = [...rows].sort((a, b) => {
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return tb - ta;
    });
    return sorted.map((r) => ({
      id: r.id,
      action: r.action,
      actor_type: r.actor_type,
      actor_id: r.actor_id,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      project_id: r.project_id,
      ip_address: r.ip_address,
      request_id: r.request_id,
      outcome: r.outcome,
      detail: (() => { try { return JSON.parse(r.detail || '{}'); } catch { return {}; } })(),
      created_at: r.created_at,
    }));
  }
}

module.exports = new AuditService();
