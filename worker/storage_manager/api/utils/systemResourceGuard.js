'use strict';

/**
 * Guards for undeletable / protected system resources in storage_manager.
 *
 * A system bucket is protected when:
 * - metadata.protected | immutable | undeletable is truthy, OR
 * - its name appears in SYSTEM_PROTECTED_BUCKET_NAMES (comma-separated env)
 */

function parseBucketMetadata(bucket) {
  if (!bucket) return {};
  const raw = bucket.metadata;
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return {};
}

function truthyFlag(value) {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
}

function protectedNamesFromEnv(env = process.env) {
  const raw = env.SYSTEM_PROTECTED_BUCKET_NAMES || '';
  return new Set(
    String(raw)
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isProtectedSystemBucket(bucket, env = process.env) {
  if (!bucket) return false;
  const meta = parseBucketMetadata(bucket);
  if (
    truthyFlag(meta.protected) ||
    truthyFlag(meta.immutable) ||
    truthyFlag(meta.undeletable)
  ) {
    return true;
  }
  const name = String(bucket.name || '').trim().toLowerCase();
  if (name && protectedNamesFromEnv(env).has(name)) return true;
  return false;
}

function assertSystemBucketDeletable(bucket, env = process.env) {
  if (!isProtectedSystemBucket(bucket, env)) return;
  const err = new Error(
    `System bucket '${bucket.name}' is protected and cannot be deleted`
  );
  err.status = 403;
  err.code = 'SYSTEM_BUCKET_IMMUTABLE';
  throw err;
}

module.exports = {
  parseBucketMetadata,
  isProtectedSystemBucket,
  assertSystemBucketDeletable,
  protectedNamesFromEnv,
};
