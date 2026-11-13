'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { fail, scrubSecrets } = require('./agentArn');
const { denyForPersona, pathLooksSecret } = require('./workerRules/denylist');

const WRITE_TOOLS = new Set([
  'file_write', 'file_edit', 'file_delete', 'file_copy',
  'shell', 'git_commit', 'git_push', 'git_checkout',
  'browser_type', 'browser_click', 'browser_select', 'browser_press',
  'connector.invoke', 'file_rollback', 'open_pr', 'iac_put', 'iac_apply', 'iac_rollback',
]);

const READ_TOOLS = new Set([
  'file_read', 'file_list', 'file_search', 'grep',
  'git_status', 'git_diff', 'git_log', 'git_branch',
  'web_search', 'web_fetch', 'browser_navigate', 'browser_snapshot', 'browser_screenshot',
  'semantic_search', 'file_glob', 'iac_schema', 'iac_diff',
  'plan_query', 'plan_ready', 'plan_subgraph', 'explain_why',
]);

function classifyTool(name, args = {}) {
  const n = String(name || '');
  if (n === 'connector.invoke') {
    const tool = String(args.tool || args.name || '');
    const writeish = /send|create|update|delete|put|post|patch|remove|write/i.test(tool);
    return writeish ? 'write' : 'read';
  }
  if (n === 'shell') {
    const cmd = String(args.cmd || args.command || '');
    if (/\brm\b|\bmv\b|\bchmod\b|\bchown\b|sudo|dd\b|>|tee\b/.test(cmd)) return 'write';
    return 'read';
  }
  if (WRITE_TOOLS.has(n)) return 'write';
  return 'read';
}

function dangerClassify(name, args = {}, root, persona = 'dev') {
  const n = String(name || '');
  const cmd = String(args.cmd || args.command || '');
  const packed = denyForPersona(persona, n, args);
  if (packed) return packed;
  if (n === 'file_read' && pathLooksSecret(args.path)) {
    return { level: 'deny', reason: 'refuses reading or writing secrets' };
  }
  if (n === 'shell' && (/rm\s+-rf\s+\/(\s|$)/.test(cmd) || cmd.includes('rm -rf /'))) {
    return { level: 'deny', reason: 'refuses rm -rf /' };
  }
  if (n === 'git_push') {
    return { level: 'ask', reason: 'git_push always ASK' };
  }
  if (n === 'deploy' || n === 'propose_deploy' || n === 'preview' || n === 'scaffold') {
    return { level: 'ask', reason: 'coarse step requires preview' };
  }
  if (classifyTool(n, args) === 'write') return { level: 'ask', reason: 'write requires approval' };
  if (n.startsWith('browser_') && /pay|auth|captcha|password|login|checkout/i.test(JSON.stringify(args))) {
    return { level: 'ask', reason: 'browser HITL — takeover required' };
  }
  void root;
  return { level: 'allow', reason: 'read' };
}

function resolveInWorkspace(root, rel) {
  const base = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
  const target = path.resolve(base, String(rel || '.').replace(/^\/+/, ''));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw fail(403, 'path escapes workspace');
  }
  return target;
}

function snapshotFile(p) {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return { path: p, content: fs.readFileSync(p, 'utf8') };
    }
  } catch { /* */ }
  return null;
}

