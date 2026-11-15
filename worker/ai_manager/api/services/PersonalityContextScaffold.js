'use strict';

function buildPersonalityContext({ personality, goals, now = new Date() } = {}) {
  return {
    personality: personality && typeof personality === 'object' ? personality : {},
    goals: Array.isArray(goals) ? goals : [],
    datetime: new Date(now).toISOString(),
  };
}

module.exports = { buildPersonalityContext };
