const db = require('../utils/dbClient');

const StoredSecret = db.model(
  'StoredSecret',
  {
    project_id: 'string',
    name: 'string',
    environment: 'string',
    ciphertext: 'string',
    key_name: 'string',
    key_version: 'number',
    metadata: 'string'
  },
  {
    required: ['project_id', 'name', 'ciphertext', 'key_name'],
    indexes: ['project_id', 'name', 'environment'],
    timestamps: true
  }
);

try {
  const cols = new Set((db.db.prepare('PRAGMA table_info(storedsecrets)').all() || []).map((c) => c.name));
  if (!cols.has('environment')) db.db.exec("ALTER TABLE storedsecrets ADD COLUMN environment TEXT DEFAULT 'prod'");
} catch (_) { /* best effort */ }

module.exports = { StoredSecret, db };