function executeTool(name, args, ctx) {
  const root = ctx.root || process.cwd();
  const n = String(name || '');
  const persona = ctx.persona || 'dev';
  const packed = denyForPersona(persona, n, args);
  if (packed && packed.level === 'deny') return { ok: false, error: packed.reason, denied: true };
  if (n === 'file_read') {
    const p = resolveInWorkspace(root, args.path);
    return { ok: true, content: fs.readFileSync(p, 'utf8') };
  }
  if (n === 'file_list') {
    const p = resolveInWorkspace(root, args.path || '.');
    const names = fs.readdirSync(p).slice(0, 80);
    return { ok: true, entries: names, truncated: names.length >= 80 };
  }
  if (n === 'file_search' || n === 'grep') {
    const p = resolveInWorkspace(root, args.path || '.');
    const q = String(args.query || args.pattern || '');
    const hits = [];
    const walk = (dir, depth) => {
      if (depth > 8 || hits.length > 50) return;
      let ents = [];
      try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full, depth + 1);
        else if (e.isFile()) {
          try {
            const txt = fs.readFileSync(full, 'utf8');
            if (txt.includes(q) || e.name.includes(q)) hits.push(path.relative(root, full));
          } catch { /* */ }
        }
      }
    };
    walk(p, 0);
    return { ok: true, hits };
  }
  if (n === 'file_write') {
    const p = resolveInWorkspace(root, args.path);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const snap = snapshotFile(p);
    fs.writeFileSync(p, String(args.content ?? args.body ?? ''), 'utf8');
    return { ok: true, path: p, snapshot: snap };
  }
  if (n === 'file_edit') {
    const p = resolveInWorkspace(root, args.path);
    const snap = snapshotFile(p);
    const cur = snap ? snap.content : '';
    const next = cur.split(String(args.old || args.find || '')).join(String(args.new || args.replace || ''));
    fs.writeFileSync(p, next, 'utf8');
    return { ok: true, path: p, snapshot: snap };
  }
  if (n === 'file_delete') {
    const p = resolveInWorkspace(root, args.path);
    const snap = snapshotFile(p);
    fs.unlinkSync(p);
    return { ok: true, snapshot: snap };
  }
  if (n === 'file_copy') {
    const src = resolveInWorkspace(root, args.src || args.from);
    const dest = resolveInWorkspace(root, args.dest || args.to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return { ok: true };
  }
  if (n === 'file_rollback') {
    const p = resolveInWorkspace(root, args.path);
    const content = args.content != null ? String(args.content) : String(args.snapshot?.content || '');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf8');
    return { ok: true, rolled_back: true, path: p };
  }
  if (n === 'shell') {
    const cmd = String(args.cmd || args.command || '');
    try {
      const out = execFileSync('/bin/sh', ['-lc', cmd], {
        cwd: root, timeout: Number(args.timeout_ms || 30000), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
      });
      return { ok: true, stdout: scrubSecrets(out) };
    } catch (e) {
      return { ok: false, stdout: scrubSecrets(e.stdout || ''), stderr: scrubSecrets(e.stderr || e.message) };
    }
  }
  if (n.startsWith('git_')) {
    const sub = n.replace('git_', '');
    if (sub === 'commit') {
      const shop = require('./AgentShop');
      const cmd = shop.gitAddCmd(args.claim || args.path, args.message);
      try {
        const out = execFileSync('/bin/sh', ['-lc', cmd], { cwd: root, encoding: 'utf8', timeout: 15000 });
        return { ok: true, stdout: scrubSecrets(out) };
      } catch (e) {
        return { ok: false, stderr: scrubSecrets(e.message) };
      }
    }
    const extra = [];
    if (sub === 'checkout' && args.branch) extra.push(args.branch);
    if (sub === 'push') extra.push('origin', String(args.branch || 'HEAD'));
    if (sub === 'diff') extra.push('--');
    if (args.path && sub !== 'commit') extra.push(args.path);
    try {
      const out = execFileSync('git', [sub, ...extra], {
        cwd: root, encoding: 'utf8', timeout: 15000,
      });
      return { ok: true, stdout: scrubSecrets(out) };
    } catch (e) {
      return { ok: false, stderr: scrubSecrets(e.message) };
    }
  }
  if (n === 'run_checks') {
    const claim = String(args.claim || args.path || '.').replace(/^\/+/, '');
    const dir = resolveInWorkspace(root, claim || '.');
    const inAi = /ai_manager/.test(claim) || /ai_manager$/.test(dir);
    const cmd = inAi
      ? 'npx jest tests/unit --testPathPattern="shop|agents.e2e|learnNav|offgrid" --no-coverage'
      : 'npx jest --testPathPattern=tests/unit --no-coverage';
    try {
      const out = execFileSync('/bin/sh', ['-lc', cmd], {
        cwd: dir, timeout: 120000, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
      });
      return { ok: true, passed: true, stdout: scrubSecrets(String(out).slice(0, 8000)) };
    } catch (e) {
      return {
        ok: false, passed: false,
        stdout: scrubSecrets(String(e.stdout || '').slice(0, 4000)),
        stderr: scrubSecrets(String(e.stderr || e.message || '').slice(0, 4000)),
      };
    }
  }
  if (n === 'web_search' || n === 'web_fetch' || n === 'semantic_search') {
    return { ok: false, stub: false, tool: n, note: 'runtime resolves web_search / RAG / fetch' };
  }
  if (n.startsWith('browser_')) {
    return { ok: false, stub: false, note: 'runtime proxies to the Playwright sidecar' };
  }
  return { ok: false, error: `unknown tool ${n}` };
}

function openaiToolSchemas() {
  return toolSchemas().map((t) => {
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(t.parameters || {})) {
      properties[k] = { type: v === 'object' ? 'object' : 'string' };
      required.push(k);
    }
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description || t.name,
        parameters: { type: 'object', properties, required },
      },
    };
  });
}

function hangoutReadSchemas() {
  const allow = new Set([
    'file_read', 'file_list', 'grep', 'file_search', 'semantic_search',
    'web_search', 'web_fetch', 'iac_schema', 'iac_diff', 'plan_query', 'plan_ready',
    'plan_subgraph', 'explain_why', 'aerekos_status', 'aerekos_search_docs',
  ]);
  return openaiToolSchemas().filter((t) => allow.has(t.function?.name));
}

