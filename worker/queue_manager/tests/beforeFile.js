// Runs before any test file so DATABASE_PATH is set before api/models load.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

function ensureBetterSqlite3() {
  try {
    require('better-sqlite3');
    return;
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (!/NODE_MODULE_VERSION|compiled against a different Node|invalid ELF|ERR_DLOPEN_FAILED/i.test(msg)) {
      throw err;
    }
  }
  const roots = [path.join(__dirname, '..'), path.join(__dirname, '../../..')];
  for (const cwd of roots) {
    if (!fs.existsSync(path.join(cwd, 'package.json'))) continue;
    try {
      execSync('npm rebuild better-sqlite3', { cwd, stdio: 'inherit' });
    } catch {
      /* try the next tree */
    }
  }
  require('better-sqlite3');
}

ensureBetterSqlite3();

const w = process.env.JEST_WORKER_ID || '0';
const p = path.join(os.tmpdir(), `queue_manager-test-w${w}.db`);
try {
  if (fs.existsSync(p)) fs.unlinkSync(p);
} catch (e) {
  /* ignore */
}
process.env.DATABASE_PATH = p;
process.env.SKIP_BROKER = '1';
