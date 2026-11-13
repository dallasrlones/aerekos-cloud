const db = require('../utils/db');

// User Model
const User = db.model('User', {
  username: 'string',
  password_hash: 'string',
  email: 'string',
  role: 'string',
  must_change_password: 'number',
  totp_secret: 'string',
  totp_enabled: 'number'
}, {
  required: ['username', 'password_hash', 'email'],
  unique: ['username', 'email'],
  timestamps: true
});

try { db.db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0'); } catch (_) { /* already present */ }
try { db.db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT'); } catch (_) { /* already present */ }
try { db.db.exec('ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0'); } catch (_) { /* already present */ }

try { db.db.exec('ALTER TABLE workers ADD COLUMN vpc_id TEXT'); } catch (_) { /* already present */ }

const ProjectMember = db.model('ProjectMember', {
  project_id: 'string',
  user_id: 'string',
  role: 'string'
}, {
  required: ['project_id', 'user_id'],
  timestamps: true,
  indexes: ['project_id', 'user_id']
});

const ProjectInvite = db.model('ProjectInvite', {
  project_id: 'string',
  token: 'string',
  role: 'string',
  invited_by: 'string',
  status: 'string',
  expires_at: 'string',
  accepted_by: 'string',
  email: 'string'
}, {
  required: ['project_id', 'token'],
  unique: ['token'],
  timestamps: true,
  indexes: ['project_id', 'token', 'status']
});

try { db.db.exec("ALTER TABLE projectinvites ADD COLUMN email TEXT DEFAULT ''"); } catch (_) { /* present */ }

// Worker Model
const Worker = db.model('Worker', {
  hostname: 'string',
  ip_address: 'string',
  status: 'string',
  last_seen: 'datetime',
  resources: 'string', // JSON string for CPU, RAM, disk, network
  env: 'string', // opaque worker-supplied tag from worker .env — not an enum
  capabilities: 'string', // JSON array of opaque capability strings
  vpc_id: 'string',
  display_name: 'string'
}, {
  timestamps: true
});

try {
  db.db.exec('ALTER TABLE workers ADD COLUMN env TEXT');
} catch (_) { /* already present */ }
try {
  db.db.exec('ALTER TABLE workers ADD COLUMN capabilities TEXT');
} catch (_) { /* already present */ }
try {
  db.db.exec("ALTER TABLE workers ADD COLUMN display_name TEXT DEFAULT ''");
} catch (_) { /* already present */ }

// Service Model
// Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
const Service = db.model('Service', {
  name: 'string',
  enabled: 'number', // 0 = false, 1 = true
  docker_image: 'string',
  config: 'string', // JSON string
  service_token: 'string' // Service token for service-to-service authentication
}, {
  required: ['name'],
  unique: ['name'],
  timestamps: true
});

// Project Model
// Note: SQLite doesn't support boolean, so we use integer (0 = false, 1 = true)
const Project = db.model('Project', {
  name: 'string',
  description: 'string',
  enabled: 'number', // 0 = false, 1 = true
  config: 'string', // JSON string
  created_by: 'string'
}, {
  required: ['name'],
  unique: ['name'],
  timestamps: true
});

try { db.db.exec("ALTER TABLE projects ADD COLUMN created_by TEXT DEFAULT ''"); } catch (_) { /* present */ }

// Join tables: use explicit *_id columns. aerekos-record's SQLite ensureTable maps belongsTo: [A,B]
// to a single broken FK name (e.g. project,service_id), not two columns. Recreate DB if upgrading from that schema.

// ProjectWorker Model (join table for many-to-many relationship)
const ProjectWorker = db.model('ProjectWorker', {
  project_id: 'string',
  worker_id: 'string'
}, {
  required: ['project_id', 'worker_id'],
  timestamps: true,
  indexes: ['project_id', 'worker_id']
});

// ProjectService Model (join table for many-to-many relationship)
const ProjectService = db.model('ProjectService', {
  project_id: 'string',
  service_id: 'string',
  enabled: 'number', // 0 = false, 1 = true - Can enable/disable service per project
  config: 'string', // JSON string - Project-specific service configuration
  scaling_policy: 'string' // JSON string - Auto-scaling policy configuration
}, {
  required: ['project_id', 'service_id'],
  timestamps: true,
  indexes: ['project_id', 'service_id']
});

// ServiceDeployment Model — project_id optional (NULL for legacy rows)
const ServiceDeployment = db.model('ServiceDeployment', {
  service_id: 'string',
  worker_id: 'string',
  project_id: 'string',
  status: 'string',
  deployed_at: 'datetime',
  orphaned: 'number', // 0 = false, 1 = true - Flag for orphaned deployments after project deletion
  pinned_worker_id: 'string' // Optional - Pin service to specific worker (takes precedence over auto-assignment)
}, {
  required: ['service_id', 'worker_id'],
  timestamps: true,
  indexes: ['service_id', 'worker_id', 'project_id']
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
const Resource = db.model('Resource', {
  worker_id: 'string',
  cpu_cores: 'number',
  ram_gb: 'number',
  disk_gb: 'number',
  network_mbps: 'number'
}, {
  required: ['worker_id'],
  timestamps: true,
  indexes: ['worker_id']
});

const PlatformJob = db.model('PlatformJob', {
  project_id: 'string',
  kind: 'string',
  status: 'string',
  summary: 'string',
  detail: 'string',
}, {
  timestamps: true,
  indexes: ['project_id', 'status']
});

const ProjectStack = db.model('ProjectStack', {
  project_id: 'string',
  revision: 'number',
  content: 'string',
  applied: 'string',
  status: 'string',
  lock_holder: 'string',
}, {
  timestamps: true,
  indexes: ['project_id']
});

const ProjectEnvironment = db.model('ProjectEnvironment', {
  project_id: 'string',
  name: 'string',
  git_ref: 'string',
  protected: 'number'
}, {
  required: ['project_id', 'name'],
  indexes: ['project_id', 'name'],
  timestamps: true
});

try { db.db.exec('ALTER TABLE projectenvironments ADD COLUMN git_ref TEXT DEFAULT \'main\''); } catch (_) { /* present */ }
try { db.db.exec('ALTER TABLE projectenvironments ADD COLUMN protected INTEGER DEFAULT 0'); } catch (_) { /* present */ }

const ConductorPeer = db.model('ConductorPeer', {
  peer_id: 'string',
  public_key: 'string',
  base_url: 'string',
  label: 'string',
  status: 'string'
}, {
  required: ['peer_id', 'public_key'],
  unique: ['peer_id'],
  timestamps: true,
  indexes: ['peer_id', 'status']
});

const FederationGrant = db.model('FederationGrant', {
  token: 'string',
  jti: 'string',
  home_peer_id: 'string',
  project_id: 'string',
  role: 'string',
  status: 'string',
  expires_at: 'string',
  created_by: 'string'
}, {
  required: ['jti', 'home_peer_id', 'project_id'],
  unique: ['jti'],
  timestamps: true,
  indexes: ['project_id', 'home_peer_id', 'status', 'jti']
});

const ProjectFederationAttach = db.model('ProjectFederationAttach', {
  home_peer_id: 'string',
  home_project_id: 'string',
  home_base_url: 'string',
  grant_token: 'string',
  grant_jti: 'string',
  role: 'string',
  status: 'string',
  label: 'string',
  last_error: 'string',
  attached_by: 'string'
}, {
  required: ['home_peer_id', 'home_project_id'],
  timestamps: true,
  indexes: ['home_peer_id', 'home_project_id', 'status']
});

module.exports = {
  User,
  Worker,
  Service,
  Project,
  ProjectWorker,
  ProjectService,
  ProjectMember,
  ProjectInvite,
  ServiceDeployment,
  Token,
  Resource,
  PlatformJob,
  ProjectStack,
  ProjectEnvironment,
  ConductorPeer,
  FederationGrant,
  ProjectFederationAttach,
  db
};
