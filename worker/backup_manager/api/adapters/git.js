'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { call, json, toBuffer } = require('../utils/conductor');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr;
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

function reposRoot() {
  return process.env.GIT_REPOS_ROOT || path.join(__dirname, '../../../git_manager/data/repos');
}

function repoDir(projectId, name) {
  return path.join(reposRoot(), String(projectId), `${name}.git`);
}

async function tarDir(dir, outFile) {
  await run('tar', ['-C', path.dirname(dir), '-cf', outFile, path.basename(dir)]);
}

async function untar(archive, destParent) {
  fs.mkdirSync(destParent, { recursive: true });
  await run('tar', ['-C', destParent, '-xf', archive]);
}

async function gitBundle(dir, outFile) {
  await run(process.env.GIT_BIN || 'git', ['--git-dir', dir, 'bundle', 'create', outFile, '--all']);
}

function isGitBundle(buf) {
  const head = buf.slice(0, 32).toString('utf8');
  return head.startsWith('# v2 git bundle') || head.startsWith('# v3 git bundle');
}

async function localArchive(dir) {
  if (!fs.existsSync(dir)) return null;
  const tmp = path.join(os.tmpdir(), `aerekos-git-${Date.now()}-${process.pid}`);
  try {
    try {
      await gitBundle(dir, tmp);
      return { buf: fs.readFileSync(tmp), filename: 'repo.bundle' };
    } catch {
      await tarDir(dir, tmp);
      return { buf: fs.readFileSync(tmp), filename: 'repo.tar' };
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

async function findRepo(projectId, resource) {
  const listed = await json('git_manager', 'GET', '/api/v1/repos', { projectId });
  const repos = Array.isArray(listed.repositories) ? listed.repositories : Array.isArray(listed.items) ? listed.items : [];
  if (!resource || resource === 'default') return repos[0] || null;
  return repos.find((r) => r && (r.name === resource || String(r.id) === String(resource))) || null;
}

async function fetchBundle(projectId, repo) {
  const res = await call('git_manager', 'GET', `/api/v1/repos/${encodeURIComponent(repo.id)}/bundle`, {
    projectId,
    responseType: 'arraybuffer',
    timeout: 120000,
  });
  if (res.status < 400) {
    const buf = toBuffer(res.data);
    const cd = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
    const match = /filename="?([^"]+)"?/i.exec(cd);
    return { buf, filename: (match && match[1]) || 'repo.bundle' };
  }
  const local = await localArchive(repoDir(projectId, repo.name));
  if (local) return local;
  const { throwUpstream } = require('../utils/conductor');
  throwUpstream('git_manager', res);
  return null;
}

async function snapshot(ctx) {
  const { projectId, resource, storage, prefix } = ctx;
  const repo = await findRepo(projectId, resource);
  if (!repo) {
    const e = new Error('git repository not found');
    e.status = 404;
    throw e;
  }
  const archive = await fetchBundle(projectId, repo);
  const objectKey = `${prefix}/${archive.filename}`;
  await storage.putObject(projectId, storage.bucket, objectKey, archive.buf);
  const manifest = {
    adapter: 'git_manager',
    source: 'git_manager',
    resource: repo.name,
    repo_id: repo.id,
    object: archive.filename,
    size: archive.buf.length,
  };
  const meta = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: archive.buf.length + meta, extra: manifest };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, dest, resource, storage, prefix } = ctx;
  const name = dest || (snapshotDoc && snapshotDoc.resource) || resource;
  const object = (snapshotDoc && snapshotDoc.object) || 'repo.bundle';
  const buf = await storage.getObject(projectId, storage.bucket, `${prefix}/${object}`);

  let repo = await findRepo(projectId, name);
  if (!repo) {
    const created = await json('git_manager', 'POST', '/api/v1/repos', {
      projectId,
      data: { project_id: projectId, name },
    });
    repo = (created && created.repository) || created;
  }

  const res = await call('git_manager', 'POST', `/api/v1/repos/${encodeURIComponent(repo.id)}/unbundle`, {
    projectId,
    data: buf,
    headers: { 'Content-Type': 'application/octet-stream' },
    timeout: 120000,
  });
  if (res.status < 400) {
    return { ok: true, dest: name, repo_id: repo.id, result: res.data };
  }

  const dir = repoDir(projectId, repo.name || name);
  const tmp = path.join(os.tmpdir(), `aerekos-git-restore-${Date.now()}-${process.pid}`);
  fs.writeFileSync(tmp, buf);
  try {
    if (isGitBundle(buf)) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      fs.mkdirSync(path.dirname(dir), { recursive: true });
      await run(process.env.GIT_BIN || 'git', ['clone', '--mirror', tmp, dir]);
    } else {
      await untar(tmp, path.dirname(dir));
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
  return { ok: true, dest: name, repo_id: repo.id, local: true };
}

module.exports = { snapshot, restore };
