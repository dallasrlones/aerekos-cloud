const db = require('../utils/dbClient');
const M = db.model('CicdPipeline', {
    project_id: 'string',
    name: 'string',
    steps_json: 'string',
    state: 'string',
    target_container_id: 'string',
    repo_id: 'string',
    repo_name: 'string',
    git_ref: 'string',
    dockerfile: 'string',
    source_object: 'string',
    target_image: 'string',
    environment: 'string',
    test_command: 'string',
    last_run_json: 'string',
    require_pr: 'number',
    pin_worker_id: 'string',
    hostname: 'string',
    port: 'string',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

try {
  const raw = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() || [];
  const table = (raw.map((r) => r.name).find((n) => /cicd.*pipeline/i.test(n)) || 'cicdpipelines');
  const cols = new Set((db.db.prepare(`PRAGMA table_info("${table}")`).all() || []).map((c) => c.name));
  const add = [
    ['target_container_id', "TEXT DEFAULT ''"],
    ['repo_id', "TEXT DEFAULT ''"],
    ['repo_name', "TEXT DEFAULT ''"],
    ['git_ref', "TEXT DEFAULT ''"],
    ['dockerfile', "TEXT DEFAULT ''"],
    ['source_object', "TEXT DEFAULT ''"],
    ['target_image', "TEXT DEFAULT ''"],
    ['environment', "TEXT DEFAULT 'prod'"],
    ['test_command', "TEXT DEFAULT ''"],
    ['last_run_json', "TEXT DEFAULT ''"],
    ['require_pr', 'INTEGER DEFAULT 0'],
    ['pin_worker_id', "TEXT DEFAULT ''"],
    ['hostname', "TEXT DEFAULT ''"],
    ['port', "TEXT DEFAULT ''"],
  ];
  for (const [name, spec] of add) {
    if (!cols.has(name)) db.db.exec(`ALTER TABLE "${table}" ADD COLUMN ${name} ${spec}`);
  }
} catch (_) { /* best effort on older files */ }

module.exports = { CicdPipeline: M, db };
