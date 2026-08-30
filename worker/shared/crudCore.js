'use strict';

/**
 * Express-free CRUD helpers. Safe to require from Docker /app/shared
 * (images COPY shared without node_modules).
 */

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function projectId(req) {
  return req.query.project_id || req.body?.project_id || req.headers['x-project-id'];
}

class CrudService {
  constructor(Model, { nameField = 'name' } = {}) {
    this.M = Model;
    this.nameField = nameField;
  }

  assertP(p) {
    if (!p || !String(p).trim()) throw fail(400, 'project_id required');
  }

  async create(body) {
    this.assertP(body.project_id);
    const name = String(body[this.nameField] || body.name || '').trim();
    if (!name) throw fail(400, `${this.nameField} required`);
    const dup = await this.M.findAll({ where: { project_id: body.project_id, [this.nameField]: name } });
    if (dup.length) throw fail(409, 'name taken');
    return this.M.create({ ...body, [this.nameField]: name, name: body.name || name });
  }

  async list(projectIdVal) {
    this.assertP(projectIdVal);
    return this.M.findAll({ where: { project_id: projectIdVal } });
  }

  async get(id, projectIdVal) {
    this.assertP(projectIdVal);
    const r = await this.M.findAll({ where: { id, project_id: projectIdVal } });
    if (!r.length) throw fail(404, 'Not found');
    return r[0];
  }

  async update(id, projectIdVal, body) {
    await this.get(id, projectIdVal);
    const patch = { ...(body || {}) };
    delete patch.id;
    delete patch.project_id;
    delete patch.created_at;
    delete patch.updated_at;
    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectIdVal);
  }

  async del(id, projectIdVal) {
    await this.get(id, projectIdVal);
    await this.M.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { fail, projectId, CrudService };
