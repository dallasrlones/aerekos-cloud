const db = require('../utils/dbClient');

// Key Model
// Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
const Key = db.model('Key', {
  name: 'string',
  type: 'string',  // 'symmetric', 'asymmetric', 'master'
  algorithm: 'string',  // 'AES-256-GCM', 'RSA-4096', etc.
  encrypted_key: 'string',  // Encrypted key material (encrypted with master key)
  key_version: 'number',
  is_active: 'number',  // 0 = false, 1 = true (SQLite boolean workaround)
  rotated_at: 'datetime',
  metadata: 'string'  // JSON string for additional metadata
}, {
  required: ['name', 'type', 'algorithm', 'encrypted_key'],
  unique: [['name', 'key_version']],  // a name can have multiple versions; (name, version) is unique
  timestamps: true  // Automatically adds created_at and updated_at
});

// KeyAccess Model (audit log)
const KeyAccess = db.model('KeyAccess', {
  service_name: 'string',
  action: 'string',  // 'get', 'rotate', 'delete'
  timestamp: 'datetime',
  ip_address: 'string',
  success: 'number'  // 0 = false, 1 = true
}, {
  required: ['service_name', 'action', 'timestamp'],
  belongsTo: ['Key'],  // Creates key_id foreign key
  timestamps: false  // We use timestamp field instead
});

module.exports = {
  Key,
  KeyAccess,
  db
};
