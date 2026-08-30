const { StoredSecret } = require('../models');
const { SecretCrypto } = require('./SecretCrypto');

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_.-]{0,127}$/;

class SecretService {
  constructor(deps = {}) {
    this.StoredSecret = deps.StoredSecret || StoredSecret;
    this.crypto = deps.crypto || new SecretCrypto();
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  validateName(name) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error(
        'name: 1-128 chars, start with a letter, then letters, numbers, . _ -'
      );
      e.status = 400;
      throw e;
    }
    return String(name).trim();
  }

  normalizeMetadata(meta) {
    if (meta == null || meta === '') return '';
    if (typeof meta === 'string') return meta;
    return JSON.stringify(meta);
  }

  envName(body = {}) {
    return String(body.environment || body.env || 'prod').trim() || 'prod';
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    const name = this.validateName(body.name);
    const environment = this.envName(body);
    const existing = await this.StoredSecret.findAll({
      where: { project_id: body.project_id, name, environment }
    });
    if (existing.length) {
      const e = new Error(`A secret named "${name}" already exists in this project`);
      e.status = 409;
      e.code = 'SECRET_NAME_TAKEN';
      throw e;
    }
    if (body.ciphertext && (body.value == null || String(body.value) === '')) {
      if (!body.key_name) {
        const e = new Error('key_name is required when importing ciphertext');
        e.status = 400;
        throw e;
      }
      return this.StoredSecret.create({
        project_id: body.project_id,
        name,
        environment,
        ciphertext: String(body.ciphertext),
        key_name: String(body.key_name),
        key_version: body.key_version == null || body.key_version === '' ? 1 : body.key_version,
        metadata: this.normalizeMetadata(body.metadata)
      });
    }
    if (body.value == null || String(body.value) === '') {
      const e = new Error('value is required');
      e.status = 400;
      throw e;
    }
    const keyName = this.crypto.keyName();
    const buf = Buffer.from(String(body.value), 'utf8');
    const { buf: enc, keyVersion } = await this.crypto.encryptBuffer(buf, keyName, body.project_id);
    return this.StoredSecret.create({
      project_id: body.project_id,
      name,
      environment,
      ciphertext: enc.toString('base64'),
      key_name: keyName,
      key_version: keyVersion,
      metadata: this.normalizeMetadata(body.metadata)
    });
  }

  async list(projectId, environment) {
    this.assertProjectId(projectId);
    const where = { project_id: projectId };
    if (environment) where.environment = String(environment);
    return this.StoredSecret.findAll({ where });
  }

  async listPlainForEnv(projectId, environment) {
    const rows = await this.list(projectId, environment || 'prod');
    const out = {};
    for (const row of rows) {
      try {
        out[row.name] = await this.getPlaintext(row);
      } catch (_) { /* skip undecryptable */ }
    }
    return out;
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.StoredSecret.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Secret not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async getPlaintext(row) {
    const enc = Buffer.from(row.ciphertext, 'base64');
    return (await this.crypto.decryptBuffer(enc, row.key_name, row.project_id)).toString('utf8');
  }

  async update(id, projectId, body) {
    const row = await this.getById(id, projectId);
    let keyName = row.key_name || this.crypto.keyName();
    let nextCiphertext = row.ciphertext;
    let keyVersion = row.key_version;
    if (body.ciphertext && body.value == null) {
      nextCiphertext = String(body.ciphertext);
      if (body.key_name) keyName = String(body.key_name);
      if (body.key_version != null && body.key_version !== '') keyVersion = body.key_version;
    } else if (body.value != null) {
      keyName = this.crypto.keyName();
      const { buf, keyVersion: kv } = await this.crypto.encryptBuffer(
        Buffer.from(String(body.value), 'utf8'),
        keyName,
        projectId
      );
      nextCiphertext = buf.toString('base64');
      keyVersion = kv;
    }
    const nextMeta = body.metadata != null ? this.normalizeMetadata(body.metadata) : row.metadata;
    await this.StoredSecret.update(id, {
      ciphertext: nextCiphertext,
      key_name: keyName,
      key_version: keyVersion,
      metadata: nextMeta
    });
    return this.getById(id, projectId);
  }

  async deleteById(id, projectId) {
    await this.getById(id, projectId);
    await this.StoredSecret.delete(id);
    return { deleted: true, id };
  }
}

module.exports = { SecretService };
