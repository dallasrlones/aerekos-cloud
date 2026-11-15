'use strict';

function buildMemoryLookupQuery({ goal, limit = 5 } = {}) {
  return { goal: String(goal || '').trim(), limit: Math.max(1, Number(limit) || 5), mode: 'laya+llm' };
}

module.exports = { buildMemoryLookupQuery };

