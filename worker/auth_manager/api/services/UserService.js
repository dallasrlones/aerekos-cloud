'use strict';

const { User } = require('../models');
const TokenService = require('./TokenService');
const { hashSecret, verifySecret } = require('./CredentialService');

// Display colors for user avatars (apps may override).
const COLORS = ['#e50914', '#46d369', '#f5c518', '#00a5e5', '#9b59b6', '#e67e22', '#1abc9c', '#ff6b6b'];

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function toPublic(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    username: row.username,
    name: row.name || row.username,
    display_color: row.display_color,
    enabled: row.enabled !== 0 && row.enabled !== false,
    last_login_at: row.last_login_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function userTtl() {
  return parseInt(process.env.AUTH_USER_TOKEN_TTL_SECONDS || String(60 * 60 * 24 * 7), 10); // 7d default
}

/**
 * UserService — per-project human users with a password grant.
 *
 * This is auth_manager's out-of-the-box "user system" for any project/app:
 *   create a user here, the app calls POST /auth/login with the user's
 *   username+password, and gets back a JWT signed with the same KMS secret
 *   auth_manager verifies with (/auth/verify). Apps don't store passwords
 *   or issue their own tokens.
 */
class UserService {
  constructor() {
    this.M = User;
  }

  assertProject(projectId) {
    if (!projectId || !String(projectId).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  validateUsername(username) {
    const u = String(username || '').trim();
    if (u.length < 3 || u.length > 40) {
      const e = new Error('username must be 3-40 characters');
      e.status = 400;
      throw e;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(u)) {
      const e = new Error('username may only contain letters, numbers, ".", "_" and "-"');
      e.status = 400;
      throw e;
    }
    return u;
  }

  validatePassword(password) {
    const p = String(password || '');
    if (p.length < 4 || p.length > 128) {
      const e = new Error('password must be 4-128 characters');
      e.status = 400;
      throw e;
    }
    return p;
  }

  async create(body) {
    this.assertProject(body.project_id);
    const username = this.validateUsername(body.username);
    const password = this.validatePassword(body.password);
    const name = String(body.name || '').trim() || username;
    const dup = await this.M.findAll({ where: { project_id: body.project_id, username } });
    if (dup.length) {
      const e = new Error('username taken');
      e.status = 409;
      throw e;
    }
    const row = await this.M.create({
      project_id: body.project_id,
      username,
      name,
      display_color: String(body.display_color || '').trim() || pickColor(),
      password_hash: hashSecret(password),
      enabled: body.enabled === false ? 0 : 1,
    });
    return { user: toPublic(row) };
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
    delete patch.username; // immutable (stable identity for tokens/foreign keys)
    delete patch.password_hash;
    delete patch.last_login_at;
    delete patch.created_at;
    delete patch.updated_at;

    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) {
        const e = new Error('name must not be empty');
        e.status = 400;
        throw e;
      }
      patch.name = name;
    }
    if (patch.password !== undefined) {
      patch.password_hash = hashSecret(this.validatePassword(patch.password));
      delete patch.password;
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

  /**
   * Resource-owner password grant.
   * body: { username, password, project_id? }
   * project_id scopes the lookup (recommended); without it usernames are
   * matched globally and must be unique across projects.
   */
  async login(body) {
    const uname = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!uname || !password) {
      const e = new Error('username and password are required');
      e.status = 400;
      throw e;
    }
    const where = { username: uname };
    if (body.project_id) where.project_id = body.project_id;
    const rows = await this.M.findAll({ where });
    const row = rows[0];
    if (!row || !verifySecret(password, row.password_hash)) {
      const e = new Error('invalid username or password');
      e.status = 401;
      throw e;
    }
    if (row.enabled === 0 || row.enabled === false) {
      const e = new Error('user disabled');
      e.status = 401;
      throw e;
    }

    const now = new Date().toISOString();
    await this.M.update(row.id, { last_login_at: now });

    const ttl = userTtl();
    const token = TokenService.sign(
      {
        sub: `user:${row.id}`,
        typ: 'user',
        username: row.username,
        name: row.name || row.username,
        display_color: row.display_color,
        project_id: row.project_id,
      },
      ttl
    );
    return { token, token_type: 'Bearer', expires_in: ttl, user: toPublic(row) };
  }
}

module.exports = { UserService, toPublic };
