'use strict';

/**
 * Per-manager setup wizard metadata.
 * Used by conductor SetupService and console ServiceSetupWizard.
 */

const CORE_STACK = ['key_manager', 'secrets_manager', 'auth_manager', 'storage_manager'];

const SETUP = {
  key_manager: {
    summary: 'Encryption keys — required by secrets_manager and storage.',
    docPath: 'services/key_manager.md',
    dependencies: [],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  secrets_manager: {
    summary: 'Encrypted secrets store for API tokens, signing keys, and provider credentials.',
    docPath: 'services/secrets_manager.md',
    dependencies: [
      { service: 'key_manager', required: true, reason: 'Envelope encryption via KMS' },
    ],
    secrets: [
      { name: 'conductor.client_secret', required: true, desc: 'auth_manager conductor client secret' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'test'],
    deferredKeys: null,
  },
  auth_manager: {
    summary: 'App credentials, client_credentials tokens, and service authentication.',
    docPath: 'services/auth_manager.md',
    dependencies: [
      { service: 'key_manager', required: true, reason: 'Signing key storage' },
      { service: 'secrets_manager', required: true, reason: 'conductor.client_secret bootstrap' },
    ],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'test', 'app-access'],
    deferredKeys: null,
  },
  storage_manager: {
    summary: 'Object storage — buckets, signed URLs, app-scoped access.',
    docPath: 'services/storage_manager.md',
    dependencies: [
      { service: 'key_manager', required: true, reason: 'Object encryption' },
      { service: 'auth_manager', required: true, reason: 'App credential invoke' },
    ],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-bucket', label: 'Create your first bucket' },
    deferredKeys: null,
  },
  db_manager: {
    summary: 'Managed SQLite/Postgres databases per project.',
    docPath: 'services/db_manager.md',
    dependencies: [
      { service: 'key_manager', required: true, reason: 'Credential encryption' },
      { service: 'auth_manager', required: true, reason: 'db:Connect app access' },
    ],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-database', label: 'Create a database' },
    deferredKeys: null,
  },
  compute_manager: {
    summary: 'Run containers and tasks across the worker fleet.',
    docPath: 'services/compute_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'Task invoke auth' },
    ],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-task', label: 'Create a task definition' },
    deferredKeys: null,
  },
  ai_manager: {
    summary: 'LLM, embeddings, TTS & STT on GPU workers (Ollama, Whisper, etc.).',
    docPath: 'services/ai_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'API authentication' },
      { service: 'key_manager', required: true, reason: 'KMS' },
      { service: 'secrets_manager', required: true, reason: 'Provider secrets' },
    ],
    secrets: [],
    workerHints: [{ label: 'GPU', resource: 'gpu' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'seed-local', label: 'Set up local GPU endpoints' },
    deferredKeys: null,
  },
  api_manager: {
    summary: 'Pretty /v1/projects/… invoke URLs → manager proxy with ARN injection.',
    docPath: 'services/api_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'App JWT at gateway' },
    ],
    secrets: [],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'apply-data-api', label: 'Apply a Data API schema (or create a gateway route)' },
    deferredKeys: null,
  },
  queue_manager: {
    summary: 'Durable message queues for async workloads.',
    docPath: 'services/queue_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'queue:Send scope' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-queue', label: 'Create a queue' },
    deferredKeys: null,
  },
  webhook_manager: {
    summary: 'Outbound webhooks with retries and delivery logs.',
    docPath: 'services/webhook_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'webhook:Dispatch scope' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-webhook', label: 'Create a webhook endpoint' },
    deferredKeys: null,
  },
  git_manager: {
    summary: 'Git Smart HTTP repositories per project.',
    docPath: 'services/git_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'git:Read / git:Push' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-repo', label: 'Create a repository' },
    deferredKeys: null,
  },
  tunnel_manager: {
    summary: 'Cloudflare Tunnel ingress for cloud.aerekos.com / cloudapi.',
    docPath: 'services/tunnel_manager.md',
    dependencies: [
      { service: 'secrets_manager', required: true, reason: 'cloudflare.api_token' },
    ],
    secrets: [
      { name: 'cloudflare_api_token', required: true, desc: 'Cloudflare API token (Tunnel + DNS)' },
      { name: 'cloudflare_account_id', required: true, desc: 'Cloudflare account ID' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'test'],
    deferredKeys: null,
  },
  domain_manager: {
    summary: 'DNS zones and records paired with tunnels.',
    docPath: 'services/domain_manager.md',
    dependencies: [
      { service: 'secrets_manager', required: true, reason: 'cloudflare.api_token' },
      { service: 'tunnel_manager', required: true, reason: 'Tunnel hostname pairing' },
    ],
    secrets: [
      { name: 'cloudflare_api_token', required: true, desc: 'Cloudflare DNS API' },
      { name: 'cloudflare_zone_id', required: false, desc: 'Default zone ID (optional — list zones in Edge Manager)' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'test'],
    deferredKeys: null,
  },
  email_manager: {
    summary: 'Transactional email (SMTP/SES).',
    docPath: 'services/email_manager.md',
    dependencies: [{ service: 'secrets_manager', required: true, reason: 'SMTP credentials' }],
    secrets: [{ name: 'smtp.password', required: false, desc: 'SMTP provider password' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure'],
    deferredKeys: ['smtp', 'ses'],
  },
  slack_manager: {
    summary: 'Slack notifications and bots.',
    docPath: 'services/slack_manager.md',
    dependencies: [{ service: 'secrets_manager', required: false, reason: 'Slack bot token' }],
    secrets: [{ name: 'slack.bot_token', required: false, desc: 'Slack bot OAuth token' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure'],
    deferredKeys: ['slack'],
  },
  websocket_manager: {
    summary: 'App pub/sub channels over WebSocket (not the conductor dashboard socket).',
    docPath: 'services/websocket_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'Channel subscribe auth' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-channel', label: 'Create channel "app"' },
    deferredKeys: null,
  },
  event_manager: {
    summary: 'Publish once; route to queue, webhook, websocket, function, email, sms, slack, iot, or push.',
    docPath: 'services/event_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'event:Put scope' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'send-test-event', label: 'Send a test event' },
    deferredKeys: null,
  },
  download_manager: {
    summary: 'Torrents, yt-dlp (mp3/mp4), download lists, overnight windows; writes to object storage.',
    docPath: 'services/download_manager.md',
    dependencies: [
      { service: 'storage_manager', required: true, reason: 'Completed files land in a bucket' },
      { service: 'auth_manager', required: true, reason: 'download:Add scope' },
      { service: 'event_manager', required: false, reason: 'Emit item.completed' },
    ],
    secrets: [{ name: 'jackett.api_key', required: false, desc: 'Jackett indexer API key (optional)' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'paste-urls', label: 'Paste URLs into inbox' },
    deferredKeys: ['jackett'],
  },
  backup_manager: {
    summary: 'Cross-product backup vaults and restore records. Bytes land in storage.',
    docPath: 'services/backup_manager.md',
    dependencies: [
      { service: 'storage_manager', required: true, reason: 'Snapshot objects' },
      { service: 'auth_manager', required: true, reason: 'backup:Write' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-vault', label: 'Create default vault' },
    deferredKeys: null,
  },
  workflow_manager: {
    summary: 'State machines: http, queue, wait, choice, function steps.',
    docPath: 'services/workflow_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'workflow:Start' },
      { service: 'function_manager', required: false, reason: 'Function steps' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-machine', label: 'Create hello workflow' },
    deferredKeys: null,
  },
  config_manager: {
    summary: 'Non-secret app config, namespaces, and feature flags.',
    docPath: 'services/config_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'config:Get' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-namespace', label: 'Create namespace "app"' },
    deferredKeys: null,
  },
  cert_manager: {
    summary: 'TLS certificates — upload PEM now; ACME via domain_manager when DNS is ready.',
    docPath: 'services/cert_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'cert:Write' },
      { service: 'domain_manager', required: false, reason: 'HTTP-01 / DNS-01 ACME' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'upload-pem', label: 'Upload a PEM certificate' },
    deferredKeys: ['acme'],
  },
  billing_manager: {
    summary: 'Usage meters and quotas (compute, storage, LLM tokens, function invocations). No payments.',
    docPath: 'services/billing_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'billing:Read' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  function_manager: {
    summary: 'Short-lived functions (Lambda). Sync invoke or async via inbox queue + poller.',
    docPath: 'services/function_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'function:Invoke' },
      { service: 'queue_manager', required: true, reason: 'Default inbox + DLQ' },
      { service: 'storage_manager', required: true, reason: 'Zip artifacts' },
      { service: 'compute_manager', required: false, reason: 'Run zip/image containers' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'create-hello', label: 'Deploy hello function' },
    deferredKeys: null,
  },
  iot_manager: {
    summary: 'IoT things and MQTT topics that publish into the event bus.',
    docPath: 'services/iot_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'iot:Publish' },
      { service: 'event_manager', required: true, reason: 'Topic → event_manager' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-thing', label: 'Create a thing + test publish' },
    deferredKeys: null,
  },
  graphql_manager: {
    summary: 'GraphQL compiled from the same Data API schema as api_manager.',
    docPath: 'services/graphql_manager.md',
    dependencies: [
      { service: 'api_manager', required: true, reason: 'Data API models' },
      { service: 'auth_manager', required: true, reason: 'graphql:Query' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'compile-schema', label: 'Compile from Data API' },
    deferredKeys: null,
  },
  notebook_manager: {
    summary: 'Jupyter / code-server as a compute task. GPU worker hint.',
    docPath: 'services/notebook_manager.md',
    dependencies: [
      { service: 'compute_manager', required: true, reason: 'Run the notebook container' },
      { service: 'secrets_manager', required: true, reason: 'Notebook token' },
    ],
    workerHints: [{ label: 'GPU', resource: 'gpu' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'open-notebook', label: 'Create lab notebook' },
    deferredKeys: null,
  },
  trace_manager: {
    summary: 'Ingest spans and show a waterfall. Functions emit spans with trace_id.',
    docPath: 'services/trace_manager.md',
    dependencies: [{ service: 'logs_manager', required: false, reason: 'Correlate with logs' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'ingest-span', label: 'Send a sample trace' },
    deferredKeys: null,
  },
  search_manager: {
    summary: 'Full-text index over storage prefixes / JSON docs.',
    docPath: 'services/search_manager.md',
    dependencies: [
      { service: 'storage_manager', required: true, reason: 'Index objects from a prefix' },
      { service: 'auth_manager', required: true, reason: 'search:Query' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'index-prefix', label: 'Index a sample prefix' },
    deferredKeys: null,
  },
  query_manager: {
    summary: 'DuckDB SQL over a bucket prefix (Athena analog). Not product analytics.',
    docPath: 'services/query_manager.md',
    dependencies: [
      { service: 'storage_manager', required: true, reason: 'Query objects in a prefix' },
      { service: 'auth_manager', required: true, reason: 'query:Run' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'run-sql', label: 'Run a sample query' },
    deferredKeys: null,
  },
  waf_manager: {
    summary: 'Rate, CIDR, and path rules attached to api_manager / balancer.',
    docPath: 'services/waf_manager.md',
    dependencies: [
      { service: 'api_manager', required: false, reason: 'Attach to gateway' },
      { service: 'auth_manager', required: true, reason: 'waf:Write' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-rule', label: 'Create default rate rule' },
    deferredKeys: null,
  },
  vpn_manager: {
    summary: 'Headscale / WireGuard click-ops. Join + download peer config.',
    docPath: 'services/vpn_manager.md',
    dependencies: [{ service: 'network_manager', required: false, reason: 'Reuse existing overlay' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'download-config', label: 'Create a peer and download config' },
    deferredKeys: null,
  },
  transfer_manager: {
    summary: 'SFTP in/out of a storage bucket (Transfer Family analog).',
    docPath: 'services/transfer_manager.md',
    dependencies: [
      { service: 'storage_manager', required: true, reason: 'Bucket backing store' },
      { service: 'auth_manager', required: true, reason: 'transfer:Connect' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-sftp', label: 'Create SFTP endpoint' },
    deferredKeys: null,
  },
  audit_manager: {
    summary: 'Ingest conductor audit events; query and export to storage.',
    docPath: 'services/audit_manager.md',
    dependencies: [
      { service: 'storage_manager', required: false, reason: 'Export trail objects' },
      { service: 'auth_manager', required: true, reason: 'audit:Read' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  status_manager: {
    summary: 'Public project status page driven by fleet health and aerekos.fleet events.',
    docPath: 'services/status_manager.md',
    dependencies: [
      { service: 'event_manager', required: true, reason: 'Fleet health bus' },
      { service: 'auth_manager', required: false, reason: 'Public /status can skip JWT' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'public-status', label: 'Open the public status stub' },
    deferredKeys: null,
  },
  cluster_manager: {
    summary: 'k3s/k3d via compute; kubeconfig in secrets. Thin v1.',
    docPath: 'services/cluster_manager.md',
    dependencies: [
      { service: 'compute_manager', required: true, reason: 'Run k3s' },
      { service: 'secrets_manager', required: true, reason: 'kubeconfig' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-cluster', label: 'Create a k3s cluster stub' },
    deferredKeys: null,
  },
  vector_manager: {
    summary: 'Embedding indexes for RAG. ai_manager talks here instead of ad-hoc LanceDB only.',
    docPath: 'services/vector_manager.md',
    dependencies: [
      { service: 'ai_manager', required: false, reason: 'Embeddings from LLM fleet' },
      { service: 'auth_manager', required: true, reason: 'vector:Query' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'create-index', label: 'Create rag index' },
    deferredKeys: null,
  },
  push_manager: {
    summary: 'Browser (and later device) Web Push. Fleet toasts can fan out when the console is closed.',
    docPath: 'services/push_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'push:Send' },
      { service: 'event_manager', required: false, reason: 'Event target' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'first-resource', 'test'],
    firstResource: { action: 'subscribe', label: 'Create a web push subscription stub' },
    deferredKeys: null,
  },
  logs_manager: {
    summary: 'Centralized log collection. Pair with traces for observe pack.',
    docPath: 'services/logs_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'logs:Write' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  metrics_manager: {
    summary: 'Time-series metrics and alarm rules that fire into event_manager.',
    docPath: 'services/metrics_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'metrics:Put' },
      { service: 'event_manager', required: false, reason: 'Alarm → aerekos.fleet / custom bus' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  schedule_manager: {
    summary: 'Cron and scheduled tasks. Function ticks enqueue to inbox queues.',
    docPath: 'services/schedule_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'schedule:Put' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  iam_manager: {
    summary: 'Users, roles, and policy evaluation.',
    docPath: 'services/iam_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'IAM identity' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  registry_manager: {
    summary: 'Private container (and later npm/pypi) registry.',
    docPath: 'services/registry_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'registry:Pull' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  network_manager: {
    summary: 'Virtual networks, routing, and overlays.',
    docPath: 'services/network_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'network:Write' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  balancer_manager: {
    summary: 'Distribute traffic across instances. WAF rules can attach here.',
    docPath: 'services/balancer_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'balancer:Write' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  analytics_manager: {
    summary: 'Product analytics and DuckDB query-on-storage.',
    docPath: 'services/analytics_manager.md',
    dependencies: [{ service: 'storage_manager', required: false, reason: 'Query exported events' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  cdn_manager: {
    summary: 'Cache and distribute content at the edge.',
    docPath: 'services/cdn_manager.md',
    dependencies: [{ service: 'storage_manager', required: false, reason: 'Origin buckets' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  cicd_manager: {
    summary: 'Build, test, and apply project stacks.',
    docPath: 'services/cicd_manager.md',
    dependencies: [{ service: 'code_as_infra', required: false, reason: 'Stack modules' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  code_as_infra: {
    summary: 'Declarative modules (data-api, function, stack) stored as JSON.',
    docPath: 'services/code_as_infra.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'iac:Apply' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  mcp_manager: {
    summary: 'Model Context Protocol server fleet.',
    docPath: 'services/mcp_manager.md',
    dependencies: [{ service: 'ai_manager', required: false, reason: 'Tool backends' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  app_manager: {
    summary: 'Long-running application deployments.',
    docPath: 'services/app_manager.md',
    dependencies: [{ service: 'compute_manager', required: true, reason: 'Run the app task' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  crawler_manager: {
    summary: 'Crawl and canary GET against public URLs.',
    docPath: 'services/crawler_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'crawler:Run' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
  host_manager: {
    summary: 'Host inventory (hostname/address/role).',
    docPath: 'services/host_manager.md',
    dependencies: [],
    wizardSteps: ['overview', 'enable', 'test'],
    deferredKeys: null,
  },
  worker_manager: {
    summary: 'Worker/fleet labels and annotations.',
    docPath: 'services/worker_manager.md',
    dependencies: [],
    wizardSteps: ['overview', 'enable', 'test'],
    deferredKeys: null,
  },
  system_manager: {
    summary: 'Maintenance task specs. No host execution in MVP.',
    docPath: 'services/system_manager.md',
    dependencies: [],
    wizardSteps: ['overview', 'enable', 'test'],
    deferredKeys: null,
  },
  sms_manager: {
    summary: 'SMS queue. Live Twilio send is skipped (SKIP_OUTBOUND).',
    docPath: 'services/sms_manager.md',
    dependencies: [{ service: 'secrets_manager', required: false, reason: 'Twilio credentials' }],
    secrets: [{ name: 'twilio.auth_token', required: false, desc: 'Twilio auth token' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure'],
    deferredKeys: ['twilio'],
  },
  security_manager: {
    summary: 'Findings and compliance jobs (metadata; no host reboot).',
    docPath: 'services/security_manager.md',
    dependencies: [{ service: 'auth_manager', required: true, reason: 'security:Read' }],
    wizardSteps: ['overview', 'dependencies', 'enable', 'test'],
    deferredKeys: null,
  },
};

const PACKS = {
  core: {
    label: 'Core',
    services: CORE_STACK,
    summary: 'Keys, secrets, auth, and object storage.',
  },
  downloads: {
    label: 'Downloads',
    services: ['storage_manager', 'download_manager'],
    optional: ['event_manager'],
    summary: 'Inbox list, overnight window, paste URLs.',
  },
  serverless: {
    label: 'Serverless',
    services: ['storage_manager', 'compute_manager', 'queue_manager', 'function_manager', 'event_manager', 'api_manager'],
    summary: 'Hello-world function bound to inbox queue + DLQ.',
  },
  backend: {
    label: 'Backend',
    services: ['auth_manager', 'db_manager', 'api_manager', 'function_manager', 'queue_manager'],
    summary: 'Sample User/Post Data API plus a before_create lambda.',
  },
  realtime: {
    label: 'Realtime',
    services: ['event_manager', 'websocket_manager'],
    summary: 'Default bus + channel "app".',
  },
  backup: {
    label: 'Backup',
    services: ['storage_manager', 'backup_manager'],
    summary: 'Default vault and nightly plan stub.',
  },
  observe: {
    label: 'Observe',
    services: ['logs_manager', 'metrics_manager', 'trace_manager', 'event_manager', 'status_manager'],
    summary: 'Logs, metrics, traces, fleet events, public status.',
  },
  iot: {
    label: 'IoT',
    services: ['iot_manager', 'event_manager', 'queue_manager'],
    summary: 'One thing plus test MQTT publish.',
  },
  search: {
    label: 'Search',
    services: ['storage_manager', 'search_manager'],
    summary: 'Index a sample prefix.',
  },
  vpn: {
    label: 'VPN',
    services: ['vpn_manager'],
    summary: 'Download Headscale/WireGuard config.',
  },
};

function defaultSetup(name) {
  return {
    summary: `${name.replace(/_/g, ' ')} manager service.`,
    docPath: `services/${name}.md`,
    dependencies: [],
    secrets: [],
    wizardSteps: ['overview', 'enable', 'test'],
    deferredKeys: null,
  };
}

function getSetupMeta(serviceName) {
  const base = SETUP[serviceName] || defaultSetup(serviceName);
  const meta = {
    ...base,
    wizardSteps: [...(base.wizardSteps || ['overview', 'enable', 'test'])],
    dependencies: [...(base.dependencies || [])],
    secrets: [...(base.secrets || [])],
  };
  try {
    const { getClickOps } = require('./clickOpsCatalog');
    const ops = getClickOps(serviceName);
    if (ops) {
      if (!meta.firstResource) {
        meta.firstResource = {
          action: `create-${ops.segment}`,
          label: `Create a ${ops.singular}`,
        };
      }
      if (!meta.wizardSteps.includes('first-resource')) {
        const i = meta.wizardSteps.indexOf('enable');
        const at = i >= 0 ? i + 1 : meta.wizardSteps.length;
        meta.wizardSteps.splice(at, 0, 'first-resource');
      }
    }
  } catch (_) { /* catalog optional at load */ }
  return meta;
}

function listSetupServices() {
  return Object.keys(SETUP);
}

function getPack(name) {
  return PACKS[String(name || '').toLowerCase()] || null;
}

function listPacks() {
  return Object.entries(PACKS).map(([id, p]) => ({ id, ...p }));
}

function requiredDepsInOrder(serviceName) {
  const graph = buildDependencyGraph();
  const needed = new Set();
  function walk(name) {
    if (needed.has(name)) return;
    const meta = getSetupMeta(name);
    for (const dep of meta.dependencies || []) {
      if (dep.required) walk(dep.service);
    }
    needed.add(name);
  }
  walk(serviceName);
  return graph.enableOrder.filter((n) => needed.has(n));
}

function buildDependencyGraph() {
  const nodes = new Set([...Object.keys(SETUP)]);
  const edges = [];
  for (const [name, meta] of Object.entries(SETUP)) {
    for (const dep of meta.dependencies || []) {
      nodes.add(dep.service);
      edges.push({ from: dep.service, to: name, required: !!dep.required, reason: dep.reason || '' });
    }
  }
  const order = topologicalSort(nodes, edges);
  return { nodes: [...nodes], edges, enableOrder: order, coreStack: CORE_STACK };
}

function topologicalSort(nodes, edges) {
  const inDeg = new Map([...nodes].map((n) => [n, 0]));
  const adj = new Map([...nodes].map((n) => [n, []]));
  for (const e of edges) {
    if (!e.required) continue;
    adj.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }
  const q = [...nodes].filter((n) => inDeg.get(n) === 0);
  const out = [];
  while (q.length) {
    const n = q.shift();
    out.push(n);
    for (const t of adj.get(n) || []) {
      inDeg.set(t, inDeg.get(t) - 1);
      if (inDeg.get(t) === 0) q.push(t);
    }
  }
  return out.length === nodes.size ? out : [...nodes];
}

module.exports = {
  CORE_STACK,
  SETUP,
  PACKS,
  getSetupMeta,
  listSetupServices,
  buildDependencyGraph,
  getPack,
  listPacks,
  requiredDepsInOrder,
};
