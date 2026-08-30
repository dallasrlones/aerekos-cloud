const path = require('path'); const os = require('os'); const fs = require('fs');
process.env.NODE_ENV = 'test'; process.env.SKIP_SERVICE_REGISTRATION = 'true';
if (!process.env.DATABASE_PATH) {
  const dir = path.join(os.tmpdir(), 'aerekos-'+"auth_manager"+'-tests');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.env.DATABASE_PATH = path.join(dir, 'test_'+Date.now()+'_'+process.pid+'.db');
}
