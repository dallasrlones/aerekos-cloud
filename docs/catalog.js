'use strict';

/**
 * aerekos-cloud — service catalog (single source of truth).
 *
 * This module describes the conductor control plane and every manager service:
 * ports, AWS analog, status, primary REST surface, key environment variables.
 *
 * It is consumed by:
 *   - scripts/gen-docs.mjs    -> per-service markdown + the static web docs site
 *   - aerekos-sdk             -> catalog-driven manager accessors
 *   - aerekos-sdk/bin         -> the `aerekos` CLI
 *
 * Ports MUST stay in sync with conductor/api/config/managerServicePorts.js.
 *
 * Endpoint conventions:
 *   - Managers are reached from a client through the conductor proxy:
 *       {VERB} {CONDUCTOR}/api/services/{name}{servicePath}     (JWT or service token)
 *   - `proxyBase` is the service-internal path prefix (e.g. /api/v1).
 *   - Project scoping is via `?project_id=` (most managers) unless the path embeds it.
 *   - `crud: { segment, idField }` marks the uniform SQLite-CRUD contract:
 *       POST   {proxyBase}/{segment}            { project_id, name, ...fields } -> 201 { item }
 *       GET    {proxyBase}/{segment}?project_id -> { items }
 *       GET    {proxyBase}/{segment}/:id        -> { item }
 *       PATCH  {proxyBase}/{segment}/:id        -> { item }
 *       DELETE {proxyBase}/{segment}/:id        -> { deleted: true }
 */

// Expand the uniform CRUD contract into explicit endpoint rows for docs.
function crudEndpoints(base, seg) {
  return [
    { method: 'POST', path: `${base}/${seg}`, summary: `Create a ${singular(seg)} ({ project_id, name, ... })` },
    { method: 'GET', path: `${base}/${seg}`, summary: `List ${seg} (?project_id=)` },
    { method: 'GET', path: `${base}/${seg}/:id`, summary: `Get one ${singular(seg)}` },
    { method: 'PATCH', path: `${base}/${seg}/:id`, summary: `Update a ${singular(seg)}` },
    { method: 'DELETE', path: `${base}/${seg}/:id`, summary: `Delete a ${singular(seg)}` }
  ];
}
function singular(seg) {
  if (seg.endsWith('ies')) return `${seg.slice(0, -3)}y`;
  if (seg.endsWith('s')) return seg.slice(0, -1);
  return seg;
}

const conductor = {
  name: 'conductor',
  title: 'Conductor',
  aws: 'Control plane (the AWS console + API)',
  category: 'Control plane',
  port: 3000,
  status: 'implemented',
  summary:
    'Master orchestrator: authentication, the service registry + proxy, worker fleet management, ' +
    'project scoping, and the React Native dashboard. Every client and SDK call enters here.',
  proxyBase: '/api',
  capabilities: ['auth', 'service-registry', 'proxy', 'workers', 'projects', 'metrics'],
  endpoints: [
    { method: 'GET', path: '/health', summary: 'Liveness' },
    { method: 'POST', path: '/api/auth/login', summary: 'Login -> { token } (JWT)' },
    { method: 'GET', path: '/api/auth/me', summary: 'Current identity' },
    { method: 'GET', path: '/api/services', summary: 'List all registered manager services' },
    { method: 'GET', path: '/api/services/:name', summary: 'Get one service' },
    { method: 'POST', path: '/api/services/:name/enable', summary: 'Enable/deploy a service for a project' },
    { method: 'POST', path: '/api/services/:name/disable', summary: 'Disable a service' },
    { method: 'POST', path: '/api/services/register', summary: 'Manager self-registration (service token issued)' },
    { method: 'ANY', path: '/api/services/:name/*', summary: 'Generic proxy to a manager (JWT/service token)' },
    { method: 'GET', path: '/api/workers', summary: 'List workers' },
    { method: 'GET', path: '/api/workers/:id/host/check', summary: 'Host OS/Docker freshness' },
    { method: 'POST', path: '/api/workers/:id/host/check', summary: 'Re-probe host OS/Docker' },
    { method: 'POST', path: '/api/workers/:id/host/update', summary: 'Update host OS or Docker ({ target })' },
    { method: 'GET', path: '/api/projects/:id/iac/status', summary: 'IaC hookup status' },
    { method: 'POST', path: '/api/projects/:id/iac/hookup', summary: 'Hook up IaC ({ mode, repo })' },
    { method: 'GET', path: '/api/projects/:id/stack', summary: 'Get project-stack JSON' },
    { method: 'PUT', path: '/api/projects/:id/stack', summary: 'Put project-stack JSON draft' },
    { method: 'POST', path: '/api/projects/:id/stack/apply', summary: 'Enable wanted[] then provision resources (never prod UUID)' },
    { method: 'POST', path: '/api/projects/:id/stack/diff', summary: 'Diff draft vs applied stack' },
    { method: 'POST', path: '/api/projects/:id/stack/rollback', summary: 'Roll back last applied stack revision' },
    { method: 'GET', path: '/api/projects/:id/edge/status', summary: 'Edge (tunnel/DNS) hookup status' },
    { method: 'POST', path: '/api/projects/:id/edge/hookup', summary: 'Hook up edge using existing Cloudflare secrets' },
    { method: 'GET', path: '/api/resources', summary: 'Fleet resource snapshot' },
    { method: 'GET', path: '/metrics', summary: 'Prometheus metrics' }
  ],
  env: [
    { name: 'PORT', default: '3000', desc: 'Listen port' },
    { name: 'JWT_SECRET', default: 'change-me', desc: 'Signs user JWTs' },
    { name: 'TOKEN_SECRET', default: 'change-me', desc: 'Signs service tokens' },
    { name: 'WORKER_REGISTRATION_TOKEN', default: '-', desc: 'Token workers present to self-register' },
    { name: 'DATABASE_PATH', default: '/app/data/conductor.db', desc: 'SQLite path' }
  ]
};

