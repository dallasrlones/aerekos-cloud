/**
 * Version helpers — the conductor's own deployed version, plus utilities to
 * read a worker's reported version and decide whether it's outdated.
 *
 * APP_VERSION is the git short SHA injected at deploy time
 * (scripts/deploy/deploy.sh). Workers report the same value inside their
 * resources payload, so "outdated" simply means a worker's version differs from
 * the conductor's — i.e. it wasn't redeployed in the last rollout.
 */

let pkgVersion = '1.0.0';
try {
  pkgVersion = require('../../package.json').version || pkgVersion;
} catch (_e) {
  /* package.json not resolvable in some test contexts — keep default */
}

/** The conductor's currently-running version (git short SHA, or package version). */
function conductorVersion() {
  const env = process.env.APP_VERSION && String(process.env.APP_VERSION).trim();
  return env || pkgVersion;
}

/**
 * The version everything *should* be on — the latest release published to the
 * conductor's release server, if any; otherwise the conductor's own version.
 * (Required lazily to avoid a circular dependency at module load.)
 */
function targetVersion() {
  try {
    const ReleaseService = require('../services/ReleaseService');
    const latest = ReleaseService.getLatest();
    if (latest && latest.version) return latest.version;
  } catch (_e) {
    /* release server not available — fall back below */
  }
  return conductorVersion();
}

/** Resources may be stored/forwarded as a JSON string or an object. */
function parseResources(resources) {
  if (!resources) return {};
  if (typeof resources === 'object') return resources;
  try {
    return JSON.parse(resources);
  } catch (_e) {
    return {};
  }
}

/** The version a worker reported inside its resources payload (or null). */
function workerVersion(worker) {
  const r = parseResources(worker && worker.resources);
  return r.version ? String(r.version) : null;
}

/**
 * Returns version metadata for a worker:
 *   { version, current_version, outdated }
 * `outdated` is only true when we actually know the worker's version and it
 * differs from the conductor's (unknown versions are never flagged).
 */
function versionInfo(worker, baseline) {
  const current = baseline || targetVersion();
  const version = workerVersion(worker);
  return {
    version,
    current_version: current,
    outdated: version != null && version !== current,
  };
}

module.exports = { conductorVersion, targetVersion, workerVersion, versionInfo, parseResources };
