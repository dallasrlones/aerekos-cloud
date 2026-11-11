const fs = require('fs');
const path = require('path');
const { Repository, PushEvent } = require('../models');
const { GitService } = require('./GitService');

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/;
const SEG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

function reposRoot() {
  return process.env.GIT_REPOS_ROOT || path.join(__dirname, '../../data/repos');
}

function err(message, status, code) {
  const e = new Error(message);
  e.status = status;
  if (code) e.code = code;
  return e;
}

function cloneBase() {
  return String(process.env.PUBLIC_GIT_URL || '').replace(/\/$/, '');
}

function shortCloneUrl(r) {
  const base = cloneBase();
  if (!base) return null;
  if (process.env.PUBLIC_GIT_SHORT === '1') {
    return `${base}/${encodeURIComponent(r.name)}.git`;
  }
  return `${base}/git/${encodeURIComponent(r.project_id)}/${encodeURIComponent(r.name)}.git`;
}

function lanCloneUrl(r) {
  const lan = String(process.env.GIT_LAN_URL || '').replace(/\/$/, '');
  if (!lan) return null;
  return `${lan}/git/${encodeURIComponent(r.project_id)}/${encodeURIComponent(r.name)}.git`;
}

function assertPrivateVisibility(body = {}) {
  if (body.visibility === undefined || body.visibility === null || body.visibility === '') return;
  if (String(body.visibility) !== 'private') {
    throw err('visibility must be private', 400);
  }
}

