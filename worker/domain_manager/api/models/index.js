const db = require('../utils/dbClient');

// Local row mirroring a Cloudflare DNS record we manage
const DnsRecord = db.model(
  'DnsRecord',
  {
    project_id: 'string',
    zone_id: 'string',
    record_name: 'string',
    record_type: 'string',
    content: 'string',
    ttl: 'number',
    proxied: 'number',
    cf_record_id: 'string',
    last_error: 'string'
  },
  {
    required: ['project_id', 'zone_id', 'record_name', 'record_type', 'content', 'cf_record_id'],
    timestamps: true
  }
);

const HostnameBinding = db.model(
  'HostnameBinding',
  {
    project_id: 'string',
    hostname: 'string',
    target_type: 'string',
    target_id: 'string',
    port: 'number',
    protocol: 'string',
    tunnel_id: 'string',
    dns_record_id: 'string',
    visibility: 'string',
    environment: 'string',
  },
  {
    required: ['project_id', 'hostname', 'target_type'],
    indexes: ['project_id', 'hostname'],
    timestamps: true,
  }
);

try {
  const cols = new Set((db.db.prepare('PRAGMA table_info(hostnamebindings)').all() || []).map((c) => c.name));
  if (!cols.has('environment')) db.db.exec("ALTER TABLE hostnamebindings ADD COLUMN environment TEXT DEFAULT 'prod'");
} catch (_) { /* best effort */ }

module.exports = { DnsRecord, HostnameBinding, db };
