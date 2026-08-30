const db = require('../utils/dbClient');

const Tunnel = db.model(
  'Tunnel',
  {
    project_id: 'string',
    name: 'string',
    cf_tunnel_id: 'string',
    cf_status: 'string',
    last_error: 'string',
    ingress_json: 'string',
    ingress_config: 'string',
    worker_id: 'string',
    device_hostname: 'string',
    display_name: 'string',
    origin_mode: 'string'
  },
  {
    required: ['project_id', 'name', 'cf_tunnel_id'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

try {
  const cols = new Set((db.db.prepare('PRAGMA table_info(tunnels)').all() || []).map((c) => c.name));
  for (const [name, spec] of [
    ['worker_id', "TEXT DEFAULT ''"],
    ['device_hostname', "TEXT DEFAULT ''"],
    ['display_name', "TEXT DEFAULT ''"],
    ['origin_mode', "TEXT DEFAULT 'host'"],
  ]) {
    if (!cols.has(name)) db.db.exec(`ALTER TABLE tunnels ADD COLUMN ${name} ${spec}`);
  }
  if (!cols.has('ingress_json') && !cols.has('ingress_config')) {
    db.db.exec("ALTER TABLE tunnels ADD COLUMN ingress_config TEXT DEFAULT ''");
  }
} catch (_) { /* best effort */ }

module.exports = { Tunnel, db };