// Managers ------------------------------------------------------------------
const managers = [
  // --- Core ----------------------------------------------------------------
  {
    name: 'key_manager', aws: 'KMS', category: 'Core', port: 3102, status: 'implemented',
    summary: 'Key management service: symmetric/data keys, envelope encryption, rotation. Backs storage + secrets encryption.',
    proxyBase: '/api', capabilities: ['kms', 'encryption', 'keys'],
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness (SQLite); conductor proxy skips projectId (isLiveness)' },
      { method: 'GET', path: '/ready', summary: 'Readiness (DB + MASTER_KEY); conductor proxy skips projectId (isLiveness)' },
      { method: 'GET', path: '/api/info', summary: 'Service metadata (unauthenticated)' },
      { method: 'POST', path: '/api/keys', summary: 'Create a key ({ name, type, algorithm })' },
      { method: 'GET', path: '/api/keys', summary: 'List keys' },
      { method: 'GET', path: '/api/keys/:name', summary: 'Get a key (includes key_material for authorized callers)' },
      { method: 'POST', path: '/api/keys/:name/rotate', summary: 'Rotate a key' },
      { method: 'POST', path: '/api/keys/:name/archive', summary: 'Archive a key (mark inactive)' },
      { method: 'DELETE', path: '/api/keys/:name', summary: 'Delete a key (all versions)' }
    ],
    env: [
      { name: 'PORT', default: '3102', desc: 'Listen port (matches conductor managerServicePorts)' },
      { name: 'MASTER_KEY', default: '-', desc: '64 hex chars (AES-256 master key). Required; all-zero refused in production.' },
      { name: 'CONDUCTOR_URL', default: '', desc: 'Conductor URL for auto-registration' },
      { name: 'DATABASE_PATH', default: '/app/data/key_manager.db', desc: 'SQLite path for key store' }
    ]
  },
  {
    name: 'storage_manager', aws: 'S3', category: 'Core', port: 3003, status: 'implemented',
    summary: 'Object storage: buckets + objects with envelope encryption, multipart/chunked uploads, and signed URLs.',
    proxyBase: '/api', capabilities: ['object-storage', 'buckets', 'signed-urls', 'encryption'],
    projectInPath: true,
    endpoints: [
      { method: 'GET', path: '/ready', summary: 'Readiness (key_manager via conductor unless MOCK_KEY_MANAGER)' },
      { method: 'POST', path: '/api/projects/:projectId/buckets', summary: 'Create a bucket' },
      { method: 'GET', path: '/api/projects/:projectId/buckets', summary: 'List buckets' },
      { method: 'GET', path: '/api/projects/:projectId/buckets/:bucket', summary: 'Get a bucket' },
      { method: 'DELETE', path: '/api/projects/:projectId/buckets/:bucket', summary: 'Delete a bucket' },
      { method: 'POST', path: '/api/projects/:projectId/buckets/:bucket/files/:key', summary: 'Upload an object' },
      { method: 'GET', path: '/api/projects/:projectId/buckets/:bucket/files/:key', summary: 'Download an object' },
      { method: 'GET', path: '/api/projects/:projectId/buckets/:bucket/files', summary: 'List objects' },
      { method: 'POST', path: '/api/projects/:projectId/buckets/:bucket/files/:key/signed-url/download', summary: 'Create a signed download URL' }
    ],
    env: [
      { name: 'STORAGE_PATH', default: './storage', desc: 'Where object bytes are stored' },
      { name: 'AUTH_REQUIRED', default: 'true', desc: 'Compose default; fail start if key_manager health fails when not mocking' },
      { name: 'MOCK_KEY_MANAGER', default: 'false', desc: 'Local/tests only; refused when NODE_ENV=production' }
    ]
  },
  {
    name: 'db_manager', aws: 'RDS', category: 'Core', port: 3004, status: 'implemented',
    summary: 'Managed database control plane: provision/start/stop/restart engines (postgresql, mongodb, neo4j, elasticsearch, redis, sqlite3, lancedb), backups + restore, volumes, LanceDB vectors, constrained memory SQL.',
    proxyBase: '/api', capabilities: ['managed-db', 'backups', 'lifecycle', 'vectors', 'memory-sql'],
    endpoints: [
      { method: 'GET', path: '/api/info', summary: 'Service metadata' },
      { method: 'GET', path: '/health', summary: 'Liveness (control-plane SQLite)' },
      { method: 'GET', path: '/ready', summary: 'Readiness (key_manager unless MOCK_KEY_MANAGER)' },
      { method: 'POST', path: '/api/databases', summary: 'Provision a database (project_id query only; type required)' },
      { method: 'GET', path: '/api/databases', summary: 'List databases' },
      { method: 'GET', path: '/api/databases/:name', summary: 'Get a database (includes arn)' },
      { method: 'GET', path: '/api/databases/:name/connection', summary: 'Connection info' },
      { method: 'POST', path: '/api/databases/:name/start', summary: 'Start' },
      { method: 'POST', path: '/api/databases/:name/stop', summary: 'Stop' },
      { method: 'POST', path: '/api/databases/:name/restart', summary: 'Restart' },
      { method: 'POST', path: '/api/databases/:name/backups', summary: 'Create a backup' },
      { method: 'POST', path: '/api/databases/:name/backups/:backupId/restore', summary: 'Restore a backup' },
      { method: 'GET', path: '/api/databases/:name/health', summary: 'Health' },
      { method: 'GET', path: '/api/databases/:name/volumes', summary: 'Volume / mount metadata' },
      { method: 'POST', path: '/api/databases/:name/vectors/upsert', summary: 'Upsert vectors (lancedb)' },
      { method: 'POST', path: '/api/databases/:name/vectors/search', summary: 'Search vectors (lancedb)' },
      { method: 'DELETE', path: '/api/databases/:name/vectors', summary: 'Delete vectors (lancedb)' },
      { method: 'POST', path: '/api/databases/:name/memory/sql', summary: 'Constrained memory SQL (sqlite3)' },
      { method: 'DELETE', path: '/api/databases/:name', summary: 'Delete' }
    ],
    env: [
      { name: 'PROJECT_ID', default: 'default', desc: 'Project this control plane serves' },
      { name: 'MOCK_KEY_MANAGER', default: 'false', desc: 'Dev/tests only; refused when NODE_ENV=production' }
    ]
  },

  // --- Compute -------------------------------------------------------------
  {
    name: 'compute_manager', aws: 'Kubernetes (aerekos Compute)', category: 'Compute', port: 3100, status: 'implemented',
    summary: 'aerekos Compute — our Kubernetes-class orchestrator: Deployments, rolling updates, abort/rollback; Docker node agent for Pods.',
    proxyBase: '/api/v1', capabilities: ['deployments', 'containers', 'tasks', 'docker', 'orchestrator'],
    endpoints: [
      { method: 'PUT', path: '/api/v1/deployments/:id', summary: 'Apply declarative Deployment' },
      { method: 'GET', path: '/api/v1/deployments/:id', summary: 'Get Deployment + status' },
      { method: 'POST', path: '/api/v1/deployments/:id/reconcile', summary: 'Reconcile once (abort on deadline)' },
      { method: 'POST', path: '/api/v1/deployments/:id/pause', summary: 'Pause rollout' },
      { method: 'POST', path: '/api/v1/deployments/:id/resume', summary: 'Resume rollout' },
      { method: 'POST', path: '/api/v1/deployments/:id/rollback', summary: 'Rollback to revision' },
      { method: 'POST', path: '/api/v1/tasks', summary: 'Create a task (legacy)' },
      { method: 'GET', path: '/api/v1/tasks', summary: 'List tasks' },
      { method: 'GET', path: '/api/v1/tasks/:id', summary: 'Get a task' },
      { method: 'POST', path: '/api/v1/tasks/:id/stop', summary: 'Stop a task' },
      { method: 'DELETE', path: '/api/v1/tasks/:id', summary: 'Delete a task' }
    ],
    env: [
      { name: 'SKIP_DOCKER', default: '0', desc: 'Tests/local metadata-only mock containers; refused when NODE_ENV=production' },
      { name: 'COMPUTE_E2E_DOCKER', default: '0', desc: 'Enable dockerode apply in reconcile e2e' }
    ]
  },
  {
    name: 'queue_manager', aws: 'SQS', category: 'Compute', port: 3101, status: 'implemented',
    summary: 'Project-scoped queues: standard/fifo (SQLite), rabbitmq (AMQP), redis_stream. At-least-once + visibility (default 30s). Optional DLQ. Does not auto-create capacity-wait. Default store SQLite; AEREKOS_QUEUE_PROVIDER=local_nats is in-memory non-prod only.',
    proxyBase: '/api/v1', capabilities: ['queues', 'messaging'],
    endpoints: [
      { method: 'POST', path: '/api/v1/queues', summary: 'Create a queue (engine, dlq, visibility optional)' },
      { method: 'GET', path: '/api/v1/queues', summary: 'List queues (engine, dlq, depth)' },
      { method: 'GET', path: '/api/v1/queues/:name', summary: 'Get a queue' },
      { method: 'PATCH', path: '/api/v1/queues/:name', summary: 'Update visibility / dlq / max_receive' },
      { method: 'DELETE', path: '/api/v1/queues/:name', summary: 'Delete a queue' },
      { method: 'POST', path: '/api/v1/queues/:name/messages', summary: 'Send a message' },
      { method: 'POST', path: '/api/v1/queues/:name/messages/receive', summary: 'Receive messages (POST only; no GET list)' },
      { method: 'DELETE', path: '/api/v1/queues/:name/messages/:messageId', summary: 'Delete (ack) a message' },
      { method: 'POST', path: '/api/v1/queues/:name/messages/:messageId/visibility', summary: 'Change visibility' }
    ],
    env: [
      { name: 'AEREKOS_QUEUE_PROVIDER', default: 'sqlite', desc: 'sqlite (prod default) | local_nats (in-memory stub, non-prod) | nats (501 until JetStream)' },
      { name: 'SKIP_BROKER', default: '0', desc: 'Skip rabbitmq/redis I/O (tests)' },
      { name: 'RABBITMQ_URL', default: 'amqp://aerekos:aerekos@rabbitmq:5672', desc: 'Required for engine=rabbitmq' },
      { name: 'REDIS_URL', default: 'redis://redis:6379', desc: 'Required for engine=redis_stream' }
    ]
  },
  {
    name: 'schedule_manager', aws: 'EventBridge Scheduler', category: 'Compute', port: 3102, status: 'implemented',
    summary: 'Cron schedules that dispatch to a webhook or a queue. Run-now supported. Port 3102 collides with key_manager.',
    proxyBase: '/api/v1', capabilities: ['cron', 'scheduling', 'dispatch'],
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness; conductor proxy skips projectId (isLiveness)' },
      { method: 'GET', path: '/ready', summary: 'Readiness (SQLite); conductor proxy skips projectId (isLiveness)' },
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata (status: active)' },
      { method: 'POST', path: '/api/v1/schedules', summary: 'Create a schedule (cron + target)' },
      { method: 'GET', path: '/api/v1/schedules', summary: 'List schedules' },
      { method: 'GET', path: '/api/v1/schedules/:id', summary: 'Get a schedule' },
      { method: 'POST', path: '/api/v1/schedules/:id/run', summary: 'Run now' },
      { method: 'PATCH', path: '/api/v1/schedules/:id', summary: 'Update a schedule' },
      { method: 'DELETE', path: '/api/v1/schedules/:id', summary: 'Delete a schedule' }
    ],
    env: [
      { name: 'PORT', default: '3102', desc: 'Listen port — collides with key_manager in managerServicePorts' },
      { name: 'SKIP_CRON', default: '0', desc: 'Disable the cron loop (tests only; not a prod mock)' },
      { name: 'QUEUE_MANAGER_URL', default: 'http://127.0.0.1:3101', desc: 'Base URL for action_type=queue' }
    ]
  },
  {
    name: 'network_manager', aws: 'VPC', category: 'Compute', port: 3103, status: 'implemented',
    summary: 'Per-project Docker bridge networks with stable names. Attach service containers for isolation. Mesh helpers optional.',
    proxyBase: '/api/v1', capabilities: ['networking', 'docker-networks'],
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness' },
      { method: 'GET', path: '/ready', summary: 'Readiness' },
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata' },
      { method: 'POST', path: '/api/v1/networks', summary: 'Create a network (bridge only)' },
      { method: 'GET', path: '/api/v1/networks', summary: 'List networks' },
      { method: 'GET', path: '/api/v1/networks/:id', summary: 'Get a network' },
      { method: 'DELETE', path: '/api/v1/networks/:id', summary: 'Delete a network' },
      { method: 'POST', path: '/api/v1/networks/ensure-default', summary: 'Ensure logical default network' },
      { method: 'GET', path: '/api/v1/mesh', summary: 'Headscale mesh status' },
      { method: 'POST', path: '/api/v1/mesh/preauth', summary: 'Mint mesh preauth key' }
    ],
    env: [
      { name: 'SKIP_DOCKER', default: '0', desc: 'Metadata-only mode (tests only; refused in production)' },
      { name: 'HEADSCALE_URL', default: '', desc: 'Optional Headscale control plane URL' }
    ]
  },

  // --- Observability -------------------------------------------------------
  {
    name: 'logs_manager', aws: 'CloudWatch Logs', category: 'Observability', port: 3104, status: 'implemented',
    summary: 'Append-only log events with levels and context. Batch ingest for the worker outbox/shipper.',
    proxyBase: '/api/v1', capabilities: ['logs', 'ingest'],
    endpoints: [
      { method: 'POST', path: '/api/v1/logs', summary: 'Append a log event' },
      { method: 'POST', path: '/api/v1/logs/batch', summary: 'Batch append (outbox shipper)' },
      { method: 'GET', path: '/api/v1/logs', summary: 'Query logs (level, since, limit)' },
      { method: 'GET', path: '/api/v1/logs/:id', summary: 'Get a log event' }
    ]
  },
  {
    name: 'metrics_manager', aws: 'CloudWatch Metrics', category: 'Observability', port: 3105, status: 'implemented',
    summary: 'Stored metric samples (name/value/labels). Aggregation cluster is future work.',
    proxyBase: '/api/v1', crud: { segment: 'series' }, capabilities: ['metrics', 'samples']
  },
  {
    name: 'security_manager', aws: 'Security Hub', category: 'Observability', port: 3108, status: 'implemented',
    summary: 'Security finding records (severity/source/details). Detectors wired later.',
    proxyBase: '/api/v1', crud: { segment: 'findings' }, capabilities: ['security', 'findings']
  },
  {
    name: 'analytics_manager', aws: 'Pinpoint / Kinesis Analytics', category: 'Observability', port: 3117, status: 'implemented',
    summary: 'Product analytics events (event/value/properties).',
    proxyBase: '/api/v1', crud: { segment: 'events' }, capabilities: ['analytics', 'events']
  },

  // --- Identity & secrets --------------------------------------------------
  {
    name: 'iam_manager', aws: 'IAM', category: 'Identity', port: 3106, status: 'implemented',
    summary: 'Roles, allow/deny JSON policies, role↔policy bindings, and evaluate. Conductor enforces when IAM_ENFORCE_PROXY=true.',
    proxyBase: '/api/v1', capabilities: ['rbac', 'roles', 'policies'],
    endpoints: [
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata' },
      { method: 'GET', path: '/health', summary: 'Liveness (SQLite)' },
      { method: 'GET', path: '/ready', summary: 'Readiness' },
      { method: 'POST', path: '/api/v1/roles', summary: 'Create a role' },
      { method: 'GET', path: '/api/v1/roles', summary: 'List roles' },
      { method: 'GET', path: '/api/v1/roles/:id', summary: 'Get a role' },
      { method: 'PATCH', path: '/api/v1/roles/:id', summary: 'Update a role' },
      { method: 'DELETE', path: '/api/v1/roles/:id', summary: 'Delete a role' },
      { method: 'POST', path: '/api/v1/roles/:roleId/policies', summary: 'Attach a policy to a role' },
      { method: 'GET', path: '/api/v1/roles/:roleId/policies', summary: 'List a role\'s policies' },
      { method: 'DELETE', path: '/api/v1/roles/:roleId/policies/:policyId', summary: 'Detach a policy' },
      { method: 'POST', path: '/api/v1/policies', summary: 'Create a policy' },
      { method: 'GET', path: '/api/v1/policies', summary: 'List policies' },
      { method: 'GET', path: '/api/v1/policies/:id', summary: 'Get a policy' },
      { method: 'PATCH', path: '/api/v1/policies/:id', summary: 'Update a policy' },
      { method: 'DELETE', path: '/api/v1/policies/:id', summary: 'Delete a policy' },
      { method: 'POST', path: '/api/v1/evaluate', summary: 'Evaluate allow/deny for action + resource' }
    ]
  },
  {
    name: 'secrets_manager', aws: 'Secrets Manager', category: 'Identity', port: 3107, status: 'implemented',
    summary: 'Encrypted secrets (AES-256-GCM envelope via key_manager). List never returns plaintext; ?reveal=1 or GET /secrets/values for plaintext.',
    proxyBase: '/api/v1', capabilities: ['secrets', 'encryption'],
    endpoints: [
      { method: 'POST', path: '/api/v1/secrets', summary: 'Create a secret ({ name, value }, optional environment)' },
      { method: 'GET', path: '/api/v1/secrets', summary: 'List secrets (no values; optional environment)' },
      { method: 'GET', path: '/api/v1/secrets/values', summary: 'Name→plaintext map for an environment' },
      { method: 'GET', path: '/api/v1/secrets/:id', summary: 'Get a secret (?reveal=1 for value)' },
      { method: 'PATCH', path: '/api/v1/secrets/:id', summary: 'Update a secret' },
      { method: 'DELETE', path: '/api/v1/secrets/:id', summary: 'Delete a secret' }
    ],
    env: [
      { name: 'MOCK_KEY_MANAGER', default: 'false', desc: 'Tests/local only; refused when NODE_ENV=production' },
      { name: 'CONDUCTOR_URL', default: '', desc: 'Required for key_manager envelopes unless MOCK_KEY_MANAGER' },
      { name: 'SERVICE_TOKEN', default: '', desc: 'Service token for key_manager via conductor' },
      { name: 'SECRETS_ENCRYPTION_KEY_NAME', default: 'secrets-envelope-key', desc: 'key_manager key name for envelopes' }
    ]
  },
  {
    name: 'auth_manager', aws: 'Cognito', category: 'Identity', port: 3116, status: 'implemented',
    summary: 'OIDC provider metadata, app credentials (client_credentials), project users (password grant), JWT issue/verify. IdP client_secret stays in secrets_manager.',
    proxyBase: '/api/v1', capabilities: ['oidc', 'identity-providers', 'credentials', 'users', 'tokens'],
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness' },
      { method: 'GET', path: '/ready', summary: 'Readiness' },
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata' },
      { method: 'POST', path: '/api/v1/providers', summary: 'Create OIDC provider metadata' },
      { method: 'GET', path: '/api/v1/providers', summary: 'List providers' },
      { method: 'GET', path: '/api/v1/providers/:id', summary: 'Get provider' },
      { method: 'PATCH', path: '/api/v1/providers/:id', summary: 'Update provider' },
      { method: 'DELETE', path: '/api/v1/providers/:id', summary: 'Delete provider' },
      { method: 'POST', path: '/api/v1/credentials', summary: 'Create app credential' },
      { method: 'GET', path: '/api/v1/credentials', summary: 'List credentials' },
      { method: 'GET', path: '/api/v1/credentials/:id', summary: 'Get credential' },
      { method: 'PATCH', path: '/api/v1/credentials/:id', summary: 'Update credential' },
      { method: 'DELETE', path: '/api/v1/credentials/:id', summary: 'Delete credential' },
      { method: 'POST', path: '/api/v1/credentials/:id/rotate', summary: 'Rotate client_secret' },
      { method: 'POST', path: '/api/v1/users', summary: 'Create project user' },
      { method: 'GET', path: '/api/v1/users', summary: 'List users' },
      { method: 'GET', path: '/api/v1/users/:id', summary: 'Get user' },
      { method: 'PATCH', path: '/api/v1/users/:id', summary: 'Update user' },
      { method: 'DELETE', path: '/api/v1/users/:id', summary: 'Delete user' },
      { method: 'POST', path: '/api/v1/auth/token', summary: 'client_credentials → access_token' },
      { method: 'POST', path: '/api/v1/auth/login', summary: 'Password grant → user JWT' },
      { method: 'POST', path: '/api/v1/auth/verify', summary: 'Verify token' },
      { method: 'POST', path: '/api/v1/auth/introspect', summary: 'RFC 7662-style introspect' }
    ],
    env: [
      { name: 'AUTH_MANAGER_SECRET', default: '(KMS preferred)', desc: 'Boot fallback signing secret; prod uses auth_manager.signing_secret via secrets_manager' },
      { name: 'CONDUCTOR_CLIENT_SECRET', default: '(KMS preferred)', desc: 'conductor client_credentials peer secret' }
    ]
  },

  // --- Edge ----------------------------------------------------------------
  {
    name: 'tunnel_manager', aws: 'Cloudflare Tunnel', category: 'Edge', port: 3110, status: 'needs-keys',
    summary: 'Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins. Token returned once on create.',
    proxyBase: '/api/v1', capabilities: ['tunnels', 'edge'],
    endpoints: [
      { method: 'POST', path: '/api/v1/tunnels', summary: 'Create a tunnel' },
      { method: 'GET', path: '/api/v1/tunnels', summary: 'List tunnels' },
      { method: 'GET', path: '/api/v1/tunnels/:id', summary: 'Get a tunnel' },
      { method: 'DELETE', path: '/api/v1/tunnels/:id', summary: 'Delete a tunnel' }
    ],
    needsKeys: 'CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID. SKIP_CLOUDFLARE=1 for tests.'
  },
  {
    name: 'domain_manager', aws: 'Route 53', category: 'Edge', port: 3111, status: 'needs-keys',
    summary: 'Cloudflare DNS records (CRUD per zone + project). Pairs with tunnel_manager for public hostnames.',
    proxyBase: '/api/v1', capabilities: ['dns', 'edge'],
    endpoints: [
      { method: 'POST', path: '/api/v1/dns/records', summary: 'Create a DNS record' },
      { method: 'GET', path: '/api/v1/dns/records', summary: 'List DNS records' },
      { method: 'GET', path: '/api/v1/dns/records/:id', summary: 'Get a record' },
      { method: 'PATCH', path: '/api/v1/dns/records/:id', summary: 'Update a record' },
      { method: 'DELETE', path: '/api/v1/dns/records/:id', summary: 'Delete a record' }
    ],
    needsKeys: 'CLOUDFLARE_API_TOKEN. SKIP_CLOUDFLARE=1 for tests.'
  },
  {
    name: 'cdn_manager', aws: 'CloudFront', category: 'Edge', port: 3118, status: 'implemented',
    summary: 'CDN-style cache rules (path pattern, origin, TTL). Config only in MVP.',
    proxyBase: '/api/v1', crud: { segment: 'rules' }, capabilities: ['cdn', 'cache-rules']
  },
  {
    name: 'balancer_manager', aws: 'ELB', category: 'Edge', port: 3109, status: 'implemented',
    summary: 'Load-balancer target hints (addresses) with optional HTTP health probes. No cloud LB provisioning in MVP.',
    proxyBase: '/api/v1', crud: { segment: 'targets' }, capabilities: ['load-balancing', 'targets'],
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness' },
      { method: 'GET', path: '/ready', summary: 'Readiness' },
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata' },
      { method: 'POST', path: '/api/v1/targets', summary: 'Create a target hint' },
      { method: 'GET', path: '/api/v1/targets', summary: 'List targets' },
      { method: 'GET', path: '/api/v1/targets/:id', summary: 'Get a target' },
      { method: 'PATCH', path: '/api/v1/targets/:id', summary: 'Update a target' },
      { method: 'DELETE', path: '/api/v1/targets/:id', summary: 'Delete a target' },
      { method: 'GET', path: '/api/v1/targets/health', summary: 'Probe target health' },
      { method: 'GET', path: '/api/v1/targets/:id/health', summary: 'Probe one target' }
    ],
    env: [
      { name: 'SKIP_HEALTH', default: '0', desc: 'Skip live probes (tests only; refused in production)' }
    ]
  },

  // --- Integrations & comms ------------------------------------------------
  {
    name: 'webhook_manager', aws: 'EventBridge / SNS (HTTP)', category: 'Integrations', port: 3112, status: 'implemented',
    summary: 'Outbound webhooks: endpoints with secret + headers, and a dispatch action. SKIP_OUTBOUND=1 to avoid network.',
    proxyBase: '/api/v1', capabilities: ['webhooks', 'fanout'],
    endpoints: [
      { method: 'POST', path: '/api/v1/webhooks', summary: 'Create an endpoint ({ name, target_url })' },
      { method: 'GET', path: '/api/v1/webhooks', summary: 'List endpoints' },
      { method: 'GET', path: '/api/v1/webhooks/:id', summary: 'Get an endpoint' },
      { method: 'PATCH', path: '/api/v1/webhooks/:id', summary: 'Update an endpoint' },
      { method: 'DELETE', path: '/api/v1/webhooks/:id', summary: 'Delete an endpoint' },
      { method: 'POST', path: '/api/v1/webhooks/:id/dispatch', summary: 'Send a payload to the endpoint' }
    ],
    env: [{ name: 'SKIP_OUTBOUND', default: '0', desc: 'Record but do not send (tests)' }]
  },
  {
    name: 'email_manager', aws: 'SES', category: 'Integrations', port: 3113, status: 'needs-keys',
    summary: 'Email messages (to/subject/body). Send when SMTP secrets exist; otherwise queue-only.',
    proxyBase: '/api/v1', crud: { segment: 'messages' }, capabilities: ['email'],
    needsKeys: 'Queued only this pass. Do not retry live SMTP send.'
  },
  {
    name: 'sms_manager', aws: 'SNS SMS', category: 'Integrations', port: 3114, status: 'needs-keys',
    summary: 'SMS messages (to_number/body). Send when Twilio secrets exist; otherwise queue-only.',
    proxyBase: '/api/v1', crud: { segment: 'messages' }, capabilities: ['sms'],
    needsKeys: 'Queued only this pass. Do not retry live Twilio send.'
  },
  {
    name: 'slack_manager', aws: 'Chatbot', category: 'Integrations', port: 3115, status: 'needs-keys',
    summary: 'Slack posts (channel/text). Send when Slack secrets exist; otherwise queue-only.',
    proxyBase: '/api/v1', crud: { segment: 'messages' }, capabilities: ['slack', 'chatops'],
    needsKeys: 'Queued only this pass. Do not retry live Slack post.'
  },

  // --- Dev tools -----------------------------------------------------------
  {
    name: 'git_manager', aws: 'CodeCommit', category: 'Dev tools', port: 3130, status: 'implemented',
    summary: 'Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks.',
    proxyBase: '/api/v1', capabilities: ['git', 'scm', 'smart-http'],
    endpoints: [
      { method: 'POST', path: '/api/v1/repos', summary: 'Create a repo (git init --bare)' },
      { method: 'GET', path: '/api/v1/repos', summary: 'List repos' },
      { method: 'GET', path: '/api/v1/repos/:id', summary: 'Get a repo + branches' },
      { method: 'GET', path: '/api/v1/repos/:id/branches', summary: 'List branches' },
      { method: 'GET', path: '/api/v1/repos/:id/commits', summary: 'List commits (?branch=&limit=)' },
      { method: 'GET', path: '/api/v1/repos/:id/pushes', summary: 'List recorded push events' },
      { method: 'PATCH', path: '/api/v1/repos/:id', summary: 'Update a repo' },
      { method: 'DELETE', path: '/api/v1/repos/:id', summary: 'Delete a repo' },
      { method: 'GET/POST', path: '/git/:project/:repo.git/...', summary: 'Git Smart HTTP transport (clone/push/pull, direct port)' }
    ],
    env: [
      { name: 'GIT_REPOS_ROOT', default: './data/repos', desc: 'Bare repo store' },
      { name: 'GIT_AUTH_TOKEN', default: '-', desc: 'Optional Bearer/Basic token for the transport' }
    ]
  },
  {
    name: 'registry_manager', aws: 'ECR', category: 'Dev tools', port: 3129, status: 'implemented',
    summary: 'Container registry discovery: per-project registry entries (no pull secrets) + a public config endpoint.',
    proxyBase: '/api/v1', capabilities: ['registry', 'oci', 'images'],
    endpoints: [
      { method: 'POST', path: '/api/v1/registries', summary: 'Create a registry entry' },
      { method: 'GET', path: '/api/v1/registries', summary: 'List entries' },
      { method: 'GET', path: '/api/v1/registries/:id', summary: 'Get an entry' },
      { method: 'PATCH', path: '/api/v1/registries/:id', summary: 'Update an entry' },
      { method: 'DELETE', path: '/api/v1/registries/:id', summary: 'Delete an entry' },
      { method: 'GET', path: '/api/v1/registry/config', summary: 'Public registry config (no secrets)' }
    ]
  },
  {
    name: 'cicd_manager', aws: 'CodePipeline', category: 'Dev tools', port: 3119, status: 'implemented',
    summary: 'Pipeline definitions (steps JSON + state) with run/run-for-repo. Real runners are future work.',
    proxyBase: '/api/v1', crud: { segment: 'pipelines' }, capabilities: ['ci-cd', 'pipelines'],
    endpoints: [
      { method: 'POST', path: '/api/v1/pipelines/:id/run', summary: 'Run pipeline action (test/deploy/build-image/apply-stack/fleet)' },
      { method: 'POST', path: '/api/v1/pipelines/run-for-repo', summary: 'Match + run pipelines for a repo push' },
    ],
  },
  {
    name: 'code_as_infra', aws: 'CloudFormation', category: 'Dev tools', port: 3120, status: 'experimental',
    summary: 'Experimental — module CRUD is being folded into conductor stack revisions (`/api/projects/:id/stack`). Prefer StackService as single writer.',
    proxyBase: '/api/v1', crud: { segment: 'modules' }, capabilities: ['iac', 'modules']
  },
  {
    name: 'api_manager', aws: 'API Gateway', category: 'Dev tools', port: 3124, status: 'implemented',
    summary: 'API Gateway routes + hosted Data API (schema→CRUD, hooks→function_manager, scale). Icarus Flows configure via stack data_apis.',
    proxyBase: '/api/v1', crud: { segment: 'endpoints' }, capabilities: ['api-gateway', 'routing', 'data-api'],
    endpoints: [
      { method: 'POST', path: '/api/v1/data-apis/apply', summary: 'Apply model schema → CRUD Data API' },
      { method: 'GET', path: '/api/v1/data/:app/:Model', summary: 'List/read Data API records' },
    ],
  },
  {
    name: 'app_manager', aws: 'Amplify / App Runner', category: 'Dev tools', port: 3125, status: 'implemented',
    summary: 'App metadata + FE scaffold (POST /apps/scaffold) for Icarus IDE; deploy via compute/cicd/tunnel.',
    proxyBase: '/api/v1', crud: { segment: 'apps' }, capabilities: ['apps', 'deploys', 'scaffold'],
    endpoints: [
      { method: 'POST', path: '/api/v1/apps/scaffold', summary: 'Scaffold FE starter files for Icarus IDE' },
    ],
  },
  {
    name: 'mcp_manager', aws: 'Bedrock Agents (tools)', category: 'Dev tools', port: 3123, status: 'implemented',
    summary: 'MCP tool registry (description + input_schema). GET /platform-tools lists schemas for backup/iac/edge/systems/graphql/search.',
    proxyBase: '/api/v1', crud: { segment: 'tools' }, capabilities: ['mcp', 'tools'],
    endpoints: [
      { method: 'GET', path: '/api/v1/platform-tools', summary: 'Catalog input_schema for platform tools (backup, iac, edge, systems, graphql, search, stack)' },
      { method: 'POST', path: '/api/v1/tools/:id/invoke', summary: 'Invoke a registered tool against input_schema.endpoint' }
    ]
  },

  // --- AI ------------------------------------------------------------------
  {
    name: 'ai_manager', aws: 'Bedrock', category: 'AI', port: 3126, status: 'needs-keys',
    summary: 'Icarus console (/icarus): talk + Laya decisions + guided Flows, live plan graph, Fleet, Models, Apps, Icarus IDE live. GPU engines, intelligence jobs, agents, connectors. WS ai:live + ai:icarus.* + ai:ide.* + ai:agent.*. No checked-in OpenAPI (large surface). No prod MOCK_* inference.',
    consolePath: '/icarus',
    docsGuide: 'guides/icarus.md',
    proxyBase: '/api/v1', crud: { segment: 'intelligence' }, capabilities: ['ai', 'intelligence', 'stt', 'tts', 'agents', 'connectors'],
    needsKeys: 'LLM endpoint/URL + provider keys (e.g. Ollama URL) to run inference.',
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Liveness (SQLite); conductor skips projectId' },
      { method: 'GET', path: '/ready', summary: 'Readiness; conductor skips projectId' },
      { method: 'GET', path: '/api/v1/info', summary: 'Service metadata' },
      { method: 'POST', path: '/api/v1/intelligence', summary: 'Create intelligence endpoint' },
      { method: 'GET', path: '/api/v1/intelligence', summary: 'List intelligence (?project_id=)' },
      { method: 'GET', path: '/api/v1/intelligence/:id', summary: 'Get one intelligence' },
      { method: 'PATCH', path: '/api/v1/intelligence/:id', summary: 'Update intelligence' },
      { method: 'DELETE', path: '/api/v1/intelligence/:id', summary: 'Delete intelligence' },
      { method: 'GET', path: '/api/v1/icarus/plans', summary: 'List Icarus plan graphs for a project' },
      { method: 'GET', path: '/api/v1/icarus/plans/:planId', summary: 'Get one plan' },
      { method: 'GET', path: '/api/v1/icarus/plans/:planId/scrub', summary: 'Time-travel subgraph scrub' },
      { method: 'GET', path: '/api/v1/icarus/ready', summary: 'Ready tasks for a plan' },
      { method: 'GET', path: '/api/v1/icarus/tasks/:taskId/trace', summary: 'Task tools + why/trace' },
      { method: 'GET', path: '/api/v1/icarus/status', summary: 'Icarus graph/runtime status' },
      { method: 'GET', path: '/api/v1/engines', summary: 'Fleet AI engine placements + catalog' },
      { method: 'GET', path: '/api/v1/engines/catalog', summary: 'Placeable engine kinds (vLLM, STT, Kokoro, XTTS, Ollama, cache)' },
      { method: 'POST', path: '/api/v1/engines', summary: 'Place { kind, worker_id } on a GPU worker (no auto-start for vLLM/XTTS/Ollama)' },
      { method: 'POST', path: '/api/v1/engines/:id/start', summary: 'Start a placed engine' },
      { method: 'POST', path: '/api/v1/engines/:id/stop', summary: 'Stop a placed engine' },
      { method: 'POST', path: '/api/v1/intelligence/jobs', summary: 'Submit a queued intelligence job' },
      { method: 'GET', path: '/api/v1/intelligence/jobs', summary: 'List jobs' },
      { method: 'GET', path: '/api/v1/intelligence/jobs/:id', summary: 'Get job snapshot (partial/result)' },
      { method: 'POST', path: '/api/v1/intelligence/jobs/:id/cancel', summary: 'Cancel a queued or running job' },
      { method: 'GET', path: '/api/v1/agents/setup/status', summary: 'Icarus fabric probe (Orin AI, prod-mini computer)' },
      { method: 'POST', path: '/api/v1/agents/setup', summary: 'Idempotent agent setup (intelligence, memory, RAG, settings)' },
      { method: 'GET', path: '/api/v1/agents/settings', summary: 'Project agent settings (concurrency, jail, write policy)' },
      { method: 'PATCH', path: '/api/v1/agents/settings', summary: 'Update project agent settings' },
      { method: 'GET', path: '/api/v1/agents/fleet', summary: 'Live fleet canvas snapshot' },
      { method: 'POST', path: '/api/v1/agents/resume', summary: 'Boot resume: heal, due crons (late labeled), learn jobs, workers, idle last' },
      { method: 'POST', path: '/api/v1/agents', summary: 'Create a named Icarus agent (ARN ai:agent:endpoint/name)' },
      { method: 'GET', path: '/api/v1/agents', summary: 'List agents' },
      { method: 'GET', path: '/api/v1/agents/:id', summary: 'Get agent by id or name' },
      { method: 'PATCH', path: '/api/v1/agents/:id', summary: 'Update agent knobs (mode, binds, timezone, notify)' },
      { method: 'DELETE', path: '/api/v1/agents/:id', summary: 'Delete agent' },
      { method: 'POST', path: '/api/v1/agents/:id/chat', summary: 'User-layer chat → queued intelligence job' },
      { method: 'POST', path: '/api/v1/agents/:id/voice', summary: 'Optional STT→chat→TTS compose' },
      { method: 'POST', path: '/api/v1/agents/:id/interrupt', summary: 'Stop or add context mid-flight' },
      { method: 'POST', path: '/api/v1/agents/:id/approve', summary: 'Answer an ASK card' },
      { method: 'GET', path: '/api/v1/agents/:id/pulse', summary: 'Manager pulse + gateway snapshot' },
      { method: 'GET', path: '/api/v1/agents/:id/messages', summary: 'Chat history' },
      { method: 'GET', path: '/api/v1/agents/:id/pins', summary: 'Friend memory pins' },
      { method: 'POST', path: '/api/v1/agents/:id/pins', summary: 'Pin a durable fact' },
      { method: 'DELETE', path: '/api/v1/agents/:id/pins/:key', summary: 'Forget a pin' },
      { method: 'GET', path: '/api/v1/agents/:id/memory/export', summary: 'Export pins, rolls, messages' },
      { method: 'POST', path: '/api/v1/agents/:id/memory/wipe', summary: 'Wipe friend memory for this agent' },
      { method: 'GET', path: '/api/v1/agents/:id/rolls', summary: 'Temporal rolls (today/week/month/year)' },
      { method: 'POST', path: '/api/v1/agents/:id/rolls/refresh', summary: 'Rebuild temporal rolls' },
      { method: 'GET', path: '/api/v1/agents/:id/work', summary: 'Goal/Task/Subtask graph' },
      { method: 'POST', path: '/api/v1/agents/:id/work', summary: 'Create a work item' },
      { method: 'PATCH', path: '/api/v1/agents/:id/work/:workId', summary: 'Update work priority/status' },
      { method: 'POST', path: '/api/v1/agents/:id/work/reorder', summary: 'Reorder work ids now→later' },
      { method: 'GET', path: '/api/v1/agents/:id/prompts', summary: 'Get effective + override prompts' },
      { method: 'PATCH', path: '/api/v1/agents/:id/prompts', summary: 'Patch per-agent prompt overrides' },
      { method: 'POST', path: '/api/v1/agents/:id/prompts/reset', summary: 'Reset prompts to bundled defaults' },
      { method: 'GET', path: '/api/v1/agents/:id/browser/frames/:frameId', summary: 'JPEG screenshot for a browse ASK' },
      { method: 'GET', path: '/api/v1/agents/:id/prs/:id/diff', summary: 'Local PR diff (capped)' },
      { method: 'GET', path: '/api/v1/agents/:id/asks', summary: 'Open and answered ASK cards (one open at a time)' },
      { method: 'GET', path: '/api/v1/agents/:id/timeline', summary: 'Shop timeline (chat, brief, ask, tool, replan, deploy)' },
      { method: 'GET', path: '/api/v1/agents/:id/workers', summary: 'Worker agents for this Icarus' },
      { method: 'POST', path: '/api/v1/agents/:id/workers', summary: 'Spawn a queued worker (handoff packet)' },
      { method: 'POST', path: '/api/v1/agents/:id/workers/:wid/run', summary: 'Run a worker tool loop' },
      { method: 'GET', path: '/api/v1/agents/:id/cron', summary: 'Routines' },
      { method: 'POST', path: '/api/v1/agents/:id/cron', summary: 'Create a cron/routine' },
      { method: 'POST', path: '/api/v1/agents/:id/cron/:cid/fire', summary: 'Fire a cron via runtime (user_turn / idle_review / shop plan)' },
      { method: 'GET', path: '/api/v1/agents/:id/skills', summary: 'Skill templates' },
      { method: 'POST', path: '/api/v1/agents/:id/skills', summary: 'Create a skill' },
      { method: 'GET', path: '/api/v1/agents/:id/audit', summary: 'Tool and connector audit (no secrets)' },
      { method: 'GET', path: '/api/v1/agents/:id/fs', summary: 'List or read workspace files (jail)' },
      { method: 'POST', path: '/api/v1/agents/:id/fs', summary: 'Write a workspace file (ASK)' },
      { method: 'POST', path: '/api/v1/agents/:id/term', summary: 'Run a workspace command (ASK if mutating)' },
      { method: 'POST', path: '/api/v1/agents/:id/tools', summary: 'Execute a workspace tool (ASK on writes)' },
      { method: 'POST', path: '/api/v1/agents/:id/claim', summary: 'Claim a worktree prefix' },
      { method: 'POST', path: '/api/v1/agents/:id/message', summary: 'Inter-agent message' },
      { method: 'GET', path: '/api/v1/agents/:id/plans', summary: 'List plans (Current/History)' },
      { method: 'GET', path: '/api/v1/agents/:id/plans/:planId', summary: 'Get one plan' },
      { method: 'POST', path: '/api/v1/agents/:id/console-events', summary: 'Playwright console ring from icarus-browser' },
      { method: 'POST', path: '/api/v1/agents/:id/compact', summary: 'Queued compact job (never pins/ASK/DoD). Intelligence options.compact: enabled, threshold_ratio, keep_recent, max_summary_chars' },
      { method: 'GET', path: '/api/v1/connectors/kinds', summary: 'Dynamic connector kind catalog' },
      { method: 'POST', path: '/api/v1/connectors', summary: 'Create a connector account (ARN connector:account/name)' },
      { method: 'GET', path: '/api/v1/connectors', summary: 'List project connectors' },
      { method: 'GET', path: '/api/v1/connectors/:id', summary: 'Get a connector' },
      { method: 'PATCH', path: '/api/v1/connectors/:id', summary: 'Update connector (secret_ref, OAuth reconnect)' },
      { method: 'DELETE', path: '/api/v1/connectors/:id', summary: 'Revoke a connector' },
      { method: 'POST', path: '/api/v1/connectors/invoke', summary: 'Invoke a connector tool (ASK if needs_auth)' },
    ],
  },
  {
    name: 'crawler_manager', aws: 'Glue Crawler', category: 'AI', port: 3121, status: 'needs-keys',
    summary: 'Crawl job metadata (start_url/max_depth/state). Real fetching needs network egress.',
    proxyBase: '/api/v1', crud: { segment: 'jobs' }, capabilities: ['crawler', 'jobs'],
    needsKeys: 'Network egress + enabling real fetch to crawl.'
  },

  // --- Platform ------------------------------------------------------------
  {
    name: 'host_manager', aws: 'EC2 / SSM inventory', category: 'Platform', port: 3122, status: 'implemented',
    summary: 'Host inventory synced from conductor /api/workers (not a second fleet to register by hand).',
    proxyBase: '/api/v1', crud: { segment: 'hosts' }, capabilities: ['inventory', 'hosts'],
    endpoints: [
      { method: 'POST', path: '/api/v1/sync', summary: 'Sync hosts from conductor workers' }
    ]
  },
  {
    name: 'worker_manager', aws: 'SSM fleet / tags', category: 'Platform', port: 3128, status: 'implemented',
    summary: 'Worker/fleet labels synced from conductor /api/workers.',
    proxyBase: '/api/v1', crud: { segment: 'annotations' }, capabilities: ['fleet', 'labels'],
    endpoints: [
      { method: 'POST', path: '/api/v1/sync', summary: 'Sync annotations from conductor workers' }
    ]
  },
  {
    name: 'system_manager', aws: 'Systems Manager', category: 'Platform', port: 3127, status: 'implemented',
    summary: 'Fleet patch board plus host OS/Docker check and update. Always on per device; no project enable.',
    proxyBase: '/api/v1', crud: { segment: 'tasks' }, capabilities: ['maintenance', 'tasks'],
    endpoints: [
      { method: 'GET', path: '/api/v1/hosts/:workerId/check', summary: 'Host OS/Docker freshness' },
      { method: 'POST', path: '/api/v1/hosts/:workerId/check', summary: 'Re-probe host OS/Docker' },
      { method: 'POST', path: '/api/v1/hosts/:workerId/update', summary: 'Update host OS or Docker ({ target })' }
    ]
  },
  {
    name: 'websocket_manager', aws: 'API Gateway WebSocket', category: 'Dev tools', port: 3131, status: 'implemented',
    summary: 'WebSocket channels.',
    proxyBase: '/api/v1', crud: { segment: 'channels' }, capabilities: ["realtime","websocket"]
  },
  {
    name: 'event_manager', aws: 'EventBridge', category: 'Integrations', port: 3132, status: 'implemented',
    summary: 'Event buses.',
    proxyBase: '/api/v1', crud: { segment: 'buses' }, capabilities: ["events","bus"]
  },
  {
    name: 'download_manager', aws: 'MediaConvert + ingest', category: 'Storage & Content', port: 3133, status: 'implemented',
    summary: 'Download lists.',
    proxyBase: '/api/v1', crud: { segment: 'lists' }, capabilities: ["download","torrent","yt-dlp"]
  },
  {
    name: 'backup_manager', aws: 'AWS Backup', category: 'Storage & Content', port: 3134, status: 'implemented',
    summary: 'Backup vaults and snapshot jobs into the aerekos-backups bucket. Restore db/storage/git/generic JSON.',
    proxyBase: '/api/v1', crud: { segment: 'vaults' }, capabilities: ["backup", "restore"],
    endpoints: [
      { method: 'POST', path: '/api/v1/jobs', summary: 'Run a backup job { project_id, source, resource, vault }' },
      { method: 'GET', path: '/api/v1/jobs', summary: 'List backup jobs' },
      { method: 'GET', path: '/api/v1/jobs/:id', summary: 'Job metadata + signed download URL' },
      { method: 'POST', path: '/api/v1/jobs/:id/restore', summary: 'Restore a snapshot' }
    ]
  },
  {
    name: 'workflow_manager', aws: 'Step Functions', category: 'Compute', port: 3135, status: 'implemented',
    summary: 'State machines (subset ASL: http, queue, wait, choice, function). Outbound notify skipped. Tutorial: none. No prod mocks.',
    proxyBase: '/api/v1', crud: { segment: 'machines' }, capabilities: ["workflow"],
    endpoints: [
      { method: 'POST', path: '/api/v1/ensure-defaults', summary: 'Seed hello machine if empty' },
      { method: 'POST', path: '/api/v1/machines', summary: 'Create a machine' },
      { method: 'GET', path: '/api/v1/machines', summary: 'List machines (?project_id=)' },
      { method: 'GET', path: '/api/v1/machines/:id', summary: 'Get one machine' },
      { method: 'PATCH', path: '/api/v1/machines/:id', summary: 'Update a machine' },
      { method: 'DELETE', path: '/api/v1/machines/:id', summary: 'Delete a machine' },
      { method: 'POST', path: '/api/v1/machines/:id/run', summary: 'Run a machine (skips email/sms/slack/push when outbound disabled)' }
    ]
  },
  {
    name: 'config_manager', aws: 'AppConfig', category: 'Identity', port: 3136, status: 'implemented',
    summary: 'Config namespaces plus /evaluate against stored flags. Tutorial: none. No prod mocks.',
    proxyBase: '/api/v1', crud: { segment: 'namespaces' }, capabilities: ["config","flags"],
    endpoints: [
      { method: 'POST', path: '/api/v1/ensure-defaults', summary: 'Seed default app namespace if empty' },
      { method: 'POST', path: '/api/v1/evaluate', summary: 'Evaluate flags from stored namespaces' }
    ]
  },
  {
    name: 'cert_manager', aws: 'ACM', category: 'Identity', port: 3137, status: 'implemented',
    summary: 'Import PEM or mint self-signed certificates. No Let\'s Encrypt.',
    proxyBase: '/api/v1', crud: { segment: 'certs' }, capabilities: ["certs","tls"],
    endpoints: [
      { method: 'POST', path: '/api/v1/certs/mint', summary: 'Mint a self-signed PEM' },
      { method: 'POST', path: '/api/v1/certs/import', summary: 'Import a PEM bundle' }
    ]
  },
  {
    name: 'billing_manager', aws: 'Cost Explorer', category: 'Management', port: 3138, status: 'implemented',
    summary: 'Usage meters. /evaluate-quota uses real counts and denies when over; never { unlimited: true }.',
    proxyBase: '/api/v1', crud: { segment: 'meters' }, capabilities: ["billing","quotas"],
    endpoints: [
      { method: 'POST', path: '/api/v1/evaluate-quota', summary: 'Evaluate quota (deny when over)' }
    ]
  },
  {
    name: 'function_manager', aws: 'Lambda', category: 'Compute', port: 3139, status: 'implemented',
    summary: 'Lambda analog. Deploy/invoke plus EventSource attach/detach. Always-on poller drains inbox queues; invoke failures nack toward DLQ.',
    proxyBase: '/api/v1', crud: { segment: 'functions' }, capabilities: ["lambda","functions"],
    endpoints: [
      { method: 'POST', path: '/api/v1/functions/:id/event-sources', summary: 'Attach a queue (provision inbox+DLQ if missing)' },
      { method: 'GET', path: '/api/v1/functions/:id/event-sources', summary: 'List EventSource mappings' },
      { method: 'DELETE', path: '/api/v1/functions/:id/event-sources/:sid', summary: 'Detach a queue (does not delete it)' },
      { method: 'POST', path: '/api/v1/functions/:name/invoke', summary: 'Invoke a function' }
    ]
  },
  {
    name: 'iot_manager', aws: 'IoT Core', category: 'Edge', port: 3140, status: 'implemented',
    summary: 'IoT things.',
    proxyBase: '/api/v1', crud: { segment: 'things' }, capabilities: ["iot","mqtt"]
  },
  {
    name: 'graphql_manager', aws: 'AppSync', category: 'Dev tools', port: 3141, status: 'implemented',
    summary: 'GraphQL APIs compiled from Data API models. POST /execute runs queries against those models.',
    proxyBase: '/api/v1', crud: { segment: 'apis' }, capabilities: ["graphql", "execute"],
    endpoints: [
      { method: 'POST', path: '/api/v1/compile', summary: 'Compile schema from Data API models' },
      { method: 'POST', path: '/api/v1/execute', summary: 'Execute a GraphQL query/mutation against Data API' }
    ]
  },
  {
    name: 'notebook_manager', aws: 'SageMaker notebook', category: 'AI', port: 3142, status: 'implemented',
    summary: 'Store notebooks; Run launches a compute oneshot (jupyter/python).',
    proxyBase: '/api/v1', crud: { segment: 'notebooks' }, capabilities: ["notebook"],
    endpoints: [
      { method: 'POST', path: '/api/v1/notebooks/:id/run', summary: 'Run notebook via compute oneshot' }
    ]
  },
  {
    name: 'trace_manager', aws: 'X-Ray', category: 'Observability', port: 3143, status: 'implemented',
    summary: 'OTLP/HTTP ingest plus span list/query in SQLite.',
    proxyBase: '/api/v1', crud: { segment: 'traces' }, capabilities: ["tracing"],
    endpoints: [
      { method: 'POST', path: '/v1/traces', summary: 'OTLP HTTP ingest' },
      { method: 'GET', path: '/api/v1/spans', summary: 'List stored spans' },
      { method: 'GET', path: '/api/v1/query', summary: 'Query spans' }
    ]
  },
  {
    name: 'search_manager', aws: 'OpenSearch', category: 'Database', port: 3144, status: 'implemented',
    summary: 'SQLite FTS search. POST /query returns real hits (empty only when the index is empty).',
    proxyBase: '/api/v1', crud: { segment: 'indexes' }, capabilities: ["search", "fts"],
    endpoints: [
      { method: 'POST', path: '/api/v1/index', summary: 'Index documents' },
      { method: 'POST', path: '/api/v1/query', summary: 'FTS query → { hits }' }
    ]
  },
  {
    name: 'query_manager', aws: 'Athena', category: 'Observability', port: 3145, status: 'implemented',
    summary: 'SQL queries.',
    proxyBase: '/api/v1', crud: { segment: 'queries' }, capabilities: ["athena","sql"]
  },
  {
    name: 'waf_manager', aws: 'WAF', category: 'Edge', port: 3146, status: 'implemented',
    summary: 'WAF rules.',
    proxyBase: '/api/v1', crud: { segment: 'rules' }, capabilities: ["waf"]
  },
  {
    name: 'vpn_manager', aws: 'Client VPN', category: 'Edge', port: 3147, status: 'implemented',
    summary: 'Headscale preauth keys when HEADSCALE_URL is set; otherwise not-hooked-up.',
    proxyBase: '/api/v1', crud: { segment: 'peers' }, capabilities: ["vpn"],
    endpoints: [
      { method: 'POST', path: '/api/v1/preauth-keys', summary: 'Create a Headscale preauth key (or not-hooked-up)' }
    ]
  },
  {
    name: 'transfer_manager', aws: 'Transfer Family', category: 'Storage & Content', port: 3148, status: 'implemented',
    summary: 'SFTP endpoints that put/get objects through storage_manager.',
    proxyBase: '/api/v1', crud: { segment: 'endpoints' }, capabilities: ["sftp","transfer"],
    endpoints: [
      { method: 'POST', path: '/api/v1/endpoints/:id/put', summary: 'Write an object via storage_manager' },
      { method: 'POST', path: '/api/v1/endpoints/:id/get', summary: 'Read an object via storage_manager' }
    ]
  },
  {
    name: 'audit_manager', aws: 'CloudTrail', category: 'Observability', port: 3149, status: 'implemented',
    summary: 'Audit events.',
    proxyBase: '/api/v1', crud: { segment: 'events' }, capabilities: ["audit"]
  },
  {
    name: 'status_manager', aws: 'Statuspage', category: 'Observability', port: 3150, status: 'implemented',
    summary: 'Status incidents.',
    proxyBase: '/api/v1', crud: { segment: 'incidents' }, capabilities: ["status"]
  },
  {
    name: 'cluster_manager', aws: 'EKS', category: 'Compute', port: 3151, status: 'implemented',
    summary: 'Docker fleet inventory on the worker host. Optional k3s detect/install only on explicit confirm — never auto-install on prod.',
    proxyBase: '/api/v1', crud: { segment: 'clusters' }, capabilities: ["k8s","k3s","docker"],
    endpoints: [
      { method: 'GET', path: '/api/v1/clusters/:id/fleet', summary: 'List docker containers on this host' },
      { method: 'GET', path: '/api/v1/clusters/:id/k3s/status', summary: 'Detect k3s on the host' },
      { method: 'POST', path: '/api/v1/clusters/:id/k3s/install', summary: 'Install k3s only if { confirm: true }' }
    ]
  },
  {
    name: 'vector_manager', aws: 'OpenSearch kNN', category: 'AI', port: 3152, status: 'implemented',
    summary: 'Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG).',
    proxyBase: '/api/v1', crud: { segment: 'indexes' }, capabilities: ["vector","embeddings"],
    endpoints: [
      { method: 'POST', path: '/api/v1/upsert', summary: 'Upsert vectors' },
      { method: 'POST', path: '/api/v1/query', summary: 'Query nearest neighbors' }
    ]
  },
  {
    name: 'push_manager', aws: 'SNS mobile', category: 'Integrations', port: 3153, status: 'implemented',
    summary: 'Push subscriptions. Send when FCM secret exists; otherwise queue-only.',
    proxyBase: '/api/v1', crud: { segment: 'subscriptions' }, capabilities: ["push"],
    needsKeys: 'Queued only this pass. Do not retry live FCM send.'
  }
];

// Materialize uniform-CRUD endpoint lists, then append any extra action routes.
for (const m of managers) {
  if (m.crud) {
    const extras = m.endpoints || [];
    m.endpoints = [...crudEndpoints(m.proxyBase, m.crud.segment), ...extras];
  }
}

const STATUS_LABEL = {
  implemented: 'Implemented',
  'needs-keys': 'Implemented · needs provider keys for live calls',
  experimental: 'Experimental · not a GA dataplane; use stack revision APIs'
};

const CATEGORIES = ['Control plane', 'Core', 'Compute', 'Observability', 'Identity', 'Edge', 'Integrations', 'Dev tools', 'AI', 'Platform', 'Storage & Content', 'Management', 'Database'];

module.exports = { conductor, managers, CATEGORIES, STATUS_LABEL, crudEndpoints };
