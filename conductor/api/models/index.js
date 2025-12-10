const db = require('../utils/db');

// User Model
const User = db.model('User', {
  username: 'string',
  password_hash: 'string',
  email: 'string',
  role: 'string'
}, {
  required: ['username', 'password_hash', 'email'],
  unique: ['username', 'email'],
  timestamps: true
});

// Worker Model
const Worker = db.model('Worker', {
  hostname: 'string',
  ip_address: 'string',
  status: 'string',
  last_seen: 'datetime',
  resources: 'string' // JSON string for CPU, RAM, disk, network
}, {
  timestamps: true
});

// Service Model
// Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
const Service = db.model('Service', {
  name: 'string',
  enabled: 'number', // 0 = false, 1 = true
  docker_image: 'string',
  config: 'string' // JSON string
}, {
  required: ['name'],
  unique: ['name'],
  timestamps: true
});

// ServiceDeployment Model
// Note: belongsTo automatically creates service_id and worker_id columns
const ServiceDeployment = db.model('ServiceDeployment', {
  status: 'string',
  deployed_at: 'datetime'
}, {
  belongsTo: ['Service', 'Worker'],
  timestamps: true
});

// Token Model (for worker registration)
// Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
const Token = db.model('Token', {
  token: 'string',
  expires_at: 'datetime',
  active: 'number' // 0 = false, 1 = true
}, {
  required: ['token'],
  unique: ['token'],
  timestamps: true
});

// Resource Model
// Note: belongsTo automatically creates worker_id column
const Resource = db.model('Resource', {
  cpu_cores: 'number',
  ram_gb: 'number',
  disk_gb: 'number',
  network_mbps: 'number'
}, {
  belongsTo: ['Worker'],
  timestamps: true
});

module.exports = {
  User,
  Worker,
  Service,
  ServiceDeployment,
  Token,
  Resource,
  db
};