/** Coding workers: open_pr yes; never approve_pr / merge / push-default. */
function workerToolSchemas() {
  const deny = new Set(['approve_pr', 'git_merge', 'spawn_worker', 'replan_worker']);
  return openaiToolSchemas().filter((t) => !deny.has(t.function?.name));
}

function extractToolCalls(result) {
  const msg = result?.message || result?.result?.message || {};
  const raw = msg.tool_calls || result?.tool_calls || [];
  const out = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const fn = c.function || c;
    const name = fn.name || c.name;
    let args = fn.arguments != null ? fn.arguments : (c.arguments != null ? c.arguments : c.args || {});
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch { args = { raw: args }; }
    }
    if (name) out.push({ name, args: args && typeof args === 'object' ? args : {} });
  }
  const text = String(msg.content || result?.response || '');
  if (!out.length && /<<TOOL>>/.test(text)) {
    const m = text.match(/<<TOOL>>\s*([A-Za-z0-9_./-]+)\s*([\s\S]*?)(?:<<\/TOOL>>|$)/);
    if (m) {
      let args = {};
      try { args = JSON.parse(String(m[2] || '').trim() || '{}'); } catch { /* */ }
      out.push({ name: m[1], args });
    }
  }
  return out;
}

function toolSchemas() {
  return [
    { name: 'file_read', description: 'Read a file in the workspace', parameters: { path: 'string' } },
    { name: 'file_list', description: 'List a directory', parameters: { path: 'string' } },
    { name: 'file_search', description: 'Search files by name or content', parameters: { query: 'string', path: 'string' } },
    { name: 'grep', description: 'Search file contents', parameters: { pattern: 'string', path: 'string' } },
    { name: 'file_write', description: 'Write a file (ASK)', parameters: { path: 'string', content: 'string' } },
    { name: 'file_edit', description: 'Replace text in a file (ASK)', parameters: { path: 'string', old: 'string', new: 'string' } },
    { name: 'file_delete', description: 'Delete a file (ASK)', parameters: { path: 'string' } },
    { name: 'shell', description: 'Run a command in the workspace (ASK if mutating)', parameters: { cmd: 'string' } },
    { name: 'git_status', description: 'git status', parameters: {} },
    { name: 'git_diff', description: 'git diff', parameters: {} },
    { name: 'git_log', description: 'git log', parameters: {} },
    { name: 'git_commit', description: 'commit claimed paths only (never git add -A, never main)', parameters: { message: 'string', path: 'string' } },
    { name: 'git_push', description: 'push (always ASK)', parameters: { branch: 'string' } },
    { name: 'git_checkout', description: 'checkout a branch (PR branch icarus/<task>)', parameters: { branch: 'string' } },
    { name: 'web_search', description: 'Search the public web (not local FTS)', parameters: { q: 'string' } },
    { name: 'web_fetch', description: 'Fetch a URL', parameters: { url: 'string' } },
    { name: 'semantic_search', description: 'Workspace RAG / FTS only', parameters: { query: 'string' } },
    { name: 'file_rollback', description: 'Restore a file snapshot (ASK)', parameters: { path: 'string', content: 'string' } },
    { name: 'browser_navigate', description: 'Open a page then screenshot (HITL on pay/auth/captcha)', parameters: { url: 'string' } },
    { name: 'browser_snapshot', description: 'A11y snapshot of the current page', parameters: {} },
    { name: 'browser_screenshot', description: 'Take a jpeg of the current page', parameters: {} },
    { name: 'browser_click', description: 'Click by text or selector (Agent mode)', parameters: { selector: 'string' } },
    { name: 'browser_type', description: 'Type into a field', parameters: { text: 'string', selector: 'string' } },
    { name: 'browser_press', description: 'Press a key', parameters: { key: 'string' } },
    { name: 'browser_select', description: 'Select an option', parameters: { selector: 'string', value: 'string' } },
    { name: 'open_pr', description: 'Coding agent: create a PR (higher model approves; user merges)', parameters: { title: 'string', summary: 'string', files: 'string', diff: 'string', branch: 'string' } },
    { name: 'approve_pr', description: 'Manager/review (higher model): approve, request changes, or reject a coding-agent PR', parameters: { pr_id: 'string' } },
    { name: 'lora_propose', description: 'Propose Orin LoRA train for coding or higher-model tool calls (Qwen local / Gemma4→minis)', parameters: { agent_kind: 'string', base_model: 'string', adapter_name: 'string', dataset_preview: 'string' } },
    { name: 'plan_query', description: 'User-layer safe Neo4j read against the plan graph', parameters: { cypher: 'string' } },
    { name: 'plan_ready', description: 'List ready-set tasks from the plan graph', parameters: { plan_id: 'string' } },
    { name: 'plan_subgraph', description: 'Fetch plan tasks + BEFORE/PARALLEL/MUTEX edges', parameters: { plan_id: 'string' } },
    { name: 'explain_why', description: 'Explain why a task/decision happened', parameters: { task_id: 'string' } },
    { name: 'ui_navigate', description: 'Cloud UI nav hint for the user layer', parameters: { path: 'string', note: 'string' } },
    { name: 'project_create', description: 'Ask to create a cloud project (policy gated)', parameters: { name: 'string', template: 'string' } },
    { name: 'iac_schema', description: 'Empty project-stack JSON + catalog keys', parameters: {} },
    { name: 'iac_put', description: 'Draft project-stack JSON', parameters: { stack: 'object' } },
    { name: 'iac_diff', description: 'Diff draft vs applied stack', parameters: {} },
    { name: 'iac_apply', description: 'Apply stack (always ASK, never prod)', parameters: {} },
    { name: 'iac_rollback', description: 'Roll back last stack apply (ASK)', parameters: {} },
    { name: 'connector.invoke', description: 'Invoke a project connector', parameters: { connector: 'string', tool: 'string', args: 'object' } },
    { name: 'report_manager', description: 'Tell the manager what you tried. Never say impossible to the client.', parameters: { tried: 'string', error: 'string' } },
    { name: 'preview', description: 'Ask the user layer for a high-level sound-good on folder/repo/service/deploy', parameters: { type: 'string', path: 'string', name: 'string', why: 'string' } },
    { name: 'propose_deploy', description: 'Ask to deploy frontend, conductor, or ai_manager', parameters: { target: 'string' } },
    { name: 'submit_brief', description: 'User layer: send a brief to the manager after the plan is accepted', parameters: { goal: 'string', done_when: 'string', constraints: 'string', client_words: 'string' } },
    { name: 'update_brief', description: 'User layer: update the current brief', parameters: { goal: 'string', done_when: 'string', unknowns: 'string' } },
    { name: 'open_ask', description: 'User layer: blocker ASK only', parameters: { text: 'string', kind: 'string', options: 'string' } },
    { name: 'open_plan_q', description: 'User layer: one planning question', parameters: { text: 'string', options: 'string' } },
    { name: 'propose_plan', description: 'User/manager: show a step list and wait for Run it', parameters: { steps: 'string', origin: 'string' } },
    { name: 'revise_plan', description: 'Revise the open plan from user feedback', parameters: { note: 'string' } },
    { name: 'learn_propose', description: 'List sources to learn; ASK before ingest', parameters: { sources: 'string' } },
    { name: 'learn_ingest', description: 'Ingest approved sources into skills RAG', parameters: { job_id: 'string' } },
    { name: 'spawn_worker', description: 'Manager: spawn a worker after preview Yes', parameters: { persona: 'string', objective: 'string', claim_prefix: 'string' } },
    { name: 'update_work', description: 'Manager: update goal/task status or priority on the board', parameters: { work_id: 'string', status: 'string', title: 'string', priority: 'string' } },
    { name: 'replan_worker', description: 'Manager: replan a stuck worker', parameters: { worker_id: 'string', note: 'string' } },
    { name: 'report_user', description: 'Manager: options-out or preview to the user layer', parameters: { text: 'string', options: 'string' } },
    { name: 'run_checks', description: 'Run unit tests for the claimed path. No npm install.', parameters: { claim: 'string' } },
    { name: 'aerekos_status', description: 'Read platform/manager health or status (user lane GET-safe)', parameters: { manager: 'string', path: 'string' } },
    { name: 'aerekos_search_docs', description: 'Search platform docs / catalog RAG', parameters: { query: 'string' } },
    { name: 'aerekos_call', description: 'Call an aerekos manager via SDK (manager lane; mutating needs ASK)', parameters: { manager: 'string', method: 'string', path: 'string', body: 'object' } },
    { name: 'rag_ingest', description: 'Ingest text/URL into knowledge RAG (ASK)', parameters: { collection: 'string', title: 'string', content: 'string', url: 'string' } },
    { name: 'data_api_apply', description: 'Apply Data API schema (models→CRUD) via api_manager / stack', parameters: { name: 'string', schema: 'object', engine: 'string' } },
    { name: 'project_services', description: 'List live services attached to this project stack', parameters: {} },
  ];
}

module.exports = {
  WRITE_TOOLS, READ_TOOLS, classifyTool, dangerClassify, resolveInWorkspace,
  executeTool, snapshotFile, toolSchemas, openaiToolSchemas, extractToolCalls, hangoutReadSchemas,
  workerToolSchemas,
};
