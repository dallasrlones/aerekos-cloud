'use strict';

/** Lane-scoped inject: friend memory never hits shop; skills RAG never hits hangout. */

const FRIEND_LANES = new Set(['user', 'compact', 'talk']);
const INFO_LANES = new Set(['info']);
const SKILL_LANES = new Set(['manager', 'execute', 'plan', 'idle', 'reflect', 'safety']);

function laneInject(lane) {
  const l = String(lane || '');
  if (!l) return { memory: null, rag: null };
  // Guided info lane: RAG on (books/docs), friend memory off
  if (INFO_LANES.has(l)) return { memory: false, rag: true };
  if (FRIEND_LANES.has(l)) return { memory: true, rag: false };
  if (SKILL_LANES.has(l)) return { memory: false, rag: true };
  return { memory: false, rag: false };
}

function friendStoreName(agentName) {
  return `${String(agentName || 'icarus').trim()}-friend`;
}

function skillsCollectionName(agentName) {
  return `${String(agentName || 'icarus').trim()}-skills`;
}

function knowledgeCollectionName(agentName) {
  return `${String(agentName || 'icarus').trim()}-knowledge`;
}

function codeAliasName(agentName) {
  return `${String(agentName || 'icarus').trim()}-code`;
}

const SYSTEM_PROJECT_ID = '9d8bde11-6933-4732-b746-602dcf72eaa5';
const PROD_PROJECT_ID = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

module.exports = {
  laneInject,
  friendStoreName,
  skillsCollectionName,
  knowledgeCollectionName,
  codeAliasName,
  FRIEND_LANES,
  INFO_LANES,
  SKILL_LANES,
  SYSTEM_PROJECT_ID,
  PROD_PROJECT_ID,
};
