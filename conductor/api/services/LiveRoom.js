'use strict';

const LIVE_EVENTS = new Set([
  'ai:pull', 'ai:bench', 'ai:job', 'ai:job.token',
  'ai:agent.pulse', 'ai:agent.ask', 'ai:agent.ask.answered', 'ai:agent.done',
  'log:appended',
]);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const AI_LIVE_PROJECT = new RegExp(`^ai:live:(${UUID})$`, 'i');

function isLiveRoom(room) {
  const r = String(room || '');
  return r === 'ai:live' || AI_LIVE_PROJECT.test(r) || /^logs:[a-zA-Z0-9._-]{1,128}$/.test(r);
}

function isLiveEvent(event) {
  return LIVE_EVENTS.has(String(event || ''));
}

function projectIdFromRoom(room) {
  const m = AI_LIVE_PROJECT.exec(String(room || ''));
  return m ? m[1].toLowerCase() : '';
}

function claimedProject(ctx = {}) {
  return String(ctx.projectId || ctx.xProjectId || ctx.subscribeProject || ctx.user?.project_id || '').toLowerCase();
}

function canJoinLiveRoom(room, ctx = {}) {
  if (!isLiveRoom(room)) return false;
  const pid = projectIdFromRoom(room);
  if (!pid) return true;
  const claimed = claimedProject(ctx);
  if (!claimed) return false;
  return claimed === pid;
}

function aiLiveRoom(projectId) {
  const pid = String(projectId || '').trim();
  return pid ? `ai:live:${pid}` : 'ai:live';
}

module.exports = { isLiveRoom, isLiveEvent, LIVE_EVENTS, canJoinLiveRoom, projectIdFromRoom, aiLiveRoom };
