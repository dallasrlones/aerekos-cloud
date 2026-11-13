'use strict';

/**
 * W18 tool sandbox — scope checks for filesystem / network / compute; deny escalate (fail closed).
 */

const fs = require('fs');
const path = require('path');
const { resolveInWorkspace } = require('./workspaceTools');
const { charter } = require('./CharterService');

const FS_TOOLS = new Set([
  'file_read', 'file_list', 'file_search', 'grep', 'file_write', 'file_edit',
  'file_delete', 'file_copy', 'file_rollback', 'file_glob', 'semantic_search',
  'git_status', 'git_diff', 'git_log', 'git_branch', 'git_commit', 'git_push', 'git_checkout',
]);

const NET_TOOLS = new Set([
  'web_fetch', 'web_search', 'browser_navigate', 'connector.invoke',
  'aerekos_call', 'aerekos_status', 'aerekos_search_docs', 'rag_ingest',
]);

const COMPUTE_TOOLS = new Set(['shell', 'run_checks', 'deploy', 'scaffold', 'iac_apply', 'iac_rollback']);

const TRAVERSAL_RE = /(?:\.\.(\/|\\|%2f|%5c|%252f))|(?:^|\/)etc\/passwd|(?:^|\/)proc\/self\b/i;
const NULL_BYTE_RE = /%00|\\x00|\u0000/;
const INJECTION_PATH_RE = /[;&|`]|\$\(|<\(|>\(/;
const INJECTION_CMD_RE = /ignore\s+(all\s+)?(previous|prior)\s+instructions|system\s*:\s*you\s+are/i;
const ESCALATE_CMD_RE = /\b(sudo|doas|su\s+-|nsenter|setuid|cap-add|--privileged)\b/i;
const ESCALATE_TOOL_RE = /^escalat|privilege_escalat/i;

const PRIVATE_HOST_RE = /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|metadata\.google)/i;

function toolScope(name) {
  const n = String(name || '');
  if (FS_TOOLS.has(n) || n.startsWith('git_') || n.startsWith('iac_')) return 'filesystem';
  if (NET_TOOLS.has(n) || n.startsWith('browser_')) return 'network';
  if (COMPUTE_TOOLS.has(n)) return 'compute';
  return 'meta';
}

function normalizeUrl(href) {
  return String(href || '').trim().replace(/\\+/g, '');
}

function checkNetworkTarget(href) {
  const raw = normalizeUrl(href);
  if (!raw) return { allow: false, reason: 'network_url_required' };
  if (/^(file|gopher|ftp|data):/i.test(raw)) return { allow: false, reason: 'network_scheme_denied' };
  let host = '';
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (!/^https?:$/i.test(u.protocol)) return { allow: false, reason: 'network_scheme_denied' };
    host = u.hostname || '';
  } catch {
    return { allow: false, reason: 'network_url_invalid' };
  }
  if (!host || host === '0.0.0.0') return { allow: false, reason: 'network_host_denied' };
  if (PRIVATE_HOST_RE.test(host) || host.endsWith('.internal') || host === 'metadata') {
    return { allow: false, reason: 'network_ssrf_denied' };
  }
  if (/%0[0-9a-f]/i.test(raw) || NULL_BYTE_RE.test(raw)) {
    return { allow: false, reason: 'injection_url' };
  }
  return { allow: true };
}

function collectPaths(args = {}) {
  const out = [];
  for (const k of ['path', 'src', 'dest', 'from', 'to', 'claim', 'branch']) {
    if (args[k] != null && args[k] !== '') out.push(String(args[k]));
  }
  return out;
}

function checkFilesystemPaths(args, ctx = {}) {
  const root = ctx.root;
  for (const rel of collectPaths(args)) {
    if (TRAVERSAL_RE.test(rel) || NULL_BYTE_RE.test(rel)) {
      return { allow: false, reason: 'path_traversal' };
    }
    if (ctx.injection_harden && INJECTION_PATH_RE.test(rel)) {
      return { allow: false, reason: 'injection_path' };
    }
    if (root) {
      try {
        resolveInWorkspace(root, rel);
      } catch (e) {
        return { allow: false, reason: e.message?.includes('escapes') ? 'path_traversal' : 'filesystem_denied' };
      }
    }
  }
  return { allow: true };
}

/**
 * @returns {{ allow: boolean, reason?: string, scope: string, denied?: boolean }}
 */
function checkToolCall(name, args = {}, ctx = {}) {
  const scope = toolScope(name);
  const n = String(name || '');
  const projectId = ctx.projectId;
  const c = projectId ? charter.get(projectId) : { injection_harden: true };
  const injection_harden = ctx.injection_harden != null ? ctx.injection_harden : c.injection_harden !== false;

  if (ESCALATE_TOOL_RE.test(n)) {
    return { allow: false, denied: true, reason: 'deny_escalate', scope };
  }
  if (n === 'shell' && ESCALATE_CMD_RE.test(String(args.cmd || args.command || ''))) {
    return { allow: false, denied: true, reason: 'deny_escalate', scope: 'compute' };
  }
  if (injection_harden && n === 'shell') {
    const cmd = String(args.cmd || args.command || '');
    if (INJECTION_CMD_RE.test(cmd)) {
      return { allow: false, denied: true, reason: 'injection_cmd', scope: 'compute' };
    }
  }

  if (scope === 'filesystem' || FS_TOOLS.has(n)) {
    const fsHit = checkFilesystemPaths(args, { ...ctx, injection_harden });
    if (!fsHit.allow) return { ...fsHit, denied: true, scope: 'filesystem' };
  }

  if (scope === 'network' || n.startsWith('browser_')) {
    const url = args.url || args.q || args.href;
    if (url) {
      const net = checkNetworkTarget(url);
      if (!net.allow) return { ...net, denied: true, scope: 'network' };
    }
    if (n === 'connector.invoke' || n === 'aerekos_call') {
      const blob = JSON.stringify(args);
      if (PRIVATE_HOST_RE.test(blob) || /metadata\.google/i.test(blob)) {
        return { allow: false, denied: true, reason: 'network_ssrf_denied', scope: 'network' };
      }
    }
  }

  if (scope === 'compute' && n === 'shell') {
    const cmd = String(args.cmd || args.command || '');
    if (/\brm\s+-rf\s+\/(\s|$)/.test(cmd)) {
      return { allow: false, denied: true, reason: 'compute_denied', scope: 'compute' };
    }
  }

  if (args?.escalate === true || args?.privilege === 'escalate') {
    return { allow: false, denied: true, reason: 'deny_escalate', scope };
  }

  return { allow: true, scope };
}

/** Fail-closed wrapper for dispatch — returns denial payload instead of throwing. */
function guardToolCall(name, args, ctx = {}) {
  const hit = checkToolCall(name, args, ctx);
  if (hit.allow) return null;
  return {
    ok: false,
    denied: true,
    error: hit.reason || 'sandbox_denied',
    sandbox: { scope: hit.scope, reason: hit.reason },
  };
}

module.exports = {
  ToolSandbox: { checkToolCall, guardToolCall, toolScope, checkNetworkTarget, checkFilesystemPaths },
  checkToolCall,
  guardToolCall,
  toolScope,
  checkNetworkTarget,
  checkFilesystemPaths,
  FS_TOOLS,
  NET_TOOLS,
  COMPUTE_TOOLS,
};
