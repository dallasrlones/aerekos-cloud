'use strict';

const { IntelligenceEndpoint, IntelligenceAttachment } = require('../models');
const { AiProviderService } = require('./AiProviderService');
const { RagCollectionService } = require('./RagCollectionService');
const { MemoryStoreService } = require('./MemoryStoreService');
const { buildEndpointArn, enrichEndpoint } = require('./EndpointArn');
const { isValidName } = require('../../../shared/arn');

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

function flag(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  return truthy(v) ? 'true' : 'false';
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

class IntelligenceService {
  constructor(deps = {}) {
    this.M = IntelligenceEndpoint;
    this.A = IntelligenceAttachment;
    this.providers = deps.providers || new AiProviderService();
    this.rag = deps.rag || new RagCollectionService();
    this.memory = deps.memory || new MemoryStoreService();
  }

  assertP(p) {
    if (!p || !String(p).trim()) throw fail(400, 'project_id required');
  }

  async provisionInbox(projectId, inbox) {
    const { proxy } = require('../../../shared/conductorProxy');
    const dlq = inbox.endsWith('-inbox') ? inbox.replace(/-inbox$/, '-dlq') : `${inbox}-dlq`;
    const r = await proxy('POST', '/api/services/queue_manager/api/v1/queues', {
      projectId,
      timeout: 10000,
      data: { project_id: projectId, name: inbox, engine: 'rabbitmq', dlq, visibility_timeout_seconds: 3600 },
    });
    if (r.status >= 400 && r.status !== 409) {
      const e = new Error(r.data?.error?.message || `queue provision ${r.status}`);
      e.status = r.status >= 400 ? r.status : 502;
      throw e;
    }
    await proxy('POST', '/api/services/queue_manager/api/v1/queues', {
      projectId,
      timeout: 10000,
      data: { project_id: projectId, name: dlq, engine: 'rabbitmq' },
    }).catch(() => {});
  }

  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name || '').trim();
    if (!isValidName(name)) throw fail(400, 'name must be lowercase alphanumeric with hyphens');
    const dup = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (dup.length) throw fail(409, 'name taken');
    const llm = String(body.llm_integration || '').trim();
    if (llm) await this.providers.getByName(body.project_id, llm, 'llm');
    if (truthy(body.is_default)) await this.clearOtherDefaults(body.project_id);
    const data = {
      project_id: body.project_id,
      name,
      description: String(body.description || ''),
      llm_integration: llm,
      inject_memory: flag(body.inject_memory, 'true'),
      inject_rag: flag(body.inject_rag, 'true'),
      ingest_on_chat: flag(body.ingest_on_chat, 'true'),
      is_default: truthy(body.is_default) ? 'true' : 'false',
      enabled: flag(body.enabled, 'true'),
      options: typeof body.options === 'object' ? JSON.stringify(body.options) : String(body.options || ''),
      arn: buildEndpointArn(body.project_id, 'intelligence', name),
      balancer_id: String(body.balancer_id || ''),
      model: String(body.model || '').trim(),
      execution: body.execution === 'queued' ? 'queued' : 'sync',
      queue_name: String(body.queue_name || (body.execution === 'queued' ? `${name}-inbox` : '')),
    };
    const row = await this.M.create(data);
    const saved = Array.isArray(row) ? row[0] : row;
    const ragNames = Array.isArray(body.rag) ? body.rag : [];
    const memoryNames = Array.isArray(body.memory) ? body.memory : (body.memory_store ? [body.memory_store] : []);
    for (const n of ragNames) await this.attach(saved.id, body.project_id, { kind: 'rag', target_name: n });
    for (const n of memoryNames) await this.attach(saved.id, body.project_id, { kind: 'memory', target_name: n });
    const loraNames = Array.isArray(body.lora) ? body.lora : [];
    for (const n of loraNames) await this.attach(saved.id, body.project_id, { kind: 'lora', target_name: n });
    if (data.execution === 'queued') {
      await this.provisionInbox(body.project_id, data.queue_name || `${name}-inbox`);
    }
    return this.get(saved.id, body.project_id);
  }

  async clearOtherDefaults(projectId, exceptId) {
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    for (const row of rows) {
      if (exceptId && String(row.id) === String(exceptId)) continue;
      if (truthy(row.is_default)) await this.M.update(row.id, { is_default: 'false' });
    }
  }

  async list(projectId) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    return Promise.all(rows.map((row) => this.enrich(row, projectId)));
  }

  async get(id, projectId) {
    this.assertP(projectId);
    const r = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!r.length) throw fail(404, 'Not found');
    return this.enrich(r[0], projectId);
  }

  async getByName(projectId, name) {
    this.assertP(projectId);
    const r = await this.M.findAll({ where: { project_id: projectId, name: String(name).trim() } });
    if (!r.length) throw fail(404, `Intelligence endpoint "${name}" not found`);
    return this.enrich(r[0], projectId);
  }

  async getDefault(projectId) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    const enabled = rows.filter((r) => r.enabled !== 'false');
    const def = enabled.find((r) => truthy(r.is_default));
    const pick = def || enabled[0] || null;
    return pick ? this.enrich(pick, projectId) : null;
  }

  async update(id, projectId, body) {
    const cur = await this.get(id, projectId);
    const patch = {};
    if (body.description !== undefined) patch.description = String(body.description || '');
    if (body.llm_integration !== undefined) {
      const llm = String(body.llm_integration || '').trim();
      if (llm) await this.providers.getByName(projectId, llm, 'llm');
      patch.llm_integration = llm;
    }
    if (body.inject_memory !== undefined) patch.inject_memory = flag(body.inject_memory, cur.inject_memory);
    if (body.inject_rag !== undefined) patch.inject_rag = flag(body.inject_rag, cur.inject_rag);
    if (body.ingest_on_chat !== undefined) patch.ingest_on_chat = flag(body.ingest_on_chat, cur.ingest_on_chat);
    if (body.enabled !== undefined) patch.enabled = flag(body.enabled, cur.enabled);
    if (body.is_default !== undefined) {
      patch.is_default = truthy(body.is_default) ? 'true' : 'false';
      if (truthy(patch.is_default)) await this.clearOtherDefaults(projectId, id);
    }
    if (body.options !== undefined) {
      patch.options = typeof body.options === 'object' ? JSON.stringify(body.options) : String(body.options || '');
    }
    if (body.balancer_id !== undefined) patch.balancer_id = String(body.balancer_id || '');
    if (body.model !== undefined) patch.model = String(body.model || '').trim();
    if (body.execution !== undefined) {
      patch.execution = body.execution === 'queued' ? 'queued' : 'sync';
      if (patch.execution === 'queued' && !cur.queue_name && body.queue_name === undefined) {
        patch.queue_name = `${cur.name}-inbox`;
      }
    }
    if (body.queue_name !== undefined) patch.queue_name = String(body.queue_name || '');
    if ((patch.execution || cur.execution) === 'queued') {
      try {
        await this.provisionInbox(projectId, patch.queue_name || cur.queue_name || `${cur.name}-inbox`);
      } catch (e) {
        if (e.status && e.status >= 500) throw e;
      }
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!isValidName(name)) throw fail(400, 'name must be lowercase alphanumeric with hyphens');
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) throw fail(409, 'name taken');
      patch.name = name;
      patch.arn = buildEndpointArn(projectId, 'intelligence', name);
      if (name !== cur.name) {
        const atts = await this.A.findAll({ where: { project_id: projectId, intelligence_name: cur.name } });
        for (const a of atts) await this.A.update(a.id, { intelligence_name: name });
      }
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    if (Array.isArray(body.rag) || Array.isArray(body.memory) || Array.isArray(body.lora)) {
      await this.replaceAttachments(projectId, patch.name || cur.name, body);
    }
    return this.get(id, projectId);
  }

  async replaceAttachments(projectId, intelligenceName, body) {
    const existing = await this.A.findAll({ where: { project_id: projectId, intelligence_name: intelligenceName } });
    if (Array.isArray(body.rag)) {
      for (const a of existing.filter((x) => x.kind === 'rag')) await this.A.delete(a.id);
      for (const n of body.rag) {
        await this._attachRow(projectId, intelligenceName, { kind: 'rag', target_name: n });
      }
    }
    if (Array.isArray(body.memory)) {
      for (const a of existing.filter((x) => x.kind === 'memory')) await this.A.delete(a.id);
      for (const n of body.memory) {
        await this._attachRow(projectId, intelligenceName, { kind: 'memory', target_name: n });
      }
    }
    if (Array.isArray(body.lora)) {
      for (const a of existing.filter((x) => x.kind === 'lora')) await this.A.delete(a.id);
      for (const n of body.lora) {
        await this._attachRow(projectId, intelligenceName, { kind: 'lora', target_name: n });
      }
    }
  }

  async del(id, projectId) {
    const cur = await this.get(id, projectId);
    const atts = await this.A.findAll({ where: { project_id: projectId, intelligence_name: cur.name } });
    for (const a of atts) await this.A.delete(a.id);
    await this.M.delete(id);
    return { deleted: true, id };
  }

  async attach(id, projectId, body) {
    const cur = await this.get(id, projectId);
    return this._attachRow(projectId, cur.name, body);
  }

  async _attachRow(projectId, intelligenceName, body) {
    const kind = String(body.kind || '').trim().toLowerCase();
    const target = String(body.target_name || body.name || '').trim();
    if (!['rag', 'memory', 'lora'].includes(kind)) throw fail(400, 'kind must be rag, memory, or lora');
    if (!isValidName(target)) throw fail(400, 'target_name required');
    if (kind === 'rag') await this.rag.getByName(projectId, target);
    if (kind === 'memory') {
      const mem = await this.memory.getConfig(projectId, target);
      if (!mem) throw fail(404, `Memory store "${target}" not found`);
    }
    if (kind === 'lora') {
      /* adapter catalog is file-backed; attach is allowed if name/id provided */
    }
    const existing = await this.A.findAll({
      where: { project_id: projectId, intelligence_name: intelligenceName, kind, target_name: target },
    });
    if (existing.length) {
      await this.A.update(existing[0].id, {
        enabled: flag(body.enabled, 'true'),
        priority: String(body.priority ?? existing[0].priority ?? '100'),
      });
      return this.getByName(projectId, intelligenceName);
    }
    await this.A.create({
      project_id: projectId,
      intelligence_name: intelligenceName,
      kind,
      target_name: target,
      priority: String(body.priority ?? 100),
      enabled: flag(body.enabled, 'true'),
    });
    return this.getByName(projectId, intelligenceName);
  }

  async detach(id, projectId, body) {
    const cur = await this.get(id, projectId);
    const kind = String(body.kind || '').trim().toLowerCase();
    const target = String(body.target_name || body.name || '').trim();
    const rows = await this.A.findAll({
      where: { project_id: projectId, intelligence_name: cur.name, kind, target_name: target },
    });
    for (const a of rows) await this.A.delete(a.id);
    return this.get(id, projectId);
  }

  async enrich(row, projectId) {
    const base = enrichEndpoint({ ...row, capability: 'intelligence', project_id: projectId });
    const atts = await this.A.findAll({ where: { project_id: projectId, intelligence_name: row.name } });
    const rag = [];
    const memory = [];
    const lora = [];
    for (const a of atts.filter((x) => x.enabled !== 'false').sort((a, b) => Number(a.priority || 100) - Number(b.priority || 100))) {
      const item = { name: a.target_name, priority: Number(a.priority || 100), enabled: a.enabled !== 'false' };
      if (a.kind === 'rag') rag.push(item);
      if (a.kind === 'memory') memory.push(item);
      if (a.kind === 'lora') lora.push(item);
    }
    return {
      ...base,
      llm_integration: row.llm_integration || '',
      inject_memory: row.inject_memory !== 'false',
      inject_rag: row.inject_rag !== 'false',
      ingest_on_chat: row.ingest_on_chat !== 'false',
      balancer_id: row.balancer_id || '',
      model: row.model || '',
      execution: row.execution || 'sync',
      queue_name: row.queue_name || '',
      rag,
      memory,
      lora,
    };
  }
}

module.exports = { IntelligenceService };
