const express = require('express');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { GitService } = require('../services/GitService');
const { reposRoot } = require('../services/RepoService');

const SEG_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const git = new GitService();

// pkt-line framing: 4-byte hex length (incl. the length itself) + payload.
function pktLine(line) {
  return (line.length + 4).toString(16).padStart(4, '0') + line;
}

function resolveDir(project, repoParam) {
  const name = String(repoParam || '').replace(/\.git$/, '');
  if (!SEG_RE.test(String(project)) || !SEG_RE.test(name)) return null;
  const dir = path.join(reposRoot(), String(project), `${name}.git`);
  if (!fs.existsSync(dir)) return null;
  return dir;
}

function resolveNamed(repoParam) {
  const name = String(repoParam || '').replace(/\.git$/, '');
  if (!SEG_RE.test(name)) return null;
  const root = reposRoot();
  if (!fs.existsSync(root)) return null;
  const projects = fs.readdirSync(root);
  for (const project of projects) {
    const dir = path.join(root, project, `${name}.git`);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// Shared-secret or JWT auth for the git transport (Bearer or Basic password).
// Always required — repos are private. Unverified tokens are never accepted.
function presentedToken(req) {
  const hdr = req.headers.authorization || '';
  if (hdr.startsWith('Bearer ')) return hdr.slice(7).trim();
  if (hdr.startsWith('Basic ')) {
    const decoded = Buffer.from(hdr.slice(6), 'base64').toString('utf8');
    return decoded.split(':').slice(1).join(':');
  }
  return '';
}

function rejectAuth(res) {
  res.set('WWW-Authenticate', 'Basic realm="aerekos git"');
  res.status(401).end('Authentication required');
  return false;
}

async function checkAuth(req, res) {
  const presented = presentedToken(req);
  if (!presented) return rejectAuth(res);
  if (process.env.GIT_AUTH_TOKEN && presented === process.env.GIT_AUTH_TOKEN) return true;
  if (presented.startsWith('eyJ')) {
    try {
      const { verify } = require('../../../shared/authManagerClient');
      const v = await verify(presented);
      if (v && (v.active === true || v.valid === true || v.sub || v.client_id || v.typ)) {
        req.gitAuth = v;
        return true;
      }
    } catch (_) { /* try JWT next */ }
    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET || process.env.TOKEN_SECRET;
      if (secret) {
        req.gitAuth = jwt.verify(presented, secret);
        return true;
      }
    } catch (_) { /* reject */ }
  }
  return rejectAuth(res);
}

const router = express.Router();

router.get('/:project/:repo/info/refs', async (req, res) => {
  if (!(await checkAuth(req, res))) return;
  const service = req.query.service;
  if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
    return res.status(400).end('dumb HTTP is not supported; use a recent git client');
  }
  const dir = resolveDir(req.params.project, req.params.repo);
  if (!dir) return res.status(404).end('repository not found');

  res.set('Content-Type', `application/x-${service}-advertisement`);
  res.set('Cache-Control', 'no-cache');
  res.write(pktLine(`# service=${service}\n`));
  res.write('0000');

  const child = git.spawnService(service.replace('git-', ''), dir, { advertise: true });
  child.stdout.pipe(res);
  child.stderr.on('data', (d) => console.error(`[git_manager] ${service}:`, d.toString()));
  child.on('error', (e) => {
    console.error('[git_manager] spawn error', e.message);
    if (!res.headersSent) res.status(500);
    res.end();
  });
});

function rpc(service) {
  return async (req, res) => {
    if (!(await checkAuth(req, res))) return;
    const dir = resolveDir(req.params.project, req.params.repo);
    if (!dir) return res.status(404).end('repository not found');

    res.set('Content-Type', `application/x-${service}-result`);
    res.set('Cache-Control', 'no-cache');

    const allowDirect = req.headers['x-aerekos-allow-direct'] === '1' || req.user?.role === 'admin';
    const child = git.spawnService(service.replace('git-', ''), dir, {
      env: { ...process.env, AEREKOS_ALLOW_DIRECT: allowDirect ? '1' : '' },
    });
    const input = req.headers['content-encoding'] === 'gzip' ? req.pipe(zlib.createGunzip()) : req;
    input.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', (d) => console.error(`[git_manager] ${service}:`, d.toString()));
    child.on('error', (e) => {
      console.error('[git_manager] spawn error', e.message);
      if (!res.headersSent) res.status(500);
      res.end();
    });
  };
}

router.post('/:project/:repo/git-upload-pack', rpc('git-upload-pack'));
router.post('/:project/:repo/git-receive-pack', rpc('git-receive-pack'));

router.get('/:repo/info/refs', async (req, res) => {
  if (!(await checkAuth(req, res))) return;
  const service = req.query.service;
  if (service !== 'git-upload-pack' && service !== 'git-receive-pack') {
    return res.status(400).end('dumb HTTP is not supported; use a recent git client');
  }
  const dir = resolveNamed(req.params.repo);
  if (!dir) return res.status(404).end('repository not found');
  res.set('Content-Type', `application/x-${service}-advertisement`);
  res.set('Cache-Control', 'no-cache');
  res.write(pktLine(`# service=${service}\n`));
  res.write('0000');
  const child = git.spawnService(service.replace('git-', ''), dir, { advertise: true });
  child.stdout.pipe(res);
  child.stderr.on('data', (d) => console.error(`[git_manager] ${service}:`, d.toString()));
  child.on('error', (e) => {
    console.error('[git_manager] spawn error', e.message);
    if (!res.headersSent) res.status(500);
    res.end();
  });
});

function rpcNamed(service) {
  return async (req, res) => {
    if (!(await checkAuth(req, res))) return;
    const dir = resolveNamed(req.params.repo);
    if (!dir) return res.status(404).end('repository not found');
    res.set('Content-Type', `application/x-${service}-result`);
    res.set('Cache-Control', 'no-cache');
    const allowDirect = req.headers['x-aerekos-allow-direct'] === '1' || req.user?.role === 'admin';
    const child = git.spawnService(service.replace('git-', ''), dir, {
      env: { ...process.env, AEREKOS_ALLOW_DIRECT: allowDirect ? '1' : '' },
    });
    const input = req.headers['content-encoding'] === 'gzip' ? req.pipe(zlib.createGunzip()) : req;
    input.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', (d) => console.error(`[git_manager] ${service}:`, d.toString()));
    child.on('error', (e) => {
      console.error('[git_manager] spawn error', e.message);
      if (!res.headersSent) res.status(500);
      res.end();
    });
  };
}

router.post('/:repo/git-upload-pack', rpcNamed('git-upload-pack'));
router.post('/:repo/git-receive-pack', rpcNamed('git-receive-pack'));

module.exports = router;
