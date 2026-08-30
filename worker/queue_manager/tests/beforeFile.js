// Runs before any test file so DATABASE_PATH is set before api/models load.
const path = require('path');
const fs = require('fs');
const os = require('os');

const w = process.env.JEST_WORKER_ID || '0';
const p = path.join(os.tmpdir(), `queue_manager-test-w${w}.db`);
try {
  if (fs.existsSync(p)) fs.unlinkSync(p);
} catch (e) {
  /* ignore */
}
process.env.DATABASE_PATH = p;
