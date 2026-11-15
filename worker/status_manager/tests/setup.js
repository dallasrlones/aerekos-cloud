'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
process.env.SKIP_DOWNLOAD = '1';
process.env.SKIP_TORRENT = '1';
process.env.SKIP_INVOKE = '1';
process.env.SKIP_POLLER = '1';
process.env.SKIP_OUTBOUND = '1';
process.env.SKIP_BROKER = '1';
process.env.SKIP_BACKUP = '1';
process.env.SKIP_ACME = '1';
process.env.SKIP_HEAL = '1';
process.env.SERVICE_NAME = 'status_manager';

if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-status_manager-tests');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, 'test_' + Date.now() + '_' + process.pid + '.db');
}
