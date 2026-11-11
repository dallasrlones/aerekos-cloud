'use strict';

const { needsPlan, inferPlanSteps, speakPlan, applyRevision } = require('./AgentPlanService');
const { looksLearn } = require('./AgentLearnService');
const { parseCronIntent } = require('./cronMatch');

const path = require('path');
const { pathLooksSecret } = require('./workerRules/denylist');

const { SYSTEM_PROJECT_ID } = require('./layerContext');

const MAX_TURNS = 12;
const MAX_ACT = 4;
const MAX_RETRY = 3;
const MAX_REPLAN = 3;
const PROD_PROJECT = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const BROWSE_FANOUT = false;
const SELF_CLAIM = 'aerekos/aerekos-cloud/worker/ai_manager';
const CLOUD_CLAIM = 'aerekos/aerekos-cloud';
const HANGOUT_READ = ['file_read', 'file_list', 'grep', 'file_search', 'semantic_search'];

function resolveTarget(text, ctx = {}) {
  const t = String(text || '');
  const projectId = ctx.projectId || '';
  const projectName = String(ctx.projectName || ctx.project_name || '').trim();
  const repo = String(ctx.project_repo || ctx.settings?.project_repo || '').replace(/^\/+/, '');
  if (/\b(yourself|your own (code|codebase|repo)|icarus-agent|\byour code\b|the agent)\b/i.test(t)
    && !/\bthis project\b/i.test(t)) {
    return { kind: 'self', claim: SELF_CLAIM, label: 'Icarus on aerekos-cloud' };
  }
  if (/\b(aerekos-cloud|control plane|the cloud)\b/i.test(t) || /\bconductor\b/i.test(t) && /\b(code|repo|fix|edit)\b/i.test(t)) {
    return { kind: 'cloud', claim: CLOUD_CLAIM, label: 'aerekos-cloud' };
  }
  const named = t.match(/\bproject\s+([a-zA-Z0-9._-]+)/i);
  if (named && !/^(stack|id)$/i.test(named[1])) {
    return { kind: 'project', claim: repo || named[1], label: `project ${named[1]}` };
  }
  if (/\bthis project\b/i.test(t) && projectName && projectId && projectId !== SYSTEM_PROJECT_ID) {
    return { kind: 'project', claim: repo || projectName, label: `project ${projectName}` };
  }
  if (projectId && projectId !== SYSTEM_PROJECT_ID && projectName && /\b(code|file|repo|fix|build|implement)\b/i.test(t)) {
    return { kind: 'project', claim: repo || projectName, label: `project ${projectName}` };
  }
  return { kind: 'self', claim: SELF_CLAIM, label: 'Icarus on aerekos-cloud' };
}

function parseRelationships(raw) {
  if (!raw) return { related: [], blocks: [], blocked_by: [] };
  if (Array.isArray(raw)) return { related: raw.map(String), blocks: [], blocked_by: [] };
  if (typeof raw === 'string') {
    try { return parseRelationships(JSON.parse(raw || '{}')); } catch { return { related: [], blocks: [], blocked_by: [] }; }
  }
  return {
    related: [].concat(raw.related || []).map(String),
    blocks: [].concat(raw.blocks || []).map(String),
    blocked_by: [].concat(raw.blocked_by || []).map(String),
  };
}

function routeChat(mode) {
  const m = String(mode || 'ask');
  if (m === 'ask') return { layer: 'user', shop: false };
  return { layer: 'user', shop: true };
}

function inferName(text, fallback) {
  const m = String(text || '').match(/\b(?:folder|repo|service|worker|project|named?)\s+([a-zA-Z0-9._-]+)/i);
  return m ? m[1] : fallback;
}

function inferPath(text) {
  const m = String(text || '').match(/\b(?:folder|dir(?:ectory)?|mkdir)\s+([A-Za-z0-9._/-]+)/i);
  return m ? m[1] : 'scratch';
}

