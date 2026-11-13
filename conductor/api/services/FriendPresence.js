'use strict';

/** room -> Map(socketId -> { userId, username, projectId, joinedAt }) */
const presenceByRoom = new Map();

function roomKey(room) {
  return String(room || '');
}

function list(room) {
  const map = presenceByRoom.get(roomKey(room));
  if (!map) return [];
  return Array.from(map.values()).map((p) => ({
    user_id: p.userId,
    username: p.username,
    project_id: p.projectId,
    status: 'active',
    joined_at: p.joinedAt,
  }));
}

function join(room, socketId, meta = {}) {
  const key = roomKey(room);
  if (!key) return list(room);
  let map = presenceByRoom.get(key);
  if (!map) {
    map = new Map();
    presenceByRoom.set(key, map);
  }
  map.set(String(socketId), {
    userId: String(meta.userId || ''),
    username: meta.username || null,
    projectId: meta.projectId || null,
    joinedAt: new Date().toISOString(),
  });
  return list(room);
}

function leave(room, socketId) {
  const key = roomKey(room);
  const map = presenceByRoom.get(key);
  if (!map) return list(room);
  map.delete(String(socketId));
  if (!map.size) presenceByRoom.delete(key);
  return list(room);
}

function leaveAll(socketId) {
  const touched = [];
  for (const [room, map] of presenceByRoom.entries()) {
    if (map.has(String(socketId))) {
      map.delete(String(socketId));
      if (!map.size) presenceByRoom.delete(room);
      touched.push(room);
    }
  }
  return touched;
}

module.exports = { join, leave, leaveAll, list };
