'use strict';

const { json } = require('../utils/conductor');

async function snapshot(ctx) {
  const { projectId, resource, storage, prefix } = ctx;
  const name = resource && resource !== 'default' ? resource : null;
  if (!name) {
    const e = new Error('resource (database name) is required for db_manager backups');
    e.status = 400;
    throw e;
  }
  const data = await json(
    'db_manager',
    'POST',
    `/api/databases/${encodeURIComponent(name)}/backups`,
    { projectId, data: { backup_type: 'full' }, timeout: 300000 }
  );
  const backup = (data && data.backup) || data || {};
  const manifest = {
    adapter: 'db_manager',
    source: 'db_manager',
    resource: name,
    backup_id: backup.id || null,
    storage_path: backup.storage_path || null,
    size_bytes: backup.size_bytes || 0,
    backup,
  };
  const size = await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: Number(backup.size_bytes || 0) + size, extra: manifest };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, dest, resource } = ctx;
  const name = dest || (snapshotDoc && snapshotDoc.resource) || resource;
  const backupId = (snapshotDoc && (snapshotDoc.storage_path || snapshotDoc.backup_id))
    || (snapshotDoc && snapshotDoc.backup && (snapshotDoc.backup.storage_path || snapshotDoc.backup.id));
  if (!name || !backupId) {
    const e = new Error('database name and backup id/storage_path are required to restore');
    e.status = 400;
    throw e;
  }
  const data = await json(
    'db_manager',
    'POST',
    `/api/databases/${encodeURIComponent(name)}/backups/${encodeURIComponent(backupId)}/restore`,
    { projectId, data: {}, timeout: 300000 }
  );
  return { ok: true, dest: name, result: data };
}

module.exports = { snapshot, restore };
