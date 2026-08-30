const path = require('path'); const os = require('os'); const fs = require('fs');
process.env.NODE_ENV = 'test'; process.env.SKIP_SERVICE_REGISTRATION = 'true';
process.env.SKIP_DOWNLOAD = '1'; process.env.SKIP_TORRENT = '1'; process.env.SKIP_INVOKE = '1';
process.env.SKIP_POLLER = '1'; process.env.SKIP_OUTBOUND = '1'; process.env.SKIP_BROKER = '1';
process.env.SKIP_BACKUP = '1'; process.env.SKIP_ACME = '1'; process.env.SKIP_HEAL = '1';
process.env.SKIP_HOST_PATCH = '1';
process.env.CONDUCTOR_URL = process.env.CONDUCTOR_URL || 'http://conductor.test';
process.env.SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'test-service-token';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-backup_manager-tests');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, 'test_'+Date.now()+'_'+process.pid+'.db');
}
