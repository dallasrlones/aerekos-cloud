const { randomUUID } = require('crypto');
const { DnsRecord } = require('../models');
const { CloudflareDnsClient } = require('./CloudflareDnsClient');

function isValidType(type) {
  return typeof type === 'string' && /^[A-Z0-9_]{1,20}$/i.test(type);
}

class DnsRecordService {
  constructor(deps = {}) {
    this.DnsRecord = deps.DnsRecord || DnsRecord;
    this.client = deps.client || new CloudflareDnsClient();
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  assertZoneId(zoneId) {
    if (!zoneId) {
      const e = new Error('zone_id is required');
      e.status = 400;
      throw e;
    }
  }

  isSkip() {
    return process.env.SKIP_CLOUDFLARE === '1' || process.env.SKIP_CLOUDFLARE === 'true';
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    this.assertZoneId(body.zone_id);
    if (!body.name || !body.record_type || !body.content) {
      const e = new Error('name, record_type, content are required');
      e.status = 400;
      throw e;
    }
    const type = String(body.record_type).toUpperCase();
    if (!isValidType(type)) {
      const e = new Error('record_type: use letters, numbers, underscore (1-20 chars), e.g. A, CNAME, TXT');
      e.status = 400;
      throw e;
    }

    if (this.isSkip()) {
      const id = `cf-mock-${randomUUID()}`;
      return this.DnsRecord.create({
        project_id: body.project_id,
        zone_id: body.zone_id,
        record_name: body.name,
        record_type: type,
        content: String(body.content),
        ttl: Number(body.ttl) || 1,
        proxied: body.proxied ? 1 : 0,
        cf_record_id: id,
        last_error: ''
      });
    }

    const result = await this.client.createRecord(body.zone_id, {
      name: body.name,
      type,
      content: String(body.content),
      ttl: body.ttl,
      proxied: body.proxied
    });

    return this.DnsRecord.create({
      project_id: body.project_id,
      zone_id: body.zone_id,
      record_name: result.name,
      record_type: result.type,
      content: result.content,
      ttl: result.ttl,
      proxied: result.proxied ? 1 : 0,
      cf_record_id: result.id,
      last_error: ''
    });
  }

  async list(projectId, zoneId) {
    this.assertProjectId(projectId);
    this.assertZoneId(zoneId);
    return this.DnsRecord.findAll({ where: { project_id: projectId, zone_id: zoneId } });
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.DnsRecord.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Record not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async update(id, projectId, body) {
    const row = await this.getById(id, projectId);
    const zoneId = row.zone_id;
    const patch = {};
    if (body.content != null) patch.content = String(body.content);
    if (body.ttl != null) patch.ttl = Number(body.ttl);
    if (body.proxied != null) patch.proxied = body.proxied;
    if (Object.keys(patch).length === 0) {
      return row;
    }
    if (this.isSkip()) {
      return this._mergeUpdate(row, patch);
    }
    const cf = await this.client.updateRecord(zoneId, row.cf_record_id, {
      type: row.record_type,
      name: row.record_name,
      content: patch.content != null ? patch.content : row.content,
      ttl: patch.ttl != null ? patch.ttl : row.ttl,
      proxied: patch.proxied != null ? !!patch.proxied : !!row.proxied
    });
    return this._mergeUpdate(row, {
      content: cf.content,
      ttl: cf.ttl,
      proxied: cf.proxied ? 1 : 0
    });
  }

  async _mergeUpdate(row, fields) {
    const next = {
      content: fields.content != null ? fields.content : row.content,
      ttl: fields.ttl != null ? fields.ttl : row.ttl,
      proxied: fields.proxied != null ? fields.proxied : row.proxied
    };
    await this.DnsRecord.update(row.id, next);
    return this.getById(row.id, row.project_id);
  }

  async deleteById(id, projectId) {
    const row = await this.getById(id, projectId);
    if (!this.isSkip()) {
      await this.client.deleteRecord(row.zone_id, row.cf_record_id);
    }
    await this.DnsRecord.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { DnsRecordService };
