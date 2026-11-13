'use strict';

/**
 * Live Icarus IDE events — file sync, presence, services map highlights.
 */

const { liveEmitSoon } = require('../../../shared/liveEmit');

function roomFor(projectId) {
  return `ai:live:${projectId}`;
}

function emitLive(projectId, event, payload) {
  try {
    liveEmitSoon(roomFor(projectId), event, { ...payload, project_id: projectId || '' });
  } catch { /* best-effort */ }
}

const IdeLive = {
  emitFile(projectId, agentId, {
    repoId, path: filePath, ref, sha, content, patch, line, agent_range,
  }) {
    emitLive(projectId, 'ai:ide.file', {
      agent_id: agentId,
      repoId: repoId || null,
      path: filePath,
      ref: ref || 'HEAD',
      sha: sha || null,
      content: content != null ? String(content).slice(0, 500000) : undefined,
      patch: patch || undefined,
      line: line || null,
      agent_range: agent_range || null,
      at: new Date().toISOString(),
    });
  },

  emitPresence(projectId, agentId, { path: filePath, line, selection }) {
    emitLive(projectId, 'ai:ide.presence', {
      agent_id: agentId,
      path: filePath,
      line,
      selection,
      at: new Date().toISOString(),
    });
  },

  emitStack(projectId, payload) {
    emitLive(projectId, 'ai:stack.update', {
      ...payload,
      at: new Date().toISOString(),
    });
  },

  emitServicesHighlight(projectId, nodeIds = []) {
    emitLive(projectId, 'ai:stack.highlight', {
      nodes: nodeIds,
      at: new Date().toISOString(),
    });
  },
};

module.exports = { IdeLive, emitLive };
