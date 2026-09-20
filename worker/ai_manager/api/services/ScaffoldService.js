'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { fail } = require('./agentArn');
const { resolveInWorkspace } = require('./workspaceTools');

function folder(root, rel) {
  const p = resolveInWorkspace(root, rel || 'scratch');
  fs.mkdirSync(p, { recursive: true });
  return { ok: true, type: 'folder', path: p };
}

function repo(root, rel) {
  const p = resolveInWorkspace(root, rel || '.');
  fs.mkdirSync(p, { recursive: true });
  try {
    execFileSync('git', ['init'], { cwd: p, encoding: 'utf8', timeout: 15000 });
  } catch (e) {
    return { ok: false, type: 'repo', path: p, error: e.message, note: 'git init in jail; not GitHub.com' };
  }
  return { ok: true, type: 'repo', path: p, note: 'git init in jail; not GitHub.com' };
}

function service(root, name) {
  const n = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '');
  if (!n) throw fail(400, 'service name required');
  const dir = resolveInWorkspace(root, path.join('aerekos/aerekos-cloud/worker', n));
  fs.mkdirSync(dir, { recursive: true });
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(readme, `# ${n}\n\nMonorepo service stub. Compose wire-up is a separate preview.\n`, 'utf8');
  }
  const stub = path.join(dir, 'index.js');
  if (!fs.existsSync(stub)) {
    fs.writeFileSync(stub, `'use strict';\nmodule.exports = { name: ${JSON.stringify(n)} };\n`, 'utf8');
  }
  const catalogHint = path.join(dir, 'CATALOG.stub.md');
  if (!fs.existsSync(catalogHint)) {
    fs.writeFileSync(
      catalogHint,
      `Add a docs/catalog.js entry for ${n} after the compose preview. Do not docker compose a new stack on prod-mini yet.\n`,
      'utf8',
    );
  }
  return { ok: true, type: 'service', path: dir, name: n, compose: 'second-preview' };
}

function apply(root, preview = {}) {
  const t = String(preview.type || 'other');
  if (t === 'folder') return folder(root, preview.path || preview.name);
  if (t === 'repo') return repo(root, preview.path || preview.name);
  if (t === 'service') return service(root, preview.name);
  return { ok: true, type: t, skipped: true };
}

module.exports = { folder, repo, service, apply };
