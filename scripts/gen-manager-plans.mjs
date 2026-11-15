#!/usr/bin/env node
/**
 * Generate docs/plans/{manager}.md from catalog metadata + audit notes.
 * Run: node scripts/gen-manager-plans.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs/plans');

const WALK_ORDER = [
  'platform_app_access', 'conductor', 'auth_manager', 'ai_manager', 'iam_manager',
  'key_manager', 'secrets_manager', 'storage_manager', 'db_manager', 'compute_manager',
  'queue_manager', 'webhook_manager', 'git_manager', 'tunnel_manager', 'domain_manager',
  'registry_manager', 'logs_manager', 'schedule_manager', 'network_manager', 'api_manager',
  'metrics_manager', 'security_manager', 'analytics_manager', 'balancer_manager', 'cdn_manager',
  'email_manager', 'sms_manager', 'slack_manager', 'cicd_manager', 'code_as_infra',
  'crawler_manager', 'app_manager', 'mcp_manager', 'host_manager', 'worker_manager', 'system_manager',
];

const MANAGERS = {
  ai_manager: {
    port: 3126, aws: 'Bedrock + Polly + Transcribe', category: 'AI', tier: 'real-partial',
    summary: 'GPU AI hub: Ollama LLM/embeddings, TTS/STT proxies, project-scoped endpoints.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:ai:{capability}:endpoint/{name}',
    scopes: ['ai:InvokeLlm', 'ai:InvokeTts', 'ai:InvokeStt', 'ai:InvokeEmbeddings'],
    ui: 'AIManager (bespoke)', tests: 'crud + health; no inference integration tests',
    gaps: [
      'ARN/credentials not implemented; conductor token swap drops caller identity',
      'AUTH_REQUIRED defaults false; /models CRUD unauthenticated on direct port',
      'Split prod/orin: SERVICE_DIRECT_HOSTS for GPU',
      'Catalog missing /providers endpoints',
    ],
    tasks: [
      'See [ai_manager.md](./ai_manager.md) — full task list (reference implementation)',
      'Rename Integrations → Endpoints; ARN on create',
      'requireResource + hasScope on inference routes',
      'Credentials tab + app access curl in UI',
      'Integration tests for scoped credential invoke',
    ],
  },
  auth_manager: {
    port: 3116, aws: 'Cognito', category: 'Identity', tier: 'real-partial',
    summary: 'Token issuer (mint/verify), OIDC provider CRUD. Central auth for all managers.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A — issues tokens; Credentials are the app identity resource'],
    ui: 'AuthManager (bespoke)', tests: 'P4 crud + health',
    gaps: [
      'No Credential model/CRUD yet (env-only AUTH_CLIENTS)',
      'Signing secret dev fallback if KMS unavailable',
      'OIDC login flow not end-to-end',
      'No rate limit on /auth/token',
    ],
    tasks: [
      'Credential model + /api/v1/credentials CRUD',
      'TokenService: dynamic clients from DB, typ=app claims',
      'Bootstrap signing secret from secrets_manager (prod)',
      'Rate limit /auth/token; audit credential lifecycle',
      'Console: Credentials tab (or shared component)',
      'Integration test: credential → token → verify claims',
    ],
  },
  conductor: {
    port: 3000, aws: 'Control plane', category: 'Control plane', tier: 'production-ready',
    summary: 'Orchestrator: JWT auth, service registry/proxy, workers, projects, releases.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'Full dashboard', tests: '~16 test files',
    gaps: [
      'No app credential validation at proxy',
      'authManagerToken swaps app identity for ai_manager',
      'iam_manager policies not enforced',
      'All managers seed enabled:0',
      'Default JWT secrets in compose',
    ],
    tasks: ['See [conductor.md](./conductor.md)'],
  },
  iam_manager: {
    port: 3106, aws: 'IAM', category: 'Identity', tier: 'stub-data',
    summary: 'Roles, policies (JSON), bindings. Enforcement should live in conductor.',
    appAccess: 'admin-only', arn: 'Policies reference arn:aerekos:{pid}:…',
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'iamApi.test.js',
    gaps: ['Policies stored but NOT evaluated at proxy or managers', 'No ARN validation on policy resources'],
    tasks: [
      'Policy schema validation for ARN resources',
      'conductor/api/services/PolicyEvaluator.js — evaluate on proxy',
      'Human JWT: check iam policies; App JWT: credential allowed_resources (MVP)',
      'Console: policy editor with ARN picker',
      'Tests: deny/allow matrix',
    ],
  },
  key_manager: {
    port: 3102, aws: 'KMS', category: 'Core', tier: 'production-ready',
    summary: 'Symmetric keys, envelope encryption, rotation. Backs storage + secrets.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A — internal KMS'],
    ui: 'KeyManager (bespoke)', tests: '9 test files (strong)',
    gaps: ['No project isolation (global keys)', 'MASTER_KEY required in prod', 'Direct port: service token only on mutations'],
    tasks: [
      'Document prod MASTER_KEY rotation procedure',
      'Optional: project-scoped key aliases (future)',
      'Ensure MOCK_KEY_MANAGER=false everywhere in prod',
      'Health/metrics in dashboard',
    ],
  },
  secrets_manager: {
    port: 3107, aws: 'Secrets Manager', category: 'Identity', tier: 'production-ready',
    summary: 'Encrypted secrets via key_manager envelope. reveal=1 returns plaintext.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:secrets:secret/{name}',
    scopes: ['secrets:GetValue', 'secrets:List', 'secrets:Put'],
    ui: 'ServiceSecretsList (KeyManager)', tests: 'secretsApi.test.js',
    gaps: ['No route-level auth on direct port', 'MOCK_KEY_MANAGER=true default in compose', 'reveal=1 very powerful'],
    tasks: [
      'ARN on secret create; include in list/get',
      'requireAuth + requireResource on all routes',
      'Scope secrets:GetValue for app credentials only',
      'Audit log on reveal=1',
      'MOCK_KEY_MANAGER=false in prod compose',
      'App access panel in console',
    ],
  },
  storage_manager: {
    port: 3003, aws: 'S3', category: 'Core', tier: 'production-ready',
    summary: 'Object storage: buckets, encryption, multipart, signed URLs.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:storage:bucket/{name}',
    scopes: ['storage:GetObject', 'storage:PutObject', 'storage:ListBucket', 'storage:DeleteObject'],
    ui: 'StorageManager (bespoke)', tests: '10+ files incl storageFlow e2e',
    gaps: ['List/read less gated than writes', 'Direct port bypasses conductor auth'],
    tasks: [
      'ARN on bucket create; return invoke_url',
      'requireAuth on all routes (direct + proxy)',
      'requireResource per object operation',
      'App credential e2e: scoped bucket read/write',
      'Multipart upload resume (reliability)',
    ],
  },
  db_manager: {
    port: 3004, aws: 'RDS', category: 'Core', tier: 'production-ready',
    summary: 'Provision DB containers (PG, Redis, Mongo, Neo4j, ES, SQLite), backups.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:db:database/{name}',
    scopes: ['db:Connect', 'db:Query', 'db:Admin'],
    ui: 'DatabaseManager (bespoke)', tests: 'Per-engine integration (strong)',
    gaps: ['Connection endpoint exposes credentials', 'PROJECT_ID env on worker deploy', 'Mixed auth middleware'],
    tasks: [
      'ARN on database provision',
      'App scope db:Connect — connection info only with matching ARN',
      'Unify auth on requireAuth (drop JWT fallback)',
      'Backup schedule automation',
      'Redact passwords in logs',
    ],
  },
  compute_manager: {
    port: 3100, aws: 'ECS / Fargate', category: 'Compute', tier: 'production-ready',
    summary: 'Docker task runner: create/stop/delete project-scoped containers.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:compute:task/{name}',
    scopes: ['compute:Run', 'compute:Stop', 'compute:Describe'],
    ui: 'ComputeManager (bespoke)', tests: 'api.test.js',
    gaps: ['No manager-edge auth', 'SKIP_DOCKER metadata-only mode', 'No fleet placement'],
    tasks: [
      'ARN on task template / named task profiles',
      'requireAuth on all routes',
      'requireResource for run/stop',
      'Document SKIP_DOCKER for CI only',
    ],
  },
  queue_manager: {
    port: 3101, aws: 'SQS', category: 'Compute', tier: 'production-ready',
    summary: 'Message queues: send/receive/delete, visibility timeouts.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:queue:queue/{name}',
    scopes: ['queue:Send', 'queue:Receive', 'queue:Delete', 'queue:Admin'],
    ui: 'ManagerConsole', tests: 'queues.api.test.js',
    gaps: ['SQLite only; no multi-worker fan-out', 'No DLQ'],
    tasks: [
      'ARN on queue create',
      'requireAuth + requireResource',
      'Document persistence limits',
      'Optional DLQ segment',
      'Bespoke console UI (post app-access)',
    ],
  },
  webhook_manager: {
    port: 3112, aws: 'EventBridge / SNS HTTP', category: 'Integrations', tier: 'production-ready',
    summary: 'Outbound webhook endpoints + dispatch + delivery log.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:webhook:endpoint/{name}',
    scopes: ['webhook:Dispatch', 'webhook:Manage'],
    ui: 'ManagerConsole', tests: 'webhooksApi + e2e Tier 3',
    gaps: ['SKIP_OUTBOUND in tests', 'No retry/DLQ policies'],
    tasks: [
      'ARN on endpoint create',
      'requireAuth + scope webhook:Dispatch',
      'Retry with backoff + dead letter log',
      'Inbound webhook receiver (future)',
    ],
  },
  git_manager: {
    port: 3130, aws: 'CodeCommit', category: 'Dev tools', tier: 'production-ready',
    summary: 'Bare repos, Smart HTTP transport, push events.',
    appAccess: 'yes', arn: 'arn:aerekos:{pid}:git:repository/{name}',
    scopes: ['git:Read', 'git:Push', 'git:Admin'],
    ui: 'ManagerConsole only', tests: 'reposApi + e2e Tier 5 git transport',
    gaps: [
      'Smart HTTP on :3130 bypasses conductor JWT',
      'Separate GIT_AUTH_TOKEN not integrated with auth_manager',
      'No repo browser UI',
    ],
    tasks: [
      'ARN on repo create',
      'Smart HTTP auth via auth_manager token (Basic/Bearer)',
      'Proxy git transport through conductor OR document credential flow',
      'Bespoke GitManager UI: repos, branches, pushes',
      'Scope git:Push vs git:Read on transport',
    ],
  },
  tunnel_manager: {
    port: 3110, aws: 'Cloudflare Tunnel', category: 'Edge', tier: 'deferred-needs-keys',
    summary: 'Cloudflare tunnels — DEFERRED live API until keys; metadata CRUD works with SKIP_CLOUDFLARE.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'tunnelsApi.test.js',
    gaps: ['DEFERRED: CLOUDFLARE_API_TOKEN — edge already works via manual cloudflared'],
    tasks: [
      'DEFERRED: live Cloudflare API integration',
      'Now: document manual tunnel setup in runbook (current prod path)',
      'Now: CLI parity for metadata CRUD',
      'When keys: secrets_manager bootstrap + audit tunnel token',
    ],
  },
  domain_manager: {
    port: 3111, aws: 'Route 53', category: 'Edge', tier: 'deferred-needs-keys',
    summary: 'Cloudflare DNS — DEFERRED until API token; DNS currently managed outside manager.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'dnsApi.test.js',
    gaps: ['DEFERRED: Cloudflare keys'],
    tasks: [
      'DEFERRED: live DNS CRUD',
      'Now: catalog needs-keys; CLI metadata parity',
      'When keys: zone discovery + tunnel_manager pairing',
    ],
  },
  registry_manager: {
    port: 3129, aws: 'ECR', category: 'Dev tools', tier: 'real-partial',
    summary: 'Registry entry metadata + public config. No pull/push yet.',
    appAccess: 'no', arn: 'arn:aerekos:{pid}:registry:repository/{name} (future)',
    scopes: ['registry:Pull', 'registry:Push'],
    ui: 'ManagerConsole', tests: 'registriesApi.test.js',
    gaps: ['credential_ref is string only', 'No OCI registry runtime'],
    tasks: [
      'Real registry backend or integrate with docker registry',
      'Pull secrets via secrets_manager',
      'ARN when registry entries become app-facing',
    ],
  },
  logs_manager: {
    port: 3104, aws: 'CloudWatch Logs', category: 'Observability', tier: 'production-ready',
    summary: 'Append/query logs + batch ingest from worker outbox.',
    appAccess: 'no', arn: null,
    scopes: ['logs:Write', 'logs:Read (internal)'],
    ui: 'ManagerConsole', tests: 'logsApi.test.js',
    gaps: ['No retention/TTL', 'No full-text search'],
    tasks: [
      'Retention policy + compaction job',
      'requireAuth for ingest (service token or auth_manager)',
      'Log viewer in console',
      'Correlation ID propagation',
    ],
  },
  schedule_manager: {
    port: 3102, aws: 'EventBridge Scheduler', category: 'Compute', tier: 'production-ready',
    summary: 'Cron schedules dispatching to webhook or queue.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'api.test.js',
    gaps: ['SKIP_CRON disables loop', 'Single-node scheduler'],
    tasks: [
      'Leader election for multi-conductor cron',
      'requireAuth on CRUD',
      'Validate dispatch targets exist (webhook/queue ARN)',
    ],
  },
  network_manager: {
    port: 3103, aws: 'VPC', category: 'Compute', tier: 'production-ready',
    summary: 'Per-project Docker bridge networks.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'networksApi.test.js',
    gaps: ['SKIP_DOCKER metadata mode', 'No firewall rules'],
    tasks: [
      'requireAuth on all routes',
      'Auto-attach compute_manager tasks to project network',
      'Document network naming convention',
    ],
  },
  api_manager: {
    port: 3124, aws: 'API Gateway', category: 'Dev tools', tier: 'stub',
    summary: 'Gateway route definitions (metadata only). No runtime proxy.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No live reverse proxy', 'Pretty invoke URLs not implemented'],
    tasks: [
      'Runtime gateway: map public_path → conductor proxy or ARN',
      'Phase 9 of platform_app_access: /v1/projects/{pid}/ai/…',
      'Route health checks',
      'OpenAPI export per project',
    ],
  },
  metrics_manager: {
    port: 3105, aws: 'CloudWatch Metrics', category: 'Observability', tier: 'stub',
    summary: 'SQLite metric sample CRUD. No scrape or aggregation.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No Prometheus remote write', 'No alarms'],
    tasks: [
      'Prometheus scrape endpoint standardization',
      'Remote write or aggregation cluster',
      'Grafana dashboard templates',
      'Or: deprecate in favor of conductor /metrics only',
    ],
  },
  security_manager: {
    port: 3108, aws: 'Security Hub', category: 'Observability', tier: 'stub',
    summary: 'Security finding records only.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No scanners or CSPM'],
    tasks: ['Wire findings from conductor audit', 'Severity routing to webhook_manager', 'Or mark stub in catalog'],
  },
  analytics_manager: {
    port: 3117, aws: 'Pinpoint', category: 'Observability', tier: 'stub',
    summary: 'Product analytics event rows.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud + e2e SDK',
    gaps: ['No pipeline or dashboards'],
    tasks: ['Batch ingest API', 'Export to storage_manager', 'Or integrate external analytics'],
  },
  balancer_manager: {
    port: 3109, aws: 'ELB', category: 'Edge', tier: 'stub',
    summary: 'Load balancer target hints (addresses).',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No health checks or traffic routing'],
    tasks: ['Health-checked targets', 'Integrate with compute_manager service discovery'],
  },
  cdn_manager: {
    port: 3118, aws: 'CloudFront', category: 'Edge', tier: 'stub',
    summary: 'CDN cache rule config only.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No edge cache runtime'],
    tasks: ['Cloudflare cache rules API or nginx cache layer', 'Invalidation API'],
  },
  email_manager: {
    port: 3113, aws: 'SES', category: 'Integrations', tier: 'stub-deferred',
    summary: 'Queued email rows — DEFERRED until SMTP/SES keys in secrets_manager.',
    appAccess: 'no', arn: 'arn:aerekos:{pid}:email:identity/{name} (future)',
    scopes: ['email:Send'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No SMTP integration — deferred per enterprise_standards.md'],
    tasks: [
      'DEFERRED: SMTP send — see enterprise_standards.md',
      'Now: mark catalog status stub/needs-keys; console "Connect provider" placeholder',
      'Now: CLI parity for metadata CRUD (list/create/delete queued rows)',
      'Now: OpenAPI + docs honesty',
    ],
  },
  sms_manager: {
    port: 3114, aws: 'SNS SMS', category: 'Integrations', tier: 'stub-deferred',
    summary: 'Queued SMS rows — DEFERRED until Twilio/SNS keys.',
    appAccess: 'no', arn: null,
    scopes: ['sms:Send'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No provider — deferred'],
    tasks: [
      'DEFERRED: Twilio integration',
      'Now: catalog stub; CLI CRUD parity for queue rows',
    ],
  },
  slack_manager: {
    port: 3115, aws: 'Chatbot', category: 'Integrations', tier: 'stub-deferred',
    summary: 'Queued Slack posts — DEFERRED until Slack bot token.',
    appAccess: 'no', arn: null,
    scopes: ['slack:Post'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No Slack API — deferred'],
    tasks: [
      'DEFERRED: Slack Web API',
      'Now: catalog stub; CLI CRUD parity',
    ],
  },
  cicd_manager: {
    port: 3119, aws: 'CodePipeline', category: 'Dev tools', tier: 'stub',
    summary: 'Pipeline JSON definitions — no runners.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No build execution'],
    tasks: ['GitHub Actions / compute_manager runner integration', 'Artifact storage via storage_manager'],
  },
  code_as_infra: {
    port: 3120, aws: 'CloudFormation', category: 'Dev tools', tier: 'stub',
    summary: 'IaC snippet blobs.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No apply/plan engine'],
    tasks: ['Terraform/Pulumi runner via compute_manager', 'State in storage_manager'],
  },
  crawler_manager: {
    port: 3121, aws: 'Glue Crawler', category: 'AI', tier: 'stub-deferred',
    summary: 'Crawl job metadata — DEFERRED execution until after core platform.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No HTTP fetch — deferred'],
    tasks: [
      'DEFERRED: HTTP fetch worker',
      'Now: catalog stub; CLI CRUD parity for job metadata',
    ],
  },
  app_manager: {
    port: 3125, aws: 'Amplify / App Runner', category: 'Dev tools', tier: 'stub',
    summary: 'App metadata (repo_url, build_command).',
    appAccess: 'no', arn: 'arn:aerekos:{pid}:app:application/{name} (future)',
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No deploy integration'],
    tasks: ['Link to git_manager + cicd_manager', 'Deploy via compute_manager', 'Public URL via tunnel_manager'],
  },
  mcp_manager: {
    port: 3123, aws: 'Bedrock Agents tools', category: 'Dev tools', tier: 'stub',
    summary: 'MCP tool registry metadata.',
    appAccess: 'no', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No live MCP server processes'],
    tasks: ['Spawn MCP servers via compute_manager', 'Tool invoke auth via ai_manager credentials'],
  },
  host_manager: {
    port: 3122, aws: 'EC2 inventory', category: 'Platform', tier: 'stub',
    summary: 'Host inventory rows.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['Not synced from worker heartbeats'],
    tasks: ['Auto-populate from conductor workers', 'Link to DeviceDetails screen'],
  },
  worker_manager: {
    port: 3128, aws: 'SSM fleet tags', category: 'Platform', tier: 'stub',
    summary: 'Worker annotation labels.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['Not wired to conductor worker registry'],
    tasks: ['Sync annotations with conductor Worker model', 'Expose in DeviceDetails'],
  },
  system_manager: {
    port: 3127, aws: 'Systems Manager', category: 'Platform', tier: 'stub',
    summary: 'Maintenance task specs — no execution.',
    appAccess: 'admin-only', arn: null,
    scopes: ['N/A'],
    ui: 'ManagerConsole', tests: 'P4 crud',
    gaps: ['No host command execution'],
    tasks: ['SSM-style agent on workers', 'Execute via worker socket'],
  },
};

function navLinks(name) {
  const idx = WALK_ORDER.indexOf(name);
  const prev = idx > 0 ? WALK_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < WALK_ORDER.length - 1 ? WALK_ORDER[idx + 1] : null;
  const prevLink = prev ? `[← ${prev}](./${prev}.md)` : '—';
  const nextLink = next ? `[${next} →](./${next}.md)` : '—';
  return { prevLink, nextLink };
}

function renderManager(name, m) {
  const { prevLink, nextLink } = navLinks(name);
  const appSection = m.appAccess === 'yes'
    ? `## App access\n\n**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).\n\n| Field | Value |\n|-------|-------|\n| ARN | \`${m.arn}\` |\n| Scopes | ${m.scopes.join(', ')} |\n\n- [ ] Generate ARN on resource create\n- [ ] \`requireAuth\` + \`requireResource\` on app-callable routes\n- [ ] Register scopes in \`docs/catalog.js\`\n- [ ] Console "App access" snippet\n- [ ] e2e: credential scoped invoke`
    : m.appAccess === 'admin-only'
      ? `## App access\n\n**Candidate:** Admin-only — conductor user JWT or service token. No app credentials.\n\n${m.arn ? `Policies may reference: ${m.arn}` : ''}`
      : `## App access\n\n**Candidate:** No / internal / future.\n\n${m.arn ? `Future ARN: \`${m.arn}\`` : 'Not app-facing.'}`;

  const tasks = m.tasks.map((t) => `- [ ] ${t}`).join('\n');
  const wizardSection = `## Setup wizard

- [ ] Add \`setup\` metadata to \`docs/catalog.js\` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] \`aerekos setup ${name} --status\` matches console — [service_setup_wizard.md](./service_setup_wizard.md)`;

  const cliSection = `## CLI & click ops parity

- [ ] \`aerekos ${name} …\` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] \`aerekos info ${name}\` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation`;

  return `# ${name} — production plan

**Port:** ${m.port} · **AWS analog:** ${m.aws} · **Category:** ${m.category} · **Tier:** ${m.tier}

**Navigation:** ${prevLink} · [Index](./README.md) · ${nextLink}  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

${m.summary}

## Current state

| Area | Status |
|------|--------|
| Implementation | ${m.tier} |
| Console UI | ${m.ui} |
| Tests | ${m.tests} |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | ${name === 'key_manager' ? 'No (global)' : 'Yes'} |

### Known gaps

${m.gaps.map((g) => `- ${g}`).join('\n')}

${appSection}

${wizardSection}

${cliSection}

---

## Production tasks

${tasks}

---

## Links

- Worker scaffold: [worker/${name}/plan.md](../../worker/${name}/plan.md)
- Service doc: [docs/services/${name}.md](../services/${name}.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)
`;
}

// Skip files we write manually
const MANUAL = new Set(['platform_app_access', 'conductor', 'ai_manager']);

for (const name of WALK_ORDER) {
  if (MANUAL.has(name)) continue;
  const m = MANAGERS[name];
  if (!m) {
    console.warn('Missing metadata for', name);
    continue;
  }
  const file = path.join(outDir, `${name}.md`);
  fs.writeFileSync(file, renderManager(name, m));
  console.log('Wrote', file);
}

console.log('Done. Manual files: platform_app_access, conductor, ai_manager');