function inferHost(text) {
  const m = String(text || '').match(/https?:\/\/[^\s]+/i) || String(text || '').match(/\b(?:go to|open|visit)\s+([a-z0-9.-]+\.[a-z]{2,}\S*)/i);
  if (!m) return '';
  try {
    const raw = m[1] || m[0];
    const u = new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`);
    return u.host;
  } catch {
    return '';
  }
}

function inferPreview(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(learn|whitepaper|update yourself|ingest (this|the) (paper|repo|docs))\b/.test(t)) {
    return { type: 'learn', name: inferName(t, 'skills'), why: 'hunt sources, ASK, ingest into skills RAG' };
  }
  if (/\b(new project|stand up a project|project-stack|infra as code|\biac\b)\b/.test(t)) {
    return { type: 'iac', name: inferName(t, 'project'), why: 'write project-stack JSON and apply' };
  }
  if (/\bdeploy\b/.test(t)) return { type: 'deploy', name: inferName(t, 'frontend'), why: 'deploy an allowlisted target' };
  if (/\b(go to|browse|open the site|visit)\b/.test(t) || /\bhttps?:\/\//.test(t)) {
    return {
      type: 'browse',
      name: inferHost(t) || inferName(t, 'site'),
      host: inferHost(t),
      why: 'open a site, screenshot, ask what next',
    };
  }
  if (/\bservice\b|\bmanager\b/.test(t) && /\bcreate|add|scaffold|new\b/.test(t) && !/\bproject\b/.test(t)) {
    return { type: 'service', name: inferName(t, 'new_service'), why: 'scaffold a monorepo service' };
  }
  if (/\brepo\b|\bgit init\b/.test(t)) return { type: 'repo', name: inferName(t, 'repo'), why: 'init a git repo in the jail' };
  if (/\bfolder\b|\bmkdir\b|\bdirectory\b/.test(t)) {
    return { type: 'folder', path: inferPath(t), why: 'create a folder in the jail' };
  }
  return { type: 'other', name: inferName(t, 'change'), why: String(text || 'this work').slice(0, 160) };
}

function briefIsClear(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  const p = inferPreview(t);
  if (['folder', 'repo', 'service', 'deploy', 'browse', 'iac'].includes(p.type)) return true;
  return t.length >= 24 && /\b(create|fix|implement|add|build|search|look up|deploy|browse)\b/i.test(t);
}

function briefFromText(text, ctx = {}) {
  const goal = String(text || '').trim().slice(0, 400);
  const preview = inferPreview(goal);
  const target = resolveTarget(goal, ctx);
  preview.target_kind = target.kind;
  preview.target_label = target.label;
  preview.claim = preview.type === 'folder' ? (preview.path || target.claim) : (preview.path || preview.name || target.claim);
  return {
    goal,
    done_when: preview.type === 'browse'
      ? 'you saw the page and we did what you asked, or you said Done'
      : 'the previewed chunk is done and you like the result',
    constraints: ['do not restart vLLM', 'do not touch auth_manager', 'no production project e2e'],
    unknowns: briefIsClear(goal) ? [] : ['goal'],
    client_words: goal,
    status: 'submitted',
    preview,
  };
}

function canWrite({ mode, chunkGrant, approved }) {
  if (String(mode) === 'plan') return false;
  if (String(mode) !== 'agent') return false;
  if (approved && chunkGrant) return true;
  return !!chunkGrant;
}

function voiceIntent(transcript, openAsk) {
  const t = String(transcript || '').trim().toLowerCase();
  if (/^(stop|cancel|abort)\b/.test(t)) return { action: 'interrupt', answer: 'stop' };
  if (!openAsk) return { action: 'chat' };
  if (openAsk.kind === 'plan' && /\b(run (that |the )?plan|let's run|lets run)\b/i.test(t)) {
    return { action: 'approve', answer: 'Run it' };
  }
  if (/^(yes|ok|okay|yep|yeah|go|go ahead|sound good|sounds good|merge|run it)\b/.test(t)) {
    return { action: 'approve', answer: openAsk.recommended || 'Yes' };
  }
  if (/^(no|nope|skip|nah|reject)\b/.test(t)) return { action: 'approve', answer: 'No' };
  if (openAsk.kind === 'browse' && !isReorder(t) && !/^done\b/.test(t)) {
    return { action: 'approve', answer: String(transcript || '').trim() };
  }
  if (/^done\b/.test(t) && openAsk.kind === 'browse') return { action: 'approve', answer: 'Done' };
  return { action: 'chat' };
}

function isReorder(text) {
  return /\b(do .+ first|pause (browse|this)|after (the )?(pic|screenshot)|repriorit|bump|now is)\b/i.test(String(text || ''));
}

function reorderIntent(text) {
  const t = String(text || '').trim();
  if (!isReorder(t)) return null;
  return { action: 'reorder', note: t, pause_browse: /pause browse|stop this, do/i.test(t) };
}

function speakPreview(preview) {
  const p = preview || {};
  const where = p.target_label ? ` (${p.target_label})` : '';
  if (p.type === 'deploy' && /ai_manager/.test(String(p.name || p.target || ''))) {
    return 'Deploying ai_manager restarts the brain. I will resume after. Sound good?';
  }
  if (p.type === 'deploy') return `Deploy ${p.name || p.target || 'the console'}? Sound good?`;
  if (p.type === 'folder') return `Create folder ${p.path || p.name || ''} in the jail. Sound good?`;
  if (p.type === 'repo') return `Init a git repo ${p.name || ''} in the jail — not GitHub. Sound good?`;
  if (p.type === 'service') return `Scaffold service ${p.name || ''} in the monorepo. Compose wire-up is a later question. Sound good?`;
  if (p.type === 'browse') return `Open ${p.host || p.name || 'the site'}, take a picture, and ask what next. Sound good?`;
  if (p.type === 'iac' || p.type === 'project') {
    return `Write a project-stack JSON and apply it (new or existing project, never prod). Sound good?`;
  }
  if (p.type === 'learn') return `Hunt sources, list them, and ASK before ingesting into skills. Sound good?`;
  if (p.target_kind === 'self') return 'Edit Icarus on aerekos-cloud. Sound good?';
  if (p.target_kind === 'cloud') return 'Edit aerekos-cloud. Sound good?';
  if (p.target_label) return `Edit ${p.target_label}. Sound good?`;
  return `Work on this${where}: ${p.why || 'the next chunk'}. Sound good?`;
}

function userFacingImpossible(text) {
  return /\bimpossible\b/i.test(String(text || ''));
}

function truncateList(entries, cap = 80) {
  const rows = Array.isArray(entries) ? entries.slice(0, cap) : [];
  return { entries: rows, truncated: Array.isArray(entries) && entries.length > cap };
}

function claimPath(preview = {}, fallback = '') {
  const p = preview.path || preview.name || fallback;
  return String(p || '').replace(/^\/+/, '').replace(/\.\./g, '') || '';
}

function pathUnderClaim(filePath, claim) {
  if (!claim) return true;
  const rel = String(filePath || '').replace(/^\/+/, '');
  const c = String(claim).replace(/^\/+/, '');
  if (c.startsWith('wt-') && c.length <= 16) return true;
  return rel === c || rel.startsWith(`${c}/`) || rel.startsWith(`${c}${path.sep}`);
}

function looksSearchGoal(text) {
  return /\b(look up|what is|docs for|search the web|define)\b/i.test(String(text || ''))
    && !/\b(go to|open the site|visit|click|fill the form)\b/i.test(String(text || ''));
}

function looksSiteGoal(text) {
  return /\b(go to|open the site|visit|click|fill the form|search the store)\b/i.test(String(text || ''))
    || /\bhttps?:\/\//i.test(String(text || ''));
}

function hostOf(url) {
  try { return new URL(String(url)).host; } catch { return ''; }
}

function verifyTool(call, ctx = {}) {
  const name = String(call?.name || '');
  const args = call?.args || {};
  const goal = String(ctx.goal || ctx.brief || '');
  const claim = String(ctx.claim || ctx.claim_prefix || '');
  const preview = ctx.preview || {};
  const mode = String(ctx.mode || 'agent');
  const blob = JSON.stringify(args);

  if (/ea370977-3aff-4c76-95a6-a0c50fd2bce7/.test(blob) || ctx.projectId === PROD_PROJECT) {
    if (/iac_|stack|apply/.test(name)) {
      return { ok: false, level: 'deny', reason: 'never apply to the production project' };
    }
  }
  if (pathLooksSecret(args.path || args.file || '')) {
    return { ok: false, level: 'deny', reason: 'refuses reading or writing secrets' };
  }
  if (name === 'git_push') {
    return { ok: false, level: 'ask', reason: 'git_push always ASK', ask: true };
  }
  if (name === 'git_commit' || name === 'git_merge' || (name === 'shell' && /\bgit\s+(commit|merge|push)\b/.test(String(args.cmd || '')))) {
    const branch = String(args.branch || args.ref || ctx.branch || '');
    if (/^(main|master)$/.test(branch)) {
      return { ok: false, level: 'deny', reason: 'commits stay on the PR branch; never git add -A' };
    }
    if (/\bgit add -A\b/.test(String(args.cmd || ''))) {
      return { ok: false, level: 'deny', reason: 'never git add -A; stage claimed paths only' };
    }
  }
  if (name === 'iac_apply' && ctx.projectId === PROD_PROJECT) {
    return { ok: false, level: 'deny', reason: 'never apply to the production project' };
  }
  if (name.startsWith('browser_') && /pay|auth|captcha|password|login|checkout/i.test(blob)) {
    return { ok: false, level: 'ask', reason: 'browser HITL — takeover required', ask: true, hitl: true };
  }
  if (name.startsWith('browser_') && (name === 'browser_click' || name === 'browser_type') && mode === 'plan') {
    return { ok: false, level: 'ask', reason: 'plan mode is read-only; switch to Agent to click', ask: true };
  }
  if (name === 'browser_navigate' || name.startsWith('browser_')) {
    if (looksSearchGoal(goal) && !looksSiteGoal(goal)) {
      return { ok: false, level: 'deny', reason: 'search-shaped goal: use web_search/web_fetch, not the browser' };
    }
    const want = preview.host || inferHost(goal);
    const got = hostOf(args.url || args.href || '');
    if (name === 'browser_navigate' && want && got && !got.endsWith(want) && !want.endsWith(got)) {
      return { ok: false, level: 'ask', reason: 'different site than the brief', ask: true };
    }
    if (ctx.browser_owner && ctx.worker_id && ctx.browser_owner !== ctx.worker_id) {
      return { ok: false, level: 'deny', reason: 'another worker owns the browser session' };
    }
  }
  if (name === 'learn_ingest') {
    if (ctx.planAccepted && ctx.preview?.type === 'learn') return { ok: true, level: 'allow', reason: 'plan grant' };
    if (ctx.chunkGrant && (preview.type === 'learn' || ctx.askKind === 'learn')) {
      return { ok: true, level: 'allow', reason: 'learn ASK grant' };
    }
    return { ok: false, level: 'ask', reason: 'need learn ASK before ingest', ask: true };
  }
  if (name === 'submit_brief' && ctx.requirePlan && !ctx.planAccepted) {
    return { ok: false, level: 'deny', reason: 'plan not accepted' };
  }
  if (name === 'web_search' && looksSiteGoal(goal) && ctx.requireSite !== false) {
    if (!ctx.allowSearchOnSite) {
      return { ok: false, level: 'deny', reason: 'site-shaped goal: browse the site, do not stop at web_search' };
    }
  }
  const writeNames = /file_write|file_edit|file_delete|file_copy|file_rollback|scaffold/;
  if (writeNames.test(name) || (name === 'shell' && /\brm\b|\bmv\b|>|tee\b/.test(String(args.cmd || '')))) {
    const p = args.path || args.dest || args.to || '';
    if (p && claim && !pathUnderClaim(p, claim) && !pathUnderClaim(claimPath(preview), claim)) {
      if (preview.path && !pathUnderClaim(p, preview.path) && preview.name && !pathUnderClaim(p, preview.name)) {
        return { ok: false, level: 'deny', reason: 'write outside the claimed chunk' };
      }
      if (preview.path && !pathUnderClaim(p, String(preview.path))) {
        return { ok: false, level: 'deny', reason: 'write outside the claimed chunk' };
      }
    }
    if (p && preview.path && !pathUnderClaim(p, String(preview.path)) && preview.type === 'folder') {
      return { ok: false, level: 'deny', reason: 'write outside the preview folder' };
    }
  }
  return { ok: true, level: 'allow', reason: 'ok' };
}

function trivialPrFiles(files) {
  const list = (files || []).map((f) => String(f.path || f || '').replace(/\\/g, '/'));
  if (!list.length || list.length > 2) return false;
  return list.every((p) => {
    const base = p.split('/').pop() || '';
    if (!base) return true;
    if (base === '.gitkeep') return true;
    if (/\.md$/i.test(base)) return true;
    if (/\.(js|ts|tsx|py|go|rb|java|yml|yaml|json|env|sh)$/i.test(base)) return false;
    if (/compose|dockerfile|\.env/i.test(base)) return false;
    return !/\./.test(base);
  });
}

function reviewPr({ files = [], claim = '', staged = [] }) {
  const list = Array.isArray(files)
    ? files
    : String(files || '').split(',').map((s) => s.trim()).filter(Boolean);
  const names = list.map((f) => String(f.path || f || ''));
  if (names.some((p) => pathLooksSecret(p) || /\.env/.test(p))) {
    return { verdict: 'request_changes', reason: 'secret or .env in the diff' };
  }
  if (staged.includes('-A') || staged.includes('--all')) {
    return { verdict: 'request_changes', reason: 'git add -A is denied' };
  }
  if (claim && names.some((p) => p && !pathUnderClaim(p, claim) && !String(claim).startsWith('wt-'))) {
    return { verdict: 'request_changes', reason: 'files outside the claim' };
  }
  const code = names.filter((p) => /\.(js|ts|tsx|py|go|rb)$/i.test(p));
  if (trivialPrFiles(list)) return { verdict: 'approve', trivial: true, reason: 'trivial scaffold' };
  if (code.length || names.length > 2) return { verdict: 'escalate', reason: 'needs user Merge', need_model: names.length > 2 };
  return { verdict: 'approve', trivial: false, reason: 'small non-code' };
}

function shouldFanoutAsk(kind) {
  const k = String(kind || '');
  if (k === 'browse') return BROWSE_FANOUT;
  return /preview|pr|deploy|iac|confirm|choice|tool|handoff|connect|plan|plan_q|learn|cron/.test(k) || !k || k === 'generic' || k === 'free_text';
}

function parseBrowseAct(answer) {
  const t = String(answer || '').trim();
  if (/^done\b/i.test(t)) return { done: true };
  if (/^(stop|wipe)\b/i.test(t)) return { stop: true };
  if (/^scroll\b/i.test(t)) return { name: 'browser_press', args: { key: 'PageDown' } };
  const click = t.match(/^click(?:\s+the)?\s+(.+)/i);
  if (click) return { name: 'browser_click', args: { selector: click[1].replace(/\s*\(recommended\)\s*/i, '') } };
  const type = t.match(/^type\s+(.+)/i);
  if (type) return { name: 'browser_type', args: { text: type[1], selector: 'input' } };
  return { name: 'browser_snapshot', args: {}, note: t };
}

function claimClash(workers, claim, exceptId) {
  const c = String(claim || '').replace(/^\/+/, '');
  if (!c) return null;
  return (workers || []).find((w) => {
    if (exceptId && w.id === exceptId) return false;
    if (!['running', 'queued', 'waiting_ask'].includes(w.status)) return false;
    const theirs = String(w.claim_prefix || '').replace(/^\/+/, '');
    if (!theirs) return false;
    if (theirs === 'browser' && c === 'browser') return true;
    if (theirs.startsWith('wt-') || c.startsWith('wt-')) return theirs === c;
    return pathUnderClaim(c, theirs) || pathUnderClaim(theirs, c);
  }) || null;
}

function gitAddCmd(claim, message) {
  const msg = JSON.stringify(message || 'icarus');
  const c = String(claim || '').replace(/^\/+/, '');
  if (!c || c.startsWith('wt-')) {
    return `git status --short | head -n 40`;
  }
  return `git add -- ${JSON.stringify(c)} && git commit -m ${msg}`;
}

function nextByPriority(workers, workItems) {
  const byId = new Map((workItems || []).map((w) => [w.id, w]));
  return [...(workers || [])]
    .filter((w) => w.status === 'queued' || w.status === 'running')
    .sort((a, b) => {
      const pa = Number(byId.get(a.work_item_id)?.priority || 50);
      const pb = Number(byId.get(b.work_item_id)?.priority || 50);
      if (pa !== pb) return pa - pb;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
}

function shopBoard({ work = [], workers = [], asks = [], locks = {} } = {}) {
  const open = asks.filter((a) => a.status === 'open');
  const pending = asks.filter((a) => a.status === 'pending');
  return {
    work: work.map((w) => ({
      id: w.id, kind: w.kind, title: w.title, status: w.status,
      priority: w.priority, assigned_worker_id: w.assigned_worker_id,
    })),
    workers: workers.map((w) => ({
      id: w.id, persona: w.persona, status: w.status, objective: w.objective,
      claim_prefix: w.claim_prefix,
    })),
    locks: {
      paths: (locks.paths || workers.filter((w) => ['running', 'queued', 'waiting_ask'].includes(w.status) && w.claim_prefix)
        .map((w) => ({ worker_id: w.id, path: w.claim_prefix }))),
      browser: locks.browser || null,
      deploy: locks.deploy || null,
      pr: locks.pr || null,
    },
    open_ask: open[0] || null,
    pending_asks: pending,
  };
}

module.exports = {
  MAX_TURNS,
  MAX_ACT,
  MAX_RETRY,
  MAX_REPLAN,
  PROD_PROJECT,
  SYSTEM_PROJECT_ID,
  SELF_CLAIM,
  CLOUD_CLAIM,
  HANGOUT_READ,
  resolveTarget,
  parseRelationships,
  routeChat,
  inferPreview,
  inferName,
  inferPath,
  inferHost,
  briefIsClear,
  briefFromText,
  canWrite,
  voiceIntent,
  isReorder,
  reorderIntent,
  speakPreview,
  userFacingImpossible,
  truncateList,
  claimPath,
  pathUnderClaim,
  looksSearchGoal,
  looksSiteGoal,
  verifyTool,
  trivialPrFiles,
  reviewPr,
  shouldFanoutAsk,
  gitAddCmd,
  nextByPriority,
  shopBoard,
  parseBrowseAct,
  claimClash,
  needsPlan,
  inferPlanSteps,
  speakPlan,
  applyRevision,
  looksLearn,
  parseCronIntent,
};
