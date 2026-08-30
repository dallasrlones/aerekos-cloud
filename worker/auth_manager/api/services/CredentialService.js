'use strict';

const crypto = require('crypto');
const { Credential } = require('../models');

function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifySecret(secret, stored) {
  if (!stored || !secret) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  try {
    const attempt = crypto.scryptSync(secret, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'));
  } catch (_) {
    return false;
  }
}

function parseJsonArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : fallback;
    } catch (_) { return fallback; }
  }
  return fallback;
}

function serializeJsonArray(arr) {
  return JSON.stringify(Array.isArray(arr) ? arr : []);
}

function newClientId() {
  return `cred_${crypto.randomBytes(12).toString('hex')}`;
}

function newClientSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function toPublic(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    client_id: row.client_id,
    allowed_resources: parseJsonArray(row.allowed_resources),
    scopes: parseJsonArray(row.scopes),
    enabled: row.enabled !== 0 && row.enabled !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_used_at: row.last_used_at || null,
  };
}

class CredentialService {
  constructor() {
    this.M = Credential;
  }

  assertProject(projectId) {
    if (!projectId || !String(projectId).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  async create(body) {
    this.assertProject(body.project_id);
    const name = String(body.name || '').trim();
    if (!name) {
      const e = new Error('name required');
      e.status = 400;
      throw e;
    }
    const dup = await this.M.findAll({ where: { project_id: body.project_id, name } });
    if (dup.length) {
      const e = new Error('name taken');
      e.status = 409;
      throw e;
    }

    const client_id = newClientId();
    const client_secret = newClientSecret();
    const row = await this.M.create({
      project_id: body.project_id,
      name,
      client_id,
      client_secret_hash: hashSecret(client_secret),
      allowed_resources: serializeJsonArray(body.allowed_resources || []),
      scopes: serializeJsonArray(body.scopes || []),
      enabled: body.enabled === false ? 0 : 1,
    });

    return {
      credential: toPublic(row),
      client_id,
      client_secret,
    };
  }

  async list(projectId) {
    this.assertProject(projectId);
    const rows = await this.M.findAll({ where: { project_id: projectId } });
    return rows.map(toPublic);
  }

  async get(id, projectId) {
    this.assertProject(projectId);
    const rows = await this.M.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    return toPublic(rows[0]);
  }

  async update(id, projectId, body) {
    await this.get(id, projectId);
    const patch = { ...(body || {}) };
    delete patch.id;
    delete patch.project_id;
    delete patch.client_id;
    delete patch.client_secret;
    delete patch.client_secret_hash;
    delete patch.created_at;
    delete patch.updated_at;

    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) {
        const e = new Error('name required');
        e.status = 400;
        throw e;
      }
      const dup = await this.M.findAll({ where: { project_id: projectId, name } });
      if (dup.some((d) => String(d.id) !== String(id))) {
        const e = new Error('name taken');
        e.status = 409;
        throw e;
      }
      patch.name = name;
    }
    if (patch.allowed_resources !== undefined) {
      patch.allowed_resources = serializeJsonArray(patch.allowed_resources);
    }
    if (patch.scopes !== undefined) {
      patch.scopes = serializeJsonArray(patch.scopes);
    }
    if (patch.enabled !== undefined) {
      patch.enabled = patch.enabled === false ? 0 : 1;
    }

    if (Object.keys(patch).length) await this.M.update(id, patch);
    return this.get(id, projectId);
  }

  async del(id, projectId) {
    await this.get(id, projectId);
    await this.M.delete(id);
    return { deleted: true, id };
  }

  async rotate(id, projectId) {
    const row = await this.get(id, projectId);
    const client_secret = newClientSecret();
    await this.M.update(id, { client_secret_hash: hashSecret(client_secret) });
    return { credential: row, client_id: row.client_id, client_secret };
  }

  /**
   * Resolve dynamic app credential for token issuance.
   * @returns {null | { project_id, resources, scopes, sub }}
   */
  async verifyClient(client_id, client_secret) {
    if (!client_id || !client_secret) return null;
    const rows = await this.M.findAll({ where: { client_id } });
    if (!rows.length) return null;
    const row = rows[0];
    if (row.enabled === 0 || row.enabled === false) return null;
    if (!verifySecret(client_secret, row.client_secret_hash)) return null;

    const now = new Date().toISOString();
    await this.M.update(row.id, { last_used_at: now });

    return {
      sub: `cred:${row.id}`,
      project_id: row.project_id,
      resources: parseJsonArray(row.allowed_resources),
      scopes: parseJsonArray(row.scopes),
    };
  }
}

module.exports = { CredentialService, hashSecret, verifySecret, toPublic };
