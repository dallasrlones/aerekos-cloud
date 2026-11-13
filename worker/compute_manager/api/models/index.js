const db = require('../utils/dbClient');

// status: pending | running | stopped | failed
// run_mode: service (keep running) | oneshot (exit expected)
// command, env, port_bindings: JSON strings
const Task = db.model(
  'Task',
  {
    name: 'string',
    project_id: 'string',
    image: 'string',
    command: 'string',
    env: 'string',
    port_bindings: 'string',
    run_mode: 'string',
    status: 'string',
    container_id: 'string',
    exit_code: 'number',
    error_message: 'string',
    desired: 'number',
    balancer_id: 'string',
    volumes: 'string',
    database_name: 'string',
    pin_worker_id: 'string',
    worker_id: 'string',
    worker_hostname: 'string',
    environment: 'string',
    network: 'string',
    arn: 'string',
    replica_ids: 'string',
    resource_limits: 'string',
    workload_spec: 'string',
    reconcile_snapshot: 'string',
  },
  {
    required: ['name', 'project_id', 'image', 'status', 'run_mode'],
    unique: [['project_id', 'name']],
    timestamps: true
  }
);

try {
  const cols = new Set((db.db.prepare('PRAGMA table_info(tasks)').all() || []).map((c) => c.name));
  const add = [
    ['desired', 'INTEGER DEFAULT 1'],
    ['balancer_id', "TEXT DEFAULT ''"],
    ['volumes', "TEXT DEFAULT '[]'"],
    ['database_name', "TEXT DEFAULT ''"],
    ['pin_worker_id', "TEXT DEFAULT ''"],
    ['network', "TEXT DEFAULT ''"],
    ['arn', "TEXT DEFAULT ''"],
    ['replica_ids', "TEXT DEFAULT '[]'"],
    ['worker_id', "TEXT DEFAULT ''"],
    ['worker_hostname', "TEXT DEFAULT ''"],
    ['environment', "TEXT DEFAULT 'prod'"],
    ['resource_limits', "TEXT DEFAULT '{}'"],
    ['workload_spec', "TEXT DEFAULT ''"],
    ['reconcile_snapshot', "TEXT DEFAULT ''"],
  ];
  for (const [name, spec] of add) {
    if (!cols.has(name)) {
      db.db.exec(`ALTER TABLE tasks ADD COLUMN ${name} ${spec}`);
    }
  }
} catch (_) { /* best effort on older files */ }

module.exports = { Task, db };
