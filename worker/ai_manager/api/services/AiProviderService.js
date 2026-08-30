const { AiModelConfig } = require('../models');
const { buildEndpointArn, enrichEndpoint } = require('./EndpointArn');

const CAPABILITIES = ['llm', 'tts', 'stt', 'embeddings'];
const PROVIDER_TYPES = {
  llm: ['ollama', 'vllm'],
  embeddings: ['ollama'],
  tts: ['cache', 'kokoro', 'xtts'],
  stt: ['whisper'],
};

const DEFAULT_ENDPOINTS = {
  ollama: process.env.OLLAMA_HOST || 'http://host.docker.internal:11434',
  vllm: process.env.VLLM_HOST || 'http://host.docker.internal:8000',
  cache: process.env.TTS_CACHE_URL || 'http://host.docker.internal:8015',
  kokoro: process.env.TTS_KOKORO_URL || 'http://host.docker.internal:8013',
  xtts: process.env.TTS_XTTS_URL || 'http://host.docker.internal:8002',
  whisper: process.env.STT_URL || 'http://host.docker.internal:8001',
};

function truthy(v) {
  return v === true || v === 'true' || v === '1' || v === 1;
}

class AiProviderService {
  constructor() { this.M = AiModelConfig; }

  assertP(p) {
    if (!p || !String(p).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  validate(body, isCreate) {
    if (isCreate && !String(body.name || '').trim()) {
      const e = new Error('name required');
      e.status = 400;
      throw e;
    }
    if (body.capability !== undefined || isCreate) {
      const cap = String(body.capability || 'llm').trim().toLowerCase();
      if (!CAPABILITIES.includes(cap)) {
        const e = new Error(`capability must be one of: ${CAPABILITIES.join(', ')}`);
        e.status = 400;
        throw e;
      }
      body.capability = cap;
    }
    const cap = body.capability || 'llm';
    if (body.provider !== undefined || isCreate) {
      const ptype = String(body.provider || PROVIDER_TYPES[cap][0]).trim().toLowerCase();
      const allowed = PROVIDER_TYPES[cap] || [];
      if (!allowed.includes(ptype)) {
        const e = new Error(`provider must be one of: ${allowed.join(', ')} for ${cap}`);
        e.status = 400;
        throw e;
      }
      body.provider = ptype;
    }
    const ptype = body.provider || PROVIDER_TYPES[cap][0];
    if (body.options && typeof body.options === 'object') {
      body.options = JSON.stringify(body.options);
    }
    if (body.is_default !== undefined) body.is_default = truthy(body.is_default) ? 'true' : 'false';
    if (body.enabled !== undefined) body.enabled = truthy(body.enabled) ? 'true' : 'false';
    if (isCreate && body.enabled === undefined) body.enabled = 'true';
    if (body.endpoint !== undefined || isCreate) {
      if (!body.endpoint || !String(body.endpoint).trim()) {
        body.endpoint = (DEFAULT_ENDPOINTS[ptype] || '').replace(/\/$/, '');
      } else {
        body.endpoint = String(body.endpoint).trim().replace(/\/$/, '');
      }
      if (!body.endpoint) {
        const e = new Error('endpoint is required');
        e.status = 400;
        throw e;
      }
    }
    return body;
  }

  async clearOtherDefaults(projectId, capability, exceptId) {
    const rows = await this.M.findAll({ where: { project_id: projectId, capability } });
    for (const row of rows) {
      if (exceptId && String(row.id) === String(exceptId)) continue;
      if (truthy(row.is_default)) await this.M.update(row.id, { is_default: 'false' });
    }
  }

  async create(body) {
    this.assertP(body.project_id);
    const data = this.validate({ ...body }, true);
    const name = String(data.name).trim();
    const dup = await this.M.findAll({ where: { project_id: data.project_id, name } });
    if (dup.length) { const e = new Error('name taken'); e.status = 409; throw e; }
    if (truthy(data.is_default)) await this.clearOtherDefaults(data.project_id, data.capability);
    data.arn = buildEndpointArn(data.project_id, data.capability, name);
    const row = await this.M.create(data);
    const saved = Array.isArray(row) ? row[0] : row;
    return enrichEndpoint({ ...saved, capability: data.capability, project_id: data.project_id, name });
  }

  async ensureArn(row) {
    if (!row || row.arn) return enrichEndpoint(row);
    const updated = await this.M.update(row.id, {
      arn: buildEndpointArn(row.project_id, row.capability || 'llm', row.name),
    });
    const fresh = updated || (await this.M.findAll({ where: { id: row.id } }))[0];
    return enrichEndpoint(fresh || row);
  }

  async list(projectId, capability) {
    this.assertP(projectId);
    const where = { project_id: projectId };
    if (capability) where.capability = String(capability).trim().toLowerCase();
    const rows = await this.M.findAll({ where });
    return Promise.all(rows.map((row) => this.ensureArn(row)));
  }

  async get(id, projectId) {
    this.assertP(projectId);
    const r = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!r.length) { const e = new Error('Not found'); e.status = 404; throw e; }
    return this.ensureArn(r[0]);
  }

  async getByName(projectId, name, capability) {
    this.assertP(projectId);
    const where = { project_id: projectId, name: String(name).trim() };
    if (capability) where.capability = capability;
    const r = await this.M.findAll({ where });
    if (!r.length) { const e = new Error(`Integration "${name}" not found`); e.status = 404; throw e; }
    return this.ensureArn(r[0]);
  }

  async getDefault(projectId, capability) {
    this.assertP(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId, capability } });
    const enabled = rows.filter((r) => r.enabled !== 'false');
    const def = enabled.find((r) => truthy(r.is_default));
    const pick = def || enabled[0] || null;
    return pick ? this.ensureArn(pick) : null;
  }

  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = this.validate({ ...body }, false);
    delete patch.id;
    delete patch.project_id;
    delete patch.created_at;
    delete patch.updated_at;
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) { const e = new Error('name required'); e.status = 400; throw e; }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) { const e = new Error('name taken'); e.status = 409; throw e; }
      patch.name = name;
    }
    if (truthy(patch.is_default)) {
      const cur = await this.get(id, projectId);
      await this.clearOtherDefaults(projectId, patch.capability || cur.capability, id);
    }
    if (patch.name || patch.capability) {
      const cur = await this.get(id, projectId);
      patch.arn = buildEndpointArn(
        projectId,
        patch.capability || cur.capability,
        patch.name || cur.name,
      );
    }
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }

  async del(id, projectId) {
    await this.get(id, projectId);
    await this.M.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { AiProviderService, CAPABILITIES, PROVIDER_TYPES, DEFAULT_ENDPOINTS };
