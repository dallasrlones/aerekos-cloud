#!/usr/bin/env node
'use strict';

/**
 * Continuous SQLite shipper (Litestream-style copy, no extra binary).
 * Copies conductor.db + -wal + -shm to DEST every interval.
 *
 *   CONDUCTOR_REPLICATE_DEST=/var/backups/conductor \\
 *   CONDUCTOR_REPLICATE_INTERVAL_MS=60000 \\
 *   node conductor/scripts/replicate-sqlite.js
 *
 * Failover: stop old primary, copy dest over DATABASE_PATH, start one conductor.
 * See docs/runbooks/data-center.md
 */

const fs = require('fs');
const path = require('path');

const src = process.env.DATABASE_PATH || path.join(__dirname, '../data/conductor.db');
const destDir = process.env.CONDUCTOR_REPLICATE_DEST;
const interval = Number(process.env.CONDUCTOR_REPLICATE_INTERVAL_MS || 60000);

if (!destDir) {
  console.error('CONDUCTOR_REPLICATE_DEST is required');
  process.exit(1);
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

function ship() {
  const base = path.basename(src);
  const ok = copyIfExists(src, path.join(destDir, base));
  copyIfExists(`${src}-wal`, path.join(destDir, `${base}-wal`));
  copyIfExists(`${src}-shm`, path.join(destDir, `${base}-shm`));
  const stamp = new Date().toISOString();
  fs.writeFileSync(path.join(destDir, 'REPLICATE.json'), JSON.stringify({
    source: src,
    copied_at: stamp,
    ok,
  }));
  console.log(`[replicate-sqlite] ${stamp} ${ok ? 'copied' : 'missing source'} → ${destDir}`);
}

ship();
setInterval(ship, interval);
