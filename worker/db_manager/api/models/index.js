const db = require('../utils/dbClient');

// DatabaseInstance Model
const DatabaseInstance = db.model('DatabaseInstance', {
  name: 'string',
  type: 'string',  // 'postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis'
  project_id: 'string',  // Project ID (db_manager is project-scoped)
  worker_id: 'string',  // Worker hosting the database
  status: 'string',  // 'creating', 'running', 'stopped', 'failed'
  port: 'number',
  host: 'string',  // Host where database is running (usually 'localhost' for db_manager on worker)
  container_name: 'string',  // Docker container name (e.g., 'aerekos-db-{name}')
  connection_string: 'string',  // Encrypted connection string (encrypted with key_manager)
  username: 'string',
  password_hash: 'string',  // Hashed password (never store plaintext)
  password_encrypted: 'string',  // Encrypted password (encrypted with key_manager)
  resource_limits: 'string',  // JSON string for CPU, RAM, disk limits
  metadata: 'string'  // JSON string for additional metadata
}, {
  required: ['name', 'type', 'status', 'project_id'],
  // NOTE: aerekos-record's sqlite adapter mis-handles composite `unique` tuples
  // (tries to create a column named "project_id,name"). Use plain indexes and
  // enforce per-project name uniqueness at the service layer instead.
  indexes: ['project_id', 'name'],
  timestamps: true
});

// DatabaseBackup Model
const DatabaseBackup = db.model('DatabaseBackup', {
  database_instance_id: 'string',  // Foreign key to DatabaseInstance
  backup_type: 'string',  // 'full', 'incremental'
  storage_path: 'string',  // Path in storage_manager
  size_bytes: 'number',
  status: 'string',  // 'in_progress', 'completed', 'failed'
  metadata: 'string'  // JSON string for backup metadata
}, {
  required: ['database_instance_id', 'backup_type', 'status'],
  belongsTo: ['DatabaseInstance'],  // Creates database_instance_id foreign key
  timestamps: true
});

// DatabaseConnection Model (connection pool tracking)
const DatabaseConnection = db.model('DatabaseConnection', {
  database_instance_id: 'string',  // Foreign key to DatabaseInstance
  service_name: 'string',
  connection_count: 'number',
  max_connections: 'number',
  last_used: 'datetime'
}, {
  required: ['database_instance_id', 'service_name'],
  belongsTo: ['DatabaseInstance'],
  timestamps: false  // We use last_used instead
});

module.exports = {
  DatabaseInstance,
  DatabaseBackup,
  DatabaseConnection,
  db
};
