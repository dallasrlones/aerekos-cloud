'use strict';

async function snapshot(ctx) {
  const { projectId, resource, storage, prefix } = ctx;
  const srcBucket = resource && resource !== 'default' ? resource : null;
  if (!srcBucket) {
    const e = new Error('resource (source bucket name) is required for storage_manager backups');
    e.status = 400;
    throw e;
  }
  const files = await storage.listFiles(projectId, srcBucket, { prefix: '' });
  const objects = [];
  let size = 0;
  for (const file of files) {
    const key = file.key || file.name;
    if (!key) continue;
    const bytes = await storage.copyObject(projectId, srcBucket, key, storage.bucket, `${prefix}/objects/${key}`);
    size += bytes;
    objects.push({ key, dest: `objects/${key}`, size: bytes });
  }
  const manifest = {
    adapter: 'storage_manager',
    source: 'storage_manager',
    resource: srcBucket,
    objects,
  };
  size += await storage.putJson(projectId, storage.bucket, `${prefix}/snapshot.json`, manifest);
  return { size_bytes: size, extra: manifest };
}

async function restore(ctx, snapshotDoc) {
  const { projectId, storage, prefix, dest, resource } = ctx;
  const destBucket = dest || (snapshotDoc && snapshotDoc.resource) || resource;
  if (!destBucket) {
    const e = new Error('dest bucket is required to restore a storage snapshot');
    e.status = 400;
    throw e;
  }
  await storage.ensureBucket(projectId, destBucket);
  const objects = (snapshotDoc && snapshotDoc.objects) || [];
  let copied = 0;
  if (objects.length) {
    for (const obj of objects) {
      const fromKey = `${prefix}/${obj.dest || `objects/${obj.key}`}`;
      copied += await storage.copyObject(projectId, storage.bucket, fromKey, destBucket, obj.key);
    }
  } else {
    const files = await storage.listFiles(projectId, storage.bucket, { prefix: `${prefix}/objects/` });
    const stem = `${prefix}/objects/`;
    for (const file of files) {
      const key = file.key || '';
      if (!key.startsWith(stem)) continue;
      const destKey = key.slice(stem.length);
      if (!destKey) continue;
      copied += await storage.copyObject(projectId, storage.bucket, key, destBucket, destKey);
    }
  }
  return { ok: true, dest: destBucket, copied };
}

module.exports = { snapshot, restore };
