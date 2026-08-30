const path = require('path');
const os = require('os');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.SKIP_SERVICE_REGISTRATION = 'true';
// Metadata-only mode: exercise CRUD + validation without requiring the git binary.
// Real transport (clone/push/pull) is validated by the E2E suite against the container.
process.env.SKIP_GIT = '1';

const dir = path.join(os.tmpdir(), 'aerekos-git_manager-tests');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!process.env.DATABASE_PATH) {
  process.env.DATABASE_PATH = path.join(dir, `test_${Date.now()}_${process.pid}.db`);
}
if (!process.env.GIT_REPOS_ROOT) {
  process.env.GIT_REPOS_ROOT = path.join(dir, `repos_${Date.now()}_${process.pid}`);
}
