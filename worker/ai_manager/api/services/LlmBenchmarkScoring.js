'use strict';

const REFUSAL = [
  'as an ai',
  "i can't create",
  'i cannot create',
  'safety guidelines',
  'crisis text line',
  'mental health',
  'cannot provide',
];

function chatModelFilter(name) {
  const n = String(name).toLowerCase();
  if (n.includes('embed') || n.includes('nomic-embed') || n.includes('mxbai-embed')) return false;
  if (n.includes(':cloud')) return false;
  if (n.startsWith('translategemma')) return false;
  if (n.includes('medgemma')) return false;
  return true;
}

function parseParamB(size) {
  if (!size) return 999;
  const m = String(size).match(/([\d.]+)\s*([BMK])?/i);
  if (!m) return 999;
  const num = parseFloat(m[1]);
  const u = (m[2] || 'B').toUpperCase();
  if (u === 'M') return num / 1000;
  if (u === 'K') return num / 1_000_000;
  return num;
}

function extractJson(raw) {
  const t = String(raw).trim();
  const tries = [t];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) tries.push(fence[1].trim());
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) tries.push(t.slice(s, e + 1));
  for (const chunk of tries) {
    try {
      return JSON.parse(chunk);
    } catch {
      /* next */
    }
  }
  return null;
}

function scoreResponse(content) {
  const lower = String(content).toLowerCase();
  if (REFUSAL.some((s) => lower.includes(s))) {
    return { pass: false, reason: 'refusal', checks: { json: false, commands: false, create_task: false } };
  }
  const obj = extractJson(content);
  if (!obj) {
    return { pass: false, reason: 'no_json', checks: { json: false, commands: false, create_task: false } };
  }
  const cmds = Array.isArray(obj.commands) ? obj.commands : [];
  if (cmds.length === 0) {
    return { pass: false, reason: 'no_commands', checks: { json: true, commands: false, create_task: false } };
  }
  const create = cmds.find((c) => c?.kind === 'propose_create_task' || c?.kind === 'create_task');
  if (!create) {
    return { pass: false, reason: 'no_create_task', checks: { json: true, commands: true, create_task: false } };
  }
  const title = String(create.payload?.title || '').toLowerCase();
  if (!title.includes('cake')) {
    return { pass: false, reason: 'bad_title', checks: { json: true, commands: true, create_task: true } };
  }
  if (!String(obj.reply || '').trim()) {
    return { pass: false, reason: 'empty_reply', checks: { json: true, commands: true, create_task: true } };
  }
  return {
    pass: true,
    reason: 'ok',
    title: create.payload.title,
    expression: String(obj.expression || '').trim() || null,
    commandCount: cmds.length,
    checks: { json: true, commands: true, create_task: true, reply: true },
  };
}

module.exports = {
  chatModelFilter,
  parseParamB,
  extractJson,
  scoreResponse,
};