function repoOut(r) {
  const base = cloneBase();
  const clonePath = `/git/${encodeURIComponent(r.project_id)}/${encodeURIComponent(r.name)}.git`;
  return {
    id: r.id,
    project_id: r.project_id,
    name: r.name,
    description: r.description || null,
    default_branch: r.default_branch || 'main',
    visibility: 'private',
    last_pushed_at: r.last_pushed_at || null,
    clone_path: clonePath,
    clone_url: shortCloneUrl(r),
    clone_url_legacy: base ? `${base}${clonePath}` : null,
    lan_clone_url: lanCloneUrl(r),
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

class RepoService {
  constructor(deps = {}) {
    this.Repository = deps.Repository || Repository;
    this.PushEvent = deps.PushEvent || PushEvent;
    this.git = deps.git || new GitService();
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      throw err('project_id is required', 400);
    }
    if (!SEG_RE.test(String(projectId))) {
      throw err('project_id contains invalid characters', 400);
    }
  }

  validateName(name) {
    const n = String(name || '').trim().replace(/\.git$/, '');
    if (!NAME_RE.test(n)) {
      throw err('name: start with a letter, then letters/numbers/._- (max 100)', 400);
    }
    return n;
  }

  repoDir(projectId, name) {
    return path.join(reposRoot(), String(projectId), `${name}.git`);
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    assertPrivateVisibility(body);
    const name = this.validateName(body.name);
    // Uniqueness is per (project_id, name) — repos live in per-project dirs
    // (repos/<project_id>/<name>.git), so two projects may share a name.
    const existing = await this.Repository.findAll({ where: { name, project_id: body.project_id } });
    if (existing.length) {
      throw err(`repository "${name}" already exists`, 409, 'REPO_EXISTS');
    }
    const defaultBranch = String(body.default_branch || 'main').trim() || 'main';
    if (!/^[a-zA-Z0-9._\/-]{1,100}$/.test(defaultBranch)) {
      throw err('default_branch contains invalid characters', 400);
    }
    const created = await this.Repository.create({
      project_id: body.project_id,
      name,
      description: body.description != null ? String(body.description) : '',
      default_branch: defaultBranch,
      visibility: 'private',
      last_pushed_at: ''
    });
    const dir = this.repoDir(body.project_id, name);
    try {
      await this.git.initBare(dir, defaultBranch);
      this.git.installPreReceiveHook(dir);
      this.git.installPostReceiveHook(dir, {
        projectId: body.project_id,
        repoId: created.id,
        repoName: name
      });
    } catch (e) {
      // Roll back the metadata row if the on-disk repo could not be created.
      await this.Repository.delete(created.id).catch(() => {});
      throw err(`failed to initialize repository: ${e.message}`, 500, 'GIT_INIT_FAILED');
    }
    return repoOut(created);
  }

  async list(projectId) {
    if (!projectId) {
      const rows = await this.Repository.findAll();
      return rows.map(repoOut);
    }
    this.assertProjectId(projectId);
    const rows = await this.Repository.findAll({ where: { project_id: projectId } });
    return rows.map(repoOut);
  }

  async findByName(name) {
    const rows = await this.Repository.findAll({ where: { name: this.validateName(name) } });
    return rows[0] || null;
  }

  async tree(id, projectId, ref, treePath) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    return this.git.lsTree(dir, ref || r.default_branch || 'HEAD', treePath || '');
  }

  async blob(id, projectId, ref, filePath) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    return this.git.showBlob(dir, ref || r.default_branch || 'HEAD', filePath);
  }

  async getRaw(id, projectId) {
    const where = { id };
    if (projectId) {
      this.assertProjectId(projectId);
      where.project_id = projectId;
    }
    const rows = await this.Repository.findAll({ where });
    if (!rows.length) throw err('Repository not found', 404);
    return rows[0];
  }

  async get(id, projectId) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    const branches = await this.git.listBranches(dir);
    return { ...repoOut(r), branches };
  }

  async commits(id, projectId, branch, limit) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    const ref = branch || r.default_branch || 'main';
    return this.git.listCommits(dir, ref, limit);
  }

  async branches(id, projectId) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    return this.git.listBranches(dir);
  }

  async update(id, projectId, body = {}) {
    const r = await this.getRaw(id, projectId);
    assertPrivateVisibility(body);
    const patch = {};
    if (body.description !== undefined) patch.description = body.description != null ? String(body.description) : '';
    if (body.visibility !== undefined) patch.visibility = 'private';
    if (body.default_branch !== undefined) {
      const db = String(body.default_branch || '').trim();
      if (!/^[a-zA-Z0-9._\/-]{1,100}$/.test(db)) throw err('default_branch contains invalid characters', 400);
      patch.default_branch = db;
      try {
        await this.git.setDefaultBranch(this.repoDir(r.project_id, r.name), db);
      } catch {
        /* branch may not exist yet; HEAD will resolve once it does */
      }
    }
    if (Object.keys(patch).length) await this.Repository.update(id, patch);
    return this.get(id, projectId);
  }

  async del(id, projectId) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    const events = await this.PushEvent.findAll({ where: { project_id: projectId, repo_id: id } });
    for (const ev of events) await this.PushEvent.delete(ev.id).catch(() => {});
    await this.Repository.delete(id);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    return { deleted: true, id: r.id };
  }

  // Called by the post-receive hook (via the internal route).
  async recordPush({ project_id, repo_id, repo_name, repo, ref, old_sha, new_sha, pusher, from_merge, merged }) {
    const ev = await this.PushEvent.create({
      project_id,
      repo_id,
      ref: ref || '',
      old_sha: old_sha || '',
      new_sha: new_sha || '',
      pusher: pusher || ''
    });
    await this.Repository.update(repo_id, { last_pushed_at: new Date().toISOString() }).catch(() => {});
    try {
      const crypto = require('crypto');
      let repoName = String(repo_name || repo || '');
      if (!repoName) {
        try {
          const found = await this.Repository.findAll({ where: { id: repo_id } });
          repoName = found[0]?.name || '';
        } catch (_) { /* ignore */ }
      }
      const body = {
        project_id,
        repo_id,
        repo_name: repoName,
        repo: repoName,
        ref,
        sha: new_sha,
        from_merge: Boolean(from_merge || merged || pusher === 'merge'),
        merged: Boolean(from_merge || merged || pusher === 'merge'),
      };
      const secret = process.env.GIT_WEBHOOK_SECRET || '';
      const headers = {};
      if (secret) {
        headers['x-aerekos-signature'] = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      }
      const { proxy } = require('../../../shared/conductorProxy');
      await proxy({
        service: 'cicd_manager',
        method: 'POST',
        path: '/api/v1/pipelines/run-for-repo',
        projectId: project_id,
        body,
        headers,
      });
    } catch (e) {
      console.warn('[git_manager] cicd trigger skipped:', e.message);
    }
    return ev;
  }

  async commitFile(id, projectId, { filePath = 'stack.json', content = '', message = 'chore: update stack.json' } = {}) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    const branch = r.default_branch || 'main';
    await this.git.commitFile(dir, {
      branch,
      filePath,
      content: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      message,
    });
    return this.get(id, projectId);
  }

  async listPushEvents(projectId, repoId) {
    this.assertProjectId(projectId);
    return this.PushEvent.findAll({ where: { project_id: projectId, repo_id: repoId } });
  }

  async bundleBuffer(id, projectId) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    if (!fs.existsSync(dir)) throw err('repository directory not found', 404);
    const tmp = path.join(require('os').tmpdir(), `git-bundle-${r.id}-${Date.now()}`);
    try {
      const kind = await this.git.createArchive(dir, tmp);
      return {
        buf: fs.readFileSync(tmp),
        filename: kind === 'bundle' ? `${r.name}.bundle` : `${r.name}.tar`,
        name: r.name,
        kind,
      };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }

  async restoreFromBuffer(id, projectId, buf) {
    const r = await this.getRaw(id, projectId);
    const dir = this.repoDir(r.project_id, r.name);
    const tmp = path.join(require('os').tmpdir(), `git-unbundle-${r.id}-${Date.now()}`);
    fs.writeFileSync(tmp, buf);
    try {
      const kind = await this.git.restoreArchive(dir, tmp);
      this.git.installPostReceiveHook(dir, {
        projectId: r.project_id,
        repoId: r.id,
        repoName: r.name,
      });
      return { restored: true, kind, name: r.name, id: r.id };
    } finally {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    }
  }
}

module.exports = { RepoService, repoOut, reposRoot };
