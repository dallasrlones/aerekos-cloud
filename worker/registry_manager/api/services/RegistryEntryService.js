const { RegistryEntry } = require('../models');

const VALID_TYPES = ['local', 'docker_hub', 'harbor', 'embedded', 'custom'];

function entryOut(r) {
  return {
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    registry_url: r.registry_url,
    type: r.type || 'custom',
    namespace: r.namespace || null,
    username: r.username || null,
    credential_ref: r.credential_ref || null,
    enabled: r.enabled !== '0',
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

class RegistryEntryService {
  constructor(deps = {}) {
    this.RegistryEntry = deps.RegistryEntry || RegistryEntry;
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  normalizeType(type) {
    const t = String(type || 'custom').toLowerCase();
    return VALID_TYPES.includes(t) ? t : 'custom';
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    const name = String(body.name || '').trim();
    if (!name) {
      const e = new Error('name is required');
      e.status = 400;
      throw e;
    }
    const registryUrl = String(body.registry_url || '').trim();
    if (!registryUrl) {
      const e = new Error('registry_url is required');
      e.status = 400;
      throw e;
    }
    const existing = await this.RegistryEntry.findAll({ where: { project_id: body.project_id, name } });
    if (existing.length) {
      const e = new Error(`registry "${name}" already exists in this project`);
      e.status = 409;
      throw e;
    }
    const created = await this.RegistryEntry.create({
      project_id: body.project_id,
      name,
      registry_url: registryUrl,
      type: this.normalizeType(body.type),
      namespace: body.namespace != null ? String(body.namespace) : '',
      username: body.username != null ? String(body.username) : '',
      credential_ref: body.credential_ref != null ? String(body.credential_ref) : '',
      enabled: body.enabled === false || body.enabled === '0' || body.enabled === 'false' ? '0' : '1'
    });
    return entryOut(created);
  }

  async list(projectId) {
    this.assertProjectId(projectId);
    const rows = await this.RegistryEntry.findAll({ where: { project_id: projectId } });
    return rows.map(entryOut);
  }

  async getRaw(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.RegistryEntry.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Registry entry not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async get(id, projectId) {
    return entryOut(await this.getRaw(id, projectId));
  }

  async update(id, projectId, body = {}) {
    await this.getRaw(id, projectId);
    const patch = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) { const e = new Error('name is required'); e.status = 400; throw e; }
      const dup = await this.RegistryEntry.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) {
        const e = new Error(`registry "${name}" already exists in this project`);
        e.status = 409;
        throw e;
      }
      patch.name = name;
    }
    if (body.registry_url !== undefined) {
      const url = String(body.registry_url || '').trim();
      if (!url) { const e = new Error('registry_url is required'); e.status = 400; throw e; }
      patch.registry_url = url;
    }
    if (body.type !== undefined) patch.type = this.normalizeType(body.type);
    if (body.namespace !== undefined) patch.namespace = body.namespace != null ? String(body.namespace) : '';
    if (body.username !== undefined) patch.username = body.username != null ? String(body.username) : '';
    if (body.credential_ref !== undefined) {
      patch.credential_ref = body.credential_ref != null ? String(body.credential_ref) : '';
    }
    if (body.enabled !== undefined) {
      patch.enabled = body.enabled === false || body.enabled === '0' || body.enabled === 'false' ? '0' : '1';
    }
    if (Object.keys(patch).length) {
      await this.RegistryEntry.update(id, patch);
    }
    return this.get(id, projectId);
  }

  async del(id, projectId) {
    const row = await this.getRaw(id, projectId);
    await this.RegistryEntry.delete(id);
    return { deleted: true, id: row.id };
  }
}

module.exports = { RegistryEntryService, entryOut };
