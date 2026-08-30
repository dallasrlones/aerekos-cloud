'use strict';

const { HostnameBinding } = require('../models');

class HostnameBindingService {
  constructor() {
    this.M = HostnameBinding;
  }

  assertP(p) {
    if (!p || !String(p).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  serialize(row) {
    return {
      id: row.id,
      project_id: row.project_id,
      hostname: row.hostname,
      target_type: row.target_type,
      target_id: row.target_id,
      port: row.port || 80,
      protocol: row.protocol || 'http',
      tunnel_id: row.tunnel_id || '',
      dns_record_id: row.dns_record_id || '',
      visibility: row.visibility || 'public',
      environment: row.environment || 'prod',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async create(body) {
    this.assertP(body.project_id);
    const hostname = String(body.hostname || '').trim().toLowerCase();
    if (!hostname) {
      const e = new Error('hostname required');
      e.status = 400;
      throw e;
    }
    const target_type = String(body.target_type || 'compute_task');
    if (!['compute_task', 'balancer', 'platform'].includes(target_type)) {
      const e = new Error('target_type must be compute_task, balancer, or platform');
      e.status = 400;
      throw e;
    }
    if (String(body.service || '').includes('db_manager') || target_type === 'database') {
      const e = new Error('public hostnames are denied for databases');
      e.status = 403;
      throw e;
    }
    const dup = await this.M.findAll({ where: { hostname } });
    if (dup.length) {
      const e = new Error(`hostname taken by project ${dup[0].project_id}`);
      e.status = 409;
      throw e;
    }
    let dns_record_id = String(body.dns_record_id || '');
    const tunnelId = String(body.tunnel_id || '');
    if (!dns_record_id && tunnelId && process.env.CLOUDFLARE_ZONE_ID && process.env.SKIP_CLOUDFLARE !== '1') {
      try {
        const { DnsRecordService } = require('./DnsRecordService');
        const dns = new DnsRecordService();
        const rec = await dns.create({
          project_id: body.project_id,
          zone_id: process.env.CLOUDFLARE_ZONE_ID,
          name: hostname,
          record_type: 'CNAME',
          content: `${tunnelId}.cfargotunnel.com`,
        });
        dns_record_id = rec.id || rec.cf_id || '';
      } catch (e) {
        const err = new Error(`DNS create failed: ${e.message}`);
        err.status = 502;
        throw err;
      }
    }
    const row = await this.M.create({
      project_id: body.project_id,
      hostname,
      target_type,
      target_id: String(body.target_id || ''),
      port: body.port == null ? 80 : Number(body.port),
      protocol: body.protocol || 'http',
      tunnel_id: tunnelId,
      dns_record_id,
      visibility: 'public',
      environment: String(body.environment || 'prod'),
    });
    return this.serialize(row);
  }

  async list(projectId) {
    this.assertP(projectId);
    return (await this.M.findAll({ where: { project_id: projectId } })).map((r) => this.serialize(r));
  }

  async del(id, projectId) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    await this.M.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { HostnameBindingService };
