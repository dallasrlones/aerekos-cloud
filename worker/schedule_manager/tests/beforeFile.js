const path = require('path');
const fs = require('fs');
const os = require('os');

const w = process.env.JEST_WORKER_ID || '0';
const p = path.join(os.tmpdir(), `schedule_manager-test-w${w}.db`);
try {
  if (fs.existsSync(p)) fs.unlinkSync(p);
} catch (e) {
  /* ignore */
}
process.env.DATABASE_PATH = p;
process.env.SKIP_CRON = '1';
