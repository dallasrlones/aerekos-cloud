#!/usr/bin/env node
'use strict';

/**
 * One-time bootstrap: system secrets, named tunnels, git.aerekos.com, aerekos-cloud repo + fleet pipeline.
 * Does not commit the Cloudflare token. Does not mutate docunu-dev.
 *
 *   CONDUCTOR_URL=http://127.0.0.1:3300 node scripts/deploy/bootstrap-git-fleet.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const SYSTEM = '9d8bde11-6933-4732-b746-602dcf72eaa5';
const PROD_GUARD = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const BASE = (process.env.CONDUCTOR_URL || 'http://127.0.0.1:3300').replace(/\/$/, '');
const USER = process.env.AUTH_USERNAME || 'admin';
const PASS = process.env.AUTH_PASSWORD || 'admin';
const ROOT = path.resolve(__dirname, '../..');

async function req(method, url, { headers = {}, body, raw } = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body: raw != null ? raw : (body == null ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : {}; } catch { /* keep text */ }
  return { status: res.status, data };
}

function tokenFile() {
  const p = process.env.CLOUDFLARE_TOKEN_FILE
    || path.join(os.homedir(), 'work/cloudflare/cloudflaretoken');
  return p;
}

async function main() {
  if (SYSTEM === PROD_GUARD) throw new Error('refusing system==docunu-dev');
  const login = await req('POST', `${BASE}/api/auth/login`, { headers: { 'Content-Type': 'application/json' }, body: { username: USER, password: PASS } });
  const token = login.data?.token || login.data?.access_token;
  if (!token) throw new Error(`login failed: ${login.status}`);
  const hdr = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = {
    get: (p, opts = {}) => {
      const q = opts.params ? '?' + new URLSearchParams(opts.params).toString() : '';
      return req('GET', `${BASE}${p}${q}`, { headers: hdr });
    },
    post: (p, body, extra = {}) => req('POST', `${BASE}${p}`, {
      headers: { ...hdr, ...(extra.headers || {}) },
      body: extra.headers?.['Content-Type'] === 'application/octet-stream' ? undefined : body,
      raw: extra.headers?.['Content-Type'] === 'application/octet-stream' ? body : undefined,
    }),
  };

  const cfPath = tokenFile();
  if (fs.existsSync(cfPath)) {
    const raw = fs.readFileSync(cfPath, 'utf8').trim();
    const cfToken = raw.includes('=') ? (raw.match(/CLOUDFLARE_API_TOKEN=(.+)/) || [])[1] || raw : raw;
    const secrets = [
      ['cloudflare_api_token', cfToken],
      ['cloudflare_account_id', process.env.CLOUDFLARE_ACCOUNT_ID || 'e5ca9d1cbd901078e5bbe1cbbff9151a'],
      ['cloudflare_zone_id', process.env.CLOUDFLARE_ZONE_ID || '2902d726d76222c44ecd5694b228775c'],
    ];
    for (const [name, value] of secrets) {
      if (!value) continue;
      const res = await api.post('/api/services/secrets_manager/api/v1/secrets', {
        project_id: SYSTEM, name, value, environment: 'prod',
      });
      console.log(`secret ${name}: ${res.status}`);
    }
  } else {
    console.log('no CF token file; skipping secret inject');
  }

  const imported = await api.post('/api/services/tunnel_manager/api/v1/tunnels/import', { project_id: SYSTEM });
  console.log('import tunnels:', imported.status);

  const named = await api.get('/api/edge/tunnels/named', { params: { project_id: SYSTEM } });
  console.log('named tunnels:', (named.data?.tunnels || []).map((t) => t.display_name).join(', ') || named.status);

  const bind = await api.post('/api/edge/bind', {
    project_id: SYSTEM,
    hostname: 'git.aerekos.com',
    port: 3130,
  });
  console.log('bind git.aerekos.com:', bind.status, bind.data?.error?.message || bind.data?.hostname || '');

  let repo = await api.get('/api/services/git_manager/api/v1/repos', { params: { project_id: SYSTEM } });
  let cloud = (repo.data?.repositories || []).find((r) => r.name === 'aerekos-cloud');
  if (!cloud) {
    const created = await api.post('/api/services/git_manager/api/v1/repos', {
      project_id: SYSTEM, name: 'aerekos-cloud', default_branch: 'main',
    });
    cloud = created.data?.repository;
    console.log('created repo:', created.status, cloud?.id);
  } else {
    console.log('repo exists:', cloud.id);
  }

  if (cloud?.id && process.env.SKIP_UNBUNDLE !== '1') {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-seed-'));
    const snap = path.join(tmp, 'src');
    const bundle = path.join(tmp, 'seed.bundle');
    fs.mkdirSync(snap, { recursive: true });
    execFileSync('rsync', ['-a', '--exclude', '.git', '--exclude', 'node_modules', '--exclude', '.env', '--exclude', 'data', '--exclude', '.expo', `${ROOT}/`, `${snap}/`]);
    execFileSync('git', ['-c', 'safe.directory=*', 'init'], { cwd: snap });
    execFileSync('git', ['config', '--global', '--add', 'safe.directory', '*']);
    const gitc = ['-c', 'safe.directory=*', '-c', 'user.email=seed@aerekos.com', '-c', 'user.name=seed'];
    execFileSync('git', [...gitc, 'add', '-A'], { cwd: snap });
    execFileSync('git', [...gitc, 'commit', '-m', 'seed aerekos-cloud'], { cwd: snap });
    execFileSync('git', [...gitc, 'branch', '-M', 'main'], { cwd: snap });
    execFileSync('git', [...gitc, 'bundle', 'create', bundle, 'HEAD'], { cwd: snap });
    const buf = fs.readFileSync(bundle);
    const un = await api.post(
      `/api/services/git_manager/api/v1/repos/${cloud.id}/unbundle`,
      buf,
      { headers: { 'Content-Type': 'application/octet-stream', 'x-project-id': SYSTEM }, maxBodyLength: Infinity },
    );
    console.log('unbundle:', un.status, un.data?.restored ? 'ok' : (un.data?.error?.message || ''));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  const pipes = await api.get('/api/services/cicd_manager/api/v1/pipelines', { params: { project_id: SYSTEM } });
  const have = (pipes.data?.items || []).find((p) => (p.repo || p.repo_name) === 'aerekos-cloud');
  if (!have && cloud?.id) {
    const pipe = await api.post('/api/services/cicd_manager/api/v1/pipelines', {
      project_id: SYSTEM,
      name: 'aerekos-cloud-fleet',
      repo: 'aerekos-cloud',
      repo_name: 'aerekos-cloud',
      repo_id: cloud.id,
      git_ref: 'main',
      environment: 'prod',
      action: 'fleet',
    });
    console.log('pipeline:', pipe.status, pipe.data?.item?.id || pipe.data?.error?.message);
  } else {
    console.log('pipeline exists');
  }
  console.log('bootstrap done');
}

main().catch((e) => {
  console.error(e.response?.data || e.message);
  process.exit(1);
});
