'use strict';

const { json } = require('./agentArn');

const WORK_RE = /\b(search the web|look up|browse|fix|implement|refactor|commit|deploy|cron|every (monday|week|day)|how many emails|calendar|schedule)\b/i;
const CONNECTOR_RE = /\b(email|emails|gmail|inbox|calendar|slack|github)\b/i;

function formatAsk(ask) {
  const opts = json(ask.options_json, ['Yes', 'No', 'Other']);
  const rec = ask.recommended || opts[0];
  const lines = ['<<ASK>>', ask.text, 'Options:'];
  for (const o of opts) {
    lines.push(o === rec ? `- ${o} (Recommended)` : `- ${o}`);
  }
  lines.push('- Other');
  lines.push('<</ASK>>');
  return lines.join('\n');
}

function pinRollBlock(pins, rolls) {
  const pinLines = (pins || []).map((p) => `- ${p.key}: ${p.value}`).join('\n') || '- (none yet)';
  const rollLines = ['today', 'tomorrow', 'week', 'month', 'year']
    .map((h) => (rolls && rolls[h] ? `### ${h}\n${rolls[h].body}` : ''))
    .filter(Boolean)
    .join('\n');
  return { pinLines, rollLines };
}

function friendSystem(agent, pins, rolls, target) {
  const { effectivePrompts } = require('./defaultPrompts');
  const { pinLines, rollLines } = pinRollBlock(pins, rolls);
  const extra = effectivePrompts(json(agent.options, {})).user;
  const t = target || { kind: 'self', claim: 'aerekos/aerekos-cloud/worker/ai_manager', label: 'Icarus on aerekos-cloud' };
  return `${extra}
You are ${agent.display_name || agent.name}. Timezone: ${agent.timezone || 'America/Los_Angeles'}. Mode: ${agent.mode}.
This job's target is ${t.label}. Read files under ${t.claim}. You run on aerekos-cloud.
PINNED FACTS:
${pinLines}

WHAT'S GOING ON:
${rollLines || '(rolls empty — ask or refresh via manager)'}
Do not recite skills docs as personality. Friend facts stay here.
`;
}

function intakeSystem(agent, pins, rolls) {
  const { effectivePrompts } = require('./defaultPrompts');
  const { pinLines, rollLines } = pinRollBlock(pins, rolls);
  const extra = effectivePrompts(json(agent.options, {})).user;
  return `${extra}
Timezone: ${agent.timezone || 'America/Los_Angeles'}. Mode: ${agent.mode}.
PINNED FACTS:
${pinLines}

WHAT'S GOING ON:
${rollLines || '(rolls empty)'}
`;
}

function managerSystem(root, board, options, target) {
  const { effectivePrompts } = require('./defaultPrompts');
  const extra = effectivePrompts(options || {}).manager;
  const boardTxt = board ? `\nBOARD:\n${JSON.stringify(board).slice(0, 4000)}\n` : '';
  const t = target?.claim
    ? `\nYou are Icarus. You run on aerekos-cloud (Orin brain, prod-mini computer). This job's claim is ${target.label} (${target.claim}).`
    : '';
  return `${extra}${t}
Jail: ${root}.${boardTxt}
If a tool call format is needed without native tools, use <<TOOL>>name {json}<</TOOL>>.
`;
}

function workerSystem(persona, root, pack, options, target) {
  const { workerPromptFor } = require('./defaultPrompts');
  const extra = workerPromptFor(options || {}, persona);
  const t = target?.claim
    ? `\nThis job's claim is ${target.label || target.claim} (${target.claim}). After writes, run_checks. Rollback on fail without ASK.`
    : '';
  return `${extra}${t}
Persona: ${persona}. Jail: ${root}.
${pack || ''}
If tools are missing, use <<TOOL>>name {json}<</TOOL>>.
`;
}

module.exports = {
  WORK_RE, CONNECTOR_RE, formatAsk, friendSystem, intakeSystem, managerSystem, workerSystem,
};
