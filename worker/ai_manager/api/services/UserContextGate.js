'use strict';

/**
 * Dual-stream Context-Gate: classify user turns into CHAT | WEB | DIG | CLARIFY | MANAGER
 * without blocking the manager loop. Steer/nudge attach to the live plan graph.
 */

const ROUTES = ['CHAT', 'WEB', 'DIG', 'CLARIFY', 'MANAGER', 'STEER'];

const STEER_RE = /\b(pause|stop|cancel|priorit|first|instead|nudge|steer|focus on|do .+ (?:first|now)|skip)\b/i;
const WEB_RE = /\b(search|google|look up|what'?s the (?:latest|current)|news|url|https?:\/\/)\b/i;
const DIG_RE = /\b(read|grep|find in|show me (?:the )?code|open file|how does .+ work in)\b/i;
const CLARIFY_RE = /\b(what do you mean|clarify|which one|ambiguous)\b/i;
const MANAGER_RE = /\b(build|implement|deploy|fix|ship|run (?:the )?plan|start work|spawn|refactor|create (?:a )?(?:project|pr|deploy))\b/i;

function classify(text, { hasLivePlan = false } = {}) {
  const t = String(text || '').trim();
  if (!t) return { route: 'CLARIFY', confidence: 0.2, reasons: ['empty'] };

  const reasons = [];
  if (STEER_RE.test(t) && hasLivePlan) {
    reasons.push('steer_pattern');
    return { route: 'STEER', confidence: 0.85, reasons };
  }
  if (WEB_RE.test(t)) {
    reasons.push('web_pattern');
    return { route: 'WEB', confidence: 0.75, reasons };
  }
  if (DIG_RE.test(t)) {
    reasons.push('dig_pattern');
    return { route: 'DIG', confidence: 0.7, reasons };
  }
  if (MANAGER_RE.test(t)) {
    reasons.push('manager_pattern');
    return { route: 'MANAGER', confidence: 0.8, reasons };
  }
  if (CLARIFY_RE.test(t) || t.endsWith('?') && t.split(/\s+/).length < 6) {
    reasons.push('clarify_pattern');
    return { route: 'CLARIFY', confidence: 0.55, reasons };
  }
  reasons.push('default_chat');
  return { route: 'CHAT', confidence: 0.6, reasons };
}

/**
 * Decide whether manager stream should continue while user is handled.
 * Anti-deadlock: never await manager for CHAT/WEB/DIG/STEER.
 */
function dualStreamPolicy(route) {
  const userLane = ['CHAT', 'WEB', 'DIG', 'CLARIFY', 'STEER'].includes(route);
  const wakeManager = route === 'MANAGER' || route === 'STEER';
  return {
    user_immediate: userLane || route === 'MANAGER',
    manager_continues: route !== 'MANAGER', // manager keeps working unless new brief
    wake_manager: wakeManager,
    ask_manager_tool: route === 'CLARIFY' || route === 'MANAGER',
  };
}

class UserContextGate {
  constructor({ llmClassify } = {}) {
    this.llmClassify = llmClassify || null;
  }

  async route(message, ctx = {}) {
    let hit = classify(message, ctx);
    if (this.llmClassify && hit.confidence < 0.55) {
      try {
        const llm = await this.llmClassify(message, ctx);
        if (llm && ROUTES.includes(llm.route)) hit = { ...hit, ...llm, source: 'llm' };
      } catch { /* heuristic stands */ }
    }
    return {
      ...hit,
      policy: dualStreamPolicy(hit.route),
      at: Date.now(),
    };
  }
}

module.exports = {
  UserContextGate,
  classify,
  dualStreamPolicy,
  ROUTES,
  STEER_RE,
};
