'use strict';

/**
 * Map agent lane / kind → intelligence endpoint name.
 * agent.options.lane_intelligence = { user, manager, worker, coding?, plan? }
 */

const KIND_LANES = {
  user: ['user', 'compact'],
  manager: ['manager', 'plan', 'safety', 'reflect', 'review'],
  review: ['review'],
  coding: ['execute', 'train'],
  worker: ['execute', 'train'],
};

function parseOptions(agent) {
  const raw = agent?.options;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

/**
 * @returns {{ intelligence: string, kind: 'user'|'manager'|'coding', fallback?: string }}
 */
function resolveLaneIntelligence(agent, lane = 'user') {
  const opts = parseOptions(agent);
  const map = opts.lane_intelligence && typeof opts.lane_intelligence === 'object'
    ? opts.lane_intelligence
    : {};
  const l = String(lane || 'user');

  let kind = 'coding';
  if (l === 'review' || KIND_LANES.review.includes(l)) kind = 'review';
  else if (KIND_LANES.user.includes(l)) kind = 'user';
  else if (KIND_LANES.manager.includes(l)) kind = 'manager';

  // Review must never fall back to coding/worker intelligence
  const byKind = map[kind]
    || (kind === 'review' ? (map.manager || map.review) : null)
    || map[l]
    || '';
  const primary = String(byKind || (kind === 'review' ? '' : agent?.intelligence) || '').trim();
  const fallback = kind === 'review'
    ? String(map.manager || map.review || '').trim()
    : String(
      map.fallback
      || opts.fallback_intelligence
      || (kind !== 'user' ? map.user : '')
      || agent?.intelligence
      || '',
    ).trim();

  return {
    intelligence: primary || fallback,
    kind,
    fallback: fallback && fallback !== primary ? fallback : undefined,
    map,
  };
}

function defaultLaneIntelligenceNames(agentName = 'icarus') {
  const n = String(agentName || 'icarus').trim();
  return {
    user: `${n}-user`,
    manager: `${n}-manager`,
    review: `${n}-manager`, // higher model shares manager intel unless pinned separately
    worker: `${n}-worker`,
    coding: `${n}-worker`,
  };
}

module.exports = {
  resolveLaneIntelligence,
  defaultLaneIntelligenceNames,
  KIND_LANES,
  parseOptions,
};
