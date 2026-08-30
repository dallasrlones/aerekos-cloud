/**
 * ReleaseService — the conductor's built-in "release server" (our own GitHub).
 *
 * Releases are stored on the filesystem (no DB migration needed): each release
 * is a gzipped tarball of the repo plus a metadata entry in an index file. The
 * conductor serves these to device updater sidecars, which pull + redeploy.
 *
 * Storage layout (under RELEASES_DIR, persisted on the conductor-data volume):
 *   releases/
 *     index.json            [{ version, filename, sha256, size, notes, created_at }]
 *     <version>.tar.gz
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RELEASES_DIR =
  process.env.RELEASES_DIR || path.join(__dirname, '../../data/releases');
const INDEX_FILE = path.join(RELEASES_DIR, 'index.json');

function ensureDir() {
  if (!fs.existsSync(RELEASES_DIR)) fs.mkdirSync(RELEASES_DIR, { recursive: true });
}

function readIndex() {
  ensureDir();
  if (!fs.existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8')) || [];
  } catch (_e) {
    return [];
  }
}

function writeIndex(list) {
  ensureDir();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2));
}

// Reject anything that could escape the releases dir.
function safeVersion(version) {
  if (!version || !/^[A-Za-z0-9._-]+$/.test(version)) {
    throw new Error('Invalid version (allowed: letters, digits, dot, dash, underscore)');
  }
  return version;
}

const ReleaseService = {
  /**
   * Store a new release tarball and record it as the latest.
   * @param {string} version  unique version id (e.g. 20260605-2230 or a git sha)
   * @param {Buffer} buffer   gzipped tarball bytes
   * @param {string} [notes]  optional release notes
   */
  publish(version, buffer, notes = '') {
    safeVersion(version);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Empty release bundle');
    }
    ensureDir();
    const filename = `${version}.tar.gz`;
    fs.writeFileSync(path.join(RELEASES_DIR, filename), buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const list = readIndex().filter((r) => r.version !== version);
    const entry = {
      version,
      filename,
      sha256,
      size: buffer.length,
      notes: String(notes || ''),
      created_at: new Date().toISOString(),
    };
    list.push(entry);
    writeIndex(list);
    return entry;
  },

  list() {
    // newest first
    return readIndex().slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  },

  getLatest() {
    return this.list()[0] || null;
  },

  get(version) {
    return readIndex().find((r) => r.version === version) || null;
  },

  bundlePath(version) {
    safeVersion(version);
    const entry = this.get(version);
    if (!entry) return null;
    const p = path.join(RELEASES_DIR, entry.filename);
    return fs.existsSync(p) ? p : null;
  },
};

module.exports = ReleaseService;
