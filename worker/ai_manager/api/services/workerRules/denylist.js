'use strict';

const PROD_PROJECT = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

const SECRET_PATH = /(^|\/)(\.env|\.env\.[^/]+|worker\/\.env)(\/|$)|(\.pem|\.key|id_rsa|credentials\.json)$/i;
const PROD_DATA = /(^|\/)(data|\.db|.*\.db)(\/|$)|node_modules/i;
const DANGER_CMD = /rm\s+-rf\s+\/(\s|$)|deploy\.sh\s+full|--remove-orphans|auth_manager|vllm/i;
const E2E_PROD = new RegExp(PROD_PROJECT.replace(/-/g, '\\-'));

function pathLooksSecret(p) {
  return SECRET_PATH.test(String(p || ''));
}

function pathLooksProdData(p) {
  const s = String(p || '');
  if (pathLooksSecret(s)) return true;
  if (/(^|\/)data(\/|$)/.test(s)) return true;
  if (/\.db(-wal|-shm)?$/i.test(s)) return true;
  if (/(^|\/)node_modules(\/|$)/.test(s)) return true;
  return false;
}

function cmdDenied(cmd) {
  const c = String(cmd || '');
  if (DANGER_CMD.test(c)) return { deny: true, reason: 'refuses dangerous host command' };
  if (/rm\s+-rf\s+(\.\/)?data\b/.test(c)) return { deny: true, reason: 'refuses deleting live data' };
  if (E2E_PROD.test(c)) return { deny: true, reason: 'refuses production project e2e' };
  if (/cat\s+.*\.env|less\s+.*\.env|head\s+.*\.env/.test(c)) {
    return { deny: true, reason: 'refuses reading secrets' };
  }
  return { deny: false };
}

function denyForPersona(persona, name, args = {}) {
  const p = String(persona || 'dev');
  const n = String(name || '');
  const rel = String(args.path || args.src || args.dest || args.from || args.to || '');
  const cmd = String(args.cmd || args.command || '');

  if (p === 'research') {
    const writes = /file_write|file_edit|file_delete|file_copy|git_commit|git_push|git_checkout|deploy|scaffold/;
    if (writes.test(n) || (n === 'shell' && /rm\b|mv\b|>|tee\b/.test(cmd))) {
      return { level: 'deny', reason: 'research persona cannot write' };
    }
  }
  if (p === 'comms') {
    if (/^file_|git_|shell|deploy|scaffold/.test(n)) {
      return { level: 'deny', reason: 'comms persona cannot mutate the filesystem' };
    }
  }
  if (p === 'manager') {
    if (/file_write|file_edit|file_delete|git_commit|git_push|deploy/.test(n)) {
      return { level: 'deny', reason: 'manager does not mutate the jail' };
    }
  }

  if (n === 'file_read' || n === 'file_write' || n === 'file_edit' || n === 'file_delete') {
    if (pathLooksSecret(rel)) return { level: 'deny', reason: 'refuses reading or writing secrets' };
  }
  if ((n === 'file_delete' || n === 'file_write') && pathLooksProdData(rel) && pathLooksSecret(rel) === false) {
    if (/(^|\/)data(\/|$)/.test(rel) || /\.db/.test(rel)) {
      return { level: 'deny', reason: 'refuses deleting live data' };
    }
  }
  if (n === 'shell') {
    const hit = cmdDenied(cmd);
    if (hit.deny) return { level: 'deny', reason: hit.reason };
    if (pathLooksSecret(cmd)) return { level: 'deny', reason: 'refuses reading or writing secrets' };
  }
  if (n === 'deploy' && /vllm|auth_manager|remove-orphans|deploy\.sh/.test(JSON.stringify(args))) {
    return { level: 'deny', reason: 'deploy target denied' };
  }
  return null;
}

function packText(persona) {
  const p = String(persona || 'dev');
  try {
    const fs = require('fs');
    const path = require('path');
    const f = path.join(__dirname, `${p}.md`);
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  } catch { /* */ }
  return `Persona ${p}. Follow aerekos-cloud hard rules. Never delete prod data or read .env.`;
}

module.exports = {
  PROD_PROJECT, pathLooksSecret, pathLooksProdData, cmdDenied, denyForPersona, packText,
};
